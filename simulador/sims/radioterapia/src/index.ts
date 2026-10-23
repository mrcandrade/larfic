import { clamp, defineSim, draw, num, texNum, type Draw, type Params } from "@fisilab/core";
import { fmt, panel } from "./panel.ts";
import {
  PHOTONS,
  braggCached,
  curveAt,
  curveMetrics,
  electronPDD,
  electronRanges,
  exitDistance,
  insideEllipse,
  lateral,
  photonPDD,
  protonEnergy,
  protonRange,
  sobp,
  type Curve,
  type Ellipse,
} from "./physics.ts";

export * from "./physics.ts";

export interface RState {
  /** Câmara de ionização no tanque: [x lateral, profundidade] (cm). */
  probe: [number, number];
  /** Planejamento: centro do tumor e do órgão de risco (cm), pesos dos feixes. */
  tumor: [number, number];
  oar: [number, number];
  w: number[];
  drag: null | "probe" | "tumor" | "oar";
}

const VIEW = { xMin: -17, xMax: 17, yMin: -9.5, yMax: 9.5 };
const mode = (p: Params) => Math.round(num(p, "modo"));
const modal = (p: Params) => Math.round(num(p, "modal"));

// ---------- Modo 0: curvas na água ----------

let protKey = "";
let protCurve: Curve = { dz: 0.02, y: [0] };
export function protonCurve(p: Params): Curve {
  const R = protonRange(num(p, "Ep", 150));
  const spread = num(p, "sobp") >= 0.5;
  const M = num(p, "M", 4);
  const key = `${R.toFixed(3)}|${spread}|${M}`;
  if (key !== protKey) {
    protKey = key;
    if (spread) {
      const s = sobp(R, M);
      const plateau = curveAt(s.curve, R - M / 2);
      protCurve = { dz: s.curve.dz, y: s.curve.y.map((v) => v / plateau) };
    } else protCurve = braggCached(R);
  }
  return protCurve;
}

/** Dose em profundidade (%) da modalidade escolhida (k: 0 fótons, 1 elétrons, 2 prótons). */
export function depthDose(p: Params, d: number, k = modal(p)): number {
  if (k === 0) return photonPDD(Math.round(num(p, "foton", 1)), d);
  if (k === 1) return electronPDD(num(p, "Ee", 12), d);
  return 100 * curveAt(protonCurve(p), d);
}
const penumbra = (k: number, d: number) => (k === 0 ? 0.35 + 0.02 * d : k === 1 ? 0.3 + 0.12 * d : 0.25 + 0.025 * d);
/** Dose (%) num ponto do tanque: PDD × perfil lateral (com espalhamento fora do campo para fótons). */
export function tankDose(p: Params, x: number, d: number, k = modal(p)): number {
  const W = num(p, "campo", 10);
  const lat = lateral(x, W, penumbra(k, d));
  const scat = k === 0 ? 0.03 * Math.exp(-Math.max(0, Math.abs(x) - W / 2) / 4) * (1 - lat) : 0;
  return depthDose(p, d, k) * (lat + scat);
}

export function modeMetrics(p: Params) {
  const k = modal(p);
  const c: Curve = { dz: 0.02, y: [] };
  for (let d = 0.01; d < 40; d += 0.02) c.y.push(depthDose(p, d, k));
  const m = curveMetrics(c);
  return { ...m, pdd10: depthDose(p, 10, k) };
}

// ---------- Modo 1: planejamento ----------

const BODY: Ellipse = { cx: 0, cy: 0, a: 15, b: 10 };
const LUNGS: Ellipse[] = [
  { cx: -7.5, cy: 1.5, a: 4.5, b: 5.5 },
  { cx: 7.5, cy: 1.5, a: 4.5, b: 5.5 },
];
const OAR_R = 1.2;
const GX = 90;
const GY = 60;
const cellX = (i: number) => -15 + ((i + 0.5) * 30) / GX;
const cellY = (j: number) => -10 + ((j + 0.5) * 20) / GY;

interface Plan {
  beams: { th: number; dose: Float32Array }[];
  ptv: number[];
  oar: number[];
  normal: number[];
}

const nBeams = (p: Params) => clamp(Math.round(num(p, "nf", 4)), 1, 9);
export const beamAngles = (p: Params) => {
  const n = nBeams(p);
  const a0 = num(p, "ang0", 0);
  const arc = num(p, "arco", 360);
  return Array.from({ length: n }, (_, i) => a0 + (n === 1 ? 0 : arc >= 359 ? (360 * i) / n : (arc * i) / (n - 1)));
};
const ptvR = (p: Params) => num(p, "rT", 2.5) + num(p, "margem", 0.5);
const density = (p: Params, x: number, y: number) => (num(p, "hetero") >= 0.5 && LUNGS.some((e) => insideEllipse(e, x, y)) ? 0.25 : 1);

/** Profundidade radiológica (cm de água) de (x, y) até a pele, contra a direção de propagação u. */
export function radDepth(p: Params, x: number, y: number, ux: number, uy: number): number {
  const t = exitDistance(BODY, x, y, -ux, -uy);
  if (num(p, "hetero") < 0.5) return t;
  const n = Math.max(4, Math.ceil(t / 0.5));
  let s = 0;
  for (let i = 0; i < n; i++) {
    const f = (i + 0.5) / n;
    s += density(p, x - ux * t * f, y - uy * t * f);
  }
  return (s / n) * t;
}

