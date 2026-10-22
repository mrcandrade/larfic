import { describe, expect, it } from "vitest";
import { pendulos } from "../../../sims/pendulos/src/index.ts";
import { defaultParams } from "@fisilab/core";
import {
  Backend, LTI, askTutor, buildAuthRedirect, buildContext, checkSubmission, classCsv, decodeAssignment, decodeJwt, deepLinkingResponse,
  encodeAssignment, generateKeyPair, grade, offlineTutor, postScore, publicJwk, scoreBody, scoresUrl, sealSubmission, signJwt, studentSeed,
  systemPrompt, verifyJwt, verifyLaunch, type Assignment, type Platform, type Submission,
} from "../src/index.ts";

const moodle: Platform = {
  issuer: "https://moodle.ufrgs.br",
  clientId: "fisilab-client",
  deploymentIds: ["1"],
  authUrl: "https://moodle.ufrgs.br/mod/lti/auth.php",
  tokenUrl: "https://moodle.ufrgs.br/mod/lti/token.php",
  jwksUrl: "https://moodle.ufrgs.br/mod/lti/certs.php",
};

describe("JWT RS256", () => {
  it("assina e verifica; rejeita adulteração, expiração e nonce", async () => {
    const kp = await generateKeyPair();
    const jwks = { keys: [await publicJwk(kp.publicKey, "k1")] };
    const now = 1_700_000_000;
    const tok = await signJwt({ iss: "a", aud: "b", exp: now + 60, nonce: "n" }, kp.privateKey, "k1");
    expect((await verifyJwt(tok, jwks, { issuer: "a", audience: "b", nonce: "n", now })).iss).toBe("a");
    const [h, , s] = tok.split(".");
    const forged = `${h}.${btoa(JSON.stringify({ iss: "a", aud: "b", exp: now + 60, nonce: "n", admin: true })).replace(/=+$/, "")}.${s}`;
    await expect(verifyJwt(forged, jwks, { now })).rejects.toThrow("assinatura");
    await expect(verifyJwt(tok, jwks, { now: now + 1000 })).rejects.toThrow("expirado");
    await expect(verifyJwt(tok, jwks, { nonce: "x", now })).rejects.toThrow("nonce");
  });
});

describe("LTI 1.3 com Moodle", () => {
  it("monta o redirecionamento OIDC", () => {
    const u = new URL(buildAuthRedirect(moodle, { iss: moodle.issuer, login_hint: "42", target_link_uri: "https://fisilab/lti", lti_message_hint: "m" }, "https://fisilab/lti/launch", "st", "no"));
    expect(u.origin + u.pathname).toBe(moodle.authUrl);
    expect(u.searchParams.get("response_mode")).toBe("form_post");
    expect(u.searchParams.get("nonce")).toBe("no");
    expect(u.searchParams.get("lti_message_hint")).toBe("m");
  });

  it("valida lançamento de professor com deep linking e devolve itens assinados", async () => {
    const platformKeys = await generateKeyPair();
    const toolKeys = await generateKeyPair();
    const jwks = { keys: [await publicJwk(platformKeys.publicKey, "moodle")] };
    const now = Math.floor(Date.now() / 1000);
    const c = LTI.claims;
    const idToken = await signJwt(
      {
        iss: moodle.issuer, aud: moodle.clientId, sub: "7", iat: now, exp: now + 60, nonce: "abc", name: "Profa. Ana",
        [c.version]: "1.3.0", [c.deploymentId]: "1", [c.messageType]: "LtiDeepLinkingRequest",
        [c.roles]: ["http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor"],
        [c.context]: { id: "FIS01181", title: "Física Geral I" },
        [c.dlSettings]: { deep_link_return_url: "https://moodle.ufrgs.br/mod/lti/contentitem_return.php", data: "xyz", accept_types: ["ltiResourceLink"] },
      },
      platformKeys.privateKey,
      "moodle",
    );
    const launch = await verifyLaunch(idToken, moodle, jwks, "abc");
    expect(launch.kind).toBe("deep-linking");
    expect(launch.isInstructor).toBe(true);
    expect(launch.contextTitle).toBe("Física Geral I");
    const resp = await deepLinkingResponse(launch, moodle, [{ title: "Pêndulo", url: "https://fisilab/lti/launch", custom: { sim: "pendulos" }, lineItem: { scoreMaximum: 10, label: "Pêndulo" } }], toolKeys.privateKey, "tool");
    const { payload } = decodeJwt(resp.jwt);
    expect(payload.aud).toBe(moodle.issuer);
    expect(payload[c.dlData]).toBe("xyz");
    expect((payload[c.dlItems] as { custom: { sim: string } }[])[0]!.custom.sim).toBe("pendulos");
  });

  it("rejeita deployment desconhecido", async () => {
    const kp = await generateKeyPair();
    const now = Math.floor(Date.now() / 1000);
    const c = LTI.claims;
    const tok = await signJwt({ iss: moodle.issuer, aud: moodle.clientId, sub: "1", exp: now + 60, nonce: "n", [c.version]: "1.3.0", [c.deploymentId]: "99", [c.messageType]: "LtiResourceLinkRequest", [c.resourceLink]: { id: "r" } }, kp.privateKey, "k");
    await expect(verifyLaunch(tok, moodle, { keys: [await publicJwk(kp.publicKey, "k")] }, "n")).rejects.toThrow("deployment");
  });

  it("envia nota pelo AGS", async () => {
    const kp = await generateKeyPair();
    const calls: { url: string; body: string; auth?: string }[] = [];
    const fake = (async (url: string, init: RequestInit) => {
      calls.push({ url, body: String(init.body), auth: (init.headers as Record<string, string>).authorization });
      return new Response(url.includes("token") ? JSON.stringify({ access_token: "T" }) : "{}", { status: 200 });
    }) as unknown as typeof fetch;
    const li = "https://moodle.ufrgs.br/mod/lti/services.php/2/lineitems/5/lineitem?type_id=1";
    expect(scoresUrl(li)).toBe("https://moodle.ufrgs.br/mod/lti/services.php/2/lineitems/5/lineitem/scores?type_id=1");
    await postScore(moodle, li, scoreBody("7", 8.5, 10), kp.privateKey, "k", fake);
    expect(calls[0]!.body).toContain("client_credentials");
    expect(calls[1]!.auth).toBe("Bearer T");
    expect(JSON.parse(calls[1]!.body).scoreGiven).toBe(8.5);
  });
});

