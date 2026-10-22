import { defineSim, draw, num, texNum, type Draw, type Params } from "@fisilab/core";
import { intersect, trace, vnorm, vsub, type Boundary, type RaySeg, type Scene, type V } from "./rays.ts";

export * from "./rays.ts";

/** Estado: objeto (distância p ao vértice e altura h, em m). */
export interface MirState {
  p: number;
  h: number;
  drag: boolean;
}

const mode = (p: Params) => Math.round(num(p, "modo"));
const radius = (p: Params) => Math.max(0.05, num(p, "R", 0.8));

/** Distância focal com sinal (côncavo > 0, convexo < 0); Infinity no plano. */
export function focal(p: Params): number {
  const m = mode(p);
  if (m === 0) return Infinity;
  return m === 2 ? -radius(p) / 2 : radius(p) / 2;
}

/** p' pela equação dos pontos conjugados 1/f = 1/p + 1/p' (positivo = imagem real, na frente do espelho). */
export function imageDistance(f: number, p: number): number {
  const den = 1 / f - 1 / p;
  if (Math.abs(den) < 1e-12) return Infinity;
  return 1 / den;
}

/** Meia-altura do espelho desenhado. */
export function halfAperture(p: Params): number {
  const m = mode(p);
  const a = Math.min(0.98, Math.max(0.02, num(p, "abertura", 0.5)));
  if (m === 0) return 0.55;
  if (m === 3) return a * radius(p);
  return Math.min(0.55, a * radius(p));
}

/** Superfície refletora com o vértice em x = 0 e o lado espelhado voltado para −x. */
export function mirrorBoundary(p: Params, shape: "esfera" | "parabola" = "esfera"): Boundary {
  const m = mode(p);
  const R = radius(p);
  const A = halfAperture(p);
  if (m === 0) return { kind: "seg", a: [0, -A], b: [0, A], mirror: true };
  const phi = Math.asin(Math.min(0.999, A / R));
  if (shape === "parabola") {
    const pts: V[] = [];
    for (let i = 0; i <= 2000; i++) {
      const y = -A + (2 * A * i) / 2000;
      pts.push([-(y * y) / (2 * R), y]);
    }
    return { kind: "poly", pts, normalAt: ([, y]) => [1, y / R], mirror: true };
  }
  if (m === 2) return { kind: "arc", c: [R, 0], r: R, a0: Math.PI - phi, a1: Math.PI + phi, mirror: true };
  return { kind: "arc", c: [-R, 0], r: R, a0: -phi, a1: phi, mirror: true };
}

/** x da superfície na altura y. */
function surfaceX(p: Params, y: number, shape: "esfera" | "parabola" = "esfera"): number {
  const m = mode(p);
  const R = radius(p);
  if (m === 0) return 0;
  if (shape === "parabola") return -(y * y) / (2 * R);
  const s = Math.sqrt(Math.max(0, R * R - y * y));
  return m === 2 ? R - s : -R + s;
}

/** Onde um raio paralelo ao eixo, à altura y, cruza o eixo após refletir num espelho esférico côncavo (distância ao vértice). */
export function axisCrossing(R: number, y: number): number {
  const c = Math.sqrt(1 - (y / R) ** 2);
  return R - R / (2 * c);
}

// ---------------------------------------------------------------- feixe paralelo (aberração)
export interface BeamResult {
  segs: RaySeg[];
  /** Raio do círculo de menor confusão (meia-largura mínima do feixe refletido). */
  spot: number;
  /** Aberração longitudinal do raio marginal (m). */
  lsa: number;
}

