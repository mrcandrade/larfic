import { defineSim, draw, num, texNum, type Params } from "@fisilab/core";
import {
  ADIABATICO,
  ISOBARICO,
  ISOCORICO,
  ISOTERMICO,
  KINDS,
  areaUnder,
  energy,
  pathPoints,
  project,
  sumEnergy,
  temperature,
  type Box,
  type Energy,
  type Pt,
  type Stage,
} from "./thermo.ts";

export * from "./thermo.ts";

export interface PVState {
  /** Processos já confirmados, em ordem. */
  stages: Stage[];
  /** Estado inicial do processo em edição (fim do último confirmado). */
  start: Pt;
  /** Ponto que o aluno arrastou; o fim real é a projeção sobre o caminho permitido. */
  target: Pt;
}

const PLOT = { x0: 7, x1: 19.5, y0: 0.9, y1: 9.1 };
const gammaOf = (p: Params) => num(p, "gamma", 5 / 3);

/** Faixas dos eixos, fixas para um conjunto de parâmetros (não mudam ao arrastar). */
export function axes(p: Params): { Vmax: number; Pmax: number; box: Box } {
  const Vmax = Math.max(3 * num(p, "V0", 25), 1.25 * num(p, "Vf", 50));
  const Pmax = Math.max(3.5 * num(p, "P0", 100), 1.25 * num(p, "Pf", 200));
  return { Vmax, Pmax, box: { Vlo: 0.04 * Vmax, Vhi: 0.98 * Vmax, Plo: 0.02 * Pmax, Phi: 0.98 * Pmax } };
}

const near = (a: Pt, b: Pt, Vmax: number, Pmax: number, f: number) =>
  Math.abs(a.V - b.V) < f * Vmax && Math.abs(a.P - b.P) < f * Pmax;

/** Processo em edição: tipo, início, fim projetado (com "ímã" no ponto inicial do ciclo) e energias. */
export function current(s: PVState, p: Params): { kind: number; A: Pt; B: Pt; e: Energy } {
  const kind = Math.round(num(p, "processo"));
  const g = gammaOf(p);
  const { Vmax, Pmax, box } = axes(p);
  const A = s.start;
  let B = project(kind, A, s.target, g, box);
  const first = s.stages[0]?.A;
  if (first && near(B, first, Vmax, Pmax, 0.04)) {
    // Ímã: se o caminho passa (quase) pelo estado inicial, o fim encaixa nele.
    const snap = project(kind, A, first, g, box);
    if (near(snap, first, Vmax, Pmax, 0.005)) B = snap;
  }
  return { kind, A, B, e: energy(kind, A, B, g) };
}

function allEnergies(s: PVState, p: Params): Energy[] {
  const g = gammaOf(p);
  return [...s.stages.map((st) => energy(st.kind, st.A, st.B, g)), current(s, p).e];
}

export function totals(s: PVState, p: Params) {
  return sumEnergy(allEnergies(s, p));
}

/** Verdadeiro quando os processos (confirmados + atual) voltam ao estado inicial. */
export function isClosed(s: PVState, p: Params): boolean {
  const first = s.stages[0]?.A;
  if (!first) return false;
  const { A, B } = current(s, p);
  const moving = Math.abs(B.V - A.V) > 1e-9 || Math.abs(B.P - A.P) > 1e-9;
  const end = moving ? B : A;
  const count = s.stages.length + (moving ? 1 : 0);
  return count >= 2 && Math.abs(end.V - first.V) / first.V < 1e-3 && Math.abs(end.P - first.P) / first.P < 1e-3;
}

export function initState(p: Params): PVState {
  return { stages: [], start: { P: num(p, "P0", 100), V: num(p, "V0", 25) }, target: { V: num(p, "Vf", 50), P: num(p, "Pf", 200) } };
}

const fmt = (v: number, d = 3) => (Math.abs(v) < 0.05 ? "0" : String(+v.toPrecision(d)).replace(".", ","));

