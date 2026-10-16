import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import { transferenciaCalor as sim } from "../src/index.ts";
import { BODY_A, BODY_C, SIGMA, bodyEquilibrium, bodyPowers, greenhouse, meshOf, steadyFlux, surfaceTemps, wallFluxes } from "../src/physics.ts";

describe("transferencia-calor", () => {
  it("parede composta: regime estacionário das diferenças finitas = ΔT/ΣR, perfil linear por camada", () => {
    const p = withOverrides(sim, { m1: 5, e1: 1.5, m2: 0, e2: 10, m3: 2, e3: 3, Tq: 22, Tf: 2, hi: 8, he: 25, ritmo: 5000 });
    const R = 1 / 8 + 0.015 / 0.25 + 0.1 / 0.72 + 0.03 / 0.035 + 1 / 25;
    expect(steadyFlux(p)).toBeCloseTo(20 / R, 10);
    const r = new Runner(sim, p);
    while (r.state.tp < 2e6) r.stepOnce();
    const { qIn, qOut } = wallFluxes(r.state.wall, p);
    expect(qIn).toBeCloseTo(20 / R, 4);
    expect(qOut).toBeCloseTo(20 / R, 4);
    // Face interna: Tq − q/hᵢ
    expect(surfaceTemps(r.state.wall, p).si).toBeCloseTo(22 - 20 / R / 8, 3);
    // Dentro do tijolo a temperatura é linear (diferenças centrais nulas)
    const m = meshOf(p);
    const i = m.x.findIndex((x) => x > 0.06);
    const T = r.state.wall;
    expect(T[i - 1]! - 2 * T[i]! + T[i + 1]!).toBeCloseTo(0, 6);
  });

  it("sem radiação e sem aquecedor: resfriamento exponencial de Newton, τ = C/hA", () => {
    const p = withOverrides(sim, { T0: 90, Ta: 20, h: 12, eps: 0, P: 0, ritmo: 100 });
    const r = new Runner(sim, p);
    while (r.state.tp < 1800 - 1e-9) r.stepOnce();
    const tau = BODY_C / (12 * BODY_A);
    expect(r.value("T")).toBeCloseTo(20 + 70 * Math.exp(-r.state.tp / tau), 6);
  });

  it("aquecedor: o corpo tende ao equilíbrio P = hAΔT + εσA(T⁴ − Ta⁴)", () => {
    const p = withOverrides(sim, { T0: 20, Ta: 20, h: 10, eps: 0.9, P: 40, ritmo: 2000 });
    const Teq = bodyEquilibrium(p);
    const w = bodyPowers(Teq, p);
    expect(w.conv + w.rad).toBeCloseTo(40, 6);
    const r = new Runner(sim, p);
    while (r.state.tp < 1e5) r.stepOnce();
    expect(r.value("T")).toBeCloseTo(Teq, 3);
    // Sem convecção, a solução é algébrica
    const q = withOverrides(sim, { Ta: 20, h: 1e-9, eps: 1, P: 30 });
    expect(bodyEquilibrium(q)).toBeCloseTo((30 / (SIGMA * BODY_A) + 293.15 ** 4) ** 0.25 - 273.15, 4);
  });

  it("efeito estufa: Tₑ ≈ 255 K para a Terra; ε = 1 dá 2^{1/4} Tₑ", () => {
    const g0 = greenhouse(withOverrides(sim, { S: 1361, alb: 0.3, epsA: 0 }));
    expect(g0.Te).toBeCloseTo(254.6, 1);
    expect(g0.Ts).toBeCloseTo(g0.Te, 10);
    const g1 = greenhouse(withOverrides(sim, { S: 1361, alb: 0.3, epsA: 1 }));
    expect(g1.Ts / g1.Te).toBeCloseTo(2 ** 0.25, 10);
    // Balanço no topo da atmosfera: absorvido = transmitido da superfície + emitido pela atmosfera
    const e = 0.78;
    const g = greenhouse(withOverrides(sim, { S: 1361, alb: 0.3, epsA: e }));
    expect((1 - e) * SIGMA * g.Ts ** 4 + e * SIGMA * g.Tatm ** 4).toBeCloseTo(g.absorbed, 8);
  });
});
