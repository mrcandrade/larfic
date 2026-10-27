import { clamp, defineSim, draw, num, texNum, type Draw, type Params } from "@fisilab/core";
import { fmt, panel } from "./panel.ts";
import {
  ANODES,
  BONE,
  CRYSTALS,
  FILTERS,
  GAPS_1914,
  HC,
  KALPHA,
  LEAD,
  MATERIALS,
  WATER,
  anodeOf,
  braggAngle,
  braggRate,
  continuum,
  efficiency,
  energySpectrum,
  filterTransmission,
  gaussianFrom,
  hvl,
  lambdaMin,
  lambdaOf,
  meanEnergy,
  moseleyE,
  moseleyFit,
  mu,
  nextRandom,
  spectrum,
  sqrtF,
  transmitted,
  type EnergySpectrum,
  type Material,
} from "./physics.ts";

export * from "./physics.ts";

export interface XState {
  seed: number;
  /** Modo 0: histograma de fótons detectados por λ e total. */
  hist: number[];
  nDet: number;
  acc: number;
  /** Instantes de partida dos elétrons e fótons em voo [t, λ]. */
  elec: number[];
  phot: [number, number][];
  /** Modo 1: ângulo do cristal (graus), varredura e pontos medidos [θ, taxa]. */
  theta: number;
  scanning: boolean;
  scan: number[];
  /** Modo 2: elemento escolhido. */
  Z: number;
  /** Modo 3: posição x (cm) do perfil e exposição acumulada (mA·s). */
  profX: number;
  expo: number;
  drag: null | "arm" | "prof";
}

const NB = 100;
const VIEW = { xMin: -17, xMax: 17, yMin: -9.5, yMax: 9.5 };
const TH_MIN = 3;
const TH_MAX = 35;

const mode = (p: Params) => Math.round(num(p, "modo"));
const tube = (p: Params) => ({ V: num(p, "V", 35), I: num(p, "I", 1), an: anodeOf(num(p, "anodo", 0)), filt: FILTERS[Math.round(num(p, "filtro", 0))] ?? null });
const crystal = (p: Params) => CRYSTALS[Math.round(num(p, "cristal", 0))] ?? CRYSTALS[0]!;
const lamMax = (p: Params) => [200, 100, 160][Math.round(num(p, "anodo", 0))] ?? 200;
const sigmaTh = (p: Params) => num(p, "abertura", 0.15);
const material = (p: Params): Material => MATERIALS[Math.round(num(p, "material", 2))] ?? MATERIALS[2]!;

/** Espectro observado (com filtro) em λ (pm). */
export function observedSpectrum(p: Params, lam: number, sigma = 0.6): number {
  const { V, I, an, filt } = tube(p);
  return spectrum(lam, V, I, an, sigma) * filterTransmission(filt, HC / lam);
}

// Distribuição acumulada para sortear fótons (cache por parâmetros).
let cdfKey = "";
let cdf: number[] = [];
function sampleLambda(s: { seed: number }, p: Params): number {
  const lm = lamMax(p);
  const key = [p.V, p.anodo, p.filtro, lm].join("|");
  if (key !== cdfKey) {
    cdfKey = key;
    cdf = [];
    let acc = 0;
    for (let i = 0; i < 800; i++) {
      acc += observedSpectrum(p, ((i + 0.5) * lm) / 800, 0.8) * ((i + 0.5) * lm) / 800; // fótons ∝ I·λ
      cdf.push(acc);
    }
  }
  const tot = cdf[cdf.length - 1]!;
  if (!(tot > 0)) return NaN;
  const u = nextRandom(s) * tot;
  let lo = 0;
  let hi = cdf.length - 1;
  while (lo < hi) {
    const m = (lo + hi) >> 1;
    if (cdf[m]! < u) lo = m + 1;
    else hi = m;
  }
  return ((lo + nextRandom(s)) * lm) / 800;
}

export const braggRateP = (p: Params, th: number) => {
  const { V, I, an, filt } = tube(p);
  return braggRate(th, V, I, an, crystal(p).d, sigmaTh(p), filt);
};

// ---------- Radiografia ----------
const ARM = { R: 3.5, x0: -6.5, x1: 6.5 };
const BONES = [
  { y: 1.3, R: 0.95, r: 0.45 },
  { y: -1.35, R: 0.75, r: 0.32 },
];
const PELLET = { x: 3, y: 0, r: 0.5 };
const chord = (R: number, d: number) => (Math.abs(d) < R ? 2 * Math.sqrt(R * R - d * d) : 0);

/** Espessuras (cm) de tecido, osso e chumbo atravessadas no ponto (x, y) do detector. */
export function pathLengths(x: number, y: number, pellet: boolean): { tissue: number; bone: number; lead: number } {
  if (x < ARM.x0 - ARM.R || x > ARM.x1 + ARM.R) return { tissue: 0, bone: 0, lead: 0 };
  // braço: cilindro com extremidades arredondadas (cápsula)
  const dx = x < ARM.x0 ? ARM.x0 - x : x > ARM.x1 ? x - ARM.x1 : 0;
  const Reff = dx > 0 ? Math.sqrt(Math.max(0, ARM.R * ARM.R - dx * dx)) : ARM.R;
  let tissue = chord(Reff, y);
  let bone = 0;
  if (x > ARM.x0 + 0.5 && x < ARM.x1 - 0.5)
    for (const b of BONES) {
      const t = chord(b.R, y - b.y) - chord(b.r, y - b.y);
      bone += t;
      tissue -= t;
    }
  let lead = 0;
  if (pellet) {
    const r2 = (x - PELLET.x) ** 2 + (y - PELLET.y) ** 2;
    if (r2 < PELLET.r ** 2) {
      lead = 2 * Math.sqrt(PELLET.r ** 2 - r2);
      tissue = Math.max(0, tissue - lead);
    }
  }
  return { tissue: Math.max(0, tissue), bone, lead };
}

const beam = (p: Params): EnergySpectrum => {
  const { V, I, an } = tube(p);
  return energySpectrum(V, I, an, num(p, "al", 2.5));
};

/** Contraste osso/tecido no centro do braço: (T_tecido − T_osso)/T_tecido. */
export function boneContrast(p: Params): number {
  const sp = beam(p);
  const yb = BONES[0]!.y + 0.6;
  const ts = transmitted(sp, [[WATER, chord(ARM.R, yb)]]);
  const L = pathLengths(0, yb, false);
  const tb = transmitted(sp, [[WATER, L.tissue], [BONE, L.bone]]);
  return ts > 0 ? (ts - tb) / ts : 0;
}

