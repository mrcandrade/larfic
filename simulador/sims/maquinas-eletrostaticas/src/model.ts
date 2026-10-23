/**
 * Física das máquinas eletrostáticas (SI). Funções puras, testáveis.
 */

export const EPS0 = 8.8541878128e-12;
export const K = 8.9875517923e9;
export const E_BD = 3e6; // rigidez dielétrica do ar seco, V/m
export const E_CHARGE = 1.602176634e-19;
export const G = 9.81;

/** Capacitância de uma esfera isolada de raio R. */
export const sphereC = (R: number) => 4 * Math.PI * EPS0 * R;

/**
 * Tensão de ruptura entre um eletrodo de raio R (no potencial V) e um eletrodo
 * aterrado a uma distância d. Campo máximo aproximado por E = V (1/d + 1/R):
 * vale V/d para gaps pequenos (campo uniforme) e V/R para a esfera isolada.
 */
export const gapBreakdown = (R: number, d: number, Ebd = E_BD) => Ebd / (1 / d + 1 / R);

/**
 * Lei de Paschen (ar): V_b = B p d / (ln(A p d) − ln ln(1 + 1/γ)), com
 * A = 15 /(cm·Torr), B = 365 V/(cm·Torr), γ = 0,01. d em metros, p em Torr.
 * Abaixo do mínimo de Paschen a fórmula diverge; devolvemos o mínimo (~330 V).
 */
export function paschen(d: number, pTorr = 760, A = 15, B = 365, gamma = 0.01): number {
  const pd = pTorr * d * 100; // Torr·cm
  const c = Math.log(Math.log(1 + 1 / gamma));
  const pdMin = (Math.E * Math.exp(c)) / A;
  const x = Math.max(pd, pdMin);
  return (B * x) / (Math.log(A * x) - c);
}

/** Resistência de fuga do ar/suportes em função da umidade relativa (%). */
export const leakResistance = (U: number) => Math.pow(10, 13 - 0.03 * (U - 20));

// ---------------------------------------------------------------------------
// Van de Graaff
// ---------------------------------------------------------------------------

/** Densidade superficial máxima que a correia pode carregar sem ionizar o ar: σ = ε₀ E_bd. */
export const SIGMA_MAX = EPS0 * E_BD;

/** Corrente de carga transportada pela correia: I = σ w v. */
export const beltCurrent = (sigma: number, w: number, v: number) => sigma * w * v;

/** Tempo até a cúpula atingir Vs, partindo de zero: V(t) = I R_L (1 − e^{−t/τ}). */
export function timeToReach(Vs: number, I: number, RL: number, C: number): number {
  const Vinf = I * RL;
  if (Vs >= Vinf) return Infinity;
  return -RL * C * Math.log(1 - Vs / Vinf);
}

/** Passo exato de dV/dt = I/C − V/(R_L C). */
export function rcStep(V: number, I: number, RL: number, C: number, dt: number): number {
  const Vinf = I * RL;
  return Vinf + (V - Vinf) * Math.exp(-dt / (RL * C));
}

// ---------------------------------------------------------------------------
// Wimshurst
// ---------------------------------------------------------------------------

export const WIM_SECTORS = 24;
/** Área de um setor metálico (m²) e carga máxima por setor q = ε₀ E_bd A. */
export const WIM_SECTOR_AREA = 1e-3;
export const WIM_QMAX = SIGMA_MAX * WIM_SECTOR_AREA;
/** Ganho da realimentação por indução, por radiano girado. */
export const WIM_GAIN = 0.5;
export const WIM_BALL = 0.01; // raio das esferas do centelhador (m)

/** Crescimento logístico da carga dos setores: s(t+dt) exato. */
export function wimSectorStep(s: number, omega: number, dt: number): number {
  const e = Math.exp(-WIM_GAIN * omega * dt);
  return s / (s + (1 - s) * e);
}

/** Corrente entregue aos coletores: dois discos, N setores, f voltas/s. */
export const wimCurrent = (s: number, omega: number) => 2 * WIM_SECTORS * s * WIM_QMAX * (omega / (2 * Math.PI));

/** Ruptura no centelhador simétrico de esferas de raio r: E = V (1/d + 1/(2r)). */
export const wimSparkV = (d: number, r = WIM_BALL) => E_BD / (1 / d + 1 / (2 * r));

// ---------------------------------------------------------------------------
// Balão e parede
// ---------------------------------------------------------------------------

