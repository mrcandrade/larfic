import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import {
  EM,
  FINE_COILS,
  TELTRON,
  THOMSON,
  axialB,
  beamYAt,
  circleY,
  emFromRadius,
  helmholtzB,
  razaoEm as sim,
  radiusThrough,
  speed,
  thomsonDeflectionE,
  trajectory,
} from "../src/index.ts";

describe("Razão carga/massa do elétron", () => {
  it("campo de Helmholtz: fórmula do centro coincide com a soma exata de duas espiras", () => {
    const B = helmholtzB(FINE_COILS, 1.5);
    expect(axialB(FINE_COILS, 1.5, 0) / B).toBeCloseTo(1, 10);
    expect(B * 1e3).toBeCloseTo(1.1689, 3);
    // uniformidade: a 0,1R do centro varia menos que 0,1 %
    expect(Math.abs(axialB(FINE_COILS, 1.5, 0.1 * FINE_COILS.R) / B - 1)).toBeLessThan(1e-3);
  });

  it("feixe fino: régua no diâmetro devolve e/m aceito", () => {
    const p = withOverrides(sim, sim.scenarios[0]!.params);
    const r = new Runner(sim, p);
    r.state = sim.actions!.find((a) => a.id === "regua-auto")!.run(r.state, p);
    const o = Object.fromEntries(sim.observables.map((ob) => [ob.key, ob.value(r.state, p, 0)]));
    expect(o.D).toBeCloseTo(9.12, 1);
    expect(o.Dregua! / o.D!).toBeCloseTo(1, 6);
    expect(o.emRegua! / EM).toBeCloseTo(1, 6);
  });

  it("Thomson: deflexão só com E bate com a fórmula; com B = E/v o feixe passa reto", () => {
    const V = 2000;
    const Vp = 300;
    const yE = trajectory(THOMSON, V, Vp, 0).yEnd;
    expect(yE / thomsonDeflectionE(THOMSON, V, Vp)).toBeCloseTo(1, 4);
    const Bbal = Vp / THOMSON.d / speed(V);
    expect(Math.abs(trajectory(THOMSON, V, Vp, Bbal).yEnd)).toBeLessThan(1e-7);
    expect(trajectory(THOMSON, V, Vp, Bbal * 1.2).yEnd).toBeLessThan(0);
  });

  it("Teltron: arco magnético é um círculo de raio mv/(eB) e o raio recuperado dá e/m", () => {
    const V = 3000;
    const B = 1.06e-3;
    const r = speed(V) / (EM * B);
    const beam = trajectory(TELTRON, V, 0, B);
    expect(beam.yEnd / circleY(r, 0.1)).toBeCloseTo(1, 5);
    const rr = radiusThrough(0.1, beam.yEnd);
    expect(emFromRadius(V, B, rr) / EM).toBeCloseTo(1, 4);
  });

  it("só campo elétrico (Teltron, I = 0): parábola y = E x²/(4V)", () => {
    const p = withOverrides(sim, sim.scenarios.find((s) => s.id === "parabola-e")!.params);
    const E = 2000 / TELTRON.d;
    expect(beamYAt(p, 10) / ((E * 0.01) / (4 * 3000)) / 100).toBeCloseTo(1, 4);
    expect(beamYAt(p, 10) / beamYAt(p, 5)).toBeCloseTo(4, 2);
  });

  it("observáveis finitos em todos os modos", () => {
    for (const sc of sim.scenarios) {
      const r = new Runner(sim, withOverrides(sim, sc.params));
      for (let i = 0; i < 20; i++) r.stepOnce();
      for (const v of r.observe()) expect(Number.isFinite(v)).toBe(true);
    }
  });
});
