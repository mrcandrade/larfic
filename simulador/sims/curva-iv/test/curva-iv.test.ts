import { describe, expect, it } from "vitest";
import { Runner, darkTheme, lightTheme, rng, withOverrides } from "@fisilab/core";
import { analyze, measureRow, type Practice } from "../../../packages/analysis/src/index.ts";
import { curvaIv as sim, LAMP, T0, lampEquilibrium, lampLoss, lampR, type IVState } from "../src/index.ts";

const ctx = () => new Proxy({ measureText: (s: string) => ({ width: s.length * 6 }) } as Record<string, unknown>, { get: (t, k: string) => (k in t ? t[k] : () => undefined), set: () => true }) as unknown as CanvasRenderingContext2D;
const P = (o: Record<string, number>) => withOverrides(sim, o);
const run = (p: Record<string, number>, t: number) => {
  const r = new Runner(sim, p);
  while (r.t < t - 1e-9) r.stepOnce();
  return r;
};

const volt = { id: "v", name: "Voltímetro 20 V", unit: "V", kind: "digital" as const, resolution: 0.001, range: [-20, 20] as [number, number], accuracy: (r: number) => 0.005 * Math.abs(r) + 0.002 };
const amp = { id: "a", name: "Amperímetro 40 mA", unit: "mA", kind: "digital" as const, resolution: 0.001, range: [-40, 40] as [number, number], accuracy: (r: number) => 0.01 * Math.abs(r) + 0.003 };

function measure(pr: Practice, rows: Record<string, number>[], t = 0) {
  const rand = rng(3);
  return rows.map((o) => {
    const r = run(P({ ...(pr.params as Record<string, number>), ...o }), t);
    return measureRow(pr, { params: r.params, t: r.t, value: (k) => r.value(k) }, rand);
  });
}

