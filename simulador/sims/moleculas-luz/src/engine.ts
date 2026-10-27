import { num, type Params } from "@fisilab/core";
import { MOLECULES, type Molecule } from "./molecules.ts";

/**
 * Interação de fótons com uma molécula isolada.
 * Cada fóton tem comprimento de onda λ; ao passar pela molécula é absorvido com probabilidade
 * P(λ) = 1 − Π(1 − p_banda), somando:
 *  - rotação pura (micro-ondas/IV distante), só para moléculas polares (|μ| > 0);
 *  - vibração: bandas gaussianas de largura ~50 cm⁻¹ (envelope dos ramos P e R) nos modos ativos no IV;
 *  - transições eletrônicas e dissociação (visível/UV), em faixas de λ.
 * Depois de um tempo de vida sorteado a molécula reemite um fóton de mesmo λ em direção aleatória
 * (é assim que um gás estufa devolve parte da radiação da superfície). Na dissociação ela se parte.
 */

export const HC_EV_NM = 1239.84198; // hc em eV·nm
export const VIB_W = 50; // cm⁻¹
export const LIFETIME = 1.2; // s (escala de animação)
export const PH_SPEED = 5; // unidades de mundo por segundo
export const MOL_X = 7.5;
export const MOL_Y = 6.4;
export const LAMP_X = 1.3;
export const DET_X = 14.6;
export const MAX_PH = 80;
export const DIS_TIME = 3;

export const molOf = (p: Params): Molecule => MOLECULES[Math.round(num(p, "mol", 4))] ?? MOLECULES[4]!;
export const sourceOf = (p: Params) => Math.round(num(p, "fonte", 1));
export const toNu = (lamNm: number) => 1e7 / lamNm; // cm⁻¹
export const photonEV = (lamNm: number) => HC_EV_NM / lamNm;

export interface Band {
  kind: "rot" | "vib" | "ele" | "dis";
  p: number;
  mode: number;
  label: string;
}

/** Bandas que um fóton de λ (nm) excita, com a probabilidade de cada uma. */
export function bandsAt(m: Molecule, lam: number): Band[] {
  const out: Band[] = [];
  const nu = toNu(lam);
  if (m.rot) {
    const sl = (x: number) => 1 / (1 + Math.exp(-x));
    const ln = Math.log(nu);
    const p = m.rot.p * sl((ln - Math.log(m.rot.lo)) * 8) * sl((Math.log(m.rot.hi) - ln) * 8);
    if (p > 1e-4) out.push({ kind: "rot", p, mode: -1, label: "rotação" });
  }
  m.modes.forEach((md, k) => {
    if (!md.ir) return;
    const p = 0.85 * Math.exp(-(((nu - md.nu) / VIB_W) ** 2));
    if (p > 1e-4) out.push({ kind: "vib", p, mode: k, label: `vibração: ${md.name}` });
  });
  for (const e of m.elec) if (lam >= e.lo && lam < e.hi) out.push({ kind: e.dis ? "dis" : "ele", p: e.p, mode: -1, label: e.dis ? `dissociação: ${e.label}` : e.label });
  return out;
}
export function absorbP(m: Molecule, lam: number): number {
  return 1 - bandsAt(m, lam).reduce((a, b) => a * (1 - b.p), 1);
}

