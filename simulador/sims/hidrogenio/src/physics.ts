// Física do átomo de hidrogênio (modelo de Schrödinger, núcleo fixo).
// Distâncias em unidades do raio de Bohr a₀; energias em eV.
import { rng } from "@fisilab/core";

/** Raio de Bohr, em metros. */
export const A0 = 5.29177210903e-11;
/** Energia de Rydberg (hc·R∞), em eV. */
export const RY = 13.605693;
/** hc em eV·nm (para comprimentos de onda de transição). */
export const HC_EV_NM = 1239.84198;

export const factorial = (k: number): number => {
  let f = 1;
  for (let i = 2; i <= k; i++) f *= i;
  return f;
};

/** Polinômio de Laguerre generalizado L_k^α(x), pela recorrência de três termos. */
export function laguerre(k: number, alpha: number, x: number): number {
  if (k === 0) return 1;
  let l0 = 1;
  let l1 = 1 + alpha - x;
  for (let i = 1; i < k; i++) {
    const l2 = ((2 * i + 1 + alpha - x) * l1 - (i + alpha) * l0) / (i + 1);
    l0 = l1;
    l1 = l2;
  }
  return l1;
}

/** Função associada de Legendre P_l^m(x), m ≥ 0, sem a fase de Condon–Shortley. */
export function legendre(l: number, m: number, x: number): number {
  const s = Math.sqrt(Math.max(0, 1 - x * x));
  let pmm = 1;
  for (let i = 1; i <= m; i++) pmm *= (2 * i - 1) * s;
  if (l === m) return pmm;
  let pm1 = x * (2 * m + 1) * pmm;
  if (l === m + 1) return pm1;
  let pl = 0;
  for (let ll = m + 2; ll <= l; ll++) {
    pl = (x * (2 * ll - 1) * pm1 - (ll + m - 1) * pmm) / (ll - m);
    pmm = pm1;
    pm1 = pl;
  }
  return pl;
}

/** Função radial normalizada R_nl(r), r em a₀ (∫ r² R² dr = 1). */
export function radialR(n: number, l: number, r: number): number {
  const rho = (2 * r) / n;
  const norm = Math.sqrt((2 / n) ** 3 * (factorial(n - l - 1) / (2 * n * factorial(n + l))));
  return norm * Math.exp(-rho / 2) * rho ** l * laguerre(n - l - 1, 2 * l + 1, rho);
}

/** Densidade radial de probabilidade P(r) = r² R_nl². */
export const radialP = (n: number, l: number, r: number) => r * r * radialR(n, l, r) ** 2;

export const energyEV = (n: number) => -RY / (n * n);
/** ⟨r⟩ = (a₀/2)[3n² − l(l+1)]. */
export const meanR = (n: number, l: number) => (3 * n * n - l * (l + 1)) / 2;

/** Raio mais provável: máximo global de P(r) (busca em grade e refinamento por seção áurea). */
export function mostProbableR(n: number, l: number): number {
  const rMax = rCut(n);
  const N = 4000;
  let best = 0;
  let bi = 1;
  for (let i = 1; i <= N; i++) {
    const v = radialP(n, l, (rMax * i) / N);
    if (v > best) {
      best = v;
      bi = i;
    }
  }
  let a = (rMax * (bi - 1)) / N;
  let b = (rMax * (bi + 1)) / N;
  const g = (Math.sqrt(5) - 1) / 2;
  for (let k = 0; k < 60; k++) {
    const c = b - g * (b - a);
    const d = a + g * (b - a);
    if (radialP(n, l, c) > radialP(n, l, d)) b = d;
    else a = c;
  }
  return (a + b) / 2;
}

/** Raio além do qual a probabilidade é desprezível (para grades e amostragem). */
export const rCut = (n: number) => n * (2.2 * n + 12);

/** Raio que contém a fração `frac` da probabilidade. */
export function radiusContaining(n: number, l: number, frac: number): number {
  const R = rCut(n);
  const N = 3000;
  const h = R / N;
  let acc = 0;
  for (let i = 0; i < N; i++) {
    acc += radialP(n, l, (i + 0.5) * h) * h;
    if (acc >= frac) return (i + 1) * h;
  }
  return R;
}

/** Normalização dos harmônicos esféricos. */
export const ylmNorm = (l: number, m: number) => Math.sqrt(((2 * l + 1) / (4 * Math.PI)) * (factorial(l - Math.abs(m)) / factorial(l + Math.abs(m))));

/**
 * Parte angular. Complexa: Y_l^m = N P_l^|m|(cos θ) e^{imφ} (fase de Condon–Shortley
 * (−1)^m para m > 0). Real: combinações cos(|m|φ) (m > 0) e sen(|m|φ) (m < 0) — px, py, dxy...
 * Devolve [parte real, parte imaginária].
 */
export function angular(l: number, m: number, real: boolean, th: number, ph: number): [number, number] {
  const am = Math.abs(m);
  const base = ylmNorm(l, am) * legendre(l, am, Math.cos(th));
  if (real) {
    if (m === 0) return [base, 0];
    return [Math.SQRT2 * base * (m > 0 ? Math.cos(am * ph) : Math.sin(am * ph)), 0];
  }
  const cs = m > 0 && m % 2 === 1 ? -1 : 1;
  return [cs * base * Math.cos(m * ph), cs * base * Math.sin(m * ph)];
}

