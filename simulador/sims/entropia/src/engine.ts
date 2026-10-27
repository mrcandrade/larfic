import { gaussian, num, rng, type Params } from "@fisilab/core";

/**
 * Dois modelos microscópicos para a 2ª lei:
 *
 * 1. Gás de discos macios numa caixa 2D (dinâmica molecular com Verlet de velocidades,
 *    que é reversível no tempo). Unidades reduzidas: diâmetro σ, massa m e kT₀ = 1;
 *    para argônio a 300 K, σ = 0,34 nm e τ = σ√(m/kT) ≈ 1,36 ps.
 *    Repulsão U(r) = A(1 − r/σ)² para r < σ, paredes com o mesmo potencial.
 *
 * 2. Dois sólidos de Einstein em contato térmico: N osciladores cada, energia em quanta ε;
 *    Ω(N, q) = C(q + N − 1, q). Trocas aleatórias de quanta entre osciladores amostram
 *    os microestados com a mesma probabilidade.
 */

export const KB = 1.380649e-23;
export const BW = 40; // largura da caixa (σ)
export const BH = 20; // altura (σ)
export const A_REP = 100; // intensidade da repulsão (kT₀)
export const DT_MD = 0.005; // passo do Verlet (τ)
export const NSUB = 8; // passos de Verlet por passo do runner
export const TAU_PS = 1.36; // τ em ps (argônio a 300 K)
export const EXCH = 15; // trocas de quanta por passo do runner (sólidos de Einstein)

export interface EntState {
  mode: number;
  x: Float64Array;
  y: Float64Array;
  vx: Float64Array;
  vy: Float64Array;
  ax: Float64Array;
  ay: Float64Array;
  /** Espécie de cada partícula (0 = A, 1 = B). */
  sp: Uint8Array;
  /** Tempo físico em τ e número de passos. */
  tr: number;
  k: number;
  /** Instante (τ) da última inversão de velocidades, ou −1. */
  tRev: number;
  nRev: number;
  /** Sólidos de Einstein: quanta de cada oscilador (A primeiro, depois B). */
  q: Int32Array;
  NA: number;
  qA: number;
  /** Entropia total inicial (k), para ΔS. */
  S0: number;
}

// ---------- Combinatória ----------
const LNF: number[] = [0];
/** ln n! exato por soma (com cache). */
export function lnFact(n: number): number {
  if (n < 0) return NaN;
  for (let i = LNF.length; i <= n; i++) LNF.push(LNF[i - 1]! + Math.log(i));
  return LNF[n]!;
}
export const lnChoose = (n: number, k: number) => (k < 0 || k > n ? -Infinity : lnFact(n) - lnFact(k) - lnFact(n - k));
/** Microestados de um sólido de Einstein: Ω = C(q + N − 1, q). */
export const lnOmegaEinstein = (N: number, q: number) => lnChoose(q + N - 1, q);
/** Temperatura de um sólido de Einstein em unidades de ε/k: 1/T = ∂S/∂U = ln(1 + N/q). */
export const kTEinstein = (N: number, q: number) => (q <= 0 ? 0 : 1 / Math.log(1 + N / q));

// ---------- Inicialização ----------
const EMPTY = new Float64Array(0);

export function initState(p: Params): EntState {
  const mode = Math.round(num(p, "modo"));
  const seed = Math.round(num(p, "seed", 1));
  const r = rng(seed * 2654435761);
  if (mode === 2) {
    const NA = Math.round(num(p, "NA", 300));
    const NB = Math.round(num(p, "NB", 100));
    const qA0 = Math.round(num(p, "qA", 300));
    const qB0 = Math.round(num(p, "qB", 150));
    const q = new Int32Array(NA + NB);
    for (let i = 0; i < qA0; i++) {
      const j = Math.floor(r() * NA);
      q[j] = q[j]! + 1;
    }
    for (let i = 0; i < qB0; i++) {
      const j = NA + Math.floor(r() * NB);
      q[j] = q[j]! + 1;
    }
    const s: EntState = {
      mode, x: EMPTY, y: EMPTY, vx: EMPTY, vy: EMPTY, ax: EMPTY, ay: EMPTY, sp: new Uint8Array(0),
      tr: 0, k: 0, tRev: -1, nRev: 0, q, NA, qA: qA0, S0: 0,
    };
    s.S0 = einsteinS(s).S;
    return s;
  }
  const N = Math.round(num(p, "N", 80));
  const x = new Float64Array(N), y = new Float64Array(N), vx = new Float64Array(N), vy = new Float64Array(N);
  const sp = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    // Expansão: todos na metade esquerda. Mistura: A à esquerda, B à direita.
    const right = mode === 1 && i % 2 === 1;
    sp[i] = right ? 1 : 0;
    const xa = right ? BW / 2 + 0.7 : 0.7;
    for (let tries = 0; tries < 400; tries++) {
      x[i] = xa + r() * (BW / 2 - 1.4);
      y[i] = 0.7 + r() * (BH - 1.4);
      let ok = true;
      for (let j = 0; j < i && ok; j++) if ((x[i]! - x[j]!) ** 2 + (y[i]! - y[j]!) ** 2 < 1.1) ok = false;
      if (ok) break;
    }
    vx[i] = gaussian(r);
    vy[i] = gaussian(r);
  }
  const ax = new Float64Array(N), ay = new Float64Array(N);
  forces(x, y, ax, ay);
  return { mode, x, y, vx, vy, ax, ay, sp, tr: 0, k: 0, tRev: -1, nRev: 0, q: new Int32Array(0), NA: 0, qA: 0, S0: 0 };
}

