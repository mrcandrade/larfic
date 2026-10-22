import { defineSim, draw, num, texNum, type Draw, type Params, type Theme } from "@fisilab/core";
import {
  AMOSTRAS,
  E,
  E2,
  FULL,
  KEY,
  R1,
  R2,
  R3,
  R4,
  RG,
  TH,
  ampsPerDiv,
  amostra,
  bridge,
  init,
  kirchhoff,
  shunted,
  solveKirchhoff,
  step,
} from "./model.ts";
import { batterySym, br, cable, currentArrow, jack, knob, ledDisplay, node, palette, panel, resistorBody, resistorSym, sevenSeg, si, type Pt } from "./bancada.ts";

export * from "./model.ts";

const K = (_s: number[], p: Params) => (kirchhoff(p) ? solveKirchhoff(p) : undefined);

export const ponteWheatstone = defineSim({
  id: "ponte-wheatstone",
  title: "Ponte de Wheatstone e leis de Kirchhoff",
  course: "Exp III",
  topic: "Circuitos",
  priority: "P1",
  summary:
    "Equilibre uma ponte de Wheatstone com uma década de resistores até o galvanômetro zerar e descubra o valor de resistores desconhecidos. No modo Kirchhoff, meça correntes de ramo e tensões num circuito de duas malhas e verifique as leis dos nós e das malhas.",
  equations: [
    String.raw`\text{equilíbrio } (I_g = 0):\quad V_B = V_D \iff \frac{R_1}{R_2} = \frac{R_3}{R_x} \iff R_x = R_3\,\frac{R_2}{R_1}`,
    String.raw`\text{nós: } \sum I_{\text{entram}} = \sum I_{\text{saem}} \qquad \text{malhas: } \sum \mathcal{E} = \sum R I`,
    String.raw`\text{duas malhas: } I_1 + I_2 = I_3,\quad \mathcal{E}_1 = R_1 I_1 + R_3 I_3,\quad \mathcal{E}_2 = (R_2 + R_4) I_2 + R_3 I_3`,
  ],
  liveEquations(s, p) {
    if (kirchhoff(p)) {
      const k = solveKirchhoff(p);
      return [
        String.raw`I_1 = ${texNum(k.I1)}\ \text{A},\quad I_2 = ${texNum(k.I2)}\ \text{A},\quad I_3 = ${texNum(k.I3)}\ \text{A},\quad V_b = ${texNum(k.Vb)}\ \text{V}`,
        String.raw`I_1 + I_2 - I_3 = ${texNum(k.no)}\ \text{A}`,
        String.raw`\mathcal{E}_1 - R_1 I_1 - R_3 I_3 = ${texNum(k.m1)}\ \text{V}\qquad \mathcal{E}_2 - (R_2+R_4) I_2 - R_3 I_3 = ${texNum(k.m2)}\ \text{V}`,
      ];
    }
    const b = bridge(s, p);
    return [
      String.raw`R_3\,\frac{R_2}{R_1} = ${texNum(R3(p), 5)} \times \frac{${texNum(R2(p))}}{${texNum(R1(p))}} = ${texNum((R3(p) * R2(p)) / R1(p), 5)}\ \Omega`,
      String.raw`I_g = ${texNum(b.Ig)}\ \text{A}\qquad V_B - V_D = ${texNum(b.Vb - b.Vd)}\ \text{V}`,
    ];
  },

  params: [
    {
      key: "modo",
      label: "Montagem",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 0,
      options: [
        { value: 0, label: "Ponte de Wheatstone" },
        { value: 1, label: "Circuito de duas malhas (Kirchhoff)" },
      ],
    },
    { key: "rx", label: "Resistor desconhecido Rx", unit: "", min: 0, max: AMOSTRAS.length - 1, step: 1, default: 0, options: AMOSTRAS.map((a, i) => ({ value: i, label: `Amostra ${a.nome}` })) },
    { key: "E", label: "Fonte E (E₁ no modo Kirchhoff)", unit: "V", min: 0, max: 12, step: 0.1, default: 6, live: true },
    { key: "R1", label: "R₁", unit: "Ω", min: 10, max: 10000, step: 1, default: 1000, log: true, live: true },
    { key: "R2", label: "R₂", unit: "Ω", min: 10, max: 10000, step: 1, default: 1000, log: true, live: true },
    { key: "R3", label: "R₃ (década de resistores)", unit: "Ω", min: 0, max: 11110, step: 1, default: 1000, live: true },
    {
      key: "sens",
      label: "Galvanômetro",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 1,
      live: true,
      options: [
        { value: 0, label: "Com shunt (grosso: 100 µA/div)" },
        { value: 1, label: "Sem shunt (fino: 1 µA/div)" },
      ],
    },
    { key: "E2", label: "E₂ (só Kirchhoff)", unit: "V", min: 0, max: 12, step: 0.1, default: 4.5, live: true },
    { key: "R4", label: "R₄ (só Kirchhoff)", unit: "Ω", min: 10, max: 10000, step: 1, default: 470, log: true, live: true },
  ],

  observables: [
    { key: "Ig", label: "Corrente no galvanômetro I_g", unit: "A", value: (s, p) => (kirchhoff(p) ? 0 : bridge(s, p).Ig) },
    { key: "defl", label: "Deflexão do ponteiro", unit: "div", value: (s) => s[TH]! },
    { key: "Rxcalc", label: "R_x calculado = R₃R₂/R₁", unit: "Ω", value: (_s, p) => (R3(p) * R2(p)) / R1(p) },
    { key: "Vbd", label: "V_B − V_D", unit: "V", value: (s, p) => (kirchhoff(p) ? 0 : bridge(s, p).Vb - bridge(s, p).Vd) },
    { key: "If", label: "Corrente da fonte", unit: "A", value: (s, p) => (kirchhoff(p) ? solveKirchhoff(p).I1 : bridge(s, p).If) },
    { key: "I1", label: "Corrente de ramo I₁", unit: "A", value: (s, p) => K(s, p)?.I1 ?? 0 },
    { key: "I2", label: "Corrente de ramo I₂", unit: "A", value: (s, p) => K(s, p)?.I2 ?? 0 },
    { key: "I3", label: "Corrente de ramo I₃", unit: "A", value: (s, p) => K(s, p)?.I3 ?? 0 },
    { key: "Vb", label: "Tensão no nó b", unit: "V", value: (s, p) => K(s, p)?.Vb ?? 0 },
    { key: "no", label: "Nó b: I₁ + I₂ − I₃", unit: "A", value: (s, p) => K(s, p)?.no ?? 0 },
    { key: "malha1", label: "Malha 1: E₁ − R₁I₁ − R₃I₃", unit: "V", value: (s, p) => K(s, p)?.m1 ?? 0 },
    { key: "malha2", label: "Malha 2: E₂ − (R₂+R₄)I₂ − R₃I₃", unit: "V", value: (s, p) => K(s, p)?.m2 ?? 0 },
  ],
  chart: { x: "t", y: "defl" },

  scenarios: [
    {
      id: "equilibrar",
      label: "Equilibrar a ponte",
      params: { modo: 0, rx: 0, E: 6, R1: 1000, R2: 1000, R3: 500, sens: 0 },
      guide: `### Encontrando Rx
1. Comece com o galvanômetro **com shunt** (pouco sensível): ele protege a bobina enquanto a ponte está longe do equilíbrio.
2. Ajuste a **década R₃** até o ponteiro voltar ao zero. Espere o ponteiro parar antes de ler (cerca de 1 s).
3. Tire o shunt (**sem shunt**, 1 µA/div) e refine R₃ de 1 em 1 Ω.
4. No equilíbrio, $R_x = R_3 R_2/R_1$. Compare com o valor nominal pelo código de cores (tolerância de 5 %).
5. Abra a **chave do galvanômetro** (clique nela): com o ramo aberto, o ponteiro volta a zero mesmo fora do equilíbrio. Zero com a chave fechada é o que vale.`,
      predict: [
        {
          question: "Depois de equilibrar a ponte, você dobra a tensão da fonte. O ponteiro:",
          options: ["continua em zero", "desvia para a direita", "desvia para a esquerda", "oscila sem parar"],
          answer: 0,
          explanation: "A condição $R_1/R_2 = R_3/R_x$ não depende de $E$: no equilíbrio $V_B = V_D$ para qualquer tensão. Uma fonte maior só torna o galvanômetro mais sensível fora do equilíbrio.",
        },
      ],
    },
    {
      id: "razao",
      label: "Escolha da razão R₁/R₂",
      params: { modo: 0, rx: 3, E: 6, R1: 1000, R2: 1000, R3: 48, sens: 1 },
      guide: `### Precisão e razão dos braços
A amostra D tem cerca de 47 Ω. Com $R_1 = R_2$, a década só ajusta R₃ de 1 em 1 Ω: o resultado tem apenas dois algarismos.
1. Equilibre com $R_1/R_2 = 1$ e anote $R_3$.
2. Mude para $R_1 = 1000\\ \\Omega$ e $R_2 = 100\\ \\Omega$ (razão 10): agora $R_3 = 10\\,R_x$ e a década dá um algarismo a mais.
3. Repita com razão 100. Faça o gráfico de $R_3$ contra $R_1/R_2$: é uma reta pela origem com inclinação $R_x$.
4. Perto do equilíbrio, quantos µA o galvanômetro acusa por ohm de desbalanço? Essa é a **sensibilidade** da ponte.`,
    },
    {
      id: "kirchhoff",
      label: "Leis de Kirchhoff (duas malhas)",
      params: { modo: 1, E: 6, E2: 4.5, R1: 220, R2: 330, R3: 470, R4: 100 },
      guide: `### Nós e malhas
Três amperímetros medem as correntes de ramo $I_1$, $I_2$ e $I_3$, que chegam e saem do nó b.
1. Verifique a **lei dos nós**: $I_1 + I_2 = I_3$ (o painel mostra a soma).
2. Percorra a malha da esquerda: $\\mathcal{E}_1 - R_1 I_1 - R_3 I_3 = 0$. Faça o mesmo na malha da direita.
3. Diminua $E_2$ até $I_2$ inverter de sentido: o amperímetro passa a indicar valores negativos. As leis continuam valendo com os sinais.
4. **Superposição:** meça $I_3$ com só $E_1$ ($E_2 = 0$), depois com só $E_2$ ($E = 0$). A soma é igual a $I_3$ com as duas fontes.`,
      predict: [
        {
          question: "Se você zerar E₂, a corrente I₂ no ramo da direita:",
          options: ["também zera", "inverte de sentido (passa a sair do nó b)", "fica igual", "dobra"],
          answer: 1,
          explanation: "Com $E_2 = 0$, o ramo da direita vira só resistores em paralelo com $R_3$: parte da corrente de $E_1$ desce por ele, saindo do nó b. $I_2$ fica negativo.",
        },
      ],
    },
  ],

  exercises: [
    {
      id: "equilibrio",
      prompt: "Uma ponte de Wheatstone fica equilibrada com R₁ = {R1} Ω, R₂ = {R2} Ω e a década em R₃ = {R3} Ω. Quanto vale a resistência desconhecida (no braço oposto a R₁)?",
      vary: { R1: [100, 5000, 0], R2: [100, 5000, 0], R3: [10, 9000, 0] },
      fixed: { modo: 0 },
      answer: { label: "Rx", unit: "Ω", compute: (p) => (num(p, "R3") * num(p, "R2")) / num(p, "R1") },
      hint: "No equilíbrio R₁/R₂ = R₃/Rx.",
    },
    {
      id: "corrente-i3",
      prompt:
        "No circuito de duas malhas, E₁ = {E} V em série com R₁ = {R1} Ω e E₂ = {E2} V em série com R₂ + R₄ = {R2} Ω + {R4} Ω alimentam o resistor central R₃ = {R3} Ω. Qual a corrente em R₃?",
      vary: { E: [1, 12, 1], E2: [1, 12, 1], R1: [100, 1000, 0], R2: [100, 1000, 0], R3: [100, 1000, 0], R4: [10, 500, 0] },
      fixed: { modo: 1 },
      answer: {
        label: "I₃",
        unit: "A",
        compute: (p) => {
          const Rr = num(p, "R2") + num(p, "R4");
          const vb = (num(p, "E") / num(p, "R1") + num(p, "E2") / Rr) / (1 / num(p, "R1") + 1 / num(p, "R3") + 1 / Rr);
          return vb / num(p, "R3");
        },
      },
      hint: "Escreva a lei dos nós em b com V_b como incógnita: (E₁ − V_b)/R₁ + (E₂ − V_b)/(R₂+R₄) = V_b/R₃.",
    },
  ],

  init,
  step: (s, p, _t, dt) => step(s, p, dt),
  dt: 0.005,
  sampleEvery: 4,

  viewport: () => ({ xMin: 0, xMax: 30, yMin: 0, yMax: 17, unit: "" }),

  pointer: {
    down(s, p, pt) {
      if (kirchhoff(p) || Math.hypot(pt.x - KEY_POS[0], pt.y - KEY_POS[1]) > 0.7) return undefined;
      const out = s.slice();
      out[KEY] = s[KEY]! > 0.5 ? 0 : 1;
      return out;
    },
    cursor: (_s, p, pt) => (!kirchhoff(p) && Math.hypot(pt.x - KEY_POS[0], pt.y - KEY_POS[1]) < 0.7 ? "pointer" : undefined),
  },

  actions: [
    {
      id: "chave",
      label: "Abrir / fechar a chave do galvanômetro",
      run: (s) => {
        const out = s.slice();
        out[KEY] = s[KEY]! > 0.5 ? 0 : 1;
        return out;
      },
      active: (s) => s[KEY]! > 0.5,
    },
  ],

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const { state: s, params: p, theme } = frame;
    if (kirchhoff(p)) drawKirchhoff(d, theme, p);
    else drawBridge(d, theme, s, p);
  },
});

