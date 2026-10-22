import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import { rotacaoTorque as sim, inertia, inertiaCm } from "../src/index.ts";

const G = 9.81;

describe("Torque e momento de inércia", () => {
  it("momentos de inércia pelo CM de disco, anel, barra e placa", () => {
    const base = { M: 3, R: 0.4, L: 0.9, b: 0.5 };
    expect(inertiaCm(withOverrides(sim, { ...base, corpo: 0 }))).toBeCloseTo(0.5 * 3 * 0.16, 12);
    expect(inertiaCm(withOverrides(sim, { ...base, corpo: 1 }))).toBeCloseTo(3 * 0.16, 12);
    expect(inertiaCm(withOverrides(sim, { ...base, corpo: 2 }))).toBeCloseTo((3 * 0.81) / 12, 12);
    expect(inertiaCm(withOverrides(sim, { ...base, corpo: 3 }))).toBeCloseTo((3 * (0.81 + 0.25)) / 12, 12);
  });

  it("eixos paralelos: barra pela ponta tem I = ML²/3", () => {
    const p = withOverrides(sim, { corpo: 2, M: 2, L: 1, d: 0.5 });
    const s = sim.init(p);
    expect(inertia(p, s)).toBeCloseTo((2 * 1) / 3, 12);
    // O eixo inicial é limitado ao corpo
    const p2 = withOverrides(sim, { corpo: 2, M: 2, L: 0.4, d: 0.5 });
    expect(Math.hypot(sim.init(p2).ax, sim.init(p2).ay)).toBeCloseTo(0.2, 12);
  });

  it("força tangencial constante: ω = (rF/I) t e θ = ½αt²", () => {
    const p = withOverrides(sim, { corpo: 0, M: 2, R: 0.4, d: 0.2, modo: 0, F: 3, r: 0.1 });
    const I = 0.5 * 2 * 0.16 + 2 * 0.04;
    const r = new Runner(sim, p);
    while (r.t < 2 - 1e-9) r.stepOnce();
    const alpha = (3 * 0.1) / I;
    expect(r.value("omega")).toBeCloseTo(alpha * r.t, 9);
    expect(r.value("theta")).toBeCloseTo(0.5 * alpha * r.t * r.t, 9);
  });

  it("massa pendurada: tempo de queda e conservação de energia", () => {
    const p = withOverrides(sim, { corpo: 0, M: 2, R: 0.4, d: 0, modo: 1, m: 0.3, r: 0.08, h: 1 });
    const I = 0.5 * 2 * 0.16;
    const a = (0.3 * G * 0.08 ** 2) / (I + 0.3 * 0.08 ** 2);
    const r = new Runner(sim, p).runToEnd();
    expect(r.finished).toBe(true);
    expect(r.t).toBeCloseTo(Math.sqrt(2 / a), 6);
    const v = r.value("omega") * 0.08;
    const E = 0.5 * I * r.value("omega") ** 2 + 0.5 * 0.3 * v * v;
    expect(E).toBeCloseTo(0.3 * G * 1, 6);
    expect(r.value("T")).toBeCloseTo(0.3 * (G - a), 9);
  });

  it("atrito no eixo: sem movimento quando rF < τa e parada quando F é reduzida", () => {
    const p = withOverrides(sim, { modo: 0, F: 1, r: 0.05, tau_a: 0.1 });
    const r = new Runner(sim, p);
    for (let i = 0; i < 500; i++) r.stepOnce();
    expect(r.value("omega")).toBe(0);
    const r2 = new Runner(sim, withOverrides(sim, { modo: 0, F: 5, r: 0.05, tau_a: 0.1 }));
    for (let i = 0; i < 1000; i++) r2.stepOnce();
    expect(r2.value("omega")).toBeGreaterThan(0);
    r2.setLiveParams({ ...r2.params, F: 0 });
    for (let i = 0; i < 20000; i++) r2.stepOnce();
    expect(r2.value("omega")).toBe(0);
  });

  it("arrastar o eixo para a borda do disco muda I para 3MR²/2", () => {
    const p = withOverrides(sim, { corpo: 0, M: 2, R: 0.4, d: 0 });
    const s0 = sim.init(p);
    const s1 = sim.pointer!.down!(s0, p, { x: 0.39, y: 0 })!;
    const s2 = sim.pointer!.move!(s1, p, { x: 0.6, y: 0 }, true)!;
    expect(Math.hypot(s2.ax, s2.ay)).toBeCloseTo(0.4, 9);
    expect(inertia(p, s2)).toBeCloseTo(1.5 * 2 * 0.16, 9);
    // Clique fora do corpo não move o eixo
    expect(sim.pointer!.down!(s0, p, { x: 1.5, y: 1.5 })).toBeUndefined();
  });
});
