/**
 * Motores térmicos em ciclo-padrão de ar (Otto, dois tempos, Diesel, Wankel)
 * e máquina a vapor de dupla ação com diagrama indicado ideal (Rankine).
 * Unidades SI: P em Pa, V em m³, T em K, energia em J.
 */
import { num, type Params } from "@fisilab/core";

export const R = 8.314462618;
export const GAMMA = 1.4;
export const CV = R / (GAMMA - 1);
export const CP = GAMMA * CV;
/** Admissão: ar a 100 kPa e 300 K. */
export const P_IN = 100e3;
export const T_IN = 300;
/** Razão biela/manivela l/a. */
export const ROD = 3.5;
/** Fração do curso a partir da qual as janelas do dois tempos ficam descobertas. */
export const PORT = 0.72;
/** Espaço morto do cilindro a vapor, em fração do volume deslocado. */
export const CLEAR_STEAM = 0.08;
const M_H2O = 0.018015;

export const MOTORES = ["Máquina a vapor (locomotiva)", "Otto 4 tempos", "Dois tempos", "Diesel 4 tempos", "Wankel (rotativo)"];
export const VAPOR = 0, OTTO = 1, DOIS = 2, DIESEL = 3, WANKEL = 4;

export interface Engine {
  motor: number;
  /** Taxa de compressão geométrica. */
  r: number;
  Tmax: number;
  /** Volume deslocado por cilindro (ou câmara), m³. */
  Vd: number;
  /** Pressão da caldeira e do escape (vapor), Pa. */
  Pb: number;
  Pe: number;
  /** Corte de admissão (fração do curso). */
  corte: number;
  rpm: number;
  ncil: number;
}

export function engineOf(p: Params): Engine {
  const motor = Math.round(num(p, "motor", 1));
  return {
    motor,
    r: num(p, "r", 9),
    Tmax: num(p, "Tmax", 2400),
    Vd: (motor === VAPOR ? num(p, "Vvap", 60) : num(p, "cil", 0.5)) / 1000,
    Pb: num(p, "Pb", 12) * 1e5,
    Pe: num(p, "Pe", 1) * 1e5,
    corte: num(p, "corte", 30) / 100,
    rpm: num(p, "rpm", 3000),
    ncil: Math.round(num(p, "ncil", 1)),
  };
}

/** Período do ciclo em ângulo do eixo (rad). */
export const period = (motor: number) => (motor === OTTO || motor === DIESEL ? 4 * Math.PI : motor === WANKEL ? 6 * Math.PI : 2 * Math.PI);
/** Ciclos completos por volta do eixo, por cilindro (vapor: dupla ação; Wankel: 3 faces por rotor). */
export const cyclesPerRev = (motor: number) => (motor === VAPOR ? 2 : motor === OTTO || motor === DIESEL ? 0.5 : 1);

/** Biela-manivela: fração do curso percorrida a partir do PMS, para ângulo θ do eixo. */
export function strokeFrac(theta: number, lam = ROD): number {
  const s = Math.sin(theta);
  return 0.5 * (1 - Math.cos(theta) + lam - Math.sqrt(lam * lam - s * s));
}

/** Ângulo θ ∈ [0, π] em que a fração do curso vale f. */
export function angleAtFrac(f: number): number {
  let lo = 0, hi = Math.PI;
  for (let i = 0; i < 60; i++) {
    const m = (lo + hi) / 2;
    if (strokeFrac(m) < f) lo = m;
    else hi = m;
  }
  return (lo + hi) / 2;
}

// ---------- Vapor d'água saturado (aproximações para a sim) ----------

/** Pressão de saturação da água (Antoine), Pa, para T em K. */
export function psatWater(T: number): number {
  const t = T - 273.15;
  const [A, B, C] = t < 100 ? [8.07131, 1730.63, 233.426] : [8.14019, 1810.94, 244.485];
  return 133.322 * 10 ** (A - B / (C + t));
}

/** Temperatura de saturação da água, K, para P em Pa. */
export function tsatWater(P: number): number {
  const lp = Math.log10(P / 133.322);
  const [A, B, C] = P < 101325 ? [8.07131, 1730.63, 233.426] : [8.14019, 1810.94, 244.485];
  return B / (A - lp) - C + 273.15;
}

