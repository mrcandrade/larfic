import { describe, expect, it } from "vitest";
import { Runner, defaultParams } from "@fisilab/core";
import { qubitDoisNiveis as sim } from "../src/index.ts";

describe("Sistema de dois níveis: medida, Rabi e esfera de Bloch", () => {
  it("roda", () => {
    const r = new Runner(sim, defaultParams(sim));
    r.stepOnce();
    expect(Number.isFinite(r.observe()[0]!)).toBe(true);
  });
});
