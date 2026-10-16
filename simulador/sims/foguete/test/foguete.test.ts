import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import { G0, K, M, V, deltaVIdeal, deltaVSingle, foguete as sim, ignitionMasses } from "../src/index.ts";

const P = (o: Record<string, number>) => withOverrides(sim, o);

/** Roda até o fim da queima de todos os estágios. */
function burnout(p: Record<string, number>) {
  const r = new Runner(sim, p);
  while (r.state[K]! < Math.round(p.n!)) r.stepOnce();
  return r;
}

describe("Foguete e massa variável", () => {
  it("sem gravidade: v no fim da queima = v_e ln(m0/mf) (Tsiolkovsky)", () => {
    const p = P({ n: 1, grav: 0, arrasto: 0, M1: 20000, eps: 0.1, mpl: 500, ve: 2500, tb: 60 });
    const r = burnout(p);
    const m0 = 20500;
    const mf = 500 + 2000;
    expect(deltaVIdeal(p)).toBeCloseTo(2500 * Math.log(m0 / mf), 9);
    expect(r.state[V]!).toBeCloseTo(2500 * Math.log(m0 / mf), 4);
    expect(r.state[M]!).toBeCloseTo(500, 6); // estrutura descartada
    expect(r.value("perda")).toBeCloseTo(0, 4);
  });

  it("com g constante e sem ar: v(t_q) = Δv − g t_q", () => {
    const p = P({ n: 1, grav: 1, arrasto: 0, M1: 20000, eps: 0.1, mpl: 500, ve: 2500, tb: 60 });
    const r = burnout(p);
    expect(r.t).toBeCloseTo(60, 6);
    expect(r.state[V]!).toBeCloseTo(deltaVIdeal(p) - G0 * 60, 3);
  });

  it("estágios: Δv soma os logaritmos e supera um estágio de mesma massa", () => {
    const p = P({ n: 3, grav: 0, arrasto: 0, M1: 20000, r: 0.3, eps: 0.12, mpl: 300, ve: 2500, tb: 40 });
    const mi = ignitionMasses(p);
    const props = [20000, 6000, 1800].map((m) => 0.88 * m);
    const expected = mi.reduce((a, m0, j) => a + 2500 * Math.log(m0 / (m0 - props[j]!)), 0);
    expect(deltaVIdeal(p)).toBeCloseTo(expected, 9);
    expect(deltaVIdeal(p)).toBeGreaterThan(deltaVSingle(p));
    const r = burnout(p);
    expect(r.state[V]!).toBeCloseTo(expected, 3);
    expect(r.state[M]!).toBeCloseTo(300, 6);
  });

  it("arrasto só reduz a velocidade; empuxo fraco espera na plataforma", () => {
    const base = { n: 1, grav: 1, M1: 20000, eps: 0.1, mpl: 500, ve: 2500, tb: 60 };
    const a = burnout(P({ ...base, arrasto: 0 }));
    const b = burnout(P({ ...base, arrasto: 1, CdA: 2 }));
    expect(b.state[V]!).toBeLessThan(a.state[V]!);
    // tb = 250 s: T = (18000/250)·2500 = 180 kN < m0 g ≈ 201 kN
    const weak = new Runner(sim, P({ ...base, arrasto: 0, tb: 250 }));
    for (let i = 0; i < 100; i++) weak.stepOnce();
    expect(weak.value("h")).toBe(0);
    expect(weak.value("v")).toBe(0);
  });
});
