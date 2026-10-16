import { describe, expect, it } from "vitest";
import { Runner, generateExercise, lightTheme, withOverrides } from "@fisilab/core";
import { catalog, unknownCovers } from "../src/catalog.ts";

/** Contexto 2D falso: aceita qualquer chamada e mede texto com largura fixa. */
function fakeCtx(): CanvasRenderingContext2D {
  const target: Record<string, unknown> = { measureText: (s: string) => ({ width: s.length * 6 }) };
  return new Proxy(target, {
    get: (t, k: string) => (k in t ? t[k] : () => undefined),
    set: (t, k: string, v) => ((t[k] = v), true),
  }) as unknown as CanvasRenderingContext2D;
}

describe("catálogo", () => {
  it("todos os títulos de `covers` existem no plano", () => {
    expect(unknownCovers()).toEqual([]);
  });

  it("ids são únicos", () => {
    const ids = catalog.map((c) => c.sim.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  for (const { sim } of catalog) {
    describe(sim.id, () => {
      const scenarios = sim.scenarios.length ? sim.scenarios : [{ id: "padrão", params: {} }];
      for (const sc of scenarios) {
        it(`cenário "${sc.id}" roda e desenha sem NaN`, () => {
          const r = new Runner(sim, withOverrides(sim, sc.params));
          for (let i = 0; i < 300 && !r.finished; i++) r.stepOnce();
          for (const v of r.observe()) expect(Number.isFinite(v)).toBe(true);
          const vp = sim.viewport(r.params, r.state);
          expect(vp.xMax).toBeGreaterThan(vp.xMin);
          expect(vp.yMax).toBeGreaterThan(vp.yMin);
          sim.render(fakeCtx(), { state: r.state, params: r.params, t: r.t, trail: r.samples.map((s) => s.state), scale: 40, theme: lightTheme });
          sim.liveEquations?.(r.state, r.params, r.t);
        });
      }
      for (const ex of sim.exercises ?? []) {
        it(`exercício "${ex.id}" gera resposta finita`, () => {
          for (let seed = 1; seed <= 5; seed++) {
            const inst = generateExercise(sim, ex, seed);
            expect(Number.isFinite(inst.answer)).toBe(true);
            expect(inst.prompt).not.toMatch(/\{\w+\}/);
          }
        });
      }
    });
  }
});
