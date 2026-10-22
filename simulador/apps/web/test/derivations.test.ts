import { describe, expect, it } from "vitest";
import katex from "katex";
import { catalog } from "../src/catalog.ts";
import { mathFragments, unbalancedMathLines } from "../../../packages/ui-kit/src/markdown.ts";

/** Sims centrais que precisam ter o modo engenharia (derivação completa). */
const REQUIRED = [
  "projetil-arrasto",
  "circuitos-dc",
  "ciclos-termicos",
  "pendulos",
  "massa-mola",
  "amortecido",
  "ressonancia",
  "orbitas-kepler",
  "gauss",
  "circuito-rc",
  "rlc-ca",
  "faraday-lenz",
  "onda-corda",
  "fenda-dupla",
  "poco-quantico",
];

const withDerivation = catalog.filter(({ sim }) => sim.derivation);

describe("modo engenharia", () => {
  it("as sims centrais têm derivação", () => {
    const ids = new Set(withDerivation.map(({ sim }) => sim.id));
    expect(REQUIRED.filter((id) => !ids.has(id))).toEqual([]);
  });

  for (const { sim } of withDerivation) {
    describe(sim.id, () => {
      const text = sim.derivation!;

      it("usa delimitadores $ balanceados em cada linha", () => {
        expect(unbalancedMathLines(text)).toEqual([]);
      });

      it("todo o TeX compila no KaTeX", () => {
        const bad: string[] = [];
        for (const f of mathFragments(text)) {
          try {
            katex.renderToString(f.tex, { displayMode: f.display, throwOnError: true, strict: "error" });
          } catch (e) {
            bad.push(`linha ${f.line}: ${f.tex} → ${(e as Error).message}`);
          }
        }
        expect(bad).toEqual([]);
      });

      it("tem hipóteses, desenvolvimento e método numérico", () => {
        expect(text).toMatch(/^### 1\. Hipóteses/);
        expect(text).toMatch(/### \d+\. Método numérico/);
        expect(text.length).toBeGreaterThan(1500);
        // Itálico com * não é usado: confundiria o Markdown mínimo com TeX.
        expect(text.replace(/\*\*[^*]+\*\*/g, "")).not.toContain("*");
      });
    });
  }
});
