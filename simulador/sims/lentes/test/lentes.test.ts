import { describe, expect, it } from "vitest";
import { Runner, generateExercise, withOverrides } from "@fisilab/core";
import { GLASSES_GAP, analyzeBench, lensmakerPower, lentes as sim, thickGeom, thickMatrix, type Bench } from "../src/index.ts";

const setup = (over: Record<string, number>, patch: Partial<Bench> = {}) => {
  const p = withOverrides(sim, over);
  return { p, s: { ...sim.init(p), ...patch } };
};

describe("Lentes e bancada ótica", () => {
  it("lente fina: p' = 1/(1/f − 1/p) e m = −p'/p, inclusive divergente", () => {
    for (const [mont, ox] of [
      [0, -0.25],
      [0, -0.06],
      [1, -0.2],
    ] as const) {
      const { p, s } = setup({ montagem: mont }, { ox });
      const a = analyzeBench(s, p);
      const P = s.els[0]!.P;
      const q = 1 / (P - 1 / -ox);
      expect(a.q).toBeCloseTo(q, 10);
      expect(a.m).toBeCloseTo(-q / -ox, 10);
    }
  });

  it("associação de duas lentes: a imagem da primeira é o objeto da segunda", () => {
    const { p, s } = setup({ montagem: 2 });
    const a = analyzeBench(s, p);
    const q1 = 1 / (10 - 1 / 0.18);
    const p2 = 0.3 - q1;
    const q2 = 1 / (8 - 1 / p2);
    expect(a.images[0]!.x).toBeCloseTo(q1, 10);
    expect(a.q).toBeCloseTo(q2, 10);
    expect(a.m).toBeCloseTo((-q1 / 0.18) * (-q2 / p2), 10);
    // f equivalente de duas lentes finas: 1/f = 1/f1 + 1/f2 − d/(f1 f2)
    expect(a.feq).toBeCloseTo(1 / (10 + 8 - 0.3 * 80), 10);
  });

  it("telescópio é afocal com M = −fob/foc; microscópio dá M = −(L/fob)(25 cm/foc)", () => {
    const t = setup({ montagem: 4 });
    const at = analyzeBench(t.s, t.p);
    expect(at.afocal).toBe(true);
    expect(at.Mang).toBeCloseTo(-0.5 / 0.05, 9);
    const m = setup({ montagem: 3 });
    const am = analyzeBench(m.s, m.p);
    expect(am.afocal).toBe(true);
    expect(am.Mang).toBeCloseTo(-(0.16 / 0.01) * (0.25 / 0.025), 6);
  });

  it("lente espessa: matriz ABCD reproduz a fórmula do fabricante e os planos principais", () => {
    const p = withOverrides(sim, { montagem: 7, nL: 1.6, esp: 0.04, Rl: 0.08 });
    const { R1, R2, d, n } = thickGeom(p);
    const S = thickMatrix(p);
    expect(-S[2]).toBeCloseTo(lensmakerPower(R1, R2, d, n), 10);
    expect(S[0] * S[3] - S[1] * S[2]).toBeCloseTo(1, 12);
    // medindo p e p' a partir de H e H', vale 1/f = 1/p + 1/p'
    const f = -1 / S[2];
    const xH = (S[3] - 1) / S[2];
    const xH2 = d + (1 - S[0]) / S[2];
    const s = { ...sim.init(p), ox: -0.3 };
    const a = analyzeBench(s, p);
    const pp = xH - s.ox;
    const qq = d + a.q - xH2;
    expect(1 / pp + 1 / qq).toBeCloseTo(1 / f, 9);
  });

  it("olho míope: desfoca ao longe, foca no ponto remoto e a lente corretiva resolve", () => {
    const far = setup({ montagem: 6, rx: -2, oculos: 0, acom: 4 }, { ox: -4 });
    expect(analyzeBench(far.s, far.p).blur).toBeGreaterThan(0.05e-3);
    const pr = setup({ montagem: 6, rx: -2, oculos: 0, acom: 4 }, { ox: -0.5 });
    const apr = analyzeBench(pr.s, pr.p);
    expect(apr.blur).toBeLessThan(1e-9);
    expect(apr.acc).toBeCloseTo(0, 9);
    const corr = setup({ montagem: 6, rx: -2, oculos: -1 / (0.5 - GLASSES_GAP), acom: 0 }, { ox: -1e4 });
    expect(analyzeBench(corr.s, corr.p).blur).toBeLessThan(1e-6);
  });

  it("olho normal: ponto próximo a 25 cm com 4 D de acomodação", () => {
    const ok = setup({ montagem: 5, rx: 0, acom: 4 }, { ox: -0.25 });
    const a = analyzeBench(ok.s, ok.p);
    expect(a.acc).toBeCloseTo(4, 9);
    expect(a.blur).toBeLessThan(1e-9);
    const close = setup({ montagem: 5, rx: 0, acom: 4 }, { ox: -0.2 });
    expect(analyzeBench(close.s, close.p).blur).toBeGreaterThan(0.05e-3);
  });

  it("bancada: selecionar, arrastar, acrescentar e remover lentes", () => {
    const p = withOverrides(sim, { montagem: 0 });
    const r = new Runner(sim, p);
    let s = sim.pointer!.down!(r.state, p, { x: 0, y: 0.01 })!;
    expect(s.sel).toBe(1);
    s = sim.pointer!.move!(s, p, { x: 0.05, y: 0 }, true)!;
    s = sim.pointer!.up!(s, p, { x: 0.05, y: 0 })!;
    r.setState(s);
    expect(r.value("p")).toBeCloseTo(0.3, 9);
    const add = sim.actions!.find((x) => x.id === "divergente")!;
    s = add.run(s, p);
    expect(s.els).toHaveLength(2);
    expect(s.els[1]!.P).toBeLessThan(0);
    s = sim.actions!.find((x) => x.id === "remover")!.run(s, p);
    expect(s.els).toHaveLength(1);
  });

  it("cenários, montagens e exercícios produzem números finitos", () => {
    const all = [...sim.scenarios.map((sc) => sc.params), ...Array.from({ length: 8 }, (_, i) => ({ montagem: i }))];
    for (const over of all) {
      const r = new Runner(sim, withOverrides(sim, over));
      for (const v of r.observe()) expect(Number.isFinite(v)).toBe(true);
      sim.liveEquations!(r.state, r.params, r.t);
    }
    for (const ex of sim.exercises!) for (let seed = 1; seed <= 5; seed++) expect(Number.isFinite(generateExercise(sim, ex, seed).answer)).toBe(true);
  });
});
