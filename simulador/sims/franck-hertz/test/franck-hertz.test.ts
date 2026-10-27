import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import { HG, NE, curve, franckHertz as sim, glowProfile, hgPressure, lambdaRel, meanSpacing, peaks } from "../src/index.ts";

describe("Franck–Hertz", () => {
  it("mercúrio a 180 °C: picos espaçados de 4,9 V, deslocados pelo potencial de contato", () => {
    const pk = peaks(curve({ gas: HG, Tc: 180, Ur: 1.5, Uc: 2 }), 3);
    expect(pk.length).toBeGreaterThanOrEqual(4);
    expect(Math.abs(meanSpacing(pk) - 4.89)).toBeLessThan(0.15);
    // primeiro máximo perto de U_c + 4,9 − (largura do degrau)
    expect(pk[0]!).toBeGreaterThan(5.5);
    expect(pk[0]!).toBeLessThan(7.5);
    // mudar U_c translada a curva sem mudar o espaçamento
    const pk2 = peaks(curve({ gas: HG, Tc: 180, Ur: 1.5, Uc: 1 }), 3);
    expect(pk2[0]! - pk[0]!).toBeCloseTo(-1, 0);
  });

  it("pressão de vapor e livre caminho: forno mais quente → mínimos mais fundos", () => {
    expect(hgPressure(200)).toBeGreaterThan(2000);
    expect(hgPressure(200)).toBeLessThan(2700);
    expect(lambdaRel(HG, 200)).toBeLessThan(lambdaRel(HG, 150));
    const depth = (T: number) => {
      const cv = curve({ gas: HG, Tc: T, Ur: 1.5, Uc: 2 });
      const at = (u: number) => cv.I[Math.round(u / 0.1)]!;
      // razão entre o mínimo depois do 2º pico e o 2º pico
      const pk = peaks(cv, 3);
      let mn = Infinity;
      for (let u = pk[1]!; u < pk[1]! + 4.5; u += 0.1) mn = Math.min(mn, at(u));
      return mn / at(pk[1]!);
    };
    expect(depth(200)).toBeLessThan(depth(150));
  });

  it("neônio: espaçamento perto de 19 V e uma camada de luz por colisão", () => {
    const c = { gas: NE, Tc: 25, Ur: 7, Uc: 1 };
    const dU = meanSpacing(peaks(curve(c), 12));
    expect(dU).toBeGreaterThan(17.5);
    expect(dU).toBeLessThan(19.8);
    const layers = (U: number) => {
      const prof = glowProfile(c, U, 60);
      let n = 0;
      for (let i = 0; i < prof.length; i++) if (prof[i]! > 0.05 && (i === 0 || prof[i - 1]! <= 0.05)) n++;
      return n;
    };
    expect(layers(45)).toBe(2);
    expect(layers(65)).toBe(3);
  });

  it("varredura automática percorre a curva e registra pontos", () => {
    const r = new Runner(sim, withOverrides(sim, { gas: 0, modo: 1, taxa: 10 }));
    for (let i = 0; i < 200; i++) r.stepOnce();
    expect(r.state.U).toBeCloseTo(30, 6);
    expect(r.state.trace.length).toBeGreaterThan(100);
    const o = Object.fromEntries(sim.observables.map((ob) => [ob.key, ob.value(r.state, r.params, r.t)]));
    expect(o.picos).toBeGreaterThanOrEqual(4);
  });
});
