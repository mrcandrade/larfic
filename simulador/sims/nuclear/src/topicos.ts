// Tópicos complementares de física nuclear: espectro beta (com o neutrino),
// modelo de camadas (poço de Woods–Saxon com spin–órbita), reator natural de
// Oklo (enriquecimento do passado pelas meias-vidas) e critério de Lawson.

import { core, U_MEV } from "./physics.ts";

// ---------------------------------------------------------------- espectro beta

/** Energia de repouso do elétron (keV) e constante de estrutura fina. */
export const ME_KEV = 510.99895;
export const ALPHA_FS = 1 / 137.035999;

export interface BetaEmitter {
  name: string;
  /** Reação (rótulo). */
  reaction: string;
  /** Massas atômicas (u) do pai e do filho. */
  mParent: number;
  mDaughter: number;
  /** Z do núcleo filho (entra na correção coulombiana). */
  Zd: number;
  /** Meia-vida (texto). */
  halfLife: string;
}

export const BETA_EMITTERS: BetaEmitter[] = [
  { name: "trítio", reaction: "³H → ³He + e⁻ + ν̄", mParent: 3.01604928, mDaughter: 3.01602932, Zd: 2, halfLife: "12,3 anos" },
  { name: "carbono-14", reaction: "¹⁴C → ¹⁴N + e⁻ + ν̄", mParent: 14.0032419884, mDaughter: 14.0030740044, Zd: 7, halfLife: "5730 anos" },
  { name: "fósforo-32", reaction: "³²P → ³²S + e⁻ + ν̄", mParent: 31.97390764, mDaughter: 31.97207117, Zd: 16, halfLife: "14,3 dias" },
];

/** Q do β⁻ (keV) com massas atômicas: os elétrons dos átomos se compensam. */
export const betaQ = (b: BetaEmitter) => (b.mParent - b.mDaughter) * U_MEV * 1000;

/**
 * Densidade de probabilidade (não normalizada) da energia cinética K (keV) do elétron:
 * N(K) ∝ F(Z, E) · p · E · (Q − K)², com E = K + mc², pc = √(K² + 2Kmc²) e a função de
 * Fermi não relativística F = 2πη/(1 − e^(−2πη)), η = Zα E/(pc). O fator (Q − K)² vem do
 * espaço de fase do antineutrino, que leva E_ν = Q − K.
 */
export function betaShape(K: number, Q: number, Zd: number): number {
  if (K <= 0 || K >= Q) return 0;
  const E = K + ME_KEV;
  const p = Math.sqrt(K * K + 2 * K * ME_KEV);
  const x = (2 * Math.PI * Zd * ALPHA_FS * E) / p;
  const F = x / -Math.expm1(-x);
  return F * p * E * (Q - K) ** 2;
}

/** Máximo, normalização e energia média do espectro (integração numérica). */
export function betaStats(b: BetaEmitter): { Q: number; max: number; norm: number; mean: number } {
  const Q = betaQ(b);
  const n = 2000;
  let max = 0;
  let s = 0;
  let s1 = 0;
  for (let i = 1; i < n; i++) {
    const K = (Q * i) / n;
    const f = betaShape(K, Q, b.Zd);
    max = Math.max(max, f);
    s += f;
    s1 += f * K;
  }
  const h = Q / n;
  return { Q, max, norm: s * h, mean: s1 / s };
}

/** Sorteia K (keV) do elétron por rejeição; rnd devolve uniformes em [0, 1). */
export function sampleBeta(b: BetaEmitter, rnd: () => number, st = betaStats(b)): number {
  for (let i = 0; i < 10000; i++) {
    const K = st.Q * rnd();
    if (rnd() * st.max * 1.02 <= betaShape(K, st.Q, b.Zd)) return K;
  }
  return st.mean;
}

/** Decaimento alfa de comparação: ²¹⁰Po → ²⁰⁶Pb + α. */
export const ALPHA_REF = { name: "polônio-210", reaction: "²¹⁰Po → ²⁰⁶Pb + α", mParent: 209.9828737, mDaughter: 205.9744653, mAlpha: 4.00260325413 };
/** Q do alfa (MeV) e energia cinética única da partícula alfa, pela conservação do momento (dois corpos). */
export const alphaQ = () => (ALPHA_REF.mParent - ALPHA_REF.mDaughter - ALPHA_REF.mAlpha) * U_MEV;
export const alphaK = () => (alphaQ() * ALPHA_REF.mDaughter) / (ALPHA_REF.mDaughter + ALPHA_REF.mAlpha);

