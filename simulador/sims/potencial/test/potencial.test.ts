import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import { COAX, NX, fieldAtPt, gridFieldLines, potAt, potencial as sim, type PotState } from "../src/index.ts";

const make = (over: Record<string, number>) => {
  const p = withOverrides(sim, over);
  return { p, s: sim.init(p) };
};

describe("Potencial e equipotenciais", () => {
  it("placas paralelas com borda isolada: V linear entre as placas e E = ΔV/d", () => {
    const { s } = make({ montagem: 0, V0: 10, borda: 1 });
    // Placas em x = ±0,4 m a ±10 V: no meio, V(x) = −25·x e E = 25 V/m
    expect(potAt(s, -0.2, 0)).toBeCloseTo(5, 1);
    expect(potAt(s, 0.1, 0)).toBeCloseTo(-2.5, 1);
    const [ex, ey] = fieldAtPt(s, 0, 0);
    expect(ex).toBeCloseTo(25, 0);
    expect(Math.abs(ey)).toBeLessThan(0.05);
  });

  it("cabo coaxial: V(r) = V0 ln(r/b)/ln(a/b) dentro de 2%", () => {
    const { s } = make({ montagem: 2, V0: 10 });
    for (const r of [0.2, 0.3, 0.45]) {
      const exact = (10 * Math.log(r / COAX.b)) / Math.log(COAX.a / COAX.b);
      for (const ang of [0, Math.PI / 4, 2]) {
        expect(Math.abs(potAt(s, r * Math.cos(ang), r * Math.sin(ang)) - exact)).toBeLessThan(0.02 * 10);
      }
    }
  });

  it("voltímetro e energia: ΔV = V_A − V_B e U = qV", () => {
    const r = new Runner(sim, withOverrides(sim, { montagem: 1, q: 3 }));
    const s = r.state;
    expect(r.value("dV")).toBeCloseTo(potAt(s, s.A.x, s.A.y) - potAt(s, s.B.x, s.B.y), 12);
    expect(r.value("U")).toBeCloseTo(3 * potAt(s, s.q.x, s.q.y), 12);
    // Simetria da montagem ±V0: no plano mediano o potencial é zero.
    expect(Math.abs(potAt(s, 0, 0.3))).toBeLessThan(1e-6);
  });

  it("pintar um eletrodo pelo ponteiro fixa o potencial e o solver relaxa o resto", () => {
    const { p, s } = make({ montagem: 4, Vp: 8, raio: 0.06 });
    expect(s.V.every((v) => v === 0)).toBe(true);
    let st = sim.pointer!.down!(s, p, { x: 0, y: 0 }) as PotState;
    st = sim.pointer!.move!(st, p, { x: 0.05, y: 0 }, true) ?? st;
    st = sim.pointer!.up!(st, p, { x: 0.05, y: 0 }) as PotState;
    expect(potAt(st, 0, 0)).toBeCloseTo(8, 9);
    const c = 40 + 30 * NX;
    expect(st.fixed[c]).toBe(8);
    // Fora do eletrodo, 0 < V < 8 e decresce para a borda aterrada.
    const v1 = potAt(st, 0.3, 0);
    const v2 = potAt(st, 0.7, 0);
    expect(v1).toBeGreaterThan(v2);
    expect(v2).toBeGreaterThan(0);
    expect(v1).toBeLessThan(8);
    // Laplaciano discreto nulo num nó livre
    const k = 60 + 30 * NX;
    const lap = st.V[k + 1]! + st.V[k - 1]! + st.V[k + NX]! + st.V[k - NX]! - 4 * st.V[k]!;
    expect(Math.abs(lap)).toBeLessThan(1e-4);
  });

  it("blindagem: dentro de um anel condutor aterrado o campo é nulo", () => {
    const { p, s } = make({ montagem: 0, V0: 10 });
    // Desenha um anel aterrado em volta de (0, 0)
    const fixed = s.fixed.slice();
    for (let j = 0; j < 61; j++)
      for (let i = 0; i < NX; i++) {
        const r = Math.hypot(-1 + i * 0.025, -0.75 + j * 0.025);
        if (r >= 0.2 && r <= 0.23) fixed[i + j * NX] = 0;
      }
    const inv = sim.actions!.find((a) => a.id === "inverter")!;
    const st = inv.run(inv.run({ ...s, fixed }, p), p);
    expect(Math.hypot(...fieldAtPt(st, 0.05, 0.02))).toBeLessThan(1e-3);
    expect(Math.abs(potAt(st, 0, 0))).toBeLessThan(1e-4);
  });

  it("linhas de campo do coaxial são radiais", () => {
    const { s } = make({ montagem: 2 });
    const lines = gridFieldLines(s);
    expect(lines.length).toBeGreaterThan(15);
    for (const l of lines) {
      const a = l[0]!;
      const b = l[l.length - 1]!;
      // Começa perto do condutor interno e termina perto da malha externa, na mesma direção.
      expect(Math.hypot(...a)).toBeLessThan(0.21);
      expect(Math.hypot(...b)).toBeGreaterThan(0.55);
      // Longe da escada de nós dos condutores, a linha segue o raio: compara os pontos em r ≈ 0,25 e 0,5 m.
      const at = (R: number) => l.reduce((best, q) => (Math.abs(Math.hypot(...q) - R) < Math.abs(Math.hypot(...best) - R) ? q : best));
      const u = at(0.25);
      const w = at(0.5);
      const cross = Math.abs(u[0] * w[1] - u[1] * w[0]) / (Math.hypot(...u) * Math.hypot(...w));
      expect(cross).toBeLessThan(0.03);
    }
  });
});
