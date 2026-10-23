import { describe, expect, it } from "vitest";
import { Runner, darkTheme, lightTheme, rng, withOverrides } from "@fisilab/core";
import { analyze, measureRow, type Practice } from "../../../packages/analysis/src/index.ts";
import { transformador as sim, DRAG, MU0, V, Z, ZT, dLinkage, linkage, mutual, solveXfmr } from "../src/index.ts";

const ctx = () => new Proxy({ measureText: (s: string) => ({ width: s.length * 6 }) } as Record<string, unknown>, { get: (t, k: string) => (k in t ? t[k] : () => undefined), set: () => true }) as unknown as CanvasRenderingContext2D;
const P = (o: Record<string, number>) => withOverrides(sim, o);
const run = (p: Record<string, number>, t: number) => {
  const r = new Runner(sim, p);
  while (!r.finished && r.t < t - 1e-9) r.stepOnce();
  return r;
};
const practice = (o: Partial<Practice>): Practice => ({ id: "t", course: "Exp III", title: "Indução e transformador", sim: "transformador", objective: "", materials: [], procedure: "", questions: [], columns: [], ...o });
const exact = (unit: string) => ({ id: "x", name: "valor ajustado", unit, kind: "digital" as const, resolution: 1, range: [0, 1e6] as [number, number] });
const scopeV = { id: "osc", name: "Osciloscópio (cursores)", unit: "V", kind: "digital" as const, resolution: 0.001, range: [-100, 100] as [number, number], accuracy: (r: number) => 0.02 * Math.abs(r) };

