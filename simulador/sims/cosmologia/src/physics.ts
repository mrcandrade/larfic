/**
 * Física da sim de cosmologia: lei de Hubble, radiação cósmica de fundo (Planck + Saha),
 * curvas de rotação de galáxias e equações de Friedmann.
 */

// ------------------------------------------------------------------ constantes (SI e astronômicas)
export const C = 2.99792458e8;
export const H_PLANCK = 6.62607015e-34;
export const HBAR = 1.054571817e-34;
export const KB = 1.380649e-23;
export const ME_KG = 9.1093837015e-31;
export const EV = 1.602176634e-19;
export const ZETA3 = 1.2020569031595942;
/** Constante de radiação a = π²k⁴/(15ħ³c³) (J m⁻³ K⁻⁴). */
export const A_RAD = (Math.PI ** 2 * KB ** 4) / (15 * HBAR ** 3 * C ** 3);
/** Temperatura atual da radiação cósmica de fundo (K), COBE/FIRAS. */
export const T0 = 2.7255;
/** 1/(1 km/s/Mpc) em Gyr: idade de Hubble t_H = 977,8/H₀ Gyr. */
export const HUBBLE_GYR = 977.792;
/** G em kpc (km/s)² / M☉. */
export const G_KPC = 4.30091e-6;
/** Densidade de radiação de hoje (fótons + 3 neutrinos sem massa), para h = 0,674. */
export const OMEGA_R = 9.15e-5;
/** Razão bárions/fótons (Planck 2018). */
export const ETA_B = 6.1e-10;
/** Desacoplamento observado (Planck 2018): z* ≈ 1090. */
export const Z_DEC = 1090;

/** H₀ em 1/Gyr. */
export const hInvGyr = (H0: number) => H0 / HUBBLE_GYR;

// ------------------------------------------------------------------ PRNG determinístico
export function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function gauss(r: () => number) {
  const u = Math.max(r(), 1e-12);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r());
}

// ------------------------------------------------------------------ lei de Hubble
export interface Galaxy {
  /** Posição comóvel (Mpc) no instante inicial. */
  x: number;
  y: number;
  /** Velocidade peculiar (km/s), em unidades de σ. */
  ux: number;
  uy: number;
  /** Erro relativo da distância, em unidades do erro escolhido. */
  ed: number;
  size: number;
}

/** Galáxias espalhadas uniformemente num disco de raio R (Mpc). */
export function makeGalaxies(n: number, R: number, seed = 7): Galaxy[] {
  const r = mulberry(seed);
  const out: Galaxy[] = [{ x: 0, y: 0, ux: 0, uy: 0, ed: 0, size: 1 }];
  while (out.length < n) {
    const x = (2 * r() - 1) * R;
    const y = (2 * r() - 1) * R;
    if (x * x + y * y > R * R) continue;
    if (out.some((g) => Math.hypot(g.x - x, g.y - y) < R * 0.07)) continue;
    out.push({ x, y, ux: gauss(r), uy: gauss(r), ed: gauss(r), size: 0.6 + 0.8 * r() });
  }
  return out;
}

export interface HubbleMeasurement {
  d: number;
  v: number;
  idx: number;
}

/**
 * Medidas feitas da galáxia `obs`: distância (com erro relativo σ_d) e velocidade radial
 * (fluxo de Hubble + velocidade peculiar de σ_v). Com H constante, r(t) = a(t) r₀ e v = H r.
 */
export function measure(gs: Galaxy[], obs: number, a: number, H0: number, sigmaV: number, sigmaD: number): HubbleMeasurement[] {
  const o = gs[obs]!;
  const out: HubbleMeasurement[] = [];
  gs.forEach((g, i) => {
    if (i === obs) return;
    const dx = (g.x - o.x) * a;
    const dy = (g.y - o.y) * a;
    const d = Math.hypot(dx, dy);
    if (d < 1e-9) return;
    const vr = H0 * d + sigmaV * ((g.ux - o.ux) * dx + (g.uy - o.uy) * dy) / d;
    out.push({ d: d * (1 + sigmaD * g.ed), v: vr, idx: i });
  });
  return out;
}

/** Ajuste por mínimos quadrados de v = H d (reta pela origem): H = Σvd/Σd², com incerteza. */
export function fitHubble(ms: { d: number; v: number }[]): { H: number; sigma: number } {
  let sdd = 0;
  let svd = 0;
  for (const m of ms) {
    sdd += m.d * m.d;
    svd += m.v * m.d;
  }
  const H = sdd > 0 ? svd / sdd : 0;
  let r2 = 0;
  for (const m of ms) r2 += (m.v - H * m.d) ** 2;
  const sigma = ms.length > 1 && sdd > 0 ? Math.sqrt(r2 / (ms.length - 1) / sdd) : 0;
  return { H, sigma };
}

