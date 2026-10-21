import { describe, expect, it } from "vitest";
import { Runner, defaultParams } from "@fisilab/core";
import { motoresGeradores as sim } from "../src/index.ts";

describe("Motores e geradores: DC, Faraday, dínamo e trifásico", () => {
  it("roda", () => {
    const r = new Runner(sim, defaultParams(sim));
    r.stepOnce();
    expect(Number.isFinite(r.observe()[0]!)).toBe(true);
  });
});
