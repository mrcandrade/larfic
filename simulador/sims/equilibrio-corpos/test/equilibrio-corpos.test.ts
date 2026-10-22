import { describe, expect, it } from "vitest";
import { withOverrides } from "@fisilab/core";
import { G, equilibrioCorpos as sim, initState, solve, solveLinear } from "../src/index.ts";

const setup = (o: Record<string, number>) => {
  const p = withOverrides(sim, o);
  return { p, s: initState(p) };
};

describe("Equilíbrio de corpos rígidos", () => {
  it("gangorra: m₁x₁ = m₂x₂ no equilíbrio e N = peso total", () => {
    const { p, s } = setup({ modo: 0, L: 4, mc: 10, m1: 30, m2: 40, x1: 0.5, x2: 3, xa: 2 });
    const r0 = solve(s, p);
    expect(r0.x2eq).toBeCloseTo(2 + (30 * 1.5) / 40, 12);
    expect(r0.ok).toBe(false);
    const r = solve({ ...s, x2: r0.x2eq }, p);
    expect(r.ok).toBe(true);
    expect(r.R1).toBeCloseTo(80 * G, 9);
    expect(r.R2).toBe(0);
  });

  it("gangorra desequilibrada: reações do pivô e do chão somam o peso", () => {
    const { p, s } = setup({ modo: 0, L: 4, mc: 0, m1: 30, m2: 40, x1: 0, x2: 4, xa: 2 });
    const r = solve(s, p);
    // torque líquido −10 g · 2 → ponta direita no chão: N_c · 2 = 20 g
    expect(r.R2).toBeCloseTo(10 * G, 9);
    expect(r.R1 + r.R2).toBeCloseTo(70 * G, 9);
    expect(r.tilt).toBeLessThan(0);
  });

  it("escada: μ_min = (m_e/2 + m d/L) cotθ / (m_e + m)", () => {
    const { p, s } = setup({ modo: 1, L: 5, mc: 15, m1: 70, x1: 5, ang: 60, mu: 0.3 });
    const r = solve(s, p);
    const th = Math.PI / 3;
    expect(r.muMin).toBeCloseTo(((15 / 2 + 70) / Math.tan(th)) / 85, 12);
    expect(r.ok).toBe(false); // 0,526 > 0,3
    // altura máxima: no limite μ_min = μ
    const r2 = solve({ ...s, x1: r.climbMax }, p);
    expect(r2.muMin).toBeCloseTo(0.3, 10);
  });

  it("viga: reações por momentos e aviso quando um apoio precisaria puxar", () => {
    const { p, s } = setup({ modo: 2, L: 4, mc: 0, m1: 100, m2: 0, x1: 1, xa: 0, xb: 4 });
    const r = solve(s, p);
    expect(r.R1).toBeCloseTo(75 * G, 9);
    expect(r.R2).toBeCloseTo(25 * G, 9);
    const bad = solve({ ...s, xa: 2, xb: 4, x1: 0.5 }, p);
    expect(bad.ok).toBe(false);
    expect(bad.R2).toBeLessThan(0);
  });

  it("guindaste: T = P L cosα ·|C − ponta| / (L cosα · H)", () => {
    const { p, s } = setup({ modo: 3, L: 5, mc: 0, m1: 400, x1: 5, ang: 30, H: 4, Tmax: 100 });
    const r = solve(s, p);
    const a = Math.PI / 6;
    const tip = [5 * Math.cos(a), 5 * Math.sin(a)];
    const n = Math.hypot(tip[0]!, 4 - tip[1]!);
    expect(r.F).toBeCloseTo((400 * G * n) / 4, 8);
    // cabo fraco: rompe
    expect(solve(s, { ...p, Tmax: 1 }).ok).toBe(false);
  });

  it("treliça: carga P no nó central inferior dá P/2 nos apoios e F_AD = −P/(2 sen 60°)", () => {
    const { p, s } = setup({ modo: 4, L: 6, m1: 1000, m2: 0, x1: 3, x2: 0 });
    const r = solve(s, p);
    const P = 1000 * G;
    expect(r.R1).toBeCloseTo(P / 2, 8);
    expect(r.R2).toBeCloseTo(P / 2, 8);
    expect(r.bars[2]).toBeCloseTo(-P / (2 * Math.sin(Math.PI / 3)), 8); // AD comprimida
    expect(r.bars[0]).toBeCloseTo(P / (2 * Math.tan(Math.PI / 3)), 8); // AB tracionada
  });

  it("eliminação de Gauss resolve sistema conhecido", () => {
    const x = solveLinear([[2, 1], [1, 3]], [3, 5]);
    expect(x[0]).toBeCloseTo(0.8, 12);
    expect(x[1]).toBeCloseTo(1.4, 12);
  });

  it("arrastar a massa 2 perto do ponto de equilíbrio gruda nele", () => {
    const { p, s } = setup({ modo: 0, L: 4, mc: 10, m1: 30, m2: 40, x1: 0.5, x2: 3, xa: 2 });
    const r = solve(s, p);
    const s1 = sim.pointer!.down!(s, p, { x: 3, y: 0.5 + (3 - 2) * Math.sin(r.tilt) + 0.2 })!;
    expect(s1.drag?.kind).toBe("x2");
    const s2 = sim.pointer!.move!(s1, p, { x: 2 + (3.12 - 2) * Math.cos(r.tilt), y: 1 }, true)!;
    expect(solve(s2, p).ok).toBe(true);
  });
});
