// Sistema de dois níveis na esfera de Bloch: medida, Rabi, eco e EIT (Λ / escada).
import { cross3, type V3 } from "@fisilab/core";

export const TWO_PI = 2 * Math.PI;

/** Vetor de Bloch a partir dos ângulos θ (polar, a partir de +z) e φ (azimute). */
export const blochVec = (theta: number, phi: number): V3 => [Math.sin(theta) * Math.cos(phi), Math.sin(theta) * Math.sin(phi), Math.cos(theta)];

/** Probabilidade de obter + ao medir ao longo do eixo unitário n: (1 + r·n)/2. */
export const probPlus = (r: V3, n: V3) => (1 + r[0] * n[0] + r[1] * n[1] + r[2] * n[2]) / 2;

/** Rotação de r em torno do eixo unitário a por um ângulo α (fórmula de Rodrigues). */
export function rotate(r: V3, a: V3, alpha: number): V3 {
  const c = Math.cos(alpha);
  const s = Math.sin(alpha);
  const k = (a[0] * r[0] + a[1] * r[1] + a[2] * r[2]) * (1 - c);
  const x = cross3(a, r);
  return [r[0] * c + x[0] * s + a[0] * k, r[1] * c + x[1] * s + a[1] * k, r[2] * c + x[2] * s + a[2] * k];
}

export interface Drive {
  /** Frequência de Rabi e dessintonia (rad/μs), fase do campo (0 = eixo x, π/2 = eixo y). */
  Omega: number;
  Delta: number;
  phase: number;
  /** Tempos de relaxação (μs); Infinity desliga. */
  T1: number;
  T2: number;
}

/** Equações de Bloch no referencial girante: dr/dt = ω × r − relaxação, com ω = (Ω cos φ, Ω sen φ, Δ). */
export function blochDeriv(r: V3, d: Drive): V3 {
  const w: V3 = [d.Omega * Math.cos(d.phase), d.Omega * Math.sin(d.phase), d.Delta];
  const c = cross3(w, r);
  const g2 = Number.isFinite(d.T2) ? 1 / d.T2 : 0;
  const g1 = Number.isFinite(d.T1) ? 1 / d.T1 : 0;
  return [c[0] - g2 * r[0], c[1] - g2 * r[1], c[2] - g1 * (r[2] + 1)];
}

/** Um passo RK4 das equações de Bloch. */
export function blochStep(r: V3, d: Drive, h: number): V3 {
  const ad = (a: V3, b: V3, k: number): V3 => [a[0] + k * b[0], a[1] + k * b[1], a[2] + k * b[2]];
  const k1 = blochDeriv(r, d);
  const k2 = blochDeriv(ad(r, k1, h / 2), d);
  const k3 = blochDeriv(ad(r, k2, h / 2), d);
  const k4 = blochDeriv(ad(r, k3, h), d);
  return [
    r[0] + (h / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]),
    r[1] + (h / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]),
    r[2] + (h / 6) * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]),
  ];
}

/** Fórmula de Rabi: população do excitado partindo do fundamental, sem relaxação. */
export function rabiPe(Omega: number, Delta: number, t: number): number {
  const W = Math.hypot(Omega, Delta);
  if (W === 0) return 0;
  return ((Omega * Omega) / (W * W)) * Math.sin((W * t) / 2) ** 2;
}

// ---------- Eco ----------

export interface EchoSet {
  /** Dessintonias (rad/μs) do conjunto não homogêneo. */
  delta: number[];
}

