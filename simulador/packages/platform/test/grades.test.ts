import { describe, expect, it } from "vitest";
import {
  askReportReview, classCsv, csvField, encodeAssignment, difficultyMap, grade, latestSubmissions, lockPredictions, moodleCsv, recordPrediction, reportReviewSystem,
  assignmentOf, legacyWeights, submissionFeedback, submissionPredictions, suggestedWeights, weightShares, type Assignment, type Submission, type SubmissionPrediction,
} from "../src/index.ts";

const a: Assignment = { v: 1, title: "Pêndulo, lista 1", kind: "sim", target: "pendulos", perExercise: 1 };

function sub(id: string, name: string, at: string, correct: boolean[], extra: Partial<Submission> = {}): Submission {
  return {
    v: 1,
    assignment: "codigo-a",
    student: { id, name },
    startedAt: at,
    submittedAt: at,
    exercises: correct.map((c, i) => ({ exercise: `ex${i + 1}`, seed: i + 1, answer: 1, correct: c, tries: 1 })),
    predictions: [],
    ...extra,
  };
}

describe("exportação de notas para o Moodle", () => {
  it("CSV com vírgula, e-mail e número de identificação, nota com ponto e um envio por aluno", () => {
    const subs = [
      sub("20231", "Bruno Lima", "2026-10-01T10:00:00Z", [true, false]),
      sub("20231", "Bruno Lima", "2026-10-02T10:00:00Z", [true, true]),
      { ...sub("20232", 'Ana "Aninha" Souza', "2026-10-01T09:00:00Z", [false, false]), student: { id: "20232", name: 'Ana "Aninha" Souza', email: "ana@ufrgs.br" } },
    ];
    const csv = moodleCsv(a, subs);
    const lines = csv.trimEnd().split("\n");
    expect(lines[0]).toBe('Endereço de email,Número de identificação,Nome completo,"Pêndulo, lista 1",Comentários');
    expect(lines).toHaveLength(3);
    expect(lines[1]).toBe('ana@ufrgs.br,20232,"Ana ""Aninha"" Souza",0.0,Exercícios certos: 0/2');
    expect(lines[2]).toBe(",20231,Bruno Lima,10.0,Exercícios certos: 2/2");
    expect(moodleCsv(a, subs, { item: "Nota", feedback: false }).split("\n")[0]).toBe("Endereço de email,Número de identificação,Nome completo,Nota");
  });

  it("atividades diferentes viram colunas de nota, uma linha por aluno", () => {
    const b: Assignment = { ...a, title: "Plano inclinado" };
    const code = (x: Assignment) => encodeAssignment(x);
    const subs = [
      { ...sub("1", "Ana", "2026-10-01", [true]), assignment: code(a), student: { id: "1", name: "Ana", email: "ana@x.br" } },
      { ...sub("1", "Ana", "2026-10-02", [false, true]), assignment: code(b) },
      { ...sub("2", "Bia", "2026-10-02", [true, true]), assignment: code(b) },
    ];
    const lines = moodleCsv(a, subs, { feedback: false }).trimEnd().split("\n");
    expect(lines[0]).toBe('Endereço de email,Número de identificação,Nome completo,"Pêndulo, lista 1",Plano inclinado');
    expect(lines[1]).toBe("ana@x.br,1,Ana,10.0,5.0");
    expect(lines[2]).toBe(",2,Bia,,10.0");
  });

  it("aspas só quando precisa e envio mais recente", () => {
    expect(csvField("simples")).toBe("simples");
    expect(csvField("a;b")).toBe('"a;b"');
    expect(csvField(7.5)).toBe("7.5");
    const l = latestSubmissions([sub("1", "X", "2026-01-01", [false]), sub("1", "X", "2026-02-01", [true])]);
    expect(l).toHaveLength(1);
    expect(l[0]!.exercises[0]!.correct).toBe(true);
  });
});

