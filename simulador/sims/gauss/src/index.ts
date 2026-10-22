import { clamp, defineSim, draw, num, texNum, type Params } from "@fisilab/core";
import {
  EPS0,
  L_EXT,
  contourElements,
  enclosedCharge,
  field,
  fluxNumeric,
  fmt,
  inside,
  is3D,
  type Source,
  type Surface,
} from "./physics.ts";
import { derivation } from "./derivation.ts";

export * from "./physics.ts";

const NC = 1e-9;
const VP = { xMin: -1.2, xMax: 1.2, yMin: -0.8, yMax: 0.8 };
const HIT = 0.07;

type Drag = { kind: "carga"; i: number } | { kind: "fonte"; ox: number; oy: number } | { kind: "sup"; ox: number; oy: number } | { kind: "tam" };

export interface GaussState {
  /** Posições das três cargas pontuais (as cargas vêm dos parâmetros q1–q3). */
  charges: { x: number; y: number }[];
  /** Posição do fio, do centro da esfera carregada ou do plano (só x). */
  src: { x: number; y: number };
  surf: { cx: number; cy: number; a: number; b: number };
  drag: Drag | null;
}

const caso = (p: Params) => Math.round(num(p, "caso"));
const nElem = (p: Params) => Math.max(4, Math.round(num(p, "N", 32)));

export function surfaceOf(s: GaussState, p: Params): Surface {
  return { ...s.surf, shape: Math.round(num(p, "forma")) };
}

export function sourceOf(s: GaussState, p: Params): Source {
  switch (caso(p)) {
    case 1:
      return { kind: "fio", x: s.src.x, y: s.src.y, lambda: num(p, "lambda") * NC };
    case 2:
      return { kind: "plano", x: s.src.x, sigma: num(p, "sigma") * NC };
    case 3:
      return { kind: "esfera", x: s.src.x, y: s.src.y, R: num(p, "R0", 0.3), Q: num(p, "Qe") * NC };
    default:
      return {
        kind: "pontos",
        charges: s.charges.map((c, i) => ({ x: c.x, y: c.y, q: num(p, `q${i + 1}`) * NC })),
      };
  }
}

export const fluxOf = (s: GaussState, p: Params) => fluxNumeric(sourceOf(s, p), surfaceOf(s, p), nElem(p));
export const qIntOf = (s: GaussState, p: Params) => enclosedCharge(sourceOf(s, p), surfaceOf(s, p));

const SURF_NAME = (src: Source, shape: number) =>
  is3D(src)
    ? shape === 0
      ? "esfera (corte em z = 0)"
      : "caixa (profundidade = largura), corte em z = 0"
    : shape === 0
      ? `cilindro de comprimento L = ${L_EXT} m (corte)`
      : `caixa de comprimento L = ${L_EXT} m (corte)`;

function handle(s: GaussState, p: Params): [number, number] {
  return Math.round(num(p, "forma")) === 0 ? [s.surf.cx + s.surf.a, s.surf.cy] : [s.surf.cx + s.surf.a, s.surf.cy + s.surf.b];
}

function hitTest(s: GaussState, p: Params, x: number, y: number): Drag | null {
  const [hx, hy] = handle(s, p);
  if (Math.hypot(x - hx, y - hy) < HIT) return { kind: "tam" };
  const c = caso(p);
  if (c === 0) {
    for (let i = 0; i < s.charges.length; i++) {
      const q = s.charges[i]!;
      if (num(p, `q${i + 1}`) !== 0 && Math.hypot(x - q.x, y - q.y) < HIT) return { kind: "carga", i };
    }
  } else if (c === 1 && Math.hypot(x - s.src.x, y - s.src.y) < HIT) {
    return { kind: "fonte", ox: x - s.src.x, oy: y - s.src.y };
  } else if (c === 2 && Math.abs(x - s.src.x) < 0.05) {
    return { kind: "fonte", ox: x - s.src.x, oy: 0 };
  } else if (c === 3 && Math.hypot(x - s.src.x, y - s.src.y) < Math.max(HIT, num(p, "R0", 0.3) * 0.5)) {
    return { kind: "fonte", ox: x - s.src.x, oy: y - s.src.y };
  }
  if (inside(surfaceOf(s, p), x, y)) return { kind: "sup", ox: x - s.surf.cx, oy: y - s.surf.cy };
  return null;
}

