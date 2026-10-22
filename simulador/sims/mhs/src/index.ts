import { defineSim, draw, num, texNum, type Params, type State } from "@fisilab/core";

// Estado: [x, v, θ (pêndulo), θ̇, segurando (1 enquanto o aluno arrasta o fasor)]
const X = 0, V = 1, TH = 2, W = 3, HOLD = 4;
const G = 9.81;
const DEG = Math.PI / 180;

export const omega = (p: Params) => Math.sqrt(num(p, "k", 40) / num(p, "m", 1));
/** Comprimento do pêndulo simples com a mesma frequência angular: L = g/ω² = mg/k. */
export const pendulumLength = (p: Params) => G / omega(p) ** 2;

/** Ângulo de fase atual α = ωt + φ obtido do estado (x = A cos α, v = −Aω sen α). */
export function phaseOf(s: State, p: Params): number {
  return Math.atan2(-s[V]! / omega(p), s[X]!);
}
export const amplitudeOf = (s: State, p: Params) => Math.hypot(s[X]!, s[V]! / omega(p));

/** Estado a partir de um ângulo de fase, mantendo a amplitude. */
function atPhase(s: State, p: Params, alpha: number, hold: number): State {
  const A = num(p, "A", 0.25), w = omega(p), thA = num(p, "thetaA", 10) * DEG;
  const next = s.slice();
  next[X] = A * Math.cos(alpha);
  next[V] = -A * w * Math.sin(alpha);
  next[TH] = thA * Math.cos(alpha);
  next[W] = -thA * w * Math.sin(alpha);
  next[HOLD] = hold;
  return next;
}

const isVertical = (p: Params) => Math.round(num(p, "modo")) === 1;

/** Geometria do palco na vista horizontal (coordenadas do mundo, em metros). */
const H_LAYOUT = { cx: 0, cy: 0.55, wall: -0.72, blockY: 0, traceTop: -0.17, traceBottom: -0.88 };

/** Geometria da vista vertical: teto em y = 0, mola em x = 0, pêndulo em x = xp. */
function vLayout(p: Params) {
  const A = num(p, "A", 0.25);
  const L = pendulumLength(p);
  const dl = (num(p, "m", 1) * G) / num(p, "k", 40);
  const l0 = Math.max(0.12, 0.4 * dl);
  const ye = -(l0 + dl);
  const H = Math.max(-ye + A + 0.12, L + 0.12, 2 * A + 0.25);
  const thA = num(p, "thetaA", 10) * DEG;
  const gap = 0.12 * H;
  const xp = 0.42 * H + L * Math.sin(thA);
  return { cx: -(gap + A + 0.04 * H), cy: ye, l0, dl, ye, H, L, xp };
}

const center = (p: Params) => (isVertical(p) ? vLayout(p) : H_LAYOUT);