// ------------------------------------------------------------------ radiação de fundo
/** Radiância espectral de Planck B_ν (W m⁻² Hz⁻¹ sr⁻¹). */
export function planckNu(nu: number, T: number): number {
  const x = (H_PLANCK * nu) / (KB * T);
  if (x > 700) return 0;
  return (2 * H_PLANCK * nu ** 3) / (C * C) / Math.expm1(x);
}
/** Frequência do pico de B_ν: hν = 2,8214 kT. */
export const nuPeak = (T: number) => (2.821439372 * KB * T) / H_PLANCK;
/** Comprimento de onda do pico de B_λ (lei de Wien), em m. */
export const lambdaMax = (T: number) => 2.897771955e-3 / T;
/** Densidade de fótons n = (2ζ(3)/π²)(kT/ħc)³ (m⁻³). */
export const photonDensity = (T: number) => ((2 * ZETA3) / Math.PI ** 2) * ((KB * T) / (HBAR * C)) ** 3;
/** Densidade de energia u = aT⁴ (J/m³). */
export const energyDensity = (T: number) => A_RAD * T ** 4;
/** Temperatura no redshift z: T = T₀(1 + z). */
export const tempAt = (z: number, Tnow = T0) => Tnow * (1 + z);

/**
 * Fração de ionização do hidrogênio pela equação de Saha (só H, equilíbrio):
 * X²/(1 − X) = (1/n_b)(m_e kT/2πħ²)^{3/2} e^{−13,6 eV/kT}, com n_b = η n_γ.
 */
export function sahaX(T: number, eta = ETA_B): number {
  const nb = eta * photonDensity(T);
  const kT = KB * T;
  const expo = -13.598 * EV / kT;
  if (expo < -700) return 0;
  const S = ((ME_KG * kT) / (2 * Math.PI * HBAR * HBAR)) ** 1.5 * Math.exp(expo) / nb;
  if (!Number.isFinite(S)) return 1;
  // forma estável de X = (−S + √(S² + 4S))/2
  return (2 * S) / (S + Math.sqrt(S * S + 4 * S));
}

/** Temperatura em que X = 1/2 (bissecção). */
export function recombinationT(eta = ETA_B): number {
  let lo = 1000;
  let hi = 10000;
  for (let i = 0; i < 80; i++) {
    const m = (lo + hi) / 2;
    if (sahaX(m, eta) > 0.5) hi = m;
    else lo = m;
  }
  return (lo + hi) / 2;
}

// ------------------------------------------------------------------ curvas de rotação
function besselI0(x: number) {
  const t = x / 3.75;
  if (x <= 3.75) {
    const t2 = t * t;
    return 1 + t2 * (3.5156229 + t2 * (3.0899424 + t2 * (1.2067492 + t2 * (0.2659732 + t2 * (0.0360768 + t2 * 0.0045813)))));
  }
  const u = 1 / t;
  return (Math.exp(x) / Math.sqrt(x)) * (0.39894228 + u * (0.01328592 + u * (0.00225319 + u * (-0.00157565 + u * (0.00916281 + u * (-0.02057706 + u * (0.02635537 + u * (-0.01647633 + u * 0.00392377))))))));
}
function besselI1(x: number) {
  const t = x / 3.75;
  if (x <= 3.75) {
    const t2 = t * t;
    return x * (0.5 + t2 * (0.87890594 + t2 * (0.51498869 + t2 * (0.15084934 + t2 * (0.02658733 + t2 * (0.00301532 + t2 * 0.00032411))))));
  }
  const u = 1 / t;
  return (Math.exp(x) / Math.sqrt(x)) * (0.39894228 + u * (-0.03988024 + u * (-0.00362018 + u * (0.00163801 + u * (-0.01031555 + u * (0.02282967 + u * (-0.02895312 + u * (0.01787654 - u * 0.00420059))))))));
}
function besselK0(x: number) {
  if (x <= 2) {
    const y = (x * x) / 4;
    return -Math.log(x / 2) * besselI0(x) + (-0.57721566 + y * (0.4227842 + y * (0.23069756 + y * (0.0348859 + y * (0.00262698 + y * (0.0001075 + y * 0.0000074))))));
  }
  const y = 2 / x;
  return (Math.exp(-x) / Math.sqrt(x)) * (1.25331414 + y * (-0.07832358 + y * (0.02189568 + y * (-0.01062446 + y * (0.00587872 + y * (-0.0025154 + y * 0.00053208))))));
}
function besselK1(x: number) {
  if (x <= 2) {
    const y = (x * x) / 4;
    return Math.log(x / 2) * besselI1(x) + (1 / x) * (1 + y * (0.15443144 + y * (-0.67278579 + y * (-0.18156897 + y * (-0.01919402 + y * (-0.00110404 + y * -0.00004686))))));
  }
  const y = 2 / x;
  return (Math.exp(-x) / Math.sqrt(x)) * (1.25331414 + y * (0.23498619 + y * (-0.0365562 + y * (0.01504268 + y * (-0.00780353 + y * (0.00325614 + y * -0.00068245))))));
}
export const bessel = { I0: besselI0, I1: besselI1, K0: besselK0, K1: besselK1 };

