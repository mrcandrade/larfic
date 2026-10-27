import { useMemo, useRef, useState } from "react";
import { rowsToCsv, type Row } from "@fisilab/analysis";
import { CAPTURE_FIGURES, parseTable, preamble, starterCode, toIpynb, type Dataset } from "@fisilab/lab";
import { practices } from "../practices.ts";
import { downloadText } from "./VideoPage.tsx";
import "./lab.css";

const PYODIDE = "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/";

interface Pyodide {
  runPythonAsync(code: string): Promise<unknown>;
  loadPackage(names: string[]): Promise<void>;
  setStdout(o: { batched: (s: string) => void }): void;
  setStderr(o: { batched: (s: string) => void }): void;
  globals: { get(name: string): { toJs(): unknown; destroy?(): void } | undefined };
}

declare global {
  interface Window {
    loadPyodide?: (o: { indexURL: string }) => Promise<Pyodide>;
  }
}

let pyodidePromise: Promise<Pyodide> | null = null;

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("não foi possível baixar o Python (sem internet?)"));
    document.head.appendChild(s);
  });
}

/** Carrega o Pyodide uma única vez, com numpy e matplotlib. */
function getPyodide(): Promise<Pyodide> {
  pyodidePromise ??= (async () => {
    if (!window.loadPyodide) await loadScript(`${PYODIDE}pyodide.js`);
    const py = await window.loadPyodide!({ indexURL: PYODIDE });
    await py.loadPackage(["numpy", "matplotlib"]);
    await py.runPythonAsync(CAPTURE_FIGURES);
    return py;
  })();
  pyodidePromise.catch(() => (pyodidePromise = null));
  return pyodidePromise;
}

interface Cell {
  id: number;
  code: string;
  out?: string;
  figs?: string[];
  error?: boolean;
  running?: boolean;
}

/** Práticas com medidas salvas neste navegador. */
function savedPractices(): { id: string; title: string; rows: Row[] }[] {
  const out: { id: string; title: string; rows: Row[] }[] = [];
  for (const p of practices) {
    try {
      const s = JSON.parse(localStorage.getItem(`fisilab.pratica.${p.id}.v1`) ?? "null") as { rows?: Row[] } | null;
      if (s?.rows?.length) out.push({ id: p.id, title: p.title, rows: s.rows });
    } catch {
      // armazenamento indisponível
    }
  }
  return out;
}

const EXAMPLE = `Δy (m);P (N);u(P) (N)
0,049;0,979;0,010
0,098;1,958;0,010
0,147;2,937;0,010
0,196;3,916;0,010
0,245;4,895;0,010`;

let nextId = 1;

