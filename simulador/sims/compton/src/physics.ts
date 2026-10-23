/** Efeito Compton: cinemática fóton–elétron, seção de choque e espectro medido. */

/** Comprimento de onda Compton do elétron h/(m_e c), em pm. */
export const LAMBDA_C = 2.42631023867;
/** hc em keV·pm. */
export const HC_KEV_PM = 1239.84198;
/** Energia de repouso do elétron (keV). */
export const ME_C2 = 510.99895;
/** Massa do elétron (kg) e c (m/s), para converter h/mc em h. */
export const ME = 9.1093837015e-31;
export const C = 299792458;
/** Raio clássico do elétron (m). */
export const R_E = 2.8179403262e-15;

/** Δλ = (h/mc)(1 − cos θ), em pm. */
export const comptonShift = (theta: number) => LAMBDA_C * (1 - Math.cos(theta));
/** λ' do fóton espalhado (pm). */
export const scatteredLambda = (lambda0: number, theta: number) => lambda0 + comptonShift(theta);
/** Energia de um fóton (keV) a partir de λ em pm. */
export const photonEnergy = (lambda: number) => HC_KEV_PM / lambda;

export interface Kinematics {
  /** Energias (keV) e momentos (keV/c) do fóton incidente e espalhado. */
  E0: number;
  E1: number;
  /** Energia cinética do elétron de recuo (keV). */
  K: number;
  /** Componentes do momento do elétron (keV/c). */
  pex: number;
  pey: number;
  pe: number;
  /** Ângulo de recuo do elétron (rad, abaixo do eixo quando θ > 0). */
  phi: number;
}

/** Colisão fóton–elétron livre em repouso: conservação de energia e momento. */
export function kinematics(lambda0: number, theta: number): Kinematics {
  const E0 = photonEnergy(lambda0);
  const E1 = photonEnergy(scatteredLambda(lambda0, theta));
  const pex = E0 - E1 * Math.cos(theta);
  const pey = -E1 * Math.sin(theta);
  const pe = Math.hypot(pex, pey);
  return { E0, E1, K: E0 - E1, pex, pey, pe, phi: Math.atan2(pey, pex) };
}

/**
 * Seção de choque diferencial de Klein–Nishina (m²/sr):
 * dσ/dΩ = (r_e²/2) (λ/λ')² [λ/λ' + λ'/λ − sin²θ].
 */
export function kleinNishina(lambda0: number, theta: number): number {
  const r = lambda0 / scatteredLambda(lambda0, theta);
  return 0.5 * R_E * R_E * r * r * (r + 1 / r - Math.sin(theta) ** 2);
}

/** Alvos: fração de espalhamento coerente (pico não deslocado) e largura do perfil Compton. */
export const TARGETS = [
  { name: "grafite (C)", coherent: 0.12, pz: 0.9 },
  { name: "alumínio (Al)", coherent: 0.35, pz: 1.4 },
  { name: "cobre (Cu)", coherent: 0.7, pz: 2.0 },
];

/** Resolução instrumental do espectrômetro de cristal (pm, desvio padrão). */
export const SIGMA_INSTR = 0.25;
/** Constante de estrutura fina (momento atômico em unidades de mc). */
const ALPHA = 1 / 137.036;

/** Largura do pico deslocado: resolução ⊕ alargamento Doppler pelo movimento dos elétrons ligados. */
export function shiftedWidth(lambda0: number, theta: number, pz: number): number {
  const doppler = 2 * lambda0 * Math.sin(theta / 2) * pz * ALPHA * 0.5;
  return Math.hypot(SIGMA_INSTR, doppler);
}

/**
 * Espectro esperado (contagens por segundo por pm) no detector a θ.
 * Pico deslocado: elétrons quase livres (Klein–Nishina). Pico não deslocado:
 * espalhamento pelo átomo inteiro (massa ~10⁴ vezes maior, Δλ desprezível),
 * que diminui com o ângulo (fator de forma).
 */
