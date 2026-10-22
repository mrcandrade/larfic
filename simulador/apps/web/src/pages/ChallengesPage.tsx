import { useEffect, useMemo, useRef, useState } from "react";
import { formatBR, type Runner } from "@fisilab/core";
import { Markdown, SimView } from "@fisilab/ui-kit";
import { fetchClassScores, joinClassByCode, rankClass, submitChallengeScore, type ClassInfo, type ClassRankRow } from "@fisilab/platform";
import { backend, freshSession, loadProfile } from "../account.ts";
import { findSim } from "../catalog.ts";
import {
  LEVELS,
  PAR_TIME,
  challenges,
  evaluateChallenge,
  findChallenge,
  loadBook,
  localRanking,
  lockedKeys,
  nextAttempt,
  points,
  profileTotals,
  recordAttempt,
  removeProfile,
  saveBook,
  stars,
  switchProfile,
  type Book,
  type Challenge,
  type Level,
  type Metric,
  type Outcome,
} from "../challenges.ts";
import "./lab.css";
import "./challenges.css";

const CLASS_KEY = "fisilab.desafios.turma.v1";

function loadClass(): ClassInfo | null {
  try {
    return JSON.parse(localStorage.getItem(CLASS_KEY) ?? "null") as ClassInfo | null;
  } catch {
    return null;
  }
}

function saveClass(c: ClassInfo | null) {
  try {
    if (c) localStorage.setItem(CLASS_KEY, JSON.stringify(c));
    else localStorage.removeItem(CLASS_KEY);
  } catch {
    /* ignora */
  }
}

/** Histórico compartilhado entre a lista e a tela do desafio. */
function useBook(): [Book, (f: (b: Book) => Book) => void] {
  const [book, setBook] = useState<Book>(() => loadBook(undefined, loadProfile()?.name || "Eu"));
  const update = (f: (b: Book) => Book) =>
    setBook((b) => {
      const n = f(b);
      saveBook(n);
      return n;
    });
  return [book, update];
}

export function ChallengesPage({ id }: { id?: string }) {
  const [book, update] = useBook();
  const ch = id ? findChallenge(id) : undefined;
  useEffect(() => {
    document.title = ch ? `${ch.title} · Desafios · FisiLab` : "Desafios · FisiLab";
  }, [ch]);
  if (id && !ch)
    return (
      <div className="notfound">
        <h1>Desafio não encontrado</h1>
        <p>
          <a href="#/desafios">Ver todos os desafios</a>
        </p>
      </div>
    );
  if (ch) return <ChallengeScreen key={ch.id} ch={ch} book={book} update={update} />;
  return <ChallengeList book={book} update={update} />;
}

// ------------------------------------------------------------------ lista, perfis e rankings

function StarRow({ n, label }: { n: number; label?: string }) {
  return (
    <span className="ch-stars" role="img" aria-label={label ?? `${n} de 3 estrelas`}>
      {[1, 2, 3].map((i) => (
        <span key={i} aria-hidden className={i <= n ? "on" : ""}>
          ★
        </span>
      ))}
    </span>
  );
}

function ChallengeList({ book, update }: { book: Book; update(f: (b: Book) => Book): void }) {
  const mine = book.profiles[book.current] ?? {};
  const totals = profileTotals(mine);
  return (
    <div className="lab-page ch-page">
      <header className="lab-head">
        <h1>Desafios</h1>
        <p>
          Metas com física de verdade: ajuste parâmetros ou monte algo na simulação e peça a avaliação. O resultado é
          calculado rodando a simulação do zero, com os valores que você escolheu. Precisão, economia, número de tentativas e
          tempo contam pontos.
        </p>
      </header>

      <ProfileBar book={book} update={update} totals={totals} />

      {([1, 2, 3] as Level[]).map((level) => (
        <section key={level} className="ch-level" aria-labelledby={`nivel-${level}`}>
          <h2 id={`nivel-${level}`}>
            {LEVELS[level]} <span className="lab-muted lab-small">· pontos ×{level === 1 ? "1" : level === 2 ? "1,5" : "2"}</span>
          </h2>
          <ul className="ch-cards">
            {challenges
              .filter((c) => c.level === level)
              .map((c) => {
                const rec = mine[c.id];
                return (
                  <li key={c.id}>
                    <a className="ch-card" href={`#/desafios/${c.id}`}>
                      <span className="ch-card-sim">{findSim(c.sim)?.title ?? c.sim}</span>
                      <strong>{c.title}</strong>
                      <span className="ch-card-foot">
                        <StarRow n={rec?.stars ?? 0} />
                        <span className="lab-small lab-muted">{rec ? `${rec.best} pts · ${rec.attempts} tentativa(s)` : c.build ? "Monte no palco" : "Ajuste parâmetros"}</span>
                      </span>
                    </a>
                  </li>
                );
              })}
          </ul>
        </section>
      ))}

      <div className="ch-ranks">
        <LocalRanking book={book} />
        <ClassRanking />
      </div>
    </div>
  );
}

