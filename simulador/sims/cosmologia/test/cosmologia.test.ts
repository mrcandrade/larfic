import { describe, expect, it } from "vitest";
import { Runner, defaultParams } from "@fisilab/core";
import { cosmologia as sim } from "../src/index.ts";

describe("Cosmologia: expansão, radiação de fundo e matéria escura", () => {
  it("roda", () => {
    const r = new Runner(sim, defaultParams(sim));
    r.stepOnce();
    expect(Number.isFinite(r.observe()[0]!)).toBe(true);
  });
});
