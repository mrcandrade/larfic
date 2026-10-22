import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import {
  NS,
  gibbs,
  lissajousFourier as sim,
  lissajousPeriod,
  ratio,
  resultantAmp,
  rmsError,
  series,
  seriesFromSamples,
} from "../src/index.ts";

const P = (o: Record<string, number>) => withOverrides(sim, o);

describe("Lissajous e Fourier", () => {
  it("Lissajous 3:2 fecha após q/fₓ e 1:1 com 90° é um círculo", () => {
    const p = P({ modo: 0, fx: 2, fy: 3, fase: 30 });
    expect(ratio(2, 3)).toEqual([3, 2]);
    expect(lissajousPeriod(p)).toBeCloseTo(1, 12);
    const r = new Runner(sim, P({ modo: 0, fx: 1, fy: 1, fase: 90, A: 5, B: 5 }));
    for (let i = 0; i < 400; i++) {
      r.stepOnce();
      expect(Math.hypot(r.value("x"), r.value("y"))).toBeCloseTo(5, 9);
    }
  });

  it("mesma direção: amplitude resultante = √(A² + B² + 2AB cos φ)", () => {
    const p = P({ modo: 1, fx: 1, fy: 1, A: 6, B: 4, fase: 60 });
    const r = new Runner(sim, p);
    let mx = 0;
    while (r.t < 1.0) {
      r.stepOnce();
      mx = Math.max(mx, Math.abs(r.value("soma")));
    }
    expect(resultantAmp(p)).toBeCloseTo(Math.sqrt(36 + 16 + 48 * 0.5), 12);
    expect(mx).toBeCloseTo(resultantAmp(p), 3);
  });

  it("Blackburn com L = 4ℓ desenha 2:1 (y faz dois ciclos por ciclo de x)", () => {
    const p = P({ modo: 2, Lb: 1.6, lb: 0.4, gamma: 0, fase: 0, A: 8, B: 6 });
    const r = new Runner(sim, p);
    const Tx = 2 * Math.PI * Math.sqrt(1.6 / 9.81);
    while (r.t < Tx - 1e-9) r.stepOnce();
    expect(r.value("x")).toBeCloseTo(8, 3);
    expect(r.value("y")).toBeCloseTo(6, 3);
    expect(r.value("razao")).toBeCloseTo(2, 10);
  });

  it("FFT recupera coeficientes de uma soma de senos e cossenos", () => {
    const s = Array.from({ length: NS }, (_, j) => 0.3 + 0.8 * Math.sin((2 * Math.PI * j) / NS) - 0.5 * Math.cos((2 * Math.PI * 3 * j) / NS));
    const sr = seriesFromSamples(s, 5);
    expect(sr.a0).toBeCloseTo(0.3, 12);
    expect(sr.b[0]).toBeCloseTo(0.8, 12);
    expect(sr.a[2]).toBeCloseTo(-0.5, 12);
    expect(sr.b[1]).toBeCloseTo(0, 12);
  });

  it("onda quadrada: bₙ = 4/(nπ) e FFT do desenho quadrado concorda", () => {
    const p = P({ modo: 3, forma: 0, N: 7 });
    const sr = series(p, [], 7);
    expect(sr.b[0]).toBeCloseTo(4 / Math.PI, 12);
    expect(sr.b[1]).toBe(0);
    const sq = Array.from({ length: NS }, (_, j) => (j === 0 || j === NS / 2 ? 0 : j < NS / 2 ? 1 : -1));
    const f = seriesFromSamples(sq, 7);
    expect(f.b[0]!).toBeCloseTo(4 / Math.PI, 2);
  });

  it("Gibbs: sobressinal ~9% do salto e não some com N grande; erro RMS cai", () => {
    const g9 = gibbs(P({ modo: 3, forma: 0, N: 9 }), []);
    const g59 = gibbs(P({ modo: 3, forma: 0, N: 59 }), []);
    expect(g9).toBeGreaterThan(8);
    expect(g9).toBeLessThan(10);
    expect(g59).toBeCloseTo(8.95, 0);
    expect(rmsError(P({ modo: 3, forma: 0, N: 59 }), [])).toBeLessThan(rmsError(P({ modo: 3, forma: 0, N: 9 }), []));
    // Triangular quase sem sobressinal
    expect(gibbs(P({ modo: 3, forma: 1, N: 9 }), [])).toBeLessThan(0.5);
  });
});
