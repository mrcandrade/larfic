// Física do viscosímetro de Stokes: propriedades dos fluidos, arrasto e velocidade terminal.
import { num, type Params } from "@fisilab/core";

export const G = 9.81;
/** Altura da coluna de fluido na proveta, m. */
export const H_COL = 1.0;
/** Profundidade em que a esfera é solta (presa na pinça logo abaixo da superfície), m. */
export const X0 = 0.01;

export interface Fluid {
  value: number;
  label: string;
  /** Densidade a 20 °C, kg/m³, e coeficiente de variação com a temperatura, kg/(m³·K). */
  rho20: number;
  beta: number;
  /** Viscosidade dinâmica em Pa·s em função da temperatura em °C. */
  mu(T: number): number;
  color: string;
}

/** Lei de Vogel–Fulcher–Tammann: μ = A exp[B / (T − C)], T em °C. */
const vogel = (A: number, B: number, C: number) => (T: number) => A * Math.exp(B / (T - C));

// Ajustes feitos a dados de tabela (glicerina: Segur & Oberstar; rícino: Kaye & Laby).
export const FLUIDS: Fluid[] = [
  { value: 0, label: "Glicerina", rho20: 1261, beta: 0.65, mu: vogel(1.780847e-8, 3775.2096, -187.55913), color: "rgba(150, 190, 225, 0.40)" },
  { value: 1, label: "Óleo de rícino", rho20: 961, beta: 0.66, mu: vogel(4.33053e-5, 1186.6188, -98.26998), color: "rgba(225, 205, 120, 0.40)" },
  { value: 2, label: "Óleo de soja", rho20: 919, beta: 0.64, mu: (T) => 0.0588 * Math.exp(-0.03622 * (T - 20)), color: "rgba(235, 190, 60, 0.38)" },
  { value: 3, label: "Mel (≈ 18 % de água)", rho20: 1420, beta: 0.6, mu: vogel(1.772562e-5, 1324.2406, -79.99488), color: "rgba(205, 130, 30, 0.50)" },
];

export const MATERIALS = [
  { value: 0, label: "Aço", rho: 7850 },
  { value: 1, label: "Vidro", rho: 2500 },
  { value: 2, label: "Alumínio", rho: 2700 },
  { value: 3, label: "Chumbo", rho: 11340 },
  { value: 4, label: "Náilon", rho: 1140 },
];

export const fluidOf = (p: Params) => FLUIDS[Math.round(num(p, "fluido", 0))] ?? FLUIDS[0]!;
export const materialOf = (p: Params) => MATERIALS[Math.round(num(p, "material", 0))] ?? MATERIALS[0]!;

export const temperature = (p: Params) => num(p, "T", 20);
export const rhoFluid = (p: Params) => {
  const f = fluidOf(p);
  return f.rho20 - f.beta * (temperature(p) - 20);
};
export const muFluid = (p: Params) => fluidOf(p).mu(temperature(p));
export const rhoSphere = (p: Params) => materialOf(p).rho;
/** Diâmetro da esfera, m (o parâmetro está em mm). */
export const diam = (p: Params) => num(p, "d", 3) / 1000;
/** Diâmetro interno da proveta, m (parâmetro em mm). */
export const tubeD = (p: Params) => num(p, "D", 50) / 1000;

/** Profundidades das marcas A e B, m. */
export function marks(p: Params): { a: number; b: number; L: number } {
  const a = Math.min(Math.max(num(p, "yA", 0.2), 0.03), H_COL - 0.1);
  const b = Math.min(a + Math.max(num(p, "L", 0.5), 0.02), H_COL - 0.04);
  return { a, b, L: b - a };
}

/** Fator de Ladenburg (efeito da parede da proveta) para d/D: 1 + 2,4 r/R. */
export const ladenburg = (p: Params) => 1 + (2.4 * diam(p)) / tubeD(p);
const wallFactor = (p: Params) => (num(p, "parede", 1) > 0.5 ? ladenburg(p) : 1);

/** Re a partir do qual a correção de Schiller–Naumann passa a ser maior que a de Oseen. */
const RE_X = 0.8 ** (1 / 0.313);

/**
 * Razão entre o arrasto real e o de Stokes (3πμdv) em função de Re = ρ v d / μ.
 * Oseen (1 + 3Re/16) para Re pequeno, Schiller–Naumann (1 + 0,15 Re^0,687) até Re ≈ 1000
 * e coeficiente de arrasto constante (Cd = 0,44) acima disso. A função é contínua.
 */
export function dragFactor(Re: number): number {
  const a = Re < RE_X ? 1 + (3 * Re) / 16 : 1 + 0.15 * Re ** 0.687;
  return Math.max(a, (0.44 * Re) / 24);
}

export const reynolds = (p: Params, v: number) => (rhoFluid(p) * Math.abs(v) * diam(p)) / muFluid(p);

/** Força de arrasto (sinal oposto a v), N. */
export function dragForce(p: Params, v: number): number {
  const mu = muFluid(p), d = diam(p);
  return -3 * Math.PI * mu * d * v * dragFactor(reynolds(p, v)) * wallFactor(p);
}

export const volume = (p: Params) => (Math.PI * diam(p) ** 3) / 6;
/** Peso menos empuxo (positivo para baixo), N. */
export const netWeight = (p: Params) => (rhoSphere(p) - rhoFluid(p)) * volume(p) * G;
/** Massa efetiva: esfera + metade da massa de fluido deslocado (massa adicional). */
export const effMass = (p: Params) => (rhoSphere(p) + 0.5 * rhoFluid(p)) * volume(p);

/** Velocidade de Stokes ideal (meio infinito, Re → 0), m/s. Negativa se a esfera flutua. */
export const stokesVelocity = (p: Params) => (2 * (rhoSphere(p) - rhoFluid(p)) * G * (diam(p) / 2) ** 2) / (9 * muFluid(p));

/** Velocidade terminal com o arrasto real (Re finito e parede, se ligada), por bissecção. */
export function terminalVelocity(p: Params): number {
  const W = netWeight(p);
  if (W === 0) return 0;
  const s = Math.sign(W);
  let lo = 0, hi = Math.abs(stokesVelocity(p)) * 1.0001;
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    if (Math.abs(dragForce(p, mid)) < Math.abs(W)) lo = mid;
    else hi = mid;
  }
  return s * (lo + hi) / 2;
}

/** Aceleração da esfera (positiva para baixo). */
export const accel = (p: Params, v: number) => (netWeight(p) + dragForce(p, v)) / effMass(p);

/** Constante de tempo da aproximação da velocidade terminal (regime de Stokes), s. */
export const relaxTime = (p: Params) => effMass(p) / (3 * Math.PI * muFluid(p) * diam(p) * wallFactor(p));