export function spectrumModel(lambda: number, lambda0: number, theta: number, target: number, rate = 400): number {
  const tg = TARGETS[target] ?? TARGETS[0]!;
  const kn = kleinNishina(lambda0, theta) / (R_E * R_E);
  const coh = tg.coherent * (1 + Math.cos(theta) ** 2) * 0.5 * Math.exp(-((Math.sin(theta / 2) / 0.6) ** 2)) * 2.2;
  const s1 = shiftedWidth(lambda0, theta, tg.pz);
  const g = (x: number, mu: number, s: number) => Math.exp(-0.5 * ((x - mu) / s) ** 2) / (s * Math.sqrt(2 * Math.PI));
  const shifted = (1 - tg.coherent) * kn * g(lambda, scatteredLambda(lambda0, theta), s1);
  const unshifted = coh * g(lambda, lambda0, SIGMA_INSTR);
  return rate * (shifted + unshifted) + 2; // + fundo
}

/** Bins do espectro em torno de λ₀. */
export const NB = 120;
export const BIN = 0.1; // pm
export const binLambda = (lambda0: number, i: number) => lambda0 - 2 + (i + 0.5) * BIN;

/**
 * Localiza o pico deslocado num histograma: maior bin na região λ > λ₀ + Δλ/2
 * e centróide ponderado dos bins acima da meia altura em volta dele.
 */
export function findShiftedPeak(counts: number[], lambda0: number, theta: number): number {
  const lo = lambda0 + comptonShift(theta) / 2;
  let iMax = -1;
  for (let i = 0; i < counts.length; i++) {
    if (binLambda(lambda0, i) < lo) continue;
    if (iMax < 0 || counts[i]! > counts[iMax]!) iMax = i;
  }
  if (iMax < 0) return NaN;
  const half = counts[iMax]! / 2;
  let sw = 0;
  let sx = 0;
  for (let i = iMax; i >= 0 && counts[i]! >= half; i--) {
    sw += counts[i]!;
    sx += counts[i]! * binLambda(lambda0, i);
  }
  for (let i = iMax + 1; i < counts.length && counts[i]! >= half; i++) {
    sw += counts[i]!;
    sx += counts[i]! * binLambda(lambda0, i);
  }
  return sw > 0 ? sx / sw : NaN;
}

export interface Point {
  /** 1 − cos θ */
  u: number;
  /** Δλ medido (pm) */
  dl: number;
}

/** Ajuste por mínimos quadrados Δλ = a·(1 − cos θ) + b. */
export function fitShift(pts: Point[]) {
  const n = pts.length;
  if (n < 2) return null;
  const mx = pts.reduce((a, p) => a + p.u, 0) / n;
  const my = pts.reduce((a, p) => a + p.dl, 0) / n;
  let sxx = 0;
  let sxy = 0;
  for (const p of pts) {
    sxx += (p.u - mx) ** 2;
    sxy += (p.u - mx) * (p.dl - my);
  }
  if (sxx < 1e-12) return null;
  const slope = sxy / sxx;
  const intercept = my - slope * mx;
  let ss = 0;
  for (const p of pts) ss += (p.dl - slope * p.u - intercept) ** 2;
  const sSlope = n > 2 ? Math.sqrt(ss / (n - 2) / sxx) : 0;
  /** h = (h/mc)·m·c */
  const h = slope * 1e-12 * ME * C;
  return { slope, intercept, sSlope, h, n };
}

/** Gerador congruente simples, com estado inteiro guardado no estado da sim. */
export function lcg(seed: number): [number, number] {
  const next = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return [next / 4294967296, next];
}

/** Amostra de Poisson (Knuth para média pequena, normal para média grande). */
export function poisson(mean: number, seed: number): [number, number] {
  let s = seed;
  if (mean > 30) {
    let u1: number;
    let u2: number;
    [u1, s] = lcg(s);
    [u2, s] = lcg(s);
    const z = Math.sqrt(-2 * Math.log(Math.max(u1, 1e-12))) * Math.cos(2 * Math.PI * u2);
    return [Math.max(0, Math.round(mean + Math.sqrt(mean) * z)), s];
  }
  const L = Math.exp(-mean);
  let k = 0;
  let prod = 1;
  for (;;) {
    let u: number;
    [u, s] = lcg(s);
    prod *= u;
    if (prod <= L) return [k, s];
    k++;
  }
}
