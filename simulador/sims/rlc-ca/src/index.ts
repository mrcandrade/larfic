import { clamp, defineSim, draw, num, texNum, type Draw, type Params, type Theme } from "@fisilab/core";
import {
  C,
  IIND,
  IRES,
  IS,
  L,
  PARALELO,
  PH,
  R,
  Rg,
  SERIE,
  TF,
  VCAP,
  VRES,
  VS,
  cabs,
  cadd,
  carg,
  f0,
  freq,
  iCap,
  init,
  inst,
  phasors,
  quality,
  saida,
  step,
  topo,
  vInd,
  vOut,
  type Cx,
} from "./model.ts";
import { capacitor, currentArrow, generator, inductor, resistor, si } from "./symbols.ts";
import { derivation } from "./derivation.ts";

export * from "./model.ts";

const FMIN = 10;
const FMAX = 1e5;
const OUT_LABEL = ["V_R", "V_C", "V_L"];
const deg = (r: number) => (r * 180) / Math.PI;

export const rlcCa = defineSim({
  id: "rlc-ca",
  title: "RLC em corrente alternada: ressonância, fasores e filtros",
  course: "FG III",
  topic: "CA",
  priority: "P1",
  summary:
    "Um gerador senoidal de frequência ajustável alimenta um RLC em série ou em paralelo. Veja os fasores girando, a impedância complexa, a curva de ressonância com o fator Q e o diagrama de Bode dos filtros, enquanto o transiente é integrado passo a passo.",
  derivation,
  equations: [
    String.raw`Z = R + j\left(\omega L - \frac{1}{\omega C}\right) \qquad |Z| = \sqrt{R^2 + (X_L - X_C)^2} \qquad \tan\varphi = \frac{X_L - X_C}{R}`,
    String.raw`\hat I = \frac{\hat V}{Z} \qquad \hat V_R = R\hat I \qquad \hat V_L = j\omega L\,\hat I \qquad \hat V_C = \frac{\hat I}{j\omega C}`,
    String.raw`f_0 = \frac{1}{2\pi\sqrt{LC}} \qquad Q_{\text{série}} = \frac{1}{R}\sqrt{\frac{L}{C}} \qquad \Delta f = \frac{f_0}{Q}`,
    String.raw`H(f) = \frac{\hat V_{\text{saída}}}{\hat V_{\text{fonte}}} \qquad |H|_{\text{dB}} = 20\log_{10}|H| \qquad \bar P = \tfrac12 V_p I_p\cos\varphi`,
  ],
  liveEquations(_s, p) {
    const ph = phasors(p);
    const w = 2 * Math.PI * freq(p);
    const XL = w * L(p);
    const XC = 1 / (w * C(p));
    const phi = carg(ph.Z);
    const out = [
      String.raw`X_L = ${texNum(XL)}\,\Omega \quad X_C = ${texNum(XC)}\,\Omega \quad Z = ${texNum(ph.Z[0])} ${ph.Z[1] < 0 ? "-" : "+"} j\,${texNum(Math.abs(ph.Z[1]))}\ \Omega`,
      String.raw`|Z| = ${texNum(cabs(ph.Z))}\ \Omega \quad \varphi = ${texNum(deg(phi))}^\circ \quad I_p = ${texNum(cabs(ph.I))}\ \text{A} \quad \bar P = ${texNum(0.5 * num(p, "Vp", 10) * cabs(ph.I) * Math.cos(phi))}\ \text{W}`,
      String.raw`f_0 = ${texNum(f0(p))}\ \text{Hz} \quad Q = ${texNum(quality(p))} \quad |H| = ${texNum(20 * Math.log10(cabs(ph.H)))}\ \text{dB} \quad \angle H = ${texNum(deg(carg(ph.H)))}^\circ`,
    ];
    return out;
  },

  params: [
    {
      key: "topologia",
      label: "Ligação",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 0,
      options: [
        { value: SERIE, label: "RLC em série" },
        { value: PARALELO, label: "RLC em paralelo (tanque)" },
      ],
    },
    {
      key: "saida",
      label: "Saída do filtro (série)",
      unit: "",
      min: 0,
      max: 2,
      step: 1,
      default: 0,
      live: true,
      options: [
        { value: 0, label: "V_R: passa-faixa" },
        { value: 1, label: "V_C: passa-baixas" },
        { value: 2, label: "V_L: passa-altas" },
      ],
    },
    {
      key: "grafico",
      label: "Gráfico do palco",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 0,
      live: true,
      options: [
        { value: 0, label: "Diagrama de Bode (|H| e fase)" },
        { value: 1, label: "Curva de ressonância I(f)" },
      ],
    },
    {
      key: "inicio",
      label: "Início",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 0,
      options: [
        { value: 0, label: "Ligar a fonte em t = 0 (com transiente)" },
        { value: 1, label: "Já em regime permanente" },
      ],
    },
    { key: "f", label: "Frequência da fonte f", unit: "Hz", min: FMIN, max: FMAX, step: 1, default: 1000, log: true, live: true },
    { key: "Vp", label: "Amplitude da fonte V_p", unit: "V", min: 1, max: 20, step: 0.5, default: 10, live: true },
    { key: "R", label: "Resistência R", unit: "Ω", min: 1, max: 10000, step: 1, default: 20, log: true, live: true },
    { key: "L", label: "Indutância L", unit: "mH", min: 0.1, max: 1000, step: 0.1, default: 10, log: true, live: true },
    { key: "C", label: "Capacitância C", unit: "µF", min: 0.001, max: 100, step: 0.001, default: 1, log: true, live: true },
    { key: "Rg", label: "Resistência interna do gerador", unit: "Ω", min: 0, max: 1000, step: 1, default: 0, live: true },
    {
      key: "ritmo",
      label: "Câmera lenta (ciclos por segundo de animação)",
      unit: "ciclos/s",
      min: 0.25,
      max: 5,
      step: 0.25,
      default: 0.5,
      live: true,
      options: [0.25, 0.5, 1, 2, 5].map((v) => ({ value: v, label: `${String(v).replace(".", ",")} ciclo/s` })),
    },
  ],

  observables: [
    { key: "tf", label: "Tempo físico", unit: "s", value: (s) => s[TF]! },
    { key: "vs", label: "Tensão da fonte", unit: "V", value: (s) => s[VS]! },
    { key: "i", label: "Corrente da fonte i", unit: "A", value: (s) => s[IS]! },
    { key: "vR", label: "Tensão no resistor", unit: "V", value: (s) => s[VRES]! },
    { key: "vL", label: "Tensão no indutor", unit: "V", value: (s, p) => vInd(s, p) },
    { key: "vC", label: "Tensão no capacitor", unit: "V", value: (s) => s[VCAP]! },
    { key: "iL", label: "Corrente no indutor", unit: "A", value: (s) => s[IIND]! },
    { key: "iC", label: "Corrente no capacitor", unit: "A", value: (s, p) => iCap(s, p) },
    { key: "iR", label: "Corrente no resistor", unit: "A", value: (s) => s[IRES]! },
    { key: "vout", label: "Tensão de saída", unit: "V", value: (s, p) => vOut(s, p) },
    { key: "ireg", label: "Corrente de regime (fasor)", unit: "A", value: (s, p) => inst(phasors(p).I, s[PH]!) },
    { key: "itr", label: "Parte transitória da corrente", unit: "A", value: (s, p) => s[IS]! - inst(phasors(p).I, s[PH]!) },
    { key: "Ip", label: "Amplitude da corrente (regime)", unit: "A", value: (_s, p) => cabs(phasors(p).I) },
    { key: "Z", label: "Módulo da impedância |Z|", unit: "Ω", value: (_s, p) => cabs(phasors(p).Z) },
    { key: "phi", label: "Defasagem φ (tensão − corrente)", unit: "°", value: (_s, p) => deg(carg(phasors(p).Z)) },
    { key: "P", label: "Potência média", unit: "W", value: (_s, p) => 0.5 * num(p, "Vp", 10) * cabs(phasors(p).I) * Math.cos(carg(phasors(p).Z)) },
    { key: "HdB", label: "Ganho |H|", unit: "dB", value: (_s, p) => 20 * Math.log10(cabs(phasors(p).H)) },
    { key: "f0", label: "Frequência de ressonância", unit: "Hz", value: (_s, p) => f0(p) },
    { key: "Q", label: "Fator de qualidade Q", unit: "", value: (_s, p) => quality(p) },
  ],
  chart: { x: "tf", y: "i" },

  scenarios: [
    {
      id: "ressonancia",
      label: "Ressonância em série",
      params: { topologia: SERIE, saida: 0, grafico: 1, inicio: 1, f: 500, Vp: 10, R: 20, L: 10, C: 1, Rg: 0 },
      guide: `### Procurando a ressonância
O circuito começa em regime permanente com $f = 500$ Hz.
1. Suba **f** devagar e acompanhe o marcador na curva de ressonância: a corrente é máxima em $f_0 = 1/(2\\pi\\sqrt{LC}) \\approx 1{,}59$ kHz.
2. Na ressonância $X_L = X_C$: os fasores $\\hat V_L$ e $\\hat V_C$ se cancelam e $\\hat I$ fica em fase com a fonte ($\\varphi = 0$).
3. Leia as tensões: $|V_L| = |V_C| = Q\\,V_p$, maiores que a da fonte!
4. Aumente **R** e veja a curva alargar: a largura entre os pontos de meia potência é $\\Delta f = f_0/Q$.`,
      predict: [
        {
          question: "Na ressonância de um RLC série com Q = 5 e fonte de 10 V de pico, a amplitude da tensão no capacitor é:",
          options: ["menor que 10 V", "exatamente 10 V", "cerca de 50 V"],
          answer: 2,
          explanation: "Em $f_0$, $I_p = V_p/R$ e $V_C = I_p X_C = V_p\\,\\frac{X_C}{R} = Q V_p$. As tensões de L e C, opostas, se cancelam no laço.",
        },
      ],
    },
    {
      id: "fasores",
      label: "Fasores e defasagem",
      params: { topologia: SERIE, saida: 0, grafico: 0, inicio: 0, f: 800, Vp: 10, R: 50, L: 10, C: 1, Rg: 0, ritmo: 0.5 },
      guide: `### Diagrama fasorial
Os fasores giram com $\\omega t$; a projeção vertical de cada um é o valor instantâneo.
1. Abaixo de $f_0$ o circuito é **capacitivo**: $X_C > X_L$, a corrente fica **adiantada** em relação à fonte ($\\varphi < 0$).
2. Note que $\\hat V_R$ está sempre em fase com $\\hat I$, $\\hat V_L$ adiantado $90^\\circ$ e $\\hat V_C$ atrasado $90^\\circ$.
3. Ligamos a fonte em $t = 0$: no painel de ondas, a corrente demora alguns ciclos para assumir o regime. Plote **Parte transitória da corrente** e veja-a decair com $e^{-Rt/2L}$.
4. Suba **f** acima de $f_0$ e veja o circuito ficar **indutivo**.`,
      predict: [
        {
          question: "Com f abaixo da frequência de ressonância, a corrente em relação à tensão da fonte está:",
          options: ["adiantada", "atrasada", "em fase"],
          answer: 0,
          explanation: "Abaixo de $f_0$, $X_C = 1/\\omega C$ domina: a impedância tem parte imaginária negativa e $\\varphi = \\arg Z < 0$, ou seja, a corrente adianta.",
        },
      ],
    },
    {
      id: "filtros",
      label: "Filtros e diagrama de Bode",
      params: { topologia: SERIE, saida: 1, grafico: 0, inicio: 1, f: 200, Vp: 10, R: 100, L: 10, C: 1, Rg: 0, ritmo: 1 },
      guide: `### Três filtros com o mesmo circuito
A saída é a tensão num dos componentes; o Bode mostra $|H|$ em dB e a fase, em escala logarítmica de frequência.
1. **Saída V_C (passa-baixas):** abaixo de $f_0$ $|H| \\approx 0$ dB; acima, cai $40$ dB por década.
2. Troque para **V_L (passa-altas)**: o espelho do anterior.
3. Troque para **V_R (passa-faixa)**: só passa uma faixa em torno de $f_0$, com fase $0^\\circ$ no centro.
4. Diminua **R** e note o pico que aparece em $f_0$ nos filtros de V_C e V_L quando $Q > 1/\\sqrt2$.`,
      predict: [
        {
          question: "No filtro passa-baixas (saída V_C), muito acima de f0, cada década de frequência reduz o ganho em:",
          options: ["20 dB", "40 dB", "6 dB"],
          answer: 1,
          explanation: "Para $f \\gg f_0$, $|H| \\approx (f_0/f)^2$: duas ordens de grandeza a menos por década, ou seja, $-40$ dB/década (segunda ordem).",
        },
      ],
    },
    {
      id: "paralelo",
      label: "Tanque em paralelo (antirressonância)",
      params: { topologia: PARALELO, grafico: 1, inicio: 1, f: 1000, Vp: 10, R: 10000, L: 10, C: 1, Rg: 500 },
      guide: `### RLC em paralelo
Com os três componentes em paralelo, alimentados por um gerador de resistência interna $R_g$:
1. Varra **f**: na curva, a corrente fornecida é **mínima** em $f_0$ (antirressonância). A impedância do tanque é máxima, igual a $R$.
2. Mesmo assim, as correntes em L e em C são grandes e opostas: a energia circula dentro do tanque. Plote **Corrente no indutor** e **Corrente no capacitor**.
3. No Bode, a tensão no tanque forma um passa-faixa, com $Q = (R\\parallel R_g)\\sqrt{C/L}$.`,
      predict: [
        {
          question: "Na frequência de ressonância, a corrente que o gerador fornece ao tanque LC em paralelo é:",
          options: ["máxima", "mínima", "igual à de qualquer outra frequência"],
          answer: 1,
          explanation: "Em $f_0$, as admitâncias de L e C se cancelam ($1/j\\omega L + j\\omega C = 0$) e só resta $1/R$: a impedância é máxima e a corrente, mínima.",
        },
      ],
    },
  ],

  exercises: [
    {
      id: "f0",
      prompt: "Um circuito RLC série tem R = {R} Ω, L = {L} mH e C = {C} µF. Qual é a frequência de ressonância?",
      vary: { R: [5, 200, 0], L: [1, 100, 1], C: [0.1, 10, 2] },
      fixed: { topologia: SERIE, Rg: 0 },
      answer: { label: "f₀", unit: "Hz", compute: (p) => f0(p) },
      hint: "f₀ = 1/(2π√(LC)); converta mH e µF para H e F.",
    },
    {
      id: "corrente",
      prompt:
        "Uma fonte senoidal de {Vp} V de pico e {f} Hz alimenta um RLC série com R = {R} Ω, L = {L} mH e C = {C} µF. Qual é a amplitude da corrente em regime permanente?",
      vary: { Vp: [1, 20, 1], f: [100, 5000, 0], R: [10, 500, 0], L: [1, 100, 1], C: [0.1, 10, 2] },
      fixed: { topologia: SERIE, Rg: 0 },
      answer: { label: "I_p", unit: "A", compute: (p) => cabs(phasors(p).I) },
      hint: "I_p = V_p/|Z|, com |Z| = √(R² + (ωL − 1/ωC)²).",
    },
  ],

  init,
  step: (s, p, _t, dt) => step(s, p, dt),
  dt: 1 / 500,
  sampleEvery: 2,
  maxSamples: 6000,

  viewport: () => ({ xMin: 0, xMax: 20, yMin: -0.1, yMax: 11.7 }),

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const { state: s, params: p, theme } = frame;
    const ph = phasors(p);
    drawCircuit(d, theme, s, p);
    drawPhasors(d, theme, s, p, ph);
    drawWaves(d, ctx, theme, frame.trail, s, p);
    if (Math.round(num(p, "grafico")) === 1) drawResonance(d, ctx, theme, p);
    else drawBode(d, ctx, theme, p);
  },
});

