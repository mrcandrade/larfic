import { commitHistory, num, solveCircuit, type Element, type Params } from "@fisilab/core";

// ---------- Números complexos mínimos ----------
export type Cx = [number, number];
export const cx = (re: number, im = 0): Cx => [re, im];
export const cadd = (a: Cx, b: Cx): Cx => [a[0] + b[0], a[1] + b[1]];
export const cmul = (a: Cx, b: Cx): Cx => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
export const cdiv = (a: Cx, b: Cx): Cx => {
  const d = b[0] * b[0] + b[1] * b[1];
  return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d];
};
export const cabs = (a: Cx) => Math.hypot(a[0], a[1]);
export const carg = (a: Cx) => Math.atan2(a[1], a[0]);
/** Valor instantâneo de um fasor X quando a fonte está na fase φ: Im(X e^{jφ}) (fonte = Vp sen φ). */
export const inst = (a: Cx, phi: number) => a[0] * Math.sin(phi) + a[1] * Math.cos(phi);

// ---------- Parâmetros ----------
export const SERIE = 0,
  PARALELO = 1;
export const topo = (p: Params) => Math.round(num(p, "topologia"));
export const Vp = (p: Params) => num(p, "Vp", 10);
export const freq = (p: Params) => num(p, "f", 1000);
export const R = (p: Params) => num(p, "R", 20);
export const L = (p: Params) => num(p, "L", 10) * 1e-3;
export const C = (p: Params) => num(p, "C", 1) * 1e-6;
export const Rg = (p: Params) => num(p, "Rg", 0);
export const saida = (p: Params) => Math.round(num(p, "saida"));
export const f0 = (p: Params) => 1 / (2 * Math.PI * Math.sqrt(L(p) * C(p)));

/** Fator de qualidade do circuito carregado pelo gerador. */
export function quality(p: Params): number {
  if (topo(p) === SERIE) return Math.sqrt(L(p) / C(p)) / (R(p) + Rg(p));
  const reff = Rg(p) > 0 ? (R(p) * Rg(p)) / (R(p) + Rg(p)) : R(p);
  return reff * Math.sqrt(C(p) / L(p));
}

export interface Phasors {
  /** Impedância vista pela fonte ideal (inclui Rg). */
  Z: Cx;
  Vs: Cx;
  /** Corrente fornecida pela fonte. */
  I: Cx;
  Vg: Cx;
  VR: Cx;
  VL: Cx;
  VC: Cx;
  IR: Cx;
  IL: Cx;
  IC: Cx;
  /** Saída escolhida e função de transferência H = V_saída / V_fonte. */
  Vout: Cx;
  H: Cx;
}

/** Regime permanente senoidal pelo método fasorial (análise exata, sem integrar). */
export function phasors(p: Params, f = freq(p)): Phasors {
  const w = 2 * Math.PI * f;
  const zR = cx(R(p));
  const zL = cx(0, w * L(p));
  const zC = cx(0, -1 / (w * C(p)));
  const Vs = cx(Vp(p));
  const rg = cx(Rg(p));
  if (topo(p) === SERIE) {
    const Z = cadd(cadd(rg, zR), cadd(zL, zC));
    const I = cdiv(Vs, Z);
    const VR = cmul(I, zR);
    const VL = cmul(I, zL);
    const VC = cmul(I, zC);
    const Vout = [VR, VC, VL][saida(p)] ?? VR;
    return { Z, Vs, I, Vg: cmul(I, rg), VR, VL, VC, IR: I, IL: I, IC: I, Vout, H: cdiv(Vout, Vs) };
  }
  const Y = cadd(cadd(cdiv(cx(1), zR), cdiv(cx(1), zL)), cdiv(cx(1), zC));
  const Zp = cdiv(cx(1), Y);
  const Z = cadd(rg, Zp);
  const I = cdiv(Vs, Z);
  const Vt = cmul(I, Zp);
  return {
    Z,
    Vs,
    I,
    Vg: cmul(I, rg),
    VR: Vt,
    VL: Vt,
    VC: Vt,
    IR: cdiv(Vt, zR),
    IL: cdiv(Vt, zL),
    IC: cdiv(Vt, zC),
    Vout: Vt,
    H: cdiv(Vt, Vs),
  };
}

