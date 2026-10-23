import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import {
  DESENHO,
  F,
  G,
  RAYLEIGH,
  T_SCAN,
  airy,
  besselJ0,
  besselJ1,
  fresnelIntensity,
  fresnelNumber,
  phasorChain,
  difracao as sim,
  dipRatio,
  fft,
  fraunhofer,
  grating,
  gratingFactor,
  presetAperture,
  rayleighAngle,
  singleSlit,
} from "../src/index.ts";

describe("Difração", () => {
  it("FFT radix-2 coincide com a DFT direta e a inversa recupera o sinal", () => {
    const n = 16;
    const x = Array.from({ length: n }, (_, i) => Math.sin(i * 0.7) + (i % 3) * 0.5);
    const re = Float64Array.from(x);
    const im = new Float64Array(n);
    fft(re, im);
    for (let k = 0; k < n; k++) {
      let sr = 0;
      let si = 0;
      for (let j = 0; j < n; j++) {
        sr += x[j]! * Math.cos((-2 * Math.PI * k * j) / n);
        si += x[j]! * Math.sin((-2 * Math.PI * k * j) / n);
      }
      expect(re[k]).toBeCloseTo(sr, 10);
      expect(im[k]).toBeCloseTo(si, 10);
    }
    fft(re, im, true);
    for (let j = 0; j < n; j++) expect(re[j]).toBeCloseTo(x[j]!, 12);
  });

  it("FFT 2D de uma fenda reproduz o padrão de difração (Dirichlet ≈ sinc²)", () => {
    const img = fraunhofer(presetAperture("fenda")); // fenda de 4 células em x
    const row = (F / 2) * F;
    const c = F / 2;
    expect(img[row + c]).toBeCloseTo(1, 12);
    // Primeiro zero em k = F/w = 32
    expect(img[row + c + 32]!).toBeLessThan(1e-20);
    const k = 16;
    const expected = (Math.sin((Math.PI * k * 4) / F) / (4 * Math.sin((Math.PI * k) / F))) ** 2;
    expect(img[row + c + k]).toBeCloseTo(expected, 10);
    expect(Math.abs(expected - singleSlit(0.5, 1, 1000 * 1) /* sinc²(π/2) */)).toBeLessThan(0.03);
  });

  it("fenda simples: zeros em a sen θ = pλ; rede: máximos principais em d sen θ = mλ", () => {
    expect(singleSlit(0, 40, 600)).toBe(1);
    expect(singleSlit(600e-9 / 40e-6, 40, 600)).toBeLessThan(1e-25);
    expect(singleSlit((2 * 600e-9) / 40e-6, 40, 600)).toBeLessThan(1e-25);
    const s1 = 600e-9 / 5e-6;
    expect(gratingFactor(s1, 10, 5, 600)).toBeCloseTo(1, 9);
    expect(grating(s1, 10, 5, 1.5, 600)).toBeCloseTo(singleSlit(s1, 1.5, 600), 9);
    // Primeiro zero ao lado do máximo central: sen θ = λ/(N d)
    expect(gratingFactor(600e-9 / (10 * 5e-6), 10, 5, 600)).toBeLessThan(1e-20);
  });

  it("Airy: 1º zero em 1,22 λ/D e vale de ≈ 73,5 % no limite de Rayleigh", () => {
    expect(besselJ1(1)).toBeCloseTo(0.4400505857, 7);
    expect(besselJ1(10)).toBeCloseTo(0.0434727462, 7);
    const thR = rayleighAngle(2, 550);
    expect(airy(thR, 2, 550)).toBeLessThan(2e-5);
    expect(dipRatio(thR, 2, 550)).toBeCloseTo(0.735, 2);
    expect(dipRatio(0.3 * thR, 2, 550)).toBeCloseTo(1, 6);
  });

  it("detector varre o padrão e observáveis de Rayleigh", () => {
    const r = new Runner(sim, withOverrides(sim, { modo: RAYLEIGH, lambda: 550, D: 2, alpha: 336 }));
    expect(r.value("thR")).toBeCloseTo(335.5, 1);
    expect(r.value("ratio")).toBeCloseTo(336 / 335.5, 3);
    r.runToEnd();
    expect(r.t).toBeCloseTo(T_SCAN, 6);
    expect(r.state.u).toBeCloseTo(1, 9);
  });

  it("pintar e apagar a abertura com o ponteiro", () => {
    const p = withOverrides(sim, { modo: DESENHO, forma: 6, pincel: 1.5 });
    let s = sim.init(p);
    expect(s.grid.reduce((a, b) => a + b, 0)).toBe(0);
    s = sim.pointer!.down!(s, p, { x: 4.9, y: -0.6 })!;
    const n = s.grid.reduce((a, b) => a + b, 0);
    expect(n).toBeGreaterThan(3);
    expect(s.grid).toHaveLength(G * G);
    s = sim.actions!.find((a) => a.id === "borracha")!.run(s, p);
    s = sim.pointer!.down!(s, p, { x: 4.9, y: -0.6 })!;
    expect(s.grid.reduce((a, b) => a + b, 0)).toBe(0);
  });

  it("cadeia de fasores: resultante = sen β/β; fecha no 1º mínimo", () => {
    for (const beta of [0, 0.7, 2, 4.4]) {
      const ch = phasorChain(beta, 400);
      const [ex, ey] = ch[ch.length - 1]!;
      expect(Math.hypot(ex, ey)).toBeCloseTo(beta === 0 ? 1 : Math.abs(Math.sin(beta) / beta), 4);
      expect(ey).toBeCloseTo(0, 12);
    }
    const ch = phasorChain(Math.PI, 24);
    expect(Math.hypot(...ch[24]!)).toBeLessThan(1e-12);
  });

  it("Fresnel: J0 correto; mancha de Arago com I(0) = 1 atrás do disco; furo com I(0) = 4 sen²(πN_F/2)", () => {
    expect(besselJ0(0)).toBeCloseTo(1, 8);
    expect(besselJ0(2.404825557695773)).toBeCloseTo(0, 7);
    expect(besselJ0(10)).toBeCloseTo(-0.2459357645, 7);
    for (const [a, z] of [[1, 1], [0.5, 2], [2, 0.5]] as const) {
      expect(fresnelIntensity(0, a, z, 633, true)).toBeCloseTo(1, 6);
      const NF = fresnelNumber(a, z, 633);
      expect(fresnelIntensity(0, a, z, 633, false)).toBeCloseTo(4 * Math.sin((Math.PI * NF) / 2) ** 2, 4);
    }
    // sombra: entre a mancha e a borda a intensidade é bem menor; longe, fora da sombra, tende a 1
    expect(fresnelIntensity(0.6, 1, 1, 633, true)).toBeLessThan(0.2);
    expect(fresnelIntensity(0.9, 1, 1, 633, true)).toBeLessThan(fresnelIntensity(0, 1, 1, 633, true));
    // a mancha tem diâmetro ≈ 0,77 λz/a: no 1º zero de J0, r = 2,405 z/(k a)
    const r0 = (2.405 * 1 * 633e-9) / (2 * Math.PI * 1e-3) * 1e3;
    expect(fresnelIntensity(r0, 1, 1, 633, true)).toBeLessThan(0.05);
    const p = withOverrides(sim, sim.scenarios.find((c) => c.id === "arago")!.params);
    const r = new Runner(sim, p);
    while (r.t < T_SCAN / 2 - 1e-9) r.stepOnce();
    expect(r.value("I")).toBeCloseTo(1, 2);
  });
});
