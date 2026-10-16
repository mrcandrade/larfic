import { gaussian, num, rng, type Params } from "@fisilab/core";

/**
 * Três experimentos de teoria cinética:
 *  0. gás de discos duros (dinâmica molecular 2D): livre caminho médio medido × λ = 1/(√2 n d);
 *  1. interdifusão de duas espécies a partir de uma partição, com ajuste do coeficiente D;
 *  2. partículas brownianas (passeio aleatório sobreamortecido): ⟨x²⟩ = 2Dt e Einstein–Stokes.
 *
 * Gás: posição em nm, velocidade em nm/ps, tempo em ps (como em sims/gas-ideal).
 * Browniano: posição em µm, tempo em s.
 */

export const KB = 1.380649e-23;
export const AMU = 1.66053907e-27;
export const RGAS = 8.314462618;
export const GW = 60; // caixa do gás (nm)
export const GH = 36;
export const DT_GAS = 0.05; // ps por subpasso
export const NSUB = 4; // subpassos por passo do runner (0,2 ps)
export const NBINS = 30;
export const HIST_EVERY = 5; // passos entre amostras guardadas no histórico
export const FW = 30; // campo do microscópio (µm)
export const FH = 18;
export const NWALK = 200;
export const DT_B = 0.02; // s por passo (tempo real)
export const XBINS = 25;

export interface DBState {
  mode: number;
  // ----- gás -----
  x: Float64Array;
  y: Float64Array;
  vx: Float64Array;
  vy: Float64Array;
  sp: Uint8Array;
  /** Distância percorrida desde a última colisão. */
  dist: Float64Array;
  /** Histograma dos livres caminhos (largura 4λ₀/NBINS), soma dos caminhos e número de caminhos. */
  fhist: number[];
  pathSum: number;
  nPaths: number;
  nColl: number;
  /** Pontos de colisão recentes da molécula rastreada (índice 0). */
  tag: [number, number][];
  tp: number;
  // ----- brownianas -----
  px: Float64Array;
  py: Float64Array;
  bx: Float64Array;
  by: Float64Array;
  tb: number;
  k: number;
  /** Histórico compacto: gás → [t (ps), fração de A à direita]; browniano → [t (s), ⟨x²⟩, ⟨y²⟩] (µm²). */
  hist: number[][];
}

// ---------- grandezas do gás ----------
export const massA = (p: Params) => num(p, "massa", 40) * AMU;
export const massB = (p: Params) => num(p, "massaB", 40) * AMU;
export const diam = (p: Params) => num(p, "d", 0.6);
export const nGas = (s: DBState) => s.x.length / (GW * GH); // nm⁻²
/** Desvio padrão de uma componente da velocidade, √(kT/m), em nm/ps. */
export const sigmaV = (T: number, m: number) => Math.sqrt((KB * T) / m) / 1000;
/** Rapidez média em 2D: √(πkT/2m). */
export const vMean2D = (T: number, m: number) => Math.sqrt(Math.PI / 2) * sigmaV(T, m);
/**
 * Livre caminho médio de um gás rarefeito: λ = 1/(√2 n σ). Em 2D a "seção de choque" σ é
 * a largura da faixa varrida por um disco, σ = 2d (em 3D seria π d²).
 */
export const crossSection = (d: number) => 2 * d;
export const lambda0 = (n: number, d: number) => 1 / (Math.SQRT2 * n * crossSection(d));
/** Fração de área ocupada η = π n d²/4. */
export const packing = (n: number, d: number) => (Math.PI * n * d * d) / 4;
/** Fator de Enskog (contato) para discos duros: g(η) = (1 − 7η/16)/(1 − η)² (Henderson). */
export const enskog = (eta: number) => (1 - (7 * eta) / 16) / (1 - eta) ** 2;
/**
 * Coeficiente de interdifusão de discos duros na 1ª aproximação de Chapman–Enskog:
 * D = (1/(2 n d)) √(kT/(2π μ)), dividido por g(η) em densidade finita. Em nm²/ps.
 */
export function dTheory(n: number, d: number, T: number, mA: number, mB: number): number {
  const mu = (mA * mB) / (mA + mB);
  return (Math.sqrt((KB * T) / (2 * Math.PI * mu)) / 1000 / (2 * n * d)) / enskog(packing(n, d));
}
/** Estimativa elementar D ≈ ½ λ v̄ (2D). */
export const dElementary = (n: number, d: number, T: number, m: number) => 0.5 * lambda0(n, d) * vMean2D(T, m);

