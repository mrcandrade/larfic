// Resfriamento Doppler, armadilha magneto-óptica e pinça óptica (regime de Rayleigh).

export const HBAR = 1.054571817e-34;
export const KB = 1.380649e-23;
export const MU_B = 9.2740100783e-24;
export const C = 299792458;

/** Rubídio-87, linha D2. */
export const RB = {
  lambda: 780.241e-9,
  k: (2 * Math.PI) / 780.241e-9,
  Gamma: 2 * Math.PI * 6.065e6,
  m: 86.909 * 1.66053906660e-27,
};

/** Temperatura-limite Doppler ħΓ/(2k_B) (K). */
export const dopplerLimit = (Gamma = RB.Gamma) => (HBAR * Gamma) / (2 * KB);
/** Velocidade de recuo ħk/m (m/s). */
export const recoil = () => (HBAR * RB.k) / RB.m;

/** Taxa de espalhamento de um feixe com parâmetro de saturação s e dessintonia efetiva Δ (rad/s). */
export const scatterRate = (s: number, Delta: number, Gamma = RB.Gamma) => ((Gamma / 2) * s) / (1 + s + (4 * Delta * Delta) / (Gamma * Gamma));

/**
 * Força de dois feixes contrapropagantes (N) sobre um átomo com velocidade v e
 * deslocamento Zeeman ζx (rad/s): F = ħk [R(Δ − kv − ζx) − R(Δ + kv + ζx)].
 */
export function force(v: number, s: number, Delta: number, zx = 0): number {
  return HBAR * RB.k * (scatterRate(s, Delta - RB.k * v - zx) - scatterRate(s, Delta + RB.k * v + zx));
}

/** Taxa total de espalhamento (os dois feixes). */
export const totalRate = (v: number, s: number, Delta: number, zx = 0) => scatterRate(s, Delta - RB.k * v - zx) + scatterRate(s, Delta + RB.k * v + zx);

/** Coeficiente de atrito β = −dF/dv em v = 0 (kg/s). */
export function friction(s: number, Delta: number): number {
  const h = 1e-4;
  return -(force(h, s, Delta) - force(-h, s, Delta)) / (2 * h);
}

/**
 * Temperatura de equilíbrio do melaço 1D: k_B T = D/β, com d⟨p²⟩/dt = 2(ħk)²R_tot
 * (recuo na absorção e na emissão ao longo do eixo).
 */
export function equilibriumT(s: number, Delta: number): number {
  const b = friction(s, Delta);
  if (!(b > 0)) return Infinity;
  return ((HBAR * RB.k) ** 2 * totalRate(0, s, Delta)) / (b * KB);
}

/** Fórmula de baixa intensidade: k_B T = ħΓ (1 + (2Δ/Γ)²) / (−8Δ/Γ). */
export const lowSatT = (Delta: number, Gamma = RB.Gamma) => (HBAR * Gamma * (1 + (2 * Delta / Gamma) ** 2)) / (KB * (-8 * Delta) / Gamma);

/** Passo de Langevin (Euler–Maruyama) de um átomo: devolve [x, v]. `zx` = ζ·x. */
export function langevin(x: number, v: number, s: number, Delta: number, zeta: number, h: number, gauss: () => number): [number, number] {
  const zx = zeta * x;
  const F = force(v, s, Delta, zx);
  const R = totalRate(v, s, Delta, zx);
  const dv = (F / RB.m) * h + recoil() * Math.sqrt(2 * R * h) * gauss();
  return [x + v * h, v + dv];
}

/** Gradiente Zeeman em rad/(s·m) para gradiente de campo B' (T/m) e g efetivo 1. */
export const zeemanZeta = (gradT: number) => (MU_B * gradT) / HBAR;

/** Constante de mola da MOT κ = β ζ / k (N/m), no limite de pequenos deslocamentos. */
export const motSpring = (s: number, Delta: number, zeta: number) => (friction(s, Delta) * zeta) / RB.k;

// ---------- Pinça óptica ----------

export interface Tweezer {
  /** Potência (W), cintura w0 (m), comprimento de onda no vácuo (m). */
  P: number;
  w0: number;
  lambda: number;
  /** Raio da esfera (m), índices da esfera e do meio, viscosidade (Pa·s), temperatura (K). */
  a: number;
  np: number;
  nm: number;
  eta: number;
  T: number;
}

export const rayleighRange = (tw: Tweezer) => (Math.PI * tw.w0 * tw.w0 * tw.nm) / tw.lambda;
/** Fator de Clausius–Mossotti K = (m² − 1)/(m² + 2), m = np/nm. */
export const cmFactor = (tw: Tweezer) => {
  const m2 = (tw.np / tw.nm) ** 2;
  return (m2 - 1) / (m2 + 2);
};

/** Intensidade (W/m²) do feixe gaussiano focalizado no ponto (x, z) relativo ao foco. */
export function intensity(tw: Tweezer, x: number, z: number): number {
  const zr = rayleighRange(tw);
  const w2 = tw.w0 * tw.w0 * (1 + (z / zr) ** 2);
  return ((2 * tw.P) / (Math.PI * w2)) * Math.exp((-2 * x * x) / w2);
}

/** Força (N) sobre a esfera no ponto (x, z) relativo ao foco: gradiente + espalhamento (eixo +z). */
export function tweezerForce(tw: Tweezer, x: number, z: number): [number, number] {
  const K = cmFactor(tw);
  const g = (2 * Math.PI * tw.nm * tw.a ** 3 * K) / C;
  const h = tw.w0 * 1e-4;
  const dIx = (intensity(tw, x + h, z) - intensity(tw, x - h, z)) / (2 * h);
  const dIz = (intensity(tw, x, z + h) - intensity(tw, x, z - h)) / (2 * h);
  const lm = tw.lambda / tw.nm;
  const sigma = ((128 * Math.PI ** 5 * tw.a ** 6) / (3 * lm ** 4)) * K * K;
  const scat = (tw.nm / C) * sigma * intensity(tw, x, z);
  return [g * dIx, g * dIz + scat];
}

/** Rigidez lateral teórica no foco: κx = (2π nm a³ K / c)(4 I0 / w0²) (N/m). */
export function stiffnessX(tw: Tweezer): number {
  const K = cmFactor(tw);
  const I0 = (2 * tw.P) / (Math.PI * tw.w0 * tw.w0);
  return ((2 * Math.PI * tw.nm * tw.a ** 3 * K) / C) * ((4 * I0) / (tw.w0 * tw.w0));
}

/** Força lateral máxima no plano focal (em x = w0/2): κx (w0/2) e^{−1/2}. */
export const maxLateralForce = (tw: Tweezer) => stiffnessX(tw) * (tw.w0 / 2) * Math.exp(-0.5);

/** Coeficiente de arrasto de Stokes γ = 6πηa (kg/s). */
export const dragCoef = (tw: Tweezer) => 6 * Math.PI * tw.eta * tw.a;

/** Posição axial de equilíbrio (m) sobre o eixo, por bissecção de F_z(z) = 0 entre o foco e +zR. */
export function axialEquilibrium(tw: Tweezer): number {
  const f = (z: number) => tweezerForce(tw, 0, z)[1];
  let lo = -0.2 * rayleighRange(tw);
  let hi = 0.577 * rayleighRange(tw);
  if (f(lo) * f(hi) > 0) return NaN;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (f(lo) * f(mid) <= 0) hi = mid;
    else lo = mid;
  }
  return (lo + hi) / 2;
}

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
