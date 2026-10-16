import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import { X0, doppler as sim, dopplerFreq, machAngle, measuredFreq } from "../src/index.ts";

const runUntil = (over: Record<string, number>, t: number) => {
  const r = new Runner(sim, withOverrides(sim, over));
  while (r.t < t - 1e-9 && !r.finished) r.stepOnce();
  return r;
};

describe("efeito Doppler", () => {
  it("fonte se aproximando (colinear): f' = f/(1 − M), medida e fórmula", () => {
    const r = runUntil({ M: 0.5, f0: 4, xo: 300, yo: 0, vo: 0 }, 3);
    expect(measuredFreq(r.state)).toBeCloseTo(8, 3);
    expect(r.value("fTeo")).toBeCloseTo(8, 9);
  });

  it("fonte se afastando: f' = f/(1 + M)", () => {
    const r = runUntil({ M: 0.5, f0: 4, xo: -390, yo: 0, vo: 0 }, 3);
    expect(measuredFreq(r.state)).toBeCloseTo(4 / 1.5, 3);
  });

  it("ouvinte indo em direção à fonte parada: f' = f(c + v_o)/c", () => {
    const r = runUntil({ M: 0, f0: 5, xo: 350, yo: 0, vo: -120, c: 340 }, 3);
    expect(measuredFreq(r.state)).toBeCloseTo((5 * (340 + 120)) / 340, 3);
    expect(dopplerFreq(5, 340, 0, -120, 1)).toBeCloseTo((5 * 460) / 340, 12);
  });

  it("supersônico: sen θ = 1/M e o estrondo chega quando a fonte está h√(M²−1) à frente", () => {
    expect(Math.sin(machAngle(2))).toBeCloseTo(0.5, 12);
    const over = { M: 2, f0: 6, xo: 100, yo: 100, c: 343 };
    const r = runUntil(over, 1.5);
    const tBoom = (100 + 100 * Math.sqrt(3) - X0) / (2 * 343);
    expect(r.state.boomT).toBeCloseTo(tBoom, 4);
    // Antes do estrondo o ouvinte não recebeu nenhuma frente
    const antes = runUntil(over, tBoom - 0.01);
    expect(antes.state.arrivals.length).toBe(0);
  });

  it("subsônico: não há cone nem estrondo", () => {
    const r = runUntil({ M: 0.9, xo: 0, yo: 50 }, 3);
    expect(r.state.boomT).toBe(-1);
  });
});
