import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import { mhs as sim, pendulumLength } from "../src/index.ts";

const run = (r: Runner, t: number) => {
  while (r.t < t - 1e-9) r.stepOnce();
};

describe("mhs", () => {
  it("x(t) = A cos(ωt + φ) com fase inicial arbitrária", () => {
    const p = withOverrides(sim, { m: 2, k: 50, A: 0.2, phi: 60 });
    const r = new Runner(sim, p);
    const w = Math.sqrt(50 / 2);
    run(r, 3);
    expect(r.value("x")).toBeCloseTo(0.2 * Math.cos(w * 3 + Math.PI / 3), 6);
    expect(r.value("v")).toBeCloseTo(-0.2 * w * Math.sin(w * 3 + Math.PI / 3), 5);
    // O ângulo do fasor obtido do estado é ωt + φ (mód 360°)
    const expected = (((w * 3 + Math.PI / 3) * 180) / Math.PI) % 360;
    expect(r.value("fase")).toBeCloseTo(expected, 3);
  });

  it("energia mecânica conservada e igual a ½kA²", () => {
    const r = new Runner(sim, withOverrides(sim, { m: 1, k: 80, A: 0.3, phi: -45 }));
    run(r, 10);
    expect(r.value("E")).toBeCloseTo(0.5 * 80 * 0.09, 6);
  });

  it("pêndulo de comprimento mg/k tem o mesmo período para pequenas amplitudes", () => {
    const p = withOverrides(sim, { modo: 1, m: 1.5, k: 30, A: 0.1, thetaA: 3, phi: 0 });
    expect(pendulumLength(p)).toBeCloseTo((1.5 * 9.81) / 30, 10);
    const r = new Runner(sim, p);
    const T = 2 * Math.PI * Math.sqrt(1.5 / 30);
    run(r, 5 * T);
    // Após 5 períodos, θ volta a θ_A (erro não linear ~ θ²/16 por ciclo)
    expect(r.value("theta")).toBeCloseTo(3, 1);
    expect(r.value("x")).toBeCloseTo(0.1, 5);
  });

  it("pêndulo de grande amplitude se atrasa em relação à mola", () => {
    const p = withOverrides(sim, { modo: 1, m: 1, k: 40, thetaA: 60, phi: 0 });
    const r = new Runner(sim, p);
    const T = 2 * Math.PI * Math.sqrt(1 / 40);
    run(r, T);
    // A mola completou o ciclo; o pêndulo (T maior em ~7%) ainda não chegou de volta a 60°
    expect(r.value("x")).toBeCloseTo(0.25, 5);
    expect(r.value("theta")).toBeLessThan(59);
  });

  it("arrastar o fasor define a fase e congela o movimento até soltar", () => {
    const p = withOverrides(sim, { modo: 0, A: 0.25 });
    const r = new Runner(sim, p);
    // Clique no topo do círculo de referência (centro em (0; 0,55)): fase 90°
    const s1 = sim.pointer!.down!(r.state, p, { x: 0, y: 0.55 + 0.25 })!;
    expect(s1).toBeDefined();
    r.setState(s1);
    expect(r.value("x")).toBeCloseTo(0, 9);
    expect(r.value("v")).toBeCloseTo(-0.25 * Math.sqrt(40), 9);
    for (let i = 0; i < 100; i++) r.stepOnce();
    expect(r.value("x")).toBeCloseTo(0, 9);
    r.setState(sim.pointer!.up!(r.state, p, { x: 0, y: 0.8 })!);
    for (let i = 0; i < 100; i++) r.stepOnce();
    expect(r.value("x")).toBeLessThan(0);
  });
});
