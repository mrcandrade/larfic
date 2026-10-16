import { defineSim, draw, num, texNum, type Params, type State } from "@fisilab/core";

// Estado: [y = alongamento total do conjunto de molas (m, para baixo), v (m/s)]
const Y = 0, V = 1;
/** Comprimento natural de cada mola (m). */
export const L0 = 0.15;
/** Altura do suporte de massas abaixo da ponta da mola até o ponteiro (m). */
const HOOK = 0.03;

export const arranjo = (p: Params) => Math.round(num(p, "arranjo"));

/** Constante elástica efetiva do arranjo. */
export function kEff(p: Params): number {
  const k1 = num(p, "k1", 20), k2 = num(p, "k2", 20);
  const a = arranjo(p);
  if (a === 1) return (k1 * k2) / (k1 + k2);
  if (a === 2) return k1 + k2;
  return k1;
}

/** Comprimento natural do conjunto (série tem duas molas em fila). */
export const naturalLength = (p: Params) => (arranjo(p) === 1 ? 2 * L0 : L0);

/** Massa inercial efetiva: massa pendurada + 1/3 da massa das molas. */
const nMolas = (p: Params) => (arranjo(p) === 0 ? 1 : 2);
export const mEff = (p: Params) => num(p, "m", 0.1) + (nMolas(p) * num(p, "ms")) / 3;

/** Alongamento de equilíbrio: peso pendurado + metade do peso das molas, dividido por k. */
export function yEq(p: Params): number {
  const g = num(p, "g", 9.79);
  return ((num(p, "m", 0.1) + (nMolas(p) * num(p, "ms")) / 2) * g) / kEff(p);
}

/** Período das oscilações amortecidas (0 se superamortecido). */
export function period(p: Params): number {
  const me = mEff(p);
  const w0 = Math.sqrt(kEff(p) / me);
  const gam = num(p, "b") / (2 * me);
  return gam < w0 ? (2 * Math.PI) / Math.sqrt(w0 * w0 - gam * gam) : 0;
}

/** Alongamento de cada mola (na série, a força é a mesma: y_i = F/k_i). */
function springStretch(y: number, p: Params): [number, number] {
  const k1 = num(p, "k1", 20), k2 = num(p, "k2", 20);
  const a = arranjo(p);
  if (a === 1) {
    const F = kEff(p) * y;
    return [F / k1, F / k2];
  }
  return [y, y];
}

function viewportOf(p: Params) {
  const depth = naturalLength(p) + HOOK + Math.max(yEq(p) + 0.08, 0.1) + 0.12;
  const h = Math.max(0.6, depth + 0.1);
  return { xMin: -0.45 * h, xMax: 0.65 * h, yMin: -depth, yMax: 0.08 * h };
}

const fmt = (v: number, dec: number) => v.toFixed(dec).replace(".", ",");

/** Leitura da régua (zero no ponto de suspensão) no ponteiro do suporte de massas. */
export const reading = (y: number, p: Params) => naturalLength(p) + y + HOOK;

