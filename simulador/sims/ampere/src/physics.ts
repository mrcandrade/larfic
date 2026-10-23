/**
 * Circulação de B de fios retilíneos infinitos perpendiculares ao plano.
 * Posições em cm no palco; a física converte para metros.
 */
export const MU0 = 4 * Math.PI * 1e-7;

export interface Wire {
  x: number;
  y: number;
  /** Corrente em A; positiva sai da tela (+z). */
  I: number;
}

export type Pt = [number, number];

/** Campo (T) de fios infinitos no ponto (x, y) em cm. */
export function fieldAt(wires: Wire[], x: number, y: number): Pt {
  let bx = 0;
  let by = 0;
  for (const w of wires) {
    const dx = (x - w.x) / 100;
    const dy = (y - w.y) / 100;
    const r2 = dx * dx + dy * dy;
    if (r2 < 1e-14) continue;
    const k = (MU0 * w.I) / (2 * Math.PI * r2);
    bx += -k * dy;
    by += k * dx;
  }
  return [bx, by];
}

/**
 * Força por unidade de comprimento (N/m) sobre o fio k, exercida pelos demais:
 * dF/dl = I_k ẑ × B_outros (B dos outros fios no ponto do fio k).
 */
export function forcePerLength(wires: Wire[], k: number): Pt {
  const w = wires[k];
  if (!w) return [0, 0];
  const B = fieldAt(wires.filter((_, j) => j !== k), w.x, w.y);
  return [-w.I * B[1], w.I * B[0]];
}

// Gauss-Legendre de 4 pontos em [0, 1]
const GL_X = [0.0694318442029737, 0.3300094782075719, 0.6699905217924281, 0.9305681557970263];
const GL_W = [0.1739274225687269, 0.3260725774312731, 0.3260725774312731, 0.1739274225687269];

/** Perímetro (cm) do polígono fechado. */
export function perimeter(path: Pt[]): number {
  let L = 0;
  for (let i = 0; i < path.length; i++) {
    const a = path[i]!, b = path[(i + 1) % path.length]!;
    L += Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  return L;
}

/**
 * ∫ B·dl (T·m) ao longo do polígono fechado, do primeiro vértice até a fração
 * `frac` do perímetro. Quadratura de Gauss-Legendre em sub-trechos de no máximo
 * `h` cm, refinados perto dos fios.
 */
export function lineIntegral(path: Pt[], wires: Wire[], frac = 1, h = 0.1): number {
  const n = path.length;
  if (n < 2) return 0;
  const stop = frac * perimeter(path);
  let walked = 0;
  let sum = 0;
  for (let i = 0; i < n && walked < stop; i++) {
    const a = path[i]!, b = path[(i + 1) % n]!;
    const segLen = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (segLen < 1e-12) continue;
    const use = Math.min(segLen, stop - walked);
    const tEnd = use / segLen;
    // Passo menor quando algum fio está perto do trecho
    let dmin = Infinity;
    for (const w of wires) dmin = Math.min(dmin, distToSeg(w.x, w.y, a, b));
    const hh = Math.min(h, Math.max(0.002, dmin / 4));
    const m = Math.max(1, Math.ceil(use / hh));
    const dx = ((b[0] - a[0]) * tEnd) / m, dy = ((b[1] - a[1]) * tEnd) / m;
    for (let j = 0; j < m; j++) {
      for (let g = 0; g < 4; g++) {
        const s = (j + GL_X[g]!) / m;
        const B = fieldAt(wires, a[0] + (b[0] - a[0]) * tEnd * s, a[1] + (b[1] - a[1]) * tEnd * s);
        sum += GL_W[g]! * (B[0] * dx + B[1] * dy) / 100;
      }
    }
    walked += use;
  }
  return sum;
}

/** Número de voltas do caminho em torno do ponto (x, y): +1 anti-horário, −1 horário. */
export function winding(path: Pt[], x: number, y: number): number {
  let ang = 0;
  for (let i = 0; i < path.length; i++) {
    const a = path[i]!, b = path[(i + 1) % path.length]!;
    const a1 = Math.atan2(a[1] - y, a[0] - x);
    const a2 = Math.atan2(b[1] - y, b[0] - x);
    let da = a2 - a1;
    while (da > Math.PI) da -= 2 * Math.PI;
    while (da < -Math.PI) da += 2 * Math.PI;
    ang += da;
  }
  return Math.round(ang / (2 * Math.PI));
}

/** Corrente envolvida (A), contada com o número de voltas do caminho. */
export function enclosedCurrent(path: Pt[], wires: Wire[]): number {
  return wires.reduce((acc, w) => acc + w.I * winding(path, w.x, w.y), 0);
}

export function distToSeg(x: number, y: number, a: Pt, b: Pt): number {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const L2 = dx * dx + dy * dy;
  const t = L2 > 0 ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / L2)) : 0;
  return Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy);
}

export function distToPath(path: Pt[], x: number, y: number): number {
  let d = Infinity;
  for (let i = 0; i < path.length; i++) d = Math.min(d, distToSeg(x, y, path[i]!, path[(i + 1) % path.length]!));
  return d;
}

/** Ponto e tangente unitária na fração `frac` do perímetro. */
export function pointAt(path: Pt[], frac: number): { p: Pt; t: Pt } {
  const stop = (((frac % 1) + 1) % 1) * perimeter(path);
  let walked = 0;
  for (let i = 0; i < path.length; i++) {
    const a = path[i]!, b = path[(i + 1) % path.length]!;
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (L < 1e-12) continue;
    if (walked + L >= stop) {
      const s = (stop - walked) / L;
      return { p: [a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s], t: [(b[0] - a[0]) / L, (b[1] - a[1]) / L] };
    }
    walked += L;
  }
  const a = path[0] ?? [0, 0];
  return { p: [a[0], a[1]], t: [1, 0] };
}

export function circlePath(cx: number, cy: number, R: number, n = 120): Pt[] {
  return Array.from({ length: n }, (_, i) => {
    const a = (2 * Math.PI * i) / n;
    return [cx + R * Math.cos(a), cy + R * Math.sin(a)] as Pt;
  });
}

export function squarePath(cx: number, cy: number, R: number): Pt[] {
  return [
    [cx - R, cy - R],
    [cx + R, cy - R],
    [cx + R, cy + R],
    [cx - R, cy + R],
  ];
}

/** Contorno irregular de exemplo para o modo desenho. */
export function blobPath(cx: number, cy: number, R: number, n = 90): Pt[] {
  return Array.from({ length: n }, (_, i) => {
    const a = (2 * Math.PI * i) / n;
    const r = R * (1 + 0.28 * Math.sin(3 * a) + 0.12 * Math.cos(5 * a));
    return [cx + r * Math.cos(a), cy + 0.8 * r * Math.sin(a)] as Pt;
  });
}
