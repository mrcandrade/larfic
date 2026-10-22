import { clamp, defineSim, draw, num, texNum, type Draw, type Params, type Theme } from "@fisilab/core";
import {
  C,
  C1,
  C2,
  DIVX,
  DIVY,
  DRAG,
  R,
  SW,
  T,
  TT,
  V0,
  VC,
  VT,
  WR,
  WS,
  cursorReading,
  init,
  setSwitch,
  sourceV,
  squareMode,
  step,
  tau,
  trace,
} from "./model.ts";
import { battery, capacitor, currentArrow, generator, resistor, si } from "./symbols.ts";
import { derivation } from "./derivation.ts";

export * from "./model.ts";

// Geometria do palco (unidades arbitrárias; 1 divisão do osciloscópio = 1 unidade).
const SX = 8; // canto inferior esquerdo da tela do osciloscópio
const SY = 0;
const SWITCH = { a: [3.0, 6.5] as const, b: [3.0, 5.4] as const, c: [4.1, 6.5] as const };
const onSwitch = (x: number, y: number) => Math.hypot(x - 3.55, y - 6.05) < 0.9;

const MSDIV = [1, 2, 5, 10, 20, 50, 100, 200, 500];
const VDIV = [0.2, 0.5, 1, 2, 5];

const vs = (s: number[], p: Params) => sourceV(p, s[T]!, s[SW]!);
const vr = (s: number[], p: Params) => vs(s, p) - s[VC]!;
const current = (s: number[], p: Params) => vr(s, p) / R(p);
const uc = (s: number[], p: Params) => 0.5 * C(p) * s[VC]! ** 2;

function fmtV(v: number) {
  return Number.isFinite(v) ? `${Number(v.toPrecision(3)).toString().replace(".", ",")} V` : "—";
}