// ---------------------------------------------------------------------------
// Ponte

const A: Pt = [9, 14.6];
const C: Pt = [9, 2.4];
const B: Pt = [3.6, 8.5];
const D: Pt = [14.4, 8.5];
const G: Pt = [9, 8.5];
const KEY_POS: Pt = [5.6, 8.5];

function galvanometer(d: Draw, theme: Theme, x: number, y: number, defl: number, label: string) {
  const r = 1.7;
  d.circle(x, y, r, { fill: theme.dark ? "#e9e4d4" : "#fbf8ee", stroke: "#444", width: 2 });
  const ang = (v: number) => Math.PI / 2 - (v / FULL) * (Math.PI / 3);
  const cy = y - 0.9;
  const R = 2.0;
  for (let v = -FULL; v <= FULL; v += 2) {
    const a = ang(v);
    const len = v % 10 === 0 ? 0.28 : 0.15;
    d.line(x + R * Math.cos(a), cy + R * Math.sin(a), x + (R - len) * Math.cos(a), cy + (R - len) * Math.sin(a), { color: "#222", width: v === 0 ? 2 : 1 });
    if (v % 10 === 0) d.text(String(Math.abs(v)), x + (R - 0.5) * Math.cos(a), cy + (R - 0.5) * Math.sin(a), { size: 8, color: "#222" });
  }
  const a = ang(Math.max(-FULL - 1.5, Math.min(FULL + 1.5, defl)));
  d.line(x, cy, x + 2.05 * Math.cos(a), cy + 2.05 * Math.sin(a), { color: "#c0261b", width: 2 });
  d.dot(x, cy, 4, "#333");
  d.text("G", x, y - 1.15, { size: 12, weight: "700", color: "#222" });
  d.text(label, x, y - 2.05, { size: 10, color: theme.text });
}

