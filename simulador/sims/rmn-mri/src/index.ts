import { clamp, defaultCamera, defineSim, draw, num, orbit, projector, texNum, type Camera, type Draw, type Params, type V3 } from "@fisilab/core";
import { fmt, panel } from "./panel.ts";
import {
  NIMG,
  NUCLEOS,
  TECIDOS,
  centerOut,
  evolve,
  fft2,
  larmor,
  lorentzOffsets,
  mean,
  phantomMap,
  polarization,
  projection,
  reconstruct,
  seSignal,
  t2star,
  weightedImage,
  type Pulse,
  type Vec,
} from "./physics.ts";

export * from "./physics.ts";

export interface MRState {
  /** Isocromatas (M/M₀ no referencial girante) e sua média. */
  Ms: Vec[];
  m: Vec;
  /** Tempo físico da experiência (s), que corre em câmera lenta ou acelerado. */
  tp: number;
  /** Inclinação do spin no modo de precessão (rad). */
  tilt: number;
  cam: Camera;
  drag: null | { kind: "cam" | "tilt"; x0: number; y0: number; cam0: Camera };
}

export const MODOS = ["Precessão de Larmor", "Pulso de RF (referencial girante)", "Relaxação T1, T2 e FID", "Eco de spin", "Gradiente: codificação de frequência (1D)", "Imagem 2D e contraste T1 × T2"];
const VIEW = { xMin: -17, xMax: 17, yMin: -9.5, yMax: 9.5 };
export const modo = (p: Params) => clamp(Math.round(num(p, "modo")), 0, MODOS.length - 1);
const TAU = 2 * Math.PI;
const FOV = 0.24;
const BODY_T = 310;

// ------------------------------------------------------------ parâmetros derivados
export const nucleo = (p: Params) => NUCLEOS[clamp(Math.round(num(p, "nucleo", 0)), 0, NUCLEOS.length - 1)]!;
export const f0 = (p: Params) => larmor(nucleo(p).gbar, num(p, "B0", 1.5));
/** Frequência de nutação ω₁ = γB₁ (rad/s) e ângulo do pulso α = γB₁τ (rad). */
export const w1 = (p: Params) => TAU * nucleo(p).gbar * 1e6 * num(p, "B1", 5.87) * 1e-6;
export const tpulse = (p: Params) => num(p, "tp", 1) * 1e-3;
export const flip = (p: Params) => w1(p) * tpulse(p);
export const T1 = (p: Params) => num(p, "T1", 800) * 1e-3;
/** T2 nunca excede T1. */
export const T2 = (p: Params) => Math.min(num(p, "T2", 80), num(p, "T1", 800)) * 1e-3;
export const TE = (p: Params) => num(p, "TE", 80) * 1e-3;
export const TR = (p: Params) => num(p, "TR", 500) * 1e-3;
const lento = (p: Params) => num(p, "lento", 0.1);

export function pulses(p: Params): Pulse[] {
  const m = modo(p);
  if (m < 1 || m > 3) return [];
  const tpl = tpulse(p);
  const out: Pulse[] = [{ t0: 0, dur: tpl, w1: w1(p) }];
  // 180°: dobro da duração, centrado em TE/2 após o centro do 90°
  if (m === 3) out.push({ t0: tpl / 2 + TE(p) / 2 - tpl, dur: 2 * tpl, w1: w1(p) });
  return out;
}
export const offsets = (p: Params) => lorentzOffsets(num(p, "disp", 0) > 0 ? 64 : 1, num(p, "df", 0), num(p, "disp", 0));

// ------------------------------------------------------------ imagem (cache)
const MAP = phantomMap(NIMG);
let imgKey = "";
let imgCache: { w: Float64Array; k: { re: Float64Array; im: Float64Array }; kmag: Float64Array; max: number; kmax: number } | null = null;
export function imaging(p: Params) {
  const key = `${TR(p)}|${TE(p)}`;
  if (imgCache && key === imgKey) return imgCache;
  const w = weightedImage(MAP, TR(p), TE(p));
  const k = fft2(w, NIMG);
  const kmag = new Float64Array(NIMG * NIMG);
  let kmax = 0;
  for (let q = 0; q < kmag.length; q++) {
    kmag[q] = Math.log10(1 + Math.hypot(k.re[q]!, k.im[q]!));
    kmax = Math.max(kmax, kmag[q]!);
  }
  imgCache = { w, k, kmag, max: Math.max(...w, 1e-9), kmax };
  imgKey = key;
  return imgCache;
}
export const linesAcquired = (s: MRState, p: Params) => clamp(Math.floor(s.tp / TR(p)) + 1, 1, NIMG);
let recKey = "";
let recCache: Float64Array | null = null;
function recon(p: Params, lines: number) {
  const key = `${TR(p)}|${TE(p)}|${lines}`;
  if (recCache && key === recKey) return recCache;
  recCache = reconstruct(imaging(p).k, NIMG, lines);
  recKey = key;
  return recCache;
}
export const tissueSignal = (p: Params, k: number) => seSignal(TECIDOS[k]!, TR(p), TE(p));

// ------------------------------------------------------------ passo
function step(s: MRState, p: Params, _t: number, dt: number): MRState {
  const m = modo(p);
  const h = dt * lento(p);
  const tp = s.tp + h;
  if (m >= 1 && m <= 3) {
    const Ms = evolve(s.Ms, offsets(p), pulses(p), s.tp, tp, T1(p), T2(p));
    return { ...s, Ms, m: mean(Ms), tp };
  }
  return { ...s, tp };
}

