import { clamp, defineSim, draw, num, texNum, type Draw, type Params } from "@fisilab/core";
import { fmt, panel } from "./panel.ts";
import {
  KB,
  RB,
  axialEquilibrium,
  dopplerLimit,
  dragCoef,
  equilibriumT,
  force,
  friction,
  gaussianFrom,
  intensity,
  langevin,
  maxLateralForce,
  motSpring,
  nextRandom,
  rayleighRange,
  stiffnessX,
  tweezerForce,
  zeemanZeta,
  type Tweezer,
} from "./physics.ts";

export * from "./physics.ts";

export interface LState {
  seed: number;
  /** Modo 0: [x, v] por átomo; modo 1: [x, z, vx, vz] por átomo (SI). */
  atoms: number[];
  /** Série [t (ms), T (μK)] ou [t, átomos presos]. */
  ser: number[];
  lost: number;
  /** Pinça: esfera e foco [x, z] (m), estatística [n, Σx, Σx², Σz, Σz²], histograma de x − x_foco e traço [t, x]. */
  bead: [number, number];
  focus: [number, number];
  stats: number[];
  hist: number[];
  trace: number[];
  drag: null | "laser" | "bead";
}

const VIEW = { xMin: -17, xMax: 17, yMin: -9.5, yMax: 9.5 };
const N0 = 400;
const N1 = 300;
const L0 = 5e-3;
const L1 = 8e-3;
const T_ROOM = 295;
const NH = 41;

const mode = (p: Params) => Math.round(num(p, "modo"));
const sat = (p: Params) => num(p, "s", 0.5);
const Delta = (p: Params) => num(p, "det", -0.5) * RB.Gamma;
const zetas = (p: Params): [number, number] => {
  const g = num(p, "grad", 10) * 0.01 * (num(p, "polar") >= 0.5 ? -1 : 1);
  return [zeemanZeta(g / 2), zeemanZeta(g)];
};
export const tweezer = (p: Params): Tweezer => ({
  P: num(p, "P", 20) * 1e-3,
  w0: num(p, "w0", 0.7) * 1e-6,
  lambda: 1064e-9,
  a: num(p, "a", 0.2) * 1e-6,
  np: num(p, "np", 1.57),
  nm: 1.33,
  eta: 1.0e-3,
  T: T_ROOM,
});

/** Temperatura do conjunto (μK) a partir da variância das velocidades (por eixo). */
export function ensembleT(s: LState, p: Params): number {
  const m = mode(p);
  const stride = m === 0 ? 2 : 4;
  const offs = m === 0 ? [1] : [2, 3];
  let sum = 0;
  let sum2 = 0;
  let n = 0;
  for (let i = 0; i < s.atoms.length; i += stride) {
    if (m === 1 && Math.hypot(s.atoms[i]!, s.atoms[i + 1]!) > 0.5e-3) continue;
    for (const o of offs) {
      const v = s.atoms[i + o]!;
      sum += v;
      sum2 += v * v;
      n++;
    }
  }
  if (n < 2) return 0;
  const varv = sum2 / n - (sum / n) ** 2;
  return (RB.m * varv) / KB * 1e6;
}

export function trapped(s: LState): number {
  let n = 0;
  for (let i = 0; i < s.atoms.length; i += 4) if (Math.hypot(s.atoms[i]!, s.atoms[i + 1]!) < 0.5e-3) n++;
  return n;
}

function cloudSigma(s: LState): number {
  let n = 0;
  let s2 = 0;
  for (let i = 0; i < s.atoms.length; i += 4) {
    if (Math.hypot(s.atoms[i]!, s.atoms[i + 1]!) > 0.5e-3) continue;
    s2 += s.atoms[i + 1]! ** 2;
    n++;
  }
  return n > 1 ? Math.sqrt(s2 / n) : 0;
}

const beadStats = (s: LState) => {
  const [n, sx, sx2, sz, sz2] = s.stats as [number, number, number, number, number];
  if (n < 2) return { n, mx: 0, vx: NaN, mz: 0, vz: NaN };
  return { n, mx: sx / n, vx: sx2 / n - (sx / n) ** 2, mz: sz / n, vz: sz2 / n - (sz / n) ** 2 };
};
/** Rigidez medida por equipartição κ = k_B T / ⟨δx²⟩ (pN/μm). */
export const measuredStiffness = (s: LState) => {
  const b = beadStats(s);
  return b.n > 50 && b.vx > 0 ? ((KB * T_ROOM) / b.vx) * 1e6 : 0;
};

function spawnEdge(st: { seed: number }): [number, number, number, number] {
  const side = Math.floor(nextRandom(st) * 4);
  const u = (2 * nextRandom(st) - 1) * L1;
  const sp = 1 + 4 * Math.abs(gaussianFrom(st));
  const tang = 2 * gaussianFrom(st);
  if (side === 0) return [-L1, u, sp, tang];
  if (side === 1) return [L1, u, -sp, tang];
  if (side === 2) return [u, -L1, tang, sp];
  return [u, L1, tang, -sp];
}

const resetBead = (s: LState): LState => ({ ...s, stats: [0, 0, 0, 0, 0], hist: new Array<number>(NH).fill(0), trace: [] });

function init(p: Params, seed = 2024): LState {
  const st = { seed };
  const atoms: number[] = [];
  const m = mode(p);
  if (m === 0) {
    const sv = Math.sqrt((KB * num(p, "T0", 10) * 1e-3) / RB.m);
    for (let i = 0; i < N0; i++) atoms.push((2 * nextRandom(st) - 1) * L0, sv * gaussianFrom(st));
  } else if (m === 1) {
    for (let i = 0; i < N1; i++) atoms.push((2 * nextRandom(st) - 1) * 0.9 * L1, (2 * nextRandom(st) - 1) * 0.9 * L1, 2.5 * gaussianFrom(st), 2.5 * gaussianFrom(st));
  }
  return {
    seed: st.seed,
    atoms,
    ser: [],
    lost: 0,
    bead: [0.15e-6, 0],
    focus: [0, 0],
    stats: [0, 0, 0, 0, 0],
    hist: new Array<number>(NH).fill(0),
    trace: [],
    drag: null,
  };
}

