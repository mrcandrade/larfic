import { num, type Params } from "@fisilab/core";

/**
 * Epidemia em dois modelos rodando lado a lado com os mesmos parâmetros:
 *
 * 1. Determinístico (EDO, mistura homogênea), em frações da população:
 *      dS/dt = −β(1−d) S I,  dE/dt = β(1−d) S I − σE,  dI/dt = σE − γI,  dR/dt = γI
 *    (no SIR, as infecções vão direto para I). β = R₀γ, γ = 1/T_inf, σ = 1/T_lat; V = vacinados.
 * 2. Agentes que se movem num quadrado de lado L = 1. Um suscetível a menos de r_c de um infectado
 *    se contagia com taxa p_c(1−d). r_c é escolhido para que cada agente tenha em média K vizinhos
 *    (K = (N−1)πr_c²), e p_c = β/K: com boa mistura, o modelo de agentes tende à EDO.
 *    Latência e recuperação são sorteadas com taxas σ e γ (tempos exponenciais).
 * Tempo em dias.
 */

export const K_NEIGH = 4;
export const DT_DAYS = 0.1;
export const HIST_MAX = 800;
export const S_ = 0, E_ = 1, I_ = 2, R_ = 3, V_ = 4;

export interface EpiState {
  rs: number;
  k: number;
  t: number;
  x: Float64Array;
  y: Float64Array;
  ang: Float64Array;
  st: Uint8Array;
  /** EDO: frações [S, E, I, R, V]. */
  ode: number[];
  peakA: number;
  tPeakA: number;
  peakO: number;
  tPeakO: number;
  /** Histórico compacto: t, S, I, R (agentes), S, I, R (EDO). */
  hist: number[][];
}

