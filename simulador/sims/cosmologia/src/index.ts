import { clamp, defineSim, draw, num, texNum, type Draw, type Params, type WorldPoint } from "@fisilab/core";
import { derivation } from "./derivation.ts";
import { fmt, panel } from "./panel.ts";
import {
  GALAXIES,
  G_KPC,
  HUBBLE_GYR,
  OMEGA_R,
  T0,
  Z_DEC,
  ageAt,
  bestHalo,
  chi2,
  decel,
  energyDensity,
  fitHubble,
  haloMassIn,
  hasBigBang,
  hInvGyr,
  hubbleAt,
  lambdaMax,
  makeGalaxies,
  massFromV,
  measure,
  mulberry,
  nuPeak,
  photonDensity,
  planckNu,
  recombinationT,
  rotation,
  rotationData,
  sahaX,
  stepScale,
  tempAt,
  E2,
  type Cosmo,
  type Galaxy,
  type GalaxyModel,
  type RotPoint,
} from "./physics.ts";
import { ui } from "./ui.ts";

export * from "./physics.ts";

export interface CState {
  /** Relógio da animação (s). */
  clock: number;
  /** Hubble: tempo decorrido (Gyr) e galáxia observadora. */
  tH: number;
  obs: number;
  /** Radiação de fundo: ln(1 + z) atual e fótons [x, y, ângulo] numa caixa comóvel [−1, 1]². */
  lnz: number;
  photons: number[];
  scatters: number;
  seed: number;
  /** Big bang: tempo cósmico (Gyr), fator de escala e sua derivada (1/Gyr). */
  tc: number;
  a: number;
  ad: number;
}

const VIEW = { xMin: -17, xMax: 17, yMin: -9.5, yMax: 9.5 };
const theme = (p: Params) => Math.round(num(p, "tema"));
const sci = (v: number, d = 3) => {
  if (!Number.isFinite(v)) return "—";
  if (v === 0) return "0";
  const e = Math.floor(Math.log10(Math.abs(v)));
  if (e >= -2 && e < 5) return fmt(v, d);
  const sup = String(e).replace(/-/g, "⁻").replace(/\d/g, (c) => "⁰¹²³⁴⁵⁶⁷⁸⁹"[Number(c)]!);
  return `${fmt(v / 10 ** e, d)} × 10${sup}`;
};
/** Tempo em anos com a unidade adequada. */
const yearsTxt = (gyr: number) => {
  if (!Number.isFinite(gyr)) return "—";
  const y = gyr * 1e9;
  if (y < 1 / 365.25 / 24) return `${fmt(y * 3.15576e7, 3)} s`;
  if (y < 1) return `${fmt(y * 365.25, 3)} dias`;
  if (y < 1e3) return `${fmt(y, 3)} anos`;
  if (y < 1e6) return `${fmt(y / 1e3, 3)} mil anos`;
  if (y < 1e9) return `${fmt(y / 1e6, 3)} milhões de anos`;
  return `${fmt(gyr, 3)} bilhões de anos`;
};

const SUPS = "⁰¹²³⁴⁵⁶⁷⁸⁹";
const pow10 = (v: number) => `10${String(Math.round(Math.log10(v))).replace(/-/g, "⁻").replace(/\d/g, (c) => SUPS[Number(c)]!)}`;
const H0 = (p: Params) => num(p, "H0", 70);
/** Universo padrão (ΛCDM, Planck 2018) para converter z em tempo nos outros temas. */
const LCDM = (h0: number): Cosmo => ({ H0: h0, Om: 0.315, Or: OMEGA_R, OL: 0.685 - OMEGA_R });

// ------------------------------------------------------------------ tema 0: lei de Hubble
const HUB = { R: 280, cx: -8.6, cy: -0.4, half: 8.3 };
const galaxiesFor = (p: Params) => makeGalaxies(clamp(Math.round(num(p, "nGal", 30)), 8, 80), HUB.R, 11);
const galCache = new Map<number, Galaxy[]>();
const gals = (p: Params) => {
  const n = clamp(Math.round(num(p, "nGal", 30)), 8, 80);
  if (!galCache.has(n)) galCache.set(n, galaxiesFor(p));
  return galCache.get(n)!;
};
export const scaleHubble = (s: CState, p: Params) => Math.exp(hInvGyr(H0(p)) * s.tH);
export const hubbleMeasurements = (s: CState, p: Params) => measure(gals(p), s.obs, scaleHubble(s, p), H0(p), num(p, "sigmaV", 300), num(p, "erroD", 5) / 100);
const hubSc = (s: CState, p: Params) => HUB.half / (HUB.R * 1.05) / Math.max(1, 0.6 + 0.4 * scaleHubble(s, p));

function drawHubble(d: Draw, s: CState, p: Params) {
  const th = d.theme;
  const u = ui(d);
  const gs = gals(p);
  const a = scaleHubble(s, p);
  const o = gs[s.obs]!;
  const sc = hubSc(s, p);
  const box = { x0: HUB.cx - HUB.half, x1: HUB.cx + HUB.half, y0: HUB.cy - HUB.half, y1: HUB.cy + HUB.half };
  u.text("Galáxias num universo em expansão", -16.6, 8.9, { size: 15, weight: "700", align: "left" });
  d.rect(box.x0, box.y0, box.x1 - box.x0, box.y1 - box.y0, { fill: th.dark ? "#05070c" : "#0d1424", alpha: th.dark ? 0.9 : 0.92 });
  const ctx = d.ctx;
  ctx.save();
  ctx.beginPath();
  ctx.rect(box.x0, box.y0, box.x1 - box.x0, box.y1 - box.y0);
  ctx.clip();
  for (const R of [100, 200, 300]) {
    d.circle(HUB.cx, HUB.cy, R * sc, { stroke: "#9fb3d1", width: 1, dash: [3, 4], alpha: 0.35 });
    d.text(`${R} Mpc`, HUB.cx + R * sc * 0.71, HUB.cy + R * sc * 0.71, { size: 9 * u.k, color: "#9fb3d1" });
  }
  const sV = num(p, "sigmaV", 300);
  gs.forEach((g, i) => {
    const x0 = HUB.cx + (g.x - o.x) * sc;
    const y0 = HUB.cy + (g.y - o.y) * sc;
    const x = HUB.cx + (g.x - o.x) * a * sc;
    const y = HUB.cy + (g.y - o.y) * a * sc;
    if (i !== s.obs) {
      d.dot(x0, y0, 2, "#9fb3d1", 0.45);
      d.line(x0, y0, x, y, { color: "#9fb3d1", width: 1, alpha: 0.35 });
      const dx = x - HUB.cx;
      const dy = y - HUB.cy;
      const r = Math.hypot(dx, dy);
      // seta da velocidade radial medida
      const vr = H0(p) * r / sc + sV * (((g.ux - o.ux) * dx + (g.uy - o.uy) * dy) / Math.max(r, 1e-9));
      if (r > 1e-6) d.arrowPx(x, y, dx, dy, Math.max(3, vr / 450), { color: "#f0a35e", width: 1.5, head: 6 });
    }
    const sz = (i === s.obs ? 7 : 4.5) * g.size;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(i * 1.7);
    ctx.scale(1, 0.55);
    d.dot(0, 0, sz, i === s.obs ? "#7fd0ff" : "#f2e6c9", 0.95);
    ctx.restore();
  });
  ctx.restore();
  u.text("você (observador)", HUB.cx, HUB.cy - 0.75, { size: 10, color: "#7fd0ff", weight: "700" });
  u.text(`t = ${fmt(s.tH, 3)} bilhões de anos depois   a(t)/a(0) = ${fmt(a, 4)}`, box.x0, box.y0 - 0.5, { size: 11, align: "left" });
  u.text("clique numa galáxia para observar de lá: todas se afastam de todas", box.x0, box.y0 - 1.1, { size: 10, align: "left", color: th.muted });

  // gráfico v × d
  const ms = hubbleMeasurements(s, p);
  const fit = fitHubble(ms);
  const dmax = Math.max(...ms.map((m) => m.d), 100) * 1.08;
  const vmax = Math.max(...ms.map((m) => m.v), H0(p) * dmax) * 1.1;
  const pb = { x0: 2.6, y0: -5.4, x1: 16.4, y1: 6.8 };
  const pl = panel(d, pb, { min: 0, max: dmax }, { min: Math.min(0, ...ms.map((m) => m.v)) * 1.1, max: vmax });
  pl.frame({ xlabel: "distância d (Mpc)", ylabel: "velocidade de afastamento v (km/s)", fx: (v) => String(Math.round(v)), fy: (v) => sci(v, 2) });
  u.text("Diagrama de Hubble medido daqui", pb.x0, pb.y1 + 1.4, { size: 13, weight: "700", align: "left" });
  pl.plot((x) => H0(p) * x, 0, dmax, { color: th.muted, width: 1.2, dash: [5, 4] });
  pl.plot((x) => fit.H * x, 0, dmax, { color: th.accent, width: 2.2 });
  for (const m of ms) d.dot(pl.X(m.d), pl.Y(m.v), 3.6, th.series[1]!);
  const tHub = HUBBLE_GYR / fit.H;
  u.text(`ajuste: H₀ = ${fmt(fit.H, 4)} ± ${fmt(fit.sigma, 2)} km/s/Mpc`, pb.x0, -6.9, { size: 12, align: "left", weight: "700", color: th.accent });
  u.text(`idade de Hubble 1/H₀ = ${fmt(tHub, 3)} bilhões de anos`, pb.x0, -7.65, { size: 12, align: "left", weight: "600" });
  u.text(`tracejado: H₀ verdadeiro = ${fmt(H0(p), 3)} km/s/Mpc   pontos: ${ms.length} galáxias`, pb.x0, -8.4, { size: 10, align: "left", color: th.muted });
  u.text(`velocidades peculiares: ${fmt(num(p, "sigmaV", 300), 3)} km/s;  erro das distâncias: ± ${fmt(num(p, "erroD", 5), 2)}%`, pb.x0, -9.05, { size: 10, align: "left", color: th.muted });
}

