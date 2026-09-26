// A* по сетке тайлов в целочисленных мировых координатах (col, row).
// Карта бесконечна, поэтому поиск ограничивается лимитом итераций и радиусом.
// Используется бинарная min-heap (быстрее, чем sort на каждом шаге).

export function findPath({ isWalkable, from, to, maxIter = 4000, maxDist = 60 }) {
  const sx = from.col;
  const sy = from.row;
  const tx = to.col;
  const ty = to.row;

  if (sx === tx && sy === ty) return [];
  if (!isWalkable(tx, ty)) return null;

  const key = (c, r) => `${c},${r}`;
  const startKey = key(sx, sy);

  const gScore = new Map([[startKey, 0]]);
  const cameFrom = new Map();
  const closed = new Set();

  const h = (c, r) => Math.abs(c - tx) + Math.abs(r - ty);

  // Бинарная min-heap по f.
  const heap = [];
  const heapPush = (node) => {
    heap.push(node);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p].f <= node.f) break;
      heap[i] = heap[p];
      i = p;
    }
    heap[i] = node;
  };
  const heapPop = () => {
    const top = heap[0];
    const last = heap.pop();
    if (heap.length) {
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < heap.length && heap[l].f < heap[m].f) m = l;
        if (r < heap.length && heap[r].f < heap[m].f) m = r;
        if (m === i) break;
        heap[i] = heap[m];
        i = m;
      }
      heap[i] = last;
    }
    return top;
  };

  heapPush({ c: sx, r: sy, f: h(sx, sy) });
  let iter = 0;

  while (heap.length && iter++ < maxIter) {
    const cur = heapPop();
    const curKey = key(cur.c, cur.r);
    if (closed.has(curKey)) continue;
    closed.add(curKey);

    if (cur.c === tx && cur.r === ty) {
      const path = [];
      let k = curKey;
      while (k !== startKey) {
        const [c, r] = k.split(',').map(Number);
        path.push({ col: c, row: r });
        k = cameFrom.get(k);
      }
      path.reverse();
      return path;
    }

    const neighbors = [
      [cur.c + 1, cur.r],
      [cur.c - 1, cur.r],
      [cur.c, cur.r + 1],
      [cur.c, cur.r - 1],
    ];

    for (const [nc, nr] of neighbors) {
      const nKey = key(nc, nr);
      if (closed.has(nKey)) continue;
      if (Math.abs(nc - sx) > maxDist || Math.abs(nr - sy) > maxDist) continue;
      if (!isWalkable(nc, nr)) continue;

      const g = gScore.get(curKey) + 1;
      if (!gScore.has(nKey) || g < gScore.get(nKey)) {
        gScore.set(nKey, g);
        cameFrom.set(nKey, curKey);
        heapPush({ c: nc, r: nr, f: g + h(nc, nr) });
      }
    }
  }

  return null;
}
