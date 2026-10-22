/**
 * Lógica do livro (sem JSX): links, contagens, busca no sumário, índice remissivo,
 * "No livro" de cada simulação e a lista de exercícios por capítulo (Respostas).
 * As funções recebem os dados por parâmetro para serem testadas com dados de exemplo.
 */
import type { BookChapter, BookSection } from "./sumario.ts";
import type { ChapterContent, ExperimentRef } from "./conteudo.ts";
import { practiceHref, simHref } from "../router.ts";

// ------------------------------------------------------------------ links

export const BOOK_HREF = "#/";
export const CATALOG_HREF = "#/simulacoes";
export const ANSWERS_HREF = "#/respostas";
export const INDEX_HREF = "#/indice";
export const chapterHref = (n: number, sectionId?: string) => `#/capitulo/${n}${sectionId ? `/${encodeURIComponent(sectionId)}` : ""}`;
export const appendixHref = (id: string) => `#/apendice/${id.toLowerCase()}`;
export const answersHref = (n?: number) => (n ? `${ANSWERS_HREF}/${n}` : ANSWERS_HREF);
/** id do elemento HTML de uma seção na página do capítulo. */
export const sectionAnchor = (sectionId: string) => `secao-${sectionId}`;
export const sectionHeading = (s: BookSection) => `${s.id} ${s.title}`;

/** Consulta da URL de uma sim ligada ao livro: cenário e parâmetros p.<chave>. */
export function experimentQuery(ref: { scenario?: string; params?: Record<string, number> }): URLSearchParams {
  const q = new URLSearchParams();
  if (ref.scenario) q.set("cenario", ref.scenario);
  for (const [k, v] of Object.entries(ref.params ?? {})) q.set(`p.${k}`, String(v));
  return q;
}

export function experimentHref(ref: ExperimentRef): string {
  switch (ref.kind) {
    case "sim":
      return simHref(ref.id, experimentQuery(ref));
    case "pratica":
      return practiceHref(ref.id);
    case "concepcao":
      return `#/concepcoes/${encodeURIComponent(ref.id)}`;
    case "desafio":
      return `#/desafios/${encodeURIComponent(ref.id)}`;
  }
}

// ------------------------------------------------------------------ contagens

export interface ChapterStats {
  sections: number;
  experiments: number;
  /** O capítulo já tem arquivo de conteúdo. */
  ready: boolean;
}

export function chapterStats(ch: BookChapter, content: ChapterContent | undefined): ChapterStats {
  const experiments = content ? Object.values(content.sections).reduce((n, s) => n + s.experiments.length, 0) : 0;
  return { sections: ch.sections.length, experiments, ready: Boolean(content) };
}

export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// ------------------------------------------------------------------ texto

/** Minúsculas, sem acentos, espaços simples: para busca e ordenação. */
export function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const ARTICLE = /^(o|a|os|as|um|uma|uns|umas)\s+/i;

