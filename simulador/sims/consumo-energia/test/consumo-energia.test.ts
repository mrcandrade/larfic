import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import {
  APPLIANCES,
  BIMETAL_TAU,
  THETA_TRIP,
  bill,
  consumoEnergia as sim,
  dailyWh,
  houseAppliances,
  houseDaily,
  lampCost,
  LAMPS,
  measuredP,
  paybackDays,
  showerOut,
  tripTime,
  type CState,
} from "../src/index.ts";

const act = (s: CState, p: Record<string, number>, id: string) => sim.actions!.find((a) => a.id === id)!.run(s, p);

describe("Consumo de energia elétrica em casa", () => {
  it("medidor integra a curva de carga: um dia = Σ P·h + standby", () => {
    const p = withOverrides(sim, { modo: 0 });
    const r = new Runner(sim, p);
    const s0 = r.state;
    const expected = houseAppliances(p).reduce((a, ap, i) => a + (s0.enabled[i] ? dailyWh(ap, s0.hours[i]!) : 0), 0);
    expect(houseDaily(s0, p).total).toBeCloseTo(expected, 9);
    while (r.t < 24 / 1 - 1e-9) r.stepOnce(); // 24 s = 24 h
    expect(r.state.E / expected).toBeCloseTo(1, 2);
    // Tirar da tomada remove exatamente o standby.
    const u = act(s0, p, "tomada");
    expect(houseDaily(s0, p).total - houseDaily(u, p).total).toBeCloseTo(houseDaily(s0, p).standby, 9);
    expect(houseDaily(s0, p).standby).toBeGreaterThan(0);
  });

  it("conta: tributos por dentro e bandeira", () => {
    expect(bill(100, 0.8, 0, 0)).toBeCloseTo(80, 9);
    expect(bill(100, 0.8, 0.04463, 25)).toBeCloseTo((100 * 0.84463) / 0.75, 9);
    expect(APPLIANCES.length).toBe(10);
  });

  it("chuveiro: ΔT = P/(ṁc) e energia do banho = P·t", () => {
    expect(showerOut(5500, 4, 18) - 18).toBeCloseTo(5500 / ((4 / 60) * 4186), 9);
    const p = withOverrides(sim, { modo: 1, chave: 2, Pinv: 6000, banho: 10 });
    const r = new Runner(sim, p);
    while (r.t < 15) r.stepOnce(); // 15 s × 60 = 15 min > banho
    expect(r.state.E).toBeCloseTo((6000 * 600) / 3600, 6);
  });

  it("disjuntor: desarma no tempo da curva térmica e o fio tende a 70 °C na corrente admissível", () => {
    const p = withOverrides(sim, { modo: 3, V: 127, bitola: 1, disjuntor: 2 });
    const r = new Runner(sim, p);
    r.setState({ ...r.state, plugged: [false, false, true, true, false, false] });
    const I = 3500 / 127;
    const tExp = tripTime(I, 20);
    expect(tExp).toBeCloseTo(BIMETAL_TAU * Math.log((I / 20) ** 2 / ((I / 20) ** 2 - THETA_TRIP)), 9);
    while (!r.state.tripped && r.t < 600) r.stepOnce();
    expect(Math.abs(r.t - tExp)).toBeLessThan(0.05);
    // Curto: disparo magnético no primeiro passo.
    const r2 = new Runner(sim, p);
    r2.setState(act(r2.state, p, "curto"));
    r2.stepOnce();
    expect(r2.state.tripped).toBe(true);
  });

  it("medidor de disco recupera a potência e LED se paga como previsto", () => {
    const p = withOverrides(sim, { modo: 4, teste: 6, Kd: 3.6 });
    const r = new Runner(sim, p);
    while (r.state.revs < 5) r.stepOnce();
    expect(measuredP(r.state, p)).toBeCloseTo(1350, 6);
    const q = withOverrides(sim, { modo: 2, horasLamp: 6, tarifa: 0.8, bandeira: 0 });
    const pb = paybackDays(q);
    expect(pb).toBeCloseTo(10 / ((51 * 6 * 0.8) / 1000), 9);
    // Depois de 2 anos, LED é bem mais barato.
    expect(lampCost(LAMPS[2]!, 6, 730, 0.8)).toBeLessThan(lampCost(LAMPS[0]!, 6, 730, 0.8) / 3);
  });
});
