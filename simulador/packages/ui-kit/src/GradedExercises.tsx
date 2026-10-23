import { useState } from "react";
import { checkAnswer, generateExercise, parseAnswer, type AnySimulation, type ExerciseInstance } from "@fisilab/core";
import type { ExerciseAttempt } from "@fisilab/platform";
import { Markdown } from "./Guide.tsx";

export interface GradedExercisesProps {
  sim: AnySimulation;
  /** Exercício e semente de cada questão (sementes próprias de cada aluno). */
  items: { exercise: string; seed: number }[];
  attempts: ExerciseAttempt[];
  onAttempt(a: ExerciseAttempt): void;
  /** Mostra a resposta certa depois de errar (o professor decide). */
  revealAfter?: number;
}

/** Lista de questões de uma atividade avaliada: números próprios do aluno, tentativas registradas. */
export function GradedExercises({ sim, items, attempts, onAttempt, revealAfter = 3 }: GradedExercisesProps) {
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const instances: (ExerciseInstance | null)[] = items.map((it) => {
    const t = sim.exercises?.find((e) => e.id === it.exercise);
    return t ? generateExercise(sim, t, it.seed) : null;
  });

  return (
    <ol className="fl-graded">
      {instances.map((inst, i) => {
        if (!inst) return null;
        const it = items[i]!;
        const att = attempts.find((a) => a.exercise === it.exercise && a.seed === it.seed);
        const done = att?.correct;
        const reveal = !done && (att?.tries ?? 0) >= revealAfter;
        return (
          <li key={i} className="fl-exercise">
            <Markdown text={inst.prompt} />
            <form
              className="fl-row"
              onSubmit={(e) => {
                e.preventDefault();
                const v = parseAnswer(answers[i] ?? "");
                const ok = checkAnswer(inst, v);
                onAttempt({ exercise: it.exercise, seed: it.seed, answer: Number.isFinite(v) ? v : null, correct: ok || !!done, tries: (att?.tries ?? 0) + 1 });
              }}
            >
              <label>
                {inst.label} =
                <input
                  value={answers[i] ?? (att?.answer != null ? String(att.answer).replace(".", ",") : "")}
                  inputMode="decimal"
                  disabled={done}
                  onChange={(e) => setAnswers({ ...answers, [i]: e.target.value })}
                  aria-label={`Resposta da questão ${i + 1}`}
                />
                {inst.unit}
              </label>
              {!done && (
                <button type="submit" className="fl-primary">
                  Conferir
                </button>
              )}
            </form>
            {att && (
              <p className={done ? "fl-ok" : "fl-bad"}>
                {done ? "Correto." : `Incorreto (${att.tries} tentativa${att.tries > 1 ? "s" : ""}).`}
                {reveal && inst.hint ? ` Dica: ${inst.hint}` : ""}
              </p>
            )}
          </li>
        );
      })}
    </ol>
  );
}
