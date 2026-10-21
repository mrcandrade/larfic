import { defineSim, draw, num, texNum, type Draw, type Params } from "@fisilab/core";
import {
  airy,
  beamRadius,
  C_LIGHT,
  cavityFSR,
  cavityMode,
  etherShift,
  finesse,
  fpPhase,
  fpTransmission,
  fsrHz,
  fsrLambda,
  radiusFromG,
  ringRadii,
  traceRay,
  transverseSpacing,
  twoBeam,
} from "./fisica.ts";

export * from "./fisica.ts";

export const FP_OTICO = 0;
export const MICHELSON_MO = 1;
export const FP_MO = 2;
export const MM = 3;
export const CAVIDADE = 4;

export interface IntState {
  /** Deslocamento do piezo do Fabry–Perot ótico (nm). */
  dfp: number;
  /** Distância do refletor móvel ao divisor de feixe, Michelson de micro-ondas (cm). */
  xB: number;
  /** Separação das placas do Fabry–Perot de micro-ondas (cm). */
  dMW: number;
  /** Posição marcada pelo aluno para contar máximos (cm). */
  marca: number;
  /** Orientação do aparelho de Michelson–Morley (graus). */
  alpha: number;
  /** Parâmetros g da cavidade. */
  g1: number;
  g2: number;
  drag: null | "B" | "placa" | "mm" | "g";
}

const modo = (p: Params) => Math.round(num(p, "modo"));
const fmt = (v: number, k = 2) => (Number.isFinite(v) ? v.toFixed(k).replace(".", ",").replace("-", "−") : "—");
const fin = (v: number) => (Number.isFinite(v) ? v : 0);

// ------------------------------------------------------------------ Fabry–Perot ótico
const SOURCES = [
  { label: "Laser He-Ne 632,8 nm", lines: [632.8], w: [1] },
  { label: "Lâmpada de sódio (dubleto 589,0 / 589,6 nm)", lines: [588.995, 589.592], w: [1, 0.5] },
  { label: "Lâmpada de mercúrio verde 546,1 nm", lines: [546.07], w: [1] },
];
const sourceOf = (p: Params) => SOURCES[Math.round(num(p, "fonte"))] ?? SOURCES[0]!;
/** Separação total dos espelhos (m), incluindo o piezo. */
export const fpGap = (s: IntState, p: Params) => num(p, "dmm", 2) * 1e-3 + s.dfp * 1e-9;

/** Intensidade transmitida na direção θ (média ponderada das linhas da fonte). */
export function fpIntensity(s: IntState, p: Params, cosTh: number): number {
  const src = sourceOf(p);
  const R = num(p, "R", 0.85);
  const d = fpGap(s, p);
  let I = 0;
  let W = 0;
  src.lines.forEach((l, i) => {
    const w = src.w[i]!;
    I += w * airy(fpPhase(d, l * 1e-9, cosTh), R);
    W += w;
  });
  return I / W;
}

/** Raio no plano focal (m) até onde os anéis são desenhados: cerca de 8 ordens. */
const ringRMax = (p: Params) => {
  const l = sourceOf(p).lines[0]! * 1e-9;
  const d = num(p, "dmm", 2) * 1e-3;
  return (num(p, "fmm", 200) * 1e-3) * Math.min(0.5, Math.sqrt((8 * l) / d));
};

// ------------------------------------------------------------------ micro-ondas
const BS = { x: 40, y: 0 };
const LA = 25; // braço fixo (cm)
const P1X = 30; // placa fixa do Fabry–Perot

/** Leitura do receptor no Michelson de micro-ondas (mA). */
export function michelsonReading(s: IntState, p: Params): number {
  const lam = num(p, "lamMW", 2.85);
  const tp = num(p, "tp", 0);
  const delta = 2 * (s.xB - LA) + 2 * (num(p, "np", 1.6) - 1) * tp;
  // ondas aproximadamente esféricas: amplitude ∝ 1/caminho
  const base = 26 + 25;
  const a1 = (0.5 * (base + 2 * LA)) / (base + 2 * LA);
  const a2 = (0.5 * (base + 2 * LA)) / (base + 2 * s.xB);
  return num(p, "I0", 1) * twoBeam(a1, a2, delta, lam);
}

export const fpMWReading = (s: IntState, p: Params) => num(p, "I0", 1) * fpTransmission(s.dMW, num(p, "lamMW", 2.85), num(p, "rMW", 0.6));

export function mwReading(s: IntState, p: Params): number {
  const m = modo(p);
  return m === MICHELSON_MO ? michelsonReading(s, p) : m === FP_MO ? fpMWReading(s, p) : 0;
}
const mwPos = (s: IntState, p: Params) => (modo(p) === FP_MO ? s.dMW : s.xB);

/**
 * Ordem de interferência do máximo mais próximo: no Michelson, Δ/λ arredondado
 * (Δ = 2(x − L_A) + 2(n − 1)t); no Fabry–Perot, 2d/λ arredondado. É o número que
 * o aluno obtém contando os máximos a partir da referência.
 */
export function mwOrder(s: IntState, p: Params): number {
  const lam = num(p, "lamMW", 2.85);
  const m = modo(p);
  if (m === MICHELSON_MO) return Math.round((2 * (s.xB - LA) + 2 * (num(p, "np", 1.6) - 1) * num(p, "tp", 0)) / lam);
  if (m === FP_MO) return Math.round((2 * s.dMW) / lam);
  return 0;
}

// ------------------------------------------------------------------ Michelson–Morley
/** Deslocamento observado (franjas): hipótese do éter ou resultado nulo com ruído de ~0,01 franja. */
export function mmObserved(s: IntState, p: Params): number {
  const pred = mmPredicted(s, p);
  if (Math.round(num(p, "hip")) === 1) return pred;
  const a = (s.alpha * Math.PI) / 180;
  return 0.006 * Math.sin(7.3 * a + 0.4) + 0.004 * Math.sin(17.1 * a + 2.1);
}
export const mmPredicted = (s: IntState, p: Params) => etherShift(num(p, "Lmm", 11), num(p, "v", 30) * 1e3, num(p, "lamMM", 550) * 1e-9, s.alpha);

// ------------------------------------------------------------------ cavidade
const lamCav = (p: Params) => num(p, "lamC", 1064) * 1e-9;
const Lcav = (p: Params) => num(p, "Lc", 30) * 1e-2;
export const modeOf = (s: IntState, p: Params) => cavityMode(s.g1, s.g2, Lcav(p), lamCav(p));

// ------------------------------------------------------------------ cores
function nmRGB(nm: number): [number, number, number] {
  if (nm < 440) return [(440 - nm) / 60, 0, 1];
  if (nm < 490) return [0, (nm - 440) / 50, 1];
  if (nm < 510) return [0, 1, (510 - nm) / 20];
  if (nm < 580) return [(nm - 510) / 70, 1, 0];
  if (nm < 645) return [1, (645 - nm) / 65, 0];
  return [1, 0, 0];
}
const rgb = (c: [number, number, number], k: number) => {
  const f = (v: number) => Math.round(255 * Math.max(0, Math.min(1, v * k)) ** 0.8);
  return `rgb(${f(c[0])},${f(c[1])},${f(c[2])})`;
};