// ---------- Desenho ----------

function beams1d(d: Draw, y: number, x0: number, x1: number, det: number) {
  const th = d.theme;
  const col = th.positive;
  d.rect(x0, y - 0.9, x1 - x0, 1.8, { fill: col, alpha: 0.12 });
  d.arrowPx(x0 + 0.2, y + 1.3, 1, 0, 60, { color: col, width: 2 });
  d.arrowPx(x1 - 0.2, y - 1.3, -1, 0, 60, { color: col, width: 2 });
  d.text(`laser Δ = ${fmt(det)} Γ`, x0 + 3.6, y + 1.3, { size: 10, color: col, align: "left" });
  d.text(`Δ = ${fmt(det)} Γ`, x1 - 3.6, y - 1.3, { size: 10, color: col, align: "right" });
}

function drawMolasses(d: Draw, s: LState, p: Params, t: number) {
  const th = d.theme;
  const det = num(p, "det", -0.5);
  const S = sat(p);
  // tubo com átomos
  const X = (x: number) => (x / L0) * 14;
  beams1d(d, 6.7, -16.4, 16.4, det);
  const vmax = 3;
  for (let i = 0; i < s.atoms.length; i += 2) {
    const v = s.atoms[i + 1]!;
    const k = clamp(Math.abs(v) / vmax, 0, 1);
    d.dot(X(s.atoms[i]!), 6.7 + ((i * 0.6180339) % 1 - 0.5) * 1.4, 2.2, k > 0.5 ? th.series[1]! : th.accent, 0.5 + 0.5 * k);
  }
  d.text("Melaço óptico 1D (⁸⁷Rb, 780 nm): dois feixes vermelhos (Δ < 0) contrapropagantes", -16.4, 8.9, { size: 12, weight: "700", align: "left" });

  // força × velocidade
  const vr = 6;
  const Fmax = (6.626e-34 / RB.lambda) * (RB.Gamma / 2);
  const fb = { x0: -15.5, y0: -8.2, x1: -1.5, y1: 3.4 };
  const pf = panel(d, fb, { min: -vr, max: vr }, { min: -0.6, max: 0.6 });
  pf.frame({ xlabel: "v (m/s)", ylabel: "F / (ħkΓ/2)" });
  const one = (v: number, sign: number) => (sign * 6.626e-34 / RB.lambda * ((RB.Gamma / 2) * S) / (1 + S + 4 * ((Delta(p) - sign * RB.k * v) / RB.Gamma) ** 2)) / Fmax;
  pf.plot((v) => one(v, 1), -vr, vr, { color: th.positive, width: 1, dash: [4, 3] });
  pf.plot((v) => one(v, -1), -vr, vr, { color: th.negative, width: 1, dash: [4, 3] });
  pf.plot((v) => force(v, S, Delta(p)) / Fmax, -vr, vr, { color: th.text, width: 2 });
  pf.clip(() => {
    for (let i = 0; i < s.atoms.length; i += 4) {
      const v = s.atoms[i + 1]!;
      d.dot(pf.X(v), pf.Y(force(v, S, Delta(p)) / Fmax), 2.2, th.accent, 0.6);
    }
  });
  d.text("tracejado: cada feixe; preto: soma (atrito F ≈ −βv perto de v = 0)", fb.x0, fb.y0 - 1.15, { size: 10, align: "left", color: th.muted });

  // histograma de velocidades
  const T = ensembleT(s, p);
  const hb = { x0: 1.5, y0: -0.3, x1: 16.4, y1: 4.2 };
  const sv = Math.sqrt((KB * Math.max(T, 1) * 1e-6) / RB.m);
  const vR = Math.max(0.3, 4 * sv);
  const nb = 30;
  const h = new Array<number>(nb).fill(0);
  for (let i = 1; i < s.atoms.length; i += 2) {
    const b = Math.floor(((s.atoms[i]! + vR) / (2 * vR)) * nb);
    if (b >= 0 && b < nb) h[b]!++;
  }
  const N = s.atoms.length / 2;
  const dv = (2 * vR) / nb;
  const gmax = (N * dv) / (Math.sqrt(2 * Math.PI) * sv);
  const ph = panel(d, hb, { min: -vR, max: vR }, { min: 0, max: Math.max(gmax, ...h) * 1.1 });
  ph.frame({ xlabel: "v (m/s)", ylabel: "átomos" });
  h.forEach((c, i) => c && d.rect(ph.X(-vR + i * dv), ph.Y(0), ph.X(dv) - ph.X(0), ph.Y(c) - ph.Y(0), { fill: th.accent, alpha: 0.55 }));
  ph.plot((v) => gmax * Math.exp((-v * v) / (2 * sv * sv)), -vR, vR, { color: th.series[1]!, width: 1.5 });
  d.text("laranja: Maxwell–Boltzmann na temperatura medida", hb.x1, hb.y1 + 0.45, { size: 10, align: "right", color: th.muted });

  // T(t)
  const tb = { x0: 1.5, y0: -8.2, x1: 16.4, y1: -2.6 };
  const Teq = equilibriumT(S, Delta(p)) * 1e6;
  const TD = dopplerLimit() * 1e6;
  const tmax = Math.max(2, t);
  const pt = panel(d, tb, { min: 0, max: tmax }, { min: 50, max: 2e4, log: true });
  pt.frame({ xlabel: "t (ms)", ylabel: "T (μK)" });
  pt.line([[0, TD], [tmax, TD]], { color: th.positive, width: 1.2, dash: [5, 4] });
  if (Number.isFinite(Teq)) pt.line([[0, Teq], [tmax, Teq]], { color: th.series[2]!, width: 1.2, dash: [2, 3] });
  const ser: [number, number][] = [];
  for (let i = 0; i + 1 < s.ser.length; i += 2) ser.push([s.ser[i]!, Math.max(s.ser[i + 1]!, 1)]);
  pt.line(ser, { color: th.accent, width: 2 });
  d.text(`T = ${fmt(T)} μK   equilíbrio previsto ${Number.isFinite(Teq) ? fmt(Teq) : "∞ (aquece)"} μK   limite Doppler ħΓ/2k_B = ${fmt(TD)} μK`, tb.x0, tb.y1 + 1.1, { size: 10, align: "left" });
}

