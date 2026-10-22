/**
 * Pacote de onda gaussiano em 1D (ħ = m = 1) evoluído por Crank–Nicolson,
 * com o sistema tridiagonal complexo resolvido pelo algoritmo de Thomas, e
 * coeficiente de transmissão T(E) de potenciais constantes por partes
 * (matriz de transferência).
 */

export const XL = 75;
export const DX = 0.05;
export const NX = Math.round((2 * XL) / DX) - 1;

export interface Region {
  /** Início e fim (x0 < x1) de um trecho com potencial V. */
  x0: number;
  x1: number;
  V: number;
}

export interface Wave {
  re: Float64Array;
  im: Float64Array;
}

export const xAt = (i: number) => -XL + (i + 1) * DX;

/** Potencial na posição x (0 fora dos trechos). */
export function potentialAt(x: number, regions: Region[]): number {
  for (const r of regions) if (x >= r.x0 && x < r.x1) return r.V;
  return 0;
}

/** V nos pontos da malha, com média na célula (bordas fora da malha ficam com o peso certo). */
export function potentialGrid(regions: Region[]): Float64Array {
  const V = new Float64Array(NX);
  for (let i = 0; i < NX; i++) {
    const x = xAt(i);
    let acc = 0;
    for (let j = 0; j < 8; j++) acc += potentialAt(x + ((j + 0.5) / 8 - 0.5) * DX, regions);
    V[i] = acc / 8;
  }
  return V;
}

/** Pacote ψ = (2πσ²)^(−1/4) exp(−(x−x0)²/4σ²) e^{ik0x}, normalizado na malha. */
export function gaussianPacket(x0: number, sigma: number, k0: number): Wave {
  const re = new Float64Array(NX);
  const im = new Float64Array(NX);
  let n = 0;
  for (let i = 0; i < NX; i++) {
    const x = xAt(i);
    const g = Math.exp(-((x - x0) ** 2) / (4 * sigma * sigma));
    re[i] = g * Math.cos(k0 * x);
    im[i] = g * Math.sin(k0 * x);
    n += g * g;
  }
  const s = 1 / Math.sqrt(n * DX);
  for (let i = 0; i < NX; i++) {
    re[i] = re[i]! * s;
    im[i] = im[i]! * s;
  }
  return { re, im };
}

/**
 * Um passo de Crank–Nicolson: (1 + iΔt H/2) ψⁿ⁺¹ = (1 − iΔt H/2) ψⁿ,
 * H = −½ d²/dx² + V, ψ = 0 nas bordas. Thomas com aritmética complexa.
 */
export function cnStep(w: Wave, V: Float64Array, dt: number): Wave {
  const n = NX;
  const kin = 1 / (DX * DX);
  const off = dt / (4 * DX * DX); // b = −i·off na matriz da esquerda
  const { re, im } = w;
  // Lado direito r = (1 − iΔt/2 (1/dx² + V)) ψ + i·off (ψ₊ + ψ₋)
  const rr = new Float64Array(n);
  const ri = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const g = 0.5 * dt * (kin + V[i]!);
    const sr = (i > 0 ? re[i - 1]! : 0) + (i < n - 1 ? re[i + 1]! : 0);
    const si = (i > 0 ? im[i - 1]! : 0) + (i < n - 1 ? im[i + 1]! : 0);
    // (1 − i g)(a + i b) = a + g b + i(b − g a); i·off·(sr + i si) = −off si + i off sr
    rr[i] = re[i]! + g * im[i]! - off * si;
    ri[i] = im[i]! - g * re[i]! + off * sr;
  }
  // Matriz da esquerda: diagonal 1 + i g_i, fora da diagonal β = −i·off.
  const cr = new Float64Array(n);
  const ci = new Float64Array(n);
  const yr = new Float64Array(n);
  const yi = new Float64Array(n);
  // β = (0, −off)
  let mr = 1;
  let mi = 0.5 * dt * (kin + V[0]!);
  for (let i = 0; i < n; i++) {
    if (i > 0) {
      // m = a_i − β c_{i−1}; β c = (0 − off i)(cr + i ci) = off ci − i off cr
      mr = 1 - off * ci[i - 1]!;
      mi = 0.5 * dt * (kin + V[i]!) + off * cr[i - 1]!;
    }
    const den = mr * mr + mi * mi;
    // c_i = β / m = (−i off)(mr − i mi)/den = (−off mi − i off mr)/den
    cr[i] = (-off * mi) / den;
    ci[i] = (-off * mr) / den;
    // y_i = (r_i − β y_{i−1}) / m
    let nr = rr[i]!;
    let ni = ri[i]!;
    if (i > 0) {
      // β y = (−i off)(yr + i yi) = off yi − i off yr
      nr -= off * yi[i - 1]!;
      ni += off * yr[i - 1]!;
    }
    yr[i] = (nr * mr + ni * mi) / den;
    yi[i] = (ni * mr - nr * mi) / den;
  }
  for (let i = n - 2; i >= 0; i--) {
    const ar = cr[i]!;
    const ai = ci[i]!;
    const br = yr[i + 1]!;
    const bi = yi[i + 1]!;
    yr[i] = yr[i]! - (ar * br - ai * bi);
    yi[i] = yi[i]! - (ar * bi + ai * br);
  }
  return { re: yr, im: yi };
}

