import { defineSim, draw, num, texNum, type Params } from "@fisilab/core";

/** Constante dos gases, J/(mol·K). */
export const R_GAS = 8.314462618;
/** Comprimento útil dos dois tubos (m). */
export const H = 1.2;
/** Número de grãos de cortiça no tubo de Kundt. */
export const N_GRAOS = 240;
/** Velocidade máxima de arraste dos grãos na ressonância (m/s). */
const V_GRAO = 0.25;
/** Perdas fixas (fonte, superfície da água, folgas do pistão), em unidades de fase. */
const B0_RES = 0.05;
/** Intensidade relativa mínima para o pó de cortiça se soltar do vidro. */
export const I_LIM = 0.1;
const B0_KUNDT = 0.1;

export const GASES = [
  { nome: "ar", gamma: 1.4, M: 0.028965 },
  { nome: "CO₂", gamma: 1.289, M: 0.04401 },
  { nome: "hélio", gamma: 5 / 3, M: 0.0040026 },
];

export interface Tubo {
  /** Comprimento da coluna de ar (modo ressonância) ou posição do pistão (modo Kundt), m. */
  L: number;
  /** Posições dos grãos de cortiça ao longo do tubo (m), só no modo Kundt. */
  x: number[];
  /** O aluno está arrastando a água/pistão. */
  drag: boolean;
}

const modo = (p: Params) => (Math.round(num(p, "modo")) === 1 ? 1 : 0);
const gasOf = (p: Params) => GASES[Math.min(2, Math.max(0, Math.round(num(p, "gas"))))]!;

/** Velocidade do som num gás ideal: c = √(γRT/M). */
export const soundSpeed = (p: Params) => {
  const g = gasOf(p);
  return Math.sqrt((g.gamma * R_GAS * (num(p, "T", 20) + 273.15)) / g.M);
};
export const wavelength = (p: Params) => soundSpeed(p) / num(p, "f", 500);
/** Correção de extremidade da boca aberta (tubo sem flange): e = 0,6 r. */
export const endCorrection = (p: Params) => 0.6 * num(p, "r", 0.0175);

/** Atenuação nas paredes (camada limite viscotérmica), 1/m. */
const alphaWall = (p: Params) => (3e-5 * Math.sqrt(num(p, "f", 500))) / num(p, "r", 0.0175);
const sinh2 = (b: number) => Math.sinh(b) ** 2;

/** Perda total da coluna fechada–aberta de comprimento efetivo Le (parede + radiação pela boca + fixas). */
function lossRes(p: Params, Le: number): number {
  const k = (2 * Math.PI) / wavelength(p);
  const kr = k * num(p, "r", 0.0175);
  return alphaWall(p) * Le + (kr * kr) / 4 + B0_RES;
}

/**
 * Intensidade relativa na boca do tubo de ressonância (fechado na água, aberto em cima),
 * normalizada pela primeira ressonância: I = sinh²β₁ / (cos²(kLₑ) + sinh²β), Lₑ = L + e.
 * Máximos em L + e = (2n − 1)λ/4, cada vez um pouco menores pelas perdas nas paredes.
 */
export function intensityRes(p: Params, L: number): number {
  const lam = wavelength(p);
  const Le = L + endCorrection(p);
  const k = (2 * Math.PI) / lam;
  return sinh2(lossRes(p, lam / 4)) / (Math.cos(k * Le) ** 2 + sinh2(lossRes(p, Le)));
}

/** Intensidade relativa no tubo de Kundt (fechado nas duas pontas): máximos em L = nλ/2. */
export function intensityKundt(p: Params, L: number): number {
  const lam = wavelength(p);
  const k = (2 * Math.PI) / lam;
  const b = (Lx: number) => alphaWall(p) * Lx + B0_KUNDT;
  return sinh2(b(lam / 2)) / (Math.sin(k * L) ** 2 + sinh2(b(L)));
}

export const intensity = (p: Params, L: number) => (modo(p) === 1 ? intensityKundt(p, L) : intensityRes(p, L));

/** Comprimentos de ressonância do tubo fechado–aberto: Lₙ = (2n − 1)λ/4 − e. */
export const resonanceLength = (p: Params, n: number) => ((2 * n - 1) * wavelength(p)) / 4 - endCorrection(p);

