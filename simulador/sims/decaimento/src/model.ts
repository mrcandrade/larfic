import { num, rng, type Params } from "@fisilab/core";

/** Meia-vida do carbono-14, em anos. */
export const C14_HALF_LIFE = 5730;
/** No modo de datação, 1 s de simulação representa 1000 anos. */
export const YEARS_PER_SECOND = 1000;
export const DT = 0.01;

export const MODO_SIMPLES = 0;
export const MODO_CADEIA = 1;
export const MODO_DATACAO = 2;

/** Estados de cada núcleo na grade. */
export const PAI = 0;
export const FILHO = 1;
export const ESTAVEL = 2;

export interface DecayState {
  /** Um núcleo por célula: 0 pai, 1 filho, 2 estável (neto, na cadeia). */
  cells: Uint8Array;
  /** Passos dados. */
  k: number;
  NP: number;
  ND: number;
  NS: number;
  /** Decaimentos do pai detectados no intervalo de contagem atual. */
  bin: number;
  /** Contagens de cada intervalo já concluído. */
  counts: number[];
  /** Núcleos-pai e filhos no início de cada intervalo (índice 0 = t = 0). */
  Nhist: number[];
  NDhist: number[];
}

export const modo = (p: Params) => Math.round(num(p, "modo"));

/** Meia-vida do pai em segundos de simulação. */
export const halfLife = (p: Params) => (modo(p) === MODO_DATACAO ? C14_HALF_LIFE / YEARS_PER_SECOND : num(p, "meiaVida", 5));
export const halfLife2 = (p: Params) => num(p, "meiaVida2", 2);
export const lambda1 = (p: Params) => Math.LN2 / halfLife(p);
export const lambda2 = (p: Params) => Math.LN2 / halfLife2(p);
export const cellCount = (p: Params) => Math.max(1, Math.round(num(p, "N0", 2500)));

/** Idade (anos) da amostra fóssil nº k: escolhida por um embaralhamento fixo, entre 1500 e 30 000 anos. */
export function sampleAge(k: number): number {
  const h = Math.imul(Math.round(k) ^ 0x5bd1e995, 0x27d4eb2d) >>> 0;
  return 1500 + Math.round(((h % 28500) / 100)) * 100;
}

/** Passos por intervalo de contagem (cerca de T½/5, mínimo 0,1 s; 1000 anos na datação). */
export function binSteps(p: Params): number {
  if (modo(p) === MODO_DATACAO) return 100;
  return Math.max(10, Math.round(halfLife(p) / 5 / DT));
}
export const binWidth = (p: Params) => binSteps(p) * DT;

/** Duração da corrida: cerca de cinco meias-vidas da espécie mais lenta. */
export function tStop(p: Params): number {
  const T1 = halfLife(p);
  if (modo(p) === MODO_CADEIA) return 5 * Math.max(T1, halfLife2(p));
  return 5 * T1;
}

/** Número esperado de pais em t = 0 (na datação, o que sobrou desde a morte do organismo). */
export function expectedStart(p: Params): number {
  const n = cellCount(p);
  if (modo(p) !== MODO_DATACAO) return n;
  return n * Math.exp(-(Math.LN2 / C14_HALF_LIFE) * sampleAge(num(p, "amostra", 1)));
}

/** N_pai(t) esperado. */
export const parentTheory = (p: Params, t: number) => expectedStart(p) * Math.exp(-lambda1(p) * t);

/** N_filho(t) esperado na cadeia pai → filho → estável (equações de Bateman). */
export function daughterTheory(p: Params, t: number): number {
  const l1 = lambda1(p);
  const l2 = lambda2(p);
  const N0 = expectedStart(p);
  if (Math.abs(l1 - l2) < 1e-12 * l1) return N0 * l1 * t * Math.exp(-l1 * t);
  return ((N0 * l1) / (l2 - l1)) * (Math.exp(-l1 * t) - Math.exp(-l2 * t));
}

/** Gerador uniforme determinístico para o passo k (sem guardar estado do gerador). */
const stepRng = (seed: number, k: number) => rng((Math.imul(seed | 0, 0x9e3779b1) ^ Math.imul(k + 1, 0x85ebca6b)) >>> 0);

