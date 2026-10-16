/** Espectros atômicos (emissão e absorção), rede de difração e equações de taxa do laser. */

/** hc em eV·nm. */
export const HC_EV_NM = 1239.84198;
/** Constante de Boltzmann em eV/K. */
export const KB_EV = 8.617333262e-5;

export interface Level {
  /** Energia acima do fundamental (eV). */
  E: number;
  label: string;
}
export interface Line {
  /** λ no ar (nm), valores tabelados. */
  nm: number;
  /** Intensidade relativa de emissão (usada também como força da absorção). */
  I: number;
  up: number;
  low: number;
}
export interface Gas {
  name: string;
  levels: Level[];
  lines: Line[];
}

const bohr = (n: number) => 13.6057 * (1 - 1 / (n * n));

export const GASES: Gas[] = [
  {
    name: "Hidrogênio",
    levels: [1, 2, 3, 4, 5, 6].map((n) => ({ E: bohr(n), label: `n = ${n}` })),
    lines: [
      { nm: 656.28, I: 1, up: 2, low: 1 },
      { nm: 486.13, I: 0.36, up: 3, low: 1 },
      { nm: 434.05, I: 0.18, up: 4, low: 1 },
      { nm: 410.17, I: 0.1, up: 5, low: 1 },
    ],
  },
  {
    name: "Hélio",
    levels: [
      { E: 0, label: "1¹S" },
      { E: 19.82, label: "2³S" },
      { E: 20.616, label: "2¹S" },
      { E: 20.964, label: "2³P" },
      { E: 21.218, label: "2¹P" },
      { E: 22.718, label: "3³S" },
      { E: 23.074, label: "3³D, 3¹D" },
      { E: 23.087, label: "3¹P" },
      { E: 23.594, label: "4³S" },
      { E: 23.736, label: "4³D, 4¹D" },
    ],
    lines: [
      { nm: 706.52, I: 0.35, up: 5, low: 3 },
      { nm: 667.82, I: 0.45, up: 6, low: 4 },
      { nm: 587.56, I: 1, up: 6, low: 3 },
      { nm: 501.57, I: 0.35, up: 7, low: 2 },
      { nm: 492.19, I: 0.15, up: 9, low: 4 },
      { nm: 471.31, I: 0.12, up: 8, low: 3 },
      { nm: 447.15, I: 0.4, up: 9, low: 3 },
    ],
  },
  {
    name: "Sódio",
    levels: [
      { E: 0, label: "3s" },
      { E: 2.102, label: "3p₁/₂" },
      { E: 2.104, label: "3p₃/₂" },
      { E: 4.116, label: "5s" },
      { E: 4.284, label: "4d" },
      { E: 4.592, label: "5d" },
    ],
    lines: [
      { nm: 588.995, I: 1, up: 2, low: 0 },
      { nm: 589.592, I: 0.5, up: 1, low: 0 },
      { nm: 568.82, I: 0.08, up: 4, low: 2 },
      { nm: 615.42, I: 0.06, up: 3, low: 2 },
      { nm: 498.28, I: 0.04, up: 5, low: 2 },
    ],
  },
  {
    name: "Mercúrio",
    levels: [
      { E: 0, label: "6¹S₀" },
      { E: 4.667, label: "6³P₀" },
      { E: 4.886, label: "6³P₁" },
      { E: 5.461, label: "6³P₂" },
      { E: 6.704, label: "6¹P₁" },
      { E: 7.73, label: "7³S₁" },
      { E: 8.848, label: "6¹D₂, 6³D₂" },
    ],
    lines: [
      { nm: 404.66, I: 0.4, up: 5, low: 1 },
      { nm: 435.83, I: 0.9, up: 5, low: 2 },
      { nm: 546.07, I: 1, up: 5, low: 3 },
      { nm: 576.96, I: 0.3, up: 6, low: 4 },
      { nm: 579.07, I: 0.32, up: 6, low: 4 },
    ],
  },
];

export const gasOf = (i: number) => GASES[Math.round(i)] ?? GASES[0]!;

/** Comprimento de onda da transição n_i → n_f do hidrogênio (Bohr, no vácuo). */
export const hydrogenNm = (ni: number, nf: number) => HC_EV_NM / (13.6057 * (1 / (nf * nf) - 1 / (ni * ni)));

// ---------- rede de difração ----------

/** Espaçamento da rede (nm) para N linhas por mm. */
export const gratingD = (N: number) => 1e6 / N;
/** Ângulo (rad) da ordem m para λ; NaN se não existe. */
export function gratingAngle(nm: number, N: number, m: number): number {
  const s = (m * nm) / gratingD(N);
  return Math.abs(s) <= 1 ? Math.asin(s) : NaN;
}
/** λ medido na luneta: λ = d sen θ / m. */
export const gratingLambda = (theta: number, N: number, m: number) => (gratingD(N) * Math.sin(theta)) / m;

