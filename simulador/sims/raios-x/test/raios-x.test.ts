import { describe, expect, it } from "vitest";
import { Runner, defaultParams, withOverrides } from "@fisilab/core";
import {
  ANODES,
  ALUMINUM,
  FILTERS,
  HC,
  RC,
  WATER,
  braggAngle,
  braggRate,
  continuum,
  continuumTotal,
  energySpectrum,
  filterTransmission,
  hvl,
  lambdaMin,
  lineArea,
  meanEnergy,
  moseleyFit,
  mu,
  muRho,
  raiosX as sim,
  transmitted,
  zFromKalpha,
} from "../src/index.ts";

const [Cu, Mo, W] = ANODES as [(typeof ANODES)[0], (typeof ANODES)[0], (typeof ANODES)[0]];

describe("Raios X: tubo, espectro, Bragg e Moseley", () => {
  it("limite de Duane–Hunt: nada abaixo de hc/eV e máximo de Kramers em 1,5 λmin", () => {
    expect(lambdaMin(30)).toBeCloseTo(HC / 30, 9);
    const l0 = lambdaMin(30);
    expect(continuum(0.99 * l0, 30, 1, 29)).toBe(0);
    let best = 0;
    let arg = 0;
    for (let l = l0; l < 5 * l0; l += 0.01) {
      const v = continuum(l, 30, 1, 29);
      if (v > best) [best, arg] = [v, l];
    }
    expect(arg / l0).toBeCloseTo(1.5, 2);
  });

  it("intensidade total do contínuo ∝ i Z V² (lei de Kramers)", () => {
    const integ = (V: number) => {
      let s = 0;
      const l0 = lambdaMin(V);
      for (let l = l0; l < 400 * l0; l += l0 / 2000) s += continuum(l + l0 / 4000, V, 2, 42) * (l0 / 2000);
      return s;
    };
    expect(integ(20) / continuumTotal(20, 2, 42)).toBeCloseTo(1, 2);
    expect(continuumTotal(40, 1, 29) / continuumTotal(20, 1, 29)).toBeCloseTo(4, 9);
  });

  it("linhas K só aparecem acima da borda de absorção K", () => {
    const ka = Mo.lines[0]!;
    expect(lineArea(ka, 15, 1, Mo.Z)).toBe(0);
    expect(lineArea(ka, 25, 1, Mo.Z)).toBeGreaterThan(0);
    // tungstênio: L sim, K não, a 50 kV
    expect(lineArea(W.lines[0]!, 50, 1, W.Z)).toBe(0);
    expect(lineArea(W.lines[2]!, 50, 1, W.Z)).toBeGreaterThan(0);
  });

  it("filtro de níquel atenua muito mais a Kβ do cobre que a Kα", () => {
    const ni = FILTERS[1]!;
    const tA = filterTransmission(ni, Cu.lines[0]!.E);
    const tB = filterTransmission(ni, Cu.lines[1]!.E);
    expect(tA).toBeGreaterThan(0.3);
    expect(tA / tB).toBeGreaterThan(20);
  });

  it("difratômetro: pico da Kα do Cu no NaCl em sen θ = λ/2d", () => {
    const d = 282;
    const thK = braggAngle(HC / 8.048, d);
    expect(thK).toBeCloseTo(15.86, 1);
    let best = 0;
    let arg = 0;
    for (let a = 12; a < 20; a += 0.005) {
      const r = braggRate(a, 30, 1, Cu, d, 0.1);
      if (r > best) [best, arg] = [r, a];
    }
    expect(Math.abs(arg - thK)).toBeLessThan(0.02);
    // abaixo de θmin (λ < λmin) não há contagem em primeira ordem nem nas outras
    const thMin = braggAngle(lambdaMin(30), d);
    expect(braggRate(thMin - 0.8, 30, 1, Cu, d, 0.1)).toBeLessThan(1e-6 * best);
  });

  it("lei de Moseley: inclinação √(3Rc/4) e blindagem σ ≈ 1", () => {
    const { k, sigma } = moseleyFit();
    expect(k / (Math.sqrt(0.75 * RC) / 1e8)).toBeCloseTo(1, 1);
    expect(sigma).toBeGreaterThan(0.5);
    expect(sigma).toBeLessThan(2);
    expect(zFromKalpha(8.048)).toBeCloseTo(29, 0);
  });

  it("atenuação: feixe monoenergético segue Beer–Lambert e CSR = ln2/μ", () => {
    const mono = { E: [40], N: [1] };
    const m = mu(WATER, 40);
    expect(transmitted(mono, [[WATER, 3]])).toBeCloseTo(Math.exp(-3 * m), 10);
    expect(hvl(mono, WATER)).toBeCloseTo(Math.LN2 / m, 6);
    expect(muRho(WATER, 30)).toBeCloseTo(0.3756, 4);
  });

  it("endurecimento do feixe: filtração aumenta energia média e CSR", () => {
    const a = energySpectrum(80, 1, W, 1);
    const b = energySpectrum(80, 1, W, 6);
    expect(meanEnergy(b)).toBeGreaterThan(meanEnergy(a));
    expect(hvl(b, ALUMINUM)).toBeGreaterThan(hvl(a, ALUMINUM));
  });

  it("fótons sorteados no tubo seguem o espectro teórico", () => {
    const p = withOverrides(sim, { modo: 0, anodo: 1, V: 30, I: 10 });
    const r = new Runner(sim, p);
    for (let i = 0; i < 600; i++) r.stepOnce();
    const s = r.state;
    expect(s.nDet).toBeGreaterThan(3000);
    // nenhum fóton abaixo de λmin
    const lm = 100;
    const bMin = Math.floor((lambdaMin(30) / lm) * s.hist.length);
    for (let i = 0; i < bMin; i++) expect(s.hist[i]).toBe(0);
  });

  it("roda com parâmetros padrão", () => {
    const r = new Runner(sim, defaultParams(sim));
    r.stepOnce();
    for (const v of r.observe()) expect(Number.isFinite(v)).toBe(true);
  });
});