// ---------------------------------------------------------------- modelo de camadas

/** ħ²/2m de um núcleon (MeV·fm²). */
const H2M = 20.7355;
export const MAGIC = [2, 8, 20, 28, 50, 82, 126];
/** Intensidade de referência do spin–órbita (fração de V₀), escolhida para reproduzir os números mágicos em A ≈ 208. */
export const VLS_REF = 0.57;

export interface ShellLevel {
  n: number;
  l: number;
  /** 2j (inteiro); 0 quando os dois valores de j estão juntos (sem spin–órbita). */
  j2: number;
  E: number;
  /** Quantos núcleons cabem: 2j + 1 (ou 2(2l + 1) sem spin–órbita). */
  deg: number;
}

const LETTERS = "spdfghijklm";
export const levelName = (v: ShellLevel) => `${v.n}${LETTERS[v.l]}${v.j2 ? `${v.j2}/2` : ""}`;

const shellCache = new Map<string, ShellLevel[]>();

/**
 * Níveis ligados de um nêutron num poço de Woods–Saxon (V₀ = 51 MeV, R = 1,27 A^{1/3} fm,
 * a = 0,67 fm) com o termo de spin–órbita de Bohr–Mottelson multiplicado por `so`
 * (0 desliga). A equação radial é discretizada e os autovalores saem por bissecção de Sturm.
 */
export function shellLevels(A: number, so: number): ShellLevel[] {
  const key = `${A}|${so.toFixed(3)}`;
  const hit = shellCache.get(key);
  if (hit) return hit;
  const V0 = 51;
  const a = 0.67;
  const r0 = 1.27;
  const R = r0 * A ** (1 / 3);
  const h = 0.06;
  const n = Math.floor((R + 14) / h);
  const off = -H2M / (h * h);
  const out: ShellLevel[] = [];
  const d = new Float64Array(n);
  for (let l = 0; l <= 10; l++) {
    const js = so === 0 || l === 0 ? [l === 0 ? 1 : 0] : [2 * l + 1, 2 * l - 1];
    for (const j2 of js) {
      const ls = j2 === 0 ? 0 : ((j2 / 2) * (j2 / 2 + 1) - l * (l + 1) - 0.75) / 2;
      for (let i = 0; i < n; i++) {
        const r = (i + 1) * h;
        const ex = Math.exp((r - R) / a);
        const f = 1 / (1 + ex);
        const df = -ex / (a * (1 + ex) ** 2);
        d[i] = 2 * H2M / (h * h) - V0 * f + so * VLS_REF * V0 * r0 * r0 * (df / r) * ls + (H2M * l * (l + 1)) / (r * r);
      }
      // número de autovalores abaixo de E (sequência de Sturm da matriz tridiagonal)
      const below = (E: number) => {
        let c = 0;
        let q = d[0]! - E;
        if (q < 0) c++;
        for (let i = 1; i < n; i++) {
          q = d[i]! - E - (off * off) / (q === 0 ? 1e-300 : q);
          if (q < 0) c++;
        }
        return c;
      };
      const nb = below(0);
      for (let k = 0; k < nb; k++) {
        let lo = -V0 - 5;
        let hi = 0;
        for (let it = 0; it < 50; it++) {
          const m = (lo + hi) / 2;
          if (below(m) > k) hi = m;
          else lo = m;
        }
        out.push({ n: k + 1, l, j2, E: (lo + hi) / 2, deg: j2 === 0 ? 2 * (2 * l + 1) : j2 + 1 });
      }
    }
  }
  out.sort((x, y) => x.E - y.E);
  if (shellCache.size > 60) shellCache.clear();
  shellCache.set(key, out);
  return out;
}

/** Lacunas entre níveis consecutivos: [tamanho (MeV), núcleons acumulados até ali]. */
export function shellGaps(levels: ShellLevel[]): { gap: number; count: number }[] {
  const g: { gap: number; count: number }[] = [];
  let cum = 0;
  levels.forEach((v, i) => {
    cum += v.deg;
    const nx = levels[i + 1];
    if (nx) g.push({ gap: nx.E - v.E, count: cum });
  });
  return g;
}

/** Números de núcleons nas k maiores lacunas (as camadas fechadas que o poço prevê), em ordem crescente. */
export function closedShells(levels: ShellLevel[], k = 7): number[] {
  return shellGaps(levels)
    .sort((x, y) => y.gap - x.gap)
    .slice(0, k)
    .map((g) => g.count)
    .sort((x, y) => x - y);
}

