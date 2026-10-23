import { describe, expect, it } from "vitest";
import { Runner, commitHistory, solveCircuit, withOverrides, type Element } from "@fisilab/core";
import {
  DIODE,
  ampOf,
  ceBias,
  ceGainTheory,
  defaultBJT,
  defaultNMOS,
  divider,
  drainCurrent,
  mosQPoint,
  mosRegion,
  icCurve,
  ldrR,
  ntcR,
  qPoint,
  rectStep,
  switchCircuit,
  transistorRetificador as sim,
  type RectParams,
} from "../src/index.ts";

/** Simula o retificador por 1,5 s e mede o último período. */
function runRect(rp: RectParams, h = 5e-5) {
  let vo = 0;
  const tEnd = 1.5;
  const T = 1 / rp.f;
  let max = -Infinity, min = Infinity, sum = 0, n = 0;
  for (let k = 1; k * h <= tEnd; k++) {
    const t = k * h;
    vo = rectStep(rp, rp.Vp * Math.sin(2 * Math.PI * rp.f * t), vo, h).vo;
    if (t > tEnd - T) {
      max = Math.max(max, vo);
      min = Math.min(min, vo);
      sum += vo;
      n++;
    }
  }
  return { max, min, mean: sum / n };
}

describe("Transistor, retificador, termistor e LDR", () => {
  it("transistor: I_C ≈ βI_B na região ativa (com Early) e reta de carga", () => {
    const q = defaultBJT(150);
    const ib = 20e-6;
    expect(icCurve(q, ib, 5) / (150 * ib * (1 + 5 / 100))).toBeCloseTo(1, 3);
    // saturação: com V_CE pequeno I_C cai muito abaixo de βI_B
    expect(icCurve(q, ib, 0.05)).toBeLessThan(0.3 * 150 * ib);
    const Q = qPoint(q, ib, 12, 2200);
    expect(Q.vce + 2200 * Q.ic).toBeCloseTo(12, 6);
    expect(Q.ic).toBeCloseTo(icCurve(q, ib, Q.vce), 8);
  });

  it("chave: base forte satura (V_CE < 0,2 V), base fraca deixa na região ativa", () => {
    const q = defaultBJT(150);
    const sat = switchCircuit(q, 5, 1000, 12, 100);
    expect(sat.vce).toBeLessThan(0.2);
    expect(sat.ic).toBeCloseTo((12 - sat.vce) / 100, 6);
    const weak = switchCircuit(q, 5, 470e3, 12, 100);
    expect(weak.vce).toBeGreaterThan(5);
    expect(weak.ic / weak.ib / (150 * (1 + weak.vce / 100))).toBeCloseTo(1, 2);
    expect(switchCircuit(q, 0, 1000, 12, 100).ic).toBeLessThan(1e-9);
  });

  it("amplificador: ganho de pequenos sinais = g_m (R_C ∥ r_o); sem C_E ≈ R_C/(R_E + r_e)", () => {
    const base = withOverrides(sim, { modo: 2, vin: 1, desvio: 1 });
    const A = ampOf(base);
    expect(A.gain / Math.abs(A.theory)).toBeCloseTo(1, 1);
    expect(A.thd).toBeLessThan(0.01);
    const q = defaultBJT(150);
    const b = ceBias(q, { vcc: 12, r1: 47e3, r2: 10e3, rc: 2200, re: 1000, bypass: true });
    // V_E = V_B − V_BE e I_C ≈ V_E/R_E
    expect(b.ve).toBeCloseTo(b.vb - b.vbe, 9);
    // I_C = α I_E, com o fator de Early (1 + V_CE/V_A)
    expect(b.ic / ((b.ve / 1000) * (150 / 151))).toBeCloseTo(1 + b.vce / 100, 2);
    const nb = ampOf(withOverrides(sim, { modo: 2, vin: 50, desvio: 0 }));
    expect(nb.gain).toBeGreaterThan(1.9);
    expect(nb.gain).toBeLessThan(2.3);
    expect(nb.gain / Math.abs(nb.theory)).toBeCloseTo(1, 1);
    // sinal grande distorce
    expect(ampOf(withOverrides(sim, { modo: 2, vin: 200, desvio: 1 })).thd).toBeGreaterThan(0.1);
    void ceGainTheory;
  });

  it("retificador sem filtro: meia onda ≈ (V_p − V_D)/π; ponte ≈ 2(V_p − 2V_D)/π", () => {
    const Vp = 12 * Math.SQRT2;
    const half = runRect({ bridge: false, Vp, f: 60, R: 1000, C: 0, Rs: 1 });
    const full = runRect({ bridge: true, Vp, f: 60, R: 1000, C: 0, Rs: 1 });
    expect(half.min).toBeCloseTo(0, 2);
    expect(half.mean / ((Vp - 0.75) / Math.PI)).toBeCloseTo(1, 1);
    expect(full.mean / ((2 * (Vp - 1.5)) / Math.PI)).toBeCloseTo(1, 1);
    expect(full.mean / half.mean).toBeCloseTo(2, 0);
  });

  it("filtro capacitivo: ondulação concorda com o MNA do núcleo e escala com 1/(f_r C)", () => {
    const Vp = 17;
    const rp: RectParams = { bridge: false, Vp, f: 60, R: 1000, C: 220e-6, Rs: 1 };
    const mine = runRect(rp);
    // mesma meia onda com solveCircuit (fonte com R interna, diodo 1N4007, C e R)
    const h = 5e-5;
    const els: Element[] = [
      { kind: "V", a: 1, b: 0, V: 0, R: 1 },
      { kind: "D", a: 1, b: 2, Is: DIODE.Is, n: DIODE.n },
      { kind: "C", a: 2, b: 0, C: rp.C, v0: 0 },
      { kind: "R", a: 2, b: 0, R: rp.R },
    ];
    let max = -Infinity, min = Infinity;
    for (let k = 1; k * h <= 1.5; k++) {
      (els[0] as { V: number }).V = Vp * Math.sin(2 * Math.PI * 60 * k * h);
      const sol = solveCircuit(3, els, h);
      commitHistory(els, sol);
      if (k * h > 1.5 - 1 / 60) {
        max = Math.max(max, sol.v[2]!);
        min = Math.min(min, sol.v[2]!);
      }
    }
    expect(mine.max).toBeCloseTo(max, 1);
    expect((mine.max - mine.min) / (max - min)).toBeCloseTo(1, 1);
    // ponte: f_r dobra, a ondulação cai à metade (aprox.)
    const full = runRect({ ...rp, bridge: true });
    expect((mine.max - mine.min) / (full.max - full.min)).toBeGreaterThan(1.7);
    expect((mine.max - mine.min) / (full.max - full.min)).toBeLessThan(2.3);
    // ordem de grandeza da aproximação ΔV ≈ V/(f R C)
    const approx = mine.mean / (60 * 1000 * rp.C);
    expect((mine.max - mine.min) / approx).toBeGreaterThan(0.75);
    expect((mine.max - mine.min) / approx).toBeLessThan(1.05);
  });

  it("runner: a ponte com filtro chega ao regime e mede V_DC e ondulação", () => {
    const r = new Runner(sim, withOverrides(sim, { modo: 4, Vrms: 12, C: 470, RL: 1000 }));
    r.runToEnd(1.2);
    const vdc = r.value("Vdc");
    expect(vdc).toBeGreaterThan(14);
    expect(vdc).toBeLessThan(12 * Math.SQRT2 - 1.2);
    expect(r.value("ripple")).toBeGreaterThan(0.05);
    expect(r.value("ripple")).toBeLessThan(0.4);
  });

  it("sensores: NTC segue o modelo β, LDR cai como E^−γ e divisor ótimo com R_f = R_s", () => {
    expect(ntcR(25)).toBeCloseTo(10000, 6);
    expect(ntcR(0) / ntcR(50)).toBeCloseTo(Math.exp(3950 * (1 / 273.15 - 1 / 323.15)), 9);
    expect(ldrR(10) / ldrR(1000)).toBeCloseTo(100 ** 0.7, 0);
    expect(divider(5, 10e3, 10e3)).toBeCloseTo(2.5, 12);
    // sensibilidade dV/dR_s máxima quando R_f = R_s
    const sens = (rf: number) => Math.abs(divider(5, 10e3 * 1.001, rf) - divider(5, 10e3, rf));
    expect(sens(10e3)).toBeGreaterThan(sens(5e3));
    expect(sens(10e3)).toBeGreaterThan(sens(20e3));
  });
  it("MOSFET: corte, triodo e saturação com lei quadrática", () => {
    const m = defaultNMOS();
    expect(drainCurrent(m, 1, 5)).toBe(0);
    expect(mosRegion(m, 1, 5)).toBe("corte");
    const sat = (vgs: number) => drainCurrent({ ...m, lambda: 0 }, vgs, 10);
    expect(sat(m.Vt + 2) / sat(m.Vt + 1)).toBeCloseTo(4, 10);
    expect(mosRegion(m, 4, 1)).toBe("triodo");
    // continuidade na fronteira V_DS = V_ov
    const vov = 2;
    expect(drainCurrent(m, m.Vt + vov, vov - 1e-9)).toBeCloseTo(drainCurrent(m, m.Vt + vov, vov), 9);
    // ponto Q sobre a reta de carga
    const q = mosQPoint(m, 3, 12, 2200);
    expect(q.vds).toBeCloseTo(12 - 2200 * q.id, 6);
    expect(q.reg).toBe("saturação");
    expect(mosQPoint(m, 5, 12, 2200).reg).toBe("triodo");
    const r = new Runner(sim, withOverrides(sim, { modo: 6, VGS: 3, VCC: 12, RC: 2200 }));
    expect(r.value("ID")).toBeCloseTo(q.id * 1e3, 6);
  });
});
