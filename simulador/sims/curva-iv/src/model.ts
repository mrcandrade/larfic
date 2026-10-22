import { num, solveCircuit, type Element, type Params } from "@fisilab/core";

/**
 * Levantamento de curva I–V: fonte DC → resistor de proteção Rp → amperímetro
 * (resistência interna Ra) → componente sob teste, com voltímetro (Rv) ligado
 * a jusante (direto no componente) ou a montante (antes do amperímetro).
 *
 * A rede linear (fonte, Rp, Ra, Rv) é resolvida por análise nodal (MNA do
 * núcleo); o componente não linear é resolvido contra o equivalente de
 * Thévenin dessa rede por bissecção, e depois a rede é resolvida de novo com
 * o componente trocado pela corrente encontrada, para obter as leituras.
 */

export interface IVState {
  t: number;
  /** Temperatura do filamento da lâmpada (K). */
  Tf: number;
  /** Chave da fonte: 1 ligada, 0 desligada. */
  on: number;
  /** Varredura automática em andamento (1) e tensão atual da varredura (V). */
  sweep: number;
  vsw: number;
  /** Pontos (V, I) registrados pelo traçador, nas leituras dos instrumentos. */
  pts: [number, number][];
}

export const COMP = ["Resistor ôhmico", "Lâmpada incandescente 12 V / 0,1 A", "Diodo de silício (1N4148)", "LED vermelho", "Diodo Zener 5,1 V"] as const;
export const comp = (p: Params) => Math.min(4, Math.max(0, Math.round(num(p, "comp"))));

export const VT = 0.025852; // kT/e a 300 K
export const T0 = 300;

/** Lâmpada: R(T) = R0 (T/T0)^1,2 (tungstênio); perdas por radiação e condução. */
export const LAMP = { R0: 8.6, alpha: 1.2, sigmaA: 1.81e-14, G: 1e-4, Cth: 4.6e-5 };

export interface DiodeModel {
  Is: number;
  n: number;
  Rs: number;
  /** Ruptura reversa (Zener): |V| de ruptura, corrente nela e fator de idealidade. */
  Vz?: number;
  Iz?: number;
  nz?: number;
}

export const DIODES: Record<number, DiodeModel> = {
  2: { Is: 2.52e-9, n: 1.752, Rs: 0.3 },
  3: { Is: 2.9e-18, n: 2.0, Rs: 6 },
  4: { Is: 2.52e-9, n: 1.752, Rs: 1, Vz: 5.1, Iz: 5e-3, nz: 1.5 },
};

const safeExp = (x: number) => Math.exp(Math.min(x, 80));

/** Corrente na junção (sem a resistência série) em função da tensão na junção. */
export function junctionI(m: DiodeModel, vj: number): number {
  let i = m.Is * (safeExp(vj / (m.n * VT)) - 1);
  if (m.Vz !== undefined) i -= m.Iz! * safeExp((-vj - m.Vz) / (m.nz! * VT));
  return i;
}

/** Resistência da lâmpada na temperatura T. */
export const lampR = (T: number) => LAMP.R0 * (T / T0) ** LAMP.alpha;
/** Potência perdida pelo filamento a T (radiação + condução pelos suportes). */
export const lampLoss = (T: number) => LAMP.sigmaA * (T ** 4 - T0 ** 4) + LAMP.G * (T - T0);

export const montante = (p: Params) => Math.round(num(p, "montagem")) === 1;
export const Rp = (p: Params) => num(p, "Rp", 100);
export const Ra = (p: Params) => num(p, "Ra", 1);
export const Rv = (p: Params) => num(p, "Rv", 1e7);

/** Tensão aplicada pela fonte. */
export const sourceV = (s: IVState, p: Params) => (s.on < 0.5 ? 0 : s.sweep > 0.5 ? s.vsw : num(p, "Vf", 5));

/**
 * Rede linear com o componente trocado por `dut` entre os nós 3 e 0.
 * Nós: 1 = + da fonte, 2 = depois de Rp, 3 = depois do amperímetro (componente).
 * Elementos: 0 fonte, 1 Rp, 2 amperímetro, 3 voltímetro, 4 componente.
 */
function network(Vs: number, p: Params, dut: Element): Element[] {
  return [
    { kind: "V", a: 1, b: 0, V: Vs },
    { kind: "R", a: 1, b: 2, R: Rp(p) },
    { kind: "R", a: 2, b: 3, R: Ra(p) },
    { kind: "R", a: montante(p) ? 2 : 3, b: 0, R: Rv(p) },
    dut,
  ];
}

/** Equivalente de Thévenin visto pelo componente. */
export function thevenin(Vs: number, p: Params): { Vth: number; Rth: number } {
  const open = solveCircuit(4, network(Vs, p, { kind: "I", a: 3, b: 0, I: 0 }));
  const short = solveCircuit(4, network(Vs, p, { kind: "V", a: 3, b: 0, V: 0 }));
  const Vth = open.v[3]!;
  const Isc = short.i[4]!;
  // Com Vs = 0, Isc = 0: obtém Rth injetando 1 A
  if (Math.abs(Isc) < 1e-15) {
    const inj = solveCircuit(4, network(0, p, { kind: "I", a: 0, b: 3, I: 1 }));
    return { Vth, Rth: inj.v[3]! };
  }
  return { Vth, Rth: Vth / Isc };
}