/** Dose relativa na pele para o mesmo sinal no detector atrás do braço (u. arb., ≈ 1/T). */
export function relativeDose(p: Params): number {
  const T = transmitted(beam(p), [[WATER, 2 * ARM.R]]);
  return T > 0 ? 0.01 / T : 0;
}

let imgKey = "";
let img: number[] = [];
const IW = 128;
const IH = 80;
const IMG = { x0: -8, x1: 8, y0: -5, y1: 5 };
function image(p: Params): number[] {
  const key = [p.V, p.anodo, p.al, p.objeto].join("|");
  if (key === imgKey) return img;
  imgKey = key;
  const sp = beam(p);
  const pel = num(p, "objeto") >= 0.5;
  // pré-calcula μ por energia
  const mw = sp.E.map((e) => mu(WATER, e));
  const mb = sp.E.map((e) => mu(BONE, e));
  const ml = sp.E.map((e) => mu(LEAD, e));
  const w = sp.E.map((e, k) => sp.N[k]! * e);
  const W = w.reduce((a, b) => a + b, 0) || 1;
  img = [];
  for (let j = 0; j < IH; j++)
    for (let i = 0; i < IW; i++) {
      const x = IMG.x0 + ((i + 0.5) * (IMG.x1 - IMG.x0)) / IW;
      const y = IMG.y0 + ((j + 0.5) * (IMG.y1 - IMG.y0)) / IH;
      const L = pathLengths(x, y, pel);
      let T = 0;
      for (let k = 0; k < w.length; k++) T += w[k]! * Math.exp(-(mw[k]! * L.tissue + mb[k]! * L.bone + ml[k]! * L.lead));
      img.push(T / W);
    }
  return img;
}
/** Ruído gaussiano fixo por pixel (semente pelo índice). */
const pixNoise = (i: number) => {
  const st = { seed: (i * 2654435761) >>> 0 };
  return gaussianFrom(st);
};

// ---------- Desenho ----------

function drawTube(d: Draw, s: XState, p: Params, t: number) {
  const th = d.theme;
  const { V, I } = tube(p);
  // envelope de vidro
  d.rect(-16.3, 2.2, 12.6, 5.2, { stroke: th.muted, width: 1.5, fill: th.dark ? "#1b2633" : "#eef4fb" });
  d.text("tubo a vácuo", -10, 7.8, { size: 11, color: th.muted });
  // cátodo (filamento)
  const cx = -14.6;
  d.rect(cx - 0.6, 3.6, 0.6, 2.4, { fill: th.muted });
  d.polyline([[cx, 4.2], [cx + 0.3, 4.4], [cx, 4.6], [cx + 0.3, 4.8], [cx, 5.0], [cx + 0.3, 5.2], [cx, 5.4]], { color: th.series[1]!, width: 2 });
  d.text("cátodo (−)", cx, 3.1, { size: 10, color: th.text });
  // ânodo inclinado
  const ax = -6.2;
  d.polyline([[ax, 3.3], [ax + 1.6, 3.3], [ax + 1.6, 6.4], [ax + 0.2, 6.4]], { close: true, fill: th.series[5]! + "aa", color: th.text, width: 1.2 });
  d.text(`ânodo (+): ${tube(p).an.name.split(" ")[0]}`, ax - 0.2, 2.75, { size: 10, color: th.text, align: "right" });
  // tensão
  d.line(cx - 0.3, 2.2, cx - 0.3, 1.2, { color: th.muted });
  d.line(ax + 0.8, 3.3, ax + 0.8, 1.2, { color: th.muted });
  d.line(cx - 0.3, 1.2, ax + 0.8, 1.2, { color: th.muted });
  d.rect(-11.4, 0.8, 2.6, 0.8, { fill: th.dark ? "#141a22" : "#ffffff", stroke: th.text, width: 1 });
  d.text(`${fmt(V)} kV`, -10.1, 1.2, { size: 11, weight: "700" });
  d.text(`${fmt(I)} mA`, -7.6, 1.6, { size: 10, color: th.muted, align: "left" });
  // elétrons
  for (const tb of s.elec) {
    const u = (t - tb) * 1.6;
    if (u < 0 || u > 1) continue;
    const x = cx + 0.4 + u * u * (ax - cx - 0.3);
    d.dot(x, 4.8, 3, th.negative);
  }
  d.arrowPx(-11, 5.6, 1, 0, 40, { color: th.negative, width: 1.5 });
  d.text("elétrons: E = eV", -10.4, 6.2, { size: 10, color: th.negative });
  // fótons saindo pela janela
  d.rect(-6.0, 2.05, 1.2, 0.3, { fill: th.accent, alpha: 0.6 });
  d.text("janela", -4.2, 1.85, { size: 9, color: th.muted, align: "left" });
  for (const [tb, lam] of s.phot) {
    const u = (t - tb) * 1.3;
    if (u < 0 || u > 1) continue;
    const y0 = 4.6 - u * 4.6;
    const k = 2 * Math.PI / Math.max(0.15, (lam / lamMax(p)) * 1.2);
    const pts: [number, number][] = [];
    for (let i = 0; i <= 12; i++) {
      const yy = y0 - (i / 12) * 0.9;
      pts.push([-5.4 + 0.12 * Math.sin(k * yy), yy]);
    }
    d.polyline(pts, { color: th.series[4]!, width: 1.4 });
  }
  d.arrow(-5.4, 0.6, 0, -1.2, { color: th.series[4]!, width: 1.5 });
  d.text("raios X → detector", -5.2, -0.9, { size: 10, color: th.series[4]!, align: "left" });
}

function drawShells(d: Draw, p: Params, x0: number, y0: number) {
  const th = d.theme;
  const an = tube(p).an;
  const { V } = tube(p);
  d.text(`Linhas características do ${an.name.split(" ")[0]}`, x0, y0 + 0.9, { size: 11, weight: "700", align: "left" });
  const lv = [
    { n: "M", y: y0 - 0.5 },
    { n: "L", y: y0 - 1.6 },
    { n: "K", y: y0 - 5.6 },
  ];
  for (const l of lv) {
    d.line(x0 + 0.6, l.y, x0 + 6.5, l.y, { color: th.text, width: 2 });
    d.text(l.n, x0 + 0.2, l.y, { size: 11, weight: "700" });
  }
  const ka = an.lines.find((l) => l.name === "Kα")!;
  const kb = an.lines.find((l) => l.name === "Kβ")!;
  const on = V > ka.edge;
  d.arrow(x0 + 2.2, lv[1]!.y, 0, lv[2]!.y - lv[1]!.y, { color: on ? th.series[1]! : th.muted, width: 2 });
  d.arrow(x0 + 4.2, lv[0]!.y, 0, lv[2]!.y - lv[0]!.y, { color: on ? th.series[2]! : th.muted, width: 2 });
  d.text(`Kα ${fmt(ka.E, 4)} keV`, x0 + 2.3, y0 - 3.2, { size: 10, align: "left", color: th.series[1]! });
  d.text(`Kβ ${fmt(kb.E, 4)} keV`, x0 + 4.3, y0 - 4.2, { size: 10, align: "left", color: th.series[2]! });
  d.text(
    on ? `V > ${fmt(ka.edge, 4)} kV: o elétron arranca elétrons da camada K` : `V < ${fmt(ka.edge, 4)} kV: não há energia para ionizar a camada K`,
    x0,
    lv[2]!.y - 0.7,
    { size: 10, align: "left", color: on ? th.text : th.negative },
  );
}