export const leiHooke = defineSim({
  id: "lei-hooke",
  title: "Lei de Hooke: molas em série e em paralelo",
  course: "Exp I",
  topic: "Forças",
  priority: "P1",
  summary:
    "Pendure massas numa mola, em duas molas em série ou em paralelo e leia o alongamento numa régua milimetrada com lupa. A oscilação amortecida acaba no equilíbrio, onde o peso mg é igual a k·Δy.",
  equations: [
    String.raw`F = k\,\Delta y \qquad \Delta y_{eq} = \frac{m g}{k_{ef}}`,
    String.raw`\frac{1}{k_s} = \frac{1}{k_1} + \frac{1}{k_2} \qquad k_p = k_1 + k_2`,
    String.raw`\left(m + \tfrac{m_s}{3}\right)\ddot y = \left(m + \tfrac{m_s}{2}\right)g - k_{ef}\,y - b\,\dot y`,
  ],
  liveEquations(s, p) {
    const k = kEff(p), m = num(p, "m", 0.1), g = num(p, "g", 9.79);
    return [
      String.raw`k_{ef} = ${texNum(k, 4)}\ \text{N/m} \qquad mg = ${texNum(m * g, 4)}\ \text{N} \qquad \Delta y_{eq} = ${texNum(yEq(p), 4)}\ \text{m}`,
      String.raw`\Delta y = ${texNum(s[Y]!, 4)}\ \text{m} \qquad k_{ef}\,\Delta y = ${texNum(k * s[Y]!, 4)}\ \text{N}`,
    ];
  },

  params: [
    {
      key: "arranjo",
      label: "Arranjo",
      unit: "",
      min: 0,
      max: 2,
      step: 1,
      default: 0,
      options: [
        { value: 0, label: "Uma mola (k₁)" },
        { value: 1, label: "Duas molas em série" },
        { value: 2, label: "Duas molas em paralelo" },
      ],
    },
    { key: "m", label: "Massa pendurada", unit: "kg", min: 0.01, max: 0.5, step: 0.005, default: 0.1, live: true },
    { key: "k1", label: "Constante da mola 1 (k₁)", unit: "N/m", min: 10, max: 100, step: 0.5, default: 20 },
    { key: "k2", label: "Constante da mola 2 (k₂)", unit: "N/m", min: 10, max: 100, step: 0.5, default: 30 },
    { key: "ms", label: "Massa de cada mola", unit: "kg", min: 0, max: 0.05, step: 0.001, default: 0 },
    { key: "b", label: "Amortecimento b", unit: "kg/s", min: 0, max: 2, step: 0.01, default: 0.15, live: true },
    { key: "A0", label: "Puxão inicial abaixo do equilíbrio", unit: "m", min: -0.05, max: 0.05, step: 0.001, default: 0.03 },
    { key: "g", label: "Gravidade local g", unit: "m/s²", min: 9.7, max: 9.9, step: 0.01, default: 9.79 },
  ],

  observables: [
    { key: "y", label: "Alongamento atual", unit: "m", value: (s) => s[Y]! },
    { key: "v", label: "Velocidade", unit: "m/s", value: (s) => s[V]! },
    { key: "yeq", label: "Alongamento de equilíbrio", unit: "m", value: (_s, p) => yEq(p) },
    { key: "leitura", label: "Leitura da régua no ponteiro", unit: "m", value: (s, p) => reading(s[Y]!, p) },
    { key: "leituraEq", label: "Leitura da régua no equilíbrio", unit: "m", value: (_s, p) => reading(yEq(p), p) },
    { key: "leitura0", label: "Leitura da régua sem massa", unit: "m", value: (_s, p) => reading(0, p) },
    { key: "P", label: "Força peso pendurada", unit: "N", value: (_s, p) => num(p, "m", 0.1) * num(p, "g", 9.79) },
    { key: "m", label: "Massa pendurada", unit: "kg", value: (_s, p) => num(p, "m", 0.1) },
    { key: "keff", label: "Constante efetiva verdadeira", unit: "N/m", value: (_s, p) => kEff(p) },
    { key: "Fel", label: "Força elástica atual", unit: "N", value: (s, p) => kEff(p) * s[Y]! },
    { key: "T", label: "Período de oscilação", unit: "s", value: (_s, p) => period(p) },
  ],
  chart: { x: "t", y: "y" },

  scenarios: [
    {
      id: "uma-mola",
      label: "Calibrar uma mola",
      params: { arranjo: 0, k1: 20, m: 0.1, b: 0.15, A0: 0.03 },
      guide: `### Determinando k pela lei de Hooke
1. Leia na régua a posição do ponteiro **sem massa** (zero da medida) — use a lupa, a menor divisão é 1 mm.
2. Pendure uma massa, espere a oscilação morrer e leia de novo. O alongamento é a diferença: $u(\\Delta y) = \\sqrt{2}\\,u(\\text{leitura})$.
3. Repita para pelo menos 6 massas e faça o gráfico de $F = mg$ contra $\\Delta y$. A inclinação é $k$.
4. Por que é melhor ajustar uma reta do que calcular $k = mg/\\Delta y$ para uma única massa?`,
      predict: [
        {
          question: "Dobrando a massa pendurada, o alongamento de equilíbrio:",
          options: ["fica igual", "dobra", "quadruplica", "cai pela metade"],
          answer: 1,
          explanation: "No regime elástico $\\Delta y = mg/k$ é proporcional à força aplicada.",
        },
      ],
    },
    {
      id: "serie",
      label: "Duas molas em série",
      params: { arranjo: 1, k1: 20, k2: 30, m: 0.1, b: 0.2, A0: 0.02 },
      guide: `### Molas em série
As duas molas sentem a **mesma força**; os alongamentos se somam.
1. Meça $k_s$ com três massas diferentes.
2. Compare com $k_1k_2/(k_1+k_2)$. Os valores são compatíveis dentro da incerteza?
3. Observe que a mola mais mole (menor $k$) estica mais.`,
      predict: [
        {
          question: "Duas molas iguais de constante k em série equivalem a uma mola de constante:",
          options: ["2k", "k", "k/2", "k/4"],
          answer: 2,
          explanation: "Cada mola estica $F/k$; o total é $2F/k$, logo $k_s = k/2$.",
        },
      ],
    },
    {
      id: "paralelo",
      label: "Duas molas em paralelo",
      params: { arranjo: 2, k1: 20, k2: 30, m: 0.2, b: 0.3, A0: 0.02 },
      guide: `### Molas em paralelo
As duas molas têm o **mesmo alongamento**; as forças se somam.
1. Meça $k_p$ e compare com $k_1 + k_2$.
2. Com a mesma massa, compare o alongamento do arranjo paralelo com o da mola 1 sozinha.`,
    },
    {
      id: "periodo",
      label: "Período e massa da mola",
      params: { arranjo: 0, k1: 20, m: 0.05, ms: 0.03, b: 0.02, A0: 0.04 },
      guide: `### Método dinâmico
1. Cronometre 10 oscilações e calcule $T$.
2. Compare com $2\\pi\\sqrt{m/k}$ e com $2\\pi\\sqrt{(m + m_s/3)/k}$. Qual concorda melhor?
3. O $k$ obtido pelo método estático e pelo dinâmico são compatíveis?`,
    },
  ],

  exercises: [
    {
      id: "k-estatico",
      prompt:
        "Uma mola de constante k₁ = {k1} N/m sustenta uma massa de {m} kg (g = {g} m/s²). Qual é o alongamento de equilíbrio?",
      vary: { m: [0.02, 0.4, 3], k1: [10, 80, 1], g: [9.78, 9.81, 2] },
      fixed: { arranjo: 0, ms: 0 },
      answer: { label: "Δy", unit: "m", compute: (p) => (num(p, "m") * num(p, "g")) / num(p, "k1") },
    },
    {
      id: "serie-paralelo",
      prompt:
        "Molas de k₁ = {k1} N/m e k₂ = {k2} N/m são ligadas em série e sustentam {m} kg (g = {g} m/s²). Qual é o alongamento total no equilíbrio?",
      vary: { m: [0.02, 0.3, 3], k1: [10, 80, 1], k2: [10, 80, 1], g: [9.78, 9.81, 2] },
      fixed: { arranjo: 1, ms: 0 },
      answer: {
        label: "Δy",
        unit: "m",
        compute: (p) => num(p, "m") * num(p, "g") * (1 / num(p, "k1") + 1 / num(p, "k2")),
      },
      hint: "Na série, a força é a mesma nas duas molas e os alongamentos se somam.",
    },
    {
      id: "incerteza-k",
      prompt:
        "Uma mola de k₁ = {k1} N/m sustenta {m} kg (g = {g} m/s², massa e g com incerteza desprezível). O alongamento é a diferença de duas leituras numa régua milimetrada, com incerteza combinada de 0,7 mm. Qual a incerteza relativa percentual de k = mg/Δy?",
      vary: { m: [0.05, 0.4, 3], k1: [10, 60, 1], g: [9.78, 9.81, 2] },
      fixed: { arranjo: 0, ms: 0 },
      answer: {
        label: "u(k)/k",
        unit: "%",
        compute: (p) => (100 * 0.0007) / ((num(p, "m") * num(p, "g")) / num(p, "k1")),
      },
      tolerance: 0.05,
      hint: "u(k)/k = u(Δy)/Δy quando m e g são exatos.",
    },
  ],

  init: (p) => [yEq(p) + num(p, "A0"), 0],
  derivatives: (s: State, p: Params): State => {
    const g = num(p, "g", 9.79);
    const F = (num(p, "m", 0.1) + (nMolas(p) * num(p, "ms")) / 2) * g - kEff(p) * s[Y]! - num(p, "b") * s[V]!;
    return [s[V]!, F / mEff(p)];
  },
  dt: 1e-3,
  sampleEvery: 10,
  tEnd: 120,

  pointer: {
    down(s, p, pt) {
      const yb = -(reading(s[Y]!, p) + 0.02);
      return Math.abs(pt.x) < 0.08 && Math.abs(pt.y - yb) < 0.06 ? [s[Y]!, 0] : undefined;
    },
    move(s, p, pt, dragging) {
      if (!dragging) return undefined;
      const y = -pt.y - 0.02 - naturalLength(p) - HOOK;
      return [Math.max(0, Math.min(yEq(p) + 0.08, y)), 0];
    },
    cursor(s, p, pt) {
      const yb = -(reading(s[Y]!, p) + 0.02);
      return Math.abs(pt.x) < 0.08 && Math.abs(pt.y - yb) < 0.06 ? "grab" : undefined;
    },
  },

  viewport: (p) => viewportOf(p),

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const { state: s, params: p, theme } = frame;
    const a = arranjo(p);
    const y = s[Y]!;
    const vp = viewportOf(p);
    const H = vp.yMax - vp.yMin;
    const [e1, e2] = springStretch(y, p);

    d.support(-0.12, 0, 0.12, 0, { color: theme.muted });
    const springStyle = (c: string) => ({ color: c, width: 1.6, coils: 14, amplitudePx: 7 });
    let bottom: number;
    if (a === 0) {
      bottom = -(L0 + e1);
      d.spring(0, 0, 0, bottom, springStyle(theme.series[0]!));
      d.text("k₁", 0.04, bottom / 2, { color: theme.series[0], size: 12, align: "left", weight: "600" });
    } else if (a === 1) {
      const mid = -(L0 + e1);
      bottom = mid - (L0 + e2);
      d.spring(0, 0, 0, mid, springStyle(theme.series[0]!));
      d.dot(0, mid, 3, theme.text);
      d.spring(0, mid, 0, bottom, springStyle(theme.series[1]!));
      d.text("k₁", 0.04, mid / 2, { color: theme.series[0], size: 12, align: "left", weight: "600" });
      d.text("k₂", 0.04, (mid + bottom) / 2, { color: theme.series[1], size: 12, align: "left", weight: "600" });
    } else {
      bottom = -(L0 + e1);
      d.spring(-0.035, 0, -0.035, bottom, springStyle(theme.series[0]!));
      d.spring(0.035, 0, 0.035, bottom, springStyle(theme.series[1]!));
      d.line(-0.05, bottom, 0.05, bottom, { color: theme.text, width: 3 });
      d.text("k₁", -0.06, bottom / 2, { color: theme.series[0], size: 12, align: "right", weight: "600" });
      d.text("k₂", 0.06, bottom / 2, { color: theme.series[1], size: 12, align: "left", weight: "600" });
    }

    // Suporte de massas com ponteiro
    const yp = -reading(y, p);
    d.line(0, bottom, 0, yp, { color: theme.text, width: 1.2 });
    const m = num(p, "m", 0.1);
    const bh = 0.02 + 0.05 * Math.cbrt(m / 0.5);
    d.rect(-0.035, yp - bh, 0.07, bh, { fill: theme.series[2]!, stroke: theme.text, width: 1 });
    d.text(`${fmt(m * 1000, 0)} g`, 0, yp - bh / 2, { color: "#ffffff", size: 10, weight: "700" });

    // Régua vertical (zero no ponto de suspensão, crescendo para baixo)
    const rx = -0.13;
    const len = Math.floor((-vp.yMin - 0.02) * 100) / 100;
    d.rect(rx - 0.03, -len, 0.03, len, { fill: theme.dark ? "#3a3420" : "#f6e9b8", stroke: theme.muted, width: 1 });
    for (let mm = 0; mm <= Math.round(len * 1000); mm += 1) {
      const yy = -mm / 1000;
      const big = mm % 10 === 0, mid = mm % 5 === 0;
      if (!big && !mid && frame.scale < 600) continue;
      d.line(rx, yy, rx - (big ? 0.015 : mid ? 0.01 : 0.005), yy, { color: theme.text, width: big ? 1 : 0.6 });
      if (big && (mm % 50 === 0 || frame.scale * 0.01 > 14)) d.text(`${mm / 10}`, rx - 0.035, yy, { size: 9, align: "right", color: theme.muted });
    }
    d.text("cm", rx - 0.035, 0.02, { size: 9, align: "right", color: theme.muted });
    // ponteiro
    d.line(rx, yp, -0.035, yp, { color: theme.positive, width: 1.2 });
    d.polyline([[rx, yp], [rx + 0.012, yp + 0.005], [rx + 0.012, yp - 0.005]], { color: theme.positive, fill: theme.positive, close: true });

    // Lupa da régua em torno do ponteiro (±2 cm)
    const lx0 = 0.12 * H, lw = 0.3 * H, lyc = -0.42 * H + vp.yMax, lh = 0.5 * H;
    const mag = lh / 0.04;
    const R = reading(y, p);
    d.rect(lx0, lyc - lh / 2, lw, lh, { fill: theme.dark ? "#3a3420" : "#f6e9b8", stroke: theme.text, width: 1.2 });
    for (let mm = Math.ceil((R - 0.02) * 1000); mm <= Math.floor((R + 0.02) * 1000); mm++) {
      const yy = lyc - (mm / 1000 - R) * mag;
      const big = mm % 10 === 0, mid = mm % 5 === 0;
      const tl = big ? 0.4 : mid ? 0.28 : 0.16;
      d.line(lx0, yy, lx0 + lw * tl, yy, { color: theme.text, width: big ? 1.6 : 1 });
      if (big) d.text(`${mm / 10}`, lx0 + lw * 0.45, yy, { size: 13, align: "left", weight: "600", color: theme.text });
    }
    d.line(lx0, lyc, lx0 + lw, lyc, { color: theme.positive, width: 2 });
    d.text("lupa: régua em cm, divisões de 1 mm", lx0 + lw / 2, lyc + lh / 2 + 0.02 * H, { size: 10, color: theme.muted });
    d.line(rx, yp, lx0, lyc, { color: theme.muted, dash: [3, 4], width: 1, alpha: 0.6 });

    // Força peso e elástica
    const Fk = kEff(p) * y, Pm = m * num(p, "g", 9.79);
    const sc = 50 / Math.max(Pm, Fk, 0.1);
    d.arrowPx(0.06, yp - bh / 2, 0, -1, Pm * sc, { color: theme.text });
    d.text("P", 0.075, yp - bh / 2 - (Pm * sc) / frame.scale, { size: 11, align: "left" });
    d.arrowPx(0.06, yp, 0, 1, Fk * sc, { color: theme.accent });
    d.text("F", 0.075, yp + (Fk * sc) / frame.scale, { size: 11, align: "left", color: theme.accent });
  },
});

export default leiHooke;
