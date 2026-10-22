import { describe, expect, it } from "vitest";
import { chapters } from "../src/livro/sumario.ts";
import { chapterContents, type ExperimentRef } from "../src/livro/conteudo.ts";
import { findSim } from "../src/catalog.ts";
import { practices } from "../src/practices.ts";
import { concepts } from "../src/concepts.ts";
import { challenges } from "../src/challenge-core.ts";

function refProblem(r: ExperimentRef): string | undefined {
  if (r.kind === "sim") {
    const sim = findSim(r.id);
    if (!sim) return `sim ${r.id} não existe`;
    if (r.scenario && !sim.scenarios.some((s) => s.id === r.scenario)) return `cenário ${r.id}/${r.scenario} não existe`;
    for (const [k, v] of Object.entries(r.params ?? {})) {
      const p = sim.params.find((q) => q.key === k);
      if (!p) return `parâmetro ${r.id}.${k} não existe`;
      if (v < p.min || v > p.max) return `parâmetro ${r.id}.${k}=${v} fora da faixa`;
    }
  } else if (r.kind === "pratica") {
    if (!practices.some((p) => p.id === r.id)) return `prática ${r.id} não existe`;
  } else if (r.kind === "concepcao") {
    if (!concepts.some((c) => c.id === r.id)) return `concepção ${r.id} não existe`;
  } else if (!challenges.some((c) => c.id === r.id)) return `desafio ${r.id} não existe`;
  return undefined;
}

describe("livro: capítulos do Halliday", () => {
  it("o sumário tem 44 capítulos em ordem", () => {
    expect(chapters.map((c) => c.n)).toEqual(Array.from({ length: 44 }, (_, i) => i + 1));
  });
  for (const ch of chapters) {
    const content = chapterContents[ch.n];
    if (!content) continue;
    describe(`capítulo ${ch.n}`, () => {
      it("cobre exatamente as seções do sumário, com explicação", () => {
        expect(Object.keys(content.sections).sort()).toEqual(ch.sections.map((s) => s.id).sort());
        expect(content.intro.trim().length).toBeGreaterThan(80);
        for (const s of ch.sections) expect(content.sections[s.id]?.text.trim().length ?? 0, s.id).toBeGreaterThan(200);
      });
      it("tem experimentos e todos existem", () => {
        const refs = Object.values(content.sections).flatMap((s) => s.experiments);
        expect(refs.length).toBeGreaterThan(0);
        expect(refs.map(refProblem).filter(Boolean)).toEqual([]);
      });
      it("$ e $$ balanceados", () => {
        for (const [id, s] of Object.entries(content.sections)) {
          const inline = s.text.replace(/\$\$[^$]*\$\$/g, "");
          expect((inline.match(/\$/g) ?? []).length % 2, id).toBe(0);
        }
      });
    });
  }
});
