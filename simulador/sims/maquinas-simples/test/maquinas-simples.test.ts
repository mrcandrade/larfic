import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import { maquinasSimples as sim, config, leverClass, leverFreq, machineFeq, thetaEq, type MS } from "../src/index.ts";

const run = (r: Runner<MS>, T: number) => {
  while (r.t < T - 1e-9 && !r.finished) r.stepOnce();
};

describe("Máquinas simples", () => {
  it("alavanca: padrão equilibrado (P·dP = F·dF) não gira; carga mais longe gira para o lado da carga", () => {
    const p = withOverrides(sim, { modo: 0 });
    const r = new Runner(sim, p);
    expect(Math.abs(leverFreq(r.state, p))).toBeCloseTo((30 * 9.8 * 1) / 2, 9);
    expect(leverClass(r.state)).toBe(1);
    run(r, 1);
    expect(Math.abs(r.state.th)).toBeLessThan(1e-9);
    r.setState({ ...r.state, xc: -1.5 });
    run(r, 2);
    expect(r.state.th).toBeGreaterThan(0.05); // carga à esquerda desce: giro anti-horário (θ > 0)
  });

  it("alavanca: classes identificadas pela ordem apoio/carga/força", () => {
    const base = sim.init(withOverrides(sim, {}));
    expect(leverClass({ ...base, xp: -3, xc: 0, xe: 2 })).toBe(2);
    expect(leverClass({ ...base, xp: -3, xc: 2, xe: 0 })).toBe(3);
  });

  it("talha de 4 segmentos: a = (4F − mg)/m, s = 4h e W = ΔU + K", () => {
    const p = withOverrides(sim, { modo: 3, n: 4, m: 60, F: 160, mp: 0 });
    const r = new Runner(sim, p);
    expect(machineFeq(p)).toBeCloseTo((60 * 9.8) / 4, 9);
    run(r, 1);
    const a = (4 * 160 - 60 * 9.8) / 60;
    expect(r.value("y")).toBeCloseTo(0.5 * a, 4);
    expect(r.value("s")).toBeCloseTo(4 * r.value("y"), 9);
    expect(r.value("bal")).toBeCloseTo(0, 6);
  });

  it("talha exponencial: VM = 2^n e F_eq inclui as roldanas", () => {
    const p = withOverrides(sim, { modo: 4, n: 3, m: 40, mp: 1 });
    expect(config(p).k).toBe(8);
    expect(machineFeq(p)).toBeCloseTo((9.8 * (40 + 1 * (1 + 2 + 4))) / 8, 9);
    const sc = withOverrides(sim, { modo: 6, R: 0.4, passo: 5, m: 1000 });
    expect(machineFeq(sc)).toBeCloseTo((1000 * 9.8 * 0.005) / (2 * Math.PI * 0.4), 9);
  });

  it("arrastar a mão sobe a carga em equilíbrio com W = m g h", () => {
    const p = withOverrides(sim, { modo: 2, m: 20 });
    let s = sim.init(p);
    s = sim.pointer!.down!(s, p, { x: 0.6, y: 3 })!;
    s = sim.pointer!.move!(s, p, { x: 0.6, y: 2 }, true)!;
    expect(s.y).toBeCloseTo(0.5, 9);
    expect(s.W).toBeCloseTo(20 * 9.8 * 0.5, 9);
  });

  it("governador: θ converge para o equilíbrio; com a = 0, cos θ = g/(ω²L)", () => {
    const w = (90 * 2 * Math.PI) / 60;
    expect(thetaEq(w, 0.3, 9.8, 0)).toBeCloseTo(Math.acos(9.8 / (w * w * 0.3)), 9);
    const r = new Runner(sim, withOverrides(sim, { modo: 7, reg: 0, rpm: 90, L: 0.3 }));
    run(r, 15);
    expect(r.value("rpm")).toBeCloseTo(90, 3);
    expect(r.value("th")).toBeCloseTo(r.value("theq"), 2);
  });

  it("governador regulado: mais carga → rotação de regime um pouco menor (erro permanente)", () => {
    const steady = (carga: number) => {
      const r = new Runner(sim, withOverrides(sim, { modo: 7, reg: 1, carga }));
      run(r, 60);
      expect(Math.abs(r.state.gom)).toBeLessThan(2e-2);
      return r.value("rpm");
    };
    const a = steady(4);
    const b = steady(12);
    expect(b).toBeLessThan(a);
    expect(b).toBeGreaterThan(0.7 * a);
  });
});
