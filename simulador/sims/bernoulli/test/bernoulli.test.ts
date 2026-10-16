import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import { bernoulli as sim, VX, levelExact, pressureAt, speedAt, tankOf, venturiOf, NP } from "../src/index.ts";

const P = (o: Record<string, number>) => withOverrides(sim, o);

describe("Bernoulli", () => {
  it("continuidade e Venturi ideal: Δp = ½ρ(v₂² − v₁²) e h = Δp/((ρm − ρ)g)", () => {
    const r = new Runner(sim, P({ modo: 0, Q: 5, D1: 10, D2: 5, CdV: 1, K: 0, rho: 1000, rhoM: 13600 }));
    const v1 = 0.005 / (Math.PI * 0.01 / 4);
    expect(r.value("v1")).toBeCloseTo(v1, 9);
    expect(r.value("v2")).toBeCloseTo(4 * v1, 9);
    const dp = 0.5 * 1000 * (16 - 1) * v1 * v1;
    expect(r.value("dp") * 1000).toBeCloseTo(dp, 6);
    expect(r.value("hm") / 100).toBeCloseTo(dp / (12600 * 9.81), 9);
    expect(r.value("Qi")).toBeCloseTo(5, 9);
    // Ideal: a pressão se recupera totalmente na saída
    const v = venturiOf(r.params);
    expect(pressureAt(v, VX.out1)).toBeCloseTo(0, 9);
  });

  it("C_d e perda: Q deduzida = Q/C_d e a saída fica K·½ρv₂² abaixo da entrada", () => {
    const p = P({ modo: 0, Q: 8, D1: 12, D2: 6, CdV: 0.95, K: 0.2 });
    const r = new Runner(sim, p);
    expect(r.value("Qi")).toBeCloseTo(8 / 0.95, 9);
    const v = venturiOf(p);
    const v2 = speedAt(v, VX.c1);
    expect(-pressureAt(v, VX.out1)).toBeCloseTo(0.2 * 0.5 * 1000 * v2 * v2, 6);
    // Perfil contínuo na entrada do difusor
    expect(pressureAt(v, VX.t1 + 1e-9)).toBeCloseTo(pressureAt(v, VX.t1), 4);
  });

  it("traçadores: vazão (partículas por segundo) se conserva entre entrada e garganta", () => {
    const r = new Runner(sim, P({ modo: 0, Q: 5, D1: 10, D2: 5 }));
    const x0 = r.state.slice(1);
    r.stepOnce();
    const x1 = r.state.slice(1);
    const v = venturiOf(r.params);
    for (let i = 0; i < NP; i++) {
      if (x1[i]! < x0[i]!) continue; // deu a volta
      expect((x1[i]! - x0[i]!) / r.dt).toBeCloseTo(speedAt(v, x0[i]!), 1);
    }
  });

  it("Torricelli: h(t) integrado coincide com (√h₀ − c t)² e esvazia no tempo previsto", () => {
    const p = P({ modo: 1, Dt: 0.3, d: 3, CdO: 0.62, h0: 1, zo: 0.5 });
    const r = new Runner(sim, p);
    const k = tankOf(p);
    while (r.t < 20) r.stepOnce();
    expect(r.value("h")).toBeCloseTo(levelExact(k, r.t), 6);
    expect(r.value("R")).toBeCloseTo(2 * Math.sqrt(r.value("h") * 0.5) / Math.sqrt(1 - (k.a / k.A) ** 2), 6);
    r.runToEnd(200);
    expect(r.finished).toBe(true);
    const Texp = (k.A / (k.Cd * k.a)) * Math.sqrt((2 * 1 * (1 - (k.a / k.A) ** 2)) / 9.81);
    // O evento para em h = 0,1 mm: t = T (1 − √(10⁻⁴/h₀))
    expect(r.t).toBeCloseTo(Texp * (1 - 0.01), 3);
  });
});
