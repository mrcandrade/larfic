import { describe, expect, it } from "vitest";
import { Runner, darkTheme, lightTheme, rng, withOverrides } from "@fisilab/core";
import { analyze, measureRow, type Practice } from "../../../packages/analysis/src/index.ts";
import { ponteWheatstone as sim, AMOSTRAS, FULL, KEY, TH, balanceR3, solveBridge, solveKirchhoff, vbAnalytic } from "../src/index.ts";

const ctx = () => new Proxy({ measureText: (s: string) => ({ width: s.length * 6 }) } as Record<string, unknown>, { get: (t, k: string) => (k in t ? t[k] : () => undefined), set: () => true }) as unknown as CanvasRenderingContext2D;
const P = (o: Record<string, number>) => withOverrides(sim, o);
const run = (p: Record<string, number>, t: number) => {
  const r = new Runner(sim, p);
  while (r.t < t - 1e-9) r.stepOnce();
  return r;
};

/** Aluno-modelo: procura o R3 inteiro que deixa |Ig| mínimo, só olhando o galvanômetro. */
function balance(base: Record<string, number>): number {
  let lo = 0;
  let hi = 11110;
  const ig = (R3: number) => new Runner(sim, P({ ...base, R3 })).value("Ig");
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (ig(mid) > 0) hi = mid; // I_g > 0 (B→D) quando R3 é grande demais
    else lo = mid;
  }
  return Math.abs(ig(lo)) < Math.abs(ig(hi)) ? lo : hi;
}

