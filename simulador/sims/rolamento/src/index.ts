import { defineSim, draw, num, rad, texNum, type Params, type State } from "@fisilab/core";

const G = 9.81;
/** Valores por raia no estado: posição s, velocidade v, ângulo φ, ω, instante de chegada. */
const NV = 5;

export interface Lane {
  name: string;
  /** k = I/(mR²). */
  k: number;
  m: number;
  R: number;
  /** Bloco que desliza sem atrito (referência). */
  block?: boolean;
  kLabel: string;
}

const CIL: Lane = { name: "Cilindro maciço", k: 1 / 2, m: 1, R: 0.1, kLabel: "1/2" };
const ESF: Lane = { name: "Esfera maciça", k: 2 / 5, m: 1, R: 0.1, kLabel: "2/5" };
const ANEL: Lane = { name: "Anel (cilindro oco)", k: 1, m: 1, R: 0.1, kLabel: "1" };
const CASCA: Lane = { name: "Casca esférica", k: 2 / 3, m: 1, R: 0.1, kLabel: "2/3" };
const BLOCO: Lane = { name: "Bloco sem atrito", k: 0, m: 1, R: 0.1, block: true, kLabel: "0" };

export const LANE_SETS: Lane[][] = [
  [CIL, ESF, ANEL],
  [BLOCO, ESF, CIL, CASCA, ANEL],
  [
    { ...CIL, name: "Cilindro 0,5 kg, R = 5 cm", m: 0.5, R: 0.05 },
    { ...CIL, name: "Cilindro 5 kg, R = 15 cm", m: 5, R: 0.15 },
    { ...ANEL, name: "Anel 5 kg, R = 15 cm", m: 5, R: 0.15 },
  ],
];

export const lanes = (p: Params): Lane[] => LANE_SETS[Math.round(num(p, "conjunto"))] ?? LANE_SETS[0]!;

/** Menor μ que permite rolar sem deslizar: μ ≥ k/(1+k) · tg θ. */
export const muMin = (k: number, thDeg: number) => (k / (1 + k)) * Math.tan(rad(thDeg));

export interface LaneDyn {
  a: number;
  alpha: number;
  rolling: boolean;
  /** Atrito, positivo rampa acima. */
  f: number;
}

/** Acelerações de uma raia a partir de v e ω. */
export function laneDyn(lane: Lane, v: number, w: number, p: Params): LaneDyn {
  const th = rad(num(p, "angulo", 20));
  const mu = num(p, "mu", 0.5);
  const gs = G * Math.sin(th);
  if (lane.block) return { a: gs, alpha: 0, rolling: false, f: 0 };
  const N = lane.m * G * Math.cos(th);
  const u = v - w * lane.R;
  const fRoll = (lane.m * gs * lane.k) / (1 + lane.k);
  if (Math.abs(u) < 1e-9 && fRoll <= mu * N + 1e-12) {
    const a = gs / (1 + lane.k);
    return { a, alpha: a / lane.R, rolling: true, f: fRoll };
  }
  const f = mu * N * (u >= 0 ? 1 : -1);
  return { a: gs - f / lane.m, alpha: f / (lane.k * lane.m * lane.R), rolling: false, f };
}

const get = (s: State, i: number, j: number) => s[i * NV + j]!;

function laneStep(lane: Lane, s: State, i: number, p: Params, t: number, dt: number, L: number): number[] {
  let x = get(s, i, 0), v = get(s, i, 1), ph = get(s, i, 2), w = get(s, i, 3);
  const tf = get(s, i, 4);
  if (x >= L) return [x, v, ph, w, tf];
  const d = laneDyn(lane, v, w, p);
  let h = dt;
  const xn = x + v * dt + 0.5 * d.a * dt * dt;
  let fin = tf;
  if (xn >= L) {
    h = d.a > 0 ? (-v + Math.sqrt(v * v + 2 * d.a * (L - x))) / d.a : (L - x) / Math.max(v, 1e-12);
    fin = t + h;
  }
  x = fin >= 0 ? L : Math.min(L, x + v * h + 0.5 * d.a * h * h);
  ph += w * h + 0.5 * d.alpha * h * h;
  const v1 = v + d.a * h;
  let w1 = w + d.alpha * h;
  // Deslizando, a velocidade de escorregamento pode se anular dentro do passo: passa a rolar.
  if (!d.rolling && !lane.block && (v - w * lane.R) * (v1 - w1 * lane.R) < 0) w1 = v1 / lane.R;
  v = v1;
  w = w1;
  if (fin < 0 && x >= L) fin = t + h;
  return [x, v, ph, w, fin];
}

