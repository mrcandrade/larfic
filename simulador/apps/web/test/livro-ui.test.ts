import { describe, expect, it } from "vitest";
import { chapters } from "../src/livro/sumario.ts";
import type { ChapterContent } from "../src/livro/conteudo.ts";
import { chapterContents } from "../src/livro/conteudo.ts";
import { apendices } from "../src/livro/apendices/index.ts";
import { catalog, findSim } from "../src/catalog.ts";
import { parseRoute, paramsFromQuery } from "../src/router.ts";
import {
  answersByChapter,
  bookRefs,
  buildSearchIndex,
  chapterHref,
  chapterStats,
  groupRefsByChapter,
  experimentHref,
  indexTerm,
  normalize,
  remissiveIndex,
  searchBook,
} from "../src/livro/livro.ts";

const sims = catalog.map(({ sim }) => ({ id: sim.id, title: sim.title, topic: sim.topic, summary: sim.summary }));
const simWithExercises = catalog.find(({ sim }) => (sim.exercises?.length ?? 0) > 0)!.sim;
const simNoExercises = catalog.find(({ sim }) => !sim.exercises?.length)?.sim;

/** Capítulo 2 de exemplo, independente dos capítulos que estão sendo escritos. */
const fixture: Record<number, ChapterContent> = {
  2: {
    n: 2,
    intro: "Introdução de teste.",
    sections: {
      "2-2": { text: "x", experiments: [{ kind: "sim", id: simWithExercises.id, note: "a" }] },
      "2-7": {
        text: "x",
        experiments: [
          { kind: "sim", id: simWithExercises.id, scenario: simWithExercises.scenarios[0]!.id, params: { [simWithExercises.params[0]!.key]: 3 }, note: "b" },
          { kind: "concepcao", id: "forca-movimento" },
          ...(simNoExercises ? [{ kind: "sim" as const, id: simNoExercises.id, note: "c" }] : []),
        ],
      },
    },
  },
  4: { n: 4, intro: "i", sections: { "4-6": { text: "x", experiments: [{ kind: "sim", id: simWithExercises.id, note: "d" }] } } },
};

describe("rotas do livro", () => {
  it("sumário, catálogo, capítulo, seção, apêndice, respostas e índice", () => {
    expect(parseRoute("#/").page).toBe("book");
    expect(parseRoute("").page).toBe("book");
    expect(parseRoute("#/simulacoes").page).toBe("catalog");
    expect(parseRoute("#/capitulo/2")).toMatchObject({ page: "chapter", chapter: 2, sectionId: undefined });
    expect(parseRoute(chapterHref(2, "2-7"))).toMatchObject({ page: "chapter", chapter: 2, sectionId: "2-7" });
    expect(parseRoute("#/apendice/G")).toMatchObject({ page: "appendix", appendixId: "g" });
    expect(parseRoute("#/respostas")).toMatchObject({ page: "answers", chapter: undefined });
    expect(parseRoute("#/respostas/5")).toMatchObject({ page: "answers", chapter: 5 });
    expect(parseRoute("#/indice").page).toBe("bookIndex");
    expect(parseRoute("#/capitulo/abc").page).toBe("book");
  });

  it("link de experimento leva cenário e parâmetros", () => {
    const href = experimentHref({ kind: "sim", id: "cinematica-1d", scenario: "freada", params: { v0: 20 }, note: "" });
    const r = parseRoute(href);
    expect(r).toMatchObject({ page: "sim", simId: "cinematica-1d" });
    expect(r.query.get("cenario")).toBe("freada");
    expect(paramsFromQuery(r.query)).toEqual({ v0: 20 });
    expect(experimentHref({ kind: "pratica", id: "p1", note: "" })).toBe("#/pratica/p1");
    expect(experimentHref({ kind: "concepcao", id: "c1" })).toBe("#/concepcoes/c1");
    expect(experimentHref({ kind: "desafio", id: "d1" })).toBe("#/desafios/d1");
  });
});

describe("sumário e contagens", () => {
  it("conta seções e experimentos; sem conteúdo = em preparação", () => {
    const ch2 = chapters.find((c) => c.n === 2)!;
    expect(chapterStats(ch2, fixture[2])).toEqual({ sections: ch2.sections.length, experiments: simNoExercises ? 4 : 3, ready: true });
    expect(chapterStats(ch2, undefined)).toEqual({ sections: ch2.sections.length, experiments: 0, ready: false });
  });
  it("os capítulos já escritos têm todas as seções", () => {
    for (const ch of chapters) {
      const c = chapterContents[ch.n];
      if (c) expect(chapterStats(ch, c).experiments).toBeGreaterThan(0);
    }
  });
});

