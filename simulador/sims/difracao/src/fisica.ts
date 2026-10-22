/** Difração de Fraunhofer: fenda simples, rede, abertura circular (Airy) e FFT 2D de uma abertura qualquer. */

export const sinc = (x: number) => (Math.abs(x) < 1e-9 ? 1 : Math.sin(x) / x);

/** Fenda simples de largura a (µm): I/I₀ = (sen β / β)², β = π a sen θ / λ. */
export function singleSlit(sinT: number, aUm: number, lambdaNm: number): number {
  return sinc((Math.PI * aUm * 1e-6 * sinT) / (lambdaNm * 1e-9)) ** 2;
}

/** Fator de interferência de N fendas, normalizado (1 nos máximos principais). */
export function gratingFactor(sinT: number, N: number, dUm: number, lambdaNm: number): number {
  const g = (Math.PI * dUm * 1e-6 * sinT) / (lambdaNm * 1e-9);
  const s = Math.sin(g);
  if (Math.abs(s) < 1e-9) return 1;
  return (Math.sin(N * g) / (N * s)) ** 2;
}

/** Rede de N fendas de largura a e período d (µm). */
export const grating = (sinT: number, N: number, dUm: number, aUm: number, lambdaNm: number) =>
  gratingFactor(sinT, N, dUm, lambdaNm) * singleSlit(sinT, aUm, lambdaNm);

/** Ordens visíveis (|m λ / d| ≤ 1). */
export const maxOrder = (dUm: number, lambdaNm: number) => Math.floor((dUm * 1e-6) / (lambdaNm * 1e-9));

/** Poder de resolução de uma rede na ordem m: R = λ/Δλ = mN. */
export const resolvingPower = (m: number, N: number) => m * N;

// ---------- Bessel J1 (aproximação racional de Numerical Recipes, erro ~1e-8) ----------
export function besselJ1(x: number): number {
  const ax = Math.abs(x);
  if (ax < 8) {
    const y = x * x;
    const a1 = x * (72362614232.0 + y * (-7895059235.0 + y * (242396853.1 + y * (-2972611.439 + y * (15704.4826 + y * -30.16036606)))));
    const a2 = 144725228442.0 + y * (2300535178.0 + y * (18583304.74 + y * (99447.43394 + y * (376.9991397 + y))));
    return a1 / a2;
  }
  const z = 8 / ax;
  const y = z * z;
  const xx = ax - 2.356194491;
  const p1 = 1 + y * (0.183105e-2 + y * (-0.3516396496e-4 + y * (0.2457520174e-5 + y * -0.240337019e-6)));
  const p2 = 0.04687499995 + y * (-0.2002690873e-3 + y * (0.8449199096e-5 + y * (-0.88228987e-6 + y * 0.105787412e-6)));
  const ans = Math.sqrt(0.636619772 / ax) * (Math.cos(xx) * p1 - z * Math.sin(xx) * p2);
  return x < 0 ? -ans : ans;
}

/** Disco de Airy: I/I₀ = [2 J₁(x)/x]², x = π D sen θ / λ (D em mm). */
export function airy(theta: number, Dmm: number, lambdaNm: number): number {
  const x = (Math.PI * Dmm * 1e-3 * Math.sin(theta)) / (lambdaNm * 1e-9);
  if (Math.abs(x) < 1e-6) return 1;
  return ((2 * besselJ1(x)) / x) ** 2;
}

/** Critério de Rayleigh: θ_R = 1,22 λ / D (rad). */
export const rayleighAngle = (Dmm: number, lambdaNm: number) => (1.22 * lambdaNm * 1e-9) / (Dmm * 1e-3);

/** Duas fontes incoerentes separadas de α (rad), ao longo da linha que as une. */
export const twoSources = (theta: number, alpha: number, Dmm: number, lambdaNm: number) =>
  airy(theta - alpha / 2, Dmm, lambdaNm) + airy(theta + alpha / 2, Dmm, lambdaNm);

/** Razão entre a intensidade no meio das duas imagens e o pico (1 = sem vale). */
export function dipRatio(alpha: number, Dmm: number, lambdaNm: number): number {
  let peak = 0;
  for (let i = 0; i <= 400; i++) peak = Math.max(peak, twoSources((alpha * i) / 400, alpha, Dmm, lambdaNm));
  return twoSources(0, alpha, Dmm, lambdaNm) / peak;
}

