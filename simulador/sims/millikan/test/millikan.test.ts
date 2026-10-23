import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import {
  E_CHARGE,
  GAP,
  RETICLE,
  autoMeasure,
  balanceVoltage,
  chargeFromBalance,
  chargeFromVelocities,
  diffusion,
  drift,
  estimateE,
  fallSpeed,
  millikan as sim,
  radiusFromFall,
  type MKState,
} from "../src/index.ts";

const Tc = 23;

describe("Gota de óleo de Millikan", () => {
  it("análise com Cunningham recupera raio e carga exatos; Stokes puro superestima", () => {
    const r = 0.6e-6;
    const q = 3 * E_CHARGE;
    const V = 500;
    const vq = fallSpeed(r, Tc);
    const vs = drift(r, q, V / GAP, Tc);
    expect(radiusFromFall(vq, Tc, true) / r).toBeCloseTo(1, 10);
    expect(chargeFromVelocities(vq, vs, V, Tc, true) / q).toBeCloseTo(1, 10);
    expect(chargeFromBalance(vq, balanceVoltage(r, q), Tc, true) / q).toBeCloseTo(1, 10);
    expect(chargeFromVelocities(vq, vs, V, Tc, false) / q).toBeGreaterThan(1.1);
  });

  it("na tensão de equilíbrio a deriva é nula; v ∝ r² sem Cunningham (aproximadamente)", () => {
    const r = 1e-6;
    const q = 4 * E_CHARGE;
    expect(Math.abs(drift(r, q, balanceVoltage(r, q) / GAP, Tc))).toBeLessThan(1e-18);
    const ratio = fallSpeed(4e-6, Tc) / fallSpeed(2e-6, Tc);
    expect(ratio).toBeGreaterThan(3.85);
    expect(ratio).toBeLessThan(4);
  });

  it("movimento browniano: variância do deslocamento horizontal ≈ 2Dt", () => {
    const p = withOverrides(sim, { campo: 0 });
    const s0: MKState = { drops: [], sel: -1, seed: 7, nextId: 1, timer: null, tq: 0, ts: 0, Vs: 0, qs: [] };
    const r = 0.8e-6;
    const drops = Array.from({ length: 400 }, (_, i) => ({ id: i + 1, x: 0, y: GAP * 0.9, r, n: 1 }));
    let s: MKState = { ...s0, drops };
    const dt = sim.dt!;
    const steps = 20;
    for (let i = 0; i < steps; i++) s = sim.step!(s, p, i * dt, dt);
    const varx = s.drops.reduce((a, d) => a + d.x * d.x, 0) / s.drops.length;
    expect(varx / (2 * diffusion(r, Tc) * steps * dt)).toBeGreaterThan(0.8);
    expect(varx / (2 * diffusion(r, Tc) * steps * dt)).toBeLessThan(1.2);
  });

  it("cronômetro do retículo mede o tempo de queda da gota selecionada", () => {
    const p = withOverrides(sim, { campo: 0 });
    const run = new Runner(sim, p);
    const r = 1.2e-6;
    run.state = { ...run.state, drops: [{ id: 99, x: 0, y: GAP / 2 + 0.7e-3, r, n: 2 }], sel: 99 };
    for (let i = 0; i < 2000 && run.state.tq === 0; i++) run.stepOnce();
    const ideal = RETICLE / fallSpeed(r, Tc);
    expect(run.state.tq / ideal).toBeGreaterThan(0.93);
    expect(run.state.tq / ideal).toBeLessThan(1.07);
  });

  it("histograma de 100 gotas: cargas quantizadas e e estimado em 2 %", () => {
    const p = withOverrides(sim, sim.scenarios[1]!.params);
    let s = new Runner(sim, p).state;
    for (let i = 0; i < 4; i++) s = autoMeasure(s, p, 25);
    expect(s.qs.length).toBe(100);
    expect(estimateE(s.qs) / E_CHARGE).toBeGreaterThan(0.98);
    expect(estimateE(s.qs) / E_CHARGE).toBeLessThan(1.02);
    const noCorr = withOverrides(sim, { ...sim.scenarios[1]!.params, cunningham: 0 });
    let s2 = new Runner(sim, noCorr).state;
    for (let i = 0; i < 4; i++) s2 = autoMeasure(s2, noCorr, 25);
    const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
    expect(mean(s2.qs) / mean(s.qs)).toBeGreaterThan(1.05);
  });
});