let planKey = "";
let planCache: Plan | null = null;
export function plan(s: RState, p: Params): Plan {
  const key = JSON.stringify([s.tumor, s.oar, p.nf, p.ang0, p.arco, p.pmod, p.margem, p.rT, p.hetero]);
  if (planCache && key === planKey) return planCache;
  planKey = key;
  const [tx, ty] = s.tumor;
  const R = ptvR(p);
  const k = Math.round(num(p, "pmod", 0));
  const beams = beamAngles(p).map((deg) => {
    const th = (deg * Math.PI) / 180;
    const ux = -Math.sin(th);
    const uy = -Math.cos(th);
    const nx = Math.cos(th);
    const ny = -Math.sin(th);
    const W = 2 * R;
    let pc: Curve | null = null;
    if (k === 2) {
      const dDist = radDepth(p, tx + ux * R, ty + uy * R, ux, uy);
      const dProx = radDepth(p, tx - ux * R, ty - uy * R, ux, uy);
      const sp = sobp(dDist + 0.3, Math.max(0.6, dDist - dProx + 0.6));
      const pl = curveAt(sp.curve, (dDist + dProx) / 2);
      pc = { dz: sp.curve.dz, y: sp.curve.y.map((v) => v / pl) };
    }
    const dose = new Float32Array(GX * GY);
    for (let j = 0; j < GY; j++)
      for (let i = 0; i < GX; i++) {
        const x = cellX(i);
        const y = cellY(j);
        if (!insideEllipse(BODY, x, y)) continue;
        const l = (x - tx) * nx + (y - ty) * ny;
        if (Math.abs(l) > W / 2 + 4) continue;
        const d = radDepth(p, x, y, ux, uy);
        const depthPart = k === 2 ? curveAt(pc!, d) : photonPDD(k === 0 ? 1 : 3, d) / 100;
        dose[j * GX + i] = depthPart * lateral(l, W, penumbra(k === 2 ? 2 : 0, d));
      }
    return { th, dose };
  });
  const ptv: number[] = [];
  const oar: number[] = [];
  const normal: number[] = [];
  for (let j = 0; j < GY; j++)
    for (let i = 0; i < GX; i++) {
      const x = cellX(i);
      const y = cellY(j);
      if (!insideEllipse(BODY, x, y)) continue;
      const idx = j * GX + i;
      if (Math.hypot(x - tx, y - ty) <= R) ptv.push(idx);
      else if (Math.hypot(x - s.oar[0], y - s.oar[1]) <= OAR_R) oar.push(idx);
      else normal.push(idx);
    }
  planCache = { beams, ptv, oar, normal };
  return planCache;
}

/** Mapa de dose total (% da prescrição, média no PTV = 100). */
export function doseMap(s: RState, p: Params): Float32Array {
  const pl = plan(s, p);
  const D = new Float32Array(GX * GY);
  pl.beams.forEach((b, i) => {
    const w = s.w[i] ?? 1;
    if (w <= 0) return;
    for (let k = 0; k < D.length; k++) D[k]! += w * b.dose[k]!;
  });
  let m = 0;
  for (const i of pl.ptv) m += D[i]!;
  m = pl.ptv.length ? m / pl.ptv.length : 1;
  if (m > 0) for (let k = 0; k < D.length; k++) D[k] = (100 * D[k]!) / m;
  return D;
}

export function planStats(s: RState, p: Params) {
  const pl = plan(s, p);
  const D = doseMap(s, p);
  const vals = (ids: number[]) => ids.map((i) => D[i]!).sort((a, b) => a - b);
  const pv = vals(pl.ptv);
  const ov = vals(pl.oar);
  const nv = vals(pl.normal);
  const mean = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0);
  let v95 = 0;
  for (let k = 0; k < D.length; k++) if (D[k]! >= 95) v95++;
  return {
    ptvMean: mean(pv),
    ptvD95: pv.length ? pv[Math.floor(0.05 * pv.length)]! : 0,
    ptvMin: pv[0] ?? 0,
    oarMax: ov.length ? ov[ov.length - 1]! : 0,
    oarMean: mean(ov),
    normalMean: mean(nv),
    normalV50: nv.length ? (100 * nv.filter((v) => v >= 50).length) / nv.length : 0,
    ci: pl.ptv.length ? v95 / pl.ptv.length : 0,
    pv,
    ov,
    nv,
  };
}

/** Otimização simples dos pesos (gradiente projetado): PTV uniforme, poupar OAR e tecido normal. */
export function optimizeWeights(s: RState, p: Params, iters = 400): number[] {
  const pl = plan(s, p);
  const nb = pl.beams.length;
  const lim = num(p, "limOAR", 40) / 100;
  const sub = (ids: number[]) => ids.filter((_, i) => i % 2 === 0);
  const P = sub(pl.ptv);
  const O = pl.oar;
  const N = sub(pl.normal);
  let w = Array.from({ length: nb }, () => 1 / nb);
  const Dat = (idx: number) => pl.beams.reduce((acc, b, i) => acc + w[i]! * b.dose[idx]!, 0);
  let L = 0;
  for (const b of pl.beams) {
    let s2 = 0;
    for (const i of P) s2 += b.dose[i]! ** 2;
    L = Math.max(L, s2 / Math.max(1, P.length));
  }
  const eta = 0.25 / Math.max(L * nb, 1e-6);
  for (let it = 0; it < iters; it++) {
    const g = new Array<number>(nb).fill(0);
    for (const i of P) {
      const r = Dat(i) - 1;
      pl.beams.forEach((b, k) => (g[k]! += (2 * r * b.dose[i]!) / P.length));
    }
    for (const i of O) {
      const r = Dat(i) - lim;
      if (r > 0) pl.beams.forEach((b, k) => (g[k]! += (2 * 4 * r * b.dose[i]!) / Math.max(1, O.length)));
    }
    for (const i of N) {
      const d = Dat(i);
      pl.beams.forEach((b, k) => (g[k]! += (2 * 0.15 * d * b.dose[i]!) / N.length));
    }
    w = w.map((v, k) => Math.max(0, v - eta * g[k]!));
  }
  const mx = Math.max(...w, 1e-12);
  return w.map((v) => v / mx);
}

