import type { Sample } from "./runner.ts";
import type { VarSpec } from "./simulation.ts";

/** CSV com tempo e observáveis, cabeçalho com unidades SI. Separador vírgula, ponto decimal. */
export function samplesToCsv(sim: { observables: VarSpec[] }, samples: Sample<unknown>[]): string {
  const header = ["t (s)", ...sim.observables.map((o) => (o.unit ? `${o.label} (${o.unit})` : o.label))];
  const quote = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const rows = samples.map((s) => [s.t, ...s.values].map((v) => String(v)).join(","));
  return [header.map(quote).join(","), ...rows].join("\n") + "\n";
}
