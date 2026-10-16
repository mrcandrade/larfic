import { num, type Params } from "@fisilab/core";

/** Estado (vetor). */
export const T = 0, // tempo (s)
  I = 1, // corrente no indutor (A), sentido horário no desenho
  Q = 2, // carga na placa esquerda (superior) do capacitor (C)
  SW = 3, // chave do RL: 1 = A (fonte ligada), 0 = B (curto)
  WR = 4, // energia dissipada no resistor (J)
  WS = 5, // trabalho da fonte (J)
  FLOW = 6; // carga que passou pelo fio, ∫ i dt (C): anima os portadores

export const RL = 0,
  LC = 1,
  RLC = 2;

export const mode = (p: Params) => Math.round(num(p, "circuito"));
export const V0 = (p: Params) => num(p, "V0", 6);
/** Resistência efetiva: no LC ideal ela é zero. */
export const R = (p: Params) => (mode(p) === LC ? 0 : num(p, "R", 10));
export const L = (p: Params) => num(p, "L", 1);
export const C = (p: Params) => num(p, "C", 1000) * 1e-6;
export const omega0 = (p: Params) => 1 / Math.sqrt(L(p) * C(p));
export const alpha = (p: Params) => R(p) / (2 * L(p));
export const tauRL = (p: Params) => L(p) / Math.max(R(p), 1e-12);
export const sourceV = (p: Params, s: number[]) => (mode(p) === RL && s[SW]! >= 0.5 ? V0(p) : 0);

/** di/dt pela lei das malhas. */
export function didt(s: number[], p: Params): number {
  if (mode(p) === RL) return (sourceV(p, s) - R(p) * s[I]!) / L(p);
  // Laço no sentido horário: q/C − L di/dt − R i = 0 (i sai da placa superior).
  return (s[Q]! / C(p) - R(p) * s[I]!) / L(p);
}

/** Passo exato do RL com fonte constante: i → i∞ + (i − i∞) e^{−h/τ}, com integrais fechadas de Ri² e Vs·i. */
function stepRL(s: number[], p: Params, h: number): number[] {
  const out = s.slice();
  const r = R(p);
  const vs = sourceV(p, s);
  const tc = L(p) / r;
  const iInf = vs / r;
  const d = s[I]! - iInf;
  const e = Math.exp(-h / tc);
  const intI = iInf * h + d * tc * (1 - e);
  const intI2 = iInf * iInf * h + 2 * iInf * d * tc * (1 - e) + ((d * d * tc) / 2) * (1 - e * e);
  out[I] = iInf + d * e;
  out[WR]! += r * intI2;
  out[WS]! += vs * intI;
  out[FLOW]! += intI;
  out[T]! += h;
  return out;
}

/**
 * Evolução exata do laço RLC livre: x = [q, i], x' = A x com
 * A = [[0, 1], [−ω0², −2α]]. e^{Ah} = e^{−αh}[c·Id + s·(A + α Id)], com
 * c = cos βh, s = sin(βh)/β no subamortecido (β² = ω0² − α² > 0) e as
 * versões hiperbólicas no superamortecido.
 */
export function freeLoop(q: number, i: number, p: Params, h: number): [number, number] {
  const w2 = 1 / (L(p) * C(p));
  const a = alpha(p);
  const b2 = w2 - a * a;
  let c: number;
  let sn: number;
  if (b2 > 1e-12 * w2) {
    const b = Math.sqrt(b2);
    c = Math.cos(b * h);
    sn = Math.sin(b * h) / b;
  } else if (b2 < -1e-12 * w2) {
    const g = Math.sqrt(-b2);
    c = Math.cosh(g * h);
    sn = Math.sinh(g * h) / g;
  } else {
    c = 1;
    sn = h;
  }
  const e = Math.exp(-a * h);
  // (A + αI) = [[α, 1], [−ω0², −α]]
  return [e * (c * q + sn * (a * q + i)), e * (c * i + sn * (-w2 * q - a * i))];
}

function stepLoop(s: number[], p: Params, h: number): number[] {
  const out = s.slice();
  const q0 = s[Q]!;
  const i0 = s[I]!;
  // freeLoop usa i = dq/dt; a corrente horária do estado é −dq/dt.
  const [qm, im] = freeLoop(q0, -i0, p, h / 2);
  const [q1, i1] = freeLoop(q0, -i0, p, h);
  // Simpson com o ponto médio exato: erro O(h⁵) na energia dissipada.
  out[WR]! += (R(p) * h * (i0 * i0 + 4 * im * im + i1 * i1)) / 6;
  out[Q] = q1;
  out[I] = -i1;
  // No laço, a corrente horária descarrega a placa superior: ∫ i dt = −Δq.
  out[FLOW]! += q0 - q1;
  out[T]! += h;
  return out;
}

export function step(s: number[], p: Params, dt: number): number[] {
  return mode(p) === RL ? stepRL(s, p, dt) : stepLoop(s, p, dt);
}

export function init(p: Params): number[] {
  if (mode(p) === RL) return [0, 0, 0, 1, 0, 0, 0];
  return [0, 0, C(p) * V0(p), 0, 0, 0, 0];
}

export const UE = (s: number[], p: Params) => (mode(p) === RL ? 0 : (s[Q]! * s[Q]!) / (2 * C(p)));
export const UB = (s: number[], p: Params) => 0.5 * L(p) * s[I]! * s[I]!;

/** Liga a chave do RL em A (1) ou B (0). */
export function setSwitch(s: number[], p: Params, pos: 0 | 1): number[] {
  if (mode(p) !== RL || Math.round(s[SW]!) === pos) return s;
  const out = s.slice();
  out[SW] = pos;
  return out;
}
