import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import { motorHall as sim, hallVoltage, motorParams, terminalOmega, wireForce, wirePoints, type MotorState } from "../src/index.ts";

const run = (o: Record<string, number>) => new Runner<MotorState>(sim, withOverrides(sim, o));

describe("Motor DC, força num fio e efeito Hall", () => {
  it("torque de partida = NIAB sen θ, com I = V/R", () => {
    for (const theta0 of [90, 30, 150]) {
      const r = run({ modo: 0, V: 4, R: 2, B: 0.4, N: 50, L: 0.06, theta0 });
      const I = 4 / 2;
      expect(r.value("tau")).toBeCloseTo(50 * I * 0.06 ** 2 * 0.4 * Math.sin((theta0 * Math.PI) / 180), 10);
    }
  });

  it("com comutador o motor gira e chega à rotação de regime prevista pela fem", () => {
    const r = run({ modo: 0, comutador: 1, V: 3, R: 2, B: 0.5, N: 100, L: 0.05, carga: 0, theta0: 90 });
    while (r.t < 8) r.stepOnce();
    // média de ω sobre 1 s (há ondulação dentro de cada volta)
    let sum = 0;
    let n = 0;
    while (r.t < 9) {
      r.stepOnce();
      sum += r.value("omega");
      n++;
    }
    const wT = terminalOmega(motorParams(r.params));
    expect(sum / n / wT).toBeCloseTo(1, 1);
    expect(r.state.th).toBeGreaterThan(20 * 2 * Math.PI); // muitas voltas completas
  });

  it("sem comutador a espira só oscila em torno de θ = 180°", () => {
    const r = run({ modo: 0, comutador: 0, V: 3, R: 2, B: 0.5, N: 100, L: 0.05, theta0: 30 });
    let thMax = 0;
    let sum = 0;
    let n = 0;
    while (r.t < 40) {
      r.stepOnce();
      thMax = Math.max(thMax, r.state.th);
      if (r.t > 20) {
        sum += r.value("theta");
        n++;
      }
    }
    expect(thMax).toBeLessThan(2 * Math.PI); // nunca completa uma volta
    expect(sum / n).toBeCloseTo(180, 0);
  });

  it("força num fio: |F| = ILB sen θ e o semicírculo sente a mesma força que a corda", () => {
    const a: [number, number] = [-0.1, 0];
    const b: [number, number] = [0.1, 0.1];
    const L = Math.hypot(0.2, 0.1);
    const straight = wireForce(wirePoints(a, b, 0), 3, 0.8, 0);
    expect(Math.hypot(...straight)).toBeCloseTo(3 * L * 0.8, 12);
    // F ⟂ fio
    expect(straight[0] * 0.2 + straight[1] * 0.1).toBeCloseTo(0, 12);
    const arc = wireForce(wirePoints(a, b, 1, 200), 3, 0.8, 0);
    expect(arc[0]).toBeCloseTo(straight[0], 10);
    expect(arc[1]).toBeCloseTo(straight[1], 10);
    // B no plano (+x): F = I L B sen θ, saindo/entrando da tela
    const inPlane = wireForce(wirePoints(a, b, 0), 3, 0.8, 2);
    expect(Math.abs(inPlane[2])).toBeCloseTo(3 * L * 0.8 * (0.1 / L), 12);
    expect(wireForce([[0, 0], [0.2, 0]], 3, 0.8, 2)[2]).toBe(0);
  });

  it("efeito Hall: V_H tende a IB/(nqt), com sinal do portador e sem depender da largura", () => {
    for (const material of [0, 1]) {
      const r = run({ modo: 2, material, Ihall: 0.02, B: 0.8, esp: 0.5, larg: 10 });
      while (r.t < 5) r.stepOnce();
      const sinal = material === 0 ? -1 : 1;
      const expected = hallVoltage(0.02, 0.8, 1e21, sinal, 0.5e-3);
      expect(r.value("VH") / expected).toBeCloseTo(1, 4);
      expect(Math.sign(r.value("VH"))).toBe(sinal);
      const wide = run({ modo: 2, material, Ihall: 0.02, B: 0.8, esp: 0.5, larg: 20 });
      while (wide.t < 5) wide.stepOnce();
      expect(wide.value("VH")).toBeCloseTo(r.value("VH"), 10);
      expect(wide.value("vd")).toBeCloseTo(r.value("vd") / 2, 10);
    }
  });

  it("arrastar a ponta do fio muda a força", () => {
    const p = withOverrides(sim, { modo: 1 });
    const s0 = sim.init(p);
    const s1 = sim.pointer!.down!(s0, p, { x: s0.b[0], y: s0.b[1] }) as MotorState;
    expect(s1.drag).toBe("b");
    const s2 = sim.pointer!.move!(s1, p, { x: 0.25, y: -0.06 }, true) as MotorState;
    expect(s2.b).toEqual([0.25, -0.06]);
    const F = sim.observables.find((o) => o.key === "F")!;
    expect(F.value(s2, p, 0)).toBeCloseTo(5 * 0.4 * 0.5, 10);
  });
});