function drawMode0(d: Draw, s: XState, p: Params, t: number) {
  const th = d.theme;
  drawTube(d, s, p, t);
  drawShells(d, p, -16.3, -1.6);
  const { V, I, an } = tube(p);
  const lm = lamMax(p);
  const l0 = lambdaMin(V);
  const box = { x0: 1.2, y0: -7.6, x1: 16.4, y1: 6.6 };
  let ymax = 0;
  for (let i = 1; i <= 400; i++) ymax = Math.max(ymax, observedSpectrum(p, (i * lm) / 400, 0.6));
  ymax = ymax > 0 ? ymax * 1.08 : 1;
  const pn = panel(d, box, { min: 0, max: lm }, { min: 0, max: ymax });
  pn.frame({ xlabel: "λ (pm)", ylabel: "intensidade I(λ) (u. arb.)" });
  // histograma medido, normalizado à mesma área
  const dl = lm / NB;
  let area = 0;
  for (let i = 1; i <= 800; i++) area += observedSpectrum(p, (i * lm) / 800, 0.8) * (lm / 800);
  if (s.nDet > 0) {
    // contagens viram intensidade: cada fóton carrega energia hc/λ
    let eTot = 0;
    for (let i = 0; i < NB; i++) eTot += s.hist[i]! * (HC / ((i + 0.5) * dl));
    for (let i = 0; i < NB; i++) {
      const c = s.hist[i]!;
      if (!c) continue;
      const h = ((c * HC) / ((i + 0.5) * dl) / eTot) * (area / dl);
      d.rect(pn.X(i * dl), pn.Y(0), pn.X(dl) - pn.X(0), pn.Y(Math.min(h, ymax)) - pn.Y(0), { fill: th.series[4]!, alpha: 0.35 });
    }
  }
  pn.plot((x) => continuum(x, V, I, an.Z) * filterTransmission(tube(p).filt, HC / x), 0.5, lm, { color: th.muted, width: 1, dash: [4, 3], n: 300 });
  pn.plot((x) => observedSpectrum(p, x, 0.6), 0.5, lm, { color: th.accent, width: 2, n: 800 });
  // Duane–Hunt
  if (l0 < lm) {
    d.line(pn.X(l0), box.y0, pn.X(l0), box.y1, { color: th.negative, width: 1.2, dash: [5, 4] });
    d.text(`λmin = hc/eV = ${fmt(l0)} pm`, pn.X(l0), box.y1 - 0.5, { size: 11, color: th.negative, align: "left", dx: 4 });
  }
  for (const L of an.lines) {
    const lam = lambdaOf(L.E);
    if (V > L.edge && lam < lm) d.text(L.name, pn.X(lam), pn.Y(Math.min(observedSpectrum(p, lam, 0.6), ymax * 0.97)), { size: 11, weight: "700", color: th.series[1]!, dy: -9 });
  }
  d.text(`fótons detectados: ${s.nDet}   (barras roxas: contagem; azul: teoria; tracejado: só o contínuo)`, box.x0, box.y0 - 1.3, { size: 10, color: th.muted, align: "left" });
}

