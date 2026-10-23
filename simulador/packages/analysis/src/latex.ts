// Exportação para LaTeX: escapes, unidades, números com incerteza, tabelas e figuras em pgfplots.
import { roundResult, type Measured } from "./uncertainty.ts";

const SPECIAL: Record<string, string> = {
  "\\": "\\textbackslash{}",
  "&": "\\&",
  "%": "\\%",
  $: "\\$",
  "#": "\\#",
  _: "\\_",
  "{": "\\{",
  "}": "\\}",
  "~": "\\textasciitilde{}",
  "^": "\\textasciicircum{}",
};

/** Escapa os caracteres especiais do LaTeX (\ & % $ # _ { } ~ ^) num texto comum. */
export function latexEscape(s: string): string {
  return s.replace(/[\\&%$#_{}~^]/g, (c) => SPECIAL[c]!);
}

const GREEK: Record<string, string> = {
  α: "alpha", β: "beta", γ: "gamma", δ: "delta", ε: "varepsilon", ζ: "zeta", η: "eta", θ: "theta", ι: "iota", κ: "kappa",
  λ: "lambda", μ: "mu", µ: "mu", ν: "nu", ξ: "xi", π: "pi", ρ: "rho", σ: "sigma", ς: "varsigma", τ: "tau", υ: "upsilon",
  φ: "varphi", ϕ: "phi", χ: "chi", ψ: "psi", ω: "omega", Γ: "Gamma", Δ: "Delta", Θ: "Theta", Λ: "Lambda", Ξ: "Xi",
  Π: "Pi", Σ: "Sigma", Φ: "Phi", Ψ: "Psi", Ω: "Omega",
};
const SYMBOL: Record<string, string> = {
  "±": "\\pm", "×": "\\times", "·": "\\cdot", "≈": "\\approx", "≤": "\\leq", "≥": "\\geq", "≠": "\\neq", "→": "\\to",
  "∞": "\\infty", "√": "\\surd", "∝": "\\propto", "∂": "\\partial", "∫": "\\int", "∑": "\\sum", "−": "-", "°": "^{\\circ}",
  "½": "\\tfrac12", "⋅": "\\cdot", "∆": "\\Delta",
};
const SUP: Record<string, string> = { "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9", "⁻": "-", "⁺": "+", "ⁿ": "n" };
const SUB: Record<string, string> = { "₀": "0", "₁": "1", "₂": "2", "₃": "3", "₄": "4", "₅": "5", "₆": "6", "₇": "7", "₈": "8", "₉": "9", "ₓ": "x" };
const SUP_RE = /[⁰¹²³⁴⁵⁶⁷⁸⁹⁻⁺ⁿ]+/g;
const SUB_RE = /[₀₁₂₃₄₅₆₇₈₉ₓ]+/g;

/**
 * Texto comum (com acentos, letras gregas, ², ±...) para LaTeX compilável com pdflatex:
 * escapa os especiais e troca os símbolos Unicode por comandos.
 */
export function latexText(s: string): string {
  let out = latexEscape(s);
  out = out.replace(SUP_RE, (m) => `\\textsuperscript{${[...m].map((c) => (c === "⁻" ? "\\textminus{}" : SUP[c])).join("")}}`);
  out = out.replace(SUB_RE, (m) => `\\textsubscript{${[...m].map((c) => SUB[c]).join("")}}`);
  out = out.replace(/[α-ωΓΔΘΛΞΠΣΦΨΩµϕ]/g, (c) => (GREEK[c] ? `\\ensuremath{\\${GREEK[c]}}` : c));
  out = out.replace(/[±×·≈≤≥≠→∞√∝∂∫∑−°½⋅∆]/g, (c) => (c === "°" ? "\\textdegree{}" : c === "−" ? "\\textminus{}" : `\\ensuremath{${SYMBOL[c]}}`));
  return out;
}

/**
 * Unidade em modo matemático (sem os $): "m/s²" → \mathrm{m/s^{2}}, "N·m" → \mathrm{N\cdot m},
 * "10⁻³⁴ J·s" → 10^{-34}\,\mathrm{J\cdot s}, "µA" → \mathrm{\mu A}, "°C" → {}^{\circ}\mathrm{C}.
 */
export function unitLatex(unit: string): string {
  const u = unit.trim();
  if (!u) return "";
  let out = "";
  let run = "";
  const flush = () => {
    if (run) out += `\\mathrm{${run}}`;
    run = "";
  };
  const chars = [...u];
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i]!;
    if (SUP[c] !== undefined) {
      let sup = "";
      while (i < chars.length && SUP[chars[i]!] !== undefined) sup += SUP[chars[i++]!];
      i--;
      flush();
      out += `^{${sup}}`;
    } else if (c === "^") {
      let sup = "";
      i++;
      while (i < chars.length && /[-−+0-9½./a-z]/i.test(chars[i]!)) sup += chars[i++] === "½" ? "1/2" : chars[i - 1]!.replace("−", "-");
      i--;
      flush();
      out += `^{${sup}}`;
    } else if (c === "°") {
      flush();
      out += "{}^{\\circ}";
    } else if (c === " ") {
      flush();
      out += "\\,";
    } else if (c === "·" || c === "⋅") {
      run += "\\cdot ";
    } else if (GREEK[c]) {
      run += `\\${GREEK[c]} `;
    } else if (/[0-9]/.test(c) && !run) {
      out += c;
    } else if (c === "%") {
      flush();
      out += "\\%";
    } else if (SPECIAL[c] && c !== "/") {
      run += SPECIAL[c];
    } else {
      run += c;
    }
  }
  flush();
  return out.replace(/\\mathrm\{([^}]*?) \}/g, "\\mathrm{$1}");
}

