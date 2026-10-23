import { defineSim, draw, num, texNum, type Params, type State } from "@fisilab/core";

// Estado: [θ (rad), ω (rad/s), t (s)] — o tempo vai no estado para os gráficos do palco.
const TH = 0, W = 1, T = 2;
export const T_END = 20;

/** Aceleração angular efetiva: zero no MCU. */
export const alphaOf = (p: Params) => (Math.round(num(p, "modo")) === 0 ? 0 : num(p, "alpha"));

export interface CircKin {
  x: number;
  y: number;
  /** Unitários polares. */
  rhat: [number, number];
  thhat: [number, number];
  v: number; // velocidade escalar (componente em θ̂), m/s
  ac: number; // aceleração centrípeta (módulo), m/s²
  at: number; // aceleração tangencial (componente em θ̂), m/s²
  a: number; // módulo da aceleração total
}

export function kin(s: State, p: Params): CircKin {
  const r = num(p, "r", 1.5);
  const th = s[TH]!, w = s[W]!;
  const c = Math.cos(th), sn = Math.sin(th);
  const ac = w * w * r;
  const at = alphaOf(p) * r;
  return { x: r * c, y: r * sn, rhat: [c, sn], thhat: [-sn, c], v: w * r, ac, at, a: Math.hypot(ac, at) };
}

/** Solução fechada do MCUV (para testes e exercícios). */
export function exact(p: Params, t: number) {
  const w0 = num(p, "omega0"), a = alphaOf(p);
  return { theta: w0 * t + 0.5 * a * t * t, omega: w0 + a * t };
}

const fmt = (v: number, d = 2) => (Math.abs(v) < 5e-4 ? "0" : String(Number(v.toFixed(d))).replace(".", ","));

