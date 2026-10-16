/**
 * Pacotes de onda e incerteza. Unidades: x em nm, k em nm⁻¹, t em fs.
 * Elétron livre: ω = ħk²/2m, com ħ/m = 0,11577 nm²/fs.
 */

export const HBAR_OVER_M = 0.115767636; // nm²/fs
export const HBAR = 1.054571817e-34; // J·s
export const H_PLANCK = 6.62607015e-34;
export const M_E = 9.1093837015e-31;

/** FFT complexa radix-2 in-place. inverse = true divide por n. */
export function fft(re: Float64Array, im: Float64Array, inverse = false): void {
  const n = re.length;
  if (n & (n - 1)) throw new Error("fft: n precisa ser potência de 2");
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j]!, re[i]!];
      [im[i], im[j]] = [im[j]!, im[i]!];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = ((inverse ? 2 : -2) * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ar = re[i + k]!;
        const ai = im[i + k]!;
        const br = re[i + k + len / 2]! * cr - im[i + k + len / 2]! * ci;
        const bi = re[i + k + len / 2]! * ci + im[i + k + len / 2]! * cr;
        re[i + k] = ar + br;
        im[i + k] = ai + bi;
        re[i + k + len / 2] = ar - br;
        im[i + k + len / 2] = ai - bi;
        const t = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = t;
      }
    }
  }
  if (inverse)
    for (let i = 0; i < n; i++) {
      re[i]! /= n;
      im[i]! /= n;
    }
}

/** Média e desvio padrão de uma distribuição discreta (pesos não normalizados). */
export function stats(xs: ArrayLike<number>, w: ArrayLike<number>): { mean: number; sd: number; total: number } {
  let s = 0;
  let sx = 0;
  for (let i = 0; i < xs.length; i++) {
    s += w[i]!;
    sx += w[i]! * xs[i]!;
  }
  const mean = sx / s;
  let v = 0;
  for (let i = 0; i < xs.length; i++) v += w[i]! * (xs[i]! - mean) ** 2;
  return { mean, sd: Math.sqrt(v / s), total: s };
}

// ---------- soma de ondas planas ----------

export interface PlaneSum {
  k: number[];
  a: number[];
  /** Espaçamento entre componentes (0 se só uma). */
  dk: number;
  /** Período de repetição do padrão 2π/δk (∞ se só uma componente). */
  period: number;
}

/** N componentes igualmente espaçadas em ±5σ_k em torno de k₀, amplitudes gaussianas (|a|² com desvio σ_k). */
export function planeSum(N: number, k0: number, sigk: number): PlaneSum {
  const n = Math.max(1, Math.round(N));
  if (n === 1) return { k: [k0], a: [1], dk: 0, period: Infinity };
  const span = 10 * sigk;
  const dk = span / (n - 1);
  const k: number[] = [];
  const a: number[] = [];
  for (let j = 0; j < n; j++) {
    const kj = k0 - span / 2 + j * dk;
    k.push(kj);
    a.push(Math.exp(-((kj - k0) ** 2) / (4 * sigk * sigk)));
  }
  return { k, a, dk, period: (2 * Math.PI) / dk };
}

/** ψ(x) = Σ a_j e^{i k_j x} (parte real e imaginária). */
export function planeSumAt(ps: PlaneSum, x: number): [number, number] {
  let re = 0;
  let im = 0;
  for (let j = 0; j < ps.k.length; j++) {
    re += ps.a[j]! * Math.cos(ps.k[j]! * x);
    im += ps.a[j]! * Math.sin(ps.k[j]! * x);
  }
  return [re, im];
}

/** Δx (sobre um período, ou sobre a janela dada quando há uma só componente) e Δk da soma. */
export function planeSumUncertainty(ps: PlaneSum, window = 20) {
  const W = Number.isFinite(ps.period) ? ps.period : window;
  const n = 2000;
  const xs = new Float64Array(n);
  const w = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const x = -W / 2 + ((i + 0.5) * W) / n;
    const [re, im] = planeSumAt(ps, x);
    xs[i] = x;
    w[i] = re * re + im * im;
  }
  const dx = stats(xs, w).sd;
  const dk = stats(ps.k, ps.a.map((a) => a * a)).sd;
  return { dx, dk, product: dx * dk };
}

// ---------- pacote livre via FFT ----------

