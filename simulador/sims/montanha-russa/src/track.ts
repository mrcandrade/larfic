/**
 * Pista paramétrica: spline de Catmull-Rom (com correção de arco) pelos pontos de controle,
 * reparametrizada pelo comprimento de arco s. Guarda uma tabela densa de nós
 * (s, x, y, cos φ, sen φ, κ) e interpola x(s) e y(s) por Hermite cúbico usando
 * as derivadas exatas dx/ds = cos φ e dy/ds = sen φ. Assim a força tangencial
 * −mg·dy/ds é exatamente o gradiente da energia potencial mg·y(s) interpolada,
 * e a energia mecânica se conserva até a precisão do integrador.
 */

export type Pt = [number, number];

export interface Track {
  /** Comprimento total, m. */
  L: number;
  s: Float64Array;
  x: Float64Array;
  y: Float64Array;
  cos: Float64Array;
  sin: Float64Array;
  /** Curvatura com sinal: positiva quando a pista curva para a esquerda do sentido de s. */
  k: Float64Array;
}

export interface TrackPoint {
  x: number;
  y: number;
  /** dx/ds e dy/ds (cos φ e sen φ do ângulo de inclinação). */
  cos: number;
  sin: number;
  k: number;
}

const SUB = 64; // amostras por segmento
const K_MAX = 40; // limita a curvatura em quinas degeneradas, 1/m

const cache = new WeakMap<Pt[], Track>();

/** Pista (com cache por referência do vetor de pontos, que é imutável no estado). */
export function trackOf(pts: Pt[]): Track {
  let tr = cache.get(pts);
  if (!tr) {
    tr = buildTrack(pts);
    cache.set(pts, tr);
  }
  return tr;
}

function tangents(pts: Pt[]): Pt[] {
  const n = pts.length;
  return pts.map((_, i) => {
    const a = pts[Math.max(0, i - 1)]!;
    const b = pts[Math.min(n - 1, i + 1)]!;
    if (i === 0 || i === n - 1) return [b[0] - a[0], b[1] - a[1]];
    // Catmull-Rom com correção de arco: se os três pontos estão num círculo, o
    // segmento de Hermite aproxima esse círculo (f → 1 quando a pista é reta).
    const c = pts[i]!;
    const th = Math.abs(Math.atan2(
      (c[0] - a[0]) * (b[1] - c[1]) - (c[1] - a[1]) * (b[0] - c[0]),
      (c[0] - a[0]) * (b[0] - c[0]) + (c[1] - a[1]) * (b[1] - c[1]),
    ));
    const f = th < 1e-6 ? 1 : Math.min(1.7, (4 * Math.tan(th / 4)) / Math.sin(Math.min(th, 2)));
    return [((b[0] - a[0]) / 2) * f, ((b[1] - a[1]) / 2) * f];
  });
}

/** Posição, primeira e segunda derivadas do segmento de Hermite em u ∈ [0, 1]. */
function hermite(p0: Pt, m0: Pt, p1: Pt, m1: Pt, u: number) {
  const u2 = u * u, u3 = u2 * u;
  const h00 = 2 * u3 - 3 * u2 + 1, h10 = u3 - 2 * u2 + u, h01 = -2 * u3 + 3 * u2, h11 = u3 - u2;
  const d00 = 6 * u2 - 6 * u, d10 = 3 * u2 - 4 * u + 1, d01 = -6 * u2 + 6 * u, d11 = 3 * u2 - 2 * u;
  const e00 = 12 * u - 6, e10 = 6 * u - 4, e01 = -12 * u + 6, e11 = 6 * u - 2;
  const comb = (a: number, b: number, c: number, d: number, k: 0 | 1) =>
    a * p0[k] + b * m0[k] + c * p1[k] + d * m1[k];
  return {
    x: comb(h00, h10, h01, h11, 0),
    y: comb(h00, h10, h01, h11, 1),
    dx: comb(d00, d10, d01, d11, 0),
    dy: comb(d00, d10, d01, d11, 1),
    ddx: comb(e00, e10, e01, e11, 0),
    ddy: comb(e00, e10, e01, e11, 1),
  };
}

