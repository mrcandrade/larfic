import { describe, expect, it } from "vitest";
import { Runner, rad, withOverrides } from "@fisilab/core";
import { rolamento as sim, lanes, muMin } from "../src/index.ts";

const G = 9.81;
const arrival = (r: Runner, i: number) => r.state[i * 5 + 4]!;

describe("Rolamento no plano inclinado", () => {
  it("rolando sem deslizar: t = √(2L(1+k)/(g sen θ)) para cada corpo, esfera vence", () => {
    const p = withOverrides(sim, { conjunto: 0, angulo: 25, L: 3, mu: 0.8 });
    const r = new Runner(sim, p).runToEnd();
    expect(r.finished).toBe(true);
    lanes(p).forEach((lane, i) => {
      const t = Math.sqrt((2 * 3 * (1 + lane.k)) / (G * Math.sin(rad(25))));
      expect(arrival(r, i)).toBeCloseTo(t, 9);
    });
    // Esfera (raia 2) < cilindro (raia 1) < anel (raia 3)
    expect(arrival(r, 1)).toBeLessThan(arrival(r, 0));
    expect(arrival(r, 0)).toBeLessThan(arrival(r, 2));
    // A simulação termina quando o último chega
    expect(r.t).toBeCloseTo(arrival(r, 2), 9);
  });

  it("massa e raio não importam: cilindros diferentes empatam", () => {
    const r = new Runner(sim, withOverrides(sim, { conjunto: 2, angulo: 20, L: 2, mu: 0.5 })).runToEnd();
    expect(arrival(r, 0)).toBeCloseTo(arrival(r, 1), 12);
    expect(arrival(r, 2)).toBeGreaterThan(arrival(r, 0));
  });

  it("rolando, a energia mecânica se conserva e K_rot/K = k/(1+k)", () => {
    const r = new Runner(sim, withOverrides(sim, { conjunto: 1, angulo: 15, L: 3, mu: 0.6, foco: 4 }));
    const E0 = r.value("E");
    for (let i = 0; i < 1500; i++) r.stepOnce();
    expect(r.value("E")).toBeCloseTo(E0, 9);
    const k = 2 / 3;
    expect(r.value("Kr") / (r.value("Kr") + r.value("Kt"))).toBeCloseTo(k / (1 + k), 9);
    expect(r.value("slip")).toBeCloseTo(0, 12);
  });

  it("atrito insuficiente: todos deslizam com a = g(sen θ − μ cos θ) e dissipam energia", () => {
    const th = 50, mu = 0.1;
    expect(muMin(2 / 5, th)).toBeGreaterThan(mu);
    const p = withOverrides(sim, { conjunto: 0, angulo: th, L: 3, mu, foco: 3 });
    const r = new Runner(sim, p);
    const E0 = r.value("E");
    for (let i = 0; i < 300; i++) r.stepOnce();
    const a = G * (Math.sin(rad(th)) - mu * Math.cos(rad(th)));
    expect(r.value("a")).toBeCloseTo(a, 9);
    expect(r.value("slip")).toBeGreaterThan(0);
    expect(r.value("E")).toBeLessThan(E0 - 1e-3);
    r.runToEnd();
    expect(arrival(r, 0)).toBeCloseTo(arrival(r, 2), 9);
    expect(arrival(r, 0)).toBeCloseTo(Math.sqrt((2 * 3) / a), 9);
  });

  it("μ no limite: rola se μ ≥ k/(1+k) tg θ", () => {
    const th = 30;
    const ok = new Runner(sim, withOverrides(sim, { conjunto: 0, angulo: th, mu: muMin(1, th) + 1e-6, foco: 3 }));
    for (let i = 0; i < 200; i++) ok.stepOnce();
    expect(Math.abs(ok.value("slip"))).toBeLessThan(1e-9);
    const bad = new Runner(sim, withOverrides(sim, { conjunto: 0, angulo: th, mu: muMin(1, th) - 0.02, foco: 3 }));
    for (let i = 0; i < 200; i++) bad.stepOnce();
    expect(bad.value("slip")).toBeGreaterThan(1e-3);
  });
});