/** Fração de A na metade direita, para interdifusão numa caixa de largura L (série de Fourier). */
export function fRightTheory(D: number, t: number, L = GW): number {
  // Tempos curtos: a frente ainda não sentiu as paredes; meio infinito → √(Dt/π)/(L/2).
  if ((D * t) / (L * L) < 0.004) return Math.sqrt((D * t) / Math.PI) / (L / 2);
  let s = 0;
  for (let n = 1; n < 400; n += 2) {
    const term = (4 / (n * n * Math.PI * Math.PI)) * Math.exp((-n * n * Math.PI * Math.PI * D * t) / (L * L));
    s += term;
    if (term < 1e-12) break;
  }
  return 0.5 - s;
}

/** Perfil de concentração de A, c(x, t) = ½ + Σ (2/nπ) sin(nπ/2) cos(nπx/L) e^(−n²π²Dt/L²). */
export function profileTheory(D: number, t: number, x: number, L = GW): number {
  let c = 0.5;
  for (let n = 1; n < 400; n += 2) {
    const e = Math.exp((-n * n * Math.PI * Math.PI * D * t) / (L * L));
    c += (2 / (n * Math.PI)) * Math.sin((n * Math.PI) / 2) * Math.cos((n * Math.PI * x) / L) * e;
    if (e < 1e-10 && n > 5) break;
  }
  return Math.min(1, Math.max(0, c));
}

// ---------- grandezas brownianas ----------
export const radius = (p: Params) => num(p, "a", 0.5) * 1e-6; // m
export const viscosity = (p: Params) => num(p, "eta", 1.0) * 1e-3; // Pa·s
/** Einstein–Stokes: D = kT/(6πηa), em µm²/s. */
export const dStokes = (p: Params) => ((KB * num(p, "T", 300)) / (6 * Math.PI * viscosity(p) * radius(p))) * 1e12;

// ---------- inicialização ----------
const E = new Float64Array(0);

export function initState(p: Params): DBState {
  const mode = Math.round(num(p, "modo"));
  const r = rng(Math.round(num(p, "seed", 1)) * 2654435761);
  const base: DBState = {
    mode, x: E, y: E, vx: E, vy: E, sp: new Uint8Array(0), dist: E, fhist: new Array<number>(NBINS).fill(0),
    pathSum: 0, nPaths: 0, nColl: 0, tag: [], tp: 0, px: E, py: E, bx: E, by: E, tb: 0, k: 0, hist: [],
  };
  if (mode === 2) {
    const px = new Float64Array(NWALK), py = new Float64Array(NWALK);
    for (let i = 0; i < NWALK; i++) {
      px[i] = r() * FW;
      py[i] = r() * FH;
    }
    return { ...base, px, py, bx: new Float64Array(NWALK), by: new Float64Array(NWALK), hist: [[0, 0, 0]] };
  }
  const N = Math.round(num(p, "N", 200));
  const d = diam(p);
  const T = num(p, "T", 300);
  const x = new Float64Array(N), y = new Float64Array(N), vx = new Float64Array(N), vy = new Float64Array(N);
  const sp = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    // Na difusão, metade de cada espécie de cada lado da partição (retirada em t = 0).
    const B = mode === 1 && i >= N / 2;
    sp[i] = B ? 1 : 0;
    const x0 = mode === 1 ? (B ? GW / 2 : 0) : 0;
    const w = mode === 1 ? GW / 2 : GW;
    for (let tries = 0; tries < 300; tries++) {
      x[i] = x0 + d / 2 + r() * (w - d);
      y[i] = d / 2 + r() * (GH - d);
      let ok = true;
      for (let j = 0; j < i && ok; j++) if ((x[i]! - x[j]!) ** 2 + (y[i]! - y[j]!) ** 2 < d * d * 1.3) ok = false;
      if (ok) break;
    }
    const sv = sigmaV(T, B ? massB(p) : massA(p));
    vx[i] = sv * gaussian(r);
    vy[i] = sv * gaussian(r);
  }
  // Reescala para que a energia cinética corresponda exatamente a T (⟨½mv²⟩ = kT em 2D).
  let e = 0;
  for (let i = 0; i < N; i++) e += 0.5 * (sp[i] ? massB(p) : massA(p)) * (vx[i]! ** 2 + vy[i]! ** 2) * 1e6;
  const f = Math.sqrt((N * KB * T) / e);
  for (let i = 0; i < N; i++) {
    vx[i] = vx[i]! * f;
    vy[i] = vy[i]! * f;
  }
  return { ...base, x, y, vx, vy, sp, dist: new Float64Array(N), hist: mode === 1 ? [[0, 0]] : [] };
}

