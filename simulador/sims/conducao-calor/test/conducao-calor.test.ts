import { describe, expect, it } from "vitest";
import { Runner, rng, withOverrides } from "@fisilab/core";
import { analyze, measureRow, type Practice } from "../../../packages/analysis/src/index.ts";
import { conducaoCalor as sim, NX, barA, barFluxes, barSteady, body, coldG, newtonTau, tempAt } from "../src/index.ts";

const P = (o: Record<string, number>) => withOverrides(sim, o);
const runTo = (o: Record<string, number>, t: number) => {
  const r = new Runner(sim, P(o));
  while (r.t < t - 1e-9) r.stepOnce();
  return r;
};

/** erfc com erro < 1,5e-7 (Abramowitz & Stegun 7.1.26). */
function erfc(x: number): number {
  const t = 1 / (1 + 0.3275911 * x);
  const y = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  return y * Math.exp(-x * x);
}

describe("Condução de calor", () => {
  it("barra isolada: perfil estacionário linear e Q = kAΔT/L = calor levado pela água", () => {
    const p = P({ modo: 0, material: 0, Lb: 0.3, Db: 25, Tq: 100, Te: 18, vazao: 40, hl: 0 });
    const T = barSteady(p);
    const A = barA(p), K = (385 * A) / 0.3, G = coldG(p);
    const TL = (K * 100 + G * 18) / (K + G);
    for (let i = 0; i <= NX; i++) expect(T[i]!).toBeCloseTo(100 + ((TL - 100) * i) / NX, 9);
    const f = barFluxes(T, p);
    expect(f.qin).toBeCloseTo(K * (100 - TL), 9);
    expect(f.qw).toBeCloseTo(f.qin, 9);
    expect(f.qlat).toBe(0);
  });

  it("perdas laterais: perfil estacionário = solução com cosh/sinh e Q_entra = Q_água + Q_perdas", () => {
    const o = { modo: 0, material: 1, Lb: 0.5, Db: 15, Tq: 100, Te: 18, vazao: 40, hl: 15, Ta: 22 };
    const p = P(o);
    const A = barA(p), Per = Math.PI * 0.015, k = 205, L = 0.5;
    const m = Math.sqrt((15 * Per) / (k * A)), G = coldG(p);
    // θ = T − Ta = a cosh(mx) + b sinh(mx); θ(0) = 78; −kA θ'(L) = G (θ(L) + Ta − Te)
    const a = 78, c = 22 - 18;
    const b = -(k * A * m * a * Math.sinh(m * L) + G * (a * Math.cosh(m * L) + c)) / (k * A * m * Math.cosh(m * L) + G * Math.sinh(m * L));
    const T = barSteady(p);
    for (const x of [0.1, 0.25, 0.4, 0.5]) expect(tempAt(T, p, x)).toBeCloseTo(22 + a * Math.cosh(m * x) + b * Math.sinh(m * x), 1);
    const f = barFluxes(T, p);
    expect(f.qin).toBeCloseTo(f.qw + f.qlat, 9);
    expect(f.qlat).toBeGreaterThan(0.2 * f.qin);
  });

  it("transiente inicial: T(x,t) = Ta + (Tq − Ta) erfc(x / 2√(αt)) (sólido semi-infinito)", () => {
    const r = runTo({ modo: 0, material: 0, Lb: 0.3, Tq: 100, Ta: 22, ritmo: 1 }, 20);
    const alpha = 385 / (8960 * 385);
    const t = r.value("tf");
    expect(t).toBeCloseTo(20, 6);
    for (const [key, x] of [["T1", 0.05], ["T2", 0.1]] as const) {
      const exact = 22 + 78 * erfc(x / (2 * Math.sqrt(alpha * t)));
      expect(Math.abs(r.value(key) - exact)).toBeLessThan(0.6);
    }
  });

  it("Newton: T − Ta = (T0 − Ta) e^{−t/τ} com τ = C/(hA)", () => {
    const o = { modo: 1, corpo: 1, Dc: 50, T0: 80, Ta: 22, modelo: 0, h: 10, ritmo: 100 };
    const p = P(o);
    const C = 8960 * (Math.PI / 6) * 0.05 ** 3 * 385, A = Math.PI * 0.05 ** 2;
    expect(body(p).C).toBeCloseTo(C, 9);
    expect(newtonTau(p)).toBeCloseTo(C / (10 * A), 9);
    const r = runTo(o, 40);
    const t = r.value("tf");
    expect(r.value("T")).toBeCloseTo(22 + 58 * Math.exp(-t / newtonTau(p)), 6);
    expect(r.value("heff")).toBeCloseTo(10, 9);
  });

  it("ar parado: convecção natural + radiação dão h efetivo que cai com ΔT (desvio da exponencial)", () => {
    const o = { modo: 1, corpo: 0, Va: 250, T0: 90, Ta: 22, modelo: 1, eps: 0.9, ritmo: 200 };
    const r = new Runner(sim, P(o));
    const h0 = r.value("heff");
    while (r.t < 60) r.stepOnce();
    expect(r.value("heff")).toBeLessThan(0.85 * h0);
    expect(r.value("T")).toBeGreaterThan(22);
  });

  it("prática (barra): k do cobre pelo gráfico Q_água × A(T1 − T5)/d", () => {
    const base = { modo: 0, material: 0, Lb: 0.3, Db: 25, Te: 18, vazao: 40, hl: 0, Ta: 22, ritmo: 50 };
    const A = Math.PI * 0.0125 ** 2, dist = 0.2;
    const practice: Practice = {
      id: "t", course: "Exp II", title: "t", sim: "conducao-calor", objective: "", materials: [], procedure: "", questions: [], params: base,
      columns: [
        { key: "T1", label: "T1", unit: "°C", source: { observable: "T1" }, instrument: "termopar" },
        { key: "T5", label: "T5", unit: "°C", source: { observable: "T5" }, instrument: "termopar" },
        { key: "dTw", label: "ΔT_água", unit: "K", source: { observable: "dTw" }, instrument: { id: "termopar-dif", name: "Termopar diferencial", unit: "K", kind: "digital", resolution: 0.01, range: [-50, 50], accuracy: (r) => 0.02 + 0.005 * Math.abs(r) } },
        { key: "V", label: "vazão", unit: "mL/min", source: { param: "vazao" }, instrument: { id: "proveta-crono", name: "Proveta e cronômetro", unit: "mL/min", kind: "analogico", resolution: 1, range: [0, 2000] } },
        { key: "x", label: "A(T1 − T5)/d", unit: "m·K", from: ["T1", "T5"], compute: (a, b) => (A * (a - b)) / dist },
        { key: "Q", label: "Q", unit: "W", from: ["V", "dTw"], compute: (v, dT) => (v / 6e7) * 1000 * 4186 * dT },
      ],
      analysis: { x: "x", y: "Q", fit: "proporcional", results: [{ label: "k", unit: "W/(m·K)", compute: (b) => b, reference: 385 }] },
    };
    const rand = rng(5);
    const rows = [50, 60, 70, 80, 90, 100].map((Tq) => {
      const r = runTo({ ...base, Tq }, 30);
      expect(r.value("gap")).toBeLessThan(0.01);
      return measureRow(practice, { params: r.params, t: r.t, value: (k) => r.value(k) }, rand);
    });
    const res = analyze(practice, rows)!.results[0]!;
    expect(Math.abs(res.value / 385 - 1)).toBeLessThan(0.03);
  });

  it("prática (Newton): τ pelo ajuste exponencial de T − Ta contra t", () => {
    const base = { modo: 1, corpo: 1, Dc: 50, T0: 80, Ta: 22, modelo: 0, h: 10, ritmo: 100 };
    const tau = newtonTau(P(base));
    const practice: Practice = {
      id: "t", course: "Exp II", title: "t", sim: "conducao-calor", objective: "", materials: [], procedure: "", questions: [], params: base,
      columns: [
        { key: "t", label: "t", unit: "min", source: { observable: "tf" }, instrument: "cronometroManual", toUnit: 1 / 60 },
        { key: "T", label: "T", unit: "°C", source: { observable: "T" }, instrument: "termopar" },
        { key: "dT", label: "T − T_amb", unit: "K", from: ["T"], compute: (T) => T - 22 },
      ],
      analysis: { x: "t", y: "dT", fit: "exponencial", results: [{ label: "τ", unit: "s", compute: (_A, b) => -60 / b, reference: tau }] },
    };
    const rand = rng(9);
    const r = new Runner(sim, P(base));
    const rows = Array.from({ length: 8 }, (_, i) => {
      while (r.t < 3 + 7 * i - 1e-9) r.stepOnce();
      return measureRow(practice, { params: r.params, t: r.t, value: (k) => r.value(k) }, rand);
    });
    const res = analyze(practice, rows)!.results[0]!;
    expect(Math.abs(res.value / tau - 1)).toBeLessThan(0.03);
  });
});
