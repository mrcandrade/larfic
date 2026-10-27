import { useMemo, useState } from "react";
import type { AnySimulation, Runner, Theme } from "@fisilab/core";
import { columnsToCsv, decimate, pgfplotsFigure } from "@fisilab/analysis";
import { Plot, downloadBlob, downloadPlotPng, type PlotProps } from "./Plot.tsx";
import { copyText } from "./report.ts";
import "./report.css";

interface Props {
  sim: AnySimulation;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  runner: Runner<any>;
  theme: Theme;
  /** Muda a cada atualização do runner e força o recálculo das séries. */
  tick: number;
}

/** Gráfico ao vivo de um observável contra o tempo ou contra outro observável (espaço de fase). */
export function Chart({ sim, runner, theme, tick }: Props) {
  const axes = useMemo(() => [{ key: "t", label: "t", unit: "s" }, ...sim.observables], [sim]);
  const [xKey, setXKey] = useState(sim.chart?.x ?? "t");
  const [yKey, setYKey] = useState(sim.chart?.y ?? sim.observables[0]?.key ?? "t");
  const [y2Key, setY2Key] = useState("");
  const [logX, setLogX] = useState(false);
  const [logY, setLogY] = useState(false);
  const [msg, setMsg] = useState("");

  const column = (key: string) => {
    if (key === "t") return runner.samples.map((s) => s.t);
    const i = sim.observables.findIndex((o) => o.key === key);
    return runner.samples.map((s) => s.values[i] ?? NaN);
  };
  const label = (key: string) => {
    const a = axes.find((o) => o.key === key);
    if (!a) return key;
    return a.unit ? `${a.label} (${a.unit})` : a.label;
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const series = useMemo(() => {
    const xs = column(xKey);
    const ys = column(yKey);
    const out = [{ label: label(yKey), points: xs.map((x, i): [number, number] => [x, ys[i] ?? NaN]) }];
    if (y2Key) {
      const y2 = column(y2Key);
      out.push({ label: label(y2Key), points: xs.map((x, i): [number, number] => [x, y2[i] ?? NaN]) });
    }
    return out;
  }, [tick, xKey, yKey, y2Key, runner]); // eslint-disable-line react-hooks/exhaustive-deps

  const yLabel = y2Key ? `${label(yKey)} · ${label(y2Key)}` : label(yKey);
  const plot: PlotProps = { series, xLabel: label(xKey), yLabel, theme, logX, logY };
  const base = `${sim.id}-${yKey}${y2Key ? `-${y2Key}` : ""}-${xKey}`;

  const exportCsv = () => {
    const cols = [{ label: label(xKey), values: series[0]!.points.map((p) => p[0]) }, ...series.map((s) => ({ label: s.label, values: s.points.map((p) => p[1]) }))];
    downloadBlob(`${base}.csv`, columnsToCsv(cols), "text/csv;charset=utf-8");
  };
  const latex = () =>
    pgfplotsFigure({
      xLabel: label(xKey),
      yLabel,
      logX,
      logY,
      series: series.map((s) => ({ label: s.label, kind: "line" as const, points: decimate(s.points, 400) })),
      caption: `${sim.title}: ${yLabel} em função de ${label(xKey)}.`,
      label: `fig:${sim.id}`,
    });
  const copyLatex = async () => {
    const ok = await copyText(latex());
    if (ok) setMsg("Figura em pgfplots copiada.");
    else downloadBlob(`${base}.tex`, latex(), "application/x-tex;charset=utf-8");
    setTimeout(() => setMsg(""), 2500);
  };

  const select = (value: string, set: (v: string) => void, name: string, allowNone = false) => (
    <label>
      {name}
      <select value={value} onChange={(e) => set(e.target.value)}>
        {allowNone && <option value="">nenhum</option>}
        {axes.map((a) => (
          <option key={a.key} value={a.key}>
            {label(a.key)}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="fl-chart">
      <div className="fl-chart-controls">
        {select(yKey, setYKey, "Eixo vertical")}
        {select(y2Key, setY2Key, "Comparar com", true)}
        {select(xKey, setXKey, "Eixo horizontal")}
      </div>
      <Plot {...plot} />
      <div className="fl-chart-tools">
        <div className="fl-plot-opts" role="group" aria-label="Escala dos eixos">
          <span>Escala log:</span>
          <label>
            <input type="checkbox" checked={logX} onChange={(e) => setLogX(e.target.checked)} /> x
          </label>
          <label>
            <input type="checkbox" checked={logY} onChange={(e) => setLogY(e.target.checked)} /> y
          </label>
          {(logX || logY) && <span className="fl-small-text">pontos ≤ 0 ficam de fora</span>}
        </div>
        <details>
          <summary>Exportar gráfico</summary>
          <div className="fl-export">
            <button onClick={() => void downloadPlotPng(`${base}.png`, plot, { title: sim.title })}>PNG</button>
            <button onClick={exportCsv} disabled={!runner.samples.length}>
              CSV
            </button>
            <button onClick={() => void copyLatex()} disabled={!runner.samples.length} title="Copia a figura em pgfplots para colar no relatório">
              LaTeX (pgfplots)
            </button>
            <span role="status" aria-live="polite">
              {msg}
            </span>
          </div>
        </details>
      </div>
    </div>
  );
}
