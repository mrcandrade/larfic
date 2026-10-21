/**
 * Física de RMN e de imagem por ressonância: frequência de Larmor, polarização
 * de Boltzmann, equações de Bloch no referencial girante (pulsos, T1, T2, T2*),
 * eco de spin com um conjunto de isocromatas e imagem por codificação de
 * frequência e de fase (espaço k e transformada de Fourier).
 */

export const H = 6.62607015e-34;
export const KB = 1.380649e-23;

/** Núcleos com razão giromagnética γ/2π (MHz/T). */
export const NUCLEOS = [
  { nome: "¹H", gbar: 42.577 },
  { nome: "¹³C", gbar: 10.708 },
  { nome: "¹⁹F", gbar: 40.078 },
  { nome: "³¹P", gbar: 17.235 },
  { nome: "²³Na", gbar: 11.262 },
];

/** Frequência de Larmor (Hz). */
export const larmor = (gbarMHz: number, B0: number) => gbarMHz * 1e6 * B0;
/** Excesso de população (spin ½) entre os dois níveis: tanh(hf/2kT). */
export const polarization = (f: number, T: number) => Math.tanh((H * f) / (2 * KB * T));

// ------------------------------------------------------------ Bloch
export type Vec = [number, number, number];

/** Rotação de M por −angle em torno do eixo unitário u (dM/dt = M × W gira em sentido horário em torno de W). */
export function rotate(M: Vec, u: Vec, angle: number): Vec {
  const c = Math.cos(-angle), s = Math.sin(-angle);
  const [x, y, z] = M;
  const [a, b, d] = u;
  const dot = a * x + b * y + d * z;
  const cx = b * z - d * y, cy = d * x - a * z, cz = a * y - b * x;
  return [x * c + cx * s + a * dot * (1 - c), y * c + cy * s + b * dot * (1 - c), z * c + cz * s + d * dot * (1 - c)];
}

/** Relaxação exata durante h segundos (M0 = 1). */
export function relax(M: Vec, h: number, T1: number, T2: number): Vec {
  const e2 = Math.exp(-h / T2);
  const e1 = Math.exp(-h / T1);
  return [M[0] * e2, M[1] * e2, 1 - (1 - M[2]) * e1];
}

/**
 * Evolução de uma isocromata por h segundos no referencial girante, com campo
 * de RF ω₁ (rad/s, ao longo de x') e desvio de ressonância Δω (rad/s).
 */
export function blochStep(M: Vec, w1: number, dw: number, h: number, T1: number, T2: number): Vec {
  const W = Math.hypot(w1, dw);
  const R = W > 0 ? rotate(M, [w1 / W, 0, dw / W], W * h) : M;
  return relax(R, h, T1, T2);
}

export interface Pulse {
  /** Início (s), duração (s) e frequência de nutação ω₁ = γB₁ (rad/s). */
  t0: number;
  dur: number;
  w1: number;
}

/** Avança um conjunto de isocromatas de t0 a t1, subdividindo os pulsos. */
export function evolve(Ms: Vec[], offs: number[], pulses: Pulse[], t0: number, t1: number, T1: number, T2: number): Vec[] {
  const cuts = new Set<number>([t0, t1]);
  for (const p of pulses) {
    if (p.t0 > t0 && p.t0 < t1) cuts.add(p.t0);
    if (p.t0 + p.dur > t0 && p.t0 + p.dur < t1) cuts.add(p.t0 + p.dur);
  }
  const ts = [...cuts].sort((a, b) => a - b);
  let out = Ms;
  for (let k = 0; k + 1 < ts.length; k++) {
    const a = ts[k]!, b = ts[k + 1]!;
    const mid = (a + b) / 2;
    const p = pulses.find((q) => mid >= q.t0 && mid < q.t0 + q.dur);
    if (!p) {
      out = out.map((M, i) => blochStep(M, 0, offs[i]!, b - a, T1, T2));
    } else {
      const n = Math.max(1, Math.ceil(((b - a) / p.dur) * 60));
      const h = (b - a) / n;
      for (let j = 0; j < n; j++) out = out.map((M, i) => blochStep(M, p.w1, offs[i]!, h, T1, T2));
    }
  }
  return out;
}

/** Desvios de frequência (rad/s) de N isocromatas com distribuição de Lorentz de largura FWHM (Hz), truncada em ±8 FWHM. */
export function lorentzOffsets(n: number, center: number, fwhm: number): number[] {
  if (fwhm <= 0 || n <= 1) return [2 * Math.PI * center];
  const out: number[] = [];
  for (let k = 0; k < n; k++) {
    const u = (k + 0.5) / n;
    const f = center + Math.max(-8, Math.min(8, Math.tan(Math.PI * (u - 0.5)) / 2)) * fwhm;
    out.push(2 * Math.PI * f);
  }
  return out;
}

export const mean = (Ms: Vec[]): Vec => {
  const s: Vec = [0, 0, 0];
  for (const M of Ms) {
    s[0] += M[0];
    s[1] += M[1];
    s[2] += M[2];
  }
  return [s[0] / Ms.length, s[1] / Ms.length, s[2] / Ms.length];
};

/** T2* para alargamento lorentziano: 1/T2* = 1/T2 + π Δf. */
export const t2star = (T2: number, fwhm: number) => 1 / (1 / T2 + Math.PI * fwhm);

// ------------------------------------------------------------ tecidos e fantoma
export interface Tissue {
  nome: string;
  rho: number;
  /** Tempos de relaxação a 1,5 T (s). */
  T1: number;
  T2: number;
}

