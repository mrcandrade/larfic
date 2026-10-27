import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import {
  HC_EV_NM,
  METALS,
  current,
  exampleData,
  fotoeletrico as sim,
  frequency,
  linearFit,
  millikanFits,
  saturationCurrent,
  sweepStoppingVoltage,
} from "../src/index.ts";

describe("Efeito fotoelétrico", () => {
  it("hc/e ≈ 1239,84 eV·nm", () => expect(HC_EV_NM).toBeCloseTo(1239.84, 1));

  it("corrente zera exatamente em V = −(hc/λ − φ)", () => {
    const phi = METALS[2]!.phi;
    const V0 = HC_EV_NM / 300 - phi;
    expect(current(-V0 + 0.01, 300, 1, phi)).toBeGreaterThan(0);
    expect(current(-V0 - 1e-9, 300, 1, phi)).toBe(0);
    expect(sweepStoppingVoltage(300, 1, phi)).toBeCloseTo(V0, 1);
  });

  it("V₀ não depende da intensidade; I_sat é proporcional a ela", () => {
    const phi = METALS[0]!.phi;
    expect(sweepStoppingVoltage(400, 0.5, phi)).toBe(sweepStoppingVoltage(400, 2, phi));
    expect(saturationCurrent(400, 2, phi) / saturationCurrent(400, 0.5, phi)).toBeCloseTo(4, 10);
  });

  it("abaixo do limiar não há corrente", () => {
    expect(current(5, 450, 2, METALS[4]!.phi)).toBe(0);
  });

  it("mínimos quadrados recuperam reta exata", () => {
    const f = linearFit([1, 2, 3, 4], [3, 5, 7, 9])!;
    expect(f.slope).toBeCloseTo(2, 12);
    expect(f.intercept).toBeCloseTo(1, 12);
    expect(f.r2).toBeCloseTo(1, 12);
  });

  it("ajuste de Millikan com dados de varredura dá h e φ", () => {
    const phi = METALS[3]!.phi;
    const pts = [150, 200, 250, 300, 350].map((l) => ({ f: frequency(l), V0: sweepStoppingVoltage(l, 1, phi), m: 3 }));
    const fit = millikanFits(pts)[0]!;
    expect(fit.h / 6.62607015e-34).toBeCloseTo(1, 2);
    expect(fit.phi).toBeCloseTo(phi, 1);
  });

  it("medidas de exemplo e ações do painel", () => {
    const p = withOverrides(sim, { dados: 1, metal: 2 });
    expect(exampleData(p).length).toBeGreaterThan(3);
    const r = new Runner(sim, p);
    const fit = millikanFits(r.state.pts)[0]!;
    expect(Math.abs(fit.h / 6.626e-34 - 1)).toBeLessThan(0.05);
    const act = sim.actions!.find((a) => a.id === "varredura")!;
    const s2 = act.run(r.state, p);
    expect(s2.pts.length).toBe(r.state.pts.length + 1);
    r.stepOnce();
    expect(Number.isFinite(r.value("h"))).toBe(true);
  });
});
