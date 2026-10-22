import { defineSim, draw, num, texNum, type Draw, type Params } from "@fisilab/core";
import {
  anglesAt,
  C_LIGHT,
  CIRCULO,
  cost,
  ELIPSE,
  FOCO_A,
  FOCO_B,
  fresnelR,
  goldenMin,
  mirrorNormal,
  mirrorRange,
  mirrorY,
  PLANO,
  slabShift,
  snell,
  type P2,
} from "./fisica.ts";

export * from "./fisica.ts";

export const REFLEXAO = 0;
export const REFRACAO = 1;
export const SALVA = 2;
export const LAMINA = 3;

export interface FermatState {
  A: P2;
  B: P2;
  /** Abscissa do ponto de incidência P. */
  xP: number;
  /** Ângulo de incidência na lâmina (graus). */
  th1: number;
  drag: null | "A" | "B" | "P" | "lamina";
  /** Relógio da "corrida" entre o caminho escolhido e o de Fermat (s de tela). */
  clock: number;
}

const D = Math.PI / 180;
const modo = (p: Params) => Math.round(num(p, "modo"));
const shapeOf = (p: Params) => (modo(p) === REFLEXAO ? Math.round(num(p, "espelho")) : PLANO);
const fmt = (v: number, k = 2) => (Number.isFinite(v) ? v.toFixed(k).replace(".", ",").replace("-", "−") : "—");
/** Duração na tela da corrida do caminho de Fermat (s). */
const RACE = 4;

/** Metros por unidade do palco: 1 m para a luz, 10 m na praia. */
const unitOf = (p: Params) => (modo(p) === SALVA ? 10 : 1);
export const timeUnit = (p: Params) => (modo(p) === SALVA ? "s" : "ns");

/** Custos por unidade do palco (tempo por unidade de comprimento) acima e abaixo da interface. */
export function weights(p: Params): [number, number] {
  const m = modo(p);
  if (m === SALVA) return [10 / num(p, "v1", 7), 10 / num(p, "v2", 1.5)];
  const k = 1e9 / C_LIGHT;
  if (m === REFRACAO) return [k * num(p, "n1", 1), k * num(p, "n2", 1.5)];
  return [k * num(p, "n1", 1), k * num(p, "n1", 1)];
}

/** Pontos A e B efetivos (nos espelhos curvos, ficam nos focos). */
export function endpoints(s: FermatState, p: Params): [P2, P2] {
  return modo(p) === REFLEXAO && shapeOf(p) !== PLANO ? [FOCO_A, FOCO_B] : [s.A, s.B];
}

export const pointAt = (p: Params, x: number): P2 => [x, mirrorY(shapeOf(p), x)];
export const xRange = (p: Params): [number, number] => mirrorRange(shapeOf(p));

/** Tempo de percurso A → P(x) → B, em ns (luz) ou s (salva-vidas). */
export function travelTime(s: FermatState, p: Params, x: number): number {
  const [A, B] = endpoints(s, p);
  const [w1, w2] = weights(p);
  return cost(A, pointAt(p, x), B, w1, w2);
}

/** Ponto estacionário que a luz escolhe (mínimo no plano e na refração; vértice nos espelhos curvos). */
export function fermatX(s: FermatState, p: Params): number {
  if (modo(p) === REFLEXAO && shapeOf(p) !== PLANO) return 0;
  const [a, b] = xRange(p);
  return goldenMin((x) => travelTime(s, p, x), a, b);
}

/** Ângulos de incidência e de reflexão/refração (graus, em relação à normal) no ponto escolhido. */
export function anglesOf(s: FermatState, p: Params, x = s.xP): { th1: number; th2: number } {
  const [A, B] = endpoints(s, p);
  return anglesAt(A, pointAt(p, x), B, mirrorNormal(shapeOf(p), x));
}

/** Derivada dt/dx (ns/m ou s por 10 m): zero no caminho de Fermat. */
export const slope = (s: FermatState, p: Params) => (travelTime(s, p, s.xP + 1e-5) - travelTime(s, p, s.xP - 1e-5)) / 2e-5;

/** Lâmina: deslocamento lateral em mm. */
export const shiftMM = (s: FermatState, p: Params) => slabShift(num(p, "e", 20), num(p, "nl", 1.5), s.th1);

// ------------------------------------------------------------------ desenho
const G = { x0: 7.0, x1: 14.0, y0: -4.0, y1: 3.2 };

function arcAt(d: Draw, P: P2, from: number, to: number, r: number, color: string) {
  const pts: [number, number][] = [];
  for (let i = 0; i <= 24; i++) {
    const a = from + ((to - from) * i) / 24;
    pts.push([P[0] + r * Math.cos(a), P[1] + r * Math.sin(a)]);
  }
  d.polyline(pts, { color, width: 1.5 });
}

/** Posição de um viajante após um tempo T no caminho A → P → B. */
function travelerAt(A: P2, P: P2, B: P2, w1: number, w2: number, T: number): P2 {
  const l1 = Math.hypot(P[0] - A[0], P[1] - A[1]);
  const l2 = Math.hypot(B[0] - P[0], B[1] - P[1]);
  if (T <= w1 * l1) {
    const f = l1 > 0 ? T / (w1 * l1) : 1;
    return [A[0] + f * (P[0] - A[0]), A[1] + f * (P[1] - A[1])];
  }
  const f = Math.min(1, l2 > 0 ? (T - w1 * l1) / (w2 * l2) : 1);
  return [P[0] + f * (B[0] - P[0]), P[1] + f * (B[1] - P[1])];
}

