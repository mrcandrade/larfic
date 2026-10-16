import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import {
  HBAR_OVER_M,
  X0,
  evolve,
  fft,
  firstMin,
  packetStats,
  planeSum,
  planeSumUncertainty,
  sigmaT,
  slitIntensity,
  incerteza as sim,
} from "../src/index.ts";

describe("Pacotes de onda e incerteza", () => {
  it("FFT: ida e volta recupera o sinal e Parseval vale", () => {
    const n = 64;
    const re = new Float64Array(n).map((_, i) => Math.sin(i) + 0.3 * i);
    const im = new Float64Array(n).map((_, i) => Math.cos(2 * i));
    const r0 = re.slice();
    const e0 = re.reduce((a, v, i) => a + v * v + im[i]! ** 2, 0);
    fft(re, im);
    const e1 = re.reduce((a, v, i) => a + v * v + im[i]! ** 2, 0) / n;
    expect(e1).toBeCloseTo(e0, 8);
    fft(re, im, true);
    for (let i = 0; i < n; i++) expect(re[i]).toBeCloseTo(r0[i]!, 10);
  });

  it("pacote gaussiano: Δx·Δk = 1/2 e Δx = σ₀ em t = 0", () => {
    const st = packetStats(evolve(0.5, 10, 0));
    expect(st.dx).toBeCloseTo(0.5, 6);
    expect(st.dk).toBeCloseTo(1, 4);
    expect(st.dx * st.dk).toBeCloseTo(0.5, 4);
    expect(st.norm).toBeCloseTo(1, 8);
  });

  it("evolução livre: anda com v_g e alarga como σ(t); sem dispersão não alarga", () => {
    const t = 15;
    const st = packetStats(evolve(0.5, 10, t, true));
    expect(st.mean).toBeCloseTo(X0 + HBAR_OVER_M * 10 * t, 3);
    expect(st.dx).toBeCloseTo(sigmaT(0.5, t), 3);
    expect(st.dk).toBeCloseTo(1, 4);
    expect(st.norm).toBeCloseTo(1, 8);
    const nd = packetStats(evolve(0.5, 10, t, false));
    expect(nd.dx).toBeCloseTo(0.5, 4);
  });

  it("soma de muitas ondas planas tende a Δx·Δk = 1/2; uma só tem Δk = 0", () => {
    const u = planeSumUncertainty(planeSum(60, 10, 1));
    expect(u.dk).toBeCloseTo(1, 1);
    expect(u.product).toBeGreaterThan(0.49);
    expect(u.product).toBeLessThan(0.52);
    expect(planeSumUncertainty(planeSum(1, 10, 1)).dk).toBe(0);
    expect(planeSum(5, 10, 1).period).toBeCloseTo((2 * Math.PI * 4) / 10, 12);
  });

  it("fenda: primeiro mínimo em a sen θ = λ e histograma segue sinc²", () => {
    const th = firstMin(2000, 500);
    expect(Math.sin(th)).toBeCloseTo(0.25, 12);
    expect(slitIntensity(th, 2000, 500)).toBeCloseTo(0, 12);
    const r = new Runner(sim, withOverrides(sim, { modo: 2, a: 2, lam: 500 }));
    r.runToEnd(40);
    const h = r.state.hist;
    const n = h.reduce((a, b) => a + b, 0);
    expect(n).toBeGreaterThan(1500);
    const c = (h.length - 1) / 2;
    // o bin central tem muito mais chegadas que a região do primeiro mínimo
    expect(h[c]!).toBeGreaterThan(10 * Math.max(1, h[Math.round(c * (1 + 1 / 3.2))]!));
  });

  it("runner do pacote livre conserva a norma", () => {
    const r = new Runner(sim, withOverrides(sim, { modo: 1, sigx: 0.4, k0: 8 }));
    for (let i = 0; i < 100; i++) r.stepOnce();
    expect(r.value("norma")).toBeCloseTo(1, 8);
    expect(r.value("dx")).toBeCloseTo(r.value("sigA"), 3);
  });
});
