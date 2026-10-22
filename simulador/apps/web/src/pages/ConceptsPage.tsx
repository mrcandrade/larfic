import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Markdown } from "@fisilab/ui-kit";
import {
  conceptAreas,
  conceptHref,
  conceptSimHref,
  concepts,
  findConcept,
  loadConceptProgress,
  recordCheck,
  recordObserved,
  recordPrediction,
  retryCheck,
  saveConceptProgress,
  searchConcepts,
  stageLabel,
  stageOf,
  summarize,
  type Concept,
  type ConceptArea,
  type ConceptProgress,
  type ConceptQuestion,
  type ConceptStage,
} from "../concepts.ts";
import { findSim } from "../catalog.ts";
import "./lab.css";
import "./concepts.css";

/** Progresso em localStorage, salvo no mesmo instante da ação (o link da sim troca de página logo em seguida). */
function useConceptProgress() {
  const [progress, setProgress] = useState<ConceptProgress>(() => loadConceptProgress());
  const ref = useRef(progress);
  useEffect(() => {
    const on = (e: StorageEvent) => {
      if (e.key === null || e.key.startsWith("fisilab.concepcoes")) {
        ref.current = loadConceptProgress();
        setProgress(ref.current);
      }
    };
    window.addEventListener("storage", on);
    return () => window.removeEventListener("storage", on);
  }, []);
  const update = useCallback((fn: (p: ConceptProgress) => ConceptProgress) => {
    const next = fn(ref.current);
    if (next === ref.current) return;
    ref.current = next;
    saveConceptProgress(next);
    setProgress(next);
  }, []);
  return [progress, update] as const;
}

export function ConceptsPage({ id }: { id?: string }) {
  const [progress, update] = useConceptProgress();
  const concept = id ? findConcept(id) : undefined;
  useEffect(() => {
    window.scrollTo?.(0, 0);
  }, [id]);
  if (id && !concept) {
    return (
      <div className="lab-page">
        <p className="lab-warn">Concepção “{id}” não encontrada.</p>
        <p>
          <a href="#/concepcoes">← Todas as concepções</a>
        </p>
      </div>
    );
  }
  return concept ? <ConceptDetail concept={concept} progress={progress} update={update} /> : <ConceptList progress={progress} />;
}

// ───────────────────────────── lista ─────────────────────────────

const STAGE_FILTERS: { id: "" | "pendentes" | ConceptStage; label: string }[] = [
  { id: "", label: "Todas" },
  { id: "pendentes", label: "Não superadas" },
  { id: "superada", label: "Superadas" },
];

