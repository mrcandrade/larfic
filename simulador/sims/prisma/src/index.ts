import { defineSim, draw, num, texNum, type Draw, type Params } from "@fisilab/core";
import { mainPath, trace, vdir, wavelengthRGB, type Scene, type V } from "./rays.ts";
import { MATERIALS, bowAngle, deg, dropDeviation, minDeviation, minDeviationIncidence, prismDeviation, rad, rainbowAngle, sellmeier } from "./dispersion.ts";

export * from "./rays.ts";
export * from "./dispersion.ts";

export interface PrismState {
  /** Fonte de luz do prisma: posição e direção. */
  sx: number;
  sy: number;
  ang: number;
  /** Parâmetro de impacto na gota (fração do raio). */
  b: number;
  drag: null | "fonte" | "giro" | "b";
}

const mode = (p: Params) => Math.round(num(p, "modo"));
const material = (p: Params) => MATERIALS[Math.max(0, Math.min(MATERIALS.length - 1, Math.round(num(p, "material"))))]!;
export const nOf = (p: Params, nm: number) => sellmeier(material(p), nm);
const mono = (p: Params) => Math.round(num(p, "luz")) === 1;
const lambdaRef = (p: Params) => (mono(p) ? num(p, "lambda", 589) : 589);
const wavelengths = (p: Params) => (mono(p) ? [num(p, "lambda", 589)] : Array.from({ length: 31 }, (_, i) => 400 + 10 * i));

// ---------------------------------------------------------------- prisma
const YA = 1.0;
const SIDE = 2.6;
const SCREEN_X = 3.4;
const VP_PRISM = { xMin: -3.8, xMax: 4.2, yMin: -2.6, yMax: 2.3 };
const SRC_L = 0.5;

export function prismVertices(p: Params): [V, V, V] {
  const A = rad(num(p, "A", 60));
  const hx = SIDE * Math.sin(A / 2);
  const yb = YA - SIDE * Math.cos(A / 2);
  return [
    [0, YA],
    [-hx, yb],
    [hx, yb],
  ];
}

function inTriangle(q: V, [a, b, c]: [V, V, V]): boolean {
  const s = (p1: V, p2: V) => (p2[0] - p1[0]) * (q[1] - p1[1]) - (p2[1] - p1[1]) * (q[0] - p1[0]);
  const d1 = s(a, b);
  const d2 = s(b, c);
  const d3 = s(c, a);
  return (d1 >= 0 && d2 >= 0 && d3 >= 0) || (d1 <= 0 && d2 <= 0 && d3 <= 0);
}

export function prismScene(p: Params, nm: number): Scene {
  const tri = prismVertices(p);
  const n = nOf(p, nm);
  const [a, b, c] = tri;
  return {
    boundaries: [
      { kind: "seg", a, b },
      { kind: "seg", a: b, b: c },
      { kind: "seg", a: c, b: a },
      { kind: "seg", a: [SCREEN_X, -20], b: [SCREEN_X, 20], absorb: true, tag: "tela" },
    ],
    nAt: (q) => (inTriangle(q, tri) ? n : 1),
  };
}

/** Fonte posicionada para atingir o meio da face esquerda com incidência θi (rad). */
export function sourceAt(p: Params, thi: number): Pick<PrismState, "sx" | "sy" | "ang"> {
  const A = rad(num(p, "A", 60));
  const [a, b] = prismVertices(p);
  const M: V = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const ang = -A / 2 + thi;
  return { sx: M[0] - 1.6 * Math.cos(ang), sy: M[1] - 1.6 * Math.sin(ang), ang };
}

export interface PrismRay {
  nm: number;
  segs: ReturnType<typeof trace>;
  /** Desvio (graus, positivo = para a base) ou NaN se não atravessou. */
  dev: number;
  thi: number;
  yScreen: number | null;
}

export function tracePrism(s: PrismState, p: Params, nm: number): PrismRay {
  const segs = mainPath(trace(prismScene(p, nm), [s.sx, s.sy], vdir(s.ang), { maxDepth: 10, maxLen: 14, followStrongest: false }));
  const first = segs[0];
  const last = segs[segs.length - 1];
  let dev = NaN;
  let yScreen: number | null = null;
  if (last && last.refr >= 2 && first && first.end === "interface") {
    const out = Math.atan2(last.b[1] - last.a[1], last.b[0] - last.a[0]);
    let dd = s.ang - out;
    while (dd > Math.PI) dd -= 2 * Math.PI;
    while (dd <= -Math.PI) dd += 2 * Math.PI;
    dev = deg(dd);
    if (last.tag === "tela") yScreen = last.b[1];
  }
  return { nm, segs, dev, thi: first?.theta !== undefined && first.end === "interface" ? deg(first.theta) : NaN, yScreen };
}

