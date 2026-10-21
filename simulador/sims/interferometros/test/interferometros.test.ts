import { describe, expect, it } from "vitest";
import { Runner, defaultParams } from "@fisilab/core";
import { interferometros as sim } from "../src/index.ts";

describe("Interferômetros: Fabry–Perot, micro-ondas e cavidades", () => {
  it("roda", () => {
    const r = new Runner(sim, defaultParams(sim));
    r.stepOnce();
    expect(Number.isFinite(r.observe()[0]!)).toBe(true);
  });
});
