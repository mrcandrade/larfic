import { defineSim, draw, num, rad, rk4, texNum, type Params, type State } from "@fisilab/core";

// Estado: [s (posição ao longo do plano, descendo positiva, a partir do topo), v, energia dissipada]
const S = 0, V = 1, WD = 2;
const L = 4; // comprimento da rampa, m
const G = 9.81;

export interface InclineForces {
  P: number; // peso
  Ppar: number; // componente do peso ao longo do plano (descendo +)
  N: number;
  F: number; // força aplicada (subindo o plano, +)
  f: number; // atrito (sinal ao longo do plano, descendo +)
  net: number;
  sliding: boolean;
}

export function inclineForces(s: State, p: Params): InclineForces {
  const m = num(p, "m", 2), th = rad(num(p, "angulo", 30));
  const mus = num(p, "mus", 0.5), muk = Math.min(num(p, "muk", 0.3), mus);
  const F = num(p, "F");
  const P = m * G;
  const Ppar = P * Math.sin(th);
  const N = P * Math.cos(th);
  const drive = Ppar - F; // força motriz sem atrito, ao longo do plano (descendo +)
  const v = s[V]!;
  let f: number;
  let sliding: boolean;
  if (Math.abs(v) > 1e-6) {
    f = -Math.sign(v) * muk * N;
    sliding = true;
  } else if (Math.abs(drive) > mus * N) {
    f = -Math.sign(drive) * muk * N;
    sliding = true;
  } else {
    f = -drive;
    sliding = false;
  }
  return { P, Ppar, N, F, f, net: drive + f, sliding };
}

function deriv(s: State, p: Params): State {
  const f = inclineForces(s, p);
  const v = s[V]!;
  return [v, f.sliding ? f.net / num(p, "m", 2) : 0, -f.f * v];
}

