import { describe, expect, it } from "vitest";
import { Runner, generateExercise, withOverrides } from "@fisilab/core";
import { acceptanceDeg, analyze, dioptImage, nAir, refracao as sim, sagX, sceneDioptro, trace, traceGradient, type RefState } from "../src/index.ts";

const DEG = Math.PI / 180;
const at = (over: Record<string, number>) => {
  const p = withOverrides(sim, over);
  return { p, s: sim.init(p) };
};

describe("Reflexão e refração", () => {
  it("lei de Snell: o raio traçado sai no ângulo de arcsen(n1 sen θ1 / n2)", () => {
    for (const [n1, n2, th] of [
      [1, 1.5, 40],
      [1, 1.33, 70],
      [1.2, 2.4, 15],
    ] as const) {
      const { p, s } = at({ modo: 0, n1, n2, theta: th });
      const a = analyze(s, p);
      expect(a.th1).toBeCloseTo(th, 6);
      expect(a.th2).toBeCloseTo(Math.asin((n1 * Math.sin(th * DEG)) / n2) / DEG, 6);
      // o segmento transmitido tem mesmo a direção calculada
      const t = a.segs.find((g) => g.depth === 1 && g.n === n2)!;
      const ang = Math.atan2(Math.abs(t.b[0] - t.a[0]), Math.abs(t.b[1] - t.a[1])) / DEG;
      expect(ang).toBeCloseTo(a.th2, 6);
      expect(t.I).toBeCloseTo(a.T, 9);
    }
  });

  it("Fresnel: 4% na incidência normal ar-vidro, R + T = 1 e zero na polarização p em Brewster", () => {
    const { p, s } = at({ modo: 0, n1: 1, n2: 1.5, theta: 0 });
    const a = analyze(s, p);
    expect(a.R).toBeCloseTo(((1.5 - 1) / 2.5) ** 2, 9);
    expect(a.R + a.T).toBeCloseTo(1, 12);
    const thB = Math.atan(1.5) / DEG;
    const p2 = withOverrides(sim, { modo: 0, n1: 1, n2: 1.5, theta: thB, pol: 2 });
    expect(analyze(sim.init(p2), p2).R).toBeLessThan(1e-12);
    const p1 = withOverrides(sim, { modo: 0, n1: 1, n2: 1.5, theta: thB, pol: 1 });
    expect(analyze(sim.init(p1), p1).R).toBeGreaterThan(0.1);
  });

  it("reflexão interna total acima do ângulo crítico, com R = 1 e nenhum raio transmitido", () => {
    const thc = Math.asin(1 / 1.5) / DEG;
    const below = at({ modo: 0, n1: 1.5, n2: 1, theta: thc - 1 });
    expect(analyze(below.s, below.p).tir).toBe(false);
    const above = at({ modo: 0, n1: 1.5, n2: 1, theta: thc + 1 });
    const a = analyze(above.s, above.p);
    expect(a.tir).toBe(true);
    expect(a.R).toBe(1);
    expect(a.segs.some((g) => g.n === 1)).toBe(false);
  });

  it("fibra: dentro do cone de aceitação a luz chega à saída; fora dele vaza", () => {
    const acc = acceptanceDeg(1.5, 1.45);
    expect(Math.sin(acc * DEG)).toBeCloseTo(Math.sqrt(1.5 ** 2 - 1.45 ** 2), 12);
    const inside = at({ modo: 1, n1: 1.5, n2: 1.45, theta: acc - 4, Rb: 0 });
    const a = analyze(inside.s, inside.p);
    expect(a.nrefl).toBeGreaterThanOrEqual(2);
    // perdas só de Fresnel na entrada: chega quase tudo o que entrou
    expect(a.pout).toBeGreaterThan(0.9);
    const outside = at({ modo: 1, n1: 1.5, n2: 1.45, theta: acc + 8, Rb: 0 });
    expect(analyze(outside.s, outside.p).pout).toBeLessThan(0.3 * a.pout);
  });

  it("miragem: n cos θ se conserva e o raio volta na altura em que n(y) = n(y0) cos α", () => {
    const dT = 30;
    const h = 0.3;
    const y0 = 1.7;
    const alpha = -0.3 * DEG;
    const g = traceGradient(0, y0, alpha, dT, h, 0.5, 1000);
    expect(g.end).not.toBe("solo");
    const target = nAir(y0, dT, h) * Math.cos(alpha);
    // inverte n(y) = target por bissecção
    let lo = 0;
    let hi = y0;
    for (let i = 0; i < 80; i++) {
      const mid = (lo + hi) / 2;
      if (nAir(mid, dT, h) < target) lo = mid;
      else hi = mid;
    }
    expect(g.ymin).toBeCloseTo(lo, 3);
    // raio mais inclinado que o limite bate no chão
    const lim = Math.acos(nAir(0, dT, h) / nAir(y0, dT, h));
    expect(traceGradient(0, y0, -lim * 1.05, dT, h, 0.5, 1000).end).toBe("solo");
    expect(traceGradient(0, y0, -lim * 0.95, dT, h, 0.5, 1000).end).not.toBe("solo");
  });

  it("arrastar a alça gira o laser e grava amostra para o gráfico", () => {
    const p = withOverrides(sim, { modo: 0 });
    const r = new Runner(sim, p);
    const s0 = r.state;
    const u: [number, number] = [Math.cos(s0.ang), Math.sin(s0.ang)];
    const L = 0.34 * 1.15;
    const handle = { x: s0.lx - u[0] * L, y: s0.ly - u[1] * L };
    const s1 = sim.pointer!.down!(s0, p, handle) as RefState;
    expect(s1.drag).toBe("rot");
    const s2 = sim.pointer!.move!(s1, p, { x: s0.lx, y: s0.ly + 1 }, true) as RefState;
    expect(s2.ang).toBeCloseTo(-Math.PI / 2, 9);
    r.setState(sim.pointer!.up!(s2, p, handle)!);
    expect(r.value("th1")).toBeCloseTo(0, 6);
    expect(r.samples.length).toBe(2);
  });

  it("cenários e exercícios produzem números finitos", () => {
    for (const sc of sim.scenarios) {
      const r = new Runner(sim, withOverrides(sim, sc.params));
      for (let i = 0; i < 5; i++) r.stepOnce();
      for (const v of r.observe()) expect(Number.isFinite(v)).toBe(true);
      expect(sim.liveEquations!(r.state, r.params, r.t).length).toBeGreaterThan(0);
    }
    for (const ex of sim.exercises!) for (let seed = 1; seed <= 5; seed++) expect(Number.isFinite(generateExercise(sim, ex, seed).answer)).toBe(true);
  });

  it("dioptro esférico: raios paraxiais traçados com Snell cruzam o eixo na imagem n₁/p + n₂/i = (n₂ − n₁)/R", () => {
    const p = withOverrides(sim, sim.scenarios.find((c) => c.id === "dioptro")!.params);
    const s = sim.init(p);
    expect(s.lx).toBe(-30);
    const { i, m } = dioptImage(1, 1.5, 6, 30);
    expect(i).toBeCloseTo(30, 10);
    expect(m).toBeCloseTo(-2 / 3, 10);
    const y = 0.05;
    const segs = trace(sceneDioptro(p), [-30, 0], [sagX(6, y) + 30, y], { maxDepth: 2, maxLen: 140 });
    const out = segs.find((g) => g.depth === 1)!;
    expect(out.n).toBeCloseTo(1.5, 12);
    const cross = out.a[0] - (out.a[1] * (out.b[0] - out.a[0])) / (out.b[1] - out.a[1]);
    expect(cross).toBeCloseTo(30, 1);
    // perto do objeto a imagem é virtual; superfície côncava: sempre virtual
    expect(dioptImage(1, 1.5, 6, 8).i).toBeLessThan(0);
    for (const po of [5, 20, 38]) expect(dioptImage(1, 1.5, -6, po).i).toBeLessThan(0);
    const r = new Runner(sim, p);
    expect(r.value("idio")).toBeCloseTo(30, 10);
  });
});
