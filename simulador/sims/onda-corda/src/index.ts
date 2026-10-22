import { defineSim, draw, num, texNum, type Params } from "@fisilab/core";
import { derivation } from "./derivation.ts";

/** Comprimentos (m) das duas cordas emendadas e número de segmentos da corda 1. */
export const L1 = 5;
export const L2 = 5;
export const N1 = 300;
/** Posições das sondas: meio da corda 1 e meio da corda 2. */
export const XP1 = L1 / 2;
export const XP2 = L1 + L2 / 2;

export const FONTE = { gauss: 0, seno: 1, mao: 2 } as const;
export const PONTA = { fixa: 0, livre: 1, absorvente: 2 } as const;

/**
 * Corda discretizada como colar de contas (massas pontuais ligadas por
 * segmentos tensionados). O espaçamento de cada trecho é escolhido para que
 * v·h/Δx = 1 nos dois meios: com número de Courant 1 o esquema de diferenças
 * finitas é exato (sem dispersão) dentro de cada corda, e só a emenda
 * (uma conta com metade da massa de cada lado) é aproximada.
 */
export interface Grid {
  v1: number;
  v2: number;
  Z1: number;
  Z2: number;
  dx1: number;
  dx2: number;
  /** Passo interno de tempo (s). */
  h: number;
  /** Índice da conta da emenda. */
  J: number;
  /** Índice da última conta. */
  N: number;
  x: Float64Array;
  /** Massa de cada conta (kg). */
  m: Float64Array;
  /** Rigidez T/Δx do segmento entre a conta i e a i+1 (N/m). */
  k: Float64Array;
  i1: number;
  i2: number;
}

let cacheKey = "";
let cacheGrid: Grid | null = null;

export function grid(p: Params): Grid {
  const T = num(p, "T", 10);
  const mu1 = num(p, "mu1", 0.1);
  const mu2 = mu1 * num(p, "razao", 1);
  const key = `${T}|${mu1}|${mu2}`;
  if (cacheGrid && key === cacheKey) return cacheGrid;
  const v1 = Math.sqrt(T / mu1);
  const v2 = Math.sqrt(T / mu2);
  const dx1 = L1 / N1;
  const h = dx1 / v1;
  const dx2 = v2 * h;
  const N2 = Math.max(20, Math.round(L2 / dx2));
  const N = N1 + N2;
  const x = new Float64Array(N + 1);
  const m = new Float64Array(N + 1);
  const k = new Float64Array(N);
  for (let i = 0; i <= N; i++) {
    x[i] = i <= N1 ? i * dx1 : L1 + (i - N1) * dx2;
    m[i] = i < N1 ? mu1 * dx1 : i > N1 ? mu2 * dx2 : (mu1 * dx1 + mu2 * dx2) / 2;
    if (i < N) k[i] = i < N1 ? T / dx1 : T / dx2;
  }
  const i2 = N1 + Math.round((XP2 - L1) / dx2);
  cacheGrid = {
    v1, v2, Z1: Math.sqrt(T * mu1), Z2: Math.sqrt(T * mu2), dx1, dx2, h, J: N1, N, x, m, k,
    i1: Math.round(XP1 / dx1), i2: Math.min(N - 1, i2),
  };
  cacheKey = key;
  return cacheGrid;
}

export const uniforme = (p: Params) => Math.abs(num(p, "razao", 1) - 1) < 1e-6;

/** Coeficiente de reflexão da ponta direita. */
export function coefPonta(p: Params): number {
  return [-1, 1, 0][Math.round(num(p, "ponta"))] ?? 0;
}

/** Coeficientes de amplitude (deslocamento) para onda indo da corda 1 para a 2. */
export function coefR(p: Params): number {
  const g = grid(p);
  return (g.Z1 - g.Z2) / (g.Z1 + g.Z2);
}
export function coefT(p: Params): number {
  const g = grid(p);
  return (2 * g.Z1) / (g.Z1 + g.Z2);
}

export interface Corda {
  /** Número de passos internos já dados (t = n·h). */
  n: number;
  y: Float64Array;
  yp: Float64Array;
  /** Deslocamento imposto na ponta esquerda nos instantes n−1 e n. */
  fPrev: number;
  fCur: number;
  /** Instante em que o pulso atual começou a ser gerado. */
  t0: number;
  /** Altura pedida pela mão (modo "mão"). */
  hand: number;
  /** Picos (com sinal) medidos nas janelas do pulso refletido e transmitido. */
  refl: number;
  trans: number;
}

