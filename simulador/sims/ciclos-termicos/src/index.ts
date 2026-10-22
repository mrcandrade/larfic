import { defineSim, draw, rng, texNum, type Params } from "@fisilab/core";
import { along, buildCycle, cycleTotals, energy, progressTotals, type CycleParams, type Gas } from "./thermo.ts";
import { derivation } from "./derivation.ts";

export * from "./thermo.ts";

const NAMES = ["Carnot", "Otto", "Diesel", "Stirling", "Brayton"];
const KIND_LABEL = { isotermico: "isotérmico", adiabatico: "adiabático", isocorico: "isocórico", isobarico: "isobárico" } as const;

export function cycleParams(p: Params): CycleParams {
  return {
    n: p.n ?? 1,
    gamma: p.gamma ?? 1.4,
    TH: p.TH ?? 800,
    TC: p.TC ?? 300,
    Vmax: (p.Vmax ?? 24) / 1000,
    r: p.r ?? 8,
    rc: p.rc ?? 2,
    rp: p.rp ?? 8,
  };
}

const gasOf = (p: Params): Gas => ({ n: p.n ?? 1, gamma: p.gamma ?? 1.4 });
const cycleOf = (p: Params) => buildCycle(Math.round(p.ciclo ?? 0), cycleParams(p));

// Partículas do gás: posições pseudoaleatórias fixas, movidas por uma onda triangular.
const PARTICLES = (() => {
  const r = rng(7);
  return Array.from({ length: 46 }, () => ({ x: r(), y: r(), vx: r() * 2 - 1, vy: r() * 2 - 1 }));
})();
const tri = (x: number) => {
  const f = ((x % 2) + 2) % 2;
  return f < 1 ? f : 2 - f;
};

