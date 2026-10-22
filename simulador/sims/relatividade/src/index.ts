import { clamp, defineSim, draw, num, texNum, type Draw, type Params, type Theme } from "@fisilab/core";

/** Unidades com c = 1: x em anos-luz (al), ct em anos. */
export interface Evento {
  x: number;
  ct: number;
}

export interface RelState {
  /** Tempo coordenado no referencial S (anos). */
  T: number;
  /** Eventos A e B arrastáveis no diagrama. */
  ev: [Evento, Evento];
  drag: number;
}

/** Anos de S por segundo de animação. */
export const RATE = 0.5;
/** Período próprio do relógio de luz (ida e volta), em anos. */
export const T0 = 2;

export const gammaOf = (beta: number) => 1 / Math.sqrt(1 - beta * beta);

/** Transformação de Lorentz de S para S' (S' com velocidade βc ao longo de +x). */
export function lorentz(e: Evento, beta: number): Evento {
  const g = gammaOf(beta);
  return { x: g * (e.x - beta * e.ct), ct: g * (e.ct - beta * e.x) };
}

/** Intervalo s² = (cΔt)² − Δx² (invariante). */
export const interval = (a: Evento, b: Evento) => (b.ct - a.ct) ** 2 - (b.x - a.x) ** 2;

export const PRESETS: [Evento, Evento][] = [
  [
    { x: -1, ct: 2 },
    { x: 2, ct: 2 },
  ],
  [
    { x: -0.5, ct: 1 },
    { x: 0.8, ct: 3.6 },
  ],
  [
    { x: -2.5, ct: 1.5 },
    { x: 2, ct: 3 },
  ],
];

const beta = (p: Params) => clamp(num(p, "beta", 0.6), -0.99, 0.99);

// Caixa do diagrama
const BOX = { x0: -4.2, x1: 4.2, y0: -1.2, y1: 5.2 };
// Painel dos relógios e réguas (2 unidades do painel por ano-luz, então c = 2 unidades/ano)
const PAN = { x0: 5.3, x1: 13.4, k: 2 };

/** Recorta o segmento à caixa do diagrama (Liang–Barsky). */
function clip(x1: number, y1: number, x2: number, y2: number): [number, number, number, number] | null {
  let t0 = 0;
  let t1 = 1;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const tests: [number, number][] = [
    [-dx, x1 - BOX.x0],
    [dx, BOX.x1 - x1],
    [-dy, y1 - BOX.y0],
    [dy, BOX.y1 - y1],
  ];
  for (const [pp, q] of tests) {
    if (Math.abs(pp) < 1e-12) {
      if (q < 0) return null;
      continue;
    }
    const r = q / pp;
    if (pp < 0) t0 = Math.max(t0, r);
    else t1 = Math.min(t1, r);
    if (t0 > t1) return null;
  }
  return [x1 + t0 * dx, y1 + t0 * dy, x1 + t1 * dx, y1 + t1 * dy];
}

function cline(d: Draw, x1: number, y1: number, x2: number, y2: number, s: Parameters<Draw["line"]>[4]) {
  const c = clip(x1, y1, x2, y2);
  if (c) d.line(c[0], c[1], c[2], c[3], s);
}

const fmt = (v: number, digits = 3) => {
  const r = Number(v.toPrecision(digits));
  return (Object.is(r, -0) ? "0" : r.toString()).replace(".", ",").replace("-", "−");
};

const hit = (s: RelState, x: number, y: number) => s.ev.findIndex((e) => Math.hypot(e.x - x, e.ct - y) < 0.3);

