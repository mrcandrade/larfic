import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import { rlcCa as sim, cabs, carg, f0, phasors, quality, stepPhysical, init, PARALELO, SERIE } from "../src/index.ts";

describe("RLC em corrente alternada", () => {
  it("fasores: na ressonância Z = R, I = V/R e |V_C| = Q·V", () => {
    const p = withOverrides(sim, { topologia: SERIE, R: 20, L: 10, C: 1, Rg: 0, Vp: 10 });
    const fr = f0(p);
    expect(fr).toBeCloseTo(1 / (2 * Math.PI * Math.sqrt(1e-8)), 6);
    const ph = phasors(p, fr);
    expect(ph.Z[0]).toBeCloseTo(20, 9);
    expect(Math.abs(ph.Z[1])).toBeLessThan(1e-9);
    expect(cabs(ph.I)).toBeCloseTo(0.5, 9);
    expect(quality(p)).toBeCloseTo(5, 9);
    expect(cabs(ph.VC)).toBeCloseTo(50, 6);
    // Abaixo de f0 o circuito é capacitivo: corrente adiantada
    expect(carg(phasors(p, fr / 2).I)).toBeGreaterThan(0);
  });

  it("Bode: passa-baixas cai 40 dB/década e tem −90° em f0; passa-faixa tem meia potência a f0/Q", () => {
    const pc = withOverrides(sim, { topologia: SERIE, saida: 1, R: 20, L: 10, C: 1, Rg: 0 });
    const fr = f0(pc);
    const g1 = 20 * Math.log10(cabs(phasors(pc, 100 * fr).H));
    const g2 = 20 * Math.log10(cabs(phasors(pc, 1000 * fr).H));
    expect(g1 - g2).toBeCloseTo(40, 1);
    expect((carg(phasors(pc, fr).H) * 180) / Math.PI).toBeCloseTo(-90, 6);
    const pr = withOverrides(sim, { topologia: SERIE, saida: 0, R: 20, L: 10, C: 1, Rg: 0 });
    const Q = quality(pr);
    // Frequências de meia potência: f0(√(1 + 1/4Q²) ± 1/2Q)
    const fh = fr * (Math.sqrt(1 + 1 / (4 * Q * Q)) + 1 / (2 * Q));
    const fl = fr * (Math.sqrt(1 + 1 / (4 * Q * Q)) - 1 / (2 * Q));
    expect(cabs(phasors(pr, fh).H)).toBeCloseTo(Math.SQRT1_2, 9);
    expect(cabs(phasors(pr, fl).H)).toBeCloseTo(Math.SQRT1_2, 9);
    expect(fh - fl).toBeCloseTo(fr / Q, 6);
  });

  it("transiente integrado (MNA) converge para o regime fasorial", () => {
    const p = withOverrides(sim, { topologia: SERIE, inicio: 0, f: 1200, R: 50, L: 10, C: 1, Rg: 0, Vp: 10 });
    let s = init(p);
    const T = 1 / 1200;
    const h = T / 2000;
    // 2·L/R = 0,4 ms: depois de 20 ms o transiente sumiu
    for (let k = 0; k < 24 * 2000; k++) s = stepPhysical(s, p, h);
    const ph = phasors(p);
    const iReg = ph.I[0] * Math.sin(s[1]!) + ph.I[1] * Math.cos(s[1]!);
    expect(s[7]!).toBeCloseTo(iReg, 4);
    const vcReg = ph.VC[0] * Math.sin(s[1]!) + ph.VC[1] * Math.cos(s[1]!);
    expect(s[2]!).toBeCloseTo(vcReg, 3);
  });

  it("começando em regime permanente, a parte transitória fica desprezível", () => {
    const p = withOverrides(sim, { topologia: SERIE, inicio: 1, f: 900, R: 20, L: 10, C: 1, Vp: 10 });
    const r = new Runner(sim, p);
    let worst = 0;
    for (let k = 0; k < 2000; k++) {
      r.stepOnce();
      worst = Math.max(worst, Math.abs(r.value("itr")));
    }
    expect(worst / r.value("Ip")).toBeLessThan(2e-3);
  });

  it("paralelo: corrente mínima em f0, tanque com |Z| = R e correntes de L e C opostas", () => {
    const p = withOverrides(sim, { topologia: PARALELO, R: 10000, L: 10, C: 1, Rg: 500, Vp: 10 });
    const fr = f0(p);
    const ph = phasors(p, fr);
    expect(cabs(ph.I)).toBeCloseTo(10 / 10500, 9);
    expect(cabs(ph.IL)).toBeCloseTo(cabs(ph.IC), 9);
    expect(cabs(ph.I)).toBeLessThan(cabs(phasors(p, fr * 1.1).I));
    expect(cabs(ph.I)).toBeLessThan(cabs(phasors(p, fr / 1.1).I));
    // Transiente integrado: soma das correntes de ramo = corrente da fonte
    const r = new Runner(sim, p);
    for (let k = 0; k < 500; k++) r.stepOnce();
    expect(r.value("iR") + r.value("iL") + r.value("iC")).toBeCloseTo(r.value("i"), 9);
  });
});
