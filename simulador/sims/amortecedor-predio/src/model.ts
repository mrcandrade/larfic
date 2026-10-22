// Modelo de prédio de cisalhamento (massas concentradas por andar) com e sem
// amortecedor de massa sintonizada (TMD) no topo. Funções puras, testáveis.
import { clamp, num, rng, type Params } from "@fisilab/core";

export const nFloors = (p: Params) => clamp(Math.round(num(p, "n", 5)), 1, 10);
export const floorMass = (p: Params) => num(p, "m", 100) * 1e3;
export const storyK = (p: Params) => num(p, "k", 100) * 1e6;

/** Matriz de rigidez de cisalhamento n×n (molas iguais entre andares; a primeira liga ao solo). */
export function stiffness(n: number, k: number): number[][] {
  const K = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    K[i]![i] = i < n - 1 ? 2 * k : k;
    if (i > 0) K[i]![i - 1] = -k;
    if (i < n - 1) K[i]![i + 1] = -k;
  }
  return K;
}

/** Autovalores/autovetores de matriz simétrica (Jacobi cíclico). Ordenados por autovalor crescente. */
export function jacobiEigen(A0: number[][]): { values: number[]; vectors: number[][] } {
  const n = A0.length;
  const A = A0.map((r) => r.slice());
  const V: number[][] = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
  for (let sweep = 0; sweep < 100; sweep++) {
    let off = 0;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += A[i]![j]! ** 2;
    if (off < 1e-22 * (1 + A.reduce((s, r, i) => s + r[i]! ** 2, 0))) break;
    for (let p = 0; p < n; p++)
      for (let q = p + 1; q < n; q++) {
        const apq = A[p]![q]!;
        if (Math.abs(apq) < 1e-300) continue;
        const th = (A[q]![q]! - A[p]![p]!) / (2 * apq);
        const t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1));
        const c = 1 / Math.sqrt(t * t + 1), s = t * c;
        for (let k = 0; k < n; k++) {
          const akp = A[k]![p]!, akq = A[k]![q]!;
          A[k]![p] = c * akp - s * akq;
          A[k]![q] = s * akp + c * akq;
        }
        for (let k = 0; k < n; k++) {
          const apk = A[p]![k]!, aqk = A[q]![k]!;
          A[p]![k] = c * apk - s * aqk;
          A[q]![k] = s * apk + c * aqk;
        }
        for (let k = 0; k < n; k++) {
          const vkp = V[k]![p]!, vkq = V[k]![q]!;
          V[k]![p] = c * vkp - s * vkq;
          V[k]![q] = s * vkp + c * vkq;
        }
      }
  }
  const idx = Array.from({ length: n }, (_, i) => i).sort((a, b) => A[a]![a]! - A[b]![b]!);
  return { values: idx.map((i) => A[i]![i]!), vectors: idx.map((i) => V.map((r) => r[i]!)) };
}

export interface Modes {
  /** Frequências angulares (rad/s). */
  omega: number[];
  /** Formas modais normalizadas com o topo = 1 (ou máximo = 1). */
  shapes: number[][];
  /** Massa modal do modo 1 com o topo normalizado a 1 (kg). */
  modalMass1: number;
}

/** Modos do prédio sem TMD (massas iguais m, molas iguais k). */
export function buildingModes(p: Params): Modes {
  const n = nFloors(p), m = floorMass(p), k = storyK(p);
  const { values, vectors } = jacobiEigen(stiffness(n, k / m));
  const shapes = vectors.map((v) => {
    const top = v[n - 1]!;
    const ref = Math.abs(top) > 1e-9 ? top : Math.max(...v.map(Math.abs));
    return v.map((x) => x / ref);
  });
  const modalMass1 = m * shapes[0]!.reduce((s, x) => s + x * x, 0);
  return { omega: values.map((l) => Math.sqrt(Math.max(l, 0))), shapes, modalMass1 };
}

/** Amortecimento de Rayleigh C = αM + βK com razão ζ nos modos 1 e 2. */
export function rayleigh(p: Params, modes = buildingModes(p)): { alpha: number; beta: number } {
  const z = num(p, "zeta", 2) / 100;
  const w1 = modes.omega[0]!;
  const w2 = modes.omega[1] ?? 3 * w1;
  return { alpha: (2 * z * w1 * w2) / (w1 + w2), beta: (2 * z) / (w1 + w2) };
}

export interface Tmd {
  md: number;
  kd: number;
  cd: number;
  /** Razão de massa μ = m_d / M₁ (massa modal do 1º modo). */
  mu: number;
  fd: number;
  zd: number;
}