export function buildTrack(pts: Pt[]): Track {
  const n = pts.length;
  const m = tangents(pts);
  const N = (n - 1) * SUB + 1;
  const s = new Float64Array(N), x = new Float64Array(N), y = new Float64Array(N);
  const cos = new Float64Array(N), sin = new Float64Array(N), k = new Float64Array(N);
  let idx = 0;
  let acc = 0;
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[i]!, p1 = pts[i + 1]!, m0 = m[i]!, m1 = m[i + 1]!;
    for (let j = i === 0 ? 0 : 1; j <= SUB; j++) {
      const u = j / SUB;
      if (j > 0) {
        // Simpson no subintervalo para o comprimento de arco.
        const ua = (j - 1) / SUB, um = (j - 0.5) / SUB;
        const sp = (q: number) => {
          const h = hermite(p0, m0, p1, m1, q);
          return Math.hypot(h.dx, h.dy);
        };
        acc += ((sp(ua) + 4 * sp(um) + sp(u)) / 6) * (1 / SUB);
      }
      const h = hermite(p0, m0, p1, m1, u);
      const sp = Math.hypot(h.dx, h.dy);
      s[idx] = acc;
      x[idx] = h.x;
      y[idx] = h.y;
      if (sp > 1e-9) {
        cos[idx] = h.dx / sp;
        sin[idx] = h.dy / sp;
        k[idx] = Math.max(-K_MAX, Math.min(K_MAX, (h.dx * h.ddy - h.dy * h.ddx) / sp ** 3));
      } else {
        // Derivada nula (pontos coincidentes): usa a direção da corda.
        const c = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) || 1;
        cos[idx] = (p1[0] - p0[0]) / c;
        sin[idx] = (p1[1] - p0[1]) / c;
        k[idx] = 0;
      }
      idx++;
    }
  }
  return { L: acc, s, x, y, cos, sin, k };
}

/** Índice i com s[i] ≤ s < s[i+1] (busca binária). */
export function nodeIndex(tr: Track, s: number): number {
  let lo = 0, hi = tr.s.length - 1;
  if (s <= 0) return 0;
  if (s >= tr.L) return hi - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (tr.s[mid]! <= s) lo = mid;
    else hi = mid;
  }
  return lo;
}

/** Ponto da pista na coordenada de arco s (fora de [0, L] é preso às pontas). */
export function at(tr: Track, sRaw: number): TrackPoint {
  const s = Math.max(0, Math.min(tr.L, sRaw));
  const i = nodeIndex(tr, s);
  const h = tr.s[i + 1]! - tr.s[i]!;
  if (!(h > 0)) return { x: tr.x[i]!, y: tr.y[i]!, cos: tr.cos[i]!, sin: tr.sin[i]!, k: tr.k[i]! };
  const u = (s - tr.s[i]!) / h;
  const u2 = u * u, u3 = u2 * u;
  const h00 = 2 * u3 - 3 * u2 + 1, h10 = u3 - 2 * u2 + u, h01 = -2 * u3 + 3 * u2, h11 = u3 - u2;
  const d00 = (6 * u2 - 6 * u) / h, d10 = 3 * u2 - 4 * u + 1, d01 = (-6 * u2 + 6 * u) / h, d11 = 3 * u2 - 2 * u;
  const c0 = tr.cos[i]!, c1 = tr.cos[i + 1]!, s0 = tr.sin[i]!, s1 = tr.sin[i + 1]!;
  const x = h00 * tr.x[i]! + h10 * h * c0 + h01 * tr.x[i + 1]! + h11 * h * c1;
  const y = h00 * tr.y[i]! + h10 * h * s0 + h01 * tr.y[i + 1]! + h11 * h * s1;
  const dx = d00 * tr.x[i]! + d10 * c0 + d01 * tr.x[i + 1]! + d11 * c1;
  const dy = d00 * tr.y[i]! + d10 * s0 + d01 * tr.y[i + 1]! + d11 * s1;
  const k = tr.k[i]! + u * (tr.k[i + 1]! - tr.k[i]!);
  return { x, y, cos: dx, sin: dy, k };
}

