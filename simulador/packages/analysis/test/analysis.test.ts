import { describe, expect, it } from "vitest";
import { rng } from "@fisilab/core";
import {
  betaInc, chi2Q, compatibility, fitExponential, fitLine, fitNonlinear, fitPoly, fitPower, fitProportional,
  formatMeasured, instruments, mean, micrometerReading, propagate, read, roundResult, stdErr, stdev, studentT, vernierReading,
} from "../src/index.ts";

describe("estatística", () => {
  it("média e desvio padrão amostral", () => {
    const x = [2, 4, 4, 4, 5, 5, 7, 9];
    expect(mean(x)).toBe(5);
    expect(stdev(x)).toBeCloseTo(Math.sqrt(32 / 7), 12);
    expect(stdErr(x)).toBeCloseTo(Math.sqrt(32 / 7) / Math.sqrt(8), 12);
  });
  it("t de Student tabelado", () => {
    expect(studentT(0.95, 1)).toBeCloseTo(12.706, 2);
    expect(studentT(0.95, 9)).toBeCloseTo(2.262, 3);
    expect(studentT(0.95, 1000)).toBeCloseTo(1.962, 2);
  });
  it("beta incompleta e χ²", () => {
    expect(betaInc(0.5, 2, 2)).toBeCloseTo(0.5, 12);
    expect(chi2Q(3.841, 1)).toBeCloseTo(0.05, 3);
    expect(chi2Q(18.307, 10)).toBeCloseTo(0.05, 3);
  });
});

describe("ajustes", () => {
  it("reta exata sem ruído", () => {
    const x = [0, 1, 2, 3, 4];
    const r = fitLine(x, x.map((t) => 2 + 3 * t));
    expect(r.p[0]).toBeCloseTo(2, 10);
    expect(r.p[1]).toBeCloseTo(3, 10);
    expect(r.r2).toBeCloseTo(1, 12);
  });
  it("incertezas da reta batem com as fórmulas clássicas", () => {
    const x = [1, 2, 3, 4, 5, 6];
    const y = [2.1, 3.9, 6.2, 7.8, 10.1, 12.2];
    const r = fitLine(x, y);
    const n = 6, sx = x.reduce((a, b) => a + b), sxx = x.reduce((a, b) => a + b * b);
    const D = n * sxx - sx * sx;
    const s2 = r.chi2 / (n - 2);
    expect(r.sigma[1]).toBeCloseTo(Math.sqrt((n * s2) / D), 10);
    expect(r.sigma[0]).toBeCloseTo(Math.sqrt((sxx * s2) / D), 10);
  });
  it("pesos: σ_b = 1/√Σ(x²/σ²) na proporcional", () => {
    const x = [1, 2, 3], sy = [0.1, 0.2, 0.3];
    const r = fitProportional(x, [2, 4, 6], sy);
    expect(r.p[0]).toBeCloseTo(2, 12);
    expect(r.sigma[0]).toBeCloseTo(1 / Math.sqrt(x.reduce((a, xi, i) => a + (xi / sy[i]!) ** 2, 0)), 12);
  });
  it("polinômio de grau 2 (queda livre: y = y0 + v0 t − g t²/2)", () => {
    const t = [0, 0.1, 0.2, 0.3, 0.4, 0.5];
    const r = fitPoly(t, t.map((s) => 1.5 + 0.3 * s - 4.905 * s * s), 2);
    expect(-2 * r.p[2]!).toBeCloseTo(9.81, 8);
  });
  it("Levenberg–Marquardt recupera oscilação amortecida", () => {
    const model = (t: number, p: readonly number[]) => p[0]! * Math.exp(-p[1]! * t) * Math.cos(p[2]! * t);
    const t = Array.from({ length: 80 }, (_, i) => i * 0.05);
    const rand = rng(3);
    const y = t.map((s) => model(s, [2, 0.4, 6]) + 0.01 * (rand() - 0.5));
    const r = fitNonlinear(t, y, model, [1.5, 0.2, 5.8]);
    expect(r.p[0]).toBeCloseTo(2, 2);
    expect(r.p[1]).toBeCloseTo(0.4, 2);
    expect(r.p[2]).toBeCloseTo(6, 2);
  });
  it("exponencial e potência por linearização", () => {
    const x = [1, 2, 3, 4];
    expect(fitExponential(x, x.map((t) => 5 * Math.exp(-0.7 * t))).p[1]).toBeCloseTo(-0.7, 10);
    expect(fitPower(x, x.map((t) => 2 * t ** 1.5)).p[1]).toBeCloseTo(1.5, 10);
  });
});

