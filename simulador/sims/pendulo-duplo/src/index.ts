import { defineSim, draw, num, rk4, texNum, type Params, type State } from "@fisilab/core";

/**
 * Pêndulo duplo (Lagrangiana completa) e pêndulo forçado amortecido. Três cópias
 * do sistema são integradas juntas: a principal, a "gêmea" (diferença inicial δ,
 * desenhada) e uma "sombra" a distância d₀ renormalizada a cada passo, que dá o
 * maior expoente de Lyapunov pelo método de Benettin.
 */

export interface DPState {
  y: number[];
  z: number[];
  w: number[];
  /** Soma de ln(d/d₀) das renormalizações e tempo acumulado. */
  lnSum: number;
  tL: number;
  /** Pontos do mapa de Poincaré (ângulo, velocidade angular / ω₀). */
  poin: [number, number][];
  drag: { bob: 1 | 2 } | null;
}

export const modeOf = (p: Params) => Math.round(num(p, "modo"));
const DEG = Math.PI / 180;
/** Distância da sombra (no espaço de fase normalizado). */
export const D0 = 1e-8;
const MAX_POIN = 6000;

export const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

export function omega0(p: Params): number {
  return Math.sqrt(num(p, "g", 9.81) / num(p, "l1", 1));
}

/** Equações de Lagrange do pêndulo duplo: [θ₁, θ₂, ω₁, ω₂] → derivadas. */
export function doubleDeriv(y: State, p: Params): State {
  const m1 = num(p, "m1", 1), m2 = num(p, "m2", 1), l1 = num(p, "l1", 1), l2 = num(p, "l2", 1), g = num(p, "g", 9.81);
  const [t1, t2, w1, w2] = y as [number, number, number, number];
  const D = t1 - t2;
  const den = 2 * m1 + m2 - m2 * Math.cos(2 * D);
  const a1 = (-g * (2 * m1 + m2) * Math.sin(t1) - m2 * g * Math.sin(t1 - 2 * t2) - 2 * Math.sin(D) * m2 * (w2 * w2 * l2 + w1 * w1 * l1 * Math.cos(D))) / (l1 * den);
  const a2 = (2 * Math.sin(D) * (w1 * w1 * l1 * (m1 + m2) + g * (m1 + m2) * Math.cos(t1) + w2 * w2 * l2 * m2 * Math.cos(D))) / (l2 * den);
  return [w1, w2, a1, a2];
}

/** Pêndulo forçado amortecido: θ̈ = −ω₀² sen θ − (ω₀/q) θ̇ + f ω₀² cos(Ω t). */
export function forcedDeriv(y: State, p: Params, t: number): State {
  const w0 = omega0(p);
  const q = num(p, "q", 2), f = num(p, "f", 1.5), W = num(p, "Wr", 2 / 3) * w0;
  return [y[2]!, 0, -w0 * w0 * Math.sin(y[0]!) - (w0 / q) * y[2]! + f * w0 * w0 * Math.cos(W * t), 0];
}

const deriv = (p: Params) => (y: State, _p: Params, t: number) => (modeOf(p) === 1 ? forcedDeriv(y, p, t) : doubleDeriv(y, p));

export function energy(y: readonly number[], p: Params): number {
  const g = num(p, "g", 9.81);
  const m1 = num(p, "m1", 1), m2 = num(p, "m2", 1), l1 = num(p, "l1", 1), l2 = num(p, "l2", 1);
  const [t1, t2, w1, w2] = y as [number, number, number, number];
  if (modeOf(p) === 1) return 0.5 * m1 * l1 * l1 * w1 * w1 + m1 * g * l1 * (1 - Math.cos(t1));
  const T = 0.5 * (m1 + m2) * l1 * l1 * w1 * w1 + 0.5 * m2 * l2 * l2 * w2 * w2 + m2 * l1 * l2 * w1 * w2 * Math.cos(t1 - t2);
  const V = -(m1 + m2) * g * l1 * Math.cos(t1) - m2 * g * l2 * Math.cos(t2);
  return T + V;
}

/** Diferença entre dois estados no espaço de fase normalizado (ângulos e ω/ω₀). */
export function phaseDiff(a: readonly number[], b: readonly number[], p: Params): number[] {
  const w0 = omega0(p);
  return [wrap(b[0]! - a[0]!), wrap(b[1]! - a[1]!), (b[2]! - a[2]!) / w0, (b[3]! - a[3]!) / w0];
}
export const phaseDist = (a: readonly number[], b: readonly number[], p: Params) => Math.hypot(...phaseDiff(a, b, p));

