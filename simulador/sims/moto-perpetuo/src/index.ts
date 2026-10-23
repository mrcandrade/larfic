import { defineSim, draw, formatBR, num, texNum, type Draw, type Params, type Theme } from "@fisilab/core";
import {
  COL_H,
  G,
  H_CONV,
  A_HEAD,
  H_TIP,
  LOOP,
  MAGNET,
  M_COL,
  RHO_DCM,
  SPACING,
  S_HOLE,
  TAGS,
  TAU_HEAD,
  birdCycle,
  columnHeight,
  galileoReading,
  loopAt,
  magForce,
  magPhi,
  meanTorque,
  millBalance,
  psatDCM,
  rhoLiquid,
  sides,
  terminalV,
  wetBulb,
  wheelInertia,
  wheelMasses,
  wheelTorque,
  wheelU,
  type Mill,
} from "./physics.ts";

export * from "./physics.ts";

const fmt = (v: number, d = 3) => formatBR(v, d);
const TAU = 2 * Math.PI;
const M_BALL = 0.05; // kg, bola da rampa magnética
const SPEED = [1, 1, 10, 1, 2, 30];
const DIP_TIME = 1.5; // s de animação

export interface MP {
  th: number;
  om: number;
  tf: number;
  /** Moinho: volume no reservatório de cima (m³) e ângulo da roda. */
  Vup: number;
  wa: number;
  /** Rampa magnética: posição no laço (m) e velocidade (m/s). */
  s: number;
  v: number;
  /** Pássaro: temperatura da cabeça (°C), fase (0 subindo, 1 bebendo), tempo da bebida, contagem, trabalho e calor acumulados. */
  Th: number;
  phase: number;
  tdip: number;
  ndips: number;
  W: number;
  Q: number;
  /** Galileu: temperatura do líquido (°C) e alturas das ampolas (m). */
  Tl: number;
  y: number[];
  /** Ângulo do ponteiro em relação à roda quando ela foi agarrada. */
  grab: number;
}

const modo = (p: Params) => Math.round(num(p, "modo"));
const K = (p: Params) => Math.round(num(p, "K", 8));
const mass = (p: Params) => num(p, "massa", 1);
export const millOf = (p: Params): Mill => ({
  Q: num(p, "Q", 5) / 1000,
  H: num(p, "Hq", 3),
  etaR: num(p, "etaR", 70) / 100,
  etaB: num(p, "etaB", 60) / 100,
  load: num(p, "carga", 0),
});
const V_TANK = 0.5;

export function wheelEnergy(s: MP, p: Params) {
  const kind = modo(p);
  return 0.5 * wheelInertia(K(p), mass(p)) * s.om * s.om + wheelU(kind, K(p), mass(p), s.th);
}
const magEnergy = (s: MP, p: Params) => M_BALL * (0.5 * s.v * s.v + magPhi(s.s, num(p, "kmag", 1)));

function energy(s: MP, p: Params): number {
  const m = modo(p);
  if (m <= 1) return wheelEnergy(s, p);
  if (m === 3) return magEnergy(s, p);
  return 0;
}

/** Empilha as ampolas (ordem preservada: a mais densa embaixo) dentro da coluna. */
function stack(y: number[]): number[] {
  const r = 0.012, bottom = 0.036; // a etiqueta pendurada precisa de espaço no fundo
  const out = y.slice();
  out[0] = Math.max(bottom, out[0]!);
  for (let k = 1; k < out.length; k++) out[k] = Math.max(out[k]!, out[k - 1]! + SPACING);
  out[out.length - 1] = Math.min(COL_H - r, out[out.length - 1]!);
  for (let k = out.length - 2; k >= 0; k--) out[k] = Math.min(out[k]!, out[k + 1]! - SPACING);
  return out;
}

function galileoInit(T: number): number[] {
  return stack(TAGS.map((tg) => (rhoLiquid(tg) < rhoLiquid(T) ? COL_H : 0)));
}

// ---------- Passo ----------

function wheelStep(s: MP, p: Params, dt: number): MP {
  const kind = modo(p), k = K(p), m = mass(p);
  const I = wheelInertia(k, m), b = num(p, "atrito", 0.05);
  const f = (th: number, om: number): [number, number] => [om, (wheelTorque(kind, k, m, th) - b * om) / I];
  const n = 8, h = dt / n;
  let th = s.th, om = s.om;
  for (let i = 0; i < n; i++) {
    const k1 = f(th, om), k2 = f(th + (h / 2) * k1[0], om + (h / 2) * k1[1]);
    const k3 = f(th + (h / 2) * k2[0], om + (h / 2) * k2[1]), k4 = f(th + h * k3[0], om + h * k3[1]);
    th += (h / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]);
    om += (h / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
  }
  return { ...s, th, om, tf: s.tf + dt };
}

function magStep(s: MP, p: Params, dt: number): MP {
  const km = num(p, "kmag", 1), b = 2 * num(p, "atrito", 0.05);
  const n = 40, h = dt / n;
  let x = s.s, v = s.v;
  for (let i = 0; i < n; i++) {
    v += 0.5 * h * (magForce(x, km) - b * v);
    x += h * v;
    v += 0.5 * h * (magForce(x, km) - b * v);
  }
  return { ...s, s: x, v, tf: s.tf + dt };
}

function birdStep(s: MP, p: Params, dt: number): MP {
  const t = num(p, "Tar", 25), ur = num(p, "UR", 50) / 100;
  const dtf = dt * SPEED[4]!;
  const tu = wetBulb(t, ur);
  const n = { ...s, tf: s.tf + dtf, Q: s.Q + H_CONV * A_HEAD * Math.max(0, t - s.Th) * dtf };
  if (s.phase === 1) {
    n.tdip = s.tdip + dt;
    if (n.tdip >= DIP_TIME) {
      n.phase = 0;
      n.tdip = 0;
      n.Th = t; // bico molhado de novo e vapor equalizado: a cabeça volta à temperatura do corpo
    }
    return n;
  }
  n.Th = tu + (s.Th - tu) * Math.exp(-dtf / TAU_HEAD);
  if (columnHeight(t, n.Th) >= H_TIP) {
    n.phase = 1;
    n.tdip = 0;
    n.ndips = s.ndips + 1;
    n.W = s.W + M_COL * G * H_TIP;
  }
  return n;
}

