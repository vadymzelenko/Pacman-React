// Кооперативный мультиплеер Grid Chomp (host-авторитетный).
// Хост считает игру и рассылает состояние; гости шлют ввод и рендерят состояние.
// Связь — Supabase Realtime (broadcast + presence).

import { TILE, isWalkable, tileCenter, clearChunkCache } from './map';
import { findPath } from './astar';
import {
  DIRS,
  colOf,
  rowOf,
  isAligned,
  stepEntity,
  drawWalls,
  drawCoin,
  drawPolice,
  drawPlayer,
} from './engine';
import { getSkin } from '../lib/catalog';
import { SoundManager } from './sounds';

const PLAYER_SPEED = TILE * 8.5;
const POLICE_BASE_SPEED = TILE * 6.8; // заметно медленнее игрока
const COIN_TARGET = 22; // монет на каждого игрока
const REPATH_INTERVAL = 0.3;
const CAPTURE_DIST = TILE * 0.62;
const RESPAWN_TIME = 7; // секунд до возрождения
const INVULN_TIME = 2;
const BROADCAST_HZ = 15;

const FLOOR = '#0a0a10';

function makePlayer(id, name, color, glow, c, r) {
  return {
    id,
    name,
    color,
    glow,
    x: tileCenter(c),
    y: tileCenter(r),
    dir: DIRS.none,
    nextDir: null,
    radius: TILE * 0.36,
    speed: PLAYER_SPEED,
    alive: true,
    invuln: 0,
    respawnIn: 0,
    coins: 0,
  };
}

function makePolice(c, r) {
  return {
    x: tileCenter(c),
    y: tileCenter(r),
    dir: DIRS.none,
    nextDir: null,
    radius: TILE * 0.34,
    speed: POLICE_BASE_SPEED,
    path: [],
    repathTimer: Math.random() * REPATH_INTERVAL,
  };
}