function hubbleHit(s: CState, p: Params, pt: WorldPoint): number | null {
  const gs = gals(p);
  const a = scaleHubble(s, p);
  const o = gs[s.obs]!;
  const sc = hubSc(s, p);
  let best: number | null = null;
  let bd = 0.45;
  gs.forEach((g, i) => {
    const x = HUB.cx + (g.x - o.x) * a * sc;
    const y = HUB.cy + (g.y - o.y) * a * sc;
    const dd = Math.hypot(pt.x - x, pt.y - y);
    if (dd < bd && Math.abs(x - HUB.cx) < HUB.half && Math.abs(y - HUB.cy) < HUB.half) [bd, best] = [dd, i];
  });
  return best;
}

// ------------------------------------------------------------------ tema 1: radiação de fundo
const N_PHOT = 46;
const N_PROT = 22;
const zNow = (s: CState) => Math.max(0, Math.exp(s.lnz) - 1);
const eta = (p: Params) => num(p, "eta", 6.1) * 1e-10;
export const xeAt = (z: number, p: Params) => sahaX(tempAt(z), eta(p));
const hash = (i: number) => {
  const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
};

function initPhotons(seed: number): number[] {
  const r = mulberry(seed);
  const out: number[] = [];
  for (let i = 0; i < N_PHOT; i++) out.push(2 * r() - 1, 2 * r() - 1, 2 * Math.PI * r());
  return out;
}

function drawCMB(d: Draw, s: CState, p: Params) {
  const th = d.theme;
  const u = ui(d);
  const z = zNow(s);
  const T = tempAt(z);
  const Xe = xeAt(z, p);
  u.text("Radiação cósmica de fundo", -16.6, 8.9, { size: 15, weight: "700", align: "left" });
  // caixa comóvel
  const B = { cx: -11.2, cy: 2.6, h: 5.2 };
  d.rect(B.cx - B.h, B.cy - B.h, 2 * B.h, 2 * B.h, { fill: Xe > 0.5 ? (th.dark ? "#2a1a10" : "#f6e1c8") : th.dark ? "#06080e" : "#10172a", alpha: 0.95 });
  d.rect(B.cx - B.h, B.cy - B.h, 2 * B.h, 2 * B.h, { stroke: th.muted, width: 1 });
  for (let i = 0; i < N_PROT; i++) {
    const x = B.cx + (hash(i) * 2 - 1) * B.h * 0.9;
    const y = B.cy + (hash(i + 50) * 2 - 1) * B.h * 0.9;
    const ionized = hash(i + 100) < Xe;
    d.dot(x, y, 4, th.positive);
    if (ionized) {
      const ex = x + Math.cos(s.clock * 2.3 + i * 1.7) * 0.9 + (hash(i + 7) - 0.5) * 1.4;
      const ey = y + Math.sin(s.clock * 1.9 + i * 2.1) * 0.9 + (hash(i + 9) - 0.5) * 1.4;
      d.dot(clamp(ex, B.cx - B.h, B.cx + B.h), clamp(ey, B.cy - B.h, B.cy + B.h), 2.5, th.negative);
    } else d.circle(x, y, 0.32, { stroke: th.negative, width: 1.2 });
  }
  const lam = 0.06 * ((3001 / (1 + z)) ** 0.35);
  const col = T > 2500 ? "#ffd27a" : T > 600 ? "#ff8a50" : "#c0504d";
  d.ctx.save();
  d.ctx.beginPath();
  d.ctx.rect(B.cx - B.h, B.cy - B.h, 2 * B.h, 2 * B.h);
  d.ctx.clip();
  for (let i = 0; i < N_PHOT; i++) {
    const x = B.cx + s.photons[3 * i]! * B.h;
    const y = B.cy + s.photons[3 * i + 1]! * B.h;
    const ang = s.photons[3 * i + 2]!;
    const L = 0.75;
    const pts: [number, number][] = [];
    for (let k = 0; k <= 16; k++) {
      const t = (k / 16) * L;
      const w = 0.12 * Math.sin((2 * Math.PI * t) / Math.max(lam, 0.05));
      pts.push([x - Math.cos(ang) * t - Math.sin(ang) * w, y - Math.sin(ang) * t + Math.cos(ang) * w]);
    }
    d.polyline(pts, { color: col, width: 1.6 });
  }
  d.ctx.restore();
  u.text(Xe > 0.1 ? "plasma opaco: fótons espalhados pelos elétrons livres" : "transparente: átomos neutros, fótons voam livres", B.cx, B.cy - B.h - 0.5, { size: 10.5, weight: "600", color: Xe > 0.1 ? th.series[1]! : th.series[0]! });
  const ly = B.cy - B.h - 1.1;
  d.dot(B.cx - 4.6, ly, 4, th.positive);
  u.text("próton", B.cx - 4.2, ly, { size: 9.5, align: "left" });
  d.dot(B.cx - 1.6, ly, 2.5, th.negative);
  u.text("elétron livre", B.cx - 1.2, ly, { size: 9.5, align: "left" });
  d.circle(B.cx + 2.6, ly, 0.3, { stroke: th.negative, width: 1.2 });
  u.text("átomo de H", B.cx + 3.1, ly, { size: 9.5, align: "left" });
  const tAge = ageAt(1 / (1 + z), LCDM(67.4));
  const rows: [string, string][] = [
    ["redshift z", fmt(z, 4)],
    ["fator de escala a = 1/(1 + z)", sci(1 / (1 + z), 3)],
    ["temperatura T = T₀(1 + z)", `${sci(T, 4)} K`],
    ["idade do universo (ΛCDM)", yearsTxt(tAge)],
    ["fração ionizada Xₑ (Saha)", Xe > 0.01 ? fmt(Xe, 3) : sci(Xe, 2)],
    ["λ do pico (Wien)", lambdaMax(T) > 1e-3 ? `${fmt(lambdaMax(T) * 1e3, 3)} mm` : `${fmt(lambdaMax(T) * 1e6, 3)} µm`],
    ["fótons por cm³", sci(photonDensity(T) / 1e6, 3)],
  ];
  rows.forEach(([k, v], i) => {
    const y = -4.6 - i * 0.62;
    u.text(k, -16.6, y, { size: 11, align: "left", color: th.muted });
    u.text(v, -7.2, y, { size: 11.5, align: "left", weight: "600" });
  });

  // espectro
  const sb = { x0: 1.6, y0: 1.2, x1: 16.4, y1: 7.6 };
  const sp = panel(d, sb, { min: 1e9, max: 1e16, log: true }, { min: 1e-21, max: 1e-6, log: true });
  u.text("Espectro de corpo negro Bν (W m⁻² Hz⁻¹ sr⁻¹)", sb.x0, sb.y1 + 0.9, { size: 12, weight: "700", align: "left" });
  d.rect(sp.X(4e14), sb.y0, sp.X(7.5e14) - sp.X(4e14), sb.y1 - sb.y0, { fill: th.series[5]!, alpha: 0.15 });
  u.text("visível", sp.X(5.5e14), sb.y1 + 0.3, { size: 9, color: th.series[5]! });
  sp.frame({ xlabel: "frequência ν (Hz)", xticks: [1e9, 1e11, 1e13, 1e15], yticks: [1e-20, 1e-16, 1e-12, 1e-8], fx: pow10, fy: pow10 });
  sp.plot((nu) => planckNu(nu, T0), 1e9, 1e16, { color: th.muted, width: 1.4, dash: [5, 4], n: 300 });
  const Trec = recombinationT(eta(p));
  sp.plot((nu) => planckNu(nu, Trec), 1e9, 1e16, { color: th.series[1]!, width: 1.2, dash: [2, 3], n: 300 });
  sp.plot((nu) => planckNu(nu, T), 1e9, 1e16, { color: th.accent, width: 2.4, n: 300 });
  const np = nuPeak(T);
  d.dot(sp.X(np), sp.Y(planckNu(np, T)), 5, th.accent);
  u.text(`pico ${sci(np / 1e9, 3)} GHz`, sp.X(np), sp.Y(planckNu(np, T)), { size: 10, dy: -11, color: th.accent, weight: "700" });
  u.text(`hoje: ${fmt(T0, 5)} K (pico 160 GHz, λ ≈ 1 mm)`, sb.x1 - 0.15, sb.y0 + 0.35, { size: 9, align: "right", color: th.muted });
  u.text(`pontilhado: ${fmt(Trec, 4)} K (Xₑ = 1/2 por Saha)`, sb.x1 - 0.15, sb.y0 + 0.9, { size: 9, align: "right", color: th.series[1]! });

  // ionização
  const ib = { x0: 1.6, y0: -7.6, x1: 16.4, y1: -1.6 };
  const ip = panel(d, ib, { min: 1, max: 5000, log: true }, { min: 0, max: 1.08 });
  u.text("Fração de hidrogênio ionizado (equação de Saha)", ib.x0, ib.y1 + 0.85, { size: 12, weight: "700", align: "left" });
  ip.frame({ xlabel: "1 + z  (o tempo corre para a esquerda)", yticks: [0, 0.5, 1], fx: (v) => String(v) });
  ip.plot((x) => sahaX(tempAt(x - 1), eta(p)), 1, 5000, { color: th.series[1]!, width: 2.2, n: 300 });
  d.line(ip.X(1 + Z_DEC), ib.y0, ip.X(1 + Z_DEC), ib.y1, { color: th.series[4]!, width: 1.2, dash: [4, 3] });
  u.text(`desacoplamento observado z ≈ ${Z_DEC} (T ≈ ${fmt(tempAt(Z_DEC), 3)} K)`, ip.X(1 + Z_DEC), ib.y1 - 0.35, { size: 9.5, align: "right", dx: -4, color: th.series[4]! });
  d.dot(ip.X(1 + z), ip.Y(Xe), 6, th.accent);
  u.text(`espalhamentos na animação: ${s.scatters}`, ib.x0, ib.y0 - 1.25, { size: 9.5, align: "left", color: th.muted });
}

