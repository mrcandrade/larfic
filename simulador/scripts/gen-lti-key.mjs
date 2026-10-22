#!/usr/bin/env node
// Gera o par de chaves RSA da ferramenta LTI e imprime o JWK privado (guarde como segredo LTI_PRIVATE_JWK).
const { privateKey } = await crypto.subtle.generateKey(
  { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]) },
  true,
  ["sign", "verify"],
);
console.log(JSON.stringify(await crypto.subtle.exportKey("jwk", privateKey)));