export function NotebookPage() {
  const [ds, setDs] = useState<Dataset>(() => parseTable(EXAMPLE, "Exemplo: lei de Hooke"));
  const [cells, setCells] = useState<Cell[]>(() => [{ id: nextId++, code: starterCode(parseTable(EXAMPLE)) }]);
  const [status, setStatus] = useState<string>("O Python é baixado na primeira execução (cerca de 15 MB) e fica em cache.");
  const [paste, setPaste] = useState("");
  const saved = useMemo(savedPractices, []);
  const loadedFor = useRef<string>("");

  const useDataset = (d: Dataset) => {
    setDs(d);
    loadedFor.current = "";
    setCells((cs) => (cs.length === 1 && !cs[0]!.out ? [{ id: nextId++, code: starterCode(d) }] : cs));
  };

  async function run(id: number) {
    setCells((cs) => cs.map((c) => (c.id === id ? { ...c, running: true } : c)));
    let out = "";
    let error = false;
    let figs: string[] = [];
    try {
      setStatus("Carregando o Python…");
      const py = await getPyodide();
      setStatus("Python pronto.");
      const key = JSON.stringify(ds);
      if (loadedFor.current !== key) {
        await py.runPythonAsync(preamble(ds));
        loadedFor.current = key;
      }
      py.setStdout({ batched: (s) => (out += `${s}\n`) });
      py.setStderr({ batched: (s) => (out += `${s}\n`) });
      const code = cells.find((c) => c.id === id)!.code;
      await py.runPythonAsync("_fisilab_figs.clear()");
      const res = await py.runPythonAsync(code);
      if (res !== undefined && res !== null) out += `${String(res)}\n`;
      const f = py.globals.get("_fisilab_figs");
      figs = (f?.toJs() as string[] | undefined) ?? [];
      f?.destroy?.();
    } catch (e) {
      error = true;
      out += String((e as Error).message ?? e);
      if (!pyodidePromise) setStatus(String((e as Error).message ?? e));
    }
    setCells((cs) => cs.map((c) => (c.id === id ? { ...c, running: false, out: out.trimEnd(), figs, error } : c)));
  }

  const edit = (id: number, code: string) => setCells((cs) => cs.map((c) => (c.id === id ? { ...c, code } : c)));

  return (
    <div className="lab-page">
      <header className="lab-head">
        <h1>Notebook Python</h1>
        <p>
          Analise os dados das práticas, do vídeo ou dos sensores com Python (numpy e matplotlib) direto no navegador. Os dados viram arrays numpy com o nome das
          colunas; exporte para o Jupyter quando quiser continuar no computador.
        </p>
      </header>

      <div className="lab-grid">
        <section className="lab-panel" aria-labelledby="nb-cells">
          <h2 id="nb-cells">Células</h2>
          <p className="lab-status lab-small lab-muted" aria-live="polite">
            {status}
          </p>
          {cells.map((c, i) => (
            <div key={c.id} className="nb-cell">
              <label className="lab-small lab-muted" htmlFor={`nb-${c.id}`}>
                [{i + 1}]
              </label>
              <textarea
                id={`nb-${c.id}`}
                className="nb-code"
                spellCheck={false}
                value={c.code}
                rows={Math.min(18, Math.max(3, c.code.split("\n").length + 1))}
                onChange={(e) => edit(c.id, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.shiftKey || e.ctrlKey)) {
                    e.preventDefault();
                    void run(c.id);
                  }
                }}
              />
              <div className="lab-row">
                <button className="fl-btn primary" onClick={() => void run(c.id)} disabled={c.running}>
                  {c.running ? "Executando…" : "Executar (Shift+Enter)"}
                </button>
                <button className="fl-btn" onClick={() => setCells((cs) => cs.filter((x) => x.id !== c.id))} disabled={cells.length === 1}>
                  Remover
                </button>
              </div>
              {c.out ? <pre className={`nb-out${c.error ? " lab-bad" : ""}`}>{c.out}</pre> : null}
              {c.figs?.map((f, k) => <img key={k} className="nb-fig" alt={`Figura ${k + 1} da célula ${i + 1}`} src={`data:image/png;base64,${f}`} />)}
            </div>
          ))}
          <div className="lab-row">
            <button className="fl-btn" onClick={() => setCells((cs) => [...cs, { id: nextId++, code: "" }])}>
              Nova célula
            </button>
            <button
              className="fl-btn"
              onClick={() =>
                downloadText(
                  `${ds.name.replace(/[^\p{L}\p{N}]+/gu, "-").toLowerCase() || "dados"}.ipynb`,
                  toIpynb(
                    ds,
                    cells.map((c) => c.code),
                  ),
                  "application/x-ipynb+json",
                )
              }
            >
              Baixar para o Jupyter (.ipynb)
            </button>
          </div>
        </section>

        <aside className="lab-panel" aria-labelledby="nb-data">
          <h2 id="nb-data">Dados</h2>
          <p className="lab-small">
            <strong>{ds.name}</strong>: {ds.columns.length} colunas, {ds.columns[0]?.values.length ?? 0} linhas.
          </p>
          <ul className="lab-small nb-vars">
            {ds.columns.map((c) => (
              <li key={c.key}>
                <code>{c.key}</code> <span className="lab-muted">{c.label}</span>
              </li>
            ))}
          </ul>
          {saved.length ? (
            <label className="lab-stack lab-small">
              Medidas de uma prática
              <select defaultValue="" onChange={(e) => {
                const s = saved.find((x) => x.id === e.target.value);
                const p = practices.find((x) => x.id === e.target.value);
                if (s && p) useDataset(parseTable(rowsToCsv(p, s.rows), p.title));
              }}>
                <option value="" disabled>
                  escolha…
                </option>
                {saved.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title} ({s.rows.length})
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p className="lab-small lab-muted">As medidas que você registrar nas práticas aparecem aqui.</p>
          )}
          <label className="lab-stack lab-small">
            Abrir CSV (da bancada, do vídeo ou dos sensores)
            <input
              type="file"
              accept=".csv,.txt,.tsv,text/csv,text/plain"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) useDataset(parseTable(await f.text(), f.name.replace(/\.[^.]+$/, "")));
              }}
            />
          </label>
          <label className="lab-stack lab-small">
            Ou cole uma tabela
            <textarea className="nb-code" rows={5} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder={"x;y\n1;2,1\n2;3,9"} />
          </label>
          <button className="fl-btn" disabled={!paste.trim()} onClick={() => useDataset(parseTable(paste, "Dados colados"))}>
            Usar tabela colada
          </button>
        </aside>
      </div>
    </div>
  );
}