function drawMOT(d: Draw, s: LState, p: Params, t: number) {
  const th = d.theme;
  const inv = num(p, "polar") >= 0.5;
  const box = { x0: -16.4, y0: -8.6, x1: -2.4, y1: 5.4 };
  const cx = (box.x0 + box.x1) / 2;
  const cy = (box.y0 + box.y1) / 2;
  const S = (box.x1 - box.x0) / (2 * L1);
  d.rect(box.x0, box.y0, box.x1 - box.x0, box.y1 - box.y0, { fill: th.positive, alpha: 0.05, stroke: th.muted, width: 1 });
  // feixes e polarizações
  const lab = (x: number, y: number, dx: number, dy: number, pol: string) => {
    d.arrowPx(x, y, dx, dy, 34, { color: th.positive, width: 2.5 });
    d.text(pol, x + dx * 1.6, y + dy * 1.6 + (dx !== 0 ? 0.6 : 0), { size: 10, color: th.positive, dx: dy !== 0 ? 14 : 0 });
  };
  lab(box.x0 + 0.2, cy, 1, 0, inv ? "σ−" : "σ+");
  lab(box.x1 - 0.2, cy, -1, 0, inv ? "σ+" : "σ−");
  lab(cx, box.y0 + 0.2, 0, 1, inv ? "σ+" : "σ−");
  lab(cx, box.y1 - 0.2, 0, -1, inv ? "σ−" : "σ+");
  // bobinas anti-Helmholtz (vistas de lado)
  for (const sgn of [1, -1]) {
    d.rect(cx - 4.5, cy + sgn * 7.4 - 0.25, 9, 0.5, { fill: th.series[5]!, alpha: 0.8 });
    d.text(sgn > 0 ? "⊙ corrente" : "⊗ corrente", cx + 4.8, cy + sgn * 7.4, { size: 9, align: "left", color: th.muted });
  }
  // campo B = B'(−x/2, z)
  const g = num(p, "grad", 10);
  if (g > 0)
    for (let i = -3; i <= 3; i++)
      for (let j = -3; j <= 3; j++) {
        if (i === 0 && j === 0) continue;
        const x = (i / 3.5) * L1;
        const z = (j / 3.5) * L1;
        const bx = -x / 2;
        const bz = z;
        const m = Math.hypot(bx, bz);
        d.arrowPx(cx + x * S, cy + z * S, bx / m, bz / m, 6 + 10 * (m / L1), { color: th.muted, width: 1, head: 5 });
      }
  for (let i = 0; i < s.atoms.length; i += 4) {
    const x = s.atoms[i]!;
    const z = s.atoms[i + 1]!;
    if (Math.abs(x) > L1 || Math.abs(z) > L1) continue;
    d.dot(cx + x * S, cy + z * S, 2.2, th.accent, 0.8);
  }
  d.text(`Armadilha magneto-óptica (corte xz): B' = ${fmt(g)} G/cm no eixo z`, -16.4, 8.9, { size: 12, weight: "700", align: "left" });
  d.text(inv ? "polarizações INVERTIDAS: a força empurra para fora" : "feixes vermelhos + gradiente de B: força restauradora e atrito", -16.4, 8.1, { size: 11, align: "left", color: inv ? th.negative : th.text });
  d.text("setas cinza: campo magnético do quadrupolo", -16.4, 7.3, { size: 10, align: "left", color: th.muted });

  // zoom no centro
  const zb = { x0: 1.2, y0: 1.6, x1: 6.6, y1: 7.0 };
  const R = 0.4e-3;
  const Sz = (zb.x1 - zb.x0) / (2 * R);
  const zx = (zb.x0 + zb.x1) / 2;
  const zy = (zb.y0 + zb.y1) / 2;
  d.rect(zb.x0, zb.y0, zb.x1 - zb.x0, zb.y1 - zb.y0, { stroke: th.muted, width: 1, fill: th.dark ? "#0d1117" : "#fbfbfd" });
  for (let i = 0; i < s.atoms.length; i += 4) {
    const x = s.atoms[i]!;
    const z = s.atoms[i + 1]!;
    if (Math.abs(x) < R && Math.abs(z) < R) d.dot(zx + x * Sz, zy + z * Sz, 2.2, th.accent, 0.8);
  }
  const [zxeta, zzeta] = zetas(p);
  const Teq = equilibriumT(sat(p), Delta(p));
  const kx = motSpring(sat(p), Delta(p), zxeta);
  const kz = motSpring(sat(p), Delta(p), zzeta);
  if (kx > 0 && Number.isFinite(Teq)) {
    const sx = Math.sqrt((KB * Teq) / kx);
    const sz = Math.sqrt((KB * Teq) / kz);
    const pts: [number, number][] = [];
    for (let i = 0; i <= 48; i++) {
      const a = (2 * Math.PI * i) / 48;
      pts.push([zx + 2 * sx * Math.cos(a) * Sz, zy + 2 * sz * Math.sin(a) * Sz]);
    }
    d.polyline(pts, { color: th.series[1]!, width: 1.2, dash: [3, 3] });
  }
  d.text("centro ampliado (±0,4 mm)", (zb.x0 + zb.x1) / 2, zb.y1 + 0.4, { size: 10, color: th.text });
  d.text("elipse: 2σ previsto (σz < σx: gradiente em z é o dobro)", zb.x1 + 0.3, zb.y1 - 0.4, { size: 10, align: "left", color: th.muted });
  d.text(`presos (r < 0,5 mm): ${trapped(s)}`, zb.x1 + 0.3, zb.y1 - 1.4, { size: 12, weight: "700", align: "left" });
  d.text(`T dos presos: ${fmt(ensembleT(s, p))} μK`, zb.x1 + 0.3, zb.y1 - 2.3, { size: 11, align: "left" });
  d.text(`σz medido: ${fmt(cloudSigma(s) * 1e6)} μm`, zb.x1 + 0.3, zb.y1 - 3.1, { size: 11, align: "left" });
  d.text(`κz = ${fmt(kz)} N/m   ω/2π = ${fmt(Math.sqrt(Math.max(kz, 0) / RB.m) / (2 * Math.PI))} Hz`, zb.x1 + 0.3, zb.y1 - 3.9, { size: 10, align: "left", color: th.muted });

  // força restauradora F_z(z) e átomos presos × t
  const fb = { x0: 1.2, y0: -8.4, x1: 8.4, y1: -1.6 };
  const Fmax = (6.626e-34 / RB.lambda) * (RB.Gamma / 2);
  const pf = panel(d, fb, { min: -8, max: 8 }, { min: -0.7, max: 0.7 });
  pf.frame({ xlabel: "z (mm)", ylabel: "Fz / (ħkΓ/2), v = 0" });
  pf.plot((zmm) => force(0, sat(p), Delta(p), zzeta * zmm * 1e-3) / Fmax, -8, 8, { color: inv ? th.negative : th.series[2]!, width: 2, n: 300 });
  const nb = { x0: 10.2, y0: -8.4, x1: 16.4, y1: -1.6 };
  const tmax = Math.max(5, t);
  const pn = panel(d, nb, { min: 0, max: tmax }, { min: 0, max: N1 });
  pn.frame({ xlabel: "t (ms)", ylabel: "átomos presos" });
  const ser: [number, number][] = [];
  for (let i = 0; i + 1 < s.ser.length; i += 2) ser.push([s.ser[i]!, s.ser[i + 1]!]);
  pn.line(ser, { color: th.accent, width: 2 });
}

