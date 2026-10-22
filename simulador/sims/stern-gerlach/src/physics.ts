// Física do experimento de Stern–Gerlach (átomos de prata, spin ½).

/** Magnéton de Bohr (J/T). */
export const MU_B = 9.2740100783e-24;
/** Massa do átomo de prata (kg): 107,87 u. */
export const M_AG = 107.8682 * 1.66053906660e-27;

/** Gerador mulberry32 com o estado guardado num número (cabe no estado da sim). */
export function nextRandom(st: { seed: number }): number {
  st.seed = (st.seed + 0x6d2b79f5) >>> 0;
  let t = st.seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function gaussianFrom(st: { seed: number }): number {
  let u = 0;
  while (u === 0) u = nextRandom(st);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * nextRandom(st));
}

/** Aceleração transversal de um átomo com μ_z = ±μ_B num gradiente dB/dz (T/m). */
export const accel = (grad: number) => (MU_B * grad) / M_AG;

/**
 * Desvio no anteparo (m) de um átomo com μ_z = μ_B: parábola dentro do ímã de
 * comprimento L1 e reta no voo livre Ld até o anteparo.
 * z = (μ_B ∂B/∂z / m) (L1²/2 + L1·Ld) / v².
 */
export const deflection = (grad: number, v: number, L1: number, Ld: number) => (accel(grad) * (L1 * L1 / 2 + L1 * Ld)) / (v * v);

/** Posição transversal z(y) ao longo do feixe (y = 0 na entrada do ímã), para μ_z = s·μ_B. */
export function zAlong(y: number, s: number, grad: number, v: number, L1: number): number {
  const a = s * accel(grad);
  if (y <= 0) return 0;
  if (y <= L1) return (a * y * y) / (2 * v * v);
  return (a * (L1 * L1 / 2 + L1 * (y - L1))) / (v * v);
}

/**
 * Probabilidade de sair pela porta + de um aparelho orientado no ângulo θ (no plano
 * xz, medido a partir de z), para um átomo com spin preparado na direção φ.
 * Átomo não polarizado (φ = null): ½.
 */
export function probPlus(theta: number, phi: number | null): number {
  if (phi === null) return 0.5;
  const c = Math.cos((theta - phi) / 2);
  return c * c;
}

/**
 * Probabilidades de cada desfecho numa série de aparelhos (ângulos em rad). `keep[i]`
 * diz qual porta do aparelho i segue para o próximo (+1 ou −1). Devolve as frações
 * bloqueadas em cada aparelho intermediário e as frações nas portas + e − do último.
 */
export function seriesOutcome(thetas: number[], keep: number[]): { blocked: number[]; plus: number; minus: number } {
  let alive = 1;
  let phi: number | null = null;
  const blocked: number[] = [];
  for (let i = 0; i < thetas.length - 1; i++) {
    const pp = probPlus(thetas[i]!, phi);
    const pass = keep[i]! > 0 ? pp : 1 - pp;
    blocked.push(alive * (1 - pass));
    alive *= pass;
    phi = keep[i]! > 0 ? thetas[i]! : thetas[i]! + Math.PI;
  }
  const last = thetas[thetas.length - 1]!;
  const pp = probPlus(last, phi);
  return { blocked, plus: alive * pp, minus: alive * (1 - pp) };
}

/** Fração em +: P(+|chegou ao último aparelho). */
export function lastPlusConditional(thetas: number[], keep: number[]): number {
  const o = seriesOutcome(thetas, keep);
  const tot = o.plus + o.minus;
  return tot > 0 ? o.plus / tot : 0;
}
