import { describe, expect, it } from "vitest";
import { Runner, rad, withOverrides } from "@fisilab/core";
import { aerofolio as sim } from "../src/index.ts";
import { clPotential, clWithStall, cp, foilOf, liftFromPressure, surfaceCp, velocity } from "../src/physics.ts";

describe("aerofolio", () => {
  it("placa plana: corda 4c e C_L = 2π sen α", () => {
    const p = withOverrides(sim, { esp: 0, arq: 0, alpha: 7, U: 25 });
    const f = foilOf(p);
    expect(f.chord).toBeCloseTo(1, 6);
    expect(clPotential(f, f.alpha)).toBeCloseTo(2 * Math.PI * Math.sin(rad(7)), 6);
  });

  it("Kutta–Joukowski: a integral da pressão de Bernoulli no contorno dá L' = ρUΓ", () => {
    const p = withOverrides(sim, { esp: 0.1, arq: 0.06, alpha: 5, U: 30, rho: 1.2 });
    const f = foilOf(p);
    expect(liftFromPressure(f)).toBeCloseTo(f.rho * f.U * f.gammaKutta, -1);
    expect(Math.abs(liftFromPressure(f) / (f.rho * f.U * f.gammaKutta) - 1)).toBeLessThan(2e-3);
  });

  it("condição de Kutta: velocidade finita e igual em cima e embaixo do bordo de fuga", () => {
    const f = foilOf(withOverrides(sim, { esp: 0.1, arq: 0.05, alpha: 8 }));
    const up = surfaceCp(f, 1e-3), dn = surfaceCp(f, 2 * Math.PI - 1e-3);
    expect(Number.isFinite(up.cp)).toBe(true);
    expect(up.cp).toBeCloseTo(dn.cp, 2);
    // Sem a circulação de Kutta a velocidade divergiria no bordo de fuga afiado (placa: Cp → −∞)
    expect(up.cp).toBeGreaterThan(-1);
  });

  it("arqueamento: ângulo de sustentação nula α₀ = −β e C_p = 1 no ponto de estagnação", () => {
    const p = withOverrides(sim, { esp: 0.1, arq: 0.08 });
    const f = foilOf(p);
    expect(clPotential(f, -f.beta)).toBeCloseTo(0, 12);
    expect(f.beta).toBeCloseTo(Math.atan2(0.08, 1.1), 12);
    // Longe do perfil a velocidade é U (C_p → 0)
    expect(Math.abs(cp(f, -4000, 3000))).toBeLessThan(1e-4);
    let maxCp = -Infinity;
    for (let i = 0; i < 4000; i++) maxCp = Math.max(maxCp, surfaceCp(f, (2 * Math.PI * (i + 0.5)) / 4000).cp);
    expect(maxCp).toBeCloseTo(1, 4);
  });

  it("estol: C_L cai acima do ângulo de estol, mas segue o potencial abaixo dele", () => {
    const f = foilOf(withOverrides(sim, { esp: 0.1, arq: 0 }));
    expect(clWithStall(f, rad(4), rad(15))).toBeCloseTo(clPotential(f, rad(4)), 4);
    expect(clWithStall(f, rad(22), rad(15))).toBeLessThan(0.7 * clPotential(f, rad(22)));
  });

  it("partículas: dentro do perfil não há velocidade e o traçador avança", () => {
    const p = withOverrides(sim, {});
    expect(velocity(foilOf(p), 0, 0.0)).toBeNull();
    const r = new Runner(sim, p);
    const x0 = r.state.parts[0]![0];
    for (let i = 0; i < 30; i++) r.stepOnce();
    expect(r.state.parts[0]![0]).toBeGreaterThan(x0);
  });
});