describe("Indução e transformador", () => {
  it("ímã: Λ é o fluxo de um dipolo numa bobina finita; dΛ/dz confere por diferenças finitas", () => {
    const p = P({ modo: 0, N2: 200, a: 1.5, mom: 0.8 });
    // Bobina curta (LC → 0) tende ao fluxo de uma espira: N μ0 m a² / (2 (a²+z²)^{3/2})
    const z = 0.05;
    const a = 0.015;
    // Média do fluxo de espiras finas distribuídas ao longo dos 2 cm da bobina
    const thin = (u: number) => (200 * MU0 * 0.8 * a * a) / (2 * (a * a + u * u) ** 1.5);
    let avg = 0;
    for (let k = 0; k < 4000; k++) avg += thin(z + 0.02 * ((k + 0.5) / 4000 - 0.5)) / 4000;
    expect(linkage(p, z) / avg).toBeCloseTo(1, 6);
    for (const zz of [-0.03, -0.004, 0.012, 0.08]) {
      const h = 1e-6;
      expect(dLinkage(p, zz)).toBeCloseTo((linkage(p, zz + h) - linkage(p, zz - h)) / (2 * h), 6);
    }
  });

  it("ímã em queda: dois pulsos opostos, áreas iguais a Λ(0) e saída mais intensa; frenagem com a bobina fechada", () => {
    const p = P({ modo: 0, h: 0.5, RL: 1e6 });
    const r = run(p, 5);
    expect(r.finished).toBe(true);
    const L0 = linkage(p, 0);
    // ½∫|ε|dt = Λmax (a fem integrada é −ΔΛ, independente da velocidade)
    expect(r.value("area")).toBeCloseTo(L0, 5);
    expect(r.value("intfem")).toBeCloseTo(linkage(p, 0.5) - linkage(p, -0.25), 8); // ∫ε dt = −ΔΛ
    expect(r.value("emax")).toBeGreaterThan(0);
    expect(-r.value("emin")).toBeGreaterThan(0);
    // Sem freio, a velocidade no piso é a da queda livre
    expect(Math.abs(r.state[V]!)).toBeCloseTo(Math.sqrt(2 * 9.81 * (0.5 + 0.25)), 2);
    const open = run(P({ modo: 0, h: 0.5, RL: 1e6, N2: 2000, mom: 2 }), 5);
    const closed = run(P({ modo: 0, h: 0.5, RL: 1, N2: 2000, mom: 2 }), 5);
    expect(Math.abs(closed.state[V]!)).toBeLessThan(0.8 * Math.abs(open.state[V]!));
    expect(closed.t).toBeGreaterThan(open.t);
  });

  it("ímã arrastado: a fem segue −(dΛ/dz)·v", () => {
    const p = P({ modo: 0, h: 0.3 });
    const r = new Runner(sim, p);
    const s = r.state.slice();
    s[DRAG] = 1;
    s[ZT] = -0.1;
    r.setState(s);
    for (let k = 0; k < 2000; k++) r.stepOnce();
    expect(r.state[Z]!).toBeLessThan(0.3);
    expect(r.value("fem")).toBeCloseTo(-dLinkage(p, r.state[Z]!) * r.state[V]!, 12);
  });

  it("indutância mútua: M = μ0N1N2πa²/ℓ, fem senoidal ωMI0 e quadrada 4fMI0", () => {
    const p = P({ modo: 1, N1: 500, N2: 200, a: 2, I0: 0.5, f: 100, forma: 0 });
    const M = (MU0 * 500 * 200 * Math.PI * 0.02 ** 2) / 0.15;
    expect(mutual(p)).toBeCloseTo(M, 15);
    const r = new Runner(sim, p);
    expect(r.value("femPico")).toBeCloseTo(2 * Math.PI * 100 * M * 0.5, 12);
    // em t = 0 a corrente cresce: ε = −ωMI0
    expect(r.value("fem")).toBeCloseTo(-2 * Math.PI * 100 * M * 0.5, 12);
    const tri = new Runner(sim, P({ modo: 1, N1: 500, N2: 200, a: 2, I0: 0.5, f: 100, forma: 1 }));
    expect(tri.value("femPico")).toBeCloseTo(4 * 100 * M * 0.5, 12);
  });

  it("transformador: V2/V1 → N2/N1 com ferro, balanço de potência fecha, ar e ferro maciço pioram", () => {
    for (const o of [
      { nucleo: 0, N1: 500, N2: 250, RL: 100 },
      { nucleo: 1, N1: 500, N2: 250, RL: 100 },
      { nucleo: 2, N1: 500, N2: 500, RL: 100 },
      { nucleo: 0, N1: 100, N2: 50, RL: 10 },
    ]) {
      const x = solveXfmr(P({ modo: 2, V1: 12, f: 60, ...o }));
      expect(x.P1).toBeCloseTo(x.P2 + x.Pcu + x.Pcore, 9);
    }
    const iron = solveXfmr(P({ modo: 2, nucleo: 0, N1: 500, N2: 250, RL: 1e6, V1: 12 }));
    expect(iron.V2 / iron.V1).toBeCloseTo(0.5 * 0.995, 2);
    const air = solveXfmr(P({ modo: 2, nucleo: 2, N1: 500, N2: 500, RL: 100, V1: 12 }));
    expect(air.V2 / air.V1).toBeLessThan(0.7);
    const lam = solveXfmr(P({ modo: 2, nucleo: 0, N1: 500, N2: 250, RL: 100 }));
    const sol = solveXfmr(P({ modo: 2, nucleo: 1, N1: 500, N2: 250, RL: 100 }));
    expect(lam.P2 / lam.P1).toBeGreaterThan(0.75);
    expect(sol.Pcore).toBeGreaterThan(20 * lam.Pcore);
    // Com carga, I1 ≈ (N2/N1) I2 + corrente de magnetização (soma fasorial)
    expect(lam.I1).toBeGreaterThan(0.5 * lam.I2);
    // Poucas espiras no primário saturam o núcleo
    expect(solveXfmr(P({ modo: 2, nucleo: 0, N1: 50, N2: 25, V1: 24, RL: 1e6 })).mu).toBeLessThan(2000);
  });

  it("prática (transformador): V2 contra N2 é proporcional, inclinação V1/N1 = 0,024 V/espira", () => {
    const pr = practice({
      params: { modo: 2, nucleo: 0, N1: 500, V1: 12, f: 60, RL: 10000 },
      columns: [
        { key: "N2", label: "N₂", unit: "", source: { param: "N2" }, instrument: exact("") },
        { key: "V2", label: "V₂", unit: "V", source: { observable: "V2" }, instrument: { id: "vca", name: "Voltímetro CA", unit: "V", kind: "digital", resolution: 0.01, range: [0, 200], accuracy: (r) => 0.01 * r + 0.02 } },
      ],
      analysis: { x: "N2", y: "V2", fit: "proporcional", results: [{ label: "V₁/N₁", unit: "V", compute: (b) => b, reference: 0.024 }] },
    });
    const rand = rng(2);
    const rows = [100, 250, 400, 550, 700, 850].map((N2) => {
      const r = run(P({ ...(pr.params as Record<string, number>), N2 }), 0);
      return measureRow(pr, { params: r.params, t: r.t, value: (k) => r.value(k) }, rand);
    });
    const res = analyze(pr, rows)!;
    expect(Math.abs(res.results[0]!.value / 0.024 - 1)).toBeLessThan(0.02);
  });

  it("prática (Faraday): fem de pico contra f é proporcional, inclinação 2πMI0", () => {
    const base = { modo: 1, N1: 500, N2: 200, a: 1.5, I0: 0.5, forma: 0 };
    const M = mutual(P(base));
    const pr = practice({
      params: base,
      columns: [
        { key: "f", label: "f", unit: "Hz", source: { param: "f" }, instrument: exact("Hz") },
        { key: "e", label: "ε₀", unit: "V", source: { observable: "femPico" }, instrument: scopeV },
      ],
      analysis: { x: "f", y: "e", fit: "proporcional", results: [{ label: "M", unit: "H", compute: (b) => b / (2 * Math.PI * 0.5), reference: M }] },
    });
    const rand = rng(4);
    const rows = [50, 100, 200, 400, 700, 1000].map((f) => {
      const r = run(P({ ...base, f }), 0);
      return measureRow(pr, { params: r.params, t: r.t, value: (k) => r.value(k) }, rand);
    });
    const res = analyze(pr, rows)!;
    expect(Math.abs(res.results[0]!.value / M - 1)).toBeLessThan(0.02);
  });

  it("prática (ímã): pico de saída contra h segue lei de potência com expoente ≈ 1/2", () => {
    const pr = practice({
      params: { modo: 0, N2: 200, a: 1.5, mom: 0.8, RL: 1e6 },
      columns: [
        { key: "h", label: "h", unit: "m", source: { param: "h" }, instrument: { id: "trena", name: "Trena", unit: "m", kind: "analogico", resolution: 0.001, range: [0, 5] } },
        { key: "e", label: "|ε mín|", unit: "V", source: { observable: "femPico" }, instrument: scopeV },
      ],
      analysis: { x: "h", y: "e", fit: "potencia", results: [{ label: "expoente", unit: "", compute: (_A, n) => n, reference: 0.5 }] },
    });
    const rand = rng(6);
    const rows = [0.3, 0.5, 0.7, 0.9, 1.2, 1.5].map((h) => {
      const r = run(P({ ...(pr.params as Record<string, number>), h }), 1e6);
      return measureRow(pr, { params: r.params, t: r.t, value: (k) => r.value(k) }, rand);
    });
    const res = analyze(pr, rows)!;
    expect(Math.abs(res.results[0]!.value - 0.5)).toBeLessThan(0.03);
  });

  it("todos os cenários desenham nos dois temas", () => {
    for (const sc of sim.scenarios) {
      const r = run(P(sc.params as Record<string, number>), 0.4);
      const trail = [r.state];
      for (const theme of [lightTheme, darkTheme]) sim.render(ctx(), { state: r.state, params: r.params, t: r.t, trail, scale: 30, theme });
      expect(r.observe().every(Number.isFinite)).toBe(true);
    }
  });
});
