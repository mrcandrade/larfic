import { cameraBasis, clamp, defineSim, draw, num, rad, texNum, type Draw, type Params, type V3 } from "@fisilab/core";
import { fmt, panel } from "./panel.ts";
import {
  TWO_PI,
  blochStep,
  blochVec,
  echoAnalytic,
  echoSet,
  echoSignal,
  echoSpin,
  fidAnalytic,
  groupDelay,
  probPlus,
  rabiPe,
  response,
  transmission,
  type Drive,
  type EchoSet,
  type ThreeLevel,
} from "./physics.ts";

export * from "./physics.ts";

interface Drag {
  kind: "cam" | "vec";
  x0: number;
  y0: number;
  yaw0: number;
  pitch0: number;
}

export interface QState {
  seed: number;
  yaw: number;
  pitch: number;
  drag: Drag | null;
  /** Medida: estado preparado, estado atual (após colapso), contagens no eixo escolhido. */
  prep: V3;
  cur: V3;
  N: number;
  nPlus: number;
  /** Medidas totais (inclui as de z no modo alternado), últimos resultados (+1/−1, eixo 0 = n, 1 = z). */
  total: number;
  last: number[];
  conv: number[];
  acc: number;
  /** Rabi: vetor de Bloch, rastro (x, y, z achatados), série [t, Pe] e pulso em andamento. */
  r: V3;
  trail: number[];
  pe: number[];
  pulse: { left: number; phase: number } | null;
}

const VIEW = { xMin: -17, xMax: 17, yMin: -9.5, yMax: 9.5 };
const SC = { x: -8.6, y: -0.6, R: 6.1 };
/** 1/Γ da linha D2 do rubídio (ns), para dar escala física ao modo EIT. */
const GAMMA_MHZ = 6.07;
const INV_GAMMA_NS = 1000 / (TWO_PI * GAMMA_MHZ);

const mode = (p: Params) => Math.round(num(p, "modo"));
const finite = (v: number) => (v >= 999 ? Infinity : v);

export function measAxis(p: Params): V3 {
  const e = Math.round(num(p, "eixo"));
  if (e === 0) return [0, 0, 1];
  if (e === 1) return [1, 0, 0];
  if (e === 2) return [0, 1, 0];
  return blochVec(rad(num(p, "thm", 60)), rad(num(p, "phm", 0)));
}
const axisName = (p: Params) => ["z", "x", "y", `n (θ=${fmt(num(p, "thm", 60))}°, φ=${fmt(num(p, "phm", 0))}°)`][Math.round(num(p, "eixo"))] ?? "n";

export const drive = (p: Params, phase = 0, on = true): Drive => {
  const T1 = finite(num(p, "T1", 1000));
  const T2 = Math.min(finite(num(p, "T2", 1000)), 2 * T1);
  return { Omega: on ? TWO_PI * num(p, "Om", 1) : 0, Delta: TWO_PI * num(p, "De", 0), phase, T1, T2 };
};
const pulsed = (p: Params) => num(p, "acion") >= 0.5;

export const threeLevel = (p: Params): ThreeLevel => ({ Oc: num(p, "Oc", 1), Dc: num(p, "Dc", 0), g21: num(p, "g21", 0.002), config: Math.round(num(p, "config")) });
/** Dessintonia da sonda (em Γ) varrida no tempo. */
export const sweepDp = (t: number) => -4 + 8 * ((t / 8) % 1);

let echoKey = "";
let echoCache: EchoSet = { delta: [] };
export function echoEnsemble(p: Params): EchoSet {
  const key = String(num(p, "sig", 1));
  if (key !== echoKey) {
    echoKey = key;
    echoCache = echoSet(num(p, "sig", 1), 400);
  }
  return echoCache;
}
const echoPars = (p: Params) => ({ tau: num(p, "tau", 2), sig: num(p, "sig", 1), th1: rad(num(p, "th1", 90)), th2: rad(num(p, "th2", 180)), T2: finite(num(p, "T2", 1000)) });

// ---------- Esfera de Bloch ----------

function sphereView(d: Draw, s: QState, labels: [string, string]) {
  const th = d.theme;
  const b = cameraBasis(s.yaw, s.pitch);
  const P = (v: V3): [number, number] => [SC.x + SC.R * (v[0] * b.r[0] + v[1] * b.r[1] + v[2] * b.r[2]), SC.y + SC.R * (v[0] * b.u[0] + v[1] * b.u[1] + v[2] * b.u[2])];
  const depth = (v: V3) => v[0] * b.f[0] + v[1] * b.f[1] + v[2] * b.f[2];
  d.circle(SC.x, SC.y, SC.R, { fill: th.accent, alpha: 0.06 });
  d.circle(SC.x, SC.y, SC.R, { stroke: th.muted, width: 1.2 });
  const ring = (f: (a: number) => V3) => {
    // frente cheia, fundo tracejado
    let seg: [number, number][] = [];
    let front = true;
    for (let i = 0; i <= 96; i++) {
      const v = f((TWO_PI * i) / 96);
      const fr = depth(v) >= 0;
      if (i > 0 && fr !== front) {
        d.polyline(seg, { color: th.muted, width: 1, alpha: front ? 0.7 : 0.35, dash: front ? undefined : [3, 4] });
        seg = [seg[seg.length - 1]!];
      }
      front = fr;
      seg.push(P(v));
    }
    d.polyline(seg, { color: th.muted, width: 1, alpha: front ? 0.7 : 0.35, dash: front ? undefined : [3, 4] });
  };
  ring((a) => [Math.cos(a), Math.sin(a), 0]);
  ring((a) => [Math.cos(a), 0, Math.sin(a)]);
  ring((a) => [0, Math.cos(a), Math.sin(a)]);
  const ax: [V3, string][] = [
    [[1.18, 0, 0], "x"],
    [[0, 1.18, 0], "y"],
    [[0, 0, 1.18], labels[0]],
    [[0, 0, -1.18], labels[1]],
  ];
  const o = P([0, 0, 0]);
  for (const [v, l] of ax) {
    const q = P(v);
    d.line(o[0], o[1], q[0], q[1], { color: th.muted, width: 1, alpha: 0.6 });
    d.text(l, q[0], q[1], { size: 12, weight: "700", color: th.text });
  }
  const arrow = (v: V3, color: string, width = 2.5) => {
    const q = P(v);
    d.arrow(o[0], o[1], q[0] - o[0], q[1] - o[1], { color, width });
    d.dot(q[0], q[1], 3.5, color);
  };
  return { P, arrow, depth };
}

