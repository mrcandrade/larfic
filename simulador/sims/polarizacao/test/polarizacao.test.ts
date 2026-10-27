import { describe, expect, it } from "vitest";
import { Runner, rng, withOverrides } from "@fisilab/core";
import { analyze, dmmAccuracy, measureRow, type Practice } from "../../../packages/analysis/src/index.ts";
import { brewsterDeg, DARK_MV, ellipseOf, fresnel, polarizacao as sim, propagate, reading, setupOf, transmittance, type PolState, type Setup } from "../src/index.ts";

const D = Math.PI / 180;
const base: Setup = { modo: 0, fonte: 0, lamina: 0, an: true, p1: 0, mid: 45, th: 0, inc: 45, n: 1.52 };

/** Fotodiodo lido por um multímetro na escala de 2 V (mV). */
const fotodiodo = { id: "fotodiodo", name: "Fotodiodo + multímetro (mV)", unit: "mV", kind: "digital" as const, resolution: 0.1, range: [0, 2000] as [number, number], accuracy: dmmAccuracy(0.5, 2, 0.1) };

/** Mede uma linha da prática no aparato, como a bancada faz (sim estática: t = 0 basta). */
function measure(practice: Practice, over: Record<string, number>, rand: () => number) {
  const r = new Runner(sim, withOverrides(sim, { ...practice.params, ...over }));
  for (let k = 0; k < 2 && r.t < 0; k++) r.stepOnce();
  return measureRow(practice, { params: r.params, t: r.t, value: (k) => r.value(k) }, rand);
}