/** Coordenada de arco do ponto da pista mais próximo de (px, py) e a distância até ele. */
export function closest(tr: Track, px: number, py: number): { s: number; d: number } {
  let best = 0, bd = Infinity;
  for (let i = 0; i < tr.s.length; i++) {
    const d = Math.hypot(tr.x[i]! - px, tr.y[i]! - py);
    if (d < bd) {
      bd = d;
      best = i;
    }
  }
  return { s: tr.s[best]!, d: bd };
}

/** Primeiro s (a partir do início da pista) em que a altura fica ≤ h. */
export function firstAtHeight(tr: Track, h: number): number {
  if (tr.y[0]! <= h) return 0;
  for (let i = 1; i < tr.s.length; i++) {
    if (tr.y[i]! <= h) {
      const y0 = tr.y[i - 1]!, y1 = tr.y[i]!;
      const f = (y0 - h) / (y0 - y1);
      return tr.s[i - 1]! + f * (tr.s[i]! - tr.s[i - 1]!);
    }
  }
  return 0;
}

/**
 * Pontos de retorno: os s mais próximos de s0, um de cada lado, onde a altura
 * atinge hE = E/(mg). `null` quando a pista não chega a essa altura daquele
 * lado (o carrinho alcança o para-choque).
 */
export function turningPoints(tr: Track, s0: number, hE: number): [number | null, number | null] {
  const i0 = nodeIndex(tr, s0);
  let left: number | null = null, right: number | null = null;
  for (let i = i0; i >= 0; i--) {
    if (tr.y[i]! >= hE) {
      const j = i + 1;
      const y0 = tr.y[i]!, y1 = tr.y[j]!;
      left = y0 === y1 ? tr.s[i]! : tr.s[i]! + ((y0 - hE) / (y0 - y1)) * (tr.s[j]! - tr.s[i]!);
      left = Math.min(left, s0);
      break;
    }
  }
  for (let i = i0 + 1; i < tr.s.length; i++) {
    if (tr.y[i]! >= hE) {
      const j = i - 1;
      const y0 = tr.y[j]!, y1 = tr.y[i]!;
      right = y0 === y1 ? tr.s[i]! : tr.s[j]! + ((hE - y0) / (y1 - y0)) * (tr.s[i]! - tr.s[j]!);
      right = Math.max(right, s0);
      break;
    }
  }
  return [left, right];
}

/** Pistas prontas. */
export const PRESETS: Pt[][] = [
  // 0: meia-pipe
  [[-9.5, 8], [-8.6, 5], [-7, 2.2], [-4.5, 0.5], [0, 0.2], [4.5, 0.5], [7, 2.2], [8.6, 5], [9.5, 8]],
  // 1: montanha-russa com loop baixo (raio ≈ 1,6 m)
  [
    [-9.6, 8], [-8.3, 6], [-6, 1.8], [-3.2, 0.4], [-0.35, 0.4],
    [1.13, 0.87], [1.6, 2], [1.13, 3.13], [0, 3.6], [-1.13, 3.13], [-1.6, 2], [-1.13, 0.87],
    [0.35, 0.4], [3.2, 0.7], [5.5, 3.6], [7.5, 2.2], [9.6, 6.5],
  ],
  // 2: rampa dupla (dois vales separados por uma lombada)
  [[-9.5, 8], [-8, 4], [-6, 1.2], [-4, 0.4], [-2, 1.6], [0, 3.8], [2, 1.6], [4, 0.4], [6, 1.2], [8, 4], [9.5, 8]],
];
