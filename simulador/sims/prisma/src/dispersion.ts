/**
 * Índices de refração pela equação de Sellmeier, n² − 1 = Σ Bᵢλ²/(λ² − Cᵢ), λ em µm.
 * Vidros: catálogo Schott (N-BK7, F2, SF11). Água a 20 °C: Daimon & Masumura (2007).
 */

export interface Material {
  label: string;
  B: number[];
  C: number[];
}

export const MATERIALS: Material[] = [
  { label: "Vidro crown (BK7)", B: [1.03961212, 0.231792344, 1.01046945], C: [0.00600069867, 0.0200179144, 103.560653] },
  { label: "Vidro flint (F2)", B: [1.34533359, 0.209073176, 0.937357162], C: [0.00997743871, 0.0470450767, 111.886764] },
  { label: "Flint denso (SF11)", B: [1.73759695, 0.313747346, 1.89878101], C: [0.013188707, 0.0623068142, 155.23629] },
  {
    label: "Água (20 °C)",
    B: [5.684027565e-1, 1.726177391e-1, 2.086189578e-2, 1.130748688e-1],
    C: [5.101829712e-3, 1.821153936e-2, 2.620722293e-2, 1.069792721e1],
  },
];

/** Índice de refração para o comprimento de onda em nm. */
export function sellmeier(m: Material, nm: number): number {
  const l2 = (nm / 1000) ** 2;
  let s = 1;
  m.B.forEach((b, i) => {
    s += (b * l2) / (l2 - m.C[i]!);
  });
  return Math.sqrt(s);
}

const DEG = Math.PI / 180;

/** Desvio de um prisma de ângulo A (rad) para incidência θi (rad); NaN se houver reflexão interna total. */
export function prismDeviation(n: number, A: number, thi: number): number {
  const r1 = Math.asin(Math.sin(thi) / n);
  const r2 = A - r1;
  const s = n * Math.sin(r2);
  if (Math.abs(s) > 1) return NaN;
  return thi + Math.asin(s) - A;
}

/** Desvio mínimo: n = sen((A + δm)/2) / sen(A/2). */
export function minDeviation(n: number, A: number): number {
  const s = n * Math.sin(A / 2);
  return s >= 1 ? NaN : 2 * Math.asin(s) - A;
}

/** Ângulo de incidência do desvio mínimo (raio interno paralelo à base). */
export function minDeviationIncidence(n: number, A: number): number {
  return Math.asin(Math.min(1, n * Math.sin(A / 2)));
}

/** Desvio total numa gota esférica com k reflexões internas, para parâmetro de impacto b = sen θi. */
export function dropDeviation(n: number, b: number, k: number): number {
  const ti = Math.asin(b);
  const tr = Math.asin(b / n);
  return 2 * (ti - tr) + k * (Math.PI - 2 * tr);
}

/** Ângulo entre o raio que sai da gota e a direção antissolar (o raio do arco no céu). */
export function bowAngle(n: number, b: number, k: number): number {
  const D = dropDeviation(n, b, k);
  const r = ((D % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  return Math.abs(r - Math.PI);
}

/** Ângulo do arco-íris de ordem k (extremo do desvio): cos θi = √((n² − 1)/(k(k+2))). */
export function rainbowAngle(n: number, k: number): number {
  const c = Math.sqrt((n * n - 1) / (k * (k + 2)));
  return bowAngle(n, Math.sqrt(1 - c * c), k);
}

export const deg = (r: number) => r / DEG;
export const rad = (d: number) => d * DEG;
