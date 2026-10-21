import { clamp, defineSim, draw, num, rng, texNum, type Draw, type Params } from "@fisilab/core";
import {
  COIL,
  GASES,
  LAMP_GASES,
  NEON_VB,
  NEON_VN,
  PHOSPHOR,
  PHOSPHOR_QE,
  airBreakdown,
  arcCurrent,
  arcMaxGap,
  arcV,
  coilPeak,
  electronSpeed,
  ionCurrent,
  K_B,
  TORR,
  larmorRadius,
  leafAngle,
  meanFreePath,
  operatingPoints,
  paschenMinPd,
  paschenMinV,
  paschenV,
  photonEV,
  pickLine,
  pumpPressure,
  relaxationPeriod,
  rgbCss,
  traceElectron,
  vOfI,
  wavelengthRGB,
} from "./model.ts";

export * from "./model.ts";

export interface Photon {
  x: number;
  nm: number;
  age: number;
}

export interface DState {
  clock: number;
  p: number;
  pump: boolean;
  /** Tempo de bombeamento acumulado (s). */
  tPump: number;
  pStart: number;
  // Neon
  Vc: number;
  lit: boolean;
  flashes: number;
  lastFlash: number;
  period: number;
  // Crookes
  mx: number;
  my: number;
  // Monte Carlo da lâmpada
  ex: number[];
  ek: number[];
  ed: number[];
  photons: Photon[];
  counts: number[];
  Ein: number;
  Evis: number;
  Euv: number;
  seed: number;
  // Arco
  gap: number;
  arcOn: boolean;
  // Bobina
  I1: number;
  open: boolean;
  tPhase: number;
  V2: number;
  breaks: number;
  sparks: number;
  flash: number;
  // Eletroscópio
  Q: number;
  srcR: number;
  drag: "ima" | "eletrodo" | "fonte" | null;
}

export const mode = (p: Params) => Math.round(num(p, "modo"));
const SCALE = [1, 1, 1, 1, 1, 0.02, 100];

// ----- Tubo -----
export const gas = (p: Params) => GASES[Math.round(num(p, "gas"))] ?? GASES[0]!;
const tubeD = (p: Params) => num(p, "dTubo", 30);
export const breakdown = (s: DState, p: Params) => paschenV(gas(p), s.p, tubeD(p));
export const tubeOn = (s: DState, p: Params) => num(p, "Vt", 3) * 1000 >= breakdown(s, p);
export const darkSpace = (s: DState, p: Params) => gas(p).pdc / s.p;
const P_ULT = 1e-3;
const PUMP_TAU = 4;

// ----- Neon -----
const Rn = (p: Params) => num(p, "R", 1) * 1e6;
const Cn = (p: Params) => num(p, "C", 0) * 1e-6;
const En = (p: Params) => num(p, "E", 120);
export const R_LAMP = 500;
export const I_HOLD = 1e-4;
export const V_EXT = NEON_VN + I_HOLD * R_LAMP;
export function neonPoint(s: DState, p: Params): { I: number; V: number } {
  if (Cn(p) > 0) {
    const I = s.lit ? Math.max(0, (s.Vc - NEON_VN) / R_LAMP) : 0;
    return { I, V: s.Vc };
  }
  const pts = operatingPoints(En(p), Rn(p)).filter((o) => o.stable);
  if (!pts.length) return { I: 0, V: En(p) };
  const pick = s.lit ? pts[pts.length - 1]! : pts[0]!;
  return { I: pick.I, V: pick.V };
}

// ----- Crookes -----
const TUBE_L = 0.4;
const CROSS_X = 0.15;
const CROSS_H = 0.03;
const MAG_W = 0.06;
export const Bfield = (s: DState, p: Params) => (x: number, y: number) => num(p, "B0", 3) * 1e-3 * Math.exp(-((x - s.mx) ** 2 + (y - s.my) ** 2) / (MAG_W * MAG_W));
export function shadowShift(s: DState, p: Params): number {
  const tr = traceElectron(num(p, "Va", 5) * 1e3, Bfield(s, p), 0, 0, 0, TUBE_L, 2e-3);
  return tr[tr.length - 1]![1];
}

// ----- Lâmpadas -----
export const lampGas = (p: Params) => LAMP_GASES[Math.round(num(p, "lampGas", 1))] ?? LAMP_GASES[1]!;
export const ALL_LINES = [...new Set([...LAMP_GASES.flatMap((g) => g.levels.flatMap((l) => l.lines.map((x) => x.nm))), ...PHOSPHOR.map((x) => x.nm)])].sort((a, b) => a - b);
const LAMP_L = 0.5;
const N_E = 20;
const FLIGHTS = 30;
const lampField = (p: Params) => num(p, "Vl", 200) / LAMP_L;
const lampLambda = (p: Params) => (K_B * 300) / (num(p, "pl", 1) * TORR * lampGas(p).sigma);

export function lampStep(s0: DState, p: Params): DState {
  const r = rng(s0.seed);
  const g = lampGas(p);
  const E = lampField(p);
  const lam = lampLambda(p);
  const phosphor = num(p, "fosforo", 1) >= 1;
  const ex = s0.ex.slice();
  const ek = s0.ek.slice();
  const ed = s0.ed.slice();
  const counts = s0.counts.slice();
  const photons = s0.photons.map((f) => ({ ...f, age: f.age + 1 })).filter((f) => f.age < 12);
  let { Ein, Evis, Euv } = s0;
  const emit = (x: number, nm: number) => {
    let out = nm;
    if (nm < 380) {
      if (phosphor && r() < PHOSPHOR_QE) out = pickLine(PHOSPHOR, r()).nm;
      else {
        Euv += photonEV(nm);
        const i = ALL_LINES.indexOf(nm);
        if (i >= 0) counts[i]! += 1;
        if (photons.length < 80) photons.push({ x, nm, age: 0 });
        return;
      }
    }
    Evis += photonEV(out);
    const i = ALL_LINES.indexOf(out);
    if (i >= 0) counts[i]! += 1;
    if (photons.length < 80) photons.push({ x, nm: out, age: 0 });
  };
  for (let e = 0; e < N_E; e++) {
    let x = ex[e]!;
    let k = ek[e]!;
    let d = ed[e]!;
    for (let f = 0; f < FLIGHTS; f++) {
      const l = -lam * Math.log(1 - r());
      let dx: number;
      if (d > 0) dx = l;
      else {
        const turn = k / E;
        if (l <= turn) dx = -l;
        else {
          dx = l - 2 * turn;
          d = 1;
        }
      }
      k += E * dx;
      Ein += E * dx;
      x += dx;
      if (x >= LAMP_L) {
        x = 0;
        k = 0.5;
        d = 1;
        continue;
      }
      if (x < 0) {
        x = 0;
        d = 1;
        k = Math.max(k, 0.1);
      }
      // Colisão
      const avail = g.levels.filter((lv) => lv.E <= k);
      if (avail.length && r() < 0.7) {
        const lv = avail.length > 1 && r() < 0.4 ? avail[avail.length - 1]! : avail[0]!;
        k -= lv.E;
        emit(x, pickLine(lv.lines, r()).nm);
      } else d = r() < 0.5 ? -1 : 1;
      k = Math.max(k, 0);
    }
    ex[e] = x;
    ek[e] = k;
    ed[e] = d;
  }
  return { ...s0, ex, ek, ed, counts, photons, Ein, Evis, Euv, seed: (s0.seed + 1) >>> 0 };
}
export const lampEfficiency = (s: DState) => (s.Ein > 0 ? s.Evis / s.Ein : 0);

// ----- Arco -----
const Ea = (p: Params) => num(p, "Ea", 120);
const Ra = (p: Params) => num(p, "Ra", 8);
export function arcState(s: DState, p: Params): { I: number; V: number } {
  if (!s.arcOn) return { I: 0, V: Ea(p) };
  if (s.gap < 0.05) return { I: Ea(p) / Ra(p), V: 0 };
  const I = arcCurrent(Ea(p), Ra(p), s.gap);
  return Number.isFinite(I) ? { I, V: arcV(I, s.gap) } : { I: 0, V: Ea(p) };
}