// ------------------------------------------------------------ desenho 3D
function bloch(d: Draw, s: MRState, cx: number, cy: number, S: number, trail: MRState[], opts: { lab?: number; showB1?: boolean; Beff?: Vec | null; label?: string } = {}) {
  const th = d.theme;
  const pr = projector(s.cam);
  const P = (v: Vec): [number, number] => {
    const q = pr.project(v as V3);
    return [cx + S * q[0], cy + S * q[1]];
  };
  const lab = opts.lab;
  const toLab = (v: Vec): Vec => (lab === undefined ? v : [v[0] * Math.cos(lab) + v[1] * Math.sin(lab), -v[0] * Math.sin(lab) + v[1] * Math.cos(lab), v[2]]);
  // esfera de referência
  for (const [a, b] of [[0, 1], [0, 2], [1, 2]] as const) {
    const pts: [number, number][] = [];
    for (let k = 0; k <= 72; k++) {
      const v: Vec = [0, 0, 0];
      v[a] = Math.cos((k * TAU) / 72);
      v[b] = Math.sin((k * TAU) / 72);
      pts.push(P(v));
    }
    d.polyline(pts, { color: th.grid, width: a === 0 && b === 1 ? 1.4 : 1 });
  }
  const o = P([0, 0, 0]);
  const axes: [Vec, string][] = [
    [[1.25, 0, 0], lab === undefined ? "x'" : "x"],
    [[0, 1.25, 0], lab === undefined ? "y'" : "y"],
    [[0, 0, 1.3], "z (B₀)"],
  ];
  for (const [v, l] of axes) {
    const e = P(v);
    d.arrow(o[0], o[1], e[0] - o[0], e[1] - o[1], { color: th.muted, width: 1.2, head: 7 });
    d.text(l, e[0], e[1], { size: 11, color: th.muted, dy: -8 });
  }
  if (opts.Beff) {
    const e = P(opts.Beff);
    d.arrow(o[0], o[1], e[0] - o[0], e[1] - o[1], { color: th.series[3]!, width: 2, dash: [5, 3] });
    d.text("B_ef", e[0], e[1], { size: 11, color: th.series[3]!, dx: 12 });
  }
  if (opts.showB1) {
    const e = P(toLab([1.1, 0, 0]));
    d.arrow(o[0], o[1], e[0] - o[0], e[1] - o[1], { color: th.series[3]!, width: 3 });
    d.text("B₁", e[0], e[1], { size: 12, color: th.series[3]!, weight: "700", dy: 10 });
  }
  // rastro de M
  if (lab === undefined) {
    const tr = trail.slice(-900).map((q) => P(q.m));
    d.polyline(tr, { color: th.series[0]!, width: 1.4, alpha: 0.7 });
  }
  if (s.Ms.length > 1) {
    s.Ms.forEach((M, i) => {
      if (i % 4) return;
      const e = P(toLab(M));
      d.line(o[0], o[1], e[0], e[1], { color: th.series[2]!, width: 1, alpha: 0.5 });
    });
  }
  const e = P(toLab(s.m));
  d.arrow(o[0], o[1], e[0] - o[0], e[1] - o[1], { color: th.series[1]!, width: 3.2, head: 11 });
  d.text("M", e[0], e[1], { size: 13, weight: "700", color: th.series[1]!, dx: 10, dy: -6 });
  if (opts.label) d.text(opts.label, cx, cy - S * 1.55, { size: 11, color: th.muted });
}

/** Gráfico de séries temporais a partir do rastro. */
function timePlot(d: Draw, box: { x0: number; y0: number; x1: number; y1: number }, trail: MRState[], tmax: number, ymin: number, series: { f: (s: MRState) => number; color: string; label: string }[], theory: { f: (t: number) => number; color: string }[] = [], marks: [number, string][] = []) {
  const th = d.theme;
  const pl = panel(d, box, { min: 0, max: tmax * 1e3 }, { min: ymin, max: 1.05 });
  pl.frame({ xlabel: "t (ms)", ylabel: "M / M₀" });
  for (const tq of theory) pl.plot((tms) => tq.f(tms / 1e3), 0, tmax * 1e3, { color: tq.color, width: 1.2, dash: [5, 4], n: 200 });
  for (const [tm, lab] of marks) {
    d.line(pl.X(tm * 1e3), box.y0, pl.X(tm * 1e3), box.y1, { color: th.muted, width: 1, dash: [2, 3] });
    d.text(lab, pl.X(tm * 1e3), box.y1, { size: 10, color: th.muted, dy: -8 });
  }
  const pts = trail.filter((q) => q.tp <= tmax);
  series.forEach((sr, i) => {
    pl.line(pts.map((q) => [q.tp * 1e3, sr.f(q)]), { color: sr.color, width: 2 });
    d.text(sr.label, box.x1 - 0.2, box.y0 + 0.5 + i * 0.6, { size: 10, align: "right", color: sr.color, weight: "600" });
  });
}

