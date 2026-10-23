import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import { NBINS, gasIdeal as sim, idealPressure, mass, mb2d, meanPressure, sigmaV, temperatureOf, type GasState } from "../src/index.ts";

const make = (o: Record<string, number>) => new Runner<GasState>(sim, withOverrides(sim, o));
const run = (r: Runner<GasState>, steps: number) => {
  for (let i = 0; i < steps; i++) r.stepOnce();
  return r;
};

describe("gás ideal molecular (dinâmica molecular 2D)", () => {
  it("paredes isolantes e pistão parado conservam a energia (colisões elásticas)", () => {
    const r = make({ N: 150, diam: 0.4 });
    const E0 = r.value("E");
    run(r, 3000);
    expect(Math.abs(r.value("E") - E0) / E0).toBeLessThan(1e-10);
    expect(r.value("T")).toBeCloseTo(300, 6);
  });

  it("a pressão medida pelo impulso nas paredes bate com NkT/A", () => {
    const r = run(make({ N: 200, T0: 400, massa: 20, diam: 0.15, L0: 20 }), 8000); // 400 ps
    const ratio = meanPressure(r.state) / idealPressure(r.state, mass(r.params));
    expect(ratio).toBeGreaterThan(0.95);
    expect(ratio).toBeLessThan(1.07);
  });

  it("partindo de rapidez única, o histograma relaxa para Maxwell–Boltzmann 2D", () => {
    const r = make({ N: 250, dist: 1, diam: 0.5, massa: 20 });
    run(r, 6000);
    const s = r.state;
    const m = mass(r.params);
    const T = temperatureOf(s, m);
    const bw = (s.vmax * 1000) / NBINS;
    // Compara frações por faixa com a integral da curva teórica (desvio total de variação).
    let tv = 0;
    s.hist.forEach((h, b) => {
      const v0 = b * bw;
      const pTheory = Math.exp(-(m * (v0 * v0)) / (2 * 1.380649e-23 * T)) - Math.exp(-(m * (v0 + bw) ** 2) / (2 * 1.380649e-23 * T));
      tv += Math.abs(h / s.hw - pTheory);
    });
    expect(tv / 2).toBeLessThan(0.08);
    // A função teórica está normalizada.
    let integral = 0;
    for (let v = 0.5; v < 5000; v += 1) integral += mb2d(v, 300, m);
    expect(integral).toBeCloseTo(1, 3);
  });

  it("compressão lenta com paredes isolantes: T·A ≈ constante (γ = 2 em 2D)", () => {
    const r = make({ N: 150, diam: 0.4, L0: 24, vpist: 0.02, massa: 20 });
    const TA0 = r.value("TA");
    r.setState({ ...r.state, xt: 12 });
    run(r, 15000);
    expect(r.state.xp).toBeCloseTo(12, 6);
    expect(r.value("T") / 300).toBeGreaterThan(1.8);
    expect(r.value("TA") / TA0).toBeGreaterThan(0.93);
    expect(r.value("TA") / TA0).toBeLessThan(1.12);
  });

  it("parede térmica leva o gás à temperatura da parede", () => {
    const r = run(make({ N: 100, parede: 1, Tw: 600, T0: 300, massa: 4, diam: 0.4, L0: 10 }), 20000);
    const T = r.value("T");
    expect(T).toBeGreaterThan(520);
    expect(T).toBeLessThan(690);
    expect(sigmaV(T, mass(r.params))).toBeGreaterThan(0);
  });
});
