import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import { ressonancia as sim, phaseLag, resonanceOmega, steadyAmplitude } from "../src/index.ts";

const run = (r: Runner, t: number) => {
  while (r.t < t - 1e-9) r.stepOnce();
};

/** Amplitude medida (máximo de |x|) num intervalo, já em regime permanente. */
function measuredAmplitude(r: Runner, duration: number): number {
  let a = 0;
  const t1 = r.t + duration;
  while (r.t < t1) {
    r.stepOnce();
    a = Math.max(a, Math.abs(r.value("x")));
  }
  return a;
}

describe("ressonancia", () => {
  it("amplitude de regime permanente coincide com A(ω) analítica", () => {
    for (const w of [2, 5, 8]) {
      const p = withOverrides(sim, { m: 1, k: 25, b: 2, F0: 3, w });
      const r = new Runner(sim, p);
      run(r, 15); // γ = 1 s⁻¹: transiente ~ e^{−15}
      const expected = 3 / Math.hypot(25 - w * w, 2 * w);
      expect(steadyAmplitude(p)).toBeCloseTo(expected, 12);
      expect(measuredAmplitude(r, (2 * Math.PI) / w + 0.01)).toBeCloseTo(expected, 4);
      // e o transiente sumiu
      expect(Math.abs(r.value("xh"))).toBeLessThan(1e-5);
    }
  });

  it("fase: δ = 90° em ω₀, → 0 abaixo e → 180° acima; ω_r = √(ω₀² − 2γ²)", () => {
    const p = withOverrides(sim, { m: 1, k: 25, b: 2 });
    expect(phaseLag(p, 5)).toBeCloseTo(Math.PI / 2, 12);
    expect(phaseLag(p, 0.5)).toBeLessThan(0.05);
    expect(phaseLag(p, 50)).toBeGreaterThan(Math.PI - 0.05);
    expect(resonanceOmega(p)).toBeCloseTo(Math.sqrt(25 - 2), 12);
    // o pico de A(ω) está mesmo em ω_r
    const wr = resonanceOmega(p);
    expect(steadyAmplitude(p, wr)).toBeGreaterThan(steadyAmplitude(p, wr * 1.01));
    expect(steadyAmplitude(p, wr)).toBeGreaterThan(steadyAmplitude(p, wr * 0.99));
  });

  it("potência média fornecida = dissipada = ½F₀ωA sen δ, e o balanço de energia fecha", () => {
    const p = withOverrides(sim, { m: 1, k: 25, b: 2, F0: 3, w: 4 });
    const r = new Runner(sim, p);
    run(r, 20);
    const T = (2 * Math.PI) / 4;
    const W0 = r.value("Win"), D0 = r.value("Wd");
    run(r, 20 + 10 * T);
    const Pin = (r.value("Win") - W0) / (10 * T);
    const Pd = (r.value("Wd") - D0) / (10 * T);
    expect(Pin).toBeCloseTo(r.value("Pmed"), 4);
    expect(Pd).toBeCloseTo(r.value("Pmed"), 4);
    // ½ b ω² A²
    expect(r.value("Pmed")).toBeCloseTo(0.5 * 2 * 16 * steadyAmplitude(p) ** 2, 10);
    expect(Math.abs(r.value("bal"))).toBeLessThan(1e-8);
  });

  it("batimento perto da ressonância: envoltória pulsa com período 2π/|ω − ω_d|", () => {
    const p = withOverrides(sim, { m: 1, k: 25, b: 1e-3, F0: 1, w: 4.5 });
    const r = new Runner(sim, p);
    const wd = Math.sqrt(25 - (5e-4) ** 2);
    const Tb = (2 * Math.PI) / Math.abs(4.5 - wd);
    // No meio do batimento a amplitude é máxima (≈ 2A); no fim de um período de batimento, mínima (≈ 0)
    run(r, Tb / 2 - 1);
    const big = measuredAmplitude(r, 2);
    run(r, Tb - 1);
    const small = measuredAmplitude(r, 2);
    const A = steadyAmplitude(p);
    expect(big).toBeGreaterThan(1.7 * A);
    expect(small).toBeLessThan(0.5 * A);
  });
});
