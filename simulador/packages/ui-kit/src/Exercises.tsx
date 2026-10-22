import { useState } from "react";
import { checkAnswer, formatBR, generateExercise, parseAnswer, type AnySimulation, type ExerciseInstance, type Params } from "@fisilab/core";
import { Markdown } from "./Guide.tsx";
import { progress } from "./progress.ts";

interface Props {
  sim: AnySimulation;
  /** Abre a simulação com os parâmetros da questão, para o aluno conferir. */
  onOpen(params: Params): void;
}

const newSeed = () => Math.floor(Math.random() * 2 ** 31);

/** Exercícios paramétricos: valores sorteados, correção automática com tolerância. */
export function Exercises({ sim, onOpen }: Props) {
  const templates = sim.exercises ?? [];
  const [current, setCurrent] = useState<ExerciseInstance | null>(null);
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<null | boolean>(null);
  const [showHint, setShowHint] = useState(false);

  if (!templates.length) return null;

  const start = (templateId: string) => {
    const t = templates.find((x) => x.id === templateId)!;
    setCurrent(generateExercise(sim, t, newSeed()));
    setAnswer("");
    setResult(null);
    setShowHint(false);
  };

  return (
    <div className="fl-exercises">
      <h3>Exercícios</h3>
      <div className="fl-exercise-list">
        {templates.map((t, i) => (
          <button key={t.id} onClick={() => start(t.id)}>
            Questão {i + 1}: nova versão
          </button>
        ))}
      </div>
      {current && (
        <form
          className="fl-exercise"
          onSubmit={(e) => {
            e.preventDefault();
            const ok = checkAnswer(current, parseAnswer(answer));
            setResult(ok);
            progress.exercise(sim.id, ok);
          }}
        >
          <Markdown text={current.prompt} />
          <label>
            {current.label} =
            <input value={answer} inputMode="decimal" onChange={(e) => setAnswer(e.target.value)} aria-label={`Resposta: ${current.label}`} />
            {current.unit}
          </label>
          <div className="fl-row">
            <button type="submit" className="fl-primary">
              Corrigir
            </button>
            {current.hint && (
              <button type="button" onClick={() => setShowHint(true)}>
                Dica
              </button>
            )}
            <button type="button" onClick={() => onOpen(current.params)}>
              Abrir na simulação
            </button>
          </div>
          {showHint && current.hint && <p className="fl-hint">{current.hint}</p>}
          {result !== null && (
            <p className={result ? "fl-ok" : "fl-bad"}>
              {result
                ? `Correto! ${current.label} = ${formatBR(current.answer)} ${current.unit}.`
                : `Ainda não. Confira as unidades e tente de novo (tolerância de ${Math.round(current.tolerance * 100)}%).`}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
