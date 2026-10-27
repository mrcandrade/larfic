import { num, type Params } from "@fisilab/core";

/**
 * Estado (vetor): tempo, tensão no capacitor, posição da chave, disparo do
 * osciloscópio, cursores e balanço de energia.
 */
export const T = 0, // tempo físico (s)
  VC = 1, // tensão no capacitor (V)
  SW = 2, // chave: 1 = posição A (fonte, carga), 0 = posição B (curto, descarga)
  TT = 3, // instante do último disparo do osciloscópio (s)
  VT = 4, // V_C no instante do disparo (V)
  C1 = 5, // cursor 1, em divisões (0–10)
  C2 = 6, // cursor 2, em divisões (0–10)
  DRAG = 7, // cursor sendo arrastado (0 nenhum, 1, 2)
  WR = 8, // energia dissipada no resistor (J)
  WS = 9; // trabalho realizado pela fonte (J)

export const DIVX = 10;
export const DIVY = 8;

export const R = (p: Params) => num(p, "R", 1000);
export const C = (p: Params) => num(p, "C", 100) * 1e-6;
export const V0 = (p: Params) => num(p, "V0", 5);
export const tau = (p: Params) => R(p) * C(p);
export const squareMode = (p: Params) => Math.round(num(p, "modo")) === 1;
/** Janela do osciloscópio (10 divisões), em segundos. */
export const windowS = (p: Params) => (DIVX * num(p, "msdiv", 50)) / 1000;

/** Tensão da fonte no instante t (meio-ciclo alto primeiro na onda quadrada). */
export function sourceV(p: Params, t: number, sw: number): number {
  if (squareMode(p)) {
    const f = num(p, "f", 2);
    const ph = t * f - Math.floor(t * f + 1e-12);
    return ph < 0.5 - 1e-12 ? V0(p) : 0;
  }
  return sw >= 0.5 ? V0(p) : 0;
}

/** Próxima borda da onda quadrada estritamente depois de t. */
function nextEdge(p: Params, t: number): number {
  if (!squareMode(p)) return Infinity;
  const half = 0.5 / num(p, "f", 2);
  return (Math.floor(t / half + 1e-9) + 1) * half;
}

export interface Adv {
  vc: number;
  wr: number;
  ws: number;
}

/**
 * Solução exata de RC dV/dt = Vs − V entre t0 e t1, quebrando o intervalo nas
 * bordas da onda quadrada: V(t) = Vs + (V − Vs)·e^{−Δt/τ}. Também integra, em
 * forma fechada, a energia dissipada (∫Ri²dt) e o trabalho da fonte (∫Vs i dt).
 */
export function advance(p: Params, vc: number, sw: number, t0: number, t1: number): Adv {
  const r = R(p);
  const c = C(p);
  const tc = r * c;
  let t = t0;
  let wr = 0;
  let ws = 0;
  while (t < t1 - 1e-15) {
    const te = Math.min(nextEdge(p, t), t1);
    const h = te - t;
    const vs = sourceV(p, t + h / 2, sw);
    const d0 = vs - vc;
    const e = Math.exp(-h / tc);
    const v1 = vs - d0 * e;
    wr += ((d0 * d0) / r) * (tc / 2) * (1 - e * e);
    ws += vs * c * (v1 - vc);
    vc = v1;
    t = te;
  }
  return { vc, wr, ws };
}

/** Intervalo entre disparos na onda quadrada: um número inteiro de períodos que cobre a tela. */
export function triggerInterval(p: Params): number {
  const f = num(p, "f", 2);
  const n = Math.max(1, Math.ceil(windowS(p) * f - 1e-9));
  return n / f;
}

