import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import { orbitasKepler as sim, GU, KMS, hohmann, orbitOf } from "../src/index.ts";

const runFor = (r: Runner<ReturnType<typeof sim.init>>, years: number) => {
  while (r.t < years - 1e-9 && !r.finished) r.stepOnce();
};

describe("Órbitas e leis de Kepler", () => {
  it("órbita circular a 1 UA em torno de 1 M☉ tem período de 1 ano (medido)", () => {
    const r = new Runner(sim, withOverrides(sim, { modo: 0, M: 1, r0: 1, fv: 1, q: 0 }));
    runFor(r, 1.2);
    expect(r.value("Tmed")).toBeCloseTo(1, 4);
    expect(r.value("r")).toBeCloseTo(1, 6);
    expect(r.value("v")).toBeCloseTo(2 * Math.PI * KMS, 4);
  });

  it("elipse: energia e velocidade areolar constantes; áreas iguais em tempos iguais; T² = a³/(M+m)", () => {
    const p = withOverrides(sim, { modo: 0, M: 1.5, r0: 1.2, fv: 0.7, q: 0.01 });
    const r = new Runner(sim, p);
    const E0 = r.value("E"), A0 = r.value("areolar");
    const o = orbitOf(r.state.y, p);
    runFor(r, o.T * 1.3);
    expect(Math.abs(r.value("E") / E0 - 1)).toBeLessThan(1e-7);
    expect(r.value("areolar")).toBeCloseTo(A0, 6);
    const areas = r.state.areas;
    for (const a of areas) expect(a).toBeCloseTo((Math.PI * o.a * o.a * Math.sqrt(1 - o.e * o.e)) / 12, 3);
    expect(r.value("Tmed")).toBeCloseTo(Math.sqrt(o.a ** 3 / (1.5 * 1.01)), 3);
  });

  it("velocidade de escape: com v ≥ √2 v_circ a energia é positiva e o corpo se afasta", () => {
    const bound = new Runner(sim, withOverrides(sim, { modo: 0, fv: 1.4, q: 0 }));
    expect(bound.value("eps")).toBeLessThan(0);
    const free = new Runner(sim, withOverrides(sim, { modo: 0, fv: 1.43, q: 0 }));
    expect(free.value("eps")).toBeGreaterThan(0);
    free.runToEnd();
    expect(free.finished).toBe(true);
    expect(free.value("r")).toBeGreaterThan(4);
    expect(free.value("eps")).toBeGreaterThan(0);
  });

  it("Hohmann Terra–Marte: Δv e chegada em órbita circular no raio de destino", () => {
    const p = withOverrides(sim, { modo: 3, M: 1, r0: 1, r2: 1.524 });
    const h = hohmann(p);
    expect(h.dv1 * KMS).toBeCloseTo(2.94, 1);
    expect(h.dv2 * KMS).toBeCloseTo(2.65, 1);
    expect(h.tH * 365.25).toBeCloseTo(259, -1);
    const r = new Runner(sim, p);
    runFor(r, h.tH - 0.01);
    expect(r.state.burn).toBe(1);
    runFor(r, h.tH + 0.5);
    expect(r.state.burn).toBe(2);
    expect(r.value("r")).toBeCloseTo(1.524, 4);
    expect(r.value("v")).toBeCloseTo(Math.sqrt(GU / 1.524) * KMS, 3);
  });

  it("três corpos em oito: energia conservada e volta perto da posição inicial após um período", () => {
    const p = withOverrides(sim, { modo: 2, M: 1, r0: 1 });
    const r = new Runner(sim, p);
    const y0 = r.state.y.slice();
    const E0 = r.value("E");
    const T = 6.32591398 / (2 * Math.PI);
    runFor(r, T);
    expect(Math.abs(r.value("E") / E0 - 1)).toBeLessThan(1e-6);
    expect(Math.hypot(r.state.y[0]! - y0[0]!, r.state.y[1]! - y0[1]!)).toBeLessThan(0.02);
  });

  it("planetas internos: períodos medidos seguem T² = a³", () => {
    const r = new Runner(sim, withOverrides(sim, { modo: 4, M: 1 }));
    runFor(r, 2.1);
    const Tm = r.state.Tm;
    [0.387, 0.723, 1, 1.524].forEach((a, i) => expect(Tm[i + 1]!).toBeCloseTo(Math.sqrt(a ** 3), 2));
  });
});
