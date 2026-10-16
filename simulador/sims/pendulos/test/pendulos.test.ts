import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import { ellipticK, omega0, pendulos as sim, periodExact } from "../src/index.ts";

/** Mede o período pelos cruzamentos de θ por zero no sentido negativo. */
function measurePeriod(params: Record<string, number>): number {
  const r = new Runner(sim, withOverrides(sim, params), { dt: 1e-4 });
  const crossings: number[] = [];
  let prev = r.state[0]!;
  while (crossings.length < 3 && r.t < 30) {
    r.stepOnce();
    const th = r.state[0]!;
    if (prev > 0 && th <= 0) crossings.push(r.t - (th / (th - prev)) * r.dt);
    prev = th;
  }
  return crossings[2]! - crossings[1]!;
}

describe("pêndulos", () => {
  it("K(0) = π/2", () => expect(ellipticK(0)).toBeCloseTo(Math.PI / 2, 12));

  it("pequena amplitude: período ≈ 2π√(L/g)", () => {
    expect(measurePeriod({ theta0: 2, L: 1 })).toBeCloseTo(2 * Math.PI * Math.sqrt(1 / 9.81), 3);
  });

  it("grande amplitude: período medido = fórmula elíptica", () => {
    const p = { theta0: 120, L: 1.5 };
    expect(measurePeriod(p)).toBeCloseTo(periodExact(withOverrides(sim, p)), 3);
  });

  it("barra: ω₀ = √(3g/2L)", () => {
    expect(omega0(withOverrides(sim, { tipo: 1, L: 2 }))).toBeCloseTo(Math.sqrt((3 * 9.81) / 4), 10);
  });

  it("sem atrito conserva energia", () => {
    const r = new Runner(sim, withOverrides(sim, { theta0: 150 }));
    const E0 = r.value("E");
    for (let i = 0; i < 20000; i++) r.stepOnce();
    expect(Math.abs(r.value("E") - E0) / E0).toBeLessThan(1e-8);
  });
});
