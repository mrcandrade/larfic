// Ajustes oferecidos nas páginas de videoanálise e sensores, montados sobre @fisilab/analysis.

import { fitExponential, fitLine, fitNonlinear, fitPoly, fitProportional, mean, stdErr, stdev, type FitResult } from "@fisilab/analysis";

export type FitKind = "nenhum" | "linear" | "proporcional" | "quadratico" | "exponencial" | "assintotico";

export const fitKinds: { id: FitKind; label: string; formula: string }[] = [
  { id: "nenhum", label: "Sem ajuste", formula: "" },
  { id: "linear", label: "Linear", formula: "y = a + b·x" },
  { id: "proporcional", label: "Proporcional", formula: "y = b·x" },
  { id: "quadratico", label: "Quadrático", formula: "y = c₀ + c₁·x + c₂·x²" },
  { id: "exponencial", label: "Exponencial", formula: "y = A·e^(b·x)" },
  { id: "assintotico", label: "Exponencial com assíntota", formula: "y = c + A·e^(−x/τ)" },
];

export interface FitParam {
  name: string;
  value: number;
  sigma: number;
  unit: string;
  /** Observação curta (ex.: "aceleração"). */
  note?: string;
}

export interface ModelFit {
  kind: Exclude<FitKind, "nenhum">;
  formula: string;
  fit: FitResult;
  params: FitParam[];
}

const div = (a: string, b: string) => (!b ? a : !a ? `1/${b}` : `${a}/${b}`);
const sq = (u: string) => (u ? (/[/·]/.test(u) ? `(${u})²` : `${u}²`) : "");

/**
 * Ajusta o modelo escolhido aos pontos (ignora pares não finitos).
 * Devolve os parâmetros com unidades montadas a partir das unidades de x e de y.
 * No quadrático, inclui 2·c₂ (a aceleração, quando x é tempo e y é posição).
 */
export function fitModel(kind: FitKind, xs: readonly number[], ys: readonly number[], xUnit = "", yUnit = ""): ModelFit | null {
  if (kind === "nenhum") return null;
  const x: number[] = [], y: number[] = [];
  xs.forEach((v, i) => {
    const w = ys[i]!;
    if (Number.isFinite(v) && Number.isFinite(w)) {
      x.push(v);
      y.push(w);
    }
  });
  const need = kind === "quadratico" || kind === "assintotico" ? 4 : 3;
  if (x.length < need) return null;
  const formula = fitKinds.find((k) => k.id === kind)!.formula;
  try {
    switch (kind) {
      case "linear": {
        const f = fitLine(x, y);
        return { kind, formula, fit: f, params: [p("a", f, 0, yUnit, "coef. linear"), p("b", f, 1, div(yUnit, xUnit), "inclinação")] };
      }
      case "proporcional": {
        const f = fitProportional(x, y);
        return { kind, formula, fit: f, params: [p("b", f, 0, div(yUnit, xUnit), "inclinação")] };
      }
      case "quadratico": {
        const f = fitPoly(x, y, 2);
        return {
          kind,
          formula,
          fit: f,
          params: [
            p("c₀", f, 0, yUnit),
            p("c₁", f, 1, div(yUnit, xUnit), "taxa inicial"),
            p("c₂", f, 2, div(yUnit, sq(xUnit))),
            { name: "2·c₂", value: 2 * f.p[2]!, sigma: 2 * f.sigma[2]!, unit: div(yUnit, sq(xUnit)), note: "aceleração" },
          ],
        };
      }
      case "exponencial": {
        let f: FitResult;
        if (y.every((v) => v > 0)) {
          const lin = fitExponential(x, y);
          f = fitNonlinear(x, y, (t, q) => q[0]! * Math.exp(q[1]! * t), lin.p);
        } else {
          f = fitNonlinear(x, y, (t, q) => q[0]! * Math.exp(q[1]! * t), [y[0]! || 1, 0]);
        }
        return { kind, formula, fit: f, params: [p("A", f, 0, yUnit), p("b", f, 1, div("", xUnit))] };
      }
      case "assintotico": {
        const c0 = mean(y.slice(-Math.max(1, Math.floor(y.length / 10))));
        const span = Math.max(...x) - Math.min(...x) || 1;
        const f = fitNonlinear(x, y, (t, q) => q[0]! + q[1]! * Math.exp(-(t - x[0]!) / q[2]!), [c0, y[0]! - c0, span / 3]);
        // Reescreve A para a forma y = c + A e^(−x/τ) (o modelo interno usa x − x₀ para estabilidade).
        const shift = Math.exp(x[0]! / f.p[2]!);
        const A = f.p[1]! * shift;
        return {
          kind,
          formula,
          fit: f,
          params: [
            p("c", f, 0, yUnit, "assíntota"),
            { name: "A", value: A, sigma: f.sigma[1]! * shift, unit: yUnit },
            p("τ", f, 2, xUnit, "constante de tempo"),
          ],
        };
      }
    }
  } catch {
    return null;
  }
}

function p(name: string, f: FitResult, i: number, unit: string, note?: string): FitParam {
  return { name, value: f.p[i]!, sigma: f.sigma[i]!, unit, note };
}

export interface IntervalStats {
  n: number;
  mean: number;
  /** Desvio padrão amostral. */
  sd: number;
  /** Desvio padrão da média (s/√n). */
  sem: number;
  min: number;
  max: number;
}

/** Estatística descritiva dos valores finitos. */
export function describe(values: readonly number[]): IntervalStats | null {
  const v = values.filter(Number.isFinite);
  if (!v.length) return null;
  return { n: v.length, mean: mean(v), sd: stdev(v), sem: v.length > 1 ? stdErr(v) : 0, min: Math.min(...v), max: Math.max(...v) };
}

/** Índices dos pontos com x dentro de [a, b] (em qualquer ordem dos extremos). */
export function indicesInRange(xs: readonly number[], a: number, b: number): number[] {
  const lo = Math.min(a, b), hi = Math.max(a, b);
  const out: number[] = [];
  xs.forEach((x, i) => {
    if (x >= lo && x <= hi) out.push(i);
  });
  return out;
}