// ---------- Desenho por modo ----------

function drawMeasure(d: Draw, s: QState, p: Params) {
  const th = d.theme;
  const sv = sphereView(d, s, ["|0⟩", "|1⟩"]);
  const n = measAxis(p);
  const q1 = sv.P(n);
  const q2 = sv.P([-n[0], -n[1], -n[2]]);
  d.line(q2[0], q2[1], q1[0], q1[1], { color: th.series[1]!, width: 2, dash: [6, 4] });
  d.text(`eixo de medida ${axisName(p)}`, q1[0], q1[1], { size: 11, color: th.series[1]!, dy: -14 });
  sv.arrow(s.prep, th.accent, 2.5);
  const same = Math.hypot(s.cur[0] - s.prep[0], s.cur[1] - s.prep[1], s.cur[2] - s.prep[2]) > 1e-6;
  if (same && s.total > 0) sv.arrow(s.cur, th.series[3]!, 2);
  d.text("azul: estado preparado (arraste a ponta)   rosa: estado após a última medida", SC.x, -8.9, { size: 10, color: th.muted });
  const P = probPlus(s.prep, n);
  const mode2 = Math.round(num(p, "repreparar"));
  d.text("Medida quântica", -16.6, 8.7, { size: 14, weight: "700", align: "left" });
  d.text(
    mode2 === 0 ? `cada medida num qubit recém-preparado: P(+) = (1 + r·n)/2 = ${fmt(100 * P)} %` : mode2 === 1 ? "medidas repetidas no mesmo qubit: o colapso fixa o resultado" : "mesmo qubit, alternando z e o eixo escolhido",
    -16.6,
    7.9,
    { size: 11, align: "left" },
  );

  // fita de resultados
  const x0 = 1;
  d.text("últimos resultados", x0, 8.6, { size: 11, weight: "600", align: "left" });
  s.last.forEach((v, i) => {
    const isZ = Math.abs(v) === 2;
    const plus = v > 0;
    const x = x0 + (i % 20) * 0.78;
    const y = 7.5 - Math.floor(i / 20) * 0.9;
    d.rect(x, y - 0.35, 0.7, 0.7, { fill: isZ ? th.muted : plus ? th.positive : th.negative, alpha: 0.85 });
    d.text(plus ? "+" : "−", x + 0.35, y, { size: 11, color: "#fff", weight: "700" });
  });
  if (mode2 === 2) d.text("cinza: medidas em z intercaladas", x0, 5.6, { size: 10, align: "left", color: th.muted });

  // barras
  const bb = { x0: 1.2, y0: -1.2, x1: 6.6, y1: 4.6 };
  const pb = panel(d, bb, { min: 0, max: 2 }, { min: 0, max: 1 });
  pb.frame({ xticks: [], yticks: [0, 0.5, 1], fy: (v) => `${Math.round(v * 100)}%` });
  const N = Math.max(1, s.N);
  const fr = [s.nPlus / N, (s.N - s.nPlus) / N];
  const expP = mode2 === 0 ? P : mode2 === 2 ? 0.5 : NaN;
  ["+", "−"].forEach((l, i) => {
    d.rect(pb.X(i + 0.2), pb.Y(0), pb.X(0.6) - pb.X(0), pb.Y(s.N ? fr[i]! : 0) - pb.Y(0), { fill: i === 0 ? th.positive : th.negative, alpha: 0.8 });
    if (Number.isFinite(expP)) {
      const e = i === 0 ? expP : 1 - expP;
      d.line(pb.X(i + 0.1), pb.Y(e), pb.X(i + 0.9), pb.Y(e), { color: th.series[1]!, width: 2.5 });
    }
    d.text(`${l}${axisName(p).split(" ")[0]}`, pb.X(i + 0.5), bb.y0, { size: 11, dy: 10 });
  });
  d.text(`N = ${s.N}`, bb.x1, bb.y1 + 0.4, { size: 11, align: "right" });

  // convergência
  const cb = { x0: 9.2, y0: -1.2, x1: 16.4, y1: 4.6 };
  const Nmax = Math.max(10, 10 ** Math.ceil(Math.log10(Math.max(10, s.N))));
  const pc = panel(d, cb, { min: 1, max: Nmax, log: true }, { min: 0, max: 1 });
  pc.frame({ xlabel: "N", ylabel: "fração de +", yticks: [0, 0.5, 1] });
  if (Number.isFinite(expP)) {
    const band: [number, number][] = [];
    for (let k = 0; k <= 60; k++) {
      const n2 = 10 ** ((k / 60) * Math.log10(Nmax));
      band.push([n2, expP + Math.sqrt((expP * (1 - expP)) / n2)]);
    }
    for (let k = 60; k >= 0; k--) {
      const n2 = 10 ** ((k / 60) * Math.log10(Nmax));
      band.push([n2, expP - Math.sqrt((expP * (1 - expP)) / n2)]);
    }
    pc.clip(() => d.polyline(band.map(([x, y]) => [pc.X(x), pc.Y(clamp(y, 0, 1))]), { color: "none", fill: th.series[1]!, alpha: 0.18, close: true }));
    pc.line([[1, expP], [Nmax, expP]], { color: th.series[1]!, width: 1.5, dash: [5, 4] });
  }
  const pts: [number, number][] = [];
  for (let i = 0; i + 1 < s.conv.length; i += 2) pts.push([s.conv[i]!, s.conv[i + 1]!]);
  pc.line(pts, { color: th.accent, width: 1.8 });
  d.text("faixa: previsão ± 1σ = √(P(1−P)/N)", cb.x1, cb.y0 - 1.1, { size: 10, align: "right", color: th.muted });

  // texto da regra de Born
  d.text("Regra de Born: P(+n) = |⟨+n|ψ⟩|² = cos²(Θ/2)", 1, -4.0, { size: 12, weight: "600", align: "left" });
  const Theta = (Math.acos(clamp(s.prep[0] * n[0] + s.prep[1] * n[1] + s.prep[2] * n[2], -1, 1)) * 180) / Math.PI;
  d.text(`Θ = ângulo entre o estado e o eixo = ${fmt(Theta)}°`, 1, -4.9, { size: 11, align: "left" });
  d.text("Depois da medida o estado é +n ou −n: a informação anterior se perde.", 1, -5.8, { size: 11, align: "left", color: th.muted });
  d.text("Moeda clássica: o resultado já existia antes de olhar.", 1, -6.7, { size: 11, align: "left", color: th.muted });
  d.text("Qubit: a probabilidade depende do eixo que você escolhe medir.", 1, -7.5, { size: 11, align: "left", color: th.muted });
}

