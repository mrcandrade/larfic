import { useState } from "react";
import { InlineText } from "@fisilab/ui-kit";
import { checkKey, loadChecks, saveCheck, type QuickCheck } from "../livro/testes.ts";

/** Teste rápido ao fim de uma seção: escolha uma alternativa e veja na hora se acertou e por quê. */
export function QuickChecks({ sectionId, checks, onAnswer }: { sectionId: string; checks: QuickCheck[]; onAnswer?(): void }) {
  if (checks.length === 0) return null;
  return (
    <div className="quick-checks">
      <h3>{checks.length === 1 ? "Teste rápido" : `Teste rápido (${checks.length} perguntas)`}</h3>
      {checks.map((c, i) => (
        <CheckItem key={i} id={checkKey(sectionId, i)} check={c} onAnswer={onAnswer} />
      ))}
    </div>
  );
}

function CheckItem({ id, check, onAnswer }: { id: string; check: QuickCheck; onAnswer?(): void }) {
  const [picked, setPicked] = useState<number | null>(null);
  const [before] = useState(() => loadChecks()[id] === true);
  const done = picked !== null;
  const right = picked === check.answer;
  const pick = (i: number) => {
    if (done) return;
    setPicked(i);
    saveCheck(id, i === check.answer);
    onAnswer?.();
  };
  return (
    <fieldset className="quick-check">
      <legend>
        <InlineText text={check.q} />
        {before && !done && <span className="quick-check-before"> · você já acertou esta</span>}
      </legend>
      <ol className="quick-check-options" type="a">
        {check.options.map((o, i) => {
          const cls = !done ? "" : i === check.answer ? "is-right" : i === picked ? "is-wrong" : "is-dim";
          return (
            <li key={i}>
              <button type="button" className={cls} onClick={() => pick(i)} disabled={done && i !== picked && i !== check.answer} aria-pressed={picked === i}>
                <InlineText text={o} />
              </button>
            </li>
          );
        })}
      </ol>
      {done && (
        <p className={`quick-check-why ${right ? "is-right" : "is-wrong"}`} role="status">
          <strong>{right ? "Certo." : "Não é essa."}</strong> <InlineText text={check.why} />{" "}
          {!right && (
            <button type="button" className="linklike" onClick={() => setPicked(null)}>
              Tentar de novo
            </button>
          )}
        </p>
      )}
    </fieldset>
  );
}
