/**
 * Atmosfera padrão (ISA/US 1976 até 86 km, termosfera simplificada acima),
 * modelo isotérmico, ebulição por Clausius–Clapeyron e psicrometria (Magnus).
 * SI: P em Pa, T em K (exceto onde indicado °C), h em m.
 */

export const R = 8.314462618;
export const M_AR = 0.0289644;
export const G0 = 9.80665;
export const P0 = 101325;
export const T0 = 288.15;
export const M_H2O = 0.018015;
/** Calor latente molar de vaporização da água a 100 °C, J/mol. */
export const L_MOL = 40660;
export const L_KG = 2.257e6;
export const C_AGUA = 4186;

const BASE_H = [0, 11e3, 20e3, 32e3, 47e3, 51e3, 71e3, 84852];
const LAPSE = [-6.5e-3, 0, 1e-3, 2.8e-3, 0, -2.8e-3, -2.0e-3];

/** Temperaturas e pressões nas bases das camadas (pré-calculadas). */
const BASES = (() => {
  const T = [T0], P = [P0];
  for (let i = 0; i < LAPSE.length; i++) {
    const dh = BASE_H[i + 1]! - BASE_H[i]!;
    const L = LAPSE[i]!;
    const Tb = T[i]!, Pb = P[i]!;
    const Tt = Tb + L * dh;
    T.push(Tt);
    P.push(L === 0 ? Pb * Math.exp((-G0 * M_AR * dh) / (R * Tb)) : Pb * (Tt / Tb) ** ((-G0 * M_AR) / (R * L)));
  }
  return { T, P };
})();

/** Temperatura da atmosfera padrão, K. Acima de 86 km: termosfera aproximada (186,9 K até 91 km, depois sobe). */
export function isaT(h: number): number {
  if (h <= 0) return T0 + LAPSE[0]! * h;
  if (h < BASE_H[7]!) {
    let i = 0;
    while (h >= BASE_H[i + 1]!) i++;
    return BASES.T[i]! + LAPSE[i]! * (h - BASE_H[i]!);
  }
  if (h < 91e3) return 186.87;
  // Termosfera: aquece rápido com a absorção de UV (≈ 360 K a 120 km, ≈ 1000 K a 300 km).
  return 186.87 + (1000 - 186.87) * (1 - Math.exp(-(h - 91e3) / 120e3));
}

/** Pressão da atmosfera padrão, Pa. */
export function isaP(h: number): number {
  if (h <= 0) return P0 * (isaT(h) / T0) ** ((-G0 * M_AR) / (R * LAPSE[0]!));
  if (h < BASE_H[7]!) {
    let i = 0;
    while (h >= BASE_H[i + 1]!) i++;
    const Tb = BASES.T[i]!, Pb = BASES.P[i]!, L = LAPSE[i]!, dh = h - BASE_H[i]!;
    return L === 0 ? Pb * Math.exp((-G0 * M_AR * dh) / (R * Tb)) : Pb * ((Tb + L * dh) / Tb) ** ((-G0 * M_AR) / (R * L));
  }
  // Integra dP/P = −Mg/(RT) dh numericamente acima de 84,852 km.
  const n = 200;
  const h0 = BASE_H[7]!;
  const dh = (h - h0) / n;
  let s = 0;
  for (let k = 0; k < n; k++) s += 1 / isaT(h0 + (k + 0.5) * dh);
  return BASES.P[7]! * Math.exp((-G0 * M_AR * s * dh) / R);
}

/** Modelo isotérmico: P = P₀ e^(−h/H), H = RT/(Mg). */
export const scaleHeight = (T: number) => (R * T) / (M_AR * G0);
export const isoP = (h: number, T: number) => P0 * Math.exp(-h / scaleHeight(T));

export const density = (P: number, T: number) => (P * M_AR) / (R * T);

export interface Layer {
  name: string;
  h0: number;
  h1: number;
}
export const LAYERS: Layer[] = [
  { name: "Troposfera", h0: 0, h1: 11e3 },
  { name: "Estratosfera", h0: 11e3, h1: 47e3 },
  { name: "Mesosfera", h0: 51e3, h1: 85e3 },
  { name: "Termosfera", h0: 85e3, h1: 600e3 },
];

// ---------- Ebulição ----------

/** Temperatura de ebulição (K) pela equação de Clausius–Clapeyron integrada com L constante. */
export const boilT = (P: number) => 1 / (1 / 373.15 - (R * Math.log(P / P0)) / L_MOL);
/** Pressão de vapor (Pa) pela mesma equação. */
export const psatCC = (T: number) => P0 * Math.exp((-L_MOL / R) * (1 / T - 1 / 373.15));
/** Pressão de vapor da água por Antoine (referência experimental), Pa, T em K. */
export function psatAntoine(T: number): number {
  const t = T - 273.15;
  const [A, B, C] = t < 100 ? [8.07131, 1730.63, 233.426] : [8.14019, 1810.94, 244.485];
  return 133.322 * 10 ** (A - B / (C + t));
}
/** Tempo de cozimento relativo ao de 100 °C (taxa de reação dobra a cada ~10 °C). */
export const cookFactor = (Tc: number) => 2 ** ((100 - Tc) / 10);

// ---------- Umidade ----------

/** Pressão de saturação do vapor (Magnus), Pa, T em °C. */
export const esat = (t: number) => 611.2 * Math.exp((17.62 * t) / (243.12 + t));
/** Umidade absoluta (densidade de vapor), g/m³, para pressão de vapor e (Pa) e T em °C. */
export const absHum = (e: number, t: number) => ((e * M_H2O) / (R * (t + 273.15))) * 1000;
/** Ponto de orvalho (°C) pela inversão de Magnus. */
export function dewPoint(t: number, ur: number): number {
  const g = Math.log(Math.max(1e-6, ur)) + (17.62 * t) / (243.12 + t);
  return (243.12 * g) / (17.62 - g);
}
/** Constante psicrométrica de um psicrômetro ventilado, 1/K. */
export const A_PSY = 6.62e-4;
/** Temperatura de bulbo úmido (°C): e = e_s(T_u) − A·P·(T − T_u), resolvida por bissecção. */
export function wetBulb(t: number, ur: number, P = P0): number {
  const e = ur * esat(t);
  let lo = -40, hi = t;
  for (let i = 0; i < 80; i++) {
    const m = (lo + hi) / 2;
    if (esat(m) - A_PSY * P * (t - m) > e) hi = m;
    else lo = m;
  }
  return (lo + hi) / 2;
}
/** Umidade relativa a partir das leituras do psicrômetro. */
export const urFromPsy = (t: number, tu: number, P = P0) => (esat(tu) - A_PSY * P * (t - tu)) / esat(t);
