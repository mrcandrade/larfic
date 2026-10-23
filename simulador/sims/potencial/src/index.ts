import {
  contourLines,
  defineSim,
  draw,
  gridGradientAt,
  gridValueAt,
  num,
  pointAlong,
  polylineLength,
  solveLaplace,
  texNum,
  traceFieldLine,
  type Bounds,
  type Draw,
  type Grid2D,
  type Params,
  type V2,
} from "@fisilab/core";

/** Região resolvida (m) e grade do solver. */
export const BOX: Bounds = { xMin: -1, xMax: 1, yMin: -0.75, yMax: 0.75 };
export const NX = 81;
export const NY = 61;
export const H = (BOX.xMax - BOX.xMin) / (NX - 1);
const nC = 1e-9;
const HIT = 0.07;

export type Tool = "pincel" | "borracha" | "mover";

export interface PotState {
  /** Potencial imposto em cada nó (NaN = nó livre). Índice i + j·NX. */
  fixed: number[];
  /** Solução V (volts) em cada nó. */
  V: number[];
  /** Pontas do voltímetro e carga de teste (m). */
  A: { x: number; y: number };
  B: { x: number; y: number };
  q: { x: number; y: number };
  tool: Tool;
  drag: "A" | "B" | "q" | "paint" | null;
  /** Varreduras da última relaxação (diagnóstico). */
  iters: number;
}

export const nodeX = (i: number) => BOX.xMin + i * H;
export const nodeY = (j: number) => BOX.yMin + j * H;

export function gridOf(V: ArrayLike<number>): Grid2D {
  return { nx: NX, ny: NY, xMin: BOX.xMin, yMin: BOX.yMin, dx: H, dy: H, v: Float64Array.from(V) };
}

const neumann = (p: Params) => Math.round(num(p, "borda")) === 1;

/** Relaxa (SOR) a partir do V atual: aquecimento rápido durante a pintura, convergência completa no resto. */
export function relax(s: PotState, p: Params, maxIter = 4000, relTol = 1e-6): PotState {
  const V = s.V.slice();
  const fixedMask = new Uint8Array(NX * NY);
  let lo = 0;
  let hi = 0;
  for (let k = 0; k < V.length; k++) {
    const f = s.fixed[k]!;
    if (!Number.isNaN(f)) {
      fixedMask[k] = 1;
      V[k] = f;
      lo = Math.min(lo, f);
      hi = Math.max(hi, f);
    }
  }
  if (!neumann(p)) {
    // Borda aterrada: nós livres da borda valem 0.
    for (let i = 0; i < NX; i++)
      for (const j of [0, NY - 1]) if (!fixedMask[i + j * NX]) V[i + j * NX] = 0;
    for (let j = 0; j < NY; j++)
      for (const i of [0, NX - 1]) if (!fixedMask[i + j * NX]) V[i + j * NX] = 0;
  }
  if (hi === lo) return { ...s, V: V.map((v, k) => (fixedMask[k] ? v : hi)), iters: 0 };
  const g = gridOf(V);
  const r = solveLaplace(g, fixedMask, { boundary: neumann(p) ? "neumann" : "dirichlet", tol: relTol * (hi - lo), maxIter });
  return { ...s, V: Array.from(g.v), iters: r.iterations };
}

// ---------------------------------------------------------------------------
// Montagens prontas
// ---------------------------------------------------------------------------

function buildFixed(p: Params): number[] {
  const f = new Array<number>(NX * NY).fill(NaN);
  const V0 = num(p, "V0", 10);
  const set = (pred: (x: number, y: number) => boolean, v: number) => {
    for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) if (pred(nodeX(i), nodeY(j))) f[i + j * NX] = v;
  };
  const eps = H / 2 + 1e-9;
  switch (Math.round(num(p, "montagem"))) {
    case 0: // placas paralelas
      set((x, y) => Math.abs(x + 0.4) < eps && Math.abs(y) <= 0.45 + 1e-9, V0);
      set((x, y) => Math.abs(x - 0.4) < eps && Math.abs(y) <= 0.45 + 1e-9, -V0);
      break;
    case 1: // dois cilindros
      set((x, y) => Math.hypot(x + 0.45, y) <= 0.12, V0);
      set((x, y) => Math.hypot(x - 0.45, y) <= 0.12, -V0);
      break;
    case 2: // coaxial: interno a V0, externo aterrado
      // Folgas de meia célula: assim o raio efetivo da escada de nós fica próximo de a e b.
      set((x, y) => Math.hypot(x, y) <= COAX.a + 0.4 * H, V0);
      set((x, y) => Math.hypot(x, y) >= COAX.b - 0.2 * H, 0);
      break;
    case 3: // ponta e plano
      set((_x, y) => y <= -0.5, 0);
      set((x, y) => Math.abs(x) < eps && y >= -0.1 && y <= 0.6, V0);
      set((x, y) => Math.abs(x) <= 0.15 && Math.abs(y - 0.6) < eps, V0);
      break;
    default:
      break;
  }
  return f;
}

