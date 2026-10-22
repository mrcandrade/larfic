import { useEffect, useMemo, useState } from "react";
import { analyze, draftReport, mergeSections, reportKey, reportToMarkdown, type Row, type SavedReport } from "@fisilab/analysis";
import { decodeAssignment, grade, sealSubmission, studentSeed, type Assignment, type ExerciseAttempt, type Submission } from "@fisilab/platform";
import { Bench, GradedExercises, Markdown, SimView, Tutor, useTheme } from "@fisilab/ui-kit";
import { backend, freshSession, tutorClient, useProfile } from "../account.ts";
import { findSim } from "../catalog.ts";
import { findPractice } from "../practices.ts";
import { ProfileForm } from "./ProfileForm.tsx";

interface Local {
  startedAt: string;
  attempts: ExerciseAttempt[];
  submittedAt?: string;
}

const lkey = (code: string, mat: string) => `fisilab.atividade.${mat}.${code.slice(0, 40)}`;

function download(name: string, text: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** Atividade do aluno: simulação travada, exercícios com números próprios, prática e envio. */
export function AssignmentPage({ code, query }: { code: string; query: URLSearchParams }) {
  const profile = useProfile();
  const theme = useTheme();
  const a = useMemo<Assignment | null>(() => {
    try {
      return decodeAssignment(code);
    } catch {
      return null;
    }
  }, [code]);
  const practice = a?.kind === "pratica" ? findPractice(a.target) : undefined;
  const sim = a ? findSim(a.kind === "sim" ? a.target : practice?.sim ?? "") : undefined;
  const [local, setLocal] = useState<Local | null>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!profile) return;
    try {
      setLocal((JSON.parse(localStorage.getItem(lkey(code, profile.matricula)) ?? "null") as Local | null) ?? { startedAt: new Date().toISOString(), attempts: [] });
    } catch {
      setLocal({ startedAt: new Date().toISOString(), attempts: [] });
    }
  }, [code, profile]);
  useEffect(() => {
    if (profile && local) {
      try {
        localStorage.setItem(lkey(code, profile.matricula), JSON.stringify(local));
      } catch {
        /* ignora */
      }
    }
  }, [code, profile, local]);

  if (!a || !sim) {
    return (
      <div className="notfound">
        <h1>Atividade inválida</h1>
        <p>O link pode estar incompleto. Peça ao professor para enviar de novo.</p>
      </div>
    );
  }
  if (!profile) {
    return (
      <div className="assignment">
        <h1>{a.title}</h1>
        <ProfileForm />
      </div>
    );
  }
  if (!local) return null;

  const exIds = a.exercises?.length ? a.exercises : (sim.exercises ?? []).map((e) => e.id);
  const items = exIds.flatMap((ex) => Array.from({ length: a.perExercise ?? 1 }, (_, k) => ({ exercise: ex, seed: studentSeed(profile.matricula, code, ex, k) })));
  const late = a.due ? Date.now() > Date.parse(a.due) : false;

  // Relatório do gerador da bancada (seções editadas pelo aluno sobre o rascunho automático).
  const practiceReport = (rows: Row[], answers: string[], res: ReturnType<typeof analyze>) => {
    if (!practice) return "";
    let rep: Partial<SavedReport> = {};
    try {
      rep = (JSON.parse(localStorage.getItem(reportKey(practice.id)) ?? "null") as SavedReport | null) ?? {};
    } catch {
      /* sem relatório salvo */
    }
    const data = { practice, rows, res, answers };
    const sections = mergeSections(draftReport(data, { summary: sim.summary, equations: sim.equations }), rep.sections);
    return reportToMarkdown({ title: practice.title, authors: rep.meta?.authors || `${profile.name} (${profile.matricula})`, course: rep.meta?.course || undefined, date: new Date().toLocaleDateString("pt-BR") }, sections, data);
  };

  const submit = async () => {
    let practicePart: Submission["practice"];
    if (practice) {
      let saved: { rows: Row[]; answers: string[] } = { rows: [], answers: [] };
      try {
        saved = JSON.parse(localStorage.getItem(`fisilab.pratica.${practice.id}.v1`) ?? "null") ?? saved;
      } catch {
        /* sem dados */
      }
      const res = analyze(practice, saved.rows);
      practicePart = {
        rows: saved.rows.length,
        results: res?.results.map((r) => ({ label: r.label, value: r.value, u: r.u, compatible: r.compatible })) ?? [],
        report: practiceReport(saved.rows, saved.answers, res),
      };
    }
    const sub = await sealSubmission({
      v: 1,
      assignment: code,
      student: { id: profile.matricula, name: profile.name, email: profile.email ?? backend?.session?.user.email },
      startedAt: local.startedAt,
      submittedAt: new Date().toISOString(),
      exercises: items.map((it) => local.attempts.find((x) => x.exercise === it.exercise && x.seed === it.seed) ?? { ...it, answer: null, correct: false, tries: 0 }),
      predictions: [],
      practice: practicePart,
    });
    const nota = grade(a, sub);
    const id = query.get("id");
    let sentToServer = false;
    if (backend && (await freshSession()) && id) {
      try {
        await backend.upsert("envios", { atividade: id, aluno: backend.session!.user.id, conteudo: sub, nota }, "atividade,aluno");
        sentToServer = true;
      } catch (e) {
        setMsg(`O servidor recusou o envio (${(e as Error).message}); baixe o arquivo e mande ao professor.`);
      }
      const li = query.get("lti_li");
      if (li) {
        await fetch(`${backend.fnUrl("lti")}/score`, {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${backend.session!.accessToken}` },
          body: JSON.stringify({ iss: query.get("lti_iss"), sub: query.get("lti_sub"), lineitem: li, nota }),
        }).catch(() => undefined);
      }
    }
    if (!sentToServer) download(`${profile.matricula}-${a.title.replace(/[^\p{L}\p{N}]+/gu, "-").toLowerCase()}.json`, JSON.stringify(sub, null, 2));
    setLocal({ ...local, submittedAt: sub.submittedAt });
    setMsg((m) => m || (sentToServer ? `Enviado. Nota calculada: ${String(nota).replace(".", ",")}.` : `Arquivo baixado: envie-o ao professor (Moodle ou e-mail). Nota calculada: ${String(nota).replace(".", ",")}.`));
  };

  return (
    <div className="assignment">
      <header className="assignment-head">
        <h1>{a.title}</h1>
        <p className="fl-muted">
          {profile.name} · {profile.matricula}
          {a.due && ` · prazo ${new Date(a.due).toLocaleString("pt-BR")}`}
          {late && <strong className="fl-bad"> (prazo encerrado)</strong>}
        </p>
        {a.instructions && <Markdown text={a.instructions} />}
      </header>
      <SimView
        key={code}
        sim={sim}
        initialScenario={a.scenario ?? practice?.scenario}
        initialParams={{ ...practice?.params, ...a.params }}
        locked={[...(practice?.locked ?? []), ...(a.locked ?? [])]}
        sidebar={({ runner, scenarioId }) => (
          <>
            {practice && <Bench practice={practice} runner={runner} theme={theme} studentId={profile.matricula} tutor={tutorClient()} />}
            <Tutor runner={runner} scenarioId={scenarioId} client={tutorClient()} />
          </>
        )}
      />
      {items.length > 0 && (
        <section className="panel">
          <h2>Questões da atividade</h2>
          <GradedExercises
            sim={sim}
            items={items}
            attempts={local.attempts}
            onAttempt={(att) => setLocal({ ...local, attempts: [...local.attempts.filter((x) => !(x.exercise === att.exercise && x.seed === att.seed)), att] })}
          />
        </section>
      )}
      <section className="panel">
        <button className="fl-primary" onClick={() => void submit()}>
          {local.submittedAt ? "Enviar de novo" : "Enviar atividade"}
        </button>
        {local.submittedAt && <span className="fl-muted"> Último envio: {new Date(local.submittedAt).toLocaleString("pt-BR")}</span>}
        {msg && <p>{msg}</p>}
      </section>
    </div>
  );
}
