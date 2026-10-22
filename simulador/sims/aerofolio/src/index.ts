import { contourLines, defineSim, deg, draw, formatBR, num, rad, sampleGrid, texNum, type Params } from "@fisilab/core";
import { panel } from "./panel.ts";
import { clPotential, clWithStall, contour, cp, foilOf, streamFunction, surfaceCp, velocity, type Foil } from "./physics.ts";

export interface Air {
  /** Partículas traçadoras (posições em m). */
  parts: [number, number][];
  /** Tempo desde a última fileira solta (s). */
  since: number;
  /** Sonda de pressão arrastável. */
  probe: [number, number];
  drag: boolean;
}

/** Região do campo desenhada (m). */
const F = { xMin: -1.45, xMax: 1.45, yMin: -0.72, yMax: 0.72 };
/** Velocidade de exibição das partículas: U corresponde a VIS m/s na tela (câmera lenta). */
const VIS = 0.45;
const RELEASE = 0.9;
const ROW = 15;

function row(): [number, number][] {
  return Array.from({ length: ROW }, (_, i): [number, number] => [F.xMin + 0.02, F.yMin + 0.06 + ((F.yMax - F.yMin - 0.12) * i) / (ROW - 1)]);
}

const liftPerSpan = (f: Foil, cl: number) => 0.5 * f.rho * f.U ** 2 * f.chord * cl;
const clOf = (p: Params) => {
  const f = foilOf(p);
  return clWithStall(f, f.alpha, rad(num(p, "estol", 14)));
};
const stalled = (p: Params) => {
  const f = foilOf(p);
  return Math.abs(deg(f.alpha + f.beta)) > num(p, "estol", 14);
};

function probeVals(s: Air, p: Params): { V: number; Cp: number } {
  const f = foilOf(p);
  const v = velocity(f, s.probe[0], s.probe[1]);
  if (!v) return { V: 0, Cp: 1 };
  const V = Math.hypot(v[0], v[1]);
  return { V, Cp: 1 - (V * V) / (f.U * f.U) };
}

// ---- Cache do campo (só depende dos parâmetros) ----
let fieldKey = "";
let cpGrid: number[] = [];
let streams: [number, number][][] = [];
const NXC = 150, NYC = 76;

function buildField(f: Foil) {
  const key = [f.alpha, f.U, f.mu[0], f.mu[1], f.gamma].join("|");
  if (key === fieldKey) return;
  fieldKey = key;
  cpGrid = [];
  for (let j = 0; j < NYC; j++)
    for (let i = 0; i < NXC; i++) {
      const x = F.xMin + ((i + 0.5) * (F.xMax - F.xMin)) / NXC;
      const y = F.yMin + ((j + 0.5) * (F.yMax - F.yMin)) / NYC;
      cpGrid.push(cp(f, x, y));
    }
  const g = sampleGrid(F, 150, 76, (x, y) => streamFunction(f, x, y));
  const psiBody = (f.gamma / (2 * Math.PI)) * Math.log(f.a);
  const dpsi = f.U * 0.075;
  streams = [];
  for (let k = -11; k <= 11; k++) {
    if (k === 0) continue;
    for (const line of contourLines(g, psiBody + k * dpsi)) streams.push(line as [number, number][]);
  }
  // Linha divisória (ψ = ψ_corpo) desenhada a partir de um ponto ligeiramente acima e abaixo
  for (const e of [-0.04, 0.04]) for (const line of contourLines(g, psiBody + e * dpsi)) streams.push(line as [number, number][]);
}

/** Mapa de cores divergente para C_p: azul (sucção, C_p < 0) → branco → vermelho (sobrepressão). */
function cpColor(v: number, dark: boolean): string {
  const u = Math.max(-1, Math.min(1, v < 0 ? v / 2.5 : v));
  const base = dark ? 30 : 255;
  if (u < 0) {
    const t = -u;
    return `rgb(${Math.round(base + (40 - base) * t)}, ${Math.round(base + (110 - base) * t)}, ${Math.round(base + (230 - base) * t)})`;
  }
  return `rgb(${Math.round(base + (225 - base) * u)}, ${Math.round(base + (70 - base) * u)}, ${Math.round(base + (60 - base) * u)})`;
}

