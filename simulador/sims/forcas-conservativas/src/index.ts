import { defineSim, draw, num, texNum, type Params } from "@fisilab/core";

export const G = 9.81;
type P2 = [number, number];

export interface FC {
  A: P2;
  B: P2;
  /** Caminho desenhado pelo aluno (de A a B). */
  custom: P2[];
  /** Distância percorrida ao longo do caminho animado (m). */
  s: number;
  drag: "" | "A" | "B" | "draw";
}

export const FORCES = ["Gravidade", "Mola", "Atrito", "Rotacional"] as const;
export const PATHS = ["Reta", "Escada", "Arco", "Desenhado"] as const;
/** Forças conservativas (têm energia potencial). */
export const CONSERVATIVE = [true, true, false, false];

const forca = (p: Params) => Math.round(num(p, "forca"));
const caminho = (p: Params) => Math.round(num(p, "caminho"));

/** Força (N) no ponto r para as forças com campo definido (gravidade, mola, rotacional). */
export function field(f: number, r: P2, p: Params): P2 {
  const m = num(p, "m", 1);
  if (f === 0) return [0, -m * G];
  if (f === 1) {
    const k = num(p, "k", 4);
    return [-k * r[0], -k * r[1]];
  }
  const c = num(p, "c", 3);
  return [-c * r[1], c * r[0]];
}

/**
 * Trabalho de uma força num segmento reto, pela integral de linha
 * ∫F·dr. Os três campos são lineares em r, então a regra do ponto médio é
 * exata; o atrito tem módulo constante μmg e aponta contra o deslocamento.
 */
export function segWork(f: number, a: P2, b: P2, p: Params): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  if (f === 2) return -num(p, "mu", 0.3) * num(p, "m", 1) * G * Math.hypot(dx, dy);
  const F = field(f, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], p);
  return F[0] * dx + F[1] * dy;
}

export function pathLength(pts: P2[]): number {
  let L = 0;
  for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i]![0] - pts[i - 1]![0], pts[i]![1] - pts[i - 1]![1]);
  return L;
}

/** Trabalho ao longo da poligonal até a distância s (todo o caminho se s for omitido). */
export function workAlong(f: number, pts: P2[], p: Params, s = Infinity): number {
  let W = 0;
  let left = s;
  for (let i = 1; i < pts.length && left > 0; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (L <= left) {
      W += segWork(f, a, b, p);
      left -= L;
    } else {
      const t = left / L;
      W += segWork(f, a, [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])], p);
      left = 0;
    }
  }
  return W;
}

export function pointAt(pts: P2[], s: number): { pos: P2; dir: P2 } {
  let left = s;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (L >= left && L > 0) {
      const t = left / L;
      return { pos: [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])], dir: [(b[0] - a[0]) / L, (b[1] - a[1]) / L] };
    }
    left -= L;
  }
  const n = pts.length;
  const a = pts[Math.max(0, n - 2)]!;
  const b = pts[n - 1]!;
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  return { pos: b, dir: [(b[0] - a[0]) / L, (b[1] - a[1]) / L] };
}

