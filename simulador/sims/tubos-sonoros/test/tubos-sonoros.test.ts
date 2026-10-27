import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import { tubosSonoros as sim } from "../src/index.ts";
import { freq, profile, soundSpeed } from "../src/physics.ts";

describe("tubos-sonoros", () => {
  it("velocidade do som: 331,3 m/s a 0 °C e ≈ 343,2 m/s a 20 °C", () => {
    expect(soundSpeed(0)).toBeCloseTo(331.3, 6);
    expect(soundSpeed(20)).toBeCloseTo(343.2, 1);
  });

  it("tubo aberto: f₁ = v/2L e série harmônica completa 1:2:3", () => {
    const p = withOverrides(sim, { tipo: 0, L: 0.5, T: 20, r: 0 });
    const v = soundSpeed(20);
    expect(freq(p, 1)).toBeCloseTo(v / 1, 9);
    expect(freq(p, 2) / freq(p, 1)).toBeCloseTo(2, 12);
    expect(freq(p, 3) / freq(p, 1)).toBeCloseTo(3, 12);
  });

  it("tubo fechado numa ponta: f₁ = v/4L e só harmônicos ímpares 1:3:5", () => {
    const p = withOverrides(sim, { tipo: 1, L: 0.5, T: 20, r: 0 });
    expect(freq(p, 1)).toBeCloseTo(soundSpeed(20) / 2, 9);
    expect(freq(p, 2) / freq(p, 1)).toBeCloseTo(3, 12);
    expect(freq(p, 3) / freq(p, 1)).toBeCloseTo(5, 12);
    // Ventre de pressão e nó de deslocamento na ponta fechada; nó de pressão na boca
    const n = withOverrides(sim, { tipo: 1, L: 0.5, n: 2 });
    expect(profile(n, 0).s).toBeCloseTo(0, 12);
    expect(Math.abs(profile(n, 0).p)).toBeCloseTo(1, 12);
    expect(profile(n, 0.5).p).toBeCloseTo(0, 12);
  });

  it("cone: série completa e Δp ∝ sen(kx)/kx com nó de pressão na boca", () => {
    const p = withOverrides(sim, { tipo: 2, L: 0.6, T: 15, r: 0, n: 3 });
    expect(freq(p, 3) / freq(p, 1)).toBeCloseTo(3, 12);
    const k = (3 * Math.PI) / 0.6;
    const x = 0.17;
    expect(profile(p, x).p).toBeCloseTo(-Math.sin(k * x) / (k * x), 10);
    expect(profile(p, 0.6).p).toBeCloseTo(0, 10);
  });

  it("perfis obedecem Δp = −∂s/∂x (tubo aberto com correção de extremidade)", () => {
    const p = withOverrides(sim, { tipo: 0, L: 0.8, r: 2, n: 2 });
    const k = (2 * Math.PI * freq(p, 2)) / soundSpeed(20);
    const h = 1e-6;
    for (const x of [0.1, 0.33, 0.61]) {
      const ds = (profile(p, x + h).s - profile(p, x - h).s) / (2 * h);
      expect(profile(p, x).p).toBeCloseTo(-ds / k, 6);
    }
    // A correção de extremidade (0,61 r por boca) baixa a nota
    expect(freq(p, 1)).toBeLessThan(freq(withOverrides(sim, { tipo: 0, L: 0.8, r: 0 }), 1));
  });

  it("som: toca f_n com ganho do espectro e silencia quando desligado", () => {
    const p = withOverrides(sim, { tipo: 1, instr: 2, n: 2, som: 1 });
    const tone = sim.tone!(p, [0.5]);
    expect(tone.freq).toBeCloseTo(freq(p, 2), 9);
    expect(tone.gain).toBeCloseTo(0.15 * 0.72, 9);
    expect(sim.tone!({ ...p, som: 0 }, [0.5]).gain).toBe(0);
    const r = new Runner(sim, p);
    r.stepOnce();
    expect(Number.isFinite(r.value("pmic"))).toBe(true);
  });
});