function drawMode1(d: Draw, s: XState, p: Params) {
  const th = d.theme;
  const cr = crystal(p);
  const T = (s.theta * Math.PI) / 180;
  const C0 = { x: -8.5, y: -3.5 };
  // fonte e colimador
  d.rect(-16.5, C0.y - 0.8, 2.4, 1.6, { fill: th.series[5]! + "66", stroke: th.text, width: 1.2 });
  d.text("tubo", -15.3, C0.y + 1.2, { size: 10, color: th.muted });
  d.line(-13.6, C0.y + 0.15, -12.4, C0.y + 0.15, { width: 3 });
  d.line(-13.6, C0.y - 0.15, -12.4, C0.y - 0.15, { width: 3 });
  d.line(-14.1, C0.y, C0.x, C0.y, { color: th.series[4]!, width: 3, alpha: 0.6 });
  // transferidor
  for (let a = 0; a <= 80; a += 10) {
    const r = (a * Math.PI) / 180;
    d.line(C0.x + 7.2 * Math.cos(r), C0.y + 7.2 * Math.sin(r), C0.x + 7.6 * Math.cos(r), C0.y + 7.6 * Math.sin(r), { color: th.muted, width: 1 });
    d.text(a === 80 ? "2θ = 80°" : `${a}°`, C0.x + 8.1 * Math.cos(r), C0.y + 8.1 * Math.sin(r), { size: 9, color: th.muted });
  }
  // cristal girado de θ
  d.box(C0.x, C0.y, 3.2, 0.5, T, { fill: th.accent + "88", stroke: th.accent, width: 1.5 });
  d.text(cr.name, C0.x + 0.6, C0.y - 1.1, { size: 10, color: th.accent });
  // feixe refletido e detector em 2θ
  const ux = Math.cos(2 * T);
  const uy = Math.sin(2 * T);
  const R = braggRateP(p, s.theta);
  d.line(C0.x, C0.y, C0.x + 6 * ux, C0.y + 6 * uy, { color: th.series[4]!, width: 1 + 3 * Math.min(1, R / 3000), alpha: 0.7 });
  d.box(C0.x + 6.6 * ux, C0.y + 6.6 * uy, 1.4, 0.9, 2 * T + Math.PI / 2, { fill: th.series[2]! + "88", stroke: th.series[2]!, width: 1.5 });
  d.text("detector (Geiger)", C0.x + 6.6 * ux + 0.8, C0.y + 6.6 * uy + 0.9, { size: 10, color: th.series[2]!, align: "left" });
  d.line(C0.x, C0.y, C0.x + 6 * ux, C0.y + 6 * uy, { color: th.muted, width: 0.8, dash: [3, 3] });
  d.text(`θ = ${fmt(s.theta, 4)}°   (detector em 2θ)`, -16.5, 7.6, { size: 13, weight: "700", align: "left" });
  d.text(`λ = 2d sen θ / n = ${fmt(2 * cr.d * Math.sin(T), 4)} pm / n`, -16.5, 6.6, { size: 11, align: "left" });
  d.text(`taxa ≈ ${fmt(R, 3)} contagens/s`, -16.5, 5.7, { size: 11, align: "left", color: th.series[2]! });
  d.text(s.scanning ? "varredura em andamento…" : "arraste o detector para girar o cristal", -16.5, 4.8, { size: 10, align: "left", color: th.muted });
  // planos atômicos (inserção)
  const ix = -16.3;
  const iy = -8.6;
  for (let k = 0; k < 3; k++) d.line(ix, iy + k * 0.8, ix + 4.6, iy + k * 0.8, { color: th.muted, width: 1 });
  for (let k = 0; k < 3; k++) for (let j = 0; j < 6; j++) d.dot(ix + 0.4 + j * 0.8, iy + k * 0.8, 2.5, j % 2 ? th.series[1]! : th.accent);
  d.text(`d = ${fmt(cr.d)} pm`, ix + 5.4, iy + 0.4, { size: 10, align: "left", color: th.muted });

  // gráfico taxa × θ
  const box = { x0: 2.0, y0: -7.6, x1: 16.4, y1: 7.2 };
  let ymax = 1;
  for (let a = TH_MIN; a <= TH_MAX; a += 0.05) ymax = Math.max(ymax, braggRateP(p, a));
  for (let i = 1; i < s.scan.length; i += 2) ymax = Math.max(ymax, s.scan[i]!);
  const log = num(p, "escala") >= 0.5;
  const pn = panel(d, box, { min: TH_MIN, max: TH_MAX }, log ? { min: 1, max: 10 ** Math.ceil(Math.log10(ymax * 1.5)), log: true } : { min: 0, max: ymax * 1.1 });
  pn.frame({ xlabel: "θ (graus)", ylabel: "contagens/s" });
  pn.plot((a) => Math.max(1e-3, braggRateP(p, a)), TH_MIN, TH_MAX, { color: th.muted, width: 1, dash: [3, 3], n: 600 });
  const pts: [number, number][] = [];
  for (let i = 0; i + 1 < s.scan.length; i += 2) pts.push([s.scan[i]!, Math.max(log ? 1 : 0, s.scan[i + 1]!)]);
  pn.line(pts, { color: th.series[2]!, width: 1.6 });
  d.line(pn.X(s.theta), box.y0, pn.X(s.theta), box.y1, { color: th.accent, width: 1, dash: [4, 3] });
  // marcas dos picos esperados
  const an = tube(p).an;
  for (const L of an.lines)
    for (let n = 1; n <= 3; n++) {
      const a = braggAngle(lambdaOf(L.E), cr.d, n);
      if (!(a > TH_MIN && a < TH_MAX) || tube(p).V <= L.edge) continue;
      const y = braggRateP(p, a);
      if (!log && y < 0.04 * ymax) continue;
      d.text(`${L.name}${n > 1 ? ` (n=${n})` : ""}`, pn.X(a), pn.Y(Math.min(Math.max(y, log ? 1.5 : 0), log ? 10 ** Math.ceil(Math.log10(ymax * 1.5)) : ymax)), { size: 10, color: th.series[1]!, dy: -9 });
    }
  const thMin = braggAngle(lambdaMin(tube(p).V), cr.d, 1);
  if (thMin > TH_MIN) {
    d.line(pn.X(thMin), box.y0, pn.X(thMin), box.y1, { color: th.negative, width: 1, dash: [5, 4] });
    d.text("λmin", pn.X(thMin), box.y0 + 0.5, { size: 10, color: th.negative, align: "left", dx: 3 });
  }
}

function drawMode2(d: Draw, s: XState) {
  const th = d.theme;
  const box = { x0: -15, y0: -7.4, x1: 3, y1: 7.4 };
  const pn = panel(d, box, { min: 18, max: 84 }, { min: 5, max: 45 });
  pn.frame({ xlabel: "número atômico Z", ylabel: "√f  (10⁸ Hz^½)" });
  const fit = moseleyFit();
  pn.plot((z) => fit.k * (z - fit.sigma), 18, 84, { color: th.series[1]!, width: 1.5 });
  pn.plot((z) => sqrtF(moseleyE(z)), 18, 84, { color: th.muted, width: 1, dash: [4, 3] });
  for (const [zs, [sym, E]] of Object.entries(KALPHA)) {
    const z = Number(zs);
    const gap = GAPS_1914.includes(z);
    d.dot(pn.X(z), pn.Y(sqrtF(E)), z === s.Z ? 6 : 3.5, gap ? th.positive : th.accent);
    if (gap) d.text(sym, pn.X(z), pn.Y(sqrtF(E)), { size: 9, color: th.positive, dx: 9, dy: 6 });
  }
  d.text("vermelho: lacunas da tabela em 1914 (Tc, Pm, Hf, Re)", box.x0 + 0.3, box.y1 - 0.5, { size: 10, color: th.positive, align: "left" });
  d.text(`laranja: ajuste √f = ${fmt(fit.k, 3)}·(Z − ${fmt(fit.sigma, 2)})   tracejado: Bohr, (Z − 1)`, box.x0 + 0.3, box.y1 - 1.2, { size: 10, color: th.muted, align: "left" });
  // elemento escolhido
  const rec = KALPHA[s.Z];
  const E = rec ? rec[1] : moseleyE(s.Z);
  const x0 = 5;
  d.text(`Z = ${s.Z}${rec ? ` (${rec[0]})` : ""}`, x0, 7, { size: 16, weight: "700", align: "left" });
  d.text(rec ? "Kα medida" : "sem dado tabelado: previsão de Moseley", x0, 6.1, { size: 10, color: th.muted, align: "left" });
  const rows = [
    `E(Kα) = ${fmt(E, 4)} keV`,
    `λ = hc/E = ${fmt(HC / E, 4)} pm`,
    `f = ${fmt((E * 1000 * 1.602176634e-19) / 6.62607015e-34, 4)} Hz`,
    `√f = ${fmt(sqrtF(E), 4)} × 10⁸ Hz^½`,
    `Moseley (Z − 1)²: ${fmt(moseleyE(s.Z), 4)} keV`,
    `ângulo de Bragg no LiF: ${Number.isFinite(braggAngle(HC / E, 201.4)) ? fmt(braggAngle(HC / E, 201.4), 4) + "°" : "—"}`,
  ];
  rows.forEach((r, i) => d.text(r, x0, 4.9 - i * 0.85, { size: 11, align: "left" }));
  // diagrama do átomo de Bohr blindado
  const cx = 10.5;
  const cy = -3.8;
  d.circle(cx, cy, 0.5, { fill: th.positive });
  d.text(`+${s.Z}e`, cx, cy, { size: 9, color: "#fff", weight: "700" });
  d.circle(cx, cy, 1.4, { stroke: th.muted, width: 1 });
  d.circle(cx, cy, 2.8, { stroke: th.muted, width: 1 });
  d.dot(cx + 1.4, cy, 4, th.negative);
  d.circle(cx - 1.4, cy, 0.2, { stroke: th.negative, width: 1.2 });
  d.dot(cx + 1.98, cy + 1.98, 4, th.negative);
  d.arrow(cx + 1.9, cy + 1.7, -2.8, -1.6, { color: th.series[1]!, width: 1.5 });
  d.text("buraco em K", cx - 1.4, cy - 0.7, { size: 9, color: th.negative });
  d.text("o elétron L vê carga ≈ (Z − 1)e", cx, cy - 3.6, { size: 10, color: th.muted });
  d.text("Clique no gráfico para escolher outro elemento.", x0, -8.6, { size: 10, align: "left", color: th.muted });
}

