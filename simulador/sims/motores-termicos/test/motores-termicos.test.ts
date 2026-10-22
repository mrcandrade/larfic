import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import {
  DIESEL,
  DOIS,
  OTTO,
  VAPOR,
  WANKEL,
  cyclePoints,
  engineOf,
  etaDiesel,
  etaOtto,
  motoresTermicos as sim,
  pointAt,
  power,
  rankine,
  strokeFrac,
  totals,
  tsatWater,
  psatWater,
  volumeAt,
  volumes,
  workNumeric,
} from "../src/index.ts";

const eng = (o: Record<string, number>) => engineOf(withOverrides(sim, o));

describe("motores térmicos", () => {
  it("biela-manivela: PMS em θ = 0, PMI em θ = π", () => {
    expect(strokeFrac(0)).toBeCloseTo(0, 12);
    expect(strokeFrac(Math.PI)).toBeCloseTo(1, 12);
    const e = eng({ motor: OTTO, r: 10, cil: 0.5 });
    expect(volumeAt(e, 0)).toBeCloseTo(0.5e-3 / 9, 12);
    expect(volumeAt(e, Math.PI) / volumeAt(e, 0)).toBeCloseTo(10, 9);
  });

  it("Otto: η = 1 − r^(1−γ) e ∮P dV = η·Q_in", () => {
    for (const r of [6, 9, 12]) {
      const e = eng({ motor: OTTO, r });
      const t = totals(e);
      expect(t.eta).toBeCloseTo(etaOtto(r), 10);
      expect(workNumeric(e) / t.W).toBeCloseTo(1, 3);
      expect(t.eta).toBeLessThan(t.carnot);
    }
  });

  it("Diesel: rendimento pela fórmula fechada e trabalho pela área", () => {
    const e = eng({ motor: DIESEL, r: 18, Tmax: 2200 });
    const c = cyclePoints(e);
    const rc = c.V3 / c.Vc;
    expect(rc).toBeCloseTo(2200 / (300 * 18 ** 0.4), 9);
    const t = totals(e);
    expect(t.eta).toBeCloseTo(etaDiesel(18, rc), 10);
    expect(workNumeric(e) / t.W).toBeCloseTo(1, 3);
  });

  it("Wankel: câmara com período de 3 voltas e mesmo rendimento do Otto", () => {
    const e = eng({ motor: WANKEL, r: 9 });
    const { Vc, V1 } = volumes(e);
    expect(volumeAt(e, 0)).toBeCloseTo(Vc, 12);
    expect(volumeAt(e, 1.5 * Math.PI)).toBeCloseTo(V1, 12);
    expect(volumeAt(e, 3 * Math.PI)).toBeCloseTo(Vc, 12);
    expect(totals(e).eta).toBeCloseTo(etaOtto(9), 10);
    expect(workNumeric(e) / totals(e).W).toBeCloseTo(1, 3);
  });

  it("dois tempos: taxa efetiva menor e potência dobrada por ciclo/volta", () => {
    const e2 = eng({ motor: DOIS, r: 9, ncil: 1, rpm: 3000 });
    expect(cyclePoints(e2).rEff).toBeLessThan(9);
    expect(workNumeric(e2) / totals(e2).W).toBeCloseTo(1, 3);
    expect(power(e2)).toBeCloseTo(totals(e2).W * 3000 / 60, 6);
    const e4 = eng({ motor: OTTO, r: 9, ncil: 1, rpm: 3000 });
    expect(power(e4)).toBeCloseTo(totals(e4).W * 3000 / 120, 6);
  });

  it("potência proporcional à rotação, trabalho por ciclo constante", () => {
    const a = eng({ motor: OTTO, rpm: 3000 }), b = eng({ motor: OTTO, rpm: 6000 });
    expect(totals(b).W).toBeCloseTo(totals(a).W, 9);
    expect(power(b) / power(a)).toBeCloseTo(2, 9);
  });

  it("vapor: tabela de saturação, área do diagrama e Rankine < Carnot", () => {
    expect(tsatWater(101325) - 273.15).toBeCloseTo(100, 0);
    expect(psatWater(tsatWater(12e5)) / 12e5).toBeCloseTo(1, 6);
    const e = eng({ motor: VAPOR, Pb: 12, Pe: 1, corte: 30 });
    const t = totals(e);
    expect(workNumeric(e) / t.W).toBeCloseTo(1, 3);
    expect(t.eta).toBeGreaterThan(0.08);
    expect(t.eta).toBeLessThan(t.carnot);
    expect(t.etaMotor).toBeLessThan(t.eta + 1e-9);
    expect(rankine(12e5, 0.2e5).eta).toBeGreaterThan(rankine(12e5, 1e5).eta);
    // corte menor: menos trabalho, mais rendimento
    const curto = totals(eng({ motor: VAPOR, corte: 15 }));
    expect(curto.W).toBeLessThan(t.W);
    expect(curto.etaMotor).toBeGreaterThan(t.etaMotor);
  });

  it("o runner gira o eixo na velocidade da câmera lenta e o ponto acompanha o volume", () => {
    const r = new Runner(sim, withOverrides(sim, { motor: OTTO, rpm: 3000, lento: 0.01 }));
    for (let i = 0; i < 500; i++) r.stepOnce();
    expect(r.state[0]).toBeCloseTo((2 * Math.PI * 3000 * 0.01 * r.t) / 60, 6);
    const e = engineOf(r.params);
    expect(r.value("V")).toBeCloseTo(pointAt(e, r.state[0]!).V * 1e6, 9);
  });
});
