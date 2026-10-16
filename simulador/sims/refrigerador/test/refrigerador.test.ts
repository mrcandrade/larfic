import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import { FLUIDS, Psat, T0, Tsat, along, buildCycle, hFromSP, hf, hg, props, refrigerador as sim, sg } from "../src/index.ts";

describe("refrigerador por compressão de vapor", () => {
  it("o modelo do R-134a reproduz a tabela de saturação (IIR) com erro de poucos por cento", () => {
    const f = FLUIDS[0]!;
    // Tabela: −10 °C → 200,6 kPa, h_g = 392,3 kJ/kg; 40 °C → 1016,6 kPa, h_f = 256,4 kJ/kg.
    expect(Psat(f, T0 - 10) / 200.6e3).toBeCloseTo(1, 1);
    expect(Psat(f, T0 + 40) / 1016.6e3).toBeCloseTo(1, 2);
    expect(hg(f, T0 - 10) / 392.3e3).toBeCloseTo(1, 2);
    expect(hf(f, T0 + 40) / 256.4e3).toBeCloseTo(1, 2);
    expect(sg(f, T0 - 10) / 1733.4).toBeCloseTo(1, 2);
    // T_sat inverte P_sat.
    expect(Tsat(f, Psat(f, 300))).toBeCloseTo(300, 9);
  });

  it("balanço de energia, COP_BC = COP_R + 1 e COP abaixo de Carnot", () => {
    for (const fluido of [0, 1, 2]) {
      for (const [TL, TH] of [[4, 25], [-20, 35], [10, 20]] as const) {
        const c = buildCycle(withOverrides(sim, { fluido, TL, TH }));
        expect(c.qH).toBeCloseTo(c.qL + c.w, 6);
        expect(c.copHP).toBeCloseTo(c.copR + 1, 10);
        expect(c.copR).toBeGreaterThan(1);
        expect(c.copR).toBeLessThan(c.carnotInt);
        expect(c.carnotInt).toBeLessThan(c.carnotR);
        expect(c.carnotHP).toBeCloseTo(c.carnotR + 1, 10);
      }
    }
    // Ciclo ideal sem perdas nos trocadores: COP próximo (mas abaixo) de Carnot.
    const ideal = buildCycle(withOverrides(sim, { TL: 4, TH: 25, dT: 0, eta: 1, sh: 0, sc: 0 }));
    expect(ideal.copR / ideal.carnotR).toBeGreaterThan(0.8);
    expect(ideal.copR / ideal.carnotR).toBeLessThan(1);
  });

  it("compressão isentrópica, válvula isentálpica e estados nas linhas de saturação", () => {
    const c = buildCycle(withOverrides(sim, { eta: 1, sh: 0, sc: 0 }));
    const f = c.f;
    // 2s tem a mesma entropia de 1.
    expect(props(f, c.h2s, c.Pk).s).toBeCloseTo(c.s1, 6);
    expect(hFromSP(f, c.s1, c.Pe)).toBeCloseTo(c.h1, 6);
    // 1 é vapor saturado e 3 é líquido saturado; 4 é mistura com título entre 0 e 1.
    expect(props(f, c.h1, c.Pe).x).toBeCloseTo(1, 9);
    expect(props(f, c.h3, c.Pk).x).toBe(0);
    const x4 = props(f, c.h4, c.Pe).x;
    expect(x4).toBeGreaterThan(0.05);
    expect(x4).toBeLessThan(0.5);
    // A válvula gera entropia (processo irreversível).
    expect(props(f, c.h4, c.Pe).s).toBeGreaterThan(props(f, c.h3, c.Pk).s);
    // O caminho fecha: u = 0 e u = 4 dão o mesmo estado.
    expect(along(c, 3.999999).h).toBeCloseTo(along(c, 0).h, 0);
  });

  it("piorar o compressor ou aumentar ΔT nos trocadores reduz o COP; a animação percorre o ciclo", () => {
    const base = buildCycle(withOverrides(sim, {})).copR;
    expect(buildCycle(withOverrides(sim, { eta: 0.6 })).copR).toBeLessThan(base);
    expect(buildCycle(withOverrides(sim, { dT: 15 })).copR).toBeLessThan(base);
    expect(buildCycle(withOverrides(sim, { TL: -25 })).copR).toBeLessThan(base);
    const r = new Runner(sim, withOverrides(sim, { periodo: 4 }));
    let hmax = 0;
    for (let i = 0; i < 400; i++) {
      r.stepOnce();
      hmax = Math.max(hmax, r.value("h"));
    }
    expect(hmax).toBeCloseTo(buildCycle(r.params).h2 / 1000, 0);
  });
});
