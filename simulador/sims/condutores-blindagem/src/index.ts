import {
  clamp,
  contourLines,
  defineSim,
  draw,
  EPS0,
  gridGradientAt,
  gridRange,
  gridValueAt,
  niceLevels,
  num,
  pointAlong,
  texNum,
  traceFieldLine,
  type Params,
  type V2,
} from "@fisilab/core";
import {
  BOUNDS,
  ELETRODO_N,
  ELETRODO_P,
  emptyMask,
  H,
  idx,
  ISOLADO,
  isBorder,
  maskHash,
  nodeX,
  nodeY,
  NX,
  NY,
  paintDisc,
  sceneMask,
  solveConductors,
  VACUO,
  type Solution,
} from "./solver.ts";

export * from "./solver.ts";

export type Tool = "sonda" | "isolado" | "eletrodoP" | "eletrodoN" | "borracha";

export interface CState {
  mask: Uint8Array;
  probe: V2;
  tool: Tool;
  dragging: "probe" | "paint" | null;
}

const cena = (p: Params) => Math.round(num(p, "cena"));
const inputOf = (s: CState, p: Params) => ({ mask: s.mask, E0: num(p, "E0"), V: num(p, "V"), Q: num(p, "Q") * 1e-9 });

// Memória das últimas soluções: o palco redesenha muitas vezes a mesma configuração.
const cache = new Map<string, Solution>();
export function solutionOf(s: CState, p: Params): Solution {
  const inp = inputOf(s, p);
  const key = `${maskHash(inp.mask)}|${inp.E0}|${inp.V}|${inp.Q}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const sol = solveConductors(inp);
  cache.set(key, sol);
  if (cache.size > 8) cache.delete(cache.keys().next().value!);
  return sol;
}

/** Campo E = −∇V; nulo em células totalmente dentro de condutor. */
export function fieldOf(sol: Solution, x: number, y: number): V2 {
  const fi = (x - BOUNDS.xMin) / H;
  const fj = (y - BOUNDS.yMin) / H;
  const i = clamp(Math.floor(fi), 0, NX - 2);
  const j = clamp(Math.floor(fj), 0, NY - 2);
  const o = sol.owner;
  if (o[idx(i, j)]! >= 0 && o[idx(i + 1, j)]! >= 0 && o[idx(i, j + 1)]! >= 0 && o[idx(i + 1, j + 1)]! >= 0) return [0, 0];
  const g = gridGradientAt(sol.grid, x, y);
  return [-g[0], -g[1]];
}

export const probeField = (s: CState, p: Params) => fieldOf(solutionOf(s, p), s.probe[0], s.probe[1]);
export const probeV = (s: CState, p: Params) => gridValueAt(solutionOf(s, p).grid, s.probe[0], s.probe[1]);

/** Razão entre a maior |σ| e a |σ| média na superfície dos condutores isolados. */
export function tipRatio(sol: Solution): number {
  let mx = 0, sum = 0, n = 0;
  for (const c of sol.comps)
    if (c.kind === "isolado")
      for (const e of c.surface) {
        const a = Math.abs(e.sigma);
        mx = Math.max(mx, a);
        sum += a;
        n++;
      }
  return n && sum > 0 ? mx / (sum / n) : 0;
}

export function sigmaExtremes(sol: Solution): [number, number] {
  let lo = 0, hi = 0;
  for (const c of sol.comps) for (const e of c.surface) {
    lo = Math.min(lo, e.sigma);
    hi = Math.max(hi, e.sigma);
  }
  return [lo, hi];
}

const isolatedQ = (sol: Solution) => sol.comps.filter((c) => c.kind === "isolado").reduce((a, c) => a + c.Q, 0);

// Linhas de campo (calculadas uma vez por solução).
const linesCache = new WeakMap<Solution, V2[][]>();
export function fieldLinesOf(sol: Solution, E0: number): V2[][] {
  const hit = linesCache.get(sol);
  if (hit) return hit;
  // Sementes: superfícies com carga positiva e a borda por onde o campo externo entra,
  // espaçadas por igual fluxo (número de linhas ∝ carga).
  const seeds: { p: V2; w: number }[] = [];
  for (const c of sol.comps)
    for (const e of c.surface)
      if (e.lambda > 0) {
        const i = e.k % NX, j = Math.floor(e.k / NX);
        seeds.push({ p: [nodeX(i) + e.n[0] * 0.6 * H, nodeY(j) + e.n[1] * 0.6 * H], w: e.lambda });
      }
  for (let j = 1; j < NY - 1; j++) {
    const left = (fieldOf(sol, BOUNDS.xMin + 0.5 * H, nodeY(j))[0] * EPS0) * H;
    if (left > 0 && E0 > 0) seeds.push({ p: [BOUNDS.xMin + 0.5 * H, nodeY(j)], w: left });
    const right = (-fieldOf(sol, BOUNDS.xMax - 0.5 * H, nodeY(j))[0] * EPS0) * H;
    if (right > 0 && E0 < 0) seeds.push({ p: [BOUNDS.xMax - 0.5 * H, nodeY(j)], w: right });
  }
  const total = seeds.reduce((a, s) => a + s.w, 0);
  const out: V2[][] = [];
  if (total <= 0) {
    linesCache.set(sol, out);
    return out;
  }
  const dQ = total / 34;
  let acc = dQ / 2;
  const [lo, hi] = gridRange(sol.grid);
  const Eref = Math.max((hi - lo) / 8, 1e-9);
  for (const sd of seeds) {
    acc += sd.w;
    if (acc < dQ) continue;
    acc -= dQ;
    const r = traceFieldLine((x, y) => fieldOf(sol, x, y), sd.p, { bounds: BOUNDS, hMax: H * 0.8, maxLength: 30, minField: Eref * 1e-4, maxSteps: 1500 });
    if (r.points.length > 2) out.push(r.points);
  }
  linesCache.set(sol, out);
  return out;
}

const toolActions: { id: Tool; label: string }[] = [
  { id: "sonda", label: "Sonda de campo" },
  { id: "isolado", label: "Desenhar condutor isolado" },
  { id: "eletrodoP", label: "Desenhar eletrodo +" },
  { id: "eletrodoN", label: "Desenhar eletrodo −" },
  { id: "borracha", label: "Borracha" },
];
const TOOL_TYPE: Record<Tool, number> = { sonda: VACUO, isolado: ISOLADO, eletrodoP: ELETRODO_P, eletrodoN: ELETRODO_N, borracha: VACUO };

function paint(s: CState, p: Params, pt: V2): CState {
  return { ...s, mask: paintDisc(s.mask, pt[0], pt[1], num(p, "pincel", 0.15), TOOL_TYPE[s.tool]) };
}

const inBounds = (pt: { x: number; y: number }) => pt.x > BOUNDS.xMin && pt.x < BOUNDS.xMax && pt.y > BOUNDS.yMin && pt.y < BOUNDS.yMax;

const fmt = (v: number, d = 3) => (Math.abs(v) < 1e-12 ? "0" : Math.abs(v) >= 1e4 || Math.abs(v) < 1e-2 ? v.toExponential(1) : v.toPrecision(d)).replace(".", ",");

export const condutoresBlindagem = defineSim<CState>({
  id: "condutores-blindagem",
  title: "Condutores, blindagem e poder das pontas",
  course: "FG III",
  topic: "Eletrostática",
  priority: "P2",
  summary:
    "Desenhe condutores de qualquer forma e veja o equilíbrio eletrostático resolvido numericamente (Laplace por SOR): campo nulo dentro da gaiola de Faraday, carga acumulada nas pontas, linhas de campo e equipotenciais. Corte 2D de condutores longos.",
  static: true,
  equations: [
    String.raw`\nabla^2 V = 0 \ \text{fora dos condutores} \qquad V = \text{const.}\ \text{em cada condutor}`,
    String.raw`V_{i,j} = \tfrac14\left(V_{i+1,j} + V_{i-1,j} + V_{i,j+1} + V_{i,j-1}\right) \quad \text{(SOR com } \omega \approx 2/(1 + \operatorname{sen}(\pi/N)))`,
    String.raw`\vec E = -\nabla V \qquad \sigma = \varepsilon_0 E_n \ \text{(logo fora da superfície)}`,
    String.raw`\text{isolado: } \frac{\lambda}{\varepsilon_0} = \oint \vec E\cdot\hat n\,d\ell \;\Rightarrow\; V_c = \overline{V}_{\text{vizinhos}} + \frac{\lambda}{\varepsilon_0 N}`,
  ],
  liveEquations(s, p) {
    const sol = solutionOf(s, p);
    const E = probeField(s, p);
    const [smin, smax] = sigmaExtremes(sol);
    const out = [
      String.raw`\text{sonda: } |\vec E| = ${texNum(Math.hypot(E[0], E[1]))}\ \text{V/m} \qquad V = ${texNum(probeV(s, p))}\ \text{V}`,
      String.raw`\sigma_{\max} = ${texNum(smax * 1e9)}\ \text{nC/m}^2 \qquad \sigma_{\min} = ${texNum(smin * 1e9)}\ \text{nC/m}^2 \qquad \frac{|\sigma|_{\max}}{\langle|\sigma|\rangle} = ${texNum(tipRatio(sol))}`,
    ];
    const iso = sol.comps.filter((c) => c.kind === "isolado");
    if (iso.length) out.push(String.raw`\text{condutor isolado: } V_c = ${texNum(iso[0]!.V)}\ \text{V},\ \lambda = ${texNum(iso[0]!.Q * 1e9)}\ \text{nC/m}`);
    out.push(String.raw`\text{SOR: } ${sol.iterations}\ \text{varreduras}${sol.converged ? "" : String.raw`\ \text{(não convergiu)}`}`);
    return out;
  },

  params: [
    {
      key: "cena",
      label: "Cena",
      unit: "",
      min: 0,
      max: 3,
      step: 1,
      default: 0,
      options: [
        { value: 0, label: "Gaiola de Faraday em campo uniforme" },
        { value: 1, label: "Condutor com ponta (gota)" },
        { value: 2, label: "Placas carregadas e condutor neutro" },
        { value: 3, label: "Livre: desenhe os condutores" },
      ],
    },
    { key: "E0", label: "Campo externo E₀", unit: "V/m", min: -200, max: 200, step: 5, default: 100, live: true },
    { key: "V", label: "Tensão entre eletrodos", unit: "V", min: 0, max: 1000, step: 10, default: 0, live: true },
    { key: "Q", label: "Carga de cada condutor isolado", unit: "nC/m", min: -10, max: 10, step: 0.1, default: 0, live: true },
    { key: "pincel", label: "Raio do pincel", unit: "m", min: 0.05, max: 0.5, step: 0.05, default: 0.15, live: true },
  ],

  observables: [
    { key: "E", label: "|E| na sonda", unit: "V/m", value: (s, p) => Math.hypot(...probeField(s, p)) },
    { key: "Ex", label: "Eₓ na sonda", unit: "V/m", value: (s, p) => probeField(s, p)[0] },
    { key: "Vs", label: "Potencial na sonda", unit: "V", value: (s, p) => probeV(s, p) },
    { key: "sigmaMax", label: "σ máxima", unit: "nC/m²", value: (s, p) => sigmaExtremes(solutionOf(s, p))[1] * 1e9 },
    { key: "sigmaMin", label: "σ mínima", unit: "nC/m²", value: (s, p) => sigmaExtremes(solutionOf(s, p))[0] * 1e9 },
    { key: "pontas", label: "|σ| máx / |σ| média", unit: "", value: (s, p) => tipRatio(solutionOf(s, p)) },
    { key: "Qiso", label: "Carga total dos isolados", unit: "nC/m", value: (s, p) => isolatedQ(solutionOf(s, p)) * 1e9 },
    { key: "iter", label: "Varreduras do SOR", unit: "", value: (s, p) => solutionOf(s, p).iterations },
  ],
  chart: { x: "t", y: "E" },

  scenarios: [
    {
      id: "gaiola",
      label: "Gaiola de Faraday",
      params: { cena: 0, E0: 100, V: 0, Q: 0 },
      guide: `### Blindagem eletrostática
1. Um anel condutor neutro está num campo uniforme $E_0 = 100$ V/m. A sonda está no centro.
2. Leia $|\\vec E|$ na sonda. Arraste a sonda por dentro do anel e depois para fora.
3. Veja as cargas induzidas: $-$ do lado por onde o campo chega, $+$ do outro. A carga total continua zero.
4. As equipotenciais não entram no anel: todo o interior está no mesmo potencial do condutor.
5. Use a **borracha** para abrir uma fresta no anel. O campo entra muito? E se a fresta for larga?`,
      predict: [
        {
          question: "Dentro de um anel condutor neutro colocado num campo de 100 V/m, o campo vale…",
          options: ["100 V/m", "Cerca de 50 V/m", "Zero", "Mais de 100 V/m"],
          answer: 2,
          explanation:
            "As cargas livres do condutor se rearranjam até o campo delas cancelar o externo em todo o interior. Sem cargas dentro da cavidade, V é constante lá e E = 0.",
        },
      ],
    },
    {
      id: "pontas",
      label: "Poder das pontas",
      params: { cena: 1, E0: 0, V: 0, Q: 3 },
      guide: `### Onde a carga se acumula?
1. A gota condutora tem $\\lambda = 3$ nC/m. As barras na superfície mostram $\\sigma$.
2. Compare $\\sigma$ na ponta e no lado arredondado: a razão $|\\sigma|_{\\max}/\\langle|\\sigma|\\rangle$ aparece nas equações.
3. Leve a sonda até perto da ponta e depois do lado largo: $E = \\sigma/\\varepsilon_0$ logo fora.
4. Desenhe uma ponta mais fina com o pincel pequeno. A razão aumenta? (A grade de 10 cm limita o quão fina a ponta pode ser.)
5. Por que para-raios são pontiagudos?`,
      predict: [
        {
          question: "Na gota condutora carregada, onde a densidade superficial de carga é maior?",
          options: ["No lado arredondado e largo", "Na ponta", "É igual em toda a superfície", "No interior"],
          answer: 1,
          explanation:
            "Todo o condutor está no mesmo potencial. Uma região de raio de curvatura pequeno precisa de mais carga por área para ter o mesmo potencial: σ ∝ 1/R, como em duas esferas ligadas por um fio.",
        },
      ],
    },
    {
      id: "placas",
      label: "Placas e condutor neutro",
      params: { cena: 2, E0: 0, V: 600, Q: 0 },
      guide: `### Indução entre placas
1. Os eletrodos estão a $+300$ V e $-300$ V. O bloco no meio é um condutor isolado e neutro.
2. Veja as cargas induzidas nas faces do bloco e confira na tabela que a carga total dele é zero.
3. Ponha a sonda dentro do bloco: $E = 0$. Ponha entre o bloco e uma placa: o campo é maior que sem o bloco?
4. Mude a carga $\\lambda$ dos isolados: o potencial do bloco se ajusta sozinho.`,
    },
    {
      id: "livre",
      label: "Desenho livre",
      params: { cena: 3, E0: 100, V: 0, Q: 0 },
      guide: `### Seu próprio condutor
1. Escolha **Desenhar condutor isolado** e pinte uma forma qualquer (estrela, letra, ferradura).
2. Observe as linhas de campo chegando sempre **perpendiculares** à superfície.
3. Pinte uma cavidade fechada e confirme com a sonda que o campo lá dentro é nulo.
4. Desenhe também eletrodos $+$ e $-$ e ajuste a tensão.`,
    },
  ],

  exercises: [
    {
      id: "esferas-ligadas",
      prompt:
        "Duas esferas condutoras de raios {R1} cm e {R2} cm, muito afastadas, são ligadas por um fio fino. Qual a razão σ₁/σ₂ entre as densidades superficiais de carga?",
      vary: { R1: [1, 5, 1], R2: [6, 30, 0] },
      answer: { label: "σ₁/σ₂", unit: "", compute: (p) => num(p, "R2") / num(p, "R1") },
      hint: "Mesmo potencial: kQ₁/R₁ = kQ₂/R₂. Depois use σ = Q/(4πR²).",
    },
    {
      id: "campo-superficie",
      prompt: "Logo fora da superfície de um condutor em equilíbrio, a densidade de carga é σ = {sig} nC/m². Qual o módulo do campo elétrico ali?",
      vary: { sig: [5, 80, 0] },
      answer: { label: "|E|", unit: "V/m", compute: (p) => (num(p, "sig") * 1e-9) / EPS0 },
      hint: "Use a lei de Gauss numa caixinha que atravessa a superfície: E = σ/ε₀, perpendicular a ela.",
    },
  ],

  init(p) {
    const c = cena(p);
    return { mask: sceneMask(c), probe: c === 1 ? [2.1, 0] : c === 2 ? [-1.6, 0] : [0, 0], tool: c === 3 ? "isolado" : "sonda", dragging: null };
  },
  step: (s) => s,
  sampleEvery: 1,
  maxSamples: 50,

  pointer: {
    down(s, p, pt) {
      if (!inBounds(pt)) return undefined;
      if (s.tool === "sonda") return { ...s, probe: [pt.x, pt.y], dragging: "probe" };
      return { ...paint(s, p, [pt.x, pt.y]), dragging: "paint" };
    },
    move(s, p, pt, dragging) {
      if (!dragging || !s.dragging || !inBounds(pt)) return undefined;
      if (s.dragging === "probe") return { ...s, probe: [pt.x, pt.y] };
      return paint(s, p, [pt.x, pt.y]);
    },
    up: (s) => (s.dragging ? { ...s, dragging: null } : undefined),
    cursor: (s, _p, pt) => (!inBounds(pt) ? undefined : s.tool === "sonda" ? "crosshair" : "cell"),
  },

  actions: [
    ...toolActions.map((t) => ({ id: t.id, label: t.label, run: (s: CState) => ({ ...s, tool: t.id }), active: (s: CState) => s.tool === t.id })),
    { id: "limpar", label: "Apagar todos os condutores", run: (s: CState) => ({ ...s, mask: emptyMask() }) },
    { id: "recarregar", label: "Recarregar a cena", run: (s: CState, p: Params) => ({ ...s, mask: sceneMask(cena(p)) }) },
  ],

  viewport: () => ({ xMin: BOUNDS.xMin - 0.1, xMax: BOUNDS.xMax + 0.1, yMin: BOUNDS.yMin - 0.75, yMax: BOUNDS.yMax + 0.1, unit: "m" }),

  render(ctx, frame) {
    const { state: s, params: p, theme } = frame;
    const d = draw(ctx, frame);
    const sol = solutionOf(s, p);
    const g = sol.grid;
    const [lo, hi] = gridRange(g);
    const vmax = Math.max(Math.abs(lo), Math.abs(hi), 1e-9);

    // Mapa de potencial (suave) e condutores
    for (let j = 0; j < NY; j++)
      for (let i = 0; i < NX; i++) {
        const k = idx(i, j);
        const x = nodeX(i) - H / 2, y = nodeY(j) - H / 2;
        const m = s.mask[k]!;
        if (m) {
          const fill = m === ELETRODO_P ? theme.positive : m === ELETRODO_N ? theme.negative : theme.dark ? "#8792a2" : "#9aa5b4";
          d.rect(x, y, H, H, { fill, alpha: m === ISOLADO ? 0.95 : 0.75 });
        } else if (!isBorder(i, j)) {
          const u = g.v[k]! / vmax;
          if (Math.abs(u) > 0.02) d.rect(x, y, H, H, { fill: u > 0 ? theme.positive : theme.negative, alpha: 0.13 * Math.min(1, Math.abs(u)) });
        }
      }
    d.rect(BOUNDS.xMin, BOUNDS.yMin, BOUNDS.xMax - BOUNDS.xMin, BOUNDS.yMax - BOUNDS.yMin, { stroke: theme.muted, width: 1 });

    // Equipotenciais
    for (const lvl of niceLevels(lo, hi, 16))
      for (const line of contourLines(g, lvl)) d.polyline(line, { color: theme.muted, width: 1, dash: [4, 4], alpha: 0.8 });

    // Linhas de campo com setas
    for (const line of fieldLinesOf(sol, num(p, "E0"))) {
      d.polyline(line, { color: theme.accent, width: 1.4, alpha: 0.9 });
      const mid = pointAlong(line, 0.5);
      if (mid) d.arrowPx(mid.p[0] - mid.dir[0] * 0.05, mid.p[1] - mid.dir[1] * 0.05, mid.dir[0], mid.dir[1], 9, { color: theme.accent, width: 1.4, head: 8 });
    }

    // Densidade superficial de carga: barras normais à superfície ∝ σ
    const [smin, smax] = sigmaExtremes(sol);
    const sref = Math.max(Math.abs(smin), Math.abs(smax), 1e-15);
    for (const c of sol.comps)
      for (const e of c.surface) {
        const i = e.k % NX, j = Math.floor(e.k / NX);
        const x = nodeX(i), y = nodeY(j);
        const len = (0.45 * Math.abs(e.sigma)) / sref;
        if (len < 0.01) continue;
        const col = e.sigma > 0 ? theme.positive : theme.negative;
        d.line(x, y, x + e.n[0] * len, y + e.n[1] * len, { color: col, width: 2.5 });
        if (Math.abs(e.sigma) > 0.35 * sref && (i + j) % 3 === 0)
          d.text(e.sigma > 0 ? "+" : "−", x + e.n[0] * (len + 0.12), y + e.n[1] * (len + 0.12), { color: col, size: 12, weight: "700" });
      }

    // Sonda
    const [px, py] = s.probe;
    const E = fieldOf(sol, px, py);
    const Em = Math.hypot(E[0], E[1]);
    const Eref = Math.max(Math.abs(num(p, "E0")), num(p, "V") / 6, (sref / EPS0) * 0.5, 1e-9);
    d.circle(px, py, 0.09, { fill: theme.series[1], stroke: theme.text, width: 1 });
    if (Em > 1e-3 * Eref) d.arrowPx(px, py, E[0], E[1], clamp((40 * Em) / Eref, 6, 90), { color: theme.series[1], width: 2.5 });
    d.text(`|E| = ${fmt(Em)} V/m   V = ${fmt(gridValueAt(g, px, py))} V`, clamp(px, BOUNDS.xMin + 1.6, BOUNDS.xMax - 1.6), clamp(py + 0.32, BOUNDS.yMin + 0.2, BOUNDS.yMax - 0.2), {
      color: theme.text,
      size: 12,
      weight: "600",
    });

    // Legenda
    const yL = BOUNDS.yMin - 0.4;
    d.line(BOUNDS.xMin + 0.1, yL, BOUNDS.xMin + 0.5, yL, { color: theme.accent, width: 1.4 });
    d.text("linha de campo", BOUNDS.xMin + 0.6, yL, { color: theme.muted, size: 11, align: "left" });
    d.line(BOUNDS.xMin + 2.2, yL, BOUNDS.xMin + 2.6, yL, { color: theme.muted, width: 1, dash: [4, 4] });
    d.text("equipotencial", BOUNDS.xMin + 2.7, yL, { color: theme.muted, size: 11, align: "left" });
    d.line(BOUNDS.xMin + 4.2, yL - 0.12, BOUNDS.xMin + 4.2, yL + 0.12, { color: theme.positive, width: 2.5 });
    d.line(BOUNDS.xMin + 4.35, yL - 0.12, BOUNDS.xMin + 4.35, yL + 0.12, { color: theme.negative, width: 2.5 });
    d.text("barras ∝ σ (+/−)", BOUNDS.xMin + 4.5, yL, { color: theme.muted, size: 11, align: "left" });
    const toolName = toolActions.find((t) => t.id === s.tool)?.label ?? "";
    d.text(`ferramenta: ${toolName.toLowerCase()}`, BOUNDS.xMax - 0.1, yL, { color: theme.text, size: 11, align: "right" });
  },
});

export default condutoresBlindagem;