describe("Curvas I–V: resistor, lâmpada e diodo", () => {
  it("resistor: V/I = R‖R_V a jusante e R + R_A a montante (erro de inserção)", () => {
    const base = { comp: 0, Vf: 10, Rp: 100, Rx: 100000, Ra: 5, Rv: 100000 };
    const jus = new Runner(sim, P({ ...base, montagem: 0 }));
    expect(jus.value("R")).toBeCloseTo(50000, 1); // GMIN do MNA (1e−12 S) mexe na 8ª casa
    expect(jus.value("Rc")).toBeCloseTo(100000, 6);
    expect(jus.value("erro")).toBeCloseTo(-50, 4);
    const mon = new Runner(sim, P({ ...base, montagem: 1 }));
    expect(mon.value("R")).toBeCloseTo(100005, 1);
    // Corrente: divisor exato com Rp + Ra em série e R‖Rv
    const Req = 1 / (1 / 100000 + 1 / 100000);
    expect(jus.value("I")).toBeCloseTo(10 / (105 + Req), 10);
  });

  it("diodo: a corrente obedece à equação de Shockley com resistência série", () => {
    const r = new Runner(sim, P({ comp: 2, Vf: 3, Rp: 100, montagem: 0, Rv: 1e12 }));
    const I = r.value("Ic");
    const V = r.value("Vc");
    expect(I).toBeGreaterThan(0.015);
    const vj = V - 0.3 * I;
    expect(I).toBeCloseTo(2.52e-9 * (Math.exp(vj / (1.752 * 0.025852)) - 1), 9);
    expect(V + (100 + 1) * I).toBeCloseTo(3, 9); // Kirchhoff na malha
    // Reverso: a jusante o amperímetro lê a corrente do voltímetro, V/R_V
    const rev = new Runner(sim, P({ comp: 2, Vf: -10, Rp: 100, montagem: 0, Rv: 1e7 }));
    expect(rev.value("I")).toBeCloseTo(-10 / 1e7 - 2.52e-9, 10); // voltímetro + fuga I_s
    expect(Math.abs(rev.value("Ic"))).toBeLessThan(3e-9);
    // Zener: em ruptura a tensão fica perto de −5,1 V
    const z = new Runner(sim, P({ comp: 4, Vf: -12, Rp: 470 }));
    expect(z.value("Vc")).toBeGreaterThan(-5.2);
    expect(z.value("Vc")).toBeLessThan(-5.05);
  });

  it("lâmpada: equilíbrio térmico, R(T) e pico de corrente na partida", () => {
    const p = P({ comp: 1, Vf: 12, Rp: 1, Ra: 0.1 });
    const r = new Runner(sim, p);
    const T = r.state.Tf;
    expect(T).toBeGreaterThan(2400);
    expect(T).toBeLessThan(3000);
    // Equilíbrio: I²R = perdas
    expect(r.value("Pc")).toBeCloseTo(lampLoss(T), 6);
    expect(r.value("Rc")).toBeCloseTo(lampR(T), 6);
    expect(r.value("Ic")).toBeGreaterThan(0.08);
    // Desliga até esfriar e religa: corrente inicial ≫ regime
    r.setState({ ...r.state, on: 0 });
    while (r.t < 6) r.stepOnce();
    expect(r.state.Tf).toBeLessThan(T0 + 5);
    r.setState({ ...r.state, on: 1 });
    r.stepOnce();
    const inrush = r.value("I");
    while (r.t < 9) r.stepOnce();
    expect(inrush / r.value("I")).toBeGreaterThan(5);
    expect(r.state.Tf).toBeCloseTo(T, 0);
    expect(lampEquilibrium(12, p)).toBeCloseTo(T, 6);
    expect(LAMP.R0).toBe(8.6);
  });

  it("prática (resistor): V contra I é reta pela origem com inclinação R ≈ 470 Ω", () => {
    const pr: Practice = {
      id: "t", course: "Exp III", title: "Lei de Ohm e resistores não-ôhmicos (lâmpada, diodo)", sim: "curva-iv",
      params: { comp: 0, Rx: 470, Rp: 100, montagem: 0, Ra: 1, Rv: 1e7 },
      objective: "", materials: [], procedure: "", questions: [],
      columns: [
        { key: "V", label: "V", unit: "V", source: { observable: "V" }, instrument: volt },
        { key: "I", label: "I", unit: "mA", source: { observable: "I" }, instrument: amp, toUnit: 1000 },
      ],
      analysis: { x: "I", y: "V", fit: "proporcional", results: [{ label: "R", unit: "Ω", compute: (b) => b * 1000, reference: 470 }] },
    };
    const res = analyze(pr, measure(pr, [2, 4, 6, 8, 10, 12].map((Vf) => ({ Vf }))))!;
    expect(Math.abs(res.results[0]!.value / 470 - 1)).toBeLessThan(0.02);
    expect(res.results[0]!.compatible).toBe(true);
  });

  it("prática (diodo): ln I contra V dá o fator de idealidade n ≈ 1,75", () => {
    const pr: Practice = {
      id: "t", course: "Exp III", title: "Lei de Ohm e resistores não-ôhmicos (lâmpada, diodo)", sim: "curva-iv",
      params: { comp: 2, Rp: 100, montagem: 0, Ra: 1, Rv: 1e7 },
      objective: "", materials: [], procedure: "", questions: [],
      columns: [
        { key: "V", label: "V", unit: "V", source: { observable: "V" }, instrument: volt },
        { key: "I", label: "I", unit: "mA", source: { observable: "I" }, instrument: amp, toUnit: 1000 },
      ],
      analysis: { x: "V", y: "I", fit: "exponencial", results: [{ label: "n", unit: "", compute: (_A, B) => 1000 / (B * 1000 * 0.025852), reference: 1.752 }] },
    };
    const res = analyze(pr, measure(pr, [0.6, 0.75, 0.9, 1.1, 1.3, 1.6].map((Vf) => ({ Vf }))))!;
    expect(Math.abs(res.results[0]!.value / 1.752 - 1)).toBeLessThan(0.05);
  });

  it("varredura automática registra a curva e tudo desenha", () => {
    const r = new Runner(sim, P({ comp: 2, Rp: 100 }));
    r.setState(sim.actions!.find((a) => a.id === "varredura")!.run(r.state, r.params));
    while (r.t < 10.5) r.stepOnce();
    const pts = (r.state as IVState).pts;
    expect(pts.length).toBeGreaterThan(50);
    expect(Math.min(...pts.map((q) => q[0]))).toBeLessThan(-11);
    for (const sc of sim.scenarios) {
      const q = run(P(sc.params as Record<string, number>), 0.2);
      for (const theme of [lightTheme, darkTheme]) sim.render(ctx(), { state: q.state, params: q.params, t: q.t, trail: [], scale: 30, theme });
      expect(q.observe().every(Number.isFinite)).toBe(true);
    }
  });
});
