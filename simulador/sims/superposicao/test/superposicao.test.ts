import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import { G, X0, components, field, packetStats, phasorSum, superposicao as sim, velocities } from "../src/index.ts";

const runTo = (r: Runner, t: number) => {
  while (r.t < t - 1e-9 && !r.finished) r.stepOnce();
};

describe("superposicao", () => {
  it("v_g/v_f = 1, 1/2 e 2 para as três relações de dispersão", () => {
    const vf0 = Math.sqrt(G / (2 * Math.PI)); // λ₀ = 1 m
    const ratios = [1, 0.5, 2];
    ratios.forEach((ratio, disp) => {
      const { vf, vg } = velocities(withOverrides(sim, { modo: 1, disp, lambda: 1 }));
      expect(vf).toBeCloseTo(vf0, 10);
      expect(vg / vf).toBeCloseTo(ratio, 10);
    });
  });

  it("o centro medido do pacote anda com v_g (e não com v_f)", () => {
    for (const disp of [0, 1, 2]) {
      const p = withOverrides(sim, { modo: 1, disp, lambda: 1, N: 81, sigma: 0.8 });
      const r = new Runner(sim, p);
      runTo(r, 3);
      const { vg } = velocities(p);
      // ω(k) curva desloca o centro em O(σ_k²); tolerância de 2% do deslocamento
      expect(Math.abs(r.value("xc") - (X0 + vg * r.t))).toBeLessThan(0.02 * vg * r.t + 1e-6);
      expect(r.value("xc")).toBeCloseTo(r.value("xg"), 1);
    }
  });

  it("dispersão quadrática: largura cresce como σ₀√(1 + (αt/σ₀²)²); sem dispersão fica constante", () => {
    const s0 = 0.6;
    const pS = withOverrides(sim, { modo: 1, disp: 2, lambda: 1, N: 101, sigma: s0 });
    const k0 = 2 * Math.PI, w0 = Math.sqrt(G * k0), alpha = w0 / (k0 * k0);
    expect(packetStats(pS, 0).sigma).toBeCloseTo(s0, 3);
    for (const t of [2, 4]) {
      const expected = s0 * Math.sqrt(1 + ((alpha * t) / (s0 * s0)) ** 2);
      expect(packetStats(pS, t).sigma).toBeCloseTo(expected, 2);
    }
    const pN = withOverrides(sim, { modo: 1, disp: 0, lambda: 1, N: 101, sigma: s0 });
    expect(packetStats(pN, 8).sigma).toBeCloseTo(s0, 3);
  });

  it("batimentos: y(x,t) = 2A cos(Δk x/2 − Δω t/2) cos(k̄x − ω̄t) e f_bat = |f₁ − f₂|", () => {
    const p = withOverrides(sim, { modo: 0, disp: 1, lambda: 1, dk: 0.2 });
    const [c1, c2] = components(p);
    const cs = components(p);
    const kb = (c1!.k + c2!.k) / 2, wb = (c1!.w + c2!.w) / 2;
    const dk = c2!.k - c1!.k, dw = c2!.w - c1!.w;
    for (const [x, t] of [[4, 0.7], [11.3, 5.2], [17, 13]] as const) {
      const prod = Math.cos((dk * (x - X0)) / 2 - (dw * t) / 2) * Math.cos(kb * (x - X0) - wb * t);
      expect(field(cs, x, t)).toBeCloseTo(prod, 12);
    }
    const r = new Runner(sim, p);
    expect(r.value("fb")).toBeCloseTo(Math.abs(c2!.w - c1!.w) / (2 * Math.PI), 12);
    // velocidade da envoltória é Δω/Δk
    expect(r.value("vg")).toBeCloseTo(dw / dk, 12);
  });

  it("arrastar a sonda move o ponto de observação; o pacote para no fim da tela", () => {
    const p = withOverrides(sim, { modo: 1, disp: 0 });
    const r = new Runner(sim, p);
    const s = sim.pointer!.down!(r.state, p, { x: 7.5, y: 2.7 })!;
    expect(s[1]).toBe(7.5);
    r.runToEnd();
    expect(r.finished).toBe(true);
    expect(r.value("xg")).toBeCloseTo(19, 6);
  });
});

describe("Superposição: fasores de duas ondas de mesma frequência", () => {
  it("A′ pela lei dos cossenos e β; a soma ponto a ponto confere com A′ sen(kx − ωt + β)", () => {
    expect(phasorSum(1, 0.7, Math.PI / 2).A).toBeCloseTo(Math.hypot(1, 0.7), 12);
    expect(phasorSum(1, 0.7, 0).A).toBeCloseTo(1.7, 12);
    expect(phasorSum(1, 1, Math.PI).A).toBeCloseTo(0, 12);
    const A1 = 1, A2 = 0.7, ph = 1.1;
    const r = phasorSum(A1, A2, ph);
    for (const u of [0, 0.4, 1.3, 2.9, 5]) {
      const y = A1 * Math.sin(u) + A2 * Math.sin(u + ph);
      expect(y).toBeCloseTo(r.A * Math.sin(u + r.beta), 12);
    }
    const run = new Runner(sim, withOverrides(sim, { modo: 2, A1: 1, A2: 0.7, phi: 90 }));
    expect(run.value("Ares")).toBeCloseTo(Math.hypot(1, 0.7), 12);
    expect(run.value("beta")).toBeCloseTo((Math.atan2(0.7, 1) * 180) / Math.PI, 10);
  });
});