export const BALLOON_R = 0.12;
export const BALLOON_M = 3e-3;
export const CHARGE_DEPTH = 0.01; // profundidade efetiva da carga na superfície (m)
export const MU_WALL = 0.6;

/** Fator da carga imagem num dielétrico semi-infinito: β = (εr − 1)/(εr + 1). */
export const imageFactor = (er: number) => (er - 1) / (er + 1);

/** Atração de uma carga Q a distância s + δ de uma parede dielétrica (carga imagem −βQ a 2(s+δ)). */
export function wallForce(Q: number, gap: number, er: number): number {
  const r = 2 * (Math.max(gap, 0) + CHARGE_DEPTH);
  return (K * imageFactor(er) * Q * Q) / (r * r);
}

/** Carga mínima para o balão ficar grudado: μ F(0) = m g. */
export function minStickCharge(er: number, m = BALLOON_M, mu = MU_WALL): number {
  const r = 2 * CHARGE_DEPTH;
  return Math.sqrt((m * G * r * r) / (mu * K * imageFactor(er)));
}

/** Tempo de relaxação da carga do balão (s) com a umidade (%). */
export const balloonTau = (U: number) => 3600 * Math.exp(-(U - 20) / 15);

/** Carga de saturação do balão esfregado no cabelo (C). */
export const balloonQsat = (U: number) => 250e-9 * Math.max(0.05, 1 - U / 110);

// ---------------------------------------------------------------------------
// John Travoltage
// ---------------------------------------------------------------------------

/** Tensão máxima do corpo ao andar no carpete: 35 kV a 15 % de umidade, ~1,5 kV a 80 %. */
export const bodyVsat = (U: number) => 35e3 * Math.exp(-(U - 15) / 20);
/** Resistência do sapato/carpete para a terra. */
export const shoeResistance = (U: number) => 1e12 * Math.exp(-(U - 15) / 15);
/** Resistência do corpo no modelo de descarga humana (HBM). */
export const BODY_R = 1500;

// ---------------------------------------------------------------------------
// Poder das pontas e para-raios
// ---------------------------------------------------------------------------

/** Fator de intensificação de campo na ponta de uma haste de altura h e raio de ponta r. */
export const tipEnhancement = (h: number, r: number) => 2 + h / r;

/** Campo de início do corona (lei de Peek para esferas), r em metros, δ = 1. */
export const peekField = (r: number) => 3.1e6 * (1 + 0.308 / Math.sqrt(r * 100));

/** Raio da esfera rolante / distância de descarga final: r_s = 10 I^0,65 (I em kA). */
export const strikeDistance = (IkA: number) => 10 * Math.pow(IkA, 0.65);

/** Raio protegido no solo por uma haste de altura h (método da esfera rolante). */
export function protectedRadius(h: number, rs: number): number {
  const hh = Math.min(h, rs);
  return Math.sqrt(hh * (2 * rs - hh));
}

export interface Target {
  kind: "haste" | "casa" | "solo";
  x: number;
  y: number;
  d: number;
}

export interface Scene {
  mastX: number;
  mastH: number;
  houseX: number;
  houseW: number;
  houseH: number;
}

/** Ponto de cada objeto mais próximo da ponta do líder (x, y). */
export function nearestTargets(sc: Scene, x: number, y: number): Target[] {
  const out: Target[] = [];
  out.push({ kind: "solo", x, y: 0, d: y });
  const hx = Math.min(Math.max(x, sc.houseX - sc.houseW / 2), sc.houseX + sc.houseW / 2);
  const hy = Math.min(y, sc.houseH);
  out.push({ kind: "casa", x: hx, y: hy, d: Math.hypot(x - hx, y - hy) });
  if (sc.mastH > 0) {
    const my = Math.min(y, sc.mastH);
    out.push({ kind: "haste", x: sc.mastX, y: sc.mastH, d: Math.hypot(x - sc.mastX, y - my) });
  }
  return out;
}

/** Líder vertical descendo em x: devolve o primeiro objeto alcançado a r_s. */
export function strikeTarget(sc: Scene, x: number, rs: number, y0 = 400): Target {
  for (let y = y0; y > 0; y -= 0.25) {
    const ts = nearestTargets(sc, x, y).filter((t) => t.d <= rs);
    if (ts.length) return ts.reduce((a, b) => (b.d < a.d ? b : a));
  }
  return { kind: "solo", x, y: 0, d: 0 };
}
