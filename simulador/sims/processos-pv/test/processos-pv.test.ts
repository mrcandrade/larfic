import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import {
  ADIABATICO,
  ISOBARICO,
  ISOCORICO,
  ISOTERMICO,
  areaUnder,
  current,
  energy,
  isClosed,
  pathPoints,
  processosPv as sim,
  totals,
  type PVState,
} from "../src/index.ts";

const act = (id: string) => sim.actions!.find((a: { id: string }) => a.id === id)!;

describe("processos no diagrama PV", () => {
  it("isotérmico: W = P_A V_A ln(V_B/V_A), ΔU = 0 e Q = W", () => {
    const p = withOverrides(sim, { processo: ISOTERMICO, P0: 100, V0: 25, Vf: 50 });
    const s = sim.init(p);
    const { B, e } = current(s, p);
    expect(B.V).toBeCloseTo(50, 9);
    expect(B.P).toBeCloseTo(50, 9);
    expect(e.W).toBeCloseTo(2500 * Math.log(2), 9);
    expect(e.dU).toBeCloseTo(0, 9);
    expect(e.Q).toBeCloseTo(e.W, 9);
  });

  it("adiabático: PV^γ constante, Q = 0 e T V^(γ−1) constante", () => {
    const p = withOverrides(sim, { processo: ADIABATICO, gamma: 1.4, P0: 100, V0: 25, Vf: 12 });
    const r = new Runner<PVState>(sim, p);
    const { A, B, e } = current(r.state, p);
    expect(B.P * B.V ** 1.4).toBeCloseTo(A.P * A.V ** 1.4, 6);
    expect(e.Q).toBeCloseTo(0, 9);
    expect(B.V).toBeCloseTo(12, 9);
    expect(r.value("T") * 12 ** 0.4).toBeCloseTo((2500 / (8.314462618 * 1)) * 25 ** 0.4, 6);
  });

  it("a área sob o caminho é o trabalho em todos os processos", () => {
    const A = { P: 150, V: 12 };
    const B = { P: 60, V: 30 };
    for (const kind of [ISOTERMICO, ADIABATICO, ISOBARICO]) {
      const end = kind === ISOBARICO ? { P: A.P, V: B.V } : B;
      const pts = pathPoints(kind, A, end, 5 / 3, 4000);
      const realEnd = pts[pts.length - 1]!;
      expect(areaUnder(pts)).toBeCloseTo(energy(kind, A, realEnd, 5 / 3).W, 3);
    }
    expect(energy(ISOCORICO, A, { P: 300, V: A.V }, 1.4).W).toBe(0);
  });

  it("isobárico monoatômico: Q = (5/2) P ΔV", () => {
    const e = energy(ISOBARICO, { P: 200, V: 10 }, { P: 200, V: 30 }, 5 / 3);
    expect(e.Q).toBeCloseTo(2.5 * 200 * 20, 9);
    expect(e.dU).toBeCloseTo(1.5 * 200 * 20, 9);
  });

  it("ciclo retangular fechado: ΔU total = 0 e W = Q = área interna", () => {
    let p = withOverrides(sim, { processo: ISOBARICO, P0: 100, V0: 20, Vf: 50, Pf: 250 });
    let s: PVState = sim.init(p);
    s = act("confirmar").run(s, p); // isobárico 20 → 50 L a 100 kPa
    p = { ...p, processo: ISOCORICO };
    s = act("confirmar").run({ ...s, target: { V: 50, P: 250 } }, p);
    p = { ...p, processo: ISOBARICO };
    s = act("confirmar").run({ ...s, target: { V: 20, P: 250 } }, p);
    p = { ...p, processo: ISOCORICO };
    s = { ...s, target: { V: 20, P: 103 } }; // perto do início: o ímã encaixa
    expect(current(s, p).B.P).toBeCloseTo(100, 9);
    expect(isClosed(s, p)).toBe(true);
    const tot = totals(s, p);
    expect(tot.dU).toBeCloseTo(0, 9);
    expect(tot.W).toBeCloseTo(tot.Q, 9);
    expect(tot.W).toBeCloseTo(-(250 - 100) * (50 - 20), 9); // anti-horário: refrigerador
  });

  it("o ponto final nunca sai dos eixos e desfazer volta ao estado anterior", () => {
    const p = withOverrides(sim, { processo: ADIABATICO, P0: 100, V0: 25 });
    const s = { ...sim.init(p), target: { V: 0.01, P: 1 } };
    const { B } = current(s, p);
    expect(B.P).toBeLessThanOrEqual(0.98 * 350 + 1e-9);
    const s2 = act("confirmar").run(s, p);
    expect(s2.stages).toHaveLength(1);
    expect(act("desfazer").run(s2, p).start).toEqual(s.start);
  });
});
