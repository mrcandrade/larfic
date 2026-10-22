// LTI 1.3 (IMS): o FisiLab como ferramenta externa do Moodle.
// Lógica pura e testável; as Edge Functions em supabase/functions/lti só fazem o transporte HTTP.
import { signJwt, verifyJwt, type JwtPayload } from "./jwt.ts";

export const LTI = {
  version: "1.3.0",
  claims: {
    messageType: "https://purl.imsglobal.org/spec/lti/claim/message_type",
    version: "https://purl.imsglobal.org/spec/lti/claim/version",
    deploymentId: "https://purl.imsglobal.org/spec/lti/claim/deployment_id",
    targetLink: "https://purl.imsglobal.org/spec/lti/claim/target_link_uri",
    resourceLink: "https://purl.imsglobal.org/spec/lti/claim/resource_link",
    roles: "https://purl.imsglobal.org/spec/lti/claim/roles",
    context: "https://purl.imsglobal.org/spec/lti/claim/context",
    custom: "https://purl.imsglobal.org/spec/lti/claim/custom",
    ags: "https://purl.imsglobal.org/spec/lti-ags/claim/endpoint",
    dlSettings: "https://purl.imsglobal.org/spec/lti-dl/claim/deep_linking_settings",
    dlItems: "https://purl.imsglobal.org/spec/lti-dl/claim/content_items",
    dlData: "https://purl.imsglobal.org/spec/lti-dl/claim/data",
  },
  scopes: {
    lineitem: "https://purl.imsglobal.org/spec/lti-ags/scope/lineitem",
    score: "https://purl.imsglobal.org/spec/lti-ags/scope/score",
    resultRead: "https://purl.imsglobal.org/spec/lti-ags/scope/result.readonly",
  },
} as const;

/** Uma plataforma (instalação do Moodle) registrada na ferramenta. */
export interface Platform {
  issuer: string;
  clientId: string;
  deploymentIds: string[];
  /** Endpoint de autenticação OIDC do Moodle: <moodle>/mod/lti/auth.php */
  authUrl: string;
  /** <moodle>/mod/lti/token.php */
  tokenUrl: string;
  /** <moodle>/mod/lti/certs.php */
  jwksUrl: string;
}

export interface LoginRequest {
  iss: string;
  login_hint: string;
  target_link_uri: string;
  lti_message_hint?: string;
  client_id?: string;
  lti_deployment_id?: string;
}

/** Passo 1 (iniciação OIDC): monta o redirecionamento para o Moodle com state e nonce. */
export function buildAuthRedirect(platform: Platform, req: LoginRequest, redirectUri: string, state: string, nonce: string): string {
  const u = new URL(platform.authUrl);
  const q = {
    scope: "openid",
    response_type: "id_token",
    response_mode: "form_post",
    prompt: "none",
    client_id: platform.clientId,
    redirect_uri: redirectUri,
    login_hint: req.login_hint,
    state,
    nonce,
    ...(req.lti_message_hint ? { lti_message_hint: req.lti_message_hint } : {}),
  };
  for (const [k, v] of Object.entries(q)) u.searchParams.set(k, v);
  return u.toString();
}

export type LaunchKind = "resource" | "deep-linking";

export interface Launch {
  kind: LaunchKind;
  userId: string;
  name?: string;
  email?: string;
  roles: string[];
  isInstructor: boolean;
  contextId?: string;
  contextTitle?: string;
  resourceLinkId?: string;
  /** Parâmetros personalizados (ex.: sim=pendulos, cenario=grande, atividade=<código>). */
  custom: Record<string, string>;
  targetLink?: string;
  ags?: { lineitem?: string; lineitems?: string; scope: string[] };
  deepLinking?: { returnUrl: string; data?: string; acceptTypes: string[] };
  deploymentId: string;
  raw: JwtPayload;
}

