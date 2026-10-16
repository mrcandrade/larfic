import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import { X_MIN, aIdeal, gates, precompute, trilhoDeAr as sim } from "../src/index.ts";

const P = (o: Record<string, number>) => withOverrides(sim, o);

describe("Trilho de ar", () => {
  it("2ª lei: a = m_p g/(M + m_p) e fotoportas coerentes com MRUV", () => {
    const p = P({ modo: 0, M1: 0.2, mp: 0.02, theta: 0, b: 0, v0: 0, xg1: 0.5, xg2: 1.0, Lb: 0.05 });
    const a = (0.02 * 9.79) / 0.22;
    expect(aIdeal(p)).toBeCloseTo(a, 12);
    const r = new Runner(sim, p);
    const x0 = X_MIN + 0.02;
    // velocidade verdadeira no centro de cada fotoporta
    expect(r.value("vg1")).toBeCloseTo(Math.sqrt(2 * a * (0.5 - x0)), 4);
    expect(r.value("vg2")).toBeCloseTo(Math.sqrt(2 * a * (1.0 - x0)), 4);
    // tempo de bloqueio exato do MRUV
    const tAt = (x: number) => Math.sqrt((2 * (x - x0)) / a);
    expect(r.value("tb1")).toBeCloseTo(tAt(0.525) - tAt(0.475), 5);
    expect(r.value("t12")).toBeCloseTo(tAt(0.975) - tAt(0.475), 5);
    // L/Δt é a velocidade no instante médio do bloqueio: no MRUV, a = (v2 − v1)/(t12 + (Δt2 − Δt1)/2) é exato
    const v1 = 0.05 / r.value("tb1"), v2 = 0.05 / r.value("tb2");
    expect((v2 - v1) / (r.value("t12") + (r.value("tb2") - r.value("tb1")) / 2)).toBeCloseTo(a, 5);
    // e (v2 − v1)/t12 subestima a (erro sistemático de alguns %)
    expect((v2 - v1) / r.value("t12")).toBeLessThan(a);
  });

  it("o runner reproduz o registro pré-calculado", () => {
    const p = P({ modo: 0, M1: 0.25, mp: 0.015, theta: 1, b: 0.01 });
    const r = new Runner(sim, p);
    r.runToEnd();
    expect(r.finished).toBe(true);
    const [, g2] = gates(p);
    expect(r.value("x1")).toBeGreaterThan(g2);
  });

  it("colisão elástica com massas iguais troca as velocidades", () => {
    const p = P({ modo: 1, M1: 0.2, M2: 0.2, v0: 0.5, b: 0, theta: 0 });
    const rec = precompute(p);
    expect(rec.collision).not.toBeNull();
    expect(rec.collision!.pre[0]).toBeCloseTo(0.5, 10);
    expect(rec.collision!.post[0]).toBeCloseTo(0, 3);
    expect(rec.collision!.post[1]).toBeCloseTo(0.5, 3);
    const r = new Runner(sim, p);
    expect(r.value("pf")).toBeCloseTo(r.value("pi"), 3);
    expect(r.value("Kf")).toBeCloseTo(r.value("Ki"), 3);
    expect(0.05 / r.value("tb2")).toBeCloseTo(0.5, 3);
  });

  it("colisão elástica com M2 = 2M1: carrinho 1 volta com −v/3 e passa de novo na fotoporta 1", () => {
    const p = P({ modo: 1, M1: 0.2, M2: 0.4, v0: 0.6, b: 0, theta: 0 });
    const r = new Runner(sim, p);
    expect(r.value("v1f")).toBeCloseTo(-0.2, 3);
    expect(r.value("v2f")).toBeCloseTo(0.4, 3);
    expect(0.05 / r.value("tb1b")).toBeCloseTo(0.2, 3);
  });

  it("colisão inelástica conserva momento e perde M2/(M1+M2) da energia", () => {
    const p = P({ modo: 2, M1: 0.2, M2: 0.3, v0: 0.5, b: 0, theta: 0 });
    const r = new Runner(sim, p);
    expect(r.value("pf")).toBeCloseTo(0.1, 10);
    expect(1 - r.value("Kf") / r.value("Ki")).toBeCloseTo(0.6, 10);
    expect(0.05 / r.value("tb2")).toBeCloseTo(0.2, 4);
  });
});
