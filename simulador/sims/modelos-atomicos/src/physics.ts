/**
 * Espalhamento de partículas alfa (Rutherford e Thomson) e átomo de Bohr.
 *
 * Unidades do espalhamento: comprimentos em d = k·2Ze²/K (distância de máxima
 * aproximação numa colisão frontal) e velocidades em v₀ (velocidade inicial).
 * Nessas unidades a aceleração coulombiana vale a = r̂ / (2 r²).
 */

export type Vec = [number, number];

export interface Trajectory {
  /** Pontos da trajetória (unidades de d). */
  pts: Vec[];
  /** Ângulo de espalhamento, em radianos (0 a π). */
  theta: number;
  /** Parâmetro de impacto efetivo (momento angular / v∞). */
  b: number;
}

const R_START = 1000;

/** Ângulo de Rutherford: tan(θ/2) = d / (2b). */
export const rutherfordAngle = (b: number) => 2 * Math.atan2(1, 2 * b);
/** Parâmetro de impacto que produz o ângulo θ: b = (d/2) cot(θ/2). */
export const impactFor = (theta: number) => (theta <= 0 ? Infinity : 0.5 / Math.tan(theta / 2));

/**
 * Integra (RK4 com passo proporcional à escala local de tempo) a trajetória
 * de uma alfa com parâmetro de impacto b ≥ 0 e velocidade inicial v₀ = 1,
 * vindo de x = −∞, num núcleo pontual. `keepEvery` controla quantos pontos guardar.
 */
export function rutherfordTrajectory(b: number, keepEvery = 3, keepWithin = 60): Trajectory {
  let x = -Math.sqrt(R_START * R_START - b * b);
  let y = b;
  let vx = Math.sqrt(1 - 1 / R_START);
  let vy = 0;
  const L = -b * vx; // (r × v)_z no início
  const ax = (px: number, py: number) => {
    const r2 = px * px + py * py;
    return 0.5 / (r2 * Math.sqrt(r2));
  };
  const pts: Vec[] = [];
  let outgoing = false;
  for (let i = 0; i < 200000; i++) {
    const r = Math.hypot(x, y);
    const v = Math.hypot(vx, vy);
    if (outgoing && r > R_START) break;
    if (i % keepEvery === 0 && r < keepWithin) pts.push([x, y]);
    const h = 0.025 * Math.min(r / Math.max(v, 1e-9), Math.sqrt(2 * r * r * r));
    // RK4 escalar: (x, y, vx, vy)' = (vx, vy, k x, k y), k = 1/(2 r³)
    const k1 = ax(x, y);
    const x2 = x + 0.5 * h * vx, y2 = y + 0.5 * h * vy, u2 = vx + 0.5 * h * k1 * x, w2 = vy + 0.5 * h * k1 * y;
    const k2 = ax(x2, y2);
    const x3 = x + 0.5 * h * u2, y3 = y + 0.5 * h * w2, u3 = vx + 0.5 * h * k2 * x2, w3 = vy + 0.5 * h * k2 * y2;
    const k3 = ax(x3, y3);
    const x4 = x + h * u3, y4 = y + h * w3, u4 = vx + h * k3 * x3, w4 = vy + h * k3 * y3;
    const k4 = ax(x4, y4);
    const nx = x + (h / 6) * (vx + 2 * u2 + 2 * u3 + u4);
    const ny = y + (h / 6) * (vy + 2 * w2 + 2 * w3 + w4);
    vx += (h / 6) * (k1 * x + 2 * k2 * x2 + 2 * k3 * x3 + k4 * x4);
    vy += (h / 6) * (k1 * y + 2 * k2 * y2 + 2 * k3 * y3 + k4 * y4);
    x = nx;
    y = ny;
    if (x * vx + y * vy > 0) outgoing = true;
  }
  const theta = Math.acos(Math.max(-1, Math.min(1, vx / Math.hypot(vx, vy))));
  return { pts, theta, b: Math.abs(L) };
}

/**
 * Modelo de Thomson: carga positiva uniforme numa esfera de raio R (em d),
 * átomo neutro fora dela. Dentro: a = r / (2R³). Integra só o trecho interno.
 */