function drawRabi(d: Draw, s: QState, p: Params, t: number) {
  const th = d.theme;
  const sv = sphereView(d, s, ["|e⟩", "|g⟩"]);
  const dr = drive(p);
  const W = Math.hypot(dr.Omega, dr.Delta);
  // eixo de rotação
  const om: V3 = W > 0 ? [dr.Omega / W, 0, dr.Delta / W] : [0, 0, 1];
  const qa = sv.P(om);
  const o = sv.P([0, 0, 0]);
  d.arrow(o[0], o[1], qa[0] - o[0], qa[1] - o[1], { color: th.series[1]!, width: 1.5, dash: [5, 3] });
  d.text("Ω⃗ = (Ω, 0, Δ)", qa[0], qa[1], { size: 11, color: th.series[1]!, dy: -12 });
  const pts: [number, number][] = [];
  for (let i = 0; i + 2 < s.trail.length; i += 3) pts.push(sv.P([s.trail[i]!, s.trail[i + 1]!, s.trail[i + 2]!]));
  d.polyline(pts, { color: th.series[2]!, width: 1.5, alpha: 0.85 });
  sv.arrow(s.r, th.accent, 2.8);
  d.text("Rabi com dessintonia (referencial girante)", -16.6, 8.7, { size: 14, weight: "700", align: "left" });
  const Pe = (1 + s.r[2]) / 2;
  d.text(`Ω/2π = ${fmt(num(p, "Om", 1))} MHz   Δ/2π = ${fmt(num(p, "De", 0))} MHz   Ω'/2π = ${fmt(W / TWO_PI)} MHz   Pe = ${fmt(Pe)}`, -16.6, 7.9, { size: 11, align: "left" });
  if (pulsed(p)) d.text(s.pulse ? `pulso em andamento (${fmt(s.pulse.left * 1000)} ns restantes)` : "campo desligado: use os botões de pulso", -16.6, 7.2, { size: 11, align: "left", color: s.pulse ? th.series[1]! : th.muted });

  // gráfico Pe(t)
  const Tw = Math.max(3, W > 0 ? (3 * TWO_PI) / W : 3);
  const tx0 = Math.max(0, t - Tw);
  const box = { x0: 1.5, y0: -2.6, x1: 16.4, y1: 6.6 };
  const pn = panel(d, box, { min: tx0, max: tx0 + Tw }, { min: 0, max: 1 });
  pn.frame({ xlabel: "t (μs)", ylabel: "população do excitado Pe", yticks: [0, 0.25, 0.5, 0.75, 1] });
  if (!pulsed(p)) pn.plot((x) => rabiPe(dr.Omega, dr.Delta, x), tx0, tx0 + Tw, { color: th.muted, width: 1, dash: [4, 3], n: 300 });
  const ser: [number, number][] = [];
  for (let i = 0; i + 1 < s.pe.length; i += 2) if (s.pe[i]! >= tx0) ser.push([s.pe[i]!, s.pe[i + 1]!]);
  pn.line(ser, { color: th.accent, width: 2 });
  const amp = W > 0 ? (dr.Omega / W) ** 2 : 0;
  if (!pulsed(p)) {
    pn.line([[tx0, amp], [tx0 + Tw, amp]], { color: th.series[1]!, width: 1, dash: [2, 3] });
    d.text(`amplitude Ω²/Ω'² = ${fmt(amp)}`, box.x1, pn.Y(amp), { size: 10, align: "right", dy: -8, color: th.series[1]! });
  }
  d.text("tracejado: fórmula de Rabi sem relaxação", box.x0, box.y0 - 1.2, { size: 10, align: "left", color: th.muted });
  d.text(`pulso π: t = π/Ω = ${fmt(1000 / (2 * num(p, "Om", 1)))} ns`, box.x0, -5.2, { size: 11, align: "left" });
  d.text("Arraste o fundo para girar a esfera.", box.x0, -6.1, { size: 10, align: "left", color: th.muted });
}

function drawEcho(d: Draw, s: QState, p: Params, t: number) {
  const th = d.theme;
  const sv = sphereView(d, s, ["+z", "−z"]);
  const e = echoPars(p);
  const set = echoEnsemble(p);
  const decay = Number.isFinite(e.T2) ? Math.exp(-t / e.T2) : 1;
  const nShow = 36;
  let mx = 0;
  let my = 0;
  for (let i = 0; i < set.delta.length; i++) {
    const r = echoSpin(set.delta[i]!, t, e.tau, e.th1, e.th2);
    mx += r[0];
    my += r[1];
    if (i < nShow) {
      const k = clamp(0.5 + set.delta[i]! / (4 * TWO_PI * e.sig), 0, 1);
      const col = k > 0.5 ? th.positive : th.negative;
      const q = sv.P([r[0] * decay, r[1] * decay, r[2]]);
      const o = sv.P([0, 0, 0]);
      d.line(o[0], o[1], q[0], q[1], { color: col, width: 1.2, alpha: 0.75 });
      d.dot(q[0], q[1], 2.2, col);
    }
  }
  const n = set.delta.length;
  sv.arrow([(mx / n) * decay, (my / n) * decay, 0], th.series[2]!, 3);
  d.text("Eco de spin / eco de fótons", -16.6, 8.7, { size: 14, weight: "700", align: "left" });
  d.text(`pulsos: ${fmt(num(p, "th1", 90))}° em t = 0, ${fmt(num(p, "th2", 180))}° em τ = ${fmt(e.tau)} μs → eco em 2τ`, -16.6, 7.9, { size: 11, align: "left" });
  d.text("vermelho: δ > 0 (adiantados)   azul: δ < 0   verde: magnetização média", SC.x, -8.9, { size: 10, color: th.muted });

  const T = 3.2 * e.tau;
  const box = { x0: 1.5, y0: -2.6, x1: 16.4, y1: 6.6 };
  const pn = panel(d, box, { min: 0, max: T }, { min: 0, max: 1.05 });
  pn.frame({ xlabel: "t (μs)", ylabel: "sinal |M_xy| (fração do máximo)", yticks: [0, 0.5, 1] });
  pn.plot((x) => echoSignal(set, x, e.tau, e.th1, e.th2, e.T2), 0, T, { color: th.accent, width: 1.2, alpha: 0.45, n: 400 });
  pn.plot((x) => (x < e.tau ? fidAnalytic(x, e.sig, e.th1) * (Number.isFinite(e.T2) ? Math.exp(-x / e.T2) : 1) : echoAnalytic(x, e.tau, e.sig, e.th1, e.th2, e.T2)), 0, T, { color: th.series[1]!, width: 1, dash: [4, 3], n: 400 });
  pn.plot((x) => (x <= t ? echoSignal(set, x, e.tau, e.th1, e.th2, e.T2) : NaN), 0, Math.min(t, T), { color: th.series[2]!, width: 2.2, n: 300 });
  if (Number.isFinite(e.T2)) pn.plot((x) => Math.exp(-x / e.T2), 0, T, { color: th.muted, width: 1, dash: [2, 3] });
  for (const [x, l] of [[0, "θ₁"], [e.tau, "θ₂"]] as [number, string][]) {
    d.rect(pn.X(x) - 0.08, box.y0, 0.16, box.y1 - box.y0, { fill: th.series[1]!, alpha: 0.35 });
    d.text(l, pn.X(x), box.y1, { size: 11, dy: -8, color: th.series[1]! });
  }
  d.text("eco", pn.X(2 * e.tau), box.y1, { size: 11, dy: -8, color: th.series[2]! });
  d.text("verde: simulação com 400 spins   laranja: previsão gaussiana   cinza: e^(−t/T₂)", box.x0, box.y0 - 1.2, { size: 10, align: "left", color: th.muted });
  d.text(`amplitude do eco ≈ sen θ₁ · sen²(θ₂/2) · e^(−2τ/T₂) = ${fmt(echoAnalytic(2 * e.tau, e.tau, e.sig, e.th1, e.th2, e.T2))}`, box.x0, -5.2, { size: 11, align: "left" });
  d.text(`T₂* ≈ 1/(2πσ) = ${fmt(1000 / (TWO_PI * e.sig))} ns: o FID some, mas o eco recupera a fase.`, box.x0, -6.1, { size: 11, align: "left", color: th.muted });
}

