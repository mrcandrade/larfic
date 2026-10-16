import { describe, expect, it } from "vitest";
import { Runner, generateExercise, withOverrides } from "@fisilab/core";
import {
  C14_HALF_LIFE,
  MODO_CADEIA,
  MODO_DATACAO,
  datingAge,
  daughterTheory,
  decaimento as sim,
  fitExp,
  fitOf,
  lambda1,
  lambda2,
  sampleAge,
  type DecayState,
} from "../src/index.ts";

function runTo(params: Record<string, number>, t: number) {
  const r = new Runner<DecayState>(sim, withOverrides(sim, params));
  while (r.t < t - 1e-9 && !r.finished) r.stepOnce();
  return r;
}

describe("decaimento radioativo (Monte Carlo)", () => {
  it("após uma e duas meias-vidas restam ~1/2 e ~1/4 (dentro de 3σ binomiais)", () => {
    const N0 = 10000;
    const r1 = runTo({ N0, meiaVida: 2, seed: 7 }, 2);
    expect(Math.abs(r1.state.NP - N0 / 2)).toBeLessThan(3 * Math.sqrt(N0 * 0.25));
    const r2 = runTo({ N0, meiaVida: 2, seed: 7 }, 4);
    expect(Math.abs(r2.state.NP - N0 / 4)).toBeLessThan(3 * Math.sqrt(N0 * 0.25 * 0.75));
    expect(r2.state.NP + r2.state.ND).toBe(N0);
  });

  it("média sobre sementes segue N₀e^(−λt) e a variância é binomial", () => {
    const vals: number[] = [];
    for (let seed = 1; seed <= 40; seed++) vals.push(runTo({ N0: 400, meiaVida: 1, seed }, 1).state.NP);
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const v = vals.reduce((a, b) => a + (b - mean) ** 2, 0) / (vals.length - 1);
    expect(Math.abs(mean - 200)).toBeLessThan(3 * Math.sqrt(100 / 40));
    expect(v).toBeGreaterThan(40);
    expect(v).toBeLessThan(200);
  });

  it("o ajuste de ln N × t recupera a meia-vida dentro da incerteza", () => {
    const r = new Runner<DecayState>(sim, withOverrides(sim, { N0: 10000, meiaVida: 3, seed: 3 })).runToEnd(1000);
    expect(r.finished).toBe(true);
    const f = fitOf(r.state, r.params)!;
    expect(f.sigma).toBeGreaterThan(0);
    expect(Math.abs(f.lambda - Math.LN2 / 3)).toBeLessThan(4 * f.sigma + 0.01 * f.lambda);
    expect(r.value("Tfit")).toBeCloseTo(3, 0);
  });

  it("o ajuste é exato para dados sem ruído", () => {
    const ts = [0, 1, 2, 3, 4];
    const f = fitExp(ts, ts.map((t) => 5000 * Math.exp(-0.3 * t)))!;
    expect(f.lambda).toBeCloseTo(0.3, 10);
    expect(f.lnN0).toBeCloseTo(Math.log(5000), 10);
  });

  it("cadeia: filhos seguem Bateman e o máximo cai em ln(λ₂/λ₁)/(λ₂−λ₁)", () => {
    const params = { modo: MODO_CADEIA, N0: 10000, meiaVida: 6, meiaVida2: 1.5, seed: 11 };
    const p = withOverrides(sim, params);
    const l1 = lambda1(p), l2 = lambda2(p);
    const tm = Math.log(l2 / l1) / (l2 - l1);
    const r = runTo(params, tm);
    const th = daughterTheory(p, tm);
    expect(Math.abs(r.state.ND - th)).toBeLessThan(4 * Math.sqrt(th));
    expect(daughterTheory(p, tm)).toBeGreaterThan(daughterTheory(p, tm * 0.9));
    expect(daughterTheory(p, tm)).toBeGreaterThan(daughterTheory(p, tm * 1.1));
  });

  it("datação: a amostra começa com e^(−λ·idade) de C-14 e a idade estimada bate", () => {
    const params = { modo: MODO_DATACAO, N0: 10000, amostra: 3, seed: 5 };
    const age = sampleAge(3);
    const r = new Runner<DecayState>(sim, withOverrides(sim, params));
    const est = datingAge(r.state.NP, 10000);
    const sigma = C14_HALF_LIFE / Math.LN2 / Math.sqrt(r.state.NP);
    expect(Math.abs(est - age)).toBeLessThan(4 * sigma);
    expect(r.value("idade")).toBeCloseTo(est, 6);
  });

  it("exercício de carbono-14: 50 % ⇒ 5730 anos; 25 % ⇒ 11 460 anos", () => {
    const ex = sim.exercises!.find((e) => e.id === "carbono14")!;
    expect(ex.answer.compute({ frac: 50 })).toBeCloseTo(5730, 6);
    expect(ex.answer.compute({ frac: 25 })).toBeCloseTo(11460, 6);
    expect(Number.isFinite(generateExercise(sim, ex, 1).answer)).toBe(true);
  });

  it("mesma semente, mesmo resultado", () => {
    expect(runTo({ seed: 42 }, 3).state.NP).toBe(runTo({ seed: 42 }, 3).state.NP);
  });
});
