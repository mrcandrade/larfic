import { clamp, defineSim, draw, num, rng, texNum, type Draw, type Params } from "@fisilab/core";
import {
  BALLOON_M,
  BALLOON_R,
  BODY_R,
  E_BD,
  E_CHARGE,
  G,
  K,
  MU_WALL,
  WIM_BALL,
  balloonQsat,
  balloonTau,
  beltCurrent,
  bodyVsat,
  gapBreakdown,
  leakResistance,
  minStickCharge,
  nearestTargets,
  paschen,
  peekField,
  protectedRadius,
  rcStep,
  shoeResistance,
  sphereC,
  strikeDistance,
  strikeTarget,
  tipEnhancement,
  wallForce,
  wimCurrent,
  wimSectorStep,
  wimSparkV,
  type Scene,
  type Target,
} from "./model.ts";

export * from "./model.ts";

// ---------------------------------------------------------------------------
// Estado
// ---------------------------------------------------------------------------

type Drag = "bola" | "balao" | "pe" | "mao" | "haste" | null;

export interface MState {
  /** Tensão da cúpula / das garrafas de Leyden (V). */
  V: number;
  /** Fração de carga dos setores da Wimshurst (0–1). */
  s: number;
  /** Fase da correia / dos discos (m ou rad). */
  phase: number;
  /** Distância de descarga (m): esfera de descarga, centelhador. */
  gap: number;
  sparks: number;
  lastSpark: number;
  /** Intervalo entre as duas últimas faíscas (s). */
  period: number;
  /** Energia (J) e corrente de pico (A) da última faísca. */
  Espark: number;
  Ipeak: number;
  /** Tempo restante do clarão da faísca (s). */
  flash: number;
  // Balão
  bx: number;
  by: number;
  vx: number;
  vy: number;
  /** Carga do balão (C, negativa). A do cabelo é a oposta. */
  Q: number;
  stuck: boolean;
  // Travoltage
  footX: number;
  handX: number;
  /** Carga do corpo (C, negativa: elétrons a mais). */
  Qb: number;
  // Para-raios
  mastX: number;
  leader: [number, number][];
  strike: Target | null;
  hits: { haste: number; casa: number; solo: number };
  seed: number;
  drag: Drag;
  lx: number;
  ly: number;
}

export const mode = (p: Params) => Math.round(num(p, "modo"));

const BELT_W = 0.05;
const DOME_Y = 1.2;
const WALL_X = 0.95;
const HAIR: [number, number] = [-0.72, 1.18];
const FLOOR_Y = 0;
const KNOB_X = 2.15;
const KNOB_Y = 1.05;
const KNOB_R = 0.03;
const CARPET: [number, number] = [0.2, 1.6];
const HOUSE = { x: 72, w: 16, h: 9 };
const LEADER_Y0 = 125;

const dome = (p: Params) => num(p, "R", 0.2);
const humidity = (p: Params) => num(p, "U", 40);
const bodyC = (p: Params) => num(p, "Cb", 150) * 1e-12;
const leyden = (p: Params) => num(p, "Cl", 200) * 1e-12;
const omega = (p: Params) => (num(p, "rpm", 120) * 2 * Math.PI) / 60;

export const vdgCurrent = (p: Params) => beltCurrent(num(p, "sigma", 15) * 1e-6, BELT_W, num(p, "v", 10));
/** Capacitância relevante do modo atual. */
export function capacitance(p: Params): number {
  const m = mode(p);
  if (m === 0) return sphereC(dome(p));
  if (m === 1) return leyden(p);
  return bodyC(p);
}
/** Tensão de ruptura da faísca no modo atual (V). */
export function sparkVoltage(s: MState, p: Params): number {
  const m = mode(p);
  if (m === 0) return gapBreakdown(dome(p), s.gap);
  if (m === 1) return wimSparkV(s.gap);
  if (m === 3) return paschen(handGap(s));
  return 0;
}
export const handGap = (s: MState) => Math.max(1e-5, KNOB_X - KNOB_R - s.handX);
export const bodyV = (s: MState, p: Params) => s.Qb / bodyC(p);
export const balloonGap = (s: MState) => WALL_X - (s.bx + BALLOON_R);

export function scene(s: MState, p: Params): Scene {
  return { mastX: s.mastX, mastH: num(p, "h", 20), houseX: HOUSE.x, houseW: HOUSE.w, houseH: HOUSE.h };
}

/** Fração de raios que atingem cada alvo para líderes verticais uniformes em x ∈ [0, 120] m. */
export function strikeStats(sc: Scene, rs: number, n = 240) {
  const hits = { haste: 0, casa: 0, solo: 0 };
  for (let i = 0; i < n; i++) hits[strikeTarget(sc, ((i + 0.5) / n) * 120, rs).kind]++;
  return hits;
}

function spark(s: MState, t: number, V: number, C: number): MState {
  return {
    ...s,
    sparks: s.sparks + 1,
    period: s.sparks > 0 ? t - s.lastSpark : 0,
    lastSpark: t,
    Espark: 0.5 * C * V * V,
    Ipeak: Math.abs(V) / BODY_R,
    flash: 0.15,
  };
}

/** Passo do balão: gravidade, arrasto, atração do cabelo e da parede, atrito na parede. */
export function balloonStep(s0: MState, p: Params, dt: number): MState {
  const s = { ...s0 };
  const tau = balloonTau(humidity(p));
  s.Q *= Math.exp(-dt / tau);
  if (s.drag === "balao") return s;
  const er = num(p, "er", 5);
  const n = 10;
  const h = dt / n;
  const A = Math.PI * BALLOON_R * BALLOON_R;
  for (let i = 0; i < n; i++) {
    const gap = balloonGap(s);
    const Fw = wallForce(s.Q, gap, er);
    // Cabelo com carga −Q no centro da cabeça.
    const dx = HAIR[0] - s.bx;
    const dy = HAIR[1] - s.by;
    const r = Math.max(Math.hypot(dx, dy), BALLOON_R + 0.1);
    const Fh = (K * s.Q * s.Q) / (r * r);
    let ax = (Fw + (Fh * dx) / r) / BALLOON_M;
    let ay = -G + (Fh * dy) / r / BALLOON_M;
    const v = Math.hypot(s.vx, s.vy);
    const drag = (0.5 * 1.2 * 0.5 * A * v) / BALLOON_M;
    ax -= drag * s.vx;
    ay -= drag * s.vy;
    if (gap <= 0) {
      // Encostado: a parede segura com N = F_parede; atrito estático μN contra o peso.
      s.bx = WALL_X - BALLOON_R;
      s.vx = Math.min(0, s.vx);
      ax = Math.min(0, ax);
      const fmax = MU_WALL * Fw;
      if (fmax >= BALLOON_M * G && Math.abs(s.vy) < 0.05) {
        s.stuck = true;
        s.vy = 0;
        ay = 0;
      } else {
        s.stuck = false;
        ay += (Math.sign(-s.vy || 1) * fmax) / BALLOON_M;
      }
    } else s.stuck = false;
    s.vx += ax * h;
    s.vy += ay * h;
    s.bx += s.vx * h;
    s.by += s.vy * h;
    if (s.by < FLOOR_Y + BALLOON_R) {
      s.by = FLOOR_Y + BALLOON_R;
      s.vy = 0;
      s.vx *= 0.9;
    }
    if (s.bx > WALL_X - BALLOON_R) {
      s.bx = WALL_X - BALLOON_R;
      s.vx = 0;
    }
    if (s.bx < -1.0) {
      s.bx = -1.0;
      s.vx = 0;
    }
  }
  return s;
}

