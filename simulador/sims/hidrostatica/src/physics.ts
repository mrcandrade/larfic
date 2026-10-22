import { num, type Params } from "@fisilab/core";

export const P_ATM = 101_325;

/** Líquidos disponíveis (o valor da opção é a densidade em kg/m³). */
export const LIQUIDS: { rho: number; name: string }[] = [
  { rho: 720, name: "Gasolina" },
  { rho: 900, name: "Óleo" },
  { rho: 1000, name: "Água" },
  { rho: 1260, name: "Glicerina" },
  { rho: 13_600, name: "Mercúrio" },
];

export const liquidName = (rho: number) => LIQUIDS.find((l) => Math.abs(l.rho - rho) < 1)?.name ?? `ρ = ${Math.round(rho)} kg/m³`;

export interface Layer {
  rho: number;
  h: number;
  name: string;
  /** Índice do controle de origem (1, 2 ou 3). */
  src: number;
}

/**
 * Camadas de cima para baixo. Líquidos imiscíveis se organizam por densidade:
 * o mais leve fica em cima (ordenação estável).
 */
export function layersOf(p: Params): { layers: Layer[]; reordered: boolean } {
  const n = Math.max(1, Math.min(3, Math.round(num(p, "n", 2))));
  const raw: Layer[] = [];
  for (let i = 1; i <= n; i++) {
    const rho = num(p, `rho${i}`, 1000);
    raw.push({ rho, h: num(p, `h${i}`, 0.3), name: liquidName(rho), src: i });
  }
  const layers = raw.slice().sort((a, b) => a.rho - b.rho);
  return { layers, reordered: layers.some((l, i) => l !== raw[i]) };
}

export const totalDepth = (layers: Layer[]) => layers.reduce((s, l) => s + l.h, 0);

/** Pressão na superfície livre: atmosférica (absoluta) ou zero (manométrica). */
export const surfacePressure = (p: Params) => (Math.round(num(p, "ref", 0)) === 1 ? 0 : P_ATM);

/** p(profundidade) somando ρ g Δh camada por camada. */
export function pressureAtDepth(layers: Layer[], depth: number, p0: number, g: number): number {
  let p = p0;
  let top = 0;
  for (const l of layers) {
    const dz = Math.max(0, Math.min(depth, top + l.h) - top);
    p += l.rho * g * dz;
    top += l.h;
    if (depth <= top) break;
  }
  return p;
}

// ---------- Manômetro em U ----------

/** Geometria do tubo em U (m): braços em x = XL e XR, fundo em y = 0, topo em y = TOP. */
export const MAN = { XL: 0.35, XR: 0.95, TOP: 1.4, Z0: 0.6, margin: 0.05 };
/** Comprimento da coluna do líquido manométrico ao longo do tubo. */
export const L_B = 2 * MAN.Z0 + (MAN.XR - MAN.XL);

export interface ManParams {
  pg: number; // Pa (manométrica do gás)
  rhoA: number;
  hA: number;
  rhoB: number;
  g: number;
  zeta: number;
}

export function manParams(p: Params): ManParams {
  return {
    pg: num(p, "pg", 2) * 1000,
    rhoA: num(p, "rhoA", 900),
    hA: num(p, "hA", 0),
    rhoB: num(p, "rhoB", 1000),
    g: num(p, "g", 9.81),
    zeta: num(p, "zeta", 0.15),
  };
}

/** Deslocamento de equilíbrio x (o líquido B sobe x no braço direito e desce x no esquerdo). */
export const manEquilibrium = (m: ManParams) => (m.pg + m.rhoA * m.g * m.hA) / (2 * m.rhoB * m.g);

export const manOmega = (m: ManParams) => Math.sqrt((2 * m.rhoB * m.g) / (m.rhoA * m.hA + m.rhoB * L_B));

/** Limites de x para o líquido não sair do tubo. */
export function manLimits(m: ManParams): [number, number] {
  const lo = Math.max(MAN.Z0 + m.hA - (MAN.TOP - MAN.margin), -(MAN.Z0 - MAN.margin));
  const hi = Math.min(MAN.Z0 - MAN.margin, MAN.TOP - MAN.margin - MAN.Z0);
  return [lo, hi];
}

/** Coluna inteira (A + B) se move junta: (ρA hA + ρB L) x'' = pg + ρA g hA − 2ρB g x − amortecimento. */
export function manDeriv(x: number, v: number, m: ManParams): [number, number] {
  const mu = m.rhoA * m.hA + m.rhoB * L_B;
  const w = manOmega(m);
  return [v, (m.pg + m.rhoA * m.g * m.hA - 2 * m.rhoB * m.g * x) / mu - 2 * m.zeta * w * v];
}

/** Pressão do gás deduzida das alturas lidas: pg = ρB g Δz − ρA g hA. */
export const manReading = (x: number, m: ManParams) => m.rhoB * m.g * 2 * x - m.rhoA * m.g * m.hA;

// ---------- Prensa hidráulica ----------

/** Coeficiente de atrito viscoso efetivo dos pistões (N·s/m). */
export const PRESS_B = 1e5;
/** Curso máximo do pistão pequeno (m). */
export const STROKE = 1.0;

export interface PressParams {
  F1: number;
  A1: number;
  A2: number;
  M: number;
  g: number;
}

export function pressParams(p: Params): PressParams {
  const d1 = num(p, "d1", 4) / 100;
  const d2 = num(p, "d2", 16) / 100;
  return { F1: num(p, "F1", 250), A1: (Math.PI * d1 * d1) / 4, A2: (Math.PI * d2 * d2) / 4, M: num(p, "M", 200), g: num(p, "g", 9.81) };
}

export const pressMax = (q: PressParams) => Math.min(0.4, (STROKE * q.A1) / q.A2);
/** Força mínima no pistão pequeno para equilibrar a carga. */
export const pressF1eq = (q: PressParams) => (q.M * q.g * q.A1) / q.A2;

/**
 * Carga M sobre o pistão grande (pistões leves, fluido incompressível):
 * M a = F1 A2/A1 − M g − b v. Solução exata para força constante.
 */
export function pressStep(d2: number, v2: number, q: PressParams, dt: number): [number, number] {
  const a0 = (q.F1 * q.A2) / q.A1 / q.M - q.g;
  const k = PRESS_B / q.M;
  const vt = a0 / k;
  const e = Math.exp(-k * dt);
  let v = vt + (v2 - vt) * e;
  let d = d2 + vt * dt + ((v2 - vt) * (1 - e)) / k;
  const dmax = pressMax(q);
  if (d >= dmax) {
    d = dmax;
    v = 0;
  } else if (d <= 0) {
    d = 0;
    v = 0;
  }
  return [d, v];
}
