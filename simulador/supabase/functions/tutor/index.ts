// Edge Function `tutor`: repassa a conversa para a API da Anthropic com a chave guardada no servidor.
// Segredos: ANTHROPIC_API_KEY (obrigatório), TUTOR_MODEL (opcional), TUTOR_LIMITE_DIARIO (opcional).
import { createClient } from "jsr:@supabase/supabase-js@2";
import { cors, json } from "../_shared/cors.ts";

const MODEL = Deno.env.get("TUTOR_MODEL") ?? "claude-sonnet-5-5";
const LIMITE = Number(Deno.env.get("TUTOR_LIMITE_DIARIO") ?? "60");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "use POST" }, 405);
  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) return json({ error: "tutor não configurado" }, 503);

  // Só usuários logados; limite diário por aluno.
  const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const token = req.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  const { data: auth } = await supa.auth.getUser(token);
  if (!auth.user) return json({ error: "faça login para usar o tutor" }, 401);
  const { data: uso } = await supa.from("tutor_uso").select("perguntas").eq("aluno", auth.user.id).eq("dia", new Date().toISOString().slice(0, 10)).maybeSingle();
  if ((uso?.perguntas ?? 0) >= LIMITE) return json({ error: "limite diário de perguntas atingido" }, 429);

  const { system, messages } = (await req.json()) as { system: string; messages: { role: "user" | "assistant"; content: string }[] };
  if (typeof system !== "string" || !Array.isArray(messages) || !messages.length) return json({ error: "requisição inválida" }, 400);
  const clean = messages.slice(-12).map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content).slice(0, 4000) }));

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: MODEL, max_tokens: 700, system: system.slice(0, 12000), messages: clean }),
  });
  if (!r.ok) return json({ error: `IA indisponível (${r.status})` }, 502);
  const data = (await r.json()) as { content: { type: string; text?: string }[] };
  const answer = data.content.filter((c) => c.type === "text").map((c) => c.text).join("\n").trim();

  await supa.from("tutor_uso").upsert({ aluno: auth.user.id, dia: new Date().toISOString().slice(0, 10), perguntas: (uso?.perguntas ?? 0) + 1 });
  return json({ answer });
});
