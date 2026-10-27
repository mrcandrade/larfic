import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import { GASES, T3, extrapolate, molarVolume, pVdw, reading, termometroGas as sim, toCelsius, toFahrenheit } from "../src/index.ts";

const P = (o: Record<string, number>) => withOverrides(sim, o);
const registrar = sim.actions!.find((a) => a.id === "registrar")!;

describe("Termômetro de gás e escalas de temperatura", () => {
  it("no ponto triplo a leitura é exatamente 273,16 K, qualquer que seja o gás", () => {
    for (let g = 0; g < GASES.length; g++) expect(reading(P({ gas: g, p3: 80 }), GASES[g], 80, T3).Tstar).toBeCloseTo(T3, 9);
    const V = molarVolume(GASES[2]!, 80e3, T3);
    expect(pVdw(GASES[2]!, V, T3)).toBeCloseTo(80e3, 6);
  });

  it("N₂ com p₃ = 80 kPa lê alguns décimos de kelvin acima de 373,124 K; o desvio cai com p₃", () => {
    const e80 = reading(P({ gas: 2, p3: 80, banho: 0 })).Tstar - 373.124;
    const e40 = reading(P({ gas: 2, p3: 40, banho: 0 })).Tstar - 373.124;
    expect(e80).toBeGreaterThan(0.1);
    expect(e80).toBeLessThan(0.4);
    expect(e40 / e80).toBeCloseTo(0.5, 1);
  });

  it("a extrapolação p₃ → 0 dá a temperatura do banho para todos os gases", () => {
    for (let g = 0; g < GASES.length; g++) {
      let s = sim.init(P({}));
      for (const p3 of [20, 40, 60, 80]) s = registrar.run(s, P({ gas: g, p3, etapa: 1, banho: 0 }));
      const fit = extrapolate(s, P({ gas: g, banho: 0 }));
      expect(fit.n).toBe(4);
      expect(fit.A).toBeCloseTo(373.124, 2);
    }
    // na célula do ponto triplo não registra; menos de dois p₃ não extrapola
    const s1 = registrar.run(sim.init(P({})), P({ etapa: 0 }));
    expect(s1.pts.length).toBe(0);
    expect(Number.isNaN(extrapolate(registrar.run(s1, P({ p3: 50 })), P({})).A)).toBe(true);
  });

  it("conversões: 0 °C = 32 °F, 100 °C = 212 °F, −40 °C = −40 °F", () => {
    expect(toFahrenheit(273.15)).toBeCloseTo(32, 12);
    expect(toFahrenheit(373.15)).toBeCloseTo(212, 12);
    expect(toFahrenheit(233.15)).toBeCloseTo(-40, 12);
    expect(toCelsius(T3)).toBeCloseTo(0.01, 12);
    const r = new Runner(sim, P({ gas: 1, p3: 10, banho: 4, Tx: 310.15 }));
    expect(r.value("Tc")).toBeCloseTo(37, 1);
    expect(r.value("Tf")).toBeCloseTo(98.6, 1);
  });
});
