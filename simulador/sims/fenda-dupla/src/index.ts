import { defineSim, draw, num, texNum, type Params } from "@fisilab/core";
import {
  colorAt,
  cssRGB,
  envelopeAt,
  fringeSpacing,
  fringesInCentral,
  intensityAt,
  sinTheta,
  whiteIntensity,
  wavelengthRGB,
  type Slits,
} from "./optica.ts";
import { derivation } from "./derivation.ts";

export * from "./optica.ts";

/** Duração da varredura do detector ao longo da tela (s). */
export const T_SCAN = 10;

const BRANCA = 1;
const isWhite = (p: Params) => Math.round(num(p, "fonte")) === BRANCA;
const win = (p: Params) => Math.max(0.5, num(p, "W", 20));

export function slitsOf(p: Params): Slits {
  const d = num(p, "d", 0.25);
  return {
    lambda: num(p, "lambda", 633),
    d,
    a: Math.min(num(p, "a", 0.04), 0.95 * d),
    L: num(p, "L", 1.5),
    model: Math.round(num(p, "modelo")),
  };
}

/** Intensidade relativa medida pelo detector (média espectral com luz branca). */
export const detectorI = (yMm: number, p: Params) => (isWhite(p) ? whiteIntensity(yMm, slitsOf(p)) : intensityAt(yMm, slitsOf(p)));

/** Posição do detector (mm) em função do tempo: varre a tela de −W a +W. */
export const scanY = (p: Params, t: number) => -win(p) + (2 * win(p) * Math.min(t, T_SCAN)) / T_SCAN;

// Layout do palco (unidades arbitrárias; o esquema não está em escala)
const BAR_X = 3;
const SCR_X0 = 10.5;
const SCR_X1 = 11.9;
const G_X0 = 12.7;
const G_X1 = 19.4;
const HALF = 5.5;

const yw = (yMm: number, p: Params) => (yMm / win(p)) * HALF;