// ---------------------------------------------------------------- gota
const VP_DROP = { xMin: -3.2, xMax: 3.2, yMin: -2.6, yMax: 2.6 };
const HANDLE_X = -2.9;

export function dropScene(p: Params, nm: number): Scene {
  const n = nOf(p, nm);
  return { boundaries: [{ kind: "circle", c: [0, 0], r: 1 }], nAt: (q) => (Math.hypot(q[0], q[1]) < 1 ? n : 1) };
}

export function traceDrop(p: Params, nm: number, b: number) {
  return trace(dropScene(p, nm), [HANDLE_X, b], [1, 0], { branch: true, maxDepth: 5, minI: 1e-4, maxLen: 6 }).filter((g) => g.refl <= 2 && g.refr <= 2);
}

// ---------------------------------------------------------------- céu
const VP_SKY = { xMin: -75, xMax: 75, yMin: -14, yMax: 66 };

// ---------------------------------------------------------------- análise
interface Obs {
  thi: number;
  dev: number;
  dmin: number;
  disp: number;
  phi2: number;
  n: number;
}

let cKey = "";
let cVal: Obs | null = null;
function observe(s: PrismState, p: Params): Obs {
  const key = JSON.stringify([s.sx, s.sy, s.ang, s.b, p]);
  if (cVal && key === cKey) return cVal;
  const m = mode(p);
  const lr = lambdaRef(p);
  const n = nOf(p, lr);
  let o: Obs;
  if (m === 0) {
    const A = rad(num(p, "A", 60));
    const r = tracePrism(s, p, lr);
    const rv = tracePrism(s, p, 400);
    const rr = tracePrism(s, p, 700);
    const fin = (v: number) => (Number.isFinite(v) ? v : 0);
    o = { thi: fin(r.thi), dev: fin(r.dev), dmin: fin(deg(minDeviation(n, A))), disp: fin(rv.dev - rr.dev), phi2: 0, n };
  } else {
    const b = Math.max(-0.999, Math.min(0.999, s.b));
    o = {
      thi: deg(Math.asin(Math.abs(b))),
      dev: deg(dropDeviation(n, Math.abs(b), 1)),
      dmin: deg(rainbowAngle(n, 1)),
      disp: deg(rainbowAngle(nOf(p, 700), 1) - rainbowAngle(nOf(p, 400), 1)),
      phi2: deg(rainbowAngle(n, 2)),
      n,
    };
  }
  cKey = key;
  cVal = o;
  return o;
}

const fmt = (v: number, k = 1) => (Number.isFinite(v) ? v.toFixed(k).replace(".", ",") : "—");