function grayCol(v: number, dark: boolean) {
  const g = Math.round(255 * clamp(v, 0, 1));
  return dark ? `rgb(${g},${g},${g})` : `rgb(${g},${g},${g})`;
}

function drawMode3(d: Draw, s: XState, p: Params) {
  const th = d.theme;
  const im = image(p);
  // radiografia: mais transmissão = mais escuro (como no filme)
  const box = { x0: -16.5, y0: -0.6, x1: -1.2, y1: 8.6 };
  const sx = (box.x1 - box.x0) / (IMG.x1 - IMG.x0);
  const sy = (box.y1 - box.y0) / (IMG.y1 - IMG.y0);
  const Nq = 400 * Math.max(s.expo, 1e-3);
  const pw = (box.x1 - box.x0) / IW;
  const ph = (box.y1 - box.y0) / IH;
  for (let j = 0; j < IH; j++)
    for (let i = 0; i < IW; i++) {
      const T = im[j * IW + i]!;
      const Tm = Math.max(1e-4, T + pixNoise(j * IW + i) * Math.sqrt(Math.max(T, 1e-4) / Nq));
      const v = clamp(-Math.log(Tm) / 3.2, 0, 1);
      d.rect(box.x0 + i * pw, box.y0 + j * ph, pw * 1.04, ph * 1.04, { fill: grayCol(v, th.dark) });
    }
  d.rect(box.x0, box.y0, box.x1 - box.x0, box.y1 - box.y0, { stroke: th.muted, width: 1 });
  const px = box.x0 + (s.profX - IMG.x0) * sx;
  d.line(px, box.y0, px, box.y1, { color: th.series[1]!, width: 1.5, dash: [5, 3] });
  d.text("radiografia (claro = mais atenuação)", box.x0, box.y1 + 0.4, { size: 11, weight: "600", align: "left" });
  d.text(`exposição ${fmt(s.expo, 3)} mA·s`, box.x1, box.y1 + 0.4, { size: 10, align: "right", color: th.muted });
  void sy;
  // perfil
  const pb = { x0: -16.5, y0: -8.6, x1: -1.2, y1: -2.6 };
  const pn = panel(d, pb, { min: IMG.y0, max: IMG.y1 }, { min: 0, max: 1 });
  pn.frame({ xlabel: "y (cm)", ylabel: `transmissão no perfil x = ${fmt(s.profX, 2)} cm` });
  const ii = clamp(Math.floor(((s.profX - IMG.x0) / (IMG.x1 - IMG.x0)) * IW), 0, IW - 1);
  const prof: [number, number][] = [];
  for (let j = 0; j < IH; j++) prof.push([IMG.y0 + ((j + 0.5) * (IMG.y1 - IMG.y0)) / IH, im[j * IW + ii]!]);
  pn.line(prof, { color: th.series[1]!, width: 1.8 });
  d.text("arraste a linha laranja", pb.x1, pb.y1 + 0.4, { size: 10, align: "right", color: th.muted });

  // espectro do feixe e depois do braço
  const sp = beam(p);
  const sb = { x0: 2.2, y0: 1.6, x1: 16.4, y1: 8.2 };
  const Nmax = Math.max(1e-9, ...sp.N);
  const ps = panel(d, sb, { min: 0, max: Math.max(20, tube(p).V) }, { min: 0, max: 1.05 });
  ps.frame({ xlabel: "E (keV)", ylabel: "fótons por keV (normalizado)" });
  ps.line(sp.E.map((e, k) => [e, sp.N[k]! / Nmax]), { color: th.accent, width: 1.6 });
  const out = sp.E.map((e, k) => sp.N[k]! * Math.exp(-mu(WATER, e) * 2 * ARM.R));
  const Omax = Math.max(1e-30, ...out);
  ps.line(sp.E.map((e, k) => [e, out[k]! / Omax]), { color: th.series[2]!, width: 1.6 });
  d.text("azul: feixe filtrado   verde: após 7 cm de tecido (cada um normalizado)", sb.x0 + 0.2, sb.y1 - 0.45, { size: 10, align: "left", color: th.muted });

  // transmissão × espessura no material escolhido
  const m = material(p);
  const h = hvl(sp, m);
  const tb = { x0: 2.2, y0: -8.6, x1: 16.4, y1: -1.6 };
  const xmax = 4 * h;
  const pt = panel(d, tb, { min: 0, max: xmax * 10 }, { min: 0, max: 1 });
  pt.frame({ xlabel: `espessura de ${m.name} (mm)`, ylabel: "I/I₀" });
  const Em = meanEnergy(sp);
  pt.plot((xmm) => Math.exp(-mu(m, Em) * xmm / 10), 0, xmax * 10, { color: th.muted, width: 1, dash: [4, 3] });
  pt.plot((xmm) => transmitted(sp, [[m, xmm / 10]]), 0, xmax * 10, { color: th.series[3]!, width: 2, n: 80 });
  d.line(pt.X(h * 10), pt.Y(0), pt.X(h * 10), pt.Y(0.5), { color: th.series[3]!, width: 1, dash: [3, 3] });
  d.line(pt.X(0), pt.Y(0.5), pt.X(h * 10), pt.Y(0.5), { color: th.series[3]!, width: 1, dash: [3, 3] });
  d.text(`CSR = ${fmt(h * 10, 3)} mm`, pt.X(h * 10), pt.Y(0.5), { size: 10, align: "left", dx: 4, dy: -8, color: th.series[3]! });
  d.text(`tracejado: feixe monoenergético de ${fmt(Em, 3)} keV (sem endurecimento)`, tb.x1, tb.y1 - 0.45, { size: 10, align: "right", color: th.muted });
}