export function parallelBeam(p: Params, shape: "esfera" | "parabola", n = Math.round(num(p, "nraios", 31))): BeamResult {
  const R = radius(p);
  const A = halfAperture(p);
  const scene: Scene = { boundaries: [mirrorBoundary({ ...p, modo: 3 }, shape)], nAt: () => 1 };
  const segs: RaySeg[] = [];
  const refl: { a: V; d: V }[] = [];
  const N = Math.max(2, n);
  for (let i = 0; i < N; i++) {
    const y = -A * 0.995 + (2 * A * 0.995 * i) / (N - 1);
    const out = trace(scene, [-1.6 * R, y], [1, 0], { maxDepth: 4, maxLen: 4 * R });
    segs.push(...out);
    const r = out.find((g) => g.depth === 1);
    if (r) refl.push({ a: r.a, d: vnorm(vsub(r.b, r.a)) });
  }
  // círculo de menor confusão: menor meia-largura do feixe refletido entre o cruzamento marginal e o foco paraxial
  const xF = -R / 2;
  const x0 = -axisCrossing(R, A * 0.995) - 0.02 * R;
  let spot = Infinity;
  for (let j = 0; j <= 300; j++) {
    const x = x0 + ((xF - x0) * j) / 300;
    let w = 0;
    for (const { a, d } of refl) {
      if (Math.abs(d[0]) < 1e-9) continue;
      w = Math.max(w, Math.abs(a[1] + ((x - a[0]) / d[0]) * d[1]));
    }
    spot = Math.min(spot, w);
  }
  const lsa = shape === "parabola" ? 0 : R / 2 - axisCrossing(R, A * 0.995);
  return { segs, spot, lsa };
}

let beamKey = "";
let beamVal: { esfera: BeamResult; parabola: BeamResult } | null = null;
function beams(p: Params) {
  const key = ["R", "abertura", "nraios"].map((k) => p[k]).join(",");
  if (beamVal && key === beamKey) return beamVal;
  beamKey = key;
  beamVal = { esfera: parallelBeam(p, "esfera"), parabola: parallelBeam(p, "parabola") };
  return beamVal;
}

// ---------------------------------------------------------------- imagem
export interface ImageInfo {
  f: number;
  pi: number;
  m: number;
  hi: number;
  real: boolean;
  infinite: boolean;
}

export function image(s: MirState, p: Params): ImageInfo {
  const f = focal(p);
  if (!Number.isFinite(f)) return { f, pi: -s.p, m: 1, hi: s.h, real: false, infinite: false };
  const pi = imageDistance(f, s.p);
  if (!Number.isFinite(pi)) return { f, pi, m: Infinity, hi: Infinity, real: false, infinite: true };
  const m = -pi / s.p;
  return { f, pi, m, hi: m * s.h, real: pi > 0, infinite: false };
}

const BIG = 1e6;
const fin = (v: number) => (Number.isFinite(v) ? v : Math.sign(v || 1) * BIG);

function describe(im: ImageInfo): string {
  if (im.infinite) return "imagem no infinito (raios refletidos paralelos)";
  const kind = im.real ? "real" : "virtual";
  const ori = im.m > 0 ? "direita" : "invertida";
  const size = Math.abs(Math.abs(im.m) - 1) < 0.005 ? "do mesmo tamanho" : Math.abs(im.m) > 1 ? "maior" : "menor";
  return `imagem ${kind}, ${ori} e ${size}`;
}

const fmt = (v: number, k = 2) => (Number.isFinite(v) ? v.toFixed(k).replace(".", ",") : "∞");

// ---------------------------------------------------------------- sim
const VIEW = (p: Params) => {
  const m = mode(p);
  const R = radius(p);
  if (m === 0) return { xMin: -1.35, xMax: 1.35, yMin: -0.7, yMax: 0.7 };
  if (m === 3) return { xMin: -1.35 * R, xMax: 0.2 * R, yMin: -0.78 * R, yMax: 0.78 * R };
  return { xMin: -1.8, xMax: 0.8, yMin: -0.7, yMax: 0.7 };
};

