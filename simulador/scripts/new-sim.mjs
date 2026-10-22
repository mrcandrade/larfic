#!/usr/bin/env node
// Cria o esqueleto de uma simulação nova e a registra no app.
// Uso: node scripts/new-sim.mjs <id> "<Título>" "<FG I|FG II|...>" "<Tópico>"
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const [id, title, course = "FG I", topic = ""] = process.argv.slice(2);
if (!id || !title || !/^[a-z0-9-]+$/.test(id)) {
  console.error('Uso: node scripts/new-sim.mjs <id-em-kebab-case> "<Título>" "<Disciplina>" "<Tópico>"');
  process.exit(1);
}
const dir = join(root, "sims", id);
if (existsSync(dir)) {
  console.error(`sims/${id} já existe`);
  process.exit(1);
}
const camel = id.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
const pkg = `@fisilab/sim-${id}`;

mkdirSync(join(dir, "src"), { recursive: true });
mkdirSync(join(dir, "test"), { recursive: true });
writeFileSync(
  join(dir, "package.json"),
  JSON.stringify({ name: pkg, version: "0.1.0", private: true, type: "module", exports: { ".": "./src/index.ts" }, dependencies: { "@fisilab/core": "workspace:*" } }, null, 2) + "\n",
);
writeFileSync(
  join(dir, "src", "index.ts"),
  `import { defineSim, draw } from "@fisilab/core";

export const ${camel} = defineSim({
  id: "${id}",
  title: "${title}",
  course: "${course}",
  topic: "${topic}",
  priority: "P1",
  summary: "",
  equations: [],
  params: [{ key: "a", label: "Parâmetro", unit: "", min: 0, max: 1, step: 0.01, default: 0.5 }],
  observables: [{ key: "x", label: "x", unit: "m", value: (s) => s[0] ?? 0 }],
  scenarios: [],
  init: () => [0, 0],
  derivatives: ([, v = 0]) => [v, 0],
  viewport: () => ({ xMin: -1, xMax: 1, yMin: -1, yMax: 1, unit: "m" }),
  render(ctx, frame) {
    const d = draw(ctx, frame);
    d.dot(frame.state[0] ?? 0, 0, 6, frame.theme.accent);
  },
});

export default ${camel};
`,
);
writeFileSync(
  join(dir, "test", `${id}.test.ts`),
  `import { describe, expect, it } from "vitest";
import { Runner, defaultParams } from "@fisilab/core";
import { ${camel} as sim } from "../src/index.ts";

describe("${title}", () => {
  it("roda", () => {
    const r = new Runner(sim, defaultParams(sim));
    r.stepOnce();
    expect(Number.isFinite(r.observe()[0]!)).toBe(true);
  });
});
`,
);

// Registra no app: dependência e catálogo.
const webPkgPath = join(root, "apps", "web", "package.json");
const webPkg = JSON.parse(readFileSync(webPkgPath, "utf8"));
webPkg.dependencies[pkg] = "workspace:*";
webPkg.dependencies = Object.fromEntries(Object.entries(webPkg.dependencies).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync(webPkgPath, JSON.stringify(webPkg, null, 2) + "\n");

const catPath = join(root, "apps", "web", "src", "catalog.ts");
let cat = readFileSync(catPath, "utf8");
cat = cat.replace(/(import \{ plan)/, `import { ${camel} } from "${pkg}";\n$1`);
cat = cat.replace(/(\n\];\n\nexport const simulations)/, `\n  { sim: ${camel}, covers: [] },$1`);
writeFileSync(catPath, cat);

console.log(`Criada sims/${id}. Rode \`pnpm install\` e preencha \`covers\` em apps/web/src/catalog.ts.`);
