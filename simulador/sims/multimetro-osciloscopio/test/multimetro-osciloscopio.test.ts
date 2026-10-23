import { describe, expect, it } from "vitest";
import { Runner, darkTheme, lightTheme, rng, withOverrides } from "@fisilab/core";
import { analyze, measureRow, type Practice } from "../../../packages/analysis/src/index.ts";
import {
  multimetroOsciloscopio as sim,
  TRG,
  TS0,
  TS1,
  at,
  extremes,
  lowpass,
  sampleShape,
  signals,
  triggerPhase,
} from "../src/index.ts";

const ctx = () => new Proxy({ measureText: (s: string) => ({ width: s.length * 6 }) } as Record<string, unknown>, { get: (t, k: string) => (k in t ? t[k] : () => undefined), set: () => true }) as unknown as CanvasRenderingContext2D;
const P = (o: Record<string, number>) => withOverrides(sim, o);
const run = (p: Record<string, number>, t: number) => {
  const r = new Runner(sim, p);
  while (r.t < t - 1e-9) r.stepOnce();
  return r;
};

const osc = { id: "osc", name: "Osciloscópio (leitura na tela)", unit: "V", kind: "digital" as const, resolution: 0.01, range: [-100, 100] as [number, number], accuracy: (r: number) => 0.03 * Math.abs(r) };
const dmmAC = { id: "dmm-ac", name: "Multímetro (V~, 4 V)", unit: "V", kind: "digital" as const, resolution: 0.001, range: [0, 4] as [number, number], accuracy: (r: number) => 0.01 * Math.abs(r) + 0.003 };

/** Prática proposta: fator de crista medido com osciloscópio (Vpp) e multímetro (V~). */
const practice = (onda: number, dmm: number): Practice => ({
  id: "t",
  course: "Exp III",
  title: "Uso de multímetro e osciloscópio",
  sim: "multimetro-osciloscopio",
  params: { onda, dmm, f: 500, off: 0, dmmFunc: 0 },
  objective: "",
  materials: [],
  procedure: "",
  columns: [
    { key: "vpp", label: "V_pp", unit: "V", source: { observable: "Vpp" }, instrument: osc },
    { key: "vrms", label: "V~", unit: "V", source: { observable: "Vdmm" }, instrument: dmmAC },
  ],
  analysis: { x: "vpp", y: "vrms", fit: "proporcional", results: [{ label: "Vp/Vrms", unit: "", compute: (b) => 1 / (2 * b) }] },
  questions: [],
});

function measure(pr: Practice, values: Record<string, number>[], t = 0.1) {
  const rand = rng(11);
  return values.map((v) => {
    const r = run(P({ ...pr.params, ...v } as Record<string, number>), t);
    return measureRow(pr, { params: r.params, t: r.t, value: (k) => r.value(k) }, rand);
  });
}

