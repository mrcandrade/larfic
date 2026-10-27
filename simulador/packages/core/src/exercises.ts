import { rng } from "./random.ts";
import { withOverrides, type ExerciseTemplate, type Params, type ParamSpec } from "./simulation.ts";

export interface ExerciseInstance {
  templateId: string;
  seed: number;
  /** Enunciado com os valores substituídos (vírgula decimal). */
  prompt: string;
  /** Parâmetros completos para abrir a simulação da questão. */
  params: Params;
  answer: number;
  unit: string;
  label: string;
  tolerance: number;
  hint?: string;
}

/** Formata um número no padrão brasileiro, sem zeros supérfluos. */
export function formatBR(v: number, digits = 4): string {
  if (!Number.isFinite(v)) return "—";
  if (v === 0) return "0";
  const a = Math.abs(v);
  if (a >= 1e6 || a < 1e-3) {
    const [m, e] = v.toExponential(digits - 1).split("e");
    return `${Number(m).toString().replace(".", ",")} × 10^${Number(e)}`;
  }
  return Number(v.toPrecision(digits)).toString().replace(".", ",");
}

/** Sorteia uma instância do exercício. A mesma semente gera sempre a mesma questão. */
export function generateExercise(
  sim: { params: ParamSpec[] },
  template: ExerciseTemplate,
  seed: number,
): ExerciseInstance {
  const rand = rng(seed);
  const drawn: Params = {};
  for (const [key, [min, max, decimals]] of Object.entries(template.vary)) {
    const f = 10 ** decimals;
    drawn[key] = Math.round((min + (max - min) * rand()) * f) / f;
  }
  const params = withOverrides(sim, { ...template.fixed, ...drawn });
  const prompt = template.prompt.replace(/\{(\w+)\}/g, (_, k: string) =>
    params[k] === undefined ? `{${k}}` : formatBR(params[k]!, 6),
  );
  return {
    templateId: template.id,
    seed,
    prompt,
    params,
    answer: template.answer.compute(params),
    unit: template.answer.unit,
    label: template.answer.label,
    tolerance: template.tolerance ?? 0.02,
    hint: template.hint,
  };
}

/** Aceita "12,5", "12.5", "1,2e3" ou "1,2 × 10^3". */
export function parseAnswer(text: string): number {
  const t = text.trim().replace(/\s/g, "").replace(/[×x]10\^?/i, "e").replace(",", ".");
  return t === "" ? NaN : Number(t);
}

export function checkAnswer(ex: ExerciseInstance, given: number): boolean {
  if (!Number.isFinite(given)) return false;
  if (ex.answer === 0) return Math.abs(given) < 1e-9 + ex.tolerance;
  return Math.abs(given - ex.answer) / Math.abs(ex.answer) <= ex.tolerance;
}

/** Número formatado para KaTeX: vírgula decimal sem espaço extra e potência de dez em notação científica. */
export function texNum(v: number, digits = 3): string {
  if (!Number.isFinite(v)) return String.raw`\text{—}`;
  if (v === 0) return "0";
  const a = Math.abs(v);
  if (a >= 1e5 || a < 1e-3) {
    const [m, e] = v.toExponential(digits - 1).split("e");
    return `${m!.replace(".", "{,}")} \\times 10^{${Number(e)}}`;
  }
  return Number(v.toPrecision(digits)).toString().replace(".", "{,}");
}
