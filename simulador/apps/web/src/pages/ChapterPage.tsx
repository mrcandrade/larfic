import { useEffect, useState } from "react";
import { Markdown, SimView } from "@fisilab/ui-kit";
import { chapters, findChapter, partOf, type BookChapter, type BookSection } from "../livro/sumario.ts";
import { chapterContents, type ChapterContent, type ExperimentRef, type SectionContent } from "../livro/conteudo.ts";
import { findSim } from "../catalog.ts";
import { findPractice } from "../practices.ts";
import { findConcept } from "../concepts.ts";
import { findChallenge, LEVELS } from "../challenge-core.ts";
import { BOOK_HREF, answersHref, chapterHref, experimentHref, plural, sectionAnchor, sectionHeading } from "../livro/livro.ts";
import "./book.css";

export function ChapterPage({ n, sectionId }: { n: number; sectionId?: string }) {
  const ch = findChapter(n);
  const content = chapterContents[n];
  const active = useActiveSection(ch, sectionId);

  // Rola até a seção pedida na URL (ou para o topo ao trocar de capítulo).
  useEffect(() => {
    if (!sectionId) {
      window.scrollTo(0, 0);
      return;
    }
    const el = document.getElementById(sectionAnchor(sectionId));
    el?.scrollIntoView({ block: "start" });
  }, [n, sectionId]);

  if (!ch) {
    return (
      <div className="notfound">
        <h1>Capítulo não encontrado</h1>
        <p>
          <a href={BOOK_HREF}>Voltar ao sumário</a>
        </p>
      </div>
    );
  }
  const part = partOf(n);
  const i = chapters.indexOf(ch);
  const prev = chapters[i - 1];
  const next = chapters[i + 1];

  return (
    <div className="chapter">
      <nav className="crumbs">
        <a href={BOOK_HREF}>Sumário</a> <span aria-hidden>›</span> Parte {part?.id} · {part?.title} <span aria-hidden>›</span> Capítulo {ch.n}
      </nav>
      <header className="chapter-head">
        <span className="book-kind">
          Parte {part?.id} · {part?.title}
        </span>
        <h1>
          <span className="chapter-n">Capítulo {ch.n}</span> {ch.title}
        </h1>
      </header>

      <div className="chapter-layout">
        <aside className="chapter-aside" aria-label="Seções do capítulo">
          <Toc ch={ch} active={active} />
        </aside>
        <article className="chapter-body">
          <details className="chapter-toc-mobile">
            <summary>Seções do capítulo ({ch.sections.length})</summary>
            <Toc ch={ch} active={active} />
          </details>

          {content ? (
            <div className="chapter-intro">
              <Markdown text={content.intro} />
            </div>
          ) : (
            <p className="note">
              Este capítulo ainda está em preparação: a explicação e os experimentos de cada seção estão sendo escritos. Abaixo, as
              seções que ele terá.
            </p>
          )}

          {ch.sections.map((s) => (
            <SectionView key={s.id} chapter={ch} section={s} content={content?.sections[s.id]} />
          ))}

          <nav className="chapter-pager" aria-label="Outros capítulos">
            {prev ? (
              <a href={chapterHref(prev.n)} className="chapter-pager-prev">
                <span className="muted">← Capítulo {prev.n}</span>
                <strong>{prev.title}</strong>
              </a>
            ) : (
              <span />
            )}
            {next ? (
              <a href={chapterHref(next.n)} className="chapter-pager-next">
                <span className="muted">Capítulo {next.n} →</span>
                <strong>{next.title}</strong>
              </a>
            ) : (
              <span />
            )}
          </nav>
          {content && <ChapterFooter content={content} />}
        </article>
      </div>
    </div>
  );
}

function ChapterFooter({ content }: { content: ChapterContent }) {
  const hasExercises = Object.values(content.sections).some((s) =>
    s.experiments.some((e) => e.kind === "sim" && (findSim(e.id)?.exercises?.length ?? 0) > 0),
  );
  if (!hasExercises) return null;
  return (
    <p className="muted chapter-answers-link">
      Exercícios deste capítulo, com correção: <a href={answersHref(content.n)}>Respostas do capítulo {content.n}</a>.
    </p>
  );
}

function Toc({ ch, active }: { ch: BookChapter; active?: string }) {
  return (
    <ol className="chapter-toc">
      {ch.sections.map((s) => (
        <li key={s.id}>
          <a
            href={chapterHref(ch.n, s.id)}
            aria-current={active === s.id ? "location" : undefined}
            onClick={() => {
              // Se a URL já é esta, o hashchange não dispara: rola mesmo assim.
              if (location.hash === chapterHref(ch.n, s.id)) document.getElementById(sectionAnchor(s.id))?.scrollIntoView({ block: "start" });
            }}
          >
            <span className="chapter-toc-id">{s.id}</span> {s.title}
          </a>
        </li>
      ))}
    </ol>
  );
}

