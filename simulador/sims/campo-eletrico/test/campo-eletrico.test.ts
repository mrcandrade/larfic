import { describe, expect, it } from "vitest";
import { K_COULOMB, Runner, generateExercise, withOverrides } from "@fisilab/core";
import { campoEletrico as sim, computeLines, dipoleTorque, smallPeriod, totalField, totalPotential, type CampoState } from "../src/index.ts";

const runner = (over: Record<string, number>) => new Runner(sim, withOverrides(sim, over));

describe("Campo elétrico", () => {
  it("carga única: E = kq/r² radial na sonda", () => {
    const r = runner({ config: 0, q: 4 });
    const s: CampoState = { ...r.state, probe: { x: 0.3, y: 0.4 } };
    const [ex, ey] = totalField(s, r.params, 0.3, 0.4);
    expect(Math.hypot(ex, ey)).toBeCloseTo((K_COULOMB * 4e-9) / 0.25, 6);
    expect(ey / ex).toBeCloseTo(4 / 3, 10);
    expect(totalPotential(s, r.params, 0.3, 0.4)).toBeCloseTo((K_COULOMB * 4e-9) / 0.5, 6);
  });

  it("cargas iguais: campo nulo no ponto médio; dipolo: E paralelo ao eixo na mediatriz", () => {
    const iguais = runner({ config: 2 });
    const [ex, ey] = totalField(iguais.state, iguais.params, 0, 0);
    expect(Math.hypot(ex, ey)).toBeLessThan(1e-9);
    const dip = runner({ config: 1, q: 5 });
    const [dx, dy] = totalField(dip.state, dip.params, 0, 0.5);
    expect(dx).toBeGreaterThan(0);
    expect(Math.abs(dy)).toBeLessThan(1e-9);
    // E = 2kq·a/(a² + y²)^{3/2}, com a = 0,6 m
    expect(dx).toBeCloseTo((2 * K_COULOMB * 5e-9 * 0.6) / (0.36 + 0.25) ** 1.5, 6);
  });

  it("linhas do dipolo: tantas chegam à − quantas saem da +, e as de dentro do palco ligam as duas", () => {
    const r = runner({ config: 1 });
    const lines = computeLines(r.state, r.params);
    const fromPos = lines.filter((l) => l.from === 0);
    expect(fromPos.length).toBeGreaterThan(8);
    expect(lines.filter((l) => l.to === 1)).toHaveLength(fromPos.length);
    // As linhas que saem para o lado da carga negativa (|ângulo| < 90°) chegam nela sem sair da região.
    for (const l of fromPos) {
      const [x, y] = l.points[1]!;
      if (Math.abs(Math.atan2(y, x + 0.6)) < Math.PI / 2) expect(l.end).toBe("charge");
    }
  });

  it("torque τ = pE sen θ em campo uniforme", () => {
    const r = runner({ config: 5, dipolo: 1, E0: 100, E0ang: 0, qd: 4, d: 0.5, th0: 30 });
    expect(dipoleTorque(r.state, r.params)).toBeCloseTo(-4e-9 * 0.5 * 100 * Math.sin(Math.PI / 6), 15);
  });

  it("pequenas oscilações: período 2π√(I/pE) e energia conservada", () => {
    const r = runner({ config: 5, dipolo: 1, E0: 150, qd: 5, d: 0.4, m: 1, th0: 5, b: 0 });
    const T = smallPeriod(r.params);
    // Mede o período pelos cruzamentos de θ = 0 de cima para baixo.
    const cross: number[] = [];
    let prev = r.state.dip.th;
    const e0 = r.value("Emec");
    let maxDev = 0;
    while (r.t < 3.2 * T) {
      r.stepOnce();
      const th = r.state.dip.th;
      if (prev > 0 && th <= 0) cross.push(r.t - (r.dt * th) / (th - prev));
      prev = th;
      maxDev = Math.max(maxDev, Math.abs(r.value("Emec") - e0));
    }
    expect(cross.length).toBeGreaterThanOrEqual(3);
    const Tm = (cross[cross.length - 1]! - cross[0]!) / (cross.length - 1);
    // Correção de amplitude finita (θ₀ = 5°): 1 + θ₀²/16 ≈ 1,00048
    expect(Tm / T).toBeCloseTo(1 + (5 * Math.PI / 180) ** 2 / 16, 3);
    expect(maxDev / Math.abs(e0)).toBeLessThan(1e-8);
  });

  it("amortecimento alinha o dipolo com o campo", () => {
    const r = runner({ config: 5, dipolo: 1, E0: 150, th0: 120, b: 100 });
    r.runToEnd(40);
    expect(Math.abs(Math.sin(r.state.dip.th))).toBeLessThan(1e-3);
    expect(Math.cos(r.state.dip.th)).toBeGreaterThan(0.999);
  });

  it("exercícios coerentes com a física", () => {
    const ex = generateExercise(sim, sim.exercises![1]!, 3);
    expect(ex.answer).toBeCloseTo(smallPeriod(ex.params), 12);
  });
});
