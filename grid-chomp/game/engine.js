// Одиночный движок Grid Chomp.
// Бесконечный лабиринт (чанки), камера на игроке, строгое движение по сетке,
// полиция с A*-преследованием и динамическим спавном за экраном, бусты на карте.

import { TILE, CHUNK, isWalkable, tileCenter, forEachVisibleChunk, getChunk, rand } from './map';
import { findPath } from './astar';
import { getSkin } from '../lib/catalog';
import { SoundManager } from './sounds';

const PLAYER_SPEED = TILE * 8.5;
const POLICE_BASE_SPEED = TILE * 6.8; // заметно медленнее игрока
const COIN_RATE = 0.14; // доля проходимых тайлов с монетой (по всей карте)
const REPATH_INTERVAL = 0.3;
const CAPTURE_DIST = TILE * 0.62;
const INVULN_TIME = 1.6;

const FLOOR = '#0a0a10';
const WALL = '#17171f';
const POLICE_COLOR = '#f43f5e';
const POLICE_SCARED_COLOR = '#3b82f6';

// Внутриигровые бусты (подбираются прямо на карте).
const POWERUP_TYPES = {
  magnet: { color: '#f59e0b', glyph: 'M', duration: 8 },
  ghost: { color: '#22d3ee', glyph: 'G', duration: 6 },
  power: { color: '#f43f5e', glyph: 'P', duration: 7 },
  speed: { color: '#10b981', glyph: 'S', duration: 6 },
  shield: { color: '#3b82f6', glyph: 'D', duration: 10 },
};
const POWERUP_RATE = 0.015; // доля проходимых тайлов с бустом (по всей карте)

export const DIRS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  none: { x: 0, y: 0 },
};

const colOf = (x) => Math.floor(x / TILE);
const rowOf = (y) => Math.floor(y / TILE);

function isAligned(e) {
  if (e.dir.x !== 0) return Math.abs(e.y - tileCenter(rowOf(e.y))) < 1.5;
  if (e.dir.y !== 0) return Math.abs(e.x - tileCenter(colOf(e.x))) < 1.5;
  return true;
}

function snapToLane(e, dir) {
  if (dir.x !== 0) e.y = tileCenter(rowOf(e.y));
  else if (dir.y !== 0) e.x = tileCenter(colOf(e.x));
}

function canTurn(seed, e, d) {
  const cx = e.x + d.x * TILE * 0.6;
  const cy = e.y + d.y * TILE * 0.6;
  return isWalkable(colOf(cx), rowOf(cy), seed);
}

function canMoveTo(seed, e, nx, ny) {
  const r = e.radius;
  if (e.dir.x > 0) return isWalkable(colOf(nx + r), rowOf(ny), seed);
  if (e.dir.x < 0) return isWalkable(colOf(nx - r), rowOf(ny), seed);
  if (e.dir.y > 0) return isWalkable(colOf(nx), rowOf(ny + r), seed);
  if (e.dir.y < 0) return isWalkable(colOf(nx), rowOf(ny - r), seed);
  return true;
}

function stepEntity(seed, e, dt) {
  if (e.nextDir) {
    const d = DIRS[e.nextDir];
    if (isAligned(e) && canTurn(seed, e, d)) {
      snapToLane(e, d);
      e.dir = d;
      e.nextDir = null;
    }
  }

  if (e.dir.x === 0 && e.dir.y === 0) {
    if (!e.nextDir) return;
    const d = DIRS[e.nextDir];
    if (canTurn(seed, e, d)) {
      snapToLane(e, d);
      e.dir = d;
      e.nextDir = null;
    } else {
      return;
    }
  }

  const nx = e.x + e.dir.x * e.speed * dt;
  const ny = e.y + e.dir.y * e.speed * dt;
  if (!canMoveTo(seed, e, nx, ny)) {
    snapToLane(e, e.dir);
    e.dir = DIRS.none;
    return;
  }
  e.x = nx;
  e.y = ny;
}