/** Seção visível no momento (para destacar no índice lateral). */
function useActiveSection(ch: BookChapter | undefined, initial?: string): string | undefined {
  const [active, setActive] = useState(initial);
  useEffect(() => setActive(initial), [initial]);
  useEffect(() => {
    if (!ch || typeof IntersectionObserver === "undefined") return;
    const els = ch.sections.map((s) => document.getElementById(sectionAnchor(s.id))).filter((e): e is HTMLElement => Boolean(e));
    const visible = new Map<string, boolean>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) visible.set(e.target.id, e.isIntersecting);
        const first = els.find((el) => visible.get(el.id));
        if (first) setActive(first.id.replace(/^secao-/, ""));
      },
      { rootMargin: "0px 0px -60% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [ch]);
  return active;
}

function SectionView({ chapter, section, content }: { chapter: BookChapter; section: BookSection; content?: SectionContent }) {
  const [open, setOpen] = useState<number | null>(null);
  const openRef = open !== null ? content?.experiments[open] : undefined;
  const openSim = openRef?.kind === "sim" ? findSim(openRef.id) : undefined;
  return (
    <section id={sectionAnchor(section.id)} className="chapter-section">
      <h2>
        <a href={chapterHref(chapter.n, section.id)} className="chapter-section-link">
          {sectionHeading(section)}
        </a>
      </h2>
      {section.topics && section.topics.length > 0 && (
        <p className="chapter-topics">
          {section.topics.map((t) => (
            <span key={t} className="book-chip">
              {t}
            </span>
          ))}
        </p>
      )}
      {content ? (
        <>
          <Markdown text={content.text} />
          {content.experiments.length > 0 && (
            <div className="chapter-experiments">
              <h3>{plural(content.experiments.length, "Experimento", "Experimentos")}</h3>
              <ul className="cards">
                {content.experiments.map((e, i) => (
                  <li key={`${e.kind}-${e.id}-${i}`}>
                    <ExperimentCard ref_={e} open={open === i} onToggle={() => setOpen(open === i ? null : i)} />
                  </li>
                ))}
              </ul>
            </div>
          )}
          {openRef?.kind === "sim" && openSim && (
            <div className="chapter-inline-sim" aria-label={`Simulação: ${openSim.title}`}>
              <div className="chapter-inline-head">
                <strong>{openSim.title}</strong>
                <a href={experimentHref(openRef)}>Abrir em tela cheia</a>
                <button onClick={() => setOpen(null)}>Fechar</button>
              </div>
              <SimView
                key={`${openRef.id}-${open}`}
                sim={openSim}
                initialScenario={openRef.scenario}
                initialParams={openRef.params}
              />
            </div>
          )}
        </>
      ) : (
        <p className="muted">Explicação em preparação.</p>
      )}
    </section>
  );
}

const KIND_LABEL: Record<ExperimentRef["kind"], string> = {
  sim: "Simulação",
  pratica: "Prática de bancada",
  concepcao: "Concepção alternativa",
  desafio: "Desafio",
};

function ExperimentCard({ ref_: e, open, onToggle }: { ref_: ExperimentRef; open: boolean; onToggle(): void }) {
  let title = e.id;
  let detail = "";
  if (e.kind === "sim") {
    const sim = findSim(e.id);
    title = sim?.title ?? e.id;
    const sc = e.scenario ? sim?.scenarios.find((s) => s.id === e.scenario) : undefined;
    if (sc) detail = `Cenário: ${sc.label}`;
  } else if (e.kind === "pratica") {
    title = findPractice(e.id)?.title ?? e.id;
  } else if (e.kind === "concepcao") {
    const c = findConcept(e.id);
    title = c?.title ?? e.id;
    if (!e.note && c) detail = `“${c.statement}”`;
  } else {
    const c = findChallenge(e.id);
    title = c?.title ?? e.id;
    if (c) detail = `Nível ${LEVELS[c.level].toLowerCase()}`;
  }
  return (
    <div className={`card book-exp book-exp-${e.kind}`}>
      <span className="card-topic">{KIND_LABEL[e.kind]}</span>
      <strong>{title}</strong>
      {detail && <span className="card-summary">{detail}</span>}
      {e.note && <span className="card-summary">{e.note}</span>}
      <span className="book-exp-actions">
        <a className="book-exp-open" href={experimentHref(e)}>
          {e.kind === "sim" ? "Abrir simulação" : e.kind === "pratica" ? "Abrir prática" : e.kind === "concepcao" ? "Abrir concepção" : "Abrir desafio"}
        </a>
        {e.kind === "sim" && (
          <button onClick={onToggle} aria-expanded={open}>
            {open ? "Fechar aqui" : "Experimentar aqui"}
          </button>
        )}
      </span>
    </div>
  );
}
