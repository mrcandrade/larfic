// Física de N osciladores idênticos acoplados: matriz dinâmica, modos normais e energia.
import { num, type Params } from "@fisilab/core";

export const G = 9.81;
/** Espaçamento físico de equilíbrio entre as massas (m), usado na relação de dispersão. */
export const A_REDE = 0.1;

export const sistemaOf = (p: Params) => Math.round(num(p, "sistema", 0));
export const nOf = (p: Params) => Math.max(2, Math.min(40, Math.round(num(p, "N", 2))));
export const massOf = (p: Params) => num(p, "m", 0.5);
export const kOf = (p: Params) => num(p, "k", 10);
export const kcOf = (p: Params) => num(p, "kc", 2);
export const lenOf = (p: Params) => num(p, "L", 1);

/** ω₀² de cada oscilador isolado: k/m (molas nas paredes) ou g/L (pêndulos). */
export function omega0sq(p: Params): number {
  return sistemaOf(p) === 1 ? G / lenOf(p) : kOf(p) / massOf(p);
}

/**
 * Matriz dinâmica D = M⁻¹K (tridiagonal, simétrica porque as massas são iguais):
 * ẍ = −D x. Devolve a diagonal e a subdiagonal.
 */
export function dynamical(p: Params): { diag: number[]; off: number } {
  const n = nOf(p);
  const m = massOf(p);
  const kc = kcOf(p);
  const diag: number[] = [];
  for (let i = 0; i < n; i++) {
    const nb = (i > 0 ? 1 : 0) + (i < n - 1 ? 1 : 0);
    if (sistemaOf(p) === 1) diag.push(G / lenOf(p) + (nb * kc) / m);
    else {
      // Massas presas às paredes pela mola k nas pontas e a vizinhas por kc
      const kl = i === 0 ? kOf(p) : kc;
      const kr = i === n - 1 ? kOf(p) : kc;
      diag.push((kl + kr) / m);
    }
  }
  return { diag, off: -kc / m };
}

export interface Modes {
  /** Frequências angulares ω_n (rad/s), em ordem crescente. */
  omega: number[];
  /** Vetores próprios ortonormais: vec[n][i] = componente da massa i no modo n. */
  vec: number[][];
}

/** Autovalores e autovetores de uma matriz simétrica pelo método de Jacobi. */
export function jacobiEigen(Ain: number[][]): { values: number[]; vectors: number[][] } {
  const n = Ain.length;
  const A = Ain.map((r) => r.slice());
  const V: number[][] = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
  for (let sweep = 0; sweep < 100; sweep++) {
    let offNorm = 0;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) offNorm += A[i]![j]! ** 2;
    if (offNorm < 1e-22) break;
    for (let p = 0; p < n; p++) {
      for (let q = p + 1; q < n; q++) {
        const apq = A[p]![q]!;
        if (Math.abs(apq) < 1e-300) continue;
        const theta = (A[q]![q]! - A[p]![p]!) / (2 * apq);
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1);
        const s = t * c;
        for (let k = 0; k < n; k++) {
          const akp = A[k]![p]!, akq = A[k]![q]!;
          A[k]![p] = c * akp - s * akq;
          A[k]![q] = s * akp + c * akq;
        }
        for (let k = 0; k < n; k++) {
          const apk = A[p]![k]!, aqk = A[q]![k]!;
          A[p]![k] = c * apk - s * aqk;
          A[q]![k] = s * apk + c * aqk;
        }
        for (let k = 0; k < n; k++) {
          const vkp = V[k]![p]!, vkq = V[k]![q]!;
          V[k]![p] = c * vkp - s * vkq;
          V[k]![q] = s * vkp + c * vkq;
        }
      }
    }
  }
  const idx = Array.from({ length: n }, (_, i) => i).sort((a, b) => A[a]![a]! - A[b]![b]!);
  const values = idx.map((i) => A[i]![i]!);
  const vectors = idx.map((j) => {
    const v = V.map((row) => row[j]!);
    // Convenção de sinal: primeira componente não nula positiva
    const first = v.find((x) => Math.abs(x) > 1e-9) ?? 1;
    return first < 0 ? v.map((x) => -x) : v;
  });
  return { values, vectors };
}

const cache = new Map<string, Modes>();

/** Modos normais (com cache, porque só dependem dos parâmetros estruturais). */
export function modesOf(p: Params): Modes {
  const key = [sistemaOf(p), nOf(p), massOf(p), kOf(p), kcOf(p), lenOf(p)].join("|");
  const hit = cache.get(key);
  if (hit) return hit;
  const { diag, off } = dynamical(p);
  const n = diag.length;
  const M = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? diag[i]! : Math.abs(i - j) === 1 ? off : 0)));
  const { values, vectors } = jacobiEigen(M);
  const res: Modes = { omega: values.map((l) => Math.sqrt(Math.max(0, l))), vec: vectors };
  if (cache.size > 64) cache.clear();
  cache.set(key, res);
  return res;
}

