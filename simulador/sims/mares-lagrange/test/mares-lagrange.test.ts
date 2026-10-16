import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import {
  GRAV,
  MU_ROUTH,
  M_MOON,
  M_SUN,
  D_SUN,
  R_EARTH,
  gradForce,
  lagrangePoints,
  maresLagrange as sim,
  tidalAccel,
  tideRange,
  tideScale,
} from "../src/index.ts";

const run = (p: Record<string, number>) => new Runner(sim, withOverrides(sim, p));

describe("Marés e pontos de Lagrange", () => {
  it("aceleração de maré exata ≈ 2GMR/D³ e a maré solar ≈ 0,46 da lunar", () => {
    const D = 60.3 * R_EARTH;
    const a = tidalAccel([R_EARTH, 0], [D, 0], M_MOON);
    const approx = (2 * GRAV * M_MOON * R_EARTH) / D ** 3;
    expect(a[0] / approx).toBeCloseTo(1 + 1.5 / 60.3, 2);
    // nos polos (perpendicular) a maré é compressiva e vale metade
    const b = tidalAccel([0, R_EARTH], [D, 0], M_MOON);
    expect(b[1] / approx).toBeCloseTo(-0.5, 2);
    const ratio = tideScale(M_SUN, D_SUN) / tideScale(M_MOON, D);
    expect(ratio).toBeGreaterThan(0.44);
    expect(ratio).toBeLessThan(0.48);
  });

  it("sizígia tem amplitude maior que quadratura na razão (1+k)/(1−k)", () => {
    const viva = run({ modo: 0, angL: 0, angS: 0 });
    const morta = run({ modo: 0, angL: 90, angS: 0 });
    const k = tideScale(M_SUN, D_SUN) / tideScale(M_MOON, 60.3 * R_EARTH);
    expect(tideRange(viva.state, viva.params) / tideRange(morta.state, morta.params)).toBeCloseTo((1 + k) / (1 - k), 2);
  });

  it("dois picos de maré por dia (período semidiurno lunar ≈ 12 h 25 min)", () => {
    const r = run({ modo: 0, sol: 0 });
    const peaks: number[] = [];
    let a = r.value("h"), b = a;
    while (r.t < 3) {
      r.stepOnce();
      const c = r.value("h");
      if (b > a && b >= c) peaks.push(r.t - r.dt);
      a = b;
      b = c;
    }
    const T = (peaks[peaks.length - 1]! - peaks[0]!) / (peaks.length - 1);
    const expected = 0.5 / (1 / 0.99727 - 1 / 27.32);
    expect(T).toBeCloseTo(expected, 2);
  });

  it("os cinco pontos de Lagrange anulam −∇Φ_ef", () => {
    for (const mu of [0.01215, 9.537e-4, 0.2]) {
      for (const [x, y] of lagrangePoints(mu)) {
        const [fx, fy] = gradForce(x, y, mu);
        expect(Math.hypot(fx, fy)).toBeLessThan(1e-9);
      }
    }
    // L1 Terra–Lua: cerca de 0,849 da separação a partir do baricentro
    expect(lagrangePoints(0.01215)[0]![0]).toBeCloseTo(0.8369, 3);
    expect(MU_ROUTH).toBeCloseTo(0.03852, 4);
  });

  it("L4 é estável para Terra–Lua, L1 é instável, e C_J se conserva", () => {
    const l4 = run({ modo: 1, sistema: 0, ponto: 3, pert: 0.01 });
    const C0 = l4.value("CJ");
    let maxD = 0;
    for (let i = 0; i < 50000; i++) {
      l4.stepOnce();
      maxD = Math.max(maxD, l4.value("dist"));
    }
    // libração "girino" ao longo da órbita, sem escapar
    expect(maxD).toBeLessThan(0.6);
    expect(Math.abs(l4.value("CJ") - C0)).toBeLessThan(1e-8);
    const l1 = run({ modo: 1, sistema: 0, ponto: 0, pert: 0.001 });
    let maxL1 = 0;
    for (let i = 0; i < 5000; i++) {
      l1.stepOnce();
      maxL1 = Math.max(maxL1, l1.value("dist"));
    }
    // 0,001 vira mais de 0,1 em t = 10 (crescimento exponencial)
    expect(maxL1).toBeGreaterThan(0.1);
  });

  it("L4 fica instável acima do limite de Routh", () => {
    const r = run({ modo: 1, sistema: 2, mu: 0.1, ponto: 3, pert: 0.01 });
    let maxD = 0;
    for (let i = 0; i < 50000; i++) {
      r.stepOnce();
      maxD = Math.max(maxD, r.value("dist"));
    }
    expect(maxD).toBeGreaterThan(1);
  });

  it("clicar no referencial girante solta uma partícula em repouso", () => {
    const r = run({ modo: 1, ponto: 5 });
    expect(r.state.parts).toHaveLength(0);
    const s = sim.pointer!.down!(r.state, r.params, { x: 0.3, y: 0.6 })!;
    expect(s.parts[0]!.y).toEqual([0.3, 0.6, 0, 0]);
  });
});
