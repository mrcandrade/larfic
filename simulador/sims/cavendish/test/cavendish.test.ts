import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import { cavendish as sim, G0, SMALL, betaCorr, gField, period0, psiI, thetaEq, type CV } from "../src/index.ts";

const runPhys = (r: Runner<CV>, T: number) => {
  while (r.state.tf < T) r.stepOnce();
};

describe("Cavendish e gravitação", () => {
  it("equilíbrio da balança ≈ 2dGMm(1 − β)/(κb²)", () => {
    const p = withOverrides(sim, { modo: 0, M: 1.5, b: 46.5, kappa: 8 });
    const b = 0.0465;
    const approx = (2 * SMALL.d * G0 * 1.5 * SMALL.m * (1 - betaCorr(p))) / (8e-9 * b * b);
    expect(Math.abs(thetaEq(psiI(p), p) - approx) / approx).toBeLessThan(0.05);
    expect(thetaEq(-psiI(p), p)).toBeCloseTo(-thetaEq(psiI(p), p), 12);
  });

  it("período medido pelos extremos do laser ≈ 2π√(I/κ)", () => {
    const r = new Runner(sim, withOverrides(sim, { modo: 0, ritmo: 200, tdec: 6000 }));
    runPhys(r, 2.5 * period0(r.params));
    expect(Math.abs(r.value("T") - period0(r.params)) / period0(r.params)).toBeLessThan(0.02); // o gradiente gravitacional "amolece" o fio um pouco
  });

  it("protocolo completo (posições I e II): G corrigido dentro de 5% do valor aceito", () => {
    const r = new Runner(sim, withOverrides(sim, { modo: 0, ritmo: 200 }));
    const T = period0(r.params);
    runPhys(r, 2.2 * T);
    r.setState(sim.actions!.find((a) => a.id === "pII")!.run(r.state, r.params));
    runPhys(r, 4.6 * T);
    expect(r.state.hasI && r.state.hasII).toBe(true);
    expect(Math.abs(r.value("Gc") - G0) / G0).toBeLessThan(0.05);
    expect(r.value("G")).toBeLessThan(G0); // sem correção sai baixo
  });

  it("lei da gravitação: F = G m1 m2 / r² e esferas não se sobrepõem", () => {
    const p = withOverrides(sim, { modo: 1, m1: 800, m2: 200 });
    let s = sim.init(p);
    s = sim.pointer!.down!(s, p, { x: 2, y: 0 })!;
    s = sim.pointer!.move!(s, p, { x: 1, y: 0 }, true)!;
    const r = new Runner(sim, p);
    r.setState(s);
    expect(r.value("F")).toBeCloseTo((G0 * 800 * 200) / 9, 15);
    s = sim.pointer!.move!(s, p, { x: -3, y: 0 }, true)!;
    expect(s.x2 - s.x1).toBeGreaterThan(0.83); // soma dos raios ≈ 0,825 m
  });

  it("campo: g na superfície da Terra ≈ 9,82 m/s², cai com 1/r² fora e é linear dentro", () => {
    const M = 5.972e24;
    const R = 6.371e6;
    expect(gField(R, M, R)).toBeCloseTo(9.82, 1);
    expect(gField(2 * R, M, R)).toBeCloseTo(gField(R, M, R) / 4, 9);
    expect(gField(R / 2, M, R)).toBeCloseTo(gField(R, M, R) / 2, 9);
    const r = new Runner(sim, withOverrides(sim, { modo: 2, vista: 1 }));
    expect(r.value("erro")).toBeGreaterThan(0);
    expect(r.value("erro")).toBeLessThan(1.5); // a 30 km
  });
});
