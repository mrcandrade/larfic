/** Comprimento de onda de de Broglie e padrão de fenda dupla para elétrons. */

export const H = 6.62607015e-34;
export const E_CHARGE = 1.602176634e-19;
export const M_E = 9.1093837015e-31;
export const C_LIGHT = 299792458;

/** Momento (kg·m/s) de um elétron acelerado por V volts (relativístico). */
export function momentum(V: number): number {
  const K = E_CHARGE * V;
  return Math.sqrt(2 * M_E * K * (1 + K / (2 * M_E * C_LIGHT * C_LIGHT)));
}

/** λ = h/p (m), relativístico. */
export const wavelength = (V: number) => H / momentum(V);
/** λ = h/√(2meV) (m), aproximação não relativística. */
export const wavelengthClassic = (V: number) => H / Math.sqrt(2 * M_E * E_CHARGE * V);

export interface Slits {
  /** Comprimento de onda (m). */
  lambda: number;
  /** Separação entre fendas (m). */
  d: number;
  /** Largura de cada fenda (m). */
  a: number;
  /** Distância fendas–tela (m). */
  L: number;
  /** 0 = fenda dupla, 1 = fenda única. */
  single: boolean;
}

const sinc2 = (x: number) => (Math.abs(x) < 1e-9 ? 1 : (Math.sin(x) / x) ** 2);

/** |ψ|² na tela (máximo 1) com as duas fendas abertas e sem detecção (Fraunhofer). */
export function coherent(y: number, s: Slits): number {
  const k = Math.PI / (s.lambda * s.L);
  const env = sinc2(k * s.a * y);
  return s.single ? env : env * Math.cos(k * s.d * y) ** 2;
}

/** |ψ_k|² de uma só fenda (k = 0 ou 1), centrada em ±d/2. */
export function oneSlit(y: number, s: Slits, k: number): number {
  const c = s.single ? 0 : (k === 0 ? 0.5 : -0.5) * s.d;
  return sinc2((Math.PI * s.a * (y - c)) / (s.lambda * s.L));
}

/** Distribuição com detecção do caminho: soma incoerente das duas fendas. */
export const incoherent = (y: number, s: Slits) => 0.5 * (oneSlit(y, s, 0) + oneSlit(y, s, 1));

/** Espaçamento entre franjas Δy = λL/d. */
export const fringe = (s: Slits) => (s.lambda * s.L) / s.d;

/**
 * Amostra a posição de chegada de um elétron por rejeição dentro de |y| ≤ W.
 * `slit` = −1 sem detecção; 0 ou 1 quando o detector registrou a fenda.
 */
export function sampleHit(rand: () => number, s: Slits, W: number, slit: number): number {
  for (let i = 0; i < 20000; i++) {
    const y = W * (2 * rand() - 1);
    const pr = slit < 0 ? coherent(y, s) : oneSlit(y, s, slit);
    if (rand() < pr) return y;
  }
  return 0;
}

/** Probabilidade (normalizada em |y| ≤ W) de cair em [y1, y2], por Simpson. */
export function binProbability(f: (y: number) => number, y1: number, y2: number, W: number, total?: number): number {
  const simpson = (a: number, b: number, n: number) => {
    const h = (b - a) / n;
    let acc = f(a) + f(b);
    for (let i = 1; i < n; i++) acc += f(a + i * h) * (i % 2 ? 4 : 2);
    return (acc * h) / 3;
  };
  const tot = total ?? simpson(-W, W, 4000);
  return simpson(y1, y2, 8) / tot;
}

/**
 * Visibilidade medida no histograma: compara contagens perto dos máximos
 * (y = mΔy) com as perto dos mínimos (y = (m + ½)Δy), para |m| ≤ 2.
 */
export function visibility(hist: number[], W: number, dy: number): number {
  const nb = hist.length;
  const at = (y: number) => {
    const i = Math.floor(((y + W) / (2 * W)) * nb);
    return hist[Math.max(0, Math.min(nb - 1, i))] ?? 0;
  };
  let mx = 0;
  let mn = 0;
  for (let m = -2; m <= 2; m++) {
    mx += at(m * dy);
    mn += at((m + 0.5) * dy);
  }
  return mx + mn > 0 ? (mx - mn) / (mx + mn) : 0;
}