/** ψ_nlm(x, y, z) como [Re, Im]. */
export function psi(n: number, l: number, m: number, real: boolean, x: number, y: number, z: number): [number, number] {
  const r = Math.hypot(x, y, z);
  const th = r > 0 ? Math.acos(z / r) : 0;
  const ph = Math.atan2(y, x);
  const R = radialR(n, l, r);
  const [a, b] = angular(l, m, real, th, ph);
  return [R * a, R * b];
}

const LETTERS = ["s", "p", "d", "f", "g"];
export const subshell = (l: number) => LETTERS[l] ?? `l=${l}`;

/** Nome do orbital real (px, dxy, fz³...) ou rótulo do orbital complexo. */
export function orbitalName(n: number, l: number, m: number, real: boolean): string {
  if (!real || l === 0) return l === 0 ? `${n}s` : `${n}${subshell(l)} (m = ${m})`;
  const names: Record<number, Record<number, string>> = {
    1: { 1: "x", [-1]: "y", 0: "z" },
    2: { 0: "z²", 1: "xz", [-1]: "yz", 2: "x²−y²", [-2]: "xy" },
    3: { 0: "z³", 1: "xz²", [-1]: "yz²", 2: "z(x²−y²)", [-2]: "xyz", 3: "x(x²−3y²)", [-3]: "y(3x²−y²)" },
  };
  const tag = names[l]?.[m];
  return tag ? `${n}${subshell(l)}${tag}` : `${n}${subshell(l)} (m = ${m}, real)`;
}

/** Ajusta l e m às regras 0 ≤ l ≤ n − 1 e |m| ≤ l. */
export function quantum(nRaw: number, lRaw: number, mRaw: number): { n: number; l: number; m: number; adjusted: boolean } {
  const n = Math.max(1, Math.round(nRaw));
  const l = Math.min(Math.max(0, Math.round(lRaw)), n - 1);
  const m = Math.min(Math.max(Math.round(mRaw), -l), l);
  return { n, l, m, adjusted: l !== Math.round(lRaw) || m !== Math.round(mRaw) };
}

export interface Cloud {
  /** x, y, z (a₀) e o valor de cor: fase (complexo) ou sinal ±1 (real). */
  pts: Float64Array;
  count: number;
}

/**
 * Amostra pontos com densidade |ψ|²: r pela inversa da distribuição P(r) e (θ, φ)
 * por rejeição sobre |Y|². É uma amostragem exata (não uma grade).
 */
export function sampleCloud(n: number, l: number, m: number, real: boolean, count: number, seed = 1): Cloud {
  const rand = rng(seed);
  const R = rCut(n);
  const N = 2000;
  const h = R / N;
  const cdf = new Float64Array(N + 1);
  for (let i = 0; i < N; i++) cdf[i + 1] = cdf[i]! + radialP(n, l, (i + 0.5) * h) * h;
  const tot = cdf[N]!;
  // máximo de |Y|² numa grade fina (com folga)
  let ymax = 0;
  for (let i = 0; i <= 90; i++)
    for (let j = 0; j < 90; j++) {
      const [a, b] = angular(l, m, real, (Math.PI * i) / 90, (2 * Math.PI * j) / 90);
      ymax = Math.max(ymax, a * a + b * b);
    }
  ymax *= 1.05;
  const pts = new Float64Array(count * 4);
  for (let k = 0; k < count; k++) {
    const u = rand() * tot;
    let lo = 0;
    let hi = N;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (cdf[mid]! < u) lo = mid;
      else hi = mid;
    }
    const f = (u - cdf[lo]!) / Math.max(cdf[lo + 1]! - cdf[lo]!, 1e-300);
    const r = (lo + f) * h;
    let th = 0;
    let ph = 0;
    let a = 0;
    let b = 0;
    for (let tries = 0; tries < 500; tries++) {
      th = Math.acos(2 * rand() - 1);
      ph = 2 * Math.PI * rand();
      [a, b] = angular(l, m, real, th, ph);
      if (rand() * ymax <= a * a + b * b) break;
    }
    const st = Math.sin(th);
    pts[4 * k] = r * st * Math.cos(ph);
    pts[4 * k + 1] = r * st * Math.sin(ph);
    pts[4 * k + 2] = r * Math.cos(th);
    const Rr = radialR(n, l, r);
    pts[4 * k + 3] = real ? Math.sign(Rr * a) || 1 : Math.atan2(Rr * b, Rr * a);
  }
  return { pts, count };
}

/** Nós: radiais (n − l − 1), angulares (l), total (n − 1). */
export const nodes = (n: number, l: number) => ({ radial: n - l - 1, angular: l, total: n - 1 });

/** Comprimento de onda (nm) do fóton na transição ni → nf (ni > nf emite). */
export const transitionNm = (ni: number, nf: number) => HC_EV_NM / Math.abs(RY * (1 / (nf * nf) - 1 / (ni * ni)));
