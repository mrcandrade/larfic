/** Medidas históricas da velocidade da luz: modelos e grandezas observadas. */
import { gaussian, rng } from "@fisilab/core";

export const C0 = 299_792_458;
export const AU = 1.495978707e11;
export const DAY = 86_400;
export const YEAR_D = 365.25636;
export const JUP_D = 4332.59;
export const JUP_A = 5.2026;
export const IO_P = 1.769138;
/** Velocidade orbital média da Terra (m/s). */
export const V_EARTH = 29_780;
export const ARCSEC = Math.PI / (180 * 3600);

// ---------- Galileu ----------
export interface Trial {
  far: boolean;
  /** Tempo medido pelo observador A (s). */
  tm: number;
  /** Reações sorteadas de B e de A (s). */
  rB: number;
  rA: number;
}

/** Ensaio i: pares = lanternas lado a lado (calibração); ímpares = separadas pela distância d. */
export function galileoTrial(i: number, dKm: number, tau: number, sigma: number, c: number): Trial {
  const r = rng(7919 * (i + 1));
  const far = i % 2 === 1;
  const rB = Math.max(0.05, tau + sigma * gaussian(r));
  const rA = Math.max(0.05, tau + sigma * gaussian(r));
  const d = far ? dKm * 1000 : 2;
  return { far, tm: (2 * d) / c + rB + rA, rB, rA };
}

export function stats(xs: number[]) {
  const n = xs.length;
  if (n === 0) return { n, mean: 0, sd: 0, se: 0 };
  const mean = xs.reduce((a, b) => a + b, 0) / n;
  const sd = n > 1 ? Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)) : 0;
  return { n, mean, sd, se: n > 0 ? sd / Math.sqrt(n) : 0 };
}

export function galileoResult(trials: Trial[], dKm: number) {
  const far = stats(trials.filter((t) => t.far).map((t) => t.tm));
  const near = stats(trials.filter((t) => !t.far).map((t) => t.tm));
  const diff = far.mean - near.mean;
  const se = Math.hypot(far.se, near.se);
  const naive = far.n ? (2 * dKm * 1000) / far.mean : 0;
  return { far, near, diff, se, naive, cEst: diff > 0 ? (2 * (dKm * 1000 - 2)) / diff : 0 };
}

// ---------- Rømer ----------
/** Posições heliocêntricas (UA) da Terra e de Júpiter (órbitas circulares, oposição em t = 0). */
export function earthJupiter(day: number) {
  const tE = (2 * Math.PI * day) / YEAR_D, tJ = (2 * Math.PI * day) / JUP_D;
  return { E: [Math.cos(tE), Math.sin(tE)] as [number, number], J: [JUP_A * Math.cos(tJ), JUP_A * Math.sin(tJ)] as [number, number] };
}
export function distEJ(day: number): number {
  const { E, J } = earthJupiter(day);
  return Math.hypot(J[0] - E[0], J[1] - E[1]);
}
/** Elongação de Júpiter (ângulo Sol–Terra–Júpiter), em rad. */
export function elongation(day: number): number {
  const { E, J } = earthJupiter(day);
  const a: [number, number] = [-E[0], -E[1]], b: [number, number] = [J[0] - E[0], J[1] - E[1]];
  return Math.acos((a[0] * b[0] + a[1] * b[1]) / (Math.hypot(...a) * Math.hypot(...b)));
}

export interface Eclipse {
  n: number;
  /** Dia observado na Terra. */
  day: number;
  /** Observado − previsto (s). */
  oc: number;
  /** Distância Terra–Júpiter menos a da oposição (UA). */
  dd: number;
}

const IO_T0 = 0.3;
/** Emersão n de Io (dia na Terra) com atraso de luz, para velocidade c e ruído de cronometragem σ (s). */
export function eclipse(n: number, c: number, noise: number): Eclipse {
  const tn = IO_T0 + n * IO_P;
  const k = AU / c / DAY;
  let tObs = tn + distEJ(tn) * k;
  tObs = tn + distEJ(tObs) * k;
  const d0 = distEJ(0);
  const dd = distEJ(tObs) - d0;
  const oc = (dd * AU) / c + noise * gaussian(rng(104729 + 31 * n));
  return { n, day: tObs, oc, dd };
}

/** c pela reta de O−C × Δd (pelo zero): c = Σx² / Σxy. */
export function romerFit(ecl: Eclipse[]): number {
  let sxx = 0, sxy = 0;
  for (const e of ecl) {
    const x = e.dd * AU;
    sxx += x * x;
    sxy += x * e.oc;
  }
  return ecl.length >= 5 && sxy > 0 && sxx > (0.2 * AU) ** 2 ? sxx / sxy : 0;
}

// ---------- Bradley ----------
/** Desvio horizontal do fóton no fundo do tubo (em unidades do comprimento do tubo) com inclinação ψ e v/c = β. */
export const tubeMiss = (psi: number, beta: number) => Math.sin(psi) - beta * Math.cos(psi);
/** Constante de aberração κ = arctan(v/c) (rad). */
export const aberration = (v: number, c: number) => Math.atan(v / c);
/** Aberração anual de uma estrela na latitude eclíptica β* (rad): desvios (Δλ cos β, Δβ) em rad. */
export function annualAberration(day: number, kappa: number, betaStar: number, lamStar: number): [number, number] {
  const sun = (2 * Math.PI * (day - 79)) / YEAR_D;
  return [-kappa * Math.cos(sun - lamStar), -kappa * Math.sin(sun - lamStar) * Math.sin(betaStar)];
}

// ---------- Fizeau ----------
/** Fração da luz que volta pela roda (0 a 1): I = |1 − 2x|, x = frac(N f · 2L/c). */
export function fizeauI(N: number, f: number, L: number, c: number): number {
  const x = (((N * f * 2 * L) / c) % 1 + 1) % 1;
  return Math.abs(1 - 2 * x);
}
export const fizeauFirst = (N: number, L: number, c: number) => c / (4 * N * L);

// ---------- Foucault ----------
/** Deslocamento da imagem (m): δ = 2ω·Δt·D, com Δt = 2[(R − ℓ) + nℓ]/c. */
export function foucaultShift(f: number, R: number, D: number, c: number, waterL = 0, n = 1.333): number {
  const w = 2 * Math.PI * f;
  const dt = (2 * (R - waterL + n * waterL)) / c;
  return 2 * w * dt * D;
}
