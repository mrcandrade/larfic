import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import { referenciaisNaoInerciais as sim, M_PESSOA, OMEGA_T, inertialBall, type RN } from "../src/index.ts";

const run = (r: Runner<RN>, T: number) => {
  while (r.t < T - 1e-9 && !r.finished) r.stepOnce();
};

describe("Referenciais não inerciais", () => {
  it("elevador: balança marca m(g + a); zero em queda livre", () => {
    const r = new Runner(sim, withOverrides(sim, { modo: 0, perfil: 0, a: 2.5 }));
    run(r, 0.5);
    expect(r.value("N")).toBeCloseTo(M_PESSOA * (9.8 + 2.5), 9);
    const q = new Runner(sim, withOverrides(sim, { modo: 0, perfil: 2 }));
    run(q, 2);
    expect(q.value("N")).toBeCloseTo(0, 9);
    expect(q.value("ve")).toBeCloseTo(-9.8, 6);
  });

  it("elevador: dentro da cabine a bola cai com g + a", () => {
    const a = 3;
    const r = new Runner(sim, withOverrides(sim, { modo: 0, perfil: 0, a, u: 1 }));
    const h0 = r.value("hb");
    run(r, 0.3);
    expect(h0 - r.value("hb")).toBeCloseTo(0.5 * (9.8 + a) * 0.09, 6);
  });

  it("carrossel: integração no referencial girante (centrífuga + Coriolis) coincide com a reta do inercial", () => {
    const r = new Runner(sim, withOverrides(sim, { modo: 1, W: 1.2, r0: 1, v0: 3, alfa: 30 }));
    run(r, 1.2);
    expect(r.value("err")).toBeLessThan(1e-8);
    const b = inertialBall(r.state, r.params);
    // no inercial a velocidade é constante: |V| = |v' + Ω × r0|
    const V = Math.hypot(3 * Math.cos(Math.PI / 6), 3 * Math.sin(Math.PI / 6) + 1.2 * 1);
    expect(Math.hypot(b.VX, b.VY)).toBeCloseTo(V, 9);
  });

  it("carrossel: lançada para fora num disco anti-horário, desvia para a direita (y' < 0)", () => {
    const r = new Runner(sim, withOverrides(sim, { modo: 1, W: 0.8, r0: 1, v0: 3, alfa: 0 }));
    run(r, 0.8);
    expect(r.state.y).toBeLessThan(-0.1);
  });

  it("Foucault: o plano precessa a −Ω sen φ; no equador não precessa", () => {
    const p = { modo: 2, lat: 48.85, k: 5000, Lf: 67, A: 3, solta: 0 };
    const r = new Runner(sim, withOverrides(sim, p));
    run(r, 40);
    const pred = -(5000 * OMEGA_T * Math.sin((48.85 * Math.PI) / 180) * 40 * 180) / Math.PI;
    expect(Math.abs(r.value("az") - pred)).toBeLessThan(0.03 * Math.abs(pred));
    const e = new Runner(sim, withOverrides(sim, { ...p, lat: 0 }));
    run(e, 40);
    expect(Math.abs(e.value("az"))).toBeLessThan(0.01);
  });
});
