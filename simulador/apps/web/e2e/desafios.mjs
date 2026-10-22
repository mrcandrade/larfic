// Teste no navegador dos desafios de montar no palco: arrasta cargas, lentes e o objeto, desenha a curva,
// monta o circuito e escolhe a gota de verdade (eventos de ponteiro no canvas), clica em "Avaliar tentativa"
// e confere a mensagem, as estrelas e os pontos mostrados.
//
// Uso (com o app servido, por exemplo `cd apps/web && npx vite build && npx vite preview --port 4191`):
//   E2E_URL=http://localhost:4191/ PLAYWRIGHT=/caminho/para/node_modules/playwright node apps/web/e2e/desafios.mjs [id ...]
// PLAYWRIGHT é o pacote playwright a usar (padrão: "playwright", resolvido normalmente);
// CHROMIUM é o executável do navegador (padrão: o do Playwright, ou /opt/pw-browsers/... se existir).
// SHOTS=<pasta> guarda uma captura de cada desafio depois da avaliação.
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const BASE = (process.env.E2E_URL ?? "http://localhost:4191/").replace(/\/?$/, "/");
const pwSpec = process.env.PLAYWRIGHT ?? "playwright";
const { chromium } = await import(pwSpec.startsWith("/") ? pathToFileURL(join(pwSpec, "index.mjs")).href : pwSpec);

function chromiumPath() {
  if (process.env.CHROMIUM) return process.env.CHROMIUM;
  const dir = "/opt/pw-browsers";
  if (!existsSync(dir)) return undefined;
  const c = readdirSync(dir).filter((d) => d.startsWith("chromium-")).sort().pop();
  const exe = c && join(dir, c, "chrome-linux", "chrome");
  return exe && existsSync(exe) ? exe : undefined;
}

// ------------------------------------------------------------------ palco

const PAD = 28;

/** Converte coordenadas do mundo da simulação em pixels da página (mesma conta do Stage). */
async function toPage(page, vp, x, y) {
  const box = await page.locator(".fl-stage > canvas").first().evaluate((c) => {
    const r = c.getBoundingClientRect();
    return { left: r.left, top: r.top, cssW: c.parentElement.clientWidth, cssH: r.height };
  });
  const w = vp.xMax - vp.xMin;
  const h = vp.yMax - vp.yMin;
  const scale = Math.min((box.cssW - 2 * PAD) / w, (Math.max(200, 520) - 2 * PAD) / h);
  const ox = (box.cssW - w * scale) / 2;
  return { x: box.left + ox + (x - vp.xMin) * scale, y: box.top + box.cssH - PAD - (y - vp.yMin) * scale, scale };
}

async function drag(page, vp, from, to, steps = 12) {
  const a = await toPage(page, vp, ...from);
  const b = await toPage(page, vp, ...to);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) await page.mouse.move(a.x + ((b.x - a.x) * i) / steps, a.y + ((b.y - a.y) * i) / steps);
  await page.mouse.up();
}

async function click(page, vp, at) {
  const p = await toPage(page, vp, ...at);
  await page.mouse.click(p.x, p.y);
}

const tool = (page, name) => page.getByRole("toolbar", { name: "Ferramentas" }).getByRole("button", { name, exact: true }).click();

async function setParam(page, label, value) {
  const input = page.getByLabel(`${label} (valor)`, { exact: true });
  await input.fill(String(value));
  await input.press("Tab");
}

// ------------------------------------------------------------------ casos

const HOCKEY = { xMin: -0.04, xMax: 1.64, yMin: -0.28, yMax: 1.04 };
const CIRCUIT = { xMin: -0.6, xMax: 12.6, yMin: -0.6, yMax: 8.6 };
const MILLIKAN = { xMin: 0, xMax: 20, yMin: 0, yMax: 12 };

/** Posição da gota na luneta invertida (mesma conta do toScope da sim millikan). */
const scope = (x, y) => [8.6 - x * (4.6 / 1.25e-3), 6.4 - (y - 3e-3) * (4.6 / 1.25e-3)];

