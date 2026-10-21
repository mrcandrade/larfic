import { describe, expect, it } from "vitest";
import { Runner, defaultParams } from "@fisilab/core";
import { descargasGases as sim } from "../src/index.ts";

describe("Descargas em gases: tubo de Crookes, neon e fluorescente", () => {
  it("roda", () => {
    const r = new Runner(sim, defaultParams(sim));
    r.stepOnce();
    expect(Number.isFinite(r.observe()[0]!)).toBe(true);
  });
});
