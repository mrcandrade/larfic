import { useEffect, useMemo, useState } from "react";
import type { Course } from "@fisilab/core";
import { SimView, getProgress, onProgressChange } from "@fisilab/ui-kit";
import { catalog, findSim, pending } from "./catalog.ts";
import { plan } from "./plan.ts";
import { paramsFromQuery, simHref, useRoute } from "./router.ts";

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
    document.title = sim ? `${sim.title} · FisiLab` : "FisiLab · Simulador";
  }, [route.simId]);

  if (embed && route.page === "sim") return <SimPage simId={route.simId!} query={route.query} embed />;

  return (
    <div className="app">
      <header className="topbar">
        <a className="brand" href="#/">
          FisiLab
        </a>
        <span className="subtitle">Laboratório virtual de física para engenharia</span>
        <ThemeToggle />
      </header>
      <main className="content">
        {route.page === "sim" && route.simId ? <SimPage simId={route.simId} query={route.query} /> : <CatalogPage />}
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
        const later = planned.filter((p) => p.course === c.id);
        if (!items.length && !later.length) return null;
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
  if (!sim) {
    return (
      <div className="notfound">
        <h1>Simulação não encontrada</h1>
        <p>
          <a href="#/">Voltar ao catálogo</a>
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
          <a href="#/">Catálogo</a> <span aria-hidden>›</span> {sim.course} <span aria-hidden>›</span> {sim.title}
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
      <SimView
        key={sim.id}
        sim={sim}
        embed={embed}
        initialScenario={query.get("cenario") ?? undefined}
        initialParams={paramsFromQuery(query)}
        locked={locked}
        onParamsChange={(params, scenario) => {
          if (embed) return;
          const q = new URLSearchParams();
          if (scenario) q.set("cenario", scenario);
          for (const [k, v] of Object.entries(params)) q.set(`p.${k}`, String(v));
          if (locked?.length) q.set("travar", locked.join(","));
          history.replaceState(null, "", simHref(sim.id, q));
        }}
      />
    </>
  );
}