// ---------- Fontes ----------
const KB_EV = 8.617333e-5;
/** Planck: densidade espectral por unidade de ln λ, em unidades arbitrárias (energia). */
export const planckLn = (lamNm: number, T: number) => {
  const x = photonEV(lamNm) / (KB_EV * T);
  return x > 700 ? 0 : x ** 4 / Math.expm1(x);
};
const GRID = 600;
const logGrid = (a: number, b: number) => Array.from({ length: GRID }, (_, i) => a * (b / a) ** ((i + 0.5) / GRID));
/** Nós (λ) e pesos (número de fótons) de cada fonte, para sorteio e média. */
function sourceNodes(src: number, lamLaser: number): { lam: number[]; w: number[] } {
  switch (src) {
    case 0: {
      const lam = logGrid(5e5, 5e7);
      return { lam, w: lam.map(() => 1) };
    }
    case 1: {
      const lam = logGrid(2.5e3, 2e5);
      // número de fótons por ln λ ∝ energia/(hc/λ)
      return { lam, w: lam.map((l) => planckLn(l, 288) / photonEV(l)) };
    }
    case 2: {
      const lam = Array.from({ length: GRID }, (_, i) => 400 + (300 * (i + 0.5)) / GRID);
      return { lam, w: lam.map(() => 1) };
    }
    case 3: {
      const lam = logGrid(100, 400);
      return { lam, w: lam.map(() => 1) };
    }
    default:
      return { lam: [lamLaser], w: [1] };
  }
}
const cache = new Map<string, { lam: number[]; cdf: number[] }>();
function nodes(src: number, lamLaser: number) {
  const key = src === 4 ? `4:${lamLaser}` : String(src);
  let c = cache.get(key);
  if (!c) {
    const { lam, w } = sourceNodes(src, lamLaser);
    const tot = w.reduce((a, b) => a + b, 0);
    let acc = 0;
    c = { lam, cdf: w.map((v) => (acc += v / tot)) };
    if (cache.size > 64) cache.clear();
    cache.set(key, c);
  }
  return c;
}
export const laserLam = (p: Params) => num(p, "lambda", 15000);
export function sampleLambda(p: Params, u: number): number {
  const c = nodes(sourceOf(p), laserLam(p));
  let lo = 0, hi = c.cdf.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (c.cdf[mid]! < u) lo = mid + 1;
    else hi = mid;
  }
  return c.lam[lo]!;
}
/** Fração esperada de fótons da fonte que a molécula absorve. */
export function expectedAbsorption(m: Molecule, p: Params): number {
  const c = nodes(sourceOf(p), laserLam(p));
  let prev = 0, s = 0;
  c.lam.forEach((l, i) => {
    s += (c.cdf[i]! - prev) * absorbP(m, l);
    prev = c.cdf[i]!;
  });
  return s;
}

/**
 * Potencial estufa por molécula: fração da energia emitida por um corpo negro a 288 K
 * (a superfície da Terra, 3–100 μm) que cai em bandas que a molécula absorve.
 */
const GH = logGrid(3000, 100000);
const GHW = GH.map((l) => planckLn(l, 288));
const GHT = GHW.reduce((a, b) => a + b, 0);
export function greenhouseIndex(m: Molecule): number {
  let s = 0;
  GH.forEach((l, i) => (s += GHW[i]! * absorbP(m, l)));
  return s / GHT;
}

// ---------- Estado ----------
export interface Photon {
  x: number;
  y: number;
  vx: number;
  vy: number;
  lam: number;
  re: boolean;
  done: boolean;
}
export interface Pending {
  t: number;
  lam: number;
  kind: Band["kind"];
  mode: number;
}
export interface MlState {
  rs: number;
  t: number;
  theta: number;
  omega: number;
  amp: number[];
  glow: number;
  /** Instante da dissociação (−1 se inteira) e produtos. */
  disT: number;
  disLabel: string;
  pending: Pending[];
  ph: Photon[];
  emitAcc: number;
  nEmit: number;
  nAbs: number;
  nTrans: number;
  nReem: number;
  nDis: number;
  last: string;
}

