import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import { EPS0, assoc, capacitores as sim, plateCharge, potentialAt, solve } from "../src/index.ts";

const run = (over: Record<string, number>) => new Runner(sim, withOverrides(sim, over));

describe("Placas paralelas, dielétrico e associações", () => {
  it("C ideal = ε₀A/d e energia ½CV² sem dielétrico", () => {
    const r = run({ modo: 0, Lp: 8, d: 1.5, V: 200 });
    const C = (EPS0 * 0.08 * 0.08) / 0.015;
    expect(r.value("C") * 1e-12).toBeCloseTo(C, 18);
    expect(r.value("U") * 1e-9 / (0.5 * C * 200 * 200)).toBeCloseTo(1, 10);
    // Força entre placas: Q²/(2ε₀A)
    const Q = C * 200;
    expect((r.value("Fp") * 1e-6) / ((Q * Q) / (2 * EPS0 * 0.0064))).toBeCloseTo(1, 10);
  });

  it("dielétrico inteiro com bateria ligada: U = κU₀; desligada: U = U₀/κ", () => {
    const k = 3;
    const on = run({ modo: 0, kappa: k, bateria: 0 });
    on.setState({ ...on.state, slab: -4 });
    expect(on.value("U") / on.value("U0")).toBeCloseTo(k, 10);
    const off = run({ modo: 0, kappa: k, bateria: 1 });
    const Q0 = off.value("Q");
    off.setState({ ...off.state, slab: -4 });
    expect(off.value("U") / off.value("U0")).toBeCloseTo(1 / k, 10);
    expect(off.value("Q")).toBeCloseTo(Q0, 12);
    expect(off.value("V")).toBeCloseTo(200 / k, 8);
  });

  it("força no dielétrico = −dU/dx com Q constante (diferença finita)", () => {
    const r = run({ modo: 0, kappa: 4, bateria: 1 });
    const at = (slab: number) => {
      r.setState({ ...r.state, slab });
      return r.value("U") * 1e-9;
    };
    const h = 0.01; // cm
    const dUdx = (at(-h / 2) - at(h / 2)) / (h / 100); // inserir = diminuir slab
    r.setState({ ...r.state, slab: 0 });
    expect((r.value("Fd") * 1e-6) / -dUdx).toBeCloseTo(1, 3);
  });

  it("Laplace: potencial uniforme entre as placas e C com borda > C ideal", () => {
    const G = solve({ Lp: 8, d: 1.5, slab: 10, kappa: 1 });
    // No centro, V varia linearmente: E ≈ ΔV/d
    expect(potentialAt(G, 0, 0)).toBeCloseTo(0, 3);
    expect(potentialAt(G, 0, 0.375)).toBeCloseTo(0.25, 2);
    const cNorm = plateCharge(G); // C/(ε₀w)
    expect(cNorm).toBeGreaterThan(8 / 1.5);
    // Fórmula de Kirchhoff para placas finas: L/d + (1/π)[1 + ln(2πL/d)], com folga por causa da borda aterrada
    const kirchhoff = 8 / 1.5 + (1 / Math.PI) * (1 + Math.log((2 * Math.PI * 8) / 1.5));
    expect(Math.abs(cNorm / kirchhoff - 1)).toBeLessThan(0.15);
  });

  it("Laplace: inserir o dielétrico aumenta C por (κ−1)ε₀wL/d", () => {
    const air = plateCharge(solve({ Lp: 8, d: 1.5, slab: 10, kappa: 1 }));
    const full = plateCharge(solve({ Lp: 8, d: 1.5, slab: -4, kappa: 3 }));
    expect((full - air) / ((2 * 8) / 1.5)).toBeCloseTo(1, 1);
  });

  it("associações: série, paralelo e mista", () => {
    const s = assoc(0, 2, 4, 4, 12);
    expect(s.Ceq).toBeCloseTo(1, 12);
    expect(s.caps.map((c) => c.V).reduce((a, b) => a + b)).toBeCloseTo(12, 12);
    const p = assoc(1, 2, 4, 0, 12);
    expect(p.Ceq).toBeCloseTo(6, 12);
    expect(p.caps.length).toBe(2);
    const m = assoc(2, 2, 4, 2, 12);
    expect(m.Ceq).toBeCloseTo(1.5, 12);
    expect(m.caps[0]!.Q).toBeCloseTo(m.caps[1]!.Q + m.caps[2]!.Q, 12);
    expect(m.caps[0]!.V + m.caps[1]!.V).toBeCloseTo(12, 12);
    const r = run({ modo: 1, tipo: 2, C1: 2, C2: 4, C3: 2, Vs: 12 });
    expect(r.value("Ceq")).toBeCloseTo(1.5, 10);
    expect(r.value("Ut")).toBeCloseTo(108, 8);
  });

  it("desligar a bateria pela ação preserva a carga", () => {
    const r = run({ modo: 0 });
    const Q = r.value("Q");
    r.setState(sim.actions!.find((a) => a.id === "desligar")!.run(r.state, r.params));
    r.setState({ ...r.state, slab: -2 });
    expect(r.value("Q")).toBeCloseTo(Q, 12);
    expect(r.value("V")).toBeLessThan(200);
  });
});
