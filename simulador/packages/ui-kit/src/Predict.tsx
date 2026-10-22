import { useState } from "react";
import type { Prediction } from "@fisilab/core";
import { Markdown } from "./Guide.tsx";

interface Props {
  questions: Prediction[];
  /** O aluno já rodou a simulação depois de prever? Libera a explicação. */
  observed: boolean;
  onPredicted(): void;
}

/** Ciclo prever → observar → explicar: o aluno escolhe antes de rodar, a explicação aparece depois. */
export function Predict({ questions, observed, onPredicted }: Props) {
  const [choices, setChoices] = useState<(number | null)[]>(() => questions.map(() => null));
  const allChosen = choices.every((c) => c !== null);

  return (
    <div className="fl-predict">
      <h3>Antes de rodar, preveja</h3>
      {questions.map((q, qi) => (
        <fieldset key={qi}>
          <legend>
            <Markdown text={q.question} />
          </legend>
          {q.options.map((opt, oi) => {
            const chosen = choices[qi] === oi;
            const reveal = observed && allChosen;
            const cls = reveal ? (oi === q.answer ? "correct" : chosen ? "wrong" : "") : chosen ? "chosen" : "";
            return (
              <label key={oi} className={`fl-option ${cls}`}>
                <input
                  type="radio"
                  name={`pred-${qi}`}
                  checked={chosen}
                  disabled={observed && allChosen}
                  onChange={() => {
                    const next = choices.slice();
                    next[qi] = oi;
                    setChoices(next);
                    if (next.every((c) => c !== null)) onPredicted();
                  }}
                />
                {opt}
              </label>
            );
          })}
          {observed && allChosen && (
            <div className="fl-explain">
              <strong>{choices[qi] === q.answer ? "Acertou." : "Não foi isso."}</strong> <Markdown text={q.explanation} />
            </div>
          )}
        </fieldset>
      ))}
      {allChosen && !observed && <p className="fl-hint">Agora rode a simulação e observe.</p>}
      {!allChosen && <p className="fl-hint">Escolha uma resposta para cada pergunta.</p>}
    </div>
  );
}
