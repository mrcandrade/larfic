import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Runner, samplesToCsv, withOverrides, type AnySimulation, type Params } from "@fisilab/core";
import { Stage, type InkStroke, type StageHandle } from "./Stage.tsx";
import { Controls } from "./Controls.tsx";
import { Chart } from "./Chart.tsx";
import { Equation } from "./Equation.tsx";
import { Markdown } from "./Guide.tsx";
import { Predict } from "./Predict.tsx";
import { Exercises } from "./Exercises.tsx";
import { prefersReducedMotion, useTheme } from "./theme.ts";
import { SHORTCUTS, focusKind, shouldAnnounce, shortcutFor, stageSummary, type ShortcutAction } from "./a11y.ts";
import { progress } from "./progress.ts";
import type { SubmissionPrediction } from "@fisilab/platform";

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
  /** Abre já no modo apresentação (projetar em sala). Ignorado no modo incorporado. */
  present?: boolean;
  /** Avisado quando o modo apresentação liga ou desliga (para refletir na URL). */
  onPresentChange?(on: boolean): void;
  /** Começa rodando, a menos que o usuário prefira menos movimento (prefers-reduced-motion). */
  autoplay?: boolean;
  /**
   * Previsões de uma atividade: as já salvas (restauradas ao reabrir) e os avisos de cada escolha e
   * de quando a resposta é revelada. Fora de uma atividade, as previsões só contam no progresso local.
   */
  predictions?: { saved: SubmissionPrediction[]; onRecord(p: SubmissionPrediction): void; onReveal(scenario: string): void };
}

