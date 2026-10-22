import { defineSim, draw, num, texNum, type Params, type State } from "@fisilab/core";

// Estado: [y (distância caída a partir do ponto de soltura, m), v (m/s, para baixo)]
const Y = 0, V = 1;
const RHO_AR = 1.2;
const CD = 0.47;
const MAX_PORTAS = 4;

/** Esferas disponíveis: diâmetro (m) e massa (kg). */
export const ESFERAS = [
  { nome: "Aço (Ø 25 mm)", D: 0.025, m: 0.0642 },
  { nome: "Madeira (Ø 40 mm)", D: 0.04, m: 0.0235 },
  { nome: "Pingue-pongue (Ø 40 mm)", D: 0.04, m: 0.0027 },
];

export const esfera = (p: Params) => ESFERAS[Math.round(num(p, "esfera"))] ?? ESFERAS[0]!;

/** Velocidade terminal (arrasto quadrático) ou Infinity sem arrasto. */
export function vTerminal(p: Params): number {
  if (Math.round(num(p, "arrasto")) !== 1) return Infinity;
  const e = esfera(p);
  const A = (Math.PI * e.D * e.D) / 4;
  return Math.sqrt((2 * e.m * num(p, "g", 9.79)) / (RHO_AR * CD * A));
}

/** Solução exata y(t), v(t) a partir do repouso. */
export function motion(t: number, p: Params): { y: number; v: number } {
  const g = num(p, "g", 9.79);
  const vt = vTerminal(p);
  if (!Number.isFinite(vt)) return { y: 0.5 * g * t * t, v: g * t };
  const u = (g * t) / vt;
  // ln cosh(u) estável para u grande
  const lncosh = u > 20 ? u - Math.LN2 : Math.log(Math.cosh(u));
  return { y: ((vt * vt) / g) * lncosh, v: vt * Math.tanh(u) };
}

/** Tempo exato para cair a distância y a partir do repouso. */
export function timeTo(y: number, p: Params): number {
  if (y <= 0) return 0;
  const g = num(p, "g", 9.79);
  const vt = vTerminal(p);
  if (!Number.isFinite(vt)) return Math.sqrt((2 * y) / g);
  return (vt / g) * Math.acosh(Math.exp((g * y) / (vt * vt)));
}

export const nPortas = (p: Params) => Math.max(2, Math.min(MAX_PORTAS, Math.round(num(p, "nPortas", 2))));
export const quedaTotal = (p: Params) => num(p, "H", 1.2);

/** Posição da fotoporta i (1..4), limitada ao intervalo útil acima do coletor. */
export function gatePos(p: Params, i: number): number {
  const H = quedaTotal(p);
  return Math.min(num(p, `d${i}`, 0.2 * i), H - 0.03);
}

/** Tempo verdadeiro registrado pela fotoporta i: da soltura até o centro da esfera cruzar o feixe. */
export function gateTime(p: Params, i: number): number {
  if (i > nPortas(p)) return 0;
  return timeTo(gatePos(p, i), p);
}

/** Tempo verdadeiro em que o feixe da fotoporta i fica bloqueado pela esfera. */
export function blockTime(p: Params, i: number): number {
  if (i > nPortas(p)) return 0;
  const d = gatePos(p, i), r = esfera(p).D / 2;
  return timeTo(d + r, p) - timeTo(Math.max(0, d - r), p);
}

const fmt = (v: number, dec: number) => v.toFixed(dec).replace(".", ",");

