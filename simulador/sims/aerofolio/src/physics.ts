// Escoamento potencial em torno de um aerofólio de Joukowski (transformação conforme z = ζ + c²/ζ).
import { num, rad, type Params } from "@fisilab/core";

export type C = [number, number];
const add = (a: C, b: C): C => [a[0] + b[0], a[1] + b[1]];
const sub = (a: C, b: C): C => [a[0] - b[0], a[1] - b[1]];
const mul = (a: C, b: C): C => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
const div = (a: C, b: C): C => {
  const d = b[0] * b[0] + b[1] * b[1];
  return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d];
};
const expi = (t: number): C => [Math.cos(t), Math.sin(t)];
const abs = (a: C) => Math.hypot(a[0], a[1]);
function csqrt(a: C): C {
  const r = abs(a);
  const re = Math.sqrt(Math.max(0, (r + a[0]) / 2));
  const im = Math.sign(a[1] || 1) * Math.sqrt(Math.max(0, (r - a[0]) / 2));
  return [re, im];
}

/** Parâmetro do mapa (m): c = 0,25 m dá corda ≈ 1 m. */
export const CMAP = 0.25;

export interface Foil {
  /** Ângulo de ataque (rad), velocidade (m/s), densidade (kg/m³). */
  alpha: number;
  U: number;
  rho: number;
  /** Centro e raio do círculo no plano ζ. */
  mu: C;
  a: number;
  /** Ângulo que leva a sustentação nula: α₀ = −β. */
  beta: number;
  /** Circulação usada no campo (horária positiva), m²/s. */
  gamma: number;
  /** Circulação de Kutta (sem estol). */
  gammaKutta: number;
  chord: number;
  xLE: number;
  xTE: number;
}

const cache = new Map<string, Foil>();

/** Coeficiente de sustentação do modelo potencial: C_L = 8πa sen(α + β)/corda. */
export function clPotential(f: Pick<Foil, "a" | "beta" | "chord">, alpha: number): number {
  return (8 * Math.PI * f.a * Math.sin(alpha + f.beta)) / f.chord;
}

/**
 * Estol aproximado: acima de α_estol (medido a partir do ângulo de sustentação nula) o
 * escoamento descola e C_L passa suavemente para o de placa descolada, ≈ 0,9 sen 2α.
 */
export function clWithStall(f: Pick<Foil, "a" | "beta" | "chord">, alpha: number, alphaStall: number): number {
  const ae = alpha + f.beta;
  // Transição suave (smoothstep) entre α_estol − 2° e α_estol + 2°; abaixo disso, exatamente o potencial
  const u = Math.max(0, Math.min(1, (Math.abs(ae) - alphaStall + rad(2)) / rad(4)));
  const s = u * u * (3 - 2 * u);
  return (1 - s) * clPotential(f, alpha) + s * 0.9 * Math.sin(2 * ae);
}

export function foilOf(p: Params): Foil {
  const eps = num(p, "esp", 0.1);
  const fc = num(p, "arq", 0.05);
  const alpha = rad(num(p, "alpha", 5));
  const U = num(p, "U", 30);
  const rho = num(p, "rho", 1.2);
  const stall = rad(num(p, "estol", 14));
  const key = [eps, fc, alpha, U, rho, stall].join("|");
  const hit = cache.get(key);
  if (hit) return hit;
  const c = CMAP;
  const mu: C = [-eps * c, fc * c];
  const a = Math.hypot(c - mu[0], mu[1]);
  const beta = Math.atan2(mu[1], c - mu[0]);
  // Corda: extensão do contorno mapeado
  let xmin = Infinity, xmax = -Infinity;
  for (let i = 0; i < 720; i++) {
    const z = mapZ(add(mu, mul([a, 0], expi((2 * Math.PI * i) / 720))));
    xmin = Math.min(xmin, z[0]);
    xmax = Math.max(xmax, z[0]);
  }
  const chord = xmax - xmin;
  const geo = { a, beta, chord };
  const gammaKutta = 4 * Math.PI * a * U * Math.sin(alpha + beta);
  const cl = clWithStall(geo, alpha, stall);
  const foil: Foil = { alpha, U, rho, mu, a, beta, gamma: 0.5 * U * chord * cl, gammaKutta, chord, xLE: xmin, xTE: xmax };
  if (cache.size > 200) cache.clear();
  cache.set(key, foil);
  return foil;
}

/** z = ζ + c²/ζ. */
export function mapZ(zeta: C): C {
  return add(zeta, div([CMAP * CMAP, 0], zeta));
}