// ---------- passo do gás ----------
function stepGas(s: DBState, p: Params): DBState {
  const x = s.x.slice(), y = s.y.slice(), vx = s.vx.slice(), vy = s.vy.slice(), dist = s.dist.slice();
  const d = diam(p);
  const mA = massA(p), mB = massB(p);
  const n = x.length;
  const l0 = lambda0(nGas(s), d);
  const bw = (4 * l0) / NBINS;
  let fhist = s.fhist;
  let pathSum = s.pathSum, nPaths = s.nPaths, nColl = s.nColl;
  let tag = s.tag;
  let copied = false;
  const record = (i: number) => {
    if (!copied) {
      fhist = fhist.slice();
      copied = true;
    }
    const b = Math.floor(dist[i]! / bw);
    if (b < NBINS) fhist[b] = fhist[b]! + 1;
    pathSum += dist[i]!;
    nPaths++;
    dist[i] = 0;
  };
  for (let sub = 0; sub < NSUB; sub++) {
    const h = DT_GAS;
    for (let i = 0; i < n; i++) {
      let xi = x[i]! + vx[i]! * h;
      let yi = y[i]! + vy[i]! * h;
      dist[i] = dist[i]! + Math.hypot(vx[i]!, vy[i]!) * h;
      // Paredes elásticas (não encerram o livre caminho: só colisões entre moléculas contam).
      if (xi < d / 2) {
        xi = d - xi;
        vx[i] = -vx[i]!;
      } else if (xi > GW - d / 2) {
        xi = 2 * GW - d - xi;
        vx[i] = -vx[i]!;
      }
      if (yi < d / 2) {
        yi = d - yi;
        vy[i] = -vy[i]!;
      } else if (yi > GH - d / 2) {
        yi = 2 * GH - d - yi;
        vy[i] = -vy[i]!;
      }
      x[i] = xi;
      y[i] = yi;
    }
    // Colisões elásticas entre discos (massas possivelmente diferentes), com grade de células.
    const cs = Math.max(d, 1);
    const ncx = Math.ceil(GW / cs), ncy = Math.ceil(GH / cs);
    const head = new Int32Array(ncx * ncy).fill(-1);
    const next = new Int32Array(n);
    for (let i = 0; i < n; i++) {
      const c = Math.min(ncx - 1, Math.floor(x[i]! / cs)) + ncx * Math.min(ncy - 1, Math.floor(y[i]! / cs));
      next[i] = head[c]!;
      head[c] = i;
    }
    const d2 = d * d;
    for (let cy = 0; cy < ncy; cy++) {
      for (let cx = 0; cx < ncx; cx++) {
        for (let i = head[cx + ncx * cy]!; i >= 0; i = next[i]!) {
          for (const [ox, oy] of NEIGH) {
            const ax = cx + ox, ay = cy + oy;
            if (ax < 0 || ax >= ncx || ay >= ncy) continue;
            for (let j = ox === 0 && oy === 0 ? next[i]! : head[ax + ncx * ay]!; j >= 0; j = next[j]!) {
              const dx = x[j]! - x[i]!;
              const dy = y[j]! - y[i]!;
              const r2 = dx * dx + dy * dy;
              if (r2 >= d2 || r2 === 0) continue;
              const dvx = vx[j]! - vx[i]!;
              const dvy = vy[j]! - vy[i]!;
              const dot = dvx * dx + dvy * dy;
              if (dot >= 0) continue;
              const mi = s.sp[i] ? mB : mA;
              const mj = s.sp[j] ? mB : mA;
              const f = dot / r2;
              const wi = (2 * mj) / (mi + mj), wj = (2 * mi) / (mi + mj);
              vx[i] = vx[i]! + wi * f * dx;
              vy[i] = vy[i]! + wi * f * dy;
              vx[j] = vx[j]! - wj * f * dx;
              vy[j] = vy[j]! - wj * f * dy;
              nColl++;
              if (i === 0 || j === 0) tag = [...tag.slice(-24), [x[0]!, y[0]!]];
              record(i);
              record(j);
            }
          }
        }
      }
    }
  }
  const tp = s.tp + NSUB * DT_GAS;
  const k = s.k + 1;
  let hist = s.hist;
  if (s.mode === 1 && k % HIST_EVERY === 0) {
    let aR = 0, NA = 0;
    for (let i = 0; i < n; i++) if (s.sp[i] === 0) {
      NA++;
      if (x[i]! > GW / 2) aR++;
    }
    hist = thin([...hist, [tp, aR / Math.max(1, NA)]]);
  }
  return { ...s, x, y, vx, vy, dist, fhist, pathSum, nPaths, nColl, tag, tp, k, hist };
}

