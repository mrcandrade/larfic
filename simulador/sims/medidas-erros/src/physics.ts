import { gaussian, hashSeed, num, rng, type Params } from "@fisilab/core";

export const G = 9.81;

// ------------------------------------------------------------------ tempo de reação

/** Distância de queda livre a partir do repouso. */
export const queda = (t: number) => 0.5 * G * t * t;
/** Tempo de reação a partir da distância lida na régua: t = √(2d/g). */
export const tempoDeQueda = (d: number) => Math.sqrt((2 * Math.max(0, d)) / G);
/** Leitura da régua: distância arredondada para a menor divisão (m). */
export const lerRegua = (d: number, res: number) => Math.round(d / res) * res;

export interface Estat {
  n: number;
  media: number;
  /** Desvio padrão amostral (n − 1). */
  desvio: number;
  /** Incerteza da média: σ/√n. */
  erroMedia: number;
}

export function estatistica(xs: number[]): Estat {
  const n = xs.length;
  if (n === 0) return { n: 0, media: 0, desvio: 0, erroMedia: 0 };
  const media = xs.reduce((a, b) => a + b, 0) / n;
  const desvio = n > 1 ? Math.sqrt(xs.reduce((a, b) => a + (b - media) ** 2, 0) / (n - 1)) : 0;
  return { n, media, desvio, erroMedia: n > 0 ? desvio / Math.sqrt(n) : 0 };
}

// ------------------------------------------------------------------ algarismos significativos

/** Divisões das réguas (cm). */
export const REGUAS = [
  { value: 0, label: "Régua com divisões de 1 cm", div: 1 },
  { value: 1, label: "Régua com divisões de 0,5 cm", div: 0.5 },
  { value: 2, label: "Régua milimetrada (0,1 cm)", div: 0.1 },
];

/** Casas decimais (em cm) de uma leitura: menor divisão mais um algarismo duvidoso estimado. */
export const casasLeitura = (div: number) => (div >= 0.5 ? 1 : 2);

/** Leitura feita com a régua: posição arredondada ao algarismo duvidoso. */
export const leitura = (x: number, div: number) => {
  const f = 10 ** casasLeitura(div);
  return Math.round(x * f) / f;
};

/** Conta os algarismos significativos de um número escrito (ex.: "0,0450" → 3). */
export function algSig(str: string): number {
  const s = str.replace(/[−-]/g, "").split(/[eE×]/)[0]!.replace(",", ".").trim();
  const digits = s.replace(".", "");
  const sem = digits.replace(/^0+/, "");
  if (sem === "") return 1;
  return sem.length;
}

/** Escreve v com n algarismos significativos, em notação brasileira; usa potência de dez se houver ambiguidade. */
export function comAS(v: number, n: number): string {
  if (v === 0) return n > 1 ? `0,${"0".repeat(n - 1)}` : "0";
  const e = Math.floor(Math.log10(Math.abs(Number(v.toPrecision(n)))));
  const dec = n - 1 - e;
  if (dec >= 0) return v.toFixed(dec).replace(".", ",");
  const m = v / 10 ** e;
  return `${m.toFixed(n - 1).replace(".", ",")} × 10^${e}`;
}

/** Escreve v com d casas decimais. */
export const comCasas = (v: number, d: number) => v.toFixed(Math.max(0, d)).replace(".", ",");

/** Peça a medir (cartão retangular), sorteada pela amostra: comprimento e largura verdadeiros (cm). */
export function cartao(p: Params) {
  const r = rng(hashSeed(`cartao-${Math.round(num(p, "amostra", 1))}`));
  return { L: 6 + 8.5 * r(), W: 2 + 4.5 * r() };
}

export interface Operacoes {
  L: string;
  W: string;
  asL: number;
  asW: number;
  areaBruta: number;
  area: string;
  perimetroBruto: number;
  perimetro: string;
}

/** Leituras e operações com as regras dos algarismos significativos. */
export function operacoes(xL: number, xW: number, div: number): Operacoes {
  const d = casasLeitura(div);
  const Lr = leitura(xL, div);
  const Wr = leitura(xW, div);
  const L = comCasas(Lr, d);
  const W = comCasas(Wr, d);
  const asL = algSig(L);
  const asW = algSig(W);
  const areaBruta = Lr * Wr;
  const perimetroBruto = 2 * (Lr + Wr);
  return {
    L,
    W,
    asL,
    asW,
    areaBruta,
    area: comAS(areaBruta, Math.min(asL, asW)),
    perimetroBruto,
    perimetro: comCasas(perimetroBruto, d),
  };
}

// ------------------------------------------------------------------ propagação

export const OPERACOES = [
  { value: 0, label: "Soma f = A + B" },
  { value: 1, label: "Diferença f = A − B" },
  { value: 2, label: "Produto f = A·B" },
  { value: 3, label: "Quociente f = A/B" },
  { value: 4, label: "Potência f = A²" },
  { value: 5, label: "Pêndulo g = 4π²L/T² (A = L, B = T)" },
];

export function funcao(op: number, a: number, b: number): number {
  switch (op) {
    case 0:
      return a + b;
    case 1:
      return a - b;
    case 2:
      return a * b;
    case 3:
      return a / b;
    case 4:
      return a * a;
    default:
      return (4 * Math.PI ** 2 * a) / (b * b);
  }
}

/** Incerteza de f pela propagação linear (derivadas parciais, erros independentes). */
export function sigmaPropagada(op: number, a: number, sa: number, b: number, sb: number): number {
  const f = funcao(op, a, b);
  switch (op) {
    case 0:
    case 1:
      return Math.hypot(sa, sb);
    case 2:
    case 3:
      return Math.abs(f) * Math.hypot(sa / a, sb / b);
    case 4:
      return Math.abs(f) * 2 * (sa / Math.abs(a));
    default:
      return Math.abs(f) * Math.hypot(sa / a, (2 * sb) / b);
  }
}

/** Gerador determinístico guardado no estado: devolve o sorteador e a próxima semente. */
export function sorteador(seed: number) {
  const r = rng(Math.imul(seed + 1, 2654435761) >>> 0);
  return { u: r, g: () => gaussian(r) };
}
