import { defineSim, draw, num, texNum, type Draw, type Params } from "@fisilab/core";
import { cssRGB, wavelengthRGB } from "./cores.ts";
import {
  brewsterDeg,
  ellipseOf,
  fresnel,
  hasMiddle,
  MODO_BREWSTER,
  MODO_MALUS,
  MODO_TRES,
  propagate,
  transmittance,
  type Setup,
  type Stage,
  type Stokes,
} from "./fisica.ts";

export * from "./fisica.ts";

/** Sinal de escuro do fotodiodo (corrente de escuro × ganho), em mV. */
export const DARK_MV = 1.5;

export interface PolState {
  /** Ângulo do analisador (graus, 0–360, a partir da vertical). */
  th: number;
  /** Ângulo do elemento central: eixo rápido da lâmina ou eixo do polarizador do meio (graus). */
  mid: number;
  /** Ângulo de incidência na lâmina de vidro (graus). */
  inc: number;
  /** Qual elemento o disco graduado gira. */
  sel: "an" | "mid";
  drag: null | "disco" | "vidro";
  /** Anteparo bloqueando o feixe (para medir o fundo). */
  bloq: boolean;
}

const wrap360 = (a: number) => ((a % 360) + 360) % 360;
const round1 = (a: number) => Math.round(a * 10) / 10;
const modo = (p: Params) => Math.round(num(p, "modo"));

export function setupOf(s: PolState, p: Params): Setup {
  return {
    modo: modo(p),
    fonte: Math.round(num(p, "fonte")),
    lamina: Math.round(num(p, "lamina")),
    an: Math.round(num(p, "an", 1)) === 1,
    p1: num(p, "p1"),
    mid: s.mid,
    th: s.th,
    inc: s.inc,
    n: num(p, "n", 1.52),
  };
}

/** Fundo lido pelo detector com o feixe bloqueado: luz ambiente + sinal de escuro (mV). */
export const background = (p: Params) => num(p, "amb") + DARK_MV;

/** Leitura verdadeira do fotodetector (mV). */
export function reading(s: PolState, p: Params): number {
  const beam = s.bloq ? 0 : num(p, "I0", 1000) * transmittance(setupOf(s, p));
  return beam + background(p);
}

/** Qual elemento o disco controla de fato (sem elemento central, sempre o analisador). */
const dialTarget = (s: PolState, p: Params): "an" | "mid" => (s.sel === "mid" && hasMiddle({ modo: modo(p), lamina: Math.round(num(p, "lamina")) }) ? "mid" : "an");

// ------------------------------------------------------------------ layout (unidades do palco)
const VP = { xMin: 0, xMax: 20, yMin: -9, yMax: 6.6 };
const YB = 3.2; // altura do feixe no banco (vista lateral)
const RAIL = 1.35;
const X = { fonte: 1.6, p1: 5, meio: 8.6, an: 12.2, det: 15.8 };
const DIAL = { x: 4.3, y: -4.7, r: 3.1 };
const GL = { x: 8.6, y: 1.9, r: 1.6 }; // mesa giratória do vidro (vista de cima)
const GRAPH = { x0: 9.9, x1: 19.3, y0: -7.7, y1: -3.9 };
const METER = { x0: 9.2, x1: 14.2, y0: -2.6, y1: -0.9 };

const LASER_COLOR = cssRGB(wavelengthRGB(633), 0.8);
const LAMP_COLOR = "#e8b93c";

const fmt = (v: number, k = 1) => v.toFixed(k).replace(".", ",").replace("-", "−");

// ------------------------------------------------------------------ desenho
function beamSeg(d: Draw, x0: number, y0: number, x1: number, y1: number, I: number, color: string) {
  if (I < 1e-5) return;
  const a = Math.min(1, Math.sqrt(I));
  d.line(x0, y0, x1, y1, { color, width: 1.5 + 5 * a, alpha: 0.12 + 0.6 * a });
  d.line(x0, y0, x1, y1, { color, width: 1, alpha: 0.4 + 0.6 * a });
}

/** Elemento ótico num suporte, visto em perspectiva: disco com o eixo de transmissão. */
function drawMount(d: Draw, x: number, y: number, ang: number, kind: "pol" | "lam", label: string, sub: string, active: boolean) {
  const rx = 0.3;
  const ry = 1.0;
  const th = d.theme;
  // haste e base
  d.rect(x - 0.07, RAIL + 0.25, 0.14, y - ry - RAIL - 0.25, { fill: th.muted, alpha: 0.8 });
  d.rect(x - 0.45, RAIL, 0.9, 0.28, { fill: th.muted, stroke: th.text, width: 1 });
  // disco
  const pts: [number, number][] = [];
  for (let i = 0; i <= 48; i++) {
    const t = (2 * Math.PI * i) / 48;
    pts.push([x + rx * Math.cos(t), y + ry * Math.sin(t)]);
  }
  const fill = kind === "pol" ? (th.dark ? "rgba(120,130,150,0.35)" : "rgba(80,90,110,0.25)") : th.dark ? "rgba(90,160,240,0.25)" : "rgba(60,130,220,0.18)";
  d.polyline(pts, { close: true, fill, color: active ? th.accent : th.text, width: active ? 2.5 : 1.5 });
  // eixo de transmissão (polarizador) ou eixo rápido (lâmina)
  const sx = rx * Math.sin(ang * (Math.PI / 180));
  const sy = ry * Math.cos(ang * (Math.PI / 180));
  d.line(x - sx * 0.95, y - sy * 0.95, x + sx * 0.95, y + sy * 0.95, { color: kind === "pol" ? th.accent : th.series[2]!, width: 2.2, dash: kind === "lam" ? [5, 3] : undefined });
  d.dot(x + sx * 0.95, y + sy * 0.95, 3, kind === "pol" ? th.accent : th.series[2]!);
  d.text(label, x, RAIL - 0.35, { color: th.text, size: 12, weight: "600" });
  d.text(sub, x, RAIL - 0.85, { color: th.muted, size: 11 });
}

