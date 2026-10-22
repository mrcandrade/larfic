import { describe, expect, it } from "vitest";
import { rankClass, normalizeClassCode, submitChallengeScore, joinClassByCode, Backend } from "@fisilab/platform";
import { findSim } from "../src/catalog.ts";
import {
  challenges,
  closeness,
  emptyBook,
  evaluateChallenge,
  loadBook,
  localRanking,
  lockedKeys,
  nextAttempt,
  paramsFor,
  points,
  recordAttempt,
  removeProfile,
  saveBook,
  stars,
  switchProfile,
  type Outcome,
} from "../src/challenges.ts";

describe("desafios", () => {
  it("ids únicos, 15 desafios nos três níveis", () => {
    expect(new Set(challenges.map((c) => c.id)).size).toBe(challenges.length);
    expect(challenges.length).toBeGreaterThanOrEqual(15);
    for (const l of [1, 2, 3]) expect(challenges.filter((c) => c.level === l).length).toBeGreaterThanOrEqual(4);
  });

  for (const ch of challenges) {
    describe(ch.id, () => {
      it("sim, cenário e parâmetros existem", () => {
        const sim = findSim(ch.sim);
        expect(sim, ch.sim).toBeDefined();
        if (ch.scenario) expect(sim!.scenarios.some((s) => s.id === ch.scenario), ch.scenario).toBe(true);
        const keys = new Set(sim!.params.map((p) => p.key));
        for (const k of [...Object.keys(ch.base), ...ch.knobs, ...(ch.explore ?? []), ...Object.keys(ch.reference.params), ...Object.keys(ch.bad.params)]) expect(keys.has(k), k).toBe(true);
        for (const k of ch.knobs) expect(lockedKeys(ch)).not.toContain(k);
        expect(!!ch.build).toBe(ch.reference.build !== undefined);
      });

      it("a solução de referência ganha 3 estrelas", () => {
        const o = evaluateChallenge(ch, ch.reference);
        expect(o.ok, o.message).toBe(true);
        expect(stars(o), `${o.message} (precisão ${o.accuracy}, economia ${o.economy})`).toBe(3);
        for (const m of o.metrics) expect(Number.isNaN(m.value), m.label).toBe(false);
      });

      it("uma resposta ruim não ganha 3 estrelas", () => {
        const o = evaluateChallenge(ch, ch.bad);
        expect(stars(o), o.message).toBeLessThan(3);
      });

      it("a avaliação é determinística", () => {
        const a = evaluateChallenge(ch, ch.reference);
        const b = evaluateChallenge(ch, ch.reference);
        expect(b).toEqual(a);
      });
    });
  }

  it("valores fora da faixa e parâmetros travados não passam para a avaliação", () => {
    const ch = challenges.find((c) => c.id === "alvo-com-arrasto")!;
    const p = paramsFor(ch, { v0: 1e6, g: 1, cd: 0 });
    expect(p.v0).toBe(100);
    expect(p.g).toBe(9.81);
    expect(p.cd).toBe(0.25);
  });

  it("montagem obrigatória", () => {
    const ch = challenges.find((c) => c.id === "hoquei-uma-carga")!;
    expect(evaluateChallenge(ch, { params: {} }).ok).toBe(false);
    expect(ch.build!.capture({ cargas: [{ x: 0.1, y: -0.2, q: 50 }] }, {})).toBeUndefined();
  });
});

describe("pontuação", () => {
  const good: Outcome = { ok: true, accuracy: 1, economy: 1, metrics: [], message: "" };
  it("estrelas pela precisão e economia", () => {
    expect(stars({ ...good, ok: false })).toBe(0);
    expect(stars(good)).toBe(3);
    expect(stars({ ...good, economy: 0.7 })).toBe(2);
    expect(stars({ ...good, accuracy: 0.3 })).toBe(1);
    expect(closeness(0, 1)).toBe(1);
    expect(closeness(1, 1)).toBeCloseTo(0.9);
    expect(closeness(3, 1)).toBeLessThan(0.6);
  });
  it("pontos por nível, tentativas e tempo", () => {
    expect(points(1, good, 1, 10)).toBe(1000);
    expect(points(3, good, 1, 10)).toBe(2000);
    expect(points(1, good, 3, 10)).toBe(900);
    expect(points(1, good, 50, 10)).toBe(500);
    expect(points(1, good, 1, 10_000)).toBe(700);
    expect(points(1, { ...good, ok: false }, 1, 10)).toBe(0);
  });
});

