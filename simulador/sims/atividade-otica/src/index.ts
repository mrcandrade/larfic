import { defineSim, draw, num, texNum, type Draw, type Params } from "@fisilab/core";
import {
  concentrationFrom,
  inversionConc,
  inversionFinal,
  inversionRotation,
  malus,
  rateConstant,
  rotation,
  specificRotation,
  SUGARS,
  SACAROSE,
  wrap180,
} from "./fisica.ts";

export * from "./fisica.ts";

export const MODO_CONC = 0;
export const MODO_DISP = 1;
export const MODO_INV = 2;

export interface AtivState {
  /** Ângulo do analisador (graus, 0–360). */
  th: number;
  /** Tempo de reação (s) no modo de inversão. */
  tr: number;
  drag: boolean;
}

const LAMPS = [
  { nm: 436, label: "Mercúrio azul 436 nm" },
  { nm: 546, label: "Mercúrio verde 546 nm" },
  { nm: 589, label: "Sódio D 589 nm" },
  { nm: 633, label: "He-Ne 633 nm" },
];

const modo = (p: Params) => Math.round(num(p, "modo"));
const sugarOf = (p: Params) => (modo(p) === MODO_INV ? SACAROSE : Math.round(num(p, "sol", 1)));
const nmOf = (p: Params) => num(p, "lambda", 589);
const wrap360 = (a: number) => ((a % 360) + 360) % 360;
const fmt = (v: number, k = 1) => v.toFixed(k).replace(".", ",").replace("-", "−");

/** Constante de velocidade da inversão nas condições escolhidas (s⁻¹). */
export const kOf = (p: Params) => rateConstant(num(p, "T", 25), num(p, "acid", 2));

/** Rotação produzida pela amostra (graus) no estado atual. */
export function alphaOf(s: AtivState, p: Params): number {
  const L = num(p, "L", 2);
  const c = num(p, "c", 20);
  if (modo(p) === MODO_INV) return inversionRotation(c, kOf(p), s.tr, nmOf(p), L);
  return rotation(sugarOf(p), nmOf(p), L, c);
}

/** Meio ângulo de penumbra (graus) — 0 no campo simples. */
const epsOf = (p: Params) => (Math.round(num(p, "campo")) === 1 ? num(p, "eps", 3) : 0);

/** Leituras do detector (mV): metades esquerda e direita do campo. */
export function readings(s: AtivState, p: Params): { esq: number; dir: number; media: number } {
  const a = alphaOf(s, p);
  const e = epsOf(p);
  const I0 = num(p, "I0", 1000);
  const bg = num(p, "amb", 5);
  const esq = I0 * malus(s.th, a + e) + bg;
  const dir = I0 * malus(s.th, a - e) + bg;
  return { esq, dir, media: (esq + dir) / 2 };
}

/** Rotação lida a partir da posição do analisador, supondo que ele está no escuro (θ = α + 90°). */
export const alphaRead = (s: AtivState) => wrap180(s.th - 90);