export function rnd(s: { rs: number }): number {
  s.rs = (s.rs + 0x6d2b79f5) >>> 0;
  let t = s.rs;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function initState(p: Params): MlState {
  const m = molOf(p);
  return {
    rs: (Math.imul(Math.round(num(p, "seed", 1)), 0x9e3779b1) ^ 0x1b873593) >>> 0,
    t: 0,
    theta: 0,
    omega: 0,
    amp: m.modes.map(() => 0),
    glow: 0,
    disT: -1,
    disLabel: "",
    pending: [],
    ph: [],
    emitAcc: 0.8,
    nEmit: 0,
    nAbs: 0,
    nTrans: 0,
    nReem: 0,
    nDis: 0,
    last: "",
  };
}

export function fire(s: MlState, p: Params): void {
  if (s.ph.length >= MAX_PH) return;
  s.ph.push({ x: LAMP_X, y: MOL_Y, vx: PH_SPEED, vy: 0, lam: sampleLambda(p, rnd(s)), re: false, done: false });
  s.nEmit++;
}

export function step(s0: MlState, p: Params, dt: number): MlState {
  const s: MlState = { ...s0, ph: s0.ph.map((q) => ({ ...q })), pending: s0.pending.slice(), amp: s0.amp.slice() };
  const m = molOf(p);
  s.t = s0.t + dt;
  s.emitAcc += dt * num(p, "taxa", 2);
  while (s.emitAcc >= 1) {
    s.emitAcc -= 1;
    fire(s, p);
  }
  // dinâmica interna
  s.theta += s.omega * dt;
  s.glow = Math.max(0, s.glow - 0.05 * dt);
  if (s.disT >= 0 && s.t - s.disT > DIS_TIME) {
    s.disT = -1;
    s.disLabel = "";
    s.omega = 0;
    s.amp = s.amp.map(() => 0);
    s.glow = 0;
    s.pending = [];
    s.last = "uma nova molécula entrou no feixe";
  }
  // fótons
  const keep: Photon[] = [];
  for (const q of s.ph) {
    const xPrev = q.x;
    q.x += q.vx * dt;
    q.y += q.vy * dt;
    if (!q.re && !q.done && xPrev < MOL_X && q.x >= MOL_X) {
      q.done = true;
      if (s.disT < 0) {
        const bands = bandsAt(m, q.lam);
        const P = 1 - bands.reduce((a, b) => a * (1 - b.p), 1);
        if (rnd(s) < P) {
          // escolhe a banda proporcionalmente à probabilidade
          let u = rnd(s) * bands.reduce((a, b) => a + b.p, 0);
          const b = bands.find((x) => (u -= x.p) <= 0) ?? bands[bands.length - 1]!;
          s.nAbs++;
          s.last = `absorveu λ = ${fmtLam(q.lam)} → ${b.label}`;
          if (b.kind === "dis") {
            s.disT = s.t;
            s.disLabel = b.label.replace("dissociação: ", "");
            s.nDis++;
            s.pending = [];
          } else {
            if (b.kind === "rot") s.omega = Math.min(14, s.omega + 3);
            if (b.kind === "vib") s.amp[b.mode] = 1;
            if (b.kind === "ele") s.glow = 1;
            s.pending.push({ t: s.t - LIFETIME * Math.log(1 - rnd(s) * 0.999), lam: q.lam, kind: b.kind, mode: b.mode });
          }
          continue; // fóton absorvido
        }
      }
    }
    if (q.x > DET_X && !q.re) {
      s.nTrans++;
      continue;
    }
    if (q.x < -0.5 || q.x > 16.5 || q.y < 3.6 || q.y > 9.5) continue;
    keep.push(q);
  }
  s.ph = keep;
  // reemissão
  const rest: Pending[] = [];
  for (const e of s.pending) {
    if (e.t > s.t) {
      rest.push(e);
      continue;
    }
    const a = 2 * Math.PI * rnd(s);
    s.ph.push({ x: MOL_X, y: MOL_Y, vx: PH_SPEED * Math.cos(a), vy: PH_SPEED * Math.sin(a), lam: e.lam, re: true, done: true });
    s.nReem++;
    if (e.kind === "rot") s.omega = Math.max(0, s.omega - 3);
    if (e.kind === "vib") s.amp[e.mode] = 0;
    if (e.kind === "ele") s.glow = 0;
  }
  s.pending = rest;
  return s;
}

export function fmtLam(nm: number): string {
  const f = (v: number) => Number(v.toPrecision(3)).toString().replace(".", ",");
  if (nm < 1000) return `${f(nm)} nm`;
  if (nm < 1e6) return `${f(nm / 1000)} μm`;
  if (nm < 1e7) return `${f(nm / 1e6)} mm`;
  return `${f(nm / 1e7)} cm`;
}
export const regionOf = (nm: number) => (nm < 400 ? "ultravioleta" : nm <= 700 ? "visível" : nm < 1e6 ? "infravermelho" : "micro-ondas");