export const prisma = defineSim<PrismState>({
  id: "prisma",
  title: "Prisma, dispersão e arco-íris",
  course: "FG IV",
  topic: "Ótica geométrica",
  priority: "P1",
  summary:
    "Decomponha a luz branca num prisma com índices reais (Sellmeier) e encontre o desvio mínimo. Numa gota d'água, siga os raios com uma e duas reflexões internas e veja surgirem os arcos-íris primário (~42°) e secundário (~51°).",
  static: true,
  equations: [
    String.raw`n^2(\lambda) - 1 = \sum_i \frac{B_i \lambda^2}{\lambda^2 - C_i} \qquad (\text{Cauchy: } n \approx A + B/\lambda^2)`,
    String.raw`\delta = \theta_1 + \theta_4 - A \qquad n = \frac{\sin\frac{A + \delta_{\min}}{2}}{\sin\frac{A}{2}}`,
    String.raw`\text{gota, } k \text{ reflexões: } D_k = 2(\theta_i - \theta_r) + k(\pi - 2\theta_r), \quad \sin\theta_i = n \sin\theta_r = b`,
    String.raw`\frac{dD_k}{db} = 0 \Rightarrow \cos\theta_i = \sqrt{\frac{n^2 - 1}{k(k+2)}} \qquad \varphi_1 = 180^\circ - D_1 \approx 42^\circ,\ \ \varphi_2 = D_2 - 180^\circ \approx 51^\circ`,
  ],
  liveEquations(s, p) {
    const o = observe(s, p);
    const m = mode(p);
    const lr = lambdaRef(p);
    if (m === 0) {
      const A = num(p, "A", 60);
      return [
        String.raw`n(${texNum(lr)}\ \text{nm}) = ${texNum(o.n, 5)} \qquad n(400) = ${texNum(nOf(p, 400), 5)} \qquad n(700) = ${texNum(nOf(p, 700), 5)}`,
        String.raw`\theta_1 = ${texNum(o.thi)}^\circ \Rightarrow \delta = ${texNum(o.dev)}^\circ \qquad \delta_{\min} = 2\arcsin\!\left(n\sin\tfrac{${texNum(A)}^\circ}{2}\right) - ${texNum(A)}^\circ = ${texNum(o.dmin)}^\circ`,
      ];
    }
    return [
      String.raw`n(${texNum(lr)}\ \text{nm}) = ${texNum(o.n, 5)} \qquad b = ${texNum(Math.abs(s.b))}:\ D_1 = ${texNum(o.dev)}^\circ,\ \varphi = ${texNum(180 - o.dev)}^\circ`,
      String.raw`\varphi_1 = ${texNum(o.dmin, 4)}^\circ \qquad \varphi_2 = ${texNum(o.phi2, 4)}^\circ \qquad \varphi_1(700) - \varphi_1(400) = ${texNum(o.disp)}^\circ`,
    ];
  },

  params: [
    {
      key: "modo",
      label: "Montagem",
      unit: "",
      min: 0,
      max: 2,
      step: 1,
      default: 0,
      options: [
        { value: 0, label: "Prisma" },
        { value: 1, label: "Gota d'água (arco-íris)" },
        { value: 2, label: "Arco-íris no céu" },
      ],
    },
    { key: "material", label: "Material", unit: "", min: 0, max: MATERIALS.length - 1, step: 1, default: 0, live: true, options: MATERIALS.map((m, i) => ({ value: i, label: m.label })) },
    {
      key: "luz",
      label: "Luz",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 0,
      live: true,
      options: [
        { value: 0, label: "Branca (400–700 nm)" },
        { value: 1, label: "Monocromática" },
      ],
    },
    { key: "lambda", label: "Comprimento de onda", unit: "nm", min: 380, max: 750, step: 1, default: 589, live: true },
    { key: "A", label: "Ângulo do prisma A", unit: "°", min: 30, max: 75, step: 1, default: 60, live: true },
    {
      key: "feixe",
      label: "Na gota",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 0,
      live: true,
      options: [
        { value: 0, label: "Um raio (arraste a altura)" },
        { value: 1, label: "Feixe de raios paralelos" },
      ],
    },
    { key: "sol", label: "Altura do Sol acima do horizonte", unit: "°", min: 0, max: 60, step: 1, default: 20, live: true },
  ],

  observables: [
    { key: "thi", label: "Ângulo de incidência", unit: "°", value: (s, p) => observe(s, p).thi },
    { key: "dev", label: "Desvio do raio (λ de referência)", unit: "°", value: (s, p) => observe(s, p).dev },
    { key: "dmin", label: "Desvio mínimo / ângulo do arco primário", unit: "°", value: (s, p) => observe(s, p).dmin },
    { key: "disp", label: "Dispersão angular (violeta − vermelho)", unit: "°", value: (s, p) => observe(s, p).disp },
    { key: "phi2", label: "Ângulo do arco secundário", unit: "°", value: (s, p) => observe(s, p).phi2 },
    { key: "n", label: "Índice de refração (λ de referência)", unit: "", value: (s, p) => observe(s, p).n },
  ],
  chart: { x: "thi", y: "dev" },

  scenarios: [
    {
      id: "prisma",
      label: "Luz branca no prisma",
      params: { modo: 0, material: 0, luz: 0, A: 60 },
      guide: `### Dispersão
O índice do vidro depende do comprimento de onda (Sellmeier): é maior no violeta que no vermelho.
1. Veja o feixe branco se abrir em cores dentro do prisma e na tela.
2. Troque o vidro crown por flint denso (SF11): o espectro fica bem mais largo.
3. Mude para luz monocromática e varie $\\lambda$: confira o índice nas equações ao vivo.`,
      predict: [
        {
          question: "Qual cor é mais desviada pelo prisma?",
          options: ["vermelho", "verde", "violeta"],
          answer: 2,
          explanation: "No vidro, $n$ cresce quando $\\lambda$ diminui (dispersão normal). O violeta tem o maior índice e sofre o maior desvio.",
        },
      ],
    },
    {
      id: "desvio-minimo",
      label: "Desvio mínimo",
      params: { modo: 0, material: 0, luz: 1, lambda: 589, A: 60 },
      guide: `### Medindo n pelo desvio mínimo
1. Gire a fonte (círculo atrás dela) e acompanhe o desvio $\\delta$ no gráfico pequeno $\\delta(\\theta_1)$ e no gráfico principal.
2. O desvio passa por um mínimo quando o raio atravessa o prisma paralelo à base (caminho simétrico).
3. Use **Ajustar desvio mínimo** e confira $n = \\sin\\frac{A+\\delta_{\\min}}{2} / \\sin\\frac{A}{2}$. É assim que se mede o índice num espectrômetro.`,
    },
    {
      id: "gota",
      label: "Raios numa gota",
      params: { modo: 1, material: 3, luz: 0, feixe: 0 },
      guide: `### Uma e duas reflexões internas
A luz do Sol entra pela esquerda. Arraste a altura $b$ do raio (alça à esquerda).
1. Com **uma** reflexão interna o raio volta para o lado do Sol a cerca de $42^\\circ$ da direção antissolar: arco primário.
2. Com **duas** reflexões sai a cerca de $51^\\circ$, mais fraco e com as cores invertidas: arco secundário.
3. Escolha **feixe de raios paralelos** com luz monocromática: os raios se acumulam perto do ângulo extremo (o gráfico pequeno mostra o máximo de $\\varphi(b)$). Essa concentração é o arco-íris.`,
      predict: [
        {
          question: "No arco-íris primário, qual cor fica do lado de fora (maior raio)?",
          options: ["vermelho", "violeta", "depende da altura do Sol"],
          answer: 0,
          explanation: "O vermelho tem o menor índice; seu ângulo extremo é cerca de $42{,}4^\\circ$, contra $40{,}6^\\circ$ do violeta. No secundário a ordem se inverte.",
        },
      ],
    },
    {
      id: "ceu",
      label: "Arco-íris no céu",
      params: { modo: 2, material: 3, sol: 20 },
      guide: `### Visto do chão
O arco é um cone em torno do ponto antissolar (a sombra da sua cabeça), com abertura $\\varphi_1 \\approx 42^\\circ$ e $\\varphi_2 \\approx 51^\\circ$.
1. Levante o Sol: o arco desce. Acima de cerca de $42^\\circ$ de elevação o primário some abaixo do horizonte.
2. Note a **faixa escura de Alexandre** entre os dois arcos: nenhuma gota manda luz de uma ou duas reflexões para lá.
3. Troque a água por vidro (miçangas de sinalização de estrada) e compare o tamanho do arco.`,
      predict: [
        {
          question: "Por que não se vê arco-íris ao meio-dia no verão (Sol muito alto)?",
          options: ["Não há gotas no ar ao meio-dia", "O arco fica todo abaixo do horizonte", "A luz é forte demais"],
          answer: 1,
          explanation: "O arco é centrado no ponto antissolar, que está tão abaixo do horizonte quanto o Sol está acima. Com o Sol acima de cerca de $42^\\circ$, todo o arco primário fica abaixo do horizonte.",
        },
      ],
    },
  ],

  exercises: [
    {
      id: "desvio-minimo",
      prompt: "Um prisma de ângulo {A}° é feito de um vidro de índice {n}. Qual é o desvio mínimo?",
      vary: { A: [30, 60, 0], n: [1.4, 1.7, 2] },
      fixed: { modo: 0 },
      answer: { label: "δmin", unit: "°", compute: (p) => deg(minDeviation(num(p, "n"), rad(num(p, "A")))) },
      hint: "No desvio mínimo o raio interno é paralelo à base: θr = A/2 e δ = 2θi − A.",
    },
    {
      id: "indice",
      prompt: "Num espectrômetro, um prisma de {A}° apresenta desvio mínimo de {dm}°. Qual é o índice de refração do vidro?",
      vary: { A: [50, 60, 0], dm: [30, 50, 0] },
      fixed: { modo: 0 },
      answer: { label: "n", unit: "", compute: (p) => Math.sin(rad((num(p, "A") + num(p, "dm")) / 2)) / Math.sin(rad(num(p, "A") / 2)) },
      tolerance: 0.005,
    },
    {
      id: "arco",
      prompt: "Para gotas de um líquido com índice de refração {n}, qual é o raio angular do arco-íris primário (medido a partir do ponto antissolar)?",
      vary: { n: [1.32, 1.36, 3] },
      fixed: { modo: 1 },
      answer: { label: "φ₁", unit: "°", compute: (p) => deg(rainbowAngle(num(p, "n"), 1)) },
      hint: "Ache θi com cos θi = √((n² − 1)/3), depois φ = 180° − [2(θi − θr) + 180° − 2θr] = 4θr − 2θi.",
    },
  ],

  init(p) {
    const A = rad(num(p, "A", 60));
    return { ...sourceAt(p, minDeviationIncidence(nOf(p, 589), A)), b: 0.86, drag: null };
  },
  step: (s) => s,
  sampleEvery: 1000,
  maxSamples: 400,

  viewport(p) {
    const m = mode(p);
    if (m === 1) return { ...VP_DROP, unit: "" };
    if (m === 2) return { ...VP_SKY, unit: "" };
    return { ...VP_PRISM, unit: "cm" };
  },

  pointer: {
    down(s, p, pt) {
      const m = mode(p);
      if (m === 2) return undefined;
      if (m === 1) return Math.abs(pt.x - HANDLE_X) < 0.25 && Math.abs(pt.y - s.b) < 0.25 && num(p, "feixe") < 0.5 ? { ...s, drag: "b" } : undefined;
      const u = vdir(s.ang);
      const hx = s.sx - u[0] * SRC_L * 1.2;
      const hy = s.sy - u[1] * SRC_L * 1.2;
      if (Math.hypot(pt.x - hx, pt.y - hy) < 0.18) return { ...s, drag: "giro" };
      const bx = s.sx - u[0] * SRC_L * 0.5;
      const by = s.sy - u[1] * SRC_L * 0.5;
      return Math.hypot(pt.x - bx, pt.y - by) < SRC_L * 0.6 ? { ...s, drag: "fonte" } : undefined;
    },
    move(s, p, pt, dragging) {
      if (!dragging || !s.drag) return undefined;
      if (s.drag === "b") return { ...s, b: Math.max(-0.995, Math.min(0.995, pt.y)) };
      const vp = VP_PRISM;
      if (s.drag === "fonte") return { ...s, sx: Math.max(vp.xMin + 0.1, Math.min(vp.xMax - 0.1, pt.x)), sy: Math.max(vp.yMin + 0.1, Math.min(vp.yMax - 0.1, pt.y)) };
      const dx = s.sx - pt.x;
      const dy = s.sy - pt.y;
      return Math.hypot(dx, dy) < 1e-6 ? undefined : { ...s, ang: Math.atan2(dy, dx) };
    },
    up: (s) => (s.drag ? { ...s, drag: null } : undefined),
    cursor(s, p, pt) {
      const m = mode(p);
      if (m === 1) return Math.abs(pt.x - HANDLE_X) < 0.25 && Math.abs(pt.y - s.b) < 0.25 ? "ns-resize" : undefined;
      if (m !== 0) return undefined;
      const u = vdir(s.ang);
      if (Math.hypot(pt.x - (s.sx - u[0] * SRC_L * 1.2), pt.y - (s.sy - u[1] * SRC_L * 1.2)) < 0.18) return "alias";
      return Math.hypot(pt.x - (s.sx - u[0] * SRC_L * 0.5), pt.y - (s.sy - u[1] * SRC_L * 0.5)) < SRC_L * 0.6 ? "grab" : undefined;
    },
  },

  actions: [
    {
      id: "minimo",
      label: "Ajustar desvio mínimo",
      run: (s, p) => ({ ...s, ...sourceAt(p, minDeviationIncidence(nOf(p, lambdaRef(p)), rad(num(p, "A", 60)))) }),
    },
    {
      id: "arco",
      label: "Raio do arco primário (gota)",
      run(s, p) {
        const n = nOf(p, lambdaRef(p));
        const c = Math.sqrt((n * n - 1) / 3);
        return { ...s, b: Math.sqrt(1 - c * c) };
      },
    },
  ],

  render(ctx, frame) {
    const { state: s, params: p } = frame;
    const d = draw(ctx, frame);
    const m = mode(p);
    const vp = m === 0 ? VP_PRISM : m === 1 ? VP_DROP : VP_SKY;
    ctx.save();
    ctx.beginPath();
    ctx.rect(vp.xMin, vp.yMin, vp.xMax - vp.xMin, vp.yMax - vp.yMin);
    ctx.clip();
    if (m === 0) renderPrism(d, s, p);
    else if (m === 1) renderDrop(d, s, p);
    else renderSky(d, p);
    ctx.restore();
  },
});

