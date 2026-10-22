import { describe, expect, it } from "vitest";
import { Runner, defaultParams, samplesToCsv } from "@fisilab/core";
import { projetilArrasto as sim, vacuumTrajectory } from "../src/index.ts";

function fly(overrides: Record<string, number>, dt = 1e-3) {
  const params = { ...defaultParams(sim), ...overrides };
  const r = new Runner(sim, params, { dt });
  while (!r.finished && r.t < 120) r.stepOnce();
  return r;
}

describe("projétil com arrasto", () => {
  it("no vácuo, o alcance bate com R = v0² sen(2θ)/g", () => {
    const r = fly({ cd: 0, v0: 30, angulo: 30, h0: 0 });
    const R = (30 ** 2 * Math.sin((2 * 30 * Math.PI) / 180)) / 9.81;
    expect(r.finished).toBe(true);
    expect(r.state[0]).toBeCloseTo(R, 6);
    expect(r.state[1]).toBeCloseTo(0, 9);
  });

  it("com altura inicial, o alcance no vácuo bate com a fórmula geral", () => {
    const p = { cd: 0, v0: 20, angulo: 50, h0: 12 };
    const r = fly(p);
    expect(r.state[0]).toBeCloseTo(vacuumTrajectory({ ...defaultParams(sim), ...p }).range, 6);
  });

  it("E_mec + energia dissipada se conserva com arrasto", () => {
    const r = fly({ cd: 0.47, v0: 40 });
    const totals = r.samples.map((s) => s.values[sim.observables.findIndex((o) => o.key === "Etot")]!);
    const E0 = totals[0]!;
    for (const E of totals) expect(Math.abs(E - E0) / E0).toBeLessThan(1e-9);
  });

  it("o arrasto encurta o alcance", () => {
    expect(fly({ cd: 0.25 }).state[0]).toBeLessThan(fly({ cd: 0 }).state[0]!);
  });

  it("em queda longa, a velocidade tende à velocidade terminal", () => {
    const p = { v0: 0.001, angulo: 90, h0: 50, massa: 0.005, diametro: 0.065, cd: 0.6, rho: 1.225, g: 9.81 };
    const A = Math.PI * (p.diametro / 2) ** 2;
    const vt = Math.sqrt((2 * p.massa * p.g) / (p.rho * p.cd * A));
    const r = fly(p);
    expect(Math.abs(r.state[3]!)).toBeCloseTo(vt, 3);
  });

  it("exporta CSV com cabeçalho em unidades SI", () => {
    const r = fly({});
    const csv = samplesToCsv(sim, r.samples);
    const [header, first] = csv.split("\n");
    expect(header).toContain("t (s)");
    expect(header).toContain("Energia mecânica (J)");
    expect(first?.split(",")).toHaveLength(sim.observables.length + 1);
  });

  it("voltar no tempo restaura um estado gravado", () => {
    const r = fly({});
    const mid = r.samples[Math.floor(r.samples.length / 2)]!;
    r.rewindTo(mid.t);
    expect(r.t).toBe(mid.t);
    expect(r.finished).toBe(false);
    expect(r.state).toEqual(mid.state);
  });
});