export interface LatexNumberOptions {
  /** Separador decimal na saída: vírgula ("{,}" em modo matemático) ou ponto. Padrão: vírgula. */
  decimal?: "," | ".";
  /** Usa \num{v +- u} do siunitx (o separador então fica por conta do \sisetup). */
  siunitx?: boolean;
}

/**
 * Valor ± incerteza em LaTeX, arredondado pela convenção usual (incerteza com 1 ou 2
 * algarismos e valor na mesma casa). Sem os delimitadores $...$ (exceto no modo siunitx, que é texto).
 */
export function measuredLatex(value: number, u: number, opts: LatexNumberOptions = {}): string {
  const r = roundResult(value, u);
  if (opts.siunitx) {
    const p = (s: string) => s.replace(",", ".");
    return `\\num{${p(r.value)} +- ${p(r.u)}${r.exp ? ` e${r.exp}` : ""}}`;
  }
  const d = (s: string) => (opts.decimal === "." ? s.replace(",", ".") : s.replace(",", "{,}"));
  const core = `${d(r.value)} \\pm ${d(r.u)}`;
  return r.exp ? `(${core}) \\times 10^{${r.exp}}` : core;
}

/** Número simples com vírgula decimal (modo matemático). */
export function numberLatex(v: number, digits = 4, decimal: "," | "." = ","): string {
  if (!Number.isFinite(v)) return "\\text{---}";
  const a = Math.abs(v);
  if (a !== 0 && (a >= 1e5 || a < 1e-3)) {
    const [mant, e] = v.toExponential(digits - 1).split("e");
    const m = String(Number(mant));
    return `${decimal === "," ? m.replace(".", "{,}") : m} \\times 10^{${Number(e)}}`;
  }
  const s = String(Number(v.toPrecision(digits)));
  return decimal === "," ? s.replace(".", "{,}") : s;
}

export interface LatexColumn {
  label: string;
  unit?: string;
}

export interface LatexTableOptions extends LatexNumberOptions {
  caption?: string;
  label?: string;
  /** Linhas \toprule/\midrule/\bottomrule do pacote booktabs (padrão: sim). */
  booktabs?: boolean;
  /** Primeira coluna com o número da linha. */
  index?: boolean;
}

/** Cabeçalho de coluna: "L (m)" com a unidade em modo matemático. */
export function columnHeader(c: LatexColumn): string {
  const unit = c.unit?.trim();
  return unit ? `${latexText(c.label)} ($${unitLatex(unit)}$)` : latexText(c.label);
}

/** Tabela de dados com incertezas, pronta para colar (ambiente table + tabular). */
export function latexTable(columns: LatexColumn[], rows: (Measured | string | number)[][], opts: LatexTableOptions = {}): string {
  const bt = opts.booktabs ?? true;
  const [top, mid, bottom] = bt ? ["\\toprule", "\\midrule", "\\bottomrule"] : ["\\hline", "\\hline", "\\hline"];
  const cell = (v: Measured | string | number) => {
    if (typeof v === "string") return latexText(v);
    if (typeof v === "number") return `$${numberLatex(v, 4, opts.decimal)}$`;
    const s = measuredLatex(v.value, v.u, opts);
    return opts.siunitx ? s : `$${s}$`;
  };
  const head = [...(opts.index ? ["\\#"] : []), ...columns.map(columnHeader)];
  const lines = rows.map((r, i) => [...(opts.index ? [String(i + 1)] : []), ...r.map(cell)].join(" & ") + " \\\\");
  const out = ["\\begin{table}[htbp]", "  \\centering"];
  if (opts.caption) out.push(`  \\caption{${latexText(opts.caption)}}`);
  if (opts.label) out.push(`  \\label{${opts.label}}`);
  out.push(`  \\begin{tabular}{${"c".repeat(head.length)}}`, `    ${top}`, `    ${head.join(" & ")} \\\\`, `    ${mid}`, ...lines.map((l) => `    ${l}`), `    ${bottom}`, "  \\end{tabular}", "\\end{table}");
  return out.join("\n");
}

