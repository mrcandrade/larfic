import { useMemo, useState } from "react";
import { withOverrides } from "@fisilab/core";
import { checkSubmission, classCsv, encodeAssignment, grade, type Assignment, type Submission } from "@fisilab/platform";
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
    <div className="teacher">
      <h1>Painel do professor</h1>
      {lti && <p className="note">Você veio do Moodle: monte a atividade e clique em <strong>Adicionar ao Moodle</strong>.</p>}
      <section className="panel">
        <h2>Nova atividade</h2>
        <div className="form-grid">
          <label>
            Tipo
            <select
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
              <select value={scenario} onChange={(e) => setScenario(e.target.value)}>
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

      <section className="panel">
        <h2>Envios da turma</h2>
        <p className="fl-muted">
          {backend ? "Carregue do servidor ou importe os arquivos .json que os alunos enviaram." : "Importe os arquivos .json que os alunos baixaram ao enviar a atividade."}
        </p>
        <div className="fl-row">
          <input type="file" accept="application/json,.json" multiple onChange={(e) => void importFiles(e.target.files)} aria-label="Importar envios" />
          {backend && <button onClick={() => void loadFromServer()}>Carregar do servidor</button>}
          {subs.length > 0 && (
            <button onClick={() => download("turma.csv", classCsv(assignment, subs.map((x) => x.s)), "text/csv;charset=utf-8")}>Exportar planilha (CSV)</button>
          )}
        </div>
        {subs.length > 0 && (
          <div className="fl-table-wrap">
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
      </section>
    </div>
  );
}
