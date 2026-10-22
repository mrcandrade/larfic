import { describe, expect, it } from "vitest";
import { Runner, rad, withOverrides } from "@fisilab/core";
import { planoInclinado as sim } from "../src/index.ts";

const run = (p: Record<string, number>) => new Runner(sim, withOverrides(sim, p));

describe("plano inclinado", () => {
  it("abaixo do ângulo crítico o bloco fica parado", () => {
    const r = run({ angulo: 25, mus: 0.5 });
    for (let i = 0; i < 2000; i++) r.stepOnce();
    expect(r.value("v")).toBe(0);
    expect(r.value("desl")).toBe(0);
  });

  it("acima do crítico: a = g(sinθ − μc cosθ)", () => {
    const r = run({ angulo: 40, mus: 0.5, muk: 0.3 });
    r.stepOnce();
    expect(r.value("a")).toBeCloseTo(9.81 * (Math.sin(rad(40)) - 0.3 * Math.cos(rad(40))), 9);
  });

  it("energia potencial perdida = cinética + dissipada", () => {
    const p = { angulo: 45, mus: 0.4, muk: 0.2, m: 3 };
    const r = run(p);
    r.runToEnd();
    const drop = (r.value("s") - 0.6) * Math.sin(rad(45));
    expect(3 * 9.81 * drop).toBeCloseTo(0.5 * 3 * r.value("v") ** 2 + r.value("Wd"), 6);
  });

  it("lançado rampa acima com tanθ < μe para e fica parado", () => {
    const r = run({ angulo: 20, mus: 0.6, muk: 0.3, v0: -3 });
    for (let i = 0; i < 4000; i++) r.stepOnce();
    expect(r.value("v")).toBe(0);
  });
});