/** Raios do cabo coaxial (m). */
export const COAX = { a: 0.15, b: 0.6 };

function paint(s: PotState, p: Params, x: number, y: number): PotState {
  const r = num(p, "raio", 0.05);
  const fixed = s.fixed.slice();
  const v = s.tool === "pincel" ? num(p, "Vp", 10) : NaN;
  let changed = false;
  for (let j = 0; j < NY; j++)
    for (let i = 0; i < NX; i++) {
      if (Math.hypot(nodeX(i) - x, nodeY(j) - y) > Math.max(r, H * 0.6)) continue;
      const k = i + j * NX;
      const old = fixed[k]!;
      if (Number.isNaN(v) ? !Number.isNaN(old) : old !== v) {
        fixed[k] = v;
        changed = true;
      }
    }
  return changed ? { ...s, fixed } : s;
}

// ---------------------------------------------------------------------------
// Grandezas medidas
// ---------------------------------------------------------------------------

export const potAt = (s: PotState, x: number, y: number) => gridValueAt(gridOf(s.V), x, y);
export function fieldAtPt(s: PotState, x: number, y: number): V2 {
  const [gx, gy] = gridGradientAt(gridOf(s.V), x, y);
  return [-gx, -gy];
}

const inBox = (x: number, y: number) => x >= BOX.xMin && x <= BOX.xMax && y >= BOX.yMin && y <= BOX.yMax;
const clampBox = (x: number, y: number) => ({
  x: Math.max(BOX.xMin + 0.01, Math.min(BOX.xMax - 0.01, x)),
  y: Math.max(BOX.yMin + 0.01, Math.min(BOX.yMax - 0.01, y)),
});

// ---------------------------------------------------------------------------
// Desenho
// ---------------------------------------------------------------------------

const fmt = (v: number, digits = 3) => {
  if (!Number.isFinite(v)) return "—";
  const a = Math.abs(v);
  if (a !== 0 && (a >= 1e5 || a < 1e-2)) {
    const [m, e] = v.toExponential(digits - 1).split("e");
    return `${m!.replace(".", ",").replace("-", "−")}×10^${Number(e)}`;
  }
  return Number(v.toPrecision(digits)).toString().replace(".", ",").replace("-", "−");
};

