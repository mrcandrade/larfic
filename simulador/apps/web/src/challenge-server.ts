// Lógica da Edge Function `desafio`: recebe a tentativa (parâmetros e montagem), refaz a avaliação com
// o mesmo código do app e grava a pontuação calculada aqui, nunca a que o navegador diz ter feito.
// Puro e com as dependências injetadas (usuário, matrícula, gravação), para testar sem Deno nem Supabase;
// scripts/bundle-desafio.mjs empacota este arquivo (com challenge-core.ts e as simulações) para o Deno.
import { challengeSim, evaluateChallenge, findChallenge, points, stars } from "./challenge-core.ts";

/** Corpo da requisição enviada pelo app. */
export interface AttemptRequest {
  turma: string;
  nome?: string;
  desafio: string;
  params: Record<string, number>;
  build?: unknown;
  tentativas: number;
  tempo_s: number;
}

export interface ScoreRow {
  turma: string;
  aluno: string;
  nome: string;
  desafio: string;
  pontos: number;
  estrelas: number;
  tentativas: number;
  tempo_s: number;
}

export interface AttemptDeps {
  /** Id do usuário dono do token (null se o token não vale). */
  userFromToken(token: string): Promise<string | null>;
  /** O aluno está matriculado na turma? */
  isEnrolled(turma: string, aluno: string): Promise<boolean>;
  /** Tentativas que o servidor já avaliou deste aluno neste desafio e turma. */
  priorAttempts(turma: string, aluno: string, desafio: string): Promise<number>;
  /** Grava a tentativa mantendo a melhor pontuação (com a service role). */
  save(row: ScoreRow): Promise<void>;
}

export interface AttemptResponse {
  status: number;
  body: { error: string } | { ok: boolean; pontos: number; estrelas: number; tentativas: number; mensagem: string };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Limite do tamanho da montagem (a curva desenhada mais longa tem 5000 pontos). */
export const MAX_BUILD_BYTES = 200_000;

const err = (status: number, error: string): AttemptResponse => ({ status, body: { error } });

/** Valida a tentativa; devolve a mensagem de erro (e o status) ou a tentativa limpa. */
export function parseAttempt(body: unknown): { error: AttemptResponse } | { req: AttemptRequest } {
  if (!body || typeof body !== "object") return { error: err(400, "requisição inválida") };
  const b = body as Record<string, unknown>;
  if (typeof b.desafio !== "string" || !/^[a-z0-9-]{1,64}$/.test(b.desafio)) return { error: err(400, "desafio inválido") };
  const ch = findChallenge(b.desafio);
  if (!ch) return { error: err(404, "desafio não encontrado") };
  if (typeof b.turma !== "string" || !UUID.test(b.turma)) return { error: err(400, "turma inválida") };
  if (!b.params || typeof b.params !== "object" || Array.isArray(b.params)) return { error: err(400, "parâmetros inválidos") };
  const sim = challengeSim(ch.sim)!;
  const params: Record<string, number> = {};
  for (const [k, v] of Object.entries(b.params as Record<string, unknown>)) {
    if (!ch.knobs.includes(k)) return { error: err(422, `o parâmetro ${k} não é liberado neste desafio`) };
    const spec = sim.params.find((p) => p.key === k)!;
    if (typeof v !== "number" || !Number.isFinite(v) || v < spec.min || v > spec.max) return { error: err(422, `parâmetro fora da faixa: ${k}`) };
    params[k] = v;
  }
  if (ch.build) {
    if (b.build === undefined || b.build === null) return { error: err(422, "falta a montagem no palco") };
    if (JSON.stringify(b.build).length > MAX_BUILD_BYTES) return { error: err(413, "montagem grande demais") };
  }
  const tentativas = b.tentativas;
  const tempo = b.tempo_s;
  if (typeof tentativas !== "number" || !Number.isInteger(tentativas) || tentativas < 1 || tentativas > 100_000) return { error: err(400, "número de tentativas inválido") };
  if (typeof tempo !== "number" || !Number.isFinite(tempo) || tempo < 0 || tempo > 1e7) return { error: err(400, "tempo inválido") };
  const nome = typeof b.nome === "string" ? b.nome.slice(0, 60) : "";
  return { req: { turma: b.turma.toLowerCase(), nome, desafio: ch.id, params, build: ch.build ? b.build : undefined, tentativas, tempo_s: tempo } };
}

/**
 * Trata uma tentativa: confere o usuário e a matrícula, refaz a avaliação e grava a pontuação.
 * O número de tentativas usado na conta é o maior entre o informado e o que o servidor já viu.
 */
export async function handleAttempt(body: unknown, token: string | null, deps: AttemptDeps): Promise<AttemptResponse> {
  const parsed = parseAttempt(body);
  if ("error" in parsed) return parsed.error;
  const { req } = parsed;
  const aluno = token ? await deps.userFromToken(token) : null;
  if (!aluno) return err(401, "entre com seu e-mail para pontuar na turma");
  if (!(await deps.isEnrolled(req.turma, aluno))) return err(403, "você não está matriculado nesta turma");

  const ch = findChallenge(req.desafio)!;
  const outcome = evaluateChallenge(ch, { params: req.params, build: req.build });
  const tentativas = Math.max(req.tentativas, (await deps.priorAttempts(req.turma, aluno, ch.id)) + 1);
  const estrelas = stars(outcome);
  const pontos = points(ch.level, outcome, tentativas, req.tempo_s);
  await deps.save({ turma: req.turma, aluno, nome: req.nome ?? "", desafio: ch.id, pontos, estrelas, tentativas, tempo_s: Math.round(req.tempo_s) });
  return { status: 200, body: { ok: outcome.ok, pontos, estrelas, tentativas, mensagem: outcome.message } };
}
