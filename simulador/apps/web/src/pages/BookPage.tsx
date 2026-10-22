import { useMemo, useState } from "react";
import { parts, chapters } from "../livro/sumario.ts";
import { chapterContents } from "../livro/conteudo.ts";
import { apendices } from "../livro/apendices/index.ts";
import { catalog } from "../catalog.ts";
import {
  ANSWERS_HREF,
  CATALOG_HREF,
  INDEX_HREF,
  appendixHref,
  buildSearchIndex,
  chapterHref,
  chapterStats,
  plural,
  searchBook,
  searchKindLabel,
} from "../livro/livro.ts";
import "./book.css";

const FINAL_PAGES = [
  { title: "Respostas", context: "Exercícios paramétricos de cada capítulo, corrigidos na hora", href: ANSWERS_HREF },
  { title: "Índice remissivo", context: "Termos em ordem alfabética, com capítulo e seção", href: INDEX_HREF },
];

/** Página inicial: sumário do livro, com busca. */
export function BookPage() {
  const [query, setQuery] = useState("");
  const index = useMemo(
    () =>
      buildSearchIndex({
        chapters,
        sims: catalog.map(({ sim }) => ({ id: sim.id, title: sim.title, topic: sim.topic, summary: sim.summary })),
        appendices: apendices,
        pages: FINAL_PAGES,
      }),
    [],
  );
  const results = useMemo(() => searchBook(index, query), [index, query]);
  const written = chapters.filter((c) => chapterContents[c.n]).length;

  return (
    <div className="book">
      <section className="hero book-hero">
        <h1>Física para engenharia, capítulo a capítulo</h1>
        <p>
          O FisiLab segue a ordem de <em>Fundamentos de Física</em> (Halliday, Resnick e Walker): {parts.length} partes,{" "}
          {chapters.length} capítulos e {chapters.reduce((n, c) => n + c.sections.length, 0)} seções, cada uma com explicação e
          experimentos. {written < chapters.length && <>Capítulos com conteúdo: {written} de {chapters.length}. </>}
          Prefere ir direto às simulações? Veja o <a href={CATALOG_HREF}>catálogo de simulações</a>.
        </p>
        <div className="filters">
          <input
            type="search"
            placeholder="Buscar capítulo, seção, assunto ou simulação"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Buscar no livro"
          />
        </div>
      </section>

      {query.trim() ? (
        <section className="book-results" aria-live="polite">
          <h2>
            {results.length === 0 ? "Nada encontrado" : `${results.length}${results.length === 60 ? "+" : ""} resultado(s)`}
          </h2>
          <ul>
            {results.map((r) => (
              <li key={`${r.kind}-${r.href}-${r.title}`}>
                <a href={r.href}>
                  <span className="book-kind">{searchKindLabel[r.kind]}</span>
                  <strong>{r.title}</strong>
                  {r.context && <span className="muted"> · {r.context}</span>}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <>
          {parts.map((p) => (
            <section key={p.id} className="book-part">
              <h2>
                <span className="book-part-n">Parte {p.id}</span> {p.title}
              </h2>
              <ol className="book-toc">
                {p.chapters.map((ch) => {
                  const st = chapterStats(ch, chapterContents[ch.n]);
                  return (
                    <li key={ch.n}>
                      <a className={`book-chapter${st.ready ? "" : " is-pending"}`} href={chapterHref(ch.n)}>
                        <span className="book-chapter-n">{ch.n}</span>
                        <span className="book-chapter-body">
                          <strong>{ch.title}</strong>
                          <span className="muted">
                            {plural(st.sections, "seção", "seções")}
                            {st.ready ? ` · ${plural(st.experiments, "experimento", "experimentos")}` : ""}
                          </span>
                        </span>
                        {!st.ready && <span className="book-badge">em preparação</span>}
                      </a>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
          <section className="book-part">
            <h2>Apêndices</h2>
            <ol className="book-toc">
              {apendices.map((a) => (
                <li key={a.id}>
                  <a className="book-chapter" href={appendixHref(a.id)}>
                    <span className="book-chapter-n">{a.letra}</span>
                    <span className="book-chapter-body">
                      <strong>{a.titulo}</strong>
                      <span className="muted">{a.resumo}</span>
                    </span>
                  </a>
                </li>
              ))}
            </ol>
          </section>
          <section className="book-part">
            <h2>Seções finais</h2>
            <ol className="book-toc">
              {FINAL_PAGES.map((p) => (
                <li key={p.href}>
                  <a className="book-chapter" href={p.href}>
                    <span className="book-chapter-n" aria-hidden>
                      ›
                    </span>
                    <span className="book-chapter-body">
                      <strong>{p.title}</strong>
                      <span className="muted">{p.context}</span>
                    </span>
                  </a>
                </li>
              ))}
            </ol>
          </section>
        </>
      )}
    </div>
  );
}
