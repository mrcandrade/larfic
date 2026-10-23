import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import { osciladoresAcoplados as sim } from "../src/index.ts";
import { modalSolution, modesOf } from "../src/physics.ts";

describe("osciladores-acoplados", () => {
  it("N = 2 massas: ω₁ = √(k/m) e ω₂ = √((k + 2k_c)/m), modos (1,1) e (1,−1)", () => {
    const p = withOverrides(sim, { sistema: 0, N: 2, m: 0.5, k: 10, kc: 5 });
    const { omega, vec } = modesOf(p);
    expect(omega[0]).toBeCloseTo(Math.sqrt(10 / 0.5), 9);
    expect(omega[1]).toBeCloseTo(Math.sqrt(20 / 0.5), 9);
    expect(vec[0]![0]).toBeCloseTo(Math.SQRT1_2, 9);
    expect(vec[1]![1]).toBeCloseTo(-Math.SQRT1_2, 9);
  });

  it("cadeia com k = k_c: autovalores ω_n = 2√(k/m) sen(nπ/(2(N+1)))", () => {
    const N = 25;
    const p = withOverrides(sim, { sistema: 0, N, m: 0.1, k: 10, kc: 10 });
    const { omega } = modesOf(p);
    for (let n = 1; n <= N; n++) expect(omega[n - 1]).toBeCloseTo(2 * Math.sqrt(100) * Math.sin((n * Math.PI) / (2 * (N + 1))), 8);
  });

  it("pêndulos (pontas livres): ω_n² = g/L + 4(k_c/m) sen²(nπ/2N)", () => {
    const N = 6;
    const p = withOverrides(sim, { sistema: 1, N, m: 0.5, kc: 1, L: 0.8 });
    const { omega } = modesOf(p);
    for (let n = 0; n < N; n++) expect(omega[n]! ** 2).toBeCloseTo(9.81 / 0.8 + 4 * 2 * Math.sin((n * Math.PI) / (2 * N)) ** 2, 8);
  });

  it("batimento: no instante π/(ω₂ − ω₁) a energia está toda no pêndulo 2", () => {
    const p = withOverrides(sim, { sistema: 1, N: 2, L: 1, m: 0.5, kc: 0.4, ci: 0, A: 0.1, b: 0 });
    const r = new Runner(sim, p);
    const [w1, w2] = modesOf(p).omega as [number, number];
    const tHalf = Math.PI / (w2 - w1);
    const E0 = r.value("E");
    while (r.t < tHalf - 1e-9) r.stepOnce();
    // A energia do oscilador 1 é mínima (resta só o termo de acoplamento, pequeno)
    expect(r.value("E1") / E0).toBeLessThan(0.02);
    expect(r.value("E2") / E0).toBeGreaterThan(0.9);
    expect(Math.abs(r.value("E") - E0) / E0).toBeLessThan(1e-8);
  });

  it("integração numérica coincide com a superposição exata de modos", () => {
    const p = withOverrides(sim, { sistema: 0, N: 5, m: 0.3, k: 6, kc: 3, ci: 0, A: 0.1 });
    const r = new Runner(sim, p);
    const s0 = r.state.slice();
    while (r.t < 3 - 1e-9) r.stepOnce();
    const exact = modalSolution(s0.slice(0, 5), s0.slice(5), p, r.t);
    for (let i = 0; i < 5; i++) expect(r.state[i]).toBeCloseTo(exact[i]!, 8);
  });

  it("modo normal puro: a energia fica toda no modo escolhido", () => {
    const p = withOverrides(sim, { sistema: 0, N: 4, ci: 1, nmodo: 3 });
    const r = new Runner(sim, p);
    for (let i = 0; i < 2000; i++) r.stepOnce();
    const E = r.value("E");
    const { omega } = modesOf(p);
    // Período do modo 3 é o único presente: x volta ao valor inicial após 2π/ω₃
    expect(r.value("Em1") / E).toBeLessThan(1e-10);
    expect(omega[2]).toBeGreaterThan(omega[1]!);
  });
});
