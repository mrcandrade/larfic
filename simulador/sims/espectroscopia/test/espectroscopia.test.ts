import { describe, expect, it } from "vitest";
import { Runner, rng, withOverrides } from "@fisilab/core";
import { analyze, measureRow, type Instrument, type Practice } from "../../../packages/analysis/src/index.ts";
import {
  balmerNm,
  cauchy,
  espectroscopia as sim,
  features,
  GLASSES,
  gratingDeg,
  indexFromMinDev,
  lineFwhmDeg,
  LAMPS,
  minDeviation,
  minDevIncidence,
  nearest,
  prismDeviation,
  reticleIntensity,
  type SpecState,
} from "../src/index.ts";

const D = Math.PI / 180;
const nonio: Instrument = { id: "nonio-gonio", name: "Goniômetro com nônio (1′)", unit: "°", kind: "nonio", resolution: 1 / 60, range: [-180, 360] };
const tabela: Instrument = { id: "tabela", name: "Tabela de linhas", unit: "nm", kind: "digital", resolution: 0.01, range: [0, 1000] };
const contagem: Instrument = { id: "contagem", name: "Identificação", unit: "", kind: "digital", resolution: 1, range: [-10, 10] };

function measure(practice: Practice, over: Record<string, number>, rand: () => number) {
  const r = new Runner(sim, withOverrides(sim, { ...practice.params, ...over }));
  return measureRow(practice, { params: r.params, t: r.t, value: (k) => r.value(k) }, rand);
}