// ----- Bobina -----
const E1 = (p: Params) => num(p, "E1", 6);
export const coilBreakTime = () => (COIL.L1 / COIL.R1) * Math.log(1 / (1 - COIL.breakFrac));
export const coilFrequency = () => 1 / (coilBreakTime() + COIL.tOff);

// ----- Eletroscópio -----
export const VOL = 1000;
export const Q_BG = 10;
const SOURCES = [0, 5e5, 2e4];
export const ionRate = (s: DState, p: Params) => Q_BG + (SOURCES[Math.round(num(p, "fonte", 2))] ?? 0) * (10 / s.srcR) ** 2;

// ---------------------------------------------------------------------------
// Desenho
// ---------------------------------------------------------------------------

const fmt = (v: number, n = 2) => (Number.isFinite(v) ? v.toFixed(n).replace(".", ",") : "∞");
const fmtP = (p: number) => (p >= 1 ? fmt(p, 1) : p >= 0.01 ? fmt(p, 3) : p.toExponential(1).replace(".", ","));

function panel(d: Draw, x: number, y: number, lines: string[], bold: number[] = []) {
  lines.forEach((l, i) => d.text(l, x, y - i * 0.48, { size: 12, align: "left", weight: bold.includes(i) ? "700" : "400" }));
}

function glass(d: Draw, x0: number, y0: number, x1: number, y1: number) {
  d.rect(x0, y0, x1 - x0, y1 - y0, { stroke: d.theme.muted, width: 1.5, fill: d.theme.dark ? "rgba(160,190,220,0.05)" : "rgba(140,170,210,0.08)" });
}

function renderTube(d: Draw, s: DState, p: Params, t: number) {
  const th = d.theme;
  const g = gas(p);
  const X0 = 1.5;
  const X1 = 14.5;
  const Y = 6.5;
  const H = 1.6;
  const L = tubeD(p);
  const sc = (X1 - X0) / L;
  glass(d, X0 - 0.3, Y - H / 2, X1 + 0.3, Y + H / 2);
  d.rect(X0 - 0.2, Y - 0.6, 0.15, 1.2, { fill: th.muted });
  d.rect(X1 + 0.05, Y - 0.6, 0.15, 1.2, { fill: th.muted });
  d.text("cátodo (−)", X0, Y - H / 2 - 0.3, { size: 11 });
  d.text("ânodo (+)", X1, Y - H / 2 - 0.3, { size: 11 });
  d.line(X1 - 4, Y + H / 2, X1 - 4, Y + H / 2 + 0.8, { color: th.muted, width: 3 });
  d.text("para a bomba", X1 - 4, Y + H / 2 + 1.1, { size: 10, color: th.muted });
  const on = tubeOn(s, p);
  const dc = darkSpace(s, p);
  const flick = 0.85 + 0.15 * Math.sin(t * 50);
  if (on) {
    if (s.p > 40) {
      // Faísca filamentar
      const r = rng(Math.floor(t * 20));
      const pts: [number, number][] = [];
      for (let i = 0; i <= 20; i++) pts.push([X0 + ((X1 - X0) * i) / 20, Y + (i === 0 || i === 20 ? 0 : (r() - 0.5) * 0.5)]);
      d.polyline(pts, { color: g.color, width: 2 });
      d.polyline(pts, { color: g.color, width: 6, alpha: 0.25 });
    } else if (dc < L * 0.85) {
      const c = (x: number) => X0 + x * sc;
      const neg = Math.min(2 * dc, L - dc);
      const fds = Math.min(1.5 * dc, Math.max(0, L - 3 * dc));
      d.rect(c(0.03 * dc), Y - H / 2 + 0.1, 0.12 * dc * sc + 0.05, H - 0.2, { fill: g.color, alpha: 0.6 * flick });
      d.rect(c(dc), Y - H / 2 + 0.1, neg * sc, H - 0.2, { fill: g.color, alpha: 0.75 * flick });
      const pc0 = dc + neg + fds;
      if (pc0 < L) {
        d.rect(c(pc0), Y - H / 2 + 0.15, (L - pc0) * sc, H - 0.3, { fill: g.color, alpha: 0.45 * flick });
        if (s.p > 0.05 && s.p < 3) for (let x = pc0 + dc; x < L - 0.5; x += 1.2 * dc + 0.5) d.rect(c(x), Y - H / 2 + 0.15, 0.3 * dc * sc + 0.05, H - 0.3, { fill: th.dark ? "#000" : "#fff", alpha: 0.35 });
      }
      d.text("espaço escuro de Crookes", c(dc / 2), Y + H / 2 + 0.3, { size: 10, color: th.muted });
      d.text("luz negativa", c(dc + neg / 2), Y - H / 2 - 0.75, { size: 10, color: th.muted });
      if (pc0 < L) d.text("coluna positiva", c((pc0 + L) / 2), Y + H / 2 + 0.3, { size: 10, color: th.muted });
    } else {
      // Espaço escuro preenche o tubo: raios catódicos e fluorescência verde do vidro
      d.rect(X1 - 0.3, Y - H / 2, 0.6, H, { fill: "#4dff7a", alpha: 0.5 * flick });
      for (let i = 0; i < 5; i++) d.arrow(X0 + 0.2, Y - 0.5 + i * 0.25, X1 - X0 - 0.6, 0, { color: th.negative, width: 1, alpha: 0.4 });
      d.text("raios catódicos: o vidro fluoresce em verde", (X0 + X1) / 2, Y + H / 2 + 0.3, { size: 11, color: th.muted });
    }
  }
  // Curva de Paschen
  const gx0 = 1.5;
  const gx1 = 9;
  const gy0 = 0.6;
  const gy1 = 4.2;
  const lx = (pd: number) => gx0 + ((Math.log10(pd) + 2) / 6) * (gx1 - gx0);
  const ly = (V: number) => gy0 + (clamp(Math.log10(V), 2, 5) - 2) / 3 * (gy1 - gy0);
  d.line(gx0, gy0, gx1, gy0, { color: th.muted });
  d.line(gx0, gy0, gx0, gy1, { color: th.muted });
  for (let e = -2; e <= 4; e++) d.text(`10${["⁻²", "⁻¹", "⁰", "¹", "²", "³", "⁴"][e + 2]}`, lx(10 ** e), gy0 - 0.25, { size: 9, color: th.muted });
  for (const V of [100, 1000, 10000, 100000]) d.text(V >= 1000 ? `${V / 1000} kV` : `${V} V`, gx0 - 0.1, ly(V), { size: 9, color: th.muted, align: "right" });
  d.text("p·d (Torr·cm)", (gx0 + gx1) / 2, gy0 - 0.5, { size: 10, color: th.muted });
  const curve: [number, number][] = [];
  for (let i = 0; i <= 300; i++) {
    const pd = 10 ** (-2 + (6 * i) / 300);
    const V = paschenV(g, pd, 1);
    if (Number.isFinite(V) && V < 1e5) curve.push([lx(pd), ly(V)]);
  }
  d.polyline(curve, { color: g.color, width: 2 });
  d.line(gx0, ly(num(p, "Vt", 3) * 1000), gx1, ly(num(p, "Vt", 3) * 1000), { color: th.accent, dash: [4, 4] });
  d.dot(lx(s.p * L), ly(breakdown(s, p)), 5, on ? th.positive : th.text);
  // Painel
  panel(d, 9.6, 4.2, [
    `${g.name}: p = ${fmtP(s.p)} Torr ${s.pump ? "(bomba ligada)" : ""}`,
    `V_ruptura (Paschen) = ${Number.isFinite(breakdown(s, p)) ? fmt(breakdown(s, p) / 1000, 2) + " kV" : "∞"}`,
    `V aplicada = ${fmt(num(p, "Vt", 3), 2)} kV → ${on ? "descarga" : "sem descarga"}`,
    `espaço escuro: d_c = ${fmt(dc, 2)} cm`,
    `livre caminho médio: ${fmt(meanFreePath(s.p) * 1000, 4)} mm`,
    `mínimo de Paschen: ${fmt(paschenMinV(g), 0)} V em ${fmt(paschenMinPd(g), 2)} Torr·cm`,
  ], [2]);
}