export interface PgfSeries {
  label: string;
  kind: "marks" | "line" | "band";
  /** Pares (x, y). Para "band", y é o limite inferior e `hi` o superior. */
  points: [number, number][];
  xErr?: number[];
  yErr?: number[];
  hi?: number[];
}

export interface PgfFigureOptions {
  xLabel: string;
  yLabel: string;
  series: PgfSeries[];
  logX?: boolean;
  logY?: boolean;
  caption?: string;
  label?: string;
  /** Vírgula nos rótulos dos eixos (padrão: sim). */
  comma?: boolean;
}

/** Número para coordenadas do pgfplots (sempre com ponto). */
export function pgfNum(v: number): string {
  if (v === 0) return "0";
  const a = Math.abs(v);
  if (a >= 1e6 || a < 1e-4) return v.toExponential(5).replace(/\.?0+e/, "e").replace("e+", "e");
  return String(Number(v.toPrecision(7)));
}

/**
 * Figura em pgfplots (ambiente figure + tikzpicture + axis) com pontos, barras de erro
 * explícitas, curvas e faixa de confiança. Requer \usepackage{pgfplots} (e fillbetween para faixas).
 */
export function pgfplotsFigure(o: PgfFigureOptions): string {
  const finite = (x: number, y: number) => Number.isFinite(x) && Number.isFinite(y) && (!o.logX || x > 0) && (!o.logY || y > 0);
  const axisOpts = [
    "width=0.9\\linewidth",
    "height=0.6\\linewidth",
    `xlabel={${latexText(o.xLabel)}}`,
    `ylabel={${latexText(o.yLabel)}}`,
    "grid=major",
    "legend pos=north west",
    "legend cell align=left",
    ...(o.logX ? ["xmode=log"] : []),
    ...(o.logY ? ["ymode=log"] : []),
    ...((o.comma ?? true) ? ["/pgf/number format/use comma"] : []),
  ];
  const out = ["\\begin{figure}[htbp]", "  \\centering", "  \\begin{tikzpicture}", "  \\begin{axis}[", ...axisOpts.map((a) => `    ${a},`), "  ]"];
  let bandN = 0;
  for (const s of o.series) {
    if (s.kind === "band" && s.hi) {
      const n = ++bandN;
      const lo = s.points.filter(([x, y]) => finite(x, y));
      const hi = s.points.map(([x], i) => [x, s.hi![i]!] as [number, number]).filter(([x, y]) => finite(x, y));
      out.push(`  \\addplot[name path=lo${n}, draw=none, forget plot] coordinates {${lo.map(([x, y]) => `(${pgfNum(x)},${pgfNum(y)})`).join(" ")}};`);
      out.push(`  \\addplot[name path=hi${n}, draw=none, forget plot] coordinates {${hi.map(([x, y]) => `(${pgfNum(x)},${pgfNum(y)})`).join(" ")}};`);
      out.push(`  \\addplot[fill=blue, fill opacity=0.15, draw=none] fill between[of=lo${n} and hi${n}];`);
      out.push(`  \\addlegendentry{${latexText(s.label)}}`);
      continue;
    }
    if (s.kind === "marks") {
      const hasX = !!s.xErr?.some((e) => e > 0);
      const hasY = !!s.yErr?.some((e) => e > 0);
      const eb = hasX || hasY ? `, error bars/.cd${hasX ? ", x dir=both, x explicit" : ""}${hasY ? ", y dir=both, y explicit" : ""}` : "";
      out.push(`  \\addplot+[only marks, mark=*, mark size=1.5pt${eb}] coordinates {`);
      s.points.forEach(([x, y], i) => {
        if (!finite(x, y)) return;
        const err = hasX || hasY ? ` +- (${pgfNum(s.xErr?.[i] ?? 0)},${pgfNum(s.yErr?.[i] ?? 0)})` : "";
        out.push(`    (${pgfNum(x)},${pgfNum(y)})${err}`);
      });
      out.push("  };");
    } else {
      out.push("  \\addplot+[no marks, thick] coordinates {");
      const pts = s.points.filter(([x, y]) => finite(x, y));
      for (let i = 0; i < pts.length; i += 4) out.push(`    ${pts.slice(i, i + 4).map(([x, y]) => `(${pgfNum(x)},${pgfNum(y)})`).join(" ")}`);
      out.push("  };");
    }
    out.push(`  \\addlegendentry{${latexText(s.label)}}`);
  }
  out.push("  \\end{axis}", "  \\end{tikzpicture}");
  if (o.caption) out.push(`  \\caption{${latexText(o.caption)}}`);
  if (o.label) out.push(`  \\label{${o.label}}`);
  out.push("\\end{figure}");
  return out.join("\n");
}

