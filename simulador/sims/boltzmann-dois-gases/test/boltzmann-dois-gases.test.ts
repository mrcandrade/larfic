import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import { boltzP, fitKT, gasT, kTeps, levelCounts, boltzmannDoisGases as sim } from "../src/index.ts";

const run = (over: Record<string, number>, steps: number) => {
  const r = new Runner(sim, withOverrides(sim, over));
  for (let i = 0; i < steps; i++) r.stepOnce();
  return r;
};

describe("Distribuição de Boltzmann e dois gases em contato", () => {
  it("as trocas aleatórias conservam os quanta e levam à distribuição de Boltzmann", () => {
    const r = run({ modo: 0, N: 1500, qbar: 2, ini: 0 }, 400);
    expect(r.state.q.reduce((a, b) => a + b, 0)).toBe(3000);
    expect(fitKT(r.state.avg, 1500)).toBeCloseTo(kTeps(2), 0);
    expect(Math.abs(fitKT(r.state.avg, 1500) / kTeps(2) - 1)).toBeLessThan(0.08);
    const c = levelCounts(r.state.q);
    expect(c[0]! / 1500).toBeGreaterThan(boltzP(0, 2) - 0.05);
    expect(c[0]! / 1500).toBeLessThan(boltzP(0, 2) + 0.05);
  });

  it("kT/ε = 1/ln(1 + 1/q̄) e a distribuição geométrica é normalizada com média q̄", () => {
    expect(kTeps(2)).toBeCloseTo(1 / Math.log(1.5), 12);
    let s = 0, m = 0;
    for (let n = 0; n < 400; n++) {
      s += boltzP(n, 3);
      m += n * boltzP(n, 3);
    }
    expect(s).toBeCloseTo(1, 10);
    expect(m).toBeCloseTo(3, 8);
  });

  it("parede livre: energia conservada e temperaturas convergem para (N_A T_A + N_B T_B)/(N_A + N_B)", () => {
    const r = run({ modo: 1, NA: 80, NB: 80, TA: 900, TB: 150, parede: 0, M: 20, mA: 4, mB: 40 }, 1);
    const E0 = r.value("E");
    for (let i = 0; i < 1500; i++) r.stepOnce();
    expect(Math.abs(r.value("E") / E0 - 1)).toBeLessThan(1e-9);
    // média temporal das últimas 300 ps
    let a = 0, b = 0;
    for (let i = 0; i < 300; i++) {
      r.stepOnce();
      a += gasT(r.state, 0, 4);
      b += gasT(r.state, 1, 40);
    }
    expect(Math.abs(a / 300 - 525) / 525).toBeLessThan(0.15);
    expect(Math.abs(b / 300 - 525) / 525).toBeLessThan(0.15);
  });

  it("Avogadro: com P e T iguais, A_A/A_B = N_A/N_B independentemente das massas", () => {
    const r = run({ modo: 1, NA: 120, NB: 60, TA: 400, TB: 400, parede: 0, M: 40, mA: 4, mB: 131 }, 400);
    let ratio = 0;
    for (let i = 0; i < 600; i++) {
      r.stepOnce();
      ratio += r.value("razA");
    }
    expect(ratio / 600).toBeGreaterThan(1.6);
    expect(ratio / 600).toBeLessThan(2.5);
  });

  it("parede adiabática fixa: cada gás conserva sua energia", () => {
    const r = run({ modo: 1, NA: 60, NB: 60, TA: 800, TB: 200, parede: 2 }, 300);
    expect(r.value("TA")).toBeCloseTo(800, 6);
    expect(r.value("TB")).toBeCloseTo(200, 6);
  });
});
