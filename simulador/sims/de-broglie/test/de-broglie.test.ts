import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import { NB, W_UM, binProbability, coherent, deBroglie as sim, density, slitsOf, visibility, wavelength, wavelengthClassic } from "../src/index.ts";

const burst = (p: Record<string, number>, times: number) => {
  const act = sim.actions!.find((a) => a.id === "mil")!;
  let s = new Runner(sim, p).state;
  for (let i = 0; i < times; i++) s = act.run(s, p);
  return s;
};

describe("De Broglie e fenda dupla", () => {
  it("λ a 50 kV ≈ 5,36 pm (relativístico) e 5,48 pm (clássico); 100 V ≈ 122,6 pm", () => {
    expect(wavelength(50e3) * 1e12).toBeCloseTo(5.355, 2);
    expect(wavelengthClassic(50e3) * 1e12).toBeCloseTo(5.485, 2);
    expect(wavelength(100) * 1e12).toBeCloseTo(122.6, 0);
  });

  it("mínimos de |ψ|² em y = (m + ½) λL/d e envelope zero em λL/a", () => {
    const s = slitsOf(withOverrides(sim, {}));
    const dy = (s.lambda * s.L) / s.d;
    expect(coherent(0.5 * dy, s)).toBeLessThan(1e-12);
    expect(coherent((s.lambda * s.L) / s.a, s)).toBeLessThan(1e-12);
    expect(coherent(0, s)).toBe(1);
  });

  it("histograma de 6000 elétrons converge para |ψ|² (qui-quadrado)", () => {
    const p = withOverrides(sim, {});
    const s = burst(p, 6);
    expect(s.n).toBe(6000);
    const f = density(p);
    const binW = (2 * W_UM) / NB;
    let chi2 = 0;
    let dof = 0;
    for (let i = 0; i < NB; i++) {
      const y1 = -W_UM + i * binW;
      const e = s.n * binProbability(f, y1, y1 + binW, W_UM, 1);
      if (e < 5) continue;
      chi2 += (s.hist[i]! - e) ** 2 / e;
      dof++;
    }
    expect(dof).toBeGreaterThan(30);
    expect(chi2 / dof).toBeLessThan(1.6);
  });

  it("detector de caminho destrói as franjas", () => {
    const base = withOverrides(sim, {});
    const dy = (wavelength(50e3) * 1) / 1.5e-6 * 1e6;
    const on = burst(withOverrides(sim, { detector: 1 }), 5);
    const off = burst(base, 5);
    expect(visibility(off.hist, W_UM, dy)).toBeGreaterThan(0.8);
    expect(Math.abs(visibility(on.hist, W_UM, dy))).toBeLessThan(0.15);
  });

  it("taxa ao vivo: elétrons por segundo", () => {
    const r = new Runner(sim, withOverrides(sim, { taxa: 100 }));
    for (let i = 0; i < 50; i++) r.stepOnce();
    expect(r.state.n).toBe(100);
  });

  it("fótons um a um: λ da luz, fendas × 100, franjas de 4,2 mm e acúmulo com franjas", () => {
    const p = withOverrides(sim, sim.scenarios.find((c) => c.id === "fotons")!.params);
    const sl = slitsOf(p);
    expect(sl.lambda).toBeCloseTo(633e-9, 15);
    expect(sl.d).toBeCloseTo(150e-6, 12);
    const r = new Runner(sim, p);
    expect(r.value("dy")).toBeCloseTo(4.22, 2);
    const s = burst(p, 4);
    expect(s.n).toBe(4000);
    expect(s.hits.every((h) => Math.abs(h.y) <= W_UM)).toBe(true);
    expect(visibility(s.hist, W_UM, r.value("dy"))).toBeGreaterThan(0.6);
    // a densidade (por mm) integra a 1 na tela
    const f = density(p);
    let tot = 0;
    for (let y = -W_UM; y < W_UM; y += 0.01) tot += f(y + 0.005) * 0.01;
    expect(tot).toBeCloseTo(1, 3);
  });
});
