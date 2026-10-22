import { defineSim, draw, formatBR, num, texNum, type Draw, type Params } from "@fisilab/core";
import { FLUIDS, SEG_NAMES, T0, along, buildCycle, hf, hg, props, sf, sg, Psat, Tsat, type Cycle } from "./refrig.ts";

export * from "./refrig.ts";

const fmt = (v: number, d = 3) => formatBR(v, d);
const kJ = (v: number) => v / 1000;
const C = (T: number) => T - T0;

const cycleOf = (p: Params) => buildCycle(p);
const uOf = (s: number[]) => s[0] ?? 0;
const isHP = (p: Params) => Math.round(num(p, "modo")) === 1;

export function current(s: number[], p: Params) {
  const c = cycleOf(p);
  const a = along(c, uOf(s));
  return { c, ...a, ...props(c.f, a.h, a.P) };
}

// Geometria do esquema (coordenadas do mundo).
const LX0 = 1.0, LX1 = 6.8, LY0 = 2.0, LY1 = 7.0;
const D = { x0: 8.9, x1: 15.6, y0: 1.1, y1: 8.2 };

/** Posição de uma parcela de refrigerante no circuito para a fase u do ciclo. */
function loopPos(u: number): [number, number] {
  const w = ((u % 4) + 4) % 4;
  const seg = Math.min(3, Math.floor(w));
  const l = w - seg;
  if (seg === 0) return [LX1, LY0 + (LY1 - LY0) * l]; // compressor: sobe pela direita
  if (seg === 1) return [LX1 - (LX1 - LX0) * l, LY1]; // condensador: da direita para a esquerda
  if (seg === 2) return [LX0, LY1 - (LY1 - LY0) * l]; // válvula: desce pela esquerda
  return [LX0 + (LX1 - LX0) * l, LY0]; // evaporador
}

