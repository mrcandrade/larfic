import { describe, expect, it } from "vitest";
import { Runner, defaultParams } from "@fisilab/core";
import { jogosFisica as sim } from "../src/index.ts";

describe("Jogos de física: hóquei elétrico, módulo lunar e labirinto", () => {
  it("roda", () => {
    const r = new Runner(sim, defaultParams(sim));
    r.stepOnce();
    expect(Number.isFinite(r.observe()[0]!)).toBe(true);
  });
});