/** Esfrega o balão no cabelo ao longo de ds metros. */
export function rubBalloon(s: MState, p: Params, ds: number): MState {
  const Qs = balloonQsat(humidity(p));
  return { ...s, Q: -Qs + (s.Q + Qs) * Math.exp(-ds / 0.4) };
}

/** Arrasta o pé no carpete por ds metros. */
export function rubFoot(s: MState, p: Params, ds: number): MState {
  const Qs = bodyVsat(humidity(p)) * bodyC(p);
  return { ...s, Qb: -Qs + (s.Qb + Qs) * Math.exp(-ds / 1.5) };
}

function newLeader(s: MState): MState {
  const r = rng(s.seed);
  return { ...s, seed: s.seed + 1, leader: [[10 + 100 * r(), LEADER_Y0]], strike: null };
}

function leaderStep(s0: MState, p: Params, dt: number): MState {
  let s = s0;
  if (s.flash > 0) {
    s = { ...s, flash: s.flash - dt };
    if (s.flash <= 0) s = newLeader(s);
    return s;
  }
  if (!s.leader.length) return newLeader(s);
  const rs = strikeDistance(num(p, "I", 30));
  const r = rng(s.seed * 7919 + s.leader.length);
  const [x, y] = s.leader[s.leader.length - 1]!;
  const ny = y - 2;
  const nx = clamp(x + (r() - 0.5) * 3, 2, 118);
  const ts = nearestTargets(scene(s, p), nx, ny).filter((t) => t.d <= rs);
  const leader = [...s.leader, [nx, ny] as [number, number]];
  if (ts.length || ny <= 0) {
    const hit = ts.length ? ts.reduce((a, b) => (b.d < a.d ? b : a)) : { kind: "solo" as const, x: nx, y: 0, d: ny };
    return { ...s, leader, strike: hit, flash: 0.5, hits: { ...s.hits, [hit.kind]: s.hits[hit.kind] + 1 } };
  }
  return { ...s, leader };
}

// ---------------------------------------------------------------------------
// Desenho
// ---------------------------------------------------------------------------

function sparkPath(d: Draw, x1: number, y1: number, x2: number, y2: number, seed: number, color: string, width = 3) {
  const r = rng(seed);
  const n = 9;
  const len = Math.hypot(x2 - x1, y2 - y1);
  const nx = -(y2 - y1) / len;
  const ny = (x2 - x1) / len;
  const pts: [number, number][] = [[x1, y1]];
  for (let i = 1; i < n; i++) {
    const f = i / n;
    const o = (r() - 0.5) * 0.25 * len;
    pts.push([x1 + (x2 - x1) * f + nx * o, y1 + (y2 - y1) * f + ny * o]);
  }
  pts.push([x2, y2]);
  d.polyline(pts, { color, width: width + 4, alpha: 0.25 });
  d.polyline(pts, { color, width });
}

function signs(d: Draw, n: number, pts: (i: number) => [number, number], positive: boolean, size = 12) {
  for (let i = 0; i < n; i++) {
    const [x, y] = pts(i);
    d.text(positive ? "+" : "−", x, y, { color: positive ? d.theme.positive : d.theme.negative, size, weight: "700" });
  }
}

function gauge(d: Draw, x: number, y: number, w: number, frac: number, label: string) {
  const f = clamp(frac, 0, 1);
  const h = 8 * d.px;
  d.rect(x, y, w, h, { stroke: d.theme.muted, width: 1 });
  d.rect(x, y, w * f, h, { fill: f > 0.95 ? d.theme.positive : d.theme.accent, alpha: 0.8 });
  d.text(label, x, y + h + 9 * d.px, { align: "left", size: 11, color: d.theme.muted });
}

const fmt = (v: number, n = 1) => v.toFixed(n).replace(".", ",");
const ink = (d: Draw) => (d.theme.dark ? "#ffe9a8" : "#7a4fd8");

function renderVdG(d: Draw, s: MState, p: Params) {
  const th = d.theme;
  const R = dome(p);
  const metal = th.dark ? "#8d99a8" : "#c3ccd6";
  d.support(-0.85, 0, 0.85, 0, { color: th.muted });
  // Base, coluna e correia
  d.rect(-0.18, 0, 0.36, 0.22, { fill: th.dark ? "#3a3f48" : "#d5d9de", stroke: th.muted, width: 1 });
  d.rect(-0.07, 0.22, 0.14, DOME_Y - 0.22, { fill: th.dark ? "rgba(160,190,220,0.08)" : "rgba(140,170,210,0.12)", stroke: th.muted, width: 1 });
  const y0 = 0.32;
  const y1 = DOME_Y;
  d.circle(0, y0, 0.035, { stroke: th.muted, fill: th.dark ? "#555" : "#ddd" });
  d.circle(0, y1, 0.035, { stroke: th.muted, fill: th.dark ? "#555" : "#ddd" });
  d.line(-0.035, y0, -0.035, y1, { color: th.series[5], width: 4 });
  d.line(0.035, y0, 0.035, y1, { color: th.series[5], width: 4 });
  // Cargas subindo na correia (lado esquerdo)
  const L = y1 - y0;
  for (let i = 0; i < 6; i++) {
    const y = y0 + (((s.phase * 0.08 + i / 6) % 1) + 1) % 1 * L;
    d.text("+", -0.06, y, { color: th.positive, size: 12, weight: "700" });
  }
  d.text("pente inferior (ioniza o ar)", 0.1, y0, { align: "left", size: 11, color: th.muted });
  d.line(0.04, y0, 0.08, y0, { color: th.muted });
  // Cúpula
  d.circle(0, DOME_Y, R, { fill: metal, stroke: th.muted, width: 1.2 });
  const Vs = sparkVoltage(s, p);
  const n = Math.round(clamp(s.V / 25e3, 0, 24));
  signs(d, n, (i) => [(R + 0.03) * Math.cos(Math.PI * 2 * (i / Math.max(n, 1))), DOME_Y + (R + 0.03) * Math.sin(Math.PI * 2 * (i / Math.max(n, 1)))], true);
  // Campo radial
  const E = s.V / R;
  if (s.V > 1e3)
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 + 0.2;
      d.arrowPx(R * 1.12 * Math.cos(a), DOME_Y + R * 1.12 * Math.sin(a), Math.cos(a), Math.sin(a), 10 + 30 * clamp(E / E_BD, 0, 1), { color: th.accent, width: 1.2 });
    }
  // Esfera de descarga aterrada
  const bx = R + s.gap + 0.06;
  d.line(bx, DOME_Y - 0.06, bx, 0, { color: th.muted, width: 3 });
  d.circle(bx, DOME_Y, 0.06, { fill: metal, stroke: th.muted });
  d.text("esfera aterrada (arraste)", bx, DOME_Y + 0.1, { size: 11, color: th.muted });
  if (s.flash > 0) sparkPath(d, R, DOME_Y, bx - 0.06, DOME_Y, s.sparks, ink(d));
  d.text(`V = ${fmt(s.V / 1e3, 0)} kV`, 0, DOME_Y, { size: 14, weight: "700" });
  gauge(d, -0.85, 1.55, 0.5, s.V / Vs, `V / V_ruptura = ${fmt((100 * s.V) / Vs, 0)} %`);
  gauge(d, -0.85, 1.42, 0.5, E / E_BD, `E na cúpula = ${fmt(E / 1e6, 2)} MV/m (ar rompe em 3)`);
}

