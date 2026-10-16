// Ajustes de curvas: reta (MMQ com e sem pesos), polinômio e não linear (Levenberg–Marquardt).

import { chi2Q } from "./stats.ts";

export interface FitResult {
  /** Parâmetros ajustados. */
  p: number[];
  /** Incertezas padrão dos parâmetros. */
  sigma: number[];
  /** Matriz de covariância. */
  cov: number[][];
  chi2: number;
  /** Graus de liberdade (n − nº de parâmetros). */
  dof: number;
  /** χ² reduzido. */
  chi2red: number;
  /** Probabilidade de obter χ² maior por acaso (só faz sentido com incertezas reais). */
  q: number;
  r2: number;
  residuals: number[];
  f: (x: number) => number;
}

/** Resolve A x = b por eliminação de Gauss com pivoteamento parcial. Também devolve A⁻¹. */
export function solveLinear(A: number[][], b: number[]): { x: number[]; inv: number[][] } {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]!, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r]![c]!) > Math.abs(M[piv]![c]!)) piv = r;
    [M[c], M[piv]] = [M[piv]!, M[c]!];
    const d = M[c]![c]!;
    if (Math.abs(d) < 1e-300) throw new Error("sistema singular");
    for (let k = 0; k < 2 * n + 1; k++) M[c]![k]! /= d;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r]![c]!;
      if (f !== 0) for (let k = 0; k < 2 * n + 1; k++) M[r]![k]! -= f * M[c]![k]!;
    }
  }
  return { x: M.map((r) => r[n]!), inv: M.map((r) => r.slice(n + 1)) };
}

function finish(x: readonly number[], y: readonly number[], w: readonly number[] | undefined, p: number[], cov: number[][], f: (x: number) => number): FitResult {
  const n = x.length;
  const residuals = x.map((xi, i) => y[i]! - f(xi));
  const chi2 = residuals.reduce((a, r, i) => a + r * r * (w ? w[i]! : 1), 0);
  const dof = Math.max(1, n - p.length);
  const ym = y.reduce((a, b) => a + b, 0) / n;
  const ssTot = y.reduce((a, b) => a + (b - ym) ** 2, 0);
  const ssRes = residuals.reduce((a, r) => a + r * r, 0);
  // Sem incertezas informadas, a covariância é escalada pelo resíduo (estimativa de σ_y a partir dos dados).
  const scale = w ? 1 : chi2 / dof;
  const C = cov.map((row) => row.map((v) => v * scale));
  return {
    p,
    sigma: C.map((row, i) => Math.sqrt(Math.max(0, row[i]!))),
    cov: C,
    chi2,
    dof,
    chi2red: chi2 / dof,
    q: w ? chi2Q(chi2, dof) : NaN,
    r2: ssTot > 0 ? 1 - ssRes / ssTot : 1,
    residuals,
    f,
  };
}

/** Ajuste linear por mínimos quadrados com funções-base arbitrárias: y = Σ pₖ φₖ(x). */
export function fitLinearBasis(x: readonly number[], y: readonly number[], basis: ((x: number) => number)[], sy?: readonly number[]): FitResult {
  const m = basis.length;
  const w = sy?.map((s) => 1 / (s * s));
  const A = Array.from({ length: m }, () => new Array<number>(m).fill(0));
  const b = new Array<number>(m).fill(0);
  x.forEach((xi, i) => {
    const phi = basis.map((f) => f(xi));
    const wi = w ? w[i]! : 1;
    for (let j = 0; j < m; j++) {
      b[j]! += wi * phi[j]! * y[i]!;
      for (let k = 0; k < m; k++) A[j]![k]! += wi * phi[j]! * phi[k]!;
    }
  });
  const { x: p, inv } = solveLinear(A, b);
  return finish(x, y, w, p, inv, (xx) => basis.reduce((a, f, k) => a + p[k]! * f(xx), 0));
}

/** Reta y = a + b x. p = [a, b]. */
export const fitLine = (x: readonly number[], y: readonly number[], sy?: readonly number[]) => fitLinearBasis(x, y, [() => 1, (t) => t], sy);

