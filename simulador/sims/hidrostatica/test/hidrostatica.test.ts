import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import { hidrostatica as sim, layersOf, manEquilibrium, manOmega, manParams, pressureAtDepth, pressParams, pressF1eq, tankGeom } from "../src/index.ts";

const P = (o: Record<string, number>) => withOverrides(sim, o);

describe("Hidrostática", () => {
  it("camadas: p no fundo = p0 + Σ ρ g h e inclinação muda em cada interface", () => {
    const p = P({ modo: 0, n: 3, rho1: 900, h1: 0.3, rho2: 1000, h2: 0.4, rho3: 13600, h3: 0.1, ref: 1, g: 9.81 });
    const { layers } = layersOf(p);
    expect(pressureAtDepth(layers, 0.8, 0, 9.81)).toBeCloseTo(9.81 * (900 * 0.3 + 1000 * 0.4 + 13600 * 0.1), 6);
    const slope = (a: number, b: number) => (pressureAtDepth(layers, b, 0, 9.81) - pressureAtDepth(layers, a, 0, 9.81)) / (b - a);
    expect(slope(0.05, 0.25)).toBeCloseTo(900 * 9.81, 6);
    expect(slope(0.35, 0.65)).toBeCloseTo(1000 * 9.81, 6);
    expect(slope(0.72, 0.78)).toBeCloseTo(13600 * 9.81, 6);
  });

  it("camadas fora de ordem se reorganizam por densidade e a sonda lê p absoluta", () => {
    const p = P({ modo: 0, n: 2, rho1: 13600, h1: 0.1, rho2: 1000, h2: 0.5, ref: 0 });
    const { layers, reordered } = layersOf(p);
    expect(reordered).toBe(true);
    expect(layers[0]!.rho).toBe(1000);
    // Arrasta a sonda até o fundo
    const s0 = sim.init(p);
    const { TW } = tankGeom(p);
    const s1 = sim.pointer!.down!(s0, p, { x: TW / 2, y: 0 })!;
    const r = new Runner(sim, p);
    r.setState(s1);
    expect(r.value("prof")).toBeCloseTo(0.6, 9);
    expect(r.value("p")).toBeCloseTo((101325 + 9.81 * (1000 * 0.5 + 13600 * 0.1)) / 1000, 6);
  });

  it("manômetro: oscila com ω² = 2ρB g/(ρA hA + ρB L) e assenta em Δz = (pg + ρA g hA)/(ρB g)", () => {
    const o = { modo: 1, pg: 3, rhoB: 1000, rhoA: 900, hA: 0.2, zeta: 0 };
    const p = P(o);
    const q = manParams(p);
    const r = new Runner(sim, p);
    // Sem amortecimento: x(t) = xeq (1 − cos ωt)
    const w = manOmega(q);
    const xeq = manEquilibrium(q);
    while (r.t < 0.7) r.stepOnce();
    expect(r.value("dz") / 2).toBeCloseTo(xeq * (1 - Math.cos(w * r.t)), 6);
    // Com amortecimento, chega ao equilíbrio e a leitura devolve pg
    const r2 = new Runner(sim, P({ ...o, zeta: 0.5 }));
    while (r2.t < 20) r2.stepOnce();
    expect(r2.value("dz")).toBeCloseTo((3000 + 900 * 9.81 * 0.2) / (1000 * 9.81), 5);
    expect(r2.value("p")).toBeCloseTo(3, 4);
  });

  it("prensa: F1 mínima = Mg A1/A2 e trabalho de F1 = F2 d2", () => {
    const p = P({ modo: 2, F1: 250, d1: 4, d2: 16, M: 200, g: 9.81 });
    expect(pressF1eq(pressParams(p))).toBeCloseTo((200 * 9.81) / 16, 9);
    const r = new Runner(sim, p);
    while (r.t < 1) r.stepOnce();
    const d2 = r.value("d2");
    expect(d2).toBeGreaterThan(0);
    expect(r.value("d1")).toBeCloseTo(16 * d2, 9);
    expect(r.value("W1")).toBeCloseTo(250 * 16 * d2, 9);
    // Velocidade terminal (F1 A2/A1 − Mg)/b em regime
    const vt = (250 * 16 - 200 * 9.81) / 1e5;
    expect(r.state[3]).toBeCloseTo(vt, 9);
    // Abaixo da força mínima, a carga não sobe
    const r2 = new Runner(sim, P({ modo: 2, F1: 100, d1: 4, d2: 16, M: 200 }));
    for (let i = 0; i < 500; i++) r2.stepOnce();
    expect(r2.value("d2")).toBe(0);
  });
});