export function initState(p: Params, th1?: number, th2?: number): DPState {
  const a = th1 ?? num(p, "th1", 120) * DEG;
  const b = modeOf(p) === 1 ? 0 : (th2 ?? num(p, "th2", -20) * DEG);
  const y = [a, b, 0, 0];
  const delta = num(p, "delta", 1e-6);
  const z = [a + delta, b, 0, 0];
  const w = [a + D0, b, 0, 0];
  return { y, z, w, lnSum: 0, tL: 0, poin: [], drag: null };
}

/** Estimativa atual do maior expoente de Lyapunov (1/s). */
export const lyapunov = (s: DPState) => (s.tL > 0 ? s.lnSum / s.tL : 0);

/** Qual massa está sob o ponteiro (1, 2 ou nenhuma). */
function pickBob(s: DPState, p: Params, pt: { x: number; y: number }): 1 | 2 | null {
  const l1 = num(p, "l1", 1), l2 = num(p, "l2", 1);
  const x1 = l1 * Math.sin(s.y[0]!), y1 = -l1 * Math.cos(s.y[0]!);
  const x2 = x1 + l2 * Math.sin(s.y[1]!), y2 = y1 - l2 * Math.cos(s.y[1]!);
  const tol = 0.15 * (l1 + l2);
  if (modeOf(p) === 0 && Math.hypot(pt.x - x2, pt.y - y2) < tol) return 2;
  if (Math.hypot(pt.x - x1, pt.y - y1) < tol) return 1;
  return null;
}