function renderWimshurst(d: Draw, s: MState, p: Params) {
  const th = d.theme;
  const c: [number, number] = [0, 0.42];
  const Rd = 0.26;
  d.support(-0.55, 0, 0.55, 0, { color: th.muted });
  d.line(0, 0, 0, c[1], { color: th.muted, width: 4 });
  d.circle(c[0], c[1], Rd, { fill: th.dark ? "rgba(140,170,200,0.08)" : "rgba(120,150,190,0.1)", stroke: th.muted, width: 1.2 });
  for (let i = 0; i < 24; i++) {
    const a = s.phase + (i / 24) * Math.PI * 2;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const top = sa > 0;
    d.line(c[0] + 0.15 * ca, c[1] + 0.15 * sa, c[0] + 0.245 * ca, c[1] + 0.245 * sa, {
      color: s.s > 0.05 ? (top ? th.positive : th.negative) : th.muted,
      width: 4,
      alpha: 0.35 + 0.65 * s.s,
    });
  }
  // Escovas neutralizadoras
  d.line(c[0] - 0.25 * Math.cos(0.8), c[1] - 0.25 * Math.sin(0.8), c[0] + 0.25 * Math.cos(0.8), c[1] + 0.25 * Math.sin(0.8), { color: th.series[5], width: 2 });
  d.text("barra neutralizadora", c[0] + 0.2, c[1] + 0.25, { size: 10, color: th.muted, align: "left" });
  // Garrafas de Leyden e terminais
  const half = s.gap / 2;
  for (const sgn of [-1, 1]) {
    const x = sgn * 0.4;
    d.rect(x - 0.06, 0, 0.12, 0.22, { fill: th.dark ? "rgba(200,200,220,0.1)" : "rgba(160,170,190,0.2)", stroke: th.muted });
    d.rect(x - 0.06, 0, 0.12, 0.12, { fill: th.dark ? "#8d99a8" : "#c3ccd6", alpha: 0.7 });
    d.polyline([[x, 0.22], [x, 0.42], [sgn * 0.3, 0.42]], { color: th.muted, width: 3 });
    d.polyline([[x, 0.42], [x, 0.78], [sgn * (half + WIM_BALL), 0.78]], { color: th.muted, width: 3 });
    d.circle(sgn * (half + WIM_BALL), 0.78, WIM_BALL, { fill: th.dark ? "#8d99a8" : "#c3ccd6", stroke: th.muted, minPx: 4 });
    signs(d, Math.round(clamp(s.V / 8e3, 0, 6)), (i) => [x + (i % 3) * 0.03 - 0.03, 0.17 + Math.floor(i / 3) * 0.03], sgn < 0, 11);
  }
  d.text("garrafas de Leyden", 0.4, -0.0 + 0.25, { size: 10, color: th.muted });
  if (s.flash > 0) sparkPath(d, -half, 0.78, half, 0.78, s.sparks, ink(d), 2.5);
  d.text(`d = ${fmt(s.gap * 100, 1)} cm (arraste a esfera da direita)`, 0, 0.88, { size: 11, color: th.muted });
  d.text(`V = ${fmt(s.V / 1e3, 1)} kV`, 0, 0.12, { size: 14, weight: "700" });
  gauge(d, -0.53, 0.88, 0.3, s.s, `carga dos setores ${fmt(100 * s.s, 0)} %`);
  gauge(d, 0.25, 0.88, 0.28, s.V / wimSparkV(s.gap), "V / V_ruptura");
}

function renderBalloon(d: Draw, s: MState, p: Params) {
  const th = d.theme;
  d.support(-1.1, 0, WALL_X, 0, { color: th.muted });
  d.rect(WALL_X, 0, 0.15, 1.7, { fill: th.dark ? "#4a4540" : "#e9e2d4", stroke: th.muted });
  // Moléculas da parede polarizadas pelo balão
  for (let j = 0; j < 14; j++) {
    const y = 0.08 + j * 0.115;
    for (let i = 0; i < 2; i++) {
      const x = WALL_X + 0.04 + i * 0.07;
      const dx = s.bx - x;
      const dy = s.by - y;
      const r = Math.hypot(dx, dy);
      const E = (K * Math.abs(s.Q)) / (r * r);
      const sh = 0.012 * Math.tanh(E / 2e5);
      // Q < 0: núcleos (+) puxados para o balão, nuvens (−) empurradas.
      d.dot(x - (dx / r) * sh, y - (dy / r) * sh, 3.2, th.negative, 0.6);
      d.dot(x + (dx / r) * sh, y + (dy / r) * sh, 2, th.positive, 0.9);
    }
  }
  // Pessoa: cabeça e cabelo
  const [hx, hy] = HAIR;
  d.line(hx, hy - 0.13, hx, 0.5, { color: th.muted, width: 10, alpha: 0.6 });
  d.circle(hx, hy, 0.12, { fill: th.dark ? "#c99c7a" : "#e7b892", stroke: th.muted });
  const qh = Math.abs(s.Q) / balloonQsat(15);
  for (let i = 0; i < 13; i++) {
    const a0 = Math.PI * (0.15 + 0.7 * (i / 12));
    const x0 = hx + 0.12 * Math.cos(a0);
    const y0 = hy + 0.12 * Math.sin(a0);
    // Fios repelem-se: apontam para fora quanto mais carregados.
    const a = a0 + (1 - clamp(qh * 1.5, 0, 1)) * (a0 < Math.PI / 2 ? -1.2 : 1.2);
    d.line(x0, y0, x0 + 0.1 * Math.cos(a), y0 + 0.1 * Math.sin(a), { color: th.dark ? "#d8b46a" : "#7a5230", width: 1.5 });
  }
  signs(d, Math.round(clamp(Math.abs(s.Q) / 15e-9, 0, 10)), (i) => [hx - 0.1 + i * 0.02, hy + 0.27], true, 10);
  // Balão
  d.line(s.bx, s.by - BALLOON_R, s.bx + 0.02, s.by - BALLOON_R - 0.25, { color: th.muted, width: 1 });
  d.circle(s.bx, s.by, BALLOON_R, { fill: th.series[3] ?? th.accent, alpha: 0.85, stroke: th.muted });
  const nq = Math.round(clamp(Math.abs(s.Q) / 10e-9, 0, 24));
  signs(d, nq, (i) => {
    const a = (2 * Math.PI * (i + 0.5)) / nq;
    return [s.bx + 0.75 * BALLOON_R * Math.cos(a), s.by + 0.75 * BALLOON_R * Math.sin(a)];
  }, false, 11);
  const gap = balloonGap(s);
  const F = wallForce(s.Q, gap, num(p, "er", 5));
  if (F > 1e-4) d.arrowPx(s.bx + BALLOON_R, s.by, 1, 0, clamp(8 * Math.log10(F / 1e-4) + 10, 10, 60), { color: th.accent });
  d.arrowPx(s.bx, s.by - BALLOON_R, 0, -1, 25, { color: th.muted });
  d.text("peso", s.bx + 0.05, s.by - BALLOON_R - 0.08, { size: 10, color: th.muted, align: "left" });
  d.text(
    `Q = ${fmt(s.Q * 1e9, 0)} nC   F_parede = ${fmt(F * 1e3, 1)} mN   μF máx = ${fmt(MU_WALL * wallForce(s.Q, 0, num(p, "er", 5)) * 1e3, 1)} mN  vs  mg = ${fmt(BALLOON_M * G * 1e3, 1)} mN`,
    -1.08,
    1.62,
    { size: 11, align: "left" },
  );
  d.text(s.stuck ? "grudado na parede" : "arraste o balão no cabelo para esfregar e solte perto da parede", -1.08, 1.5, { size: 11, align: "left", color: th.muted });
}