// ------------------------------------------------------------ desenho por modo
function drawLarmor(d: Draw, p: Params, s: MRState) {
  const th = d.theme;
  const f = f0(p);
  const phi = TAU * 0.5 * s.tp / Math.max(lento(p), 1e-9);
  const v: Vec = [Math.sin(s.tilt) * Math.cos(-phi), Math.sin(s.tilt) * Math.sin(-phi), Math.cos(s.tilt)];
  const st: MRState = { ...s, m: v, Ms: [v] };
  // cone de precessão
  const pr = projector(s.cam);
  const cx = -8.5, cy = 0, S = 5;
  const P = (q: Vec): [number, number] => {
    const r = pr.project(q as V3);
    return [cx + S * r[0], cy + S * r[1]];
  };
  const cone: [number, number][] = [];
  for (let k = 0; k <= 60; k++) cone.push(P([Math.sin(s.tilt) * Math.cos((k * TAU) / 60), Math.sin(s.tilt) * Math.sin((k * TAU) / 60), Math.cos(s.tilt)]));
  d.polyline(cone, { color: th.series[1]!, width: 1.2, dash: [4, 3] });
  bloch(d, st, cx, cy, S, [], { lab: 0, label: "arraste a ponta de M para inclinar; arraste o fundo para girar a vista" });
  d.text(`${nucleo(p).nome} em B₀ = ${fmt(num(p, "B0", 1.5))} T`, -16.5, 8.7, { size: 14, weight: "700", align: "left" });
  d.text(`f₀ = γB₀/2π = ${fmt(f / 1e6)} MHz  (animação: 0,5 volta por segundo de tela)`, -16.5, 7.9, { size: 11, align: "left", color: th.muted });
  // níveis de energia
  const x0 = 2.5;
  const dE = 6.62607015e-34 * f;
  const P0 = polarization(f, BODY_T);
  d.text("Dois níveis do spin ½ no campo", x0, 7.6, { size: 12, align: "left", weight: "700" });
  const gap = clamp(0.8 + num(p, "B0", 1.5) * 0.6, 0.8, 5);
  d.line(x0, 5.4 - gap / 2, x0 + 5, 5.4 - gap / 2, { color: th.text, width: 2.4 });
  d.line(x0, 5.4 + gap / 2, x0 + 5, 5.4 + gap / 2, { color: th.text, width: 2.4 });
  d.text("m = +½ (paralelo)", x0 + 5.3, 5.4 - gap / 2, { size: 10, align: "left" });
  d.text("m = −½ (antiparalelo)", x0 + 5.3, 5.4 + gap / 2, { size: 10, align: "left" });
  d.arrow(x0 + 2.5, 5.4 - gap / 2, 0, gap, { color: th.series[3]!, width: 1.5, head: 6 });
  d.text(`ΔE = h f₀ = ${fmt(dE / 1.602176634e-19 * 1e9)} neV`, x0 + 2.7, 5.4, { size: 10, align: "left", color: th.series[3]! });
  d.text(`excesso no nível de baixo (310 K): ${fmt(P0 * 1e6)} ppm`, x0, 5.4 - gap / 2 - 0.9, { size: 11, align: "left", weight: "600" });
  d.text("Só esse pequeno excesso forma a magnetização M.", x0, 5.4 - gap / 2 - 1.6, { size: 10, align: "left", color: th.muted });
  // f₀ × B₀ para vários núcleos
  const box = { x0: x0 + 0.6, y0: -8, x1: 16.2, y1: -1.2 };
  const pl = panel(d, box, { min: 0, max: 7 }, { min: 0, max: 300 });
  pl.frame({ xlabel: "B₀ (T)", ylabel: "f₀ (MHz)" });
  NUCLEOS.forEach((n, i) => {
    pl.plot((B) => n.gbar * B, 0, 7, { color: th.series[i]!, width: n === nucleo(p) ? 2.6 : 1.3 });
    d.text(n.nome, pl.X(Math.min(7, 280 / n.gbar)), pl.Y(Math.min(n.gbar * 7, 280)), { size: 10, color: th.series[i]!, dx: -10, dy: -8 });
  });
  d.dot(pl.X(num(p, "B0", 1.5)), pl.Y(f / 1e6), 6, th.series[1]!);
}

function drawPulse(d: Draw, p: Params, s: MRState, trail: MRState[]) {
  const th = d.theme;
  const pl = pulses(p);
  const on = pl.some((q) => s.tp >= q.t0 && s.tp < q.t0 + q.dur);
  const dw = TAU * num(p, "df", 0);
  const W1 = w1(p);
  const Wn = Math.hypot(W1, dw);
  bloch(d, s, -9.5, 0.3, 5, trail, { showB1: on, Beff: dw !== 0 ? [W1 / Wn, 0, dw / Wn] : null, label: "referencial girante (gira com f₀ em torno de z)" });
  // referencial do laboratório: nutação em espiral
  const lab = TAU * 0.0 + (s.tp / tpulse(p)) * TAU * 3;
  bloch(d, s, 9.8, -4.6, 2.6, [], { lab, label: "no laboratório (f₀ reduzida para caber na tela)" });
  // espiral do laboratório
  const pr = projector(s.cam);
  const pts: [number, number][] = trail.slice(-900).map((q) => {
    const a = (q.tp / tpulse(p)) * TAU * 3;
    const v: V3 = [q.m[0] * Math.cos(a) + q.m[1] * Math.sin(a), -q.m[0] * Math.sin(a) + q.m[1] * Math.cos(a), q.m[2]];
    const r = pr.project(v);
    return [9.8 + 2.6 * r[0], -4.6 + 2.6 * r[1]];
  });
  d.polyline(pts, { color: th.series[0]!, width: 1.2, alpha: 0.7 });
  d.text("Pulso de RF no referencial girante", -16.5, 8.7, { size: 14, weight: "700", align: "left" });
  const a = (flip(p) * 180) / Math.PI;
  const x = 2.6;
  const rows: [string, string][] = [
    ["B₁", `${fmt(num(p, "B1", 5.87))} µT`],
    ["duração τ", `${fmt(num(p, "tp", 1))} ms`],
    ["α = γ B₁ τ", `${fmt(a)}°`],
    ["desvio de ressonância", `${fmt(num(p, "df", 0))} Hz`],
    ["M_z / M₀", fmt(s.m[2])],
    ["|M_xy| / M₀", fmt(Math.hypot(s.m[0], s.m[1]))],
  ];
  rows.forEach(([k, v], i) => {
    d.text(k, x, 7.6 - i * 0.85, { size: 12, align: "left", color: th.muted });
    d.text(v, x + 7, 7.6 - i * 0.85, { size: 12, align: "left", weight: "600" });
  });
  d.text(on ? "RF LIGADA: M gira em torno de B₁" : s.tp < 1e-9 ? "aguardando o pulso" : "RF desligada: precessão livre e relaxação", x, 2.2, { size: 12, align: "left", weight: "700", color: on ? th.series[3]! : th.text });
  d.text("Fora de ressonância, M gira em torno de B_ef inclinado", x, 1.4, { size: 10, align: "left", color: th.muted });
  d.text("e não chega ao plano xy.", x, 0.8, { size: 10, align: "left", color: th.muted });
}

