import { useRef, useState } from "react";
import type { Runner } from "@fisilab/core";
import { askTutor, buildContext, type TutorClientOptions, type TutorMessage } from "@fisilab/platform";
import { Markdown } from "./Guide.tsx";

export interface TutorProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  runner: Runner<any>;
  scenarioId?: string;
  exercise?: string;
  client?: TutorClientOptions;
}

const SUGESTOES = ["Por que isso acontece?", "O que devo observar aqui?", "Como começo o exercício?"];

/** Conversa com o tutor sobre o que está na tela. Sem servidor, usa o tutor offline. */
export function Tutor({ runner, scenarioId, exercise, client }: TutorProps) {
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<TutorMessage[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [offline, setOffline] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const ask = async (q: string) => {
    if (!q.trim() || busy) return;
    setBusy(true);
    setText("");
    const ctx = buildContext(runner.sim, runner.params, runner.observe(), runner.t, scenarioId, exercise);
    const next: TutorMessage[] = [...history, { role: "user", content: q }];
    setHistory(next);
    const r = await askTutor(ctx, history, q, client);
    setOffline(r.offline);
    setHistory([...next, { role: "assistant", content: r.answer }]);
    setBusy(false);
    setTimeout(() => endRef.current?.scrollIntoView({ block: "nearest" }), 0);
  };

  if (!open) {
    return (
      <button className="fl-tutor-open" onClick={() => setOpen(true)}>
        Perguntar ao tutor
      </button>
    );
  }
  return (
    <div className="fl-tutor" aria-live="polite">
      <header>
        <h3>Tutor</h3>
        <button onClick={() => setOpen(false)} aria-label="Fechar tutor">
          ×
        </button>
      </header>
      <div className="fl-tutor-log">
        {history.length === 0 && <p className="fl-muted">Pergunte sobre o que você está vendo. O tutor conhece os parâmetros e as leituras atuais, e ajuda sem entregar a resposta.</p>}
        {history.map((m, i) => (
          <div key={i} className={`fl-msg fl-msg-${m.role}`}>
            {m.role === "assistant" ? <Markdown text={m.content} /> : m.content}
          </div>
        ))}
        {busy && <div className="fl-msg fl-msg-assistant fl-muted">Pensando…</div>}
        <div ref={endRef} />
      </div>
      {history.length === 0 && (
        <div className="fl-row">
          {SUGESTOES.map((s) => (
            <button key={s} onClick={() => ask(s)}>
              {s}
            </button>
          ))}
        </div>
      )}
      <form
        className="fl-row"
        onSubmit={(e) => {
          e.preventDefault();
          void ask(text);
        }}
      >
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Sua pergunta" aria-label="Pergunta ao tutor" style={{ flex: 1 }} />
        <button type="submit" className="fl-primary" disabled={busy || !text.trim()}>
          Enviar
        </button>
      </form>
      {offline && history.length > 0 && <p className="fl-muted fl-small-text">Modo offline: respostas-guia montadas a partir do roteiro desta simulação.</p>}
    </div>
  );
}