describe("mapa de dificuldades", () => {
  const subs: Submission[] = [
    sub("1", "Ana", "2026-10-01", [true, false]),
    sub("2", "Bia", "2026-10-01", [true, false], { predictions: [{ question: "O período dobra?", chosen: 1, correct: false }] }),
    sub("3", "Caio", "2026-10-01", [false, false], {
      assignment: "codigo-b",
      exercises: [{ exercise: "ex1", seed: 9, answer: null, correct: false, tries: 0 }],
      practice: { rows: 6, results: [{ label: "g", value: 9.8, u: 0.05, compatible: true }], report: "" },
    }),
  ];
  const m = difficultyMap(subs, (s) => ({
    topic: s.assignment === "codigo-a" ? "Oscilações" : "Gravitação",
    label: (kind, key) => (kind === "exercicio" ? `Exercício ${key.slice(2)}` : undefined),
  }));

  it("agrega por tópico e por questão, do mais difícil para o mais fácil", () => {
    expect(m.students.map((s) => s.name)).toEqual(["Ana", "Bia", "Caio"]);
    expect(m.topics.map((t) => t.topic)).toEqual(["Oscilações", "Gravitação"]);
    const osc = m.topics[0]!;
    expect(osc.total).toEqual({ attempts: 5, correct: 2, blank: 0, rate: 0.4 });
    expect(osc.items.map((i) => [i.label, i.total.rate])).toEqual([
      ["Exercício 2", 0],
      ["O período dobra?", 0],
      ["Exercício 1", 1],
    ]);
    expect(osc.cells["1"]).toEqual({ attempts: 2, correct: 1, blank: 0, rate: 0.5 });
    expect(osc.cells["3"]).toBeUndefined();
  });

  it("separa itens em branco e conta resultados de prática", () => {
    const g = m.topics[1]!;
    const ex = g.items.find((i) => i.kind === "exercicio")!;
    expect(ex.total).toEqual({ attempts: 0, correct: 0, blank: 1, rate: null });
    const pr = g.items.find((i) => i.kind === "pratica")!;
    expect(pr.label).toBe("Resultado: g");
    expect(pr.total.rate).toBe(1);
    expect(g.total).toEqual({ attempts: 1, correct: 1, blank: 1, rate: 1 });
  });
});

describe("revisão de relatório pelo tutor", () => {
  it("sem endpoint devolve null; com endpoint envia o relatório no system", async () => {
    expect(await askReportReview("# R")).toBeNull();
    let body: { system: string; messages: { content: string }[] } | undefined;
    const fetchFn = (async (_u: unknown, init: RequestInit) => {
      body = JSON.parse(String(init.body));
      return new Response(JSON.stringify({ answer: "Faltam unidades." }), { status: 200 });
    }) as typeof fetch;
    expect(await askReportReview("# Relatório\n\ng = 9,8", { endpoint: "https://x/tutor", fetchFn })).toBe("Faltam unidades.");
    expect(body!.system).toContain("algarismos significativos");
    expect(body!.system).toContain("g = 9,8");
    expect(reportReviewSystem()).toContain("português do Brasil");
    const failing = (async () => new Response("{}", { status: 500 })) as unknown as typeof fetch;
    expect(await askReportReview("# R", { endpoint: "https://x", fetchFn: failing })).toBeNull();
  });
});

