import { useEffect, useMemo, useRef, useState } from "react";
import { hashSeed, rng, type Runner, type Theme } from "@fisilab/core";
import {
  analyze, draftReport, fitBand, isDerived, linspace, measureRow, mergeSections, paramScale, practiceFigure, practiceLatexTable, reportKey, reportToHtml,
  reportToLatex, reportToMarkdown, reviewReport, rowsToCsv, SECTION_TITLES, type Practice, type ReportMeta, type ReportSections, type Row, type SavedReport,
} from "@fisilab/analysis";
import { askReportReview, type TutorClientOptions } from "@fisilab/platform";
import { Markdown } from "./Guide.tsx";
import { Plot, downloadBlob, downloadPlotPng, plotToDataUrl, type PlotProps, type PlotSeries } from "./Plot.tsx";
import { copyText, mathml, openForPrint } from "./report.ts";
import "./report.css";

interface Saved {
  rows: Row[];
  answers: string[];
  draws: number;
}

const key = (id: string) => `fisilab.pratica.${id}.v1`;

function load(id: string): Saved {
  try {
    const s = JSON.parse(localStorage.getItem(key(id)) ?? "null") as Saved | null;
    if (s && Array.isArray(s.rows)) return s;
  } catch {
    // sem armazenamento: começa vazio
  }
  return { rows: [], answers: [], draws: 0 };
}

interface ReportState extends SavedReport {
  view: { logX: boolean; logY: boolean; band: boolean; residuals: boolean; siunitx: boolean };
}

function loadReport(id: string): ReportState {
  const base: ReportState = {
    meta: { authors: "", course: "", date: new Date().toLocaleDateString("pt-BR") },
    sections: {},
    view: { logX: false, logY: false, band: true, residuals: false, siunitx: false },
  };
  try {
    const s = JSON.parse(localStorage.getItem(reportKey(id)) ?? "null") as Partial<ReportState> | null;
    if (s) return { meta: { ...base.meta, ...s.meta }, sections: s.sections ?? {}, view: { ...base.view, ...s.view } };
  } catch {
    // sem armazenamento
  }
  return base;
}

export interface BenchProps {
  practice: Practice;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  runner: Runner<any>;
  theme: Theme;
  /** Identifica o aluno para sortear erros de zero e ruído reprodutíveis (ex.: matrícula). */
  studentId?: string;
  /** Tutor de IA configurado: habilita "Pedir revisão ao tutor" no relatório. */
  tutor?: TutorClientOptions;
}

const SECTIONS = Object.keys(SECTION_TITLES) as (keyof ReportSections)[];

