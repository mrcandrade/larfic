import { num, type Params } from "@fisilab/core";

/**
 * Bancada de instrumentação: gerador de funções → (circuito RC) → osciloscópio
 * de 2 canais e multímetro. Os sinais são periódicos e calculados em regime
 * permanente de forma exata (a resposta de um RC a um trecho linear da
 * entrada tem solução fechada), então a bancada fica medível no instante em
 * que o aluno liga os instrumentos.
 *
 * Estado (vetor):
 *   T    tempo de parede da simulação (s)
 *   TS0  início da varredura mais recente (s); TS1, TS2: varreduras anteriores (persistência)
 *   TRG  1 se a última varredura foi disparada pelo trigger, 0 se livre, −1 se aguardando disparo
 *   C1, C2  cursores de tempo, em divisões (0–10)
 *   DRAG cursor sendo arrastado (0, 1, 2)
 */
export const T = 0,
  TS0 = 1,
  TS1 = 2,
  TS2 = 3,
  TRG = 4,
  C1 = 5,
  C2 = 6,
  DRAG = 7;

export const NX = 10;
export const NY = 8;

export type Wave = 0 | 1 | 2; // senoidal, quadrada, triangular

export const wave = (p: Params): Wave => Math.min(2, Math.max(0, Math.round(num(p, "onda")))) as Wave;
export const freq = (p: Params) => num(p, "f", 1000);
export const amp = (p: Params) => num(p, "A", 2);
export const offset = (p: Params) => num(p, "off", 0);
export const tauRC = (p: Params) => num(p, "R", 1000) * num(p, "C", 100) * 1e-9;
/** Base de tempo em segundos por divisão (o parâmetro está em ms/div). */
export const sdiv = (p: Params) => num(p, "tdiv", 0.2) * 1e-3;
export const windowS = (p: Params) => NX * sdiv(p);

/** Constante de tempo do acoplamento AC da entrada do osciloscópio (corte em ≈ 3,4 Hz, como 1 MΩ com 47 nF). */
export const TAU_AC = 1e6 * 47e-9;

/** Forma de onda unitária (amplitude 1, média 0) na fase u ∈ [0, 1). */
export function shape(w: Wave, u: number): number {
  const x = u - Math.floor(u);
  if (w === 0) return Math.sin(2 * Math.PI * x);
  if (w === 1) return x < 0.5 ? 1 : -1;
  if (x < 0.25) return 4 * x;
  if (x < 0.75) return 2 - 4 * x;
  return 4 * x - 4;
}

/** Valor eficaz (RMS) da forma unitária. */
export const rmsShape = (w: Wave) => (w === 0 ? Math.SQRT1_2 : w === 1 ? 1 : 1 / Math.sqrt(3));
/** Valor médio do módulo da forma unitária. */
export const meanAbsShape = (w: Wave) => (w === 0 ? 2 / Math.PI : w === 1 ? 1 : 0.5);
/** Fator de forma da senoide: um multímetro de média multiplica o valor médio retificado por π/(2√2) ≈ 1,1107. */
export const FORM_SINE = Math.PI / (2 * Math.SQRT2);

// ---------------------------------------------------------------------------
// Sinais periódicos amostrados por trechos lineares

/** Sinal periódico descrito por N trechos lineares: valor no início (limite à direita) e no fim (limite à esquerda) de cada trecho. */
export interface PWL {
  N: number;
  /** Período (s). */
  P: number;
  a: Float64Array;
  b: Float64Array;
}

const N_SEG = 2048;

/** Amostra a forma unitária em N trechos (N múltiplo de 4: as bordas da quadrada e os vértices do triângulo caem nos nós). */
export function sampleShape(w: Wave, P: number, N = N_SEG): PWL {
  const a = new Float64Array(N);
  const b = new Float64Array(N);
  const eps = 1e-9;
  for (let i = 0; i < N; i++) {
    a[i] = shape(w, i / N + eps);
    b[i] = shape(w, (i + 1) / N - eps);
  }
  return { N, P, a, b };
}

/**
 * Resposta em regime permanente de um passa-baixas RC (constante τ) a um
 * sinal PWL. Em cada trecho a entrada é x(s) = a + k s e a saída é exata:
 * v(s) = a + k(s − τ) + (v₀ − a + kτ) e^{−s/τ}. O valor no início do
 * período sai da condição de periodicidade v(P) = v(0).
 */
