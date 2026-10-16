import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import { cinematica1d as sim, presetProfile, BINS, T_MAX } from "../src/index.ts";

describe("Cinemática 1D", () => {
  it("MRUV: x = x0 + v0 t + a t²/2", () => {
    const r = new Runner(sim, withOverrides(sim, { modo: 0, a: 1.5, x0: -10, v0: 2 }));
    while (r.t < 4 - 1e-9) r.stepOnce();
    expect(r.value("x")).toBeCloseTo(-10 + 2 * 4 + 0.5 * 1.5 * 16, 6);
    expect(r.value("v")).toBeCloseTo(2 + 1.5 * 4, 6);
  });

  it("perfil acelera-cruzeiro-freia: v de cruzeiro = área sob a(t)", () => {
    const prof = presetProfile(2);
    expect(prof).toHaveLength(BINS);
    const r = new Runner(sim, withOverrides(sim, { modo: 2, x0: -25, v0: 0 }));
    while (r.t < 5 - 1e-9) r.stepOnce();
    expect(r.value("v")).toBeCloseTo(6, 2);
    while (r.t < T_MAX - 1e-9) r.stepOnce();
    expect(r.value("v")).toBeCloseTo(6 - 1.5 * 3, 2);
  });

  it("desenhar a(t) no palco altera o perfil", () => {
    const p = withOverrides(sim, { modo: 1 });
    const s0 = sim.init(p);
    const s1 = sim.pointer!.down!(s0, p, { x: -13.9, y: -4 }, undefined as never);
    expect(s1).toBeDefined();
    expect((s1 as typeof s0).prof[0]).toBeGreaterThan(3);
  });
});
