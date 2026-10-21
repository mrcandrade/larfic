/** Difração de elétrons: Debye–Scherrer em grafite e Davisson–Germer em níquel. */

export const H = 6.62607015e-34;
export const E_CHARGE = 1.602176634e-19;
export const M_E = 9.1093837015e-31;
export const C_LIGHT = 299792458;

/** λ de de Broglie (m) para elétrons acelerados por V volts (relativístico). */
export function wavelength(V: number): number {
  const K = E_CHARGE * V;
  return H / Math.sqrt(2 * M_E * K * (1 + K / (2 * M_E * C_LIGHT * C_LIGHT)));
}

/** Distância grafite–tela (m) e raio útil da tela (m). */
export const L_SCREEN = 0.135;
export const SCREEN_R = 0.05;

export interface Family {
  hk: string;
  /** Distância interplanar (m). */
  d: number;
  /** Intensidade relativa. */
  I: number;
  /** Ângulos azimutais das manchas no monocristal (graus). */
  spots: number[];
}

const every60 = (a: number) => [0, 60, 120, 180, 240, 300].map((k) => k + a);

/** Reflexões (hk0) da rede hexagonal do grafite, a = 0,246 nm. */
export const GRAPHITE: Family[] = [
  { hk: "10", d: 0.213e-9, I: 1, spots: every60(0) },
  { hk: "11", d: 0.123e-9, I: 0.75, spots: every60(30) },
  { hk: "20", d: 0.1065e-9, I: 0.15, spots: every60(0) },
  { hk: "21", d: 0.0805e-9, I: 0.12, spots: [...every60(19.1), ...every60(-19.1)] },
];

/** Ângulo de Bragg θ (rad): 2d sen θ = λ. */
export const braggTheta = (lambda: number, d: number) => Math.asin(Math.min(1, lambda / (2 * d)));
/** Raio do anel numa tela plana a distância L: r = L tan 2θ. */
export const ringRadius = (lambda: number, d: number, L = L_SCREEN) => L * Math.tan(2 * braggTheta(lambda, d));
/** d a partir do raio medido (exato para tela plana). */
export const dFromRadius = (lambda: number, r: number, L = L_SCREEN) => (r > 0 ? lambda / (2 * Math.sin(Math.atan(r / L) / 2)) : 0);
/** Aproximação de ângulos pequenos: d ≈ 2Lλ/r. */
export const dSmallAngle = (lambda: number, r: number, L = L_SCREEN) => (r > 0 ? (2 * L * lambda) / r : 0);

/** Largura (desvio padrão, m) do anel: feixe de 0,4 mm e cristalitos de 5 nm (Scherrer). */
export const ringSigma = (lambda: number, L = L_SCREEN) => 4e-4 + (L * lambda) / 5e-9;

// ---------------- Davisson–Germer ----------------

/** Espaçamento entre fileiras de átomos na face (111) do níquel (m) e entre planos (111) (m). */
export const D_NI = 0.215e-9;
export const C_NI = 0.203e-9;
const N_ROWS = 7;
const M_LAYERS = 3;

const gratingFactor = (x: number, N: number) => {
  const s = Math.sin(Math.PI * x);
  if (Math.abs(s) < 1e-9) return 1;
  return (Math.sin(N * Math.PI * x) / (N * s)) ** 2;
};

/** Ângulo (graus) previsto pela rede de superfície: D sen φ = λ. */
export const dgAngle = (E: number) => {
  const s = wavelength(E) / D_NI;
  return s <= 1 ? (Math.asin(s) * 180) / Math.PI : NaN;
};

/**
 * Corrente no coletor (u.a.) para energia E (eV) e ângulo φ (graus, a partir
 * do feixe incidente normal): fundo difuso + interferência da rede de
 * superfície (D sen φ = nλ) modulada pela condição entre camadas
 * (c(1 + cos φ) = mλ), que só se cumpre junto perto de 54 eV.
 */
export function dgIntensity(E: number, phiDeg: number): number {
  const lam = wavelength(E);
  const phi = (phiDeg * Math.PI) / 180;
  const surf = gratingFactor((D_NI * Math.sin(phi)) / lam, N_ROWS);
  const depth = gratingFactor((C_NI * (1 + Math.cos(phi))) / lam, M_LAYERS);
  const bg = 0.55 * (0.35 + 0.65 * Math.cos(phi)) * (1 + 40 / E) * 0.5;
  const peak = phiDeg > 8 ? 1.1 * surf * depth : 0;
  return bg + peak;
}