// ------------------------------------------------------------------ desenho: Fabry–Perot ótico
function frame(d: Draw, x0: number, x1: number, y0: number, y1: number, xl: string, yl: string) {
  const th = d.theme;
  d.rect(x0, y0, x1 - x0, y1 - y0, { fill: th.dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)", stroke: th.grid, width: 1 });
  d.text(xl, (x0 + x1) / 2, y0 - 0.35, { color: th.muted, size: 10 });
  d.text(yl, x0, y1 + 0.3, { color: th.muted, size: 10, align: "left" });
}

function drawFP(d: Draw, s: IntState, p: Params) {
  const th = d.theme;
  const src = sourceOf(p);
  const col = nmRGB(src.lines[0]!);
  const R = num(p, "R", 0.85);
  const f = num(p, "fmm", 200) * 1e-3;
  const rMax = ringRMax(p);
  const C = { x: 4.6, y: -1.6, r: 4.1 };
  // anéis no plano focal
  d.circle(C.x, C.y, C.r, { fill: "#000" });
  const N = 240;
  for (let i = N; i >= 1; i--) {
    const rr = (i - 0.5) / N;
    const theta = Math.atan((rr * rMax) / f);
    const I = fpIntensity(s, p, Math.cos(theta));
    if (I < 0.02) continue;
    d.circle(C.x, C.y, rr * C.r, { stroke: rgb(col, I), width: (C.r / N) / d.px + 0.6 });
  }
  d.circle(C.x, C.y, C.r, { stroke: th.text, width: 1.5 });
  // escala do plano focal
  d.line(C.x, C.y - C.r - 0.35, C.x + C.r, C.y - C.r - 0.35, { color: th.muted, width: 1 });
  d.text(`${fmt(rMax * 1e3, 1)} mm`, C.x + C.r / 2, C.y - C.r - 0.65, { color: th.muted, size: 10 });
  d.text("anéis no plano focal da lente", C.x, C.y + C.r + 0.35, { color: th.muted, size: 10 });
  // esquema
  const y = 4.9;
  d.text("fonte extensa → difusor → etalon (R, d) → lente f → anteparo", 0.3, 6.1, { color: th.muted, size: 10, align: "left" });
  d.rect(0.4, y - 0.4, 1.2, 0.8, { fill: rgb(col, 1), alpha: 0.8 });
  d.rect(3.0, y - 0.7, 0.18, 1.4, { fill: th.muted });
  d.rect(3.0 + 0.6, y - 0.7, 0.18, 1.4, { fill: th.muted });
  d.text("d", 3.48, y + 0.95, { size: 11 });
  d.line(1.6, y, 3.0, y, { color: rgb(col, 1), width: 2 });
  for (let k = 0; k < 4; k++) d.line(3.18, y - 0.45 + 0.06 * k, 3.6, y - 0.45 + 0.06 * (k + 1), { color: rgb(col, 1), width: 1, alpha: 1 - 0.2 * k });
  d.line(3.78, y, 6.6, y, { color: rgb(col, 1), width: 2 });
  d.polyline([[6.6, y - 0.8], [6.75, y], [6.6, y + 0.8], [6.45, y]], { close: true, fill: th.dark ? "rgba(150,200,240,0.4)" : "rgba(90,150,210,0.35)", color: th.text, width: 1 });
  d.line(6.75, y, 8.2, y, { color: rgb(col, 1), width: 2 });
  d.rect(8.2, y - 0.8, 0.12, 1.6, { fill: th.text });
  // função de Airy
  const gx0 = 10.6;
  const gx1 = 19.6;
  const gy0 = 1.3;
  const gy1 = 5.4;
  frame(d, gx0, gx1, gy0, gy1, "fase de ida e volta δ/2π", "transmissão T");
  const dx = (x: number) => -0.5 + ((x - gx0) / (gx1 - gx0)) * 3;
  d.plot((x) => gy0 + (gy1 - gy0) * airy(2 * Math.PI * dx(x), 0.3), gx0, gx1, { color: th.muted, width: 1, dash: [3, 3], n: 400 });
  d.plot((x) => gy0 + (gy1 - gy0) * airy(2 * Math.PI * dx(x), R), gx0, gx1, { color: th.accent, width: 2, n: 600 });
  const d0 = fpPhase(fpGap(s, p), src.lines[0]! * 1e-9, 1) / (2 * Math.PI);
  const frac = d0 - Math.floor(d0);
  const xc = gx0 + ((frac + 0.5) / 3) * (gx1 - gx0);
  d.dot(xc, gy0 + (gy1 - gy0) * airy(2 * Math.PI * frac, R), 5, th.positive);
  d.text(`R = ${fmt(R, 2)}`, gx1 - 0.1, gy1 - 0.3, { color: th.accent, size: 11, align: "right", weight: "600" });
  d.text("R = 0,30", gx1 - 0.1, gy1 - 0.75, { color: th.muted, size: 10, align: "right" });
  // perfil radial
  const py0 = -7.6;
  const py1 = -3.2;
  frame(d, gx0, gx1, py0, py1, `raio no anteparo r (0 a ${fmt(rMax * 1e3, 1)} mm)`, "intensidade I(r)");
  d.plot(
    (x) => {
      const rr = ((x - gx0) / (gx1 - gx0)) * rMax;
      return py0 + (py1 - py0) * fpIntensity(s, p, Math.cos(Math.atan(rr / f)));
    },
    gx0,
    gx1,
    { color: rgb(col, th.dark ? 1 : 0.75), width: 1.6, n: 900 },
  );
  // informações
  const d1 = num(p, "dmm", 2) * 1e-3;
  const l = src.lines[0]! * 1e-9;
  const F = finesse(R);
  const info = [
    `finesse 𝓕 = ${fmt(F, 1)}   ·   FSR = ${fmt(fsrHz(d1) / 1e9, 2)} GHz = ${fmt(fsrLambda(d1, l) * 1e12, 1)} pm`,
    `largura de linha = FSR/𝓕 = ${fmt(fsrLambda(d1, l) * 1e12 / F, 2)} pm   ·   ordem central m = ${fmt((2 * fpGap(s, p)) / l, 2)}`,
    `piezo: ${fmt(s.dfp, 1)} nm   ·   T no centro = ${fmt(fpIntensity(s, p, 1), 3)}`,
  ];
  info.forEach((t, i) => d.text(t, gx0, 0.5 - 0.5 * i, { size: 11, align: "left" }));
}

// ------------------------------------------------------------------ desenho: micro-ondas
function horn(d: Draw, x: number, y: number, dir: [number, number], label: string) {
  const th = d.theme;
  const [ux, uy] = dir;
  const nx = -uy;
  const ny = ux;
  const back = 9;
  d.polyline(
    [
      [x - ux * back + nx * 3, y - uy * back + ny * 3],
      [x - ux * 4 + nx * 3, y - uy * 4 + ny * 3],
      [x + nx * 5, y + ny * 5],
      [x - nx * 5, y - ny * 5],
      [x - ux * 4 - nx * 3, y - uy * 4 - ny * 3],
      [x - ux * back - nx * 3, y - uy * back - ny * 3],
    ],
    { close: true, fill: th.dark ? "#4a5262" : "#8a93a3", color: th.text, width: 1 },
  );
  d.text(label, x - ux * 6 + nx * 7.5, y - uy * 6 + ny * 7.5, { size: 11, weight: "600" });
}

function crests(d: Draw, x0: number, y0: number, x1: number, y1: number, lam: number, t: number, color: string) {
  const L = Math.hypot(x1 - x0, y1 - y0);
  const ux = (x1 - x0) / L;
  const uy = (y1 - y0) / L;
  const off = (t * 3) % lam;
  for (let s = off; s < L; s += lam) {
    const x = x0 + ux * s;
    const y = y0 + uy * s;
    d.line(x - uy * 3, y + ux * 3, x + uy * 3, y - ux * 3, { color, width: 1.2, alpha: 0.55 });
  }
}

function drawMWGraph(d: Draw, s: IntState, p: Params, trail: IntState[]) {
  const th = d.theme;
  const m = modo(p);
  const x0 = 6;
  const x1 = 60;
  const y0 = -58;
  const y1 = -40;
  const [a, b] = m === FP_MO ? [3, 52] : [10, 56];
  frame(d, x0, x1, y0, y1, m === FP_MO ? "separação d (cm)" : "posição do refletor móvel x (cm)", "leitura (mA)");
  for (let v = Math.ceil(a / 10) * 10; v <= b; v += 10) d.text(`${v}`, x0 + ((x1 - x0) * (v - a)) / (b - a), y0 - 1.6, { color: th.muted, size: 9 });
  const top = num(p, "I0", 1) * 1.08;
  const gx = (v: number) => x0 + ((x1 - x0) * (v - a)) / (b - a);
  const gy = (v: number) => y0 + ((y1 - y0) * v) / top;
  const at = (v: number): IntState => (m === FP_MO ? { ...s, dMW: v } : { ...s, xB: v });
  if (Math.round(num(p, "curva", 1)) === 1) d.plot((x) => gy(mwReading(at(a + ((x - x0) / (x1 - x0)) * (b - a)), p)), x0, x1, { color: th.muted, dash: [5, 4], n: 600 });
  for (const q of trail) d.dot(gx(mwPos(q, p)), gy(mwReading(q, p)), 2.5, th.series[0]!, 0.8);
  d.dot(gx(mwPos(s, p)), gy(mwReading(s, p)), 5, th.accent);
  d.line(gx(s.marca), y0, gx(s.marca), y1, { color: th.positive, width: 1, dash: [3, 3] });
  // medidor
  const mx0 = 66;
  const mx1 = 95;
  const my0 = -56;
  const my1 = -42;
  const V = mwReading(s, p);
  d.rect(mx0, my0, mx1 - mx0, my1 - my0, { fill: th.dark ? "#14181e" : "#f1efe6", stroke: th.text, width: 1.5 });
  const cx = (mx0 + mx1) / 2;
  const cy = my0 + 2;
  const rr = 10;
  for (let k = 0; k <= 10; k++) {
    const ang = Math.PI * (0.85 - 0.7 * (k / 10));
    d.line(cx + rr * Math.cos(ang), cy + rr * Math.sin(ang), cx + (rr + (k % 5 === 0 ? 1.6 : 0.9)) * Math.cos(ang), cy + (rr + (k % 5 === 0 ? 1.6 : 0.9)) * Math.sin(ang), { width: 1 });
    if (k % 5 === 0) d.text(fmt((num(p, "I0", 1) * k) / 10, 1), cx + (rr + 3) * Math.cos(ang), cy + (rr + 3) * Math.sin(ang), { size: 9, color: th.muted });
  }
  const ang = Math.PI * (0.85 - 0.7 * Math.min(1.05, V / num(p, "I0", 1)));
  d.line(cx, cy, cx + (rr + 1) * Math.cos(ang), cy + (rr + 1) * Math.sin(ang), { color: th.positive, width: 2 });
  d.text(`${fmt(V, 3)} mA`, cx, my0 + 0.9 + 0.1, { size: 12, weight: "700" });
  d.text("receptor (diodo detector)", cx, my1 + 1.4, { color: th.muted, size: 10 });
}

function drawMichelsonMW(d: Draw, s: IntState, p: Params, t: number) {
  const th = d.theme;
  const lam = num(p, "lamMW", 2.85);
  const beam = th.dark ? "rgba(240,160,90,0.8)" : "rgba(220,110,40,0.8)";
  // mesa e régua
  d.rect(46, -11, 50, 3, { fill: th.dark ? "#3a4048" : "#e3e6ea", stroke: th.muted, width: 1 });
  for (let v = 6; v <= 56; v++) {
    const x = BS.x + v;
    d.line(x, -8, x, v % 5 === 0 ? -9.6 : -8.8, { color: th.text, width: v % 10 === 0 ? 1.2 : 0.6 });
    if (v % 10 === 0) d.text(`${v}`, x, -10.6, { color: th.muted, size: 9 });
  }
  d.text("régua: distância ao divisor (cm)", 71, -13.5, { color: th.muted, size: 10 });
  horn(d, 14, 0, [1, 0], `transmissor λ = ${fmt(lam, 2)} cm`);
  // feixes
  d.line(14, 0, BS.x, 0, { color: beam, width: 3 });
  d.line(BS.x, 0, BS.x, LA, { color: beam, width: 3, alpha: 0.7 });
  d.line(BS.x, 0, BS.x + s.xB, 0, { color: beam, width: 3, alpha: 0.7 });
  d.line(BS.x, 0, BS.x, -20, { color: beam, width: 3, alpha: 0.7 });
  crests(d, 14, 0, BS.x - 1, 0, lam, t, beam);
  // placa dielétrica
  const tp = num(p, "tp", 0);
  if (tp > 0) {
    d.rect(BS.x + 6, -7, tp, 14, { fill: th.dark ? "rgba(200,220,160,0.45)" : "rgba(150,180,90,0.45)", stroke: th.text, width: 1 });
    d.text(`placa n = ${fmt(num(p, "np", 1.6), 2)}`, BS.x + 6 + tp / 2, 8.6, { color: th.muted, size: 10 });
  }
  // divisor de feixe
  d.line(BS.x - 6, -6, BS.x + 6, 6, { color: th.dark ? "#9cc8e8" : "#4a86b8", width: 4 });
  d.text("divisor (placa de vidro)", BS.x - 15, 8, { color: th.muted, size: 10 });
  // refletor fixo A
  d.rect(BS.x - 7, LA, 14, 1.2, { fill: th.text });
  d.text(`refletor fixo (${LA} cm)`, BS.x + 9, LA + 0.6, { size: 11, align: "left" });
  // refletor móvel B
  const xb = BS.x + s.xB;
  d.rect(xb, -7, 1.2, 14, { fill: th.accent, stroke: th.text, width: 1 });
  d.text(`refletor móvel: ${fmt(s.xB, 2)} cm (arraste)`, xb, 9.5, { color: th.accent, size: 11, weight: "600" });
  horn(d, BS.x, -20, [0, 1], "receptor");
  d.text(`Δx desde a marca: ${fmt(s.xB - s.marca, 2)} cm`, 2, 28, { size: 12, weight: "600", align: "left" });
  d.text("conte os máximos: λ = 2Δx/N", 2, 24, { color: th.muted, size: 11, align: "left" });
}

function drawFPMW(d: Draw, s: IntState, p: Params, t: number) {
  const th = d.theme;
  const lam = num(p, "lamMW", 2.85);
  const beam = th.dark ? "rgba(240,160,90,0.8)" : "rgba(220,110,40,0.8)";
  const x2 = P1X + s.dMW;
  d.rect(P1X - 2, -11, 60, 3, { fill: th.dark ? "#3a4048" : "#e3e6ea", stroke: th.muted, width: 1 });
  for (let v = 0; v <= 56; v++) {
    const x = P1X + v;
    d.line(x, -8, x, v % 5 === 0 ? -9.6 : -8.8, { color: th.text, width: v % 10 === 0 ? 1.2 : 0.6 });
    if (v % 10 === 0) d.text(`${v}`, x, -10.6, { color: th.muted, size: 9 });
  }
  d.text("régua: separação entre as placas (cm)", P1X + 28, -13.5, { color: th.muted, size: 10 });
  horn(d, 14, 0, [1, 0], `transmissor λ = ${fmt(lam, 2)} cm`);
  horn(d, 90, 0, [-1, 0], "receptor");
  const T = fpTransmission(s.dMW, lam, num(p, "rMW", 0.6));
  d.line(14, 0, P1X, 0, { color: beam, width: 3 });
  d.line(P1X, 0, x2, 0, { color: beam, width: 5, alpha: 0.35 + 0.4 * Math.min(1, T * 2) });
  d.line(x2, 0, 90, 0, { color: beam, width: 1 + 3 * T, alpha: 0.2 + 0.7 * T });
  crests(d, 14, 0, P1X - 0.5, 0, lam, t, beam);
  const mesh = (x: number, active: boolean) => {
    d.rect(x - 0.6, -9, 1.2, 18, { fill: th.dark ? "rgba(200,200,210,0.35)" : "rgba(90,100,120,0.3)", stroke: active ? th.accent : th.text, width: active ? 2 : 1 });
    for (let yy = -8; yy <= 8; yy += 2) d.line(x - 0.6, yy, x + 0.6, yy, { color: th.muted, width: 0.6 });
  };
  mesh(P1X, false);
  mesh(x2, true);
  d.text("placa fixa", P1X, 11, { size: 11 });
  d.text(`placa móvel: d = ${fmt(s.dMW, 2)} cm (arraste)`, x2, 14, { color: th.accent, size: 11, weight: "600" });
  d.text(`R das placas = ${fmt(num(p, "rMW", 0.6), 2)} · máximos a cada λ/2 = ${fmt(lam / 2, 3)} cm`, 2, 28, { size: 12, weight: "600", align: "left" });
  d.text(`Δd desde a marca: ${fmt(s.dMW - s.marca, 2)} cm  ·  λ = 2Δd/N`, 2, 24, { color: th.muted, size: 11, align: "left" });
}

// ------------------------------------------------------------------ desenho: Michelson–Morley
const MMC = { x: 4.8, y: 0.0, arm: 3.4 };

function drawMM(d: Draw, s: IntState, p: Params, trail: IntState[]) {
  const th = d.theme;
  const a = (s.alpha * Math.PI) / 180;
  const u1: [number, number] = [Math.cos(a), Math.sin(a)];
  const u2: [number, number] = [-Math.sin(a), Math.cos(a)];
  const C = MMC;
  const P = (k1: number, k2: number): [number, number] => [C.x + k1 * u1[0] + k2 * u2[0], C.y + k1 * u1[1] + k2 * u2[1]];
  const ether = Math.round(num(p, "hip")) === 1;
  // tanque de mercúrio e laje de pedra
  d.circle(C.x, C.y, 4.6, { fill: th.dark ? "rgba(170,180,190,0.15)" : "rgba(150,160,170,0.2)", stroke: th.muted, width: 1 });
  const corners = [P(-3.9, -3.9), P(3.9, -3.9), P(3.9, 3.9), P(-3.9, 3.9)];
  d.polyline(corners, { close: true, fill: th.dark ? "rgba(140,120,100,0.3)" : "rgba(160,140,110,0.3)", color: th.text, width: 1 });
  const beam = "#f2c94c";
  const src = P(-C.arm, 0);
  const m1 = P(C.arm, 0);
  const m2 = P(0, C.arm);
  const tel = P(0, -C.arm);
  d.line(src[0], src[1], m1[0], m1[1], { color: beam, width: 2 });
  d.line(C.x, C.y, m2[0], m2[1], { color: beam, width: 2 });
  d.line(C.x, C.y, tel[0], tel[1], { color: beam, width: 2 });
  d.circle(src[0], src[1], 0, { minPx: 7, fill: beam, stroke: th.text, width: 1 });
  const bsA = P(-0.5, -0.5);
  const bsB = P(0.5, 0.5);
  d.line(bsA[0], bsA[1], bsB[0], bsB[1], { color: th.dark ? "#9cc8e8" : "#4a86b8", width: 3 });
  for (const [m, w] of [[m1, u2], [m2, u1]] as const) d.line(m[0] - 0.5 * w[0], m[1] - 0.5 * w[1], m[0] + 0.5 * w[0], m[1] + 0.5 * w[1], { color: th.text, width: 4 });
  d.circle(tel[0], tel[1], 0, { minPx: 6, fill: th.muted, stroke: th.text, width: 1 });
  d.circle(m1[0], m1[1], 0, { minPx: 8, stroke: th.accent, width: 2 });
  d.text("gire (arraste)", m1[0], m1[1] + 0.55, { color: th.accent, size: 10 });
  d.text(`α = ${fmt(((s.alpha % 360) + 360) % 360, 1)}°`, C.x, -5.2, { size: 12, weight: "600" });
  // vento de éter (hipótese)
  const v = num(p, "v", 30);
  d.arrow(0.3, 5.6, 2.6, 0, { color: ether ? th.negative : th.muted, width: 2 });
  d.text(ether ? `vento de éter v = ${fmt(v, 0)} km/s` : `Terra: v = ${fmt(v, 0)} km/s (órbita)`, 3.2, 5.6, { color: ether ? th.negative : th.muted, size: 11, align: "left" });
  // franjas na ocular
  const F = { x: 13.4, y: 2.7, r: 2.2 };
  const Nobs = mmObserved(s, p);
  const L = Math.max(0.15, 0.9);
  d.ctx.save();
  d.ctx.beginPath();
  d.ctx.arc(F.x, F.y, F.r, 0, 2 * Math.PI);
  d.ctx.clip();
  d.rect(F.x - F.r, F.y - F.r, 2 * F.r, 2 * F.r, { fill: "#000" });
  const n = 120;
  for (let i = 0; i < n; i++) {
    const x = F.x - F.r + ((i + 0.5) * 2 * F.r) / n;
    const I = Math.cos(Math.PI * ((x - F.x) / L - Nobs)) ** 2;
    d.rect(x - F.r / n, F.y - F.r, (2 * F.r) / n + 0.01, 2 * F.r, { fill: rgb([1, 0.85, 0.3], I) });
  }
  d.ctx.restore();
  d.line(F.x, F.y - F.r, F.x, F.y + F.r, { color: th.positive, width: 1 });
  d.circle(F.x, F.y, F.r, { stroke: th.text, width: 1.5 });
  d.text("franjas na luneta (fio de referência)", F.x, F.y + F.r + 0.35, { color: th.muted, size: 10 });
  // gráfico deslocamento × α
  const x0 = 10;
  const x1 = 19.6;
  const y0 = -7.6;
  const y1 = -1.4;
  frame(d, x0, x1, y0, y1, "orientação α (0 a 360°)", "deslocamento de franjas N");
  const amp = Math.max(0.05, Math.abs(etherShift(num(p, "Lmm", 11), v * 1e3, num(p, "lamMM", 550) * 1e-9, 0))) * 1.2;
  const gx = (al: number) => x0 + ((x1 - x0) * (((al % 360) + 360) % 360)) / 360;
  const gy = (N: number) => (y0 + y1) / 2 + ((y1 - y0) / 2) * (N / amp);
  d.line(x0, gy(0), x1, gy(0), { color: th.grid, width: 1 });
  d.plot((x) => gy(etherShift(num(p, "Lmm", 11), v * 1e3, num(p, "lamMM", 550) * 1e-9, ((x - x0) / (x1 - x0)) * 360)), x0, x1, { color: th.negative, dash: [5, 4] });
  for (const q of trail) d.dot(gx(q.alpha), gy(mmObserved(q, p)), 2.5, th.series[0]!, 0.8);
  d.dot(gx(s.alpha), gy(Nobs), 5, th.accent);
  d.text(`±${fmt(amp / 1.2, 3)}`, x0 - 0.1, gy(amp / 1.2), { color: th.muted, size: 9, align: "right" });
  d.text("tracejado: previsão do éter · pontos: observado", (x0 + x1) / 2, y1 - 0.3, { color: th.muted, size: 9 });
  const tot = 2 * etherShift(num(p, "Lmm", 11), v * 1e3, num(p, "lamMM", 550) * 1e-9, 0);
  d.text(`variação prevista de 0° a 90°: ${fmt(tot, 3)} franja`, 10, 0.2, { size: 11, align: "left" });
  d.text(`observado agora: ${fmt(Nobs, 3)} franja`, 10, -0.35, { size: 11, align: "left", color: ether ? th.negative : th.text });
}

// ------------------------------------------------------------------ desenho: cavidade
const CAV = { x1: 1.4, x2: 10.6, y: 2.2, h: 2.6 };
const DIAG = { x: 15.9, y: 1.3, k: 1.55 };

function drawCavity(d: Draw, s: IntState, p: Params) {
  const th = d.theme;
  const L = Lcav(p);
  const m = modeOf(s, p);
  const col = num(p, "lamC", 1064) < 700 ? "#e0322c" : "#c040d0";
  const Lx = CAV.x2 - CAV.x1;
  // envelope do modo gaussiano
  if (m.stable) {
    const wmax = Math.max(m.w1, m.w2, m.w0);
    const k = (CAV.h * 0.85) / wmax;
    const up: [number, number][] = [];
    const dn: [number, number][] = [];
    for (let i = 0; i <= 120; i++) {
      const x = CAV.x1 + (Lx * i) / 120;
      const z = -m.z1 + (L * i) / 120;
      const w = beamRadius(m.w0, m.zR, z) * k;
      up.push([x, CAV.y + w]);
      dn.push([x, CAV.y - w]);
    }
    d.polyline([...up, ...dn.reverse()], { close: true, fill: col, alpha: 0.25, color: "none" });
    d.polyline(up, { color: col, width: 1.8 });
    d.polyline(dn.reverse(), { color: col, width: 1.8 });
    const xw = CAV.x1 + (m.z1 / L) * Lx;
    if (xw >= CAV.x1 - 1e-9 && xw <= CAV.x2 + 1e-9) {
      d.line(xw, CAV.y - m.w0 * k, xw, CAV.y + m.w0 * k, { color: th.text, width: 1, dash: [3, 2] });
      d.text("cintura w₀", xw, CAV.y - m.w0 * k - 0.35, { size: 10 });
      const xr = [xw - (m.zR / L) * Lx, xw + (m.zR / L) * Lx].filter((x) => x > CAV.x1 && x < CAV.x2);
      for (const x of xr) d.line(x, CAV.y - CAV.h, x, CAV.y + CAV.h, { color: th.muted, width: 1, dash: [2, 3] });
      if (xr.length) d.text("±z_R", xr[0]!, CAV.y + CAV.h + 0.3, { color: th.muted, size: 10 });
    }
  } else {
    d.text("cavidade INSTÁVEL: não existe modo gaussiano confinado", (CAV.x1 + CAV.x2) / 2, CAV.y + 0.4, { color: th.negative, size: 12, weight: "600" });
  }
  d.line(CAV.x1, CAV.y, CAV.x2, CAV.y, { color: th.grid, width: 1, dash: [6, 4] });
  // espelhos (curvatura exagerada só para indicar côncavo/convexo)
  const mirror = (x: number, g: number, side: 1 | -1) => {
    const R = radiusFromG(g, L);
    const sag = Number.isFinite(R) ? 0.45 * Math.sign(R) * Math.min(1, Math.sqrt(L / Math.abs(R))) : 0;
    const pts: [number, number][] = [];
    for (let i = 0; i <= 30; i++) {
      const yy = -CAV.h + (2 * CAV.h * i) / 30;
      pts.push([x - side * sag * (yy / CAV.h) ** 2, CAV.y + yy]);
    }
    d.polyline(pts, { color: th.text, width: 4 });
    const lbl = Number.isFinite(R) ? `R = ${fmt(R * 100, 1)} cm` : "R = ∞ (plano)";
    d.text(lbl, x, CAV.y - CAV.h - 0.4, { size: 11, weight: "600" });
  };
  mirror(CAV.x1, s.g1, -1);
  mirror(CAV.x2, s.g2, 1);
  d.text(`L = ${fmt(L * 100, 1)} cm · eixo vertical ampliado`, (CAV.x1 + CAV.x2) / 2, CAV.y + CAV.h + 0.85, { color: th.muted, size: 10 });
  // traçado de raios
  const ry0 = -6.9;
  const ry1 = -2.7;
  const yc = (ry0 + ry1) / 2;
  const ap = 1;
  const ys = traceRay(s.g1, s.g2, L, 0.35 * ap, 0.002, 60, ap);
  d.rect(CAV.x1, ry0, Lx, ry1 - ry0, { stroke: th.grid, width: 1 });
  const sc = (ry1 - ry0) / 2 / ap;
  for (let i = 1; i < ys.length; i++) {
    const xa = i % 2 === 1 ? CAV.x1 : CAV.x2;
    const xb = i % 2 === 1 ? CAV.x2 : CAV.x1;
    const ya = Math.max(-ap, Math.min(ap, ys[i - 1]!));
    const yb = Math.max(-ap, Math.min(ap, ys[i]!));
    d.line(xa, yc + ya * sc, xb, yc + yb * sc, { color: th.accent, width: 1, alpha: Math.max(0.15, 1 - i / 70) });
  }
  const escaped = ys.length < 61;
  d.text(escaped ? `raio escapa após ${ys.length - 1} reflexões` : "raio paraxial confinado (60 reflexões)", (CAV.x1 + CAV.x2) / 2, ry0 - 0.35, { color: escaped ? th.negative : th.muted, size: 10 });
  // diagrama de estabilidade
  const { x: cx, y: cy, k } = DIAG;
  const G = (g1: number, g2: number): [number, number] => [cx + g1 * k, cy + g2 * k];
  const reg = (sgn: number) => {
    const pts: [number, number][] = [G(0, 0), G(0, 2 * sgn)];
    for (let i = 0; i <= 30; i++) {
      const g1 = 0.5 + (1.5 * i) / 30;
      pts.push(G(sgn * g1, sgn / g1));
    }
    pts.push(G(2 * sgn, 0));
    d.polyline(pts, { close: true, fill: th.dark ? "rgba(60,195,148,0.2)" : "rgba(25,169,121,0.18)", color: "none" });
  };
  reg(1);
  reg(-1);
  d.rect(cx - 2 * k, cy - 2 * k, 4 * k, 4 * k, { stroke: th.grid, width: 1 });
  d.line(cx - 2 * k, cy, cx + 2 * k, cy, { color: th.muted, width: 1 });
  d.line(cx, cy - 2 * k, cx, cy + 2 * k, { color: th.muted, width: 1 });
  d.plot((x) => cy + k / ((x - cx) / k), cx + 0.5 * k, cx + 2 * k, { color: th.series[2]!, width: 1.2 });
  d.plot((x) => cy + k / ((x - cx) / k), cx - 2 * k, cx - 0.5 * k, { color: th.series[2]!, width: 1.2 });
  d.text("g₁", cx + 2 * k + 0.3, cy, { color: th.muted, size: 11 });
  d.text("g₂", cx, cy + 2 * k + 0.3, { color: th.muted, size: 11 });
  for (const [g1, g2, l] of [[1, 1, "plano"], [0, 0, "confocal"], [-1, -1, "concêntrico"]] as const) {
    d.dot(...G(g1, g2), 3, th.muted);
    d.text(l, G(g1, g2)[0] + 0.15, G(g1, g2)[1] + 0.3, { color: th.muted, size: 9, align: "left" });
  }
  const pt = G(s.g1, s.g2);
  d.circle(pt[0], pt[1], 0, { minPx: 7, fill: m.stable ? th.accent : th.negative, stroke: th.text, width: 1.5 });
  d.text("0 < g₁g₂ < 1: estável (arraste o ponto)", cx, cy - 2 * k - 0.4, { color: th.muted, size: 10 });
  // dados
  const info = [
    `g₁ = ${fmt(s.g1, 3)}  g₂ = ${fmt(s.g2, 3)}  g₁g₂ = ${fmt(s.g1 * s.g2, 3)}`,
    m.stable ? `w₀ = ${fmt(m.w0 * 1e3, 3)} mm   z_R = ${fmt(m.zR * 100, 2)} cm` : "sem modo estável",
    m.stable ? `w(espelho 1) = ${fmt(m.w1 * 1e3, 3)} mm   w(espelho 2) = ${fmt(m.w2 * 1e3, 3)} mm` : "",
    `FSR = c/2L = ${fmt(cavityFSR(L) / 1e6, 1)} MHz   Δν_transv = ${fmt(transverseSpacing(s.g1, s.g2, L) / 1e6, 1)} MHz`,
  ];
  info.forEach((t, i) => d.text(t, 12.2, -4.6 - 0.55 * i, { size: 11, align: "left" }));
}

// ------------------------------------------------------------------ interação
const dist = (x: number, y: number, pt: { x: number; y: number }) => Math.hypot(x - pt.x, y - pt.y);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const r2 = (v: number) => Math.round(v * 100) / 100;

function mmAngle(pt: { x: number; y: number }) {
  return ((Math.atan2(pt.y - MMC.y, pt.x - MMC.x) * 180) / Math.PI + 360) % 360;
}

function gFrom(pt: { x: number; y: number }): [number, number] {
  return [r2(clamp((pt.x - DIAG.x) / DIAG.k, -2, 2)), r2(clamp((pt.y - DIAG.y) / DIAG.k, -2, 2))];
}

export const interferometros = defineSim<IntState>({
  id: "interferometros",
  title: "Interferômetros: Fabry–Perot, micro-ondas e cavidades",
  course: "FG IV",
  topic: "Ótica",
  priority: "P2",
  summary:
    "Fabry–Perot com anéis e função de Airy (finesse × refletividade, resolução do dubleto do sódio), Michelson e Fabry–Perot de micro-ondas com refletor arrastável e contagem de máximos, Michelson–Morley girando o aparelho (éter × resultado nulo) e cavidade ótica com modo gaussiano, diagrama de estabilidade e traçado de raios.",
  equations: [
    String.raw`T = \frac{1}{1 + F\,\text{sen}^2(\delta/2)},\quad F = \frac{4R}{(1-R)^2},\quad \delta = \frac{4\pi n d\cos\theta}{\lambda},\quad \mathcal{F} = \frac{\pi\sqrt{R}}{1-R}`,
    String.raw`\text{micro-ondas: } I \propto a_1^2 + a_2^2 + 2a_1a_2\cos\frac{2\pi\,\Delta}{\lambda},\quad \Delta = 2(x - L_A) \ \Rightarrow\ \lambda = \frac{2\,\Delta x}{N}`,
    String.raw`\text{Michelson–Morley: } \Delta N = \frac{2 L v^2}{\lambda c^2}`,
    String.raw`g_i = 1 - \frac{L}{R_i},\ 0 < g_1 g_2 < 1,\quad w(z) = w_0\sqrt{1 + (z/z_R)^2},\quad z_R^2 = \frac{L^2 g_1 g_2 (1 - g_1 g_2)}{(g_1 + g_2 - 2g_1g_2)^2},\quad w_0^2 = \frac{\lambda z_R}{\pi}`,
  ],
  liveEquations(s, p) {
    const m = modo(p);
    if (m === FP_OTICO) {
      const R = num(p, "R", 0.85);
      const d = num(p, "dmm", 2) * 1e-3;
      return [
        String.raw`\mathcal{F} = \frac{\pi\sqrt{${texNum(R)}}}{1 - ${texNum(R)}} = ${texNum(finesse(R), 4)} \qquad F = ${texNum(4 * R / (1 - R) ** 2, 4)}`,
        String.raw`\Delta\nu_{\text{FSR}} = \frac{c}{2d} = ${texNum(fsrHz(d) / 1e9, 4)}\ \text{GHz} \qquad \Delta\lambda_{\text{FSR}} = ${texNum(fsrLambda(d, sourceOf(p).lines[0]! * 1e-9) * 1e12, 4)}\ \text{pm}`,
      ];
    }
    if (m === MICHELSON_MO || m === FP_MO) {
      const lam = num(p, "lamMW", 2.85);
      const pos = mwPos(s, p);
      return [
        String.raw`x = ${texNum(pos, 4)}\ \text{cm},\ \Delta x = ${texNum(pos - s.marca, 3)}\ \text{cm} \qquad \text{leitura} = ${texNum(mwReading(s, p), 3)}\ \text{mA}`,
        m === FP_MO
          ? String.raw`T = \frac{(1-R)^2}{(1-R)^2 + 4R\,\text{sen}^2(2\pi d/\lambda)} = ${texNum(fpMWReading(s, p) / num(p, "I0", 1), 3)} \qquad \frac{\lambda}{2} = ${texNum(lam / 2, 4)}\ \text{cm}`
          : String.raw`\Delta = 2(${texNum(s.xB, 4)} - ${LA})\ \text{cm} + 2(n-1)t = ${texNum(2 * (s.xB - LA) + 2 * (num(p, "np", 1.6) - 1) * num(p, "tp", 0), 4)}\ \text{cm} = ${texNum((2 * (s.xB - LA) + 2 * (num(p, "np", 1.6) - 1) * num(p, "tp", 0)) / lam, 4)}\,\lambda`,
      ];
    }
    if (m === MM) {
      const L = num(p, "Lmm", 11);
      const v = num(p, "v", 30) * 1e3;
      const l = num(p, "lamMM", 550) * 1e-9;
      return [
        String.raw`\Delta N_{\text{éter}} = \frac{2 \cdot ${texNum(L)}\,\text{m}\,(${texNum(v)}\,\text{m/s})^2}{${texNum(l)}\,\text{m}\,(${texNum(C_LIGHT)}\,\text{m/s})^2} = ${texNum((2 * L * v * v) / (l * C_LIGHT * C_LIGHT), 3)}`,
        String.raw`\alpha = ${texNum(s.alpha, 4)}^\circ:\ N_{\text{previsto}} = ${texNum(mmPredicted(s, p), 3)},\ N_{\text{observado}} = ${texNum(mmObserved(s, p), 3)}`,
      ];
    }
    const md = modeOf(s, p);
    const L = Lcav(p);
    return [
      String.raw`g_1 g_2 = ${texNum(s.g1)}\times${texNum(s.g2)} = ${texNum(s.g1 * s.g2, 3)}\ (${md.stable ? "\\text{estável}" : "\\text{instável}"})`,
      md.stable ? String.raw`z_R = ${texNum(md.zR * 100, 4)}\ \text{cm},\quad w_0 = \sqrt{\lambda z_R/\pi} = ${texNum(md.w0 * 1e3, 4)}\ \text{mm}` : String.raw`\text{sem modo gaussiano}`,
      String.raw`\Delta\nu_{\text{FSR}} = \frac{c}{2L} = ${texNum(cavityFSR(L) / 1e6, 4)}\ \text{MHz}`,
    ];
  },

  params: [
    {
      key: "modo",
      label: "Interferômetro",
      unit: "",
      min: 0,
      max: 4,
      step: 1,
      default: 0,
      options: [
        { value: FP_OTICO, label: "Fabry–Perot ótico (anéis)" },
        { value: MICHELSON_MO, label: "Michelson de micro-ondas" },
        { value: FP_MO, label: "Fabry–Perot de micro-ondas" },
        { value: MM, label: "Michelson–Morley (éter)" },
        { value: CAVIDADE, label: "Cavidade ótica e feixe gaussiano" },
      ],
    },
    { key: "R", label: "Refletância dos espelhos R", unit: "", min: 0.1, max: 0.99, step: 0.01, default: 0.85, live: true },
    { key: "dmm", label: "Separação do etalon d", unit: "mm", min: 0.1, max: 10, step: 0.05, default: 2, live: true },
    { key: "fonte", label: "Fonte (Fabry–Perot)", unit: "", min: 0, max: 2, step: 1, default: 0, live: true, options: SOURCES.map((s, i) => ({ value: i, label: s.label })) },
    { key: "fmm", label: "Distância focal da lente f", unit: "mm", min: 50, max: 500, step: 10, default: 200, live: true },
    { key: "piezo", label: "Velocidade do piezo", unit: "nm/s", min: -100, max: 100, step: 1, default: 20, live: true },
    { key: "lamMW", label: "Comprimento de onda das micro-ondas", unit: "cm", min: 2.5, max: 3.5, step: 0.01, default: 2.85 },
    { key: "rMW", label: "Refletância das placas (Fabry–Perot de micro-ondas)", unit: "", min: 0.2, max: 0.9, step: 0.01, default: 0.6, live: true },
    { key: "tp", label: "Placa dielétrica no braço móvel (espessura)", unit: "cm", min: 0, max: 4, step: 0.1, default: 0, live: true },
    { key: "np", label: "Índice da placa dielétrica", unit: "", min: 1, max: 3, step: 0.01, default: 1.6, live: true },
    { key: "I0", label: "Fundo de escala do receptor", unit: "mA", min: 0.1, max: 1, step: 0.05, default: 1, live: true },
    { key: "x0", label: "Posição inicial do refletor/placa móvel", unit: "cm", min: 10, max: 50, step: 0.1, default: 25 },
    { key: "Lmm", label: "Comprimento efetivo dos braços (Michelson–Morley)", unit: "m", min: 1, max: 15, step: 0.5, default: 11, live: true },
    { key: "lamMM", label: "Comprimento de onda (Michelson–Morley)", unit: "nm", min: 400, max: 700, step: 5, default: 550, live: true },
    { key: "v", label: "Velocidade em relação ao éter v", unit: "km/s", min: 0, max: 60, step: 1, default: 30, live: true },
    {
      key: "hip",
      label: "O que a natureza faz",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 0,
      live: true,
      options: [
        { value: 0, label: "Resultado real (nulo)" },
        { value: 1, label: "Se existisse o éter" },
      ],
    },
    { key: "omega", label: "Rotação do aparelho", unit: "°/s", min: 0, max: 30, step: 0.5, default: 6, live: true },
    { key: "Lc", label: "Comprimento da cavidade L", unit: "cm", min: 5, max: 100, step: 1, default: 30, live: true },
    {
      key: "lamC",
      label: "Laser na cavidade",
      unit: "nm",
      min: 633,
      max: 1064,
      step: 1,
      default: 1064,
      live: true,
      options: [
        { value: 1064, label: "Nd:YAG 1064 nm" },
        { value: 633, label: "He-Ne 633 nm" },
      ],
    },
    { key: "g1i", label: "g₁ inicial", unit: "", min: -2, max: 2, step: 0.01, default: 0.5 },
    { key: "g2i", label: "g₂ inicial", unit: "", min: -2, max: 2, step: 0.01, default: 0.5 },
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
    { key: "Ic", label: "Transmissão no centro dos anéis", unit: "", value: (s, p) => fpIntensity(s, p, 1) },
    { key: "dfp", label: "Deslocamento do piezo", unit: "nm", value: (s) => s.dfp },
    { key: "fin", label: "Finesse", unit: "", value: (_s, p) => finesse(num(p, "R", 0.85)) },
    { key: "fsr", label: "Intervalo espectral livre", unit: "GHz", value: (_s, p) => fsrHz(num(p, "dmm", 2) * 1e-3) / 1e9 },
    { key: "r1", label: "Raio do 1º anel brilhante", unit: "mm", value: (s, p) => fin((ringRadii(fpGap(s, p), sourceOf(p).lines[0]! * 1e-9, num(p, "fmm", 200) * 1e-3, 1)[0] ?? NaN) * 1e3) },
    { key: "x", label: "Posição do refletor/placa móvel", unit: "cm", value: (s, p) => mwPos(s, p) },
    { key: "dx", label: "Deslocamento desde a marca", unit: "cm", value: (s, p) => mwPos(s, p) - s.marca },
    { key: "leitura", label: "Leitura do receptor de micro-ondas", unit: "mA", value: (s, p) => mwReading(s, p) },
    { key: "ordem", label: "Ordem do máximo mais próximo (contada desde braços iguais / placas encostadas)", unit: "", value: (s, p) => mwOrder(s, p) },
    { key: "alpha", label: "Orientação do aparelho α", unit: "°", value: (s) => ((s.alpha % 360) + 360) % 360 },
    { key: "Nobs", label: "Deslocamento de franjas observado", unit: "franja", value: (s, p) => mmObserved(s, p) },
    { key: "Nprev", label: "Deslocamento previsto pelo éter", unit: "franja", value: (s, p) => mmPredicted(s, p) },
    { key: "g1g2", label: "Produto g₁g₂", unit: "", value: (s) => s.g1 * s.g2 },
    { key: "w0", label: "Cintura do feixe w₀", unit: "mm", value: (s, p) => fin(modeOf(s, p).w0 * 1e3) },
    { key: "zR", label: "Comprimento de Rayleigh z_R", unit: "cm", value: (s, p) => fin(modeOf(s, p).zR * 100) },
    { key: "w1", label: "Raio do feixe no espelho 1", unit: "mm", value: (s, p) => fin(modeOf(s, p).w1 * 1e3) },
  ],
  chart: { x: "t", y: "Ic" },

  scenarios: [
    {
      id: "fabry-perot",
      label: "Fabry–Perot: finesse e anéis",
      params: { modo: FP_OTICO, R: 0.85, dmm: 2, fonte: 0, piezo: 20 },
      guide: `### Anéis de Fabry–Perot
1. Rode: o piezo afasta os espelhos e os anéis nascem no centro e se expandem. Cada anel novo corresponde a $\\Delta d = \\lambda/2$.
2. Veja no gráfico a transmissão do centro: picos de Airy. Baixe $R$ para 0,3 e suba para 0,97: os picos ficam finos e os anéis viram linhas.
3. Compare a largura dos picos com o intervalo entre eles: a razão é a finesse $\\mathcal{F} = \\pi\\sqrt{R}/(1-R)$.
4. Troque para a **lâmpada de sódio**. Aumente $d$ até os anéis das duas linhas (589,0 e 589,6 nm) se separarem. Com que $R$ eles deixam de se misturar?`,
      predict: [
        {
          question: "Aumentando a refletância dos espelhos de 0,5 para 0,95, os anéis brilhantes ficam:",
          options: ["mais largos", "mais finos e nítidos, nas mesmas posições", "deslocados para fora", "mais numerosos"],
          answer: 1,
          explanation: "A posição dos anéis depende só de $2d\\cos\\theta = m\\lambda$. A refletância controla quantas reflexões interferem: com mais ondas, a interferência construtiva fica restrita a um intervalo menor de fase, e a finesse sobe de 4,4 para 61.",
        },
      ],
    },
    {
      id: "michelson-mo",
      label: "Michelson de micro-ondas",
      params: { modo: MICHELSON_MO, lamMW: 2.85, x0: 25, tp: 0 },
      guide: `### Medindo λ das micro-ondas
1. O refletor móvel está a 25 cm do divisor, como o fixo. Clique em **Marcar posição**.
2. Arraste o refletor devagar e conte os máximos da leitura ($N$). Cada máximo novo surge quando o caminho muda de $\\lambda$, isto é, quando o refletor anda $\\lambda/2$.
3. Depois de uns 10 máximos, calcule $\\lambda = 2\\Delta x/N$. Compare com 2,85 cm.
4. Note que os máximos ficam um pouco menores com a distância: a onda se espalha e as amplitudes dos dois braços deixam de ser iguais.
5. Ponha uma **placa dielétrica** no braço móvel: os máximos se deslocam. Medindo esse deslocamento, ache o índice: o refletor precisa recuar $\\delta x = (n-1)t$ para recuperar o mesmo máximo.`,
      predict: [
        {
          question: "Com λ = 2,85 cm, de quanto o refletor móvel precisa andar entre dois máximos consecutivos?",
          options: ["2,85 cm", "1,43 cm", "5,70 cm", "0,71 cm"],
          answer: 1,
          explanation: "A onda vai e volta pelo braço: andar $\\Delta x$ muda o caminho de $2\\Delta x$. Um novo máximo exige $2\\Delta x = \\lambda$, logo $\\Delta x = 1{,}43$ cm.",
        },
      ],
    },
    {
      id: "fp-mo",
      label: "Fabry–Perot de micro-ondas",
      params: { modo: FP_MO, rMW: 0.6, x0: 20 },
      guide: `### Placas semirrefletoras
1. Arraste a placa móvel e encontre os máximos de transmissão.
2. Marque um máximo, conte $N$ máximos e meça $\\Delta d$: $\\lambda = 2\\Delta d/N$.
3. Aumente a refletância das placas: os máximos ficam mais estreitos (mais finos que no Michelson).
4. Compare a forma da curva com a função de Airy do Fabry–Perot ótico: é a mesma física em escala de centímetros.`,
    },
    {
      id: "michelson-morley",
      label: "Michelson–Morley: o vento de éter",
      params: { modo: MM, Lmm: 11, lamMM: 550, v: 30, hip: 1, omega: 6 },
      guide: `### O experimento de 1887
1. Com a hipótese do **éter**, o aparelho gira e as franjas oscilam: 0,4 franja de 0° a 90° para $L = 11$ m.
2. Michelson e Morley podiam ver 0,01 franja. Troque para **resultado real**: o deslocamento é menor que 0,01 franja.
3. Calcule a velocidade máxima do "vento de éter" compatível com 0,01 franja ($v \\propto \\sqrt{\\Delta N}$).
4. Por que girar o aparelho em vez de comparar as franjas com o aparelho parado? (O comprimento dos braços nunca é igual ao comprimento de onda.)`,
      predict: [
        {
          question: "Se o éter existisse, girando o aparelho de 90° as franjas deslocariam cerca de:",
          options: ["0,004 franja", "0,4 franja", "4 franjas", "40 franjas"],
          answer: 1,
          explanation: "$\\Delta N = 2Lv^2/(\\lambda c^2) = 2\\cdot 11\\cdot(3\\times10^4)^2/(5{,}5\\times10^{-7}\\cdot 9\\times10^{16}) \\approx 0{,}4$. O observado foi menor que 0,02: o resultado nulo que a relatividade explica.",
        },
      ],
    },
    {
      id: "cavidade",
      label: "Cavidade ótica e modos gaussianos",
      params: { modo: CAVIDADE, Lc: 30, lamC: 1064, g1i: 0.5, g2i: 0.5 },
      guide: `### Estabilidade e feixe gaussiano
1. Arraste o ponto no diagrama $(g_1, g_2)$. Dentro da região verde ($0 < g_1g_2 < 1$), há um modo gaussiano e o raio fica preso.
2. Leve ao **confocal** (0, 0): $z_R = L/2$ e a cintura é a menor possível para espelhos iguais.
3. Aproxime do **plano-plano** (1, 1) ou do **concêntrico** (−1, −1): o feixe fica enorme nos espelhos (limiar de estabilidade).
4. Saia da região: o raio escapa em poucas reflexões (cavidade instável).
5. Confira que o raio de curvatura da frente de onda no espelho é igual ao do espelho: é isso que define o modo.`,
      predict: [
        {
          question: "Uma cavidade com dois espelhos planos (g₁ = g₂ = 1) é:",
          options: ["muito estável", "marginalmente estável: qualquer desalinhamento faz o raio escapar", "instável sempre", "confocal"],
          answer: 1,
          explanation: "Com $g_1g_2 = 1$ a cavidade está na fronteira: raios inclinados andam para o lado a cada ida e volta e acabam saindo. Por isso lasers usam espelhos curvos.",
        },
      ],
    },
  ],

  exercises: [
    {
      id: "finesse",
      prompt: "Um etalon de Fabry–Perot tem espelhos com refletância R = {R} e separação d = {dmm} mm. Qual a menor diferença de comprimento de onda (em pm) que ele separa em torno de 589 nm, usando o critério Δλ = FSR/𝓕?",
      vary: { R: [0.7, 0.97, 2], dmm: [1, 10, 1] },
      fixed: { modo: FP_OTICO },
      answer: { label: "Δλ", unit: "pm", compute: (p) => (fsrLambda(num(p, "dmm") * 1e-3, 589e-9) * 1e12) / finesse(num(p, "R")) },
      hint: "FSR = λ²/(2d) e 𝓕 = π√R/(1 − R).",
    },
    {
      id: "microondas",
      prompt: "No Michelson de micro-ondas, o refletor móvel foi deslocado de {dx} cm e o aluno contou {N} máximos. Qual o comprimento de onda (em cm)?",
      vary: { dx: [10, 20, 2], N: [7, 14, 0] },
      fixed: { modo: MICHELSON_MO },
      answer: { label: "λ", unit: "cm", compute: (p) => (2 * num(p, "dx")) / num(p, "N") },
    },
    {
      id: "rayleigh",
      prompt: "Uma cavidade simétrica de comprimento L = {Lc} cm tem g₁ = g₂ = {g1i}. Qual o comprimento de Rayleigh do modo fundamental (em cm)?",
      vary: { Lc: [10, 80, 0], g1i: [-0.8, 0.8, 2] },
      fixed: { modo: CAVIDADE },
      answer: { label: "z_R", unit: "cm", compute: (p) => (num(p, "Lc") / 2) * Math.sqrt((1 + num(p, "g1i")) / (1 - num(p, "g1i"))) },
      hint: "Para espelhos iguais, z_R = (L/2)√[(1 + g)/(1 − g)].",
    },
  ],

  init: (p) => {
    const x0 = num(p, "x0", 25);
    return {
      dfp: 0,
      xB: clamp(x0, 10 + num(p, "tp", 0), 56),
      dMW: clamp(x0, 3, 52),
      marca: x0,
      alpha: 0,
      g1: num(p, "g1i", 0.5),
      g2: num(p, "g2i", 0.5),
      drag: null,
    };
  },
  step: (s, p, _t, dt) => {
    const m = modo(p);
    if (m === FP_OTICO) return { ...s, dfp: s.dfp + num(p, "piezo", 20) * dt };
    if (m === MM && !s.drag) return { ...s, alpha: s.alpha + num(p, "omega", 6) * dt };
    return s;
  },
  dt: 1 / 30,
  sampleEvery: 2,
  maxSamples: 6000,

  pointer: {
    down(s, p, pt) {
      const m = modo(p);
      if (m === MICHELSON_MO && Math.abs(pt.x - (BS.x + s.xB)) < 3 && Math.abs(pt.y) < 10) return { ...s, drag: "B" };
      if (m === FP_MO && Math.abs(pt.x - (P1X + s.dMW)) < 3 && Math.abs(pt.y) < 12) return { ...s, drag: "placa" };
      if (m === MM && Math.hypot(pt.x - MMC.x, pt.y - MMC.y) < 4.8) return { ...s, drag: "mm" };
      if (m === CAVIDADE && Math.abs(pt.x - DIAG.x) <= 2.1 * DIAG.k && Math.abs(pt.y - DIAG.y) <= 2.1 * DIAG.k) {
        const [g1, g2] = gFrom(pt);
        return { ...s, drag: "g", g1, g2 };
      }
      return undefined;
    },
    move(s, p, pt, dragging) {
      if (!dragging || !s.drag) return undefined;
      if (s.drag === "B") return { ...s, xB: Math.round(clamp(pt.x - BS.x, 10 + num(p, "tp", 0), 56) * 100) / 100 };
      if (s.drag === "placa") return { ...s, dMW: Math.round(clamp(pt.x - P1X, 3, 52) * 100) / 100 };
      if (s.drag === "mm") return { ...s, alpha: Math.round(mmAngle(pt) * 10) / 10 };
      const [g1, g2] = gFrom(pt);
      return { ...s, g1, g2 };
    },
    up: (s) => (s.drag ? { ...s, drag: null } : undefined),
    cursor(s, p, pt) {
      const m = modo(p);
      if (m === MICHELSON_MO && Math.abs(pt.x - (BS.x + s.xB)) < 3 && Math.abs(pt.y) < 10) return "ew-resize";
      if (m === FP_MO && Math.abs(pt.x - (P1X + s.dMW)) < 3 && Math.abs(pt.y) < 12) return "ew-resize";
      if (m === MM && dist(MMC.x, MMC.y, pt) < 4.8) return "grab";
      if (m === CAVIDADE && dist(DIAG.x + s.g1 * DIAG.k, DIAG.y + s.g2 * DIAG.k, pt) < 0.6) return "grab";
      return undefined;
    },
  },

  actions: [
    { id: "marca", label: "Marcar posição (zerar Δx)", run: (s, p) => ({ ...s, marca: mwPos(s, p) }) },
    { id: "menos", label: "−0,05 cm", run: (s, p) => (modo(p) === FP_MO ? { ...s, dMW: r2(Math.max(3, s.dMW - 0.05)) } : { ...s, xB: r2(Math.max(10, s.xB - 0.05)) }) },
    { id: "mais", label: "+0,05 cm", run: (s, p) => (modo(p) === FP_MO ? { ...s, dMW: r2(Math.min(52, s.dMW + 0.05)) } : { ...s, xB: r2(Math.min(56, s.xB + 0.05)) }) },
    { id: "piezo0", label: "Zerar piezo", run: (s) => ({ ...s, dfp: 0 }) },
    { id: "confocal", label: "Cavidade confocal", run: (s) => ({ ...s, g1: 0, g2: 0 }) },
  ],

  viewport: (p) => {
    const m = modo(p);
    if (m === MICHELSON_MO || m === FP_MO) return { xMin: -2, xMax: 98, yMin: -62, yMax: 32 };
    return { xMin: 0, xMax: 20, yMin: -8.4, yMax: 6.6 };
  },

  render(ctx, fr) {
    const d = draw(ctx, fr);
    const { state: s, params: p } = fr;
    const m = modo(p);
    if (m === FP_OTICO) drawFP(d, s, p);
    else if (m === MICHELSON_MO || m === FP_MO) {
      if (m === MICHELSON_MO) drawMichelsonMW(d, s, p, fr.t);
      else drawFPMW(d, s, p, fr.t);
      drawMWGraph(d, s, p, fr.trail.slice(-500));
    } else if (m === MM) drawMM(d, s, p, fr.trail.slice(-600));
    else drawCavity(d, s, p);
  },
});

export default interferometros;