function applyDrag(s: GaussState, p: Params, x: number, y: number): GaussState | undefined {
  const d = s.drag;
  if (!d) return undefined;
  const cx = (v: number) => clamp(v, VP.xMin + 0.02, VP.xMax - 0.02);
  const cy = (v: number) => clamp(v, VP.yMin + 0.02, VP.yMax - 0.02);
  if (d.kind === "carga") {
    const charges = s.charges.map((c, i) => (i === d.i ? { x: cx(x), y: cy(y) } : c));
    return { ...s, charges };
  }
  if (d.kind === "fonte") return { ...s, src: { x: cx(x - d.ox), y: caso(p) === 2 ? 0 : cy(y - d.oy) } };
  if (d.kind === "sup") return { ...s, surf: { ...s.surf, cx: cx(x - d.ox), cy: cy(y - d.oy) } };
  // Redimensionar: círculo pelo raio; retângulo pelo canto.
  if (Math.round(num(p, "forma")) === 0) {
    const a = clamp(Math.hypot(x - s.surf.cx, y - s.surf.cy), 0.06, 1.1);
    return { ...s, surf: { ...s.surf, a } };
  }
  return { ...s, surf: { ...s.surf, a: clamp(Math.abs(x - s.surf.cx), 0.06, 1.1), b: clamp(Math.abs(y - s.surf.cy), 0.06, 0.78) } };
}

