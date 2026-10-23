import { describe, expect, it } from "vitest";
import { rankClass, normalizeClassCode, submitChallengeAttempt, joinClassByCode, Backend } from "@fisilab/platform";
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
  wallMinSpeed,
  WALL_VMIN,
  type Outcome,
} from "../src/challenges.ts";

describe("desafios", () => {
  it("ids únicos, 17 desafios nos três níveis", () => {
    expect(new Set(challenges.map((c) => c.id)).size).toBe(challenges.length);
    expect(challenges.length).toBeGreaterThanOrEqual(17);
    expect(challenges.map((c) => c.sim)).toEqual(expect.arrayContaining(["circuitos-dc", "millikan"]));
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

  it("a velocidade mínima fixa da barreira é a da varredura", () => {
    const ch = challenges.find((c) => c.id === "barreira-com-arrasto")!;
    expect(wallMinSpeed(paramsFor(ch))).toBe(WALL_VMIN);
  }, 30_000); // a varredura leva alguns segundos; com a suíte inteira em paralelo passa dos 5 s padrão

  it("circuito: lâmpadas trocadas, bateria inventada e lâmpada fraca não passam", () => {
    const ch = challenges.find((c) => c.id === "circuito-economico")!;
    const ref = ch.reference.build as { kind: string; value: number }[];
    const swap = (f: (c: { kind: string; value: number }) => { kind: string; value: number }) => ({ params: {}, build: ref.map((c) => f({ ...c })) });
    expect(evaluateChallenge(ch, swap((c) => (c.kind === "lampada" ? { ...c, value: 1000 } : c))).message).toMatch(/12 Ω/);
    expect(evaluateChallenge(ch, swap((c) => (c.kind === "bateria" ? { ...c, value: 4.3 } : c))).ok).toBe(false);
    const weak = evaluateChallenge(ch, swap((c) => (c.kind === "bateria" ? { ...c, value: 3 } : c)));
    expect(weak.ok).toBe(false);
    expect(weak.message).toMatch(/mais fraca/);
    // duas séries de duas lâmpadas em paralelo, em 9 V: acende, mas gasta mais que o ideal
    const w = (a: number[], b: number[]) => ({ kind: "fio", a, b, value: 0 });
    const l = (a: number[], b: number[]) => ({ kind: "lampada", a, b, value: 12 });
    const twoByTwo = [{ kind: "bateria", a: [2, 5], b: [2, 3], value: 9 }, w([2, 5], [2, 6]), l([2, 6], [4, 6]), l([4, 6], [6, 6]), w([6, 6], [6, 3]), w([6, 3], [2, 3]), w([2, 6], [2, 7]), l([2, 7], [4, 7]), l([4, 7], [6, 7]), w([6, 7], [6, 6])];
    const o = evaluateChallenge(ch, { params: {}, build: twoByTwo });
    expect(o.ok).toBe(true);
    expect(stars(o)).toBe(2);
    const state = { comps: ref.map((c, i) => ({ ...c, id: i + 1, i: 0, v: 0, phase: 0 })) };
    expect(ch.build!.capture(state, {})).toEqual(ref);
  });

  it("Millikan: gota com mais de uma carga, fora do retículo ou de outra borrifada não passa", () => {
    const ch = challenges.find((c) => c.id === "millikan-gota-parada")!;
    expect(evaluateChallenge(ch, { params: { V: 1200 }, build: { gota: 1 } }).message).toMatch(/fora das linhas/);
    expect(evaluateChallenge(ch, { params: { V: 315 }, build: { gota: 99 } }).message).toMatch(/borrifada inicial/);
    expect(evaluateChallenge(ch, { params: { V: 400 }, build: { gota: 6 } }).message).toMatch(/saiu do retículo/);
    expect(stars(evaluateChallenge(ch, { params: { V: 746 }, build: { gota: 2 } }))).toBe(3);
    expect(ch.build!.capture({ sel: 6, drops: [] }, {})).toEqual({ gota: 6 });
    expect(ch.build!.capture({ sel: -1 }, {})).toBeUndefined();
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
      return new Response(JSON.stringify(url.endsWith("entrar_turma") ? [{ id: "uuid-1", nome: "Física I" }] : { ok: true, pontos: 900, estrelas: 3, tentativas: 2, mensagem: "ok" }), { status: 200 });
    }) as unknown as typeof fetch;
    const be = new Backend({ url: "https://x.supabase.co", anonKey: "anon" });
    await expect(joinClassByCode(be, "abc123", fake)).rejects.toThrow(/Entre/);
    be.session = { accessToken: "tok", refreshToken: "r", expiresAt: 0, user: { id: "u" } };
    await expect(joinClassByCode(be, "a!", fake)).rejects.toThrow(/inválido/);
    expect(await joinClassByCode(be, " ABC123 ", fake)).toEqual({ id: "uuid-1", nome: "Física I" });
    const sent = await submitChallengeAttempt(be, { turma: "uuid-1", nome: "Ana", desafio: "x", params: { v0: 26 }, build: [1], tentativas: 0, tempo_s: 3.6 }, fake);
    expect(calls[0]).toEqual({ url: "https://x.supabase.co/rest/v1/rpc/entrar_turma", body: { codigo_turma: "abc123" } });
    expect(calls[1]).toEqual({ url: "https://x.supabase.co/functions/v1/desafio", body: { turma: "uuid-1", nome: "Ana", desafio: "x", params: { v0: 26 }, build: [1], tentativas: 1, tempo_s: 4 } });
    expect(sent).toEqual({ ok: true, pontos: 900, estrelas: 3, tentativas: 2, mensagem: "ok" });
    const refused = (async () => new Response(JSON.stringify({ error: "você não está matriculado nesta turma" }), { status: 403 })) as unknown as typeof fetch;
    await expect(submitChallengeAttempt(be, { turma: "t", nome: "", desafio: "x", params: {}, tentativas: 1, tempo_s: 0 }, refused)).rejects.toThrow(/matriculado/);
  });
});
