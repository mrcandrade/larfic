import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import { barrierT, packetT, regionsOf, transmission, tunelamento as sim } from "../src/index.ts";

const run = (o: Record<string, number>) => {
  const p = withOverrides(sim, o);
  const r = new Runner(sim, p);
  r.runToEnd(1e6);
  return { r, p };
};

describe("Tunelamento", () => {
  it("matriz de transferência = fórmula fechada da barreira", () => {
    for (const [E, V0, a] of [
      [0.5, 1, 1],
      [1, 1.2, 1.5],
      [1.6, 1, 2],
      [2.5, 1, 0.7],
    ] as const)
      expect(transmission(E, [{ x0: -a / 2, x1: a / 2, V: V0 }])).toBeCloseTo(barrierT(E, V0, a), 10);
  });

  it("poço: T = 1 quando ka = nπ; barreira dupla tem pico de ressonância ≈ 1", () => {
    const V0 = 1;
    const a = 2;
    const E = (Math.PI / a) ** 2 / 2 - V0; // k dentro do poço = π/a
    expect(transmission(E, [{ x0: -1, x1: 1, V: -V0 }])).toBeCloseTo(1, 8);
    const rs = regionsOf(withOverrides(sim, { tipo: 2, V0: 2, a: 0.6, sep: 3 }));
    let best = 0;
    for (let E = 0.05; E < 1.5; E += 0.0005) best = Math.max(best, transmission(E, rs));
    expect(best).toBeGreaterThan(0.99);
    expect(transmission(0.2, rs)).toBeLessThan(0.1);
  });

  it("Crank–Nicolson conserva a norma", () => {
    const r = new Runner(sim, withOverrides(sim, {}));
    const n0 = r.value("norma");
    expect(n0).toBeCloseTo(1, 10);
    for (let i = 0; i < 400; i++) r.stepOnce();
    expect(Math.abs(r.value("norma") - n0)).toBeLessThan(1e-10);
  });

  it("transmissão medida = ⟨T⟩ do pacote (tunelamento, E < V₀)", () => {
    const { r, p } = run({ tipo: 0, E0: 1, V0: 1.2, a: 1.5, sigma: 6 });
    expect(r.finished).toBe(true);
    const Tp = packetT(Math.sqrt(2), 6, regionsOf(p));
    expect(Math.abs(r.value("PR") - Tp) / Tp).toBeLessThan(0.01);
    expect(r.value("PL") + r.value("PR")).toBeCloseTo(1, 3);
  });

  it("transmissão medida acima da barreira", () => {
    const { r, p } = run({ tipo: 0, E0: 1.6, V0: 1, a: 2, sigma: 8 });
    const Tp = packetT(Math.sqrt(3.2), 8, regionsOf(p));
    expect(Math.abs(r.value("PR") - Tp)).toBeLessThan(0.01);
    expect(Tp).toBeLessThan(0.99);
  });
});
