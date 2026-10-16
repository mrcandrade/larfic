import { describe, expect, it } from "vitest";
import { Runner, rk4, withOverrides } from "@fisilab/core";
import { blockTime, gateTime, motion, quedaLivre as sim, timeTo, vTerminal } from "../src/index.ts";

describe("Queda livre com fotoportas", () => {
  it("sem ar: t = √(2h/g) em cada fotoporta e o runner para no coletor", () => {
    const p = withOverrides(sim, { d1: 0.25, d2: 0.9, H: 1.5, g: 9.79 });
    expect(gateTime(p, 1)).toBeCloseTo(Math.sqrt(0.5 / 9.79), 12);
    expect(gateTime(p, 2)).toBeCloseTo(Math.sqrt(1.8 / 9.79), 12);
    const r = new Runner(sim, p).runToEnd();
    expect(r.finished).toBe(true);
    expect(r.t).toBeCloseTo(Math.sqrt(3 / 9.79), 9);
    expect(r.value("tq")).toBeCloseTo(r.t, 9);
  });

  it("ajuste h × t² com 4 fotoportas devolve g", () => {
    const p = withOverrides(sim, { nPortas: 4, d1: 0.3, d2: 0.7, d3: 1.1, d4: 1.5, H: 1.8, g: 9.81 });
    const pts = [1, 2, 3, 4].map((i) => [gateTime(p, i) ** 2, [0.3, 0.7, 1.1, 1.5][i - 1]!] as const);
    const sxx = pts.reduce((a, [x]) => a + x * x, 0), sxy = pts.reduce((a, [x, y]) => a + x * y, 0);
    expect((2 * sxy) / sxx).toBeCloseTo(9.81, 10);
  });

  it("com arrasto a solução fechada concorda com integração numérica", () => {
    const p = withOverrides(sim, { esfera: 2, arrasto: 1 });
    const vt = vTerminal(p);
    expect(vt).toBeGreaterThan(5);
    expect(vt).toBeLessThan(12);
    let y = [0, 0];
    const f = (s: number[]) => [s[1]!, 9.79 * (1 - (s[1]! / vt) ** 2)];
    for (let i = 0; i < 1000; i++) y = rk4(f, y, p, 0, 1e-3);
    const m = motion(1, p);
    expect(m.y).toBeCloseTo(y[0]!, 8);
    expect(m.v).toBeCloseTo(y[1]!, 8);
    expect(timeTo(m.y, p)).toBeCloseTo(1, 9);
  });

  it("bola leve com ar demora mais; aço quase não muda", () => {
    const vac = withOverrides(sim, { d2: 1.5, H: 1.8 });
    const ping = withOverrides(sim, { d2: 1.5, H: 1.8, esfera: 2, arrasto: 1 });
    const aco = withOverrides(sim, { d2: 1.5, H: 1.8, esfera: 0, arrasto: 1 });
    expect(gateTime(ping, 2) / gateTime(vac, 2)).toBeGreaterThan(1.02);
    expect(gateTime(aco, 2) / gateTime(vac, 2) - 1).toBeLessThan(1e-3);
  });

  it("tempo de bloqueio ≈ D/v", () => {
    const p = withOverrides(sim, { d1: 0.5 });
    const v = Math.sqrt(2 * 9.79 * 0.5);
    expect(blockTime(p, 1)).toBeCloseTo(0.025 / v, 5);
  });
});
