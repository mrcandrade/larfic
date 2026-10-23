/**
 * Modelo de Franck–Hertz: elétrons ganham energia uniformemente entre o cátodo
 * e a grade e, acima de cada limiar de excitação, colidem inelasticamente com
 * livre caminho médio λ (perdendo a energia do nível). Chegam ao ânodo os que
 * vencem o contrapotencial. A curva é obtida por Monte Carlo com números
 * aleatórios comuns a todas as tensões (curva lisa e reprodutível).
 */
import { rng } from "@fisilab/core";

export const KB = 1.380649e-23;
/** hc em eV·nm. */
export const HC = 1239.84198;

export interface Channel {
  /** Energia de excitação (eV). */
  E: number;
  /** Peso relativo da taxa de colisão acima do limiar. */
  w: number;
  /** Emite luz visível ao decair. */
  visible: boolean;
}

export interface Gas {
  name: string;
  channels: Channel[];
  /** Tensão máxima da varredura (V). */
  Umax: number;
  /** Fóton principal (nm). */
  photon: number;
}

export const HG: Gas = {
  name: "Mercúrio",
  channels: [
    { E: 4.89, w: 1, visible: false },
    { E: 6.7, w: 0.35, visible: false },
  ],
  Umax: 30,
  photon: HC / 4.89,
};

export const NE: Gas = {
  name: "Neônio",
  channels: [
    { E: 16.7, w: 0.15, visible: false },
    { E: 18.7, w: 1, visible: true },
  ],
  Umax: 80,
  photon: HC / (18.7 - 16.7),
};

/** Distância cátodo–grade (m). */
export const L_TUBE = 8e-3;
/** Seção de choque efetiva de excitação do Hg (m²). */
export const SIGMA_HG = 2.2e-20;
/** λ/L fixo do tubo de neônio (gás a alguns hPa, sem forno). */
export const LAMBDA_NE = 0.05;
/** Energia térmica dos elétrons emitidos pelo cátodo (eV). */
export const KT_CATHODE = 0.1;

/** Pressão de vapor do mercúrio (Pa), T em °C. */
export const hgPressure = (Tc: number) => 10 ** (10.122 - 3190 / (Tc + 273.15));

/** Livre caminho médio de excitação em unidades da distância cátodo–grade. */
export function lambdaRel(gas: Gas, Tc: number): number {
  if (gas === NE) return LAMBDA_NE;
  const T = Tc + 273.15;
  return (KB * T) / (hgPressure(Tc) * SIGMA_HG) / L_TUBE;
}

export interface Electron {
  /** Energia ao chegar à grade (eV). */
  Ef: number;
  /** Posições (0..1) e canais das colisões inelásticas. */
  hits: { x: number; ch: number }[];
}

const NR = 48;

/** Números aleatórios fixos por elétron (números aleatórios comuns). */
export function randomBank(n: number, seed = 1914): Float64Array {
  const r = rng(seed);
  const a = new Float64Array(n * NR);
  for (let i = 0; i < a.length; i++) a[i] = Math.max(1e-12, r());
  return a;
}

/** Percorre um elétron do cátodo (x = 0) à grade (x = 1) com tensão efetiva U (V). */
export function runElectron(gas: Gas, lam: number, U: number, bank: Float64Array, i: number, record = false): Electron {
  let k = i * NR;
  const end = k + NR;
  const next = () => {
    const v = bank[k]!;
    k = k + 1 < end ? k + 1 : i * NR + 2;
    return v;
  };
  let E = -KT_CATHODE * Math.log(next() * next());
  let x = 0;
  const g = U;
  let tau = -Math.log(next());
  const hits: { x: number; ch: number }[] = [];
  if (g <= 0) return { Ef: E + g, hits };
  for (let it = 0; it < 400 && x < 1; it++) {
    let R = 0;
    let Enext = Infinity;
    for (const c of gas.channels) {
      if (E >= c.E) R += c.w / lam;
      else Enext = Math.min(Enext, c.E);
    }
    const dxth = Number.isFinite(Enext) ? (Enext - E) / g : Infinity;
    const lim = Math.min(dxth, 1 - x);
    const dc = R > 0 ? tau / R : Infinity;
    if (dc < lim) {
      x += dc;
      E += g * dc;
      let u = next() * R;
      let ch = 0;
      for (let j = 0; j < gas.channels.length; j++) {
        const c = gas.channels[j]!;
        if (E < c.E) continue;
        ch = j;
        u -= c.w / lam;
        if (u <= 0) break;
      }
      E -= gas.channels[ch]!.E;
      if (record) hits.push({ x, ch });
      tau = -Math.log(next());
    } else {
      tau -= R * lim;
      x += lim;
      E += g * lim;
      if (lim === dxth) E = Math.max(E, Enext);
    }
  }
  return { Ef: E, hits };
}

