import { describe, expect, it } from "vitest";
import { Runner, defaultParams } from "@fisilab/core";
import { radioterapia as sim } from "../src/index.ts";

describe("Dose em radioterapia: fótons, elétrons e prótons", () => {
  it("roda", () => {
    const r = new Runner(sim, defaultParams(sim));
    r.stepOnce();
    expect(Number.isFinite(r.observe()[0]!)).toBe(true);
  });
});