// ---------- absorção ----------

/** Fator de escala da profundidade óptica (coluna de gás). */
export const TAU_SCALE = 1e6;

/** Profundidade óptica no centro de uma linha: população do nível inferior (Boltzmann) × força × coluna. */
export function lineDepth(gas: Gas, line: Line, T: number, column: number): number {
  const Elow = gas.levels[line.low]!.E;
  return TAU_SCALE * column * line.I * Math.exp(-Elow / (KB_EV * T));
}

/** Meia largura das linhas desenhadas (nm, perfil gaussiano). */
export const LINE_W = 0.6;

/** Transmissão de luz branca através do gás em λ. */
export function transmission(gas: Gas, nm: number, T: number, column: number): number {
  let tau = 0;
  for (const l of gas.lines) tau += lineDepth(gas, l, T, column) * Math.exp(-0.5 * ((nm - l.nm) / LINE_W) ** 2);
  return Math.exp(-tau);
}

/** Emissão (intensidade relativa) em λ, linhas gaussianas. */
export function emission(gas: Gas, nm: number): number {
  let s = 0;
  for (const l of gas.lines) s += l.I * Math.exp(-0.5 * ((nm - l.nm) / LINE_W) ** 2);
  return s;
}

/** Razão de Boltzmann N₂/N₁ em equilíbrio para uma transição de λ (nm) a T. */
export const boltzmannRatio = (nm: number, T: number) => Math.exp(-HC_EV_NM / nm / (KB_EV * T));

// ---------- laser: equações de taxa ----------

/** Tempos (ms): nível superior (metaestável), bombeio → superior, inferior → fundamental. */
export const TAU2 = 1;
export const TAU32 = 0.005;
export const TAU10 = 0.02;
/** Coeficiente de ganho (por ms, por unidade de inversão e de densidade de fótons). */
export const KGAIN = 500;
/** Tempo de ida e volta na cavidade (ms, escalado) e fração da espontânea que cai no modo. */
export const T_RT = 0.002;
export const BETA_SP = 1e-4;

/** Tempo de vida do fóton na cavidade (ms) para refletividade R do espelho de saída. */
export const photonLifetime = (R: number) => T_RT / -Math.log(R);
/** Inversão de limiar: ganho = perdas. */
export const thresholdInversion = (R: number) => 1 / (KGAIN * photonLifetime(R));

/**
 * Bombeio de limiar (por ms), estado estacionário sem fótons.
 * 4 níveis: N₂ ≈ ΔN_th, com N₁ ≈ N₂τ₁₀/τ₂ e N₀ ≈ 1 − N₂.
 * 3 níveis: N₂ − N₀ = ΔN_th com N₀ + N₂ ≈ 1.
 */
export function thresholdPump(R: number, levels: 3 | 4): number {
  const dn = thresholdInversion(R);
  if (levels === 4) {
    const N2 = dn / (1 - TAU10 / TAU2);
    const N1 = (N2 * TAU10) / TAU2;
    const N0 = 1 - N2 - N1;
    return N2 / TAU2 / (N0 - N2 * TAU32 / TAU2);
  }
  const N2 = (1 + dn) / 2;
  const N0 = 1 - N2;
  return N2 / TAU2 / (N0 - (N2 * TAU32) / TAU2);
}

/**
 * Estado y = [N0, N1, N2, N3, q]: populações (fração dos átomos) e densidade de
 * fótons no modo (por átomo). No sistema de 3 níveis o nível inferior do laser
 * é o fundamental e N1 fica nulo.
 */
export function laserDerivs(y: number[], Wp: number, R: number, levels: 3 | 4): number[] {
  const [N0 = 0, N1 = 0, N2 = 0, N3 = 0, q = 0] = y;
  const tc = photonLifetime(R);
  const Nl = levels === 4 ? N1 : N0;
  const stim = KGAIN * q * (N2 - Nl);
  const pump = Wp * (N0 - N3);
  const dN3 = pump - N3 / TAU32;
  const dN2 = N3 / TAU32 - N2 / TAU2 - stim;
  const dq = stim - q / tc + (BETA_SP * N2) / TAU2;
  if (levels === 4) {
    const dN1 = N2 / TAU2 + stim - N1 / TAU10;
    const dN0 = N1 / TAU10 - pump;
    return [dN0, dN1, dN2, dN3, dq];
  }
  const dN0 = N2 / TAU2 + stim - pump;
  return [dN0, 0, dN2, dN3, dq];
}

/** Potência de saída (u.a.): fótons que escapam pelo espelho por ms. */
export const outputPower = (q: number, R: number) => (q * -Math.log(R)) / T_RT;