export interface CurveParams {
  gas: Gas;
  Tc: number;
  /** Contrapotencial (V). */
  Ur: number;
  /** Potencial de contato (V). */
  Uc: number;
}

const N_EL = 300;
const BANK = randomBank(N_EL);

/** Fator de atenuação da corrente pelo espalhamento (vapor mais denso → menos corrente). */
export const attenuation = (gas: Gas, Tc: number) => 1 / (1 + 0.05 / lambdaRel(gas, Tc));

/** Corrente no ânodo (nA, escala arbitrária de laboratório) para a tensão de aceleração U. */
export function anodeCurrent(c: CurveParams, U: number, n = N_EL): number {
  const Ueff = U - c.Uc;
  if (Ueff <= 0) return 0;
  const lam = lambdaRel(c.gas, c.Tc);
  let ok = 0;
  for (let i = 0; i < n; i++) if (runElectron(c.gas, lam, Ueff, BANK, i).Ef > c.Ur) ok++;
  const emission = Math.min(Ueff, c.gas.Umax) ** 1.5 * (c.gas === NE ? 0.35 : 1.2);
  return (emission * attenuation(c.gas, c.Tc) * ok) / n;
}

export interface Curve {
  U: number[];
  I: number[];
}

let cacheKey = "";
let cache: Curve | null = null;

/** Curva I × U completa (com cache). */
export function curve(c: CurveParams): Curve {
  const key = `${c.gas.name}|${c.Tc}|${c.Ur}|${c.Uc}`;
  if (cache && key === cacheKey) return cache;
  const step = c.gas === NE ? 0.25 : 0.1;
  const U: number[] = [];
  const I: number[] = [];
  for (let u = 0; u <= c.gas.Umax + 1e-9; u += step) {
    U.push(u);
    I.push(anodeCurrent(c, u));
  }
  cache = { U, I };
  cacheKey = key;
  return cache;
}

export function interp(cv: Curve, u: number): number {
  const n = cv.U.length;
  if (u <= cv.U[0]!) return cv.I[0]!;
  if (u >= cv.U[n - 1]!) return cv.I[n - 1]!;
  const h = cv.U[1]! - cv.U[0]!;
  const i = Math.min(n - 2, Math.floor((u - cv.U[0]!) / h));
  const f = (u - cv.U[i]!) / h;
  return cv.I[i]! * (1 - f) + cv.I[i + 1]! * f;
}

/** Máximos locais da curva (suavizada), com proeminência mínima relativa. */
export function peaks(cv: Curve, minSep: number): number[] {
  const n = cv.I.length;
  const h = cv.U[1]! - cv.U[0]!;
  const w = Math.max(1, Math.round(0.3 / h));
  const sm = cv.I.map((_, i) => {
    let s = 0;
    let c = 0;
    for (let j = Math.max(0, i - w); j <= Math.min(n - 1, i + w); j++) {
      s += cv.I[j]!;
      c++;
    }
    return s / c;
  });
  const win = Math.max(2, Math.round((minSep * 0.45) / h));
  const out: number[] = [];
  for (let i = win; i < n - win; i++) {
    let isMax = sm[i]! > 0;
    for (let j = i - win; j <= i + win && isMax; j++) if (sm[j]! > sm[i]! || (sm[j] === sm[i] && j < i)) isMax = false;
    if (!isMax) continue;
    // proeminência: precisa cair pelo menos 3 % antes do próximo máximo
    let mn = sm[i]!;
    for (let j = i; j < Math.min(n, i + Math.round(minSep / h)); j++) mn = Math.min(mn, sm[j]!);
    if (mn < sm[i]! * 0.97) out.push(cv.U[i]!);
  }
  return out;
}

/** Espaçamento médio entre picos consecutivos (V); 0 se houver menos de dois. */
export function meanSpacing(pk: number[]): number {
  return pk.length >= 2 ? (pk[pk.length - 1]! - pk[0]!) / (pk.length - 1) : 0;
}

/** Histograma (nb faixas em 0..1) das posições de colisões que emitem luz visível (ou todas, se `all`). */
export function glowProfile(c: CurveParams, U: number, nb = 60, all = false): number[] {
  const out = new Array<number>(nb).fill(0);
  const Ueff = U - c.Uc;
  if (Ueff <= 0) return out;
  const lam = lambdaRel(c.gas, c.Tc);
  for (let i = 0; i < N_EL; i++) {
    for (const h of runElectron(c.gas, lam, Ueff, BANK, i, true).hits) {
      if (!all && !c.gas.channels[h.ch]!.visible) continue;
      out[Math.min(nb - 1, Math.floor(h.x * nb))]!++;
    }
  }
  return out.map((v) => v / N_EL);
}
