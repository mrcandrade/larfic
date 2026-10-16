import { describe, expect, it } from "vitest";
import { Runner, defaultParams } from "@fisilab/core";
import { montanhaRussa as sim } from "../src/index.ts";

describe("Montanha-russa e energia", () => {
  it("roda", () => {
    const r = new Runner(sim, defaultParams(sim));
    r.stepOnce();
    expect(Number.isFinite(r.observe()[0]!)).toBe(true);
  });
});
