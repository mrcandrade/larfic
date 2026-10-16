import { describe, expect, it } from "vitest";
import { EPS0, Runner, withOverrides } from "@fisilab/core";
import {
  B0Of,
  bandOf,
  C,
  capacitance,
  capEnergy,
  capPowerIn,
  dipoleIntensity,
  dipolePower,
  E0Of,
  espectroEm as sim,
  photonEnergyEV,
  poyntingInst,
  radiationPressure,
  tauRC,
  type Cap,
} from "../src/index.ts";

describe("Espectro eletromagnético e vetor de Poynting", () => {
  it("onda plana: E₀/B₀ = c, I = ½cε₀E₀² e pressão de radiação", () => {
    const I = 1361;
    expect(E0Of(I) / B0Of(I)).toBeCloseTo(C, 3);
    expect(0.5 * C * EPS0 * E0Of(I) ** 2).toBeCloseTo(I, 9);
    expect(E0Of(I)).toBeCloseTo(1012.6, 0);
    expect(radiationPressure(I, false)).toBeCloseTo(I / C, 15);
    expect(radiationPressure(I, true) / radiationPressure(I, false)).toBe(2);
  });

  it("média temporal do vetor de Poynting instantâneo é I", () => {
    const n = 1000;
    let acc = 0;
    for (let i = 0; i < n; i++) acc += poyntingInst(500, (2 * Math.PI * (i + 0.5)) / n);
    expect(acc / n).toBeCloseTo(500, 9);
  });

  it("energia do fóton e faixas do espectro", () => {
    expect(photonEnergyEV(550e-9)).toBeCloseTo(2.254, 3);
    expect(photonEnergyEV(1239.84198e-9)).toBeCloseTo(1, 6);
    expect(bandOf(550e-9).name).toBe("Luz visível");
    expect(bandOf(0.122).name).toBe("Micro-ondas");
    expect(bandOf(1e-12).name).toBe("Raios gama");
    expect(bandOf(3).name).toBe("Ondas de rádio");
    expect(bandOf(254e-9).name).toBe("Ultravioleta");
  });

  it("dipolo: integral de I(θ) r² dΩ é a potência total p₀²ω⁴/(12πε₀c³)", () => {
    const p0 = 1e-9, l = 1, r = 50;
    let P = 0;
    const n = 2000;
    for (let i = 0; i < n; i++) {
      const th = (Math.PI * (i + 0.5)) / n;
      P += dipoleIntensity(p0, l, r, th) * r * r * 2 * Math.PI * Math.sin(th) * (Math.PI / n);
    }
    expect(P / dipolePower(p0, l)).toBeCloseTo(1, 5);
    // ω⁴: metade de λ, 16 vezes a potência.
    expect(dipolePower(p0, 0.5) / dipolePower(p0, 1)).toBeCloseTo(16, 9);
  });

  it("capacitor: fluxo de Poynting pela borda = dU/dt e U(∞) = ½CV₀²", () => {
    const c: Cap = { a: 0.1, d: 1e-3, V0: 500, R: 1e10 };
    const tau = tauRC(c);
    for (const t of [0.1 * tau, tau, 2.5 * tau]) {
      const h = tau * 1e-5;
      const dUdt = (capEnergy(c, t + h) - capEnergy(c, t - h)) / (2 * h);
      expect(capPowerIn(c, t) / dUdt).toBeCloseTo(1, 6);
    }
    expect(capEnergy(c, 60 * tau) / (0.5 * capacitance(c) * 500 ** 2)).toBeCloseTo(1, 9);
    const r = new Runner(sim, withOverrides(sim, { modo: 2 }));
    for (let i = 0; i < 50; i++) r.stepOnce();
    expect(r.value("Pin")).toBeGreaterThan(0);
  });
});
