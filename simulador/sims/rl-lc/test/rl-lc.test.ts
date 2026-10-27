import { describe, expect, it } from "vitest";
import { Runner, commitHistory, solveCircuit, withOverrides, type Element } from "@fisilab/core";
import { rlLc as sim, setSwitch, RL, LC, RLC } from "../src/index.ts";

const run = (r: Runner<number[]>, t: number) => {
  while (r.t < t - 1e-9) r.stepOnce();
};

describe("Circuitos RL e LC", () => {
  it("RL: i = (V0/R)(1 − e^{−t/τ}) e queda com o mesmo τ ao abrir a fonte", () => {
    const p = withOverrides(sim, { circuito: RL, V0: 6, R: 10, L: 1 });
    const r = new Runner(sim, p);
    run(r, 0.1);
    expect(r.value("i")).toBeCloseTo(0.6 * (1 - Math.exp(-1)), 9);
    expect(r.value("Vl")).toBeCloseTo(6 * Math.exp(-1), 9);
    run(r, 1);
    const i1 = r.value("i");
    r.setState(setSwitch(r.state, p, 0));
    run(r, 1.1);
    expect(r.value("i")).toBeCloseTo(i1 * Math.exp(-1), 9);
    expect(Math.abs(r.value("bal"))).toBeLessThan(1e-9);
  });

  it("LC: q = Q0 cos ω0 t, I_max = V0√(C/L) e energia conservada", () => {
    const p = withOverrides(sim, { circuito: LC, V0: 6, L: 1, C: 1000 });
    const r = new Runner(sim, p);
    const w = 1 / Math.sqrt(1e-3);
    const U0 = 0.5 * 1e-3 * 36;
    let imax = 0;
    while (r.t < 1 - 1e-9) {
      r.stepOnce();
      imax = Math.max(imax, Math.abs(r.value("i")));
      expect(r.value("U")).toBeCloseTo(U0, 10);
    }
    expect(r.value("q")).toBeCloseTo(6e-3 * Math.cos(w * r.t), 9);
    expect(imax).toBeCloseTo(6 * Math.sqrt(1e-3), 3);
  });

  it("LC concorda com o MNA do núcleo (trapézio)", () => {
    const p = withOverrides(sim, { circuito: LC, V0: 5, L: 0.5, C: 200 });
    const r = new Runner(sim, p);
    run(r, 0.2);
    const els: Element[] = [
      { kind: "C", a: 1, b: 0, C: 200e-6, v0: 5, i0: 0 },
      { kind: "L", a: 1, b: 0, L: 0.5, i0: 0, v0: 5 },
    ];
    const dt = 1e-5;
    let sol = solveCircuit(2, els, dt);
    for (let k = 1; k < 20000; k++) {
      commitHistory(els, sol);
      sol = solveCircuit(2, els, dt);
    }
    expect(sol.v[1]).toBeCloseTo(r.value("Vc"), 3);
  });

  it("RLC subamortecido: envelope e^{−αt}, ω_d e W_R fecha o balanço", () => {
    const p = withOverrides(sim, { circuito: RLC, V0: 6, R: 5, L: 1, C: 1000 });
    const r = new Runner(sim, p);
    const a = 2.5;
    const w0 = 1 / Math.sqrt(1e-3);
    const wd = Math.sqrt(w0 * w0 - a * a);
    const Q0 = 6e-3;
    run(r, 0.7);
    const t = r.t;
    const qa = Q0 * Math.exp(-a * t) * (Math.cos(wd * t) + (a / wd) * Math.sin(wd * t));
    expect(r.value("q")).toBeCloseTo(qa, 9);
    expect(Math.abs(r.value("bal") - 0.5 * 1e-3 * 36)).toBeLessThan(1e-9);
  });

  it("amortecimento crítico e supercrítico não trocam de sinal", () => {
    for (const R of [2 * Math.sqrt(1000), 200]) {
      const r = new Runner(sim, withOverrides(sim, { circuito: RLC, V0: 6, R, L: 1, C: 1000 }));
      let minQ = Infinity;
      while (r.t < 2) {
        r.stepOnce();
        minQ = Math.min(minQ, r.value("q"));
      }
      expect(minQ).toBeGreaterThan(-1e-9);
    }
  });
});
