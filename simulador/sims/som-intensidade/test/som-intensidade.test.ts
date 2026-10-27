import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import { C_SOM, GAIN_MAX, I0, RHO, duasCaixas, intensity, level, levelDuas, pressureAmp, somIntensidade as sim, somIntensidade, threshold, toneFor } from "../src/index.ts";

const P = (over: Record<string, number>) => withOverrides(sim, over);

describe("som: intensidade e decibéis", () => {
  it("I = P/(4πr²) e β = 10 log(I/I₀)", () => {
    const p = P({ P: 4 * Math.PI * 1e-2, r: 1 });
    expect(intensity(p)).toBeCloseTo(1e-2, 12);
    expect(level(p)).toBeCloseTo(100, 9);
  });

  it("inverso do quadrado: dobrar a distância tira 10 log 4 ≈ 6,02 dB; 10× a potência soma 10 dB", () => {
    expect(level(P({ r: 2 })) - level(P({ r: 4 }))).toBeCloseTo(10 * Math.log10(4), 9);
    expect(level(P({ P: 0.1 })) - level(P({ P: 0.01 }))).toBeCloseTo(10, 9);
  });

  it("pressão: 94 dB correspondem a ~1 Pa eficaz (p₀ = √2 p_ef)", () => {
    // I para p_ef = 1 Pa: 1/(ρc)
    const I = 1 / (RHO * C_SOM);
    const p = P({ P: I * 4 * Math.PI, r: 1 });
    expect(pressureAmp(p) / Math.SQRT2).toBeCloseTo(1, 9);
    expect(level(p)).toBeCloseTo(93.9, 1);
  });

  it("curva de limiar: ~3,4 dB em 1 kHz, mínimo entre 2 e 5 kHz, alta nos graves", () => {
    expect(threshold(1000)).toBeCloseTo(3.37, 1);
    let fMin = 0;
    let tMin = Infinity;
    for (let f = 20; f <= 20000; f *= 1.01) if (threshold(f) < tMin) [tMin, fMin] = [threshold(f), f];
    expect(fMin).toBeGreaterThan(2000);
    expect(fMin).toBeLessThan(5000);
    expect(threshold(40)).toBeGreaterThan(40);
  });

  it("toneFor: desligado dá ganho 0; ligado acompanha a frequência, cresce com β e é limitado", () => {
    expect(toneFor(P({ som: 0, f: 440 }))).toEqual({ freq: 440, gain: 0 });
    const fraco = toneFor(P({ som: 1, f: 440, r: 20 }));
    const forte = toneFor(P({ som: 1, f: 440, r: 1 }));
    expect(fraco.freq).toBe(440);
    expect(forte.gain).toBeGreaterThan(fraco.gain);
    expect(toneFor(P({ som: 1, P: 10, r: 0.5 })).gain).toBeLessThanOrEqual(GAIN_MAX);
  });

  it("observáveis batem com as funções e são finitos", () => {
    const r = new Runner(sim, P({ P: 0.5, r: 3, f: 2000 }));
    for (let i = 0; i < 50; i++) r.stepOnce();
    expect(r.value("beta")).toBeCloseTo(level(r.params), 12);
    expect(r.value("lambda")).toBeCloseTo(C_SOM / 2000, 12);
  });
});

describe("Som: interferência de duas caixas", () => {
  const P = (o: Record<string, number>) => withOverrides(somIntensidade, { modo: 1, P: 0.01, f: 343, d: 1.5, D: 4, yL: 0, ...o });
  it("no eixo, ΔL = 0: intensidade 4 vezes a de uma caixa (+6 dB)", () => {
    const q = duasCaixas(P({}));
    expect(q.dL).toBeCloseTo(0, 12);
    expect(q.I / q.I1).toBeCloseTo(4, 12);
    expect(levelDuas(P({})) - 10 * Math.log10(q.I1 / I0)).toBeCloseTo(10 * Math.log10(4), 10);
  });
  it("mínimo onde ΔL = λ/2: intensidade quase nula; ΔL = λ dá novo máximo", () => {
    // procura o primeiro y > 0 com ΔL = λ/2 por bissecção
    const find = (target: number) => {
      let a = 0, b = 5;
      for (let i = 0; i < 60; i++) {
        const m = (a + b) / 2;
        if (duasCaixas(P({ yL: m })).dL < target) a = m;
        else b = m;
      }
      return a;
    };
    const y1 = find(0.5);
    const q1 = duasCaixas(P({ yL: y1 }));
    expect(Math.cos(q1.phi)).toBeCloseTo(-1, 9);
    expect(q1.I / (q1.I1 + q1.I2)).toBeLessThan(0.01);
    const q2 = duasCaixas(P({ yL: find(1) }));
    expect(q2.I / (q2.I1 + q2.I2)).toBeGreaterThan(1.95); // amplitudes um pouco diferentes (L₁ ≠ L₂)
  });
  it("o som do alto-falante acompanha o nível total com as duas caixas", () => {
    const on = toneFor(P({ som: 1 }));
    const off = toneFor(P({ som: 1, yL: 0.88 }));
    expect(on.gain).toBeGreaterThan(off.gain);
  });
});
