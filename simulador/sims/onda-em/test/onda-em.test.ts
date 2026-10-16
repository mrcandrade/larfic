import { describe, expect, it } from "vitest";
import { Runner, defaultParams } from "@fisilab/core";
import { ondaEm as sim } from "../src/index.ts";

describe("Corrente de deslocamento e onda EM", () => {
  it("roda", () => {
    const r = new Runner(sim, defaultParams(sim));
    r.stepOnce();
    expect(Number.isFinite(r.observe()[0]!)).toBe(true);
  });
});
