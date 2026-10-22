import { defineSim, draw, num, texNum, type Draw, type Params, type State } from "@fisilab/core";
import { derivation } from "./derivation.ts";

// Estado: [x, v, energia dissipada, x e v de três osciladores de comparação (ζ = 0,2; 1; 2,5)]
const X = 0, V = 1, ED = 2;
export const ZETAS = [0.2, 1, 2.5] as const;
const REGIMES = ["subamortecido", "crítico", "superamortecido"];

export const omega0 = (p: Params) => Math.sqrt(num(p, "k", 25) / num(p, "m", 1));
export const gammaOf = (p: Params, b = num(p, "b", 1.5)) => b / (2 * num(p, "m", 1));
export const bCritical = (p: Params) => 2 * Math.sqrt(num(p, "m", 1) * num(p, "k", 25));

/** Raízes de s² + 2γs + ω₀² = 0, como pares (Re, Im). */
export function roots(gamma: number, w0: number): [number, number][] {
  const disc = gamma * gamma - w0 * w0;
  if (disc < 0) {
    const wd = Math.sqrt(-disc);
    return [[-gamma, wd], [-gamma, -wd]];
  }
  const r = Math.sqrt(disc);
  return [[-gamma + r, 0], [-gamma - r, 0]];
}

/** Solução analítica x(t) para x(0) = x0, v(0) = v0 (os três regimes). */
export function analytic(x0: number, v0: number, gamma: number, w0: number, t: number): number {
  const disc = gamma * gamma - w0 * w0;
  const e = Math.exp(-gamma * t);
  if (Math.abs(disc) < 1e-12 * w0 * w0) return (x0 + (v0 + gamma * x0) * t) * e;
  if (disc < 0) {
    const wd = Math.sqrt(-disc);
    return e * (x0 * Math.cos(wd * t) + ((v0 + gamma * x0) / wd) * Math.sin(wd * t));
  }
  const r = Math.sqrt(disc);
  const s1 = -gamma + r, s2 = -gamma - r;
  const c1 = (v0 - s2 * x0) / (s1 - s2);
  return c1 * Math.exp(s1 * t) + (x0 - c1) * Math.exp(s2 * t);
}

const regimeOf = (p: Params) => {
  const z = gammaOf(p) / omega0(p);
  return Math.abs(z - 1) < 0.005 ? 1 : z < 1 ? 0 : 2;
};

function derivatives(s: State, p: Params): State {
  const m = num(p, "m", 1), k = num(p, "k", 25), b = num(p, "b", 1.5);
  const out = [s[V]!, (-k * s[X]! - b * s[V]!) / m, b * s[V]! ** 2];
  const bc = bCritical(p);
  ZETAS.forEach((z, i) => {
    const x = s[3 + 2 * i]!, v = s[4 + 2 * i]!;
    out.push(v, (-k * x - z * bc * v) / m);
  });
  return out;
}

// ---- Layout do palco (coordenadas abstratas, sem unidade) ----
const WALL = -1.1, EQ = -0.28;
const GR = { x0: -1.08, x1: 0.55, yc: -0.47, h: 0.45 }; // gráfico x(t)
const SP = { ox: 2.03, oy: 0.18, r: 0.46, reMin: -2.6, reMax: 0.6, imMax: 1.55 }; // plano s

function xScale(p: Params) {
  const ref = Math.abs(num(p, "x0", 0.25)) + Math.abs(num(p, "v0")) / omega0(p);
  return 0.4 / Math.max(ref, 1e-3);
}

