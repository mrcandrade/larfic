import { describe, expect, it } from "vitest";
import { Runner, defaultParams } from "@fisilab/core";
import { elasticidade as sim } from "../src/index.ts";

describe("Elasticidade: tração, cisalhamento e compressão", () => {
  it("roda", () => {
    const r = new Runner(sim, defaultParams(sim));
    r.stepOnce();
    expect(Number.isFinite(r.observe()[0]!)).toBe(true);
  });
});