export function rnd(s: { rs: number }): number {
  s.rs = (s.rs + 0x6d2b79f5) >>> 0;
  let t = s.rs;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export const isSEIR = (p: Params) => Math.round(num(p, "modelo", 0)) === 1;
export const R0 = (p: Params) => num(p, "R0", 3);
export const gamma = (p: Params) => 1 / num(p, "Tinf", 7);
export const sigma = (p: Params) => 1 / num(p, "Tlat", 3);
export const beta = (p: Params) => R0(p) * gamma(p);
export const dist = (p: Params) => num(p, "dist", 0);
export const contactRadius = (N: number) => Math.sqrt(K_NEIGH / (Math.PI * Math.max(1, N - 1)));

/** Derivadas da EDO (frações). */
export function odeRHS(y: number[], p: Params): number[] {
  const [S = 0, E = 0, I = 0] = y;
  const inf = beta(p) * (1 - dist(p)) * S * I;
  const g = gamma(p) * I;
  if (isSEIR(p)) {
    const se = sigma(p) * E;
    return [-inf, inf - se, se - g, g, 0];
  }
  return [-inf, 0, inf - g, g, 0];
}
export function rk4(y: number[], p: Params, h: number): number[] {
  const add = (a: number[], b: number[], c: number) => a.map((v, i) => v + c * b[i]!);
  const k1 = odeRHS(y, p);
  const k2 = odeRHS(add(y, k1, h / 2), p);
  const k3 = odeRHS(add(y, k2, h / 2), p);
  const k4 = odeRHS(add(y, k3, h), p);
  return y.map((v, i) => v + (h / 6) * (k1[i]! + 2 * k2[i]! + 2 * k3[i]! + k4[i]!));
}

/** Tamanho final: fração s∞ que escapa, de s∞ = s₀ exp(−R (s₀ + i₀ − s∞)). */
export function finalSusceptible(Reff: number, s0: number, i0: number): number {
  let lo = 0, hi = s0;
  const f = (s: number) => s - s0 * Math.exp(-Reff * (s0 + i0 - s));
  // raiz em (0, s0): f(0) < 0; procura a menor raiz positiva abaixo de s0
  if (Reff * s0 <= 1 && i0 < 1e-6) return s0;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (f(mid) < 0) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}
/** Pico de infectados no SIR (s₀ ≈ 1 − v, i₀ → 0): i_max = s₀ + i₀ − 1/R − ln(R s₀)/R. */
export function sirPeak(R: number, s0 = 1, i0 = 0): number {
  if (R * s0 <= 1) return i0;
  return s0 + i0 - 1 / R - Math.log(R * s0) / R;
}

export function counts(s: EpiState): number[] {
  const c = [0, 0, 0, 0, 0];
  for (let i = 0; i < s.st.length; i++) c[s.st[i]!]!++;
  return c;
}

export function initState(p: Params): EpiState {
  const N = Math.round(num(p, "N", 400));
  const I0 = Math.min(N, Math.round(num(p, "I0", 3)));
  const vac = num(p, "vac", 0);
  const s: EpiState = {
    rs: (Math.imul(Math.round(num(p, "seed", 1)), 0x9e3779b1) ^ 0x68e31da4) >>> 0,
    k: 0,
    t: 0,
    x: new Float64Array(N),
    y: new Float64Array(N),
    ang: new Float64Array(N),
    st: new Uint8Array(N),
    ode: [],
    peakA: 0,
    tPeakA: 0,
    peakO: 0,
    tPeakO: 0,
    hist: [],
  };
  for (let i = 0; i < N; i++) {
    s.x[i] = rnd(s);
    s.y[i] = rnd(s);
    s.ang[i] = 2 * Math.PI * rnd(s);
  }
  const nV = Math.round(vac * (N - I0));
  for (let i = 0; i < I0; i++) s.st[i] = I_;
  for (let i = I0; i < I0 + nV; i++) s.st[i] = V_;
  const i0 = I0 / N, v0 = nV / N;
  s.ode = [1 - i0 - v0, 0, i0, 0, v0];
  s.peakA = s.peakO = i0;
  s.hist.push([0, 1 - i0 - v0, i0, 0, 1 - i0 - v0, i0, 0]);
  return s;
}

export function step(s0: EpiState, p: Params): EpiState {
  const s: EpiState = { ...s0, k: s0.k + 1 };
  const N = s0.st.length;
  s.x = s0.x.slice();
  s.y = s0.y.slice();
  s.ang = s0.ang.slice();
  s.st = s0.st.slice();
  const h = DT_DAYS;
  const d = dist(p);
  // movimento
  const v = num(p, "vel", 0.25) * (1 - 0.7 * d);
  for (let i = 0; i < N; i++) {
    s.ang[i] = s.ang[i]! + 0.6 * (rnd(s) - 0.5);
    let x = s.x[i]! + v * h * Math.cos(s.ang[i]!);
    let y = s.y[i]! + v * h * Math.sin(s.ang[i]!);
    if (x < 0) { x = -x; s.ang[i] = Math.PI - s.ang[i]!; }
    if (x > 1) { x = 2 - x; s.ang[i] = Math.PI - s.ang[i]!; }
    if (y < 0) { y = -y; s.ang[i] = -s.ang[i]!; }
    if (y > 1) { y = 2 - y; s.ang[i] = -s.ang[i]!; }
    s.x[i] = x;
    s.y[i] = y;
  }
  // contágio (taxa por par próximo)
  const rc = contactRadius(N);
  const pc = (beta(p) / K_NEIGH) * (1 - d);
  const pInf = 1 - Math.exp(-pc * h);
  const seir = isSEIR(p);
  const newly: number[] = [];
  for (let i = 0; i < N; i++) {
    if (s0.st[i] !== I_) continue;
    for (let j = 0; j < N; j++) {
      if (s.st[j] !== S_) continue;
      const dx = s.x[j]! - s.x[i]!, dy = s.y[j]! - s.y[i]!;
      if (dx * dx + dy * dy < rc * rc && rnd(s) < pInf) {
        s.st[j] = 9; // marcado (não reinfecta neste passo)
        newly.push(j);
      }
    }
  }
  // progressão
  const pLat = 1 - Math.exp(-sigma(p) * h);
  const pRec = 1 - Math.exp(-gamma(p) * h);
  for (let i = 0; i < N; i++) {
    const st = s0.st[i]!;
    if (st === E_ && rnd(s) < pLat) s.st[i] = I_;
    else if (st === I_ && rnd(s) < pRec) s.st[i] = R_;
  }
  for (const j of newly) s.st[j] = seir ? E_ : I_;
  // EDO
  s.ode = rk4(s0.ode, p, h);
  s.t = s0.t + h;
  const c = counts(s);
  const iA = c[I_]! / N;
  if (iA > s.peakA) { s.peakA = iA; s.tPeakA = s.t; }
  if (s.ode[2]! > s.peakO) { s.peakO = s.ode[2]!; s.tPeakO = s.t; }
  if (s.k % 5 === 0) {
    const hist = s0.hist.length >= HIST_MAX ? s0.hist.filter((_, i) => i % 2 === 0) : s0.hist.slice();
    hist.push([s.t, c[S_]! / N, iA, (c[R_]! + 0) / N, s.ode[0]!, s.ode[2]!, s.ode[3]!]);
    s.hist = hist;
  }
  return s;
}

/** Infecta o agente mais próximo de (x, y), se for suscetível. */
export function infectAt(s: EpiState, x: number, y: number): EpiState | undefined {
  let best = -1, bd = 0.03 ** 2;
  for (let i = 0; i < s.st.length; i++) {
    const d2 = (s.x[i]! - x) ** 2 + (s.y[i]! - y) ** 2;
    if (d2 < bd) { bd = d2; best = i; }
  }
  if (best < 0 || s.st[best] !== S_) return undefined;
  const st = s.st.slice();
  st[best] = I_;
  return { ...s, st };
}
