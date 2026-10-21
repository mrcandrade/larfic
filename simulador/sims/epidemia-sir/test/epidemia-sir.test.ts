import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import { finalSusceptible, rk4, sirPeak, epidemiaSir as sim } from "../src/index.ts";

const runner = (over: Record<string, number>) => new Runner(sim, withOverrides(sim, over));

describe("Propagação de epidemias", () => {
  it("EDO conserva a população e o pico do SIR bate com 1 − (1 + ln R₀)/R₀", () => {
    const p = withOverrides(sim, { R0: 3, Tinf: 7 });
    let y = [1 - 1e-6, 0, 1e-6, 0, 0];
    let peak = 0;
    for (let i = 0; i < 40000; i++) {
      y = rk4(y, p, 0.05);
      peak = Math.max(peak, y[2]!);
    }
    expect(y.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
    expect(peak).toBeCloseTo(sirPeak(3), 4);
    // tamanho final
    expect(y[0]!).toBeCloseTo(finalSusceptible(3, 1, 0), 4);
    expect(finalSusceptible(3, 1, 0)).toBeCloseTo(0.0595, 3);
  });

  it("SEIR tem o mesmo tamanho final que o SIR, mas pico mais tardio", () => {
    const a = runner({ modelo: 0, R0: 2.5, N: 100 }).runToEnd(300);
    const b = runner({ modelo: 1, R0: 2.5, N: 100, Tlat: 4 }).runToEnd(300);
    expect(b.value("Rode")).toBeCloseTo(a.value("Rode"), 2);
    expect(b.state.tPeakO).toBeGreaterThan(a.state.tPeakO + 5);
  });

  it("vacinação acima de 1 − 1/R₀ impede o crescimento (R_ef < 1)", () => {
    const r = runner({ R0: 3, vac: 0.7, I0: 5 });
    expect(r.value("Reff")).toBeLessThan(1);
    const i0 = r.value("Iode");
    for (let i = 0; i < 50; i++) r.stepOnce();
    expect(r.value("Iode")).toBeLessThan(i0);
  });

  it("agentes bem misturados reproduzem o tamanho final da EDO", () => {
    let tot = 0;
    for (const seed of [1, 2, 3]) {
      const r = runner({ R0: 3, N: 600, I0: 10, vel: 0.4, seed }).runToEnd(300);
      tot += r.value("R");
    }
    const ode = 1 - finalSusceptible(3, 1 - 10 / 600, 10 / 600);
    expect(Math.abs(tot / 3 - ode)).toBeLessThan(0.1);
  });

  it("distanciamento achata a curva (pico menor e mais tardio)", () => {
    const a = runner({ R0: 3 }).runToEnd(300);
    const b = runner({ R0: 3, dist: 0.4 }).runToEnd(300);
    expect(b.state.peakO).toBeCloseTo(sirPeak(1.8, 1 - 3 / 500, 3 / 500), 2);
    expect(b.state.peakO).toBeLessThan(a.state.peakO / 2);
    expect(b.state.tPeakO).toBeGreaterThan(a.state.tPeakO);
  });
});