function decadeBox(d: Draw, theme: Theme, x: number, y: number, R3v: number): { a: Pt; b: Pt } {
  panel(d, theme, x, y, 11.2, 5.4, "DÉCADA DE RESISTORES  R₃");
  const v = Math.round(Math.min(11110, Math.max(0, R3v)));
  const digits = [Math.min(11, Math.floor(v / 1000)), Math.floor((v % 1000) / 100), Math.floor((v % 100) / 10), v % 10];
  const labels = ["×1000 Ω", "×100 Ω", "×10 Ω", "×1 Ω"];
  digits.forEach((dg, i) => {
    const kx = x + 1.5 + i * 2.6;
    knob(d, theme, kx, y + 2.3, 0.8, dg / (i === 0 ? 11 : 10));
    d.text(String(dg), kx, y + 3.55, { size: 13, weight: "700", color: theme.text });
    d.text(labels[i]!, kx, y + 1.1, { size: 9, color: theme.muted });
  });
  const ta: Pt = [x + 10.5, y + 3.9];
  const tb: Pt = [x + 10.5, y + 2.6];
  jack(d, ta[0], ta[1], "#d42a1f");
  jack(d, tb[0], tb[1], "#1a1a1a");
  d.text(`${v} Ω`, x + 10.4, y + 0.55, { size: 12, weight: "700", color: theme.text, align: "right" });
  return { a: ta, b: tb };
}

