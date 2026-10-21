import { defineSim, draw, num, texNum, type Draw, type Params } from "@fisilab/core";
import {
  coneTemplate,
  css,
  dense,
  FILTERS,
  flat,
  gauss,
  ledWhite,
  lms,
  matchPrimaries,
  NM,
  perceived,
  planck,
  PRIMARIES,
  prod,
  rayleighPrimaries,
  rayleighRatio,
  sum,
  VIEWERS,
  type Spectrum,
  type V3,
} from "./fisica.ts";

export * from "./fisica.ts";

export const ADITIVA = 0;
export const SUBTRATIVA = 1;
export const DISCO = 2;
export const VISAO = 3;
export const FILTROS = 4;

type P2 = [number, number];
export interface CorState {
  /** Centros dos três projetores (R, G, B) no anteparo. */
  spots: [P2, P2, P2];
  /** Centros dos filtros/manchas de tinta C, M, Y. */
  filt: [P2, P2, P2];
  /** Sensor (olho) que lê o espectro num ponto do anteparo. */
  probe: P2;
  /** Comprimento de onda da luz monocromática (nm). */
  lam: number;
  /** Ângulo do disco de Newton (rad). */
  phi: number;
  drag: null | string;
}

const modo = (p: Params) => Math.round(num(p, "modo"));
const viewer = (p: Params) => Math.round(num(p, "visao"));
const fmt = (v: number, k = 2) => (Number.isFinite(v) ? v.toFixed(k).replace(".", ",").replace("-", "−") : "—");

/** Luz monocromática (espectro triangular de uma amostra, integral 1 na grade de 5 nm). */
export const mono = (l: number): Spectrum => (nm) => Math.max(0, 1 - Math.abs(nm - l) / 5);

// ------------------------------------------------------------------ fontes
const SOURCES: { label: string; f: (s: CorState) => Spectrum }[] = [
  { label: "Monocromática (λ)", f: (s) => mono(s.lam) },
  { label: "Branca de energia igual", f: () => flat },
  { label: "Lâmpada incandescente (2856 K)", f: () => planck(2856) },
  { label: "LED branco (azul + fósforo)", f: () => ledWhite },
  { label: "Lâmpada de sódio (589 nm)", f: () => mono(590) },
  { label: "Lâmpada fluorescente (Hg + fósforos)", f: () => sum({ f: mono(435), w: 0.6 }, { f: mono(545), w: 1.2 }, { f: mono(610), w: 1.0 }, { f: gauss(580, 60), w: 0.12 }) },
];
const sourceOf = (s: CorState, p: Params) => (SOURCES[Math.round(num(p, "fonte"))] ?? SOURCES[0]!).f(s);

const FILTER_LIST: { label: string; f: Spectrum }[] = [
  { label: "Sem filtro", f: flat },
  { label: "Vermelho", f: FILTERS.R },
  { label: "Verde", f: FILTERS.G },
  { label: "Azul", f: FILTERS.B },
  { label: "Ciano", f: FILTERS.C },
  { label: "Magenta", f: FILTERS.M },
  { label: "Amarelo", f: FILTERS.Y },
];

const OBJECTS: { label: string; f: Spectrum }[] = [
  { label: "papel branco", f: () => 0.9 },
  { label: "tomate", f: (nm) => 0.05 + 0.8 / (1 + Math.exp(-(nm - 595) / 10)) },
  { label: "banana", f: (nm) => 0.06 + 0.8 / (1 + Math.exp(-(nm - 510) / 10)) },
  { label: "folha", f: (nm) => 0.05 + 0.4 * Math.exp(-0.5 * ((nm - 550) / 25) ** 2) },
  { label: "camisa azul", f: (nm) => 0.05 + 0.6 / (1 + Math.exp((nm - 490) / 12)) },
  { label: "uva roxa", f: (nm) => 0.04 + 0.35 / (1 + Math.exp((nm - 470) / 12)) + 0.35 / (1 + Math.exp(-(nm - 620) / 12)) },
];

// ------------------------------------------------------------------ síntese aditiva e subtrativa
const SCREEN = { x0: 0.3, x1: 11.7, y0: -7.9, y1: 6.2 };
const SPOT_R = 2.6;
const inside = (c: P2, pt: P2, r = SPOT_R) => Math.hypot(c[0] - pt[0], c[1] - pt[1]) <= r;

/** Espectro que chega a um ponto do anteparo (modos aditivo e subtrativo). */
export function spectrumAt(s: CorState, p: Params, pt: P2): Spectrum {
  if (modo(p) === ADITIVA) {
    const w = ["iR", "iG", "iB"].map((k, i) => (inside(s.spots[i]!, pt) ? num(p, k, 1) : 0));
    return sum(...PRIMARIES.map((f, i) => ({ f, w: w[i]! })));
  }
  const keys = ["C", "M", "Y"] as const;
  const fs: Spectrum[] = [];
  keys.forEach((k, i) => {
    if (inside(s.filt[i]!, pt)) fs.push(dense(FILTERS[k], num(p, `d${k}`, 1)));
  });
  return fs.length ? prod(...fs) : flat;
}

