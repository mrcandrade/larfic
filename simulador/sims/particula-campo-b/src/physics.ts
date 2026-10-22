/** Partícula carregada em campos E e B: integrador de Boris, geometrias e campo de espiras. */

export const QE = 1.602176634e-19;
export const U = 1.6605390666e-27;
export const ME = 9.1093837015e-31;
export const MP = 1.67262192369e-27;
export const MU0 = 4e-7 * Math.PI;

export type V3 = [number, number, number];

export interface Species {
  nome: string;
  m: number;
  q: number;
}

export const SPECIES: Species[] = [
  { nome: "Próton", m: MP, q: QE },
  { nome: "Elétron", m: ME, q: -QE },
  { nome: "Pósitron", m: ME, q: QE },
  { nome: "Partícula alfa", m: 6.6446573357e-27, q: 2 * QE },
  { nome: "Dêuteron", m: 3.3435837724e-27, q: QE },
];

/** Íons de carga +e: massa atômica (u) de cada isótopo. */
export const ISOTOPES: { nome: string; A: number[]; rotulos: string[] }[] = [
  { nome: "Neônio-20 e 22", A: [19.9924, 21.9914], rotulos: ["²⁰Ne⁺", "²²Ne⁺"] },
  { nome: "Cloro-35 e 37", A: [34.9689, 36.9659], rotulos: ["³⁵Cl⁺", "³⁷Cl⁺"] },
  { nome: "Carbono-12, 13 e 14", A: [12, 13.00335, 14.00324], rotulos: ["¹²C⁺", "¹³C⁺", "¹⁴C⁺"] },
  { nome: "Urânio-235 e 238", A: [235.0439, 238.0508], rotulos: ["²³⁵U⁺", "²³⁸U⁺"] },
];

/** Massa de um íon positivo de carga +e (desconta um elétron). */
export const ionMass = (A: number) => A * U - ME;

export interface Particle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  m: number;
  q: number;
  /** Rótulo: índice de isótopo ou de velocidade. */
  tag: number;
  /** Fator de velocidade em relação a v₀ (seletor/espectrômetro). */
  vf: number;
  alive: boolean;
  /** Atingiu o detector/anteparo; posição do impacto. */
  hit: boolean;
  hx: number;
  hy: number;
}

export interface Fields {
  E: V3;
  B: V3;
}

/**
 * Integrador de Boris (leapfrog): meio impulso elétrico, rotação magnética exata
 * em módulo, meio impulso elétrico. Com E = 0 conserva |v| exatamente.
 */
export function borisStep(p: Particle, f: (x: number, y: number, z: number) => Fields, h: number): void {
  const { E, B } = f(p.x, p.y, p.z);
  const k = (p.q / p.m) * (h / 2);
  // meio impulso elétrico
  let vx = p.vx + k * E[0];
  let vy = p.vy + k * E[1];
  let vz = p.vz + k * E[2];
  // rotação
  const tx = k * B[0];
  const ty = k * B[1];
  const tz = k * B[2];
  const t2 = tx * tx + ty * ty + tz * tz;
  const sx = (2 * tx) / (1 + t2);
  const sy = (2 * ty) / (1 + t2);
  const sz = (2 * tz) / (1 + t2);
  const px = vx + (vy * tz - vz * ty);
  const py = vy + (vz * tx - vx * tz);
  const pz = vz + (vx * ty - vy * tx);
  vx += py * sz - pz * sy;
  vy += pz * sx - px * sz;
  vz += px * sy - py * sx;
  // meio impulso elétrico
  p.vx = vx + k * E[0];
  p.vy = vy + k * E[1];
  p.vz = vz + k * E[2];
  p.x += p.vx * h;
  p.y += p.vy * h;
  p.z += p.vz * h;
}

