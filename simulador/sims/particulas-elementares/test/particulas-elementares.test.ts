import { describe, expect, it } from "vitest";
import { Runner, defaultParams } from "@fisilab/core";
import { particulasElementares as sim } from "../src/index.ts";

describe("Partículas elementares: léptons, hádrons e quarks", () => {
  it("roda", () => {
    const r = new Runner(sim, defaultParams(sim));
    r.stepOnce();
    expect(Number.isFinite(r.observe()[0]!)).toBe(true);
  });
});
