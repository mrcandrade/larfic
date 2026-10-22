import { describe, expect, it } from "vitest";
import {
  analyze, checkMeasurement, columnsToCsv, decimalPlaces, decimate, draftReport, findMeasurements, fitBand, fitLine, latexEscape, latexTable, latexText,
  linspace, markdownToHtml, markdownToLatex, measuredLatex, pgfplotsFigure, reportToHtml, reportToLatex, reportToMarkdown, reviewReport, sigFigs, unitLatex,
  type Practice, type ReportSections, type Row,
} from "../src/index.ts";

// Prática mínima: T² = (4π²/g) L, como no pêndulo.
const practice: Practice = {
  id: "teste-pendulo",
  course: "Exp I",
  title: "Pêndulo & gravidade",
  sim: "pendulos",
  objective: "Medir g.",
  materials: ["trena"],
  procedure: "### Procedimento\n1. Meça **L**.\n2. Calcule $T^2$.",
  columns: [
    { key: "L", label: "L", unit: "m", source: { param: "L" }, instrument: "trena" },
    { key: "T2", label: "T²", unit: "s²", from: ["L"], compute: (L) => L },
  ],
  minRows: 5,
  analysis: { x: "L", y: "T2", fit: "proporcional", results: [{ label: "g", unit: "m/s²", compute: (b) => (4 * Math.PI ** 2) / b, reference: 9.79 }] },
  questions: ["Por que 10 oscilações?"],
};

function rowsFor(g: number): Row[] {
  return [0.3, 0.5, 0.8, 1.0, 1.4, 1.8].map((L, i) => {
    const T2 = ((4 * Math.PI ** 2) / g) * L * (1 + 0.004 * (i % 2 ? 1 : -1));
    return { L: { value: L, u: 0.001, display: "" }, T2: { value: T2, u: 0.01 * T2, display: "" } };
  });
}

const meta = { title: practice.title, authors: "Ana Souza", date: "22/10/2026" };

describe("algarismos significativos", () => {
  it("conta algarismos e casas decimais", () => {
    expect(sigFigs("0,040")).toBe(2);
    expect(sigFigs("0,04")).toBe(1);
    expect(sigFigs("4,0")).toBe(2);
    expect(sigFigs("120")).toBe(2);
    expect(sigFigs("120,0")).toBe(4);
    expect(sigFigs("0,0123")).toBe(3);
    expect(decimalPlaces("9,790")).toBe(3);
    expect(decimalPlaces("12")).toBe(0);
    expect(decimalPlaces("1.25")).toBe(2);
  });

  it("acha expressões valor ± incerteza com parênteses, potência e unidade", () => {
    const ms = findMeasurements("g = (9,79 ± 0,04) m/s² e x = 3,2 ± 0,1 e h = (6,63 ± 0,05) × 10^-34 J·s.");
    expect(ms).toHaveLength(3);
    expect(ms[0]).toMatchObject({ value: "9,79", u: "0,04", unit: "m/s²" });
    expect(ms[1]).toMatchObject({ value: "3,2", u: "0,1", unit: "", text: "3,2 ± 0,1" });
    expect(ms[2]).toMatchObject({ value: "6,63", u: "0,05", exp: -34, unit: "J·s" });
    expect(findMeasurements("n = 1,50 ± 0,02 (adimensional)")[0]!.unit).toBe("");
  });

  it("aprova a forma correta e aponta incerteza com 3 algarismos, casas diferentes e falta de unidade", () => {
    const [ok] = findMeasurements("(9,79 ± 0,04) m/s²");
    expect(checkMeasurement(ok!)).toEqual([]);
    const [many] = findMeasurements("(9,7912 ± 0,0423) m/s²");
    const p = checkMeasurement(many!);
    expect(p.some((m) => m.includes("3 algarismos"))).toBe(true);
    expect(p.join(" ")).toContain("(9,79 ± 0,04)");
    const [place] = findMeasurements("(9,791 ± 0,04) m/s²");
    expect(checkMeasurement(place!).some((m) => m.includes("mesma casa decimal"))).toBe(true);
    const [coarse] = findMeasurements("(10 ± 0,5) cm");
    expect(checkMeasurement(coarse!).some((m) => m.includes("mesma casa decimal"))).toBe(true);
    const [nounit] = findMeasurements("g = 9,79 ± 0,04, ok");
    expect(checkMeasurement(nounit!).some((m) => m.startsWith("falta a unidade"))).toBe(true);
    expect(checkMeasurement(nounit!, { unitOptional: true })).toEqual([]);
    // Inteiros: o valor não pode ser mais fino que a incerteza; zeros à direita são aceitos.
    expect(checkMeasurement(findMeasurements("(1234 ± 30) Hz")[0]!).length).toBe(1);
    expect(checkMeasurement(findMeasurements("(1230 ± 30) Hz")[0]!)).toEqual([]);
    // Incerteza com 2 algarismos é aceita.
    expect(checkMeasurement(findMeasurements("(1,234 ± 0,012) m")[0]!)).toEqual([]);
  });
});

