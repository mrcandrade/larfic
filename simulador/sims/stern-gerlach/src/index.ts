import { clamp, defineSim, draw, num, rad, texNum, type Draw, type Params } from "@fisilab/core";
import { fmt, panel } from "./panel.ts";
import { deflection, gaussianFrom, lastPlusConditional, nextRandom, probPlus, seriesOutcome, zAlong } from "./physics.ts";

export * from "./physics.ts";

/** Átomo em voo. Modo 0: s é μ_z/μ_B (±1 quântico, cos α clássico). Modo 1: desfechos já sorteados. */
export interface Atom {
  tb: number;
  v: number;
  /** Posição ao longo da fenda (−1 a 1) e desvio inicial (mm). */
  xs: number;
  z0: number;
  s: number;
  /** Modo 1: porta de saída (+1/−1) em cada aparelho até onde chegou. */
  outs: number[];
}

export interface SGState {
  seed: number;
  atoms: Atom[];
  acc: number;
  emitted: number;
  /** Modo 0: impactos [xs, z(mm), ...] (os mais recentes) e histograma de z. */
  hits: number[];
  hist: number[];
  up: number;
  down: number;
  /** Modo 1: bloqueados em cada aparelho e contagem nas portas + e − do último. */
  blocked: number[];
  final: [number, number];
}

const NB = 64;
const T_FLY = 1.8;
const SPEED1 = 9;
const MAX_HITS = 2500;
const VIEW = { xMin: -17, xMax: 17, yMin: -9.5, yMax: 9.5 };
/** Posições no palco: colimador, anteparo. */
const X_COL = -11;
const X_SCREEN = 6.5;
const X_OVEN = -14.2;

const mode = (p: Params) => Math.round(num(p, "modo"));
const quantumModel = (p: Params) => num(p, "modelo") < 0.5;
const geom = (p: Params) => ({
  grad: num(p, "grad", 1000),
  v: num(p, "v", 550),
  L1: num(p, "L1", 3.5) / 100,
  Ld: num(p, "Ld", 10) / 100,
});
/** Desvio nominal no anteparo (mm) para μ_z = μ_B. */
export const d0mm = (p: Params) => {
  const g = geom(p);
  return deflection(g.grad, g.v, g.L1, g.Ld) * 1000;
};
/** Fator de "lábio": o gradiente é mais forte no meio da fenda (como na placa original de 1922). */
const lip = (xs: number) => 1 - 0.55 * xs * xs;
/** Ampliação vertical (unidades de palco por mm), escolhida para caber. */
const MAGS = [8, 4, 2, 1, 0.5, 0.25, 0.125];
export const magFor = (p: Params) => MAGS.find((m) => d0mm(p) * m <= 3.4) ?? 0.125;
/** Faixa do histograma (mm). */
const zRange = (p: Params) => 1.5 * d0mm(p) + 0.2;

export const devices = (p: Params) => {
  const n = clamp(Math.round(num(p, "nAp", 2)), 1, 3);
  const th = [num(p, "th1", 0), num(p, "th2", 90), num(p, "th3", 0)].slice(0, n).map(rad);
  const keep = [num(p, "porta1", 1) >= 0 ? 1 : -1, num(p, "porta2", 1) >= 0 ? 1 : -1];
  const xs = n === 1 ? [-4] : n === 2 ? [-7, 0.5] : [-9.5, -3, 3.5];
  return { n, th, keep, xs };
};

function emitAtom(s: SGState, p: Params, t: number): Atom {
  const g = geom(p);
  const v = Math.max(0.4 * g.v, g.v * (1 + 0.12 * gaussianFrom(s)));
  const xs = 2 * nextRandom(s) - 1;
  const z0 = 0.05 * gaussianFrom(s);
  if (mode(p) === 0) {
    const sz = quantumModel(p) ? (nextRandom(s) < 0.5 ? 1 : -1) : 2 * nextRandom(s) - 1;
    return { tb: t, v, xs, z0, s: sz, outs: [] };
  }
  const { n, th, keep } = devices(p);
  const outs: number[] = [];
  let phi: number | null = null;
  for (let i = 0; i < n; i++) {
    const o: number = nextRandom(s) < probPlus(th[i]!, phi) ? 1 : -1;
    outs.push(o);
    phi = o > 0 ? th[i]! : th[i]! + Math.PI;
    if (i < n - 1 && o !== keep[i]) break;
  }
  return { tb: t, v, xs, z0, s: 0, outs };
}

/** Desvio final (mm) de um átomo no modo 0. */
const hitZ = (a: Atom, p: Params) => {
  const g = geom(p);
  return a.z0 + a.s * lip(a.xs) * deflection(g.grad, a.v, g.L1, g.Ld) * 1000;
};

