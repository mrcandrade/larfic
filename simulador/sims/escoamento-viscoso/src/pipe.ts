// Escoamento em tubo circular: Poiseuille, transição e turbulência (Blasius/Prandtl).
import { num, type Params } from "@fisilab/core";

export interface Fluid {
  value: number;
  label: string;
  rho: number;
  mu: number;
}

export const FLUIDS: Fluid[] = [
  { value: 0, label: "Água (20 °C)", rho: 998, mu: 1.0e-3 },
  { value: 1, label: "Glicerina (20 °C)", rho: 1260, mu: 1.41 },
  { value: 2, label: "Óleo de motor SAE 30 (20 °C)", rho: 880, mu: 0.29 },
  { value: 3, label: "Ar (20 °C)", rho: 1.204, mu: 1.81e-5 },
  { value: 4, label: "Sangue (37 °C, aprox. newtoniano)", rho: 1060, mu: 3.5e-3 },
];
export const fluidOf = (p: Params) => FLUIDS[Math.round(num(p, "fluido", 0))] ?? FLUIDS[0]!;
export const diamOf = (p: Params) => num(p, "D", 10) / 1000;
export const lenOf = (p: Params) => num(p, "L", 1);

export const RE_LAM = 2300;
export const RE_TURB = 4000;

/** Intermitência γ: 0 laminar, 1 turbulento (transição suave entre 2300 e 4000). */
export function intermittency(re: number): number {
  const u = Math.max(0, Math.min(1, (re - RE_LAM) / (RE_TURB - RE_LAM)));
  return u * u * (3 - 2 * u);
}

/** Fator de atrito turbulento em tubo liso: Blasius até 10⁵, Prandtl–Kármán acima. */
export function fTurb(re: number): number {
  const r = Math.max(re, 1);
  if (r <= 1e5) return 0.3164 * r ** -0.25;
  let f = 0.02;
  for (let i = 0; i < 40; i++) f = (2 * Math.log10(r * Math.sqrt(f)) - 0.8) ** -2;
  return f;
}

/** Fator de atrito de Darcy com a transição laminar → turbulento. */
export function friction(re: number): number {
  const g = intermittency(re);
  return (1 - g) * (64 / Math.max(re, 1e-9)) + g * fTurb(re);
}

export const reynolds = (p: Params, v: number) => (fluidOf(p).rho * v * diamOf(p)) / fluidOf(p).mu;

/** Queda de pressão Δp = f (L/D) ρv²/2 para velocidade média v. */
export function pressureDrop(p: Params, v: number): number {
  const fl = fluidOf(p);
  return friction(reynolds(p, v)) * (lenOf(p) / diamOf(p)) * 0.5 * fl.rho * v * v;
}

/** Velocidade média: dada diretamente ou, no controle por pressão, obtida invertendo Δp(v). */
export function meanVelocity(p: Params): number {
  if (Math.round(num(p, "ctrl", 0)) === 0) return num(p, "vm", 0.1);
  const dp = num(p, "dp", 100);
  let lo = Math.log(1e-9), hi = Math.log(1e3);
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    if (pressureDrop(p, Math.exp(mid)) < dp) lo = mid;
    else hi = mid;
  }
  return Math.exp((lo + hi) / 2);
}

/** Expoente da lei de potência turbulenta u/u_max = (1 − r/R)^{1/n}. */
export const powerN = (re: number) => Math.max(5, -1.7 + 1.8 * Math.log10(Math.max(re, 4000)));

/** Perfil u(r)/v̄ (r em unidades de R, |r| ≤ 1) com a mistura laminar/turbulenta. */
export function profile(re: number, r: number): number {
  const a = Math.min(1, Math.abs(r));
  const lam = 2 * (1 - a * a);
  const g = intermittency(re);
  if (g === 0) return lam;
  const n = powerN(re);
  const umaxOverMean = ((n + 1) * (2 * n + 1)) / (2 * n * n);
  const turb = umaxOverMean * (1 - a) ** (1 / n);
  return (1 - g) * lam + g * turb;
}

export interface PipeState {
  v: number;
  re: number;
  q: number;
  dp: number;
  f: number;
}

export function pipeState(p: Params): PipeState {
  const v = meanVelocity(p);
  const re = reynolds(p, v);
  const D = diamOf(p);
  return { v, re, q: (Math.PI * D * D * v) / 4, dp: pressureDrop(p, v), f: friction(re) };
}