describe("histórico e ranking local", () => {
  it("guarda a melhor tentativa por perfil e ordena o ranking", () => {
    let b = emptyBook("Ana");
    b = recordAttempt(b, "alvo-com-arrasto", { points: 500, stars: 2, seconds: 30 });
    b = recordAttempt(b, "alvo-com-arrasto", { points: 300, stars: 1, seconds: 40 });
    expect(b.profiles.Ana!["alvo-com-arrasto"]).toMatchObject({ best: 500, stars: 2, attempts: 2 });
    expect(nextAttempt(b, "alvo-com-arrasto")).toBe(3);
    b = switchProfile(b, " Bruno ");
    expect(b.current).toBe("Bruno");
    b = recordAttempt(b, "braquistocrona", { points: 1800, stars: 3, seconds: 100 });
    b = recordAttempt(b, "nao-existe", { points: 99999, stars: 3, seconds: 1 });
    expect(localRanking(b).map((r) => [r.name, r.points, r.done])).toEqual([
      ["Bruno", 1800, 1],
      ["Ana", 500, 1],
    ]);
    expect(b.log).toHaveLength(4);
    b = removeProfile(b, "Bruno");
    expect(b.current).toBe("Ana");
    expect(Object.keys(b.profiles)).toEqual(["Ana"]);
  });

  it("lê e grava no armazenamento, e sobrevive a lixo", () => {
    const mem = new Map<string, string>();
    const st = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) };
    const b = recordAttempt(emptyBook("Eu"), "loop-sem-cair", { points: 10, stars: 1, seconds: 5 });
    saveBook(b, st);
    expect(loadBook(st)).toEqual(b);
    mem.set("fisilab.desafios.v1", "{lixo");
    expect(loadBook(st, "Carla").current).toBe("Carla");
  });
});

describe("ranking da turma", () => {
  it("soma a melhor pontuação de cada aluno por desafio", () => {
    const rows = [
      { turma: "t", aluno: "a", nome: "Ana", desafio: "x", pontos: 100, estrelas: 1, tentativas: 1, tempo_s: 10 },
      { turma: "t", aluno: "a", nome: "Ana", desafio: "x", pontos: 300, estrelas: 2, tentativas: 2, tempo_s: 10 },
      { turma: "t", aluno: "a", nome: "Ana", desafio: "y", pontos: 50, estrelas: 1, tentativas: 1, tempo_s: 10 },
      { turma: "t", aluno: "b", nome: "Bia", desafio: "x", pontos: 400, estrelas: 3, tentativas: 1, tempo_s: 10 },
      { turma: "t", aluno: "b", nome: "Bia", desafio: "velho", pontos: 999, estrelas: 3, tentativas: 1, tempo_s: 10 },
    ];
    expect(rankClass(rows, new Set(["x", "y"]))).toEqual([
      { aluno: "b", nome: "Bia", pontos: 400, estrelas: 3, desafios: 1 },
      { aluno: "a", nome: "Ana", pontos: 350, estrelas: 3, desafios: 2 },
    ]);
    expect(normalizeClassCode(" AB 12cd ")).toBe("ab12cd");
  });

  it("chama as funções do Supabase com a sessão do aluno", async () => {
    const calls: { url: string; body: unknown }[] = [];
    const fake = (async (url: string, init: RequestInit) => {
      calls.push({ url, body: JSON.parse(String(init.body)) });
      return new Response(url.endsWith("entrar_turma") ? JSON.stringify([{ id: "uuid-1", nome: "Física I" }]) : "", { status: 200 });
    }) as unknown as typeof fetch;
    const be = new Backend({ url: "https://x.supabase.co", anonKey: "anon" });
    await expect(joinClassByCode(be, "abc123", fake)).rejects.toThrow(/Entre/);
    be.session = { accessToken: "tok", refreshToken: "r", expiresAt: 0, user: { id: "u" } };
    await expect(joinClassByCode(be, "a!", fake)).rejects.toThrow(/inválido/);
    expect(await joinClassByCode(be, " ABC123 ", fake)).toEqual({ id: "uuid-1", nome: "Física I" });
    await submitChallengeScore(be, { turma: "uuid-1", nome: "Ana", desafio: "x", pontos: 12.4, estrelas: 7, tentativas: 0, tempo_s: 3.6 }, fake);
    expect(calls[0]).toEqual({ url: "https://x.supabase.co/rest/v1/rpc/entrar_turma", body: { codigo_turma: "abc123" } });
    expect(calls[1]!.body).toEqual({ p_turma: "uuid-1", p_nome: "Ana", p_desafio: "x", p_pontos: 12, p_estrelas: 3, p_tentativas: 1, p_tempo_s: 4 });
  });
});
