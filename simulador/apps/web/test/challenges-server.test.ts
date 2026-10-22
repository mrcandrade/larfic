import { describe, expect, it } from "vitest";
import { handleAttempt, parseAttempt, type AttemptDeps, type ScoreRow } from "../src/challenge-server.ts";
import { challenges, evaluateChallenge, points, stars } from "../src/challenge-core.ts";

const TURMA = "0b8f2c1e-6a4d-4f3b-9c2a-7e5d1f0a3b6c";

function fakeDeps(opts: { enrolled?: boolean; prior?: number } = {}) {
  const saved: ScoreRow[] = [];
  const deps: AttemptDeps = {
    userFromToken: async (t) => (t === "tok-ana" ? "aluno-ana" : null),
    isEnrolled: async (turma, aluno) => (opts.enrolled ?? true) && turma === TURMA && aluno === "aluno-ana",
    priorAttempts: async () => opts.prior ?? 0,
    save: async (row) => void saved.push(row),
  };
  return { deps, saved };
}

const attempt = (desafio: string, extra: object = {}) => {
  const ch = challenges.find((c) => c.id === desafio)!;
  return { turma: TURMA, nome: "Ana", desafio, params: ch.reference.params, build: ch.reference.build, tentativas: 1, tempo_s: 40, ...extra };
};

describe("Edge Function desafio (lógica)", () => {
  it("requisição válida: refaz a avaliação e grava a pontuação calculada no servidor", async () => {
    const { deps, saved } = fakeDeps();
    const r = await handleAttempt(attempt("alvo-com-arrasto", { pontos: 999999, estrelas: 3 }), "tok-ana", deps);
    const ch = challenges.find((c) => c.id === "alvo-com-arrasto")!;
    const o = evaluateChallenge(ch, ch.reference);
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ ok: true, pontos: points(1, o, 1, 40), estrelas: 3, tentativas: 1, mensagem: o.message });
    expect(saved).toEqual([{ turma: TURMA, aluno: "aluno-ana", nome: "Ana", desafio: "alvo-com-arrasto", pontos: points(1, o, 1, 40), estrelas: stars(o), tentativas: 1, tempo_s: 40 }]);
  });

  it("monta no palco: a montagem enviada é avaliada de novo (e uma ruim não ganha 3 estrelas)", async () => {
    const { deps, saved } = fakeDeps();
    for (const id of ["hoquei-uma-carga", "circuito-economico", "millikan-gota-parada"]) {
      const good = await handleAttempt(attempt(id), "tok-ana", deps);
      expect(good.body, id).toMatchObject({ ok: true, estrelas: 3 });
      const ch = challenges.find((c) => c.id === id)!;
      const bad = await handleAttempt(attempt(id, { params: ch.bad.params, build: ch.bad.build }), "tok-ana", deps);
      expect((bad.body as { estrelas: number }).estrelas, id).toBeLessThan(3);
    }
    expect(saved).toHaveLength(6);
  });

  it("conta as tentativas que o servidor já viu", async () => {
    const { deps, saved } = fakeDeps({ prior: 4 });
    const r = await handleAttempt(attempt("alvo-com-arrasto", { tentativas: 1 }), "tok-ana", deps);
    expect(r.body).toMatchObject({ tentativas: 5 });
    expect(saved[0]!.tentativas).toBe(5);
    expect(saved[0]!.pontos).toBe(points(1, evaluateChallenge(challenges[0]!, challenges[0]!.reference), 5, 40));
  });

  it("desafio inexistente", async () => {
    const { deps, saved } = fakeDeps();
    const r = await handleAttempt(attempt("alvo-com-arrasto", { desafio: "nao-existe" }), "tok-ana", deps);
    expect(r).toEqual({ status: 404, body: { error: "desafio não encontrado" } });
    expect(saved).toHaveLength(0);
  });

  it("parâmetro fora da faixa, não liberado ou que não é número", async () => {
    const { deps, saved } = fakeDeps();
    expect(await handleAttempt(attempt("alvo-com-arrasto", { params: { v0: 1e6, angulo: 41 } }), "tok-ana", deps)).toEqual({ status: 422, body: { error: "parâmetro fora da faixa: v0" } });
    expect((await handleAttempt(attempt("alvo-com-arrasto", { params: { v0: 26, angulo: 41, g: 1 } }), "tok-ana", deps)).status).toBe(422);
    expect((await handleAttempt(attempt("alvo-com-arrasto", { params: { v0: "26" } }), "tok-ana", deps)).status).toBe(422);
    expect((await handleAttempt(attempt("alvo-com-arrasto", { params: { v0: Number.NaN } }), "tok-ana", deps)).status).toBe(422);
    expect(saved).toHaveLength(0);
  });

  it("usuário sem matrícula na turma, ou sem login", async () => {
    const { deps, saved } = fakeDeps({ enrolled: false });
    expect(await handleAttempt(attempt("alvo-com-arrasto"), "tok-ana", deps)).toEqual({ status: 403, body: { error: "você não está matriculado nesta turma" } });
    expect((await handleAttempt(attempt("alvo-com-arrasto"), "tok-forjado", deps)).status).toBe(401);
    expect((await handleAttempt(attempt("alvo-com-arrasto"), null, deps)).status).toBe(401);
    expect(saved).toHaveLength(0);
  });

  it("valida o corpo antes de avaliar", () => {
    const bad = (b: unknown) => ("error" in parseAttempt(b) ? (parseAttempt(b) as { error: { status: number } }).error.status : 200);
    expect(bad(null)).toBe(400);
    expect(bad("x")).toBe(400);
    expect(bad(attempt("alvo-com-arrasto", { turma: "minha-turma" }))).toBe(400);
    expect(bad(attempt("alvo-com-arrasto", { desafio: "../../x" }))).toBe(400);
    expect(bad(attempt("alvo-com-arrasto", { tentativas: 0 }))).toBe(400);
    expect(bad(attempt("alvo-com-arrasto", { tempo_s: -1 }))).toBe(400);
    expect(bad(attempt("hoquei-uma-carga", { build: undefined }))).toBe(422);
    expect(bad(attempt("braquistocrona", { build: Array.from({ length: 20000 }, () => [1.2345678, -0.1234567]) }))).toBe(413);
    expect(bad(attempt("braquistocrona"))).toBe(200);
  });

  it("o pacote para o Deno (scripts/bundle-desafio.mjs) é autossuficiente e avalia igual", async () => {
    type Mod = typeof import("../src/challenge-server.ts");
    const helper = (await import(/* @vite-ignore */ new URL("./challenges-bundle.mjs", import.meta.url).href)) as { withBundle<T>(fn: (m: Mod) => Promise<T>): Promise<T> };
    const viaBundle = await helper.withBundle((mod) => mod.handleAttempt(attempt("telescopio-20x"), "tok-ana", fakeDeps().deps));
    expect(viaBundle).toEqual(await handleAttempt(attempt("telescopio-20x"), "tok-ana", fakeDeps().deps));
  }, 60_000);
});