function drawRelax(d: Draw, p: Params, s: MRState, trail: MRState[]) {
  const th = d.theme;
  bloch(d, s, -10, 0.6, 4.6, trail, { label: "referencial girante" });
  const a = flip(p);
  const t1 = T1(p), t2 = T2(p);
  const t2s = t2star(t2, num(p, "disp", 0));
  const tw = tpulse(p);
  const tA = tw + 5 * t2s;
  timePlot(
    d,
    { x0: 0.8, y0: 0.9, x1: 16.2, y1: 7.0 },
    trail,
    tA,
    -1.05,
    [
      { f: (q) => Math.hypot(q.m[0], q.m[1]), color: th.series[1]!, label: "|M_xy|" },
      { f: (q) => q.m[1], color: th.series[2]!, label: "FID (M_y')" },
    ],
    [{ f: (t) => (t < tw ? NaN : Math.abs(Math.sin(a)) * Math.exp(-(t - tw) / t2s)), color: th.series[1]! }],
  );
  timePlot(
    d,
    { x0: 0.8, y0: -7.6, x1: 16.2, y1: -1.5 },
    trail,
    tw + 5 * t1,
    -1.05,
    [{ f: (q) => q.m[2], color: th.series[0]!, label: "M_z" }],
    [{ f: (t) => (t < tw ? NaN : 1 - (1 - Math.cos(a)) * Math.exp(-(t - tw) / t1)), color: th.series[0]! }],
    a > 2.5 ? [[t1 * Math.log(2) + tw, "T₁ ln 2"]] : [],
  );
  d.text(`α = ${fmt((a * 180) / Math.PI)}°   T₁ = ${fmt(t1 * 1e3)} ms   T₂ = ${fmt(t2 * 1e3)} ms   T₂* = ${fmt(t2s * 1e3)} ms`, 0.8, 8.0, { size: 12, align: "left", weight: "600" });
  d.text("Relaxação T1, T2 e FID", -16.5, 8.7, { size: 14, weight: "700", align: "left" });
  d.text("tracejado: M_z = 1 − (1 − cos α) e^(−t/T₁)  e  |M_xy| = sen α e^(−t/T₂*)", 16.2, -8.9, { size: 10, align: "right", color: th.muted });
}

function drawEcho(d: Draw, p: Params, s: MRState, trail: MRState[]) {
  const th = d.theme;
  // vista de cima do plano transversal com as isocromatas
  const cx = -10, cy = 1, R = 4.6;
  d.circle(cx, cy, R, { stroke: th.grid, width: 1.2 });
  d.line(cx - R - 0.4, cy, cx + R + 0.4, cy, { color: th.muted, width: 1 });
  d.line(cx, cy - R - 0.4, cx, cy + R + 0.4, { color: th.muted, width: 1 });
  d.text("x'", cx + R + 0.7, cy, { size: 11, color: th.muted });
  d.text("y'", cx, cy + R + 0.7, { size: 11, color: th.muted });
  const offs = offsets(p);
  const n = s.Ms.length;
  s.Ms.forEach((M, i) => {
    const hue = n > 1 ? (offs[i]! - offs[0]!) / Math.max(offs[n - 1]! - offs[0]!, 1e-9) : 0.5;
    const col = `hsl(${Math.round(220 - 200 * hue)}, 70%, ${th.dark ? 62 : 45}%)`;
    d.arrow(cx, cy, R * M[0], R * M[1], { color: col, width: 1.2, head: 5, alpha: 0.75 });
  });
  d.arrow(cx, cy, R * s.m[0], R * s.m[1], { color: th.text, width: 3.4, head: 11 });
  d.text("cada seta: isocromata (azul = mais lenta, vermelha = mais rápida); preta: soma", cx, cy - R - 1.2, { size: 10, color: th.muted });
  d.text("Eco de spin (90° — TE/2 — 180° — eco)", -16.5, 8.7, { size: 14, weight: "700", align: "left" });
  const te = TE(p), t2 = T2(p), tw = tpulse(p);
  const t2s = t2star(t2, num(p, "disp", 0));
  const tmax = Math.max(1.6 * te + tw, te + 3 * t2s);
  const box = { x0: 0.8, y0: -7.6, x1: 16.2, y1: 7.0 };
  timePlot(
    d,
    box,
    trail,
    tmax,
    0,
    [{ f: (q) => Math.hypot(q.m[0], q.m[1]), color: th.series[1]!, label: "|M_xy| (sinal)" }],
    [
      { f: (t) => Math.exp(-(t - tw / 2) / t2), color: th.series[0]! },
      { f: (t) => (t < te / 2 + tw / 2 ? Math.exp(-(t - tw / 2) / t2s) : NaN), color: th.muted },
    ],
    [
      [tw / 2, "90°"],
      [te / 2 + tw / 2, "180°"],
      [te + tw / 2, "eco (TE)"],
    ],
  );
  d.text(`TE = ${fmt(te * 1e3)} ms   T₂ = ${fmt(t2 * 1e3)} ms   T₂* = ${fmt(t2s * 1e3)} ms   e^(−TE/T₂) = ${fmt(Math.exp(-te / t2))}`, 0.8, 8.0, { size: 12, align: "left", weight: "600" });
  d.text("tracejado azul: envoltória e^(−t/T₂) que os ecos seguem; cinza: FID com T₂*", 16.2, -8.9, { size: 10, align: "right", color: th.muted });
}

function image(d: Draw, img: Float64Array, n: number, x0: number, y0: number, size: number, max: number, color?: (v: number) => string) {
  const c = size / n;
  for (let j = 0; j < n; j++) {
    let i = 0;
    while (i < n) {
      const v = img[j * n + i]!;
      let k = i + 1;
      while (k < n && Math.abs(img[j * n + k]! - v) < 1e-12) k++;
      const g = clamp(v / max, 0, 1);
      d.rect(x0 + i * c, y0 + size - (j + 1) * c, (k - i) * c + c * 0.02, c * 1.02, { fill: color ? color(g) : `rgb(${Math.round(255 * g)}, ${Math.round(255 * g)}, ${Math.round(255 * g)})` });
      i = k;
    }
  }
  d.rect(x0, y0, size, size, { stroke: d.theme.muted, width: 1 });
}