/** Termo de índice: tira o artigo inicial ("A Lei de Coulomb" → "Lei de Coulomb"). */
export function indexTerm(title: string): string {
  const t = title.trim().replace(ARTICLE, "");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

// ------------------------------------------------------------------ busca

export type SearchKind = "capitulo" | "secao" | "subtopico" | "simulacao" | "apendice" | "pagina";

export const searchKindLabel: Record<SearchKind, string> = {
  capitulo: "Capítulo",
  secao: "Seção",
  subtopico: "Subtópico",
  simulacao: "Simulação",
  apendice: "Apêndice",
  pagina: "Página",
};

export interface SearchEntry {
  kind: SearchKind;
  title: string;
  /** Onde fica (capítulo, seção...) ou um resumo. */
  context: string;
  href: string;
  /** Título normalizado e texto extra de busca normalizado. */
  key: string;
  extra: string;
}

export interface SimInfo {
  id: string;
  title: string;
  topic?: string;
  summary?: string;
}

export function buildSearchIndex(opts: {
  chapters: BookChapter[];
  sims?: SimInfo[];
  appendices?: { id: string; letra: string; titulo: string; resumo: string }[];
  pages?: { title: string; context: string; href: string }[];
}): SearchEntry[] {
  const out: SearchEntry[] = [];
  const add = (kind: SearchKind, title: string, context: string, href: string, extra = "") =>
    out.push({ kind, title, context, href, key: normalize(title), extra: normalize(`${context} ${extra}`) });
  for (const ch of opts.chapters) {
    add("capitulo", `Capítulo ${ch.n}: ${ch.title}`, plural(ch.sections.length, "seção", "seções"), chapterHref(ch.n), `cap ${ch.n}`);
    for (const s of ch.sections) {
      add("secao", sectionHeading(s), `Capítulo ${ch.n}: ${ch.title}`, chapterHref(ch.n, s.id));
      for (const t of s.topics ?? []) add("subtopico", t, `Seção ${sectionHeading(s)}`, chapterHref(ch.n, s.id));
    }
  }
  for (const a of opts.appendices ?? []) add("apendice", `Apêndice ${a.letra}: ${a.titulo}`, a.resumo, appendixHref(a.id));
  for (const sim of opts.sims ?? []) add("simulacao", sim.title, sim.topic ?? "", simHref(sim.id), sim.summary ?? "");
  for (const p of opts.pages ?? []) add("pagina", p.title, p.context, p.href);
  return out;
}

const KIND_ORDER: SearchKind[] = ["capitulo", "secao", "subtopico", "apendice", "simulacao", "pagina"];

/**
 * Busca sem diferenciar acentos nem maiúsculas: todas as palavras da consulta precisam aparecer
 * no título ou no contexto. Ordem: título que começa com a consulta, título que a contém,
 * título com todas as palavras, só no contexto; depois por tipo e pela ordem do livro.
 */
export function searchBook(index: SearchEntry[], query: string, limit = 60): SearchEntry[] {
  const q = normalize(query);
  if (!q) return [];
  const words = q.split(" ");
  const scored: { e: SearchEntry; score: number; i: number }[] = [];
  index.forEach((e, i) => {
    const all = `${e.key} ${e.extra}`;
    if (!words.every((w) => all.includes(w))) return;
    const bare = e.key.replace(/^capitulo \d+: /, "").replace(/^\d+-\d+ /, "");
    const score =
      e.key.startsWith(q) || bare.startsWith(q) ? 0 : e.key.includes(q) ? 1 : words.every((w) => e.key.includes(w)) ? 2 : 3;
    scored.push({ e, score, i });
  });
  scored.sort((a, b) => a.score - b.score || KIND_ORDER.indexOf(a.e.kind) - KIND_ORDER.indexOf(b.e.kind) || a.i - b.i);
  return scored.slice(0, limit).map((s) => s.e);
}

// ------------------------------------------------------------------ "No livro"

export interface BookRef {
  chapter: number;
  chapterTitle: string;
  sectionId: string;
  sectionTitle: string;
  href: string;
  /** Cenários da sim usados nessa seção. */
  scenarios: string[];
}

/** Seções do livro que usam um experimento (por padrão uma sim), na ordem do livro. */
export function bookRefs(
  chapters: BookChapter[],
  contents: Record<number, ChapterContent>,
  id: string,
  kind: ExperimentRef["kind"] = "sim",
): BookRef[] {
  const out: BookRef[] = [];
  for (const ch of chapters) {
    const content = contents[ch.n];
    if (!content) continue;
    for (const s of ch.sections) {
      const refs = content.sections[s.id]?.experiments.filter((r) => r.kind === kind && r.id === id) ?? [];
      if (!refs.length) continue;
      const scenarios = [...new Set(refs.map((r) => (r.kind === "sim" ? r.scenario : undefined)).filter((x): x is string => Boolean(x)))];
      out.push({ chapter: ch.n, chapterTitle: ch.title, sectionId: s.id, sectionTitle: s.title, href: chapterHref(ch.n, s.id), scenarios });
    }
  }
  return out;
}

/** Agrupa as referências por capítulo, para a linha "No livro" ficar curta. */
export function groupRefsByChapter(refs: BookRef[]): { chapter: number; chapterTitle: string; refs: BookRef[] }[] {
  const out: { chapter: number; chapterTitle: string; refs: BookRef[] }[] = [];
  for (const r of refs) {
    const g = out.at(-1);
    if (g?.chapter === r.chapter) g.refs.push(r);
    else out.push({ chapter: r.chapter, chapterTitle: r.chapterTitle, refs: [r] });
  }
  return out;
}

// ------------------------------------------------------------------ índice remissivo

export interface IndexRef {
  label: string;
  href: string;
  /** Para ordenar as referências na ordem do livro. */
  order: number;
}

export interface IndexEntry {
  term: string;
  /** "simulação", "concepção" quando o termo é um experimento. */
  note?: string;
  refs: IndexRef[];
}

export interface IndexGroup {
  letter: string;
  entries: IndexEntry[];
}

/**
 * Índice alfabético: títulos e subtópicos de todas as seções do sumário, e os títulos das
 * simulações e concepções ligadas a cada seção nos capítulos já escritos.
 */
export function remissiveIndex(opts: {
  chapters: BookChapter[];
  contents: Record<number, ChapterContent>;
  simTitle?(id: string): string | undefined;
  conceptTitle?(id: string): string | undefined;
}): IndexGroup[] {
  const map = new Map<string, IndexEntry>();
  const add = (title: string, ref: IndexRef, note?: string) => {
    const term = indexTerm(title);
    const k = `${normalize(term)}|${note ?? ""}`;
    const entry = map.get(k) ?? { term, note, refs: [] };
    if (!entry.refs.some((r) => r.href === ref.href)) entry.refs.push(ref);
    map.set(k, entry);
  };
  let order = 0;
  for (const ch of opts.chapters) {
    const content = opts.contents[ch.n];
    for (const s of ch.sections) {
      const ref = { label: `Cap. ${ch.n}, seção ${s.id}`, href: chapterHref(ch.n, s.id), order: order++ };
      add(s.title, ref);
      for (const t of s.topics ?? []) add(t, ref);
      for (const e of content?.sections[s.id]?.experiments ?? []) {
        if (e.kind === "sim") {
          const t = opts.simTitle?.(e.id);
          if (t) add(t, ref, "simulação");
        } else if (e.kind === "concepcao") {
          const t = opts.conceptTitle?.(e.id);
          if (t) add(t, ref, "concepção");
        }
      }
    }
  }
  const entries = [...map.values()];
  for (const e of entries) e.refs.sort((a, b) => a.order - b.order);
  // Ordena ignorando aspas e outros sinais iniciais ("Bombeamento" vai para o B).
  const sortKey = (t: string) => normalize(t).replace(/^[^a-z0-9]+/, "");
  entries.sort((a, b) => sortKey(a.term).localeCompare(sortKey(b.term), "pt-BR") || (a.note ?? "").localeCompare(b.note ?? ""));
  const groups: IndexGroup[] = [];
  for (const e of entries) {
    const first = sortKey(e.term).charAt(0).toUpperCase();
    const letter = /[A-Z]/.test(first) ? first : "#";
    const g = groups.at(-1);
    if (g?.letter === letter) g.entries.push(e);
    else groups.push({ letter, entries: [e] });
  }
  return groups;
}

// ------------------------------------------------------------------ respostas

export interface AnswerSim<S> {
  sim: S;
  sections: string[];
}

export interface AnswerChapter<S> {
  n: number;
  title: string;
  sims: AnswerSim<S>[];
}

/** Por capítulo escrito, as sims ligadas a ele que têm exercícios paramétricos. */
export function answersByChapter<S extends { exercises?: unknown[] }>(
  chapters: BookChapter[],
  contents: Record<number, ChapterContent>,
  findSim: (id: string) => S | undefined,
): AnswerChapter<S>[] {
  const out: AnswerChapter<S>[] = [];
  for (const ch of chapters) {
    const content = contents[ch.n];
    if (!content) continue;
    const bySim = new Map<string, AnswerSim<S>>();
    for (const s of ch.sections) {
      for (const e of content.sections[s.id]?.experiments ?? []) {
        if (e.kind !== "sim") continue;
        const sim = findSim(e.id);
        if (!sim?.exercises?.length) continue;
        const a = bySim.get(e.id) ?? { sim, sections: [] };
        if (!a.sections.includes(s.id)) a.sections.push(s.id);
        bySim.set(e.id, a);
      }
    }
    if (bySim.size) out.push({ n: ch.n, title: ch.title, sims: [...bySim.values()] });
  }
  return out;
}
