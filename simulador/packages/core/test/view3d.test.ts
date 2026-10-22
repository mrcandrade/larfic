import { describe, expect, it } from "vitest";
import { cameraBasis, orbit, projector, sphere, surface } from "../src/view3d.ts";
import { cross3 } from "../src/vec.ts";

describe("view3d", () => {
  it("base da câmera é ortonormal e dextrógira", () => {
    const b = cameraBasis(0.7, 0.3);
    const f = cross3(b.r, b.u);
    for (let i = 0; i < 3; i++) expect(f[i]).toBeCloseTo(b.f[i]!, 12);
  });
  it("projeção ortográfica e perspectiva", () => {
    const o = projector({ yaw: 0, pitch: 0 });
    expect(o.project([0, 1, 0])[0]).toBeCloseTo(1);
    expect(o.project([0, 0, 1])[1]).toBeCloseTo(1);
    expect(o.project([1, 0, 0])[2]).toBeCloseTo(1);
    const p = projector({ yaw: 0, pitch: 0, dist: 10 });
    expect(p.project([1, 1, 0])[0]).toBeGreaterThan(p.project([-1, 1, 0])[0]);
  });
  it("órbita limita a elevação", () => {
    expect(orbit({ yaw: 0, pitch: 0 }, 0, 10000).pitch).toBeLessThanOrEqual(1.5);
  });
  it("malhas têm o número esperado de faces", () => {
    expect(sphere([0, 0, 0], 1, "#ff0000", 8)).toHaveLength(8 * 16);
    expect(surface((u, v) => [u, v, 0], [0, 1], [0, 1], 3, 4, () => "#000000")).toHaveLength(12);
  });
});
