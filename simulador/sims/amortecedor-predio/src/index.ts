import { clamp, defineSim, draw, num, texNum, type Draw, type Params } from "@fisilab/core";
import {
  EXC,
  QUAKE_T,
  buildingModes,
  currentFreq,
  floorMass,
  groundAcc,
  harmonicAmplitude,
  nFloors,
  rhs,
  storyK,
  system,
  tmd,
  type Linear,
  type Modes,
  type Tmd,
} from "./model.ts";

export * from "./model.ts";

/** Altura de cada andar no desenho (m). */
const STORY_H = 3.5;
const WIDTH = 8;
const XA = 5, XB = 19;

export interface BState {
  /** Prédio A (sem TMD): [x₁..xₙ, v₁..vₙ], relativos ao solo. */
  a: number[];
  /** Prédio B (com TMD): [x₁..xₙ, x_d, v₁..vₙ, v_d]. */
  b: number[];
  peakA: number;
  peakB: number;
  peakD: number;
}

interface Cache {
  key: string;
  A: Linear;
  B: Linear;
  modes: Modes;
  tmd: Tmd;
  /** Curvas de resposta em frequência do topo (m) para a amplitude atual. */
  fr: { f: number[]; A: number[]; B: number[]; max: number };
}
let cache: Cache | null = null;

const KEYS = ["n", "m", "k", "zeta", "mu", "ajuste", "razao", "zetad", "ag"];
/** Sistemas, modos e curvas de resposta (memorizados pelos parâmetros estruturais). */
export function model(p: Params): Cache {
  const key = KEYS.map((k) => num(p, k)).join("|");
  if (cache && cache.key === key) return cache;
  const A = system(p, false), B = system(p, true);
  const modes = buildingModes(p);
  const n = nFloors(p), ag = num(p, "ag", 1);
  const f: number[] = [], ra: number[] = [], rb: number[] = [];
  for (let i = 0; i <= 160; i++) {
    const fi = 0.1 * 100 ** (i / 160);
    f.push(fi);
    ra.push(harmonicAmplitude(A, 2 * Math.PI * fi, ag)[n - 1]!);
    rb.push(harmonicAmplitude(B, 2 * Math.PI * fi, ag)[n - 1]!);
  }
  cache = { key, A, B, modes, tmd: tmd(p, modes), fr: { f, A: ra, B: rb, max: Math.max(...ra, ...rb) } };
  return cache;
}

function rk4(sys: Linear, y: number[], p: Params, t: number, h: number): number[] {
  const f = (q: number[], tt: number) => rhs(sys, q, groundAcc(p, tt));
  const k1 = f(y, t);
  const k2 = f(y.map((v, i) => v + (h / 2) * k1[i]!), t + h / 2);
  const k3 = f(y.map((v, i) => v + (h / 2) * k2[i]!), t + h / 2);
  const k4 = f(y.map((v, i) => v + h * k3[i]!), t + h);
  return y.map((v, i) => v + (h / 6) * (k1[i]! + 2 * k2[i]! + 2 * k3[i]! + k4[i]!));
}

const topA = (s: BState) => s.a[s.a.length / 2 - 1] ?? 0;
const topB = (s: BState) => s.b[s.b.length / 2 - 2] ?? 0;
const strokeD = (s: BState) => (s.b[s.b.length / 2 - 1] ?? 0) - topB(s);
const fmt = (v: number, d = 3) => Number(v.toPrecision(d)).toString().replace(".", ",");
const cm = (v: number) => v * 100;

/** Resposta em regime (m) do topo para a frequência f (Hz). */
export function steadyTop(p: Params, f: number, withTmd: boolean): number {
  const c = model(p);
  return harmonicAmplitude(withTmd ? c.B : c.A, 2 * Math.PI * f, num(p, "ag", 1))[nFloors(p) - 1]!;
}

