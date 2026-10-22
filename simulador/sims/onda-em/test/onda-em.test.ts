import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import { H2, MU0, bGap, bWire, capParams, capQ, ondaEm as sim } from "../src/index.ts";

/** Instante (interpolado) do pico de |E| na sonda. */
function peakTime(params: Record<string, number>, probe: [number, number], tMax: number, sign = 0): { t: number; v: number } {
  const p = withOverrides(sim, params);
  const r = new Runner(sim, p);
  r.setState({ ...r.state, probe });
  let best = { t: 0, v: 0 };
  while (r.t < tMax) {
    r.stepOnce();
    const v = r.value("E");
    if ((sign === 0 ? Math.abs(v) : sign * v) > Math.abs(best.v)) best = { t: r.t, v };
  }
  return best;
}

describe("Onda EM (FDTD) e corrente de deslocamento", () => {
  it("1D: o pulso se propaga com velocidade c = 1", () => {
    const base = { modo: 0, fonte: 0, borda: 1 };
    const a = peakTime(base, [4, 0], 6);
    const b = peakTime(base, [8, 0], 10);
    expect((8 - 4) / (b.t - a.t)).toBeCloseTo(1, 2);
    // Fonte em x = 2 e pico da gaussiana em t₀ = 1,2
    expect(a.t).toBeCloseTo(1.2 + 2, 1);
    expect(a.v).toBeCloseTo(1, 1);
  });

  it("1D: na onda que vai para +x, E e cB estão em fase e iguais", () => {
    const p = withOverrides(sim, { modo: 0, fonte: 1, f: 0.5, borda: 1 });
    const r = new Runner(sim, p);
    r.setState({ ...r.state, probe: [6, 0] });
    let maxDiff = 0;
    let maxE = 0;
    while (r.t < 12) {
      r.stepOnce();
      if (r.t > 8) {
        const i = Math.round(6 / 0.02);
        // B em (i ± ½)dx: média; diferença residual é da defasagem de meio passo do esquema
        maxDiff = Math.max(maxDiff, Math.abs(r.value("E") - 0.5 * (r.state.b[i]! + r.state.b[i - 1]!)));
        maxE = Math.max(maxE, Math.abs(r.value("E")));
      }
    }
    expect(maxE).toBeGreaterThan(0.9);
    expect(maxDiff / maxE).toBeLessThan(0.03);
  });

  it("1D: reflexão no condutor inverte E e conserva a amplitude", () => {
    const base = { modo: 0, fonte: 0, borda: 0 };
    const inc = peakTime(base, [9, 0], 9, 1);
    const p = withOverrides(sim, base);
    const r = new Runner(sim, p);
    r.setState({ ...r.state, probe: [9, 0] });
    let ref = { t: 0, v: 0 };
    while (r.t < 13) {
      r.stepOnce();
      if (r.t > 10 && r.value("E") < ref.v) ref = { t: r.t, v: r.value("E") };
    }
    expect(ref.v).toBeLessThan(0);
    expect(-ref.v / inc.v).toBeCloseTo(1, 1);
    expect(ref.t - inc.t).toBeCloseTo(2, 1); // ida e volta de 1 até a parede em x = 10
  });

  it("2D: a frente circular avança com c = 1 e as bordas absorvem", () => {
    const base = { modo: 1, fonte: 0, obst: 0 };
    const y = H2 / 2;
    const a = peakTime(base, [1.5 + 1, y], 4.5);
    const b = peakTime(base, [1.5 + 2, y], 5.5);
    expect(b.t - a.t).toBeCloseTo(1, 1);
    // Na diagonal, à mesma distância, o atraso é o mesmo (grade razoavelmente isotrópica)
    const c = peakTime(base, [1.5 + Math.SQRT1_2 * 1.5, y + Math.SQRT1_2 * 1.5], 5);
    const a15 = peakTime(base, [1.5 + 1.5, y], 5);
    expect(c.t).toBeCloseTo(a15.t, 1);
    const r = new Runner(sim, withOverrides(sim, base));
    let Umax = 0;
    while (r.t < 4) {
      r.stepOnce();
      Umax = Math.max(Umax, r.value("U"));
    }
    while (r.t < 14) r.stepOnce();
    expect(r.value("U")).toBeLessThan(0.05 * Umax);
  });

  it("capacitor: ε₀ dΦ_E/dt = corrente de condução e q(t) = Cε(1 − e^{−t/RC})", () => {
    const p = withOverrides(sim, { modo: 2, fem: 200, Rc: 5, Rp: 8, gap: 1.5 });
    const r = new Runner(sim, p);
    while (r.t < 2 - 1e-9) {
      r.stepOnce();
      expect(Math.abs(r.value("Id") - r.value("Ic")) / r.value("Ic")).toBeLessThan(1e-4);
    }
    expect(r.value("q") / capQ(capParams(p), r.t)).toBeCloseTo(1, 10);
  });

  it("capacitor: B entre as placas é contínuo na borda e igual ao do fio fora dela", () => {
    const c = capParams(withOverrides(sim, { modo: 2, Rp: 10 }));
    const I = 0.3;
    expect(bGap(c, I, c.a)).toBeCloseTo(bWire(I, c.a), 15);
    expect(bGap(c, I, 1.7 * c.a) / bWire(I, 1.7 * c.a)).toBeCloseTo(1, 12);
    expect(bGap(c, I, c.a / 2) / ((MU0 * I * (c.a / 2)) / (2 * Math.PI * c.a ** 2))).toBeCloseTo(1, 12);
  });
});