const focus = (p: Params) => Math.min(lanes(p).length, Math.max(1, Math.round(num(p, "foco", 1)))) - 1;

function focusVals(s: State, p: Params) {
  const i = focus(p);
  const lane = lanes(p)[i]!;
  const th = rad(num(p, "angulo", 20));
  const L = num(p, "L", 2);
  const x = get(s, i, 0), v = get(s, i, 1), w = get(s, i, 3);
  const Kt = 0.5 * lane.m * v * v;
  const Kr = lane.block ? 0 : 0.5 * lane.k * lane.m * lane.R * lane.R * w * w;
  const U = lane.m * G * (L - x) * Math.sin(th);
  return { i, lane, x, v, w, Kt, Kr, U, E: Kt + Kr + U, d: laneDyn(lane, v, w, p), tf: get(s, i, 4) };
}

const fmt = (v: number, n = 2) => v.toFixed(n).replace(".", ",");

export const rolamento = defineSim({
  id: "rolamento",
  title: "Rolamento no plano inclinado",
  course: "FG I",
  topic: "Rotação",
  priority: "P1",
  summary:
    "Corrida de cilindro, esfera, anel e outros corpos rampa abaixo, cada um na sua raia. Preveja o vencedor, veja por que a = g sen θ/(1 + I/mR²) e o que acontece quando o atrito não basta para rolar.",
  equations: [
    String.raw`a = \frac{g\sin\theta}{1 + I/(mR^2)} \qquad v = \omega R \ \text{(rolamento sem deslizar)}`,
    String.raw`f = \frac{k}{1+k}\, mg\sin\theta \le \mu\, mg\cos\theta \;\Rightarrow\; \mu_{\min} = \frac{k}{1+k}\tan\theta, \quad k = \frac{I}{mR^2}`,
    String.raw`\text{deslizando: } a = g(\sin\theta - \mu\cos\theta), \quad \alpha = \frac{\mu m g R\cos\theta}{I}`,
    String.raw`mgh = \tfrac12 mv^2 + \tfrac12 I\omega^2 \ \text{(rolando sem deslizar)}`,
  ],
  liveEquations(s, p) {
    const f = focusVals(s, p);
    const th = num(p, "angulo", 20);
    return [
      String.raw`\text{${f.lane.name}: } k = ${texNum(f.lane.k)},\ a = ${texNum(f.d.a)}\ \text{m/s}^2,\ \mu_{\min} = ${f.lane.block ? "0" : texNum(muMin(f.lane.k, th))}`,
      String.raw`K_{trans} = ${texNum(f.Kt)}\ \text{J} \quad K_{rot} = ${texNum(f.Kr)}\ \text{J} \quad v - \omega R = ${texNum(f.v - f.w * f.lane.R)}\ \text{m/s}`,
    ];
  },

  params: [
    {
      key: "conjunto",
      label: "Corpos na corrida",
      unit: "",
      min: 0,
      max: 2,
      step: 1,
      default: 0,
      options: [
        { value: 0, label: "Cilindro, esfera e anel" },
        { value: 1, label: "Cinco corpos + bloco sem atrito" },
        { value: 2, label: "Cilindros de massas e raios diferentes" },
      ],
    },
    { key: "angulo", label: "Inclinação θ", unit: "°", min: 3, max: 60, step: 0.5, default: 20 },
    { key: "L", label: "Comprimento da rampa", unit: "m", min: 1, max: 5, step: 0.1, default: 2 },
    { key: "mu", label: "Coeficiente de atrito μ (estático = cinético)", unit: "", min: 0, max: 1, step: 0.01, default: 0.5 },
    { key: "foco", label: "Raia em foco (gráficos e energia)", unit: "", min: 1, max: 5, step: 1, default: 1, live: true },
  ],

  observables: [
    { key: "s", label: "Posição na rampa (foco)", unit: "m", value: (s, p) => focusVals(s, p).x },
    { key: "v", label: "Velocidade do centro (foco)", unit: "m/s", value: (s, p) => focusVals(s, p).v },
    { key: "omega", label: "Velocidade angular (foco)", unit: "rad/s", value: (s, p) => focusVals(s, p).w },
    { key: "a", label: "Aceleração (foco)", unit: "m/s²", value: (s, p) => (focusVals(s, p).x >= num(p, "L", 2) ? 0 : focusVals(s, p).d.a) },
    { key: "slip", label: "Escorregamento v − ωR (foco)", unit: "m/s", value: (s, p) => { const f = focusVals(s, p); return f.lane.block ? f.v : f.v - f.w * f.lane.R; } },
    { key: "Kt", label: "Energia cinética de translação (foco)", unit: "J", value: (s, p) => focusVals(s, p).Kt },
    { key: "Kr", label: "Energia cinética de rotação (foco)", unit: "J", value: (s, p) => focusVals(s, p).Kr },
    { key: "E", label: "Energia mecânica (foco)", unit: "J", value: (s, p) => focusVals(s, p).E },
    ...[1, 2, 3, 4, 5].map((n) => ({
      key: `s${n}`,
      label: `Posição na raia ${n}`,
      unit: "m",
      value: (s: State) => s[(n - 1) * NV] ?? 0,
    })),
  ],
  conserved: "E",
  chart: { x: "t", y: "v" },

  scenarios: [
    {
      id: "corrida",
      label: "Corrida: cilindro, esfera, anel",
      params: { conjunto: 0, angulo: 20, L: 2, mu: 0.5, foco: 1 },
      guide: `### Quem chega primeiro?
1. Responda a previsão antes de soltar.
2. Rode e compare os tempos de chegada com $t = \\sqrt{2L(1+k)/(g\\sin\\theta)}$.
3. Na raia em foco, compare $K_{trans}$ e $K_{rot}$: que fração da energia vai para a rotação? (Resposta: $k/(1+k)$.)`,
      predict: [
        {
          question: "Cilindro maciço, esfera maciça e anel, de mesma massa e mesmo raio, são soltos juntos. Quem chega primeiro?",
          options: ["o cilindro", "a esfera", "o anel", "chegam juntos"],
          answer: 1,
          explanation: "A aceleração é $g\\sin\\theta/(1+k)$ com $k = I/mR^2$. A esfera tem o menor $k$ (2/5): gasta menos energia girando e sobra mais para a translação.",
        },
      ],
    },
    {
      id: "tamanhos",
      label: "Massa e raio importam?",
      params: { conjunto: 2, angulo: 20, L: 2, mu: 0.5, foco: 1 },
      guide: `### Só a forma importa
1. Um cilindro pequeno e leve corre contra um grande e pesado. Preveja e rode.
2. Mostre, a partir de $a = g\\sin\\theta/(1+k)$, que nem $m$ nem $R$ aparecem.
3. Por que o anel grande perde dos dois cilindros?`,
      predict: [
        {
          question: "Um cilindro maciço pequeno (0,5 kg) e um grande (5 kg, raio 3 vezes maior) rolam sem deslizar. Quem vence?",
          options: ["o pequeno", "o grande", "empate"],
          answer: 2,
          explanation: "Para todo cilindro maciço $k = 1/2$, então $a = \\tfrac23 g\\sin\\theta$: massa e raio se cancelam.",
        },
      ],
    },
    {
      id: "desliza",
      label: "Atrito insuficiente",
      params: { conjunto: 0, angulo: 50, L: 3, mu: 0.1, foco: 3 },
      guide: `### Rolar exige atrito
1. Com $\\theta = 50^\\circ$, o anel precisaria de $\\mu \\ge \\tfrac12\\tan\\theta \\approx 0{,}60$. Aqui $\\mu = 0{,}1$.
2. Rode: todos deslizam (veja $v - \\omega R > 0$) e a aceleração vira $g(\\sin\\theta - \\mu\\cos\\theta)$ para todos.
3. Observe que a energia mecânica da raia em foco **diminui**: o atrito cinético dissipa energia.
4. Aumente $\\mu$ aos poucos (reiniciando) e descubra a partir de que valor cada corpo passa a rolar.`,
      predict: [
        {
          question: "Com atrito muito pequeno, cilindro, esfera e anel deslizam enquanto giram. Quem chega primeiro?",
          options: ["a esfera", "o anel", "empate", "o cilindro"],
          answer: 2,
          explanation: "Deslizando, a força de atrito é $\\mu mg\\cos\\theta$ para todos, e a aceleração do centro $g(\\sin\\theta - \\mu\\cos\\theta)$ não depende de $I$. A forma só muda quanto cada um gira.",
        },
      ],
    },
    {
      id: "todos",
      label: "Cinco corpos",
      params: { conjunto: 1, angulo: 15, L: 3, mu: 0.6, foco: 1 },
      guide: `### Ordem de chegada pela inércia
1. Ordene os corpos pelo valor de $k = I/mR^2$ e preveja a classificação.
2. O bloco sem atrito ($k = 0$) é o limite: toda a energia vira translação.
3. Mude a raia em foco e compare a energia de rotação de cada um no fim da rampa.`,
    },
  ],

  exercises: [
    {
      id: "tempo-esfera",
      prompt: "Uma esfera maciça é solta do repouso no topo de uma rampa de {L} m inclinada de {angulo}° e rola sem deslizar. Quanto tempo leva para chegar ao fim? (g = 9,81 m/s²)",
      vary: { L: [1, 5, 1], angulo: [10, 40, 0] },
      fixed: { conjunto: 0, mu: 1 },
      answer: {
        label: "t",
        unit: "s",
        compute: (p) => Math.sqrt((2 * num(p, "L") * (1 + 0.4)) / (G * Math.sin(rad(num(p, "angulo"))))),
      },
      hint: "a = g sen θ/(1 + 2/5) e L = at²/2.",
    },
    {
      id: "mu-min",
      prompt: "Qual é o menor coeficiente de atrito estático que permite a um cilindro maciço rolar sem deslizar numa rampa de {angulo}°?",
      vary: { angulo: [10, 60, 0] },
      answer: { label: "μ_min", unit: "", compute: (p) => muMin(0.5, num(p, "angulo")) },
      hint: "Combine ma = mg sen θ − f e (I/R) α = f com a = αR.",
    },
  ],

  init(p) {
    return lanes(p).flatMap(() => [0, 0, 0, 0, -1]);
  },
  step(s, p, t, dt) {
    const L = num(p, "L", 2);
    return lanes(p).flatMap((lane, i) => laneStep(lane, s, i, p, t, dt, L));
  },
  dt: 1e-3,
  sampleEvery: 10,
  tEnd: 60,
  stopWhen(s, p) {
    const L = num(p, "L", 2);
    let m = Infinity;
    for (let i = 0; i < lanes(p).length; i++) m = Math.min(m, get(s, i, 0));
    return L - m;
  },

  viewport(p) {
    const L = num(p, "L", 2), th = rad(num(p, "angulo", 20));
    const n = lanes(p).length;
    const gap = (0.16 * L) / Math.cos(th);
    return { xMin: -0.05 * L, xMax: L * Math.cos(th) + 0.75 * L, yMin: -0.08 * L, yMax: L * Math.sin(th) + (n - 1) * gap + 0.14 * L };
  },

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const { state: s, params: p, theme } = frame;
    const L = num(p, "L", 2), thDeg = num(p, "angulo", 20), th = rad(thDeg);
    const ls = lanes(p);
    const n = ls.length;
    const gap = (0.16 * L) / Math.cos(th);
    const H = L * Math.sin(th), B = L * Math.cos(th);
    const ux = Math.cos(th), uy = -Math.sin(th);
    const nx = Math.sin(th), ny = Math.cos(th);
    const fi = focus(p);

    // Ordem de chegada
    const order = ls
      .map((_, i) => ({ i, tf: get(s, i, 4) }))
      .filter((o) => o.tf >= 0)
      .sort((a, b) => a.tf - b.tf);

    ls.forEach((lane, i) => {
      const y0 = (n - 1 - i) * gap;
      const col = theme.series[i % theme.series.length]!;
      // Rampa da raia
      const sd = 0.035 * L;
      d.polyline([[0, y0 + H], [B, y0], [B, y0 - sd], [0, y0 + H - sd]], { color: "none", fill: theme.ground, close: true });
      d.line(0, y0 + H, B, y0, { color: theme.text, width: i === fi ? 2.5 : 1.5 });
      // Linha de chegada
      d.line(B, y0, B + nx * 0.06 * L, y0 + ny * 0.06 * L, { color: theme.positive, width: 2 });

      const x = get(s, i, 0), v = get(s, i, 1), ph = get(s, i, 2), w = get(s, i, 3);
      const rv = Math.min(0.06 * L, 0.035 * L * (lane.R / 0.1));
      const px = x * ux + nx * rv, py = y0 + H + x * uy + ny * rv;
      if (lane.block) {
        d.box(px - nx * rv * 0.3, py - ny * rv * 0.3, rv * 1.6, rv * 1.4, -th, { fill: col, stroke: theme.text, width: 1 });
      } else {
        const hollow = lane.k >= 2 / 3;
        if (hollow) d.circle(px, py, rv, { stroke: col, width: 4 });
        else d.circle(px, py, rv, { fill: col, stroke: theme.text, width: 1 });
        // Marca de rotação (gira no sentido horário ao descer para a direita)
        const a = -ph;
        d.line(px, py, px + rv * Math.cos(a), py + rv * Math.sin(a), { color: hollow ? col : theme.dark ? "#111" : "#fff", width: 2 });
        if (lane.k === 2 / 3 || lane.k === 2 / 5) d.circle(px, py, rv * 0.55, { stroke: hollow ? col : theme.dark ? "#111" : "#fff", width: 1, alpha: 0.6 });
        const slip = v - w * lane.R;
        if (slip > 1e-3 && x < L) d.text("desliza", px, py, { dy: -rv / d.px - 10, size: 10, color: theme.positive, weight: "600" });
      }
      if (v > 1e-3) d.arrowPx(px, py, ux, uy, Math.min(60, 10 + v * 12), { color: theme.accent, width: 1.5, head: 7 });

      // Rótulo à direita
      const tf = get(s, i, 4);
      const rank = order.findIndex((o) => o.i === i);
      const label = `${i + 1}. ${lane.name}  (k = ${lane.kLabel})`;
      const lx = B + 0.1 * L;
      d.text(label, lx, y0 + 0.07 * L, { align: "left", size: 11, color: col, weight: i === fi ? "700" : "500" });
      d.text(tf >= 0 ? `${rank + 1}º lugar: t = ${fmt(tf, 3)} s` : `s = ${fmt(x)} m   v = ${fmt(v)} m/s`, lx, y0 + 0.07 * L, {
        align: "left",
        dy: 14,
        size: 11,
        color: tf >= 0 ? theme.text : theme.muted,
      });
    });

    // Ângulo na raia de baixo
    const arc: [number, number][] = [];
    for (let k = 0; k <= 16; k++) arc.push([B - 0.18 * L * Math.cos((th * k) / 16), 0.18 * L * Math.sin((th * k) / 16)]);
    d.polyline(arc, { color: theme.muted });
    d.text(`${fmt(thDeg, 1)}°`, B - 0.25 * L, 0.04 * L, { color: theme.muted, size: 11, align: "right" });
    d.text(`μ = ${fmt(num(p, "mu", 0.5))}`, -0.03 * L, -0.045 * L, { color: theme.muted, size: 11, align: "left" });
  },
});

export default rolamento;