export const gauss = defineSim<GaussState>({
  id: "gauss",
  title: "Superfícies gaussianas e fluxo",
  course: "FG III",
  topic: "Gauss",
  priority: "P1",
  summary:
    "Arraste uma superfície gaussiana em torno de cargas pontuais, fio, plano ou esfera carregada. O fluxo é somado elemento por elemento e comparado com q_int/ε₀.",
  derivation,
  equations: [
    String.raw`\Phi_E = \oint_S \vec E\cdot\hat n\,dA \approx \sum_i (\vec E_i\cdot\hat n_i)\,\Delta A_i = \frac{q_\text{int}}{\varepsilon_0}`,
    String.raw`\text{carga pontual: } E = \frac{q}{4\pi\varepsilon_0 r^2} \qquad \text{fio: } E = \frac{\lambda}{2\pi\varepsilon_0 r} \qquad \text{plano: } E = \frac{\sigma}{2\varepsilon_0}`,
    String.raw`\text{esfera uniforme: } E = \frac{Q\,r}{4\pi\varepsilon_0 R^3}\ (r<R) \qquad E = \frac{Q}{4\pi\varepsilon_0 r^2}\ (r\ge R)`,
  ],
  liveEquations(s, p) {
    const phi = fluxOf(s, p);
    const q = qIntOf(s, p);
    const n = nElem(p);
    const elems = is3D(sourceOf(s, p)) ? (Math.round(num(p, "forma")) === 0 ? 2 * n * n : 6 * n * n) : contourElements(surfaceOf(s, p), n).length;
    return [
      String.raw`\Phi_\text{num} = \sum_{i=1}^{${elems}} \vec E_i\cdot\hat n_i\,\Delta A_i = ${texNum(phi)}\ \text{N·m}^2/\text{C}`,
      String.raw`\frac{q_\text{int}}{\varepsilon_0} = \frac{${texNum(q / NC)}\ \text{nC}}{\varepsilon_0} = ${texNum(q / EPS0)}\ \text{N·m}^2/\text{C}`,
    ];
  },

  params: [
    {
      key: "caso",
      label: "Distribuição de carga",
      unit: "",
      min: 0,
      max: 3,
      step: 1,
      default: 0,
      options: [
        { value: 0, label: "Cargas pontuais (arrastáveis)" },
        { value: 1, label: "Fio infinito (perpendicular à tela)" },
        { value: 2, label: "Plano infinito (perpendicular à tela)" },
        { value: 3, label: "Esfera isolante uniforme" },
      ],
    },
    {
      key: "forma",
      label: "Superfície gaussiana",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 0,
      options: [
        { value: 0, label: "Círculo (esfera ou cilindro)" },
        { value: 1, label: "Retângulo (caixa)" },
      ],
    },
    { key: "N", label: "Elementos na borda", unit: "", min: 4, max: 64, step: 4, default: 24, live: true },
    { key: "q1", label: "Carga q₁", unit: "nC", min: -10, max: 10, step: 0.5, default: 2, live: true },
    { key: "q2", label: "Carga q₂", unit: "nC", min: -10, max: 10, step: 0.5, default: -1, live: true },
    { key: "q3", label: "Carga q₃ (0 = ausente)", unit: "nC", min: -10, max: 10, step: 0.5, default: 0, live: true },
    { key: "lambda", label: "Densidade linear λ do fio", unit: "nC/m", min: -20, max: 20, step: 0.5, default: 5, live: true },
    { key: "sigma", label: "Densidade superficial σ do plano", unit: "nC/m²", min: -20, max: 20, step: 0.5, default: 5, live: true },
    { key: "Qe", label: "Carga total Q da esfera", unit: "nC", min: -20, max: 20, step: 0.5, default: 5, live: true },
    { key: "R0", label: "Raio R da esfera carregada", unit: "m", min: 0.1, max: 0.6, step: 0.01, default: 0.35, live: true },
    { key: "a0", label: "Tamanho inicial da superfície", unit: "m", min: 0.1, max: 0.7, step: 0.01, default: 0.45 },
  ],

  observables: [
    { key: "Phi", label: "Fluxo numérico Φ", unit: "N·m²/C", value: (s, p) => fluxOf(s, p) },
    { key: "PhiT", label: "q_int/ε₀", unit: "N·m²/C", value: (s, p) => qIntOf(s, p) / EPS0 },
    { key: "qint", label: "Carga interna q_int", unit: "nC", value: (s, p) => qIntOf(s, p) / NC },
    { key: "dif", label: "Diferença Φ − q_int/ε₀", unit: "N·m²/C", value: (s, p) => fluxOf(s, p) - qIntOf(s, p) / EPS0 },
    { key: "a", label: "Raio (ou meia-largura) da superfície", unit: "m", value: (s) => s.surf.a },
    { key: "dc", label: "Distância do centro da superfície à fonte", unit: "m", value: (s, p) => (caso(p) === 0 ? Math.hypot(s.charges[0]!.x - s.surf.cx, s.charges[0]!.y - s.surf.cy) : Math.hypot(s.src.x - s.surf.cx, caso(p) === 2 ? 0 : s.src.y - s.surf.cy)) },
  ],
  chart: { x: "a", y: "Phi" },

  scenarios: [
    {
      id: "pontuais",
      label: "Cargas pontuais",
      params: { caso: 0, forma: 0, q1: 2, q2: -1, q3: 0, N: 24 },
      guide: `### O fluxo só "vê" a carga de dentro
1. A superfície envolve apenas $q_1$. Compare $\\Phi$ (soma dos elementos) com $q_1/\\varepsilon_0$.
2. Arraste $q_1$ para perto da borda, ainda dentro. As setas de um lado crescem e as do outro encolhem, mas a soma não muda.
3. Arraste $q_2$ para dentro: o fluxo cai para $(q_1+q_2)/\\varepsilon_0$. Agora deixe $q_2$ fora, mas bem perto: há setas entrando (azuis) e saindo (vermelhas) que se cancelam.
4. Diminua o número de elementos e veja a soma numérica errar quando uma carga está muito perto da borda.`,
      predict: [
        {
          question: "Com a carga q₁ dentro da superfície, você a arrasta do centro para perto da borda (sem sair). O fluxo total:",
          options: ["aumenta, porque o campo na borda fica mais forte", "diminui, porque a carga fica descentralizada", "não muda"],
          answer: 2,
          explanation:
            "Pela Lei de Gauss, $\\Phi = q_\\text{int}/\\varepsilon_0$ não depende da posição da carga dentro da superfície. O campo cresce perto da carga, mas a região da borda próxima é pequena; o efeito se cancela exatamente na soma.",
        },
      ],
    },
    {
      id: "fio",
      label: "Fio infinito e cilindro",
      params: { caso: 1, forma: 0, lambda: 5, N: 24 },
      guide: `### Simetria cilíndrica
1. O círculo é o corte de um cilindro de comprimento $L = 1$ m coaxial ao fio. Nas tampas $\\vec E \\perp \\hat n$, então só a lateral contribui.
2. Com o fio no centro, todas as setas são iguais: $E\\,(2\\pi r L) = \\lambda L/\\varepsilon_0$, logo $E = \\lambda/(2\\pi\\varepsilon_0 r)$.
3. Mude o raio arrastando a alça: o fluxo não muda. O gráfico $\\Phi \\times a$ fica plano.
4. Troque para o retângulo (caixa): as setas deixam de ser iguais, mas a soma continua $\\lambda L/\\varepsilon_0$. A caixa vale, só não ajuda a calcular $E$.`,
    },
    {
      id: "plano",
      label: "Plano infinito e caixa",
      params: { caso: 2, forma: 1, sigma: 5, N: 24 },
      guide: `### A caixinha de Gauss
1. O plano é perpendicular à tela (a linha vertical). A caixa atravessa o plano: só as faces paralelas ao plano têm fluxo.
2. Cada uma dessas faces tem $E = \\sigma/(2\\varepsilon_0)$ saindo, então $2EA = \\sigma A/\\varepsilon_0$.
3. Afaste a caixa do plano: o campo continua o mesmo dos dois lados, mas entra por uma face e sai pela outra. Fluxo zero.
4. Com o círculo, a carga interna é $\\sigma$ vezes a corda cortada pelo plano. Confira.`,
      predict: [
        {
          question: "Você dobra a distância entre as faces da caixa e o plano (caixa mais larga, mesma altura). O fluxo:",
          options: ["dobra", "cai pela metade", "não muda"],
          answer: 2,
          explanation: "O campo de um plano infinito não depende da distância, e a área das faces paralelas ao plano é a mesma. A carga interna também não mudou.",
        },
      ],
    },
    {
      id: "esfera",
      label: "Esfera carregada: dentro e fora",
      params: { caso: 3, forma: 0, Qe: 5, R0: 0.35, a0: 0.2, N: 24 },
      guide: `### Campo dentro de uma esfera isolante
1. A superfície gaussiana (esfera concêntrica, raio $r$) começa dentro da esfera carregada. A carga interna é $Q\\,r^3/R^3$.
2. Arraste a alça devagar até sair da esfera e observe no gráfico $\\Phi \\times a$: cresce como $r^3$ e depois fica constante em $Q/\\varepsilon_0$.
3. Deduza $E(r)$: dentro, $E\\,4\\pi r^2 = Q r^3/(\\varepsilon_0 R^3)$, logo $E \\propto r$; fora, $E \\propto 1/r^2$.
4. Desloque a superfície para que corte só parte da esfera. A carga interna agora é o volume da interseção vezes $\\rho$, e a soma numérica continua concordando.`,
    },
  ],

  exercises: [
    {
      id: "cubo",
      prompt: "Uma carga pontual de {q} nC está no centro de um cubo. Qual é o fluxo elétrico através de UMA das faces do cubo?",
      vary: { q: [1, 20, 1] },
      answer: { label: "Φ_face", unit: "N·m²/C", compute: (p) => (num(p, "q") * NC) / (6 * EPS0) },
      hint: "Por simetria, o fluxo total q/ε₀ se divide igualmente entre as seis faces.",
    },
    {
      id: "esfera-dentro",
      prompt:
        "Uma esfera isolante de raio {R} cm tem carga {Q} nC distribuída uniformemente no volume. Qual é o módulo do campo elétrico a {r} cm do centro?",
      vary: { R: [10, 30, 0], Q: [1, 20, 1], r: [2, 9, 1] },
      answer: {
        label: "E",
        unit: "N/C",
        compute: (p) => (num(p, "Q") * NC * (num(p, "r") / 100)) / (4 * Math.PI * EPS0 * (num(p, "R") / 100) ** 3),
      },
      hint: "Como r < R, use uma superfície gaussiana esférica de raio r: a carga interna é Q r³/R³.",
    },
  ],

  init(p) {
    const a = num(p, "a0", 0.45);
    const c = caso(p);
    return {
      charges: [
        { x: -0.2, y: 0.1 },
        { x: 0.75, y: -0.2 },
        { x: -0.75, y: -0.45 },
      ],
      src: { x: c === 2 ? 0 : c === 1 ? 0.1 : 0, y: c === 1 ? 0.05 : 0 },
      surf: { cx: c === 0 ? -0.15 : 0, cy: c === 0 ? 0.05 : 0, a, b: c === 2 ? 0.3 : a * 0.75 },
      drag: null,
    };
  },
  static: true,
  step: (s) => s,
  sampleEvery: 1000,
  maxSamples: 4000,

  pointer: {
    down(s, p, pt) {
      const d = hitTest(s, p, pt.x, pt.y);
      return d ? { ...s, drag: d } : undefined;
    },
    move: (s, p, pt, dragging) => (dragging ? applyDrag(s, p, pt.x, pt.y) : undefined),
    up: (s) => (s.drag ? { ...s, drag: null } : undefined),
    cursor(s, p, pt) {
      const d = hitTest(s, p, pt.x, pt.y);
      if (!d) return undefined;
      return d.kind === "tam" ? "nwse-resize" : "grab";
    },
  },
  actions: [
    {
      id: "centralizar",
      label: "Centralizar superfície na fonte",
      run: (s, p) => {
        const c = caso(p);
        const t = c === 0 ? s.charges[0]! : s.src;
        return { ...s, surf: { ...s.surf, cx: t.x, cy: c === 2 ? s.surf.cy : t.y } };
      },
    },
  ],

  viewport: () => ({ ...VP, unit: "m" }),

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const { state: s, params: p, theme } = frame;
    const src = sourceOf(s, p);
    const surf = surfaceOf(s, p);
    const c = caso(p);

    d.grid(VP.xMin, VP.xMax, VP.yMin, VP.yMax, 0.2);

    // Campo de fundo: setas fracas com comprimento logarítmico.
    for (let x = VP.xMin + 0.1; x < VP.xMax; x += 0.2) {
      for (let y = VP.yMin + 0.1; y < VP.yMax; y += 0.2) {
        const [ex, ey] = field(src, x, y);
        const m = Math.hypot(ex, ey);
        if (m < 1e-9) continue;
        const len = clamp(6 + 4 * Math.log10(1 + m), 4, 18);
        d.arrowPx(x - (ex / m) * len * 0.5 * d.px, y - (ey / m) * len * 0.5 * d.px, ex, ey, len, { color: theme.muted, width: 1, head: 5, alpha: 0.45 });
      }
    }

    // Fontes
    if (src.kind === "pontos") {
      src.charges.forEach((q, i) => {
        if (q.q === 0) return;
        const col = q.q > 0 ? theme.positive : theme.negative;
        d.dot(q.x, q.y, 9, col);
        d.text(q.q > 0 ? "+" : "−", q.x, q.y, { color: "#fff", size: 13, weight: "700" });
        d.text(`q${"₁₂₃"[i]} = ${fmt(q.q / NC)} nC`, q.x, q.y, { dy: -16, size: 11, color: col });
      });
    } else if (src.kind === "fio") {
      const col = src.lambda >= 0 ? theme.positive : theme.negative;
      d.circle(src.x, src.y, 0, { minPx: 7, fill: col });
      d.circle(src.x, src.y, 0, { minPx: 11, stroke: col, width: 1.5 });
      d.text(`fio ⊙  λ = ${fmt(src.lambda / NC)} nC/m`, src.x, src.y, { dy: -18, size: 11, color: col });
    } else if (src.kind === "plano") {
      const col = src.sigma >= 0 ? theme.positive : theme.negative;
      d.rect(src.x - 0.012, VP.yMin, 0.024, VP.yMax - VP.yMin, { fill: col, alpha: 0.75 });
      for (let y = VP.yMin + 0.1; y < VP.yMax; y += 0.2) d.text(src.sigma >= 0 ? "+" : "−", src.x, y, { color: "#fff", size: 10, weight: "700" });
      d.text(`plano  σ = ${fmt(src.sigma / NC)} nC/m²`, src.x, VP.yMin + 0.25, src.x > 0.4 ? { dx: -8, align: "right", size: 11, color: col } : { dx: 8, align: "left", size: 11, color: col });
    } else {
      const col = src.Q >= 0 ? theme.positive : theme.negative;
      d.circle(src.x, src.y, src.R, { fill: col, alpha: 0.18 });
      d.circle(src.x, src.y, src.R, { stroke: col, width: 1.5 });
      d.text(`Q = ${fmt(src.Q / NC)} nC, R = ${fmt(src.R)} m`, src.x, src.y - src.R, { dy: 12, size: 11, color: col });
    }

    // Superfície gaussiana
    if (surf.shape === 0) {
      d.circle(surf.cx, surf.cy, surf.a, { fill: theme.accent, alpha: 0.07 });
      d.circle(surf.cx, surf.cy, surf.a, { stroke: theme.accent, width: 2, dash: [7, 4] });
    } else {
      d.rect(surf.cx - surf.a, surf.cy - surf.b, 2 * surf.a, 2 * surf.b, { fill: theme.accent, alpha: 0.07 });
      d.rect(surf.cx - surf.a, surf.cy - surf.b, 2 * surf.a, 2 * surf.b, { stroke: theme.accent, width: 2, dash: [7, 4] });
    }
    // Plano: destaca o pedaço de carga envolvido.
    if (src.kind === "plano" && Math.abs(src.x - surf.cx) < surf.a) {
      const dx = src.x - surf.cx;
      const h = surf.shape === 0 ? Math.sqrt(surf.a ** 2 - dx * dx) : surf.b;
      d.line(src.x, surf.cy - h, src.x, surf.cy + h, { color: theme.text, width: 4, alpha: 0.6 });
    }

    // Elementos e E·n̂ em cada um
    const elems = contourElements(surf, nElem(p));
    const flux = elems.map((e) => {
      const [ex, ey] = field(src, e.x, e.y);
      return ex * e.nx + ey * e.ny;
    });
    const maxF = Math.max(1e-12, ...flux.map(Math.abs));
    elems.forEach((e, i) => {
      const f = flux[i]!;
      // Marca a divisão entre elementos
      const tx = -e.ny;
      const ty = e.nx;
      const h = (e.dl / 2) * 0.98;
      d.line(e.x - tx * h, e.y - ty * h, e.x - tx * h + e.nx * 4 * d.px, e.y - ty * h + e.ny * 4 * d.px, { color: theme.accent, width: 1 });
      const len = (Math.abs(f) / maxF) * 42;
      if (len < 1.5) return;
      const sg = Math.sign(f);
      const col = sg > 0 ? theme.positive : theme.negative;
      // Saindo: seta para fora a partir da borda. Entrando: seta chega à borda vinda de fora.
      if (sg > 0) d.arrowPx(e.x, e.y, e.nx, e.ny, len, { color: col, width: 2, head: 7 });
      else d.arrowPx(e.x + e.nx * len * d.px, e.y + e.ny * len * d.px, -e.nx, -e.ny, len, { color: col, width: 2, head: 7 });
    });

    // Alça de redimensionamento
    const [hx, hy] = handle(s, p);
    d.rect(hx - 5 * d.px, hy - 5 * d.px, 10 * d.px, 10 * d.px, { fill: theme.accent });

    // Painel de resultados
    const phi = fluxOf(s, p);
    const q = qIntOf(s, p);
    const phiT = q / EPS0;
    const ref = Math.max(Math.abs(phiT), Math.abs(phi), 1e-9);
    const err = (Math.abs(phi - phiT) / ref) * 100;
    const x0 = VP.xMin + 0.04;
    let y0 = VP.yMax - 0.06;
    const panel = theme.dark ? "rgba(15, 20, 27, 0.82)" : "rgba(255, 255, 255, 0.82)";
    d.rect(VP.xMin + 0.01, VP.yMax - 0.33, 1.42, 0.32, { fill: panel });
    d.rect(VP.xMax - 1.3, VP.yMin + 0.01, 1.29, 0.155, { fill: panel });
    const line = (str: string, col = theme.text, w = "400") => {
      d.text(str, x0, y0, { align: "left", size: 12, color: col, weight: w });
      y0 -= 0.075;
    };
    line(`Superfície: ${SURF_NAME(src, surf.shape)}`, theme.muted);
    line(`Φ (soma dos elementos) = ${fmt(phi)} N·m²/C`, theme.text, "600");
    line(`q_int/ε₀ = ${fmt(phiT)} N·m²/C   (q_int = ${fmt(q / NC)} nC)`, theme.text, "600");
    line(Math.abs(phiT) < 1e-9 && Math.abs(phi) < 1e-6 * Math.max(1, maxF) ? "concordam (fluxo nulo)" : `diferença relativa: ${fmt(err, 2)} %`, err < 1 ? theme.series[2]! : theme.muted);

    d.text("seta vermelha: E·n̂ > 0 (sai)   seta azul: E·n̂ < 0 (entra)", VP.xMax - 0.04, VP.yMin + 0.05, {
      align: "right",
      size: 11,
      color: theme.muted,
    });
    d.text(
      c === 0 ? "arraste as cargas, a superfície ou a alça" : c === 2 ? "arraste o plano, a superfície ou a alça" : "arraste a fonte, a superfície ou a alça",
      VP.xMax - 0.04,
      VP.yMin + 0.12,
      { align: "right", size: 11, color: theme.muted },
    );
  },
});

export default gauss;
