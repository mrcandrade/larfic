import { describe, expect, it } from "vitest";
import { Runner, defaultParams } from "@fisilab/core";
import { chladniMembranas as sim } from "../src/index.ts";

describe("Figuras de Chladni e modos de membranas", () => {
  it("roda", () => {
    const r = new Runner(sim, defaultParams(sim));
    r.stepOnce();
    expect(Number.isFinite(r.observe()[0]!)).toBe(true);
  });
});