/** Reta pela origem y = b x. p = [b]. */
export const fitProportional = (x: readonly number[], y: readonly number[], sy?: readonly number[]) => fitLinearBasis(x, y, [(t) => t], sy);

/** Polinômio de grau g. p = [c0, c1, ..., cg]. */
export const fitPoly = (x: readonly number[], y: readonly number[], degree: number, sy?: readonly number[]) =>
  fitLinearBasis(x, y, Array.from({ length: degree + 1 }, (_, k) => (t: number) => t ** k), sy);

/** Ajuste não linear y = model(x, p) por Levenberg–Marquardt (jacobiana numérica). */
export function fitNonlinear(
  x: readonly number[],
  y: readonly number[],
  model: (x: number, p: readonly number[]) => number,
  p0: readonly number[],
  sy?: readonly number[],
  maxIter = 200,
): FitResult {
  const w = sy?.map((s) => 1 / (s * s));
  const np = p0.length;
  let p = [...p0];
  const chi2 = (pp: readonly number[]) => x.reduce((a, xi, i) => a + (w ? w[i]! : 1) * (y[i]! - model(xi, pp)) ** 2, 0);
  let c = chi2(p);
  let lambda = 1e-3;
  let JtJ: number[][] = [];
  for (let it = 0; it < maxIter; it++) {
    const J = x.map((xi) =>
      p.map((pk, k) => {
        const h = 1e-7 * Math.max(1, Math.abs(pk));
        const pp = [...p];
        pp[k] = pk + h;
        const up = model(xi, pp);
        pp[k] = pk - h;
        return (up - model(xi, pp)) / (2 * h);
      }),
    );
    JtJ = Array.from({ length: np }, (_, a) => Array.from({ length: np }, (_, b) => x.reduce((s, _x, i) => s + (w ? w[i]! : 1) * J[i]![a]! * J[i]![b]!, 0)));
    const g = Array.from({ length: np }, (_, a) => x.reduce((s, xi, i) => s + (w ? w[i]! : 1) * J[i]![a]! * (y[i]! - model(xi, p)), 0));
    let improved = false;
    for (let tries = 0; tries < 30; tries++) {
      const A = JtJ.map((row, a) => row.map((v, b) => (a === b ? v * (1 + lambda) : v)));
      let dp: number[];
      try {
        dp = solveLinear(A, g).x;
      } catch {
        lambda *= 10;
        continue;
      }
      const pn = p.map((v, k) => v + dp[k]!);
      const cn = chi2(pn);
      if (Number.isFinite(cn) && cn <= c) {
        const done = Math.abs(c - cn) <= 1e-12 * Math.max(1, c);
        p = pn;
        c = cn;
        lambda = Math.max(lambda / 10, 1e-12);
        improved = true;
        if (done) it = maxIter;
        break;
      }
      lambda *= 10;
    }
    if (!improved) break;
  }
  const cov = solveLinear(JtJ, new Array<number>(np).fill(0)).inv;
  const pf = [...p];
  return finish(x, y, w, pf, cov, (xx) => model(xx, pf));
}

/** Linearização comum: ajusta y = A e^{bx} por ln y = ln A + b x (sem pesos). Devolve [A, b]. */
export function fitExponential(x: readonly number[], y: readonly number[]): FitResult {
  const r = fitLine(x, y.map(Math.log));
  const A = Math.exp(r.p[0]!), b = r.p[1]!;
  return { ...r, p: [A, b], sigma: [A * r.sigma[0]!, r.sigma[1]!], f: (t) => A * Math.exp(b * t) };
}

/** Lei de potência y = A x^n por log-log. Devolve [A, n]. */
export function fitPower(x: readonly number[], y: readonly number[]): FitResult {
  const r = fitLine(x.map(Math.log), y.map(Math.log));
  const A = Math.exp(r.p[0]!), n = r.p[1]!;
  return { ...r, p: [A, n], sigma: [A * r.sigma[0]!, r.sigma[1]!], f: (t) => A * t ** n };
}
