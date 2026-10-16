import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import { momentoAngular as sim, skaterI } from "../src/index.ts";

const run = (r: Runner<ReturnType<typeof sim.init>>, seconds: number) => {
  const n = Math.round(seconds / r.dt);
  for (let i = 0; i < n; i++) r.stepOnce();
};

describe("Conservação do momento angular", () => {
  it("patinadora fecha os braços: ω₂/ω₁ = I₁/I₂ e L constante", () => {
    const p = withOverrides(sim, { modo: 0, r: 0.8, mb: 3, Ic: 1, w0: 2 });
    const r = new Runner(sim, p);
    const L0 = r.value("Lz");
    expect(L0).toBeCloseTo(skaterI(p, 0.8) * 2, 12);
    r.setLiveParams({ ...p, r: 0.2 });
    run(r, 5);
    expect(r.value("rmao")).toBeCloseTo(0.2, 6);
    expect(r.value("Lz")).toBeCloseTo(L0, 10);
    expect(r.value("omega")).toBeCloseTo((2 * skaterI(p, 0.8)) / skaterI(p, 0.2), 5);
  });

  it("energia cinética K = L²/2I cresce: o trabalho dos músculos é ΔK", () => {
    const p = withOverrides(sim, { modo: 0, r: 0.9, mb: 4, Ic: 1.2, w0: 1.5 });
    const r = new Runner(sim, p);
    const K0 = r.value("K");
    r.setLiveParams({ ...p, r: 0.15 });
    run(r, 6);
    const ratio = skaterI(p, 0.9) / skaterI(p, 0.15);
    expect(r.value("K") / K0).toBeCloseTo(ratio, 5);
    expect(r.value("W")).toBeCloseTo(K0 * (ratio - 1), 4);
    // Abrindo de novo, K volta ao inicial
    r.setLiveParams({ ...p, r: 0.9 });
    run(r, 6);
    expect(r.value("K")).toBeCloseTo(K0, 4);
  });

  it("cadeira: inverter a roda faz I_c Ω = 2 I_r ω_r, com L_z total constante", () => {
    const p = withOverrides(sim, { modo: 1, Ic: 4, w0: 0, Iw: 0.15, ww: 25, beta: 0 });
    const r = new Runner(sim, p);
    const L0 = r.value("Lz");
    expect(L0).toBeCloseTo(0.15 * 25, 12);
    expect(r.value("omega")).toBeCloseTo(0, 12);
    r.setLiveParams({ ...p, beta: 90 });
    run(r, 2);
    expect(r.value("omega")).toBeCloseTo((0.15 * 25) / 4, 10);
    r.setLiveParams({ ...p, beta: 180 });
    run(r, 2);
    expect(r.value("omega")).toBeCloseTo((2 * 0.15 * 25) / 4, 10);
    expect(r.value("Lz")).toBeCloseTo(L0, 12);
    expect(r.value("W")).toBeCloseTo(0.5 * 4 * ((2 * 0.15 * 25) / 4) ** 2, 9);
  });

  it("ângulo de giro: φ = ω t quando I não muda", () => {
    const r = new Runner(sim, withOverrides(sim, { modo: 0, r: 0.5, w0: 3 }));
    run(r, 2);
    expect(r.state.phi).toBeCloseTo(6, 9);
  });
});