/** Inline de Markdown ($math$ preservado, **negrito**, *itálico*) para LaTeX. */
function inlineLatex(text: string): string {
  return text
    .split(/(\$[^$]+\$|\*\*[^*]+\*\*|\*[^*\s][^*]*\*)/)
    .map((part) => {
      if (part.startsWith("$") && part.endsWith("$") && part.length > 2) return part;
      if (part.startsWith("**") && part.endsWith("**") && part.length > 4) return `\\textbf{${latexText(part.slice(2, -2))}}`;
      if (part.startsWith("*") && part.endsWith("*") && part.length > 2) return `\\emph{${latexText(part.slice(1, -1))}}`;
      return latexText(part);
    })
    .join("");
}

/**
 * Markdown dos roteiros (títulos, listas, **negrito**, *itálico*, $...$ e $$...$$) para LaTeX.
 * Cada linha de texto vira um parágrafo, como no app.
 */
export function markdownToLatex(md: string): string {
  const out: string[] = [];
  let list: "enumerate" | "itemize" | null = null;
  const close = () => {
    if (list) out.push(`\\end{${list}}`);
    list = null;
  };
  for (const raw of md.split("\n")) {
    const line = raw.trimEnd();
    const ol = /^\s*\d+\.\s+(.*)$/.exec(line);
    const ul = /^\s*[-*]\s+(.*)$/.exec(line);
    if (ol || ul) {
      const kind = ol ? "enumerate" : "itemize";
      if (list !== kind) {
        close();
        out.push(`\\begin{${kind}}`);
        list = kind;
      }
      out.push(`  \\item ${inlineLatex((ol ?? ul)![1]!)}`);
      continue;
    }
    close();
    const disp = /^\s*\$\$(.+)\$\$\s*$/.exec(line);
    if (disp) out.push(`\\[ ${disp[1]!.trim()} \\]`);
    else if (/^#{2,4} /.test(line)) out.push(`\\subsection*{${inlineLatex(line.replace(/^#+ /, ""))}}`);
    else if (line.trim()) out.push(inlineLatex(line), "");
  }
  close();
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** Escapa texto para HTML. */
export function htmlEscape(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** Markdown dos roteiros para HTML; `math` converte cada fórmula (padrão: deixa o TeX entre \( \)). */
export function markdownToHtml(md: string, math: (tex: string, display: boolean) => string = (t, d) => htmlEscape(d ? `\\[${t}\\]` : `\\(${t}\\)`)): string {
  const inline = (text: string) =>
    text
      .split(/(\$[^$]+\$|\*\*[^*]+\*\*|\*[^*\s][^*]*\*)/)
      .map((part) => {
        if (part.startsWith("$") && part.endsWith("$") && part.length > 2) return math(part.slice(1, -1), false);
        if (part.startsWith("**") && part.endsWith("**") && part.length > 4) return `<strong>${htmlEscape(part.slice(2, -2))}</strong>`;
        if (part.startsWith("*") && part.endsWith("*") && part.length > 2) return `<em>${htmlEscape(part.slice(1, -1))}</em>`;
        return htmlEscape(part);
      })
      .join("");
  const out: string[] = [];
  let list: "ol" | "ul" | null = null;
  const close = () => {
    if (list) out.push(`</${list}>`);
    list = null;
  };
  for (const raw of md.split("\n")) {
    const line = raw.trimEnd();
    const ol = /^\s*\d+\.\s+(.*)$/.exec(line);
    const ul = /^\s*[-*]\s+(.*)$/.exec(line);
    if (ol || ul) {
      const kind = ol ? "ol" : "ul";
      if (list !== kind) {
        close();
        out.push(`<${kind}>`);
        list = kind;
      }
      out.push(`<li>${inline((ol ?? ul)![1]!)}</li>`);
      continue;
    }
    close();
    const disp = /^\s*\$\$(.+)\$\$\s*$/.exec(line);
    if (disp) out.push(`<p class="eq">${math(disp[1]!.trim(), true)}</p>`);
    else if (/^#{2,4} /.test(line)) out.push(`<h3>${inline(line.replace(/^#+ /, ""))}</h3>`);
    else if (line.trim()) out.push(`<p>${inline(line)}</p>`);
  }
  close();
  return out.join("\n");
}
