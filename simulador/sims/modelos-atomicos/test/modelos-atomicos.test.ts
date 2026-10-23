import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import {
  BIN_DEG,
  NBINS,
  expectedCount,
  lineNm,
  modelosAtomicos as sim,
  rutherfordAngle,
  rutherfordTrajectory,
  thomsonMaxAngle,
} from "../src/index.ts";

describe("Modelos atômicos", () => {
  it("trajetória integrada reproduz tan(θ/2) = d/2b", () => {
    for (const b of [0.05, 0.5, 2, 6]) {
      const tr = rutherfordTrajectory(b);
      expect(tr.theta).toBeCloseTo(rutherfordAngle(tr.b), 4);
    }
    expect((rutherfordAngle(0.5) * 180) / Math.PI).toBeCloseTo(90, 10);
  });

  it("histograma segue a contagem esperada de Rutherford (qui-quadrado)", () => {
    const p = withOverrides(sim, { modo: 0, bmax: 4 });
    const r = new Runner(sim, p);
    let s = r.state;
    const burst = sim.actions!.find((a) => a.id === "rajada")!;
    for (let i = 0; i < 4; i++) s = burst.run(s, p);
    expect(s.n).toBe(8000);
    let chi2 = 0;
    let dof = 0;
    for (let i = 0; i < NBINS; i++) {
      const t1 = (i * BIN_DEG * Math.PI) / 180;
      const t2 = ((i + 1) * BIN_DEG * Math.PI) / 180;
      const e = expectedCount(t1, t2, s.n, 4);
      if (e < 5) continue;
      chi2 += (s.hist[i]! - e) ** 2 / e;
      dof++;
    }
    expect(dof).toBeGreaterThan(10);
    expect(chi2 / dof).toBeLessThan(2.5);
    // fração para trás ≈ (d/2bmax)² = 1/64
    expect(s.back / s.n).toBeCloseTo(1 / 64, 2);
  });

  it("Thomson: desvio máximo ~ d/R, nenhum retroespalhamento", () => {
    expect(thomsonMaxAngle(100)).toBeLessThan(0.01);
    expect(thomsonMaxAngle(1000)).toBeLessThan(thomsonMaxAngle(100) / 5);
    const p = withOverrides(sim, { modo: 1, R: 100 });
    const s = sim.actions!.find((a) => a.id === "rajada")!.run(new Runner(sim, p).state, p);
    expect(s.back).toBe(0);
  });

  it("Bohr: Hα ≈ 656,5 nm, limite de Balmer ≈ 364,7 nm, Lyman α ≈ 121,6 nm", () => {
    expect(lineNm(3, 2, 1)).toBeCloseTo(656.5, 0);
    expect(lineNm(1000, 2, 1)).toBeCloseTo(364.7, 0);
    expect(lineNm(2, 1, 1)).toBeCloseTo(121.6, 0);
    expect(lineNm(4, 3, 2) / lineNm(2, 1, 1)).toBeGreaterThan(3);
  });

  it("lâmpada: só aparecem linhas permitidas com energia conservada", () => {
    const r = new Runner(sim, withOverrides(sim, { modo: 2, bohrModo: 0, ni: 5 }));
    for (let i = 0; i < 3000; i++) r.stepOnce();
    expect(r.state.lines.length).toBeGreaterThan(5);
    for (const l of r.state.lines) expect(l.ni).toBeGreaterThan(l.nf);
    expect(r.state.lines.every((l) => l.ni <= 5)).toBe(true);
  });
});