function galileoStep(s: MP, p: Params, dt: number): MP {
  const dtf = dt * SPEED[5]!;
  const Ta = num(p, "Tamb", 24);
  const Tl = Ta + (s.Tl - Ta) * Math.exp(-dtf / 600);
  const y = stack(s.y.map((yy, k) => yy + terminalV(TAGS[k]!, Tl) * dtf));
  return { ...s, Tl, y, tf: s.tf + dtf };
}

// ---------- Desenho ----------

const WC = { x: 3.9, y: 4.6, k: 3.0 };
const PL = { x0: 9.0, x1: 15.5, y0: 4.6, y1: 8.4 };

function plotFrame(d: Draw, theme: Theme, xl: string, yl: string, box = PL) {
  d.line(box.x0, box.y0, box.x1, box.y0, { color: theme.muted });
  d.line(box.x0, box.y0, box.x0, box.y1, { color: theme.muted });
  d.text(xl, box.x1, box.y0 - 0.3, { size: 10, align: "right", color: theme.muted });
  d.text(yl, box.x0, box.y1 + 0.25, { size: 10, align: "left", color: theme.muted });
}

function info(d: Draw, lines: [string, string?][], theme: Theme, x = 9.0, y = 3.7) {
  lines.forEach(([t, c], k) => d.text(t, x, y - k * 0.48, { size: k === 0 ? 12 : 11, weight: k === 0 ? "700" : "400", align: "left", color: c ?? theme.text }));
}

function renderWheel(d: Draw, s: MP, p: Params, theme: Theme) {
  const kind = modo(p), k = K(p), m = mass(p);
  const X = (x: number) => WC.x + WC.k * x, Y = (y: number) => WC.y + WC.k * y;
  d.line(WC.x, 0.4, WC.x, 8.6, { color: theme.grid, dash: [5, 5] });
  d.circle(WC.x, WC.y, WC.k, { stroke: theme.text, width: 3 });
  const pts = wheelMasses(kind, k, s.th);
  for (let i = 0; i < k; i++) {
    const phi = s.th + (TAU * i) / k;
    const c = Math.cos(phi), sn = Math.sin(phi);
    d.line(WC.x, WC.y, X(c), Y(sn), { color: theme.muted, width: 1.5 });
    if (kind === 0) {
      const a = [0.3 * c, 0.3 * sn], b = [0.92 * c + 0.32 * sn, 0.92 * sn - 0.32 * c];
      d.line(X(a[0]!), Y(a[1]!), X(b[0]!), Y(b[1]!), { color: theme.accent, width: 7, alpha: 0.35 });
    } else {
      d.line(X(0.62 * c), Y(0.62 * sn), X(pts[i]![0]), Y(pts[i]![1]), { color: theme.text, width: 2.5 });
      d.dot(X(0.62 * c), Y(0.62 * sn), 3, theme.text);
    }
  }
  for (const [x, y] of pts) {
    d.circle(X(x), Y(y), 0.2, { fill: x < 0 ? theme.series[0]! : theme.series[1]!, stroke: theme.text, width: 1 });
    d.arrowPx(X(x), Y(y) - 0.2, 0, -1, 14 * Math.sqrt(m), { color: theme.muted, width: 1.2, head: 6 });
  }
  d.dot(WC.x, WC.y, 5, theme.text);
  const sd = sides(kind, k, s.th);
  d.text(`esquerda: ${sd.nL} pesos, Σx = ${fmt(sd.armL, 3)} m`, WC.x - 0.2, 0.75, { size: 10, align: "right", color: theme.series[0] });
  d.text(`direita: ${sd.nR} pesos, Σx = ${fmt(sd.armR, 3)} m`, WC.x + 0.2, 0.75, { size: 10, align: "left", color: theme.series[1] });
  d.text("arraste a roda para girá-la", WC.x, 8.75, { size: 9, color: theme.muted });
  // τ(θ) numa volta
  const tmax = Math.max(1e-6, ...Array.from({ length: 361 }, (_, i) => Math.abs(wheelTorque(kind, k, m, (TAU * i) / 360))));
  const px = (th: number) => PL.x0 + (th / TAU) * (PL.x1 - PL.x0);
  const pmid = (PL.y0 + PL.y1) / 2;
  const py = (t: number) => pmid + (t / tmax) * (PL.y1 - pmid) * 0.9;
  plotFrame(d, theme, "θ (uma volta)", "torque da gravidade τ(θ)");
  d.line(PL.x0, pmid, PL.x1, pmid, { color: theme.muted, width: 1 });
  const curve: [number, number][] = Array.from({ length: 361 }, (_, i) => [px((TAU * i) / 360), py(wheelTorque(kind, k, m, (TAU * i) / 360))]);
  d.polyline([[PL.x0, pmid], ...curve, [PL.x1, pmid]], { color: "none", fill: theme.dark ? "rgba(91,156,240,0.18)" : "rgba(47,125,225,0.14)", close: true });
  d.polyline(curve, { color: theme.accent, width: 2 });
  const thm = ((s.th % TAU) + TAU) % TAU;
  d.dot(px(thm), py(wheelTorque(kind, k, m, s.th)), 6, theme.series[1]!);
  d.text(`±${fmt(tmax)} N·m`, PL.x0 + 0.1, PL.y1 - 0.1, { size: 9, align: "left", color: theme.muted });
  const avg = meanTorque(kind, k, m, 7200);
  const I = wheelInertia(k, m);
  info(d, [
    [`⟨τ⟩ numa volta = ${fmt(Math.abs(avg) < 1e-9 ? 0 : avg, 2)} N·m (≈ 0 frente a ±${fmt(tmax, 2)} N·m)`, theme.positive],
    [`∮τ dθ = −ΔU = 0: as áreas acima e abaixo do eixo se cancelam`],
    [`τ agora = ${fmt(wheelTorque(kind, k, m, s.th))} N·m · ω = ${fmt(s.om)} rad/s`],
    [`E = ½Iω² + U = ${fmt(wheelEnergy(s, p))} J (I = ${fmt(I)} kg·m²)`],
    [`a energia só diminui: o atrito a dissipa e nada a repõe`, theme.muted],
  ], theme);
}