function ConceptList({ progress }: { progress: ConceptProgress }) {
  const [text, setText] = useState("");
  const [area, setArea] = useState<ConceptArea | "">("");
  const [stage, setStage] = useState<(typeof STAGE_FILTERS)[number]["id"]>("");
  const sum = summarize(concepts, progress);
  const found = useMemo(() => {
    const byText = searchConcepts(concepts, text, area);
    if (!stage) return byText;
    return byText.filter((c) => {
      const st = stageOf(c, progress[c.id]);
      return stage === "pendentes" ? st !== "superada" : st === stage;
    });
  }, [text, area, stage, progress]);
  const searchId = useId();
  const pct = sum.total ? Math.round((100 * sum.superadas) / sum.total) : 0;

  return (
    <div className="lab-page">
      <header className="lab-head">
        <h1>Concepções alternativas</h1>
        <p>
          Ideias intuitivas e muito comuns que entram em conflito com a física. Em cada uma, você <strong>prevê</strong> o resultado, <strong>observa</strong> numa
          simulação feita para confrontá-la, lê a <strong>explicação</strong> e responde a uma pergunta de <strong>verificação</strong> numa situação nova.
        </p>
      </header>

      <section className="lab-panel" aria-label="Seu progresso">
        <div className="cb-counters">
          <div>
            <strong>{sum.superadas}</strong>
            <span>de {sum.total} superadas</span>
          </div>
          <div>
            <strong>{sum.emAndamento}</strong>
            <span>em andamento</span>
          </div>
          <div>
            <strong>{sum.previsoesErradas}</strong>
            <span>de {sum.previsoes} previsões revelaram a concepção</span>
          </div>
        </div>
        <div className="cb-bar" role="progressbar" aria-valuemin={0} aria-valuemax={sum.total} aria-valuenow={sum.superadas} aria-label="Concepções superadas">
          <span style={{ width: `${pct}%` }} />
        </div>
        <p className="lab-muted lab-small">O progresso fica salvo neste navegador.</p>
      </section>

      <section className="lab-panel" aria-label="Filtros">
        <div className="cb-filters">
          <label htmlFor={searchId} className="cb-search">
            <span>Buscar</span>
            <input id={searchId} type="search" value={text} placeholder="ex.: corrente, lente, gravidade" onChange={(e) => setText(e.target.value)} />
          </label>
          <label>
            <span>Área</span>
            <select value={area} onChange={(e) => setArea(e.target.value as ConceptArea | "")}>
              <option value="">Todas as áreas</option>
              {conceptAreas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Situação</span>
            <select value={stage} onChange={(e) => setStage(e.target.value as typeof stage)}>
              {STAGE_FILTERS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="lab-status" aria-live="polite">
          {found.length === concepts.length ? `${found.length} concepções` : `${found.length} de ${concepts.length} concepções`}
        </p>
      </section>

      {conceptAreas.map((a) => {
        const items = found.filter((c) => c.area === a.id);
        if (!items.length) return null;
        return (
          <section key={a.id} className="cb-area" aria-labelledby={`cb-area-${a.id}`}>
            <h2 id={`cb-area-${a.id}`}>{a.label}</h2>
            <ul className="cb-cards">
              {items.map((c) => {
                const st = stageOf(c, progress[c.id]);
                return (
                  <li key={c.id}>
                    <a className="cb-card" href={conceptHref(c.id)}>
                      <span className="cb-card-top">
                        <span className="cb-topic">{c.topic}</span>
                        <StageBadge stage={st} />
                      </span>
                      <strong className="cb-card-title">{c.title}</strong>
                      <span className="cb-quote">“{c.statement}”</span>
                    </a>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
      {!found.length && <p className="lab-muted">Nenhuma concepção encontrada com esses filtros.</p>}
    </div>
  );
}

function StageBadge({ stage }: { stage: ConceptStage }) {
  return <span className={`cb-badge cb-badge-${stage}`}>{stageLabel[stage]}</span>;
}

// ───────────────────────────── detalhe ─────────────────────────────

interface DetailProps {
  concept: Concept;
  progress: ConceptProgress;
  update: (fn: (p: ConceptProgress) => ConceptProgress) => void;
}

function ConceptDetail({ concept: c, progress, update }: DetailProps) {
  const rec = progress[c.id] ?? {};
  const stage = stageOf(c, rec);
  const predicted = rec.prediction !== undefined;
  const observed = predicted && !!rec.observed;
  const checked = rec.check !== undefined;
  const sim = findSim(c.sim.id);
  const scenario = sim?.scenarios.find((s) => s.id === c.sim.scenario);
  const areaLabel = conceptAreas.find((a) => a.id === c.area)?.label ?? "";
  const idx = concepts.findIndex((x) => x.id === c.id);
  const prev = concepts[idx - 1];
  const next = concepts[idx + 1];
  const nextPending = concepts.slice(idx + 1).concat(concepts.slice(0, idx)).find((x) => stageOf(x, progress[x.id]) !== "superada");

  return (
    <div className="lab-page cb-detail">
      <p className="cb-back">
        <a href="#/concepcoes">← Todas as concepções</a>
      </p>
      <header className="lab-head">
        <p className="cb-meta">
          <span>{areaLabel}</span>
          <span aria-hidden="true">·</span>
          <span>{c.topic}</span>
          {c.source && (
            <>
              <span aria-hidden="true">·</span>
              <span>{c.source}</span>
            </>
          )}
          <StageBadge stage={stage} />
        </p>
        <h1>{c.title}</h1>
        <blockquote className="cb-statement">
          <p>“{c.statement}”</p>
        </blockquote>
      </header>

      <ol className="cb-steps">
        <li className="lab-panel cb-step" aria-labelledby="cb-s1">
          <h2 id="cb-s1">
            <span className="cb-num">1</span> Prever
          </h2>
          {predicted ? (
            <p>
              Sua previsão (registrada): <strong>{c.predict.options[rec.prediction!]}</strong>
            </p>
          ) : (
            <QuestionForm key={`p-${c.id}`} name={`p-${c.id}`} question={c.predict} submitLabel="Registrar previsão" onSubmit={(i) => update((p) => recordPrediction(p, c.id, i))} />
          )}
          {!predicted && <p className="lab-muted lab-small">Responda com sinceridade, antes de abrir a simulação: não vale nota, e a previsão fica registrada.</p>}
        </li>

        <li className={`lab-panel cb-step${predicted ? "" : " cb-locked"}`} aria-labelledby="cb-s2">
          <h2 id="cb-s2">
            <span className="cb-num">2</span> Observar
          </h2>
          {predicted ? (
            <>
              <p className="lab-note">{c.observe}</p>
              <p className="cb-actions">
                <a className="cb-button" href={conceptSimHref(c)} onClick={() => update((p) => recordObserved(p, c.id))}>
                  Abrir a simulação: {sim?.title ?? c.sim.id}
                  {scenario ? ` (${scenario.label})` : ""}
                </a>
                {!observed && (
                  <button type="button" onClick={() => update((p) => recordObserved(p, c.id))}>
                    Já observei
                  </button>
                )}
              </p>
              <p className="lab-muted lab-small">A simulação abre já no cenário e com os parâmetros certos. Depois, use “Voltar” do navegador para retornar a esta página.</p>
            </>
          ) : (
            <p className="lab-muted">Registre a sua previsão para liberar a simulação.</p>
          )}
        </li>

        <li className={`lab-panel cb-step${observed ? "" : " cb-locked"}`} aria-labelledby="cb-s3">
          <h2 id="cb-s3">
            <span className="cb-num">3</span> Explicar
          </h2>
          {observed ? (
            <>
              {rec.prediction === c.predict.answer ? (
                <p className="lab-ok">Sua previsão estava certa: {c.predict.options[c.predict.answer]}.</p>
              ) : (
                <p>
                  Você previu <strong>{c.predict.options[rec.prediction!]}</strong>; o que a simulação mostra é <strong className="lab-ok">{c.predict.options[c.predict.answer]}</strong>.
                </p>
              )}
              <div className="cb-text">
                <Markdown text={c.explanation} />
              </div>
              <details className="cb-appeal">
                <summary>Por que essa ideia é tão comum?</summary>
                <p>{c.appeal}</p>
              </details>
            </>
          ) : (
            <p className="lab-muted">A explicação aparece depois que você observar a simulação.</p>
          )}
        </li>

        <li className={`lab-panel cb-step${observed ? "" : " cb-locked"}`} aria-labelledby="cb-s4">
          <h2 id="cb-s4">
            <span className="cb-num">4</span> Verificar
          </h2>
          {!observed ? (
            <p className="lab-muted">Uma pergunta numa situação nova, para conferir se a ideia mudou.</p>
          ) : checked ? (
            <div className="cb-result" aria-live="polite">
              <p>
                Sua resposta: <strong>{c.check.options[rec.check!]}</strong>
              </p>
              {rec.check === c.check.answer ? (
                <p className="lab-ok cb-win">Certo! Concepção superada.</p>
              ) : (
                <p className="lab-bad">Ainda não. Releia a explicação e pense de novo na situação.</p>
              )}
              {rec.check === c.check.answer && (
                <div className="cb-text">
                  <Markdown text={c.check.explanation} />
                </div>
              )}
              {rec.check !== c.check.answer && (
                <p>
                  <button type="button" onClick={() => update((p) => retryCheck(p, c.id))}>
                    Tentar de novo
                  </button>
                </p>
              )}
            </div>
          ) : (
            <QuestionForm key={`c-${c.id}-${rec.attempts ?? 0}`} name={`c-${c.id}`} question={c.check} submitLabel="Responder" onSubmit={(i) => update((p) => recordCheck(p, c.id, i))} />
          )}
        </li>
      </ol>

      <nav className="cb-nav" aria-label="Outras concepções">
        {prev ? <a href={conceptHref(prev.id)}>← {prev.title}</a> : <span />}
        {stage === "superada" && nextPending && nextPending.id !== next?.id ? (
          <a href={conceptHref(nextPending.id)}>Próxima não superada: {nextPending.title} →</a>
        ) : next ? (
          <a href={conceptHref(next.id)}>{next.title} →</a>
        ) : (
          <span />
        )}
      </nav>
    </div>
  );
}

function QuestionForm({ name, question, submitLabel, onSubmit }: { name: string; question: ConceptQuestion; submitLabel: string; onSubmit: (choice: number) => void }) {
  const [choice, setChoice] = useState<number | null>(null);
  return (
    <form
      className="cb-question"
      onSubmit={(e) => {
        e.preventDefault();
        if (choice !== null) onSubmit(choice);
      }}
    >
      <fieldset>
        <legend>{question.prompt}</legend>
        {question.options.map((o, i) => (
          <label key={i} className="cb-option">
            <input type="radio" name={name} value={i} checked={choice === i} onChange={() => setChoice(i)} />
            <span>{o}</span>
          </label>
        ))}
      </fieldset>
      <p>
        <button type="submit" disabled={choice === null}>
          {submitLabel}
        </button>
      </p>
    </form>
  );
}