// ---------- FFT ----------

/** FFT complexa radix-2 in-place (n potência de 2). inverse = false: soma com e^{−2πi kn/N}. */
export function fft(re: Float64Array, im: Float64Array, inverse = false): void {
  const n = re.length;
  if (n & (n - 1)) throw new Error("fft: n precisa ser potência de 2");
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j]!, re[i]!];
      [im[i], im[j]] = [im[j]!, im[i]!];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = ((inverse ? 2 : -2) * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k;
        const b = a + len / 2;
        const xr = re[b]! * cr - im[b]! * ci;
        const xi = re[b]! * ci + im[b]! * cr;
        re[b] = re[a]! - xr;
        im[b] = im[a]! - xi;
        re[a] = re[a]! + xr;
        im[a] = im[a]! + xi;
        const t = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = t;
      }
    }
  }
  if (inverse)
    for (let i = 0; i < n; i++) {
      re[i] = re[i]! / n;
      im[i] = im[i]! / n;
    }
}

/** FFT 2D (linhas e depois colunas) de uma matriz n×n armazenada por linhas. */
export function fft2d(re: Float64Array, im: Float64Array, n: number, inverse = false): void {
  const rr = new Float64Array(n);
  const ii = new Float64Array(n);
  for (let pass = 0; pass < 2; pass++) {
    for (let a = 0; a < n; a++) {
      for (let b = 0; b < n; b++) {
        const k = pass === 0 ? a * n + b : b * n + a;
        rr[b] = re[k]!;
        ii[b] = im[k]!;
      }
      fft(rr, ii, inverse);
      for (let b = 0; b < n; b++) {
        const k = pass === 0 ? a * n + b : b * n + a;
        re[k] = rr[b]!;
        im[k] = ii[b]!;
      }
    }
  }
}

/** Grade da abertura desenhável (G×G) e tamanho da FFT com preenchimento de zeros (F×F). */
export const G = 64;
export const F = 128;

/**
 * Padrão de Fraunhofer |FFT|² da abertura (G×G, 0/1) centrada numa grade F×F,
 * com a frequência zero deslocada para o centro e normalizado pelo máximo (= 1).
 * Índice [j*F + i]: i é a coluna (x), j a linha (y).
 */
export function fraunhofer(grid: ArrayLike<number>): Float64Array {
  const re = new Float64Array(F * F);
  const im = new Float64Array(F * F);
  const off = (F - G) / 2;
  for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) re[(j + off) * F + (i + off)] = grid[j * G + i] ?? 0;
  fft2d(re, im, F);
  const out = new Float64Array(F * F);
  let max = 0;
  for (let j = 0; j < F; j++)
    for (let i = 0; i < F; i++) {
      const k = j * F + i;
      const v = re[k]! * re[k]! + im[k]! * im[k]!;
      const tj = (j + F / 2) % F;
      const ti = (i + F / 2) % F;
      out[tj * F + ti] = v;
      if (v > max) max = v;
    }
  if (max > 0) for (let k = 0; k < out.length; k++) out[k] = out[k]! / max;
  return out;
}

// ---------- aberturas prontas ----------
export type Shape = "fenda" | "duas" | "circulo" | "quadrado" | "rede" | "triangulo";

export function presetAperture(shape: Shape): number[] {
  const g = new Array<number>(G * G).fill(0);
  const c = G / 2 - 0.5;
  for (let j = 0; j < G; j++)
    for (let i = 0; i < G; i++) {
      const x = i - c;
      const y = j - c;
      let on = false;
      switch (shape) {
        case "fenda":
          on = Math.abs(x) < 2 && Math.abs(y) < 20;
          break;
        case "duas":
          on = Math.abs(Math.abs(x) - 6) < 1.5 && Math.abs(y) < 20;
          break;
        case "circulo":
          on = x * x + y * y < 8 * 8;
          break;
        case "quadrado":
          on = Math.abs(x) < 7 && Math.abs(y) < 7;
          break;
        case "rede":
          on = Math.abs(y) < 20 && Math.abs(x) < 20 && ((Math.round(x + 0.5) % 6) + 6) % 6 < 2;
          break;
        case "triangulo":
          on = y > -8 && y < 10 - Math.abs(x) * 1.9 - 0;
          break;
      }
      g[j * G + i] = on ? 1 : 0;
    }
  return g;
}