/** ẍ = −D x − b ẋ, estado [x₀…x_{N−1}, v₀…v_{N−1}]. */
export function derivatives(s: number[], p: Params): number[] {
  const n = nOf(p);
  const { diag, off } = dynamical(p);
  const b = num(p, "b", 0);
  const out = new Array<number>(2 * n);
  for (let i = 0; i < n; i++) {
    out[i] = s[n + i]!;
    let a = -diag[i]! * s[i]!;
    if (i > 0) a -= off * s[i - 1]!;
    if (i < n - 1) a -= off * s[i + 1]!;
    out[n + i] = a - b * s[n + i]!;
  }
  return out;
}

/** Coordenadas normais q_n = φ_n·x e velocidades q̇_n = φ_n·v. */
export function modalCoords(s: number[], p: Params): { q: number[]; qd: number[] } {
  const n = nOf(p);
  const { vec } = modesOf(p);
  const q = vec.map((v) => v.reduce((acc, c, i) => acc + c * s[i]!, 0));
  const qd = vec.map((v) => v.reduce((acc, c, i) => acc + c * s[n + i]!, 0));
  return { q, qd };
}

/** Energia de cada modo: ½m(q̇² + ω²q²). Soma = energia mecânica total. */
export function modeEnergies(s: number[], p: Params): number[] {
  const m = massOf(p);
  const { omega } = modesOf(p);
  const { q, qd } = modalCoords(s, p);
  return omega.map((w, i) => 0.5 * m * (qd[i]! ** 2 + w * w * q[i]! ** 2));
}

/** Energia mecânica total: ½m Σv² + ½ m xᵀD x. */
export function totalEnergy(s: number[], p: Params): number {
  const n = nOf(p);
  const m = massOf(p);
  const { diag, off } = dynamical(p);
  let E = 0;
  for (let i = 0; i < n; i++) {
    E += 0.5 * m * s[n + i]! ** 2 + 0.5 * m * diag[i]! * s[i]! ** 2;
    if (i < n - 1) E += m * off * s[i]! * s[i + 1]!;
  }
  return E;
}

/** Energia "do oscilador i": cinética + potencial da própria mola/gravidade (sem o acoplamento). */
export function oscillatorEnergy(s: number[], p: Params, i: number): number {
  const n = nOf(p);
  if (i >= n) return 0;
  const m = massOf(p);
  return 0.5 * m * s[n + i]! ** 2 + 0.5 * m * omega0sq(p) * s[i]! ** 2;
}

/** Solução exata (sem amortecimento) pela superposição de modos a partir de x(0), v(0). */
export function modalSolution(x0: number[], v0: number[], p: Params, t: number): number[] {
  const { omega, vec } = modesOf(p);
  const n = x0.length;
  const x = new Array<number>(n).fill(0);
  vec.forEach((phi, k) => {
    const A = phi.reduce((a, c, i) => a + c * x0[i]!, 0);
    const B = phi.reduce((a, c, i) => a + c * v0[i]!, 0);
    const w = omega[k]!;
    const qk = A * Math.cos(w * t) + (w > 1e-12 ? (B / w) * Math.sin(w * t) : B * t);
    for (let i = 0; i < n; i++) x[i]! += qk * phi[i]!;
  });
  return x;
}

/**
 * Relação de dispersão da cadeia ideal, em função de q = ka/π ∈ [0, 1]:
 * molas: ω = 2√(k_c/m) sen(qπ/2); pêndulos: ω² = g/L + 4(k_c/m) sen²(qπ/2).
 */
export function dispersion(p: Params, q: number): number {
  const s2 = Math.sin((q * Math.PI) / 2) ** 2;
  const w2c = kcOf(p) / massOf(p);
  return sistemaOf(p) === 1 ? Math.sqrt(G / lenOf(p) + 4 * w2c * s2) : 2 * Math.sqrt(w2c * s2);
}

/** Número de onda reduzido de cada modo: n/(N+1) (pontas fixas) ou n/N (pêndulos, pontas livres). */
export function modeQ(p: Params, k: number): number {
  const n = nOf(p);
  return sistemaOf(p) === 1 ? k / n : (k + 1) / (n + 1);
}

/** Condição inicial a partir dos parâmetros. */
export function initialState(p: Params): number[] {
  const n = nOf(p);
  const A = num(p, "A", 0.1);
  const ci = Math.round(num(p, "ci", 0));
  const x = new Array<number>(n).fill(0);
  const v = new Array<number>(n).fill(0);
  if (ci === 1) {
    const { vec } = modesOf(p);
    const k = Math.max(1, Math.min(n, Math.round(num(p, "nmodo", 1)))) - 1;
    const phi = vec[k]!;
    const mx = Math.max(...phi.map(Math.abs)) || 1;
    for (let i = 0; i < n; i++) x[i] = (A * phi[i]!) / mx;
  } else if (ci === 2) {
    // Pulso gaussiano viajando para a direita: v = −c ∂x/∂X, c = a√(k_c/m)
    const i0 = Math.max(1, n / 5);
    const w = Math.max(1.2, n / 14);
    const wc = Math.sqrt(kcOf(p) / massOf(p));
    for (let i = 0; i < n; i++) {
      const u = (i - i0) / w;
      x[i] = A * Math.exp(-0.5 * u * u);
      v[i] = wc * A * (u / w) * Math.exp(-0.5 * u * u);
    }
  } else if (ci === 3) {
    x[0] = A;
    x[1] = -A;
  } else {
    x[0] = A;
  }
  return [...x, ...v];
}
