import { defineSim, draw, num, texNum, type Params, type State } from "@fisilab/core";

const G = 9.81;
const X = 0, V = 1;
const TRAVEL = 1.4;

export interface AtwoodDyn {
  a: number;
  T1: number;
  T2: number;
  moving: boolean;
}

/**
 * Dinâmica dos dois arranjos. x > 0 quando m₂ desce.
 * Polia com massa M e raio R (disco): inércia efetiva M/2 somada às massas.
 */
export function dynamics(s: State, p: Params): AtwoodDyn {
  const m1 = num(p, "m1", 1), m2 = num(p, "m2", 1.5), M = num(p, "Mp"), mu = num(p, "mu");
  const meff = m1 + m2 + M / 2;
  const v = s[V]!;
  if (Math.round(num(p, "arranjo")) === 0) {
    const a = ((m2 - m1) * G) / meff;
    return { a, T1: m1 * (G + a), T2: m2 * (G - a), moving: true };
  }
  // Bloco m1 na mesa, m2 pendurado.
  const fmax = mu * m1 * G;
  const drive = m2 * G;
  let a: number;
  let moving = true;
  if (Math.abs(v) > 1e-9) a = (drive - Math.sign(v) * fmax) / meff;
  else if (drive > fmax) a = (drive - fmax) / meff;
  else {
    a = 0;
    moving = false;
  }
  const f = moving ? Math.sign(v || 1) * fmax : drive;
  return { a, T1: m1 * a + f, T2: m2 * (G - a), moving };
}