export const circuitoRc = defineSim({
  id: "circuito-rc",
  title: "Circuito RC: carga e descarga",
  course: "FG III",
  topic: "Circuitos",
  priority: "P1",
  summary:
    "Carregue e descarregue um capacitor por um resistor e meça a constante de tempo τ = RC num osciloscópio virtual, arrastando dois cursores sobre o traço. Com a fonte em onda quadrada, o RC vira um filtro passa-baixas.",
  derivation,
  equations: [
    String.raw`RC\,\frac{dV_C}{dt} + V_C = V_{\text{fonte}}(t) \qquad \tau = RC`,
    String.raw`\text{carga: } V_C = V_0\left(1 - e^{-t/\tau}\right) \qquad \text{descarga: } V_C = V_0\,e^{-t/\tau}`,
    String.raw`i = \frac{V_{\text{fonte}} - V_C}{R} \qquad U_C = \tfrac12 C V_C^2`,
    String.raw`\text{carga completa: } W_{\text{fonte}} = C V_0^2 = U_C + W_R,\quad W_R = U_C = \tfrac12 C V_0^2`,
  ],
  liveEquations(s, p) {
    const c1 = cursorReading(s, p, 1);
    const c2 = cursorReading(s, p, 2);
    return [
      String.raw`\tau = RC = ${texNum(R(p))}\,\Omega \times ${texNum(C(p))}\,\text{F} = ${texNum(tau(p))}\ \text{s}`,
      String.raw`V_C = ${texNum(s[VC]!)}\ \text{V} \qquad i = ${texNum(current(s, p))}\ \text{A} \qquad U_C = ${texNum(uc(s, p))}\ \text{J}`,
      String.raw`\text{cursores: } \Delta t = ${texNum(c2.t - c1.t)}\ \text{s} \qquad \Delta V = ${texNum(c2.v - c1.v)}\ \text{V}`,
    ];
  },

  params: [
    {
      key: "modo",
      label: "Fonte",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 0,
      options: [
        { value: 0, label: "Bateria com chave A/B" },
        { value: 1, label: "Gerador de onda quadrada" },
      ],
    },
    {
      key: "inicio",
      label: "Condição inicial",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 0,
      options: [
        { value: 0, label: "Capacitor descarregado, chave em A (carga)" },
        { value: 1, label: "Capacitor carregado, chave em B (descarga)" },
      ],
    },
    { key: "V0", label: "Tensão da fonte V₀", unit: "V", min: 1, max: 12, step: 0.5, default: 5 },
    { key: "R", label: "Resistência R", unit: "Ω", min: 100, max: 20000, step: 10, default: 1000, log: true },
    { key: "C", label: "Capacitância C", unit: "µF", min: 10, max: 1000, step: 1, default: 100, log: true },
    { key: "f", label: "Frequência da onda quadrada", unit: "Hz", min: 0.2, max: 100, step: 0.1, default: 2, log: true },
    {
      key: "msdiv",
      label: "Base de tempo",
      unit: "ms/div",
      min: 1,
      max: 500,
      step: 1,
      default: 50,
      live: true,
      options: MSDIV.map((v) => ({ value: v, label: `${v} ms/div` })),
    },
    {
      key: "vdiv",
      label: "Sensibilidade vertical",
      unit: "V/div",
      min: 0.2,
      max: 5,
      step: 0.1,
      default: 1,
      live: true,
      options: VDIV.map((v) => ({ value: v, label: `${String(v).replace(".", ",")} V/div` })),
    },
    { key: "pos", label: "Posição vertical do zero", unit: "div", min: -4, max: 4, step: 0.5, default: -3, live: true },
    {
      key: "ch2",
      label: "Canal 2",
      unit: "",
      min: 0,
      max: 2,
      step: 1,
      default: 0,
      live: true,
      options: [
        { value: 0, label: "Desligado" },
        { value: 1, label: "Tensão no resistor V_R" },
        { value: 2, label: "Tensão da fonte" },
      ],
    },
  ],

  observables: [
    { key: "Vc", label: "Tensão no capacitor V_C", unit: "V", value: (s) => s[VC]! },
    { key: "Vr", label: "Tensão no resistor V_R", unit: "V", value: (s, p) => vr(s, p) },
    { key: "Vs", label: "Tensão da fonte", unit: "V", value: (s, p) => vs(s, p) },
    { key: "i", label: "Corrente i", unit: "A", value: (s, p) => current(s, p) },
    { key: "q", label: "Carga no capacitor q", unit: "C", value: (s, p) => C(p) * s[VC]! },
    { key: "Uc", label: "Energia no capacitor U_C", unit: "J", value: (s, p) => uc(s, p) },
    { key: "Wr", label: "Energia dissipada no resistor", unit: "J", value: (s) => s[WR]! },
    { key: "Ws", label: "Trabalho da fonte", unit: "J", value: (s) => s[WS]! },
    { key: "bal", label: "U_C + W_R − W_fonte", unit: "J", value: (s, p) => uc(s, p) + s[WR]! - s[WS]! },
    { key: "dt", label: "Δt entre cursores", unit: "s", value: (s, p) => cursorReading(s, p, 2).t - cursorReading(s, p, 1).t },
    {
      key: "dv",
      label: "ΔV entre cursores",
      unit: "V",
      value: (s, p) => {
        const d = cursorReading(s, p, 2).v - cursorReading(s, p, 1).v;
        return Number.isFinite(d) ? d : 0;
      },
    },
  ],
  conserved: "bal",
  chart: { x: "t", y: "Vc" },

  scenarios: [
    {
      id: "medir-tau",
      label: "Medir τ com os cursores",
      params: { modo: 0, inicio: 0, V0: 5, R: 1000, C: 100, msdiv: 50, vdiv: 1, pos: -3, ch2: 0 },
      guide: `### Medindo a constante de tempo
O osciloscópio dispara quando a chave muda de posição: o traço começa na borda esquerda da tela.
1. Clique em **Iniciar** e deixe a varredura cruzar a tela inteira (10 divisões).
2. Arraste o **cursor 1** até o início do traço ($t = 0$, $V_C = 0$).
3. Arraste o **cursor 2** até o ponto em que $V_C = 0{,}632\\,V_0$ (com $V_0 = 5$ V, cerca de 3,16 V). O $\\Delta t$ lido é $\\tau$.
4. Compare com $\\tau = RC$ nas equações. Depois dobre **R** e meça de novo.
5. Repita com o cursor 2 em $5\\tau$: o capacitor já está acima de 99 % da carga.`,
      predict: [
        {
          question: "Se você dobrar a resistência R, o tempo para o capacitor chegar a 63 % da tensão final:",
          options: ["cai pela metade", "dobra", "quadruplica", "não muda"],
          answer: 1,
          explanation: "$\\tau = RC$ é proporcional a $R$: com o dobro da resistência a corrente de carga é a metade e o capacitor demora o dobro.",
        },
      ],
    },
    {
      id: "descarga",
      label: "Descarga e corrente",
      params: { modo: 0, inicio: 1, V0: 10, R: 2200, C: 100, msdiv: 100, vdiv: 2, pos: 0, ch2: 1 },
      guide: `### Descarga
O capacitor começa carregado com $V_0$ e a chave está em **B**: ele descarrega pelo resistor.
1. Ligue o **canal 2** em $V_R$: durante a descarga $V_R = -V_C$, a corrente inverte o sentido.
2. Meça o tempo para a tensão cair à metade (meia-vida) e confira $t_{1/2} = \\tau\\ln 2 \\approx 0{,}693\\,\\tau$.
3. Clique em **Carregar (A)** no meio da descarga: o osciloscópio dispara de novo e a carga parte da tensão em que o capacitor estava.`,
      predict: [
        {
          question: "Logo após a chave ir para B, a corrente no resistor vale:",
          options: ["zero", "V₀/R, no sentido oposto ao da carga", "V₀/R, no mesmo sentido da carga"],
          answer: 1,
          explanation: "A tensão no capacitor não salta: no instante inicial o resistor fica com $V_0$ aplicado ao contrário, e $|i| = V_0/R$ no sentido oposto ao da carga.",
        },
      ],
    },
    {
      id: "onda-quadrada",
      label: "Onda quadrada: filtro passa-baixas",
      params: { modo: 1, V0: 5, R: 1000, C: 100, f: 1, msdiv: 200, vdiv: 1, pos: -3, ch2: 2 },
      guide: `### RC excitado por onda quadrada
A fonte alterna entre $V_0$ e 0 a cada meio período. O osciloscópio dispara a cada período (ou a cada grupo de períodos que cabe na tela).
1. Com $T/2 \\gg \\tau$ (aqui $T/2 = 5\\tau$) o capacitor completa cada carga e descarga.
2. Aumente **f** até $T/2 \\approx \\tau$: a tensão no capacitor não tem tempo de chegar aos extremos.
3. Com $T/2 \\ll \\tau$ o traço vira um triângulo pequeno em torno de $V_0/2$: o RC **integra** a onda e deixa passar só a média. É um filtro passa-baixas.`,
      predict: [
        {
          question: "Com frequência muito alta (T/2 ≪ τ), a tensão no capacitor:",
          options: ["acompanha a onda quadrada", "oscila pouco em torno de V₀/2", "fica em zero"],
          answer: 1,
          explanation: "Em cada meio período a tensão só varia uma fração $\\approx T/(2\\tau)$ do salto: sobra o valor médio $V_0/2$ com uma pequena ondulação triangular.",
        },
      ],
    },
    {
      id: "energia",
      label: "Para onde vai a energia?",
      params: { modo: 0, inicio: 0, V0: 10, R: 470, C: 470, msdiv: 200, vdiv: 2, pos: -3, ch2: 0 },
      guide: `### Balanço de energia na carga
1. Plote **Trabalho da fonte**, **Energia no capacitor** e **Energia dissipada no resistor** contra **t**.
2. No fim da carga, a fonte entregou $CV_0^2$, mas só $\\tfrac12 CV_0^2$ ficou no capacitor.
3. Troque **R** e repita: a fração dissipada continua sendo metade, qualquer que seja $R$. Só o tempo muda.`,
      predict: [
        {
          question: "Que fração da energia entregue pela bateria fica dissipada no resistor numa carga completa?",
          options: ["Quase nada, se R for pequeno", "Metade, qualquer que seja R", "Toda ela"],
          answer: 1,
          explanation: "$W_R = \\int_0^\\infty \\frac{V_0^2}{R}e^{-2t/RC}dt = \\tfrac12 C V_0^2$, independente de $R$; a fonte entrega $C V_0^2$.",
        },
      ],
    },
  ],

  exercises: [
    {
      id: "tempo-fracao",
      prompt:
        "Um capacitor de {C} µF, inicialmente descarregado, é carregado por um resistor de {R} Ω ligado a uma bateria. Quanto tempo leva para a tensão no capacitor atingir {pct}% da tensão da bateria?",
      vary: { C: [10, 1000, 0], R: [100, 20000, 0], pct: [20, 95, 0] },
      fixed: { modo: 0, inicio: 0 },
      answer: {
        label: "t",
        unit: "s",
        compute: (p) => -(num(p, "R") * num(p, "C") * 1e-6) * Math.log(1 - num(p, "pct") / 100),
      },
      hint: "V_C = V₀(1 − e^{−t/RC}) ⇒ t = −RC ln(1 − fração).",
    },
    {
      id: "energia-dissipada",
      prompt:
        "Um capacitor de {C} µF é carregado completamente, a partir de zero, por uma bateria de {V0} V através de um resistor de {R} Ω. Quanta energia é dissipada no resistor durante a carga?",
      vary: { C: [10, 1000, 0], V0: [1, 12, 1], R: [100, 20000, 0] },
      fixed: { modo: 0, inicio: 0 },
      answer: { label: "W_R", unit: "J", compute: (p) => 0.5 * num(p, "C") * 1e-6 * num(p, "V0") ** 2 },
      hint: "A resposta não depende de R: metade do trabalho da bateria (CV₀²) fica no capacitor.",
    },
  ],

  init,
  step: (s, p, _t, dt) => step(s, p, dt),
  dt: 1e-4,
  sampleEvery: 10,

  viewport: () => ({ xMin: -0.2, xMax: SX + DIVX + 0.5, yMin: -1.7, yMax: DIVY + 1.1 }),

  pointer: {
    down(s, p, pt) {
      if (!squareMode(p) && onSwitch(pt.x, pt.y)) return setSwitch(s, p, Math.round(s[SW]!) === 1 ? 0 : 1);
      const which = hitCursor(s, pt.x, pt.y);
      if (!which) return undefined;
      const out = s.slice();
      out[DRAG] = which;
      return out;
    },
    move(s, _p, pt, dragging) {
      const which = Math.round(s[DRAG]!);
      if (!dragging || !which) return undefined;
      const out = s.slice();
      out[which === 1 ? C1 : C2] = clamp(Math.round((pt.x - SX) * 20) / 20, 0, DIVX);
      return out;
    },
    up(s) {
      if (!s[DRAG]) return undefined;
      const out = s.slice();
      out[DRAG] = 0;
      return out;
    },
    cursor(s, p, pt) {
      if (!squareMode(p) && onSwitch(pt.x, pt.y)) return "pointer";
      return hitCursor(s, pt.x, pt.y) ? "ew-resize" : undefined;
    },
  },

  actions: [
    { id: "carregar", label: "Chave em A (carregar)", run: (s, p) => setSwitch(s, p, 1), active: (s) => Math.round(s[SW]!) === 1 },
    { id: "descarregar", label: "Chave em B (descarregar)", run: (s, p) => setSwitch(s, p, 0), active: (s) => Math.round(s[SW]!) === 0 },
    {
      id: "redisparar",
      label: "Redisparar osciloscópio",
      run: (s) => {
        const out = s.slice();
        out[TT] = s[T]!;
        out[VT] = s[VC]!;
        return out;
      },
    },
  ],

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const { state: s, params: p, theme } = frame;
    drawCircuit(d, theme, s, p);
    drawScope(d, ctx, theme, s, p);
  },
});

