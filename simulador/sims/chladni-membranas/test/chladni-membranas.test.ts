import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import {
  DRUM,
  RECT,
  SQUARE,
  besselJ,
  besselZero,
  besselZeroP,
  chladniMembranas as sim,
  modeFreqs,
  modeList,
  waveSpeed,
} from "../src/index.ts";

const P = (o: Record<string, number>) => withOverrides(sim, o);

describe("Chladni e membranas", () => {
  it("funções de Bessel e zeros conhecidos", () => {
    expect(besselJ(0, 0)).toBeCloseTo(1, 12);
    expect(besselJ(1, 2)).toBeCloseTo(0.5767248078, 9);
    expect(besselZero(0, 1)).toBeCloseTo(2.404826, 5);
    expect(besselZero(1, 1)).toBeCloseTo(3.831706, 5);
    expect(besselZero(0, 2)).toBeCloseTo(5.520078, 5);
    expect(besselZeroP(1, 1)).toBeCloseTo(1.841184, 5);
    expect(besselZeroP(0, 1)).toBeCloseTo(3.831706, 5);
  });

  it("tambor: f₀₁ = j₀₁ c/(2πR) e razões não harmônicas", () => {
    const p = P({ geom: DRUM, L: 0.3, T: 2000, sigma: 0.25 });
    const fs = modeFreqs(p);
    expect(fs[0]).toBeCloseTo((2.404826 * waveSpeed(p)) / (2 * Math.PI * 0.15), 3);
    expect(fs[1]! / fs[0]!).toBeCloseTo(3.831706 / 2.404826, 5);
    expect(fs[2]! / fs[0]!).toBeCloseTo(5.135622 / 2.404826, 4);
  });

  it("membrana retangular: f_nm = (c/2)√((n/a)² + (m/b)²) e degenerescência para a = b", () => {
    const p = P({ geom: RECT, L: 0.4, beta: 0.5, T: 1000, sigma: 0.25 });
    const c = waveSpeed(p);
    expect(modeFreqs(p)[0]).toBeCloseTo((c / 2) * Math.sqrt(1 / 0.16 + 1 / 0.04), 6);
    const sq = modeFreqs(P({ geom: RECT, beta: 1 }));
    expect(sq[1]).toBeCloseTo(sq[2]!, 10);
    // Forma senoidal nula nas bordas
    const md = modeList(RECT, 0.5)[0]!;
    expect(md.psi(1, 0, 0)).toBeCloseTo(0, 12);
    expect(md.psi(0, 0.5, 0)).toBeCloseTo(0, 12);
  });

  it("placa quadrada: modo (n,m)− é nulo nas diagonais e f ∝ espessura", () => {
    const minus = modeList(SQUARE).find((m) => m.label === "(1,2)−")!;
    for (const u of [-0.8, -0.3, 0.1, 0.6]) expect(minus.psi(u, u, 0)).toBeCloseTo(0, 12);
    const f1 = modeFreqs(P({ geom: SQUARE, h: 1 }))[0]!;
    const f2 = modeFreqs(P({ geom: SQUARE, h: 2 }))[0]!;
    expect(f2 / f1).toBeCloseTo(2, 10);
  });

  it("areia migra para as linhas nodais num modo puro", () => {
    const r = new Runner(sim, P({ geom: SQUARE, excit: 1, kmode: 4 }));
    const n0 = r.value("nodal");
    for (let i = 0; i < 1000; i++) r.stepOnce();
    expect(n0).toBeLessThan(30);
    expect(r.value("nodal")).toBeGreaterThan(70);
  });

  it("na ressonância o modo dominante é o sintonizado; excitar sobre um nó não excita o modo", () => {
    const base = P({ geom: DRUM, excit: 0, Q: 100 });
    const fs = modeFreqs(base);
    const r = new Runner(sim, { ...base, f: fs[1]! });
    expect(r.value("jdom")).toBe(2);
    expect(r.value("fj")).toBeCloseTo(fs[1]!, 8);
    // O ponto padrão (r ≈ 0,437) fica sobre o círculo nodal do modo (0,2): j₀₂·r ≈ j₀₁.
    const r2 = new Runner(sim, { ...base, f: fs[3]! });
    expect(r2.value("jdom")).not.toBe(4);
  });
});
