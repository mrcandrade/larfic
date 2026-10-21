import { defineSim, draw, formatBR, num, texNum, type Draw, type Params, type Theme } from "@fisilab/core";
import {
  DIESEL,
  DOIS,
  MOTORES,
  OTTO,
  PORT,
  P_IN,
  ROD,
  VAPOR,
  WANKEL,
  cyclePoints,
  cyclesPerRev,
  engineOf,
  period,
  pointAt,
  power,
  strokeFrac,
  totals,
  volumes,
  type Engine,
} from "./engines.ts";

export * from "./engines.ts";

const fmt = (v: number, d = 3) => formatBR(v, d);
const TAU = 2 * Math.PI;

/** Ângulo do eixo (cresce sem limite; o ciclo é θ mod período). */
type S = number[];

// Geometria do desenho (coordenadas do mundo)
const CRANK = { x: 3.3, y: 1.6, a: 0.95 };
const WHEEL = { x: 5.9, y: 3.3, a: 0.75, R: 1.45 };
const WK = { x: 3.4, y: 4.6, R: 2.0, e: 0.3 };

function heatColor(T: number, alpha = 0.55): string {
  const h = Math.max(0, Math.min(1, (T - 280) / 2200));
  return `rgba(${Math.round(70 + 185 * h)}, ${Math.round(140 - 60 * h + 40 * Math.sin(h * Math.PI))}, ${Math.round(235 - 200 * h)}, ${alpha})`;
}

/** Ângulo do ponteiro em torno do eixo, convertido para θ do motor. */
function pointerAngle(motor: number, x: number, y: number): number | undefined {
  if (motor === VAPOR) {
    const dx = x - WHEEL.x, dy = y - WHEEL.y;
    return Math.hypot(dx, dy) < 1.7 ? Math.atan2(dy, -dx) : undefined;
  }
  if (motor === WANKEL) {
    const dx = x - WK.x, dy = y - WK.y;
    return Math.hypot(dx, dy) < 2.6 ? Math.atan2(dy, dx) - Math.PI / 2 : undefined;
  }
  const dx = x - CRANK.x, dy = y - CRANK.y;
  return Math.hypot(dx, dy) < 1.6 ? Math.atan2(dx, dy) : undefined;
}

function turnTo(s: S, p: Params, pt: { x: number; y: number }): S | undefined {
  const motor = Math.round(num(p, "motor", 1));
  const a = pointerAngle(motor, pt.x, pt.y);
  if (a === undefined) return undefined;
  const th = s[0] ?? 0;
  let d = (a - th) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return [th + d];
}

// ---------- Desenho dos motores ----------