function renderMill(d: Draw, s: MP, p: Params, theme: Theme) {
  const ml = millOf(p);
  const b = millBalance(ml);
  const water = "rgba(70,140,230,0.55)";
  // Reservatório de cima
  const T = { x0: 2.0, x1: 4.8, y0: 6.0, y1: 8.2 };
  const lvl = T.y0 + (T.y1 - T.y0 - 0.2) * Math.max(0, s.Vup / V_TANK);
  d.rect(T.x0, T.y0, T.x1 - T.x0, lvl - T.y0, { fill: water });
  d.polyline([[T.x0, T.y1], [T.x0, T.y0], [T.x1, T.y0], [T.x1, T.y1]], { color: theme.text, width: 2.5 });
  d.text(`${fmt(s.Vup * 1000)} L`, (T.x0 + T.x1) / 2, T.y1 + 0.25, { size: 11, weight: "600" });
  const flowing = s.Vup > 0;
  // Calha até a roda
  d.line(T.x1, T.y0 + 0.2, 5.9, 5.6, { color: theme.text, width: 3 });
  if (flowing) d.line(T.x1, T.y0 + 0.32, 5.9, 5.72, { color: "rgba(70,140,230,0.9)", width: 5 });
  // Roda d'água
  const wc = { x: 6.3, y: 4.0, r: 1.3 };
  d.circle(wc.x, wc.y, wc.r, { stroke: theme.text, width: 2.5 });
  for (let i = 0; i < 12; i++) {
    const a = -s.wa + (TAU * i) / 12;
    d.line(wc.x + 0.3 * Math.cos(a), wc.y + 0.3 * Math.sin(a), wc.x + (wc.r + 0.25) * Math.cos(a), wc.y + (wc.r + 0.25) * Math.sin(a), { color: theme.text, width: 2 });
  }
  d.dot(wc.x, wc.y, 4, theme.text);
  if (flowing) for (let k = 0; k < 4; k++) d.circle(wc.x + wc.r + 0.1, wc.y + 1 - ((s.wa * 0.3 + k * 0.25) % 1) * 2.8, 0.08, { fill: "rgba(70,140,230,0.9)" });
  // Poço de baixo
  d.rect(0.5, 0.4, 7.2, 0.8, { fill: water });
  d.polyline([[0.5, 1.6], [0.5, 0.4], [7.7, 0.4], [7.7, 1.6]], { color: theme.text, width: 2.5 });
  // Parafuso de Arquimedes do poço ao reservatório (acionado pela roda)
  const a0: [number, number] = [0.9, 0.7], a1: [number, number] = [1.6, 8.5];
  const ux = a1[0] - a0[0], uy = a1[1] - a0[1], L = Math.hypot(ux, uy);
  const nx = -uy / L, ny = ux / L;
  d.line(a0[0] + 0.3 * nx, a0[1] + 0.3 * ny, a1[0] + 0.3 * nx, a1[1] + 0.3 * ny, { color: theme.text, width: 2 });
  d.line(a0[0] - 0.3 * nx, a0[1] - 0.3 * ny, a1[0] - 0.3 * nx, a1[1] - 0.3 * ny, { color: theme.text, width: 2 });
  for (let i = 0; i < 14; i++) {
    const f = ((i + (s.wa * 0.5) % 1) / 14);
    const cx = a0[0] + ux * f, cy = a0[1] + uy * f;
    d.line(cx - 0.28 * nx, cy - 0.28 * ny, cx + 0.28 * nx + 0.12 * ux / L, cy + 0.28 * ny + 0.12 * uy / L, { color: theme.accent, width: 2 });
  }
  if (b.Qp > 0 && flowing) d.arrowPx(a1[0] + 0.1, a1[1] - 0.1, 1, -0.6, 26, { color: "rgba(70,140,230,0.9)" });
  d.line(wc.x, wc.y, (a0[0] + a1[0]) / 2 + 0.3 * nx, (a0[1] + a1[1]) / 2 + 0.3 * ny, { color: theme.muted, width: 1.5, dash: [4, 3] });
  d.text("transmissão", 3.9, 3.2, { size: 9, color: theme.muted });
  // Balanço de potências
  const bars: [string, number, string][] = [
    ["ρgQH (a queda entrega)", b.Pdisp, theme.muted],
    ["roda (η_roda·ρgQH)", b.Proda, theme.accent],
    ["para bombear tudo de volta", b.Pnecessaria, theme.positive],
  ];
  const pmax = Math.max(...bars.map((x) => x[1]), 1);
  bars.forEach(([lab, v, c], k) => {
    const y = 8.1 - k * 0.8;
    d.text(lab, 9.0, y + 0.25, { size: 10, align: "left", color: theme.muted });
    d.rect(9.0, y - 0.2, 6.3 * (v / pmax), 0.3, { fill: c });
    d.text(`${fmt(v)} W`, 9.0 + 6.3 * (v / pmax) - 0.05, y - 0.05, { size: 10, align: "right", color: "#ffffff", weight: "600" });
  });
  const tEmpty = b.deficit > 0 ? s.Vup / b.deficit : Infinity;
  info(d, [
    [`volta ao reservatório: ${fmt(b.Qp * 1000)} L/s de ${fmt(ml.Q * 1000)} L/s`, theme.positive],
    [`Q_volta = η_roda·η_bomba·Q (sem carga)`],
    [b.deficit > 0 ? `déficit de ${fmt(b.deficit * 1000)} L/s: esvazia em ${fmt(tEmpty)} s` : "sem déficit: só com rendimentos de 100% e nenhuma carga"],
    [`tempo: ${fmt(s.tf)} s (acelerado ${SPEED[2]}×)`, theme.muted],
  ], theme, 9.0, 5.4);
}

const MX = (x: number) => 4.3 + 1.6 * x, MY = (y: number) => 3.0 + 1.6 * y;