function stepPhotons(s: CState, p: Params, dt: number): Pick<CState, "photons" | "seed" | "scatters"> {
  const r = mulberry(s.seed);
  const Xe = xeAt(zNow(s), p);
  const ph = s.photons.slice();
  let sc = s.scatters;
  const speed = 0.7;
  const rate = 7 * Xe;
  for (let i = 0; i < N_PHOT; i++) {
    let x = ph[3 * i]! + speed * dt * Math.cos(ph[3 * i + 2]!);
    let y = ph[3 * i + 1]! + speed * dt * Math.sin(ph[3 * i + 2]!);
    if (x > 1) x -= 2;
    if (x < -1) x += 2;
    if (y > 1) y -= 2;
    if (y < -1) y += 2;
    ph[3 * i] = x;
    ph[3 * i + 1] = y;
    if (r() < 1 - Math.exp(-rate * dt)) {
      ph[3 * i + 2] = 2 * Math.PI * r();
      sc++;
    }
  }
  return { photons: ph, seed: Math.floor(r() * 2 ** 31), scatters: sc };
}

// ------------------------------------------------------------------ tema 2: matéria escura
const galaxy = (p: Params): GalaxyModel => GALAXIES[clamp(Math.round(num(p, "galaxia")), 0, GALAXIES.length - 1)]!;
const dataCache = new Map<number, RotPoint[]>();
export const dataFor = (p: Params) => {
  const k = clamp(Math.round(num(p, "galaxia")), 0, GALAXIES.length - 1);
  if (!dataCache.has(k)) dataCache.set(k, rotationData(GALAXIES[k]!));
  return dataCache.get(k)!;
};
export const haloMass = (p: Params) => (num(p, "halo", 1) >= 0.5 ? num(p, "Mh", 1) * 1e10 : 0);
const rcOf = (p: Params) => num(p, "rc", 5);
const ups = (p: Params) => num(p, "ups", 1);
/** 1 km/s/kpc em rad/Myr. */
const KMS_KPC_RAD_MYR = 1.0227e-3;
const MYR_PER_S = 20;
const N_STARS = 300;

