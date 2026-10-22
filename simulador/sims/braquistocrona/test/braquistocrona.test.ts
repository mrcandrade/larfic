import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import { braquistocrona as sim, tCycloid, tLine, type BQ } from "../src/index.ts";

const finish = (r: Runner<BQ>) => {
  r.runToEnd(40);
  return r;
};

describe("Braquistócrona", () => {
  it("sem atrito: tempos numéricos da reta e da cicloide batem com as fórmulas fechadas", () => {
    const r = finish(new Runner(sim, withOverrides(sim, { modo: 0, X: 3, Y: 1.5, mu: 0 })));
    expect(r.value("t0")).toBeCloseTo(tLine(3, 1.5), 3);
    expect(Math.abs(r.value("t1") - tCycloid(3, 1.5)) / tCycloid(3, 1.5)).toBeLessThan(2e-3);
  });

  it("a cicloide vence a reta, o arco de círculo e a parábola", () => {
    for (const [X, Y] of [
      [3, 1.5],
      [1, 2],
      [4.5, 0.6],
    ]) {
      const r = finish(new Runner(sim, withOverrides(sim, { modo: 0, X, Y, mu: 0 })));
      const tc = r.value("t1");
      for (const k of ["t0", "t2", "t3"]) expect(tc).toBeLessThan(r.value(k));
    }
  });

  it("sem atrito a velocidade de chegada é √(2gY) em qualquer curva", () => {
    const p = withOverrides(sim, { modo: 0, X: 2, Y: 1.2, mu: 0 });
    const r = new Runner(sim, p);
    while (r.state.beads[1]!.arr < 0) r.stepOnce();
    // logo antes da chegada a conta da cicloide já tem quase √(2gY)
    expect(r.state.beads[1]!.v).toBeCloseTo(Math.sqrt(2 * 9.8 * 1.2), 1);
  });

  it("reta com atrito: a = g(sen α − μ cos α)", () => {
    const X = 2;
    const Y = 1.5;
    const mu = 0.2;
    const L = Math.hypot(X, Y);
    const a = 9.8 * (Y / L - mu * (X / L));
    const r = finish(new Runner(sim, withOverrides(sim, { modo: 0, X, Y, mu })));
    expect(r.value("t0")).toBeCloseTo(Math.sqrt((2 * L) / a), 3);
  });

  it("tautocronia: na cicloide todas chegam ao fundo em π√(R/g); no círculo, não", () => {
    const R = 0.5;
    const r = new Runner(sim, withOverrides(sim, { modo: 1, Rc: R }));
    while (r.t < 1.5) r.stepOnce();
    const T = Math.PI * Math.sqrt(R / 9.8);
    for (const b of r.state.beads.filter((b) => b.c === 0)) expect(Math.abs(b.arr - T) / T).toBeLessThan(3e-3);
    expect(r.value("dc")).toBeLessThan(2e-3);
    expect(r.value("dk")).toBeGreaterThan(0.02);
  });

  it("desenhar uma curva com o ponteiro cria a quinta conta", () => {
    const p = withOverrides(sim, { modo: 0, X: 3, Y: 1.5 });
    let s = sim.init(p);
    s = sim.pointer!.down!(s, p, { x: 0, y: 0 })!;
    for (let i = 1; i <= 20; i++) s = sim.pointer!.move!(s, p, { x: (3 * i) / 20, y: -1.5 * Math.sqrt(i / 20) - 0.3 * Math.sin((Math.PI * i) / 20) }, true) ?? s;
    s = sim.pointer!.up!(s, p, { x: 3, y: -1.5 })!;
    expect(s.beads).toHaveLength(5);
    const r = new Runner(sim, p);
    r.setState(s);
    r.runToEnd(40);
    expect(r.value("t4")).toBeGreaterThan(r.value("t1"));
  });
});
