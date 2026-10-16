// Atividades criadas pelo professor: uma sim (ou prática) com cenário, parâmetros travados e exercícios.
import { b64url, b64urlDecode } from "./jwt.ts";

export interface Assignment {
  v: 1;
  /** Título que o aluno vê. */
  title: string;
  /** Turma/disciplina (texto livre ou id do contexto LTI). */
  turma?: string;
  kind: "sim" | "pratica";
  /** id da sim ou da prática. */
  target: string;
  scenario?: string;
  params?: Record<string, number>;
  locked?: string[];
  /** Ids dos exercícios cobrados (vazio = todos da sim). */
  exercises?: string[];
  /** Quantas questões de cada exercício (cada aluno recebe valores próprios). */
  perExercise?: number;
  /** Instruções do professor em markdown. */
  instructions?: string;
  /** Prazo ISO. */
  due?: string;
  /** Peso de cada parte na nota (0–10). */
  weights?: { exercises: number; practice: number; prediction: number };
}

/** Código compacto e autocontido para links (#/atividade/<código>) que funcionam sem servidor. */
export function encodeAssignment(a: Assignment): string {
  return b64url(JSON.stringify(a));
}

export function decodeAssignment(code: string): Assignment {
  const a = JSON.parse(new TextDecoder().decode(b64urlDecode(code))) as Assignment;
  if (a.v !== 1 || !a.target || (a.kind !== "sim" && a.kind !== "pratica")) throw new Error("atividade inválida");
  return a;
}

export interface ExerciseAttempt {
  exercise: string;
  seed: number;
  answer: number | null;
  correct: boolean;
  tries: number;
}

export interface Submission {
  v: 1;
  assignment: string;
  student: { id: string; name: string };
  startedAt: string;
  submittedAt: string;
  exercises: ExerciseAttempt[];
  predictions: { question: string; chosen: number; correct: boolean }[];
  practice?: { rows: number; results: { label: string; value: number; u: number; compatible?: boolean }[]; report: string };
  /** Resumo SHA-256 do conteúdo, para o professor detectar arquivos editados à mão. */
  digest?: string;
}

/** Nota de 0 a 10 a partir dos pesos da atividade. */
export function grade(a: Assignment, s: Submission): number {
  const w = a.weights ?? (a.kind === "pratica" ? { exercises: 4, practice: 6, prediction: 0 } : { exercises: 10, practice: 0, prediction: 0 });
  const total = w.exercises + w.practice + w.prediction || 1;
  const ex = s.exercises.length ? s.exercises.filter((e) => e.correct).length / s.exercises.length : 0;
  const pr = s.predictions.length ? s.predictions.length / Math.max(1, s.predictions.length) : 0; // ter feito a previsão conta, acertar não
  let pt = 0;
  if (s.practice) {
    const res = s.practice.results;
    const ok = res.filter((r) => r.compatible !== false).length;
    pt = s.practice.rows >= 5 ? 0.5 + 0.5 * (res.length ? ok / res.length : 1) : s.practice.rows / 10;
  }
  return Math.round(((10 * (w.exercises * ex + w.practice * pt + w.prediction * pr)) / total) * 10) / 10;
}

async function sha256(text: string): Promise<string> {
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
  return Array.from(h, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function sealSubmission(s: Submission): Promise<Submission> {
  const { digest: _d, ...rest } = s;
  return { ...rest, digest: await sha256(JSON.stringify(rest)) };
}

export async function checkSubmission(s: Submission): Promise<boolean> {
  const { digest, ...rest } = s;
  return !!digest && digest === (await sha256(JSON.stringify(rest)));
}

/** Semente estável por aluno e exercício: cada aluno recebe números próprios, e reabrir dá os mesmos. */
export function studentSeed(studentId: string, assignmentCode: string, exercise: string, k: number): number {
  let h = 2166136261;
  for (const ch of `${studentId}|${assignmentCode}|${exercise}|${k}`) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) || 1;
}

/** Planilha da turma (CSV com ;) para o professor. */
export function classCsv(a: Assignment, subs: Submission[]): string {
  const head = ["Matrícula", "Nome", "Enviado em", "Exercícios certos", "Exercícios", "Medidas", "Nota"];
  const lines = subs.map((s) =>
    [s.student.id, s.student.name, s.submittedAt, s.exercises.filter((e) => e.correct).length, s.exercises.length, s.practice?.rows ?? "", String(grade(a, s)).replace(".", ",")].join(";"),
  );
  return [head.join(";"), ...lines].join("\n");
}