/** Energia (MeV) do primeiro estado excitado 2⁺ de núcleos par–par: dispara nos números mágicos. */
export const FIRST_2PLUS: { name: string; Z: number; N: number; E: number }[] = [
  { name: "¹²C", Z: 6, N: 6, E: 4.439 },
  { name: "¹⁶O", Z: 8, N: 8, E: 6.917 },
  { name: "²⁰Ne", Z: 10, N: 10, E: 1.634 },
  { name: "²⁴Mg", Z: 12, N: 12, E: 1.369 },
  { name: "²⁸Si", Z: 14, N: 14, E: 1.779 },
  { name: "³²S", Z: 16, N: 16, E: 2.231 },
  { name: "³⁶Ar", Z: 18, N: 18, E: 1.97 },
  { name: "⁴⁰Ca", Z: 20, N: 20, E: 3.904 },
  { name: "⁴⁸Ti", Z: 22, N: 26, E: 0.984 },
  { name: "⁴⁸Ca", Z: 20, N: 28, E: 3.832 },
  { name: "⁵²Cr", Z: 24, N: 28, E: 1.434 },
  { name: "⁵⁶Fe", Z: 26, N: 30, E: 0.847 },
  { name: "⁶⁰Ni", Z: 28, N: 32, E: 1.333 },
  { name: "⁶⁴Zn", Z: 30, N: 34, E: 0.992 },
  { name: "⁷⁴Ge", Z: 32, N: 42, E: 0.596 },
  { name: "⁸⁰Kr", Z: 36, N: 44, E: 0.617 },
  { name: "⁸⁸Sr", Z: 38, N: 50, E: 1.836 },
  { name: "⁹⁰Zr", Z: 40, N: 50, E: 2.186 },
  { name: "⁹⁶Mo", Z: 42, N: 54, E: 0.778 },
  { name: "¹⁰⁶Pd", Z: 46, N: 60, E: 0.512 },
  { name: "¹¹⁴Cd", Z: 48, N: 66, E: 0.558 },
  { name: "¹²⁰Sn", Z: 50, N: 70, E: 1.171 },
  { name: "¹³⁰Te", Z: 52, N: 78, E: 0.839 },
  { name: "¹³⁸Ba", Z: 56, N: 82, E: 1.436 },
  { name: "¹⁴⁰Ce", Z: 58, N: 82, E: 1.596 },
  { name: "¹⁵²Sm", Z: 62, N: 90, E: 0.122 },
  { name: "¹⁶⁰Dy", Z: 66, N: 94, E: 0.087 },
  { name: "¹⁶⁸Er", Z: 68, N: 100, E: 0.08 },
  { name: "¹⁷⁴Yb", Z: 70, N: 104, E: 0.077 },
  { name: "¹⁸⁰Hf", Z: 72, N: 108, E: 0.093 },
  { name: "¹⁹²Os", Z: 76, N: 116, E: 0.206 },
  { name: "¹⁹⁶Pt", Z: 78, N: 118, E: 0.356 },
  { name: "²⁰²Hg", Z: 80, N: 122, E: 0.44 },
  { name: "²⁰⁸Pb", Z: 82, N: 126, E: 4.085 },
  { name: "²³²Th", Z: 90, N: 142, E: 0.049 },
  { name: "²³⁸U", Z: 92, N: 146, E: 0.045 },
];

// ---------------------------------------------------------------- Oklo

/** Meias-vidas (bilhões de anos) e fração atômica de U-235 no urânio natural de hoje. */
export const T_U235 = 0.7038;
export const T_U238 = 4.468;
export const ENR_TODAY = 0.0072;

/** Razão N₂₃₅/N₂₃₈ há t bilhões de anos: cresce com e^{(λ₂₃₅ − λ₂₃₈)t} voltando no tempo. */
export function uraniumRatio(tGyr: number): number {
  const r0 = ENR_TODAY / (1 - ENR_TODAY);
  return r0 * Math.exp((Math.LN2 / T_U235 - Math.LN2 / T_U238) * tGyr);
}

/** Fração de U-235 no urânio natural há t bilhões de anos. */
export const enrichmentAgo = (tGyr: number) => {
  const r = uraniumRatio(tGyr);
  return r / (1 + r);
};

/** Quantidades de U-235 e U-238 há t bilhões de anos, relativas ao U-238 de hoje. */
export const uraniumAmounts = (tGyr: number) => ({
  u235: (ENR_TODAY / (1 - ENR_TODAY)) * Math.exp((Math.LN2 / T_U235) * tGyr),
  u238: Math.exp((Math.LN2 / T_U238) * tGyr),
});