function drawBridge(d: Draw, theme: Theme, s: number[], p: Params) {
  const c = palette(theme);
  const col = theme.text;
  const b = bridge(s, p);
  const keyOn = s[KEY]! > 0.5;
  // Placa da ponte
  d.rect(0.4, 1.0, 16.6, 15.6, { fill: theme.dark ? "#3a2f24" : "#e8d8bf", stroke: theme.muted, width: 1 });
  d.text("Ponte de Wheatstone", 0.7, 16.25, { size: 11, weight: "700", color: theme.dark ? "#e9dcc6" : "#5b4528", align: "left" });
  // Braços com resistores físicos
  resistorBody(d, A, B, R1(p), 60);
  resistorBody(d, B, C, R2(p), 60);
  const am = amostra(p);
  resistorBody(d, D, C, am.nominal, 60);
  // A–D: terminais para a década (cabos)
  const ta: Pt = [11.2, 12.0];
  const tb: Pt = [13.0, 10.3];
  d.line(A[0], A[1], ta[0], ta[1], { color: "#777", width: 2.5 });
  d.line(tb[0], tb[1], D[0], D[1], { color: "#777", width: 2.5 });
  jack(d, ta[0], ta[1], "#d42a1f");
  jack(d, tb[0], tb[1], "#1a1a1a");
  const lab = theme.dark ? "#f1e6d2" : "#3d2c14";
  d.text(`R₁ = ${si(R1(p), "Ω")}`, (A[0] + B[0]) / 2 - 0.5, (A[1] + B[1]) / 2 + 0.6, { size: 11, color: lab, align: "right" });
  d.text(`R₂ = ${si(R2(p), "Ω")}`, (B[0] + C[0]) / 2 - 0.5, (B[1] + C[1]) / 2 - 0.6, { size: 11, color: lab, align: "right" });
  d.text("R₃ (década)", 12.6, 11.4, { size: 11, color: lab, align: "left" });
  d.text(`Rx = ? (amostra ${am.nome})`, (D[0] + C[0]) / 2 + 0.6, (D[1] + C[1]) / 2 - 0.5, { size: 11, color: lab, align: "left", weight: "600" });
  // Galvanômetro e chave entre B e D
  d.line(B[0], B[1], KEY_POS[0] - 0.45, KEY_POS[1], { color: "#777", width: 2.5 });
  if (keyOn) d.line(KEY_POS[0] - 0.45, KEY_POS[1], KEY_POS[0] + 0.45, KEY_POS[1], { color: "#777", width: 2.5 });
  else d.line(KEY_POS[0] - 0.45, KEY_POS[1], KEY_POS[0] + 0.3, KEY_POS[1] + 0.45, { color: "#777", width: 2.5 });
  d.circle(KEY_POS[0], KEY_POS[1] + 0.05, 0.62, { stroke: theme.accent, width: 1, dash: [3, 3] });
  d.text(keyOn ? "chave fechada" : "chave aberta", KEY_POS[0], KEY_POS[1] - 0.9, { size: 9, color: lab });
  d.line(KEY_POS[0] + 0.45, KEY_POS[1], G[0] - 1.7, G[1], { color: "#777", width: 2.5 });
  d.line(G[0] + 1.7, G[1], D[0], D[1], { color: "#777", width: 2.5 });
  galvanometer(d, theme, G[0], G[1], s[TH]!, shunted(p) ? "com shunt · 100 µA/div" : "sem shunt · 1 µA/div");
  if (keyOn && Math.abs(b.Ig) > 1e-9) currentArrow(d, (G[0] + 1.7 + D[0]) / 2, G[1] + 0.35, 1, 0, b.Ig, theme.series[1]!, si(Math.abs(b.Ig), "A", 2));
  for (const [q, n] of [
    [A, "A"],
    [B, "B"],
    [C, "C"],
    [D, "D"],
  ] as const) {
    node(d, q[0], q[1], "#444");
    d.text(n, q[0] + (n === "B" ? -0.4 : n === "D" ? 0.4 : 0.45), q[1] + (n === "A" ? 0.35 : n === "C" ? -0.35 : 0.4), { size: 12, weight: "700", color: lab });
  }
  // Fonte
  panel(d, theme, 18.0, 1.0, 11.4, 4.6, "FONTE DC");
  ledDisplay(d, theme, 18.4, 3.0, 5.0, 1.5, E(p).toFixed(2), "V", 5);
  const fp: Pt = [26.0, 2.2];
  const fm: Pt = [27.6, 2.2];
  jack(d, fp[0], fp[1], "#d42a1f", "+", theme.text);
  jack(d, fm[0], fm[1], "#1a1a1a", "−", theme.text);
  d.text(`I = ${si(b.If, "A")}`, 20.9, 1.9, { size: 11, color: theme.text });
  cable(d, fp, A, c.red, -1.5);
  cable(d, fm, C, c.black, 0.6);
  // Década
  const dec = decadeBox(d, theme, 18.0, 11.2, R3(p));
  cable(d, dec.a, ta, c.red, 0.4, 2.5);
  cable(d, dec.b, tb, c.black, 0.6, 2.5);
  // Quadro de anotações
  d.rect(18.0, 6.0, 11.4, 4.8, { stroke: theme.grid, width: 1 });
  d.text("Caderno de laboratório", 18.2, 10.45, { size: 10, align: "left", weight: "600", color: theme.muted });
  const bal = Math.abs(s[TH]!) < 0.5 && keyOn;
  d.text(bal ? "Ponteiro no zero: ponte equilibrada" : "Ajuste R₃ até o ponteiro parar no zero", 18.2, 9.6, { size: 11, align: "left", color: bal ? theme.series[2]! : theme.text, weight: bal ? "700" : "400" });
  d.text(`R₃ · R₂ / R₁ = ${br((R3(p) * R2(p)) / R1(p), 5)} Ω`, 18.2, 8.6, { size: 12, align: "left", color: theme.text, weight: "600" });
  d.text(`Nominal da amostra ${am.nome}: ${si(am.nominal, "Ω")} ± 5 %`, 18.2, 7.6, { size: 11, align: "left", color: theme.muted });
  d.text(`Galvanômetro: R_g = ${RG} Ω, ${si(ampsPerDiv(p), "A")}/div, ±${FULL} div`, 18.2, 6.6, { size: 10, align: "left", color: theme.muted });
}

