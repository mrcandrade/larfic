import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import { colorAt, fendaDupla as sim, fringeSpacing, fringesInCentral, intensityAt, slitsOf, T_SCAN, type Slits } from "../src/index.ts";

const base: Slits = { lambda: 600, d: 0.3, a: 0.1, L: 2, model: 0 };
/** Posição na tela (mm) do ângulo com sen θ = s. */
const yOf = (s: number, L: number) => L * Math.tan(Math.asin(s)) * 1e3;

describe("Fenda dupla de Young", () => {
  it("máximo central vale 1 e máximos de ordem m caem em d sen θ = mλ", () => {
    expect(intensityAt(0, base)).toBeCloseTo(1, 12);
    const ideal = { ...base, model: 1 };
    for (const m of [1, 2, 5]) {
      const y = yOf((m * 600e-9) / 0.3e-3, 2);
      expect(intensityAt(y, ideal)).toBeCloseTo(1, 9);
    }
  });

  it("mínimos em d sen θ = (m + ½)λ", () => {
    for (const m of [0, 1, 3]) {
      const y = yOf(((m + 0.5) * 600e-9) / 0.3e-3, 2);
      expect(intensityAt(y, base)).toBeLessThan(1e-12);
    }
  });

  it("com d = 3a a ordem m = 3 desaparece (zero da envoltória)", () => {
    const y3 = yOf((3 * 600e-9) / 0.3e-3, 2);
    expect(intensityAt(y3, base)).toBeLessThan(1e-12);
    expect(intensityAt(y3, { ...base, model: 1 })).toBeCloseTo(1, 9);
    expect(fringesInCentral(0.3, 0.1)).toBe(5);
    expect(fringesInCentral(0.35, 0.1)).toBe(7);
  });

  it("espaçamento medido entre máximos ≈ λL/d", () => {
    const s = { ...base, model: 1 };
    // Procura o 1º máximo lateral numericamente
    let best = 0;
    let yBest = 0;
    for (let y = 2; y < 6; y += 1e-4) {
      const I = intensityAt(y, s);
      if (I > best) [best, yBest] = [I, y];
    }
    expect(yBest).toBeCloseTo(fringeSpacing(s), 2);
    expect(fringeSpacing(s)).toBeCloseTo(4, 10);
  });

  it("luz branca: centro branco, primeira franja lateral com borda interna azulada", () => {
    const s: Slits = { lambda: 550, d: 0.2, a: 0.02, L: 1, model: 0 };
    const c0 = colorAt(0, s, true);
    for (const v of c0) expect(v).toBeCloseTo(1, 9);
    // Perto do 1º máximo do azul (≈ 2,2 mm) o azul domina sobre o vermelho
    const c1 = colorAt((450e-9 * 1) / 0.2e-3 * 1e3, s, true);
    expect(c1[2]).toBeGreaterThan(c1[0]);
  });

  it("o detector varre a tela de −W a +W e o gráfico mede I(y)", () => {
    const p = withOverrides(sim, { W: 10, modelo: 1, d: 0.3, lambda: 600, L: 2 });
    const r = new Runner(sim, p);
    expect(r.value("y")).toBeCloseTo(-10, 9);
    r.runToEnd();
    expect(r.t).toBeCloseTo(T_SCAN, 6);
    expect(r.value("y")).toBeCloseTo(10, 6);
    expect(r.value("dy")).toBeCloseTo(fringeSpacing(slitsOf(p)), 12);
  });

  it("arrastar na tela move o detector", () => {
    const p = withOverrides(sim, { W: 20 });
    const s = sim.pointer!.down!(sim.init(p), p, { x: 11, y: 2.75 });
    expect(s![0]).toBeCloseTo(10, 9);
  });
});