export const NGRID = 2048;
export const XMIN = -40;
export const LBOX = 160;
export const DX = LBOX / NGRID;
export const xAt = (i: number) => XMIN + i * DX;
/** Número de onda da componente i da FFT (ordem padrão). */
export const kAt = (i: number) => ((i < NGRID / 2 ? i : i - NGRID) * 2 * Math.PI) / LBOX;

export const X0 = -20;

/** ω(k): elétron livre (dispersivo) ou meio sem dispersão com a mesma velocidade de grupo em k₀. */
export const omega = (k: number, k0: number, dispersive: boolean) => (dispersive ? 0.5 * HBAR_OVER_M * k * k : HBAR_OVER_M * k0 * k);

/** Largura analítica do pacote gaussiano livre: σ(t) = σ₀ √(1 + (ħt/2mσ₀²)²). */
export const sigmaT = (sig0: number, t: number) => sig0 * Math.sqrt(1 + ((HBAR_OVER_M * t) / (2 * sig0 * sig0)) ** 2);

export interface Packet {
  /** ψ(x, t) na grade. */
  re: Float64Array;
  im: Float64Array;
  /** φ(k) (constante no tempo em módulo), na ordem da FFT. */
  phiRe: Float64Array;
  phiIm: Float64Array;
}

let cacheKey = "";
let cachePhi: { re: Float64Array; im: Float64Array } | null = null;

/** Transformada do pacote inicial ψ₀(x) = (2πσ²)^{-1/4} e^{-(x−x₀)²/4σ²} e^{ik₀x}. */
export function initialSpectrum(sig: number, k0: number) {
  const key = `${sig}|${k0}`;
  if (cachePhi && key === cacheKey) return cachePhi;
  const re = new Float64Array(NGRID);
  const im = new Float64Array(NGRID);
  const A = (2 * Math.PI * sig * sig) ** -0.25;
  for (let i = 0; i < NGRID; i++) {
    const x = xAt(i);
    const env = A * Math.exp(-((x - X0) ** 2) / (4 * sig * sig));
    re[i] = env * Math.cos(k0 * x);
    im[i] = env * Math.sin(k0 * x);
  }
  fft(re, im);
  cacheKey = key;
  cachePhi = { re, im };
  return cachePhi;
}

/** Evolução exata no espaço k: φ(k, t) = φ(k, 0) e^{−iω(k)t}; ψ = FFT⁻¹. */
export function evolve(sig: number, k0: number, t: number, dispersive = true): Packet {
  const phi = initialSpectrum(sig, k0);
  const re = new Float64Array(NGRID);
  const im = new Float64Array(NGRID);
  for (let i = 0; i < NGRID; i++) {
    const ph = -omega(kAt(i), k0, dispersive) * t;
    const c = Math.cos(ph);
    const s = Math.sin(ph);
    re[i] = phi.re[i]! * c - phi.im[i]! * s;
    im[i] = phi.re[i]! * s + phi.im[i]! * c;
  }
  fft(re, im, true);
  return { re, im, phiRe: phi.re, phiIm: phi.im };
}

/** ⟨x⟩, Δx, Δk e norma ∫|ψ|²dx do pacote. */
export function packetStats(pk: Packet) {
  const xs = new Float64Array(NGRID);
  const w = new Float64Array(NGRID);
  const ks = new Float64Array(NGRID);
  const wk = new Float64Array(NGRID);
  for (let i = 0; i < NGRID; i++) {
    xs[i] = xAt(i);
    w[i] = pk.re[i]! ** 2 + pk.im[i]! ** 2;
    ks[i] = kAt(i);
    wk[i] = pk.phiRe[i]! ** 2 + pk.phiIm[i]! ** 2;
  }
  const sx = stats(xs, w);
  const sk = stats(ks, wk);
  return { mean: sx.mean, dx: sx.sd, dk: sk.sd, norm: sx.total * DX, kMean: sk.mean };
}

// ---------- fenda simples ----------

/** Intensidade de Fraunhofer: sinc²(π a sen θ / λ). */
export function slitIntensity(theta: number, a: number, lam: number): number {
  const b = (Math.PI * a * Math.sin(theta)) / lam;
  return Math.abs(b) < 1e-9 ? 1 : (Math.sin(b) / b) ** 2;
}
/** Primeiro mínimo: sen θ₁ = λ/a. */
export const firstMin = (a: number, lam: number) => Math.asin(Math.min(1, lam / a));
