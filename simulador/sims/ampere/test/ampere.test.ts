import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import {
  MU0,
  T_LAP,
  ampere as sim,
  blobPath,
  circlePath,
  enclosedCurrent,
  lineIntegral,
  squarePath,
  winding,
  type AmpState,
  type Pt,
} from "../src/index.ts";

describe("Lei de Ampère", () => {
  it("círculo em torno de um fio: ∮B·dl = μ₀I, qualquer raio e posição do fio", () => {
    for (const [R, x, y] of [[2, 0, 0], [6, 0, 0], [5, 3, -2]] as const) {
      const c = lineIntegral(circlePath(0, 0, R, 200), [{ x, y, I: 7 }]);
      expect(c / (MU0 * 7)).toBeCloseTo(1, 7);
    }
  });

  it("fio fora do caminho: B ≠ 0 no caminho, mas a circulação é nula", () => {
    const c = lineIntegral(squarePath(0, 0, 3), [{ x: 4.5, y: 1, I: 10 }]);
    expect(Math.abs(c)).toBeLessThan(1e-8 * MU0 * 10);
  });

  it("caminho irregular com vários fios: integral numérica = μ₀ I_env", () => {
    const wires = [
      { x: -2, y: 1, I: 5 },
      { x: 2, y: -1.5, I: 3 },
      { x: 7, y: 4, I: -4 },
      { x: 0.5, y: 0.2, I: -2 },
    ];
    const path = blobPath(0, 0, 4);
    expect(enclosedCurrent(path, wires)).toBe(6);
    expect(lineIntegral(path, wires) / (MU0 * 6)).toBeCloseTo(1, 6);
    // Sentido invertido troca o sinal
    expect(lineIntegral(path.slice().reverse(), wires) / (MU0 * 6)).toBeCloseTo(-1, 6);
  });

  it("caminho que dá duas voltas em torno do fio: circulação 2μ₀I", () => {
    const loop = circlePath(0, 0, 3, 90);
    const path: Pt[] = [...loop, ...circlePath(0, 0, 4, 90)];
    expect(winding(path, 0, 0)).toBe(2);
    expect(lineIntegral(path, [{ x: 0.3, y: 0, I: 2 }]) / (2 * MU0 * 2)).toBeCloseTo(1, 4);
  });

  it("marcador: meia volta em torno do fio central acumula μ₀I/2", () => {
    const r = new Runner(sim, withOverrides(sim, { caminho: 0, montagem: 0, I: 5 }));
    while (r.t < T_LAP / 2 - 1e-9) r.stepOnce();
    expect(r.value("parcial") / (MU0 * 5)).toBeCloseTo(0.5, 3);
    expect(r.value("circ") / r.value("mu0I")).toBeCloseTo(1, 6);
  });

  it("arrastar o fio para dentro do caminho muda a corrente envolvida", () => {
    const p = withOverrides(sim, { caminho: 0, montagem: 1 });
    let s: AmpState = sim.init(p);
    const r = new Runner(sim, p);
    expect(r.value("Ienc")).toBe(0);
    s = sim.pointer!.down!(s, p, { x: 8, y: 2 })!;
    s = sim.pointer!.move!(s, p, { x: -1, y: 0.5 }, true)!;
    s = sim.pointer!.up!(s, p, { x: -1, y: 0.5 })!;
    r.setState(s);
    expect(r.value("Ienc")).toBe(5);
    expect(r.value("circ") / (MU0 * 5)).toBeCloseTo(1, 6);
  });

  it("desenhar um caminho no palco", () => {
    const p = withOverrides(sim, { caminho: 2, montagem: 0 });
    let s: AmpState = sim.init(p);
    s = sim.pointer!.down!(s, p, { x: 3, y: 0 })!;
    for (let k = 1; k <= 80; k++) {
      const a = (2 * Math.PI * k) / 80;
      s = sim.pointer!.move!(s, p, { x: 3 * Math.cos(a), y: 3 * Math.sin(a) }, true) ?? s;
    }
    s = sim.pointer!.up!(s, p, { x: 3, y: 0 })!;
    expect(s.path.length).toBeGreaterThan(20);
    expect(lineIntegral(s.path, s.wires) / (MU0 * 5)).toBeCloseTo(1, 6);
  });
});
