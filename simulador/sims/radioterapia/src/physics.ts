// Curvas de dose em profundidade na água (fótons, elétrons, prótons) e planejamento 2D.

// ---------- Fótons ----------

export interface PhotonBeam {
  name: string;
  /** Profundidade do máximo (cm), PDD a 10 cm (%), dose relativa na superfície. */
  dmax: number;
  pdd10: number;
  surf: number;
}
export const PHOTONS: PhotonBeam[] = [
  { name: "⁶⁰Co (1,25 MeV)", dmax: 0.5, pdd10: 58.4, surf: 0.3 },
  { name: "6 MV", dmax: 1.5, pdd10: 67.0, surf: 0.15 },
  { name: "10 MV", dmax: 2.4, pdd10: 73.0, surf: 0.12 },
  { name: "18 MV", dmax: 3.3, pdd10: 79.0, surf: 0.1 },
];
export const SSD = 100;

/** Dose sem normalizar: (1 − (1 − s₀)e^{−βd}) e^{−μd} ((SSD + dmax)/(SSD + d))². */
function photonRaw(d: number, mu: number, beta: number, surf: number, dmax: number): number {
  return (1 - (1 - surf) * Math.exp(-beta * d)) * Math.exp(-mu * d) * ((SSD + dmax) / (SSD + d)) ** 2;
}

function argmax(f: (d: number) => number, a: number, b: number): number {
  let lo = a;
  let hi = b;
  for (let i = 0; i < 100; i++) {
    const m1 = lo + (hi - lo) / 3;
    const m2 = hi - (hi - lo) / 3;
    if (f(m1) < f(m2)) lo = m1;
    else hi = m2;
  }
  return (lo + hi) / 2;
}

/** Ajusta μ (atenuação efetiva) e β (build-up) para reproduzir dmax e PDD(10). */
export function fitPhoton(b: PhotonBeam): { mu: number; beta: number } {
  const betaFor = (mu: number) => {
    // dmax cresce quando β diminui: bissecção em log β
    let lo = Math.log(0.05);
    let hi = Math.log(200);
    for (let i = 0; i < 80; i++) {
      const m = (lo + hi) / 2;
      const dm = argmax((d) => photonRaw(d, mu, Math.exp(m), b.surf, b.dmax), 0, 10);
      if (dm > b.dmax) lo = m;
      else hi = m;
    }
    return Math.exp((lo + hi) / 2);
  };
  let lo = 0.005;
  let hi = 0.15;
  for (let i = 0; i < 60; i++) {
    const mu = (lo + hi) / 2;
    const beta = betaFor(mu);
    const p10 = (100 * photonRaw(10, mu, beta, b.surf, b.dmax)) / photonRaw(b.dmax, mu, beta, b.surf, b.dmax);
    if (p10 > b.pdd10) lo = mu;
    else hi = mu;
  }
  const mu = (lo + hi) / 2;
  return { mu, beta: betaFor(mu) };
}

const photonFits = PHOTONS.map(fitPhoton);

/** PDD de fótons (%, máximo 100 em dmax), campo 10 × 10 cm², SSD 100 cm. */
export function photonPDD(k: number, d: number): number {
  const b = PHOTONS[k]!;
  const f = photonFits[k]!;
  if (d < 0) return 0;
  return (100 * photonRaw(d, f.mu, f.beta, b.surf, b.dmax)) / photonRaw(b.dmax, f.mu, f.beta, b.surf, b.dmax);
}

// ---------- Elétrons ----------

const erf = (x: number) => {
  // Abramowitz–Stegun 7.1.26
  const s = Math.sign(x);
  const a = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * a);
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-a * a);
  return s * y;
};
export { erf };

/** Alcances práticos (cm) de um feixe de elétrons de energia E (MeV) na água. */
export function electronRanges(E: number) {
  const R50 = E / 2.33;
  const Rp = 1.271 * R50 - 0.23;
  return { R50, Rp, sigma: (Rp - R50) / 1.2533 };
}

