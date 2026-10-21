import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import { CHALEIRA, C_AGUA, formasEnergia as sim, tBulboRegime } from "../src/index.ts";

const run = (over: Record<string, number>, T: number) => {
  const r = new Runner(sim, withOverrides(sim, over));
  while (r.t < T - 1e-9) r.stepOnce();
  return r;
};

describe("Formas e conversões de energia", () => {
  it("cadeia Sol → painel → LED: rendimentos se multiplicam e o balanço fecha", () => {
    const r = run({ modo: 0, fonte: 0, usuario: 1, irradiancia: 800 }, 10);
    expect(r.value("Pin")).toBeCloseTo(1280, 6);
    expect(r.value("Pel")).toBeCloseTo(256, 6);
    expect(r.value("Put")).toBeCloseTo(102.4, 6);
    expect(r.value("eta")).toBeCloseTo(8, 6);
    expect(r.value("Ein")).toBeCloseTo(12.8, 3);
    expect(Math.abs(r.value("bal"))).toBeLessThan(1e-9);
    expect(r.state.pk.length).toBeGreaterThan(0);
  });

  it("queda d'água: P = ρ g Q h", () => {
    const r = run({ modo: 0, fonte: 1, usuario: 0, vazao: 10 }, 1);
    expect(r.value("Pin")).toBeCloseTo(1000 * 0.01 * 9.81 * 5, 6);
    expect(r.value("Pel")).toBeCloseTo(0.8 * 490.5, 6);
  });

  it("chaleira: tempo para ferver = m c ΔT / (η P)", () => {
    const P = 2000;
    const tFerver = (CHALEIRA.m * C_AGUA * (100 - CHALEIRA.T0)) / (CHALEIRA.etaChama * P);
    const r = run({ modo: 0, fonte: 3, usuario: 3, chama: P }, tFerver - 1);
    expect(r.value("Tagua")).toBeLessThan(100);
    expect(r.value("Pel")).toBe(0);
    while (r.t < tFerver + 1) r.stepOnce();
    expect(r.value("Tagua")).toBeCloseTo(100, 6);
    expect(r.value("Pel")).toBeCloseTo(CHALEIRA.etaTurbina * CHALEIRA.etaChama * P, 6);
    expect(Math.abs(r.value("bal"))).toBeLessThan(1e-9);
  });

  it("lâmpadas com mesmo brilho: LED usa 15 % da potência; bulbo tende a T de regime", () => {
    const r = run({ modo: 1, Pel: 60, comparar: 1 }, 1500); // 12 constantes de tempo C/hA
    expect(r.value("lmInc")).toBeCloseTo(r.value("lmLED"), 6);
    expect(r.value("Pel")).toBeCloseTo(60 + 9, 6);
    expect(r.value("Tinc")).toBeCloseTo(tBulboRegime(0, 60), 1);
    expect(r.value("Tled")).toBeCloseTo(tBulboRegime(1, 9), 1);
  });

  it("aquecimento: dT/dt = P/(mc) para cada material", () => {
    const r = run({ modo: 2, calor: 200, massa: 0.2, T0: 20, Tferro: 20, arranjo: 0 }, 10);
    expect(r.value("Tferro")).toBeCloseTo(20 + (200 * 10) / (0.2 * 450), 6);
    expect(r.value("Ttijolo")).toBeCloseTo(20 + (200 * 10) / (0.2 * 840), 6);
    expect(r.value("Tagua")).toBeCloseTo(20 + (200 * 10) / (0.2 * 4186), 6);
    expect(r.value("Toleo")).toBeCloseTo(20 + (200 * 10) / (0.2 * 1970), 6);
  });

  it("ferro quente na água: equilíbrio Σ m c T / Σ m c e energia conservada", () => {
    const r = run({ modo: 2, calor: 0, massa: 0.2, Tferro: 300, T0: 20, arranjo: 1 }, 120);
    const Teq = (450 * 300 + C_AGUA * 20) / (450 + C_AGUA);
    expect(r.value("Tferro")).toBeCloseTo(Teq, 2);
    expect(r.value("Tagua")).toBeCloseTo(Teq, 2);
    const b0 = r.samples[0]!.values[sim.observables.findIndex((o) => o.key === "bal")]!;
    expect(r.value("bal")).toBeCloseTo(b0, 6);
  });

  it("arrastar o ferro para dentro do óleo cria o contato", () => {
    const p = withOverrides(sim, { modo: 2, arranjo: 0 });
    let s = sim.init(p);
    s = sim.pointer!.down!(s, p, { x: 1.6, y: 1.7 })!;
    expect(s.arr).toBe(0);
    s = sim.pointer!.move!(s, p, { x: 8.8, y: 2.5 }, true)!;
    s = sim.pointer!.up!(s, p, { x: 8.8, y: 2.5 })!;
    expect(s.blocos[0]!.host).toBe(3);
  });
});