function drawDark(d: Draw, s: CState, p: Params) {
  const th = d.theme;
  const u = ui(d);
  const g = galaxy(p);
  const Mh = haloMass(p);
  const rc = rcOf(p);
  const up = ups(p);
  const data = dataFor(p);
  u.text(`Curva de rotação: ${g.name}`, -16.6, 8.9, { size: 15, weight: "700", align: "left" });
  // disco visto de frente
  const G = { cx: -10.4, cy: 1.9, R: 5.7 };
  const k = G.R / (g.Rmax * 1.02);
  d.circle(G.cx, G.cy, G.R, { fill: th.dark ? "#06080e" : "#10172a", alpha: 0.95 });
  const tMyr = s.clock * MYR_PER_S;
  for (let i = 0; i < N_STARS; i++) {
    // raios com distribuição de disco exponencial (aproximada) e uma pitada de braços
    const rr = Math.min(g.Rmax, -g.Rd * (i % 3 === 0 ? 3.5 : 1.6) * Math.log(1 - 0.995 * hash(i + 3)) + 0.15);
    const om = rotation(rr, g, Mh, rc, up).total / rr;
    const th0 = 2 * Math.PI * hash(i + 300) + (i % 2 ? Math.PI : 0) * 0 + 0.9 * Math.log(rr + 1) * (i % 3 === 0 ? 1 : 0);
    const ang = th0 + om * KMS_KPC_RAD_MYR * tMyr;
    const bright = 0.45 + 0.55 * hash(i + 900);
    d.dot(G.cx + rr * k * Math.cos(ang), G.cy + rr * k * Math.sin(ang), 1.6 + bright, rr < 0.25 * g.Rmax ? "#ffe2a8" : "#bcd4ff", bright);
  }
  // marcadores alinhados no início: com o modelo atual (cheios) e sem halo (vazios)
  for (let j = 1; j <= 6; j++) {
    const rr = (g.Rmax * j) / 6.3;
    const a1 = rotation(rr, g, Mh, rc, up).total / rr * KMS_KPC_RAD_MYR * tMyr;
    const a0 = rotation(rr, g, 0, rc, up).total / rr * KMS_KPC_RAD_MYR * tMyr;
    d.dot(G.cx + rr * k * Math.cos(a1), G.cy + rr * k * Math.sin(a1), 5, th.series[1]!);
    d.circle(G.cx + rr * k * Math.cos(a0), G.cy + rr * k * Math.sin(a0), 0, { minPx: 5, stroke: "#9fb3d1", width: 1.5 });
  }
  u.text(`t = ${fmt(tMyr, 3)} milhões de anos   (raio ${fmt(g.Rmax, 3)} kpc)`, G.cx, G.cy - G.R - 0.5, { size: 10.5 });
  u.text("● com o modelo atual   ○ só matéria visível (no início, todos alinhados)", G.cx, G.cy - G.R - 1.15, { size: 9.5, color: th.muted });
  // massas
  const Rn = g.Rmax;
  const vis = massFromV(rotation(Rn, g, 0, rc, up).total, Rn);
  const dark = Mh > 0 ? haloMassIn(Rn, Mh, rc, Rn) : 0;
  const vObs = data[data.length - 1]!.v;
  const mDyn = massFromV(vObs, data[data.length - 1]!.r);
  const c2 = chi2(data, g, Mh, rc, up);
  const rows: [string, string, string?][] = [
    ["massa visível (estrelas, gás, bojo) em Rmáx", `${sci(vis, 3)} M☉`],
    ["massa escura do modelo em Rmáx", `${sci(dark, 3)} M☉`],
    ["massa dinâmica v²R/G (último ponto)", `${sci(mDyn, 3)} M☉`],
    ["fração escura do modelo", `${fmt((100 * dark) / Math.max(dark + vis, 1), 3)}%`],
    ["χ² reduzido do ajuste", fmt(c2, 3), c2 < 2 ? th.series[2]! : th.positive],
  ];
  rows.forEach(([kk, v, c], i) => {
    const y = -6.1 - i * 0.6;
    u.text(kk, -16.6, y, { size: 10.5, align: "left", color: th.muted });
    u.text(v, -5.2, y, { size: 11, align: "left", weight: "700", color: c ?? th.text });
  });

  // curva de rotação
  const pb = { x0: 2.2, y0: -6.4, x1: 16.4, y1: 7.4 };
  const pl = panel(d, pb, { min: 0, max: g.Rmax * 1.05 }, { min: 0, max: g.vScale });
  pl.frame({ xlabel: "raio r (kpc)", ylabel: "velocidade orbital v (km/s)", fx: (v) => String(Math.round(v)), fy: (v) => String(Math.round(v)) });
  const R = g.Rmax * 1.05;
  const curve = (f: (r: number) => number, color: string, width: number, dash: number[] = []) => pl.plot(f, 0.05, R, { color, width, dash, n: 160 });
  curve((r) => rotation(r, g, Mh, rc, up).disk, th.series[0]!, 1.4, [5, 3]);
  curve((r) => rotation(r, g, Mh, rc, up).gas, th.series[2]!, 1.4, [5, 3]);
  if (g.Mb > 0) curve((r) => rotation(r, g, Mh, rc, up).bulge, th.series[5]!, 1.4, [5, 3]);
  if (Mh > 0) curve((r) => rotation(r, g, Mh, rc, up).halo, th.series[4]!, 1.6, [2, 3]);
  curve((r) => rotation(r, g, 0, rc, up).total, th.muted, 1.6);
  curve((r) => rotation(r, g, Mh, rc, up).total, th.series[1]!, 2.6);
  for (const pt of data) {
    d.line(pl.X(pt.r), pl.Y(pt.v - pt.err), pl.X(pt.r), pl.Y(pt.v + pt.err), { color: th.text, width: 1 });
    d.dot(pl.X(pt.r), pl.Y(pt.v), 3, th.text);
  }
  const leg: [string, string][] = [
    ["total do modelo", th.series[1]!],
    ["só matéria visível", th.muted],
    ["disco estelar", th.series[0]!],
    ["gás", th.series[2]!],
    ...(g.Mb > 0 ? ([["bojo", th.series[5]!]] as [string, string][]) : []),
    ["halo escuro", th.series[4]!],
  ];
  leg.forEach(([t, c], i) => {
    const x = pb.x0 + 0.4 + (i % 3) * 4.7;
    const y = pb.y1 + 1.65 - Math.floor(i / 3) * 0.55;
    d.line(x, y, x + 0.7, y, { color: c, width: 2.2 });
    u.text(t, x + 0.85, y, { size: 9.5, align: "left" });
  });
  u.text("pontos: dados sintéticos com barras de erro (efeito Doppler)", pb.x0, pb.y0 - 1.3, { size: 9.5, align: "left", color: th.muted });
  const best = bestHalo(data, g, rc, up);
  u.text(`melhor halo para estes rc e Υ: ${sci(best, 3)} M☉ dentro de ${fmt(g.Rmax, 3)} kpc`, pb.x0, pb.y0 - 1.95, { size: 10, align: "left", color: th.series[4]!, weight: "600" });
  u.text("Kepler (massa concentrada): v ∝ 1/√r;  observado: v ≈ constante", pb.x0, pb.y0 - 2.6, { size: 10, align: "left", color: th.muted });
}

// ------------------------------------------------------------------ tema 3: big bang e a(t)
const MODELS = [
  { label: "Personalizado (use Ω_m e Ω_Λ)" },
  { label: "ΛCDM (Ω_m = 0,315, Ω_Λ = 0,685)" },
  { label: "Einstein–de Sitter (só matéria, Ω_m = 1)" },
  { label: "Só radiação (Ω_r = 1)" },
  { label: "Aberto sem Λ (Ω_m = 0,3)" },
  { label: "Fechado sem Λ (Ω_m = 3): Big Crunch" },
];
export function cosmoFor(p: Params): Cosmo {
  const h0 = H0(p);
  switch (Math.round(num(p, "modelo", 1))) {
    case 1:
      return { H0: h0, Om: 0.315, Or: OMEGA_R, OL: 0.685 - OMEGA_R };
    case 2:
      return { H0: h0, Om: 1 - OMEGA_R, Or: OMEGA_R, OL: 0 };
    case 3:
      return { H0: h0, Om: 0, Or: 1, OL: 0 };
    case 4:
      return { H0: h0, Om: 0.3, Or: OMEGA_R, OL: 0 };
    case 5:
      return { H0: h0, Om: 3, Or: OMEGA_R, OL: 0 };
    default:
      return { H0: h0, Om: num(p, "Om", 0.3), Or: OMEGA_R, OL: num(p, "OL", 0.7) };
  }
}
const A_START = 0.01;
const T_MAX = 60;
export function bigBangInit(c: Cosmo): { tc: number; a: number; ad: number } {
  if (hasBigBang(c)) {
    const a = A_START;
    return { tc: ageAt(a, c), a, ad: hInvGyr(c.H0) * a * Math.sqrt(E2(a, c)) };
  }
  return { tc: 0, a: 1, ad: hInvGyr(c.H0) * Math.sqrt(Math.max(E2(1, c), 0)) };
}
/** Avança o fator de escala por h Gyr com subpassos limitados por 1/H. */
export function advanceScale(st: { tc: number; a: number; ad: number }, h: number, c: Cosmo) {
  let { tc, a, ad } = st;
  let left = h;
  while (left > 1e-12) {
    const H = Math.abs(ad / a);
    const sub = Math.min(left, 0.02 / Math.max(H, 1e-3), 0.02);
    [a, ad] = stepScale(a, ad, sub, c);
    tc += sub;
    left -= sub;
    if (a <= A_START * 0.5) break;
  }
  return { tc, a, ad };
}
const curveCache = new Map<string, [number, number][]>();
export function scaleCurve(c: Cosmo): [number, number][] {
  const key = `${c.H0}|${c.Om}|${c.Or}|${c.OL}`;
  const hit = curveCache.get(key);
  if (hit) return hit;
  let st = bigBangInit(c);
  const pts: [number, number][] = hasBigBang(c) ? [[0, 0]] : [];
  pts.push([st.tc, st.a]);
  while (st.tc < T_MAX && st.a > A_START * 0.5 && st.a < 50) {
    st = advanceScale(st, 0.1, c);
    pts.push([st.tc, st.a]);
  }
  if (curveCache.size > 40) curveCache.clear();
  curveCache.set(key, pts);
  return pts;
}