// ---------------- Circuito ----------------
function drawCircuit(d: Draw, theme: Theme, s: number[], p: Params) {
  const col = theme.text;
  const hi = theme.accent;
  const yt = 11.0;
  const yb = 7.5;
  const xg = 0.8;
  generator(d, xg, yb, xg, yt, "seno", { color: col });
  d.text(`${si(freq(p), "Hz")}`, xg + 0.55, (yt + yb) / 2, { color: theme.muted, size: 11, align: "left" });
  const rg = Rg(p);
  if (topo(p) === SERIE) {
    const out = saida(p);
    if (rg > 0) {
      resistor(d, xg, yt, 2.2, yt, 0.4, { color: theme.muted, width: 1.5 });
      d.text("R_g", 1.5, yt + 0.4, { color: theme.muted, size: 10 });
    } else d.line(xg, yt, 2.2, yt, { color: col, width: 2 });
    resistor(d, 2.2, yt, 4.0, yt, 0.6, { color: out === 0 ? hi : col });
    d.text(`R ${si(R(p), "Ω")}`, 3.1, yt + 0.45, { color: out === 0 ? hi : theme.muted, size: 11 });
    inductor(d, 4.0, yt, 6.2, yt, 0.75, { color: out === 2 ? hi : col, loops: 4 });
    d.text(`L ${si(L(p), "H")}`, 5.1, yt + 0.5, { color: out === 2 ? hi : theme.muted, size: 11 });
    capacitor(d, 6.2, yt, 6.2, yb, { color: out === 1 ? hi : col, platePx: 28, gapPx: 9 });
    d.text(`C ${si(C(p), "F")}`, 5.8, (yt + yb) / 2, { color: out === 1 ? hi : theme.muted, size: 11, align: "right" });
    d.line(xg, yb, 6.2, yb, { color: col, width: 2 });
    d.text(`saída: ${OUT_LABEL[out] ?? "V_R"}`, 3.6, 8.3, { color: hi, size: 11, weight: "600" });
    currentArrow(d, 3.0, yb - 0.3, 1, 0, -s[IS]!, theme.series[2]!);
  } else {
    if (rg > 0) {
      resistor(d, xg, yt, 2.6, yt, 0.5, { color: theme.muted, width: 1.5 });
      d.text("R_g", 1.7, yt + 0.4, { color: theme.muted, size: 10 });
    } else d.line(xg, yt, 2.6, yt, { color: col, width: 2 });
    d.line(2.6, yt, 6.2, yt, { color: col, width: 2 });
    d.line(xg, yb, 6.2, yb, { color: col, width: 2 });
    resistor(d, 3.4, yt, 3.4, yb, 0.8, { color: col });
    inductor(d, 4.8, yt, 4.8, yb, 0.9, { color: col, loops: 4 });
    capacitor(d, 6.2, yt, 6.2, yb, { color: col, platePx: 28, gapPx: 9 });
    d.text("R", 3.1, (yt + yb) / 2, { color: theme.muted, size: 11, align: "right" });
    d.text("L", 4.45, (yt + yb) / 2 + 0.95, { color: theme.muted, size: 11, align: "right" });
    d.text("C", 5.85, (yt + yb) / 2, { color: theme.muted, size: 11, align: "right" });
    d.text("saída: tensão no tanque", 4.8, yb - 0.3, { color: hi, size: 11, weight: "600", align: "left" });
    currentArrow(d, 1.6, yb - 0.3, 1, 0, -s[IS]!, theme.series[2]!);
  }
  const xi = topo(p) === SERIE ? 3.0 : 1.6;
  d.text(`i = ${si(s[IS]!, "A")}`, xi + 0.45, yb - 0.3, { color: theme.series[2]!, size: 11, weight: "600", align: "left" });
}