function drawTweezer(d: Draw, s: LState, p: Params, t: number) {
  const th = d.theme;
  const tw = tweezer(p);
  const box = { x0: -16.4, y0: -8.6, x1: -2.4, y1: 7.6 };
  const cx = (box.x0 + box.x1) / 2;
  const cy = (box.y0 + box.y1) / 2;
  const S = (box.x1 - box.x0) / 2.4e-6; // ±1,2 μm
  const X = (x: number) => cx + x * S;
  const Z = (z: number) => cy + z * S;
  d.rect(box.x0, box.y0, box.x1 - box.x0, box.y1 - box.y0, { fill: th.accent, alpha: 0.06, stroke: th.muted, width: 1 });
  // feixe (entra por baixo, +z para cima)
  const zr = rayleighRange(tw);
  const zmax = (box.y1 - cy) / S;
  const I0 = intensity(tw, 0, 0);
  for (let i = 0; i < 60; i++) {
    const z0 = -zmax + (2 * zmax * i) / 60;
    const z1 = z0 + (2 * zmax) / 60;
    const w = tw.w0 * Math.sqrt(1 + ((z0 + z1) / 2 / zr) ** 2);
    const a = clamp(intensity(tw, 0, (z0 + z1) / 2) / I0, 0, 1);
    d.rect(X(s.focus[0] - w), Z(s.focus[1] + z0), 2 * w * S, (z1 - z0) * S, { fill: th.positive, alpha: 0.08 + 0.35 * a });
  }
  const env = (sg: number) => {
    const pts: [number, number][] = [];
    for (let i = 0; i <= 60; i++) {
      const z = -zmax + (2 * zmax * i) / 60;
      pts.push([X(s.focus[0] + sg * tw.w0 * Math.sqrt(1 + (z / zr) ** 2)), Z(s.focus[1] + z)]);
    }
    d.polyline(pts, { color: th.positive, width: 1, alpha: 0.7 });
  };
  env(1);
  env(-1);
  d.text("laser 1064 nm ↑", X(s.focus[0]), box.y0 + 0.4, { size: 10, color: th.positive });
  d.line(X(s.focus[0]) - 0.4, Z(s.focus[1]), X(s.focus[0]) + 0.4, Z(s.focus[1]), { color: th.positive, width: 2 });
  d.line(X(s.focus[0]), Z(s.focus[1]) - 0.4, X(s.focus[0]), Z(s.focus[1]) + 0.4, { color: th.positive, width: 2 });
  // fluxo
  const u = num(p, "u", 0);
  if (u !== 0)
    for (let j = -2; j <= 2; j++) d.arrowPx(box.x0 + 1 + (((t * u) / 400) % 1 + 1) % 1 * 2, cy + j * 3.2, Math.sign(u), 0, 14 + Math.min(30, Math.abs(u) / 10), { color: th.muted, width: 1.2 });
  // esfera e força
  const bx = X(s.bead[0]);
  const bz = Z(s.bead[1]);
  d.circle(bx, bz, tw.a * S, { fill: tw.np > tw.nm ? th.accent : th.series[4]!, alpha: 0.85, stroke: th.text, width: 1 });
  const F = tweezerForce(tw, s.bead[0] - s.focus[0], s.bead[1] - s.focus[1]);
  const Fm = Math.hypot(F[0], F[1]);
  if (Fm > 0) d.arrowPx(bx, bz, F[0], F[1], clamp(10 + 60 * (Fm / maxLateralForce(tw)), 10, 80), { color: th.series[2]!, width: 2 });
  // barra de escala
  d.line(box.x1 - 0.4 - 0.5e-6 * S, box.y0 + 0.5, box.x1 - 0.4, box.y0 + 0.5, { width: 2.5 });
  d.text("0,5 μm", box.x1 - 0.4 - 0.25e-6 * S, box.y0 + 1.0, { size: 10 });
  d.text("Pinça óptica: arraste o foco do laser (cruz) ou a esfera", -16.4, 8.9, { size: 12, weight: "700", align: "left" });
  d.text(tw.np > tw.nm ? "esfera de índice maior que a água: atraída para o foco" : "índice menor que a água: o gradiente a empurra para fora", -16.4, 8.15, { size: 10, align: "left", color: th.muted });

  // dados
  const kx = stiffnessX(tw) * 1e6;
  const km = measuredStiffness(s);
  const b = beadStats(s);
  const x0 = 0.6;
  const rows = [
    `κx teórico = ${fmt(kx)} pN/μm`,
    `κx medido (k_BT/⟨δx²⟩) = ${km ? fmt(km) : "—"} pN/μm  (N = ${b.n})`,
    `F lateral máxima = ${fmt(maxLateralForce(tw) * 1e12)} pN  →  fluxo de escape ≈ ${fmt((maxLateralForce(tw) / dragCoef(tw)) * 1e6)} μm/s`,
    `força agora: Fx = ${fmt(F[0] * 1e12)} pN, Fz = ${fmt(F[1] * 1e12)} pN`,
    Number.isFinite(axialEquilibrium(tw)) ? `eixo z: equilíbrio ${fmt(axialEquilibrium(tw) * 1e9)} nm acima do foco (pressão de radiação)` : "eixo z: a pressão de radiação vence o gradiente — a esfera é empurrada para cima",
  ];
  rows.forEach((r, i) => d.text(r, x0, 8.9 - i * 0.72, { size: 11, align: "left" }));

  // histograma
  const sig = Math.sqrt((KB * T_ROOM) / Math.max(stiffnessX(tw), 1e-12));
  const R = 4 * sig;
  const hb = { x0: 1.2, y0: -1.0, x1: 8.4, y1: 4.6 };
  const tot = s.hist.reduce((a, c) => a + c, 0);
  const dx = (2 * R) / NH;
  const gmax = tot > 0 ? (tot * dx) / (Math.sqrt(2 * Math.PI) * sig) : 1;
  const ph = panel(d, hb, { min: -R * 1e9, max: R * 1e9 }, { min: 0, max: Math.max(gmax, ...s.hist, 1) * 1.1 });
  ph.frame({ xlabel: "x − x_foco (nm)", ylabel: "contagem" });
  s.hist.forEach((c, i) => c && d.rect(ph.X((-R + i * dx) * 1e9), ph.Y(0), ph.X(dx * 1e9) - ph.X(0), ph.Y(c) - ph.Y(0), { fill: th.accent, alpha: 0.6 }));
  if (tot > 0) ph.plot((xn) => gmax * Math.exp(-((xn * 1e-9) ** 2) / (2 * sig * sig)), -R * 1e9, R * 1e9, { color: th.series[1]!, width: 1.5 });
  d.text("laranja: Boltzmann e^(−κx²/2k_BT)", hb.x0, hb.y0 - 1.35, { size: 10, align: "left", color: th.muted });

  // potencial U(x)
  const ub = { x0: 10.2, y0: -1.0, x1: 16.4, y1: 4.6 };
  const W = 1.6 * tw.w0;
  const kT = KB * T_ROOM;
  const Uof = (x: number) => (-(2 * Math.PI * tw.nm * tw.a ** 3 * cmFactorOf(tw)) / C_LIGHT) * intensity(tw, x, 0) / kT;
  const Umin = Math.min(Uof(0), -1);
  const pu = panel(d, ub, { min: -W * 1e6, max: W * 1e6 }, { min: Math.min(Umin * 1.1, -1), max: Math.max(1, -Umin * 0.15) });
  pu.frame({ xlabel: "x (μm)", ylabel: "U / k_BT (no plano focal)" });
  pu.plot((xu) => Uof(xu * 1e-6) - (num(p, "u", 0) * 1e-6 * dragCoef(tw) * xu * 1e-6) / kT, -W * 1e6, W * 1e6, { color: th.series[4]!, width: 2 });
  d.text("com fluxo: U − γu·x (poço inclinado)", ub.x0, ub.y0 - 1.35, { size: 10, align: "left", color: th.muted });

  // traço x(t)
  const tb = { x0: 1.2, y0: -8.4, x1: 16.4, y1: -3.2 };
  const tmax = Math.max(20, t);
  const tmin = tmax - 20;
  const pt = panel(d, tb, { min: tmin, max: tmax }, { min: -R * 1e9, max: R * 1e9 });
  pt.frame({ xlabel: "t (ms)", ylabel: "x − x_foco (nm)" });
  const ser: [number, number][] = [];
  for (let i = 0; i + 1 < s.trace.length; i += 2) if (s.trace[i]! >= tmin) ser.push([s.trace[i]!, s.trace[i + 1]!]);
  pt.line(ser, { color: th.accent, width: 1.2 });
  d.text(`tempo de relaxação γ/κ = ${fmt((dragCoef(tw) / Math.max(stiffnessX(tw), 1e-15)) * 1e3)} ms`, tb.x1, tb.y1 + 0.45, { size: 10, align: "right", color: th.muted });
}

