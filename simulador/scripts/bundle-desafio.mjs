// Empacota a avaliação dos desafios (apps/web/src/challenge-server.ts, com challenge-core.ts e as
// simulações que ela usa) num único módulo ES sem dependências, que a Edge Function `desafio` importa.
// O Deno não resolve os pacotes do workspace (@fisilab/*), por isso o pacote.
// Uso: node scripts/bundle-desafio.mjs [pasta de saída]   (padrão: supabase/functions/desafio)
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const web = resolve(root, "apps/web");
const outDir = resolve(process.argv[2] ?? resolve(root, "supabase/functions/desafio"));

// O Vite (com o rolldown) já está instalado para o app; usa o mesmo.
const require = createRequire(resolve(web, "package.json"));
const { build } = await import(pathToFileURL(require.resolve("vite")).href);

await build({
  root: web,
  configFile: false,
  logLevel: "warn",
  publicDir: false,
  build: {
    outDir,
    emptyOutDir: false,
    minify: false,
    sourcemap: false,
    target: "es2022",
    copyPublicDir: false,
    lib: { entry: resolve(web, "src/challenge-server.ts"), formats: ["es"], fileName: () => "avaliacao.js" },
  },
});
console.log(`Pacote gerado em ${resolve(outDir, "avaliacao.js")}`);
