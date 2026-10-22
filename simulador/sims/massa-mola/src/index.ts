import { defineSim, draw, num, rk4, texNum, type Draw, type Params, type State, type Theme } from "@fisilab/core";
import { derivation } from "./derivation.ts";

// Estado: [x, v, W_atrito (energia dissipada, ≥ 0), W_externa (trabalho da força F)]
const X = 0, V = 1, WD = 2, WF = 3;

const forces = (s: number[], p: Params) => {
  const k = num(p, "k", 20), m = num(p, "m", 1), mu = num(p, "mu"), F = num(p, "F"), g = 9.81;
  const x = s[X]!, v = s[V]!;
  const Fs = -k * x;
  const fmax = mu * m * g;
  let Ff = 0;
  if (Math.abs(v) > 1e-4) Ff = -Math.sign(v) * fmax;
  else if (Math.abs(Fs + F) > fmax) Ff = -Math.sign(Fs + F) * fmax;
  else Ff = -(Fs + F); // atrito estático segura o bloco
  return { Fs, Ff, F, net: Fs + Ff + F };
};

function derivatives(s: State, p: Params): State {
  const f = forces(s, p);
  const v = s[V]!;
  return [v, Math.abs(v) <= 1e-4 && Math.abs(f.net) < 1e-12 ? 0 : f.net / num(p, "m", 1), -f.Ff * v, f.F * v];
}

function bar(d: Draw, theme: Theme, x: number, base: number, h: number, w: number, color: string, label: string) {
  d.rect(x, base, w, Math.max(0, h), { fill: color, alpha: 0.85 });
  d.text(label, x + w / 2, base - 0.06, { color: theme.muted, size: 11 });
}

