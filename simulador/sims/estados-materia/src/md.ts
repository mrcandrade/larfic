/**
 * Dinâmica molecular 2D com potencial de Lennard-Jones em unidades reduzidas
 * (σ = 1, ε = 1, m = 1, k_B = 1). Velocity Verlet, paredes rígidas que medem
 * a pressão pelo impulso recebido e termostato de Berendsen opcional.
 */
import { gaussian, rng } from "@fisilab/core";

export const KB = 1.380649e-23;
export const U = 1.66053907e-27;
/** Raio de corte do potencial (σ). */
export const RC = 2.5;
/** Passo reduzido da integração. */
export const DTR = 0.005;
/** Subpassos por passo do runner. */
export const SUB = 8;
/** Ponto triplo do modelo LJ 2D (unidades reduzidas). */
export const T_TRIPLE = 0.415;
export const P_TRIPLE = 0.015;
export const T_CRIT = 0.533;
export const P_CRIT = 0.1;

export interface Substance {
  name: string;
  /** σ em metros. */
  sigma: number;
  /** ε/k_B do modelo, K (ajustado para o ponto triplo real). */
  epsK: number;
  /** ε/k_B tabelado (gás real, 3D), K, só para comparação. */
  epsTab: number;
  massU: number;
  /** Ponto triplo e de ebulição (1 atm) reais, K. */
  Ttp: number;
  Teb: number;
}

export const SUBSTANCES: Substance[] = [
  { name: "Neônio (Ne)", sigma: 2.78e-10, epsK: 24.56 / T_TRIPLE, epsTab: 36.2, massU: 20.18, Ttp: 24.56, Teb: 27.1 },
  { name: "Argônio (Ar)", sigma: 3.4e-10, epsK: 83.81 / T_TRIPLE, epsTab: 119.8, massU: 39.95, Ttp: 83.81, Teb: 87.3 },
  { name: "Oxigênio (O₂, simplificado)", sigma: 3.47e-10, epsK: 54.36 / T_TRIPLE, epsTab: 118, massU: 32.0, Ttp: 54.36, Teb: 90.2 },
  { name: "Água (simplificada)", sigma: 2.8e-10, epsK: 273.16 / T_TRIPLE, epsTab: 650, massU: 18.02, Ttp: 273.16, Teb: 373.1 },
];

export const subOf = (i: number) => SUBSTANCES[Math.max(0, Math.min(SUBSTANCES.length - 1, Math.round(i)))]!;

/** Unidades físicas de uma substância. */
export function units(s: Substance) {
  const eps = s.epsK * KB;
  const m = s.massU * U;
  return { eps, m, tau: s.sigma * Math.sqrt(m / eps), force: eps / s.sigma, press2d: eps / (s.sigma * s.sigma) };
}

// ---------- Potencial de pares ----------

/** U(r) de Lennard-Jones (reduzido). */
export const ljU = (r: number) => 4 * (r ** -12 - r ** -6);
/** Força radial F(r) = −dU/dr (positiva = repulsão). */
export const ljF = (r: number) => 24 * (2 * r ** -13 - r ** -7);
export const R_MIN = 2 ** (1 / 6);
const U_RC = ljU(RC);

export interface MD {
  x: number[];
  y: number[];
  vx: number[];
  vy: number[];
  /** Temperatura do banho (reduzida). */
  Tset: number;
  /** Tempo físico em unidades reduzidas τ. */
  tr: number;
  /** Pressão medida nas paredes (média móvel, reduzida). */
  P: number;
  /** Impulso e tempo acumulados desde o início (média longa). */
  J: number;
  tJ: number;
  /** Lado da caixa no último passo. */
  L: number;
  /** Modo de dois átomos: separação e velocidade relativa (reduzidas). */
  r2: number;
  v2: number;
  drag: boolean;
}

