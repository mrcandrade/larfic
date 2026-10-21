import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import {
  MOON_SYNODIC,
  PLANETS,
  R_EARTH,
  YEAR_DAYS,
  geoLongitude,
  keplerE,
  moonGeo,
  nbodyEnergy,
  nbodyStep,
  orbitPeriod,
  planetPos,
  presetBodies,
  rGeo,
  sistemaSolar as sim,
  synodic,
  v1,
  v2,
} from "../src/index.ts";

const P = (o: Record<string, number>) => withOverrides(sim, o);

describe("sistema solar", () => {
  it("equação de Kepler e 3ª lei dos planetas reais", () => {
    const E = keplerE(1.2, 0.3);
    expect(E - 0.3 * Math.sin(E)).toBeCloseTo(1.2, 12);
    for (const pl of PLANETS) expect(pl.T ** 2 / pl.a ** 3).toBeCloseTo(1, 1);
    // A Terra volta ao mesmo ponto depois de um período
    const a = planetPos(PLANETS[2]!, 0), b = planetPos(PLANETS[2]!, 1);
    expect(b[0]).toBeCloseTo(a[0], 9);
    expect(Math.hypot(...planetPos(PLANETS[3]!, 0.3))).toBeGreaterThan(1.38);
  });

  it("n corpos: Terra completa 1 ano e a energia se conserva (simplético)", () => {
    let bs = presetBodies(0);
    const E0 = nbodyEnergy(bs);
    const y0 = bs[1]!.y;
    let crossed = 0, prev = y0, tCross = 0;
    for (let i = 0; i < 1300; i++) {
      bs = nbodyStep(bs, 0.001);
      const y = bs[1]!.y - bs[0]!.y;
      if (prev < 0 && y >= 0) [crossed, tCross] = [crossed + 1, (i + 1) * 0.001];
      prev = y;
    }
    expect(crossed).toBe(1);
    expect(tCross).toBeCloseTo(1, 2);
    expect(Math.abs(nbodyEnergy(bs) / E0 - 1)).toBeLessThan(1e-6);
  });

  it("período sinódico de Marte ≈ 780 dias e retrogradação perto da oposição", () => {
    const mars = PLANETS[3]!;
    expect(synodic(mars.T) * YEAR_DAYS).toBeCloseTo(780, -1);
    // Procura a oposição (Sol e Marte em lados opostos vistos da Terra) e testa dλ/dt < 0
    let best = 0, bd = Infinity;
    for (let t = 9000; t < 9800; t += 1) {
      const e = planetPos(PLANETS[2]!, t / YEAR_DAYS);
      const sunLon = Math.atan2(-e[1], -e[0]);
      let dd = Math.abs(geoLongitude(mars, t / YEAR_DAYS) - sunLon - Math.PI) % (2 * Math.PI);
      dd = Math.min(dd, 2 * Math.PI - dd);
      if (dd < bd) [bd, best] = [dd, t];
    }
    let dl = geoLongitude(mars, (best + 1) / YEAR_DAYS) - geoLongitude(mars, (best - 1) / YEAR_DAYS);
    if (dl > Math.PI) dl -= 2 * Math.PI;
    expect(dl).toBeLessThan(0);
  });

  it("fases da Lua: cheia após meio mês sinódico; eclipse só perto dos nodos", () => {
    expect(MOON_SYNODIC).toBeCloseTo(29.53, 2);
    expect(moonGeo(MOON_SYNODIC / 2, 90).k).toBeGreaterThan(0.99);
    expect(moonGeo(0, 0).sep * (180 / Math.PI)).toBeLessThan(1.5);
    // Um mês sinódico depois a Lua passa ~30° além do nodo (mês dracônico de 27,2 d): β ≈ 2,6°.
    expect(moonGeo(MOON_SYNODIC, 0).sep * (180 / Math.PI)).toBeGreaterThan(1.5);
    // Com o nodo a 90° do Sol, a lua nova passa a ~5° do Sol: sem eclipse.
    expect(moonGeo(0, 90).sep * (180 / Math.PI)).toBeCloseTo(5.145, 2);
  });

  it("canhão de Newton: v₁ mantém órbita circular, v₂ escapa", () => {
    const h = 200e3;
    expect(v1(h) / 1e3).toBeCloseTo(7.784, 2);
    expect(v2(h) / v1(h)).toBeCloseTo(Math.SQRT2, 10);
    const r = new Runner(sim, P({ modo: 4, h: 200, v: v1(h) / 1e3 }));
    for (let i = 0; i < 300; i++) {
      r.stepOnce();
      expect(r.value("alt")).toBeCloseTo(200, 0);
    }
    const low = new Runner(sim, P({ modo: 4, h: 200, v: 5 }));
    for (let i = 0; i < 3000 && !low.state.hit; i++) low.stepOnce();
    expect(low.state.hit).toBe(true);
    expect(Math.hypot(low.state.y[0]!, low.state.y[1]!)).toBeCloseTo(R_EARTH, 0);
  });

  it("geoestacionário: r = 42 164 km, T = dia sideral e deriva nula", () => {
    expect(rGeo() / 1e3).toBeCloseTo(42164, -1);
    expect(orbitPeriod(rGeo())).toBeCloseTo(86164.1, 0);
    const r = new Runner(sim, P({ modo: 5, rsat: rGeo() / 1e3 }));
    for (let i = 0; i < 300; i++) r.stepOnce();
    expect(Math.abs(r.value("deriva"))).toBeLessThan(1e-3);
  });
});
