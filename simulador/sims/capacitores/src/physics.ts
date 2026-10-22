/** Fórmulas ideais do capacitor de placas paralelas e das associações. */

export const EPS0 = 8.8541878128e-12;

/** Comprimento inserido do dielétrico (cm) dado o bloco com borda esquerda em `slab`. */
export function insertion(Lp: number, slab: number): number {
  return Math.max(0, Math.min(Lp, Lp / 2 - slab));
}

/**
 * Capacitância ideal (F) de placas quadradas Lp × Lp (cm), separação d (cm), com
 * um trecho x (cm) preenchido por dielétrico κ: dois capacitores em paralelo.
 */
export function capIdeal(Lp: number, d: number, x: number, kappa: number): number {
  const w = Lp / 100;
  return (EPS0 * w * ((kappa * x + (Lp - x)) / 100)) / (d / 100);
}

/** dC/dx (F/m): o que puxa o dielétrico para dentro. */
export function dCdx(Lp: number, d: number, kappa: number): number {
  return (EPS0 * (Lp / 100) * (kappa - 1)) / (d / 100);
}

/** Força sobre o dielétrico (N), F = ½V² dC/dx, só enquanto ele está parcialmente dentro. */
export function forceSlab(V: number, Lp: number, d: number, x: number, kappa: number): number {
  if (x <= 1e-9 || x >= Lp - 1e-9) return 0;
  return 0.5 * V * V * dCdx(Lp, d, kappa);
}

/** Força de atração entre as placas (N): F = ½CV²/d = Q²/(2Cd). */
export function forcePlates(C: number, V: number, d: number): number {
  return (0.5 * C * V * V) / (d / 100);
}

export interface Assoc {
  Ceq: number;
  /** Carga, tensão e capacitância de cada capacitor presente. */
  caps: { C: number; Q: number; V: number }[];
  Q: number;
  U: number;
}

/**
 * Associação de 2 ou 3 capacitores (C₃ = 0 significa ausente) sob tensão V.
 * tipo 0: série; 1: paralelo; 2: misto, C₁ em série com (C₂ ∥ C₃).
 */
export function assoc(tipo: number, C1: number, C2: number, C3: number, V: number): Assoc {
  const list = [C1, C2, C3].filter((c, i) => i < 2 || c > 0);
  let Ceq = 0;
  let caps: { C: number; Q: number; V: number }[] = [];
  if (tipo === 0) {
    Ceq = 1 / list.reduce((s, c) => s + 1 / c, 0);
    const Q = Ceq * V;
    caps = list.map((c) => ({ C: c, Q, V: Q / c }));
  } else if (tipo === 1) {
    Ceq = list.reduce((s, c) => s + c, 0);
    caps = list.map((c) => ({ C: c, Q: c * V, V }));
  } else {
    const C23 = C2 + (C3 > 0 ? C3 : 0);
    Ceq = (C1 * C23) / (C1 + C23);
    const Q1 = Ceq * V;
    const V1 = Q1 / C1;
    const V23 = V - V1;
    caps = [{ C: C1, Q: Q1, V: V1 }, { C: C2, Q: C2 * V23, V: V23 }];
    if (C3 > 0) caps.push({ C: C3, Q: C3 * V23, V: V23 });
  }
  return { Ceq, caps, Q: Ceq * V, U: 0.5 * Ceq * V * V };
}

/** Número com vírgula decimal e sinal de menos tipográfico, para o palco. */
export function fmt(v: number, digits = 3): string {
  if (!Number.isFinite(v)) return "—";
  if (v === 0) return "0";
  const a = Math.abs(v);
  if (a >= 1e5 || a < 1e-3) {
    const [m, e] = v.toExponential(digits - 1).split("e");
    return `${m!.replace(".", ",").replace("-", "−")}×10^${Number(e)}`;
  }
  return Number(v.toPrecision(digits)).toString().replace(".", ",").replace("-", "−");
}
