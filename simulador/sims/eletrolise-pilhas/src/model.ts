/** Eletroquímica: dissociação, condutividade, Faraday, Nernst, chumbo-ácido e associação de pilhas. */

export const F = 96485.33212;
export const R_GAS = 8.314462618;
export const T25 = 298.15;
export const E_CHARGE = 1.602176634e-19;

// ---------------------------------------------------------------------------
// Dissociação e condutividade
// ---------------------------------------------------------------------------

export interface Solute {
  name: string;
  /** Constante de ionização (Infinity = eletrólito forte, 0 = não eletrólito). */
  Ka: number;
  cation: string;
  anion: string;
  /** Condutividades molares iônicas limite (S·cm²/mol) do cátion e do ânion. */
  lp: number;
  lm: number;
  /** Coeficiente empírico de Λ = Λ₀/(1 + k√c) para fortes. */
  k: number;
}

export const SOLUTES: Solute[] = [
  { name: "Sacarose (não eletrólito)", Ka: 0, cation: "", anion: "", lp: 0, lm: 0, k: 0 },
  { name: "Ácido acético (fraco)", Ka: 1.8e-5, cation: "H⁺", anion: "CH₃COO⁻", lp: 349.8, lm: 40.9, k: 0 },
  { name: "NaCl (forte)", Ka: Infinity, cation: "Na⁺", anion: "Cl⁻", lp: 50.1, lm: 76.3, k: 0.585 },
  { name: "HCl (forte)", Ka: Infinity, cation: "H⁺", anion: "Cl⁻", lp: 349.8, lm: 76.3, k: 0.283 },
  { name: "CuSO₄ (forte, íons 2+/2−)", Ka: Infinity, cation: "Cu²⁺", anion: "SO₄²⁻", lp: 107.2, lm: 160.0, k: 6.1 },
];

/** Grau de dissociação pela lei de diluição de Ostwald: Ka = α²c/(1 − α). */
export function alpha(s: Solute, c: number): number {
  if (s.Ka === 0 || c <= 0) return 0;
  if (!Number.isFinite(s.Ka)) return 1;
  return (-s.Ka + Math.sqrt(s.Ka * s.Ka + 4 * s.Ka * c)) / (2 * c);
}

/** Condutividade molar Λ (S·cm²/mol). */
export function molarConductivity(s: Solute, c: number): number {
  const L0 = s.lp + s.lm;
  if (!Number.isFinite(s.Ka)) return L0 / (1 + s.k * Math.sqrt(c));
  return alpha(s, c) * L0;
}

/** Condutividade κ (S/m) para c em mol/L: κ = Λ c · 0,1. */
export const conductivity = (s: Solute, c: number) => molarConductivity(s, c) * c * 0.1;

/** Cuba de condutividade: eletrodos de 4 cm² a 2 cm (constante 50 m⁻¹). */
export const CELL_CONST = 50;
export const LAMP_R = 24;
export const LAMP_V = 12;
export const cellResistance = (kappa: number) => (kappa > 0 ? CELL_CONST / kappa : Infinity);

// ---------------------------------------------------------------------------
// Eletrólise
// ---------------------------------------------------------------------------

export interface Electrolysis {
  name: string;
  /** Tensão de decomposição prática (V). */
  Edec: number;
  cathode: { product: string; M: number; n: number; gas: boolean };
  anode: { product: string; M: number; n: number; gas: boolean; dissolves?: boolean };
}

export const ELECTROLYSES: Electrolysis[] = [
  { name: "CuSO₄ com eletrodos de cobre (galvanoplastia)", Edec: 0.05, cathode: { product: "Cu", M: 63.546, n: 2, gas: false }, anode: { product: "Cu (dissolve)", M: 63.546, n: 2, gas: false, dissolves: true } },
  { name: "AgNO₃ com eletrodos de prata", Edec: 0.05, cathode: { product: "Ag", M: 107.868, n: 1, gas: false }, anode: { product: "Ag (dissolve)", M: 107.868, n: 1, gas: false, dissolves: true } },
  { name: "Água acidulada (H₂SO₄) com platina", Edec: 1.7, cathode: { product: "H₂", M: 2.016, n: 2, gas: true }, anode: { product: "O₂", M: 31.998, n: 4, gas: true } },
  { name: "Salmoura (NaCl) com grafite", Edec: 2.2, cathode: { product: "H₂", M: 2.016, n: 2, gas: true }, anode: { product: "Cl₂", M: 70.9, n: 2, gas: true } },
  { name: "CuSO₄ com grafite", Edec: 1.4, cathode: { product: "Cu", M: 63.546, n: 2, gas: false }, anode: { product: "O₂", M: 31.998, n: 4, gas: true } },
];