/** Bancada de uma prática: roteiro, registro de medidas com instrumentos, tabela, ajuste e relatório. */
export function Bench({ practice, runner, theme, studentId = "anonimo", tutor }: BenchProps) {
  const [saved, setSaved] = useState<Saved>(() => load(practice.id));
  const [report, setReport] = useState<ReportState>(() => loadReport(practice.id));
  const [status, setStatus] = useState("");
  const [showReview, setShowReview] = useState(false);
  const [tutorReview, setTutorReview] = useState<{ busy: boolean; text: string }>({ busy: false, text: "" });
  const seed = hashSeed(`${studentId}:${practice.id}`);
  const randRef = useRef<() => number>(rng(seed));

  // Avança o gerador até o ponto em que estava, para continuar reprodutível após recarregar.
  useEffect(() => {
    const r = rng(seed);
    for (let i = 0; i < saved.draws; i++) r();
    randRef.current = r;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed]);

  useEffect(() => {
    try {
      localStorage.setItem(key(practice.id), JSON.stringify(saved));
    } catch {
      // ignora
    }
  }, [practice.id, saved]);
  useEffect(() => {
    try {
      localStorage.setItem(reportKey(practice.id), JSON.stringify(report));
    } catch {
      // ignora
    }
  }, [practice.id, report]);

  // Erro de zero sorteado por aluno nos instrumentos com escala (paquímetro, micrômetro).
  const zeroErrors = useMemo(() => {
    const r = rng(seed ^ 0x5bd1e995);
    const z: Record<string, number> = {};
    for (const c of practice.columns) {
      if (isDerived(c)) continue;
      const name = typeof c.instrument === "string" ? c.instrument : c.instrument.id;
      if (name === "paquimetro" || name === "micrometro") z[c.key] = Math.round((r() - 0.5) * 4) * (name === "paquimetro" ? 0.05 : 0.01);
    }
    return z;
  }, [practice, seed]);

  const record = () => {
    let draws = 0;
    const base = randRef.current;
    const counted = () => (draws++, base());
    const row = measureRow(practice, { params: runner.params, t: runner.t, value: (k) => runner.value(k) }, counted, zeroErrors);
    setSaved((s) => ({ ...s, rows: [...s.rows, row], draws: s.draws + draws }));
  };
  const remove = (i: number) => setSaved((s) => ({ ...s, rows: s.rows.filter((_, j) => j !== i) }));
  const clear = () => {
    if (confirm("Apagar todas as medidas desta prática?")) setSaved((s) => ({ ...s, rows: [] }));
  };

  const res = useMemo(() => analyze(practice, saved.rows), [practice, saved.rows]);
  const a = practice.analysis;
  const view = report.view;
  const setView = (v: Partial<ReportState["view"]>) => setReport((r) => ({ ...r, view: { ...r.view, ...v } }));
  const label = (k: string) => {
    const c = practice.columns.find((c) => c.key === k);
    return c ? (c.unit ? `${c.label} (${c.unit})` : c.label) : k;
  };
  const say = (text: string) => {
    setStatus(text);
    setTimeout(() => setStatus((s) => (s === text ? "" : s)), 3000);
  };

  const series = useMemo((): PlotSeries[] => {
    if (!a || !saved.rows.length) return [];
    const pts = saved.rows.map((r) => [r[a.x]!.value, r[a.y]!.value] as [number, number]);
    const out: PlotSeries[] = [];
    if (res) {
      const xs = pts.map((p) => p[0]);
      const lo = Math.min(...xs, a.fit === "proporcional" && !view.logX ? 0 : Infinity), hi = Math.max(...xs);
      const grid = linspace(lo, hi, 60, view.logX);
      if (view.band) {
        const b = fitBand(a.fit, res.fit, grid, 0.95, paramScale(res));
        out.push({ label: "Faixa de 95%", kind: "band", points: b.map((p) => [p.x, p.lo]), hi: b.map((p) => p.hi), color: theme.series[1] });
      }
      out.push({ label: "Ajuste", kind: "line", points: grid.map((x) => [x, res.fit.f(x)]), color: theme.series[1] });
    }
    out.push({ label: "Medidas", kind: "scatter", points: pts, yErr: saved.rows.map((r) => r[a.y]!.u), xErr: saved.rows.map((r) => r[a.x]!.u), color: theme.series[0] });
    return out;
  }, [a, saved.rows, res, theme, view.band, view.logX]);

  const xPad = useMemo((): [number, number] | undefined => {
    if (!a || !saved.rows.length) return undefined;
    const xs = saved.rows.map((r) => r[a.x]!.value);
    const lo = Math.min(...xs, a.fit === "proporcional" && !view.logX ? 0 : Infinity), hi = Math.max(...xs);
    if (view.logX) return lo > 0 ? [lo / 1.08, hi * 1.08] : undefined;
    const d = 0.04 * (hi - lo || 1);
    return [lo - d, hi + d];
  }, [a, saved.rows, view.logX]);
  const plot: PlotProps | null = a
    ? { xRange: xPad, series, xLabel: a.xLabel ?? label(a.x), yLabel: a.yLabel ?? label(a.y), theme, includeZero: a.fit === "proporcional" && !view.logY, logX: view.logX, logY: view.logY }
    : null;

  const residualPlot = useMemo((): PlotProps | null => {
    if (!a || !res) return null;
    const xs = saved.rows.map((r) => r[a.x]!.value);
    const lo = Math.min(...xs), hi = Math.max(...xs);
    return {
      series: [
        { label: "zero", kind: "line", points: [[lo, 0], [hi, 0]], color: theme.muted, width: 1, dash: [4, 4], legend: false },
        { label: "Resíduos", kind: "scatter", points: xs.map((x, i) => [x, res.fit.residuals[i]!]), yErr: saved.rows.map((r) => r[a.y]!.u), color: theme.series[0] },
      ],
      xLabel: a.xLabel ?? label(a.x),
      yLabel: `y − ajuste${practice.columns.find((c) => c.key === a.y)?.unit ? ` (${practice.columns.find((c) => c.key === a.y)!.unit})` : ""}`,
      theme,
      logX: view.logX,
      // Folga nas bordas para os pontos extremos não ficarem colados na moldura.
      xRange: view.logX ? [lo / 1.08, hi * 1.08] : [lo - 0.04 * (hi - lo || 1), hi + 0.04 * (hi - lo || 1)],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a, res, saved.rows, theme, view.logX]);

  // Relatório: seções editadas sobre o rascunho automático.
  const data = { practice, rows: saved.rows, res, answers: saved.answers };
  const draft = useMemo(() => draftReport({ practice, rows: saved.rows, res }, { summary: runner.sim.summary, equations: runner.sim.equations }), [practice, saved.rows, res, runner.sim]);
  const sections = mergeSections(draft, report.sections);
  const meta: ReportMeta = { title: practice.title, authors: report.meta.authors, course: report.meta.course || undefined, date: report.meta.date };
  const review = useMemo(() => reviewReport(meta, sections, data), [JSON.stringify(meta), JSON.stringify(sections), saved.rows, res]); // eslint-disable-line react-hooks/exhaustive-deps
  const nErr = review.filter((i) => i.level === "erro").length, nWarn = review.filter((i) => i.level === "aviso").length;
  const exportOpts = { siunitx: view.siunitx, band: view.band, logX: view.logX, logY: view.logY };

  const copyOrDownload = async (text: string, file: string, what: string) => {
    if (await copyText(text)) say(`${what} copiada: cole no seu arquivo .tex.`);
    else {
      downloadBlob(file, text, "application/x-tex;charset=utf-8");
      say(`${what} baixada (${file}).`);
    }
  };

  const exportHtml = async (print: boolean) => {
    const figure = plot && saved.rows.length ? await plotToDataUrl(plot, { title: practice.title }) : undefined;
    const html = reportToHtml(meta, sections, data, { math: mathml, figure });
    if (print) {
      if (!openForPrint(html)) {
        downloadBlob(`${practice.id}-relatorio.html`, html, "text/html;charset=utf-8");
        say("O navegador bloqueou a nova aba: o HTML foi baixado; abra e imprima.");
      }
    } else downloadBlob(`${practice.id}-relatorio.html`, html, "text/html;charset=utf-8");
  };

  const askTutorReview = async () => {
    setTutorReview({ busy: true, text: "" });
    const answer = await askReportReview(reportToMarkdown(meta, sections, data), tutor);
    setTutorReview({ busy: false, text: answer ?? "O tutor não respondeu agora (sem conexão ou limite atingido). A revisão automática acima continua valendo." });
  };

  return (
    <div className="fl-bench">
      <h2>Bancada: {practice.title}</h2>
      <p>
        <strong>Objetivo.</strong> {practice.objective}
      </p>
      {practice.materials.length > 0 && (
        <p className="fl-muted">
          <strong>Material:</strong> {practice.materials.join(", ")}.
        </p>
      )}
      <details open>
        <summary>Procedimento</summary>
        <Markdown text={practice.procedure} />
      </details>

      <div className="fl-bench-actions">
        <button className="fl-btn fl-primary" onClick={record}>
          Registrar medida
        </button>
        <span className="fl-muted">{saved.rows.length} medida(s)</span>
        {saved.rows.length > 0 && (
          <button className="fl-btn" onClick={clear}>
            Limpar
          </button>
        )}
      </div>

      {saved.rows.length > 0 && (
        <>
          <div className="fl-table-wrap">
            <table className="fl-table">
              <thead>
                <tr>
                  <th>#</th>
                  {practice.columns.map((c) => (
                    <th key={c.key}>{label(c.key)}</th>
                  ))}
                  <th />
                </tr>
              </thead>
              <tbody>
                {saved.rows.map((r, i) => (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    {practice.columns.map((c) => (
                      <td key={c.key} title={r[c.key]?.readings ? `Leituras: ${r[c.key]!.readings!.map((v) => String(v).replace(".", ",")).join("; ")}` : undefined}>
                        {r[c.key]?.display}
                      </td>
                    ))}
                    <td>
                      <button className="fl-btn fl-small" onClick={() => remove(i)} aria-label={`Remover medida ${i + 1}`}>
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="fl-export">
            <span>Tabela:</span>
            <button onClick={() => downloadBlob(`${practice.id}.csv`, rowsToCsv(practice, saved.rows), "text/csv;charset=utf-8")}>CSV</button>
            <button onClick={() => void copyOrDownload(practiceLatexTable(practice, saved.rows, exportOpts), `${practice.id}-tabela.tex`, "Tabela LaTeX")} title="Valor ± incerteza com algarismos significativos corretos (booktabs)">
              LaTeX
            </button>
          </div>
        </>
      )}

      {a && plot && saved.rows.length > 0 && (
        <section>
          <h3>Gráfico e ajuste</h3>
          <div className="fl-plot-opts" role="group" aria-label="Opções do gráfico">
            <label>
              <input type="checkbox" checked={view.logX} onChange={(e) => setView({ logX: e.target.checked })} /> x log
            </label>
            <label>
              <input type="checkbox" checked={view.logY} onChange={(e) => setView({ logY: e.target.checked })} /> y log
            </label>
            <label>
              <input type="checkbox" checked={view.band} onChange={(e) => setView({ band: e.target.checked })} /> faixa de 95%
            </label>
            <label>
              <input type="checkbox" checked={view.residuals} onChange={(e) => setView({ residuals: e.target.checked })} /> resíduos
            </label>
          </div>
          <Plot {...plot} ariaLabel={`Gráfico de ${plot.yLabel} por ${plot.xLabel} com ${saved.rows.length} medidas e barras de erro${res ? " e a curva ajustada" : ""}`} />
          {view.residuals && residualPlot && (
            <>
              <p className="fl-residuals-title">Resíduos (medida − ajuste), com as barras de erro de y</p>
              <Plot {...residualPlot} height={150} ariaLabel="Gráfico de resíduos do ajuste" />
            </>
          )}
          <div className="fl-export">
            <span>Gráfico:</span>
            <button onClick={() => void downloadPlotPng(`${practice.id}-grafico.png`, plot, { title: practice.title })}>PNG</button>
            {view.residuals && residualPlot && <button onClick={() => void downloadPlotPng(`${practice.id}-residuos.png`, residualPlot, { title: `${practice.title}: resíduos`, height: 360 })}>PNG dos resíduos</button>}
            <button onClick={() => void copyOrDownload(practiceFigure(data, exportOpts), `${practice.id}-figura.tex`, "Figura em pgfplots")} title="Pontos com barras de erro e a curva ajustada, em pgfplots">
              LaTeX (pgfplots)
            </button>
          </div>
          {res ? (
            <ul className="fl-results">
              <li className="fl-muted">
                χ²/ν = {res.fit.chi2red.toFixed(2).replace(".", ",")} · R² = {res.fit.r2.toFixed(4).replace(".", ",")}
              </li>
              {res.results.map((r) => (
                <li key={r.label}>
                  <strong>{r.label}</strong> = {r.text}
                  {r.reference !== undefined && (
                    <span className={r.compatible ? "fl-ok" : "fl-bad"}>
                      {" "}
                      ({r.compatible ? "compatível" : "incompatível"} com {String(r.reference).replace(".", ",")} {r.unit})
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="fl-muted">Registre pelo menos {Math.max(3, practice.minRows ?? 3)} medidas para o ajuste.</p>
          )}
        </section>
      )}
      <p role="status" aria-live="polite" className="fl-muted fl-small-text">
        {status}
      </p>

      {practice.questions.length > 0 && (
        <section>
          <h3>Questões</h3>
          {practice.questions.map((q, i) => (
            <label key={i} className="fl-question">
              <Markdown text={`${i + 1}. ${q}`} />
              <textarea
                rows={3}
                value={saved.answers[i] ?? ""}
                onChange={(e) =>
                  setSaved((s) => {
                    const answers = [...s.answers];
                    answers[i] = e.target.value;
                    return { ...s, answers };
                  })
                }
              />
            </label>
          ))}
        </section>
      )}

      <details className="fl-report">
        <summary>Relatório</summary>
        <p className="fl-muted fl-small-text">
          O texto sugerido acompanha as medidas até você editá-lo. Use $...$ para fórmulas, **negrito** e listas com "1.". A tabela, o gráfico e os resultados do ajuste entram sozinhos.
        </p>
        <div className="fl-report-meta">
          <label>
            Autores
            <input value={report.meta.authors} placeholder="Nome e matrícula" onChange={(e) => setReport((r) => ({ ...r, meta: { ...r.meta, authors: e.target.value } }))} />
          </label>
          <label>
            Turma ou disciplina
            <input value={report.meta.course} onChange={(e) => setReport((r) => ({ ...r, meta: { ...r.meta, course: e.target.value } }))} />
          </label>
          <label>
            Data
            <input value={report.meta.date} onChange={(e) => setReport((r) => ({ ...r, meta: { ...r.meta, date: e.target.value } }))} />
          </label>
        </div>
        {SECTIONS.map((k, i) => (
          <div key={k} className="fl-report-sec">
            {k === "analise" && <p className="fl-report-auto">Dados: tabela com {saved.rows.length} medida(s){a ? " e gráfico com barras de erro" : ""} (automáticos).</p>}
            <header>
              <label htmlFor={`fl-rel-${practice.id}-${k}`}>
                <strong>
                  {i < 3 ? i + 1 : i + 2}. {SECTION_TITLES[k]}
                </strong>
              </label>
              {report.sections[k] !== undefined && (
                <button
                  className="fl-small"
                  onClick={() =>
                    setReport((r) => {
                      const s = { ...r.sections };
                      delete s[k];
                      return { ...r, sections: s };
                    })
                  }
                >
                  Restaurar sugestão
                </button>
              )}
            </header>
            {k === "analise" && res && <p className="fl-report-auto">Ajuste, parâmetros e resultados com incerteza e compatibilidade entram antes deste texto.</p>}
            <textarea
              id={`fl-rel-${practice.id}-${k}`}
              rows={k === "procedimento" || k === "teoria" ? 6 : 4}
              value={sections[k]}
              onChange={(e) => setReport((r) => ({ ...r, sections: { ...r.sections, [k]: e.target.value } }))}
            />
          </div>
        ))}

        <div className="fl-export">
          <button onClick={() => setShowReview((v) => !v)} aria-expanded={showReview}>
            Revisar ({nErr} erro{nErr === 1 ? "" : "s"}, {nWarn} aviso{nWarn === 1 ? "" : "s"})
          </button>
          {tutor?.endpoint && (
            <button onClick={() => void askTutorReview()} disabled={tutorReview.busy}>
              {tutorReview.busy ? "Aguardando o tutor…" : "Pedir revisão ao tutor"}
            </button>
          )}
        </div>
        {showReview && (
          <ul className="fl-review" aria-label="Revisão automática">
            {review.map((it, i) => (
              <li key={i} className={it.level}>
                <b>{it.level === "erro" ? "Erro" : it.level === "aviso" ? "Aviso" : "Ok"}</b>
                {it.section !== "geral" && <span className="fl-muted">({it.section}) </span>}
                {it.message}
              </li>
            ))}
          </ul>
        )}
        {tutorReview.text && (
          <div className="fl-tutor-review" aria-live="polite">
            <strong>Revisão do tutor</strong>
            <Markdown text={tutorReview.text} />
          </div>
        )}

        <div className="fl-export">
          <span>Exportar:</span>
          <button onClick={() => downloadBlob(`${practice.id}-relatorio.md`, reportToMarkdown(meta, sections, data), "text/markdown;charset=utf-8")}>Markdown</button>
          <button onClick={() => downloadBlob(`${practice.id}-relatorio.tex`, reportToLatex(meta, sections, data, exportOpts), "application/x-tex;charset=utf-8")}>LaTeX</button>
          <button onClick={() => void exportHtml(false)}>HTML</button>
          <button onClick={() => void exportHtml(true)}>Imprimir / PDF</button>
          <label className="fl-plot-opts">
            <input type="checkbox" checked={view.siunitx} onChange={(e) => setView({ siunitx: e.target.checked })} /> siunitx no LaTeX
          </label>
        </div>
      </details>
    </div>
  );
}