/** Corrente no componente (sentido nó 3 → terra) dada a tensão externa de Thévenin. */
export function dutCurrent(c: number, Tf: number, Vth: number, Rth: number): { I: number; V: number } {
  if (c === 0 || c === 1) return { I: 0, V: 0 }; // tratado como linear fora daqui
  const m = DIODES[c]!;
  // g(vj) = Vth − vj − (Rs + Rth) i(vj) é decrescente: bissecção no intervalo entre 0 e Vth
  let lo = Math.min(0, Vth);
  let hi = Math.max(0, Vth);
  const g = (vj: number) => Vth - vj - (m.Rs + Rth) * junctionI(m, vj);
  for (let k = 0; k < 120; k++) {
    const mid = (lo + hi) / 2;
    if (g(mid) > 0) lo = mid;
    else hi = mid;
  }
  const vj = (lo + hi) / 2;
  const I = junctionI(m, vj);
  return { I, V: vj + m.Rs * I };
}

export interface Reading {
  Vs: number;
  /** Indicações dos instrumentos. */
  Vm: number;
  Im: number;
  /** Valores verdadeiros no componente. */
  Vc: number;
  Ic: number;
  /** Resistência do componente (linear) ou NaN. */
  Rlin: number;
}

/** Resistência ôhmica do componente linear no estado atual. */
function linearR(c: number, p: Params, Tf: number): number {
  return c === 0 ? num(p, "Rx", 470) : lampR(Tf);
}

export function solve(s: IVState, p: Params): Reading {
  const Vs = sourceV(s, p);
  const c = comp(p);
  let dut: Element;
  let Rlin = NaN;
  if (c <= 1) {
    Rlin = linearR(c, p, s.Tf);
    dut = { kind: "R", a: 3, b: 0, R: Rlin };
  } else {
    const th = thevenin(Vs, p);
    dut = { kind: "I", a: 3, b: 0, I: dutCurrent(c, s.Tf, th.Vth, th.Rth).I };
  }
  const sol = solveCircuit(4, network(Vs, p, dut));
  const Vc = sol.v[3]!;
  const Ic = sol.i[4]!;
  const Im = sol.i[2]!;
  const Vm = montante(p) ? sol.v[2]! : sol.v[3]!;
  return { Vs, Vm, Im, Vc, Ic, Rlin };
}

const memo = new WeakMap<object, { p: Params; r: Reading }>();
/** `solve` com memória por estado (os observáveis consultam o mesmo estado várias vezes). */
export function reading(s: IVState, p: Params): Reading {
  const m = memo.get(s);
  if (m && m.p === p) return m.r;
  const r = solve(s, p);
  memo.set(s, { p, r });
  return r;
}

/** Potência dissipada no filamento quando ele está a T (circuito resolvido nessa temperatura). */
function lampPower(T: number, Vs: number, p: Params): number {
  const th = thevenin(Vs, p);
  const R = lampR(T);
  const I = th.Vth / (th.Rth + R);
  return I * I * R;
}

/** Temperatura de equilíbrio do filamento para a tensão Vs (bissecção em T). */
export function lampEquilibrium(Vs: number, p: Params): number {
  let lo = T0;
  let hi = 4000;
  if (lampPower(lo, Vs, p) <= 0) return T0;
  for (let k = 0; k < 80; k++) {
    const mid = (lo + hi) / 2;
    if (lampPower(mid, Vs, p) - lampLoss(mid) > 0) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export const SWEEP_V = 12;
export const SWEEP_TIME = 10;

export function init(p: Params): IVState {
  const s: IVState = { t: 0, Tf: T0, on: 1, sweep: 0, vsw: -SWEEP_V, pts: [] };
  if (comp(p) === 1) s.Tf = lampEquilibrium(sourceV(s, p), p);
  const r = solve(s, p);
  s.pts.push([r.Vm, r.Im]);
  return s;
}

export function step(s: IVState, p: Params, dt: number): IVState {
  const out: IVState = { ...s, pts: s.pts };
  out.t = s.t + dt;
  if (s.sweep > 0.5) {
    out.vsw = s.vsw + ((2 * SWEEP_V) / SWEEP_TIME) * dt;
    if (out.vsw >= SWEEP_V) {
      out.vsw = SWEEP_V;
      out.sweep = 0;
    }
  }
  if (comp(p) === 1) {
    // Balanço térmico do filamento: C dT/dt = I²R(T) − perdas(T), em subpassos de ponto médio
    const Vs = sourceV(out, p);
    const n = 8;
    const h = dt / n;
    let T = s.Tf;
    const f = (T: number) => (lampPower(T, Vs, p) - lampLoss(T)) / LAMP.Cth;
    for (let k = 0; k < n; k++) {
      const mid = Math.max(T0 * 0.5, T + 0.5 * h * f(T));
      T = Math.max(T0 * 0.5, T + h * f(mid));
    }
    out.Tf = T;
  }
  const r = solve(out, p);
  const last = s.pts[s.pts.length - 1];
  if (!last || Math.abs(r.Vm - last[0]) > 0.04 || Math.abs(r.Im - last[1]) > 2e-4) {
    out.pts = [...s.pts, [r.Vm, r.Im]];
    if (out.pts.length > 800) out.pts = out.pts.slice(-800);
  }
  return out;
}