/** Corrente na cuba: I = (V − E_dec)/R, nula abaixo da tensão de decomposição. */
export const electrolysisCurrent = (V: number, Edec: number, R: number) => Math.max(0, (V - Edec) / R);
/** Primeira lei de Faraday: m = M Q/(n F). */
export const faradayMass = (M: number, n: number, Q: number) => (M * Q) / (n * F);
/** Volume de gás (m³) a T e p: V = (Q/nF) R T/p. */
export const gasVolume = (n: number, Q: number, T = T25, p = 101325) => ((Q / (n * F)) * R_GAS * T) / p;

// ---------------------------------------------------------------------------
// Pilhas: potenciais padrão e Nernst
// ---------------------------------------------------------------------------

export const METALS = [
  { name: "Mg", ion: "Mg²⁺", E0: -2.37, n: 2, M: 24.305 },
  { name: "Al", ion: "Al³⁺", E0: -1.66, n: 3, M: 26.982 },
  { name: "Zn", ion: "Zn²⁺", E0: -0.76, n: 2, M: 65.38 },
  { name: "Fe", ion: "Fe²⁺", E0: -0.44, n: 2, M: 55.845 },
  { name: "Ni", ion: "Ni²⁺", E0: -0.25, n: 2, M: 58.693 },
  { name: "Pb", ion: "Pb²⁺", E0: -0.13, n: 2, M: 207.2 },
  { name: "Cu", ion: "Cu²⁺", E0: 0.34, n: 2, M: 63.546 },
  { name: "Ag", ion: "Ag⁺", E0: 0.8, n: 1, M: 107.868 },
];

/** Potencial de eletrodo pela equação de Nernst: E = E° + (RT/nF) ln[M^{n+}]. */
export const electrodePotential = (E0: number, n: number, c: number, T = T25) => E0 + ((R_GAS * T) / (n * F)) * Math.log(Math.max(c, 1e-30));

/** FEM da pilha: cátodo − ânodo. */
export function cellEmf(a: { E0: number; n: number }, ca: number, c: { E0: number; n: number }, cc: number, T = T25): number {
  return electrodePotential(c.E0, c.n, cc, T) - electrodePotential(a.E0, a.n, ca, T);
}

// ---------------------------------------------------------------------------
// Chumbo-ácido (bateria de 6 células)
// ---------------------------------------------------------------------------

export const CELLS = 6;
/** Densidade do eletrólito (g/cm³) com o estado de carga. */
export const acidDensity = (soc: number) => 1.1 + 0.18 * soc;
/** Regra prática: FEM por célula ≈ densidade + 0,84. */
export const cellOcv = (soc: number) => acidDensity(soc) + 0.84;
export const batteryOcv = (soc: number) => CELLS * cellOcv(soc);
/** Resistência interna (Ω), maior quando descarregada. */
export const batteryR = (soc: number) => 0.02 * (1 + 2 * (1 - soc));
/** Força contraeletromotriz extra na carga (polarização e gaseificação perto do fim). */
export const chargeBackEmf = (soc: number) => batteryOcv(soc) + CELLS * 0.3 * Math.max(0, (soc - 0.75) / 0.25) ** 2;
export const PEUKERT = 1.2;
export const CHARGE_EFF = 0.9;
export const CUTOFF = 10.5;

/** Corrente de descarga num resistor R (A). */
export function dischargeCurrent(soc: number, Rl: number): number {
  return batteryOcv(soc) / (Rl + batteryR(soc));
}
/** Capacidade efetiva de Peukert a corrente I, para capacidade nominal C (Ah, regime de 20 h). */
export const peukertCapacity = (C: number, I: number) => C * ((C / 20) / I) ** (PEUKERT - 1);

// ---------------------------------------------------------------------------
// Associação de pilhas
// ---------------------------------------------------------------------------

/** FEM e resistência equivalentes de Np ramos com Ns pilhas em série (k invertidas por ramo). */
export function association(Ns: number, Np: number, E: number, r: number, inverted = 0) {
  return { E: (Ns - 2 * inverted) * E, r: (Ns * r) / Np };
}
