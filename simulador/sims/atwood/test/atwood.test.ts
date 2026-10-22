import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import { atwood as sim, dynamics } from "../src/index.ts";

const dyn = (p: Record<string, number>) => dynamics([0, 0], withOverrides(sim, p));

describe("Atwood", () => {
  it("aceleração clássica e trações iguais com polia leve", () => {
    const d = dyn({ arranjo: 0, m1: 1, m2: 3, Mp: 0 });
    expect(d.a).toBeCloseTo((2 * 9.81) / 4, 12);
    expect(d.T1).toBeCloseTo(d.T2, 12);
  });

  it("polia pesada: T2 − T1 = (M/2) a", () => {
    const d = dyn({ arranjo: 0, m1: 1, m2: 3, Mp: 2 });
    expect(d.T2 - d.T1).toBeCloseTo(1 * d.a, 12);
  });

  it("mesa com atrito alto não se move", () => {
    const r = new Runner(sim, withOverrides(sim, { arranjo: 1, m1: 3, m2: 1, mu: 0.5 }));
    for (let i = 0; i < 1000; i++) r.stepOnce();
    expect(r.value("x")).toBe(0);
  });

  it("x(t) = a t²/2 até o fim do curso", () => {
    const r = new Runner(sim, withOverrides(sim, { arranjo: 1, m1: 2, m2: 1, mu: 0.1 }));
    while (r.t < 0.5 - 1e-9) r.stepOnce();
    const a = (1 * 9.81 - 0.1 * 2 * 9.81) / 3;
    expect(r.value("x")).toBeCloseTo(0.5 * a * 0.25, 6);
  });
});