const NEIGH: [number, number][] = [[0, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];

/** Mantém o histórico com no máximo 600 pontos (descarta um a cada dois dos mais antigos). */
function thin(h: number[][]): number[][] {
  if (h.length <= 600) return h;
  return h.filter((_, i) => i >= 300 || i % 2 === 0);
}

// ---------- passo browniano ----------
function stepBrown(s: DBState, p: Params): DBState {
  const D = dStokes(p);
  const sd = Math.sqrt(2 * D * DT_B);
  const r = rng((Math.imul(Math.round(num(p, "seed", 1)), 0x9e3779b1) ^ Math.imul(s.k + 1, 0x85ebca6b)) >>> 0);
  const bx = s.bx.slice(), by = s.by.slice();
  for (let i = 0; i < bx.length; i++) {
    bx[i] = bx[i]! + sd * gaussian(r);
    by[i] = by[i]! + sd * gaussian(r);
  }
  const tb = s.tb + DT_B;
  const k = s.k + 1;
  let hist = s.hist;
  if (k % HIST_EVERY === 0) {
    let mx = 0, my = 0;
    for (let i = 0; i < bx.length; i++) {
      mx += bx[i]! ** 2;
      my += by[i]! ** 2;
    }
    hist = thin([...hist, [tb, mx / bx.length, my / bx.length]]);
  }
  return { ...s, bx, by, tb, k, hist };
}

export function step(s: DBState, p: Params): DBState {
  return s.mode === 2 ? stepBrown(s, p) : stepGas(s, p);
}

// ---------- medidas e ajustes ----------
/**
 * Livre caminho médio medido: distância total percorrida por todas as moléculas dividida
 * pelo número de livres caminhos encerrados (2 por colisão), λ = v̄/z. Incluir os caminhos
 * ainda em curso evita o viés de só contar os caminhos curtos que já terminaram.
 */
export function lambdaMeasured(s: DBState): number {
  if (s.nPaths === 0) return 0;
  let open = 0;
  for (let i = 0; i < s.dist.length; i++) open += s.dist[i]!;
  return (s.pathSum + open) / s.nPaths;
}

/** Ajuste de D pela inclinação de ⟨r²⟩ = 4Dt (mínimos quadrados pela origem), µm²/s. */
export function fitBrownD(s: DBState): number {
  let num_ = 0, den = 0;
  for (const [t, mx, my] of s.hist) {
    num_ += t! * (mx! + my!);
    den += t! * t!;
  }
  return den > 0 ? num_ / (4 * den) : 0;
}

const FIT_CACHE = new WeakMap<number[][], number>();
/** Ajuste de D (nm²/ps) da curva f_A,direita(t) por mínimos quadrados (seção áurea em ln D). */
export function fitGasD(s: DBState): number {
  const h = s.hist;
  if (h.length < 4) return 0;
  const hit = FIT_CACHE.get(h);
  if (hit !== undefined) return hit;
  const sse = (lnD: number) => {
    const D = Math.exp(lnD);
    let e = 0;
    for (const [t, f] of h) e += (fRightTheory(D, t!) - f!) ** 2;
    return e;
  };
  let a = Math.log(1e-3), b = Math.log(1e3);
  const g = (Math.sqrt(5) - 1) / 2;
  let c = b - g * (b - a), d = a + g * (b - a);
  let fc = sse(c), fd = sse(d);
  for (let i = 0; i < 45; i++) {
    if (fc < fd) {
      b = d;
      d = c;
      fd = fc;
      c = b - g * (b - a);
      fc = sse(c);
    } else {
      a = c;
      c = d;
      fc = fd;
      d = a + g * (b - a);
      fd = sse(d);
    }
  }
  const D = Math.exp(0.5 * (a + b));
  FIT_CACHE.set(h, D);
  return D;
}

export function fractionRight(s: DBState): number {
  let aR = 0, NA = 0;
  for (let i = 0; i < s.x.length; i++) if (s.sp[i] === 0) {
    NA++;
    if (s.x[i]! > GW / 2) aR++;
  }
  return NA ? aR / NA : 0;
}

export function temperatureOf(s: DBState, p: Params): number {
  let e = 0;
  for (let i = 0; i < s.x.length; i++) e += 0.5 * (s.sp[i] ? massB(p) : massA(p)) * (s.vx[i]! ** 2 + s.vy[i]! ** 2) * 1e6;
  return s.x.length ? e / (s.x.length * KB) : 0;
}