// ---------- Desenho ----------

function colormap(v: number): string {
  // 0 → azul, 0,5 → verde, 0,8 → amarelo, 1 → vermelho
  const stops: [number, number, number, number][] = [
    [0, 40, 70, 220],
    [0.35, 30, 180, 220],
    [0.6, 60, 190, 80],
    [0.85, 240, 200, 40],
    [1, 220, 40, 40],
  ];
  const x = clamp(v, 0, 1);
  for (let i = 1; i < stops.length; i++) {
    const [x1, r1, g1, b1] = stops[i]!;
    const [x0, r0, g0, b0] = stops[i - 1]!;
    if (x <= x1) {
      const f = (x - x0) / (x1 - x0);
      return `rgb(${Math.round(r0 + f * (r1 - r0))},${Math.round(g0 + f * (g1 - g0))},${Math.round(b0 + f * (b1 - b0))})`;
    }
  }
  return "rgb(220,40,40)";
}

function colorbar(d: Draw, x: number, y0: number, y1: number, vmax: number, label: string) {
  const n = 30;
  for (let i = 0; i < n; i++) d.rect(x, y0 + ((y1 - y0) * i) / n, 0.5, (y1 - y0) / n + 0.01, { fill: colormap(i / (n - 1)) });
  for (const v of [0, 0.5, 1]) d.text(`${Math.round(v * vmax)}%`, x + 0.7, y0 + (y1 - y0) * v, { size: 9, align: "left", color: d.theme.muted });
  d.text(label, x + 0.25, y1 + 0.4, { size: 9, color: d.theme.muted });
}

const TANK = { x0: -16.4, x1: -2.4, y0: -9.0, y1: 6.4 };
const TS = (TANK.x1 - TANK.x0) / 28; // ±14 cm
const tankXY = (x: number, depth: number): [number, number] => [(TANK.x0 + TANK.x1) / 2 + x * TS, TANK.y1 - depth * TS];

function drawTank(d: Draw, s: RState, p: Params) {
  const th = d.theme;
  const k = modal(p);
  const maxDepth = (TANK.y1 - TANK.y0) / TS;
  d.rect(TANK.x0, TANK.y0, TANK.x1 - TANK.x0, TANK.y1 - TANK.y0, { fill: th.accent, alpha: 0.08, stroke: th.muted, width: 1 });
  const nx = 56;
  const ny = 62;
  const cw = (TANK.x1 - TANK.x0) / nx;
  const ch = (TANK.y1 - TANK.y0) / ny;
  for (let j = 0; j < ny; j++) {
    const dep = ((j + 0.5) / ny) * maxDepth;
    for (let i = 0; i < nx; i++) {
      const x = -14 + ((i + 0.5) / nx) * 28;
      const v = tankDose(p, x, dep, k) / 100;
      if (v < 0.05) continue;
      d.rect(TANK.x0 + i * cw, TANK.y1 - (j + 1) * ch, cw * 1.02, ch * 1.02, { fill: colormap(v), alpha: 0.75 });
    }
  }
  // feixe incidente
  const W = num(p, "campo", 10);
  const [a0] = tankXY(-W / 2, 0);
  const [a1] = tankXY(W / 2, 0);
  d.polyline([[a0 - 1, TANK.y1 + 2.0], [a0, TANK.y1], [a1, TANK.y1], [a1 + 1, TANK.y1 + 2.0]], { color: th.muted, width: 1, dash: [4, 3] });
  const name = k === 0 ? `fótons ${PHOTONS[Math.round(num(p, "foton", 1))]!.name}` : k === 1 ? `elétrons ${fmt(num(p, "Ee", 12))} MeV` : `prótons ${fmt(num(p, "Ep", 150))} MeV${num(p, "sobp") >= 0.5 ? " (SOBP)" : ""}`;
  d.text(`feixe de ${name}, campo ${fmt(W)} cm`, (TANK.x0 + TANK.x1) / 2, TANK.y1 + 2.4, { size: 11, weight: "600" });
  for (let dep = 5; dep < maxDepth; dep += 5) {
    const [, y] = tankXY(0, dep);
    d.line(TANK.x0, y, TANK.x0 + 0.4, y, { color: th.muted, width: 1 });
    d.text(`${dep}`, TANK.x0 + 0.5, y, { size: 9, align: "left", color: th.muted });
  }
  d.text("prof. (cm)", TANK.x0 + 0.2, TANK.y1 - 0.4, { size: 9, align: "left", color: th.muted });
  // câmara de ionização
  const [px, py] = tankXY(s.probe[0], s.probe[1]);
  d.circle(px, py, 0.35, { fill: th.dark ? "#141a22" : "#ffffff", stroke: th.text, width: 2 });
  d.line(px, py + 0.35, px, TANK.y1 + 0.6, { color: th.text, width: 1.5 });
  const r = tankDose(p, s.probe[0], s.probe[1]);
  d.text(`câmara: ${fmt(r, 3)} %  (x = ${fmt(s.probe[0], 2)} cm, d = ${fmt(s.probe[1], 3)} cm)`, (TANK.x0 + TANK.x1) / 2, TANK.y0 - 0.1, { size: 10, dy: 2, color: th.text });
  colorbar(d, TANK.x1 + 0.3, TANK.y0 + 1, TANK.y1 - 1, 100, "dose");
}