function renderMagnet(d: Draw, s: MP, p: Params, theme: Theme) {
  const km = num(p, "kmag", 1);
  const n = LOOP.raw.length;
  const ramp = LOOP.raw.slice(0, 121).map(([x, y]): [number, number] => [MX(x), MY(y)]);
  const chute = [...LOOP.raw.slice(120), LOOP.raw[0]!].map(([x, y]): [number, number] => [MX(x), MY(y)]);
  void n;
  d.polyline(ramp, { color: theme.text, width: 4 });
  d.polyline(chute, { color: theme.muted, width: 3 });
  const [hx, hy] = loopAt(S_HOLE);
  d.circle(MX(hx), MY(hy), 0.18, { stroke: theme.positive, width: 2 });
  d.text("furo", MX(hx) - 0.35, MY(hy) + 0.25, { size: 9, color: theme.positive });
  // Ímã
  d.rect(MX(MAGNET[0]) - 0.35, MY(MAGNET[1]), 0.7, 0.35, { fill: "#d9453b" });
  d.rect(MX(MAGNET[0]) - 0.35, MY(MAGNET[1]) + 0.35, 0.7, 0.35, { fill: "#2f6fd9" });
  d.text("N", MX(MAGNET[0]), MY(MAGNET[1]) + 0.17, { size: 10, color: "#ffffff", weight: "700" });
  d.text("S", MX(MAGNET[0]), MY(MAGNET[1]) + 0.52, { size: 10, color: "#ffffff", weight: "700" });
  d.text("ímã", MX(MAGNET[0]) - 0.5, MY(MAGNET[1]) + 0.35, { size: 10, align: "right", color: theme.muted });
  const [bx, by] = loopAt(s.s);
  d.circle(MX(bx), MY(by), 0.16, { fill: theme.series[5]!, stroke: theme.text, width: 1 });
  const F = magForce(s.s, km);
  const [ax, ay] = loopAt(s.s + 0.01);
  d.arrowPx(MX(bx), MY(by), (ax - bx) * Math.sign(F), (ay - by) * Math.sign(F), Math.min(60, 4 * Math.abs(F)), { color: theme.accent });
  d.text("rampa", MX(-1.2), MY(0.5) + 0.35, { size: 10, color: theme.muted });
  d.text("calha de retorno", MX(-0.5), MY(-0.35) - 0.35, { size: 10, color: theme.muted });
  // Φ(s) ao longo do laço
  const L = LOOP.length;
  const vals = Array.from({ length: 401 }, (_, i) => magPhi((L * i) / 400, km));
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const px = (u: number) => PL.x0 + (u / L) * (PL.x1 - PL.x0);
  const py = (v: number) => PL.y0 + ((v - lo) / Math.max(1e-9, hi - lo)) * (PL.y1 - PL.y0) * 0.92;
  plotFrame(d, theme, "posição no laço s (m)", "energia potencial por massa (J/kg)");
  d.polyline(vals.map((v, i): [number, number] => [px((L * i) / 400), py(v)]), { color: theme.accent, width: 2 });
  d.line(px(S_HOLE), PL.y0, px(S_HOLE), PL.y1, { color: theme.positive, dash: [4, 4], width: 1 });
  d.text("furo", px(S_HOLE), PL.y1 + 0.05, { size: 9, color: theme.positive });
  const su = ((s.s % L) + L) % L;
  d.dot(px(su), py(magPhi(s.s, km)), 6, theme.series[5]!);
  const e = magEnergy(s, p) / M_BALL;
  d.line(PL.x0, py(e), PL.x1, py(e), { color: theme.series[1], dash: [6, 4] });
  info(d, [
    [`∮F·ds = Φ(fim) − Φ(início) = 0`, theme.positive],
    [`a força do ímã é conservativa: o mesmo ímã que puxa a bola`],
    [`rampa acima a puxa de volta quando ela cai pelo furo`],
    [`v = ${fmt(s.v)} m/s · E = ${fmt(magEnergy(s, p))} J (bola de ${M_BALL * 1000} g)`],
    [`a bola acaba presa no fundo do poço de potencial`, theme.muted],
  ], theme);
}

const BIRD = { x: 4.6, y: 3.4 };

