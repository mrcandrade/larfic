import { describe, expect, it } from "vitest";
import { EPS0, withOverrides } from "@fisilab/core";
import {
  condutoresBlindagem as sim,
  ELETRODO_N,
  ELETRODO_P,
  emptyMask,
  fieldOf,
  fillWhere,
  H,
  ISOLADO,
  NX,
  nodeX,
  nodeY,
  sceneMask,
  solveConductors,
  tipRatio,
} from "../src/index.ts";

describe("Condutores, blindagem e poder das pontas", () => {
  it("placas de altura total: campo uniforme V/d (solução linear exata)", () => {
    const m = emptyMask();
    fillWhere(m, ELETRODO_P, (x) => Math.abs(x + 3) < 0.05);
    fillWhere(m, ELETRODO_N, (x) => Math.abs(x - 3) < 0.05);
    // Borda com V = −E₀x coerente com as placas: E₀ = V/d.
    const sol = solveConductors({ mask: m, E0: 600 / 6, V: 600, Q: 0 }, { warmStart: false });
    expect(sol.converged).toBe(true);
    const E = fieldOf(sol, 0.33, 0.47);
    expect(E[0]).toBeCloseTo(100, 3);
    expect(Math.abs(E[1])).toBeLessThan(1e-3);
    // Carga por unidade de comprimento na placa + : σ = ε₀E em toda a altura interna.
    const plus = sol.comps.find((c) => c.V > 0)!;
    const inner = plus.surface.filter((e) => e.n[0] > 0.9 && Math.abs(nodeY(Math.floor(e.k / NX))) < 2);
    for (const e of inner) expect(e.sigma / (EPS0 * 100)).toBeCloseTo(1, 3);
  });

  it("gaiola de Faraday: campo nulo dentro do anel neutro, carga total zero", () => {
    const sol = solveConductors({ mask: sceneMask(0), E0: 100, V: 0, Q: 0 }, { warmStart: false });
    expect(sol.converged).toBe(true);
    for (const [x, y] of [[0, 0], [0.6, 0.3], [-0.5, -0.6]] as const) {
      const E = fieldOf(sol, x, y);
      expect(Math.hypot(E[0], E[1])).toBeLessThan(0.1);
    }
    const ring = sol.comps[0]!;
    expect(Math.abs(ring.Q)).toBeLessThan(1e-6 * EPS0 * 100 * 8);
    // Lado esquerdo (por onde o campo entra) negativo; direito positivo.
    const left = ring.surface.filter((e) => nodeX(e.k % NX) < -1.35);
    const right = ring.surface.filter((e) => nodeX(e.k % NX) > 1.35);
    expect(left.every((e) => e.sigma < 0)).toBe(true);
    expect(right.every((e) => e.sigma > 0)).toBe(true);
  });

  it("cilindro neutro em campo uniforme: σ ≈ 2ε₀E₀ cos θ (analítico 2D)", () => {
    const m = emptyMask();
    fillWhere(m, ISOLADO, (x, y) => Math.hypot(x, y) <= 0.8);
    const sol = solveConductors({ mask: m, E0: 100, V: 0, Q: 0 }, { warmStart: false });
    const c = sol.comps[0]!;
    // Nó mais à direita, no eixo: σ ≈ +2ε₀E₀ (a grade em escada e as paredes dão ~15 %).
    const tip = c.surface.reduce((a, e) => (nodeX(e.k % NX) > nodeX(a.k % NX) ? e : a));
    expect(tip.sigma / (2 * EPS0 * 100)).toBeGreaterThan(0.8);
    expect(tip.sigma / (2 * EPS0 * 100)).toBeLessThan(1.35);
    // Ao longo de todo o contorno o fluxo total soma zero.
    expect(Math.abs(c.Q)).toBeLessThan(1e-3 * 2 * EPS0 * 100 * H);
  });

  it("condutor isolado carregado: carga pelo fluxo igual à prescrita e mais σ na ponta", () => {
    const Q = 3e-9;
    const sol = solveConductors({ mask: sceneMask(1), E0: 0, V: 0, Q }, { warmStart: false });
    const c = sol.comps[0]!;
    expect(c.Q / Q).toBeCloseTo(1, 4);
    const tip = c.surface.reduce((a, e) => (nodeX(e.k % NX) > nodeX(a.k % NX) ? e : a));
    const back = c.surface.reduce((a, e) => (nodeX(e.k % NX) < nodeX(a.k % NX) ? e : a));
    expect(tip.sigma).toBeGreaterThan(2 * back.sigma);
    expect(tipRatio(sol)).toBeGreaterThan(2);
  });

  it("cenários renderizam via sim (sonda dentro da gaiola)", () => {
    const p = withOverrides(sim, sim.scenarios[0]!.params);
    const s = sim.init(p);
    const E = sim.observables.find((o) => o.key === "E")!.value(s, p, 0);
    expect(E).toBeLessThan(0.1);
  });
});