function hitCursor(s: number[], x: number, y: number): 0 | 1 | 2 {
  if (y < SY - 0.3 || y > SY + DIVY + 0.8) return 0;
  const d1 = Math.abs(x - (SX + s[C1]!));
  const d2 = Math.abs(x - (SX + s[C2]!));
  if (Math.min(d1, d2) > 0.3) return 0;
  return d2 <= d1 ? 2 : 1;
}

function drawCircuit(d: Draw, theme: Theme, s: number[], p: Params) {
  const col = theme.text;
  const yb = 1.5;
  const yt = SWITCH.a[1];
  const xs = 1.6;
  const xc = 6.6;
  const sq = squareMode(p);
  const sw = Math.round(s[SW]!);
  const i = current(s, p);

  // Fonte e fios
  if (sq) generator(d, xs, yb, xs, yt, "quadrada", { color: col });
  else battery(d, xs, yb, xs, yt, { color: col });
  d.text(`V₀ = ${si(V0(p), "V")}`, xs - 0.45, (yb + yt) / 2, { align: "right", color: theme.muted, size: 12 });
  if (sq) d.text(`f = ${si(num(p, "f", 2), "Hz")}`, xs - 0.45, (yb + yt) / 2 - 0.5, { align: "right", color: theme.muted, size: 12 });
  d.line(xs, yt, SWITCH.a[0], yt, { color: col, width: 2 });
  d.line(xs, yb, xc, yb, { color: col, width: 2 });

  if (sq) {
    d.line(SWITCH.a[0], yt, SWITCH.c[0], yt, { color: col, width: 2 });
  } else {
    // Chave de duas posições
    d.line(SWITCH.b[0], SWITCH.b[1], SWITCH.b[0], yb, { color: col, width: 2 });
    for (const q of [SWITCH.a, SWITCH.b, SWITCH.c]) d.circle(q[0], q[1], 4 * d.px, { fill: theme.dark ? "#111" : "#fff", stroke: col, width: 1.5 });
    const to = sw === 1 ? SWITCH.a : SWITCH.b;
    d.line(SWITCH.c[0], SWITCH.c[1], to[0] + 0.08, to[1] + (sw === 1 ? 0 : 0.06), { color: theme.accent, width: 3 });
    d.text("A", SWITCH.a[0], SWITCH.a[1] + 0.35, { color: sw === 1 ? theme.accent : theme.muted, size: 12, weight: "600" });
    d.text("B", SWITCH.b[0] - 0.3, SWITCH.b[1], { color: sw === 0 ? theme.accent : theme.muted, size: 12, weight: "600" });
    d.text("clique na chave", 3.55, 7.35, { color: theme.muted, size: 10 });
  }

  // Resistor e capacitor
  resistor(d, SWITCH.c[0], yt, xc, yt, 0.9, { color: col });
  d.text(`R = ${si(R(p), "Ω")}`, (SWITCH.c[0] + xc) / 2, yt - 0.5, { color: theme.muted, size: 12 });
  const cap = capacitor(d, xc, yt, xc, yb, { color: col, platePx: 34, gapPx: 12 });
  d.text(`C = ${si(C(p), "F")}`, xc - 0.55, (yt + yb) / 2, { color: theme.muted, size: 12, align: "right" });

  // Cargas nas placas (número de sinais proporcional a q / q_max)
  const frac = clamp(s[VC]! / V0(p), -1, 1);
  const nq = Math.round(Math.abs(frac) * 5);
  const plateTop = cap.pa;
  const plateBot = cap.pb;
  for (let k = 0; k < nq; k++) {
    const x = xc - cap.pl + ((k + 0.5) * 2 * cap.pl) / 5;
    d.text(frac > 0 ? "+" : "−", x, plateTop[1] + 9 * d.px, { color: theme.positive, size: 11, weight: "700" });
    d.text(frac > 0 ? "−" : "+", x, plateBot[1] - 9 * d.px, { color: theme.negative, size: 11, weight: "700" });
  }

  // Seta de corrente no fio superior (convencional, sentido horário positivo durante a carga)
  const iMax = V0(p) / R(p);
  if (Math.abs(i) > 1e-3 * iMax) currentArrow(d, (SWITCH.c[0] + xc) / 2, yt + 0.35, 1, 0, i, theme.series[2]!, `i = ${si(Math.abs(i), "A")}`);

  d.text(`τ = RC = ${si(tau(p), "s")}`, 4.1, 0.6, { color: theme.text, size: 13, weight: "600" });
  d.text(`V_C = ${fmtV(s[VC]!)}`, 4.1, 0.05, { color: theme.series[0]!, size: 12 });
}

