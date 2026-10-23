// Acústica de tubos: frequências de ressonância, perfis de modo e espectros de instrumentos.
import { num, type Params } from "@fisilab/core";

/** Tipos de tubo: 0 aberto–aberto, 1 fechado em x = 0 e aberto em x = L, 2 cone (ápice em x = 0). */
export const tipoOf = (p: Params) => Math.round(num(p, "tipo", 0));
export const lenOf = (p: Params) => num(p, "L", 0.6);
export const modeOf = (p: Params) => Math.max(1, Math.round(num(p, "n", 1)));

/** Velocidade do som no ar seco: v = 331,3 √(1 + T/273,15) m/s (T em °C). */
export function soundSpeed(Tc: number): number {
  return 331.3 * Math.sqrt(1 + Tc / 273.15);
}
export const vOf = (p: Params) => soundSpeed(num(p, "T", 20));

/** Correção de extremidade de uma boca aberta sem flange: δ = 0,61 r. */
export const deltaOf = (p: Params) => 0.61 * (num(p, "r", 0) / 100);

/** Número de bocas abertas (cada uma ganha a correção δ). */
export const openEnds = (tipo: number) => (tipo === 0 ? 2 : 1);

/** Comprimento acústico efetivo L + (nº de bocas abertas)·δ. */
export const leffOf = (p: Params) => lenOf(p) + openEnds(tipoOf(p)) * deltaOf(p);

/** Número do harmônico da n-ésima ressonância: n (aberto e cone) ou 2n − 1 (fechado). */
export const harmonicOf = (tipo: number, n: number) => (tipo === 1 ? 2 * n - 1 : n);

/** Frequência da n-ésima ressonância (Hz). */
export function freq(p: Params, n = modeOf(p)): number {
  const v = vOf(p);
  const Le = leffOf(p);
  return tipoOf(p) === 1 ? ((2 * n - 1) * v) / (4 * Le) : (n * v) / (2 * Le);
}

/** Frequência fundamental (primeira ressonância). */
export const f1Of = (p: Params) => freq(p, 1);

/** Número de onda k da n-ésima ressonância. */
export const kOf = (p: Params, n = modeOf(p)) => (2 * Math.PI * freq(p, n)) / vOf(p);

const j0 = (u: number) => (Math.abs(u) < 1e-6 ? 1 - (u * u) / 6 : Math.sin(u) / u);
const j1 = (u: number) => (Math.abs(u) < 1e-4 ? u / 3 : (Math.sin(u) - u * Math.cos(u)) / (u * u));

/**
 * Perfis (não normalizados) do modo n em x ∈ [0, L]: deslocamento s(x) e pressão p(x),
 * com p = −B∇·s (unidades arbitrárias, mesmo sinal relativo).
 */
export function profile(p: Params, x: number, n = modeOf(p)): { s: number; p: number } {
  const k = kOf(p, n);
  const tipo = tipoOf(p);
  if (tipo === 0) {
    const u = k * (x + deltaOf(p));
    return { s: Math.cos(u), p: Math.sin(u) };
  }
  if (tipo === 1) return { s: Math.sin(k * x), p: -Math.cos(k * x) };
  return { s: j1(k * x), p: -j0(k * x) };
}

/** Valor máximo de |s| e |p| no tubo, para normalizar os desenhos. */
export function profileMax(p: Params, n = modeOf(p)): { s: number; p: number } {
  const L = lenOf(p);
  let ms = 1e-9, mp = 1e-9;
  for (let i = 0; i <= 200; i++) {
    const v = profile(p, (L * i) / 200, n);
    ms = Math.max(ms, Math.abs(v.s));
    mp = Math.max(mp, Math.abs(v.p));
  }
  return { s: ms, p: mp };
}

export interface Instrument {
  value: number;
  label: string;
  /** Amplitudes relativas dos harmônicos 1, 2, 3, … (pressão sonora). */
  amps: number[];
}

/**
 * Espectros típicos em regime estacionário, nota sustentada em mezzoforte
 * (valores aproximados de medidas publicadas em acústica musical).
 * Clarinete no registro grave: harmônicos pares fracos (tubo fechado numa ponta).
 */
export const INSTRUMENTS: Instrument[] = [
  { value: 0, label: "Nenhum (só as ressonâncias do tubo)", amps: [] },
  { value: 1, label: "Flauta transversal", amps: [1, 0.6, 0.32, 0.17, 0.1, 0.06, 0.035, 0.02, 0.012, 0.008] },
  { value: 2, label: "Clarinete (registro grave)", amps: [1, 0.04, 0.72, 0.07, 0.5, 0.09, 0.33, 0.07, 0.2, 0.05] },
  { value: 3, label: "Oboé", amps: [0.42, 0.85, 1, 0.58, 0.42, 0.3, 0.24, 0.16, 0.1, 0.07] },
  { value: 4, label: "Saxofone alto", amps: [1, 0.82, 0.6, 0.46, 0.34, 0.25, 0.18, 0.12, 0.08, 0.05] },
];
export const instrumentOf = (p: Params) => INSTRUMENTS[Math.round(num(p, "instr", 0))] ?? INSTRUMENTS[0]!;

/** Amplitudes harmônicas usadas na síntese: do instrumento ou, sem instrumento, 1/h nas ressonâncias do tubo. */
export function synthAmps(p: Params, nmax = 10): number[] {
  const ins = instrumentOf(p);
  if (ins.amps.length) return ins.amps.slice(0, nmax);
  const tipo = tipoOf(p);
  return Array.from({ length: nmax }, (_, i) => {
    const h = i + 1;
    return tipo === 1 && h % 2 === 0 ? 0 : 1 / h;
  });
}

/** Forma de onda sintetizada (soma de harmônicos de f₁) no instante t. */
export function waveform(p: Params, t: number): number {
  const f1 = f1Of(p);
  return synthAmps(p).reduce((acc, a, i) => acc + a * Math.sin(2 * Math.PI * (i + 1) * f1 * t + 0.4 * i * i), 0);
}

/** Centroide espectral (Hz): “brilho” do timbre. */
export function centroid(p: Params): number {
  const a = synthAmps(p);
  const f1 = f1Of(p);
  const w = a.map((x) => x * x);
  const sw = w.reduce((s, x) => s + x, 0) || 1;
  return w.reduce((s, x, i) => s + x * (i + 1) * f1, 0) / sw;
}