/** Parâmetros do TMD: sintonia ótima de Den Hartog ou manual. */
export function tmd(p: Params, modes = buildingModes(p)): Tmd {
  const mu = num(p, "mu", 3) / 100;
  const md = mu * modes.modalMass1;
  const w1 = modes.omega[0]!;
  const manual = Math.round(num(p, "ajuste")) === 1;
  const ratio = manual ? num(p, "razao", 1) : 1 / (1 + mu);
  const zd = manual ? num(p, "zetad", 10) / 100 : Math.sqrt((3 * mu) / (8 * (1 + mu) ** 3));
  const wd = ratio * w1;
  return { md, kd: md * wd * wd, cd: 2 * zd * md * wd, mu, fd: wd / (2 * Math.PI), zd };
}

/**
 * Sistema linear completo: M ẍ + C ẋ + K x = −M 1 a_g (deslocamentos relativos ao solo).
 * Com TMD, o último grau de liberdade é a massa do amortecedor ligada ao topo.
 */
export interface Linear {
  M: number[];
  C: number[][];
  K: number[][];
}

export function system(p: Params, withTmd: boolean): Linear {
  const n = nFloors(p), m = floorMass(p), k = storyK(p);
  const modes = buildingModes(p);
  const { alpha, beta } = rayleigh(p, modes);
  const N = withTmd ? n + 1 : n;
  const K = Array.from({ length: N }, () => new Array(N).fill(0));
  const C = Array.from({ length: N }, () => new Array(N).fill(0));
  const Ks = stiffness(n, k);
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      K[i]![j] = Ks[i]![j]!;
      C[i]![j] = beta * Ks[i]![j]! + (i === j ? alpha * m : 0);
    }
  const M = new Array(N).fill(m);
  if (withTmd) {
    const d = tmd(p, modes);
    M[n] = d.md;
    const t = n - 1;
    K[t]![t] += d.kd;
    K[n]![n] += d.kd;
    K[t]![n] -= d.kd;
    K[n]![t] -= d.kd;
    C[t]![t] += d.cd;
    C[n]![n] += d.cd;
    C[t]![n] -= d.cd;
    C[n]![t] -= d.cd;
  }
  return { M, C, K };
}

/** Derivadas do estado [x(N), v(N)]. */
export function rhs(sys: Linear, y: number[], ag: number): number[] {
  const N = sys.M.length;
  const out = new Array(2 * N);
  for (let i = 0; i < N; i++) {
    out[i] = y[N + i]!;
    let f = -sys.M[i]! * ag;
    const Ki = sys.K[i]!, Ci = sys.C[i]!;
    for (let j = 0; j < N; j++) f -= Ki[j]! * y[j]! + Ci[j]! * y[N + j]!;
    out[N + i] = f / sys.M[i]!;
  }
  return out;
}

/**
 * Amplitude complexa em regime para a_g = A cos(ωt): resolve (K − ω²M + iωC) X = −M·1·A.
 * Devolve |X_i| (m) para cada grau de liberdade.
 */
export function harmonicAmplitude(sys: Linear, omega: number, A: number): number[] {
  const N = sys.M.length;
  // Matriz aumentada complexa [re, im]
  const re = Array.from({ length: N }, (_, i) => sys.K[i]!.map((k, j) => k - (i === j ? omega * omega * sys.M[i]! : 0)));
  const im = Array.from({ length: N }, (_, i) => sys.C[i]!.map((c) => omega * c));
  const br = sys.M.map((m) => -m * A), bi = new Array(N).fill(0);
  for (let c = 0; c < N; c++) {
    let piv = c, best = 0;
    for (let r = c; r < N; r++) {
      const v = Math.hypot(re[r]![c]!, im[r]![c]!);
      if (v > best) [best, piv] = [v, r];
    }
    [re[c], re[piv]] = [re[piv]!, re[c]!];
    [im[c], im[piv]] = [im[piv]!, im[c]!];
    [br[c], br[piv]] = [br[piv]!, br[c]!];
    [bi[c], bi[piv]] = [bi[piv]!, bi[c]!];
    const pr = re[c]![c]!, pi = im[c]![c]!, den = pr * pr + pi * pi;
    for (let r = c + 1; r < N; r++) {
      const ar = re[r]![c]!, ai = im[r]![c]!;
      const fr = (ar * pr + ai * pi) / den, fi = (ai * pr - ar * pi) / den;
      for (let j = c; j < N; j++) {
        const xr = re[c]![j]!, xi = im[c]![j]!;
        re[r]![j] = re[r]![j]! - (fr * xr - fi * xi);
        im[r]![j] = im[r]![j]! - (fr * xi + fi * xr);
      }
      const yr = br[c]!, yi = bi[c]!;
      br[r] = br[r]! - (fr * yr - fi * yi);
      bi[r] = bi[r]! - (fr * yi + fi * yr);
    }
  }
  const xr = new Array(N).fill(0), xi = new Array(N).fill(0);
  for (let r = N - 1; r >= 0; r--) {
    let sr = br[r]!, si = bi[r]!;
    for (let j = r + 1; j < N; j++) {
      sr -= re[r]![j]! * xr[j]! - im[r]![j]! * xi[j]!;
      si -= re[r]![j]! * xi[j]! + im[r]![j]! * xr[j]!;
    }
    const pr = re[r]![r]!, pi = im[r]![r]!, den = pr * pr + pi * pi;
    xr[r] = (sr * pr + si * pi) / den;
    xi[r] = (si * pr - sr * pi) / den;
  }
  return xr.map((v, i) => Math.hypot(v, xi[i]!));
}