describe("previsões na atividade", () => {
  const q = (index: number, chosen: number, correct: boolean, extra: Partial<SubmissionPrediction> = {}): SubmissionPrediction => ({
    sim: "pendulos", scenario: "grande", index, question: `Pergunta ${index + 1}?`, chosen, correct, option: `opção ${chosen + 1}`, ...extra,
  });

  it("troca a escolha até a resposta ser revelada; depois ela fica valendo", () => {
    let l = recordPrediction([], q(0, 1, false));
    l = recordPrediction(l, q(1, 0, true));
    l = recordPrediction(l, q(0, 2, true));
    expect(l.map((p) => [p.index, p.chosen])).toEqual([[0, 2], [1, 0]]);
    l = lockPredictions(l, "pendulos", "grande");
    expect(l.every((p) => p.locked)).toBe(true);
    expect(lockPredictions(l, "pendulos", "grande")).toBe(l);
    // Voltar ao cenário e responder sabendo a resposta não muda a previsão registrada.
    expect(recordPrediction(l, q(0, 0, true))).toBe(l);
    // A mesma pergunta em outro cenário é outra previsão; travar um cenário não trava o outro.
    l = recordPrediction(l, q(0, 1, false, { scenario: "pequeno" }));
    expect(l).toHaveLength(3);
    expect(lockPredictions(l, "pendulos", "grande")).toBe(l);
    expect(lockPredictions(l, "pendulos", "pequeno")[2]!.locked).toBe(true);
  });

  it("monta as previsões da entrega: descarta registros inválidos e põe em branco as cobradas sem resposta", () => {
    const recorded = [q(0, 1, true), { question: "sem escolha" }, { question: "x", chosen: -1, correct: true }, null, q(5, 0, "sim" as unknown as boolean)];
    const out = submissionPredictions(recorded, [{ sim: "pendulos", scenario: "grande", questions: ["Pergunta 1?", "Pergunta 2?"] }]);
    expect(out.map((p) => [p.index, p.chosen, p.correct])).toEqual([[0, 1, true], [5, 0, false], [1, -1, false]]);
    expect(out[2]).toMatchObject({ question: "Pergunta 2?", sim: "pendulos", scenario: "grande" });
    expect(submissionPredictions(undefined)).toEqual([]);
    expect(submissionPredictions("lixo", [])).toEqual([]);
  });

  const base = (id: string, name: string, predictions: SubmissionPrediction[]): Submission => ({ ...sub(id, name, "2026-10-02", []), predictions });

  it("entram no mapa por cenário, com brancos e a distribuição das escolhas", () => {
    const subs = [
      base("1", "Ana", [q(0, 1, false), q(1, -1, false)]),
      base("2", "Bia", [q(0, 0, true), q(1, 2, true)]),
      base("3", "Caio", [q(0, 1, false), q(0, 0, true, { scenario: "pequeno" })]),
      // Envio antigo (Fase 6), só com o texto da pergunta.
      { ...sub("4", "Davi", "2026-10-02", []), predictions: [{ question: "Pergunta 1?", chosen: 3, correct: false }] },
    ];
    const m = difficultyMap(subs, () => ({ topic: "Oscilações" }));
    const items = m.topics[0]!.items;
    const p1 = items.find((i) => i.key === "Oscilações|previsao|grande|Pergunta 1?")!;
    expect(p1.kind).toBe("previsao");
    expect(p1.label).toBe("Pergunta 1?");
    expect(p1.total).toEqual({ attempts: 3, correct: 1, blank: 0, rate: 1 / 3 });
    expect(p1.choices).toEqual({ "opção 2": 2, "opção 1": 1 });
    const p2 = items.find((i) => i.key === "Oscilações|previsao|grande|Pergunta 2?")!;
    expect(p2.total).toEqual({ attempts: 1, correct: 1, blank: 1, rate: 1 });
    expect(p2.cells["1"]).toEqual({ attempts: 0, correct: 0, blank: 1, rate: null });
    expect(items.find((i) => i.key === "Oscilações|previsao|pequeno|Pergunta 1?")!.total.rate).toBe(1);
    const old = items.find((i) => i.key === "Oscilações|previsao|Pergunta 1?")!;
    expect(old.choices).toEqual({ "Opção 4": 1 });
    // Item mais difícil primeiro.
    expect(items[0]!.total.rate).toBe(0);
  });

  it("na nota conta ter previsto (não acertar); planilha e comentário mostram as previsões", () => {
    const w: Assignment = { ...a, weights: { exercises: 0, practice: 0, prediction: 10 } };
    expect(grade(w, base("1", "Ana", [q(0, 1, false), q(1, -1, false)]))).toBe(5);
    expect(grade(w, base("2", "Bia", [q(0, 0, true), q(1, 2, false)]))).toBe(10);
    expect(grade(w, base("3", "Caio", []))).toBe(0);
    const s = base("1", "Ana", [q(0, 1, false), q(1, 0, true), q(2, -1, false)]);
    expect(submissionFeedback(s)).toBe("Exercícios certos: 0/0; previsões feitas: 2/3 (1 certa)");
    const csv = classCsv(w, [s]).split("\n");
    expect(csv[0]).toContain("Previsões feitas;Previsões certas;Nota");
    expect(csv[1]).toMatch(/;2;1;6,7$/);
  });
});

