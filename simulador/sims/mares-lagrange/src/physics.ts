import { clamp, num, type Params } from "@fisilab/core";

/** Constantes astronômicas (SI). */
export const GRAV = 6.674e-11;
export const M_EARTH = 5.972e24;
export const M_MOON = 7.342e22;
export const M_SUN = 1.989e30;
export const R_EARTH = 6.371e6;
export const D_SUN = 1.496e11;
/** Períodos em dias: mês sideral, ano, dia sideral. */
export const T_MOON = 27.32;
export const T_YEAR = 365.25;
export const T_DAY = 0.99727;

export const modeOf = (p: Params) => Math.round(num(p, "modo"));

/** Distância da Lua (m), dada em raios terrestres. */
export const moonDist = (p: Params) => num(p, "dL", 60.3) * R_EARTH;
export const moonMass = (p: Params) => num(p, "mL", 1) * M_MOON;
export const sunOn = (p: Params) => num(p, "sol", 1) > 0.5;

/**
 * Aceleração de maré exata no ponto r (m) devida a um corpo de massa M na posição D:
 * a = GM [(D − r)/|D − r|³ − D/|D|³].
 */
export function tidalAccel(r: [number, number], D: [number, number], M: number): [number, number] {
  const dx = D[0] - r[0], dy = D[1] - r[1];
  const d3 = Math.hypot(dx, dy) ** 3;
  const D3 = Math.hypot(D[0], D[1]) ** 3;
  return [GRAV * M * (dx / d3 - D[0] / D3), GRAV * M * (dy / d3 - D[1] / D3)];
}

/** Amplitude da maré de equilíbrio: h₀ = (M/M_T)(R/d)³ R. A altura é h₀ (3cos²γ − 1)/2. */
export const tideScale = (M: number, d: number) => (M / M_EARTH) * (R_EARTH / d) ** 3 * R_EARTH;

export interface TideState {
  phiL: number;
  phiS: number;
  /** Ângulo do observador no equador (gira com a Terra). */
  psi: number;
}

/** Altura da maré de equilíbrio (m) no ponto de ângulo θ do equador. */
export function tideHeight(s: TideState, p: Params, theta: number): number {
  let h = tideScale(moonMass(p), moonDist(p)) * (3 * Math.cos(theta - s.phiL) ** 2 - 1) / 2;
  if (sunOn(p)) h += tideScale(M_SUN, D_SUN) * (3 * Math.cos(theta - s.phiS) ** 2 - 1) / 2;
  return h;
}

/** Variação máxima de nível (preamar − baixa-mar) com os ângulos atuais. */
export function tideRange(s: TideState, p: Params): number {
  let hi = -Infinity, lo = Infinity;
  for (let i = 0; i < 360; i++) {
    const h = tideHeight(s, p, (i * Math.PI) / 180);
    hi = Math.max(hi, h);
    lo = Math.min(lo, h);
  }
  return hi - lo;
}

// ---------------- Problema restrito de três corpos (unidades: separação = 1, Ω = 1, G(M₁+M₂) = 1)

export function muOf(p: Params): number {
  switch (Math.round(num(p, "sistema"))) {
    case 0:
      return 0.01215;
    case 1:
      return 9.537e-4;
    default:
      return clamp(num(p, "mu", 0.01), 1e-5, 0.5);
  }
}

/** Potencial efetivo no referencial girante. Corpo 1 (1 − μ) em (−μ, 0), corpo 2 (μ) em (1 − μ, 0). */
export function phiEff(x: number, y: number, mu: number): number {
  const r1 = Math.hypot(x + mu, y), r2 = Math.hypot(x - 1 + mu, y);
  return -(1 - mu) / r1 - mu / r2 - 0.5 * (x * x + y * y);
}

/** Aceleração gravitacional + centrífuga (sem Coriolis) = −∇Φ. */
export function gradForce(x: number, y: number, mu: number): [number, number] {
  const r1 = Math.hypot(x + mu, y), r2 = Math.hypot(x - 1 + mu, y);
  const a = (1 - mu) / r1 ** 3, b = mu / r2 ** 3;
  return [x - a * (x + mu) - b * (x - 1 + mu), y - a * y - b * y];
}

/** Derivadas [x, y, vx, vy] no referencial girante (com Coriolis). */
export function cr3bp(y: number[], mu: number): number[] {
  const [fx, fy] = gradForce(y[0]!, y[1]!, mu);
  return [y[2]!, y[3]!, fx + 2 * y[3]!, fy - 2 * y[2]!];
}

export function jacobi(y: readonly number[], mu: number): number {
  return -2 * phiEff(y[0]!, y[1]!, mu) - (y[2]! ** 2 + y[3]! ** 2);
}

function bisect(f: (x: number) => number, a: number, b: number): number {
  let fa = f(a);
  for (let i = 0; i < 200; i++) {
    const m = (a + b) / 2;
    const fm = f(m);
    if (fa * fm <= 0) b = m;
    else {
      a = m;
      fa = fm;
    }
  }
  return (a + b) / 2;
}

/** Os cinco pontos de Lagrange [L1..L5]. */
export function lagrangePoints(mu: number): [number, number][] {
  const f = (x: number) => gradForce(x, 0, mu)[0];
  const e = 1e-9;
  const L1 = bisect(f, -mu + e, 1 - mu - e);
  const L2 = bisect(f, 1 - mu + e, 2.5);
  const L3 = bisect(f, -2.5, -mu - e);
  const h = Math.sqrt(3) / 2;
  return [
    [L1, 0],
    [L2, 0],
    [L3, 0],
    [0.5 - mu, h],
    [0.5 - mu, -h],
  ];
}

/** Limite de Routh: L4 e L5 são estáveis para μ < μ_c. */
export const MU_ROUTH = 0.5 * (1 - Math.sqrt(23 / 27));