function drawEIT(d: Draw, p: Params, t: number) {
  const th = d.theme;
  const tl = threeLevel(p);
  const OD = num(p, "OD", 4);
  const Dp = sweepDp(t);
  // diagrama de níveis
  const cfg = tl.config;
  d.text(cfg === 1 ? "Sistema em escada" : cfg === 2 ? "Dois níveis (sem acoplamento)" : "Sistema Λ", -16.6, 8.7, { size: 14, weight: "700", align: "left" });
  const L = (x: number, y: number, w: number, l: string) => {
    d.line(x - w / 2, y, x + w / 2, y, { width: 3 });
    d.text(l, x + w / 2 + 0.3, y, { size: 12, align: "left" });
  };
  const probeCol = th.positive;
  const coupCol = th.accent;
  if (cfg === 1) {
    L(-11, -6.5, 4, "|1⟩");
    L(-11, -0.5, 4, "|2⟩");
    L(-11, 5.5, 4, "|3⟩");
    d.arrow(-11.6, -6.4, 0, 5.8, { color: probeCol, width: 3 });
    d.text("sonda Δp", -11.8, -3.5, { size: 11, color: probeCol, align: "right" });
    if (tl.Oc > 0) {
      d.arrow(-10.4, -0.4, 0, 5.8, { color: coupCol, width: 3 + tl.Oc });
      d.text(`acoplamento Ωc = ${fmt(tl.Oc)} Γ`, -10.1, 2.5, { size: 11, color: coupCol, align: "left" });
    }
  } else {
    L(-14, -5.5, 3.6, "|1⟩");
    L(-7, -4.3, 3.6, "|2⟩");
    L(-10.5, 5.0, 4, "|3⟩");
    d.arrow(-14, -5.4, 3.3, 10.3, { color: probeCol, width: 3 });
    d.text("sonda Δp", -13.9, 0.5, { size: 11, color: probeCol, align: "right" });
    if (cfg === 0 && tl.Oc > 0) {
      d.arrow(-7, -4.2, -3.3, 9.1, { color: coupCol, width: 3 + tl.Oc });
      d.text(`acoplamento Ωc = ${fmt(tl.Oc)} Γ`, -8.2, 1.2, { size: 11, color: coupCol, align: "left" });
    }
    d.polyline([[-10.2, 4.8], [-8, 0.5], [-7.2, -3.9]], { color: th.muted, width: 1, dash: [3, 3] });
    d.text("Γ", -8.4, 1.8, { size: 11, color: th.muted });
  }
  d.text(`δ = Δp ${cfg === 1 ? "+" : "−"} Δc: transparência quando δ = 0`, -16.6, -8.0, { size: 11, align: "left" });
  d.text(`γ21 = ${fmt(tl.g21)} Γ (perda de coerência entre |1⟩ e |2⟩)`, -16.6, -8.8, { size: 10, align: "left", color: th.muted });

  // absorção / transmissão
  const box = { x0: 0, y0: 1.2, x1: 16.4, y1: 7.8 };
  const pa = panel(d, box, { min: -4, max: 4 }, { min: 0, max: 1.05 });
  pa.frame({ xlabel: "", ylabel: "absorção Re K  e  transmissão e^(−OD·Re K)", yticks: [0, 0.5, 1] });
  const two: ThreeLevel = { ...tl, config: 2 };
  pa.plot((x) => response(x, two).re, -4, 4, { color: th.muted, width: 1, dash: [4, 3], n: 300 });
  pa.plot((x) => response(x, tl).re, -4, 4, { color: probeCol, width: 2, n: 1200 });
  pa.plot((x) => transmission(x, tl, OD), -4, 4, { color: th.series[2]!, width: 1.5, n: 1200 });
  d.line(pa.X(Dp), box.y0, pa.X(Dp), box.y1, { color: th.series[1]!, width: 1, dash: [4, 3] });
  d.text("vermelho: absorção   verde: transmissão   tracejado: sem acoplamento", box.x1, box.y1 + 0.45, { size: 10, align: "right", color: th.muted });
  const pd = panel(d, { x0: 0, y0: -6.2, x1: 16.4, y1: -0.6 }, { min: -4, max: 4 }, { min: -0.6, max: 0.6 });
  pd.frame({ xlabel: "dessintonia da sonda Δp / Γ", ylabel: "dispersão: n − 1 ∝ −Im K" });
  pd.plot((x) => -response(x, two).im, -4, 4, { color: th.muted, width: 1, dash: [4, 3], n: 300 });
  pd.plot((x) => -response(x, tl).im, -4, 4, { color: th.series[4]!, width: 2, n: 1200 });
  d.line(pd.X(Dp), -6.2, pd.X(Dp), -0.6, { color: th.series[1]!, width: 1, dash: [4, 3] });
  const tg = groupDelay(cfg === 1 ? -tl.Dc : tl.Dc, tl, OD);
  d.text(`atraso de grupo no centro da janela: τg = ${fmt(tg)}/Γ = ${fmt(tg * INV_GAMMA_NS)} ns (Γ/2π = 6,07 MHz, Rb)`, 0, -8.0, { size: 11, align: "left" });
  d.text(`sonda em Δp = ${fmt(Dp)} Γ: transmissão ${fmt(100 * transmission(Dp, tl, OD))} %`, 0, -8.8, { size: 10, align: "left", color: th.muted });
}

