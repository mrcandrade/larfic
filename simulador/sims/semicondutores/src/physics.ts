// Física de sólidos: bandas pelo modelo de Kronig–Penney (pente de Dirac),
// estatística de Fermi–Dirac, portadores em semicondutores, junção pn e LED.

/** k_B em eV/K. */
export const KB_EV = 8.617333262e-5;
/** Carga elementar (C). */
export const Q = 1.602176634e-19;
/** ε₀ (F/m). */
export const EPS0 = 8.8541878128e-12;
/** ħ²/2mₑ em eV·nm². */
export const HB2M = 0.0380998;
/** hc em eV·nm. */
export const HC = 1239.84198;

// ---------------------------------------------------------------- Kronig–Penney

/**
 * Lado direito da relação de dispersão de Kronig–Penney no limite de barreiras
 * delta: cos(ka) = cos(αa) + P sen(αa)/(αa), com E = ħ²α²/2m.
 */
export function kpF(x: number, P: number): number {
  if (Math.abs(x) < 1e-9) return 1 + P;
  return Math.cos(x) + (P * Math.sin(x)) / x;
}

/** Energia (eV) correspondente a αa = x numa rede de período a (nm). */
export const kpEnergy = (x: number, a: number) => (HB2M * x * x) / (a * a);

/**
 * Faixas permitidas de αa: a banda n (1, 2, ...) vai de x_n (raiz de |f| = 1 em
 * ((n−1)π, nπ)) até nπ, onde f = cos(nπ) = ±1 (k na borda da zona).
 */
export function kpBands(P: number, nBands: number): { lo: number; hi: number }[] {
  const out: { lo: number; hi: number }[] = [];
  for (let n = 1; n <= nBands; n++) {
    const hi = n * Math.PI;
    let a = (n - 1) * Math.PI + 1e-9;
    let b = hi - 1e-9;
    const g = (x: number) => Math.abs(kpF(x, P)) - 1;
    if (P <= 0 || g(a) <= 0) {
      out.push({ lo: (n - 1) * Math.PI, hi });
      continue;
    }
    for (let i = 0; i < 80; i++) {
      const c = (a + b) / 2;
      if (g(c) > 0) a = c;
      else b = c;
    }
    out.push({ lo: (a + b) / 2, hi });
  }
  return out;
}

/** Pontos (k·a, E) de uma banda, na zona reduzida (ka ∈ [0, π]). */
export function kpBandCurve(band: { lo: number; hi: number }, P: number, a: number, n = 120): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const x = band.lo + ((band.hi - band.lo) * i) / n;
    const f = Math.max(-1, Math.min(1, kpF(x, P)));
    pts.push([Math.acos(f), kpEnergy(x, a)]);
  }
  return pts;
}

/** Gaps (eV) entre bandas consecutivas. */
export function kpGaps(P: number, a: number, nBands: number): number[] {
  const b = kpBands(P, nBands);
  const out: number[] = [];
  for (let i = 0; i + 1 < b.length; i++) out.push(kpEnergy(b[i + 1]!.lo, a) - kpEnergy(b[i]!.hi, a));
  return out;
}

// ---------------------------------------------------------------- estatística

export const fermiDirac = (E: number, EF: number, T: number) => 1 / (1 + Math.exp((E - EF) / (KB_EV * Math.max(T, 1e-3))));

export interface Material {
  name: string;
  /** Gap (eV); 0 para metal. */
  Eg: number;
  /** Densidades efetivas de estados a 300 K (cm⁻³). */
  Nc: number;
  Nv: number;
  /** Permissividade relativa. */
  epsR: number;
  kind: "metal" | "semicondutor" | "isolante";
}

export const MATERIALS: Material[] = [
  { name: "Metal (cobre)", Eg: 0, Nc: 0, Nv: 0, epsR: 1, kind: "metal" },
  { name: "Germânio", Eg: 0.66, Nc: 1.04e19, Nv: 6.0e18, epsR: 16, kind: "semicondutor" },
  { name: "Silício", Eg: 1.12, Nc: 2.86e19, Nv: 3.1e19, epsR: 11.7, kind: "semicondutor" },
  { name: "Arseneto de gálio", Eg: 1.42, Nc: 4.7e17, Nv: 9.0e18, epsR: 12.9, kind: "semicondutor" },
  { name: "Diamante (isolante)", Eg: 5.47, Nc: 1.0e19, Nv: 1.0e19, epsR: 5.7, kind: "isolante" },
];

/** Concentração intrínseca (cm⁻³): nᵢ = √(N_c N_v) (T/300)^{3/2} e^{−E_g/2kT}. */
export function ni(m: Material, T: number): number {
  if (m.kind === "metal") return 8.5e22;
  return Math.sqrt(m.Nc * m.Nv) * (T / 300) ** 1.5 * Math.exp(-m.Eg / (2 * KB_EV * T));
}

