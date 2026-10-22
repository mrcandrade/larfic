import { num, type Params } from "@fisilab/core";

/** Propriedades da água (J/kg·K e J/kg). */
export const C_ICE = 2100;
export const C_WATER = 4186;
export const C_STEAM = 2010;
export const L_F = 334_000;
export const L_V = 2_256_000;

/** Corpos que podem ser jogados no calorímetro (calor específico em J/kg·K; 0 = água). */
export const BODIES = [
  { value: 0, label: "Água (gelo, líquida ou vapor conforme T)", c: 0 },
  { value: 1, label: "Cobre", c: 385 },
  { value: 2, label: "Alumínio", c: 900 },
  { value: 3, label: "Ferro", c: 450 },
  { value: 4, label: "Chumbo", c: 128 },
];

/**
 * Subsistema térmico: massa m de água (com mudanças de fase) mais uma
 * capacidade térmica extra C (calorímetro), ou um sólido sem mudança de fase.
 * Referência de entalpia: gelo a 0 °C (ou sólido a 0 °C) → H = 0.
 */
export interface Sub {
  m: number;
  /** Calor específico fixo; 0 indica água com mudanças de fase. */
  c: number;
  /** Capacidade térmica extra que acompanha a temperatura (J/K). */
  C: number;
}

const isWater = (s: Sub) => s.c === 0;

/** Entalpia a partir da temperatura; nas temperaturas de patamar, `side` escolhe a fase. */
export function enthalpy(s: Sub, T: number, side: "lo" | "hi" = "lo"): number {
  if (!isWater(s)) return (s.m * s.c + s.C) * T;
  const { m, C } = s;
  const H1 = m * L_F;
  const H2 = H1 + (m * C_WATER + C) * 100;
  if (T < 0 || (T === 0 && side === "lo")) return (m * C_ICE + C) * T;
  if (T < 100 || (T === 100 && side === "lo")) return H1 + (m * C_WATER + C) * T;
  return H2 + m * L_V + (m * C_STEAM + C) * (T - 100);
}

/** Estado inicial típico: T ≤ 0 gelo, 0 < T < 100 líquida, T ≥ 100 vapor. */
export const enthalpyFromT = (s: Sub, T: number) => enthalpy(s, T, T >= 100 ? "hi" : "lo");

export interface Phase {
  T: number;
  /** Fração da massa de água líquida e em vapor. */
  liquid: number;
  vapor: number;
}

/** Temperatura e frações de fase a partir da entalpia. */
export function phaseOf(s: Sub, H: number): Phase {
  if (!isWater(s)) return { T: H / (s.m * s.c + s.C), liquid: 0, vapor: 0 };
  const { m, C } = s;
  const H1 = m * L_F;
  const H2 = H1 + (m * C_WATER + C) * 100;
  const H3 = H2 + m * L_V;
  if (H < 0) return { T: H / (m * C_ICE + C), liquid: 0, vapor: 0 };
  if (H <= H1) return { T: 0, liquid: H1 > 0 ? H / H1 : 1, vapor: 0 };
  if (H <= H2) return { T: (H - H1) / (m * C_WATER + C), liquid: 1, vapor: 0 };
  if (H <= H3) return { T: 100, liquid: H3 > H2 ? 1 - (H - H2) / (H3 - H2) : 0, vapor: H3 > H2 ? (H - H2) / (H3 - H2) : 1 };
  return { T: 100 + (H - H3) / (m * C_STEAM + C), liquid: 0, vapor: 1 };
}

/**
 * Equilíbrio de vários subsistemas com entalpia total Htot:
 * menor T com Σ H_hi(T) ≥ Htot (bissecção), depois os patamares.
 */
export function equilibrium(subs: Sub[], Htot: number): { T: number; iceLeft: number; steamLeft: number } {
  const tot = (T: number, side: "lo" | "hi") => subs.reduce((a, s) => a + enthalpy(s, T, side), 0);
  let lo = -273, hi = 2000;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (tot(mid, "hi") >= Htot) hi = mid;
    else lo = mid;
  }
  let T = hi;
  for (const Tp of [0, 100]) if (Math.abs(T - Tp) < 1e-6 && tot(Tp, "lo") <= Htot + 1e-6 && tot(Tp, "hi") >= Htot - 1e-6) T = Tp;
  // Massa de gelo restante a 0 °C ou de vapor a 100 °C
  let iceLeft = 0, steamLeft = 0;
  if (T === 0) iceLeft = Math.max(0, (tot(0, "hi") - Htot) / L_F);
  if (T === 100) steamLeft = Math.max(0, (Htot - tot(100, "lo")) / L_V);
  if (T < 0) iceLeft = subs.filter(isWater).reduce((a, s) => a + s.m, 0);
  return { T, iceLeft, steamLeft };
}

// ---------- Parâmetros ----------

export const heatingSub = (p: Params): Sub => ({ m: num(p, "m", 0.5), c: 0, C: 0 });
export const waterSub = (p: Params): Sub => ({ m: num(p, "ma", 0.2), c: 0, C: num(p, "Ccal", 80) });
export function bodySub(p: Params): Sub {
  const kind = Math.round(num(p, "corpo", 0));
  return { m: num(p, "mb", 0.05), c: BODIES.find((b) => b.value === kind)?.c ?? 0, C: 0 };
}