export const refrigerador = defineSim({
  id: "refrigerador",
  title: "Refrigerador e bomba de calor",
  course: "FG II",
  topic: "Máquinas térmicas",
  priority: "P2",
  summary:
    "Ciclo de compressão de vapor com um refrigerante real simplificado (R-134a, isobutano ou amônia): diagramas P–h e T–s com a cúpula de saturação, COP de refrigerador e de bomba de calor comparados com Carnot, e os fluxos de calor e trabalho animados no circuito.",
  equations: [
    String.raw`q_L = h_1 - h_4 \qquad w = h_2 - h_1 \qquad q_H = h_2 - h_3 = q_L + w`,
    String.raw`\text{COP}_R = \frac{q_L}{w} \qquad \text{COP}_{BC} = \frac{q_H}{w} = \text{COP}_R + 1`,
    String.raw`\text{Carnot: } \text{COP}_R = \frac{T_L}{T_H - T_L} \qquad \text{COP}_{BC} = \frac{T_H}{T_H - T_L}`,
    String.raw`h_4 = h_3 \ \text{(válvula)} \qquad h_2 = h_1 + \frac{h_{2s} - h_1}{\eta_c} \qquad x_4 = \frac{h_4 - h_f}{h_{fg}}`,
  ],
  liveEquations(s, p) {
    const q = current(s, p);
    const c = q.c;
    return [
      String.raw`T_e = ${texNum(C(c.Te))}\ ^\circ\text{C},\ P_e = ${texNum(c.Pe / 1000)}\ \text{kPa} \qquad T_k = ${texNum(C(c.Tk))}\ ^\circ\text{C},\ P_k = ${texNum(c.Pk / 1000)}\ \text{kPa}`,
      String.raw`q_L = ${texNum(kJ(c.h1))} - ${texNum(kJ(c.h4))} = ${texNum(kJ(c.qL))}\ \text{kJ/kg} \qquad w = ${texNum(kJ(c.w))}\ \text{kJ/kg} \qquad q_H = ${texNum(kJ(c.qH))}\ \text{kJ/kg}`,
      String.raw`\text{COP}_R = ${texNum(c.copR)}\ \ (\text{Carnot } ${texNum(c.carnotR)}) \qquad \text{COP}_{BC} = ${texNum(c.copHP)}\ \ (\text{Carnot } ${texNum(c.carnotHP)})`,
      String.raw`\dot Q_L = \dot m\, q_L = ${texNum(c.mdot * c.qL)}\ \text{W} \qquad \dot W = ${texNum(c.mdot * c.w)}\ \text{W} \qquad \dot Q_H = ${texNum(c.mdot * c.qH)}\ \text{W}`,
    ];
  },

  params: [
    {
      key: "modo",
      label: "Uso",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 0,
      live: true,
      options: [
        { value: 0, label: "Refrigerador (efeito útil: Q_L)" },
        { value: 1, label: "Bomba de calor (efeito útil: Q_H)" },
      ],
    },
    { key: "fluido", label: "Refrigerante", unit: "", min: 0, max: 2, step: 1, default: 0, live: true, options: FLUIDS.map((f) => ({ value: f.value, label: f.name })) },
    { key: "TL", label: "Temperatura do ambiente frio T_L", unit: "°C", min: -30, max: 15, step: 1, default: 4, live: true },
    { key: "TH", label: "Temperatura do ambiente quente T_H", unit: "°C", min: 15, max: 50, step: 1, default: 25, live: true },
    { key: "dT", label: "Diferença nos trocadores de calor", unit: "K", min: 0, max: 15, step: 1, default: 10, live: true },
    { key: "eta", label: "Eficiência isentrópica do compressor", unit: "", min: 0.5, max: 1, step: 0.01, default: 0.8, live: true },
    { key: "sh", label: "Superaquecimento na saída do evaporador", unit: "K", min: 0, max: 15, step: 1, default: 5, live: true },
    { key: "sc", label: "Sub-resfriamento na saída do condensador", unit: "K", min: 0, max: 10, step: 1, default: 3, live: true },
    { key: "mdot", label: "Vazão de refrigerante", unit: "g/s", min: 0.5, max: 50, step: 0.5, default: 1.5, live: true },
    {
      key: "diagrama",
      label: "Diagrama",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 0,
      live: true,
      options: [
        { value: 0, label: "Pressão × entalpia (P–h)" },
        { value: 1, label: "Temperatura × entropia (T–s)" },
      ],
    },
    { key: "periodo", label: "Duração de uma volta do refrigerante", unit: "s", min: 2, max: 20, step: 1, default: 8, live: true },
  ],

  observables: [
    { key: "h", label: "Entalpia específica", unit: "kJ/kg", value: (s, p) => kJ(current(s, p).h) },
    { key: "P", label: "Pressão", unit: "kPa", value: (s, p) => current(s, p).P / 1000 },
    { key: "T", label: "Temperatura do refrigerante", unit: "°C", value: (s, p) => C(current(s, p).T) },
    { key: "s", label: "Entropia específica", unit: "kJ/(kg·K)", value: (s, p) => kJ(current(s, p).s) },
    { key: "x", label: "Título (fração de vapor)", unit: "", value: (s, p) => current(s, p).x },
    { key: "copR", label: "COP do refrigerador", unit: "", value: (_s, p) => cycleOf(p).copR },
    { key: "copHP", label: "COP da bomba de calor", unit: "", value: (_s, p) => cycleOf(p).copHP },
    { key: "carnotR", label: "COP de Carnot (refrigerador)", unit: "", value: (_s, p) => cycleOf(p).carnotR },
    { key: "carnotHP", label: "COP de Carnot (bomba de calor)", unit: "", value: (_s, p) => cycleOf(p).carnotHP },
    { key: "QL", label: "Calor retirado do ambiente frio", unit: "W", value: (_s, p) => cycleOf(p).mdot * cycleOf(p).qL },
    { key: "W", label: "Potência do compressor", unit: "W", value: (_s, p) => cycleOf(p).mdot * cycleOf(p).w },
    { key: "QH", label: "Calor entregue ao ambiente quente", unit: "W", value: (_s, p) => cycleOf(p).mdot * cycleOf(p).qH },
    { key: "T2", label: "Temperatura na descarga do compressor", unit: "°C", value: (_s, p) => C(dischargeT(cycleOf(p))) },
  ],
  chart: { x: "h", y: "P" },

  scenarios: [
    {
      id: "geladeira",
      label: "Geladeira doméstica",
      params: { modo: 0, fluido: 0, TL: 4, TH: 25, dT: 10 },
      guide: `### Como a geladeira tira calor de dentro
1. Acompanhe uma parcela de refrigerante: no **evaporador** (dentro da geladeira) ela ferve a baixa pressão e baixa temperatura, absorvendo $q_L$.
2. O **compressor** eleva a pressão e a temperatura do vapor (trabalho $w$).
3. No **condensador** (a grade atrás da geladeira) o vapor quente cede $q_H = q_L + w$ à cozinha e condensa.
4. Na **válvula de expansão** a pressão cai sem troca de calor ($h_4 = h_3$): parte do líquido vaporiza e o refrigerante esfria.
5. No diagrama P–h, $q_L$, $w$ e $q_H$ são distâncias horizontais. Confira $\\text{COP}_R = q_L/w$ nas equações.`,
      predict: [
        {
          question: "O COP de uma geladeira (calor retirado / energia elétrica consumida) pode ser maior que 1?",
          options: ["Não, isso violaria a conservação da energia", "Sim, o compressor só transporta o calor, não o produz", "Só se o refrigerante for amônia"],
          answer: 1,
          explanation: "O trabalho não é convertido em frio: ele bombeia calor do ambiente frio para o quente. Por isso $q_L$ pode ser várias vezes maior que $w$; a 1ª lei exige apenas $q_H = q_L + w$.",
        },
      ],
    },
    {
      id: "bomba",
      label: "Bomba de calor no inverno",
      params: { modo: 1, fluido: 0, TL: 5, TH: 22, dT: 8 },
      guide: `### Aquecer bombeando calor
1. Agora o ambiente frio é o ar externo e o quente é o interior da casa. O efeito útil é $q_H$.
2. Compare $\\text{COP}_{BC}$ com 1, que é o "COP" de um aquecedor de resistência elétrica.
3. Confira que $\\text{COP}_{BC} = \\text{COP}_R + 1$ para o mesmo ciclo.
4. Baixe a temperatura externa para $-15$ °C: o COP cai, porque o compressor precisa vencer uma diferença de pressão maior.`,
      predict: [
        {
          question: "Para aquecer uma casa, gastando a mesma energia elétrica, a bomba de calor entrega, comparada a uma resistência elétrica:",
          options: ["menos calor", "o mesmo calor", "mais calor"],
          answer: 2,
          explanation: "A resistência entrega exatamente a energia elétrica consumida (COP = 1). A bomba de calor entrega $q_H = q_L + w > w$, porque também traz calor de fora.",
        },
      ],
    },
    {
      id: "carnot",
      label: "Comparação com Carnot",
      params: { modo: 0, TL: 4, TH: 25, dT: 0, eta: 1, sh: 0, sc: 0, diagrama: 1 },
      guide: `### Onde se perde COP
1. Trocadores perfeitos ($\\Delta T = 0$) e compressor ideal ($\\eta_c = 1$): mesmo assim o COP fica abaixo do de Carnot. No T–s, compare o ciclo com o retângulo de Carnot entre $T_L$ e $T_H$.
2. As diferenças vêm da **válvula** (expansão irreversível, linha tracejada) e do vapor **superaquecido** na descarga (o "chifre" acima de $T_H$).
3. Aumente $\\Delta T$ para 10 K: para trocar calor numa área finita, o evaporador precisa estar mais frio que $T_L$ e o condensador mais quente que $T_H$. O COP cai bastante.
4. Baixe $\\eta_c$ para 0,7 e veja $w$ crescer.`,
      predict: [
        {
          question: "Com trocadores e compressor ideais, o ciclo de compressão de vapor atinge o COP de Carnot?",
          options: ["Sim, exatamente", "Não, fica um pouco abaixo", "Não, fica acima"],
          answer: 1,
          explanation: "A expansão na válvula é irreversível (gera entropia) e a compressão termina no vapor superaquecido, acima de $T_H$. Esses dois desvios do ciclo de Carnot reduzem o COP.",
        },
      ],
    },
    {
      id: "freezer",
      label: "Freezer e amônia",
      params: { modo: 0, fluido: 2, TL: -20, TH: 30, dT: 8, diagrama: 0 },
      guide: `### Temperaturas extremas
1. Um freezer a $-20$ °C numa cozinha a 30 °C tem COP bem menor que a geladeira: a diferença de temperatura é maior.
2. Com amônia (R-717), o calor latente é enorme (≈ 1300 kJ/kg): a vazão necessária é pequena, mas a temperatura de descarga do compressor passa de 100 °C.
3. Troque para R-134a e para isobutano (R-600a, usado nas geladeiras atuais) e compare COP, pressões e temperatura de descarga.`,
    },
  ],

  exercises: [
    {
      id: "cop",
      prompt:
        "Num refrigerador por compressão de vapor, o refrigerante sai do evaporador com h₁ = {h1} kJ/kg, sai do compressor com h₂ = {h2} kJ/kg e sai do condensador com h₃ = {h3} kJ/kg. Qual é o COP do refrigerador?",
      vary: { h1: [385, 402, 1], h2: [418, 445, 1], h3: [215, 260, 1] },
      answer: { label: "COP_R", unit: "", compute: (p) => (num(p, "h1") - num(p, "h3")) / (num(p, "h2") - num(p, "h1")) },
      hint: "Na válvula h₄ = h₃; COP_R = (h₁ − h₄)/(h₂ − h₁).",
    },
    {
      id: "carnot-bc",
      prompt: "Uma bomba de calor reversível aquece uma casa a {THx} °C retirando calor do ar externo a {TLx} °C. Qual é o COP máximo possível?",
      vary: { THx: [18, 25, 0], TLx: [-15, 10, 0] },
      answer: { label: "COP_BC", unit: "", compute: (p) => (num(p, "THx") + T0) / (num(p, "THx") - num(p, "TLx")) },
      hint: "COP de Carnot da bomba de calor: T_H/(T_H − T_L), com as temperaturas em kelvin.",
    },
  ],

  init: () => [0],
  derivatives: (_s, p) => [4 / num(p, "periodo", 8)],
  integrator: "euler",
  dt: 0.01,
  sampleEvery: 2,
  maxSamples: 6000,

  viewport: () => ({ xMin: 0, xMax: 16, yMin: 0, yMax: 9 }),

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const q = current(frame.state, frame.params);
    drawCircuit(d, q, frame.params, frame.t, uOf(frame.state));
    if (Math.round(num(frame.params, "diagrama")) === 1) drawTS(d, q);
    else drawPH(d, q);
  },
});