export const movimentoCircular = defineSim({
  id: "movimento-circular",
  title: "Movimento circular: acelerações centrípeta e tangencial",
  course: "FG I",
  topic: "Cinemática 2D",
  priority: "P1",
  summary:
    "Uma partícula numa trajetória circular em MCU ou MCUV, com os unitários polares r̂ e θ̂ desenhados e a aceleração separada em centrípeta e tangencial. Mude α durante o movimento e acompanhe θ(t) e ω(t).",
  equations: [
    String.raw`\vec r = r\,\hat r \qquad \hat r = \cos\theta\,\hat\imath + \sin\theta\,\hat\jmath \qquad \hat\theta = -\sin\theta\,\hat\imath + \cos\theta\,\hat\jmath`,
    String.raw`\vec v = r\omega\,\hat\theta \qquad \vec a = -\omega^2 r\,\hat r + \alpha r\,\hat\theta`,
    String.raw`a_c = \frac{v^2}{r} = \omega^2 r \qquad a_t = \alpha r \qquad |\vec a| = \sqrt{a_c^2 + a_t^2}`,
    String.raw`\text{MCUV: } \theta = \theta_0 + \omega_0 t + \tfrac12 \alpha t^2 \qquad \omega = \omega_0 + \alpha t \qquad \text{MCU: } T = \frac{2\pi}{|\omega|}`,
  ],
  liveEquations(s, p) {
    const k = kin(s, p);
    const r = num(p, "r", 1.5);
    return [
      String.raw`\theta = ${texNum(s[TH]!)}\ \text{rad} \qquad \omega = ${texNum(s[W]!)}\ \text{rad/s} \qquad \alpha = ${texNum(alphaOf(p))}\ \text{rad/s}^2`,
      String.raw`a_c = \omega^2 r = (${texNum(s[W]!)})^2 \cdot ${texNum(r)} = ${texNum(k.ac)}\ \text{m/s}^2 \qquad a_t = \alpha r = ${texNum(k.at)}\ \text{m/s}^2`,
    ];
  },

  params: [
    {
      key: "modo",
      label: "Tipo de movimento",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 1,
      live: true,
      options: [
        { value: 0, label: "MCU (α = 0)" },
        { value: 1, label: "MCUV (α ajustável)" },
      ],
    },
    { key: "r", label: "Raio r", unit: "m", min: 0.5, max: 3, step: 0.1, default: 1.5, live: true },
    { key: "omega0", label: "Velocidade angular inicial ω₀", unit: "rad/s", min: -6, max: 6, step: 0.1, default: 1 },
    { key: "alpha", label: "Aceleração angular α", unit: "rad/s²", min: -3, max: 3, step: 0.05, default: 0.3, live: true },
  ],

  observables: [
    { key: "theta", label: "Ângulo θ", unit: "rad", value: (s) => s[TH]! },
    { key: "omega", label: "Velocidade angular ω", unit: "rad/s", value: (s) => s[W]! },
    { key: "alpha", label: "Aceleração angular α", unit: "rad/s²", value: (_s, p) => alphaOf(p) },
    { key: "v", label: "Velocidade (componente θ̂)", unit: "m/s", value: (s, p) => kin(s, p).v },
    { key: "ac", label: "Aceleração centrípeta a_c", unit: "m/s²", value: (s, p) => kin(s, p).ac },
    { key: "at", label: "Aceleração tangencial a_t", unit: "m/s²", value: (s, p) => kin(s, p).at },
    { key: "a", label: "Módulo da aceleração |a|", unit: "m/s²", value: (s, p) => kin(s, p).a },
    { key: "x", label: "Posição x", unit: "m", value: (s, p) => kin(s, p).x },
    { key: "y", label: "Posição y", unit: "m", value: (s, p) => kin(s, p).y },
    { key: "voltas", label: "Voltas completadas", unit: "", value: (s) => s[TH]! / (2 * Math.PI) },
  ],
  chart: { x: "t", y: "theta" },

  scenarios: [
    {
      id: "mcu",
      label: "MCU",
      params: { modo: 0, r: 1.5, omega0: 2 },
      guide: `### Velocidade escalar constante, mas há aceleração
1. Rode e observe: $\\vec v$ tem sempre o mesmo módulo, mas muda de direção.
2. A aceleração aponta para o centro ($-\\hat r$) e vale $\\omega^2 r$. Confira na tabela.
3. Meça o período no gráfico $\\theta(t)$ (θ cresce $2\\pi$ por volta) e compare com $T = 2\\pi/\\omega$.
4. Mude o raio durante o movimento: com ω fixo, $a_c$ cresce proporcionalmente a $r$.`,
      predict: [
        {
          question: "No MCU, a aceleração da partícula:",
          options: ["é nula, pois a velocidade escalar é constante", "aponta para o centro da circunferência", "é tangente à trajetória", "aponta para fora do círculo"],
          answer: 1,
          explanation:
            "O vetor velocidade muda de direção o tempo todo, então há aceleração. Sem $\\alpha$ não há componente tangencial: sobra $\\vec a = -\\omega^2 r\\,\\hat r$, a aceleração centrípeta.",
        },
      ],
    },
    {
      id: "partida",
      label: "MCUV partindo do repouso",
      params: { modo: 1, r: 1.5, omega0: 0, alpha: 0.5 },
      guide: `### A centrípeta cresce com t²
1. Partindo do repouso, $\\omega = \\alpha t$ e $a_t = \\alpha r$ é constante.
2. Já $a_c = \\omega^2 r = \\alpha^2 r t^2$ cresce com o quadrado do tempo. Use o gráfico de $a_c$ e de $a_t$ ("Comparar com").
3. Observe a aceleração total (tracejada): no início é quase tangente, depois aponta cada vez mais para o centro.
4. Em que instante $a_c = a_t$? Compare com $t = 1/\\sqrt{\\alpha}$.`,
      predict: [
        {
          question: "Partindo do repouso com α constante, logo no início a aceleração total aponta:",
          options: ["para o centro", "quase tangente à trajetória", "para fora do círculo"],
          answer: 1,
          explanation: "Com $\\omega \\approx 0$, $a_c = \\omega^2 r \\approx 0$; só resta $a_t = \\alpha r$, tangente à circunferência.",
        },
      ],
    },
    {
      id: "frenagem",
      label: "Freando e invertendo",
      params: { modo: 1, r: 2, omega0: 3, alpha: -0.6 },
      guide: `### Desacelerando
1. Com $\\omega > 0$ e $\\alpha < 0$, $a_t$ aponta contra o movimento: a partícula freia.
2. No gráfico $\\omega(t)$, ache o instante em que $\\omega = 0$ e compare com $t = \\omega_0/|\\alpha|$.
3. Nesse instante, quanto vale $a_c$? E $\\theta(t)$ tem que forma ali?
4. Depois a partícula gira no sentido oposto. Ajuste α para zero no meio do caminho e veja o movimento virar MCU.`,
    },
    {
      id: "ao-vivo",
      label: "Pedal ao vivo",
      params: { modo: 1, r: 1.2, omega0: 1.5, alpha: 0 },
      guide: `### α ajustado durante o movimento
1. Rode e mova o controle de α durante a simulação, como um pedal de acelerador e freio.
2. Observe que $a_t$ responde na hora a α, enquanto $a_c$ só muda conforme ω muda.
3. No gráfico $\\omega(t)$, a inclinação em cada trecho é o α daquele trecho.`,
    },
  ],

  exercises: [
    {
      id: "centripeta",
      prompt: "Uma partícula percorre uma circunferência de raio {r} m com velocidade angular constante de {omega0} rad/s. Qual é o módulo da sua aceleração?",
      vary: { r: [0.5, 3, 1], omega0: [0.5, 6, 1] },
      fixed: { modo: 0 },
      answer: { label: "a_c", unit: "m/s²", compute: (p) => num(p, "omega0") ** 2 * num(p, "r") },
      hint: "No MCU só existe a aceleração centrípeta, a_c = ω²r.",
    },
    {
      id: "mcuv-total",
      prompt:
        "Uma partícula parte do repouso numa circunferência de raio {r} m com aceleração angular constante de {alpha} rad/s². Qual é o módulo da aceleração total no instante t = {t} s?",
      vary: { r: [0.5, 3, 1], alpha: [0.2, 2, 1], t: [1, 4, 0] },
      fixed: { modo: 1, omega0: 0 },
      answer: {
        label: "|a|",
        unit: "m/s²",
        compute: (p) => {
          const r = num(p, "r"), a = num(p, "alpha"), w = a * num(p, "t");
          return Math.hypot(w * w * r, a * r);
        },
      },
      hint: "Calcule ω = αt, depois a_c = ω²r e a_t = αr; as duas são perpendiculares.",
    },
  ],

  init: (p) => [0, num(p, "omega0"), 0],
  derivatives: (s, p) => [s[W]!, alphaOf(p), 1],
  integrator: "rk4",
  dt: 1e-3,
  sampleEvery: 20,
  tEnd: T_END,

  narrowSplit: () => 0.541,
  viewport: (p) => {
    const r = num(p, "r", 1.5);
    return { xMin: -1.75 * r, xMax: 4.6 * r, yMin: -1.75 * r, yMax: 1.75 * r };
  },

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const { state: s, params: p, theme, trail } = frame;
    const r = num(p, "r", 1.5);
    const k = kin(s, p);
    const th = s[TH]!;

    // Trajetória, eixos e centro
    d.line(-1.6 * r, 0, 1.6 * r, 0, { color: theme.grid, width: 1 });
    d.line(0, -1.6 * r, 0, 1.6 * r, { color: theme.grid, width: 1 });
    d.text("x", 1.6 * r, 0, { color: theme.muted, size: 11, dx: -6, dy: 10 });
    d.text("y", 0, 1.6 * r, { color: theme.muted, size: 11, dx: 10, dy: 6 });
    d.circle(0, 0, r, { stroke: theme.muted, width: 1.5, dash: [6, 5] });
    d.dot(0, 0, 3, theme.text);

    // Rastro recente da partícula
    const recent = trail.slice(-60);
    recent.forEach((q, i) => {
      const a = q[TH]!;
      d.dot(r * Math.cos(a), r * Math.sin(a), 2.2, theme.accent, (0.5 * (i + 1)) / recent.length);
    });

    // Raio e ângulo θ
    d.line(0, 0, k.x, k.y, { color: theme.muted, width: 1.2 });
    const wrapped = ((th % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    const ra = 0.28 * r;
    const arc: [number, number][] = [];
    for (let i = 0; i <= 40; i++) {
      const a = (wrapped * i) / 40;
      arc.push([ra * Math.cos(a), ra * Math.sin(a)]);
    }
    d.polyline(arc, { color: theme.text, width: 1.2 });
    d.text("θ", 0.42 * r * Math.cos(wrapped / 2), 0.42 * r * Math.sin(wrapped / 2), { size: 12, color: theme.text });

    // Unitários polares (comprimento fixo em pixels)
    const U = 42;
    d.arrowPx(k.x, k.y, k.rhat[0], k.rhat[1], U, { color: theme.muted, width: 1.5 });
    d.arrowPx(k.x, k.y, k.thhat[0], k.thhat[1], U, { color: theme.muted, width: 1.5 });
    d.text("r̂", k.x + k.rhat[0] * (U + 10) * d.px, k.y + k.rhat[1] * (U + 10) * d.px, { color: theme.muted, size: 13, weight: "600" });
    d.text("θ̂", k.x + k.thhat[0] * (U + 10) * d.px, k.y + k.thhat[1] * (U + 10) * d.px, { color: theme.muted, size: 13, weight: "600" });

    // Velocidade (tangente)
    const kv = 80 / Math.max(Math.abs(k.v), 3);
    const vx = k.thhat[0] * k.v, vy = k.thhat[1] * k.v;
    if (Math.abs(k.v) > 1e-6) {
      d.arrowPx(k.x, k.y, vx, vy, Math.abs(k.v) * kv, { color: theme.accent, width: 2.5 });
      const L = Math.abs(k.v) * kv + 12;
      d.text("v", k.x + (vx / Math.abs(k.v)) * L * d.px, k.y + (vy / Math.abs(k.v)) * L * d.px, { color: theme.accent, size: 14, weight: "700" });
    }

    // Acelerações: mesma escala para a_c, a_t e a total
    const ka = 80 / Math.max(k.a, 4);
    const acx = -k.rhat[0] * k.ac, acy = -k.rhat[1] * k.ac;
    const atx = k.thhat[0] * k.at, aty = k.thhat[1] * k.at;
    const lab = (str: string, dx: number, dy: number, mag: number, color: string) => {
      if (mag < 1e-6) return;
      const L = mag * ka + 12;
      d.text(str, k.x + (dx / mag) * L * d.px, k.y + (dy / mag) * L * d.px, { color, size: 13, weight: "700" });
    };
    if (k.ac > 1e-6) d.arrowPx(k.x, k.y, acx, acy, k.ac * ka, { color: theme.positive, width: 2.5 });
    lab("a_c", acx, acy, k.ac, theme.positive);
    if (Math.abs(k.at) > 1e-6) d.arrowPx(k.x, k.y, atx, aty, Math.abs(k.at) * ka, { color: theme.series[2]!, width: 2.5 });
    lab("a_t", atx, aty, Math.abs(k.at), theme.series[2]!);
    if (k.ac > 1e-6 && Math.abs(k.at) > 1e-6) {
      const ax = acx + atx, ay = acy + aty;
      d.arrowPx(k.x, k.y, ax, ay, k.a * ka, { color: theme.text, width: 1.5, dash: [5, 4] });
      lab("a", ax, ay, k.a, theme.text);
      // retângulo das componentes
      const px = d.px * ka;
      d.line(k.x + acx * px, k.y + acy * px, k.x + (acx + atx) * px, k.y + (acy + aty) * px, { color: theme.muted, width: 1, dash: [2, 3] });
      d.line(k.x + atx * px, k.y + aty * px, k.x + (acx + atx) * px, k.y + (acy + aty) * px, { color: theme.muted, width: 1, dash: [2, 3] });
    }

    d.circle(k.x, k.y, 0.07 * r, { fill: theme.series[1]!, minPx: 7 });

    // Mini gráficos θ(t) e ω(t) a partir do rastro
    const gx0 = 1.95 * r, gx1 = 4.45 * r;
    const plots: { key: number; name: string; unit: string; y0: number; y1: number; color: string }[] = [
      { key: TH, name: "θ(t)", unit: "rad", y0: 0.2 * r, y1: 1.55 * r, color: theme.accent },
      { key: W, name: "ω(t)", unit: "rad/s", y0: -1.55 * r, y1: -0.2 * r, color: theme.series[1]! },
    ];
    const tNow = s[T]!;
    const tMax = Math.max(5, Math.ceil(tNow / 5) * 5);
    for (const g of plots) {
      const vals = trail.map((q) => q[g.key]!).concat([s[g.key]!]);
      let lo = Math.min(0, ...vals), hi = Math.max(0, ...vals);
      if (hi - lo < 1e-6) {
        hi += 1;
        lo -= 1;
      }
      const pad = 0.08 * (hi - lo);
      lo -= pad;
      hi += pad;
      const X = (t: number) => gx0 + ((gx1 - gx0) * t) / tMax;
      const Y = (v: number) => g.y0 + ((g.y1 - g.y0) * (v - lo)) / (hi - lo);
      d.rect(gx0, g.y0, gx1 - gx0, g.y1 - g.y0, { stroke: theme.grid, width: 1 });
      d.line(gx0, Y(0), gx1, Y(0), { color: theme.muted, width: 1 });
      const pts: [number, number][] = trail.map((q) => [X(q[T]!), Y(q[g.key]!)]);
      pts.push([X(tNow), Y(s[g.key]!)]);
      d.polyline(pts, { color: g.color, width: 2 });
      d.dot(X(tNow), Y(s[g.key]!), 3, g.color);
      d.text(`${g.name}  (${g.unit})`, gx0, g.y1, { align: "left", size: 11, color: g.color, weight: "600", dx: 4, dy: 9 });
      d.text(fmt(hi, 1), gx0, Y(hi), { align: "right", size: 9, color: theme.muted, dx: -3 });
      d.text(fmt(lo, 1), gx0, Y(lo), { align: "right", size: 9, color: theme.muted, dx: -3 });
      d.text(`${tMax} s`, gx1, g.y0, { align: "right", size: 9, color: theme.muted, dy: 8 });
    }

    // Legenda
    const mcu = Math.round(num(p, "modo")) === 0;
    d.text(mcu ? "MCU" : "MCUV", -1.7 * r, 1.65 * r, { align: "left", size: 14, weight: "700" });
    d.text(`a_c = ${fmt(k.ac)} m/s²   a_t = ${fmt(k.at)} m/s²`, -1.7 * r, -1.62 * r, { align: "left", size: 11, color: theme.text });
  },
});

export default movimentoCircular;