/** Posições dos nós de deslocamento no tubo de Kundt (o pistão em x = L é um nó). */
export function nodePositions(p: Params, L: number): number[] {
  const half = wavelength(p) / 2;
  const out: number[] = [];
  for (let x = L; x >= 0.015; x -= half) out.push(x);
  return out;
}

/** Fração dos grãos a menos de λ/16 de um nó, reescalada: 0 = pó espalhado, 1 = montinhos formados. */
export function patternFormation(s: Tubo, p: Params): number {
  if (!s.x.length) return 0;
  const half = wavelength(p) / 2;
  let near = 0;
  for (const x of s.x) {
    const d = (((s.L - x) % half) + half) % half;
    if (Math.min(d, half - d) < half / 8) near++;
  }
  return Math.min(1, Math.max(0, (near / s.x.length - 0.25) / 0.75));
}

const Lmin = (p: Params) => (modo(p) === 1 ? 0.15 : 0.02);
const Lmax = () => H - 0.03;
const clampL = (p: Params, L: number) => Math.min(Lmax(), Math.max(Lmin(p), L));

function initialGrains(L: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < N_GRAOS; i++) {
    const jitter = (((i * 7919) % 101) / 101 - 0.5) * 0.6;
    out.push(0.02 + ((L - 0.03) * (i + 0.5 + jitter)) / N_GRAOS);
  }
  return out;
}

// Geometria do palco
const TW = 0.045; // meia largura desenhada do tubo vertical
const KY = 0.3; // eixo do tubo de Kundt
const KH = 0.055; // meia altura desenhada do tubo de Kundt
const PX0 = 0.36; // eixo do gráfico I(L) no modo ressonância
const PW = 0.95;

const fmt = (v: number, d = 1) => v.toFixed(d).replace(".", ",");

function handleXY(s: Tubo, p: Params): [number, number] {
  return modo(p) === 1 ? [s.L, KY] : [0, H - s.L];
}