export const amortecedorPredio = defineSim<BState>({
  id: "amortecedor-predio",
  title: "Prédios, terremotos e amortecedor de massa sintonizada",
  course: "FG II",
  topic: "Oscilações",
  priority: "P2",
  summary:
    "Dois prédios idênticos de n andares (massas e molas de cisalhamento) lado a lado sob o mesmo terremoto: um sem e outro com amortecedor de massa sintonizada no topo. Veja modos, resposta em frequência e o deslocamento do topo cair na ressonância.",
  equations: [
    String.raw`M\ddot{\vec x} + C\dot{\vec x} + K\vec x = -M\,\vec 1\,a_g(t)`,
    String.raw`\det(K - \omega^2 M) = 0 \;\Rightarrow\; \omega_1, \omega_2, \dots \qquad C = \alpha M + \beta K`,
    String.raw`\text{TMD: } m_d = \mu M_1,\quad \frac{f_d}{f_1} = \frac{1}{1+\mu},\quad \zeta_d = \sqrt{\frac{3\mu}{8(1+\mu)^3}}\ \text{(Den Hartog)}`,
  ],
  liveEquations(s, p, t) {
    const c = model(p);
    const f1 = c.modes.omega[0]! / (2 * Math.PI);
    const out = [
      String.raw`f_1 = ${texNum(f1)}\ \text{Hz}${c.modes.omega[1] ? String.raw`,\ f_2 = ${texNum(c.modes.omega[1] / (2 * Math.PI))}\ \text{Hz}` : ""} \quad m_d = ${texNum(c.tmd.md / 1000)}\ \text{t},\ f_d = ${texNum(c.tmd.fd)}\ \text{Hz},\ \zeta_d = ${texNum(c.tmd.zd * 100)}\%`,
      String.raw`x_{\text{topo}}^{\text{sem}} = ${texNum(cm(topA(s)))}\ \text{cm} \quad x_{\text{topo}}^{\text{com}} = ${texNum(cm(topB(s)))}\ \text{cm} \quad \text{pico: } ${texNum(cm(s.peakA))} \to ${texNum(cm(s.peakB))}\ \text{cm}`,
    ];
    const f = currentFreq(p, t);
    if (f > 0) out.push(String.raw`f = ${texNum(f)}\ \text{Hz:}\quad X_{\text{regime}}^{\text{sem}} = ${texNum(cm(steadyTop(p, f, false)))}\ \text{cm},\ X_{\text{regime}}^{\text{com}} = ${texNum(cm(steadyTop(p, f, true)))}\ \text{cm}`);
    return out;
  },

  params: [
    { key: "n", label: "Número de andares", unit: "", min: 1, max: 10, step: 1, default: 5 },
    { key: "m", label: "Massa de cada andar", unit: "t", min: 20, max: 500, step: 10, default: 100 },
    { key: "k", label: "Rigidez de cada andar", unit: "MN/m", min: 10, max: 500, step: 5, default: 100 },
    { key: "zeta", label: "Amortecimento estrutural ζ", unit: "%", min: 0.5, max: 10, step: 0.1, default: 2 },
    { key: "exc", label: "Excitação do solo", unit: "", min: 0, max: 2, step: 1, default: 0, options: EXC.map((label, value) => ({ value, label })) },
    { key: "f", label: "Frequência do solo (senoidal)", unit: "Hz", min: 0.1, max: 10, step: 0.01, default: 1.43, log: true, live: true },
    { key: "ag", label: "Aceleração máxima do solo", unit: "m/s²", min: 0.1, max: 5, step: 0.05, default: 0.5 },
    { key: "seed", label: "Registro sintético nº", unit: "", min: 1, max: 20, step: 1, default: 1 },
    { key: "mu", label: "Razão de massa do TMD μ", unit: "%", min: 0.5, max: 10, step: 0.1, default: 3 },
    {
      key: "ajuste",
      label: "Sintonia do TMD",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 0,
      options: [
        { value: 0, label: "Ótima (Den Hartog)" },
        { value: 1, label: "Manual" },
      ],
    },
    { key: "razao", label: "Manual: f_d / f₁", unit: "", min: 0.5, max: 1.5, step: 0.01, default: 1 },
    { key: "zetad", label: "Manual: amortecimento do TMD ζ_d", unit: "%", min: 0, max: 40, step: 0.5, default: 10 },
  ],

  observables: [
    { key: "xA", label: "Topo sem TMD", unit: "cm", value: (s) => cm(topA(s)) },
    { key: "xB", label: "Topo com TMD", unit: "cm", value: (s) => cm(topB(s)) },
    { key: "picoA", label: "Pico do topo sem TMD", unit: "cm", value: (s) => cm(s.peakA) },
    { key: "picoB", label: "Pico do topo com TMD", unit: "cm", value: (s) => cm(s.peakB) },
    { key: "reducao", label: "Redução do pico", unit: "%", value: (s) => (s.peakA > 1e-9 ? (1 - s.peakB / s.peakA) * 100 : 0) },
    { key: "curso", label: "Curso do TMD (relativo ao topo)", unit: "cm", value: (s) => cm(strokeD(s)) },
    { key: "ag", label: "Aceleração do solo", unit: "m/s²", value: (_s, p, t) => groundAcc(p, t) },
    { key: "f", label: "Frequência atual do solo", unit: "Hz", value: (_s, p, t) => currentFreq(p, t) },
    { key: "f1", label: "1º modo f₁", unit: "Hz", value: (_s, p) => model(p).modes.omega[0]! / (2 * Math.PI) },
    { key: "f2", label: "2º modo f₂", unit: "Hz", value: (_s, p) => (model(p).modes.omega[1] ?? 0) / (2 * Math.PI) },
    { key: "fd", label: "Frequência do TMD f_d", unit: "Hz", value: (_s, p) => model(p).tmd.fd },
    {
      key: "drift",
      label: "Maior deslocamento entre andares (sem TMD)",
      unit: "cm",
      value: (s) => {
        const n = s.a.length / 2;
        let mx = 0;
        for (let i = 0; i < n; i++) mx = Math.max(mx, Math.abs(s.a[i]! - (i > 0 ? s.a[i - 1]! : 0)));
        return cm(mx);
      },
    },
  ],
  chart: { x: "t", y: "xA" },

  scenarios: [
    {
      id: "ressonancia",
      label: "Ressonância no 1º modo",
      params: { n: 5, exc: 0, f: 1.43, ag: 0.5, mu: 3, ajuste: 0 },
      guide: `### Terremoto na frequência do prédio
1. A frequência do solo está em $f_1$ do prédio de 5 andares. Observe o prédio da esquerda (sem TMD) crescer até o regime.
2. Compare os **picos** do topo: o TMD (prédio da direita) reduz a resposta várias vezes.
3. No gráfico de resposta em frequência, o pico único do prédio sem TMD vira **dois picos baixos** com TMD.
4. Mude a frequência para $f_2$ (leia em $f_2$): o TMD sintonizado no 1º modo ajuda pouco.`,
      predict: [
        {
          question: "Um TMD com só 3% da massa modal, sintonizado no 1º modo, faz o deslocamento do topo na ressonância:",
          options: ["cair só uns 3%", "cair várias vezes", "aumentar"],
          answer: 1,
          explanation: "A massa pequena oscila com grande amplitude em oposição de fase ao topo e o amortecedor dela dissipa energia: o pico de ressonância é dividido em dois picos bem mais baixos.",
        },
      ],
    },
    {
      id: "varredura",
      label: "Varredura de frequência",
      params: { n: 5, exc: 1, ag: 0.3, mu: 3, ajuste: 0 },
      guide: `### Encontrando os modos
1. A frequência do solo sobe de 0,2 Hz a 5 Hz em 60 s (escala logarítmica).
2. Plote **Topo sem TMD** contra o tempo: os máximos aparecem quando $f$ passa por $f_1$, $f_2$, $f_3$...
3. Compare com as **formas modais** desenhadas: no 2º modo o topo e o meio do prédio se movem em sentidos opostos.`,
    },
    {
      id: "terremoto",
      label: "Terremoto sintético",
      params: { n: 8, exc: 2, ag: 2, seed: 3, mu: 4, ajuste: 0 },
      guide: `### Registro de banda larga
1. O sinal tem muitas frequências (espectro de Kanai–Tajimi) e uma envoltória que cresce, fica forte e decai.
2. Compare os picos: o TMD reduz menos que na senoidal, porque o registro é curto e de banda larga.
3. Troque o **registro sintético nº** e o número de andares. Qual prédio sofre mais?`,
    },
    {
      id: "dessintonizado",
      label: "TMD dessintonizado",
      params: { n: 5, exc: 0, f: 1.43, ag: 0.5, mu: 3, ajuste: 1, razao: 0.7, zetad: 10 },
      guide: `### A sintonia importa
1. Com $f_d/f_1 = 0{,}7$ o amortecedor quase não ajuda na ressonância.
2. Ajuste $f_d/f_1$ até minimizar o pico e compare com $1/(1+\\mu)$.
3. Zere $\\zeta_d$: aparece uma antirressonância exatamente em $f_d$, mas dois picos altos ao lado.`,
      predict: [
        {
          question: "Com o TMD sintonizado em 0,7 f₁, a redução na ressonância será:",
          options: ["maior que com a sintonia ótima", "parecida", "bem menor"],
          answer: 2,
          explanation: "Longe de $f_1$, a massa do TMD não entra em ressonância com o topo e não gera força de oposição significativa.",
        },
      ],
    },
  ],

  exercises: [
    {
      id: "um-andar",
      prompt: "Um prédio de um andar tem massa de {m} t e rigidez lateral de {k} MN/m. Qual é a sua frequência natural?",
      vary: { m: [50, 400, 0], k: [20, 400, 0] },
      fixed: { n: 1 },
      answer: { label: "f", unit: "Hz", compute: (p) => Math.sqrt(storyK(p) / floorMass(p)) / (2 * Math.PI) },
      tolerance: 0.01,
    },
    {
      id: "den-hartog",
      prompt: "O 1º modo de um prédio tem frequência {f} Hz. Um TMD terá razão de massa μ = {mu} %. Pela regra de Den Hartog, em que frequência ele deve ser sintonizado?",
      vary: { f: [0.2, 3, 2], mu: [1, 8, 1] },
      answer: { label: "f_d", unit: "Hz", compute: (p) => num(p, "f") / (1 + num(p, "mu") / 100) },
      tolerance: 0.01,
      hint: "f_d = f₁/(1 + μ).",
    },
  ],

  init(p): BState {
    const n = nFloors(p);
    return { a: new Array(2 * n).fill(0), b: new Array(2 * (n + 1)).fill(0), peakA: 0, peakB: 0, peakD: 0 };
  },
  step(s, p, t, dt): BState {
    const c = model(p);
    const a = rk4(c.A, s.a, p, t, dt);
    const b = rk4(c.B, s.b, p, t, dt);
    const next: BState = { a, b, peakA: s.peakA, peakB: s.peakB, peakD: s.peakD };
    next.peakA = Math.max(s.peakA, Math.abs(topA(next)));
    next.peakB = Math.max(s.peakB, Math.abs(topB(next)));
    next.peakD = Math.max(s.peakD, Math.abs(strokeD(next)));
    return next;
  },
  dt: 2e-3,
  sampleEvery: 10,
  tEnd: 120,

  viewport() {
    return { xMin: -2, xMax: 57, yMin: -5, yMax: 41, unit: "" };
  },

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const { state: s, params: p, theme, t } = frame;
    const c = model(p);
    const n = nFloors(p);
    const H = n * STORY_H;
    // Fator de ampliação fixo: o maior regime ressonante ocupa ~12% da altura.
    const E = clamp((0.12 * 35) / Math.max(c.fr.max, 1e-6), 1, 5000);
    const Eshow = Number(E.toPrecision(2));
    const ag = groundAcc(p, t);
    // Solo
    d.rect(-2, -3, 31, 3, { fill: theme.ground });
    d.line(-2, 0, 29, 0, { color: theme.muted, width: 1.5 });
    d.arrowPx(XB - 6.5, -1.5, Math.sign(ag), 0, clamp((Math.abs(ag) / Math.max(num(p, "ag", 1), 1e-9)) * 50, 0, 50), { color: theme.negative });
    d.text(`a_g = ${fmt(ag, 2)} m/s²`, XB - 6.5, -4, { color: theme.negative, size: 11 });

    const building = (x0: number, y: number[], nDof: number, withTmd: boolean, label: string, color: string) => {
      const xs = [0, ...y.slice(0, n)].map((v) => v * E);
      // Pilares
      for (const side of [-1, 1]) {
        const pts: [number, number][] = xs.map((dx, i) => [x0 + (side * WIDTH) / 2 + dx, i * STORY_H]);
        d.polyline(pts, { color: theme.text, width: 2.5 });
      }
      for (let i = 1; i <= n; i++) {
        d.rect(x0 - WIDTH / 2 + xs[i]!, i * STORY_H - 0.35, WIDTH, 0.7, { fill: color, stroke: theme.text, width: 1 });
      }
      d.text(label, x0, -1.6, { color: theme.text, size: 12, weight: "600" });
      if (withTmd) {
        const xd = y[nDof - 1]! * E;
        const top = xs[n]!;
        const yT = H + 1.3;
        d.line(x0 - WIDTH / 2 + top, H + 0.35, x0 + WIDTH / 2 + top, H + 0.35, { color: theme.muted });
        d.spring(x0 - WIDTH / 2 + top + 0.2, yT, x0 + xd - 1.1, yT, { color: theme.muted, coils: 6, amplitudePx: 4 });
        d.rect(x0 + xd - 1.1, H + 0.5, 2.2, 1.6, { fill: theme.series[1]!, stroke: theme.text, width: 1 });
        d.text("TMD", x0 + xd, yT, { color: theme.dark ? "#111" : "#fff", size: 10, weight: "600" });
      }
      // Topo: valor numérico
      d.text(`${fmt(cm(y[n - 1]!), 3)} cm`, x0 + xs[n]!, H + (withTmd ? 3.2 : 1.6), { color: theme.accent, size: 12 });
    };
    building(XA, s.a, s.a.length / 2, false, "Sem TMD", theme.series[0]!);
    building(XB, s.b, s.b.length / 2, true, "Com TMD", theme.series[2]!);
    d.text(`deslocamentos ampliados ×${fmt(Eshow, 2)}`, 12, 39.5, { color: theme.muted, size: 11 });
    d.text(`picos: ${fmt(cm(s.peakA))} cm → ${fmt(cm(s.peakB))} cm`, 12, 37.5, { color: theme.text, size: 12 });
    if (Math.round(num(p, "exc")) === 2 && t > QUAKE_T) d.text("fim do registro", 12, 35.5, { color: theme.muted, size: 11 });

    drawResponse(d, p, c, currentFreq(p, t));
    drawModes(d, c, n);
  },
});