/** Nível intrínseco medido a partir do topo da banda de valência (eV). */
export const intrinsicLevel = (m: Material, T: number) => m.Eg / 2 + ((KB_EV * T) / 2) * Math.log(m.Nv / m.Nc);

/**
 * Portadores com dopagem (ionização completa), pela neutralidade de carga
 * n + N_A = p + N_D e pela lei de ação das massas n·p = nᵢ².
 */
export function carriers(m: Material, T: number, Nd: number, Na: number): { n: number; p: number; EF: number; ni: number } {
  const nI = ni(m, T);
  const D = (Nd - Na) / 2;
  const n = D >= 0 ? D + Math.sqrt(D * D + nI * nI) : (nI * nI) / (-D + Math.sqrt(D * D + nI * nI));
  const p = (nI * nI) / n;
  const EF = intrinsicLevel(m, T) + KB_EV * T * Math.log(n / nI);
  return { n, p, EF, ni: nI };
}

// ---------------------------------------------------------------- junção pn

export interface Junction {
  Vbi: number;
  /** Larguras (m): total e partes nos lados n e p. */
  W: number;
  xn: number;
  xp: number;
  /** Campo máximo (V/m). */
  Emax: number;
  /** Corrente de saturação (A) e corrente na tensão V (A). */
  Is: number;
  I: number;
}

/** Área da junção (m²) e parâmetros de transporte típicos (difusão, comprimentos). */
const AREA = 1e-6;
const DN = 36e-4;
const DP = 12e-4;
const LN = 60e-6;
const LP = 35e-6;

/** Junção abrupta. Concentrações em cm⁻³, V aplicada em volts (positiva = direta). */
export function junction(m: Material, T: number, Na: number, Nd: number, V: number): Junction {
  const kT = KB_EV * T;
  const nI = ni(m, T);
  const Vbi = kT * Math.log((Na * Nd) / (nI * nI));
  const eps = m.epsR * EPS0;
  const NaS = Na * 1e6;
  const NdS = Nd * 1e6;
  const Veff = Math.max(Vbi - V, 0.02 * Vbi);
  const W = Math.sqrt(((2 * eps * Veff) / Q) * ((NaS + NdS) / (NaS * NdS)));
  const xn = (W * NaS) / (NaS + NdS);
  const xp = (W * NdS) / (NaS + NdS);
  const Emax = (Q * NdS * xn) / eps;
  const ni2 = (nI * 1e6) ** 2;
  const Is = Q * AREA * ni2 * (DP / (LP * NdS) + DN / (LN * NaS));
  const I = Is * Math.expm1(Math.min(V / kT, 200));
  return { Vbi, W, xn, xp, Emax, Is, I };
}

/** Diodo de Shockley: I = I_s (e^{V/V_T} − 1). */
export const shockley = (Is: number, V: number, T: number) => Is * Math.expm1(Math.min(V / (KB_EV * T), 200));

/** Tensão para a corrente I (A) no diodo. */
export const vForCurrent = (Is: number, I: number, T: number) => KB_EV * T * Math.log1p(I / Is);

/** Material genérico de LED com gap Eg (densidades de estados típicas). */
export const ledMaterial = (Eg: number): Material => ({ name: "LED", Eg, Nc: 1e18, Nv: 1e19, epsR: 12, kind: "semicondutor" });

/** Comprimento de onda (nm) de um fóton com energia E (eV). */
export const lambdaNm = (E: number) => HC / E;

/** Cor aproximada (rgb) de um comprimento de onda visível; fora do visível devolve null. */
export function wavelengthRGB(nm: number): [number, number, number] | null {
  if (nm < 380 || nm > 780) return null;
  let r = 0;
  let g = 0;
  let b = 0;
  if (nm < 440) [r, g, b] = [-(nm - 440) / 60, 0, 1];
  else if (nm < 490) [r, g, b] = [0, (nm - 440) / 50, 1];
  else if (nm < 510) [r, g, b] = [0, 1, -(nm - 510) / 20];
  else if (nm < 580) [r, g, b] = [(nm - 510) / 70, 1, 0];
  else if (nm < 645) [r, g, b] = [1, -(nm - 645) / 65, 0];
  else [r, g, b] = [1, 0, 0];
  const f = nm < 420 ? 0.3 + (0.7 * (nm - 380)) / 40 : nm > 700 ? 0.3 + (0.7 * (780 - nm)) / 80 : 1;
  return [Math.round(255 * r * f), Math.round(255 * g * f), Math.round(255 * b * f)];
}

export function colorName(nm: number): string {
  if (nm < 380) return "ultravioleta";
  if (nm < 450) return "violeta";
  if (nm < 495) return "azul";
  if (nm < 570) return "verde";
  if (nm < 590) return "amarelo";
  if (nm < 620) return "laranja";
  if (nm <= 750) return "vermelho";
  return "infravermelho";
}