export const penduloDuplo = defineSim<DPState>({
  id: "pendulo-duplo",
  title: "Pêndulo duplo e pêndulo forçado (caos)",
  course: "FG I",
  topic: "Oscilações",
  priority: "P3",
  summary:
    "Caos determinístico: pêndulo duplo pela Lagrangiana completa e pêndulo forçado amortecido, com um gêmeo de condição inicial quase igual, mapa de Poincaré e estimativa do expoente de Lyapunov.",
  equations: [
    String.raw`\mathcal L = \tfrac12(m_1+m_2)l_1^2\dot\theta_1^2 + \tfrac12 m_2 l_2^2\dot\theta_2^2 + m_2 l_1 l_2\dot\theta_1\dot\theta_2\cos(\theta_1-\theta_2) + (m_1+m_2)g l_1\cos\theta_1 + m_2 g l_2\cos\theta_2`,
    String.raw`\ddot\theta = -\omega_0^2\sin\theta - \frac{\omega_0}{q}\dot\theta + f\,\omega_0^2\cos(\Omega t)`,
    String.raw`|\delta(t)| \approx |\delta_0|\,e^{\lambda t} \qquad \lambda = \lim_{t\to\infty}\frac{1}{t}\sum \ln\frac{d_k}{d_0}`,
  ],
  liveEquations(s, p, t) {
    const sep = phaseDist(s.y, s.z, p);
    const out = [
      String.raw`\lambda \approx ${texNum(lyapunov(s))}\ \text{s}^{-1} \qquad |\delta| = ${texNum(sep)} \qquad t_{\text{previsão}} \sim \frac{1}{\lambda}\ln\frac{1}{|\delta_0|} = ${lyapunov(s) > 1e-3 ? texNum(Math.log(1 / num(p, "delta", 1e-6)) / lyapunov(s)) : "\\infty"}\ \text{s}`,
    ];
    if (modeOf(p) === 0) out.push(String.raw`E = ${texNum(energy(s.y, p), 6)}\ \text{J} \qquad t = ${texNum(t)}\ \text{s}`);
    else {
      const w0 = omega0(p);
      out.push(String.raw`\omega_0 = ${texNum(w0)}\ \text{rad/s} \quad \Omega = ${texNum(num(p, "Wr", 2 / 3) * w0)}\ \text{rad/s} \quad T_\Omega = ${texNum((2 * Math.PI) / (num(p, "Wr", 2 / 3) * w0))}\ \text{s}`);
    }
    return out;
  },

  params: [
    {
      key: "modo",
      label: "Sistema",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 0,
      options: [
        { value: 0, label: "Pêndulo duplo (conservativo)" },
        { value: 1, label: "Pêndulo forçado amortecido" },
      ],
    },
    { key: "th1", label: "Ângulo inicial θ₁", unit: "°", min: -180, max: 180, step: 1, default: 120 },
    { key: "th2", label: "Ângulo inicial θ₂ (pêndulo duplo)", unit: "°", min: -180, max: 180, step: 1, default: -20 },
    { key: "delta", label: "Diferença inicial do gêmeo δ₀", unit: "rad", min: 1e-12, max: 1e-2, step: 1e-12, default: 1e-6, log: true },
    { key: "m1", label: "Massa 1", unit: "kg", min: 0.1, max: 5, step: 0.1, default: 1 },
    { key: "m2", label: "Massa 2", unit: "kg", min: 0.1, max: 5, step: 0.1, default: 1 },
    { key: "l1", label: "Comprimento 1", unit: "m", min: 0.2, max: 2, step: 0.05, default: 1 },
    { key: "l2", label: "Comprimento 2", unit: "m", min: 0.2, max: 2, step: 0.05, default: 1 },
    { key: "g", label: "Gravidade", unit: "m/s²", min: 1, max: 25, step: 0.01, default: 9.81 },
    { key: "q", label: "Fator de qualidade q (forçado)", unit: "", min: 0.5, max: 20, step: 0.1, default: 2 },
    { key: "f", label: "Amplitude da força f (em unidades de mgℓ)", unit: "", min: 0, max: 2, step: 0.01, default: 1.5 },
    { key: "Wr", label: "Frequência da força Ω/ω₀", unit: "", min: 0.1, max: 3, step: 0.01, default: 0.667 },
  ],

  observables: [
    { key: "th1", label: "θ₁ (ou θ)", unit: "°", value: (s) => wrap(s.y[0]!) / DEG },
    { key: "th2", label: "θ₂", unit: "°", value: (s) => wrap(s.y[1]!) / DEG },
    { key: "w1", label: "ω₁ (ou ω)", unit: "rad/s", value: (s) => s.y[2]! },
    { key: "E", label: "Energia mecânica", unit: "J", value: (s, p) => energy(s.y, p) },
    { key: "sep", label: "log₁₀ da distância ao gêmeo", unit: "", value: (s, p) => Math.log10(Math.max(phaseDist(s.y, s.z, p), 1e-300)) },
    { key: "lyap", label: "Expoente de Lyapunov estimado λ", unit: "1/s", value: (s) => lyapunov(s) },
    { key: "nP", label: "Pontos no mapa de Poincaré", unit: "", value: (s) => s.poin.length },
  ],
  conserved: "E",
  chart: { x: "t", y: "sep" },

  scenarios: [
    {
      id: "caos",
      label: "Pêndulo duplo caótico",
      params: { modo: 0, th1: 120, th2: -20, delta: 1e-6 },
      guide: `### Sensibilidade às condições iniciais
1. O gêmeo (laranja) começa com $\\theta_1$ diferente por apenas $10^{-6}$ rad. Durante alguns segundos os dois são indistinguíveis.
2. O gráfico mostra $\\log_{10}|\\delta|$: uma **reta** crescente, ou seja, $|\\delta| \\propto e^{\\lambda t}$. A inclinação é $\\lambda/\\ln 10$.
3. Diminua $\\delta_0$ por mil: o tempo até os dois se separarem só aumenta de $\\ln(1000)/\\lambda$. É por isso que a previsão de longo prazo é impossível.
4. A energia continua conservada (veja o desvio relativo): o caos não é erro numérico.`,
      predict: [
        {
          question: "Se a diferença inicial δ₀ for reduzida de 10⁻⁶ para 10⁻¹², o tempo até os pêndulos ficarem visivelmente diferentes:",
          options: ["fica um milhão de vezes maior", "dobra, aproximadamente", "não muda"],
          answer: 1,
          explanation:
            "Com crescimento exponencial, o tempo para chegar a uma separação fixa é $t \\approx \\ln(\\delta_{\\text{vis}}/\\delta_0)/\\lambda$. Passar de $\\ln 10^{6}$ para $\\ln 10^{12}$ só dobra o tempo.",
        },
      ],
    },
    {
      id: "regular",
      label: "Pequenas oscilações: regular",
      params: { modo: 0, th1: 10, th2: 14, delta: 1e-6 },
      guide: `### Quando não há caos
1. Com ângulos pequenos o pêndulo duplo é quase linear: a separação cresce no máximo linearmente e $\\lambda \\to 0$.
2. O mapa de Poincaré (seção $\\theta_1 = 0$, $\\dot\\theta_1 > 0$) desenha **curvas fechadas**, sinal de movimento quase periódico.
3. Com $\\theta_2 = \\sqrt2\\,\\theta_1$ e massas e comprimentos iguais você excita o modo lento, $\\omega^2 = (2-\\sqrt2)g/l$.`,
    },
    {
      id: "forcado-periodico",
      label: "Forçado: periódico (f = 0,9)",
      params: { modo: 1, th1: 0, q: 2, f: 0.9, Wr: 0.667, delta: 1e-6 },
      guide: `### Atrator periódico
1. O mapa de Poincaré é **estroboscópico**: um ponto a cada período da força, $T_\\Omega = 2\\pi/\\Omega$.
2. Depois do transiente, todos os pontos caem no mesmo lugar: o movimento repete-se a cada período.
3. O expoente de Lyapunov fica negativo: perturbações morrem por causa do amortecimento.
4. Aumente $f$ aos poucos (1,07; 1,15; 1,35; 1,5) e acompanhe a duplicação de período e o caos.`,
    },
    {
      id: "forcado-caotico",
      label: "Forçado: caótico (f = 1,5)",
      params: { modo: 1, th1: 0, q: 2, f: 1.5, Wr: 0.667, delta: 1e-6 },
      guide: `### Atrator estranho
1. Com $q = 2$, $\\Omega = 2\\omega_0/3$ e $f = 1{,}5$ o pêndulo vira e desvira sem padrão.
2. Deixe rodar alguns minutos: os pontos do mapa de Poincaré desenham um **atrator estranho**, com estrutura fina e dobrada.
3. Compare $\\lambda$ com o caso periódico: positivo aqui.`,
      predict: [
        {
          question: "No regime caótico, o mapa de Poincaré estroboscópico mostra:",
          options: ["um único ponto", "alguns pontos que se repetem", "pontos espalhados ao acaso por todo o plano", "uma figura com estrutura fina (atrator estranho)"],
          answer: 3,
          explanation:
            "O movimento não é periódico, então os pontos nunca se repetem, mas também não preenchem tudo: o amortecimento confina a dinâmica a um conjunto fractal, o atrator estranho.",
        },
      ],
    },
  ],

  exercises: [
    {
      id: "modos",
      prompt:
        "Um pêndulo duplo tem duas massas iguais e duas hastes de {l1} m (g = 9,81 m/s²). Qual é o período do modo normal mais lento (pequenas oscilações)?",
      vary: { l1: [0.3, 2, 2] },
      fixed: { modo: 0, g: 9.81 },
      answer: { label: "T", unit: "s", compute: (p) => (2 * Math.PI) / Math.sqrt(((2 - Math.SQRT2) * num(p, "g", 9.81)) / num(p, "l1", 1)) },
      hint: "ω² = (2 ∓ √2) g/ℓ para m₁ = m₂ e ℓ₁ = ℓ₂.",
    },
    {
      id: "previsao",
      prompt:
        "Um sistema caótico tem expoente de Lyapunov λ = {lam} s⁻¹. Se a condição inicial é conhecida com erro de {err} rad, em quanto tempo o erro chega a 1 rad?",
      vary: { lam: [0.5, 3, 1], err: [0.000001, 0.001, 6] },
      answer: { label: "t", unit: "s", compute: (p) => Math.log(1 / num(p, "err", 1e-6)) / num(p, "lam", 1) },
      hint: "|δ(t)| ≈ δ₀ e^{λt}.",
    },
  ],

  init: (p) => initState(p),
  step(s, p, t, dt) {
    if (s.drag) return s;
    const f = deriv(p);
    const y = rk4(f, s.y, p, t, dt);
    const z = rk4(f, s.z, p, t, dt);
    let w = rk4(f, s.w, p, t, dt);
    // Benettin: renormaliza a sombra a D0 do estado principal
    const diff = phaseDiff(y, w, p);
    const dist = Math.hypot(...diff);
    let lnSum = s.lnSum;
    if (dist > 0 && Number.isFinite(dist)) {
      lnSum += Math.log(dist / D0);
      const k = D0 / dist;
      const w0 = omega0(p);
      w = [y[0]! + diff[0]! * k, y[1]! + diff[1]! * k, y[2]! + diff[2]! * k * w0, y[3]! + diff[3]! * k * w0];
    }
    // Mapa de Poincaré
    let poin = s.poin;
    const push = (a: number, b: number) => {
      poin = poin.length >= MAX_POIN ? [...poin.slice(1), [a, b]] : [...poin, [a, b]];
    };
    const w0 = omega0(p);
    if (modeOf(p) === 1) {
      const T = (2 * Math.PI) / (num(p, "Wr", 2 / 3) * w0);
      const k0 = Math.floor(t / T + 1e-9), k1 = Math.floor((t + dt) / T + 1e-9);
      if (k1 > k0 && t > 0) {
        const fr = (k1 * T - t) / dt;
        push(wrap(s.y[0]! + fr * (y[0]! - s.y[0]!)), (s.y[2]! + fr * (y[2]! - s.y[2]!)) / w0);
      }
    } else {
      const a = Math.sin(s.y[0]!), b = Math.sin(y[0]!);
      if (a < 0 && b >= 0 && Math.cos(y[0]!) > 0 && y[2]! > 0) {
        const fr = a / (a - b);
        push(wrap(s.y[1]! + fr * (y[1]! - s.y[1]!)), (s.y[3]! + fr * (y[3]! - s.y[3]!)) / w0);
      }
    }
    return { ...s, y, z, w, lnSum, tL: s.tL + dt, poin };
  },
  dt: 1e-3,
  sampleEvery: 10,
  maxSamples: 4000,
  tEnd: 3600,

  viewport(p) {
    const Lt = modeOf(p) === 1 ? num(p, "l1", 1) : num(p, "l1", 1) + num(p, "l2", 1);
    return { xMin: -1.2 * Lt, xMax: 3.7 * Lt, yMin: -1.3 * Lt, yMax: 1.3 * Lt, unit: "m" };
  },

  pointer: {
    down(s, p, pt) {
      const b = pickBob(s, p, pt);
      return b ? { ...s, drag: { bob: b } } : undefined;
    },
    move(s, p, pt, dragging) {
      if (!dragging || !s.drag) return undefined;
      const l1 = num(p, "l1", 1);
      let t1 = s.y[0]!, t2 = s.y[1]!;
      if (s.drag.bob === 1) t1 = Math.atan2(pt.x, -pt.y);
      else t2 = Math.atan2(pt.x - l1 * Math.sin(t1), -(pt.y + l1 * Math.cos(t1)));
      return { ...initState(p, t1, t2), drag: s.drag };
    },
    up: (s) => (s.drag ? { ...s, drag: null } : undefined),
    cursor: (s, p, pt) => (pickBob(s, p, pt) ? "grab" : undefined),
  },
  actions: [{ id: "limpar", label: "Limpar mapa de Poincaré", run: (s) => ({ ...s, poin: [] }) }],

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const { state: s, params: p, theme } = frame;
    const forced = modeOf(p) === 1;
    const l1 = num(p, "l1", 1), l2 = forced ? 0 : num(p, "l2", 1);
    const Lt = l1 + l2;
    const cMain = theme.series[0]!, cTwin = theme.series[1]!;
    const pos = (y: readonly number[]) => {
      const x1 = l1 * Math.sin(y[0]!), y1 = -l1 * Math.cos(y[0]!);
      return { x1, y1, x2: x1 + l2 * Math.sin(y[1]!), y2: y1 - l2 * Math.cos(y[1]!) };
    };
    d.support(-0.25 * Lt, 0, 0.25 * Lt, 0, { color: theme.muted });
    d.circle(0, 0, Lt, { stroke: theme.grid, width: 1, dash: [3, 5] });
    // rastros da última massa
    const tr = frame.trail;
    const n0 = Math.max(0, tr.length - 500);
    for (const [key, color] of [["z", cTwin], ["y", cMain]] as const) {
      const pts: [number, number][] = [];
      for (let i = n0; i < tr.length; i++) {
        const q = pos(tr[i]![key]);
        pts.push(forced ? [q.x1, q.y1] : [q.x2, q.y2]);
      }
      d.polyline(pts, { color, width: 1, alpha: 0.45 });
    }
    const bob = (y: readonly number[], color: string, alpha: number) => {
      const q = pos(y);
      d.line(0, 0, q.x1, q.y1, { color: theme.text, width: 2, alpha });
      d.circle(q.x1, q.y1, 0.05 * Lt * Math.cbrt(num(p, "m1", 1)), { fill: color, alpha, minPx: 5 });
      if (!forced) {
        d.line(q.x1, q.y1, q.x2, q.y2, { color: theme.text, width: 2, alpha });
        d.circle(q.x2, q.y2, 0.05 * Lt * Math.cbrt(num(p, "m2", 1)), { fill: color, alpha, minPx: 5 });
      }
    };
    bob(s.z, cTwin, 0.75);
    bob(s.y, cMain, 1);
    d.dot(0, 0, 4, theme.text);
    if (forced) {
      // torque da força externa (sinal de cos Ωt)
      const tq = num(p, "f", 1.5) * Math.cos(num(p, "Wr", 2 / 3) * omega0(p) * frame.t);
      const a0 = -Math.PI / 2, a1 = a0 + 0.9 * tq;
      const arc: [number, number][] = [];
      for (let i = 0; i <= 20; i++) {
        const a = a0 + ((a1 - a0) * i) / 20;
        arc.push([0.25 * Lt * Math.cos(a), 0.25 * Lt * Math.sin(a)]);
      }
      if (Math.abs(tq) > 0.02) {
        d.polyline(arc, { color: theme.series[3]!, width: 2.5 });
        const e = arc[arc.length - 1]!, b = arc[arc.length - 2]!;
        d.arrowPx(b[0], b[1], e[0] - b[0], e[1] - b[1], 10, { color: theme.series[3]! });
      }
      d.text("torque externo", 0, -0.42 * Lt, { color: theme.series[3]!, size: 11 });
    }

    // Mapa de Poincaré
    const X0 = 1.4 * Lt, X1 = 3.6 * Lt, Y0 = -1.05 * Lt, Y1 = 1.05 * Lt;
    const wMax = Math.max(1, ...s.poin.map(([, w]) => Math.abs(w) * 1.1));
    d.rect(X0, Y0, X1 - X0, Y1 - Y0, { stroke: theme.muted, width: 1 });
    d.line((X0 + X1) / 2, Y0, (X0 + X1) / 2, Y1, { color: theme.grid, width: 1 });
    d.line(X0, (Y0 + Y1) / 2, X1, (Y0 + Y1) / 2, { color: theme.grid, width: 1 });
    const mx = (a: number) => X0 + ((a + Math.PI) / (2 * Math.PI)) * (X1 - X0);
    const my = (w: number) => (Y0 + Y1) / 2 + (w / wMax) * ((Y1 - Y0) / 2);
    for (const [a, w] of s.poin) {
      const yy = my(w);
      if (yy > Y0 && yy < Y1) d.dot(mx(a), yy, 1.3, theme.accent, 0.8);
    }
    d.text(forced ? "Poincaré estroboscópico: (θ, ω/ω₀) a cada período da força" : "Poincaré: (θ₂, ω₂/ω₀) quando θ₁ = 0 com ω₁ > 0", (X0 + X1) / 2, Y1, { color: theme.text, size: 11, dy: -10 });
    d.text("−π", X0, Y0, { color: theme.muted, size: 10, dy: 10 });
    d.text("π", X1, Y0, { color: theme.muted, size: 10, dy: 10 });
    d.text(forced ? "θ" : "θ₂", (X0 + X1) / 2, Y0, { color: theme.muted, size: 11, dy: 12 });
    d.text(`±${wMax.toFixed(1).replace(".", ",")}`, X0, Y1, { color: theme.muted, size: 10, dx: -16, dy: 4 });

    // Leituras
    const sep = phaseDist(s.y, s.z, p);
    const tx = -1.15 * Lt, ty = 1.2 * Lt, dy = 0.11 * Lt;
    d.text(`λ ≈ ${lyapunov(s).toFixed(3).replace(".", ",")} s⁻¹`, tx, ty, { color: theme.text, size: 12, align: "left", weight: "600" });
    d.text(`distância ao gêmeo: ${sep.toExponential(1).replace(".", ",")}`, tx, ty - dy, { color: cTwin, size: 12, align: "left" });
    d.text("azul: pêndulo · laranja: gêmeo (δ₀ diferente)", tx, ty - 2 * dy, { color: theme.muted, size: 11, align: "left" });
    d.text("arraste as massas para escolher o início", tx, -1.22 * Lt, { color: theme.muted, size: 11, align: "left" });
  },
});

export default penduloDuplo;
