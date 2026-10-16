import { useEffect, useRef, useState } from "react";
import uPlot from "uplot";
import type { Runner, Simulation } from "@fisilab/core";

/** Gráfico ao vivo de um observável contra o tempo ou contra outro observável. */
export function Chart({ sim, runner, tick }: { sim: Simulation; runner: Runner; tick: number }) {
  const axes = [{ key: "t", label: "t", unit: "s" }, ...sim.observables];
  const [xKey, setXKey] = useState(sim.observables[0]?.key ?? "t");
  const [yKey, setYKey] = useState(sim.observables[1]?.key ?? sim.observables[0]?.key ?? "t");
  const wrapRef = useRef<HTMLDivElement>(null);
  const plotRef = useRef<uPlot | null>(null);

  const column = (key: string) => {
    if (key === "t") return runner.samples.map((s) => s.t);
    const i = sim.observables.findIndex((o) => o.key === key);
    return runner.samples.map((s) => s.values[i] ?? 0);
  };
  const axisLabel = (key: string) => {
    const a = axes.find((o) => o.key === key)!;
    return a.unit ? `${a.label} (${a.unit})` : a.label;
  };

  // Recria o gráfico quando os eixos mudam.
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const css = getComputedStyle(document.documentElement);
    const fg = css.getPropertyValue("--muted").trim() || "#888";
    const grid = css.getPropertyValue("--grid").trim() || "rgba(128,128,128,0.2)";
    const axis = { stroke: fg, grid: { stroke: grid }, ticks: { stroke: grid } };
    const plot = new uPlot(
      {
        width: wrap.clientWidth,
        height: 260,
        scales: { x: { time: false } },
        legend: { show: false },
        cursor: { drag: { x: true, y: true } },
        axes: [
          { ...axis, label: axisLabel(xKey) },
          { ...axis, label: axisLabel(yKey) },
        ],
        series: [{}, { stroke: "#2f7de1", width: 2, points: { show: false } }],
      },
      [[], []],
      wrap,
    );
    plotRef.current = plot;
    const onResize = () => plot.setSize({ width: wrap.clientWidth, height: 260 });
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      plot.destroy();
      plotRef.current = null;
    };
  }, [xKey, yKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const plot = plotRef.current;
    if (!plot) return;
    const xs = column(xKey);
    const ys = column(yKey);
    // uPlot exige x crescente; para gráficos paramétricos (ex.: y × x) ordenamos os pares.
    const monotonic = xs.every((v, i) => i === 0 || v >= xs[i - 1]!);
    if (monotonic) plot.setData([xs, ys]);
    else {
      const idx = xs.map((_, i) => i).sort((a, b) => xs[a]! - xs[b]!);
      plot.setData([idx.map((i) => xs[i]!), idx.map((i) => ys[i]!)]);
    }
  });
  void tick;

  return (
    <div className="chart">
      <div className="chart-controls">
        <label>
          Eixo vertical
          <select value={yKey} onChange={(e) => setYKey(e.target.value)}>
            {axes.map((a) => (
              <option key={a.key} value={a.key}>
                {axisLabel(a.key)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Eixo horizontal
          <select value={xKey} onChange={(e) => setXKey(e.target.value)}>
            {axes.map((a) => (
              <option key={a.key} value={a.key}>
                {axisLabel(a.key)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div ref={wrapRef} className="chart-canvas" />
    </div>
  );
}