// ---------------- Fasores ----------------
function drawPhasors(d: Draw, theme: Theme, s: number[], p: Params, ph: ReturnType<typeof phasors>) {
  const cxp = 10;
  const cyp = 9.55;
  const rad = 1.8;
  const phi = s[PH]!;
  // Fasor girando: x = Re(X e^{jφ}), y = Im(X e^{jφ}) = valor instantâneo (fonte = V_p sen φ).
  const c = Math.cos(phi);
  const sn = Math.sin(phi);
  const P = (a: Cx): [number, number] => [a[0] * c - a[1] * sn, a[0] * sn + a[1] * c];
  d.circle(cxp, cyp, rad, { stroke: theme.grid, width: 1 });
  d.line(cxp - rad - 0.2, cyp, cxp + rad + 0.2, cyp, { color: theme.grid, width: 1 });
  d.line(cxp, cyp - rad - 0.2, cxp, cyp + rad + 0.2, { color: theme.grid, width: 1 });
  d.text("Fasores (girando com ωt)", cxp, cyp + rad + 0.45, { color: theme.text, size: 12, weight: "700" });

  const serie = topo(p) === SERIE;
  const chain: { v: Cx; label: string; color: string }[] = serie
    ? [
        ...(Rg(p) > 0 ? [{ v: ph.Vg, label: "V_g", color: theme.muted }] : []),
        { v: ph.VR, label: "V_R", color: theme.series[0]! },
        { v: ph.VL, label: "V_L", color: theme.series[1]! },
        { v: ph.VC, label: "V_C", color: theme.series[4]! },
      ]
    : [
        { v: ph.IR, label: "I_R", color: theme.series[0]! },
        { v: ph.IL, label: "I_L", color: theme.series[1]! },
        { v: ph.IC, label: "I_C", color: theme.series[4]! },
      ];
  const total: Cx = serie ? ph.Vs : ph.I;
  // Escala: cabe a maior soma parcial da cadeia
  let acc: Cx = [0, 0];
  let maxM = cabs(total);
  for (const c of chain) {
    maxM = Math.max(maxM, cabs(c.v));
    acc = cadd(acc, c.v);
    maxM = Math.max(maxM, cabs(acc));
  }
  const k = rad / Math.max(maxM, 1e-30);
  let x = cxp;
  let y = cyp;
  for (const c of chain) {
    const [dx, dy] = P(c.v);
    if (Math.hypot(dx, dy) * k > 1e-3) {
      d.arrow(x, y, dx * k, dy * k, { color: c.color, width: 2.2 });
      const m = Math.hypot(dx, dy);
      d.text(c.label, x + dx * k, y + dy * k, { color: c.color, size: 11, weight: "700", dx: (dx / m) * 14, dy: -(dy / m) * 12 });
    }
    x += dx * k;
    y += dy * k;
  }
  const [tx, ty] = P(total);
  d.arrow(cxp, cyp, tx * k, ty * k, { color: theme.accent, width: 2.6 });
  d.text(serie ? "V_fonte" : "I", cxp + tx * k, cyp + ty * k, { color: theme.accent, size: 11, weight: "700", dx: 14, dy: -10 });
  // Segundo fasor de referência (corrente na série, tensão no paralelo), em escala própria
  const ref: Cx = serie ? ph.I : ph.VR;
  const [rx, ry] = P(ref);
  const rm = Math.hypot(rx, ry);
  if (rm > 0) {
    d.arrow(cxp, cyp, (rx / rm) * rad * 0.55, (ry / rm) * rad * 0.55, { color: theme.series[2]!, width: 2, dash: [5, 3] });
    d.text(serie ? "I" : "V", cxp + (rx / rm) * rad * 0.62, cyp + (ry / rm) * rad * 0.62, { color: theme.series[2]!, size: 11, weight: "700", dx: -8, dy: 8 });
  }
  // Projeção vertical da fonte = valor instantâneo
  d.line(cxp + tx * k, cyp + ty * k, cxp + rad + 0.35, cyp + ty * k, { color: theme.accent, width: 1, dash: [3, 3], alpha: 0.7 });
  d.dot(cxp + rad + 0.35, cyp + ty * k, 3, theme.accent);
  const phiZ = deg(carg(ph.Z));
  const kind = Math.abs(phiZ) < 0.5 ? "resistivo (ressonância)" : phiZ > 0 ? "indutivo: i atrasada" : "capacitivo: i adiantada";
  d.text(`φ = ${phiZ.toFixed(1).replace(".", ",")}°  ${kind}`, cxp, cyp - rad - 0.4, { color: theme.muted, size: 11 });
}