const cases = [
  {
    id: "hoquei-uma-carga",
    expect: { stars: 3, points: 1000 },
    async build(page) {
      await drag(page, HOCKEY, [0.25, -0.18], [0.05, 0.5]);
    },
  },
  {
    id: "hoquei-parede",
    expect: { stars: 3, points: 2000 },
    async build(page) {
      await drag(page, HOCKEY, [0.55, -0.18], [0.917, 0.047]);
      await drag(page, HOCKEY, [0.55, -0.18], [0.881, 0.253]);
    },
  },
  {
    id: "telescopio-20x",
    expect: { stars: 3 },
    async build(page) {
      const vp = { xMin: -0.15, xMax: 0.8, yMin: -0.1, yMax: 0.1 };
      // seleciona a ocular (f = 5 cm), encurta a focal três vezes (P = 20 → 39,06 di) e aproxima a lente:
      // separação = f_ob + f_oc, um pouco menor para a imagem final ficar virtual (o olho relaxa).
      await click(page, vp, [0.55, 0]);
      for (let i = 0; i < 3; i++) await tool(page, "f mais curta (×0,8)");
      await drag(page, vp, [0.55, 0], [0.5 + 1 / 39.0625 - 0.0013, 0]);
    },
  },
  {
    id: "microscopio-250x",
    expect: { stars: 3 },
    async build(page) {
      const vp = { xMin: -0.03, xMax: 0.27, yMin: -0.055, yMax: 0.055 };
      // a objetiva forma a imagem intermediária a 17 cm (aumento 16); a ocular de 62,5 di dá 15,6 × 16 ≈ 250.
      // A ocular fica a u = 1/63 m da imagem intermediária: imagem final virtual a 2 m (o olho relaxa).
      await click(page, vp, [0.195, 0]);
      for (let i = 0; i < 2; i++) await tool(page, "f mais curta (×0,8)");
      await drag(page, vp, [0.195, 0], [0.17 + 1 / 63, 0], 20);
    },
  },
  {
    id: "braquistocrona",
    expect: { stars: 3 },
    async build(page) {
      const vp = { xMin: -0.5, xMax: 5.6, yMin: -3.7, yMax: 1.1 };
      // cicloide de A = (0, 0) a B = (3, −1,5), desenhada com o mouse
      const X = 3, Y = 1.5;
      let th = Math.PI;
      for (let i = 0; i < 60; i++) {
        const f = (t) => (t - Math.sin(t)) / (1 - Math.cos(t)) - X / Y;
        th -= f(th) / ((f(th + 1e-6) - f(th - 1e-6)) / 2e-6);
      }
      const R = Y / (1 - Math.cos(th));
      const pts = Array.from({ length: 241 }, (_, i) => {
        const t = (th * i) / 240;
        return [R * (t - Math.sin(t)), -R * (1 - Math.cos(t))];
      });
      const first = await toPage(page, vp, ...pts[0]);
      await page.mouse.move(first.x, first.y);
      await page.mouse.down();
      for (const q of pts.slice(1)) {
        const p = await toPage(page, vp, ...q);
        await page.mouse.move(p.x, p.y);
      }
      await page.mouse.up();
    },
  },
  {
    id: "circuito-economico",
    expect: { stars: 3 },
    async build(page) {
      // quatro lâmpadas em paralelo com a bateria (que já está entre (2,5) e (2,3)), baixada de 9 V para 4,5 V
      await tool(page, "Fio");
      await drag(page, CIRCUIT, [2, 5], [2, 6]);
      for (let x = 2; x < 10; x += 2) {
        await drag(page, CIRCUIT, [x, 6], [x + 2, 6]);
        await drag(page, CIRCUIT, [x, 3], [x + 2, 3]);
      }
      await tool(page, "Lâmpada");
      for (let x = 4; x <= 10; x += 2) await drag(page, CIRCUIT, [x, 6], [x, 3]);
      await tool(page, "Selecionar");
      await click(page, CIRCUIT, [2, 4]);
      await tool(page, "Valor −");
      await tool(page, "Valor −");
    },
  },
  {
    id: "millikan-gota-parada",
    expect: { stars: 3 },
    async build(page) {
      // gota 6 da borrifada (uma carga elementar), na luneta invertida; equilíbrio em 315 V
      await click(page, MILLIKAN, scope(0.0006707883621565998, 0.0032846536491066215));
      await setParam(page, "Tensão nas placas V", 315);
    },
  },
  {
    id: "circuito-economico",
    label: "circuito-economico (série em 24 V)",
    expect: { okLessThan3: true },
    async build(page) {
      // resposta ruim: as quatro em série numa bateria de 24 V acendem, mas gastam quase o dobro
      await tool(page, "Fio");
      await drag(page, CIRCUIT, [2, 5], [2, 6]);
      await drag(page, CIRCUIT, [10, 6], [10, 3]);
      await drag(page, CIRCUIT, [10, 3], [2, 3]);
      await tool(page, "Lâmpada");
      for (let x = 2; x < 10; x += 2) await drag(page, CIRCUIT, [x, 6], [x + 2, 6]);
      await tool(page, "Selecionar");
      await click(page, CIRCUIT, [2, 4]);
      for (let i = 0; i < 3; i++) await tool(page, "Valor +");
    },
  },
];

// ------------------------------------------------------------------ execução

const only = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: chromiumPath() });
let failures = 0;
for (const c of cases.filter((c) => !only.length || only.includes(c.id))) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  // cada caso começa com o histórico limpo (primeira tentativa, pontos cheios)
  await page.addInitScript(() => localStorage.clear());
  await page.goto(`${BASE}#/desafios/${c.id}`);
  await page.locator(".fl-stage > canvas").first().waitFor();
  await page.waitForTimeout(300);
  await page.locator(".fl-stage").first().scrollIntoViewIfNeeded();
  await c.build(page);
  await page.getByRole("button", { name: "Avaliar tentativa" }).click();
  const result = page.locator(".ch-result p").first();
  await result.waitFor({ timeout: 20_000 });
  const text = (await page.locator(".ch-result").innerText()).replace(/\s+/g, " ");
  const ok = text.includes("Objetivo cumprido.");
  const starsLabel = ok ? await page.locator(".ch-score .ch-stars").getAttribute("aria-label") : "0 de 3 estrelas";
  const stars = Number(starsLabel?.match(/^(\d)/)?.[1] ?? 0);
  const pts = ok ? Number(await page.locator(".ch-score strong").innerText()) : 0;
  const e = c.expect;
  const pass = e.okLessThan3 ? ok && stars < 3 : ok && stars === e.stars && (e.points === undefined || pts === e.points) && !errors.length;
  if (!pass) failures++;
  console.log(`${pass ? "ok  " : "FALHOU"} ${c.label ?? c.id}: ${stars} estrela(s), ${pts} pontos — ${text.slice(0, 220)}${errors.length ? ` [erros: ${errors.join("; ")}]` : ""}`);
  if (process.env.SHOTS) await page.screenshot({ path: join(process.env.SHOTS, `${c.label ? `${c.id}-ruim` : c.id}.png`), fullPage: true });
  await page.close();
}
await browser.close();
if (failures) {
  console.error(`${failures} caso(s) falharam.`);
  process.exit(1);
}