/** Desenha o estado de polarização: elipse (parte polarizada) e estrela (parte natural). */
function drawPolState(d: Draw, cx: number, cy: number, r: number, S: Stokes, color: string, label: string) {
  const th = d.theme;
  d.circle(cx, cy, r, { stroke: th.grid, width: 1, fill: th.dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)" });
  d.line(cx, cy - r, cx, cy + r, { color: th.grid, width: 1 });
  d.line(cx - r, cy, cx + r, cy, { color: th.grid, width: 1 });
  const e = ellipseOf(S);
  d.text(label, cx, cy - r - 0.25, { color: th.muted, size: 10 });
  if (e.I < 2e-4) {
    d.text("sem luz", cx, cy, { color: th.muted, size: 10 });
    return;
  }
  const k = 0.92 * r;
  const Iu = Math.max(0, e.I - e.Ip);
  if (Iu > 1e-4) {
    const L = k * Math.sqrt(Iu);
    for (let j = 0; j < 6; j++) {
      const a = (j * Math.PI) / 6;
      d.line(cx - L * Math.sin(a), cy - L * Math.cos(a), cx + L * Math.sin(a), cy + L * Math.cos(a), { color, width: 1.2, alpha: 0.55, dash: [3, 2] });
    }
  }
  if (e.Ip > 1e-4) {
    const A = k * Math.sqrt(e.Ip);
    const psi = (e.psi * Math.PI) / 180;
    const chi = (e.chi * Math.PI) / 180;
    const a = A * Math.cos(chi);
    const b = A * Math.sin(chi);
    const u: [number, number] = [Math.sin(psi), Math.cos(psi)];
    const v: [number, number] = [Math.cos(psi), -Math.sin(psi)];
    if (Math.abs(b) < 0.02 * A) {
      // linear: vetor E oscilando ao longo de ψ
      d.arrow(cx, cy, a * u[0], a * u[1], { color, width: 2.2, head: 7 });
      d.arrow(cx, cy, -a * u[0], -a * u[1], { color, width: 2.2, head: 7 });
    } else {
      const pts: [number, number][] = [];
      for (let i = 0; i <= 64; i++) {
        const t = (2 * Math.PI * i) / 64;
        pts.push([cx + a * Math.cos(t) * u[0] + b * Math.sin(t) * v[0], cy + a * Math.cos(t) * u[1] + b * Math.sin(t) * v[1]]);
      }
      d.polyline(pts, { color, width: 2 });
      // sentido de giro
      const t0 = 0.6;
      const px = cx + a * Math.cos(t0) * u[0] + b * Math.sin(t0) * v[0];
      const py = cy + a * Math.cos(t0) * u[1] + b * Math.sin(t0) * v[1];
      const tx = -a * Math.sin(t0) * u[0] + b * Math.cos(t0) * v[0];
      const ty = -a * Math.sin(t0) * u[1] + b * Math.cos(t0) * v[1];
      d.arrowPx(px, py, tx, ty, 10, { color, width: 2, head: 7 });
    }
  }
}

function drawSource(d: Draw, x: number, y: number, laser: boolean, base: number) {
  const th = d.theme;
  d.rect(x - 0.08, base + 0.25, 0.16, y - 0.45 - base - 0.25, { fill: th.muted, alpha: 0.8 });
  d.rect(x - 0.6, base, 1.2, 0.28, { fill: th.muted, stroke: th.text, width: 1 });
  if (laser) {
    d.rect(x - 1.1, y - 0.45, 2.0, 0.9, { fill: th.dark ? "#2c3442" : "#3a4352", stroke: th.text, width: 1 });
    d.rect(x + 0.9, y - 0.18, 0.18, 0.36, { fill: "#888" });
    d.dot(x + 1.08, y, 3, LASER_COLOR);
    d.text("He-Ne 633 nm", x - 0.1, y + 0.75, { color: th.muted, size: 10 });
    d.dot(x - 0.75, y + 0.2, 2.5, "#e05050");
  } else {
    d.rect(x - 1.1, y - 0.55, 1.9, 1.1, { fill: th.dark ? "#3a3530" : "#5a5248", stroke: th.text, width: 1 });
    d.circle(x - 0.3, y, 0.32, { fill: LAMP_COLOR, alpha: 0.9 });
    d.rect(x + 0.8, y - 0.4, 0.2, 0.8, { fill: th.dark ? "rgba(180,210,255,0.5)" : "rgba(120,160,220,0.6)" });
    d.text("lâmpada", x - 0.1, y + 0.85, { color: th.muted, size: 10 });
  }
}

function drawDetector(d: Draw, x: number, y: number, ang: number, bloq: boolean, base: number | null) {
  const th = d.theme;
  d.ctx.save();
  d.ctx.translate(x, y);
  d.ctx.rotate(ang);
  d.rect(-0.1, -0.5, 1.1, 1.0, { fill: th.dark ? "#2c3442" : "#3a4352", stroke: th.text, width: 1 });
  d.rect(-0.16, -0.25, 0.08, 0.5, { fill: "#6a7a9a" });
  d.ctx.restore();
  if (base !== null) {
    d.rect(x + 0.38, base + 0.25, 0.14, y - 0.5 - base - 0.25, { fill: th.muted, alpha: 0.8 });
    d.rect(x - 0.05, base, 1.0, 0.28, { fill: th.muted, stroke: th.text, width: 1 });
  }
  if (bloq) d.rect(x - 0.7, y - 0.8, 0.14, 1.6, { fill: th.text });
}

function drawDial(d: Draw, s: PolState, p: Params, target: "an" | "mid") {
  const th = d.theme;
  const { x: cx, y: cy, r } = DIAL;
  const ang = target === "an" ? s.th : s.mid;
  const isLam = target === "mid" && modo(p) === MODO_MALUS;
  // escala fixa
  d.circle(cx, cy, r, { fill: th.dark ? "#1f252e" : "#f3f5f8", stroke: th.text, width: 1.5 });
  for (let a = 0; a < 360; a += 5) {
    const big = a % 30 === 0;
    const mid = a % 10 === 0;
    const r1 = r * (big ? 0.84 : mid ? 0.88 : 0.92);
    const t = (a * Math.PI) / 180;
    d.line(cx + r1 * Math.sin(t), cy + r1 * Math.cos(t), cx + r * Math.sin(t), cy + r * Math.cos(t), { color: th.text, width: big ? 1.6 : 1 });
    if (big) d.text(`${a}°`, cx + r * 0.73 * Math.sin(t), cy + r * 0.73 * Math.cos(t), { color: th.muted, size: 10 });
  }
  // disco girável com o filtro
  const rIn = r * 0.6;
  d.circle(cx, cy, rIn, {
    fill: isLam ? (th.dark ? "rgba(90,160,240,0.22)" : "rgba(60,130,220,0.15)") : th.dark ? "rgba(120,130,150,0.4)" : "rgba(80,90,110,0.28)",
    stroke: th.accent,
    width: 2,
  });
  const t = (ang * Math.PI) / 180;
  const color = isLam ? th.series[2]! : th.accent;
  d.line(cx - rIn * Math.sin(t), cy - rIn * Math.cos(t), cx + rIn * Math.sin(t), cy + rIn * Math.cos(t), { color, width: 3, dash: isLam ? [6, 4] : undefined });
  // ponteiro (índice) até a escala
  d.line(cx + rIn * Math.sin(t), cy + rIn * Math.cos(t), cx + r * 0.98 * Math.sin(t), cy + r * 0.98 * Math.cos(t), { color: th.positive, width: 2 });
  d.dot(cx + r * 0.98 * Math.sin(t), cy + r * 0.98 * Math.cos(t), 3.5, th.positive);
  d.dot(cx, cy, 3, th.text);
  const name = target === "an" ? "Analisador" : isLam ? "Lâmina (eixo rápido)" : "Polarizador do meio P₂";
  d.text(`${name}: ${fmt(ang)}°  (vista de frente; arraste para girar)`, cx, cy + r + 0.45, { color: th.text, size: 11, weight: "600" });
}

function drawMeter(d: Draw, s: PolState, p: Params) {
  const th = d.theme;
  const V = reading(s, p);
  d.rect(METER.x0, METER.y0, METER.x1 - METER.x0, METER.y1 - METER.y0, { fill: th.dark ? "#14181e" : "#2a2f37", stroke: th.text, width: 1.5 });
  d.rect(METER.x0 + 0.25, METER.y0 + 0.3, METER.x1 - METER.x0 - 0.5, METER.y1 - METER.y0 - 0.6, { fill: "#a8c49a" });
  const shown = V > 1999.9 ? "OL" : fmt(V, 1);
  d.text(`${shown} mV`, (METER.x0 + METER.x1) / 2, (METER.y0 + METER.y1) / 2, { color: "#1a2416", size: 20, weight: "700" });
  d.text("fotodiodo + multímetro", (METER.x0 + METER.x1) / 2, METER.y1 + 0.3, { color: th.muted, size: 10 });
  const tx = METER.x1 + 0.35;
  d.text(`fundo (ambiente + escuro): ${fmt(background(p))} mV`, tx, METER.y1 - 0.2, { color: th.muted, size: 10, align: "left" });
  d.text(s.bloq ? "feixe BLOQUEADO: leitura = fundo" : `I/I₀ = ${fmt(transmittance(setupOf(s, p)), 3)}`, tx, METER.y1 - 0.75, { color: s.bloq ? th.negative : th.text, size: 11, align: "left" });
  if (modo(p) === MODO_BREWSTER) {
    const f = fresnel(s.inc, num(p, "n", 1.52));
    d.text(`Rs = ${fmt(f.Rs, 4)}   Rp = ${fmt(f.Rp, 4)}`, tx, METER.y1 - 1.3, { color: th.text, size: 11, align: "left" });
  }
}

/** Gráfico: teoria (opcional) e pontos já visitados (rastro). */
function drawGraph(d: Draw, s: PolState, p: Params, trail: PolState[], target: "an" | "mid") {
  const th = d.theme;
  const { x0, x1, y0, y1 } = GRAPH;
  const brew = modo(p) === MODO_BREWSTER;
  d.line(x0, y0, x1, y0, { color: th.muted, width: 1 });
  d.line(x0, y0, x0, y1, { color: th.muted, width: 1 });
  const showCurve = Math.round(num(p, "curva", 1)) === 1;
  if (brew) {
    const gx = (i: number) => x0 + ((x1 - x0) * i) / 90;
    const gy = (R: number) => y0 + (y1 - y0) * R;
    for (const i of [0, 30, 60, 90]) {
      d.line(gx(i), y0, gx(i), y1, { color: th.grid, width: 1 });
      d.text(`${i}°`, gx(i), y0 - 0.3, { color: th.muted, size: 10 });
    }
    for (const R of [0.5, 1]) d.text(fmt(R, 1), x0 - 0.3, gy(R), { color: th.muted, size: 10 });
    const n = num(p, "n", 1.52);
    if (showCurve) {
      d.plot((x) => gy(fresnel(((x - x0) / (x1 - x0)) * 89.9, n).Rs), x0, x1, { color: th.series[0], width: 2 });
      d.plot((x) => gy(fresnel(((x - x0) / (x1 - x0)) * 89.9, n).Rp), x0, x1, { color: th.series[1], width: 2 });
      const b = brewsterDeg(n);
      d.line(gx(b), y0, gx(b), y1, { color: th.muted, width: 1, dash: [4, 3] });
      d.text(`θB = ${fmt(b)}°`, gx(b), y1 + 0.25, { color: th.muted, size: 10 });
      d.text("Rs", x1 - 0.3, gy(fresnel(85, n).Rs) - 0.35, { color: th.series[0], size: 11, weight: "600" });
      d.text("Rp", x1 - 0.3, gy(fresnel(85, n).Rp) + 0.35, { color: th.series[1], size: 11, weight: "600" });
    }
    const f = fresnel(s.inc, n);
    d.dot(gx(s.inc), gy(f.Rs), 4, th.series[0]!);
    d.dot(gx(s.inc), gy(f.Rp), 4, th.series[1]!);
    d.line(gx(s.inc), y0, gx(s.inc), y1, { color: th.accent, width: 1.2 });
    d.text("ângulo de incidência", (x0 + x1) / 2, y0 - 0.65, { color: th.muted, size: 10 });
    d.text("refletância", x0, y1 + 0.3, { color: th.muted, size: 10, align: "left" });
    return;
  }
  const I0 = num(p, "I0", 1000);
  const Vmax = Math.max(10, I0 + background(p)) * 1.05;
  const gx = (a: number) => x0 + ((x1 - x0) * a) / 360;
  const gy = (V: number) => y0 + ((y1 - y0) * V) / Vmax;
  for (const a of [0, 90, 180, 270, 360]) {
    d.line(gx(a), y0, gx(a), y1, { color: th.grid, width: 1 });
    d.text(`${a}°`, gx(a), y0 - 0.3, { color: th.muted, size: 10 });
  }
  d.text(`${Math.round(Vmax / 1.05)}`, x0 - 0.15, gy(Vmax / 1.05), { color: th.muted, size: 10, align: "right" });
  d.text("0", x0 - 0.15, y0, { color: th.muted, size: 10, align: "right" });
  const at = (a: number): PolState => (target === "an" ? { ...s, th: a } : { ...s, mid: a });
  if (showCurve) d.plot((x) => gy(reading(at(((x - x0) / (x1 - x0)) * 360), p)), x0, x1, { color: th.muted, width: 1.5, dash: [5, 4], n: 360 });
  for (const q of trail) {
    const a = target === "an" ? q.th : q.mid;
    d.dot(gx(wrap360(a)), gy(reading(q, p)), 2.5, th.series[0]!, 0.8);
  }
  const a = target === "an" ? s.th : s.mid;
  d.dot(gx(wrap360(a)), gy(reading(s, p)), 5, th.accent);
  d.text(target === "an" ? "ângulo do analisador θ" : "ângulo do elemento central", (x0 + x1) / 2, y0 - 0.65, { color: th.muted, size: 10 });
  d.text("leitura (mV)", x0, y1 + 0.3, { color: th.muted, size: 10, align: "left" });
}

function drawBench(d: Draw, s: PolState, p: Params, target: "an" | "mid") {
  const th = d.theme;
  const su = setupOf(s, p);
  const { stages } = propagate(su);
  const laser = su.fonte === 0;
  const color = laser ? LASER_COLOR : LAMP_COLOR;
  // trilho ótico com escala
  d.rect(0.3, RAIL - 0.12, 19.4, 0.12, { fill: th.muted, alpha: 0.6 });
  for (let x = 1; x <= 19; x++) d.line(x, RAIL - 0.12, x, RAIL - (x % 5 === 0 ? 0.32 : 0.22), { color: th.muted, width: 1 });
  drawSource(d, X.fonte, YB, laser, RAIL);
  const I = (k: Stage["key"]) => stages.find((g) => g.key === k)?.S[0] ?? 0;
  const mid = hasMiddle(su);
  const after = mid ? I("meio") : I("p1");
  beamSeg(d, X.fonte + 1.1, YB, X.p1, YB, 1, color);
  beamSeg(d, X.p1, YB, mid ? X.meio : X.an, YB, I("p1"), color);
  if (mid) beamSeg(d, X.meio, YB, X.an, YB, after, color);
  const final = su.an ? I("an") : after;
  if (s.bloq) {
    beamSeg(d, X.an, YB, X.det - 0.7, YB, final, color);
  } else beamSeg(d, X.an, YB, X.det, YB, final, color);
  drawMount(d, X.p1, YB, su.p1, "pol", "P₁", `${fmt(su.p1)}°`, false);
  if (mid) {
    const lam = su.modo === MODO_MALUS;
    drawMount(d, X.meio, YB, s.mid, lam ? "lam" : "pol", lam ? (su.lamina === 1 ? "λ/4" : "λ/2") : "P₂", `${fmt(s.mid)}°`, target === "mid");
  }
  if (su.an) drawMount(d, X.an, YB, s.th, "pol", "Analisador", `θ = ${fmt(s.th)}°`, target === "an");
  else d.text("(analisador retirado)", X.an, RAIL - 0.35, { color: th.muted, size: 11 });
  drawDetector(d, X.det, YB, 0, s.bloq, RAIL);
  d.text("fotodiodo", X.det + 0.45, RAIL - 0.35, { color: th.text, size: 12, weight: "600" });
  // cabo até o multímetro
  d.polyline(
    [
      [X.det + 1.0, YB],
      [18.6, YB],
      [18.6, -0.3],
      [(METER.x0 + METER.x1) / 2, -0.3],
      [(METER.x0 + METER.x1) / 2, METER.y1],
    ],
    { color: th.muted, width: 1.5 },
  );
  // estados de polarização entre os elementos
  const yi = 5.55;
  const ri = 0.68;
  drawPolState(d, (X.fonte + 1.1 + X.p1) / 2, yi, ri, stages[0]!.S, color, laser ? "laser: vertical" : "luz natural");
  drawPolState(d, ((mid ? X.meio : X.an) + X.p1) / 2, yi, ri, stages[1]!.S, color, "após P₁");
  if (mid) drawPolState(d, (X.meio + X.an) / 2, yi, ri, stages[2]!.S, color, stages[2]!.label);
  drawPolState(d, (X.an + X.det) / 2, yi, ri, su.an ? stages[stages.length - 1]!.S : stages[stages.length - 1]!.S, color, su.an ? "após analisador" : "no detector");
}

function drawBrewster(d: Draw, s: PolState, p: Params) {
  const th = d.theme;
  const su = setupOf(s, p);
  const { stages } = propagate(su);
  const laser = su.fonte === 0;
  const color = laser ? LASER_COLOR : LAMP_COLOR;
  const f = fresnel(s.inc, su.n);
  const rad = (a: number) => (a * Math.PI) / 180;
  // mesa giratória graduada (vista de cima)
  d.circle(GL.x, GL.y, GL.r, { fill: th.dark ? "#1f252e" : "#eef1f5", stroke: th.text, width: 1.2 });
  for (let a = 0; a < 360; a += 10) {
    const t = rad(a);
    const r1 = GL.r * (a % 30 === 0 ? 0.86 : 0.92);
    d.line(GL.x + r1 * Math.cos(t), GL.y + r1 * Math.sin(t), GL.x + GL.r * Math.cos(t), GL.y + GL.r * Math.sin(t), { color: th.muted, width: 1 });
  }
  drawSource(d, 1.4, GL.y, laser, GL.y - 1.4);
  const nrm: [number, number] = [-Math.cos(rad(s.inc)), Math.sin(rad(s.inc))];
  const refl: [number, number] = [-Math.cos(rad(2 * s.inc)), Math.sin(rad(2 * s.inc))];
  const I = (k: Stage["key"]) => stages.find((g) => g.key === k)?.S[0] ?? 0;
  beamSeg(d, 2.5, GL.y, 4.2, GL.y, 1, color);
  beamSeg(d, 4.2, GL.y, GL.x, GL.y, I("p1"), color);
  // feixe transmitido (atravessa a lâmina e segue quase paralelo)
  beamSeg(d, GL.x, GL.y, 13.2, GL.y - 0.08, I("p1") * (1 - (f.Rs + f.Rp) / 2), color);
  const rA = 2.3;
  const rD = 3.4;
  const ax = GL.x + rA * refl[0];
  const ay = GL.y + rA * refl[1];
  beamSeg(d, GL.x, GL.y, ax, ay, I("vidro"), color);
  const fin = su.an ? I("an") : I("vidro");
  const stop = s.bloq ? rD - 0.7 : rD;
  beamSeg(d, ax, ay, GL.x + stop * refl[0], GL.y + stop * refl[1], fin, color);
  // braço do detector
  d.line(GL.x, GL.y, GL.x + (rD + 1.1) * refl[0], GL.y + (rD + 1.1) * refl[1], { color: th.muted, width: 5, alpha: 0.25 });
  // polarizador P1 e analisador (no braço)
  drawMountTop(d, 4.2, GL.y, 0, su.p1, `P₁ ${fmt(su.p1)}°`);
  if (su.an) drawMountTop(d, ax, ay, Math.atan2(refl[1], refl[0]), s.th, `θ = ${fmt(s.th)}°`);
  drawDetector(d, GL.x + rD * refl[0], GL.y + rD * refl[1], Math.atan2(refl[1], refl[0]), s.bloq, null);
  // lâmina de vidro
  const tang = Math.atan2(nrm[0], -nrm[1]);
  d.box(GL.x, GL.y, 2.2, 0.16, tang, { fill: th.dark ? "rgba(140,200,230,0.55)" : "rgba(90,160,200,0.55)", stroke: th.text, width: 1 });
  d.line(GL.x, GL.y, GL.x + 1.25 * nrm[0], GL.y + 1.25 * nrm[1], { color: th.muted, width: 1, dash: [4, 3] });
  d.circle(GL.x + 1.25 * nrm[0], GL.y + 1.25 * nrm[1], 0, { minPx: 6, fill: th.accent, stroke: th.text, width: 1 });
  // arco do ângulo de incidência
  const arc: [number, number][] = [];
  for (let k = 0; k <= 20; k++) {
    const a = Math.PI - (rad(s.inc) * k) / 20;
    arc.push([GL.x + 0.8 * Math.cos(a), GL.y + 0.8 * Math.sin(a)]);
  }
  d.polyline(arc, { color: th.accent, width: 1.5 });
  d.text(`i = ${fmt(s.inc)}°`, GL.x - 1.6, GL.y + 0.55, { color: th.accent, size: 12, weight: "600" });
  d.text("vidro (arraste a alça para girar a mesa)", GL.x, GL.y - GL.r - 0.35, { color: th.muted, size: 10 });
  d.text("vista de cima", 1.2, 5.9, { color: th.muted, size: 10, align: "left" });
  // estados de polarização
  const yi = 5.5;
  const ri = 0.68;
  drawPolState(d, 13.2, yi, ri, stages[1]!.S, color, "antes do vidro");
  drawPolState(d, 15.2, yi, ri, stages[2]!.S, color, "refletida");
  drawPolState(d, 17.2, yi, ri, stages[stages.length - 1]!.S, color, su.an ? "após analisador" : "no detector");
  d.text("s = vertical (⊥ ao plano de incidência) · p = horizontal", 15.2, 4.3, { color: th.muted, size: 10 });
  // cabo
  d.polyline(
    [
      [18.6, 3.6],
      [18.6, -0.3],
      [(METER.x0 + METER.x1) / 2, -0.3],
      [(METER.x0 + METER.x1) / 2, METER.y1],
    ],
    { color: th.muted, width: 1.5, dash: [5, 3] },
  );
}

/** Polarizador visto de cima: barra perpendicular ao feixe com um mostrador do ângulo. */
function drawMountTop(d: Draw, x: number, y: number, dir: number, ang: number, label: string) {
  const th = d.theme;
  d.box(x, y, 0.16, 1.1, dir, { fill: th.dark ? "rgba(120,130,150,0.6)" : "rgba(80,90,110,0.45)", stroke: th.text, width: 1 });
  const t = (ang * Math.PI) / 180;
  d.circle(x, y + 0.95, 0.28, { stroke: th.muted, width: 1 });
  d.line(x - 0.26 * Math.sin(t), y + 0.95 - 0.26 * Math.cos(t), x + 0.26 * Math.sin(t), y + 0.95 + 0.26 * Math.cos(t), { color: th.accent, width: 2 });
  d.text(label, x, y - 0.85, { color: th.text, size: 11, weight: "600" });
}

// ------------------------------------------------------------------ simulação
const angleAround = (pt: { x: number; y: number }, cx: number, cy: number) => wrap360((Math.atan2(pt.x - cx, pt.y - cy) * 180) / Math.PI);
const inDial = (pt: { x: number; y: number }) => Math.hypot(pt.x - DIAL.x, pt.y - DIAL.y) < DIAL.r * 1.12;
const inTable = (pt: { x: number; y: number }) => Math.hypot(pt.x - GL.x, pt.y - GL.y) < GL.r * 1.15;
/** Ângulo de incidência a partir do ponto arrastado (a alça fica na normal da lâmina). */
const incFrom = (pt: { x: number; y: number }) => {
  const phi = (Math.atan2(pt.y - GL.y, pt.x - GL.x) * 180) / Math.PI; // direção da normal
  return Math.max(0, Math.min(89, round1(180 - Math.abs(phi))));
};

function withDial(s: PolState, p: Params, a: number): PolState {
  return dialTarget(s, p) === "an" ? { ...s, th: round1(a) % 360 } : { ...s, mid: round1(a) % 360 };
}

export const polarizacao = defineSim<PolState>({
  id: "polarizacao",
  title: "Polarização: Malus, lâminas e Brewster",
  course: "Exp III",
  topic: "Ótica",
  priority: "P1",
  summary:
    "Banco ótico com laser ou lâmpada, polarizador, lâminas de onda, analisador graduado e fotodiodo com luz de fundo. Verifique a lei de Malus, o efeito de três polarizadores e encontre o ângulo de Brewster girando uma lâmina de vidro.",
  static: true,
  equations: [
    String.raw`I = I_0\cos^2(\theta - \theta_P) + I_{\text{fundo}} \qquad (\text{lei de Malus})`,
    String.raw`I = \frac{I_0}{8}\,\text{sen}^2 2\beta \qquad (\text{luz natural, } P_1 \perp P_3,\ P_2 \text{ a } \beta \text{ de } P_1)`,
    String.raw`r_s = \frac{\cos i - n\cos t}{\cos i + n\cos t} \quad r_p = \frac{n\cos i - \cos t}{n\cos i + \cos t} \quad \text{sen}\, i = n\,\text{sen}\, t \quad \tan\theta_B = n`,
    String.raw`\vec S_{\text{saída}} = M_{\text{analisador}}\, M_{\text{lâmina}}\, M_{P_1}\, \vec S_{\text{fonte}} \qquad (\text{Stokes–Mueller})`,
  ],
  liveEquations(s, p) {
    const su = setupOf(s, p);
    const I0 = num(p, "I0", 1000);
    const V = reading(s, p);
    const out: string[] = [];
    if (su.modo === MODO_BREWSTER) {
      const f = fresnel(s.inc, su.n);
      out.push(String.raw`i = ${texNum(s.inc)}^\circ:\ R_s = ${texNum(f.Rs, 3)},\ R_p = ${texNum(f.Rp, 3)} \qquad \theta_B = \arctan ${texNum(su.n)} = ${texNum(brewsterDeg(su.n), 4)}^\circ`);
    } else if (su.modo === MODO_TRES) {
      const b = s.mid - su.p1;
      out.push(String.raw`\beta = ${texNum(b)}^\circ:\ \frac{I}{I_0} = ${texNum(transmittance(su), 3)} \qquad \tfrac18\text{sen}^2 2\beta = ${texNum(Math.sin((2 * b * Math.PI) / 180) ** 2 / 8, 3)}`);
    } else {
      const c2 = Math.cos(((s.th - su.p1) * Math.PI) / 180) ** 2;
      out.push(String.raw`\cos^2(${texNum(s.th)}^\circ - ${texNum(su.p1)}^\circ) = ${texNum(c2, 3)} \qquad \frac{I}{I_0} = ${texNum(transmittance(su), 3)}`);
    }
    out.push(String.raw`V = ${texNum(I0)}\,\text{mV}\times ${texNum(s.bloq ? 0 : transmittance(su), 3)} + ${texNum(background(p))}\,\text{mV} = ${texNum(V, 4)}\ \text{mV}`);
    return out;
  },

  params: [
    {
      key: "modo",
      label: "Montagem",
      unit: "",
      min: 0,
      max: 2,
      step: 1,
      default: 0,
      options: [
        { value: 0, label: "Polarizador + analisador (Malus)" },
        { value: 1, label: "Três polarizadores" },
        { value: 2, label: "Reflexão no vidro (Brewster)" },
      ],
    },
    {
      key: "fonte",
      label: "Fonte",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 0,
      live: true,
      options: [
        { value: 0, label: "Laser He-Ne polarizado (vertical)" },
        { value: 1, label: "Lâmpada (luz natural)" },
      ],
    },
    {
      key: "lamina",
      label: "Lâmina entre P₁ e o analisador",
      unit: "",
      min: 0,
      max: 2,
      step: 1,
      default: 0,
      live: true,
      options: [
        { value: 0, label: "Nenhuma" },
        { value: 1, label: "Quarto de onda (λ/4)" },
        { value: 2, label: "Meia onda (λ/2)" },
      ],
    },
    {
      key: "an",
      label: "Analisador",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 1,
      live: true,
      options: [
        { value: 1, label: "No banco" },
        { value: 0, label: "Retirado" },
      ],
    },
    { key: "p1", label: "Eixo do polarizador P₁ θ_P", unit: "°", min: -90, max: 90, step: 1, default: 0, live: true },
    { key: "theta", label: "Ângulo inicial do analisador θ", unit: "°", min: 0, max: 360, step: 1, default: 0 },
    { key: "mid", label: "Ângulo inicial do elemento central", unit: "°", min: 0, max: 180, step: 1, default: 45 },
    { key: "inc", label: "Ângulo inicial de incidência no vidro", unit: "°", min: 0, max: 89, step: 1, default: 45 },
    { key: "n", label: "Índice de refração do vidro n", unit: "", min: 1.3, max: 1.9, step: 0.01, default: 1.52, live: true },
    { key: "I0", label: "Sinal do feixe após P₁ (laser) / da lâmpada", unit: "mV", min: 50, max: 1900, step: 10, default: 1000, live: true },
    { key: "amb", label: "Luz ambiente no detector (0 = sala escura)", unit: "mV", min: 0, max: 200, step: 1, default: 20, live: true },
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
    { key: "mid", label: "Ângulo do elemento central β", unit: "°", value: (s) => wrap360(s.mid) },
    { key: "inc", label: "Ângulo de incidência no vidro i", unit: "°", value: (s) => s.inc },
    { key: "V", label: "Leitura do fotodetector", unit: "mV", value: (s, p) => reading(s, p) },
    { key: "fundo", label: "Fundo (ambiente + escuro)", unit: "mV", value: (_s, p) => background(p) },
    { key: "T", label: "Fração transmitida I/I₀", unit: "", value: (s, p) => transmittance(setupOf(s, p)) },
    { key: "c2", label: "cos²(θ − θ_P)", unit: "", value: (s, p) => Math.cos(((s.th - num(p, "p1")) * Math.PI) / 180) ** 2 },
    { key: "Rs", label: "Refletância Rs", unit: "", value: (s, p) => fresnel(s.inc, num(p, "n", 1.52)).Rs },
    { key: "Rp", label: "Refletância Rp", unit: "", value: (s, p) => fresnel(s.inc, num(p, "n", 1.52)).Rp },
  ],
  chart: { x: "theta", y: "V" },

  scenarios: [
    {
      id: "malus",
      label: "Lei de Malus com laser",
      params: { modo: 0, fonte: 0, lamina: 0, an: 1, p1: 0, theta: 0, I0: 1000, amb: 20 },
      guide: `### Lei de Malus
1. O laser já sai polarizado na vertical e P₁ está alinhado com ele ($\\theta_P = 0$).
2. Arraste o disco graduado do analisador e observe a leitura do fotodiodo e o vetor $\\vec E$ nos quadros acima do feixe.
3. Clique em **Bloquear feixe** para ler só o fundo (luz ambiente + sinal de escuro). Desbloqueie.
4. Anote a leitura a cada 10° de 0° a 90°. Faça o gráfico de $V$ contra $\\cos^2\\theta$: deve ser uma reta com inclinação $I_0$ e intercepto igual ao fundo.
5. Ponha a luz ambiente em 0 (sala escura) e repita: o que muda no intercepto?`,
      predict: [
        {
          question: "Com o analisador a 45° do eixo de P₁ (fundo desprezível), a leitura vale:",
          options: ["I₀", "I₀/2", "I₀/√2", "zero"],
          answer: 1,
          explanation: "Só a componente do campo ao longo do eixo do analisador passa: $E = E_0\\cos 45°$. A intensidade vai com $E^2$, então $I = I_0\\cos^2 45° = I_0/2$.",
        },
      ],
    },
    {
      id: "tres",
      label: "Três polarizadores",
      params: { modo: 1, fonte: 1, an: 1, p1: 0, theta: 90, mid: 0, I0: 1600, amb: 5 },
      guide: `### Luz passando por polarizadores cruzados
1. P₁ (0°) e o analisador (90°) estão cruzados. Com P₂ alinhado a P₁, quase nada chega ao detector.
2. Clique em **Disco gira o elemento central** e gire P₂. A luz volta!
3. Meça a leitura em função do ângulo β de P₂ e compare com $\\tfrac{I_0}{8}\\,\\text{sen}^2 2\\beta$ (a lâmpada emite luz natural: P₁ já deixa passar só metade).
4. Em que ângulo a transmissão é máxima? Quanto vale?`,
      predict: [
        {
          question: "Entre dois polarizadores cruzados, você insere um terceiro a 45°. A luz que chega ao detector:",
          options: ["continua zero", "aumenta para I₀/8 (luz natural)", "volta a I₀/2", "dobra de valor"],
          answer: 1,
          explanation: "P₁ deixa $I_0/2$. P₂ a 45° deixa $\\tfrac{I_0}{2}\\cos^2 45° = I_0/4$, agora polarizada a 45°. O analisador a 90° deixa $\\tfrac{I_0}{4}\\cos^2 45° = I_0/8$. O polarizador do meio *cria* uma componente que o analisador aceita.",
        },
      ],
    },
    {
      id: "laminas",
      label: "Lâminas de quarto e meia onda",
      params: { modo: 0, fonte: 0, lamina: 1, an: 1, p1: 0, theta: 0, mid: 45, I0: 1000, amb: 0 },
      guide: `### Polarização circular e rotação
1. A lâmina λ/4 tem o eixo rápido a 45° da polarização: a luz sai **circular** (veja a elipse virar círculo).
2. Gire o analisador: a leitura quase não muda ($I_0/2$ em todos os ângulos).
3. Clique em **Disco gira o elemento central** e gire a lâmina para 0° e 20°: a luz fica linear e depois elíptica.
4. Troque para **meia onda (λ/2)** com eixo a β: a polarização sai linear, girada de $2\\beta$. Encontre o ângulo do analisador que extingue o feixe.`,
      predict: [
        {
          question: "Luz circular chega ao analisador. Ao girá-lo de 0° a 180°, a leitura:",
          options: ["segue cos²θ", "fica constante em I₀/2", "fica zero", "dobra em 90°"],
          answer: 1,
          explanation: "Na luz circular as componentes em qualquer direção têm a mesma amplitude: o analisador sempre deixa passar metade. Com um analisador sozinho não dá para distinguir luz circular de luz natural; é preciso outra λ/4.",
        },
      ],
    },
    {
      id: "brewster",
      label: "Reflexão no vidro e ângulo de Brewster",
      params: { modo: 2, fonte: 1, an: 0, p1: 90, inc: 40, n: 1.52, I0: 1800, amb: 0 },
      guide: `### Ângulo de Brewster
1. A lâmpada emite luz natural; P₁ a 90° deixa só a componente **p** (campo no plano de incidência, horizontal). O analisador está retirado.
2. Arraste a alça azul da mesa giratória: o braço do detector acompanha o feixe refletido.
3. Procure o ângulo de incidência em que a leitura é mínima. Compare com $\\tan\\theta_B = n$.
4. Gire P₁ para 0° (luz **s**): existe mínimo? Compare com as curvas $R_s$ e $R_p$.
5. Ponha P₁ a 45°, recoloque o analisador e, em $\\theta_B$, gire-o: a luz refletida é totalmente polarizada (s, vertical).
6. Para o relatório: perto do mínimo, $r_p$ troca de sinal. Desconte o sinal de escuro e faça o gráfico de $\\pm\\sqrt{V}$ contra $i$; o zero da curva é $\\theta_B$.`,
      predict: [
        {
          question: "Na incidência de Brewster, a luz refletida por um vidro iluminado com luz natural é:",
          options: ["natural", "polarizada no plano de incidência (p)", "polarizada perpendicular ao plano (s)", "circular"],
          answer: 2,
          explanation: "Em $\\theta_B$ o coeficiente $r_p$ se anula: a componente p não é refletida. Só sobra a componente s, perpendicular ao plano de incidência. É assim que óculos polarizados cortam o reflexo do asfalto e da água.",
        },
      ],
    },
  ],

  exercises: [
    {
      id: "malus",
      prompt:
        "Um laser polarizado passa por um analisador cujo eixo faz {theta}° com a direção de polarização. Sem o analisador, o fotodiodo lê {I0} mV (fundo desprezível). Qual a leitura com o analisador?",
      vary: { theta: [5, 85, 0], I0: [200, 1800, 0] },
      fixed: { modo: 0, fonte: 0, lamina: 0, an: 1, p1: 0, amb: 0 },
      answer: {
        label: "V",
        unit: "mV",
        compute: (p) => num(p, "I0") * transmittance(setupOf({ th: num(p, "theta"), mid: 0, inc: 0, sel: "an", drag: null, bloq: false }, p)),
      },
      hint: "Lei de Malus: I = I₀ cos²θ.",
    },
    {
      id: "tres",
      prompt:
        "Luz natural de intensidade {I0} mV incide em dois polarizadores cruzados. Um terceiro polarizador é colocado entre eles, com o eixo a {mid}° do primeiro. Quanto chega ao detector?",
      vary: { I0: [400, 1800, 0], mid: [10, 80, 0] },
      fixed: { modo: 1, fonte: 1, an: 1, p1: 0 },
      answer: {
        label: "I",
        unit: "mV",
        compute: (p) => num(p, "I0") * transmittance(setupOf({ th: 90, mid: num(p, "mid"), inc: 0, sel: "an", drag: null, bloq: false }, p)),
      },
      hint: "O primeiro polarizador deixa metade da luz natural; depois aplique Malus duas vezes. Resultado: (I₀/8) sen² 2β.",
    },
    {
      id: "brewster",
      prompt: "Qual é o ângulo de Brewster, em graus, para luz incidindo do ar num vidro de índice {n}?",
      vary: { n: [1.33, 1.85, 2] },
      fixed: { modo: 2 },
      answer: { label: "θ_B", unit: "°", compute: (p) => brewsterDeg(num(p, "n")) },
      hint: "tan θ_B = n₂/n₁.",
    },
  ],

  init: (p) => ({
    th: wrap360(num(p, "theta")),
    mid: wrap360(num(p, "mid", 45)),
    inc: Math.max(0, Math.min(89, num(p, "inc", 45))),
    sel: modo(p) === MODO_TRES ? "mid" : "an",
    drag: null,
    bloq: false,
  }),
  step: (s) => s,
  dt: 0.05,

  pointer: {
    down(s, p, pt) {
      if (modo(p) === MODO_BREWSTER && inTable(pt)) return { ...s, drag: "vidro", inc: incFrom(pt) };
      if (inDial(pt)) return withDial({ ...s, drag: "disco" }, p, angleAround(pt, DIAL.x, DIAL.y));
      return undefined;
    },
    move(s, p, pt, dragging) {
      if (!dragging || !s.drag) return undefined;
      if (s.drag === "vidro") return { ...s, inc: incFrom(pt) };
      return withDial(s, p, angleAround(pt, DIAL.x, DIAL.y));
    },
    up: (s) => (s.drag ? { ...s, drag: null } : undefined),
    cursor: (_s, p, pt) => ((modo(p) === MODO_BREWSTER && inTable(pt)) || inDial(pt) ? "grab" : undefined),
  },

  actions: [
    { id: "an", label: "Disco gira o analisador", run: (s) => ({ ...s, sel: "an" }), active: (s) => s.sel === "an" },
    { id: "mid", label: "Disco gira o elemento central", run: (s) => ({ ...s, sel: "mid" }), active: (s) => s.sel === "mid" },
    { id: "menos", label: "−1°", run: (s, p) => withDial(s, p, (dialTarget(s, p) === "an" ? s.th : s.mid) + 359) },
    { id: "mais", label: "+1°", run: (s, p) => withDial(s, p, (dialTarget(s, p) === "an" ? s.th : s.mid) + 1) },
    { id: "bloq", label: "Bloquear feixe (medir fundo)", run: (s) => ({ ...s, bloq: !s.bloq }), active: (s) => s.bloq },
  ],

  viewport: () => ({ ...VP }),

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const { state: s, params: p } = frame;
    const target = dialTarget(s, p);
    if (modo(p) === MODO_BREWSTER) drawBrewster(d, s, p);
    else drawBench(d, s, p, target);
    drawDial(d, s, p, modo(p) === MODO_BREWSTER ? "an" : target);
    drawMeter(d, s, p);
    drawGraph(d, s, p, frame.trail.slice(-400), target);
    d.text("Ângulos medidos a partir da vertical, no sentido horário para quem olha a fonte de frente.", 0.3, -8.8, { color: d.theme.muted, size: 10, align: "left" });
  },
});

export default polarizacao;
