// Física do tubo de raios X, da difração de Bragg, da lei de Moseley e da atenuação.

/** hc em keV·pm: λ(pm) = HC / E(keV). */
export const HC = 1239.84;
/** Constante de Planck (J·s), carga elementar (C) e velocidade da luz (m/s). */
export const H = 6.62607015e-34;
export const QE = 1.602176634e-19;
export const C = 299792458;
/** Constante de Rydberg × c (Hz). */
export const RC = 3.2898419603e15;

export const lambdaOf = (EkeV: number) => HC / EkeV;
export const energyOf = (lambdaPm: number) => HC / lambdaPm;
/** Limite de Duane–Hunt (pm) para a tensão V (kV). */
export const lambdaMin = (VkV: number) => HC / VkV;

export interface Line {
  name: string;
  E: number;
  /** Energia de corte (borda de absorção) da camada que precisa ser ionizada (keV). */
  edge: number;
  /** Intensidade relativa à Kα (ou à Lα, para linhas L). */
  rel: number;
}

export interface Anode {
  name: string;
  Z: number;
  lines: Line[];
}

export const ANODES: Anode[] = [
  {
    name: "Cobre (Cu)",
    Z: 29,
    lines: [
      { name: "Kα", E: 8.048, edge: 8.979, rel: 1 },
      { name: "Kβ", E: 8.905, edge: 8.979, rel: 0.18 },
    ],
  },
  {
    name: "Molibdênio (Mo)",
    Z: 42,
    lines: [
      { name: "Kα", E: 17.479, edge: 20.0, rel: 1 },
      { name: "Kβ", E: 19.608, edge: 20.0, rel: 0.21 },
    ],
  },
  {
    name: "Tungstênio (W)",
    Z: 74,
    lines: [
      { name: "Kα", E: 59.318, edge: 69.525, rel: 1 },
      { name: "Kβ", E: 67.244, edge: 69.525, rel: 0.23 },
      { name: "Lα", E: 8.398, edge: 10.207, rel: 0.5 },
      { name: "Lβ", E: 9.672, edge: 10.207, rel: 0.3 },
    ],
  },
];

export const anodeOf = (k: number) => ANODES[Math.max(0, Math.min(ANODES.length - 1, Math.round(k)))]!;

/**
 * Espectro contínuo de Kramers, intensidade por unidade de comprimento de onda
 * (u. arb., i em mA, λ em pm): I(λ) = i Z (λ − λmin) / (λmin λ³) × 10⁶.
 */
export function continuum(lambda: number, VkV: number, imA: number, Z: number): number {
  const l0 = lambdaMin(VkV);
  if (lambda <= l0) return 0;
  return (1e6 * imA * Z * (lambda - l0)) / (l0 * lambda ** 3);
}

/** Integral do contínuo em λ: i Z / (2 λmin²) × 10⁶ ∝ i Z V² (lei de Kramers). */
export const continuumTotal = (VkV: number, imA: number, Z: number) => (1e6 * imA * Z) / (2 * lambdaMin(VkV) ** 2);

/** Intensidade integrada (energia) de uma linha característica; zero abaixo da borda. */
export function lineArea(line: Line, VkV: number, imA: number, Z: number): number {
  const U = VkV / line.edge;
  if (U <= 1) return 0;
  return line.rel * continuumTotal(line.edge, imA, Z) * (U - 1) ** 1.63;
}

/** Espectro completo I(λ), com as linhas como gaussianas de largura σ (pm). */
export function spectrum(lambda: number, VkV: number, imA: number, anode: Anode, sigma = 0.6): number {
  let I = continuum(lambda, VkV, imA, anode.Z);
  for (const L of anode.lines) {
    const A = lineArea(L, VkV, imA, anode.Z);
    if (A <= 0) continue;
    const dl = lambda - lambdaOf(L.E);
    I += (A / (Math.sqrt(2 * Math.PI) * sigma)) * Math.exp((-dl * dl) / (2 * sigma * sigma));
  }
  return I;
}

/** Eficiência de produção de raios X (fração da potência elétrica): η ≈ 1,1 × 10⁻⁹ Z V (V em volts). */
export const efficiency = (VkV: number, Z: number) => 1.1e-9 * Z * VkV * 1000;

// ---------- Atenuação ----------

