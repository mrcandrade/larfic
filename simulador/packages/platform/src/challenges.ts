// Ranking da turma no modo desafio (Supabase). O aluno entra na turma pelo código que o professor
// divulga; cada desafio guarda só a melhor pontuação dele, e só quem é da turma vê o ranking.
import type { Backend } from "./backend.ts";

export interface ChallengeScoreRow {
  turma: string;
  aluno?: string;
  /** Nome mostrado no ranking (o aluno escolhe no perfil). */
  nome: string;
  desafio: string;
  pontos: number;
  estrelas: number;
  tentativas: number;
  tempo_s: number;
  atualizado_em?: string;
}

export interface ClassInfo {
  id: string;
  nome: string;
}

export interface ClassRankRow {
  aluno: string;
  nome: string;
  pontos: number;
  estrelas: number;
  desafios: number;
}

/** Chama uma função SQL exposta pelo PostgREST (/rest/v1/rpc/<nome>) com a sessão do aluno. */
export async function rpc<T>(backend: Backend, fn: string, args: object, fetchFn: typeof fetch = (...a) => fetch(...a)): Promise<T> {
  const token = backend.session?.accessToken;
  if (!token) throw new Error("Entre com seu e-mail para usar o ranking da turma.");
  const r = await fetchFn(`${backend.cfg.url}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: backend.cfg.anonKey, authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(args),
  });
  const text = await r.text();
  const body = text ? (JSON.parse(text) as unknown) : null;
  if (!r.ok) throw new Error((body as { message?: string } | null)?.message ?? `HTTP ${r.status}`);
  return body as T;
}

/** Normaliza o código da turma digitado (sem espaços, minúsculas). */
export const normalizeClassCode = (code: string) => code.trim().toLowerCase().replace(/\s+/g, "");

/** Entra na turma pelo código (cria a matrícula se ainda não existir) e devolve id e nome. */
export async function joinClassByCode(backend: Backend, code: string, fetchFn?: typeof fetch): Promise<ClassInfo> {
  const c = normalizeClassCode(code);
  if (!/^[0-9a-z]{4,12}$/.test(c)) throw new Error("Código de turma inválido.");
  const rows = await rpc<ClassInfo[] | ClassInfo | null>(backend, "entrar_turma", { codigo_turma: c }, fetchFn);
  const info = Array.isArray(rows) ? rows[0] : rows;
  if (!info?.id) throw new Error("Turma não encontrada.");
  return info;
}

/** Envia uma pontuação; o servidor guarda só a melhor de cada aluno por desafio. */
export function submitChallengeScore(backend: Backend, row: Omit<ChallengeScoreRow, "aluno" | "atualizado_em">, fetchFn?: typeof fetch): Promise<unknown> {
  return rpc(
    backend,
    "registrar_desafio",
    {
      p_turma: row.turma,
      p_nome: row.nome.slice(0, 60),
      p_desafio: row.desafio,
      p_pontos: Math.max(0, Math.round(row.pontos)),
      p_estrelas: Math.max(0, Math.min(3, Math.round(row.estrelas))),
      p_tentativas: Math.max(1, Math.round(row.tentativas)),
      p_tempo_s: Math.max(0, Math.round(row.tempo_s)),
    },
    fetchFn,
  );
}

/** Linhas da turma (a política de RLS só devolve as de turmas em que o usuário está). */
export function fetchClassScores(backend: Backend, turma: string): Promise<ChallengeScoreRow[]> {
  return backend.select<ChallengeScoreRow>("desafio_pontos", `select=aluno,nome,desafio,pontos,estrelas,tentativas,tempo_s,atualizado_em&turma=eq.${encodeURIComponent(turma)}`);
}

/** Soma por aluno (melhor de cada desafio), ordenada por pontos, estrelas e nome. */
export function rankClass(rows: ChallengeScoreRow[], validIds?: Set<string>): ClassRankRow[] {
  const by = new Map<string, ClassRankRow & { seen: Map<string, ChallengeScoreRow> }>();
  for (const r of rows) {
    if (validIds && !validIds.has(r.desafio)) continue;
    const key = r.aluno ?? r.nome;
    let a = by.get(key);
    if (!a) by.set(key, (a = { aluno: key, nome: r.nome, pontos: 0, estrelas: 0, desafios: 0, seen: new Map() }));
    const prev = a.seen.get(r.desafio);
    if (!prev || r.pontos > prev.pontos) a.seen.set(r.desafio, r);
    if (r.nome && (!a.nome || (r.atualizado_em ?? "") >= (prev?.atualizado_em ?? ""))) a.nome = r.nome;
  }
  return [...by.values()]
    .map(({ seen, ...a }) => {
      const best = [...seen.values()];
      return { ...a, pontos: best.reduce((s, r) => s + r.pontos, 0), estrelas: best.reduce((s, r) => s + r.estrelas, 0), desafios: best.filter((r) => r.estrelas > 0).length };
    })
    .sort((x, y) => y.pontos - x.pontos || y.estrelas - x.estrelas || x.nome.localeCompare(y.nome, "pt-BR"));
}