function phasors(d: ReturnType<typeof draw>, s: State, p: Params, cx: number, cy: number, vertical: boolean) {
  const { theme } = d;
  const A = num(p, "A", 0.25);
  const alpha = phaseOf(s, p);
  const Ad = amplitudeOf(s, p);
  // Na vista horizontal o fasor é medido a partir do eixo +x; na vertical, a partir do eixo +y.
  const tip = (r: number, a: number): [number, number] =>
    vertical ? [cx - r * Math.sin(a), cy + r * Math.cos(a)] : [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  d.circle(cx, cy, A, { stroke: theme.muted, width: 1.2, dash: [5, 4] });
  if (vertical) d.line(cx, cy - A * 1.15, cx, cy + A * 1.15, { color: theme.grid });
  else d.line(cx - A * 1.15, cy, cx + A * 1.15, cy, { color: theme.grid });
  d.dot(cx, cy, 3, theme.muted);

  // Arco do ângulo de fase
  const arc: [number, number][] = [];
  const a0 = ((alpha % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  for (let i = 0; i <= 40; i++) arc.push(tip(A * 0.22, (a0 * i) / 40));
  d.polyline(arc, { color: theme.series[4], width: 1.5 });
  const [lx, ly] = tip(A * 0.42, a0 / 2);
  d.text("ωt+φ", lx, ly, { color: theme.series[4], size: 11 });

  if (num(p, "fasores", 1) > 0.5) {
    // Fasores de velocidade (adiantado 90°) e aceleração (adiantado 180°), escalados por 1/ω e 1/ω²
    const [vx, vy] = tip(Ad, alpha + Math.PI / 2);
    const [ax, ay] = tip(Ad, alpha + Math.PI);
    d.arrow(cx, cy, (vx - cx) * 0.8, (vy - cy) * 0.8, { color: theme.series[2], width: 1.8 });
    d.text("v/ω", cx + (vx - cx) * 0.95, cy + (vy - cy) * 0.95, { color: theme.series[2], size: 11, weight: "600" });
    d.arrow(cx, cy, (ax - cx) * 0.6, (ay - cy) * 0.6, { color: theme.positive, width: 1.8 });
    d.text("a/ω²", cx + (ax - cx) * 0.75, cy + (ay - cy) * 0.75, { color: theme.positive, size: 11, weight: "600" });
  }
  const [px, py] = tip(Ad, alpha);
  d.arrow(cx, cy, px - cx, py - cy, { color: theme.accent, width: 2.5 });
  d.dot(px, py, 6, theme.accent);
  if (s[HOLD]! > 0.5) d.circle(px, py, 0, { stroke: theme.accent, minPx: 11, width: 1.5 });
  return { px, py };
}

export const mhs = defineSim({
  id: "mhs",
  title: "MHS: massa-mola, pêndulo e círculo de referência",
  course: "FG II",
  topic: "MHS",
  priority: "P1",
  summary:
    "O movimento harmônico simples como a projeção de um fasor que gira com velocidade angular ω. Ajuste a fase inicial, arraste o fasor e compare a mola vertical com o pêndulo de mesma frequência.",
  equations: [
    String.raw`x(t) = A\cos(\omega t + \varphi) \qquad \omega = \sqrt{k/m} \qquad T = \frac{2\pi}{\omega}`,
    String.raw`v = -A\omega\sin(\omega t+\varphi) = A\omega\cos\!\left(\omega t+\varphi+\tfrac{\pi}{2}\right) \qquad a = -\omega^2 x`,
    String.raw`A = \sqrt{x_0^2 + (v_0/\omega)^2} \qquad \tan\varphi = -\frac{v_0}{\omega x_0}`,
    String.raw`\text{pêndulo: } \omega = \sqrt{g/L} \;\Rightarrow\; L = \frac{g}{\omega^2} = \frac{mg}{k} = \Delta\ell_{\text{eq}}`,
  ],
  liveEquations(s, p) {
    const w = omega(p);
    const alpha = (phaseOf(s, p) / DEG + 360) % 360;
    const out = [
      String.raw`\omega = ${texNum(w)}\ \text{rad/s} \qquad T = ${texNum((2 * Math.PI) / w)}\ \text{s} \qquad \omega t + \varphi = ${texNum(alpha)}^\circ`,
      String.raw`x = ${texNum(num(p, "A", 0.25))}\cos(${texNum(alpha)}^\circ) = ${texNum(s[X]!)}\ \text{m}`,
    ];
    if (isVertical(p)) out.push(String.raw`L = mg/k = ${texNum(pendulumLength(p))}\ \text{m}`);
    return out;
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
        { value: 0, label: "Mola horizontal e círculo de referência" },
        { value: 1, label: "Mola vertical × pêndulo de mesmo ω" },
      ],
    },
    { key: "m", label: "Massa", unit: "kg", min: 0.2, max: 5, step: 0.1, default: 1 },
    { key: "k", label: "Constante da mola k", unit: "N/m", min: 10, max: 200, step: 1, default: 40 },
    { key: "A", label: "Amplitude A", unit: "m", min: 0.05, max: 0.4, step: 0.01, default: 0.25 },
    { key: "phi", label: "Fase inicial φ", unit: "°", min: -180, max: 180, step: 5, default: 0 },
    { key: "thetaA", label: "Amplitude do pêndulo", unit: "°", min: 2, max: 60, step: 1, default: 10 },
    {
      key: "fasores",
      label: "Fasores de v e a",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 1,
      live: true,
      options: [
        { value: 1, label: "Mostrar" },
        { value: 0, label: "Esconder" },
      ],
    },
  ],

  observables: [
    { key: "x", label: "Posição x", unit: "m", value: (s) => s[X]! },
    { key: "v", label: "Velocidade v", unit: "m/s", value: (s) => s[V]! },
    { key: "a", label: "Aceleração a", unit: "m/s²", value: (s, p) => -(omega(p) ** 2) * s[X]! },
    { key: "fase", label: "Fase ωt + φ (0 a 360°)", unit: "°", value: (s, p) => (phaseOf(s, p) / DEG + 360) % 360 },
    { key: "K", label: "Energia cinética", unit: "J", value: (s, p) => 0.5 * num(p, "m", 1) * s[V]! ** 2 },
    { key: "U", label: "Energia potencial elástica", unit: "J", value: (s, p) => 0.5 * num(p, "k", 40) * s[X]! ** 2 },
    { key: "E", label: "Energia mecânica", unit: "J", value: (s, p) => 0.5 * num(p, "m", 1) * s[V]! ** 2 + 0.5 * num(p, "k", 40) * s[X]! ** 2 },
    { key: "theta", label: "Ângulo do pêndulo θ", unit: "°", value: (s) => s[TH]! / DEG },
    { key: "T", label: "Período", unit: "s", value: (_s, p) => (2 * Math.PI) / omega(p) },
    { key: "L", label: "Comprimento do pêndulo de mesmo ω", unit: "m", value: (_s, p) => pendulumLength(p) },
  ],
  conserved: "E",
  chart: { x: "t", y: "x" },

  scenarios: [
    {
      id: "circulo",
      label: "Círculo de referência",
      params: { modo: 0, m: 1, k: 40, A: 0.25, phi: 0, fasores: 0 },
      guide: `### O MHS é a sombra de um movimento circular
1. O fasor azul gira no sentido anti-horário com velocidade angular constante $\\omega = \\sqrt{k/m}$.
2. A linha tracejada projeta a ponta do fasor no eixo $x$: o bloco está **sempre** embaixo dela, $x = A\\cos(\\omega t + \\varphi)$.
3. A faixa de baixo desenha $x$ ao longo do tempo (o tempo cresce para baixo): é a senoide gerada pela projeção.
4. Pause e **arraste a ponta do fasor** para escolher outra fase. Solte e veja o bloco continuar dali.`,
      predict: [
        {
          question: "Quadruplicando a massa (mesma mola), o fasor passa a girar:",
          options: ["4 vezes mais devagar", "2 vezes mais devagar", "com a mesma rapidez"],
          answer: 1,
          explanation: "$\\omega = \\sqrt{k/m}$: com $4m$ a frequência angular cai pela metade e o período dobra.",
        },
      ],
    },
    {
      id: "fase",
      label: "Fase inicial φ = 90°",
      params: { modo: 0, m: 1, k: 40, A: 0.25, phi: 90, fasores: 1 },
      guide: `### O que a fase inicial significa
1. Com $\\varphi = 90^\\circ$, em $t = 0$ o fasor aponta para cima: $x(0) = A\\cos 90^\\circ = 0$.
2. A velocidade é a projeção do fasor verde, adiantado $90^\\circ$: $v(0) = -A\\omega$.
3. A aceleração (vermelho) fica sempre oposta à posição: $a = -\\omega^2 x$.
4. Teste $\\varphi = 180^\\circ$ e $\\varphi = -90^\\circ$ e descreva onde o bloco começa e para onde vai.`,
      predict: [
        {
          question: "Com φ = 90°, no instante t = 0 o bloco está:",
          options: ["em x = A, parado", "em x = 0, movendo-se no sentido −x", "em x = 0, movendo-se no sentido +x"],
          answer: 1,
          explanation: "$x(0) = A\\cos 90^\\circ = 0$ e $v(0) = -A\\omega\\sin 90^\\circ = -A\\omega$: passa pelo equilíbrio com a velocidade máxima, para a esquerda.",
        },
      ],
    },
    {
      id: "comparacao",
      label: "Mola vertical × pêndulo",
      params: { modo: 1, m: 1, k: 40, A: 0.15, phi: 0, thetaA: 10, fasores: 0 },
      guide: `### Mesma frequência, mecanismos diferentes
1. Na mola vertical, o peso só desloca o equilíbrio para $\\Delta\\ell = mg/k$; a oscilação em torno dele tem $\\omega = \\sqrt{k/m}$.
2. O pêndulo ao lado tem $L = g/\\omega^2$, que é **exatamente** o alongamento $\\Delta\\ell$ da mola no equilíbrio.
3. Com $\\theta$ pequeno os dois andam juntos. Aumente a **amplitude do pêndulo** para 50° e veja ele se atrasar: o MHS do pêndulo é só uma aproximação.
4. O círculo à esquerda agora é projetado no eixo vertical.`,
      predict: [
        {
          question: "O pêndulo simples que oscila com o mesmo ω da mola vertical tem comprimento igual a:",
          options: ["o alongamento da mola no equilíbrio, mg/k", "o comprimento natural da mola", "depende da amplitude da mola"],
          answer: 0,
          explanation: "$\\omega^2 = k/m = g/L$ dá $L = mg/k$, que é o quanto a mola estica para sustentar o bloco parado.",
        },
      ],
    },
  ],

  exercises: [
    {
      id: "periodo",
      prompt: "Um bloco de {m} kg preso a uma mola de constante {k} N/m executa MHS. Qual é o período?",
      vary: { m: [0.2, 5, 1], k: [10, 200, 0] },
      answer: { label: "T", unit: "s", compute: (p) => (2 * Math.PI) / omega(p) },
    },
    {
      id: "amplitude",
      prompt:
        "Um bloco de {m} kg preso a uma mola de {k} N/m está em x₀ = {x0} m com velocidade v₀ = {v0} m/s. Qual é a amplitude do movimento?",
      vary: { m: [0.5, 3, 1], k: [10, 120, 0], x0: [0.05, 0.3, 2], v0: [-1.5, 1.5, 2] },
      answer: {
        label: "A",
        unit: "m",
        compute: (p) => Math.hypot(num(p, "x0"), num(p, "v0") / omega(p)),
      },
      hint: "A energia ½kA² é a soma de ½kx₀² com ½mv₀².",
    },
  ],

  init(p) {
    return atPhase([0, 0, 0, 0, 0], p, num(p, "phi") * DEG, 0);
  },
  derivatives(s, p) {
    if (s[HOLD]! > 0.5) return [0, 0, 0, 0, 0];
    const w2 = omega(p) ** 2;
    // Pêndulo real (não linear) com L = g/ω²: θ̈ = −(g/L) sen θ = −ω² sen θ
    return [s[V]!, -w2 * s[X]!, s[W]!, -w2 * Math.sin(s[TH]!), 0];
  },
  dt: 1e-3,
  sampleEvery: 10,
  tEnd: 120,

  pointer: {
    down(s, p, pt) {
      const g = center(p);
      const A = num(p, "A", 0.25);
      const r = Math.hypot(pt.x - g.cx, pt.y - g.cy);
      if (r > A * 1.35 || r < A * 0.15) return undefined;
      return atPhase(s, p, pointerPhase(p, g.cx, g.cy, pt.x, pt.y), 1);
    },
    move(s, p, pt, dragging) {
      if (!dragging || s[HOLD]! < 0.5) return undefined;
      const g = center(p);
      return atPhase(s, p, pointerPhase(p, g.cx, g.cy, pt.x, pt.y), 1);
    },
    up(s) {
      if (s[HOLD]! < 0.5) return undefined;
      const next = s.slice();
      next[HOLD] = 0;
      return next;
    },
    cursor(s, p, pt) {
      const g = center(p);
      const r = Math.hypot(pt.x - g.cx, pt.y - g.cy);
      const A = num(p, "A", 0.25);
      if (s[HOLD]! > 0.5) return "grabbing";
      return r <= A * 1.35 && r >= A * 0.15 ? "grab" : undefined;
    },
  },

  viewport(p) {
    if (!isVertical(p)) return { xMin: -0.8, xMax: 0.8, yMin: -0.95, yMax: 0.98, unit: "" };
    const g = vLayout(p);
    const A = num(p, "A", 0.25);
    return {
      xMin: g.cx - A - 0.06 * g.H,
      xMax: g.xp + Math.max(0.12 * g.H, g.L * 0.9) + 0.05 * g.H,
      yMin: -g.H - 0.04 * g.H,
      yMax: 0.1 * g.H,
      unit: "",
    };
  },

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const { state: s, params: p, theme, t } = frame;
    const A = num(p, "A", 0.25);
    const w = omega(p);
    const x = s[X]!;

    if (!isVertical(p)) {
      const g = H_LAYOUT;
      const bw = 0.11, bh = 0.09;
      // Mesa, parede e mola
      d.rect(-0.8, g.blockY - 0.06, 1.6, 0.06, { fill: theme.ground });
      d.support(g.wall, g.blockY, g.wall, g.blockY + 0.16, { color: theme.muted });
      d.spring(g.wall, g.blockY + bh / 2, x - bw / 2, g.blockY + bh / 2, { color: theme.muted, coils: 11, width: 2 });
      for (const xx of [-A, 0, A]) d.line(xx, g.blockY - 0.06, xx, g.blockY - 0.02, { color: theme.muted });
      d.text("−A", -A, g.blockY - 0.1, { color: theme.muted, size: 10 });
      d.text("0", 0, g.blockY - 0.1, { color: theme.muted, size: 10 });
      d.text("+A", A, g.blockY - 0.1, { color: theme.muted, size: 10 });

      const { px, py } = phasors(d, s, p, g.cx, g.cy, false);
      // Projeção do fasor sobre o eixo x, descendo até o bloco e até o traço x(t)
      d.line(px, py, px, g.traceTop, { color: theme.accent, dash: [4, 4], alpha: 0.7 });
      d.rect(x - bw / 2, g.blockY, bw, bh, { fill: theme.series[1], stroke: theme.text, width: 1 });
      // Vetores sobre o bloco
      d.arrowPx(x, g.blockY + bh + 0.04, s[V]!, 0, Math.min(90, (Math.abs(s[V]!) / (A * w)) * 70), { color: theme.series[2] });
      d.arrowPx(x, g.blockY + bh + 0.08, -x, 0, Math.min(90, (Math.abs(x) / A) * 70), { color: theme.positive });

      // Traço x(t): o tempo cresce para baixo; a projeção "desenha" a senoide
      const T = (2 * Math.PI) / w;
      const span = g.traceTop - g.traceBottom;
      const window = 1.5 * T;
      d.line(-A, g.traceTop, -A, g.traceBottom, { color: theme.grid });
      d.line(A, g.traceTop, A, g.traceBottom, { color: theme.grid });
      d.line(0, g.traceTop, 0, g.traceBottom, { color: theme.grid, dash: [3, 4] });
      const Ad = amplitudeOf(s, p), a0 = phaseOf(s, p);
      const pts: [number, number][] = [];
      const n = 160;
      for (let i = 0; i <= n; i++) {
        const back = (window * i) / n;
        if (back > t && s[HOLD]! < 0.5) break;
        pts.push([Ad * Math.cos(a0 - w * back), g.traceTop - (span * back) / window]);
      }
      d.polyline(pts, { color: theme.accent, width: 2 });
      d.text("x(t), tempo para baixo", 0.42, g.traceBottom + 0.04, { color: theme.muted, size: 10, align: "left" });
      d.text("1,5 T", -A - 0.04, g.traceBottom + 0.02, { color: theme.muted, size: 10, align: "right" });

      // Legenda
      d.text("arraste o fasor para mudar a fase", -0.78, 0.92, { color: theme.muted, size: 10, align: "left" });
      d.text("x = A cos(ωt + φ)", 0.78, 0.92, { color: theme.accent, size: 12, align: "right", weight: "600" });
      if (num(p, "fasores", 1) > 0.5) {
        d.text("verde: v   vermelho: a", 0.78, 0.84, { color: theme.muted, size: 10, align: "right" });
      }
      return;
    }

    // ---- Mola vertical × pêndulo ----
    const g = vLayout(p);
    const H = g.H;
    const bw = Math.min(0.12 * H, 0.16), bh = Math.min(0.08 * H, 0.11);
    const yb = g.ye + x; // x positivo para cima
    d.support(-0.08 * H, 0, g.xp + 0.08 * H, 0, { color: theme.muted });
    d.spring(0, 0, 0, yb + bh / 2, { color: theme.muted, coils: 12, width: 2 });
    d.line(-0.06 * H, g.ye, 0.06 * H, g.ye, { color: theme.grid, dash: [4, 4] });
    d.line(0.07 * H, -g.l0, 0.07 * H, g.ye, { color: theme.muted, width: 1 });
    d.text("Δℓ = mg/k", 0.08 * H, (g.ye - g.l0) / 2, { color: theme.muted, size: 10, align: "left" });
    d.rect(-bw / 2, yb - bh / 2, bw, bh, { fill: theme.series[1], stroke: theme.text, width: 1 });
    d.text("mola", 0, -H, { color: theme.muted, size: 11, baseline: "bottom" });
    d.text("equilíbrio", 0.07 * H, g.ye, { color: theme.muted, size: 10, align: "left", dy: 8 });
    d.text("x = A cos(ωt + φ), x para cima", g.cx - num(p, "A", 0.25), 0.05 * H, { color: theme.accent, size: 12, weight: "600", align: "left" });
    d.text("arraste o fasor", g.cx, g.cy - g.H * 0.02 - num(p, "A", 0.25) * 1.1, { color: theme.muted, size: 10, baseline: "top" });

    const { px, py } = phasors(d, s, p, g.cx, g.cy, true);
    d.line(px, py, -bw / 2, py, { color: theme.accent, dash: [4, 4], alpha: 0.7 });

    // Pêndulo de comprimento L = mg/k, pendurado do mesmo teto
    const th = s[TH]!;
    const bx = g.xp + g.L * Math.sin(th), by = -g.L * Math.cos(th);
    d.line(g.xp, 0, g.xp, -g.L * 1.04, { color: theme.grid, dash: [3, 5] });
    d.line(g.xp, 0, bx, by, { color: theme.text, width: 1.5 });
    d.circle(bx, by, 0, { fill: theme.series[0], minPx: 8 });
    d.dot(g.xp, 0, 3, theme.text);
    d.text(`pêndulo, L = ${texNumPlain(g.L)} m`, g.xp, -H, { color: theme.muted, size: 11, baseline: "bottom" });
    d.text(`θ = ${(th / DEG).toFixed(1).replace(".", ",")}°`, bx, by - 0.035 * H, { color: theme.series[0], size: 11, baseline: "top" });
  },
});

function pointerPhase(p: Params, cx: number, cy: number, x: number, y: number): number {
  // Inverte a convenção de desenho: horizontal mede a partir de +x, vertical a partir de +y.
  return isVertical(p) ? Math.atan2(-(x - cx), y - cy) : Math.atan2(y - cy, x - cx);
}

function texNumPlain(v: number): string {
  return Number(v.toPrecision(3)).toString().replace(".", ",");
}

export default mhs;
