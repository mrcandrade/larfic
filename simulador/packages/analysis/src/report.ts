// Gerador de relatório: estrutura (objetivo, teoria, procedimento, dados, análise, conclusão),
// rascunho a partir da prática, exportação (Markdown, LaTeX, HTML) e revisão automática.
import { htmlEscape, latexTable, latexText, markdownToHtml, markdownToLatex, measuredLatex, numberLatex, pgfplotsFigure, unitLatex, type PgfSeries } from "./latex.ts";
import { fitBand, linspace } from "./plotdata.ts";
import type { AnalysisResult, FitKind, Practice, Row } from "./practice.ts";
import { reviewText, type ReviewIssue } from "./sigfig.ts";
import { formatMeasured, roundResult } from "./uncertainty.ts";

export interface ReportSections {
  objetivo: string;
  teoria: string;
  procedimento: string;
  /** Discussão da análise (o bloco com ajuste e resultados é gerado automaticamente antes dela). */
  analise: string;
  conclusao: string;
}

/** Chave do rascunho do relatório no armazenamento local (por prática). */
export const reportKey = (practiceId: string) => `fisilab.relatorio.${practiceId}.v1`;

/** O que a bancada guarda do relatório: só as seções editadas (as outras seguem o rascunho automático). */
export interface SavedReport {
  meta: { authors: string; course: string; date: string };
  sections: Partial<ReportSections>;
}

/** Junta as seções editadas com o rascunho automático. */
export function mergeSections(draft: ReportSections, edited: Partial<ReportSections> = {}): ReportSections {
  return { ...draft, ...Object.fromEntries(Object.entries(edited).filter(([, v]) => typeof v === "string")) };
}

export const SECTION_TITLES: Record<keyof ReportSections, string> = {
  objetivo: "Objetivo",
  teoria: "Teoria",
  procedimento: "Procedimento",
  analise: "Análise",
  conclusao: "Conclusão",
};

export interface ReportMeta {
  title: string;
  authors: string;
  date: string;
  course?: string;
}

export interface ReportData {
  practice: Practice;
  rows: Row[];
  res?: AnalysisResult;
  answers?: string[];
}

export interface ReportExportOptions {
  siunitx?: boolean;
  booktabs?: boolean;
  /** Inclui a figura (pgfplots no LaTeX). Padrão: sim, quando há análise. */
  figure?: boolean;
  /** Faixa de confiança de 95% em torno do ajuste. */
  band?: boolean;
  logX?: boolean;
  logY?: boolean;
}

const br = (v: number, d = 2) => v.toFixed(d).replace(".", ",");

/** Modelo do ajuste em TeX e nome de cada parâmetro. */
export function fitModel(kind: FitKind): { tex: string; name: string; params: string[] } {
  switch (kind) {
    case "proporcional": return { tex: "y = b\\,x", name: "reta pela origem", params: ["b"] };
    case "quadratico": return { tex: "y = c_0 + c_1 x + c_2 x^2", name: "polinômio de grau 2", params: ["c₀", "c₁", "c₂"] };
    case "exponencial": return { tex: "y = A\\,e^{b x}", name: "exponencial (linearizada por ln y)", params: ["A", "b"] };
    case "potencia": return { tex: "y = A\\,x^{n}", name: "lei de potência (linearizada em log-log)", params: ["A", "n"] };
    default: return { tex: "y = a + b\\,x", name: "reta", params: ["a", "b"] };
  }
}

const ratio = (yu: string, xu: string) => {
  if (!xu) return yu;
  const den = /[/·\s]/.test(xu) ? `(${xu})` : xu;
  return yu ? `${yu}/${den}` : `1/${den}`;
};

/** Fator que `analyze` aplica às incertezas dos parâmetros (√(χ²/ν) quando há pesos e χ²/ν > 1). */
export function paramScale(res: AnalysisResult): number {
  return Number.isFinite(res.fit.q) && res.fit.chi2red > 1 ? Math.sqrt(res.fit.chi2red) : 1;
}

/** Parâmetros do ajuste com incerteza e unidade (quando dá para deduzir). */
export function fitParams(practice: Practice, res: AnalysisResult): { name: string; value: number; u: number; unit: string }[] {
  const a = practice.analysis!;
  const unit = (k: string) => practice.columns.find((c) => c.key === k)?.unit ?? "";
  const xu = unit(a.x), yu = unit(a.y);
  const m = fitModel(a.fit);
  const s = paramScale(res);
  const units = a.fit === "linear" ? [yu, ratio(yu, xu)] : a.fit === "proporcional" ? [ratio(yu, xu)] : [];
  return res.fit.p.map((v, i) => ({ name: m.params[i] ?? `p${i}`, value: v, u: res.fit.sigma[i]! * s, unit: units[i] ?? "" }));
}

