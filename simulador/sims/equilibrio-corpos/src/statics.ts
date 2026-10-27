import { clamp, num, type Params } from "@fisilab/core";

/** Física da estática: cada modo devolve forças (para o DCL), reações e diagnóstico. */

export const G = 9.81;

export type ForceKind = "peso" | "reacao" | "atrito" | "tensao";

export interface Force {
  /** Ponto de aplicação (m). */
  x: number;
  y: number;
  /** Componentes (N). */
  fx: number;
  fy: number;
  label: string;
  kind: ForceKind;
  /** true: a ponta da seta fica no ponto (apoios que empurram). */
  head?: boolean;
}

export interface EqState {
  /** Pivô da gangorra ou apoio A da viga (m, ao longo do corpo). */
  xa: number;
  /** Apoio B da viga (m). */
  xb: number;
  /** Posição das massas 1 e 2 (m, ao longo do corpo). */
  x1: number;
  x2: number;
  /** Ângulo da escada com o chão ou da lança com a horizontal (rad). */
  ang: number;
  /** Altura do ponto de fixação do cabo no mastro (m). */
  H: number;
  /** Nós da treliça onde estão as cargas 1 e 2. */
  n1: number;
  n2: number;
  drag: { kind: string } | null;
}

export interface Result {
  forces: Force[];
  /** Reação no apoio 1 e 2 (N), força auxiliar (atrito, tensão ou maior força de barra). */
  R1: number;
  R2: number;
  F: number;
  muMin: number;
  /** Torque resultante das cargas em relação ao pivô (gangorra), N·m. */
  tau: number;
  ok: boolean;
  msgs: string[];
  /** Posição de equilíbrio da massa 2 na gangorra (NaN se não existir). */
  x2eq: number;
  /** Inclinação da gangorra (rad). */
  tilt: number;
  /** Altura máxima ao longo da escada que a pessoa alcança sem escorregar (m). */
  climbMax: number;
  /** Forças nas barras da treliça (N, tração positiva). */
  bars: number[];
}

export const modeOf = (p: Params) => Math.round(num(p, "modo"));
export const lenOf = (p: Params) => num(p, "L", 4);

const base = (): Result => ({ forces: [], R1: 0, R2: 0, F: 0, muMin: 0, tau: 0, ok: true, msgs: [], x2eq: NaN, tilt: 0, climbMax: NaN, bars: [] });

/** Altura do topo do pivô da gangorra. */
export const PIVOT_H = 0.5;

/** Ponto do corpo da gangorra a uma distância u da ponta esquerda, já inclinado. */
export function seesawPoint(s: EqState, tilt: number, u: number): [number, number] {
  return [s.xa + (u - s.xa) * Math.cos(tilt), PIVOT_H + (u - s.xa) * Math.sin(tilt)];
}

export function solveSeesaw(s: EqState, p: Params): Result {
  const r = base();
  const L = lenOf(p);
  const mc = num(p, "mc"), m1 = num(p, "m1"), m2 = num(p, "m2");
  const W = [mc * G, m1 * G, m2 * G];
  const X = [L / 2, s.x1, s.x2];
  // Torque das cargas em torno do pivô (anti-horário positivo).
  const tau = -W.reduce((acc, w, i) => acc + w * (X[i]! - s.xa), 0);
  const Wt = W[0]! + W[1]! + W[2]!;
  r.tau = tau;
  r.x2eq = m2 > 0 ? s.xa + (-(W[0]! * (X[0]! - s.xa)) - W[1]! * (X[1]! - s.xa)) / W[2]! : NaN;
  const balanced = Math.abs(tau) <= 1e-9 * Math.max(1, Wt * L);
  let Ng = 0;
  let xe = 0;
  if (!balanced) {
    // A ponta do lado mais pesado encosta no chão.
    xe = tau < 0 ? L : 0;
    const arm = Math.abs(xe - s.xa);
    r.tilt = (tau < 0 ? -1 : 1) * Math.asin(clamp(PIVOT_H / Math.max(arm, 1e-6), 0, Math.sin((60 * Math.PI) / 180)));
    Ng = -tau / (xe - s.xa || 1e-9);
    r.msgs.push(`A gangorra tomba para a ${tau < 0 ? "direita" : "esquerda"} e a ponta apoia no chão.`);
  }
  const Np = Wt - Ng;
  r.R1 = Np;
  r.R2 = Ng;
  r.ok = balanced;
  if (!Number.isFinite(r.x2eq) || r.x2eq < 0 || r.x2eq > L) {
    r.msgs.push("Equilíbrio impossível: nenhuma posição da massa 2 sobre a prancha equilibra a gangorra.");
  }
  const names = ["P prancha", "P₁", "P₂"];
  W.forEach((w, i) => {
    if (w <= 0) return;
    const [x, y] = seesawPoint(s, r.tilt, X[i]!);
    r.forces.push({ x, y, fx: 0, fy: -w, label: `${names[i]} = ${fmtN(w)}`, kind: "peso" });
  });
  r.forces.push({ x: s.xa, y: PIVOT_H, fx: 0, fy: Np, label: `N pivô = ${fmtN(Np)}`, kind: "reacao", head: true });
  if (Ng > 0) {
    const [x, y] = seesawPoint(s, r.tilt, xe);
    r.forces.push({ x, y, fx: 0, fy: Ng, label: `N chão = ${fmtN(Ng)}`, kind: "reacao", head: true });
  }
  return r;
}