// ------------------------------------------------------------------ cores
function nmColor(nm: number): string {
  let r = 0;
  let g = 0;
  let b = 0;
  if (nm < 440) [r, g, b] = [(440 - nm) / 60, 0, 1];
  else if (nm < 490) [r, g, b] = [0, (nm - 440) / 50, 1];
  else if (nm < 510) [r, g, b] = [0, 1, (510 - nm) / 20];
  else if (nm < 580) [r, g, b] = [(nm - 510) / 70, 1, 0];
  else if (nm < 645) [r, g, b] = [1, (645 - nm) / 65, 0];
  else [r, g, b] = [1, 0, 0];
  const f = (v: number) => Math.round(255 * Math.max(0, Math.min(1, v)) ** 0.8);
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

// ------------------------------------------------------------------ layout
const VP = { xMin: 0, xMax: 20, yMin: -9.2, yMax: 6.6 };
const YB = 3.4;
const RAIL = 1.5;
const X = { lamp: 1.3, pol: 3.4, tube: 4.4, an: 14.4, det: 16.6 };
const tubeLen = (L: number) => 1 + 1.9 * L;
const DIAL = { x: 3.6, y: -4.6, r: 3.0 };
const FIELD = { x: 9.0, y: -3.0, r: 1.5 };
const METER = { x0: 6.9, x1: 11.1, y0: -7.6, y1: -5.9 };
const GRAPH = { x0: 13.0, x1: 19.5, y0: -7.6, y1: -1.0 };

function drawDisc(d: Draw, x: number, ang: number, label: string, sub: string, active: boolean) {
  const th = d.theme;
  d.rect(x - 0.07, RAIL + 0.25, 0.14, YB - 1 - RAIL - 0.25, { fill: th.muted, alpha: 0.8 });
  d.rect(x - 0.45, RAIL, 0.9, 0.28, { fill: th.muted, stroke: th.text, width: 1 });
  const pts: [number, number][] = [];
  for (let i = 0; i <= 40; i++) pts.push([x + 0.3 * Math.cos((i * Math.PI) / 20), YB + 1.0 * Math.sin((i * Math.PI) / 20)]);
  d.polyline(pts, { close: true, fill: th.dark ? "rgba(120,130,150,0.35)" : "rgba(80,90,110,0.25)", color: active ? th.accent : th.text, width: active ? 2.5 : 1.5 });
  const t = (ang * Math.PI) / 180;
  d.line(x - 0.28 * Math.sin(t), YB - 0.95 * Math.cos(t), x + 0.28 * Math.sin(t), YB + 0.95 * Math.cos(t), { color: th.accent, width: 2.2 });
  d.text(label, x, RAIL - 0.35, { size: 12, weight: "600" });
  d.text(sub, x, RAIL - 0.85, { color: th.muted, size: 11 });
}

function drawBench(d: Draw, s: AtivState, p: Params) {
  const th = d.theme;
  const nm = nmOf(p);
  const col = nmColor(nm);
  const L = num(p, "L", 2);
  const a = alphaOf(s, p);
  const len = tubeLen(L);
  const xEnd = X.tube + len;
  d.rect(0.3, RAIL - 0.12, 19.4, 0.12, { fill: th.muted, alpha: 0.6 });
  // lâmpada com filtro
  d.rect(X.lamp - 1.0, YB - 0.6, 1.7, 1.2, { fill: th.dark ? "#3a3530" : "#5a5248", stroke: th.text, width: 1 });
  d.circle(X.lamp - 0.3, YB, 0.35, { fill: col, alpha: 0.95 });
  d.rect(X.lamp + 0.7, YB - 0.45, 0.18, 0.9, { fill: col, alpha: 0.7 });
  d.text(`${nm} nm`, X.lamp - 0.15, YB + 0.95, { color: th.muted, size: 10 });
  d.rect(X.lamp - 0.08, RAIL + 0.25, 0.16, YB - 0.6 - RAIL - 0.25, { fill: th.muted });
  // feixe
  const beam = (x0: number, x1: number, I: number) => {
    if (I < 1e-4) return;
    const k = Math.sqrt(Math.min(1, I));
    d.line(x0, YB, x1, YB, { color: col, width: 1.5 + 5 * k, alpha: 0.15 + 0.5 * k });
  };
  beam(X.lamp + 0.9, X.pol, 1);
  beam(X.pol, X.an, 0.5);
  const T = readings(s, p);
  beam(X.an, X.det - 0.1, (0.5 * (T.media - num(p, "amb", 5))) / Math.max(1, num(p, "I0", 1000)));
  // tubo do polarímetro com a solução
  const sol = sugarOf(p);
  const conc = modo(p) === MODO_INV ? num(p, "c", 20) : sol === 0 ? 0 : num(p, "c", 20);
  const tint = th.dark ? `rgba(150,200,240,${0.15 + conc / 120})` : `rgba(90,150,210,${0.12 + conc / 140})`;
  d.rect(X.tube, YB - 0.55, len, 1.1, { fill: tint, stroke: th.text, width: 1.5 });
  d.rect(X.tube - 0.12, YB - 0.65, 0.12, 1.3, { fill: th.muted });
  d.rect(xEnd, YB - 0.65, 0.12, 1.3, { fill: th.muted });
  for (const xs of [X.tube + 0.4, xEnd - 0.4]) {
    d.rect(xs - 0.06, RAIL + 0.25, 0.12, YB - 0.55 - RAIL - 0.25, { fill: th.muted, alpha: 0.8 });
  }
  d.text(`tubo L = ${fmt(L, 1)} dm`, X.tube + len / 2, RAIL - 0.35, { size: 12, weight: "600" });
  d.text(modo(p) === MODO_INV ? "sacarose + HCl (invertendo)" : sol === 0 ? "água" : `${SUGARS[sol]!.label.split(" (")[0]} ${fmt(conc, 1)} g/100 mL`, X.tube + len / 2, RAIL - 0.85, { color: th.muted, size: 11 });
  // plano de polarização girando ao longo do tubo (vista "de frente" em perspectiva)
  const n = Math.max(3, Math.round(len / 0.75));
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    const x = X.tube + 0.15 + f * (len - 0.3);
    const ang = ((a * f) * Math.PI) / 180;
    const dx = 0.3 * Math.sin(ang);
    const dy = 0.85 * Math.cos(ang);
    d.line(x - dx, YB - dy, x + dx, YB + dy, { color: th.positive, width: 2, alpha: 0.85 });
  }
  d.text(`plano gira α = ${fmt(a, 2)}°`, X.tube + len / 2, YB + 1.35, { color: th.positive, size: 11, weight: "600" });
  drawDisc(d, X.pol, 0, "Polarizador", "0° (fixo)", false);
  drawDisc(d, X.an, s.th, "Analisador", `θ = ${fmt(s.th, 1)}°`, true);
  // detector/ocular
  d.rect(X.det - 0.1, YB - 0.5, 1.2, 1.0, { fill: th.dark ? "#2c3442" : "#3a4352", stroke: th.text, width: 1 });
  d.rect(X.det + 0.38, RAIL + 0.25, 0.14, YB - 0.5 - RAIL - 0.25, { fill: th.muted });
  d.text("fotodiodo", X.det + 0.5, RAIL - 0.35, { size: 12, weight: "600" });
  d.text("vista lateral · ângulos a partir da vertical, horário para quem olha a fonte", 0.3, 6.25, { color: th.muted, size: 10, align: "left" });
}

