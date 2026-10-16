import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import { FONTE, L1, PONTA, XP1, coefR, coefT, grid, ondaCorda as sim } from "../src/index.ts";

const run = (over: Record<string, number>, tMax: number) => {
  const r = new Runner(sim, withOverrides(sim, over));
  while (r.t < tMax - 1e-9) r.stepOnce();
  return r;
};

describe("onda em corda", () => {
  it("velocidade do pulso é √(T/μ): centro passa pela sonda 1 no instante previsto", () => {
    const p = withOverrides(sim, { T: 16, mu1: 0.04, ponta: PONTA.absorvente });
    const g = grid(p);
    expect(g.v1).toBeCloseTo(20, 10);
    const r = new Runner(sim, p);
    let best = 0;
    let tBest = 0;
    while (r.t < 0.5) {
      r.stepOnce();
      const y = r.value("y1");
      if (y > best) [best, tBest] = [y, r.t];
    }
    const tc = 4 * (0.3 / g.v1);
    expect(tBest).toBeCloseTo(tc + XP1 / g.v1, 2);
    expect(best).toBeCloseTo(0.4, 2);
  });

  it("ponta fixa inverte o pulso (R = −1) e ponta livre não (R = +1)", () => {
    const fixa = run({ razao: 1, ponta: PONTA.fixa }, 2.4);
    expect(fixa.value("Rmed")).toBeCloseTo(-1, 2);
    const livre = run({ razao: 1, ponta: PONTA.livre }, 2.4);
    expect(livre.value("Rmed")).toBeCloseTo(1, 2);
  });

  it("emenda leve → pesada: R e τ medidos batem com (Z₁−Z₂)/(Z₁+Z₂) e 2Z₁/(Z₁+Z₂)", () => {
    const over = { razao: 4, ponta: PONTA.absorvente, w: 0.4 };
    const p = withOverrides(sim, over);
    expect(coefR(p)).toBeCloseTo(-1 / 3, 10);
    expect(coefT(p)).toBeCloseTo(2 / 3, 10);
    const r = run(over, 2.5);
    expect(r.value("Rmed")).toBeCloseTo(-1 / 3, 2);
    expect(r.value("Tmed")).toBeCloseTo(2 / 3, 2);
  });

  it("emenda pesada → leve: R = +1/3, τ = 4/3 e a potência Z·A² se conserva", () => {
    const r = run({ razao: 0.25, ponta: PONTA.absorvente, w: 0.4 }, 2.2);
    const R = r.value("Rmed");
    const T = r.value("Tmed");
    expect(R).toBeCloseTo(1 / 3, 2);
    expect(T).toBeCloseTo(4 / 3, 2);
    expect(R * R + 0.5 * T * T).toBeCloseTo(1, 1);
  });

  it("ponta fixa conserva a energia do pulso depois que a fonte para", () => {
    const r = run({ razao: 2, ponta: PONTA.fixa }, 0.45);
    const E0 = r.value("E");
    expect(E0).toBeGreaterThan(0);
    // Ainda dentro das cordas (sem voltar à fonte transparente)
    while (r.t < 0.45 + L1 / grid(r.params).v1) r.stepOnce();
    expect(r.value("E") / E0).toBeCloseTo(1, 2);
  });

  it("ponta absorvente: depois de tudo passar a corda fica em repouso", () => {
    const r = run({ razao: 1, ponta: PONTA.absorvente }, 2.5);
    expect(r.value("E")).toBeLessThan(1e-6);
  });

  it("fonte senoidal produz λ = v/f na corda", () => {
    const r = run({ fonte: FONTE.seno, f: 5, ponta: PONTA.absorvente, razao: 1 }, 3);
    const g = grid(r.params);
    // Cruzamentos por zero (subindo) ao longo da corda 1
    const xs: number[] = [];
    for (let i = 1; i <= g.J; i++) {
      const a = r.state.y[i - 1]!;
      const b = r.state.y[i]!;
      if (a < 0 && b >= 0) xs.push(g.x[i - 1]! + (g.x[i]! - g.x[i - 1]!) * (-a / (b - a)));
    }
    expect(xs.length).toBeGreaterThan(1);
    expect(xs[1]! - xs[0]!).toBeCloseTo(g.v1 / 5, 2);
  });
});
