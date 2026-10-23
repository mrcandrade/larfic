import { describe, expect, it } from "vitest";
import { Runner, generateExercise, withOverrides } from "@fisilab/core";
import {
  axisCrossing,
  causticPoint,
  espelhos as sim,
  image,
  mirrorBoundary,
  parallelBeam,
  trace,
  vnorm,
  type MirState,
  type V,
} from "../src/index.ts";

/** Ponto mais próximo (mínimos quadrados) de um feixe de retas. */
function convergence(lines: { a: V; d: V }[]): V {
  let a11 = 0, a12 = 0, a22 = 0, b1 = 0, b2 = 0;
  for (const { a, d } of lines) {
    const m11 = 1 - d[0] * d[0], m12 = -d[0] * d[1], m22 = 1 - d[1] * d[1];
    a11 += m11; a12 += m12; a22 += m22;
    b1 += m11 * a[0] + m12 * a[1];
    b2 += m12 * a[0] + m22 * a[1];
  }
  const det = a11 * a22 - a12 * a12;
  return [(b1 * a22 - b2 * a12) / det, (a11 * b2 - a12 * b1) / det];
}

describe("Espelhos", () => {
  it("equação dos pontos conjugados: plano p' = −p; côncavo com objeto em C dá imagem em C com m = −1", () => {
    const pl = withOverrides(sim, { modo: 0, p0: 0.7 });
    const a = image(sim.init(pl), pl);
    expect(a.pi).toBeCloseTo(-0.7, 12);
    expect(a.m).toBe(1);
    const cc = withOverrides(sim, { modo: 1, R: 0.8, p0: 0.8 });
    const b = image(sim.init(cc), cc);
    expect(b.pi).toBeCloseTo(0.8, 12);
    expect(b.m).toBeCloseTo(-1, 12);
    const cv = withOverrides(sim, { modo: 2, R: 0.8, p0: 0.4 });
    const c = image(sim.init(cv), cv);
    expect(c.pi).toBeCloseTo(-0.2, 12); // 1/p' = −1/0,4 − 1/0,4
    expect(c.m).toBeCloseTo(0.5, 12);
  });

  it("traçado exato com abertura pequena converge para a imagem paraxial", () => {
    const p = withOverrides(sim, { modo: 1, R: 0.8, p0: 0.6, h0: 0.02, abertura: 0.03 });
    const s = sim.init(p);
    const scene = { boundaries: [mirrorBoundary(p)], nAt: () => 1 };
    const lines: { a: V; d: V }[] = [];
    for (let i = 0; i <= 10; i++) {
      const y = -0.02 + 0.004 * i;
      const segs = trace(scene, [-s.p, s.h], vnorm([s.p, y - s.h]), { maxDepth: 2 });
      const r = segs.find((g) => g.depth === 1)!;
      lines.push({ a: r.a, d: vnorm([r.b[0] - r.a[0], r.b[1] - r.a[1]]) });
    }
    const q = convergence(lines);
    const im = image(s, p); // p' = 1,2 m, h' = −0,04 m
    expect(q[0]).toBeCloseTo(-im.pi, 2);
    expect(q[1]).toBeCloseTo(im.hi, 2);
  });

  it("aberração: parábola foca tudo no foco; esfera cruza o eixo em x = R − R/(2 cos θ)", () => {
    const p = withOverrides(sim, { modo: 3, R: 1, abertura: 0.4 });
    expect(parallelBeam(p, "parabola", 31).spot).toBeLessThan(1e-5);
    const sph = parallelBeam(p, "esfera", 31);
    const y = 0.4 * 0.995;
    const th = Math.asin(y);
    const xc = axisCrossing(1, y);
    expect(sph.lsa).toBeCloseTo(0.5 - xc, 12);
    expect(sph.lsa).toBeCloseTo(1 / (2 * Math.cos(th)) - 0.5, 9);
    // o raio marginal traçado cruza o eixo exatamente onde a fórmula diz
    const m = sph.segs.filter((g) => g.depth === 1).at(-1)!;
    const xCross = m.a[0] - (m.a[1] * (m.b[0] - m.a[0])) / (m.b[1] - m.a[1]);
    expect(-xCross).toBeCloseTo(xc, 9);
    // a menor mancha é menor que a do plano focal paraxial e cresce com a abertura
    expect(sph.spot).toBeGreaterThan(1e-3);
    expect(sph.spot).toBeLessThan((0.5 - xc) * Math.tan(2 * th));
    const wide = parallelBeam(withOverrides(sim, { modo: 3, R: 1, abertura: 0.6 }), "esfera", 31);
    expect(wide.spot).toBeGreaterThan(sph.spot);
  });

  it("a cáustica é o envelope dos raios refletidos (nefroide)", () => {
    const R = 1;
    const p = withOverrides(sim, { modo: 3, R, abertura: 0.9 });
    const scene = { boundaries: [mirrorBoundary(p, "esfera")], nAt: () => 1 };
    const th = 0.5;
    const ray = (t: number) => {
      const r = trace(scene, [-2, R * Math.sin(t)], [1, 0], { maxDepth: 2 }).find((g) => g.depth === 1)!;
      return { a: r.a, d: vnorm([r.b[0] - r.a[0], r.b[1] - r.a[1]]) };
    };
    const q = convergence([ray(th - 1e-4), ray(th + 1e-4)]);
    const c = causticPoint(R, th);
    expect(q[0]).toBeCloseTo(c[0], 4);
    expect(q[1]).toBeCloseTo(c[1], 4);
  });

  it("arrastar o objeto muda p e grava a curva p' × p", () => {
    const p = withOverrides(sim, { modo: 1 });
    const r = new Runner(sim, p);
    const s0 = r.state;
    const s1 = sim.pointer!.down!(s0, p, { x: -s0.p, y: s0.h })! as MirState;
    expect(s1.drag).toBe(true);
    const s2 = sim.pointer!.move!(s1, p, { x: -1.2, y: 0.1 }, true)! as MirState;
    r.setState(sim.pointer!.up!(s2, p, { x: -1.2, y: 0.1 })!);
    expect(r.value("p")).toBeCloseTo(1.2, 12);
    expect(r.value("pi")).toBeCloseTo(1 / (1 / 0.4 - 1 / 1.2), 9);
  });

  it("cenários e exercícios produzem números finitos", () => {
    for (const sc of sim.scenarios) {
      const r = new Runner(sim, withOverrides(sim, sc.params));
      for (const v of r.observe()) expect(Number.isFinite(v)).toBe(true);
      expect(sim.liveEquations!(r.state, r.params, r.t).length).toBeGreaterThan(0);
    }
    for (const ex of sim.exercises!) for (let seed = 1; seed <= 5; seed++) expect(Number.isFinite(generateExercise(sim, ex, seed).answer)).toBe(true);
  });
});