function renderTravoltage(d: Draw, s: MState, p: Params) {
  const th = d.theme;
  d.rect(CARPET[0], 0, CARPET[1] - CARPET[0], 0.04, { fill: th.dark ? "#6b3b3b" : "#c98c7a" });
  d.text("carpete", (CARPET[0] + CARPET[1]) / 2, 0.08, { size: 11, color: th.muted });
  d.support(0, 0, 2.4, 0, { color: th.muted });
  d.rect(2.2, 0, 0.2, 2.0, { fill: th.dark ? "#4a3a2a" : "#b58a5c", stroke: th.muted });
  d.line(KNOB_X, KNOB_Y, 2.2, KNOB_Y, { color: th.muted, width: 4 });
  d.circle(KNOB_X, KNOB_Y, KNOB_R, { fill: th.dark ? "#c9a227" : "#d9b23a", stroke: th.muted });
  d.text("maçaneta (aterrada)", 2.18, KNOB_Y - 0.1, { size: 10, color: th.muted, align: "right" });
  // Corpo
  const hip: [number, number] = [0.95, 0.9];
  const sh: [number, number] = [0.95, 1.4];
  const skin = th.dark ? "#c99c7a" : "#e7b892";
  d.line(hip[0], hip[1], 0.9, 0.04, { color: th.text, width: 6 });
  d.line(hip[0], hip[1], s.footX, 0.04, { color: th.text, width: 6 });
  d.line(hip[0], hip[1], sh[0], sh[1], { color: th.text, width: 10 });
  d.line(sh[0], sh[1], s.handX, KNOB_Y, { color: th.text, width: 5 });
  d.circle(0.95, 1.58, 0.13, { fill: skin, stroke: th.muted });
  d.circle(s.handX, KNOB_Y, 0.025, { fill: skin, stroke: th.muted, minPx: 4 });
  d.text("pé (arraste)", s.footX, 0.16, { size: 10, color: th.muted });
  d.text("mão (arraste)", s.handX - 0.1, KNOB_Y + 0.08, { size: 10, color: th.muted });
  // Elétrons em excesso no corpo
  const n = Math.round(clamp(Math.abs(s.Qb) / 100e-9, 0, 60));
  const r = rng(7);
  for (let i = 0; i < n; i++) {
    const f = r();
    const x = 0.95 + (r() - 0.5) * 0.1;
    const y = 0.5 + f * 0.9;
    d.text("−", x, y, { color: th.negative, size: 11, weight: "700" });
  }
  if (s.flash > 0) sparkPath(d, s.handX, KNOB_Y, KNOB_X - KNOB_R, KNOB_Y, s.sparks, ink(d), 2);
  // Lupa da fresta
  const ix = 1.35;
  const iy = 1.55;
  const w = 0.8;
  const scale = w / 0.025;
  d.rect(ix, iy, w, 0.35, { fill: th.dark ? "rgba(30,35,45,0.9)" : "rgba(255,255,255,0.9)", stroke: th.muted });
  const g = handGap(s);
  const kx = ix + w - 0.05;
  d.rect(kx, iy + 0.05, 0.05, 0.25, { fill: th.dark ? "#c9a227" : "#d9b23a" });
  const fx = kx - Math.min(g, 0.024) * scale;
  d.circle(fx - 0.04, iy + 0.18, 0.04, { fill: skin });
  if (s.flash > 0) sparkPath(d, fx, iy + 0.18, kx, iy + 0.18, s.sparks + 3, ink(d), 2);
  for (let mm = 0; mm <= 25; mm += 5) d.line(kx - mm * 1e-3 * scale, iy + 0.04, kx - mm * 1e-3 * scale, iy + 0.07, { color: th.muted, width: 1 });
  d.text(`lupa: d = ${fmt(g * 1e3, 2)} mm   V_ruptura (Paschen) = ${fmt(paschen(g) / 1e3, 2)} kV`, ix + 0.02, iy + 0.31, { size: 10, align: "left" });
  const V = Math.abs(bodyV(s, p));
  d.text(`|V| = ${fmt(V / 1e3, 2)} kV   Q = ${fmt(s.Qb * 1e6, 3)} μC   elétrons a mais: ${fmt(Math.abs(s.Qb) / E_CHARGE / 1e9, 2)} × 10⁹`, 0.05, 1.93, { size: 11, align: "left" });
  if (s.sparks)
    d.text(`última faísca: ${fmt(s.Espark * 1e3, 2)} mJ, pico ≈ ${fmt(s.Ipeak, 1)} A (R do corpo 1,5 kΩ)`, 0.05, 1.83, { size: 11, align: "left", color: th.muted });
}

function renderPoints(d: Draw, s: MState, p: Params) {
  const th = d.theme;
  const h = num(p, "h", 20);
  const E0 = num(p, "E0", 10) * 1e3;
  const top = Math.max(h, 10) * 1.6 + 10;
  d.rect(-30, top - 6, 60, 6, { fill: th.dark ? "#3c4350" : "#9aa5b4", alpha: 0.9 });
  signs(d, 14, (i) => [-28 + i * 4.2, top - 3], false);
  d.text(`nuvem: campo no solo E₀ = ${fmt(E0 / 1e3, 1)} kV/m`, 0, top - 7.5, { size: 11, color: th.muted });
  d.support(-30, 0, 30, 0, { color: th.muted });
  signs(d, 14, (i) => [-28 + i * 4.2, 1.2], true, 10);
  const masts = [
    { x: -12, r: num(p, "rTip", 2) * 1e-3, label: "haste pontiaguda" },
    { x: 12, r: num(p, "rBall", 15) * 1e-2, label: "haste com esfera" },
  ];
  for (const m of masts) {
    const beta = tipEnhancement(h, m.r);
    const Et = beta * E0;
    const Ec = peekField(m.r);
    d.line(m.x, 0, m.x, h, { color: th.muted, width: 4 });
    const rr = Math.max(m.r, 0.3 * d.px * 6);
    d.circle(m.x, h, rr, { fill: th.dark ? "#8d99a8" : "#c3ccd6", stroke: th.muted, minPx: 2 });
    const on = Et >= Ec;
    if (on) {
      const k = clamp(Et / Ec - 1, 0, 3);
      const fl = 0.75 + 0.25 * Math.sin(s.phase * 40 + m.x);
      d.circle(m.x, h, rr + 0.6 + 1.2 * k, { fill: th.dark ? "#9fb8ff" : "#6d7cff", alpha: 0.25 * fl });
      d.circle(m.x, h, rr + 0.3 + 0.5 * k, { fill: th.dark ? "#d9e2ff" : "#9aa8ff", alpha: 0.45 * fl });
    }
    d.text(m.label, m.x, h + 4.5, { size: 11, weight: "600" });
    d.text(`E_ponta = ${fmt(Et / 1e6, 2)} MV/m  (β = ${beta < 1e4 ? fmt(beta, 0) : beta.toExponential(1)})`, m.x, h + 3, { size: 10 });
    d.text(`E_corona (Peek) = ${fmt(Ec / 1e6, 2)} MV/m ${on ? "→ corona: fogo-de-santelmo" : "→ sem descarga"}`, m.x, h + 1.6, { size: 10, color: on ? th.accent : th.muted });
  }
}