export const tuboKundt = defineSim<Tubo>({
  id: "tubo-kundt",
  title: "Tubo de ressonância e tubo de Kundt",
  course: "Exp II",
  topic: "Ondas",
  priority: "P1",
  summary:
    "Bancada de velocidade do som: baixe a coluna de água do tubo de ressonância ouvindo os reforços, ou ajuste o pistão do tubo de Kundt até o pó de cortiça formar montinhos nos nós. Mude a frequência, a temperatura e o gás.",
  equations: [
    String.raw`c = \sqrt{\frac{\gamma R T}{M}} \qquad \lambda = \frac{c}{f}`,
    String.raw`\text{tubo fechado–aberto: } L_n + e = (2n-1)\frac{\lambda}{4}, \qquad e \approx 0{,}6\,r`,
    String.raw`L_{n+1} - L_n = \frac{\lambda}{2} \qquad \text{Kundt: } d_{\text{nós}} = \frac{\lambda}{2} \;\Rightarrow\; c = 2 f d`,
    String.raw`I_{\text{rel}} = \frac{\sinh^2\beta_1}{\cos^2 k(L+e) + \sinh^2\beta}`,
  ],
  liveEquations(s, p) {
    const c = soundSpeed(p);
    const lam = wavelength(p);
    const g = gasOf(p);
    const base = String.raw`c = \sqrt{\frac{${texNum(g.gamma)}\cdot ${texNum(R_GAS, 4)}\cdot ${texNum(num(p, "T", 20) + 273.15, 5)}}{${texNum(g.M, 3)}}} = ${texNum(c, 4)}\ \text{m/s} \qquad \lambda = ${texNum(lam, 4)}\ \text{m}`;
    if (modo(p) === 1)
      return [
        base,
        String.raw`d_{\text{nós}} = \frac{\lambda}{2} = ${texNum(lam / 2, 4)}\ \text{m} \qquad L = ${texNum(s.L, 4)}\ \text{m} = ${texNum(s.L / (lam / 2), 3)}\cdot\frac{\lambda}{2} \qquad I_{\text{rel}} = ${texNum(intensity(p, s.L), 2)}`,
      ];
    return [
      base,
      String.raw`e = 0{,}6\cdot ${texNum(num(p, "r", 0.0175), 3)}\ \text{m} = ${texNum(endCorrection(p), 3)}\ \text{m} \qquad L = ${texNum(s.L, 4)}\ \text{m} \qquad I_{\text{rel}} = ${texNum(intensity(p, s.L), 2)}`,
      String.raw`\frac{4(L+e)}{\lambda} = ${texNum((4 * (s.L + endCorrection(p))) / lam, 3)} \quad (\text{ressonância quando é ímpar})`,
    ];
  },

  params: [
    {
      key: "modo", label: "Montagem", unit: "", min: 0, max: 1, step: 1, default: 0,
      options: [
        { value: 0, label: "Tubo de ressonância (coluna de água)" },
        { value: 1, label: "Tubo de Kundt (pó de cortiça)" },
      ],
    },
    { key: "f", label: "Frequência da fonte", unit: "Hz", min: 100, max: 3000, step: 1, default: 500, log: true, live: true },
    {
      key: "gas", label: "Gás no tubo", unit: "", min: 0, max: 2, step: 1, default: 0,
      options: [
        { value: 0, label: "Ar" },
        { value: 1, label: "Gás carbônico (CO₂)" },
        { value: 2, label: "Hélio" },
      ],
    },
    { key: "T", label: "Temperatura do gás", unit: "°C", min: 0, max: 50, step: 0.5, default: 20, live: true },
    { key: "L", label: "Coluna de ar / posição do pistão (inicial)", unit: "m", min: 0.02, max: 1.17, step: 0.001, default: 0.05 },
    { key: "r", label: "Raio interno do tubo", unit: "m", min: 0.01, max: 0.03, step: 0.0005, default: 0.0175 },
    { key: "vel", label: "Varredura: velocidade da água/pistão", unit: "m/s", min: -0.05, max: 0.05, step: 0.001, default: 0, live: true },
    {
      key: "fonte", label: "Fonte (tubo de ressonância)", unit: "", min: 0, max: 1, step: 1, default: 0, live: true,
      options: [
        { value: 0, label: "Alto-falante com gerador" },
        { value: 1, label: "Diapasão" },
      ],
    },
    {
      key: "teoria", label: "Mostrar curva teórica e nós", unit: "", min: 0, max: 1, step: 1, default: 0, live: true,
      options: [
        { value: 0, label: "Não (como na bancada)" },
        { value: 1, label: "Sim" },
      ],
    },
    {
      key: "som", label: "Som pelo alto-falante", unit: "", min: 0, max: 1, step: 1, default: 0, live: true,
      options: [
        { value: 0, label: "Desligado" },
        { value: 1, label: "Ligado (volume limitado)" },
      ],
    },
  ],

  observables: [
    { key: "L", label: "Comprimento da coluna de ar / posição do pistão", unit: "m", value: (s) => s.L },
    { key: "I", label: "Intensidade relativa na boca", unit: "", value: (s, p) => intensity(p, s.L) },
    { key: "lambda", label: "Comprimento de onda λ", unit: "m", value: (_s, p) => wavelength(p) },
    { key: "c", label: "Velocidade do som", unit: "m/s", value: (_s, p) => soundSpeed(p) },
    { key: "dNos", label: "Distância entre nós (λ/2)", unit: "m", value: (_s, p) => wavelength(p) / 2 },
    { key: "nNos", label: "Número de nós no tubo de Kundt", unit: "", value: (s, p) => (modo(p) === 1 ? nodePositions(p, s.L).length : 0) },
    { key: "xNo", label: "Posição do nó mais próximo da fonte", unit: "m", value: (s, p) => (modo(p) === 1 ? (nodePositions(p, s.L).at(-1) ?? 0) : 0) },
    { key: "formacao", label: "Formação dos montinhos de pó", unit: "", value: (s, p) => patternFormation(s, p) },
    { key: "xh", label: "Alça arrastável (x)", unit: "m", value: (s, p) => handleXY(s, p)[0] },
    { key: "yh", label: "Alça arrastável (y)", unit: "m", value: (s, p) => handleXY(s, p)[1] },
  ],
  chart: { x: "L", y: "I" },

  scenarios: [
    {
      id: "ressonancia",
      label: "Tubo de ressonância",
      params: { modo: 0, f: 500, gas: 0, T: 20, L: 0.05, vel: 0, teoria: 0 },
      guide: `### Achando as ressonâncias com a coluna de água
1. A fonte vibra a 500 Hz sobre a boca do tubo. Arraste a **superfície da água** (ou o reservatório) para baixo devagar e observe a intensidade na boca no gráfico ao lado do tubo.
2. Ligue o som: perto de cada ressonância o tom fica bem mais forte.
3. Anote $L_1$, $L_2$ e $L_3$ (régua com zero na boca). A diferença entre ressonâncias vizinhas é $\\lambda/2$, e a correção de extremidade se cancela.
4. Com $\\lambda$ obtenha $c = \\lambda f$ e a correção $e = \\lambda/4 - L_1$. Compare com $0{,}6\\,r$.`,
      predict: [
        {
          question: "A primeira ressonância aparece com L₁ ≈ 16 cm. A segunda aparecerá com a coluna de ar de aproximadamente:",
          options: ["32 cm (o dobro)", "48 cm (três vezes)", "50 cm (L₁ + λ/2)"],
          answer: 2,
          explanation: "As ressonâncias do tubo fechado–aberto são $L_n + e = (2n-1)\\lambda/4$: vizinhas diferem de $\\lambda/2 \\approx 34$ cm. Por causa da correção $e$, $L_2$ é um pouco mais que $3L_1$: $L_2 = L_1 + \\lambda/2 \\approx 50$ cm.",
        },
      ],
    },
    {
      id: "varredura",
      label: "Varredura automática da coluna",
      params: { modo: 0, f: 700, gas: 0, T: 20, L: 0.02, vel: 0.04, teoria: 1 },
      guide: `### Curva de ressonância
1. A água desce sozinha a 4 cm/s; o gráfico registra a intensidade na boca contra o comprimento da coluna.
2. Os picos ficam em $L_n = (2n-1)\\lambda/4 - e$. Compare com a curva teórica tracejada.
3. Os picos mais longe da boca são um pouco mais baixos: há mais parede e mais perda de energia.
4. Aumente a temperatura: os picos se afastam, porque $c$ (e $\\lambda$) cresce com $\\sqrt{T}$.`,
    },
    {
      id: "kundt",
      label: "Tubo de Kundt",
      params: { modo: 1, f: 1500, gas: 0, T: 20, L: 1.144, vel: 0, teoria: 0 },
      guide: `### Montinhos de pó nos nós
1. O pistão está numa posição de ressonância ($L = n\\lambda/2$). Rode e veja o pó de cortiça sair dos ventres e se juntar nos **nós de deslocamento**.
2. Meça com a régua a distância entre o primeiro e o último montinho e divida pelo número de intervalos: é $\\lambda/2$.
3. Calcule $c = 2 f d$ e compare com $\\sqrt{\\gamma R T/M}$.
4. Arraste o pistão alguns milímetros: fora da ressonância a amplitude cai e o pó quase não se move.`,
      predict: [
        {
          question: "Se o tubo de Kundt for cheio de hélio em vez de ar, mantida a frequência, os montinhos de pó ficarão:",
          options: ["mais próximos", "na mesma posição", "cerca de três vezes mais afastados"],
          answer: 2,
          explanation: "$c = \\sqrt{\\gamma RT/M}$: o hélio é muito mais leve, então $c \\approx 1007$ m/s contra 343 m/s no ar. Com $f$ fixa, $d = c/(2f)$ fica cerca de 2,9 vezes maior.",
        },
      ],
    },
    {
      id: "helio",
      label: "Kundt com hélio",
      params: { modo: 1, f: 1500, gas: 2, T: 20, L: 1.007, vel: 0, teoria: 0 },
      guide: `### Som no hélio
1. Mesmo tubo e mesma frequência do cenário anterior, agora com hélio. Quantos montinhos aparecem?
2. Meça $d$ e calcule $c$. Compare a razão $c_{\\text{He}}/c_{\\text{ar}}$ com $\\sqrt{(\\gamma_{\\text{He}} M_{\\text{ar}})/(\\gamma_{\\text{ar}} M_{\\text{He}})}$.
3. Troque para CO₂ e ajuste o pistão até a ressonância (o pó volta a dançar).`,
    },
  ],

  exercises: [
    {
      id: "ressonancia",
      prompt:
        "Num tubo de ressonância de raio {r} m, excitado por um diapasão de {f} Hz, o primeiro reforço do som ocorre com {L1} m de coluna de ar. Usando e = 0,6 r, qual a velocidade do som?",
      vary: { f: [256, 1024, 0], r: [0.01, 0.025, 3], L1: [0.07, 0.3, 3] },
      answer: { label: "c", unit: "m/s", compute: (p) => 4 * num(p, "f") * (num(p, "L1") + 0.6 * num(p, "r")) },
      hint: "Primeira ressonância do tubo fechado–aberto: L₁ + e = λ/4.",
    },
    {
      id: "kundt",
      prompt: "Num tubo de Kundt com ar a {T} °C, excitado a {f} Hz, qual a distância entre dois montinhos de pó consecutivos?",
      vary: { T: [0, 40, 0], f: [800, 3000, 0] },
      fixed: { gas: 0 },
      answer: { label: "d", unit: "m", compute: (p) => wavelength(p) / 2 },
      hint: "c = √(γRT/M) com γ = 1,4 e M = 0,028965 kg/mol; os montinhos ficam nos nós, separados de λ/2.",
    },
  ],

  init: (p) => {
    const L = clampL(p, num(p, "L", 0.05));
    return { L, x: modo(p) === 1 ? initialGrains(L) : [], drag: false };
  },
  step(s, p, _t, dt) {
    let L = s.L;
    const vel = num(p, "vel");
    if (!s.drag && vel !== 0) L = clampL(p, L + vel * dt);
    if (modo(p) === 0) return { ...s, L };
    // Pó de cortiça: arrastado pela pressão de radiação em direção aos nós de deslocamento,
    // com velocidade ∝ I·d(s²)/dx, s(x) ∝ sen k(L − x).
    // O pó só "dança" quando a vibração vence o atrito com o vidro (limiar I_LIM).
    const I = Math.max(0, intensityKundt(p, L) - I_LIM) / (1 - I_LIM);
    if (I === 0) return { ...s, L, x: s.x.map((xi) => Math.min(xi, L - 0.004)) };
    const k = (2 * Math.PI) / wavelength(p);
    const x = s.x.map((xi) => {
      const xn = xi + V_GRAO * I * Math.sin(2 * k * (L - xi)) * dt;
      return Math.min(L - 0.004, Math.max(0.01, xn));
    });
    return { ...s, L, x };
  },
  dt: 0.002,
  sampleEvery: 10,
  maxSamples: 3000,
  tEnd: 600,

  pointer: {
    down(s, p, pt) {
      const [hx, hy] = handleXY(s, p);
      const nearHandle = modo(p) === 1 ? Math.abs(pt.x - hx) < 0.06 && Math.abs(pt.y - hy) < 0.12 : Math.abs(pt.x) < 0.1 && Math.abs(pt.y - hy) < 0.07;
      const nearRes = modo(p) === 0 && Math.abs(pt.x + 0.32) < 0.1 && Math.abs(pt.y - hy) < 0.12;
      return nearHandle || nearRes ? { ...s, drag: true } : undefined;
    },
    move(s, p, pt, dragging) {
      if (!dragging || !s.drag) return undefined;
      const L = clampL(p, modo(p) === 1 ? pt.x : H - pt.y);
      return { ...s, L, x: s.x.map((xi) => Math.min(xi, L - 0.004)) };
    },
    up: (s) => (s.drag ? { ...s, drag: false } : undefined),
    cursor(s, p, pt) {
      const [hx, hy] = handleXY(s, p);
      if (modo(p) === 1) return Math.abs(pt.x - hx) < 0.06 && Math.abs(pt.y - hy) < 0.12 ? "ew-resize" : undefined;
      return (Math.abs(pt.x) < 0.1 || Math.abs(pt.x + 0.32) < 0.1) && Math.abs(pt.y - hy) < 0.1 ? "ns-resize" : undefined;
    },
  },
  actions: [
    { id: "espalhar", label: "Espalhar o pó de novo", run: (s, p) => ({ ...s, x: modo(p) === 1 ? initialGrains(s.L) : [] }) },
  ],

  tone(p, s) {
    const freq = num(p, "f", 500);
    if (Math.round(num(p, "som")) !== 1) return { freq, gain: 0 };
    const I = Math.min(1, intensity(p, s.L));
    return { freq, gain: 0.02 + 0.16 * (Number.isFinite(I) ? I : 0) };
  },

  viewport: (p) =>
    modo(p) === 1 ? { xMin: -0.3, xMax: 1.5, yMin: -0.12, yMax: 0.85, unit: "" } : { xMin: -0.55, xMax: 1.45, yMin: -0.15, yMax: 1.45, unit: "" },

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const { state: s, params: p, theme, trail } = frame;
    const lam = wavelength(p);
    const k = (2 * Math.PI) / lam;
    const I = intensity(p, s.L);
    const water = theme.series[0] ?? theme.accent;
    const showTheory = Math.round(num(p, "teoria")) === 1;
    const gas = gasOf(p);

    if (modo(p) === 0) {
      const yw = H - s.L;
      // Base e suporte
      d.support(-0.5, -0.12, 0.25, -0.12, { color: theme.muted });
      d.rect(-0.03, -0.12, 0.06, 0.12, { fill: theme.muted, alpha: 0.5 });
      // Água no tubo e no reservatório (vasos comunicantes)
      d.rect(-TW, 0, 2 * TW, yw, { fill: water, alpha: 0.35 });
      const rx = -0.32;
      const rb = Math.max(-0.1, yw - 0.12);
      d.rect(rx - 0.06, rb, 0.12, 0.2, { stroke: theme.muted, width: 1.5 });
      d.rect(rx - 0.06, rb, 0.12, yw - rb, { fill: water, alpha: 0.35 });
      d.line(rx - 0.06, yw, rx + 0.06, yw, { color: water, width: 2 });
      d.polyline([[-TW, 0.02], [-0.15, 0.02], [-0.15, -0.06], [rx, -0.06], [rx, rb]], { color: theme.muted, width: 3, alpha: 0.7 });
      d.text("reservatório", rx, rb + 0.24, { color: theme.muted, size: 10 });
      d.text("(arraste)", rx, rb + 0.21, { color: theme.muted, size: 9, dy: 6 });
      // Tubo de vidro
      d.line(-TW, 0, -TW, H, { color: theme.text, width: 2 });
      d.line(TW, 0, TW, H, { color: theme.text, width: 2 });
      d.line(-TW, 0, TW, 0, { color: theme.text, width: 2 });
      // Superfície da água (alça)
      d.line(-TW, yw, TW, yw, { color: water, width: 3 });
      d.dot(0, yw, s.drag ? 7 : 5, theme.accent);
      // Envelope do deslocamento do ar: nó na água, ventre perto da boca
      const amp = 0.85 * TW * Math.sqrt(Math.min(1, I));
      const env = (y: number) => amp * Math.abs(Math.sin(k * (y - yw)));
      const right: [number, number][] = [];
      const left: [number, number][] = [];
      for (let i = 0; i <= 160; i++) {
        const y = yw + ((H - yw) * i) / 160;
        right.push([env(y), y]);
        left.push([-env(y), y]);
      }
      d.polyline(right, { color: theme.series[1], width: 1.5 });
      d.polyline(left, { color: theme.series[1], width: 1.5 });
      // Correção de extremidade (exagerada visualmente se pequena)
      const e = endCorrection(p);
      d.line(-TW * 1.6, H + e, TW * 1.6, H + e, { color: theme.muted, dash: [4, 3], width: 1 });
      // Régua com zero na boca
      const rx0 = TW + 0.012;
      d.rect(rx0, 0, 0.05, H, { fill: theme.ground, alpha: 0.6 });
      for (let cm = 0; cm <= Math.round(H * 100); cm++) {
        const y = H - cm / 100;
        const len = cm % 10 === 0 ? 0.035 : cm % 5 === 0 ? 0.024 : 0.014;
        d.line(rx0, y, rx0 + len, y, { color: theme.text, width: 1 });
        if (cm % 10 === 0) d.text(`${cm}`, rx0 + 0.05, y, { color: theme.text, size: 9, align: "left", dx: 2 });
      }
      d.text("cm", rx0 + 0.05, H + 0.03, { color: theme.muted, size: 9, align: "left" });
      // Fonte sobre a boca
      if (Math.round(num(p, "fonte")) === 1) {
        // diapasão horizontal com hastes vibrando
        const yf = H + 0.07;
        const vib = 0.006 * Math.min(1, I + 0.3) * Math.sin(frame.t * 60);
        d.line(-0.06, yf + 0.018 + vib, 0.12, yf + 0.018 + vib, { color: theme.text, width: 4 });
        d.line(-0.06, yf - 0.018 - vib, 0.12, yf - 0.018 - vib, { color: theme.text, width: 4 });
        d.line(0.12, yf - 0.018, 0.12, yf + 0.018, { color: theme.text, width: 4 });
        d.line(0.12, yf, 0.24, yf, { color: theme.text, width: 4 });
        d.text(`diapasão ${Math.round(num(p, "f", 500))} Hz`, 0.27, yf, { color: theme.text, size: 11, align: "left" });
      } else {
        const yf = H + 0.06;
        d.rect(-0.06, yf + 0.03, 0.12, 0.05, { fill: theme.text });
        d.polyline([[-0.06, yf + 0.03], [-0.09, yf - 0.01], [0.09, yf - 0.01], [0.06, yf + 0.03]], { color: theme.text, close: true, fill: theme.muted });
        d.text(`alto-falante · f = ${Math.round(num(p, "f", 500))} Hz`, 0.12, yf + 0.03, { color: theme.text, size: 11, align: "left" });
      }
      d.text(`e = 0,6 r = ${fmt(e * 1000)} mm`, -TW * 1.6, H + e, { color: theme.muted, size: 9, align: "right", dx: -4 });

      // Gráfico I × L alinhado com o tubo
      d.line(PX0, 0, PX0, H, { color: theme.muted, width: 1 });
      d.line(PX0, H, PX0 + PW, H, { color: theme.muted, width: 1 });
      for (const v of [0.5, 1]) {
        d.line(PX0 + PW * v, H - 0.012, PX0 + PW * v, H + 0.012, { color: theme.muted, width: 1 });
        d.text(fmt(v, 1), PX0 + PW * v, H + 0.035, { color: theme.muted, size: 9 });
      }
      d.text("intensidade relativa na boca →", PX0 + PW / 2, H + 0.08, { color: theme.text, size: 10 });
      if (showTheory) {
        const pts: [number, number][] = [];
        for (let i = 0; i <= 600; i++) {
          const L = (H * i) / 600;
          pts.push([PX0 + PW * Math.min(1.05, intensityRes(p, L)), H - L]);
        }
        d.polyline(pts, { color: theme.muted, dash: [4, 3], width: 1.2 });
        for (let n = 1; n <= 6; n++) {
          const Ln = resonanceLength(p, n);
          if (Ln < 0 || Ln > H) continue;
          d.text(`L${n} = ${fmt(Ln * 100)} cm`, PX0 + PW, H - Ln, { color: theme.muted, size: 9, align: "right", dy: -7 });
        }
      }
      const tr: [number, number][] = [];
      for (const st of trail) tr.push([PX0 + PW * Math.min(1.05, intensityRes(p, st.L)), H - st.L]);
      for (const [x, y] of tr) d.dot(x, y, 1.6, theme.accent, 0.7);
      d.line(TW, yw, PX0 + PW * Math.min(1.05, I), yw, { color: theme.accent, dash: [3, 3], width: 1, alpha: 0.6 });
      d.dot(PX0 + PW * Math.min(1.05, I), yw, 5, theme.accent);
      d.text(`L = ${fmt(s.L * 100)} cm   I = ${fmt(I, 2)}`, PX0 + PW * Math.min(1.05, I), yw, {
        color: theme.text, size: 11, weight: "600", align: I > 0.6 ? "right" : "left", dx: I > 0.6 ? -8 : 8, dy: -10,
      });
      d.text(`${gas.nome} a ${fmt(num(p, "T", 20))} °C`, PX0 + PW, 0.04, { color: theme.muted, size: 10, align: "right" });
      return;
    }

    // ---------- Tubo de Kundt (horizontal)
    const y0 = KY - KH;
    const y1 = KY + KH;
    // Suporte
    d.support(-0.28, -0.1, 1.48, -0.1, { color: theme.muted });
    d.rect(0.1, -0.1, 0.03, y0 + 0.1, { fill: theme.muted, alpha: 0.5 });
    d.rect(1.05, -0.1, 0.03, y0 + 0.1, { fill: theme.muted, alpha: 0.5 });
    // Alto-falante à esquerda
    d.rect(-0.2, KY - 0.04, 0.08, 0.08, { fill: theme.text });
    d.polyline([[-0.12, KY - 0.03], [-0.02, KY - KH], [-0.02, KY + KH], [-0.12, KY + 0.03]], { color: theme.text, close: true, fill: theme.muted });
    d.text(`fonte ${Math.round(num(p, "f", 500))} Hz`, -0.11, KY + KH + 0.06, { color: theme.text, size: 11 });
    // Gás dentro do tubo (leve tom) e vidro
    d.rect(0, y0, s.L, 2 * KH, { fill: theme.series[4] ?? theme.accent, alpha: gas.nome === "ar" ? 0.04 : 0.12 });
    d.line(0, y0, H, y0, { color: theme.text, width: 2 });
    d.line(0, y1, H, y1, { color: theme.text, width: 2 });
    // Envelope do deslocamento do ar
    const amp = 0.8 * KH * Math.sqrt(Math.min(1, I));
    const envK = (x: number) => amp * Math.abs(Math.sin(k * (s.L - x)));
    d.plot((x) => KY + envK(x), 0, s.L, { color: theme.series[1], width: 1.2, alpha: 0.7, n: 400 });
    d.plot((x) => KY - envK(x), 0, s.L, { color: theme.series[1], width: 1.2, alpha: 0.7, n: 400 });
    // Pó de cortiça empilhado por faixa
    const bin = 0.004;
    const counts = new Map<number, number>();
    const cork = theme.dark ? "#d9a86c" : "#a8692c";
    const dance = I > I_LIM ? 0.004 * Math.min(1, I) : 0;
    s.x.forEach((x, i) => {
      const b = Math.floor(x / bin);
      const c = counts.get(b) ?? 0;
      counts.set(b, c + 1);
      const jig = dance * Math.abs(Math.sin(k * (s.L - x))) * Math.abs(Math.sin(frame.t * 40 + i));
      d.dot(x, y0 + 0.004 + c * 0.0042 + jig, 2, cork);
    });
    // Pistão
    d.rect(s.L, y0 + 0.004, 0.02, 2 * KH - 0.008, { fill: theme.text });
    d.line(s.L + 0.02, KY, H + 0.2, KY, { color: theme.text, width: 3 });
    d.rect(H + 0.2, KY - 0.04, 0.03, 0.08, { fill: theme.muted });
    d.dot(s.L, KY, s.drag ? 7 : 5, theme.accent);
    d.text("pistão (arraste)", s.L + 0.02, y1 + 0.04, { color: theme.muted, size: 10, align: "left" });
    // Régua com zero na fonte
    const ry = y0 - 0.1;
    d.rect(0, ry, H, 0.06, { fill: theme.ground, alpha: 0.6 });
    for (let cm = 0; cm <= Math.round(H * 100); cm++) {
      const x = cm / 100;
      const len = cm % 10 === 0 ? 0.04 : cm % 5 === 0 ? 0.028 : 0.016;
      d.line(x, ry + 0.06, x, ry + 0.06 - len, { color: theme.text, width: 1 });
      if (cm % 10 === 0) d.text(`${cm}`, x, ry - 0.02, { color: theme.text, size: 9 });
    }
    d.text("cm", H + 0.05, ry - 0.02, { color: theme.muted, size: 9, align: "left" });
    if (showTheory) {
      for (const xn of nodePositions(p, s.L)) {
        d.line(xn, y0 - 0.005, xn, y1 + 0.005, { color: theme.positive, dash: [3, 3], width: 1, alpha: 0.7 });
      }
      d.text("nós de deslocamento (teoria)", 0.6, y1 + 0.13, { color: theme.positive, size: 10 });
    }
    // Medidor de amplitude e leituras
    const mx = 0.0;
    const my = 0.62;
    d.rect(mx, my, 0.6, 0.04, { stroke: theme.muted, width: 1 });
    d.rect(mx, my, 0.6 * Math.min(1, I), 0.04, { fill: I > 0.5 ? theme.positive : theme.accent, alpha: 0.8 });
    d.text(`amplitude no tubo: ${fmt(Math.min(1, I) * 100, 0)}% da ressonância`, mx, my + 0.08, { color: theme.text, size: 11, align: "left" });
    d.text(`${gas.nome} a ${fmt(num(p, "T", 20))} °C · pistão em ${fmt(s.L * 100)} cm`, mx, my - 0.05, { color: theme.muted, size: 10, align: "left" });
    d.text(`montinhos: ${fmt(patternFormation(s, p) * 100, 0)}% formados`, 1.45, my + 0.08, { color: theme.text, size: 11, align: "right" });
  },
});

export default tuboKundt;
