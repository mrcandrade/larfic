import { describe, expect, it } from "vitest";
import { Runner, rad, withOverrides } from "@fisilab/core";
import { empuxo as sim, heel, hullOf, metacentric, rollPeriod } from "../src/index.ts";

const P = (o: Record<string, number>) => withOverrides(sim, o);

describe("Empuxo e estabilidade", () => {
  it("casco aprumado: B a T/2 da quilha; pequenas inclinações dão GZ ≈ GM sen θ", () => {
    const h = hullOf(P({ modo: 0, B: 6, Hc: 3, T: 1.2, KG: 1.8 }));
    const h0 = heel(h, 0);
    expect(h0.Bc[1] - h0.w).toBeCloseTo(-0.6, 9);
    expect(h0.GZ).toBeCloseTo(0, 9);
    const mc = metacentric(h);
    expect(mc.GM).toBeCloseTo(0.6 + 36 / 14.4 - 1.8, 12);
    const th = rad(1.5);
    expect(heel(h, th).GZ / (mc.GM * Math.sin(th))).toBeCloseTo(1, 2);
    // Costado vertical (exato até o convés molhar): GZ = sen θ (GM + ½ BM tg²θ)
    const t2 = rad(20);
    expect(heel(h, t2).GZ).toBeCloseTo(Math.sin(t2) * (mc.GM + 0.5 * mc.BM * Math.tan(t2) ** 2), 6);
  });

  it("período de rolagem = 2π k/√(g GM) para pequenas amplitudes", () => {
    const p = P({ modo: 0, B: 6, Hc: 3, T: 1.2, KG: 1.8, theta0: 1, zeta: 0 });
    const r = new Runner(sim, p);
    const crossings: number[] = [];
    let prev = r.value("theta");
    while (r.t < 12) {
      r.stepOnce();
      const cur = r.value("theta");
      if (prev > 0 && cur <= 0) crossings.push(r.t);
      prev = cur;
    }
    const T = (crossings[2]! - crossings[0]!) / 2;
    expect(T / rollPeriod(hullOf(p))).toBeCloseTo(1, 2);
    // Sem amortecimento a energia (cinética + ρg∇∫GZ dθ) se conserva
    const r2 = new Runner(sim, P({ modo: 0, theta0: 30, zeta: 0 }));
    const E0 = r2.value("Emec");
    while (r2.t < 3) r2.stepOnce();
    expect(Math.abs(r2.value("Emec") - E0) / E0).toBeLessThan(1e-4);
  });

  it("carga deslocada: banda final satisfaz tg θ (GM + ½ BM tg²θ) = −x_G", () => {
    const p = P({ modo: 0, B: 6, Hc: 3, T: 1.2, KG: 1.8, xG: 0.3, theta0: 0, zeta: 0.8 });
    const r = new Runner(sim, p);
    while (r.t < 40) r.stepOnce();
    const th = rad(r.value("theta"));
    const mc = metacentric(hullOf(p));
    const tn = Math.tan(th);
    expect(tn * (mc.GM + 0.5 * mc.BM * tn * tn)).toBeCloseTo(-0.3, 4);
    expect(th).toBeLessThan(0);
  });

  it("GM < 0: uma inclinação pequena cresce (tombamento)", () => {
    const r = new Runner(sim, P({ modo: 0, B: 4, Hc: 4, T: 1.5, KG: 2.6, theta0: 2, zeta: 0 }));
    while (r.t < 1.5) r.stepOnce();
    expect(Math.abs(r.value("theta"))).toBeGreaterThan(10);
  });

  it("dinamômetro: leitura = mg − ρ g a³ depois de submerso, independente da profundidade", () => {
    const r = new Runner(sim, P({ modo: 1, a: 10, rhoB: 2700, rhoF: 1000, vd: 0.5 }));
    const readings: number[] = [];
    while (!r.finished) {
      r.stepOnce();
      if (r.value("prof") > 12) readings.push(r.value("Pap"));
    }
    const expected = (2700 - 1000) * 9.81 * 1e-3;
    expect(readings.length).toBeGreaterThan(10);
    for (const v of readings) expect(v).toBeCloseTo(expected, 9);
    // Meio submerso: mg − ρ g a² (a/2)
    const r2 = new Runner(sim, P({ modo: 1, a: 10, rhoB: 2700, rhoF: 1000, vd: 0.5 }));
    while (r2.value("prof") < 5 - 1e-9) r2.stepOnce();
    expect(r2.value("Pap")).toBeCloseTo(2700 * 9.81 * 1e-3 - 1000 * 9.81 * 0.01 * r2.value("prof") / 100, 9);
  });

  it("bloco solto: período 2π√(ρc a/(ρf g)), energia conservada e fração submersa ρc/ρf", () => {
    const o = { modo: 2, a: 10, rhoB: 500, rhoF: 1000, y0: -0.6, zeta: 0 };
    const r = new Runner(sim, P(o));
    const E0 = r.value("Emec");
    const ups: number[] = [];
    let prev = r.value("prof") - 5;
    while (r.t < 2) {
      r.stepOnce();
      const cur = r.value("prof") - 5;
      if (prev < 0 && cur >= 0) ups.push(r.t);
      prev = cur;
    }
    expect(Math.abs(r.value("Emec") - E0) / E0).toBeLessThan(1e-6);
    const T = ups[1]! - ups[0]!;
    expect(T).toBeCloseTo(2 * Math.PI * Math.sqrt((500 * 0.1) / (1000 * 9.81)), 2);
    const r2 = new Runner(sim, P({ ...o, y0: 0.5, zeta: 0.4 }));
    while (r2.t < 10) r2.stepOnce();
    expect(r2.value("frac")).toBeCloseTo(0.5, 4);
  });
});
