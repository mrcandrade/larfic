import { num, solveCircuit, type Element, type Params } from "@fisilab/core";

/**
 * Ponte de Wheatstone com galvanômetro de ponteiro e circuito de duas malhas
 * para verificar as leis de Kirchhoff. Os dois circuitos são resolvidos por
 * análise nodal (MNA do núcleo); o ponteiro do galvanômetro é um oscilador
 * amortecido que segue a corrente.
 *
 * Ponte: nós 1 = A (+ da fonte), 2 = B, 3 = D, 0 = C (− da fonte).
 *   R1: A–B, R2: B–C, R3 (década): A–D, Rx: D–C, galvanômetro: B–D.
 *   Equilíbrio (I_g = 0): R1/R2 = R3/Rx ⇒ Rx = R3·R2/R1.
 */

/** Estado: tempo, deflexão do ponteiro (div), velocidade do ponteiro (div/s), chave do galvanômetro (1 fechada). */
export const T = 0,
  TH = 1,
  OM = 2,
  KEY = 3;

/** Amostras de resistência desconhecida: valor nominal (código de cores) e valor verdadeiro, escondido do aluno. */
export const AMOSTRAS = [
  { nome: "A", nominal: 330, real: 327.4 },
  { nome: "B", nominal: 1000, real: 1013 },
  { nome: "C", nominal: 4700, real: 4652 },
  { nome: "D", nominal: 47, real: 47.83 },
  { nome: "E", nominal: 2200, real: 2186 },
  { nome: "F", nominal: 10000, real: 9890 },
] as const;

export const amostra = (p: Params) => AMOSTRAS[Math.min(AMOSTRAS.length - 1, Math.max(0, Math.round(num(p, "rx"))))]!;
export const Rx = (p: Params) => amostra(p).real;

export const kirchhoff = (p: Params) => Math.round(num(p, "modo")) === 1;
export const E = (p: Params) => num(p, "E", 6);
export const R1 = (p: Params) => num(p, "R1", 1000);
export const R2 = (p: Params) => num(p, "R2", 1000);
export const R3 = (p: Params) => Math.max(1, num(p, "R3", 1000));
export const R4 = (p: Params) => num(p, "R4", 470);
export const E2 = (p: Params) => num(p, "E2", 4.5);

/** Resistência interna da fonte da ponte (Ω). */
export const R_FONTE = 0.5;
/** Galvanômetro: resistência da bobina (Ω), corrente por divisão sem shunt (A) e escala (±div). */
export const RG = 100;
export const I_DIV = 1e-6;
export const FULL = 30;
/** Com shunt (Rg/99 em paralelo), só 1 % da corrente passa pela bobina. */
export const shunted = (p: Params) => Math.round(num(p, "sens")) === 0;
export const galvR = (p: Params) => (shunted(p) ? RG / 100 : RG);
/** Corrente no ramo do galvanômetro que dá uma divisão de deflexão. */
export const ampsPerDiv = (p: Params) => (shunted(p) ? 100 * I_DIV : I_DIV);
/** Ponteiro: frequência natural (rad/s) e amortecimento. */
export const W0 = 2 * Math.PI * 1.2;
export const ZETA = 0.65;

export interface BridgeSol {
  /** Corrente no galvanômetro, de B para D (A). */
  Ig: number;
  Vb: number;
  Vd: number;
  Va: number;
  /** Corrente fornecida pela fonte (A). */
  If: number;
  /** Correntes nos braços (sentido A→B→C e A→D→C). */
  i1: number;
  i2: number;
  i3: number;
  ix: number;
}

export function solveBridge(p: Params, keyClosed: boolean): BridgeSol {
  const els: Element[] = [
    { kind: "V", a: 1, b: 0, V: E(p), R: R_FONTE },
    { kind: "R", a: 1, b: 2, R: R1(p) },
    { kind: "R", a: 2, b: 0, R: R2(p) },
    { kind: "R", a: 1, b: 3, R: R3(p) },
    { kind: "R", a: 3, b: 0, R: Rx(p) },
  ];
  if (keyClosed) els.push({ kind: "R", a: 2, b: 3, R: galvR(p) });
  const s = solveCircuit(4, els);
  return {
    Ig: keyClosed ? s.i[5]! : 0,
    Va: s.v[1]!,
    Vb: s.v[2]!,
    Vd: s.v[3]!,
    If: -s.i[0]!,
    i1: s.i[1]!,
    i2: s.i[2]!,
    i3: s.i[3]!,
    ix: s.i[4]!,
  };
}