function oscillator(d: Draw, y: number, x: number, color: string, label: string, h: number) {
  const { theme } = d;
  const bw = 0.16;
  const xd = Math.max(-0.75, Math.min(0.42, EQ + x));
  d.line(WALL, y - h / 2 - 0.02, 0.6, y - h / 2 - 0.02, { color: theme.muted, width: 1, alpha: 0.6 });
  d.support(WALL, y - h / 2, WALL, y + h / 2, { color: theme.muted });
  d.spring(WALL, y + h * 0.2, xd - bw / 2, y + h * 0.2, { color: theme.muted, coils: 9, width: 1.5, amplitudePx: 5 });
  // Amortecedor: cilindro preso à parede e pistão preso ao bloco
  const yd = y - h * 0.22;
  const cyl0 = WALL + 0.05, cyl1 = WALL + 0.32;
  d.line(WALL, yd, cyl0, yd, { color: theme.muted, width: 1.5 });
  d.polyline([[cyl1, yd + 0.035], [cyl0, yd + 0.035], [cyl0, yd - 0.035], [cyl1, yd - 0.035]], { color: theme.muted, width: 1.5 });
  const piston = Math.max(cyl0 + 0.03, Math.min(cyl1 - 0.02, xd - bw / 2 - 0.25));
  d.line(piston, yd - 0.028, piston, yd + 0.028, { color: theme.muted, width: 2.5 });
  d.line(piston, yd, xd - bw / 2, yd, { color: theme.muted, width: 1.5 });
  d.rect(xd - bw / 2, y - h / 2, bw, h, { fill: color, stroke: theme.text, width: 1 });
  d.line(EQ, y - h / 2 - 0.05, EQ, y + h / 2 + 0.03, { color: theme.grid, dash: [3, 3] });
  if (label) d.text(label, 0.6, y + h / 2 + 0.02, { color, size: 11, align: "right", baseline: "bottom", weight: "600" });
}

function cross(d: Draw, x: number, y: number, color: string, sizePx = 7) {
  const s = sizePx * d.px;
  d.line(x - s, y - s, x + s, y + s, { color, width: 2.5 });
  d.line(x - s, y + s, x + s, y - s, { color, width: 2.5 });
}

