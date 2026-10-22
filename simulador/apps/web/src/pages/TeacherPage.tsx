import { useMemo, useState } from "react";
import { withOverrides } from "@fisilab/core";
import {
  checkSubmission, classCsv, csvField, decodeAssignment, difficultyMap, encodeAssignment, grade, moodleCsv,
  type Assignment, type DifficultyCell, type DifficultyMap, type Submission,
} from "@fisilab/platform";
import { backend, freshSession, useProfile } from "../account.ts";
import { catalog, findSim } from "../catalog.ts";
import { practices } from "../practices.ts";
import { ProfileForm } from "./ProfileForm.tsx";

function download(name: string, text: string, type: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// Colunas que podem encolher abaixo do conteúdo (selects com nomes longos não alargam a página no celular).
const narrow: React.CSSProperties = { gridTemplateColumns: "minmax(0, 1fr)" };
const fullWidth: React.CSSProperties = { width: "100%" };

/** Tópico e rótulos das questões de um envio, a partir da atividade codificada nele. */
function describeSubmission(s: Submission) {
  let a: Assignment | null = null;
  try {
    a = decodeAssignment(s.assignment);
  } catch {
    /* código ilegível */
  }
  const practice = a?.kind === "pratica" ? practices.find((p) => p.id === a!.target) : undefined;
  const sim = a ? findSim(a.kind === "sim" ? a.target : practice?.sim ?? "") : undefined;
  const topic = sim ? `${sim.course} · ${sim.topic}` : a?.title ?? "Atividade desconhecida";
  return {
    topic,
    label: (kind: string, key: string) => {
      if (kind !== "exercicio") return undefined;
      const ex = sim?.exercises?.find((e) => e.id === key);
      if (!ex) return undefined;
      const t = ex.prompt.replace(/\{\w+\}/g, "…").replace(/\$[^$]*\$/g, "…");
      return t.length > 70 ? `${t.slice(0, 68)}…` : t;
    },
  };
}

const pct = (c: DifficultyCell | undefined) => (c && c.rate !== null ? `${Math.round(c.rate * 100)}%` : "—");
const cellTitle = (c: DifficultyCell | undefined) =>
  c ? `${c.correct} de ${c.attempts} respondida${c.attempts === 1 ? "" : "s"} certa${c.correct === 1 ? "" : "s"}${c.blank ? `; ${c.blank} em branco` : ""}` : "sem dados";
/** Fundo do heatmap: vermelho para poucos acertos, verde para muitos; o número sempre aparece. */
const heat = (c: DifficultyCell | undefined): React.CSSProperties => {
  if (!c || c.rate === null) return {};
  const r = c.rate;
  const tone = r < 0.5 ? "var(--bad)" : "var(--ok)";
  const strength = Math.round(Math.abs(r - 0.5) * 2 * 45 + 8);
  return { background: `color-mix(in srgb, ${tone} ${strength}%, transparent)`, color: "var(--text)", textAlign: "center" };
};
const shortName = (n: string) => {
  const p = n.trim().split(/\s+/);
  return p.length > 1 ? `${p[0]} ${p[p.length - 1]![0]}.` : n;
};

function mapCsv(m: DifficultyMap): string {
  const head = ["Tópico", "Questão", "Tipo", "Acerto (%)", "Respondidas", "Certas", "Em branco", ...m.students.map((s) => `${s.name} (${s.id})`)];
  const kind = { exercicio: "exercício", previsao: "previsão", pratica: "prática" } as const;
  const lines = m.topics.flatMap((t) =>
    t.items.map((it) =>
      [t.topic, it.label, kind[it.kind], it.total.rate === null ? "" : Math.round(it.total.rate * 100), it.total.attempts, it.total.correct, it.total.blank, ...m.students.map((s) => pct(it.cells[s.id]).replace("—", "").replace("%", ""))]
        .map((v) => csvField(v))
        .join(";"),
    ),
  );
  return [head.map(csvField).join(";"), ...lines].join("\n") + "\n";
}

/** Mapa de dificuldades por tópico e por questão, com números em cada célula (acessível sem cor). */
function DifficultyPanel({ subs }: { subs: Submission[] }) {
  const m = useMemo(() => difficultyMap(subs, describeSubmission), [subs]);
  if (!m.topics.length) return <p className="fl-muted">Os envios ainda não têm exercícios, previsões nem resultados de prática para comparar.</p>;
  return (
    <>
      <div className="fl-table-wrap" style={{ minWidth: 0 }}>
        <table className="fl-table">
          <caption className="fl-muted" style={{ textAlign: "left", captionSide: "top" }}>
            Acerto por tópico, do mais difícil para o mais fácil
          </caption>
          <thead>
            <tr>
              <th scope="col">Tópico</th>
              <th scope="col">Acerto</th>
              <th scope="col">Respondidas</th>
              <th scope="col">Em branco</th>
            </tr>
          </thead>
          <tbody>
            {m.topics.map((t) => (
              <tr key={t.topic}>
                <th scope="row" style={{ textAlign: "left", fontWeight: 500 }}>
                  {t.topic}
                </th>
                <td style={heat(t.total)} title={cellTitle(t.total)}>
                  {pct(t.total)}
                </td>
                <td>{t.total.attempts}</td>
                <td>{t.total.blank}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <details style={{ minWidth: 0 }}>
        <summary>Por questão e por aluno ({m.students.length} aluno{m.students.length === 1 ? "" : "s"})</summary>
        <div className="fl-table-wrap" style={{ minWidth: 0 }}>
          <table className="fl-table">
            <thead>
              <tr>
                <th scope="col">Questão</th>
                <th scope="col">Turma</th>
                {m.students.map((s) => (
                  <th key={s.id} scope="col" title={`${s.name} (${s.id})`}>
                    {shortName(s.name)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {m.topics.flatMap((t) => [
                <tr key={`t-${t.topic}`}>
                  <th scope="rowgroup" colSpan={2 + m.students.length} style={{ textAlign: "left" }}>
                    {t.topic}
                  </th>
                </tr>,
                ...t.items.map((it) => (
                  <tr key={it.key}>
                    <th scope="row" style={{ textAlign: "left", fontWeight: 400, whiteSpace: "normal", minWidth: "12rem" }}>
                      {it.kind === "previsao" ? "Previsão: " : ""}
                      {it.label}
                    </th>
                    <td style={heat(it.total)} title={cellTitle(it.total)}>
                      {pct(it.total)}
                    </td>
                    {m.students.map((s) => (
                      <td key={s.id} style={heat(it.cells[s.id])} title={`${s.name}: ${cellTitle(it.cells[s.id])}`}>
                        {pct(it.cells[s.id])}
                      </td>
                    ))}
                  </tr>
                )),
              ])}
            </tbody>
          </table>
        </div>
      </details>
      <div className="fl-row">
        <button onClick={() => download("mapa-de-dificuldades.csv", mapCsv(m), "text/csv;charset=utf-8")}>Exportar mapa (CSV)</button>
        <span className="fl-muted">Cor: vermelho = poucos acertos, verde = muitos; passe o mouse para ver quantas respostas.</span>
      </div>
    </>
  );
}

/** Painel do professor: cria atividades (link ou Moodle) e recolhe os envios da turma. */
export function TeacherPage({ query }: { query: URLSearchParams }) {
  const profile = useProfile();
  const lti = query.get("lti");
  const [kind, setKind] = useState<Assignment["kind"]>("sim");
  const [target, setTarget] = useState(catalog[0]!.sim.id);
  const [scenario, setScenario] = useState("");
  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [due, setDue] = useState("");
  const [lockedVals, setLockedVals] = useState<Record<string, number>>({});
  const [exercises, setExercises] = useState<string[]>([]);
  const [perExercise, setPerExercise] = useState(1);
  const [link, setLink] = useState("");
  const [subs, setSubs] = useState<{ s: Submission; ok: boolean }[]>([]);
  const [msg, setMsg] = useState("");

  const simId = kind === "sim" ? target : practices.find((p) => p.id === target)?.sim ?? "";
  const sim = findSim(simId);
  const base = useMemo(() => (sim ? withOverrides(sim, sim.scenarios.find((s) => s.id === scenario)?.params ?? {}) : {}), [sim, scenario]);

  const assignment: Assignment = {
    v: 1,
    title: title || (kind === "sim" ? sim?.title ?? "" : practices.find((p) => p.id === target)?.title ?? ""),
    turma: lti ? undefined : profile?.name,
    kind,
    target,
    scenario: scenario || undefined,
    params: Object.keys(lockedVals).length ? lockedVals : undefined,
    locked: Object.keys(lockedVals).length ? Object.keys(lockedVals) : undefined,
    exercises: exercises.length ? exercises : undefined,
    perExercise,
    instructions: instructions || undefined,
    due: due || undefined,
  };

  if (!profile) return <ProfileForm askRole initial={{ name: "", matricula: "", role: "professor" }} />;

  const appUrl = `${location.origin}${location.pathname}`;
  const create = async () => {
    const code = encodeAssignment(assignment);
    let url = `${appUrl}#/atividade/${code}`;
    if (backend && (await freshSession())) {
      try {
        const [row] = await backend.insert<{ id: string }>("atividades", { autor: backend.session!.user.id, codigo: code, titulo: assignment.title, prazo: assignment.due ?? null });
        if (row) url += `?id=${row.id}`;
      } catch (e) {
        setMsg(`Atividade criada só como link (servidor recusou: ${(e as Error).message}).`);
      }
    }
    setLink(url);
  };

  const importFiles = async (files: FileList | null) => {
    if (!files) return;
    const out: { s: Submission; ok: boolean }[] = [];
    for (const f of Array.from(files)) {
      try {
        const s = JSON.parse(await f.text()) as Submission;
        out.push({ s, ok: await checkSubmission(s) });
      } catch {
        setMsg(`Arquivo ignorado: ${f.name}`);
      }
    }
    setSubs((prev) => [...prev, ...out]);
  };

  const loadFromServer = async () => {
    if (!backend || !(await freshSession())) return setMsg("Entre com seu e-mail para ver os envios guardados no servidor.");
    const id = new URL(link || location.href).hash.split("id=")[1];
    if (!id) return setMsg("Crie a atividade (ou abra o link dela) para carregar os envios.");
    const rows = await backend.select<{ conteudo: Submission }>("envios", `select=conteudo&atividade=eq.${id}`);
    setSubs(await Promise.all(rows.map(async (r) => ({ s: r.conteudo, ok: await checkSubmission(r.conteudo) }))));
  };

  const ltiItems = JSON.stringify([
    { title: assignment.title, text: assignment.instructions, custom: { atividade: encodeAssignment(assignment) }, lineItem: { scoreMaximum: 10, label: assignment.title } },
  ]);

  return (
    <div className="teacher" style={narrow}>
      <h1>Painel do professor</h1>
      {lti && <p className="note">Você veio do Moodle: monte a atividade e clique em <strong>Adicionar ao Moodle</strong>.</p>}
      <section className="panel" style={narrow}>
        <h2>Nova atividade</h2>
        <div className="form-grid">
          <label>
            Tipo
            <select
              style={fullWidth}
              value={kind}
              onChange={(e) => {
                const k = e.target.value as Assignment["kind"];
                setKind(k);
                setTarget(k === "sim" ? catalog[0]!.sim.id : practices[0]!.id);
                setScenario("");
                setLockedVals({});
                setExercises([]);
              }}
            >
              <option value="sim">Simulação com exercícios</option>
              <option value="pratica">Prática de laboratório</option>
            </select>
          </label>
          <label>
            {kind === "sim" ? "Simulação" : "Prática"}
            <select
              style={fullWidth}
              value={target}
              onChange={(e) => {
                setTarget(e.target.value);
                setScenario("");
                setLockedVals({});
                setExercises([]);
              }}
            >
              {kind === "sim"
                ? catalog.map(({ sim }) => (
                    <option key={sim.id} value={sim.id}>
                      {sim.course} · {sim.title}
                    </option>
                  ))
                : practices.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.course} · {p.title}
                    </option>
                  ))}
            </select>
          </label>
          {kind === "sim" && sim && sim.scenarios.length > 0 && (
            <label>
              Cenário inicial
              <select style={fullWidth} value={scenario} onChange={(e) => setScenario(e.target.value)}>
                <option value="">Primeiro cenário</option>
                {sim.scenarios.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            Título para os alunos
            <input value={title} placeholder={assignment.title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label>
            Prazo
            <input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} />
          </label>
        </div>
        <label className="block">
          Instruções (aceita markdown e $fórmulas$)
          <textarea rows={4} value={instructions} onChange={(e) => setInstructions(e.target.value)} />
        </label>

        {kind === "sim" && sim && (
          <details>
            <summary>Travar parâmetros ({Object.keys(lockedVals).length})</summary>
            <div className="form-grid">
              {sim.params.map((p) => (
                <label key={p.key} className="inline">
                  <input
                    type="checkbox"
                    checked={p.key in lockedVals}
                    onChange={(e) => {
                      const next = { ...lockedVals };
                      if (e.target.checked) next[p.key] = base[p.key] ?? p.default;
                      else delete next[p.key];
                      setLockedVals(next);
                    }}
                  />
                  {p.label}
                  {p.key in lockedVals && (
                    <input type="number" step={p.step} min={p.min} max={p.max} value={lockedVals[p.key]} onChange={(e) => setLockedVals({ ...lockedVals, [p.key]: Number(e.target.value) })} />
                  )}
                  {p.unit}
                </label>
              ))}
            </div>
          </details>
        )}

        {sim && (sim.exercises?.length ?? 0) > 0 && (
          <fieldset>
            <legend>Exercícios cobrados (cada aluno recebe números próprios)</legend>
            {sim.exercises!.map((ex) => (
              <label key={ex.id} className="inline">
                <input type="checkbox" checked={exercises.includes(ex.id)} onChange={(e) => setExercises(e.target.checked ? [...exercises, ex.id] : exercises.filter((x) => x !== ex.id))} />
                {ex.prompt.replace(/\{\w+\}/g, "…")}
              </label>
            ))}
            <label className="inline">
              Versões de cada exercício
              <input type="number" min={1} max={5} value={perExercise} onChange={(e) => setPerExercise(Math.max(1, Math.min(5, Number(e.target.value))))} />
            </label>
            <p className="fl-muted">Nenhum marcado = todos.</p>
          </fieldset>
        )}

        <div className="fl-row">
          <button className="fl-primary" onClick={create}>
            Gerar link da atividade
          </button>
          {lti && backend && (
            <form method="post" action={`${backend.fnUrl("lti")}/deeplink`}>
              <input type="hidden" name="lti" value={lti} />
              <input type="hidden" name="items" value={ltiItems} />
              <button type="submit" className="fl-primary">
                Adicionar ao Moodle
              </button>
            </form>
          )}
        </div>
        {link && (
          <p className="link-out">
            <input readOnly value={link} onFocus={(e) => e.target.select()} aria-label="Link da atividade" />
            <button onClick={() => navigator.clipboard?.writeText(link)}>Copiar</button>
            <a href={link.slice(link.indexOf("#"))}>Abrir como aluno</a>
          </p>
        )}
        {msg && <p className="fl-muted">{msg}</p>}
      </section>

      <section className="panel" style={narrow}>
        <h2>Envios da turma</h2>
        <p className="fl-muted">
          {backend ? "Carregue do servidor ou importe os arquivos .json que os alunos enviaram." : "Importe os arquivos .json que os alunos baixaram ao enviar a atividade."}
        </p>
        <div className="fl-row">
          <input type="file" accept="application/json,.json" multiple onChange={(e) => void importFiles(e.target.files)} aria-label="Importar envios" />
          {backend && <button onClick={() => void loadFromServer()}>Carregar do servidor</button>}
          {subs.length > 0 && (
            <>
              <button onClick={() => download("turma.csv", classCsv(assignment, subs.map((x) => x.s)), "text/csv;charset=utf-8")}>Exportar planilha (CSV)</button>
              <button onClick={() => download("notas-moodle.csv", moodleCsv(assignment, subs.map((x) => x.s)), "text/csv;charset=utf-8")}>Notas para o Moodle (CSV)</button>
            </>
          )}
        </div>
        {subs.length > 0 && (
          <div className="fl-table-wrap" style={{ minWidth: 0 }}>
            <table className="fl-table">
              <thead>
                <tr>
                  <th>Matrícula</th>
                  <th>Nome</th>
                  <th>Exercícios</th>
                  <th>Medidas</th>
                  <th>Nota</th>
                  <th>Integridade</th>
                </tr>
              </thead>
              <tbody>
                {subs.map(({ s, ok }, i) => (
                  <tr key={i}>
                    <td>{s.student.id}</td>
                    <td>{s.student.name}</td>
                    <td>
                      {s.exercises.filter((e) => e.correct).length}/{s.exercises.length}
                    </td>
                    <td>{s.practice?.rows ?? "—"}</td>
                    <td>{String(grade(assignment, s)).replace(".", ",")}</td>
                    <td className={ok ? "fl-ok" : "fl-bad"}>{ok ? "ok" : "arquivo alterado"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="fl-muted">A nota usa os pesos padrão da atividade montada acima: confira se é a mesma atividade dos envios.</p>
        {subs.length > 0 && (
          <p className="fl-muted">
            Para o Moodle: em <strong>Notas → Importar → Arquivo CSV</strong>, escolha o separador vírgula e mapeie <strong>Endereço de email</strong> ou{" "}
            <strong>Número de identificação</strong> (matrícula) para o campo de usuário, e a coluna da nota para o item de nota.
            {subs.some((x) => !x.s.student.email) && " Alguns envios não têm e-mail: use o número de identificação."}
          </p>
        )}
      </section>

      {subs.length > 0 && (
        <section className="panel" style={narrow}>
          <h2>Mapa de dificuldades</h2>
          <DifficultyPanel subs={subs.map((x) => x.s)} />
        </section>
      )}
    </div>
  );
}