function drawScope(d: Draw, ctx: CanvasRenderingContext2D, theme: Theme, s: number[], p: Params) {
  const msdiv = num(p, "msdiv", 50);
  const vdiv = num(p, "vdiv", 1);
  const zero = SY + DIVY / 2 + num(p, "pos", -3);
  const X = (t: number) => SX + t / (msdiv / 1000);
  const Y = (v: number) => zero + v / vdiv;
  const ch1 = theme.series[0]!;
  const ch2 = theme.series[1]!;

  // Moldura e tela
  d.rect(SX - 0.25, SY - 1.55, DIVX + 0.5, DIVY + 2.5, { fill: theme.dark ? "rgba(255,255,255,0.04)" : "rgba(28,36,48,0.05)", stroke: theme.muted, width: 1 });
  d.rect(SX, SY, DIVX, DIVY, { fill: theme.dark ? "rgba(0,0,0,0.45)" : "rgba(255,255,255,0.9)", stroke: theme.muted, width: 1.5 });
  d.grid(SX, SX + DIVX, SY, SY + DIVY, 1, { color: theme.grid, width: 1 });
  // Eixos centrais com subdivisões, como num osciloscópio real
  d.line(SX, SY + DIVY / 2, SX + DIVX, SY + DIVY / 2, { color: theme.muted, width: 1, alpha: 0.5 });
  d.line(SX + DIVX / 2, SY, SX + DIVX / 2, SY + DIVY, { color: theme.muted, width: 1, alpha: 0.5 });
  for (let k = 1; k < DIVX * 5; k++) {
    const x = SX + k / 5;
    d.line(x, SY + DIVY / 2 - 0.08, x, SY + DIVY / 2 + 0.08, { color: theme.muted, width: 1, alpha: 0.6 });
  }
  for (let k = 1; k < DIVY * 5; k++) {
    const y = SY + k / 5;
    d.line(SX + DIVX / 2 - 0.08, y, SX + DIVX / 2 + 0.08, y, { color: theme.muted, width: 1, alpha: 0.6 });
  }

  // Marcador do zero do canal 1
  if (zero >= SY && zero <= SY + DIVY) {
    d.polyline(
      [
        [SX - 0.22, zero + 0.13],
        [SX - 0.02, zero],
        [SX - 0.22, zero - 0.13],
      ],
      { color: ch1, fill: ch1, close: true, width: 1 },
    );
  }

  // Traços (recortados à tela)
  const pts = trace(s, p);
  const mode2 = Math.round(num(p, "ch2"));
  ctx.save();
  ctx.beginPath();
  ctx.rect(SX, SY, DIVX, DIVY);
  ctx.clip();
  if (mode2 > 0) {
    const sig = (q: { vc: number; vs: number }) => (mode2 === 1 ? q.vs - q.vc : q.vs);
    d.polyline(
      pts.map((q) => [X(q.t), Y(sig(q))] as [number, number]),
      { color: ch2, width: 2 },
    );
  }
  d.polyline(
    pts.map((q) => [X(q.t), Y(q.vc)] as [number, number]),
    { color: ch1, width: 2.4 },
  );
  const last = pts[pts.length - 1];
  if (last && last.t < (DIVX * msdiv) / 1000 - 1e-9) d.dot(X(last.t), Y(last.vc), 3.5, ch1);
  ctx.restore();

  // Cursores
  const r1 = cursorReading(s, p, 1);
  const r2 = cursorReading(s, p, 2);
  const cur = [
    { n: 1, x: SX + s[C1]!, r: r1 },
    { n: 2, x: SX + s[C2]!, r: r2 },
  ];
  for (const c of cur) {
    const active = Math.round(s[DRAG]!) === c.n;
    d.line(c.x, SY, c.x, SY + DIVY, { color: theme.accent, width: active ? 2 : 1.4, dash: [6, 4] });
    d.rect(c.x - 0.22, SY + DIVY + 0.05, 0.44, 0.42, { fill: theme.accent });
    d.text(String(c.n), c.x, SY + DIVY + 0.26, { color: theme.dark ? "#111" : "#fff", size: 11, weight: "700" });
    if (Number.isFinite(c.r.v)) {
      const y = Y(c.r.v);
      if (y >= SY && y <= SY + DIVY) {
        d.line(SX, y, SX + DIVX, y, { color: theme.accent, width: 1, alpha: 0.35, dash: [2, 4] });
        d.circle(c.x, y, 5 * d.px, { stroke: theme.accent, width: 2 });
      }
    }
  }

  // Leituras
  const pct = (v: number) => (Number.isFinite(v) ? ` (${Math.round((100 * v) / V0(p))}% de V₀)` : "");
  d.text(`CH1 V_C  ${String(vdiv).replace(".", ",")} V/div`, SX, SY + DIVY + 0.75, { color: ch1, size: 12, align: "left", weight: "600" });
  if (mode2 > 0)
    d.text(`CH2 ${mode2 === 1 ? "V_R" : "fonte"}  ${String(vdiv).replace(".", ",")} V/div`, SX + 3.4, SY + DIVY + 0.75, { color: ch2, size: 12, align: "left", weight: "600" });
  d.text(`${String(msdiv)} ms/div`, SX + DIVX, SY + DIVY + 0.75, { color: theme.text, size: 12, align: "right", weight: "600" });
  const ms = (t: number) => `${Number((t * 1000).toPrecision(4)).toString().replace(".", ",")} ms`;
  d.text(`1: ${ms(r1.t)}, ${fmtV(r1.v)}    2: ${ms(r2.t)}, ${fmtV(r2.v)}${pct(r2.v)}`, SX + 0.1, SY - 0.5, {
    color: theme.muted,
    size: 12,
    align: "left",
  });
  const dv = r2.v - r1.v;
  d.text(`Δt = ${ms(r2.t - r1.t)}    ΔV = ${fmtV(dv)}`, SX + 0.1, SY - 1.1, { color: theme.accent, size: 13, align: "left", weight: "700" });
  d.text("arraste os cursores 1 e 2", SX + DIVX - 0.1, SY - 1.1, { color: theme.muted, size: 11, align: "right" });
}

export default circuitoRc;