export interface Material {
  name: string;
  /** Densidade (g/cm³). */
  rho: number;
  /** Tabela [E (keV), μ/ρ (cm²/g)] em ordem crescente (bordas repetem E). */
  table: [number, number][];
}

export const WATER: Material = {
  name: "tecido mole (água)",
  rho: 1.0,
  table: [[5, 41.9], [6, 24.05], [8, 10.37], [10, 5.329], [15, 1.673], [20, 0.8096], [30, 0.3756], [40, 0.2683], [50, 0.2269], [60, 0.2059], [80, 0.1837], [100, 0.1707], [150, 0.1505]],
};
export const BONE: Material = {
  name: "osso cortical",
  rho: 1.92,
  table: [[5, 207], [6, 125], [8, 54], [10, 28.51], [15, 9.032], [20, 4.001], [30, 1.331], [40, 0.6655], [50, 0.4242], [60, 0.3148], [80, 0.2229], [100, 0.1855], [150, 0.148]],
};
export const ALUMINUM: Material = {
  name: "alumínio",
  rho: 2.699,
  table: [[5, 193.4], [6, 115.3], [8, 50.33], [10, 26.23], [15, 7.955], [20, 3.441], [30, 1.128], [40, 0.5685], [50, 0.3681], [60, 0.2778], [80, 0.2018], [100, 0.1704], [150, 0.1378]],
};
export const LEAD: Material = {
  name: "chumbo",
  rho: 11.35,
  table: [[5, 730], [8, 229], [10, 130.6], [13.035, 66.5], [13.035, 162], [15, 111.6], [20, 86.36], [30, 30.32], [40, 14.36], [50, 8.041], [60, 5.021], [80, 2.419], [88.0, 1.91], [88.0, 7.683], [100, 5.549], [150, 2.014]],
};
export const MATERIALS = [WATER, BONE, ALUMINUM, LEAD];

/** μ/ρ (cm²/g) por interpolação log–log na tabela (respeita as bordas de absorção). */
export function muRho(m: Material, E: number): number {
  const t = m.table;
  if (E <= t[0]![0]) return t[0]![1] * (t[0]![0] / E) ** 2.9;
  for (let i = 1; i < t.length; i++) {
    const [e1, m1] = t[i]!;
    const [e0, m0] = t[i - 1]!;
    if (E <= e1 && e1 > e0) {
      const f = Math.log(E / e0) / Math.log(e1 / e0);
      return Math.exp(Math.log(m0) + f * Math.log(m1 / m0));
    }
  }
  const [e0, m0] = t[t.length - 2]!;
  const [e1, m1] = t[t.length - 1]!;
  return m1 * (E / e1) ** (Math.log(m1 / m0) / Math.log(e1 / e0));
}

/** Coeficiente linear μ (1/cm). */
export const mu = (m: Material, E: number) => muRho(m, E) * m.rho;

/** Filtros de linha Kβ: lei ~E^−2,8 com salto na borda K. */
export interface Filter {
  name: string;
  rho: number;
  /** μ/ρ em E0 (abaixo da borda), borda K (keV), razão de salto, espessura (μm). */
  E0: number;
  mu0: number;
  edge: number;
  jump: number;
  thick: number;
}
export const FILTERS: (Filter | null)[] = [
  null,
  { name: "níquel 20 μm", rho: 8.9, E0: 8.048, mu0: 49.3, edge: 8.333, jump: 7.4, thick: 20 },
  { name: "zircônio 60 μm", rho: 6.51, E0: 17.479, mu0: 16, edge: 17.998, jump: 8.45, thick: 60 },
];
export function filterTransmission(f: Filter | null, E: number): number {
  if (!f) return 1;
  const m = f.mu0 * (f.E0 / E) ** 2.8 * (E >= f.edge ? f.jump : 1);
  return Math.exp(-m * f.rho * f.thick * 1e-4);
}

// ---------- Espectro em energia (radiografia) ----------

/** Grade de energias (keV) com passo de 1 keV, de 5 keV até V. */
export interface EnergySpectrum {
  E: number[];
  /** Fótons por bin (u. arb.). */
  N: number[];
}

/**
 * Número de fótons por keV: Kramers N(E) ∝ i Z (E0 − E)/E, mais as linhas K e L
 * (como fótons no bin da linha), filtrado por `alMm` de alumínio.
 */