// ---------------- Formas de onda ----------------
function drawWaves(d: Draw, ctx: CanvasRenderingContext2D, theme: Theme, trail: number[][], s: number[], p: Params) {
  const x0 = 13.1;
  const x1 = 19.8;
  const yc = 9.35;
  const hh = 1.9;
  const f = freq(p);
  const span = 2 / f;
  const tNow = s[TF]!;
  d.rect(x0, yc - hh, x1 - x0, 2 * hh, { stroke: theme.grid, width: 1 });
  d.line(x0, yc, x1, yc, { color: theme.grid, width: 1 });
  d.text("Últimos 2 ciclos", (x0 + x1) / 2, yc + hh + 0.45, { color: theme.text, size: 12, weight: "700" });
  const pts: number[][] = [];
  for (let k = trail.length - 1; k >= 0; k--) {
    const st = trail[k]!;
    if (st[TF]! < tNow - span - 1e-15) break;
    pts.push(st);
  }
  pts.reverse();
  if (pts.length < 2 || pts[pts.length - 1]![TF]! < tNow - 1e-15) pts.push(s);
  const vmax = Math.max(num(p, "Vp", 10), ...pts.map((q) => Math.abs(vOut(q, p))));
  const imax = Math.max(1e-12, cabs(phasors(p).I), ...pts.map((q) => Math.abs(q[IS]!)));
  const X = (t: number) => x1 - ((tNow - t) / span) * (x1 - x0);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, yc - hh, x1 - x0, 2 * hh);
  ctx.clip();
  const line = (g: (q: number[]) => number, scale: number, color: string, width = 2) =>
    d.polyline(
      pts.map((q) => [X(q[TF]!), yc + (g(q) / scale) * hh * 0.92] as [number, number]),
      { color, width },
    );
  line((q) => q[VS]!, vmax, theme.accent);
  line((q) => vOut(q, p), vmax, theme.series[1]!, 1.6);
  line((q) => q[IS]!, imax, theme.series[2]!);
  ctx.restore();
  d.text("v_fonte", x0 + 0.1, yc - hh - 0.3, { color: theme.accent, size: 10, align: "left", weight: "600" });
  d.text("v_saída", x0 + 2.2, yc - hh - 0.3, { color: theme.series[1]!, size: 10, align: "left", weight: "600" });
  d.text("i (escala própria)", x1, yc - hh - 0.3, { color: theme.series[2]!, size: 10, align: "right", weight: "600" });
}