/** v² de um disco exponencial fino de massa M e escala Rd (Freeman 1970), em (km/s)². */
export function vDisk2(r: number, M: number, Rd: number): number {
  if (M <= 0 || r <= 0) return 0;
  const y = r / (2 * Rd);
  if (y > 40) return (G_KPC * M) / r;
  return ((2 * G_KPC * M) / Rd) * y * y * (besselI0(y) * besselK0(y) - besselI1(y) * besselK1(y));
}
/** v² de um bojo de Hernquist (massa M, escala a). */
export const vBulge2 = (r: number, M: number, a: number) => (M > 0 && r > 0 ? (G_KPC * M * r) / (r + a) ** 2 : 0);
/** Massa de um halo isotérmico com núcleo (ρ = ρ₀/(1 + r²/rc²)) dentro de r, por unidade de ρ₀. */
const isoShape = (r: number, rc: number) => 4 * Math.PI * rc * rc * (r - rc * Math.atan(r / rc));
/** v² do halo normalizado pela massa Mh contida em Rn. */
export const vHalo2 = (r: number, Mh: number, rc: number, Rn: number) => (Mh > 0 && r > 0 ? (G_KPC * Mh * isoShape(r, rc)) / isoShape(Rn, rc) / r : 0);
export const haloMassIn = (r: number, Mh: number, rc: number, Rn: number) => (Mh * isoShape(r, rc)) / isoShape(Rn, rc);

export interface GalaxyModel {
  name: string;
  Md: number;
  Rd: number;
  Mg: number;
  Rg: number;
  Mb: number;
  ab: number;
  /** Raio do último ponto medido (kpc) e passo dos pontos. */
  Rmax: number;
  dr: number;
  /** Halo "verdadeiro" usado para gerar os dados sintéticos. */
  MhTrue: number;
  rcTrue: number;
  noise: number;
  vScale: number;
}

export const GALAXIES: GalaxyModel[] = [
  { name: "espiral grande (tipo Via Láctea)", Md: 5e10, Rd: 3, Mg: 1e10, Rg: 7, Mb: 1e10, ab: 0.6, Rmax: 30, dr: 1.5, MhTrue: 2.4e11, rcTrue: 6, noise: 0.03, vScale: 300 },
  { name: "galáxia anã rica em matéria escura", Md: 3e8, Rd: 1, Mg: 1e9, Rg: 2.5, Mb: 0, ab: 0.3, Rmax: 8, dr: 0.5, MhTrue: 5.5e9, rcTrue: 2, noise: 0.05, vScale: 90 },
];

export interface Components {
  disk: number;
  gas: number;
  bulge: number;
  halo: number;
  total: number;
}

/** Velocidades circulares (km/s) de cada componente; o disco estelar é multiplicado por `ups` (razão massa/luz relativa). */
export function rotation(r: number, g: GalaxyModel, Mh: number, rc: number, ups = 1): Components {
  const d2 = vDisk2(r, ups * g.Md, g.Rd);
  const g2 = vDisk2(r, g.Mg, g.Rg);
  const b2 = vBulge2(r, g.Mb, g.ab);
  const h2 = vHalo2(r, Mh, rc, g.Rmax);
  return { disk: Math.sqrt(d2), gas: Math.sqrt(g2), bulge: Math.sqrt(b2), halo: Math.sqrt(h2), total: Math.sqrt(d2 + g2 + b2 + h2) };
}

export interface RotPoint {
  r: number;
  v: number;
  err: number;
}

/** Dados sintéticos: o modelo verdadeiro mais ruído gaussiano (semente fixa). */
export function rotationData(g: GalaxyModel, seed = 3): RotPoint[] {
  const rnd = mulberry(seed);
  const out: RotPoint[] = [];
  for (let r = g.dr; r <= g.Rmax + 1e-9; r += g.dr) {
    const v = rotation(r, g, g.MhTrue, g.rcTrue).total;
    const err = g.noise * v + 2;
    out.push({ r, v: v + err * gauss(rnd), err });
  }
  return out;
}