function dischargeT(c: Cycle): number {
  return props(c.f, c.h2, c.Pk).T;
}

type Q = ReturnType<typeof current>;

function phaseColor(d: Draw, x: number, phase: string): string {
  if (phase === "líquido") return d.theme.series[0]!;
  if (phase === "vapor") return d.theme.series[1]!;
  return x < 0.5 ? d.theme.series[4]! : d.theme.series[3]!;
}

function drawCircuit(d: Draw, q: Q, p: Params, t: number, u: number) {
  const { theme } = d;
  const c = q.c;
  const hp = isHP(p);
  const coldFill = theme.dark ? "rgba(91,147,240,0.16)" : "rgba(47,111,217,0.10)";
  const hotFill = theme.dark ? "rgba(240,100,90,0.16)" : "rgba(217,69,59,0.09)";
  // Ambientes
  d.rect(0.2, 6.15, 7.4, 2.65, { fill: hotFill, stroke: theme.positive, width: 1 });
  d.rect(0.2, 0.25, 7.4, 2.6, { fill: coldFill, stroke: theme.negative, width: 1 });
  d.text(`${hp ? "Interior da casa" : "Cozinha"}: T_H = ${fmt(C(c.TH))} °C`, 0.4, 8.5, { size: 11, weight: "600", align: "left", color: theme.positive });
  d.text(`${hp ? "Ar externo" : "Interior da geladeira"}: T_L = ${fmt(C(c.TL))} °C`, 0.4, 0.5, { size: 11, weight: "600", align: "left", color: theme.negative });

  // Tubulação e componentes
  d.polyline([[LX1, LY0], [LX1, LY1], [LX0, LY1], [LX0, LY0], [LX1, LY0]], { color: theme.muted, width: 4, alpha: 0.6 });
  d.spring(LX1 - 0.5, LY1, LX0 + 0.5, LY1, { color: theme.positive, width: 2.5, coils: 9, amplitudePx: 9 });
  d.spring(LX0 + 0.5, LY0, LX1 - 0.5, LY0, { color: theme.negative, width: 2.5, coils: 9, amplitudePx: 9 });
  d.text("condensador", (LX0 + LX1) / 2, LY1 + 0.5, { size: 10, color: theme.muted });
  d.text("evaporador", (LX0 + LX1) / 2, LY0 - 0.5, { size: 10, color: theme.muted });
  // Compressor
  const cy = (LY0 + LY1) / 2;
  d.circle(LX1, cy, 0.55, { fill: theme.dark ? "#2a3340" : "#e9edf3", stroke: theme.text, width: 2 });
  d.polyline([[LX1 - 0.35, cy - 0.35], [LX1 + 0.35, cy - 0.15], [LX1 + 0.35, cy + 0.15], [LX1 - 0.35, cy + 0.35]], { color: theme.text, width: 1.5, close: true });
  d.text("compressor", LX1, cy - 0.85, { size: 10, color: theme.muted });
  // Válvula de expansão (gravata)
  d.polyline([[LX0 - 0.3, cy + 0.35], [LX0 + 0.3, cy - 0.35], [LX0 + 0.3, cy + 0.35], [LX0 - 0.3, cy - 0.35]], { color: theme.text, width: 1.5, close: true, fill: theme.dark ? "#2a3340" : "#e9edf3" });
  d.text("válvula", LX0 + 0.45, cy - 0.65, { size: 10, color: theme.muted, align: "left" });
  // Números dos estados
  const lab: [string, number, number][] = [["1", LX1 + 0.25, LY0 - 0.25], ["2", LX1 + 0.25, LY1 + 0.25], ["3", LX0 - 0.25, LY1 + 0.25], ["4", LX0 - 0.25, LY0 - 0.25]];
  lab.forEach(([s, x, y]) => d.text(s, x, y, { size: 12, weight: "700" }));

  // Parcelas de refrigerante
  const K = 22;
  for (let k = 0; k < K; k++) {
    // Parcelas igualmente espaçadas que circulam com o mesmo período do ciclo.
    const uu = (4 * k) / K + u;
    const a = along(c, uu);
    const pr = props(c.f, a.h, a.P);
    const [x, y] = loopPos(uu);
    d.dot(x, y, 4, phaseColor(d, pr.x, pr.phase));
  }
  // Parcela acompanhada no diagrama (a mesma do ponto destacado)
  const [mx, my] = loopPos(u);
  d.dot(mx, my, 6.5, phaseColor(d, q.x, q.phase));
  d.circle(mx, my, 0, { stroke: theme.text, minPx: 6.5, width: 1.5 });

  // Fluxos de energia animados (comprimento ∝ energia por kg)
  const L = (e: number) => 14 + 34 * (e / c.qH);
  const ph = (t * 0.9) % 1;
  for (const x of [3.6, 4.9, 6.2]) {
    d.arrowPx(x - 0.2, LY1 + 0.75 + 0.35 * ph, 0, 1, L(c.qH), { color: theme.positive, alpha: 0.35 + 0.65 * (1 - ph) });
    d.arrowPx(x - 0.2, 0.85 + 0.35 * ph, 0, 1, L(c.qL), { color: theme.negative, alpha: 0.35 + 0.65 * (1 - ph) });
  }
  d.arrowPx(LX1 + 1.15 + 0.2 * (1 - ph), cy, -1, 0, L(c.w) * 0.8, { color: theme.series[5]!, width: 3 });
  d.text("W", LX1 + 1.0, cy + 0.4, { size: 12, weight: "700", color: theme.series[5]! });
  d.text("Q_H", 7.05, 7.6, { size: 12, weight: "700", color: theme.positive });
  d.text("Q_L", 7.05, 1.3, { size: 12, weight: "700", color: theme.negative });

  // Painel central: energia por kg e COP comparados
  const ux = 2.05;
  d.text(`por kg: q_L = ${fmt(kJ(c.qL))}   w = ${fmt(kJ(c.w))}   q_H = ${fmt(kJ(c.qH))} kJ`, ux, 6.2 - 0.05 - 0.55, { size: 10, align: "left" });
  const realCop = hp ? c.copHP : c.copR;
  const intCop = hp ? c.carnotInt + 1 : c.carnotInt;
  const resCop = hp ? c.carnotHP : c.carnotR;
  d.text(hp ? "COP da bomba de calor" : "COP do refrigerador", ux, 5.1, { size: 11, weight: "600", align: "left" });
  const bars: [string, number, string][] = [
    ["este ciclo", realCop, theme.accent],
    ["Carnot entre T_e e T_k", intCop, theme.muted],
    ["Carnot entre T_L e T_H", resCop, theme.text],
  ];
  const maxCop = Math.max(...bars.map((b) => b[1]));
  bars.forEach(([name, v, col], i) => {
    const y = 4.55 - i * 0.62;
    const w = (v / maxCop) * 3.0;
    d.rect(ux, y - 0.17, w, 0.34, { fill: col, alpha: i === 0 ? 0.85 : 0.35 });
    d.text(`${fmt(v)}  ${name}`, ux + 0.08, y, { size: 10, align: "left", weight: i === 0 ? "700" : "400" });
  });
  // Legenda de fases
  const leg: [string, string][] = [["líquido", theme.series[0]!], ["mistura", theme.series[4]!], ["vapor", theme.series[1]!]];
  leg.forEach(([s, col], i) => {
    d.dot(ux + 0.1 + i * 1.45, 2.65, 4, col);
    d.text(s, ux + 0.28 + i * 1.45, 2.65, { size: 10, align: "left" });
  });
}

