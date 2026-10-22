import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import {
  fotometria as sim, SOURCES, I0, KM, Vphot, Vscot, bunsen, bunsenBalance, coneFlux, efficacy, illuminance, intensity, meterReading, solidAngle,
} from "../src/index.ts";

describe("Fotometria", () => {
  it("inverso do quadrado e cosseno: E = I cos θ / r²", () => {
    const src = SOURCES[0]!;
    const I = I0(src);
    expect(I).toBeCloseTo(710 / (4 * Math.PI), 6);
    const a = illuminance(src, 0, 2, 0, 0, 0).E;
    const b = illuminance(src, 0, 4, 0, 0, 0).E;
    expect(a).toBeCloseTo(I / 4, 6);
    expect(a / b).toBeCloseTo(4, 9);
    // ponto no chão a 1,5 m da vertical, lâmpada a 2 m: E = I h / (h² + x²)^(3/2)
    expect(illuminance(src, 0, 2, 1.5, 0, 0).E).toBeCloseTo((I * 2) / (4 + 2.25) ** 1.5, 9);
    // sensor perpendicular aos raios não recebe luz
    expect(illuminance(src, 0, 2, 0, 0, Math.PI / 2).E).toBeCloseTo(0, 9);
  });

  it("fluxo de fontes direcionais: ∫ I dΩ devolve o fluxo total e o cone isotrópico vale IΩ", () => {
    for (const src of SOURCES.slice(0, 4)) {
      const total = coneFlux(src, src.n < 0 ? Math.PI : Math.PI / 2, 2000);
      expect(total).toBeCloseTo(src.phi, 3);
    }
    const iso = SOURCES[0]!;
    expect(coneFlux(iso, 0.5)).toBeCloseTo(I0(iso) * solidAngle(0.5), 6);
    const spot = SOURCES[2]!;
    expect(intensity(spot, Math.PI / 3)).toBeLessThan(1e-5 * I0(spot));
  });

  it("Sol: cosseno puro, independente da distância", () => {
    const r = new Runner(sim, withOverrides(sim, { modo: 0, fonte: 4, elev: 30 }));
    expect(meterReading(r.state, r.params).E).toBeCloseTo(100000 * Math.sin(Math.PI / 6), 3);
  });

  it("V(λ): 683 lm/W em 555 nm, pico escotópico perto de 507 nm, corpo negro e LED", () => {
    expect(KM * Vphot(555)).toBeGreaterThan(675);
    expect(Vphot(555)).toBeLessThan(1.02);
    let best = 0, lb = 0;
    for (let nm = 450; nm <= 600; nm++) if (Vscot(nm) > best) { best = Vscot(nm); lb = nm; }
    expect(lb).toBe(507);
    const inc = efficacy(1, 555, 2800);
    expect(inc).toBeGreaterThan(10);
    expect(inc).toBeLessThan(20);
    const sun = efficacy(1, 555, 5800);
    expect(sun).toBeGreaterThan(80);
    expect(sun).toBeLessThan(105);
    const led = efficacy(2, 555, 0);
    expect(led).toBeGreaterThan(250);
    expect(led).toBeLessThan(380);
  });

  it("Bunsen: a mancha some (contraste zero) em x = D√I₁/(√I₁+√I₂)", () => {
    const x = bunsenBalance(20, 80, 2);
    expect(x).toBeCloseTo(2 / 3, 9);
    const b = bunsen(20, 80, 2, x);
    expect(b.EL).toBeCloseTo(b.ER, 9);
    expect(b.contrast).toBeCloseTo(0, 9);
    expect(bunsen(20, 80, 2, 0.4).contrast).toBeLessThan(0); // lado 1 mais iluminado: mancha escura
  });

  it("ponteiro: arrastar o luxímetro muda a leitura", () => {
    const p = withOverrides(sim, { modo: 0, fonte: 0 });
    const r = new Runner(sim, p);
    const s0 = r.state;
    const d = sim.pointer!.down!(s0, p, { x: 0.3 + 2.5 * s0.meter[0], y: 0.8 + 2.5 * s0.meter[1] })!;
    expect(d.drag).toBe("meter");
    const s1 = sim.pointer!.move!(d, p, { x: 0.3 + 2.5 * 1.2, y: 0.8 + 2.5 * 1.6 }, true)!;
    expect(meterReading(s1, p).E).toBeCloseTo(I0(SOURCES[0]!) / 1, 6);
  });
});