export function chi2(data: RotPoint[], g: GalaxyModel, Mh: number, rc: number, ups = 1): number {
  let s = 0;
  for (const p of data) s += ((p.v - rotation(p.r, g, Mh, rc, ups).total) / p.err) ** 2;
  return s / Math.max(1, data.length - 1);
}

/** Melhor massa de halo (busca em log Mh) para os dados, com rc e ups dados. */
export function bestHalo(data: RotPoint[], g: GalaxyModel, rc: number, ups = 1): number {
  let lo = Math.log10(g.MhTrue) - 3;
  let hi = Math.log10(g.MhTrue) + 2;
  const f = (x: number) => chi2(data, g, 10 ** x, rc, ups);
  for (let i = 0; i < 100; i++) {
    const m1 = lo + (hi - lo) / 3;
    const m2 = hi - (hi - lo) / 3;
    if (f(m1) < f(m2)) hi = m2;
    else lo = m1;
  }
  return 10 ** ((lo + hi) / 2);
}

/** Massa (M☉) contida em r a partir da velocidade circular: M = v² r / G. */
export const massFromV = (v: number, r: number) => (v * v * r) / G_KPC;

// ------------------------------------------------------------------ Friedmann
export interface Cosmo {
  H0: number;
  Om: number;
  Or: number;
  OL: number;
}
export const omegaK = (c: Cosmo) => 1 - c.Om - c.Or - c.OL;
/** E²(a) = H²/H₀². */
export const E2 = (a: number, c: Cosmo) => c.Or / a ** 4 + c.Om / a ** 3 + omegaK(c) / (a * a) + c.OL;
/** H(a) em km/s/Mpc. */
export const hubbleAt = (a: number, c: Cosmo) => c.H0 * Math.sqrt(Math.max(E2(a, c), 0));
/** Aceleração ä/a = −(H₀²/2)(2Ω_r a⁻⁴ + Ω_m a⁻³ − 2Ω_Λ), em 1/Gyr². */
export const accel = (a: number, c: Cosmo) => -0.5 * hInvGyr(c.H0) ** 2 * (2 * c.Or / a ** 4 + c.Om / a ** 3 - 2 * c.OL) * a;
/** Parâmetro de desaceleração q = −ä a/ȧ². */
export const decel = (a: number, c: Cosmo) => (0.5 * (2 * c.Or / a ** 4 + c.Om / a ** 3 - 2 * c.OL)) / E2(a, c);

/** O universo começou num big bang (E² > 0 para todo 0 < a ≤ 1)? */
export function hasBigBang(c: Cosmo): boolean {
  if (c.Om <= 0 && c.Or <= 0) return false;
  for (let i = 1; i <= 400; i++) if (E2(i / 400, c) <= 0) return false;
  return true;
}

/**
 * Idade t(a) = ∫₀^a da′/(a′H(a′)) em Gyr. Substituição a = u² remove a singularidade
 * na origem; regra de Simpson com n intervalos.
 */
export function ageAt(a: number, c: Cosmo, n = 2000): number {
  if (!hasBigBang(c)) return Number.NaN;
  const H = hInvGyr(c.H0);
  const U = Math.sqrt(a);
  const f = (u: number) => {
    if (u <= 0) return 0;
    const e = E2(u * u, c);
    return e > 0 ? 2 / (u * Math.sqrt(e)) / H : Number.NaN;
  };
  const h = U / n;
  let s = f(0) + f(U);
  for (let i = 1; i < n; i++) s += (i % 2 ? 4 : 2) * f(i * h);
  return (s * h) / 3;
}

/** a em que o universo atinge a idade t (Gyr), por bissecção (só na fase de expansão). */
export function aAtAge(t: number, c: Cosmo): number {
  let lo = 1e-12;
  let hi = 1;
  while (ageAt(hi, c, 400) < t && hi < 1e4) hi *= 2;
  for (let i = 0; i < 60; i++) {
    const m = Math.sqrt(lo * hi);
    if (ageAt(m, c, 400) < t) lo = m;
    else hi = m;
  }
  return Math.sqrt(lo * hi);
}

/** Um passo RK4 de [a, ȧ] (ȧ em 1/Gyr) por h Gyr. */
export function stepScale(a: number, ad: number, h: number, c: Cosmo): [number, number] {
  const f = (x: number, v: number): [number, number] => [v, accel(x, c)];
  const k1 = f(a, ad);
  const k2 = f(a + (h / 2) * k1[0], ad + (h / 2) * k1[1]);
  const k3 = f(a + (h / 2) * k2[0], ad + (h / 2) * k2[1]);
  const k4 = f(a + h * k3[0], ad + h * k3[1]);
  return [a + (h / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]), ad + (h / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1])];
}