export function lowpass(x: PWL, tau: number): PWL {
  const { N, P } = x;
  const h = P / N;
  const E = Math.exp(-h / tau);
  const run = (v0: number, store?: { a: Float64Array; b: Float64Array }) => {
    let v = v0;
    for (let i = 0; i < N; i++) {
      const a = x.a[i]!;
      const k = (x.b[i]! - a) / h;
      if (store) store.a[i] = v;
      v = a + k * (h - tau) + (v - a + k * tau) * E;
      if (store) store.b[i] = v;
    }
    return v;
  };
  // v(P) = M v0 + c, com M = e^{−P/τ}
  const c = run(0);
  const M = Math.exp(-P / tau);
  const v0 = M < 1 - 1e-15 ? c / (1 - M) : 0;
  const out = { N, P, a: new Float64Array(N), b: new Float64Array(N) };
  run(v0, out);
  return out;
}

/** Passa-altas: x − passa-baixas(x). */
export function highpass(x: PWL, tau: number): PWL {
  const lp = lowpass(x, tau);
  const a = new Float64Array(x.N);
  const b = new Float64Array(x.N);
  for (let i = 0; i < x.N; i++) {
    a[i] = x.a[i]! - lp.a[i]!;
    b[i] = x.b[i]! - lp.b[i]!;
  }
  return { N: x.N, P: x.P, a, b };
}

/** Valor do sinal PWL no instante t (interpolação linear dentro do trecho). */
export function at(x: PWL, t: number): number {
  const u = t / x.P - Math.floor(t / x.P);
  const s = u * x.N;
  const i = Math.min(x.N - 1, Math.floor(s));
  const f = s - i;
  return x.a[i]! + (x.b[i]! - x.a[i]!) * f;
}

export function extremes(x: PWL): { min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < x.N; i++) {
    min = Math.min(min, x.a[i]!, x.b[i]!);
    max = Math.max(max, x.a[i]!, x.b[i]!);
  }
  return { min, max };
}

export function mean(x: PWL): number {
  let s = 0;
  for (let i = 0; i < x.N; i++) s += (x.a[i]! + x.b[i]!) / 2;
  return s / x.N;
}

/**
 * Fase (em fração de período) do primeiro cruzamento do nível `L` com a
 * borda pedida, ou NaN se o sinal nunca cruza o nível (sem disparo).
 */
export function triggerPhase(x: PWL, L: number, rising: boolean): number {
  const up = (p: number, q: number) => (rising ? p < L && q >= L : p > L && q <= L);
  for (let i = 0; i < x.N; i++) {
    const a = x.a[i]!;
    const b = x.b[i]!;
    const prevEnd = x.b[(i - 1 + x.N) % x.N]!;
    if (up(prevEnd, a)) return i / x.N;
    if (up(a, b)) return (i + (L - a) / (b - a)) / x.N;
  }
  return NaN;
}

// ---------------------------------------------------------------------------
// Sinais da bancada (com cache, pois dependem só dos parâmetros)

export interface Signals {
  /** Forma unitária do gerador e saída unitária do RC (sem offset). */
  gen: PWL;
  rc: PWL;
  /** Sinais exibidos nos canais (já com amplitude, offset e acoplamento), em volts. */
  ch1: PWL;
  ch2: PWL;
}

const cache = new Map<string, Signals>();

function scaled(x: PWL, k: number, c: number): PWL {
  const a = new Float64Array(x.N);
  const b = new Float64Array(x.N);
  for (let i = 0; i < x.N; i++) {
    a[i] = c + k * x.a[i]!;
    b[i] = c + k * x.b[i]!;
  }
  return { N: x.N, P: x.P, a, b };
}

/** Acoplamento: 0 = DC, 1 = AC (capacitor em série, passa-altas), 2 = GND (entrada aterrada). */
export const coupling = (p: Params, ch: 1 | 2) => Math.round(num(p, ch === 1 ? "acop1" : "acop2"));

export function signals(p: Params): Signals {
  const w = wave(p);
  const P = 1 / freq(p);
  const A = amp(p);
  const off = offset(p);
  const tau = tauRC(p);
  const k1 = coupling(p, 1);
  const k2 = coupling(p, 2);
  const key = [w, P, A, off, tau, k1, k2].join("|");
  const hit = cache.get(key);
  if (hit) return hit;
  const gen = sampleShape(w, P);
  const rc = lowpass(gen, tau);
  const disp = (x: PWL, k: number) => (k === 2 ? scaled(x, 0, 0) : k === 1 ? scaled(highpass(x, TAU_AC), A, 0) : scaled(x, A, off));
  const s: Signals = { gen, rc, ch1: disp(gen, k1), ch2: disp(rc, k2) };
  if (cache.size > 24) cache.clear();
  cache.set(key, s);
  return s;
}

// ---------------------------------------------------------------------------
// Grandezas medidas