/** Passo 2: valida o id_token postado pelo Moodle e extrai o que a ferramenta precisa. */
export async function verifyLaunch(idToken: string, platform: Platform, jwks: { keys: JsonWebKey[] }, nonce: string, now?: number): Promise<Launch> {
  const p = await verifyJwt(idToken, jwks, { issuer: platform.issuer, audience: platform.clientId, nonce, now });
  const c = LTI.claims;
  if (p[c.version] !== LTI.version) throw new Error("versão LTI não suportada");
  const deploymentId = String(p[c.deploymentId] ?? "");
  if (!platform.deploymentIds.includes(deploymentId)) throw new Error("deployment não registrado");
  const type = p[c.messageType];
  if (type !== "LtiResourceLinkRequest" && type !== "LtiDeepLinkingRequest") throw new Error(`mensagem LTI não suportada: ${String(type)}`);
  const roles = (p[c.roles] as string[] | undefined) ?? [];
  const ctx = p[c.context] as { id?: string; title?: string } | undefined;
  const rl = p[c.resourceLink] as { id?: string } | undefined;
  const ags = p[c.ags] as Launch["ags"] | undefined;
  const dl = p[c.dlSettings] as { deep_link_return_url: string; data?: string; accept_types?: string[] } | undefined;
  if (type === "LtiResourceLinkRequest" && !rl?.id) throw new Error("resource_link ausente");
  if (type === "LtiDeepLinkingRequest" && !dl?.deep_link_return_url) throw new Error("deep_linking_settings ausente");
  return {
    kind: type === "LtiDeepLinkingRequest" ? "deep-linking" : "resource",
    userId: String(p.sub ?? ""),
    name: p.name as string | undefined,
    email: p.email as string | undefined,
    roles,
    isInstructor: roles.some((r) => /#(Instructor|Administrator|ContentDeveloper|TeachingAssistant)$/.test(r) || /membership#Instructor/.test(r)),
    contextId: ctx?.id,
    contextTitle: ctx?.title,
    resourceLinkId: rl?.id,
    custom: Object.fromEntries(Object.entries((p[c.custom] as Record<string, unknown>) ?? {}).map(([k, v]) => [k, String(v)])),
    targetLink: p[c.targetLink] as string | undefined,
    ags,
    deepLinking: dl ? { returnUrl: dl.deep_link_return_url, data: dl.data, acceptTypes: dl.accept_types ?? [] } : undefined,
    deploymentId,
    raw: p,
  };
}

export interface ContentItem {
  title: string;
  url: string;
  text?: string;
  /** Parâmetros devolvidos no lançamento (claim custom). */
  custom?: Record<string, string>;
  /** Cria item de nota no Moodle. */
  lineItem?: { scoreMaximum: number; label: string; resourceId?: string };
}

/** Deep linking: o professor escolhe sims/atividades no FisiLab e elas viram atividades no curso. */
export async function deepLinkingResponse(launch: Launch, platform: Platform, items: ContentItem[], key: CryptoKey, kid: string, now = Math.floor(Date.now() / 1000)): Promise<{ url: string; jwt: string }> {
  if (!launch.deepLinking) throw new Error("não é um lançamento de deep linking");
  const c = LTI.claims;
  const jwt = await signJwt(
    {
      iss: platform.clientId,
      aud: platform.issuer,
      iat: now,
      exp: now + 300,
      nonce: crypto.randomUUID(),
      [c.messageType]: "LtiDeepLinkingResponse",
      [c.version]: LTI.version,
      [c.deploymentId]: launch.deploymentId,
      ...(launch.deepLinking.data ? { [c.dlData]: launch.deepLinking.data } : {}),
      [c.dlItems]: items.map((i) => ({
        type: "ltiResourceLink",
        title: i.title,
        url: i.url,
        ...(i.text ? { text: i.text } : {}),
        ...(i.custom ? { custom: i.custom } : {}),
        ...(i.lineItem ? { lineItem: i.lineItem } : {}),
      })),
    },
    key,
    kid,
  );
  return { url: launch.deepLinking.returnUrl, jwt };
}

/** Asserção JWT para obter token de acesso (client_credentials) no Moodle. */
export function clientAssertion(platform: Platform, key: CryptoKey, kid: string, now = Math.floor(Date.now() / 1000)): Promise<string> {
  return signJwt({ iss: platform.clientId, sub: platform.clientId, aud: platform.tokenUrl, iat: now, exp: now + 300, jti: crypto.randomUUID() }, key, kid);
}

export function tokenRequestBody(assertion: string, scopes: string[]): URLSearchParams {
  return new URLSearchParams({
    grant_type: "client_credentials",
    client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
    client_assertion: assertion,
    scope: scopes.join(" "),
  });
}

/** Corpo de nota (AGS) para o aluno: devolve a nota da atividade ao Moodle. */
export function scoreBody(userId: string, scoreGiven: number, scoreMaximum: number, comment?: string, timestamp = new Date().toISOString()) {
  return {
    userId,
    scoreGiven: Math.max(0, Math.min(scoreMaximum, scoreGiven)),
    scoreMaximum,
    activityProgress: "Completed",
    gradingProgress: "FullyGraded",
    timestamp,
    ...(comment ? { comment } : {}),
  };
}

/** URL de envio de notas: <lineitem>/scores, preservando a query string do Moodle. */
export function scoresUrl(lineitem: string): string {
  const u = new URL(lineitem);
  u.pathname = u.pathname.replace(/\/$/, "") + "/scores";
  return u.toString();
}

/** Envia a nota pelo AGS (fetch injetável para teste). */
export async function postScore(platform: Platform, lineitem: string, body: ReturnType<typeof scoreBody>, key: CryptoKey, kid: string, fetchFn: typeof fetch = fetch): Promise<void> {
  const tok = await fetchFn(platform.tokenUrl, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: tokenRequestBody(await clientAssertion(platform, key, kid), [LTI.scopes.score]) });
  if (!tok.ok) throw new Error(`token AGS: ${tok.status}`);
  const { access_token } = (await tok.json()) as { access_token: string };
  const r = await fetchFn(scoresUrl(lineitem), {
    method: "POST",
    headers: { authorization: `Bearer ${access_token}`, "content-type": "application/vnd.ims.lis.v1.score+json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`envio de nota: ${r.status}`);
}
