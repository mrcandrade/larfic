/**
 * Progresso do aluno guardado no navegador (sims visitadas, previsões e
 * exercícios). É uma conveniência local: a Fase 3 sincroniza com a conta.
 */
export interface SimProgress {
  visited: boolean;
  predictions: number;
  exercisesTried: number;
  exercisesCorrect: number;
  lastVisit?: string;
}

const KEY = "fisilab.progress.v1";

function load(): Record<string, SimProgress> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, SimProgress>;
  } catch {
    return {};
  }
}

function save(all: Record<string, SimProgress>) {
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // Armazenamento indisponível (modo privado): o progresso só não persiste.
  }
  listeners.forEach((l) => l());
}

const listeners = new Set<() => void>();

export function onProgressChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getProgress(): Record<string, SimProgress> {
  return load();
}

function update(simId: string, fn: (p: SimProgress) => void) {
  const all = load();
  const p = all[simId] ?? { visited: false, predictions: 0, exercisesTried: 0, exercisesCorrect: 0 };
  fn(p);
  all[simId] = p;
  save(all);
}

export const progress = {
  visit: (simId: string) =>
    update(simId, (p) => {
      p.visited = true;
      p.lastVisit = new Date().toISOString();
    }),
  prediction: (simId: string) => update(simId, (p) => void p.predictions++),
  exercise: (simId: string, correct: boolean) =>
    update(simId, (p) => {
      p.exercisesTried++;
      if (correct) p.exercisesCorrect++;
    }),
};
