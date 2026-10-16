import { describe, expect, it } from "vitest";
import { Runner, defaultParams } from "@fisilab/core";
import { vetores3d as sim } from "../src/index.ts";

describe("Vetores em 3D", () => {
  it("roda", () => {
    const r = new Runner(sim, defaultParams(sim));
    r.stepOnce();
    expect(Number.isFinite(r.observe()[0]!)).toBe(true);
  });
});
