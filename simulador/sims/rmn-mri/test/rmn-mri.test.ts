import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import {
  NIMG,
  TECIDOS,
  blochStep,
  evolve,
  fft2,
  flip,
  larmor,
  lorentzOffsets,
  mean,
  phantomMap,
  polarization,
  projection,
  reconstruct,
  rmnMri as sim,
  seSignal,
  t2star,
  weightedImage,
  type Vec,
} from "../src/index.ts";

describe("RMN e imagem", () => {
  it("Larmor e polarização: 63,9 MHz a 1,5 T; excesso ≈ hf/2kT (ppm)", () => {
    expect(larmor(42.577, 1.5) / 1e6).toBeCloseTo(63.87, 2);
    const P = polarization(63.87e6, 310);
    expect(P / ((6.62607015e-34 * 63.87e6) / (2 * 1.380649e-23 * 310))).toBeCloseTo(1, 6);
    expect(P * 1e6).toBeGreaterThan(4);
    expect(P * 1e6).toBeLessThan(6);
  });

  it("pulso: α = γB₁τ = 90° deita M em y', 180° inverte; fora de ressonância não chega ao plano", () => {
    const p = withOverrides(sim, { modo: 1 });
    expect((flip(p) * 180) / Math.PI).toBeCloseTo(90, 0);
    const w1 = flip(p) / 1e-3;
    let M: Vec = [0, 0, 1];
    for (let i = 0; i < 1000; i++) M = blochStep(M, w1, 0, 1e-6, 1e9, 1e9);
    expect(Math.abs(M[2])).toBeLessThan(2e-3);
    expect(Math.hypot(M[0], M[1])).toBeCloseTo(1, 4);
    for (let i = 0; i < 1000; i++) M = blochStep(M, w1, 0, 1e-6, 1e9, 1e9);
    expect(M[2]).toBeCloseTo(-1, 4);
    // Δω = ω₁: eixo efetivo a 45°, M_z mínimo = cos 90° = 0 após meia volta em torno de B_ef
    let N: Vec = [0, 0, 1];
    const W = Math.SQRT2 * w1;
    for (let i = 0; i < 2000; i++) N = blochStep(N, w1, w1, Math.PI / W / 2000, 1e9, 1e9);
    expect(N[2]).toBeCloseTo(0, 4);
  });

  it("relaxação após 90°: M_z = 1 − e^{−t/T₁}, |M_xy| = e^{−t/T₂}; inversão cruza zero em T₁ ln 2", () => {
    const T1 = 0.8, T2 = 0.08;
    let M: Vec = [0, 1, 0];
    M = evolve([M], [0], [], 0, 0.1, T1, T2)[0]!;
    expect(M[2]).toBeCloseTo(1 - Math.exp(-0.1 / T1), 10);
    expect(Math.hypot(M[0], M[1])).toBeCloseTo(Math.exp(-0.1 / T2), 10);
    let I: Vec = [0, 0, -1];
    I = evolve([I], [0], [], 0, T1 * Math.log(2), T1, T2)[0]!;
    expect(I[2]).toBeCloseTo(0, 10);
    // no runner: pulso de 90° e leitura em t = 200 ms
    const r = new Runner(sim, withOverrides(sim, { modo: 2, lento: 1 }));
    while (r.state.tp < 0.2) r.stepOnce();
    const t = r.state.tp - 1e-3;
    expect(r.value("Mz")).toBeCloseTo(1 - Math.exp(-t / T1), 2);
    expect(r.value("Mxy")).toBeCloseTo(Math.exp(-t / T2), 2);
  });

  it("FID com inomogeneidade decai com T₂* e o eco de spin recupera e^{−TE/T₂}", () => {
    const fwhm = 30, T2 = 0.08;
    const offs = lorentzOffsets(400, 0, fwhm);
    let Ms: Vec[] = offs.map((): Vec => [0, 1, 0]);
    Ms = evolve(Ms, offs, [], 0, 0.01, 10, T2);
    // a distribuição é truncada em ±8 larguras: concorda com e^{−t/T₂*} dentro de 10 %
    const ratio = Math.hypot(...(mean(Ms).slice(0, 2) as [number, number])) / Math.exp(-0.01 / t2star(T2, fwhm));
    expect(ratio).toBeGreaterThan(0.9);
    expect(ratio).toBeLessThan(1.1);
    // sequência completa no runner
    const p = { modo: 3, TE: 60, disp: 30, T2: 80, T1: 800, lento: 0.02 };
    const r = new Runner(sim, withOverrides(sim, p));
    let best = 0, tBest = 0;
    let minBefore = 1;
    while (r.state.tp < 0.09) {
      r.stepOnce();
      const s = r.value("Mxy");
      if (r.state.tp > 0.02 && r.state.tp < 0.03) minBefore = Math.min(minBefore, s);
      if (r.state.tp > 0.045 && s > best) {
        best = s;
        tBest = r.state.tp;
      }
    }
    expect(minBefore).toBeLessThan(0.25);
    expect(tBest).toBeGreaterThan(0.055);
    expect(tBest).toBeLessThan(0.066);
    expect(best / Math.exp(-0.06 / 0.08)).toBeCloseTo(1, 1);
  });

  it("imagem: TF⁻¹ do espaço k completo devolve o objeto; projeção conserva o total; contraste T1 × T2", () => {
    const map = phantomMap(NIMG);
    const img = weightedImage(map, 0.5, 0.015);
    const k = fft2(img, NIMG);
    const rec = reconstruct(k, NIMG, NIMG);
    let err = 0;
    for (let q = 0; q < img.length; q++) err = Math.max(err, Math.abs(rec[q]! - img[q]!));
    expect(err).toBeLessThan(1e-10);
    // centro do espaço k = soma da imagem
    expect(k.re[(NIMG / 2) * NIMG + NIMG / 2]!).toBeCloseTo(img.reduce((a, b) => a + b, 0), 8);
    expect(projection(img, NIMG).reduce((a, b) => a + b, 0)).toBeCloseTo(img.reduce((a, b) => a + b, 0), 8);
    // reconstrução parcial (só o centro) já tem a média certa
    const part = reconstruct(k, NIMG, 8);
    expect(part.length).toBe(NIMG * NIMG);
    const [lcr, gm, wm, fat] = TECIDOS;
    // T1: gordura > branca > cinzenta > líquor
    const s1 = (t: typeof lcr) => seSignal(t!, 0.5, 0.015);
    expect(s1(fat) > s1(wm) && s1(wm) > s1(gm) && s1(gm) > s1(lcr)).toBe(true);
    // T2: líquor é o mais brilhante
    const s2 = (t: typeof lcr) => seSignal(t!, 4, 0.1);
    expect(s2(lcr)).toBeGreaterThan(Math.max(s2(gm), s2(wm), s2(fat)));
  });
});