function recordHit(s: SGState, p: Params, a: Atom) {
  const z = hitZ(a, p);
  s.hits.push(a.xs, z);
  if (s.hits.length > 2 * MAX_HITS) s.hits.splice(0, s.hits.length - 2 * MAX_HITS);
  const R = zRange(p);
  const b = Math.floor(((z + R) / (2 * R)) * NB);
  if (b >= 0 && b < NB) s.hist[b]!++;
  if (z > 0) s.up++;
  else s.down++;
}

function recordSeries(s: SGState, p: Params, a: Atom) {
  const { n } = devices(p);
  if (a.outs.length < n) s.blocked[a.outs.length - 1]!++;
  else s.final[a.outs[n - 1]! > 0 ? 0 : 1]++;
}

/** Caminho do átomo no esquema de aparelhos em série. */
function seriesPath(p: Params, a: Atom): [number, number][] {
  const { n, xs } = devices(p);
  const pts: [number, number][] = [[X_OVEN, 0]];
  for (let i = 0; i < a.outs.length; i++) {
    const o = a.outs[i]!;
    pts.push([xs[i]! - 1.7, 0], [xs[i]! + 1.7, 0.9 * o]);
    if (i === n - 1) pts.push([xs[i]! + 4.2, 2.2 * o]);
    else if (i === a.outs.length - 1) pts.push([xs[i]! + 2.5, 1.5 * o]);
  }
  return pts;
}

function pathPoint(pts: [number, number][], dist: number): [number, number] | null {
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1]!;
    const [x1, y1] = pts[i]!;
    const L = Math.hypot(x1 - x0, y1 - y0);
    if (dist <= L) return [x0 + ((x1 - x0) * dist) / L, y0 + ((y1 - y0) * dist) / L];
    dist -= L;
  }
  return null;
}
const pathLength = (pts: [number, number][]) => pts.slice(1).reduce((acc, q, i) => acc + Math.hypot(q[0] - pts[i]![0], q[1] - pts[i]![1]), 0);

/** Frações medidas e esperadas. */
export function measured(s: SGState, p: Params): { N: number; frac: number; expected: number } {
  if (mode(p) === 0) {
    const N = s.up + s.down;
    return { N, frac: N ? s.up / N : 0, expected: 0.5 };
  }
  const { th, keep } = devices(p);
  const N = s.final[0] + s.final[1];
  return { N, frac: N ? s.final[0] / N : 0, expected: lastPlusConditional(th, keep) };
}

/** Envia `count` átomos de uma vez, sem animação. */
export function fastForward(s: SGState, p: Params, count: number): SGState {
  const ns: SGState = { ...s, hits: s.hits.slice(), hist: s.hist.slice(), blocked: s.blocked.slice(), final: [s.final[0], s.final[1]] };
  for (let i = 0; i < count; i++) {
    const a = emitAtom(ns, p, 0);
    if (mode(p) === 0) recordHit(ns, p, a);
    else recordSeries(ns, p, a);
  }
  ns.emitted += count;
  return ns;
}

const angName = (deg: number) => {
  const d = ((Math.round(deg) % 360) + 360) % 360;
  return d === 0 ? "z" : d === 90 ? "x" : d === 180 ? "−z" : d === 270 ? "−x" : `${d}°`;
};

