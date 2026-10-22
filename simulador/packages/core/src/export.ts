import type { Sample } from "./runner.ts";
import type { Simulation } from "./simulation.ts";

/** CSV com tempo e observáveis, cabeçalho com unidades SI. Separador vírgula, ponto decimal. */
export function samplesToCsv(sim: Simulation, samples: Sample[]): string {
  const header = ["t (s)", ...sim.observables.map((o) => `${o.label} (${o.unit})`)];
  const quote = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const rows = samples.map((s) => [s.t, ...s.values].map((v) => String(v)).join(","));
  return [header.map(quote).join(","), ...rows].join("\n") + "\n";
}
