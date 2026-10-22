import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import { circuitosDc as sim, PRESETS, stepValue } from "../src/index.ts";

const run = (montagem: number, rInterna = 0.001) => new Runner(sim, withOverrides(sim, { montagem, rInterna }));

describe("construtor de circuitos", () => {
  it("série: amperímetro marca ε/(R1+R2+R3)", () => {
    const r = run(1);
    expect(r.value("A1")).toBeCloseTo(12 / 650, 4);
    // Voltímetro sobre o resistor de 220 Ω
    expect(r.value("V1")).toBeCloseTo((12 * 220) / 650, 3);
  });

  it("paralelo: corrente total é a soma dos ramos", () => {
    const r = run(2);
    expect(r.value("A1")).toBeCloseTo(9 * (1 / 100 + 1 / 220 + 1 / 470), 4);
  });

  it("lâmpadas em paralelo dissipam 4× mais que em série", () => {
    const r = run(3);
    const lamps = r.state.comps.filter((c) => c.kind === "lampada");
    const P = lamps.map((c) => Math.abs(c.v * c.i));
    expect(P[2]! / P[0]!).toBeCloseTo(4, 2);
  });

  it("resistência interna derruba a tensão terminal", () => {
    expect(run(1, 10).value("Vbat")).toBeLessThan(run(1, 0.001).value("Vbat"));
  });

  it("RC: com a chave fechada, Vc chega a 63% em t = RC", () => {
    const r = run(6);
    const sw = r.state.comps.find((c) => c.kind === "chave")!;
    r.setState({ ...r.state, comps: r.state.comps.map((c) => (c.id === sw.id ? { ...c, closed: true } : c)) });
    while (r.t < 1 - 1e-9) r.stepOnce(); // RC = 1000 Ω × 1 mF = 1 s
    expect(r.value("Vc") / 9).toBeCloseTo(1 - Math.exp(-1), 2);
  });

  it("diodo conduz com queda de ~0,6 V", () => {
    const r = run(7);
    const d = r.state.comps.find((c) => c.kind === "diodo")!;
    expect(d.v).toBeGreaterThan(0.5);
    expect(d.v).toBeLessThan(0.75);
  });

  it("curto-circuito gera aviso", () => {
    const r = run(0);
    const bat = r.state.comps[0]!;
    r.setState({ ...r.state, comps: [...r.state.comps, { ...bat, id: 99, kind: "fio", value: 0 }] });
    r.stepOnce();
    expect(r.state.warning).toMatch(/Curto/);
  });

  it("todas as montagens resolvem sem singularidade", () => {
    PRESETS.forEach((_, i) => expect(run(i).state.warning).not.toMatch(/Laço/));
  });

  it("série E6 de valores sobe e desce", () => {
    expect(stepValue("resistor", 100, 1)).toBe(150);
    expect(stepValue("resistor", 100, -1)).toBe(68);
    expect(stepValue("bateria", 9, 1)).toBe(12);
  });
});