function draw1D(d: Draw, p: Params, s: MRState) {
  const th = d.theme;
  const I = imaging(p);
  const G = num(p, "G", 10) * 1e-3;
  const gbar = nucleo(p).gbar * 1e6;
  const x0 = -16.2, y0 = -7.6, size = 11.5;
  image(d, I.w, NIMG, x0, y0, size, I.max);
  d.text("Fantoma ponderado (TR, TE atuais)", x0, y0 + size + 0.5, { size: 11, align: "left", weight: "600" });
  // gradiente: campo extra cresce com x
  d.arrow(x0, y0 - 0.9, size, 0, { color: th.series[3]!, width: 2 });
  d.text(`G_x = ${fmt(G * 1e3)} mT/m: B = B₀ + G_x x`, x0 + size / 2, y0 - 1.5, { size: 10, color: th.series[3]! });
  const pos = (i: number) => ((i + 0.5) / NIMG - 0.5) * FOV;
  const fr = (i: number) => gbar * G * pos(i);
  // instante da leitura: varre a janela de aquisição em laço
  const dwell = 1 / (gbar * G * FOV);
  const Tacq = NIMG * dwell;
  const tA = ((s.tp % Tacq) + Tacq) % Tacq - Tacq / 2;
  // fases dos spins de algumas colunas
  for (let i = 4; i < NIMG; i += 8) {
    const xx = x0 + ((i + 0.5) / NIMG) * size;
    const ph = TAU * fr(i) * tA;
    d.arrowPx(xx, y0 + size + 1.6, Math.cos(ph), Math.sin(ph), 14, { color: th.series[0]!, width: 1.6, head: 5 });
  }
  d.text("fase dos spins de cada coluna no instante da leitura", x0, y0 + size + 2.9, { size: 10, align: "left", color: th.muted });
  d.text("Codificação de frequência", -16.5, 8.7, { size: 14, weight: "700", align: "left" });
  // sinal no tempo
  const P = projection(I.w, NIMG);
  const sig = (t: number) => P.reduce((acc, v, i) => acc + v * Math.cos(TAU * fr(i) * t), 0);
  const smax = P.reduce((a, b) => a + b, 0);
  const b1 = { x0: -2.4, y0: 1.4, x1: 16.2, y1: 7.4 };
  const p1 = panel(d, b1, { min: -Tacq / 2 * 1e3, max: Tacq / 2 * 1e3 }, { min: -smax * 0.6, max: smax * 1.05 });
  p1.frame({ xlabel: "t em torno do eco (ms)", ylabel: "sinal (parte real)", fy: () => "" });
  p1.plot((tm) => sig(tm / 1e3), -Tacq / 2 * 1e3, Tacq / 2 * 1e3, { color: th.series[1]!, width: 1.8, n: 400 });
  d.line(p1.X(tA * 1e3), b1.y0, p1.X(tA * 1e3), b1.y1, { color: th.series[0]!, width: 1.2 });
  // espectro = perfil
  const b2 = { x0: -2.4, y0: -7.6, x1: 16.2, y1: -1.4 };
  const fmax = gbar * G * FOV / 2 / 1e3;
  const p2 = panel(d, b2, { min: -fmax, max: fmax }, { min: 0, max: Math.max(...P) * 1.1 });
  p2.frame({ xlabel: "f − f₀ (kHz)   ↔   x = (f − f₀)/(γ̄ G_x)", ylabel: "|S(f)| = projeção ρ(x)", fy: () => "" });
  const bw = (2 * fmax) / NIMG;
  P.forEach((v, i) => d.rect(p2.X(fr(i) / 1e3 - bw / 2), b2.y0, p2.X(bw) - p2.X(0), p2.Y(v) - b2.y0, { fill: th.series[2]!, alpha: 0.85 }));
  d.text(`banda: ${fmt(2 * fmax)} kHz para FOV = ${fmt(FOV * 100)} cm  →  ${fmt((gbar * G) / 1e3 / 100)} kHz por cm`, b2.x1, b2.y1 + 0.5, { size: 10, align: "right", color: th.muted });
}

function draw2D(d: Draw, p: Params, s: MRState) {
  const th = d.theme;
  const I = imaging(p);
  const lines = linesAcquired(s, p);
  const R = recon(p, lines);
  const size = 9.6, y0 = -3.3;
  const xs = [-16.4, -5.1, 6.2];
  image(d, I.w, NIMG, xs[0]!, y0, size, I.max);
  // espaço k: só as linhas adquiridas
  const filled = new Set(centerOut(NIMG).slice(0, lines));
  const kshow = new Float64Array(NIMG * NIMG);
  for (let j = 0; j < NIMG; j++) if (filled.has(j)) for (let i = 0; i < NIMG; i++) kshow[j * NIMG + i] = I.kmag[j * NIMG + i]!;
  image(d, kshow, NIMG, xs[1]!, y0, size, I.kmax, (g) => `rgb(${Math.round(30 + 225 * g)}, ${Math.round(30 + 160 * g)}, ${Math.round(40 + 40 * g)})`);
  image(d, R, NIMG, xs[2]!, y0, size, I.max);
  d.text("Objeto (contraste ideal)", xs[0]! + size / 2, y0 + size + 0.5, { size: 11, weight: "600" });
  d.text(`Espaço k (${lines}/${NIMG} linhas)`, xs[1]! + size / 2, y0 + size + 0.5, { size: 11, weight: "600" });
  d.text("Imagem = TF⁻¹(espaço k)", xs[2]! + size / 2, y0 + size + 0.5, { size: 11, weight: "600" });
  d.text("Imagem 2D por spin-eco", -16.5, 8.7, { size: 14, weight: "700", align: "left" });
  const te = TE(p), tr = TR(p);
  const kind = tr < 0.8 && te < 0.03 ? "ponderada em T1" : tr > 2 && te > 0.06 ? "ponderada em T2" : tr > 2 && te < 0.03 ? "ponderada em densidade de prótons" : "contraste misto";
  d.text(`TR = ${fmt(tr * 1e3)} ms, TE = ${fmt(te * 1e3)} ms: ${kind}`, -16.5, 7.9, { size: 12, align: "left", color: th.series[1]!, weight: "600" });
  d.text(`tempo de varredura N·TR = ${fmt(NIMG * tr)} s; linhas do centro para a borda (o centro do espaço k dá o contraste)`, -16.5, 7.2, { size: 10, align: "left", color: th.muted });
  // barras de sinal por tecido
  const box = { x0: -16.4, y0: -8.5, x1: 16.2, y1: -5.0 };
  const pl = panel(d, box, { min: 0, max: TECIDOS.length }, { min: 0, max: 1 });
  pl.frame({ xticks: [], yticks: [0, 0.5, 1], ylabel: "S = ρ(1 − e^(−TR/T₁)) e^(−TE/T₂)" });
  TECIDOS.forEach((t, k) => {
    const v = seSignal(t, tr, te);
    const g = Math.round(255 * clamp(v / I.max, 0, 1));
    d.rect(pl.X(k + 0.15), pl.Y(0), pl.X(k + 0.85) - pl.X(k + 0.15), pl.Y(v) - pl.Y(0), { fill: `rgb(${g}, ${g}, ${g})`, stroke: th.muted, width: 1 });
    d.text(`${t.nome}: ${fmt(v)}`, pl.X(k + 0.5), box.y0, { size: 10, dy: 9 });
    d.text(`T₁ ${fmt(t.T1 * 1e3)} / T₂ ${fmt(t.T2 * 1e3)} ms`, pl.X(k + 0.5), pl.Y(Math.min(v, 0.85)), { size: 9, color: th.series[1]!, dy: -8 });
  });
}

