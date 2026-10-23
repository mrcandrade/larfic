import { describe, expect, it } from "vitest";
import { EPS0, K_COULOMB, Runner, withOverrides } from "@fisilab/core";
import { coulomb as sim, elements, exactField, exactPotential, netForce, pairEnergy, pairForce, partialSum, partialV, systemEnergy } from "../src/index.ts";

const params = (over: Record<string, number>) => withOverrides(sim, over);

describe("Lei de Coulomb e superposição", () => {
  it("par de cargas: F = k|q1 q2|/r², atração entre sinais opostos e terceira lei", () => {
    const r = new Runner(sim, params({ modo: 0, n: 2, q1: 3, q2: -2 }));
    const s = r.state;
    const d = Math.hypot(s.charges[0]!.x - s.charges[1]!.x, s.charges[0]!.y - s.charges[1]!.y);
    const F12 = pairForce(s, 0, 1);
    expect(Math.hypot(...F12)).toBeCloseTo((K_COULOMB * 6e-12) / d ** 2, 10);
    expect(F12[0]).toBeGreaterThan(0); // q1 (à esquerda) é puxada para a direita
    const F21 = pairForce(s, 1, 0);
    expect(F12[0] + F21[0]).toBeCloseTo(0, 14);
    expect(r.value("F12")).toBeCloseTo(Math.hypot(...F12), 12);
  });

  it("superposição: força resultante é a soma vetorial das forças de cada carga", () => {
    const r = new Runner(sim, params({ modo: 0, n: 3, q1: 3, q2: -2, q3: 2 }));
    const F = netForce(r.state, 0);
    const a = pairForce(r.state, 0, 1);
    const b = pairForce(r.state, 0, 2);
    expect(F[0]).toBeCloseTo(a[0] + b[0], 12);
    expect(F[1]).toBeCloseTo(b[1] + a[1], 12);
  });

  it("anel: soma de N ≥ 2 elementos coincide com kQz/(z²+R²)^{3/2}; N = 1 não", () => {
    const P = { x: 0.3, y: 0 };
    for (const N of [2, 7, 40]) {
      const p = params({ modo: 1, Q: 10, R: 0.4, N });
      const sum = partialSum(elements(p, P));
      expect(sum[0]).toBeCloseTo((K_COULOMB * 10e-9 * 0.3) / (0.09 + 0.16) ** 1.5, 8);
      expect(Math.hypot(sum[1], sum[2])).toBeLessThan(1e-9);
      expect(exactField(p, P)[0]).toBeCloseTo(sum[0], 8);
    }
    const one = partialSum(elements(params({ modo: 1, N: 1 }), P));
    expect(Math.hypot(one[1], one[2])).toBeGreaterThan(1);
  });

  it("disco: a soma converge para σ/2ε₀ (1 − z/√(z²+R²)) com erro ~ 1/N²", () => {
    const P = { x: 0.1, y: 0 };
    const err = (N: number) => {
      const p = params({ modo: 2, Q: 10, R: 0.4, N });
      return Math.abs(partialSum(elements(p, P))[0] - exactField(p, P)[0]);
    };
    const sigma = 10e-9 / (Math.PI * 0.16);
    expect(exactField(params({ modo: 2, Q: 10, R: 0.4 }), P)[0]).toBeCloseTo((sigma / (2 * EPS0)) * (1 - 0.1 / Math.hypot(0.1, 0.4)), 8);
    expect(err(8) / err(16)).toBeGreaterThan(3.5);
    expect(err(16) / err(32)).toBeGreaterThan(3.5);
  });

  it("fio: soma numérica tende à fórmula fechada em qualquer ponto; mediatriz e limite de fio longo", () => {
    const p = params({ modo: 3, Q: 10, L: 1.2, N: 2000 });
    for (const P of [{ x: 0.3, y: 0 }, { x: 0.2, y: 0.5 }, { x: -0.4, y: -0.9 }]) {
      const num = partialSum(elements(p, P));
      const ex = exactField(p, P);
      expect(num[0]).toBeCloseTo(ex[0], 0);
      expect(num[1]).toBeCloseTo(ex[1], 0);
    }
    const lam = 10e-9 / 1.2;
    const d = 0.3;
    expect(exactField(p, { x: d, y: 0 })[0]).toBeCloseTo(((2 * K_COULOMB * lam) / d) * (0.6 / Math.hypot(d, 0.6)), 8);
    const longo = params({ modo: 3, Q: 1000, L: 100 });
    expect(exactField(longo, { x: 0.05, y: 0 })[0] / ((2 * K_COULOMB * 10e-9) / 0.05)).toBeCloseTo(1, 5);
  });

  it("animação: a soma recomeça do zero e chega aos N elementos", () => {
    const r = new Runner(sim, params({ modo: 1, N: 12 }));
    r.stepOnce();
    expect(r.value("k")).toBe(0);
    r.runToEnd();
    expect(r.value("k")).toBe(12);
    expect(r.value("Esoma")).toBeCloseTo(r.value("Eexato"), 8);
  });

  it("potencial: anel exato com N = 1; disco e fio convergem para as fórmulas fechadas", () => {
    const P = { x: 0.3, y: 0 };
    const pa = params({ modo: 1, Q: 10, R: 0.4, N: 1 });
    expect(partialV(elements(pa, P))).toBeCloseTo((K_COULOMB * 10e-9) / 0.5, 8);
    expect(exactPotential(pa, P)).toBeCloseTo((K_COULOMB * 10e-9) / 0.5, 8);
    const pd = params({ modo: 2, Q: 10, R: 0.4, N: 400 });
    const sigma = 10e-9 / (Math.PI * 0.16);
    expect(exactPotential(pd, P)).toBeCloseTo((sigma / (2 * EPS0)) * (0.5 - 0.3), 8);
    expect(partialV(elements(pd, P)) / exactPotential(pd, P)).toBeCloseTo(1, 5);
    const pf = params({ modo: 3, Q: 10, L: 1.2, N: 4000 });
    for (const Q of [{ x: 0.3, y: 0 }, { x: 0.2, y: 0.5 }, { x: -0.4, y: -0.9 }, { x: 0, y: 0.7 }]) {
      expect(partialV(elements(pf, Q)) / exactPotential(pf, Q)).toBeCloseTo(1, 4);
    }
    // longe, o fio parece uma carga pontual
    expect(exactPotential(pf, { x: 0, y: 60 }) / ((K_COULOMB * 10e-9) / 60)).toBeCloseTo(1, 3);
  });

  it("energia do sistema: soma sobre pares, U ∝ 1/r e cenários válidos", () => {
    const p = withOverrides(sim, sim.scenarios.find((c) => c.id === "energia-sistema")!.params);
    const r = new Runner(sim, p);
    const s = r.state;
    const manual = pairEnergy(s, 0, 1) + pairEnergy(s, 0, 2) + pairEnergy(s, 1, 2);
    expect(systemEnergy(s)).toBeCloseTo(manual, 14);
    const r12 = Math.hypot(s.charges[0]!.x - s.charges[1]!.x, s.charges[0]!.y - s.charges[1]!.y);
    expect(pairEnergy(s, 0, 1)).toBeCloseTo((K_COULOMB * 3e-6 * -2e-6) / r12, 12);
    const big = { ...s, charges: s.charges.map((c) => ({ ...c, x: 2 * c.x, y: 2 * c.y })) };
    expect(systemEnergy(big)).toBeCloseTo(systemEnergy(s) / 2, 12);
    expect(r.value("U")).toBeCloseTo(manual, 12);
    const pc = withOverrides(sim, sim.scenarios.find((c) => c.id === "potencial-continuo")!.params);
    const rc = new Runner(sim, pc);
    for (let i = 0; i < 400; i++) rc.stepOnce();
    expect(rc.value("Vsoma") / rc.value("Vexato")).toBeCloseTo(1, 2);
  });
});
