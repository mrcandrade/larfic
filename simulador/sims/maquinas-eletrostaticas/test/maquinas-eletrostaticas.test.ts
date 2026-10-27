import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import {
  BALLOON_M,
  E_BD,
  MU_WALL,
  WIM_QMAX,
  WIM_SECTORS,
  capacitance,
  gapBreakdown,
  leakResistance,
  maquinasEletrostaticas as sim,
  minStickCharge,
  paschen,
  protectedRadius,
  sphereC,
  strikeDistance,
  strikeTarget,
  timeToReach,
  vdgCurrent,
  wallForce,
  wimSparkV,
  type MState,
} from "../src/index.ts";

const act = (s: MState, p: Record<string, number>, id: string) => sim.actions!.find((a) => a.id === id)!.run(s, p);

describe("Máquinas eletrostáticas", () => {
  it("Van de Graaff: primeira faísca no instante previsto por V(t) = IR(1 − e^{−t/τ})", () => {
    const p = withOverrides(sim, { modo: 0, R: 0.2, dBola: 20, U: 40, v: 10, sigma: 15 });
    const I = vdgCurrent(p);
    expect(I).toBeCloseTo(15e-6 * 0.05 * 10, 12);
    const C = sphereC(0.2);
    expect(capacitance(p)).toBeCloseTo(C, 15);
    const Vs = gapBreakdown(0.2, 0.2);
    expect(Vs).toBeCloseTo(E_BD * 0.1, 6);
    const tStar = timeToReach(Vs, I, leakResistance(40), C);
    const r = new Runner(sim, p);
    while (r.state.sparks === 0 && r.t < 60) r.stepOnce();
    expect(Math.abs(r.t - tStar)).toBeLessThan(0.011);
    // Esfera muito longe: o limite é E·R.
    expect(gapBreakdown(0.2, 1e9)).toBeCloseTo(E_BD * 0.2, 0);
  });

  it("Wimshurst: intervalo entre faíscas = C V_rup / I e cai pela metade ao dobrar a rotação", () => {
    const period = (rpm: number) => {
      const p = withOverrides(sim, { modo: 1, rpm, Cl: 200, dBola: 3, U: 15 });
      const r = new Runner(sim, p, { dt: 1e-3 });
      while (r.state.sparks < 4 && r.t < 120) r.stepOnce();
      return r.state.period;
    };
    const T1 = period(120);
    const I = 2 * WIM_SECTORS * WIM_QMAX * 2;
    expect(T1 / ((200e-12 * wimSparkV(0.03)) / I)).toBeCloseTo(1, 1);
    expect(period(240) / T1).toBeCloseTo(0.5, 1);
  });

  it("balão: carga mínima satisfaz μF = mg e o balão bem carregado gruda na parede", () => {
    const er = 5;
    const q = minStickCharge(er);
    expect((MU_WALL * wallForce(q, 0, er)) / (BALLOON_M * 9.81)).toBeCloseTo(1, 9);
    const p = withOverrides(sim, { modo: 2, U: 20, er });
    let s = act(sim.init(p), p, "esfregar");
    expect(Math.abs(s.Q)).toBeGreaterThan(q);
    s = { ...s, bx: 0.95 - 0.12 - 0.02, by: 1.0 };
    for (let i = 0; i < 300; i++) s = sim.step!(s, p, 0, 0.01);
    expect(s.stuck).toBe(true);
    expect(s.by).toBeCloseTo(1.0, 1);
    // Sem carga ele cai até o chão.
    let n = { ...sim.init(p), bx: 0.8, by: 1.0 };
    for (let i = 0; i < 300; i++) n = sim.step!(n, p, 0, 0.01);
    expect(n.by).toBeCloseTo(0.12, 3);
  });

  it("Travoltage: Paschen ≈ 3–5 kV/mm e a faísca salta quando |V| atinge V_rup", () => {
    expect(paschen(1e-3) / 1e3).toBeGreaterThan(4);
    expect(paschen(1e-3) / 1e3).toBeLessThan(6);
    expect(paschen(1e-2) / paschen(1e-3)).toBeLessThan(10);
    const p = withOverrides(sim, { modo: 3, Cb: 150, U: 15 });
    let s = act(sim.init(p), p, "pe");
    const V0 = Math.abs(s.Qb) / 150e-12;
    expect(V0).toBeGreaterThan(20e3);
    s = act(s, p, "tocar");
    s = sim.step!(s, p, 0, 0.01);
    expect(s.sparks).toBe(1);
    expect(s.Qb).toBe(0);
    expect(s.Espark / (0.5 * 150e-12 * V0 * V0)).toBeCloseTo(1, 2);
  });

  it("para-raios: r_s = 10 I^0,65 e líder fora do raio protegido atinge o solo", () => {
    expect(strikeDistance(10)).toBeCloseTo(10 * 10 ** 0.65, 9);
    const rs = strikeDistance(30);
    const rp = protectedRadius(20, rs);
    expect(rp).toBeCloseTo(Math.sqrt(20 * (2 * rs - 20)), 9);
    const sc = { mastX: 30, mastH: 20, houseX: 600, houseW: 10, houseH: 6 };
    expect(strikeTarget(sc, 30 + 0.5 * rp, rs).kind).toBe("haste");
    expect(strikeTarget(sc, 30 + rp + 3, rs).kind).toBe("solo");
  });
});