describe("incertezas", () => {
  it("propagação de g = 4π²L/T²", () => {
    const L = { value: 1, u: 0.001 }, T = { value: 2.006, u: 0.004 };
    const r = propagate((l, t) => (4 * Math.PI ** 2 * l) / (t * t), [L, T]);
    const rel = Math.sqrt((0.001 / 1) ** 2 + (2 * 0.004 / 2.006) ** 2);
    expect(r.u / r.value).toBeCloseTo(rel, 6);
  });
  it("arredondamento do resultado", () => {
    expect(formatMeasured(9.7934, 0.0427, "m/s²")).toBe("(9,79 ± 0,04) m/s²");
    expect(formatMeasured(9.7934, 0.0147, "m/s²")).toBe("(9,793 ± 0,015) m/s²");
    expect(formatMeasured(123.45, 0.96)).toBe("(123,5 ± 1,0)");
    expect(formatMeasured(6.626e-34, 0.052e-34, "J·s")).toBe("(6,63 ± 0,05) × 10^-34 J·s");
    expect(roundResult(1234.5, 23).value).toBe("1230");
  });
  it("compatibilidade", () => {
    expect(compatibility({ value: 9.79, u: 0.04 }, { value: 9.81, u: 0 }).compatible).toBe(true);
    expect(compatibility({ value: 9.6, u: 0.04 }, { value: 9.81, u: 0 }).compatible).toBe(false);
  });
});

describe("instrumentos", () => {
  it("paquímetro quantiza em 0,05 mm e lê o nônio", () => {
    const r = read(instruments.paquimetro, 23.437, rng(1));
    expect(r.value).toBeCloseTo(23.45, 10);
    expect(r.display).toBe("23,45");
    expect(vernierReading(23.437)).toEqual({ main: 23, vernierLine: 9, value: expect.closeTo(23.45, 10) });
    expect(micrometerReading(5.783)).toEqual({ sleeve: 5.5, drum: 28, value: expect.closeTo(5.78, 10) });
  });
  it("multímetro fora da escala mostra OL", () => {
    expect(read(instruments.voltimetro, 25, rng(1)).display).toBe("OL");
  });
  it("cronômetro manual espalha com o tempo de reação", () => {
    const rand = rng(7);
    const xs = Array.from({ length: 400 }, () => read(instruments.cronometroManual, 2, rand).value);
    expect(stdev(xs)).toBeGreaterThan(0.06);
    expect(stdev(xs)).toBeLessThan(0.1);
    expect(mean(xs)).toBeCloseTo(2, 1);
  });
});

import { analyze, measureRow, reportMarkdown, rowsToCsv, type Practice } from "../src/index.ts";

describe("prática", () => {
  const practice: Practice = {
    id: "teste-pendulo",
    course: "Exp I",
    title: "Pêndulo simples (período vs comprimento e amplitude)",
    sim: "pendulos",
    objective: "Medir g.",
    materials: [],
    procedure: "",
    columns: [
      { key: "L", label: "L", unit: "m", source: { param: "L" }, instrument: "trena" },
      { key: "t10", label: "10 T", unit: "s", source: { observable: "T" }, instrument: "cronometroManual", times: 10, repeat: 3 },
      { key: "T2", label: "T²", unit: "s²", from: ["t10"], compute: (t) => (t / 10) ** 2 },
    ],
    analysis: { x: "L", y: "T2", fit: "proporcional", results: [{ label: "g", unit: "m/s²", compute: (b) => (4 * Math.PI ** 2) / b, reference: 9.81 }] },
    questions: ["Por que medir 10 oscilações?"],
  };
  it("mede, ajusta e recupera g compatível", () => {
    const rand = rng(11);
    const rows = [0.3, 0.5, 0.7, 0.9, 1.1, 1.3].map((L) =>
      measureRow(practice, { params: { L }, t: 0, value: () => 2 * Math.PI * Math.sqrt(L / 9.81) }, rand),
    );
    expect(rows[0]!.t10!.readings).toHaveLength(3);
    const res = analyze(practice, rows)!;
    expect(res.results[0]!.value).toBeGreaterThan(9.5);
    expect(res.results[0]!.value).toBeLessThan(10.1);
    expect(res.results[0]!.compatible).toBe(true);
    expect(rowsToCsv(practice, rows).split("\n")).toHaveLength(7);
    expect(reportMarkdown(practice, rows, res)).toContain("**g** = (");
  });
});
