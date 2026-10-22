import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import {
  MU0,
  bLongWire,
  bLoopAxis,
  bLoopCenter,
  bSolenoidAxis,
  bSolenoidIdeal,
  bToroid,
  biotSavart as sim,
  fieldAt,
  fieldCm,
  longWire,
  loopSegs,
  norm,
  solenoidSegs,
  toroidSegs,
  type BiotState,
} from "../src/index.ts";

const rel = (a: number, b: number) => Math.abs(a - b) / Math.abs(b);

describe("Biot-Savart por soma de segmentos", () => {
  it("fio longo: B = μ₀I/(2πd), sentido pela mão direita", () => {
    const B = fieldAt(longWire(), 7, [0.3, 0.04, 0]);
    expect(rel(norm(B), bLongWire(7, 0.04))).toBeLessThan(1e-4);
    expect(B[2]).toBeGreaterThan(0); // corrente +x, ponto em +y ⇒ B em +z
    expect(fieldAt(longWire(), 7, [0, -0.04, 0])[2]).toBeLessThan(0);
  });

  it("segmento finito: B = μ₀I/(4πd)(cosθ₁ − cosθ₂)", () => {
    // Segmento de −a a +a no eixo x; ponto em (0, d): cosθ₁ − cosθ₂ = 2a/√(a²+d²).
    const a = 0.05, d = 0.03, I = 2;
    const B = fieldAt(new Float64Array([-a, 0, 0, a, 0, 0]), I, [0, d, 0]);
    expect(rel(B[2], ((MU0 * I) / (4 * Math.PI * d)) * ((2 * a) / Math.hypot(a, d)))).toBeLessThan(5e-5); // raio do fio de 0,1 mm regulariza
  });

  it("centro da espira e eixo: μ₀I/(2R) e μ₀IR²/[2(R²+z²)^{3/2}]", () => {
    const R = 0.03, I = 5;
    const segs = loopSegs(R, 360);
    expect(rel(fieldAt(segs, I, [0, 0, 0])[2], bLoopCenter(I, R))).toBeLessThan(1e-4);
    expect(rel(fieldAt(segs, I, [0, 0, 0.04])[2], bLoopAxis(I, R, 0.04))).toBeLessThan(1e-4);
  });

  it("solenoide longo: B no centro → μ₀nI e casa com a fórmula do solenoide finito", () => {
    const R = 0.01, L = 0.3, N = 300, I = 2;
    const B = fieldAt(solenoidSegs(R, L, N, 48), I, [0, 0, 0])[2];
    expect(rel(B, bSolenoidIdeal(I, N, L))).toBeLessThan(5e-3);
    expect(rel(B, bSolenoidAxis(I, N, L, R, 0))).toBeLessThan(1e-3);
    // Fora, longe das bordas, o campo é muito menor.
    expect(Math.abs(fieldAt(solenoidSegs(R, L, N, 48), I, [0.03, 0, 0])[2])).toBeLessThan(0.02 * B);
  });

  it("toroide: B = μ₀NI/(2πr) dentro e ≈ 0 fora", () => {
    const Rt = 0.05, a = 0.015, N = 200, I = 3;
    const segs = toroidSegs(Rt, a, N, 24);
    const ph = Math.PI / N;
    for (const r of [0.042, 0.05, 0.058]) {
      const B = fieldAt(segs, I, [r * Math.cos(ph), r * Math.sin(ph), 0]);
      expect(rel(norm(B), bToroid(I, N, r))).toBeLessThan(0.01);
      // Direção azimutal (+φ̂)
      expect(-B[0] * Math.sin(ph) + B[1] * Math.cos(ph)).toBeGreaterThan(0);
    }
    expect(norm(fieldAt(segs, I, [0.09, 0, 0]))).toBeLessThan(0.01 * bToroid(I, N, Rt));
    expect(norm(fieldAt(segs, I, [0, 0, 0]))).toBeLessThan(0.01 * bToroid(I, N, Rt));
  });

  it("observáveis da sim comparam soma × fórmula com desvio pequeno", () => {
    for (const [modo, extra] of [
      [1, {}],
      [2, {}],
      [4, { N: 80, R: 5, a: 1 }],
    ] as const) {
      const r = new Runner(sim, withOverrides(sim, { modo, ...extra }));
      expect(Math.abs(r.value("desvio"))).toBeLessThan(1.5);
    }
  });

  it("desenhar no palco cria um caminho; fechar perto do início fecha a espira", () => {
    const p = withOverrides(sim, { modo: 0 });
    let s: BiotState = sim.init(p);
    s = sim.pointer!.down!(s, p, { x: -5, y: -5 })!;
    for (const [x, y] of [[5, -5], [5, 5], [-5, 5], [-5, -4.6]] as const) {
      // Trechos retos em passos de 0,5 cm
      const last = s.path[s.path.length - 1]!;
      for (let k = 1; k <= 40; k++) s = sim.pointer!.move!(s, p, { x: last[0] + ((x - last[0]) * k) / 40, y: last[1] + ((y - last[1]) * k) / 40 }, true) ?? s;
    }
    s = sim.pointer!.up!(s, p, { x: -5, y: -4.6 })!;
    expect(s.closed).toBe(true);
    // Espira quadrada de lado 2b, centro: B = 2√2 μ₀ I /(π · 2b)
    const I = p.I!;
    const Bc = fieldCm(p, s, [0, 0, 0])[2];
    expect(rel(Bc, (2 * Math.SQRT2 * MU0 * I) / (Math.PI * 0.1))).toBeLessThan(0.03);
  });
});