/** ∫|ψ|² dx no intervalo [xa, xb). */
export function probability(w: Wave, xa = -Infinity, xb = Infinity): number {
  let s = 0;
  for (let i = 0; i < NX; i++) {
    const x = xAt(i);
    if (x >= xa && x < xb) s += w.re[i]! ** 2 + w.im[i]! ** 2;
  }
  return s * DX;
}

// --------- Matriz de transferência ---------

type C = [number, number];
const cadd = (a: C, b: C): C => [a[0] + b[0], a[1] + b[1]];
const csub = (a: C, b: C): C => [a[0] - b[0], a[1] - b[1]];
const cmul = (a: C, b: C): C => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
const cdiv = (a: C, b: C): C => {
  const d = b[0] * b[0] + b[1] * b[1];
  return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d];
};
const cexp = (a: C): C => {
  const m = Math.exp(a[0]);
  return [m * Math.cos(a[1]), m * Math.sin(a[1])];
};
/** k = √(2(E − V)), real ou imaginário puro. */
const kOf = (E: number, V: number): C => (E >= V ? [Math.sqrt(2 * (E - V)), 0] : [0, Math.sqrt(2 * (V - E))]);

/** Coeficiente de transmissão de um potencial constante por partes (V = 0 nos extremos). */
export function transmission(E: number, regions: Region[]): number {
  if (E <= 0) return 0;
  const rs = [...regions].sort((a, b) => a.x0 - b.x0);
  // Interfaces da esquerda para a direita, com o potencial de cada lado (trechos não se sobrepõem).
  const iface: { x: number; Vl: number; Vr: number }[] = [];
  for (const r of rs) iface.push({ x: r.x0, Vl: 0, Vr: r.V }, { x: r.x1, Vl: r.V, Vr: 0 });
  // Do lado direito: A = 1, B = 0.
  let A: C = [1, 0];
  let B: C = [0, 0];
  const e = E + (rs.some((r) => Math.abs(r.V - E) < 1e-12) ? 1e-9 : 0);
  for (let j = iface.length - 1; j >= 0; j--) {
    const { x, Vl, Vr } = iface[j]!;
    const kr = kOf(e, Vr);
    const kl = kOf(e, Vl);
    const ikr: C = [-kr[1], kr[0]];
    const ikl: C = [-kl[1], kl[0]];
    const ep = cexp(cmul(ikr, [x, 0]));
    const em = cexp(cmul(ikr, [-x, 0]));
    const val = cadd(cmul(A, ep), cmul(B, em));
    const der = cmul(ikr, csub(cmul(A, ep), cmul(B, em)));
    const q = cdiv(der, ikl);
    const fl = cexp(cmul(ikl, [-x, 0]));
    const gl = cexp(cmul(ikl, [x, 0]));
    A = cmul([0.5, 0], cmul(fl, cadd(val, q)));
    B = cmul([0.5, 0], cmul(gl, csub(val, q)));
  }
  return 1 / (A[0] * A[0] + A[1] * A[1]);
}

/** Fórmula fechada da barreira retangular de altura V0 e largura a. */
export function barrierT(E: number, V0: number, a: number): number {
  if (V0 === 0) return 1;
  if (E < V0) {
    const kap = Math.sqrt(2 * (V0 - E));
    return 1 / (1 + (V0 * V0 * Math.sinh(kap * a) ** 2) / (4 * E * (V0 - E)));
  }
  if (E === V0) return 1 / (1 + (V0 * a * a) / 2);
  const k = Math.sqrt(2 * (E - V0));
  return 1 / (1 + (V0 * V0 * Math.sin(k * a) ** 2) / (4 * E * (E - V0)));
}

/** ⟨T⟩ sobre a distribuição de momentos do pacote, |φ(k)|² gaussiana com σ_k = 1/(2σ). */
export function packetT(k0: number, sigma: number, regions: Region[]): number {
  const sk = 1 / (2 * sigma);
  let num = 0;
  let den = 0;
  const n = 400;
  for (let i = 0; i <= n; i++) {
    const k = k0 + sk * (-6 + (12 * i) / n);
    const w = Math.exp(-((k - k0) ** 2) / (2 * sk * sk)) * (i === 0 || i === n ? 0.5 : 1);
    den += w;
    if (k > 0) num += w * transmission((k * k) / 2, regions);
  }
  return num / den;
}
