import { num, type Params } from "@fisilab/core";

/**
 * Experimentos aleatórios com resultado previsível estatisticamente.
 * 0 — tábua de Galton: n linhas de pinos, desvio à direita com probabilidade p → binomial B(n, p) → normal.
 * 1 — π por Monte Carlo: pontos uniformes no quadrado [−1, 1]²; fração dentro do círculo → π/4.
 * 2 — agulha de Buffon: agulhas de comprimento ℓ sobre retas espaçadas de d (ℓ ≤ d); P(cruzar) = 2ℓ/(πd).
 * 3 — caminhada aleatória 1D: passos ±1 com P(+1) = p; ⟨x⟩ = N(2p − 1), Var = 4Np(1 − p).
 * 4 — caminhada aleatória 2D: passos unitários em direção sorteada; ⟨r²⟩ = N.
 */

export const MAX_FLY = 400;
export const RING = 3000;
export const TRAJ = 8; // trajetórias desenhadas (1D)
export const TRAJ_MAX = 1500;

export interface PState {
  mode: number;
  rs: number;
  k: number;
  // Galton
  rows: number;
  bins: Int32Array;
  fly: { r: number; k: number; ph: number; last: number }[];
  landed: number;
  // π e Buffon
  nTot: number;
  nIn: number;
  ring: Float32Array; // x, y, θ, acerto (4 por amostra)
  head: number;
  hist: [number, number][]; // (N, erro) amostrado em escala log
  nextLog: number;
  // caminhadas
  wx: Float64Array;
  wy: Float64Array;
  steps: number;
  traj: number[][]; // 1D: x de cada caminhante desenhado; 2D: [x0, y0, x1, y1, ...] do caminhante 0
  r2h: [number, number][];
}