function drawScene(d: Draw, s: FermatState, p: Params) {
  const th = d.theme;
  const m = modo(p);
  const shape = shapeOf(p);
  const [A, B] = endpoints(s, p);
  const [w1, w2] = weights(p);
  const [xa, xb] = xRange(p);
  // meios
  if (m === REFRACAO) {
    d.rect(-5.6, -5, 11.2, 5, { fill: th.dark ? "rgba(90,160,230,0.16)" : "rgba(60,130,210,0.12)" });
    d.text(`n₁ = ${fmt(num(p, "n1", 1), 2)}`, -5.3, 4.6, { color: th.muted, size: 12, align: "left" });
    d.text(`n₂ = ${fmt(num(p, "n2", 1.5), 2)}`, -5.3, -4.6, { color: th.muted, size: 12, align: "left" });
    d.line(-5.6, 0, 5.6, 0, { color: th.text, width: 1.5 });
  } else if (m === SALVA) {
    d.rect(-5.6, 0, 11.2, 5, { fill: th.dark ? "rgba(220,190,110,0.18)" : "rgba(230,200,120,0.3)" });
    d.rect(-5.6, -5, 11.2, 5, { fill: th.dark ? "rgba(70,140,220,0.25)" : "rgba(70,140,220,0.2)" });
    d.text(`areia: corre a ${fmt(num(p, "v1", 7), 1)} m/s`, -5.3, 4.6, { color: th.muted, size: 12, align: "left" });
    d.text(`mar: nada a ${fmt(num(p, "v2", 1.5), 1)} m/s`, -5.3, -4.6, { color: th.muted, size: 12, align: "left" });
    d.line(-5.6, 0, 5.6, 0, { color: th.text, width: 1.5 });
    for (let x = -5; x <= 5; x++) d.line(x, 0, x, -0.15, { color: th.muted, width: 1 });
    d.text("escala: 1 quadrado = 10 m", 5.4, 4.6, { color: th.muted, size: 10, align: "right" });
  } else {
    const pts: [number, number][] = [];
    for (let i = 0; i <= 120; i++) {
      const x = xa + ((xb - xa) * i) / 120;
      pts.push([x, mirrorY(shape, x)]);
    }
    d.polyline(pts, { color: th.text, width: 3 });
    for (let i = 0; i <= 40; i++) {
      const x = xa + ((xb - xa) * i) / 40;
      const y = mirrorY(shape, x);
      const nn = mirrorNormal(shape, x);
      d.line(x, y, x - 0.22 * nn[0] - 0.12 * nn[1], y - 0.22 * nn[1] + 0.12 * nn[0], { color: th.muted, width: 1 });
    }
    if (shape === ELIPSE) {
      // a elipse inteira, tracejada, para mostrar os focos
      const e: [number, number][] = [];
      for (let i = 0; i <= 80; i++) {
        const a = Math.PI - 0.24 + ((Math.PI + 0.48) * i) / 80;
        e.push([5 * Math.cos(a), 4 + 4 * Math.sin(a)]);
      }
      d.polyline(e, { color: th.grid, width: 1, dash: [4, 4] });
    }
  }
  const P = pointAt(p, s.xP);
  const xo = fermatX(s, p);
  const Po = pointAt(p, xo);
  // caminho de Fermat (tracejado) e caminho escolhido
  d.polyline([A, Po, B], { color: th.series[2]!, width: 1.5, dash: [6, 4] });
  d.polyline([A, P, B], { color: th.accent, width: 2.5 });
  d.arrow(A[0], A[1], (P[0] - A[0]) * 0.55, (P[1] - A[1]) * 0.55, { color: th.accent, width: 2.5 });
  d.arrow(P[0], P[1], (B[0] - P[0]) * 0.55, (B[1] - P[1]) * 0.55, { color: th.accent, width: 2.5 });
  // normal e ângulos
  const nn = mirrorNormal(shape, s.xP);
  const below = m === REFLEXAO ? 0 : 1.6;
  d.line(P[0] - below * nn[0], P[1] - below * nn[1], P[0] + 1.6 * nn[0], P[1] + 1.6 * nn[1], { color: th.muted, width: 1, dash: [4, 3] });
  const ang = anglesOf(s, p);
  const nAng = Math.atan2(nn[1], nn[0]);
  const aIn = Math.atan2(A[1] - P[1], A[0] - P[0]);
  arcAt(d, P, Math.min(nAng, aIn), Math.max(nAng, aIn), 0.75, th.positive);
  if (m === REFLEXAO) {
    const aOut = Math.atan2(B[1] - P[1], B[0] - P[0]);
    arcAt(d, P, Math.min(nAng, aOut), Math.max(nAng, aOut), 0.95, th.negative);
  } else {
    const aOut = Math.atan2(B[1] - P[1], B[0] - P[0]);
    const down = nAng - Math.PI;
    arcAt(d, P, Math.min(down, aOut), Math.max(down, aOut), 0.75, th.negative);
  }
  // corrida
  const tChosen = travelTime(s, p, s.xP);
  const tOpt = travelTime(s, p, xo);
  const T = (s.clock / RACE) * tOpt;
  const q1 = travelerAt(A, P, B, w1, w2, T);
  const q2 = travelerAt(A, Po, B, w1, w2, T);
  d.dot(q2[0], q2[1], 6, th.series[2]!);
  d.dot(q1[0], q1[1], 6, th.accent);
  // pontos
  const dragA = !(m === REFLEXAO && shape !== PLANO);
  const lbl = m === SALVA ? ["salva-vidas", "banhista"] : m === REFLEXAO ? ["A (fonte)", "B (olho)"] : ["A (fonte)", "B (olho)"];
  d.circle(A[0], A[1], 0, { minPx: 8, fill: th.positive, stroke: th.text, width: 1 });
  d.circle(B[0], B[1], 0, { minPx: 8, fill: th.negative, stroke: th.text, width: 1 });
  d.text(lbl[0]!, A[0], A[1] + 0.45, { size: 11, weight: "600" });
  d.text(lbl[1]!, B[0], B[1] + (B[1] < 0 ? -0.45 : 0.45), { size: 11, weight: "600" });
  d.circle(P[0], P[1], 0, { minPx: 7, fill: th.accent, stroke: th.text, width: 1.5 });
  d.text("P (arraste)", P[0], P[1] - 0.45, { color: th.accent, size: 11, weight: "600" });
  // legenda
  const u = timeUnit(p);
  const y0 = 4.65;
  d.text(`seu caminho: ${fmt(tChosen, m === SALVA ? 2 : 3)} ${u}   ·   Fermat: ${fmt(tOpt, m === SALVA ? 2 : 3)} ${u}`, 7.0, y0, { size: 12, weight: "600", align: "left" });
  const s1 = Math.sin(ang.th1 * D);
  const s2 = Math.sin(ang.th2 * D);
  let line2 = `θ₁ = ${fmt(ang.th1, 1)}°   θ₂ = ${fmt(ang.th2, 1)}°`;
  if (m === REFRACAO) line2 += `   n₁ sen θ₁ = ${fmt(num(p, "n1", 1) * s1, 3)}   n₂ sen θ₂ = ${fmt(num(p, "n2", 1.5) * s2, 3)}`;
  if (m === SALVA) line2 += `   sen θ₁/v₁ = ${fmt(s1 / num(p, "v1", 7), 4)}   sen θ₂/v₂ = ${fmt(s2 / num(p, "v2", 1.5), 4)} s/m`;
  d.text(line2, 7.0, y0 - 0.5, { size: 11, align: "left" });
  if (!dragA) d.text(shape === ELIPSE ? "elipse com focos em A e B: todo caminho leva o mesmo tempo" : "círculo mais curvo que a elipse: o caminho da luz é um MÁXIMO", 0, -4.7, { color: th.muted, size: 11 });
  d.text("arraste A, B e P · pontos: corrida entre o seu caminho (azul) e o de Fermat (verde)", (G.x0 + G.x1) / 2, -4.85, { color: th.muted, size: 10 });
}

