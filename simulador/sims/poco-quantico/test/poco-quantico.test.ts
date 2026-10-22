import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import { finiteWellLevels, infiniteWellE, meanX, oscillatorE, pocoQuantico as sim, solutionFor } from "../src/index.ts";

const sol = (o: Record<string, number>) => {
  const p = withOverrides(sim, o);
  return solutionFor(p, sim.init(p));
};

describe("Poço quântico (Schrödinger 1D)", () => {
  it("poço infinito: Eₙ = n²π²/2L² (Eₙ ∝ n²)", () => {
    const s = sol({ modo: 0, L: 2 });
    for (let n = 1; n <= 5; n++) expect(Math.abs(s.E[n - 1]! / infiniteWellE(n, 2) - 1)).toBeLessThan(1e-3);
    expect(s.E[2]! / s.E[0]!).toBeCloseTo(9, 2);
  });

  it("oscilador: Eₙ = (n + ½)ω", () => {
    for (const w of [0.5, 1, 2]) {
      const s = sol({ modo: 2, omega: w });
      for (let n = 0; n < 6; n++) expect(s.E[n]! / oscillatorE(n, w)).toBeCloseTo(1, 3);
    }
  });

  it("poço finito: concorda com as equações transcendentes", () => {
    const ref = finiteWellLevels(2, 10);
    const s = sol({ modo: 1, L: 2, V0: 10 });
    expect(ref.length).toBe(3);
    ref.forEach((e, i) => expect(Math.abs(s.E[i]! / e - 1)).toBeLessThan(1e-3));
    expect(s.E[0]!).toBeLessThan(infiniteWellE(1, 2));
  });

  it("autofunções ortonormais", () => {
    const s = sol({ modo: 2, omega: 1 });
    for (let a = 0; a < 4; a++)
      for (let b = 0; b < 4; b++) {
        let acc = 0;
        for (let i = 0; i < s.x.length; i++) acc += s.psi[a]![i]! * s.psi[b]![i]!;
        expect(acc * s.h).toBeCloseTo(a === b ? 1 : 0, 6);
      }
  });

  it("⟨x⟩ da superposição oscila com período 2π/(E₂ − E₁) = 2π/ω", () => {
    const s = sol({ modo: 2, omega: 1.5 });
    const T = (2 * Math.PI) / (s.E[1]! - s.E[0]!);
    expect(T).toBeCloseTo((2 * Math.PI) / 1.5, 2);
    expect(meanX(s, 0, 1, 0)).toBeCloseTo(meanX(s, 0, 1, T), 10);
    expect(Math.abs(meanX(s, 0, 1, 0) + meanX(s, 0, 1, T / 2))).toBeLessThan(1e-8);
    expect(Math.abs(meanX(s, 0, 1, 0))).toBeGreaterThan(0.3);
  });

  it("desenho com o ponteiro altera o potencial e os níveis", () => {
    const p = withOverrides(sim, { modo: 4 });
    const r = new Runner(sim, p);
    const E0 = solutionFor(p, r.state).E[0]!;
    let s = sim.actions!.find((a) => a.id === "plano")!.run(r.state, p);
    const flat = solutionFor(p, s).E[0]!;
    expect(flat / infiniteWellE(1, 16)).toBeCloseTo(1, 3);
    s = sim.pointer!.down!(s, p, { x: 10.5, y: 6 })!;
    s = sim.pointer!.move!(s, p, { x: 12, y: 6 }, true)!;
    expect(s.drawn.filter((v) => v > 0).length).toBeGreaterThan(3);
    expect(solutionFor(p, s).E[0]).not.toBe(flat);
    expect(E0).toBeGreaterThan(0);
  });
});
