import { describe, expect, it } from "vitest";
import { Runner, defaultParams } from "@fisilab/core";
import { sistemaSolar as sim } from "../src/index.ts";

describe("Sistema solar: n corpos, fases da Lua e movimento retrógrado", () => {
  it("roda", () => {
    const r = new Runner(sim, defaultParams(sim));
    r.stepOnce();
    expect(Number.isFinite(r.observe()[0]!)).toBe(true);
  });
});
