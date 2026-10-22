import { describe, expect, it } from "vitest";
import { commitHistory, solveCircuit, type Element } from "../src/index.ts";

describe("MNA em regime DC", () => {
  it("divisor de tensão", () => {
    const els: Element[] = [
      { kind: "V", a: 1, b: 0, V: 12 },
      { kind: "R", a: 1, b: 2, R: 1000 },
      { kind: "R", a: 2, b: 0, R: 2000 },
    ];
    const s = solveCircuit(3, els);
    expect(s.v[2]).toBeCloseTo(8, 6);
    // A fonte fornece 4 mA: a corrente a → b por dentro da fonte é −4 mA.
    expect(s.i[0]).toBeCloseTo(-0.004, 8);
    expect(s.i[1]).toBeCloseTo(0.004, 8);
  });

  it("resistência interna reduz a tensão terminal", () => {
    const s = solveCircuit(2, [
      { kind: "V", a: 1, b: 0, V: 9, R: 1 },
      { kind: "R", a: 1, b: 0, R: 8 },
    ]);
    expect(s.v[1]).toBeCloseTo(8, 6);
  });

  it("fonte de corrente em paralelo com dois resistores", () => {
    const s = solveCircuit(2, [
      { kind: "I", a: 0, b: 1, I: 0.003 },
      { kind: "R", a: 1, b: 0, R: 1000 },
      { kind: "R", a: 1, b: 0, R: 1000 },
    ]);
    expect(s.v[1]).toBeCloseTo(1.5, 6);
  });

  it("ponte de Wheatstone equilibrada não passa corrente no galvanômetro", () => {
    const s = solveCircuit(4, [
      { kind: "V", a: 1, b: 0, V: 10 },
      { kind: "R", a: 1, b: 2, R: 100 },
      { kind: "R", a: 2, b: 0, R: 200 },
      { kind: "R", a: 1, b: 3, R: 50 },
      { kind: "R", a: 3, b: 0, R: 100 },
      { kind: "R", a: 2, b: 3, R: 10 },
    ]);
    expect(Math.abs(s.i[5]!)).toBeLessThan(1e-9);
  });

  it("diodo de silício conduz com ~0,6–0,8 V", () => {
    const s = solveCircuit(3, [
      { kind: "V", a: 1, b: 0, V: 5 },
      { kind: "R", a: 1, b: 2, R: 1000 },
      { kind: "D", a: 2, b: 0 },
    ]);
    expect(s.converged).toBe(true);
    expect(s.v[2]).toBeGreaterThan(0.5);
    expect(s.v[2]).toBeLessThan(0.9);
  });

  it("laço de fontes ideais é detectado como singular", () => {
    const s = solveCircuit(2, [
      { kind: "V", a: 1, b: 0, V: 5 },
      { kind: "V", a: 1, b: 0, V: 3 },
    ]);
    expect(s.singular).toBe(true);
  });
});

describe("MNA transitório", () => {
  it("carga RC segue v = V(1 − e^{−t/RC})", () => {
    const R = 1000, C = 1e-3, V = 10, dt = 1e-3;
    const els: Element[] = [
      { kind: "V", a: 1, b: 0, V },
      { kind: "R", a: 1, b: 2, R },
      { kind: "C", a: 2, b: 0, C, v0: 0 },
    ];
    let s = solveCircuit(3, els, dt);
    for (let t = 0; t < 1 - 1e-12; t += dt) {
      s = solveCircuit(3, els, dt);
      commitHistory(els, s);
    }
    expect(s.v[2]).toBeCloseTo(V * (1 - Math.exp(-1)), 3);
  });

  it("circuito LC ideal oscila conservando energia", () => {
    const L = 0.1, C = 1e-4, dt = 1e-5;
    const els: Element[] = [
      { kind: "L", a: 1, b: 0, L, i0: 0, v0: 5 },
      { kind: "C", a: 1, b: 0, C, v0: 5, i0: 0 },
    ];
    const E0 = 0.5 * C * 25;
    const w = 1 / Math.sqrt(L * C);
    const steps = Math.round((2 * Math.PI) / w / dt);
    let s = solveCircuit(2, els, dt);
    for (let k = 0; k < steps * 3; k++) {
      s = solveCircuit(2, els, dt);
      commitHistory(els, s);
    }
    const E = 0.5 * C * s.dv[1]! ** 2 + 0.5 * L * s.i[0]! ** 2;
    expect(Math.abs(E - E0) / E0).toBeLessThan(1e-3);
  });
});