/** Escada: parede lisa em x = 0, pé no chão em x = −L cosθ. */
export function ladderPoint(s: EqState, L: number, u: number): [number, number] {
  return [-L * Math.cos(s.ang) + u * Math.cos(s.ang), u * Math.sin(s.ang)];
}

export function solveLadder(s: EqState, p: Params): Result {
  const r = base();
  const L = lenOf(p);
  const Wc = num(p, "mc") * G, W1 = num(p, "m1") * G;
  const mu = num(p, "mu", 0.4);
  const d = clamp(s.x1, 0, L);
  const c = Math.cos(s.ang), sn = Math.sin(s.ang);
  const Nw = ((Wc * L) / 2 + W1 * d) * c / (L * sn);
  const Nf = Wc + W1;
  const f = Nw;
  r.R1 = Nf;
  r.R2 = Nw;
  r.F = f;
  r.muMin = Nf > 0 ? f / Nf : 0;
  r.climbMax = W1 > 0 ? (mu * Nf * L * sn - (Wc * L * c) / 2) / (W1 * c) : NaN;
  r.ok = r.muMin <= mu + 1e-12;
  if (!r.ok) r.msgs.push(`A escada escorrega: precisa de μ ≥ ${fmt(r.muMin, 3)}, mas o chão tem μ = ${fmt(mu, 2)}.`);
  const foot = ladderPoint(s, L, 0), top = ladderPoint(s, L, L);
  const cm = ladderPoint(s, L, L / 2), pp = ladderPoint(s, L, d);
  if (Wc > 0) r.forces.push({ x: cm[0], y: cm[1], fx: 0, fy: -Wc, label: `P escada = ${fmtN(Wc)}`, kind: "peso" });
  if (W1 > 0) r.forces.push({ x: pp[0], y: pp[1], fx: 0, fy: -W1, label: `P pessoa = ${fmtN(W1)}`, kind: "peso" });
  r.forces.push({ x: top[0], y: top[1], fx: -Nw, fy: 0, label: `N parede = ${fmtN(Nw)}`, kind: "reacao", head: true });
  r.forces.push({ x: foot[0], y: foot[1], fx: 0, fy: Nf, label: `N chão = ${fmtN(Nf)}`, kind: "reacao", head: true });
  r.forces.push({ x: foot[0], y: foot[1], fx: Math.min(f, mu * Nf), fy: 0, label: `f${r.ok ? "" : " máx"} = ${fmtN(Math.min(f, mu * Nf))}`, kind: "atrito" });
  return r;
}

export const BEAM_Y = 0.6;

/** Momento fletor M(x) da viga a partir das forças verticais (positivas para cima). */
export function bendingMoment(loads: { x: number; F: number }[], x: number): number {
  let M = 0;
  for (const l of loads) if (l.x < x) M += l.F * (x - l.x);
  return M;
}

export function beamLoads(s: EqState, p: Params): { x: number; F: number; label: string }[] {
  const L = lenOf(p);
  return [
    { x: L / 2, F: -num(p, "mc") * G, label: "P viga" },
    { x: s.x1, F: -num(p, "m1") * G, label: "P₁" },
    { x: s.x2, F: -num(p, "m2") * G, label: "P₂" },
  ];
}