export const ciclosTermicos = defineSim({
  id: "ciclos-termicos",
  title: "Ciclos térmicos no diagrama PV",
  course: "FG II",
  topic: "Máquinas térmicas",
  priority: "P1",
  summary:
    "Carnot, Otto, Diesel, Stirling e Brayton com gás ideal: acompanhe o pistão, o calor trocado com os reservatórios e o trabalho como área no diagrama PV.",
  derivation,
  equations: [
    String.raw`PV = nRT \qquad \Delta U = Q - W \qquad \Delta U = n C_V \Delta T`,
    String.raw`W = \int P\,dV \qquad \eta = \frac{W_{\text{líq}}}{Q_{\text{in}}}`,
    String.raw`\text{adiabático: } PV^{\gamma} = \text{const} \qquad \text{isotérmico: } W = nRT\ln\frac{V_f}{V_i}`,
  ],
  liveEquations(s, p) {
    const c = cycleOf(p);
    const g = gasOf(p);
    const tot = cycleTotals(g, c);
    return [
      c.theory.tex + String.raw` = ${texNum(c.theory.value * 100)}\%`,
      String.raw`\eta_{\text{medida}} = \frac{${texNum(tot.W)}\ \text{J}}{${texNum(tot.Qin)}\ \text{J}} = ${texNum((tot.W / tot.Qin) * 100)}\%`,
    ];
  },

  params: [
    { key: "ciclo", label: "Ciclo", unit: "", min: 0, max: 4, step: 1, default: 0, options: NAMES.map((n, i) => ({ value: i, label: n })) },
    {
      key: "gamma",
      label: "Gás",
      unit: "",
      min: 1.3,
      max: 1.7,
      step: 0.01,
      default: 1.4,
      options: [
        { value: 5 / 3, label: "Monoatômico (γ = 5/3)" },
        { value: 1.4, label: "Diatômico (γ = 7/5)" },
      ],
    },
    { key: "n", label: "Quantidade de gás", unit: "mol", min: 0.1, max: 5, step: 0.1, default: 1 },
    { key: "TH", label: "Temperatura quente T_H", unit: "K", min: 350, max: 2000, step: 10, default: 800 },
    { key: "TC", label: "Temperatura fria T_C", unit: "K", min: 200, max: 600, step: 5, default: 300 },
    { key: "Vmax", label: "Volume máximo", unit: "L", min: 1, max: 50, step: 0.5, default: 24 },
    { key: "r", label: "Razão de compressão r", unit: "", min: 1.5, max: 25, step: 0.1, default: 8 },
    { key: "rc", label: "Razão de corte r_c (Diesel)", unit: "", min: 1.1, max: 4, step: 0.05, default: 2 },
    { key: "rp", label: "Razão de pressões r_p (Brayton)", unit: "", min: 1.5, max: 30, step: 0.5, default: 8 },
    { key: "vel", label: "Duração de cada etapa", unit: "s", min: 0.5, max: 5, step: 0.5, default: 1.5 },
  ],

  observables: [
    { key: "P", label: "Pressão", unit: "kPa", value: (s, p) => progressTotals(gasOf(p), cycleOf(p), s[0] ?? 0).X.P / 1000 },
    { key: "V", label: "Volume", unit: "L", value: (s, p) => progressTotals(gasOf(p), cycleOf(p), s[0] ?? 0).X.V * 1000 },
    { key: "T", label: "Temperatura", unit: "K", value: (s, p) => progressTotals(gasOf(p), cycleOf(p), s[0] ?? 0).X.T },
    { key: "W", label: "Trabalho do gás (acumulado)", unit: "J", value: (s, p) => progressTotals(gasOf(p), cycleOf(p), s[0] ?? 0).W },
    { key: "Qin", label: "Calor recebido", unit: "J", value: (s, p) => progressTotals(gasOf(p), cycleOf(p), s[0] ?? 0).Qin },
    { key: "Qout", label: "Calor cedido", unit: "J", value: (s, p) => progressTotals(gasOf(p), cycleOf(p), s[0] ?? 0).Qout },
    {
      key: "eta",
      label: "Eficiência medida (ciclo completo)",
      unit: "%",
      // Só faz sentido com o ciclo fechado: no meio dele o trabalho acumulado não é o líquido.
      value: (s, p) => {
        if ((s[0] ?? 0) < 4 - 1e-9) return 0;
        const t = progressTotals(gasOf(p), cycleOf(p), 4);
        return t.Qin > 0 ? (100 * t.W) / t.Qin : 0;
      },
    },
    { key: "etaT", label: "Eficiência teórica", unit: "%", value: (_s, p) => 100 * cycleOf(p).theory.value },
  ],
  chart: { x: "V", y: "P" },

  scenarios: [
    {
      id: "carnot",
      label: "Carnot entre 800 K e 300 K",
      params: { ciclo: 0, TH: 800, TC: 300, r: 3 },
      guide: `### O limite de Carnot
1. Rode um ciclo completo e compare a **eficiência medida** com $1 - T_C/T_H$.
2. Mude o gás para monoatômico. A eficiência muda? Por quê?
3. Aumente $T_H$ e veja a área do ciclo crescer.`,
      predict: [
        {
          question: "Trocar o gás diatômico por um monoatômico, mantendo $T_H$ e $T_C$, muda a eficiência de Carnot?",
          options: ["Aumenta", "Diminui", "Não muda"],
          answer: 2,
          explanation: "A eficiência de Carnot depende só das temperaturas dos reservatórios: $\\eta = 1 - T_C/T_H$.",
        },
      ],
    },
    {
      id: "otto",
      label: "Otto (gasolina, r = 8)",
      params: { ciclo: 1, r: 8, TH: 1800, TC: 300, Vmax: 0.5 },
      guide: `### Motor a gasolina
1. Compare a eficiência com $1 - r^{1-\\gamma}$.
2. Aumente a razão de compressão de 8 para 12 (motores modernos) e veja o ganho.
3. Por que não usar $r = 25$ na gasolina? (Pense em pré-ignição.)`,
    },
    {
      id: "diesel",
      label: "Diesel (r = 18)",
      params: { ciclo: 2, r: 18, rc: 2, TC: 300, Vmax: 0.5 },
      guide: `### Diesel
O combustível queima à pressão constante. Compare com um Otto de mesma razão de compressão: qual é mais eficiente?`,
    },
    {
      id: "stirling",
      label: "Stirling",
      params: { ciclo: 3, TH: 700, TC: 300, r: 2 },
      guide: `### Stirling sem regenerador
Sem regenerador, o calor das etapas isocóricas é perdido e a eficiência fica abaixo de Carnot. Um regenerador ideal guarda esse calor e leva o ciclo ao limite de Carnot.`,
    },
    {
      id: "brayton",
      label: "Brayton (turbina)",
      params: { ciclo: 4, rp: 10, TH: 1400, TC: 300 },
      guide: `### Turbina a gás
A eficiência ideal só depende da razão de pressões. Varie $r_p$ e compare com $1 - r_p^{(1-\\gamma)/\\gamma}$.`,
    },
  ],

  exercises: [
    {
      id: "carnot",
      prompt: "Uma máquina de Carnot opera entre {TH} K e {TC} K. Qual é a eficiência máxima, em %?",
      vary: { TH: [400, 1500, 0], TC: [250, 380, 0] },
      answer: { label: "η", unit: "%", compute: (p) => 100 * (1 - (p.TC ?? 1) / (p.TH ?? 1)) },
      tolerance: 0.01,
    },
    {
      id: "otto",
      prompt: "Um ciclo Otto ideal com ar (γ = 1,4) tem razão de compressão {r}. Qual é a eficiência, em %?",
      vary: { r: [6, 14, 1] },
      fixed: { gamma: 1.4, ciclo: 1 },
      answer: { label: "η", unit: "%", compute: (p) => 100 * (1 - (p.r ?? 1) ** -0.4) },
      tolerance: 0.01,
    },
    {
      id: "isotermico",
      prompt: "{n} mol de gás ideal expandem isotermicamente a {TH} K, dobrando o volume. Quanto calor o gás recebe?",
      vary: { n: [0.5, 3, 1], TH: [300, 900, 0] },
      answer: { label: "Q", unit: "J", compute: (p) => (p.n ?? 1) * 8.314462618 * (p.TH ?? 0) * Math.log(2) },
      hint: "Na isotérmica ΔU = 0, então Q = W = nRT ln(V_f/V_i).",
    },
  ],

  init: () => [0],
  derivatives: (_s, p) => [1 / (p.vel ?? 1.5)],
  integrator: "euler",
  dt: 0.005,
  sampleEvery: 2,
  stopWhen: (s) => 4 - (s[0] ?? 0),

  viewport: () => ({ xMin: 0, xMax: 16, yMin: 0, yMax: 9 }),

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const { state, params, theme } = frame;
    const g = gasOf(params);
    const c = cycleOf(params);
    const u = Math.min(4, state[0] ?? 0);
    const { X, seg } = progressTotals(g, c, u);
    const segment = c.segments[seg]!;

    // Faixas de volume e pressão do ciclo
    const pts = c.segments.flatMap((s) => Array.from({ length: 41 }, (_, k) => along(g, s, k / 40)));
    const Vmax = Math.max(...pts.map((q) => q.V));
    const Vmin = Math.min(...pts.map((q) => q.V));
    const Pmax = Math.max(...pts.map((q) => q.P));
    const Pmin = Math.min(...pts.map((q) => q.P));
    // Ciclos com grande razão de pressões ficam espremidos na escala linear: usa log-log.
    const logScale = Pmax / Pmin > 15;
    const TH = Math.max(...pts.map((q) => q.T));
    const TC = Math.min(...pts.map((q) => q.T));

    // --- Cilindro e pistão ---
    const cx0 = 0.8, cx1 = 4.2, cy0 = 1.6, cyTop = 7.6;
    const h = (X.V / Vmax) * (cyTop - cy0 - 0.4);
    const pistonY = cy0 + h;
    const heat = (X.T - TC) / Math.max(1, TH - TC);
    const gasColor = `rgba(${Math.round(60 + 190 * heat)}, ${Math.round(110 - 40 * heat)}, ${Math.round(230 - 180 * heat)}, 0.22)`;
    d.rect(cx0, cy0, cx1 - cx0, h, { fill: gasColor });
    d.line(cx0, cy0, cx0, cyTop, { color: theme.text, width: 3 });
    d.line(cx1, cy0, cx1, cyTop, { color: theme.text, width: 3 });
    d.line(cx0, cy0, cx1, cy0, { color: theme.text, width: 3 });
    d.rect(cx0 + 0.05, pistonY, cx1 - cx0 - 0.1, 0.35, { fill: theme.muted });
    d.line((cx0 + cx1) / 2, pistonY + 0.35, (cx0 + cx1) / 2, 8.6, { color: theme.muted, width: 6 });
    const speed = 0.25 + Math.sqrt(X.T / 300) * 0.6;
    const t = frame.t;
    for (const q of PARTICLES) {
      const x = cx0 + 0.12 + tri(q.x * 2 + q.vx * speed * t) * (cx1 - cx0 - 0.24);
      const y = cy0 + 0.1 + tri(q.y * 2 + q.vy * speed * t) * Math.max(0.05, h - 0.2);
      d.dot(x, y, 2.6, heat > 0.5 ? theme.positive : theme.negative, 0.85);
    }

    // Reservatórios e fluxo de calor do segmento atual
    const qSeg = energy(g, segment, segment.to).Q;
    const qSign = Math.abs(qSeg) < 1e-9 ? 0 : Math.sign(qSeg);
    d.rect(cx0 - 0.2, 0.25, cx1 - cx0 + 0.4, 0.75, { fill: qSign > 0 ? "rgba(217,69,59,0.8)" : qSign < 0 ? "rgba(47,111,217,0.8)" : "rgba(120,130,145,0.8)" });
    d.text(
      qSign > 0 ? `Reservatório quente (Q entra)` : qSign < 0 ? `Reservatório frio (Q sai)` : "Isolado: Q = 0",
      (cx0 + cx1) / 2,
      0.62,
      { color: "#ffffff", size: 11, weight: "600" },
    );
    if (qSign !== 0) {
      for (const dx of [-0.9, 0, 0.9]) d.arrowPx((cx0 + cx1) / 2 + dx, qSign > 0 ? 1.05 : 1.55, 0, qSign, 18, { color: qSign > 0 ? theme.positive : theme.negative });
    }
    d.text(`${seg + 1}→${seg === 3 ? 1 : seg + 2}: ${KIND_LABEL[segment.kind]}`, (cx0 + cx1) / 2, 8.75, { size: 13, weight: "600" });

    // --- Diagrama PV ---
    const px0 = 6.3, px1 = 15.6, py0 = 1.0, py1 = 8.4;
    const lv0 = Math.log10(Vmin / 1.25), lv1 = Math.log10(Vmax * 1.15);
    const lp0 = Math.log10(Pmin / 1.25), lp1 = Math.log10(Pmax * 1.2);
    const PX = (V: number) => px0 + (logScale ? (Math.log10(V) - lv0) / (lv1 - lv0) : V / (Vmax * 1.08)) * (px1 - px0);
    const PY = (P: number) => py0 + (logScale ? (Math.log10(P) - lp0) / (lp1 - lp0) : P / (Pmax * 1.1)) * (py1 - py0);
    d.line(px0, py0, px1, py0, { color: theme.muted });
    d.line(px0, py0, px0, py1, { color: theme.muted });
    d.text(logScale ? "V (L), escala log" : "V (L)", px1, py0 - 0.35, { color: theme.muted, align: "right", size: 11 });
    d.text(logScale ? "P (kPa), escala log" : "P (kPa)", px0, py1 + 0.3, { color: theme.muted, align: "left", size: 11 });
    const fmt = (v: number) => String(+v.toPrecision(2)).replace(".", ",");
    const vTicks = logScale ? [Vmin, Math.sqrt(Vmin * Vmax), Vmax] : [0.25, 0.5, 0.75, 1].map((f) => Vmax * f);
    const pTicks = logScale ? [Pmin, Math.sqrt(Pmin * Pmax), Pmax] : [0.25, 0.5, 0.75, 1].map((f) => Pmax * f);
    for (const v of vTicks) d.text(fmt(v * 1000), PX(v), py0 - 0.3, { color: theme.muted, size: 10 });
    for (const P of pTicks) d.text(fmt(P / 1000), px0 - 0.1, PY(P), { color: theme.muted, size: 10, align: "right" });
    d.polyline(
      pts.map((q): [number, number] => [PX(q.V), PY(q.P)]),
      { color: "none", fill: theme.dark ? "rgba(91,156,240,0.15)" : "rgba(47,125,225,0.12)", close: true },
    );
    c.segments.forEach((s, k) => {
      const line = Array.from({ length: 41 }, (_, j) => along(g, s, j / 40)).map((q): [number, number] => [PX(q.V), PY(q.P)]);
      d.polyline(line, { color: k <= seg ? theme.accent : theme.muted, width: k === seg ? 3 : 2, dash: k > seg ? [5, 4] : undefined });
      d.dot(PX(s.from.V), PY(s.from.P), 3.5, theme.text);
      d.text(String(k + 1), PX(s.from.V), PY(s.from.P), { dx: -10, dy: -10, size: 12, weight: "700" });
    });
    d.dot(PX(X.V), PY(X.P), 6, theme.series[1]!);
    d.text(`Ciclo ${c.name}`, (px0 + px1) / 2, 8.75, { size: 13, weight: "600" });
  },
});

export default ciclosTermicos;
