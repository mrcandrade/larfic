import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import { particulaCampoB as sim, cyclotronKmax, cyclotronPeriod, ionMass, larmorRadius, MP, QE, SEL_FACTORS, tauRate, type PState } from "../src/index.ts";

const run = (o: Record<string, number>) => new Runner<PState>(sim, withOverrides(sim, o));
/** Avança até o tempo físico τ (o relógio do runner é de animação). */
function untilTau(r: Runner<PState>, tau: number) {
  while (r.state.tau < tau - 1e-18 && !r.finished) r.stepOnce();
}

describe("Partícula em campo magnético", () => {
  it("B uniforme: Boris conserva |v| e o raio é mv/|q|B", () => {
    const r = run({ modo: 0, particula: 0, B: 0.2, v0: 2e6 });
    const R = larmorRadius(MP, 2e6, QE, 0.2);
    let yMin = 0;
    let yMax = 0;
    const T = cyclotronPeriod(MP, QE, 0.2);
    while (r.state.tau < 10 * T) {
      r.stepOnce();
      yMin = Math.min(yMin, r.value("y"));
      yMax = Math.max(yMax, r.value("y"));
    }
    expect((yMax - yMin) / (2 * R)).toBeCloseTo(1, 4);
    expect(r.value("v") / 2e6).toBeCloseTo(1, 12);
    expect(r.value("r") / R).toBeCloseTo(1, 10);
  });

  it("período não depende da velocidade: volta ao ponto de partida após T = 2πm/|q|B", () => {
    for (const v0 of [5e5, 3e6]) {
      const p = withOverrides(sim, { modo: 0, particula: 1, B: 0.05, v0 });
      const r = new Runner<PState>(sim, p);
      const T = cyclotronPeriod(9.1093837015e-31, QE, 0.05);
      // passo físico divide o período exatamente (1500 passos de animação)
      expect(tauRate(p) * 1e-3 * 1500).toBeCloseTo(T, 20);
      for (let i = 0; i < 1500; i++) r.stepOnce();
      const R = larmorRadius(9.1093837015e-31, v0, QE, 0.05);
      expect(Math.hypot(r.value("x"), r.value("y")) / R).toBeLessThan(2e-3);
    }
  });

  it("deriva E×B: velocidade média E/B, para próton e para elétron", () => {
    for (const particula of [0, 1]) {
      const r = run({ modo: 1, particula, B: 0.1, E: 1e5, v0: 0 }).runToEnd();
      expect(r.value("x") / r.value("tau") / 1e6).toBeCloseTo(1, 3);
      // energia mecânica (K + qV) conservada; a escala de qV aqui é ~kV
      expect(Math.abs(r.value("Em"))).toBeLessThan(0.01);
    }
  });

  it("seletor: só passa a partícula com v = E/B", () => {
    const r = run({ modo: 2, particula: 0, B: 0.1, E: 1e5, v0: 1e6 }).runToEnd();
    const hit = r.state.ps.filter((q) => q.hit).map((q) => SEL_FACTORS[q.tag]);
    expect(hit).toEqual([1]);
    expect(Math.abs(r.value("xImpacto"))).toBeLessThan(1e-6);
  });

  it("espectrômetro: impacto em x = 2mv/eB′ e isótopos separados", () => {
    const r = run({ modo: 3, isotopos: 0, B: 0.1, E: 1e4, v0: 1e5, B2: 0.1 }).runToEnd();
    const hits = r.state.ps.filter((q) => q.hit);
    expect(hits).toHaveLength(2);
    for (const q of hits) {
      const expected = 2 * larmorRadius(q.m, 1e5, QE, 0.1);
      expect(q.hx / expected).toBeCloseTo(1, 3);
    }
    const [a, b] = hits.sort((x, y) => x.m - y.m);
    expect(b!.hx / a!.hx).toBeCloseTo(ionMass(21.9914) / ionMass(19.9924), 3);
  });

  it("ciclotron: ganha energia em sintonia até perto de q²B²R²/2m; fora de sintonia, não", () => {
    const Kmax = cyclotronKmax(MP, QE, 0.5);
    const r = run({ modo: 4, particula: 0, B: 0.5, Vgap: 50, fRF: 1 }).runToEnd();
    expect(r.finished).toBe(true);
    const K = r.value("K") * QE;
    expect(K / Kmax).toBeGreaterThan(0.8);
    expect(K / Kmax).toBeLessThan(1.05);
    const off = run({ modo: 4, particula: 0, B: 0.5, Vgap: 50, fRF: 0.94 });
    untilTau(off, 40 * cyclotronPeriod(MP, QE, 0.5));
    expect(off.value("K") * QE).toBeLessThan(0.3 * Kmax);
  });

  it("garrafa magnética: reflete fora do cone de perda, escapa dentro dele; μ quase constante", () => {
    const r = run({ modo: 5, particula: 0, B: 0.5, v0: 1e6, pitch: 55 });
    const mu0 = r.value("mu");
    let zMax = 0;
    let zMin = 0;
    let muDev = 0;
    for (let i = 0; i < 12000 && !r.finished; i++) {
      r.stepOnce();
      zMax = Math.max(zMax, r.value("z"));
      zMin = Math.min(zMin, r.value("z"));
      muDev = Math.max(muDev, Math.abs(r.value("mu") / mu0 - 1));
    }
    expect(r.finished).toBe(false);
    expect(zMax).toBeGreaterThan(0.3);
    expect(zMin).toBeLessThan(-0.3);
    expect(zMax).toBeLessThan(1);
    expect(muDev).toBeLessThan(0.1);
    expect(r.value("v") / 1e6).toBeCloseTo(1, 9);
    const esc = run({ modo: 5, particula: 0, B: 0.5, v0: 1e6, pitch: 15 });
    for (let i = 0; i < 20000 && !esc.finished; i++) esc.stepOnce();
    expect(esc.finished).toBe(true);
  });
});
