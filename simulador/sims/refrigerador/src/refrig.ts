import { num, type Params } from "@fisilab/core";

/**
 * Modelo simplificado de refrigerante (unidades SI: K, Pa, J/kg, J/(kg·K)).
 *  - saturação por Clausius–Clapeyron: P_s(T) = P₀ exp[B(1/T₀ − 1/T)];
 *  - líquido saturado: h_f = h₀ + c_l x + c₂ x², com x = T − T₀ (s_f pela integral de c/T);
 *  - calor latente pela regra de Watson: h_fg = h_fg0 [(T_c − T)/(T_c − T₀)]^0,38;
 *  - vapor superaquecido com c_p constante: h = h_g(T_s) + c_p (T − T_s), s = s_g(T_s) + c_p ln(T/T_s).
 * Referência IIR: h = 200 kJ/kg e s = 1 kJ/(kg·K) para o líquido saturado a 0 °C.
 * Os coeficientes reproduzem as tabelas reais com erro de poucos por cento entre −30 °C e 60 °C.
 */

export const T0 = 273.15;
const H0 = 200e3;
const S0 = 1000;

export interface Fluid {
  value: number;
  name: string;
  /** Pressão de saturação a 0 °C (Pa) e B = ΔH_vap/R_específico (K). */
  P0: number;
  B: number;
  hfg0: number;
  Tc: number;
  cl: number;
  c2: number;
  cpv: number;
}

export const FLUIDS: Fluid[] = [
  { value: 0, name: "R-134a (tetrafluoroetano)", P0: 293e3, B: 2661, hfg0: 198.6e3, Tc: 374.2, cl: 1335, c2: 2.5, cpv: 1100 },
  { value: 1, name: "R-600a (isobutano)", P0: 157e3, B: 2605, hfg0: 355e3, Tc: 407.8, cl: 2300, c2: 4, cpv: 1800 },
  { value: 2, name: "R-717 (amônia)", P0: 429.4e3, B: 2751, hfg0: 1262e3, Tc: 405.4, cl: 4600, c2: 3, cpv: 2800 },
];

export const fluidOf = (p: Params): Fluid => FLUIDS[Math.max(0, Math.min(FLUIDS.length - 1, Math.round(num(p, "fluido"))))]!;

export const Psat = (f: Fluid, T: number) => f.P0 * Math.exp(f.B * (1 / T0 - 1 / T));
export const Tsat = (f: Fluid, P: number) => 1 / (1 / T0 - Math.log(P / f.P0) / f.B);
export const hf = (f: Fluid, T: number) => H0 + f.cl * (T - T0) + f.c2 * (T - T0) ** 2;
export const sf = (f: Fluid, T: number) => S0 + (f.cl - 2 * f.c2 * T0) * Math.log(T / T0) + 2 * f.c2 * (T - T0);
export const hfg = (f: Fluid, T: number) => (T >= f.Tc ? 0 : f.hfg0 * ((f.Tc - T) / (f.Tc - T0)) ** 0.38);
export const hg = (f: Fluid, T: number) => hf(f, T) + hfg(f, T);
export const sg = (f: Fluid, T: number) => sf(f, T) + hfg(f, T) / T;

/** Temperatura do líquido com entalpia h (inverte a quadrática de h_f). */
function TofHliquid(f: Fluid, h: number): number {
  const c = H0 - h;
  if (f.c2 === 0) return T0 - c / f.cl;
  return T0 + (-f.cl + Math.sqrt(f.cl * f.cl - 4 * f.c2 * c)) / (2 * f.c2);
}

export type Phase = "líquido" | "mistura" | "vapor";

export interface Props {
  T: number;
  s: number;
  /** Título (fração de vapor); 0 para líquido e 1 para vapor. */
  x: number;
  phase: Phase;
}

/** Propriedades a partir de (h, P). */
export function props(f: Fluid, h: number, P: number): Props {
  const Ts = Tsat(f, P);
  const hL = hf(f, Ts);
  const hV = hg(f, Ts);
  if (h <= hL) {
    const T = TofHliquid(f, h);
    return { T, s: sf(f, T), x: 0, phase: "líquido" };
  }
  if (h >= hV) {
    const T = Ts + (h - hV) / f.cpv;
    return { T, s: sg(f, Ts) + f.cpv * Math.log(T / Ts), x: 1, phase: "vapor" };
  }
  const x = (h - hL) / (hV - hL);
  return { T: Ts, s: sf(f, Ts) + (x * hfg(f, Ts)) / Ts, x, phase: "mistura" };
}

