import { useMemo, useState } from "react";
import { chapters } from "../livro/sumario.ts";
import { chapterContents } from "../livro/conteudo.ts";
import { findSim } from "../catalog.ts";
import { findConcept } from "../concepts.ts";
import { BOOK_HREF, normalize, remissiveIndex } from "../livro/livro.ts";
import "./book.css";

/** Índice remissivo: termos em ordem alfabética, apontando para capítulo e seção. */
export function BookIndexPage() {
  const groups = useMemo(
    () =>
      remissiveIndex({
        chapters,
        contents: chapterContents,
        simTitle: (id) => findSim(id)?.title,
        conceptTitle: (id) => findConcept(id)?.title,
      }),
    [],
  );
  const [q, setQ] = useState("");
  const shown = useMemo(() => {
    const n = normalize(q);
    if (!n) return groups;
    return groups.map((g) => ({ ...g, entries: g.entries.filter((e) => normalize(e.term).includes(n)) })).filter((g) => g.entries.length);
  }, [groups, q]);

  return (
    <div className="book-index">
      <nav className="crumbs">
        <a href={BOOK_HREF}>Sumário</a> <span aria-hidden>›</span> Índice remissivo
      </nav>
      <header className="chapter-head">
        <span className="book-kind">Seções finais</span>
        <h1>Índice remissivo</h1>
        <p className="muted">
          Títulos e subtópicos das seções, simulações e concepções alternativas, com o capítulo e a seção em que aparecem.
        </p>
      </header>
      <div className="filters">
        <input type="search" placeholder="Filtrar termos" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filtrar termos" />
      </div>
      <nav className="book-letters" aria-label="Letras">
        {shown.map((g) => (
          <button key={g.letter} className="book-chip" onClick={() => document.getElementById(`letra-${g.letter}`)?.scrollIntoView({ block: "start" })}>
            {g.letter}
          </button>
        ))}
      </nav>
      {shown.length === 0 && <p className="muted">Nenhum termo encontrado.</p>}
      {shown.map((g) => (
        <section key={g.letter} id={`letra-${g.letter}`} className="book-index-group">
          <h2>{g.letter}</h2>
          <ul>
            {g.entries.map((e) => (
              <li key={`${e.term}|${e.note ?? ""}`}>
                <span className="book-index-term">{e.term}</span>
                {e.note && <span className="muted"> ({e.note})</span>}
                <span className="book-index-refs">
                  {e.refs.map((r, i) => (
                    <span key={r.href}>
                      {i > 0 && "; "}
                      <a href={r.href}>{r.label}</a>
                    </span>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