describe("LaTeX", () => {
  it("escapa os caracteres especiais", () => {
    expect(latexEscape("50% de R$ 3 & #1 _x {a} ~ ^ \\")).toBe("50\\% de R\\$ 3 \\& \\#1 \\_x \\{a\\} \\textasciitilde{} \\textasciicircum{} \\textbackslash{}");
    expect(latexText("θ = 30° ± 1°, T² e μc")).toBe("\\ensuremath{\\theta} = 30\\textdegree{} \\ensuremath{\\pm} 1\\textdegree{}, T\\textsuperscript{2} e \\ensuremath{\\mu}c");
  });

  it("converte unidades para modo matemático", () => {
    expect(unitLatex("m/s²")).toBe("\\mathrm{m/s}^{2}");
    expect(unitLatex("N·m")).toBe("\\mathrm{N\\cdot m}");
    expect(unitLatex("10⁻³⁴ J·s")).toBe("10^{-34}\\,\\mathrm{J\\cdot s}");
    expect(unitLatex("µA")).toBe("\\mathrm{\\mu A}");
    expect(unitLatex("°C")).toBe("{}^{\\circ}\\mathrm{C}");
    expect(unitLatex("%")).toBe("\\%");
    expect(unitLatex("")).toBe("");
  });

  it("formata valor ± incerteza com algarismos significativos corretos", () => {
    expect(measuredLatex(9.7912, 0.0423)).toBe("9{,}79 \\pm 0{,}04");
    expect(measuredLatex(1.2004, 0.0163)).toBe("1{,}200 \\pm 0{,}016");
    expect(measuredLatex(0.0961, 0.0962)).toBe("0{,}10 \\pm 0{,}10");
    expect(measuredLatex(6.6261e-34, 4.6e-36)).toBe("(6{,}63 \\pm 0{,}05) \\times 10^{-34}");
    expect(measuredLatex(9.7912, 0.0423, { decimal: "." })).toBe("9.79 \\pm 0.04");
    expect(measuredLatex(9.7912, 0.0423, { siunitx: true })).toBe("\\num{9.79 +- 0.04}");
  });

  it("monta tabela com booktabs, cabeçalho com unidade e células com incerteza", () => {
    const t = latexTable([{ label: "T²", unit: "s²" }, { label: "R_1", unit: "Ω" }], [[{ value: 1.2004, u: 0.0163 }, { value: 100.4, u: 2.3 }]], { caption: "Dados & mais", label: "tab:x", index: true });
    expect(t).toContain("\\toprule");
    expect(t).toContain("\\bottomrule");
    expect(t).toContain("\\begin{tabular}{ccc}");
    expect(t).toContain("T\\textsuperscript{2} ($\\mathrm{s}^{2}$)");
    expect(t).toContain("R\\_1 ($\\mathrm{\\Omega}$)");
    expect(t).toContain("1 & $1{,}200 \\pm 0{,}016$ & $100 \\pm 2$ \\\\");
    expect(t).toContain("\\caption{Dados \\& mais}");
    expect(latexTable([{ label: "x" }], [[1]], { booktabs: false })).toContain("\\hline");
  });

  it("gera figura em pgfplots com barras de erro explícitas e escala log", () => {
    const f = pgfplotsFigure({
      xLabel: "f (Hz)",
      yLabel: "|Z| (Ω)",
      logX: true,
      series: [
        { label: "Medidas", kind: "marks", points: [[10, 1.5], [100, 2.5], [-1, 3]], yErr: [0.1, 0.2, 0.1], xErr: [0, 0, 0] },
        { label: "Ajuste", kind: "line", points: [[10, 1.4], [100, 2.6]] },
      ],
    });
    expect(f).toContain("xmode=log");
    expect(f).toContain("y dir=both, y explicit");
    expect(f).not.toContain("x explicit");
    expect(f).toContain("(10,1.5) +- (0,0.1)");
    expect(f).not.toContain("(-1,3)");
    expect(f).toContain("ylabel={|Z| (\\ensuremath{\\Omega})}");
    expect(f).toContain("\\addlegendentry{Ajuste}");
    expect(f).toContain("/pgf/number format/use comma");
  });

  it("converte o Markdown dos roteiros preservando fórmulas", () => {
    const tex = markdownToLatex("### Passos\n1. Meça **L** com 50% de cuidado.\n2. Use $T = 2\\pi\\sqrt{L/g}$.\n$$a_x = g\\sin\\theta$$\nFim_1.");
    expect(tex).toContain("\\subsection*{Passos}");
    expect(tex).toContain("\\begin{enumerate}");
    expect(tex).toContain("\\item Meça \\textbf{L} com 50\\% de cuidado.");
    expect(tex).toContain("$T = 2\\pi\\sqrt{L/g}$");
    expect(tex).toContain("\\[ a_x = g\\sin\\theta \\]");
    expect(tex).toContain("Fim\\_1.");
    expect(markdownToHtml("a < b **c**")).toBe("<p>a &lt; b <strong>c</strong></p>");
  });
});

