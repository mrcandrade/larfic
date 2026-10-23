import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import { lyapunov, omega0, penduloDuplo as sim } from "../src/index.ts";

const run = (p: Record<string, number>) => new Runner(sim, withOverrides(sim, p));
const steps = (r: Runner<unknown>, n: number) => {
  for (let i = 0; i < n; i++) r.stepOnce();
};

describe("Pêndulo duplo e pêndulo forçado", () => {
  it("pêndulo duplo conserva a energia mesmo no regime caótico", () => {
    const r = run({ modo: 0, th1: 120, th2: -20 });
    const E0 = r.value("E");
    steps(r, 20000);
    expect(Math.abs((r.value("E") - E0) / E0)).toBeLessThan(1e-7);
  });

  it("modo normal lento: ω² = (2 − √2) g/ℓ para massas e hastes iguais", () => {
    const th = 0.5; // graus
    const r = run({ modo: 0, th1: th, th2: th * Math.SQRT2, l1: 1, l2: 1 });
    const cross: number[] = [];
    let prev = r.state.y[0]!;
    while (cross.length < 4 && r.t < 20) {
      r.stepOnce();
      const a = r.state.y[0]!;
      if (prev > 0 && a <= 0) cross.push(r.t - (a / (a - prev)) * r.dt);
      prev = a;
    }
    const T = (cross[3]! - cross[0]!) / 3;
    expect(T).toBeCloseTo((2 * Math.PI) / Math.sqrt((2 - Math.SQRT2) * 9.81), 3);
  });

  it("forçado com f pequeno: amplitude estacionária da ressonância linear", () => {
    const f = 0.02, q = 2, Wr = 0.5;
    const r = run({ modo: 1, th1: 0, f, q, Wr, l1: 1 });
    const w0 = omega0(r.params);
    steps(r, 20000); // passa o transiente
    let amp = 0;
    for (let i = 0; i < 5000; i++) {
      r.stepOnce();
      amp = Math.max(amp, Math.abs(r.state.y[0]!));
    }
    const W = Wr * w0;
    const expected = (f * w0 * w0) / Math.hypot(w0 * w0 - W * W, (w0 / q) * W);
    expect(amp / expected).toBeCloseTo(1, 2);
  });

  it("Lyapunov: positivo no forçado caótico e negativo no periódico", () => {
    const caos = run({ modo: 1, th1: 0, q: 2, f: 1.5, Wr: 2 / 3 });
    const per = run({ modo: 1, th1: 0, q: 2, f: 0.9, Wr: 2 / 3 });
    steps(caos, 150000);
    steps(per, 150000);
    expect(lyapunov(caos.state)).toBeGreaterThan(0.1);
    expect(lyapunov(per.state)).toBeLessThan(0);
  });

  it("Poincaré: um ponto fixo no periódico, nuvem espalhada no caótico", () => {
    const spread = (pts: [number, number][]) => {
      const tail = pts.slice(-20);
      const xs = tail.map((q) => q[0]), ys = tail.map((q) => q[1]);
      return Math.max(...xs) - Math.min(...xs) + Math.max(...ys) - Math.min(...ys);
    };
    const per = run({ modo: 1, th1: 0, q: 2, f: 0.9, Wr: 2 / 3 });
    const caos = run({ modo: 1, th1: 0, q: 2, f: 1.5, Wr: 2 / 3 });
    steps(per, 150000);
    steps(caos, 150000);
    expect(per.state.poin.length).toBeGreaterThan(30);
    expect(spread(per.state.poin)).toBeLessThan(1e-3);
    expect(spread(caos.state.poin)).toBeGreaterThan(0.5);
  });

  it("pêndulo duplo: grandes ângulos caóticos (λ > 0,5/s), pequenos regulares", () => {
    const big = run({ modo: 0, th1: 120, th2: -20 });
    const small = run({ modo: 0, th1: 10, th2: 14 });
    steps(big, 60000);
    steps(small, 60000);
    expect(lyapunov(big.state)).toBeGreaterThan(0.5);
    expect(lyapunov(small.state)).toBeLessThan(0.2);
    // o gêmeo, que começou a 10⁻⁶ rad, já se separou macroscopicamente
    expect(big.value("sep")).toBeGreaterThan(-2);
  });

  it("arrastar a massa reinicia com o novo ângulo e velocidade nula", () => {
    const r = run({ modo: 0 });
    steps(r, 500);
    const s = r.state;
    const x2 = Math.sin(s.y[0]!) + Math.sin(s.y[1]!), y2 = -Math.cos(s.y[0]!) - Math.cos(s.y[1]!);
    const s1 = sim.pointer!.down!(s, r.params, { x: x2, y: y2 })!;
    expect(s1.drag?.bob).toBe(2);
    const s2 = sim.pointer!.move!(s1, r.params, { x: 1, y: -1 }, true)!;
    expect(s2.y[2]).toBe(0);
    expect(s2.poin).toHaveLength(0);
  });
});