function drawDial(d: Draw, s: AtivState) {
  const th = d.theme;
  const { x: cx, y: cy, r } = DIAL;
  d.circle(cx, cy, r, { fill: th.dark ? "#1f252e" : "#f3f5f8", stroke: th.text, width: 1.5 });
  for (let a = 0; a < 360; a += 2) {
    const big = a % 30 === 0;
    const mid = a % 10 === 0;
    const r1 = r * (big ? 0.84 : mid ? 0.88 : 0.94);
    const t = (a * Math.PI) / 180;
    d.line(cx + r1 * Math.sin(t), cy + r1 * Math.cos(t), cx + r * Math.sin(t), cy + r * Math.cos(t), { width: big ? 1.6 : 0.8 });
    if (big) d.text(`${a}°`, cx + r * 0.72 * Math.sin(t), cy + r * 0.72 * Math.cos(t), { color: th.muted, size: 10 });
  }
  const rIn = r * 0.58;
  d.circle(cx, cy, rIn, { fill: th.dark ? "rgba(120,130,150,0.4)" : "rgba(80,90,110,0.28)", stroke: th.accent, width: 2 });
  const t = (s.th * Math.PI) / 180;
  d.line(cx - rIn * Math.sin(t), cy - rIn * Math.cos(t), cx + rIn * Math.sin(t), cy + rIn * Math.cos(t), { color: th.accent, width: 3 });
  d.line(cx + rIn * Math.sin(t), cy + rIn * Math.cos(t), cx + r * 0.98 * Math.sin(t), cy + r * 0.98 * Math.cos(t), { color: th.positive, width: 2 });
  d.dot(cx + r * 0.98 * Math.sin(t), cy + r * 0.98 * Math.cos(t), 3.5, th.positive);
  d.text(`Analisador θ = ${fmt(s.th, 1)}° (arraste)`, cx, cy + r + 0.4, { size: 11, weight: "600" });
}

function drawField(d: Draw, s: AtivState, p: Params) {
  const th = d.theme;
  const R = readings(s, p);
  const I0 = num(p, "I0", 1000) + num(p, "amb", 5);
  const gray = (V: number) => {
    const g = Math.round(255 * Math.min(1, V / I0) ** 0.5);
    return `rgb(${g},${Math.round(g * 0.95)},${Math.round(g * 0.6)})`;
  };
  const { x, y, r } = FIELD;
  const pen = epsOf(p) > 0;
  d.ctx.save();
  d.ctx.beginPath();
  d.ctx.arc(x, y, r, 0, 2 * Math.PI);
  d.ctx.clip();
  d.rect(x - r, y - r, r, 2 * r, { fill: gray(R.esq) });
  d.rect(x, y - r, r, 2 * r, { fill: gray(pen ? R.dir : R.esq) });
  d.ctx.restore();
  d.circle(x, y, r, { stroke: th.text, width: 1.5 });
  if (pen) d.line(x, y - r, x, y + r, { color: th.muted, width: 0.8 });
  d.text(pen ? "campo de penumbra (iguale as metades)" : "campo visto na ocular", x, y + r + 0.35, { color: th.muted, size: 10 });
}