// ---------- Отрисовка (в мировых координатах, камера задаётся трансформацией) ----------
function roundRectPath(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function drawWalls(ctx, seed, camX, camY, w, h) {
  const col0 = Math.floor(camX / TILE);
  const col1 = Math.ceil((camX + w) / TILE);
  const row0 = Math.floor(camY / TILE);
  const row1 = Math.ceil((camY + h) / TILE);

  ctx.fillStyle = WALL;
  forEachVisibleChunk(col0, row0, col1, row1, (cx, cy) => {
    const chunk = getChunk(cx, cy, seed);
    const baseC = cx * CHUNK;
    const baseR = cy * CHUNK;
    for (let r = 0; r < CHUNK; r++) {
      const wr = baseR + r;
      if (wr < row0 || wr > row1) continue;
      for (let c = 0; c < CHUNK; c++) {
        if (chunk.cells[r * CHUNK + c] !== 1) continue;
        const wc = baseC + c;
        if (wc < col0 || wc > col1) continue;
        roundRectPath(ctx, wc * TILE + 1, wr * TILE + 1, TILE - 2, TILE - 2, 7);
        ctx.fill();
      }
    }
  });
}

function drawCoin(ctx, sx, sy, t) {
  const s = TILE * 0.16;
  const pulse = 1 + Math.sin(t * 4 + sx * 0.02) * 0.15;
  const rs = s * pulse;
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = '#f5c518';
  roundRectPath(ctx, -rs, -rs, rs * 2, rs * 2, rs * 0.4);
  ctx.fill();
  ctx.restore();
}

function drawPolice(ctx, sx, sy, t, scared) {
  const s = TILE * 0.34;
  const color = scared ? POLICE_SCARED_COLOR : POLICE_COLOR;
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = color;
  roundRectPath(ctx, -s, -s, s * 2, s * 2, s * 0.35);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath();
  ctx.arc(sx, sy, s * 0.18, 0, Math.PI * 2);
  ctx.fill();
}

function drawPlayer(ctx, sx, sy, dir, skin, t) {
  const s = TILE * 0.34;
  // Мягкое свечение (дешёвое, без shadowBlur).
  ctx.fillStyle = skin.glow + '30';
  roundRectPath(ctx, sx - s * 1.4, sy - s * 1.4, s * 2.8, s * 2.8, s * 0.55);
  ctx.fill();
  // Тело.
  ctx.fillStyle = skin.player;
  roundRectPath(ctx, sx - s, sy - s, s * 2, s * 2, s * 0.45);
  ctx.fill();
  // Индикатор направления.
  const ox = dir.x * s * 0.32;
  const oy = dir.y * s * 0.32;
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath();
  ctx.arc(sx + ox, sy + oy, s * 0.18, 0, Math.PI * 2);
  ctx.fill();
}

function drawPowerup(ctx, sx, sy, type, t) {
  const def = POWERUP_TYPES[type];
  const s = TILE * 0.24;
  const pulse = 1 + Math.sin(t * 5 + sx * 0.01) * 0.12;
  const rs = s * pulse;
  ctx.fillStyle = def.color + '22';
  roundRectPath(ctx, sx - rs * 1.5, sy - rs * 1.5, rs * 3, rs * 3, rs * 0.6);
  ctx.fill();
  ctx.fillStyle = def.color;
  roundRectPath(ctx, sx - rs, sy - rs, rs * 2, rs * 2, rs * 0.5);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${Math.floor(rs * 1.1)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(def.glyph, sx, sy + 0.5);
}

export function createGame(canvas, options = {}) {
  const {
    seed = Date.now(),
    skinId = 'indigo',
    soundPackId = 'classic',
    musicThemeId = 'ambient',
    boost = null,
    muted = false,
    musicMuted = false,
    onHud = () => {},
    onGameOver = () => {},
    onStateChange = () => {},
  } = options;

  const skin = getSkin(skinId);
  const sounds = new SoundManager({ soundPackId, musicThemeId });
  sounds.setMuted(muted);
  sounds.setMusicMuted(musicMuted);

  let dpr = 1;
  let w = 0;
  let h = 0;
  let viewScale = 1;
  let destroyed = false;
  let rafId = 0;
  let last = 0;
  let state = 'ready';
  let elapsed = 0;
  let survived = 0;
  let coinsCollected = 0;
  let score = 0;
  let invuln = 0;
  let lastHudAt = 0;

  const player = {
    x: tileCenter(1),
    y: tileCenter(1),
    sx: tileCenter(1),
    sy: tileCenter(1),
    dir: DIRS.none,
    nextDir: null,
    radius: TILE * 0.36,
    speed: PLAYER_SPEED * (boost?.effect?.speed || 1),
    shield: boost?.effect?.shield || 0,
  };

  const magnetBoost = boost?.effect?.magnet || 1;
  const policeSlowBoost = boost?.effect?.policeSlow || 1;

  const fx = { magnet: 0, ghost: 0, power: 0, speed: 0 };

  const police = [];
  const collectedCoins = new Set();
  const collectedPowerups = new Set();

  function makePolice(c, r) {
    return {
      x: tileCenter(c),
      y: tileCenter(r),
      sx: tileCenter(c),
      sy: tileCenter(r),
      dir: DIRS.none,
      nextDir: null,
      radius: TILE * 0.34,
      speed: POLICE_BASE_SPEED,
      path: [],
      repathTimer: Math.random() * REPATH_INTERVAL,
    };
  }

  function randomNearbyWalkable(minDist, maxDist) {
    const pc = colOf(player.x);
    const pr = rowOf(player.y);
    for (let i = 0; i < 200; i++) {
      const ang = Math.random() * Math.PI * 2;
      const dist = minDist + Math.random() * Math.max(0, maxDist - minDist);
      const c = Math.round(pc + Math.cos(ang) * dist);
      const r = Math.round(pr + Math.sin(ang) * dist);
      if (isWalkable(c, r, seed)) return { c, r };
    }
    return { c: pc, r: pr };
  }

  // Детерминированное размещение монет и бустов по всей карте (хэш от координат тайла).
  function isCoinAt(c, r) {
    return rand(c, r, seed ^ 0x9e37) < COIN_RATE;
  }

  function isPowerupAt(c, r) {
    return rand(c, r, seed ^ 0xbeef) < POWERUP_RATE;
  }

  function powerupTypeAt(c, r) {
    const types = Object.keys(POWERUP_TYPES);
    return types[Math.floor(rand(c, r, seed ^ 0x1234) * types.length)];
  }

  function targetPoliceCount() {
    return 2 + Math.floor(elapsed / 8); // без лимита: спавним, пока не поймают
  }

  function spawnPolice() {
    const viewW = w / viewScale;
    const viewH = h / viewScale;
    const halfCols = Math.ceil(viewW / TILE / 2);
    const halfRows = Math.ceil(viewH / TILE / 2);
    const minDist = Math.ceil(Math.hypot(halfCols, halfRows)) + 2;
    const pos = randomNearbyWalkable(minDist, minDist + 5);
    police.push(makePolice(pos.c, pos.r));
  }

  function collectNearby(magnet) {
    const pc = colOf(player.x);
    const pr = rowOf(player.y);
    const reach = TILE * 0.55 * magnet;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const c = pc + dc;
        const r = pr + dr;
        if (!isWalkable(c, r, seed)) continue;
        const key = `${c},${r}`;
        const cx = tileCenter(c);
        const cy = tileCenter(r);
        const dx = cx - player.x;
        const dy = cy - player.y;
        if (dx * dx + dy * dy > reach * reach) continue;

        if (!collectedCoins.has(key) && isCoinAt(c, r)) {
          collectedCoins.add(key);
          coinsCollected += 1;
          sounds.coin();
        } else if (!collectedPowerups.has(key) && isPowerupAt(c, r)) {
          collectedPowerups.add(key);
          applyPowerup(powerupTypeAt(c, r));
        }
      }
    }
  }

  function steerPolice(p, dt) {
    if (fx.ghost > 0) {
      // Невидимость: полиция блуждает, не преследуя.
      if (isAligned(p)) {
        const opts = [];
        for (const d of ['up', 'down', 'left', 'right']) if (canTurn(seed, p, DIRS[d])) opts.push(d);
        if (opts.length) p.nextDir = opts[Math.floor(Math.random() * opts.length)];
      }
      stepEntity(seed, p, dt);
      return;
    }

    p.repathTimer -= dt;
    if (p.repathTimer <= 0) {
      p.repathTimer = REPATH_INTERVAL;
      p.path =
        findPath({
          isWalkable: (c, r) => isWalkable(c, r, seed),
          from: { col: colOf(p.x), row: rowOf(p.y) },
          to: { col: colOf(player.x), row: rowOf(player.y) },
        }) || [];
    }

    if (p.path.length) {
      const next = p.path[0];
      if (isAligned(p)) {
        const dc = next.col - colOf(p.x);
        const dr = next.row - rowOf(p.y);
        if (dc === 1) p.nextDir = 'right';
        else if (dc === -1) p.nextDir = 'left';
        else if (dr === 1) p.nextDir = 'down';
        else if (dr === -1) p.nextDir = 'up';
        else p.path.shift();
      }
    } else if (isAligned(p)) {
      const dc = colOf(player.x) - colOf(p.x);
      const dr = rowOf(player.y) - rowOf(p.y);
      if (Math.abs(dc) > Math.abs(dr)) p.nextDir = dc > 0 ? 'right' : 'left';
      else p.nextDir = dr > 0 ? 'down' : 'up';
    }

    stepEntity(seed, p, dt);

    if (p.path.length) {
      const next = p.path[0];
      if (colOf(p.x) === next.col && rowOf(p.y) === next.row) p.path.shift();
    }
  }

  function applyPowerup(type) {
    if (type === 'shield') player.shield += 1;
    else fx[type] = POWERUP_TYPES[type].duration;
    sounds.power();
  }

  function killPolice(p) {
    const i = police.indexOf(p);
    if (i !== -1) police.splice(i, 1);
    coinsCollected += 5;
    sounds.power();
    spawnPolice();
  }

  function checkCapture() {
    if (invuln > 0) return;
    for (const p of police) {
      const dx = p.x - player.x;
      const dy = p.y - player.y;
      if (dx * dx + dy * dy < CAPTURE_DIST * CAPTURE_DIST) {
        if (fx.ghost > 0) continue;
        if (fx.power > 0) {
          killPolice(p);
          continue;
        }
        if (player.shield > 0) {
          player.shield -= 1;
          invuln = INVULN_TIME;
          sounds.shieldHit();
          p.x += (p.x - player.x) * 1.4;
          p.y += (p.y - player.y) * 1.4;
          p.path = [];
        } else {
          gameOver();
          return;
        }
      }
    }
  }

  function gameOver() {
    state = 'over';
    sounds.death();
    sounds.pauseAll();
    sounds.setThreat(0);
    emitHud(true);
    onStateChange(state);
    onGameOver({
      score,
      coins: coinsCollected,
      survived: Math.floor(survived),
      time: Math.floor(survived),
    });
  }

  function nearestPoliceThreat() {
    let min = Infinity;
    for (const p of police) {
      const d = Math.hypot(p.x - player.x, p.y - player.y);
      if (d < min) min = d;
    }
    if (min === Infinity) return 0;
    return Math.max(0, 1 - min / (TILE * 6));
  }

  function emitHud(force = false) {
    const now = performance.now();
    if (!force && now - lastHudAt < 120) return;
    lastHudAt = now;
    onHud({
      score,
      coins: coinsCollected,
      time: Math.floor(survived),
      police: police.length,
      state,
      shield: player.shield,
      effects: Object.keys(fx)
        .filter((k) => fx[k] > 0)
        .map((k) => ({ type: k, time: Math.ceil(fx[k]) })),
    });
  }

  function update(dt) {
    if (state !== 'playing') return;
    elapsed += dt;
    survived += dt;
    score = Math.floor(survived * 20) + coinsCollected * 25;

    invuln = Math.max(0, invuln - dt);
    for (const k in fx) fx[k] = Math.max(0, fx[k] - dt);

    const effMagnet = magnetBoost * (fx.magnet > 0 ? 3 : 1);
    player.speed = PLAYER_SPEED * (boost?.effect?.speed || 1) * (fx.speed > 0 ? 1.35 : 1);

    while (police.length < targetPoliceCount()) spawnPolice();

    const policeSpeed = POLICE_BASE_SPEED * policeSlowBoost;
    for (const p of police) p.speed = policeSpeed;

    stepEntity(seed, player, dt);
    for (const p of police) steerPolice(p, dt);

    // Сглаживание отображения (плавные повороты и движение без рывков).
    const k = Math.min(1, dt * 28);
    player.sx += (player.x - player.sx) * k;
    player.sy += (player.y - player.sy) * k;
    for (const p of police) {
      p.sx += (p.x - p.sx) * k;
      p.sy += (p.y - p.sy) * k;
    }

    collectNearby(effMagnet);

    checkCapture();
    sounds.setThreat(nearestPoliceThreat());
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
    const scale = viewScale * dpr;
    const viewW = w / viewScale;
    const viewH = h / viewScale;
    const camX = player.sx - viewW / 2;
    const camY = player.sy - viewH / 2;
    ctx.setTransform(scale, 0, 0, scale, -camX * scale, -camY * scale);

    ctx.fillStyle = FLOOR;
    ctx.fillRect(camX, camY, viewW, viewH);

    drawWalls(ctx, seed, camX, camY, viewW, viewH);

    const t = now / 1000;
    // Монеты и бусты — детерминированно по всей видимой области.
    const col0 = Math.floor(camX / TILE);
    const col1 = Math.ceil((camX + viewW) / TILE);
    const row0 = Math.floor(camY / TILE);
    const row1 = Math.ceil((camY + viewH) / TILE);
    for (let r = row0; r <= row1; r++) {
      for (let c = col0; c <= col1; c++) {
        if (!isWalkable(c, r, seed)) continue;
        const key = `${c},${r}`;
        if (!collectedCoins.has(key) && isCoinAt(c, r)) {
          drawCoin(ctx, tileCenter(c), tileCenter(r), t);
        } else if (!collectedPowerups.has(key) && isPowerupAt(c, r)) {
          drawPowerup(ctx, tileCenter(c), tileCenter(r), powerupTypeAt(c, r), t);
        }
      }
    }
    for (const p of police) {
      drawPolice(ctx, p.sx, p.sy, t, fx.power > 0);
    }
    drawPlayer(ctx, player.sx, player.sy, player.dir, skin, t);
  }

  function input(dir) {
    if (state === 'over' || !DIRS[dir]) return;
    if (state === 'ready') startPlay();
    if (state === 'playing') player.nextDir = dir;
  }

  function startPlay() {
    if (state !== 'ready') return;
    state = 'playing';
    sounds.startMusic();
    sounds.startSiren();
    onStateChange(state);
    emitHud(true);
  }

  function togglePause() {
    if (state === 'over' || state === 'ready') return;
    if (state === 'paused') {
      state = 'playing';
      sounds.startSiren();
    } else if (state === 'playing') {
      state = 'paused';
      sounds.stopSiren();
    }
    onStateChange(state);
    emitHud(true);
  }

  function onKey(e) {
    const k = e.key;
    if (['ArrowUp', 'w', 'W', 'ц', 'Ц'].includes(k)) input('up');
    else if (['ArrowDown', 's', 'S', 'ы', 'Ы'].includes(k)) input('down');
    else if (['ArrowLeft', 'a', 'A', 'ф', 'Ф'].includes(k)) input('left');
    else if (['ArrowRight', 'd', 'D', 'в', 'В'].includes(k)) input('right');
    else if (k === 'Escape' || k === 'p' || k === 'P' || k === 'з' || k === 'З') togglePause();
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(k)) e.preventDefault();
  }

  function frame(now) {
    if (destroyed) return;
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    update(dt);
    render(now);
    emitHud();
    rafId = requestAnimationFrame(frame);
  }

  function start() {
    if (rafId) return;
    last = performance.now();
    window.addEventListener('keydown', onKey);
    rafId = requestAnimationFrame(frame);
    emitHud(true);
    onStateChange(state);
  }

  function destroy() {
    destroyed = true;
    if (rafId) cancelAnimationFrame(rafId);
    window.removeEventListener('keydown', onKey);
    sounds.pauseAll();
    sounds.stopMusic();
  }

  return {
    start,
    destroy,
    setInput: input,
    startPlay,
    togglePause,
    pause: () => {
      if (state === 'playing') togglePause();
    },
    resume: () => {
      if (state === 'paused') togglePause();
    },
    getState: () => ({ score, coins: coinsCollected, time: Math.floor(survived), state, shield: player.shield }),
  };
}

export {
  colOf,
  rowOf,
  isAligned,
  snapToLane,
  canTurn,
  stepEntity,
  drawWalls,
  drawCoin,
  drawPolice,
  drawPlayer,
};