// ---------------- Bode e ressonância ----------------
const PX0 = 2.0;
const PX1 = 19.5;
const lx = (f: number) => PX0 + ((Math.log10(f) - Math.log10(FMIN)) / (Math.log10(FMAX) - Math.log10(FMIN))) * (PX1 - PX0);

function freqAxis(d: Draw, theme: Theme, y0: number, y1: number, labels: boolean) {
  for (let e = 1; e <= 5; e++) {
    for (let m = 1; m < 10; m++) {
      const f = m * 10 ** e;
      if (f > FMAX * 1.0001 || f < FMIN) continue;
      d.line(lx(f), y0, lx(f), y1, { color: theme.grid, width: m === 1 ? 1.2 : 0.7 });
    }
    if (labels) d.text(si(10 ** e, "Hz", 2), lx(10 ** e), y0 - 0.28, { color: theme.muted, size: 10 });
  }
  d.rect(PX0, y0, PX1 - PX0, y1 - y0, { stroke: theme.muted, width: 1 });
}

function markers(d: Draw, theme: Theme, p: Params, y0: number, y1: number) {
  const fr = f0(p);
  if (fr >= FMIN && fr <= FMAX) {
    d.line(lx(fr), y0, lx(fr), y1, { color: theme.muted, width: 1.2, dash: [5, 4] });
    d.text("f₀", lx(fr), y1, { color: theme.muted, size: 10, align: "left", dx: 4, dy: 9 });
  }
  d.line(lx(freq(p)), y0, lx(freq(p)), y1, { color: theme.accent, width: 1.5 });
}

