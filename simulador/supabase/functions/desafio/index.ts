// Edge Function `desafio`: recebe a tentativa do aluno (parâmetros e montagem, não a pontuação), refaz a
// avaliação com o mesmo código do app e grava a pontuação com a service role.
// A lógica fica em apps/web/src/challenge-server.ts; `avaliacao.js` é o pacote gerado dela, com as
// simulações dentro: rode `node scripts/bundle-desafio.mjs` antes de `supabase functions deploy desafio`.
import { createClient } from "jsr:@supabase/supabase-js@2";
// @deno-types="./avaliacao.d.ts"
import { handleAttempt } from "./avaliacao.js";
import { cors, json } from "../_shared/cors.ts";

const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "use POST" }, 405);
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "requisição inválida" }, 400);
  }
  const token = req.headers.get("authorization")?.replace(/^Bearer /, "") ?? null;
  try {
    const r = await handleAttempt(body, token, {
      async userFromToken(t) {
        const { data } = await supa.auth.getUser(t);
        return data.user?.id ?? null;
      },
      async isEnrolled(turma, aluno) {
        const { data } = await supa.from("matriculas").select("aluno").eq("turma", turma).eq("aluno", aluno).maybeSingle();
        return !!data;
      },
      async priorAttempts(turma, aluno, desafio) {
        const { data } = await supa.from("desafio_pontos").select("tentativas").eq("turma", turma).eq("aluno", aluno).eq("desafio", desafio).maybeSingle();
        return data?.tentativas ?? 0;
      },
      async save(row) {
        const { error } = await supa.rpc("registrar_desafio_servidor", {
          p_turma: row.turma,
          p_aluno: row.aluno,
          p_nome: row.nome,
          p_desafio: row.desafio,
          p_pontos: row.pontos,
          p_estrelas: row.estrelas,
          p_tentativas: row.tentativas,
          p_tempo_s: row.tempo_s,
        });
        if (error) throw new Error(error.message);
      },
    });
    return json(r.body, r.status);
  } catch (e) {
    return json({ error: `não foi possível registrar: ${(e as Error).message}` }, 500);
  }
});