describe("relatório", () => {
  const rows = rowsFor(9.79);
  const res = analyze(practice, rows)!;
  const data = { practice, rows, res, answers: ["Para reduzir a incerteza."] };
  const draft = draftReport(data, { summary: "Pêndulo simples.", equations: ["T = 2\\pi\\sqrt{L/g}"] });

  it("rascunho preenche as seções a partir da prática e dos resultados", () => {
    expect(draft.objetivo).toBe("Medir g.");
    expect(draft.teoria).toContain("$$T = 2\\pi\\sqrt{L/g}$$");
    expect(draft.procedimento).toContain("Material: trena.");
    expect(draft.procedimento).not.toContain("### Procedimento");
    expect(draft.analise).toContain("χ²/ν");
    expect(draft.conclusao).toMatch(/Obtivemos g = \(9,\d\d ± 0,0\d\) m\/s², compatível/);
  });

  it("o rascunho passa na revisão automática", () => {
    expect(reviewReport(meta, draft, data)).toEqual([{ level: "ok", section: "geral", message: expect.any(String) }]);
  });

  it("revisão aponta conclusão incoerente com a compatibilidade e algarismos errados", () => {
    const off = analyze(practice, rowsFor(9.2))!;
    expect(off.results[0]!.compatible).toBe(false);
    const s: ReportSections = { ...draftReport({ practice, rows: rowsFor(9.2), res: off }), conclusao: `O valor g = (${off.results[0]!.value.toFixed(4).replace(".", ",")} ± 0,0512) m/s² está ótimo.` };
    const issues = reviewReport(meta, s, { practice, rows: rowsFor(9.2), res: off });
    expect(issues.some((i) => i.level === "erro" && i.message.includes("incompatível"))).toBe(true);
    expect(issues.some((i) => i.level === "erro" && i.message.includes("3 algarismos"))).toBe(true);
    const empty = reviewReport({ ...meta, authors: "" }, { ...draft, conclusao: "" }, { practice, rows: rows.slice(0, 2) });
    expect(empty.map((i) => i.message).join(" ")).toMatch(/autores.*Conclusão está vazia.*2 medida/s);
  });

  it("exporta Markdown, LaTeX compilável e HTML", () => {
    const md = reportToMarkdown(meta, draft, data);
    expect(md).toMatch(/^# Pêndulo & gravidade/);
    expect(md).toContain("## 4. Dados");
    expect(md).toContain("| 1 | (0,3000 ± 0,0010) |");
    expect(md).toContain("Para reduzir a incerteza.");

    const tex = reportToLatex({ ...meta, authors: "Ana & Bia" }, draft, data, { band: true, siunitx: true });
    expect(tex.startsWith("\\documentclass")).toBe(true);
    expect(tex.trim().endsWith("\\end{document}")).toBe(true);
    expect(tex).toContain("\\title{Pêndulo \\& gravidade}");
    expect(tex).toContain("\\author{Ana \\& Bia}");
    expect(tex).toContain("\\usepackage{siunitx}");
    expect(tex).toContain("\\usepgfplotslibrary{fillbetween}");
    expect(tex).toContain("\\num{");
    expect(tex).toContain("\\label{fig:ajuste}");
    // Chaves e ambientes balanceados.
    const open = (tex.match(/\\begin\{/g) ?? []).length, close = (tex.match(/\\end\{/g) ?? []).length;
    expect(open).toBe(close);
    const bare = tex.replace(/\\[{}]/g, "");
    expect((bare.match(/\{/g) ?? []).length).toBe((bare.match(/\}/g) ?? []).length);
    // Nenhum caractere especial cru fora de comandos: & só em tabelas e no autor escapado.
    expect(tex).not.toMatch(/[^\\]%/);

    const html = reportToHtml({ ...meta, authors: "<Ana>" }, draft, data, { math: (t) => `[${t}]`, figure: "data:image/png;base64,AAA" });
    expect(html).toContain("&lt;Ana&gt;");
    expect(html).toContain("[T = 2\\pi\\sqrt{L/g}]");
    expect(html).toContain('<img src="data:image/png;base64,AAA"');
    expect(html).toContain("@media print");
  });
});

describe("dados para gráficos", () => {
  it("faixa de confiança contém a curva e é mais estreita perto do centro dos dados", () => {
    const x = [1, 2, 3, 4, 5, 6];
    const y = [2.1, 3.9, 6.2, 7.8, 10.1, 12.0];
    const fit = fitLine(x, y, x.map(() => 0.2));
    const b = fitBand("linear", fit, [0, 3.5, 7]);
    for (const p of b) expect(p.lo < p.y && p.y < p.hi).toBe(true);
    const w = b.map((p) => p.hi - p.lo);
    expect(w[1]!).toBeLessThan(w[0]!);
    expect(w[1]!).toBeLessThan(w[2]!);
    expect(b[1]!.hi - b[1]!.y).toBeCloseTo(b[1]!.y - b[1]!.lo, 12);
  });

  it("malhas, redução de pontos e CSV de colunas", () => {
    expect(linspace(0, 1, 3)).toEqual([0, 0.5, 1]);
    expect(linspace(1, 100, 3, true).map((v) => Math.round(v))).toEqual([1, 10, 100]);
    const d = decimate(Array.from({ length: 1000 }, (_, i) => i), 100);
    expect(d).toHaveLength(100);
    expect(d.at(-1)).toBe(999);
    expect(columnsToCsv([{ label: "t (s)", values: [0, 0.5] }, { label: "x; y", values: [1.25, NaN] }])).toBe('t (s);"x; y"\n0;1,25\n0,5;\n');
  });
});