export function step(s: number[], p: Params, dt: number): number[] {
  const out = s.slice();
  let t = s[T]!;
  const t1 = t + dt;
  if (squareMode(p)) {
    const ti = triggerInterval(p);
    const tn = (Math.floor(s[TT]! / ti + 1e-9) + 1) * ti;
    const next = tn > t ? tn : (Math.floor(t / ti + 1e-9) + 1) * ti;
    if (next <= t1 + 1e-12) {
      const a = advance(p, out[VC]!, out[SW]!, t, next);
      out[VC] = a.vc;
      out[WR]! += a.wr;
      out[WS]! += a.ws;
      out[TT] = next;
      out[VT] = a.vc;
      t = next;
    }
  }
  const a = advance(p, out[VC]!, out[SW]!, t, t1);
  out[VC] = a.vc;
  out[WR]! += a.wr;
  out[WS]! += a.ws;
  out[T] = t1;
  return out;
}

export function init(p: Params): number[] {
  const charged = Math.round(num(p, "inicio")) === 1 && !squareMode(p);
  const v = charged ? V0(p) : 0;
  return [0, v, charged ? 0 : 1, 0, v, 0, 1, 0, 0, 0];
}

/** Liga a chave em A (carga) ou B (descarga) e dispara o osciloscópio. */
export function setSwitch(s: number[], p: Params, pos: 0 | 1): number[] {
  if (squareMode(p) || Math.round(s[SW]!) === pos) return s;
  const out = s.slice();
  out[SW] = pos;
  out[TT] = s[T]!;
  out[VT] = s[VC]!;
  return out;
}

/** V_C no instante t (≥ disparo), reconstruído exatamente a partir do disparo. */
export function vcAt(s: number[], p: Params, t: number): number {
  const t0 = s[TT]!;
  if (t < t0 - 1e-12 || t > s[T]! + 1e-12) return NaN;
  return advance(p, s[VT]!, s[SW]!, t0, t).vc;
}

/** Traço do osciloscópio: amostras (t relativo ao disparo, V_C, V_fonte) até o instante atual. */
export function trace(s: number[], p: Params, n = 600): { t: number; vc: number; vs: number }[] {
  const t0 = s[TT]!;
  const win = windowS(p);
  const tEnd = Math.min(s[T]!, t0 + win);
  const pts: { t: number; vc: number; vs: number }[] = [];
  let vc = s[VT]!;
  let tPrev = t0;
  const sw = s[SW]!;
  for (let k = 0; k <= n; k++) {
    const t = t0 + (win * k) / n;
    if (t > tEnd + 1e-12) {
      if (tPrev < tEnd - 1e-12) {
        vc = advance(p, vc, sw, tPrev, tEnd).vc;
        pts.push({ t: tEnd - t0, vc, vs: sourceV(p, tEnd - 1e-12, sw) });
      }
      break;
    }
    // Bordas da onda quadrada entram como pontos extras para o degrau sair vertical.
    if (squareMode(p)) {
      const half = 0.5 / num(p, "f", 2);
      let e = (Math.floor(tPrev / half + 1e-9) + 1) * half;
      while (e < t - 1e-12 && k > 0) {
        vc = advance(p, vc, sw, tPrev, e).vc;
        pts.push({ t: e - t0, vc, vs: sourceV(p, e - 1e-9, sw) });
        pts.push({ t: e - t0, vc, vs: sourceV(p, e + 1e-9, sw) });
        tPrev = e;
        e += half;
      }
    }
    vc = advance(p, vc, sw, tPrev, t).vc;
    pts.push({ t: t - t0, vc, vs: sourceV(p, t + 1e-12, sw) });
    tPrev = t;
  }
  return pts;
}

/** Leitura de um cursor: tempo desde o disparo e V_C no traço (NaN se a varredura ainda não chegou lá). */
export function cursorReading(s: number[], p: Params, which: 1 | 2): { t: number; v: number } {
  const div = s[which === 1 ? C1 : C2]!;
  const t = (div * num(p, "msdiv", 50)) / 1000;
  return { t, v: vcAt(s, p, s[TT]! + t) };
}