const initState = (p: Params, seed = 4242): QState => {
  const prep = blochVec(rad(num(p, "theta0", 60)), rad(num(p, "phi0", 0)));
  return {
    seed,
    yaw: rad(30),
    pitch: rad(20),
    drag: null,
    prep,
    cur: prep,
    N: 0,
    nPlus: 0,
    total: 0,
    last: [],
    conv: [],
    acc: 0,
    r: [0, 0, -1],
    trail: [0, 0, -1],
    pe: [0, 0],
    pulse: null,
  };
};

function rnd(s: { seed: number }): number {
  s.seed = (s.seed + 0x6d2b79f5) >>> 0;
  let t = s.seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Faz `count` medidas e devolve o novo estado (sem mutar o original). */
export function measure(s0: QState, p: Params, count: number): QState {
  const s: QState = { ...s0, last: s0.last.slice(), conv: s0.conv.slice() };
  const n = measAxis(p);
  const rep = Math.round(num(p, "repreparar"));
  for (let k = 0; k < count; k++) {
    const onZ = rep === 2 && s.total % 2 === 1;
    const axis: V3 = onZ ? [0, 0, 1] : n;
    const start = rep === 0 ? s.prep : s.cur;
    const plus = rnd(s) < probPlus(start, axis);
    s.cur = plus ? axis : [-axis[0], -axis[1], -axis[2]];
    s.total++;
    s.last.push(onZ ? (plus ? 2 : -2) : plus ? 1 : -1);
    if (!onZ) {
      s.N++;
      if (plus) s.nPlus++;
      if (s.N < 100 || s.N % Math.ceil(s.N / 100) === 0) s.conv.push(s.N, s.nPlus / s.N);
    }
  }
  if (s.last.length > 40) s.last = s.last.slice(s.last.length - 40);
  if (s.conv.length > 1200) s.conv = s.conv.slice(s.conv.length - 1200);
  return s;
}

function startPulse(s: QState, p: Params, angle: number, phase: number): QState {
  const Om = TWO_PI * num(p, "Om", 1);
  if (Om <= 0) return s;
  return { ...s, pulse: { left: angle / Om, phase } };
}

export const qubitDoisNiveis = defineSim<QState>({
  id: "qubit-dois-niveis",
  title: "Qubit: medida, Rabi, eco e EIT",
  course: "FG IV",
  topic: "Quântica",
  priority: "P2",
  summary:
    "Um sistema de dois níveis na esfera de Bloch em 3D: meça um qubit muitas vezes e veja a regra de Born emergir, gire o estado com oscilações de Rabi dessintonizadas e pulsos π/2 e π, refocalize um conjunto de spins com o eco e abra uma janela de transparência (EIT) num sistema de três níveis.",
  equations: [
    String.raw`|\psi\rangle = \cos\tfrac\theta2|0\rangle + e^{i\varphi}\sin\tfrac\theta2|1\rangle,\qquad P(+\hat n) = \tfrac12(1 + \vec r\cdot\hat n)`,
    String.raw`\frac{d\vec r}{dt} = \vec\Omega\times\vec r,\quad \vec\Omega = (\Omega\cos\phi,\ \Omega\sin\phi,\ \Delta)`,
    String.raw`P_e(t) = \frac{\Omega^2}{\Omega^2 + \Delta^2}\,\operatorname{sen}^2\!\Big(\frac{\sqrt{\Omega^2+\Delta^2}\,t}{2}\Big)`,
    String.raw`\text{eco: } \tfrac\pi2 - \tau - \pi - \tau \ \Rightarrow\ \text{refocalização em } t = 2\tau`,
    String.raw`\chi \propto \frac{i}{\Gamma/2 - i\Delta_p + \dfrac{\Omega_c^2/4}{\gamma_{21} - i\delta}}`,
  ],
  liveEquations(s, p, t) {
    const m = mode(p);
    if (m === 0) {
      const n = measAxis(p);
      return [String.raw`P(+) = \tfrac12(1 + \vec r\cdot\hat n) = ${texNum(probPlus(s.prep, n))},\quad \text{medido: } ${texNum(s.N ? s.nPlus / s.N : 0)}\ (N = ${s.N})`];
    }
    if (m === 1) {
      const Om = num(p, "Om", 1);
      const De = num(p, "De", 0);
      return [String.raw`\frac{\Omega'}{2\pi} = \sqrt{${texNum(Om)}^2 + ${texNum(De)}^2} = ${texNum(Math.hypot(Om, De))}\ \text{MHz},\quad P_e = ${texNum((1 + s.r[2]) / 2)}`];
    }
    if (m === 2) {
      const e = echoPars(p);
      return [String.raw`S(2\tau) \approx \operatorname{sen}\theta_1\operatorname{sen}^2\tfrac{\theta_2}{2}\,e^{-2\tau/T_2} = ${texNum(echoAnalytic(2 * e.tau, e.tau, e.sig, e.th1, e.th2, e.T2))}`];
    }
    const tl = threeLevel(p);
    return [String.raw`\Delta_p = ${texNum(sweepDp(t))}\,\Gamma,\quad T = e^{-\text{OD}\,\mathrm{Re}K} = ${texNum(transmission(sweepDp(t), tl, num(p, "OD", 4)))}`];
  },
  params: [
    {
      key: "modo",
      label: "Experimento",
      unit: "",
      min: 0,
      max: 3,
      step: 1,
      default: 0,
      options: [
        { value: 0, label: "Medida quântica (moeda quântica)" },
        { value: 1, label: "Oscilações de Rabi e pulsos" },
        { value: 2, label: "Eco de spin / fótons" },
        { value: 3, label: "Três níveis: transparência (EIT)" },
      ],
    },
    { key: "theta0", label: "Estado preparado: θ", unit: "°", min: 0, max: 180, step: 1, default: 60 },
    { key: "phi0", label: "Estado preparado: φ", unit: "°", min: 0, max: 360, step: 1, default: 0 },
    { key: "eixo", label: "Eixo de medida", unit: "", min: 0, max: 3, step: 1, default: 0, options: [{ value: 0, label: "z" }, { value: 1, label: "x" }, { value: 2, label: "y" }, { value: 3, label: "inclinado (θm, φm)" }] },
    { key: "thm", label: "Eixo inclinado: θm", unit: "°", min: 0, max: 180, step: 1, default: 60 },
    { key: "phm", label: "Eixo inclinado: φm", unit: "°", min: 0, max: 360, step: 1, default: 0 },
    {
      key: "repreparar",
      label: "Sequência de medidas",
      unit: "",
      min: 0,
      max: 2,
      step: 1,
      default: 0,
      options: [
        { value: 0, label: "um qubit novo a cada medida" },
        { value: 1, label: "o mesmo qubit, medido de novo" },
        { value: 2, label: "o mesmo qubit, alternando z e o eixo" },
      ],
    },
    { key: "taxa", label: "Medidas por segundo", unit: "1/s", min: 1, max: 60, step: 1, default: 6, live: true },
    { key: "Om", label: "Frequência de Rabi Ω/2π", unit: "MHz", min: 0.1, max: 5, step: 0.05, default: 1 },
    { key: "De", label: "Dessintonia Δ/2π", unit: "MHz", min: -5, max: 5, step: 0.05, default: 0, live: true },
    { key: "acion", label: "Campo", unit: "", min: 0, max: 1, step: 1, default: 0, options: [{ value: 0, label: "contínuo" }, { value: 1, label: "pulsos (botões)" }] },
    { key: "T1", label: "Relaxação T₁ (999 = sem)", unit: "μs", min: 0.5, max: 999, step: 0.5, default: 999, log: true, live: true },
    { key: "T2", label: "Coerência T₂ (999 = sem)", unit: "μs", min: 0.5, max: 999, step: 0.5, default: 999, log: true, live: true },
    { key: "tau", label: "Intervalo τ entre pulsos (eco)", unit: "μs", min: 0.3, max: 4, step: 0.1, default: 1.5 },
    { key: "sig", label: "Largura não homogênea σ", unit: "MHz", min: 0.1, max: 3, step: 0.05, default: 1 },
    { key: "th1", label: "Ângulo do 1º pulso", unit: "°", min: 10, max: 180, step: 5, default: 90 },
    { key: "th2", label: "Ângulo do 2º pulso", unit: "°", min: 0, max: 360, step: 5, default: 180 },
    { key: "config", label: "Configuração (três níveis)", unit: "", min: 0, max: 2, step: 1, default: 0, options: [{ value: 0, label: "Λ" }, { value: 1, label: "escada" }, { value: 2, label: "só dois níveis" }] },
    { key: "Oc", label: "Rabi do acoplamento Ωc", unit: "Γ", min: 0, max: 4, step: 0.05, default: 1, live: true },
    { key: "Dc", label: "Dessintonia do acoplamento Δc", unit: "Γ", min: -2, max: 2, step: 0.05, default: 0, live: true },
    { key: "g21", label: "Decoerência γ21", unit: "Γ", min: 0.0005, max: 0.5, step: 0.0005, default: 0.002, log: true, live: true },
    { key: "OD", label: "Profundidade óptica OD", unit: "", min: 0.5, max: 20, step: 0.5, default: 4, live: true },
  ],
  observables: [
    { key: "N", label: "Medidas no eixo escolhido", unit: "", value: (s) => s.N },
    { key: "frac", label: "Fração de resultados +", unit: "", value: (s) => (s.N ? s.nPlus / s.N : 0) },
    { key: "Pteo", label: "Probabilidade prevista P(+)", unit: "", value: (s, p) => probPlus(s.prep, measAxis(p)) },
    { key: "tempo", label: "Tempo", unit: "μs", value: (_s, _p, t) => t },
    { key: "Pe", label: "População do excitado", unit: "", value: (s) => (1 + s.r[2]) / 2 },
    { key: "u", label: "Componente x do vetor de Bloch", unit: "", value: (s) => s.r[0] },
    { key: "v", label: "Componente y do vetor de Bloch", unit: "", value: (s) => s.r[1] },
    { key: "len", label: "Comprimento |r|", unit: "", value: (s) => Math.hypot(s.r[0], s.r[1], s.r[2]) },
    { key: "sinal", label: "Sinal de eco |M_xy|", unit: "", value: (_s, p, t) => (mode(p) === 2 ? echoSignal(echoEnsemble(p), t, echoPars(p).tau, echoPars(p).th1, echoPars(p).th2, echoPars(p).T2) : 0) },
    { key: "Dp", label: "Dessintonia da sonda Δp", unit: "Γ", value: (_s, _p, t) => sweepDp(t) },
    { key: "T", label: "Transmissão da sonda", unit: "", value: (_s, p, t) => transmission(sweepDp(t), threeLevel(p), num(p, "OD", 4)) },
    { key: "tg", label: "Atraso de grupo no centro", unit: "ns", value: (_s, p) => groupDelay(threeLevel(p).config === 1 ? -threeLevel(p).Dc : threeLevel(p).Dc, threeLevel(p), num(p, "OD", 4)) * INV_GAMMA_NS },
  ],
  chart: { x: "tempo", y: "Pe" },
  scenarios: [
    {
      id: "moeda",
      label: "Moeda quântica: regra de Born",
      params: { modo: 0, theta0: 60, phi0: 0, eixo: 0, repreparar: 0, taxa: 8 },
      guide: `### Probabilidades e colapso
1. O qubit é preparado com $\\theta = 60^\\circ$ (seta azul). Cada medida em $z$ dá **+** ou **−**, ao acaso.
2. Responda à previsão e use **Medir 1000 vezes**: a fração converge para $\\cos^2(\\theta/2)$ dentro da faixa de $\\pm 1\\sigma$, que encolhe como $1/\\sqrt N$.
3. Mude o eixo para $x$: com o mesmo estado, a probabilidade é outra — ao contrário de uma moeda, o resultado não existia antes da medida.
4. Escolha **o mesmo qubit, medido de novo**: depois do primeiro resultado, todos se repetem (colapso).
5. Escolha **alternando z e o eixo** com eixo $x$: cada medida em $z$ apaga a informação sobre $x$ e vice-versa.
6. Arraste a ponta da seta azul para preparar outro estado; arraste o fundo para girar a esfera.`,
      predict: [
        {
          question: "Um qubit com θ = 60° (no plano xz) é medido em z muitas vezes, sempre recém-preparado. Que fração dá +?",
          options: ["50%", "60%", "75%", "100%"],
          answer: 2,
          explanation: "$P(+z) = \\cos^2(\\theta/2) = \\cos^2 30^\\circ = 3/4$. Note o ângulo pela metade: estados opostos na esfera ($\\theta = 180^\\circ$) são ortogonais.",
        },
      ],
    },
    {
      id: "rabi",
      label: "Rabi: ressonância e dessintonia",
      params: { modo: 1, Om: 1, De: 0, acion: 0, T1: 999, T2: 999 },
      guide: `### Oscilações de Rabi
1. Em ressonância ($\\Delta = 0$) o vetor de Bloch gira em torno de $x$ e passa pelo polo $|e\\rangle$: $P_e$ oscila entre 0 e 1 com período $1/(\\Omega/2\\pi)$.
2. Responda à previsão e ponha $\\Delta/2\\pi = 1$ MHz: o eixo de rotação inclina, a oscilação fica mais rápida e não chega a 1.
3. Ligue $T_2 = 2\\ \\mu s$ e $T_1 = 4\\ \\mu s$: as oscilações amortecem e o vetor encolhe para dentro da esfera.
4. Mude para **pulsos**: um pulso $\\pi$ leva $|g\\rangle \\to |e\\rangle$; dois pulsos $\\pi/2$ também. Faça uma sequência de Ramsey: $\\pi/2$, espere, $\\pi/2$, com $\\Delta \\ne 0$.`,
      predict: [
        {
          question: "Com Ω/2π = 1 MHz e dessintonia Δ/2π = 1 MHz, qual a população máxima do estado excitado?",
          options: ["1", "0,5", "0,71", "0,25"],
          answer: 1,
          explanation: "$P_{\\max} = \\Omega^2/(\\Omega^2 + \\Delta^2) = 1/2$; a frequência de oscilação sobe para $\\sqrt2$ MHz.",
        },
      ],
    },
    {
      id: "eco",
      label: "Eco: π/2 – τ – π",
      params: { modo: 2, tau: 1.5, sig: 1, th1: 90, th2: 180, T2: 999 },
      guide: `### Refocalização
1. O pulso $\\pi/2$ põe todos os spins em $+y$. Como cada um tem sua dessintonia $\\delta$, eles se espalham no equador e o sinal (FID) desaparece em $T_2^* \\approx 1/(2\\pi\\sigma)$.
2. O pulso $\\pi$ em $\\tau$ espelha os spins: os mais rápidos ficam para trás e todos se reencontram em $2\\tau$ — o **eco**.
3. Mude o 2º pulso para 90°: o eco cai para $\\operatorname{sen}^2 45^\\circ = 1/2$.
4. Ponha $T_2 = 5\\ \\mu s$: o eco mede o decaimento homogêneo $e^{-2\\tau/T_2}$, que o eco não desfaz. Assim se mede $T_2$ em RMN e no eco de fótons em átomos.`,
      predict: [
        {
          question: "O FID sumiu em poucas centenas de nanossegundos. O que acontece em t = 2τ depois do pulso π?",
          options: ["Nada: a coerência foi perdida", "O sinal volta quase todo (eco)", "O sinal volta com o dobro da amplitude", "Os spins voltam para −z"],
          answer: 1,
          explanation: "A dispersão de fases vem de dessintonias fixas, que o pulso $\\pi$ inverte: cada spin desfaz em $\\tau$ a fase que acumulou. Só a perda irreversível ($T_2$) não é recuperada.",
        },
      ],
    },
    {
      id: "eit",
      label: "Transparência induzida (EIT)",
      params: { modo: 3, config: 0, Oc: 1, Dc: 0, g21: 0.002, OD: 4 },
      guide: `### Uma janela no meio da absorção
1. Sem acoplamento ($\\Omega_c = 0$) a sonda vê a linha lorentziana de largura $\\Gamma$ (tracejado).
2. Com $\\Omega_c$ ligado surge um buraco estreito em $\\delta = 0$: as duas excitações de $|3\\rangle$ interferem destrutivamente (estado escuro).
3. Aumente $\\Omega_c$ até $3\\Gamma$: a linha se divide em dois picos separados por $\\Omega_c$ (Autler–Townes).
4. Aumente $\\gamma_{21}$: a janela se enche — a transparência depende da coerência entre $|1\\rangle$ e $|2\\rangle$.
5. Na dispersão, a inclinação íngreme no centro dá **luz lenta**: $\\tau_g \\approx \\text{OD}\\,\\Gamma/\\Omega_c^2$.`,
      predict: [
        {
          question: "Ligar um segundo laser (acoplamento) numa transição que compartilha o nível excitado faz a absorção da sonda na ressonância…",
          options: ["dobrar", "quase desaparecer", "não mudar", "virar ganho"],
          answer: 1,
          explanation: "Os dois caminhos $|1\\rangle\\to|3\\rangle$ e $|2\\rangle\\to|3\\rangle$ interferem: os átomos vão para um estado escuro que não absorve. Isso é a EIT.",
        },
      ],
    },
  ],
  exercises: [
    {
      id: "born",
      prompt: "Um qubit é preparado com vetor de Bloch no plano xz a θ = {theta0}° do eixo z. Qual a probabilidade de obter + numa medida ao longo de x?",
      vary: { theta0: [10, 170, 0] },
      fixed: { modo: 0, phi0: 0, eixo: 1 },
      answer: { label: "P(+x)", unit: "", compute: (p) => (1 + Math.sin(rad(num(p, "theta0")))) / 2 },
      tolerance: 0.02,
      hint: "P(+n) = (1 + r·n)/2 e r·x = sen θ cos φ.",
    },
    {
      id: "rabi",
      prompt: "Um átomo é iluminado com frequência de Rabi Ω/2π = {Om} MHz e dessintonia Δ/2π = {De} MHz. Qual a população máxima que o estado excitado atinge?",
      vary: { Om: [0.5, 3, 1], De: [0.2, 3, 1] },
      fixed: { modo: 1 },
      answer: { label: "Pmax", unit: "", compute: (p) => num(p, "Om") ** 2 / (num(p, "Om") ** 2 + num(p, "De") ** 2) },
      hint: "Pmax = Ω²/(Ω² + Δ²).",
    },
    {
      id: "pipulse",
      prompt: "Qual a duração, em nanossegundos, de um pulso π ressonante com frequência de Rabi Ω/2π = {Om} MHz?",
      vary: { Om: [0.5, 5, 2] },
      fixed: { modo: 1 },
      answer: { label: "t", unit: "ns", compute: (p) => 1000 / (2 * num(p, "Om")) },
    },
  ],
  init: (p) => initState(p),
  step(s, p, t, dt) {
    const m = mode(p);
    if (m === 0) {
      if (s.drag?.kind === "vec") return s;
      const acc = s.acc + num(p, "taxa", 6) * dt;
      const k = Math.floor(acc);
      const ns = k > 0 ? measure(s, p, k) : { ...s };
      ns.acc = acc - k;
      return ns;
    }
    if (m === 1) {
      let r = s.r;
      let pulse = s.pulse ? { ...s.pulse } : null;
      const nsub = 4;
      const h = dt / nsub;
      for (let i = 0; i < nsub; i++) {
        if (pulsed(p)) {
          if (pulse) {
            const hh = Math.min(h, pulse.left);
            r = blochStep(r, drive(p, pulse.phase, true), hh);
            pulse.left -= hh;
            if (pulse.left <= 1e-12) {
              r = blochStep(r, drive(p, 0, false), h - hh);
              pulse = null;
            }
          } else r = blochStep(r, drive(p, 0, false), h);
        } else r = blochStep(r, drive(p), h);
      }
      let trail = s.trail.concat(r);
      if (trail.length > 1800) trail = trail.slice(trail.length - 1800);
      let pe = s.pe.concat([t + dt, (1 + r[2]) / 2]);
      if (pe.length > 4000) pe = pe.slice(pe.length - 4000);
      return { ...s, r, trail, pe, pulse };
    }
    return s;
  },
  stopWhen: (_s, p, t) => (mode(p) === 2 ? 3.2 * num(p, "tau", 1.5) - t : 1),
  dt: 1 / 240,
  sampleEvery: 4,
  maxSamples: 3000,
  actions: [
    { id: "m1", label: "Medir 1 vez", run: (s, p) => measure(s, p, 1) },
    { id: "m1000", label: "Medir 1000 vezes", run: (s, p) => measure(s, p, 1000) },
    { id: "zerar", label: "Zerar contagens", run: (s) => ({ ...s, N: 0, nPlus: 0, total: 0, last: [], conv: [], cur: s.prep }) },
    { id: "pi2x", label: "Pulso π/2 (eixo x)", run: (s, p) => startPulse(s, p, Math.PI / 2, 0) },
    { id: "pix", label: "Pulso π (eixo x)", run: (s, p) => startPulse(s, p, Math.PI, 0) },
    { id: "pi2y", label: "Pulso π/2 (eixo y)", run: (s, p) => startPulse(s, p, Math.PI / 2, Math.PI / 2) },
    { id: "g", label: "Voltar a |g⟩", run: (s) => ({ ...s, r: [0, 0, -1], trail: [0, 0, -1], pulse: null }) },
    { id: "vista", label: "Vista padrão", run: (s) => ({ ...s, yaw: rad(30), pitch: rad(20) }) },
  ],
  pointer: {
    down(s, p, pt) {
      if (mode(p) === 3) return undefined;
      if (Math.hypot(pt.x - SC.x, pt.y - SC.y) > SC.R * 1.25) return undefined;
      if (mode(p) === 0) {
        const b = cameraBasis(s.yaw, s.pitch);
        const tip = [SC.x + SC.R * (s.prep[0] * b.r[0] + s.prep[1] * b.r[1] + s.prep[2] * b.r[2]), SC.y + SC.R * (s.prep[0] * b.u[0] + s.prep[1] * b.u[1] + s.prep[2] * b.u[2])];
        if (Math.hypot(pt.x - tip[0]!, pt.y - tip[1]!) < 1.0) return { ...s, drag: { kind: "vec", x0: pt.x, y0: pt.y, yaw0: s.yaw, pitch0: s.pitch } };
      }
      return { ...s, drag: { kind: "cam", x0: pt.x, y0: pt.y, yaw0: s.yaw, pitch0: s.pitch } };
    },
    move(s, _p, pt, dragging) {
      const g = s.drag;
      if (!dragging || !g) return undefined;
      if (g.kind === "cam") return { ...s, yaw: g.yaw0 - (pt.x - g.x0) * 0.15, pitch: clamp(g.pitch0 - (pt.y - g.y0) * 0.15, rad(-85), rad(85)) };
      const b = cameraBasis(s.yaw, s.pitch);
      let a = (pt.x - SC.x) / SC.R;
      let c = (pt.y - SC.y) / SC.R;
      const m = Math.hypot(a, c);
      if (m > 1) {
        a /= m;
        c /= m;
      }
      const f = Math.sqrt(Math.max(0, 1 - a * a - c * c));
      const v: V3 = [a * b.r[0] + c * b.u[0] + f * b.f[0], a * b.r[1] + c * b.u[1] + f * b.f[1], a * b.r[2] + c * b.u[2] + f * b.f[2]];
      return { ...s, prep: v, cur: v, N: 0, nPlus: 0, total: 0, last: [], conv: [] };
    },
    up: (s) => (s.drag ? { ...s, drag: null } : undefined),
    cursor: (_s, p, pt) => (mode(p) !== 3 && Math.hypot(pt.x - SC.x, pt.y - SC.y) < SC.R * 1.25 ? "grab" : undefined),
  },
  viewport: () => ({ ...VIEW, unit: "" }),
  render(ctx, frame) {
    const d = draw(ctx, frame);
    const m = mode(frame.params);
    if (m === 0) drawMeasure(d, frame.state, frame.params);
    else if (m === 1) drawRabi(d, frame.state, frame.params, frame.t);
    else if (m === 2) drawEcho(d, frame.state, frame.params, frame.t);
    else drawEIT(d, frame.params, frame.t);
  },
});

export default qubitDoisNiveis;
