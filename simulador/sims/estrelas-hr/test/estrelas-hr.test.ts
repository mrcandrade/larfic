import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import {
  estrelasHr as sim, STARS, T_SUN, altAz, bvFromT, greatCircle, lst, msLifetime, radiusOf, spectralClass, starAltAz, track, trackAt, wdMass, zamsL, zamsT,
} from "../src/index.ts";

describe("Estrelas, HR e céu", () => {
  it("L = R²T⁴: raios de estrelas reais", () => {
    const S = (n: string) => STARS.find((s) => s.name === n)!;
    expect(radiusOf(1, T_SUN)).toBeCloseTo(1, 12);
    expect(radiusOf(S("Betelgeuse").L, S("Betelgeuse").T)).toBeGreaterThan(800);
    expect(radiusOf(S("Sírius B").L, S("Sírius B").T)).toBeLessThan(0.02);
    expect(spectralClass(T_SUN)[0]).toBe("G");
    expect(spectralClass(3500)[0]).toBe("M");
    expect(spectralClass(25000)[0]).toBe("B");
    expect(bvFromT(T_SUN)).toBeCloseTo(0.65, 1);
  });

  it("evolução: ZAMS do Sol, tempo de vida ∝ M^−2,5 e destinos", () => {
    expect(zamsL(1)).toBe(1);
    expect(zamsT(1)).toBeCloseTo(T_SUN, 6);
    expect(msLifetime(1)).toBe(1e10);
    expect(msLifetime(10) / msLifetime(1)).toBeCloseTo(10 ** -2.5, 9);
    const sun = track(1);
    expect(Math.max(...sun.map((n) => radiusOf(n.L, n.T)))).toBeGreaterThan(100); // gigante vermelha
    const end = sun[sun.length - 1]!;
    expect(radiusOf(end.L, end.T)).toBeLessThan(0.02); // anã branca
    expect(wdMass(1)).toBeCloseTo(0.503, 3);
    expect(track(15)[4]!.phase).toMatch(/nêutrons/);
    expect(track(30)[4]!.phase).toMatch(/buraco negro/);
    // o runner percorre a trajetória e para no último nó
    const r = new Runner(sim, withOverrides(sim, { modo: 1, M: 1 }));
    for (let i = 0; i < 3000; i++) r.stepOnce();
    expect(r.state.u).toBe(sun.length - 1);
    expect(r.value("idade")).toBeGreaterThan(10);
    expect(trackAt(1, 0.5).age).toBeCloseTo(0.5e10, -6);
  });

  it("esfera celeste: polo sul a |φ|, culminação 90° − |φ − δ| e Cruzeiro circumpolar em φ = −35°", () => {
    expect(altAz(0, -90, -23.5, 123).alt).toBeCloseTo(23.5, 9);
    // Sírius na passagem meridiana (TSL = α)
    const sir = altAz(6.752, -16.72, -23.5, 6.752 * 15);
    expect(sir.alt).toBeCloseTo(90 - Math.abs(-23.5 + 16.72), 9);
    for (let h = 0; h < 24; h += 0.5) expect(altAz(12.443, -63.1, -35, h * 15).alt).toBeGreaterThan(0);
    expect(Math.min(...Array.from({ length: 48 }, (_, i) => altAz(12.443, -63.1, -15, i * 7.5).alt))).toBeLessThan(0);
    // o céu gira 15° por hora sideral (≈ 15,04° por hora solar)
    expect((lst(100, 13) - lst(100, 12) + 360) % 360).toBeCloseTo(15.04, 1);
    // em julho, 21 h em São Paulo, Antares está alto no céu
    const r = new Runner(sim, withOverrides(sim, { modo: 3, dia: 196, hora: 21, lat: -23.5 }));
    expect(starAltAz("Antares", r.state, r.params).alt).toBeGreaterThan(60);
  });

  it("globo: distâncias de grande círculo e comprimento do paralelo", () => {
    expect(greatCircle(0, 0, 0, 90)).toBeCloseTo((Math.PI / 2) * 6371, 6);
    expect(greatCircle(-90, 0, 90, 0)).toBeCloseTo(Math.PI * 6371, 6);
    const sp = greatCircle(-23.5, -46.6, 51.5, 0);
    expect(sp).toBeGreaterThan(9400);
    expect(sp).toBeLessThan(9600);
    const r = new Runner(sim, withOverrides(sim, { modo: 4, lat: 60 }));
    expect(r.value("paralelo")).toBeCloseTo(Math.PI * 6371, 3);
  });

  it("ponteiro: arrastar o cursor no HR muda o raio calculado", () => {
    const p = withOverrides(sim, { modo: 0 });
    const r = new Runner(sim, p);
    const s1 = sim.pointer!.down!(r.state, p, { x: 5, y: 5 })!;
    expect(s1.sel).toBe(-1);
    expect(r.sim.observables.find((o) => o.key === "R")!.value(s1, p, 0)).toBeCloseTo(radiusOf(s1.cur[1], s1.cur[0]), 9);
  });
});
