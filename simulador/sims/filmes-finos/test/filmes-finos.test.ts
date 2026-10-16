import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import {
  BOLHA,
  CUNHA,
  MICHELSON,
  NEWTON,
  darkRingRadius,
  filmReflectance,
  filmesFinos as sim,
  fringeCount,
  newtonGap,
} from "../src/index.ts";

describe("Filmes finos, Newton e Michelson", () => {
  it("Michelson: deslocar o espelho de Δx faz passar N = 2Δx/λ franjas e mede λ", () => {
    const p = withOverrides(sim, { exp: MICHELSON, lambda: 633, motor: 0.5 });
    const r = new Runner(sim, p);
    while (r.t < 20 - 1e-9) r.stepOnce();
    expect(r.value("x")).toBeCloseTo(10, 6);
    const N = r.value("N");
    expect(Math.abs(N - (2 * 10e-6) / 633e-9)).toBeLessThanOrEqual(1);
    expect(Math.abs(r.value("lamMed") - 633) / 633).toBeLessThan(0.04);
  });

  it("Michelson: encher a célula de ar mede n − 1 ≈ 2,72 × 10⁻⁴", () => {
    const p = withOverrides(sim, { exp: MICHELSON, lambda: 633, bomba: 10, gas: 0, Lc: 5 });
    const r = new Runner(sim, p);
    while (r.state.p < 101.325) r.stepOnce();
    const expected = (2 * 2.72e-4 * 0.05) / 633e-9; // ≈ 43
    expect(Math.abs(r.value("N") - expected)).toBeLessThanOrEqual(1);
    expect(Math.abs(r.value("nm1") - 2.72e-4) / 2.72e-4).toBeLessThan(0.04);
  });

  it("película de sabão no ar: preta quando e → 0, clara em 2ne = λ/2", () => {
    expect(filmReflectance(1, 1.33, 1, 0, 550)).toBeCloseTo(0, 12);
    const e = 550 / (4 * 1.33);
    const r12 = (1 - 1.33) / 2.33;
    const Rmax = ((2 * Math.abs(r12)) / (1 + r12 * r12)) ** 2;
    expect(filmReflectance(1, 1.33, 1, e, 550)).toBeCloseTo(Rmax, 10);
    // Camada antirreflexo λ/4 com n = √1,52 anula a reflexão
    const n = Math.sqrt(1.52);
    expect(filmReflectance(1, n, 1.52, 550 / (4 * n), 550)).toBeLessThan(1e-12);
  });

  it("anéis de Newton: escuros em r = √(mλR), e = r²/2R", () => {
    const r3 = darkRingRadius(3, 589, 2);
    expect(r3).toBeCloseTo(Math.sqrt(3 * 589e-9 * 2) * 1e3, 10);
    const e = newtonGap(r3, 2, 0);
    expect(e).toBeCloseTo((3 * 589) / 2, 6);
    expect(filmReflectance(1.52, 1, 1.52, e, 589)).toBeLessThan(1e-12);
    // Erguer a lente de λ/2 faz o anel m virar o anel m−1
    expect(darkRingRadius(4, 589, 2, 589 / 2)).toBeCloseTo(r3, 10);
  });

  it("motor ergue a lente e os anéis somem no centro", () => {
    const r = new Runner(sim, withOverrides(sim, { exp: NEWTON, motor: 0.2 }));
    while (r.t < 5 - 1e-9) r.stepOnce();
    expect(r.value("e")).toBeCloseTo(1000, 3);
    expect(r.value("r1")).toBeCloseTo(darkRingRadius(4, 633, 2, 1000), 9);
  });

  it("ponteiro: arrastar o espelho, o calço e a sonda", () => {
    const p = withOverrides(sim, { exp: MICHELSON });
    let s = sim.init(p);
    s = sim.pointer!.down!(s, p, { x: 10.7, y: 0 })!;
    s = sim.pointer!.move!(s, p, { x: 11.7, y: 0 }, true)!;
    expect(s.x).toBeCloseTo(4, 9);
    expect(fringeCount(s, p)).toBeGreaterThan(10);

    const pc = withOverrides(sim, { exp: CUNHA });
    let w = sim.init(pc);
    w = sim.pointer!.down!(w, pc, { x: 18.6, y: 4 })!;
    expect(w.drag).toBe("cunha");
    w = sim.pointer!.move!(w, pc, { x: 18.6, y: 3.5 + 0.25 + 0.12 * 10 }, true)!;
    expect(w.wedge).toBeCloseTo(10, 9);

    const pb = withOverrides(sim, { exp: BOLHA });
    const b = sim.pointer!.down!(sim.init(pb), pb, { x: 6, y: 5.5 })!;
    expect(b.probe).toBeCloseTo(0, 9);
  });
});
