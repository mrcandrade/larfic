// Algarismos significativos: contagem e revisão de "valor ± incerteza" escritos pelo aluno.
import { roundResult } from "./uncertainty.ts";

/** Número de algarismos significativos de um número escrito ("0,040" → 2; "120" → 2; "120," → 3). */
export function sigFigs(text: string): number {
  const s = text.trim().replace(/^[-+−]/, "");
  const hasSep = /[.,]/.test(s);
  const digits = s.replace(/[.,]/g, "");
  const noLead = digits.replace(/^0+/, "");
  if (!noLead) return hasSep ? 1 : 1;
  // Sem separador decimal, zeros à direita são ambíguos: não contam.
  return hasSep ? noLead.length : noLead.replace(/0+$/, "").length || 1;
}

/** Casas decimais escritas ("9,790" → 3, "12" → 0). */
export function decimalPlaces(text: string): number {
  const m = /[.,](\d*)$/.exec(text.trim());
  return m ? m[1]!.length : 0;
}

/** Potência de 10 do último algarismo significativo de um inteiro sem separador ("1200" → 2, "35" → 0). */
function lastPlaceInteger(text: string): number {
  const d = text.replace(/^[-+−]/, "");
  const m = /0*$/.exec(d);
  return d.replace(/^0+/, "") ? m![0].length : 0;
}

const parseNum = (s: string) => Number(s.replace("−", "-").replace(",", "."));

export interface MeasurementMatch {
  /** Trecho encontrado no texto. */
  text: string;
  index: number;
  value: string;
  u: string;
  exp?: number;
  unit: string;
}

const NUM = "[-−+]?\\d+(?:[.,]\\d+)?";
const PM = "(?:±|\\\\pm|\\+-|\\+/-)";
const EXP = "(?:\\s*(?:×|x|\\\\times|\\*)\\s*10\\s*(?:\\^\\s*\\{?\\s*([-−+]?\\d+)\\s*\\}?|([⁻⁺]?[⁰¹²³⁴⁵⁶⁷⁸⁹]+)))?";
const UNIT = "(?:\\s*(?:\\\\,|\\\\mathrm\\{)?\\s*((?:[A-Za-zµμΩΩ°%Å][A-Za-zµμΩ°%Å·⋅/²³⁻¹⁰⁴⁵⁶⁷⁸⁹^\\-0-9()]*)))?";
const MEAS_RE = new RegExp(`(\\()?\\s*(${NUM})\\s*${PM}\\s*(${NUM})\\s*(\\))?${EXP}${UNIT}`, "g");
const SUPMAP: Record<string, string> = { "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9", "⁻": "-", "⁺": "+" };

/** Acha expressões "valor ± incerteza" (com ou sem parênteses, potência de 10 e unidade) num texto. */
export function findMeasurements(text: string): MeasurementMatch[] {
  const out: MeasurementMatch[] = [];
  for (const m of text.matchAll(MEAS_RE)) {
    const expStr = m[5] ?? (m[6] ? [...m[6]].map((c) => SUPMAP[c]).join("") : undefined);
    let unit = (m[7] ?? "").replace(/[)]+$/, "");
    let text = m[0];
    // Palavras comuns logo após o número não são unidade.
    if (/^(e|ou|com|que|para|de|do|da|dos|das|no|na|em|o|a|os|as|é|foi|como|mas|pois|se|valor|valores|mostra|indica)$/i.test(unit)) {
      text = text.slice(0, text.lastIndexOf(m[7]!));
      unit = "";
    }
    out.push({ text: text.trim(), index: m.index ?? 0, value: m[2]!, u: m[3]!, exp: expStr !== undefined ? Number(expStr) : undefined, unit });
  }
  return out;
}

export type ReviewLevel = "erro" | "aviso" | "ok";

export interface ReviewIssue {
  level: ReviewLevel;
  /** Seção do relatório (ou "geral"). */
  section: string;
  message: string;
}

/**
 * Confere uma expressão "valor ± incerteza": incerteza com 1 ou 2 algarismos significativos,
 * valor arredondado na mesma casa decimal da incerteza e unidade presente.
 */
export function checkMeasurement(m: MeasurementMatch, opts: { unitOptional?: boolean } = {}): string[] {
  const problems: string[] = [];
  const v = parseNum(m.value), u = parseNum(m.u);
  const fix = () => {
    const r = roundResult(v, u);
    const pow = r.exp ? ` × 10^${r.exp}` : "";
    return `(${r.value} ± ${r.u})${pow}`;
  };
  if (!(u > 0)) {
    problems.push(`a incerteza de "${m.text}" deve ser positiva`);
    return problems;
  }
  const n = sigFigs(m.u);
  if (n > 2) problems.push(`a incerteza ${m.u} tem ${n} algarismos significativos; use 1 ou 2 (sugestão: ${fix()})`);
  const dv = decimalPlaces(m.value), du = decimalPlaces(m.u);
  const sepV = /[.,]/.test(m.value), sepU = /[.,]/.test(m.u);
  // Com separador decimal, as casas precisam coincidir; inteiros: o valor não pode ser mais fino que a incerteza.
  const samePlace = sepV || sepU ? dv === du : lastPlaceInteger(m.value) >= lastPlaceInteger(m.u);
  if (n <= 2 && !samePlace) problems.push(`em "${m.text}" o valor e a incerteza devem terminar na mesma casa decimal (sugestão: ${fix()})`);
  else if (n > 2 && !samePlace) problems.push(`o valor de "${m.text}" também precisa ser arredondado na casa da incerteza`);
  if (!m.unit && !opts.unitOptional) problems.push(`falta a unidade em "${m.text}" (se a grandeza for adimensional, ignore)`);
  return problems;
}

/** Revisa todas as expressões "valor ± incerteza" de um texto. */
export function reviewText(text: string, section: string, dimensionless: (m: MeasurementMatch) => boolean = () => false): ReviewIssue[] {
  return findMeasurements(text).flatMap((m) =>
    checkMeasurement(m, { unitOptional: dimensionless(m) }).map((msg): ReviewIssue => ({ level: msg.startsWith("falta a unidade") ? "aviso" : "erro", section, message: msg[0]!.toUpperCase() + msg.slice(1) + "." })),
  );
}