/** Entalpias (J/kg) e entropias (J/kg·K) de líquido e vapor saturados; calor latente pela correlação de Watson. */
export function steamSat(T: number) {
  const t = T - 273.15;
  const hf = 4186 * t;
  const hfg = 2.257e6 * Math.max(0, (647.1 - T) / (647.1 - 373.15)) ** 0.38;
  const sf = 4186 * Math.log(T / 273.15);
  return { hf, hfg, hg: hf + hfg, sf, sg: sf + hfg / T };
}

/** Rendimento do ciclo de Rankine ideal com vapor saturado entre a caldeira (Pb) e o escape/condensador (Pe). */
export function rankine(Pb: number, Pe: number) {
  const Tb = tsatWater(Pb), Te = tsatWater(Pe);
  const b = steamSat(Tb), e = steamSat(Te);
  const x2 = Math.min(1, (b.sg - e.sf) / (e.hfg / Te));
  const h2 = e.hf + x2 * e.hfg;
  const wp = 0.001 * (Pb - Pe);
  const h4 = e.hf + wp;
  const wt = b.hg - h2;
  return { eta: (wt - wp) / (b.hg - h4), x2, Tb, Te, qin: b.hg - h4 };
}

// ---------- Volumes ----------

export function volumes(e: Engine) {
  if (e.motor === VAPOR) {
    const Vc = CLEAR_STEAM * e.Vd;
    return { Vc, V1: Vc + e.Vd };
  }
  const Vc = e.Vd / (e.r - 1);
  return { Vc, V1: Vc + e.Vd };
}

/** Volume da câmara para o ângulo θ do eixo. */
export function volumeAt(e: Engine, theta: number): number {
  const { Vc } = volumes(e);
  if (e.motor === WANKEL) return Vc + (e.Vd * (1 - Math.cos((2 * theta) / 3))) / 2;
  return Vc + e.Vd * strokeFrac(theta);
}

// ---------- Pontos característicos dos ciclos ----------

export function cyclePoints(e: Engine) {
  const { Vc, V1 } = volumes(e);
  const g = GAMMA;
  if (e.motor === VAPOR) {
    const Vcut = Vc + e.corte * e.Vd;
    const Prel = (e.Pb * Vcut) / V1;
    return { Vc, V1, Vcut, Prel, n: 0, T2: 0, T3: tsatWater(e.Pb), P2: e.Pb, P3: e.Pb, V3: Vcut, rEff: e.r, Vtr: V1, T4: tsatWater(Prel) };
  }
  // Dois tempos: compressão só começa quando o pistão fecha as janelas.
  const Vtr = e.motor === DOIS ? Vc + PORT * e.Vd : V1;
  const rEff = Vtr / Vc;
  const n = (P_IN * Vtr) / (R * T_IN);
  const T2 = T_IN * rEff ** (g - 1);
  const P2 = P_IN * rEff ** g;
  let T3: number, V3: number;
  if (e.motor === DIESEL) {
    const rc = Math.min(0.9 * rEff, Math.max(1.01, e.Tmax / T2));
    T3 = T2 * rc;
    V3 = Vc * rc;
  } else {
    T3 = Math.max(e.Tmax, T2 * 1.05);
    V3 = Vc;
  }
  const P3 = (n * R * T3) / V3;
  const T4 = T3 * (V3 / Vtr) ** (g - 1);
  return { Vc, V1, Vcut: V3, Prel: P3 * (V3 / Vtr) ** g, n, T2, T3, P2, P3, V3, rEff, Vtr, T4 };
}

export interface Point {
  V: number;
  P: number;
  T: number;
  /** Índice da fase (para cores e rótulos). */
  phase: number;
  label: string;
}