/** Cor (CSS) de uma região formada pelo subconjunto `mask` de manchas. */
function regionColor(s: CorState, p: Params, mask: number): string {
  const v = viewer(p);
  if (modo(p) === ADITIVA) {
    const w = ["iR", "iG", "iB"].map((k, i) => ((mask >> i) & 1 ? num(p, k, 1) : 0));
    return css(perceived(sum(...PRIMARIES.map((f, i) => ({ f, w: w[i]! }))), v), 3.2);
  }
  const keys = ["C", "M", "Y"] as const;
  const fs = keys.filter((_, i) => (mask >> i) & 1).map((k) => dense(FILTERS[k], num(p, `d${k}`, 1)));
  return css(perceived(fs.length ? prod(...fs) : flat, v), 1);
}

function drawMix(d: Draw, s: CorState, p: Params) {
  const th = d.theme;
  const add = modo(p) === ADITIVA;
  const centers = add ? s.spots : s.filt;
  const { x0, x1, y0, y1 } = SCREEN;
  d.rect(x0, y0, x1 - x0, y1 - y0, { fill: add ? "#000" : regionColor(s, p, 0), stroke: th.text, width: 1 });
  d.ctx.save();
  d.ctx.beginPath();
  d.ctx.rect(x0, y0, x1 - x0, y1 - y0);
  d.ctx.clip();
  // pintor: regiões com 1, depois 2, depois 3 manchas (cada interseção cabe na anterior)
  for (const k of [1, 2, 3]) {
    for (let mask = 1; mask < 8; mask++) {
      const idx = [0, 1, 2].filter((i) => (mask >> i) & 1);
      if (idx.length !== k) continue;
      d.ctx.save();
      for (const i of idx) {
        d.ctx.beginPath();
        d.ctx.arc(centers[i]![0], centers[i]![1], SPOT_R, 0, 2 * Math.PI);
        d.ctx.clip();
      }
      d.rect(x0, y0, x1 - x0, y1 - y0, { fill: regionColor(s, p, mask) });
      d.ctx.restore();
    }
  }
  d.ctx.restore();
  const names = add ? ["R", "G", "B"] : ["C", "M", "Y"];
  centers.forEach((c, i) => {
    d.circle(c[0], c[1], SPOT_R, { stroke: add ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.25)", width: 1, dash: [4, 4] });
    d.text(names[i]!, c[0], c[1] + SPOT_R + 0.3, { color: add ? "#ddd" : "#333", size: 12, weight: "700" });
  });
  // sensor
  d.circle(s.probe[0], s.probe[1], 0, { minPx: 7, stroke: add ? "#fff" : "#000", width: 2 });
  d.line(s.probe[0] - 0.35, s.probe[1], s.probe[0] + 0.35, s.probe[1], { color: add ? "#fff" : "#000", width: 1 });
  d.text("sensor", s.probe[0], s.probe[1] - 0.45, { color: add ? "#fff" : "#000", size: 10 });
  d.text(add ? "anteparo escuro · arraste os projetores e o sensor" : Math.round(num(p, "tintas")) === 1 ? "tintas sobre papel branco · arraste as manchas" : "filtros sobre luz branca · arraste os filtros", (x0 + x1) / 2, y1 + 0.25, { color: th.muted, size: 10 });
  drawSpectrumPanel(d, spectrumAt(s, p, s.probe), p, add ? "espectro no sensor" : "espectro transmitido no sensor");
}

// ------------------------------------------------------------------ painel de espectro e cones
const SP = { x0: 12.6, x1: 19.6, y0: 1.2, y1: 5.6 };

function drawSpectrumPanel(d: Draw, spec: Spectrum, p: Params, title: string, box = SP, bars: P2 = [12.6, -4.6]) {
  const th = d.theme;
  const { x0, x1, y0, y1 } = box;
  const V = VIEWERS[viewer(p)]!;
  d.rect(x0, y0, x1 - x0, y1 - y0, { fill: th.dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)", stroke: th.grid, width: 1 });
  const gx = (nm: number) => x0 + ((x1 - x0) * (nm - 380)) / 350;
  // faixa do espectro visível
  for (const nm of NM) d.rect(gx(nm - 2.5), y0 - 0.25, (x1 - x0) / 70, 0.18, { fill: css(perceived(mono(nm), 0), 2.5) });
  const mx = Math.max(1e-9, ...NM.map(spec));
  const pts: P2[] = NM.map((nm) => [gx(nm), y0 + ((y1 - y0) * 0.95 * spec(nm)) / mx]);
  d.polyline([[gx(380), y0], ...pts, [gx(730), y0]], { fill: th.dark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.1)", color: th.text, width: 1.5 });
  const cc = ["#e0453a", "#2fa84f", "#3a6fe0"];
  V.peaks.forEach((pk, i) => {
    if (i === V.missing) return;
    d.plot((x) => y0 + (y1 - y0) * coneTemplate(pk, 380 + ((x - x0) / (x1 - x0)) * 350), x0, x1, { color: cc[i]!, width: 1.2, dash: [4, 3], n: 120 });
  });
  for (const nm of [400, 500, 600, 700]) d.text(`${nm}`, gx(nm), y0 - 0.5, { color: th.muted, size: 9 });
  d.text(title, x0, y1 + 0.3, { color: th.muted, size: 10, align: "left" });
  d.text("cones L M S (tracejado)", x1, y1 + 0.3, { color: th.muted, size: 9, align: "right" });
  drawBars(d, spec, p, bars[0], bars[1]);
}

function drawBars(d: Draw, spec: Spectrum, p: Params, x0: number, y0: number) {
  const th = d.theme;
  const v = VIEWERS[viewer(p)]!;
  const e = lms(spec, v.peaks);
  const mx = Math.max(1, ...e);
  const cc = ["#e0453a", "#2fa84f", "#3a6fe0"];
  ["L", "M", "S"].forEach((n, i) => {
    const x = x0 + 0.4 + 1.3 * i;
    const h = (3.2 * e[i]!) / mx;
    if (i === v.missing) d.text("ausente", x + 0.4, y0 + 0.4, { color: th.muted, size: 9 });
    else d.rect(x, y0, 0.8, h, { fill: cc[i]!, alpha: 0.85 });
    d.text(`${n}`, x + 0.4, y0 - 0.3, { size: 11, weight: "600" });
    d.text(fmt(e[i]!, 2), x + 0.4, y0 + Math.max(h, 0) + 0.3, { color: th.muted, size: 9 });
  });
  const col = perceived(spec, viewer(p));
  const colN = perceived(spec, 0);
  const k = 1 / Math.max(0.15, ...perceived(spec, 0));
  d.rect(x0 + 4.4, y0 + 1.7, 2.4, 1.5, { fill: css(colN, k), stroke: th.text, width: 1 });
  d.text("visão normal", x0 + 5.6, y0 + 3.5, { color: th.muted, size: 9 });
  d.rect(x0 + 4.4, y0 - 0.1, 2.4, 1.5, { fill: css(col, k), stroke: th.text, width: 1 });
  d.text(viewer(p) === 0 ? "(mesmo observador)" : "este observador", x0 + 5.6, y0 - 0.45, { color: th.muted, size: 9 });
}

// ------------------------------------------------------------------ disco de Newton
const DISC = { x: 5.6, y: -0.9, r: 6.4 };
const SECTORS = [650, 605, 578, 530, 480, 445, 410].map((nm) => gauss(nm, 22));

/** Fração angular coberta pela persistência da visão: 2π f τ, τ = 1/FFC. */
export const blurWindow = (f: number, cff: number) => (2 * Math.PI * Math.abs(f)) / cff;

/** RGB linear médio do disco inteiro sob luz branca (média das refletâncias). */
export function discAverage(v: number): V3 {
  return perceived((nm) => SECTORS.reduce((a, f) => a + 0.85 * f(nm), 0) / SECTORS.length, v);
}

function drawDisc(d: Draw, s: CorState, p: Params) {
  const th = d.theme;
  const v = viewer(p);
  const cols = SECTORS.map((f) => perceived((nm) => 0.85 * f(nm), v));
  const n = SECTORS.length;
  const f = num(p, "freq", 2);
  const win = Math.min(2 * Math.PI, blurWindow(f, num(p, "cff", 50)));
  const colorAt = (a: number): V3 => {
    const i = Math.floor(((((a - s.phi) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) / ((2 * Math.PI) / n)) % n;
    return cols[i]!;
  };
  const W = 180;
  for (let j = 0; j < W; j++) {
    const a0 = (2 * Math.PI * j) / W;
    const a1 = (2 * Math.PI * (j + 1)) / W;
    // média temporal: o setor visto em a0 nos últimos τ segundos
    const K = win > 0.01 ? 24 : 1;
    const acc: V3 = [0, 0, 0];
    for (let q = 0; q < K; q++) {
      const c = colorAt(a0 - (win * (q + 0.5)) / K);
      acc[0] += c[0] / K;
      acc[1] += c[1] / K;
      acc[2] += c[2] / K;
    }
    d.ctx.beginPath();
    d.ctx.moveTo(DISC.x, DISC.y);
    d.ctx.arc(DISC.x, DISC.y, DISC.r, a0, a1 + 0.004);
    d.ctx.closePath();
    d.ctx.fillStyle = css(acc, 1.6);
    d.ctx.fill();
  }
  d.circle(DISC.x, DISC.y, DISC.r, { stroke: th.text, width: 1.5 });
  d.circle(DISC.x, DISC.y, 0.25, { fill: th.text });
  d.text("disco de Newton (como o olho vê)", DISC.x, DISC.y + DISC.r + 0.35, { color: th.muted, size: 10 });
  // disco parado e cor média
  const sx = 15.6;
  const sy = 3.4;
  for (let i = 0; i < n; i++) {
    d.ctx.beginPath();
    d.ctx.moveTo(sx, sy);
    d.ctx.arc(sx, sy, 1.9, (2 * Math.PI * i) / n, (2 * Math.PI * (i + 1)) / n);
    d.ctx.closePath();
    d.ctx.fillStyle = css(cols[i]!, 1.6);
    d.ctx.fill();
  }
  d.text("parado", sx, sy - 2.25, { color: th.muted, size: 10 });
  const avg = discAverage(v);
  d.rect(12.6, -2.4, 2.6, 1.6, { fill: css(avg, 1.6), stroke: th.text, width: 1 });
  d.text("média das refletâncias", 13.9, -2.75, { color: th.muted, size: 9 });
  d.rect(16.2, -2.4, 2.6, 1.6, { fill: css([0.85, 0.85, 0.85], 1) , stroke: th.text, width: 1 });
  d.text("papel branco", 17.5, -2.75, { color: th.muted, size: 9 });
  const info = [
    `f = ${fmt(f, 1)} voltas/s · ${fmt(f * n, 0)} setores/s`,
    `persistência τ = 1/FFC = ${fmt(1000 / num(p, "cff", 50), 0)} ms`,
    `o olho mistura ${fmt(Math.min(100, (100 * win) / (2 * Math.PI)), 0)}% de uma volta`,
    win >= 2 * Math.PI - 1e-9 ? "cores fundidas: cinza claro" : "ainda se distinguem os setores",
  ];
  info.forEach((t, i) => d.text(t, 12.4, -4.0 - 0.55 * i, { size: 11, align: "left", weight: i === 3 ? "600" : "400" }));
}

// ------------------------------------------------------------------ visão de cores (cones, metâmeros, anomaloscópio)
const VP_SPEC = { x0: 0.9, x1: 11.2, y0: 0.6, y1: 5.6 };

function drawVision(d: Draw, s: CorState, p: Params) {
  const th = d.theme;
  const spec = sourceOf(s, p);
  drawSpectrumPanel(d, spec, p, Math.round(num(p, "fonte")) === 0 ? `luz monocromática λ = ${fmt(s.lam, 0)} nm (arraste no gráfico)` : "espectro da fonte", VP_SPEC, [12.6, -7.4]);
  // metâmero RGB
  const target = lms(spec);
  const w = matchPrimaries(target);
  const ok = w.every((x) => x >= 0);
  const mix = sum(...PRIMARIES.map((f, i) => ({ f, w: Math.max(0, w[i]!) })));
  const k = 1 / Math.max(0.15, ...perceived(spec, 0));
  const y = -1.6;
  d.text("Metâmero: mistura de três LEDs com o mesmo L, M, S (visão normal)", 12.5, 5.9, { size: 11, weight: "600", align: "left" });
  d.rect(12.6, 2.6, 3.2, 2.6, { fill: css(perceived(spec, viewer(p)), k), stroke: th.text, width: 1 });
  d.rect(15.8, 2.6, 3.2, 2.6, { fill: css(perceived(mix, viewer(p)), k), stroke: th.text, width: 1 });
  d.text("fonte", 14.2, 2.3, { color: th.muted, size: 10 });
  d.text("LEDs 612/545/455 nm", 17.4, 2.3, { color: th.muted, size: 10 });
  d.text(`pesos r, g, b = ${fmt(w[0], 3)}; ${fmt(w[1], 3)}; ${fmt(w[2], 3)}`, 12.6, 1.6, { size: 11, align: "left" });
  d.text(ok ? "todos positivos: mistura possível" : "peso negativo: cor fora do gamut dos LEDs", 12.6, 1.05, { color: ok ? th.text : th.negative, size: 11, align: "left" });
  // o par continua metâmero para este observador?
  const V = VIEWERS[viewer(p)]!;
  const a = lms(spec, V.peaks);
  const b = lms(mix, V.peaks);
  const diff = Math.max(...[0, 1, 2].filter((i) => i !== V.missing).map((i) => Math.abs(a[i]! - b[i]!) / Math.max(1e-6, Math.abs(a[i]!))));
  d.text(viewer(p) === 0 ? "" : `para este observador as duas metades ${diff < 0.02 ? "continuam iguais" : `diferem (${fmt(100 * diff, 0)}% num cone)`}`, 12.6, 0.5, { size: 11, align: "left" });
  // anomaloscópio de Nagel
  const ratio = rayleighRatio(V.peaks);
  const r0 = rayleighRatio(VIEWERS[0]!.peaks);
  d.text("Anomaloscópio (igualação de Rayleigh): vermelho 670 + verde 545 = amarelo 590", 0.9, y + 0.2, { size: 11, weight: "600", align: "left" });
  const by = y - 3.2;
  const [red, grn] = rayleighPrimaries();
  const mixR = sum({ f: red, w: num(p, "rr", 0.5) }, { f: grn, w: 1 - num(p, "rr", 0.5) });
  const yel = mono(590);
  const kk = 1.6 / Math.max(0.05, ...perceived(yel, 0));
  d.ctx.save();
  d.ctx.beginPath();
  d.ctx.arc(3.5, by + 0.6, 2.2, 0, 2 * Math.PI);
  d.ctx.clip();
  // o amarelo tem brilho ajustado para igualar o L da mistura (o observador ajusta o brilho)
  const Ly = lms(yel, V.peaks);
  const Lm = lms(mixR, V.peaks);
  const ch = V.missing === 0 ? 1 : 0;
  const scale = Lm[ch]! / Math.max(1e-9, Ly[ch]!);
  d.rect(1.3, by + 0.6, 4.4, 2.2, { fill: css(perceived(mixR, viewer(p)), kk) });
  d.rect(1.3, by - 1.6, 4.4, 2.2, { fill: css(perceived(yel, viewer(p)).map((c) => c * scale) as V3, kk) });
  d.ctx.restore();
  d.circle(3.5, by + 0.6, 2.2, { stroke: th.text, width: 1.5 });
  d.text(`fração de vermelho: ${fmt(num(p, "rr", 0.5), 3)} (controle)`, 6.2, by + 1.8, { size: 11, align: "left" });
  d.text(`igualação para este observador: ${fmt(ratio, 3)}`, 6.2, by + 1.2, { size: 11, align: "left" });
  d.text(`igualação da visão normal: ${fmt(r0, 3)}`, 6.2, by + 0.6, { color: th.muted, size: 11, align: "left" });
  d.text(V.missing >= 0 && V.missing < 2 ? "dicromata: iguala qualquer fração ajustando o brilho" : "", 6.2, by, { color: th.muted, size: 10, align: "left" });
}

// ------------------------------------------------------------------ filtros sobre luz branca
function drawFilters(d: Draw, s: CorState, p: Params) {
  const th = d.theme;
  const lamp = sourceOf(s, p);
  const flt = FILTER_LIST[Math.round(num(p, "filtro"))] ?? FILTER_LIST[0]!;
  const light: Spectrum = prod(lamp, flt.f);
  const v = viewer(p);
  const kRef = 1 / Math.max(0.05, perceived((nm) => 0.9 * lamp(nm), 0)[1]);
  // esquema: lâmpada → filtro → objetos
  d.circle(1.4, 4.4, 0.8, { fill: css(perceived(lamp, v), kRef * 0.9), stroke: th.text, width: 1 });
  d.text("fonte", 1.4, 3.2, { color: th.muted, size: 10 });
  d.polyline([[2.2, 4.8], [4.0, 5.1], [4.0, 3.7], [2.2, 4.0]], { close: true, fill: css(perceived(lamp, v), kRef * 0.9), alpha: 0.5, color: "none" });
  d.rect(4.0, 3.4, 0.35, 2.0, { fill: css(perceived(flt.f, v), 1), stroke: th.text, width: 1 });
  d.text(`filtro: ${flt.label.toLowerCase()}`, 4.2, 3.0, { size: 11, weight: "600" });
  d.polyline([[4.35, 5.1], [11.2, 5.9], [11.2, 2.9], [4.35, 3.7]], { close: true, fill: css(perceived(light, v), kRef * 0.9), alpha: 0.45, color: "none" });
  drawSpectrumPanel(d, light, p, "espectro da luz depois do filtro");
  // objetos
  d.text("Objetos iluminados por essa luz", 0.6, 1.6, { size: 12, weight: "600", align: "left" });
  OBJECTS.forEach((o, i) => {
    const x = 0.6 + (i % 3) * 3.7;
    const y = -1.2 - Math.floor(i / 3) * 3.4;
    const under = perceived(prod(light, o.f), v);
    const white = perceived((nm) => o.f(nm), 0);
    d.rect(x, y - 1.2, 3.2, 2.2, { fill: css(under, kRef), stroke: th.text, width: 1 });
    d.rect(x + 2.3, y + 0.35, 0.7, 0.5, { fill: css(white, 1.0), stroke: th.muted, width: 0.6 });
    d.text(o.label, x + 1.6, y - 1.5, { color: th.muted, size: 10 });
  });
  d.text("quadradinho: cor sob luz branca", 0.6, -8.1, { color: th.muted, size: 9, align: "left" });
}

// ------------------------------------------------------------------ simulação
const near = (c: P2, pt: { x: number; y: number }, r: number) => Math.hypot(c[0] - pt.x, c[1] - pt.y) < r;
const clampScreen = (pt: { x: number; y: number }): P2 => [Math.max(SCREEN.x0, Math.min(SCREEN.x1, pt.x)), Math.max(SCREEN.y0, Math.min(SCREEN.y1, pt.y))];
const lamFrom = (x: number) => Math.round(Math.max(380, Math.min(730, 380 + ((x - VP_SPEC.x0) / (VP_SPEC.x1 - VP_SPEC.x0)) * 350)));

export function probeLMS(s: CorState, p: Params): V3 {
  const m = modo(p);
  const V = VIEWERS[viewer(p)]!;
  if (m === ADITIVA || m === SUBTRATIVA) return lms(spectrumAt(s, p, s.probe), V.peaks);
  if (m === VISAO) return lms(sourceOf(s, p), V.peaks);
  if (m === FILTROS) return lms(prod(sourceOf(s, p), (FILTER_LIST[Math.round(num(p, "filtro"))] ?? FILTER_LIST[0]!).f), V.peaks);
  return lms((nm) => SECTORS.reduce((a, f) => a + 0.85 * f(nm), 0) / SECTORS.length, V.peaks);
}

export const coresVisao = defineSim<CorState>({
  id: "cores-visao",
  title: "Cores: síntese aditiva e subtrativa e visão",
  course: "FG IV",
  topic: "Ótica",
  priority: "P2",
  summary:
    "Projetores RGB e filtros CMY arrastáveis com cores calculadas do espectro, disco de Newton com a persistência da visão, resposta dos cones L, M e S, metâmeros, daltonismo e anomaloscópio, e objetos sob luz filtrada.",
  equations: [
    String.raw`L = \int S(\lambda)\,\bar l(\lambda)\,d\lambda,\quad M = \int S(\lambda)\,\bar m(\lambda)\,d\lambda,\quad S_c = \int S(\lambda)\,\bar s(\lambda)\,d\lambda`,
    String.raw`\text{aditiva: } S = \sum_i w_i\,P_i(\lambda) \qquad \text{subtrativa: } S = S_0(\lambda)\prod_i T_i(\lambda)^{k_i}`,
    String.raw`\text{metâmeros: } (L, M, S)_1 = (L, M, S)_2 \text{ com espectros diferentes}`,
    String.raw`\text{disco: mistura se } 2\pi f\,\tau \ge 2\pi,\ \ \tau = 1/f_{\text{FFC}}`,
  ],
  liveEquations(s, p) {
    const e = probeLMS(s, p);
    const out = [String.raw`(L, M, S) = (${texNum(e[0], 3)},\ ${texNum(e[1], 3)},\ ${texNum(e[2], 3)}) \quad (\text{branco de energia igual} = 1, 1, 1)`];
    const m = modo(p);
    if (m === VISAO) {
      const w = matchPrimaries(lms(sourceOf(s, p)));
      out.push(String.raw`\text{metâmero: } r, g, b = ${texNum(w[0], 3)},\ ${texNum(w[1], 3)},\ ${texNum(w[2], 3)} \qquad \text{Rayleigh: } \frac{r}{r+g} = ${texNum(rayleighRatio(VIEWERS[viewer(p)]!.peaks), 3)}`);
    }
    if (m === DISCO) {
      const f = num(p, "freq", 2);
      out.push(String.raw`2\pi f \tau = 2\pi \times ${texNum(f)} \times ${texNum(1 / num(p, "cff", 50), 3)}\ \text{s} = ${texNum(blurWindow(f, num(p, "cff", 50)), 3)}\ \text{rad}`);
    }
    return out;
  },

  params: [
    {
      key: "modo",
      label: "Experimento",
      unit: "",
      min: 0,
      max: 4,
      step: 1,
      default: 0,
      options: [
        { value: ADITIVA, label: "Síntese aditiva (projetores RGB)" },
        { value: SUBTRATIVA, label: "Síntese subtrativa (filtros e tintas CMY)" },
        { value: DISCO, label: "Disco de Newton" },
        { value: VISAO, label: "Visão: cones, metâmeros e daltonismo" },
        { value: FILTROS, label: "Filtros coloridos e objetos" },
      ],
    },
    { key: "visao", label: "Observador", unit: "", min: 0, max: 5, step: 1, default: 0, live: true, options: VIEWERS.map((v, i) => ({ value: i, label: v.label })) },
    { key: "iR", label: "Projetor vermelho (612 nm)", unit: "", min: 0, max: 1, step: 0.01, default: 1, live: true },
    { key: "iG", label: "Projetor verde (545 nm)", unit: "", min: 0, max: 1, step: 0.01, default: 1, live: true },
    { key: "iB", label: "Projetor azul (455 nm)", unit: "", min: 0, max: 1, step: 0.01, default: 1, live: true },
    { key: "dC", label: "Densidade do ciano", unit: "", min: 0, max: 3, step: 0.05, default: 1, live: true },
    { key: "dM", label: "Densidade do magenta", unit: "", min: 0, max: 3, step: 0.05, default: 1, live: true },
    { key: "dY", label: "Densidade do amarelo", unit: "", min: 0, max: 3, step: 0.05, default: 1, live: true },
    {
      key: "tintas",
      label: "Meio subtrativo",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 0,
      live: true,
      options: [
        { value: 0, label: "Filtros sobre luz branca" },
        { value: 1, label: "Tintas sobre papel branco" },
      ],
    },
    { key: "freq", label: "Rotação do disco", unit: "voltas/s", min: 0, max: 30, step: 0.1, default: 2, live: true },
    { key: "cff", label: "Frequência de fusão (FFC)", unit: "Hz", min: 10, max: 80, step: 1, default: 50, live: true },
    { key: "fonte", label: "Fonte de luz", unit: "", min: 0, max: 5, step: 1, default: 0, live: true, options: SOURCES.map((s, i) => ({ value: i, label: s.label })) },
    { key: "lambda", label: "λ inicial (monocromática)", unit: "nm", min: 380, max: 730, step: 1, default: 580 },
    { key: "rr", label: "Fração de vermelho no anomaloscópio", unit: "", min: 0, max: 1, step: 0.005, default: 0.5, live: true },
    { key: "filtro", label: "Filtro", unit: "", min: 0, max: 6, step: 1, default: 1, live: true, options: FILTER_LIST.map((f, i) => ({ value: i, label: f.label })) },
  ],

  observables: [
    { key: "L", label: "Excitação dos cones L", unit: "", value: (s, p) => probeLMS(s, p)[0] },
    { key: "M", label: "Excitação dos cones M", unit: "", value: (s, p) => probeLMS(s, p)[1] },
    { key: "S", label: "Excitação dos cones S", unit: "", value: (s, p) => probeLMS(s, p)[2] },
    { key: "lam", label: "Comprimento de onda", unit: "nm", value: (s) => s.lam },
    { key: "ML", label: "Razão M/L", unit: "", value: (s, p) => { const e = probeLMS(s, p); return e[0] > 1e-9 ? e[1] / e[0] : 0; } },
    { key: "mistura", label: "Fração de volta misturada pelo olho", unit: "", value: (_s, p) => Math.min(1, blurWindow(num(p, "freq", 2), num(p, "cff", 50)) / (2 * Math.PI)) },
    { key: "rayleigh", label: "Igualação de Rayleigh r/(r+g)", unit: "", value: (_s, p) => rayleighRatio(VIEWERS[viewer(p)]!.peaks) },
  ],
  chart: { x: "lam", y: "L" },

  scenarios: [
    {
      id: "aditiva",
      label: "Síntese aditiva com três projetores",
      params: { modo: ADITIVA, visao: 0, iR: 1, iG: 1, iB: 1 },
      guide: `### Somando luzes
1. Arraste os três projetores até as manchas se sobreporem. Onde as três se somam aparece o **branco**.
2. Leve o sensor ao encontro do vermelho com o verde: o espectro tem só dois picos, mas você vê **amarelo**. Compare $L$, $M$, $S$ com os de uma luz monocromática de 580 nm (modo Visão).
3. Diminua o verde: o amarelo vira laranja. As cores secundárias aditivas são ciano, magenta e amarelo.
4. Troque o observador para **deuteranopia**: quais regiões ficam indistinguíveis?`,
      predict: [
        {
          question: "Uma luz vermelha e uma verde se sobrepõem num anteparo branco. A região comum fica:",
          options: ["marrom", "amarela", "preta", "branca"],
          answer: 1,
          explanation: "Luzes se **somam**: o vermelho excita sobretudo os cones L, o verde os M. Juntos, L e M fortes e S fraco é exatamente o que uma luz amarela produz. O cérebro só recebe as três excitações.",
        },
      ],
    },
    {
      id: "subtrativa",
      label: "Síntese subtrativa: filtros e tintas",
      params: { modo: SUBTRATIVA, tintas: 0, dC: 1, dM: 1, dY: 1 },
      guide: `### Tirando cores da luz branca
1. Cada filtro **remove** uma faixa: ciano tira o vermelho, magenta tira o verde, amarelo tira o azul.
2. Sobreponha amarelo e ciano: sobra só o verde. Confira no espectro do sensor.
3. Os três juntos: quase nada passa (preto).
4. Aumente a densidade de um filtro (lei de Beer–Lambert, $T^k$): a cor fica mais saturada e mais escura.
5. Mude para **tintas**: a física é a mesma, a luz atravessa o pigmento, reflete no papel e atravessa de volta.`,
      predict: [
        {
          question: "Filtros amarelo e ciano empilhados, sob luz branca, deixam passar:",
          options: ["branco", "verde", "azul", "vermelho"],
          answer: 1,
          explanation: "O amarelo transmite verde + vermelho; o ciano transmite azul + verde. Em série, as transmitâncias se **multiplicam**: só o verde passa pelos dois.",
        },
      ],
    },
    {
      id: "newton",
      label: "Disco de Newton",
      params: { modo: DISCO, freq: 2, cff: 50 },
      guide: `### Quando as cores se fundem
1. Com 2 voltas/s os setores ainda aparecem, borrados.
2. Aumente a rotação. Quando $2\\pi f\\tau \\ge 2\\pi$, ou seja $f \\ge f_{\\text{FFC}}$, o olho mistura uma volta inteira e o disco fica cinza claro.
3. Compare com o quadrado da **média das refletâncias**: o disco não fica branco como o papel porque cada setor reflete só parte do espectro.
4. A mistura no disco é aditiva no tempo: a média das luzes que chegam ao olho.`,
      predict: [
        {
          question: "Girando o disco de Newton muito depressa, ele parece:",
          options: ["branco puro como o papel", "cinza claro (branco escurecido)", "preto", "da cor do maior setor"],
          answer: 1,
          explanation: "O olho faz a média temporal das luzes refletidas. Cada setor reflete só uma faixa, então a média é um branco de baixa refletância: cinza claro.",
        },
      ],
    },
    {
      id: "visao",
      label: "Cones, metâmeros e daltonismo",
      params: { modo: VISAO, fonte: 0, lambda: 580, visao: 0, rr: 0.5 },
      guide: `### Três números por cor
1. Arraste $\\lambda$ no gráfico. Veja as barras L, M, S: cada cor é um trio de números.
2. O quadro **metâmero** mostra a mistura de três LEDs com o mesmo trio: espectros diferentes, mesma cor. Em que $\\lambda$ algum peso fica negativo (fora do gamut)?
3. Troque para **protanopia**: compare 540 nm e 620 nm. Para quem não tem cones L, as cores na faixa verde–vermelho só diferem em brilho.
4. Com **protanomalia**, o metâmero deixa de igualar! No anomaloscópio, ajuste a fração de vermelho até igualar o amarelo: um protanômalo precisa de bem mais vermelho.`,
      predict: [
        {
          question: "Um amarelo monocromático (580 nm) e uma mistura de vermelho e verde podem parecer idênticos porque:",
          options: ["os espectros são iguais", "produzem as mesmas excitações nos três tipos de cone", "o verde vira amarelo no ar", "o olho tem um cone amarelo"],
          answer: 1,
          explanation: "A visão reduz o espectro a três números (L, M, S). Espectros diferentes com o mesmo trio são **metâmeros**, e é por isso que telas RGB funcionam.",
        },
      ],
    },
    {
      id: "filtros",
      label: "Filtros e objetos coloridos",
      params: { modo: FILTROS, fonte: 1, filtro: 1, visao: 0 },
      guide: `### Que cor tem um tomate no escuro?
1. A luz branca atravessa um filtro **vermelho**. Observe os objetos: o tomate continua vermelho, a folha e a camisa azul ficam quase pretas.
2. Troque para o filtro **verde** e depois **azul**. A cor de um objeto é a luz que ele reflete *da luz que recebe*.
3. Troque a fonte para **sódio**: tudo vira tons de amarelo e cinza (luz de rua antiga).
4. Compare LED branco com incandescente: o papel parece branco nos dois, mas os objetos mudam (índice de reprodução de cor).`,
    },
  ],

  exercises: [
    {
      id: "disco",
      prompt: "O disco de Newton tem 7 setores. Se a frequência de fusão do olho é {cff} Hz, qual a menor rotação (em voltas por segundo) para que o olho misture uma volta inteira?",
      vary: { cff: [30, 70, 0] },
      fixed: { modo: DISCO },
      answer: { label: "f", unit: "voltas/s", compute: (p) => num(p, "cff") },
      hint: "O olho mistura a luz recebida durante τ = 1/FFC; uma volta inteira cabe nesse tempo se f τ ≥ 1.",
    },
    {
      id: "filtros",
      prompt: "Um filtro tem transmitância {T} para a luz verde. Empilhando {k} filtros iguais, que fração da luz verde atravessa?",
      vary: { T: [0.3, 0.9, 2], k: [2, 4, 0] },
      fixed: { modo: SUBTRATIVA },
      answer: { label: "fração", unit: "", compute: (p) => num(p, "T") ** num(p, "k") },
      hint: "Em série as transmitâncias se multiplicam (Beer–Lambert).",
    },
  ],

  init: (p) => ({
    spots: [[4.2, 1.6], [7.8, 1.6], [6.0, -1.6]],
    filt: [[4.2, 1.6], [7.8, 1.6], [6.0, -1.6]],
    probe: [6.0, 0.6],
    lam: num(p, "lambda", 580),
    phi: 0,
    drag: null,
  }),
  step: (s, p, _t, dt) => (modo(p) === DISCO ? { ...s, phi: (s.phi + 2 * Math.PI * num(p, "freq", 2) * dt) % (2 * Math.PI) } : s),
  dt: 1 / 60,
  sampleEvery: 6,

  pointer: {
    down(s, p, pt) {
      const m = modo(p);
      if (m === ADITIVA || m === SUBTRATIVA) {
        if (near(s.probe, pt, 0.5)) return { ...s, drag: "probe" };
        const cs = m === ADITIVA ? s.spots : s.filt;
        for (let i = 2; i >= 0; i--) if (near(cs[i]!, pt, SPOT_R)) return { ...s, drag: `c${i}` };
        return undefined;
      }
      if (m === VISAO && Math.round(num(p, "fonte")) === 0 && pt.x >= VP_SPEC.x0 && pt.x <= VP_SPEC.x1 && pt.y >= VP_SPEC.y0 - 0.6 && pt.y <= VP_SPEC.y1) return { ...s, drag: "lam", lam: lamFrom(pt.x) };
      return undefined;
    },
    move(s, p, pt, dragging) {
      if (!dragging || !s.drag) return undefined;
      if (s.drag === "lam") return { ...s, lam: lamFrom(pt.x) };
      const q = clampScreen(pt);
      if (s.drag === "probe") return { ...s, probe: q };
      const i = Number(s.drag.slice(1));
      if (modo(p) === ADITIVA) {
        const spots = [...s.spots] as CorState["spots"];
        spots[i] = q;
        return { ...s, spots };
      }
      const filt = [...s.filt] as CorState["filt"];
      filt[i] = q;
      return { ...s, filt };
    },
    up: (s) => (s.drag ? { ...s, drag: null } : undefined),
    cursor(s, p, pt) {
      const m = modo(p);
      if (m === ADITIVA || m === SUBTRATIVA) return near(s.probe, pt, 0.5) || (m === ADITIVA ? s.spots : s.filt).some((c) => near(c, pt, SPOT_R)) ? "grab" : undefined;
      if (m === VISAO && pt.x >= VP_SPEC.x0 && pt.x <= VP_SPEC.x1 && pt.y >= VP_SPEC.y0 - 0.6 && pt.y <= VP_SPEC.y1) return "ew-resize";
      return undefined;
    },
  },

  actions: [
    { id: "menos", label: "λ − 5 nm", run: (s) => ({ ...s, lam: Math.max(380, s.lam - 5) }) },
    { id: "mais", label: "λ + 5 nm", run: (s) => ({ ...s, lam: Math.min(730, s.lam + 5) }) },
    {
      id: "juntar",
      label: "Sobrepor as três manchas",
      run: (s) => ({ ...s, spots: [[5.0, 1.0], [7.0, 1.0], [6.0, -0.7]], filt: [[5.0, 1.0], [7.0, 1.0], [6.0, -0.7]], probe: [6.0, 0.45] }),
    },
  ],

  viewport: () => ({ xMin: 0, xMax: 20, yMin: -8.4, yMax: 6.6 }),

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const { state: s, params: p } = frame;
    const m = modo(p);
    if (m === ADITIVA || m === SUBTRATIVA) drawMix(d, s, p);
    else if (m === DISCO) drawDisc(d, s, p);
    else if (m === VISAO) drawVision(d, s, p);
    else drawFilters(d, s, p);
    d.text(`Observador: ${VIEWERS[viewer(p)]!.label}`, 19.8, -8.15, { color: d.theme.muted, size: 10, align: "right" });
  },
});

export default coresVisao;
