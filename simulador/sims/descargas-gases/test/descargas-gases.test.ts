import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import {
  AYRTON,
  GASES,
  NEON_VB,
  V_EXT,
  arcCurrent,
  arcMaxGap,
  arcV,
  coilFrequency,
  descargasGases as sim,
  ionCurrent,
  larmorRadius,
  paschenMinPd,
  paschenMinV,
  paschenV,
  pumpPressure,
  relaxationPeriod,
  traceElectron,
  VOL,
  Q_BG,
  type DState,
} from "../src/index.ts";

const act = (s: DState, p: Record<string, number>, id: string) => sim.actions!.find((a) => a.id === id)!.run(s, p);

describe("Descargas em gases e no vácuo", () => {
  it("Paschen: mínimo em (pd)_mín e bomba exponencial", () => {
    const air = GASES[0]!;
    const pd = paschenMinPd(air);
    expect(paschenV(air, pd, 1)).toBeCloseTo(paschenMinV(air), 6);
    expect(paschenV(air, pd * 1.1, 1)).toBeGreaterThan(paschenMinV(air));
    expect(paschenV(air, pd * 0.9, 1)).toBeGreaterThan(paschenMinV(air));
    expect(paschenV(air, 760, 1) / 1e3).toBeGreaterThan(25); // ~3 MV/m no ar
    const p = withOverrides(sim, { modo: 0, p0: 760 });
    const r = new Runner(sim, p);
    while (r.t < 8 - 1e-9) r.stepOnce();
    expect(r.state.p).toBeCloseTo(pumpPressure(760, 1e-3, 4, 8), 6);
  });

  it("neon: período do oscilador de relaxação = RC ln((E−Ve)/(E−Vb))", () => {
    const p = withOverrides(sim, { modo: 1, E: 150, R: 1, C: 0.5 });
    const r = new Runner(sim, p);
    while (r.state.flashes < 4 && r.t < 10) r.stepOnce();
    const T = relaxationPeriod(150, 1e6, 0.5e-6, NEON_VB, V_EXT);
    expect(Math.abs(r.state.period - T)).toBeLessThan(0.012);
    // Sem capacitor, E abaixo de 90 V: apagada.
    const q = withOverrides(sim, { modo: 1, E: 80, C: 0 });
    const r2 = new Runner(sim, q);
    r2.stepOnce();
    expect(r2.state.lit).toBe(false);
  });

  it("raios catódicos: em B uniforme o desvio segue o círculo de raio p/(eB)", () => {
    const V = 5000;
    const B = 1e-3;
    const R = larmorRadius(V, B);
    const L = 0.1;
    const tr = traceElectron(V, () => B, 0, 0, 0, L, 1e-4);
    const [x, y] = tr[tr.length - 1]!;
    const yExact = R - Math.sqrt(R * R - x * x);
    expect(y / yExact).toBeCloseTo(1, 3);
  });

  it("arco: raiz estável de Ayrton e comprimento máximo pela tangência", () => {
    const I = arcCurrent(120, 8, 3);
    expect(120 - 8 * I).toBeCloseTo(arcV(I, 3), 9);
    expect(8 - (AYRTON.C + AYRTON.D * 3) / (I * I)).toBeGreaterThan(0);
    const dmax = arcMaxGap(120, 8);
    expect(Number.isFinite(arcCurrent(120, 8, dmax * 0.999))).toBe(true);
    expect(Number.isFinite(arcCurrent(120, 8, dmax * 1.01))).toBe(false);
    const p = withOverrides(sim, { modo: 4, Ea: 120, Ra: 8 });
    let s = act(sim.init(p), p, "acender");
    s = { ...s, gap: dmax * 1.05 };
    s = sim.step!(s, p, 0, 0.005);
    expect(s.arcOn).toBe(false);
  });

  it("bobina abre na frequência prevista e o eletroscópio descarrega linearmente", () => {
    const p = withOverrides(sim, { modo: 5 });
    const r = new Runner(sim, p);
    while (r.t < 10 - 1e-9) r.stepOnce(); // 10 s × 0,02 = 0,2 s de modelo
    expect(r.state.breaks / (0.2 * coilFrequency())).toBeCloseTo(1, 1);
    expect(r.state.sparks).toBe(r.state.breaks);
    const q = withOverrides(sim, { modo: 6, fonte: 0, Q0: 10 });
    const r2 = new Runner(sim, q);
    for (let i = 0; i < 200; i++) r2.stepOnce();
    const I = ionCurrent(Q_BG, VOL);
    expect(10 - r2.state.Q).toBeCloseTo(I * 1e9 * r2.state.clock, 9);
  });
});

describe("lâmpadas (Monte Carlo)", () => {
  it("fósforo converte o UV do mercúrio: eficiência visível muito maior e limitada pela razão de energias", () => {
    const eta = (o: Record<string, number>) => {
      const r = new Runner(sim, withOverrides(sim, { modo: 3, ...o }));
      for (let i = 0; i < 300; i++) r.stepOnce();
      return r.value("eta") / 100;
    };
    const com = eta({ lampGas: 1, fosforo: 1 });
    const sem = eta({ lampGas: 1, fosforo: 0 });
    expect(com).toBeGreaterThan(5 * sem);
    // Cada UV de 4,89 eV vira no máximo um fóton de ~2,3 eV.
    expect(com).toBeLessThan(2.8 / 4.89);
    const ne = eta({ lampGas: 0 });
    expect(ne).toBeLessThan(2.3 / 18.7);
    expect(ne).toBeGreaterThan(0.05);
  });
});
