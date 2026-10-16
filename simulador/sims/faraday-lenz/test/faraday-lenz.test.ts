import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import { dFluxExact, dFluxDx, faradayLenz as sim, fluxExact, fluxNumeric } from "../src/index.ts";

const rel = (a: number, b: number) => Math.abs(a - b) / Math.abs(b);

describe("Lei de Faraday e Lenz", () => {
  it("fluxo do dipolo integrado na área = μ₀ m a²/[2(a²+d²)^{3/2}] (longe, perto e no plano)", () => {
    for (const d of [0, 0.005, 0.02, 0.03, 0.031, 0.1, 0.18]) {
      expect(rel(fluxNumeric(1.5, 0.03, d), fluxExact(1.5, 0.03, d))).toBeLessThan(1e-6);
    }
  });

  it("passagem com velocidade constante: ε = −N (dΦ/dd) v", () => {
    const p = withOverrides(sim, { modo: 1, v: 30, N: 200, a: 4, m: 2 });
    const r = new Runner(sim, p);
    while (r.t < 0.5 - 1e-9) r.stepOnce();
    const d = (-18 + 30 * r.t) / 100;
    expect(rel(r.value("emf"), -200 * dFluxExact(2, 0.04, d) * 0.3)).toBeLessThan(1e-5);
    expect(rel(dFluxDx(p, 3), dFluxExact(2, 0.04, 0.03))).toBeLessThan(1e-5);
  });

  it("∫ε dt = −N ΔΦ (Faraday na forma integral)", () => {
    const p = withOverrides(sim, { modo: 0, A: 12, f: 0.5, N: 50 });
    const r = new Runner(sim, p, { dt: 1e-4 });
    const phi0 = r.state.phi;
    let integral = 0;
    let prev = r.state.emf;
    while (r.t < 0.8 - 1e-9) {
      r.stepOnce();
      integral += ((prev + r.state.emf) / 2) * r.dt;
      prev = r.state.emf;
    }
    expect(rel(integral, -50 * (r.state.phi - phi0))).toBeLessThan(1e-4);
  });

  it("Lenz: ímã com norte à frente se aproximando ⇒ corrente cria B oposto ao do ímã", () => {
    const p = withOverrides(sim, { modo: 1, polo: 1, v: 20 });
    const r = new Runner(sim, p);
    while (r.t < 0.5) r.stepOnce(); // ainda à esquerda da espira, aproximando-se
    expect(r.state.x).toBeLessThan(0);
    expect(r.value("phi")).toBeGreaterThan(0); // B do ímã atravessa a espira em +x
    expect(r.value("I")).toBeLessThan(0); // B induzido em −x
  });

  it("gerador: ε = NBAω sen ωt", () => {
    const p = withOverrides(sim, { modo: 3, N: 120, a: 5, B: 0.3, f: 2 });
    const r = new Runner(sim, p);
    const w = 2 * Math.PI * 2;
    const emax = 120 * 0.3 * Math.PI * 0.05 ** 2 * w;
    while (r.t < 0.1 - 1e-9) r.stepOnce();
    expect(r.value("emf")).toBeCloseTo(emax * Math.sin(w * r.t), 8);
    let peak = 0;
    while (r.t < 1) {
      r.stepOnce();
      peak = Math.max(peak, r.value("emf"));
    }
    expect(rel(peak, emax)).toBeLessThan(1e-4);
  });

  it("arrastar o ímã move-o até o alvo e só há fem enquanto ele se move", () => {
    const p = withOverrides(sim, { modo: 2 });
    const r = new Runner(sim, p);
    let s = sim.pointer!.down!(r.state, p, { x: r.state.x, y: 2 })!;
    s = sim.pointer!.move!(s, p, { x: -2, y: 2 }, true)!;
    r.setState(sim.pointer!.up!(s, p, { x: -2, y: 2 })!);
    r.stepOnce();
    expect(Math.abs(r.value("emf"))).toBeGreaterThan(0);
    while (r.t < 2) r.stepOnce();
    expect(r.state.x).toBeCloseTo(-2, 4);
    expect(Math.abs(r.value("emf"))).toBeLessThan(1e-9);
  });
});
