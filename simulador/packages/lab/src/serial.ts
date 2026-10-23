// Leitura de dados de Arduino/sensores: separação incremental de linhas e interpretação
// de CSV, TSV, ponto e vírgula, espaços ou "chave: valor", com cabeçalho opcional.

/**
 * Junta pedaços de texto (como chegam da porta serial) e devolve só as linhas completas.
 * Aceita \n, \r\n e \r, inclusive quando o \r e o \n chegam em pedaços diferentes.
 */
export class LineSplitter {
  private buf = "";
  private pendingCR = false;
  private dropFirst: boolean;

  /** dropPartialFirst: descarta o texto antes da primeira quebra de linha (a conexão pode começar no meio de uma linha). */
  constructor(opts: { dropPartialFirst?: boolean } = {}) {
    this.dropFirst = opts.dropPartialFirst ?? false;
  }

  push(chunk: string): string[] {
    let s = chunk;
    if (this.pendingCR && s.startsWith("\n")) s = s.slice(1);
    if (s.length) this.pendingCR = s.endsWith("\r");
    const text = this.buf + s;
    const parts = text.split(/\r\n|\r|\n/);
    this.buf = parts.pop() ?? "";
    if (this.dropFirst && parts.length) {
      parts.shift();
      this.dropFirst = false;
    }
    return parts;
  }

  /** Devolve o que sobrou sem quebra de linha final (ao fechar a porta ou terminar um arquivo). */
  flush(): string[] {
    const b = this.buf;
    this.buf = "";
    this.pendingCR = false;
    if (this.dropFirst) {
      this.dropFirst = false;
      return [];
    }
    return b ? [b] : [];
  }
}

export type DataFormat = "csv" | "tsv" | "ponto-e-virgula" | "espacos" | "chave-valor";

export const formatLabels: Record<DataFormat, string> = {
  csv: "CSV (vírgula)",
  tsv: "TSV (tabulação)",
  "ponto-e-virgula": "ponto e vírgula",
  espacos: "separado por espaços",
  "chave-valor": "chave: valor",
};

export type DataRow = Record<string, number>;

export type LineResult =
  | { kind: "dados"; row: DataRow }
  | { kind: "cabecalho"; columns: string[] }
  | { kind: "mensagem"; text: string }
  | { kind: "ignorada"; text: string; reason: string }
  | { kind: "vazia" };

const KV = /([A-Za-zÀ-ÿµ_][\wÀ-ÿµ°%/.-]*(?:\s*[([][^)\]]*[)\]])?)\s*[:=]\s*([-+]?(?:\d+(?:[.,]\d+)?|[.,]\d+)(?:[eE][-+]?\d+)?)/g;
const IDENT = /^[A-Za-zÀ-ÿµ_][\wÀ-ÿµ°%]*(?:\s*[([][^)\]]*[)\]])?$/;

/** Converte texto em número aceitando vírgula decimal quando o separador não é vírgula. */
export function parseNumber(s: string, decimalComma = true): number {
  const t = s.trim();
  if (!t) return NaN;
  const norm = decimalComma ? t.replace(",", ".") : t;
  return /^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(norm) ? Number(norm) : NaN;
}

function splitFields(line: string): { fields: string[]; format: Exclude<DataFormat, "chave-valor"> } {
  if (line.includes("\t")) return { fields: line.split("\t").map((f) => f.trim()), format: "tsv" };
  if (line.includes(";")) return { fields: line.split(";").map((f) => f.trim()), format: "ponto-e-virgula" };
  if (line.includes(",")) return { fields: line.split(",").map((f) => f.trim()), format: "csv" };
  return { fields: line.trim().split(/\s+/), format: "espacos" };
}

/**
 * Interpretador incremental: recebe uma linha por vez e mantém as colunas.
 * - Linha só com números → dados (colunas c1, c2… se não houver cabeçalho).
 * - Linha com nomes (≥ 2 campos, separados por vírgula, tabulação, ponto e vírgula ou espaços) → cabeçalho.
 * - "chave: valor" ou "chave=valor" (vários por linha) → dados com colunas pelo nome da chave; o texto após o número (unidade) é ignorado.
 * - Qualquer outra coisa (mensagens do sketch, linhas cortadas) é contada e ignorada.
 */
export class DataParser {
  /** Todas as colunas já vistas, na ordem em que apareceram. */
  columns: string[] = [];
  /** Colunas do cabeçalho em vigor (para linhas sem chave). */
  private header: string[] | null = null;
  private rowsSinceHeader = 0;
  format: DataFormat | null = null;
  rows = 0;
  ignored = 0;
  lastMessage = "";

  private addColumns(names: readonly string[]) {
    for (const n of names) if (!this.columns.includes(n)) this.columns.push(n);
  }

