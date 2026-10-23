// Auxiliar do teste do pacote da Edge Function (em .mjs porque o projeto não tem os tipos do Node):
// gera o pacote com scripts/bundle-desafio.mjs numa pasta temporária e o importa.
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export async function withBundle(fn) {
  const dir = mkdtempSync(join(tmpdir(), "desafio-"));
  try {
    execFileSync(process.execPath, [fileURLToPath(new URL("../../../scripts/bundle-desafio.mjs", import.meta.url)), dir], { stdio: "pipe" });
    return await fn(await import(pathToFileURL(join(dir, "avaliacao.js")).href));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