describe("pesos da nota", () => {
  it("sugere 10% para previsões quando o cenário tem perguntas; sem elas, como antes", () => {
    expect(suggestedWeights("sim", { predictions: true, exercises: true })).toEqual({ exercises: 9, practice: 0, prediction: 1 });
    expect(suggestedWeights("sim", { predictions: false, exercises: true })).toEqual(legacyWeights("sim"));
    expect(suggestedWeights("pratica", { predictions: true, exercises: true })).toEqual({ exercises: 3, practice: 6, prediction: 1 });
    expect(suggestedWeights("pratica", { predictions: false, exercises: true })).toEqual(legacyWeights("pratica"));
    expect(suggestedWeights("pratica", { predictions: true, exercises: false })).toEqual({ exercises: 0, practice: 9, prediction: 1 });
    expect(suggestedWeights("sim", { predictions: true, exercises: false })).toEqual({ exercises: 0, practice: 0, prediction: 10 });
    for (const k of ["sim", "pratica"] as const)
      for (const predictions of [true, false]) {
        const w = suggestedWeights(k, { predictions, exercises: true });
        expect(w.exercises + w.practice + w.prediction).toBe(10);
      }
  });

  it("mostra a soma e a fração de cada parte, ignorando valores inválidos", () => {
    expect(weightShares({ exercises: 9, practice: 0, prediction: 1 })).toEqual({ total: 10, exercises: 90, practice: 0, prediction: 10 });
    expect(weightShares({ exercises: 2, practice: 4, prediction: 2 })).toEqual({ total: 8, exercises: 25, practice: 50, prediction: 25 });
    expect(weightShares({ exercises: Number.NaN, practice: -3, prediction: 0 })).toEqual({ total: 0, exercises: 0, practice: 0, prediction: 0 });
  });

  it("atividades antigas sem pesos dão a mesma nota de antes; a nota usa os pesos gravados no envio", () => {
    const s: Submission = {
      ...sub("1", "Ana", "2026-10-03", [true, false]),
      predictions: [{ question: "q", chosen: 0, correct: false }],
    };
    expect(grade(a, s)).toBe(5); // sem pesos: só exercícios
    expect(grade({ ...a, weights: suggestedWeights("sim", { predictions: true, exercises: true }) }, s)).toBe(5.5);
    expect(grade({ ...a, weights: { exercises: Number.NaN, practice: 0, prediction: 1 } }, s)).toBe(10);
    const comPesos = { ...s, assignment: encodeAssignment({ ...a, weights: { exercises: 1, practice: 0, prediction: 1 } }) };
    expect(assignmentOf(comPesos, a).weights).toEqual({ exercises: 1, practice: 0, prediction: 1 });
    expect(assignmentOf(s, a)).toBe(a);
    expect(classCsv(a, [comPesos]).split("\n")[1]).toMatch(/;7,5$/);
    expect(classCsv(a, [s]).split("\n")[1]).toMatch(/;5$/);
  });
});
