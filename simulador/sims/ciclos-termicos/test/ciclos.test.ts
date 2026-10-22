import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import { buildCycle, ciclosTermicos as sim, cycleParams, cycleTotals } from "../src/index.ts";

function totals(ciclo: number, extra: Record<string, number> = {}) {
  const p = withOverrides(sim, { ciclo, ...extra });
  const c = buildCycle(ciclo, cycleParams(p));
  return { ...cycleTotals({ n: p.n!, gamma: p.gamma! }, c), theory: c.theory.value, c };
}

describe("ciclos térmicos", () => {
  it.each([0, 1, 2, 4])("ciclo %i: eficiência medida = fórmula teórica", (ciclo) => {
    const t = totals(ciclo);
    expect(t.W / t.Qin).toBeCloseTo(t.theory, 9);
  });

  it("Stirling sem regenerador fica abaixo de Carnot", () => {
    const t = totals(3);
    expect(t.W / t.Qin).toBeLessThan(t.theory);
  });

  it("primeira lei: W = Qin − Qout em todos os ciclos", () => {
    for (const ciclo of [0, 1, 2, 3, 4]) {
      const t = totals(ciclo);
      expect(t.W).toBeCloseTo(t.Qin - t.Qout, 6);
    }
  });

  it("os ciclos fecham: o último estado é o primeiro", () => {
    for (const ciclo of [0, 1, 2, 3, 4]) {
      const { c } = totals(ciclo);
      const a = c.segments[0]!.from;
      const b = c.segments[3]!.to;
      expect(b.P).toBeCloseTo(a.P, 6);
      expect(b.V).toBeCloseTo(a.V, 12);
      expect(b.T).toBeCloseTo(a.T, 6);
    }
  });

  it("o runner percorre um ciclo completo e a eficiência acumulada bate", () => {
    const r = new Runner(sim, withOverrides(sim, { ciclo: 1 })).runToEnd(100);
    expect(r.finished).toBe(true);
    expect(r.value("eta")).toBeCloseTo(r.value("etaT"), 6);
  });
});