/** Painel da resposta em frequência do topo (sem e com TMD), eixo de frequência logarítmico. */
function drawResponse(d: Draw, p: Params, c: Cache, fNow: number) {
  const { theme } = d;
  const x0 = 34, x1 = 56, y0 = 20, y1 = 38;
  const X = (f: number) => x0 + ((Math.log10(f) + 1) / 2) * (x1 - x0);
  const Y = (v: number) => y0 + Math.min(v / (1.08 * c.fr.max), 1) * (y1 - y0);
  d.rect(x0, y0, x1 - x0, y1 - y0, { stroke: theme.grid, width: 1 });
  for (const f of [0.1, 0.2, 0.5, 1, 2, 5, 10]) {
    d.line(X(f), y0, X(f), y1, { color: theme.grid, width: 1 });
    d.text(String(f).replace(".", ","), X(f), y0, { color: theme.muted, size: 10, dy: 10 });
  }
  d.text("f (Hz)", (x0 + x1) / 2, y0 - 2.3, { color: theme.muted, size: 11 });
  d.text("amplitude do topo em regime", (x0 + x1) / 2, y1 + 1.2, { color: theme.text, size: 12 });
  d.text(`máx. ${fmt(cm(c.fr.max))} cm`, x0 + 0.3, y1 - 0.9, { color: theme.muted, size: 10, align: "left" });
  d.polyline(c.fr.f.map((f, i) => [X(f), Y(c.fr.A[i]!)] as [number, number]), { color: theme.series[0]!, width: 2 });
  d.polyline(c.fr.f.map((f, i) => [X(f), Y(c.fr.B[i]!)] as [number, number]), { color: theme.series[2]!, width: 2 });
  for (const w of c.modes.omega) {
    const f = w / (2 * Math.PI);
    if (f >= 0.1 && f <= 10) d.line(X(f), y0, X(f), y0 + 0.8, { color: theme.text, width: 1.5 });
  }
  if (fNow > 0) {
    d.line(X(fNow), y0, X(fNow), y1, { color: theme.negative, width: 1.5, dash: [4, 3] });
    d.dot(X(fNow), Y(steadyTop(p, fNow, false)), 4, theme.series[0]!);
    d.dot(X(fNow), Y(steadyTop(p, fNow, true)), 4, theme.series[2]!);
  }
  d.text("sem TMD", x1 - 0.3, y1 - 0.9, { color: theme.series[0]!, size: 11, align: "right" });
  d.text("com TMD", x1 - 0.3, y1 - 2.4, { color: theme.series[2]!, size: 11, align: "right" });
}

