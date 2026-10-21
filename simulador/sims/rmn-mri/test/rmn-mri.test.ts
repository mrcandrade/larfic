import { describe, expect, it } from "vitest";
import { Runner, defaultParams } from "@fisilab/core";
import { rmnMri as sim } from "../src/index.ts";

describe("Ressonância magnética nuclear e imagem", () => {
  it("roda", () => {
    const r = new Runner(sim, defaultParams(sim));
    r.stepOnce();
    expect(Number.isFinite(r.observe()[0]!)).toBe(true);
  });
});
