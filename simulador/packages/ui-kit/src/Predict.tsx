import { useEffect, useState } from "react";
import type { Prediction } from "@fisilab/core";
import { Markdown } from "./Guide.tsx";

interface Props {
  questions: Prediction[];
  /** O aluno já rodou a simulação depois de prever? Libera a explicação. */
  observed: boolean;
  /** Todas as perguntas respondidas. `restored` = vieram de `saved` (não é uma previsão nova). */
  onPredicted(restored?: boolean): void;
  /** Cada escolha (ou troca) de opção, para registrar a previsão numa atividade. */
  onChoice?(index: number, chosen: number): void;
  /** A resposta foi revelada: as escolhas não mudam mais. */
  onReveal?(): void;
  /** Escolhas já registradas (por índice da pergunta); `locked` = resposta já revelada antes. */
  saved?: ({ chosen: number; locked?: boolean } | undefined)[];
}

/** Ciclo prever → observar → explicar: o aluno escolhe antes de rodar, a explicação aparece depois. */
export function Predict({ questions, observed, onPredicted, onChoice, onReveal, saved }: Props) {
  const [choices, setChoices] = useState<(number | null)[]>(() =>
    questions.map((q, i) => {
      const c = saved?.[i]?.chosen;
      return c !== undefined && c >= 0 && c < q.options.length ? c : null;
    }),
  );
  const [wasRevealed] = useState(() => questions.length > 0 && questions.every((_, i) => saved?.[i]?.locked));
  const allChosen = choices.every((c) => c !== null);
  const reveal = (observed || wasRevealed) && allChosen;

  useEffect(() => {
    if (allChosen) onPredicted(true);
    // Só ao montar: restaura o estado "já previu" de uma escolha salva.
  }, []);
  useEffect(() => {
    if (reveal && !wasRevealed) onReveal?.();
  }, [reveal]);

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
            const cls = reveal ? (oi === q.answer ? "correct" : chosen ? "wrong" : "") : chosen ? "chosen" : "";
            return (
              <label key={oi} className={`fl-option ${cls}`}>
                <input
                  type="radio"
                  name={`pred-${qi}`}
                  checked={chosen}
                  disabled={reveal}
                  onChange={() => {
                    const next = choices.slice();
                    next[qi] = oi;
                    setChoices(next);
                    onChoice?.(qi, oi);
                    if (next.every((c) => c !== null)) onPredicted();
                  }}
                />
                {opt}
              </label>
            );
          })}
          {reveal && (
            <div className="fl-explain">
              <strong>{choices[qi] === q.answer ? "Acertou." : "Não foi isso."}</strong> <Markdown text={q.explanation} />
            </div>
          )}
        </fieldset>
      ))}
      {allChosen && !reveal && <p className="fl-hint">Agora rode a simulação e observe.</p>}
      {!allChosen && <p className="fl-hint">Escolha uma resposta para cada pergunta.</p>}
    </div>
  );
}
