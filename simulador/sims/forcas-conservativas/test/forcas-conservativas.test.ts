import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import { G, forcasConservativas as sim, pathLength, pathPoints, workAlong } from "../src/index.ts";

const P = (o: Record<string, number> = {}) => withOverrides(sim, o);

describe("Forças conservativas e dissipativas", () => {
  const p = P({ m: 2, k: 5, mu: 0.4, c: 3 });
  const st = sim.init(p);

  it("gravidade e mola: mesmo trabalho em todos os caminhos, igual a −ΔU", () => {
    const Wg = -2 * G * (st.B[1] - st.A[1]);
    const r2 = (q: [number, number]) => q[0] ** 2 + q[1] ** 2;
    const Wm = -0.5 * 5 * (r2(st.B) - r2(st.A));
    for (let i = 0; i < 4; i++) {
      expect(workAlong(0, pathPoints(i, st), p)).toBeCloseTo(Wg, 9);
      expect(workAlong(1, pathPoints(i, st), p)).toBeCloseTo(Wm, 9);
    }
    // circulação nula no caminho fechado
    expect(workAlong(0, pathPoints(4, st), p)).toBeCloseTo(0, 9);
    expect(workAlong(1, pathPoints(4, st), p)).toBeCloseTo(0, 9);
  });

  it("atrito: W = −μmg·ℓ, depende do caminho e não se anula no circuito fechado", () => {
    for (let i = 0; i < 5; i++) {
      const pts = pathPoints(i, st);
      expect(workAlong(2, pts, p)).toBeCloseTo(-0.4 * 2 * G * pathLength(pts), 9);
    }
    expect(workAlong(2, pathPoints(2, st), p)).toBeLessThan(workAlong(2, pathPoints(0, st), p));
    expect(workAlong(2, pathPoints(4, st), p)).toBeLessThan(0);
  });

  it("campo rotacional: circulação = 2c × área (Stokes), via fórmula do laço", () => {
    const pts = pathPoints(4, st);
    let area2 = 0;
    for (let i = 1; i < pts.length; i++) area2 += pts[i - 1]![0] * pts[i]![1] - pts[i]![0] * pts[i - 1]![1];
    expect(workAlong(3, pts, p)).toBeCloseTo(3 * area2, 9);
    expect(Math.abs(workAlong(3, pts, p))).toBeGreaterThan(1);
    // escada: ∫ c(−y dx + x dy) = c(−y_A Δx + x_B Δy)
    const esc = -3 * st.A[1] * (st.B[0] - st.A[0]) + 3 * st.B[0] * (st.B[1] - st.A[1]);
    expect(workAlong(3, pathPoints(1, st), p)).toBeCloseTo(esc, 9);
  });

  it("a animação percorre o caminho e acumula o trabalho total", () => {
    const q = P({ forca: 0, caminho: 2, vel: 5 });
    const r = new Runner(sim, q);
    r.runToEnd();
    expect(r.finished).toBe(true);
    expect(r.value("W")).toBeCloseTo(-1 * G * (r.state.B[1] - r.state.A[1]), 6);
    expect(r.value("x")).toBeCloseTo(r.state.B[0], 6);
  });
});