function tag(d: Draw, str: string, x: number, y: number, o: { color?: string; size?: number; align?: "left" | "right" | "center"; weight?: string } = {}) {
  const size = o.size ?? 11;
  d.ctx.save();
  d.ctx.font = `${o.weight ?? "400"} ${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  const w = (d.ctx.measureText(str).width + 8) * d.px;
  d.ctx.restore();
  const h = (size + 6) * d.px;
  const align = o.align ?? "center";
  const x0 = align === "left" ? x - 4 * d.px : align === "right" ? x - w + 4 * d.px : x - w / 2;
  d.rect(x0, y - h / 2, w, h, { fill: d.theme.dark ? "#11161d" : "#ffffff", alpha: 0.82 });
  d.text(str, x, y, { color: o.color ?? d.theme.text, size, align, weight: o.weight });
}

/** Mistura uma cor #rrggbb com o fundo (t = 1: cor pura). Cores em outro formato voltam inalteradas. */
function mix(color: string, bg: string, t: number): string {
  const hex = (c: string) => (/^#[0-9a-f]{6}$/i.test(c) ? [1, 3, 5].map((k) => parseInt(c.slice(k, k + 2), 16)) : null);
  const a = hex(color);
  const b = hex(bg);
  if (!a || !b) return color;
  const c = a.map((v, k) => Math.round(b[k]! + (v - b[k]!) * Math.max(0, Math.min(1, t))));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

/** Linhas de campo semeadas sobre a equipotencial média, com densidade proporcional ao fluxo. */
export function gridFieldLines(s: PotState, nLines = 22): V2[][] {
  const g = gridOf(s.V);
  let lo = Infinity;
  let hi = -Infinity;
  for (const v of s.V) {
    lo = Math.min(lo, v);
    hi = Math.max(hi, v);
  }
  if (!(hi - lo > 1e-9)) return [];
  const level = (lo + hi) / 2 + (hi - lo) * 1e-3;
  const contours = contourLines(g, level);
  const E = (x: number, y: number): V2 => {
    const [gx, gy] = gridGradientAt(g, x, y);
    return [-gx, -gy];
  };
  // Fluxo ao longo das curvas: ∫|E| ds
  let total = 0;
  for (const c of contours)
    for (let i = 1; i < c.length; i++) {
      const [x, y] = [(c[i]![0] + c[i - 1]![0]) / 2, (c[i]![1] + c[i - 1]![1]) / 2];
      total += Math.hypot(...E(x, y)) * Math.hypot(c[i]![0] - c[i - 1]![0], c[i]![1] - c[i - 1]![1]);
    }
  if (total <= 0) return [];
  const step = total / nLines;
  const seeds: V2[] = [];
  let acc = step / 2;
  for (const c of contours)
    for (let i = 1; i < c.length; i++) {
      const a = c[i - 1]!;
      const b = c[i]!;
      const ds = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const f = Math.hypot(...E((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)) * ds;
      while (acc <= f && f > 0) {
        const t = acc / f;
        seeds.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
        acc += step;
      }
      acc -= f;
    }
  let eMax = 0;
  for (let j = 1; j < NY - 1; j += 2) for (let i = 1; i < NX - 1; i += 2) eMax = Math.max(eMax, Math.hypot(...E(nodeX(i), nodeY(j))));
  const opts = { bounds: BOX, minField: eMax * 2e-3, hMax: 0.025, maxSteps: 600 };
  return seeds.map((st) => {
    const fwd = traceFieldLine(E, st, { ...opts, direction: 1 }).points;
    const back = traceFieldLine(E, st, { ...opts, direction: -1 }).points;
    return [...back.reverse(), ...fwd.slice(1)];
  });
}

// Cache das linhas de campo (só mudam quando V muda).
let linesFor: number[] | null = null;
let linesCache: V2[][] = [];

// ---------------------------------------------------------------------------
// Simulação
// ---------------------------------------------------------------------------

export const potencial = defineSim<PotState>({
  id: "potencial",
  title: "Potencial elétrico e equipotenciais",
  course: "FG III",
  topic: "Potencial",
  priority: "P1",
  summary:
    "Pinte eletrodos com potencial fixo e veja o potencial no espaço ser calculado pela equação de Laplace. Meça diferenças de potencial com um voltímetro de duas pontas e acompanhe a energia de uma carga de teste.",
  static: true,
  equations: [
    String.raw`\nabla^2 V = \frac{\partial^2 V}{\partial x^2} + \frac{\partial^2 V}{\partial y^2} = 0 \quad\Rightarrow\quad V_{i,j} = \tfrac14\left(V_{i+1,j}+V_{i-1,j}+V_{i,j+1}+V_{i,j-1}\right)`,
    String.raw`\vec E = -\nabla V \qquad \Delta V_{AB} = V_A - V_B = \int_A^B \vec E\cdot d\vec\ell`,
    String.raw`U = qV \qquad W_{\text{campo}, A\to B} = q\,(V_A - V_B) = -\Delta U`,
  ],
  liveEquations(s, p) {
    const VA = potAt(s, s.A.x, s.A.y);
    const VB = potAt(s, s.B.x, s.B.y);
    const Vq = potAt(s, s.q.x, s.q.y);
    const q = num(p, "q");
    const [ex, ey] = fieldAtPt(s, s.q.x, s.q.y);
    return [
      String.raw`V_A = ${texNum(VA)}\ \text{V} \qquad V_B = ${texNum(VB)}\ \text{V} \qquad \Delta V = V_A - V_B = ${texNum(VA - VB)}\ \text{V}`,
      String.raw`U = qV = (${texNum(q)}\ \text{nC})(${texNum(Vq)}\ \text{V}) = ${texNum(q * Vq)}\ \text{nJ} \qquad |\vec E| = ${texNum(Math.hypot(ex, ey))}\ \text{V/m}`,
    ];
  },

  params: [
    {
      key: "montagem",
      label: "Montagem",
      unit: "",
      min: 0,
      max: 4,
      step: 1,
      default: 0,
      options: [
        { value: 0, label: "Placas paralelas" },
        { value: 1, label: "Dois cilindros (+ e −)" },
        { value: 2, label: "Cabo coaxial" },
        { value: 3, label: "Ponta e plano (para-raios)" },
        { value: 4, label: "Em branco: desenhe os eletrodos" },
      ],
    },
    { key: "V0", label: "Potencial dos eletrodos da montagem", unit: "V", min: 1, max: 20, step: 1, default: 10 },
    {
      key: "borda",
      label: "Borda da região",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 0,
      options: [
        { value: 0, label: "Aterrada (V = 0)" },
        { value: 1, label: "Isolada (sem fluxo)" },
      ],
    },
    { key: "Vp", label: "Potencial do pincel", unit: "V", min: -20, max: 20, step: 1, default: 10, live: true },
    { key: "raio", label: "Raio do pincel", unit: "m", min: 0.02, max: 0.15, step: 0.01, default: 0.05, live: true },
    {
      key: "vis",
      label: "Mostrar",
      unit: "",
      min: 0,
      max: 2,
      step: 1,
      default: 0,
      live: true,
      options: [
        { value: 0, label: "Equipotenciais e vetores E" },
        { value: 1, label: "Equipotenciais e mapa de cores de V" },
        { value: 2, label: "Equipotenciais e linhas de campo" },
      ],
    },
    { key: "dV", label: "Espaçamento das equipotenciais", unit: "V", min: 0.5, max: 5, step: 0.5, default: 1, live: true },
    { key: "q", label: "Carga de teste q", unit: "nC", min: -10, max: 10, step: 0.5, default: 2, live: true },
  ],

  observables: [
    { key: "VA", label: "Potencial na ponta A", unit: "V", value: (s) => potAt(s, s.A.x, s.A.y) },
    { key: "VB", label: "Potencial na ponta B", unit: "V", value: (s) => potAt(s, s.B.x, s.B.y) },
    { key: "dV", label: "ΔV = VA − VB (voltímetro)", unit: "V", value: (s) => potAt(s, s.A.x, s.A.y) - potAt(s, s.B.x, s.B.y) },
    { key: "Vq", label: "Potencial na carga de teste", unit: "V", value: (s) => potAt(s, s.q.x, s.q.y) },
    { key: "U", label: "Energia potencial U = qV", unit: "nJ", value: (s, p) => num(p, "q") * potAt(s, s.q.x, s.q.y) },
    { key: "Eq", label: "|E| na carga de teste", unit: "V/m", value: (s) => Math.hypot(...fieldAtPt(s, s.q.x, s.q.y)) },
    { key: "F", label: "|F| = |q|·|E| na carga", unit: "nN", value: (s, p) => Math.abs(num(p, "q")) * Math.hypot(...fieldAtPt(s, s.q.x, s.q.y)) },
    { key: "xq", label: "Posição x da carga", unit: "m", value: (s) => s.q.x },
    { key: "yq", label: "Posição y da carga", unit: "m", value: (s) => s.q.y },
  ],
  chart: { x: "xq", y: "U" },

  scenarios: [
    {
      id: "placas",
      label: "Placas paralelas",
      params: { montagem: 0, V0: 10, borda: 0, vis: 0, dV: 1, q: 2 },
      guide: `### Campo uniforme entre placas
1. As placas estão a $+10$ V e $-10$ V, separadas por 0,8 m. Entre elas as equipotenciais são retas paralelas e **igualmente espaçadas**.
2. Coloque as pontas A e B do voltímetro sobre a mesma equipotencial: $\\Delta V = 0$. Agora alinhe-as na horizontal a 0,4 m uma da outra e confira $E = \\Delta V/d$.
3. Arraste a carga de teste de uma placa à outra e observe no gráfico $U \\times x$ uma reta: $F = -dU/dx$ é constante.
4. Fora das placas o campo "vaza" (efeito de borda). Troque a borda para **isolada** e compare.`,
      predict: [
        {
          question: "Entre as placas, as equipotenciais de 1 em 1 volt ficam:",
          options: ["mais juntas perto das placas", "igualmente espaçadas", "mais juntas no meio", "concêntricas"],
          answer: 1,
          explanation: "Com campo uniforme, $V$ varia linearmente com a posição ($E = -dV/dx$ constante), então a mesma diferença de potencial corresponde sempre à mesma distância.",
        },
      ],
    },
    {
      id: "coaxial",
      label: "Cabo coaxial",
      params: { montagem: 2, V0: 10, borda: 0, vis: 2, dV: 1, q: 2 },
      guide: `### Simetria cilíndrica
1. O condutor interno (raio 0,15 m) está a 10 V e a malha externa (raio 0,6 m) aterrada.
2. As equipotenciais são círculos, cada vez mais afastados: o potencial cai como $V(r) = V_0\\,\\frac{\\ln(r/b)}{\\ln(a/b)}$.
3. Meça $V$ a 0,2 m e a 0,4 m do centro com as pontas e compare com a fórmula.
4. Onde o campo é mais intenso? Arraste a carga de teste e observe o tamanho da força.`,
      predict: [
        {
          question: "Num cabo coaxial, o campo elétrico é mais intenso:",
          options: ["junto ao condutor interno", "no meio do caminho", "junto à malha externa", "igual em todo o espaço entre eles"],
          answer: 0,
          explanation: "Pela lei de Gauss, $E \\propto 1/r$ entre os condutores: as equipotenciais se apertam perto do fio interno.",
        },
      ],
    },
    {
      id: "ponta",
      label: "Poder das pontas",
      params: { montagem: 3, V0: 10, borda: 0, vis: 0, dV: 0.5, q: 2 },
      guide: `### Por que o para-raios é pontudo
1. Um condutor em forma de haste com uma barra no topo está a 10 V acima de um plano aterrado.
2. Todo o condutor tem o **mesmo potencial**, mas as equipotenciais se apertam junto às quinas e à ponta inferior.
3. Leve a carga de teste até perto da ponta e depois para perto da parte lisa do plano: compare $|\\vec E|$.
4. É ali, onde o campo é mais intenso, que o ar se ioniza primeiro.`,
    },
    {
      id: "desenhar",
      label: "Desenhe seus eletrodos",
      params: { montagem: 4, borda: 0, vis: 1, dV: 1, Vp: 10, q: 2 },
      guide: `### Laboratório livre
1. Com o **Pincel**, pinte um eletrodo a +10 V. Mude o **Potencial do pincel** para −10 V e pinte outro.
2. O potencial de cada ponto livre é calculado por relaxação: cada nó vira a média dos quatro vizinhos até nada mais mudar ($\\nabla^2 V = 0$).
3. Desenhe um anel fechado aterrado (0 V) em volta de uma região vazia: dentro dele o campo some (blindagem eletrostática).
4. Use o voltímetro para conferir que todo eletrodo é uma equipotencial.`,
    },
  ],

  exercises: [
    {
      id: "placas",
      prompt: "Duas placas paralelas separadas por {d} cm estão sob uma diferença de potencial de {dv} V. Qual é o módulo do campo elétrico entre elas?",
      vary: { d: [1, 50, 1], dv: [5, 500, 0] },
      fixed: { montagem: 0 },
      answer: { label: "E", unit: "V/m", compute: (p) => num(p, "dv") / (num(p, "d", 1) / 100) },
      hint: "Em campo uniforme, E = ΔV/d (com d em metros).",
    },
    {
      id: "energia",
      prompt: "Uma carga de {q} nC é levada de um ponto com potencial {va} V até outro com potencial {vb} V. Qual é a variação da sua energia potencial elétrica?",
      vary: { q: [-10, 10, 1], va: [-20, 20, 1], vb: [-20, 20, 1] },
      answer: { label: "ΔU", unit: "nJ", compute: (p) => num(p, "q") * (num(p, "vb") - num(p, "va")) },
      tolerance: 0.02,
      hint: "ΔU = q(V_final − V_inicial); nC × V = nJ.",
    },
  ],

  init(p) {
    const fixed = buildFixed(p);
    const m = Math.round(num(p, "montagem"));
    const s: PotState = {
      fixed,
      V: fixed.map((v) => (Number.isNaN(v) ? 0 : v)),
      A: m === 2 ? { x: 0.2, y: 0 } : { x: -0.2, y: 0.2 },
      B: m === 2 ? { x: 0.4, y: 0 } : { x: 0.2, y: 0.2 },
      q: m === 2 ? { x: -0.3, y: -0.2 } : m === 3 ? { x: 0.35, y: -0.2 } : { x: 0, y: -0.25 },
      tool: m === 4 ? "pincel" : "mover",
      drag: null,
      iters: 0,
    };
    return relax(s, p);
  },
  step: (s) => s,
  maxSamples: 150,
  sampleEvery: 1000,

  viewport: () => ({ xMin: BOX.xMin, xMax: BOX.xMax, yMin: BOX.yMin, yMax: BOX.yMax + 0.2, unit: "m" }),

  pointer: {
    down(s, p, pt) {
      for (const k of ["q", "A", "B"] as const) if (Math.hypot(s[k].x - pt.x, s[k].y - pt.y) < HIT) return { ...s, drag: k };
      if (s.tool === "mover" || !inBox(pt.x, pt.y)) return undefined;
      return relax({ ...paint(s, p, pt.x, pt.y), drag: "paint" }, p, 120, 1e-4);
    },
    move(s, p, pt, dragging) {
      if (!dragging || !s.drag) return undefined;
      if (s.drag === "paint") {
        if (!inBox(pt.x, pt.y)) return undefined;
        const n = paint(s, p, pt.x, pt.y);
        return n === s ? undefined : relax(n, p, 120, 1e-4);
      }
      return { ...s, [s.drag]: clampBox(pt.x, pt.y) };
    },
    up(s, p) {
      if (!s.drag) return undefined;
      if (s.drag === "paint") return relax({ ...s, drag: null }, p);
      return { ...s, drag: null };
    },
    cursor(s, _p, pt) {
      for (const k of ["q", "A", "B"] as const) if (Math.hypot(s[k].x - pt.x, s[k].y - pt.y) < HIT) return "grab";
      return s.tool !== "mover" && inBox(pt.x, pt.y) ? "crosshair" : undefined;
    },
  },

  actions: [
    { id: "pincel", label: "Pincel (eletrodo)", run: (s) => ({ ...s, tool: "pincel" }), active: (s) => s.tool === "pincel" },
    { id: "borracha", label: "Borracha", run: (s) => ({ ...s, tool: "borracha" }), active: (s) => s.tool === "borracha" },
    { id: "mover", label: "Só mover pontas", run: (s) => ({ ...s, tool: "mover" }), active: (s) => s.tool === "mover" },
    {
      id: "limpar",
      label: "Apagar eletrodos",
      run: (s, p) => relax({ ...s, fixed: s.fixed.map(() => NaN), V: s.V.map(() => 0) }, p),
    },
    {
      id: "inverter",
      label: "Inverter polaridade",
      run: (s, p) => relax({ ...s, fixed: s.fixed.map((v) => (Number.isNaN(v) ? v : -v)), V: s.V.map((v) => -v) }, p),
    },
  ],

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const { state: s, params: p, theme } = frame;
    const vis = Math.round(num(p, "vis"));
    const bgColor = theme.dark ? "#12161c" : "#ffffff";
    let vMax = 0;
    for (const v of s.V) vMax = Math.max(vMax, Math.abs(v));

    // Mapa de cores de V: cores opacas (misturadas com o fundo) e células levemente
    // sobrepostas, para não aparecerem emendas entre elas.
    if (vis === 1 && vMax > 0) {
      const ov = 0.6 * d.px;
      for (let j = 0; j < NY; j++)
        for (let i = 0; i < NX; i++) {
          const v = s.V[i + j * NX]!;
          if (Math.abs(v) < vMax * 0.01) continue;
          const x0 = Math.max(BOX.xMin, nodeX(i) - H / 2 - ov);
          const y0 = Math.max(BOX.yMin, nodeY(j) - H / 2 - ov);
          const x1 = Math.min(BOX.xMax, nodeX(i) + H / 2 + ov);
          const y1 = Math.min(BOX.yMax, nodeY(j) + H / 2 + ov);
          d.rect(x0, y0, x1 - x0, y1 - y0, { fill: mix(v > 0 ? theme.positive : theme.negative, bgColor, 0.5 * Math.sqrt(Math.abs(v) / vMax)) });
        }
    }
    d.grid(BOX.xMin, BOX.xMax, BOX.yMin, BOX.yMax, 0.25);

    // Eletrodos (trechos contínuos de cada linha da grade num só retângulo)
    for (let j = 0; j < NY; j++) {
      let i = 0;
      while (i < NX) {
        const f = s.fixed[i + j * NX]!;
        if (Number.isNaN(f)) {
          i++;
          continue;
        }
        let e = i;
        while (e + 1 < NX && s.fixed[e + 1 + j * NX] === f) e++;
        const x0 = Math.max(BOX.xMin, nodeX(i) - H / 2);
        const y0 = Math.max(BOX.yMin, nodeY(j) - H / 2 - 0.4 * d.px);
        const x1 = Math.min(BOX.xMax, nodeX(e) + H / 2);
        const y1 = Math.min(BOX.yMax, nodeY(j) + H / 2 + 0.4 * d.px);
        d.rect(x0, y0, x1 - x0, y1 - y0, { fill: mix(f > 0 ? theme.positive : f < 0 ? theme.negative : theme.muted, bgColor, f === 0 ? 0.45 : 0.92) });
        i = e + 1;
      }
    }

    // Equipotenciais com rótulos
    const dV = Math.max(0.1, num(p, "dV", 1));
    const labels: V2[] = [];
    const labelQueue: (() => void)[] = [];
    // Para as curvas de nível, a borda aterrada fica de fora (evita traçar a própria borda).
    const gc = gridOf(s.V);
    if (!neumann(p))
      for (let j = 0; j < NY; j++)
        for (let i = 0; i < NX; i++) if (i === 0 || j === 0 || i === NX - 1 || j === NY - 1) gc.v[i + j * NX] = NaN;
    if (vMax > 0) {
      const levels: number[] = [];
      for (let k = Math.ceil(-vMax / dV); k * dV <= vMax + 1e-9 && levels.length < 81; k++) levels.push(k * dV);
      for (const lv of levels) {
        // Nível deslocado de um fio para não coincidir com o valor exato dos eletrodos.
        const L = lv === 0 ? 0 : lv - Math.sign(lv) * 1e-9 * vMax;
        const color = lv > 0 ? theme.positive : lv < 0 ? theme.negative : theme.text;
        for (const line of contourLines(gc, L)) {
          if (line.length < 3) continue;
          d.polyline(line, { color, width: lv === 0 ? 1.6 : 1.2, alpha: 0.9 });
          if (polylineLength(line) > 0.3) {
            // Rótulo no primeiro ponto candidato que não colide com outro rótulo.
            for (const f of [0.5, 0.25, 0.75, 0.1, 0.9, 0.4, 0.6]) {
              const m = pointAlong(line, f);
              if (!m || labels.some(([x, y]) => Math.abs(x - m.p[0]) < 0.16 && Math.abs(y - m.p[1]) < 0.07)) continue;
              labels.push(m.p);
              labelQueue.push(() => tag(d, `${fmt(lv)} V`, m.p[0], m.p[1], { color, size: 9 }));
              break;
            }
          }
        }
      }
    }

    // E = −∇V: vetores ou linhas de campo
    if (vis === 0 && vMax > 0) {
      let eMax = 0;
      const pts: { x: number; y: number; e: V2 }[] = [];
      for (let j = 2; j < NY - 1; j += 4)
        for (let i = 2; i < NX - 1; i += 4) {
          if (!Number.isNaN(s.fixed[i + j * NX]!)) continue;
          const x = nodeX(i);
          const y = nodeY(j);
          const e = fieldAtPt(s, x, y);
          eMax = Math.max(eMax, Math.hypot(...e));
          pts.push({ x, y, e });
        }
      for (const { x, y, e } of pts) {
        const m = Math.hypot(...e);
        if (m < eMax * 0.01) continue;
        const len = 4 + 18 * Math.sqrt(m / eMax);
        d.arrowPx(x - ((e[0] / m) * len * d.px) / 2, y - ((e[1] / m) * len * d.px) / 2, e[0], e[1], len, {
          color: theme.series[4],
          width: 1.4,
          head: 5,
          alpha: 0.4 + 0.6 * Math.sqrt(m / eMax),
        });
      }
    }
    if (vis === 2) {
      if (linesFor !== s.V) {
        linesFor = s.V;
        linesCache = gridFieldLines(s);
      }
      for (const l of linesCache) {
        d.polyline(l, { color: theme.series[4], width: 1.3, alpha: 0.85 });
        const a = pointAlong(l, 0.5);
        if (a) d.arrowPx(a.p[0] - a.dir[0] * 4 * d.px, a.p[1] - a.dir[1] * 4 * d.px, a.dir[0], a.dir[1], 8, { color: theme.series[4], head: 7, width: 1 });
      }
    }
    d.rect(BOX.xMin, BOX.yMin, BOX.xMax - BOX.xMin, BOX.yMax - BOX.yMin, { stroke: theme.muted, width: 1.5 });
    for (const f of labelQueue) f();

    // Voltímetro: fios até o mostrador
    const VA = potAt(s, s.A.x, s.A.y);
    const VB = potAt(s, s.B.x, s.B.y);
    const meter = { x: BOX.xMin + 0.02, y: BOX.yMax + 0.1 };
    d.line(s.A.x, s.A.y, meter.x + 0.05, meter.y - 0.04, { color: theme.positive, width: 1.2, alpha: 0.6 });
    d.line(s.B.x, s.B.y, meter.x + 0.11, meter.y - 0.04, { color: theme.text, width: 1.2, alpha: 0.6 });
    for (const [pt, label, color] of [
      [s.A, "A", theme.positive],
      [s.B, "B", theme.text],
    ] as const) {
      d.circle(pt.x, pt.y, 7 * d.px, { fill: color, stroke: theme.dark ? "#0b0f14" : "#ffffff", width: 1.5 });
      tag(d, `${label}: ${fmt(label === "A" ? VA : VB)} V`, pt.x, pt.y + 17 * d.px, { color, size: 10, weight: "600" });
    }
    tag(d, `Voltímetro  ΔV = VA − VB = ${fmt(VA - VB)} V`, meter.x, meter.y, { size: 13, weight: "700", align: "left" });

    // Carga de teste: força F = qE e energia U = qV
    const q = num(p, "q");
    const Vq = potAt(s, s.q.x, s.q.y);
    const E = fieldAtPt(s, s.q.x, s.q.y);
    const Em = Math.hypot(...E);
    if (q !== 0 && Em > 0) {
      const eRef = Math.max(1, vMax / 0.4);
      d.arrowPx(s.q.x, s.q.y, q * E[0], q * E[1], Math.min(90, 14 + 60 * Math.sqrt(Em / eRef)), { color: theme.series[2], width: 2.6 });
      d.text("F = qE", s.q.x + (Math.sign(q) * E[0] / Em) * 0.18, s.q.y + (Math.sign(q) * E[1] / Em) * 0.18, { color: theme.series[2], size: 11, weight: "700", dy: -10 });
    }
    d.dot(s.q.x, s.q.y, 10, q > 0 ? theme.positive : q < 0 ? theme.negative : theme.muted);
    d.text(q > 0 ? "+" : q < 0 ? "−" : "0", s.q.x, s.q.y, { color: "#ffffff", size: 13, weight: "700", dy: 1 });
    tag(d, `q: V = ${fmt(Vq)} V   U = ${fmt(q * Vq)} nJ`, s.q.x, s.q.y - 20 * d.px, { size: 10 });

    const toolTxt = s.tool === "pincel" ? `Pincel: ${fmt(num(p, "Vp"))} V` : s.tool === "borracha" ? "Borracha" : "Mover";
    tag(d, `${toolTxt} · arraste A, B e a carga q`, BOX.xMax - 0.02, BOX.yMax + 0.1, { color: theme.muted, size: 10, align: "right" });
  },
});

export default potencial;