function electronRaw(E: number, d: number): number {
  if (d < 0) return 0;
  const { R50, Rp, sigma } = electronRanges(E);
  const s0 = Math.min(0.95, 0.7 + 0.012 * E);
  const rise = s0 + (1 - s0) * (1 - Math.exp(-d / (0.22 * R50)));
  const F = 0.5 * (1 - erf((d - R50) / (Math.SQRT2 * sigma)));
  const tail = (0.003 + 0.002 * E) * (1 - F) * Math.exp(-0.03 * Math.max(0, d - Rp));
  return rise * F + tail;
}
const eMax = new Map<number, number>();
/** PDD de elétrons (%). */
export function electronPDD(E: number, d: number): number {
  const key = Math.round(E * 100);
  let m = eMax.get(key);
  if (m === undefined) {
    m = 0;
    for (let x = 0; x < E / 2; x += 0.01) m = Math.max(m, electronRaw(E, x));
    eMax.set(key, m);
  }
  return (100 * electronRaw(E, d)) / m;
}

// ---------- Prótons ----------

/** Bragg–Kleeman na água: R = α E^p. */
export const BK = { alpha: 0.0022, p: 1.77 };
export const protonRange = (E: number) => BK.alpha * E ** BK.p;
export const protonEnergy = (R: number) => (R / BK.alpha) ** (1 / BK.p);
/** Dispersão de alcance (cm). */
export const straggling = (R: number) => 0.012 * R ** 0.935;
/** Perda de fluência por reações nucleares (fração por cm). */
export const NUCLEAR = 0.012;
/** Dispersão relativa de energia do feixe (σE/E). */
export const ENERGY_SPREAD = 0.008;

const DZ = 0.02;
export interface Curve {
  dz: number;
  y: number[];
}

/**
 * Pico de Bragg puro com alcance R (cm): poder de freamento S ∝ (R − d)^{1/p − 1}
 * (média em cada célula), fluência 1 − 0,012 d e convolução gaussiana pela
 * dispersão de alcance. Normalizado para pico = 1.
 */
export function braggPeak(R: number): Curve {
  const n = Math.ceil((R + 5 * straggling(R) + 1) / DZ);
  const q = 1 / BK.p - 1;
  const raw: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = i * DZ;
    const b = a + DZ;
    if (a >= R) {
      raw.push(0);
      continue;
    }
    const bb = Math.min(b, R);
    const I = ((R - a) ** (q + 1) - (R - bb) ** (q + 1)) / (q + 1);
    const pre = 1 / (BK.p * BK.alpha ** (1 / BK.p));
    const dm = Math.min(a + DZ / 2, R);
    const fl = Math.max(0, 1 - NUCLEAR * dm);
    // freamento eletrônico (MeV/cm) × fluência + energia das reações nucleares depositada localmente (60%)
    raw.push(pre * (I / DZ) * fl + 0.6 * NUCLEAR * protonEnergy(R - dm) * ((bb - a) / DZ));
  }
  const sg = Math.hypot(straggling(R), ENERGY_SPREAD * BK.p * R);
  const kr = Math.ceil((4 * sg) / DZ);
  const ker: number[] = [];
  let ks = 0;
  for (let j = -kr; j <= kr; j++) {
    const v = Math.exp(-((j * DZ) ** 2) / (2 * sg * sg));
    ker.push(v);
    ks += v;
  }
  const y: number[] = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let j = -kr; j <= kr; j++) {
      const k = i + j;
      if (k >= 0 && k < n) s += raw[k]! * ker[j + kr]!;
    }
    y[i] = s / ks;
  }
  const m = Math.max(...y);
  return { dz: DZ, y: y.map((v) => v / m) };
}

export const curveAt = (c: Curve, d: number) => {
  const x = d / c.dz - 0.5;
  if (x < 0) return c.y[0] ?? 0;
  const i = Math.floor(x);
  if (i + 1 >= c.y.length) return 0;
  return c.y[i]! + (c.y[i + 1]! - c.y[i]!) * (x - i);
};