describe("Ponte de Wheatstone e leis de Kirchhoff", () => {
  it("I_g = 0 exatamente quando R1/R2 = R3/Rx e muda de sinal ao cruzar o equilíbrio", () => {
    for (let rx = 0; rx < AMOSTRAS.length; rx++) {
      const real = AMOSTRAS[rx]!.real;
      const p = P({ rx, R1: 1000, R2: 1000 });
      // Com R3 = Rx exato (contínuo) a corrente se anula
      expect(Math.abs(solveBridge({ ...p, R3: real }, true).Ig)).toBeLessThan(1e-10); // GMIN do MNA
      const R3 = balance({ rx, R1: 1000, R2: 1000 });
      expect(Math.abs(R3 - real)).toBeLessThanOrEqual(0.5 + 1e-9);
      expect(solveBridge({ ...p, R3: R3 + 5 }, true).Ig * solveBridge({ ...p, R3: R3 - 5 }, true).Ig).toBeLessThan(0);
    }
  });

  it("corrente no galvanômetro bate com o equivalente de Thévenin da ponte", () => {
    const p = P({ rx: 1, E: 6, R1: 1000, R2: 2200, R3: 1500, sens: 1 });
    const real = 1013;
    const E = 6;
    // Fonte com 0,5 Ω interno: resolve sem galvanômetro, tira Vth e Rth
    const open = solveBridge(p, false);
    const Vth = open.Vb - open.Vd;
    const Ra = 1000 * 2200 / 3200 + 1500 * real / (1500 + real);
    // Rth com a fonte (0,5 Ω) quase curto: corrige numericamente pela solução exata
    const Ig = solveBridge(p, true).Ig;
    expect(Ig).toBeCloseTo(Vth / (Ra + 100), 6);
    expect(open.Va).toBeCloseTo(E - 0.5 * open.If, 12);
  });

  it("ponteiro: oscilador amortecido que para em I_g/(A/div) e respeita o batente", () => {
    const p = P({ rx: 0, R1: 1000, R2: 1000, R3: 330, sens: 1 });
    const r = run(p, 3);
    const Ig = r.value("Ig");
    expect(r.value("defl")).toBeCloseTo(Ig / 1e-6, 2);
    // Muito fora do equilíbrio sem shunt: ponteiro no batente
    expect(run(P({ rx: 0, R3: 3000, sens: 1 }), 2).value("defl")).toBe(FULL);
    // Com shunt a mesma corrente deflete 100 vezes menos
    const sh = run(P({ rx: 0, R1: 1000, R2: 1000, R3: 330, sens: 0 }), 3);
    expect(sh.value("defl")).toBeCloseTo(sh.value("Ig") / 1e-4, 3);
    // Chave aberta: sem corrente, ponteiro volta ao zero
    const st = r.state.slice();
    st[KEY] = 0;
    r.setState(st);
    while (r.t < 6) r.stepOnce();
    expect(Math.abs(r.state[TH]!)).toBeLessThan(1e-3);
  });

  it("Kirchhoff: MNA cumpre nós e malhas e bate com a solução analítica", () => {
    for (const o of [
      { E: 6, E2: 4.5, R1: 220, R2: 330, R3: 470, R4: 100 },
      { E: 1, E2: 12, R1: 1000, R2: 47, R3: 10, R4: 5000 },
      { E: 9, E2: 0, R1: 100, R2: 100, R3: 100, R4: 100 },
    ]) {
      const p = P({ modo: 1, ...o });
      const k = solveKirchhoff(p);
      expect(Math.abs(k.no)).toBeLessThan(1e-10);
      expect(Math.abs(k.m1)).toBeLessThan(1e-7);
      expect(Math.abs(k.m2)).toBeLessThan(1e-7);
      expect(k.Vb).toBeCloseTo(vbAnalytic(p), 7);
      expect(k.I3).toBeCloseTo(vbAnalytic(p) / o.R3, 9);
    }
    // Com E2 = 0, I2 sai do nó b (negativa)
    expect(solveKirchhoff(P({ modo: 1, E2: 0 })).I2).toBeLessThan(0);
  });

  it("prática: R3 de equilíbrio contra R1/R2 é reta pela origem com inclinação Rx (amostra A)", () => {
    const decada = { id: "dec", name: "Década (0,1 %)", unit: "Ω", kind: "digital" as const, resolution: 1, range: [0, 11110] as [number, number], accuracy: (r: number) => 0.001 * r };
    const padrao = { id: "pad", name: "Resistor padrão (0,1 %)", unit: "Ω", kind: "digital" as const, resolution: 1, range: [0, 1e5] as [number, number], accuracy: (r: number) => 0.001 * r };
    const pr: Practice = {
      id: "t", course: "Exp III", title: "Kirchhoff e ponte de Wheatstone", sim: "ponte-wheatstone",
      params: { modo: 0, rx: 0, E: 6, sens: 1 }, objective: "", materials: [], procedure: "", questions: [],
      columns: [
        { key: "R1", label: "R₁", unit: "Ω", source: { param: "R1" }, instrument: padrao },
        { key: "R2", label: "R₂", unit: "Ω", source: { param: "R2" }, instrument: padrao },
        { key: "R3", label: "R₃", unit: "Ω", source: { param: "R3" }, instrument: decada },
        { key: "k", label: "R₁/R₂", unit: "", from: ["R1", "R2"], compute: (a, b) => a / b },
      ],
      analysis: { x: "k", y: "R3", fit: "proporcional", results: [{ label: "Rx", unit: "Ω", compute: (b) => b, reference: 327.4 }] },
    };
    const rand = rng(7);
    const rows = [100, 200, 500, 1000, 2000, 5000].map((R1) => {
      const base = { modo: 0, rx: 0, E: 6, sens: 1, R1, R2: 1000 };
      const R3 = balance(base);
      expect(R3).toBe(balanceR3(P(base)));
      const r = run(P({ ...base, R3 }), 1.5);
      // A década anda de 1 em 1 Ω: o melhor R3 deixa o ponteiro entre os vizinhos de sinais opostos
      const lo = run(P({ ...base, R3: R3 - 1 }), 1.5).value("defl");
      const hi = run(P({ ...base, R3: R3 + 1 }), 1.5).value("defl");
      expect(lo * hi).toBeLessThan(0);
      expect(Math.abs(r.value("defl"))).toBeLessThanOrEqual(Math.min(Math.abs(lo), Math.abs(hi)));
      return measureRow(pr, { params: r.params, t: r.t, value: (k) => r.value(k) }, rand);
    });
    const res = analyze(pr, rows)!;
    expect(Math.abs(res.results[0]!.value / 327.4 - 1)).toBeLessThan(0.01);
    expect(res.results[0]!.compatible).toBe(true);
  });

  it("prática (Kirchhoff): I3 contra E2 é reta; intercepto e inclinação batem com a superposição", () => {
    const amp = { id: "a", name: "Amperímetro", unit: "mA", kind: "digital" as const, resolution: 0.01, range: [-200, 200] as [number, number], accuracy: (r: number) => 0.01 * Math.abs(r) + 0.03 };
    const fonte = { id: "f", name: "Voltímetro", unit: "V", kind: "digital" as const, resolution: 0.01, range: [-20, 20] as [number, number], accuracy: (r: number) => 0.005 * Math.abs(r) + 0.02 };
    const R1 = 220, R2 = 330, R3 = 470, R4 = 100, E1 = 6;
    const Rr = R2 + R4;
    const den = R1 * R3 + R1 * Rr + R3 * Rr;
    const pr: Practice = {
      id: "t", course: "Exp III", title: "Kirchhoff e ponte de Wheatstone", sim: "ponte-wheatstone",
      params: { modo: 1, E: E1, R1, R2, R3, R4 }, objective: "", materials: [], procedure: "", questions: [],
      columns: [
        { key: "E2", label: "E₂", unit: "V", source: { param: "E2" }, instrument: fonte },
        { key: "I3", label: "I₃", unit: "mA", source: { observable: "I3" }, instrument: amp, toUnit: 1000 },
      ],
      analysis: {
        x: "E2", y: "I3", fit: "linear",
        results: [
          { label: "I₃ só com E₁", unit: "mA", compute: (a) => a, reference: (1000 * E1 * Rr) / den },
          { label: "dI₃/dE₂", unit: "mA/V", compute: (_a, b) => b, reference: (1000 * R1) / den },
        ],
      },
    };
    const rand = rng(9);
    const rows = [0, 2, 4, 6, 8, 10].map((E2) => {
      const r = run(P({ ...(pr.params as Record<string, number>), E2 }), 0);
      return measureRow(pr, { params: r.params, t: r.t, value: (k) => r.value(k) }, rand);
    });
    const res = analyze(pr, rows)!;
    for (const x of res.results) expect(Math.abs(x.value / x.reference! - 1)).toBeLessThan(0.03);
  });

  it("todos os cenários desenham nos dois temas", () => {
    for (const sc of sim.scenarios) {
      const r = run(P(sc.params as Record<string, number>), 0.2);
      for (const theme of [lightTheme, darkTheme]) sim.render(ctx(), { state: r.state, params: r.params, t: r.t, trail: [], scale: 30, theme });
      expect(r.observe().every(Number.isFinite)).toBe(true);
    }
  });
});