// ---------------------------------------------------------------- desenho
const rayColor = (_d: Draw, _p: Params, nm: number) => wavelengthRGB(nm);
const whiteRay = (d: Draw) => (d.theme.dark ? "#f2f2f2" : "#8a8f99");

interface Box {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

/** Pequeno gráfico desenhado no palco. */
function miniPlot(
  d: Draw,
  box: Box,
  xr: [number, number],
  yr: [number, number],
  curves: { f: (x: number) => number; color: string; dash?: number[] }[],
  labels: { x: string; y: string; title: string },
) {
  const { theme } = d;
  const X = (x: number) => box.x0 + ((x - xr[0]) / (xr[1] - xr[0])) * (box.x1 - box.x0);
  const Y = (y: number) => box.y0 + ((y - yr[0]) / (yr[1] - yr[0])) * (box.y1 - box.y0);
  d.rect(box.x0, box.y0, box.x1 - box.x0, box.y1 - box.y0, { fill: theme.dark ? "#161b24" : "#fbfcfe", stroke: theme.grid, width: 1 });
  for (const c of curves) {
    const pts: [number, number][] = [];
    for (let i = 0; i <= 200; i++) {
      const x = xr[0] + ((xr[1] - xr[0]) * i) / 200;
      const y = c.f(x);
      if (Number.isFinite(y) && y >= yr[0] && y <= yr[1]) pts.push([X(x), Y(y)]);
      else if (pts.length > 1) {
        d.polyline(pts.splice(0), { color: c.color, width: 1.8, dash: c.dash });
      } else pts.length = 0;
    }
    d.polyline(pts, { color: c.color, width: 1.8, dash: c.dash });
  }
  d.text(labels.title, box.x0 + 0.04 * (box.x1 - box.x0), box.y1, { dy: 7, align: "left", baseline: "top", color: theme.text, size: 10, weight: "600" });
  d.text(labels.x, box.x1, box.y0, { dy: 9, align: "right", color: theme.muted, size: 10 });
  d.text(labels.y, box.x0, box.y1, { dx: -3, align: "right", baseline: "top", color: theme.muted, size: 10 });
  d.text(fmt(yr[0], 0), box.x0, box.y0, { dx: -3, align: "right", color: theme.muted, size: 9 });
  d.text(fmt(xr[0], 0), box.x0, box.y0, { dy: 9, color: theme.muted, size: 9 });
  return { X, Y };
}

function renderPrism(d: Draw, s: PrismState, p: Params) {
  const { theme } = d;
  const tri = prismVertices(p);
  const n0 = nOf(p, 589);
  d.polyline(tri, { close: true, color: theme.text, width: 1.5, fill: theme.dark ? "rgba(91,156,240,0.16)" : "rgba(47,125,225,0.10)" });
  d.text(`A = ${fmt(num(p, "A", 60), 0)}°`, 0, YA, { dy: -12, color: theme.text, size: 11 });
  d.text(material(p).label, 0, tri[1][1], { dy: 14, color: theme.muted, size: 11 });
  // tela
  d.line(SCREEN_X, VP_PRISM.yMin, SCREEN_X, VP_PRISM.yMax, { color: theme.muted, width: 3 });
  d.text("tela", SCREEN_X, VP_PRISM.yMax, { dy: 10, dx: 14, color: theme.muted, size: 11 });

  const rays = wavelengths(p).map((nm) => tracePrism(s, p, nm));
  const white = !mono(p);
  // trecho incidente (comum a todas as cores)
  const inc = rays[0]?.segs[0];
  if (inc) d.line(inc.a[0], inc.a[1], inc.b[0], inc.b[1], { color: white ? whiteRay(d) : rayColor(d, p, rays[0]!.nm), width: 3 });
  for (const r of rays) {
    for (const g of r.segs.slice(1)) d.line(g.a[0], g.a[1], g.b[0], g.b[1], { color: rayColor(d, p, r.nm), width: white ? 1.4 : 2.5, alpha: white ? 0.85 : 1 });
  }
  // espectro na tela, ampliado
  const hits = rays.filter((r) => r.yScreen !== null);
  if (hits.length > 1) {
    const ys = hits.map((r) => r.yScreen!);
    const lo = Math.min(...ys);
    const hi = Math.max(...ys);
    const mid = (lo + hi) / 2;
    const k = hi - lo > 1e-9 ? Math.min(40, 1.4 / (hi - lo)) : 1;
    for (const r of hits) {
      const y = Math.max(VP_PRISM.yMin + 0.2, Math.min(VP_PRISM.yMax - 0.2, mid + (r.yScreen! - mid) * k));
      d.line(SCREEN_X + 0.15, y, SCREEN_X + 0.55, y, { color: rayColor(d, p, r.nm), width: 5 });
    }
    d.text(`espectro (ampliado ${fmt(k, 0)}×)`, SCREEN_X + 0.35, mid - (0.7 + 0.25), { color: theme.muted, size: 10 });
  }

  // fonte
  const u = vdir(s.ang);
  d.box(s.sx - u[0] * SRC_L * 0.5, s.sy - u[1] * SRC_L * 0.5, SRC_L, SRC_L * 0.36, s.ang, { fill: theme.muted, stroke: theme.text, width: 1 });
  const hx = s.sx - u[0] * SRC_L * 1.2;
  const hy = s.sy - u[1] * SRC_L * 1.2;
  d.line(s.sx - u[0] * SRC_L, s.sy - u[1] * SRC_L, hx, hy, { color: theme.muted, dash: [3, 3], width: 1 });
  d.circle(hx, hy, 0, { minPx: 6, fill: theme.accent, stroke: theme.text, width: 1 });

  // gráfico δ(θ1)
  const A = rad(num(p, "A", 60));
  const nv = nOf(p, 400);
  const nr = nOf(p, 700);
  const dminR = deg(minDeviation(nr, A));
  const dminV = deg(minDeviation(nv, A));
  if (Number.isFinite(dminR) && Number.isFinite(dminV)) {
    const yr: [number, number] = [Math.floor(dminR - 3), Math.ceil(dminV + 30)];
    const { X, Y } = miniPlot(
      d,
      { x0: -3.55, x1: -1.35, y0: 0.75, y1: 2.05 },
      [0, 90],
      yr,
      [
        { f: (x) => deg(prismDeviation(nr, A, rad(x))), color: wavelengthRGB(680) },
        { f: (x) => deg(prismDeviation(nv, A, rad(x))), color: wavelengthRGB(420) },
      ],
      { x: "θ₁ (°)", y: "δ", title: "desvio × incidência" },
    );
    const lr = lambdaRef(p);
    const r = rays.find((q) => q.nm === lr) ?? tracePrism(s, p, lr);
    if (Number.isFinite(r.dev) && Number.isFinite(r.thi) && r.dev >= yr[0] && r.dev <= yr[1]) d.dot(X(r.thi), Y(r.dev), 4, theme.text);
    const dm = deg(minDeviation(nOf(p, lr), A));
    d.dot(X(deg(minDeviationIncidence(nOf(p, lr), A))), Y(dm), 3, theme.positive);
  }
  const o = observe(s, p);
  d.text(
    `θ₁ = ${fmt(o.thi)}°  δ(${fmt(lambdaRef(p), 0)} nm) = ${fmt(o.dev)}°  δmin = ${fmt(o.dmin)}°  n(589) = ${n0.toFixed(4).replace(".", ",")}`,
    VP_PRISM.xMin + 0.1,
    VP_PRISM.yMin + 0.1,
    { align: "left", baseline: "bottom", color: theme.text, size: 12, weight: "600" },
  );
  d.text("arraste a fonte · o círculo gira", VP_PRISM.xMin + 0.1, VP_PRISM.yMin + 0.45, { align: "left", baseline: "bottom", color: theme.muted, size: 11 });
}

function renderDrop(d: Draw, s: PrismState, p: Params) {
  const { theme } = d;
  d.circle(0, 0, 1, { fill: theme.dark ? "rgba(91,156,240,0.16)" : "rgba(47,125,225,0.10)", stroke: theme.text, width: 1.5 });
  d.text(material(p).label, 0, -1, { dy: 14, color: theme.muted, size: 11 });
  d.text("luz do Sol →", VP_DROP.xMin + 0.1, 2.4, { align: "left", color: theme.text, size: 11 });
  const beam = num(p, "feixe") >= 0.5;
  const lams = beam ? [lambdaRef(p)] : wavelengths(p);
  const bs = beam ? Array.from({ length: 41 }, (_, i) => -0.975 + (1.95 * i) / 40) : [s.b];
  const ordColor = (k: number, nm: number) => (k === 1 || k === 2 || beam ? wavelengthRGB(nm) : theme.muted);
  for (const b of bs) {
    for (const nm of lams) {
      for (const g of traceDrop(p, nm, b)) {
        const exitK = g.refr === 2 ? g.refl : -1;
        const inc = g.depth === 0;
        if (inc) {
          d.line(g.a[0], g.a[1], g.b[0], g.b[1], { color: lams.length > 1 ? whiteRay(d) : wavelengthRGB(nm), width: beam ? 1 : 2.5, alpha: beam ? 0.4 : 1 });
          continue;
        }
        let alpha = 0.25;
        let width = 1;
        if (exitK === 1 || exitK === 2) {
          alpha = beam ? 0.45 : 0.95;
          width = beam ? 1 : 1.8;
        } else if (g.refr === 1) {
          alpha = g.refl <= 2 ? (beam ? 0.25 : 0.7) : 0;
        } else alpha = beam ? 0.08 : 0.25;
        if (alpha > 0) d.line(g.a[0], g.a[1], g.b[0], g.b[1], { color: ordColor(exitK, nm), width, alpha });
      }
    }
  }
  if (!beam) {
    // alça e rótulos das ordens
    d.circle(HANDLE_X, s.b, 0, { minPx: 7, fill: theme.accent, stroke: theme.text, width: 1 });
    d.text("arraste", HANDLE_X, s.b, { dy: -14, color: theme.muted, size: 10 });
    const n = nOf(p, lambdaRef(p));
    const b = Math.abs(s.b);
    const sg = s.b >= 0 ? 1 : -1;
    for (const k of [1, 2]) {
      const D = dropDeviation(n, b, k);
      const ang = -sg * D;
      const phi = deg(bowAngle(n, b, k));
      const r = 2.25;
      d.text(`${k === 1 ? "1 reflexão" : "2 reflexões"}: φ = ${fmt(phi)}°`, r * Math.cos(ang), r * Math.sin(ang), { color: theme.text, size: 11, weight: "600" });
    }
  }
  // gráfico φ(b)
  const nr = nOf(p, 700);
  const nv = nOf(p, 400);
  const { X, Y } = miniPlot(
    d,
    { x0: 1.45, x1: 3.05, y0: 1.05, y1: 2.35 },
    [0, 1],
    [0, 70],
    [
      { f: (b) => deg(bowAngle(nr, b, 1)), color: wavelengthRGB(680) },
      { f: (b) => deg(bowAngle(nv, b, 1)), color: wavelengthRGB(420) },
      { f: (b) => deg(bowAngle(nr, b, 2)), color: wavelengthRGB(680), dash: [4, 3] },
      { f: (b) => deg(bowAngle(nv, b, 2)), color: wavelengthRGB(420), dash: [4, 3] },
    ],
    { x: "b", y: "φ", title: "φ × b (— 1 refl., - - 2 refl.)" },
  );
  for (const k of [1, 2]) {
    const ph = deg(rainbowAngle(nOf(p, 589), k));
    d.line(X(0), Y(ph), X(1), Y(ph), { color: theme.muted, dash: [2, 3], width: 1 });
    d.text(`${fmt(ph, 0)}°`, X(1), Y(ph), { dx: 3, align: "left", color: theme.muted, size: 9 });
  }
  if (!beam) d.line(X(Math.abs(s.b)), Y(0), X(Math.abs(s.b)), Y(70), { color: theme.text, width: 1 });
  const o = observe(s, p);
  d.text(
    `arco primário φ₁ = ${fmt(o.dmin, 2)}°  secundário φ₂ = ${fmt(o.phi2, 2)}°  (λ = ${fmt(lambdaRef(p), 0)} nm)`,
    VP_DROP.xMin + 0.1,
    VP_DROP.yMin + 0.1,
    { align: "left", baseline: "bottom", color: theme.text, size: 12, weight: "600" },
  );
}

function renderSky(d: Draw, p: Params) {
  const { theme } = d;
  const sol = num(p, "sol", 20);
  const cy = -sol;
  const sky = theme.dark ? "#1b2433" : "#dce9f7";
  d.rect(VP_SKY.xMin, 0, VP_SKY.xMax - VP_SKY.xMin, VP_SKY.yMax, { fill: sky });
  const circ = (r: number): [number, number][] => Array.from({ length: 121 }, (_, i) => [r * Math.cos((i / 120) * Math.PI), cy + r * Math.sin((i / 120) * Math.PI)]);
  const r1 = deg(rainbowAngle(nOf(p, 700), 1));
  const r2 = deg(rainbowAngle(nOf(p, 700), 2));
  // faixa escura de Alexandre entre os arcos; céu mais claro dentro do primário
  const disk = (r: number): [number, number][] => [...circ(r), [-r, cy]];
  d.polyline(disk(r2), { color: "none", fill: theme.dark ? "rgba(0,0,0,0.35)" : "rgba(60,70,90,0.22)", close: true });
  d.polyline(disk(r1), { color: "none", fill: sky, close: true });
  d.polyline(disk(r1), { color: "none", fill: theme.dark ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.55)", close: true });
  for (let nm = 400; nm <= 700; nm += 5) {
    d.polyline(circ(deg(rainbowAngle(nOf(p, nm), 1))), { color: wavelengthRGB(nm), width: 4, alpha: 0.9 });
    d.polyline(circ(deg(rainbowAngle(nOf(p, nm), 2))), { color: wavelengthRGB(nm), width: 4, alpha: 0.45 });
  }
  // chão
  d.rect(VP_SKY.xMin, VP_SKY.yMin, VP_SKY.xMax - VP_SKY.xMin, -VP_SKY.yMin, { fill: theme.dark ? "#1e2620" : "#e3ecdc" });
  d.rect(VP_SKY.xMin, VP_SKY.yMin, VP_SKY.xMax - VP_SKY.xMin, -VP_SKY.yMin, { fill: theme.ground });
  d.line(VP_SKY.xMin, 0, VP_SKY.xMax, 0, { color: theme.text, width: 1.5 });
  d.text("horizonte", VP_SKY.xMax - 2, 0, { dy: -8, align: "right", color: theme.muted, size: 11 });
  d.dot(0, Math.max(cy, VP_SKY.yMin + 1), 4, theme.text);
  d.text(`ponto antissolar (${fmt(-cy, 0)}° abaixo do horizonte)`, 0, Math.max(cy, VP_SKY.yMin + 1), { dy: -12, color: theme.text, size: 10 });
  {
    const ex = -r1 * Math.cos(rad(65));
    const ey = cy + r1 * Math.sin(rad(65));
    d.line(0, cy, ex, ey, { color: theme.text, dash: [3, 3], width: 1 });
    if (ey > 3) d.text(`raio ${fmt(r1, 1)}°`, ex, ey, { dx: 6, dy: 10, align: "left", color: theme.text, size: 11, weight: "600" });
  }
  d.text(`Sol atrás do observador, ${fmt(sol, 0)}° acima do horizonte`, VP_SKY.xMin + 2, VP_SKY.yMax - 2, { align: "left", baseline: "top", color: theme.text, size: 12, weight: "600" });
  d.text("eixos em graus de ângulo visual", VP_SKY.xMin + 2, VP_SKY.yMax - 2, { dy: 16, align: "left", baseline: "top", color: theme.muted, size: 11 });
  if (sol > r1) d.text("Sol alto demais: o arco primário está todo abaixo do horizonte", 0, 30, { color: theme.positive, size: 12, weight: "600" });
  else d.text("faixa escura de Alexandre", 0, cy + (r1 + r2) / 2, { color: theme.text, size: 10 });
}

export default prisma;