/** Entalpia do estado com entropia s à pressão P (compressão isentrópica). */
export function hFromSP(f: Fluid, s: number, P: number): number {
  const Ts = Tsat(f, P);
  const sV = sg(f, Ts);
  if (s >= sV) return hg(f, Ts) + f.cpv * (Ts * Math.exp((s - sV) / f.cpv) - Ts);
  const sL = sf(f, Ts);
  if (s >= sL) return hf(f, Ts) + ((s - sL) / (sV - sL)) * hfg(f, Ts);
  // Líquido comprimido: s só depende de T.
  let lo = 150, hi = Ts;
  for (let i = 0; i < 80; i++) {
    const m = 0.5 * (lo + hi);
    if (sf(f, m) < s) lo = m;
    else hi = m;
  }
  return hf(f, 0.5 * (lo + hi));
}

export interface Cycle {
  f: Fluid;
  /** Reservatórios (K): ambiente frio e quente. */
  TL: number;
  TH: number;
  /** Temperaturas de evaporação e condensação (K) e pressões (Pa). */
  Te: number;
  Tk: number;
  Pe: number;
  Pk: number;
  eta: number;
  h1: number;
  h2: number;
  h2s: number;
  h3: number;
  h4: number;
  s1: number;
  qL: number;
  qH: number;
  w: number;
  copR: number;
  copHP: number;
  /** COP de Carnot entre os reservatórios e entre T_e e T_k. */
  carnotR: number;
  carnotHP: number;
  carnotInt: number;
  mdot: number;
}

export function buildCycle(p: Params): Cycle {
  const f = fluidOf(p);
  const TL = num(p, "TL", 4) + T0;
  const TH = Math.max(TL + 1, num(p, "TH", 25) + T0);
  const dT = num(p, "dT", 10);
  const Te = TL - dT;
  const Tk = TH + dT;
  const Pe = Psat(f, Te);
  const Pk = Psat(f, Tk);
  const sh = num(p, "sh", 5);
  const sc = num(p, "sc", 3);
  const eta = Math.max(0.3, Math.min(1, num(p, "eta", 0.8)));
  const T1 = Te + sh;
  const h1 = hg(f, Te) + f.cpv * sh;
  const s1 = sg(f, Te) + f.cpv * Math.log(T1 / Te);
  const h2s = hFromSP(f, s1, Pk);
  const h2 = h1 + (h2s - h1) / eta;
  const h3 = hf(f, Tk - sc);
  const h4 = h3;
  const qL = h1 - h4;
  const qH = h2 - h3;
  const w = h2 - h1;
  return {
    f, TL, TH, Te, Tk, Pe, Pk, eta, h1, h2, h2s, h3, h4, s1, qL, qH, w,
    copR: qL / w,
    copHP: qH / w,
    carnotR: TL / (TH - TL),
    carnotHP: TH / (TH - TL),
    carnotInt: Te / (Tk - Te),
    mdot: num(p, "mdot", 5) / 1000,
  };
}

export const SEG_NAMES = ["compressão (1→2)", "condensação (2→3)", "expansão na válvula (3→4)", "evaporação (4→1)"];

/** Estado (h, P) ao longo do ciclo, u ∈ [0, 4): cada unidade é uma etapa. */
export function along(c: Cycle, u: number): { h: number; P: number; seg: number } {
  const w = ((u % 4) + 4) % 4;
  const seg = Math.min(3, Math.floor(w));
  const l = w - seg;
  const geo = (a: number, b: number) => a * (b / a) ** l;
  switch (seg) {
    case 0: {
      const P = geo(c.Pe, c.Pk);
      return { h: c.h1 + (hFromSP(c.f, c.s1, P) - c.h1) / c.eta, P, seg };
    }
    case 1:
      return { h: c.h2 + (c.h3 - c.h2) * l, P: c.Pk, seg };
    case 2:
      return { h: c.h3, P: geo(c.Pk, c.Pe), seg };
    default:
      return { h: c.h4 + (c.h1 - c.h4) * l, P: c.Pe, seg };
  }
}