export function thomsonTrajectory(b: number, R: number, keepEvery = 4): Trajectory {
  const xe = -2 * R;
  if (b >= R) return { pts: [[xe, b], [2 * R, b]], theta: 0, b };
  let x = -Math.sqrt(R * R - b * b);
  let y = b;
  let vx = 1;
  let vy = 0;
  const k = 0.5 / (R * R * R);
  const pts: Vec[] = [[xe, b]];
  const h = 0.01 * R;
  for (let i = 0; i < 100000; i++) {
    if (i % keepEvery === 0) pts.push([x, y]);
    // RK4 para x'' = k x (linear): mesmas fórmulas do caso geral
    const x2 = x + 0.5 * h * vx, y2 = y + 0.5 * h * vy, u2 = vx + 0.5 * h * k * x, w2 = vy + 0.5 * h * k * y;
    const x3 = x + 0.5 * h * u2, y3 = y + 0.5 * h * w2, u3 = vx + 0.5 * h * k * x2, w3 = vy + 0.5 * h * k * y2;
    const x4 = x + h * u3, y4 = y + h * w3, u4 = vx + h * k * x3, w4 = vy + h * k * y3;
    const nx = x + (h / 6) * (vx + 2 * u2 + 2 * u3 + u4);
    const ny = y + (h / 6) * (vy + 2 * w2 + 2 * w3 + w4);
    vx += (h / 6) * k * (x + 2 * x2 + 2 * x3 + x4);
    vy += (h / 6) * k * (y + 2 * y2 + 2 * y3 + y4);
    x = nx;
    y = ny;
    if (i > 2 && x * x + y * y > R * R) break;
  }
  const v = Math.hypot(vx, vy);
  pts.push([x, y], [x + (vx / v) * 2 * R, y + (vy / v) * 2 * R]);
  const theta = Math.acos(Math.max(-1, Math.min(1, vx / v)));
  return { pts, theta, b };
}

/** Maior desvio possível no modelo de Thomson (varredura em b), em radianos. */
export function thomsonMaxAngle(R: number): number {
  let best = 0;
  for (let i = 1; i < 40; i++) best = Math.max(best, thomsonTrajectory((R * i) / 40, R, 1000).theta);
  return best;
}

export const BIN_DEG = 5;
export const NBINS = 180 / BIN_DEG;

/** Ângulo sólido de um anel entre θ1 e θ2 (radianos). */
export const solidAngle = (t1: number, t2: number) => 2 * Math.PI * (Math.cos(t1) - Math.cos(t2));

/**
 * Contagem esperada (Rutherford) entre θ1 e θ2 para N alfas com parâmetro de
 * impacto uniforme num disco de raio bmax.
 */
export function expectedCount(t1: number, t2: number, N: number, bmax: number): number {
  const bOf = (t: number) => Math.min(bmax, impactFor(t));
  const b1 = bOf(t1);
  const b2 = t2 >= Math.PI ? 0 : bOf(t2);
  return (N * (b1 * b1 - b2 * b2)) / (bmax * bmax);
}

/** dN/dΩ de Rutherford: N/(π bmax²) · (d/4)² / sin⁴(θ/2). */
export const rutherfordDnDOmega = (theta: number, N: number, bmax: number) =>
  (N / (Math.PI * bmax * bmax)) * (1 / 16) / Math.sin(theta / 2) ** 4;

// ---------------- Bohr ----------------

const ME_U = 5.48579909e-4;
const NUCLEUS_U = [1.00727647, 4.00150618, 7.01435713];
export const RY_INF = 13.605693; // eV
export const HC_EV_NM = 1239.84198;

/** Energia do nível n (eV), com massa reduzida. */
export function bohrEnergy(n: number, Z: number): number {
  const M = NUCLEUS_U[Math.max(0, Math.min(2, Math.round(Z) - 1))]!;
  return (-RY_INF * Z * Z) / (1 + ME_U / M) / (n * n);
}

/** Raio da órbita n, em unidades do raio de Bohr a₀. */
export const bohrRadius = (n: number, Z: number) => (n * n) / Z;

/** Comprimento de onda (nm, no vácuo) do fóton emitido em ni → nf. */
export const lineNm = (ni: number, nf: number, Z: number) => HC_EV_NM / (bohrEnergy(ni, Z) - bohrEnergy(nf, Z));

export const SERIES = ["Lyman", "Balmer", "Paschen", "Brackett", "Pfund", "Humphreys"];