export function initState(p: Params): DecayState {
  const n = cellCount(p);
  const cells = new Uint8Array(n);
  if (modo(p) === MODO_DATACAO) {
    // Amostra fóssil: cada C-14 sobreviveu com probabilidade e^(−λ·idade); os outros já viraram N-14.
    const r = rng(Math.round(num(p, "seed", 1)) * 7919 + 13);
    const keep = Math.exp(-(Math.LN2 / C14_HALF_LIFE) * sampleAge(num(p, "amostra", 1)));
    for (let i = 0; i < n; i++) cells[i] = r() < keep ? PAI : FILHO;
  }
  let NP = 0;
  for (let i = 0; i < n; i++) if (cells[i] === PAI) NP++;
  return { cells, k: 0, NP, ND: n - NP, NS: 0, bin: 0, counts: [], Nhist: [NP], NDhist: [n - NP] };
}

/**
 * Um passo de Monte Carlo: cada núcleo decai independentemente com
 * probabilidade p = 1 − e^(−λ dt). Em vez de sortear um número por núcleo,
 * sorteia a distância geométrica até o próximo núcleo sorteado (mesma
 * estatística, custo proporcional ao número de decaimentos).
 */
export function decayStep(s: DecayState, p: Params, dt: number): DecayState {
  const r = stepRng(Math.round(num(p, "seed", 1)), s.k);
  const cells = s.cells.slice();
  const n = cells.length;
  const chain = modo(p) === MODO_CADEIA;
  let { NP, ND, NS, bin } = s;

  const sweep = (prob: number, from: number, to: number) => {
    if (prob <= 0) return 0;
    const lq = Math.log1p(-Math.min(prob, 1 - 1e-12));
    let changed = 0;
    let i = Math.floor(Math.log(1 - r()) / lq);
    while (i < n) {
      if (cells[i] === from) {
        cells[i] = to;
        changed++;
      }
      i += 1 + Math.floor(Math.log(1 - r()) / lq);
    }
    return changed;
  };

  // Filhos primeiro (os que acabaram de nascer neste passo não decaem no mesmo passo).
  if (chain) {
    const d2 = sweep(-Math.expm1(-lambda2(p) * dt), FILHO, ESTAVEL);
    ND -= d2;
    NS += d2;
  }
  const d1 = sweep(-Math.expm1(-lambda1(p) * dt), PAI, FILHO);
  NP -= d1;
  ND += d1;
  bin += d1;

  const k = s.k + 1;
  let { counts, Nhist, NDhist } = s;
  if (k % binSteps(p) === 0) {
    counts = [...counts, bin];
    Nhist = [...Nhist, NP];
    NDhist = [...NDhist, ND];
    bin = 0;
  }
  return { cells, k, NP, ND, NS, bin, counts, Nhist, NDhist };
}

export interface Fit {
  lambda: number;
  sigma: number;
  lnN0: number;
  n: number;
}

/**
 * Ajuste linear ponderado de ln N × t (peso N, pois var(ln N) ≈ 1/N).
 * A incerteza de λ vem da dispersão dos resíduos.
 */
export function fitExp(ts: number[], Ns: number[]): Fit | undefined {
  let S = 0, Sx = 0, Sy = 0;
  const pts: [number, number, number][] = [];
  ts.forEach((t, i) => {
    const N = Ns[i] ?? 0;
    if (N > 0) pts.push([t, Math.log(N), N]);
  });
  if (pts.length < 3) return undefined;
  for (const [x, y, w] of pts) {
    S += w;
    Sx += w * x;
    Sy += w * y;
  }
  const xm = Sx / S;
  const ym = Sy / S;
  let Sxx = 0, Sxy = 0;
  for (const [x, y, w] of pts) {
    Sxx += w * (x - xm) ** 2;
    Sxy += w * (x - xm) * (y - ym);
  }
  if (Sxx <= 0) return undefined;
  const b = Sxy / Sxx;
  const a = ym - b * xm;
  let chi = 0;
  for (const [x, y, w] of pts) chi += w * (y - a - b * x) ** 2;
  // Resíduos de N cumulativo são correlacionados; o piso de Poisson evita incerteza nula.
  const s2 = Math.max(chi / (pts.length - 2), 1);
  return { lambda: -b, sigma: Math.sqrt(s2 / Sxx), lnN0: a, n: pts.length };
}

export function fitOf(s: DecayState, p: Params): Fit | undefined {
  const w = binWidth(p);
  return fitExp(s.Nhist.map((_, i) => i * w), s.Nhist);
}

/** Idade (anos) estimada pela razão C-14 restante / C-14 de um organismo vivo. */
export function datingAge(N: number, Nliving: number): number {
  return (C14_HALF_LIFE / Math.LN2) * Math.log(Nliving / Math.max(N, 1e-9));
}
