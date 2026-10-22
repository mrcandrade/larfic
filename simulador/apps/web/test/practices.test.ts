import { describe, expect, it } from "vitest";
import { Runner, rng, withOverrides } from "@fisilab/core";
import { analyze, isDerived, measureRow } from "@fisilab/analysis";
import { findSim } from "../src/catalog.ts";
import { plan } from "../src/plan.ts";
import { practices } from "../src/practices.ts";

describe("práticas", () => {
  it("ids únicos e títulos do plano", () => {
    expect(new Set(practices.map((p) => p.id)).size).toBe(practices.length);
    const titles = new Set(plan.map((p) => p.title));
    for (const p of practices) expect(p.extra || titles.has(p.title), p.title).toBe(true);
  });

  for (const p of practices) {
    describe(p.id, () => {
      const sim = findSim(p.sim)!;
      it("aparato e colunas existem", () => {
        expect(sim, p.sim).toBeDefined();
        if (p.scenario) expect(sim.scenarios.some((s) => s.id === p.scenario)).toBe(true);
        const params = new Set(sim.params.map((x) => x.key));
        const obs = new Set(sim.observables.map((x) => x.key));
        for (const k of [...Object.keys(p.params ?? {}), ...(p.locked ?? [])]) expect(params.has(k), k).toBe(true);
        for (const c of p.columns) {
          if (isDerived(c)) continue;
          if ("param" in c.source) expect(params.has(c.source.param), c.source.param).toBe(true);
          if ("observable" in c.source) expect(obs.has(c.source.observable), c.source.observable).toBe(true);
        }
        if (p.analysis) {
          const keys = new Set(p.columns.map((c) => c.key));
          expect(keys.has(p.analysis.x) && keys.has(p.analysis.y)).toBe(true);
        }
      });

      it("um aluno virtual mede e chega a resultados finitos", () => {
        const sc = sim.scenarios.find((s) => s.id === p.scenario);
        const base = { ...(sc?.params ?? {}), ...(p.params ?? {}) } as Record<string, number>;
        const varied = p.columns.find((c) => !isDerived(c) && "param" in c.source && !p.locked?.includes(c.source.param));
        const spec = varied && !isDerived(varied) && "param" in varied.source ? sim.params.find((x) => x.key === (varied.source as { param: string }).param) : undefined;
        const rand = rng(5);
        const rows = Array.from({ length: 6 }, (_, i) => {
          const over = { ...base };
          if (spec) over[spec.key] = spec.min + ((spec.max - spec.min) * (0.35 + 0.1 * i));
          const d = p.demo?.(i);
          Object.assign(over, d?.params ?? {});
          const r = new Runner(sim, withOverrides(sim, over));
          const tEnd = d?.t ?? 3;
          for (let k = 0; k < 200000 && !r.finished && r.t < tEnd - 1e-9; k++) r.stepOnce();
          if (d?.drag) {
            const from = { x: r.value(d.drag.from[0]), y: r.value(d.drag.from[1]) };
            const to = { x: d.drag.to[0], y: d.drag.to[1] };
            let st = sim.pointer?.down?.(r.state, r.params, from) ?? r.state;
            st = sim.pointer?.move?.(st, r.params, to, true) ?? st;
            st = sim.pointer?.up?.(st, r.params, to) ?? st;
            r.state = st;
          }
          return measureRow(p, { params: r.params, t: r.t, value: (k) => r.value(k) }, rand);
        });
        for (const row of rows) for (const c of Object.values(row)) expect(Number.isFinite(c.value)).toBe(true);
        if (p.analysis) for (const r of analyze(p, rows)!.results) {
          expect(Number.isFinite(r.value)).toBe(true);
          if (r.reference !== undefined) expect(Math.abs(r.value / r.reference - 1), `${r.label} = ${r.value}`).toBeLessThan(0.15);
        }
      });
    });
  }
});