const colLabel = (practice: Practice, k: string) => {
  const c = practice.columns.find((c) => c.key === k);
  return c ? (c.unit ? `${c.label} (${c.unit})` : c.label) : k;
};

function chi2Comment(res: AnalysisResult): string {
  if (!Number.isFinite(res.fit.q)) return "Como o ajuste foi feito sem pesos, as incertezas dos parâmetros foram estimadas pela dispersão dos pontos em torno da curva.";
  const c = res.fit.chi2red;
  if (c < 0.3) return `O valor χ²/ν = ${br(c)} é bem menor que 1: as incertezas das medidas provavelmente estão superestimadas.`;
  if (c <= 2) return `O valor χ²/ν = ${br(c)} é compatível com 1: os pontos se espalham em torno da curva como as barras de erro indicam.`;
  return `O valor χ²/ν = ${br(c)} é maior que 2: a dispersão é maior do que as barras de erro indicam (incertezas subestimadas ou modelo inadequado); por isso as incertezas dos parâmetros foram multiplicadas por √(χ²/ν).`;
}

/** Rascunho editável do relatório, montado a partir da prática, das medidas e do modelo da simulação. */
export function draftReport(data: ReportData, theory: { summary?: string; equations?: string[] } = {}): ReportSections {
  const { practice, rows, res } = data;
  const a = practice.analysis;
  const teoria = [theory.summary ?? "", ...(theory.equations?.length ? ["", "O modelo usado:", "", ...theory.equations.map((e) => `$$${e}$$`)] : [])];
  if (a) {
    const m = fitModel(a.fit);
    teoria.push("", `A análise usa o gráfico de ${colLabel(practice, a.y)} contra ${colLabel(practice, a.x)}, ajustado por ${m.name}: $${m.tex}$.`);
  }
  const proc = practice.procedure.replace(/^#{2,4} Procedimento\s*\n/, "");
  const materials = practice.materials.length ? `Material: ${practice.materials.join(", ")}.\n\n` : "";
  let analise = "";
  let conclusao = "";
  if (a && res) {
    const m = fitModel(a.fit);
    analise = [
      `Os ${rows.length} pontos foram ajustados por ${m.name} ($${m.tex}$) pelo método dos mínimos quadrados${Number.isFinite(res.fit.q) ? ", com as incertezas de y como pesos" : ""}.`,
      chi2Comment(res),
      `O coeficiente de determinação é R² = ${br(res.fit.r2, 4)}.`,
    ].join(" ");
    conclusao = res.results
      .map((r) => {
        const base = `Obtivemos ${r.label} = ${r.text}`;
        if (r.reference === undefined) return `${base}.`;
        const ref = `${String(r.reference).replace(".", ",")}${r.unit ? ` ${r.unit}` : ""}`;
        return r.compatible
          ? `${base}, compatível com o valor de referência ${ref} (discrepância de ${br(r.z!, 1)} incerteza${r.z! >= 2 || r.z! < 1 ? "s" : ""}).`
          : `${base}, incompatível com o valor de referência ${ref} (discrepância de ${br(r.z!, 1)} incertezas). Discuta as possíveis fontes de erro sistemático.`;
      })
      .join(" ");
  } else if (a) {
    analise = `Registre pelo menos ${Math.max(3, practice.minRows ?? 3)} medidas para fazer o ajuste.`;
  }
  return { objetivo: practice.objective, teoria: teoria.join("\n").trim(), procedimento: `${materials}${proc}`.trim(), analise, conclusao };
}

/** Bloco automático da análise em Markdown: parâmetros, χ² e resultados com compatibilidade. */
export function analysisBlockMarkdown(data: ReportData): string {
  const { practice, res } = data;
  if (!practice.analysis || !res) return "";
  const out = [`Ajuste: $${fitModel(practice.analysis.fit).tex}$, χ²/ν = ${br(res.fit.chi2red)}, R² = ${br(res.fit.r2, 4)}.`, ""];
  for (const p of fitParams(practice, res)) out.push(`- ${p.name} = ${formatMeasured(p.value, p.u, p.unit)}`);
  for (const r of res.results) {
    const ref = r.reference !== undefined ? ` (referência ${String(r.reference).replace(".", ",")}${r.unit ? ` ${r.unit}` : ""}; ${r.compatible ? "compatível" : "incompatível"}, z = ${br(r.z!, 1)})` : "";
    out.push(`- **${r.label}** = ${r.text}${ref}`);
  }
  return out.join("\n");
}

function dataTableMarkdown(practice: Practice, rows: Row[]): string {
  const cols = practice.columns;
  const out = [`| # | ${cols.map((c) => (c.unit ? `${c.label} (${c.unit})` : c.label)).join(" | ")} |`, `|---|${cols.map(() => "---").join("|")}|`];
  rows.forEach((r, i) => out.push(`| ${i + 1} | ${cols.map((c) => formatMeasured(r[c.key]!.value, r[c.key]!.u)).join(" | ")} |`));
  return out.join("\n");
}

function questionsMarkdown(practice: Practice, answers: string[] = []): string {
  return practice.questions.map((q, i) => `${i + 1}. ${q}${answers[i]?.trim() ? `\n\n   ${answers[i]!.trim().replace(/\n/g, "\n   ")}` : ""}`).join("\n\n");
}

/** Relatório completo em Markdown. */
export function reportToMarkdown(meta: ReportMeta, s: ReportSections, data: ReportData): string {
  const { practice, rows } = data;
  const out = [`# ${meta.title}`, "", [meta.authors, meta.course, meta.date].filter(Boolean).join(" · "), ""];
  const sec = (n: number, k: keyof ReportSections, body: string) => out.push(`## ${n}. ${SECTION_TITLES[k]}`, "", body.trim() || "_(a preencher)_", "");
  sec(1, "objetivo", s.objetivo);
  sec(2, "teoria", s.teoria);
  sec(3, "procedimento", s.procedimento);
  out.push("## 4. Dados", "", rows.length ? `Tabela 1: medidas com incerteza padrão.\n\n${dataTableMarkdown(practice, rows)}` : "_(sem medidas)_", "");
  const block = analysisBlockMarkdown(data);
  sec(5, "analise", [block, s.analise].filter((x) => x.trim()).join("\n\n"));
  sec(6, "conclusao", s.conclusao);
  if (practice.questions.length) out.push("## Questões", "", questionsMarkdown(practice, data.answers), "");
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

/** Tabela de dados de uma prática em LaTeX. */
export function practiceLatexTable(practice: Practice, rows: Row[], opts: ReportExportOptions = {}): string {
  return latexTable(
    practice.columns.map((c) => ({ label: c.label, unit: c.unit })),
    rows.map((r) => practice.columns.map((c) => ({ value: r[c.key]!.value, u: r[c.key]!.u }))),
    { caption: `Medidas com incerteza padrão: ${practice.title}.`, label: "tab:dados", booktabs: opts.booktabs ?? true, siunitx: opts.siunitx, index: true },
  );
}

/** Séries do gráfico da prática (pontos com barras de erro, ajuste e faixa opcional). */
export function practiceSeries(data: ReportData, opts: ReportExportOptions = {}): PgfSeries[] {
  const { practice, rows, res } = data;
  const a = practice.analysis;
  if (!a || !rows.length) return [];
  const out: PgfSeries[] = [
    { label: "Medidas", kind: "marks", points: rows.map((r) => [r[a.x]!.value, r[a.y]!.value]), xErr: rows.map((r) => r[a.x]!.u), yErr: rows.map((r) => r[a.y]!.u) },
  ];
  if (res) {
    const xs = rows.map((r) => r[a.x]!.value);
    const lo = Math.min(...xs, a.fit === "proporcional" && !opts.logX ? 0 : Infinity), hi = Math.max(...xs);
    const grid = linspace(lo, hi, 50, opts.logX);
    if (opts.band) {
      const b = fitBand(a.fit, res.fit, grid, 0.95, paramScale(res));
      out.push({ label: "Faixa de 95%", kind: "band", points: b.map((p) => [p.x, p.lo]), hi: b.map((p) => p.hi) });
    }
    out.push({ label: "Ajuste", kind: "line", points: grid.map((x) => [x, res.fit.f(x)]) });
  }
  return out;
}

/** Figura da prática em pgfplots. */
export function practiceFigure(data: ReportData, opts: ReportExportOptions = {}): string {
  const a = data.practice.analysis;
  if (!a) return "";
  return pgfplotsFigure({
    xLabel: a.xLabel ?? colLabel(data.practice, a.x),
    yLabel: a.yLabel ?? colLabel(data.practice, a.y),
    series: practiceSeries(data, opts),
    logX: opts.logX,
    logY: opts.logY,
    caption: `${a.yLabel ?? colLabel(data.practice, a.y)} em função de ${a.xLabel ?? colLabel(data.practice, a.x)}, com barras de erro e a curva ajustada.`,
    label: "fig:ajuste",
  });
}

function analysisBlockLatex(data: ReportData, opts: ReportExportOptions): string {
  const { practice, res } = data;
  if (!practice.analysis || !res) return "";
  const num = (v: number, u: number, unit: string) => {
    const s = measuredLatex(v, u, opts);
    const unitTex = unit ? unitLatex(unit) : "";
    if (opts.siunitx) return `${s}${unit ? ` $${unitTex}$` : ""}`;
    const core = roundResult(v, u).exp || !unit ? s : `(${s})`;
    return `$${core}${unit ? `\\,${unitTex}` : ""}$`;
  };
  const out = [`Ajuste: $${fitModel(practice.analysis.fit).tex}$, $\\chi^2/\\nu = ${numberLatex(Number(res.fit.chi2red.toFixed(2)), 3)}$, $R^2 = ${numberLatex(Number(res.fit.r2.toFixed(4)), 4)}$.`, "", "\\begin{itemize}"];
  for (const p of fitParams(practice, res)) out.push(`  \\item ${latexText(p.name)} = ${num(p.value, p.u, p.unit)}`);
  for (const r of res.results) {
    const ref = r.reference !== undefined ? ` --- ${r.compatible ? "compatível" : "incompatível"} com o valor de referência $${numberLatex(r.reference, 6)}${r.unit ? `\\,${unitLatex(r.unit)}` : ""}$ ($z = ${numberLatex(Number(r.z!.toFixed(1)), 3)}$)` : "";
    out.push(`  \\item \\textbf{${latexText(r.label)}} = ${num(r.value, r.u, r.unit)}${ref}`);
  }
  out.push("\\end{itemize}");
  return out.join("\n");
}

/** Documento LaTeX completo e compilável (pdflatex) com tabela, figura em pgfplots e resultados. */
export function reportToLatex(meta: ReportMeta, s: ReportSections, data: ReportData, opts: ReportExportOptions = {}): string {
  const { practice, rows, res } = data;
  const fig = (opts.figure ?? true) && practice.analysis && rows.length > 0;
  const pre = [
    "\\documentclass[11pt,a4paper]{article}",
    "\\usepackage[utf8]{inputenc}",
    "\\usepackage[T1]{fontenc}",
    "\\usepackage[brazil]{babel}",
    "\\usepackage{lmodern}",
    "\\usepackage{textcomp}",
    "\\usepackage{amsmath,amssymb}",
    "\\usepackage[margin=2.5cm]{geometry}",
    "\\usepackage{booktabs}",
    ...(opts.siunitx ? ["\\usepackage{siunitx}", "\\sisetup{output-decimal-marker={,}, separate-uncertainty=true}"] : []),
    ...(fig ? ["\\usepackage{pgfplots}", "\\pgfplotsset{compat=1.17}", ...(opts.band ? ["\\usepgfplotslibrary{fillbetween}"] : [])] : []),
    "",
    `\\title{${latexText(meta.title)}}`,
    `\\author{${latexText(meta.authors || "Autor")}${meta.course ? ` \\\\ ${latexText(meta.course)}` : ""}}`,
    `\\date{${latexText(meta.date)}}`,
    "",
    "\\begin{document}",
    "\\maketitle",
    "",
  ];
  const body: string[] = [];
  const sec = (k: keyof ReportSections, text: string) => body.push(`\\section{${SECTION_TITLES[k]}}`, text.trim() ? markdownToLatex(text) : "\\emph{(a preencher)}", "");
  sec("objetivo", s.objetivo);
  sec("teoria", s.teoria);
  sec("procedimento", s.procedimento);
  body.push("\\section{Dados}");
  if (rows.length) {
    body.push(`A Tabela~\\ref{tab:dados} reúne as medidas${fig ? " e a Figura~\\ref{fig:ajuste} mostra o gráfico com barras de erro" : ""}.`, "", practiceLatexTable(practice, rows, opts), "");
    if (fig) body.push(practiceFigure(data, opts), "");
  } else body.push("\\emph{(sem medidas)}", "");
  body.push("\\section{Análise}");
  if (res) body.push(analysisBlockLatex(data, opts), "");
  if (s.analise.trim()) body.push(markdownToLatex(s.analise), "");
  sec("conclusao", s.conclusao);
  if (practice.questions.length) {
    body.push("\\section*{Questões}", "\\begin{enumerate}");
    practice.questions.forEach((q, i) => {
      body.push(`  \\item ${markdownToLatex(q)}`);
      const ans = data.answers?.[i]?.trim();
      if (ans) body.push("", `  ${markdownToLatex(ans)}`);
    });
    body.push("\\end{enumerate}", "");
  }
  return [...pre, ...body, "\\end{document}", ""].join("\n");
}

export interface HtmlExportOptions {
  /** Converte TeX em HTML (ex.: KaTeX com saída MathML). Padrão: deixa o TeX entre \( \). */
  math?: (tex: string, display: boolean) => string;
  /** Imagem do gráfico (data URL do PNG). */
  figure?: string;
}

/** Documento HTML autocontido, pronto para imprimir ou salvar em PDF. */
export function reportToHtml(meta: ReportMeta, s: ReportSections, data: ReportData, opts: HtmlExportOptions = {}): string {
  const { practice, rows } = data;
  const md = (t: string) => (t.trim() ? markdownToHtml(t, opts.math) : "<p><em>(a preencher)</em></p>");
  const cols = practice.columns;
  const table = rows.length
    ? `<table><caption>Tabela 1: medidas com incerteza padrão.</caption><thead><tr><th>#</th>${cols.map((c) => `<th>${htmlEscape(c.unit ? `${c.label} (${c.unit})` : c.label)}</th>`).join("")}</tr></thead><tbody>${rows
        .map((r, i) => `<tr><td>${i + 1}</td>${cols.map((c) => `<td>${htmlEscape(formatMeasured(r[c.key]!.value, r[c.key]!.u))}</td>`).join("")}</tr>`)
        .join("")}</tbody></table>`
    : "<p><em>(sem medidas)</em></p>";
  const fig = opts.figure ? `<figure><img src="${opts.figure}" alt="Gráfico com barras de erro e curva ajustada"><figcaption>Figura 1: gráfico com barras de erro e a curva ajustada.</figcaption></figure>` : "";
  const block = analysisBlockMarkdown(data);
  const questions = practice.questions.length ? `<h2>Questões</h2>${markdownToHtml(questionsMarkdown(practice, data.answers), opts.math)}` : "";
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${htmlEscape(meta.title)}</title>
<style>
body { font-family: Georgia, "Times New Roman", serif; color: #111; background: #fff; max-width: 46rem; margin: 2rem auto; padding: 0 1rem; line-height: 1.5; }
h1 { font-size: 1.6rem; margin-bottom: 0.2rem; } h2 { font-size: 1.2rem; margin-top: 1.6rem; border-bottom: 1px solid #ccc; } h3 { font-size: 1rem; }
.meta { color: #444; margin-top: 0; }
table { border-collapse: collapse; margin: 1rem auto; font-size: 0.92rem; } caption { caption-side: top; margin-bottom: 0.3rem; }
th, td { padding: 0.25rem 0.6rem; text-align: center; } thead th { border-top: 2px solid #111; border-bottom: 1px solid #111; } tbody tr:last-child td { border-bottom: 2px solid #111; }
figure { margin: 1rem 0; text-align: center; } figure img { max-width: 100%; } figcaption { font-size: 0.9rem; color: #333; }
.eq { text-align: center; overflow-x: auto; }
@media print { body { margin: 0; max-width: none; } h2 { break-after: avoid; } table, figure { break-inside: avoid; } }
</style>
</head>
<body>
<h1>${htmlEscape(meta.title)}</h1>
<p class="meta">${htmlEscape([meta.authors, meta.course, meta.date].filter(Boolean).join(" · "))}</p>
<h2>1. Objetivo</h2>
${md(s.objetivo)}
<h2>2. Teoria</h2>
${md(s.teoria)}
<h2>3. Procedimento</h2>
${md(s.procedimento)}
<h2>4. Dados</h2>
${table}
${fig}
<h2>5. Análise</h2>
${block ? markdownToHtml(block, opts.math) : ""}
${s.analise.trim() ? markdownToHtml(s.analise, opts.math) : ""}
<h2>6. Conclusão</h2>
${md(s.conclusao)}
${questions}
</body>
</html>
`;
}

const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/**
 * Revisão automática por regras locais: seções vazias, número de medidas, algarismos
 * significativos e unidades nas expressões "valor ± incerteza", qualidade do ajuste e
 * coerência da conclusão com o teste de compatibilidade.
 */
export function reviewReport(meta: ReportMeta, s: ReportSections, data: ReportData): ReviewIssue[] {
  const { practice, rows, res } = data;
  const issues: ReviewIssue[] = [];
  if (!meta.authors.trim()) issues.push({ level: "aviso", section: "geral", message: "Informe o nome dos autores." });
  for (const k of Object.keys(SECTION_TITLES) as (keyof ReportSections)[]) {
    if (!s[k].trim()) issues.push({ level: k === "conclusao" || k === "objetivo" ? "erro" : "aviso", section: SECTION_TITLES[k], message: `A seção ${SECTION_TITLES[k]} está vazia.` });
  }
  const min = Math.max(3, practice.minRows ?? 3);
  if (rows.length < min) issues.push({ level: "erro", section: "Dados", message: `Há ${rows.length} medida(s); a análise precisa de pelo menos ${min}.` });
  const zeroU = practice.columns.filter((c) => rows.some((r) => !(r[c.key]!.u > 0)));
  for (const c of zeroU) issues.push({ level: "aviso", section: "Dados", message: `A coluna ${c.label} tem medidas sem incerteza.` });

  // Grandezas adimensionais conhecidas não precisam de unidade.
  const dimless = [...(res?.results.filter((r) => !r.unit) ?? []), ...practice.columns.filter((c) => !c.unit).flatMap((c) => rows.map((r) => ({ value: r[c.key]!.value, u: r[c.key]!.u })))];
  const isDimless = (m: { value: string; u: string; exp?: number }) => {
    const v = Number(m.value.replace("−", "-").replace(",", ".")) * 10 ** (m.exp ?? 0);
    const u = Number(m.u.replace(",", ".")) * 10 ** (m.exp ?? 0);
    return dimless.some((d) => Math.abs(d.value - v) <= 2 * Math.max(d.u, u));
  };
  for (const k of Object.keys(SECTION_TITLES) as (keyof ReportSections)[]) issues.push(...reviewText(s[k], SECTION_TITLES[k], isDimless));

  if (res) {
    const discussed = /χ|chi|qui-quadrado|dispers|superestim|subestim/i.test(s.analise);
    if (Number.isFinite(res.fit.q) && res.fit.chi2red > 3 && !discussed)
      issues.push({ level: "aviso", section: "Análise", message: `χ²/ν = ${br(res.fit.chi2red)} é alto: comente na análise se as incertezas estão subestimadas ou se o modelo é inadequado.` });
    if (Number.isFinite(res.fit.q) && res.fit.chi2red < 0.2 && !discussed) issues.push({ level: "aviso", section: "Análise", message: `χ²/ν = ${br(res.fit.chi2red)} é muito baixo: as incertezas podem estar superestimadas.` });
    const concl = norm(s.conclusao);
    const both = `${s.conclusao}\n${s.analise}`;
    const saysIncompat = /incompat|nao (e |sao |foi |ficou )?compat|discrep/.test(concl);
    for (const r of res.results) {
      const rr = roundResult(r.value, r.u);
      if (!both.includes(rr.value)) issues.push({ level: "aviso", section: "Conclusão", message: `A conclusão não cita o valor obtido de ${r.label} (${r.text}).` });
      if (r.reference === undefined) continue;
      if (!r.compatible && !saysIncompat)
        issues.push({ level: "erro", section: "Conclusão", message: `${r.label} é incompatível com a referência (z = ${br(r.z!, 1)} > 2), mas a conclusão não discute a discrepância.` });
      if (r.compatible && /incompat/.test(concl) && res.results.every((x) => x.compatible !== false))
        issues.push({ level: "aviso", section: "Conclusão", message: `A conclusão fala em incompatibilidade, mas ${r.label} é compatível com a referência (z = ${br(r.z!, 1)} ≤ 2).` });
    }
  } else if (practice.analysis) {
    issues.push({ level: "aviso", section: "Análise", message: "Ainda não há ajuste: registre mais medidas." });
  }
  if (!issues.length) issues.push({ level: "ok", section: "geral", message: "Nenhum problema encontrado pelas regras automáticas." });
  return issues;
}