function drawPDD(d: Draw, s: RState, p: Params) {
  const th = d.theme;
  const k = modal(p);
  const box = { x0: 1.6, y0: -7.6, x1: 16.4, y1: 6.6 };
  const dmaxPlot = k === 1 ? Math.max(12, electronRanges(num(p, "Ee", 12)).Rp * 1.8) : 32;
  const pn = panel(d, box, { min: 0, max: dmaxPlot }, { min: 0, max: 115 });
  pn.frame({ xlabel: "profundidade na água (cm)", ylabel: "dose relativa (%)" });
  const cmp = num(p, "comparar") >= 0.5;
  const cols = [th.series[0]!, th.series[2]!, th.series[1]!];
  const names = ["fótons", "elétrons", "prótons"];
  for (let j = 0; j < 3; j++) {
    if (j !== k && !cmp) continue;
    pn.plot((x) => depthDose(p, x, j), 0, dmaxPlot, { color: cols[j]!, width: j === k ? 2.4 : 1.4, alpha: j === k ? 1 : 0.7, n: 500 });
  }
  if (cmp) names.forEach((n, j) => d.text(n, box.x1 - 0.3, box.y1 - 0.5 - j * 0.6, { size: 10, align: "right", color: cols[j]!, weight: j === k ? "700" : "400" }));
  const m = modeMetrics(p);
  d.line(pn.X(s.probe[1]), box.y0, pn.X(s.probe[1]), box.y1, { color: th.muted, width: 1, dash: [4, 3] });
  d.dot(pn.X(s.probe[1]), pn.Y(depthDose(p, s.probe[1])), 4, th.text);
  // marcas
  d.dot(pn.X(m.dmax), pn.Y(100), 4, cols[k]!);
  d.text(`máximo em ${fmt(m.dmax, 3)} cm`, pn.X(m.dmax), pn.Y(100), { size: 10, align: "left", dx: 6, dy: -8, color: cols[k]! });
  const lines: string[] = [];
  if (k === 0) lines.push(`PDD(10 cm) = ${fmt(m.pdd10, 3)} %   dose na superfície ${fmt(depthDose(p, 0), 3)} %`, "build-up: elétrons secundários levam ~dmax para entrar em equilíbrio");
  if (k === 1) {
    const r = electronRanges(num(p, "Ee", 12));
    lines.push(`R50 = E/2,33 = ${fmt(r.R50, 3)} cm   Rp = ${fmt(r.Rp, 3)} cm   R80 ≈ ${fmt(m.d80, 3)} cm`, "cauda: raios X de freamento gerados pelos elétrons");
  }
  if (k === 2) {
    lines.push(`alcance R = 0,0022·E^1,77 = ${fmt(protonRange(num(p, "Ep", 150)), 3)} cm   queda distal 80→20%: ${fmt((m.d20 - m.d80) * 10, 2)} mm`, `entrada/máximo = ${fmt(100 * m.entrance, 2)} %   quase nada de dose depois do pico`);
  }
  lines.forEach((l, i) => d.text(l, box.x0, box.y0 - 1.45 - i * 0.6, { size: 10, align: "left", color: i ? th.muted : th.text }));
}

const BX = { cx: -9.2, cy: -0.6, S: 0.48 };
const bodyXY = (x: number, y: number): [number, number] => [BX.cx + x * BX.S, BX.cy + y * BX.S];