export const massaMola = defineSim({
  id: "massa-mola",
  title: "Massa-mola, trabalho e potência",
  course: "FG I",
  topic: "Energia",
  priority: "P1",
  summary:
    "Um bloco preso a uma mola sobre uma mesa com atrito e uma força externa ajustável. Acompanhe o trabalho de cada força, a potência instantânea e para onde vai a energia.",
  derivation,
  equations: [
    String.raw`m\ddot x = -kx + F - \mu m g\,\text{sgn}(\dot x)`,
    String.raw`W = \int \vec F\cdot d\vec r \qquad P = \vec F\cdot\vec v \qquad U_{el} = \tfrac12 k x^2`,
    String.raw`K + U_{el} + W_{\text{atrito}} - W_F = E_0`,
  ],
  liveEquations(s, p) {
    const f = forces(s, p);
    const v = s[V]!;
    return [String.raw`P_{\text{mola}} = ${texNum(f.Fs * v)}\ \text{W} \qquad P_{\text{atrito}} = ${texNum(f.Ff * v)}\ \text{W} \qquad P_F = ${texNum(f.F * v)}\ \text{W}`];
  },

  params: [
    { key: "k", label: "Constante da mola k", unit: "N/m", min: 1, max: 200, step: 1, default: 40 },
    { key: "m", label: "Massa", unit: "kg", min: 0.1, max: 10, step: 0.1, default: 1 },
    { key: "x0", label: "Deslocamento inicial", unit: "m", min: -0.5, max: 0.5, step: 0.01, default: 0.3 },
    { key: "v0", label: "Velocidade inicial", unit: "m/s", min: -3, max: 3, step: 0.05, default: 0 },
    { key: "mu", label: "Coeficiente de atrito μ", unit: "", min: 0, max: 0.5, step: 0.01, default: 0 },
    { key: "F", label: "Força externa F", unit: "N", min: -20, max: 20, step: 0.5, default: 0, live: true },
  ],

  observables: [
    { key: "x", label: "x", unit: "m", value: (s) => s[X]! },
    { key: "v", label: "v", unit: "m/s", value: (s) => s[V]! },
    { key: "a", label: "a", unit: "m/s²", value: (s, p) => forces(s, p).net / num(p, "m", 1) },
    { key: "K", label: "Energia cinética", unit: "J", value: (s, p) => 0.5 * num(p, "m", 1) * s[V]! ** 2 },
    { key: "U", label: "Energia elástica", unit: "J", value: (s, p) => 0.5 * num(p, "k", 20) * s[X]! ** 2 },
    { key: "Wd", label: "Energia dissipada pelo atrito", unit: "J", value: (s) => s[WD]! },
    { key: "WF", label: "Trabalho da força externa", unit: "J", value: (s) => s[WF]! },
    { key: "Pmola", label: "Potência da mola", unit: "W", value: (s, p) => forces(s, p).Fs * s[V]! },
    {
      key: "bal",
      label: "K + U + W_atrito − W_F",
      unit: "J",
      value: (s, p) => 0.5 * num(p, "m", 1) * s[V]! ** 2 + 0.5 * num(p, "k", 20) * s[X]! ** 2 + s[WD]! - s[WF]!,
    },
  ],
  conserved: "bal",
  chart: { x: "t", y: "x" },

  scenarios: [
    {
      id: "livre",
      label: "Oscilação livre",
      params: { mu: 0, F: 0, x0: 0.3, v0: 0 },
      guide: `### Troca de energia
1. Plote **Energia cinética** e compare com **Energia elástica**: quando uma é máxima, a outra é zero.
2. Plote a **potência da mola**. Quando ela é positiva, a mola está entregando energia ao bloco.
3. Confira que o período é $2\\pi\\sqrt{m/k}$.`,
      predict: [
        {
          question: "Se você quadruplicar a massa, o período da oscilação:",
          options: ["dobra", "quadruplica", "fica igual"],
          answer: 0,
          explanation: "$T = 2\\pi\\sqrt{m/k}$: com $4m$, a raiz dobra.",
        },
      ],
    },
    {
      id: "atrito",
      label: "Com atrito na mesa",
      params: { mu: 0.08, F: 0, x0: 0.4 },
      guide: `### Atrito seco
Com atrito constante a amplitude cai **linearmente** (não exponencialmente) a cada meio ciclo, $4\\mu mg/k$ por ciclo, e o bloco para fora do zero.
Observe a energia dissipada crescer até igualar a energia inicial perdida.`,
    },
    {
      id: "forca",
      label: "Força externa constante",
      params: { mu: 0, F: 8, x0: 0, v0: 0 },
      guide: `### Novo equilíbrio
Uma força constante só desloca o ponto de equilíbrio para $x_e = F/k$. O bloco oscila em torno dele.
Mude **F** durante o movimento e veja o trabalho externo entrar no balanço.`,
    },
  ],

  exercises: [
    {
      id: "periodo",
      prompt: "Um bloco de {m} kg preso a uma mola de constante {k} N/m oscila sem atrito. Qual é o período?",
      vary: { m: [0.2, 5, 1], k: [5, 200, 0] },
      answer: { label: "T", unit: "s", compute: (p) => 2 * Math.PI * Math.sqrt(num(p, "m") / num(p, "k")) },
    },
    {
      id: "vmax",
      prompt: "Uma mola de {k} N/m é comprimida {x0} m com um bloco de {m} kg e solta do repouso sem atrito. Qual é a velocidade máxima do bloco?",
      vary: { k: [10, 200, 0], x0: [0.05, 0.5, 2], m: [0.2, 5, 1] },
      answer: { label: "v_max", unit: "m/s", compute: (p) => Math.abs(num(p, "x0")) * Math.sqrt(num(p, "k") / num(p, "m")) },
      hint: "½kx₀² = ½mv²_max.",
    },
  ],

  init: (p) => [num(p, "x0"), num(p, "v0"), 0, 0],
  step(s, p, t, dt) {
    const next = rk4(derivatives, s, p, t, dt);
    // Atrito estático: se a velocidade trocou de sinal (ou zerou) e a mola não vence o atrito máximo, o bloco para.
    const v0 = s[V]!, v1 = next[V]!;
    if (v0 * v1 <= 0 && v0 !== 0) {
      const k = num(p, "k", 20), m = num(p, "m", 1), mu = num(p, "mu");
      if (Math.abs(-k * next[X]! + num(p, "F")) <= mu * m * 9.81) next[V] = 0;
    }
    return next;
  },
  dt: 5e-4,
  tEnd: 60,

  viewport: () => ({ xMin: -1.05, xMax: 0.85, yMin: -0.3, yMax: 0.85, unit: "m" }),

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const { state: s, params: p, theme } = frame;
    const x = s[X]!;
    const wall = -0.95;
    const bw = 0.16, bh = 0.12;
    d.rect(-1.05, -0.3, 2, 0.3, { fill: theme.ground });
    d.support(wall, 0, wall, 0.3, { color: theme.muted });
    d.spring(wall, bh / 2, x - bw / 2, bh / 2, { color: theme.muted, coils: 12, width: 2 });
    d.line(0, -0.03, 0, 0.32, { color: theme.grid, dash: [4, 4] });
    d.text("x = 0", 0, -0.08, { color: theme.muted, size: 11 });
    const F = num(p, "F");
    const xe = F / num(p, "k", 20);
    if (Math.abs(xe) > 1e-3) {
      d.line(xe, -0.03, xe, 0.32, { color: theme.accent, dash: [2, 4], alpha: 0.7 });
      d.text("equilíbrio", xe, -0.16, { color: theme.accent, size: 10 });
    }
    d.rect(x - bw / 2, 0, bw, bh, { fill: theme.series[1], stroke: theme.text, width: 1 });

    // Forças (escala: 1 N = 0,01 m na tela)
    const f = forces(s, p);
    const sc = 0.01;
    d.arrow(x, bh * 0.75, f.Fs * sc, 0, { color: theme.positive });
    if (Math.abs(f.Ff) > 1e-6) d.arrow(x, bh * 0.25, f.Ff * sc, 0, { color: theme.muted });
    if (Math.abs(F) > 1e-6) d.arrow(x, bh + 0.04, F * sc, 0, { color: theme.accent });

    // Barras de energia
    const m = num(p, "m", 1), k = num(p, "k", 20);
    const K = 0.5 * m * s[V]! ** 2, U = 0.5 * k * x ** 2, Wd = s[WD]!;
    const total = Math.max(1e-9, K + U + Wd, 0.5 * k * num(p, "x0") ** 2 + 0.5 * m * num(p, "v0") ** 2);
    const hmax = 0.4, base = 0.38, w = 0.1;
    bar(d, theme, 0.25, base, (K / total) * hmax, w, theme.series[0]!, "K");
    bar(d, theme, 0.4, base, (U / total) * hmax, w, theme.series[2]!, "U");
    bar(d, theme, 0.55, base, (Wd / total) * hmax, w, theme.muted, "dissip.");
    d.text("Energia", 0.45, base + hmax + 0.05, { color: theme.text, size: 11, weight: "600" });
  },
});

export default massaMola;
