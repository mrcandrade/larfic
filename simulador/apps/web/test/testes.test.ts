import { describe, expect, it } from "vitest";
import katex from "katex";
import { chapters } from "../src/livro/sumario.ts";
import { arrange, chapterChecks } from "../src/livro/testes.ts";

/** Trechos $…$ de uma linha; erro se sobrar um $ sem par. */
function tex(line: string): string[] {
  const parts = line.split("$");
  if (parts.length % 2 === 0) throw new Error(`$ sem par em: ${line}`);
  return parts.filter((_, i) => i % 2 === 1);
}

describe("livro: testes rápidos", () => {
  it("arrange move a correta sem perder alternativas e mantém listas numéricas", () => {
    const c = { q: "Qual?", options: ["Sim, sempre", "Não, nunca", "Às vezes", "Depende"], answer: 1, why: "porque sim" };
    for (const key of ["1-2#0", "3-4#1", "5-6#0", "7-8#2"]) {
      const a = arrange(c, key);
      expect([...a.options].sort()).toEqual([...c.options].sort());
      expect(a.options[a.answer]).toBe("Não, nunca");
    }
    const num = { q: "Quanto?", options: ["1 m", "2 m", "3 m"], answer: 2, why: "conta" };
    expect(arrange(num, "1-2#0")).toEqual(num);
  });

  it("todo capítulo tem o seu arquivo de testes", () => {
    expect(Object.keys(chapterChecks).map(Number).sort((a, b) => a - b)).toEqual(chapters.map((c) => c.n));
  });

  for (const ch of chapters) {
    const tc = chapterChecks[ch.n];
    if (!tc) continue;
    describe(`capítulo ${ch.n}`, () => {
      it("cobre exatamente as seções do sumário, com ao menos uma pergunta cada", () => {
        expect(Object.keys(tc.sections).sort()).toEqual(ch.sections.map((s) => s.id).sort());
        for (const [id, list] of Object.entries(tc.sections)) expect(list.length, id).toBeGreaterThan(0);
      });

      it("perguntas bem formadas", () => {
        for (const [id, list] of Object.entries(tc.sections))
          for (const c of list) {
            const where = `${id}: ${c.q}`;
            expect(c.q.length, where).toBeGreaterThan(15);
            expect(c.options.length, where).toBeGreaterThanOrEqual(3);
            expect(c.options.length, where).toBeLessThanOrEqual(5);
            expect(new Set(c.options).size, where).toBe(c.options.length);
            expect(Number.isInteger(c.answer) && c.answer >= 0 && c.answer < c.options.length, where).toBe(true);
            expect(c.why.length, where).toBeGreaterThan(40);
            for (const line of [c.q, ...c.options, c.why]) {
              expect(line.includes("\n"), where).toBe(false);
              for (const t of tex(line)) expect(() => katex.renderToString(t, { throwOnError: true }), `${where} → ${t}`).not.toThrow();
            }
          }
      });

      it("a resposta certa não fica sempre na mesma posição", () => {
        const pos = Object.values(tc.sections).flat().map((c) => c.answer);
        if (pos.length >= 6) expect(new Set(pos).size).toBeGreaterThan(2);
      });
    });
  }
});