/** Arco circular de A a B com flecha de 0,5|AB| para a esquerda de AB. */
function arc(A: P2, B: P2, n = 48): P2[] {
  const dx = B[0] - A[0];
  const dy = B[1] - A[1];
  const c = Math.hypot(dx, dy);
  if (c < 1e-9) return [A, B];
  const sag = 0.5 * c;
  const R = (sag * sag + (c * c) / 4) / (2 * sag);
  const nx = -dy / c;
  const ny = dx / c;
  const mx = (A[0] + B[0]) / 2;
  const my = (A[1] + B[1]) / 2;
  const cx = mx - nx * (R - sag);
  const cy = my - ny * (R - sag);
  const a0 = Math.atan2(A[1] - cy, A[0] - cx);
  let a1 = Math.atan2(B[1] - cy, B[0] - cx);
  // sentido que passa pelo lado da flecha
  const am = Math.atan2(my + ny * sag - cy, mx + nx * sag - cx);
  const between = (a: number, lo: number, hi: number) => {
    const span = (((hi - lo) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    const off = (((a - lo) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    return off <= span;
  };
  if (between(am, a0, a1)) {
    while (a1 < a0) a1 += 2 * Math.PI;
  } else {
    while (a1 > a0) a1 -= 2 * Math.PI;
  }
  const pts: P2[] = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    pts.push([cx + R * Math.cos(a), cy + R * Math.sin(a)]);
  }
  pts[0] = A;
  pts[n] = B;
  return pts;
}

export function defaultCustom(A: P2, B: P2): P2[] {
  return [A, [A[0] - 1.5, A[1] + 3.2], [0, 3.6], [0.8, -3.5], [B[0] + 1.5, -1], B];
}

/** Poligonal do caminho i (0 reta, 1 escada, 2 arco, 3 desenhado, 4 fechado: reta de ida + arco de volta). */
export function pathPoints(i: number, st: Pick<FC, "A" | "B" | "custom">): P2[] {
  const { A, B } = st;
  if (i === 1) return [A, [B[0], A[1]], B];
  if (i === 2) return arc(A, B);
  if (i === 3) return st.custom.length >= 2 ? st.custom : defaultCustom(A, B);
  if (i === 4) return [A, ...arc(A, B).reverse()];
  return [A, B];
}

/** Variação de energia potencial de A a B (só para as forças conservativas). */
export function deltaU(f: number, A: P2, B: P2, p: Params): number {
  if (f === 0) return num(p, "m", 1) * G * (B[1] - A[1]);
  if (f === 1) return 0.5 * num(p, "k", 4) * (B[0] ** 2 + B[1] ** 2 - A[0] ** 2 - A[1] ** 2);
  return NaN;
}

const VIEW = { x0: -6, x1: 6, y0: -4.6, y1: 4.6 };
const clampV = (pt: P2): P2 => [Math.min(VIEW.x1 - 0.3, Math.max(VIEW.x0 + 0.3, pt[0])), Math.min(VIEW.y1 - 0.3, Math.max(VIEW.y0 + 0.3, pt[1]))];
const near = (a: P2, b: { x: number; y: number }, r = 0.45) => Math.hypot(a[0] - b.x, a[1] - b.y) < r;
const fmt = (v: number, n = 3) => {
  if (!Number.isFinite(v)) return "—";
  const r = Math.abs(v) < 5e-4 ? 0 : v;
  return Number(r.toPrecision(n)).toString().replace(".", ",");
};

function animPath(s: FC, p: Params) {
  return pathPoints(caminho(p), s);
}

export const forcasConservativas = defineSim<FC>({
  id: "forcas-conservativas",
  title: "Forças conservativas e dissipativas",
  course: "FG I",
  topic: "Energia",
  priority: "P2",
  summary:
    "Leve uma partícula de A a B por caminhos diferentes (inclusive um desenhado por você) e compare a integral de linha do trabalho da gravidade, de uma mola, do atrito e de um campo rotacional: só as conservativas têm energia potencial.",
  equations: [
    String.raw`W_{A\to B} = \int_{A}^{B} \vec F \cdot d\vec r \approx \sum_i \vec F(\vec r_i^{\,\text{médio}}) \cdot \Delta \vec r_i`,
    String.raw`\text{conservativa: } \oint \vec F \cdot d\vec r = 0 \iff W_{A\to B} = -\Delta U = U(A) - U(B)`,
    String.raw`U_g = mgy \qquad U_{\text{mola}} = \tfrac12 k\,(x^2 + y^2) \qquad W_{\text{atrito}} = -\mu m g\,\ell_{\text{caminho}}`,
    String.raw`\vec F_{\text{rot}} = c\,(-y,\ x): \ \oint \vec F_{\text{rot}} \cdot d\vec r = 2c \cdot \text{Área} \neq 0`,
  ],
  liveEquations(s, p) {
    const f = forca(p);
    const path = animPath(s, p);
    const W = workAlong(f, path, p, s.s);
    const out = [String.raw`W_{\text{${FORCES[f]}}} = ${texNum(W)}\ \text{J} \quad (\ell = ${texNum(s.s)}\ \text{m de } ${texNum(pathLength(path))}\ \text{m})`];
    const dU = deltaU(f, s.A, s.B, p);
    out.push(
      CONSERVATIVE[f]
        ? String.raw`-\Delta U_{A\to B} = ${texNum(-dU)}\ \text{J (igual para todos os caminhos)}`
        : String.raw`\text{${FORCES[f]}: não existe } U(x, y) \text{ — o trabalho depende do caminho}`,
    );
    return out;
  },

  params: [
    {
      key: "forca",
      label: "Força em destaque",
      unit: "",
      min: 0,
      max: 3,
      step: 1,
      default: 0,
      options: [
        { value: 0, label: "Gravidade (plano vertical)" },
        { value: 1, label: "Mola presa na origem" },
        { value: 2, label: "Atrito (mesa horizontal)" },
        { value: 3, label: "Campo rotacional c(−y, x)" },
      ],
    },
    {
      key: "caminho",
      label: "Caminho percorrido",
      unit: "",
      min: 0,
      max: 4,
      step: 1,
      default: 0,
      options: [
        { value: 0, label: "Reta" },
        { value: 1, label: "Escada (x, depois y)" },
        { value: 2, label: "Arco" },
        { value: 3, label: "Desenhado (arraste no palco)" },
        { value: 4, label: "Fechado: reta de ida, arco de volta" },
      ],
    },
    { key: "m", label: "Massa", unit: "kg", min: 0.1, max: 5, step: 0.1, default: 1 },
    { key: "k", label: "Constante da mola", unit: "N/m", min: 0.5, max: 20, step: 0.5, default: 4 },
    { key: "mu", label: "Coeficiente de atrito", unit: "", min: 0, max: 1, step: 0.01, default: 0.3 },
    { key: "c", label: "Intensidade do campo rotacional", unit: "N/m", min: 0, max: 10, step: 0.5, default: 3 },
    { key: "vel", label: "Rapidez da animação", unit: "m/s", min: 0.2, max: 5, step: 0.1, default: 1.5, live: true },
    { key: "ax", label: "A: x", unit: "m", min: -5, max: 5, step: 0.1, default: -3 },
    { key: "ay", label: "A: y", unit: "m", min: -4, max: 4, step: 0.1, default: -1.5 },
    { key: "bx", label: "B: x", unit: "m", min: -5, max: 5, step: 0.1, default: 3 },
    { key: "by", label: "B: y", unit: "m", min: -4, max: 4, step: 0.1, default: 2 },
  ],

  observables: [
    { key: "s", label: "Distância percorrida", unit: "m", value: (s) => s.s },
    { key: "W", label: "Trabalho da força em destaque", unit: "J", value: (s, p) => workAlong(forca(p), animPath(s, p), p, s.s) },
    { key: "Wg", label: "Trabalho da gravidade", unit: "J", value: (s, p) => workAlong(0, animPath(s, p), p, s.s) },
    { key: "Wm", label: "Trabalho da mola", unit: "J", value: (s, p) => workAlong(1, animPath(s, p), p, s.s) },
    { key: "Wa", label: "Trabalho do atrito", unit: "J", value: (s, p) => workAlong(2, animPath(s, p), p, s.s) },
    { key: "Wr", label: "Trabalho do campo rotacional", unit: "J", value: (s, p) => workAlong(3, animPath(s, p), p, s.s) },
    { key: "x", label: "Posição x", unit: "m", value: (s, p) => pointAt(animPath(s, p), s.s).pos[0] },
    { key: "y", label: "Posição y", unit: "m", value: (s, p) => pointAt(animPath(s, p), s.s).pos[1] },
  ],
  chart: { x: "s", y: "W" },

  scenarios: [
    {
      id: "gravidade",
      label: "Gravidade: três caminhos",
      params: { forca: 0, caminho: 0 },
      guide: `### O trabalho do peso não liga para o caminho
1. Rode pelo caminho **Reta** e anote $W$ no fim. Depois troque para **Escada** e **Arco**.
2. Compare com a tabela: a coluna da gravidade é igual em todas as linhas e vale $-mg\\,\\Delta y$.
3. No arco, o trabalho fica positivo em parte do trajeto (trecho descendo) e negativo em outra: as cores do caminho mostram o sinal de $\\vec F \\cdot d\\vec r$.
4. Arraste A e B: o trabalho só muda quando muda a **altura** de A ou de B.`,
      predict: [
        {
          question: "Levando a partícula de A a B pelo arco (mais longo), o trabalho do peso, comparado ao da reta, é:",
          options: ["maior em módulo", "igual", "menor em módulo"],
          answer: 1,
          explanation: "O peso é conservativo: $W = -\\Delta U = -mg(y_B - y_A)$ para qualquer caminho entre os mesmos pontos.",
        },
      ],
    },
    {
      id: "atrito",
      label: "Atrito: depende do caminho",
      params: { forca: 2, caminho: 2 },
      guide: `### Atrito não tem energia potencial
1. O atrito tem módulo $\\mu m g$ e aponta sempre contra o movimento: $W = -\\mu m g\\,\\ell$.
2. Compare a coluna do atrito na tabela: quanto mais longo o caminho, mais negativo o trabalho.
3. No caminho **fechado** a partícula volta a A e, mesmo assim, $W \\neq 0$. Não há função $U(x,y)$ com $W = -\\Delta U$.`,
      predict: [
        {
          question: "Num caminho fechado (sai de A e volta a A), o trabalho do atrito é:",
          options: ["zero, porque voltou ao mesmo ponto", "negativo", "positivo"],
          answer: 1,
          explanation: "Cada trecho contribui com $-\\mu m g\\,\\Delta\\ell < 0$; nada cancela. Por isso o atrito é dissipativo.",
        },
      ],
    },
    {
      id: "circulacao",
      label: "Circulação num caminho fechado",
      params: { forca: 3, caminho: 4 },
      guide: `### Circulação e rotacional
1. O campo $\\vec F = c(-y, x)$ gira em torno da origem. Rode o caminho **fechado** (reta de ida, arco de volta).
2. A circulação $\\oint \\vec F\\cdot d\\vec r$ não é zero: vale $2c$ vezes a área envolvida (teorema de Stokes no plano).
3. Troque para **Gravidade** ou **Mola** com o mesmo caminho fechado: a circulação é zero (até o arredondamento).
4. Desenhe um caminho que dê uma volta em torno da origem e compare os sinais dos trechos.`,
    },
    {
      id: "desenhar",
      label: "Desenhe seu caminho",
      params: { forca: 1, caminho: 3 },
      guide: `### Mola: um caminho qualquer
1. Arraste no palco a partir de qualquer ponto para desenhar um caminho; ele sai de A e termina em B.
2. Rode: o trabalho da mola oscila durante o percurso (afasta e aproxima da origem), mas termina em $-\\tfrac12 k (r_B^2 - r_A^2)$.
3. Compare a linha **Desenhado** da tabela com as outras em cada coluna.`,
    },
  ],

  exercises: [
    {
      id: "mola",
      prompt:
        "Uma partícula presa a uma mola de constante {k} N/m e comprimento natural nulo, ancorada na origem, é levada de A = ({ax}; {ay}) m a B = ({bx}; {by}) m por um caminho qualquer. Qual o trabalho da mola?",
      vary: { k: [1, 10, 1], ax: [-4, -1, 1], ay: [-3, 3, 1], bx: [1, 4, 1], by: [-3, 3, 1] },
      fixed: { forca: 1 },
      answer: {
        label: "W",
        unit: "J",
        compute: (p) => -0.5 * num(p, "k") * (num(p, "bx") ** 2 + num(p, "by") ** 2 - num(p, "ax") ** 2 - num(p, "ay") ** 2),
      },
      tolerance: 0.03,
      hint: "A mola é conservativa: W = −ΔU com U = ½k r².",
    },
    {
      id: "atrito-escada",
      prompt:
        "Uma caixa de {m} kg é arrastada sobre uma mesa (μ = {mu}) de A = ({ax}; {ay}) m a B = ({bx}; {by}) m, primeiro paralelamente a x e depois paralelamente a y. Qual o trabalho do atrito?",
      vary: { m: [0.5, 5, 1], mu: [0.1, 0.6, 2], ax: [-4, -1, 1], ay: [-3, 0, 1], bx: [1, 4, 1], by: [0.5, 3, 1] },
      fixed: { forca: 2, caminho: 1 },
      answer: {
        label: "W",
        unit: "J",
        compute: (p) =>
          -num(p, "mu") * num(p, "m") * G * (Math.abs(num(p, "bx") - num(p, "ax")) + Math.abs(num(p, "by") - num(p, "ay"))),
      },
    },
  ],

  init: (p) => {
    const A: P2 = [num(p, "ax", -3), num(p, "ay", -1.5)];
    const B: P2 = [num(p, "bx", 3), num(p, "by", 2)];
    return { A, B, custom: defaultCustom(A, B), s: 0, drag: "" };
  },
  step: (s, p, _t, dt) => ({ ...s, s: Math.min(s.s + num(p, "vel", 1.5) * dt, pathLength(animPath(s, p))) }),
  dt: 0.01,
  sampleEvery: 2,
  tEnd: 120,
  stopWhen: (s, p) => pathLength(animPath(s, p)) - s.s + 1e-9,

  pointer: {
    down(s, _p, pt) {
      if (near(s.A, pt)) return { ...s, drag: "A" };
      if (near(s.B, pt)) return { ...s, drag: "B" };
      if (pt.x < VIEW.x0 || pt.x > VIEW.x1 || pt.y < VIEW.y0 || pt.y > VIEW.y1) return undefined;
      return { ...s, drag: "draw", custom: [s.A, clampV([pt.x, pt.y])], s: 0 };
    },
    move(s, _p, pt, dragging) {
      if (!dragging || !s.drag) return undefined;
      const q = clampV([pt.x, pt.y]);
      if (s.drag === "A" || s.drag === "B") {
        const r: P2 = [Math.round(q[0] * 10) / 10, Math.round(q[1] * 10) / 10];
        const A = s.drag === "A" ? r : s.A;
        const B = s.drag === "B" ? r : s.B;
        const custom = s.custom.length >= 2 ? [A, ...s.custom.slice(1, -1), B] : defaultCustom(A, B);
        return { ...s, A, B, custom, s: 0 };
      }
      const last = s.custom[s.custom.length - 1]!;
      if (Math.hypot(q[0] - last[0], q[1] - last[1]) < 0.15) return undefined;
      return { ...s, custom: [...s.custom, q] };
    },
    up(s) {
      if (!s.drag) return undefined;
      if (s.drag === "draw") {
        const custom = s.custom.length >= 3 ? [...s.custom, s.B] : defaultCustom(s.A, s.B);
        return { ...s, custom, drag: "" };
      }
      return { ...s, drag: "" };
    },
    cursor: (s, _p, pt) => (near(s.A, pt) || near(s.B, pt) ? "grab" : pt.x <= VIEW.x1 ? "crosshair" : undefined),
  },
  actions: [
    { id: "padrao", label: "Restaurar caminho desenhado", run: (s) => ({ ...s, custom: defaultCustom(s.A, s.B), s: 0 }) },
  ],

  narrowSplit: () => 0.578,
  viewport: () => ({ xMin: VIEW.x0 - 0.3, xMax: 15.5, yMin: VIEW.y0 - 0.3, yMax: VIEW.y1 + 0.3, unit: "" }),

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const { state: s, params: p, theme } = frame;
    const f = forca(p);
    const ci = caminho(p);

    d.rect(VIEW.x0, VIEW.y0, VIEW.x1 - VIEW.x0, VIEW.y1 - VIEW.y0, { stroke: theme.grid, width: 1 });
    d.grid(VIEW.x0, VIEW.x1, VIEW.y0, VIEW.y1, 1);

    // fundo: equipotenciais (conservativas) ou campo (não conservativas)
    if (f === 0) {
      for (let y = Math.ceil(VIEW.y0); y <= VIEW.y1; y++) {
        d.line(VIEW.x0, y, VIEW.x1, y, { color: theme.series[4]!, alpha: 0.35, width: 1 });
        d.text(`U = ${fmt(num(p, "m", 1) * G * y)} J`, VIEW.x1 - 0.1, y + 0.18, { align: "right", size: 9, color: theme.series[4]! });
      }
    } else if (f === 1) {
      const k = num(p, "k", 4);
      for (let r = 1; r <= 7; r++) {
        d.circle(0, 0, r, { stroke: theme.series[4]!, alpha: 0.35, width: 1 });
        if (r <= 4) d.text(`${fmt(0.5 * k * r * r)} J`, r * 0.707 + 0.1, r * 0.707 + 0.1, { size: 9, color: theme.series[4]!, align: "left" });
      }
      d.dot(0, 0, 4, theme.text);
      d.text("O (âncora)", 0, -0.35, { size: 10, color: theme.muted });
    }
    if (f !== 2) {
      // setas do campo numa grade
      let fmax = 1e-9;
      const grid: [number, number, P2][] = [];
      for (let x = -5; x <= 5; x += 1.25)
        for (let y = -3.75; y <= 3.75; y += 1.25) {
          const F = field(f, [x, y], p);
          fmax = Math.max(fmax, Math.hypot(F[0], F[1]));
          grid.push([x, y, F]);
        }
      for (const [x, y, F] of grid) {
        const L = (Math.hypot(F[0], F[1]) / fmax) * 0.55;
        if (L > 0.03) d.arrow(x, y, (F[0] / Math.hypot(F[0], F[1])) * L, (F[1] / Math.hypot(F[0], F[1])) * L, { color: theme.muted, width: 1, head: 5, alpha: 0.55 });
      }
    } else {
      d.text("Atrito: módulo μmg, sempre contra o movimento — sem campo nem U(x, y)", 0, VIEW.y1 - 0.35, { size: 10, color: theme.muted });
    }

    // todos os caminhos (finos) e o animado colorido pelo sinal de F·dr
    for (let i = 0; i < 4; i++) {
      if (i === ci) continue;
      d.polyline(pathPoints(i, s), { color: theme.muted, width: 1, dash: [4, 4], alpha: 0.6 });
    }
    const path = animPath(s, p);
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1]!;
      const b = path[i]!;
      const w = segWork(f, a, b, p);
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      const col = Math.abs(w / L) < 1e-6 ? theme.muted : w > 0 ? theme.positive : theme.negative;
      d.line(a[0], a[1], b[0], b[1], { color: col, width: 3 });
    }
    // A, B
    for (const [nm, pt] of [["A", s.A], ["B", s.B]] as const) {
      d.circle(pt[0], pt[1], 0.18, { fill: theme.text, minPx: 5 });
      d.text(nm, pt[0] - 0.35, pt[1] + 0.35, { size: 13, weight: "700" });
    }

    // partícula, força e deslocamento
    const { pos, dir } = pointAt(path, s.s);
    const F: P2 = f === 2 ? [-dir[0] * num(p, "mu", 0.3) * num(p, "m", 1) * G, -dir[1] * num(p, "mu", 0.3) * num(p, "m", 1) * G] : field(f, pos, p);
    const Fm = Math.hypot(F[0], F[1]);
    if (Fm > 1e-9) {
      d.arrowPx(pos[0], pos[1], F[0], F[1], Math.min(70, 18 + Fm * 4), { color: theme.series[1]! });
      d.text("F", pos[0] + (F[0] / Fm) * 1.1, pos[1] + (F[1] / Fm) * 1.1 + 0.25, { color: theme.series[1]!, size: 12, weight: "700" });
    }
    d.arrowPx(pos[0], pos[1], dir[0], dir[1], 30, { color: theme.accent, width: 1.5 });
    d.circle(pos[0], pos[1], 0.16, { fill: theme.series[1]!, stroke: theme.text, width: 1, minPx: 6 });
    d.text("vermelho: F·dr > 0   azul: F·dr < 0   (arraste A, B ou desenhe)", VIEW.x0 + 0.1, VIEW.y0 + 0.3, { align: "left", size: 10, color: theme.muted });

    // ---- tabela de trabalhos ----
    const tx = 6.6;
    const cols = [9.1, 10.75, 12.4, 14.05];
    const top = 4.3;
    const dy = 0.62;
    d.text("Trabalho de A a B (J)", tx, top, { align: "left", size: 12, weight: "700" });
    FORCES.forEach((nm, j) =>
      d.text(["Grav.", "Mola", "Atrito", "Rot."][j]!, cols[j]!, top - dy, { size: 11, weight: j === f ? "700" : "500", color: j === f ? theme.accent : theme.text }),
    );
    d.rect(cols[f]! - 0.78, top - dy * 7.6, 1.56, dy * 7.2, { fill: theme.accent, alpha: 0.08 });
    const rows: [string, P2[]][] = PATHS.map((nm, i) => [nm, pathPoints(i, s)]);
    rows.forEach(([nm, pts], i) => {
      const y = top - dy * (i + 2);
      const hi = i === ci;
      d.text(nm, tx, y, { align: "left", size: 11, weight: hi ? "700" : "400", color: hi ? theme.accent : theme.text });
      for (let j = 0; j < 4; j++) d.text(fmt(workAlong(j, pts, p)), cols[j]!, y, { size: 11 });
    });
    const yC = top - dy * 6;
    d.text("∮ reta − arco", tx, yC, { align: "left", size: 11, weight: ci === 4 ? "700" : "400", color: ci === 4 ? theme.accent : theme.text });
    const closed = pathPoints(4, s);
    for (let j = 0; j < 4; j++) d.text(fmt(workAlong(j, closed, p)), cols[j]!, yC, { size: 11, weight: "600" });
    const yU = top - dy * 7;
    d.text("−ΔU", tx, yU, { align: "left", size: 11, weight: "600", color: theme.series[4]! });
    for (let j = 0; j < 4; j++)
      d.text(CONSERVATIVE[j] ? fmt(-deltaU(j, s.A, s.B, p)) : "não há U", cols[j]!, yU, { size: j > 1 ? 9 : 11, color: theme.series[4]! });
    d.line(tx, top - dy * 1.45, 15, top - dy * 1.45, { color: theme.grid, width: 1 });
    d.line(tx, top - dy * 5.5, 15, top - dy * 5.5, { color: theme.grid, width: 1 });

    const Wnow = workAlong(f, path, p, s.s);
    const lines = [
      `Força: ${FORCES[f]} (${CONSERVATIVE[f] ? "conservativa" : "não conservativa"})`,
      `Caminho: ${ci === 4 ? "fechado (A → B → A)" : PATHS[ci]}, ℓ = ${fmt(pathLength(path))} m`,
      `Trabalho até agora: ${fmt(Wnow)} J`,
      CONSERVATIVE[f]
        ? "Mesma coluna em toda linha: W = −ΔU"
        : "A coluna muda de linha para linha",
    ];
    lines.forEach((ln, i) => d.text(ln, tx, -0.4 - i * 0.65, { align: "left", size: 11, weight: i === 2 ? "700" : "400" }));
    d.text("Gravidade e mola: plano vertical / mola na origem.", tx, -3.4, { align: "left", size: 9, color: theme.muted });
    d.text("Atrito: mesa horizontal vista de cima.", tx, -3.95, { align: "left", size: 9, color: theme.muted });
  },
});

export default forcasConservativas;
