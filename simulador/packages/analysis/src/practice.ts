// Práticas de Física Experimental: roteiro, tabela de medidas, análise e relatório.
import type { Course, Params } from "@fisilab/core";
import { fitExponential, fitLine, fitPoly, fitPower, fitProportional, type FitResult } from "./fit.ts";
import { instruments, read, readingUncertainty, type Instrument } from "./instruments.ts";
import { combine, compatibility, formatMeasured, propagate, type Measured } from "./uncertainty.ts";
import { mean, stdErr } from "./stats.ts";

export type InstrumentRef = keyof typeof instruments | Instrument;
const inst = (r: InstrumentRef): Instrument => (typeof r === "string" ? instruments[r] : r);

/** De onde vem o valor verdadeiro de uma coluna medida. */
export type Source =
  | { param: string }
  | { observable: string }
  | { time: true };

export interface MeasuredColumn {
  key: string;
  label: string;
  unit: string;
  source: Source;
  instrument: InstrumentRef;
  /** Converte o valor da simulação (SI) para a unidade do instrumento (ex.: m → mm = 1000). */
  toUnit?: number;
  /** Multiplica o valor verdadeiro antes da leitura (ex.: cronometrar 10 períodos = 10). */
  times?: number;
  /** Quantas leituras repetidas por linha (incerteza tipo A pela média). */
  repeat?: number;
}

export interface DerivedColumn {
  key: string;
  label: string;
  unit: string;
  /** Usa as outras colunas da linha (já com incerteza) — a incerteza é propagada numericamente. */
  from: string[];
  compute: (...x: number[]) => number;
}

export type Column = MeasuredColumn | DerivedColumn;
export const isDerived = (c: Column): c is DerivedColumn => "compute" in c;

export type FitKind = "linear" | "proporcional" | "quadratico" | "exponencial" | "potencia";

export interface ResultSpec {
  label: string;
  unit: string;
  /** Recebe os parâmetros do ajuste (com incerteza) e devolve a grandeza física. */
  compute: (...p: number[]) => number;
  /** Valor de referência para teste de compatibilidade (opcional). */
  reference?: number;
}

export interface Practice {
  id: string;
  course: Course;
  /** Título exatamente como no plano (plan.ts), salvo nas práticas extras. */
  title: string;
  /** Prática além do catálogo do plano original (o título não precisa estar em plan.ts). */
  extra?: boolean;
  /** Simulação que faz o papel do aparato. */
  sim: string;
  scenario?: string;
  params?: Partial<Params>;
  /** Parâmetros que o aluno não pode mexer (ficam travados no aparato). */
  locked?: string[];
  objective: string;
  materials: string[];
  /** Roteiro em markdown (mesma sintaxe dos guias). */
  procedure: string;
  columns: Column[];
  /** Mínimo de linhas para liberar a análise. */
  minRows?: number;
  analysis?: {
    x: string;
    y: string;
    fit: FitKind;
    /** Rótulos dos eixos do gráfico. */
    xLabel?: string;
    yLabel?: string;
    results: ResultSpec[];
  };
  /** Perguntas para o relatório. */
  questions: string[];
  /**
   * Como um aluno-modelo faria a i-ésima medida (usado nos testes e numa futura demonstração):
   * parâmetros a mudar, instante em que medir e, opcionalmente, para onde arrastar algo no palco.
   */
  demo?: (i: number) => { params?: Partial<Params>; t?: number; drag?: { from: [string, string]; to: [number, number] } };
}

export interface Cell extends Measured {
  /** Leituras individuais (quando repetidas). */
  readings?: number[];
  display: string;
}

export type Row = Record<string, Cell>;

/** O que a bancada precisa saber da simulação no instante da medida. */
export interface Probe {
  params: Params;
  t: number;
  value(key: string): number;
}

function trueValue(src: Source, probe: Probe): number {
  if ("param" in src) return probe.params[src.param] ?? NaN;
  if ("observable" in src) return probe.value(src.observable);
  return probe.t;
}

const decimals = (res: number) => Math.max(0, -Math.floor(Math.log10(res) + 1e-9));