export const aerofolio = defineSim<Air>({
  id: "aerofolio",
  title: "Sustentação em aerofólio",
  course: "FG II",
  topic: "Fluidos",
  priority: "P3",
  summary:
    "Escoamento potencial em torno de um aerofólio de Joukowski, obtido por transformação conforme de um cilindro com circulação. A condição de Kutta fixa a circulação; a pressão vem de Bernoulli e a sustentação de Kutta–Joukowski, com a curva C_L × α e um estol aproximado.",
  equations: [
    String.raw`z = \zeta + \frac{c^2}{\zeta} \qquad w(\zeta) = U\!\left[(\zeta-\mu)e^{-i\alpha} + \frac{a^2 e^{i\alpha}}{\zeta-\mu}\right] + \frac{i\Gamma}{2\pi}\ln(\zeta-\mu)`,
    String.raw`u - iv = \frac{dw/d\zeta}{dz/d\zeta} \qquad \text{Kutta: } \Gamma = 4\pi a U\,\text{sen}(\alpha + \beta)`,
    String.raw`p + \tfrac12\rho V^2 = p_\infty + \tfrac12\rho U^2 \;\Rightarrow\; C_p = 1 - \frac{V^2}{U^2}`,
    String.raw`L' = \rho U \Gamma \qquad C_L = \frac{L'}{\tfrac12\rho U^2 c_{\text{corda}}} \approx 2\pi\,\text{sen}(\alpha - \alpha_0)`,
  ],
  liveEquations(s, p) {
    const f = foilOf(p);
    const cl = clOf(p);
    const out = [
      String.raw`\Gamma = ${texNum(f.gamma)}\ \text{m}^2\text{/s} \qquad L' = \rho U\Gamma = ${texNum(f.rho)}\cdot${texNum(f.U)}\cdot${texNum(f.gamma)} = ${texNum(f.rho * f.U * f.gamma)}\ \text{N/m}`,
      String.raw`C_L = ${texNum(cl)} \quad (\text{potencial: } ${texNum(clPotential(f, f.alpha))}) \qquad \alpha_0 = ${texNum(-deg(f.beta))}^\circ`,
    ];
    const pr = probeVals(s, p);
    out.push(String.raw`\text{sonda: } V = ${texNum(pr.V)}\ \text{m/s},\ \ p - p_\infty = \tfrac12\rho U^2 C_p = ${texNum(0.5 * f.rho * f.U ** 2 * pr.Cp)}\ \text{Pa}`);
    if (stalled(p)) out.push(String.raw`\text{estol: o escoamento descola e a condição de Kutta deixa de valer}`);
    return out;
  },

  params: [
    { key: "alpha", label: "Ângulo de ataque α", unit: "°", min: -10, max: 25, step: 0.5, default: 6, live: true },
    { key: "U", label: "Velocidade do ar U", unit: "m/s", min: 5, max: 80, step: 1, default: 30, live: true },
    { key: "rho", label: "Densidade do ar ρ", unit: "kg/m³", min: 0.4, max: 1.3, step: 0.01, default: 1.2, live: true },
    { key: "esp", label: "Espessura (deslocamento do círculo ε)", unit: "", min: 0, max: 0.25, step: 0.01, default: 0.1, live: true },
    { key: "arq", label: "Arqueamento (deslocamento vertical f)", unit: "", min: 0, max: 0.2, step: 0.01, default: 0.06, live: true },
    { key: "estol", label: "Ângulo de estol (a partir de α₀)", unit: "°", min: 8, max: 20, step: 0.5, default: 15, live: true },
  ],

  observables: [
    { key: "alpha", label: "Ângulo de ataque", unit: "°", value: (_s, p) => num(p, "alpha", 6) },
    { key: "CL", label: "Coeficiente de sustentação C_L", unit: "", value: (_s, p) => clOf(p) },
    { key: "CLpot", label: "C_L do modelo potencial (sem estol)", unit: "", value: (_s, p) => clPotential(foilOf(p), foilOf(p).alpha) },
    { key: "Gamma", label: "Circulação Γ", unit: "m²/s", value: (_s, p) => foilOf(p).gamma },
    { key: "L", label: "Sustentação por metro de envergadura", unit: "N/m", value: (_s, p) => liftPerSpan(foilOf(p), clOf(p)) },
    { key: "corda", label: "Corda do perfil", unit: "m", value: (_s, p) => foilOf(p).chord },
    { key: "alpha0", label: "Ângulo de sustentação nula α₀", unit: "°", value: (_s, p) => -deg(foilOf(p).beta) },
    { key: "Vs", label: "Velocidade na sonda", unit: "m/s", value: (s, p) => probeVals(s, p).V },
    { key: "dps", label: "p − p∞ na sonda", unit: "Pa", value: (s, p) => 0.5 * foilOf(p).rho * foilOf(p).U ** 2 * probeVals(s, p).Cp },
  ],
  chart: { x: "alpha", y: "CL" },

  scenarios: [
    {
      id: "basico",
      label: "Perfil arqueado em voo",
      params: { alpha: 6, U: 30, esp: 0.1, arq: 0.06 },
      guide: `### De onde vem a sustentação
1. As cores mostram $C_p = 1 - V^2/U^2$: azul é **sucção** (ar mais rápido, pressão menor), vermelho é sobrepressão. O extradorso é bem mais azul que o intradorso.
2. Arraste a **sonda** pelo campo e compare $V$ e $p - p_\\infty$ em cima e embaixo do perfil.
3. Observe as partículas soltas numa fileira vertical: as de cima chegam ao bordo de fuga **muito antes** das de baixo. A ideia de "tempos de trânsito iguais" é falsa.
4. Varie **α** durante a simulação: o gráfico $C_L \\times \\alpha$ é desenhado ao vivo.`,
      predict: [
        {
          question: "Duas partículas vizinhas se separam no bordo de ataque, uma por cima e outra por baixo do perfil. Qual chega primeiro ao bordo de fuga?",
          options: ["Chegam juntas", "A de cima", "A de baixo"],
          answer: 1,
          explanation:
            "A circulação acelera o ar sobre o extradorso muito além do necessário para 'compensar' o caminho mais longo: a de cima chega bem antes. Tempos iguais não são uma lei física.",
        },
      ],
    },
    {
      id: "placa",
      label: "Placa plana: C_L = 2π sen α",
      params: { alpha: 5, esp: 0, arq: 0, U: 30 },
      guide: `### O resultado clássico
1. Com $\\varepsilon = f = 0$ o perfil é uma placa de corda $4c = 1$ m e $\\Gamma = \\pi c_{\\text{corda}} U\\,\\text{sen}\\,\\alpha$.
2. Confira $C_L = 2\\pi\\,\\text{sen}\\,\\alpha$: com $\\alpha = 5°$, $C_L \\approx 0{,}55$.
3. Zere $\\alpha$: sem circulação não há sustentação e o escoamento é simétrico.
4. Agora aumente o **arqueamento**: a curva $C_L(\\alpha)$ se desloca para a esquerda ($\\alpha_0 < 0$) e há sustentação com $\\alpha = 0$.`,
    },
    {
      id: "kutta",
      label: "Condição de Kutta",
      params: { alpha: 8, esp: 0.12, arq: 0.04 },
      guide: `### Por que essa circulação?
1. O escoamento potencial admite **qualquer** circulação. Só uma delas faz o ar sair suavemente pelo bordo de fuga afiado: $\\Gamma = 4\\pi a U\\,\\text{sen}(\\alpha+\\beta)$.
2. Veja as linhas de corrente deixando o perfil exatamente pelo bordo de fuga, sem contorná-lo.
3. A viscosidade é quem "escolhe" essa circulação na partida (vórtice de partida), mesmo que o modelo seja não viscoso.`,
    },
    {
      id: "estol",
      label: "Estol",
      params: { alpha: 12, esp: 0.1, arq: 0.04, estol: 15 },
      guide: `### Quando o modelo deixa de valer
1. Com a simulação rodando, aumente **α** lentamente de 12° a 22° e veja o gráfico $C_L \\times \\alpha$.
2. Perto de 15° (contado a partir de $\\alpha_0$) a camada-limite descola do extradorso: o $C_L$ cai bruscamente.
3. O modelo potencial (tracejado) continua subindo: a teoria não viscosa não prevê o estol.`,
      predict: [
        {
          question: "O que acontece com a sustentação quando o ângulo de ataque passa do ângulo de estol?",
          options: ["continua aumentando proporcionalmente a α", "cai bruscamente", "fica constante"],
          answer: 1,
          explanation: "O gradiente adverso de pressão no extradorso faz a camada-limite descolar; a sucção some e $C_L$ despenca.",
        },
      ],
    },
  ],

  exercises: [
    {
      id: "placa-forca",
      prompt:
        "Uma asa fina e plana de corda {c} m e envergadura {b} m voa a {U} m/s com ângulo de ataque de {a}° no ar de densidade 1,2 kg/m³. Usando C_L = 2π sen α, qual é a sustentação?",
      vary: { c: [0.8, 2, 2], b: [5, 15, 1], U: [20, 70, 0], a: [2, 8, 1] },
      answer: {
        label: "L",
        unit: "N",
        compute: (p) => 0.5 * 1.2 * num(p, "U") ** 2 * num(p, "c") * num(p, "b") * 2 * Math.PI * Math.sin(rad(num(p, "a"))),
      },
      hint: "L = ½ρU²·(corda × envergadura)·C_L.",
    },
    {
      id: "kutta-joukowski",
      prompt: "Um perfil sustenta {Lp} N por metro de envergadura num escoamento de {U} m/s e densidade {rho} kg/m³. Qual é a circulação em torno dele?",
      vary: { Lp: [200, 2000, 0], U: [15, 60, 0], rho: [0.6, 1.25, 2] },
      answer: { label: "Γ", unit: "m²/s", compute: (p) => num(p, "Lp") / (num(p, "rho") * num(p, "U")) },
      hint: "Kutta–Joukowski: L' = ρUΓ.",
    },
  ],

  init: () => ({ parts: row(), since: 0, probe: [0.05, 0.16], drag: false }),
  step(s, p, _t, dt) {
    const f = foilOf(p);
    const k = VIS / f.U;
    const parts: [number, number][] = [];
    for (const [x, y] of s.parts) {
      const v1 = velocity(f, x, y);
      if (!v1) continue;
      const v2 = velocity(f, x + 0.5 * dt * k * v1[0], y + 0.5 * dt * k * v1[1]);
      if (!v2) continue;
      const nx = x + dt * k * v2[0], ny = y + dt * k * v2[1];
      if (nx > F.xMax || ny < F.yMin || ny > F.yMax || !Number.isFinite(nx + ny)) continue;
      parts.push([nx, ny]);
    }
    let since = s.since + dt;
    if (since >= RELEASE) {
      since = 0;
      parts.push(...row());
    }
    return { ...s, parts: parts.slice(-ROW * 12), since };
  },
  dt: 1 / 60,
  sampleEvery: 6,
  maxSamples: 3000,

  pointer: {
    down(s, _p, pt) {
      return Math.hypot(pt.x - s.probe[0], pt.y - s.probe[1]) < 0.08 ? { ...s, drag: true } : undefined;
    },
    move(s, p, pt, dragging) {
      if (!dragging || !s.drag) return undefined;
      const x = Math.max(F.xMin, Math.min(F.xMax, pt.x)), y = Math.max(F.yMin, Math.min(F.yMax, pt.y));
      return velocity(foilOf(p), x, y) ? { ...s, probe: [x, y] } : undefined;
    },
    up: (s) => (s.drag ? { ...s, drag: false } : undefined),
    cursor: (s, _p, pt) => (Math.hypot(pt.x - s.probe[0], pt.y - s.probe[1]) < 0.08 ? "move" : undefined),
  },
  actions: [{ id: "limpar", label: "Soltar nova fileira", run: (s) => ({ ...s, parts: row(), since: 0 }) }],

  viewport: () => ({ xMin: -1.5, xMax: 1.5, yMin: -2.25, yMax: 0.9, unit: "" }),

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const { state: s, params: p, theme } = frame;
    const f = foilOf(p);
    buildField(f);

    // Pressão colorida
    const cw = (F.xMax - F.xMin) / NXC, ch = (F.yMax - F.yMin) / NYC;
    for (let j = 0; j < NYC; j++)
      for (let i = 0; i < NXC; i++) {
        const v = cpGrid[i + j * NXC]!;
        if (!Number.isFinite(v)) continue;
        ctx.fillStyle = cpColor(v, theme.dark);
        ctx.fillRect(F.xMin + i * cw, F.yMin + j * ch, cw * 1.04, ch * 1.04);
      }
    // Linhas de corrente
    for (const line of streams) d.polyline(line, { color: theme.text, width: 1, alpha: 0.45 });
    // Perfil
    const pts = contour(f).map(({ z }): [number, number] => [z[0], z[1]]);
    d.polyline(pts, { color: theme.text, width: 1.5, fill: theme.dark ? "#4a5564" : "#c9ced6", close: true });
    // Partículas
    for (const [x, y] of s.parts) d.dot(x, y, 2.2, theme.series[5] ?? theme.accent);
    // Vento e sustentação
    d.arrow(F.xMin + 0.08, F.yMax - 0.12, 0.25 * Math.cos(f.alpha), 0.25 * Math.sin(f.alpha), { color: theme.text });
    d.text(`U = ${formatBR(f.U, 3)} m/s`, F.xMin + 0.2, F.yMax - 0.1, { color: theme.text, size: 11, dy: -10 });
    const cl = clOf(p);
    const Ldir: [number, number] = [-Math.sin(f.alpha), Math.cos(f.alpha)];
    const xc = (f.xLE + f.xTE) / 2 - 0.1 * f.chord;
    d.arrow(xc, 0.05, Ldir[0] * 0.28 * cl, Ldir[1] * 0.28 * cl, { color: theme.positive, width: 2.5 });
    d.text(`L' = ${formatBR(liftPerSpan(f, cl), 3)} N/m`, xc + 0.08, 0.05 + 0.28 * cl, { color: theme.positive, size: 11, align: "left", weight: "600" });
    // Sonda
    const pr = probeVals(s, p);
    d.circle(s.probe[0], s.probe[1], 0, { minPx: 6, stroke: theme.text, width: 2 });
    d.text(`sonda: ${formatBR(pr.V, 3)} m/s · ${formatBR(0.5 * f.rho * f.U ** 2 * pr.Cp, 3)} Pa`, s.probe[0], s.probe[1], { color: theme.text, size: 10, dy: -14, weight: "600" });
    if (stalled(p)) d.text("ESTOL: escoamento descolado (o campo potencial não descreve mais o real)", 0, F.yMin + 0.05, { color: theme.negative, size: 11, weight: "700" });
    // Legenda de cores
    d.text("azul: sucção (Cp < 0)  ·  vermelho: sobrepressão  ·  pontos: fileiras soltas juntas (câmera lenta)", 0, F.yMin - 0.1, { color: theme.muted, size: 10 });

    // ---- C_L × α ----
    const stall = rad(num(p, "estol", 14));
    const pa = panel(d, { x0: -1.25, y0: -2.0, x1: -0.15, y1: -1.0 }, { min: -10, max: 25 }, { min: -1, max: 2.6 });
    pa.frame({ xlabel: "α (°)", ylabel: "C_L", xticks: [-10, 0, 10, 20], yticks: [-1, 0, 1, 2] });
    pa.plot((a) => clPotential(f, rad(a)), -10, 25, { color: theme.muted, width: 1.2, dash: [5, 4] });
    pa.plot((a) => clWithStall(f, rad(a), stall), -10, 25, { color: theme.accent, width: 2 });
    d.circle(pa.X(num(p, "alpha", 6)), pa.Y(Math.max(-1, Math.min(2.6, cl))), 0, { minPx: 5, fill: theme.positive });

    // ---- −C_p na superfície ----
    const ps = panel(d, { x0: 0.3, y0: -2.0, x1: 1.4, y1: -1.0 }, { min: 0, max: 1 }, { min: -1.2, max: 4 });
    ps.frame({ xlabel: "x/corda", ylabel: "−C_p", xticks: [0, 0.5, 1], yticks: [-1, 0, 2, 4] });
    // Do bordo de fuga, anti-horário: extradorso até o bordo de ataque (x mínimo), depois intradorso
    const surf = Array.from({ length: 299 }, (_, i) => surfaceCp(f, (2 * Math.PI * (i + 1)) / 300));
    let iLE = 0;
    surf.forEach((q, i) => {
      if (q.x < surf[iLE]!.x) iLE = i;
    });
    const toPt = (q: { x: number; cp: number }): [number, number] => [(q.x - f.xLE) / f.chord, -q.cp];
    const up = surf.slice(0, iLE + 1).map(toPt);
    const lo = surf.slice(iLE).map(toPt);
    ps.line(up, { color: theme.negative, width: 1.8 });
    ps.line(lo, { color: theme.positive, width: 1.8 });
    d.text("extradorso", 0.85, -0.82, { color: theme.negative, size: 10, align: "right" });
    d.text("intradorso", 0.9, -0.82, { color: theme.positive, size: 10, align: "left" });
  },
});

export default aerofolio;
