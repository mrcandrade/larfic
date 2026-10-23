import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import { GASES, cRot, cVib, cv, calorEspecificoGases as sim } from "../src/index.ts";

const H2 = GASES[0]!;

describe("Calor específico dos gases e graus de liberdade", () => {
  it("limites: rotação e vibração congeladas a baixa T e clássicas (R) a alta T", () => {
    expect(cRot(87.6, 10)).toBeLessThan(0.01);
    expect(cRot(87.6, 5000)).toBeCloseTo(1, 2);
    expect(cVib(6332, 300)).toBeLessThan(1e-6);
    expect(cVib(6332, 1e6)).toBeCloseTo(1, 4);
  });

  it("H₂: 3/2 R a 20 K, 5/2 R a 300 K e perto de 7/2 R a 10 000 K", () => {
    expect(cv(H2, 20).total).toBeCloseTo(1.5, 1);
    expect(cv(H2, 300).total).toBeCloseTo(2.5, 1);
    expect(cv(H2, 10000).total).toBeGreaterThan(3.4);
    // a curva sobe em degraus (o rotor tem um pequeno pico, de ~0,1 R, perto de Θr)
    let prev = 0;
    for (let T = 10; T <= 10000; T *= 1.2) {
      const c = cv(H2, T).total;
      expect(c).toBeGreaterThan(prev - 0.12);
      prev = c;
    }
  });

  it("monoatômico fica em 3/2 R; Cl₂ já vibra a 300 K; γ do H₂ a 300 K ≈ 7/5", () => {
    expect(cv(GASES[3]!, 5000).total).toBe(1.5);
    expect(cv(GASES[2]!, 300).vib).toBeGreaterThan(0.4);
    const r = new Runner(sim, withOverrides(sim, { gas: 0, T: 300 }));
    expect(r.value("gamma")).toBeCloseTo(1.4, 2);
  });
});
