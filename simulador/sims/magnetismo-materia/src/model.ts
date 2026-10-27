// Modelo de Ising 2D (rede L × L, contorno periódico) com dinâmica de Metropolis.
// Unidades reduzidas: J = 1 (acoplamento), μ = 1 (momento de cada spin), k_B = 1;
// h = μB/J é o campo aplicado e T a temperatura em J/k_B.
import { gaussian } from "@fisilab/core";

export const L = 40;
/** Temperatura crítica exata de Onsager: 2/ln(1 + √2). */
export const TC = 2 / Math.log(1 + Math.SQRT2);
/** Susceptibilidade diamagnética (exagerada para ficar visível). */
export const CHI_DIA = -0.05;

export interface Lattice {
  s: Int8Array;
  /** Campo local aleatório (defeitos / desordem) de cada sítio. */
  hr: Float32Array;
  seed: number;
}

export function nextRand(seed: number): [number, number] {
  const a = (seed + 0x6d2b79f5) >>> 0;
  let t = a;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, a];
}

/** Rede inicial: "ordenada" (todos para cima) ou desmagnetizada (aleatória); desordem R. */
export function makeLattice(start: "up" | "random", R: number, seed: number): Lattice {
  let sd = seed >>> 0;
  const rand = () => {
    const [u, n] = nextRand(sd);
    sd = n;
    return u;
  };
  const s = new Int8Array(L * L);
  const hr = new Float32Array(L * L);
  for (let k = 0; k < L * L; k++) {
    s[k] = start === "up" ? 1 : rand() < 0.5 ? 1 : -1;
    hr[k] = R > 0 ? R * gaussian(rand) : 0;
  }
  return { s, hr, seed: sd };
}

const nbSum = (s: Int8Array, i: number, j: number) =>
  s[((i + 1) % L) + j * L]! + s[((i + L - 1) % L) + j * L]! + s[i + ((j + 1) % L) * L]! + s[i + ((j + L - 1) % L) * L]!;

/**
 * Uma varredura de Metropolis (L² tentativas, sítios em ordem aleatória).
 * E = −J Σ s_i s_j − Σ (h + h_i) s_i;  ΔE ao virar s_i: 2 s_i (J Σ_viz s_j + h + h_i).
 */
export function sweep(lat: Lattice, J: number, h: number, T: number, n = 1): Lattice {
  const s = lat.s.slice();
  let sd = lat.seed;
  const rand = () => {
    const [u, nx] = nextRand(sd);
    sd = nx;
    return u;
  };
  const beta = 1 / Math.max(T, 1e-6);
  for (let rep = 0; rep < n; rep++)
    for (let a = 0; a < L * L; a++) {
      const k = Math.floor(rand() * L * L);
      const i = k % L, j = (k - i) / L;
      const dE = 2 * s[k]! * (J * nbSum(s, i, j) + h + lat.hr[k]!);
      if (dE <= 0 || rand() < Math.exp(-beta * dE)) s[k] = -s[k]! as 1 | -1;
    }
  return { s, hr: lat.hr, seed: sd };
}

export function magnetization(s: Int8Array): number {
  let m = 0;
  for (let k = 0; k < s.length; k++) m += s[k]!;
  return m / s.length;
}

/** Energia por spin (sem o campo aleatório). */
export function energyPerSpin(s: Int8Array, J: number, h: number): number {
  let e = 0;
  for (let j = 0; j < L; j++)
    for (let i = 0; i < L; i++) {
      const v = s[i + j * L]!;
      e -= J * v * (s[((i + 1) % L) + j * L]! + s[i + ((j + 1) % L) * L]!) + h * v;
    }
  return e / (L * L);
}

/** Magnetização espontânea exata de Onsager–Yang (h = 0, J = 1). */
export const onsagerM = (T: number) => (T >= TC ? 0 : (1 - Math.sinh(2 / T) ** -4) ** 0.125);
/** Paramagneto ideal de spin ½: M/M_s = tanh(μB/k_BT). */
export const paraM = (h: number, T: number) => Math.tanh(h / T);
/** Lei de Curie: χ = μ²/(k_BT) (por spin, unidades reduzidas). */
export const curieChi = (T: number) => 1 / T;
/** Curie–Weiss de campo médio (z = 4 vizinhos): χ = 1/(T − 4J), válida acima de T_c. */
export const curieWeissChi = (T: number, J = 1) => 1 / (T - 4 * J);
