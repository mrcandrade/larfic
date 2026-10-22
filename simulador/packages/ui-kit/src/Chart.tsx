import { useMemo, useState } from "react";
import type { AnySimulation, Runner, Theme } from "@fisilab/core";
import { Plot } from "./Plot.tsx";

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
    const out = [{ label: label(yKey), points: xs.map((x, i): [number, number] => [x, column(yKey)[i] ?? NaN]) }];
    if (y2Key) out.push({ label: label(y2Key), points: xs.map((x, i): [number, number] => [x, column(y2Key)[i] ?? NaN]) });
    return out;
  }, [tick, xKey, yKey, y2Key, runner]); // eslint-disable-line react-hooks/exhaustive-deps

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
      <Plot series={series} xLabel={label(xKey)} yLabel={y2Key ? `${label(yKey)} · ${label(y2Key)}` : label(yKey)} theme={theme} />
    </div>
  );
}
