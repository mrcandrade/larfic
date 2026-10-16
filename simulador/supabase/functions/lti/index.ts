// Edge Function `lti`: o FisiLab como ferramenta LTI 1.3 do Moodle.
// Rotas: /lti/login (iniciação OIDC), /lti/launch (id_token), /lti/jwks (chave pública), /lti/deeplink (devolve itens), /lti/score (nota).
// Segredos: LTI_PRIVATE_JWK (JWK RSA privado em JSON), LTI_KID, FISILAB_APP_URL (ex.: https://lab.exemplo.br/simulador/).
import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  buildAuthRedirect, deepLinkingResponse, encodeAssignment, importPrivateJwk, postScore, publicJwk, scoreBody, verifyLaunch,
  type ContentItem, type Launch, type Platform,
} from "../../../packages/platform/src/index.ts";
import { cors, json } from "../_shared/cors.ts";

const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const APP = Deno.env.get("FISILAB_APP_URL") ?? "";
const KID = Deno.env.get("LTI_KID") ?? "fisilab-1";
const privateJwk = JSON.parse(Deno.env.get("LTI_PRIVATE_JWK") ?? "{}") as JsonWebKey;

async function platformFor(iss: string, clientId?: string): Promise<Platform> {
  let q = supa.from("lti_plataformas").select("*").eq("issuer", iss);
  if (clientId) q = q.eq("client_id", clientId);
  const { data } = await q.limit(1).maybeSingle();
  if (!data) throw new Error("plataforma não registrada");
  return { issuer: data.issuer, clientId: data.client_id, deploymentIds: data.deployment_ids, authUrl: data.auth_url, tokenUrl: data.token_url, jwksUrl: data.jwks_url };
}

const form = async (req: Request) => Object.fromEntries((await req.formData()).entries()) as Record<string, string>;

/** Página que posta o JWT de volta ao Moodle (deep linking). */
const autoPost = (url: string, jwt: string) =>
  new Response(`<!doctype html><meta charset="utf-8"><form method="post" action="${url}"><input type="hidden" name="JWT" value="${jwt}"></form><script>document.forms[0].submit()</script>`, {
    headers: { "content-type": "text/html; charset=utf-8" },
  });

