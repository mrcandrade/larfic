import { describe, expect, it } from "vitest";
import { Runner, defaultParams } from "@fisilab/core";
import { cavendish as sim } from "../src/index.ts";

describe("Balança de Cavendish e a constante G", () => {
  it("roda", () => {
    const r = new Runner(sim, defaultParams(sim));
    r.stepOnce();
    expect(Number.isFinite(r.observe()[0]!)).toBe(true);
  });
});
