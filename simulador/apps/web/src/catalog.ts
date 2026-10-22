import type { AnySimulation } from "@fisilab/core";
import { projetilArrasto } from "@fisilab/sim-projetil-arrasto";
import { circuitosDc } from "@fisilab/sim-circuitos-dc";
import { ciclosTermicos } from "@fisilab/sim-ciclos-termicos";
import { plan, type PlannedSim } from "./plan.ts";

export interface CatalogEntry {
  sim: AnySimulation;
  /** Títulos do plano (plan.ts) que esta sim cobre. */
  covers: string[];
}

/** Simulações publicadas. Cada nova sim em sims/* entra aqui. */
export const catalog: CatalogEntry[] = [
  { sim: projetilArrasto, covers: ["Lançamento de projéteis", "Arrasto e velocidade terminal (paraquedista)"] },
  { sim: circuitosDc, covers: ["Construtor de circuitos (resistores, fontes, lâmpadas, chaves)"] },
  { sim: ciclosTermicos, covers: ["Ciclos Carnot, Otto, Diesel, Stirling, Rankine, Brayton"] },
];

export const simulations = catalog.map((c) => c.sim);

export function findSim(id: string): AnySimulation | undefined {
  return simulations.find((s) => s.id === id);
}

/** Item do plano ainda sem simulação publicada. */
export function pending(): PlannedSim[] {
  const done = new Set(catalog.flatMap((c) => c.covers));
  return plan.filter((p) => !done.has(p.title));
}

/** Confere, em desenvolvimento, se os títulos de `covers` existem no plano. */
export function unknownCovers(): string[] {
  const titles = new Set(plan.map((p) => p.title));
  return catalog.flatMap((c) => c.covers).filter((t) => !titles.has(t));
}