function drawCrank(d: Draw, th: number, theme: Theme) {
  const { x, y, a } = CRANK;
  d.circle(x, y, a + 0.25, { fill: theme.dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)", stroke: theme.muted, width: 1.5 });
  const px = x + a * Math.sin(th), py = y + a * Math.cos(th);
  d.line(x, y, px, py, { color: theme.text, width: 7 });
  d.circle(x - 0.45 * Math.sin(th), y - 0.45 * Math.cos(th), 0.28, { fill: theme.muted });
  d.dot(x, y, 4, theme.text);
  return { px, py };
}

function drawPistonEngine(d: Draw, e: Engine, th: number, theme: Theme) {
  const pt = pointAt(e, th);
  const u = ((th % period(e.motor)) + period(e.motor)) % period(e.motor);
  const { x: cx, y: cy, a } = CRANK;
  const l = ROD * a;
  const stroke = 2 * a;
  const yPin = (t: number) => cy + a * Math.cos(t) + Math.sqrt(l * l - (a * Math.sin(t)) ** 2);
  const yTDC = cy + a + l;
  const pistonH = 0.7;
  const vc = Math.max(0.14, stroke / (e.r - 1));
  const head = yTDC + pistonH + vc;
  const yp = yPin(th);
  const top = yp + pistonH;
  const bx0 = cx - 1.15, bx1 = cx + 1.15;
  // Gás
  d.rect(bx0, top, bx1 - bx0, head - top, { fill: heatColor(pt.T) });
  // Cilindro
  const wall = { color: theme.text, width: 3 };
  if (e.motor === DOIS) {
    const portY = yTDC + pistonH - PORT * stroke; // topo do pistão quando as janelas abrem
    const pTop = portY + 0.02;
    d.line(bx0, cy + 1.25, bx0, pTop - 0.35, wall);
    d.line(bx0, pTop, bx0, head, wall);
    d.line(bx1, cy + 1.25, bx1, pTop - 0.4, wall);
    d.line(bx1, pTop, bx1, head, wall);
    const open = top < pTop;
    d.text("transferência", bx0 - 0.1, pTop - 0.2, { size: 9, color: theme.muted, align: "right" });
    d.text("escape", bx1 + 0.1, pTop - 0.2, { size: 9, color: theme.muted, align: "left" });
    if (open) {
      d.arrowPx(bx0 - 0.5, pTop - 0.2, 1, 0.2, 26, { color: theme.series[0] });
      d.arrowPx(bx1 + 0.05, pTop - 0.2, 1, 0, 26, { color: theme.muted });
    }
    // Cárter
    d.polyline([[bx0, cy + 1.25], [cx - 1.6, cy + 0.9], [cx - 1.6, cy - 1.35], [cx + 1.6, cy - 1.35], [cx + 1.6, cy + 0.9], [bx1, cy + 1.25]], { color: theme.muted, width: 2 });
    if (pt.phase === 1) d.arrowPx(cx - 2.2, cy + 0.2, 1, 0, 22, { color: theme.series[0] });
    d.text("cárter", cx + 1.1, cy - 1.1, { size: 9, color: theme.muted });
  } else {
    d.line(bx0, cy + 1.3, bx0, head, wall);
    d.line(bx1, cy + 1.3, bx1, head, wall);
  }
  d.line(bx0 - 0.2, head, bx1 + 0.2, head, { color: theme.text, width: 4 });
  // Válvulas (4 tempos)
  if (e.motor !== DOIS) {
    const inOpen = pt.phase === 0, exOpen = pt.phase === 3;
    const lift = (o: boolean) => (o ? 0.12 : 0);
    for (const [vx, o, lab, col] of [
      [cx - 0.6, inOpen, "admissão", theme.series[0]!],
      [cx + 0.6, exOpen, "escape", theme.muted],
    ] as const) {
      d.line(vx, head + 0.7, vx, head - lift(o), { color: theme.muted, width: 2 });
      d.line(vx - 0.22, head - lift(o), vx + 0.22, head - lift(o), { color: theme.text, width: 3 });
      d.text(lab, vx, head + 0.9, { size: 9, color: theme.muted });
      if (o) d.arrowPx(vx, head + (vx < cx ? 0.55 : 0.15), 0, vx < cx ? -1 : 1, 18, { color: col });
    }
  }
  // Vela ou injetor
  const burning = pt.phase === 2 && (e.motor === DIESEL ? pt.V <= cyclePoints(e).V3 * 1.001 : (u % (e.motor === DOIS ? TAU : 4 * Math.PI)) - (e.motor === DOIS ? 0 : 2 * Math.PI) < 0.35);
  d.line(cx, head, cx, head + 0.5, { color: theme.text, width: 4 });
  d.text(e.motor === DIESEL ? "injetor" : "vela", cx, head + 0.68, { size: 9, color: theme.muted });
  if (burning) {
    if (e.motor === DIESEL) for (const s of [-0.5, 0, 0.5]) d.line(cx, head, cx + s * 0.4, head - 0.35, { color: theme.series[5], width: 2, dash: [2, 2] });
    else d.dot(cx, head - 0.05, 7, "#ffd34a");
  }
  // Pistão, biela, virabrequim
  d.rect(bx0 + 0.04, yp, bx1 - bx0 - 0.08, pistonH, { fill: theme.muted, stroke: theme.text, width: 1 });
  const { px, py } = drawCrank(d, th, theme);
  d.line(px, py, cx, yp + 0.2, { color: theme.text, width: 5 });
  d.dot(cx, yp + 0.2, 3, theme.text);
}

function drawWankel(d: Draw, e: Engine, th: number, theme: Theme) {
  const pt = pointAt(e, th);
  const { x, y, R, e: ecc } = WK;
  const hous = (t: number): [number, number] => [x + ecc * Math.cos(3 * t) + R * Math.cos(t), y + ecc * Math.sin(3 * t) + R * Math.sin(t)];
  const psi = th / 3 + Math.PI / 6;
  const ox = x + ecc * Math.cos(th + Math.PI / 2), oy = y + ecc * Math.sin(th + Math.PI / 2);
  const apex = (k: number): [number, number] => [ox + R * Math.cos(psi + (2 * Math.PI * k) / 3), oy + R * Math.sin(psi + (2 * Math.PI * k) / 3)];
  // Flanco: arco ligeiramente abaulado entre dois vértices
  const flank = (k: number, n = 16): [number, number][] => {
    const [ax, ay] = apex(k), [bx, by] = apex(k + 1);
    const mx = (ax + bx) / 2, my = (ay + by) / 2;
    const nx = mx - ox, ny = my - oy, nl = Math.hypot(nx, ny);
    const bulge = 0.18;
    return Array.from({ length: n + 1 }, (_, i) => {
      const s = i / n;
      const b = 4 * s * (1 - s) * bulge;
      return [ax + (bx - ax) * s + (nx / nl) * b, ay + (by - ay) * s + (ny / nl) * b] as [number, number];
    });
  };
  // Câmara acompanhada (face 0): carcaça de psi até psi + 2π/3, volta pelo flanco
  const arc = Array.from({ length: 41 }, (_, i) => hous(psi + ((2 * Math.PI) / 3) * (i / 40)));
  d.polyline([...arc, ...flank(0).reverse()], { color: "none", fill: heatColor(pt.T, 0.6), close: true });
  for (const k of [1, 2]) {
    const a2 = Array.from({ length: 41 }, (_, i) => hous(psi + ((2 * Math.PI) / 3) * (k + i / 40)));
    d.polyline([...a2, ...flank(k).reverse()], { color: "none", fill: theme.grid, close: true });
  }
  d.polyline(Array.from({ length: 181 }, (_, i) => hous((TAU * i) / 180)), { color: theme.text, width: 3, close: true });
  d.polyline([...flank(0), ...flank(1).slice(1), ...flank(2).slice(1)], { color: theme.text, width: 2, fill: theme.dark ? "rgba(150,160,175,0.35)" : "rgba(120,130,145,0.35)" });
  // Engrenagem/eixo excêntrico
  d.circle(ox, oy, 0.55, { stroke: theme.muted, width: 1.5 });
  d.circle(x, y, 0.3, { fill: theme.muted });
  d.line(x, y, ox, oy, { color: theme.text, width: 4 });
  // Velas (embaixo) e janelas (em cima)
  const [sx, sy] = hous(-Math.PI / 2);
  d.line(sx, sy, sx, sy - 0.4, { color: theme.text, width: 4 });
  d.text("velas", sx, sy - 0.6, { size: 9, color: theme.muted });
  if (pt.phase === 2 && (((th % (6 * Math.PI)) + 6 * Math.PI) % (6 * Math.PI)) - 3 * Math.PI < 0.5) d.dot(sx, sy + 0.08, 7, "#ffd34a");
  const [ix, iy] = hous(Math.PI / 2 + 0.35), [ex, ey] = hous(Math.PI / 2 - 0.35);
  d.arrowPx(ix - 0.1, iy + 0.5, 0.2, -1, 20, { color: theme.series[0] });
  d.arrowPx(ex, ey, 0.2, 1, 20, { color: theme.muted });
  d.text("admissão", ix - 0.3, iy + 0.7, { size: 9, color: theme.muted });
  d.text("escape", ex + 0.3, ey + 0.7, { size: 9, color: theme.muted });
  const [a0x, a0y] = apex(0);
  d.dot(a0x, a0y, 3.5, theme.series[1]!);
  d.text("câmara acompanhada", x, y - R - 0.75, { size: 10, color: theme.series[1] });
}

function drawSteam(d: Draw, e: Engine, th: number, theme: Theme) {
  const { x: wx, y: wy, a, R: Rw } = WHEEL;
  const l = ROD * a;
  const stroke = 2 * a;
  const xc = (t: number) => wx - a * Math.cos(t) - Math.sqrt(l * l - (a * Math.sin(t)) ** 2); // cruzeta
  const xTDC = wx - a - l;
  const pistonW = 0.25;
  // Cilindro: tampa em x0; pistão em x0 + folga + curso*f
  const x0 = 0.3, gap = 0.15;
  const pX = xc(th) - (xTDC - x0 - gap); // haste rígida: o pistão acompanha a cruzeta
  const cyl1 = x0 + gap + stroke + pistonW + gap;
  const cyT = wy + 0.6, cyB = wy - 0.6;
  const head = pointAt(e, th), crank = pointAt(e, th + Math.PI);
  d.rect(x0, cyB, pX - x0, cyT - cyB, { fill: steamFill(head.P, e) });
  d.rect(pX + pistonW, cyB, cyl1 - pX - pistonW, cyT - cyB, { fill: steamFill(crank.P, e) });
  d.rect(x0, cyB, cyl1 - x0, cyT - cyB, { stroke: theme.text, width: 2.5 });
  d.rect(pX, cyB + 0.03, pistonW, cyT - cyB - 0.06, { fill: theme.muted, stroke: theme.text, width: 1 });
  // Haste e cruzeta: a cruzeta acompanha o pistão (mesma fração do curso, desenho ampliado na haste)
  const xh = xc(th);
  d.line(pX + pistonW, wy, xh, wy, { color: theme.text, width: 3 });
  d.rect(xh - 0.15, wy - 0.15, 0.3, 0.3, { fill: theme.text });
  // Roda motriz com manivela
  d.circle(wx, wy, Rw, { stroke: theme.text, width: 4 });
  for (let k = 0; k < 10; k++) {
    const ang = th + (k * Math.PI) / 5;
    d.line(wx, wy, wx + Rw * Math.cos(ang), wy - Rw * Math.sin(ang), { color: theme.muted, width: 1.5 });
  }
  const pinX = wx - a * Math.cos(th), pinY = wy + a * Math.sin(th);
  d.line(xh, wy, pinX, pinY, { color: theme.text, width: 5 });
  d.dot(pinX, pinY, 4, theme.series[1]!);
  d.dot(wx, wy, 4, theme.text);
  d.line(0.1, wy - Rw, 6.6, wy - Rw, { color: theme.muted, width: 3 });
  d.text("trilho", 0.6, wy - Rw - 0.25, { size: 9, color: theme.muted });
  // Caixa de vapor com distribuidor
  const chT = cyT + 0.6;
  d.rect(x0 + 0.2, cyT, cyl1 - x0 - 0.4, chT - cyT, { stroke: theme.muted, width: 1.5 });
  const portL = x0 + 0.35, portR = cyl1 - 0.35;
  const colOf = (q: { phase: number }) => (q.phase === 0 ? theme.positive : q.phase === 2 ? theme.negative : theme.muted);
  d.rect(portL - 0.12, cyT - 0.02, 0.24, 0.12, { fill: colOf(head) });
  d.rect(portR - 0.12, cyT - 0.02, 0.24, 0.12, { fill: colOf(crank) });
  d.text("distribuidor de gaveta", (x0 + cyl1) / 2, chT + 0.25, { size: 9, color: theme.muted });
  // Caldeira e chaminé
  d.rect(0.3, chT + 0.5, 4.6, 1.1, { fill: theme.dark ? "rgba(200,80,60,0.18)" : "rgba(200,80,60,0.12)", stroke: theme.muted });
  d.text(`caldeira: ${fmt(e.Pb / 1e5)} bar, ${fmt(tsat(e.Pb) - 273.15)} °C`, 2.6, chT + 1.05, { size: 11, weight: "600" });
  d.line((x0 + cyl1) / 2, chT, (x0 + cyl1) / 2, chT + 0.5, { color: theme.positive, width: 3 });
  const puff = head.phase === 2 || crank.phase === 2;
  if (puff) d.circle(4.45, chT + 2.35, 0.18 + 0.1 * Math.sin(th * 2) ** 2, { fill: theme.muted, alpha: 0.35 });
  d.rect(4.3, chT + 1.6, 0.3, 0.5, { fill: theme.muted });
  d.text("chaminé", 4.75, chT + 1.85, { size: 9, color: theme.muted, align: "left" });
  d.text("tampa", x0 + 0.1, cyB - 0.25, { size: 9, color: theme.muted, align: "left" });
  d.text("PV: lado da tampa", x0 + 0.1, cyB - 0.5, { size: 9, color: theme.series[1], align: "left" });
}

/** Vapor vivo em vermelho (mais forte com a pressão); escape em cinza. */
function steamFill(P: number, e: Engine): string {
  return P > e.Pe * 1.001 ? `rgba(217, 69, 59, ${(0.15 + 0.6 * (P / e.Pb)).toFixed(2)})` : "rgba(140, 150, 165, 0.35)";
}

function tsat(P: number) {
  return pointAt({ motor: VAPOR, r: 9, Tmax: 0, Vd: 1, Pb: P, Pe: P, corte: 0.5, rpm: 1, ncil: 1 }, 0.01).T;
}

// ---------- Diagrama PV ----------

const PV = { x0: 8.2, x1: 15.5, y0: 2.3, y1: 8.3 };

function drawPV(d: Draw, e: Engine, th: number, theme: Theme) {
  const T = period(e.motor);
  const N = 720;
  const pts = Array.from({ length: N + 1 }, (_, i) => pointAt(e, (T * i) / N - (i === N ? 1e-9 : 0)));
  const { V1 } = volumes(e);
  const Pmax = Math.max(...pts.map((q) => q.P)) * 1.08;
  const Vmax = V1 * 1.08;
  const X = (V: number) => PV.x0 + (V / Vmax) * (PV.x1 - PV.x0);
  const Y = (P: number) => PV.y0 + (P / Pmax) * (PV.y1 - PV.y0);
  const steam = e.motor === VAPOR;
  const vU = steam ? 1000 : 1e6, pU = steam ? 1e5 : 1e6;
  d.line(PV.x0, PV.y0, PV.x1, PV.y0, { color: theme.muted });
  d.line(PV.x0, PV.y0, PV.x0, PV.y1, { color: theme.muted });
  d.text(steam ? "V (L)" : "V (cm³)", PV.x1, PV.y0 - 0.4, { size: 11, color: theme.muted, align: "right" });
  d.text(steam ? "P (bar)" : "P (MPa)", PV.x0, PV.y1 + 0.3, { size: 11, color: theme.muted, align: "left" });
  for (let k = 1; k <= 4; k++) {
    const v = (Vmax * k) / 4.32, P = (Pmax * k) / 4.32;
    d.text(fmt((v * vU), 2), X(v), PV.y0 - 0.22, { size: 9, color: theme.muted });
    d.text(fmt((P / pU), 2), PV.x0 - 0.08, Y(P), { size: 9, color: theme.muted, align: "right" });
    d.line(PV.x0, Y(P), PV.x1, Y(P), { color: theme.grid, width: 1 });
  }
  if (!steam) d.line(PV.x0, Y(P_IN), PV.x1, Y(P_IN), { color: theme.muted, dash: [4, 4], width: 1 });
  const path = pts.map((q): [number, number] => [X(q.V), Y(q.P)]);
  d.polyline(path, { color: "none", fill: theme.dark ? "rgba(91,156,240,0.16)" : "rgba(47,125,225,0.12)", close: true });
  const cols = [theme.series[0]!, theme.series[2]!, theme.positive, theme.muted];
  for (let i = 1; i < pts.length; i++) d.line(path[i - 1]![0], path[i - 1]![1], path[i]![0], path[i]![1], { color: cols[steam && pts[i]!.phase === 2 ? 3 : pts[i]!.phase]!, width: 2.5 });
  const q = pointAt(e, th);
  d.dot(X(q.V), Y(q.P), 7, theme.series[1]!);
  d.text(q.label, (PV.x0 + PV.x1) / 2, PV.y1 + 0.35, { size: 12, weight: "600", color: theme.series[1] });
  // Legenda de fases
  const leg = steam ? ["admissão", "expansão", "escape"] : e.motor === DOIS ? ["", "compressão", "expansão", "lavagem"] : ["admissão", "compressão", "expansão", "escape"];
  leg.forEach((lab, k) => {
    if (!lab) return;
    const lx = PV.x1 - 1.6, ly = PV.y1 - 0.3 - k * 0.32;
    d.line(lx, ly, lx + 0.35, ly, { color: steam && k === 2 ? cols[3]! : cols[k]!, width: 3 });
    d.text(lab, lx + 0.45, ly, { size: 9, color: theme.muted, align: "left" });
  });
}

function drawBars(d: Draw, e: Engine, theme: Theme) {
  const tt = totals(e);
  const steam = e.motor === VAPOR;
  const bars: [string, number, string][] = steam
    ? [["Motor (W/Q)", tt.etaMotor, theme.series[1]!], ["Rankine ideal", tt.eta, theme.accent], ["Carnot", tt.carnot, theme.muted]]
    : [["Ciclo ideal", tt.eta, theme.accent], ["Carnot (T_adm, T_máx)", tt.carnot, theme.muted]];
  const x0 = 10.6, x1 = 15.5;
  bars.forEach(([lab, v, col], k) => {
    const y = 1.45 - k * 0.42;
    d.text(lab, x0 - 0.1, y, { size: 10, align: "right", color: theme.muted });
    d.rect(x0, y - 0.13, (x1 - x0) * Math.max(0, Math.min(1, v)), 0.26, { fill: col });
    d.text(`${fmt(100 * v)} %`, x0 + (x1 - x0) * Math.max(0, Math.min(1, v)) + 0.08, y, { size: 10, align: "left" });
  });
  d.line(x0, 0.2, x0, 1.7, { color: theme.muted, width: 1 });
}

export const motoresTermicos = defineSim<S>({
  id: "motores-termicos",
  title: "Motores térmicos: vapor, Otto, Diesel e Wankel",
  course: "FG II",
  topic: "Termodinâmica",
  priority: "P2",
  summary:
    "Locomotiva a vapor, motores de 4 e 2 tempos, Diesel e Wankel animados, com o ponto do ciclo andando no diagrama PV junto com o pistão. Compare rendimento teórico, Carnot, trabalho por ciclo e potência pela rotação.",
  equations: [
    String.raw`W = \oint P\,dV \qquad \eta = \frac{W}{Q_{\text{in}}} \le 1 - \frac{T_{\text{fria}}}{T_{\text{quente}}}`,
    String.raw`\eta_{Otto} = 1 - r^{1-\gamma} \qquad \eta_{Diesel} = 1 - \frac{r_c^{\gamma}-1}{\gamma\,r^{\gamma-1}(r_c-1)}`,
    String.raw`\mathcal{P} = W \cdot \frac{\text{ciclos}}{\text{volta}} \cdot \frac{n_{\text{rpm}}}{60} \cdot N_{\text{cil}} \qquad \tau = \frac{\mathcal{P}}{\omega}`,
    String.raw`V(\theta) = V_c + V_d\,\tfrac12\!\left[1-\cos\theta+\lambda-\sqrt{\lambda^2-\sin^2\theta}\right],\ \lambda = l/a`,
  ],
  liveEquations(s, p) {
    const e = engineOf(p);
    const tt = totals(e);
    const c = cyclePoints(e);
    const pot = power(e);
    const lines: string[] = [];
    if (e.motor === VAPOR) {
      lines.push(String.raw`W = P_b V_{\text{corte}}\left(1+\ln\frac{V_1}{V_{\text{corte}}}\right) - P_b V_c - P_e V_d = ${texNum(tt.W)}\ \text{J}`);
      lines.push(String.raw`\eta_{\text{motor}} = ${texNum(100 * tt.etaMotor)}\% \quad \eta_{Rankine} = ${texNum(100 * tt.eta)}\% \quad \eta_{Carnot} = ${texNum(100 * tt.carnot)}\%`);
    } else {
      const rr = e.motor === DOIS ? c.rEff : e.r;
      if (e.motor === DIESEL) lines.push(String.raw`r_c = \frac{T_3}{T_2} = ${texNum(c.V3 / c.Vc)} \Rightarrow \eta = ${texNum(100 * tt.eta)}\%`);
      else lines.push(String.raw`\eta = 1 - ${texNum(rr)}^{-0{,}4} = ${texNum(100 * tt.eta)}\% \quad (\text{Carnot: } ${texNum(100 * tt.carnot)}\%)`);
      lines.push(String.raw`W = \eta\,Q_{\text{in}} = ${texNum(tt.eta)} \times ${texNum(tt.Qin)}\ \text{J} = ${texNum(tt.W)}\ \text{J}`);
    }
    lines.push(String.raw`\mathcal{P} = ${texNum(tt.W)} \times ${texNum(cyclesPerRev(e.motor))} \times \frac{${texNum(e.rpm)}}{60} \times ${e.ncil} = ${texNum(pot / 1000)}\ \text{kW}`);
    void s;
    return lines;
  },

  params: [
    { key: "motor", label: "Motor", unit: "", min: 0, max: 4, step: 1, default: 1, options: MOTORES.map((label, value) => ({ value, label })) },
    { key: "r", label: "Taxa de compressão r", unit: "", min: 4, max: 24, step: 0.5, default: 9, live: true },
    { key: "Tmax", label: "Temperatura máxima da combustão", unit: "K", min: 1200, max: 3000, step: 50, default: 2400, live: true },
    { key: "cil", label: "Cilindrada por cilindro (ou câmara)", unit: "L", min: 0.05, max: 2, step: 0.05, default: 0.5, live: true },
    { key: "ncil", label: "Número de cilindros (ou rotores)", unit: "", min: 1, max: 8, step: 1, default: 4, live: true },
    { key: "rpm", label: "Rotação do eixo", unit: "rpm", min: 60, max: 8000, step: 10, default: 3000, log: true, live: true },
    { key: "Pb", label: "Pressão da caldeira (vapor)", unit: "bar", min: 2, max: 20, step: 0.5, default: 12, live: true },
    { key: "Pe", label: "Pressão de escape (vapor)", unit: "bar", min: 0.1, max: 1.5, step: 0.05, default: 1, live: true },
    { key: "corte", label: "Corte de admissão (vapor)", unit: "%", min: 10, max: 80, step: 1, default: 30, live: true },
    { key: "Vvap", label: "Volume do cilindro a vapor", unit: "L", min: 5, max: 150, step: 1, default: 60, live: true },
    {
      key: "lento",
      label: "Câmera lenta",
      unit: "",
      min: 0.002,
      max: 1,
      step: 0.001,
      default: 0.01,
      live: true,
      options: [
        { value: 1, label: "Tempo real" },
        { value: 0.1, label: "10× mais lento" },
        { value: 0.01, label: "100× mais lento" },
        { value: 0.002, label: "500× mais lento" },
      ],
    },
  ],

  observables: [
    { key: "ang", label: "Ângulo do eixo no ciclo", unit: "°", value: (s, p) => { const T = period(engineOf(p).motor); return ((((s[0] ?? 0) % T) + T) % T) * 180 / Math.PI; } },
    { key: "V", label: "Volume da câmara", unit: "cm³", value: (s, p) => pointAt(engineOf(p), s[0] ?? 0).V * 1e6 },
    { key: "P", label: "Pressão na câmara", unit: "kPa", value: (s, p) => pointAt(engineOf(p), s[0] ?? 0).P / 1000 },
    { key: "T", label: "Temperatura do fluido", unit: "K", value: (s, p) => pointAt(engineOf(p), s[0] ?? 0).T },
    { key: "W", label: "Trabalho por ciclo (por cilindro)", unit: "J", value: (_s, p) => totals(engineOf(p)).W },
    { key: "Pot", label: "Potência no eixo", unit: "kW", value: (_s, p) => power(engineOf(p)) / 1000 },
    { key: "torque", label: "Torque médio", unit: "N·m", value: (_s, p) => { const e = engineOf(p); return power(e) / ((TAU * e.rpm) / 60); } },
    { key: "eta", label: "Rendimento teórico do ciclo", unit: "%", value: (_s, p) => 100 * totals(engineOf(p)).eta },
    { key: "etaC", label: "Rendimento de Carnot", unit: "%", value: (_s, p) => 100 * totals(engineOf(p)).carnot },
    { key: "etaM", label: "Rendimento do motor a vapor (W/Q)", unit: "%", value: (_s, p) => 100 * totals(engineOf(p)).etaMotor },
  ],
  chart: { x: "V", y: "P" },

  scenarios: [
    {
      id: "otto",
      label: "Motor 4 tempos a gasolina (Otto)",
      params: { motor: OTTO, r: 9, Tmax: 2400, cil: 0.5, ncil: 4, rpm: 3000 },
      guide: `### Os quatro tempos
1. Rode em câmera lenta e acompanhe o ponto laranja no PV: **admissão** (P constante), **compressão** (adiabática), **centelha** (subida vertical: calor a volume constante), **expansão** e **escape**.
2. Arraste o virabrequim com o mouse para girar o motor à mão e parar em cada tempo.
3. Compare o rendimento ideal $1 - r^{1-\\gamma}$ com o de Carnot entre 300 K e $T_{\\text{máx}}$.
4. Dobre a rotação: o que acontece com o trabalho por ciclo e com a potência?`,
      predict: [
        {
          question: "Passando de 3000 para 6000 rpm (mesma mistura e mesma taxa de compressão), o que acontece no modelo ideal?",
          options: ["O trabalho por ciclo dobra", "A potência dobra e o trabalho por ciclo não muda", "O rendimento dobra", "Nada muda"],
          answer: 1,
          explanation: "O ciclo no PV é o mesmo, então $W$ por ciclo e $\\eta$ não mudam; há o dobro de ciclos por segundo, logo a potência dobra (o torque fica igual).",
        },
      ],
    },
    {
      id: "diesel",
      label: "Diesel × Otto",
      params: { motor: DIESEL, r: 18, Tmax: 2200, cil: 0.5, ncil: 4, rpm: 2000 },
      guide: `### Combustão a pressão constante
1. Veja o trecho horizontal no topo do PV: o injetor queima o combustível enquanto o pistão desce.
2. Anote $\\eta$ e depois troque para **Otto** com $r = 9$ (limite da gasolina pela detonação). Qual é mais eficiente?
3. Com o mesmo $r$, o Otto seria mais eficiente que o Diesel. Confirme ajustando $r = 18$ no Otto.`,
      predict: [
        {
          question: "Para a mesma taxa de compressão, qual ciclo ideal tem maior rendimento?",
          options: ["Otto", "Diesel", "São iguais"],
          answer: 0,
          explanation: "Para o mesmo $r$, $\\eta_{Diesel} < \\eta_{Otto}$ porque o fator $(r_c^\\gamma - 1)/[\\gamma(r_c - 1)] > 1$. O Diesel ganha na prática por usar $r$ bem maior, sem risco de detonação.",
        },
      ],
    },
    {
      id: "dois-tempos",
      label: "Dois tempos e Wankel",
      params: { motor: DOIS, r: 9, Tmax: 2400, cil: 0.125, ncil: 1, rpm: 6000 },
      guide: `### Um tempo motor por volta
1. No dois tempos as janelas no cilindro substituem as válvulas: a compressão só começa quando o pistão as cobre, por isso a **taxa efetiva** é menor que a geométrica.
2. Compare a potência com um 4 tempos de mesma cilindrada e rotação: o dois tempos tem um ciclo por volta.
3. Troque para **Wankel**: o rotor triangular gira a 1/3 do eixo; cada face faz um ciclo Otto completo a cada 3 voltas, e as 3 faces dão um tempo motor por volta.`,
    },
    {
      id: "locomotiva",
      label: "Locomotiva a vapor",
      params: { motor: VAPOR, Pb: 12, Pe: 1, corte: 30, Vvap: 60, ncil: 2, rpm: 200, lento: 0.1 },
      guide: `### Diagrama indicado da máquina a vapor
1. O vapor entra à pressão da caldeira até o **corte**, depois se expande com a válvula fechada ($PV \\approx$ const) e sai no escape.
2. Reduza o corte de 30% para 15% (o maquinista "encurta o corte" em velocidade): o trabalho por ciclo cai, mas o rendimento do motor sobe. Por quê?
3. Troque o escape para 0,2 bar (condensador): compare com o rendimento de Rankine e de Carnot.`,
      predict: [
        {
          question: "Com corte menor (menos vapor por curso), o rendimento W/Q do motor:",
          options: ["Aumenta", "Diminui", "Não muda"],
          answer: 0,
          explanation: "Com corte curto, cada quilo de vapor se expande mais antes de sair: aproveita-se mais a expansão, embora o trabalho por ciclo (e a força de tração) diminua.",
        },
      ],
    },
  ],

  exercises: [
    {
      id: "potencia-otto",
      prompt:
        "Um motor Otto ideal de 4 tempos e 4 cilindros, com {cil} L por cilindro e taxa de compressão {r}, admite ar a 100 kPa e 300 K (γ = 1,4) e atinge {Tmax} K na combustão. Qual é a potência a {rpm} rpm, em kW?",
      vary: { cil: [0.3, 0.6, 2], r: [8, 11, 1], Tmax: [2000, 2800, 0], rpm: [2000, 6000, 0] },
      fixed: { motor: OTTO, ncil: 4 },
      answer: { label: "P", unit: "kW", compute: (p) => power(engineOf(p)) / 1000 },
      hint: "n = P₁V₁/(RT₁) com V₁ = V_d·r/(r−1); Q = nC_V(T₃ − T₂); W = ηQ; 4 tempos: meio ciclo por volta.",
    },
    {
      id: "diesel",
      prompt: "Um ciclo Diesel ideal (γ = 1,4) tem taxa de compressão {r}, admite ar a 300 K e a combustão termina a {Tmax} K. Qual é o rendimento, em %?",
      vary: { r: [14, 22, 0], Tmax: [1800, 2500, 0] },
      fixed: { motor: DIESEL },
      answer: { label: "η", unit: "%", compute: (p) => 100 * totals(engineOf(p)).eta },
      hint: "T₂ = 300·r^0,4; r_c = T₃/T₂ (isobárica); η = 1 − (r_c^γ − 1)/[γ r^(γ−1)(r_c − 1)].",
    },
  ],

  init: (p) => [Math.round(num(p, "motor", 1)) === DOIS ? Math.PI : 0],
  derivatives: (_s, p) => [(TAU * num(p, "rpm", 3000) * num(p, "lento", 0.01)) / 60],
  integrator: "euler",
  dt: 2e-3,
  sampleEvery: 5,

  pointer: {
    down: (s, p, pt) => turnTo(s, p, pt),
    move: (s, p, pt, dragging) => (dragging ? turnTo(s, p, pt) : undefined),
    cursor: (_s, p, pt) => (pointerAngle(Math.round(num(p, "motor", 1)), pt.x, pt.y) !== undefined ? "grab" : undefined),
  },
  actions: [
    { id: "pms", label: "Voltar ao início do ciclo", run: (s, p) => { const T = period(engineOf(p).motor); return [Math.floor((s[0] ?? 0) / T) * T]; } },
  ],

  viewport: () => ({ xMin: 0, xMax: 16, yMin: -1.2, yMax: 9.2 }),

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const { state, params, theme } = frame;
    const e = engineOf(params);
    const th = state[0] ?? 0;
    if (e.motor === VAPOR) drawSteam(d, e, th, theme);
    else if (e.motor === WANKEL) drawWankel(d, e, th, theme);
    else drawPistonEngine(d, e, th, theme);
    d.text(MOTORES[e.motor]!, 3.4, 8.95, { size: 13, weight: "600" });
    drawPV(d, e, th, theme);
    drawBars(d, e, theme);
    const tt = totals(e);
    const pot = power(e);
    const info = `W = ${fmt(tt.W)} J por ciclo   ·   ${fmt(e.rpm)} rpm   ·   ${e.ncil} ${e.motor === WANKEL ? "rotor(es)" : "cilindro(s)"}   ·   potência ${fmt(pot / 1000)} kW   ·   torque ${fmt(pot / ((TAU * e.rpm) / 60))} N·m`;
    d.text(info, 0.3, -0.75, { size: 11, align: "left", weight: "600" });
    d.text("arraste o eixo para girar à mão", 3.4, 8.6, { size: 9, color: theme.muted });
    
  },
});

export default motoresTermicos;
