import {
  add3,
  clamp,
  cross3,
  defineSim,
  deg,
  dot3,
  draw,
  norm3,
  num,
  rad,
  scale3,
  sub3,
  texNum,
  type Draw,
  type Params,
  type V3,
} from "@fisilab/core";

/** Limite das componentes de A e B. */
export const COMP_MAX = 6;
/** Meia-largura (em unidades de cena) que os eixos ocupam no palco. */
const AXIS = 8;
/** Período da animação da regra da mão direita, em segundos. */
const PERIOD = 2.5;

export interface Drag {
  kind: "A" | "B" | "cam";
  x0: number;
  y0: number;
  v0: V3;
  yaw0: number;
  pitch0: number;
  k: number;
}

export interface Vec3State {
  A: V3;
  B: V3;
  /** Azimute da câmera em torno de z (rad). */
  yaw: number;
  /** Elevação da câmera acima do plano xy (rad). */
  pitch: number;
  drag: Drag | null;
}

export interface Basis {
  /** Direção da tela para a direita. */
  r: V3;
  /** Direção da tela para cima. */
  u: V3;
  /** Direção que aponta para o observador. */
  f: V3;
}

/** Base ortonormal da câmera (projeção ortográfica). r × u = f: o sistema da tela é dextrógiro. */
export function cameraBasis(yaw: number, pitch: number): Basis {
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  return {
    r: [-sy, cy, 0],
    u: [-sp * cy, -sp * sy, cp],
    f: [cp * cy, cp * sy, sp],
  };
}

/** Projeta um ponto 3D (já na escala da cena) no plano da tela. */
export function project(p: V3, b: Basis): [number, number] {
  return [dot3(p, b.r), dot3(p, b.u)];
}

export const modeOf = (p: Params) => Math.round(num(p, "modo"));

export function angleAB(A: V3, B: V3): number {
  const na = norm3(A), nb = norm3(B);
  if (na < 1e-12 || nb < 1e-12) return 0;
  return Math.acos(clamp(dot3(A, B) / (na * nb), -1, 1));
}

/** Fator de redução com que A×B é desenhado para caber junto de A e B. */
export function crossDrawFactor(A: V3, B: V3): number {
  const n = norm3(cross3(A, B));
  const ref = 1.2 * Math.max(norm3(A), norm3(B), 1);
  return n > ref ? ref / n : 1;
}

/** Escala da cena: tudo o que é desenhado cabe dentro de |p| ≤ AXIS. */
export function sceneScale(s: Vec3State, p: Params): number {
  const m = modeOf(p);
  let L = Math.max(norm3(s.A), norm3(s.B), 1);
  if (m === 0) L = Math.max(L, norm3(add3(s.A, s.B)));
  if (m === 3) L = Math.max(L, norm3(cross3(s.A, s.B)) * crossDrawFactor(s.A, s.B));
  return Math.min(1, (AXIS - 0.8) / L);
}

/** Câmera olhando ao longo de n (n aponta para o observador). */
export function lookAlong(n: V3): { yaw: number; pitch: number } {
  const L = norm3(n);
  if (L < 1e-12) return { yaw: rad(35), pitch: rad(25) };
  return { yaw: Math.atan2(n[1], n[0]), pitch: Math.asin(clamp(n[2] / L, -1, 1)) };
}

const round1 = (v: number) => Math.round(v * 10) / 10;
const clampV = (v: V3): V3 => [
  clamp(round1(v[0]), -COMP_MAX, COMP_MAX),
  clamp(round1(v[1]), -COMP_MAX, COMP_MAX),
  clamp(round1(v[2]), -COMP_MAX, COMP_MAX),
];

const fmt = (v: number) => (Math.abs(v) < 0.005 ? "0" : String(Number(v.toFixed(2))).replace(".", ","));
const fmtV = (v: V3) => `(${fmt(v[0])}; ${fmt(v[1])}; ${fmt(v[2])})`;
const texV = (v: V3) => String.raw`(${texNum(round2(v[0]))};\ ${texNum(round2(v[1]))};\ ${texNum(round2(v[2]))})`;
const round2 = (v: number) => (Math.abs(v) < 0.005 ? 0 : Math.round(v * 100) / 100);

