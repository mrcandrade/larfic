import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import { CELL, G, centroMassa as sim, cmParts, cmPlate, currentCM, parabola, shapeCells, toWorld } from "../src/index.ts";

const P = (o: Record<string, number> = {}) => withOverrides(sim, o);
const act = (id: string) => sim.actions!.find((a) => a.id === id)!;

describe("Centro de massa", () => {
  it("partículas: média ponderada", () => {
    const c = cmParts([
      { x: 0, y: 0, m: 1 },
      { x: 4, y: 0, m: 3 },
    ]);
    expect(c.x).toBeCloseTo(3, 12);
    expect(c.M).toBe(4);
  });

  it("placas: retângulo e anel no centro; L confere com a decomposição em retângulos", () => {
    const ret = cmPlate(shapeCells(0));
    expect(ret.x).toBeCloseTo(0, 12);
    expect(ret.y).toBeCloseTo(0, 12);
    const anel = cmPlate(shapeCells(2));
    expect(Math.hypot(anel.x, anel.y)).toBeLessThan(1e-12);
    // L = coluna x∈[−1, −0,4], y∈[−0,6; 0,6] + base x∈[−0,4; 1], y∈[−0,6; −0,2]
    const A1 = 0.6 * 1.2;
    const A2 = 1.4 * 0.4;
    const L = cmPlate(shapeCells(1));
    expect(L.n * CELL * CELL).toBeCloseTo(A1 + A2, 9);
    expect(L.x).toBeCloseTo((A1 * -0.7 + A2 * 0.3) / (A1 + A2), 9);
    expect(L.y).toBeCloseTo((A1 * 0 + A2 * -0.4) / (A1 + A2), 9);
  });

  it("placa pendurada para com o CM na vertical abaixo do pino", () => {
    const p = P({ modo: 1, forma: 1 });
    const r = new Runner(sim, p);
    r.setState(act("pendurar").run(r.state, p));
    const down = sim.pointer!.down!(r.state, p, { x: 0.95, y: -0.55 })!;
    expect(down.hang).not.toBeNull();
    r.setState(down);
    r.runToEnd(30);
    const s = r.state;
    const cm = currentCM(s, p);
    expect(cm.x).toBeCloseTo(s.hang!.P[0], 3);
    expect(cm.y).toBeLessThan(s.hang!.P[1]);
    expect(Math.abs(s.om)).toBeLessThan(1e-3);
    // o pino continua no mesmo lugar do mundo
    const w = toWorld(s, s.hang!.b0);
    expect(w[0]).toBeCloseTo(0.95, 12);
  });

  it("explosão: o CM segue a parábola até o primeiro fragmento tocar o solo", () => {
    const p = P({ modo: 2, v0: 30, ang0: 60, texp: 2, frac: 0.3, vrel: 20, beta: 30 });
    const r = new Runner(sim, p);
    let px = NaN;
    while (!r.finished && !r.state.frags[0].landed && !r.state.frags[1].landed) {
      r.stepOnce();
      if (r.state.frags[0].landed || r.state.frags[1].landed) break;
      const f = r.state.frags;
      if (r.state.exploded) px = f[0].m * f[0].vx + f[1].m * f[1].vx;
      const pb = parabola(p, r.t);
      expect(r.value("xcm")).toBeCloseTo(pb[0], 6);
      expect(r.value("ycm")).toBeCloseTo(pb[1], 6);
    }
    expect(r.state.exploded).toBe(true);
    // momento total conservado na explosão
    expect(px).toBeCloseTo(10 * 30 * Math.cos(Math.PI / 3), 6);
  });

  it("explosão no ápice com metade parada: a outra cai em 1,5 R", () => {
    const v0 = 20;
    const th = Math.PI / 4;
    const vx = v0 * Math.cos(th);
    const p = P({ modo: 2, v0, ang0: 45, texp: (v0 * Math.sin(th)) / G, frac: 0.5, vrel: 2 * vx, beta: 180 });
    const r = new Runner(sim, p);
    r.runToEnd();
    const R = (v0 * v0) / G;
    expect(r.state.frags[0].x).toBeCloseTo(R / 2, 3);
    expect(r.state.frags[1].x).toBeCloseTo(1.5 * R, 3);
  });
});
