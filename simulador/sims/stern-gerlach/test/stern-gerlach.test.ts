import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import { MU_B, M_AG, d0mm, deflection, fastForward, lastPlusConditional, measured, seriesOutcome, sternGerlach as sim } from "../src/index.ts";

const deg = (d: number) => (d * Math.PI) / 180;

describe("Stern–Gerlach", () => {
  it("desvio analítico confere com a integração numérica da trajetória", () => {
    const grad = 1200;
    const v = 600;
    const L1 = 0.035;
    const Ld = 0.12;
    // integra z'' = μB grad/m enquanto y < L1, depois voo livre
    const dt = 1e-8;
    let y = 0;
    let z = 0;
    let vz = 0;
    while (y < L1 + Ld) {
      const a = y < L1 ? (MU_B * grad) / M_AG : 0;
      vz += a * dt;
      z += vz * dt;
      y += v * dt;
    }
    expect(z / deflection(grad, v, L1, Ld)).toBeCloseTo(1, 3);
    // ordem de grandeza do experimento original: fração de milímetro
    const d = d0mm(withOverrides(sim, {}));
    expect(d).toBeGreaterThan(0.3);
    expect(d).toBeLessThan(1.5);
  });

  it("probabilidades de medidas em série: z→x→z dá ½ e z→z dá 1; cos²(θ/2)", () => {
    expect(lastPlusConditional([0, deg(90), 0], [1, 1])).toBeCloseTo(0.5, 12);
    expect(lastPlusConditional([0, 0], [1])).toBeCloseTo(1, 12);
    expect(lastPlusConditional([0, 0], [-1])).toBeCloseTo(0, 12);
    expect(lastPlusConditional([0, deg(60)], [1])).toBeCloseTo(0.75, 12);
    const o = seriesOutcome([0, deg(90), 0], [1, 1]);
    expect(o.blocked[0]).toBeCloseTo(0.5, 12);
    expect(o.blocked[1]).toBeCloseTo(0.25, 12);
    expect(o.plus).toBeCloseTo(0.125, 12);
    expect(o.blocked[0]! + o.blocked[1]! + o.plus + o.minus).toBeCloseTo(1, 12);
  });

  it("contagem estatística converge para cos²(Δθ/2) dentro de 4σ", () => {
    for (const th2 of [60, 120]) {
      const p = withOverrides(sim, { modo: 1, nAp: 2, th1: 0, th2, porta1: 1 });
      const s = fastForward(sim.init(p), p, 20000);
      const m = measured(s, p);
      const sigma = Math.sqrt((m.expected * (1 - m.expected)) / m.N);
      expect(Math.abs(m.frac - Math.cos(deg(th2) / 2) ** 2)).toBeLessThan(4 * sigma);
      expect(m.N).toBeGreaterThan(9000);
    }
  });

  it("quântico: dois feixes e centro vazio; clássico: borrão entre eles", () => {
    const center = (modelo: number) => {
      const p = withOverrides(sim, { modo: 0, modelo });
      const s = fastForward(sim.init(p), p, 6000);
      const d = d0mm(p);
      let n = 0;
      for (let i = 1; i < s.hits.length; i += 2) if (Math.abs(s.hits[i]!) < 0.15 * d) n++;
      return { frac: n / (s.hits.length / 2), up: s.up / (s.up + s.down) };
    };
    const q = center(0);
    const c = center(1);
    expect(q.frac).toBeLessThan(0.005);
    expect(c.frac).toBeGreaterThan(0.1);
    expect(Math.abs(q.up - 0.5)).toBeLessThan(0.03);
  });

  it("o runner emite átomos um a um e os conta ao chegar", () => {
    const p = withOverrides(sim, { modo: 1, nAp: 3, taxa: 30 });
    const r = new Runner(sim, p);
    for (let i = 0; i < 600; i++) r.stepOnce();
    const s = r.state;
    expect(s.emitted).toBeGreaterThanOrEqual(299);
    const counted = s.blocked.reduce((a, b) => a + b, 0) + s.final[0] + s.final[1];
    expect(counted + s.atoms.length).toBe(s.emitted);
    expect(counted).toBeGreaterThan(200);
  });
});