function drawMode0(d: Draw, s: SGState, p: Params, t: number) {
  const th = d.theme;
  const g = geom(p);
  const mag = magFor(p);
  const ytot = 0.03 + g.L1 + g.Ld;
  const X = (y: number) => X_COL + ((y + 0.03) / ytot) * (X_SCREEN - X_COL);
  const xm0 = X(0);
  const xm1 = X(g.L1);
  // forno e colimador
  d.rect(-16.4, -1.3, 2.2, 2.6, { fill: th.series[1]! + "55", stroke: th.series[1]!, width: 1.5 });
  d.text("forno", -15.3, 1.9, { size: 11, color: th.muted });
  d.text("Ag", -15.3, 0, { size: 12, weight: "700", color: th.text });
  for (const xc of [-12.8, X_COL]) {
    d.line(xc, 0.25, xc, 2.2, { color: th.text, width: 3 });
    d.line(xc, -0.25, xc, -2.2, { color: th.text, width: 3 });
  }
  d.text("fendas", (X_COL - 12.8) / 2 + 0, -2.7, { size: 11, color: th.muted });
  // ímã (vista lateral)
  const gap = 1.25 + Math.min(1.2, 0.4 * d0mm(p) * mag);
  d.rect(xm0, gap, xm1 - xm0, 3.6, { fill: th.positive + "40", stroke: th.positive, width: 1.5 });
  d.rect(xm0, -gap - 3.6, xm1 - xm0, 3.6, { fill: th.negative + "40", stroke: th.negative, width: 1.5 });
  d.text("N", (xm0 + xm1) / 2, gap + 1.8, { size: 15, weight: "700", color: th.positive });
  d.text("S", (xm0 + xm1) / 2, -gap - 1.8, { size: 15, weight: "700", color: th.negative });
  d.arrow(xm1 + 0.5, -1, 0, 2, { color: th.text, width: 1.5 });
  d.text("∂B/∂z", xm1 + 0.6, 1.3, { size: 11, align: "left", color: th.text });
  // trajetórias nominais
  const traj = (sg: number, color: string, dash?: number[]) => {
    const pts: [number, number][] = [];
    for (let i = 0; i <= 80; i++) {
      const y = -0.03 + (ytot * i) / 80;
      pts.push([X(y), zAlong(y, sg, g.grad, g.v, g.L1) * 1000 * mag]);
    }
    d.polyline(pts, { color, width: 1.2, dash, alpha: 0.6 });
  };
  if (quantumModel(p)) {
    traj(1, th.accent, [5, 4]);
    traj(-1, th.accent, [5, 4]);
  } else {
    d.polyline(
      [
        [xm0, 0],
        [X_SCREEN, d0mm(p) * mag],
        [X_SCREEN, -d0mm(p) * mag],
      ],
      { color: "none", fill: th.series[1]! + "22", close: true },
    );
  }
  d.line(X(-0.03), 0, xm0, 0, { color: th.accent, width: 1, alpha: 0.5 });
  // anteparo
  d.line(X_SCREEN, -4.6, X_SCREEN, 4.6, { color: th.text, width: 3 });
  d.text("anteparo", X_SCREEN, -5.1, { size: 11, color: th.muted });
  // átomos em voo
  const colAtom = quantumModel(p) ? th.accent : th.series[1]!;
  for (const a of s.atoms) {
    const u = ((t - a.tb) * a.v) / (g.v * T_FLY);
    const x = X_OVEN + u * (X_SCREEN - X_OVEN);
    const y = x < X_COL ? -0.03 : -0.03 + ((x - X_COL) / (X_SCREEN - X_COL)) * ytot;
    const z = (a.z0 + (x < X_COL ? 0 : a.s * lip(a.xs) * zAlong(y, 1, g.grad, a.v, g.L1) * 1000)) * mag;
    if (x <= X_SCREEN) d.dot(x, clamp(z, -4.5, 4.5), 3, colAtom);
  }
  // escala vertical
  const bar = 1 / mag >= 1 ? Math.round(1 / mag) : 1 / mag;
  const L = bar * mag;
  d.line(X_SCREEN + 0.9, -4.4, X_SCREEN + 0.9, -4.4 + L, { color: th.text, width: 2 });
  d.text(`${fmt(bar)} mm`, X_SCREEN + 1.1, -4.4 + L / 2, { size: 10, align: "left", color: th.text });
  d.text("escala vertical ampliada", -2, 5.2, { size: 11, color: th.muted });

  // anteparo visto de frente + histograma
  const box = { x0: 9.6, y0: -4.6, x1: 14.6, y1: 4.6 };
  const R = zRange(p);
  const Z = (zmm: number) => (box.y0 + box.y1) / 2 + (zmm / R) * ((box.y1 - box.y0) / 2);
  d.rect(box.x0, box.y0, box.x1 - box.x0, box.y1 - box.y0, { fill: th.dark ? "#10151c" : "#f4f1e8", stroke: th.muted, width: 1 });
  d.text("anteparo (de frente)", (box.x0 + box.x1) / 2, box.y1 + 0.45, { size: 11, color: th.text, weight: "600" });
  const ctx = d.ctx;
  ctx.fillStyle = th.dark ? "#d9dee6" : "#3a3f47";
  const sz = 2 * d.px;
  for (let i = 0; i < s.hits.length; i += 2) {
    const zz = Z(s.hits[i + 1]!);
    if (zz < box.y0 || zz > box.y1) continue;
    ctx.globalAlpha = 0.55;
    ctx.fillRect((box.x0 + box.x1) / 2 + s.hits[i]! * 2.3 - sz / 2, zz - sz / 2, sz, sz);
  }
  ctx.globalAlpha = 1;
  // previsões: duas linhas (quântico) e faixa (clássico)
  const lipCurve = (sg: number, color: string) => {
    const pts: [number, number][] = [];
    for (let i = 0; i <= 40; i++) {
      const xs = -1 + (2 * i) / 40;
      pts.push([(box.x0 + box.x1) / 2 + xs * 2.3, Z(sg * lip(xs) * d0mm(p))]);
    }
    d.polyline(pts, { color, width: 1, dash: [3, 3], alpha: 0.8 });
  };
  lipCurve(1, th.accent);
  lipCurve(-1, th.accent);
  // histograma
  const hb = { x0: 14.9, x1: 16.8 };
  const hmax = Math.max(1, ...s.hist);
  for (let i = 0; i < NB; i++) {
    const c = s.hist[i]!;
    if (!c) continue;
    const y0 = box.y0 + (i / NB) * (box.y1 - box.y0);
    d.rect(hb.x0, y0, ((hb.x1 - hb.x0) * c) / hmax, (box.y1 - box.y0) / NB, { fill: colAtom, alpha: 0.8 });
  }
  d.line(hb.x0, box.y0, hb.x0, box.y1, { color: th.muted, width: 1 });
  d.text("contagem", (hb.x0 + hb.x1) / 2, box.y0 - 0.45, { size: 10, color: th.muted });

  // corte do ímã (de frente)
  const cx = -13;
  const cy = -7;
  d.text("ímã visto de frente", cx, -4.5, { size: 11, color: th.text, weight: "600" });
  d.polyline(
    [
      [cx - 2.2, -5],
      [cx + 2.2, -5],
      [cx + 2.2, -6],
      [cx + 0.3, -6],
      [cx, -6.5],
      [cx - 0.3, -6],
      [cx - 2.2, -6],
    ],
    { color: th.positive, close: true, fill: th.positive + "40", width: 1.5 },
  );
  d.polyline(
    [
      [cx - 2.2, -9.2],
      [cx + 2.2, -9.2],
      [cx + 2.2, -7.8],
      [cx + 0.7, -7.8],
      [cx + 0.45, -8.3],
      [cx - 0.45, -8.3],
      [cx - 0.7, -7.8],
      [cx - 2.2, -7.8],
    ],
    { color: th.negative, close: true, fill: th.negative + "40", width: 1.5 },
  );
  for (const xx of [-1.6, -0.8, 0, 0.8, 1.6]) {
    d.line(cx + xx * 0.9, -8.0, cx + xx * 0.2, -6.4, { color: th.muted, width: 1, alpha: 0.7 });
  }
  d.line(cx - 1.1, -7.2, cx + 1.1, -7.2, { color: th.accent, width: 3 });
  d.text("feixe (fita)", cx + 1.3, -7.2, { size: 10, align: "left", color: th.accent });
  d.text("B mais forte junto à quina: ∂B/∂z ≠ 0", cx + 2.4, -8.9, { size: 10, align: "left", color: th.muted });

  // legenda
  const m = measured(s, p);
  d.text(quantumModel(p) ? "Modelo quântico: μ_z = ±μ_B (spin ½)" : "Modelo clássico: μ com orientação aleatória", -16.6, 8.7, { size: 13, weight: "700", align: "left", color: colAtom });
  d.text(`desvio previsto ±${fmt(d0mm(p))} mm   átomos no anteparo: ${m.N}   em cima: ${m.N ? fmt(100 * m.frac) : "—"} %`, -16.6, 7.9, { size: 11, align: "left", color: th.text });
  d.text("tracejado azul: as duas linhas previstas pela quântica", -16.6, 7.2, { size: 11, align: "left", color: th.muted });
}