export const atwood = defineSim({
  id: "atwood",
  title: "Máquina de Atwood e blocos acoplados",
  course: "FG I",
  topic: "Leis de Newton",
  priority: "P1",
  summary:
    "Duas massas ligadas por um fio numa polia: a clássica máquina de Atwood e o bloco na mesa puxado por um peso. Inclua a massa da polia e o atrito e compare as trações.",
  equations: [
    String.raw`a = \frac{(m_2 - m_1)\,g}{m_1 + m_2 + M/2} \quad\text{(Atwood)}`,
    String.raw`a = \frac{m_2 g - \mu m_1 g}{m_1 + m_2 + M/2} \quad\text{(mesa)}`,
    String.raw`T_1 = m_1(g + a) \qquad T_2 = m_2(g - a) \qquad (T_2 - T_1)R = I\alpha`,
  ],
  liveEquations(s, p) {
    const d = dynamics(s, p);
    return [String.raw`a = ${texNum(d.a)}\ \text{m/s}^2 \qquad T_1 = ${texNum(d.T1)}\ \text{N} \qquad T_2 = ${texNum(d.T2)}\ \text{N}`];
  },

  params: [
    {
      key: "arranjo",
      label: "Arranjo",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 0,
      options: [
        { value: 0, label: "Máquina de Atwood" },
        { value: 1, label: "Bloco na mesa + bloco pendurado" },
      ],
    },
    { key: "m1", label: "Massa m₁", unit: "kg", min: 0.1, max: 10, step: 0.1, default: 1 },
    { key: "m2", label: "Massa m₂", unit: "kg", min: 0.1, max: 10, step: 0.1, default: 1.5 },
    { key: "Mp", label: "Massa da polia M", unit: "kg", min: 0, max: 10, step: 0.1, default: 0 },
    { key: "mu", label: "Atrito na mesa μ", unit: "", min: 0, max: 1, step: 0.01, default: 0.2 },
  ],

  observables: [
    { key: "x", label: "Deslocamento de m₂ (descendo +)", unit: "m", value: (s) => s[X]! },
    { key: "v", label: "Velocidade", unit: "m/s", value: (s) => s[V]! },
    { key: "a", label: "Aceleração", unit: "m/s²", value: (s, p) => dynamics(s, p).a },
    { key: "T1", label: "Tração no lado de m₁", unit: "N", value: (s, p) => dynamics(s, p).T1 },
    { key: "T2", label: "Tração no lado de m₂", unit: "N", value: (s, p) => dynamics(s, p).T2 },
  ],
  chart: { x: "t", y: "v" },

  scenarios: [
    {
      id: "atwood",
      label: "Atwood com polia leve",
      params: { arranjo: 0, m1: 1, m2: 1.5, Mp: 0 },
      guide: `### Medindo g com a Atwood
A máquina "dilui" a gravidade: $a = g\\,(m_2-m_1)/(m_1+m_2)$. Com massas parecidas a queda fica lenta e fácil de cronometrar.
1. Com $m_1 = m_2$, o que acontece?
2. Ache massas que deem $a \\approx 1\\ \\text{m/s}^2$.`,
      predict: [
        {
          question: "Enquanto o sistema acelera, a tração no fio comparada ao peso de $m_2$ é:",
          options: ["maior", "igual", "menor"],
          answer: 2,
          explanation: "$m_2$ desce acelerando, então a resultante sobre ele aponta para baixo: $T_2 = m_2(g - a) < m_2 g$.",
        },
      ],
    },
    {
      id: "polia",
      label: "Polia pesada",
      params: { arranjo: 0, m1: 1, m2: 1.5, Mp: 2 },
      guide: `### Inércia da polia
Com uma polia de massa $M$, as trações dos dois lados ficam diferentes: a diferença $T_2 - T_1$ é o que acelera a rotação da polia.`,
    },
    {
      id: "mesa",
      label: "Bloco na mesa",
      params: { arranjo: 1, m1: 2, m2: 1, mu: 0.2, Mp: 0 },
      guide: `### Bloco puxado
1. Qual é o maior $\\mu$ para o qual o sistema ainda se move? Teste $\\mu = m_2/m_1$.
2. Compare $T_1$ com o peso de $m_2$.`,
    },
  ],

  exercises: [
    {
      id: "atwood",
      prompt: "Numa máquina de Atwood com polia leve, m₁ = {m1} kg e m₂ = {m2} kg (g = 9,81 m/s²). Qual é o módulo da aceleração?",
      vary: { m1: [0.5, 5, 1], m2: [0.5, 5, 1] },
      fixed: { arranjo: 0, Mp: 0 },
      answer: { label: "a", unit: "m/s²", compute: (p) => Math.abs(((num(p, "m2") - num(p, "m1")) * G) / (num(p, "m1") + num(p, "m2"))) },
    },
    {
      id: "tracao",
      prompt: "Um bloco de {m1} kg está numa mesa sem atrito, ligado por um fio a um bloco pendurado de {m2} kg. Qual é a tração no fio?",
      vary: { m1: [0.5, 5, 1], m2: [0.2, 3, 1] },
      fixed: { arranjo: 1, mu: 0, Mp: 0 },
      answer: { label: "T", unit: "N", compute: (p) => (num(p, "m1") * num(p, "m2") * G) / (num(p, "m1") + num(p, "m2")) },
    },
  ],

  init: () => [0, 0],
  derivatives: (s, p) => [s[V]!, dynamics(s, p).a],
  dt: 1e-3,
  tEnd: 20,
  stopWhen: (s) => TRAVEL - Math.abs(s[X]!),

  viewport: (p) =>
    Math.round(num(p, "arranjo")) === 0
      ? { xMin: -1.3, xMax: 1.3, yMin: -2.4, yMax: 0.45 }
      : { xMin: -2.6, xMax: 0.9, yMin: -2.4, yMax: 0.6 },

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const { state: s, params: p, theme } = frame;
    const x = s[X]!;
    const m1 = num(p, "m1", 1), m2 = num(p, "m2", 1.5);
    const side = (m: number) => 0.12 + 0.06 * Math.cbrt(m);
    const dyn = dynamics(s, p);
    const tk = 0.6 / Math.max(m1 * G, m2 * G, 1);
    const R = 0.18;
    const spinAngle = x / R;
    const pulley = (cx: number, cy: number) => {
      d.circle(cx, cy, R, { fill: theme.dark ? "#2b3441" : "#e3e8ef", stroke: theme.text, width: 2 });
      d.line(cx, cy, cx + R * Math.cos(spinAngle), cy - R * Math.sin(spinAngle), { color: theme.text, width: 2 });
      d.dot(cx, cy, 3, theme.text);
    };
    const block = (cx: number, cy: number, m: number, label: string, color: string) => {
      const w = side(m);
      d.rect(cx - w / 2, cy - w / 2, w, w, { fill: color, stroke: theme.text, width: 1 });
      d.text(label, cx, cy, { color: "#ffffff", weight: "700", size: 12 });
    };

    if (Math.round(num(p, "arranjo")) === 0) {
      d.support(-0.4, 0.35, 0.4, 0.35, { color: theme.muted });
      d.line(0, 0.35, 0, 0, { color: theme.muted, width: 2 });
      const y1 = -1.0 + x, y2 = -1.0 - x;
      d.line(-R, 0, -R, y1 + side(m1) / 2, { color: theme.text });
      d.line(R, 0, R, y2 + side(m2) / 2, { color: theme.text });
      pulley(0, 0);
      block(-R, y1, m1, "m₁", theme.series[0]!);
      block(R, y2, m2, "m₂", theme.series[1]!);
      d.arrow(-R - 0.3, y1, 0, dyn.T1 * tk, { color: theme.accent });
      d.text("T₁", -R - 0.42, y1 + dyn.T1 * tk, { color: theme.accent, size: 12 });
      d.arrow(-R - 0.3, y1, 0, -m1 * G * tk, { color: theme.text });
      d.arrow(R + 0.3, y2, 0, dyn.T2 * tk, { color: theme.accent });
      d.text("T₂", R + 0.42, y2 + dyn.T2 * tk, { color: theme.accent, size: 12 });
      d.arrow(R + 0.3, y2, 0, -m2 * G * tk, { color: theme.text });
      d.rect(-1.3, -2.4, 2.6, 0.15, { fill: theme.ground });
    } else {
      // Mesa de x = −2,5 a 0; polia na quina.
      d.rect(-2.5, -0.9, 2.5, 0.9, { fill: theme.ground });
      const w1 = side(m1);
      const bx = -1.6 + x;
      d.line(bx + w1 / 2, w1 / 2, 0, w1 / 2, { color: theme.text });
      pulley(0.0 + R * 0, w1 / 2 - R);
      const yh = -0.6 - x;
      d.line(R, w1 / 2 - R, R, yh + side(m2) / 2, { color: theme.text });
      block(bx, w1 / 2, m1, "m₁", theme.series[0]!);
      block(R, yh, m2, "m₂", theme.series[1]!);
      d.arrow(bx + w1 / 2, w1 / 2 + 0.25, dyn.T1 * tk, 0, { color: theme.accent });
      d.text("T₁", bx + w1 / 2 + dyn.T1 * tk + 0.12, w1 / 2 + 0.25, { color: theme.accent, size: 12 });
      d.arrow(R + 0.3, yh, 0, dyn.T2 * tk, { color: theme.accent });
      d.arrow(R + 0.3, yh, 0, -m2 * G * tk, { color: theme.text });
    }
    d.text(`a = ${texNum(dyn.a).replace("{,}", ",")} m/s²`, 0, 0.3, { color: theme.muted, size: 12, dx: 90 });
  },
});

export default atwood;
