/** Física do efeito fotoelétrico e o ajuste linear de Millikan. */

export const H = 6.62607015e-34; // J·s
export const E_CHARGE = 1.602176634e-19; // C
export const C_LIGHT = 299792458; // m/s
/** hc/e em eV·nm. */
export const HC_EV_NM = (H * C_LIGHT) / E_CHARGE / 1e-9;
/** Eficiência quântica da célula (elétrons por fóton). */
export const QE = 2e-3;

export interface Metal {
  name: string;
  /** Função trabalho em eV. */
  phi: number;
}

export const METALS: Metal[] = [
  { name: "Césio", phi: 2.14 },
  { name: "Potássio", phi: 2.29 },
  { name: "Sódio", phi: 2.36 },
  { name: "Cálcio", phi: 2.87 },
  { name: "Zinco", phi: 4.33 },
  { name: "Cobre", phi: 4.65 },
  { name: "Platina", phi: 5.65 },
];

export const metalOf = (i: number): Metal => METALS[Math.max(0, Math.min(METALS.length - 1, Math.round(i)))]!;

/** Energia do fóton em eV. */
export const photonEnergy = (lambdaNm: number) => HC_EV_NM / lambdaNm;
/** Frequência em Hz. */
export const frequency = (lambdaNm: number) => C_LIGHT / (lambdaNm * 1e-9);
/** Energia cinética máxima dos fotoelétrons, em eV (0 se abaixo do limiar). */
export const kMax = (lambdaNm: number, phi: number) => Math.max(0, photonEnergy(lambdaNm) - phi);
/** Potencial de corte em volts: eV₀ = hf − φ. */
export const stoppingVoltage = (lambdaNm: number, phi: number) => kMax(lambdaNm, phi);
/** Comprimento de onda de corte (limiar), em nm. */
export const thresholdNm = (phi: number) => HC_EV_NM / phi;

/** Corrente de saturação (A) para potência luminosa P em mW: I = η e (P λ / hc). */
export function saturationCurrent(lambdaNm: number, powerMw: number, phi: number): number {
  if (photonEnergy(lambdaNm) <= phi) return 0;
  const photonsPerSecond = (powerMw * 1e-3 * lambdaNm * 1e-9) / (H * C_LIGHT);
  return QE * E_CHARGE * photonsPerSecond;
}

/**
 * Corrente I(V) na célula (A). Modelo: energias cinéticas uniformes entre 0 e
 * K_max; com V < 0 só chegam ao ânodo os elétrons com K > e|V|; com V > 0 a
 * coleta cresce até saturar (geometria do tubo).
 */
export function current(V: number, lambdaNm: number, powerMw: number, phi: number): number {
  const Is = saturationCurrent(lambdaNm, powerMw, phi);
  const K = kMax(lambdaNm, phi);
  if (Is === 0 || K === 0) return 0;
  const collect = V >= 0 ? 1 - 0.3 * Math.exp(-V / 1.5) : 0.7;
  const energetic = V >= 0 ? 1 : Math.max(0, 1 - -V / K);
  return Is * collect * energetic;
}

/** Resolução do amperímetro (A). */
export const AMMETER_RES = 1e-11;

/** Varredura automática: maior |V| (passos de 0,01 V) em que a corrente ainda é detectada, mais um passo. */
export function sweepStoppingVoltage(lambdaNm: number, powerMw: number, phi: number): number {
  for (let k = 0; k < 2000; k++) {
    const V = -k * 0.01;
    if (current(V, lambdaNm, powerMw, phi) < AMMETER_RES) return Math.round(k) / 100;
  }
  return 20;
}

export interface Point {
  f: number;
  V0: number;
  /** Índice do metal. */
  m: number;
}

export interface LinearFit {
  n: number;
  slope: number;
  intercept: number;
  /** Desvios-padrão dos coeficientes (0 com menos de 3 pontos). */
  sSlope: number;
  sIntercept: number;
  r2: number;
}

/** Mínimos quadrados y = a x + b. Devolve null com menos de 2 abscissas distintas. */
export function linearFit(xs: number[], ys: number[]): LinearFit | null {
  const n = xs.length;
  if (n < 2) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i]! - mx;
    const dy = ys[i]! - my;
    sxx += dx * dx;
    sxy += dx * dy;
    syy += dy * dy;
  }
  if (sxx <= 0 || sxx < 1e-12 * mx * mx * n) return null;
  const slope = sxy / sxx;
  const intercept = my - slope * mx;
  let sse = 0;
  for (let i = 0; i < n; i++) sse += (ys[i]! - (slope * xs[i]! + intercept)) ** 2;
  const s2 = n > 2 ? sse / (n - 2) : 0;
  const sSlope = Math.sqrt(s2 / sxx);
  const sIntercept = Math.sqrt(s2 * (1 / n + (mx * mx) / sxx));
  const r2 = syy > 0 ? 1 - sse / syy : 1;
  return { n, slope, intercept, sSlope, sIntercept, r2 };
}

export interface MillikanFit extends LinearFit {
  m: number;
  /** Constante de Planck medida (J·s). */
  h: number;
  /** Função trabalho medida (eV). */
  phi: number;
  /** Frequência de corte (Hz). */
  f0: number;
}

/** Ajuste V₀ = (h/e) f − φ/e para cada metal com dados suficientes. */
export function millikanFits(pts: Point[]): MillikanFit[] {
  const out: MillikanFit[] = [];
  for (let m = 0; m < METALS.length; m++) {
    const sel = pts.filter((p) => p.m === m);
    const fit = linearFit(
      sel.map((p) => p.f),
      sel.map((p) => p.V0),
    );
    if (!fit) continue;
    out.push({ ...fit, m, h: fit.slope * E_CHARGE, phi: -fit.intercept, f0: -fit.intercept / fit.slope });
  }
  return out;
}
