import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import {
  R_MIN,
  estadosMateria as sim,
  initMD,
  kinetic,
  ljF,
  ljU,
  localPhases,
  meanPressure,
  potential,
  stepMD,
  stepPair,
  temperature,
} from "../src/index.ts";

describe("estados da matéria (LJ 2D)", () => {
  it("potencial de Lennard-Jones: mínimo −ε em 2^(1/6)σ, U(σ) = 0 e F = −dU/dr", () => {
    expect(ljU(R_MIN)).toBeCloseTo(-1, 12);
    expect(ljU(1)).toBeCloseTo(0, 12);
    expect(ljF(R_MIN)).toBeCloseTo(0, 10);
    for (const r of [0.95, 1.3, 2]) {
      const h = 1e-6;
      expect(ljF(r)).toBeCloseTo(-(ljU(r + h) - ljU(r - h)) / (2 * h), 5);
    }
  });

  it("sistema isolado (Verlet): energia total conservada", () => {
    let s = initMD(36, 12, 0.5, 5);
    const e0 = kinetic(s) + potential(s);
    for (let i = 0; i < 150; i++) s = stepMD(s, { L: 12, g: 0, thermostat: false });
    const e1 = kinetic(s) + potential(s);
    expect(Math.abs(e1 - e0) / s.x.length).toBeLessThan(0.02);
  });

  it("gás diluído: pressão medida nas paredes ≈ NkT/A (gás ideal 2D)", () => {
    let s = initMD(30, 30, 2, 9);
    for (let i = 0; i < 600; i++) s = stepMD(s, { L: 30, g: 0, thermostat: true });
    const Pid = (30 * 2) / (29 * 29);
    expect(meanPressure(s) / Pid).toBeGreaterThan(0.85);
    expect(meanPressure(s) / Pid).toBeLessThan(1.15);
  });

  it("termostato leva à temperatura do banho; frio fica sólido, quente perde a ordem", () => {
    let frio = initMD(49, 14, 0.15, 2);
    for (let i = 0; i < 200; i++) frio = stepMD(frio, { L: 14, g: 0.03, thermostat: true });
    expect(temperature(frio)).toBeCloseTo(0.15, 1);
    expect(localPhases(frio).psi6).toBeGreaterThan(0.6);
    let quente = { ...frio, Tset: 1.5 };
    for (let i = 0; i < 300; i++) quente = stepMD(quente, { L: 14, g: 0.03, thermostat: true });
    expect(localPhases(quente).psi6).toBeLessThan(0.45);
    expect(quente.P).toBeGreaterThan(frio.P);
  });

  it("dois átomos: energia conservada sem perdas; com perdas param em r₀", () => {
    let [r, v] = [1.6, 0];
    const E0 = ljU(r);
    for (let i = 0; i < 500; i++) [r, v] = stepPair(r, v, 0.01, 0);
    expect(0.5 * v * v + ljU(r)).toBeCloseTo(E0, 4);
    for (let i = 0; i < 3000; i++) [r, v] = stepPair(r, v, 0.01, 0.8);
    expect(r).toBeCloseTo(R_MIN, 3);
  });

  it("modo de dois átomos no runner: oscilação ligada com E < 0", () => {
    const run = new Runner(sim, withOverrides(sim, { modo: 1, r0: 1.5 }));
    let rmax = 0, rmin = 9;
    for (let i = 0; i < 400; i++) {
      run.stepOnce();
      rmax = Math.max(rmax, run.state.r2);
      rmin = Math.min(rmin, run.state.r2);
    }
    expect(run.value("E")).toBeLessThan(0);
    expect(rmax).toBeCloseTo(1.5, 2);
    expect(rmin).toBeLessThan(R_MIN);
  });
});
