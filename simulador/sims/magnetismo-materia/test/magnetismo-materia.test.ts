import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import { CHI_DIA, magnetismoMateria as sim, makeLattice, magnetization, onsagerM, sweep, TC } from "../src/index.ts";

function avgM(J: number, h: number, T: number, start: "up" | "random", eq: number, n: number) {
  let lat = makeLattice(start, 0, 11);
  for (let i = 0; i < eq; i++) lat = sweep(lat, J, h, T);
  let acc = 0, accAbs = 0;
  for (let i = 0; i < n; i++) {
    lat = sweep(lat, J, h, T);
    const m = magnetization(lat.s);
    acc += m;
    accAbs += Math.abs(m);
  }
  return { m: acc / n, abs: accAbs / n };
}

/** Roda um ciclo completo e devolve o campo coercivo (h onde M troca de sinal na descida) e a remanência. */
function loop(material: number) {
  const r = new Runner(sim, withOverrides(sim, { tipo: 2, material, varredura: 1, Tr: 0.6, H0: 3, periodo: 20, inicio: 0 }));
  let hc = NaN, rem = NaN, prev = r.state.m, prevH = r.state.h;
  for (let i = 0; i < 800; i++) {
    r.stepOnce();
    const { m, h } = r.state;
    if (i > 100 && i < 400 && Number.isNaN(rem) && prevH > 0 && h <= 0) rem = m;
    if (i > 100 && i < 400 && Number.isNaN(hc) && prev > 0 && m <= 0) hc = -h;
    prev = m;
    prevH = h;
  }
  return { hc, rem };
}

describe("Magnetismo na matéria e histerese", () => {
  it("paramagneto (J = 0): ⟨M⟩ = tanh(h/kT) e lei de Curie", () => {
    const a = avgM(0, 1, 2, "random", 50, 400);
    expect(a.m).toBeCloseTo(Math.tanh(0.5), 1);
    expect(Math.abs(a.m - Math.tanh(0.5))).toBeLessThan(0.02);
    const b = avgM(0, 0.2, 4, "random", 50, 400);
    expect(Math.abs(b.m / 0.2 - 1 / 4)).toBeLessThan(0.03);
  });

  it("ferro abaixo de T_c: magnetização espontânea de Onsager", () => {
    const T = 0.6 * TC;
    const a = avgM(1, 0, T, "up", 200, 600);
    expect(Math.abs(a.m - onsagerM(T))).toBeLessThan(0.02);
  });

  it("ferro acima de T_c: sem magnetização espontânea", () => {
    const a = avgM(1, 0, 1.6 * TC, "up", 300, 400);
    expect(a.abs).toBeLessThan(0.1);
  });

  it("histerese: remanência alta e campo coercivo maior no material duro", () => {
    const hard = loop(1);
    const soft = loop(0);
    expect(hard.rem).toBeGreaterThan(0.9);
    expect(hard.hc).toBeGreaterThan(0.8);
    expect(soft.hc).toBeLessThan(hard.hc * 0.7);
    expect(soft.hc).toBeGreaterThan(0);
  });

  it("diamagneto: M = χh com χ < 0", () => {
    const r = new Runner(sim, withOverrides(sim, { tipo: 0, varredura: 0, h: 2 }));
    r.stepOnce();
    expect(r.value("M")).toBeCloseTo(CHI_DIA * 2, 12);
    expect(r.value("M")).toBeLessThan(0);
  });
});
