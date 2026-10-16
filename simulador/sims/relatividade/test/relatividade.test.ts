import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import { RATE, gammaOf, interval, lorentz, relatividade as sim } from "../src/index.ts";

describe("Relatividade restrita", () => {
  it("γ(0,6) = 1,25 e γ(0,8) = 5/3", () => {
    expect(gammaOf(0.6)).toBeCloseTo(1.25, 12);
    expect(gammaOf(0.8)).toBeCloseTo(5 / 3, 12);
  });

  it("Lorentz: o intervalo é invariante e a transformação inversa é β → −β", () => {
    const a = { x: -1.3, ct: 0.7 };
    const b = { x: 2.1, ct: 3.4 };
    for (const beta of [-0.9, -0.3, 0.2, 0.75]) {
      expect(interval(lorentz(a, beta), lorentz(b, beta))).toBeCloseTo(interval(a, b), 10);
      const back = lorentz(lorentz(b, beta), -beta);
      expect(back.x).toBeCloseTo(b.x, 12);
      expect(back.ct).toBeCloseTo(b.ct, 12);
    }
    // A origem de S' anda com x = βct
    const w = lorentz({ x: 0.6 * 2, ct: 2 }, 0.6);
    expect(w.x).toBeCloseTo(0, 12);
    expect(w.ct).toBeCloseTo(2 / 1.25, 12);
  });

  it("simultâneos em S: cΔt' = −γβΔx", () => {
    const r = new Runner(sim, withOverrides(sim, { beta: 0.6, eventos: 0 }));
    expect(r.value("dt")).toBe(0);
    expect(r.value("dtp")).toBeCloseTo(-1.25 * 0.6 * 3, 12);
  });

  it("dilatação: τ = t/γ ao longo da animação; s² fica constante quando β muda ao vivo", () => {
    const r = new Runner(sim, withOverrides(sim, { beta: 0.8, eventos: 1 }));
    while (r.t < 6 - 1e-9) r.stepOnce();
    expect(r.value("T")).toBeCloseTo(6 * RATE, 9);
    expect(r.value("tau")).toBeCloseTo((6 * RATE * 3) / 5, 9);
    const s2 = r.value("s2");
    r.setLiveParams({ ...r.params, beta: -0.5 });
    expect(r.value("s2")).toBeCloseTo(s2, 10);
  });

  it("contração: L = L₀/γ", () => {
    const r = new Runner(sim, withOverrides(sim, { beta: Math.sqrt(3) / 2, L0: 2 }));
    expect(r.value("L")).toBeCloseTo(1, 10);
  });

  it("eventos são arrastáveis", () => {
    const p = withOverrides(sim, { eventos: 0 });
    let s = sim.init(p);
    s = sim.pointer!.down!(s, p, { x: -1.1, y: 2.05 })!;
    expect(s.drag).toBe(0);
    s = sim.pointer!.move!(s, p, { x: 0.5, y: 3 }, true)!;
    expect(s.ev[0]).toEqual({ x: 0.5, ct: 3 });
    expect(sim.pointer!.up!(s, p, { x: 0, y: 0 })!.drag).toBe(-1);
  });
});