/** Dessintonias gaussianas de largura σ (MHz, desvio de δ/2π), com semente fixa. */
export function echoSet(sigmaMHz: number, n: number, seed = 7): EchoSet {
  let st = seed >>> 0;
  const rnd = () => {
    st = (st + 0x6d2b79f5) >>> 0;
    let t = st;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const delta: number[] = [];
  for (let i = 0; i < n; i += 2) {
    const u = Math.max(rnd(), 1e-12);
    const v = rnd();
    const R = Math.sqrt(-2 * Math.log(u));
    // pares simétricos ±δ: a média das dessintonias é exatamente zero
    const g = R * Math.cos(TWO_PI * v) * TWO_PI * sigmaMHz;
    delta.push(g, -g);
  }
  return { delta: delta.slice(0, n) };
}

/**
 * Vetor de Bloch de um spin com dessintonia δ no instante t da sequência
 * θ₁(x) — τ — θ₂(x) — eco, partindo de −z, sem relaxação (pulsos instantâneos).
 */
export function echoSpin(delta: number, t: number, tau: number, th1: number, th2: number): V3 {
  const X: V3 = [1, 0, 0];
  const Z: V3 = [0, 0, 1];
  let r = rotate([0, 0, -1], X, th1);
  if (t <= tau) return rotate(r, Z, delta * t);
  r = rotate(r, Z, delta * tau);
  r = rotate(r, X, th2);
  return rotate(r, Z, delta * (t - tau));
}

/** Magnetização transversal média |⟨r_xy⟩| no instante t, com decaimento homogêneo e^{−t/T2}. */
export function echoSignal(set: EchoSet, t: number, tau: number, th1: number, th2: number, T2: number): number {
  let x = 0;
  let y = 0;
  for (const d of set.delta) {
    const r = echoSpin(d, t, tau, th1, th2);
    x += r[0];
    y += r[1];
  }
  const n = set.delta.length || 1;
  return (Math.hypot(x, y) / n) * (Number.isFinite(T2) ? Math.exp(-t / T2) : 1);
}

/** Previsões analíticas (conjunto gaussiano): FID e envelope do eco. */
export const fidAnalytic = (t: number, sigmaMHz: number, th1: number) => Math.abs(Math.sin(th1)) * Math.exp(-((TWO_PI * sigmaMHz * t) ** 2) / 2);
export const echoAnalytic = (t: number, tau: number, sigmaMHz: number, th1: number, th2: number, T2: number) =>
  Math.abs(Math.sin(th1)) * Math.sin(th2 / 2) ** 2 * Math.exp(-((TWO_PI * sigmaMHz * (t - 2 * tau)) ** 2) / 2) * (Number.isFinite(T2) ? Math.exp(-t / T2) : 1);

// ---------- Três níveis: EIT ----------

export interface ThreeLevel {
  /** Rabi do acoplamento, dessintonia do acoplamento, coerência fundamental (em unidades de Γ). */
  Oc: number;
  Dc: number;
  g21: number;
  /** 0 = Λ, 1 = escada, 2 = sem acoplamento (dois níveis). */
  config: number;
}

/**
 * Resposta complexa normalizada do meio à sonda (Δp em unidades de Γ):
 * K = (Γ/2) / (Γ/2 − iΔp + (Ωc²/4)/(γ21 − iδ)), δ = Δp ∓ Δc. Re K = absorção
 * (1 no centro da linha sem acoplamento); Im K = dispersão.
 */
export function response(Dp: number, s: ThreeLevel): { re: number; im: number } {
  // números complexos como pares
  const g = 0.5;
  let ar = g;
  let ai = -Dp;
  if (s.config !== 2 && s.Oc > 0) {
    const delta = s.config === 1 ? Dp + s.Dc : Dp - s.Dc;
    // (Oc²/4) / (g21 − iδ)
    const den = s.g21 * s.g21 + delta * delta;
    const q = (s.Oc * s.Oc) / 4;
    ar += den > 0 ? (q * s.g21) / den : 0;
    ai += den > 0 ? (q * delta) / den : 0;
  }
  // K = g / (ar + i ai)
  const m = ar * ar + ai * ai;
  return { re: (g * ar) / m, im: (-g * ai) / m };
}

/** Transmissão da intensidade da sonda num meio de profundidade óptica OD. */
export const transmission = (Dp: number, s: ThreeLevel, OD: number) => Math.exp(-OD * response(Dp, s).re);

/** Atraso de grupo (em unidades de 1/Γ): τ_g = −(OD/2) d(Im K)/dΔp (o índice é n − 1 ∝ −Im K). */
export function groupDelay(Dp: number, s: ThreeLevel, OD: number): number {
  const h = 1e-4;
  return (-OD / 2) * ((response(Dp + h, s).im - response(Dp - h, s).im) / (2 * h));
}