// ---------------------------------------------------------------------------
// Excitação
// ---------------------------------------------------------------------------

export const SWEEP_T = 60;
export const sweepF0 = 0.2, sweepF1 = 5;

/** Frequência instantânea da varredura logarítmica (Hz), periódica em SWEEP_T. */
export function sweepFreq(t: number): number {
  const tau = ((t % SWEEP_T) + SWEEP_T) % SWEEP_T;
  return sweepF0 * (sweepF1 / sweepF0) ** (tau / SWEEP_T);
}
function sweepPhase(t: number): number {
  const tau = ((t % SWEEP_T) + SWEEP_T) % SWEEP_T;
  const r = Math.log(sweepF1 / sweepF0);
  return (2 * Math.PI * sweepF0 * SWEEP_T * ((sweepF1 / sweepF0) ** (tau / SWEEP_T) - 1)) / r;
}

/** Registro sintético: espectro de Kanai–Tajimi, fases aleatórias e envoltória de Saragoni simplificada. */
interface Quake {
  f: number[];
  a: number[];
  ph: number[];
  norm: number;
}
const quakeCache = new Map<number, Quake>();
export const QUAKE_T = 40;

export function quakeEnvelope(t: number): number {
  if (t < 0) return 0;
  if (t < 3) return (t / 3) ** 2;
  if (t < 12) return 1;
  return Math.exp(-0.35 * (t - 12));
}

function quake(seed: number): Quake {
  const key = Math.round(seed);
  const hit = quakeCache.get(key);
  if (hit) return hit;
  const rand = rng(1000 + key);
  const wg = 2 * Math.PI * 2.5, zg = 0.6;
  const f: number[] = [], a: number[] = [], ph: number[] = [];
  const K = 80;
  for (let i = 0; i < K; i++) {
    const fi = 0.15 * (12 / 0.15) ** ((i + rand()) / K);
    const w = 2 * Math.PI * fi;
    const r = (w / wg) ** 2;
    const S = (1 + 4 * zg * zg * r) / ((1 - r) ** 2 + 4 * zg * zg * r);
    const df = fi * (Math.log(12 / 0.15) / K);
    f.push(fi);
    a.push(Math.sqrt(S * df));
    ph.push(2 * Math.PI * rand());
  }
  const q: Quake = { f, a, ph, norm: 1 };
  let mx = 0;
  for (let t = 0; t < QUAKE_T; t += 0.005) mx = Math.max(mx, Math.abs(rawQuake(q, t)));
  q.norm = 1 / mx;
  quakeCache.set(key, q);
  return q;
}
function rawQuake(q: Quake, t: number): number {
  let s = 0;
  for (let i = 0; i < q.f.length; i++) s += q.a[i]! * Math.cos(2 * Math.PI * q.f[i]! * t + q.ph[i]!);
  return s * quakeEnvelope(t);
}

export const EXC = ["Senoidal (frequência fixa)", "Varredura de frequência (0,2 → 5 Hz em 60 s)", "Terremoto sintético (registro)"];

/** Aceleração do solo a_g(t) (m/s²). */
export function groundAcc(p: Params, t: number): number {
  const A = num(p, "ag", 1);
  switch (Math.round(num(p, "exc"))) {
    case 1:
      return A * Math.sin(sweepPhase(t));
    case 2: {
      const q = quake(num(p, "seed", 1));
      return t > QUAKE_T ? 0 : A * q.norm * rawQuake(q, t);
    }
    default:
      return A * Math.sin(2 * Math.PI * num(p, "f", 1) * t);
  }
}

/** Frequência dominante atual da excitação (Hz); 0 para o terremoto. */
export function currentFreq(p: Params, t: number): number {
  const e = Math.round(num(p, "exc"));
  if (e === 1) return sweepFreq(t);
  if (e === 2) return 0;
  return num(p, "f", 1);
}