const C_LIGHT = 299792458;
const cmFactorOf = (tw: Tweezer) => {
  const m2 = (tw.np / tw.nm) ** 2;
  return (m2 - 1) / (m2 + 2);
};

export const resfriamentoLaser = defineSim<LState>({
  id: "resfriamento-laser",
  title: "Resfriamento a laser, MOT e pinça óptica",
  course: "FG IV",
  topic: "Física moderna",
  priority: "P2",
  summary:
    "Átomos de rubídio freados pela pressão de radiação de feixes dessintonizados para o vermelho: o melaço óptico esfria até o limite Doppler, o gradiente de campo da armadilha magneto-óptica junta os átomos no centro, e uma pinça óptica prende uma esfera dielétrica cuja rigidez você mede pelo movimento browniano.",
  equations: [
    String.raw`F = \hbar k\,\frac{\Gamma}{2}\left[\frac{s}{1 + s + 4(\Delta - kv)^2/\Gamma^2} - \frac{s}{1 + s + 4(\Delta + kv)^2/\Gamma^2}\right]`,
    String.raw`k_B T = \frac{D}{\beta} \ \xrightarrow{\ \Delta = -\Gamma/2\ }\ T_D = \frac{\hbar\Gamma}{2k_B}`,
    String.raw`\text{MOT: } \Delta \to \Delta \mp kv \mp \frac{\mu_B B' x}{\hbar}\ \Rightarrow\ F \approx -\beta v - \kappa x`,
    String.raw`\vec F_{\text{grad}} = \frac{2\pi n_m a^3}{c}\,\frac{m^2 - 1}{m^2 + 2}\,\nabla I,\qquad \kappa = \frac{k_B T}{\langle \delta x^2\rangle}`,
  ],
  liveEquations(s, p) {
    const m = mode(p);
    if (m === 2) {
      const tw = tweezer(p);
      return [String.raw`\kappa_x = ${texNum(stiffnessX(tw) * 1e6)}\ \text{pN/μm},\quad \kappa_{\text{medido}} = \frac{k_BT}{\langle\delta x^2\rangle} = ${texNum(measuredStiffness(s))}\ \text{pN/μm}`];
    }
    const Teq = equilibriumT(sat(p), Delta(p)) * 1e6;
    return [
      String.raw`T_D = \frac{\hbar\Gamma}{2k_B} = ${texNum(dopplerLimit() * 1e6)}\ \mu\text{K},\quad T_{\text{eq}}(\Delta = ${texNum(num(p, "det", -0.5))}\Gamma,\ s = ${texNum(sat(p))}) = ${texNum(Teq)}\ \mu\text{K}`,
      String.raw`T_{\text{medido}} = \frac{m\langle v^2\rangle}{k_B} = ${texNum(ensembleT(s, p))}\ \mu\text{K}`,
    ];
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
        { value: 0, label: "Melaço óptico 1D (resfriamento Doppler)" },
        { value: 1, label: "Armadilha magneto-óptica (MOT)" },
        { value: 2, label: "Pinça óptica" },
      ],
    },
    { key: "det", label: "Dessintonia do laser Δ", unit: "Γ", min: -4, max: 1, step: 0.05, default: -0.5, live: true },
    { key: "s", label: "Saturação por feixe s = I/I_sat", unit: "", min: 0.05, max: 5, step: 0.05, default: 0.5, live: true },
    { key: "T0", label: "Temperatura inicial dos átomos", unit: "mK", min: 1, max: 40, step: 1, default: 10 },
    { key: "grad", label: "Gradiente de campo B' (eixo z)", unit: "G/cm", min: 0, max: 30, step: 0.5, default: 10, live: true },
    { key: "polar", label: "Polarizações", unit: "", min: 0, max: 1, step: 1, default: 0, live: true, options: [{ value: 0, label: "corretas (armadilha)" }, { value: 1, label: "invertidas" }] },
    { key: "P", label: "Potência do laser da pinça", unit: "mW", min: 2, max: 300, step: 1, default: 50, live: true, log: true },
    { key: "w0", label: "Cintura do feixe w₀", unit: "μm", min: 0.3, max: 1.2, step: 0.05, default: 0.4, live: true },
    { key: "a", label: "Raio da esfera", unit: "μm", min: 0.03, max: 0.2, step: 0.005, default: 0.08 },
    { key: "np", label: "Material da esfera", unit: "", min: 1.2, max: 1.57, step: 0.01, default: 1.57, options: [{ value: 1.57, label: "poliestireno (n = 1,57)" }, { value: 1.45, label: "sílica (n = 1,45)" }, { value: 1.2, label: "bolha de baixo índice (n = 1,2)" }] },
    { key: "u", label: "Velocidade do fluxo de água", unit: "μm/s", min: -1500, max: 1500, step: 10, default: 0, live: true },
  ],
  observables: [
    { key: "T", label: "Temperatura medida", unit: "μK", value: (s, p) => ensembleT(s, p) },
    { key: "TD", label: "Limite Doppler", unit: "μK", value: () => dopplerLimit() * 1e6 },
    { key: "Teq", label: "Temperatura de equilíbrio prevista", unit: "μK", value: (_s, p) => Math.min(1e9, equilibriumT(sat(p), Delta(p)) * 1e6) },
    { key: "tau", label: "Tempo de amortecimento m/β", unit: "μs", value: (_s, p) => (friction(sat(p), Delta(p)) > 0 ? (RB.m / friction(sat(p), Delta(p))) * 1e6 : 0) },
    { key: "presos", label: "Átomos presos na MOT", unit: "", value: (s, p) => (mode(p) === 1 ? trapped(s) : 0) },
    { key: "sigz", label: "Tamanho da nuvem σz", unit: "μm", value: (s, p) => (mode(p) === 1 ? cloudSigma(s) * 1e6 : 0) },
    { key: "dx", label: "Deslocamento da esfera x − x_foco", unit: "nm", value: (s) => (s.bead[0] - s.focus[0]) * 1e9 },
    { key: "Fx", label: "Força lateral sobre a esfera", unit: "pN", value: (s, p) => tweezerForce(tweezer(p), s.bead[0] - s.focus[0], s.bead[1] - s.focus[1])[0] * 1e12 },
    { key: "kteo", label: "Rigidez teórica κx", unit: "pN/μm", value: (_s, p) => stiffnessX(tweezer(p)) * 1e6 },
    { key: "kmed", label: "Rigidez medida (equipartição)", unit: "pN/μm", value: (s) => measuredStiffness(s) },
    { key: "Fmax", label: "Força lateral máxima", unit: "pN", value: (_s, p) => maxLateralForce(tweezer(p)) * 1e12 },
    { key: "vesc", label: "Fluxo de escape F_max/6πηa", unit: "μm/s", value: (_s, p) => (maxLateralForce(tweezer(p)) / dragCoef(tweezer(p))) * 1e6 },
    { key: "zeq", label: "Equilíbrio axial (acima do foco)", unit: "nm", value: (_s, p) => { const z = axialEquilibrium(tweezer(p)); return Number.isFinite(z) ? z * 1e9 : 0; } },
  ],
  chart: { x: "t", y: "T" },
  scenarios: [
    {
      id: "melaco",
      label: "Melaço óptico: até o limite Doppler",
      params: { modo: 0, det: -0.5, s: 0.3, T0: 10 },
      guide: `### Atrito feito de luz
1. Cada feixe empurra o átomo; o que vem **contra** ele está mais perto da ressonância (efeito Doppler) e empurra mais. Veja no gráfico: a soma é $F \\approx -\\beta v$.
2. Rode: a temperatura cai de 10 mK para algumas centenas de μK em ~1 ms e para no equilíbrio entre atrito e aquecimento pelos recuos aleatórios.
3. Responda à previsão. Varie $\\Delta$ entre $-0{,}2\\Gamma$ e $-3\\Gamma$ e anote o $T$ final: o mínimo é $T_D = \\hbar\\Gamma/2k_B \\approx 146\\ \\mu$K, em $\\Delta = -\\Gamma/2$ e baixa intensidade.
4. Ponha $\\Delta > 0$ (azul): o atrito vira "anti-atrito" e os átomos esquentam.
5. O histograma segue Maxwell–Boltzmann o tempo todo: o resfriamento é termalização com a luz.`,
      predict: [
        {
          question: "Para esfriar os átomos, a frequência do laser deve ficar…",
          options: ["exatamente na ressonância", "um pouco abaixo (para o vermelho)", "um pouco acima (para o azul)", "tanto faz"],
          answer: 1,
          explanation: "Com $\\Delta < 0$, o átomo que se move contra o feixe vê a luz deslocada para o azul, mais perto da ressonância: absorve mais desse feixe e é freado. Com $\\Delta > 0$ a lógica se inverte e ele é acelerado.",
        },
      ],
    },
    {
      id: "mot",
      label: "Armadilha magneto-óptica",
      params: { modo: 1, det: -1.5, s: 1, grad: 10, polar: 0 },
      guide: `### Atrito + mola
1. Átomos lentos do vapor entram pelas bordas. O gradiente de campo desloca os níveis Zeeman: longe do centro, o feixe que empurra **para dentro** fica mais ressonante.
2. Rode e veja os átomos se acumularem no centro (contador e curva "presos").
3. No zoom, a nuvem tem dezenas de μm e é mais estreita em z, onde o gradiente é o dobro.
4. Responda à previsão e inverta as polarizações: a força vira repulsiva e a armadilha esvazia.
5. Zere o gradiente: sobra só o melaço — os átomos são freados mas se espalham.`,
      predict: [
        {
          question: "Se as polarizações σ+/σ− dos feixes forem trocadas (mesmo campo), o que acontece com a nuvem?",
          options: ["Fica igual", "Fica mais compacta", "Os átomos são expulsos do centro", "Os átomos esquentam até a temperatura ambiente"],
          answer: 2,
          explanation: "A força de posição troca de sinal: agora o feixe que empurra para fora é o mais ressonante. O atrito (que só depende de $\\Delta < 0$) continua, mas a mola vira antimola.",
        },
      ],
    },
    {
      id: "pinca",
      label: "Pinça óptica: rigidez pelo movimento browniano",
      params: { modo: 2, P: 50, w0: 0.4, a: 0.08, np: 1.57, u: 0 },
      guide: `### Medindo a mola de luz
1. A esfera de poliestireno é atraída para a região de maior intensidade (força de gradiente). Ela treme por causa das colisões com as moléculas de água.
2. Deixe rodar: o histograma de $x - x_{\\text{foco}}$ fica gaussiano e a rigidez sai da equipartição $\\kappa = k_BT/\\langle\\delta x^2\\rangle$. Compare com a teórica.
3. Dobre a potência: $\\kappa$ dobra e a nuvem de posições encolhe por $\\sqrt2$.
4. Arraste o foco: a esfera vai junto (é assim que se manipulam células e moléculas).
5. Ligue o fluxo e aumente até a esfera escapar; compare com $F_{\\max}/6\\pi\\eta a$.
6. Troque para uma esfera de índice menor que a água: ela é **expulsa** do feixe.`,
      predict: [
        {
          question: "Dobrando a potência do laser, o desvio padrão das posições da esfera no foco…",
          options: ["dobra", "cai pela metade", "cai por √2", "não muda"],
          answer: 2,
          explanation: "$\\kappa \\propto P$ e $\\langle\\delta x^2\\rangle = k_BT/\\kappa$, então $\\sigma_x \\propto 1/\\sqrt P$.",
        },
      ],
    },
  ],
  exercises: [
    {
      id: "doppler",
      prompt: "Uma transição atômica tem largura natural Γ/2π = {fG} MHz. Qual a temperatura-limite do resfriamento Doppler, em μK?",
      vary: { fG: [2, 30, 1] },
      fixed: { modo: 0 },
      answer: { label: "T_D", unit: "μK", compute: (p) => dopplerLimit(2 * Math.PI * num(p, "fG") * 1e6) * 1e6 },
      hint: "T_D = ħΓ/(2k_B), com Γ = 2π × (Γ/2π).",
    },
    {
      id: "equiparticao",
      prompt: "Uma esfera presa numa pinça óptica, em água a 295 K, tem desvio padrão de posição lateral de {sx} nm. Qual a rigidez da armadilha, em pN/μm?",
      vary: { sx: [10, 80, 0] },
      fixed: { modo: 2 },
      answer: { label: "κ", unit: "pN/μm", compute: (p) => ((KB * T_ROOM) / (num(p, "sx") * 1e-9) ** 2) * 1e6 },
      hint: "Equipartição: κ⟨x²⟩/2 = k_BT/2.",
    },
    {
      id: "escape",
      prompt: "A força máxima de uma pinça é {Fp} pN sobre uma esfera de raio {a} μm em água (η = 1,0 × 10⁻³ Pa·s). Acima de que velocidade do fluxo (μm/s) a esfera escapa?",
      vary: { Fp: [0.5, 10, 1], a: [0.1, 0.4, 2] },
      fixed: { modo: 2 },
      answer: { label: "u", unit: "μm/s", compute: (p) => ((num(p, "Fp") * 1e-12) / (6 * Math.PI * 1e-3 * num(p, "a") * 1e-6)) * 1e6 },
      hint: "Arrasto de Stokes: F = 6πηa u.",
    },
  ],
  init: (p) => init(p),
  step(s, p, t, dt) {
    const m = mode(p);
    const st = { seed: s.seed };
    const g = () => gaussianFrom(st);
    const ns: LState = { ...s };
    if (m === 0) {
      const atoms = s.atoms.slice();
      const nsub = 4;
      const h = (dt * 1e-3) / nsub;
      for (let i = 0; i < atoms.length; i += 2) {
        let x = atoms[i]!;
        let v = atoms[i + 1]!;
        for (let k = 0; k < nsub; k++) [x, v] = langevin(x, v, sat(p), Delta(p), 0, h, g);
        if (x > L0) x -= 2 * L0;
        if (x < -L0) x += 2 * L0;
        atoms[i] = x;
        atoms[i + 1] = v;
      }
      ns.atoms = atoms;
      ns.ser = s.ser.concat([t + dt, ensembleT(ns, p)]);
    } else if (m === 1) {
      const atoms = s.atoms.slice();
      const [zx, zz] = zetas(p);
      const nsub = 6;
      const h = (dt * 1e-3) / nsub;
      for (let i = 0; i < atoms.length; i += 4) {
        let x = atoms[i]!;
        let z = atoms[i + 1]!;
        let vx = atoms[i + 2]!;
        let vz = atoms[i + 3]!;
        for (let k = 0; k < nsub; k++) {
          [x, vx] = langevin(x, vx, sat(p), Delta(p), zx, h, g);
          [z, vz] = langevin(z, vz, sat(p), Delta(p), zz, h, g);
        }
        if (Math.abs(x) > L1 || Math.abs(z) > L1) {
          [x, z, vx, vz] = spawnEdge(st);
          ns.lost++;
        }
        atoms[i] = x;
        atoms[i + 1] = z;
        atoms[i + 2] = vx;
        atoms[i + 3] = vz;
      }
      ns.atoms = atoms;
      ns.ser = s.ser.concat([t + dt, trapped(ns)]);
    } else {
      const tw = tweezer(p);
      const gam = dragCoef(tw);
      const kap = Math.max(stiffnessX(tw), 1e-9);
      const T = dt * 1e-3;
      const nsub = clamp(Math.ceil(T / (0.1 * (gam / kap))), 1, 400);
      const h = T / nsub;
      const u = num(p, "u", 0) * 1e-6;
      const amp = Math.sqrt((2 * KB * T_ROOM * h) / gam);
      let [x, z] = s.bead;
      if (s.drag !== "bead") {
        for (let k = 0; k < nsub; k++) {
          const F = tweezerForce(tw, x - s.focus[0], z - s.focus[1]);
          x += (F[0] / gam + u) * h + amp * g();
          z += (F[1] / gam) * h + amp * g();
        }
        if (Math.abs(x) > 1.25e-6 || Math.abs(z) > 1.4e-6) {
          x = u >= 0 ? -1.15e-6 : 1.15e-6;
          z = s.focus[1] + 0.3e-6 * g();
          ns.lost++;
        }
      }
      ns.bead = [x, z];
      if (!s.drag) {
        const dxv = x - s.focus[0];
        const dzv = z - s.focus[1];
        if (Math.abs(dxv) < tw.w0) {
          ns.stats = [s.stats[0]! + 1, s.stats[1]! + dxv, s.stats[2]! + dxv * dxv, s.stats[3]! + dzv, s.stats[4]! + dzv * dzv];
          const R = 4 * Math.sqrt((KB * T_ROOM) / kap);
          const b = Math.floor(((dxv + R) / (2 * R)) * NH);
          if (b >= 0 && b < NH) {
            ns.hist = s.hist.slice();
            ns.hist[b]!++;
          }
        }
      }
      if (Math.floor((t + dt) * 60) > Math.floor(t * 60)) ns.trace = s.trace.concat([t + dt, (x - s.focus[0]) * 1e9]);
      if (ns.trace.length > 2400) ns.trace = ns.trace.slice(ns.trace.length - 2400);
    }
    if (ns.ser.length > 6000) ns.ser = ns.ser.filter((_, i) => i % 4 < 2);
    ns.seed = st.seed;
    return ns;
  },
  dt: 1 / 240,
  sampleEvery: 6,
  maxSamples: 600,
  actions: [
    { id: "reiniciar", label: "Novos átomos / zerar medidas", run: (s, p) => ({ ...init(p, s.seed), focus: s.focus, bead: s.bead }) },
    { id: "centro", label: "Foco no centro", run: (s) => resetBead({ ...s, focus: [0, 0], bead: [0.15e-6, 0] }) },
    { id: "zerar", label: "Zerar estatística da esfera", run: (s) => resetBead(s) },
  ],
  pointer: {
    down(s, p, pt) {
      if (mode(p) !== 2) return undefined;
      const S = 14 / 2.4e-6;
      const cx = -9.4;
      const cy = -0.5;
      const wx = (pt.x - cx) / S;
      const wz = (pt.y - cy) / S;
      if (Math.abs(wx) > 1.2e-6 || Math.abs(wz) > 1.4e-6) return undefined;
      const tw = tweezer(p);
      if (Math.hypot(wx - s.bead[0], wz - s.bead[1]) < tw.a + 0.15e-6) return { ...s, drag: "bead" };
      return resetBead({ ...s, drag: "laser", focus: [wx, wz] });
    },
    move(s, _p, pt, dragging) {
      if (!dragging || !s.drag) return undefined;
      const S = 14 / 2.4e-6;
      const wx = clamp((pt.x + 9.4) / S, -1.1e-6, 1.1e-6);
      const wz = clamp((pt.y + 0.5) / S, -1.3e-6, 1.3e-6);
      if (s.drag === "bead") return { ...s, bead: [wx, wz] };
      return { ...s, focus: [wx, wz] };
    },
    up: (s) => (s.drag ? resetBead({ ...s, drag: null }) : undefined),
    cursor: (_s, p, pt) => (mode(p) === 2 && pt.x < -2.4 && pt.x > -16.4 && pt.y < 7.6 ? "grab" : undefined),
  },
  viewport: () => ({ ...VIEW, unit: "" }),
  render(ctx, frame) {
    const d = draw(ctx, frame);
    const m = mode(frame.params);
    if (m === 0) drawMolasses(d, frame.state, frame.params, frame.t);
    else if (m === 1) drawMOT(d, frame.state, frame.params, frame.t);
    else drawTweezer(d, frame.state, frame.params, frame.t);
  },
});

export default resfriamentoLaser;