function drawGraph(d: Draw, s: FermatState, p: Params) {
  const th = d.theme;
  const { x0, x1, y0, y1 } = G;
  const [xa, xb] = xRange(p);
  const N = 200;
  const ts: number[] = [];
  for (let i = 0; i <= N; i++) ts.push(travelTime(s, p, xa + ((xb - xa) * i) / N));
  let lo = Math.min(...ts);
  let hi = Math.max(...ts);
  if (hi - lo < 1e-6 * Math.max(1, hi)) {
    lo -= 0.05 * hi;
    hi += 0.05 * hi;
  }
  const pad = 0.08 * (hi - lo);
  lo -= pad;
  hi += pad;
  const gx = (x: number) => x0 + ((x1 - x0) * (x - xa)) / (xb - xa);
  const gy = (t: number) => y0 + ((y1 - y0) * (t - lo)) / (hi - lo);
  d.rect(x0, y0, x1 - x0, y1 - y0, { fill: th.dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)", stroke: th.grid, width: 1 });
  d.polyline(ts.map((t, i) => [gx(xa + ((xb - xa) * i) / N), gy(t)] as [number, number]), { color: th.text, width: 2 });
  const xo = fermatX(s, p);
  d.line(gx(xo), y0, gx(xo), y1, { color: th.series[2]!, width: 1.2, dash: [5, 4] });
  d.text("Fermat", gx(xo), y1 + 0.25, { color: th.series[2]!, size: 10 });
  const t = travelTime(s, p, s.xP);
  d.dot(gx(s.xP), gy(t), 6, th.accent);
  // tangente: inclinação dt/dx
  const k = slope(s, p);
  const dx = 0.8;
  d.line(gx(s.xP - dx), gy(t - k * dx), gx(s.xP + dx), gy(t + k * dx), { color: th.accent, width: 1.2, alpha: 0.7 });
  d.text("posição de P (x)", (x0 + x1) / 2, y0 - 0.35, { color: th.muted, size: 10 });
  d.text(`tempo (${timeUnit(p)})`, x0, y1 + 0.25, { color: th.muted, size: 10, align: "left" });
  d.text(fmt(hi - pad, 2), x0 - 0.1, gy(hi - pad), { color: th.muted, size: 9, align: "right" });
  d.text(fmt(lo + pad, 2), x0 - 0.1, gy(lo + pad), { color: th.muted, size: 9, align: "right" });
  d.text(`dt/dx = ${fmt(k, 4)}`, x1 - 0.1, y0 + 0.35, { color: th.accent, size: 10, align: "right" });
}

// --- lâmina de faces paralelas (unidades: cm)
const SLAB_W = 7;
const SCREEN_X = 8.5;
/** Ponto de entrada do laser na lâmina, que também é o eixo de giro da mesa. */
const ENTRY_X = -2.5;
const GL = { x0: 9.8, x1: 14.6, y0: -5.3, y1: -1.2 };

function slabGeometry(s: FermatState, p: Params) {
  const e = num(p, "e", 20) / 10;
  const n = num(p, "nl", 1.5);
  const t1 = s.th1 * D;
  const t2 = snell(s.th1, 1, n) * D;
  const nh: P2 = [Math.cos(t1), Math.sin(t1)];
  const entry: P2 = [ENTRY_X, 0];
  const L = e / Math.cos(t2);
  const dir: P2 = [Math.cos(t1 - t2), Math.sin(t1 - t2)];
  const exit: P2 = [entry[0] + L * dir[0], entry[1] + L * dir[1]];
  const center: P2 = [(entry[0] + exit[0]) / 2, (entry[1] + exit[1]) / 2];
  const tg: P2 = [-Math.sin(t1), Math.cos(t1)];
  const handle: P2 = [center[0] + (SLAB_W / 2 - 0.3) * tg[0], center[1] + (SLAB_W / 2 - 0.3) * tg[1]];
  return { e, n, t1, t2, nh, entry, exit, center, handle };
}

function drawSlab(d: Draw, s: FermatState, p: Params, trail: FermatState[]) {
  const th = d.theme;
  const g = slabGeometry(s, p);
  const red = "#e0322c";
  // trilho e laser
  d.rect(-6.8, -0.35, 1.6, 0.7, { fill: th.dark ? "#2c3442" : "#3a4352", stroke: th.text, width: 1 });
  d.text("laser", -6.0, 0.65, { color: th.muted, size: 10 });
  // lâmina
  d.box(g.center[0], g.center[1], g.e, SLAB_W, g.t1, { fill: th.dark ? "rgba(140,200,230,0.35)" : "rgba(90,160,200,0.3)", stroke: th.text, width: 1.5 });
  const [hx, hy] = g.handle;
  d.dot(ENTRY_X, 0, 3, th.text);
  d.circle(hx, hy, 0, { minPx: 7, fill: th.accent, stroke: th.text, width: 1 });
  d.text("gire", hx + 0.5, hy + 0.3, { color: th.accent, size: 10 });
  // normal na entrada
  d.line(g.entry[0] - 1.5 * g.nh[0], g.entry[1] - 1.5 * g.nh[1], g.entry[0] + 1.2 * g.nh[0], g.entry[1] + 1.2 * g.nh[1], { color: th.muted, width: 1, dash: [4, 3] });
  // feixes
  d.line(-5.2, 0, g.entry[0], 0, { color: red, width: 2.5 });
  d.line(g.entry[0], 0, g.exit[0], g.exit[1], { color: red, width: 2.5 });
  d.line(g.exit[0], g.exit[1], SCREEN_X, g.exit[1], { color: red, width: 2.5 });
  d.line(g.entry[0], 0, SCREEN_X, 0, { color: th.muted, width: 1, dash: [5, 4] });
  // reflexão parcial na primeira face (Fresnel)
  const R = fresnelR(s.th1, g.n);
  const i: P2 = [1, 0];
  const k = 2 * (i[0] * g.nh[0] + i[1] * g.nh[1]);
  const r: P2 = [i[0] - k * g.nh[0], i[1] - k * g.nh[1]];
  d.line(g.entry[0], 0, g.entry[0] + 3 * r[0], 3 * r[1], { color: red, width: 1.5, alpha: Math.min(1, 0.25 + 3 * R), dash: [3, 3] });
  d.text(`R = ${fmt(100 * R, 1)}%`, g.entry[0] + 3.2 * r[0], 3.2 * r[1], { color: th.muted, size: 10 });
  // anteparo com régua milimetrada
  d.rect(SCREEN_X, -5.5, 0.25, 11, { fill: th.dark ? "#3a4048" : "#d9dde3", stroke: th.text, width: 1 });
  for (let mm = -50; mm <= 50; mm++) {
    const y = mm / 10;
    const big = mm % 10 === 0;
    d.line(SCREEN_X, y, SCREEN_X - (big ? 0.35 : mm % 5 === 0 ? 0.25 : 0.15), y, { color: th.text, width: big ? 1.2 : 0.6 });
    if (big) d.text(`${mm}`, SCREEN_X - 0.6, y, { color: th.muted, size: 9 });
  }
  d.dot(SCREEN_X, g.exit[1], 5, red);
  d.text("anteparo (mm)", SCREEN_X, 5.75, { color: th.muted, size: 10 });
  // cota do deslocamento
  const xd = SCREEN_X - 1.6;
  if (Math.abs(g.exit[1]) > 0.05) {
    d.arrow(xd, 0, 0, g.exit[1], { color: th.accent, width: 1.5, head: 6 });
    d.arrow(xd, g.exit[1], 0, -g.exit[1], { color: th.accent, width: 1.5, head: 6 });
  }
  d.text(`d = ${fmt(10 * g.exit[1], 2)} mm`, xd - 0.2, g.exit[1] / 2 + 0.35, { color: th.accent, size: 12, weight: "600", align: "right" });
  d.text(`θ₁ = ${fmt(s.th1, 1)}°   θ₂ = ${fmt(g.t2 / D, 1)}°   e = ${fmt(10 * g.e, 1)} mm   n = ${fmt(g.n, 2)}`, -6.8, 5.6, { size: 12, weight: "600", align: "left" });
  d.text("vista de cima · arraste a alça para girar a lâmina", -6.8, -5.7, { color: th.muted, size: 10, align: "left" });
  // gráfico d × θ₁
  const { x0, x1, y0, y1 } = GL;
  const dmax = 10 * slabShift(g.e, g.n, 80) * 1.1;
  const gx = (a: number) => x0 + ((x1 - x0) * a) / 80;
  const gy = (dd: number) => y0 + ((y1 - y0) * dd) / dmax;
  d.line(x0, y0, x1, y0, { color: th.muted, width: 1 });
  d.line(x0, y0, x0, y1, { color: th.muted, width: 1 });
  d.plot((x) => gy(10 * slabShift(g.e, g.n, ((x - x0) / (x1 - x0)) * 80)), x0, x1, { color: th.muted, dash: [5, 4] });
  for (const q of trail) d.dot(gx(Math.abs(q.th1)), gy(Math.abs(shiftMM(q, p))), 2.5, th.series[0]!, 0.8);
  d.dot(gx(Math.abs(s.th1)), gy(Math.abs(shiftMM(s, p))), 5, th.accent);
  d.text("|θ₁| (0–80°)", (x0 + x1) / 2, y0 - 0.3, { color: th.muted, size: 10 });
  d.text(`d (mm), máx. ${fmt(dmax / 1.1, 1)}`, x0, y1 + 0.3, { color: th.muted, size: 10, align: "left" });
}

// ------------------------------------------------------------------ interação
const near = (a: P2, pt: { x: number; y: number }, r: number) => Math.hypot(a[0] - pt.x, a[1] - pt.y) < r;
const clampX = (p: Params, x: number) => {
  const [a, b] = xRange(p);
  return Math.max(a, Math.min(b, x));
};
const restart = (s: FermatState): FermatState => ({ ...s, clock: 0 });

function defaults(m: number): Pick<FermatState, "A" | "B"> {
  if (m === REFRACAO) return { A: [-3, 3], B: [3, -3] };
  if (m === SALVA) return { A: [-3.5, 3], B: [3, -2.5] };
  return { A: [-3, 3], B: [3, 2] };
}

export const principioFermat = defineSim<FermatState>({
  id: "principio-fermat",
  title: "Princípio de Fermat e lâmina de faces paralelas",
  course: "FG IV",
  topic: "Ótica",
  priority: "P2",
  summary:
    "Arraste o ponto de incidência e veja o tempo de percurso em função da posição: o mínimo coincide com a lei da reflexão e com a de Snell. Inclui espelhos curvos (tempo estacionário ou máximo), o problema do salva-vidas e a lâmina de faces paralelas com deslocamento lateral medido num anteparo.",
  equations: [
    String.raw`t(x) = \frac{n_1\,\overline{AP} + n_2\,\overline{PB}}{c}, \qquad \frac{dt}{dx} = 0 \ \Rightarrow\ n_1 \,\text{sen}\,\theta_1 = n_2\, \text{sen}\,\theta_2`,
    String.raw`\text{reflexão: } n_1 = n_2 \ \Rightarrow\ \theta_r = \theta_i \qquad \text{salva-vidas: } \frac{\text{sen}\,\theta_1}{v_1} = \frac{\text{sen}\,\theta_2}{v_2}`,
    String.raw`d = e\,\frac{\text{sen}(\theta_1 - \theta_2)}{\cos\theta_2} \qquad (\text{lâmina de faces paralelas})`,
  ],
  liveEquations(s, p) {
    const m = modo(p);
    if (m === LAMINA) {
      const n = num(p, "nl", 1.5);
      const t2 = snell(s.th1, 1, n);
      return [
        String.raw`\text{sen}\,\theta_2 = \frac{\text{sen}\,${texNum(s.th1)}^\circ}{${texNum(n)}} \Rightarrow \theta_2 = ${texNum(t2, 4)}^\circ`,
        String.raw`d = ${texNum(num(p, "e", 20))}\,\text{mm}\cdot\frac{\text{sen}(${texNum(s.th1 - t2, 4)}^\circ)}{\cos ${texNum(t2, 4)}^\circ} = ${texNum(shiftMM(s, p), 4)}\ \text{mm}`,
      ];
    }
    const a = anglesOf(s, p);
    const u = timeUnit(p);
    const out = [String.raw`t(x_P = ${texNum(s.xP)}) = ${texNum(travelTime(s, p, s.xP), 5)}\ \text{${u}} \qquad t_{\text{Fermat}} = ${texNum(travelTime(s, p, fermatX(s, p)), 5)}\ \text{${u}} \qquad \frac{dt}{dx} = ${texNum(slope(s, p), 3)}`];
    if (m === REFRACAO)
      out.push(String.raw`n_1\,\text{sen}\,\theta_1 = ${texNum(num(p, "n1", 1) * Math.sin(a.th1 * D), 4)} \qquad n_2\,\text{sen}\,\theta_2 = ${texNum(num(p, "n2", 1.5) * Math.sin(a.th2 * D), 4)}`);
    else if (m === SALVA)
      out.push(String.raw`\frac{\text{sen}\,\theta_1}{v_1} = ${texNum(Math.sin(a.th1 * D) / num(p, "v1", 7), 4)}\ \text{s/m} \qquad \frac{\text{sen}\,\theta_2}{v_2} = ${texNum(Math.sin(a.th2 * D) / num(p, "v2", 1.5), 4)}\ \text{s/m}`);
    else out.push(String.raw`\theta_i = ${texNum(a.th1, 4)}^\circ \qquad \theta_r = ${texNum(a.th2, 4)}^\circ`);
    return out;
  },

  params: [
    {
      key: "modo",
      label: "Situação",
      unit: "",
      min: 0,
      max: 3,
      step: 1,
      default: 0,
      options: [
        { value: REFLEXAO, label: "Reflexão num espelho" },
        { value: REFRACAO, label: "Refração entre dois meios" },
        { value: SALVA, label: "Problema do salva-vidas" },
        { value: LAMINA, label: "Lâmina de faces paralelas" },
      ],
    },
    {
      key: "espelho",
      label: "Forma do espelho",
      unit: "",
      min: 0,
      max: 2,
      step: 1,
      default: 0,
      options: [
        { value: PLANO, label: "Plano (tempo mínimo)" },
        { value: ELIPSE, label: "Elíptico, focos em A e B (tempo constante)" },
        { value: CIRCULO, label: "Côncavo mais curvo (tempo máximo)" },
      ],
    },
    { key: "n1", label: "Índice do meio de cima n₁", unit: "", min: 1, max: 2.5, step: 0.01, default: 1, live: true },
    { key: "n2", label: "Índice do meio de baixo n₂", unit: "", min: 1, max: 2.5, step: 0.01, default: 1.5, live: true },
    { key: "v1", label: "Velocidade na areia v₁", unit: "m/s", min: 1, max: 10, step: 0.1, default: 7, live: true },
    { key: "v2", label: "Velocidade nadando v₂", unit: "m/s", min: 0.5, max: 5, step: 0.1, default: 1.5, live: true },
    { key: "x0", label: "Posição inicial de P", unit: "", min: -4, max: 4, step: 0.1, default: -1.5 },
    { key: "e", label: "Espessura da lâmina e", unit: "mm", min: 5, max: 40, step: 1, default: 20, live: true },
    { key: "nl", label: "Índice da lâmina n", unit: "", min: 1.3, max: 2.4, step: 0.01, default: 1.5, live: true },
    { key: "theta1", label: "Ângulo de incidência inicial na lâmina", unit: "°", min: -80, max: 80, step: 1, default: 40 },
  ],

  observables: [
    { key: "xP", label: "Posição de P", unit: "m (luz) · 10 m (praia)", value: (s) => s.xP },
    { key: "t", label: "Tempo de percurso", unit: "ns (luz) · s (praia)", value: (s, p) => (modo(p) === LAMINA ? 0 : travelTime(s, p, s.xP)) },
    { key: "tF", label: "Tempo no caminho de Fermat", unit: "ns (luz) · s (praia)", value: (s, p) => (modo(p) === LAMINA ? 0 : travelTime(s, p, fermatX(s, p))) },
    { key: "th1", label: "Ângulo de incidência θ₁", unit: "°", value: (s, p) => (modo(p) === LAMINA ? s.th1 : anglesOf(s, p).th1) },
    { key: "th2", label: "Ângulo de reflexão/refração θ₂", unit: "°", value: (s, p) => (modo(p) === LAMINA ? snell(s.th1, 1, num(p, "nl", 1.5)) : anglesOf(s, p).th2) },
    { key: "dtdx", label: "Inclinação dt/dx", unit: "", value: (s, p) => (modo(p) === LAMINA ? 0 : slope(s, p)) },
    { key: "d", label: "Deslocamento lateral d", unit: "mm", value: (s, p) => shiftMM(s, p) },
    { key: "yTela", label: "Posição do ponto no anteparo", unit: "mm", value: (s, p) => shiftMM(s, p) },
  ],
  chart: { x: "xP", y: "t" },

  scenarios: [
    {
      id: "reflexao",
      label: "Reflexão: o caminho mais rápido",
      params: { modo: REFLEXAO, espelho: PLANO, n1: 1, x0: -2 },
      guide: `### Reflexão pelo princípio de Fermat
1. A luz sai de A, toca o espelho em P e chega ao olho em B. Arraste P e acompanhe o tempo no gráfico.
2. Leve P ao fundo do vale da curva $t(x)$. Compare $\\theta_i$ e $\\theta_r$: são iguais.
3. Mova A ou B: o mínimo se desloca, mas continua valendo $\\theta_i = \\theta_r$.
4. Observe a reta tangente: no mínimo, $dt/dx = 0$. Vizinhos do caminho de Fermat levam *quase* o mesmo tempo.
5. Troque para o **espelho elíptico** e depois o **côncavo mais curvo**. A luz ainda segue $\\theta_i = \\theta_r$, mas o tempo é constante ou máximo: o princípio pede tempo **estacionário**.`,
      predict: [
        {
          question: "No espelho elíptico, com A e B nos focos, como é o gráfico do tempo t(x)?",
          options: ["um vale com mínimo", "um pico com máximo", "uma reta horizontal", "uma reta inclinada"],
          answer: 2,
          explanation: "Na elipse, a soma das distâncias aos focos é a mesma para todo ponto: $\\overline{AP} + \\overline{PB} = 2a$. Todo P dá o mesmo tempo, e qualquer raio que sai de um foco chega ao outro.",
        },
      ],
    },
    {
      id: "refracao",
      label: "Refração: a lei de Snell",
      params: { modo: REFRACAO, n1: 1, n2: 1.5, x0: 1.5 },
      guide: `### De Fermat a Snell
1. A está no ar ($n_1$) e B no vidro ($n_2$). A luz é mais lenta no vidro ($v = c/n$).
2. O caminho reto (P sob a reta AB) é o mais *curto*, mas não o mais *rápido*. Arraste P até o mínimo do tempo.
3. No mínimo, compare $n_1\\,\\text{sen}\\,\\theta_1$ e $n_2\\,\\text{sen}\\,\\theta_2$.
4. Aumente $n_2$: o ponto de Fermat anda para encurtar o trecho no meio lento.
5. Ponha $n_1 > n_2$ e A bem para o lado: existe sempre um caminho? Pense na reflexão total.`,
      predict: [
        {
          question: "Comparado ao segmento reto de A a B, o ponto P de Fermat fica:",
          options: ["exatamente sob a reta AB", "deslocado para o lado de B, encurtando o trecho no vidro", "deslocado para o lado de A", "no ponto mais próximo de A"],
          answer: 1,
          explanation: "Vale a pena andar mais no ar (rápido) para andar menos no vidro (lento): o raio entra mais perto da vertical de B, e assim $\\theta_2 < \\theta_1$.",
        },
      ],
    },
    {
      id: "salva-vidas",
      label: "Problema do salva-vidas",
      params: { modo: SALVA, v1: 7, v2: 1.5, x0: 3 },
      guide: `### Correr na areia ou nadar?
1. O salva-vidas corre a $v_1$ na areia e nada a $v_2$ no mar. Onde ele deve entrar na água?
2. Ponha P bem em frente ao banhista e veja a corrida: o ponto azul (você) contra o verde (Fermat).
3. Arraste P até o mínimo e verifique $\\dfrac{\\text{sen}\\,\\theta_1}{v_1} = \\dfrac{\\text{sen}\\,\\theta_2}{v_2}$: a mesma lei de Snell, com $n \\propto 1/v$.
4. Quantos segundos se ganham em relação ao caminho reto? E em relação a correr até a frente do banhista?`,
      predict: [
        {
          question: "Correndo 7 m/s e nadando 1,5 m/s, o ponto ótimo de entrada fica:",
          options: ["na reta entre os dois", "bem perto da frente do banhista", "bem perto do salva-vidas", "tanto faz"],
          answer: 1,
          explanation: "Nadar é quase 5 vezes mais lento: compensa correr quase até a frente do banhista e nadar quase perpendicular à praia ($\\text{sen}\\,\\theta_2 = (v_2/v_1)\\,\\text{sen}\\,\\theta_1$ é pequeno).",
        },
      ],
    },
    {
      id: "lamina",
      label: "Lâmina de faces paralelas",
      params: { modo: LAMINA, e: 20, nl: 1.5, theta1: 0 },
      guide: `### Medindo o deslocamento lateral
1. Com a lâmina perpendicular ao laser ($\\theta_1 = 0$), o ponto no anteparo fica no zero.
2. Gire a lâmina pela alça, de 10° em 10°, e leia a posição do ponto na régua milimetrada.
3. Compare com $d = e\\,\\text{sen}(\\theta_1-\\theta_2)/\\cos\\theta_2$ e com a curva tracejada.
4. O feixe que sai é **paralelo** ao que entra: por quê? (Snell duas vezes, com as faces paralelas.)
5. Com $d$ medido em vários ângulos, ajuste $n$ da lâmina. A reflexão parcial (R) cresce em ângulos rasantes.`,
      predict: [
        {
          question: "Dobrando a espessura da lâmina, no mesmo ângulo, o deslocamento d:",
          options: ["não muda", "dobra", "quadruplica", "cai à metade"],
          answer: 1,
          explanation: "Os ângulos dependem só de $n$ e de $\\theta_1$; o trecho dentro do vidro cresce com $e$, e $d$ é proporcional a $e$.",
        },
      ],
    },
  ],

  exercises: [
    {
      id: "lamina",
      prompt: "Um laser incide a {theta1}° numa lâmina de vidro de faces paralelas com {e} mm de espessura e índice {nl}. Qual o deslocamento lateral do feixe, em mm?",
      vary: { theta1: [15, 70, 0], e: [5, 40, 0], nl: [1.4, 1.9, 2] },
      fixed: { modo: LAMINA },
      answer: { label: "d", unit: "mm", compute: (p) => slabShift(num(p, "e"), num(p, "nl"), num(p, "theta1")) },
      hint: "Ache θ₂ por Snell e use d = e sen(θ₁ − θ₂)/cos θ₂.",
    },
    {
      id: "salva-vidas",
      prompt:
        "Um salva-vidas está a 30 m da linha d'água; o banhista está 25 m mar adentro e 65 m ao longo da praia. Ele corre a {v1} m/s e nada a {v2} m/s. Quanto tempo leva pelo caminho mais rápido (em s)?",
      vary: { v1: [5, 8, 1], v2: [1, 2, 1] },
      fixed: { modo: SALVA },
      answer: {
        label: "t",
        unit: "s",
        compute: (p) => {
          const st: FermatState = { A: [-3.5, 3], B: [3, -2.5], xP: 0, th1: 0, drag: null, clock: 0 };
          return travelTime(st, p, fermatX(st, p));
        },
      },
      tolerance: 0.02,
      hint: "Escreva t(x) = √(30² + x²)/v₁ + √(25² + (65 − x)²)/v₂ e ache o mínimo (dt/dx = 0 é a lei de Snell com n ∝ 1/v).",
    },
    {
      id: "snell",
      prompt: "Pelo princípio de Fermat, a luz que vem do ar (n = 1) e entra num meio de índice {n2} com ângulo de incidência de {th}° sai com que ângulo de refração (em graus)?",
      vary: { n2: [1.2, 2.4, 2], th: [10, 80, 0] },
      fixed: { modo: REFRACAO, n1: 1 },
      answer: { label: "θ₂", unit: "°", compute: (p) => snell(num(p, "th"), 1, num(p, "n2")) },
    },
  ],

  init: (p) => ({ ...defaults(modo(p)), xP: num(p, "x0", -1.5), th1: num(p, "theta1", 40), drag: null, clock: 0 }),
  step: (s, p, _t, dt) => {
    if (modo(p) === LAMINA) return s;
    const tC = travelTime(s, p, s.xP);
    const tO = travelTime(s, p, fermatX(s, p));
    const end = RACE * Math.max(1, tC / tO) + 1.5;
    return s.clock >= end ? s : { ...s, clock: s.clock + dt };
  },
  dt: 1 / 60,
  sampleEvery: 30,

  pointer: {
    down(s, p, pt) {
      const m = modo(p);
      if (m === LAMINA) {
        const g = slabGeometry(s, p);
        return near(g.handle, pt, 1) || near([2 * g.center[0] - g.handle[0], 2 * g.center[1] - g.handle[1]], pt, 1) ? { ...s, drag: "lamina" } : undefined;
      }
      const free = !(m === REFLEXAO && shapeOf(p) !== PLANO);
      if (free && near(s.A, pt, 0.5)) return { ...s, drag: "A" };
      if (free && near(s.B, pt, 0.5)) return { ...s, drag: "B" };
      const P = pointAt(p, s.xP);
      if (near(P, pt, 0.6) || (Math.abs(pt.x) < 5.6 && Math.abs(pt.y - P[1]) < 0.6)) return restart({ ...s, drag: "P", xP: clampX(p, pt.x) });
      return undefined;
    },
    move(s, p, pt, dragging) {
      if (!dragging || !s.drag) return undefined;
      const m = modo(p);
      if (s.drag === "lamina") {
        // a alça fica a (e/2, W/2 − 0,3) do eixo de giro no referencial da lâmina
        const phi = Math.atan2(num(p, "e", 20) / 20, SLAB_W / 2 - 0.3);
        const a = ((Math.atan2(-(pt.x - ENTRY_X), pt.y) + phi) * 180) / Math.PI;
        const a2 = a > 90 ? a - 180 : a < -90 ? a + 180 : a;
        return { ...s, th1: Math.round(Math.max(-80, Math.min(80, a2)) * 10) / 10 };
      }
      if (s.drag === "P") return restart({ ...s, xP: Math.round(clampX(p, pt.x) * 1000) / 1000 });
      const x = Math.max(-5.3, Math.min(5.3, pt.x));
      const lo = m === REFLEXAO ? 0.3 : s.drag === "A" ? 0.3 : -4.5;
      const hi = m === REFLEXAO ? 4.5 : s.drag === "A" ? 4.5 : -0.3;
      const y = Math.max(lo, Math.min(hi, pt.y));
      return restart(s.drag === "A" ? { ...s, A: [x, y] } : { ...s, B: [x, y] });
    },
    up: (s) => (s.drag ? { ...s, drag: null } : undefined),
    cursor: (s, p, pt) => {
      if (modo(p) === LAMINA) {
        const g = slabGeometry(s, p);
        return near(g.handle, pt, 1) ? "grab" : undefined;
      }
      return near(s.A, pt, 0.5) || near(s.B, pt, 0.5) || near(pointAt(p, s.xP), pt, 0.6) ? "grab" : undefined;
    },
  },

  actions: [
    { id: "fermat", label: "Levar P ao ponto de Fermat", run: (s, p) => (modo(p) === LAMINA ? s : restart({ ...s, xP: fermatX(s, p) })) },
    { id: "corrida", label: "Repetir a corrida", run: (s) => restart(s) },
    { id: "menos", label: "θ₁ − 1°", run: (s) => ({ ...s, th1: Math.max(-80, s.th1 - 1) }) },
    { id: "mais", label: "θ₁ + 1°", run: (s) => ({ ...s, th1: Math.min(80, s.th1 + 1) }) },
  ],

  viewport: (p) => (modo(p) === LAMINA ? { xMin: -7, xMax: 15, yMin: -6, yMax: 6 } : { xMin: -5.8, xMax: 14.5, yMin: -5.2, yMax: 5.2 }),

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const { state: s, params: p } = frame;
    if (modo(p) === LAMINA) {
      drawSlab(d, s, p, frame.trail.slice(-300));
      return;
    }
    drawScene(d, s, p);
    drawGraph(d, s, p);
  },
});

export default principioFermat;
