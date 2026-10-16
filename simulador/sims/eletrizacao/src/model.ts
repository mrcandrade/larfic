// Modelo da eletrização: série triboelétrica, partilha por contato, indução num
// eletroscópio de folhas e equilíbrio das folhas. Geometria em cm, cargas em nC.
import { K_COULOMB } from "@fisilab/core";

export const G = 9.81;

/** Série triboelétrica (do topo, que tende a perder elétrons, para a base, que tende a ganhar). */
export const SERIES = [
  "Pele de coelho",
  "Vidro",
  "Cabelo humano",
  "Lã",
  "Seda",
  "Papel",
  "Algodão",
  "Borracha (ebonite)",
  "PVC",
  "Teflon",
] as const;

/** Carga de saturação por posição de diferença na série (nC). */
export const Q_PER_STEP = 3;
/** Comprimento de esfregação (cm) que leva 63 % do caminho até a saturação. */
export const RUB_LENGTH = 60;
/** Raio da esfera do eletroscópio (cm). */
export const R_KNOB = 1.5;
/** Raio da esfera equivalente ao eletroscópio inteiro, para a partilha por contato (cm). */
export const R_ELETROSCOPIO = 2;
/** Carga (nC) representada por cada símbolo + ou − no desenho. */
export const Q_TOKEN = 1;

/**
 * Carga final do bastão ao ser esfregado no pano: o material mais alto na série
 * perde elétrons e fica positivo. Proporcional à distância entre eles na série.
 */
export const tribEquilibrium = (rod: number, cloth: number) => Q_PER_STEP * (cloth - rod);

/**
 * Transferência de carga para o bastão depois de esfregar `ds` cm (a do pano é o
 * oposto: a carga total se conserva). Aproximação exponencial da saturação.
 */
export function rubTransfer(qRod: number, rod: number, cloth: number, ds: number): number {
  const qEq = tribEquilibrium(rod, cloth);
  return (qEq - qRod) * (1 - Math.exp(-Math.abs(ds) / RUB_LENGTH));
}

/** Partilha por contato entre dois condutores esféricos: o potencial kQ/R se iguala. */
export function contactShare(q1: number, r1: number, q2: number, r2: number): [number, number] {
  const tot = q1 + q2;
  return [(tot * r1) / (r1 + r2), (tot * r2) / (r1 + r2)];
}

/**
 * Separação de cargas induzida no eletroscópio por uma carga Q a d cm da esfera:
 * a esfera fica com −s e as folhas com +s. Com s = QR/(2d), aterrar as folhas deixa
 * no eletroscópio −QR/d, a carga imagem de uma esfera aterrada de raio R.
 */
export const inducedSeparation = (Q: number, d: number) => (Q * R_KNOB) / (2 * Math.max(d, R_KNOB + 0.3));

/** Distribuição da carga líquida qE do eletroscópio com separação induzida s. */
export const knobCharge = (qE: number, s: number) => qE / 2 - s;
export const leavesCharge = (qE: number, s: number) => qE / 2 + s;

/**
 * Abertura de cada folha (rad, em relação à vertical): cada folha tem carga q/2 e
 * massa m; separação 2L sen θ. Equilíbrio: k(q/2)²/(2L sen θ)² = m g tg θ.
 * qNC em nC, L em cm, m em mg.
 */
export function leafAngle(qNC: number, Lcm: number, mMg: number): number {
  const q = Math.abs(qNC) * 1e-9;
  if (q < 1e-15) return 0;
  const L = Lcm / 100;
  const m = mMg * 1e-6;
  const f = (th: number) => m * G * Math.tan(th) * 16 * L * L * Math.sin(th) ** 2 - K_COULOMB * q * q;
  let lo = 0;
  let hi = Math.PI / 2 - 1e-9;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (f(mid) > 0) hi = mid;
    else lo = mid;
  }
  return (lo + hi) / 2;
}

/** Inverso: carga total nas folhas (nC) que produz a abertura θ (rad). */
export function chargeForAngle(th: number, Lcm: number, mMg: number): number {
  const L = Lcm / 100;
  const m = mMg * 1e-6;
  return 4 * L * Math.sin(th) * Math.sqrt((m * G * Math.tan(th)) / K_COULOMB) * 1e9;
}

/** Campo (N/C) de uma carga qNC (nC) em (x0, y0) cm no ponto (x, y) cm. */
export function pointField(qNC: number, x0: number, y0: number, x: number, y: number): [number, number] {
  const dx = (x - x0) / 100;
  const dy = (y - y0) / 100;
  const r2 = Math.max(dx * dx + dy * dy, 1e-6);
  const k = (K_COULOMB * qNC * 1e-9) / (r2 * Math.sqrt(r2));
  return [k * dx, k * dy];
}
