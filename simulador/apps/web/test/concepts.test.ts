import { describe, expect, it } from "vitest";
import { findSim } from "../src/catalog.ts";
import { paramsFromQuery, parseRoute } from "../src/router.ts";
import {
  PROGRESS_KEY,
  conceptAreas,
  conceptHref,
  conceptSimHref,
  concepts,
  loadConceptProgress,
  recordCheck,
  recordObserved,
  recordPrediction,
  retryCheck,
  saveConceptProgress,
  searchConcepts,
  stageOf,
  summarize,
} from "../src/concepts.ts";

describe("banco de concepções", () => {
  it("tem cerca de 30 concepções, com ids únicos e em formato de URL", () => {
    expect(concepts.length).toBeGreaterThanOrEqual(30);
    const ids = concepts.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it("todas as áreas têm concepções e toda concepção tem área conhecida", () => {
    const known = new Set(conceptAreas.map((a) => a.id));
    for (const c of concepts) expect(known.has(c.area)).toBe(true);
    for (const a of conceptAreas) expect(concepts.some((c) => c.area === a.id)).toBe(true);
  });

  for (const c of concepts) {
    describe(c.id, () => {
      it("sim, cenário e parâmetros existem (e os valores cabem na faixa)", () => {
        const sim = findSim(c.sim.id);
        expect(sim, `sim ${c.sim.id}`).toBeDefined();
        expect(sim!.scenarios.map((s) => s.id)).toContain(c.sim.scenario);
        for (const [k, v] of Object.entries(c.sim.params ?? {})) {
          const spec = sim!.params.find((p) => p.key === k);
          expect(spec, `parâmetro ${k} de ${c.sim.id}`).toBeDefined();
          expect(v).toBeGreaterThanOrEqual(spec!.min);
          expect(v).toBeLessThanOrEqual(spec!.max);
        }
      });

      it("respostas certas estão entre as opções", () => {
        for (const q of [c.predict, c.check]) {
          expect(q.options.length).toBeGreaterThanOrEqual(2);
          expect(Number.isInteger(q.answer)).toBe(true);
          expect(q.answer).toBeGreaterThanOrEqual(0);
          expect(q.answer).toBeLessThan(q.options.length);
          expect(new Set(q.options).size).toBe(q.options.length);
        }
      });

      it("textos estão preenchidos e \"Observe\" orienta a observação", () => {
        for (const t of [c.title, c.statement, c.appeal, c.topic, c.observe, c.explanation, c.check.explanation]) expect(t.trim().length).toBeGreaterThan(0);
        expect(c.observe).toMatch(/^Observe/);
      });

      it("o link da sim abre o cenário com os parâmetros", () => {
        const route = parseRoute(conceptSimHref(c));
        expect(route.page).toBe("sim");
        expect(route.simId).toBe(c.sim.id);
        expect(route.query.get("cenario")).toBe(c.sim.scenario);
        expect(paramsFromQuery(route.query)).toEqual(c.sim.params ?? {});
      });
    });
  }

  it("o link da concepção cai na rota de concepções", () => {
    const r = parseRoute(conceptHref("corrente-gasta"));
    expect(r.page).toBe("concepts");
    expect(r.conceptId).toBe("corrente-gasta");
  });
});

describe("busca", () => {
  it("ignora acentos e maiúsculas e combina palavras", () => {
    const r = searchConcepts(concepts, "LAMPADA corrente");
    expect(r.map((c) => c.id)).toContain("corrente-gasta");
    expect(searchConcepts(concepts, "ímã").some((c) => c.id === "ima-atrai-qualquer-metal")).toBe(true);
  });

  it("filtra por área", () => {
    const r = searchConcepts(concepts, "", "eletromagnetismo");
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((c) => c.area === "eletromagnetismo")).toBe(true);
    expect(searchConcepts(concepts, "", "").length).toBe(concepts.length);
  });
});

describe("progresso", () => {
  const c = concepts[0]!;
  const wrong = (c.predict.answer + 1) % c.predict.options.length;

  it("percorre prever → observar → verificar", () => {
    let p = {};
    expect(stageOf(c, undefined)).toBe("nova");
    p = recordPrediction(p, c.id, wrong);
    expect(stageOf(c, p[c.id as keyof typeof p])).toBe("previu");
    // a previsão é registrada uma vez só
    const again = recordPrediction(p, c.id, c.predict.answer);
    expect(again).toBe(p);
    p = recordObserved(p, c.id);
    expect(stageOf(c, p[c.id as keyof typeof p])).toBe("observou");
    p = recordCheck(p, c.id, (c.check.answer + 1) % c.check.options.length);
    expect(stageOf(c, p[c.id as keyof typeof p])).toBe("revisar");
    p = retryCheck(p, c.id);
    expect(stageOf(c, p[c.id as keyof typeof p])).toBe("observou");
    p = recordCheck(p, c.id, c.check.answer);
    expect(stageOf(c, p[c.id as keyof typeof p])).toBe("superada");
    const s = summarize(concepts, p);
    expect(s).toEqual({ total: concepts.length, superadas: 1, emAndamento: 0, previsoesErradas: 1, previsoes: 1 });
    expect((p as Record<string, { attempts?: number }>)[c.id]!.attempts).toBe(2);
  });

  it("salva e carrega, e tolera armazenamento quebrado", () => {
    const mem = new Map<string, string>();
    const storage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) };
    const p = recordPrediction({}, c.id, 0);
    saveConceptProgress(p, storage);
    expect(loadConceptProgress(storage)).toEqual(p);
    mem.set(PROGRESS_KEY, "{lixo");
    expect(loadConceptProgress(storage)).toEqual({});
    mem.set(PROGRESS_KEY, "[1,2]");
    expect(loadConceptProgress(storage)).toEqual({});
    const broken = { getItem: () => { throw new Error("bloqueado"); }, setItem: () => { throw new Error("cota"); } };
    expect(loadConceptProgress(broken)).toEqual({});
    expect(() => saveConceptProgress(p, broken)).not.toThrow();
  });
});
