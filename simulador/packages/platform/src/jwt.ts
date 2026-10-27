// JWT RS256 com WebCrypto (funciona no navegador, no Node 20+ e no Deno das Edge Functions).

const enc = new TextEncoder();
const dec = new TextDecoder();

export function b64url(data: Uint8Array | string): string {
  const bytes = typeof data === "string" ? enc.encode(data) : data;
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function b64urlDecode(s: string): Uint8Array<ArrayBuffer> {
  const pad = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  const bin = atob(pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export type JwtPayload = Record<string, unknown> & { iss?: string; aud?: string | string[]; sub?: string; exp?: number; iat?: number; nonce?: string };
export interface JwtHeader {
  alg: string;
  typ?: string;
  kid?: string;
}

const ALG = { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" } as const;

export async function generateKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey({ ...ALG, modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]) }, true, ["sign", "verify"]);
}

export const importPrivateJwk = (jwk: JsonWebKey) => crypto.subtle.importKey("jwk", jwk, ALG, false, ["sign"]);
export const importPublicJwk = (jwk: JsonWebKey) => crypto.subtle.importKey("jwk", jwk, ALG, false, ["verify"]);

/** Chave pública em JWK (para publicar no endpoint JWKS da ferramenta). */
export async function publicJwk(key: CryptoKey, kid: string): Promise<JsonWebKey & { kid: string; alg: string; use: string }> {
  const jwk = await crypto.subtle.exportKey("jwk", key);
  return { kty: jwk.kty, n: jwk.n, e: jwk.e, kid, alg: "RS256", use: "sig" };
}

export async function signJwt(payload: JwtPayload, key: CryptoKey, kid: string): Promise<string> {
  const head = b64url(JSON.stringify({ alg: "RS256", typ: "JWT", kid }));
  const body = b64url(JSON.stringify(payload));
  const sig = new Uint8Array(await crypto.subtle.sign(ALG, key, enc.encode(`${head}.${body}`)));
  return `${head}.${body}.${b64url(sig)}`;
}

export function decodeJwt(token: string): { header: JwtHeader; payload: JwtPayload; signed: string; signature: Uint8Array<ArrayBuffer> } {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("JWT malformado");
  const [h, p, s] = parts as [string, string, string];
  return {
    header: JSON.parse(dec.decode(b64urlDecode(h))) as JwtHeader,
    payload: JSON.parse(dec.decode(b64urlDecode(p))) as JwtPayload,
    signed: `${h}.${p}`,
    signature: b64urlDecode(s),
  };
}

export interface VerifyOptions {
  issuer?: string;
  audience?: string;
  nonce?: string;
  /** Tolerância de relógio, em segundos. */
  leeway?: number;
  now?: number;
}

/** Verifica assinatura RS256 (chave escolhida pelo kid no JWKS) e as declarações padrão. */
export async function verifyJwt(token: string, jwks: { keys: (JsonWebKey & { kid?: string })[] }, opts: VerifyOptions = {}): Promise<JwtPayload> {
  const { header, payload, signed, signature } = decodeJwt(token);
  if (header.alg !== "RS256") throw new Error(`algoritmo não aceito: ${header.alg}`);
  const jwk = jwks.keys.find((k) => !header.kid || k.kid === header.kid);
  if (!jwk) throw new Error("chave do emissor não encontrada no JWKS");
  const key = await importPublicJwk(jwk);
  if (!(await crypto.subtle.verify(ALG, key, signature, enc.encode(signed)))) throw new Error("assinatura inválida");
  const now = opts.now ?? Math.floor(Date.now() / 1000);
  const leeway = opts.leeway ?? 60;
  if (typeof payload.exp === "number" && now > payload.exp + leeway) throw new Error("token expirado");
  if (typeof payload.iat === "number" && payload.iat > now + leeway) throw new Error("token emitido no futuro");
  if (opts.issuer && payload.iss !== opts.issuer) throw new Error("emissor inesperado");
  if (opts.audience) {
    const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!aud.includes(opts.audience)) throw new Error("audiência inesperada");
    if (aud.length > 1 && payload.azp !== opts.audience) throw new Error("azp não confere");
  }
  if (opts.nonce !== undefined && payload.nonce !== opts.nonce) throw new Error("nonce não confere");
  return payload;
}