// ---------- Transiente (MNA, regra do trapézio) ----------
/** Estado (vetor). */
export const TF = 0, // tempo físico (s)
  PH = 1, // fase da fonte φ (rad), acumulada
  VCAP = 2, // tensão no capacitor
  ICAP = 3, // corrente no capacitor (NaN antes do primeiro passo)
  IIND = 4, // corrente no indutor
  VIND = 5, // tensão no indutor (NaN antes do primeiro passo)
  VS = 6, // tensão da fonte
  IS = 7, // corrente fornecida pela fonte
  VRES = 8, // tensão no resistor
  IRES = 9; // corrente no resistor

/** Ciclos da fonte por segundo de animação (câmera lenta). */
export const ritmo = (p: Params) => num(p, "ritmo", 0.5);

function elements(p: Params, s: number[], vs: number): Element[] {
  const ic = Number.isNaN(s[ICAP]!) ? undefined : s[ICAP]!;
  const vl = Number.isNaN(s[VIND]!) ? undefined : s[VIND]!;
  const src: Element = { kind: "V", a: 1, b: 0, V: vs, R: Rg(p) };
  if (topo(p) === SERIE)
    return [
      src,
      { kind: "R", a: 1, b: 2, R: R(p) },
      { kind: "L", a: 2, b: 3, L: L(p), i0: s[IIND]!, v0: vl },
      { kind: "C", a: 3, b: 0, C: C(p), v0: s[VCAP]!, i0: ic },
    ];
  return [
    src,
    { kind: "R", a: 1, b: 0, R: R(p) },
    { kind: "L", a: 1, b: 0, L: L(p), i0: s[IIND]!, v0: vl },
    { kind: "C", a: 1, b: 0, C: C(p), v0: s[VCAP]!, i0: ic },
  ];
}

/** Um passo físico de duração h (s): a fonte avança 2πf·h em fase. */
export function stepPhysical(s: number[], p: Params, h: number): number[] {
  const out = s.slice();
  const phi = s[PH]! + 2 * Math.PI * freq(p) * h;
  const vs = Vp(p) * Math.sin(phi);
  const els = elements(p, s, vs);
  const sol = solveCircuit(topo(p) === SERIE ? 4 : 2, els, h);
  commitHistory(els, sol);
  const eL = els[2] as Element & { kind: "L" };
  const eC = els[3] as Element & { kind: "C" };
  out[TF]! += h;
  out[PH] = phi;
  out[VCAP] = eC.v0;
  out[ICAP] = eC.i0 ?? 0;
  out[IIND] = eL.i0;
  out[VIND] = eL.v0 ?? 0;
  out[VS] = vs;
  out[IS] = -sol.i[0]!;
  out[VRES] = sol.dv[1]!;
  out[IRES] = sol.i[1]!;
  return out;
}

/** Passo do runner: dt de animação vira dt·ritmo/f de tempo físico. */
export function step(s: number[], p: Params, dt: number): number[] {
  return stepPhysical(s, p, (dt * ritmo(p)) / freq(p));
}

export function init(p: Params): number[] {
  if (Math.round(num(p, "inicio")) === 1) {
    // Já em regime permanente, com a fonte em φ = 0
    const ph = phasors(p);
    return [0, 0, inst(ph.VC, 0), inst(ph.IC, 0), inst(ph.IL, 0), inst(ph.VL, 0), 0, inst(ph.I, 0), inst(ph.VR, 0), inst(ph.IR, 0)];
  }
  return [0, 0, 0, NaN, 0, NaN, 0, 0, 0, 0];
}

/** Tensão no indutor no estado atual (série: v_L = v_s − Rg i − v_R − v_C). */
export const vInd = (s: number[], p: Params) =>
  topo(p) === SERIE ? s[VS]! - Rg(p) * s[IS]! - s[VRES]! - s[VCAP]! : s[VCAP]!;
export const iCap = (s: number[], p: Params) => (topo(p) === SERIE ? s[IS]! : s[IS]! - s[IRES]! - s[IIND]!);
export function vOut(s: number[], p: Params): number {
  if (topo(p) === PARALELO) return s[VCAP]!;
  return [s[VRES]!, s[VCAP]!, vInd(s, p)][saida(p)] ?? s[VRES]!;
}