export const TECIDOS: Tissue[] = [
  { nome: "Líquor (LCR)", rho: 1.0, T1: 4.0, T2: 2.0 },
  { nome: "Substância cinzenta", rho: 0.85, T1: 1.3, T2: 0.1 },
  { nome: "Substância branca", rho: 0.7, T1: 0.8, T2: 0.08 },
  { nome: "Gordura", rho: 0.9, T1: 0.26, T2: 0.08 },
  { nome: "Lesão (edema)", rho: 0.9, T1: 1.5, T2: 0.25 },
];

/** Sinal de spin-eco: S = ρ (1 − e^{−TR/T1}) e^{−TE/T2}. */
export const seSignal = (t: Tissue, TR: number, TE: number) => t.rho * (1 - Math.exp(-TR / t.T1)) * Math.exp(-TE / t.T2);

export const NIMG = 64;

/** Mapa de tecidos do fantoma (índice em TECIDOS, −1 = ar) numa grade NIMG × NIMG. */
export function phantomMap(n = NIMG): Int8Array {
  const m = new Int8Array(n * n).fill(-1);
  const inE = (x: number, y: number, cx: number, cy: number, a: number, b: number) => ((x - cx) / a) ** 2 + ((y - cy) / b) ** 2 <= 1;
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const x = (i + 0.5) / n * 2 - 1;
      const y = (j + 0.5) / n * 2 - 1;
      let t = -1;
      if (inE(x, y, 0, 0, 0.78, 0.9)) t = 3; // couro cabeludo (gordura)
      if (inE(x, y, 0, 0, 0.7, 0.82)) t = 1; // cinzenta
      if (inE(x, y, 0, 0, 0.55, 0.66)) t = 2; // branca
      if (inE(x, y, -0.16, 0.1, 0.09, 0.3) || inE(x, y, 0.16, 0.1, 0.09, 0.3)) t = 0; // ventrículos
      if (inE(x, y, 0.32, -0.38, 0.12, 0.12)) t = 4; // lesão
      m[j * n + i] = t;
    }
  return m;
}

/** Imagem ponderada (valor por pixel) para TR e TE dados (s). */
export function weightedImage(map: Int8Array, TR: number, TE: number): Float64Array {
  const s = TECIDOS.map((t) => seSignal(t, TR, TE));
  const out = new Float64Array(map.length);
  map.forEach((t, k) => (out[k] = t < 0 ? 0 : s[t]!));
  return out;
}

// ------------------------------------------------------------ FFT
/** FFT complexa in-place (n potência de 2); inverse = true usa e^{+i} e divide por n. */
export function fft(re: Float64Array, im: Float64Array, inverse = false): void {
  const n = re.length;
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
    const wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ar = re[i + k]!, ai = im[i + k]!;
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

/** FFT 2D (linhas e colunas) de uma imagem n × n, com o centro do espaço k no meio (fftshift). */
export function fft2(img: Float64Array, n: number, inverse = false, inRe?: Float64Array, inIm?: Float64Array) {
  const re = inRe ? Float64Array.from(inRe) : Float64Array.from(img);
  const im = inIm ? Float64Array.from(inIm) : new Float64Array(n * n);
  const shift = (a: Float64Array) => {
    const b = new Float64Array(n * n);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) b[((j + n / 2) % n) * n + ((i + n / 2) % n)] = a[j * n + i]!;
    return b;
  };
  let R = inverse ? shift(re) : re;
  let I = inverse ? shift(im) : im;
  const rr = new Float64Array(n), ii = new Float64Array(n);
  for (let pass = 0; pass < 2; pass++)
    for (let a = 0; a < n; a++) {
      for (let b = 0; b < n; b++) {
        const k = pass === 0 ? a * n + b : b * n + a;
        rr[b] = R[k]!;
        ii[b] = I[k]!;
      }
      fft(rr, ii, inverse);
      for (let b = 0; b < n; b++) {
        const k = pass === 0 ? a * n + b : b * n + a;
        R[k] = rr[b]!;
        I[k] = ii[b]!;
      }
    }
  if (!inverse) {
    R = shift(R);
    I = shift(I);
  }
  return { re: R, im: I };
}

/** Ordem de aquisição das linhas de fase, do centro para as bordas. */
export function centerOut(n: number): number[] {
  const out = [n / 2];
  for (let k = 1; out.length < n; k++) {
    if (n / 2 + k < n) out.push(n / 2 + k);
    if (out.length < n) out.push(n / 2 - k);
  }
  return out;
}

/** Reconstrução com as primeiras `lines` linhas adquiridas (as demais zeradas). */
export function reconstruct(k: { re: Float64Array; im: Float64Array }, n: number, lines: number): Float64Array {
  const re = new Float64Array(n * n), im = new Float64Array(n * n);
  for (const row of centerOut(n).slice(0, lines))
    for (let i = 0; i < n; i++) {
      re[row * n + i] = k.re[row * n + i]!;
      im[row * n + i] = k.im[row * n + i]!;
    }
  const r = fft2(re, n, true, re, im);
  const out = new Float64Array(n * n);
  for (let q = 0; q < n * n; q++) out[q] = Math.hypot(r.re[q]!, r.im[q]!);
  return out;
}

/** Projeção ao longo de y (perfil 1D que a codificação de frequência em x mede). */
export function projection(img: Float64Array, n: number): number[] {
  const out = new Array<number>(n).fill(0);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) out[i]! += img[j * n + i]!;
  return out;
}