const sigmaT = (p: Params) => num(p, "w", 0.3) / grid(p).v1;
/** Instante em que o centro do pulso gaussiano passa pela ponta esquerda. */
const tCenter = (s: Corda, p: Params) => s.t0 + 4 * sigmaT(p);

function source(s: Corda, p: Params, t: number): number {
  const A = num(p, "A", 0.4);
  const tau = t - s.t0;
  if (tau < 0) return 0;
  switch (Math.round(num(p, "fonte"))) {
    case FONTE.seno:
      return A * Math.sin(2 * Math.PI * num(p, "f", 2) * tau);
    case FONTE.gauss: {
      const u = (t - tCenter(s, p)) / sigmaT(p);
      return Math.abs(u) > 8 ? 0 : A * Math.exp(-0.5 * u * u);
    }
    default:
      return 0;
  }
}

/** Avança `steps` passos internos (função pura: devolve um novo estado). */
export function advance(s: Corda, p: Params, steps: number): Corda {
  const g = grid(p);
  const { N, m, k, h } = g;
  let y = Float64Array.from(s.y);
  let yp = Float64Array.from(s.yp);
  let yn = new Float64Array(N + 1);
  let { n, fPrev, fCur, refl, trans } = s;
  const fonte = Math.round(num(p, "fonte"));
  const ponta = Math.round(num(p, "ponta"));
  const h2 = h * h;
  const gauss = fonte === FONTE.gauss;
  const st = sigmaT(p);
  const tc = tCenter(s, p);
  // Sem emenda (μ₂ = μ₁) o primeiro refletor é a ponta direita.
  const xRef = uniforme(p) ? g.x[N]! : L1;
  const tR = tc + (2 * xRef - XP1) / g.v1;
  const tT = tc + L1 / g.v1 + (g.x[g.i2]! - L1) / g.v2;
  const alpha = 1 - Math.exp(-h / 0.04);
  for (let step = 0; step < steps; step++) {
    for (let i = 1; i < N; i++) {
      const F = k[i - 1]! * (y[i - 1]! - y[i]!) + k[i]! * (y[i + 1]! - y[i]!);
      yn[i] = 2 * y[i]! - yp[i]! + (h2 * F) / m[i]!;
    }
    const tNext = (n + 1) * h;
    const fNext = fonte === FONTE.mao ? fCur + (s.hand - fCur) * alpha : source(s, p, tNext);
    // Ponta esquerda: deslocamento imposto + condição transparente para a onda que volta.
    yn[0] = fNext + y[1]! - fPrev;
    if (ponta === PONTA.fixa) yn[N] = 0;
    else if (ponta === PONTA.livre) yn[N] = 2 * y[N - 1]! - yp[N]!;
    else yn[N] = y[N - 1]!;
    const tmp = yp;
    yp = y;
    y = yn;
    yn = tmp;
    fPrev = fCur;
    fCur = fNext;
    n++;
    if (gauss) {
      const t = n * h;
      const a = y[g.i1]!;
      const b = y[g.i2]!;
      if (Math.abs(t - tR) < 2.5 * st && Math.abs(a) > Math.abs(refl)) refl = a;
      if (Math.abs(t - tT) < 2.5 * st && Math.abs(b) > Math.abs(trans)) trans = b;
    }
  }
  return { ...s, n, y, yp, fPrev, fCur, refl, trans };
}

/** Energia mecânica da corda (J): cinética das contas + elástica dos segmentos. */
export function energy(s: Corda, p: Params): number {
  const g = grid(p);
  let E = 0;
  for (let i = 0; i <= g.N; i++) {
    const v = (s.y[i]! - s.yp[i]!) / g.h;
    E += 0.5 * g.m[i]! * v * v;
    if (i < g.N) {
      const d1 = s.y[i + 1]! - s.y[i]!;
      const d0 = s.yp[i + 1]! - s.yp[i]!;
      E += 0.25 * g.k[i]! * (d1 * d1 + d0 * d0);
    }
  }
  return E;
}

