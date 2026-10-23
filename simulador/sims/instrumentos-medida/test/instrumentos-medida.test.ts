import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import { abertura, alvo, instrumentosMedida as sim, micrometer, peca, vernier } from "../src/index.ts";

const P = (o: Record<string, number>) => withOverrides(sim, o);

describe("Paquímetro, micrômetro e densidade", () => {
  it("leitura do nônio de 0,05 mm e do micrômetro", () => {
    expect(vernier(23.35)).toEqual({ main: 23, line: 7, value: expect.closeTo(23.35, 10) });
    expect(vernier(0.96).line).toBe(19);
    expect(vernier(5.0).line).toBe(0);
    const m = micrometer(7.83);
    expect(m.sleeve).toBe(7.5);
    expect(m.drum).toBe(33);
    expect(micrometer(12.49).drum).toBe(49);
  });

  it("o traço k do nônio coincide com um traço inteiro da escala", () => {
    for (const L of [3.05, 17.4, 99.95, 42.65]) {
      const { line } = vernier(L);
      const x = L + line * 1.95;
      expect(Math.abs(x - Math.round(x))).toBeLessThan(1e-9);
    }
  });

  it("volume, massa e densidade do cilindro coerentes", () => {
    const p = P({ peca: 0, amostra: 7, material: 3 });
    const pc = peca(p);
    expect(pc.V).toBeCloseTo((Math.PI * pc.D ** 2 * pc.H) / 4, 9);
    const r = new Runner(sim, p);
    expect(r.value("rho")).toBe(7850);
    expect(r.value("m") / r.value("V")).toBeCloseTo(7850, 9);
    expect(r.value("D")).toBeCloseTo(pc.D / 1000, 12);
  });

  it("amostras diferentes têm dimensões diferentes e reprodutíveis", () => {
    const a = peca(P({ peca: 1, amostra: 2 })), b = peca(P({ peca: 1, amostra: 3 }));
    expect(a.D).not.toBe(b.D);
    expect(peca(P({ peca: 1, amostra: 2 })).D).toBe(a.D);
    expect(a.V).toBeCloseTo((Math.PI * a.D ** 3) / 6, 9);
  });

  it("o instrumento fecha sobre a peça e a escala inclui o erro de zero", () => {
    const p = P({ peca: 2, dimensao: 2, amostra: 4, zero: 0.1 });
    const r = new Runner(sim, p).runToEnd();
    expect(r.finished).toBe(true);
    expect(abertura(1, p)).toBeCloseTo(alvo(p), 12);
    expect(r.value("L") * 1000).toBeCloseTo(peca(p).Di, 9);
    expect(r.value("leitura") * 1000).toBeCloseTo(peca(p).Di + 0.1, 9);
  });
});