export function initMD(N: number, L: number, T: number, seed = 3): MD {
  const rand = rng(seed);
  const a = 1.1;
  const cols = Math.max(1, Math.min(Math.ceil(Math.sqrt(N) * 1.3), Math.floor((L - 1.1 - a) / a) + 1));
  const x: number[] = [], y: number[] = [], vx: number[] = [], vy: number[] = [];
  const x0 = (L - (cols - 1) * a) / 2;
  let extra = 0;
  for (let i = 0; i < N; i++) {
    const row = Math.floor(i / cols), col = i % cols;
    const px = x0 + col * a + (row % 2 ? a / 2 : 0);
    const py = 0.6 + row * a * 0.866;
    if (px > L - 0.55 || py > L - 0.55) extra++;
    else {
      x.push(px);
      y.push(py);
    }
  }
  // Sem espaço na rede: posições aleatórias sem sobreposição (rejeição).
  for (let k = 0; k < extra; k++) {
    let px = 0, py = 0;
    for (let tries = 0; tries < 5000; tries++) {
      px = 0.6 + rand() * (L - 1.2);
      py = 0.6 + rand() * (L - 1.2);
      if (x.every((xx, j) => (xx - px) ** 2 + (y[j]! - py) ** 2 > 1)) break;
    }
    x.push(px);
    y.push(py);
  }
  for (let i = 0; i < N; i++) {
    vx.push(gaussian(rand));
    vy.push(gaussian(rand));
  }
  const s: MD = { x, y, vx, vy, Tset: T, tr: 0, P: 0, J: 0, tJ: 0, L, r2: 1.6, v2: 0, drag: false };
  // Zera o momento total e ajusta a temperatura exatamente.
  const mx = vx.reduce((a2, b) => a2 + b, 0) / N, my = vy.reduce((a2, b) => a2 + b, 0) / N;
  for (let i = 0; i < N; i++) {
    vx[i]! -= mx;
    vy[i]! -= my;
  }
  const T0 = kinetic(s) / Math.max(1, N - 1);
  const k = T0 > 0 ? Math.sqrt(T / T0) : 0;
  for (let i = 0; i < N; i++) {
    vx[i]! *= k;
    vy[i]! *= k;
  }
  return s;
}

export function kinetic(s: MD): number {
  let k = 0;
  for (let i = 0; i < s.x.length; i++) k += 0.5 * (s.vx[i]! ** 2 + s.vy[i]! ** 2);
  return k;
}

/** Temperatura cinética 2D: k_B T = E_c / (N − 1) (momento total nulo). */
export const temperature = (s: MD) => kinetic(s) / Math.max(1, s.x.length - 1);

/** Energia potencial total (LJ truncado e deslocado + gravidade). */
export function potential(s: MD, g = 0): number {
  const n = s.x.length;
  let u = 0;
  for (let i = 0; i < n; i++) {
    u += g * s.y[i]!;
    for (let j = i + 1; j < n; j++) {
      const r = Math.hypot(s.x[i]! - s.x[j]!, s.y[i]! - s.y[j]!);
      if (r < RC) u += ljU(Math.max(r, 0.5)) - U_RC;
    }
  }
  return u;
}

function forces(s: MD, g: number, fx: number[], fy: number[]) {
  const n = s.x.length;
  fx.fill(0);
  fy.fill(-g);
  const rc2 = RC * RC;
  for (let i = 0; i < n; i++) {
    const xi = s.x[i]!, yi = s.y[i]!;
    for (let j = i + 1; j < n; j++) {
      const dx = xi - s.x[j]!, dy = yi - s.y[j]!;
      const r2 = dx * dx + dy * dy;
      if (r2 >= rc2) continue;
      const q = Math.max(r2, 0.36);
      const i6 = 1 / (q * q * q);
      const f = (24 * i6 * (2 * i6 - 1)) / q; // F/r
      fx[i]! += f * dx;
      fy[i]! += f * dy;
      fx[j]! -= f * dx;
      fy[j]! -= f * dy;
    }
  }
}

/**
 * Avança `nsub` subpassos de Verlet. Paredes rígidas em 0,5σ das bordas:
 * o impulso 2m|v⊥| de cada choque entra na medida da pressão.
 */
export function stepMD(s0: MD, opts: { L: number; g: number; thermostat: boolean; nsub?: number; dt?: number }): MD {
  const s: MD = { ...s0, x: s0.x.slice(), y: s0.y.slice(), vx: s0.vx.slice(), vy: s0.vy.slice() };
  const n = s.x.length;
  const dt = opts.dt ?? DTR;
  const L = opts.L;
  const lo = 0.5, hi = L - 0.5;
  const fx = new Array<number>(n).fill(0), fy = new Array<number>(n).fill(0);
  forces(s, opts.g, fx, fy);
  let J = 0;
  const nsub = opts.nsub ?? SUB;
  for (let k = 0; k < nsub; k++) {
    for (let i = 0; i < n; i++) {
      s.vx[i]! += 0.5 * dt * fx[i]!;
      s.vy[i]! += 0.5 * dt * fy[i]!;
      s.x[i]! += dt * s.vx[i]!;
      s.y[i]! += dt * s.vy[i]!;
      if (s.x[i]! < lo) { s.x[i] = Math.min(hi, 2 * lo - s.x[i]!); if (s.vx[i]! < 0) { J += -2 * s.vx[i]!; s.vx[i] = -s.vx[i]!; } }
      if (s.x[i]! > hi) { s.x[i] = Math.max(lo, 2 * hi - s.x[i]!); if (s.vx[i]! > 0) { J += 2 * s.vx[i]!; s.vx[i] = -s.vx[i]!; } }
      if (s.y[i]! < lo) { s.y[i] = Math.min(hi, 2 * lo - s.y[i]!); if (s.vy[i]! < 0) { J += -2 * s.vy[i]!; s.vy[i] = -s.vy[i]!; } }
      if (s.y[i]! > hi) { s.y[i] = Math.max(lo, 2 * hi - s.y[i]!); if (s.vy[i]! > 0) { J += 2 * s.vy[i]!; s.vy[i] = -s.vy[i]!; } }
    }
    forces(s, opts.g, fx, fy);
    for (let i = 0; i < n; i++) {
      s.vx[i]! += 0.5 * dt * fx[i]!;
      s.vy[i]! += 0.5 * dt * fy[i]!;
    }
    if (opts.thermostat) {
      const T = temperature(s);
      if (T > 1e-9) {
        const lam = Math.sqrt(Math.max(0.81, Math.min(1.21, 1 + (dt / 0.3) * (s.Tset / T - 1))));
        for (let i = 0; i < n; i++) {
          s.vx[i]! *= lam;
          s.vy[i]! *= lam;
        }
      }
    }
  }
  const tStep = nsub * dt;
  const Pinst = J / (4 * (hi - lo) * tStep);
  const w = Math.min(1, tStep / 4);
  s.P = s.tr === 0 ? Pinst : s.P + (Pinst - s.P) * w;
  s.J += J;
  s.tJ += tStep;
  s.tr += tStep;
  s.L = L;
  return s;
}

