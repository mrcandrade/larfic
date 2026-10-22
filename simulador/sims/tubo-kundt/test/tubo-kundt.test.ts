import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import { endCorrection, intensityRes, resonanceLength, soundSpeed, tuboKundt as sim, wavelength } from "../src/index.ts";

const P = (over: Record<string, number>) => withOverrides(sim, over);

/** Mínimos quadrados y = a + b x. */
function line(x: number[], y: number[]) {
  const n = x.length;
  const mx = x.reduce((s, v) => s + v, 0) / n;
  const my = y.reduce((s, v) => s + v, 0) / n;
  let sxy = 0;
  let sxx = 0;
  x.forEach((xi, i) => {
    sxy += (xi - mx) * (y[i]! - my);
    sxx += (xi - mx) ** 2;
  });
  const b = sxy / sxx;
  return { a: my - b * mx, b };
}

/** Aluno-modelo: deixa a água descer devagar e anota o L de maior intensidade perto de L_guess. */
function findPeak(over: Record<string, number>, Lfrom: number, Lto: number): number {
  const r = new Runner(sim, P({ ...over, modo: 0, L: Lfrom, vel: 0.02 }));
  let best = 0;
  let Lbest = 0;
  while (r.value("L") < Lto) {
    r.stepOnce();
    const I = r.value("I");
    if (I > best) [best, Lbest] = [I, r.value("L")];
  }
  return Lbest;
}

describe("tubo de ressonância e tubo de Kundt", () => {
  it("c = √(γRT/M): ar 343 m/s a 20 °C, hélio ~1007 m/s, CO₂ ~267 m/s, e c ∝ √T", () => {
    expect(soundSpeed(P({ gas: 0, T: 20 }))).toBeCloseTo(343.2, 0);
    expect(soundSpeed(P({ gas: 2, T: 20 }))).toBeCloseTo(1007, -1);
    expect(soundSpeed(P({ gas: 1, T: 20 }))).toBeCloseTo(267, 0);
    const r = soundSpeed(P({ T: 40 })) / soundSpeed(P({ T: 0 }));
    expect(r).toBeCloseTo(Math.sqrt(313.15 / 273.15), 10);
  });

  it("os máximos de intensidade estão em L = (2n−1)λ/4 − e e decrescem com n", () => {
    const p = P({ modo: 0, f: 500, r: 0.02 });
    const lam = wavelength(p);
    const peaks: number[] = [];
    for (let n = 1; n <= 3; n++) {
      const Ln = resonanceLength(p, n);
      const L = findPeak({ f: 500, r: 0.02 }, Ln - lam / 8, Ln + lam / 8);
      expect(Math.abs(L - Ln)).toBeLessThan(5e-4);
      peaks.push(intensityRes(p, L));
    }
    expect(peaks[0]).toBeCloseTo(1, 2);
    expect(peaks[1]!).toBeLessThan(peaks[0]!);
    expect(peaks[2]!).toBeLessThan(peaks[1]!);
    // Entre ressonâncias a intensidade é pequena
    expect(intensityRes(p, resonanceLength(p, 1) + lam / 4)).toBeLessThan(0.02);
  });

  it("prática: L₁ contra 1/f é reta de inclinação c/4 e intercepto −e", () => {
    const fs = [300, 450, 600, 800, 1000, 1300];
    const L1 = fs.map((f) => {
      const Ln = resonanceLength(P({ f }), 1);
      return findPeak({ f }, Math.max(0.02, Ln - 0.05), Ln + 0.05);
    });
    const fit = line(fs.map((f) => 1 / f), L1);
    expect(4 * fit.b).toBeCloseTo(soundSpeed(P({})), 0);
    expect(-fit.a).toBeCloseTo(endCorrection(P({})), 3);
  });

  it("Kundt na ressonância: o pó forma montinhos em 3 s, separados de λ/2", () => {
    const f = 1500;
    const lam = wavelength(P({ f }));
    const L = 10 * (lam / 2);
    const r = new Runner(sim, P({ modo: 1, f, L }));
    expect(r.value("formacao")).toBeLessThan(0.1);
    while (r.t < 3) r.stepOnce();
    expect(r.value("formacao")).toBeGreaterThan(0.85);
    expect(r.value("nNos")).toBe(10);
    // Centro de massa de cada montinho (grãos agrupados pelo nó mais próximo)
    const groups = new Map<number, number[]>();
    for (const x of r.state.x) {
      const n = Math.round((L - x) / (lam / 2));
      groups.set(n, [...(groups.get(n) ?? []), x]);
    }
    const centers = [...groups.entries()]
      .filter(([n, g]) => n >= 1 && n <= 8 && g.length > 5)
      .map(([n, g]) => [n, g.reduce((s, v) => s + v, 0) / g.length] as const);
    const fit = line(centers.map(([n]) => n), centers.map(([, c]) => c));
    expect(-fit.b).toBeCloseTo(lam / 2, 3);
    expect(r.value("dNos")).toBeCloseTo(lam / 2, 12);
  });

  it("Kundt fora da ressonância: o pó quase não se organiza", () => {
    const lam = wavelength(P({ f: 1500 }));
    const r = new Runner(sim, P({ modo: 1, f: 1500, L: 10 * (lam / 2) + lam / 8 }));
    while (r.t < 3) r.stepOnce();
    expect(r.value("formacao")).toBeLessThan(0.3);
  });

  it("prática Kundt: d contra 1/f é proporcional, inclinação c/2 (ar e hélio)", () => {
    for (const gas of [0, 2]) {
      const fs = [1000, 1300, 1600, 2000, 2400, 2800];
      const d = fs.map((f) => {
        const half = wavelength(P({ gas, f })) / 2;
        const L = Math.floor(1.15 / half) * half;
        const r = new Runner(sim, P({ modo: 1, gas, f, L }));
        while (r.t < 3) r.stepOnce();
        expect(r.value("formacao")).toBeGreaterThan(0.8);
        return r.value("dNos");
      });
      const x = fs.map((f) => 1 / f);
      const b = x.reduce((s, xi, i) => s + xi * d[i]!, 0) / x.reduce((s, xi) => s + xi * xi, 0);
      expect(2 * b).toBeCloseTo(soundSpeed(P({ gas })), 6);
    }
  });

  it("arrastar a superfície da água muda L; o som fica mais forte na ressonância", () => {
    const p = P({ modo: 0, f: 500 });
    const r = new Runner(sim, p);
    const from = { x: r.value("xh"), y: r.value("yh") };
    const L1 = resonanceLength(p, 1);
    let st = sim.pointer!.down!(r.state, p, from)!;
    expect(st.drag).toBe(true);
    st = sim.pointer!.move!(st, p, { x: 0, y: 1.2 - L1 }, true)!;
    st = sim.pointer!.up!(st, p, { x: 0, y: 1.2 - L1 })!;
    r.setState(st);
    expect(r.value("L")).toBeCloseTo(L1, 9);
    expect(r.value("I")).toBeCloseTo(1, 2);
    const on = { ...p, som: 1 };
    expect(sim.tone!(on, st).gain).toBeGreaterThan(sim.tone!(on, { ...st, L: L1 + 0.08 }).gain * 3);
    expect(sim.tone!(p, st).gain).toBe(0);
  });
});
