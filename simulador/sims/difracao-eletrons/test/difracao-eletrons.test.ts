import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import { GRAPHITE, dFromRadius, dgAngle, dgIntensity, difracaoEletrons as sim, ringRadius, wavelength } from "../src/index.ts";

describe("Difração de elétrons", () => {
  it("anéis do grafite: r ∝ 1/√V e a régua no anel devolve d₁₀", () => {
    const r4 = ringRadius(wavelength(4e3), GRAPHITE[0]!.d);
    const r9 = ringRadius(wavelength(9e3), GRAPHITE[0]!.d);
    expect(r9 / r4).toBeCloseTo(2 / 3, 2);
    expect(r4 * 1e3).toBeGreaterThan(11.5);
    expect(r4 * 1e3).toBeLessThan(13);
    const p = withOverrides(sim, { V: 6 });
    const s = sim.actions!.find((a) => a.id === "regua-anel")!.run(new Runner(sim, p).state, p);
    const dr = sim.observables.find((o) => o.key === "dregua")!.value(s, p, 0);
    expect(dr).toBeCloseTo(0.213, 6);
    expect(dFromRadius(wavelength(6e3), ringRadius(wavelength(6e3), 0.123e-9)) * 1e9).toBeCloseTo(0.123, 9);
  });

  it("histograma radial das chegadas tem máximos nos raios dos anéis", () => {
    const p = withOverrides(sim, { V: 5 });
    let s = new Runner(sim, p).state;
    const fire = sim.actions!.find((a) => a.id === "mil")!;
    for (let i = 0; i < 2; i++) s = fire.run(s, p);
    const lam = wavelength(5e3);
    const count = (r: number, w: number) => s.hits.filter(([x, y]) => Math.abs(Math.hypot(x, y) - r) < w).length;
    const r10 = ringRadius(lam, GRAPHITE[0]!.d);
    const r11 = ringRadius(lam, GRAPHITE[1]!.d);
    const mid = (r10 + r11) / 2;
    expect(count(r10, 5e-4)).toBeGreaterThan(3 * count(mid, 5e-4));
    expect(count(r11, 5e-4)).toBeGreaterThan(2 * count(mid, 5e-4));
  });

  it("Davisson–Germer: 54 eV → pico perto de 50°, e a 50° o máximo em energia é perto de 54 eV", () => {
    expect(wavelength(54) * 1e9).toBeCloseTo(0.1669, 3);
    expect(dgAngle(54)).toBeGreaterThan(50);
    expect(dgAngle(54)).toBeLessThan(52);
    let best = 0;
    let bestPhi = 0;
    for (let a = 20; a <= 90; a += 0.5) {
      const v = dgIntensity(54, a);
      if (v > best) [best, bestPhi] = [v, a];
    }
    expect(Math.abs(bestPhi - 50.5)).toBeLessThan(2);
    let bestE = 0;
    best = 0;
    for (let e = 30; e <= 90; e += 0.5) {
      const v = dgIntensity(e, 50);
      if (v > best) [best, bestE] = [v, e];
    }
    expect(Math.abs(bestE - 54)).toBeLessThan(3);
    expect(dgIntensity(54, 50)).toBeGreaterThan(2 * dgIntensity(40, 50));
  });

  it("varredura do coletor registra a curva polar", () => {
    const r = new Runner(sim, withOverrides(sim, sim.scenarios[2]!.params));
    for (let i = 0; i < 300; i++) r.stepOnce();
    expect(r.state.phi).toBeCloseTo(70, 6);
    expect(r.state.trace.length).toBe(300);
  });
});
