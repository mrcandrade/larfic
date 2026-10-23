import { useEffect, useMemo, useRef, useState } from "react";
import type { Course } from "@fisilab/core";
import { Bench, SimView, Tutor, getProgress, onProgressChange, useTheme } from "@fisilab/ui-kit";
import { tutorClient } from "./account.ts";
import { AssignmentPage } from "./pages/AssignmentPage.tsx";
import { TeacherPage } from "./pages/TeacherPage.tsx";
import { VideoPage } from "./pages/VideoPage.tsx";
import { SensorPage } from "./pages/SensorPage.tsx";
import { ConceptsPage } from "./pages/ConceptsPage.tsx";
import { ChallengesPage } from "./pages/ChallengesPage.tsx";
import { NotebookPage } from "./pages/NotebookPage.tsx";
import { BookPage } from "./pages/BookPage.tsx";
import { ChapterPage } from "./pages/ChapterPage.tsx";
import { AppendixPage } from "./pages/AppendixPage.tsx";
import { AnswersPage } from "./pages/AnswersPage.tsx";
import { BookIndexPage } from "./pages/BookIndexPage.tsx";
import { chapters, findChapter } from "./livro/sumario.ts";
import { chapterContents } from "./livro/conteudo.ts";
import { findApendice } from "./livro/apendices/index.ts";
import { BOOK_HREF, CATALOG_HREF, bookRefs, chapterHref, groupRefsByChapter } from "./livro/livro.ts";
import { catalog, findSim, pending } from "./catalog.ts";
import { plan } from "./plan.ts";
import { paramsFromQuery, practiceHref, simHref, useRoute } from "./router.ts";
import { findPractice, practices } from "./practices.ts";

const COURSES: { id: Course; name: string }[] = [
  { id: "FG I", name: "Física Geral I · Mecânica" },
  { id: "FG II", name: "Física Geral II · Fluidos, ondas e termodinâmica" },
  { id: "FG III", name: "Física Geral III · Eletromagnetismo" },
  { id: "FG IV", name: "Física Geral IV · Ótica e física moderna" },
  { id: "Exp I", name: "Física Experimental I" },
  { id: "Exp II", name: "Física Experimental II" },
  { id: "Exp III", name: "Física Experimental III" },
];

export function App() {
  const route = useRoute();
  const embed = route.query.get("embed") === "1";

  useEffect(() => {
    const sim = route.simId ? findSim(route.simId) : undefined;
    const pr = route.practiceId ? findPractice(route.practiceId) : undefined;
    const ch = route.page === "chapter" && route.chapter ? findChapter(route.chapter) : undefined;
    const ap = route.page === "appendix" && route.appendixId ? findApendice(route.appendixId) : undefined;
    document.title = sim
      ? `${sim.title} · FisiLab`
      : pr
        ? `${pr.title} · FisiLab`
        : ch
          ? `Cap. ${ch.n} ${ch.title} · FisiLab`
          : ap
            ? `Apêndice ${ap.letra} · FisiLab`
            : route.page === "catalog"
              ? "Simulações · FisiLab"
              : "FisiLab · Física para engenharia";
  }, [route.simId, route.practiceId, route.page, route.chapter, route.appendixId]);

  if (embed && route.page === "sim") return <SimPage simId={route.simId!} query={route.query} embed />;

  return (
    <div className="app">
      <header className="topbar">
        <a className="brand" href={BOOK_HREF}>
          FisiLab
        </a>
        <span className="subtitle">Laboratório virtual de física para engenharia</span>
        <nav className="nav-links" aria-label="Seções">
          <a className="nav-link" href={BOOK_HREF}>
            Livro
          </a>
          <a className="nav-link" href={CATALOG_HREF}>
            Simulações
          </a>
          <a className="nav-link" href="#/concepcoes">
            Concepções
          </a>
          <a className="nav-link" href="#/desafios">
            Desafios
          </a>
          <a className="nav-link" href="#/video">
            Vídeo
          </a>
          <a className="nav-link" href="#/sensores">
            Sensores
          </a>
          <a className="nav-link" href="#/notebook">
            Notebook
          </a>
          <a className="nav-link" href="#/professor">
            Professor
          </a>
        </nav>
        <ThemeToggle />
      </header>
      <main className="content">
        {route.page === "sim" && route.simId ? (
          <SimPage simId={route.simId} query={route.query} />
        ) : route.page === "practice" && route.practiceId ? (
          <PracticePage id={route.practiceId} />
        ) : route.page === "teacher" ? (
          <TeacherPage query={route.query} />
        ) : route.page === "video" ? (
          <VideoPage />
        ) : route.page === "sensors" ? (
          <SensorPage />
        ) : route.page === "notebook" ? (
          <NotebookPage />
        ) : route.page === "concepts" ? (
          <ConceptsPage id={route.conceptId} />
        ) : route.page === "challenges" ? (
          <ChallengesPage id={route.challengeId} />
        ) : route.page === "assignment" && route.code ? (
          <AssignmentPage code={route.code} query={route.query} />
        ) : route.page === "catalog" ? (
          <CatalogPage />
        ) : route.page === "chapter" && route.chapter ? (
          <ChapterPage n={route.chapter} sectionId={route.sectionId} />
        ) : route.page === "appendix" && route.appendixId ? (
          <AppendixPage id={route.appendixId} />
        ) : route.page === "answers" ? (
          <AnswersPage chapter={route.chapter} />
        ) : route.page === "bookIndex" ? (
          <BookIndexPage />
        ) : (
          <BookPage />
        )}
      </main>
    </div>
  );
}

