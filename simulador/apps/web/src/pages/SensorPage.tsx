import { useCallback, useEffect, useRef, useState } from "react";
import { formatMeasured } from "@fisilab/analysis";
import { Plot, useTheme, type PlotSeries } from "@fisilab/ui-kit";
import {
  DataParser,
  LineSplitter,
  SimDevice,
  describe as describeStats,
  formatLabels,
  guessTimeColumn,
  parseText,
  simDevices,
  sketches,
  tableToCsv,
  timeFactor,
  unitOf,
  type DataFormat,
  type DataRow,
  type SimDeviceId,
} from "@fisilab/lab";
import { FitPlot, downloadText, num } from "./VideoPage.tsx";
import "./lab.css";

// Tipos mínimos da Web Serial API (não fazem parte do lib.dom do TypeScript).
interface SerialPortLike {
  open(o: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  readable: ReadableStream<Uint8Array> | null;
  getInfo?(): { usbVendorId?: number; usbProductId?: number };
}
interface SerialLike {
  requestPort(o?: object): Promise<SerialPortLike>;
}
const serialApi = (): SerialLike | undefined => (typeof navigator !== "undefined" ? (navigator as Navigator & { serial?: SerialLike }).serial : undefined);

const BAUDS = [9600, 19200, 38400, 57600, 115200, 230400, 250000, 500000, 1000000];
/** Colunas especiais acrescentadas a cada linha recebida. */
const HOST = "__t";
const IDX = "__n";
const PREVIEW_MAX = 400;
const LOG_MAX = 60;

type Conn = { kind: "nenhuma" } | { kind: "serial"; port: SerialPortLike } | { kind: "simulado"; id: SimDeviceId };

const colLabel = (c: string) => (c === HOST ? "tempo do computador" : c === IDX ? "nº da amostra" : c);

/** Aquisição de dados de Arduino/sensores pela Web Serial, com dispositivo simulado e importação de CSV. */
export function SensorPage() {
  const theme = useTheme();
  const hasSerial = !!serialApi();
  const secure = typeof window === "undefined" || window.isSecureContext;

  const [conn, setConn] = useState<Conn>({ kind: "nenhuma" });
  const [baud, setBaud] = useState(115200);
  const [simId, setSimId] = useState<SimDeviceId>("ultrassonico");
  const [recording, setRecording] = useState(false);
  const [status, setStatus] = useState("");
  const [, setVersion] = useState(0);
  const [xKey, setXKey] = useState<string>(HOST);
  const [ySel, setYSel] = useState<string[]>([]);
  const [aKey, setAKey] = useState<string>("");
  const [interval, setIntervalSel] = useState<[number, number] | null>(null);
  const [paste, setPaste] = useState("");
  const [copied, setCopied] = useState("");

  const splitterRef = useRef(new LineSplitter());
  const parserRef = useRef(new DataParser());
  const rowsRef = useRef<DataRow[]>([]);
  const previewRef = useRef<DataRow[]>([]);
  const logRef = useRef<string[]>([]);
  const recordingRef = useRef(false);
  const t0Ref = useRef(0);
  const countRef = useRef(0);
  const dirtyRef = useRef(false);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const timerRef = useRef<number | undefined>(undefined);
  const fileRef = useRef<HTMLInputElement>(null);
  const configuredRef = useRef(false);

  // Atualiza a interface no máximo ~8 vezes por segundo, mesmo com centenas de linhas por segundo.
  useEffect(() => {
    const id = window.setInterval(() => {
      if (dirtyRef.current) {
        dirtyRef.current = false;
        setVersion((v) => v + 1);
      }
    }, 125);
    return () => window.clearInterval(id);
  }, []);

  const columns = parserRef.current.columns;

  // Ao surgirem colunas, escolhe eixo x (coluna de tempo) e séries padrão.
  const configure = useCallback((cols: string[], live: boolean) => {
    if (configuredRef.current || !cols.length) return;
    configuredRef.current = true;
    const tc = guessTimeColumn(cols);
    const x = tc?.key ?? (live ? HOST : IDX);
    const ys = cols.filter((c) => c !== x);
    setXKey(x);
    setYSel(ys.slice(0, 3));
    setAKey(ys[0] ?? cols[0]!);
    setIntervalSel(null);
  }, []);

  const resetData = (live: boolean) => {
    splitterRef.current = new LineSplitter({ dropPartialFirst: live });
    parserRef.current = new DataParser();
    rowsRef.current = [];
    previewRef.current = [];
    logRef.current = [];
    countRef.current = 0;
    t0Ref.current = performance.now();
    configuredRef.current = false;
    recordingRef.current = false;
    setRecording(false);
    setIntervalSel(null);
    dirtyRef.current = true;
  };

  const ingest = useCallback(
    (text: string) => {
      const now = (performance.now() - t0Ref.current) / 1000;
      for (const line of splitterRef.current.push(text)) {
        if (line.trim()) {
          logRef.current.push(line);
          if (logRef.current.length > LOG_MAX) logRef.current.splice(0, logRef.current.length - LOG_MAX);
        }
        const r = parserRef.current.parseLine(line);
        if (r.kind !== "dados") continue;
        const row: DataRow = { ...r.row, [HOST]: now, [IDX]: countRef.current++ };
        previewRef.current.push(row);
        if (previewRef.current.length > PREVIEW_MAX) previewRef.current.splice(0, previewRef.current.length - PREVIEW_MAX);
        if (recordingRef.current) rowsRef.current.push(row);
        configure(parserRef.current.columns, true);
      }
      dirtyRef.current = true;
    },
    [configure],
  );

  const confirmDiscard = () => !rowsRef.current.length || confirm("Descartar os dados gravados?");

  const disconnect = useCallback(async () => {
    window.clearInterval(timerRef.current);
    timerRef.current = undefined;
    const reader = readerRef.current;
    readerRef.current = null;
    if (reader) {
      try {
        await reader.cancel();
        reader.releaseLock();
      } catch {
        /* já fechado */
      }
    }
    setConn((c) => {
      if (c.kind === "serial") c.port.close().catch(() => undefined);
      return { kind: "nenhuma" };
    });
    recordingRef.current = false;
    setRecording(false);
  }, []);

  useEffect(() => () => void disconnect(), [disconnect]);

  const connectSerial = async () => {
    const api = serialApi();
    if (!api || !confirmDiscard()) return;
    let port: SerialPortLike;
    try {
      port = await api.requestPort();
    } catch {
      setStatus("Nenhuma porta escolhida.");
      return;
    }
    try {
      await port.open({ baudRate: baud });
    } catch (e) {
      setStatus(`Não foi possível abrir a porta: ${(e as Error).message}. Feche o Monitor Serial da IDE do Arduino, se estiver aberto.`);
      return;
    }
    await disconnect();
    resetData(true);
    setConn({ kind: "serial", port });
    setStatus(`Conectado a ${baud} baud. Aguardando dados…`);
    const decoder = new TextDecoder();
    void (async () => {
      try {
        while (port.readable) {
          const reader = port.readable.getReader();
          readerRef.current = reader;
          try {
            for (;;) {
              const { value, done } = await reader.read();
              if (done) return;
              if (value) ingest(decoder.decode(value, { stream: true }));
            }
          } finally {
            try {
              reader.releaseLock();
            } catch {
              /* já liberado */
            }
          }
        }
      } catch (e) {
        if (readerRef.current) setStatus(`Conexão interrompida: ${(e as Error).message}`);
        readerRef.current = null;
        setConn({ kind: "nenhuma" });
        recordingRef.current = false;
        setRecording(false);
      }
    })();
  };

  const connectSim = async () => {
    if (!confirmDiscard()) return;
    await disconnect();
    resetData(false);
    const dev = new SimDevice(simId, (Date.now() & 0xffff) + 1);
    setConn({ kind: "simulado", id: simId });
    setStatus(`Dispositivo simulado ligado: ${dev.info.title}.`);
    timerRef.current = window.setInterval(() => ingest(dev.read(performance.now() - t0Ref.current)), 60);
  };

  const loadText = (text: string, name: string) => {
    if (!confirmDiscard()) return;
    void disconnect();
    resetData(false);
    const t = parseText(text);
    rowsRef.current = t.rows.map((r, i) => ({ ...r, [IDX]: i }));
    parserRef.current.columns = t.columns;
    parserRef.current.format = t.format;
    parserRef.current.ignored = t.ignored;
    configure(t.columns, false);
    dirtyRef.current = true;
    setStatus(t.rows.length ? `${name}: ${t.rows.length} linhas, ${t.columns.length} colunas${t.ignored ? `, ${t.ignored} linha(s) ignorada(s)` : ""}.` : `${name}: nenhuma linha numérica encontrada.`);
  };

  const toggleRecord = () => {
    if (recordingRef.current) {
      recordingRef.current = false;
      setRecording(false);
      setStatus(`Gravação parada: ${rowsRef.current.length} linhas.`);
    } else {
      recordingRef.current = true;
      setRecording(true);
      setStatus("Gravando…");
    }
    dirtyRef.current = true;
  };

  const clear = () => {
    if (!rowsRef.current.length || confirm("Apagar os dados gravados?")) {
      rowsRef.current = [];
      setIntervalSel(null);
      dirtyRef.current = true;
    }
  };

  // ── dados exibidos ──
  const recorded = rowsRef.current;
  const showingPreview = !recorded.length && !recording && previewRef.current.length > 0;
  const data = showingPreview ? previewRef.current : recorded;
  const isTime = xKey === HOST || guessTimeColumn([xKey])?.key === xKey;
  const factor = xKey === HOST ? 1 : xKey === IDX ? 1 : isTime ? timeFactor(xKey) : 1;
  const x0 = isTime && data.length ? data[0]![xKey] ?? 0 : 0;
  const xOf = (r: DataRow) => ((r[xKey] ?? NaN) - x0) * factor;
  const xUnit = isTime ? "s" : xKey === IDX ? "" : unitOf(xKey);
  const xName = isTime ? "t" : colLabel(xKey);
  const xs = data.map(xOf);
  const xMin = xs.length ? Math.min(...xs.filter(Number.isFinite)) : 0;
  const xMax = xs.length ? Math.max(...xs.filter(Number.isFinite)) : 1;
  const [ia, ib] = interval ?? [xMin, xMax];

  const liveSeries: PlotSeries[] = ySel
    .filter((c) => columns.includes(c))
    .map((c, i) => ({ label: c, kind: "line", color: theme.series[i % theme.series.length], points: data.map((r) => [xOf(r), r[c] ?? NaN] as [number, number]) }));

  const lo = Math.min(ia, ib), hi = Math.max(ia, ib);
  const sel = data.filter((r) => {
    const x = xOf(r);
    return x >= lo && x <= hi;
  });
  const selX = sel.map(xOf);
  const selY = sel.map((r) => r[aKey] ?? NaN);
  const aUnit = unitOf(aKey);
  const stats = describeStats(selY);
  // Recalculado a cada atualização (no máximo ~8 por segundo), pois os dados crescem no mesmo array.
  const background: PlotSeries[] = [
    { label: "Todos os dados", kind: "line", color: theme.grid, width: 1.5, points: data.map((r) => [xOf(r), r[aKey] ?? NaN] as [number, number]) },
  ];

  const last = previewRef.current[previewRef.current.length - 1];
  const parser = parserRef.current;
  const connected = conn.kind !== "nenhuma";

  const exportCsv = () => {
    const cols = columns;
    const head = [isTime ? "t (s)" : colLabel(xKey), ...cols];
    downloadText("sensores.csv", tableToCsv(head, recorded.map((r) => [xOf(r), ...cols.map((c) => r[c] ?? NaN)])));
  };

  const copy = async (id: string, code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(id);
      setTimeout(() => setCopied(""), 2000);
    } catch {
      setCopied("");
      setStatus("Não foi possível copiar automaticamente: selecione o código e copie com Ctrl+C.");
    }
  };

