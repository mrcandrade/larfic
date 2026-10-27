// Física dos interferômetros: Fabry–Perot (Airy), Michelson de micro-ondas,
// Michelson–Morley e cavidade ótica com feixes gaussianos.

export const C_LIGHT = 299_792_458;

// ------------------------------------------------------------------ Fabry–Perot
/** Coeficiente de finesse F = 4R/(1 − R)². */
export const coefF = (R: number) => (4 * R) / (1 - R) ** 2;
/** Finesse 𝓕 = π√R/(1 − R). */
export const finesse = (R: number) => (Math.PI * Math.sqrt(R)) / (1 - R);
/** Função de Airy (transmissão de espelhos sem perdas): T = 1/(1 + F sen²(δ/2)). */
export const airy = (delta: number, R: number) => 1 / (1 + coefF(R) * Math.sin(delta / 2) ** 2);
/** Fase de ida e volta δ = 4π n d cos θ / λ. */
export const fpPhase = (d: number, lambda: number, cosTh: number, n = 1) => (4 * Math.PI * n * d * cosTh) / lambda;
/** Intervalo espectral livre em frequência (Hz) e em comprimento de onda (m). */
export const fsrHz = (d: number, n = 1) => C_LIGHT / (2 * n * d);
export const fsrLambda = (d: number, lambda: number, n = 1) => (lambda * lambda) / (2 * n * d);

/**
 * Raios (m) dos anéis brilhantes no plano focal de uma lente de distância focal f:
 * cos θ_p = m_p λ/(2d), com m_p = ⌊2d/λ⌋, ⌊2d/λ⌋ − 1, ...; r = f tan θ.
 */
export function ringRadii(d: number, lambda: number, f: number, rMax: number): number[] {
  const m0 = (2 * d) / lambda;
  const out: number[] = [];
  for (let m = Math.floor(m0); m > 0 && out.length < 200; m--) {
    const c = (m * lambda) / (2 * d);
    const r = f * Math.tan(Math.acos(Math.min(1, c)));
    if (r > rMax) break;
    out.push(r);
  }
  return out;
}

// ------------------------------------------------------------------ micro-ondas
/**
 * Michelson de micro-ondas: duas ondas de amplitudes a₁ e a₂ com diferença de
 * caminho Δ. Intensidade relativa (1 com as duas em fase e a₁ = a₂ = 1/2).
 */
export function twoBeam(a1: number, a2: number, delta: number, lambda: number): number {
  return a1 * a1 + a2 * a2 + 2 * a1 * a2 * Math.cos((2 * Math.PI * delta) / lambda);
}

/** Transmissão de um Fabry–Perot de micro-ondas com placas de refletância R separadas de d. */
export const fpTransmission = (d: number, lambda: number, R: number) => ((1 - R) ** 2) / ((1 - R) ** 2 + 4 * R * Math.sin((2 * Math.PI * d) / lambda) ** 2);

// ------------------------------------------------------------------ Michelson–Morley
/**
 * Deslocamento de franjas previsto pela hipótese do éter estacionário, em relação à
 * posição média, com braços iguais de comprimento L: N(α) = (L v²/(λ c²)) cos 2α.
 * A variação total entre α = 0 e 90° é 2Lv²/(λc²).
 */
export const etherShift = (L: number, v: number, lambda: number, alphaDeg: number) => ((L * v * v) / (lambda * C_LIGHT * C_LIGHT)) * Math.cos((2 * alphaDeg * Math.PI) / 180);

/** Diferença de tempo de ida e volta entre os braços paralelo e perpendicular ao "vento de éter" (s). */
export const etherDeltaT = (L: number, v: number) => (2 * L) / C_LIGHT / (1 - (v * v) / (C_LIGHT * C_LIGHT)) - (2 * L) / C_LIGHT / Math.sqrt(1 - (v * v) / (C_LIGHT * C_LIGHT));

// ------------------------------------------------------------------ cavidade ótica
export interface CavityMode {
  stable: boolean;
  /** Comprimento de Rayleigh (m). */
  zR: number;
  /** Cintura do feixe (m). */
  w0: number;
  /** Distâncias da cintura até os espelhos 1 (à esquerda) e 2 (m), z₁ + z₂ = L. */
  z1: number;
  z2: number;
  /** Raio do feixe em cada espelho (m). */
  w1: number;
  w2: number;
}

/** Modo gaussiano fundamental de uma cavidade de dois espelhos (Kogelnik e Li). */
export function cavityMode(g1: number, g2: number, L: number, lambda: number): CavityMode {
  const gg = g1 * g2;
  const stable = gg > 0 && gg < 1;
  if (!stable) return { stable, zR: NaN, w0: NaN, z1: NaN, z2: NaN, w1: NaN, w2: NaN };
  let den = g1 + g2 - 2 * gg;
  if (Math.abs(den) < 1e-12) den = 1e-12;
  const zR = Math.sqrt((L * L * gg * (1 - gg)) / (den * den));
  const z1 = (L * g2 * (1 - g1)) / den;
  const z2 = (L * g1 * (1 - g2)) / den;
  const w0 = Math.sqrt((lambda * zR) / Math.PI);
  const w = (z: number) => w0 * Math.sqrt(1 + (z / zR) ** 2);
  return { stable, zR, w0, z1, z2, w1: w(z1), w2: w(z2) };
}

/** Raio do feixe gaussiano w(z) e raio de curvatura da frente de onda R(z). */
export const beamRadius = (w0: number, zR: number, z: number) => w0 * Math.sqrt(1 + (z / zR) ** 2);
export const wavefrontR = (zR: number, z: number) => z + (zR * zR) / z;

/** Raio de curvatura (m) correspondente a g = 1 − L/R (∞ para g = 1). */
export const radiusFromG = (g: number, L: number) => (Math.abs(1 - g) < 1e-9 ? Infinity : L / (1 - g));

/**
 * Traçado paraxial de um raio na cavidade: devolve as alturas (y) nos espelhos
 * 1 e 2 alternadamente, partindo do espelho 1 com altura y0 e inclinação u0.
 */
export function traceRay(g1: number, g2: number, L: number, y0: number, u0: number, bounces: number, aperture: number): number[] {
  const R1 = radiusFromG(g1, L);
  const R2 = radiusFromG(g2, L);
  let y = y0;
  let u = u0;
  const ys = [y];
  for (let i = 0; i < bounces; i++) {
    y += L * u; // propaga até o outro espelho
    // reflexão num espelho de raio R (côncavo > 0): u → u − 2y/R (convenção desdobrada)
    const R = i % 2 === 0 ? R2 : R1;
    u = u - (Number.isFinite(R) ? (2 * y) / R : 0);
    ys.push(y);
    if (Math.abs(y) > aperture) break;
  }
  return ys;
}

/** Espaçamento entre modos longitudinais (FSR, Hz) e entre modos transversais (Hz). */
export const cavityFSR = (L: number) => C_LIGHT / (2 * L);
export function transverseSpacing(g1: number, g2: number, L: number): number {
  const gg = g1 * g2;
  if (!(gg > 0 && gg < 1)) return NaN;
  const s = Math.sign(g1) * Math.sqrt(gg);
  return (cavityFSR(L) * Math.acos(s)) / Math.PI;
}