export function energySpectrum(VkV: number, imA: number, anode: Anode, alMm: number): EnergySpectrum {
  const E: number[] = [];
  const N: number[] = [];
  for (let e = 5.5; e < VkV; e += 1) {
    E.push(e);
    N.push((imA * anode.Z * (VkV - e)) / e);
  }
  // Área das linhas convertida para fótons, na mesma normalização do contínuo de Kramers.
  const contE = (imA * anode.Z * VkV * VkV) / 2; // ∫ i Z (E0 − E) dE
  const contL = continuumTotal(VkV, imA, anode.Z);
  for (const L of anode.lines) {
    const A = lineArea(L, VkV, imA, anode.Z);
    const k = Math.floor(L.E - 5);
    if (A > 0 && k >= 0 && k < E.length) N[k]! += ((A / contL) * contE) / L.E;
  }
  for (let k = 0; k < E.length; k++) N[k]! *= Math.exp(-mu(ALUMINUM, E[k]!) * alMm / 10);
  return { E, N };
}

/** Transmissão de um espectro por camadas [material, espessura em cm]; devolve a fração de energia. */
export function transmitted(sp: EnergySpectrum, layers: [Material, number][]): number {
  let num = 0;
  let den = 0;
  for (let k = 0; k < sp.E.length; k++) {
    const e = sp.E[k]!;
    let a = 0;
    for (const [m, x] of layers) if (x > 0) a += mu(m, e) * x;
    num += sp.N[k]! * e * Math.exp(-a);
    den += sp.N[k]! * e;
  }
  return den > 0 ? num / den : 0;
}

/** Energia média do espectro (keV), ponderada pelo número de fótons. */
export function meanEnergy(sp: EnergySpectrum): number {
  let a = 0;
  let b = 0;
  sp.E.forEach((e, k) => {
    a += sp.N[k]! * e;
    b += sp.N[k]!;
  });
  return b > 0 ? a / b : 0;
}