export const espelhos = defineSim<MirState>({
  id: "espelhos",
  title: "Espelhos planos e esféricos",
  course: "FG IV",
  topic: "Ótica geométrica",
  priority: "P1",
  summary:
    "Arraste o objeto diante de um espelho plano, côncavo ou convexo e acompanhe os raios principais, a imagem real ou virtual e o aumento. Compare um espelho esférico de verdade com um parabólico e veja a aberração esférica e a cáustica.",
  static: true,
  equations: [
    String.raw`\frac{1}{f} = \frac{1}{p} + \frac{1}{p'} \qquad f = \frac{R}{2}\ \ (\text{côncavo } f>0,\ \text{convexo } f<0)`,
    String.raw`m = \frac{h'}{h} = -\frac{p'}{p} \qquad p' > 0:\ \text{imagem real} \qquad p' < 0:\ \text{virtual}`,
    String.raw`\text{plano: } p' = -p,\ m = 1 \qquad \text{esfera, raio à altura } y:\ \ x_{\text{eixo}} = R - \frac{R}{2\cos\theta},\ \sin\theta = \frac{y}{R}`,
    String.raw`\text{parábola } x = -\frac{y^2}{2R}:\ \text{todos os raios paralelos passam pelo foco } f = R/2`,
  ],
  liveEquations(s, p) {
    const m = mode(p);
    if (m === 3) {
      const R = radius(p);
      const A = halfAperture(p);
      const b = beams(p);
      return [
        String.raw`\text{raio marginal } y = ${texNum(A)}\ \text{m}:\ \ x_{\text{eixo}} = ${texNum(axisCrossing(R, A))}\ \text{m} \quad \text{vs.}\quad f = ${texNum(R / 2)}\ \text{m}`,
        String.raw`\text{aberração longitudinal} = ${texNum(b.esfera.lsa * 1000)}\ \text{mm} \qquad \text{menor mancha: esfera } ${texNum(b.esfera.spot * 1000)}\ \text{mm},\ \text{parábola } ${texNum(b.parabola.spot * 1000)}\ \text{mm}`,
      ];
    }
    const im = image(s, p);
    if (m === 0) return [String.raw`p' = -p = ${texNum(-s.p)}\ \text{m} \qquad m = 1 \qquad h' = ${texNum(s.h)}\ \text{m}`];
    return [
      im.infinite
        ? String.raw`\frac{1}{p'} = \frac{1}{${texNum(im.f)}} - \frac{1}{${texNum(s.p)}} = 0 \Rightarrow p' \to \infty`
        : String.raw`\frac{1}{p'} = \frac{1}{f} - \frac{1}{p} = \frac{1}{${texNum(im.f)}} - \frac{1}{${texNum(s.p)}} \Rightarrow p' = ${texNum(im.pi)}\ \text{m}`,
      im.infinite ? String.raw`\text{objeto no foco}` : String.raw`m = -\frac{p'}{p} = ${texNum(im.m)} \qquad h' = ${texNum(im.hi)}\ \text{m}\ \ (\text{${describe(im)}})`,
    ];
  },

  params: [
    {
      key: "modo",
      label: "Espelho",
      unit: "",
      min: 0,
      max: 3,
      step: 1,
      default: 1,
      options: [
        { value: 0, label: "Plano" },
        { value: 1, label: "Côncavo" },
        { value: 2, label: "Convexo" },
        { value: 3, label: "Aberração: feixe paralelo" },
      ],
    },
    { key: "R", label: "Raio de curvatura R", unit: "m", min: 0.2, max: 1.5, step: 0.01, default: 0.8, live: true },
    { key: "p0", label: "Distância inicial do objeto", unit: "m", min: 0.05, max: 1.6, step: 0.01, default: 0.6 },
    { key: "h0", label: "Altura inicial do objeto", unit: "m", min: 0.02, max: 0.3, step: 0.01, default: 0.1 },
    {
      key: "tracado",
      label: "Raios desenhados",
      unit: "",
      min: 0,
      max: 2,
      step: 1,
      default: 0,
      live: true,
      options: [
        { value: 0, label: "Raios principais (paraxiais)" },
        { value: 1, label: "Leque exato a partir do objeto" },
        { value: 2, label: "Os dois" },
      ],
    },
    { key: "abertura", label: "Meia-abertura do espelho (fração de R)", unit: "", min: 0.05, max: 0.95, step: 0.01, default: 0.5, live: true },
    {
      key: "forma",
      label: "Forma (feixe paralelo)",
      unit: "",
      min: 0,
      max: 2,
      step: 1,
      default: 2,
      live: true,
      options: [
        { value: 0, label: "Esférico" },
        { value: 1, label: "Parabólico" },
        { value: 2, label: "Comparar os dois" },
      ],
    },
    { key: "nraios", label: "Número de raios do feixe", unit: "", min: 5, max: 81, step: 2, default: 41, live: true },
  ],

  observables: [
    { key: "p", label: "Distância do objeto p", unit: "m", value: (s) => s.p },
    { key: "pi", label: "Distância da imagem p'", unit: "m", value: (s, p) => fin(image(s, p).pi) },
    { key: "m", label: "Aumento m", unit: "", value: (s, p) => fin(image(s, p).m) },
    { key: "hi", label: "Altura da imagem h'", unit: "m", value: (s, p) => fin(image(s, p).hi) },
    { key: "f", label: "Distância focal f (0 = plano)", unit: "m", value: (_s, p) => (mode(p) === 0 ? 0 : focal(p)) },
    { key: "lsa", label: "Aberração longitudinal (raio marginal)", unit: "mm", value: (_s, p) => (mode(p) === 3 ? beams(p).esfera.lsa * 1000 : 0) },
    { key: "spot", label: "Círculo de menor confusão (raio, esférico)", unit: "mm", value: (_s, p) => (mode(p) === 3 ? beams(p).esfera.spot * 1000 : 0) },
  ],
  chart: { x: "p", y: "pi" },

  scenarios: [
    {
      id: "plano",
      label: "Espelho plano",
      params: { modo: 0, p0: 0.6, h0: 0.15, tracado: 2 },
      guide: `### Imagem num espelho plano
1. Arraste o objeto (a ponta da seta). A imagem acompanha do outro lado, sempre à mesma distância.
2. Os raios refletidos divergem: prolongados para trás (tracejado) se encontram na imagem, que é **virtual**.
3. Confira nas equações: $p' = -p$ e $m = 1$.`,
      predict: [
        {
          question: "Você se afasta 1 m de um espelho plano. Sua imagem se afasta de você:",
          options: ["1 m", "2 m", "0,5 m"],
          answer: 1,
          explanation: "A imagem fica atrás do espelho à mesma distância que você ($p' = -p$). Se você recua 1 m, ela recua 1 m do espelho: a distância entre vocês cresce 2 m.",
        },
      ],
    },
    {
      id: "concavo",
      label: "Espelho côncavo",
      params: { modo: 1, R: 0.8, p0: 0.6, h0: 0.1, tracado: 0 },
      guide: `### Arrastando o objeto pelo eixo
O foco F está a $f = R/2 = 0{,}4$ m e o centro C a $R = 0{,}8$ m.
1. Comece entre F e C: a imagem é real, invertida e maior. Os três raios principais (paralelo, pelo foco, pelo centro) se cruzam nela.
2. Leve o objeto para além de C e depois para dentro de F. Quando a imagem passa a ser virtual?
3. Cada posição solta grava um ponto: o gráfico $p' \\times p$ mostra a hipérbole de $1/f = 1/p + 1/p'$.
4. Troque para **leque exato**: com o espelho bem aberto os raios reais não se encontram num ponto só (aberração).`,
      predict: [
        {
          question: "Com o objeto entre o foco e o espelho côncavo, a imagem é:",
          options: ["real e invertida", "virtual, direita e maior", "não se forma imagem"],
          answer: 1,
          explanation: "Com $p < f$, $1/p' = 1/f - 1/p < 0$: $p' < 0$ (virtual) e $m = -p'/p > 1$. É o espelho de maquiagem.",
        },
      ],
    },
    {
      id: "convexo",
      label: "Espelho convexo",
      params: { modo: 2, R: 0.8, p0: 0.9, h0: 0.2, tracado: 0 },
      guide: `### Retrovisor
1. Arraste o objeto para qualquer lugar: a imagem é sempre virtual, direita e menor, entre o vértice e o foco.
2. Por isso o convexo dá um campo de visão grande, mas os objetos "parecem mais distantes do que estão".
3. Note o foco virtual atrás do espelho: o raio que chega paralelo sai como se viesse dele.`,
    },
    {
      id: "aberracao",
      label: "Aberração esférica e cáustica",
      params: { modo: 3, R: 1, abertura: 0.6, forma: 2, nraios: 31 },
      guide: `### Esfera × parábola
Um feixe paralelo ao eixo chega a um espelho côncavo traçado exatamente (sem aproximação paraxial).
1. Os raios do **esférico** perto da borda cruzam o eixo antes do foco: $x = R - \\frac{R}{2\\cos\\theta}$. O envelope dos raios é a **cáustica** (uma nefroide, tracejada).
2. Os raios do **parabólico** passam todos pelo foco: por isso telescópios e antenas usam parábolas.
3. Diminua a abertura: a esfera e a parábola quase coincidem e a aberração some. Essa é a aproximação paraxial.`,
      predict: [
        {
          question: "Num espelho esférico côncavo bem aberto, os raios paralelos que batem perto da borda cruzam o eixo:",
          options: ["exatamente no foco", "entre o foco e o espelho", "além do foco, mais longe do espelho"],
          answer: 1,
          explanation: "Para a altura $y$, o cruzamento fica a $R - R/(2\\cos\\theta)$ do vértice, menor que $R/2$ quando $\\theta > 0$: os raios marginais focam mais perto do espelho.",
        },
      ],
    },
  ],

  exercises: [
    {
      id: "concavo",
      prompt: "Um espelho côncavo tem raio de curvatura {R} m. Um objeto é colocado a {p0} m do vértice. A que distância do espelho se forma a imagem?",
      vary: { R: [0.4, 1.2, 2], p0: [0.7, 1.5, 2] },
      fixed: { modo: 1 },
      answer: { label: "p'", unit: "m", compute: (p) => imageDistance(num(p, "R") / 2, num(p, "p0")) },
      hint: "f = R/2 e 1/f = 1/p + 1/p'.",
    },
    {
      id: "convexo",
      prompt: "Um retrovisor convexo tem raio de curvatura {R} m. Um objeto de {h0} m de altura está a {p0} m dele. Qual é a altura da imagem?",
      vary: { R: [0.4, 1.5, 2], p0: [0.3, 1.6, 2], h0: [0.05, 0.3, 2] },
      fixed: { modo: 2 },
      answer: {
        label: "h'",
        unit: "m",
        compute: (p) => {
          const pi = imageDistance(-num(p, "R") / 2, num(p, "p0"));
          return (-pi / num(p, "p0")) * num(p, "h0");
        },
      },
      hint: "No convexo f = −R/2; depois m = −p'/p e h' = m h.",
    },
    {
      id: "aberracao",
      prompt: "Um raio paralelo ao eixo, à altura {y} m, atinge um espelho esférico côncavo de raio {R} m. A que distância do vértice ele cruza o eixo depois de refletir?",
      vary: { R: [0.5, 1.5, 2], y: [0.05, 0.4, 2] },
      fixed: { modo: 3 },
      answer: { label: "x", unit: "m", compute: (p) => axisCrossing(num(p, "R"), num(p, "y")) },
      hint: "A normal passa pelo centro; o triângulo centro–ponto de incidência–cruzamento é isósceles, com lados iguais R/(2 cos θ).",
    },
  ],

  init: (p) => ({ p: Math.min(num(p, "p0", 0.6), mode(p) === 0 ? 1.25 : 1.7), h: num(p, "h0", 0.1), drag: false }),
  step: (s) => s,
  sampleEvery: 1000,
  maxSamples: 400,

  viewport: (p) => ({ ...VIEW(p), unit: "m" }),

  pointer: {
    down(s, p, pt) {
      if (mode(p) === 3) return undefined;
      const near = Math.abs(pt.x + s.p) < 0.06 && pt.y >= Math.min(0, s.h) - 0.05 && pt.y <= Math.max(0, s.h) + 0.05;
      return near ? { ...s, drag: true } : undefined;
    },
    move(s, p, pt, dragging) {
      if (!dragging || !s.drag) return undefined;
      const pmax = mode(p) === 0 ? 1.25 : 1.75;
      let h = Math.max(-0.5, Math.min(0.5, pt.y));
      if (Math.abs(h) < 0.01) h = h < 0 ? -0.01 : 0.01;
      return { ...s, p: Math.max(0.03, Math.min(pmax, -pt.x)), h };
    },
    up: (s) => (s.drag ? { ...s, drag: false } : undefined),
    cursor: (s, p, pt) =>
      mode(p) !== 3 && Math.abs(pt.x + s.p) < 0.06 && pt.y >= Math.min(0, s.h) - 0.05 && pt.y <= Math.max(0, s.h) + 0.05 ? "grab" : undefined,
  },

  actions: [
    { id: "noC", label: "Objeto no centro C", run: (s, p) => (mode(p) === 1 ? { ...s, p: radius(p) } : s) },
    { id: "noF", label: "Objeto no foco F", run: (s, p) => (mode(p) === 1 ? { ...s, p: radius(p) / 2 } : s) },
  ],

  render(ctx, frame) {
    const { state: s, params: p } = frame;
    const d = draw(ctx, frame);
    const vp = VIEW(p);
    ctx.save();
    ctx.beginPath();
    ctx.rect(vp.xMin, vp.yMin, vp.xMax - vp.xMin, vp.yMax - vp.yMin);
    ctx.clip();
    d.line(vp.xMin, 0, vp.xMax, 0, { color: d.theme.muted, width: 1, dash: [6, 4] });
    if (mode(p) === 3) renderBeam(d, p, vp);
    else renderObject(d, s, p, vp);
    ctx.restore();
  },
});

