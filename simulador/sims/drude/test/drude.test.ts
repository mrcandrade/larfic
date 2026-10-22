import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import {
  drude as sim,
  driftSpeed,
  material,
  meanDrift,
  measuredTau,
  relaxationTime,
  resistivity,
  conductivity,
  carrierDensity,
  E_CHARGE,
  M_E,
} from "../src/index.ts";

function run(over: Record<string, number>, steps: number) {
  const r = new Runner(sim, withOverrides(sim, over));
  for (let i = 0; i < steps; i++) r.stepOnce();
  return r;
}

describe("Modelo de Drude e resistividade", () => {
  it("resistividades a 300 K batem com as tabeladas (Cu, Al) e σ = ne²τ/m", () => {
    expect(resistivity(material(0), 300)).toBeCloseTo(1.68e-8, 9);
    expect(resistivity(material(1), 300) / 2.65e-8).toBeCloseTo(1, 1);
    const cu = material(0);
    expect(conductivity(cu, 300)).toBeCloseTo((cu.n300 * E_CHARGE ** 2 * cu.tau300) / M_E, 0);
  });

  it("metal: ρ cresce ~linearmente com T; semicondutor: ρ cai com T", () => {
    const cu = material(0);
    const r = (T: number) => resistivity(cu, T);
    expect(r(600) / r(300)).toBeCloseTo((0.01 + 0.99 * 2) / 1, 6);
    expect((r(500) - r(400)) / (r(300) - r(200))).toBeCloseTo(1, 9);
    const si = material(2);
    expect(resistivity(si, 400)).toBeLessThan(resistivity(si, 300) / 10);
    expect(carrierDensity(si, 300)).toBeCloseTo(1e16, -10);
  });

  it("tempo médio entre colisões medido ≈ τ", () => {
    const r = run({ material: 0, T: 300, E: 1, lupa: 1 }, 3000);
    const tau = relaxationTime(material(0), 300) * 1e15;
    expect(measuredTau(r.state) / tau).toBeCloseTo(1, 1);
  });

  it("deriva média medida ≈ −eEτ/m (com o campo ampliado e convertido de volta)", () => {
    const r = run({ material: 0, T: 300, E: 1, lupa: 1 }, 6000);
    const vd = driftSpeed(material(0), 300, 1);
    const m = -meanDrift(r.state, r.params);
    expect(m / vd).toBeGreaterThan(0.9);
    expect(m / vd).toBeLessThan(1.1);
  });

  it("lei de Ohm: dobrar E dobra a corrente (com a lupa desligada a física é a mesma)", () => {
    const a = run({ material: 0, T: 300, E: 1, lupa: 0 }, 10);
    const b = run({ material: 0, T: 300, E: 2, lupa: 0 }, 10);
    expect(b.value("vdTeo") / a.value("vdTeo")).toBeCloseTo(2, 12);
    // Medido na animação: deriva ∝ campo efetivo.
    const s1 = run({ material: 1, T: 300, E: 1, lupa: 1 }, 5000);
    const vth = s1.value("vth");
    const rel = -meanDrift(s1.state, s1.params) / driftSpeed(material(1), 300, 1);
    expect(rel).toBeGreaterThan(0.88);
    expect(rel).toBeLessThan(1.12);
    expect(vth).toBeGreaterThan(9e4);
  });

  it("supercondutor: ρ(300 K) ≈ 2 µΩ·m, cai com T e zera abaixo de T_c; sem colisões nesse estado", () => {
    const y = material(3);
    expect(resistivity(y, 300) / 2e-6).toBeCloseTo(1, 6);
    expect(resistivity(y, 100)).toBeGreaterThan(0);
    expect(resistivity(y, 100)).toBeLessThan(resistivity(y, 300) / 2);
    expect(resistivity(y, 90)).toBe(0);
    expect(conductivity(y, 90)).toBe(Infinity);
    const r = run({ material: 3, T: 80, E: 1 }, 300);
    expect(measuredTau(r.state)).toBe(0);
    expect(r.state.gas.coll).toBe(0);
    const normal = run({ material: 3, T: 150, E: 1 }, 300);
    expect(normal.state.gas.coll).toBeGreaterThan(0);
  });
});