// ---------- Dinâmica molecular ----------
const NCX = BW, NCY = BH; // células de lado σ

/** Forças (= acelerações, m = 1) de repulsão entre discos e com as paredes. */
export function forces(x: Float64Array, y: Float64Array, ax: Float64Array, ay: Float64Array) {
  const n = x.length;
  ax.fill(0);
  ay.fill(0);
  const head = new Int32Array(NCX * NCY).fill(-1);
  const next = new Int32Array(n);
  const cx = (v: number) => Math.min(NCX - 1, Math.max(0, Math.floor(v)));
  const cy = (v: number) => Math.min(NCY - 1, Math.max(0, Math.floor(v)));
  for (let i = 0; i < n; i++) {
    const c = cx(x[i]!) + NCX * cy(y[i]!);
    next[i] = head[c]!;
    head[c] = i;
  }
  const k2 = 2 * A_REP;
  for (let i = 0; i < n; i++) {
    const ci = cx(x[i]!), cj = cy(y[i]!);
    for (let oy = -1; oy <= 1; oy++) {
      const yy = cj + oy;
      if (yy < 0 || yy >= NCY) continue;
      for (let ox = -1; ox <= 1; ox++) {
        const xx = ci + ox;
        if (xx < 0 || xx >= NCX) continue;
        for (let j = head[xx + NCX * yy]!; j >= 0; j = next[j]!) {
          if (j <= i) continue;
          const dx = x[i]! - x[j]!;
          const dy = y[i]! - y[j]!;
          const r2 = dx * dx + dy * dy;
          if (r2 >= 1 || r2 === 0) continue;
          const r = Math.sqrt(r2);
          const f = (k2 * (1 - r)) / r; // F = 2A(1 − r)·r̂
          ax[i] = ax[i]! + f * dx;
          ay[i] = ay[i]! + f * dy;
          ax[j] = ax[j]! - f * dx;
          ay[j] = ay[j]! - f * dy;
        }
      }
    }
    // Paredes: U = A(1 − 2d)² para d < 1/2 (o disco encosta quando o centro está a σ/2).
    const kw = 4 * A_REP;
    const xi = x[i]!, yi = y[i]!;
    if (xi < 0.5) ax[i] = ax[i]! + kw * (1 - 2 * xi);
    if (xi > BW - 0.5) ax[i] = ax[i]! - kw * (1 - 2 * (BW - xi));
    if (yi < 0.5) ay[i] = ay[i]! + kw * (1 - 2 * yi);
    if (yi > BH - 0.5) ay[i] = ay[i]! - kw * (1 - 2 * (BH - yi));
  }
}

export function potentialEnergy(s: EntState): number {
  let u = 0;
  const n = s.x.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const r = Math.hypot(s.x[i]! - s.x[j]!, s.y[i]! - s.y[j]!);
      if (r < 1) u += A_REP * (1 - r) ** 2;
    }
    for (const d of [s.x[i]!, BW - s.x[i]!, s.y[i]!, BH - s.y[i]!]) if (d < 0.5) u += A_REP * (1 - 2 * d) ** 2;
  }
  return u;
}

export function kineticEnergy(s: EntState): number {
  let e = 0;
  for (let i = 0; i < s.vx.length; i++) e += 0.5 * (s.vx[i]! ** 2 + s.vy[i]! ** 2);
  return e;
}