function deviceIcon(d: Draw, x: number, y: number, theta: number, label: string) {
  const th = d.theme;
  d.rect(x - 1.7, y - 1.4, 3.4, 2.8, { fill: th.grid, stroke: th.text, width: 1.5 });
  d.text(`SG ${label}`, x, y + 1.85, { size: 12, weight: "700", color: th.text });
  // bússola: direção do eixo de medida no plano xz (olhando ao longo do feixe)
  d.circle(x, y, 0.8, { stroke: th.muted, width: 1 });
  const ux = Math.sin(theta);
  const uz = Math.cos(theta);
  d.arrow(x - ux * 0.75, y - uz * 0.75, ux * 1.5, uz * 1.5, { color: th.positive, width: 2, head: 7 });
  d.text("N", x + ux * 1.05, y + uz * 1.05, { size: 9, weight: "700", color: th.positive });
}

function drawMode1(d: Draw, s: SGState, p: Params, t: number) {
  const th = d.theme;
  const { n, th: thetas, keep, xs } = devices(p);
  d.rect(-16.4, -1.1, 2.2, 2.2, { fill: th.series[1]! + "55", stroke: th.series[1]!, width: 1.5 });
  d.text("forno", -15.3, 1.6, { size: 11, color: th.muted });
  d.text("Ag", -15.3, 0, { size: 12, weight: "700" });
  for (let i = 0; i < n; i++) {
    const x = xs[i]!;
    d.line(i === 0 ? X_OVEN : xs[i - 1]! + 1.7, i === 0 ? 0 : 0.9 * keep[i - 1]!, x - 1.7, 0, { color: th.muted, width: 1, dash: [4, 3] });
    deviceIcon(d, x, 0, thetas[i]!, angName((thetas[i]! * 180) / Math.PI));
    d.text("+", x + 2, 1.2, { size: 12, weight: "700", color: th.text });
    d.text("−", x + 2, -1.2, { size: 12, weight: "700", color: th.text });
    if (i < n - 1) {
      const blockedPort = -keep[i]!;
      const by = 1.6 * blockedPort;
      d.rect(x + 2.4, by - 0.35, 0.35, 0.7, { fill: th.text });
      d.text(`${s.blocked[i]}`, x + 2.6, by + 0.75 * blockedPort, { size: 10, color: th.muted });
    } else {
      for (const o of [1, -1]) {
        const y = 2.2 * o;
        d.rect(x + 4.2, y - 0.5, 0.4, 1, { fill: o > 0 ? th.positive : th.negative });
        d.text(`${s.final[o > 0 ? 0 : 1]}`, x + 4.9, y, { size: 12, weight: "700", align: "left", color: o > 0 ? th.positive : th.negative });
      }
    }
  }
  for (const a of s.atoms) {
    const pts = seriesPath(p, a);
    const q = pathPoint(pts, (t - a.tb) * SPEED1);
    if (q) d.dot(q[0], q[1], 3.2, th.accent);
  }
  // estado entre aparelhos
  let phi: number | null = null;
  for (let i = 0; i < n; i++) {
    const x = xs[i]!;
    const txt = phi === null ? "não polarizado" : `spin ao longo de ${angName((phi * 180) / Math.PI)}`;
    d.text(txt, x, -2.4, { size: 10, color: th.muted });
    const pp = probPlus(thetas[i]!, phi);
    d.text(`P(+) = ${fmt(100 * pp)} %`, x, -3.0, { size: 11, color: th.text, weight: "600" });
    if (i < n - 1) phi = keep[i]! > 0 ? thetas[i]! : thetas[i]! + Math.PI;
  }

  // barras: frequências medidas × previstas
  const m = measured(s, p);
  const o = seriesOutcome(thetas, keep);
  const box = { x0: -10, y0: -8.6, x1: 6, y1: -4.6 };
  const labels: string[] = [];
  const meas: number[] = [];
  const exp: number[] = [];
  const total = Math.max(1, s.emitted - s.atoms.length);
  for (let i = 0; i < n - 1; i++) {
    labels.push(`bloqueados em ${i + 1}`);
    meas.push(s.blocked[i]! / total);
    exp.push(o.blocked[i]!);
  }
  labels.push(`${n}: porta +`, `${n}: porta −`);
  meas.push(s.final[0] / total, s.final[1] / total);
  exp.push(o.plus, o.minus);
  const pnl = panel(d, box, { min: 0, max: labels.length }, { min: 0, max: 1 });
  pnl.frame({ xticks: [], yticks: [0, 0.25, 0.5, 0.75, 1], fy: (v) => `${Math.round(v * 100)}%` });
  labels.forEach((lb, i) => {
    const xc = i + 0.5;
    d.rect(pnl.X(xc - 0.3), pnl.Y(0), pnl.X(xc + 0.3) - pnl.X(xc - 0.3), pnl.Y(meas[i]!) - pnl.Y(0), { fill: th.accent, alpha: 0.8 });
    d.line(pnl.X(xc - 0.4), pnl.Y(exp[i]!), pnl.X(xc + 0.4), pnl.Y(exp[i]!), { color: th.series[1]!, width: 2.5 });
    const N = total;
    const err = Math.sqrt((exp[i]! * (1 - exp[i]!)) / N);
    d.line(pnl.X(xc), pnl.Y(Math.max(0, exp[i]! - err)), pnl.X(xc), pnl.Y(Math.min(1, exp[i]! + err)), { color: th.series[1]!, width: 1.2 });
    d.text(lb, pnl.X(xc), box.y0, { size: 10, color: th.text, dy: 10 });
  });
  d.text("frações de todos os átomos emitidos — barra: medida; traço laranja: teoria ± 1σ estatístico", (box.x0 + box.x1) / 2, box.y1 + 0.4, { size: 10, color: th.muted });

  d.text("Medidas sequenciais", -16.6, 8.7, { size: 14, weight: "700", align: "left" });
  d.text(`No último aparelho: ${m.N} átomos, P(+) medido = ${m.N ? fmt(100 * m.frac) : "—"} %, teoria = ${fmt(100 * m.expected)} %`, -16.6, 7.9, { size: 11, align: "left" });
  d.text("A seta N de cada ímã mostra o eixo de medida (θ a partir de z, no plano xz).", -16.6, 7.2, { size: 11, align: "left", color: th.muted });
  d.text(`P(+) = cos²(Δθ/2)`, 16.6, 8.7, { size: 13, weight: "700", align: "right", color: th.series[1]! });
}

