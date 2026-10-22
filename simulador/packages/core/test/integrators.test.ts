import { describe, expect, it } from "vitest";
import { euler, rk4, verlet, type Derivatives } from "../src/index.ts";

// Oscilador harmônico simples: x'' = -ω² x, com ω = 2 rad/s.
const sho: Derivatives = ([x = 0, v = 0], p) => [v, -((p.w ?? 0) ** 2) * x];
const params = { w: 2 };
const energy = ([x = 0, v = 0]: number[]) => 0.5 * v * v + 0.5 * params.w ** 2 * x * x;

function run(integrator: typeof rk4, tEnd: number, dt: number) {
  let y = [1, 0];
  for (let t = 0; t < tEnd - 1e-12; t += dt) y = integrator(sho, y, params, t, dt);
  return y;
}

describe("integradores no oscilador harmônico", () => {
  it("RK4 reproduz a solução analítica x(t) = cos(ωt)", () => {
    const [x] = run(rk4, 5, 1e-3);
    expect(x).toBeCloseTo(Math.cos(2 * 5), 9);
  });

  it("Verlet mantém a energia limitada em tempos longos", () => {
    const y = run(verlet, 1000, 1e-2);
    expect(Math.abs(energy(y) - energy([1, 0])) / energy([1, 0])).toBeLessThan(1e-3);
  });

  it("Euler explícito ganha energia (motivo para não usá-lo em produção)", () => {
    const y = run(euler, 10, 1e-2);
    expect(energy(y)).toBeGreaterThan(energy([1, 0]) * 1.1);
  });
});