function drawPH(d: Draw, q: Q) {
  const { theme } = d;
  const c = q.c;
  const f = c.f;
  const Tlo = 233.15;
  const domeT = Array.from({ length: 80 }, (_, i) => Tlo + (f.Tc - 0.01 - Tlo) * (1 - (1 - i / 79) ** 2));
  const hLo = Math.min(hf(f, Tlo), c.h3);
  const hHi = Math.max(c.h2, ...domeT.map((T) => hg(f, T)));
  const span = hHi - hLo;
  const h0 = hLo - 0.05 * span, h1 = hHi + 0.08 * span;
  const lp0 = Math.log10(Math.min(Psat(f, Tlo), c.Pe / 1.5)), lp1 = Math.log10(Math.max(Psat(f, f.Tc - 0.01), c.Pk * 1.5));
  const X = (h: number) => D.x0 + ((h - h0) / (h1 - h0)) * (D.x1 - D.x0);
  const Y = (P: number) => D.y0 + ((Math.log10(P) - lp0) / (lp1 - lp0)) * (D.y1 - D.y0);
  axes(d, "h (kJ/kg)", "P (kPa), escala log");
  for (const h of niceTicks(kJ(h0), kJ(h1))) d.text(fmt(h), X(h * 1000), D.y0 - 0.3, { size: 9, color: theme.muted });
  for (const P of [50, 100, 200, 500, 1000, 2000, 5000]) {
    if (Math.log10(P * 1000) < lp0 || Math.log10(P * 1000) > lp1) continue;
    d.text(fmt(P), D.x0 - 0.1, Y(P * 1000), { size: 9, color: theme.muted, align: "right" });
    d.line(D.x0, Y(P * 1000), D.x1, Y(P * 1000), { color: theme.grid, width: 1 });
  }
  clip(d);
  // Cúpula
  const dome: [number, number][] = [...domeT.map((T): [number, number] => [X(hf(f, T)), Y(Psat(f, T))]), ...domeT.slice().reverse().map((T): [number, number] => [X(hg(f, T)), Y(Psat(f, T))])];
  d.polyline(dome, { color: theme.text, width: 1.5, fill: theme.dark ? "rgba(165,133,230,0.10)" : "rgba(138,99,210,0.07)" });
  d.dot(X(hf(f, f.Tc - 0.01)), Y(Psat(f, f.Tc - 0.01)), 3.5, theme.text);
  // Isotermas
  const Pmin = 10 ** lp0, Pmax = 10 ** lp1;
  let lastLabel = -Infinity;
  for (const Tc of [-20, 0, 20, 40, 60, 80, 100, 120]) {
    const T = Tc + T0;
    if (T >= f.Tc - 1) continue;
    const Ps = Psat(f, T);
    const pts: [number, number][] = [[X(hf(f, T)), Y(Pmax)], [X(hf(f, T)), Y(Ps)], [X(hg(f, T)), Y(Ps)]];
    for (let i = 1; i <= 30; i++) {
      const P = Ps * (Pmin / Ps) ** (i / 30);
      pts.push([X(hg(f, Tsat(f, P)) + f.cpv * (T - Tsat(f, P))), Y(P)]);
    }
    d.polyline(pts, { color: theme.muted, width: 1, alpha: 0.45 });
    if (X(hf(f, T)) - lastLabel > 0.75) {
      d.text(`${Tc} °C`, X(hf(f, T)), Y(Pmax) - 0.2, { size: 9, color: theme.muted, align: "left", dx: 3 });
      lastLabel = X(hf(f, T));
    }
  }
  // Ciclo
  drawCyclePath(d, q, (a) => [X(a.h), Y(a.P)]);
  d.ctx.restore();
  // Distâncias horizontais = energias por kg
  const yE = Y(c.Pe) - 0.42;
  bracket(d, X(c.h4), X(c.h1), yE, "q_L", theme.negative);
  bracket(d, X(c.h1), X(c.h2), yE, "w", theme.series[5]!);
  bracket(d, X(c.h3), X(c.h2), Y(c.Pk) + 0.42, "q_H", theme.positive);
  d.text(`${f.name}   ·   ${SEG_NAMES[q.seg]}`, D.x0, D.y1 + 0.6, { size: 11, weight: "600", align: "left" });
}