function drawBigBang(d: Draw, s: CState, p: Params) {
  const th = d.theme;
  const u = ui(d);
  const c = cosmoFor(p);
  const bb = hasBigBang(c);
  const t0 = bb ? ageAt(1, c) : Number.NaN;
  u.text("Fator de escala a(t) e a história do universo", -16.6, 8.9, { size: 15, weight: "700", align: "left" });
  const box = { x0: -15.2, y0: -2.6, x1: 1.4, y1: 7.4 };
  const tmax = 40;
  const pl = panel(d, box, { min: 0, max: tmax }, { min: 0, max: 3 });
  pl.frame({ xlabel: "tempo cósmico t (bilhões de anos)", ylabel: "a(t)  (a = 1 hoje)", fx: (v) => String(Math.round(v)) });
  const H = hInvGyr(c.H0);
  // curvas de referência com o mesmo H₀, todas passando por a = 1 hoje
  const tEdS = 2 / (3 * H);
  const tRad = 1 / (2 * H);
  pl.plot((t) => (t / tEdS) ** (2 / 3), 0, tmax, { color: th.series[0]!, width: 1.2, dash: [5, 4] });
  pl.plot((t) => Math.sqrt(t / tRad), 0, tmax, { color: th.series[2]!, width: 1.2, dash: [5, 4] });
  if (bb) pl.plot((t) => Math.exp(H * (t - t0)), 0, tmax, { color: th.series[4]!, width: 1.2, dash: [2, 3] });
  pl.line(scaleCurve(c), { color: th.series[1]!, width: 2.6 });
  if (bb) {
    d.line(pl.X(t0), box.y0, pl.X(t0), pl.Y(1), { color: th.muted, width: 1, dash: [3, 3] });
    d.line(box.x0, pl.Y(1), pl.X(t0), pl.Y(1), { color: th.muted, width: 1, dash: [3, 3] });
    u.text(`hoje: t₀ = ${fmt(t0, 4)}`, pl.X(t0), pl.Y(1), { size: 10, align: "left", dx: 4, dy: -9, color: th.muted, weight: "600" });
  }
  if (s.tc <= tmax && s.a <= 3) d.dot(pl.X(Math.max(s.tc, 0)), pl.Y(s.a), 7, th.accent);
  const leg: [string, string][] = [
    ["modelo escolhido", th.series[1]!],
    ["só matéria a ∝ t^(2/3)", th.series[0]!],
    ["só radiação a ∝ t^(1/2)", th.series[2]!],
    ["só Λ a ∝ e^(Ht)", th.series[4]!],
  ];
  leg.forEach(([t, col], i) => {
    const x = box.x0 + 0.3 + (i % 2) * 6.2;
    const y = box.y1 - 0.4 - Math.floor(i / 2) * 0.55;
    d.line(x, y, x + 0.7, y, { color: col, width: 2.2 });
    u.text(t, x + 0.85, y, { size: 9.5, align: "left" });
  });

  // caixa que se expande
  const gx = 5.2;
  const gy = 5.0;
  const half = 2.6;
  d.rect(gx - half, gy - half, 2 * half, 2 * half, { fill: th.dark ? "#06080e" : "#10172a", alpha: 0.95 });
  const ctx = d.ctx;
  ctx.save();
  ctx.beginPath();
  ctx.rect(gx - half, gy - half, 2 * half, 2 * half);
  ctx.clip();
  const sp = 1.1 * s.a;
  for (let i = -6; i <= 6; i++)
    for (let j = -6; j <= 6; j++) {
      const x = gx + i * sp;
      const y = gy + j * sp;
      if (Math.abs(x - gx) < half + 0.2 && Math.abs(y - gy) < half + 0.2) d.dot(x, y, 2.6, "#f2e6c9");
    }
  ctx.restore();
  u.text("separação entre galáxias ∝ a(t)", gx, gy - half - 0.45, { size: 9.5, color: th.muted });
  const z = 1 / s.a - 1;
  const Hnow = hubbleAt(s.a, c);
  const q = decel(s.a, c);
  const rows: [string, string][] = [
    ["t", yearsTxt(s.tc)],
    ["a", fmt(s.a, 4)],
    ["z = 1/a − 1", z > -1 ? fmt(z, 4) : "—"],
    ["T = T₀/a", `${sci(T0 / s.a, 3)} K`],
    ["H(t)", `${fmt(Hnow, 4)} km/s/Mpc`],
    ["q = −äa/ȧ²", `${fmt(q, 3)} (${q < 0 ? "acelerando" : "freando"})`],
  ];
  rows.forEach(([k, v], i) => {
    const y = 7.4 - i * 0.66;
    u.text(k, 8.5, y, { size: 10.5, align: "left", color: th.muted });
    u.text(v, 16.5, y, { size: 10.5, align: "right", weight: "600" });
  });
  u.text(`Ωm = ${fmt(c.Om, 3)}   Ωr = ${sci(c.Or, 2)}   ΩΛ = ${fmt(c.OL, 3)}   Ωk = ${fmt(1 - c.Om - c.Or - c.OL, 3)}`, 2.6, 0.9, { size: 10.5, align: "left" });
  u.text(bb ? `idade: ${fmt(t0, 4)} bilhões de anos = ${fmt(t0 * H, 3)} × (1/H₀)   1/H₀ = ${fmt(1 / H, 4)}` : "sem big bang: H² < 0 no passado (o universo teria um ricochete)", 2.6, 0.2, { size: 10.5, align: "left", weight: "600", color: th.accent });

  // linha do tempo (log)
  const tl = { x0: -15.2, x1: 16.2, y: -6.7 };
  const L0 = -7;
  const L1 = 11;
  const X = (yr: number) => tl.x0 + ((Math.log10(yr) - L0) / (L1 - L0)) * (tl.x1 - tl.x0);
  u.text("Linha do tempo (escala logarítmica, em anos)", tl.x0, -4.0, { size: 12, weight: "700", align: "left" });
  d.line(tl.x0, tl.y, tl.x1, tl.y, { color: th.text, width: 2 });
  for (let e = L0; e <= L1; e += 2) {
    d.line(X(10 ** e), tl.y - 0.15, X(10 ** e), tl.y + 0.15, { color: th.text, width: 1 });
    u.text(`10${String(e).replace(/-/g, "⁻").replace(/\d/g, (ch) => "⁰¹²³⁴⁵⁶⁷⁸⁹"[Number(ch)]!)}`, X(10 ** e), tl.y - 0.5, { size: 9, color: th.muted });
  }
  if (bb) {
    const ev: [string, number, number][] = [];
    const at = (a: number) => ageAt(a, c, 1200) * 1e9;
    ev.push(["nucleossíntese (T ≈ 10⁹ K)", at(T0 / 1e9), 1]);
    if (c.Om > 0 && c.Or > 0) ev.push(["igualdade matéria–radiação", at(c.Or / c.Om), -1]);
    ev.push([`desacoplamento (z ≈ ${Z_DEC})`, at(1 / (1 + Z_DEC)), 1]);
    ev.push(["primeiras estrelas (z ≈ 20)", at(1 / 21), -1]);
    if (c.OL > 0 && c.Om > 0) {
      const aAcc = (c.Om / (2 * c.OL)) ** (1 / 3);
      if (aAcc < 1) ev.push(["começa a aceleração", at(aAcc), 1]);
    }
    ev.push(["hoje", t0 * 1e9, 2]);
    for (const [lab, yr, lvl] of ev) {
      if (!Number.isFinite(yr) || yr <= 0) continue;
      const x = X(clamp(yr, 10 ** L0, 10 ** L1));
      const up = lvl > 0;
      const off = lvl === 2 ? 2.2 : 1.1;
      d.line(x, tl.y, x, tl.y + (up ? off - 0.25 : -1.2), { color: th.series[4]!, width: 1 });
      d.dot(x, tl.y, 4, th.series[4]!);
      const al = x > tl.x1 - 3 ? "right" : x < tl.x0 + 3 ? "left" : "center";
      u.text(lab, x, tl.y + (up ? off + 0.55 : -1.5), { size: 9.5, color: th.text, weight: "600", align: al });
      u.text(yearsTxt(yr / 1e9), x, tl.y + (up ? off : -2.0), { size: 8.5, color: th.muted, align: al });
    }
  }
  if (s.tc > 0) {
    const x = X(clamp(s.tc * 1e9, 10 ** L0, 10 ** L1));
    d.circle(x, tl.y, 0, { minPx: 8, stroke: th.accent, width: 2.5 });
    d.dot(x, tl.y, 4, th.accent);
  }
}