function drawMeter(d: Draw, s: AtivState, p: Params) {
  const th = d.theme;
  const R = readings(s, p);
  const pen = epsOf(p) > 0;
  d.rect(METER.x0, METER.y0, METER.x1 - METER.x0, METER.y1 - METER.y0, { fill: th.dark ? "#14181e" : "#2a2f37", stroke: th.text, width: 1.5 });
  d.rect(METER.x0 + 0.2, METER.y0 + 0.25, METER.x1 - METER.x0 - 0.4, METER.y1 - METER.y0 - 0.5, { fill: "#a8c49a" });
  const txt = pen ? `${fmt(R.esq, 1)} | ${fmt(R.dir, 1)} mV` : `${fmt(R.media, 1)} mV`;
  d.text(txt, (METER.x0 + METER.x1) / 2, (METER.y0 + METER.y1) / 2, { color: "#1a2416", size: pen ? 15 : 19, weight: "700" });
  d.text(`α lido = θ − 90° = ${fmt(alphaRead(s), 1)}°`, (METER.x0 + METER.x1) / 2, METER.y0 - 0.35, { size: 11 });
  if (modo(p) === MODO_INV) d.text(`tempo de reação: ${fmt(s.tr / 60, 1)} min`, (METER.x0 + METER.x1) / 2, METER.y0 - 0.85, { color: th.accent, size: 11, weight: "600" });
}

function axes(d: Draw, xl: string, yl: string) {
  const th = d.theme;
  const { x0, x1, y0, y1 } = GRAPH;
  d.line(x0, y0, x1, y0, { color: th.muted, width: 1 });
  d.line(x0, y0, x0, y1, { color: th.muted, width: 1 });
  d.text(xl, (x0 + x1) / 2, y0 - 0.65, { color: th.muted, size: 10 });
  d.text(yl, x0, y1 + 0.3, { color: th.muted, size: 10, align: "left" });
}

function drawGraph(d: Draw, s: AtivState, p: Params, trail: AtivState[]) {
  const th = d.theme;
  const { x0, x1, y0, y1 } = GRAPH;
  const m = modo(p);
  if (m === MODO_DISP) {
    // [α] contra λ, curva de Drude e as quatro lâmpadas
    const sug = sugarOf(p);
    const vals = [400, 700].map((nm) => specificRotation(sug, nm));
    const top = Math.max(10, ...vals.map(Math.abs)) * 1.1;
    const gx = (nm: number) => x0 + ((x1 - x0) * (nm - 400)) / 300;
    const gy = (v: number) => (y0 + y1) / 2 + ((y1 - y0) / 2) * (v / top);
    d.line(x0, gy(0), x1, gy(0), { color: th.grid, width: 1 });
    axes(d, "comprimento de onda λ (nm)", "rotação específica [α] (° mL g⁻¹ dm⁻¹)");
    for (const nm of [400, 500, 600, 700]) d.text(`${nm}`, gx(nm), y0 - 0.25, { color: th.muted, size: 9 });
    d.text(fmt(top / 1.1, 0), x0 - 0.1, gy(top / 1.1), { color: th.muted, size: 9, align: "right" });
    d.text(fmt(-top / 1.1, 0), x0 - 0.1, gy(-top / 1.1), { color: th.muted, size: 9, align: "right" });
    if (Math.round(num(p, "curva", 1)) === 1) d.plot((x) => gy(specificRotation(sug, 400 + ((x - x0) / (x1 - x0)) * 300)), x0, x1, { color: th.muted, dash: [5, 4] });
    for (const l of LAMPS) d.dot(gx(l.nm), gy(specificRotation(sug, l.nm)), 4, nmColor(l.nm));
    d.dot(gx(nmOf(p)), gy(specificRotation(sug, nmOf(p))), 6, th.accent);
    return;
  }
  if (m === MODO_INV) {
    const c0 = num(p, "c", 20);
    const L = num(p, "L", 2);
    const k = kOf(p);
    const tMax = Math.max(60, 4 / k);
    const a0 = rotation(SACAROSE, nmOf(p), L, c0);
    const aInf = inversionFinal(c0, nmOf(p), L);
    const top = Math.max(Math.abs(a0), Math.abs(aInf)) * 1.15;
    const gx = (t: number) => x0 + ((x1 - x0) * Math.min(t, tMax)) / tMax;
    const gy = (v: number) => (y0 + y1) / 2 + ((y1 - y0) / 2) * (v / top);
    d.line(x0, gy(0), x1, gy(0), { color: th.grid, width: 1 });
    axes(d, `tempo (min), até ${fmt(tMax / 60, 0)} min`, "rotação α (°)");
    d.line(x0, gy(aInf), x1, gy(aInf), { color: th.negative, width: 1, dash: [4, 3] });
    d.text(`α∞ = ${fmt(aInf, 2)}°`, x1, gy(aInf) - 0.3, { color: th.negative, size: 10, align: "right" });
    d.text(`α₀ = ${fmt(a0, 2)}°`, x0 + 0.1, gy(a0) + 0.3, { color: th.positive, size: 10, align: "left" });
    if (Math.round(num(p, "curva", 1)) === 1) d.plot((x) => gy(inversionRotation(c0, k, ((x - x0) / (x1 - x0)) * tMax, nmOf(p), L)), x0, x1, { color: th.muted, dash: [5, 4] });
    for (const q of trail) d.dot(gx(q.tr), gy(alphaRead(q)), 2.5, th.series[0]!, 0.8);
    d.dot(gx(s.tr), gy(alphaOf(s, p)), 5, th.accent);
    d.text("pontos: α lido no analisador em cada instante", (x0 + x1) / 2, y1 + 0.3, { color: th.muted, size: 9 });
    return;
  }
  // leitura contra θ
  const I0 = num(p, "I0", 1000) + num(p, "amb", 5);
  const gx = (a: number) => x0 + ((x1 - x0) * a) / 360;
  const gy = (V: number) => y0 + ((y1 - y0) * V) / (I0 * 1.05);
  axes(d, "ângulo do analisador θ", "leitura (mV)");
  for (const a of [0, 90, 180, 270, 360]) {
    d.line(gx(a), y0, gx(a), y1, { color: th.grid, width: 1 });
    d.text(`${a}°`, gx(a), y0 - 0.25, { color: th.muted, size: 9 });
  }
  if (Math.round(num(p, "curva", 1)) === 1) d.plot((x) => gy(readings({ ...s, th: ((x - x0) / (x1 - x0)) * 360 }, p).media), x0, x1, { color: th.muted, dash: [5, 4], n: 360 });
  for (const q of trail) d.dot(gx(wrap360(q.th)), gy(readings(q, p).media), 2.5, th.series[0]!, 0.8);
  d.dot(gx(wrap360(s.th)), gy(readings(s, p).media), 5, th.accent);
}