const empty = (seed = 12345): SGState => ({
  seed,
  atoms: [],
  acc: 0,
  emitted: 0,
  hits: [],
  hist: new Array<number>(NB).fill(0),
  up: 0,
  down: 0,
  blocked: [0, 0, 0],
  final: [0, 0],
});

export const sternGerlach = defineSim<SGState>({
  id: "stern-gerlach",
  title: "Spin e Stern–Gerlach",
  course: "FG IV",
  topic: "Quântica",
  priority: "P3",
  summary:
    "Átomos de prata, um a um, atravessam um ímã de campo não uniforme: o feixe se divide em dois em vez do borrão clássico. Monte aparelhos em série com eixos z, x ou θ e compare as contagens com cos²(Δθ/2).",
  equations: [
    String.raw`F_z = \mu_z \frac{\partial B}{\partial z} \qquad \mu_z = \pm\mu_B \ \ (\text{spin } \tfrac12)`,
    String.raw`\Delta z = \frac{\mu_B}{m}\frac{\partial B}{\partial z}\,\frac{L_1^2/2 + L_1 L_d}{v^2}`,
    String.raw`\text{clássico: } \mu_z = \mu_B\cos\alpha,\ \cos\alpha \text{ uniforme em } [-1, 1]`,
    String.raw`P(+_{\hat n_2} \mid +_{\hat n_1}) = \cos^2\frac{\theta_2 - \theta_1}{2}`,
  ],
  liveEquations(s, p) {
    if (mode(p) === 0) {
      const g = geom(p);
      return [
        String.raw`\Delta z = \frac{(9{,}27\times10^{-24})(${texNum(g.grad)})}{1{,}79\times10^{-25}}\cdot\frac{${texNum(g.L1 * g.L1 / 2 + g.L1 * g.Ld)}}{(${texNum(g.v)})^2} = ${texNum(d0mm(p))}\ \text{mm}`,
      ];
    }
    const { th, keep } = devices(p);
    const m = measured(s, p);
    const prev = th.length > 1 ? (keep[th.length - 2]! > 0 ? th[th.length - 2]! : th[th.length - 2]! + Math.PI) : null;
    const dth = prev === null ? null : (((th[th.length - 1]! - prev) * 180) / Math.PI + 720) % 360;
    return [
      dth === null
        ? String.raw`P(+) = \tfrac12 \ \ (\text{átomos não polarizados})`
        : String.raw`P(+) = \cos^2\frac{${texNum(dth)}^\circ}{2} = ${texNum(m.expected)} \qquad \text{medido: } ${texNum(m.frac)}\ (N = ${m.N})`,
    ];
  },
  params: [
    {
      key: "modo",
      label: "Montagem",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 0,
      options: [
        { value: 0, label: "Um ímã: feixe e anteparo" },
        { value: 1, label: "Aparelhos em série (medidas sequenciais)" },
      ],
    },
    {
      key: "modelo",
      label: "Modelo do átomo",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 0,
      options: [
        { value: 0, label: "Quântico (spin ½)" },
        { value: 1, label: "Clássico (ímã com orientação aleatória)" },
      ],
    },
    { key: "grad", label: "Gradiente ∂B/∂z", unit: "T/m", min: 100, max: 2000, step: 50, default: 1000 },
    { key: "v", label: "Velocidade média dos átomos", unit: "m/s", min: 300, max: 900, step: 10, default: 550 },
    { key: "L1", label: "Comprimento do ímã L₁", unit: "cm", min: 1, max: 5, step: 0.5, default: 3.5 },
    { key: "Ld", label: "Ímã → anteparo L_d", unit: "cm", min: 5, max: 20, step: 1, default: 10 },
    { key: "nAp", label: "Número de aparelhos", unit: "", min: 1, max: 3, step: 1, default: 2 },
    { key: "th1", label: "θ₁ (aparelho 1; 0 = z, 90 = x)", unit: "°", min: 0, max: 360, step: 5, default: 0 },
    { key: "th2", label: "θ₂ (aparelho 2)", unit: "°", min: 0, max: 360, step: 5, default: 90 },
    { key: "th3", label: "θ₃ (aparelho 3)", unit: "°", min: 0, max: 360, step: 5, default: 0 },
    {
      key: "porta1",
      label: "Saída do aparelho 1 que segue",
      unit: "",
      min: -1,
      max: 1,
      step: 2,
      default: 1,
      options: [
        { value: 1, label: "+" },
        { value: -1, label: "−" },
      ],
    },
    {
      key: "porta2",
      label: "Saída do aparelho 2 que segue",
      unit: "",
      min: -1,
      max: 1,
      step: 2,
      default: 1,
      options: [
        { value: 1, label: "+" },
        { value: -1, label: "−" },
      ],
    },
    { key: "taxa", label: "Átomos por segundo", unit: "1/s", min: 1, max: 100, step: 1, default: 12, log: true, live: true },
  ],
  observables: [
    { key: "d", label: "Desvio previsto ±Δz", unit: "mm", value: (_s, p) => d0mm(p) },
    { key: "N", label: "Átomos detectados", unit: "", value: (s, p) => measured(s, p).N },
    { key: "frac", label: "Fração medida em + (em cima)", unit: "", value: (s, p) => measured(s, p).frac },
    { key: "esp", label: "Probabilidade prevista", unit: "", value: (s, p) => measured(s, p).expected },
    { key: "emit", label: "Átomos emitidos", unit: "", value: (s) => s.emitted },
  ],
  chart: { x: "N", y: "frac" },
  scenarios: [
    {
      id: "feixe",
      label: "Dois feixes × borrão clássico",
      params: { modo: 0, modelo: 0, taxa: 25 },
      guide: `### O experimento de 1922
1. Rode: os átomos chegam um a um e cada um deixa **um** ponto no anteparo, em cima ou embaixo.
2. Use **Enviar 500 átomos** para juntar estatística: aparecem duas faixas (com forma de "lábios", porque o gradiente é mais forte no meio da fenda), e nada no centro.
3. Troque o **Modelo** para clássico: um ímã com orientação aleatória teria $\\mu_z = \\mu_B\\cos\\alpha$ contínuo e o anteparo ficaria preenchido entre as duas linhas.
4. Mude $\\partial B/\\partial z$ e $v$: confira $\\Delta z \\propto (\\partial B/\\partial z)/v^2$. A largura das faixas vem da dispersão de velocidades do forno.

Obs.: para o elétron $\\vec\\mu$ aponta contra o spin; a porta "+" aqui é a de $\\mu_z = +\\mu_B$.`,
      predict: [
        {
          question: "O que se observa no anteparo depois de muitos átomos de prata?",
          options: ["Uma faixa contínua (borrão)", "Duas manchas separadas", "Três manchas", "Uma única mancha no centro"],
          answer: 1,
          explanation:
            "A componente $\\mu_z$ é quantizada: o elétron externo da prata tem spin ½ e $\\mu_z = \\pm\\mu_B$. Só há duas forças possíveis e, portanto, dois feixes. O borrão seria o resultado clássico.",
        },
      ],
    },
    {
      id: "zxz",
      label: "z, depois x, depois z",
      params: { modo: 1, nAp: 3, th1: 0, th2: 90, th3: 0, porta1: 1, porta2: 1, taxa: 20 },
      guide: `### A medida em x "apaga" a informação em z
1. O primeiro aparelho (z) deixa passar só $+z$. O segundo mede em $x$: metade sai em $+x$.
2. Os que saem em $+x$ entram de novo num aparelho z. Antes de rodar, responda a previsão.
3. Use **Enviar 1000 átomos** e compare as barras com os traços da teoria.
4. Agora troque o aparelho 2 por z ($\\theta_2 = 0$): todos saem em $+z$ no fim.`,
      predict: [
        {
          question: "Átomos selecionados em +z e depois em +x entram num terceiro aparelho z. Que fração sai em +z?",
          options: ["100%, porque já foram selecionados em +z", "0%", "50%", "25%"],
          answer: 2,
          explanation:
            "Depois da medida em $x$ o estado é $|+x\\rangle = (|+z\\rangle + |-z\\rangle)/\\sqrt2$: a informação anterior sobre $z$ foi perdida e $P(+z) = \\cos^2(90^\\circ/2) = 1/2$.",
        },
      ],
    },
    {
      id: "angulo",
      label: "Aparelho inclinado: cos²(θ/2)",
      params: { modo: 1, nAp: 2, th1: 0, th2: 60, porta1: 1, taxa: 20 },
      guide: `### Probabilidade em função do ângulo
1. Átomos em $+z$ entram num aparelho inclinado de $\\theta_2$.
2. Para $\\theta_2 = 60^\\circ$ a teoria prevê $P(+) = \\cos^2 30^\\circ = 75\\%$.
3. Envie átomos e veja a fração medida convergir; a flutuação cai como $1/\\sqrt N$.
4. Varie $\\theta_2$ de 0 a 180°: o resultado vai de 100% a 0%. Em 180° o aparelho é um SG-z invertido.`,
      predict: [
        {
          question: "Com θ₂ = 60°, que fração dos átomos que saem em +z do primeiro aparelho sai em + do segundo?",
          options: ["50%", "75%", "87%", "33%"],
          answer: 1,
          explanation: "$P = \\cos^2(\\theta/2) = \\cos^2 30^\\circ = 3/4$. Note que o ângulo entra pela metade: estados de spin opostos (180°) são ortogonais.",
        },
      ],
    },
  ],
  exercises: [
    {
      id: "desvio",
      prompt:
        "Átomos de prata (m = 1,79 × 10⁻²⁵ kg, μ_z = μ_B = 9,27 × 10⁻²⁴ J/T) com v = {v} m/s atravessam um ímã de {L1} cm com ∂B/∂z = {grad} T/m e voam mais {Ld} cm até o anteparo. Qual o desvio de cada feixe no anteparo, em mm?",
      vary: { v: [400, 800, 0], grad: [500, 1500, 0] },
      fixed: { modo: 0, L1: 3.5, Ld: 10 },
      answer: { label: "Δz", unit: "mm", compute: (p) => d0mm(p) },
      hint: "a = μ_B(∂B/∂z)/m; dentro do ímã z = at²/2 e depois o átomo segue em linha reta com a velocidade transversal aL₁/v.",
    },
    {
      id: "sequencial",
      prompt: "Átomos que saíram pela porta + de um aparelho SG-z entram num segundo aparelho inclinado de θ = {th2}° em relação a z. Que fração deles sai pela porta + do segundo aparelho?",
      vary: { th2: [10, 150, 0] },
      fixed: { modo: 1, nAp: 2, th1: 0, porta1: 1 },
      answer: { label: "P(+)", unit: "", compute: (p) => Math.cos(rad(num(p, "th2")) / 2) ** 2 },
      tolerance: 0.03,
      hint: "P = cos²(θ/2): o ângulo entra pela metade.",
    },
  ],
  init: () => empty(),
  step(s, p, t, dt) {
    const ns: SGState = { ...s, atoms: s.atoms.slice(), hits: s.hits.slice(), hist: s.hist.slice(), blocked: s.blocked.slice(), final: [s.final[0], s.final[1]] };
    ns.acc += num(p, "taxa", 12) * dt;
    while (ns.acc >= 1) {
      ns.acc -= 1;
      ns.atoms.push(emitAtom(ns, p, t));
      ns.emitted++;
    }
    const g = geom(p);
    const keepA: Atom[] = [];
    for (const a of ns.atoms) {
      if (mode(p) === 0) {
        if (((t + dt - a.tb) * a.v) / (g.v * T_FLY) >= 1) recordHit(ns, p, a);
        else keepA.push(a);
      } else if ((t + dt - a.tb) * SPEED1 >= pathLength(seriesPath(p, a))) recordSeries(ns, p, a);
      else keepA.push(a);
    }
    ns.atoms = keepA;
    return ns;
  },
  dt: 1 / 60,
  sampleEvery: 30,
  maxSamples: 400,
  actions: [
    { id: "um", label: "Disparar 1 átomo", run: (s) => ({ ...s, acc: s.acc + 1 }) },
    { id: "500", label: "Enviar 500 átomos (rápido)", run: (s, p) => fastForward(s, p, 500) },
    { id: "1000", label: "Enviar 1000 átomos (rápido)", run: (s, p) => fastForward(s, p, 1000) },
    { id: "zerar", label: "Zerar contagens", run: (s) => empty(s.seed) },
  ],
  viewport: () => ({ ...VIEW, unit: "" }),
  render(ctx, frame) {
    const d = draw(ctx, frame);
    if (mode(frame.params) === 0) drawMode0(d, frame.state, frame.params, frame.t);
    else drawMode1(d, frame.state, frame.params, frame.t);
  },
});

export default sternGerlach;