const tOf = (s: Corda, p: Params) => s.n * grid(p).h;
const isGauss = (p: Params) => Math.round(num(p, "fonte")) === FONTE.gauss;
const Rmed = (s: Corda, p: Params) => (isGauss(p) ? s.refl / num(p, "A", 0.4) : 0);
const Tmed = (s: Corda, p: Params) => (isGauss(p) ? s.trans / num(p, "A", 0.4) : 0);

const PONTA_NOME = ["fixa", "livre", "absorvente"];

export const ondaCorda = defineSim<Corda>({
  id: "onda-corda",
  title: "Onda em corda: pulsos, reflexão e transmissão",
  course: "FG II",
  topic: "Ondas",
  priority: "P1",
  summary:
    "Envie pulsos ou ondas senoidais por uma corda emendada a outra de densidade diferente e compare as amplitudes refletida e transmitida com R = (Z₁ − Z₂)/(Z₁ + Z₂). A ponta final pode ser fixa, livre ou absorvente.",
  derivation,
  equations: [
    String.raw`\frac{\partial^2 y}{\partial t^2} = v^2\,\frac{\partial^2 y}{\partial x^2} \qquad v = \sqrt{\frac{T}{\mu}}`,
    String.raw`Z = \sqrt{T\mu} = \mu v \qquad R = \frac{Z_1 - Z_2}{Z_1 + Z_2} \qquad \tau = \frac{2Z_1}{Z_1 + Z_2}`,
    String.raw`\text{ponta fixa: } y = 0 \;(R = -1) \qquad \text{ponta livre: } \frac{\partial y}{\partial x} = 0 \;(R = +1)`,
  ],
  liveEquations(s, p) {
    const g = grid(p);
    const eqs = [
      String.raw`v_1 = ${texNum(g.v1)}\ \text{m/s} \quad v_2 = ${texNum(g.v2)}\ \text{m/s} \qquad Z_1 = ${texNum(g.Z1)}\ \text{kg/s} \quad Z_2 = ${texNum(g.Z2)}\ \text{kg/s}`,
      uniforme(p)
        ? String.raw`\text{corda única: } R_{\text{ponta}} = ${texNum(coefPonta(p))}`
        : String.raw`R_{\text{teo}} = ${texNum(coefR(p))} \qquad \tau_{\text{teo}} = ${texNum(coefT(p))}`,
    ];
    if (isGauss(p)) eqs.push(String.raw`R_{\text{med}} = ${s.refl === 0 ? String.raw`\text{(aguardando)}` : texNum(Rmed(s, p))} \qquad \tau_{\text{med}} = ${s.trans === 0 ? String.raw`\text{(aguardando)}` : texNum(Tmed(s, p))}`);
    if (Math.round(num(p, "fonte")) === FONTE.seno)
      eqs.push(String.raw`\lambda_1 = \frac{v_1}{f} = ${texNum(g.v1 / num(p, "f", 2))}\ \text{m} \qquad \lambda_2 = ${texNum(g.v2 / num(p, "f", 2))}\ \text{m}`);
    return eqs;
  },

  params: [
    {
      key: "fonte", label: "Fonte na ponta esquerda", unit: "", min: 0, max: 2, step: 1, default: 0,
      options: [
        { value: FONTE.gauss, label: "Pulso gaussiano" },
        { value: FONTE.seno, label: "Onda senoidal contínua" },
        { value: FONTE.mao, label: "Mão (arraste a ponta esquerda)" },
      ],
    },
    {
      key: "ponta", label: "Ponta direita", unit: "", min: 0, max: 2, step: 1, default: 0,
      options: [
        { value: PONTA.fixa, label: "Fixa (presa na parede)" },
        { value: PONTA.livre, label: "Livre (anel sem atrito)" },
        { value: PONTA.absorvente, label: "Absorvente (sem reflexão)" },
      ],
    },
    { key: "razao", label: "Densidade da corda 2 (μ₂/μ₁)", unit: "", min: 0.1, max: 10, step: 0.05, default: 1, log: true },
    { key: "T", label: "Tensão", unit: "N", min: 2, max: 40, step: 0.5, default: 10 },
    { key: "mu1", label: "Densidade linear da corda 1", unit: "kg/m", min: 0.02, max: 0.5, step: 0.01, default: 0.1 },
    { key: "A", label: "Amplitude da fonte", unit: "m", min: 0.1, max: 0.6, step: 0.01, default: 0.4, live: true },
    { key: "w", label: "Largura do pulso (σ)", unit: "m", min: 0.1, max: 0.8, step: 0.01, default: 0.3 },
    { key: "f", label: "Frequência (onda senoidal)", unit: "Hz", min: 0.5, max: 10, step: 0.1, default: 2, live: true },
  ],

  observables: [
    { key: "y1", label: "Deslocamento na sonda 1 (corda 1)", unit: "m", value: (s, p) => s.y[grid(p).i1] ?? 0 },
    { key: "y2", label: "Deslocamento na sonda 2 (corda 2)", unit: "m", value: (s, p) => s.y[grid(p).i2] ?? 0 },
    { key: "Rmed", label: "Razão refletida/incidente medida", unit: "", value: (s, p) => Rmed(s, p) },
    { key: "Tmed", label: "Razão transmitida/incidente medida", unit: "", value: (s, p) => Tmed(s, p) },
    { key: "E", label: "Energia na corda", unit: "J", value: (s, p) => energy(s, p) },
  ],
  chart: { x: "t", y: "y1" },

  scenarios: [
    {
      id: "fixa",
      label: "Reflexão na ponta fixa",
      params: { fonte: FONTE.gauss, ponta: PONTA.fixa, razao: 1 },
      guide: `### Pulso batendo numa parede
1. Uma única corda (μ₂ = μ₁), presa na parede à direita. Rode e acompanhe o pulso.
2. Observe o pulso refletido: ele volta **do mesmo lado** ou **invertido**?
3. Na ponta fixa a corda exerce uma força na parede e a parede devolve a força oposta, gerando um pulso invertido: $R = -1$.
4. Use o gráfico da sonda 1: o primeiro pico é o pulso incidente; o segundo, o refletido.`,
      predict: [
        {
          question: "Um pulso para cima chega à ponta presa na parede. Como volta?",
          options: ["Para cima, com a mesma amplitude", "Invertido (para baixo), com a mesma amplitude", "Não volta: a parede absorve o pulso"],
          answer: 1,
          explanation: "Na ponta fixa o deslocamento é sempre zero; isso equivale a somar um pulso invertido vindo do outro lado. O refletido tem $R = -1$.",
        },
      ],
    },
    {
      id: "livre",
      label: "Reflexão na ponta livre",
      params: { fonte: FONTE.gauss, ponta: PONTA.livre, razao: 1 },
      guide: `### Ponta presa a um anel sem atrito
1. Agora a ponta pode subir e descer livremente (inclinação nula: $\\partial y/\\partial x = 0$).
2. O pulso volta **sem inverter** ($R = +1$). Repare que, no instante da reflexão, a ponta sobe até o **dobro** da amplitude.
3. Mude para a ponta absorvente e confirme que nada volta.`,
    },
    {
      id: "densa",
      label: "Corda leve → corda pesada",
      params: { fonte: FONTE.gauss, ponta: PONTA.absorvente, razao: 4 },
      guide: `### Emenda com uma corda 4 vezes mais densa
1. Com $\\mu_2 = 4\\mu_1$ e a mesma tensão, $v_2 = v_1/2$ e $Z_2 = 2Z_1$.
2. A teoria prevê $R = (Z_1 - Z_2)/(Z_1 + Z_2) = -1/3$ e $\\tau = 2Z_1/(Z_1+Z_2) = 2/3$.
3. Rode até as duas medidas aparecerem nas equações ao vivo e compare.
4. Note que o pulso transmitido fica **mais estreito**: ele anda mais devagar, mas dura o mesmo tempo.`,
      predict: [
        {
          question: "O pulso passa de uma corda leve para uma pesada. O pulso refletido volta:",
          options: ["Invertido e menor que o incidente", "Do mesmo lado e menor que o incidente", "Com a mesma amplitude, invertido"],
          answer: 0,
          explanation: "Com $Z_2 > Z_1$, $R = (Z_1-Z_2)/(Z_1+Z_2)$ é negativo e com módulo menor que 1: a emenda se comporta como uma ponta fixa parcial.",
        },
      ],
    },
    {
      id: "leve",
      label: "Corda pesada → corda leve",
      params: { fonte: FONTE.gauss, ponta: PONTA.absorvente, razao: 0.25 },
      guide: `### Emenda com uma corda 4 vezes mais leve
1. Agora $Z_2 = Z_1/2$: espera-se $R = +1/3$ e $\\tau = 4/3$.
2. O pulso transmitido é **maior** que o incidente! Isso viola a conservação de energia?
3. Calcule a potência transportada, proporcional a $Z A^2$: $Z_1 (1)^2 = Z_1 (1/3)^2 + (Z_1/2)(4/3)^2$. Confira que os dois lados são iguais.
4. Troque a fonte para onda senoidal e compare os comprimentos de onda nas duas cordas.`,
    },
  ],

  exercises: [
    {
      id: "coef-reflexao",
      prompt:
        "Uma corda de densidade μ₁ = {mu1} kg/m está emendada a outra de densidade {razao} vezes maior; ambas estão sob tensão de {T} N. Um pulso chega pela corda leve. Qual a razão (com sinal) entre a amplitude refletida e a incidente?",
      vary: { mu1: [0.05, 0.3, 2], razao: [2, 9, 1], T: [4, 30, 0] },
      fixed: { fonte: FONTE.gauss, ponta: PONTA.absorvente },
      answer: { label: "R", unit: "", compute: (p) => coefR(p) },
      hint: "Z = √(Tμ). A tensão é a mesma nas duas cordas, então só a razão das densidades importa.",
    },
    {
      id: "tempo-percurso",
      prompt: "Quanto tempo um pulso leva para percorrer os {L} m de uma corda com densidade {mu1} kg/m sob tensão de {T} N?",
      vary: { mu1: [0.02, 0.5, 2], T: [2, 40, 0] },
      fixed: { L: L1 },
      answer: { label: "Δt", unit: "s", compute: (p) => num(p, "L", L1) / Math.sqrt(num(p, "T") / num(p, "mu1")) },
      hint: "v = √(T/μ).",
    },
  ],

  init(p) {
    const g = grid(p);
    return { n: 0, y: new Float64Array(g.N + 1), yp: new Float64Array(g.N + 1), fPrev: 0, fCur: 0, t0: 0, hand: 0, refl: 0, trans: 0 };
  },
  step(s, p, t, dt) {
    const h = grid(p).h;
    const target = Math.floor((t + dt) / h + 1e-9);
    return advance(s, p, Math.max(0, target - s.n));
  },
  dt: 2e-3,
  sampleEvery: 5,
  maxSamples: 1500,
  tEnd: 30,

  pointer: {
    down: (s, p, pt) => (Math.round(num(p, "fonte")) === FONTE.mao && pt.x < 1 ? { ...s, hand: Math.max(-1, Math.min(1, pt.y)) } : undefined),
    move: (s, p, pt, dragging) =>
      dragging && Math.round(num(p, "fonte")) === FONTE.mao ? { ...s, hand: Math.max(-1, Math.min(1, pt.y)) } : undefined,
    up: (s, p) => (Math.round(num(p, "fonte")) === FONTE.mao ? { ...s, hand: 0 } : undefined),
    cursor: (_s, p, pt) => (Math.round(num(p, "fonte")) === FONTE.mao && pt.x < 1 ? "ns-resize" : undefined),
  },
  actions: [
    {
      id: "pulso",
      label: "Enviar novo pulso",
      run: (s, p) => ({ ...s, t0: tOf(s, p), refl: 0, trans: 0 }),
    },
    {
      id: "calma",
      label: "Acalmar a corda",
      run: (s) => ({ ...s, y: new Float64Array(s.y.length), yp: new Float64Array(s.y.length), fPrev: 0, fCur: 0, t0: 1e9, refl: 0, trans: 0 }),
    },
  ],

  viewport: (p) => ({ xMin: -0.7, xMax: grid(p).x[grid(p).N]! + 0.7, yMin: -1.6, yMax: 1.6, unit: "m" }),

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const { state: s, params: p, theme } = frame;
    const g = grid(p);
    const xe = g.x[g.N]!;
    const razao = num(p, "razao", 1);
    const ponta = Math.round(num(p, "ponta"));

    // Sondas
    for (const [i, nome] of [[g.i1, "sonda 1"], [g.i2, "sonda 2"]] as const) {
      const x = g.x[i]!;
      d.line(x, -1.15, x, 1.15, { color: theme.muted, dash: [4, 4], width: 1 });
      d.text(nome, x, -1.27, { color: theme.muted, size: 10 });
    }

    // Corda 1 e corda 2 (a mais densa é desenhada mais grossa)
    const pts1: [number, number][] = [];
    const pts2: [number, number][] = [];
    for (let i = 0; i <= g.N; i++) {
      const pt: [number, number] = [g.x[i]!, s.y[i] ?? 0];
      if (i <= g.J) pts1.push(pt);
      if (i >= g.J) pts2.push(pt);
    }
    d.polyline(pts1, { color: theme.series[0], width: 2.5 });
    d.polyline(pts2, { color: theme.series[1], width: Math.max(1.2, Math.min(7, 2.5 * Math.sqrt(razao))) });
    if (Math.abs(razao - 1) > 1e-6) {
      d.dot(L1, s.y[g.J] ?? 0, 4, theme.text);
      d.text("emenda", L1, 1.3, { color: theme.muted, size: 10 });
    }

    // Fonte (mão / oscilador) na ponta esquerda
    const y0 = s.y[0] ?? 0;
    d.line(-0.25, -1.1, -0.25, 1.1, { color: theme.muted, width: 1, dash: [3, 3] });
    d.rect(-0.45, y0 - 0.12, 0.4, 0.24, { fill: theme.series[2], stroke: theme.text, width: 1 });
    d.line(-0.05, y0, 0, y0, { color: theme.text, width: 2 });
    d.text(Math.round(num(p, "fonte")) === FONTE.mao ? "arraste" : "fonte", -0.25, -1.4, { color: theme.muted, size: 10 });

    // Ponta direita
    if (ponta === PONTA.fixa) d.support(xe, -1.2, xe, 1.2, { color: theme.text });
    else if (ponta === PONTA.livre) {
      d.line(xe + 0.08, -1.2, xe + 0.08, 1.2, { color: theme.text, width: 2 });
      d.circle(xe + 0.04, s.y[g.N] ?? 0, 0.06, { stroke: theme.text, width: 2, minPx: 4 });
    } else {
      d.rect(xe - 0.05, -1.2, 0.5, 2.4, { fill: theme.ground });
      d.text("amortecedor", xe + 0.2, -1.4, { color: theme.muted, size: 10 });
    }
    d.text(`ponta ${PONTA_NOME[ponta] ?? ""}`, xe, 1.45, { color: theme.muted, size: 10, align: "right" });

    // Velocidades de propagação
    d.arrowPx(0.4, 1.3, 1, 0, 30, { color: theme.series[0] });
    d.text(`v₁ = ${g.v1.toFixed(1).replace(".", ",")} m/s`, 0.4, 1.3, { color: theme.series[0], size: 11, align: "left", dx: 36 });
    d.arrowPx(L1 + 0.4, 1.3, 1, 0, 30, { color: theme.series[1] });
    d.text(`v₂ = ${g.v2.toFixed(1).replace(".", ",")} m/s`, L1 + 0.4, 1.3, { color: theme.series[1], size: 11, align: "left", dx: 36 });

    // Coeficientes
    const R = coefR(p);
    const Tc = coefT(p);
    let legenda = uniforme(p)
      ? `corda única: R na ponta ${PONTA_NOME[ponta] ?? ""} = ${coefPonta(p)}`
      : `teoria: R = ${R.toFixed(3).replace(".", ",")}   τ = ${Tc.toFixed(3).replace(".", ",")}`;
    if (isGauss(p) && s.refl !== 0) legenda += `   |   medido: R = ${Rmed(s, p).toFixed(3).replace(".", ",")}`;
    if (isGauss(p) && s.trans !== 0) legenda += `   τ = ${Tmed(s, p).toFixed(3).replace(".", ",")}`;
    d.text(legenda, (L1 + L2) / 2, -1.55, { color: theme.text, size: 11 });
  },
});

export default ondaCorda;