const angleAt = (pt: { x: number; y: number }) => wrap360(Math.round(((Math.atan2(pt.x - DIAL.x, pt.y - DIAL.y) * 180) / Math.PI) * 10) / 10);
const inDial = (pt: { x: number; y: number }) => Math.hypot(pt.x - DIAL.x, pt.y - DIAL.y) < DIAL.r * 1.1;
const base = (th: number): AtivState => ({ th, tr: 0, drag: false });

export const atividadeOtica = defineSim<AtivState>({
  id: "atividade-otica",
  title: "Atividade ótica e sacarímetro",
  course: "FG IV",
  topic: "Ótica",
  priority: "P2",
  summary:
    "Polarímetro de bancada: soluções de sacarose, glicose e frutose giram o plano de polarização de [α]·L·c. Gire o analisador até o mínimo (ou iguale o campo de penumbra), calcule a concentração, meça a dispersão rotatória e acompanhe a inversão da sacarose.",
  equations: [
    String.raw`\alpha = [\alpha]_\lambda^{T}\, L\, c \qquad (L \text{ em dm},\ c \text{ em g/mL})`,
    String.raw`[\alpha](\lambda) = \frac{A}{\lambda^2 - \lambda_0^2} \qquad (\text{Drude, } \lambda_0^2 = 0{,}0213\ \mu\text{m}^2)`,
    String.raw`I = I_0 \cos^2(\theta - \alpha) + I_{\text{fundo}} \quad\Rightarrow\quad \theta_{\min} = \alpha + 90^\circ`,
    String.raw`\text{C}_{12}\text{H}_{22}\text{O}_{11} + \text{H}_2\text{O} \xrightarrow{\text{H}^+} \text{glicose} + \text{frutose}, \qquad \ln(\alpha_t - \alpha_\infty) = \ln(\alpha_0 - \alpha_\infty) - k t`,
  ],
  liveEquations(s, p) {
    const sug = sugarOf(p);
    const nm = nmOf(p);
    const L = num(p, "L", 2);
    const a = alphaOf(s, p);
    const out = [String.raw`[\alpha]_{${nm}\,\text{nm}} = ${texNum(specificRotation(sug, nm), 4)}^\circ\,\text{mL}\,\text{g}^{-1}\,\text{dm}^{-1}`];
    if (modo(p) === MODO_INV) {
      const k = kOf(p);
      const c = inversionConc(num(p, "c", 20), k, s.tr);
      out.push(String.raw`k = ${texNum(k, 3)}\ \text{s}^{-1},\ t_{1/2} = ${texNum(Math.LN2 / k / 60, 3)}\ \text{min} \qquad c_{\text{sac}} = ${texNum(c.sac, 3)}\ \text{g}/100\,\text{mL}`);
      out.push(String.raw`\alpha(t = ${texNum(s.tr / 60, 3)}\ \text{min}) = ${texNum(a, 4)}^\circ \qquad \alpha_\infty = ${texNum(inversionFinal(num(p, "c", 20), nm, L), 4)}^\circ`);
    } else {
      out.push(String.raw`\alpha = ${texNum(specificRotation(sug, nm), 4)} \times ${texNum(L)}\ \text{dm} \times ${texNum(num(p, "c", 20) / 100)}\ \text{g/mL} = ${texNum(a, 4)}^\circ`);
      if (sug > 0) out.push(String.raw`\theta - 90^\circ = ${texNum(alphaRead(s), 4)}^\circ \Rightarrow c = \frac{100\,\alpha}{[\alpha] L} = ${texNum(concentrationFrom(alphaRead(s), sug, nm, L), 4)}\ \text{g}/100\,\text{mL}`);
    }
    return out;
  },

  params: [
    {
      key: "modo",
      label: "Experimento",
      unit: "",
      min: 0,
      max: 2,
      step: 1,
      default: 0,
      options: [
        { value: MODO_CONC, label: "Sacarímetro: medir a concentração" },
        { value: MODO_DISP, label: "Dispersão rotatória (vários λ)" },
        { value: MODO_INV, label: "Inversão da sacarose (cinética)" },
      ],
    },
    { key: "sol", label: "Solução no tubo", unit: "", min: 0, max: 4, step: 1, default: 1, live: true, options: SUGARS.map((s, i) => ({ value: i, label: s.label })) },
    { key: "c", label: "Concentração (inicial, na inversão)", unit: "g/100 mL", min: 0, max: 40, step: 0.5, default: 20, live: true },
    { key: "L", label: "Comprimento do tubo L", unit: "dm", min: 0.5, max: 4, step: 0.5, default: 2, live: true },
    { key: "lambda", label: "Lâmpada / filtro", unit: "nm", min: 436, max: 633, step: 1, default: 589, live: true, options: LAMPS.map((l) => ({ value: l.nm, label: l.label })) },
    {
      key: "campo",
      label: "Ocular",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 0,
      live: true,
      options: [
        { value: 0, label: "Campo simples (procure o mínimo)" },
        { value: 1, label: "Penumbra de Laurent (iguale as metades)" },
      ],
    },
    { key: "eps", label: "Ângulo de penumbra ε", unit: "°", min: 1, max: 10, step: 0.5, default: 3, live: true },
    { key: "theta", label: "Ângulo inicial do analisador", unit: "°", min: 0, max: 360, step: 1, default: 60 },
    { key: "I0", label: "Sinal máximo do feixe", unit: "mV", min: 100, max: 1900, step: 10, default: 1000, live: true },
    { key: "amb", label: "Luz de fundo no detector", unit: "mV", min: 0, max: 100, step: 1, default: 5, live: true },
    { key: "T", label: "Temperatura do banho (inversão)", unit: "°C", min: 15, max: 45, step: 1, default: 25 },
    { key: "acid", label: "Concentração de HCl", unit: "mol/L", min: 0.5, max: 4, step: 0.1, default: 2 },
    { key: "acel", label: "Aceleração do relógio", unit: "×", min: 1, max: 120, step: 1, default: 60, live: true },
    {
      key: "curva",
      label: "Curva teórica no gráfico",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 1,
      live: true,
      options: [
        { value: 1, label: "Mostrar" },
        { value: 0, label: "Esconder" },
      ],
    },
  ],

  observables: [
    { key: "theta", label: "Ângulo do analisador θ", unit: "°", value: (s) => wrap360(s.th) },
    { key: "V", label: "Leitura do fotodetector", unit: "mV", value: (s, p) => readings(s, p).media },
    { key: "Vesq", label: "Leitura, metade esquerda", unit: "mV", value: (s, p) => readings(s, p).esq },
    { key: "Vdir", label: "Leitura, metade direita", unit: "mV", value: (s, p) => readings(s, p).dir },
    { key: "alfaLido", label: "Rotação lida θ − 90°", unit: "°", value: (s) => alphaRead(s) },
    { key: "alfa", label: "Rotação produzida α (gabarito)", unit: "°", value: (s, p) => alphaOf(s, p) },
    { key: "espec", label: "Rotação específica [α]", unit: "° mL/(g dm)", value: (_s, p) => specificRotation(sugarOf(p), nmOf(p)) },
    { key: "tmin", label: "Tempo de reação", unit: "min", value: (s) => s.tr / 60 },
    { key: "csac", label: "Sacarose restante", unit: "g/100 mL", value: (s, p) => (modo(p) === MODO_INV ? inversionConc(num(p, "c", 20), kOf(p), s.tr).sac : num(p, "c", 20)) },
  ],
  chart: { x: "theta", y: "V" },

  scenarios: [
    {
      id: "sacarimetro",
      label: "Sacarímetro: concentração da sacarose",
      params: { modo: MODO_CONC, sol: 1, c: 15, L: 2, lambda: 589, campo: 0, theta: 60 },
      guide: `### Medindo a concentração
1. Encha o tubo com **água** (branco) e gire o analisador até o mínimo: deve ser $\\theta = 90^\\circ$. Esse é o zero do aparelho.
2. Troque para **sacarose**. A leitura no mínimo subiu: o plano de polarização girou de $\\alpha$.
3. Ache o mínimo com cuidado (use os pontos do gráfico dos dois lados do vale) e anote $\\alpha = \\theta_{\\min} - 90^\\circ$.
4. Calcule $c = \\dfrac{\\alpha}{[\\alpha]\\,L}$ com $[\\alpha]_D = +66{,}5^\\circ\\,\\text{mL}\\,\\text{g}^{-1}\\,\\text{dm}^{-1}$.
5. Dobre $L$: o ângulo dobra? Isso também decide se a rotação é $\\alpha$ ou $\\alpha \\pm 180^\\circ$.
6. Troque para **penumbra de Laurent**: iguale as duas metades. Perto da extinção, alguns décimos de grau já desequilibram o campo.`,
      predict: [
        {
          question: "Você troca o tubo de 2 dm por um de 1 dm, com a mesma solução. O ângulo de rotação:",
          options: ["dobra", "cai pela metade", "não muda", "muda de sinal"],
          answer: 1,
          explanation: "Cada camada de solução gira o plano do mesmo ângulo: $\\alpha = [\\alpha] L c$ é proporcional ao caminho percorrido. Metade do tubo, metade da rotação.",
        },
      ],
    },
    {
      id: "levogira",
      label: "Dextrógira × levógira",
      params: { modo: MODO_CONC, sol: 3, c: 10, L: 2, lambda: 589, campo: 1, eps: 3, theta: 90 },
      guide: `### O sinal da rotação
1. A **frutose** é levógira: gira o plano no sentido anti-horário (para quem olha a fonte).
2. Iguale as metades do campo de penumbra e leia $\\alpha = \\theta - 90^\\circ$. O resultado é negativo.
3. Compare com a **glicose** e com o **açúcar invertido**. Por que o açúcar invertido é levógiro, se a glicose é dextrógira?
4. Sozinha, uma medida não distingue $-18^\\circ$ de $+162^\\circ$. Mude $L$ ou $c$ e veja para que lado o mínimo anda.`,
      predict: [
        {
          question: "Uma mistura 1:1 (em massa) de glicose (+52,7) e frutose (−92,4) gira o plano:",
          options: ["para a direita", "para a esquerda", "nada", "depende de L"],
          answer: 1,
          explanation: "As rotações se somam: $[\\alpha]_{\\text{mist}} = \\tfrac12(52{,}7 - 92{,}4) \\approx -19{,}9$. A frutose ganha e a mistura é levógira; daí o nome *açúcar invertido*.",
        },
      ],
    },
    {
      id: "dispersao",
      label: "Dispersão rotatória",
      params: { modo: MODO_DISP, sol: 1, c: 20, L: 2, lambda: 436, campo: 0, theta: 90 },
      guide: `### A rotação depende da cor
1. Meça $\\alpha$ com as quatro lâmpadas (436, 546, 589 e 633 nm), achando o mínimo em cada uma.
2. Calcule $[\\alpha] = \\alpha/(Lc)$ e marque no gráfico.
3. Faça o gráfico de $1/[\\alpha]$ contra $\\lambda^2$: a lei de Drude prevê uma reta que corta o eixo em $\\lambda_0^2$.
4. Com luz branca o mínimo não é escuro: cada cor tem seu mínimo e o campo fica colorido.`,
      predict: [
        {
          question: "Para a sacarose, a rotação com luz azul (436 nm), comparada à da luz de sódio (589 nm), é:",
          options: ["menor", "igual", "cerca de 2 vezes maior", "de sinal oposto"],
          answer: 2,
          explanation: "Longe da absorção, $[\\alpha] \\approx A/(\\lambda^2-\\lambda_0^2)$ cresce rápido no azul: $(0{,}589^2-0{,}0213)/(0{,}436^2-0{,}0213) \\approx 1{,}91$.",
        },
      ],
    },
    {
      id: "inversao",
      label: "Inversão da sacarose",
      params: { modo: MODO_INV, c: 20, L: 2, lambda: 589, campo: 0, T: 30, acid: 2, acel: 60, theta: 140 },
      guide: `### Cinética pela rotação
1. Rode a simulação. O relógio corre acelerado (1 s de tela = 1 min de reação com aceleração 60).
2. A cada poucos minutos, ache o mínimo e anote $(t, \\alpha_t)$. A rotação cai, passa por zero e fica negativa.
3. Espere a reação terminar para ler $\\alpha_\\infty$ (ou use a linha tracejada).
4. Faça o gráfico de $\\ln(\\alpha_t - \\alpha_\\infty)$ contra $t$: a inclinação é $-k$. Compare com as equações ao vivo.
5. Repita a 40 °C: quanto $k$ aumenta? Estime a energia de ativação por Arrhenius.`,
      predict: [
        {
          question: "Ao final da inversão, a rotação da solução será:",
          options: ["zero", "positiva e menor", "negativa", "igual à inicial"],
          answer: 2,
          explanation: "Cada grama de sacarose vira 0,526 g de glicose (+52,7) e 0,526 g de frutose (−92,4); a soma dá $[\\alpha] \\approx -20,9$ por grama de sacarose original: a rotação inverte de sinal.",
        },
      ],
    },
  ],

  exercises: [
    {
      id: "concentracao",
      prompt:
        "Num sacarímetro com luz de sódio, o tubo de {L} dm com água dá extinção em 90,0°. Com uma solução de sacarose ([α] = +66,5° mL g⁻¹ dm⁻¹), a extinção passa para {theta}°. Qual a concentração, em g/100 mL?",
      vary: { L: [1, 4, 0], theta: [95, 125, 1] },
      fixed: { modo: MODO_CONC, sol: 1, lambda: 589 },
      answer: { label: "c", unit: "g/100 mL", compute: (p) => concentrationFrom(num(p, "theta") - 90, 1, 589, num(p, "L")) },
      hint: "α = θ − 90° e c = α/([α] L), em g/mL; multiplique por 100.",
    },
    {
      id: "frutose",
      prompt: "Qual a rotação (em graus, com sinal) produzida por uma solução de frutose com {c} g/100 mL num tubo de {L} dm, com luz de sódio? ([α]_D = −92,4° mL g⁻¹ dm⁻¹)",
      vary: { c: [2, 25, 1], L: [1, 3, 0] },
      fixed: { modo: MODO_CONC, sol: 3, lambda: 589 },
      answer: { label: "α", unit: "°", compute: (p) => rotation(3, 589, num(p, "L"), num(p, "c")) },
      hint: "α = [α] L c com c em g/mL.",
    },
    {
      id: "meia-vida",
      prompt: "Na inversão da sacarose a {T} °C com HCl {acid} mol/L, k = 2,0×10⁻⁴ s⁻¹ a 25 °C para 1 mol/L, proporcional a [H⁺], com Ea = 108 kJ/mol. Qual a meia-vida, em minutos?",
      vary: { T: [20, 40, 0], acid: [1, 3, 1] },
      fixed: { modo: MODO_INV },
      answer: { label: "t½", unit: "min", compute: (p) => Math.LN2 / rateConstant(num(p, "T"), num(p, "acid")) / 60 },
      tolerance: 0.03,
      hint: "k = k_ref [H⁺] exp[−Ea/R (1/T − 1/298,15 K)] e t½ = ln 2 / k.",
    },
  ],

  init: (p) => base(wrap360(num(p, "theta", 60))),
  step: (s, p, _t, dt) => (modo(p) === MODO_INV ? { ...s, tr: s.tr + dt * num(p, "acel", 60) } : s),
  dt: 0.05,
  maxSamples: 4000,

  pointer: {
    down: (s, _p, pt) => (inDial(pt) ? { ...s, drag: true, th: angleAt(pt) } : undefined),
    move: (s, _p, pt, dragging) => (dragging && s.drag ? { ...s, th: angleAt(pt) } : undefined),
    up: (s) => (s.drag ? { ...s, drag: false } : undefined),
    cursor: (_s, _p, pt) => (inDial(pt) ? "grab" : undefined),
  },

  actions: [
    { id: "menos", label: "−0,1°", run: (s) => ({ ...s, th: wrap360(Math.round((s.th - 0.1) * 10) / 10) }) },
    { id: "mais", label: "+0,1°", run: (s) => ({ ...s, th: wrap360(Math.round((s.th + 0.1) * 10) / 10) }) },
    { id: "m1", label: "−1°", run: (s) => ({ ...s, th: wrap360(s.th - 1) }) },
    { id: "p1", label: "+1°", run: (s) => ({ ...s, th: wrap360(s.th + 1) }) },
  ],

  viewport: () => ({ ...VP }),

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const { state: s, params: p } = frame;
    drawBench(d, s, p);
    drawDial(d, s);
    drawField(d, s, p);
    drawMeter(d, s, p);
    drawGraph(d, s, p, frame.trail.slice(-400));
  },
});

export default atividadeOtica;
