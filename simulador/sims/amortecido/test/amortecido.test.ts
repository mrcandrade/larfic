import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import { amortecido as sim, analytic, roots } from "../src/index.ts";

const run = (r: Runner, t: number) => {
  while (r.t < t - 1e-9) r.stepOnce();
};

describe("amortecido", () => {
  it("subamortecido segue A e^{−γt} cos(ω_d t + φ)", () => {
    const r = new Runner(sim, withOverrides(sim, { m: 1, k: 25, b: 1.5, x0: 0.25, v0: 0.4 }));
    run(r, 4);
    const g = 0.75, wd = Math.sqrt(25 - g * g);
    const exact = Math.exp(-g * 4) * (0.25 * Math.cos(wd * 4) + ((0.4 + g * 0.25) / wd) * Math.sin(wd * 4));
    expect(r.value("x")).toBeCloseTo(exact, 7);
    expect(r.value("wd")).toBeCloseTo(wd, 10);
  });

  it("crítico e superamortecido batem com a solução analítica (osciladores de comparação)", () => {
    const r = new Runner(sim, withOverrides(sim, { m: 2, k: 50, x0: 0.2, v0: -0.5 }));
    run(r, 1.5);
    const w0 = 5;
    expect(r.value("xCrit")).toBeCloseTo((0.2 + (-0.5 + w0 * 0.2) * 1.5) * Math.exp(-w0 * 1.5), 7);
    expect(r.value("xSuper")).toBeCloseTo(analytic(0.2, -0.5, 2.5 * w0, w0, 1.5), 7);
    expect(r.value("xSub")).toBeCloseTo(analytic(0.2, -0.5, 0.2 * w0, w0, 1.5), 7);
  });

  it("raízes da equação característica nos três regimes", () => {
    const [a, b] = roots(3, 5);
    expect(a).toEqual([-3, 4]);
    expect(b).toEqual([-3, -4]);
    const [c, d] = roots(5, 5);
    expect(c![0]).toBeCloseTo(-5, 12);
    expect(d![0]).toBeCloseTo(-5, 12);
    const [e, f] = roots(13, 5);
    expect(e![0]).toBeCloseTo(-1, 12);
    expect(f![0]).toBeCloseTo(-25, 12);
    // Produto das raízes = ω₀², soma = −2γ
    expect(e![0] * f![0]).toBeCloseTo(25, 10);
  });

  it("energia mecânica + dissipada se conserva e a perda por ciclo ≈ 2π/Q", () => {
    const p = withOverrides(sim, { m: 1, k: 100, b: 0.2, x0: 0.2, v0: 0 });
    const r = new Runner(sim, p);
    const E0 = r.value("E");
    const Q = 10 / 0.2; // √(mk)/b = 50
    const Td = (2 * Math.PI) / Math.sqrt(100 - 0.01);
    run(r, Td);
    expect(r.value("Etot")).toBeCloseTo(E0, 8);
    const loss = (E0 - r.value("E")) / E0;
    // Exato: 1 − e^{−2γT_d}; para Q grande ≈ 2π/Q
    expect(loss).toBeCloseTo(1 - Math.exp(-2 * 0.1 * Td), 4);
    expect(Math.abs(loss / ((2 * Math.PI) / Q) - 1)).toBeLessThan(0.07);
    expect(r.value("Q")).toBeCloseTo(Q, 10);
  });

  it("no superamortecido, mais amortecimento torna o retorno mais lento", () => {
    const t = 2;
    const at = (b: number) => {
      const r = new Runner(sim, withOverrides(sim, { m: 1, k: 25, b, x0: 0.25, v0: 0 }));
      run(r, t);
      return r.value("x");
    };
    expect(at(10)).toBeLessThan(at(20));
    expect(at(20)).toBeLessThan(at(40));
  });
});
