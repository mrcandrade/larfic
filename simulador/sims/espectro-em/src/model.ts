// Física da onda EM plana, da régua do espectro, do dipolo oscilante e do capacitor
// carregando (fluxo de Poynting entrando pela borda). Tudo em SI.
import { EPS0 } from "@fisilab/core";

export const C = 299_792_458;
export const MU0 = 1 / (EPS0 * C * C);
export const H_PLANCK = 6.62607015e-34;
export const EV = 1.602176634e-19;

export const frequency = (lambda: number) => C / lambda;
export const photonEnergyJ = (lambda: number) => (H_PLANCK * C) / lambda;
export const photonEnergyEV = (lambda: number) => photonEnergyJ(lambda) / EV;

/** Amplitude do campo elétrico para uma intensidade média I: I = ½ c ε₀ E₀². */
export const E0Of = (I: number) => Math.sqrt((2 * I) / (C * EPS0));
export const B0Of = (I: number) => E0Of(I) / C;
/** Densidade média de energia u = I/c. */
export const energyDensity = (I: number) => I / C;
/** Pressão de radiação: I/c (absorção total) ou 2I/c (reflexão total). */
export const radiationPressure = (I: number, reflect: boolean) => ((reflect ? 2 : 1) * I) / C;
/** Fluxo de fótons (fótons por m² por s). */
export const photonFlux = (I: number, lambda: number) => I / photonEnergyJ(lambda);
/** Vetor de Poynting instantâneo num ponto de fase φ = kx − ωt: S = E₀B₀cos²φ/μ₀. */
export const poyntingInst = (I: number, phase: number) => 2 * I * Math.cos(phase) ** 2;

export interface Band {
  name: string;
  /** Limites de λ (m). */
  lo: number;
  hi: number;
  color: string;
}

export const BANDS: Band[] = [
  { name: "Raios gama", lo: 1e-16, hi: 1e-11, color: "#8a63d2" },
  { name: "Raios X", lo: 1e-11, hi: 1e-8, color: "#5b7fd6" },
  { name: "Ultravioleta", lo: 1e-8, hi: 380e-9, color: "#7a5cc8" },
  { name: "Luz visível", lo: 380e-9, hi: 750e-9, color: "#19a979" },
  { name: "Infravermelho", lo: 750e-9, hi: 1e-3, color: "#d9453b" },
  { name: "Micro-ondas", lo: 1e-3, hi: 0.3, color: "#e8743b" },
  { name: "Ondas de rádio", lo: 0.3, hi: 1e6, color: "#c9a227" },
];

export const bandOf = (lambda: number): Band => BANDS.find((b) => lambda >= b.lo && lambda < b.hi) ?? (lambda < 1e-11 ? BANDS[0]! : BANDS[BANDS.length - 1]!);

/** Exemplos do cotidiano na régua: [λ (m), rótulo]. */
export const EXAMPLES: [number, string][] = [
  [2e-12, "decaimento nuclear"],
  [5e-11, "raio X odontológico"],
  [254e-9, "lâmpada germicida"],
  [550e-9, "luz verde"],
  [940e-9, "controle remoto"],
  [1e-5, "calor do corpo"],
  [0.122, "micro-ondas / Wi-Fi"],
  [3, "rádio FM"],
  [300, "rádio AM"],
];

/** Nome da cor para λ visível (nm). */
export function colorName(nm: number): string {
  if (nm < 450) return "violeta";
  if (nm < 490) return "azul";
  if (nm < 520) return "ciano";
  if (nm < 565) return "verde";
  if (nm < 590) return "amarelo";
  if (nm < 625) return "laranja";
  return "vermelho";
}

/** Cor RGB aproximada (0–255) de um comprimento de onda visível em nm. */
export function wavelengthRGB(nm: number): [number, number, number] {
  let r = 0, g = 0, b = 0;
  if (nm >= 380 && nm < 440) [r, g, b] = [(440 - nm) / 60, 0, 1];
  else if (nm < 490) [r, g, b] = [0, (nm - 440) / 50, 1];
  else if (nm < 510) [r, g, b] = [0, 1, (510 - nm) / 20];
  else if (nm < 580) [r, g, b] = [(nm - 510) / 70, 1, 0];
  else if (nm < 645) [r, g, b] = [1, (645 - nm) / 65, 0];
  else if (nm <= 750) [r, g, b] = [1, 0, 0];
  const f = nm < 420 ? 0.3 + (0.7 * (nm - 380)) / 40 : nm > 700 ? 0.3 + (0.7 * (750 - nm)) / 50 : 1;
  return [Math.round(255 * r * f), Math.round(255 * g * f), Math.round(255 * b * f)];
}

// ---------------------------------------------------------------------------
// Dipolo oscilante
// ---------------------------------------------------------------------------

/** Potência total irradiada por um dipolo p(t) = p₀ cos ωt (média temporal). */
export const dipolePower = (p0: number, lambda: number) => {
  const w = (2 * Math.PI * C) / lambda;
  return (p0 * p0 * w ** 4) / (12 * Math.PI * EPS0 * C ** 3);
};

/** Intensidade média na zona de radiação: p₀²ω⁴ sen²θ / (32π²ε₀c³r²). */
export const dipoleIntensity = (p0: number, lambda: number, r: number, theta: number) => {
  const w = (2 * Math.PI * C) / lambda;
  return (p0 * p0 * w ** 4 * Math.sin(theta) ** 2) / (32 * Math.PI ** 2 * EPS0 * C ** 3 * r * r);
};

// ---------------------------------------------------------------------------
// Capacitor de placas circulares carregando por um resistor
// ---------------------------------------------------------------------------

export interface Cap {
  /** Raio das placas (m). */
  a: number;
  /** Separação (m). */
  d: number;
  V0: number;
  /** Resistência em série (Ω). */
  R: number;
}

export const capacitance = (c: Cap) => (EPS0 * Math.PI * c.a * c.a) / c.d;
export const tauRC = (c: Cap) => c.R * capacitance(c);
export const capVoltage = (c: Cap, t: number) => c.V0 * (1 - Math.exp(-t / tauRC(c)));
export const capField = (c: Cap, t: number) => capVoltage(c, t) / c.d;
export const capDEdt = (c: Cap, t: number) => (c.V0 / c.d / tauRC(c)) * Math.exp(-t / tauRC(c));
/** B a uma distância r ≤ a do eixo (corrente de deslocamento): B = μ₀ε₀ (r/2) dE/dt. */
export const capB = (c: Cap, t: number, r: number) => (MU0 * EPS0 * Math.min(r, c.a) * capDEdt(c, t) * (r <= c.a ? 1 : c.a / r)) / 2;
/** |S| na borda r = a, apontando para dentro: S = E B / μ₀. */
export const capSEdge = (c: Cap, t: number) => (capField(c, t) * capB(c, t, c.a)) / MU0;
/** Potência que entra pela superfície lateral: S · 2πa d. */
export const capPowerIn = (c: Cap, t: number) => capSEdge(c, t) * 2 * Math.PI * c.a * c.d;
/** Energia armazenada no campo: U = ½ ε₀ E² (πa²d). */
export const capEnergy = (c: Cap, t: number) => 0.5 * EPS0 * capField(c, t) ** 2 * Math.PI * c.a * c.a * c.d;