function drawTS(d: Draw, q: Q) {
  const { theme } = d;
  const c = q.c;
  const f = c.f;
  const Tlo = 233.15;
  const domeT = Array.from({ length: 80 }, (_, i) => Tlo + (f.Tc - 0.01 - Tlo) * (1 - (1 - i / 79) ** 2));
  const T2 = props(f, c.h2, c.Pk).T;
  const s2 = props(f, c.h2, c.Pk).s;
  const sLo = sf(f, Tlo), sHi = Math.max(s2, sg(f, Tlo));
  const span = sHi - sLo;
  const s0 = sLo - 0.05 * span, s1 = sHi + 0.1 * span;
  const T0lo = Math.min(Tlo, c.Te - 5) - 5, Thi = Math.max(f.Tc, T2) + 10;
  const X = (s: number) => D.x0 + ((s - s0) / (s1 - s0)) * (D.x1 - D.x0);
  const Y = (T: number) => D.y0 + ((T - T0lo) / (Thi - T0lo)) * (D.y1 - D.y0);
  axes(d, "s (kJ/(kg·K))", "T (°C)");
  for (const s of niceTicks(kJ(s0), kJ(s1))) d.text(fmt(s), X(s * 1000), D.y0 - 0.3, { size: 9, color: theme.muted });
  for (const Tc of niceTicks(C(T0lo), C(Thi))) d.text(fmt(Tc), D.x0 - 0.1, Y(Tc + T0), { size: 9, color: theme.muted, align: "right" });
  clip(d);
  const dome: [number, number][] = [...domeT.map((T): [number, number] => [X(sf(f, T)), Y(T)]), ...domeT.slice().reverse().map((T): [number, number] => [X(sg(f, T)), Y(T)])];
  d.polyline(dome, { color: theme.text, width: 1.5, fill: theme.dark ? "rgba(165,133,230,0.10)" : "rgba(138,99,210,0.07)" });
  // Reservatórios e o refrigerador de Carnot entre eles (mesmo intervalo de entropia da evaporação)
  const sA = props(f, c.h4, c.Pe).s;
  const sB = c.s1;
  d.polyline([[X(sA), Y(c.TL)], [X(sB), Y(c.TL)], [X(sB), Y(c.TH)], [X(sA), Y(c.TH)]], { color: theme.muted, width: 1.5, dash: [6, 4], close: true });
  d.line(D.x0, Y(c.TL), D.x1, Y(c.TL), { color: theme.negative, width: 1, alpha: 0.6 });
  d.line(D.x0, Y(c.TH), D.x1, Y(c.TH), { color: theme.positive, width: 1, alpha: 0.6 });
  d.text("T_L", D.x1, Y(c.TL), { size: 10, align: "right", dy: 8, color: theme.negative });
  d.text("T_H", D.x1, Y(c.TH), { size: 10, align: "right", dy: -8, color: theme.positive });
  drawCyclePath(d, q, (a) => {
    const pr = props(f, a.h, a.P);
    return [X(pr.s), Y(pr.T)];
  });
  d.ctx.restore();
  d.text("tracejado cinza: Carnot entre T_L e T_H", D.x0 + 0.1, D.y1 - 0.2, { size: 10, color: theme.muted, align: "left" });
  d.text(`${f.name}   ·   ${SEG_NAMES[q.seg]}`, D.x0, D.y1 + 0.6, { size: 11, weight: "600", align: "left" });
}

