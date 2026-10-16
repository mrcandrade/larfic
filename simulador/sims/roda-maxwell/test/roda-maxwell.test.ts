import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import { accel, inertia, rodaMaxwell as sim, tDescida } from "../src/index.ts";

const P = (o: Record<string, number>) => withOverrides(sim, o);

describe("Roda de Maxwell", () => {
  it("a = g/(1 + I/(m r²)) para disco uniforme", () => {
    const p = P({ m: 0.5, R: 0.065, r: 0.004, forma: 0, g: 9.79 });
    expect(inertia(p)).toBeCloseTo(0.5 * 0.5 * 0.065 ** 2, 14);
    expect(accel(p)).toBeCloseTo(9.79 / (1 + 0.5 * (65 / 4) ** 2), 12);
  });

  it("o runner chega ao fundo no tempo √(2h/a) e a energia se conserva na descida", () => {
    const p = P({ h: 0.5, e: 1 });
    const r = new Runner(sim, p);
    const E0 = r.value("E");
    const tq = tDescida(p);
    while (r.t < tq - 0.01) r.stepOnce();
    expect(r.value("y")).toBeCloseTo(0.5 * accel(p) * r.t * r.t, 10);
    expect(r.value("E")).toBeCloseTo(E0, 10);
    while (r.t < tq + 0.01) r.stepOnce();
    expect(r.value("v")).toBeLessThan(0); // subindo de volta
  });

  it("I recuperado de h e t pela fórmula da prática", () => {
    const p = P({ h: 0.7, m: 0.8, R: 0.09, r: 0.005, forma: 1 });
    const t = tDescida(p);
    const I = 0.8 * 0.005 ** 2 * ((9.79 * t * t) / (2 * 0.7) - 1);
    expect(I).toBeCloseTo(inertia(p), 12);
  });

  it("com perda, volta a uma altura menor; sem perda, volta ao topo", () => {
    for (const [e, frac] of [[1, 1], [0.9, 0.81]] as const) {
      const p = P({ h: 0.5, e });
      const r = new Runner(sim, p);
      const tq = tDescida(p);
      while (r.t < tq + e * tq) r.stepOnce();
      // ápice após o retorno: altura subida = (e v)²/(2a) = e² h
      expect(0.5 - r.value("y")).toBeCloseTo(frac * 0.5, 4);
    }
  });
});
