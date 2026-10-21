import { describe, expect, it } from "vitest";
import { Runner, defaultParams, withOverrides } from "@fisilab/core";
import {
  TWO_PI,
  blochStep,
  blochVec,
  echoAnalytic,
  echoSet,
  echoSignal,
  groupDelay,
  measure,
  probPlus,
  qubitDoisNiveis as sim,
  rabiPe,
  response,
} from "../src/index.ts";

describe("Qubit: medida, Rabi, eco e EIT", () => {
  it("regra de Born: P(+) = cos²(θ/2) e frequência medida converge", () => {
    expect(probPlus(blochVec(Math.PI / 3, 0), [0, 0, 1])).toBeCloseTo(Math.cos(Math.PI / 6) ** 2, 12);
    const p = withOverrides(sim, { modo: 0, theta0: 60, eixo: 0, repreparar: 0 });
    const s = measure(sim.init(p), p, 20000);
    expect(Math.abs(s.nPlus / s.N - 0.75)).toBeLessThan(4 * Math.sqrt((0.75 * 0.25) / 20000));
  });

  it("colapso: medidas repetidas no mesmo qubit dão sempre o mesmo resultado", () => {
    const p = withOverrides(sim, { modo: 0, theta0: 90, eixo: 0, repreparar: 1 });
    const s = measure(sim.init(p), p, 200);
    expect([0, 200]).toContain(s.nPlus);
  });

  it("Rabi: integração de Bloch reproduz a fórmula com dessintonia", () => {
    const Om = TWO_PI * 1;
    const De = TWO_PI * 0.7;
    let r: [number, number, number] = [0, 0, -1];
    const h = 1e-3;
    for (let i = 0; i < 1300; i++) r = blochStep(r, { Omega: Om, Delta: De, phase: 0, T1: Infinity, T2: Infinity }, h);
    expect((1 + r[2]) / 2).toBeCloseTo(rabiPe(Om, De, 1.3), 6);
    expect(Math.hypot(...r)).toBeCloseTo(1, 8);
  });

  it("pulso π ressonante leva |g⟩ a |e⟩ e relaxação encolhe o vetor", () => {
    const p = withOverrides(sim, { modo: 1, Om: 1, De: 0, acion: 1 });
    const r = new Runner(sim, p);
    const act = sim.actions!.find((a) => a.id === "pix")!;
    r.setState(act.run(r.state, r.params));
    for (let i = 0; i < 200; i++) r.stepOnce();
    expect(r.state.r[2]).toBeCloseTo(1, 4);
    const d = { Omega: 0, Delta: 0, phase: 0, T1: 2, T2: 1 };
    let v: [number, number, number] = [1, 0, 0];
    for (let i = 0; i < 1000; i++) v = blochStep(v, d, 1e-3);
    expect(v[0]).toBeCloseTo(Math.exp(-1), 6);
    expect(v[2]).toBeCloseTo(-(1 - Math.exp(-0.5)), 6);
  });

  it("eco: sinal some no FID e volta em 2τ; pulso de 90° dá metade", () => {
    const set = echoSet(1, 4000);
    const tau = 1.5;
    expect(echoSignal(set, 1.0, tau, Math.PI / 2, Math.PI, Infinity)).toBeLessThan(0.05);
    expect(echoSignal(set, 2 * tau, tau, Math.PI / 2, Math.PI, Infinity)).toBeCloseTo(1, 6);
    expect(echoSignal(set, 2 * tau, tau, Math.PI / 2, Math.PI / 2, Infinity)).toBeCloseTo(0.5, 2);
    expect(echoSignal(set, 2 * tau, tau, Math.PI / 2, Math.PI, 5)).toBeCloseTo(echoAnalytic(2 * tau, tau, 1, Math.PI / 2, Math.PI, 5), 6);
  });

  it("EIT: transparência em δ = 0, lorentziana sem acoplamento e luz lenta τg = OD/Ωc²", () => {
    const two = { Oc: 0, Dc: 0, g21: 0, config: 2 };
    expect(response(0, two).re).toBeCloseTo(1, 12);
    expect(response(0.5, two).re).toBeCloseTo(0.5, 12);
    const lam = { Oc: 1, Dc: 0, g21: 1e-6, config: 0 };
    expect(response(0, lam).re).toBeLessThan(1e-4);
    expect(groupDelay(0, { ...lam, Oc: 0.5 }, 4)).toBeCloseTo(4 / 0.25, 1);
    // Autler–Townes: picos em ±Ωc/2 para acoplamento forte
    const at = { Oc: 4, Dc: 0, g21: 1e-6, config: 0 };
    let best = 0;
    let arg = 0;
    for (let x = 0.5; x < 4; x += 0.001) if (response(x, at).re > best) [best, arg] = [response(x, at).re, x];
    expect(arg).toBeCloseTo(2, 1);
  });

  it("roda com parâmetros padrão", () => {
    const r = new Runner(sim, defaultParams(sim));
    for (let i = 0; i < 50; i++) r.stepOnce();
    for (const v of r.observe()) expect(Number.isFinite(v)).toBe(true);
  });
});