export function createMultiplayerGame(canvas, options = {}) {
  const {
    supabase,
    roomCode,
    selfId,
    selfName = 'Player',
    skinId = 'indigo',
    soundPackId = 'classic',
    musicThemeId = 'ambient',
    isHost = false,
    onHud = () => {},
    onGameOver = () => {},
    onStatus = () => {},
    onPlayersChange = () => {},
  } = options;

  const skin = getSkin(skinId);
  const sounds = new SoundManager({ soundPackId, musicThemeId });

  let seed = 0;
  let dpr = 1;
  let w = 0;
  let h = 0;
  let viewScale = 1;
  let destroyed = false;
  let rafId = 0;
  let last = 0;
  let lastBroadcast = 0;
  let lastHudAt = 0;
  let channel = null;
  let view = null;
  let gameOverSent = false;

  let state = 'ready'; // ready | playing | over
  let elapsed = 0;
  let survived = 0;
  let teamCoins = 0;
  let teamScore = 0;
  let nextCoinId = 1;

  const players = [];
  const police = [];
  const coinSets = new Map();

  function randomNearbyWalkable(ref, minDist, maxDist) {
    const pc = colOf(ref.x);
    const pr = rowOf(ref.y);
    for (let i = 0; i < 200; i++) {
      const ang = Math.random() * Math.PI * 2;
      const dist = minDist + Math.random() * Math.max(0, maxDist - minDist);
      const c = Math.round(pc + Math.cos(ang) * dist);
      const r = Math.round(pr + Math.sin(ang) * dist);
      if (isWalkable(c, r, seed)) return { c, r };
    }
    return { c: pc, r: pr };
  }

  function maybeStart() {
    if (state === 'ready' && players.length >= 2) {
      state = 'playing';
      sounds.startMusic();
      sounds.startSiren();
      emitHud(true);
    }
  }

  function ensurePlayer(id, name, color, glow) {
    if (players.some((p) => p.id === id)) return;
    if (players.length >= 2) return;
    const ref = players[0];
    const pos = ref ? randomNearbyWalkable(ref, 2, 5) : { c: 1, r: 1 };
    const p = makePlayer(id, name, color, glow, pos.c, pos.r);
    players.push(p);
    coinSets.set(id, []);
    onPlayersChange(players.length);
    maybeStart();
  }

  function removePlayer(id) {
    const i = players.findIndex((p) => p.id === id);
    if (i !== -1) players.splice(i, 1);
    coinSets.delete(id);
    onPlayersChange(players.length);
  }

  function nearestAlive(from) {
    let best = null;
    let bd = Infinity;
    for (const p of players) {
      if (!p.alive) continue;
      const d = Math.hypot(p.x - from.x, p.y - from.y);
      if (d < bd) {
        bd = d;
        best = p;
      }
    }
    return best;
  }

  function targetPolice() {
    return 2 + Math.floor(elapsed / 8); // без лимита: спавним, пока не поймают
  }

  function spawnPolice() {
    const ref = players.find((p) => p.alive) || players[0];
    if (!ref) return;
    const halfCols = Math.ceil(w / viewScale / TILE / 2);
    const halfRows = Math.ceil(h / viewScale / TILE / 2);
    const minDist = Math.ceil(Math.hypot(halfCols, halfRows)) + 2;
    const pos = randomNearbyWalkable(ref, minDist, minDist + 5);
    police.push(makePolice(pos.c, pos.r));
  }

  function steerPolice(pol, dt) {
    pol.repathTimer -= dt;
    const target = nearestAlive(pol);
    if (!target) return;

    if (pol.repathTimer <= 0) {
      pol.repathTimer = REPATH_INTERVAL;
      pol.path =
        findPath({
          isWalkable: (c, r) => isWalkable(c, r, seed),
          from: { col: colOf(pol.x), row: rowOf(pol.y) },
          to: { col: colOf(target.x), row: rowOf(target.y) },
        }) || [];
    }

    if (pol.path.length) {
      const next = pol.path[0];
      if (isAligned(pol)) {
        const dc = next.col - colOf(pol.x);
        const dr = next.row - rowOf(pol.y);
        if (dc === 1) pol.nextDir = 'right';
        else if (dc === -1) pol.nextDir = 'left';
        else if (dr === 1) pol.nextDir = 'down';
        else if (dr === -1) pol.nextDir = 'up';
        else pol.path.shift();
      }
    } else if (isAligned(pol)) {
      const dc = colOf(target.x) - colOf(pol.x);
      const dr = rowOf(target.y) - rowOf(pol.y);
      if (Math.abs(dc) > Math.abs(dr)) pol.nextDir = dc > 0 ? 'right' : 'left';
      else pol.nextDir = dr > 0 ? 'down' : 'up';
    }

    stepEntity(seed, pol, dt);

    if (pol.path.length) {
      const next = pol.path[0];
      if (colOf(pol.x) === next.col && rowOf(pol.y) === next.row) pol.path.shift();
    }
  }

  function ensurePlayerCoins(p) {
    const set = coinSets.get(p.id);
    if (!set) return;
    while (set.length < COIN_TARGET) {
      const pos = randomNearbyWalkable(p, 2, 8);
      set.push({ id: nextCoinId++, x: tileCenter(pos.c), y: tileCenter(pos.r) });
    }
  }

  function collectPlayerCoins(p) {
    const set = coinSets.get(p.id);
    if (!set) return;
    const reach = TILE * 0.55;
    for (let i = set.length - 1; i >= 0; i--) {
      const c = set[i];
      const dx = c.x - p.x;
      const dy = c.y - p.y;
      if (dx * dx + dy * dy < reach * reach) {
        set.splice(i, 1);
        p.coins += 1;
        sounds.coin();
      }
    }
  }

  function respawnPlayer(p) {
    const alive = players.find((x) => x.alive);
    if (!alive) return;
    const pos = randomNearbyWalkable(alive, 3, 6);
    p.x = tileCenter(pos.c);
    p.y = tileCenter(pos.r);
    p.dir = DIRS.none;
    p.nextDir = null;
    p.alive = true;
    p.invuln = INVULN_TIME;
    p.respawnIn = 0;
    sounds.respawn();
  }

  function checkCapture() {
    for (const p of players) {
      if (!p.alive || p.invuln > 0) continue;
      for (const pol of police) {
        const dx = pol.x - p.x;
        const dy = pol.y - p.y;
        if (dx * dx + dy * dy < CAPTURE_DIST * CAPTURE_DIST) {
          p.alive = false;
          p.respawnIn = RESPAWN_TIME;
          p.dir = DIRS.none;
          p.nextDir = null;
          sounds.death();
          break;
        }
      }
    }
  }

  function gameOver() {
    state = 'over';
    sounds.pauseAll();
    sounds.stopMusic();
    emitHud(true);
    if (!gameOverSent) {
      gameOverSent = true;
      onGameOver({
        score: teamScore,
        coins: teamCoins,
        survived: Math.floor(survived),
        time: Math.floor(survived),
        selfCoins: players.find((p) => p.id === selfId)?.coins || 0,
      });
    }
  }

  function nearestThreat() {
    let min = Infinity;
    for (const pol of police) {
      for (const p of players) {
        if (!p.alive) continue;
        const d = Math.hypot(pol.x - p.x, pol.y - p.y);
        if (d < min) min = d;
      }
    }
    if (min === Infinity) return 0;
    return Math.max(0, 1 - min / (TILE * 6));
  }

  function update(dt) {
    if (state !== 'playing') return;
    elapsed += dt;
    survived += dt;
    teamCoins = players.reduce((s, p) => s + p.coins, 0);
    teamScore = Math.floor(survived * 20) + teamCoins * 25;

    for (const p of players) {
      if (!p.alive) continue;
      p.invuln = Math.max(0, p.invuln - dt);
      stepEntity(seed, p, dt);
      ensurePlayerCoins(p);
      collectPlayerCoins(p);
    }

    const aliveCount = players.filter((p) => p.alive).length;
    if (aliveCount === 0) {
      gameOver();
      return;
    }

    for (const p of players) {
      if (p.alive) continue;
      p.respawnIn -= dt;
      if (p.respawnIn <= 0) respawnPlayer(p);
    }

    while (police.length < targetPolice()) spawnPolice();
    const speed = POLICE_BASE_SPEED;
    for (const pol of police) pol.speed = speed;
    for (const pol of police) steerPolice(pol, dt);

    checkCapture();
    sounds.setThreat(nearestThreat());
  }

  function allCoins() {
    const arr = [];
    for (const [ownerId, set] of coinSets) {
      for (const c of set) arr.push({ id: c.id, ownerId, x: c.x, y: c.y });
    }
    return arr;
  }

  function buildState() {
    return {
      type: 'state',
      state,
      survived: Math.floor(survived),
      teamScore,
      teamCoins,
      players: players.map((p) => ({
        id: p.id,
        name: p.name,
        color: p.color,
        glow: p.glow,
        x: p.x,
        y: p.y,
        dir: { x: p.dir.x, y: p.dir.y },
        alive: p.alive,
        coins: p.coins,
        respawnIn: p.alive ? 0 : p.respawnIn,
      })),
      police: police.map((p) => ({ x: p.x, y: p.y })),
      coins: allCoins(),
    };
  }

  function emitHud(force = false) {
    const now = performance.now();
    if (!force && now - lastHudAt < 120) return;
    lastHudAt = now;

    if (isHost) {
      const self = players.find((p) => p.id === selfId);
      onHud({
        score: teamScore,
        teamCoins,
        coins: self?.coins || 0,
        time: Math.floor(survived),
        police: police.length,
        players: players.length,
        state,
        observer: !!self && !self.alive,
        respawnIn: self && !self.alive ? Math.ceil(self.respawnIn) : 0,
      });
    } else if (view) {
      const self = view.players.find((p) => p.id === selfId);
      onHud({
        score: view.teamScore,
        teamCoins: view.teamCoins,
        coins: self?.coins || 0,
        time: view.survived,
        police: view.police.length,
        players: view.players.length,
        state: view.state,
        observer: !!self && !self.alive,
        respawnIn: self && !self.alive ? Math.ceil(self.respawnIn || 0) : 0,
      });
    }
  }

  function sceneData() {
    let playersArr;
    let policeArr;
    let coinsArr;

    if (isHost) {
      playersArr = players;
      policeArr = police;
      coinsArr = [];
      for (const [ownerId, set] of coinSets) {
        for (const c of set) coinsArr.push({ ...c, ownerId });
      }
    } else if (view) {
      playersArr = view.players;
      policeArr = view.police;
      coinsArr = view.coins;
    } else {
      return null;
    }

    const self = playersArr.find((p) => p.id === selfId);
    const focus = self && self.alive ? self : playersArr.find((p) => p.alive) || self || playersArr[0];
    if (!focus) return null;

    return {
      focus,
      playersArr,
      policeArr,
      selfCoins: coinsArr.filter((c) => c.ownerId === selfId),
    };
  }

  function render(now) {
    const cw = canvas.clientWidth || 1;
    const ch = canvas.clientHeight || 1;
    if (cw !== w || ch !== h) {
      w = cw;
      h = ch;
      viewScale = w < 480 ? 0.6 : w < 768 ? 0.8 : 1;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
    }
    const ctx = canvas.getContext('2d');

    const sc = sceneData();
    if (!sc) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = FLOOR;
      ctx.fillRect(0, 0, w, h);
      return;
    }

    const scale = viewScale * dpr;
    const viewW = w / viewScale;
    const viewH = h / viewScale;
    const camX = sc.focus.x - viewW / 2;
    const camY = sc.focus.y - viewH / 2;
    ctx.setTransform(scale, 0, 0, scale, -camX * scale, -camY * scale);
    ctx.fillStyle = FLOOR;
    ctx.fillRect(camX, camY, viewW, viewH);

    drawWalls(ctx, seed, camX, camY, viewW, viewH);

    const t = now / 1000;
    for (const c of sc.selfCoins) {
      if (c.x < camX - TILE || c.x > camX + viewW + TILE || c.y < camY - TILE || c.y > camY + viewH + TILE) continue;
      drawCoin(ctx, c.x, c.y, t);
    }
    for (const p of sc.policeArr) {
      drawPolice(ctx, p.x, p.y, t);
    }
    for (const p of sc.playersArr) {
      drawPlayer(ctx, p.x, p.y, { x: p.dir.x, y: p.dir.y }, { player: p.color, glow: p.glow }, t);
    }
  }

  function setInput(dir) {
    if (!DIRS[dir]) return;
    if (isHost) {
      if (state !== 'playing') return;
      const self = players.find((p) => p.id === selfId);
      if (self) self.nextDir = DIRS[dir];
    } else if (channel) {
      channel.send({ type: 'broadcast', event: 'input', payload: { type: 'input', id: selfId, dir } });
    }
  }

  function togglePause() {
    if (!isHost) return;
    if (state === 'over' || state === 'ready') return;
    if (state === 'paused') {
      state = 'playing';
      sounds.startSiren();
    } else if (state === 'playing') {
      state = 'paused';
      sounds.stopSiren();
    }
    emitHud(true);
  }

  function onKey(e) {
    const k = e.key;
    let dir = null;
    if (['ArrowUp', 'w', 'W', 'ц', 'Ц'].includes(k)) dir = 'up';
    else if (['ArrowDown', 's', 'S', 'ы', 'Ы'].includes(k)) dir = 'down';
    else if (['ArrowLeft', 'a', 'A', 'ф', 'Ф'].includes(k)) dir = 'left';
    else if (['ArrowRight', 'd', 'D', 'в', 'В'].includes(k)) dir = 'right';

    if (dir) {
      setInput(dir);
      e.preventDefault();
    } else if (k === 'Escape' || k === 'p' || k === 'P' || k === 'з' || k === 'З') {
      togglePause();
    }
  }

  function setupChannel() {
    channel = supabase.channel('room:' + roomCode, { config: { broadcast: { self: false } } });

    channel.on('broadcast', { event: 'input' }, ({ payload }) => {
      if (!isHost) return;
      if (payload.type === 'hello' && payload.id && payload.id !== selfId) {
        ensurePlayer(payload.id, payload.name, payload.color, payload.glow);
      } else if (payload.type === 'input' && payload.id) {
        const p = players.find((pl) => pl.id === payload.id);
        if (p && DIRS[payload.dir]) p.nextDir = DIRS[payload.dir];
      }
    });

    channel.on('broadcast', { event: 'state' }, ({ payload }) => {
      if (isHost) return;
      view = payload;
      if (payload.state === 'over' && !gameOverSent) {
        gameOverSent = true;
        state = 'over';
        onGameOver({
          score: payload.teamScore,
          coins: payload.teamCoins,
          survived: payload.survived,
          time: payload.survived,
          selfCoins: (payload.players.find((p) => p.id === selfId) || {}).coins || 0,
        });
      }
    });

    channel.on('presence', { event: 'sync' }, () => {
      if (!isHost) return;
      const s = channel.presenceState();
      for (const key of Object.keys(s)) {
        for (const pr of s[key]) {
          if (pr.id && pr.id !== selfId) ensurePlayer(pr.id, pr.name, pr.color, pr.glow);
        }
      }
    });

    channel.on('presence', { event: 'join' }, ({ newPresences }) => {
      if (!isHost) return;
      for (const pr of newPresences) {
        if (pr.id && pr.id !== selfId) ensurePlayer(pr.id, pr.name, pr.color, pr.glow);
      }
    });

    channel.on('presence', { event: 'leave' }, ({ leftPresences }) => {
      if (!isHost) return;
      for (const pr of leftPresences) {
        if (pr.id && pr.id !== selfId) removePlayer(pr.id);
      }
    });
  }

  async function start() {
    const { data: room, error } = await supabase.from('rooms').select('*').eq('code', roomCode).single();
    if (error || !room) {
      onStatus('error');
      return;
    }
    seed = room.seed;
    clearChunkCache();

    if (isHost) {
      ensurePlayer(selfId, selfName, skin.player, skin.glow);
    }

    setupChannel();

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        channel.track({ id: selfId, name: selfName, color: skin.player, glow: skin.glow });
        if (!isHost) {
          channel.send({
            type: 'broadcast',
            event: 'input',
            payload: { type: 'hello', id: selfId, name: selfName, color: skin.player, glow: skin.glow },
          });
        }
        onStatus('ready');
      }
    });

    window.addEventListener('keydown', onKey);
    last = performance.now();
    rafId = requestAnimationFrame(frame);
  }

  function frame(now) {
    if (destroyed) return;
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    update(dt);
    render(now);
    emitHud();

    if (isHost && now - lastBroadcast >= 1000 / BROADCAST_HZ) {
      lastBroadcast = now;
      if (channel) channel.send({ type: 'broadcast', event: 'state', payload: buildState() });
    }

    rafId = requestAnimationFrame(frame);
  }

  function destroy() {
    destroyed = true;
    if (rafId) cancelAnimationFrame(rafId);
    window.removeEventListener('keydown', onKey);
    sounds.pauseAll();
    sounds.stopMusic();
    clearChunkCache();
    if (channel) supabase.removeChannel(channel);
  }

  return {
    start,
    destroy,
    setInput,
    togglePause,
    getState: () => ({ score: teamScore, coins: teamCoins, time: Math.floor(survived), state }),
  };
}



