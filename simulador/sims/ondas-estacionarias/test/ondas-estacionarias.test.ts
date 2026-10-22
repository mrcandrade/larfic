import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import { MODO, M, displacement, freq, ondasEstacionarias as sim, pluckCoefficient, sineCoefficients } from "../src/index.ts";

describe("ondas estacionárias", () => {
  it("fₙ = n·v/2L com v = √(T/μ)", () => {
    const p = withOverrides(sim, { L: 0.65, T: 72, mu: 2 });
    const v = Math.sqrt(72 / 0.002);
    expect(freq(p, 1)).toBeCloseTo(v / 1.3, 9);
    expect(freq(p, 5)).toBeCloseTo((5 * v) / 1.3, 9);
  });

  it("série de senos de um perfil triangular = fórmula analítica do dedilhado", () => {
    const L = 0.8;
    const a = 0.3 * L;
    const h = 0.004;
    const shape = Array.from({ length: M + 1 }, (_, i) => {
      const x = (i / M) * L;
      return x <= a ? (h * x) / a : (h * (L - x)) / (L - a);
    });
    const b = sineCoefficients(shape, L, 12);
    for (let n = 1; n <= 12; n++) expect(b[n - 1]!).toBeCloseTo(pluckCoefficient(n, a, h, L), 9);
  });

  it("dedilhada no meio: harmônicos pares nulos; em L/3: 3º e 6º nulos", () => {
    const meio = new Runner(sim, withOverrides(sim, { modo: MODO.dedilhada, xp: 0.5 })).state.b;
    expect(Math.abs(meio[1]!)).toBeLessThan(1e-12);
    expect(Math.abs(meio[3]!)).toBeLessThan(1e-12);
    expect(Math.abs(meio[2]!)).toBeGreaterThan(1e-5);
    const terco = new Runner(sim, withOverrides(sim, { modo: MODO.dedilhada, xp: 1 / 3 })).state.b;
    expect(Math.abs(terco[2]!)).toBeLessThan(1e-12);
    expect(Math.abs(terco[5]!)).toBeLessThan(1e-12);
  });

  it("a série reconstrói a forma inicial e o movimento é periódico com T₁ = 2L/v", () => {
    const p = withOverrides(sim, { modo: MODO.dedilhada, xp: 0.3, h: 5, lento: 1 });
    const r = new Runner(sim, p);
    const L = p.L!;
    // Em t = 0 a corda é o triângulo (erro pequeno com 80 modos)
    expect(displacement(r.state, p, 0.3 * L)).toBeCloseTo(0.005, 4);
    expect(displacement(r.state, p, 0.65 * L)).toBeCloseTo((0.005 * 0.35) / 0.7, 4);
    const T1 = 1 / freq(p, 1);
    const s = { ...r.state, tau: 3 * T1 };
    for (const u of [0.1, 0.45, 0.8]) expect(displacement(s, p, u * L)).toBeCloseTo(displacement(r.state, p, u * L), 9);
    // Meio período: a forma aparece refletida, y(x, T/2) = −y(L − x, 0)
    const half = { ...r.state, tau: T1 / 2 };
    expect(displacement(half, p, 0.2 * L)).toBeCloseTo(-displacement(r.state, p, 0.8 * L), 9);
  });

  it("modo normal: nós parados e energia conservada sem amortecimento", () => {
    const p = withOverrides(sim, { modo: MODO.modo, n: 4, lento: 1 });
    const r = new Runner(sim, p);
    const E0 = r.value("E");
    for (let i = 0; i < 137; i++) r.stepOnce();
    expect(Math.abs(displacement(r.state, p, p.L! / 4))).toBeLessThan(1e-15);
    expect(Math.abs(displacement(r.state, p, p.L! / 2))).toBeLessThan(1e-15);
    expect(r.value("E") / E0).toBeCloseTo(1, 12);
    expect(r.value("E1")).toBe(0);
  });

  it("amortecimento γₙ = γn: harmônicos altos perdem energia mais rápido", () => {
    const r = new Runner(sim, withOverrides(sim, { modo: MODO.dedilhada, xp: 0.1, gamma: 5, lento: 1 }));
    const f0 = r.value("E1");
    for (let i = 0; i < 300; i++) r.stepOnce();
    expect(r.value("E1")).toBeGreaterThan(f0);
  });
});