export const planoInclinado = defineSim({
  id: "plano-inclinado",
  title: "Plano inclinado com atrito",
  course: "FG I",
  topic: "Leis de Newton",
  priority: "P1",
  summary:
    "Um bloco numa rampa com atrito estático e cinético. Veja o diagrama de corpo livre mudar quando o bloco começa a deslizar e encontre o ângulo crítico.",
  equations: [
    String.raw`N = mg\cos\theta \qquad f_e \le \mu_e N \qquad f_c = \mu_c N`,
    String.raw`m a = mg\sin\theta - F - f`,
    String.raw`\tan\theta_c = \mu_e`,
  ],
  liveEquations(s, p) {
    const f = inclineForces(s, p);
    return [
      String.raw`mg\sin\theta = ${texNum(f.Ppar)}\ \text{N} \qquad \mu_e N = ${texNum(num(p, "mus", 0.5) * f.N)}\ \text{N} \qquad \theta_c = ${texNum((Math.atan(num(p, "mus", 0.5)) * 180) / Math.PI)}^\circ`,
    ];
  },

  params: [
    { key: "angulo", label: "Inclinação θ", unit: "°", min: 0, max: 80, step: 0.5, default: 30, live: true },
    { key: "m", label: "Massa", unit: "kg", min: 0.1, max: 20, step: 0.1, default: 2 },
    { key: "mus", label: "Atrito estático μe", unit: "", min: 0, max: 1.2, step: 0.01, default: 0.5, live: true },
    { key: "muk", label: "Atrito cinético μc", unit: "", min: 0, max: 1.2, step: 0.01, default: 0.3, live: true },
    { key: "F", label: "Força aplicada (subindo o plano)", unit: "N", min: -30, max: 60, step: 0.5, default: 0, live: true },
    { key: "v0", label: "Velocidade inicial (descendo +)", unit: "m/s", min: -6, max: 6, step: 0.1, default: 0 },
    {
      key: "componentes",
      label: "Decompor o peso",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 1,
      live: true,
      options: [
        { value: 1, label: "Sim" },
        { value: 0, label: "Não" },
      ],
    },
  ],

  observables: [
    { key: "s", label: "Posição ao longo do plano", unit: "m", value: (s) => s[S]! },
    { key: "v", label: "Velocidade", unit: "m/s", value: (s) => s[V]! },
    { key: "a", label: "Aceleração", unit: "m/s²", value: (s, p) => deriv(s, p)[1]! },
    { key: "N", label: "Normal", unit: "N", value: (s, p) => inclineForces(s, p).N },
    { key: "f", label: "Atrito (descendo +)", unit: "N", value: (s, p) => inclineForces(s, p).f },
    { key: "desl", label: "Deslizando (1) ou parado (0)", unit: "", value: (s, p) => (inclineForces(s, p).sliding ? 1 : 0) },
    { key: "Wd", label: "Energia dissipada", unit: "J", value: (s) => s[WD]! },
  ],
  chart: { x: "t", y: "v" },

  scenarios: [
    {
      id: "critico",
      label: "Ângulo crítico",
      params: { angulo: 20, mus: 0.5, muk: 0.3, F: 0, v0: 0 },
      guide: `### Quando começa a deslizar?
1. Rode e aumente devagar a inclinação durante a simulação.
2. Anote o ângulo em que o bloco começa a se mover e compare com $\\arctan\\mu_e$.
3. Depois de deslizar, reduza um pouco o ângulo. O bloco para no mesmo ângulo? Por quê?`,
      predict: [
        {
          question: "Dobrando a massa do bloco, o ângulo em que ele começa a deslizar:",
          options: ["aumenta", "diminui", "não muda"],
          answer: 2,
          explanation: "Tanto $mg\\sin\\theta$ quanto $\\mu_e mg\\cos\\theta$ dobram; a condição $\\tan\\theta_c = \\mu_e$ não depende da massa.",
        },
      ],
    },
    {
      id: "desce",
      label: "Descida com atrito cinético",
      params: { angulo: 40, mus: 0.5, muk: 0.3, F: 0, v0: 0 },
      guide: `### Aceleração constante
Compare a aceleração medida com $a = g(\\sin\\theta - \\mu_c\\cos\\theta)$.
A energia potencial perdida vai parte para cinética e parte para calor: confira no balanço.`,
    },
    {
      id: "empurra",
      label: "Empurrando rampa acima",
      params: { angulo: 25, mus: 0.4, muk: 0.25, F: 25, v0: 0 },
      guide: `### Subindo
Com $F$ maior que $mg\\sin\\theta + \\mu_e N$ o bloco sobe. Ache a menor força que coloca o bloco em movimento rampa acima.`,
    },
    {
      id: "lancado",
      label: "Lançado rampa acima",
      params: { angulo: 20, mus: 0.6, muk: 0.3, F: 0, v0: -5 },
      guide: `### Sobe, para e...?
Lançado para cima, o bloco desacelera mais na subida que na descida. Ele volta? Depende de $\\tan\\theta$ comparado com $\\mu_e$.`,
    },
  ],

  exercises: [
    {
      id: "aceleracao",
      prompt: "Um bloco desliza num plano inclinado de {angulo}° com coeficiente de atrito cinético {muk}. Qual é a aceleração (g = 9,81 m/s²)?",
      vary: { angulo: [30, 60, 0], muk: [0.05, 0.4, 2] },
      answer: {
        label: "a",
        unit: "m/s²",
        compute: (p) => G * (Math.sin(rad(num(p, "angulo"))) - num(p, "muk") * Math.cos(rad(num(p, "angulo")))),
      },
    },
    {
      id: "critico",
      prompt: "O coeficiente de atrito estático entre um bloco e uma rampa é {mus}. A partir de que ângulo, em graus, o bloco começa a deslizar?",
      vary: { mus: [0.1, 1, 2] },
      answer: { label: "θ_c", unit: "°", compute: (p) => (Math.atan(num(p, "mus")) * 180) / Math.PI },
      tolerance: 0.01,
    },
  ],

  init: (p) => [0.6, num(p, "v0"), 0],
  step(s, p, t, dt) {
    const next = rk4(deriv, s, p, t, dt);
    // Parada por atrito estático quando a velocidade troca de sinal.
    if (s[V]! * next[V]! <= 0 && s[V]! !== 0) {
      const f = inclineForces([next[S]!, 0, 0], p);
      if (!f.sliding) next[V] = 0;
    }
    return next;
  },
  dt: 1e-3,
  tEnd: 30,
  stopWhen: (s) => Math.min(L - 0.2 - s[S]!, s[S]! + 0.6),

  viewport: () => ({ xMin: -0.3, xMax: 4.6, yMin: -0.3, yMax: 3.4 }),

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const { state: st, params: p, theme } = frame;
    const th = rad(num(p, "angulo", 30));
    // Rampa: topo em (0, H), base em (L cosθ, 0); para ângulos altos encolhe para caber.
    const len = Math.min(L, 3.2 / Math.max(Math.sin(th), 1e-3), 4.3 / Math.max(Math.cos(th), 1e-3));
    const scale = len / L;
    const H = len * Math.sin(th), B = len * Math.cos(th);
    d.polyline([[0, 0], [0, H], [B, 0]], { color: theme.muted, close: true, fill: theme.ground, width: 1.5 });
    d.rect(-0.3, -0.3, 5, 0.3, { fill: theme.ground });
    // Arco do ângulo
    const arc: [number, number][] = [];
    for (let k = 0; k <= 20; k++) arc.push([B - 0.5 * Math.cos((th * k) / 20), 0.5 * Math.sin((th * k) / 20)]);
    d.polyline(arc, { color: theme.muted });
    d.text(`${num(p, "angulo", 30)}°`, B - 0.7, 0.15, { color: theme.muted, size: 12 });

    // Bloco
    const s = Math.max(0, st[S]!) * scale;
    const ux = Math.cos(th), uy = -Math.sin(th); // direção descendo o plano
    const nx = Math.sin(th), ny = Math.cos(th); // normal saindo do plano
    const w = 0.42, h = 0.3;
    const cx = s * ux + nx * (h / 2), cy = H + s * uy + ny * (h / 2);
    d.box(cx, cy, w, h, -th, { fill: theme.series[1], stroke: theme.text, width: 1 });

    // Forças (escala fixa em N → m)
    const f = inclineForces(st, p);
    const k = 1.2 / Math.max(f.P, 1);
    d.arrow(cx, cy, 0, -f.P * k, { color: theme.text });
    d.text("P", cx + 0.1, cy - f.P * k, { size: 12, weight: "600" });
    d.arrow(cx, cy, nx * f.N * k, ny * f.N * k, { color: theme.accent });
    d.text("N", cx + nx * f.N * k + 0.1, cy + ny * f.N * k, { size: 12, weight: "600", color: theme.accent });
    if (Math.abs(f.f) > 1e-6) {
      d.arrow(cx - nx * h * 0.5, cy - ny * h * 0.5, ux * f.f * k, uy * f.f * k, { color: theme.positive });
      d.text("f", cx - nx * h * 0.5 + ux * f.f * k, cy - ny * h * 0.5 + uy * f.f * k - 0.12, { size: 12, weight: "600", color: theme.positive });
    }
    if (Math.abs(f.F) > 1e-6) {
      d.arrow(cx, cy, -ux * f.F * k, -uy * f.F * k, { color: theme.series[2] });
      d.text("F", cx - ux * f.F * k, cy - uy * f.F * k + 0.12, { size: 12, weight: "600", color: theme.series[2] });
    }
    if (num(p, "componentes", 1) > 0.5) {
      d.arrow(cx, cy, ux * f.Ppar * k, uy * f.Ppar * k, { color: theme.muted, dash: [4, 3], width: 1.5 });
      d.arrow(cx, cy, -nx * f.N * k, -ny * f.N * k, { color: theme.muted, dash: [4, 3], width: 1.5 });
    }
    d.text(f.sliding ? "deslizando" : "parado (atrito estático)", 3.4, 3.1, { color: f.sliding ? theme.positive : theme.muted, size: 13, weight: "600" });
  },
});

export default planoInclinado;
