/**
 * Equação de Schrödinger independente do tempo em 1D, em unidades
 * adimensionais ħ = m = 1: −½ψ'' + V(x)ψ = Eψ, com ψ = 0 nas bordas da caixa
 * [−X, X]. Diferenças finitas de 2ª ordem dão uma matriz tridiagonal
 * simétrica; os autovalores saem por bisseção com a sequência de Sturm e os
 * autovetores por iteração inversa (algoritmo de Thomas).
 */

export const X_MAX = 8;
export const N_GRID = 1599;
/** Potencial usado como "parede infinita". */
export const WALL = 1e12;

export interface Solution {
  x: Float64Array;
  V: Float64Array;
  h: number;
  E: number[];
  /** Autofunções normalizadas (∫|ψ|² dx = 1), uma por nível. */
  psi: Float64Array[];
}

export function grid(n = N_GRID, X = X_MAX): { x: Float64Array; h: number } {
  const h = (2 * X) / (n + 1);
  const x = new Float64Array(n);
  for (let i = 0; i < n; i++) x[i] = -X + (i + 1) * h;
  return { x, h };
}

/** Número de autovalores menores que λ (sequência de Sturm). */
export function sturmCount(diag: Float64Array, off: number, lambda: number): number {
  let count = 0;
  let q = 1;
  const e2 = off * off;
  for (let i = 0; i < diag.length; i++) {
    q = diag[i]! - lambda - (i > 0 ? e2 / q : 0);
    if (q === 0) q = -1e-300;
    if (q < 0) count++;
  }
  return count;
}

/** k-ésimo autovalor (k = 0, 1, …) por bisseção. */
export function eigenvalue(diag: Float64Array, off: number, k: number): number {
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < diag.length; i++) {
    lo = Math.min(lo, diag[i]! - 2 * Math.abs(off));
    hi = Math.max(hi, diag[i]! + 2 * Math.abs(off));
  }
  for (let it = 0; it < 200 && hi - lo > 1e-13 * Math.max(1, Math.abs(lo)); it++) {
    const mid = 0.5 * (lo + hi);
    if (sturmCount(diag, off, mid) > k) hi = mid;
    else lo = mid;
  }
  return 0.5 * (lo + hi);
}

/** Resolve (T − σI)y = b, T tridiagonal simétrica com diagonal `diag` e fora da diagonal `off`. */
function thomas(diag: Float64Array, off: number, sigma: number, b: Float64Array): Float64Array {
  const n = diag.length;
  const c = new Float64Array(n);
  const y = new Float64Array(n);
  let m = diag[0]! - sigma;
  c[0] = off / m;
  y[0] = b[0]! / m;
  for (let i = 1; i < n; i++) {
    m = diag[i]! - sigma - off * c[i - 1]!;
    if (m === 0) m = 1e-300;
    c[i] = off / m;
    y[i] = (b[i]! - off * y[i - 1]!) / m;
  }
  for (let i = n - 2; i >= 0; i--) y[i] = y[i]! - c[i]! * y[i + 1]!;
  return y;
}

export function solve(V: Float64Array, h: number, levels: number): { E: number[]; psi: Float64Array[] } {
  const n = V.length;
  const diag = new Float64Array(n);
  for (let i = 0; i < n; i++) diag[i] = 1 / (h * h) + V[i]!;
  const off = -1 / (2 * h * h);
  const E: number[] = [];
  const psi: Float64Array[] = [];
  for (let k = 0; k < levels; k++) {
    const ek = eigenvalue(diag, off, k);
    if (!(ek < WALL / 10)) break;
    E.push(ek);
    let v: Float64Array = new Float64Array(n);
    for (let i = 0; i < n; i++) v[i] = 1 + 0.1 * Math.sin(i * 0.37 + k);
    const sigma = ek + 1e-10 * Math.max(1, Math.abs(ek));
    for (let it = 0; it < 3; it++) {
      v = thomas(diag, off, sigma, v);
      let nn = 0;
      for (let i = 0; i < n; i++) nn += v[i]! * v[i]!;
      const s = 1 / Math.sqrt(nn * h);
      for (let i = 0; i < n; i++) v[i] = v[i]! * s;
    }
    // Convenção de sinal: o primeiro lóbulo significativo (da esquerda) é positivo.
    let mx = 0;
    for (let i = 0; i < n; i++) mx = Math.max(mx, Math.abs(v[i]!));
    for (let i = 0; i < n; i++) {
      if (Math.abs(v[i]!) > 0.05 * mx) {
        if (v[i]! < 0) for (let j = 0; j < n; j++) v[j] = -v[j]!;
        break;
      }
    }
    psi.push(v);
  }
  return { E, psi };
}