export const relatividade = defineSim<RelState>({
  id: "relatividade",
  title: "Relatividade restrita: dilatação do tempo, contração e simultaneidade",
  course: "FG IV",
  topic: "Relatividade",
  priority: "P1",
  summary:
    "Diagrama de Minkowski interativo: arraste eventos, mude a velocidade β do referencial S' e veja eixos, simultaneidade e intervalos se transformarem. Relógio de luz e régua mostram γ.",
  equations: [
    String.raw`x' = \gamma\,(x - \beta\,ct),\qquad ct' = \gamma\,(ct - \beta x),\qquad \gamma = \frac{1}{\sqrt{1 - \beta^2}},\ \beta = \frac{v}{c}`,
    String.raw`\Delta t = \gamma\,\Delta\tau \quad\text{(dilatação)},\qquad L = \frac{L_0}{\gamma} \quad\text{(contração)}`,
    String.raw`s^2 = (c\Delta t)^2 - \Delta x^2 = (c\Delta t')^2 - \Delta x'^2 \quad\text{(invariante)}`,
    String.raw`\Delta t = 0 \;\Rightarrow\; c\Delta t' = -\gamma\beta\,\Delta x \quad\text{(simultaneidade é relativa)}`,
  ],
  liveEquations(s, p) {
    const b = beta(p);
    const g = gammaOf(b);
    const [A, B] = s.ev;
    const a = lorentz(A, b);
    const bb = lorentz(B, b);
    return [
      String.raw`\beta = ${texNum(b)} \Rightarrow \gamma = ${texNum(g, 4)}`,
      String.raw`A' = (${texNum(a.x)}\,\text{al},\ ${texNum(a.ct)}\,\text{anos}),\quad B' = (${texNum(bb.x)}\,\text{al},\ ${texNum(bb.ct)}\,\text{anos})`,
      String.raw`\Delta t = ${texNum(B.ct - A.ct)}\ \text{anos},\quad \Delta t' = ${texNum(bb.ct - a.ct)}\ \text{anos},\quad s^2 = ${texNum(interval(A, B))}\ \text{al}^2`,
      String.raw`t = ${texNum(s.T)}\ \text{anos} \Rightarrow \tau = t/\gamma = ${texNum(s.T / g)}\ \text{anos};\quad L = L_0/\gamma = ${texNum(num(p, "L0", 2) / g)}\ \text{al}`,
    ];
  },

  params: [
    { key: "beta", label: "Velocidade de S' (β = v/c)", unit: "", min: -0.95, max: 0.95, step: 0.01, default: 0.6, live: true },
    { key: "L0", label: "Comprimento próprio da régua L₀", unit: "al", min: 0.5, max: 3, step: 0.1, default: 2, live: true },
    {
      key: "eventos",
      label: "Eventos A e B iniciais",
      unit: "",
      min: 0,
      max: 2,
      step: 1,
      default: 0,
      options: [
        { value: 0, label: "Simultâneos em S" },
        { value: 1, label: "Separação tipo tempo" },
        { value: 2, label: "Separação tipo espaço" },
      ],
    },
  ],

  observables: [
    { key: "T", label: "Tempo em S", unit: "anos", value: (s) => s.T },
    { key: "tau", label: "Tempo próprio do relógio móvel τ", unit: "anos", value: (s, p) => s.T / gammaOf(beta(p)) },
    { key: "gamma", label: "Fator de Lorentz γ", unit: "", value: (_s, p) => gammaOf(beta(p)) },
    { key: "L", label: "Comprimento medido em S (L₀/γ)", unit: "al", value: (_s, p) => num(p, "L0", 2) / gammaOf(beta(p)) },
    { key: "dt", label: "Δt entre A e B em S", unit: "anos", value: (s) => s.ev[1].ct - s.ev[0].ct },
    { key: "dtp", label: "Δt' entre A e B em S'", unit: "anos", value: (s, p) => lorentz(s.ev[1], beta(p)).ct - lorentz(s.ev[0], beta(p)).ct },
    {
      key: "s2",
      label: "Intervalo s² calculado em S'",
      unit: "al²",
      value: (s, p) => interval(lorentz(s.ev[0], beta(p)), lorentz(s.ev[1], beta(p))),
    },
  ],
  conserved: "s2",
  chart: { x: "T", y: "tau" },

  scenarios: [
    {
      id: "simultaneidade",
      label: "Simultaneidade relativa",
      params: { beta: 0.6, eventos: 0 },
      guide: `### Agora para quem?
1. A e B acontecem no mesmo instante em S (mesma altura no diagrama).
2. As linhas tracejadas passando por A e B são paralelas ao eixo $x'$: são as linhas de simultaneidade de S'. Qual evento acontece primeiro em S'?
3. Mude β ao vivo, inclusive para valores negativos. A ordem se inverte?
4. Arraste os eventos. Confira que $s^2$ (medidas) não muda com β, mesmo quando $\\Delta t'$ muda.`,
      predict: [
        {
          question: "A e B são simultâneos em S e B está mais à direita. Para S' movendo-se para a direita (β > 0):",
          options: ["A acontece antes de B", "B acontece antes de A", "continuam simultâneos"],
          answer: 1,
          explanation: "$c\\Delta t' = \\gamma(c\\Delta t - \\beta\\Delta x) = -\\gamma\\beta\\Delta x < 0$: em S', B ocorre antes. As linhas de simultaneidade de S' são inclinadas e cruzam B antes de A.",
        },
      ],
    },
    {
      id: "dilatacao",
      label: "Relógio de luz: dilatação do tempo",
      params: { beta: 0.8, eventos: 1 },
      guide: `### O relógio que anda atrasa
1. Rode. À direita, dois relógios de luz idênticos: um parado em S e um a bordo de S'. Em cada tique o fóton vai e volta entre os espelhos.
2. Visto de S, o fóton do relógio móvel percorre uma diagonal mais longa, à mesma velocidade $c$: o tique demora $\\gamma$ vezes mais.
3. No diagrama, a linha de mundo do relógio móvel (eixo $ct'$) tem marcas de $\\tau$ = 1, 2, … anos. Elas ficam nas hipérboles $c^2t^2 - x^2 = \\tau^2$.
4. Compare no gráfico $\\tau(t)$: a inclinação é $1/\\gamma$.`,
      predict: [
        {
          question: "Com β = 0,8, quando o relógio móvel marca 3 anos, o relógio de S marca:",
          options: ["1,8 ano", "3 anos", "5 anos", "3,75 anos"],
          answer: 2,
          explanation: "$\\gamma = 1/\\sqrt{1 - 0{,}64} = 5/3$, então $t = \\gamma\\tau = 5$ anos.",
        },
      ],
    },
    {
      id: "contracao",
      label: "Régua contraída",
      params: { beta: 0.866, L0: 2, eventos: 2 },
      guide: `### Medir as duas pontas ao mesmo tempo
1. A faixa sombreada no diagrama é a "linha de mundo" da régua, em repouso em S'.
2. Em S, medir o comprimento é marcar as duas pontas **no mesmo $t$** (segmento horizontal): dá $L_0/\\gamma$.
3. Em S', as pontas são marcadas no mesmo $t'$ (segmento ao longo de $x'$): dá $L_0$.
4. Com β = 0,866, γ ≈ 2. Confira $L = 1$ al nas medidas. A contração depende de qual par de eventos cada observador chama de "simultâneo".`,
    },
  ],

  exercises: [
    {
      id: "dilatacao",
      prompt: "Uma nave viaja a {beta}c em relação à Terra. O relógio de bordo marca {tau} anos de viagem. Quanto tempo passou no referencial da Terra?",
      vary: { beta: [0.3, 0.99, 2], tau: [1, 20, 1] },
      answer: { label: "t", unit: "anos", compute: (p) => gammaOf(num(p, "beta")) * num(p, "tau") },
    },
    {
      id: "contracao",
      prompt: "Uma régua de comprimento próprio {L0} m passa por você a {beta}c, paralela ao movimento. Que comprimento você mede?",
      vary: { L0: [0.5, 3, 1], beta: [0.3, 0.95, 2] },
      answer: { label: "L", unit: "m", compute: (p) => num(p, "L0") / gammaOf(num(p, "beta")) },
    },
    {
      id: "simultaneidade",
      prompt:
        "No referencial S, os eventos A e B são simultâneos e B ocorre {dx} anos-luz à direita de A. Um referencial S' se move a {beta}c para a direita. Quanto vale t'_B − t'_A (em anos)?",
      vary: { dx: [0.5, 5, 1], beta: [0.2, 0.9, 2] },
      answer: { label: "Δt'", unit: "anos", compute: (p) => -gammaOf(num(p, "beta")) * num(p, "beta") * num(p, "dx") },
      hint: "ct' = γ(ct − βx); com Δt = 0 sobra só o termo −γβΔx. Atenção ao sinal.",
    },
  ],

  init: (p) => {
    const pr = PRESETS[Math.round(num(p, "eventos"))] ?? PRESETS[0]!;
    return { T: 0, ev: [{ ...pr[0] }, { ...pr[1] }], drag: -1 };
  },
  step: (s, _p, _t, dt) => ({ ...s, T: s.T + RATE * dt }),
  dt: 0.01,
  sampleEvery: 5,
  tEnd: 5 / RATE,

  pointer: {
    down(s, _p, pt) {
      const i = hit(s, pt.x, pt.y);
      return i >= 0 ? { ...s, drag: i } : undefined;
    },
    move(s, _p, pt, dragging) {
      if (!dragging || s.drag < 0) return undefined;
      const e = { x: clamp(Math.round(pt.x * 20) / 20, BOX.x0, BOX.x1), ct: clamp(Math.round(pt.y * 20) / 20, BOX.y0, BOX.y1) };
      const ev: [Evento, Evento] = s.drag === 0 ? [e, s.ev[1]] : [s.ev[0], e];
      return { ...s, ev };
    },
    up: (s) => (s.drag >= 0 ? { ...s, drag: -1 } : undefined),
    cursor: (s, _p, pt) => (hit(s, pt.x, pt.y) >= 0 ? "grab" : undefined),
  },
  actions: [
    { id: "trocar", label: "Trocar A e B de lugar", run: (s) => ({ ...s, ev: [s.ev[1], s.ev[0]] }) },
  ],

  viewport: () => ({ xMin: -4.8, xMax: 13.6, yMin: -2, yMax: 5.9 }),

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const { state: s, params: p, theme } = frame;
    renderDiagram(d, theme, s, p);
    renderPanel(d, theme, s, p);
  },
});