export function rnd(s: { rs: number }): number {
  s.rs = (s.rs + 0x6d2b79f5) >>> 0;
  let t = s.rs;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export const pRight = (p: Params) => num(p, "p", 0.5);
export const ellD = (p: Params) => num(p, "ell", 0.8);

// ---------- Teoria ----------
const LNF: number[] = [0];
export function lnFact(n: number): number {
  for (let i = LNF.length; i <= n; i++) LNF.push(LNF[i - 1]! + Math.log(i));
  return LNF[n]!;
}
export function binom(n: number, k: number, p: number): number {
  if (k < 0 || k > n) return 0;
  if (p <= 0) return k === 0 ? 1 : 0;
  if (p >= 1) return k === n ? 1 : 0;
  return Math.exp(lnFact(n) - lnFact(k) - lnFact(n - k) + k * Math.log(p) + (n - k) * Math.log(1 - p));
}
export const normalPdf = (x: number, mu: number, s2: number) => (s2 > 0 ? Math.exp(-((x - mu) ** 2) / (2 * s2)) / Math.sqrt(2 * Math.PI * s2) : 0);
/** Desvio padrão de π̂ = 4 n_in/N. */
export const sigmaPiMC = (N: number) => (N > 0 ? Math.sqrt((Math.PI * (4 - Math.PI)) / N) : 0);
/** P de a agulha cruzar uma reta (ℓ ≤ d). */
export const buffonP = (l: number) => (2 * l) / Math.PI;
/** Desvio padrão de π̂ = 2ℓN/(d n_hit) pela propagação de erro. */
export const sigmaBuffon = (N: number, l: number) => {
  const P = buffonP(l);
  return N > 0 ? Math.PI * Math.sqrt((1 - P) / (N * P)) : 0;
};
/** ⟨x²⟩ da caminhada 1D com P(+1) = p, ou ⟨r²⟩ = N na 2D. */
export const msdTheory = (mode: number, N: number, p: number) => (mode === 4 ? N : 4 * N * p * (1 - p) + (N * (2 * p - 1)) ** 2);

// ---------- Inicialização ----------
export function initState(p: Params): PState {
  const mode = Math.round(num(p, "modo"));
  const rows = Math.round(num(p, "linhas", 12));
  const M = Math.round(num(p, "M", 200));
  const walk = mode >= 3;
  const s: PState = {
    mode,
    rs: (Math.imul(Math.round(num(p, "seed", 1)), 0x9e3779b1) ^ 0x2545f491) >>> 0,
    k: 0,
    rows,
    bins: new Int32Array(rows + 1),
    fly: [],
    landed: 0,
    nTot: 0,
    nIn: 0,
    ring: new Float32Array(mode === 1 || mode === 2 ? RING * 4 : 0),
    head: 0,
    hist: [],
    nextLog: 10,
    wx: new Float64Array(walk ? M : 0),
    wy: new Float64Array(walk ? M : 0),
    steps: 0,
    traj: mode === 3 ? Array.from({ length: Math.min(TRAJ, M) }, () => [0]) : mode === 4 ? [[0, 0]] : [],
    r2h: [[0, 0]],
  };
  return s;
}

// ---------- Observáveis ----------
export function galtonStats(s: PState): { mean: number; v: number } {
  let n = 0, m = 0, m2 = 0;
  for (let k = 0; k < s.bins.length; k++) {
    const c = s.bins[k]!;
    n += c;
    m += c * k;
    m2 += c * k * k;
  }
  if (n === 0) return { mean: 0, v: 0 };
  m /= n;
  return { mean: m, v: n > 1 ? (m2 / n - m * m) * (n / (n - 1)) : 0 };
}
export const piHat = (s: PState, p: Params) => {
  if (s.mode === 1) return s.nTot ? (4 * s.nIn) / s.nTot : 0;
  if (s.mode === 2) return s.nIn ? (2 * ellD(p) * s.nTot) / s.nIn : 0;
  return 0;
};
export function walkStats(s: PState): { mean: number; msd: number; v: number } {
  const M = s.wx.length;
  if (!M) return { mean: 0, msd: 0, v: 0 };
  let m = 0, r2 = 0;
  for (let i = 0; i < M; i++) {
    m += s.wx[i]!;
    r2 += s.wx[i]! ** 2 + s.wy[i]! ** 2;
  }
  m /= M;
  r2 /= M;
  return { mean: m, msd: r2, v: r2 - (s.mode === 3 ? m * m : 0) };
}

/** Estimativa principal, valor teórico e desvio padrão esperado da estimativa. */
export function estimate(s: PState, p: Params): { n: number; est: number; teo: number; sig: number } {
  const pr = pRight(p);
  switch (s.mode) {
    case 0: {
      const g = galtonStats(s);
      const n = s.landed;
      return { n, est: g.mean, teo: s.rows * pr, sig: n ? Math.sqrt((s.rows * pr * (1 - pr)) / n) : 0 };
    }
    case 1:
      return { n: s.nTot, est: piHat(s, p), teo: Math.PI, sig: sigmaPiMC(s.nTot) };
    case 2:
      return { n: s.nTot, est: piHat(s, p), teo: Math.PI, sig: sigmaBuffon(s.nTot, ellD(p)) };
    default: {
      const w = walkStats(s);
      const teo = msdTheory(s.mode, s.steps, s.mode === 4 ? 0.5 : pr);
      // Var(x²) de uma gaussiana: 2σ⁴ + 4μ²σ²
      const mu = s.mode === 3 ? s.steps * (2 * pr - 1) : 0;
      const s2 = s.mode === 3 ? 4 * s.steps * pr * (1 - pr) : s.steps / 2;
      const varR2 = s.mode === 3 ? 2 * s2 * s2 + 4 * mu * mu * s2 : 4 * s2 * s2; // 2D: r² ~ σ²·χ²₂
      return { n: s.steps, est: w.msd, teo, sig: Math.sqrt(varR2 / Math.max(1, s.wx.length)) };
    }
  }
}

// ---------- Passo ----------
export function step(s0: PState, p: Params): PState {
  const s: PState = { ...s0, k: s0.k + 1 };
  const rate = Math.round(num(p, "taxa", 5));
  const pr = pRight(p);
  if (s.mode === 0) {
    s.bins = s0.bins.slice();
    const fly = s0.fly.map((b) => ({ ...b }));
    for (let i = 0; i < rate && fly.length < MAX_FLY; i++) fly.push({ r: 0, k: 0, ph: -i / Math.max(rate, 1), last: 0 });
    const speed = 0.25; // linhas por passo
    const keep: PState["fly"] = [];
    for (const b of fly) {
      b.ph += speed;
      while (b.ph >= 1) {
        b.ph -= 1;
        if (b.r < s.rows) {
          b.last = rnd(s) < pr ? 1 : 0;
          b.k += b.last;
          b.r++;
        } else b.r++;
      }
      if (b.r > s.rows) {
        s.bins[b.k] = s.bins[b.k]! + 1;
        s.landed++;
      } else keep.push(b);
    }
    s.fly = keep;
    return s;
  }
  if (s.mode === 1 || s.mode === 2) {
    s.ring = s0.ring.slice();
    s.hist = s0.hist.slice();
    addSamples(s, p, rate * 4);
    return s;
  }
  s.wx = s0.wx.slice();
  s.wy = s0.wy.slice();
  s.traj = s0.traj.map((t) => t.slice());
  s.r2h = s0.r2h.slice();
  const n = Math.max(1, Math.round(rate / 5));
  for (let k = 0; k < n; k++) walkStep(s, pr);
  return s;
}

export function addSamples(s: PState, p: Params, count: number): void {
  const l = ellD(p);
  for (let i = 0; i < count; i++) {
    let x: number, y: number, th = 0, hit: boolean;
    if (s.mode === 1) {
      x = 2 * rnd(s) - 1;
      y = 2 * rnd(s) - 1;
      hit = x * x + y * y <= 1;
    } else {
      // retas em y inteiro (d = 1); centro uniforme, ângulo uniforme
      x = rnd(s) * 8;
      y = rnd(s) * 8;
      th = rnd(s) * Math.PI;
      const dist = Math.min(y - Math.floor(y), Math.ceil(y) - y);
      hit = dist <= (l / 2) * Math.sin(th);
    }
    s.nTot++;
    if (hit) s.nIn++;
    const h = s.head % RING;
    s.ring[4 * h] = x;
    s.ring[4 * h + 1] = y;
    s.ring[4 * h + 2] = th;
    s.ring[4 * h + 3] = hit ? 1 : 0;
    s.head++;
    if (s.nTot >= s.nextLog) {
      const est = s.mode === 1 ? (4 * s.nIn) / s.nTot : s.nIn ? (2 * l * s.nTot) / s.nIn : 0;
      if (est > 0) s.hist.push([s.nTot, Math.abs(est - Math.PI)]);
      s.nextLog = Math.ceil(s.nextLog * 1.12);
    }
  }
}

export function walkStep(s: PState, pr: number): void {
  const M = s.wx.length;
  for (let i = 0; i < M; i++) {
    if (s.mode === 3) s.wx[i] = s.wx[i]! + (rnd(s) < pr ? 1 : -1);
    else {
      const a = 2 * Math.PI * rnd(s);
      s.wx[i] = s.wx[i]! + Math.cos(a);
      s.wy[i] = s.wy[i]! + Math.sin(a);
    }
  }
  s.steps++;
  if (s.mode === 3) {
    if (s.steps <= TRAJ_MAX) s.traj.forEach((t, i) => t.push(s.wx[i]!));
  } else if (s.steps <= TRAJ_MAX) s.traj[0]!.push(s.wx[0]!, s.wy[0]!);
  const w = walkStats(s);
  if (s.r2h.length < 2000) s.r2h.push([s.steps, w.msd]);
}
