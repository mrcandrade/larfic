import { describe, expect, it } from "vitest";
import { Runner, rng, withOverrides } from "@fisilab/core";
import { analyze, measureRow, type Practice } from "../../../packages/analysis/src/index.ts";
import { viscosidadeStokes as sim, dragFactor, ladenburg, muFluid, stokesVelocity, terminalVelocity, relaxTime } from "../src/index.ts";

const P = (o: Record<string, number>) => withOverrides(sim, o);
const runToEnd = (o: Record<string, number>) => {
  const r = new Runner(sim, P(o));
  for (let k = 0; k < 400_000 && !r.finished; k++) r.stepOnce();
  return r;
};

describe("Viscosímetro de Stokes", () => {
  it("Re → 0 sem parede: velocidade terminal = 2(ρe − ρf) g r² / 9μ", () => {
    const p = P({ fluido: 0, T: 20, material: 0, d: 1, parede: 0 });
    const vS = (2 * (7850 - 1261) * 9.81 * 0.0005 ** 2) / (9 * muFluid(p));
    expect(stokesVelocity(p)).toBeCloseTo(vS, 12);
    // Re ≈ 0,002: só a correção de Oseen (1 + 3Re/16) separa as duas.
    expect(terminalVelocity(p) / vS).toBeGreaterThan(0.999);
    expect(muFluid(p)).toBeCloseTo(1.412, 3);
    expect(muFluid(P({ T: 30 }))).toBeCloseTo(0.612, 3);
  });

  it("transiente exponencial: v(τ) = v_t (1 − 1/e) com τ = m_ef / (3πμd)", () => {
    // Esfera de vidro de 3 mm em glicerina: Re ≈ 0,005, regime linear.
    const p = P({ fluido: 0, T: 20, material: 1, d: 3, parede: 0 });
    const tau = relaxTime(p);
    const vt = terminalVelocity(p);
    const r = new Runner(sim, p);
    for (let i = 0; i < 4; i++) {
      r.stepOnce();
      expect(Math.abs(r.value("v") / (vt * (1 - Math.exp(-r.t / tau))) - 1)).toBeLessThan(0.002);
    }
    expect(tau).toBeCloseTo(((2500 + 0.5 * 1261) * Math.PI * 0.003 ** 3) / 6 / (3 * Math.PI * 1.412 * 0.003), 5);
  });

  it("cronômetro entre as marcas = L / v_t e a parede reduz v pelo fator de Ladenburg", () => {
    const o = { fluido: 0, T: 20, material: 0, d: 2, D: 40, yA: 0.2, L: 0.5 };
    const r = runToEnd({ ...o, parede: 1 });
    expect(r.finished).toBe(true);
    const p = P({ ...o, parede: 1 });
    expect(r.value("tAB")).toBeCloseTo(0.5 / terminalVelocity(p), 2);
    // Corrigindo pela parede volta-se ao valor sem parede (a menos de Oseen).
    const v0 = terminalVelocity(P({ ...o, parede: 0 }));
    expect((r.value("vm") * ladenburg(p)) / v0).toBeCloseTo(1, 2);
    expect(ladenburg(p)).toBeCloseTo(1 + (2.4 * 1) / 20, 12);
  });

  it("Reynolds alto: óleo de soja e esfera de aço de 4 mm caem muito abaixo de v_S", () => {
    const p = P({ fluido: 2, T: 20, material: 0, d: 4, parede: 0 });
    const vt = terminalVelocity(p);
    const Re = (919 * vt * 0.004) / muFluid(p);
    expect(Re).toBeGreaterThan(10);
    expect(vt / stokesVelocity(p)).toBeLessThan(0.6);
    // Equilíbrio: peso aparente = 3πμ d v f(Re)
    const W = ((7850 - 919) * Math.PI * 0.004 ** 3 * 9.81) / 6;
    expect(3 * Math.PI * muFluid(p) * 0.004 * vt * dragFactor(Re)).toBeCloseTo(W, 9);
  });

  it("esfera de náilon na glicerina flutua e volta à superfície", () => {
    const r = runToEnd({ fluido: 0, T: 20, material: 4, d: 5 });
    expect(r.finished).toBe(true);
    expect(r.value("y")).toBeLessThan(0.0021);
    expect(r.value("tAB")).toBe(0);
  });

  // Prática proposta: v∞ = v (1 + 2,4 r/R) contra r², ajuste proporcional, μ = 2(ρe − ρf) g / (9 b).
  it("prática: viscosidade da glicerina a 20 °C pelo gráfico v∞ × r²", () => {
    const base = { fluido: 0, T: 20, material: 0, D: 50, parede: 1, yA: 0.2, L: 0.5 };
    const practice: Practice = {
      id: "t", course: "Exp II", title: "t", sim: "viscosidade-stokes", objective: "", materials: [], procedure: "", questions: [],
      params: base,
      columns: [
        { key: "d", label: "d", unit: "mm", source: { param: "d" }, instrument: "micrometro" },
        { key: "t", label: "Δt", unit: "s", source: { observable: "tAB" }, instrument: "cronometroManual", repeat: 3 },
        { key: "r2", label: "r²", unit: "m²", from: ["d"], compute: (d) => (d / 2000) ** 2 },
        { key: "vinf", label: "v∞", unit: "m/s", from: ["t", "d"], compute: (t, d) => (0.5 / t) * (1 + (2.4 * d) / 50) },
      ],
      analysis: { x: "r2", y: "vinf", fit: "proporcional", results: [{ label: "μ", unit: "Pa·s", compute: (b) => (2 * (7850 - 1261) * 9.81) / (9 * b), reference: 1.41 }] },
    };
    const rand = rng(3);
    const rows = [1.5, 2, 2.5, 3, 3.5, 4].map((d) => {
      const r = runToEnd({ ...base, d });
      expect(r.t).toBeLessThan(200);
      return measureRow(practice, { params: r.params, t: r.t, value: (k) => r.value(k) }, rand);
    });
    const res = analyze(practice, rows)!.results[0]!;
    expect(Math.abs(res.value / 1.41 - 1)).toBeLessThan(0.03);
  }, 60_000);
});