/** Cria (ou recupera) o perfil Supabase do usuário do Moodle e devolve um link mágico de login para o app. */
async function sessionLink(launch: Launch, iss: string, redirect: string): Promise<string> {
  const email = launch.email ?? `${launch.userId}@lti.${new URL(iss).hostname}`;
  const { data } = await supa.auth.admin.generateLink({ type: "magiclink", email, options: { redirectTo: redirect, data: { name: launch.name ?? "" } } });
  const userId = data.user?.id;
  if (userId) {
    await supa.from("lti_usuarios").upsert({ issuer: iss, sub: launch.userId, perfil: userId });
    if (launch.isInstructor) await supa.from("profiles").update({ role: "professor" }).eq("id", userId);
  }
  return data.properties?.action_link ?? redirect;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const path = new URL(req.url).pathname.replace(/^.*\/lti/, "");
  try {
    if (path === "/jwks") {
      const key = await crypto.subtle.importKey("jwk", { ...privateJwk, d: undefined, p: undefined, q: undefined, dp: undefined, dq: undefined, qi: undefined, key_ops: ["verify"] }, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, true, ["verify"]);
      return json({ keys: [await publicJwk(key, KID)] });
    }

    if (path === "/login") {
      const p = req.method === "POST" ? await form(req) : Object.fromEntries(new URL(req.url).searchParams);
      const platform = await platformFor(p.iss!, p.client_id);
      const state = crypto.randomUUID(), nonce = crypto.randomUUID();
      await supa.from("lti_estados").insert({ state, nonce, issuer: platform.issuer, client_id: platform.clientId });
      const redirect = `${new URL(req.url).origin}${new URL(req.url).pathname.replace(/\/login$/, "/launch")}`;
      return Response.redirect(buildAuthRedirect(platform, p as never, redirect, state, nonce), 302);
    }

    if (path === "/launch") {
      const p = await form(req);
      const { data: st } = await supa.from("lti_estados").delete().eq("state", p.state).select().maybeSingle();
      if (!st || Date.now() - Date.parse(st.criado_em) > 10 * 60_000) return json({ error: "estado de login inválido ou expirado" }, 400);
      const platform = await platformFor(st.issuer, st.client_id);
      const jwks = await (await fetch(platform.jwksUrl)).json();
      const launch = await verifyLaunch(p.id_token!, platform, jwks, st.nonce);

      if (launch.kind === "deep-linking") {
        // O professor escolhe as sims/atividades no painel do app, que volta para /lti/deeplink com a seleção.
        const ctx = encodeURIComponent(btoa(JSON.stringify({ iss: platform.issuer, cid: platform.clientId, dep: launch.deploymentId, ret: launch.deepLinking!.returnUrl, data: launch.deepLinking!.data ?? "" })));
        return Response.redirect(await sessionLink(launch, platform.issuer, `${APP}#/professor?lti=${ctx}`), 302);
      }

      // Lançamento de aluno: abre a atividade/sim pedida nos parâmetros personalizados.
      const c = launch.custom;
      const route = c.atividade ? `#/atividade/${c.atividade}` : c.pratica ? `#/pratica/${c.pratica}` : c.sim ? `#/sim/${c.sim}${c.cenario ? `?cenario=${c.cenario}` : ""}` : "#/";
      const grade = launch.ags?.lineitem ? `${route.includes("?") ? "&" : "?"}lti_li=${encodeURIComponent(launch.ags.lineitem)}&lti_iss=${encodeURIComponent(platform.issuer)}&lti_sub=${encodeURIComponent(launch.userId)}` : "";
      return Response.redirect(await sessionLink(launch, platform.issuer, `${APP}${route}${grade}`), 302);
    }

    if (path === "/deeplink" && req.method === "POST") {
      const f = await form(req);
      const lti = f.lti!;
      const items = JSON.parse(f.items ?? "[]") as ContentItem[];
      const ctx = JSON.parse(atob(decodeURIComponent(lti))) as { iss: string; cid: string; dep: string; ret: string; data: string };
      const platform = await platformFor(ctx.iss, ctx.cid);
      const key = await importPrivateJwk(privateJwk);
      const fake = { kind: "deep-linking", deploymentId: ctx.dep, deepLinking: { returnUrl: ctx.ret, data: ctx.data || undefined, acceptTypes: [] } } as unknown as Launch;
      const launchUrl = `${new URL(req.url).origin}${new URL(req.url).pathname.replace(/\/deeplink$/, "/login")}`;
      const resp = await deepLinkingResponse(fake, platform, items.map((i) => ({ ...i, url: i.url || launchUrl })), key, KID);
      return autoPost(resp.url, resp.jwt);
    }

    if (path === "/score" && req.method === "POST") {
      // Chamado pelo app com o token do aluno: { iss, sub, lineitem, nota (0–10) }.
      const token = req.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
      const { data: auth } = await supa.auth.getUser(token);
      if (!auth.user) return json({ error: "não autenticado" }, 401);
      const b = (await req.json()) as { iss: string; sub: string; lineitem: string; nota: number };
      const { data: link } = await supa.from("lti_usuarios").select("perfil").eq("issuer", b.iss).eq("sub", b.sub).maybeSingle();
      if (link?.perfil !== auth.user.id) return json({ error: "usuário LTI não confere" }, 403);
      const platform = await platformFor(b.iss);
      await postScore(platform, b.lineitem, scoreBody(b.sub, b.nota, 10), await importPrivateJwk(privateJwk), KID);
      return json({ ok: true });
    }

    void encodeAssignment;
    return json({ error: "rota desconhecida" }, 404);
  } catch (e) {
    return json({ error: String((e as Error).message ?? e) }, 400);
  }
});
