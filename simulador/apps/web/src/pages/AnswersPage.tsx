import { useEffect, useMemo } from "react";
import { Exercises } from "@fisilab/ui-kit";
import { chapters } from "../livro/sumario.ts";
import { chapterContents } from "../livro/conteudo.ts";
import { findSim } from "../catalog.ts";
import { simHref } from "../router.ts";
import { BOOK_HREF, answersByChapter, answersHref, chapterHref, experimentQuery, plural } from "../livro/livro.ts";
import "./book.css";

/**
 * Respostas: por capítulo, os exercícios paramétricos das sims ligadas a ele. O aluno sorteia
 * uma versão, resolve e confere ali mesmo (correção automática com tolerância).
 */
export function AnswersPage({ chapter }: { chapter?: number }) {
  const all = useMemo(() => answersByChapter(chapters, chapterContents, findSim), []);
  const current = chapter ? all.find((c) => c.n === chapter) : undefined;

  useEffect(() => {
    if (chapter) window.scrollTo(0, 0);
  }, [chapter]);

  return (
    <div className="answers">
      <nav className="crumbs">
        <a href={BOOK_HREF}>Sumário</a> <span aria-hidden>›</span> <a href={answersHref()}>Respostas</a>
        {current && (
          <>
            {" "}
            <span aria-hidden>›</span> Capítulo {current.n}
          </>
        )}
      </nav>
      <header className="chapter-head">
        <span className="book-kind">Seções finais</span>
        <h1>{current ? `Respostas · Capítulo ${current.n}: ${current.title}` : "Respostas"}</h1>
        {!current && (
          <p className="muted">
            Cada capítulo traz os exercícios das simulações usadas nele. Os valores são sorteados a cada versão: resolva, digite a
            resposta e corrija na hora. “Abrir na simulação” monta a situação do exercício para você conferir.
          </p>
        )}
      </header>

      {chapter && !current && (
        <p className="note">
          O capítulo {chapter} ainda não tem exercícios ligados. <a href={answersHref()}>Ver todos os capítulos</a>.
        </p>
      )}

      {!current ? (
        all.length === 0 ? (
          <p className="note">Os exercícios aparecem aqui à medida que os capítulos forem escritos.</p>
        ) : (
          <ol className="book-toc">
            {all.map((c) => {
              const n = c.sims.reduce((k, s) => k + (s.sim.exercises?.length ?? 0), 0);
              return (
                <li key={c.n}>
                  <a className="book-chapter" href={answersHref(c.n)}>
                    <span className="book-chapter-n">{c.n}</span>
                    <span className="book-chapter-body">
                      <strong>{c.title}</strong>
                      <span className="muted">
                        {plural(n, "modelo de exercício", "modelos de exercício")} em {plural(c.sims.length, "simulação", "simulações")}
                      </span>
                    </span>
                  </a>
                </li>
              );
            })}
          </ol>
        )
      ) : (
        <>
          {current.sims.map(({ sim, sections }) => (
            <section key={sim.id} className="book-block answers-sim">
              <h2>{sim.title}</h2>
              <p className="muted">
                Usada nas seções{" "}
                {sections.map((s, i) => (
                  <span key={s}>
                    {i > 0 && ", "}
                    <a href={chapterHref(current.n, s)}>{s}</a>
                  </span>
                ))}
                .
              </p>
              <Exercises sim={sim} onOpen={(params) => (location.hash = simHref(sim.id, experimentQuery({ params })))} />
            </section>
          ))}
          <p>
            <a href={chapterHref(current.n)}>← Voltar ao capítulo {current.n}</a>
          </p>
        </>
      )}
    </div>
  );
}
