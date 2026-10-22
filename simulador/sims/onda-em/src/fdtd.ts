/**
 * FDTD de Yee em unidades normalizadas: c = 1, ε₀ = μ₀ = 1 (B medido como c·B).
 * O passo de tempo é comum aos dois modos; o número de Courant S = c·dt/dx
 * fica abaixo do limite de estabilidade (1 em 1D, 1/√2 em 2D).
 */
export const DT = 0.01;

// ---------- 1D: Ey(x, t), Bz(x, t) ----------
export const L1 = 10;
export const DX1 = 0.02;
export const N1 = Math.round(L1 / DX1); // células; Ey em i·dx (i = 0..N1), Bz em (i + ½)dx
export const S1 = DT / DX1;

/** Fonte: pulso gaussiano ou seno com rampa suave de um período. Amplitude da onda emitida ≈ 1. */
export function sourceValue(kind: number, f: number, t: number): number {
  if (kind === 0) {
    const t0 = 1.2, w = 0.3;
    return Math.exp(-(((t - t0) / w) ** 2));
  }
  const ramp = t * f < 1 ? 0.5 * (1 - Math.cos(Math.PI * t * f)) : 1;
  return ramp * Math.sin(2 * Math.PI * f * t);
}

/**
 * Um passo 1D. `pec` = true põe um condutor perfeito em x = L1 (Ey = 0);
 * senão a borda direita é absorvente (Mur de 1ª ordem). A esquerda é sempre absorvente.
 */
export function step1D(e: Float32Array, b: Float32Array, srcI: number, src: number, pec: boolean): [Float32Array, Float32Array] {
  const S = S1;
  const ne = e.slice();
  const nb = b.slice();
  for (let i = 0; i < N1; i++) nb[i] = b[i]! - S * (e[i + 1]! - e[i]!);
  for (let i = 1; i < N1; i++) ne[i] = e[i]! - S * (nb[i]! - nb[i - 1]!);
  // Fonte "suave" (corrente numa lâmina): +2S·g dá ondas de amplitude g para cada lado.
  ne[srcI] = ne[srcI]! + 2 * S * src;
  const k = (S - 1) / (S + 1);
  ne[0] = e[1]! + k * (ne[1]! - e[0]!);
  if (pec) ne[N1] = 0;
  else ne[N1] = e[N1 - 1]! + k * (ne[N1 - 1]! - e[N1]!);
  return [ne, nb];
}

export function energy1D(e: Float32Array, b: Float32Array): number {
  let u = 0;
  for (let i = 0; i < e.length; i++) u += e[i]! ** 2;
  for (let i = 0; i < b.length; i++) u += b[i]! ** 2;
  return 0.5 * u * DX1;
}

// ---------- 2D TMz: Ez, Hx, Hy ----------
export const DX2 = 0.05;
export const NX = 100;
export const NY = 75;
export const S2 = DT / DX2;
export const W2 = (NX - 1) * DX2;
export const H2 = (NY - 1) * DX2;
export const idx = (i: number, j: number) => i + NX * j;

/** Máscara de condutor perfeito (1 = Ez forçado a zero). */
export function makeMask(kind: number): Uint8Array {
  const m = new Uint8Array(NX * NY);
  if (kind === 1) {
    const i = Math.round(3.6 / DX2);
    for (let j = Math.round(NY * 0.2); j <= Math.round(NY * 0.8); j++) m[idx(i, j)] = 1;
  } else if (kind === 2) {
    const i = Math.round(3 / DX2);
    const yc = H2 / 2;
    for (let j = 0; j < NY; j++) {
      const y = j * DX2;
      const inSlit = Math.abs(y - (yc - 0.5)) < 0.12 || Math.abs(y - (yc + 0.5)) < 0.12;
      if (!inSlit) m[idx(i, j)] = 1;
    }
  }
  return m;
}

const masks = new Map<number, Uint8Array>();
export function maskFor(kind: number): Uint8Array {
  let m = masks.get(kind);
  if (!m) {
    m = makeMask(kind);
    masks.set(kind, m);
  }
  return m;
}