/** Pressão média desde o início (impulso total / perímetro / tempo). */
export const meanPressure = (s: MD) => (s.tJ > 0 ? s.J / (4 * (s.L - 1) * s.tJ) : 0);

/** Classificação local: 0 sólido (6 vizinhos em ordem hexagonal), 1 líquido, 2 gás. */
export function localPhases(s: MD): { phase: number[]; psi6: number; coord: number } {
  const n = s.x.length;
  const phase: number[] = [];
  let psiSum = 0, cSum = 0;
  for (let i = 0; i < n; i++) {
    let re = 0, im = 0, nb = 0;
    for (let j = 0; j < n; j++) {
      if (j === i) continue;
      const dx = s.x[j]! - s.x[i]!, dy = s.y[j]! - s.y[i]!;
      if (dx * dx + dy * dy < 1.5 * 1.5) {
        const a = 6 * Math.atan2(dy, dx);
        re += Math.cos(a);
        im += Math.sin(a);
        nb++;
      }
    }
    // Com menos de 3 vizinhos |ψ₆| é trivialmente alto: não conta como ordem.
    const psi = nb >= 3 ? Math.hypot(re, im) / nb : 0;
    psiSum += psi;
    cSum += nb;
    phase.push(nb >= 4 && psi > 0.7 ? 0 : nb >= 2 ? 1 : 2);
  }
  return { phase, psi6: n ? psiSum / n : 0, coord: n ? cSum / n : 0 };
}

export function phaseName(ph: number[]): string {
  const n = ph.length || 1;
  const f = [0, 1, 2].map((k) => ph.filter((p) => p === k).length / n);
  if (f[0]! > 0.55) return f[2]! > 0.15 ? "sólido + vapor" : "sólido";
  if (f[0]! + f[1]! > 0.55) return f[2]! > 0.15 ? "líquido + vapor" : f[0]! > 0.25 ? "sólido + líquido" : "líquido";
  return "gás";
}

/** Curvas de coexistência do modelo (Clausius–Clapeyron entre ponto triplo e crítico). */
export function vaporPressure(T: number): number {
  const B = Math.log(P_CRIT / P_TRIPLE) / (1 / T_TRIPLE - 1 / T_CRIT);
  return P_TRIPLE * Math.exp(-B * (1 / T - 1 / T_TRIPLE));
}
export function sublimationPressure(T: number): number {
  const B = Math.log(P_CRIT / P_TRIPLE) / (1 / T_TRIPLE - 1 / T_CRIT) + 1.2;
  return P_TRIPLE * Math.exp(-B * (1 / T - 1 / T_TRIPLE));
}
/** Linha de fusão quase vertical (inclinação positiva, como em quase todas as substâncias). */
export const meltingT = (P: number) => T_TRIPLE + 0.04 * Math.log10(Math.max(P, P_TRIPLE) / P_TRIPLE);

// ---------- Dois átomos ----------

/** Avança o par (átomo A fixo, B livre) com Verlet; amortecimento γ opcional; parede em rMax. */
export function stepPair(r: number, v: number, dt: number, damp: number, rMax = 5.5, nsub = 40): [number, number] {
  const h = dt / nsub;
  let a = ljF(r) - damp * v;
  for (let k = 0; k < nsub; k++) {
    v += 0.5 * h * a;
    r += h * v;
    if (r > rMax) { r = 2 * rMax - r; v = -Math.abs(v); }
    if (r < 0.75) { r = 0.75; v = Math.abs(v); }
    a = ljF(r) - damp * v;
    v += 0.5 * h * a;
  }
  return [r, v];
}