/** k∞ do minério com o enriquecimento de t bilhões de anos atrás e o moderador dado (0 nenhum, 1 grafite, 2 água). */
export const kInfAgo = (tGyr: number, moderator = 2) => core(enrichmentAgo(tGyr), moderator, 0).kInf;

/** Enriquecimento mínimo para k∞ = 1 com o moderador dado (bissecção). */
export function criticalEnrichment(moderator = 2): number {
  let lo = 1e-4;
  let hi = 1;
  for (let i = 0; i < 60; i++) {
    const m = Math.sqrt(lo * hi);
    if (core(m, moderator, 0).kInf > 1) hi = m;
    else lo = m;
  }
  return Math.sqrt(lo * hi);
}

/** Há quanto tempo (bilhões de anos) o urânio natural deixou de ser crítico com o moderador dado. */
export function criticalAgo(moderator = 2): number {
  const e = criticalEnrichment(moderator);
  const r = e / (1 - e);
  const r0 = ENR_TODAY / (1 - ENR_TODAY);
  return Math.max(0, Math.log(r / r0) / (Math.LN2 / T_U235 - Math.LN2 / T_U238));
}

// ---------------------------------------------------------------- critério de Lawson

/** Energias (keV) por reação D–T: total e da alfa (a parte que fica no plasma). */
export const E_FUS_KEV = 17589;
export const E_ALPHA_KEV = 3518;
const KEV_J = 1.602176634e-16;

/**
 * Reatividade ⟨σv⟩ D–T (m³/s) para temperatura iônica kT (keV), pela parametrização de
 * Bosch e Hale (1992), válida de 0,2 a 100 keV.
 */
export function sigmaV(kT: number): number {
  const T = Math.min(Math.max(kT, 0.2), 100);
  const BG = 34.3827;
  const mrc2 = 1124656;
  const C = [1.17302e-9, 1.51361e-2, 7.51886e-2, 4.60643e-3, 1.35e-2, -1.0675e-4, 1.366e-5] as const;
  const th = T / (1 - (T * (C[1] + T * (C[3] + T * C[5]))) / (1 + T * (C[2] + T * (C[4] + T * C[6]))));
  const xi = ((BG * BG) / (4 * th)) ** (1 / 3);
  return C[0] * th * Math.sqrt(xi / (mrc2 * T ** 3)) * Math.exp(-3 * xi) * 1e-6;
}

/**
 * Plasma 50% D, 50% T com densidade iônica n (= densidade eletrônica), energia térmica
 * 3nkT por m³ e tempo de confinamento da energia τ. nτ mínimo para:
 * - ignição (as alfas sozinhas repõem as perdas): nτ = 12kT/(⟨σv⟩E_α);
 * - Q = 1 (potência de fusão igual ao aquecimento externo): nτ = 12kT/(⟨σv⟩(E_fus + E_α)).
 */
export const ntIgnition = (kT: number) => (12 * kT) / (sigmaV(kT) * E_ALPHA_KEV);
export const ntBreakeven = (kT: number) => (12 * kT) / (sigmaV(kT) * (E_FUS_KEV + E_ALPHA_KEV));

export interface PlasmaBalance {
  nTau: number;
  triple: number;
  /** Potências por volume (W/m³). */
  Pfus: number;
  Palpha: number;
  Ploss: number;
  /** Aquecimento externo necessário (0 se ignitado). */
  Pheat: number;
  /** Ganho Q = P_fus/P_aquec (Infinity na ignição). */
  Q: number;
}

export function plasmaBalance(n: number, kT: number, tau: number): PlasmaBalance {
  const sv = sigmaV(kT);
  const rate = (n * n * sv) / 4;
  const Pfus = rate * E_FUS_KEV * KEV_J;
  const Palpha = rate * E_ALPHA_KEV * KEV_J;
  const Ploss = (3 * n * kT * KEV_J) / tau;
  const Pheat = Math.max(0, Ploss - Palpha);
  return { nTau: n * tau, triple: n * kT * tau, Pfus, Palpha, Ploss, Pheat, Q: Pheat > 0 ? Pfus / Pheat : Infinity };
}

/** Referências aproximadas (valores médios de plasma da literatura, ordem de grandeza). */
export const TOKAMAKS: { name: string; kT: number; nTau: number }[] = [
  { name: "JET (1997, D–T)", kT: 28, nTau: 3e19 },
  { name: "ITER (projeto, Q = 10)", kT: 9, nTau: 3e20 },
];