function drawCyclePath(d: Draw, q: Q, map: (a: { h: number; P: number }) => [number, number]) {
  const { theme } = d;
  const c = q.c;
  const colors = [theme.series[5]!, theme.positive, theme.text, theme.negative];
  for (let seg = 0; seg < 4; seg++) {
    const pts: [number, number][] = [];
    for (let i = 0; i <= 40; i++) pts.push(map(along(c, seg + Math.min(i / 40, 0.999999))));
    d.polyline(pts, { color: colors[seg], width: seg === q.seg ? 3.5 : 2.5, dash: seg === 2 ? [5, 4] : undefined });
  }
  const st = [0, 1, 2, 3].map((k) => map(along(c, k)));
  st.forEach(([x, y], k) => {
    d.dot(x, y, 3.5, theme.text);
    d.text(String(k + 1), x, y, { dx: k === 0 || k === 3 ? 0 : 0, dy: k <= 1 ? (k === 0 ? 12 : -11) : k === 2 ? -11 : 12, size: 11, weight: "700" });
  });
  const [mx, my] = map(q);
  d.dot(mx, my, 6.5, phaseColor(d, q.x, q.phase));
  d.circle(mx, my, 0, { stroke: theme.text, minPx: 6.5, width: 1.5 });
}

function bracket(d: Draw, xa: number, xb: number, y: number, label: string, color: string) {
  if (Math.abs(xb - xa) < 1e-6) return;
  d.arrow(xa, y, xb - xa, 0, { color, width: 1.5, head: 6 });
  d.line(xa, y - 0.1, xa, y + 0.1, { color, width: 1.5 });
  d.text(label, (xa + xb) / 2, y, { dy: y > 4.5 ? -8 : 9, size: 10, weight: "700", color });
}

function axes(d: Draw, xl: string, yl: string) {
  const { theme } = d;
  d.line(D.x0, D.y0, D.x1, D.y0, { color: theme.muted });
  d.line(D.x0, D.y0, D.x0, D.y1, { color: theme.muted });
  d.text(xl, D.x1, D.y0 - 0.65, { size: 11, color: theme.muted, align: "right" });
  d.text(yl, D.x0 - 0.75, D.y1 + 0.15, { size: 11, color: theme.muted, align: "left" });
}

function clip(d: Draw) {
  d.ctx.save();
  d.ctx.beginPath();
  d.ctx.rect(D.x0, D.y0, D.x1 - D.x0, D.y1 - D.y0);
  d.ctx.clip();
}

function niceTicks(a: number, b: number, n = 5): number[] {
  const raw = (b - a) / n;
  const e = 10 ** Math.floor(Math.log10(raw));
  const f = raw / e;
  const step = (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * e;
  const out: number[] = [];
  for (let v = Math.ceil(a / step) * step; v <= b + 1e-9; v += step) out.push(Math.round(v / step) * step);
  return out;
}

export default refrigerador;