function renderBird(d: Draw, s: MP, p: Params, theme: Theme) {
  const t = num(p, "Tar", 25), ur = num(p, "UR", 50) / 100;
  const h = Math.max(0, columnHeight(t, s.Th));
  const cyc = birdCycle(t, ur);
  const tilt = s.phase === 1 ? (30 + 72 * Math.sin((Math.PI * s.tdip) / DIP_TIME)) : 30 * Math.min(1, h / H_TIP) ** 2 + 2 * Math.sin(s.tf * 2.2);
  const a = (tilt * Math.PI) / 180;
  const rot = (u: number, w: number): [number, number] => [BIRD.x - u * Math.sin(a) + w * Math.cos(a), BIRD.y + u * Math.cos(a) + w * Math.sin(a)];
  // Suporte e copo
  d.polyline([[BIRD.x - 0.9, 0.4], [BIRD.x, BIRD.y], [BIRD.x + 0.9, 0.4]], { color: theme.muted, width: 2 });
  d.rect(0.6, 0.4, 1.8, 2.4, { stroke: theme.text, width: 2 });
  d.rect(0.65, 0.45, 1.7, 2.0, { fill: "rgba(70,140,230,0.4)" });
  // Tubo, corpo, cabeça
  const tubeA = rot(-1.3, 0), tubeB = rot(2.9, 0);
  d.line(tubeA[0], tubeA[1], tubeB[0], tubeB[1], { color: theme.muted, width: 7, alpha: 0.5 });
  const colTop = rot(-1.3 + 0.2 + (s.phase === 1 ? 4.0 * Math.sin((Math.PI * s.tdip) / DIP_TIME) : 3.6 * Math.min(1, h / H_TIP)), 0);
  d.line(tubeA[0], tubeA[1], colTop[0], colTop[1], { color: "#d9453b", width: 4 });
  const body = rot(-1.3, 0);
  d.circle(body[0], body[1], 0.75, { fill: "rgba(217,69,59,0.45)", stroke: theme.text, width: 1.5 });
  const head = rot(3.2, 0);
  d.circle(head[0], head[1], 0.45, { fill: theme.series[0]!, stroke: theme.text, width: 1.5, alpha: 0.9 });
  const beak = rot(3.15, -0.95);
  d.polyline([rot(3.3, -0.35), beak, rot(3.05, -0.35)], { color: theme.series[5]!, width: 3, fill: theme.series[5]!, close: true });
  d.dot(BIRD.x, BIRD.y, 4, theme.text);
  d.text(`cabeça ${fmt(s.Th)} °C`, head[0] + 0.6, head[1] + 0.2, { size: 10, align: "left" });
  d.text(`corpo ${fmt(t)} °C`, body[0] + 0.85, body[1], { size: 10, align: "left" });
  d.text(s.phase === 1 ? "bebendo: as pressões se igualam" : `coluna: ${fmt(100 * h, 2)} cm de ${fmt(100 * H_TIP, 2)} cm`, 3.6, 8.7, { size: 11, weight: "600" });
  // Pressão de vapor do diclorometano
  const box = { x0: 9.0, x1: 15.5, y0: 4.6, y1: 8.4 };
  const T0 = 0, T1 = 40, P1 = 120e3;
  const px = (tt: number) => box.x0 + ((tt - T0) / (T1 - T0)) * (box.x1 - box.x0);
  const py = (P: number) => box.y0 + (P / P1) * (box.y1 - box.y0);
  plotFrame(d, theme, "T (°C)", "pressão de vapor do CH₂Cl₂ (kPa)", box);
  for (let tt = 0; tt <= 40; tt += 10) d.text(`${tt}`, px(tt), box.y0 - 0.22, { size: 9, color: theme.muted });
  for (let P = 0; P <= 120e3; P += 40e3) d.text(`${P / 1000}`, box.x0 - 0.1, py(P), { size: 9, align: "right", color: theme.muted });
  d.plot((x) => py(psatDCM(T0 + ((x - box.x0) / (box.x1 - box.x0)) * (T1 - T0))), box.x0, box.x1, { color: theme.accent, width: 2 });
  d.dot(px(t), py(psatDCM(t)), 5, "#d9453b");
  d.dot(px(s.Th), py(psatDCM(s.Th)), 5, theme.series[0]!);
  d.line(px(t) + 0.15, py(psatDCM(s.Th)), px(t) + 0.15, py(psatDCM(t)), { color: theme.text, width: 2 });
  d.text(`Δp = ${fmt((psatDCM(t) - psatDCM(s.Th)) / 1000)} kPa`, px(t) + 0.25, py(psatDCM(t)) - 0.25, { size: 10, align: "left" });
  info(d, [
    [Number.isFinite(cyc.period) ? `período ≈ ${fmt(cyc.period)} s · ${s.ndips} goles` : "UR alta demais: a cabeça não esfria o bastante", Number.isFinite(cyc.period) ? theme.text : theme.positive],
    [`bulbo úmido ${fmt(cyc.tu)} °C (ΔT máx. = ${fmt(cyc.dT)} K)`],
    [`trabalho por gole ${fmt(cyc.W * 1000)} mJ · calor ${fmt(cyc.Q)} J`],
    [`rendimento ≈ ${fmt(100 * cyc.eta)} % · Carnot ${fmt(100 * cyc.carnot)} %`, theme.accent],
    [`a energia vem do ar: é uma máquina térmica, não moto-perpétuo`, theme.muted],
  ], theme);
}

function renderGalileo(d: Draw, s: MP, p: Params, theme: Theme) {
  const C = { x0: 2.0, x1: 4.6, y0: 0.6, y1: 8.4 };
  const k = (C.y1 - C.y0) / COL_H;
  d.rect(C.x0, C.y0, C.x1 - C.x0, C.y1 - C.y0, { fill: "rgba(150,200,240,0.18)", stroke: theme.text, width: 2.5 });
  const cols = theme.series;
  TAGS.forEach((tg, i) => {
    const y = C.y0 + k * s.y[i]!;
    const x = (C.x0 + C.x1) / 2 + (i % 2 ? 0.35 : -0.35);
    d.line(x, y - 0.3, x, y - 0.55, { color: theme.muted, width: 1 });
    d.rect(x - 0.32, y - 0.75, 0.64, 0.22, { fill: theme.dark ? "#2a3240" : "#ffffff", stroke: theme.muted, width: 1 });
    d.text(`${tg} °C`, x, y - 0.64, { size: 9, weight: "600" });
    d.circle(x, y, 0.3, { fill: cols[i % cols.length]!, stroke: theme.text, width: 1, alpha: 0.85 });
  });
  const reading = galileoReading(s.Tl);
  d.text(Number.isFinite(reading) ? `leitura: ${reading} °C (menor ampola que flutua)` : "todas afundaram: acima da escala", (C.x0 + C.x1) / 2, 8.75, { size: 11, weight: "600" });
  d.text(`líquido a ${fmt(s.Tl)} °C · ambiente ${fmt(num(p, "Tamb", 24))} °C`, 5.0, 4.5, { size: 10, align: "left", color: theme.muted });
  // ρ × T
  const T0 = 12, T1 = 32;
  const r0 = rhoLiquid(T1) - 1, r1 = rhoLiquid(T0) + 1;
  const px = (t: number) => PL.x0 + ((t - T0) / (T1 - T0)) * (PL.x1 - PL.x0);
  const py = (r: number) => PL.y0 + ((r - r0) / (r1 - r0)) * (PL.y1 - PL.y0);
  plotFrame(d, theme, "T (°C)", "densidade (kg/m³)");
  for (let t = T0; t <= T1; t += 4) d.text(`${t}`, px(t), PL.y0 - 0.22, { size: 9, color: theme.muted });
  for (const r of [r0 + 1, (r0 + r1) / 2, r1 - 1]) d.text(fmt(r, 4), PL.x0 - 0.1, py(r), { size: 9, align: "right", color: theme.muted });
  d.plot((x) => py(rhoLiquid(T0 + ((x - PL.x0) / (PL.x1 - PL.x0)) * (T1 - T0))), PL.x0, PL.x1, { color: theme.accent, width: 2 });
  TAGS.forEach((tg, i) => {
    const r = rhoLiquid(tg);
    d.line(PL.x0, py(r), PL.x1, py(r), { color: cols[i % cols.length]!, width: 1, alpha: 0.6 });
    d.text(`${tg}`, PL.x1, py(r), { size: 9, dx: 3, align: "left", color: cols[i % cols.length] });
  });
  d.line(px(s.Tl), PL.y0, px(s.Tl), PL.y1, { color: theme.positive, width: 2 });
  info(d, [
    [`ρ_líquido = ${fmt(rhoLiquid(s.Tl), 5)} kg/m³`],
    [`ampola flutua se ρ_ampola < ρ_líquido (empuxo > peso)`],
    [`linhas abaixo da curva no instante atual: flutuam`],
    [`β = 1,0 × 10⁻³ /K: 2 °C mudam ρ em ${fmt(2 * 1e-3 * 800, 2)} kg/m³`, theme.muted],
  ], theme);
}

