import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import {
  imasBussola as sim,
  axialDipole,
  dipInclination,
  dipoleDeclination,
  geomagneticLatitude,
  magnetField,
  POA,
  type ImasState,
} from "../src/index.ts";

describe("Ímãs, bússola e campo da Terra", () => {
  it("dipolo pontual: campo no eixo = (μ₀/4π)·2m/r³ e no plano equatorial = −(μ₀/4π)·m/r³", () => {
    const g = { x: 0, y: 0, ang: 0 };
    const r = 0.25;
    const [bx, by] = magnetField(g, 1.5, 1, r, 0);
    expect(bx / axialDipole(1.5, r)).toBeCloseTo(1, 2); // amaciamento de 4 mm perto do centro
    expect(by).toBeCloseTo(0, 12);
    const [ex] = magnetField(g, 1.5, 1, 0, r);
    expect(ex / (-1e-7 * 1.5 / r ** 3)).toBeCloseTo(1, 2);
  });

  it("modelo de dois polos tende ao dipolo longe do ímã", () => {
    const g = { x: 0, y: 0, ang: 0.7 };
    const far = magnetField(g, 1, 0, 0.0, 2.0);
    const dip = magnetField(g, 1, 1, 0.0, 2.0);
    expect(far[0] / dip[0]).toBeCloseTo(1, 2);
    expect(far[1] / dip[1]).toBeCloseTo(1, 2);
  });

  it("bússola amortecida para alinhada ao campo local (desvio de Gauss A)", () => {
    // Ímã a leste da bússola, eixo leste–oeste: tan δ = B_ímã/B_Terra
    const p = withOverrides(sim, { vista: 0, arranjo: 0, bussolas: 0, modelo: 1, m: 0.5, BT: 20, gamma: 3 });
    const r = new Runner(sim, p);
    r.setState({ ...r.state, mags: [{ x: 0.2, y: 0, ang: 0 }], comps: [{ x: 0, y: 0, th: Math.PI / 2, w: 0 }] });
    while (r.t < 15) r.stepOnce();
    const Bm = axialDipole(0.5, 0.2);
    const expected = 90 - (Math.atan(Bm / 20e-6) * 180) / Math.PI; // no eixo, B do ímã aponta como m (+x): a agulha gira para leste
    expect(r.value("theta")).toBeCloseTo(expected, 1);
    expect(Math.abs(r.value("desvio"))).toBeLessThan(0.05);
  });

  it("dipolo geocêntrico: tan I = 2 tan λ e a agulha de inclinação chega lá", () => {
    expect(dipInclination(0)).toBeCloseTo(0, 10);
    expect(dipInclination(45)).toBeCloseTo((Math.atan(2) * 180) / Math.PI, 10);
    expect(dipInclination(-30)).toBeCloseTo(-49.1066, 3);
    const r = new Runner(sim, withOverrides(sim, { vista: 1, local: 0, lat: 60, gamma: 3 }));
    while (r.t < 30) r.stepOnce();
    expect(r.value("incl")).toBeCloseTo(dipInclination(60), 1);
  });

  it("Porto Alegre: λm ≈ −21°, I do dipolo ≈ −38° (medido ≈ −36°)", () => {
    const lm = geomagneticLatitude(POA.lat, POA.lon);
    expect(lm).toBeGreaterThan(-23);
    expect(lm).toBeLessThan(-19);
    const I = dipInclination(lm);
    expect(Math.abs(I - -36)).toBeLessThan(4);
    expect(Math.abs(dipoleDeclination(POA.lat, POA.lon))).toBeLessThan(8);
    const r = new Runner(sim, withOverrides(sim, { vista: 1, local: 1 }));
    expect(r.value("latm")).toBeCloseTo(lm, 6);
  });

  it("arrastar e girar o ímã com o ponteiro", () => {
    const p = withOverrides(sim, { vista: 0, arranjo: 0, bussolas: 2 });
    const s0 = sim.init(p);
    const s1 = sim.pointer!.down!(s0, p, { x: 0.01, y: 0 }) as ImasState;
    expect(s1.drag?.kind).toBe("mag");
    const s2 = sim.pointer!.move!(s1, p, { x: 0.11, y: 0.05 }, true) as ImasState;
    expect(s2.mags[0]!.x).toBeCloseTo(0.1, 6);
    expect(s2.mags[0]!.y).toBeCloseTo(0.05, 6);
    const s3 = sim.pointer!.up!(s2, p, { x: 0, y: 0 }) as ImasState;
    // Alça de rotação fica além do polo N
    const h = sim.pointer!.down!(s3, p, { x: 0.1 + 0.066, y: 0.05 }) as ImasState;
    expect(h.drag?.kind).toBe("rot");
    const s4 = sim.pointer!.move!(h, p, { x: 0.1, y: 0.2 }, true) as ImasState;
    expect(s4.mags[0]!.ang).toBeCloseTo(Math.PI / 2, 6);
  });
});
