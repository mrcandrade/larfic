import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Runner, samplesToCsv, withOverrides, type AnySimulation, type Params } from "@fisilab/core";
import { Stage, type StageHandle } from "./Stage.tsx";
import { Controls } from "./Controls.tsx";
import { Chart } from "./Chart.tsx";
import { Equation } from "./Equation.tsx";
import { Markdown } from "./Guide.tsx";
import { Predict } from "./Predict.tsx";
import { Exercises } from "./Exercises.tsx";
import { useTheme } from "./theme.ts";
import { progress } from "./progress.ts";

const SPEEDS = [0.1, 0.25, 0.5, 1, 2, 5];

export interface SimViewProps {
  sim: AnySimulation;
  /** Parâmetros iniciais (ex.: vindos de um link ou de um roteiro do professor). */
  initialParams?: Partial<Params>;
  initialScenario?: string;
  /** Parâmetros que o aluno não pode alterar. */
  locked?: string[];
  /** Modo incorporado (iframe): esconde teoria e exercícios. */
  embed?: boolean;
  /** Avisado a cada mudança de parâmetros (para atualizar a URL). */
  onParamsChange?(params: Params, scenario: string): void;
  /** Painel extra (ex.: tutor de IA) que recebe o estado atual. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sidebar?(ctx: { runner: Runner<any>; tick: number; scenarioId: string }): React.ReactNode;
}

export function SimView({ sim, initialParams, initialScenario, locked, embed, onParamsChange, sidebar }: SimViewProps) {
  const theme = useTheme();
  const firstScenario = sim.scenarios.find((s) => s.id === initialScenario) ?? sim.scenarios[0];
  const [scenarioId, setScenarioId] = useState(firstScenario?.id ?? "");
  const [params, setParams] = useState<Params>(() => withOverrides(sim, { ...firstScenario?.params, ...initialParams }));
  const runner = useMemo(() => new Runner(sim, params), [sim]); // eslint-disable-line react-hooks/exhaustive-deps
  const stageRef = useRef<StageHandle>(null);
  const [playing, setPlaying] = useState(false);
  useTone(sim, runner, playing, params);
  const [speed, setSpeed] = useState(1);
  const [tick, setTick] = useState(0);
  const [predicted, setPredicted] = useState(false);
  const [observed, setObserved] = useState(false);
  const refresh = useCallback(() => setTick((n) => n + 1), []);
  const scenario = sim.scenarios.find((s) => s.id === scenarioId);
  const liveKeys = useMemo(() => new Set(sim.params.filter((p) => p.live).map((p) => p.key)), [sim]);
  const lastParams = useRef(params);

  useEffect(() => progress.visit(sim.id), [sim.id]);

  useEffect(() => {
    // Parâmetros "ao vivo" não reiniciam a simulação; os demais reiniciam.
    const prev = lastParams.current;
    lastParams.current = params;
    const onlyLive = Object.keys(params).every((k) => params[k] === prev[k] || liveKeys.has(k));
    if (onlyLive && prev !== params) runner.setLiveParams(params);
    else runner.reset(params);
    refresh();
    onParamsChange?.(params, scenarioId);
  }, [runner, params, refresh, liveKeys]); // eslint-disable-line react-hooks/exhaustive-deps

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
      stageRef.current?.redraw();
      if (now - lastUi > 80 || runner.finished) {
        lastUi = now;
        refresh();
      }
      if (runner.finished) {
        setPlaying(false);
        setObserved(true);
      } else raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing, runner, refresh]);

  const applyScenario = (id: string) => {
    setScenarioId(id);
    setPredicted(false);
    setObserved(false);
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
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const togglePlay = () => {
    if (runner.finished) runner.reset(params);
    if (!playing && predicted) setObserved(true);
    setPlaying((p) => !p);
  };

  const values = runner.observe();
  const first = runner.samples[0];
  const conservedIdx = sim.observables.findIndex((o) => o.key === sim.conserved);
  const live = sim.liveEquations?.(runner.state, runner.params, runner.t) ?? [];
  const hasPredict = Boolean(scenario?.predict?.length) && !embed;

  return (
    <div className={`fl-simview ${embed ? "fl-embed" : ""}`}>
      {!embed && (
        <section className="fl-sim-header">
          <p className="fl-eyebrow">
            {sim.course} · {sim.topic}
          </p>
          <h1>{sim.title}</h1>
          <p>{sim.summary}</p>
        </section>
      )}

      <section className="fl-stage-panel">
        <Stage ref={stageRef} sim={sim} runner={runner} theme={theme} onInteract={refresh} />
        {!sim.static && (
          <div className="fl-playback" role="toolbar" aria-label="Controle de tempo">
            <button className="fl-primary" onClick={togglePlay}>
              {playing ? "Pausar" : runner.finished ? "Repetir" : runner.t > 0 ? "Continuar" : "Iniciar"}
            </button>
            <button
              onClick={() => {
                setPlaying(false);
                for (let i = 0; i < 10; i++) runner.stepOnce();
                refresh();
              }}
              disabled={runner.finished}
              title="Avança 10 passos de integração"
            >
              Passo
            </button>
            <button
              onClick={() => {
                setPlaying(false);
                runner.rewindTo(runner.t - Math.max(0.25, 50 * runner.dt));
                refresh();
              }}
              disabled={runner.t === 0}
            >
              Voltar
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
            <label className="fl-speed">
              Velocidade
              <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>
                {SPEEDS.map((s) => (
                  <option key={s} value={s}>
                    {String(s).replace(".", ",")}×
                  </option>
                ))}
              </select>
            </label>
            <span className="fl-clock">t = {runner.t.toFixed(3).replace(".", ",")} s</span>
          </div>
        )}
        {sim.actions && (
          <div className="fl-actions" role="toolbar" aria-label="Ferramentas">
            {sim.actions.map((a) => (
              <button
                key={a.id}
                className={a.active?.(runner.state) ? "fl-active" : ""}
                aria-pressed={a.active ? Boolean(a.active(runner.state)) : undefined}
                onClick={() => {
                  runner.setState(a.run(runner.state, runner.params));
                  refresh();
                }}
              >
                {a.label}
              </button>
            ))}
          </div>
        )}
      </section>

      <aside className="fl-side-panel">
        {sim.scenarios.length > 0 && (
          <label className="fl-scenario">
            Cenário
            <select value={scenarioId} onChange={(e) => applyScenario(e.target.value)}>
              {sim.scenarios.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        )}
        <Controls
          specs={sim.params}
          values={params}
          locked={locked}
          onChange={(key, v) => {
            if (!liveKeys.has(key)) setPlaying(false);
            setParams((p) => ({ ...p, [key]: v }));
          }}
        />
      </aside>

      <section className="fl-readouts">
        <h2>Medidas</h2>
        <table>
          <tbody>
            {sim.observables.map((o, i) => (
              <tr key={o.key}>
                <th scope="row">{o.label}</th>
                <td>{fmt(values[i] ?? 0)}</td>
                <td className="fl-unit">{o.unit}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {conservedIdx >= 0 && first && (
          <p className="fl-check">
            Desvio relativo de {sim.observables[conservedIdx]!.label}: {fmt(relDev(values[conservedIdx] ?? 0, first.values[conservedIdx] ?? 0))}
          </p>
        )}
        <button onClick={exportCsv}>Exportar CSV</button>
      </section>

      <section className="fl-chart-panel">
        <Chart sim={sim} runner={runner} theme={theme} tick={tick} />
      </section>

      {!embed && (
        <section className="fl-theory">
          <h2>Modelo</h2>
          {sim.equations.map((eq) => (
            <Equation key={eq} tex={eq} />
          ))}
          {live.length > 0 && (
            <div className="fl-live">
              <h3>Com os valores atuais</h3>
              {live.map((eq, i) => (
                <Equation key={i} tex={eq} />
              ))}
            </div>
          )}
          {hasPredict && (
            <Predict
              key={scenarioId}
              questions={scenario!.predict!}
              observed={observed}
              onPredicted={() => {
                setPredicted(true);
                progress.prediction(sim.id);
              }}
            />
          )}
          {scenario && <Markdown text={scenario.guide} />}
          <Exercises
            sim={sim}
            onOpen={(p) => {
              setPlaying(false);
              setParams(withOverrides(sim, p));
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          />
        </section>
      )}
      {sidebar && <section className="fl-extra">{sidebar({ runner, tick, scenarioId })}</section>}
    </div>
  );
}

function fmt(v: number): string {
  if (!Number.isFinite(v)) return "—";
  if (v === 0) return "0";
  const a = Math.abs(v);
  const s = a >= 1e5 || a < 1e-3 ? v.toExponential(3) : v.toFixed(a >= 100 ? 1 : 3);
  return s.replace(".", ",");
}

function relDev(v: number, v0: number): number {
  return v0 === 0 ? v - v0 : (v - v0) / Math.abs(v0);
}

/** Toca o som da simulação (se ela tiver `tone`) enquanto está rodando. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function useTone(sim: AnySimulation, runner: Runner<any>, playing: boolean, params: Params) {
  const nodes = useRef<{ ctx: AudioContext; osc: OscillatorNode; gain: GainNode } | null>(null);
  useEffect(() => {
    if (!sim.tone || !playing || typeof AudioContext === "undefined") return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    gain.gain.value = 0;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    nodes.current = { ctx, osc, gain };
    return () => {
      osc.stop();
      void ctx.close();
      nodes.current = null;
    };
  }, [sim, playing]);
  useEffect(() => {
    const n = nodes.current;
    if (!n || !sim.tone) return;
    const { freq, gain } = sim.tone(params, runner.state);
    n.osc.frequency.setTargetAtTime(Math.max(20, Math.min(20000, freq)), n.ctx.currentTime, 0.02);
    n.gain.gain.setTargetAtTime(Math.max(0, Math.min(0.5, gain)), n.ctx.currentTime, 0.05);
  }, [sim, runner, params, playing]);
}
