// Propriedades dos líquidos e modelos do anel de Du Noüy e da ascensão capilar.
import { num, type Params } from "@fisilab/core";

export const G = 9.81;

export interface Liquid {
  value: number;
  label: string;
  /** Tensão superficial a 20 °C (N/m) e sua variação com a temperatura (N/(m·K)). */
  g20: number;
  dg: number;
  /** Densidade a 20 °C (kg/m³) e coeficiente de variação (kg/(m³·K)). */
  rho20: number;
  beta: number;
  /** Viscosidade dinâmica (Pa·s) em função de T (°C). */
  mu(T: number): number;
  color: string;
}

export const LIQUIDS: Liquid[] = [
  { value: 0, label: "Água destilada", g20: 0.0728, dg: -1.55e-4, rho20: 998.2, beta: 0.21, mu: (T) => 1.002e-3 * Math.exp(-0.0214 * (T - 20)), color: "rgba(90, 160, 230, 0.35)" },
  { value: 1, label: "Etanol", g20: 0.02239, dg: -8.32e-5, rho20: 789.4, beta: 0.85, mu: (T) => 1.2e-3 * Math.exp(-0.017 * (T - 20)), color: "rgba(160, 200, 230, 0.30)" },
  { value: 2, label: "Glicerina", g20: 0.0634, dg: -6.0e-5, rho20: 1261, beta: 0.65, mu: (T) => 1.780847e-8 * Math.exp(3775.2096 / (T + 187.55913)), color: "rgba(150, 190, 225, 0.45)" },
  { value: 3, label: "Água com sabão", g20: 0.03, dg: -1.0e-4, rho20: 1000, beta: 0.21, mu: (T) => 1.0e-3 * Math.exp(-0.0214 * (T - 20)), color: "rgba(170, 140, 230, 0.32)" },
  { value: 4, label: "Mercúrio", g20: 0.4855, dg: -2.0e-4, rho20: 13546, beta: 2.45, mu: () => 1.55e-3, color: "rgba(160, 165, 175, 0.85)" },
];

export const liquidOf = (p: Params) => LIQUIDS[Math.round(num(p, "liquido", 0))] ?? LIQUIDS[0]!;
export const temp = (p: Params) => num(p, "T", 20);
export const gamma = (p: Params) => {
  const l = liquidOf(p);
  return l.g20 + l.dg * (temp(p) - 20);
};
export const rho = (p: Params) => {
  const l = liquidOf(p);
  return l.rho20 - l.beta * (temp(p) - 20);
};
export const mu = (p: Params) => liquidOf(p).mu(temp(p));
export const theta = (p: Params) => (num(p, "theta", 0) * Math.PI) / 180;
/** Comprimento capilar √(γ/ρg), m. */
export const capLength = (p: Params) => Math.sqrt(gamma(p) / (rho(p) * G));

// ---------- Anel de Du Noüy ----------
/** Raio do fio de platina–irídio do anel e massa do estribo que o prende, SI. */
export const WIRE_R = 0.2e-3;
export const RHO_PT = 21450;
export const HANGER_M = 0.8e-3;
/** Altura inicial do anel (imerso), m. */
export const Z0 = -2e-3;

export const ringR = (p: Params) => num(p, "R", 9.55) / 1000;
export const wireVolume = (p: Params) => 2 * Math.PI * ringR(p) * Math.PI * WIRE_R ** 2;
/** Peso do anel com o estribo (leitura do dinamômetro com o anel no ar), N. */
export const ringWeight = (p: Params) => (HANGER_M + wireVolume(p) * RHO_PT) * G;
/** Força máxima ideal do filme: 4πRγ cos θ (perímetro interno + externo). */
export const filmMax = (p: Params) => 4 * Math.PI * ringR(p) * gamma(p) * Math.max(0, Math.cos(theta(p)));
/** Altura do pico de força e altura de ruptura do filme, m. */
export const zPeak = (p: Params) => capLength(p);
export const zBreak = (p: Params) => 1.25 * capLength(p);
/** Fim da corrida do anel: 3 mm acima da ruptura. */
export const zEnd = (p: Params) => zBreak(p) + 3e-3;

/** Força do filme (lamela) em função da altura z do anel acima da superfície livre. */
export function filmForce(p: Params, z: number, broken: boolean): number {
  if (broken || z <= 0) return 0;
  const u = z / zPeak(p);
  return filmMax(p) * Math.max(0, u * (2 - u));
}

/** Empuxo sobre o fio quando ele está total ou parcialmente imerso, N. */
export function buoyancy(p: Params, z: number): number {
  const f = Math.min(1, Math.max(0, (WIRE_R - z) / (2 * WIRE_R)));
  return f * wireVolume(p) * rho(p) * G;
}

/** Leitura do dinamômetro, N. */
export const ringForce = (p: Params, z: number, broken: boolean) => ringWeight(p) - buoyancy(p, z) + filmForce(p, z, broken);

// ---------- Capilares ----------
/** Raios dos tubos de comparação (m); o tubo selecionado tem o raio do parâmetro r. */
export const TUBES = [0.2e-3, 0.4e-3, 0.8e-3, 1.2e-3];
export const tubeR = (p: Params) => num(p, "r", 0.5) / 1000;
/** Lei de Jurin: h = 2γ cos θ / (ρ g r). */
export const jurin = (p: Params, r: number) => (2 * gamma(p) * Math.cos(theta(p))) / (rho(p) * G * r);

/**
 * Um passo da dinâmica de Lucas–Washburn com gravidade:
 * 8μ ℓ dh/dt = r² (2γcosθ/r − ρ g h), com ℓ = max(|h|, r) o comprimento da coluna.
 * Semi-implícito em h (estável para qualquer passo).
 */
export function capillaryStep(p: Params, r: number, h: number, dt: number): number {
  const A = (2 * gamma(p) * Math.cos(theta(p))) / r;
  const ell = Math.max(Math.abs(h), r);
  const c = (8 * mu(p) * ell) / dt;
  return (c * h + r * r * A) / (c + r * r * rho(p) * G);
}
