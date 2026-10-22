import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import {
  LOOP,
  birdCycle,
  galileoReading,
  magPhi,
  meanTorque,
  millBalance,
  motoPerpetuo as sim,
  psatDCM,
  rhoLiquid,
  terminalV,
  wheelTorque,
  wheelU,
} from "../src/index.ts";

describe("moto-perpétuo e máquinas reais", () => {
  it.each([0, 1])("roda %i: torque médio numa volta é zero e τ = −dU/dθ", (kind) => {
    for (const K of [6, 8, 12]) expect(Math.abs(meanTorque(kind, K, 1))).toBeLessThan(1e-3);
    // Torque é a derivada (com sinal trocado) da energia potencial
    for (const th of [0.3, 1.1, 2.5]) {
      const h = 1e-5;
      const dU = (wheelU(kind, 8, 1, th + h) - wheelU(kind, 8, 1, th - h)) / (2 * h);
      expect(wheelTorque(kind, 8, 1, th)).toBeCloseTo(-dU, 3);
    }
  });

  it("roda sem atrito conserva energia; com atrito perde e não ganha", () => {
    const r = new Runner(sim, withOverrides(sim, { modo: 0, atrito: 0, w0: 4 }));
    const E0 = r.value("E");
    for (let i = 0; i < 2000; i++) r.stepOnce();
    expect(Math.abs(r.value("E") / E0 - 1)).toBeLessThan(1e-3);
    const f = new Runner(sim, withOverrides(sim, { modo: 1, atrito: 0.3, w0: 4 }));
    const F0 = f.value("E");
    let prev = F0;
    for (let i = 0; i < 2000; i++) {
      f.stepOnce();
      expect(f.value("E")).toBeLessThanOrEqual(prev + 1e-6);
      prev = f.value("E");
    }
    expect(prev).toBeLessThan(F0);
  });

  it("moinho: volta η_roda·η_bomba·Q e o reservatório esvazia", () => {
    const b = millBalance({ Q: 0.005, H: 3, etaR: 0.7, etaB: 0.6, load: 0 });
    expect(b.Qp).toBeCloseTo(0.42 * 0.005, 12);
    expect(millBalance({ Q: 0.005, H: 3, etaR: 1, etaB: 1, load: 0 }).deficit).toBeCloseTo(0, 12);
    expect(millBalance({ Q: 0.005, H: 3, etaR: 1, etaB: 1, load: 20 }).deficit).toBeGreaterThan(0);
    const r = new Runner(sim, withOverrides(sim, { modo: 2 }));
    for (let i = 0; i < 300; i++) r.stepOnce();
    expect(r.value("Vup")).toBeCloseTo(500 - (5 - 2.1) * r.state.tf, 6);
  });

  it("rampa magnética: potencial periódico no laço e energia conservada sem atrito", () => {
    expect(magPhi(0, 1)).toBeCloseTo(magPhi(LOOP.length, 1), 9);
    const r = new Runner(sim, withOverrides(sim, { modo: 3, atrito: 0, v0: 4 }));
    const E0 = r.value("E");
    for (let i = 0; i < 1500; i++) r.stepOnce();
    expect(r.value("E") / E0).toBeCloseTo(1, 3);
  });

  it("pássaro bebedor: pressão de vapor do CH₂Cl₂, para com ar saturado, abaixo de Carnot", () => {
    expect(psatDCM(25) / 1000).toBeCloseTo(58, 0);
    const seco = birdCycle(25, 0.4), umido = birdCycle(25, 0.8);
    expect(seco.period).toBeLessThan(umido.period);
    expect(birdCycle(25, 1).period).toBe(Infinity);
    expect(seco.eta).toBeGreaterThan(0);
    expect(seco.eta).toBeLessThan(seco.carnot);
    const r = new Runner(sim, withOverrides(sim, { modo: 4, Tar: 25, UR: 40 }));
    while (r.state.ndips === 0 && r.t < 60) r.stepOnce();
    expect(r.state.tf).toBeCloseTo(seco.period, -0.5);
  });

  it("termômetro de Galileu: ampolas afundam conforme o líquido esquenta", () => {
    expect(rhoLiquid(20)).toBeCloseTo(800, 9);
    expect(terminalV(22, 21)).toBeGreaterThan(0); // etiqueta acima de T: flutua
    expect(terminalV(18, 21)).toBeLessThan(0);
    expect(galileoReading(21)).toBe(22);
    const r = new Runner(sim, withOverrides(sim, { modo: 5, Tini: 17, Tamb: 24 }));
    expect(r.value("leitura")).toBe(18);
    for (let i = 0; i < 14000; i++) r.stepOnce();
    expect(r.value("Tl")).toBeGreaterThan(23);
    expect(r.value("leitura")).toBe(24);
    // Ampola de 16 °C no fundo, de 28 °C no topo
    expect(r.state.y[0]).toBeLessThan(0.05);
    expect(r.state.y[6]).toBeGreaterThan(0.25);
  });
});