function renderLightning(d: Draw, s: MState, p: Params) {
  const th = d.theme;
  const h = num(p, "h", 20);
  const rs = strikeDistance(num(p, "I", 30));
  d.rect(0, LEADER_Y0, 120, 15, { fill: th.dark ? "#3c4350" : "#9aa5b4" });
  d.support(0, 0, 120, 0, { color: th.muted });
  // Zona protegida pela haste (esfera rolante)
  const rp = protectedRadius(h, rs);
  for (const sgn of [-1, 1]) {
    const cx = s.mastX + sgn * rp;
    const pts: [number, number][] = [[s.mastX, 0]];
    for (let i = 0; i <= 30; i++) {
      const x = s.mastX + (sgn * rp * i) / 30;
      pts.push([x, rs - Math.sqrt(Math.max(0, rs * rs - (x - cx) ** 2))]);
    }
    pts.push([cx, 0]);
    d.polyline(pts, { close: true, fill: th.series[2], color: "none", alpha: 0.18 });
  }
  const cx = s.mastX + rp;
  d.circle(cx, rs, rs, { stroke: th.muted, dash: [5, 5], width: 1 });
  d.text("esfera rolante", cx, rs * 2 + 2, { size: 10, color: th.muted });
  // Casa
  d.rect(HOUSE.x - HOUSE.w / 2, 0, HOUSE.w, HOUSE.h, { fill: th.dark ? "#5a4a3a" : "#e2c9a6", stroke: th.muted });
  d.polyline([[HOUSE.x - HOUSE.w / 2 - 1, HOUSE.h], [HOUSE.x, HOUSE.h + 5], [HOUSE.x + HOUSE.w / 2 + 1, HOUSE.h]], { color: th.muted, width: 2 });
  // Haste
  if (h > 0) {
    d.line(s.mastX, 0, s.mastX, h, { color: th.text, width: 3 });
    d.dot(s.mastX, h, 4, th.text);
    d.text("para-raios (arraste)", s.mastX, h + 3, { size: 10, color: th.muted });
  }
  // Líder
  if (s.leader.length > 1) d.polyline(s.leader, { color: ink(d), width: s.strike ? 3 : 1.5 });
  const tip = s.leader[s.leader.length - 1];
  if (tip && !s.strike) d.circle(tip[0], tip[1], rs, { stroke: ink(d), dash: [3, 4], width: 1, alpha: 0.6 });
  if (s.strike && tip) sparkPath(d, tip[0], tip[1], s.strike.x, s.strike.y, s.seed, ink(d), 3);
  const tot = s.hits.haste + s.hits.casa + s.hits.solo;
  d.text(`I = ${fmt(num(p, "I", 30), 0)} kA → r_s = 10·I^0,65 = ${fmt(rs, 1)} m   raio protegido no solo = ${fmt(rp, 1)} m`, 2, 136, { size: 11, align: "left" });
  d.text(`raios: ${tot}  haste ${s.hits.haste}  casa ${s.hits.casa}  solo ${s.hits.solo}   (clique no céu para soltar um raio ali)`, 2, 131, { size: 11, align: "left", color: th.muted });
}

// ---------------------------------------------------------------------------
// Simulação
// ---------------------------------------------------------------------------

const MODES = ["Gerador de Van de Graaff", "Máquina de Wimshurst", "Balão esfregado e a parede", "John Travoltage (carpete e maçaneta)", "Poder das pontas e fogo-de-santelmo", "Para-raios (esfera rolante)"];