// ------------------------------------------------------------ simulação
const camInit = (): Camera => ({ ...defaultCamera(), yaw: (30 * Math.PI) / 180, pitch: (20 * Math.PI) / 180 });

export const rmnMri = defineSim<MRState>({
  id: "rmn-mri",
  title: "Ressonância magnética nuclear e imagem",
  course: "FG IV",
  topic: "Física moderna",
  priority: "P2",
  summary:
    "Spins em precessão de Larmor, pulso de RF no referencial girante, relaxação T1/T2 e FID pelas equações de Bloch, eco de spin com isocromatas e uma imagem por gradientes: codificação de frequência, espaço k preenchido linha a linha e contraste T1 × T2 de um fantoma.",
  equations: [
    String.raw`f_0 = \frac{\gamma}{2\pi} B_0 \qquad \frac{N_\uparrow - N_\downarrow}{N} = \tanh\frac{h f_0}{2kT}`,
    String.raw`\frac{d\vec M}{dt} = \gamma\,\vec M\times\vec B_{ef} - \frac{M_x\hat x' + M_y\hat y'}{T_2} + \frac{M_0 - M_z}{T_1}\hat z \qquad \alpha = \gamma B_1 \tau`,
    String.raw`\frac{1}{T_2^*} = \frac{1}{T_2} + \pi\,\Delta f \qquad S_{eco}(TE) = M_0\,e^{-TE/T_2}`,
    String.raw`f(x) = \frac{\gamma}{2\pi}(B_0 + G_x x) \qquad S = \rho\left(1 - e^{-TR/T_1}\right)e^{-TE/T_2}`,
  ],
  liveEquations(s, p) {
    const m = modo(p);
    if (m === 0) return [String.raw`f_0 = ${texNum(nucleo(p).gbar)}\ \text{MHz/T} \times ${texNum(num(p, "B0", 1.5))}\ \text{T} = ${texNum(f0(p) / 1e6)}\ \text{MHz}`, String.raw`\text{excesso} = ${texNum(polarization(f0(p), BODY_T) * 1e6)}\ \text{ppm}`];
    if (m >= 1 && m <= 3)
      return [
        String.raw`\alpha = \gamma B_1\tau = ${texNum((flip(p) * 180) / Math.PI)}^\circ \quad M = (${texNum(s.m[0])},\ ${texNum(s.m[1])},\ ${texNum(s.m[2])})\,M_0`,
        String.raw`T_2^* = ${texNum(t2star(T2(p), num(p, "disp", 0)) * 1e3)}\ \text{ms}`,
      ];
    if (m === 4) {
      const G = num(p, "G", 10) * 1e-3;
      return [String.raw`\frac{\gamma}{2\pi}G_x = ${texNum((nucleo(p).gbar * 1e6 * G) / 100 / 1e3)}\ \text{kHz/cm}`];
    }
    return TECIDOS.slice(0, 3).map((t, k) => String.raw`S_{\text{${t.nome.split(" ")[0]}}} = ${texNum(tissueSignal(p, k))}`);
  },
  params: [
    { key: "modo", label: "Experimento", unit: "", min: 0, max: MODOS.length - 1, step: 1, default: 0, options: MODOS.map((label, value) => ({ value, label })) },
    { key: "nucleo", label: "Núcleo", unit: "", min: 0, max: NUCLEOS.length - 1, step: 1, default: 0, live: true, options: NUCLEOS.map((n, value) => ({ value, label: `${n.nome} (${n.gbar} MHz/T)` })) },
    { key: "B0", label: "Campo principal B₀", unit: "T", min: 0.1, max: 7, step: 0.05, default: 1.5, live: true },
    { key: "B1", label: "Amplitude do campo de RF B₁", unit: "µT", min: 0.5, max: 30, step: 0.01, default: 5.87 },
    { key: "tp", label: "Duração do pulso τ", unit: "ms", min: 0.1, max: 5, step: 0.01, default: 1 },
    { key: "df", label: "Desvio de ressonância Δf", unit: "Hz", min: -500, max: 500, step: 1, default: 0 },
    { key: "T1", label: "Tempo de relaxação T₁", unit: "ms", min: 50, max: 5000, step: 10, default: 800 },
    { key: "T2", label: "Tempo de relaxação T₂ (≤ T₁)", unit: "ms", min: 5, max: 2000, step: 1, default: 80 },
    { key: "disp", label: "Inomogeneidade de B₀ (largura Δf)", unit: "Hz", min: 0, max: 100, step: 0.5, default: 0 },
    { key: "TE", label: "Tempo de eco TE", unit: "ms", min: 5, max: 300, step: 1, default: 80 },
    { key: "TR", label: "Tempo de repetição TR", unit: "ms", min: 100, max: 5000, step: 10, default: 500 },
    { key: "G", label: "Gradiente de leitura G_x", unit: "mT/m", min: 1, max: 40, step: 0.5, default: 10, live: true },
    {
      key: "lento",
      label: "Escala de tempo",
      unit: "",
      min: 0.001,
      max: 10,
      step: 0.001,
      default: 0.1,
      live: true,
      options: [
        { value: 10, label: "10× mais rápido" },
        { value: 1, label: "Tempo real" },
        { value: 0.1, label: "10× mais lento" },
        { value: 0.01, label: "100× mais lento" },
        { value: 0.001, label: "1000× mais lento" },
      ],
    },
  ],
  observables: [
    { key: "tms", label: "Tempo da experiência", unit: "ms", value: (s) => s.tp * 1e3 },
    { key: "Mx", label: "M_x' / M₀", unit: "", value: (s) => s.m[0] },
    { key: "My", label: "M_y' / M₀ (FID)", unit: "", value: (s) => s.m[1] },
    { key: "Mz", label: "M_z / M₀", unit: "", value: (s) => s.m[2] },
    { key: "Mxy", label: "|M_xy| / M₀ (sinal)", unit: "", value: (s) => Math.hypot(s.m[0], s.m[1]) },
    { key: "f0", label: "Frequência de Larmor", unit: "MHz", value: (_s, p) => f0(p) / 1e6 },
    { key: "alpha", label: "Ângulo de nutação α", unit: "°", value: (_s, p) => (flip(p) * 180) / Math.PI },
    { key: "pol", label: "Excesso de população", unit: "ppm", value: (_s, p) => polarization(f0(p), BODY_T) * 1e6 },
    { key: "T2s", label: "T₂*", unit: "ms", value: (_s, p) => t2star(T2(p), num(p, "disp", 0)) * 1e3 },
    { key: "S_lcr", label: "Sinal do líquor", unit: "", value: (_s, p) => tissueSignal(p, 0) },
    { key: "S_gm", label: "Sinal da substância cinzenta", unit: "", value: (_s, p) => tissueSignal(p, 1) },
    { key: "S_wm", label: "Sinal da substância branca", unit: "", value: (_s, p) => tissueSignal(p, 2) },
    { key: "S_gord", label: "Sinal da gordura", unit: "", value: (_s, p) => tissueSignal(p, 3) },
    { key: "S_les", label: "Sinal da lesão", unit: "", value: (_s, p) => tissueSignal(p, 4) },
    { key: "contraste", label: "Contraste branca × cinzenta", unit: "", value: (_s, p) => (tissueSignal(p, 2) - tissueSignal(p, 1)) / Math.max(tissueSignal(p, 2) + tissueSignal(p, 1), 1e-12) },
    { key: "linhas", label: "Linhas do espaço k adquiridas", unit: "", value: (s, p) => (modo(p) === 5 ? linesAcquired(s, p) : 0) },
  ],
  chart: { x: "tms", y: "Mxy" },
  scenarios: [
    {
      id: "larmor",
      label: "Precessão de Larmor",
      params: { modo: 0, nucleo: 0, B0: 1.5, lento: 1 },
      guide: `### O spin como um pião magnético
1. Um núcleo com spin tem momento magnético; no campo $B_0$ ele precessa em torno de $z$ com a **frequência de Larmor** $f_0 = \\gamma B_0/2\\pi$.
2. Para o hidrogênio, $\\gamma/2\\pi = 42{,}58$ MHz/T: a 1,5 T, $f_0 \\approx 64$ MHz (faixa de rádio FM).
3. Arraste a ponta de $\\vec M$ para mudar a inclinação: a frequência **não** depende do ângulo.
4. Troque o núcleo e o campo e compare as retas $f_0(B_0)$.
5. Repare no excesso de população: poucos ppm. É por isso que a RMN precisa de muitos núcleos e campos fortes.`,
      predict: [
        {
          question: "Dobrando B₀ de 1,5 T para 3 T, a frequência de precessão dos prótons...",
          options: ["dobra (≈ 128 MHz)", "fica igual", "cai à metade", "quadruplica"],
          answer: 0,
          explanation: "$f_0 = \\gamma B_0/2\\pi$ é proporcional ao campo: 42,58 MHz/T × 3 T ≈ 128 MHz.",
        },
      ],
    },
    {
      id: "relaxacao",
      label: "Pulso de 90°, relaxação e FID",
      params: { modo: 2, B1: 5.87, tp: 1, T1: 800, T2: 80, disp: 0, df: 20, lento: 0.1 },
      guide: `### Tombar e esperar voltar
1. O pulso de RF (campo $B_1$ girando com $f_0$) parece estático no **referencial girante**: $\\vec M$ gira em torno dele pelo ângulo $\\alpha = \\gamma B_1\\tau$. Com 5,87 µT por 1 ms, $\\alpha = 90^\\circ$.
2. Depois do pulso, $M_{xy}$ precessa (o desvio de 20 Hz faz o FID oscilar) e decai com $T_2$; $M_z$ volta a $M_0$ com $T_1$.
3. Compare as curvas medidas com as teóricas tracejadas.
4. Ligue a inomogeneidade de $B_0$: o FID decai mais depressa, com $T_2^*$.
5. Faça $\\tau = 2$ ms (180°): $M_z$ começa em $-M_0$ e cruza zero em $T_1\\ln 2$ — é assim que se mede $T_1$ (inversão-recuperação).
6. Veja também o experimento "Pulso de RF" para a nutação no laboratório e fora de ressonância.`,
      predict: [
        {
          question: "Depois de um pulso de 90°, o que some primeiro?",
          options: ["A magnetização transversal (T₂ é menor)", "A recuperação longitudinal termina antes", "As duas juntas", "Nenhuma: M fica no plano xy"],
          answer: 0,
          explanation: "Nos tecidos $T_2 \\ll T_1$ (80 ms contra 800 ms aqui): o sinal some muito antes de $M_z$ se recuperar. Por isso é preciso esperar um TR longo antes de repetir.",
        },
      ],
    },
    {
      id: "eco",
      label: "Eco de spin",
      params: { modo: 3, B1: 5.87, tp: 1, T1: 800, T2: 80, disp: 30, TE: 60, lento: 0.05 },
      guide: `### Desfazer a defasagem
1. Com $B_0$ inomogêneo, cada isocromata gira com frequência diferente: o leque se abre e o FID some em $T_2^*$.
2. No instante $TE/2$, um pulso de 180° espelha o leque: as rápidas ficam atrás e alcançam as lentas.
3. Em $TE$ todas se realinham: surge o **eco**. A altura do eco não depende da inomogeneidade, só de $T_2$: $S = e^{-TE/T_2}$.
4. Mude TE e verifique que o pico cai sobre a envoltória $e^{-t/T_2}$ (tracejado azul).`,
      predict: [
        {
          question: "Se o pulso de 180° é aplicado em t = 30 ms, quando aparece o eco?",
          options: ["Em 30 ms", "Em 60 ms", "Em 90 ms", "Logo após o pulso"],
          answer: 1,
          explanation: "A defasagem acumulada em 30 ms é desfeita em mais 30 ms: o eco acontece em $TE = 2 \\times 30$ ms.",
        },
      ],
    },
    {
      id: "imagem",
      label: "Imagem: contraste T1 × T2",
      params: { modo: 5, TR: 500, TE: 15, lento: 10 },
      guide: `### Do sinal à imagem
1. Gradientes tornam a frequência (e a fase) dependentes da posição. Cada TR adquire uma linha do **espaço k**; a imagem é a transformada de Fourier inversa.
2. As linhas são preenchidas do centro para fora: primeiro a imagem aparece borrada (baixas frequências espaciais), depois ganha detalhes.
3. **Ponderação T1** (TR curto, TE curto): gordura clara, líquor escuro, substância branca mais clara que a cinzenta.
4. **Ponderação T2** (TR = 4000 ms, TE = 100 ms): líquor e a lesão ficam brilhantes.
5. Veja o experimento "Gradiente (1D)": o espectro do sinal é a projeção do objeto.`,
      predict: [
        {
          question: "Numa imagem ponderada em T2 (TR e TE longos), o líquor aparece...",
          options: ["brilhante", "escuro", "igual à substância branca", "invisível"],
          answer: 0,
          explanation: "O líquor tem T2 muito longo (≈ 2 s): no TE de 100 ms quase não perdeu sinal, enquanto os tecidos com T2 ≈ 80 ms já decaíram bastante.",
        },
      ],
    },
  ],
  exercises: [
    {
      id: "larmor",
      prompt: "Qual é a frequência de Larmor dos prótons (γ/2π = 42,58 MHz/T) num tomógrafo de {B0} T, em MHz?",
      vary: { B0: [0.2, 7, 2] },
      fixed: { modo: 0, nucleo: 0 },
      answer: { label: "f₀", unit: "MHz", compute: (p) => 42.577 * num(p, "B0") },
    },
    {
      id: "pulso90",
      prompt: "Que amplitude B₁ produz um pulso de 90° em prótons (γ/2π = 42,58 MHz/T) com duração de {tp} ms? Responda em µT.",
      vary: { tp: [0.2, 3, 2] },
      fixed: { modo: 1 },
      answer: { label: "B₁", unit: "µT", compute: (p) => (0.25 / (42.577e6 * num(p, "tp") * 1e-3)) * 1e6 },
      hint: "α = γB₁τ = 2π (γ/2π) B₁ τ; para 90°, (γ/2π) B₁ τ = 1/4.",
    },
    {
      id: "inversao",
      prompt: "Após um pulso de inversão (180°), M_z = M₀(1 − 2e^(−t/T₁)). Para um tecido com T₁ = {T1} ms, em que instante M_z se anula (ms)?",
      vary: { T1: [200, 2000, 0] },
      fixed: { modo: 2 },
      answer: { label: "t", unit: "ms", compute: (p) => num(p, "T1") * Math.log(2) },
    },
  ],

  init: (p) => {
    const Ms = offsets(p).map((): Vec => [0, 0, 1]);
    return { Ms, m: [0, 0, 1], tp: 0, tilt: 0.5, cam: camInit(), drag: null };
  },
  step,
  dt: 1 / 120,
  sampleEvery: 1,
  maxSamples: 4000,

  viewport: () => ({ ...VIEW, unit: "" }),
  render(ctx, frame) {
    const d = draw(ctx, frame);
    const { state: s, params: p, trail } = frame;
    switch (modo(p)) {
      case 0:
        return drawLarmor(d, p, s);
      case 1:
        return drawPulse(d, p, s, trail);
      case 2:
        return drawRelax(d, p, s, trail);
      case 3:
        return drawEcho(d, p, s, trail);
      case 4:
        return draw1D(d, p, s);
      default:
        return draw2D(d, p, s);
    }
  },

  pointer: {
    down(s, p, pt) {
      const m = modo(p);
      if (m > 2) return undefined;
      if (m === 0) {
        const pr = projector(s.cam);
        const phi = (TAU * 0.5 * s.tp) / Math.max(lento(p), 1e-9);
        const q = pr.project([Math.sin(s.tilt) * Math.cos(-phi), Math.sin(s.tilt) * Math.sin(-phi), Math.cos(s.tilt)]);
        if (Math.hypot(pt.x - (-8.5 + 5 * q[0]), pt.y - 5 * q[1]) < 1.2) return { ...s, drag: { kind: "tilt", x0: pt.x, y0: pt.y, cam0: s.cam } };
      }
      if (pt.x < 0) return { ...s, drag: { kind: "cam", x0: pt.x, y0: pt.y, cam0: s.cam } };
      return undefined;
    },
    move(s, _p, pt, dragging) {
      if (!dragging || !s.drag) return undefined;
      if (s.drag.kind === "cam") return { ...s, cam: orbit(s.drag.cam0, (pt.x - s.drag.x0) * 40, -(pt.y - s.drag.y0) * 40) };
      // inclinação: o eixo z aparece na tela com fator cos(elevação)
      const c = clamp(pt.y / (5 * Math.max(Math.cos(s.cam.pitch), 0.2)), -1, 1);
      return { ...s, tilt: clamp(Math.acos(c), 0.02, Math.PI - 0.02) };
    },
    up: (s) => (s.drag ? { ...s, drag: null } : undefined),
    cursor: (_s, p, pt) => (modo(p) <= 2 && pt.x < 0 ? "move" : undefined),
  },
  actions: [{ id: "vista", label: "Restaurar a vista 3D", run: (s) => ({ ...s, cam: camInit() }) }],
});

export default rmnMri;