export const quedaLivre = defineSim({
  id: "queda-livre",
  title: "Queda livre com fotoportas",
  course: "Exp I",
  topic: "Cinemática",
  priority: "P1",
  summary:
    "Uma esfera solta por um eletroímã cai passando por até quatro fotoportas ligadas a um cronômetro digital. Meça os tempos, monte o gráfico de h contra t² e determine g, com ou sem a resistência do ar.",
  equations: [
    String.raw`h = \tfrac12 g t^2 \quad\Rightarrow\quad g = \frac{2h}{t^2}`,
    String.raw`v \approx \frac{D}{\Delta t_{\text{bloq}}} \qquad g \approx \frac{v_2 - v_1}{t_2 - t_1}`,
    String.raw`m\dot v = mg - \tfrac12\rho C_D A v^2 \;\Rightarrow\; h(t) = \frac{v_t^2}{g}\ln\cosh\frac{gt}{v_t}`,
  ],
  liveEquations(s, p) {
    const t1 = gateTime(p, 1), t2 = gateTime(p, 2);
    const d1 = gatePos(p, 1), d2 = gatePos(p, 2);
    const vt = vTerminal(p);
    return [
      String.raw`t_1 = ${texNum(t1, 4)}\ \text{s} \quad t_2 = ${texNum(t2, 4)}\ \text{s} \quad \frac{2h_2}{t_2^2} = ${texNum((2 * d2) / (t2 * t2), 4)}\ \text{m/s}^2`,
      String.raw`\frac{2(h_2 - h_1)}{t_2^2 - t_1^2} = ${texNum((2 * (d2 - d1)) / (t2 * t2 - t1 * t1), 4)}\ \text{m/s}^2 \qquad v = ${texNum(s[V]!)}\ \text{m/s}` +
        (Number.isFinite(vt) ? String.raw` \qquad v_t = ${texNum(vt)}\ \text{m/s}` : ""),
    ];
  },

  params: [
    { key: "H", label: "Altura de queda até o coletor", unit: "m", min: 0.3, max: 2, step: 0.01, default: 1.2 },
    { key: "nPortas", label: "Número de fotoportas", unit: "", min: 2, max: 4, step: 1, default: 2 },
    { key: "d1", label: "Distância soltura → fotoporta 1", unit: "m", min: 0.05, max: 1.95, step: 0.005, default: 0.2 },
    { key: "d2", label: "Distância soltura → fotoporta 2", unit: "m", min: 0.05, max: 1.95, step: 0.005, default: 0.8 },
    { key: "d3", label: "Distância soltura → fotoporta 3", unit: "m", min: 0.05, max: 1.95, step: 0.005, default: 1.0 },
    { key: "d4", label: "Distância soltura → fotoporta 4", unit: "m", min: 0.05, max: 1.95, step: 0.005, default: 1.1 },
    {
      key: "esfera",
      label: "Esfera",
      unit: "",
      min: 0,
      max: 2,
      step: 1,
      default: 0,
      options: ESFERAS.map((e, i) => ({ value: i, label: e.nome })),
    },
    {
      key: "arrasto",
      label: "Resistência do ar",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 0,
      options: [
        { value: 0, label: "Desprezada (vácuo)" },
        { value: 1, label: "Arrasto quadrático (ar)" },
      ],
    },
    { key: "g", label: "Gravidade local g", unit: "m/s²", min: 1, max: 25, step: 0.01, default: 9.79 },
  ],

  observables: [
    { key: "y", label: "Distância caída", unit: "m", value: (s) => s[Y]! },
    { key: "v", label: "Velocidade", unit: "m/s", value: (s) => s[V]! },
    { key: "t1", label: "Tempo até a fotoporta 1", unit: "s", value: (_s, p) => gateTime(p, 1) },
    { key: "t2", label: "Tempo até a fotoporta 2", unit: "s", value: (_s, p) => gateTime(p, 2) },
    { key: "t3", label: "Tempo até a fotoporta 3", unit: "s", value: (_s, p) => gateTime(p, 3) },
    { key: "t4", label: "Tempo até a fotoporta 4", unit: "s", value: (_s, p) => gateTime(p, 4) },
    { key: "h1", label: "Distância até a fotoporta 1", unit: "m", value: (_s, p) => gatePos(p, 1) },
    { key: "h2", label: "Distância até a fotoporta 2", unit: "m", value: (_s, p) => gatePos(p, 2) },
    { key: "t12", label: "Intervalo entre as fotoportas 1 e 2", unit: "s", value: (_s, p) => gateTime(p, 2) - gateTime(p, 1) },
    { key: "tb1", label: "Tempo de bloqueio na fotoporta 1", unit: "s", value: (_s, p) => blockTime(p, 1) },
    { key: "tb2", label: "Tempo de bloqueio na fotoporta 2", unit: "s", value: (_s, p) => blockTime(p, 2) },
    { key: "tq", label: "Tempo de queda até o coletor", unit: "s", value: (_s, p) => timeTo(quedaTotal(p), p) },
    { key: "D", label: "Diâmetro da esfera", unit: "m", value: (_s, p) => esfera(p).D },
  ],
  chart: { x: "t", y: "y" },

  scenarios: [
    {
      id: "medir-g",
      label: "Medir g com duas fotoportas",
      params: { nPortas: 2, d1: 0.2, d2: 0.8, H: 1.2, esfera: 0, arrasto: 0 },
      guide: `### Medindo g pela queda livre
O cronômetro dispara quando o eletroímã solta a esfera e registra o instante em que ela cruza cada feixe.
1. Rode e anote $t_1$ e $t_2$ (resolução do cronômetro: 0,1 ms).
2. Calcule $g = 2h_2/t_2^2$. Qual a incerteza relativa de $g$ se $u(h) = 1$ mm e $u(t) = 0{,}1$ ms? Use $\\frac{u(g)}{g} = \\sqrt{\\left(\\frac{u(h)}{h}\\right)^2 + \\left(2\\frac{u(t)}{t}\\right)^2}$.
3. Mude a fotoporta 2 de lugar (pelo menos 6 posições) e faça o gráfico de $h$ contra $t^2$: a inclinação é $g/2$.
4. Por que o termo do tempo pesa o dobro na incerteza?`,
      predict: [
        {
          question: "Se a fotoporta for colocada 4 vezes mais longe do ponto de soltura, o tempo registrado fica:",
          options: ["4 vezes maior", "2 vezes maior", "16 vezes maior", "igual"],
          answer: 1,
          explanation: "Como $h = \\tfrac12 g t^2$, $t = \\sqrt{2h/g}$: quadruplicar $h$ dobra $t$.",
        },
      ],
    },
    {
      id: "velocidade",
      label: "Velocidade pelo tempo de bloqueio",
      params: { nPortas: 2, d1: 0.3, d2: 1.0, H: 1.3, esfera: 0, arrasto: 0 },
      guide: `### Duas maneiras de medir g
Cada fotoporta também mede quanto tempo o feixe fica **bloqueado** pela esfera de diâmetro $D$.
1. Calcule $v_1 \\approx D/\\Delta t_{b1}$ e $v_2 \\approx D/\\Delta t_{b2}$.
2. Calcule $g \\approx (v_2 - v_1)/(t_2 - t_1)$ e compare com $2h/t^2$.
3. Qual método tem incerteza maior? Repare que $\\Delta t_b$ é de poucos milissegundos, e a resolução do cronômetro é 0,1 ms.`,
    },
    {
      id: "arrasto",
      label: "Bola leve e resistência do ar",
      params: { nPortas: 4, d1: 0.3, d2: 0.8, d3: 1.3, d4: 1.8, H: 1.95, esfera: 2, arrasto: 1 },
      guide: `### Quando o ar atrapalha
Uma bolinha de pingue-pongue tem velocidade terminal de poucos metros por segundo.
1. Meça os quatro tempos e calcule $2h/t^2$ para cada fotoporta. O valor cai com a distância?
2. Troque para a esfera de aço com arrasto ligado. A diferença em relação ao vácuo é maior ou menor que a incerteza de medida?
3. Desenhe $h$ contra $t^2$: os pontos ainda caem numa reta?`,
      predict: [
        {
          question: "Com o ar, o valor $2h/t^2$ calculado para a bola de pingue-pongue, comparado a g, será:",
          options: ["maior", "igual", "menor"],
          answer: 2,
          explanation: "O arrasto reduz a aceleração; a bola demora mais e $2h/t^2$ subestima $g$, tanto mais quanto maior a velocidade.",
        },
      ],
    },
  ],

  exercises: [
    {
      id: "g-tempo",
      prompt:
        "Uma esfera de aço é solta do repouso e cruza uma fotoporta {d2} m abaixo do ponto de soltura. O cronômetro registra o tempo t2 indicado na simulação, com g = {g} m/s² e sem ar. Qual é esse tempo?",
      vary: { d2: [0.3, 1.8, 2], g: [9.7, 9.85, 2] },
      fixed: { nPortas: 2, d1: 0.1, H: 1.95, arrasto: 0, esfera: 0 },
      answer: { label: "t₂", unit: "s", compute: (p) => Math.sqrt((2 * num(p, "d2")) / num(p, "g")) },
      tolerance: 0.005,
    },
    {
      id: "incerteza-g",
      prompt:
        "Numa queda de h = {d2} m (incerteza 1 mm) o cronômetro mede t com incerteza de 0,0001 s. Qual a incerteza relativa percentual de g = 2h/t², considerando g = {g} m/s²?",
      vary: { d2: [0.3, 1.8, 2], g: [9.7, 9.85, 2] },
      fixed: { nPortas: 2, d1: 0.1, H: 1.95, arrasto: 0 },
      answer: {
        label: "u(g)/g",
        unit: "%",
        compute: (p) => {
          const h = num(p, "d2"), t = Math.sqrt((2 * h) / num(p, "g"));
          return 100 * Math.hypot(0.001 / h, (2 * 0.0001) / t);
        },
      },
      tolerance: 0.05,
      hint: "Some em quadratura u(h)/h e 2·u(t)/t.",
    },
  ],

  init: () => [0, 0],
  // Passo exato: a solução fechada é avaliada no novo instante.
  step(_s: State, p: Params, t: number, dt: number): State {
    const m = motion(t + dt, p);
    return [m.y, m.v];
  },
  dt: 5e-4,
  sampleEvery: 4,
  tEnd: 10,
  stopWhen: (s, p) => quedaTotal(p) - s[Y]!,

  viewport: (p) => {
    const sx = Math.max(1, quedaTotal(p) + 0.35);
    return { xMin: -0.5 * sx, xMax: 0.65 * sx, yMin: -quedaTotal(p) - 0.12, yMax: 0.2 };
  },

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const { state: s, params: p, theme, t } = frame;
    const H = quedaTotal(p);
    const e = esfera(p);
    const r = Math.max(e.D / 2, 0);
    const span = Math.max(1, H + 0.35);

    // Haste vertical e base
    const hx = -0.3;
    d.rect(hx - 0.012, -H - 0.05, 0.024, H + 0.2, { fill: theme.muted, alpha: 0.5 });
    d.rect(-0.4, -H - 0.1, 0.6, 0.05, { fill: theme.ground, stroke: theme.muted, width: 1 });

    // Régua (zero no ponto de soltura, cresce para baixo)
    const rx = -0.38;
    d.rect(rx - 0.025, -H - 0.02, 0.05, H + 0.04, { fill: theme.dark ? "#3a3420" : "#f6e9b8", stroke: theme.muted, width: 1 });
    for (let cm = 0; cm <= Math.round(H * 100); cm++) {
      const y = -cm / 100;
      const big = cm % 10 === 0, mid = cm % 5 === 0;
      d.line(rx - 0.025, y, rx - 0.025 + (big ? 0.03 : mid ? 0.02 : 0.01), y, { color: theme.text, width: big ? 1.2 : 0.7 });
      if (big) d.text(`${cm}`, rx - 0.03, y, { size: 10, align: "right", color: theme.muted });
    }
    d.text("cm", rx - 0.03, 0.06, { size: 10, align: "right", color: theme.muted });

    // Eletroímã
    d.rect(-0.05, r + 0.005, 0.1, 0.05, { fill: theme.series[4]!, stroke: theme.text, width: 1 });
    d.line(hx, r + 0.03, -0.05, r + 0.03, { color: theme.muted, width: 3 });
    d.text("eletroímã", 0.07, r + 0.03, { size: 10, align: "left", color: theme.muted });

    // Coletor
    d.polyline(
      [[-0.06, -H + 0.04], [-0.05, -H - 0.05], [0.05, -H - 0.05], [0.06, -H + 0.04]],
      { color: theme.text, width: 1.5 },
    );

    // Fotoportas
    const n = nPortas(p);
    for (let i = 1; i <= n; i++) {
      const y = -gatePos(p, i);
      const tg = gateTime(p, i);
      const passed = t >= tg;
      const blocked = Math.abs(s[Y]! - gatePos(p, i)) < r;
      d.line(hx, y, -0.1, y, { color: theme.muted, width: 2 });
      d.rect(-0.1, y - 0.015, 0.025, 0.03, { fill: theme.text, alpha: 0.85 });
      d.rect(0.075, y - 0.015, 0.025, 0.03, { fill: theme.text, alpha: 0.85 });
      d.line(-0.075, y, 0.075, y, { color: blocked ? theme.muted : theme.positive, width: 1.5, dash: blocked ? [3, 3] : [], alpha: 0.9 });
      d.dot(0.1, y + 0.022, 2.5, passed ? theme.series[2]! : theme.muted);
      d.text(`F${i}`, 0.115, y, { size: 11, align: "left", weight: "600" });
    }

    // Esfera
    const yb = -s[Y]!;
    d.circle(0, yb, r, { fill: e.m > 0.03 ? "#9aa4b1" : e.m > 0.01 ? "#c49a6c" : "#f4f1e8", stroke: theme.text, width: 1, minPx: 3 });
    if (s[V]! > 0.05) d.arrowPx(0.04, yb, 0, -1, Math.min(70, 10 * s[V]!), { color: theme.accent });

    // Cronômetro digital
    const px0 = 0.2 * span, py0 = -0.02;
    const lh = 0.05 * span;
    const w = 0.38 * span;
    const rows = n + 2;
    d.rect(px0, py0 - lh * (rows + 0.4), w, lh * (rows + 0.6), { fill: theme.dark ? "#0f1a12" : "#1d2a20", stroke: theme.text, width: 1 });
    const lcd = "#7cf29a";
    d.text("CRONÔMETRO DIGITAL", px0 + w / 2, py0 - lh * 0.35, { color: lcd, size: 10, weight: "600" });
    for (let i = 1; i <= n; i++) {
      const tg = gateTime(p, i);
      const shown = t >= tg ? tg : 0;
      d.text(`F${i}  t = ${fmt(shown, 4)} s`, px0 + 0.04 * span, py0 - lh * (i + 0.3), { color: lcd, size: 14, align: "left", weight: "600" });
    }
    const tq = timeTo(H, p);
    d.text(`coletor  ${fmt(Math.min(t, tq), 4)} s`, px0 + 0.04 * span, py0 - lh * (n + 1.3), { color: lcd, size: 11, align: "left" });
    d.text(Math.round(num(p, "arrasto")) === 1 ? "com ar" : "sem ar", px0 + w / 2, py0 - lh * (rows + 0.95), { color: theme.muted, size: 11 });
  },
});

export default quedaLivre;
