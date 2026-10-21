import { describe, expect, it } from "vitest";
import { Runner, defaultParams } from "@fisilab/core";
import { motoPerpetuo as sim } from "../src/index.ts";

describe("Moto-perpétuo, pássaro bebedor e termômetro de Galileu", () => {
  it("roda", () => {
    const r = new Runner(sim, defaultParams(sim));
    r.stepOnce();
    expect(Number.isFinite(r.observe()[0]!)).toBe(true);
  });
});
