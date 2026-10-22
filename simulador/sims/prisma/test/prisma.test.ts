import { describe, expect, it } from "vitest";
import { Runner, generateExercise, withOverrides } from "@fisilab/core";
import {
  MATERIALS,
  bowAngle,
  deg,
  minDeviation,
  minDeviationIncidence,
  nOf,
  prisma as sim,
  prismDeviation,
  rad,
  rainbowAngle,
  sellmeier,
  sourceAt,
  traceDrop,
  tracePrism,
  type PrismState,
} from "../src/index.ts";

const water = MATERIALS[3]!;

describe("Prisma, dispersão e arco-íris", () => {
  it("Sellmeier: BK7 n_d = 1,5168, água n = 1,333 e dispersão normal", () => {
    expect(sellmeier(MATERIALS[0]!, 587.56)).toBeCloseTo(1.5168, 4);
    expect(sellmeier(water, 589.3)).toBeCloseTo(1.333, 3);
    for (const m of MATERIALS) expect(sellmeier(m, 400)).toBeGreaterThan(sellmeier(m, 700));
  });

  it("o raio traçado pelo prisma tem o desvio da fórmula e é mínimo no caminho simétrico", () => {
    const p = withOverrides(sim, { modo: 0, A: 60, material: 1 });
    const A = rad(60);
    const n = nOf(p, 589);
    const base = sim.init(p);
    for (const th of [40, 50, 60, 75]) {
      const s: PrismState = { ...base, ...sourceAt(p, rad(th)) };
      const r = tracePrism(s, p, 589);
      expect(r.thi).toBeCloseTo(th, 6);
      expect(r.dev).toBeCloseTo(deg(prismDeviation(n, A, rad(th))), 6);
    }
    const thm = minDeviationIncidence(n, A);
    const dm = tracePrism({ ...base, ...sourceAt(p, thm) }, p, 589).dev;
    expect(dm).toBeCloseTo(deg(minDeviation(n, A)), 6);
    for (const dth of [-3, 3]) expect(tracePrism({ ...base, ...sourceAt(p, thm + rad(dth)) }, p, 589).dev).toBeGreaterThan(dm);
    // o violeta desvia mais que o vermelho
    expect(tracePrism(base, p, 400).dev).toBeGreaterThan(tracePrism(base, p, 700).dev + 1);
  });

  it("arco-íris: primário ≈ 42° (vermelho por fora) e secundário ≈ 51°, como extremos de φ(b)", () => {
    const nr = sellmeier(water, 700);
    const nv = sellmeier(water, 400);
    expect(deg(rainbowAngle(nr, 1))).toBeCloseTo(42.3, 0);
    expect(deg(rainbowAngle(nv, 1))).toBeCloseTo(40.6, 0);
    expect(deg(rainbowAngle(nr, 2))).toBeGreaterThan(50);
    expect(deg(rainbowAngle(nv, 2))).toBeGreaterThan(deg(rainbowAngle(nr, 2)));
    expect(deg(rainbowAngle(nv, 2))).toBeLessThan(54.5);
    // o ângulo do arco é o máximo (k = 1) ou mínimo (k = 2) de φ(b)
    let mx = 0;
    let mn = Infinity;
    for (let b = 0; b <= 1; b += 1e-4) {
      mx = Math.max(mx, bowAngle(nr, b, 1));
      mn = Math.min(mn, bowAngle(nr, b, 2));
    }
    expect(mx).toBeCloseTo(rainbowAngle(nr, 1), 6);
    expect(mn).toBeCloseTo(rainbowAngle(nr, 2), 6);
  });

  it("raios traçados na gota saem com o ângulo analítico para 1 e 2 reflexões internas", () => {
    const p = withOverrides(sim, { modo: 1, material: 3 });
    const n = nOf(p, 650);
    for (const b of [0.3, 0.86, 0.95]) {
      const segs = traceDrop(p, 650, b);
      for (const k of [1, 2]) {
        const g = segs.find((x) => x.refr === 2 && x.refl === k)!;
        const dir: [number, number] = [g.b[0] - g.a[0], g.b[1] - g.a[1]];
        const phi = Math.acos(-dir[0] / Math.hypot(dir[0], dir[1]));
        expect(phi).toBeCloseTo(bowAngle(n, b, k), 8);
      }
      // a intensidade do secundário é menor que a do primário
      const I1 = segs.find((x) => x.refr === 2 && x.refl === 1)!.I;
      const I2 = segs.find((x) => x.refr === 2 && x.refl === 2)!.I;
      expect(I2).toBeLessThan(I1);
    }
  });

  it("arrastar a altura do raio na gota grava o desvio", () => {
    const p = withOverrides(sim, { modo: 1, material: 3, feixe: 0 });
    const r = new Runner(sim, p);
    let s = sim.pointer!.down!(r.state, p, { x: -2.9, y: r.state.b })!;
    expect(s.drag).toBe("b");
    s = sim.pointer!.move!(s, p, { x: -2.9, y: 0.5 }, true)!;
    r.setState(sim.pointer!.up!(s, p, { x: 0, y: 0 })!);
    expect(r.value("thi")).toBeCloseTo(30, 6);
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
