import { describe, expect, it } from "vitest";
import { Runner, rad, withOverrides } from "@fisilab/core";
import {
  LAMBDA_C,
  R_E,
  comptonShift,
  findShiftedPeak,
  fitShift,
  kinematics,
  kleinNishina,
  ME_C2,
  scatteredLambda,
  compton as sim,
} from "../src/index.ts";

describe("Efeito Compton", () => {
  it("Δλ = (h/mc)(1 − cos θ): 0 em 0°, λC em 90°, 2λC em 180°", () => {
    expect(comptonShift(0)).toBeCloseTo(0, 12);
    expect(comptonShift(Math.PI / 2)).toBeCloseTo(2.4263, 4);
    expect(comptonShift(Math.PI)).toBeCloseTo(2 * LAMBDA_C, 12);
    expect(scatteredLambda(71.1, Math.PI / 3)).toBeCloseTo(71.1 + LAMBDA_C / 2, 12);
  });

  it("cinemática conserva energia e momento relativísticos (elétron)", () => {
    for (const th of [0.3, 1, 2, 3]) {
      const k = kinematics(20, th);
      // E_e² = (pc)² + (mc²)² com E_e = K + mc²
      expect((k.K + ME_C2) ** 2 / (k.pe ** 2 + ME_C2 ** 2)).toBeCloseTo(1, 9);
      // tan φ = sin θ / (λ'/λ − cos θ)
      const r = scatteredLambda(20, th) / 20;
      expect(Math.tan(-k.phi)).toBeCloseTo(Math.sin(th) / (r - Math.cos(th)), 9);
    }
  });

  it("Klein–Nishina tende a Thomson (r_e²) em θ = 0 e cai para trás", () => {
    expect(kleinNishina(71.1, 0)).toBeCloseTo(R_E * R_E, 40);
    expect(kleinNishina(71.1, Math.PI / 2)).toBeLessThan(0.5 * R_E * R_E);
    expect(kleinNishina(10, Math.PI)).toBeLessThan(kleinNishina(71.1, Math.PI));
  });

  it("o espectro simulado tem o pico deslocado no lugar certo", () => {
    const r = new Runner(sim, withOverrides(sim, { theta: 120, lambda0: 71.1, alvo: 0 }));
    for (let i = 0; i < 200; i++) r.stepOnce();
    const peak = findShiftedPeak(r.state.counts, 71.1, rad(120));
    expect(peak).toBeCloseTo(71.1 + comptonShift(rad(120)), 1);
  });

  it("varredura automática + ajuste recupera h/mc e h", () => {
    const p = withOverrides(sim, { lambda0: 71.1, alvo: 1 });
    const r = new Runner(sim, p);
    const s = sim.actions!.find((a) => a.id === "varredura")!.run(r.state, p);
    expect(s.pts.length).toBe(6);
    const f = fitShift(s.pts)!;
    expect(f.slope).toBeCloseTo(LAMBDA_C, 1);
    expect(Math.abs(f.h - 6.626e-34) / 6.626e-34).toBeLessThan(0.03);
  });

  it("o arrasto do detector muda θ e zera a contagem", () => {
    const p = withOverrides(sim, {});
    const r = new Runner(sim, p);
    for (let i = 0; i < 20; i++) r.stepOnce();
    const s1 = sim.pointer!.down!(r.state, p, { x: 5.2, y: 8.6 + 3.4 })!;
    const s2 = sim.pointer!.move!(s1, p, { x: 5.2 - 3, y: 8.6 + 0.001 }, true)!;
    expect(s2.theta).toBe(180);
    r.setState(s2);
    r.stepOnce();
    expect(r.state.elapsed).toBeCloseTo(0.05, 9);
  });
});