describe("atividades", () => {
  const a: Assignment = { v: 1, title: "Lista 3 — pêndulo", kind: "sim", target: "pendulos", scenario: "grande", locked: ["g"], perExercise: 2 };
  it("codifica e decodifica no link", () => {
    expect(decodeAssignment(encodeAssignment(a))).toEqual(a);
    expect(() => decodeAssignment("lixo")).toThrow();
  });
  it("sementes por aluno são estáveis e diferentes entre alunos", () => {
    expect(studentSeed("001", "c", "e", 0)).toBe(studentSeed("001", "c", "e", 0));
    expect(studentSeed("001", "c", "e", 0)).not.toBe(studentSeed("002", "c", "e", 0));
  });
  it("nota, lacre e planilha", async () => {
    const s: Submission = {
      v: 1, assignment: "c", student: { id: "001", name: "Bia" }, startedAt: "x", submittedAt: "y",
      exercises: [{ exercise: "simples", seed: 1, answer: 2, correct: true, tries: 1 }, { exercise: "barra", seed: 2, answer: 1, correct: false, tries: 3 }],
      predictions: [{ question: "q", chosen: 2, correct: true }],
    };
    expect(grade(a, s)).toBe(5);
    expect(grade({ ...a, weights: { exercises: 7, practice: 0, prediction: 3 } }, s)).toBe(6.5);
    const sealed = await sealSubmission(s);
    expect(await checkSubmission(sealed)).toBe(true);
    expect(await checkSubmission({ ...sealed, exercises: sealed.exercises.map((e) => ({ ...e, correct: true })) })).toBe(false);
    expect(classCsv(a, [s]).split("\n")[1]).toContain("001;Bia");
  });
});

describe("tutor", () => {
  const ctx = buildContext(pendulos, defaultParams(pendulos), [30, 0, 30, 1, 2, 2.03], 0.5, "grande", "Qual o período de um pêndulo de 2 m?");
  it("contexto e prompt carregam os valores atuais", () => {
    const sp = systemPrompt(ctx);
    expect(sp).toContain("Pêndulos");
    expect(sp).toContain("Comprimento = 1 m");
    expect(sp).toContain("Grande amplitude");
    expect(sp).toMatch(/Nunca entregue a resposta/);
  });
  it("offline não entrega resposta e cai para reserva quando a rede falha", async () => {
    expect(offlineTutor(ctx, "qual o valor da resposta?")).toMatch(/equação/);
    const failing = (async () => { throw new Error("rede"); }) as unknown as typeof fetch;
    const r = await askTutor(ctx, [], "por que o período aumenta?", { endpoint: "https://x", fetchFn: failing });
    expect(r.offline).toBe(true);
    const ok = (async () => new Response(JSON.stringify({ answer: "Pense em sen θ." }))) as unknown as typeof fetch;
    expect((await askTutor(ctx, [], "oi", { endpoint: "https://x", fetchFn: ok })).answer).toBe("Pense em sen θ.");
  });
});

describe("backend", () => {
  it("login por código e inserção com token do usuário", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fake = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      if (url.endsWith("/auth/v1/verify")) return new Response(JSON.stringify({ access_token: "U", refresh_token: "R", expires_in: 3600, user: { id: "u1", email: "a@b" } }));
      return new Response("[]", { status: 201 });
    }) as unknown as typeof fetch;
    const b = new Backend({ url: "https://p.supabase.co", anonKey: "anon" }, fake);
    await b.sendCode("a@b");
    await b.verifyCode("a@b", "123456");
    await b.insert("submissions", { x: 1 });
    expect(calls[2]!.url).toBe("https://p.supabase.co/rest/v1/submissions");
    expect((calls[2]!.init.headers as Record<string, string>).authorization).toBe("Bearer U");
  });
});
