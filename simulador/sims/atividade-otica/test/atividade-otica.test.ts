import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import {
  alphaOf,
  atividadeOtica as sim,
  concentrationFrom,
  inversionFinal,
  inversionRotation,
  rateConstant,
  readings,
  rotation,
  specificRotation,
  type AtivState,
} from "../src/index.ts";

const st = (th: number, tr = 0): AtivState => ({ th, tr, drag: false });

describe("Atividade ótica e sacarímetro", () => {
  it("rotações específicas na linha D e proporcionalidade com L e c", () => {
    expect(specificRotation(1, 589.3)).toBeCloseTo(66.5, 6);
    expect(specificRotation(3, 589.3)).toBeCloseTo(-92.4, 6);
    expect(rotation(1, 589.3, 2, 15)).toBeCloseTo(66.5 * 2 * 0.15, 6);
    expect(rotation(1, 589, 4, 15) / rotation(1, 589, 2, 15)).toBeCloseTo(2, 12);
    expect(concentrationFrom(rotation(2, 546, 1.5, 12), 2, 546, 1.5)).toBeCloseTo(12, 10);
    // Drude: 436 nm gira ~1,9× mais que 589 nm
    expect(specificRotation(1, 436) / specificRotation(1, 589.3)).toBeCloseTo((0.5893 ** 2 - 0.0213) / (0.436 ** 2 - 0.0213), 10);
  });

  it("o mínimo da leitura fica em θ = α + 90° e a penumbra se equilibra ali", () => {
    const p = withOverrides(sim, { modo: 0, sol: 1, c: 15, L: 2, lambda: 589, amb: 0 });
    const a = alphaOf(st(0), p);
    let best = 0;
    let vmin = Infinity;
    for (let th = 0; th < 180; th += 0.05) {
      const v = readings(st(th), p).media;
      if (v < vmin) [vmin, best] = [v, th];
    }
    expect(best).toBeCloseTo(a + 90, 1);
    expect(vmin).toBeLessThan(1e-3);
    const pen = { ...p, campo: 1, eps: 3 };
    const r = readings(st(a + 90), pen);
    expect(r.esq).toBeCloseTo(r.dir, 9);
    expect(readings(st(a + 91), pen).esq).not.toBeCloseTo(readings(st(a + 91), pen).dir, 0);
  });

  it("inversão: α(0) = sacarose, α∞ = mistura invertida, decaimento exponencial", () => {
    const k = rateConstant(25, 1);
    expect(k).toBeCloseTo(2e-4, 12);
    expect(rateConstant(35, 1) / k).toBeCloseTo(Math.exp((108e3 / 8.314) * (1 / 298.15 - 1 / 308.15)), 9);
    const a0 = inversionRotation(20, k, 0, 589, 2);
    const aInf = inversionFinal(20, 589, 2);
    expect(a0).toBeCloseTo(rotation(1, 589, 2, 20), 10);
    expect(inversionRotation(20, k, 1e7, 589, 2)).toBeCloseTo(aInf, 8);
    expect(aInf).toBeLessThan(0);
    for (const t of [300, 1500, 6000]) {
      const a = inversionRotation(20, k, t, 589, 2);
      expect(Math.log((a - aInf) / (a0 - aInf))).toBeCloseTo(-k * t, 9);
    }
  });

  it("o relógio de reação avança com a aceleração e o runner mede α(t)", () => {
    const p = withOverrides(sim, { modo: 2, acel: 60, T: 25, acid: 1, c: 20, L: 2 });
    const r = new Runner(sim, p);
    for (let i = 0; i < 200; i++) r.stepOnce();
    expect(r.state.tr).toBeCloseTo(200 * 0.05 * 60, 6);
    expect(r.value("alfa")).toBeCloseTo(inversionRotation(20, 2e-4, r.state.tr, 589, 2), 9);
  });
});
