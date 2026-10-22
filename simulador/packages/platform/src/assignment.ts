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
  /** Matrícula (id), nome e, quando conhecido, e-mail (usado na importação de notas do Moodle). */
  student: { id: string; name: string; email?: string };
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

/** Mantém só o envio mais recente de cada aluno em cada atividade. */
export function latestSubmissions(subs: Submission[]): Submission[] {
  const by = new Map<string, Submission>();
  for (const s of subs) {
    const k = `${s.assignment}|${s.student.id}`;
    const prev = by.get(k);
    if (!prev || s.submittedAt > prev.submittedAt) by.set(k, s);
  }
  return [...by.values()];
}

/** Campo CSV com aspas quando necessário (RFC 4180). */
export function csvField(v: string | number): string {
  const s = String(v);
  return /[",;\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export interface MoodleCsvOptions {
  /** Nome do item de nota (coluna da nota). Padrão: título da atividade. */
  item?: string;
  /** Inclui a coluna de comentários (feedback) com o resumo do envio. Padrão: sim. */
  feedback?: boolean;
}

/** Resumo curto do envio para o comentário da nota. */
export function submissionFeedback(s: Submission): string {
  const parts = [`Exercícios certos: ${s.exercises.filter((e) => e.correct).length}/${s.exercises.length}`];
  if (s.practice) {
    const res = s.practice.results;
    parts.push(`medidas: ${s.practice.rows}`);
    if (res.length) parts.push(`resultados compatíveis: ${res.filter((r) => r.compatible !== false).length}/${res.length}`);
  }
  return parts.join("; ");
}

/**
 * Planilha para "Importar notas → Arquivo CSV" do Moodle: separador vírgula, UTF-8, nota com ponto
 * decimal (0–10), uma linha por aluno. Traz o e-mail e o número de identificação (matrícula) para o
 * professor escolher qual mapear ("Endereço de email" ou "Número de identificação"). Envios de
 * atividades diferentes viram colunas de nota diferentes (uma por item de nota), cada uma com a
 * nota calculada pela própria atividade (ou por `a`, se o código não puder ser lido).
 */
export function moodleCsv(a: Assignment, subs: Submission[], opts: MoodleCsvOptions = {}): string {
  const fb = opts.feedback ?? true;
  const latest = latestSubmissions(subs);
  const codes = [...new Set(latest.map((s) => s.assignment))];
  const items = codes.map((code) => {
    let as = a;
    try {
      as = decodeAssignment(code);
    } catch {
      /* usa a atividade informada */
    }
    return { code, a: as, title: codes.length === 1 ? opts.item ?? a.title : as.title };
  });
  // Títulos repetidos ganham sufixo para não colidirem no mapeamento do Moodle.
  items.forEach((it, i) => {
    const n = items.slice(0, i).filter((o) => o.title === it.title || o.title.startsWith(`${it.title} (`)).length;
    if (n) it.title = `${it.title} (${n + 1})`;
  });
  const students = new Map<string, { id: string; name: string; email?: string }>();
  for (const s of latest) {
    const prev = students.get(s.student.id);
    students.set(s.student.id, { ...s.student, email: s.student.email ?? prev?.email });
  }
  const head = ["Endereço de email", "Número de identificação", "Nome completo", ...items.flatMap((it) => [it.title, ...(fb ? [codes.length === 1 ? "Comentários" : `Comentários: ${it.title}`] : [])])];
  const rows = [...students.values()]
    .sort((x, y) => x.name.localeCompare(y.name, "pt-BR"))
    .map((st) => {
      const cells = items.flatMap((it) => {
        const s = latest.find((x) => x.student.id === st.id && x.assignment === it.code);
        return [s ? grade(it.a, s).toFixed(1) : "", ...(fb ? [s ? submissionFeedback(s) : ""] : [])];
      });
      return [st.email ?? "", st.id, st.name, ...cells].map(csvField).join(",");
    });
  return [head.map(csvField).join(","), ...rows].join("\n") + "\n";
}

export interface DifficultyCell {
  /** Itens respondidos (com pelo menos uma tentativa). */
  attempts: number;
  correct: number;
  /** Itens deixados em branco. */
  blank: number;
  /** Fração de acertos entre os respondidos (null sem respostas). */
  rate: number | null;
}

export interface DifficultyItem {
  key: string;
  label: string;
  kind: "exercicio" | "previsao" | "pratica";
  topic: string;
  cells: Record<string, DifficultyCell>;
  total: DifficultyCell;
}

export interface DifficultyTopic {
  topic: string;
  items: DifficultyItem[];
  /** Por aluno, somando os itens do tópico. */
  cells: Record<string, DifficultyCell>;
  total: DifficultyCell;
}

export interface DifficultyMap {
  students: { id: string; name: string }[];
  /** Do tópico mais difícil (menor taxa de acerto) para o mais fácil. */
  topics: DifficultyTopic[];
}

const emptyCell = (): DifficultyCell => ({ attempts: 0, correct: 0, blank: 0, rate: null });
function add(c: DifficultyCell, answered: boolean, correct: boolean) {
  if (!answered) c.blank++;
  else {
    c.attempts++;
    if (correct) c.correct++;
  }
  c.rate = c.attempts ? c.correct / c.attempts : null;
}
const byRate = (a: { total: DifficultyCell }, b: { total: DifficultyCell }) => (a.total.rate ?? 2) - (b.total.rate ?? 2);

/**
 * Mapa de dificuldades: agrega acertos de exercícios, previsões e resultados de práticas
 * por tópico e por questão, para cada aluno e no total (usa o envio mais recente de cada aluno).
 * `describe` diz o tópico de um envio (ex.: tópico da simulação da atividade) e o rótulo de cada item.
 */
export function difficultyMap(subs: Submission[], describe: (s: Submission) => { topic: string; label?: (kind: DifficultyItem["kind"], key: string) => string | undefined }): DifficultyMap {
  const students = new Map<string, string>();
  const items = new Map<string, DifficultyItem>();
  const touch = (topic: string, kind: DifficultyItem["kind"], key: string, label: string, sid: string, answered: boolean, correct: boolean) => {
    const k = `${topic}|${kind}|${key}`;
    let it = items.get(k);
    if (!it) items.set(k, (it = { key: k, label, kind, topic, cells: {}, total: emptyCell() }));
    add((it.cells[sid] ??= emptyCell()), answered, correct);
    add(it.total, answered, correct);
  };
  for (const s of latestSubmissions(subs)) {
    students.set(s.student.id, s.student.name);
    const d = describe(s);
    const lab = (kind: DifficultyItem["kind"], key: string, fallback: string) => d.label?.(kind, key) ?? fallback;
    for (const e of s.exercises) touch(d.topic, "exercicio", e.exercise, lab("exercicio", e.exercise, e.exercise), s.student.id, e.tries > 0 || e.answer !== null, e.correct);
    for (const p of s.predictions) touch(d.topic, "previsao", p.question, lab("previsao", p.question, p.question), s.student.id, p.chosen >= 0, p.correct);
    for (const r of s.practice?.results ?? []) {
      if (r.compatible === undefined) continue;
      touch(d.topic, "pratica", r.label, lab("pratica", r.label, `Resultado: ${r.label}`), s.student.id, true, r.compatible);
    }
  }
  const topics = new Map<string, DifficultyTopic>();
  for (const it of items.values()) {
    let t = topics.get(it.topic);
    if (!t) topics.set(it.topic, (t = { topic: it.topic, items: [], cells: {}, total: emptyCell() }));
    t.items.push(it);
    for (const [sid, c] of Object.entries(it.cells)) {
      const tc = (t.cells[sid] ??= emptyCell());
      tc.attempts += c.attempts;
      tc.correct += c.correct;
      tc.blank += c.blank;
      tc.rate = tc.attempts ? tc.correct / tc.attempts : null;
    }
    t.total.attempts += it.total.attempts;
    t.total.correct += it.total.correct;
    t.total.blank += it.total.blank;
    t.total.rate = t.total.attempts ? t.total.correct / t.total.attempts : null;
  }
  const list = [...topics.values()].sort(byRate);
  for (const t of list) t.items.sort(byRate);
  return {
    students: [...students].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    topics: list,
  };
}
