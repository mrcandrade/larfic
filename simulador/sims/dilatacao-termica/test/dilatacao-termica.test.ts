import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import { LB, MATERIAIS, TAU_TERMO, bimetalCurvature, bimetalDeflection, dilatacaoTermica as sim, tauTube } from "../src/index.ts";

const P = (over: Record<string, number>) => withOverrides(sim, over);

function line(x: number[], y: number[]) {
  const n = x.length;
  const mx = x.reduce((s, v) => s + v, 0) / n;
  const my = y.reduce((s, v) => s + v, 0) / n;
  let sxy = 0;
  let sxx = 0;
  x.forEach((xi, i) => {
    sxy += (xi - mx) * (y[i]! - my);
    sxx += (xi - mx) ** 2;
  });
  const b = sxy / sxx;
  return { a: my - b * mx, b };
}

const run = (over: Record<string, number>, t: number) => {
  const r = new Runner(sim, P(over));
  while (r.t < t - 1e-9) r.stepOnce();
  return r;
};

describe("dilatômetro linear", () => {
  it("aquecimento exponencial exato: T(t) = T_f + (T₀ − T_f) e^(−t/τ)", () => {
    const over = { material: 0, aquec: 1, Tb: 80, T0: 20 };
    const tau = tauTube(P(over));
    expect(tau).toBeGreaterThan(0.5);
    expect(tau).toBeLessThan(5);
    const r = run(over, 2);
    expect(r.value("Ttubo")).toBeCloseTo(80 + (20 - 80) * Math.exp(-2 / tau), 9);
    // O vidro (mau condutor, parede grossa) demora mais que o latão; vapor é mais rápido que banho.
    expect(tauTube(P({ material: 4, aquec: 1 }))).toBeGreaterThan(tau);
    expect(tauTube(P({ material: 0, aquec: 0 }))).toBeLessThan(tau);
  });

  it("no equilíbrio, ΔL = α L₀ ΔT para todos os materiais (vapor)", () => {
    for (let i = 0; i < MATERIAIS.length; i++) {
      const r = run({ material: i, aquec: 0, T0: 22, L0: 0.6 }, 30);
      expect(r.value("T")).toBeCloseTo(100, 2);
      expect(r.value("dL")).toBeCloseTo(MATERIAIS[i]!.alpha * 0.6 * 78 * 1000, 4);
    }
  });

  it("o termômetro atrasa: durante o aquecimento o ponto (T lido, ΔL) fica acima da reta", () => {
    const over = { material: 0, aquec: 1, Tb: 90, T0: 22, L0: 0.5 };
    const r = run(over, 3);
    expect(r.value("T")).toBeLessThan(r.value("Ttubo") - 1);
    const dLreta = 19e-6 * 0.5 * (r.value("T") - 22) * 1000;
    expect(r.value("dL")).toBeGreaterThan(dLreta + 0.01);
    expect(TAU_TERMO).toBeGreaterThan(tauTube(P(over)) * 0.5);
  });

  it("prática: ΔL contra T (banho de 35 a 95 °C, leitura após 30 s) dá α e T₀", () => {
    for (const [material, alpha] of [[0, 19e-6], [2, 23e-6], [4, 3.3e-6]] as const) {
      const Ts: number[] = [];
      const dLs: number[] = [];
      for (let i = 0; i < 6; i++) {
        const r = run({ material, aquec: 1, Tb: 35 + 12 * i, T0: 22, L0: 0.5 }, 30);
        Ts.push(r.value("T"));
        dLs.push(r.value("dL"));
      }
      const fit = line(Ts, dLs);
      expect(fit.b / (0.5 * 1000) / alpha).toBeCloseTo(1, 3);
      expect(-fit.a / fit.b).toBeCloseTo(22, 1);
    }
  });

  it("lâmina bimetálica: κ ∝ Δα ΔT, flecha ≈ κL²/2 e inverte ao esfriar", () => {
    const pAl = P({ material: 2, T0: 20 });
    const pLat = P({ material: 0, T0: 20 });
    const pAco = P({ material: 3, T0: 20 });
    const k = bimetalCurvature(pLat, 80);
    expect(bimetalCurvature(pLat, 50)).toBeCloseTo(k / 2, 12);
    expect(bimetalCurvature(pLat, -10)).toBeCloseTo(-k / 2, 12);
    expect(bimetalCurvature(pAl, 80)).toBeGreaterThan(k);
    expect(bimetalCurvature(pAco, 80)).toBeLessThan(k);
    // Com E iguais a fórmula de Timoshenko dá κ = 1,5 Δα ΔT / h; latão/invar fica perto disso.
    expect(k / ((1.5 * (19e-6 - 1.2e-6) * 60) / 0.001)).toBeCloseTo(1, 1);
    expect(bimetalDeflection(pLat, 80)).toBeCloseTo((k * LB * LB) / 2, 3);
    const r = run({ material: 0, aquec: 1, Tb: 80, T0: 20, bimetal: 1 }, 30);
    expect(r.value("flecha")).toBeCloseTo(bimetalDeflection(pLat, 80) * 1000, 3);
  });
});