export const fendaDupla = defineSim({
  id: "fenda-dupla",
  title: "Fenda dupla de Young",
  course: "FG IV",
  topic: "Interferência",
  priority: "P1",
  summary:
    "Luz atravessa duas fendas e forma franjas na tela. Ajuste λ, d, a e L, compare com a envoltória de difração e veja as franjas coloridas da luz branca.",
  derivation,
  equations: [
    String.raw`I(\theta) = I_0 \cos^2\!\left(\frac{\pi d \,\text{sen}\,\theta}{\lambda}\right)\left[\frac{\text{sen}\,\beta}{\beta}\right]^2,\qquad \beta = \frac{\pi a\,\text{sen}\,\theta}{\lambda}`,
    String.raw`\text{máximos: } d\,\text{sen}\,\theta = m\lambda \qquad \text{zeros da envoltória: } a\,\text{sen}\,\theta = p\lambda`,
    String.raw`\Delta y \approx \frac{\lambda L}{d} \quad (\theta \text{ pequeno}),\qquad \text{sen}\,\theta = \frac{y}{\sqrt{y^2 + L^2}}`,
  ],
  liveEquations(s, p) {
    const sl = slitsOf(p);
    const out = [
      String.raw`\Delta y = \frac{(${texNum(sl.lambda)}\times 10^{-9}\,\text{m})(${texNum(sl.L)}\,\text{m})}{${texNum(sl.d)}\times 10^{-3}\,\text{m}} = ${texNum(fringeSpacing(sl))}\ \text{mm}`,
      String.raw`y = ${texNum(s[0] ?? 0)}\ \text{mm} \;\Rightarrow\; m = \frac{d\,\text{sen}\,\theta}{\lambda} = ${texNum(((sl.d * 1e-3 * sinTheta(s[0] ?? 0, sl.L)) / (sl.lambda * 1e-9)), 3)},\quad I/I_0 = ${texNum(detectorI(s[0] ?? 0, p), 3)}`,
    ];
    if (sl.model === 0)
      out.push(
        String.raw`d/a = ${texNum(sl.d / sl.a)} \;\Rightarrow\; ${fringesInCentral(sl.d, sl.a)}\ \text{franjas claras no máximo central}`,
      );
    return out;
  },

  params: [
    {
      key: "fonte",
      label: "Fonte",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 0,
      options: [
        { value: 0, label: "Laser (monocromática)" },
        { value: 1, label: "Luz branca (400–700 nm)" },
      ],
    },
    {
      key: "modelo",
      label: "Fendas",
      unit: "",
      min: 0,
      max: 2,
      step: 1,
      default: 0,
      options: [
        { value: 0, label: "Duas fendas reais (com difração)" },
        { value: 1, label: "Duas fendas muito estreitas (só interferência)" },
        { value: 2, label: "Só uma fenda aberta" },
      ],
    },
    { key: "lambda", label: "Comprimento de onda λ", unit: "nm", min: 380, max: 750, step: 1, default: 633, live: true },
    { key: "d", label: "Separação entre fendas d", unit: "mm", min: 0.05, max: 1, step: 0.01, default: 0.25 },
    { key: "a", label: "Largura de cada fenda a", unit: "mm", min: 0.01, max: 0.3, step: 0.005, default: 0.04 },
    { key: "L", label: "Distância até a tela L", unit: "m", min: 0.5, max: 5, step: 0.1, default: 1.5 },
    { key: "W", label: "Meia altura da tela mostrada", unit: "mm", min: 2, max: 60, step: 1, default: 20 },
  ],

  observables: [
    { key: "y", label: "Posição do detector y", unit: "mm", value: (s) => s[0] ?? 0 },
    { key: "I", label: "Intensidade relativa I/I₀", unit: "", value: (s, p) => detectorI(s[0] ?? 0, p) },
    { key: "env", label: "Envoltória de difração", unit: "", value: (s, p) => envelopeAt(s[0] ?? 0, slitsOf(p)) },
    {
      key: "m",
      label: "Ordem m = d sen θ / λ",
      unit: "",
      value: (s, p) => {
        const sl = slitsOf(p);
        return (sl.d * 1e-3 * sinTheta(s[0] ?? 0, sl.L)) / (sl.lambda * 1e-9);
      },
    },
    { key: "dy", label: "Espaçamento das franjas λL/d", unit: "mm", value: (_s, p) => fringeSpacing(slitsOf(p)) },
  ],
  chart: { x: "y", y: "I" },

  scenarios: [
    {
      id: "classico",
      label: "Experimento de Young com laser",
      params: { fonte: 0, modelo: 0, lambda: 633, d: 0.25, a: 0.04, L: 1.5, W: 20 },
      guide: `### Medindo λ com duas fendas
1. Rode: o detector varre a tela e o gráfico monta $I(y)$.
2. Meça no gráfico a distância entre dois máximos vizinhos e compare com $\\Delta y = \\lambda L/d$.
3. Dobre $d$ e repita. Depois aumente $L$. O que muda?
4. Arraste o detector (clique na tela colorida ou no gráfico) até um mínimo e leia a ordem $m$: ela vale $m + \\tfrac12$.`,
      predict: [
        {
          question: "Se a separação d entre as fendas dobrar, o espaçamento entre as franjas na tela:",
          options: ["dobra", "cai pela metade", "não muda", "cai para um quarto"],
          answer: 1,
          explanation: "Como $\\Delta y = \\lambda L/d$, dobrar $d$ reduz o espaçamento à metade: fendas mais afastadas produzem franjas mais juntas.",
        },
      ],
    },
    {
      id: "envoltoria",
      label: "Envoltória e ordens ausentes",
      params: { fonte: 0, modelo: 0, lambda: 550, d: 0.3, a: 0.1, L: 2, W: 25 },
      guide: `### Interferência dentro da difração
1. Aqui $d = 3a$. A curva tracejada é a envoltória $\\left(\\tfrac{\\text{sen}\\,\\beta}{\\beta}\\right)^2$ de uma fenda.
2. Conte as franjas claras dentro do máximo central. Qual ordem $m$ desaparece?
3. Troque para **Só uma fenda aberta**: sobra só a envoltória. Depois volte a **Duas fendas muito estreitas**: as franjas ficam todas iguais.`,
      predict: [
        {
          question: "Com d = 3a, qual máximo de interferência some do padrão?",
          options: ["m = 1", "m = 2", "m = 3", "nenhum"],
          answer: 2,
          explanation: "O máximo $m$ cai em $\\text{sen}\\,\\theta = m\\lambda/d$ e o primeiro zero da envoltória em $\\text{sen}\\,\\theta = \\lambda/a = 3\\lambda/d$. Os dois coincidem para $m = 3$, que fica escuro.",
        },
      ],
    },
    {
      id: "branca",
      label: "Luz branca",
      params: { fonte: 1, modelo: 0, d: 0.2, a: 0.03, L: 1, W: 15 },
      guide: `### Franjas coloridas
1. Cada comprimento de onda forma seu próprio padrão, com $\\Delta y \\propto \\lambda$. A tela mostra a soma.
2. Observe a franja central e as primeiras franjas laterais: de que cor é a borda interna? E a externa?
3. Por que, longe do centro, as cores se misturam e a tela fica quase uniforme?`,
      predict: [
        {
          question: "Com luz branca, a franja central (y = 0) é:",
          options: ["branca", "vermelha", "violeta", "escura"],
          answer: 0,
          explanation: "Em $y = 0$ a diferença de caminho é nula para todos os λ: todos interferem construtivamente e a soma é branca. Fora do centro o azul (λ menor) chega primeiro ao máximo, então as franjas ganham borda azulada por dentro e avermelhada por fora.",
        },
      ],
    },
    {
      id: "cor",
      label: "Variando λ ao vivo",
      params: { fonte: 0, modelo: 1, lambda: 450, d: 0.15, a: 0.03, L: 2, W: 25 },
      guide: `### Azul contra vermelho
1. Rode e, durante a varredura, arraste o controle de λ de 450 nm até 700 nm.
2. As franjas se afastam: $\\Delta y$ é proporcional a $\\lambda$.
3. Use $\\Delta y$ medido para calcular λ e compare com o valor do controle.`,
    },
  ],

  exercises: [
    {
      id: "espacamento",
      prompt:
        "Numa experiência de Young com luz de {lambda} nm, as fendas estão separadas por {d} mm e a tela está a {L} m. Qual é a distância entre franjas claras vizinhas na tela?",
      vary: { lambda: [420, 680, 0], d: [0.1, 0.8, 2], L: [0.8, 4, 1] },
      fixed: { fonte: 0, modelo: 1 },
      answer: { label: "Δy", unit: "mm", compute: (p) => fringeSpacing(slitsOf(p)) },
      hint: "Para ângulos pequenos, Δy = λL/d. Cuidado com as unidades.",
    },
    {
      id: "central",
      prompt:
        "Duas fendas de largura {a} mm têm centros separados por {d} mm. Quantas franjas claras de interferência aparecem dentro do máximo central de difração? (Uma ordem que coincide com um zero da envoltória não conta.)",
      vary: { a: [0.02, 0.08, 3], d: [0.17, 0.6, 2] },
      fixed: { fonte: 0, modelo: 0 },
      answer: { label: "N", unit: "", compute: (p) => fringesInCentral(num(p, "d"), num(p, "a")) },
      tolerance: 0.001,
      hint: "O máximo central de difração vai de −λ/a a +λ/a em sen θ; as franjas claras estão em mλ/d.",
    },
  ],

  init: (p) => [-win(p)],
  step: (s, p, _t, dt) => [Math.min(win(p), (s[0] ?? 0) + (2 * win(p) * dt) / T_SCAN)],
  dt: 0.02,
  sampleEvery: 1,
  tEnd: T_SCAN,

  pointer: {
    down: (s, p, pt) => (pt.x > SCR_X0 - 0.2 && Math.abs(pt.y) <= HALF + 0.2 ? [Math.max(-1, Math.min(1, pt.y / HALF)) * win(p)] : undefined),
    move: (s, p, pt, dragging) =>
      dragging && pt.x > SCR_X0 - 0.2 ? [Math.max(-1, Math.min(1, pt.y / HALF)) * win(p)] : undefined,
    cursor: (_s, _p, pt) => (pt.x > SCR_X0 - 0.2 && Math.abs(pt.y) <= HALF ? "ns-resize" : undefined),
  },

  viewport: () => ({ xMin: 0, xMax: 20, yMin: -6.8, yMax: 6.4 }),

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const { params: p, theme, t } = frame;
    const sl = slitsOf(p);
    const white = isWhite(p);
    const W = win(p);
    const yDet = frame.state[0] ?? 0;

    // ---- Esquema: luz incidente, fendas e frentes de onda ----
    const lamV = 0.22 + (0.5 * (Math.min(750, Math.max(380, sl.lambda)) - 380)) / 370; // λ visual (fora de escala)
    const waveColor = white ? theme.text : cssRGB(wavelengthRGB(sl.lambda), 0.8);
    const phase = (t * 1.2) % 1;
    for (let k = 0; ; k++) {
      const x = BAR_X - (k + 1 - phase) * lamV;
      if (x < 0.3) break;
      d.line(x, -2.5, x, 2.5, { color: waveColor, width: 1.5, alpha: 0.7 });
    }
    d.arrowPx(0.4, 3.1, 1, 0, 40, { color: theme.muted, width: 1.5 });
    d.text(white ? "luz branca" : `λ = ${Math.round(sl.lambda)} nm`, 1.6, 3.6, { color: theme.muted, size: 11 });

    const sv = 0.35 + (1.6 * (sl.d - 0.05)) / 0.95; // meia separação visual
    const wv = Math.min(1.6 * sv, Math.max(0.1, 2 * sv * (sl.a / sl.d)));
    const open = sl.model === 2 ? [sv] : [sv, -sv];
    // Barreira com as aberturas
    const cuts = [-HALF, ...[-sv, sv].flatMap((c) => [c - wv / 2, c + wv / 2]), HALF];
    for (let i = 0; i < cuts.length; i += 2) d.rect(BAR_X - 0.12, cuts[i]!, 0.24, cuts[i + 1]! - cuts[i]!, { fill: theme.text, alpha: 0.85 });
    if (sl.model === 2) d.rect(BAR_X - 0.12, -sv - wv / 2, 0.24, wv, { fill: theme.muted, alpha: 0.9 });
    else {
      // cota d
      d.line(BAR_X - 0.6, -sv, BAR_X - 0.6, sv, { color: theme.muted, width: 1 });
      d.text("d", BAR_X - 0.85, 0, { color: theme.muted, size: 12, weight: "600" });
    }
    // Frentes de onda (semicírculos) saindo de cada fenda
    for (const cy of open) {
      for (let k = 0; ; k++) {
        const r = (k + phase) * lamV;
        if (r > SCR_X0 - BAR_X + 3) break;
        if (r < 0.05) continue;
        let seg: [number, number][] = [];
        const flush = () => {
          if (seg.length > 1) d.polyline(seg, { color: waveColor, width: 1.2, alpha: Math.max(0.15, 0.75 - r / 14) });
          seg = [];
        };
        for (let i = 0; i <= 60; i++) {
          const ph = -Math.PI / 2 + (Math.PI * i) / 60;
          const x = BAR_X + r * Math.cos(ph);
          const y = cy + r * Math.sin(ph);
          if (x <= SCR_X0 - 0.15 && Math.abs(y) <= HALF) seg.push([x, y]);
          else flush();
        }
        flush();
      }
    }
    // Direções dos máximos de ordem m (linhas tracejadas até a tela)
    const lam = (white ? 550 : sl.lambda) * 1e-9; // com luz branca, ordens para λ = 550 nm
    for (let m = -12; m <= 12 && sl.model !== 2; m++) {
      const st = (m * lam) / (sl.d * 1e-3);
      if (Math.abs(st) >= 1) continue;
      const yMm = sl.L * Math.tan(Math.asin(st)) * 1e3;
      if (Math.abs(yMm) > W) continue;
      const y = yw(yMm, p);
      if (m !== 0 && Math.abs(yw(fringeSpacing({ ...sl, lambda: lam * 1e9 }), p)) < 0.45 && m % 5 !== 0) continue;
      d.line(BAR_X + 0.2, 0, SCR_X0, y, { color: theme.muted, width: 1, dash: [3, 4], alpha: 0.6 });
      d.text(`m = ${m}`.replace("-", "−"), SCR_X0 - 0.15, y + 0.22, { color: theme.muted, size: 10, align: "right" });
    }

    // ---- Tela colorida ----
    d.rect(SCR_X0, -HALF, SCR_X1 - SCR_X0, 2 * HALF, { fill: "#000" });
    const N = 260;
    const h = (2 * HALF) / N;
    for (let i = 0; i < N; i++) {
      const y = -HALF + (i + 0.5) * h;
      d.rect(SCR_X0, y - h / 2, SCR_X1 - SCR_X0, h * 1.05, { fill: cssRGB(colorAt((y / HALF) * W, sl, white)) });
    }
    d.rect(SCR_X0, -HALF, SCR_X1 - SCR_X0, 2 * HALF, { stroke: theme.muted, width: 1 });

    // ---- Gráfico I(y) ----
    const gx = (I: number) => G_X0 + I * (G_X1 - G_X0);
    d.line(G_X0, -HALF, G_X0, HALF, { color: theme.muted, width: 1 });
    d.line(G_X0, -HALF, G_X1, -HALF, { color: theme.muted, width: 1 });
    for (const f of [-1, -0.5, 0, 0.5, 1]) {
      const y = f * HALF;
      d.line(G_X0, y, G_X1, y, { color: theme.grid, width: 1 });
      d.text(`${Number((f * W).toFixed(1))}`.replace(".", ",").replace("-", "−"), (SCR_X1 + G_X0) / 2, y, { color: theme.muted, size: 10 });
    }
    for (const I of [0.5, 1]) {
      d.line(gx(I), -HALF, gx(I), HALF, { color: theme.grid, width: 1 });
      d.text(`${I}`.replace(".", ","), gx(I), -HALF - 0.35, { color: theme.muted, size: 10 });
    }
    const pts: [number, number][] = [];
    const env: [number, number][] = [];
    for (let i = 0; i <= 400; i++) {
      const y = -HALF + (2 * HALF * i) / 400;
      const yMm = (y / HALF) * W;
      pts.push([gx(Math.min(1, white ? whiteIntensity(yMm, sl) : intensityAt(yMm, sl))), y]);
      if (sl.model === 0 && !white) env.push([gx(envelopeAt(yMm, sl)), y]);
    }
    if (env.length) d.polyline(env, { color: theme.muted, width: 1.2, dash: [5, 4] });
    d.polyline(pts, { color: white ? theme.text : theme.series[0], width: 2 });
    d.text("I/I₀", G_X1, -HALF - 0.35, { color: theme.muted, size: 10, align: "right" });
    d.text("y (mm)", (SCR_X1 + G_X0) / 2, HALF + 0.35, { color: theme.muted, size: 10 });

    // ---- Detector ----
    const yd = yw(Math.max(-W, Math.min(W, yDet)), p);
    const Id = detectorI(yDet, p);
    d.arrowPx(SCR_X0 - 0.9, yd, 1, 0, 30, { color: theme.accent });
    d.line(SCR_X1, yd, gx(Math.min(1, Id)), yd, { color: theme.accent, width: 1.5, dash: [4, 3] });
    d.dot(gx(Math.min(1, Id)), yd, 5, theme.accent);
    d.rect(SCR_X1 - 0.1, yd - 0.12, 0.35, 0.24, { fill: theme.accent });

    // ---- Legendas ----
    d.text("fendas", BAR_X, -HALF - 0.45, { color: theme.muted, size: 11 });
    d.text("tela", (SCR_X0 + SCR_X1) / 2, -HALF - 0.45, { color: theme.muted, size: 11 });
    d.text(
      `Esquema fora de escala · L = ${texLabel(sl.L)} m · d = ${texLabel(sl.d)} mm · a = ${texLabel(sl.a)} mm · Δy = ${texLabel(fringeSpacing(sl))} mm`,
      0.2,
      -6.4,
      { color: theme.muted, size: 11, align: "left" },
    );
    if (white) d.text("ordens m indicadas para λ = 550 nm", G_X1, HALF + 0.35, { color: theme.muted, size: 10, align: "right" });
    if (sl.model === 0 && !white) d.text("tracejado: envoltória de uma fenda", G_X1, HALF + 0.35, { color: theme.muted, size: 10, align: "right" });
  },
});

function texLabel(v: number): string {
  return Number(v.toPrecision(3)).toString().replace(".", ",");
}

export default fendaDupla;
