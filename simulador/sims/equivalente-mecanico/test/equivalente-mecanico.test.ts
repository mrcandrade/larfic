import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import {
  G, J_REF, arrivalSpeed, equivalenteMecanico as sim, heatCapacity, heatCapacityCal, terminalSpeed, workPerDrop, workPerTurn,
} from "../src/index.ts";

const P = (over: Record<string, number>) => withOverrides(sim, over);
const runToEnd = (over: Record<string, number>) => {
  const r = new Runner(sim, P(over));
  for (let k = 0; k < 400000 && !r.finished; k++) r.stepOnce();
  return r;
};

describe("equivalente mecânico do calor", () => {
  it("queda com arrasto quadrático: velocidade de chegada e trabalho por queda exatos", () => {
    const p = P({ m: 10, h: 1.5 });
    const vt = terminalSpeed(p);
    expect(vt).toBeCloseTo(Math.sqrt((2 * 10 * G) / 400), 12);
    const r = new Runner(sim, withOverrides(sim, { m: 10, h: 1.5, N: 1 }));
    for (let k = 0; k < 100000 && !r.finished; k++) r.stepOnce();
    expect(r.value("vf")).toBeCloseTo(arrivalSpeed(p), 9);
    expect(r.value("W")).toBeCloseTo(workPerDrop(p), 6);
    expect(r.value("Ep")).toBeCloseTo(2 * 10 * G * 1.5, 6);
    // Tempo de queda analítico: t = (v_t/g) acosh(e^(gh/v_t²))
    const tf = (vt / G) * Math.acosh(Math.exp((G * 1.5) / (vt * vt)));
    expect(r.t).toBeCloseTo(tf, 6);
  });

  it("sem perdas, W/Q = 4,186 J/cal e ΔT ∝ número de quedas", () => {
    const a = runToEnd({ N: 4 });
    const b = runToEnd({ N: 8 });
    expect(a.value("razao")).toBeCloseTo(J_REF, 6);
    expect(b.value("dT") / a.value("dT")).toBeCloseTo(2, 6);
    expect(b.value("dT")).toBeCloseTo((8 * workPerDrop(P({}))) / heatCapacity(P({})), 6);
  });

  it("o termômetro sobe durante as quedas e fica parado enquanto os pesos são rebobinados", () => {
    const r = new Runner(sim, P({ N: 3 }));
    let Tprev = r.value("T");
    let subiuCaindo = false;
    while (!r.finished) {
      const caindo = r.state.fase === 0;
      r.stepOnce();
      const T = r.value("T");
      if (caindo && r.state.fase === 0 && T > Tprev) subiuCaindo = true;
      if (!caindo && r.state.fase === 1) expect(T).toBe(Tprev);
      Tprev = T;
    }
    expect(subiuCaindo).toBe(true);
    expect(r.value("n")).toBe(3);
  });

  it("perdas fazem W/Q passar de 4,186; a correção de Rumford aproxima", () => {
    const perdas = runToEnd({ N: 20, Gp: 1.5, T0: 20, Ta: 20 });
    expect(perdas.value("razao")).toBeGreaterThan(J_REF * 1.01);
    const rumford = runToEnd({ N: 20, Gp: 1.5, T0: 18.8, Ta: 20 });
    expect(Math.abs(rumford.value("razao") / J_REF - 1)).toBeLessThan(Math.abs(perdas.value("razao") / J_REF - 1) / 3);
    // Balanço: W = C ΔT + Q_perdido
    expect(perdas.value("W")).toBeCloseTo(heatCapacity(perdas.params) * perdas.value("dT") + perdas.value("Qp") * J_REF, 4);
  });

  it("Callendar: W = 2πR·Mg·N e W/Q = J", () => {
    const r = runToEnd({ modo: 1, M: 5, voltas: 100, rot: 3, mcu: 0.4, mw: 0.05 });
    expect(r.value("n")).toBe(100);
    expect(r.value("W")).toBeCloseTo(100 * workPerTurn(r.params), 6);
    expect(r.value("razao")).toBeCloseTo(J_REF, 6);
    expect(r.t).toBeCloseTo(100 / 3, 6);
  });

  it("prática: ΔT contra W (N de 2 a 12 quedas) é proporcional, J = 1/(inclinação·C)", () => {
    const W: number[] = [];
    const dT: number[] = [];
    for (let i = 0; i < 6; i++) {
      const r = runToEnd({ m: 10, h: 1.5, N: 2 + 2 * i, mw: 0.5, E: 50 });
      // O aluno calcula W com m, h, N e a velocidade de chegada medida na fotoporta.
      const v = r.value("vf");
      W.push((2 + 2 * i) * (2 * 10 * G * 1.5 - 10 * v * v));
      dT.push(r.value("dT"));
    }
    const b = W.reduce((s, w, i) => s + w * dT[i]!, 0) / W.reduce((s, w) => s + w * w, 0);
    const C = heatCapacityCal(P({ mw: 0.5, E: 50 }));
    expect(C).toBeCloseTo(550, 9);
    expect(1 / (b * C)).toBeCloseTo(J_REF, 6);
  });
});