function renderDiagram(d: Draw, theme: Theme, s: RelState, p: Params) {
  const b = beta(p);
  const g = gammaOf(b);
  const L0 = num(p, "L0", 2);
  const primed = theme.series[1]!;
  d.rect(BOX.x0, BOX.y0, BOX.x1 - BOX.x0, BOX.y1 - BOX.y0, { stroke: theme.grid, width: 1 });
  // Grade de S
  d.grid(BOX.x0, BOX.x1, BOX.y0, BOX.y1, 1);
  // Grade de S' (linhas de x' e t' constantes)
  for (let k = -9; k <= 9; k++) {
    if (k === 0) continue;
    cline(d, b * BOX.y0 + k / g, BOX.y0, b * BOX.y1 + k / g, BOX.y1, { color: primed, width: 1, alpha: 0.18 });
    cline(d, BOX.x0, b * BOX.x0 + k / g, BOX.x1, b * BOX.x1 + k / g, { color: primed, width: 1, alpha: 0.18 });
  }
  // Régua em repouso em S': pontas em x' = 0 e x' = L0
  const strip: [number, number][] = [
    [b * BOX.y0, BOX.y0],
    [b * BOX.y1, BOX.y1],
    [b * BOX.y1 + L0 / g, BOX.y1],
    [b * BOX.y0 + L0 / g, BOX.y0],
  ];
  d.ctx.save();
  d.ctx.beginPath();
  d.ctx.rect(BOX.x0, BOX.y0, BOX.x1 - BOX.x0, BOX.y1 - BOX.y0);
  d.ctx.clip();
  d.polyline(strip, { close: true, fill: primed, color: "none", alpha: 0.1 });
  d.ctx.restore();
  // Hipérboles invariantes
  for (const k of [1, 2, 3, 4]) {
    const fut: [number, number][] = [];
    for (let i = 0; i <= 120; i++) {
      const x = BOX.x0 + ((BOX.x1 - BOX.x0) * i) / 120;
      const ct = Math.sqrt(k * k + x * x);
      if (ct <= BOX.y1) fut.push([x, ct]);
    }
    d.polyline(fut, { color: theme.muted, width: 1, dash: [2, 3], alpha: 0.7 });
    for (const sg of [-1, 1]) {
      const sp: [number, number][] = [];
      for (let i = 0; i <= 120; i++) {
        const ct = BOX.y0 + ((BOX.y1 - BOX.y0) * i) / 120;
        const x = sg * Math.sqrt(k * k + ct * ct);
        if (Math.abs(x) <= BOX.x1) sp.push([x, ct]);
      }
      d.polyline(sp, { color: theme.muted, width: 1, dash: [2, 3], alpha: 0.45 });
    }
  }
  // Cone de luz
  cline(d, -6, -6, 6, 6, { color: theme.series[5]!, width: 2 });
  cline(d, 6, -6, -6, 6, { color: theme.series[5]!, width: 2 });
  d.text("luz", 4.3 - 0.35, 4.3 - 0.0, { color: theme.series[5]!, size: 10, align: "right" });
  // Eixos de S
  d.arrow(BOX.x0, 0, BOX.x1 - BOX.x0, 0, { color: theme.text, width: 1.5 });
  d.arrow(0, BOX.y0, 0, BOX.y1 - BOX.y0, { color: theme.text, width: 1.5 });
  d.text("x (al)", BOX.x1, -0.35, { color: theme.text, size: 11, align: "right" });
  d.text("ct (anos)", 0.12, BOX.y1 - 0.15, { color: theme.text, size: 11, align: "left" });
  for (let k = -4; k <= 4; k++) if (k) d.text(`${k}`.replace("-", "−"), k, -0.3, { color: theme.muted, size: 9 });
  for (let k = 1; k <= 5; k++) d.text(`${k}`, -0.15, k, { color: theme.muted, size: 9, align: "right" });
  // Eixos de S'
  const ctp = clip(b * BOX.y0, BOX.y0, b * BOX.y1, BOX.y1);
  if (ctp) d.arrow(ctp[0], ctp[1], ctp[2] - ctp[0], ctp[3] - ctp[1], { color: primed, width: 2 });
  const xp = clip(BOX.x0, b * BOX.x0, BOX.x1, b * BOX.x1);
  if (xp) d.arrow(xp[0], xp[1], xp[2] - xp[0], xp[3] - xp[1], { color: primed, width: 2 });
  if (ctp) d.text("ct'", ctp[2] + 0.2, ctp[3] - 0.2, { color: primed, size: 12, weight: "600", align: "left" });
  if (xp) d.text("x'", xp[2] - 0.1, xp[3] + 0.3, { color: primed, size: 12, weight: "600", align: "right" });
  // Marcas calibradas: ct' = k em (γβk, γk), x' = k em (γk, γβk)
  for (let k = -5; k <= 5; k++) {
    if (!k) continue;
    const [tx, ty] = [g * b * k, g * k];
    if (tx >= BOX.x0 && tx <= BOX.x1 && ty >= BOX.y0 && ty <= BOX.y1) {
      d.dot(tx, ty, 3, primed);
      if (k > 0) d.text(`τ=${k}`, tx + 0.12, ty, { color: primed, size: 9, align: "left" });
    }
    const [ux, uy] = [g * k, g * b * k];
    if (ux >= BOX.x0 && ux <= BOX.x1 && uy >= BOX.y0 && uy <= BOX.y1) d.dot(ux, uy, 3, primed);
  }

  // Medida da régua: em S (mesmo t = T) e em S' (ao longo de x')
  const T = Math.min(s.T, BOX.y1);
  if (T > 0) {
    d.line(b * T, T, b * T + L0 / g, T, { color: theme.positive, width: 3 });
    d.text(`L = L₀/γ = ${fmt(L0 / g)}`, b * T + L0 / (2 * g), T + 0.25, { color: theme.positive, size: 10 });
  }
  const end: [number, number] = [g * L0, g * b * L0]; // x' = L0, t' = 0
  if (end[0] <= BOX.x1 && end[1] <= BOX.y1 && end[1] >= BOX.y0) {
    d.line(0, 0, end[0], end[1], { color: primed, width: 3, alpha: 0.6 });
    d.text("L₀", end[0] / 2, end[1] / 2 - 0.25, { color: primed, size: 10, weight: "600" });
  }
  // Agora em S e o relógio móvel
  if (s.T <= BOX.y1) {
    d.line(BOX.x0, s.T, BOX.x1, s.T, { color: theme.accent, width: 1.2, dash: [6, 4] });
    d.dot(0, s.T, 5, theme.text);
    if (Math.abs(b * s.T) <= BOX.x1) d.dot(b * s.T, s.T, 6, primed);
    d.text(`t = ${fmt(s.T)} anos`, BOX.x0 + 0.1, s.T + 0.2, { color: theme.accent, size: 10, align: "left" });
  }

  // Eventos A e B com as linhas de simultaneidade de S'
  const names = ["A", "B"];
  s.ev.forEach((e, i) => {
    const col = theme.series[i === 0 ? 0 : 3]!;
    // reta ct − βx = const passando por e
    cline(d, BOX.x0, e.ct + b * (BOX.x0 - e.x), BOX.x1, e.ct + b * (BOX.x1 - e.x), { color: col, width: 1.2, dash: [5, 4] });
    d.circle(e.x, e.ct, 0.13, { fill: col, stroke: theme.text, width: 1 });
    const ep = lorentz(e, b);
    d.text(`${names[i]} (${fmt(e.x, 2)}; ${fmt(e.ct, 2)})  ${names[i]}' (${fmt(ep.x, 2)}; ${fmt(ep.ct, 2)})`, e.x + 0.22, e.ct + 0.3, {
      color: col,
      size: 10,
      weight: "600",
      align: "left",
    });
  });
  const [A, B] = s.ev;
  const s2 = interval(A, B);
  const kind = Math.abs(s2) < 1e-9 ? "tipo luz" : s2 > 0 ? "tipo tempo (ordem causal fixa)" : "tipo espaço (ordem depende do referencial)";
  const dtp = lorentz(B, b).ct - lorentz(A, b).ct;
  d.text(
    `β = ${fmt(b, 2)} · γ = ${fmt(gammaOf(b), 4)} · Δt' (B − A) = ${fmt(dtp)} anos · s² = ${fmt(s2)} al², ${kind}`,
    BOX.x0,
    -1.75,
    { color: theme.text, size: 11, align: "left" },
  );
}