/** Estado do fluido de trabalho (lado da tampa, no vapor) para o ângulo θ do eixo. */
export function pointAt(e: Engine, theta: number): Point {
  const T = period(e.motor);
  const u = ((theta % T) + T) % T;
  const V = volumeAt(e, u);
  const c = cyclePoints(e);
  const g = GAMMA;
  const pi = Math.PI;
  if (e.motor === VAPOR) {
    const ucut = angleAtFrac(e.corte);
    if (u < ucut) return { V, P: e.Pb, T: c.T3, phase: 0, label: "Admissão de vapor" };
    if (u < pi) {
      const P = (e.Pb * c.Vcut) / V;
      return { V, P, T: tsatWater(P), phase: 1, label: "Expansão (válvula fechada)" };
    }
    return { V, P: e.Pe, T: tsatWater(e.Pe), phase: 2, label: "Escape" };
  }
  if (e.motor === DOIS) {
    const uo = angleAtFrac(PORT);
    if (u < uo) {
      const P = c.P3 * (c.V3 / V) ** g;
      return { V, P, T: c.T3 * (c.V3 / V) ** (g - 1), phase: 2, label: "Combustão e expansão" };
    }
    if (u < 2 * pi - uo) return { V, P: P_IN, T: T_IN, phase: 3, label: "Escape e lavagem (janelas abertas)" };
    return { V, P: P_IN * (c.Vtr / V) ** g, T: T_IN * (c.Vtr / V) ** (g - 1), phase: 1, label: "Compressão (e admissão no cárter)" };
  }
  const q = e.motor === WANKEL ? 1.5 * pi : pi; // duração de cada tempo
  const k = Math.min(3, Math.floor(u / q));
  if (k === 0) return { V, P: P_IN, T: T_IN, phase: 0, label: "1º tempo: admissão" };
  if (k === 1) return { V, P: P_IN * (c.V1 / V) ** g, T: T_IN * (c.V1 / V) ** (g - 1), phase: 1, label: "2º tempo: compressão" };
  if (k === 2) {
    if (e.motor === DIESEL && V <= c.V3) return { V, P: c.P2, T: (c.P2 * V) / (c.n * R), phase: 2, label: "3º tempo: injeção e combustão (P constante)" };
    return { V, P: c.P3 * (c.V3 / V) ** g, T: c.T3 * (c.V3 / V) ** (g - 1), phase: 2, label: "3º tempo: expansão (tempo motor)" };
  }
  return { V, P: P_IN, T: T_IN, phase: 3, label: "4º tempo: escape" };
}

// ---------- Balanços ----------

export interface Totals {
  /** Trabalho líquido por ciclo, J. */
  W: number;
  /** Calor recebido por ciclo, J. */
  Qin: number;
  /** Rendimento teórico do ciclo. */
  eta: number;
  /** Rendimento de Carnot entre as temperaturas extremas. */
  carnot: number;
  /** Só no vapor: rendimento do motor (W/Q da caldeira). */
  etaMotor: number;
}

export function totals(e: Engine): Totals {
  const c = cyclePoints(e);
  if (e.motor === VAPOR) {
    const W = e.Pb * (c.Vcut - c.Vc) + e.Pb * c.Vcut * Math.log(c.V1 / c.Vcut) - e.Pe * e.Vd;
    const rk = rankine(e.Pb, e.Pe);
    const rhoB = (e.Pb * M_H2O) / (R * rk.Tb), rhoE = (e.Pe * M_H2O) / (R * rk.Te);
    const m = Math.max(1e-12, rhoB * c.Vcut - rhoE * c.Vc);
    const Qin = m * rk.qin;
    return { W, Qin, eta: rk.eta, carnot: 1 - rk.Te / rk.Tb, etaMotor: W / Qin };
  }
  const Qin = e.motor === DIESEL ? c.n * CP * (c.T3 - c.T2) : c.n * CV * (c.T3 - c.T2);
  const Qout = c.n * CV * (c.T4 - T_IN);
  const W = Qin - Qout;
  return { W, Qin, eta: W / Qin, carnot: 1 - T_IN / c.T3, etaMotor: W / Qin };
}

/** Rendimentos em forma fechada (para conferir). */
export const etaOtto = (r: number) => 1 - r ** (1 - GAMMA);
export const etaDiesel = (r: number, rc: number) => 1 - (rc ** GAMMA - 1) / (GAMMA * r ** (GAMMA - 1) * (rc - 1));

/** Potência média no eixo, W. */
export const power = (e: Engine) => totals(e).W * cyclesPerRev(e.motor) * (e.rpm / 60) * e.ncil;

/** ∮P dV por integração numérica ao longo do ângulo do eixo (para conferir o balanço). */
export function workNumeric(e: Engine, n = 20000): number {
  const T = period(e.motor);
  let W = 0;
  let prev = pointAt(e, 0);
  for (let i = 1; i <= n; i++) {
    const q = pointAt(e, (T * i) / n - (i === n ? 1e-12 : 0));
    W += 0.5 * (prev.P + q.P) * (q.V - prev.V);
    prev = q;
  }
  return W;
}