describe("Espectroscópio de rede e prisma", () => {
  it("rede: d sen θ = mλ, ordens que não existem somem", () => {
    expect(gratingDeg(546.07, 1, 600)).toBeCloseTo(Math.asin(546.07e-9 / (1e-3 / 600)) / D, 12);
    expect(gratingDeg(546.07, -2, 600)).toBeCloseTo(-Math.asin(2 * 546.07e-9 * 6e5) / D, 12);
    expect(Number.isNaN(gratingDeg(700, 2, 1000))).toBe(true);
    const p = withOverrides(sim, { lampada: 3, N: 1200 });
    const f = features(sim.init(p), p);
    expect(f.some((x) => x.m === 2)).toBe(false);
    expect(f.filter((x) => x.m === 1)).toHaveLength(5);
  });

  it("luneta alinhada com uma linha: brilho máximo e λ calculado = λ tabelado", () => {
    const p = withOverrides(sim, { lampada: 2, N: 600, fenda: 50 });
    const phi = gratingDeg(546.07, 1, 600);
    const s: SpecState = { phi, inc: 50, drag: null };
    expect(nearest(s, p).nm).toBe(546.07);
    const r = new Runner(sim, p);
    r.setState(s);
    expect(r.value("lamMed")).toBeCloseTo(546.07, 9);
    expect(r.value("ordem")).toBe(1);
    // a 3 larguras da linha, o brilho cai muito
    const w = lineFwhmDeg(50);
    expect(reticleIntensity({ ...s, phi: phi + 3 * w }, p)).toBeLessThan(0.01 * reticleIntensity(s, p));
    expect(r.value("Iret")).toBeGreaterThan(0.8);
  });

  it("hidrogênio: linhas tabeladas obedecem a Rydberg (ar vs vácuo < 0,05%)", () => {
    for (const l of LAMPS[0]!.lines) expect(Math.abs(l.nm / balmerNm(l.n!) - 1)).toBeLessThan(5e-4);
  });

  it("prisma: desvio mínimo e índice recuperado pela fórmula", () => {
    const g = GLASSES[0]!;
    const n = cauchy(589, g.A, g.B);
    expect(n).toBeCloseTo(1.5168, 3);
    const iMin = minDevIncidence(n);
    const dMin = prismDeviation(n, iMin);
    expect(dMin).toBeCloseTo(minDeviation(n), 10);
    expect(prismDeviation(n, iMin + 3)).toBeGreaterThan(dMin);
    expect(prismDeviation(n, iMin - 3)).toBeGreaterThan(dMin);
    expect(indexFromMinDev(dMin)).toBeCloseTo(n, 12);
    // violeta mais desviado que vermelho
    expect(prismDeviation(cauchy(404.66, g.A, g.B), 50)).toBeGreaterThan(prismDeviation(cauchy(579.07, g.A, g.B), 50));
  });

  it("dubleto do sódio: separação angular cresce com a ordem", () => {
    const sep = (m: number) => gratingDeg(589.592, m, 600) - gratingDeg(588.995, m, 600);
    expect(sep(1) * 60).toBeCloseTo(1.3, 1);
    expect(sep(2) * 60).toBeGreaterThan(3 * lineFwhmDeg(20) * 60);
  });

  it("arrastar a luneta e o parafuso fino mudam φ", () => {
    const p = withOverrides(sim, {});
    let s = sim.init(p);
    s = sim.pointer!.down!(s, p, { x: 5.8 + 3 * Math.cos(30 * D), y: 0.6 + 3 * Math.sin(30 * D) })!;
    expect(s.phi).toBeCloseTo(30, 6);
    s = sim.actions!.find((a) => a.id === "p1")!.run(s, p);
    expect(s.phi).toBeCloseTo(30 + 1 / 60, 9);
    const pp = withOverrides(sim, { modo: 1 });
    const sp = sim.pointer!.down!(sim.init(pp), pp, { x: 5.8 - Math.cos(40 * D), y: 0.6 - Math.sin(40 * D) })!;
    expect(sp.inc).toBeCloseTo(40, 6);
  });

  it("prática da rede (Hg): sen φ contra mλ dá N = 600 linhas/mm", () => {
    const practice: Practice = {
      id: "t",
      course: "Exp III",
      title: "Espectroscopia",
      sim: "espectroscopia",
      params: { modo: 0, lampada: 2, N: 600, fenda: 50, mapa: 0 },
      objective: "",
      materials: [],
      procedure: "",
      columns: [
        { key: "lam", label: "λ", unit: "nm", source: { observable: "lam" }, instrument: tabela },
        { key: "m", label: "m", unit: "", source: { observable: "ordem" }, instrument: contagem },
        { key: "phi", label: "φ", unit: "°", source: { observable: "phi" }, instrument: nonio },
        { key: "x", label: "mλ", unit: "nm", from: ["m", "lam"], compute: (m, l) => m * l },
        { key: "y", label: "sen φ", unit: "", from: ["phi"], compute: (f) => Math.sin(f * D) },
      ],
      analysis: { x: "x", y: "y", fit: "proporcional", results: [{ label: "N", unit: "linhas/mm", compute: (b) => b * 1e6, reference: 600 }] },
      questions: [],
    };
    const lines = [404.66, 435.83, 546.07, 579.07];
    const plan = [...lines.map((l) => [l, 1] as const), ...lines.map((l) => [l, -1] as const), [546.07, 2] as const, [435.83, -2] as const];
    const rand = rng(7);
    const rows = plan.map(([l, m]) => measure(practice, { phi: gratingDeg(l, m, 600) }, rand));
    for (const [i, [l, m]] of plan.entries()) {
      expect(rows[i]!.lam!.value).toBeCloseTo(l, 6);
      expect(rows[i]!.m!.value).toBe(m);
    }
    const res = analyze(practice, rows)!;
    expect(Math.abs(res.results[0]!.value / 600 - 1)).toBeLessThan(0.003);
  });

  it("prática de Balmer: 1/λ contra 1/4 − 1/n² dá R_H", () => {
    const N = 600;
    const practice: Practice = {
      id: "t2",
      course: "Exp III",
      title: "Espectroscopia",
      sim: "espectroscopia",
      params: { modo: 0, lampada: 0, N, fenda: 50, mapa: 0 },
      objective: "",
      materials: [],
      procedure: "",
      columns: [
        { key: "phi", label: "φ", unit: "°", source: { observable: "phi" }, instrument: nonio },
        { key: "m", label: "m", unit: "", source: { observable: "ordem" }, instrument: contagem },
        { key: "n", label: "n", unit: "", source: { observable: "nsup" }, instrument: contagem },
        { key: "inv", label: "1/λ", unit: "µm⁻¹", from: ["phi", "m"], compute: (f, m) => (m * 1000) / ((1e6 / N) * Math.sin(f * D)) },
        { key: "x", label: "1/4 − 1/n²", unit: "", from: ["n"], compute: (n) => 0.25 - 1 / (n * n) },
      ],
      analysis: { x: "x", y: "inv", fit: "proporcional", results: [{ label: "R_H", unit: "m⁻¹", compute: (b) => b * 1e6, reference: 1.0968e7 }] },
      questions: [],
    };
    const rand = rng(2);
    const plan = [656.28, 486.13, 434.05, 410.17].flatMap((l) => [[l, 1] as const, [l, -1] as const]);
    const rows = plan.map(([l, m]) => measure(practice, { phi: gratingDeg(l, m, N) }, rand));
    const res = analyze(practice, rows)!;
    expect(Math.abs(res.results[0]!.value / 1.0968e7 - 1)).toBeLessThan(0.003);
  });

  it("prática do prisma: n(δmin) contra 1/λ² dá os coeficientes de Cauchy", () => {
    const g = GLASSES[0]!;
    const practice: Practice = {
      id: "t3",
      course: "Exp III",
      title: "Espectroscopia",
      sim: "espectroscopia",
      params: { modo: 1, lampada: 2, vidro: 0, fenda: 50, mapa: 0 },
      objective: "",
      materials: [],
      procedure: "",
      columns: [
        { key: "lam", label: "λ", unit: "nm", source: { observable: "lam" }, instrument: tabela },
        { key: "dmin", label: "δmin", unit: "°", source: { observable: "phi" }, instrument: nonio },
        { key: "x", label: "1/λ²", unit: "µm⁻²", from: ["lam"], compute: (l) => 1e6 / (l * l) },
        { key: "n", label: "n", unit: "", from: ["dmin"], compute: (dm) => Math.sin(((60 + dm) * D) / 2) / Math.sin(30 * D) },
      ],
      analysis: {
        x: "x",
        y: "n",
        fit: "linear",
        results: [
          { label: "A", unit: "", compute: (a) => a, reference: g.A },
          { label: "B", unit: "nm²", compute: (_a, b) => b * 1e6, reference: g.B },
        ],
      },
      questions: [],
    };
    const rand = rng(4);
    const rows = [404.66, 435.83, 491.6, 546.07, 579.07].map((l) => {
      const n = cauchy(l, g.A, g.B);
      return measure(practice, { inc: minDevIncidence(n), phi: minDeviation(n) }, rand);
    });
    const res = analyze(practice, rows)!;
    expect(Math.abs(res.results[0]!.value - g.A)).toBeLessThan(0.002);
    expect(Math.abs(res.results[1]!.value / g.B - 1)).toBeLessThan(0.08);
  });
});