function pick(s: Vec3State, p: Params, pt: { x: number; y: number }): "A" | "B" | null {
  const b = cameraBasis(s.yaw, s.pitch);
  const k = sceneScale(s, p);
  const tol = 0.7;
  const [ax, ay] = project(scale3(s.A, k), b);
  const [bx, by] = project(scale3(s.B, k), b);
  const da = Math.hypot(pt.x - ax, pt.y - ay);
  const db = Math.hypot(pt.x - bx, pt.y - by);
  if (da > tol && db > tol) return null;
  return da <= db ? "A" : "B";
}

/** Uma seta 3D: projeta e desenha. */
function arrow3(d: Draw, b: Basis, from: V3, to: V3, color: string, width = 2.5, dash?: number[], alpha = 1) {
  const [x0, y0] = project(from, b);
  const [x1, y1] = project(to, b);
  d.arrow(x0, y0, x1 - x0, y1 - y0, { color, width, dash, alpha, head: 11 });
}

function line3(d: Draw, b: Basis, from: V3, to: V3, color: string, width = 1.2, dash?: number[], alpha = 1) {
  const [x0, y0] = project(from, b);
  const [x1, y1] = project(to, b);
  d.line(x0, y0, x1, y1, { color, width, dash, alpha });
}

function label3(d: Draw, b: Basis, at: V3, str: string, color: string, size = 13, dx = 0, dy = -10) {
  const [x, y] = project(at, b);
  d.text(str, x, y, { color, size, weight: "600", dx, dy });
}

/** Arco no plano gerado pelos unitários e1, e2 (ortonormais), de 0 até phi. */
function arc3(e1: V3, e2: V3, center: V3, radius: number, phi: number, n = 40): V3[] {
  const pts: V3[] = [];
  for (let i = 0; i <= n; i++) {
    const a = (phi * i) / n;
    pts.push(add3(center, add3(scale3(e1, radius * Math.cos(a)), scale3(e2, radius * Math.sin(a)))));
  }
  return pts;
}

function poly3(d: Draw, b: Basis, pts: V3[], color: string, width = 1.5, arrowEnd = false, dash?: number[], alpha = 1) {
  const p2 = pts.map((p) => project(p, b));
  d.polyline(p2, { color, width, dash, alpha });
  if (arrowEnd && p2.length >= 3) {
    const a = p2[p2.length - 3]!;
    const z = p2[p2.length - 1]!;
    d.arrow(a[0], a[1], z[0] - a[0], z[1] - a[1], { color, width, alpha, head: 9 });
  }
}

const ease = (x: number) => x * x * (3 - 2 * x);

