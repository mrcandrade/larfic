import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import {
  conicalPeriod,
  kappa,
  periodNail,
  periodTorsion,
  pendulosEspeciais as sim,
  precessionTheory,
  waveLength,
  waveOmega,
} from "../src/index.ts";

const run = (params: Record<string, number>, tMax: number) => {
  const r = new Runner(sim, withOverrides(sim, params));
  while (r.t < tMax) r.stepOnce();
  return r;
};

describe("pêndulos especiais", () => {
  it("berço elástico: 1 entra, 1 sai com a mesma velocidade; momento conservado", () => {
    const p = { modo: 0, N: 5, k: 1, e: 1, theta0: 20, L: 0.3 };
    const r = new Runner(sim, withOverrides(sim, p));
    const T = 2 * Math.PI * Math.sqrt(0.3 / 9.81);
    // Logo depois do primeiro choque (≈ T/4), só a última esfera se move.
    while (r.t < T / 4 + 0.02) r.stepOnce();
    const w = r.state.y.slice(5);
    expect(Math.abs(w[0]!)).toBeLessThan(0.02 * Math.abs(w[4]!));
    const v0 = Math.sqrt(2 * 9.81 * 0.3 * (1 - Math.cos((20 * Math.PI) / 180)));
    // A última esfera saiu com v ≈ v0 (um pouco menor porque já subiu um pouco).
    expect(Math.abs(w[4]! * 0.3)).toBeGreaterThan(0.95 * v0);
    expect(r.value("nmov")).toBeLessThanOrEqual(1);
    // Ângulo máximo da última esfera ≈ θ₀
    let maxTh = 0;
    while (r.t < T / 2 + 0.05) {
      r.stepOnce();
      maxTh = Math.max(maxTh, r.value("thetaUlt"));
    }
    expect(maxTh).toBeCloseTo(20, 0);
  });

  it("berço: soltar 2 faz sair 2", () => {
    const r = run({ modo: 0, N: 5, k: 2, e: 1, theta0: 20, L: 0.3 }, 0.35);
    const th = r.state.y.slice(0, 5).map((v) => (v * 180) / Math.PI);
    expect(th[3]!).toBeGreaterThan(5);
    expect(th[4]!).toBeGreaterThan(5);
    expect(Math.abs(th[0]!)).toBeLessThan(2);
    expect(Math.abs(th[1]!)).toBeLessThan(2);
  });

  it("onda de pêndulos: L = g/ω² e realinhamento em t = Γ", () => {
    const p = withOverrides(sim, { modo: 1, Gamma: 60, K: 51 });
    expect(waveLength(p, 0)).toBeCloseTo(9.81 / ((2 * Math.PI * 51) / 60) ** 2, 10);
    for (let n = 0; n < 15; n++) expect(Math.cos(waveOmega(p, n) * 60)).toBeCloseTo(1, 9);
    // Em Γ/2, vizinhos em oposição de fase
    expect(Math.cos(waveOmega(p, 0) * 30) * Math.cos(waveOmega(p, 1) * 30)).toBeCloseTo(-1, 9);
  });

  it("torção: período medido = 2π√(I/κ) e κ = πGr⁴/(2ℓ)", () => {
    const params = { modo: 2, material: 0, dfio: 1, lfio: 0.6, m: 0.2, d: 0.1, corpo: 0, theta0: 60 };
    const p = withOverrides(sim, params);
    expect(kappa(p)).toBeCloseTo((Math.PI * 79e9 * 0.0005 ** 4) / 1.2, 12);
    const r = run(params, 3 * periodTorsion(p));
    expect(r.value("Tmed")).toBeCloseTo(periodTorsion(p), 3);
  });

  it("prego: período medido ≈ π√(L/g) + π√((L−h)/g) e mesma altura dos dois lados", () => {
    const params = { modo: 4, L: 1, h: 0.6, theta0: 4 };
    const p = withOverrides(sim, params);
    const r = new Runner(sim, p);
    const h0 = r.value("altura");
    let hMaxRight = 0;
    while (r.t < 3 * periodNail(p)) {
      r.stepOnce();
      if (r.state.y[0]! > 0) hMaxRight = Math.max(hMaxRight, r.value("altura"));
    }
    expect(r.value("Tmed")).toBeCloseTo(periodNail(p), 2);
    expect(hMaxRight).toBeCloseTo(h0, 4);
  });

  it("cônico: raio constante e período 2π√(L cos θ/g)", () => {
    const params = { modo: 3, L: 1, theta0: 30, vphi: 1 };
    const p = withOverrides(sim, params);
    const T = conicalPeriod(p, Math.PI / 6);
    const r = run(params, 2 * T);
    expect(r.value("theta")).toBeCloseTo(30, 2);
    expect(r.value("Taz")).toBeCloseTo(T, 2);
    expect(Math.abs(r.value("E") - r.samples[0]!.values[1]!) / r.value("E")).toBeLessThan(1e-6);
  });

  it("esférico: precessão da elipse ≈ (3/8) ω₀ ab/L²", () => {
    const params = { modo: 3, L: 1, theta0: 10, vphi: 0.4 };
    const p = withOverrides(sim, params);
    const r = run(params, 30);
    const teo = (precessionTheory(p) * 180) / Math.PI;
    expect(r.value("prec")).toBeGreaterThan(0.9 * teo);
    expect(r.value("prec")).toBeLessThan(1.1 * teo);
  });
});
