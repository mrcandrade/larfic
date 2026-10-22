import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import { anguloChuva, movimentoRelativo as sim, rumoReto, velP, velS } from "../src/index.ts";

const P = (o: Record<string, number>) => withOverrides(sim, o);
const act = (id: string) => sim.actions!.find((a) => a.id === id)!;

describe("Movimento relativo", () => {
  it("barco perpendicular: t = L/v' e deriva u·L/v', independente da correnteza", () => {
    for (const u of [0.5, 2]) {
      const r = new Runner(sim, P({ cena: 0, L: 60, vb: 3, u, theta: 0 }));
      r.runToEnd();
      expect(r.finished).toBe(true);
      expect(r.t).toBeCloseTo(20, 6);
      expect(r.state.x).toBeCloseTo(u * 20, 6);
    }
  });

  it("rumo θ* = arcsen(u/v') leva o barco reto ao ponto B em L/√(v'²−u²)", () => {
    expect(rumoReto(3, 1.5)).toBeCloseTo(30, 10);
    const p = P({ cena: 0, L: 60, vb: 3, u: 1.5, theta: 30 });
    const r = new Runner(sim, p);
    r.runToEnd();
    expect(r.state.x).toBeCloseTo(0, 6);
    expect(r.t).toBeCloseTo(60 / Math.sqrt(9 - 2.25), 6);
    // a ação "rumo reto" produz o mesmo rumo
    const s = act("reto").run(sim.init(P({ cena: 0, vb: 3, u: 1.5, theta: 0 })), p);
    expect(s.ox).toBeCloseTo(-1.5, 12);
    expect(s.oy).toBeCloseTo(Math.sqrt(6.75), 12);
  });

  it("u = u' + V nos dois referenciais e trajetória em S' = trajetória em S − R(t)", () => {
    const p = P({ cena: 1, D: 6000, va: 80, w: 30, phiw: 90, psi: 0 });
    const r = new Runner(sim, p);
    for (let i = 0; i < 500; i++) r.stepOnce();
    const [ux, uy] = velS(r.state, p);
    const [px, py] = velP(r.state, p);
    expect(ux - px).toBeCloseTo(r.state.Vx, 12);
    expect(uy - py).toBeCloseTo(r.state.Vy, 12);
    // no ar o avião vai reto ao longo do rumo; no solo é empurrado pelo vento
    expect(r.state.y - r.state.Ry).toBeCloseTo(0, 9);
    expect(r.state.x - r.state.Rx).toBeCloseTo(80 * r.t, 6);
    expect(r.state.y).toBeCloseTo(30 * r.t, 6);
  });

  it("chuva vertical vista do carro: tan α = V/v", () => {
    expect(anguloChuva(8, 0, 8)).toBeCloseTo(45, 10);
    const p = P({ cena: 2, vr: 8, wx: 0, Vc: 15 });
    const r = new Runner(sim, withOverrides(sim, p));
    r.setState(act("movel").run(r.state, p));
    expect(r.value("incl")).toBeCloseTo((Math.atan(15 / 8) * 180) / Math.PI, 10);
    r.setState(act("solo").run(r.state, p));
    expect(r.value("incl")).toBeCloseTo(0, 12);
  });

  it("referencial acelerado: no carro a gota tem x' = −A t²/2 (trajetória curva)", () => {
    const p = P({ cena: 2, vr: 6, wx: 0, Vc: 0, A: 2.5 });
    const r = new Runner(sim, p);
    for (let i = 0; i < 100; i++) r.stepOnce();
    const t = r.t;
    expect(r.state.x - r.state.Rx).toBeCloseTo(-0.5 * 2.5 * t * t, 9);
    expect(r.state.x).toBeCloseTo(0, 12);
  });
});
