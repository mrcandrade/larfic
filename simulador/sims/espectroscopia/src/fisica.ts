// Física do espectroscópio: lâmpadas espectrais, rede de difração e prisma (Cauchy).

const D = Math.PI / 180;

export interface Line {
  /** Comprimento de onda no ar (nm). */
  nm: number;
  /** Intensidade relativa aproximada (linha mais forte da lâmpada = 1). */
  I: number;
  /** Nível superior da transição de Balmer (só hidrogênio). */
  n?: number;
}

/** Linhas visíveis reais (NIST, comprimentos de onda no ar; intensidades relativas aproximadas). */
export const LAMPS: { id: string; label: string; lines: Line[] }[] = [
  {
    id: "H",
    label: "Hidrogênio (H)",
    lines: [
      { nm: 656.28, I: 1, n: 3 },
      { nm: 486.13, I: 0.35, n: 4 },
      { nm: 434.05, I: 0.15, n: 5 },
      { nm: 410.17, I: 0.07, n: 6 },
      { nm: 397.01, I: 0.04, n: 7 },
    ],
  },
  {
    id: "He",
    label: "Hélio (He)",
    lines: [
      { nm: 706.52, I: 0.3 },
      { nm: 667.82, I: 0.35 },
      { nm: 587.56, I: 1 },
      { nm: 501.57, I: 0.25 },
      { nm: 492.19, I: 0.08 },
      { nm: 471.31, I: 0.1 },
      { nm: 447.15, I: 0.45 },
      { nm: 402.62, I: 0.06 },
    ],
  },
  {
    id: "Hg",
    label: "Mercúrio (Hg)",
    lines: [
      { nm: 404.66, I: 0.4 },
      { nm: 407.78, I: 0.1 },
      { nm: 435.83, I: 1 },
      { nm: 491.6, I: 0.06 },
      { nm: 546.07, I: 0.9 },
      { nm: 576.96, I: 0.35 },
      { nm: 579.07, I: 0.4 },
    ],
  },
  {
    id: "Na",
    label: "Sódio (Na)",
    lines: [
      { nm: 588.995, I: 1 },
      { nm: 589.592, I: 0.5 },
      { nm: 568.82, I: 0.06 },
      { nm: 615.42, I: 0.04 },
      { nm: 498.28, I: 0.03 },
    ],
  },
  {
    id: "Ne",
    label: "Neônio (Ne)",
    lines: [
      { nm: 540.06, I: 0.1 },
      { nm: 585.25, I: 0.5 },
      { nm: 588.19, I: 0.2 },
      { nm: 594.48, I: 0.4 },
      { nm: 597.55, I: 0.1 },
      { nm: 603.0, I: 0.15 },
      { nm: 607.43, I: 0.3 },
      { nm: 609.62, I: 0.35 },
      { nm: 614.31, I: 0.6 },
      { nm: 616.36, I: 0.2 },
      { nm: 621.73, I: 0.2 },
      { nm: 626.65, I: 0.4 },
      { nm: 630.48, I: 0.2 },
      { nm: 633.44, I: 0.4 },
      { nm: 638.3, I: 0.6 },
      { nm: 640.22, I: 1 },
      { nm: 650.65, I: 0.6 },
      { nm: 659.9, I: 0.3 },
      { nm: 667.83, I: 0.25 },
      { nm: 692.95, I: 0.4 },
      { nm: 703.24, I: 0.6 },
    ],
  },
];

/** Constante de Rydberg do hidrogênio (m⁻¹). */
export const R_H = 1.09678e7;
/** λ de Balmer (vácuo, nm) para o nível superior n. */
export const balmerNm = (n: number) => 1e9 / (R_H * (0.25 - 1 / (n * n)));

/** Ângulo de difração (graus) para incidência normal; NaN se a ordem não existe. */
export function gratingDeg(nm: number, m: number, linesPerMm: number): number {
  const s = m * nm * 1e-6 * linesPerMm;
  return Math.abs(s) <= 1 ? Math.asin(s) / D : NaN;
}

/** Fração da largura da fenda da rede (a/d): define a envoltória das ordens. */
export const SLIT_FRACTION = 0.3;
export function orderEnvelope(m: number): number {
  if (m === 0) return 1;
  const b = Math.PI * m * SLIT_FRACTION;
  return (Math.sin(b) / b) ** 2;
}

/** Vidros do prisma: coeficientes de Cauchy n = A + B/λ² (λ em nm). */
export const GLASSES = [
  { label: "Crown BK7", A: 1.5046, B: 4220 },
  { label: "Flint F2", A: 1.5942, B: 8950 },
];
/** Ângulo do vértice do prisma (graus). */
export const APEX = 60;

export const cauchy = (nm: number, A: number, B: number) => A + B / (nm * nm);

/** Desvio do prisma (graus) para incidência inc (graus); NaN se houver reflexão interna total. */
export function prismDeviation(n: number, incDeg: number, apexDeg = APEX): number {
  const r1 = Math.asin(Math.sin(incDeg * D) / n);
  const r2 = apexDeg * D - r1;
  const se = n * Math.sin(r2);
  if (Math.abs(se) > 1) return NaN;
  return incDeg + Math.asin(se) / D - apexDeg;
}

/** Ângulo de incidência (graus) do desvio mínimo. */
export const minDevIncidence = (n: number, apexDeg = APEX) => Math.asin(n * Math.sin((apexDeg * D) / 2)) / D;
export const minDeviation = (n: number, apexDeg = APEX) => 2 * minDevIncidence(n, apexDeg) - apexDeg;
/** Índice a partir do desvio mínimo. */
export const indexFromMinDev = (deltaDeg: number, apexDeg = APEX) => Math.sin(((apexDeg + deltaDeg) * D) / 2) / Math.sin((apexDeg * D) / 2);

/** Distância focal do colimador (m) e borrão ótico da luneta (rad). */
export const F_COL = 0.17;
export const BLUR = (0.5 / 60) * D;

/** Largura a meia altura da imagem da fenda (graus). */
export const lineFwhmDeg = (slitUm: number) => Math.hypot((slitUm * 1e-6) / F_COL, BLUR) / D;
