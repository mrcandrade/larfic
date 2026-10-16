import { describe, expect, it } from "vitest";
import { Runner, defaultParams } from "@fisilab/core";
import { circuitoRc as sim } from "../src/index.ts";

describe("Circuito RC: carga e descarga", () => {
  it("roda", () => {
    const r = new Runner(sim, defaultParams(sim));
    r.stepOnce();
    expect(Number.isFinite(r.observe()[0]!)).toBe(true);
  });
});