export const motoPerpetuo = defineSim<MP>({
  id: "moto-perpetuo",
  title: "Moto-perpétuo, pássaro bebedor e termômetro de Galileu",
  course: "FG II",
  topic: "Termodinâmica",
  priority: "P2",
  summary:
    "Quatro máquinas clássicas de moto-perpétuo (roda de Bhaskara, braços articulados, moinho que bombeia a própria água e rampa magnética) com o cálculo que mostra onde falham, e duas máquinas reais que parecem mágicas: o pássaro bebedor e o termômetro de Galileu.",
  equations: [
    String.raw`\oint \tau\,d\theta = -\oint dU = 0 \quad (U \text{ periódica}) \qquad I\dot\omega = \tau(\theta) - b\,\omega`,
    String.raw`Q_{\text{volta}} = \eta_{roda}\,\eta_{bomba}\,Q < Q \qquad \oint \mathbf F\cdot d\mathbf s = 0 \ \text{(força conservativa)}`,
    String.raw`h = \frac{p_v(T_{corpo}) - p_v(T_{cabeça})}{\rho g} \qquad \eta \le 1 - \frac{T_{u}}{T_{ar}}`,
    String.raw`\rho_{líq}(T) = \frac{\rho_{20}}{1+\beta(T-20\,^\circ\text{C})} \qquad \text{flutua se } \rho_{ampola} < \rho_{líq}`,
  ],
  liveEquations(s, p) {
    const m = modo(p);
    if (m <= 1) {
      return [String.raw`\tau = -mg\sum x_i = ${texNum(wheelTorque(m, K(p), mass(p), s.th))}\ \text{N·m} \qquad \langle\tau\rangle = ${texNum(Math.abs(meanTorque(m, K(p), mass(p), 7200)) < 1e-9 ? 0 : meanTorque(m, K(p), mass(p), 7200))}\ \text{N·m}`];
    }
    if (m === 2) {
      const ml = millOf(p), b = millBalance(ml);
      return [String.raw`Q_{volta} = ${texNum(ml.etaR)} \times ${texNum(ml.etaB)} \times ${texNum(ml.Q * 1000)}\ \text{L/s} ${ml.load > 0 ? "- \\text{carga}" : ""} = ${texNum(b.Qp * 1000)}\ \text{L/s}`];
    }
    if (m === 3) return [String.raw`E = m\left(\tfrac12 v^2 + \Phi\right) = ${texNum(magEnergy(s, p))}\ \text{J}`];
    if (m === 4) {
      const t = num(p, "Tar", 25);
      return [String.raw`h = \frac{${texNum(psatDCM(t))} - ${texNum(psatDCM(s.Th))}}{${RHO_DCM} \times 9{,}81}\ \text{m} = ${texNum(100 * Math.max(0, columnHeight(t, s.Th)))}\ \text{cm}`];
    }
    return [String.raw`\rho_{líq}(${texNum(s.Tl)}\ ^\circ\text{C}) = ${texNum(rhoLiquid(s.Tl), 5)}\ \text{kg/m}^3`];
  },

  params: [
    {
      key: "modo",
      label: "Máquina",
      unit: "",
      min: 0,
      max: 5,
      step: 1,
      default: 0,
      options: [
        { value: 0, label: "Roda de Bhaskara (bolas em tubos)" },
        { value: 1, label: "Roda com braços articulados" },
        { value: 2, label: "Moinho que bombeia a própria água" },
        { value: 3, label: "Rampa magnética" },
        { value: 4, label: "Pássaro bebedor" },
        { value: 5, label: "Termômetro de Galileu" },
      ],
    },
    { key: "K", label: "Número de pesos na roda", unit: "", min: 4, max: 16, step: 1, default: 8 },
    { key: "massa", label: "Massa de cada peso", unit: "kg", min: 0.2, max: 5, step: 0.1, default: 1 },
    { key: "w0", label: "Empurrão inicial (roda)", unit: "rad/s", min: -6, max: 6, step: 0.1, default: 3 },
    { key: "atrito", label: "Atrito (roda: N·m·s; bola: 2× em 1/s)", unit: "", min: 0, max: 1, step: 0.01, default: 0.05, live: true },
    { key: "Q", label: "Vazão pela roda d'água", unit: "L/s", min: 1, max: 20, step: 0.5, default: 5, live: true },
    { key: "Hq", label: "Altura de queda", unit: "m", min: 1, max: 6, step: 0.1, default: 3 },
    { key: "etaR", label: "Rendimento da roda d'água", unit: "%", min: 10, max: 100, step: 1, default: 70, live: true },
    { key: "etaB", label: "Rendimento da bomba", unit: "%", min: 10, max: 100, step: 1, default: 60, live: true },
    { key: "carga", label: "Potência retirada (moer grãos)", unit: "W", min: 0, max: 200, step: 5, default: 0, live: true },
    { key: "kmag", label: "Intensidade do ímã", unit: "", min: 0, max: 3, step: 0.05, default: 1, live: true },
    { key: "v0", label: "Velocidade inicial da bola", unit: "m/s", min: 0, max: 8, step: 0.1, default: 5 },
    { key: "Tar", label: "Temperatura do ar (pássaro)", unit: "°C", min: 5, max: 40, step: 0.5, default: 25, live: true },
    { key: "UR", label: "Umidade relativa (pássaro)", unit: "%", min: 10, max: 100, step: 1, default: 50, live: true },
    { key: "Tamb", label: "Temperatura ambiente (Galileu)", unit: "°C", min: 10, max: 32, step: 0.5, default: 24, live: true },
    { key: "Tini", label: "Temperatura inicial do líquido (Galileu)", unit: "°C", min: 10, max: 32, step: 0.5, default: 17 },
  ],

  observables: [
    { key: "th", label: "Ângulo da roda", unit: "°", value: (s) => (s.th * 180) / Math.PI },
    { key: "om", label: "Velocidade angular da roda", unit: "rad/s", value: (s) => s.om },
    { key: "tau", label: "Torque da gravidade", unit: "N·m", value: (s, p) => (modo(p) <= 1 ? wheelTorque(modo(p), K(p), mass(p), s.th) : 0) },
    { key: "E", label: "Energia mecânica", unit: "J", value: (s, p) => energy(s, p) },
    { key: "tauMed", label: "Torque médio numa volta", unit: "N·m", value: (_s, p) => (modo(p) <= 1 ? meanTorque(modo(p), K(p), mass(p), 3600) : 0) },
    { key: "Vup", label: "Água no reservatório de cima", unit: "L", value: (s) => s.Vup * 1000 },
    { key: "Qvolta", label: "Vazão bombeada de volta", unit: "L/s", value: (_s, p) => millBalance(millOf(p)).Qp * 1000 },
    { key: "vb", label: "Velocidade da bola", unit: "m/s", value: (s) => s.v },
    { key: "h", label: "Altura da coluna no pássaro", unit: "cm", value: (s, p) => 100 * Math.max(0, columnHeight(num(p, "Tar", 25), s.Th)) },
    { key: "Th", label: "Temperatura da cabeça", unit: "°C", value: (s) => s.Th },
    { key: "goles", label: "Goles", unit: "", value: (s) => s.ndips },
    { key: "periodo", label: "Período previsto do pássaro", unit: "s", value: (_s, p) => { const c = birdCycle(num(p, "Tar", 25), num(p, "UR", 50) / 100); return Number.isFinite(c.period) ? c.period : 0; } },
    { key: "etaP", label: "Rendimento do pássaro", unit: "%", value: (_s, p) => 100 * birdCycle(num(p, "Tar", 25), num(p, "UR", 50) / 100).eta },
    { key: "Tl", label: "Temperatura do líquido (Galileu)", unit: "°C", value: (s) => s.Tl },
    { key: "leitura", label: "Leitura do termômetro de Galileu", unit: "°C", value: (s) => { const r = galileoReading(s.Tl); return Number.isFinite(r) ? r : 0; } },
    { key: "tf", label: "Tempo físico", unit: "s", value: (s) => s.tf },
  ],
  chart: { x: "t", y: "E" },
  conserved: "E",

  scenarios: [
    {
      id: "bhaskara",
      label: "Roda de Bhaskara",
      params: { modo: 0, K: 8, massa: 1, w0: 3, atrito: 0.05 },
      guide: `### A roda que "sempre pesa mais de um lado"
1. Pare a roda (atrito alto) e gire-a à mão arrastando: conte os pesos de cada lado e a soma dos braços $\\sum x$. Um lado tem pesos mais longe do eixo; o outro tem **mais** pesos.
2. Veja o gráfico $\\tau(\\theta)$: as áreas acima e abaixo do zero são iguais. O torque médio numa volta é **zero**, porque $\\oint \\tau\\,d\\theta = -\\oint dU = 0$.
3. Rode com o empurrão inicial e atrito zero: a energia fica constante e a roda só oscila ou gira por inércia. Com atrito, ela para.`,
      predict: [
        {
          question: "Sem atrito nenhum, depois de um empurrão a roda de Bhaskara:",
          options: ["Acelera para sempre", "Gira com energia constante (velocidade oscilando), sem ganhar energia", "Para em poucas voltas"],
          answer: 1,
          explanation: "O torque da gravidade vem de um potencial periódico: em cada volta o trabalho total é zero. Sem atrito a energia se conserva; não há sobra para realizar trabalho.",
        },
      ],
    },
    {
      id: "bracos",
      label: "Braços articulados",
      params: { modo: 1, K: 10, massa: 1, w0: 2, atrito: 0.05 },
      guide: `### Pesos que se dobram
Os braços se estendem num lado e se dobram no outro. Mesmo assim $\\langle\\tau\\rangle = 0$: cada configuração depende só do ângulo da roda, e a energia potencial volta ao mesmo valor depois de uma volta.`,
    },
    {
      id: "moinho",
      label: "Moinho que se realimenta",
      params: { modo: 2, Q: 5, Hq: 3, etaR: 70, etaB: 60, carga: 0 },
      guide: `### O moinho de Fludd (1618)
1. A água cai do reservatório, gira a roda, e a roda aciona um parafuso de Arquimedes que devolve água para cima.
2. Compare as barras: para devolver toda a água seria preciso $\\rho g Q H/\\eta_b$, mais do que a roda fornece.
3. Ponha os dois rendimentos em 100%: agora volta tudo, mas não sobra **nada** para moer grãos (aumente a carga e veja).`,
      predict: [
        {
          question: "Com roda de 70% e bomba de 60%, que fração da água volta para cima?",
          options: ["100%", "70%", "42%", "60%"],
          answer: 2,
          explanation: "$Q_{volta}/Q = \\eta_{roda}\\,\\eta_{bomba} = 0{,}7 \\times 0{,}6 = 0{,}42$.",
        },
      ],
    },
    {
      id: "ima",
      label: "Rampa magnética",
      params: { modo: 3, kmag: 1, v0: 5, atrito: 0.02 },
      guide: `### O ímã que puxa e segura
A bola sobe a rampa atraída pelo ímã, cai pelo furo e volta pela calha… mas o ímã continua puxando. O potencial total (gravidade + ímã) volta ao mesmo valor no fim do laço: $\\oint \\mathbf F \\cdot d\\mathbf s = 0$. A bola termina presa no fundo do poço de potencial.`,
    },
    {
      id: "passaro",
      label: "Pássaro bebedor",
      params: { modo: 4, Tar: 25, UR: 50 },
      guide: `### Uma máquina térmica de verdade
1. A água evapora do bico e esfria a cabeça até perto da temperatura de **bulbo úmido**. O diclorometano no corpo (mais quente) tem pressão de vapor maior e empurra o líquido para cima.
2. Quando a coluna chega a ~6 cm, o pássaro tomba, molha o bico e as pressões se igualam.
3. Aumente a umidade relativa: o período cresce e, perto de 100%, o pássaro para. O rendimento fica muito abaixo do de Carnot entre $T_{ar}$ e $T_u$.`,
      predict: [
        {
          question: "Num dia muito úmido (UR perto de 100%), o pássaro:",
          options: ["Bebe mais rápido", "Bebe no mesmo ritmo", "Para de beber"],
          answer: 2,
          explanation: "Sem evaporação, a cabeça não esfria ($T_u \\to T_{ar}$), a diferença de pressão de vapor some e a coluna não sobe: a fonte fria desaparece.",
        },
      ],
    },
    {
      id: "galileu",
      label: "Termômetro de Galileu",
      params: { modo: 5, Tini: 17, Tamb: 24 },
      guide: `### Densidade e temperatura
1. O líquido esquenta de 17 °C até a temperatura ambiente; ao dilatar, fica menos denso, e as ampolas mais pesadas afundam uma a uma.
2. No gráfico, a ampola flutua enquanto sua linha está abaixo da curva $\\rho_{líq}(T)$.
3. A leitura é a etiqueta da ampola mais baixa entre as que flutuam.`,
    },
  ],

  exercises: [
    {
      id: "moinho",
      prompt: "Uma roda d'água de rendimento {etaR} % aciona uma bomba de rendimento {etaB} % que devolve a água à mesma altura. Se {Q} L/s passam pela roda, quantos L/s voltam?",
      vary: { etaR: [50, 90, 0], etaB: [40, 85, 0], Q: [2, 15, 1] },
      fixed: { modo: 2, carga: 0 },
      answer: { label: "Q_volta", unit: "L/s", compute: (p) => millBalance(millOf(p)).Qp * 1000 },
      tolerance: 0.01,
    },
    {
      id: "galileu",
      prompt: "O líquido de um termômetro de Galileu tem densidade 800 kg/m³ a 20 °C e coeficiente de dilatação β = 1,0 × 10⁻³ /K. Qual deve ser a densidade da ampola marcada {Tag} °C (em kg/m³)?",
      vary: { Tag: [14, 30, 0] },
      answer: { label: "ρ", unit: "kg/m³", compute: (p) => rhoLiquid(num(p, "Tag")) },
      tolerance: 0.0005,
      hint: "ρ(T) = ρ₂₀ / [1 + β(T − 20)].",
    },
    {
      id: "carnot-passaro",
      prompt: "O ar está a {Tar} °C e a cabeça molhada do pássaro bebedor chega a {Tu} °C. Qual é o rendimento máximo (Carnot) da máquina, em %?",
      vary: { Tar: [20, 35, 0], Tu: [10, 19, 1] },
      answer: { label: "η", unit: "%", compute: (p) => 100 * (1 - (num(p, "Tu") + 273.15) / (num(p, "Tar") + 273.15)) },
      tolerance: 0.01,
    },
  ],

  init(p) {
    const Tini = num(p, "Tini", 17);
    return {
      th: 0,
      om: num(p, "w0", 3),
      tf: 0,
      Vup: V_TANK,
      wa: 0,
      s: 0,
      v: num(p, "v0", 4),
      Th: num(p, "Tar", 25),
      phase: 0,
      tdip: 0,
      ndips: 0,
      W: 0,
      Q: 0,
      Tl: Tini,
      y: galileoInit(Tini),
      grab: 0,
    };
  },
  step(s, p, _t, dt) {
    const m = modo(p);
    if (m <= 1) return wheelStep(s, p, dt);
    if (m === 2) {
      const dtf = dt * SPEED[2]!;
      const ml = millOf(p), b = millBalance(ml);
      if (s.Vup <= 0) return { ...s, tf: s.tf + dtf };
      const Vup = Math.max(0, Math.min(V_TANK, s.Vup + (b.Qp - ml.Q) * dtf));
      return { ...s, Vup, wa: s.wa + (ml.Q * 1000 * 0.15) * dt, tf: s.tf + dtf };
    }
    if (m === 3) return magStep(s, p, dt);
    if (m === 4) return birdStep(s, p, dt);
    return galileoStep(s, p, dt);
  },
  dt: 0.005,
  sampleEvery: 8,

  pointer: {
    down(s, p, pt) {
      if (modo(p) > 1 || Math.hypot(pt.x - WC.x, pt.y - WC.y) > WC.k + 0.3) return undefined;
      return { ...s, grab: Math.atan2(pt.y - WC.y, pt.x - WC.x) - s.th, om: 0 };
    },
    move: (s, p, pt, dragging) => (dragging ? grabWheel(s, p, pt) : undefined),
    cursor: (_s, p, pt) => (modo(p) <= 1 && Math.hypot(pt.x - WC.x, pt.y - WC.y) < WC.k + 0.3 ? "grab" : undefined),
  },
  actions: [
    { id: "parar", label: "Parar a roda / a bola", run: (s) => ({ ...s, om: 0, v: 0 }) },
    { id: "encher", label: "Encher o reservatório", run: (s) => ({ ...s, Vup: V_TANK }) },
  ],

  narrowSplit: () => 0.497,
  viewport: () => ({ xMin: 0, xMax: 16, yMin: 0, yMax: 9 }),

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const { state: s, params: p, theme } = frame;
    const m = modo(p);
    if (m <= 1) renderWheel(d, s, p, theme);
    else if (m === 2) renderMill(d, s, p, theme);
    else if (m === 3) renderMagnet(d, s, p, theme);
    else if (m === 4) renderBird(d, s, p, theme);
    else renderGalileo(d, s, p, theme);
  },
});

function grabWheel(s: MP, p: Params, pt: { x: number; y: number }): MP | undefined {
  if (modo(p) > 1 || Math.hypot(pt.x - WC.x, pt.y - WC.y) > WC.k + 0.3) return undefined;
  // Gira a roda junto com o ponteiro, sem saltos de 2π.
  const target = Math.atan2(pt.y - WC.y, pt.x - WC.x) - s.grab;
  let d = (target - s.th) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return { ...s, th: s.th + d, om: 0 };
}

export default motoPerpetuo;
