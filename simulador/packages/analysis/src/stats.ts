// Estatística básica para tratamento de dados de laboratório.

export const mean = (x: readonly number[]) => x.reduce((a, b) => a + b, 0) / x.length;

/** Desvio padrão amostral (n − 1). */
export function stdev(x: readonly number[]): number {
  if (x.length < 2) return 0;
  const m = mean(x);
  return Math.sqrt(x.reduce((a, b) => a + (b - m) ** 2, 0) / (x.length - 1));
}

/** Desvio padrão da média: s/√n (incerteza do tipo A). */
export const stdErr = (x: readonly number[]) => stdev(x) / Math.sqrt(x.length);

/** Função gama regularizada inferior não é necessária; usamos a beta incompleta para a t de Student. */
function lnGamma(z: number): number {
  const g = 7;
  const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lnGamma(1 - z);
  z -= 1;
  let x = c[0]!;
  for (let i = 1; i < g + 2; i++) x += c[i]! / (z + i);
  const t = z + g + 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

/** Beta incompleta regularizada I_x(a, b) por fração continuada (Numerical Recipes). */
export function betaInc(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(lnGamma(a + b) - lnGamma(a) - lnGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  const cf = (x: number, a: number, b: number) => {
    const tiny = 1e-300;
    let c = 1, d = 1 - ((a + b) * x) / (a + 1);
    if (Math.abs(d) < tiny) d = tiny;
    d = 1 / d;
    let h = d;
    for (let m = 1; m <= 300; m++) {
      const m2 = 2 * m;
      let aa = (m * (b - m) * x) / ((a + m2 - 1) * (a + m2));
      d = 1 + aa * d; if (Math.abs(d) < tiny) d = tiny;
      c = 1 + aa / c; if (Math.abs(c) < tiny) c = tiny;
      d = 1 / d; h *= d * c;
      aa = (-(a + m) * (a + b + m) * x) / ((a + m2) * (a + m2 + 1));
      d = 1 + aa * d; if (Math.abs(d) < tiny) d = tiny;
      c = 1 + aa / c; if (Math.abs(c) < tiny) c = tiny;
      d = 1 / d;
      const del = d * c;
      h *= del;
      if (Math.abs(del - 1) < 1e-14) break;
    }
    return h;
  };
  return x < (a + 1) / (a + b + 2) ? (bt * cf(x, a, b)) / a : 1 - (bt * cf(1 - x, b, a)) / b;
}

/** Função de distribuição acumulada da t de Student com ν graus de liberdade. */
export function studentCdf(t: number, nu: number): number {
  const x = nu / (nu + t * t);
  const tail = 0.5 * betaInc(x, nu / 2, 0.5);
  return t >= 0 ? 1 - tail : tail;
}

/** Quantil bilateral: t tal que P(|T| ≤ t) = conf (ex.: 0,95). */
export function studentT(conf: number, nu: number): number {
  const target = 0.5 + conf / 2;
  let lo = 0, hi = 1000;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (studentCdf(mid, nu) < target) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Probabilidade de χ² ≥ valor observado (teste de qualidade do ajuste). */
export function chi2Q(chi2: number, nu: number): number {
  // Q(ν/2, χ²/2) pela série/fração continuada da gama incompleta.
  const a = nu / 2, x = chi2 / 2;
  if (x <= 0) return 1;
  const gln = lnGamma(a);
  if (x < a + 1) {
    let sum = 1 / a, del = sum, ap = a;
    for (let n = 0; n < 500; n++) {
      ap += 1; del *= x / ap; sum += del;
      if (Math.abs(del) < Math.abs(sum) * 1e-15) break;
    }
    return 1 - sum * Math.exp(-x + a * Math.log(x) - gln);
  }
  const tiny = 1e-300;
  let b = x + 1 - a, c = 1 / tiny, d = 1 / b, h = d;
  for (let i = 1; i < 500; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b; if (Math.abs(d) < tiny) d = tiny;
    c = b + an / c; if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-15) break;
  }
  return Math.exp(-x + a * Math.log(x) - gln) * h;
}

/** Histograma com n classes iguais entre min e max. */
export function histogram(x: readonly number[], bins: number, range?: [number, number]): { edges: number[]; counts: number[] } {
  const lo = range?.[0] ?? Math.min(...x), hi = range?.[1] ?? Math.max(...x);
  const w = (hi - lo) / bins || 1;
  const counts = new Array<number>(bins).fill(0);
  for (const v of x) {
    const i = Math.min(bins - 1, Math.floor((v - lo) / w));
    if (i >= 0 && v <= hi) counts[i]!++;
  }
  return { edges: Array.from({ length: bins + 1 }, (_, i) => lo + i * w), counts };
}