export function step2D(
  ez: Float32Array,
  hx: Float32Array,
  hy: Float32Array,
  si: number,
  sj: number,
  src: number,
  mask: Uint8Array,
): [Float32Array, Float32Array, Float32Array] {
  const S = S2;
  const nhx = hx.slice();
  const nhy = hy.slice();
  const nez = ez.slice();
  for (let j = 0; j < NY - 1; j++)
    for (let i = 0; i < NX; i++) nhx[idx(i, j)] = hx[idx(i, j)]! - S * (ez[idx(i, j + 1)]! - ez[idx(i, j)]!);
  for (let j = 0; j < NY; j++)
    for (let i = 0; i < NX - 1; i++) nhy[idx(i, j)] = hy[idx(i, j)]! + S * (ez[idx(i + 1, j)]! - ez[idx(i, j)]!);
  for (let j = 1; j < NY - 1; j++)
    for (let i = 1; i < NX - 1; i++) {
      const k = idx(i, j);
      nez[k] = ez[k]! + S * (nhy[k]! - nhy[k - 1]! - nhx[k]! + nhx[k - NX]!);
    }
  nez[idx(si, sj)] = nez[idx(si, sj)]! + src;
  // Bordas absorventes (Mur de 1ª ordem)
  const c = (S - 1) / (S + 1);
  for (let j = 0; j < NY; j++) {
    nez[idx(0, j)] = ez[idx(1, j)]! + c * (nez[idx(1, j)]! - ez[idx(0, j)]!);
    nez[idx(NX - 1, j)] = ez[idx(NX - 2, j)]! + c * (nez[idx(NX - 2, j)]! - ez[idx(NX - 1, j)]!);
  }
  for (let i = 0; i < NX; i++) {
    nez[idx(i, 0)] = ez[idx(i, 1)]! + c * (nez[idx(i, 1)]! - ez[idx(i, 0)]!);
    nez[idx(i, NY - 1)] = ez[idx(i, NY - 2)]! + c * (nez[idx(i, NY - 2)]! - ez[idx(i, NY - 1)]!);
  }
  for (let k = 0; k < mask.length; k++) if (mask[k]) nez[k] = 0;
  return [nez, nhx, nhy];
}

export function energy2D(ez: Float32Array, hx: Float32Array, hy: Float32Array): number {
  let u = 0;
  for (let k = 0; k < ez.length; k++) u += ez[k]! ** 2 + hx[k]! ** 2 + hy[k]! ** 2;
  return 0.5 * u * DX2 * DX2;
}

// ---------- Capacitor carregando (SI) ----------
export const EPS0 = 8.8541878128e-12;
export const MU0 = 4 * Math.PI * 1e-7;

export interface CapParams {
  /** fem (V), resistência (Ω), raio das placas (m), separação (m) */
  emf: number;
  R: number;
  a: number;
  d: number;
}
export const capC = (c: CapParams) => (EPS0 * Math.PI * c.a * c.a) / c.d;
export const capTau = (c: CapParams) => c.R * capC(c);
export const capQ = (c: CapParams, t: number) => capC(c) * c.emf * (1 - Math.exp(-t / capTau(c)));
export const capI = (c: CapParams, t: number) => (c.emf / c.R) * Math.exp(-t / capTau(c));
/** Fluxo elétrico entre as placas através de um círculo de raio r (campo uniforme, sem franjas). */
export const fluxE = (c: CapParams, q: number, r: number) => (q / (EPS0 * Math.PI * c.a * c.a)) * Math.PI * Math.min(r, c.a) ** 2;
/** B a uma distância r do eixo, no meio das placas, via Ampère-Maxwell com I_d(r). */
export const bGap = (c: CapParams, Id: number, r: number) => (r <= 0 ? 0 : (MU0 * Id * Math.min(1, (r * r) / (c.a * c.a))) / (2 * Math.PI * r));
export const bWire = (I: number, r: number) => (r <= 0 ? 0 : (MU0 * I) / (2 * Math.PI * r));