export type PotentialKind = 0 | 1 | 2 | 3 | 4;

export interface PotentialParams {
  kind: number;
  L: number;
  V0: number;
  omega: number;
  /** Potencial desenhado: valores por faixa em [−X, X]. */
  drawn: number[];
}

export function potentialAt(x: number, p: PotentialParams): number {
  switch (p.kind) {
    case 0:
      return Math.abs(x) < p.L / 2 - 1e-9 ? 0 : WALL;
    case 1:
      return Math.abs(x) < p.L / 2 ? 0 : p.V0;
    case 2:
      return 0.5 * p.omega * p.omega * x * x;
    case 3: {
      const c = p.L / 2;
      return p.V0 * (x * x / (c * c) - 1) ** 2;
    }
    default: {
      const nb = p.drawn.length;
      const i = Math.max(0, Math.min(nb - 1, Math.floor(((x + X_MAX) / (2 * X_MAX)) * nb)));
      return p.drawn[i] ?? 0;
    }
  }
}

export function solvePotential(p: PotentialParams, levels: number): Solution {
  const { x, h } = grid();
  const V = new Float64Array(x.length);
  // Média de V na célula de cada ponto: descontinuidades (poço finito, desenho) ficam com erro O(h²).
  const sub = p.kind === 0 ? 1 : 8;
  for (let i = 0; i < x.length; i++) {
    let acc = 0;
    for (let j = 0; j < sub; j++) acc += potentialAt(x[i]! + (sub === 1 ? 0 : ((j + 0.5) / sub - 0.5) * h), p);
    V[i] = Math.min(WALL, acc / sub);
  }
  const { E, psi } = solve(V, h, levels);
  return { x, V, h, E, psi };
}

/** ∫ f(x) dx pela regra do trapézio (ψ = 0 nas bordas). */
export function integrate(f: (i: number) => number, n: number, h: number): number {
  let s = 0;
  for (let i = 0; i < n; i++) s += f(i);
  return s * h;
}

/** ⟨x⟩(t) para (ψ_a + ψ_b)/√2. */
export function meanX(sol: Solution, a: number, b: number, t: number): number {
  const pa = sol.psi[a];
  const pb = sol.psi[b];
  if (!pa || !pb) return 0;
  const n = sol.x.length;
  const xaa = integrate((i) => sol.x[i]! * pa[i]! * pa[i]!, n, sol.h);
  const xbb = integrate((i) => sol.x[i]! * pb[i]! * pb[i]!, n, sol.h);
  const xab = integrate((i) => sol.x[i]! * pa[i]! * pb[i]!, n, sol.h);
  return 0.5 * (xaa + xbb) + xab * Math.cos((sol.E[b]! - sol.E[a]!) * t);
}

/** Energias exatas de referência. */
export const infiniteWellE = (n: number, L: number) => (n * n * Math.PI * Math.PI) / (2 * L * L);
export const oscillatorE = (n: number, omega: number) => (n + 0.5) * omega;

/**
 * Estados ligados do poço finito (V = 0 em |x| < L/2, V0 fora), raízes das
 * equações transcendentes: pares k tan(kL/2) = κ, ímpares −k cot(kL/2) = κ.
 */
export function finiteWellLevels(L: number, V0: number): number[] {
  const out: number[] = [];
  const kmax = Math.sqrt(2 * V0);
  const f = (k: number, even: boolean) => {
    const kap = Math.sqrt(Math.max(0, 2 * V0 - k * k));
    const c = Math.cos((k * L) / 2);
    const s = Math.sin((k * L) / 2);
    return even ? k * s - kap * c : k * c + kap * s;
  };
  const steps = 20000;
  for (const even of [true, false]) {
    let prev = f(1e-9, even);
    for (let i = 1; i <= steps; i++) {
      const k = (kmax * i) / steps;
      const cur = f(k, even);
      if (prev === 0 || prev * cur < 0) {
        let lo = (kmax * (i - 1)) / steps;
        let hi = k;
        for (let j = 0; j < 80; j++) {
          const mid = 0.5 * (lo + hi);
          if (f(lo, even) * f(mid, even) <= 0) hi = mid;
          else lo = mid;
        }
        const kk = 0.5 * (lo + hi);
        if (kk < kmax * (1 - 1e-9)) out.push((kk * kk) / 2);
      }
      prev = cur;
    }
  }
  return out.sort((a, b) => a - b);
}
