import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import { kEff, leiHooke as sim, period, yEq } from "../src/index.ts";

const P = (o: Record<string, number>) => withOverrides(sim, o);

describe("Lei de Hooke", () => {
  it("k efetivo: uma mola, série e paralelo", () => {
    expect(kEff(P({ arranjo: 0, k1: 20, k2: 30 }))).toBe(20);
    expect(kEff(P({ arranjo: 1, k1: 20, k2: 30 }))).toBeCloseTo(12, 12);
    expect(kEff(P({ arranjo: 2, k1: 20, k2: 30 }))).toBe(50);
  });

  it("oscilação amortecida converge para Δy = mg/k", () => {
    const p = P({ arranjo: 1, k1: 20, k2: 30, m: 0.15, b: 0.4, A0: 0.04, g: 9.79 });
    const r = new Runner(sim, p);
    while (r.t < 30) r.stepOnce();
    expect(r.value("y")).toBeCloseTo((0.15 * 9.79) / 12, 6);
    expect(r.value("yeq")).toBeCloseTo((0.15 * 9.79) / 12, 12);
    expect(r.value("Fel")).toBeCloseTo(r.value("P"), 5);
  });

  it("solução subamortecida analítica", () => {
    const p = P({ arranjo: 0, k1: 25, m: 0.2, b: 0.1, A0: 0.03 });
    const r = new Runner(sim, p);
    while (r.t < 1.5 - 1e-9) r.stepOnce();
    const gam = 0.1 / 0.4, w = Math.sqrt(25 / 0.2 - gam * gam);
    const x = 0.03 * Math.exp(-gam * 1.5) * (Math.cos(w * 1.5) + (gam / w) * Math.sin(w * 1.5));
    expect(r.value("y") - yEq(p)).toBeCloseTo(x, 7);
    expect(period(p)).toBeCloseTo((2 * Math.PI) / w, 12);
  });

  it("massa da mola: período com m + ms/3", () => {
    const p = P({ arranjo: 0, k1: 20, m: 0.05, ms: 0.03, b: 0 });
    expect(period(p)).toBeCloseTo(2 * Math.PI * Math.sqrt(0.06 / 20), 12);
  });
});