/** Inversa do mapa, escolhendo o ramo fora do círculo. Devolve null dentro do perfil. */
export function invZeta(f: Foil, z: C): C | null {
  const s = csqrt(sub(mul(z, z), [4 * CMAP * CMAP, 0]));
  const z1: C = [(z[0] + s[0]) / 2, (z[1] + s[1]) / 2];
  const z2: C = [(z[0] - s[0]) / 2, (z[1] - s[1]) / 2];
  const r1 = abs(sub(z1, f.mu)), r2 = abs(sub(z2, f.mu));
  const best = r1 >= r2 ? z1 : z2;
  return Math.max(r1, r2) < f.a ? null : best;
}

/** dw/dζ = U[e^{−iα} − a²e^{iα}/(ζ−μ)²] + iΓ/(2π(ζ−μ)). */
function dwdzeta(f: Foil, zeta: C): C {
  const d = sub(zeta, f.mu);
  const t1 = mul([f.U, 0], expi(-f.alpha));
  const t2 = div(mul([f.U * f.a * f.a, 0], expi(f.alpha)), mul(d, d));
  const t3 = div([0, f.gamma / (2 * Math.PI)], d);
  return add(sub(t1, t2), t3);
}

/** Velocidade (u, v) no plano físico a partir de ζ. */
export function velocityAtZeta(f: Foil, zeta: C): [number, number] {
  const dz = sub([1, 0], div([CMAP * CMAP, 0], mul(zeta, zeta)));
  const w = div(dwdzeta(f, zeta), dz);
  return [w[0], -w[1]];
}

/** Velocidade no ponto z (null dentro do perfil). */
export function velocity(f: Foil, x: number, y: number): [number, number] | null {
  const zeta = invZeta(f, [x, y]);
  return zeta ? velocityAtZeta(f, zeta) : null;
}

/** Função corrente ψ (m²/s); NaN dentro do perfil. */
export function streamFunction(f: Foil, x: number, y: number): number {
  const zeta = invZeta(f, [x, y]);
  if (!zeta) return NaN;
  const d = sub(zeta, f.mu);
  const w = add(mul(d, expi(-f.alpha)), div([f.a * f.a, 0], mul(d, expi(-f.alpha))));
  return f.U * w[1] + (f.gamma / (2 * Math.PI)) * Math.log(abs(d));
}

/** Coeficiente de pressão C_p = 1 − V²/U² (Bernoulli). */
export function cp(f: Foil, x: number, y: number): number {
  const v = velocity(f, x, y);
  return v ? 1 - (v[0] ** 2 + v[1] ** 2) / f.U ** 2 : NaN;
}

/** Pontos do contorno do perfil (no sentido anti-horário a partir do bordo de fuga). */
export function contour(f: Foil, n = 240): { z: C; zeta: C }[] {
  const out: { z: C; zeta: C }[] = [];
  const th0 = -f.beta;
  for (let i = 0; i <= n; i++) {
    const zeta = add(f.mu, mul([f.a, 0], expi(th0 + (2 * Math.PI * i) / n)));
    out.push({ zeta, z: mapZ(zeta) });
  }
  return out;
}

/** C_p na superfície, para θ medido do bordo de fuga (evita o ponto singular do mapa). */
export function surfaceCp(f: Foil, theta: number): { x: number; y: number; cp: number } {
  const zeta = add(f.mu, mul([f.a * (1 + 1e-9), 0], expi(-f.beta + theta)));
  const z = mapZ(zeta);
  const v = velocityAtZeta(f, zeta);
  return { x: z[0], y: z[1], cp: 1 - (v[0] ** 2 + v[1] ** 2) / f.U ** 2 };
}

/** Sustentação por unidade de envergadura pela integração da pressão no contorno (N/m). */
export function liftFromPressure(f: Foil, n = 4000): number {
  let Fx = 0, Fy = 0;
  for (let i = 0; i < n; i++) {
    const a = surfaceCp(f, (2 * Math.PI * i) / n);
    const b = surfaceCp(f, (2 * Math.PI * (i + 1)) / n);
    const m = surfaceCp(f, (2 * Math.PI * (i + 0.5)) / n);
    const p = 0.5 * f.rho * f.U ** 2 * -m.cp; // p − p∞ ... sinal: p − p∞ = ½ρU²C_p
    const dx = b.x - a.x, dy = b.y - a.y;
    // Normal externa de um contorno anti-horário: (dy, −dx); força = −∮ (p − p∞) n dl
    Fx += p * dy;
    Fy += -p * dx;
  }
  // p acima é −(p − p∞), então F = +Σ p·n
  return -Math.sin(f.alpha) * Fx + Math.cos(f.alpha) * Fy;
}