/** Formas dos três primeiros modos (sem TMD). */
function drawModes(d: Draw, c: Cache, n: number) {
  const { theme } = d;
  const k = Math.min(3, n);
  const x0 = 34, w = 22 / k, y0 = 1, h = 13;
  d.text("modos de vibração (sem TMD)", 45, y0 + h + 2.2, { color: theme.text, size: 12 });
  for (let j = 0; j < k; j++) {
    const cx = x0 + w * (j + 0.5);
    const sh = c.modes.shapes[j]!;
    const mx = Math.max(...sh.map(Math.abs));
    d.line(cx, y0, cx, y0 + h, { color: theme.grid, dash: [3, 3] });
    const pts: [number, number][] = [[cx, y0], ...sh.map((v, i) => [cx + (v / mx) * w * 0.38, y0 + (h * (i + 1)) / n] as [number, number])];
    d.polyline(pts, { color: theme.series[j % 6]!, width: 2 });
    pts.slice(1).forEach(([x, y]) => d.dot(x, y, 3.5, theme.series[j % 6]!));
    d.text(`f${j + 1} = ${fmt(c.modes.omega[j]! / (2 * Math.PI))} Hz`, cx, y0 - 1.2, { color: theme.muted, size: 11 });
  }
}

export default amortecedorPredio;
