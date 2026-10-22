import { describe, expect, it } from "vitest";
import { Runner, commitHistory, lightTheme, solveCircuit, withOverrides, type Element } from "@fisilab/core";
import { circuitoRc as sim, C1, C2, cursorReading, setSwitch, trace } from "../src/index.ts";

const run = (r: Runner<number[]>, t: number) => {
  while (r.t < t - 1e-9) r.stepOnce();
};

describe("Circuito RC: carga e descarga", () => {
  it("carga segue V0(1 − e^{−t/RC}) e bate com o MNA (trapézio)", () => {
    const p = withOverrides(sim, { modo: 0, inicio: 0, V0: 5, R: 1000, C: 100 });
    const r = new Runner(sim, p);
    const tau = 0.1;
    run(r, tau);
    expect(r.value("Vc")).toBeCloseTo(5 * (1 - Math.exp(-1)), 9);
    run(r, 3 * tau);
    expect(r.value("Vc")).toBeCloseTo(5 * (1 - Math.exp(-3)), 9);
    expect(r.value("i")).toBeCloseTo((5 * Math.exp(-3)) / 1000, 9);

    // O mesmo circuito resolvido pelo solver nodal do núcleo
    const els: Element[] = [
      { kind: "V", a: 1, b: 0, V: 5 },
      { kind: "R", a: 1, b: 2, R: 1000 },
      { kind: "C", a: 2, b: 0, C: 100e-6, v0: 0 },
    ];
    const dt = 1e-4;
    let sol = solveCircuit(3, els, dt);
    for (let k = 1; k < 3000; k++) {
      commitHistory(els, sol);
      sol = solveCircuit(3, els, dt);
    }
    expect(sol.v[2]).toBeCloseTo(r.value("Vc"), 3);
  });

  it("descarga: meia-vida τ ln2 e corrente negativa V0/R no início", () => {
    const p = withOverrides(sim, { modo: 0, inicio: 1, V0: 10, R: 2200, C: 100 });
    const r = new Runner(sim, p);
    expect(r.value("i")).toBeCloseTo(-10 / 2200, 9);
    run(r, 0.22 * Math.LN2);
    expect(r.value("Vc")).toBeCloseTo(5, 3);
  });

  it("carga completa: metade do trabalho da fonte é dissipada, para qualquer R", () => {
    for (const R of [200, 5000]) {
      const r = new Runner(sim, withOverrides(sim, { modo: 0, inicio: 0, V0: 10, R, C: 100 }));
      run(r, 20 * R * 1e-4);
      expect(r.value("Wr")).toBeCloseTo(0.5 * 100e-6 * 100, 6);
      expect(r.value("Ws")).toBeCloseTo(100e-6 * 100, 6);
      expect(Math.abs(r.value("bal"))).toBeLessThan(1e-9);
    }
  });

  it("cursores medem τ: Δt até 63,2 % de V0", () => {
    const p = withOverrides(sim, { modo: 0, inicio: 0, V0: 5, R: 1000, C: 100, msdiv: 50 });
    const r = new Runner(sim, p);
    run(r, 0.5);
    const s = r.state.slice();
    s[C1] = 0;
    s[C2] = 2; // 2 div × 50 ms = 100 ms = τ
    const c1 = cursorReading(s, p, 1);
    const c2 = cursorReading(s, p, 2);
    expect(c2.t - c1.t).toBeCloseTo(0.1, 12);
    expect((c2.v - c1.v) / 5).toBeCloseTo(1 - Math.exp(-1), 9);
  });

  it("chave dispara o osciloscópio e o traço recomeça na borda", () => {
    const p = withOverrides(sim, { modo: 0, inicio: 0, V0: 5, R: 1000, C: 100 });
    const r = new Runner(sim, p);
    run(r, 0.3);
    const vAt = r.value("Vc");
    r.setState(setSwitch(r.state, p, 0));
    run(r, 0.4);
    const pts = trace(r.state, p);
    expect(pts[0]!.t).toBe(0);
    expect(pts[0]!.vc).toBeCloseTo(vAt, 12);
    expect(r.value("Vc")).toBeCloseTo(vAt * Math.exp(-1), 9);
  });

  it("onda quadrada lenta: regime periódico com extremos V0/(1+e^{−T/2τ})", () => {
    const p = withOverrides(sim, { modo: 1, V0: 5, R: 1000, C: 100, f: 5 }); // T/2 = 0,1 s = τ
    const r = new Runner(sim, p);
    run(r, 2); // 10 períodos: regime
    const x = Math.exp(-1);
    // Em t = 2 s termina um período (fim do meio-ciclo baixo): mínimo do regime
    expect(r.value("Vc")).toBeCloseTo((5 * x) / (1 + x), 6);
    run(r, 2.1);
    expect(r.value("Vc")).toBeCloseTo(5 / (1 + x), 6);
  });

  it("desenha sem erro nos dois modos", () => {
    const ctx = new Proxy({}, { get: () => () => undefined, set: () => true }) as unknown as CanvasRenderingContext2D;
    for (const modo of [0, 1]) {
      const p = withOverrides(sim, { modo, ch2: 1 });
      const r = new Runner(sim, p);
      run(r, 0.05);
      sim.render(ctx, { state: r.state, params: p, t: r.t, trail: [], scale: 40, theme: lightTheme });
      expect(r.state[C2]).toBe(1);
    }
  });
});