// ------------------------------------------------------------------ simulação

const initState = (p: Params): CState => {
  const bb = bigBangInit(cosmoFor(p));
  return {
    clock: 0,
    tH: 0,
    obs: 0,
    lnz: Math.log(1 + num(p, "zIni", 3000)),
    photons: initPhotons(5),
    scatters: 0,
    seed: 99,
    ...bb,
  };
};

export const cosmologia = defineSim<CState>({
  id: "cosmologia",
  title: "Cosmologia: expansão, radiação de fundo e matéria escura",
  course: "FG IV",
  topic: "Cosmologia",
  priority: "P1",
  summary:
    "Galáxias se afastando num universo em expansão, com o diagrama de Hubble medido de qualquer galáxia e o ajuste de H₀; o espectro de corpo negro da radiação de fundo esfriando com a expansão até o desacoplamento (equação de Saha); a curva de rotação de uma galáxia ajustada com um halo de matéria escura; e o fator de escala a(t) das equações de Friedmann, com a linha do tempo e a idade do universo.",
  derivation,
  equations: [
    String.raw`v = H_0\,d \qquad t_H = \frac{1}{H_0} = \frac{977{,}8}{H_0\ [\text{km/s/Mpc}]}\ \text{bilhões de anos}`,
    String.raw`T = T_0(1 + z) = \frac{T_0}{a} \qquad B_\nu = \frac{2h\nu^3}{c^2}\frac{1}{e^{h\nu/kT} - 1} \qquad \lambda_\text{máx}T = 2{,}898\ \text{mm·K}`,
    String.raw`\frac{X_e^2}{1 - X_e} = \frac{1}{n_b}\left(\frac{m_e kT}{2\pi\hbar^2}\right)^{3/2} e^{-13{,}6\ \text{eV}/kT}`,
    String.raw`v^2(r) = \frac{G M(r)}{r} \qquad v^2 = v_\text{disco}^2 + v_\text{gás}^2 + v_\text{bojo}^2 + v_\text{halo}^2`,
    String.raw`H^2 = H_0^2\left(\Omega_r a^{-4} + \Omega_m a^{-3} + \Omega_k a^{-2} + \Omega_\Lambda\right) \qquad \frac{\ddot a}{a} = -\frac{H_0^2}{2}\left(2\Omega_r a^{-4} + \Omega_m a^{-3} - 2\Omega_\Lambda\right)`,
  ],
  liveEquations(s, p) {
    const tm = theme(p);
    if (tm === 0) {
      const f = fitHubble(hubbleMeasurements(s, p));
      return [String.raw`H_0^\text{ajuste} = \frac{\sum v_i d_i}{\sum d_i^2} = ${texNum(f.H, 4)} \pm ${texNum(f.sigma, 2)}\ \text{km/s/Mpc} \qquad t_H = \frac{977{,}8}{${texNum(f.H, 4)}} = ${texNum(HUBBLE_GYR / f.H, 3)}\ \text{Gyr}`];
    }
    if (tm === 1) {
      const z = zNow(s);
      const T = tempAt(z);
      return [
        String.raw`T = ${texNum(T0, 5)}\ \text{K} \times (1 + ${texNum(z, 4)}) = ${texNum(T, 4)}\ \text{K} \qquad \lambda_\text{máx} = \frac{2{,}898\ \text{mm·K}}{T} = ${texNum(lambdaMax(T) * 1e3, 3)}\ \text{mm}`,
        String.raw`X_e = ${texNum(xeAt(z, p), 3)} \qquad n_\gamma = ${texNum(photonDensity(T) / 1e6, 3)}\ \text{cm}^{-3} \qquad u = aT^4 = ${texNum(energyDensity(T), 3)}\ \text{J/m}^3`,
      ];
    }
    if (tm === 2) {
      const g = galaxy(p);
      const data = dataFor(p);
      const last = data[data.length - 1]!;
      return [
        String.raw`M(<${texNum(last.r, 3)}\ \text{kpc}) = \frac{v^2 r}{G} = \frac{(${texNum(last.v, 3)})^2 \times ${texNum(last.r, 3)}}{${texNum(G_KPC, 4)}} = ${texNum(massFromV(last.v, last.r), 3)}\ M_\odot`,
        String.raw`\chi^2_\nu = ${texNum(chi2(data, g, haloMass(p), rcOf(p), ups(p)), 3)} \qquad M_\text{halo} = ${texNum(haloMass(p), 3)}\ M_\odot`,
      ];
    }
    const c = cosmoFor(p);
    const t0 = ageAt(1, c);
    return [
      String.raw`H(a = ${texNum(s.a, 3)}) = ${texNum(c.H0, 3)}\sqrt{${texNum(c.Or, 2)}a^{-4} + ${texNum(c.Om, 3)}a^{-3} + ${texNum(1 - c.Om - c.Or - c.OL, 3)}a^{-2} + ${texNum(c.OL, 3)}} = ${texNum(hubbleAt(s.a, c), 4)}\ \text{km/s/Mpc}`,
      String.raw`t_0 = \int_0^1 \frac{da}{aH(a)} = ${Number.isFinite(t0) ? texNum(t0, 4) + String.raw`\ \text{Gyr}` : String.raw`\text{indefinido (sem big bang)}`}`,
    ];
  },
  params: [
    {
      key: "tema",
      label: "Tema",
      unit: "",
      min: 0,
      max: 3,
      step: 1,
      default: 0,
      options: [
        { value: 0, label: "Lei de Hubble" },
        { value: 1, label: "Radiação cósmica de fundo" },
        { value: 2, label: "Matéria escura" },
        { value: 3, label: "Big bang e a(t)" },
      ],
    },
    { key: "H0", label: "Constante de Hubble H₀", unit: "km/s/Mpc", min: 40, max: 100, step: 0.1, default: 70 },
    { key: "sigmaV", label: "Velocidades peculiares σ_v", unit: "km/s", min: 0, max: 2000, step: 10, default: 300, live: true },
    { key: "erroD", label: "Erro das distâncias", unit: "%", min: 0, max: 40, step: 0.5, default: 5, live: true },
    { key: "nGal", label: "Número de galáxias", unit: "", min: 8, max: 80, step: 1, default: 30 },
    { key: "zIni", label: "Redshift inicial", unit: "", min: 0, max: 5000, step: 10, default: 3000 },
    { key: "eta", label: "Bárions por fóton η", unit: "× 10⁻¹⁰", min: 0.1, max: 100, step: 0.1, default: 6.1, log: true, live: true },
    { key: "galaxia", label: "Galáxia", unit: "", min: 0, max: 1, step: 1, default: 0, options: GALAXIES.map((g, i) => ({ value: i, label: g.name })) },
    { key: "halo", label: "Halo de matéria escura", unit: "", min: 0, max: 1, step: 1, default: 0, live: true, options: [{ value: 0, label: "Sem halo" }, { value: 1, label: "Com halo" }] },
    { key: "Mh", label: "Massa do halo dentro de Rmáx", unit: "10¹⁰ M☉", min: 0.01, max: 100, step: 0.01, default: 5, log: true, live: true },
    { key: "rc", label: "Raio do núcleo do halo r_c", unit: "kpc", min: 0.3, max: 20, step: 0.1, default: 5, live: true },
    { key: "ups", label: "Massa do disco estelar (× valor de referência)", unit: "", min: 0.2, max: 2.5, step: 0.05, default: 1, live: true },
    { key: "modelo", label: "Modelo de universo", unit: "", min: 0, max: MODELS.length - 1, step: 1, default: 1, options: MODELS.map((m, i) => ({ value: i, label: m.label })) },
    { key: "Om", label: "Ω_m (personalizado)", unit: "", min: 0, max: 3, step: 0.01, default: 0.3 },
    { key: "OL", label: "Ω_Λ (personalizado)", unit: "", min: -0.5, max: 2, step: 0.01, default: 0.7 },
  ],
  observables: [
    { key: "Hfit", label: "H₀ ajustado", unit: "km/s/Mpc", value: (s, p) => fitHubble(hubbleMeasurements(s, p)).H },
    { key: "tHubble", label: "idade de Hubble 1/H₀ (ajuste)", unit: "Gyr", value: (s, p) => { const h = fitHubble(hubbleMeasurements(s, p)).H; return h > 0 ? HUBBLE_GYR / h : 0; } },
    { key: "aH", label: "fator de escala (Hubble)", unit: "", value: (s, p) => scaleHubble(s, p) },
    { key: "z", label: "redshift z (radiação)", unit: "", value: (s) => zNow(s) },
    { key: "T", label: "temperatura da radiação", unit: "K", value: (s) => tempAt(zNow(s)) },
    { key: "lambdaMax", label: "λ do pico (Wien)", unit: "mm", value: (s) => lambdaMax(tempAt(zNow(s))) * 1e3 },
    { key: "Xe", label: "fração ionizada Xₑ", unit: "", value: (s, p) => xeAt(zNow(s), p) },
    { key: "chi2", label: "χ² reduzido da curva de rotação", unit: "", value: (_s, p) => chi2(dataFor(p), galaxy(p), haloMass(p), rcOf(p), ups(p)) },
    { key: "vRmax", label: "v do modelo em Rmáx", unit: "km/s", value: (_s, p) => rotation(galaxy(p).Rmax, galaxy(p), haloMass(p), rcOf(p), ups(p)).total },
    { key: "tc", label: "tempo cósmico", unit: "Gyr", value: (s) => s.tc },
    { key: "a", label: "fator de escala a(t)", unit: "", value: (s) => s.a },
    { key: "Ht", label: "H(t)", unit: "km/s/Mpc", value: (s, p) => hubbleAt(s.a, cosmoFor(p)) },
    { key: "t0", label: "idade do universo t₀", unit: "Gyr", value: (_s, p) => { const t = ageAt(1, cosmoFor(p), 600); return Number.isFinite(t) ? t : 0; } },
  ],
  chart: { x: "tc", y: "a" },
  scenarios: [
    {
      id: "hubble",
      label: "Lei de Hubble",
      params: { tema: 0, H0: 70, sigmaV: 300, erroD: 5, nGal: 30 },
      guide: String.raw`### Medindo a expansão
1. Rode: as distâncias entre todas as galáxias crescem pelo mesmo fator $a(t)$. As setas laranja são as velocidades de afastamento que você mede (pelo **redshift** das linhas espectrais).
2. No diagrama $v \times d$ os pontos caem numa reta: $v = H_0 d$. A sim ajusta a reta pela origem por mínimos quadrados, $H_0 = \sum v_i d_i / \sum d_i^2$.
3. **Clique noutra galáxia** para observar de lá: o diagrama continua sendo uma reta com a mesma inclinação. Não há centro: todo observador se vê no meio da expansão.
4. A recíproca $1/H_0$ é a **idade de Hubble**: o tempo que as galáxias levariam para chegar onde estão com velocidade constante. Para $H_0 = 70$ km/s/Mpc ela vale 14 bilhões de anos.
5. Aumente as **velocidades peculiares** e o **erro das distâncias**: as galáxias próximas deixam de servir. Por isso Hubble errou $H_0$ por um fator ~7 em 1929.`,
      predict: [
        {
          question: "Vista de uma galáxia distante da nossa (na borda do mapa), como fica o diagrama de Hubble?",
          options: ["Ela vê as galáxias se aproximando", "Uma reta com a mesma inclinação H₀", "Uma reta mais inclinada, por estar longe do centro", "Uma curva: só o nosso ponto de vista dá uma reta"],
          answer: 1,
          explanation: "Com $\\vec r_i(t) = a(t)\\vec r_i(0)$, a velocidade relativa de duas galáxias é $\\dot a/a$ vezes a separação delas, para qualquer par. Toda galáxia mede $v = H_0 d$: a expansão não tem centro.",
        },
      ],
    },
    {
      id: "radiacao-fundo",
      label: "Radiação cósmica de fundo",
      params: { tema: 1, zIni: 3000, eta: 6.1 },
      guide: String.raw`### O eco do universo quente
1. Começamos em $z = 3000$: o universo era $3001$ vezes menor e a radiação estava a $T = T_0(1 + z) \approx 8200$ K. Os elétrons livres espalham os fótons o tempo todo: o plasma é **opaco**.
2. Rode: com a expansão, cada comprimento de onda estica com $a$ e o espectro continua sendo de **corpo negro**, só que mais frio. O pico segue a lei de Wien, $\lambda_\text{máx} T = 2{,}898$ mm·K.
3. Perto de $T \approx 3000$–$3700$ K os prótons capturam os elétrons (**recombinação**, curva de Saha). Sem elétrons livres, os fótons passam a voar livres: é o **desacoplamento**, em $z \approx 1090$, cerca de 380 mil anos depois do big bang.
4. Esses fótons chegam hoje a $2{,}725$ K, com pico em 160 GHz (micro-ondas). Há ~411 deles por cm³.
5. Mude $\eta$ (bárions por fóton): como há ~$10^9$ fótons por bárion, a recombinação só acontece bem abaixo de $13{,}6\ \text{eV}/k = 158\,000$ K.`,
      predict: [
        {
          question: "A energia de ionização do hidrogênio corresponde a 13,6 eV/k ≈ 158 000 K. A que temperatura o hidrogênio do universo primordial ficou neutro?",
          options: ["≈ 158 000 K", "≈ 50 000 K", "≈ 3 000–4 000 K", "≈ 2,7 K"],
          answer: 2,
          explanation: "Há cerca de $1{,}6\\times10^9$ fótons por bárion: mesmo quando $kT \\ll 13{,}6$ eV, a cauda de alta energia do corpo negro tem fótons suficientes para reionizar. A equação de Saha dá $X_e = 1/2$ perto de 3700 K; o desacoplamento observado é em ~3000 K.",
        },
      ],
    },
    {
      id: "materia-escura",
      label: "Matéria escura e curvas de rotação",
      params: { tema: 2, galaxia: 0, halo: 0, Mh: 5, rc: 6, ups: 1 },
      guide: String.raw`### Falta massa
1. Os pontos são velocidades orbitais medidas pelo efeito Doppler em estrelas e gás (dados sintéticos com ruído). A curva cinza é o que a matéria visível (disco estelar, gás e bojo) produz: ela **cai** fora do disco, como $1/\sqrt r$.
2. Os dados ficam **planos** até o último ponto. Com $v^2 = GM(r)/r$, curva plana significa $M(r) \propto r$: a massa continua crescendo onde quase não há luz.
3. Ligue o **halo** de matéria escura e ajuste a massa dele até o $\chi^2$ reduzido ficar perto de 1. Varie também $r_c$ e a massa do disco: há várias combinações aceitáveis (degenerescência disco–halo), mas nenhuma sem halo.
4. Veja o disco girando: sem halo as estrelas externas ficariam para trás (marcadores vazios); com o halo, todas as órbitas externas têm a mesma velocidade.
5. Troque para a **galáxia anã**: ela é dominada pela matéria escura em todos os raios.`,
      predict: [
        {
          question: "Se toda a massa de uma galáxia estivesse na região visível, como deveria variar a velocidade orbital do gás bem fora do disco?",
          options: ["Constante", "Crescendo com r", "Caindo como 1/√r", "Caindo como 1/r²"],
          answer: 2,
          explanation: "Fora da massa, $v = \\sqrt{GM/r}$ (como os planetas em torno do Sol). As curvas observadas são planas: $M(r)$ cresce com $r$, o que indica um halo de matéria não luminosa.",
        },
      ],
    },
    {
      id: "big-bang",
      label: "Big bang e o fator de escala",
      params: { tema: 3, modelo: 1, H0: 67.4 },
      guide: String.raw`### A história escrita em a(t)
1. As equações de Friedmann dão a taxa de expansão $H = \dot a/a$ a partir do conteúdo: radiação ($\propto a^{-4}$), matéria ($\propto a^{-3}$), curvatura ($\propto a^{-2}$) e constante cosmológica $\Lambda$ (constante).
2. Rode o modelo ΛCDM: no começo domina a radiação ($a \propto t^{1/2}$), depois a matéria ($a \propto t^{2/3}$), e há alguns bilhões de anos $\Lambda$ passou a dominar: a expansão **acelera** ($q < 0$).
3. A idade sai de $t_0 = \int_0^1 da/(aH)$: com $H_0 = 67{,}4$ km/s/Mpc dá **13,8 bilhões de anos**, quase igual a $1/H_0$ por coincidência.
4. Compare com Einstein–de Sitter ($t_0 = \tfrac{2}{3}/H_0 \approx 9{,}7$ bilhões de anos, mais novo que as estrelas mais velhas!) e com o fechado ($\Omega_m = 3$), que para de expandir e colapsa num **big crunch**.
5. A linha do tempo marca os eventos calculados para o modelo: nucleossíntese, igualdade matéria–radiação, desacoplamento, primeiras estrelas e o início da aceleração.`,
      predict: [
        {
          question: "Num universo só de matéria (Einstein–de Sitter) com o mesmo H₀, a idade do universo seria, comparada a 1/H₀:",
          options: ["Igual a 1/H₀", "2/3 de 1/H₀", "Maior que 1/H₀", "1/2 de 1/H₀"],
          answer: 1,
          explanation: "Com $a \\propto t^{2/3}$, $H = \\dot a/a = 2/(3t)$, logo $t_0 = \\tfrac{2}{3}H_0^{-1}$. A gravidade da matéria freou a expansão: no passado ela era mais rápida e a idade é menor que $1/H_0$. Com $\\Lambda$, a aceleração recente compensa e $t_0 \\approx 0{,}95/H_0$.",
        },
      ],
    },
  ],
  exercises: [
    {
      id: "hubble-v",
      prompt: "Com H₀ = {Hx} km/s/Mpc, com que velocidade, em km/s, se afasta de nós uma galáxia a {dx} Mpc (despreze a velocidade peculiar)?",
      vary: { Hx: [60, 80, 1], dx: [20, 600, 0] },
      fixed: { tema: 0 },
      answer: { label: "v", unit: "km/s", compute: (p) => num(p, "Hx", 70) * num(p, "dx", 100) },
    },
    {
      id: "hubble-idade",
      prompt: "Um ajuste do diagrama de Hubble dá H₀ = {Hx} km/s/Mpc. Qual a idade de Hubble 1/H₀, em bilhões de anos? (1 Mpc = 3,086 × 10¹⁹ km; 1 ano = 3,156 × 10⁷ s)",
      vary: { Hx: [50, 90, 1] },
      fixed: { tema: 0 },
      answer: { label: "1/H₀", unit: "Gyr", compute: (p) => HUBBLE_GYR / num(p, "Hx", 70) },
      hint: "1/H₀ = (3,086 × 10¹⁹ km/Mpc)/(H₀ km/s/Mpc), em segundos; divida por 3,156 × 10¹⁶ s.",
    },
    {
      id: "cmb-temperatura",
      prompt: "A radiação de fundo hoje está a 2,725 K. Qual era a temperatura dela, em kelvin, quando o universo tinha redshift z = {zx}?",
      vary: { zx: [5, 2000, 0] },
      fixed: { tema: 1 },
      answer: { label: "T", unit: "K", compute: (p) => tempAt(num(p, "zx", 1000), 2.725) },
    },
    {
      id: "cmb-pico",
      prompt: "Pela lei de Wien (λ_máx T = 2,898 mm·K), qual o comprimento de onda do pico do espectro da radiação de fundo, em micrômetros, quando ela estava a {Tx} K?",
      vary: { Tx: [100, 6000, 0] },
      fixed: { tema: 1 },
      answer: { label: "λ_máx", unit: "µm", compute: (p) => (2.897771955e-3 / num(p, "Tx", 3000)) * 1e6 },
    },
    {
      id: "massa-rotacao",
      prompt: "O gás de uma galáxia gira a {vx} km/s num raio de {rx} kpc. Qual a massa contida dentro desse raio, em unidades de 10¹⁰ massas solares? (G = 4,301 × 10⁻⁶ kpc (km/s)²/M☉)",
      vary: { vx: [50, 300, 0], rx: [2, 40, 1] },
      fixed: { tema: 2 },
      answer: { label: "M", unit: "10¹⁰ M☉", compute: (p) => massFromV(num(p, "vx", 200), num(p, "rx", 10)) / 1e10 },
      hint: "Órbita circular: GMm/r² = mv²/r, logo M = v²r/G.",
    },
    {
      id: "eds-idade",
      prompt: "Num universo só de matéria (Einstein–de Sitter) com H₀ = {Hx} km/s/Mpc, qual seria a idade do universo, em bilhões de anos?",
      vary: { Hx: [50, 90, 1] },
      fixed: { tema: 3, modelo: 2 },
      answer: { label: "t₀", unit: "Gyr", compute: (p) => ((2 / 3) * HUBBLE_GYR) / num(p, "Hx", 70) },
      hint: "a ∝ t^(2/3) ⇒ H = 2/(3t); 1/H₀ = 977,8/H₀ bilhões de anos.",
    },
    {
      id: "z-igualdade",
      prompt: "Hoje Ω_m = {Omx} e Ω_r = 9,15 × 10⁻⁵. Em que redshift a densidade de matéria era igual à de radiação?",
      vary: { Omx: [0.2, 0.5, 3] },
      fixed: { tema: 3 },
      answer: { label: "z_eq", unit: "", compute: (p) => num(p, "Omx", 0.3) / OMEGA_R - 1 },
      hint: "ρ_m ∝ a⁻³ e ρ_r ∝ a⁻⁴: são iguais em a = Ω_r/Ω_m; z = 1/a − 1.",
    },
  ],
  init: initState,
  step(s, p, _t, dt) {
    const tm = theme(p);
    const ns: CState = { ...s, clock: s.clock + dt };
    if (tm === 0) ns.tH = s.tH + 0.1 * dt;
    else if (tm === 1) {
      // mais devagar perto da recombinação (ln(1 + z) ≈ 7,1)
      ns.lnz = Math.max(0, s.lnz - (0.5 - 0.42 * Math.exp(-(((s.lnz - 7.1) / 0.45) ** 2))) * dt);
      Object.assign(ns, stepPhotons(s, p, dt));
    } else if (tm === 3) Object.assign(ns, advanceScale(s, 1 * dt, cosmoFor(p)));
    return ns;
  },
  stopWhen(s, p) {
    const tm = theme(p);
    if (tm === 0) return 6 - s.tH;
    if (tm === 3) return Math.min(s.a - A_START * 0.5, T_MAX - s.tc);
    return 1;
  },
  dt: 1 / 30,
  sampleEvery: 3,
  maxSamples: 4000,
  actions: [
    { id: "nossa", label: "Voltar a observar da Via Láctea", run: (s) => ({ ...s, obs: 0 }) },
  ],
  pointer: {
    down(s, p, pt) {
      if (theme(p) === 0) {
        const i = hubbleHit(s, p, pt);
        return i === null ? undefined : { ...s, obs: i };
      }
      return undefined;
    },
    cursor(s, p, pt) {
      return theme(p) === 0 && hubbleHit(s, p, pt) !== null ? "pointer" : undefined;
    },
  },
  narrowSplit: () => 0.512,
  viewport: () => ({ ...VIEW, unit: "" }),
  render(ctx, frame) {
    const d = draw(ctx, frame);
    const { state: s, params: p } = frame;
    switch (theme(p)) {
      case 0:
        drawHubble(d, s, p);
        break;
      case 1:
        drawCMB(d, s, p);
        break;
      case 2:
        drawDark(d, s, p);
        break;
      default:
        drawBigBang(d, s, p);
    }
  },
});

export default cosmologia;