  const step = (xMax - xMin) / 1000 || 1;

  return (
    <div className="lab-page">
      <header className="lab-head">
        <h1>Sensores e Arduino</h1>
        <p>
          Ligue um Arduino pela USB e acompanhe as medidas ao vivo: grave, marque um intervalo, calcule média e desvios, ajuste uma curva e exporte em CSV. Sem
          Arduino? Use um dispositivo simulado ou importe um arquivo.
        </p>
      </header>

      {!hasSerial && (
        <p className="lab-warn" role="note">
          <strong>Este navegador não tem Web Serial</strong> (Firefox, Safari e os navegadores de celular não oferecem). Para ligar o Arduino, use Chrome ou Edge
          no computador{!secure && ", abrindo a página por HTTPS"}. Aqui mesmo você pode usar um <strong>dispositivo simulado</strong> ou <strong>importar um
          arquivo CSV</strong> (por exemplo, a saída copiada do Monitor Serial).
        </p>
      )}

      <div className="lab-grid">
        <section className="lab-panel" aria-labelledby="lab-sens-live">
          <div className="lab-fit-head">
            <h2 id="lab-sens-live">{showingPreview ? "Ao vivo (pré-visualização, não gravada)" : recording ? "Gravando" : "Dados gravados"}</h2>
            <div className="lab-row">
              <button className="fl-primary" onClick={toggleRecord} disabled={!connected}>
                {recording ? "Parar" : recorded.length ? "Continuar gravação" : "Gravar"}
              </button>
              <button onClick={clear} disabled={!recorded.length || recording}>
                Limpar
              </button>
              <button onClick={exportCsv} disabled={!recorded.length}>
                Exportar CSV
              </button>
            </div>
          </div>

          {last && connected && (
            <div className="lab-live-values" aria-live="off">
              {columns.map((c) => (
                <div key={c}>
                  <span>{c}</span>
                  <strong>
                    {num(last[c] ?? NaN, 5)}
                    {unitOf(c) && <small> {unitOf(c)}</small>}
                  </strong>
                </div>
              ))}
            </div>
          )}

          {columns.length > 0 ? (
            <>
              <div className="lab-row lab-small">
                <label>
                  Eixo x
                  <select
                    value={xKey}
                    onChange={(e) => {
                      setXKey(e.target.value);
                      setIntervalSel(null);
                    }}
                  >
                    {[...columns, ...(data.some((r) => HOST in r) ? [HOST] : []), IDX].map((c) => (
                      <option key={c} value={c}>
                        {colLabel(c)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <fieldset className="lab-checks" style={{ border: 0, padding: 0, margin: 0 }}>
                <legend className="lab-small lab-muted">Colunas no gráfico</legend>
                {columns
                  .filter((c) => c !== xKey)
                  .map((c) => (
                    <label key={c}>
                      <input type="checkbox" checked={ySel.includes(c)} onChange={(e) => setYSel((s) => (e.target.checked ? [...s, c] : s.filter((k) => k !== c)))} />
                      {c}
                    </label>
                  ))}
              </fieldset>
              <Plot
                series={liveSeries}
                xLabel={xUnit ? `${xName} (${xUnit})` : xName}
                yLabel={ySel.length === 1 ? `${ySel[0]}${unitOf(ySel[0]!) ? ` (${unitOf(ySel[0]!)})` : ""}` : "valor"}
                theme={theme}
                height={280}
                ariaLabel="Gráfico das colunas escolhidas"
              />
            </>
          ) : (
            <p className="lab-muted">Conecte um dispositivo, ligue o simulado ou importe um arquivo para ver os dados.</p>
          )}
          <p className="lab-status" role="status" aria-live="polite">
            {status}
          </p>
          <p className="lab-muted lab-small" style={{ margin: 0 }}>
            {recorded.length} linha(s) gravada(s){parser.format ? ` · formato: ${formatLabels[parser.format as DataFormat]}` : ""}
            {parser.ignored ? ` · ${parser.ignored} linha(s) ignorada(s)` : ""}
            {parser.lastMessage ? ` · última mensagem: “${parser.lastMessage}”` : ""}
          </p>
        </section>

        <aside className="lab-stack" aria-label="Conexão">
          <section className="lab-panel">
            <h2>Arduino (Web Serial)</h2>
            <div className="lab-stack">
              <label>
                Taxa de transmissão (baud)
                <select value={baud} onChange={(e) => setBaud(Number(e.target.value))} disabled={conn.kind === "serial"}>
                  {BAUDS.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="lab-row">
              {conn.kind === "serial" ? (
                <button onClick={() => void disconnect().then(() => setStatus("Desconectado."))}>Desconectar</button>
              ) : (
                <button className="fl-primary" onClick={() => void connectSerial()} disabled={!hasSerial}>
                  Conectar
                </button>
              )}
            </div>
            <p className="lab-muted lab-small" style={{ margin: 0 }}>
              Use a mesma taxa do <code>Serial.begin()</code> do sketch (os exemplos abaixo usam 115200). Feche o Monitor Serial da IDE antes de conectar.
            </p>
          </section>

          <section className="lab-panel">
            <h2>Dispositivo simulado</h2>
            <div className="lab-stack">
              <label>
                Sensor
                <select value={simId} onChange={(e) => setSimId(e.target.value as SimDeviceId)} disabled={conn.kind === "simulado"}>
                  {simDevices.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.title}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p className="lab-muted lab-small" style={{ margin: 0 }}>
              {simDevices.find((d) => d.id === simId)!.description}
            </p>
            <div className="lab-row">
              {conn.kind === "simulado" ? (
                <button onClick={() => void disconnect().then(() => setStatus("Dispositivo simulado desligado."))}>Desligar</button>
              ) : (
                <button onClick={() => void connectSim()}>Ligar simulado</button>
              )}
            </div>
          </section>

          <section className="lab-panel">
            <h2>Importar dados</h2>
            <div className="lab-row">
              <button onClick={() => fileRef.current?.click()}>Abrir arquivo CSV/TXT</button>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.txt,.tsv,text/csv,text/plain"
                hidden
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (f) loadText(await f.text(), f.name);
                  e.target.value = "";
                }}
              />
            </div>
            <details>
              <summary className="lab-small">Colar texto do Monitor Serial</summary>
              <div className="lab-stack" style={{ marginTop: "0.5rem" }}>
                <textarea rows={5} value={paste} onChange={(e) => setPaste(e.target.value)} aria-label="Texto para interpretar" style={{ width: "100%" }} />
                <button onClick={() => loadText(paste, "Texto colado")} disabled={!paste.trim()}>
                  Interpretar
                </button>
              </div>
            </details>
            <p className="lab-muted lab-small" style={{ margin: 0 }}>
              Aceita CSV, TSV, ponto e vírgula (com vírgula decimal) ou “chave: valor”, com ou sem cabeçalho.
            </p>
          </section>

          {connected && (
            <details className="lab-panel">
              <summary>Monitor serial (últimas linhas)</summary>
              <pre className="lab-code" aria-live="off">
                <code>{logRef.current.slice(-20).join("\n")}</code>
              </pre>
            </details>
          )}
        </aside>
      </div>

      {data.length > 1 && aKey && (
        <section className="lab-panel" aria-labelledby="lab-sens-analysis">
          <h2 id="lab-sens-analysis">Análise de um intervalo</h2>
          <div className="lab-fields">
            <label>
              Coluna analisada
              <select value={aKey} onChange={(e) => setAKey(e.target.value)}>
                {columns
                  .filter((c) => c !== xKey)
                  .map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Início ({xUnit || "x"})
              <input type="number" step="any" value={+lo.toPrecision(6)} onChange={(e) => setIntervalSel([Number(e.target.value), hi])} />
            </label>
            <label>
              Fim ({xUnit || "x"})
              <input type="number" step="any" value={+hi.toPrecision(6)} onChange={(e) => setIntervalSel([lo, Number(e.target.value)])} />
            </label>
          </div>
          <div className="lab-range">
            <input type="range" min={xMin} max={xMax} step={step} value={lo} onChange={(e) => setIntervalSel([Math.min(Number(e.target.value), hi), hi])} aria-label="Início do intervalo" />
            <input type="range" min={xMin} max={xMax} step={step} value={hi} onChange={(e) => setIntervalSel([lo, Math.max(Number(e.target.value), lo)])} aria-label="Fim do intervalo" />
            <div className="lab-row">
              <button onClick={() => setIntervalSel(null)} disabled={!interval}>
                Usar todos os dados
              </button>
              {showingPreview && <span className="lab-muted lab-small">A pré-visualização muda a cada instante: grave para analisar com calma.</span>}
            </div>
          </div>

          {stats && (
            <dl className="lab-stats" aria-live="polite">
              <div>
                <dt>pontos</dt>
                <dd>{stats.n}</dd>
              </div>
              <div>
                <dt>média</dt>
                <dd>
                  {num(stats.mean, 6)} {aUnit}
                </dd>
              </div>
              <div>
                <dt>desvio padrão (s)</dt>
                <dd>
                  {num(stats.sd, 4)} {aUnit}
                </dd>
              </div>
              <div>
                <dt>desvio da média (s/√n)</dt>
                <dd>
                  {num(stats.sem, 4)} {aUnit}
                </dd>
              </div>
              <div>
                <dt>mínimo · máximo</dt>
                <dd>
                  {num(stats.min, 5)} · {num(stats.max, 5)}
                </dd>
              </div>
              <div>
                <dt>resultado (tipo A)</dt>
                <dd>{stats.sem > 0 ? formatMeasured(stats.mean, stats.sem, aUnit) : "—"}</dd>
              </div>
            </dl>
          )}

          <FitPlot
            key={`${aKey}|${xKey}`}
            title={`${aKey} no intervalo`}
            xs={selX}
            ys={selY}
            xName={xName}
            yName={aKey}
            xUnit={xUnit}
            yUnit={aUnit}
            theme={theme}
            background={background}
            pointsLabel="Intervalo"
            height={260}
            hint="O ajuste usa só os pontos do intervalo marcado. Ex.: quadrático no carrinho (2·c₂ = aceleração), exponencial com assíntota no termistor e no capacitor (τ)."
          />
        </section>
      )}

      <section className="lab-panel" aria-labelledby="lab-sketches">
        <h2 id="lab-sketches">Sketches de Arduino prontos</h2>
        <p className="lab-muted lab-small" style={{ margin: 0 }}>
          Carregue pela IDE do Arduino, feche o Monitor Serial e clique em Conectar. Todos imprimem num formato que esta página entende.
        </p>
        {sketches.map((s) => (
          <details key={s.id} className="lab-sketch">
            <summary>{s.title}</summary>
            <p>
              <strong>Material:</strong> {s.materials.join(", ")}.
            </p>
            <p>
              <strong>Ligação:</strong> {s.wiring}
            </p>
            <p>
              <strong>Saída:</strong> {s.format}
            </p>
            <strong>Conversões</strong>
            <ul>
              {s.conversions.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
            <div className="lab-row" style={{ margin: "0.5rem 0" }}>
              <button onClick={() => void copy(s.id, s.code)}>{copied === s.id ? "Copiado!" : "Copiar código"}</button>
              <button onClick={() => downloadText(`${s.id}.ino`, s.code, "text/plain;charset=utf-8")}>Baixar .ino</button>
            </div>
            <pre className="lab-code" tabIndex={0} aria-label={`Código do sketch ${s.title}`}>
              <code>{s.code}</code>
            </pre>
          </details>
        ))}
      </section>
    </div>
  );
}