function curve(f: (fr: number) => number, n = 300): [number, number][] {
  const out: [number, number][] = [];
  for (let k = 0; k <= n; k++) {
    const fr = FMIN * (FMAX / FMIN) ** (k / n);
    out.push([fr, f(fr)]);
  }
  return out;
}

function drawBode(d: Draw, ctx: CanvasRenderingContext2D, theme: Theme, p: Params) {
  const dbMin = -60;
  const dbMax = 30;
  const m0 = 3.95;
  const m1 = 6.45;
  const a0 = 0.55;
  const a1 = 3.05;
  const Ym = (db: number) => m0 + ((clamp(db, dbMin - 5, dbMax + 5) - dbMin) / (dbMax - dbMin)) * (m1 - m0);
  const Ya = (dg: number) => a0 + ((dg + 180) / 360) * (a1 - a0);
  freqAxis(d, theme, m0, m1, false);
  freqAxis(d, theme, a0, a1, true);
  for (const db of [-60, -40, -20, 0, 20]) {
    d.line(PX0, Ym(db), PX1, Ym(db), { color: theme.grid, width: db === 0 ? 1.4 : 0.8 });
    d.text(`${db}`, PX0 - 0.12, Ym(db), { color: theme.muted, size: 10, align: "right" });
  }
  for (const dg of [-180, -90, 0, 90, 180]) {
    d.line(PX0, Ya(dg), PX1, Ya(dg), { color: theme.grid, width: dg === 0 ? 1.4 : 0.8 });
    d.text(`${dg}°`, PX0 - 0.12, Ya(dg), { color: theme.muted, size: 10, align: "right" });
  }
  d.text("|H| (dB)", PX0 - 0.95, m1 + 0.3, { color: theme.text, size: 11, weight: "700", align: "left" });
  d.text("fase de H", PX0 - 0.95, a1 + 0.3, { color: theme.text, size: 11, weight: "700", align: "left" });
  const label = topo(p) === SERIE ? `H = ${OUT_LABEL[saida(p)] ?? "V_R"} / V_fonte` : "H = V_tanque / V_fonte";
  d.text(label, PX1, m1 + 0.3, { color: theme.series[1]!, size: 11, weight: "600", align: "right" });

  const mag = curve((fr) => 20 * Math.log10(cabs(phasors(p, fr).H)));
  const pha = curve((fr) => deg(carg(phasors(p, fr).H)));
  ctx.save();
  ctx.beginPath();
  ctx.rect(PX0, m0, PX1 - PX0, m1 - m0);
  ctx.clip();
  d.polyline(
    mag.map(([fr, v]) => [lx(fr), Ym(v)] as [number, number]),
    { color: theme.series[1]!, width: 2.4 },
  );
  ctx.restore();
  ctx.save();
  ctx.beginPath();
  ctx.rect(PX0, a0, PX1 - PX0, a1 - a0);
  ctx.clip();
  // Quebra a linha nos saltos de ±360° (não acontecem aqui, mas evita riscos verticais)
  d.polyline(
    pha.map(([fr, v]) => [lx(fr), Ya(v)] as [number, number]),
    { color: theme.series[3]!, width: 2.2 },
  );
  ctx.restore();
  markers(d, theme, p, m0, m1);
  markers(d, theme, p, a0, a1);
  const H = phasors(p).H;
  const db = 20 * Math.log10(cabs(H));
  d.dot(lx(freq(p)), Ym(db), 5, theme.accent);
  d.dot(lx(freq(p)), Ya(deg(carg(H))), 5, theme.accent);
  d.text(`${db.toFixed(1).replace(".", ",")} dB`, lx(freq(p)), Ym(db), { color: theme.accent, size: 11, weight: "700", dx: 8, dy: -10, align: "left" });
  d.text(`${deg(carg(H)).toFixed(0)}°`, lx(freq(p)), Ya(deg(carg(H))), { color: theme.accent, size: 11, weight: "700", dx: 8, dy: -10, align: "left" });
}