function drawPlan(d: Draw, s: RState, p: Params, t: number) {
  const th = d.theme;
  const pl = plan(s, p);
  const D = doseMap(s, p);
  const st = planStats(s, p);
  // corpo
  const ell = (e: Ellipse, opts: Parameters<Draw["polyline"]>[1]) => {
    const pts: [number, number][] = [];
    for (let i = 0; i <= 72; i++) {
      const a = (2 * Math.PI * i) / 72;
      pts.push(bodyXY(e.cx + e.a * Math.cos(a), e.cy + e.b * Math.sin(a)));
    }
    d.polyline(pts, opts);
  };
  ell(BODY, { color: th.text, width: 1.5, fill: th.dark ? "#2a2f38" : "#f1e7dc", close: true });
  const cw = (30 / GX) * BX.S;
  const chh = (20 / GY) * BX.S;
  for (let j = 0; j < GY; j++)
    for (let i = 0; i < GX; i++) {
      const v = D[j * GX + i]!;
      if (v < 8) continue;
      const [x, y] = bodyXY(cellX(i), cellY(j));
      d.rect(x - cw / 2, y - chh / 2, cw * 1.03, chh * 1.03, { fill: colormap(v / 110), alpha: 0.6 });
    }
  if (num(p, "hetero") >= 0.5) for (const L of LUNGS) ell(L, { color: th.muted, width: 1, dash: [4, 3] });
  // feixes
  const [tx, ty] = s.tumor;
  const R = ptvR(p);
  pl.beams.forEach((b, i) => {
    const sx = Math.sin(b.th);
    const sy = Math.cos(b.th);
    const nx = Math.cos(b.th);
    const ny = -Math.sin(b.th);
    const w = s.w[i] ?? 1;
    const far = 16;
    for (const sg of [-1, 1]) {
      const [x0, y0] = bodyXY(tx + sx * far + sg * nx * R, ty + sy * far + sg * ny * R);
      const [x1, y1] = bodyXY(tx + sx * exitDistance(BODY, tx, ty, sx, sy) + sg * nx * R, ty + sy * exitDistance(BODY, tx, ty, sx, sy) + sg * ny * R);
      d.line(x0, y0, x1, y1, { color: th.series[4]!, width: 1, alpha: 0.3 + 0.7 * w });
    }
    const [ax, ay] = bodyXY(tx + sx * far, ty + sy * far);
    d.arrowPx(ax, ay, -sx, -sy, 26, { color: th.series[4]!, width: 2, alpha: 0.3 + 0.7 * w });
    d.text(`${i + 1}: ${fmt(w, 2)}`, ax, ay, { size: 9, color: th.series[4]!, dx: 12 * sx, dy: -12 * sy });
  });
  // estruturas
  const [cx, cy] = bodyXY(tx, ty);
  d.circle(cx, cy, R * BX.S, { stroke: th.positive, width: 2 });
  d.circle(cx, cy, num(p, "rT", 2.5) * BX.S, { stroke: th.positive, width: 1, dash: [3, 3] });
  d.text("PTV", cx, cy + R * BX.S, { size: 10, color: th.positive, weight: "700", dy: -8 });
  const [ox, oy] = bodyXY(s.oar[0], s.oar[1]);
  d.circle(ox, oy, OAR_R * BX.S, { stroke: th.series[5]!, width: 2 });
  d.text("órgão de risco", ox, oy - OAR_R * BX.S, { size: 10, color: th.series[5]!, weight: "700", dy: 9 });
  colorbar(d, 0.9, -6.5, 3.5, 110, "dose");
  const nfr = Math.round(num(p, "Dp", 60) / 2);
  const fr = Math.min(nfr, Math.floor(t / 0.5));
  d.text("Planejamento 2D: arraste o tumor e o órgão de risco", -16.4, 8.9, { size: 12, weight: "700", align: "left" });
  d.text(`fração ${fr} de ${nfr} (2 Gy cada)  ·  PTV recebeu ${fmt((fr * 2 * st.ptvMean) / 100, 3)} Gy  ·  OAR máx. ${fmt((fr * 2 * st.oarMax) / 100, 3)} Gy`, -16.4, 8.15, { size: 10, align: "left" });

  // DVH
  const box = { x0: 3.4, y0: -2.2, x1: 16.4, y1: 7.0 };
  const pn = panel(d, box, { min: 0, max: 120 }, { min: 0, max: 100 });
  pn.frame({ xlabel: "dose (% da prescrição)", ylabel: "volume que recebe ≥ dose (%)" });
  const dvh = (v: number[], col: string) => {
    if (!v.length) return;
    const pts: [number, number][] = [];
    for (let x = 0; x <= 120; x += 1) {
      let lo = 0;
      let hi = v.length;
      while (lo < hi) {
        const m = (lo + hi) >> 1;
        if (v[m]! < x) lo = m + 1;
        else hi = m;
      }
      pts.push([x, (100 * (v.length - lo)) / v.length]);
    }
    pn.line(pts, { color: col, width: 2 });
  };
  dvh(st.pv, th.positive);
  dvh(st.ov, th.series[5]!);
  dvh(st.nv, th.accent);
  d.text("vermelho: PTV   amarelo: órgão de risco   azul: tecido normal", box.x0, box.y0 - 1.45, { size: 10, align: "left", color: th.muted });
  const rows = [
    `PTV: média ${fmt(st.ptvMean, 3)} %, D95 ${fmt(st.ptvD95, 3)} %, mínimo ${fmt(st.ptvMin, 3)} %`,
    `órgão de risco: máximo ${fmt(st.oarMax, 3)} %, média ${fmt(st.oarMean, 3)} %`,
    `tecido normal: dose média ${fmt(st.normalMean, 3)} %, volume com ≥ 50%: ${fmt(st.normalV50, 3)} %`,
    `índice de conformidade V95/V_PTV = ${fmt(st.ci, 3)}`,
  ];
  rows.forEach((r, i) => d.text(r, box.x0, box.y0 - 2.3 - i * 0.72, { size: 11, align: "left" }));
  d.text("Use “Otimizar pesos” para reduzir a dose no órgão de risco.", box.x0, box.y0 - 2.3 - 4 * 0.72, { size: 10, align: "left", color: th.muted });
}

const initState = (): RState => ({ probe: [0, 5], tumor: [3, 0], oar: [0, -6.5], w: new Array<number>(9).fill(1), drag: null });

