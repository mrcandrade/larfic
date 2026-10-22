/**
 * Processos quase-estáticos de um gás ideal no plano PV.
 * Unidades: P em kPa, V em L, então P·V sai em joules (1 kPa·L = 1 J).
 */

export const R = 8.314462618;

/** Tipos de processo, na ordem das opções do parâmetro "processo". */
export const KINDS = ["isotérmico", "adiabático", "isobárico", "isocórico"] as const;
export const ISOTERMICO = 0;
export const ADIABATICO = 1;
export const ISOBARICO = 2;
export const ISOCORICO = 3;

export interface Pt {
  P: number;
  V: number;
}

export interface Stage {
  kind: number;
  A: Pt;
  B: Pt;
}

export interface Energy {
  Q: number;
  W: number;
  dU: number;
}

export interface Box {
  Vlo: number;
  Vhi: number;
  Plo: number;
  Phi: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Pressão sobre a curva do processo que passa por A, no volume V (isotérmico/adiabático/isobárico). */
export function pressureOn(kind: number, A: Pt, V: number, gamma: number): number {
  if (kind === ISOTERMICO) return (A.P * A.V) / V;
  if (kind === ADIABATICO) return A.P * (A.V / V) ** gamma;
  return A.P;
}

/**
 * Projeta o ponto que o aluno arrastou (target) sobre o caminho permitido
 * pelo processo que parte de A, mantendo o resultado dentro da caixa dos eixos.
 */
export function project(kind: number, A: Pt, target: Pt, gamma: number, box: Box): Pt {
  if (kind === ISOCORICO) return { V: A.V, P: clamp(target.P, box.Plo, box.Phi) };
  if (kind === ISOBARICO) return { P: A.P, V: clamp(target.V, box.Vlo, box.Vhi) };
  // P = c / V^k é decrescente: a faixa de P permitida vira uma faixa de V.
  const k = kind === ISOTERMICO ? 1 : gamma;
  const c = A.P * A.V ** k;
  const vMin = Math.max(box.Vlo, (c / box.Phi) ** (1 / k));
  const vMax = Math.min(box.Vhi, (c / box.Plo) ** (1 / k));
  const V = clamp(target.V, vMin, Math.max(vMin, vMax));
  return { V, P: pressureOn(kind, A, V, gamma) };
}

/** Primeira lei para o processo A → B: Q = ΔU + W, com W o trabalho feito pelo gás. */
export function energy(kind: number, A: Pt, B: Pt, gamma: number): Energy {
  const dU = (B.P * B.V - A.P * A.V) / (gamma - 1);
  let W = 0;
  if (kind === ISOTERMICO) W = A.P * A.V * Math.log(B.V / A.V);
  else if (kind === ADIABATICO) W = -dU;
  else if (kind === ISOBARICO) W = A.P * (B.V - A.V);
  return { Q: dU + W, W, dU };
}

/** Estado ao longo do processo para λ ∈ [0, 1]. */
export function along(kind: number, A: Pt, B: Pt, gamma: number, lam: number): Pt {
  if (kind === ISOCORICO) return { V: A.V, P: A.P + (B.P - A.P) * lam };
  const V = kind === ISOBARICO ? A.V + (B.V - A.V) * lam : A.V * (B.V / A.V) ** lam;
  return { V, P: pressureOn(kind, A, V, gamma) };
}

/** Pontos do caminho, para desenhar e para medir a área. */
export function pathPoints(kind: number, A: Pt, B: Pt, gamma: number, n = 60): Pt[] {
  return Array.from({ length: n + 1 }, (_, i) => along(kind, A, B, gamma, i / n));
}

/** Área sob o caminho no plano PV (regra do trapézio): ∫P dV. */
export function areaUnder(points: Pt[]): number {
  let a = 0;
  for (let i = 1; i < points.length; i++) {
    const p = points[i - 1]!;
    const q = points[i]!;
    a += 0.5 * (p.P + q.P) * (q.V - p.V);
  }
  return a;
}

export function sumEnergy(list: Energy[]): Energy & { Qin: number; Qout: number } {
  const t = { Q: 0, W: 0, dU: 0, Qin: 0, Qout: 0 };
  for (const e of list) {
    t.Q += e.Q;
    t.W += e.W;
    t.dU += e.dU;
    if (e.Q > 0) t.Qin += e.Q;
    else t.Qout -= e.Q;
  }
  return t;
}

export const temperature = (p: Pt, n: number) => (p.P * p.V) / (n * R);