/**
 * Circuito de duas malhas: nós 1 = + de E1, 2 = nó b, 3 = nó c, 4 = + de E2.
 * E1: 1–0, R1: 1–2, R3: 2–0, R4: 2–3, R2: 3–4, E2: 4–0.
 * I1 entra em b vindo de R1, I2 entra em b vindo de R4, I3 sai de b por R3.
 */
export interface KirchSol {
  I1: number;
  I2: number;
  I3: number;
  Vb: number;
  Vc: number;
  /** Lei dos nós em b: I1 + I2 − I3. */
  no: number;
  /** Lei das malhas: E1 − R1 I1 − R3 I3 e E2 − (R2 + R4) I2 − R3 I3. */
  m1: number;
  m2: number;
}

export function solveKirchhoff(p: Params): KirchSol {
  const els: Element[] = [
    { kind: "V", a: 1, b: 0, V: E(p) },
    { kind: "R", a: 1, b: 2, R: R1(p) },
    { kind: "R", a: 2, b: 0, R: R3(p) },
    { kind: "R", a: 2, b: 3, R: R4(p) },
    { kind: "R", a: 3, b: 4, R: R2(p) },
    { kind: "V", a: 4, b: 0, V: E2(p) },
  ];
  const s = solveCircuit(5, els);
  const I1 = s.i[1]!;
  const I3 = s.i[2]!;
  const I2 = -s.i[3]!;
  return {
    I1,
    I2,
    I3,
    Vb: s.v[2]!,
    Vc: s.v[3]!,
    no: I1 + I2 - I3,
    m1: E(p) - R1(p) * I1 - R3(p) * I3,
    m2: E2(p) - (R2(p) + R4(p)) * I2 - R3(p) * I3,
  };
}

/** Solução analítica do circuito de duas malhas (para conferência): tensão no nó b. */
export function vbAnalytic(p: Params): number {
  const Rr = R2(p) + R4(p);
  return (E(p) / R1(p) + E2(p) / Rr) / (1 / R1(p) + 1 / R3(p) + 1 / Rr);
}

const memo = new WeakMap<object, { p: Params; key: boolean; b: BridgeSol }>();
export function bridge(s: number[], p: Params): BridgeSol {
  const key = s[KEY]! > 0.5;
  const m = memo.get(s);
  if (m && m.p === p && m.key === key) return m.b;
  const b = solveBridge(p, key);
  memo.set(s, { p, key, b });
  return b;
}

/** Deflexão de equilíbrio do ponteiro (div), limitada pelos batentes. */
export function targetDefl(p: Params, Ig: number): number {
  return Math.max(-FULL - 2, Math.min(FULL + 2, Ig / ampsPerDiv(p)));
}

export function init(p: Params): number[] {
  const s = [0, 0, 0, 1];
  if (!kirchhoff(p)) s[TH] = Math.max(-FULL, Math.min(FULL, targetDefl(p, solveBridge(p, true).Ig)));
  return s;
}

export function step(s: number[], p: Params, dt: number): number[] {
  const out = s.slice();
  out[T] = s[T]! + dt;
  const target = kirchhoff(p) ? 0 : targetDefl(p, bridge(s, p).Ig);
  let th = s[TH]!;
  let om = s[OM]!;
  const n = 8;
  const h = dt / n;
  for (let k = 0; k < n; k++) {
    // Semi-implícito (Euler simplético) para o oscilador amortecido do ponteiro
    om += h * (W0 * W0 * (target - th) - 2 * ZETA * W0 * om);
    th += h * om;
    if (Math.abs(th) > FULL) {
      th = Math.sign(th) * FULL;
      om = 0;
    }
  }
  out[TH] = th;
  out[OM] = om;
  return out;
}

/** R3 (inteiro, em ohms) que equilibra a ponte para a amostra e a razão dadas. */
export const balanceR3 = (p: Params) => Math.round((Rx(p) * R1(p)) / R2(p));