export const vetores3d = defineSim<Vec3State>({
  id: "vetores-3d",
  title: "Vetores em 3D",
  course: "FG I",
  topic: "Vetores",
  priority: "P1",
  summary:
    "Gire a cena e arraste as pontas de dois vetores no espaço para ver a soma pela regra do paralelogramo, as componentes cartesianas, o produto escalar como projeção e o produto vetorial com a regra da mão direita animada.",
  equations: [
    String.raw`\vec A = A_x\,\hat\imath + A_y\,\hat\jmath + A_z\,\hat k \qquad |\vec A| = \sqrt{A_x^2 + A_y^2 + A_z^2}`,
    String.raw`\vec A + \vec B = (A_x + B_x)\,\hat\imath + (A_y + B_y)\,\hat\jmath + (A_z + B_z)\,\hat k`,
    String.raw`\vec A \cdot \vec B = A_xB_x + A_yB_y + A_zB_z = |\vec A|\,|\vec B|\cos\theta`,
    String.raw`\vec A \times \vec B = \begin{vmatrix} \hat\imath & \hat\jmath & \hat k \\ A_x & A_y & A_z \\ B_x & B_y & B_z \end{vmatrix} \qquad |\vec A \times \vec B| = |\vec A|\,|\vec B|\sin\theta`,
  ],
  liveEquations(s, p) {
    const { A, B } = s;
    const m = modeOf(p);
    const th = deg(angleAB(A, B));
    if (m === 0)
      return [String.raw`\vec A + \vec B = ${texV(add3(A, B))} \qquad |\vec A + \vec B| = ${texNum(norm3(add3(A, B)))}`];
    if (m === 1)
      return [
        String.raw`\vec A = ${texNum(round2(A[0]))}\,\hat\imath + ${texNum(round2(A[1]))}\,\hat\jmath + ${texNum(round2(A[2]))}\,\hat k \qquad |\vec A| = ${texNum(norm3(A))}`,
        String.raw`\cos\alpha = \frac{A_x}{|\vec A|} = ${texNum(norm3(A) > 0 ? A[0] / norm3(A) : 0)} \qquad \cos\beta = ${texNum(norm3(A) > 0 ? A[1] / norm3(A) : 0)} \qquad \cos\gamma = ${texNum(norm3(A) > 0 ? A[2] / norm3(A) : 0)}`,
      ];
    if (m === 2)
      return [
        String.raw`\vec A \cdot \vec B = ${texNum(dot3(A, B))} = ${texNum(norm3(A))} \cdot ${texNum(norm3(B))} \cdot \cos(${texNum(th)}^\circ)`,
        String.raw`A_{\parallel B} = |\vec A|\cos\theta = ${texNum(norm3(B) > 0 ? dot3(A, B) / norm3(B) : 0)}`,
      ];
    const n = cross3(A, B);
    return [
      String.raw`\vec A \times \vec B = ${texV(n)} \qquad |\vec A \times \vec B| = ${texNum(norm3(n))} = ${texNum(norm3(A))} \cdot ${texNum(norm3(B))} \cdot \sin(${texNum(th)}^\circ)`,
    ];
  },

  params: [
    {
      key: "modo",
      label: "Operação",
      unit: "",
      min: 0,
      max: 3,
      step: 1,
      default: 0,
      live: true,
      options: [
        { value: 0, label: "Soma (paralelogramo)" },
        { value: 1, label: "Decomposição em componentes" },
        { value: 2, label: "Produto escalar (projeção)" },
        { value: 3, label: "Produto vetorial (mão direita)" },
      ],
    },
    { key: "Ax", label: "A_x", unit: "", min: -COMP_MAX, max: COMP_MAX, step: 0.5, default: 4 },
    { key: "Ay", label: "A_y", unit: "", min: -COMP_MAX, max: COMP_MAX, step: 0.5, default: 1 },
    { key: "Az", label: "A_z", unit: "", min: -COMP_MAX, max: COMP_MAX, step: 0.5, default: 0 },
    { key: "Bx", label: "B_x", unit: "", min: -COMP_MAX, max: COMP_MAX, step: 0.5, default: 1 },
    { key: "By", label: "B_y", unit: "", min: -COMP_MAX, max: COMP_MAX, step: 0.5, default: 3 },
    { key: "Bz", label: "B_z", unit: "", min: -COMP_MAX, max: COMP_MAX, step: 0.5, default: 1 },
    {
      key: "giro",
      label: "Câmera",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 0,
      live: true,
      options: [
        { value: 0, label: "Parada (arraste para girar)" },
        { value: 1, label: "Girando sozinha" },
      ],
    },
  ],

  observables: [
    { key: "modA", label: "|A|", unit: "", value: (s) => norm3(s.A) },
    { key: "modB", label: "|B|", unit: "", value: (s) => norm3(s.B) },
    { key: "theta", label: "Ângulo θ entre A e B", unit: "°", value: (s) => deg(angleAB(s.A, s.B)) },
    { key: "soma", label: "|A + B|", unit: "", value: (s) => norm3(add3(s.A, s.B)) },
    { key: "escalar", label: "A · B", unit: "", value: (s) => dot3(s.A, s.B) },
    { key: "projAB", label: "Projeção de A sobre B", unit: "", value: (s) => (norm3(s.B) > 0 ? dot3(s.A, s.B) / norm3(s.B) : 0) },
    { key: "Cx", label: "(A × B)_x", unit: "", value: (s) => cross3(s.A, s.B)[0] },
    { key: "Cy", label: "(A × B)_y", unit: "", value: (s) => cross3(s.A, s.B)[1] },
    { key: "Cz", label: "(A × B)_z", unit: "", value: (s) => cross3(s.A, s.B)[2] },
    { key: "vetorial", label: "|A × B| (área do paralelogramo)", unit: "", value: (s) => norm3(cross3(s.A, s.B)) },
  ],
  chart: { x: "t", y: "theta" },

  scenarios: [
    {
      id: "soma",
      label: "Soma de vetores",
      params: { modo: 0, Ax: 4, Ay: 1, Az: 0, Bx: 1, By: 3, Bz: 2 },
      guide: `### Regra do paralelogramo
1. Arraste no palco (longe das pontas) para girar a cena e ver os vetores de vários ângulos.
2. Arraste a **ponta** de $\\vec A$ ou de $\\vec B$: ela se move no plano da tela.
3. Confira que $\\vec A + \\vec B$ é a diagonal do paralelogramo e que a soma é feita componente a componente.
4. Ache uma configuração com $|\\vec A + \\vec B| = |\\vec A| + |\\vec B|$ e outra com $|\\vec A + \\vec B| = \\big||\\vec A| - |\\vec B|\\big|$.`,
      predict: [
        {
          question: "Com |A| = 4 e |B| = 3, quais valores |A + B| pode assumir?",
          options: ["Sempre 7", "Qualquer valor entre 1 e 7", "Sempre 5", "Qualquer valor entre 0 e 12"],
          answer: 1,
          explanation:
            "Pela desigualdade triangular, $\\big||\\vec A| - |\\vec B|\\big| \\le |\\vec A + \\vec B| \\le |\\vec A| + |\\vec B|$. O valor 5 só ocorre se os vetores forem perpendiculares.",
        },
      ],
    },
    {
      id: "componentes",
      label: "Componentes e cossenos diretores",
      params: { modo: 1, Ax: 3, Ay: 4, Az: 5, Bx: -2, By: 1, Bz: 1 },
      guide: `### Decomposição
1. O caminho tracejado vai da origem até a ponta de $\\vec A$ andando $A_x$ em $x$, $A_y$ em $y$ e $A_z$ em $z$.
2. Gire a câmera até olhar de cima (eixo $z$ apontando para você): o que sobra é a projeção no plano $xy$.
3. Verifique que $|\\vec A|^2 = A_x^2 + A_y^2 + A_z^2$ e que $\\cos^2\\alpha + \\cos^2\\beta + \\cos^2\\gamma = 1$.`,
    },
    {
      id: "escalar",
      label: "Produto escalar como projeção",
      params: { modo: 2, Ax: 4, Ay: 2, Az: 1, Bx: 1, By: -3, Bz: 2 },
      guide: `### Projeção de A sobre B
1. O segmento destacado sobre a reta de $\\vec B$ tem comprimento $|\\vec A|\\cos\\theta$.
2. Arraste $\\vec A$ até o produto escalar ficar negativo: para onde vai a projeção?
3. O cenário começa com $\\vec A \\cdot \\vec B = 0$. Arraste a ponta de $\\vec A$ e observe quando o produto escalar fica positivo e quando fica negativo.`,
      predict: [
        {
          question: "A = (4; 2; 1) e B = (1; −3; 2). O ângulo entre eles é:",
          options: ["menor que 90°", "exatamente 90°", "maior que 90°"],
          answer: 1,
          explanation:
            "$\\vec A \\cdot \\vec B = 4\\cdot 1 + 2\\cdot(-3) + 1\\cdot 2 = 0$. Produto escalar nulo com vetores não nulos significa $\\cos\\theta = 0$: os vetores são perpendiculares e a projeção de um sobre o outro é zero.",
        },
      ],
    },
    {
      id: "vetorial",
      label: "Produto vetorial e mão direita",
      params: { modo: 3, Ax: 4, Ay: 0, Az: 0, Bx: 1, By: 3, Bz: 0 },
      guide: `### Regra da mão direita
1. Rode a animação: os dedos curvam de $\\vec A$ para $\\vec B$ pelo menor ângulo e o polegar aponta no sentido de $\\vec A \\times \\vec B$.
2. Clique em **Olhar ao longo de A×B**: vista de cima, a rotação de $\\vec A$ para $\\vec B$ é anti-horária.
3. Clique em **Trocar A e B**: o produto vetorial inverte ($\\vec B \\times \\vec A = -\\vec A \\times \\vec B$), mas a área do paralelogramo não muda.
4. Faça $\\vec B$ paralelo a $\\vec A$. O que acontece com $\\vec A \\times \\vec B$?`,
      predict: [
        {
          question: "A aponta em +x e B no plano xy, com componente +y. Para onde aponta A × B?",
          options: ["+z", "−z", "+y", "Fica no plano xy"],
          answer: 0,
          explanation:
            "$\\hat\\imath \\times \\hat\\jmath = \\hat k$. A componente de $\\vec B$ paralela a $\\vec A$ não contribui; os dedos curvam de $x$ para $y$ e o polegar aponta em $+z$.",
        },
      ],
    },
  ],

  exercises: [
    {
      id: "angulo",
      prompt: "Dados A = ({Ax}; {Ay}; {Az}) e B = ({Bx}; {By}; {Bz}), calcule o ângulo entre A e B, em graus.",
      vary: { Ax: [-5, 5, 0], Ay: [1, 5, 0], Az: [-4, 4, 0], Bx: [1, 5, 0], By: [-5, 5, 0], Bz: [-4, 4, 0] },
      fixed: { modo: 2 },
      answer: {
        label: "θ",
        unit: "°",
        compute: (p) => deg(angleAB([num(p, "Ax"), num(p, "Ay"), num(p, "Az")], [num(p, "Bx"), num(p, "By"), num(p, "Bz")])),
      },
      hint: "cos θ = (A · B) / (|A| |B|), com A · B = AxBx + AyBy + AzBz.",
    },
    {
      id: "area",
      prompt: "Qual é a área do paralelogramo formado por A = ({Ax}; {Ay}; {Az}) e B = ({Bx}; {By}; {Bz})?",
      vary: { Ax: [1, 5, 0], Ay: [-4, 4, 0], Az: [-3, 3, 0], Bx: [-4, 4, 0], By: [1, 5, 0], Bz: [-3, 3, 0] },
      fixed: { modo: 3 },
      answer: {
        label: "área",
        unit: "",
        compute: (p) => norm3(cross3([num(p, "Ax"), num(p, "Ay"), num(p, "Az")], [num(p, "Bx"), num(p, "By"), num(p, "Bz")])),
      },
      hint: "A área é |A × B|. Calcule as três componentes pelo determinante e depois o módulo.",
    },
  ],

  init: (p) => ({
    A: [num(p, "Ax", 4), num(p, "Ay", 1), num(p, "Az")],
    B: [num(p, "Bx", 1), num(p, "By", 3), num(p, "Bz", 1)],
    yaw: rad(35),
    pitch: rad(22),
    drag: null,
  }),
  // O tempo só anima a regra da mão direita e o giro automático da câmera.
  step(s, p, _t, dt) {
    if (num(p, "giro") >= 0.5 && !s.drag) return { ...s, yaw: s.yaw + 0.35 * dt };
    return s;
  },
  dt: 1 / 60,
  sampleEvery: 6,
  maxSamples: 4000,
  tEnd: 120,

  pointer: {
    down(s, p, pt) {
      const which = pick(s, p, pt);
      const k = sceneScale(s, p);
      if (which) return { ...s, drag: { kind: which, x0: pt.x, y0: pt.y, v0: which === "A" ? s.A : s.B, yaw0: s.yaw, pitch0: s.pitch, k } };
      return { ...s, drag: { kind: "cam", x0: pt.x, y0: pt.y, v0: [0, 0, 0], yaw0: s.yaw, pitch0: s.pitch, k } };
    },
    move(s, _p, pt, dragging) {
      const g = s.drag;
      if (!dragging || !g) return undefined;
      const dx = pt.x - g.x0, dy = pt.y - g.y0;
      if (g.kind === "cam") {
        return { ...s, yaw: g.yaw0 - dx * 0.18, pitch: clamp(g.pitch0 - dy * 0.18, rad(-85), rad(85)) };
      }
      const b = cameraBasis(s.yaw, s.pitch);
      const delta = scale3(add3(scale3(b.r, dx), scale3(b.u, dy)), 1 / g.k);
      const v = clampV(add3(g.v0, delta));
      return g.kind === "A" ? { ...s, A: v } : { ...s, B: v };
    },
    up: (s) => (s.drag ? { ...s, drag: null } : undefined),
    cursor: (s, p, pt) => (pick(s, p, pt) ? "grab" : "move"),
  },

  actions: [
    { id: "trocar", label: "Trocar A e B", run: (s) => ({ ...s, A: s.B, B: s.A }) },
    { id: "iso", label: "Vista em perspectiva", run: (s) => ({ ...s, yaw: rad(35), pitch: rad(22) }) },
    { id: "cima", label: "Vista de cima (plano xy)", run: (s) => ({ ...s, yaw: 0, pitch: rad(89.9) }) },
    {
      id: "normal",
      label: "Olhar ao longo de A×B",
      run: (s) => {
        const c = lookAlong(cross3(s.A, s.B));
        return { ...s, yaw: c.yaw, pitch: clamp(c.pitch, rad(-89.9), rad(89.9)) };
      },
    },
  ],

  viewport: () => ({ xMin: -12, xMax: 12, yMin: -9, yMax: 9 }),

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const { state: s, params: p, theme, t } = frame;
    const b = cameraBasis(s.yaw, s.pitch);
    const m = modeOf(p);
    const k = sceneScale(s, p);
    const A = scale3(s.A, k);
    const B = scale3(s.B, k);
    const O: V3 = [0, 0, 0];
    const colA = theme.series[0]!;
    const colB = theme.series[1]!;
    const colR = theme.series[2]!;
    const colC = theme.series[4]!;

    // Piso (plano xy) e eixos
    const step = k >= 0.5 ? 2 * k : 4 * k;
    const nLines = Math.floor(AXIS / step);
    for (let i = -nLines; i <= nLines; i++) {
      line3(d, b, [i * step, -nLines * step, 0], [i * step, nLines * step, 0], theme.grid, 1);
      line3(d, b, [-nLines * step, i * step, 0], [nLines * step, i * step, 0], theme.grid, 1);
    }
    const axes: [V3, string][] = [
      [[1, 0, 0], "x"],
      [[0, 1, 0], "y"],
      [[0, 0, 1], "z"],
    ];
    for (const [e, name] of axes) {
      line3(d, b, scale3(e, -AXIS), O, theme.muted, 1, [4, 4], 0.7);
      arrow3(d, b, O, scale3(e, AXIS), theme.muted, 1.2);
      const [x, y] = project(scale3(e, AXIS + 0.6), b);
      d.text(name, x, y, { color: theme.muted, size: 13, weight: "600" });
      // marcas a cada unidade
      for (let i = 1; i * k <= AXIS - 0.5; i++) {
        if (k < 0.6 && i % 2) continue;
        const [tx, ty] = project(scale3(e, i * k), b);
        d.dot(tx, ty, 1.6, theme.muted, 0.8);
      }
    }

    const tipLabel = (v: V3, str: string, color: string) => {
      const L = norm3(v);
      const ext = L > 1e-9 ? scale3(v, 1 + 0.45 / L) : v;
      label3(d, b, ext, str, color, 14, 0, 0);
    };

    if (m === 0) {
      const S = add3(A, B);
      d.polyline([project(O, b), project(A, b), project(S, b), project(B, b)], { color: "none", fill: colR, alpha: 0.1, close: true });
      arrow3(d, b, A, S, colB, 1.5, [6, 4], 0.75);
      arrow3(d, b, B, S, colA, 1.5, [6, 4], 0.75);
      arrow3(d, b, O, S, colR, 3);
      tipLabel(S, "A + B", colR);
    }

    if (m === 1) {
      const comps = (V: V3, color: string, labels: boolean, alpha: number) => {
        const px: V3 = [V[0], 0, 0], pxy: V3 = [V[0], V[1], 0];
        line3(d, b, O, px, color, 1.4, [5, 4], alpha);
        line3(d, b, px, pxy, color, 1.4, [5, 4], alpha);
        line3(d, b, pxy, V, color, 1.4, [5, 4], alpha);
        line3(d, b, O, pxy, theme.muted, 1, [2, 3], alpha);
        // componentes sobre os próprios eixos
        const onAxes: [V3, string, number][] = [
          [[V[0], 0, 0], "x", 0],
          [[0, V[1], 0], "y", 1],
          [[0, 0, V[2]], "z", 2],
        ];
        for (const [c, name, i] of onAxes) {
          if (Math.abs(c[i]!) < 1e-9) continue;
          arrow3(d, b, O, c, color, 3, undefined, alpha);
          if (labels) label3(d, b, c, `A${name} = ${fmt(s.A[i]!)}`, color, 12, 0, 14);
        }
      };
      comps(B, colB, false, 0.35);
      comps(A, colA, true, 1);
      // unitários
      const lu = Math.max(k, 0.8);
      arrow3(d, b, O, [lu, 0, 0], theme.text, 2.5);
      arrow3(d, b, O, [0, lu, 0], theme.text, 2.5);
      arrow3(d, b, O, [0, 0, lu], theme.text, 2.5);
      label3(d, b, [lu, 0, 0], "î", theme.text, 13, 8, 10);
      label3(d, b, [0, lu, 0], "ĵ", theme.text, 13, 8, 10);
      label3(d, b, [0, 0, lu], "k̂", theme.text, 13, 10, 0);
    }

    const th = angleAB(s.A, s.B);
    const nA = norm3(s.A), nB = norm3(s.B);
    const uA: V3 = nA > 1e-9 ? scale3(s.A, 1 / nA) : [1, 0, 0];
    // e2: unitário no plano de A e B, perpendicular a A, do lado de B
    const Bperp = sub3(s.B, scale3(uA, dot3(s.B, uA)));
    const nP = norm3(Bperp);
    const e2: V3 | null = nP > 1e-9 ? scale3(Bperp, 1 / nP) : null;

    if (m === 2 && nB > 1e-9) {
      const uB = scale3(s.B, 1 / nB);
      const proj = dot3(A, uB);
      const F = scale3(uB, proj);
      // reta suporte de B
      line3(d, b, scale3(uB, -AXIS), scale3(uB, AXIS), colB, 1, [2, 4], 0.5);
      line3(d, b, A, F, theme.muted, 1.4, [5, 4]);
      const [fx, fy] = project(F, b);
      const [ox, oy] = project(O, b);
      d.line(ox, oy, fx, fy, { color: proj >= 0 ? theme.positive : theme.negative, width: 6, alpha: 0.6 });
      d.dot(fx, fy, 3.5, theme.text);
      label3(d, b, F, `|A| cos θ = ${fmt(proj / k)}`, proj >= 0 ? theme.positive : theme.negative, 12, 0, 16);
      if (e2) {
        const rho = Math.min(norm3(A), norm3(B)) * 0.3;
        poly3(d, b, arc3(uA, e2, O, rho, th), theme.text, 1.3);
        const mid = add3(scale3(uA, rho * 1.35 * Math.cos(th / 2)), scale3(e2, rho * 1.35 * Math.sin(th / 2)));
        label3(d, b, mid, "θ", theme.text, 13, 0, 0);
      }
    }

    if (m === 3) {
      const n = cross3(s.A, s.B);
      const nn = norm3(n);
      const S = add3(A, B);
      const para = [project(O, b), project(A, b), project(S, b), project(B, b)];
      d.polyline(para, { color: "none", alpha: 0.16, fill: colC, close: true });
      d.polyline(para, { color: colC, width: 1, alpha: 0.6, close: true });
      if (nn > 1e-9 && e2) {
        const c = crossDrawFactor(s.A, s.B);
        const N = scale3(n, c * k);
        const un = scale3(n, 1 / nn);
        const phase = t > 0 ? ease(Math.min(1, ((t % PERIOD) / PERIOD) * 1.25)) : 1;
        const rho = Math.min(norm3(A), norm3(B)) * 0.45;
        // varredura de A para B pelo menor ângulo
        poly3(d, b, arc3(uA, e2, O, rho, Math.max(0.02, th * phase)), theme.text, 2, true);
        const sweep = add3(scale3(uA, Math.cos(th * phase)), scale3(e2, Math.sin(th * phase)));
        arrow3(d, b, O, scale3(sweep, norm3(A)), colA, 1.5, [3, 3], 0.6);
        // "mão": dedos curvando em torno do polegar (eixo A×B)
        const LN = norm3(N);
        const rf = Math.max(0.5, Math.min(rho * 0.55, 1.4));
        for (let i = 0; i < 4; i++) {
          const center = scale3(un, LN * (0.12 + 0.1 * i));
          poly3(d, b, arc3(uA, e2, center, rf, Math.max(0.05, phase * 1.5 * Math.PI), 36), theme.series[3]!, 2.2, true, undefined, 0.85);
        }
        const [tx0, ty0] = project(O, b);
        const [tx1, ty1] = project(scale3(un, LN * 0.6 * phase), b);
        d.line(tx0, ty0, tx1, ty1, { color: theme.series[3]!, width: 9, alpha: 0.35 });
        label3(d, b, scale3(un, LN * 0.6 * phase), "polegar", theme.series[3]!, 11, 34, 0);
        arrow3(d, b, O, N, colC, 3.5);
        tipLabel(N, c < 1 ? `A × B (×${fmt(c)})` : "A × B", colC);
        const [cx, cy] = project(scale3(S, 0.5), b);
        d.text(`área = |A × B| = ${fmt(nn)}`, cx, cy, { color: colC, size: 12, weight: "600", dy: 14 });
      } else {
        d.text("A e B paralelos: A × B = 0 (área nula)", 0, -7.4, { color: colC, size: 13, weight: "600" });
      }
    }

    // A e B por cima de tudo
    arrow3(d, b, O, A, colA, 3);
    arrow3(d, b, O, B, colB, 3);
    tipLabel(A, "A", colA);
    tipLabel(B, "B", colB);
    const [pax, pay] = project(A, b);
    const [pbx, pby] = project(B, b);
    d.circle(pax, pay, 0, { minPx: 6, stroke: colA, width: 1.5 });
    d.circle(pbx, pby, 0, { minPx: 6, stroke: colB, width: 1.5 });
    d.dot(0, 0, 3, theme.text);

    // Legenda
    const names = ["Soma", "Componentes", "Produto escalar", "Produto vetorial"];
    d.text(names[m] ?? "", -11.6, 8.3, { align: "left", size: 14, weight: "700", color: theme.text });
    d.text(`A = ${fmtV(s.A)}`, -11.6, 7.5, { align: "left", size: 12, color: colA, weight: "600" });
    d.text(`B = ${fmtV(s.B)}`, -11.6, 6.8, { align: "left", size: 12, color: colB, weight: "600" });
    const extra =
      m === 0
        ? `A + B = ${fmtV(add3(s.A, s.B))}`
        : m === 1
          ? `|A| = ${fmt(norm3(s.A))}`
          : m === 2
            ? `A · B = ${fmt(dot3(s.A, s.B))}   θ = ${fmt(deg(th))}°`
            : `A × B = ${fmtV(cross3(s.A, s.B))}`;
    d.text(extra, -11.6, 6.1, { align: "left", size: 12, color: m === 3 ? colC : m === 0 ? colR : theme.text, weight: "600" });
    if (k < 0.999) d.text(`escala do desenho ×${fmt(k)}`, -11.6, 5.4, { align: "left", size: 11, color: theme.muted });
    d.text("Arraste as pontas de A e B; arraste o fundo para girar a cena.", 0, -8.6, { size: 11, color: theme.muted });
    if (m === 3) d.text("Dedos de A para B: o polegar aponta A × B.", 11.6, 8.3, { align: "right", size: 12, color: theme.series[3]!, weight: "600" });
  },
});

export default vetores3d;
