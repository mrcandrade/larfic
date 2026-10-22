import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import { einsteinS, entropia as sim, entropyOf, kTEinstein, kineticEnergy, leftCounts, lnChoose, lnFact, lnOmegaEinstein, potentialEnergy, reverse, type EntState } from "../src/index.ts";

const make = (o: Record<string, number>) => new Runner<EntState>(sim, withOverrides(sim, o));
const run = (r: Runner<EntState>, n: number) => {
  for (let i = 0; i < n; i++) r.stepOnce();
  return r;
};

describe("entropia estatística", () => {
  it("combinatória: ln Ω e o limite de Stirling N ln 2", () => {
    expect(Math.exp(lnChoose(10, 5))).toBeCloseTo(252, 8);
    expect(Math.exp(lnOmegaEinstein(3, 4))).toBeCloseTo(15, 8); // C(6, 4)
    // ln C(N, N/2) ≈ N ln 2 − ½ ln(πN/2)
    const N = 1000;
    expect(lnChoose(N, N / 2)).toBeCloseTo(N * Math.LN2 - 0.5 * Math.log((Math.PI * N) / 2), 2);
    expect(lnFact(170)).toBeCloseTo(706.5731, 3);
    // Temperatura do sólido de Einstein: 1/T = dS/dq (diferença finita)
    const dS = (lnOmegaEinstein(300, 301) - lnOmegaEinstein(300, 299)) / 2;
    expect(Math.abs(1 / dS / kTEinstein(300, 300) - 1)).toBeLessThan(0.005);
  });

  it("expansão livre: S parte de 0 e chega perto de ln C(N, N/2) ≈ N k ln 2, conservando a energia", () => {
    const r = make({ modo: 0, N: 80 });
    expect(r.value("S")).toBe(0);
    expect(leftCounts(r.state).nL).toBe(80);
    const E0 = kineticEnergy(r.state) + potentialEnergy(r.state);
    run(r, 1500);
    expect(r.value("S")).toBeGreaterThan(0.9 * lnChoose(80, 40));
    expect(r.value("nL")).toBeGreaterThan(25);
    expect(r.value("nL")).toBeLessThan(55);
    const E = kineticEnergy(r.state) + potentialEnergy(r.state);
    expect(Math.abs(E / E0 - 1)).toBeLessThan(0.01);
  });

  it("seta do tempo: inverter cedo faz o gás voltar; inverter tarde (ou com erro) não", () => {
    const early = run(make({ modo: 0, N: 80 }), 400); // 16 τ
    expect(entropyOf(early.state)).toBeGreaterThan(20);
    early.setState(reverse(early.state, 0));
    run(early, 400);
    expect(leftCounts(early.state).nL).toBe(80);
    expect(entropyOf(early.state)).toBe(0);

    const late = run(make({ modo: 0, N: 80 }), 2500); // 100 τ
    late.setState(reverse(late.state, 0));
    run(late, 2500);
    expect(leftCounts(late.state).nL).toBeLessThan(70);

    const noisy = run(make({ modo: 0, N: 80 }), 400);
    noisy.setState(reverse(noisy.state, 1e-4));
    run(noisy, 400);
    expect(entropyOf(noisy.state)).toBeGreaterThan(5);
  });

  it("mistura: ΔS → N k ln 2; contato térmico: ΔS_total > 0 e T_A → T_B", () => {
    const m = run(make({ modo: 1, N: 80 }), 2000);
    expect(m.value("S")).toBeGreaterThan(0.75 * 80 * Math.LN2);

    const r = make({ modo: 2, NA: 300, NB: 100, qA: 40, qB: 360 });
    const S0 = r.value("S");
    let monotoneBreaks = 0;
    let last = S0;
    for (let i = 0; i < 3000; i++) {
      r.stepOnce();
      const S = r.value("S");
      if (S < last - 1e-9) monotoneBreaks++;
      last = S;
    }
    const e = einsteinS(r.state);
    expect(e.qA + e.qB).toBe(400); // energia conservada
    expect(r.value("dS")).toBeGreaterThan(150);
    // Partilha mais provável: q_A/N_A = q_B/N_B → q_A = 300
    expect(Math.abs(e.qA - 300)).toBeLessThan(30);
    expect(Math.abs(r.value("TA") / r.value("TB") - 1)).toBeLessThan(0.15);
    // A entropia flutua (é estatística), mas a tendência é crescer.
    expect(monotoneBreaks).toBeGreaterThan(0);
  });
});