const empty = (p: Params, seed = 777): XState => ({
  seed,
  hist: new Array<number>(NB).fill(0),
  nDet: 0,
  acc: 0,
  elec: [],
  phot: [],
  theta: TH_MIN,
  scanning: mode(p) === 1,
  scan: [],
  Z: clamp(Math.round(num(p, "Zsel", 29)), 20, 82),
  profX: 0,
  expo: 0.3,
  drag: null,
});

const C0B = { x: -8.5, y: -3.5 };

export const raiosX = defineSim<XState>({
  id: "raios-x",
  title: "Raios X: tubo, espectro, Bragg e Moseley",
  course: "FG IV",
  topic: "Física moderna",
  priority: "P2",
  summary:
    "Tubo de raios X com tensão, corrente e ânodo ajustáveis: espectro de frenagem com o limite de Duane–Hunt e linhas Kα/Kβ, contados fóton a fóton. Gire um cristal num difratômetro de Bragg, confira a lei de Moseley e faça uma radiografia com endurecimento do feixe.",
  equations: [
    String.raw`\lambda_{\min} = \frac{hc}{eV}`,
    String.raw`I(\lambda) \propto i\,Z\,\frac{\lambda - \lambda_{\min}}{\lambda_{\min}\,\lambda^3}\ \ (\text{Kramers})`,
    String.raw`n\lambda = 2d\,\operatorname{sen}\theta`,
    String.raw`\sqrt{f_{K\alpha}} = \sqrt{\tfrac34 R_\infty c}\,(Z - 1)`,
    String.raw`I = I_0\,e^{-\mu x}`,
  ],
  liveEquations(s, p) {
    const { V, I, an } = tube(p);
    const m = mode(p);
    if (m === 1) {
      const cr = crystal(p);
      return [String.raw`\lambda = \frac{2d\,\operatorname{sen}\theta}{n} = \frac{2(${texNum(cr.d)}\ \text{pm})\operatorname{sen}${texNum(s.theta)}^\circ}{n} = \frac{${texNum(2 * cr.d * Math.sin((s.theta * Math.PI) / 180))}}{n}\ \text{pm}`];
    }
    if (m === 2) {
      const E = KALPHA[s.Z]?.[1] ?? moseleyE(s.Z);
      return [String.raw`E_{K\alpha} \approx \tfrac34(13{,}6\ \text{eV})(${s.Z} - 1)^2 = ${texNum(moseleyE(s.Z))}\ \text{keV} \quad (\text{medido: } ${texNum(E)}\ \text{keV})`];
    }
    if (m === 3) {
      const sp = beam(p);
      return [String.raw`\bar E = ${texNum(meanEnergy(sp))}\ \text{keV},\quad \text{CSR} = ${texNum(hvl(sp, material(p)) * 10)}\ \text{mm},\quad C_{\text{osso}} = ${texNum(100 * boneContrast(p))}\%`];
    }
    return [
      String.raw`\lambda_{\min} = \frac{1240\ \text{keV·pm}}{${texNum(V)}\ \text{kV}} = ${texNum(lambdaMin(V))}\ \text{pm}`,
      String.raw`P_X = \eta V i = (${texNum(efficiency(V, an.Z) * 100)}\%)(${texNum(V)}\ \text{kV})(${texNum(I)}\ \text{mA}) = ${texNum(efficiency(V, an.Z) * V * I)}\ \text{W}`,
    ];
  },
  params: [
    {
      key: "modo",
      label: "Montagem",
      unit: "",
      min: 0,
      max: 3,
      step: 1,
      default: 0,
      options: [
        { value: 0, label: "Tubo e espectro" },
        { value: 1, label: "Difratômetro de Bragg" },
        { value: 2, label: "Lei de Moseley" },
        { value: 3, label: "Atenuação e radiografia" },
      ],
    },
    { key: "anodo", label: "Ânodo", unit: "", min: 0, max: 2, step: 1, default: 0, options: ANODES.map((a, i) => ({ value: i, label: a.name })) },
    { key: "V", label: "Tensão de aceleração V", unit: "kV", min: 5, max: 100, step: 0.5, default: 35 },
    { key: "I", label: "Corrente do tubo i", unit: "mA", min: 0.1, max: 30, step: 0.1, default: 1, live: true },
    {
      key: "filtro",
      label: "Filtro no feixe",
      unit: "",
      min: 0,
      max: 2,
      step: 1,
      default: 0,
      options: [
        { value: 0, label: "nenhum" },
        { value: 1, label: "níquel 20 μm (corta Kβ do Cu)" },
        { value: 2, label: "zircônio 60 μm (corta Kβ do Mo)" },
      ],
    },
    { key: "cristal", label: "Cristal", unit: "", min: 0, max: 1, step: 1, default: 0, options: CRYSTALS.map((c, i) => ({ value: i, label: c.name })) },
    { key: "w", label: "Velocidade de varredura", unit: "°/s", min: 0.2, max: 6, step: 0.1, default: 2, live: true },
    { key: "abertura", label: "Abertura angular do detector σθ", unit: "°", min: 0.03, max: 0.5, step: 0.01, default: 0.12 },
    { key: "escala", label: "Escala do gráfico de Bragg", unit: "", min: 0, max: 1, step: 1, default: 0, live: true, options: [{ value: 0, label: "linear" }, { value: 1, label: "logarítmica" }] },
    { key: "Zsel", label: "Elemento (Moseley)", unit: "", min: 20, max: 82, step: 1, default: 29 },
    { key: "al", label: "Filtração de alumínio", unit: "mm", min: 0, max: 8, step: 0.5, default: 2.5 },
    { key: "objeto", label: "Objeto", unit: "", min: 0, max: 1, step: 1, default: 1, options: [{ value: 0, label: "antebraço" }, { value: 1, label: "antebraço com projétil de chumbo" }] },
    { key: "material", label: "Material da curva de atenuação", unit: "", min: 0, max: 3, step: 1, default: 2, live: true, options: MATERIALS.map((m, i) => ({ value: i, label: m.name })) },
  ],
  observables: [
    { key: "lmin", label: "Limite de Duane–Hunt λmin", unit: "pm", value: (_s, p) => lambdaMin(tube(p).V) },
    { key: "Emax", label: "Energia máxima do fóton", unit: "keV", value: (_s, p) => tube(p).V },
    { key: "eta", label: "Eficiência do tubo", unit: "%", value: (_s, p) => 100 * efficiency(tube(p).V, tube(p).an.Z) },
    { key: "PX", label: "Potência em raios X", unit: "W", value: (_s, p) => efficiency(tube(p).V, tube(p).an.Z) * tube(p).V * tube(p).I },
    { key: "nDet", label: "Fótons detectados", unit: "", value: (s) => s.nDet },
    { key: "theta", label: "Ângulo do cristal θ", unit: "°", value: (s) => s.theta },
    { key: "rate", label: "Taxa de contagem", unit: "1/s", value: (s, p) => braggRateP(p, s.theta) },
    { key: "lam1", label: "λ = 2d sen θ (n = 1)", unit: "pm", value: (s, p) => 2 * crystal(p).d * Math.sin((s.theta * Math.PI) / 180) },
    { key: "Z", label: "Número atômico escolhido", unit: "", value: (s) => s.Z },
    { key: "sqf", label: "√f da Kα", unit: "1e8 Hz^½", value: (s) => sqrtF(KALPHA[s.Z]?.[1] ?? moseleyE(s.Z)) },
    { key: "hvl", label: "Camada semirredutora", unit: "mm", value: (_s, p) => 10 * hvl(beam(p), material(p)) },
    { key: "Emed", label: "Energia média do feixe", unit: "keV", value: (_s, p) => meanEnergy(beam(p)) },
    { key: "contraste", label: "Contraste osso/tecido", unit: "%", value: (_s, p) => 100 * boneContrast(p) },
    { key: "dose", label: "Dose relativa na pele (mesmo sinal)", unit: "u.a.", value: (_s, p) => relativeDose(p) },
  ],
  chart: { x: "theta", y: "rate" },
  scenarios: [
    {
      id: "duane-hunt",
      label: "Espectro e limite de Duane–Hunt",
      params: { modo: 0, anodo: 1, V: 15, I: 1 },
      guide: `### Frenagem e linhas características
1. Ânodo de molibdênio a 15 kV: o espectro é só o contínuo de frenagem (*bremsstrahlung*) e começa em $\\lambda_{\\min} = hc/eV$.
2. Responda à previsão e suba a tensão para 30 kV. Observe $\\lambda_{\\min}$ andar para a esquerda e o espectro crescer como $V^2$.
3. Acima de 20 kV (borda K do Mo) surgem as linhas **Kα** e **Kβ**: a posição delas **não** muda com $V$ — é uma impressão digital do ânodo.
4. Troque para cobre e coloque o filtro de **níquel**: a borda K do Ni (8,33 keV) fica entre Kα e Kβ do Cu e remove quase toda a Kβ.
5. Os fótons chegam um a um (barras roxas) e o histograma converge para a curva teórica.`,
      predict: [
        {
          question: "Dobrando a tensão de 15 kV para 30 kV, o que acontece com o comprimento de onda mínimo do espectro?",
          options: ["Não muda: depende do material do ânodo", "Cai pela metade", "Dobra", "Cai a um quarto"],
          answer: 1,
          explanation: "O fóton mais energético recebe toda a energia $eV$ do elétron: $\\lambda_{\\min} = hc/eV$. Dobrar $V$ divide $\\lambda_{\\min}$ por dois, para qualquer ânodo.",
        },
      ],
    },
    {
      id: "bragg",
      label: "Difratômetro: medindo λ da Kα",
      params: { modo: 1, anodo: 0, V: 30, cristal: 0, w: 2 },
      guide: `### Espectrômetro de cristal
1. O cristal de NaCl gira de $\\theta$ e o detector acompanha em $2\\theta$. A varredura começa sozinha (você pode arrastar o detector).
2. Os picos estreitos são Kα e Kβ do cobre; o fundo é o contínuo. Leia os ângulos e calcule $\\lambda = 2d\\,\\operatorname{sen}\\theta$ com $d = 282$ pm.
3. Picos menores em ângulos maiores são as ordens $n = 2$ e $3$. Use a escala logarítmica para vê-los.
4. A partida do contínuo em $\\theta_{\\min}$ dá $\\lambda_{\\min}$; de $\\lambda_{\\min} = hc/eV$ obtenha a constante de Planck.
5. Troque para LiF ($d$ menor): os picos se afastam — melhor resolução.`,
      predict: [
        {
          question: "A linha Kα do cobre tem λ = 154 pm. Em que ângulo θ ela aparece em primeira ordem no NaCl (d = 282 pm)?",
          options: ["≈ 8°", "≈ 16°", "≈ 33°", "≈ 45°"],
          answer: 1,
          explanation: "$\\operatorname{sen}\\theta = \\lambda/2d = 154/564 = 0{,}273$, logo $\\theta \\approx 15{,}8^\\circ$. Em segunda ordem, $\\operatorname{sen}\\theta = 0{,}546$ e $\\theta \\approx 33^\\circ$.",
        },
      ],
    },
    {
      id: "moseley",
      label: "Lei de Moseley",
      params: { modo: 2, Zsel: 42 },
      guide: `### √f contra Z é uma reta
1. Cada ponto é a energia medida da Kα de um elemento. Clique nos pontos para ver os valores.
2. A reta laranja é o ajuste $\\sqrt f = k(Z - \\sigma)$: a blindagem $\\sigma \\approx 1$ é o outro elétron que fica na camada K.
3. A previsão de Bohr com $(Z-1)$ (tracejado) acerta bem até $Z \\approx 40$; acima, efeitos relativísticos aumentam a energia.
4. Os pontos vermelhos eram lacunas em 1914: Moseley mostrou que o número atômico, não a massa, ordena a tabela, e previu esses elementos.`,
      predict: [
        {
          question: "Se o número atômico dobra (por exemplo de Z = 21 para Z = 41), a energia da Kα fica aproximadamente:",
          options: ["igual", "2 vezes maior", "4 vezes maior", "8 vezes maior"],
          answer: 2,
          explanation: "$E \\propto (Z-1)^2$: de $20^2$ para $40^2$ a energia quadruplica (Ca–Nb: 3,7 keV → 16,6 keV).",
        },
      ],
    },
    {
      id: "radiografia",
      label: "Radiografia e endurecimento do feixe",
      params: { modo: 3, anodo: 2, V: 60, I: 5, al: 2.5, objeto: 1, material: 2 },
      guide: `### Contraste, dose e qualidade do feixe
1. O braço (tecido, osso e um projétil de chumbo) é atravessado por um feixe de tungstênio filtrado. O osso absorve mais por causa do efeito fotoelétrico ($\\mu \\propto Z^3/E^3$).
2. Rode: a exposição (mA·s) cresce e o ruído quântico da imagem diminui como $1/\\sqrt N$.
3. Baixe para 40 kV: o **contraste** osso/tecido aumenta, mas a **dose relativa** na pele também. Suba para 100 kV: o oposto.
4. Aumente a filtração de alumínio: a energia média sobe (o feixe "endurece") e a camada semirredutora cresce.
5. Na curva $I/I_0$ a transmissão real cai mais devagar que a exponencial monoenergética: os fótons moles são removidos primeiro.`,
      predict: [
        {
          question: "Ao baixar a tensão de 100 kV para 40 kV (mesmo sinal no detector), o contraste entre osso e tecido…",
          options: ["aumenta, e a dose na pele também aumenta", "aumenta, e a dose diminui", "diminui", "não muda"],
          answer: 0,
          explanation: "Em energias baixas domina o efeito fotoelétrico, muito sensível ao Z (cálcio do osso): mais contraste. Mas o tecido também absorve muito mais, e para obter o mesmo sinal é preciso mais radiação na entrada.",
        },
      ],
    },
  ],
  exercises: [
    {
      id: "lmin",
      prompt: "Um tubo de raios X opera com {V} kV. Qual o menor comprimento de onda do espectro, em pm? (hc = 1240 keV·pm)",
      vary: { V: [10, 100, 0] },
      fixed: { modo: 0 },
      answer: { label: "λmin", unit: "pm", compute: (p) => lambdaMin(num(p, "V")) },
      hint: "O elétron entrega toda a energia eV a um único fóton.",
    },
    {
      id: "bragg",
      prompt: "Raios X de comprimento de onda {lam} pm incidem num cristal de NaCl com d = 282 pm. Em que ângulo θ (em graus) ocorre a reflexão de primeira ordem?",
      vary: { lam: [50, 250, 0] },
      fixed: { modo: 1 },
      answer: { label: "θ", unit: "°", compute: (p) => braggAngle(num(p, "lam"), 282, 1) },
      hint: "n λ = 2 d sen θ, com n = 1.",
    },
    {
      id: "moseley",
      prompt: "A linha Kα de uma amostra desconhecida tem energia {Ek} keV. Pela lei de Moseley, E = (3/4)(13,6 eV)(Z − 1)², qual é o número atômico (não arredonde)?",
      vary: { Ek: [4, 25, 2] },
      fixed: { modo: 2 },
      answer: { label: "Z", unit: "", compute: (p) => 1 + Math.sqrt(num(p, "Ek") / (0.75 * 13.6e-3)) },
      tolerance: 0.03,
    },
  ],
  init: (p) => empty(p),
  step(s, p, t, dt) {
    const m = mode(p);
    const ns: XState = { ...s };
    if (m === 0) {
      const { I } = tube(p);
      ns.hist = s.hist.slice();
      ns.elec = s.elec.filter((tb) => t - tb < 0.7);
      ns.phot = s.phot.filter(([tb]) => t - tb < 0.8);
      if (Math.floor((t + dt) * 14) > Math.floor(t * 14)) ns.elec.push(t);
      ns.acc = s.acc + Math.min(600, 60 * I) * dt;
      const lm = lamMax(p);
      while (ns.acc >= 1) {
        ns.acc -= 1;
        const lam = sampleLambda(ns, p);
        if (!Number.isFinite(lam)) continue;
        const b = Math.floor((lam / lm) * NB);
        if (b >= 0 && b < NB) ns.hist[b]!++;
        ns.nDet++;
        if (ns.phot.length < 12 && nextRandom(ns) < 0.3) ns.phot.push([t, lam]);
      }
    } else if (m === 1) {
      if (s.scanning && !s.drag) {
        const th = s.theta + num(p, "w", 2) * dt;
        const R = braggRateP(p, th);
        const meas = Math.max(0, R + Math.sqrt(R + 1) * gaussianFrom(ns));
        ns.scan = s.scan.concat([th, meas]);
        ns.theta = Math.min(th, TH_MAX);
        if (th >= TH_MAX) ns.scanning = false;
      }
    } else if (m === 3) {
      ns.expo = Math.min(200, s.expo + tube(p).I * dt * 0.5);
    }
    return ns;
  },
  dt: 1 / 60,
  sampleEvery: 6,
  maxSamples: 3000,
  actions: [
    { id: "zerar", label: "Zerar medidas", run: (s, p) => ({ ...empty(p, s.seed), Z: s.Z, profX: s.profX, scanning: false }) },
    { id: "varrer", label: "Nova varredura θ (Bragg)", run: (s) => ({ ...s, theta: TH_MIN, scan: [], scanning: true }) },
    { id: "parar", label: "Parar/continuar varredura", run: (s) => ({ ...s, scanning: !s.scanning && s.theta < TH_MAX }) },
  ],
  pointer: {
    down(s, p, pt) {
      const m = mode(p);
      if (m === 1 && pt.x < 1) return { ...s, drag: "arm", scanning: false };
      if (m === 2) {
        const box = { x0: -15, x1: 3 };
        if (pt.x >= box.x0 && pt.x <= box.x1 && pt.y > -7.4 && pt.y < 7.4) {
          const z = Math.round(18 + ((pt.x - box.x0) / (box.x1 - box.x0)) * 66);
          return { ...s, Z: clamp(z, 20, 82) };
        }
      }
      if (m === 3 && pt.x > -16.5 && pt.x < -1.2 && pt.y > -0.6) return { ...s, drag: "prof", profX: IMG.x0 + ((pt.x + 16.5) / 15.3) * (IMG.x1 - IMG.x0) };
      return undefined;
    },
    move(s, p, pt, dragging) {
      if (!dragging || !s.drag) return undefined;
      if (s.drag === "arm") {
        const a = (Math.atan2(pt.y - C0B.y, pt.x - C0B.x) * 180) / Math.PI / 2;
        return { ...s, theta: clamp(a, TH_MIN, TH_MAX) };
      }
      if (s.drag === "prof") return { ...s, profX: clamp(IMG.x0 + ((pt.x + 16.5) / 15.3) * (IMG.x1 - IMG.x0), IMG.x0, IMG.x1) };
      return undefined;
    },
    up: (s) => (s.drag ? { ...s, drag: null } : undefined),
    cursor: (_s, p, pt) => (mode(p) === 1 && pt.x < 1 ? "grab" : mode(p) === 2 && pt.x < 3 ? "pointer" : mode(p) === 3 && pt.x < -1.2 && pt.y > -0.6 ? "ew-resize" : undefined),
  },
  narrowSplit: () => 0.487,
  viewport: () => ({ ...VIEW, unit: "" }),
  render(ctx, frame) {
    const d = draw(ctx, frame);
    const m = mode(frame.params);
    if (m === 0) drawMode0(d, frame.state, frame.params, frame.t);
    else if (m === 1) drawMode1(d, frame.state, frame.params);
    else if (m === 2) drawMode2(d, frame.state);
    else drawMode3(d, frame.state, frame.params);
  },
});

export default raiosX;