export function solveBeam(s: EqState, p: Params): Result {
  const r = base();
  const loads = beamLoads(s, p);
  const W = -loads.reduce((a, l) => a + l.F, 0);
  const span = s.xb - s.xa;
  if (Math.abs(span) < 1e-6) {
    r.ok = false;
    r.msgs.push("Equilíbrio impossível: com os dois apoios no mesmo ponto a viga gira em torno dele.");
    r.R1 = W;
    r.R2 = 0;
  } else {
    // Momentos em torno de A: R_B (x_B − x_A) = Σ P_i (x_i − x_A)
    const RB = -loads.reduce((a, l) => a + l.F * (l.x - s.xa), 0) / span;
    r.R1 = W - RB;
    r.R2 = RB;
    if (r.R1 < -1e-9 || r.R2 < -1e-9) {
      r.ok = false;
      const which = r.R1 < 0 ? "A" : "B";
      r.msgs.push(`Equilíbrio impossível: o apoio ${which} teria de puxar a viga para baixo (${fmtN(Math.min(r.R1, r.R2))}). Ela tomba sobre o outro apoio.`);
    }
  }
  for (const l of loads) if (l.F < 0) r.forces.push({ x: l.x, y: BEAM_Y, fx: 0, fy: l.F, label: `${l.label} = ${fmtN(-l.F)}`, kind: "peso" });
  r.forces.push({ x: s.xa, y: BEAM_Y - 0.08, fx: 0, fy: r.R1, label: `R_A = ${fmtN(r.R1)}`, kind: "reacao", head: r.R1 >= 0 });
  r.forces.push({ x: s.xb, y: BEAM_Y - 0.08, fx: 0, fy: r.R2, label: `R_B = ${fmtN(r.R2)}`, kind: "reacao", head: r.R2 >= 0 });
  return r;
}

/** Guindaste: articulação da lança na base do mastro (origem), cabo da ponta até (0, H). */
export function craneGeometry(s: EqState, p: Params) {
  const L = lenOf(p);
  const tip: [number, number] = [L * Math.cos(s.ang), L * Math.sin(s.ang)];
  const C: [number, number] = [0, s.H];
  const dx = C[0] - tip[0], dy = C[1] - tip[1];
  const n = Math.hypot(dx, dy) || 1;
  return { L, tip, C, u: [dx / n, dy / n] as [number, number] };
}

export function solveCrane(s: EqState, p: Params): Result {
  const r = base();
  const { L, tip, u } = craneGeometry(s, p);
  const W1 = num(p, "m1") * G, Wc = num(p, "mc") * G;
  const d = clamp(s.x1, 0, L);
  const c = Math.cos(s.ang);
  // Torque em torno da articulação: T (tip × u) = W₁ d cosα + W_c (L/2) cosα
  const arm = tip[0] * u[1] - tip[1] * u[0];
  const need = W1 * d * c + (Wc * L * c) / 2;
  const Tmax = num(p, "Tmax", 10) * 1000;
  if (arm <= 1e-6 * L) {
    r.ok = false;
    r.msgs.push("Equilíbrio impossível: o cabo está alinhado com a lança (ou abaixo dela) e não produz torque.");
    r.F = Infinity;
  } else {
    const T = need / arm;
    r.F = T;
    const Hx = -T * u[0], Hy = W1 + Wc - T * u[1];
    r.R1 = Math.hypot(Hx, Hy);
    r.R2 = Hy;
    if (T > Tmax) {
      r.ok = false;
      r.msgs.push(`O cabo rompe: a tensão necessária (${fmtN(T)}) passa da resistência (${fmtN(Tmax)}).`);
    }
    r.forces.push({ x: tip[0], y: tip[1], fx: T * u[0], fy: T * u[1], label: `T = ${fmtN(T)}`, kind: "tensao" });
    r.forces.push({ x: 0, y: 0, fx: Hx, fy: Hy, label: `R articulação = ${fmtN(r.R1)}`, kind: "reacao", head: true });
  }
  const cm: [number, number] = [tip[0] / 2, tip[1] / 2];
  const pt: [number, number] = [d * Math.cos(s.ang), d * Math.sin(s.ang)];
  if (Wc > 0) r.forces.push({ x: cm[0], y: cm[1], fx: 0, fy: -Wc, label: `P lança = ${fmtN(Wc)}`, kind: "peso" });
  if (W1 > 0) r.forces.push({ x: pt[0], y: pt[1], fx: 0, fy: -W1, label: `P carga = ${fmtN(W1)}`, kind: "peso" });
  return r;
}

/** Treliça Warren de dois painéis: nós A, B, C embaixo e D, E em cima. */
export function trussNodes(p: Params): [number, number][] {
  const L = lenOf(p);
  const h = (L / 2) * (Math.sqrt(3) / 2);
  return [
    [0, 0],
    [L / 2, 0],
    [L, 0],
    [L / 4, h],
    [(3 * L) / 4, h],
  ];
}
export const TRUSS_BARS: [number, number][] = [
  [0, 1],
  [1, 2],
  [0, 3],
  [1, 3],
  [3, 4],
  [1, 4],
  [2, 4],
];
export const NODE_NAMES = ["A", "B", "C", "D", "E"];