function ThemeToggle() {
  const [theme, setTheme] = useState<string>(() => {
    try {
      return localStorage.getItem("fisilab.theme") ?? "auto";
    } catch {
      return "auto";
    }
  });
  useEffect(() => {
    if (theme === "auto") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("fisilab.theme", theme);
    } catch {
      /* preferência só não persiste */
    }
  }, [theme]);
  return (
    <label className="theme-toggle">
      Tema
      <select value={theme} onChange={(e) => setTheme(e.target.value)}>
        <option value="auto">Automático</option>
        <option value="light">Claro</option>
        <option value="dark">Escuro</option>
        <option value="contrast">Alto contraste</option>
      </select>
    </label>
  );
}

function useProgress() {
  const [p, setP] = useState(getProgress);
  useEffect(() => onProgressChange(() => setP(getProgress())), []);
  return p;
}

function CatalogPage() {
  const [query, setQuery] = useState("");
  const [course, setCourse] = useState<Course | "">("");
  const progress = useProgress();
  const todo = useMemo(pending, []);
  const q = query.trim().toLowerCase();
  const match = (...texts: string[]) => !q || texts.some((t) => t.toLowerCase().includes(q));

  const published = catalog.filter(
    ({ sim }) => (!course || sim.course === course) && match(sim.title, sim.topic, sim.summary),
  );
  const planned = todo.filter((p) => (!course || p.course === course) && match(p.title, p.topic));

  return (
    <div className="catalog-page">
      <section className="hero">
        <h1>Simulações de física para engenharia</h1>
        <p>
          {catalog.length} simulações publicadas de {plan.length} planejadas, com gráficos ao vivo, exportação de dados,
          roteiros guiados e exercícios corrigidos na hora.
        </p>
        <div className="filters">
          <input type="search" placeholder="Buscar por tema ou simulação" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Buscar" />
          <select value={course} onChange={(e) => setCourse(e.target.value as Course | "")} aria-label="Disciplina">
            <option value="">Todas as disciplinas</option>
            {COURSES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </section>

      {COURSES.filter((c) => !course || c.id === course).map((c) => {
        const items = published.filter(({ sim }) => sim.course === c.id);
        const labs = practices.filter((p) => p.course === c.id && match(p.title, p.objective));
        const later = planned.filter((p) => p.course === c.id);
        if (!items.length && !later.length && !labs.length) return null;
        const total = plan.filter((p) => p.course === c.id).length;
        const done = total - todo.filter((p) => p.course === c.id).length;
        return (
          <section key={c.id} className="course">
            <header>
              <h2>{c.name}</h2>
              <span className="count">
                {done} de {total} no ar
              </span>
            </header>
            {items.length > 0 && (
              <ul className="cards">
                {items.map(({ sim }) => {
                  const pr = progress[sim.id];
                  return (
                    <li key={sim.id}>
                      <a className="card" href={simHref(sim.id)}>
                        <span className="card-topic">
                          {sim.topic} · {sim.priority}
                        </span>
                        <strong>{sim.title}</strong>
                        <span className="card-summary">{sim.summary}</span>
                        {pr?.visited && (
                          <span className="card-progress">
                            {pr.exercisesCorrect > 0 ? `${pr.exercisesCorrect} exercício(s) certo(s)` : "Visitada"}
                          </span>
                        )}
                      </a>
                    </li>
                  );
                })}
              </ul>
            )}
            {labs.length > 0 && (
              <ul className="cards">
                {labs.map((p) => {
                  const sim = findSim(p.sim);
                  return (
                    <li key={p.id}>
                      <a className="card" href={practiceHref(p.id)}>
                        <span className="card-topic">Prática · {sim?.title ?? p.sim}</span>
                        <strong>{p.title}</strong>
                        <span className="card-summary">{p.objective}</span>
                      </a>
                    </li>
                  );
                })}
              </ul>
            )}
            {later.length > 0 && (
              <details className="planned">
                <summary>Próximas nesta disciplina ({later.length})</summary>
                <ul>
                  {later.map((p) => (
                    <li key={p.title}>
                      <span className="badge">{p.priority}</span> {p.title} <span className="muted">· {p.topic}</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </section>
        );
      })}
    </div>
  );
}

function SimPage({ simId, query, embed }: { simId: string; query: URLSearchParams; embed?: boolean }) {
  const sim = findSim(simId);
  const [copied, setCopied] = useState("");
  // Modo apresentação (?apresentar=1): guardado num ref para entrar na URL junto com os parâmetros.
  const presenting = useRef(!embed && query.get("apresentar") === "1");
  if (!sim) {
    return (
      <div className="notfound">
        <h1>Simulação não encontrada</h1>
        <p>
          <a href={CATALOG_HREF}>Voltar ao catálogo</a>
        </p>
      </div>
    );
  }
  const locked = query.get("travar")?.split(",").filter(Boolean);

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(""), 2000);
    } catch {
      prompt("Copie:", text);
    }
  };
  const base = `${location.origin}${location.pathname}`;

  return (
    <>
      {!embed && (
        <nav className="crumbs">
          <a href={CATALOG_HREF}>Simulações</a> <span aria-hidden>›</span> {sim.course} <span aria-hidden>›</span> {sim.title}
          {query.get("concepcao") && (
            <>
              {" "}
              <a className="back-concept" href={`#/concepcoes/${encodeURIComponent(query.get("concepcao")!)}`}>
                ← Voltar à concepção
              </a>
            </>
          )}
          <span className="share">
            <button onClick={() => copy(base + location.hash, "link")}>{copied === "link" ? "Link copiado" : "Copiar link"}</button>
            <button
              onClick={() =>
                copy(
                  `<iframe src="${base}${simHref(sim.id)}?embed=1" width="100%" height="720" style="border:0" title="${sim.title}"></iframe>`,
                  "embed",
                )
              }
            >
              {copied === "embed" ? "Código copiado" : "Incorporar"}
            </button>
          </span>
        </nav>
      )}
      {!embed && <InTheBook simId={sim.id} />}
      <SimView
        key={sim.id}
        sim={sim}
        embed={embed}
        initialScenario={query.get("cenario") ?? undefined}
        initialParams={paramsFromQuery(query)}
        locked={locked}
        present={presenting.current}
        autoplay={query.get("rodar") === "1"}
        onPresentChange={(on) => {
          presenting.current = on;
          const q = new URLSearchParams(location.hash.split("?")[1] ?? "");
          if (on) q.set("apresentar", "1");
          else q.delete("apresentar");
          history.replaceState(null, "", simHref(sim.id, q));
        }}
        sidebar={embed ? undefined : ({ runner, scenarioId }) => <Tutor runner={runner} scenarioId={scenarioId} client={tutorClient()} />}
        onParamsChange={(params, scenario) => {
          if (embed) return;
          const q = new URLSearchParams();
          if (scenario) q.set("cenario", scenario);
          for (const [k, v] of Object.entries(params)) q.set(`p.${k}`, String(v));
          if (locked?.length) q.set("travar", locked.join(","));
          if (presenting.current) q.set("apresentar", "1");
          const concept = query.get("concepcao");
          if (concept) q.set("concepcao", concept);
          history.replaceState(null, "", simHref(sim.id, q));
        }}
      />
    </>
  );
}

function PracticePage({ id }: { id: string }) {
  const practice = findPractice(id);
  const theme = useTheme();
  const sim = practice ? findSim(practice.sim) : undefined;
  if (!practice || !sim) {
    return (
      <div className="notfound">
        <h1>Prática não encontrada</h1>
        <p>
          <a href={CATALOG_HREF}>Voltar ao catálogo</a>
        </p>
      </div>
    );
  }
  return (
    <>
      <nav className="crumbs">
        <a href={CATALOG_HREF}>Simulações</a> <span aria-hidden>›</span> {practice.course} <span aria-hidden>›</span> {practice.title}
      </nav>
      <SimView
        key={practice.id}
        sim={sim}
        initialScenario={practice.scenario}
        initialParams={practice.params}
        locked={practice.locked}
        sidebar={({ runner, scenarioId }) => (
          <>
            <Bench practice={practice} runner={runner} theme={theme} tutor={tutorClient()} />
            <Tutor runner={runner} scenarioId={scenarioId} client={tutorClient()} />
          </>
        )}
      />
    </>
  );
}

/** "No livro: Cap. 2, seção 2-7 …": onde a simulação aparece nos capítulos escritos. */
function InTheBook({ simId }: { simId: string }) {
  const refs = useMemo(() => bookRefs(chapters, chapterContents, simId), [simId]);
  if (!refs.length) return null;
  const groups = groupRefsByChapter(refs);
  return (
    <p className="in-the-book">
      <span className="in-the-book-label">No livro:</span>{" "}
      {groups.map((g, i) => (
        <span key={g.chapter}>
          {i > 0 && "; "}
          <a href={chapterHref(g.chapter)}>
            Cap. {g.chapter} ({g.chapterTitle})
          </a>
          {g.refs.length === 1 ? ", seção " : ", seções "}
          {g.refs.map((r, j) => (
            <span key={r.href}>
              {j > 0 && ", "}
              <a href={r.href} title={r.sectionTitle}>
                {g.refs.length === 1 ? `${r.sectionId} ${r.sectionTitle}` : r.sectionId}
              </a>
            </span>
          ))}
        </span>
      ))}
    </p>
  );
}
