import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import {
  airy,
  beamRadius,
  cavityMode,
  etherShift,
  finesse,
  fpTransmission,
  interferometros as sim,
  michelsonReading,
  radiusFromG,
  ringRadii,
  traceRay,
  wavefrontR,
  type IntState,
} from "../src/index.ts";

const base: IntState = { dfp: 0, xB: 25, dMW: 20, marca: 25, alpha: 0, g1: 0.5, g2: 0.5, drag: null };

describe("Interferômetros", () => {
  it("Airy: máximos unitários, mínimo (1−R)²/(1+R)² e finesse = FSR/largura", () => {
    const R = 0.9;
    expect(airy(0, R)).toBeCloseTo(1, 12);
    expect(airy(Math.PI, R)).toBeCloseTo((1 - R) ** 2 / (1 + R) ** 2, 12);
    // largura à meia altura em fase: 4 asin(1/√F) ≈ 2π/𝓕
    const F = (4 * R) / (1 - R) ** 2;
    const fwhm = 4 * Math.asin(1 / Math.sqrt(F));
    expect(airy(fwhm / 2, R)).toBeCloseTo(0.5, 10);
    expect((2 * Math.PI) / fwhm).toBeCloseTo(finesse(R), 1);
  });

  it("anéis: 2d cos θ = mλ e raios crescentes ≈ √p", () => {
    const d = 2e-3;
    const l = 632.8e-9;
    const f = 0.2;
    const r = ringRadii(d, l, f, 0.05);
    expect(r.length).toBeGreaterThan(4);
    for (const ri of r.slice(0, 5)) {
      const m = (2 * d * Math.cos(Math.atan(ri / f))) / l;
      expect(Math.abs(m - Math.round(m))).toBeLessThan(1e-6);
    }
    // espaçamento quadrático: r_p² − r_{p−1}² ≈ constante = f² λ/d
    expect(r[3]! ** 2 - r[2]! ** 2).toBeCloseTo(r[2]! ** 2 - r[1]! ** 2, 7);
    expect(r[3]! ** 2 - r[2]! ** 2).toBeCloseTo((f * f * l) / d, 6);
  });

  it("micro-ondas: máximos a cada λ/2 do refletor; Fabry–Perot com picos a cada λ/2", () => {
    const p = withOverrides(sim, { modo: 1, lamMW: 2.85, tp: 0 });
    expect(michelsonReading({ ...base, xB: 25 }, p)).toBeCloseTo(1, 12);
    const r1 = michelsonReading({ ...base, xB: 25 + 2.85 / 2 }, p);
    expect(r1).toBeGreaterThan(0.9);
    expect(michelsonReading({ ...base, xB: 25 + 2.85 / 4 }, p)).toBeLessThan(0.01);
    expect(fpTransmission(10 * 1.425, 2.85, 0.6)).toBeCloseTo(1, 10);
    expect(fpTransmission(10 * 1.425 + 0.7125, 2.85, 0.6)).toBeCloseTo(0.16 / (0.16 + 2.4), 10);
  });

  it("Michelson–Morley: 0,4 franja para L = 11 m, v = 30 km/s, λ = 550 nm", () => {
    const tot = etherShift(11, 3e4, 550e-9, 0) - etherShift(11, 3e4, 550e-9, 90);
    expect(tot).toBeCloseTo((2 * 11 * 9e8) / (550e-9 * 299792458 ** 2), 12);
    expect(tot).toBeCloseTo(0.4, 1);
    const r = new Runner(sim, withOverrides(sim, { modo: 3, hip: 0, omega: 10 }));
    for (let i = 0; i < 300; i++) r.stepOnce();
    expect(r.state.alpha).toBeCloseTo(100, 6);
    expect(Math.abs(r.value("Nobs"))).toBeLessThan(0.011);
  });

  it("cavidade: confocal z_R = L/2, frente de onda casa com os espelhos, estabilidade do traçado", () => {
    const L = 0.3;
    const conf = cavityMode(1e-9, 1e-9, L, 1064e-9);
    expect(conf.zR).toBeCloseTo(L / 2, 6);
    for (const [g1, g2] of [[0.5, 0.5], [0.3, 0.8], [-0.6, -0.4], [0.9, 0.2]]) {
      const m = cavityMode(g1!, g2!, L, 633e-9);
      expect(m.stable).toBe(true);
      expect(m.z1 + m.z2).toBeCloseTo(L, 12);
      // R(z) da gaussiana igual ao raio do espelho
      expect(wavefrontR(m.zR, m.z2)).toBeCloseTo(radiusFromG(g2!, L), 9);
      expect(-wavefrontR(m.zR, -m.z1)).toBeCloseTo(radiusFromG(g1!, L), 9);
      expect(beamRadius(m.w0, m.zR, m.z2)).toBeCloseTo(m.w2, 15);
    }
    expect(cavityMode(1.2, 0.9, L, 633e-9).stable).toBe(false);
    expect(traceRay(0.5, 0.5, L, 0.3, 0.002, 60, 1).length).toBe(61);
    expect(traceRay(1.3, 1.3, L, 0.3, 0.002, 60, 1).length).toBeLessThan(61);
  });
});