/** Camada semirredutora (cm) do material para o espectro, por bissecção. */
export function hvl(sp: EnergySpectrum, m: Material): number {
  let lo = 0;
  let hi = 1;
  while (transmitted(sp, [[m, hi]]) > 0.5 && hi < 1e3) hi *= 2;
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    if (transmitted(sp, [[m, mid]]) > 0.5) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

// ---------- Bragg ----------

export const CRYSTALS = [
  { name: "NaCl (200)", d: 282.0 },
  { name: "LiF (200)", d: 201.4 },
];
/** Refletividade relativa das ordens n = 1, 2, 3. */
export const ORDER_REFL = [1, 0.25, 0.08];

/**
 * Taxa de contagem (1/s) do detector no ângulo θ (graus), com abertura angular
 * σθ (graus): soma das ordens n de λₙ = 2d sen θ / n. O contínuo entra em fótons
 * por pm e as linhas como áreas, ambos vistos através da janela gaussiana em λ.
 */
export function braggRate(thetaDeg: number, VkV: number, imA: number, anode: Anode, d: number, sigmaDeg: number, filter: Filter | null = null): number {
  const th = (thetaDeg * Math.PI) / 180;
  const sth = (sigmaDeg * Math.PI) / 180;
  let R = 0;
  for (let n = 1; n <= 3; n++) {
    const ln = (2 * d * Math.sin(th)) / n;
    const sl = Math.max(1e-6, (2 * d * Math.cos(th) * sth) / n);
    const toPhot = (lam: number) => lam / HC; // energia → número de fótons
    let r = continuum(ln, VkV, imA, anode.Z) * toPhot(ln) * Math.sqrt(2 * Math.PI) * sl * filterTransmission(filter, energyOf(ln));
    for (const L of anode.lines) {
      const A = lineArea(L, VkV, imA, anode.Z);
      if (A <= 0) continue;
      const lL = lambdaOf(L.E);
      r += A * toPhot(lL) * Math.exp(-((ln - lL) ** 2) / (2 * sl * sl)) * filterTransmission(filter, L.E);
    }
    R += ORDER_REFL[n - 1]! * r;
  }
  return 40 * R;
}

/** Ângulo de Bragg (graus) para λ (pm), ordem n; NaN se não houver reflexão. */
export function braggAngle(lambda: number, d: number, n = 1): number {
  const s = (n * lambda) / (2 * d);
  return s <= 1 ? (Math.asin(s) * 180) / Math.PI : NaN;
}

// ---------- Moseley ----------

/** Energias Kα₁ medidas (keV), por número atômico. */
export const KALPHA: Record<number, [string, number]> = {
  20: ["Ca", 3.692], 22: ["Ti", 4.511], 23: ["V", 4.952], 24: ["Cr", 5.415], 25: ["Mn", 5.899], 26: ["Fe", 6.404], 27: ["Co", 6.930],
  28: ["Ni", 7.478], 29: ["Cu", 8.048], 30: ["Zn", 8.639], 31: ["Ga", 9.252], 32: ["Ge", 9.886], 33: ["As", 10.544], 34: ["Se", 11.222],
  35: ["Br", 11.924], 37: ["Rb", 13.395], 38: ["Sr", 14.165], 39: ["Y", 14.958], 40: ["Zr", 15.775], 41: ["Nb", 16.615], 42: ["Mo", 17.479],
  43: ["Tc", 18.367], 44: ["Ru", 19.279], 45: ["Rh", 20.216], 46: ["Pd", 21.177], 47: ["Ag", 22.163], 48: ["Cd", 23.174], 49: ["In", 24.21],
  50: ["Sn", 25.271], 51: ["Sb", 26.359], 52: ["Te", 27.472], 53: ["I", 28.612], 55: ["Cs", 30.973], 56: ["Ba", 32.194], 57: ["La", 33.442],
  58: ["Ce", 34.72], 59: ["Pr", 36.026], 60: ["Nd", 37.361], 61: ["Pm", 38.725], 62: ["Sm", 40.118], 64: ["Gd", 42.996], 66: ["Dy", 45.998],
  68: ["Er", 49.128], 70: ["Yb", 52.389], 72: ["Hf", 55.79], 73: ["Ta", 57.532], 74: ["W", 59.318], 75: ["Re", 61.14], 76: ["Os", 62.999],
  77: ["Ir", 64.896], 78: ["Pt", 66.832], 79: ["Au", 68.804], 82: ["Pb", 74.969],
};
/** Elementos ainda desconhecidos quando Moseley publicou (1913–1914). */
export const GAPS_1914 = [43, 61, 72, 75];

/** Previsão de Bohr–Moseley para a Kα: E = (3/4) R∞hc (Z − 1)² (keV). */
export const moseleyE = (Z: number) => 0.75 * 13.6057e-3 * (Z - 1) ** 2;
/** Frequência (Hz) de um fóton de energia E (keV). */
export const freqOf = (EkeV: number) => (EkeV * 1000 * QE) / H;
/** √f (em 10⁸ Hz^½). */
export const sqrtF = (EkeV: number) => Math.sqrt(freqOf(EkeV)) / 1e8;

/** Ajuste linear por mínimos quadrados y = a + b x. */
export function linfit(xs: number[], ys: number[]): { a: number; b: number } {
  const n = xs.length;
  const mx = xs.reduce((s, v) => s + v, 0) / n;
  const my = ys.reduce((s, v) => s + v, 0) / n;
  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i]! - mx) * (ys[i]! - my);
    sxx += (xs[i]! - mx) ** 2;
  }
  const b = sxy / sxx;
  return { a: my - b * mx, b };
}

/** Ajuste de Moseley aos dados: √f = k (Z − σ). Devolve k (10⁸ Hz^½) e a blindagem σ. */
export function moseleyFit(): { k: number; sigma: number } {
  const Zs = Object.keys(KALPHA).map(Number).filter((z) => z <= 50);
  const { a, b } = linfit(Zs, Zs.map((z) => sqrtF(KALPHA[z]![1])));
  return { k: b, sigma: -a / b };
}

/** Número atômico pela lei de Moseley a partir da energia Kα medida (keV). */
export const zFromKalpha = (EkeV: number) => 1 + Math.sqrt(EkeV / (0.75 * 13.6057e-3));

/** Gerador mulberry32 com o estado guardado num número. */
export function nextRandom(st: { seed: number }): number {
  st.seed = (st.seed + 0x6d2b79f5) >>> 0;
  let t = st.seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export function gaussianFrom(st: { seed: number }): number {
  let u = 0;
  while (u === 0) u = nextRandom(st);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * nextRandom(st));
}
