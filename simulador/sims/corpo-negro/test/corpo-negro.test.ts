import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import {
  SIGMA,
  WIEN_B,
  blackbodyRGB,
  corpoNegro as sim,
  peakNumeric,
  planck,
  rayleighJeans,
  totalNumeric,
  visibleFraction,
  wienApprox,
} from "../src/index.ts";

describe("radiação de corpo negro", () => {
  it.each([310, 1000, 5778, 12000])("a integral do espectro de Planck a %i K dá σT⁴", (T) => {
    expect(totalNumeric(T) / (SIGMA * T ** 4)).toBeCloseTo(1, 5);
  });

  it.each([300, 2800, 5778, 15000])("o pico numérico obedece a Wien: λ_max T = b (%i K)", (T) => {
    expect((peakNumeric(T) * T) / WIEN_B).toBeCloseTo(1, 6);
  });

  it("Rayleigh–Jeans e Wien são os limites de λ longo e curto da lei de Planck", () => {
    const T = 5000;
    const lp = WIEN_B / T;
    expect(rayleighJeans(lp * 2000, T) / planck(lp * 2000, T)).toBeCloseTo(1, 2);
    expect(wienApprox(lp / 10, T) / planck(lp / 10, T)).toBeCloseTo(1, 9);
    // Catástrofe do ultravioleta: a razão RJ/Planck explode para λ curto.
    expect(rayleighJeans(lp / 5, T) / planck(lp / 5, T)).toBeGreaterThan(1e8);
  });

  it("fração visível: Sol ~40 %, lâmpada ~10 %, corpo humano ~0", () => {
    expect(visibleFraction(5778)).toBeGreaterThan(0.38);
    expect(visibleFraction(5778)).toBeLessThan(0.48);
    expect(visibleFraction(2800)).toBeGreaterThan(0.06);
    expect(visibleFraction(2800)).toBeLessThan(0.15);
    expect(visibleFraction(310)).toBeLessThan(1e-15);
  });

  it("cor aparente: brasa vermelha, Sol quase branco, estrela quente azulada", () => {
    const [r1, g1, b1] = blackbodyRGB(1500);
    expect(r1).toBeCloseTo(1, 6);
    expect(g1).toBeLessThan(0.75);
    expect(b1).toBeLessThan(0.3);
    const [r2, g2, b2] = blackbodyRGB(6500);
    expect(Math.min(r2, g2, b2)).toBeGreaterThan(0.85);
    const [r3, , b3] = blackbodyRGB(15000);
    expect(b3).toBeGreaterThan(r3);
  });

  it("observáveis: potência do corpo humano e potência líquida", () => {
    const p = withOverrides(sim, { T: 310, eps: 0.98, A: 1.8, Tamb: 293 });
    const r = new Runner(sim, p);
    expect(r.value("P")).toBeCloseTo(0.98 * 1.8 * SIGMA * 310 ** 4, 6);
    expect(r.value("Pnet")).toBeCloseTo(0.98 * 1.8 * SIGMA * (310 ** 4 - 293 ** 4), 6);
    expect(r.value("lmax")).toBeCloseTo((WIEN_B / 310) * 1e6, 9);
  });
});