function drawResonance(d: Draw, ctx: CanvasRenderingContext2D, theme: Theme, p: Params) {
  const y0 = 0.55;
  const y1 = 6.45;
  const pts = curve((fr) => cabs(phasors(p, fr).I), 500);
  const imax = Math.max(...pts.map((q) => q[1])) * 1.1;
  const Y = (i: number) => y0 + (i / imax) * (y1 - y0);
  freqAxis(d, theme, y0, y1, true);
  const raw = imax / 4;
  const p10 = 10 ** Math.floor(Math.log10(raw));
  const stepI = (raw / p10 < 1.5 ? 1 : raw / p10 < 3.5 ? 2 : raw / p10 < 7.5 ? 5 : 10) * p10;
  for (let v = stepI; v < imax; v += stepI) {
    d.line(PX0, Y(v), PX1, Y(v), { color: theme.grid, width: 0.8 });
    d.text(si(v, "A", 2), PX0 - 0.12, Y(v), { color: theme.muted, size: 10, align: "right" });
  }
  d.text("amplitude da corrente da fonte I_p", PX0 - 0.95, y1 + 0.3, { color: theme.text, size: 11, weight: "700", align: "left" });
  ctx.save();
  ctx.beginPath();
  ctx.rect(PX0, y0, PX1 - PX0, y1 - y0);
  ctx.clip();
  // Faixa de meia potência (série): I ≥ I_max/√2, entre f₀/Q de largura
  const fr = f0(p);
  const Q = quality(p);
  if (topo(p) === SERIE && fr > FMIN && fr < FMAX) {
    const ipk = cabs(phasors(p, fr).I);
    const half = ipk / Math.SQRT2;
    const band = pts.filter((q) => q[1] >= half);
    if (band.length > 1) {
      d.rect(lx(band[0]![0]), y0, lx(band[band.length - 1]![0]) - lx(band[0]![0]), y1 - y0, { fill: theme.accent, alpha: 0.1 });
      d.line(PX0, Y(half), PX1, Y(half), { color: theme.accent, width: 1, dash: [4, 4], alpha: 0.7 });
    }
  }
  d.polyline(
    pts.map(([f, v]) => [lx(f), Y(v)] as [number, number]),
    { color: theme.series[2]!, width: 2.4 },
  );
  ctx.restore();
  markers(d, theme, p, y0, y1);
  const ip = cabs(phasors(p).I);
  d.dot(lx(freq(p)), Y(ip), 5, theme.accent);
  d.text(si(ip, "A"), lx(freq(p)), Y(ip), { color: theme.accent, size: 11, weight: "700", dx: 8, dy: -10, align: "left" });
  const info =
    topo(p) === SERIE
      ? `f₀ = ${si(fr, "Hz")}   Q = ${Q.toFixed(2).replace(".", ",")}   Δf = f₀/Q = ${si(fr / Q, "Hz")} (faixa de meia potência)`
      : `f₀ = ${si(fr, "Hz")}   Q = ${Q.toFixed(2).replace(".", ",")}   corrente mínima na antirressonância`;
  d.text(info, PX1, y1 + 0.3, { color: theme.muted, size: 11, align: "right" });
}

export default rlcCa;