export const processosPv = defineSim<PVState>({
  id: "processos-pv",
  title: "Processos no diagrama PV",
  course: "FG II",
  topic: "1ª Lei",
  priority: "P1",
  summary:
    "Arraste o estado final de um gás ideal no diagrama PV: o processo escolhido (isotérmico, adiabático, isobárico ou isocórico) restringe o caminho, a área sombreada é o trabalho e Q, W e ΔU saem da primeira lei. Encadeie processos até fechar um ciclo.",
  equations: [
    String.raw`PV = nRT \qquad \Delta U = Q - W \qquad W = \int_{V_A}^{V_B} P\,dV`,
    String.raw`\Delta U = n C_V \Delta T = \frac{P_B V_B - P_A V_A}{\gamma - 1}`,
    String.raw`\text{isotérmico: } W = nRT\ln\frac{V_B}{V_A} \qquad \text{adiabático: } PV^{\gamma} = \text{const},\ Q = 0`,
    String.raw`\text{isobárico: } W = P\,\Delta V \qquad \text{isocórico: } W = 0,\ Q = \Delta U`,
  ],
  liveEquations(s, p) {
    const { kind, A, B, e } = current(s, p);
    const n = num(p, "n", 1);
    const tot = totals(s, p);
    const out = [
      String.raw`\text{${KINDS[kind]}: } (${texNum(A.V)}\ \text{L},\ ${texNum(A.P)}\ \text{kPa}) \to (${texNum(B.V)}\ \text{L},\ ${texNum(B.P)}\ \text{kPa}),\quad T: ${texNum(temperature(A, n))} \to ${texNum(temperature(B, n))}\ \text{K}`,
      String.raw`Q = ${texNum(e.Q)}\ \text{J} \qquad W = ${texNum(e.W)}\ \text{J} \qquad \Delta U = ${texNum(e.dU)}\ \text{J}`,
      String.raw`\text{Total: } Q = ${texNum(tot.Q)}\ \text{J},\ W = ${texNum(tot.W)}\ \text{J},\ \Delta U = ${texNum(tot.dU)}\ \text{J}`,
    ];
    if (isClosed(s, p) && tot.Qin > 0) out.push(String.raw`\text{Ciclo fechado: } \Delta U = 0,\quad \eta = \frac{W}{Q_{\text{in}}} = \frac{${texNum(tot.W)}}{${texNum(tot.Qin)}} = ${texNum((100 * tot.W) / tot.Qin)}\%`);
    return out;
  },

  params: [
    {
      key: "processo",
      label: "Processo",
      unit: "",
      min: 0,
      max: 3,
      step: 1,
      default: 0,
      live: true,
      options: KINDS.map((k, i) => ({ value: i, label: k[0]!.toUpperCase() + k.slice(1) })),
    },
    {
      key: "gamma",
      label: "Gás",
      unit: "",
      min: 1.3,
      max: 1.7,
      step: 0.01,
      default: 5 / 3,
      options: [
        { value: 5 / 3, label: "Monoatômico (γ = 5/3)" },
        { value: 1.4, label: "Diatômico (γ = 7/5)" },
      ],
    },
    { key: "n", label: "Quantidade de gás", unit: "mol", min: 0.1, max: 5, step: 0.1, default: 1 },
    { key: "P0", label: "Pressão inicial", unit: "kPa", min: 20, max: 500, step: 5, default: 100 },
    { key: "V0", label: "Volume inicial", unit: "L", min: 1, max: 50, step: 0.5, default: 25 },
    { key: "Vf", label: "Volume final proposto", unit: "L", min: 1, max: 100, step: 0.5, default: 50 },
    { key: "Pf", label: "Pressão final proposta (isocórico)", unit: "kPa", min: 10, max: 1000, step: 5, default: 200 },
  ],

  observables: [
    { key: "P", label: "Pressão final", unit: "kPa", value: (s, p) => current(s, p).B.P },
    { key: "V", label: "Volume final", unit: "L", value: (s, p) => current(s, p).B.V },
    { key: "T", label: "Temperatura final", unit: "K", value: (s, p) => temperature(current(s, p).B, num(p, "n", 1)) },
    { key: "Q", label: "Calor recebido (processo atual)", unit: "J", value: (s, p) => current(s, p).e.Q },
    { key: "W", label: "Trabalho do gás (processo atual)", unit: "J", value: (s, p) => current(s, p).e.W },
    { key: "dU", label: "ΔU (processo atual)", unit: "J", value: (s, p) => current(s, p).e.dU },
    { key: "Qt", label: "Calor total", unit: "J", value: (s, p) => totals(s, p).Q },
    { key: "Wt", label: "Trabalho total", unit: "J", value: (s, p) => totals(s, p).W },
    { key: "dUt", label: "ΔU total", unit: "J", value: (s, p) => totals(s, p).dU },
  ],
  chart: { x: "V", y: "P" },

  scenarios: [
    {
      id: "isotermica",
      label: "Expansão isotérmica",
      params: { processo: ISOTERMICO, P0: 100, V0: 25, Vf: 50 },
      guide: `### Expansão a temperatura constante
1. Arraste o ponto final **B** sobre a hipérbole. Ele só anda sobre a isoterma $PV = nRT$.
2. Compare a área sombreada com $W = nRT\\ln(V_B/V_A)$ e confira que $\\Delta U = 0$.
3. Se a energia interna não muda, de onde vem o trabalho? Olhe a seta de calor no cilindro.`,
      predict: [
        {
          question: "Numa expansão isotérmica de um gás ideal, o calor recebido Q é:",
          options: ["zero", "igual ao trabalho W feito pelo gás", "igual a ΔU", "maior que W"],
          answer: 1,
          explanation: "Com T constante, $\\Delta U = nC_V\\Delta T = 0$, então $Q = W$: todo o calor vira trabalho.",
        },
      ],
    },
    {
      id: "adiabatica",
      label: "Compressão adiabática",
      params: { processo: ADIABATICO, P0: 100, V0: 25, Vf: 10 },
      guide: `### Sem troca de calor
1. Arraste B para volumes menores. A curva adiabática $PV^\\gamma = \\text{const}$ é mais inclinada que a isoterma tracejada.
2. Veja: $Q = 0$, o trabalho é negativo (feito **sobre** o gás) e $\\Delta U = -W > 0$: o gás esquenta.
3. Troque para gás diatômico (reinicia). A temperatura final sobe mais ou menos?`,
      predict: [
        {
          question: "Comprimindo o gás adiabaticamente pela metade do volume, a temperatura:",
          options: ["fica igual", "aumenta", "diminui"],
          answer: 1,
          explanation: "Sem calor, o trabalho feito sobre o gás vira energia interna: $TV^{\\gamma-1}$ é constante, então T sobe quando V cai.",
        },
      ],
    },
    {
      id: "ciclo",
      label: "Monte um ciclo retangular",
      params: { processo: ISOBARICO, P0: 100, V0: 20, Vf: 50, Pf: 250 },
      guide: `### Ciclo com quatro processos
1. **Isobárico**: leve B até 50 L e clique em *Confirmar processo*.
2. **Isocórico**: escolha o processo, arraste B para cima (cerca de 250 kPa) e confirme.
3. **Isobárico** de volta a 20 L e confirme; depois **isocórico** até o ponto inicial (o ponto encaixa).
4. Com o ciclo fechado, confira: $\\Delta U_{\\text{total}} = 0$ e $W_{\\text{total}} = Q_{\\text{total}}$ = área dentro do retângulo.
5. O ciclo foi no sentido horário ou anti-horário? Ele é um motor ou um refrigerador?`,
    },
    {
      id: "comparar",
      label: "Isotérmica × adiabática",
      params: { processo: ISOTERMICO, P0: 200, V0: 10, Vf: 30 },
      guide: `### Mesma expansão, caminhos diferentes
1. Leve B até 30 L na isotérmica e anote $W$ e $Q$.
2. Troque para **adiabático** (sem reiniciar): o mesmo volume final dá outro ponto B. Qual caminho tem mais área?
3. Trabalho e calor dependem do caminho; $\\Delta U$ depende só dos estados inicial e final.`,
    },
  ],

  exercises: [
    {
      id: "isotermico",
      prompt: "Um gás ideal a {P0} kPa ocupa {V0} L e se expande isotermicamente até {Vf} L. Qual é o trabalho realizado pelo gás?",
      vary: { P0: [80, 300, 0], V0: [5, 20, 0], Vf: [25, 60, 0] },
      fixed: { processo: ISOTERMICO },
      answer: { label: "W", unit: "J", compute: (p) => num(p, "P0") * num(p, "V0") * Math.log(num(p, "Vf") / num(p, "V0")) },
      hint: "W = nRT ln(V_B/V_A) e nRT = P_A V_A; 1 kPa·L = 1 J.",
    },
    {
      id: "adiabatico",
      prompt: "Um gás diatômico (γ = 1,4) a {P0} kPa e {V0} L é comprimido adiabaticamente até {Vf} L. Qual é a pressão final?",
      vary: { P0: [80, 200, 0], V0: [20, 40, 0], Vf: [5, 15, 0] },
      fixed: { processo: ADIABATICO, gamma: 1.4 },
      answer: { label: "P_B", unit: "kPa", compute: (p) => num(p, "P0") * (num(p, "V0") / num(p, "Vf")) ** 1.4 },
    },
    {
      id: "isobarico",
      prompt: "Um gás monoatômico se expande à pressão constante de {P0} kPa, de {V0} L até {Vf} L. Quanto calor ele recebe?",
      vary: { P0: [50, 300, 0], V0: [5, 20, 0], Vf: [25, 50, 0] },
      fixed: { processo: ISOBARICO, gamma: 5 / 3 },
      answer: { label: "Q", unit: "J", compute: (p) => 2.5 * num(p, "P0") * (num(p, "Vf") - num(p, "V0")) },
      hint: "Q = n C_P ΔT = (5/2) P ΔV para gás monoatômico.",
    },
  ],

  init: initState,
  step: (s) => s,
  static: true,
  sampleEvery: 1000,
  maxSamples: 600,

  pointer: {
    down(s, p, pt) {
      const t = fromPlot(p, pt);
      return t ? { ...s, target: t } : undefined;
    },
    move(s, p, pt, dragging) {
      if (!dragging) return undefined;
      const t = fromPlot(p, pt);
      return t ? { ...s, target: t } : undefined;
    },
    cursor: (_s, p, pt) => (fromPlot(p, pt) ? "grab" : undefined),
  },

  actions: [
    {
      id: "confirmar",
      label: "Confirmar processo",
      run(s, p) {
        const { kind, A, B } = current(s, p);
        if (Math.abs(B.V - A.V) < 1e-9 && Math.abs(B.P - A.P) < 1e-9) return s;
        return { stages: [...s.stages, { kind, A, B }], start: B, target: B };
      },
    },
    {
      id: "desfazer",
      label: "Desfazer último",
      run(s) {
        const last = s.stages[s.stages.length - 1];
        if (!last) return s;
        return { stages: s.stages.slice(0, -1), start: last.A, target: last.B };
      },
    },
    {
      id: "limpar",
      label: "Recomeçar",
      run: (_s, p) => initState(p),
    },
  ],

  viewport: () => ({ xMin: 0, xMax: 20, yMin: 0, yMax: 10 }),

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const { state: s, params: p, theme } = frame;
    const g = gammaOf(p);
    const n = num(p, "n", 1);
    const { Vmax, Pmax } = axes(p);
    const { kind, A, B, e } = current(s, p);
    const closed = isClosed(s, p);
    const tot = totals(s, p);
    const X = (V: number) => PLOT.x0 + (V / Vmax) * (PLOT.x1 - PLOT.x0);
    const Y = (P: number) => PLOT.y0 + (P / Pmax) * (PLOT.y1 - PLOT.y0);
    const xy = (q: Pt): [number, number] => [X(q.V), Y(q.P)];

    // ---------- Diagrama PV ----------
    d.grid(PLOT.x0, PLOT.x1, PLOT.y0, PLOT.y1, (PLOT.x1 - PLOT.x0) / 8, { width: 1 });
    d.line(PLOT.x0, PLOT.y0, PLOT.x1 + 0.2, PLOT.y0, { color: theme.muted });
    d.line(PLOT.x0, PLOT.y0, PLOT.x0, PLOT.y1 + 0.2, { color: theme.muted });
    d.text("V (L)", PLOT.x1, PLOT.y0 - 0.55, { color: theme.muted, size: 11, align: "right" });
    d.text("P (kPa)", PLOT.x0, PLOT.y1 + 0.35, { color: theme.muted, size: 11, align: "left" });
    for (let k = 0; k <= 4; k++) {
      d.text(fmt((Vmax * k) / 4, 2), X((Vmax * k) / 4), PLOT.y0 - 0.25, { color: theme.muted, size: 10 });
      if (k > 0) d.text(fmt((Pmax * k) / 4, 2), PLOT.x0 - 0.12, Y((Pmax * k) / 4), { color: theme.muted, size: 10, align: "right" });
    }

    // Isotermas de referência (pontilhadas) e as curvas que passam pelo início.
    const curve = (c: number, k: number) => (x: number) => {
      const P = c / (((x - PLOT.x0) / (PLOT.x1 - PLOT.x0)) * Vmax) ** k;
      return P <= Pmax ? Y(P) : NaN;
    };
    for (const f of [0.5, 2, 4]) d.plot(curve(A.P * A.V * f, 1), PLOT.x0 + 0.01, PLOT.x1, { color: theme.muted, width: 1, dash: [2, 4], alpha: 0.6, n: 300 });
    const guideColor = theme.series[4]!;
    if (kind === ISOTERMICO || kind === ADIABATICO) {
      const k = kind === ISOTERMICO ? 1 : g;
      const c = A.P * A.V ** k;
      d.plot(curve(c, k), PLOT.x0 + 0.01, PLOT.x1, { color: guideColor, width: 1.5, dash: [6, 4], alpha: 0.8 });
    } else if (kind === ISOBARICO) d.line(PLOT.x0, Y(A.P), PLOT.x1, Y(A.P), { color: guideColor, width: 1.5, dash: [6, 4], alpha: 0.8 });
    else d.line(X(A.V), PLOT.y0, X(A.V), PLOT.y1, { color: guideColor, width: 1.5, dash: [6, 4], alpha: 0.8 });

    // Ciclo fechado: sombreia a área interna (= trabalho líquido).
    const allStages = [...s.stages, { kind, A, B }];
    if (closed) {
      const poly = allStages.flatMap((st) => pathPoints(st.kind, st.A, st.B, g, 40).map(xy));
      d.polyline(poly, { color: "none", fill: tot.W >= 0 ? theme.positive : theme.negative, alpha: 0.28, close: true });
    }
    // Etapas confirmadas
    s.stages.forEach((st, i) => {
      d.polyline(pathPoints(st.kind, st.A, st.B, g, 50).map(xy), { color: theme.series[(i + 1) % theme.series.length]!, width: 2.5 });
      d.dot(X(st.A.V), Y(st.A.P), 4, theme.text);
      d.text(String(i + 1), X(st.A.V), Y(st.A.P), { dx: -9, dy: -9, size: 11, weight: "700" });
    });

    // Processo atual: área sob a curva = trabalho (cor indica o sinal).
    const pts = pathPoints(kind, A, B, g, 60);
    if (!closed && Math.abs(B.V - A.V) > 1e-9) {
      const poly = [...pts.map(xy), [X(B.V), PLOT.y0] as [number, number], [X(A.V), PLOT.y0] as [number, number]];
      d.polyline(poly, { color: "none", fill: e.W >= 0 ? theme.positive : theme.negative, alpha: 0.22, close: true });
      const mid = pts[30]!;
      d.text(`área = W = ${fmt(e.W)} J`, X(mid.V), (Y(mid.P) + PLOT.y0) / 2, { size: 12, weight: "600", color: e.W >= 0 ? theme.positive : theme.negative });
    }
    d.polyline(pts.map(xy), { color: theme.accent, width: 3.5 });
    // Seta de sentido no meio do caminho
    const m0 = pts[28]!;
    const m1 = pts[32]!;
    if (Math.hypot(X(m1.V) - X(m0.V), Y(m1.P) - Y(m0.P)) > 1e-6) d.arrowPx(X(m0.V), Y(m0.P), X(m1.V) - X(m0.V), Y(m1.P) - Y(m0.P), 14, { color: theme.accent });
    d.dot(X(A.V), Y(A.P), 5, theme.text);
    d.text("A", X(A.V), Y(A.P), { dx: -10, dy: 10, size: 13, weight: "700" });
    d.circle(X(B.V), Y(B.P), 0, { minPx: 8, fill: theme.series[1]!, stroke: theme.text, width: 1.5 });
    d.text("B", X(B.V), Y(B.P), { dx: 13, dy: -12, size: 13, weight: "700", color: theme.series[1]! });
    // Alvo arrastado, quando o processo não deixa o ponto chegar lá
    const tg = s.target;
    if (Math.hypot(X(tg.V) - X(B.V), Y(tg.P) - Y(B.P)) > 0.15) {
      d.line(X(tg.V), Y(tg.P), X(B.V), Y(B.P), { color: theme.muted, width: 1, dash: [3, 3] });
      d.circle(X(tg.V), Y(tg.P), 0, { minPx: 5, stroke: theme.muted, width: 1 });
    }
    d.text(
      closed ? `Ciclo fechado: W = Q = ${fmt(tot.W)} J` : `Arraste B: processo ${KINDS[kind]}`,
      (PLOT.x0 + PLOT.x1) / 2,
      9.7,
      { size: 13, weight: "600" },
    );

    // ---------- Cilindro (estado B) ----------
    const T0 = temperature({ P: num(p, "P0", 100), V: num(p, "V0", 25) }, n);
    const TB = temperature(B, n);
    const cx0 = 0.9, cx1 = 4.3, cy0 = 5.3, cyTop = 9.2;
    const h = Math.max(0.15, (B.V / Vmax) * (cyTop - cy0 - 0.3));
    const heat = Math.max(0, Math.min(1, 0.5 + 0.35 * Math.log(TB / T0)));
    d.rect(cx0, cy0, cx1 - cx0, h, { fill: `rgba(${Math.round(60 + 190 * heat)}, ${Math.round(110 - 40 * heat)}, ${Math.round(230 - 180 * heat)}, 0.3)` });
    d.line(cx0, cy0, cx0, cyTop, { width: 3 });
    d.line(cx1, cy0, cx1, cyTop, { width: 3 });
    d.line(cx0, cy0, cx1, cy0, { width: 3 });
    d.rect(cx0 + 0.04, cy0 + h, cx1 - cx0 - 0.08, 0.25, { fill: theme.muted });
    d.text(`T = ${fmt(TB)} K`, (cx0 + cx1) / 2, cy0 + Math.min(h, 1.2) / 2, { size: 12, weight: "600" });
    if (Math.abs(e.W) > 0.5) {
      d.arrowPx(cx1 + 0.35, cy0 + h, 0, Math.sign(e.W), 26, { color: theme.series[2] });
      d.text(e.W > 0 ? "gás realiza W" : "W sobre o gás", cx1 + 0.45, cy0 + h + Math.sign(e.W) * 0.95, { size: 10, color: theme.series[2], align: "left" });
    }
    if (Math.abs(e.Q) > 0.5) {
      const qc = e.Q > 0 ? theme.positive : theme.negative;
      for (const dx of [-0.8, 0, 0.8]) d.arrowPx((cx0 + cx1) / 2 + dx, e.Q > 0 ? cy0 - 0.75 : cy0 - 0.15, 0, e.Q > 0 ? 1 : -1, 18, { color: qc });
      d.text(e.Q > 0 ? "Q entra" : "Q sai", cx0 - 0.1, cy0 - 0.45, { size: 10, color: qc, align: "right" });
    } else d.text("Q = 0 (isolado)", (cx0 + cx1) / 2, cy0 - 0.45, { size: 10, color: theme.muted });

    // ---------- Barras de energia do processo atual ----------
    const bars: [string, number, string][] = [
      ["Q", e.Q, theme.positive],
      ["W", e.W, theme.series[2]!],
      ["ΔU", e.dU, theme.series[5]!],
    ];
    const base = 2.6;
    const big = Math.max(1, ...bars.map((b) => Math.abs(b[1])));
    d.line(0.3, base, 5.2, base, { color: theme.muted, width: 1 });
    bars.forEach(([lab, v, c], i) => {
      const x = 0.7 + i * 1.6;
      const hh = (v / big) * 1.7;
      d.rect(x, Math.min(base, base + hh), 0.9, Math.abs(hh), { fill: c, alpha: 0.85 });
      d.text(lab, x + 0.45, base + (v >= 0 ? -0.3 : 0.3), { size: 12, weight: "700" });
      d.text(`${fmt(v)} J`, x + 0.45, base + hh + (v >= 0 ? 0.25 : -0.25), { size: 10 });
    });
    d.text("Q = ΔU + W (processo atual)", 2.75, 4.75, { size: 11, color: theme.muted });
    d.text(`Total (${s.stages.length + 1} proc.): Q ${fmt(tot.Q)} J, W ${fmt(tot.W)} J`, 2.75, 0.25, { size: 10, color: theme.muted });
  },
});

/** Converte um ponto do palco em (V, P), ou undefined fora do gráfico. */
function fromPlot(p: Params, pt: { x: number; y: number }): Pt | undefined {
  if (pt.x < PLOT.x0 - 0.3 || pt.x > PLOT.x1 + 0.3 || pt.y < PLOT.y0 - 0.3 || pt.y > PLOT.y1 + 0.3) return undefined;
  const { Vmax, Pmax } = axes(p);
  return {
    V: Math.max(1e-3, ((pt.x - PLOT.x0) / (PLOT.x1 - PLOT.x0)) * Vmax),
    P: Math.max(1e-3, ((pt.y - PLOT.y0) / (PLOT.y1 - PLOT.y0)) * Pmax),
  };
}

export default processosPv;
