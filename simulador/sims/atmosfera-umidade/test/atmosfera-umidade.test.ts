import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import {
  atmosferaUmidade as sim,
  boilT,
  dewPoint,
  esat,
  isaP,
  isaT,
  isoP,
  psatAntoine,
  scaleHeight,
  tebC,
  urFromPsy,
  wetBulb,
} from "../src/index.ts";

describe("atmosfera e umidade", () => {
  it("atmosfera padrão confere com a tabela US 1976", () => {
    expect(isaP(0)).toBeCloseTo(101325, 6);
    expect(isaT(11e3)).toBeCloseTo(216.65, 6);
    expect(isaP(11e3) / 22632.1).toBeCloseTo(1, 3);
    expect(isaP(20e3) / 5474.89).toBeCloseTo(1, 3);
    expect(isaP(32e3) / 868.02).toBeCloseTo(1, 3);
    expect(isaT(47e3)).toBeCloseTo(270.65, 6);
    // Contínua na passagem para a termosfera
    expect(isaP(84852 + 1) / isaP(84852 - 1)).toBeCloseTo(1, 3);
  });

  it("modelo isotérmico: altura de escala ≈ 8,4 km e P(H) = P₀/e", () => {
    expect(scaleHeight(288) / 1000).toBeCloseTo(8.43, 1);
    expect(isoP(scaleHeight(260), 260)).toBeCloseTo(101325 / Math.E, 6);
  });

  it("Clausius–Clapeyron: 100 °C a 1 atm, < 90 °C em La Paz, ≈ 120 °C na panela de pressão", () => {
    expect(boilT(101325) - 273.15).toBeCloseTo(100, 9);
    const laPaz = tebC(withOverrides(sim, { local: 3640 }));
    expect(laPaz).toBeGreaterThan(86);
    expect(laPaz).toBeLessThan(89);
    const panela = tebC(withOverrides(sim, { local: 0, panela: 100 }));
    expect(panela).toBeGreaterThan(119);
    expect(panela).toBeLessThan(123);
    // Concorda com os dados (Antoine) dentro de 1,5 °C entre 60 e 140 °C
    for (const P of [20e3, 50e3, 200e3, 350e3]) {
      let lo = 300, hi = 420;
      for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (psatAntoine(m) < P) lo = m; else hi = m; }
      expect(Math.abs(boilT(P) - lo)).toBeLessThan(1.5);
    }
  });

  it("umidade: orvalho = T com UR 100%; bulbo úmido entre orvalho e T; psicrômetro inverte", () => {
    expect(dewPoint(25, 1)).toBeCloseTo(25, 9);
    expect(esat(dewPoint(30, 0.5))).toBeCloseTo(0.5 * esat(30), 6);
    const tu = wetBulb(30, 0.5);
    expect(tu).toBeGreaterThan(dewPoint(30, 0.5));
    expect(tu).toBeLessThan(30);
    expect(urFromPsy(30, tu)).toBeCloseTo(0.5, 6);
    expect(wetBulb(20, 1)).toBeCloseTo(20, 6);
  });

  it("panela: a água para de esquentar na ebulição e evapora a P/L", () => {
    const r = new Runner(sim, withOverrides(sim, { modo: 1, local: 0, pot: 2000 }));
    for (let i = 0; i < 1500; i++) r.stepOnce();
    expect(r.value("Tw")).toBeCloseTo(100, 6);
    const m0 = r.value("mev"), t0 = r.state.tf;
    for (let i = 0; i < 100; i++) r.stepOnce();
    expect((r.value("mev") - m0) / 1000).toBeCloseTo((2000 * (r.state.tf - t0)) / 2.257e6, 6);
  });

  it("copo: só condensa abaixo do ponto de orvalho", () => {
    const molhado = new Runner(sim, withOverrides(sim, { modo: 2, Tar: 30, UR: 70, Tgelo: 2 }));
    for (let i = 0; i < 1000; i++) molhado.stepOnce();
    expect(molhado.value("Tc")).toBeLessThan(molhado.value("Td"));
    expect(molhado.value("mc")).toBeGreaterThan(0);
    const seco = new Runner(sim, withOverrides(sim, { modo: 2, Tar: 30, UR: 20, Tgelo: 5 }));
    for (let i = 0; i < 1000; i++) seco.stepOnce();
    expect(seco.value("mc")).toBe(0);
  });

  it("balão: V ∝ T/P e estoura na altitude prevista", () => {
    const r = new Runner(sim, withOverrides(sim, { modo: 0, vsub: 10, Dburst: 8 }));
    for (let i = 0; i < 4000 && !r.state.burst; i++) r.stepOnce();
    expect(r.state.burst).toBe(true);
    expect(r.value("Vbal")).toBeCloseTo((Math.PI / 6) * 8 ** 3, -1);
    expect(r.value("h")).toBeGreaterThan(25);
    expect(r.value("h")).toBeLessThan(35);
  });
});