export const amortecido = defineSim({
  id: "amortecido",
  title: "Oscilador amortecido: sub, crítico e super",
  course: "FG II",
  topic: "Oscilações",
  priority: "P1",
  summary:
    "Massa, mola e amortecedor viscoso. Mude b e veja as raízes da equação característica andarem no plano complexo enquanto o movimento passa de oscilação que decai a retorno sem oscilar.",
  derivation,
  equations: [
    String.raw`m\ddot x + b\dot x + kx = 0 \qquad \gamma = \frac{b}{2m} \qquad \omega_0 = \sqrt{k/m}`,
    String.raw`x = e^{st} \;\Rightarrow\; s^2 + 2\gamma s + \omega_0^2 = 0 \;\Rightarrow\; s = -\gamma \pm \sqrt{\gamma^2 - \omega_0^2}`,
    String.raw`\gamma < \omega_0:\ x = A e^{-\gamma t}\cos(\omega_d t + \varphi),\ \omega_d = \sqrt{\omega_0^2 - \gamma^2} \qquad \gamma = \omega_0:\ x = (C_1 + C_2 t)e^{-\gamma t}`,
    String.raw`Q = \frac{\omega_0}{2\gamma} = \frac{\sqrt{mk}}{b} \qquad b_c = 2\sqrt{mk} \qquad \frac{\Delta E}{E}\Big|_{\text{ciclo}} \approx \frac{2\pi}{Q}`,
  ],
  liveEquations(_s, p) {
    const g = gammaOf(p), w0 = omega0(p);
    const [r1, r2] = roots(g, w0);
    const fmt = (r: [number, number]) =>
      r[1] === 0 ? texNum(r[0]) : `${texNum(r[0])} ${r[1] > 0 ? "+" : "-"} ${texNum(Math.abs(r[1]))}\\,i`;
    return [
      String.raw`\gamma = ${texNum(g)}\ \text{s}^{-1} \quad \omega_0 = ${texNum(w0)}\ \text{rad/s} \quad Q = ${texNum(w0 / (2 * g))} \quad b_c = ${texNum(bCritical(p))}\ \text{N·s/m}`,
      String.raw`s_1 = ${fmt(r1!)}\ \text{s}^{-1} \qquad s_2 = ${fmt(r2!)}\ \text{s}^{-1} \qquad (\text{${REGIMES[regimeOf(p)]}})`,
    ];
  },

  params: [
    {
      key: "modo",
      label: "Vista",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 0,
      live: true,
      options: [
        { value: 0, label: "Um oscilador (b ajustável)" },
        { value: 1, label: "Três regimes lado a lado" },
      ],
    },
    { key: "m", label: "Massa", unit: "kg", min: 0.2, max: 5, step: 0.1, default: 1 },
    { key: "k", label: "Constante da mola k", unit: "N/m", min: 5, max: 200, step: 1, default: 25 },
    { key: "b", label: "Coeficiente de amortecimento b", unit: "N·s/m", min: 0.01, max: 60, step: 0.01, default: 1.5, live: true, log: true },
    { key: "x0", label: "Deslocamento inicial", unit: "m", min: -0.3, max: 0.3, step: 0.01, default: 0.25 },
    { key: "v0", label: "Velocidade inicial", unit: "m/s", min: -3, max: 3, step: 0.05, default: 0 },
  ],

  observables: [
    { key: "x", label: "Posição x", unit: "m", value: (s) => s[X]! },
    { key: "v", label: "Velocidade v", unit: "m/s", value: (s) => s[V]! },
    { key: "E", label: "Energia mecânica", unit: "J", value: (s, p) => 0.5 * num(p, "m", 1) * s[V]! ** 2 + 0.5 * num(p, "k", 25) * s[X]! ** 2 },
    { key: "Ed", label: "Energia dissipada", unit: "J", value: (s) => s[ED]! },
    {
      key: "Etot",
      label: "Energia mecânica + dissipada",
      unit: "J",
      value: (s, p) => 0.5 * num(p, "m", 1) * s[V]! ** 2 + 0.5 * num(p, "k", 25) * s[X]! ** 2 + s[ED]!,
    },
    { key: "gamma", label: "Taxa de decaimento γ", unit: "1/s", value: (_s, p) => gammaOf(p) },
    { key: "wd", label: "Frequência amortecida ω_d", unit: "rad/s", value: (_s, p) => Math.sqrt(Math.max(0, omega0(p) ** 2 - gammaOf(p) ** 2)) },
    { key: "Q", label: "Fator de qualidade Q", unit: "", value: (_s, p) => omega0(p) / (2 * gammaOf(p)) },
    { key: "zeta", label: "Razão de amortecimento ζ = γ/ω₀", unit: "", value: (_s, p) => gammaOf(p) / omega0(p) },
    { key: "xSub", label: "x (ζ = 0,2)", unit: "m", value: (s) => s[3]! },
    { key: "xCrit", label: "x (crítico)", unit: "m", value: (s) => s[5]! },
    { key: "xSuper", label: "x (ζ = 2,5)", unit: "m", value: (s) => s[7]! },
  ],
  conserved: "Etot",
  chart: { x: "t", y: "x" },

  scenarios: [
    {
      id: "sub",
      label: "Subamortecido (Q ≈ 3)",
      params: { modo: 0, m: 1, k: 25, b: 1.5, x0: 0.25, v0: 0 },
      guide: `### Oscilação que decai
1. As raízes são um par complexo conjugado $s = -\\gamma \\pm i\\omega_d$: a parte real dá o decaimento $e^{-\\gamma t}$ (envoltória tracejada) e a imaginária dá a frequência.
2. Aumente **b** devagar e acompanhe as raízes: elas andam sobre o círculo $|s| = \\omega_0$ em direção ao eixo real.
3. Plote **Energia mecânica**: ela cai cerca de $2\\pi/Q$ por ciclo quando $Q$ é grande.`,
      predict: [
        {
          question: "Com amortecimento fraco, o período da oscilação comparado ao do oscilador sem atrito é:",
          options: ["um pouco menor", "igual", "um pouco maior"],
          answer: 2,
          explanation: "$\\omega_d = \\sqrt{\\omega_0^2 - \\gamma^2} < \\omega_0$, então $T_d = 2\\pi/\\omega_d$ é um pouco maior. Com $Q = 3{,}3$ a diferença é de cerca de 1%.",
        },
      ],
    },
    {
      id: "critico",
      label: "Amortecimento crítico",
      params: { modo: 0, m: 1, k: 25, b: 10, x0: 0.25, v0: 0 },
      guide: `### O retorno mais rápido sem ultrapassar
1. Com $b = b_c = 2\\sqrt{mk} = 10$ N·s/m as duas raízes se encontram em $s = -\\omega_0$ no eixo real.
2. A solução deixa de ser exponencial pura: $x = (C_1 + C_2 t)e^{-\\omega_0 t}$.
3. Compare: com $b$ um pouco menor há uma pequena ultrapassagem; com $b$ maior o retorno fica mais lento.`,
      predict: [
        {
          question: "Partindo do repouso, qual regime chega mais rápido perto do equilíbrio sem ultrapassá-lo?",
          options: ["subamortecido", "crítico", "superamortecido"],
          answer: 1,
          explanation: "No crítico a raiz mais lenta é a mais rápida possível sem parte imaginária: $s = -\\omega_0$. No superamortecido uma das raízes se aproxima de zero e o retorno fica lento.",
        },
      ],
    },
    {
      id: "super",
      label: "Superamortecido",
      params: { modo: 0, m: 1, k: 25, b: 30, x0: 0.25, v0: 0 },
      guide: `### Duas exponenciais reais
1. Com $\\gamma > \\omega_0$ as raízes são reais e negativas: uma rápida, outra lenta.
2. A lenta, $s_1 = -\\gamma + \\sqrt{\\gamma^2-\\omega_0^2} \\approx -\\omega_0^2/(2\\gamma)$, se aproxima de zero quando $b$ cresce: **mais amortecimento, retorno mais lento**.
3. É o caso de uma porta com amortecedor muito duro.`,
    },
    {
      id: "comparar",
      label: "Três regimes lado a lado",
      params: { modo: 1, m: 1, k: 25, b: 10, x0: 0.25, v0: 0 },
      guide: `### Comparação
Os três blocos partem do mesmo ponto com $\\zeta = \\gamma/\\omega_0 = 0{,}2$, $1$ e $2{,}5$. No plano complexo, os pontos coloridos mostram as raízes de cada um.
1. Qual cruza o equilíbrio? Qual é o primeiro a ficar a menos de 1 cm dele?
2. Mude $v_0$ para um valor negativo grande: até o crítico pode cruzar o equilíbrio uma vez.`,
    },
  ],

  exercises: [
    {
      id: "critico",
      prompt: "Um bloco de {m} kg está preso a uma mola de {k} N/m. Qual coeficiente de amortecimento b torna o sistema criticamente amortecido?",
      vary: { m: [0.2, 5, 1], k: [5, 200, 0] },
      answer: { label: "b_c", unit: "N·s/m", compute: (p) => bCritical(p) },
      hint: "No crítico, γ = ω₀.",
    },
    {
      id: "meia-vida",
      prompt:
        "Um oscilador subamortecido tem massa {m} kg e b = {b} N·s/m. Quanto tempo leva para a amplitude cair à metade?",
      vary: { m: [0.5, 5, 1], b: [0.1, 2, 2] },
      fixed: { k: 100 },
      answer: { label: "t", unit: "s", compute: (p) => Math.LN2 / gammaOf(p) },
      hint: "A envoltória é A₀e^(−γt) com γ = b/2m.",
    },
  ],

  init(p) {
    const x0 = num(p, "x0", 0.25), v0 = num(p, "v0");
    return [x0, v0, 0, x0, v0, x0, v0, x0, v0];
  },
  derivatives,
  dt: 1e-3,
  sampleEvery: 10,
  tEnd: 60,

  viewport: () => ({ xMin: -1.15, xMax: 2.45, yMin: -1.05, yMax: 1.05, unit: "" }),

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const { state: s, params: p, theme, t, trail } = frame;
    const compare = Math.round(num(p, "modo")) === 1;
    const sx = xScale(p);
    const w0 = omega0(p), g = gammaOf(p);
    const colors = [theme.series[0]!, theme.series[2]!, theme.series[1]!];

    // ---- Osciladores ----
    if (!compare) {
      oscillator(d, 0.6, s[X]! * sx, theme.series[4]!, `b = ${fmt(num(p, "b", 1.5))} N·s/m`, 0.2);
    } else {
      ZETAS.forEach((z, i) => oscillator(d, 0.84 - i * 0.27, s[3 + 2 * i]! * sx, colors[i]!, `ζ = ${fmt(z)} (${REGIMES[i]})`, 0.13));
    }

    // ---- Gráfico x(t) com envoltória ----
    const T0 = (2 * Math.PI) / w0;
    const Tw = 6 * T0;
    const tStart = Math.max(0, t - Tw);
    const gx = (tt: number) => GR.x0 + ((tt - tStart) / Tw) * (GR.x1 - GR.x0);
    const gy = (x: number) => GR.yc + Math.max(-1.15, Math.min(1.15, (x * sx) / 0.4)) * GR.h;
    d.rect(GR.x0, GR.yc - GR.h * 1.2, GR.x1 - GR.x0, GR.h * 2.4, { stroke: theme.grid, width: 1 });
    d.line(GR.x0, GR.yc, GR.x1, GR.yc, { color: theme.muted, width: 1 });
    d.text("x(t)", GR.x0 + 0.02, GR.yc + GR.h * 1.2 - 0.02, { color: theme.muted, size: 11, align: "left", baseline: "top" });
    d.text(`janela de 6T₀ = ${fmt(Tw)} s`, GR.x1 - 0.02, GR.yc - GR.h * 1.2 + 0.02, { color: theme.muted, size: 10, align: "right", baseline: "bottom" });
    const dts = 1e-3 * 10;
    const series = compare ? [3, 5, 7] : [X];
    series.forEach((idx, j) => {
      const pts: [number, number][] = [];
      const i0 = Math.max(0, Math.floor(tStart / dts));
      for (let i = i0; i < trail.length; i++) {
        const st = trail[i]!;
        pts.push([gx(i * dts), gy(st[idx]!)]);
      }
      pts.push([gx(t), gy(s[idx]!)]);
      d.polyline(pts, { color: compare ? colors[j]! : theme.series[4]!, width: 2 });
    });
    // Envoltória ±A e^{−γt} do oscilador subamortecido
    const x0 = num(p, "x0", 0.25), v0 = num(p, "v0");
    const gEnv = compare ? ZETAS[0] * w0 : g;
    if (gEnv < w0 * 0.999) {
      const wd = Math.sqrt(w0 * w0 - gEnv * gEnv);
      const A0 = Math.hypot(x0, (v0 + gEnv * x0) / wd);
      for (const sg of [1, -1]) {
        d.plot((xx) => gy(sg * A0 * Math.exp(-gEnv * (tStart + ((xx - GR.x0) / (GR.x1 - GR.x0)) * Tw))), GR.x0, GR.x1, {
          color: compare ? colors[0]! : theme.series[4]!,
          dash: [5, 4],
          width: 1.2,
          alpha: 0.8,
        });
      }
      d.text("±A₀e^(−γt)", GR.x1 - 0.02, GR.yc + GR.h * 1.2 - 0.02, { color: theme.muted, size: 10, align: "right", baseline: "top" });
    }

    // ---- Plano complexo das raízes ----
    const { ox, oy, r } = SP;
    const px = (re: number) => ox + (re / w0) * r;
    const py = (im: number) => oy + (im / w0) * r;
    const xL = ox + SP.reMin * r, xR = ox + SP.reMax * r;
    d.text("Raízes s no plano complexo", (xL + xR) / 2, oy + SP.imMax * r + 0.04, { color: theme.text, size: 12, weight: "600", baseline: "bottom" });
    d.arrow(xL, oy, xR - xL, 0, { color: theme.muted, width: 1.2, head: 7 });
    d.arrow(ox, oy - SP.imMax * r, 0, 2 * SP.imMax * r, { color: theme.muted, width: 1.2, head: 7 });
    d.text("Re s", xR, oy - 0.05, { color: theme.muted, size: 10, align: "right" });
    d.text("Im s", ox + 0.04, oy + SP.imMax * r - 0.02, { color: theme.muted, size: 10, align: "left" });
    // Lugar das raízes quando b varia: semicírculo |s| = ω₀ e eixo real
    const semi: [number, number][] = [];
    for (let i = 0; i <= 60; i++) {
      const a = Math.PI / 2 + (Math.PI * i) / 60;
      semi.push([ox + r * Math.cos(a), oy + r * Math.sin(a)]);
    }
    d.polyline(semi, { color: theme.muted, dash: [4, 4], width: 1.2 });
    d.line(xL, oy, ox - r, oy, { color: theme.muted, width: 3, alpha: 0.35 });
    d.line(ox - r, oy - 0.03, ox - r, oy + 0.03, { color: theme.muted });
    d.text("−ω₀", ox - r, oy - 0.07, { color: theme.muted, size: 10 });
    d.line(ox - 0.03, py(w0), ox + 0.03, py(w0), { color: theme.muted });
    d.text("ω₀", ox + 0.05, py(w0), { color: theme.muted, size: 10, align: "left" });
    // Faixa estável (Re s < 0) e marca de −γ
    if (g / w0 < -SP.reMin) {
      d.line(px(-g), oy - SP.imMax * r, px(-g), oy + SP.imMax * r, { color: theme.series[4]!, dash: [2, 4], alpha: 0.6, width: 1 });
      d.text("Re s = −γ", px(-g), oy - SP.imMax * r - 0.02, { color: theme.series[4]!, size: 10, baseline: "top" });
    }

    if (compare) {
      ZETAS.forEach((z, i) => {
        for (const [re, im] of roots(z * w0, w0)) {
          const xx = Math.max(xL + 0.03, px(re));
          d.dot(xx, py(im), 5, colors[i]!);
        }
      });
    }
    for (const [re, im] of roots(g, w0)) {
      const xx = px(re);
      if (xx < xL + 0.02) {
        d.arrowPx(xL + 0.12, py(im) + 0.06, -1, 0, 26, { color: theme.series[4]! });
        d.text(`s = ${fmt(re)}`, xL + 0.02, py(im) + 0.12, { color: theme.series[4]!, size: 10, align: "left" });
      } else cross(d, xx, py(im), theme.series[4]!);
    }

    // Leitura
    const Q = w0 / (2 * g);
    const lines = [
      `γ = ${fmt(g)} s⁻¹   ω₀ = ${fmt(w0)} rad/s`,
      `Q = ${fmt(Q)}   ζ = ${fmt(g / w0)}`,
      `regime: ${REGIMES[regimeOf(p)]}`,
    ];
    lines.forEach((ln, i) =>
      d.text(ln, xL, oy - SP.imMax * r - 0.16 - i * 0.11, { color: i === 2 ? theme.series[4]! : theme.text, size: 11, align: "left", weight: i === 2 ? "600" : "400" }),
    );
    d.text("× raízes com o b atual", xR, oy - SP.imMax * r - 0.16, { color: theme.series[4]!, size: 10, align: "right" });
    d.text("tracejado: caminho das raízes", xR, oy - SP.imMax * r - 0.27, { color: theme.muted, size: 10, align: "right" });
  },
});

function fmt(v: number): string {
  if (!Number.isFinite(v)) return "∞";
  return Number(v.toPrecision(3)).toString().replace(".", ",");
}

export default amortecido;
