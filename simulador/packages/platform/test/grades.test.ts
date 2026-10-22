import { describe, expect, it } from "vitest";
import { askReportReview, csvField, encodeAssignment, difficultyMap, latestSubmissions, moodleCsv, reportReviewSystem, type Assignment, type Submission } from "../src/index.ts";

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