function renderNeon(d: Draw, s: DState, p: Params) {
  const th = d.theme;
  const op = neonPoint(s, p);
  // Gráfico V × log I
  const gx0 = 1.2;
  const gx1 = 10;
  const gy0 = 1;
  const gy1 = 9;
  const X = (I: number) => gx0 + ((Math.log10(Math.max(I, 1e-12)) + 12) / 15) * (gx1 - gx0);
  const Y = (V: number) => gy0 + (clamp(V, 0, 300) / 300) * (gy1 - gy0);
  d.line(gx0, gy0, gx1, gy0, { color: th.muted });
  d.line(gx0, gy0, gx0, gy1, { color: th.muted });
  for (let e = -12; e <= 3; e += 3) d.text(`10^${e} A`, X(10 ** e), gy0 - 0.3, { size: 9, color: th.muted });
  for (let V = 0; V <= 300; V += 100) d.text(`${V} V`, gx0 - 0.1, Y(V), { size: 9, color: th.muted, align: "right" });
  const pts: [number, number][] = [];
  for (let i = 0; i <= 300; i++) {
    const I = 10 ** (-12 + (15 * i) / 300);
    pts.push([X(I), Y(vOfI(I))]);
  }
  d.polyline(pts, { color: GASES[1]!.color, width: 2.5 });
  const labels: [number, number, string][] = [
    [1e-10, 45, "escura (Townsend)"],
    [3e-4, NEON_VN - 18, "luminescente normal"],
    [0.05, 150, "anormal"],
    [100, 45, "arco"],
  ];
  for (const [I, V, l] of labels) d.text(l, X(I), Y(V), { size: 10, color: th.muted });
  // Reta de carga (só sem capacitor)
  if (Cn(p) === 0) {
    const lp: [number, number][] = [];
    for (let i = 0; i <= 300; i++) {
      const I = 10 ** (-12 + (15 * i) / 300);
      const V = En(p) - I * Rn(p);
      if (V < 0) break;
      lp.push([X(I), Y(V)]);
    }
    d.polyline(lp, { color: th.accent, dash: [5, 4] });
    d.text("reta de carga V = E − RI", X(1e-9), Y(En(p)) + 0.3, { size: 10, color: th.accent });
  }
  d.dot(X(op.I), Y(op.V), 6, th.positive);
  // Lâmpada: a luz cobre parte do cátodo proporcional a I (densidade de corrente constante)
  const lx = 12.8;
  const ly = 6.5;
  d.circle(lx, ly, 1.2, { stroke: th.muted, fill: th.dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.02)" });
  d.line(lx - 0.3, ly - 0.8, lx - 0.3, ly + 0.6, { color: th.muted, width: 3 });
  d.line(lx + 0.3, ly - 0.8, lx + 0.3, ly + 0.6, { color: th.muted, width: 3 });
  const glowFrac = op.I > 1e-6 ? clamp(Math.log10(op.I / 1e-6) / 4, 0.1, 1) : 0;
  if (glowFrac > 0) d.rect(lx - 0.45, ly - 0.8, 0.3, 1.4 * glowFrac, { fill: GASES[1]!.color, alpha: 0.85 });
  if (glowFrac > 0) d.circle(lx, ly, 1.0, { fill: GASES[1]!.color, alpha: 0.15 * glowFrac });
  d.text("lâmpada neon", lx, ly - 1.5, { size: 11 });
  panel(d, 10.6, 4.4, [
    `E = ${fmt(En(p), 0)} V   R = ${fmt(Rn(p) / 1e6, 2)} MΩ   C = ${fmt(Cn(p) * 1e6, 2)} μF`,
    `V_lâmpada = ${fmt(op.V, 1)} V   I = ${fmt(op.I * 1e3, 4)} mA`,
    `acende em ${NEON_VB} V, mantém ${NEON_VN} V`,
    Cn(p) > 0 ? `piscadas: ${s.flashes}   período medido: ${fmt(s.period, 3)} s` : s.lit ? "acesa (ponto estável)" : "apagada",
    Cn(p) > 0 ? `T = RC ln((E−Ve)/(E−Vb)) = ${fmt(relaxationPeriod(En(p), Rn(p), Cn(p), NEON_VB, V_EXT), 3)} s` : "",
  ], [3]);
}

function renderCrookes(d: Draw, s: DState, p: Params) {
  const th = d.theme;
  const k = 30; // unidades por metro
  const X = (x: number) => 1 + x * k;
  const Y = (y: number) => 6 + y * k;
  glass(d, X(-0.01), Y(-0.07), X(TUBE_L + 0.005), Y(0.07));
  d.rect(X(-0.008), Y(-0.01), 0.15, 0.6, { fill: th.muted });
  d.line(X(CROSS_X), Y(-CROSS_H), X(CROSS_X), Y(CROSS_H), { color: th.text, width: 4 });
  d.text("cruz de Malta (ânodo)", X(CROSS_X), Y(0.075) + 0.2, { size: 10, color: th.muted });
  d.rect(X(TUBE_L) - 0.1, Y(-0.065), 0.1, 0.13 * k, { fill: "#4dff7a", alpha: 0.6 });
  const V = num(p, "Va", 5) * 1e3;
  const B = Bfield(s, p);
  for (let i = -6; i <= 6; i++) {
    const Yt = i * 0.01;
    const tr = traceElectron(V, B, 0, 0, Math.atan2(Yt, TUBE_L), TUBE_L, 4e-3);
    let end = tr.length;
    for (let j = 1; j < tr.length; j++)
      if (tr[j - 1]![0] < CROSS_X && tr[j]![0] >= CROSS_X && Math.abs(tr[j]![1]) < CROSS_H) {
        end = j + 1;
        break;
      }
    const pts = tr.slice(0, end).filter((q) => Math.abs(q[1]) < 0.068).map(([x, y]) => [X(x), Y(y)] as [number, number]);
    d.polyline(pts, { color: th.accent, width: 1, alpha: 0.6 });
  }
  // Ímã (polo voltado para o observador)
  const B0 = num(p, "B0", 3);
  d.circle(X(s.mx), Y(s.my), MAG_W * k, { stroke: B0 >= 0 ? th.positive : th.negative, dash: [4, 4], width: 1 });
  d.circle(X(s.mx), Y(s.my), 0.45, { fill: B0 >= 0 ? th.positive : th.negative, alpha: 0.85 });
  d.text(B0 >= 0 ? "N" : "S", X(s.mx), Y(s.my), { size: 13, weight: "700", color: "#fff" });
  d.text("ímã (arraste)", X(s.mx), Y(s.my) - 0.75, { size: 10, color: th.muted });
  // Tela vista de frente
  const dy = shadowShift(s, p);
  const cx = 14.6;
  const cy = 6;
  const R = 1.25;
  const sc = R / 0.065;
  d.circle(cx, cy, R, { fill: "#4dff7a", alpha: 0.55, stroke: th.muted });
  const m = (CROSS_H / CROSS_X) * TUBE_L * sc; // sombra ampliada
  const oy = cy + dy * sc;
  const arm = (a: number) => {
    const c = Math.cos(a);
    const s2 = Math.sin(a);
    const w = 0.35 * m;
    const pts: [number, number][] = [
      [0, 0],
      [m * c - w * s2, m * s2 + w * c],
      [m * c + w * s2, m * s2 - w * c],
    ];
    d.polyline(pts.map(([x, y]) => [cx + x, oy + y] as [number, number]), { close: true, fill: th.dark ? "#0b1a10" : "#20352a", color: "none", alpha: 0.85 });
  };
  d.ctx.save();
  d.ctx.beginPath();
  d.ctx.arc(cx, cy, R, 0, 2 * Math.PI);
  d.ctx.clip();
  for (let i = 0; i < 4; i++) arm((i * Math.PI) / 2);
  d.ctx.restore();
  d.text("tela vista de frente", cx, cy + R + 0.3, { size: 10, color: th.muted });
  const v = electronSpeed(V);
  panel(d, 1, 3.4, [
    `V = ${fmt(V / 1e3, 1)} kV → v = ${fmt(v / 1e7, 3)} × 10⁷ m/s (${fmt(v / 2.998e8, 3)} c)`,
    `B no centro do ímã = ${fmt(B0, 1)} mT → raio r = p/(eB) = ${B0 !== 0 ? fmt(larmorRadius(V, B0 * 1e-3) * 100, 1) + " cm" : "∞"}`,
    `deslocamento da sombra na tela: ${fmt(dy * 1000, 1)} mm`,
    "A sombra nítida mostra que os raios andam em linha reta; o ímã",
    "os desvia como cargas negativas (F = q v × B).",
  ], [2]);
}

function renderLamp(d: Draw, s: DState, p: Params) {
  const th = d.theme;
  const g = lampGas(p);
  const X0 = 1;
  const X1 = 15;
  const Y = 7.2;
  const sc = (X1 - X0) / LAMP_L;
  // Cor média da luz visível
  let r = 0;
  let gg = 0;
  let b = 0;
  let tot = 0;
  ALL_LINES.forEach((nm, i) => {
    const c = s.counts[i] ?? 0;
    if (nm < 380 || !c) return;
    const [rr, g2, bb] = wavelengthRGB(nm);
    r += c * rr;
    gg += c * g2;
    b += c * bb;
    tot += c;
  });
  const mx = Math.max(r, gg, b, 1e-9);
  const phosphor = num(p, "fosforo", 1) >= 1 && g.name === "Mercúrio";
  glass(d, X0, Y - 0.8, X1, Y + 0.8);
  if (phosphor) d.rect(X0, Y - 0.8, X1 - X0, 1.6, { fill: th.dark ? "#ddd" : "#f4f4f4", alpha: 0.25 });
  if (tot > 0) d.rect(X0, Y - 0.75, X1 - X0, 1.5, { fill: rgbCss([r / mx, gg / mx, b / mx], 0.35) });
  for (const f of s.photons) {
    const a = 1 - f.age / 12;
    if (f.nm < 380) d.circle(X0 + f.x * sc, Y + 0.3 * Math.sin(f.x * 97), 0.12, { stroke: "#8a63d2", alpha: a, dash: [2, 2] });
    else d.dot(X0 + f.x * sc, Y + 0.3 * Math.sin(f.x * 97 + f.nm), 5, rgbCss(wavelengthRGB(f.nm), 1), a);
  }
  for (let e = 0; e < s.ex.length; e++) d.dot(X0 + s.ex[e]! * sc, Y - 0.5 + (e / N_E) * 1.0, 2.5, th.negative);
  d.text(`${g.name} a ${fmtP(num(p, "pl", 1))} Torr, ${fmt(num(p, "Vl", 200), 0)} V${phosphor ? ", com fósforo" : ""}`, (X0 + X1) / 2, Y + 1.15, { size: 12 });
  // Espectro
  const sx0 = 1;
  const sx1 = 11;
  const sy0 = 0.8;
  const sy1 = 4.6;
  const SX = (nm: number) => sx0 + ((nm - 200) / 600) * (sx1 - sx0);
  for (let nm = 380; nm < 780; nm += 5) d.rect(SX(nm), sy0 - 0.25, SX(nm + 5) - SX(nm), 0.18, { fill: rgbCss(wavelengthRGB(nm), 0.9) });
  d.rect(SX(200), sy0 - 0.25, SX(380) - SX(200), 0.18, { fill: "#8a63d2", alpha: 0.25 });
  d.text("UV (invisível)", SX(290), sy0 - 0.5, { size: 9, color: th.muted });
  for (let nm = 200; nm <= 800; nm += 100) d.text(`${nm}`, SX(nm), sy0 - 0.5, { size: 9, color: th.muted });
  const cmax = Math.max(1, ...s.counts);
  ALL_LINES.forEach((nm, i) => {
    const c = s.counts[i] ?? 0;
    if (!c) return;
    const h = ((sy1 - sy0) * c) / cmax;
    d.rect(SX(nm) - 0.06, sy0, 0.12, h, { fill: nm < 380 ? "#8a63d2" : rgbCss(wavelengthRGB(nm)) });
    d.text(`${nm.toFixed(0)}`, SX(nm), sy0 + h + 0.2, { size: 9, color: th.muted });
  });
  d.text("fótons emitidos por linha (nm)", sx0, sy1 + 0.4, { size: 10, align: "left", color: th.muted });
  const nPh = s.counts.reduce((a, c) => a + c, 0);
  panel(d, 11.4, 4.6, [
    `livre caminho λ = ${fmt(lampLambda(p) * 1000, 3)} mm`,
    `ganho por λ: eEλ = ${fmt(lampField(p) * lampLambda(p), 3)} eV`,
    `limiar: ${g.levels.map((l) => fmt(l.E, 2)).join(" / ")} eV`,
    `fótons: ${nPh}`,
    `energia → luz visível: ${fmt(100 * lampEfficiency(s), 1)} %`,
    `energia → UV: ${fmt(s.Ein > 0 ? (100 * s.Euv) / s.Ein : 0, 1)} %`,
  ], [4]);
}

function renderArc(d: Draw, s: DState, p: Params) {
  const th = d.theme;
  const op = arcState(s, p);
  const k = 0.3;
  const xl = 5;
  const xr = xl + s.gap * k;
  d.rect(xl - 3, 6.8, 3, 0.4, { fill: "#2f2f2f", stroke: th.muted });
  d.rect(xr, 6.8, 3, 0.4, { fill: "#2f2f2f", stroke: th.muted });
  d.text("carvão (arraste o da direita)", xr + 1.5, 7.6, { size: 10, color: th.muted });
  if (op.I > 0 && s.gap >= 0.05) {
    const P = op.I * op.V;
    const a = clamp(P / 2000, 0.2, 1);
    d.circle((xl + xr) / 2, 7, 0.4 + s.gap * k * 0.6 + a, { fill: "#fff2b0", alpha: 0.35 * a });
    d.polyline([[xl, 7], [(xl + xr) / 2, 7.25], [xr, 7]], { color: "#fffbe6", width: 6 });
    d.dot(xl, 7, 5, "#ffb347");
  }
  // Circuito
  d.polyline([[xl - 3, 7], [1, 7], [1, 9], [4, 9]], { color: th.muted });
  d.spring(4, 9, 7, 9, { coils: 6, color: th.text });
  d.polyline([[7, 9], [11, 9], [11, 7], [xr + 3, 7]], { color: th.muted });
  d.text(`reator R = ${fmt(Ra(p), 1)} Ω`, 5.5, 9.5, { size: 10 });
  d.text(`fonte ${fmt(Ea(p), 0)} V`, 1, 9.4, { size: 10 });
  // Gráfico V × I
  const gx0 = 1;
  const gx1 = 8;
  const gy0 = 0.8;
  const gy1 = 5.2;
  const Imax = 40;
  const X = (I: number) => gx0 + (I / Imax) * (gx1 - gx0);
  const Y = (V: number) => gy0 + (clamp(V, 0, 250) / 250) * (gy1 - gy0);
  d.line(gx0, gy0, gx1, gy0, { color: th.muted });
  d.line(gx0, gy0, gx0, gy1, { color: th.muted });
  d.text("I (A)", gx1, gy0 - 0.3, { size: 10, color: th.muted });
  d.text("V (V)", gx0, gy1 + 0.25, { size: 10, color: th.muted });
  for (let I = 10; I <= 40; I += 10) d.text(`${I}`, X(I), gy0 - 0.3, { size: 9, color: th.muted });
  if (s.gap >= 0.05) d.plot((xx) => Y(arcV(((xx - gx0) / (gx1 - gx0)) * Imax, s.gap)), X(0.3), gx1, { color: th.series[1], width: 2 });
  d.plot((xx) => Y(Ea(p) - Ra(p) * ((xx - gx0) / (gx1 - gx0)) * Imax), gx0, gx1, { color: th.accent, dash: [5, 4] });
  if (op.I > 0) d.dot(X(op.I), Y(op.V), 6, th.positive);
  d.text("Ayrton: V = A + Bd + (C + Dd)/I", 4.5, gy1 + 0.25, { size: 10, color: th.muted });
  panel(d, 9, 5.2, [
    `d = ${fmt(s.gap, 2)} mm   ${s.arcOn ? (s.gap < 0.05 ? "eletrodos encostados" : "arco aceso") : "arco apagado"}`,
    `I = ${fmt(op.I, 2)} A   V_arco = ${fmt(op.V, 1)} V`,
    `P no arco = ${fmt(op.I * op.V, 0)} W`,
    `comprimento máximo: ${fmt(arcMaxGap(Ea(p), Ra(p)), 2)} mm`,
    "resistência negativa (dV/dI < 0):",
    "sem o reator R o arco é instável",
  ], [1]);
}

function renderCoil(d: Draw, s: DState, p: Params) {
  const th = d.theme;
  // Bobina
  d.rect(2, 5.8, 6, 1.6, { fill: th.series[1], alpha: 0.35, stroke: th.muted });
  d.rect(2.6, 6.2, 4.8, 0.8, { fill: th.muted, alpha: 0.6 });
  d.text(`secundário: ${fmt(num(p, "ratio", 100), 0)}× mais espiras`, 5, 7.7, { size: 10, color: th.muted });
  d.text("primário + núcleo de ferro", 5, 5.5, { size: 10, color: th.muted });
  // Interruptor
  d.line(8.2, 6.6, 8.9, s.open ? 7.1 : 6.6, { color: th.text, width: 3 });
  d.text(s.open ? "contato aberto" : "contato fechado", 8.6, 7.5, { size: 10, color: th.muted });
  // Centelhador
  const dg = num(p, "dg", 6);
  const gx = 4.2;
  const gy = 9.2;
  const half = (dg * 0.06) / 2;
  d.line(2, 7.4, gx - half - 0.2, gy, { color: th.muted });
  d.line(8, 7.4, 5 + half + 0.2, gy, { color: th.muted });
  d.circle(gx + 0.4 - half - 0.1, gy, 0.12, { fill: th.muted });
  d.circle(gx + 0.4 + half + 0.1, gy, 0.12, { fill: th.muted });
  if (s.flash > 0) {
    const r = rng(s.sparks);
    const pts: [number, number][] = [];
    for (let i = 0; i <= 8; i++) pts.push([gx + 0.4 - half + (2 * half * i) / 8, gy + (i % 8 ? (r() - 0.5) * 0.25 : 0)]);
    d.polyline(pts, { color: th.dark ? "#ffe9a8" : "#7a4fd8", width: 2.5 });
  }
  d.text(`centelhador d = ${fmt(dg, 1)} mm`, gx + 0.4, gy + 0.45, { size: 10 });
  // Osciloscópio (forma de onda periódica)
  const sx0 = 1;
  const sx1 = 9;
  const sy = 2.6;
  const Ib = (COIL.breakFrac * E1(p)) / COIL.R1;
  const tOn = coilBreakTime();
  const T = tOn + COIL.tOff;
  const win = 3 * T;
  const iAt = (tt: number) => {
    const ph = ((tt % T) + T) % T;
    return ph < tOn ? (E1(p) / COIL.R1) * (1 - Math.exp((-ph * COIL.R1) / COIL.L1)) : 0;
  };
  d.rect(sx0, 0.6, sx1 - sx0, 4, { stroke: th.muted, fill: th.dark ? "#0d1117" : "#f7f9fb" });
  d.plot((x) => sy + 0.4 + (1.3 * iAt(((x - sx0) / (sx1 - sx0)) * win)) / Math.max(Ib, 1e-9), sx0, sx1, { color: th.accent, n: 400 });
  for (let k = 1; k <= 3; k++) {
    const x = sx0 + ((k * T - COIL.tOff) / win) * (sx1 - sx0);
    if (x < sx1) d.line(x, sy - 1.6, x, sy + 0.2, { color: th.positive, width: 2 });
  }
  d.text("corrente no primário (azul) e pulsos de alta tensão no secundário (vermelho)", 5, 4.85, { size: 10, color: th.muted });
  const Vneed = airBreakdown(dg);
  panel(d, 9.6, 5.5, [
    `I ao abrir = ${fmt(Ib, 2)} A (t = ${fmt(tOn * 1000, 1)} ms)`,
    `V₂ = k(N₂/N₁) I √(L₁/C₁) = ${fmt(coilPeak(Ib, num(p, "ratio", 100), num(p, "C1", 1) * 1e-6) / 1000, 1)} kV`,
    `ruptura do ar em ${fmt(dg, 1)} mm: ${fmt(Vneed / 1000, 1)} kV`,
    `interruptor: ${fmt(coilFrequency(), 0)} aberturas/s`,
    `aberturas: ${s.breaks}   faíscas: ${s.sparks}`,
    "câmera lenta: 1 s = 20 ms",
  ], [1]);
}

function renderElectroscope(d: Draw, s: DState, p: Params, t: number) {
  const th = d.theme;
  const kx = 10;
  const ky = 6.5;
  d.rect(8, 1.5, 4, 4, { stroke: th.muted, fill: th.dark ? "rgba(140,170,200,0.05)" : "rgba(120,160,200,0.08)" });
  d.line(kx, ky, kx, 4.2, { color: th.muted, width: 3 });
  d.circle(kx, ky, 0.4, { fill: th.dark ? "#8d99a8" : "#c3ccd6", stroke: th.muted });
  const th0 = leafAngle(s.Q);
  const L = 1.6;
  d.line(kx, 4.2, kx - L * Math.sin(th0), 4.2 - L * Math.cos(th0), { color: th.series[5], width: 4 });
  d.line(kx, 4.2, kx + L * Math.sin(th0), 4.2 - L * Math.cos(th0), { color: th.series[5], width: 4 });
  const nq = Math.round(clamp(s.Q, 0, 20));
  for (let i = 0; i < nq; i++) d.text("+", kx + 0.55 * Math.cos((i / Math.max(nq, 1)) * 2 * Math.PI), ky + 0.55 * Math.sin((i / Math.max(nq, 1)) * 2 * Math.PI), { size: 10, color: th.positive, weight: "700" });
  d.text(`θ = ${fmt((th0 * 180) / Math.PI, 1)}°`, kx, 1.1, { size: 12, weight: "600" });
  // Fonte
  const src = Math.round(num(p, "fonte", 2));
  const sx = kx - s.srcR * 0.25;
  if (src === 1) {
    d.rect(sx - 0.15, 2, 0.3, 1.2, { fill: th.muted });
    d.polyline([[sx - 0.3, 3.2], [sx, 4.3 + 0.1 * Math.sin(t * 20)], [sx + 0.3, 3.2]], { close: true, fill: "#ff9a3c", color: "none", alpha: 0.85 });
    d.text("chama (arraste)", sx, 1.6, { size: 10, color: th.muted });
  } else if (src === 2) {
    d.rect(sx - 0.4, 6.2, 0.8, 0.6, { fill: th.series[4] ?? th.accent, stroke: th.muted });
    d.text("☢", sx, 6.5, { size: 12, color: "#fff" });
    d.text("fonte radioativa (arraste)", sx, 7.1, { size: 10, color: th.muted });
  }
  // Íons no ar (densidade ∝ log q)
  const q = ionRate(s, p);
  const n = Math.round(clamp(4 * Math.log10(q), 2, 28));
  const r = rng(7);
  for (let i = 0; i < n; i++) {
    const x0 = 8.2 + r() * 3.6;
    const y0 = 5 + r() * 3.5;
    const f = (t * 0.3 + r()) % 1;
    const neg = i % 2 === 0;
    // Íons negativos atraídos pela esfera positiva; positivos repelidos.
    const x = neg && s.Q > 0.2 ? x0 + (kx - x0) * f : x0 + 0.2 * Math.sin(t + i);
    const y = neg && s.Q > 0.2 ? y0 + (ky - y0) * f : y0 + 0.2 * Math.cos(t + i);
    d.text(neg ? "−" : "+", x, y, { size: 11, color: neg ? th.negative : th.positive, weight: "700" });
  }
  const I = ionCurrent(q, VOL);
  panel(d, 0.6, 9.4, [
    `ionização: q = ${q < 1e3 ? fmt(q, 0) : q.toExponential(2).replace(".", ",")} pares/(cm³·s)`,
    `corrente de saturação: I = e q V = ${fmt(I * 1e12, 3)} pA`,
    `Q = ${fmt(s.Q, 2)} nC (descarga linear: dQ/dt = −I)`,
    `tempo para descarregar: ${s.Q > 0 && I > 0 ? fmt((s.Q * 1e-9) / I / 60, 1) + " min" : "—"}`,
    `t = ${fmt(s.clock / 60, 1)} min (1 s = 100 s)`,
    `distância da fonte: ${fmt(s.srcR, 0)} cm`,
  ], [2]);
}

// ---------------------------------------------------------------------------
// Simulação
// ---------------------------------------------------------------------------

const MODES = [
  "Tubo de descarga e bomba de vácuo",
  "Curva tensão–corrente e lâmpada neon pisca-pisca",
  "Tubo de Crookes: raios catódicos e ímã",
  "Lâmpadas neon e fluorescente (colisões)",
  "Arco elétrico",
  "Bobina de indução",
  "Ionização descarrega o eletroscópio",
];

export const descargasGases = defineSim<DState>({
  id: "descargas-gases",
  title: "Descargas em gases e no vácuo",
  course: "FG III",
  topic: "Corrente elétrica",
  priority: "P2",
  summary:
    "Esvazie um tubo e veja as regiões da descarga surgirem pela lei de Paschen, percorra a curva V–I até o arco, desvie raios catódicos com um ímã, conte os fótons de uma lâmpada neon ou fluorescente e descarregue um eletroscópio ionizando o ar.",
  equations: [
    String.raw`V_{\text{rup}} = \frac{B\,pd}{\ln(A\,pd) - \ln\ln(1 + 1/\gamma)},\qquad \lambda = \frac{kT}{\sqrt2\,\pi d^2 p}`,
    String.raw`T = RC\ln\frac{E - V_e}{E - V_b}`,
    String.raw`r = \frac{p}{eB},\qquad E_{\text{fóton}} = \frac{hc}{\lambda}`,
    String.raw`V_{\text{arco}} = A + Bd + \frac{C + Dd}{I}`,
    String.raw`V_2 \approx k\frac{N_2}{N_1} I\sqrt{L_1/C_1},\qquad I_{\text{ion}} = e\,q\,V`,
  ],
  liveEquations(s, p) {
    switch (mode(p)) {
      case 0:
        return [String.raw`V_{\text{rup}}(p d = ${texNum(s.p * tubeD(p))}\ \text{Torr·cm}) = ${texNum(breakdown(s, p))}\ \text{V}`];
      case 1: {
        const op = neonPoint(s, p);
        return [String.raw`V = ${texNum(op.V)}\ \text{V},\ I = ${texNum(op.I)}\ \text{A},\quad T_{\text{teor}} = ${texNum(relaxationPeriod(En(p), Rn(p), Cn(p), NEON_VB, V_EXT))}\ \text{s}`];
      }
      case 2:
        return [String.raw`\Delta y_{\text{sombra}} = ${texNum(shadowShift(s, p) * 1000)}\ \text{mm},\quad v = ${texNum(electronSpeed(num(p, "Va", 5) * 1e3))}\ \text{m/s}`];
      case 3:
        return [String.raw`\eta_{\text{visível}} = \frac{\sum h\nu}{\sum eE\Delta x} = ${texNum(100 * lampEfficiency(s))}\ \%`];
      case 4: {
        const op = arcState(s, p);
        return [String.raw`I = ${texNum(op.I)}\ \text{A},\ V = ${texNum(op.V)}\ \text{V},\ d_{\text{máx}} = ${texNum(arcMaxGap(Ea(p), Ra(p)))}\ \text{mm}`];
      }
      case 5:
        return [String.raw`V_2 = ${texNum(s.V2 / 1000)}\ \text{kV},\ V_{\text{rup}} = ${texNum(airBreakdown(num(p, "dg", 6)) / 1000)}\ \text{kV}`];
      default:
        return [String.raw`I = e q V = ${texNum(ionCurrent(ionRate(s, p), VOL) * 1e12)}\ \text{pA},\quad \frac{dQ}{dt} = -I`];
    }
  },

  params: [
    { key: "modo", label: "Experimento", unit: "", min: 0, max: 6, step: 1, default: 0, options: MODES.map((label, value) => ({ value, label })) },
    { key: "gas", label: "Gás do tubo", unit: "", min: 0, max: 4, step: 1, default: 0, options: GASES.map((g, value) => ({ value, label: g.name })) },
    { key: "dTubo", label: "Distância entre eletrodos", unit: "cm", min: 5, max: 50, step: 1, default: 30 },
    { key: "p0", label: "Pressão inicial", unit: "Torr", min: 0.001, max: 760, step: 0.001, default: 760, log: true },
    { key: "Vt", label: "Tensão no tubo", unit: "kV", min: 0.2, max: 10, step: 0.1, default: 3, live: true },
    { key: "E", label: "Fonte da lâmpada neon", unit: "V", min: 0, max: 300, step: 1, default: 120, live: true },
    { key: "R", label: "Resistor em série", unit: "MΩ", min: 0.001, max: 10, step: 0.001, default: 1, log: true, live: true },
    { key: "C", label: "Capacitor em paralelo (0 = sem)", unit: "μF", min: 0, max: 2, step: 0.05, default: 0, live: true },
    { key: "Va", label: "Tensão aceleradora (Crookes)", unit: "kV", min: 1, max: 20, step: 0.5, default: 5, live: true },
    { key: "B0", label: "Campo do ímã (+ = polo N à frente)", unit: "mT", min: -20, max: 20, step: 0.5, default: 3, live: true },
    { key: "lampGas", label: "Gás da lâmpada", unit: "", min: 0, max: 1, step: 1, default: 1, options: LAMP_GASES.map((g, value) => ({ value, label: g.name })) },
    { key: "fosforo", label: "Revestimento de fósforo", unit: "", min: 0, max: 1, step: 1, default: 1, live: true, options: [{ value: 1, label: "Com fósforo (fluorescente)" }, { value: 0, label: "Sem fósforo (germicida)" }] },
    { key: "Vl", label: "Tensão na lâmpada", unit: "V", min: 50, max: 600, step: 10, default: 200, live: true },
    { key: "pl", label: "Pressão na lâmpada", unit: "Torr", min: 0.01, max: 10, step: 0.01, default: 0.2, log: true, live: true },
    { key: "Ea", label: "Fonte do arco", unit: "V", min: 60, max: 250, step: 1, default: 120, live: true },
    { key: "Ra", label: "Reator (resistor) do arco", unit: "Ω", min: 1, max: 40, step: 0.5, default: 6, live: true },
    { key: "E1", label: "Bateria do primário", unit: "V", min: 2, max: 12, step: 0.5, default: 6, live: true },
    { key: "ratio", label: "Razão de espiras N₂/N₁", unit: "", min: 20, max: 500, step: 10, default: 100, live: true },
    { key: "C1", label: "Capacitor do interruptor", unit: "μF", min: 0.1, max: 5, step: 0.1, default: 1, live: true },
    { key: "dg", label: "Abertura do centelhador", unit: "mm", min: 1, max: 40, step: 0.5, default: 6, live: true },
    { key: "Q0", label: "Carga inicial do eletroscópio", unit: "nC", min: 2, max: 20, step: 0.5, default: 10 },
    { key: "fonte", label: "Agente ionizante", unit: "", min: 0, max: 2, step: 1, default: 2, live: true, options: [{ value: 0, label: "Nenhum (radiação de fundo)" }, { value: 1, label: "Chama" }, { value: 2, label: "Fonte radioativa" }] },
  ],

  observables: [
    { key: "p", label: "Pressão no tubo", unit: "Torr", value: (s) => s.p },
    { key: "Vrup", label: "Tensão de ruptura (Paschen)", unit: "V", value: (s, p) => Math.min(breakdown(s, p), 1e9) },
    { key: "dc", label: "Espaço escuro catódico", unit: "cm", value: (s, p) => darkSpace(s, p) },
    {
      key: "V",
      label: "Tensão no dispositivo",
      unit: "V",
      value: (s, p) => (mode(p) === 1 ? neonPoint(s, p).V : mode(p) === 4 ? arcState(s, p).V : mode(p) === 5 ? s.V2 : 0),
    },
    {
      key: "I",
      label: "Corrente",
      unit: "A",
      value: (s, p) => (mode(p) === 1 ? neonPoint(s, p).I : mode(p) === 4 ? arcState(s, p).I : mode(p) === 5 ? s.I1 : mode(p) === 6 ? ionCurrent(ionRate(s, p), VOL) : 0),
    },
    { key: "n", label: "Piscadas / faíscas", unit: "", value: (s, p) => (mode(p) === 1 ? s.flashes : s.sparks) },
    { key: "T", label: "Período da lâmpada neon", unit: "s", value: (s) => s.period },
    { key: "dy", label: "Deslocamento da sombra", unit: "mm", value: (s, p) => (mode(p) === 2 ? shadowShift(s, p) * 1000 : 0) },
    { key: "eta", label: "Energia convertida em luz visível", unit: "%", value: (s) => 100 * lampEfficiency(s) },
    { key: "fotons", label: "Fótons emitidos", unit: "", value: (s) => s.counts.reduce((a, c) => a + c, 0) },
    { key: "gap", label: "Comprimento do arco", unit: "mm", value: (s) => s.gap },
    { key: "Q", label: "Carga do eletroscópio", unit: "nC", value: (s) => s.Q },
    { key: "theta", label: "Abertura das folhas", unit: "°", value: (s) => (leafAngle(s.Q) * 180) / Math.PI },
    { key: "tm", label: "Tempo do processo", unit: "s", value: (s) => s.clock },
  ],
  chart: { x: "t", y: "p" },

  scenarios: [
    {
      id: "bomba",
      label: "Esvaziando o tubo",
      params: { modo: 0, gas: 0, dTubo: 30, p0: 760, Vt: 3 },
      guide: `### Do ar à luz e aos raios catódicos
1. A 760 Torr, 3 kV não rompem 30 cm de ar ($V_{\\text{rup}}$ ~ 1 MV). Com a bomba ligada, a pressão cai exponencialmente.
2. Perto de 10 Torr aparece um **filete** de descarga; abaixo de ~1 Torr o tubo se enche de luz: **coluna positiva**.
3. Continue: o **espaço escuro de Crookes** cresce como $d_c \\propto 1/p$ e empurra a luz para o ânodo.
4. Quando $d_c$ fica maior que o tubo, só restam os **raios catódicos**: o vidro do outro lado fluoresce em verde.
5. Abaixo de ~10⁻² Torr a ruptura volta a ficar difícil (lado esquerdo da curva de Paschen).
6. Troque o gás: neônio (laranja), hidrogênio (rosa), mercúrio (azul).`,
      predict: [
        {
          question: "Ao reduzir a pressão de 1 Torr para 0,1 Torr, o espaço escuro catódico…",
          options: ["Fica 10 vezes maior", "Fica 10 vezes menor", "Não muda"],
          answer: 0,
          explanation: "A espessura das regiões escala com o livre caminho médio, λ ∝ 1/p: p·d_c é constante.",
        },
      ],
    },
    {
      id: "neon",
      label: "Neon pisca-pisca",
      params: { modo: 1, E: 120, R: 1, C: 0.5 },
      guide: `### Oscilador de relaxação
1. Primeiro com **C = 0**: varie $E$ e $R$ e veja a reta de carga cortar a característica. Ponto vermelho = ponto de operação.
2. A lâmpada só acende quando $E > 90$ V e, acesa, mantém ~60 V: **histerese**.
3. Com **C = 0,5 μF** o capacitor carrega por $R$ até 90 V, a lâmpada dispara e o descarrega até ~60 V: pisca.
4. Meça o período e compare com $T = RC\\ln\\frac{E - V_e}{E - V_b}$. Dobre $R$.`,
      predict: [
        {
          question: "Dobrando R no pisca-pisca de neon, o período…",
          options: ["Dobra", "Cai pela metade", "Não muda", "Quadruplica"],
          answer: 0,
          explanation: "A carga do capacitor tem constante de tempo RC; o logaritmo depende só de E, V_b e V_e. T ∝ R.",
        },
      ],
    },
    {
      id: "crookes",
      label: "Cruz de Malta e ímã",
      params: { modo: 2, Va: 5, B0: 3 },
      guide: `### Raios catódicos
1. Sem ímã ($B = 0$), a sombra da cruz é nítida e centrada: os raios andam em linha reta.
2. Arraste o ímã para perto do tubo entre a cruz e a tela: a sombra se desloca. Inverta o polo.
3. Aumente a tensão: elétrons mais rápidos ($r = p/eB$ maior) desviam menos.
4. Leia o deslocamento da sombra (mm) e a regra da mão: força $q\\,\\vec v \\times \\vec B$ com $q < 0$.`,
      predict: [
        {
          question: "Com o polo N voltado para você (B saindo da tela) e os elétrons indo para a direita, a sombra se desloca para…",
          options: ["Cima", "Baixo", "Não se desloca"],
          answer: 0,
          explanation: "F = q v × B: v = +x, B = +z → v × B = −y; com q negativo, F aponta para +y (para cima).",
        },
      ],
    },
    {
      id: "fluorescente",
      label: "Fluorescente com e sem fósforo",
      params: { modo: 3, lampGas: 1, fosforo: 1, Vl: 200, pl: 0.2 },
      guide: `### Como a lâmpada produz luz
1. Os elétrons ganham energia do campo entre colisões; ao passar do limiar (4,9 eV no mercúrio) excitam um átomo, que emite um fóton.
2. A maior parte vira **ultravioleta de 254 nm**, invisível. Tire o fósforo: a lâmpada fica fraca e azulada (germicida).
3. Com fósforo, cada UV vira um fóton visível (450, 545, 611 nm): perde-se a diferença $h\\nu_{UV} - h\\nu_{vis}$.
4. Troque para **neônio**: limiar de 18,7 eV e linhas laranja-vermelhas. Compare a eficiência.`,
      predict: [
        {
          question: "Retirando o pó de fósforo de uma lâmpada fluorescente, ela…",
          options: ["Fica muito mais fraca", "Fica mais forte", "Continua igual"],
          answer: 0,
          explanation: "A descarga no mercúrio emite principalmente UV de 254 nm, que não enxergamos. É o fósforo que converte esse UV em luz visível.",
        },
      ],
    },
    {
      id: "arco",
      label: "Arco elétrico",
      params: { modo: 4, Ea: 120, Ra: 8 },
      guide: `### Arco voltaico
1. Use *Acender o arco*: os carvões se tocam ($I = E/R$) e se afastam 2 mm.
2. Arraste o eletrodo da direita: $V_{\\text{arco}}$ cresce com $d$ e o arco **apaga** quando a reta de carga deixa de cortar a curva de Ayrton.
3. A curva tem inclinação negativa: sem o reator $R$ não há ponto estável.
4. Compare o comprimento máximo previsto com o observado e mude $R$ e $E$.`,
    },
    {
      id: "bobina",
      label: "Bobina de indução",
      params: { modo: 5, E1: 6, ratio: 100, C1: 1, dg: 6 },
      guide: `### Bobina de Ruhmkorff
1. O interruptor abre o primário quando a corrente atinge 80 % de $E/R$; a variação brusca induz alta tensão no secundário.
2. O capacitor sobre o contato limita a faísca no interruptor: $V_2 \\approx k\\frac{N_2}{N_1}I\\sqrt{L_1/C_1}$.
3. Abra o centelhador até as faíscas pararem: compare com a ruptura do ar (Paschen).
4. Aumente $N_2/N_1$ ou diminua $C_1$ e repita.`,
    },
    {
      id: "ionizacao",
      label: "Ionização e eletroscópio",
      params: { modo: 6, Q0: 10, fonte: 2 },
      guide: `### O ar ionizado conduz
1. Sem agente ionizante a carga escapa muito devagar (radiação de fundo, ~10 pares/cm³·s).
2. Aproxime a **fonte radioativa** ou a **chama**: os íons de sinal oposto são atraídos e neutralizam o eletroscópio.
3. Na saturação a corrente $I = eqV$ é constante: a carga cai **linearmente** com o tempo (veja o gráfico de Q).
4. Dobre a distância: $q$ cai a 1/4 e o tempo de descarga quadruplica.`,
      predict: [
        {
          question: "Com corrente de ionização constante, a carga do eletroscópio cai…",
          options: ["Linearmente com o tempo", "Exponencialmente", "De uma vez"],
          answer: 0,
          explanation: "Na saturação todos os íons produzidos são coletados: dQ/dt = −eqV, constante, até a carga acabar.",
        },
      ],
    },
  ],

  exercises: [
    {
      id: "paschen",
      prompt: "Pela lei de Paschen para o ar (A = 15 cm⁻¹Torr⁻¹, B = 365 V/(cm·Torr), γ = 0,01), qual a tensão de ruptura entre eletrodos a {d} cm sob pressão de {p} Torr?",
      vary: { d: [1, 30, 0], p: [1, 20, 0] },
      answer: { label: "Tensão", unit: "V", compute: (p) => paschenV(GASES[0]!, num(p, "p"), num(p, "d")) },
    },
    {
      id: "relaxacao",
      prompt: "Uma lâmpada neon acende em 90 V e apaga em 60 V. Ela está em paralelo com C = {C} μF, alimentada por {E} V através de R = {R} MΩ. Qual o período das piscadas (desprezando o tempo de descarga)?",
      vary: { C: [0.1, 2, 1], E: [100, 250, 0], R: [0.5, 5, 1] },
      answer: { label: "Período", unit: "s", compute: (p) => relaxationPeriod(num(p, "E"), num(p, "R") * 1e6, num(p, "C") * 1e-6, 90, 60) },
    },
    {
      id: "raio",
      prompt: "Elétrons acelerados por {V} V entram num campo magnético uniforme de {B} mT perpendicular à velocidade. Qual o raio da trajetória? (Trate classicamente: v = √(2eV/m).)",
      vary: { V: [500, 5000, 0], B: [0.5, 5, 1] },
      answer: { label: "Raio", unit: "cm", compute: (p) => (Math.sqrt((2 * 9.1093837015e-31 * num(p, "V")) / 1.602176634e-19) / (num(p, "B") * 1e-3)) * 100 },
      tolerance: 0.02,
    },
  ],

  init(p) {
    const m = mode(p);
    return {
      clock: 0,
      p: num(p, "p0", 760),
      pump: m === 0,
      tPump: 0,
      pStart: num(p, "p0", 760),
      Vc: 0,
      lit: false,
      flashes: 0,
      lastFlash: 0,
      period: 0,
      mx: 0.27,
      my: 0.09,
      ex: Array.from({ length: N_E }, (_, i) => (i / N_E) * LAMP_L),
      ek: new Array<number>(N_E).fill(0.5),
      ed: new Array<number>(N_E).fill(1),
      photons: [],
      counts: new Array<number>(ALL_LINES.length).fill(0),
      Ein: 0,
      Evis: 0,
      Euv: 0,
      seed: 12345,
      gap: 2,
      arcOn: false,
      I1: 0,
      open: false,
      tPhase: 0,
      V2: 0,
      breaks: 0,
      sparks: 0,
      flash: 0,
      Q: num(p, "Q0", 10),
      srcR: 20,
      drag: null,
    };
  },

  step(s0, p, t, dt) {
    const m = mode(p);
    const h = dt * (SCALE[m] ?? 1);
    let s: DState = { ...s0, clock: s0.clock + h, flash: Math.max(0, s0.flash - dt) };
    if (m === 0) {
      if (s.pump) {
        s.tPump += h;
        s.p = pumpPressure(s.pStart, P_ULT, PUMP_TAU, s.tPump);
      }
    } else if (m === 1) {
      const R = Rn(p);
      const C = Cn(p);
      const E = En(p);
      if (C > 0) {
        const on = s.lit ? 1 : 0;
        const a = E / (R * C) + (on * NEON_VN) / (R_LAMP * C);
        const b = 1 / (R * C) + on / (R_LAMP * C);
        const Vinf = a / b;
        s.Vc = Vinf + (s.Vc - Vinf) * Math.exp(-b * h);
        if (!s.lit && s.Vc >= NEON_VB) {
          s.lit = true;
          s.period = s.flashes > 0 ? t + dt - s.lastFlash : 0;
          s.lastFlash = t + dt;
          s.flashes += 1;
        } else if (s.lit && s.Vc <= V_EXT) s.lit = false;
      } else {
        const pts = operatingPoints(E, R).filter((o) => o.stable);
        if (!s.lit && E >= NEON_VB) s.lit = true;
        if (s.lit && !pts.some((o) => o.I > 1e-6)) s.lit = false;
      }
    } else if (m === 3) {
      s = lampStep(s, p);
    } else if (m === 4) {
      if (s.gap < 0.05) s.arcOn = true;
      else if (s.arcOn && !Number.isFinite(arcCurrent(Ea(p), Ra(p), s.gap))) s.arcOn = false;
    } else if (m === 5) {
      if (!s.open) {
        const Iinf = E1(p) / COIL.R1;
        s.I1 = Iinf + (s.I1 - Iinf) * Math.exp((-h * COIL.R1) / COIL.L1);
        if (s.I1 >= COIL.breakFrac * Iinf) {
          s.V2 = coilPeak(s.I1, num(p, "ratio", 100), num(p, "C1", 1) * 1e-6);
          s.breaks += 1;
          if (s.V2 >= airBreakdown(num(p, "dg", 6))) {
            s.sparks += 1;
            s.flash = 0.08;
          }
          s.open = true;
          s.tPhase = 0;
          s.I1 = 0;
        }
      } else {
        s.tPhase += h;
        if (s.tPhase >= COIL.tOff) s.open = false;
      }
    } else if (m === 6) {
      const I = ionCurrent(ionRate(s, p), VOL);
      s.Q = Math.max(0, s.Q - I * 1e9 * h);
    }
    return s;
  },
  dt: 0.005,
  sampleEvery: 4,
  maxSamples: 6000,

  pointer: {
    down(s, p, pt) {
      const m = mode(p);
      if (m === 2 && Math.hypot(pt.x - (1 + s.mx * 30), pt.y - (6 + s.my * 30)) < 0.8) return { ...s, drag: "ima" };
      if (m === 4 && Math.abs(pt.x - (5 + s.gap * 0.3 + 1.5)) < 1.7 && Math.abs(pt.y - 7) < 0.6) return { ...s, drag: "eletrodo" };
      if (m === 6 && Math.abs(pt.x - (10 - s.srcR * 0.25)) < 0.7 && pt.y < 7.5) return { ...s, drag: "fonte" };
      return undefined;
    },
    move(s, _p, pt, dragging) {
      if (!dragging || !s.drag) return undefined;
      if (s.drag === "ima") return { ...s, mx: clamp((pt.x - 1) / 30, 0, 0.42), my: clamp((pt.y - 6) / 30, -0.12, 0.12) };
      if (s.drag === "eletrodo") return { ...s, gap: clamp((pt.x - 1.5 - 5) / 0.3, 0, 25) };
      return { ...s, srcR: clamp((10 - pt.x) / 0.25, 3, 36) };
    },
    up: (s) => (s.drag ? { ...s, drag: null } : undefined),
    cursor(s, p, pt) {
      const m = mode(p);
      if (m === 2 && Math.hypot(pt.x - (1 + s.mx * 30), pt.y - (6 + s.my * 30)) < 0.8) return "grab";
      if (m === 4 && Math.abs(pt.x - (5 + s.gap * 0.3 + 1.5)) < 1.7 && Math.abs(pt.y - 7) < 0.6) return "ew-resize";
      if (m === 6 && Math.abs(pt.x - (10 - s.srcR * 0.25)) < 0.7) return "ew-resize";
      return undefined;
    },
  },

  actions: [
    { id: "bomba", label: "Bomba de vácuo (ligar/desligar)", run: (s) => ({ ...s, pump: !s.pump, pStart: s.p, tPump: 0 }), active: (s) => s.pump },
    { id: "ar", label: "Admitir ar (760 Torr)", run: (s) => ({ ...s, p: 760, pStart: 760, tPump: 0 }) },
    { id: "acender", label: "Acender o arco (encostar e afastar 2 mm)", run: (s) => ({ ...s, arcOn: true, gap: 2 }) },
    { id: "zerar", label: "Zerar contagens", run: (s) => ({ ...s, counts: s.counts.map(() => 0), Ein: 0, Evis: 0, Euv: 0, flashes: 0, period: 0, breaks: 0, sparks: 0 }) },
    { id: "recarregar", label: "Recarregar o eletroscópio", run: (s, p) => ({ ...s, Q: num(p, "Q0", 10) }) },
  ],

  viewport: () => ({ xMin: 0, xMax: 16, yMin: 0, yMax: 10, unit: "" }),

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const { state: s, params: p, t } = frame;
    [renderTube, renderNeon, renderCrookes, renderLamp, renderArc, renderCoil, renderElectroscope][mode(p)]?.(d, s, p, t);
  },
});

export default descargasGases;