/** Eliminação de Gauss com pivoteamento parcial. */
export function solveLinear(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]!]);
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r]![c]!) > Math.abs(M[piv]![c]!)) piv = r;
    [M[c], M[piv]] = [M[piv]!, M[c]!];
    const d = M[c]![c]!;
    if (Math.abs(d) < 1e-12) return new Array<number>(n).fill(NaN);
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r]![c]! / d;
      for (let k = c; k <= n; k++) M[r]![k]! -= f * M[c]![k]!;
    }
  }
  return M.map((row, i) => row[n]! / row[i]!);
}

/** Método dos nós: incógnitas = 7 forças de barra (tração +), A_x, A_y, C_y. */
export function solveTruss(s: EqState, p: Params): Result {
  const r = base();
  const nodes = trussNodes(p);
  const n = nodes.length;
  const m = TRUSS_BARS.length;
  const A: number[][] = Array.from({ length: 2 * n }, () => new Array<number>(m + 3).fill(0));
  const b = new Array<number>(2 * n).fill(0);
  TRUSS_BARS.forEach(([i, j], k) => {
    const dx = nodes[j]![0] - nodes[i]![0], dy = nodes[j]![1] - nodes[i]![1];
    const len = Math.hypot(dx, dy);
    A[2 * i]![k] = dx / len;
    A[2 * i + 1]![k] = dy / len;
    A[2 * j]![k] = -dx / len;
    A[2 * j + 1]![k] = -dy / len;
  });
  A[0]![m] = 1; // A_x
  A[1]![m + 1] = 1; // A_y
  A[5]![m + 2] = 1; // C_y (nó 2)
  const W1 = num(p, "m1") * G, W2 = num(p, "m2") * G;
  b[2 * s.n1 + 1]! += W1;
  b[2 * s.n2 + 1]! += W2;
  const x = solveLinear(A, b);
  r.bars = x.slice(0, m);
  r.R1 = x[m + 1]!;
  r.R2 = x[m + 2]!;
  r.F = Math.max(...r.bars.map(Math.abs));
  r.ok = x.every(Number.isFinite);
  const add = (node: number, w: number, label: string) => {
    if (w > 0) r.forces.push({ x: nodes[node]![0], y: nodes[node]![1], fx: 0, fy: -w, label: `${label} = ${fmtN(w)}`, kind: "peso" });
  };
  add(s.n1, W1, "P₁");
  add(s.n2, W2, "P₂");
  r.forces.push({ x: 0, y: 0, fx: 0, fy: r.R1, label: `A_y = ${fmtN(r.R1)}`, kind: "reacao", head: true });
  if (Math.abs(x[m]!) > 1e-6) r.forces.push({ x: 0, y: 0, fx: x[m]!, fy: 0, label: `A_x = ${fmtN(x[m]!)}`, kind: "reacao", head: true });
  r.forces.push({ x: nodes[2]![0], y: 0, fx: 0, fy: r.R2, label: `C_y = ${fmtN(r.R2)}`, kind: "reacao", head: true });
  return r;
}

export function solve(s: EqState, p: Params): Result {
  switch (modeOf(p)) {
    case 1:
      return solveLadder(s, p);
    case 2:
      return solveBeam(s, p);
    case 3:
      return solveCrane(s, p);
    case 4:
      return solveTruss(s, p);
    default:
      return solveSeesaw(s, p);
  }
}

export function fmt(v: number, digits = 2): string {
  return v.toFixed(digits).replace(".", ",");
}

export function fmtN(F: number): string {
  const a = Math.abs(F);
  if (!Number.isFinite(F)) return "∞";
  if (a >= 1e4) return `${fmt(F / 1000, 1)} kN`;
  if (a >= 1000) return `${fmt(F / 1000, 2)} kN`;
  return `${Math.round(F)} N`;
}

/** Nó da treliça mais próximo de x no banzo inferior. */
export function nearestBottomNode(p: Params, x: number): number {
  const L = lenOf(p);
  return clamp(Math.round((2 * x) / L), 0, 2);
}

export function initState(p: Params): EqState {
  const L = lenOf(p);
  const x1 = clamp(num(p, "x1", 0.5), 0, L);
  const x2 = clamp(num(p, "x2", 3), 0, L);
  return {
    xa: clamp(num(p, "xa", L / 2), 0, L),
    xb: clamp(num(p, "xb", 0.75 * L), 0, L),
    x1,
    x2,
    ang: (clamp(num(p, "ang", 60), 5, 85) * Math.PI) / 180,
    H: num(p, "H", 3),
    n1: nearestBottomNode(p, x1),
    n2: nearestBottomNode(p, x2),
    drag: null,
  };
}