/** Registra uma linha: lê cada coluna medida com o instrumento e calcula as derivadas. */
export function measureRow(practice: Practice, probe: Probe, rand: () => number, zeroErrors: Record<string, number> = {}): Row {
  const row: Row = {};
  for (const c of practice.columns) {
    if (isDerived(c)) {
      const inputs = c.from.map((k) => row[k]!);
      const r = propagate(c.compute, inputs);
      row[c.key] = { value: r.value, u: r.u, display: formatMeasured(r.value, r.u) };
      continue;
    }
    const I = inst(c.instrument);
    const v = trueValue(c.source, probe) * (c.toUnit ?? 1) * (c.times ?? 1);
    const n = Math.max(1, c.repeat ?? 1);
    const readings = Array.from({ length: n }, () => read(I, v, rand, zeroErrors[c.key] ?? 0).value);
    const value = mean(readings);
    const uB = readingUncertainty(I, value);
    const u = n > 1 ? combine(stdErr(readings), uB) : uB;
    const display = n > 1 ? formatMeasured(value, u) : value.toFixed(decimals(I.resolution)).replace(".", ",");
    row[c.key] = { value, u, readings: n > 1 ? readings : undefined, display };
  }
  return row;
}

export interface AnalysisResult {
  fit: FitResult;
  results: { label: string; unit: string; value: number; u: number; text: string; reference?: number; z?: number; compatible?: boolean }[];
}

/** Ajusta y(x) com as incertezas de y como pesos e calcula as grandezas pedidas. */
export function analyze(practice: Practice, rows: Row[]): AnalysisResult | undefined {
  const a = practice.analysis;
  if (!a || rows.length < Math.max(3, practice.minRows ?? 3)) return undefined;
  const x = rows.map((r) => r[a.x]!.value);
  const y = rows.map((r) => r[a.y]!.value);
  const sy = rows.map((r) => r[a.y]!.u);
  const weights = sy.every((s) => s > 0) ? sy : undefined;
  let fit: FitResult;
  switch (a.fit) {
    case "proporcional": fit = fitProportional(x, y, weights); break;
    case "quadratico": fit = fitPoly(x, y, 2, weights); break;
    case "exponencial": fit = fitExponential(x, y); break;
    case "potencia": fit = fitPower(x, y); break;
    default: fit = fitLine(x, y, weights);
  }
  // Com pesos e χ²_red > 1, as incertezas são reescaladas (dados mais espalhados que as barras indicam).
  const scale = weights && fit.chi2red > 1 ? Math.sqrt(fit.chi2red) : 1;
  const pm: Measured[] = fit.p.map((v, i) => ({ value: v, u: fit.sigma[i]! * scale }));
  const results = a.results.map((r) => {
    const out = propagate(r.compute, pm);
    const base = { label: r.label, unit: r.unit, value: out.value, u: out.u, text: formatMeasured(out.value, out.u, r.unit) };
    if (r.reference === undefined) return base;
    const c = compatibility(out, { value: r.reference, u: 0 });
    return { ...base, reference: r.reference, z: c.z, compatible: c.compatible };
  });
  return { fit, results };
}

/** Tabela em CSV (separador ;, vírgula decimal, como o Excel em português abre). */
export function rowsToCsv(practice: Practice, rows: Row[]): string {
  const head = practice.columns.flatMap((c) => [`${c.label} (${c.unit})`, `u(${c.label}) (${c.unit})`]);
  const lines = rows.map((r) => practice.columns.flatMap((c) => [r[c.key]!.value, r[c.key]!.u].map((v) => String(v).replace(".", ","))).join(";"));
  return [head.join(";"), ...lines].join("\n");
}

/** Relatório em markdown (para colar no Moodle ou exportar). */
export function reportMarkdown(practice: Practice, rows: Row[], res: AnalysisResult | undefined, answers: string[] = []): string {
  const cols = practice.columns;
  const out = [`# ${practice.title}`, "", `**Objetivo.** ${practice.objective}`, "", "## Dados", ""];
  out.push(`| # | ${cols.map((c) => `${c.label} (${c.unit})`).join(" | ")} |`);
  out.push(`|---|${cols.map(() => "---").join("|")}|`);
  rows.forEach((r, i) => out.push(`| ${i + 1} | ${cols.map((c) => formatMeasured(r[c.key]!.value, r[c.key]!.u)).join(" | ")} |`));
  if (res) {
    out.push("", "## Análise", "", `Ajuste ${practice.analysis!.fit}: χ²/ν = ${res.fit.chi2red.toFixed(2).replace(".", ",")}, R² = ${res.fit.r2.toFixed(4).replace(".", ",")}`, "");
    for (const r of res.results) {
      out.push(`- **${r.label}** = ${r.text}${r.reference !== undefined ? ` (referência ${String(r.reference).replace(".", ",")} ${r.unit}; ${r.compatible ? "compatível" : "incompatível"}, z = ${r.z!.toFixed(1).replace(".", ",")})` : ""}`);
    }
  }
  if (practice.questions.length) {
    out.push("", "## Questões", "");
    practice.questions.forEach((q, i) => out.push(`${i + 1}. ${q}`, "", answers[i] ? `   ${answers[i]}` : "", ""));
  }
  return out.join("\n");
}