/** Onda triangular de 0 a 1 a 0 com período 1. */
const tri = (u: number) => {
  const f = u - Math.floor(u);
  return f < 0.5 ? 2 * f : 2 - 2 * f;
};

function lightClock(d: Draw, theme: Theme, x: number, y0: number, h: number, phase: number, color: string) {
  d.rect(x - 0.45, y0 - 0.12, 0.9, 0.12, { fill: theme.muted });
  d.rect(x - 0.45, y0 + h, 0.9, 0.12, { fill: theme.muted });
  d.dot(x, y0 + h * tri(phase), 5, color);
}

function renderPanel(d: Draw, theme: Theme, s: RelState, p: Params) {
  const b = beta(p);
  const g = gammaOf(b);
  const k = PAN.k;
  const H = (T0 / 2) * k; // altura do relógio: luz leva T0/2 para subir
  const y0 = 2.6;
  const span = PAN.x1 - PAN.x0 - 2.2;
  const xStart = b >= 0 ? PAN.x0 + 2.2 : PAN.x1 - 0.6;
  const wrap = (x: number) => PAN.x0 + 1.6 + ((((x - (PAN.x0 + 1.6)) % span) + span) % span);
  const photon = theme.series[5]!;
  const primed = theme.series[1]!;
  d.text("Relógios de luz (vistos de S)", PAN.x0, 5.6, { color: theme.text, size: 12, weight: "600", align: "left" });
  // Relógio em repouso em S
  lightClock(d, theme, PAN.x0 + 0.6, y0, H, s.T / T0, photon);
  d.text("em S", PAN.x0 + 0.6, y0 - 0.45, { color: theme.muted, size: 10 });
  // Relógio a bordo de S' (fase pelo tempo próprio)
  const tau = s.T / g;
  const xm = wrap(xStart + b * k * s.T);
  // Rastro em zigue-zague do fóton visto de S
  const pts: [number, number][] = [];
  let prevX = NaN;
  for (let i = 0; i <= 80; i++) {
    const Ti = Math.max(0, s.T - 2.5 * g) + ((s.T - Math.max(0, s.T - 2.5 * g)) * i) / 80;
    const xi = wrap(xStart + b * k * Ti);
    if (Number.isFinite(prevX) && Math.abs(xi - prevX) > span / 2) pts.length = 0;
    pts.push([xi, y0 + H * tri(Ti / g / T0)]);
    prevX = xi;
  }
  d.polyline(pts, { color: photon, width: 1.2, alpha: 0.6 });
  lightClock(d, theme, xm, y0, H, tau / T0, photon);
  d.arrowPx(xm, y0 - 0.5, Math.sign(b) || 1, 0, Math.abs(b) * 40, { color: primed });
  d.text("em S'", xm, y0 - 0.85, { color: primed, size: 10 });
  d.text(
    `tiques: em S ${Math.floor(s.T / T0)} · em S' ${Math.floor(tau / T0)} · período visto de S = γT₀ = ${fmt(g * T0)} anos`,
    PAN.x0,
    1.45,
    { color: theme.muted, size: 10, align: "left" },
  );

  // Réguas
  const L0 = num(p, "L0", 2);
  const yr = 0.2;
  d.text("Régua (repouso em S')", PAN.x0, yr + 0.6, { color: theme.text, size: 12, weight: "600", align: "left" });
  d.text(`própria: L₀ = ${fmt(L0)} al`, PAN.x0, yr, { color: theme.muted, size: 10, align: "left" });
  d.rect(PAN.x0, yr - 0.45, L0 * k, 0.3, { fill: primed, alpha: 0.35, stroke: primed, width: 1 });
  d.text(`medida em S: L₀/γ = ${fmt(L0 / g)} al`, PAN.x0, yr - 0.8, { color: theme.muted, size: 10, align: "left" });
  d.rect(PAN.x0, yr - 1.35, (L0 * k) / g, 0.3, { fill: theme.positive, alpha: 0.35, stroke: theme.positive, width: 1 });
  for (let i = 0; i <= Math.floor(L0); i++) d.line(PAN.x0 + i * k, yr - 0.45, PAN.x0 + i * k, yr - 0.6, { color: theme.muted, width: 1 });
}

export default relatividade;