  parseLine(raw: string): LineResult {
    const line = raw.replace(/^﻿/, "").trim();
    if (!line) return { kind: "vazia" };
    if (line.startsWith("#") || line.startsWith("//")) return this.message(line.replace(/^(#|\/\/)\s*/, ""));

    // chave: valor
    if (/[:=]/.test(line)) {
      const row: DataRow = {};
      let n = 0;
      for (const m of line.matchAll(KV)) {
        const key = m[1]!.trim();
        const v = parseNumber(m[2]!, true);
        if (Number.isFinite(v)) {
          row[key] = v;
          n++;
        }
      }
      if (n > 0) {
        this.format = "chave-valor";
        this.addColumns(Object.keys(row));
        this.rows++;
        return { kind: "dados", row };
      }
      return this.message(line);
    }

    const { fields, format } = splitFields(line);
    const decimalComma = format !== "csv";
    const nums = fields.map((f) => parseNumber(f, decimalComma));
    const numeric = nums.filter(Number.isFinite).length;

    if (numeric === fields.length) {
      if (this.header && fields.length !== this.header.length) {
        if (this.rowsSinceHeader === 0) {
          // O "cabeçalho" era na verdade uma mensagem: volta aos nomes genéricos.
          this.header = null;
        } else {
          this.ignored++;
          return { kind: "ignorada", text: line, reason: `esperava ${this.header.length} valores e veio ${fields.length}` };
        }
      }
      const names = this.header ?? fields.map((_, i) => `c${i + 1}`);
      const row: DataRow = {};
      names.forEach((nme, i) => (row[nme] = nums[i]!));
      this.addColumns(names);
      this.format = format;
      this.rows++;
      this.rowsSinceHeader++;
      return { kind: "dados", row };
    }

    const looksHeader =
      fields.length >= 2 &&
      numeric === 0 &&
      fields.every((f) => f.length > 0 && f.length <= 40) &&
      (format !== "espacos" || fields.every((f) => IDENT.test(f)));
    if (looksHeader) {
      const names = uniqueNames(fields);
      this.header = names;
      this.rowsSinceHeader = 0;
      this.format = format;
      this.addColumns(names);
      return { kind: "cabecalho", columns: names };
    }
    if (numeric > 0 && numeric < fields.length && this.rows > 0) {
      this.ignored++;
      return { kind: "ignorada", text: line, reason: "valores não numéricos" };
    }
    return this.message(line);
  }

  private message(text: string): LineResult {
    this.ignored++;
    this.lastMessage = text;
    return { kind: "mensagem", text };
  }
}

function uniqueNames(fields: readonly string[]): string[] {
  const seen = new Map<string, number>();
  return fields.map((f) => {
    const k = seen.get(f) ?? 0;
    seen.set(f, k + 1);
    return k ? `${f}_${k + 1}` : f;
  });
}

export interface ParsedTable {
  columns: string[];
  rows: DataRow[];
  format: DataFormat | null;
  ignored: number;
}

/** Interpreta um texto inteiro (arquivo CSV/TXT importado ou saída copiada do Monitor Serial). */
export function parseText(text: string): ParsedTable {
  const sp = new LineSplitter();
  const parser = new DataParser();
  const rows: DataRow[] = [];
  for (const line of [...sp.push(text), ...sp.flush()]) {
    const r = parser.parseLine(line);
    if (r.kind === "dados") rows.push(r.row);
  }
  return { columns: parser.columns, rows, format: parser.format, ignored: parser.ignored };
}

const TIME_NAME = /^(t|tempo|time|timestamp|millis|micros|ms|us|µs|s)$/i;

/** Fator para segundos a partir do nome de uma coluna de tempo (t_ms → 0,001). */
export function timeFactor(name: string): number {
  const n = name.toLowerCase();
  if (/(micros|µs|\bus\b|_us\b|\(us\))/.test(n)) return 1e-6;
  if (/(millis|ms\b|_ms|\(ms\))/.test(n)) return 1e-3;
  return 1;
}

/** Procura a coluna de tempo pelo nome (t, tempo, t_ms, millis, tempo (s)…). */
export function guessTimeColumn(columns: readonly string[]): { key: string; factor: number } | null {
  for (const c of columns) {
    const base = c.replace(/\s*[([].*[)\]]\s*$/, "").replace(/_(ms|us|µs|s)$/i, "");
    if (TIME_NAME.test(base) || TIME_NAME.test(c)) return { key: c, factor: timeFactor(c) };
  }
  return null;
}

const UNIT_SUFFIX: Record<string, string> = {
  ms: "ms", s: "s", us: "µs", cm: "cm", mm: "mm", m: "m", v: "V", mv: "mV", a: "A", ma: "mA", c: "°C", k: "K",
  ohm: "Ω", kohm: "kΩ", lux: "lx", lx: "lx", pa: "Pa", kpa: "kPa", hpa: "hPa", g: "g", n: "N", hz: "Hz", adc: "",
};

/** Unidade sugerida pelo nome da coluna: "dist_cm" → cm, "T (°C)" → °C, "R_kohm" → kΩ. */
export function unitOf(name: string): string {
  const par = /[([]\s*([^)\]]+?)\s*[)\]]\s*$/.exec(name);
  if (par) return par[1]!;
  const suf = /_([A-Za-zµ]+)$/.exec(name);
  if (suf) return UNIT_SUFFIX[suf[1]!.toLowerCase()] ?? suf[1]!;
  return "";
}
