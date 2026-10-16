import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import {
  EPS0,
  ballBoxVolume,
  enclosedCharge,
  flux2D,
  flux3D,
  gauss as sim,
  lensVolume,
  type Source,
  type Surface,
} from "../src/index.ts";

const nC = 1e-9;
const circ = (cx: number, cy: number, a: number): Surface => ({ cx, cy, a, b: a, shape: 0 });
const rect = (cx: number, cy: number, a: number, b: number): Surface => ({ cx, cy, a, b, shape: 1 });

describe("Superfícies gaussianas e fluxo", () => {
  it("carga pontual fora do centro de uma esfera: Φ = q/ε₀; fora: Φ = 0", () => {
    const src: Source = { kind: "pontos", charges: [{ x: 0.25, y: -0.1, q: 3 * nC }] };
    expect(flux3D(src, circ(0, 0, 0.5), 48) / (3 * nC / EPS0)).toBeCloseTo(1, 2);
    expect(Math.abs(flux3D(src, circ(1.2, 0, 0.5), 48))).toBeLessThan(1e-3 * (3 * nC / EPS0));
  });

  it("caixa 3D com duas cargas dentro e uma fora soma só as internas", () => {
    const src: Source = {
      kind: "pontos",
      charges: [
        { x: 0.1, y: 0.05, q: 2 * nC },
        { x: -0.15, y: -0.1, q: -0.5 * nC },
        { x: 0.9, y: 0, q: 5 * nC },
      ],
    };
    const s = rect(0, 0, 0.4, 0.3);
    expect(enclosedCharge(src, s)).toBeCloseTo(1.5 * nC, 15);
    expect(flux3D(src, s, 40) / (1.5 * nC / EPS0)).toBeCloseTo(1, 2);
  });

  it("fio infinito: Φ = λL/ε₀ no cilindro e na caixa, zero com o fio fora", () => {
    const src: Source = { kind: "fio", x: 0.1, y: 0.05, lambda: 5 * nC };
    const exact = (5 * nC) / EPS0;
    expect(flux2D(src, circ(0, 0, 0.4), 64) / exact).toBeCloseTo(1, 3);
    expect(flux2D(src, rect(0, 0, 0.3, 0.2), 200) / exact).toBeCloseTo(1, 2);
    expect(Math.abs(flux2D(src, circ(0.8, 0, 0.3), 64))).toBeLessThan(1e-6 * exact);
  });

  it("plano infinito: Φ = σ·(área cortada)/ε₀", () => {
    const src: Source = { kind: "plano", x: 0.1, sigma: 4 * nC };
    // Caixa atravessada: área cortada = 2b × L
    expect(flux2D(src, rect(0, 0, 0.3, 0.25), 24)).toBeCloseTo((4 * nC * 0.5) / EPS0, 6);
    // Cilindro: corda 2√(a² − d²)
    const chord = 2 * Math.sqrt(0.4 ** 2 - 0.1 ** 2);
    expect(enclosedCharge(src, circ(0, 0, 0.4))).toBeCloseTo(4 * nC * chord, 15);
    expect(flux2D(src, circ(0, 0, 0.4), 400) / ((4 * nC * chord) / EPS0)).toBeCloseTo(1, 2);
  });

  it("esfera uniforme: dentro, Φ(r) = Q r³/(ε₀R³); fora, Q/ε₀", () => {
    const R = 0.35;
    const Q = 5 * nC;
    const src: Source = { kind: "esfera", x: 0, y: 0, R, Q };
    for (const r of [0.1, 0.2, 0.3]) {
      const expected = (Q * (r / R) ** 3) / EPS0;
      expect(flux3D(src, circ(0, 0, r), 32) / expected).toBeCloseTo(1, 3);
      expect(enclosedCharge(src, circ(0, 0, r)) / EPS0 / expected).toBeCloseTo(1, 10);
    }
    expect(flux3D(src, circ(0, 0, 0.6), 32) / (Q / EPS0)).toBeCloseTo(1, 3);
  });

  it("interseção parcial esfera-superfície: soma numérica concorda com o volume da interseção", () => {
    const src: Source = { kind: "esfera", x: 0.2, y: 0.1, R: 0.3, Q: 4 * nC };
    const s1 = circ(0, 0, 0.35);
    expect(flux3D(src, s1, 64) / (enclosedCharge(src, s1) / EPS0)).toBeCloseTo(1, 2);
    const s2 = rect(-0.05, 0, 0.3, 0.25);
    expect(flux3D(src, s2, 64) / (enclosedCharge(src, s2) / EPS0)).toBeCloseTo(1, 2);
  });

  it("volumes: lente entre esferas e bola dentro de caixa", () => {
    // Esfera pequena totalmente dentro
    expect(lensVolume(1, 0.5, 0.2)).toBeCloseTo((4 / 3) * Math.PI * 0.125, 12);
    // Duas esferas iguais com d = R: V = 5πR³/12
    expect(lensVolume(1, 1, 1)).toBeCloseTo((5 * Math.PI) / 12, 10);
    // Bola inteira dentro da caixa
    expect(ballBoxVolume(0, 0, 0.2, rect(0, 0, 0.5, 0.5)) / ((4 / 3) * Math.PI * 0.008)).toBeCloseTo(1, 3);
    // Caixa cortando a bola ao meio (x > 0)
    expect(ballBoxVolume(0, 0, 0.2, rect(0.5, 0, 0.5, 0.5)) / ((2 / 3) * Math.PI * 0.008)).toBeCloseTo(1, 3);
  });

  it("a sim inteira: cenário de cargas pontuais concorda com q/ε₀ e o arraste muda a carga interna", () => {
    const r = new Runner(sim, withOverrides(sim, sim.scenarios[0]!.params));
    expect(r.value("qint")).toBeCloseTo(2, 10);
    expect(r.value("Phi") / r.value("PhiT")).toBeCloseTo(1, 2);
    // Arrasta q₂ para dentro da superfície
    let s = sim.pointer!.down!(r.state, r.params, { x: 0.75, y: -0.2 })!;
    s = sim.pointer!.move!(s, r.params, { x: -0.1, y: -0.1 }, true)!;
    s = sim.pointer!.up!(s, r.params, { x: -0.1, y: -0.1 })!;
    r.setState(s);
    expect(r.value("qint")).toBeCloseTo(1, 10);
    expect(r.value("Phi") / r.value("PhiT")).toBeCloseTo(1, 2);
  });
});
