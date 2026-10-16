import type { Simulation } from "@fisilab/core";
import { projetilArrasto } from "@fisilab/sim-projetil-arrasto";

/** Simulações publicadas. Cada nova sim em sims/* entra aqui. */
export const simulations: Simulation[] = [projetilArrasto];

/** Próximas sims-piloto do plano, exibidas no catálogo como "em breve". */
export const upcoming = [
  { title: "Construtor de circuitos DC", course: "FG III" },
  { title: "Ciclo termodinâmico no diagrama PV", course: "FG II" },
];
