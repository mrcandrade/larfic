import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Runner, samplesToCsv, withOverrides, type Params, type Simulation } from "@fisilab/core";
import { Stage } from "./Stage.tsx";
import { Controls } from "./Controls.tsx";
import { Chart } from "./Chart.tsx";
import { Equation } from "./Equation.tsx";
import { Guide } from "./Guide.tsx";

const SPEEDS = [0.1, 0.25, 0.5, 1, 2];

export function SimView({ sim }: { sim: Simulation }) {
  const [params, setParams] = useState<Params>(() => withOverrides(sim, sim.scenarios[0]?.params));
  const [scenarioId, setScenarioId] = useState(sim.scenarios[0]?.id ?? "");
  const runner = useMemo(() => new Runner(sim, params), [sim]); // eslint-disable-line react-hooks/exhaustive-deps
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  // Contador que força a UI a reler o runner (leituras, gráfico) em ~15 Hz.
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    runner.reset(params);
    refresh();
  }, [runner, params, refresh]);

  useEffect(() => {
    runner.speed = speed;
  }, [runner, speed]);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    let lastUi = last;
    const loop = (now: number) => {
      runner.advance(Math.min((now - last) / 1000, 0.1));
      last = now;
      if (now - lastUi > 66 || runner.finished) {
        lastUi = now;
        refresh();
      }
      if (runner.finished) setPlaying(false);
      else raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing, runner, refresh]);

  const scenario = sim.scenarios.find((s) => s.id === scenarioId);

  const applyScenario = (id: string) => {
    setScenarioId(id);
    const sc = sim.scenarios.find((s) => s.id === id);
    if (sc) setParams(withOverrides(sim, sc.params));
    setPlaying(false);
  };

  const exportCsv = () => {
    const blob = new Blob([samplesToCsv(sim, runner.samples)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${sim.id}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const values = runner.observe();
  const first = runner.samples[0];
  const conservedIdx = sim.observables.findIndex((o) => o.key === sim.conserved);

  return (
    <div className="simview">
      <section className="sim-header">
        <h1>{sim.title}</h1>
        <p>{sim.summary}</p>
      </section>

      <section className="stage-panel">
        <Stage sim={sim} runner={runner} tick={tick} />
        <div className="playback" role="toolbar" aria-label="Controle de tempo">
          <button
            className="primary"
            onClick={() => {
              if (runner.finished) runner.reset(params);
              setPlaying((p) => !p);
            }}
          >
            {playing ? "Pausar" : runner.finished ? "Repetir" : "Iniciar"}
          </button>
          <button
            onClick={() => {
              setPlaying(false);
              for (let i = 0; i < 10; i++) runner.stepOnce();
              refresh();
            }}
            disabled={runner.finished}
          >
            Passo
          </button>
          <button
            onClick={() => {
              setPlaying(false);
              runner.rewindTo(runner.t - 0.25);
              refresh();
            }}
            disabled={runner.t === 0}
          >
            Voltar 0,25 s
          </button>
          <button
            onClick={() => {
              setPlaying(false);
              runner.reset(params);
              refresh();
            }}
          >
            Reiniciar
          </button>
          <label className="speed">
            Velocidade
            <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>
              {SPEEDS.map((s) => (
                <option key={s} value={s}>
                  {String(s).replace(".", ",")}×
                </option>
              ))}
            </select>
          </label>
          <span className="clock">t = {runner.t.toFixed(3).replace(".", ",")} s</span>
        </div>
      </section>

      <aside className="side-panel">
        <label className="scenario">
          Cenário
          <select value={scenarioId} onChange={(e) => applyScenario(e.target.value)}>
            {sim.scenarios.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <Controls
          specs={sim.params}
          values={params}
          onChange={(key, v) => {
            setPlaying(false);
            setParams((p) => ({ ...p, [key]: v }));
          }}
        />
      </aside>

      <section className="readouts">
        <h2>Medidas</h2>
        <table>
          <tbody>
            {sim.observables.map((o, i) => (
              <tr key={o.key}>
                <th scope="row">{o.label}</th>
                <td>{fmt(values[i] ?? 0)}</td>
                <td className="unit">{o.unit}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {conservedIdx >= 0 && first && (
          <p className="check">
            Desvio relativo de {sim.observables[conservedIdx]!.label}:{" "}
            {fmt(relDev(values[conservedIdx] ?? 0, first.values[conservedIdx] ?? 0))}
          </p>
        )}
        <button onClick={exportCsv}>Exportar CSV</button>
      </section>

      <section className="chart-panel">
        <Chart sim={sim} runner={runner} tick={tick} />
      </section>

      <section className="theory">
        <h2>Modelo</h2>
        {sim.equations.map((eq) => (
          <Equation key={eq} tex={eq} />
        ))}
        {scenario && <Guide markdown={scenario.guide} />}
      </section>
    </div>
  );
}

function fmt(v: number): string {
  if (v === 0) return "0";
  const a = Math.abs(v);
  const s = a >= 1e5 || a < 1e-3 ? v.toExponential(3) : v.toFixed(a >= 100 ? 1 : 3);
  return s.replace(".", ",");
}

function relDev(v: number, v0: number): number {
  return v0 === 0 ? v - v0 : (v - v0) / Math.abs(v0);
}