describe("Polarização: Malus, lâminas e Brewster", () => {
  it("lei de Malus com laser e com luz natural", () => {
    for (const th of [0, 20, 45, 60, 90, 135, 200]) {
      expect(transmittance({ ...base, th })).toBeCloseTo(Math.cos(th * D) ** 2, 12);
      expect(transmittance({ ...base, fonte: 1, p1: 30, th })).toBeCloseTo(0.5 * Math.cos((th - 30) * D) ** 2, 12);
    }
    // P1 girado em relação ao laser: Malus duas vezes
    expect(transmittance({ ...base, p1: 30, th: 30 })).toBeCloseTo(Math.cos(30 * D) ** 2, 12);
  });

  it("três polarizadores com luz natural: I/I₀ = sen²(2β)/8", () => {
    for (const b of [0, 15, 30, 45, 70]) {
      expect(transmittance({ ...base, modo: 1, fonte: 1, mid: b, th: 90 })).toBeCloseTo(Math.sin(2 * b * D) ** 2 / 8, 12);
    }
  });

  it("λ/4 a 45° gera luz circular; λ/2 gira a polarização de 2β", () => {
    const circ = propagate({ ...base, lamina: 1, mid: 45, an: false }).out;
    const e = ellipseOf(circ);
    expect(Math.abs(e.chi)).toBeCloseTo(45, 9);
    for (const th of [0, 33, 90, 150]) expect(transmittance({ ...base, lamina: 1, mid: 45, th })).toBeCloseTo(0.5, 12);
    // λ/2 com eixo a 20°: polarização linear a 40°, extinção com analisador a 130°
    const half = ellipseOf(propagate({ ...base, lamina: 2, mid: 20, an: false }).out);
    expect(half.psi).toBeCloseTo(40, 9);
    expect(half.chi).toBeCloseTo(0, 9);
    expect(transmittance({ ...base, lamina: 2, mid: 20, th: 130 })).toBeLessThan(1e-15);
  });

  it("Fresnel: incidência normal, Rp = 0 em θB = arctan n, luz refletida em θB é s pura", () => {
    const n = 1.52;
    expect(fresnel(0, n).Rs).toBeCloseTo(((n - 1) / (n + 1)) ** 2, 12);
    expect(fresnel(0, n).Rp).toBeCloseTo(((n - 1) / (n + 1)) ** 2, 12);
    const b = brewsterDeg(n);
    expect(b).toBeCloseTo(56.66, 2);
    expect(fresnel(b, n).Rp).toBeLessThan(1e-25);
    // lâmpada → vidro em θB: refletida 100% polarizada na vertical (s)
    const S = propagate({ ...base, modo: 2, fonte: 1, p1: 0, an: false, inc: b }).stages.find((g) => g.key === "vidro")!.S;
    expect(S[0]).toBeGreaterThan(0);
    // P1 a 0° deixa vertical; sem P1 efetivo, use P1 a 45°: a reflexão em θB devolve só a parte s
    const S45 = propagate({ ...base, modo: 2, fonte: 1, p1: 45, an: false, inc: b }).stages.find((g) => g.key === "vidro")!.S;
    const e = ellipseOf(S45);
    expect(e.dop).toBeCloseTo(1, 9);
    expect(e.psi).toBeCloseTo(0, 6);
    expect(S45[0]).toBeCloseTo(0.25 * fresnel(b, n).Rs, 12);
  });

  it("leitura do detector = I₀·T + ambiente + escuro; bloquear o feixe lê só o fundo", () => {
    const p = withOverrides(sim, { I0: 800, amb: 35, theta: 60 });
    const s = sim.init(p);
    expect(reading(s, p)).toBeCloseTo(800 * 0.25 + 35 + DARK_MV, 9);
    const blocked = sim.actions!.find((a) => a.id === "bloq")!.run(s, p);
    expect(reading(blocked, p)).toBeCloseTo(35 + DARK_MV, 12);
  });

  it("arrastar o disco gira o analisador; na montagem de Brewster arrastar a mesa muda i", () => {
    const p = withOverrides(sim, {});
    let s: PolState = sim.init(p);
    // ponto à direita do centro do disco (vista de frente): 90°
    s = sim.pointer!.down!(s, p, { x: 4.3 + 2, y: -4.7 })!;
    expect(s.th).toBeCloseTo(90, 9);
    s = sim.pointer!.move!(s, p, { x: 4.3, y: -4.7 - 2 }, true)!;
    expect(s.th).toBeCloseTo(180, 9);
    s = sim.pointer!.up!(s, p, { x: 0, y: 0 })!;
    expect(s.drag).toBeNull();
    const r = new Runner(sim, p);
    r.setState(s);
    expect(r.value("theta")).toBeCloseTo(180, 9);

    const pb = withOverrides(sim, { modo: 2 });
    let sb = sim.init(pb);
    // alça na normal: normal apontando para (−cos i, sen i) com i = 60°
    sb = sim.pointer!.down!(sb, pb, { x: 8.6 - Math.cos(60 * D), y: 1.9 + Math.sin(60 * D) })!;
    expect(sb.inc).toBeCloseTo(60, 6);
    expect(setupOf(sb, pb).inc).toBeCloseTo(60, 6);
  });

  it("prática de Malus: V contra cos²θ reproduz I₀ e o fundo", () => {
    const practice: Practice = {
      id: "t",
      course: "Exp III",
      title: "Polarização (Malus)",
      sim: "polarizacao",
      scenario: "malus",
      params: { modo: 0, fonte: 0, lamina: 0, an: 1, p1: 0, I0: 1000, amb: 20, curva: 0 },
      objective: "",
      materials: [],
      procedure: "",
      columns: [
        { key: "th", label: "θ", unit: "°", source: { observable: "theta" }, instrument: "goniometro" },
        { key: "V", label: "V", unit: "mV", source: { observable: "V" }, instrument: fotodiodo },
        { key: "c2", label: "cos²θ", unit: "", from: ["th"], compute: (t) => Math.cos(t * D) ** 2 },
      ],
      analysis: {
        x: "c2",
        y: "V",
        fit: "linear",
        results: [
          { label: "I₀", unit: "mV", compute: (_a, b) => b, reference: 1000 },
          { label: "fundo", unit: "mV", compute: (a) => a, reference: 21.5 },
        ],
      },
      questions: [],
    };
    const rand = rng(11);
    const rows = Array.from({ length: 10 }, (_, i) => measure(practice, { theta: 10 * i }, rand));
    const res = analyze(practice, rows)!;
    const [I0, fundo] = res.results;
    expect(I0!.value).toBeGreaterThan(985);
    expect(I0!.value).toBeLessThan(1015);
    expect(Math.abs(fundo!.value - 21.5)).toBeLessThan(6);
    expect(res.fit.r2).toBeGreaterThan(0.999);
  });

  it("prática de Brewster: ±√V contra i (luz p) cruza zero em θB e dá n ≈ 1,52", () => {
    const practice: Practice = {
      id: "t2",
      course: "Exp III",
      title: "Polarização (Malus)",
      sim: "polarizacao",
      scenario: "brewster",
      params: { modo: 2, fonte: 1, an: 0, p1: 90, n: 1.52, I0: 1800, amb: 0, curva: 0 },
      objective: "",
      materials: [],
      procedure: "",
      columns: [
        { key: "i", label: "i", unit: "°", source: { observable: "inc" }, instrument: "goniometro" },
        { key: "V", label: "V", unit: "mV", source: { observable: "V" }, instrument: fotodiodo },
        { key: "di", label: "i − 57°", unit: "°", from: ["i"], compute: (i) => i - 57 },
        { key: "y", label: "±√(V − V_escuro)", unit: "√mV", from: ["i", "V"], compute: (i, V) => (i < 57 ? -1 : 1) * Math.sqrt(Math.max(V - 1.5, 0)) },
      ],
      analysis: {
        x: "di",
        y: "y",
        fit: "quadratico",
        results: [
          { label: "θB", unit: "°", compute: (a, b, c) => 57 - (2 * a) / (b + Math.sqrt(b * b - 4 * a * c)), reference: brewsterDeg(1.52) },
          { label: "n", unit: "", compute: (a, b, c) => Math.tan((57 - (2 * a) / (b + Math.sqrt(b * b - 4 * a * c))) * D), reference: 1.52 },
        ],
      },
      questions: [],
    };
    const rand = rng(3);
    const rows = Array.from({ length: 12 }, (_, i) => measure(practice, { inc: 46 + 2 * i }, rand));
    const res = analyze(practice, rows)!;
    expect(Math.abs(res.results[0]!.value - brewsterDeg(1.52))).toBeLessThan(1);
    expect(Math.abs(res.results[1]!.value / 1.52 - 1)).toBeLessThan(0.02);
  });
});