describe("busca", () => {
  const index = buildSearchIndex({ chapters, sims, appendices: apendices });
  it("normaliza acentos e maiúsculas", () => {
    expect(normalize("  Aceleração  CONSTANTE ")).toBe("aceleracao constante");
  });
  it("encontra seção pelo título, sem acento", () => {
    const r = searchBook(index, "aceleracao constante");
    expect(r[0]).toMatchObject({ kind: "secao", href: chapterHref(2, "2-7") });
  });
  it("encontra seção pelo número e capítulo pelo título", () => {
    expect(searchBook(index, "2-7")[0]!.href).toBe(chapterHref(2, "2-7"));
    const r = searchBook(index, "movimento retilineo");
    expect(r[0]).toMatchObject({ kind: "capitulo", href: chapterHref(2) });
  });
  it("encontra subtópicos", () => {
    const topic = chapters.flatMap((c) => c.sections.flatMap((s) => (s.topics ?? []).map((t) => ({ t, c, s }))))[0]!;
    const r = searchBook(index, topic.t);
    expect(r.some((e) => e.kind === "subtopico" && e.href === chapterHref(topic.c.n, topic.s.id))).toBe(true);
  });
  it("encontra simulações e apêndices", () => {
    const sim = sims[0]!;
    expect(searchBook(index, sim.title).some((e) => e.kind === "simulacao" && e.title === sim.title)).toBe(true);
    expect(searchBook(index, "tabela periodica").some((e) => e.kind === "apendice" && e.href === "#/apendice/g")).toBe(true);
  });
  it("todas as palavras precisam aparecer; consulta vazia não lista nada", () => {
    expect(searchBook(index, "")).toEqual([]);
    expect(searchBook(index, "xyzzy aceleração")).toEqual([]);
    expect(searchBook(index, "lei", 5)).toHaveLength(5);
  });
});

describe("No livro (referências de uma sim)", () => {
  it("lista as seções, na ordem do livro, sem repetir", () => {
    const refs = bookRefs(chapters, fixture, simWithExercises.id);
    expect(refs.map((r) => [r.chapter, r.sectionId])).toEqual([
      [2, "2-2"],
      [2, "2-7"],
      [4, "4-6"],
    ]);
    expect(refs[1]!.scenarios).toEqual([simWithExercises.scenarios[0]!.id]);
    expect(refs[1]!.sectionTitle).toBe(chapters[1]!.sections.find((s) => s.id === "2-7")!.title);
    expect(refs[0]!.href).toBe("#/capitulo/2/2-2");
    expect(bookRefs(chapters, fixture, "nao-existe")).toEqual([]);
    expect(groupRefsByChapter(refs).map((g) => [g.chapter, g.refs.map((r) => r.sectionId)])).toEqual([
      [2, ["2-2", "2-7"]],
      [4, ["4-6"]],
    ]);
    expect(bookRefs(chapters, fixture, "forca-movimento", "concepcao").map((r) => r.sectionId)).toEqual(["2-7"]);
  });
});

describe("índice remissivo", () => {
  const groups = remissiveIndex({
    chapters,
    contents: fixture,
    simTitle: (id) => findSim(id)?.title,
    conceptTitle: (id) => (id === "forca-movimento" ? "Força implica movimento" : undefined),
  });
  const entries = groups.flatMap((g) => g.entries);
  it("tira o artigo inicial", () => {
    expect(indexTerm("A Lei de Coulomb")).toBe("Lei de Coulomb");
    expect(indexTerm("O Sistema Internacional de Unidades")).toBe("Sistema Internacional de Unidades");
    expect(indexTerm("Uma Pausa para Refletir")).toBe("Pausa para Refletir");
    expect(indexTerm("Atrito")).toBe("Atrito");
  });
  it("cobre todas as seções e está em ordem alfabética", () => {
    const allSections = chapters.reduce((n, c) => n + c.sections.length, 0);
    const refs = new Set(entries.flatMap((e) => e.refs.map((r) => r.href)));
    expect(refs.size).toBe(allSections);
    const keys = entries.map((e) => normalize(e.term).replace(/^[^a-z0-9]+/, ""));
    expect([...keys].sort((a, b) => a.localeCompare(b, "pt-BR"))).toEqual(keys);
    expect(groups.map((g) => g.letter)).toEqual([...new Set(groups.map((g) => g.letter))]);
    expect(groups.every((g) => /^[A-Z]$/.test(g.letter))).toBe(true);
  });
  it("aponta a seção 2-7 e inclui sims e concepções ligadas", () => {
    const sec = entries.find((e) => e.refs.some((r) => r.href === chapterHref(2, "2-7")) && !e.note)!;
    expect(sec.refs.find((r) => r.href === chapterHref(2, "2-7"))!.label).toBe("Cap. 2, seção 2-7");
    const sim = entries.find((e) => e.note === "simulação" && e.term === indexTerm(simWithExercises.title))!;
    expect(sim.refs.map((r) => r.label)).toEqual(["Cap. 2, seção 2-2", "Cap. 2, seção 2-7", "Cap. 4, seção 4-6"]);
    expect(entries.find((e) => e.note === "concepção")?.term).toBe("Força implica movimento");
  });
});

describe("respostas", () => {
  it("agrupa por capítulo só as sims com exercícios, com as seções", () => {
    const a = answersByChapter(chapters, fixture, findSim);
    expect(a.map((c) => c.n)).toEqual([2, 4]);
    expect(a[0]!.sims).toHaveLength(1);
    expect(a[0]!.sims[0]!.sim.id).toBe(simWithExercises.id);
    expect(a[0]!.sims[0]!.sections).toEqual(["2-2", "2-7"]);
    expect(answersByChapter(chapters, {}, findSim)).toEqual([]);
  });
});
