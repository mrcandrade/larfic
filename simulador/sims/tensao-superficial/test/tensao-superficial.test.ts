import { describe, expect, it } from "vitest";
import { Runner, rng, withOverrides } from "@fisilab/core";
import { analyze, measureRow, type Practice } from "../../../packages/analysis/src/index.ts";
import { tensaoSuperficial as sim, capillaryStep, gamma, jurin, ringWeight, rho, TUBES } from "../src/index.ts";

const P = (o: Record<string, number>) => withOverrides(sim, o);
const runToEnd = (o: Record<string, number>) => {
  const r = new Runner(sim, P(o));
  for (let k = 0; k < 400_000 && !r.finished; k++) r.stepOnce();
  return r;
};
const dyn = { id: "tensiometro", name: "Dinamômetro de torção", unit: "mN", kind: "analogico" as const, resolution: 0.05, range: [0, 100] as [number, number] };

describe("Tensão superficial", () => {
  it("anel: F_max = P + 4πRγ e, depois da ruptura, a leitura volta ao peso", () => {
    const r = runToEnd({ modo: 0, liquido: 0, T: 20, R: 9.55 });
    expect(r.finished).toBe(true);
    const p = r.params;
    expect(r.value("Fmax")).toBeCloseTo(ringWeight(p) + 4 * Math.PI * 0.00955 * 0.0728, 7);
    expect(r.value("F")).toBeCloseTo(ringWeight(p), 12);
    // Imerso, o fio sofre empuxo: leitura um pouco menor que o peso.
    const r0 = new Runner(sim, p);
    expect(r0.value("F")).toBeLessThan(ringWeight(p));
  });

  it("γ cai com a temperatura e com sabão", () => {
    expect(gamma(P({ liquido: 0, T: 60 }))).toBeCloseTo(0.0728 - 40 * 1.55e-4, 9);
    const fw = runToEnd({ modo: 0, liquido: 0 }).value("Fmax");
    const fs = runToEnd({ modo: 0, liquido: 3 }).value("Fmax");
    expect(fs).toBeLessThan(fw);
  });

  it("capilar: equilíbrio na altura de Jurin, h ∝ 1/r; mercúrio desce", () => {
    const r = runToEnd({ modo: 1, liquido: 0, T: 20, r: 0.5 });
    expect(r.finished).toBe(true);
    const hJ = (2 * 0.0728) / (998.2 * 9.81 * 0.0005);
    expect(r.value("h")).toBeCloseTo(hJ, 5);
    expect(jurin(r.params, 0.00025) / jurin(r.params, 0.0005)).toBeCloseTo(2, 12);
    const hg = runToEnd({ modo: 1, liquido: 4, theta: 140, r: 0.5 });
    expect(hg.value("h")).toBeLessThan(0);
    expect(hg.value("h")).toBeCloseTo((2 * 0.4855 * Math.cos((140 * Math.PI) / 180)) / (13546 * 9.81 * 0.0005), 5);
  });

  it("Lucas–Washburn: perto do equilíbrio h relaxa exponencialmente com taxa r²ρg/(8μh_eq)", () => {
    const p = P({ modo: 1, liquido: 2, T: 20, r: 0.5 });
    const r0 = 0.0005, heq = jurin(p, r0);
    const k = (r0 * r0 * rho(p) * 9.81) / (8 * 1.412 * heq);
    let h = 0.9 * heq;
    const dt = 0.01;
    for (let i = 0; i < 2000; i++) h = capillaryStep(p, r0, h, dt);
    // Linearização com ℓ ≈ h: (heq − h) decai como e^{−kt} (dentro de 2%, pois ℓ varia de 0,9 a 1 h_eq).
    expect((heq - h) / (0.1 * heq) / Math.exp(-k * 20)).toBeCloseTo(1, 1);
    expect(TUBES.length).toBe(4);
  });

  it("prática (anel): γ da água pelo gráfico (F_max − P) × 4πR", () => {
    const base = { modo: 0, liquido: 0, T: 20, theta: 0, u: 0.5 };
    const practice: Practice = {
      id: "t", course: "Exp II", title: "t", sim: "tensao-superficial", objective: "", materials: [], procedure: "", questions: [], params: base,
      columns: [
        { key: "R", label: "R", unit: "mm", source: { param: "R" }, instrument: "paquimetro" },
        { key: "P", label: "P", unit: "mN", source: { observable: "P" }, instrument: dyn, toUnit: 1000 },
        { key: "Fm", label: "F_max", unit: "mN", source: { observable: "Fmax" }, instrument: dyn, toUnit: 1000, repeat: 3 },
        { key: "L", label: "4πR", unit: "m", from: ["R"], compute: (R) => (4 * Math.PI * R) / 1000 },
        { key: "Ff", label: "F_max − P", unit: "N", from: ["Fm", "P"], compute: (F, W) => (F - W) / 1000 },
      ],
      analysis: { x: "L", y: "Ff", fit: "proporcional", results: [{ label: "γ", unit: "mN/m", compute: (b) => 1000 * b, reference: 72.8 }] },
    };
    const rand = rng(7);
    const rows = [6, 8, 9.55, 12, 15, 18].map((R) => {
      const r = runToEnd({ ...base, R });
      expect(r.t).toBeLessThan(20);
      return measureRow(practice, { params: r.params, t: r.t, value: (k) => r.value(k) }, rand);
    });
    const res = analyze(practice, rows)!.results[0]!;
    expect(Math.abs(res.value / 72.8 - 1)).toBeLessThan(0.03);
  });

  it("prática (capilar): γ da água pelo gráfico h × 1/r", () => {
    const base = { modo: 1, liquido: 0, T: 20, theta: 0 };
    const practice: Practice = {
      id: "t", course: "Exp II", title: "t", sim: "tensao-superficial", objective: "", materials: [], procedure: "", questions: [], params: base,
      columns: [
        { key: "r", label: "r", unit: "mm", source: { param: "r" }, instrument: { id: "microscopio", name: "Microscópio com retículo", unit: "mm", kind: "analogico", resolution: 0.01, range: [0, 5] } },
        { key: "h", label: "h", unit: "mm", source: { observable: "h" }, instrument: { id: "catetometro", name: "Catetômetro", unit: "mm", kind: "nonio", resolution: 0.05, range: [-100, 300] }, toUnit: 1000 },
        { key: "ir", label: "1/r", unit: "1/m", from: ["r"], compute: (r) => 1000 / r },
        { key: "hm", label: "h", unit: "m", from: ["h"], compute: (h) => h / 1000 },
      ],
      analysis: { x: "ir", y: "hm", fit: "proporcional", results: [{ label: "γ", unit: "mN/m", compute: (b) => (1000 * b * 998.2 * 9.81) / 2, reference: 72.8 }] },
    };
    const rand = rng(11);
    const rows = [0.2, 0.3, 0.4, 0.5, 0.75, 1].map((rr) => {
      const r = runToEnd({ ...base, r: rr });
      expect(r.t).toBeLessThan(60);
      return measureRow(practice, { params: r.params, t: r.t, value: (k) => r.value(k) }, rand);
    });
    const res = analyze(practice, rows)!.results[0]!;
    expect(Math.abs(res.value / 72.8 - 1)).toBeLessThan(0.03);
  });
});