export function SimView({ sim, initialParams, initialScenario, locked, embed, onParamsChange, sidebar, present, onPresentChange, autoplay, predictions }: SimViewProps) {
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
  const rootRef = useRef<HTMLDivElement>(null);
  const canPresent = !embed;
  const [presenting, setPresenting] = useState(Boolean(present) && canPresent);
  const [panelOpen, setPanelOpen] = useState(true);
  const [penOn, setPenOn] = useState(false);
  const [strokes, setStrokes] = useState<InkStroke[]>([]);
  const [helpOpen, setHelpOpen] = useState(false);
  const [showDerivation, setShowDerivation] = useState(false);
  const [viewportH, setViewportH] = useState(() => (typeof window === "undefined" ? 800 : window.innerHeight));

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

  // Autoinício só quando pedido e se o usuário não preferir menos movimento.
  useEffect(() => {
    if (autoplay && !sim.static && !prefersReducedMotion()) setPlaying(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Modo apresentação: tela cheia quando o navegador permite; sem ela, o CSS cobre a janela.
  const enteredFullscreen = useRef(false);
  const enterPresent = useCallback(() => {
    if (!canPresent) return;
    setPresenting(true);
    const el = rootRef.current;
    if (el && typeof el.requestFullscreen === "function" && !document.fullscreenElement) {
      el.requestFullscreen().catch(() => {
        /* sem gesto do usuário ou sem suporte: segue em tela da janela */
      });
    }
  }, [canPresent]);
  const exitPresent = useCallback(() => {
    setPresenting(false);
    setPenOn(false);
    setHelpOpen(false);
    if (typeof document !== "undefined" && document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
  }, []);
  useEffect(() => {
    const on = () => {
      if (document.fullscreenElement) enteredFullscreen.current = true;
      else if (enteredFullscreen.current) {
        // Saiu da tela cheia (Esc do navegador): sai também da apresentação.
        enteredFullscreen.current = false;
        setPresenting(false);
        setPenOn(false);
      }
    };
    document.addEventListener("fullscreenchange", on);
    return () => document.removeEventListener("fullscreenchange", on);
  }, []);
  const firstPresent = useRef(true);
  useEffect(() => {
    if (firstPresent.current) {
      firstPresent.current = false;
      if (!presenting) return;
    }
    onPresentChange?.(presenting);
  }, [presenting]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!presenting) return;
    const on = () => setViewportH(window.innerHeight);
    on();
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, [presenting]);

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
    if (sim.static) return;
    if (runner.finished) runner.reset(params);
    if (!playing && predicted) setObserved(true);
    setPlaying((p) => !p);
  };
  const forceAnnounce = useRef(false);
  const stepForward = () => {
    if (sim.static || runner.finished) return;
    setPlaying(false);
    for (let i = 0; i < 10; i++) runner.stepOnce();
    forceAnnounce.current = true;
    refresh();
  };
  const stepBack = () => {
    if (sim.static || runner.t === 0) return;
    setPlaying(false);
    runner.rewindTo(runner.t - Math.max(0.25, 50 * runner.dt));
    forceAnnounce.current = true;
    refresh();
  };
  const resetRun = () => {
    setPlaying(false);
    runner.reset(params);
    forceAnnounce.current = true;
    refresh();
  };

  const runShortcut = (a: ShortcutAction) => {
    switch (a.kind) {
      case "toggle-play":
        return togglePlay();
      case "step":
        return stepForward();
      case "back":
        return stepBack();
      case "reset":
        return resetRun();
      case "scenario": {
        const sc = sim.scenarios[a.index];
        if (sc) {
          forceAnnounce.current = true;
          applyScenario(sc.id);
        }
        return;
      }
      case "help":
        return setHelpOpen((h) => !h);
      case "exit":
        if (helpOpen) setHelpOpen(false);
        else if (penOn) setPenOn(false);
        else if (presenting) exitPresent();
        return;
      case "clear-ink":
        return setStrokes([]);
      case "pen":
        return setPenOn((p) => !p);
      case "panel":
        return setPanelOpen((p) => !p);
    }
  };
  /** Trata uma tecla; devolve true quando ela virou atalho. */
  const onShortcutKey = (e: { key: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean; target: EventTarget | null; preventDefault(): void }) => {
    const a = shortcutFor(e, focusKind(e.target as HTMLElement | null), {
      presenting,
      scenarios: sim.scenarios.length,
      isStatic: sim.static,
    });
    if (!a) return false;
    // Esc fora da apresentação só fecha a ajuda.
    if (a.kind === "exit" && !presenting && !helpOpen) return false;
    e.preventDefault();
    runShortcut(a);
    return true;
  };
  const keyRef = useRef(onShortcutKey);
  keyRef.current = onShortcutKey;
  // Na apresentação os atalhos valem na página toda; fora dela, com o foco no palco (ou com a ajuda aberta).
  useEffect(() => {
    if (!presenting && !helpOpen) return;
    const on = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      keyRef.current(e);
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [presenting, helpOpen]);

  const values = runner.observe();
  const first = runner.samples[0];
  const conservedIdx = sim.observables.findIndex((o) => o.key === sim.conserved);
  const live = sim.liveEquations?.(runner.state, runner.params, runner.t) ?? [];
  const hasPredict = Boolean(scenario?.predict?.length) && !embed;

  // Descrição textual para leitores de tela, atualizada com moderação.
  const summary = stageSummary({
    title: sim.title,
    observables: sim.observables,
    values,
    t: runner.t,
    playing,
    finished: runner.finished,
    isStatic: sim.static,
    scenario: scenario?.label,
  });
  const [announcement, setAnnouncement] = useState(summary);
  const annRef = useRef({ at: 0, playing: false });
  useEffect(() => {
    const now = performance.now();
    const prev = annRef.current;
    if (shouldAnnounce(prev, now, playing, forceAnnounce.current)) {
      forceAnnounce.current = false;
      annRef.current = { at: now, playing };
      setAnnouncement(summary);
      return;
    }
    if (prev.playing !== playing) annRef.current = { at: now, playing };
    if (playing) return;
    // Parada: mudanças (parâmetros, arrastes) são anunciadas depois de um respiro.
    const id = setTimeout(() => {
      annRef.current = { at: performance.now(), playing: false };
      setAnnouncement(summary);
    }, 1500);
    return () => clearTimeout(id);
  }, [tick, playing, summary]);

  const stageMax = presenting ? Math.max(260, viewportH - (sim.static ? 120 : 190)) : undefined;

  return (
    <div
      ref={rootRef}
      className={`fl-simview ${embed ? "fl-embed" : ""} ${presenting ? "fl-presenting" : ""} ${presenting && !panelOpen ? "fl-panel-closed" : ""}`}
    >
      {!embed && !presenting && (
        <section className="fl-sim-header">
          <div className="fl-sim-title">
            <div>
              <p className="fl-eyebrow">
                {sim.course} · {sim.topic}
              </p>
              <h1>{sim.title}</h1>
            </div>
            <div className="fl-sim-tools">
              <button onClick={() => setHelpOpen(true)} aria-haspopup="dialog">
                Atalhos
              </button>
              <button className="fl-primary" onClick={enterPresent} title="Tela cheia para projetar em sala">
                Apresentar
              </button>
            </div>
          </div>
          <p>{sim.summary}</p>
        </section>
      )}

      {presenting && (
        <div className="fl-present-bar" role="toolbar" aria-label="Modo apresentação">
          <strong className="fl-present-title">{sim.title}</strong>
          {sim.scenarios.length > 1 && scenario && <span className="fl-present-scenario">{scenario.label}</span>}
          <span className="fl-present-tools">
            <button aria-pressed={panelOpen} onClick={() => setPanelOpen((o) => !o)} title="Tecla L">
              Painel
            </button>
            <button aria-pressed={penOn} className={penOn ? "fl-active" : ""} onClick={() => setPenOn((o) => !o)} title="Tecla P">
              Caneta
            </button>
            <button onClick={() => setStrokes([])} disabled={strokes.length === 0} title="Tecla C">
              Limpar
            </button>
            <button onClick={() => setHelpOpen(true)} aria-haspopup="dialog" title="Tecla ?">
              Atalhos
            </button>
            <button onClick={exitPresent} title="Tecla Esc">
              Sair
            </button>
          </span>
        </div>
      )}

      <section className="fl-stage-panel" aria-label="Palco da simulação">
        <Stage
          ref={stageRef}
          sim={sim}
          runner={runner}
          theme={theme}
          onInteract={refresh}
          maxHeight={stageMax}
          description={announcement}
          onKeyDown={(e) => {
            if (!presenting && !helpOpen) onShortcutKey(e);
          }}
          ink={presenting ? { active: penOn, strokes, onChange: setStrokes } : undefined}
        />
        <p className="fl-sr-only" aria-live="polite" aria-atomic="true">
          {announcement}
        </p>
        {!sim.static && (
          <div className="fl-playback" role="toolbar" aria-label="Controle de tempo">
            <button className="fl-primary" onClick={togglePlay} aria-keyshortcuts="Space">
              {playing ? "Pausar" : runner.finished ? "Repetir" : runner.t > 0 ? "Continuar" : "Iniciar"}
            </button>
            <button onClick={stepForward} disabled={runner.finished} title="Avança 10 passos de integração" aria-keyshortcuts="ArrowRight">
              Passo
            </button>
            <button onClick={stepBack} disabled={runner.t === 0} aria-keyshortcuts="ArrowLeft">
              Voltar
            </button>
            <button onClick={resetRun} aria-keyshortcuts="R">
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
          {sim.derivation && (
            <div className="fl-derivation">
              <button
                aria-expanded={showDerivation}
                aria-controls={`derivacao-${sim.id}`}
                onClick={() => setShowDerivation((v) => !v)}
              >
                {showDerivation ? "Esconder a derivação" : "Modo engenharia: ver a derivação completa"}
              </button>
              {showDerivation && (
                <div id={`derivacao-${sim.id}`} className="fl-derivation-body" role="region" aria-label="Derivação completa do modelo">
                  <Markdown text={sim.derivation} />
                </div>
              )}
            </div>
          )}
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
              onPredicted={(restored) => {
                setPredicted(true);
                if (!restored) progress.prediction(sim.id);
              }}
              saved={predictions && scenario!.predict!.map((_, i) => predictions.saved.find((p) => p.sim === sim.id && p.scenario === scenarioId && p.index === i))}
              onChoice={
                predictions &&
                ((index, chosen) => {
                  const q = scenario!.predict![index]!;
                  predictions.onRecord({ sim: sim.id, scenario: scenarioId, index, question: q.question, chosen, option: q.options[chosen], correct: chosen === q.answer, at: new Date().toISOString() });
                })
              }
              onReveal={predictions && (() => predictions.onReveal(scenarioId))}
            />
          )}
          {scenario && <Markdown text={scenario.guide} />}
          <Exercises
            sim={sim}
            onOpen={(p) => {
              setPlaying(false);
              setParams(withOverrides(sim, p));
              window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
            }}
          />
        </section>
      )}
      {sidebar && <section className="fl-extra">{sidebar({ runner, tick, scenarioId })}</section>}
      {helpOpen && <ShortcutHelp presenting={presenting} onClose={() => setHelpOpen(false)} />}
    </div>
  );
}

/** Caixa com a lista de atalhos de teclado (tecla ?). */
function ShortcutHelp({ presenting, onClose }: { presenting: boolean; onClose(): void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    return () => prev?.focus?.();
  }, []);
  return (
    <div className="fl-help-backdrop" onClick={onClose}>
      <div className="fl-help" role="dialog" aria-modal="true" aria-labelledby="fl-help-title" onClick={(e) => e.stopPropagation()}>
        <h2 id="fl-help-title">Atalhos do teclado</h2>
        <p className="fl-hint">
          {presenting ? "Valem em toda a tela durante a apresentação." : "Valem com o foco no palco (clique nele ou chegue com Tab)."}
        </p>
        <dl>
          {SHORTCUTS.filter((s) => presenting || !s.presentingOnly).map((s) => (
            <div key={s.keys}>
              <dt>
                <kbd>{s.keys}</kbd>
              </dt>
              <dd>{s.label}</dd>
            </div>
          ))}
        </dl>
        <button ref={closeRef} onClick={onClose}>
          Fechar
        </button>
      </div>
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
  const timbre = useRef("");
  useEffect(() => {
    if (!sim.tone || !playing || typeof AudioContext === "undefined") return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    gain.gain.value = 0;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    nodes.current = { ctx, osc, gain };
    timbre.current = "";
    return () => {
      osc.stop();
      void ctx.close();
      nodes.current = null;
    };
  }, [sim, playing]);
  useEffect(() => {
    const n = nodes.current;
    if (!n || !sim.tone) return;
    const { freq, gain, harmonics } = sim.tone(params, runner.state);
    // Timbre: amplitudes relativas dos harmônicos (1, 2, 3, ...) viram uma onda periódica.
    const key = harmonics?.join(",") ?? "";
    if (key !== timbre.current) {
      timbre.current = key;
      if (harmonics?.length) {
        const imag = new Float32Array(harmonics.length + 1);
        harmonics.forEach((a, i) => (imag[i + 1] = a));
        n.osc.setPeriodicWave(n.ctx.createPeriodicWave(new Float32Array(harmonics.length + 1), imag));
      } else n.osc.type = "sine";
    }
    n.osc.frequency.setTargetAtTime(Math.max(20, Math.min(20000, freq)), n.ctx.currentTime, 0.02);
    n.gain.gain.setTargetAtTime(Math.max(0, Math.min(0.5, gain)), n.ctx.currentTime, 0.05);
  }, [sim, runner, params, playing]);
}
