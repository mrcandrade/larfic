import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import { algSig, comAS, estatistica, lerRegua, medidasErros as sim, operacoes, queda, sigmaPropagada, tempoDeQueda } from "../src/index.ts";

describe("Medidas e erros", () => {
  it("tempo de reação: t = √(2d/g) e leitura arredondada", () => {
    expect(tempoDeQueda(queda(0.2))).toBeCloseTo(0.2, 12);
    expect(tempoDeQueda(0.2)).toBeCloseTo(Math.sqrt(0.4 / 9.81), 12);
    expect(lerRegua(0.1964, 0.01)).toBeCloseTo(0.2, 12);
    expect(lerRegua(0.1964, 0.001)).toBeCloseTo(0.196, 12);
  });

  it("clique do aluno: pega a régua na distância percorrida desde a soltura", () => {
    const p = withOverrides(sim, { modo: 0, quem: 0, resolucao: 0.001 });
    const r = new Runner(sim, p);
    // clicar antes da soltura queima a largada
    const queimou = sim.pointer!.down!(r.state, p, { x: 5, y: 5 })!;
    expect(queimou.fase).toBe(4);
    while (r.state.fase === 0) r.stepOnce();
    const tRel = r.state.tRel;
    while (r.state.clock < tRel + 0.18) r.stepOnce();
    const s = sim.pointer!.down!(r.state, p, { x: 5, y: 5 })!;
    expect(s.fase).toBe(2);
    expect(s.ds[0]).toBeCloseTo(lerRegua(queda(s.clock - tRel), 0.001), 12);
    expect(s.ts[0]).toBeCloseTo(s.clock - tRel, 2);
  });

  it("aluno virtual: média e desvio convergem para os parâmetros", () => {
    const r = new Runner(sim, withOverrides(sim, { modo: 0, quem: 1, tReacao: 0.2, sigReacao: 0.02, resolucao: 0.001, Lregua: 1 }));
    while (r.state.ts.length < 60) r.stepOnce();
    const st = estatistica(r.state.ts);
    expect(st.media).toBeGreaterThan(0.2 - 4 * 0.02 / Math.sqrt(60) - 0.003);
    expect(st.media).toBeLessThan(0.2 + 4 * 0.02 / Math.sqrt(60) + 0.003);
    expect(st.desvio).toBeGreaterThan(0.012);
    expect(st.desvio).toBeLessThan(0.03);
    expect(r.value("trErr")).toBeCloseTo(st.desvio / Math.sqrt(st.n), 12);
  });

  it("algarismos significativos: contagem, arredondamento e operações", () => {
    expect(algSig("0,0450")).toBe(3);
    expect(algSig("12,30")).toBe(4);
    expect(comAS(56.58, 2)).toBe("57");
    expect(comAS(0.012345, 3)).toBe("0,0123");
    expect(comAS(1234, 2)).toBe("1,2 × 10^3");
    const o = operacoes(12.34, 4.61, 1); // régua de 1 cm: uma casa decimal
    expect(o.L).toBe("12,3");
    expect(o.W).toBe("4,6");
    expect(o.area).toBe("57");
    expect(o.perimetro).toBe("33,8");
    expect(operacoes(12.344, 4.611, 0.1).area).toBe("56,9") // 4 AS × 3 AS → 3 AS;
  });

  it("dardos: centroide converge para mira + erro sistemático", () => {
    const r = new Runner(sim, withOverrides(sim, { modo: 2, sistematico: 4, aleatorio: 1, nDardos: 200 }));
    while (r.state.dardos.length < 200) r.stepOnce();
    expect(r.value("vies")).toBeCloseTo(4, 0);
    expect(r.value("disp")).toBeGreaterThan(0.85);
    expect(r.value("disp")).toBeLessThan(1.15);
  });

  it("Monte Carlo concorda com a propagação linear (produto e pêndulo)", () => {
    for (const [op, A, sA, B, sB] of [
      [2, 10, 0.2, 5, 0.1],
      [5, 1, 0.005, 2.006, 0.01],
    ] as const) {
      const r = new Runner(sim, withOverrides(sim, { modo: 3, op, A, sA, B, sB, N: 20000 }));
      while (r.state.nMC < 20000) r.stepOnce();
      const s = sigmaPropagada(op, A, sA, B, sB);
      expect(Math.abs(r.value("sMC") - s) / s).toBeLessThan(0.03);
    }
    expect(sigmaPropagada(2, 10, 0.2, 5, 0.1)).toBeCloseTo(50 * Math.hypot(0.02, 0.02), 12);
  });

  it("arrastar o marcador L muda a leitura", () => {
    const p = withOverrides(sim, { modo: 1, regua: 2 });
    let s = sim.init(p);
    s = sim.pointer!.down!(s, p, { x: 15, y: 3 })!;
    s = sim.pointer!.move!(s, p, { x: 9.876, y: 3 }, true)!;
    expect(sim.observables.find((o) => o.key === "L")!.value(s, p, 0)).toBeCloseTo(9.88, 12);
  });
});