const peakCache = new Map<number, Curve>();
export function braggCached(R: number): Curve {
  const k = Math.round(R * 50);
  let c = peakCache.get(k);
  if (!c) {
    c = braggPeak(k / 50);
    peakCache.set(k, c);
    if (peakCache.size > 400) peakCache.delete(peakCache.keys().next().value!);
  }
  return c;
}

export interface SOBP {
  ranges: number[];
  weights: number[];
  curve: Curve;
}

/**
 * Pico de Bragg espalhado: soma de picos com alcances entre Rmax − M e Rmax, com
 * pesos ajustados iterativamente para uma dose plana na região modulada.
 * Normalizado para dose 1 no platô.
 */
export function sobp(Rmax: number, M: number, n = 14): SOBP {
  const Mm = Math.max(0.2, Math.min(M, Rmax - 0.3));
  const ranges = Array.from({ length: n }, (_, j) => Rmax - Mm + (Mm * j) / (n - 1));
  const peaks = ranges.map(braggCached);
  const len = Math.max(...peaks.map((c) => c.y.length));
  const weights = ranges.map((_, j) => (j === n - 1 ? 1 : 0.15));
  const dose = (d: number) => peaks.reduce((s, c, j) => s + weights[j]! * curveAt(c, d), 0);
  // pontos de controle no platô
  const ctrl = peaks.map((c) => curveMetrics(c).dmax);
  for (let it = 0; it < 300; it++) {
    for (let j = 0; j < n; j++) {
      const v = dose(ctrl[j]!);
      weights[j]! *= Math.pow(1 / Math.max(v, 1e-9), 0.6);
    }
  }
  const y: number[] = [];
  for (let i = 0; i < len; i++) y.push(dose((i + 0.5) * DZ));
  return { ranges, weights, curve: { dz: DZ, y } };
}

/** Profundidade do máximo e da queda distal (80% → 20%) de uma curva. */
export function curveMetrics(c: Curve): { dmax: number; d80: number; d20: number; entrance: number } {
  let im = 0;
  for (let i = 0; i < c.y.length; i++) if (c.y[i]! > c.y[im]!) im = i;
  const m = c.y[im]!;
  const cross = (level: number) => {
    for (let i = im; i + 1 < c.y.length; i++)
      if (c.y[i]! >= level * m && c.y[i + 1]! < level * m) return (i + 0.5 + (c.y[i]! - level * m) / (c.y[i]! - c.y[i + 1]!)) * c.dz;
    return NaN;
  };
  return { dmax: (im + 0.5) * c.dz, d80: cross(0.8), d20: cross(0.2), entrance: c.y[0]! / m };
}

// ---------- Geometria do planejamento ----------

export interface Ellipse {
  cx: number;
  cy: number;
  a: number;
  b: number;
}
export const insideEllipse = (e: Ellipse, x: number, y: number) => ((x - e.cx) / e.a) ** 2 + ((y - e.cy) / e.b) ** 2 <= 1;

/**
 * Distância t ≥ 0 de (x, y) até a borda da elipse andando na direção (dx, dy)
 * (unitária), a partir de um ponto interno.
 */
export function exitDistance(e: Ellipse, x: number, y: number, dx: number, dy: number): number {
  const px = (x - e.cx) / e.a;
  const py = (y - e.cy) / e.b;
  const qx = dx / e.a;
  const qy = dy / e.b;
  const A = qx * qx + qy * qy;
  const B = 2 * (px * qx + py * qy);
  const Cc = px * px + py * py - 1;
  const disc = B * B - 4 * A * Cc;
  if (disc < 0) return 0;
  return Math.max(0, (-B + Math.sqrt(disc)) / (2 * A));
}

/** Fator lateral de um campo de largura W com penumbra gaussiana σ. */
export const lateral = (l: number, W: number, sigma: number) => 0.5 * (erf((W / 2 - l) / (Math.SQRT2 * sigma)) + erf((W / 2 + l) / (Math.SQRT2 * sigma)));

/** Gerador mulberry32. */
export function rng(seed: number) {
  let st = seed >>> 0;
  return () => {
    st = (st + 0x6d2b79f5) >>> 0;
    let t = st;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