export const radioterapia = defineSim<RState>({
  id: "radioterapia",
  title: "Radioterapia: dose em profundidade e planejamento",
  course: "FG IV",
  topic: "Física nuclear",
  priority: "P2",
  summary:
    "Curvas de dose em profundidade na água para fótons (build-up e atenuação), elétrons (alcance prático) e prótons (pico de Bragg e pico espalhado), medidas com uma câmara de ionização arrastável. No planejamento 2D, combine feixes de várias direções sobre um tumor, veja o mapa de dose e o histograma dose–volume e poupe o órgão de risco.",
  equations: [
    String.raw`\text{PDD}(d) \propto \big(1 - (1 - s_0)e^{-\beta d}\big)\,e^{-\mu d}\left(\frac{\text{SSD} + d_{\max}}{\text{SSD} + d}\right)^2`,
    String.raw`R_{50} \approx \frac{E}{2{,}33\ \text{MeV/cm}},\qquad R_p \approx 1{,}271R_{50} - 0{,}23\ \text{cm}`,
    String.raw`R = \alpha E^{p}\ (\alpha = 0{,}0022\ \text{cm},\ p = 1{,}77),\qquad -\frac{dE}{dx} = \frac{(R - d)^{1/p - 1}}{p\,\alpha^{1/p}}`,
    String.raw`D_{\text{total}}(\vec r) = \sum_i w_i\,\text{PDD}_i(d_i)\,\text{OAR}_i(\ell_i)`,
  ],
  liveEquations(s, p) {
    if (mode(p) === 1) {
      const st = planStats(s, p);
      return [String.raw`\bar D_{\text{PTV}} = 100\%,\quad D_{95} = ${texNum(st.ptvD95)}\%,\quad D_{\max}^{\text{OAR}} = ${texNum(st.oarMax)}\%\ \Rightarrow\ ${texNum((num(p, "Dp", 60) * st.oarMax) / 100)}\ \text{Gy}`];
    }
    const k = modal(p);
    if (k === 2) {
      const E = num(p, "Ep", 150);
      return [String.raw`R = 0{,}0022\,(${texNum(E)})^{1{,}77} = ${texNum(protonRange(E))}\ \text{cm}`];
    }
    if (k === 1) {
      const E = num(p, "Ee", 12);
      return [String.raw`R_{50} = \frac{${texNum(E)}}{2{,}33} = ${texNum(electronRanges(E).R50)}\ \text{cm},\quad R_p = ${texNum(electronRanges(E).Rp)}\ \text{cm}`];
    }
    return [String.raw`\text{PDD}(${texNum(s.probe[1])}\ \text{cm}) = ${texNum(depthDose(p, s.probe[1]))}\%`];
  },
  params: [
    { key: "modo", label: "Atividade", unit: "", min: 0, max: 1, step: 1, default: 0, options: [{ value: 0, label: "Dose em profundidade na água" }, { value: 1, label: "Planejamento com vários feixes" }] },
    { key: "modal", label: "Radiação", unit: "", min: 0, max: 2, step: 1, default: 0, options: [{ value: 0, label: "fótons" }, { value: 1, label: "elétrons" }, { value: 2, label: "prótons" }] },
    { key: "foton", label: "Energia dos fótons", unit: "", min: 0, max: 3, step: 1, default: 1, options: PHOTONS.map((b, i) => ({ value: i, label: b.name })) },
    { key: "Ee", label: "Energia dos elétrons", unit: "MeV", min: 4, max: 22, step: 1, default: 12 },
    { key: "Ep", label: "Energia dos prótons", unit: "MeV", min: 70, max: 230, step: 1, default: 150 },
    { key: "sobp", label: "Feixe de prótons", unit: "", min: 0, max: 1, step: 1, default: 0, options: [{ value: 0, label: "pico de Bragg puro" }, { value: 1, label: "pico espalhado (SOBP)" }] },
    { key: "M", label: "Largura da modulação (SOBP)", unit: "cm", min: 1, max: 12, step: 0.5, default: 5 },
    { key: "campo", label: "Largura do campo", unit: "cm", min: 2, max: 20, step: 1, default: 10, live: true },
    { key: "comparar", label: "Comparar as três radiações", unit: "", min: 0, max: 1, step: 1, default: 1, live: true, options: [{ value: 0, label: "não" }, { value: 1, label: "sim" }] },
    { key: "nf", label: "Número de feixes", unit: "", min: 1, max: 9, step: 1, default: 4, live: true },
    { key: "ang0", label: "Ângulo do primeiro feixe", unit: "°", min: 0, max: 359, step: 1, default: 0, live: true },
    { key: "arco", label: "Abertura do leque de feixes", unit: "°", min: 30, max: 360, step: 5, default: 360, live: true },
    { key: "pmod", label: "Radiação do plano", unit: "", min: 0, max: 2, step: 1, default: 0, live: true, options: [{ value: 0, label: "fótons 6 MV" }, { value: 1, label: "fótons 18 MV" }, { value: 2, label: "prótons (SOBP por feixe)" }] },
    { key: "rT", label: "Raio do tumor", unit: "cm", min: 1, max: 4, step: 0.1, default: 2.5, live: true },
    { key: "margem", label: "Margem de segurança (PTV)", unit: "cm", min: 0, max: 1.5, step: 0.1, default: 0.5, live: true },
    { key: "hetero", label: "Pulmões (densidade 0,25)", unit: "", min: 0, max: 1, step: 1, default: 0, live: true, options: [{ value: 0, label: "tudo água" }, { value: 1, label: "com pulmões" }] },
    { key: "limOAR", label: "Limite desejado no órgão de risco", unit: "%", min: 10, max: 90, step: 5, default: 40, live: true },
    { key: "Dp", label: "Dose prescrita (2 Gy por fração)", unit: "Gy", min: 20, max: 80, step: 2, default: 60 },
  ],
  observables: [
    { key: "leitura", label: "Leitura da câmara (dose relativa)", unit: "%", value: (s, p) => tankDose(p, s.probe[0], s.probe[1]) },
    { key: "prof", label: "Profundidade da câmara", unit: "cm", value: (s) => s.probe[1] },
    { key: "dmax", label: "Profundidade do máximo", unit: "cm", value: (_s, p) => modeMetrics(p).dmax },
    { key: "pdd10", label: "Dose a 10 cm", unit: "%", value: (_s, p) => modeMetrics(p).pdd10 },
    { key: "d80", label: "Profundidade distal de 80%", unit: "cm", value: (_s, p) => modeMetrics(p).d80 || 0 },
    { key: "queda", label: "Queda distal 80→20%", unit: "mm", value: (_s, p) => (modal(p) === 0 ? 0 : (modeMetrics(p).d20 - modeMetrics(p).d80) * 10 || 0) },
    { key: "entrada", label: "Dose de entrada / máxima", unit: "%", value: (_s, p) => 100 * modeMetrics(p).entrance },
    { key: "ptv", label: "D95 do PTV", unit: "%", value: (s, p) => (mode(p) === 1 ? planStats(s, p).ptvD95 : 0) },
    { key: "oarMax", label: "Dose máxima no órgão de risco", unit: "%", value: (s, p) => (mode(p) === 1 ? planStats(s, p).oarMax : 0) },
    { key: "normal", label: "Dose média no tecido normal", unit: "%", value: (s, p) => (mode(p) === 1 ? planStats(s, p).normalMean : 0) },
    { key: "v50", label: "Tecido normal com dose ≥ 50%", unit: "%", value: (s, p) => (mode(p) === 1 ? planStats(s, p).normalV50 : 0) },
    { key: "ci", label: "Índice de conformidade", unit: "", value: (s, p) => (mode(p) === 1 ? planStats(s, p).ci : 0) },
    { key: "gy", label: "Dose acumulada no PTV", unit: "Gy", value: (s, p, t) => (mode(p) === 1 ? Math.min(Math.round(num(p, "Dp", 60) / 2), Math.floor(t / 0.5)) * 2 * (planStats(s, p).ptvMean / 100) : 0) },
  ],
  chart: { x: "prof", y: "leitura" },
  scenarios: [
    {
      id: "comparar",
      label: "Fótons × elétrons × prótons",
      params: { modo: 0, modal: 0, foton: 1, Ee: 12, Ep: 150, sobp: 0, comparar: 1 },
      guide: `### Três jeitos de depositar energia
1. **Fótons** (6 MV): a dose sobe nos primeiros 1,5 cm (build-up: os elétrons secundários ainda estão se acumulando) e depois cai devagar, quase exponencialmente. A pele é poupada.
2. **Elétrons** (12 MeV): dose quase uniforme até ~4 cm e queda abrupta perto de $R_p \\approx 6$ cm. Bons para tumores superficiais.
3. **Prótons** (150 MeV): dose baixa na entrada e um pico estreito (Bragg) no fim do alcance $R \\approx 15{,}6$ cm, e quase nada depois.
4. Arraste a câmara de ionização no tanque e leia a dose; o gráfico registra leitura × profundidade.
5. Mude as energias: o alcance dos prótons cresce como $E^{1,77}$; o dos elétrons, como $E/2$.`,
      predict: [
        {
          question: "Qual radiação deposita a maior parte da dose perto do fim do seu alcance, quase sem dose além dele?",
          options: ["Fótons de 6 MV", "Elétrons de 12 MeV", "Prótons de 150 MeV", "Todas igualmente"],
          answer: 2,
          explanation: "O poder de freamento cresce quando o próton fica lento ($-dE/dx \\propto 1/v^2$): a perda de energia se concentra no fim do caminho (pico de Bragg). Fótons são atenuados exponencialmente e atravessam o corpo.",
        },
      ],
    },
    {
      id: "sobp",
      label: "Pico de Bragg espalhado",
      params: { modo: 0, modal: 2, Ep: 160, sobp: 1, M: 5, comparar: 0 },
      guide: `### Cobrindo um tumor espesso
1. Um único pico de Bragg tem poucos milímetros: não cobre um tumor de 5 cm.
2. O **SOBP** soma picos de energias decrescentes com pesos escolhidos para dar um platô plano (veja os pesos convergirem no cálculo).
3. Responda à previsão e compare a dose de entrada (observável "entrada/máxima") entre o pico puro e o SOBP.
4. Aumente a modulação $M$: o platô fica mais largo e a entrada sobe.
5. A queda distal (80→20%) continua de poucos mm: é isso que permite poupar um órgão logo atrás do tumor.`,
      predict: [
        {
          question: "Ao espalhar o pico para cobrir 5 cm, a dose na entrada (relativa ao platô) fica…",
          options: ["menor que no pico puro", "igual", "maior que no pico puro", "zero"],
          answer: 2,
          explanation: "Cada pico raso contribui com sua própria entrada, e os picos mais profundos passam pela região proximal: a entrada sobe de ~20% para ~40–60% do platô.",
        },
      ],
    },
    {
      id: "plano",
      label: "Planejamento: vários feixes",
      params: { modo: 1, nf: 1, ang0: 0, pmod: 0, rT: 2.5, margem: 0.5, hetero: 0 },
      guide: `### Por que vários feixes?
1. Com **um** feixe de fótons, o tecido na entrada recebe mais dose que o tumor (veja o DVH azul).
2. Responda à previsão e passe para 4 e depois 7 feixes: a dose no tumor se soma e a de cada caminho se divide. Compare o volume de tecido normal com dose ≥ 50% e a dose média: a energia total depositada quase não muda, ela só se espalha.
3. Arraste o órgão de risco para dentro de um dos feixes e use **Otimizar pesos**: o peso do feixe que atravessa o órgão cai.
4. Troque para prótons: com 2 ou 3 feixes já se consegue poupar o que fica atrás do tumor.
5. Ligue os pulmões: a menor densidade faz a dose chegar mais longe (profundidade radiológica).
6. Rode a simulação para "aplicar" as frações e acompanhe a dose acumulada em Gy.`,
      predict: [
        {
          question: "Trocando 1 feixe por 5 feixes de direções diferentes (mesma dose média no tumor), o que acontece com o tecido normal?",
          options: ["Recebe 5 vezes mais dose em todo lugar", "Nada muda", "Menos volume recebe dose alta, mas mais volume recebe dose baixa", "Deixa de receber dose"],
          answer: 2,
          explanation: "Os campos se cruzam só no tumor. Fora dele, cada região é atravessada por poucos feixes, cada um com cerca de 1/5 do peso: o volume com dose alta despenca, enquanto a dose baixa se espalha (a dose média muda pouco).",
        },
      ],
    },
  ],
  exercises: [
    {
      id: "alcance",
      prompt: "Um tumor tem a borda distal a {R} cm de profundidade (tecido ≈ água). Que energia (MeV) deve ter um feixe de prótons para que o fim do alcance coincida com essa borda? Use R = 0,0022 E^1,77 (R em cm, E em MeV).",
      vary: { R: [5, 28, 1] },
      fixed: { modo: 0, modal: 2 },
      answer: { label: "E", unit: "MeV", compute: (p) => protonEnergy(num(p, "R")) },
      hint: "E = (R/0,0022)^(1/1,77).",
    },
    {
      id: "eletrons",
      prompt: "Um feixe de elétrons de {Ee} MeV incide na água. Estime o alcance prático R_p (cm), usando R50 = E/2,33 e R_p = 1,271 R50 − 0,23.",
      vary: { Ee: [6, 20, 0] },
      fixed: { modo: 0, modal: 1 },
      answer: { label: "R_p", unit: "cm", compute: (p) => electronRanges(num(p, "Ee")).Rp },
    },
    {
      id: "quadrado",
      prompt: "A taxa de dose de um acelerador é {D0} cGy/min a 100 cm da fonte. Qual a taxa (cGy/min) a {r} cm da fonte, desprezando a atenuação?",
      vary: { D0: [200, 600, 0], r: [80, 150, 0] },
      fixed: { modo: 0 },
      answer: { label: "taxa", unit: "cGy/min", compute: (p) => num(p, "D0") * (100 / num(p, "r")) ** 2 },
      hint: "Lei do inverso do quadrado da distância.",
    },
  ],
  init: () => initState(),
  step: (s) => s,
  stopWhen: (_s, p, t) => (mode(p) === 1 ? Math.round(num(p, "Dp", 60) / 2) * 0.5 + 0.25 - t : 1),
  dt: 1 / 60,
  sampleEvery: 6,
  maxSamples: 2000,
  actions: [
    {
      id: "otimizar",
      label: "Otimizar pesos dos feixes",
      run: (s, p) => {
        const w = optimizeWeights(s, p);
        return { ...s, w: w.concat(new Array<number>(9 - w.length).fill(1)) };
      },
    },
    { id: "iguais", label: "Pesos iguais", run: (s) => ({ ...s, w: new Array<number>(9).fill(1) }) },
    { id: "padrao", label: "Posições padrão", run: (s) => ({ ...initState(), w: s.w }) },
  ],
  pointer: {
    down(s, p, pt) {
      if (mode(p) === 0) {
        if (pt.x < TANK.x0 || pt.x > TANK.x1 || pt.y < TANK.y0 || pt.y > TANK.y1) return undefined;
        const x = (pt.x - (TANK.x0 + TANK.x1) / 2) / TS;
        const dep = (TANK.y1 - pt.y) / TS;
        return { ...s, drag: "probe", probe: [clamp(x, -14, 14), clamp(dep, 0, 31)] };
      }
      const x = (pt.x - BX.cx) / BX.S;
      const y = (pt.y - BX.cy) / BX.S;
      if (Math.hypot(x - s.oar[0], y - s.oar[1]) < OAR_R + 0.8) return { ...s, drag: "oar" };
      if (Math.hypot(x - s.tumor[0], y - s.tumor[1]) < ptvR(p) + 0.8) return { ...s, drag: "tumor" };
      return undefined;
    },
    move(s, p, pt, dragging) {
      if (!dragging || !s.drag) return undefined;
      if (s.drag === "probe") return { ...s, probe: [clamp((pt.x - (TANK.x0 + TANK.x1) / 2) / TS, -14, 14), clamp((TANK.y1 - pt.y) / TS, 0, 31)] };
      let x = (pt.x - BX.cx) / BX.S;
      let y = (pt.y - BX.cy) / BX.S;
      const r = s.drag === "tumor" ? ptvR(p) : OAR_R;
      const e = Math.hypot(x / (BODY.a - r), y / (BODY.b - r));
      if (e > 1) {
        x /= e;
        y /= e;
      }
      return s.drag === "tumor" ? { ...s, tumor: [x, y] } : { ...s, oar: [x, y] };
    },
    up: (s) => (s.drag ? { ...s, drag: null } : undefined),
    cursor: (_s, p, pt) => (mode(p) === 0 ? (pt.x > TANK.x0 && pt.x < TANK.x1 && pt.y > TANK.y0 && pt.y < TANK.y1 ? "crosshair" : undefined) : pt.x < -0.5 ? "grab" : undefined),
  },
  narrowSplit: () => 0.504,
  viewport: () => ({ ...VIEW, unit: "" }),
  render(ctx, frame) {
    const d = draw(ctx, frame);
    if (mode(frame.params) === 0) {
      drawTank(d, frame.state, frame.params);
      drawPDD(d, frame.state, frame.params);
    } else drawPlan(d, frame.state, frame.params, frame.t);
  },
});

export default radioterapia;