export const maquinasEletrostaticas = defineSim<MState>({
  id: "maquinas-eletrostaticas",
  title: "Máquinas eletrostáticas, faíscas e para-raios",
  course: "FG III",
  topic: "Eletrostática",
  priority: "P2",
  summary:
    "Van de Graaff e Wimshurst carregando até o ar romper, o balão que gruda na parede por polarização, a faísca do carpete na maçaneta, o fogo-de-santelmo nas pontas e o para-raios pelo método da esfera rolante — tudo com tensões, campos e energias calculados.",
  equations: [
    String.raw`I = \sigma w v,\qquad C\frac{dV}{dt} = I - \frac{V}{R_{\text{fuga}}},\qquad C = 4\pi\varepsilon_0 R`,
    String.raw`E_{\text{máx}} = V\left(\frac{1}{d} + \frac{1}{R}\right) = E_{\text{rup}} \approx 3\ \text{MV/m}`,
    String.raw`F_{\text{parede}} = \frac{k\,\beta Q^2}{(2s)^2},\quad \beta = \frac{\varepsilon_r - 1}{\varepsilon_r + 1},\qquad \mu F \ge m g`,
    String.raw`V_{\text{rup}} = \frac{B\,p\,d}{\ln(A p d) - \ln\ln(1 + 1/\gamma)}\quad(\text{Paschen})`,
    String.raw`E_{\text{ponta}} \approx \left(2 + \frac{h}{r}\right)E_0,\qquad r_s = 10\,I^{0{,}65}`,
  ],
  liveEquations(s, p) {
    const m = mode(p);
    if (m === 0) {
      const I = vdgCurrent(p);
      const C = capacitance(p);
      return [
        String.raw`I = \sigma w v = ${texNum(I * 1e6)}\ \mu\text{A},\quad C = ${texNum(C * 1e12)}\ \text{pF},\quad \tau = R_{\text{fuga}}C = ${texNum(leakResistance(humidity(p)) * C)}\ \text{s}`,
        String.raw`V = ${texNum(s.V / 1e3)}\ \text{kV} \;\to\; V_{\text{rup}} = ${texNum(sparkVoltage(s, p) / 1e3)}\ \text{kV}\ (d = ${texNum(s.gap * 100)}\ \text{cm})`,
      ];
    }
    if (m === 1) {
      const I = wimCurrent(s.s, omega(p));
      return [
        String.raw`I = 2N s\,q_{\text{máx}} f = ${texNum(I * 1e6)}\ \mu\text{A},\quad V_{\text{rup}} = ${texNum(sparkVoltage(s, p) / 1e3)}\ \text{kV}`,
        String.raw`T_{\text{faíscas}} \approx \frac{C V_{\text{rup}}}{I} = ${texNum(I > 0 ? (leyden(p) * sparkVoltage(s, p)) / I : Infinity)}\ \text{s}`,
      ];
    }
    if (m === 2) {
      const er = num(p, "er", 5);
      return [
        String.raw`Q = ${texNum(s.Q * 1e9)}\ \text{nC},\quad F(0) = ${texNum(wallForce(s.Q, 0, er) * 1e3)}\ \text{mN},\quad Q_{\text{mín}} = ${texNum(minStickCharge(er) * 1e9)}\ \text{nC}`,
        String.raw`\tau_{\text{fuga}} = ${texNum(balloonTau(humidity(p)))}\ \text{s}`,
      ];
    }
    if (m === 3) {
      const V = Math.abs(bodyV(s, p));
      return [
        String.raw`|V| = \frac{|Q|}{C} = ${texNum(V / 1e3)}\ \text{kV},\quad V_{\text{rup}}(d = ${texNum(handGap(s) * 1e3)}\ \text{mm}) = ${texNum(paschen(handGap(s)) / 1e3)}\ \text{kV}`,
        String.raw`U = \tfrac12 C V^2 = ${texNum(0.5 * bodyC(p) * V * V * 1e3)}\ \text{mJ}`,
      ];
    }
    if (m === 4) {
      const h = num(p, "h", 20);
      const r = num(p, "rTip", 2) * 1e-3;
      return [String.raw`E_{\text{ponta}} = (2 + h/r)E_0 = ${texNum(tipEnhancement(h, r) * num(p, "E0", 10) * 1e3 / 1e6)}\ \text{MV/m},\quad E_{\text{Peek}} = ${texNum(peekField(r) / 1e6)}\ \text{MV/m}`];
    }
    const rs = strikeDistance(num(p, "I", 30));
    return [String.raw`r_s = ${texNum(rs)}\ \text{m},\quad r_{\text{prot}} = \sqrt{h(2r_s - h)} = ${texNum(protectedRadius(num(p, "h", 20), rs))}\ \text{m}`];
  },

  params: [
    { key: "modo", label: "Experimento", unit: "", min: 0, max: 5, step: 1, default: 0, options: MODES.map((label, value) => ({ value, label })) },
    { key: "R", label: "Raio da cúpula (Van de Graaff)", unit: "m", min: 0.1, max: 0.4, step: 0.01, default: 0.2 },
    { key: "v", label: "Velocidade da correia", unit: "m/s", min: 2, max: 25, step: 0.5, default: 10, live: true },
    { key: "sigma", label: "Carga na correia σ", unit: "μC/m²", min: 1, max: 26, step: 0.5, default: 15, live: true },
    { key: "dBola", label: "Distância inicial da esfera/centelhador", unit: "cm", min: 1, max: 60, step: 0.5, default: 20 },
    { key: "rpm", label: "Rotação da Wimshurst", unit: "rpm", min: 20, max: 300, step: 5, default: 120, live: true },
    { key: "Cl", label: "Capacitância das garrafas de Leyden", unit: "pF", min: 50, max: 1000, step: 10, default: 200 },
    { key: "U", label: "Umidade relativa do ar", unit: "%", min: 15, max: 90, step: 1, default: 40, live: true },
    { key: "er", label: "Permissividade da parede εr", unit: "", min: 1.5, max: 10, step: 0.1, default: 5, live: true },
    { key: "Cb", label: "Capacitância do corpo", unit: "pF", min: 80, max: 300, step: 5, default: 150 },
    { key: "E0", label: "Campo da tempestade no solo E₀", unit: "kV/m", min: 0.2, max: 30, step: 0.1, default: 10, live: true },
    { key: "h", label: "Altura da haste", unit: "m", min: 0, max: 60, step: 1, default: 20, live: true },
    { key: "rTip", label: "Raio da ponta da haste", unit: "mm", min: 0.5, max: 50, step: 0.5, default: 2, log: true, live: true },
    { key: "rBall", label: "Raio da esfera da outra haste", unit: "cm", min: 1, max: 50, step: 1, default: 15, live: true },
    { key: "I", label: "Corrente de pico do raio", unit: "kA", min: 3, max: 100, step: 1, default: 30, live: true },
  ],

  observables: [
    {
      key: "V",
      label: "Tensão (cúpula / garrafas / corpo)",
      unit: "kV",
      value: (s, p) => (mode(p) === 3 ? Math.abs(bodyV(s, p)) : mode(p) <= 1 ? s.V : 0) / 1e3,
    },
    { key: "Vrup", label: "Tensão de ruptura da faísca", unit: "kV", value: (s, p) => sparkVoltage(s, p) / 1e3 },
    {
      key: "Q",
      label: "Carga (cúpula / garrafas / balão / corpo)",
      unit: "nC",
      value: (s, p) => {
        const m = mode(p);
        if (m <= 1) return capacitance(p) * s.V * 1e9;
        if (m === 2) return s.Q * 1e9;
        return s.Qb * 1e9;
      },
    },
    { key: "I", label: "Corrente de carga", unit: "μA", value: (s, p) => (mode(p) === 0 ? vdgCurrent(p) : mode(p) === 1 ? wimCurrent(s.s, omega(p)) : 0) * 1e6 },
    { key: "E", label: "Campo na superfície / na ponta", unit: "MV/m", value: (s, p) => (mode(p) === 0 ? s.V / dome(p) : mode(p) === 4 ? tipEnhancement(num(p, "h", 20), num(p, "rTip", 2) * 1e-3) * num(p, "E0", 10) * 1e3 : 0) / 1e6 },
    { key: "d", label: "Distância de descarga", unit: "mm", value: (s, p) => (mode(p) === 3 ? handGap(s) : s.gap) * 1e3 },
    { key: "n", label: "Faíscas", unit: "", value: (s) => s.sparks },
    { key: "T", label: "Intervalo entre faíscas", unit: "s", value: (s) => s.period },
    { key: "Ef", label: "Energia da última faísca", unit: "mJ", value: (s) => s.Espark * 1e3 },
    { key: "F", label: "Atração da parede sobre o balão", unit: "mN", value: (s, p) => (mode(p) === 2 ? wallForce(s.Q, balloonGap(s), num(p, "er", 5)) * 1e3 : 0) },
    { key: "yb", label: "Altura do balão", unit: "m", value: (s) => s.by },
    { key: "Ne", label: "Elétrons em excesso", unit: "×10⁹", value: (s, p) => (Math.abs(mode(p) === 2 ? s.Q : s.Qb) / E_CHARGE) / 1e9 },
    { key: "rp", label: "Raio protegido pela haste", unit: "m", value: (_s, p) => protectedRadius(num(p, "h", 20), strikeDistance(num(p, "I", 30))) },
    { key: "fc", label: "Raios que atingem a casa", unit: "%", value: (s) => (100 * s.hits.casa) / Math.max(1, s.hits.casa + s.hits.haste + s.hits.solo) },
  ],
  chart: { x: "t", y: "V" },

  scenarios: [
    {
      id: "van-de-graaff",
      label: "Van de Graaff até a faísca",
      params: { modo: 0, R: 0.2, dBola: 20, U: 40 },
      guide: `### Van de Graaff
1. A correia leva a carga $I = \\sigma w v$ para a cúpula; a tensão sobe como num capacitor $C = 4\\pi\\varepsilon_0 R$.
2. Acompanhe no gráfico o **dente de serra**: sobe até $V_{\\text{rup}} = E_{\\text{rup}}/(1/d + 1/R)$ e a faísca descarrega.
3. Arraste a esfera aterrada para longe: as faíscas ficam mais longas, mais raras e mais energéticas ($\\tfrac12 CV^2$).
4. Aumente a **umidade**: a fuga $V/R_{\\text{fuga}}$ cresce e a cúpula pode nunca chegar à ruptura.
5. Sem a esfera ($d$ grande) o limite é o próprio ar em volta: $V_{\\text{máx}} = E_{\\text{rup}} R$.`,
      predict: [
        {
          question: "Dobrando o raio da cúpula (com a esfera de descarga muito longe), a tensão máxima…",
          options: ["Dobra", "Cai pela metade", "Quadruplica", "Não muda"],
          answer: 0,
          explanation: "O ar rompe quando E = V/R atinge 3 MV/m, logo V_máx = E_rup·R: proporcional ao raio. Cúpulas grandes e lisas chegam a milhões de volts.",
        },
      ],
    },
    {
      id: "wimshurst",
      label: "Wimshurst e garrafas de Leyden",
      params: { modo: 1, rpm: 120, Cl: 200, dBola: 3, U: 25 },
      guide: `### Máquina de Wimshurst (máquina de influência)
1. Os setores começam com uma carga mínima; a indução entre os discos faz essa carga **crescer exponencialmente** (realimentação) até saturar.
2. As garrafas de Leyden acumulam $Q = CV$; a faísca salta quando $V = E_{\\text{rup}}/(1/d + 1/2r)$.
3. Meça o **intervalo entre faíscas** e compare com $T = CV_{\\text{rup}}/I$.
4. Dobre a rotação: $I$ dobra e $T$ cai pela metade. Dobre $C$: $T$ dobra e cada faísca tem o dobro da energia.`,
      predict: [
        {
          question: "Dobrando a rotação da Wimshurst (setores já saturados), o intervalo entre faíscas…",
          options: ["Cai pela metade", "Dobra", "Não muda", "Cai a um quarto"],
          answer: 0,
          explanation: "A corrente é proporcional ao número de setores que passam pelos coletores por segundo, I ∝ f. A carga necessária CV_rup é a mesma, então T = CV_rup/I cai pela metade.",
        },
      ],
    },
    {
      id: "balao",
      label: "Balão na parede",
      params: { modo: 2, U: 40, er: 5 },
      guide: `### Por que o balão gruda numa parede neutra?
1. Arraste o balão sobre o **cabelo** (ou use *Esfregar no cabelo*): o balão fica negativo e o cabelo positivo — os fios se repelem e ficam em pé.
2. Solte o balão perto da parede. As moléculas da parede se **polarizam** (veja os núcleos + puxados para o balão).
3. A atração equivale à de uma carga imagem $-\\beta Q$, com $\\beta = (\\varepsilon_r - 1)/(\\varepsilon_r + 1)$. O balão gruda se $\\mu F \\ge mg$.
4. A carga escapa com $\\tau$ que cai muito com a umidade. Quando $Q < Q_{\\text{mín}}$ o balão escorrega. Teste em dia seco e úmido.`,
      predict: [
        {
          question: "Num dia mais úmido, o mesmo balão bem esfregado…",
          options: ["Fica menos tempo grudado", "Fica mais tempo grudado", "Gruda igual", "Nem chega a ficar carregado"],
          answer: 0,
          explanation: "A umidade forma uma película condutora: a carga escapa mais rápido (τ menor) e a saturação é menor. O balão cai mais cedo.",
        },
      ],
    },
    {
      id: "travoltage",
      label: "Faísca do carpete na maçaneta",
      params: { modo: 3, Cb: 150, U: 25 },
      guide: `### John Travoltage
1. Arraste o **pé** no carpete (ou use *Arrastar o pé 10 vezes*): o corpo ganha elétrons; $V = Q/C$ com $C \\approx 150$ pF.
2. Aproxime a **mão** da maçaneta devagar. A faísca salta quando $|V|$ atinge a tensão de **Paschen** da fresta (cerca de 3 kV por mm). Veja a lupa.
3. Leia a energia $\\tfrac12 CV^2$ e o pico de corrente $V/R_{\\text{corpo}}$ — alguns ampères por nanossegundos.
4. Repita com umidade alta: a tensão máxima cai de dezenas de kV para ~1 kV e a fuga pelo sapato é rápida.`,
      predict: [
        {
          question: "Com o corpo a 9 kV, a que distância (aproximada) a faísca salta para a maçaneta?",
          options: ["Cerca de 2,5 mm", "Cerca de 3 cm", "Cerca de 0,1 mm", "Só encostando"],
          answer: 0,
          explanation: "No ar, a ruptura em frestas de milímetros fica perto de 3–4 kV/mm (curva de Paschen); 9 kV rompem cerca de 2,5 mm.",
        },
      ],
    },
    {
      id: "pontas",
      label: "Pontas e fogo-de-santelmo",
      params: { modo: 4, E0: 10, h: 20, rTip: 2, rBall: 15 },
      guide: `### Poder das pontas
1. Sob a nuvem, o campo no solo é $E_0$ (10–20 kV/m numa tempestade). Na ponta de uma haste ele é multiplicado por $\\beta \\approx 2 + h/r$.
2. Quando $E_{\\text{ponta}}$ passa do campo de corona (lei de Peek), o ar ioniza e brilha: é o **fogo-de-santelmo** dos mastros.
3. Compare as duas hastes: diminua $E_0$ até só a pontiaguda brilhar. Qual o menor $E_0$ para a esfera?
4. É por isso que as cúpulas de Van de Graaff são **lisas e grandes** e os para-raios têm ponta.`,
    },
    {
      id: "para-raios",
      label: "Para-raios e esfera rolante",
      params: { modo: 5, h: 20, I: 30 },
      guide: `### Onde o raio cai?
1. O líder desce em degraus. Quando chega a $r_s = 10 I^{0,65}$ (m) de algum objeto, salta a descarga final para ele.
2. A região verde é a **zona protegida**: a esfera de raio $r_s$ rolando pelo chão e pela haste não toca o que está dentro.
3. Arraste o para-raios para perto da casa até ela ficar toda na zona verde e use *Lançar 240 raios*.
4. Diminua a corrente: raios fracos têm $r_s$ menor e escapam da proteção (é por isso que a norma usa $r_s$ de 20 a 60 m).`,
      predict: [
        {
          question: "Para raios de corrente menor, a zona protegida por uma mesma haste…",
          options: ["Diminui", "Aumenta", "Não muda"],
          answer: 0,
          explanation: "r_s diminui com a corrente, e o raio protegido √(h(2r_s − h)) também: raios fracos chegam mais perto antes de escolher o alvo.",
        },
      ],
    },
  ],

  exercises: [
    {
      id: "vdg-tempo",
      prompt:
        "A correia (5 cm de largura) de um Van de Graaff anda a {v} m/s com densidade de carga {sigma} μC/m². A cúpula tem raio {R} m. Desprezando fugas, quanto tempo leva para o campo na superfície da cúpula atingir 3 MV/m?",
      vary: { v: [5, 20, 0], sigma: [5, 25, 0], R: [0.1, 0.35, 2] },
      fixed: { modo: 0 },
      answer: {
        label: "Tempo",
        unit: "s",
        compute: (p) => (sphereC(num(p, "R")) * E_BD * num(p, "R")) / beltCurrent(num(p, "sigma") * 1e-6, BELT_W, num(p, "v")),
      },
      hint: "V_máx = E·R, C = 4πε₀R e I = σwv; t = CV/I.",
    },
    {
      id: "balao-carga",
      prompt:
        "Um balão de {m} g é encostado numa parede com εr = {er}. Modele a carga Q a 1 cm da superfície (carga imagem −βQ a 2 cm, β = (εr−1)/(εr+1)) e μ = 0,6. Qual a carga mínima, em módulo, para ele ficar grudado? Use g = 9,81 m/s².",
      vary: { m: [2, 6, 1], er: [2, 8, 1] },
      fixed: { modo: 2 },
      answer: { label: "Carga mínima", unit: "nC", compute: (p) => minStickCharge(num(p, "er"), num(p, "m") / 1000) * 1e9 },
      hint: "μ k β Q²/(0,02 m)² = m g.",
    },
    {
      id: "travoltage-energia",
      prompt: "O corpo de uma pessoa (C = {Cb} pF) está a {kV} kV ao tocar a maçaneta. Qual a energia dissipada na faísca?",
      vary: { Cb: [100, 250, 0], kV: [3, 25, 1] },
      fixed: { modo: 3 },
      answer: { label: "Energia", unit: "mJ", compute: (p) => 0.5 * num(p, "Cb") * 1e-12 * (num(p, "kV") * 1e3) ** 2 * 1e3 },
    },
  ],

  init(p) {
    const m = mode(p);
    const gap = m === 1 ? clamp(num(p, "dBola", 3), 0.5, 8) / 100 : num(p, "dBola", 20) / 100;
    return {
      V: 0,
      s: 1e-4,
      phase: 0,
      gap,
      sparks: 0,
      lastSpark: 0,
      period: 0,
      Espark: 0,
      Ipeak: 0,
      flash: 0,
      bx: -0.3,
      by: 1.0,
      vx: 0,
      vy: 0,
      Q: 0,
      stuck: false,
      footX: 1.1,
      handX: 1.6,
      Qb: 0,
      mastX: 50,
      leader: [],
      strike: null,
      hits: { haste: 0, casa: 0, solo: 0 },
      seed: 1,
      drag: null,
      lx: 0,
      ly: 0,
    };
  },

  step(s0, p, t, dt) {
    const m = mode(p);
    let s: MState = { ...s0, phase: s0.phase, flash: m === 5 ? s0.flash : Math.max(0, s0.flash - dt) };
    if (m === 0) {
      const I = vdgCurrent(p);
      const C = capacitance(p);
      s.phase += num(p, "v", 10) * dt;
      s.V = rcStep(s.V, I, leakResistance(humidity(p)), C, dt);
      const Vs = sparkVoltage(s, p);
      if (s.V >= Vs) s = { ...spark(s, t + dt, s.V, C), V: 0 };
    } else if (m === 1) {
      const w = omega(p);
      s.phase += w * dt;
      const sm = wimSectorStep(s.s, w, dt / 2);
      s.s = wimSectorStep(s.s, w, dt);
      const C = capacitance(p);
      s.V = rcStep(s.V, wimCurrent(sm, w), leakResistance(humidity(p)), C, dt);
      const Vs = sparkVoltage(s, p);
      if (s.V >= Vs) s = { ...spark(s, t + dt, s.V, C), V: 0 };
    } else if (m === 2) {
      s = balloonStep(s, p, dt);
    } else if (m === 3) {
      const C = bodyC(p);
      s.Qb *= Math.exp(-dt / (shoeResistance(humidity(p)) * C));
      const V = Math.abs(s.Qb / C);
      if (V >= paschen(handGap(s))) s = { ...spark(s, t + dt, V, C), Qb: 0 };
    } else if (m === 4) {
      s.phase += dt;
    } else {
      s = leaderStep(s, p, dt);
    }
    return s;
  },
  dt: 0.01,
  sampleEvery: 2,
  maxSamples: 8000,

  pointer: {
    down(s, p, pt) {
      const m = mode(p);
      const at = { lx: pt.x, ly: pt.y };
      if (m === 0 && Math.hypot(pt.x - (dome(p) + s.gap + 0.06), pt.y - DOME_Y) < 0.12) return { ...s, drag: "bola", ...at };
      if (m === 1 && Math.hypot(pt.x - (s.gap / 2 + WIM_BALL), pt.y - 0.78) < 0.06) return { ...s, drag: "bola", ...at };
      if (m === 2 && Math.hypot(pt.x - s.bx, pt.y - s.by) < BALLOON_R * 1.2) return { ...s, drag: "balao", stuck: false, vx: 0, vy: 0, ...at };
      if (m === 3) {
        if (Math.hypot(pt.x - s.footX, pt.y - 0.05) < 0.15) return { ...s, drag: "pe", ...at };
        if (Math.hypot(pt.x - s.handX, pt.y - KNOB_Y) < 0.15) return { ...s, drag: "mao", ...at };
      }
      if (m === 5) {
        if (Math.abs(pt.x - s.mastX) < 4 && pt.y < num(p, "h", 20) + 4) return { ...s, drag: "haste", ...at };
        if (pt.y > 40) return { ...s, leader: [[clamp(pt.x, 2, 118), LEADER_Y0]], strike: null, flash: 0 };
      }
      return undefined;
    },
    move(s, p, pt, dragging) {
      if (!dragging || !s.drag) return undefined;
      const ds = Math.hypot(pt.x - s.lx, pt.y - s.ly);
      let n: MState = { ...s, lx: pt.x, ly: pt.y };
      switch (s.drag) {
        case "bola":
          n.gap = mode(p) === 0 ? clamp(pt.x - 0.06 - dome(p), 0.01, 0.6) : clamp(2 * (pt.x - WIM_BALL), 0.005, 0.08);
          break;
        case "balao":
          n.bx = clamp(pt.x, -1, WALL_X - BALLOON_R);
          n.by = clamp(pt.y, BALLOON_R, 1.55);
          if (Math.hypot(n.bx - HAIR[0], n.by - HAIR[1]) < BALLOON_R + 0.16) n = rubBalloon(n, p, ds);
          break;
        case "pe":
          n.footX = clamp(pt.x, CARPET[0] + 0.05, CARPET[1] - 0.05);
          n = rubFoot(n, p, Math.abs(pt.x - s.lx));
          break;
        case "mao":
          n.handX = clamp(pt.x, 1.2, KNOB_X - KNOB_R - 2e-4);
          break;
        case "haste":
          n.mastX = clamp(pt.x, 3, 117);
          break;
      }
      return n;
    },
    up: (s) => (s.drag ? { ...s, drag: null } : undefined),
    cursor(s, p, pt) {
      const m = mode(p);
      if (m === 2 && Math.hypot(pt.x - s.bx, pt.y - s.by) < BALLOON_R) return "grab";
      if (m === 3 && (Math.hypot(pt.x - s.footX, pt.y - 0.05) < 0.15 || Math.hypot(pt.x - s.handX, pt.y - KNOB_Y) < 0.15)) return "grab";
      if (m === 5) return Math.abs(pt.x - s.mastX) < 4 ? "ew-resize" : "crosshair";
      if (m <= 1) return "ew-resize";
      return undefined;
    },
  },

  actions: [
    { id: "esfregar", label: "Esfregar o balão no cabelo (5×)", run: (s, p) => (mode(p) === 2 ? rubBalloon({ ...s, bx: HAIR[0] + 0.3, by: HAIR[1], vx: 0, vy: 0 }, p, 5 * 0.4) : s) },
    { id: "pe", label: "Arrastar o pé no carpete (10×)", run: (s, p) => (mode(p) === 3 ? rubFoot(s, p, 10 * 0.6) : s) },
    { id: "tocar", label: "Encostar a mão na maçaneta", run: (s, p) => (mode(p) === 3 ? { ...s, handX: KNOB_X - KNOB_R - 2e-4 } : s) },
    { id: "afastar", label: "Afastar a mão", run: (s, p) => (mode(p) === 3 ? { ...s, handX: 1.6 } : s) },
    { id: "aterrar", label: "Descarregar (aterrar)", run: (s) => ({ ...s, V: 0, Qb: 0, Q: 0 }) },
    {
      id: "estatistica",
      label: "Lançar 240 raios (estatística)",
      run: (s, p) => (mode(p) === 5 ? { ...s, hits: strikeStats(scene(s, p), strikeDistance(num(p, "I", 30))) } : s),
    },
  ],

  viewport(p) {
    switch (mode(p)) {
      case 0:
        return { xMin: -0.9, xMax: 0.9, yMin: 0, yMax: 1.75, unit: "m" };
      case 1:
        return { xMin: -0.55, xMax: 0.55, yMin: -0.02, yMax: 0.95, unit: "m" };
      case 2:
        return { xMin: -1.1, xMax: 1.1, yMin: 0, yMax: 1.7, unit: "m" };
      case 3:
        return { xMin: 0, xMax: 2.4, yMin: 0, yMax: 2.0, unit: "m" };
      case 4: {
        const h = num(p, "h", 20);
        return { xMin: -30, xMax: 30, yMin: 0, yMax: Math.max(h, 10) * 1.6 + 10, unit: "m" };
      }
      default:
        return { xMin: 0, xMax: 120, yMin: 0, yMax: 140, unit: "m" };
    }
  },

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const { state: s, params: p } = frame;
    [renderVdG, renderWimshurst, renderBalloon, renderTravoltage, renderPoints, renderLightning][mode(p)]?.(d, s, p);
  },
});

export default maquinasEletrostaticas;
