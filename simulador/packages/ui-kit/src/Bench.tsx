import { useEffect, useMemo, useRef, useState } from "react";
import { hashSeed, rng, type Runner, type Theme } from "@fisilab/core";
import { analyze, isDerived, measureRow, reportMarkdown, rowsToCsv, type Practice, type Row } from "@fisilab/analysis";
import { Markdown } from "./Guide.tsx";
import { Plot } from "./Plot.tsx";

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

function download(name: string, text: string, type: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export interface BenchProps {
  practice: Practice;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  runner: Runner<any>;
  theme: Theme;
  /** Identifica o aluno para sortear erros de zero e ruído reprodutíveis (ex.: matrícula). */
  studentId?: string;
}

/** Bancada de uma prática: roteiro, registro de medidas com instrumentos, tabela, ajuste e relatório. */
export function Bench({ practice, runner, theme, studentId = "anonimo" }: BenchProps) {
  const [saved, setSaved] = useState<Saved>(() => load(practice.id));
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
  const label = (k: string) => {
    const c = practice.columns.find((c) => c.key === k);
    return c ? `${c.label} (${c.unit})` : k;
  };

  const series = useMemo(() => {
    if (!a || !saved.rows.length) return [];
    const pts = saved.rows.map((r) => [r[a.x]!.value, r[a.y]!.value] as [number, number]);
    const out = [
      {
        label: "Medidas",
        kind: "scatter" as const,
        points: pts,
        yErr: saved.rows.map((r) => r[a.y]!.u),
        xErr: saved.rows.map((r) => r[a.x]!.u),
        color: theme.series[0],
      },
    ];
    if (res) {
      const xs = pts.map((p) => p[0]);
      const lo = Math.min(...xs, a.fit === "proporcional" ? 0 : Infinity), hi = Math.max(...xs);
      const line: [number, number][] = Array.from({ length: 60 }, (_, i) => {
        const x = lo + ((hi - lo) * i) / 59;
        return [x, res.fit.f(x)];
      });
      out.push({ label: "Ajuste", kind: "line" as never, points: line, color: theme.accent } as never);
    }
    return out;
  }, [a, saved.rows, res, theme]);

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
          <>
            <button className="fl-btn" onClick={() => download(`${practice.id}.csv`, rowsToCsv(practice, saved.rows), "text/csv;charset=utf-8")}>
              Exportar tabela (CSV)
            </button>
            <button className="fl-btn" onClick={clear}>
              Limpar
            </button>
          </>
        )}
      </div>

      {saved.rows.length > 0 && (
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
      )}

      {a && saved.rows.length > 0 && (
        <section>
          <h3>Gráfico e ajuste</h3>
          <Plot series={series} xLabel={a.xLabel ?? label(a.x)} yLabel={a.yLabel ?? label(a.y)} theme={theme} includeZero={a.fit === "proporcional"} />
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

      <button className="fl-btn" onClick={() => download(`${practice.id}-relatorio.md`, reportMarkdown(practice, saved.rows, res, saved.answers), "text/markdown;charset=utf-8")}>
        Baixar relatório (Markdown)
      </button>
    </div>
  );
}
