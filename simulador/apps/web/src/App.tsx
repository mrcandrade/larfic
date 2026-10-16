import { useState } from "react";
import { simulations, upcoming } from "./catalog.ts";
import { SimView } from "./components/SimView.tsx";

export function App() {
  const [selected, setSelected] = useState(simulations[0]!.id);
  const sim = simulations.find((s) => s.id === selected)!;

  return (
    <div className="app">
      <header className="topbar">
        <span className="brand">FiSi Lab</span>
        <span className="subtitle">Laboratório virtual de física para engenharia</span>
      </header>
      <nav className="catalog" aria-label="Catálogo de simulações">
        <h2>Catálogo</h2>
        <ul>
          {simulations.map((s) => (
            <li key={s.id}>
              <button className={s.id === selected ? "active" : ""} onClick={() => setSelected(s.id)}>
                <span className="course">{s.course}</span>
                {s.title}
              </button>
            </li>
          ))}
          {upcoming.map((u) => (
            <li key={u.title}>
              <button disabled>
                <span className="course">{u.course}</span>
                {u.title} <em>(em breve)</em>
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <main className="content">
        <SimView key={sim.id} sim={sim} />
      </main>
    </div>
  );
}