function drawMirror(d: Draw, p: Params, shape: "esfera" | "parabola", color: string, width = 3) {
  const A = halfAperture(p);
  const pts: V[] = [];
  for (let i = 0; i <= 80; i++) {
    const y = -A + (2 * A * i) / 80;
    pts.push([surfaceX(p, y, shape), y]);
  }
  d.polyline(pts, { color, width });
  // hachura nas costas do espelho
  const k = 0.035 * Math.max(0.5, Math.min(1.5, (VIEW(p).xMax - VIEW(p).xMin) / 2.6));
  for (let i = 0; i <= 16; i++) {
    const [x, y] = pts[Math.round((i * 80) / 16)]!;
    d.line(x, y, x + k, y - k, { color, width: 1, alpha: 0.6 });
  }
}

function point(d: Draw, x: number, label: string, color: string) {
  d.dot(x, 0, 3.5, color);
  d.text(label, x, 0, { dy: 12, color, size: 11, weight: "600" });
}

function renderObject(d: Draw, s: MirState, p: Params, vp: { xMin: number; xMax: number; yMin: number; yMax: number }) {
  const { theme } = d;
  const m = mode(p);
  const R = radius(p);
  const f = focal(p);
  const im = image(s, p);
  const tr = Math.round(num(p, "tracado"));
  const bd = mirrorBoundary(p);
  const mirrorCol = theme.text;

  if (m === 1) {
    point(d, -R, "C", theme.muted);
    point(d, -R / 2, "F", theme.muted);
  } else if (m === 2) {
    point(d, R, "C", theme.muted);
    point(d, R / 2, "F", theme.muted);
  }
  point(d, 0, "V", theme.muted);
  drawMirror(d, p, "esfera", mirrorCol);

  const T: V = [-s.p, s.h];
  const L = 6;
  const colors = [theme.series[1], theme.series[2], theme.series[4], theme.series[5]].map((c) => c ?? theme.accent);
  const Ipt: V = im.infinite ? [0, 0] : [-im.pi, im.hi];

  // raios principais (paraxiais): incidem no espelho real e, refletidos, passam pela imagem
  if (tr === 0 || tr === 2) {
    const dirs: V[] = [[1, 0]];
    if (Number.isFinite(f)) {
      const F: V = [-f, 0];
      const C: V = [-2 * f, 0];
      for (const P of [F, C]) {
        let dv = vsub(P, T);
        if (dv[0] < 0) dv = [-dv[0], -dv[1]];
        if (Math.abs(P[0] - T[0]) > 1e-6) dirs.push(vnorm(dv));
      }
    } else {
      dirs.push(vnorm([s.p, halfAperture(p) * 0.8 - s.h]));
    }
    dirs.push(vnorm([s.p, -s.h]));
    dirs.forEach((dv, i) => {
      const col = colors[i % colors.length]!;
      const h = intersect(T, dv, bd);
      let H: V;
      if (h) H = h.p;
      else {
        // fora da abertura: prolonga o espelho (plano do vértice), tracejado
        const t = (0 - T[0]) / dv[0];
        H = [0, T[1] + t * dv[1]];
        d.line(0, 0, 0, H[1], { color: mirrorCol, dash: [2, 4], width: 1, alpha: 0.5 });
      }
      d.line(T[0], T[1], H[0], H[1], { color: col, width: 1.6 });
      let out: V;
      if (im.infinite) out = vnorm([-s.p, -s.h]);
      else if (im.real) out = vnorm(vsub(Ipt, H));
      else {
        out = vnorm(vsub(H, Ipt));
        d.line(H[0], H[1], Ipt[0], Ipt[1], { color: col, width: 1, dash: [5, 4], alpha: 0.8 });
      }
      d.line(H[0], H[1], H[0] + out[0] * L, H[1] + out[1] * L, { color: col, width: 1.6 });
      d.arrowPx((T[0] + H[0]) / 2, (T[1] + H[1]) / 2, dv[0], dv[1], 9, { color: col, head: 8 });
    });
  }

  // leque exato: raios do topo do objeto traçados até o espelho verdadeiro
  if (tr === 1 || tr === 2) {
    const scene: Scene = { boundaries: [bd], nAt: () => 1 };
    const A = halfAperture(p);
    const col = theme.series[3] ?? theme.accent;
    for (let i = 0; i <= 14; i++) {
      const y = -A * 0.98 + (2 * A * 0.98 * i) / 14;
      const target: V = [surfaceX(p, y), y];
      const segs = trace(scene, T, vnorm(vsub(target, T)), { maxDepth: 3, maxLen: L });
      for (const g of segs) {
        d.line(g.a[0], g.a[1], g.b[0], g.b[1], { color: col, width: 1, alpha: 0.55 });
        if (g.depth === 1 && !im.real) {
          const back = vnorm(vsub(g.a, g.b));
          d.line(g.a[0], g.a[1], g.a[0] + back[0] * 2, g.a[1] + back[1] * 2, { color: col, width: 0.8, alpha: 0.3, dash: [3, 4] });
        }
      }
    }
  }

  // objeto e imagem
  d.arrow(T[0], 0, 0, s.h, { color: theme.series[0] ?? theme.accent, width: 3 });
  d.dot(T[0], T[1], 5, theme.series[0] ?? theme.accent);
  d.text("objeto", T[0], 0, { dy: s.h > 0 ? 14 : -14, color: theme.series[0] ?? theme.accent, size: 11 });
  if (!im.infinite && Number.isFinite(im.hi)) {
    const icol = theme.series[3] ?? theme.accent;
    d.arrow(Ipt[0], 0, 0, im.hi, { color: icol, width: 3, dash: im.real ? [] : [6, 4] });
    d.text(im.real ? "imagem real" : "imagem virtual", Ipt[0], 0, { dy: im.hi > 0 ? 14 : -14, color: icol, size: 11 });
  }
  const lines = [
    `p = ${fmt(s.p)} m   p' = ${fmt(im.pi)} m   m = ${fmt(im.m)}`,
    describe(im),
    "arraste a ponta do objeto",
  ];
  lines.forEach((t, i) =>
    d.text(t, vp.xMin + 0.04, vp.yMax - 0.04, { dy: i * 16, align: "left", baseline: "top", color: i === 2 ? theme.muted : theme.text, size: 12, weight: i === 0 ? "600" : "400" }),
  );
}