/** Valor de pico a pico do gerador (V). */
export const vpp = (p: Params) => 2 * amp(p);
/** RMS verdadeiro da componente alternada (o que um multímetro true RMS em V~ indica). */
export const vrms = (p: Params) => amp(p) * rmsShape(wave(p));
/** RMS incluindo a componente contínua. */
export const vrmsTotal = (p: Params) => Math.hypot(vrms(p), offset(p));

/** Banda passante do multímetro (Hz): resposta de 2ª ordem 1/√(1 + (f/f_B)⁴). */
export const dmmBandwidth = (p: Params) => (Math.round(num(p, "dmm")) === 0 ? 100e3 : 10e3);
export const dmmResponse = (p: Params) => 1 / Math.sqrt(1 + (freq(p) / dmmBandwidth(p)) ** 4);

/**
 * Leitura do multímetro em V~ (acoplado em CA). True RMS: valor eficaz da
 * componente alternada. Média calibrado: média do módulo × π/(2√2), exato só
 * para senoide.
 */
export function dmmAC(p: Params): number {
  const trueRms = Math.round(num(p, "dmm")) === 0;
  const w = wave(p);
  const r = trueRms ? rmsShape(w) : FORM_SINE * meanAbsShape(w);
  return amp(p) * r * dmmResponse(p);
}

/** Erro relativo da leitura do multímetro em relação ao RMS verdadeiro (%). */
export const dmmError = (p: Params) => (dmmAC(p) / vrms(p) - 1) * 100;

/** Defasagem da fundamental na saída do RC (°): φ = arctan(ωRC), saída atrasada. */
export const phaseDeg = (p: Params) => (Math.atan(2 * Math.PI * freq(p) * tauRC(p)) * 180) / Math.PI;
/** Ganho da fundamental do RC: 1/√(1 + (ωRC)²). */
export const gainRC = (p: Params) => 1 / Math.hypot(1, 2 * Math.PI * freq(p) * tauRC(p));
/** Frequência de corte do RC (Hz). */
export const fc = (p: Params) => 1 / (2 * Math.PI * tauRC(p));

/** Pico a pico da tensão no capacitor (V), exato para qualquer forma. */
export function vpp2(p: Params): number {
  const e = extremes(signals(p).rc);
  return amp(p) * (e.max - e.min);
}

// ---------------------------------------------------------------------------
// Varredura e disparo

/** Gerador pseudoaleatório determinístico em [0, 1) a partir de um número. */
function hash(x: number): number {
  const s = Math.sin(x * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
}

export const trigMode = (p: Params) => Math.round(num(p, "trig")); // 0 auto, 1 normal, 2 desligado

/**
 * Próxima varredura a partir do instante t. Com disparo, a varredura começa
 * sempre na mesma fase do sinal (imagem parada); sem disparo, começa numa
 * fase arbitrária e a imagem "corre" pela tela.
 */
export function nextSweep(p: Params, t: number): { ts: number; trig: number } {
  const mode = trigMode(p);
  const P = 1 / freq(p);
  const u = mode === 2 || coupling(p, 1) === 2 ? NaN : triggerPhase(signals(p).ch1, num(p, "nivel", 0), Math.round(num(p, "borda")) === 0);
  if (Number.isFinite(u)) {
    const k = Math.ceil(t / P - u - 1e-12);
    return { ts: (k + u) * P, trig: 1 };
  }
  if (mode === 1) return { ts: NaN, trig: -1 };
  return { ts: t + hash(t) * P * 7.31, trig: 0 };
}

export function init(p: Params): number[] {
  const s = nextSweep(p, 0);
  const ts = Number.isFinite(s.ts) ? s.ts : 0;
  return [0, ts, ts, ts, s.trig, 2, 7, 0];
}

export function step(s: number[], p: Params, dt: number): number[] {
  const out = s.slice();
  const t = s[T]! + dt;
  out[T] = t;
  const n = nextSweep(p, t);
  out[TRG] = n.trig;
  if (Number.isFinite(n.ts)) {
    out[TS2] = s[TS1]!;
    out[TS1] = s[TS0]!;
    out[TS0] = n.ts;
  }
  return out;
}

/** Diferença de tempo entre os cursores (s). */
export const cursorDt = (s: number[], p: Params) => (s[C2]! - s[C1]!) * sdiv(p);

/** Tensão instantânea no canal (V), em tempo absoluto. */
export const chAt = (p: Params, ch: 1 | 2, t: number) => at(ch === 1 ? signals(p).ch1 : signals(p).ch2, t);
/** Tensão verdadeira do gerador no instante t (V). */
export const genAt = (p: Params, t: number) => offset(p) + amp(p) * shape(wave(p), t * freq(p));