// ---------------------------------------------------------------------------
// Kirchhoff

function miniAmmeter(d: Draw, theme: Theme, x: number, y: number, I: number, label: string) {
  const c = palette(theme);
  d.rect(x - 1.25, y - 0.6, 2.5, 1.2, { fill: c.dmmBody, stroke: "#6b5410", width: 1 });
  d.rect(x - 1.1, y - 0.45, 2.2, 0.9, { fill: c.lcdBg, stroke: "#111", width: 0.8 });
  const mA = I * 1000;
  const txt = Math.abs(mA) >= 100 ? mA.toFixed(1) : mA.toFixed(2);
  sevenSeg(d, txt, x + 0.55, y - 0.25, 0.48, c.lcdSeg, 5);
  d.text("mA", x + 1.05, y - 0.05, { size: 8, weight: "700", color: c.lcdSeg, align: "right" });
  d.text(label, x - 1.4, y, { size: 12, weight: "700", color: theme.text, align: "right" });
}

function drawKirchhoff(d: Draw, theme: Theme, p: Params) {
  const k = solveKirchhoff(p);
  const col = theme.text;
  const yT = 13.5;
  const yB = 2.5;
  const xL = 2.5;
  const xM = 10.5;
  const xR = 18.5;
  // Ramo esquerdo: E1 + amperímetro A1, R1 no alto
  batterySym(d, [xL, yB], [xL, 7.5], col, `E₁ = ${br(E(p), 3)} V`);
  d.line(xL, 7.5, xL, 9.4, { color: col, width: 2 });
  miniAmmeter(d, theme, xL, 10.0, k.I1, "");
  d.line(xL, 10.6, xL, yT, { color: col, width: 2 });
  resistorSym(d, [xL, yT], [xM, yT], 1.4, col);
  d.text(`R₁ = ${si(R1(p), "Ω")}`, (xL + xM) / 2, yT + 0.6, { size: 11, color: theme.muted });
  // Ramo do meio: R3 e A3
  resistorSym(d, [xM, yT], [xM, 6.6], 1.4, col);
  d.text(`R₃ = ${si(R3(p), "Ω")}`, xM + 0.5, 10.1, { size: 11, color: theme.muted, align: "left" });
  d.line(xM, 6.6, xM, 5.6, { color: col, width: 2 });
  miniAmmeter(d, theme, xM, 5.0, k.I3, "");
  d.line(xM, 4.4, xM, yB, { color: col, width: 2 });
  // Ramo direito: R4 no alto, R2, A2 e E2
  resistorSym(d, [xM, yT], [xR, yT], 1.4, col);
  d.text(`R₄ = ${si(R4(p), "Ω")}`, (xM + xR) / 2, yT + 0.6, { size: 11, color: theme.muted });
  resistorSym(d, [xR, yT], [xR, 9.6], 1.0, col);
  d.text(`R₂ = ${si(R2(p), "Ω")}`, xR + 0.5, 11.6, { size: 11, color: theme.muted, align: "left" });
  d.line(xR, 9.6, xR, 9.0, { color: col, width: 2 });
  miniAmmeter(d, theme, xR, 8.4, -k.I2, "");
  d.line(xR, 7.8, xR, 7.0, { color: col, width: 2 });
  batterySym(d, [xR, yB], [xR, 7.0], col);
  d.text(`E₂ = ${br(E2(p), 3)} V`, xR + 0.6, 4.75, { size: 12, color: col, align: "left" });
  d.line(xL, yB, xR, yB, { color: col, width: 2 });
  node(d, xM, yT, col);
  node(d, xM, yB, col);
  d.text("b", xM, yT + 0.45, { size: 13, weight: "700", color: theme.accent });
  d.text("A₁", xL - 1.6, 10.0, { size: 11, weight: "700", color: theme.text });
  d.text("A₃", xM - 1.6, 5.0, { size: 11, weight: "700", color: theme.text });
  d.text("A₂", xR - 1.6, 8.4, { size: 11, weight: "700", color: theme.text });
  // Setas de corrente (sentido de referência: I1 e I2 entram em b, I3 desce)
  currentArrow(d, (xL + xM) / 2 - 1.8, yT, 1, 0, k.I1, theme.series[0]!, `I₁`, 1);
  currentArrow(d, (xM + xR) / 2 + 1.8, yT, -1, 0, k.I2, theme.series[1]!, `I₂`, -1);
  currentArrow(d, xM - 0.5, 8.2, 0, -1, k.I3, theme.series[2]!, `I₃`, 1);
  // Malhas
  const loop = (cx: number, label: string, color: string) => {
    d.circle(cx, 8.0, 1.0, { stroke: color, width: 1.5, dash: [4, 3], alpha: 0.7 });
    d.arrowPx(cx + 1.0, 8.0, 0, -1, 12, { color, width: 1.5 });
    d.text(label, cx, 8.0, { size: 11, color, weight: "600" });
  };
  loop((xL + xM) / 2, "malha 1", theme.muted);
  loop((xM + xR) / 2, "malha 2", theme.muted);
  d.text("Leitura positiva no amperímetro = corrente no sentido da seta de referência.", 10.5, 0.9, { size: 10, color: theme.muted });
  d.text(`(A₂ indica a corrente que sobe pelo ramo da direita: −I₂ quando I₂ entra em b pelo alto)`, 10.5, 0.35, { size: 9, color: theme.muted });
  // Painel de verificação
  const X = 21.3;
  d.rect(X - 0.3, 2.0, 9.0, 13.2, { stroke: theme.grid, width: 1 });
  d.text("Verificação das leis", X, 14.7, { size: 12, weight: "700", color: theme.text, align: "left" });
  const rows: [string, number, string][] = [
    ["I₁", k.I1, "A"],
    ["I₂", k.I2, "A"],
    ["I₃", k.I3, "A"],
    ["V_b", k.Vb, "V"],
    ["Nó b: I₁ + I₂ − I₃", k.no, "A"],
    ["Malha 1: E₁ − R₁I₁ − R₃I₃", k.m1, "V"],
    ["Malha 2: E₂ − (R₂+R₄)I₂ − R₃I₃", k.m2, "V"],
  ];
  rows.forEach(([l, v, u], i) => {
    const y = 13.6 - i * 1.55;
    d.text(l, X, y, { size: 11, align: "left", color: theme.muted });
    const txt = i >= 4 && Math.abs(v) < 1e-9 ? `0 ${u}` : si(v, u, 4);
    d.text(txt, X + 8.2, y - 0.6, { size: 13, align: "right", color: i >= 4 ? theme.series[2]! : theme.text, weight: "700" });
  });
}

export default ponteWheatstone;