function ProfileBar({ book, update, totals }: { book: Book; update(f: (b: Book) => Book): void; totals: ReturnType<typeof profileTotals> }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const names = Object.keys(book.profiles);
  return (
    <section className="lab-panel ch-profile" aria-label="Perfil">
      <div className="lab-row">
        <label>
          Jogando como
          <select value={book.current} onChange={(e) => update((b) => switchProfile(b, e.target.value))}>
            {names.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        {!adding && <button onClick={() => setAdding(true)}>Novo perfil</button>}
        {names.length > 1 && !adding && (
          <button
            onClick={() => {
              if (confirm(`Apagar o perfil "${book.current}" e o histórico dele neste aparelho?`)) update((b) => removeProfile(b, b.current));
            }}
          >
            Apagar perfil
          </button>
        )}
        {adding && (
          <form
            className="lab-row"
            onSubmit={(e) => {
              e.preventDefault();
              if (!name.trim()) return;
              update((b) => switchProfile(b, name));
              setName("");
              setAdding(false);
            }}
          >
            <input aria-label="Nome do novo perfil" placeholder="Nome" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            <button className="fl-primary" type="submit">
              Criar
            </button>
            <button type="button" onClick={() => setAdding(false)}>
              Cancelar
            </button>
          </form>
        )}
      </div>
      <p className="ch-totals">
        <strong>{totals.points}</strong> pontos · <strong>{totals.stars}</strong> de {challenges.length * 3} estrelas · {totals.done} de {challenges.length} desafios
        concluídos
      </p>
    </section>
  );
}

function LocalRanking({ book }: { book: Book }) {
  const rows = localRanking(book);
  return (
    <section className="lab-panel" aria-labelledby="rank-local">
      <h2 id="rank-local">Ranking neste aparelho</h2>
      <RankTable rows={rows.map((r) => ({ key: r.name, name: r.name, points: r.points, stars: r.stars, done: r.done, me: r.name === book.current }))} />
    </section>
  );
}

function RankTable({ rows }: { rows: { key: string; name: string; points: number; stars: number; done: number; me?: boolean }[] }) {
  if (!rows.length) return <p className="lab-muted">Ninguém pontuou ainda.</p>;
  return (
    <div className="lab-table-wrap">
      <table className="lab-table ch-rank">
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col">Nome</th>
            <th scope="col">Pontos</th>
            <th scope="col">Estrelas</th>
            <th scope="col">Concluídos</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.key} className={r.me ? "ch-me" : undefined}>
              <td>{i + 1}</td>
              <td>{r.name}</td>
              <td>{r.points}</td>
              <td>{r.stars}</td>
              <td>{r.done}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ClassRanking() {
  const [turma, setTurma] = useState<ClassInfo | null>(loadClass);
  const [code, setCode] = useState("");
  const [rows, setRows] = useState<ClassRankRow[] | null>(null);
  const [msg, setMsg] = useState("");
  const ids = useMemo(() => new Set(challenges.map((c) => c.id)), []);
  const me = backend?.session?.user.id;

  const load = async (t: ClassInfo) => {
    setMsg("Carregando…");
    try {
      if (!backend || !(await freshSession())) return setMsg("Entre com seu e-mail (em uma atividade ou no painel do professor) para ver o ranking da turma.");
      setRows(rankClass(await fetchClassScores(backend, t.id), ids));
      setMsg("");
    } catch (e) {
      setMsg(`Não foi possível carregar o ranking: ${(e as Error).message}`);
    }
  };

  useEffect(() => {
    if (turma) void load(turma);
  }, [turma?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!backend)
    return (
      <section className="lab-panel" aria-labelledby="rank-turma">
        <h2 id="rank-turma">Ranking da turma</h2>
        <p className="lab-muted">O ranking da turma precisa do servidor da instituição, que não está configurado aqui; por isso só aparece o ranking deste aparelho.</p>
      </section>
    );

  return (
    <section className="lab-panel" aria-labelledby="rank-turma">
      <h2 id="rank-turma">Ranking da turma{turma ? `: ${turma.nome}` : ""}</h2>
      {!turma ? (
        <form
          className="lab-row"
          onSubmit={async (e) => {
            e.preventDefault();
            setMsg("Entrando…");
            try {
              if (!backend || !(await freshSession())) return setMsg("Entre com seu e-mail (em uma atividade ou no painel do professor) antes de usar o código da turma.");
              const t = await joinClassByCode(backend, code);
              saveClass(t);
              setTurma(t);
              setMsg("");
            } catch (err) {
              setMsg((err as Error).message);
            }
          }}
        >
          <label>
            Código da turma
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="ex.: a1b2c3" maxLength={12} autoComplete="off" />
          </label>
          <button className="fl-primary" type="submit" disabled={!code.trim()}>
            Entrar
          </button>
        </form>
      ) : (
        <>
          <div className="lab-row">
            <button onClick={() => void load(turma)}>Atualizar</button>
            <button
              onClick={() => {
                saveClass(null);
                setTurma(null);
                setRows(null);
              }}
            >
              Trocar de turma
            </button>
          </div>
          {rows && <RankTable rows={rows.map((r) => ({ key: r.aluno, name: r.nome || "(sem nome)", points: r.pontos, stars: r.estrelas, done: r.desafios, me: r.aluno === me }))} />}
          <p className="lab-small lab-muted">Suas melhores pontuações são enviadas para a turma a cada avaliação.</p>
        </>
      )}
      <p className="lab-status" role="status">
        {msg}
      </p>
    </section>
  );
}

// ------------------------------------------------------------------ tela do desafio

function ChallengeScreen({ ch, book, update }: { ch: Challenge; book: Book; update(f: (b: Book) => Book): void }) {
  const sim = findSim(ch.sim)!;
  const locked = useMemo(() => lockedKeys(ch), [ch]);
  const initial = useMemo(() => ({ ...ch.base, ...Object.fromEntries(ch.knobs.map((k) => [k, defaultKnob(ch, k)])) }), [ch]);
  const idx = challenges.indexOf(ch);
  const next = challenges[idx + 1];
  const knobLabels = ch.knobs.map((k) => sim.params.find((p) => p.key === k)?.label ?? k);
  return (
    <div className="ch-screen">
      <nav className="crumbs">
        <a href="#/desafios">Desafios</a> <span aria-hidden>›</span> {LEVELS[ch.level]} <span aria-hidden>›</span> {ch.title}
      </nav>
      <section className="lab-panel ch-brief">
        <div className="ch-brief-head">
          <h1>{ch.title}</h1>
          <span className="badge">{LEVELS[ch.level]}</span>
        </div>
        <Markdown text={ch.goal} />
        <p className="lab-small lab-muted">
          {knobLabels.length ? `Você ajusta: ${knobLabels.join(", ")}.` : ""} {ch.build ? `No palco: ${ch.build.what}.` : ""} Os demais controles ficam travados.
          3 estrelas: precisão de pelo menos 90%{ch.economyLabel ? ` e ${ch.economyLabel.toLowerCase()} de pelo menos 90%` : ""}.
        </p>
        <details>
          <summary>Dica</summary>
          <Markdown text={ch.hint} />
        </details>
        <button className="ch-jump" onClick={() => document.getElementById("ch-panel-title")?.scrollIntoView({ behavior: "smooth", block: "start" })}>
          Ir para a avaliação
        </button>
      </section>
      <SimView
        sim={sim}
        initialScenario={ch.scenario}
        initialParams={initial}
        locked={locked}
        sidebar={({ runner }) => <ChallengePanel ch={ch} runner={runner} book={book} update={update} />}
      />
      <nav className="ch-next lab-row">
        <a href="#/desafios">Todos os desafios</a>
        {next && <a href={`#/desafios/${next.id}`}>Próximo: {next.title} ›</a>}
      </nav>
    </div>
  );
}

/** Valor inicial de um knob: o padrão da sim ajustado pelo cenário, nunca a resposta. */
function defaultKnob(ch: Challenge, k: string): number {
  const sim = findSim(ch.sim)!;
  const sc = sim.scenarios.find((s) => s.id === ch.scenario);
  return ch.base[k] ?? sc?.params[k] ?? sim.params.find((p) => p.key === k)?.default ?? 0;
}

interface Result {
  outcome: Outcome;
  stars: number;
  points: number;
  attempt: number;
  seconds: number;
  sent?: string;
}

function fmtMetric(m: Metric): string {
  const v = Number.isFinite(m.value) ? formatBR(m.value, m.digits ?? 4) : m.value > 0 ? "∞" : "—";
  return m.unit ? `${v} ${m.unit}` : v;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChallengePanel({ ch, runner, book, update }: { ch: Challenge; runner: Runner<any>; book: Book; update(f: (b: Book) => Book): void }) {
  const started = useRef(Date.now());
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const rec = book.profiles[book.current]?.[ch.id];
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const elapsed = Math.max(0, Math.round((now - started.current) / 1000));
  const par = PAR_TIME[ch.level];

  const evaluate = () => {
    setBusy(true);
    const values = Object.fromEntries(ch.knobs.map((k) => [k, runner.params[k]!]));
    const build = ch.build?.capture(runner.state, runner.params);
    const seconds = (Date.now() - started.current) / 1000;
    const attempt = nextAttempt(book, ch.id);
    // deixa a interface mostrar "Avaliando…" antes da conta
    setTimeout(() => {
      const outcome = evaluateChallenge(ch, { params: values, build });
      const st = stars(outcome);
      const pts = points(ch.level, outcome, attempt, seconds);
      const res: Result = { outcome, stars: st, points: pts, attempt, seconds };
      setResult(res);
      setBusy(false);
      update((b) => recordAttempt(b, ch.id, { points: pts, stars: st, seconds }));
      void sendToClass(ch, res, book.current).then((sent) => sent && setResult((r) => (r === res ? { ...r, sent } : r)));
    }, 30);
  };

  return (
    <section className="lab-panel ch-panel" aria-labelledby="ch-panel-title">
      <h2 id="ch-panel-title">Sua tentativa</h2>
      <p className="lab-small lab-muted">
        Tentativa {nextAttempt(book, ch.id)} · {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")} {elapsed > par ? "(passou do tempo de referência)" : ""}
      </p>
      <button className="fl-primary" onClick={evaluate} disabled={busy}>
        {busy ? "Avaliando…" : "Avaliar tentativa"}
      </button>
      <div role="status" aria-live="polite" className="ch-result">
        {result && (
          <>
            <p className={result.outcome.ok ? "lab-ok" : "lab-bad"}>
              <strong>{result.outcome.ok ? "Objetivo cumprido." : "Ainda não."}</strong> {result.outcome.message}
            </p>
            {result.outcome.ok && (
              <p className="ch-score">
                <StarRow n={result.stars} /> <strong>{result.points}</strong> pontos
              </p>
            )}
            {result.outcome.metrics.length > 0 && (
              <dl className="ch-metrics">
                {result.outcome.metrics.map((m) => (
                  <div key={m.label}>
                    <dt>{m.label}</dt>
                    <dd>{fmtMetric(m)}</dd>
                  </div>
                ))}
                {result.outcome.ok && (
                  <>
                    <div>
                      <dt>Precisão</dt>
                      <dd>{Math.round(100 * result.outcome.accuracy)}%</dd>
                    </div>
                    {ch.economyLabel && (
                      <div>
                        <dt>{ch.economyLabel}</dt>
                        <dd>{Math.round(100 * result.outcome.economy)}%</dd>
                      </div>
                    )}
                  </>
                )}
              </dl>
            )}
            {result.sent && <p className="lab-small lab-muted">{result.sent}</p>}
          </>
        )}
      </div>
      {rec && (
        <p className="lab-small">
          Seu melhor: <StarRow n={rec.stars} /> {rec.best} pontos em {rec.attempts} tentativa(s).
        </p>
      )}
    </section>
  );
}

async function sendToClass(ch: Challenge, r: Result, name: string): Promise<string | undefined> {
  const turma = loadClass();
  if (!backend || !turma || !r.outcome.ok) return undefined;
  try {
    if (!(await freshSession())) return undefined;
    await submitChallengeScore(backend, { turma: turma.id, nome: loadProfile()?.name || name, desafio: ch.id, pontos: r.points, estrelas: r.stars, tentativas: r.attempt, tempo_s: r.seconds });
    return `Enviado para o ranking da turma ${turma.nome}.`;
  } catch (e) {
    return `Não foi possível enviar para a turma: ${(e as Error).message}`;
  }
}
