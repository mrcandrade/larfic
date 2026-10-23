import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import {
  velocidadeLuz as sim, AU, ARCSEC, C0, V_EARTH, aberration, distEJ, fizeauFirst, fizeauI, foucaultShift, galileoResult, galileoTrial, romerFit, eclipse, tubeMiss,
} from "../src/index.ts";

describe("Medindo a velocidade da luz", () => {
  it("Galileu: o atraso da luz (µs) some na dispersão do tempo de reação", () => {
    const trials = Array.from({ length: 2000 }, (_, i) => galileoTrial(i, 1.5, 0.2, 0.03, C0));
    const g = galileoResult(trials, 1.5);
    expect(g.near.mean).toBeCloseTo(0.4, 2);
    expect(g.far.sd).toBeGreaterThan(0.03);
    expect(g.se).toBeGreaterThan(100 * ((2 * 1500) / C0));
    expect(g.naive).toBeLessThan(10_000); // estimativa ingênua: alguns km/s
  });

  it("Rømer: O − C = Δd/c e o ajuste devolve c", () => {
    const e = eclipse(100, C0, 0);
    expect(e.oc).toBeCloseTo((e.dd * AU) / C0, 6);
    // na conjunção (≈ 199 dias) a Terra está ~2 UA mais longe que na oposição: ≈ 1000 s
    expect(((distEJ(199.4) - distEJ(0)) * AU) / C0).toBeCloseTo(998, -1);
    const r = new Runner(sim, withOverrides(sim, { modo: 1, ruido: 0 }));
    while (r.t < 300 / 20) r.stepOnce();
    expect(r.state.ecl.length).toBeGreaterThan(100);
    expect(romerFit(r.state.ecl) / C0).toBeCloseTo(1, 6);
    // com ruído de 30 s ainda dá c com poucos por cento
    const rn = new Runner(sim, withOverrides(sim, { modo: 1, ruido: 30 }));
    while (rn.t < 300 / 20) rn.stepOnce();
    expect(Math.abs(rn.value("cEst") / C0 - 1)).toBeLessThan(0.05);
    // sem eclipses perto da conjunção (elongação < 15°)
    expect(r.state.ecl.some((x) => Math.abs(x.day - 199.4) < 5)).toBe(false);
  });

  it("Bradley: tubo passa quando tan ψ = v/c; κ ≈ 20,5″ e c = v/tan κ", () => {
    expect(tubeMiss(Math.atan(0.3), 0.3)).toBeCloseTo(0, 12);
    expect(Math.abs(tubeMiss(0, 0.3))).toBeGreaterThan(0.2);
    const k = aberration(V_EARTH, C0) / ARCSEC;
    expect(k).toBeCloseTo(20.49, 1);
    const r = new Runner(sim, withOverrides(sim, { modo: 2 }));
    expect(r.value("cEst")).toBeCloseTo(C0, -3);
  });

  it("Fizeau: primeira extinção em c/(4NL) ≈ 12,6 rot/s e brilho volta em 2f₁", () => {
    const f1 = fizeauFirst(720, 8633, C0);
    expect(f1).toBeCloseTo(12.06, 1);
    expect(fizeauI(720, f1, 8633, C0)).toBeCloseTo(0, 9);
    expect(fizeauI(720, 2 * f1, 8633, C0)).toBeCloseTo(1, 9);
    expect(fizeauI(720, 3 * f1, 8633, C0)).toBeCloseTo(0, 9);
    const r = new Runner(sim, withOverrides(sim, { modo: 3, f: f1 }));
    expect(r.value("I")).toBeCloseTo(0, 6);
    expect(r.value("cEst")).toBeCloseTo(C0, -2);
  });

  it("Foucault: δ = 4ωRD/c (≈ 0,7 mm no arranjo de 1862) e a água aumenta o desvio", () => {
    const d = foucaultShift(800, 20, 0.5, C0);
    expect(d).toBeCloseTo((4 * 2 * Math.PI * 800 * 20 * 0.5) / C0, 12);
    expect(d * 1e3).toBeGreaterThan(0.6);
    expect(d * 1e3).toBeLessThan(0.75);
    const dw = foucaultShift(800, 20, 0.5, C0, 3);
    expect(dw / d).toBeCloseTo((17 + 3 * 1.333) / 20, 9);
    const r = new Runner(sim, withOverrides(sim, { modo: 4 }));
    expect(r.value("cEst")).toBeCloseTo(C0, -2);
  });
});