/** Cáustica do espelho esférico para raios paralelos: nefroide, C + (R/4)(3cos θ − cos 3θ, 3sin θ − sin 3θ). */
export function causticPoint(R: number, th: number): V {
  return [-R + (R / 4) * (3 * Math.cos(th) - Math.cos(3 * th)), (R / 4) * (3 * Math.sin(th) - Math.sin(3 * th))];
}

function renderBeam(d: Draw, p: Params, vp: { xMin: number; xMax: number; yMin: number; yMax: number }) {
  const { theme } = d;
  const R = radius(p);
  const forma = Math.round(num(p, "forma"));
  const b = beams(p);
  const sphCol = theme.series[1] ?? theme.accent;
  const parCol = theme.series[0] ?? theme.accent;
  point(d, -R / 2, "F", theme.text);
  point(d, -R, "C", theme.muted);
  if (forma !== 1) {
    for (const g of b.esfera.segs) d.line(g.a[0], g.a[1], g.b[0], g.b[1], { color: sphCol, width: 1, alpha: g.depth === 0 ? 0.35 : 0.6 });
    drawMirror(d, p, "esfera", sphCol);
    const A = halfAperture(p);
    const thMax = Math.asin(Math.min(0.999, A / R));
    const pts: V[] = [];
    for (let i = 0; i <= 80; i++) pts.push(causticPoint(R, -thMax + (2 * thMax * i) / 80));
    d.polyline(pts, { color: theme.series[3] ?? theme.text, width: 2, dash: [6, 4] });
  }
  if (forma !== 0) {
    for (const g of b.parabola.segs) d.line(g.a[0], g.a[1], g.b[0], g.b[1], { color: parCol, width: 1, alpha: g.depth === 0 ? 0.35 : 0.6 });
    drawMirror(d, p, "parabola", parCol, 2);
  }
  const lines: [string, string][] = [];
  if (forma !== 1) lines.push([`esférico: aberração longitudinal ${fmt(b.esfera.lsa * 1000, 1)} mm, menor mancha ±${fmt(b.esfera.spot * 1000, 1)} mm`, sphCol]);
  if (forma !== 0) lines.push([`parabólico: menor mancha ±${fmt(b.parabola.spot * 1000, 2)} mm (foco perfeito)`, parCol]);
  if (forma !== 1) lines.push(["tracejado: cáustica (nefroide)", theme.series[3] ?? theme.text]);
  lines.forEach(([t, c], i) => d.text(t, vp.xMin + 0.03 * R, vp.yMax - 0.03 * R, { dy: i * 16, align: "left", baseline: "top", color: c, size: 12, weight: "600" }));
}

export default espelhos;