/** Integrais elípticas completas K(k) e E(k) pela média aritmético-geométrica. */
export function ellipticKE(k: number): { K: number; E: number } {
  let a = 1;
  let b = Math.sqrt(Math.max(0, 1 - k * k));
  let c = k;
  let sum = 0.5 * c * c;
  let pow = 0.5;
  for (let i = 0; i < 30 && Math.abs(c) > 1e-16; i++) {
    const an = (a + b) / 2;
    c = (a - b) / 2;
    b = Math.sqrt(a * b);
    a = an;
    pow *= 2;
    sum += pow * c * c;
  }
  const K = Math.PI / (2 * a);
  return { K, E: K * (1 - sum) };
}

/**
 * Campo exato de uma espira circular de raio a no plano z = z0, corrente I,
 * eixo z. Devolve (B_ρ, B_z) no ponto (ρ, z).
 */
export function loopField(a: number, I: number, z0: number, rho: number, z: number): [number, number] {
  const dz = z - z0;
  const r = Math.abs(rho);
  if (r < 1e-9) return [0, (MU0 * I * a * a) / (2 * Math.pow(a * a + dz * dz, 1.5))];
  const s1 = (a + r) ** 2 + dz * dz;
  const s2 = (a - r) ** 2 + dz * dz;
  const k = Math.sqrt((4 * a * r) / s1);
  const { K, E } = ellipticKE(Math.min(k, 1 - 1e-15));
  const c = (MU0 * I) / (2 * Math.PI * Math.sqrt(s1));
  const Br = ((c * dz) / r) * (-K + ((a * a + r * r + dz * dz) / s2) * E);
  const Bz = c * (K + ((a * a - r * r - dz * dz) / s2) * E);
  return [Math.sign(rho || 1) * Br, Bz];
}

/** Garrafa magnética: duas espiras coaxiais em z = ±L. */
export const BOTTLE = { a: 0.6, L: 1 };

/** Corrente que produz o campo B0 no centro da garrafa. */
export const bottleCurrent = (B0: number) => (B0 * Math.pow(BOTTLE.a ** 2 + BOTTLE.L ** 2, 1.5)) / (MU0 * BOTTLE.a ** 2);

export function bottleField(B0: number, x: number, y: number, z: number): V3 {
  const I = bottleCurrent(B0);
  const rho = Math.hypot(x, y);
  const [r1, z1] = loopField(BOTTLE.a, I, BOTTLE.L, rho, z);
  const [r2, z2] = loopField(BOTTLE.a, I, -BOTTLE.L, rho, z);
  const Br = r1 + r2;
  if (rho < 1e-12) return [0, 0, z1 + z2];
  return [(Br * x) / rho, (Br * y) / rho, z1 + z2];
}

/** Razão de espelho B(±L)/B(0) no eixo e ângulo do cone de perda (graus). */
export function bottleMirror(): { ratio: number; lossCone: number } {
  const B0 = bottleField(1, 0, 0, 0)[2];
  const Bm = bottleField(1, 0, 0, BOTTLE.L)[2];
  const ratio = Bm / B0;
  return { ratio, lossCone: (Math.asin(Math.sqrt(1 / ratio)) * 180) / Math.PI };
}

/** Geometria do seletor de velocidades (modo seletor, horizontal). */
export const SEL = { L: 0.3, h: 0.02, slit: 0.0025, screen: 0.45, x0: -0.05 };
/** Espectrômetro de Bainbridge (vertical): seletor de comprimento L abaixo de y = 0. */
export const SPEC = { L: 0.25, h: 0.015, slit: 0.0025, y0: -0.28 };
/** Ciclotron: raio dos “dês” e largura do vão. */
export const CYC = { R: 0.3, gap: 0.01 };

export const cyclotronPeriod = (m: number, q: number, B: number) => (2 * Math.PI * m) / (Math.abs(q) * B);
export const larmorRadius = (m: number, v: number, q: number, B: number) => (m * v) / (Math.abs(q) * B);
/** Energia cinética máxima de extração do ciclotron: K = q²B²R²/(2m). */
export const cyclotronKmax = (m: number, q: number, B: number, R = CYC.R) => (q * q * B * B * R * R) / (2 * m);
