import { describe, expect, it } from "vitest";
import { Runner, generateExercise, withOverrides } from "@fisilab/core";
import { exact, kin, movimentoCircular as sim } from "../src/index.ts";

const run = (p: Record<string, number>) => new Runner(sim, withOverrides(sim, p));
const runTo = (r: Runner, t: number) => {
  while (r.t < t - 1e-9) r.stepOnce();
  return r;
};

describe("Movimento circular", () => {
  it("MCUV: θ = ω0 t + αt²/2 e ω = ω0 + αt", () => {
    const p = { modo: 1, r: 2, omega0: 1.5, alpha: -0.4 };
    const r = runTo(run(p), 6);
    const e = exact(withOverrides(sim, p), r.t);
    expect(r.value("theta")).toBeCloseTo(e.theta, 8);
    expect(r.value("omega")).toBeCloseTo(e.omega, 8);
  });

  it("MCU ignora α: período T = 2π/ω e aceleração só centrípeta = ω²r", () => {
    const r = run({ modo: 0, r: 1.2, omega0: 2.5, alpha: 2 });
    runTo(r, (2 * Math.PI) / 2.5);
    expect(r.value("voltas")).toBeCloseTo(1, 2);
    expect(r.value("x")).toBeCloseTo(1.2, 2);
    expect(r.value("at")).toBe(0);
    expect(r.value("ac")).toBeCloseTo(2.5 ** 2 * 1.2, 10);
    expect(r.value("a")).toBeCloseTo(r.value("ac"), 12);
  });

  it("unitários polares ortonormais; v ⟂ r̂ e a = −ω²r r̂ + αr θ̂ coincide com a derivada numérica", () => {
    const p = withOverrides(sim, { modo: 1, r: 1.7, omega0: 0.8, alpha: 0.9 });
    const r = new Runner(sim, p);
    runTo(r, 1.3);
    const k = kin(r.state, p);
    expect(k.rhat[0] * k.thhat[0] + k.rhat[1] * k.thhat[1]).toBeCloseTo(0, 12);
    // derivada segunda da posição por diferenças finitas da solução exata
    const h = 1e-4, t = r.t, R = 1.7;
    const pos = (tt: number) => {
      const th = exact(p, tt).theta;
      return [R * Math.cos(th), R * Math.sin(th)];
    };
    const [x0, y0] = pos(t - h), [x1, y1] = pos(t), [x2, y2] = pos(t + h);
    const ax = (x2! - 2 * x1! + x0!) / (h * h), ay = (y2! - 2 * y1! + y0!) / (h * h);
    const axK = -k.rhat[0] * k.ac + k.thhat[0] * k.at;
    const ayK = -k.rhat[1] * k.ac + k.thhat[1] * k.at;
    expect(axK).toBeCloseTo(ax, 3);
    expect(ayK).toBeCloseTo(ay, 3);
    expect(k.a).toBeCloseTo(Math.hypot(ax, ay), 3);
  });

  it("α ao vivo: trocar α no meio muda a inclinação de ω(t) a partir dali", () => {
    const r = run({ modo: 1, r: 1, omega0: 0, alpha: 1 });
    runTo(r, 2);
    r.setLiveParams({ ...r.params, alpha: -0.5 });
    runTo(r, 4);
    expect(r.value("omega")).toBeCloseTo(2 - 0.5 * 2, 8);
    expect(r.value("theta")).toBeCloseTo(0.5 * 4 + 2 * 2 - 0.25 * 4, 8);
  });

  it("exercício de aceleração total no MCUV confere", () => {
    const ex = sim.exercises!.find((e) => e.id === "mcuv-total")!;
    const inst = generateExercise(sim, ex, 7);
    const { r, alpha, t } = inst.params as Record<string, number>;
    const w = alpha! * t!;
    expect(inst.answer).toBeCloseTo(Math.sqrt((w * w * r!) ** 2 + (alpha! * r!) ** 2), 10);
  });
});
