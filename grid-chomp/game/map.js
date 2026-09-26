// Бесконечный лабиринт в духе Pac-Man.
// Мир делится на чанки. Внутри чанка — лабиринт методом рекурсивного деления:
// регулярные узкие коридоры (как в классическом Pac-Man), затем braiding убирает
// тупики и добавляет петли для побега. Чанки соединяются «дверями» на границах.

export const TILE = 40; // px на тайл
export const CHUNK = 17; // тайлов на чанк: 8×8 узлов + стена-рамка по периметру
const NODES = (CHUNK - 1) / 2; // 8

export function hash2i(x, y, seed = 0) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 1442695041)) | 0;
  h = (h ^ (h >>> 13)) | 0;
  h = Math.imul(h, 1274126177);
  h = (h ^ (h >>> 16)) >>> 0;
  return h;
}

export function rand(x, y, seed = 0) {
  return hash2i(x, y, seed) / 4294967296;
}

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Позиция двери на границе чанка (нечётный локальный индекс 1..CHUNK-2).
function doorLocal(keyX, keyY, seed) {
  return 1 + 2 * Math.floor(rand(keyX, keyY, seed) * NODES);
}

function generateChunk(cx, cy, seed) {
  const cells = new Uint8Array(CHUNK * CHUNK); // 0 = стена, 1 = путь
  const rng = mulberry32(hash2i(cx, cy, seed));
  const set = (r, c, v) => {
    cells[r * CHUNK + c] = v;
  };

  // Инициализация: узлы (нечёт, нечёт) — путь; пилляры (чёт, чёт) — стена;
  // соединители (стенки между узлами) — пока путь.
  for (let r = 0; r < CHUNK; r++) {
    for (let c = 0; c < CHUNK; c++) {
      const ro = r & 1;
      const co = c & 1;
      if (ro && co) set(r, c, 1);
      else if (!ro && !co) set(r, c, 0);
      else set(r, c, 1);
    }
  }

  // Рекурсивное деление по сетке узлов (r0..r1, c0..c1 — индексы узлов 0..NODES-1).
  const divide = (r0, r1, c0, c1) => {
    const h = r1 - r0 + 1;
    const w = c1 - c0 + 1;
    if (h < 2 || w < 2) return;

    const horizontal = h > w ? true : w > h ? false : rng() < 0.5;

    if (horizontal) {
      const wj = r0 + Math.floor(rng() * (h - 1)); // стена между узловыми рядами wj и wj+1
      const wallRow = wj * 2 + 2;
      const gi = c0 + Math.floor(rng() * w); // зазор
      for (let ci = c0; ci <= c1; ci++) set(wallRow, ci * 2 + 1, 0);
      set(wallRow, gi * 2 + 1, 1);
      divide(r0, wj, c0, c1);
      divide(wj + 1, r1, c0, c1);
    } else {
      const wi = c0 + Math.floor(rng() * (w - 1)); // стена между узловыми колонками
      const wallCol = wi * 2 + 2;
      const gj = r0 + Math.floor(rng() * h); // зазор
      for (let rj = r0; rj <= r1; rj++) set(rj * 2 + 1, wallCol, 0);
      set(gj * 2 + 1, wallCol, 1);
      divide(r0, r1, c0, wi);
      divide(r0, r1, wi + 1, c1);
    }
  };
  divide(0, NODES - 1, 0, NODES - 1);

  // Braiding: у тупиков прорубаем дополнительный проход — петли для побега.
  for (let r = 1; r < CHUNK - 1; r += 2) {
    for (let c = 1; c < CHUNK - 1; c += 2) {
      const conns = [
        [r - 1, c],
        [r + 1, c],
        [r, c - 1],
        [r, c + 1],
      ];
      let open = 0;
      const closed = [];
      for (const [wr, wc] of conns) {
        if (wr < 1 || wr > CHUNK - 2 || wc < 1 || wc > CHUNK - 2) continue;
        if (cells[wr * CHUNK + wc] === 1) open++;
        else closed.push([wr, wc]);
      }
      if (open === 1 && closed.length && rng() < 0.8) {
        const [wr, wc] = closed[Math.floor(rng() * closed.length)];
        set(wr, wc, 1);
      }
    }
  }

  // Двери на границах (связывают чанк с четырьмя соседями).
  set(doorLocal(cx, cy, seed), 0, 1); // левая
  set(doorLocal(cx + 1, cy, seed), CHUNK - 1, 1); // правая
  set(0, doorLocal(cx, cy, seed), 1); // верхняя
  set(CHUNK - 1, doorLocal(cx, cy + 1, seed), 1); // нижняя

  return cells;
}

export function isWalkable(col, row, seed = 0) {
  return !isWall(col, row, seed);
}

export function isWall(col, row, seed = 0) {
  const cx = Math.floor(col / CHUNK);
  const cy = Math.floor(row / CHUNK);
  const lc = ((col % CHUNK) + CHUNK) % CHUNK;
  const lr = ((row % CHUNK) + CHUNK) % CHUNK;
  return getChunk(cx, cy, seed).cells[lr * CHUNK + lc] === 0;
}

export function tileCenter(n) {
  return n * TILE + TILE / 2;
}

// ---------- Кэш чанков ----------
const chunkCache = new Map();
const MAX_CACHE = 4000;

export function getChunk(cx, cy, seed = 0) {
  const key = `${cx},${cy}:${seed}`;
  let chunk = chunkCache.get(key);
  if (chunk) return chunk;

  chunk = { cells: generateChunk(cx, cy, seed) };

  if (chunkCache.size > MAX_CACHE) chunkCache.clear();
  chunkCache.set(key, chunk);
  return chunk;
}

export function clearChunkCache() {
  chunkCache.clear();
}

export function forEachVisibleChunk(viewCol0, viewRow0, viewCol1, viewRow1, fn) {
  const c0 = Math.floor(viewCol0 / CHUNK);
  const c1 = Math.floor(viewCol1 / CHUNK);
  const r0 = Math.floor(viewRow0 / CHUNK);
  const r1 = Math.floor(viewRow1 / CHUNK);
  for (let cy = r0; cy <= r1; cy++) {
    for (let cx = c0; cx <= c1; cx++) {
      fn(cx, cy);
    }
  }
}
