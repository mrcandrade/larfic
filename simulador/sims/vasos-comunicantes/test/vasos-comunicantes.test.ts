import { describe, expect, it } from "vitest";
import { Runner, defaultParams } from "@fisilab/core";
import { vasosComunicantes as sim } from "../src/index.ts";

describe("Vasos comunicantes, paradoxo hidrostático, ludião e bombas", () => {
  it("roda", () => {
    const r = new Runner(sim, defaultParams(sim));
    r.stepOnce();
    expect(Number.isFinite(r.observe()[0]!)).toBe(true);
  });
});