describe("Multímetro e osciloscópio", () => {
  it("RMS verdadeiro e leitura do multímetro de média para as três formas", () => {
    const A = 3;
    const rms = [A / Math.SQRT2, A, A / Math.sqrt(3)];
    for (const onda of [0, 1, 2]) {
      const p = P({ onda, A, f: 200 });
      const r = new Runner(sim, p);
      expect(r.value("Vrms")).toBeCloseTo(rms[onda]!, 12);
      expect(r.value("Vpp")).toBe(2 * A);
      const avg = new Runner(sim, P({ onda, A, f: 200, dmm: 1 }));
      const k = 1 / Math.sqrt(1 + (200 / 10e3) ** 4);
      const meanAbs = [(2 * A) / Math.PI, A, A / 2][onda]!;
      expect(avg.value("Vdmm")).toBeCloseTo((Math.PI / (2 * Math.SQRT2)) * meanAbs * k, 10);
    }
    // Erros clássicos: +11,1 % na quadrada, −3,8 % na triangular, 0 na senoide
    expect(new Runner(sim, P({ onda: 1, dmm: 1, f: 100 })).value("erro")).toBeCloseTo(11.07, 1);
    expect(new Runner(sim, P({ onda: 2, dmm: 1, f: 100 })).value("erro")).toBeCloseTo(-3.81, 1);
    expect(Math.abs(new Runner(sim, P({ onda: 0, dmm: 1, f: 100 })).value("erro"))).toBeLessThan(0.01);
  });

  it("RC em regime: ganho e fase batem com 1/√(1+(ωτ)²) e arctan(ωτ); quadrada dá 2A·tanh(T/4τ)", () => {
    const p = P({ onda: 0, f: 1592, R: 1000, C: 100, A: 2 });
    const wt = 2 * Math.PI * 1592 * 1e-4;
    expect(new Runner(sim, p).value("Vpp2")).toBeCloseTo(4 / Math.hypot(1, wt), 4);
    expect(new Runner(sim, p).value("fase")).toBeCloseTo((Math.atan(wt) * 180) / Math.PI, 9);
    // Atraso no traço: o máximo do capacitor ocorre Δt = φ/(ωT) depois do máximo do gerador
    const rc = signals(p).rc;
    let best = 0;
    let tBest = 0;
    for (let k = 0; k < 20000; k++) {
      const t = k / 20000 / 1592;
      if (at(rc, t) > best) [best, tBest] = [at(rc, t), t];
    }
    expect(tBest - 0.25 / 1592).toBeCloseTo(Math.atan(wt) / (2 * Math.PI * 1592), 6);
    const sq = P({ onda: 1, f: 1000, R: 1000, C: 100, A: 1 });
    expect(new Runner(sim, sq).value("Vpp2")).toBeCloseTo(2 * Math.tanh(1e-3 / (4 * 1e-4)), 6);
    const e = extremes(lowpass(sampleShape(1, 1e-3), 1e-4));
    expect(e.max).toBeCloseTo(-e.min, 9);
  });

  it("com disparo a imagem para; sem disparo, cada varredura começa numa fase diferente", () => {
    const fase = (r: Runner<number[]>, k: number) => (r.state[k]! * 1000) % 1;
    const trig = run(P({ trig: 0, nivel: 1, borda: 0, f: 1000, A: 2 }), 0.5);
    expect(trig.state[TRG]).toBe(1);
    expect(Math.abs(fase(trig, TS0) - fase(trig, TS1))).toBeLessThan(1e-6);
    // O traço começa exatamente no nível, subindo: 2 sin(2πu) = 1 → u = 1/12
    expect(fase(trig, TS0)).toBeCloseTo(1 / 12, 3);
    expect(triggerPhase(sampleShape(0, 1), 0.5, false)).toBeCloseTo(5 / 12, 3);
    const free = run(P({ trig: 2, f: 1000 }), 0.5);
    expect(free.state[TRG]).toBe(0);
    expect(Math.abs(fase(free, TS0) - fase(free, TS1))).toBeGreaterThan(1e-3);
    // Nível acima do pico: Auto corre livre, Normal espera
    expect(run(P({ trig: 0, nivel: 3, A: 2 }), 0.1).state[TRG]).toBe(0);
    expect(run(P({ trig: 1, nivel: 3, A: 2 }), 0.1).state[TRG]).toBe(-1);
  });

  it("acoplamento AC remove o offset e inclina a quadrada lenta", () => {
    const dc = signals(P({ onda: 1, f: 20, A: 1, off: 2, acop1: 0 })).ch1;
    const ac = signals(P({ onda: 1, f: 20, A: 1, off: 2, acop1: 1 })).ch1;
    expect(at(dc, 0.001)).toBeCloseTo(3, 9);
    expect(Math.abs(at(ac, 0.001) + at(ac, 0.026))).toBeLessThan(1e-6); // simétrico em torno de 0
    // Inclinação ("tilt") durante meio período: e^{−T/2τ}
    const tilt = at(ac, 0.0249) / at(ac, 0.0000001);
    expect(tilt).toBeCloseTo(Math.exp(-0.025 / (1e6 * 47e-9)) * 1.0, 1);
  });

  it("prática: fator de crista Vp/Vrms = √2 (senoide, true RMS) e 0,900 aparente na quadrada com multímetro de média", () => {
    const amps = [0.4, 0.6, 0.8, 1.0, 1.2, 1.4];
    const sine = analyze(practice(0, 0), measure(practice(0, 0), amps.map((A) => ({ A }))))!;
    expect(sine.results[0]!.value).toBeCloseTo(Math.SQRT2, 1);
    expect(sine.results[0]!.compatible).not.toBe(false);
    const sq = analyze(practice(1, 1), measure(practice(1, 1), amps.map((A) => ({ A }))))!;
    expect(Math.abs(sq.results[0]!.value / ((2 * Math.SQRT2) / Math.PI) - 1)).toBeLessThan(0.02);
  });

  it("prática: tan φ contra f é uma reta pela origem com inclinação 2πRC", () => {
    const pr: Practice = {
      ...practice(0, 0),
      params: { onda: 0, ch2: 1, R: 1000, C: 100 },
      columns: [
        { key: "f", label: "f", unit: "Hz", source: { observable: "fmed" }, instrument: { id: "fq", name: "Frequencímetro", unit: "Hz", kind: "digital", resolution: 1, range: [0, 1e5], accuracy: (r) => 1e-4 * r + 1 } },
        { key: "dt", label: "Δt", unit: "µs", source: { observable: "dtfase" }, instrument: { id: "cur", name: "Cursores", unit: "µs", kind: "digital", resolution: 0.1, range: [0, 1e6], accuracy: (r) => 0.02 * r + 0.5 }, toUnit: 1e6 },
        { key: "tg", label: "tan φ", unit: "", from: ["f", "dt"], compute: (f, dt) => Math.tan(2 * Math.PI * f * dt * 1e-6) },
      ],
      analysis: { x: "f", y: "tg", fit: "proporcional", results: [{ label: "RC", unit: "s", compute: (b) => b / (2 * Math.PI), reference: 1e-4 }] },
    };
    const res = analyze(pr, measure(pr, [200, 400, 700, 1000, 1500, 2000].map((f) => ({ f }))))!;
    expect(Math.abs(res.results[0]!.value / 1e-4 - 1)).toBeLessThan(0.03);
  });

  it("todos os cenários desenham nos dois temas", () => {
    for (const sc of sim.scenarios) {
      const r = run(P(sc.params as Record<string, number>), 0.1);
      for (const theme of [lightTheme, darkTheme]) sim.render(ctx(), { state: r.state, params: r.params, t: r.t, trail: [], scale: 30, theme });
      expect(r.observe().every(Number.isFinite)).toBe(true);
    }
  });
});
