import { describe, expect, it } from "vitest";
import { Runner, defaultParams, withOverrides } from "@fisilab/core";
import {
  HBAR,
  KB,
  RB,
  dopplerLimit,
  ensembleT,
  equilibriumT,
  force,
  friction,
  lowSatT,
  maxLateralForce,
  measuredStiffness,
  resfriamentoLaser as sim,
  stiffnessX,
  trapped,
  tweezer,
  tweezerForce,
} from "../src/index.ts";

describe("Resfriamento a laser, MOT e pinça óptica", () => {
  it("limite Doppler do Rb: ħΓ/2k_B ≈ 146 μK, atingido em Δ = −Γ/2 a baixa intensidade", () => {
    expect(dopplerLimit() * 1e6).toBeCloseTo(145.6, 0);
    expect(equilibriumT(1e-4, -RB.Gamma / 2) / dopplerLimit()).toBeCloseTo(1, 3);
    expect(lowSatT(-RB.Gamma / 2)).toBeCloseTo(dopplerLimit(), 12);
    // é o mínimo em Δ
    for (const d of [-0.2, -0.35, -0.8, -2]) expect(equilibriumT(1e-4, d * RB.Gamma)).toBeGreaterThan(equilibriumT(1e-4, -0.5 * RB.Gamma));
  });

  it("força ímpar em v, atrito positivo só para dessintonia vermelha", () => {
    expect(force(1, 0.5, -RB.Gamma)).toBeCloseTo(-force(-1, 0.5, -RB.Gamma), 30);
    expect(friction(0.5, -RB.Gamma)).toBeGreaterThan(0);
    expect(friction(0.5, RB.Gamma)).toBeLessThan(0);
    // fórmula de baixa intensidade: β = 8ħk² s δ/(1 + 4δ²)²
    const s = 1e-3;
    expect(friction(s, -RB.Gamma / 2) / ((8 * HBAR * RB.k ** 2 * s * 0.5) / 4)).toBeCloseTo(1, 2);
  });

  it("melaço: temperatura do conjunto converge para k_B T = D/β", () => {
    const p = withOverrides(sim, { modo: 0, det: -0.5, s: 0.3, T0: 5 });
    const r = new Runner(sim, p);
    let acc = 0;
    let n = 0;
    for (let i = 0; i < 1200; i++) {
      r.stepOnce();
      if (i > 400) {
        acc += ensembleT(r.state, r.params);
        n++;
      }
    }
    const Teq = equilibriumT(0.3, -0.5 * RB.Gamma) * 1e6;
    expect(Math.abs(acc / n - Teq) / Teq).toBeLessThan(0.12);
  });

  it("MOT prende os átomos; com polarizações invertidas, não", () => {
    const run = (polar: number) => {
      const r = new Runner(sim, withOverrides(sim, { modo: 1, det: -1.5, s: 1, grad: 10, polar }));
      for (let i = 0; i < 1500; i++) r.stepOnce();
      return trapped(r.state);
    };
    expect(run(0)).toBeGreaterThan(200);
    expect(run(1)).toBeLessThan(20);
  });

  it("pinça: rigidez analítica = derivada numérica da força e ∝ potência", () => {
    const tw = tweezer(withOverrides(sim, { modo: 2 }));
    const h = 1e-9;
    const k = -(tweezerForce(tw, h, 0)[0] - tweezerForce(tw, -h, 0)[0]) / (2 * h);
    expect(k / stiffnessX(tw)).toBeCloseTo(1, 4);
    expect(stiffnessX({ ...tw, P: 2 * tw.P }) / stiffnessX(tw)).toBeCloseTo(2, 10);
    let best = 0;
    for (let x = 0; x < tw.w0; x += tw.w0 / 2000) best = Math.max(best, -tweezerForce(tw, x, 0)[0]);
    expect(best / maxLateralForce(tw)).toBeCloseTo(1, 3);
    // esfera de índice menor que o meio é repelida
    expect(tweezerForce({ ...tw, np: 1.2 }, 50e-9, 0)[0]).toBeGreaterThan(0);
  });

  it("pinça: equipartição recupera a rigidez a partir do movimento browniano", () => {
    const r = new Runner(sim, withOverrides(sim, { modo: 2 }));
    for (let i = 0; i < 6000; i++) r.stepOnce();
    const km = measuredStiffness(r.state);
    const kt = stiffnessX(tweezer(r.params)) * 1e6;
    expect(Math.abs(km - kt) / kt).toBeLessThan(0.2);
    expect(KB).toBeGreaterThan(0);
  });

  it("roda com parâmetros padrão", () => {
    const r = new Runner(sim, defaultParams(sim));
    r.stepOnce();
    for (const v of r.observe()) expect(Number.isFinite(v)).toBe(true);
  });
});
