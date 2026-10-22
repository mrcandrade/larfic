import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import { calorimetria as sim, C_ICE, C_WATER, L_F, L_V, mixEquilibrium } from "../src/index.ts";

const P = (o: Record<string, number>) => withOverrides(sim, o);

describe("Calorimetria", () => {
  it("curva de aquecimento: patamar de fusão dura m L_F / P e rampas têm dT/dt = P/(mc)", () => {
    const m = 0.5, Pw = 1500;
    const r = new Runner(sim, P({ modo: 0, m, T0: -20, P: Pw, ritmo: 1 }));
    const tMeltStart = (m * C_ICE * 20) / Pw;
    const tMeltEnd = tMeltStart + (m * L_F) / Pw;
    while (r.value("tf") < tMeltStart / 2) r.stepOnce();
    expect(r.value("T")).toBeCloseTo(-20 + (Pw * r.value("tf")) / (m * C_ICE), 6);
    while (r.value("tf") < (tMeltStart + tMeltEnd) / 2) r.stepOnce();
    expect(r.value("T")).toBe(0);
    expect(r.value("fl")).toBeCloseTo((Pw * r.value("tf") - m * C_ICE * 20) / (m * L_F), 6);
    while (r.value("tf") < tMeltEnd + 10) r.stepOnce();
    expect(r.value("T")).toBeCloseTo((Pw * (r.value("tf") - tMeltEnd)) / (m * C_WATER), 6);
  });

  it("curva termina em 130 °C depois de fornecer todo o calor latente", () => {
    const m = 0.2;
    const r = new Runner(sim, P({ modo: 0, m, T0: -10, P: 3000, ritmo: 200 }));
    r.runToEnd(1e6);
    expect(r.value("T")).toBeCloseTo(130, 4);
    expect(r.value("fv")).toBe(1);
    const Q = m * (C_ICE * 10 + L_F + C_WATER * 100 + L_V + 2010 * 30);
    expect(r.value("Q") * 1000).toBeCloseTo(Q, 0);
  });

  it("cobre na água com calorímetro: T_eq = Σ C_i T_i / Σ C_i e energia conservada", () => {
    const o = { modo: 1, ma: 0.2, Ta: 20, Ccal: 80, corpo: 1, mb: 0.3, Tb: 100, k: 10, kamb: 0, ritmo: 20 };
    const Teq = ((0.2 * C_WATER + 80) * 20 + 0.3 * 385 * 100) / (0.2 * C_WATER + 80 + 0.3 * 385);
    expect(mixEquilibrium(P(o)).T).toBeCloseTo(Teq, 6);
    const r = new Runner(sim, P(o));
    const E0 = r.value("Htot");
    while (r.value("tf") < 400) r.stepOnce();
    expect(r.value("T")).toBeCloseTo(Teq, 3);
    expect(r.value("Tb")).toBeCloseTo(Teq, 3);
    expect(Math.abs(r.value("Htot") - E0)).toBeLessThan(1e-9 * Math.abs(E0) + 1e-9);
  });

  it("gelo em excesso: equilíbrio a 0 °C com a massa restante prevista pelo balanço", () => {
    const o = { modo: 1, ma: 0.2, Ta: 30, Ccal: 80, corpo: 0, mb: 0.15, Tb: -10, k: 10, kamb: 0, ritmo: 50 };
    const eq = mixEquilibrium(P(o));
    const melted = ((0.2 * C_WATER + 80) * 30 - 0.15 * C_ICE * 10) / L_F;
    expect(eq.T).toBe(0);
    expect(eq.iceLeft).toBeCloseTo(0.15 - melted, 9);
    const r = new Runner(sim, P(o));
    while (r.value("tf") < 3000) r.stepOnce();
    expect(r.value("T")).toBeCloseTo(0, 2);
    expect(r.value("fl")).toBeCloseTo(melted / 0.15, 3);
  });

  it("vapor condensando aquece a água muito mais que água líquida a 100 °C", () => {
    const base = { modo: 1, ma: 0.3, Ta: 20, Ccal: 0, corpo: 0, mb: 0.02 };
    const steam = mixEquilibrium(P({ ...base, Tb: 100 })).T;
    const expected = (0.3 * C_WATER * 20 + 0.02 * (L_V + C_WATER * 100)) / (0.32 * C_WATER);
    expect(steam).toBeCloseTo(expected, 6);
    const water = mixEquilibrium(P({ ...base, Tb: 99.999 })).T;
    expect(steam - water).toBeGreaterThan(30);
  });
});
