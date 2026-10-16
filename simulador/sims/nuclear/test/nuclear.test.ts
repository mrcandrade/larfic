import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import {
  CHANNELS,
  core,
  coulombBarrier,
  fissionJPerKg,
  fissionQ,
  fragmentEnergies,
  fusionQ,
  gamowPeakKeV,
  initChain,
  kEff,
  measuredK,
  nuclear as sim,
  semfB,
  stableZ,
  stepChain,
  tunnelP,
  uraniumMassKg,
} from "../src/index.ts";

const meanK = (e: number, mod: number, rods: number, R: number, steps = 260, skip = 80) => {
  const c = core(e, mod, rods);
  let s = initChain(R, 11);
  let acc = 0;
  for (let i = 0; i < steps; i++) {
    s = stepChain(s, c, R);
    if (i >= skip) acc += measuredK(s);
  }
  return acc / (steps - skip);
};

describe("Física nuclear", () => {
  it("Weizsäcker: B/A ≈ 8,8 MeV no ferro, máximo perto de A ≈ 56–62 e 7,6 MeV no urânio", () => {
    expect(Math.abs(semfB(56, 26) / 56 / 8.79 - 1)).toBeLessThan(0.015);
    expect(Math.abs(semfB(238, 92) / 238 / 7.57 - 1)).toBeLessThan(0.015);
    let best = 0;
    let aMax = 0;
    for (let A = 10; A <= 250; A++) {
      const v = semfB(A, stableZ(A)) / A;
      if (v > best) [best, aMax] = [v, A];
    }
    expect(aMax).toBeGreaterThanOrEqual(50);
    expect(aMax).toBeLessThanOrEqual(66);
    expect(stableZ(56)).toBe(26);
    expect(stableZ(208)).toBe(82);
  });

  it("fissão: Q pelo defeito de massa ≈ 173 MeV e ≈ 7 × 10¹³ J/kg; leve leva mais energia", () => {
    expect(fissionQ(CHANNELS[0]!)).toBeCloseTo(173.3, 0);
    expect(fissionQ(CHANNELS[1]!)).toBeCloseTo(184.7, 0);
    const J = fissionJPerKg(fissionQ(CHANNELS[0]!));
    expect(J).toBeGreaterThan(6.9e13);
    expect(J).toBeLessThan(7.3e13);
    const E = fragmentEnergies(CHANNELS[0]!, 167);
    expect(E.heavy + E.light).toBeCloseTo(167, 10);
    expect(E.light / E.heavy).toBeCloseTo(140.914411 / 91.9261565, 10);
  });

  it("fusão D–T: Q = 17,6 MeV, barreira ≈ 0,44 MeV, pico de Gamow ≈ 31 keV a 10 keV", () => {
    expect(fusionQ()).toBeCloseTo(17.59, 2);
    expect(coulombBarrier(1, 2, 1, 3)).toBeCloseTo(0.444, 2);
    expect(gamowPeakKeV(10)).toBeCloseTo(30.9, 0);
    expect(tunnelP(10)).toBeLessThan(1e-4);
    expect(tunnelP(100)).toBeGreaterThan(tunnelP(10) * 100);
    // o pico de Gamow é o máximo de e^{−E/kT − √(E_G/E)}
    const f = (E: number) => -E / 10 - Math.sqrt(1182.44 / E);
    const E0 = gamowPeakKeV(10);
    expect(f(E0)).toBeGreaterThan(f(E0 * 0.95));
    expect(f(E0)).toBeGreaterThan(f(E0 * 1.05));
  });

  it("criticalidade (difusão): k(R_c) = 1, massa crítica de dezenas de kg e urânio natural rápido nunca crítico", () => {
    const c = core(1, 0, 0);
    expect(kEff(c, c.Rc)).toBeCloseTo(1, 10);
    expect(c.Rc).toBeGreaterThan(7);
    expect(c.Rc).toBeLessThan(12);
    expect(uraniumMassKg(c.Rc)).toBeGreaterThan(30);
    expect(uraniumMassKg(c.Rc)).toBeLessThan(110);
    expect(core(0.0072, 0, 0).kInf).toBeLessThan(1);
    expect(core(0.0072, 1, 0).kInf).toBeGreaterThan(1);
    expect(core(0.0072, 2, 0).kInf).toBeLessThan(1);
    expect(core(0.03, 2, 0).kInf).toBeGreaterThan(1);
    expect(core(1, 0, 1).kInf).toBeLessThan(core(1, 0, 0).kInf);
  });

  it("Monte Carlo: meio infinito reproduz k∞; esfera pequena é subcrítica e grande, supercrítica", () => {
    const c = core(1, 0, 0);
    expect(meanK(1, 0, 0, 1e7) / c.kInf).toBeCloseTo(1, 1);
    expect(Math.abs(meanK(0.03, 2, 0, 1e7) / core(0.03, 2, 0).kInf - 1)).toBeLessThan(0.05);
    const small = meanK(1, 0, 0, 0.5 * c.Rc);
    const big = meanK(1, 0, 0, 2 * c.Rc);
    expect(small).toBeLessThan(0.85);
    expect(big).toBeGreaterThan(1.15);
    expect(Math.abs(small - kEff(c, 0.5 * c.Rc))).toBeLessThan(0.15);
  });

  it("o runner faz a população crescer quando supercrítico e cair com as barras", () => {
    const grow = new Runner(sim, withOverrides(sim, { tema: 2, R: 20, barras: 0 }));
    for (let i = 0; i < 120; i++) grow.stepOnce();
    expect(grow.value("logN")).toBeGreaterThan(4);
    const die = new Runner(sim, withOverrides(sim, { tema: 2, R: 20, barras: 1 }));
    for (let i = 0; i < 120; i++) die.stepOnce();
    expect(die.value("logN")).toBeLessThan(2);
  });
});