function stepMD(s: EntState): EntState {
  const x = s.x.slice(), y = s.y.slice(), vx = s.vx.slice(), vy = s.vy.slice(), ax = s.ax.slice(), ay = s.ay.slice();
  const n = x.length;
  const h = DT_MD;
  for (let sub = 0; sub < NSUB; sub++) {
    for (let i = 0; i < n; i++) {
      vx[i] = vx[i]! + 0.5 * h * ax[i]!;
      vy[i] = vy[i]! + 0.5 * h * ay[i]!;
      x[i] = x[i]! + h * vx[i]!;
      y[i] = y[i]! + h * vy[i]!;
    }
    forces(x, y, ax, ay);
    for (let i = 0; i < n; i++) {
      vx[i] = vx[i]! + 0.5 * h * ax[i]!;
      vy[i] = vy[i]! + 0.5 * h * ay[i]!;
    }
  }
  return { ...s, x, y, vx, vy, ax, ay, tr: s.tr + NSUB * h, k: s.k + 1 };
}

/**
 * Inverte todas as velocidades. Com o Verlet de velocidades, o gás refaz exatamente
 * o caminho de volta; a perturbação relativa δ (e o arredondamento da máquina) é
 * amplificada exponencialmente pelas colisões, e a volta deixa de funcionar.
 */
export function reverse(s: EntState, delta: number): EntState {
  if (s.mode === 2) return s;
  const r = rng((0x9e3779b1 ^ Math.imul(s.k + 7, 0x85ebca6b)) >>> 0);
  const vx = s.vx.map((v) => -v * (1 + delta * gaussian(r)));
  const vy = s.vy.map((v) => -v * (1 + delta * gaussian(r)));
  return { ...s, vx, vy, tRev: s.tr, nRev: s.nRev + 1 };
}

// ---------- Sólidos de Einstein ----------
function stepEinstein(s: EntState, seed: number): EntState {
  const q = s.q.slice();
  const N = q.length;
  const r = rng((Math.imul(seed, 0x9e3779b1) ^ Math.imul(s.k + 1, 0x85ebca6b)) >>> 0);
  let qA = s.qA;
  for (let m = 0; m < EXCH; m++) {
    const i = Math.floor(r() * N);
    const j = Math.floor(r() * N);
    if (q[i]! > 0 && i !== j) {
      q[i] = q[i]! - 1;
      q[j] = q[j]! + 1;
      if (i < s.NA && j >= s.NA) qA--;
      else if (i >= s.NA && j < s.NA) qA++;
    }
  }
  return { ...s, q, qA, k: s.k + 1, tr: s.tr + 1 };
}

export function step(s: EntState, p: Params): EntState {
  return s.mode === 2 ? stepEinstein(s, Math.round(num(p, "seed", 1))) : stepMD(s);
}

// ---------- Contagem de microestados ----------
export function leftCounts(s: EntState): { nL: number; aL: number; bL: number; NA: number; NB: number } {
  let aL = 0, bL = 0, NA = 0;
  for (let i = 0; i < s.x.length; i++) {
    const left = s.x[i]! < BW / 2;
    if (s.sp[i] === 0) {
      NA++;
      if (left) aL++;
    } else if (left) bL++;
  }
  return { nL: aL + bL, aL, bL, NA, NB: s.x.length - NA };
}

/**
 * Entropia de Boltzmann S/k = ln Ω do macroestado "quantas partículas estão em cada metade".
 * Expansão: Ω = C(N, n_E). Mistura: Ω = C(N_A, a_E)·C(N_B, b_E) (as espécies são distinguíveis).
 */
export function entropyMD(s: EntState): number {
  const c = leftCounts(s);
  if (s.mode === 1) return lnChoose(c.NA, c.aL) + lnChoose(c.NB, c.bL);
  return lnChoose(s.x.length, c.nL);
}

export function einsteinS(s: EntState): { SA: number; SB: number; S: number; qA: number; qB: number; NA: number; NB: number } {
  const NA = s.NA;
  const NB = s.q.length - NA;
  let qT = 0;
  for (let i = 0; i < s.q.length; i++) qT += s.q[i]!;
  const qB = qT - s.qA;
  const SA = lnOmegaEinstein(NA, s.qA);
  const SB = lnOmegaEinstein(NB, qB);
  return { SA, SB, S: SA + SB, qA: s.qA, qB, NA, NB };
}

export const entropyOf = (s: EntState) => (s.mode === 2 ? einsteinS(s).S : entropyMD(s));
