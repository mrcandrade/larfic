import { defineSim, draw, formatBR, num, rng, texNum, type Draw, type Params } from "@fisilab/core";
import { BINODAL, GASES, Zr, critical, equilibrium, gasOf, lobeAreas, maxwell, pr, spinodal } from "./vdw.ts";

export * from "./vdw.ts";

const fmt = (v: number, d = 3) => formatBR(v, d);
const RL = 0.08314462618; // L·bar/(mol·K)
const VMAX = 4.2; // maior volume reduzido mostrado e de partida
const V_START = 4;

const tOf = (p: Params) => num(p, "tr", 0.9);
const gOf = (p: Params) => gasOf(num(p, "gas", 6));
const vOf = (s: number[]) => Math.max(0.36, s[0] ?? V_START);
/** Teto do eixo de pressão reduzida no diagrama P–V. */
const pTop = (t: number) => (t <= 1 ? 1.8 : 1.8 * t);

/** Menor volume da compressão: onde a isoterma do líquido atinge 95% do teto do gráfico. */
export function vStop(t: number): number {
  let lo = 1 / 3 + 1e-9, hi = 1.2;
  const target = 0.95 * pTop(t);
  for (let i = 0; i < 80; i++) {
    const m = 0.5 * (lo + hi);
    if (pr(t, m) > target) lo = m;
    else hi = m;
  }
  return Math.min(0.9, 0.5 * (lo + hi));
}

/** Grandezas do estado atual em SI e em unidades práticas. */
export function stateOf(s: number[], p: Params) {
  const t = tOf(p);
  const g = gOf(p);
  const c = critical(g);
  const v = vOf(s);
  const eq = equilibrium(t, v);
  const T = t * c.Tc;
  const V = v * c.Vc; // m³/mol
  return {
    t, v, g, c, T, V,
    pEq: eq.p,
    xl: eq.xl,
    coex: eq.coex,
    P: eq.p * c.Pc, // Pa
    Pvdw: pr(t, v) * c.Pc,
    Pid: (8.314462618 * T) / V,
    Z: Zr(t, v, eq.p),
  };
}

// Posições fixas das moléculas desenhadas no cilindro.
const DOTS = (() => {
  const r = rng(11);
  return Array.from({ length: 70 }, () => [r(), r()] as [number, number]);
})();

const P = { x0: 4.6, x1: 15.5, y0: 1.1, y1: 8.2 };

export const vanDerWaals = defineSim({
  id: "van-der-waals",
  title: "Gás de van der Waals e ponto crítico",
  course: "FG II",
  topic: "Gases reais",
  priority: "P3",
  summary:
    "Isotermas de van der Waals para dez gases reais, com o patamar de condensação obtido pela construção de Maxwell (áreas iguais), a região de coexistência, o ponto crítico, o fator de compressibilidade e a lei dos estados correspondentes.",
  equations: [
    String.raw`\left(P + \frac{a}{V_m^2}\right)(V_m - b) = RT`,
    String.raw`T_c = \frac{8a}{27Rb} \qquad P_c = \frac{a}{27b^2} \qquad V_c = 3b \qquad Z_c = \frac{P_cV_c}{RT_c} = \frac38`,
    String.raw`\text{reduzidas: } p_r = \frac{8t_r}{3v_r - 1} - \frac{3}{v_r^2}`,
    String.raw`\text{Maxwell: } \int_{V_l}^{V_g} \big(P(V) - P_s\big)\,dV = 0 \qquad Z = \frac{PV_m}{RT}`,
  ],
  liveEquations(s, p) {
    const q = stateOf(s, p);
    const out = [
      String.raw`T = ${texNum(q.t)}\,T_c = ${texNum(q.T, 4)}\ \text{K} \qquad V_m = ${texNum(q.V * 1000)}\ \text{L/mol}`,
      String.raw`P_{\text{vdW}} = \frac{RT}{V_m - b} - \frac{a}{V_m^2} = ${texNum(q.Pvdw / 1e5)}\ \text{bar} \qquad P_{\text{ideal}} = ${texNum(q.Pid / 1e5)}\ \text{bar}`,
      String.raw`Z = \frac{PV_m}{RT} = ${texNum(q.Z)}`,
    ];
    if (q.coex) {
      const A = lobeAreas(q.t, q.coex);
      out.push(
        String.raw`P_s = ${texNum(q.coex.p * q.c.Pc / 1e5)}\ \text{bar} \qquad A_{\text{abaixo}} = ${texNum(A.below * q.c.Pc * q.c.Vc)}\ \text{J/mol} = A_{\text{acima}} = ${texNum(A.above * q.c.Pc * q.c.Vc)}\ \text{J/mol}`,
      );
    }
    return out;
  },

  params: [
    { key: "gas", label: "Gás", unit: "", min: 0, max: GASES.length - 1, step: 1, default: 6, options: GASES.map((g) => ({ value: g.value, label: `${g.name} (${g.formula})` })) },
    { key: "tr", label: "Temperatura reduzida T/T_c", unit: "", min: 0.85, max: 1.6, step: 0.01, default: 0.9, live: true },
    {
      key: "vista",
      label: "Gráfico",
      unit: "",
      min: 0,
      max: 2,
      step: 1,
      default: 0,
      live: true,
      options: [
        { value: 0, label: "Isoterma P × V com construção de Maxwell" },
        { value: 1, label: "Estados correspondentes (10 gases)" },
        { value: 2, label: "Fator de compressibilidade Z × P/P_c" },
      ],
    },
    { key: "taxa", label: "Rapidez da compressão", unit: "1/s", min: 0.02, max: 0.5, step: 0.01, default: 0.12, live: true },
  ],

  observables: [
    { key: "V", label: "Volume molar", unit: "L/mol", value: (s, p) => stateOf(s, p).V * 1000 },
    { key: "P", label: "Pressão de equilíbrio (com Maxwell)", unit: "bar", value: (s, p) => stateOf(s, p).P / 1e5 },
    { key: "Pvdw", label: "Pressão da isoterma de van der Waals", unit: "bar", value: (s, p) => stateOf(s, p).Pvdw / 1e5 },
    { key: "Pid", label: "Pressão do gás ideal RT/V", unit: "bar", value: (s, p) => stateOf(s, p).Pid / 1e5 },
    { key: "Z", label: "Fator de compressibilidade Z", unit: "", value: (s, p) => stateOf(s, p).Z },
    { key: "xl", label: "Fração de líquido", unit: "%", value: (s, p) => 100 * stateOf(s, p).xl },
    { key: "T", label: "Temperatura", unit: "K", value: (s, p) => stateOf(s, p).T },
    { key: "vr", label: "Volume reduzido V/V_c", unit: "", value: (s) => vOf(s) },
    { key: "pr", label: "Pressão reduzida P/P_c", unit: "", value: (s, p) => stateOf(s, p).pEq },
  ],
  chart: { x: "V", y: "P" },

  scenarios: [
    {
      id: "condensacao",
      label: "CO₂ abaixo de T_c: condensação",
      params: { gas: 6, tr: 0.9, vista: 0 },
      guide: `### Comprimindo CO₂ a 0,9 T_c (≈ 274 K)
1. Rode: o pistão comprime o gás à temperatura constante. No começo $P$ sobe quase como no gás ideal (curva tracejada).
2. Ao atingir a curva de coexistência, surge a primeira gota. A partir daí a pressão **fica constante** em $P_s$ enquanto a fração de líquido cresce (regra da alavanca).
3. A isoterma de van der Waals faz um laço nessa região. O laço é trocado pelo patamar que deixa **áreas iguais** (azul e laranja): é a construção de Maxwell. Confira as áreas nas equações vivas.
4. Quando todo o gás vira líquido, a pressão dispara: o líquido é quase incompressível ($V_m \\to b$).
5. Arraste o ponto no diagrama para ir e voltar ao longo da isoterma.`,
      predict: [
        {
          question: "Durante a condensação, enquanto líquido e vapor coexistem e o volume diminui, a pressão:",
          options: ["aumenta, como no gás ideal", "permanece constante", "diminui, seguindo o laço da isoterma"],
          answer: 1,
          explanation:
            "Com as duas fases em equilíbrio a pressão é a de saturação. Diminuir o volume só converte vapor em líquido. O trecho descendente do laço de van der Waals ($\\partial P/\\partial V > 0$) é instável e não é observado.",
        },
      ],
    },
    {
      id: "critico",
      label: "Ponto crítico",
      params: { gas: 6, tr: 1, vista: 0 },
      guide: `### A isoterma crítica
1. Em $T = T_c$ o laço desaparece: a isoterma tem um **ponto de inflexão horizontal**, onde $\\partial P/\\partial V = \\partial^2 P/\\partial V^2 = 0$.
2. Dessas duas condições saem $T_c = 8a/27Rb$, $P_c = a/27b^2$ e $V_c = 3b$. Compare com os valores medidos do CO₂: 304 K e 73,8 bar.
3. Suba para $T/T_c = 1{,}2$: acima de $T_c$ não há condensação, por mais que se comprima. É um **fluido supercrítico**.
4. Desça para 0,85 e veja a região de coexistência alargar.`,
    },
    {
      id: "correspondentes",
      label: "Lei dos estados correspondentes",
      params: { tr: 0.95, vista: 1 },
      guide: `### Dez gases, uma curva
1. À esquerda, as isotermas dos dez gases à mesma $T/T_c$, em bar e L/mol (escala log). O hélio condensa abaixo de 1 bar e 5 K; a água a dezenas de bar e 600 K.
2. À direita, os mesmos dados divididos por $P_c$ e $V_c$: todas as curvas se sobrepõem.
3. Isso vale para qualquer gás de van der Waals: em variáveis reduzidas a equação não tem $a$ nem $b$. Gases reais seguem a lei aproximadamente.
4. Mude $T/T_c$: as curvas continuam coincidindo.`,
      predict: [
        {
          question: "Escrita em P/P_c, V/V_c e T/T_c, a equação de van der Waals de dois gases diferentes:",
          options: ["é a mesma para os dois", "difere pelo valor de a", "difere pelo valor de b"],
          answer: 0,
          explanation: "Substituindo $P = p_rP_c$, $V = v_rV_c$, $T = t_rT_c$ obtém-se $p_r = 8t_r/(3v_r - 1) - 3/v_r^2$, sem nenhuma constante do gás.",
        },
      ],
    },
    {
      id: "compressibilidade",
      label: "Fator de compressibilidade",
      params: { gas: 2, tr: 1.3, vista: 2 },
      guide: `### Quando o gás real se afasta do ideal
1. $Z = PV/RT$ vale 1 para o gás ideal. Rode a compressão e acompanhe o ponto no gráfico.
2. Em pressões moderadas $Z < 1$: a **atração** ($a$) puxa as moléculas e reduz a pressão.
3. Em pressões altas $Z > 1$: o **volume próprio** ($b$) passa a dominar.
4. Em $T_c$ o modelo prevê $Z_c = 3/8 = 0{,}375$. A tabela mostra os valores medidos (0,23 a 0,31): o modelo é qualitativo perto do ponto crítico.`,
      predict: [
        {
          question: "Nitrogênio a 1,3 T_c sendo comprimido a partir de baixa pressão. Antes de chegar a pressões muito altas, Z:",
          options: ["fica igual a 1", "cai abaixo de 1", "sobe acima de 1"],
          answer: 1,
          explanation: "Em densidades moderadas o termo atrativo $-a/V^2$ domina e a pressão é menor que a do gás ideal. Só em densidades altas o volume excluído $b$ leva $Z$ acima de 1.",
        },
      ],
    },
  ],

  exercises: [
    {
      id: "critico",
      prompt: "Um gás de van der Waals tem a = {a} L²·bar/mol² e b = {b} L/mol. Qual é a sua temperatura crítica?",
      vary: { a: [0.5, 6, 2], b: [0.02, 0.06, 3] },
      answer: { label: "T_c", unit: "K", compute: (p) => (8 * num(p, "a")) / (27 * RL * num(p, "b")) },
      hint: "T_c = 8a/(27Rb), com R = 0,08314 L·bar/(mol·K).",
    },
    {
      id: "pressao",
      prompt:
        "1 mol de CO₂ (a = 3,64 L²·bar/mol², b = 0,04267 L/mol) ocupa {Vex} L a {Tex} K. Pela equação de van der Waals, qual é a pressão?",
      vary: { Vex: [0.3, 3, 2], Tex: [310, 600, 0] },
      answer: { label: "P", unit: "bar", compute: (p) => (RL * num(p, "Tex")) / (num(p, "Vex") - 0.04267) - 3.64 / num(p, "Vex") ** 2 },
      hint: "P = RT/(V − b) − a/V², com R = 0,08314 L·bar/(mol·K).",
    },
  ],

  init: () => [V_START],
  derivatives: (s, p) => [-num(p, "taxa", 0.12) * vOf(s)],
  integrator: "rk4",
  dt: 0.01,
  sampleEvery: 2,
  stopWhen: (s, p) => vOf(s) - vStop(tOf(p)),

  pointer: {
    down: (_s, p, pt) => (num(p, "vista") === 0 && inPanel(pt) ? [vFromX(pt.x, tOf(p))] : undefined),
    move: (_s, p, pt, dragging) => (dragging && num(p, "vista") === 0 && inPanel(pt) ? [vFromX(pt.x, tOf(p))] : undefined),
    cursor: (_s, p, pt) => (num(p, "vista") === 0 && inPanel(pt) ? "ew-resize" : undefined),
  },
  actions: [
    { id: "gas", label: "Voltar ao vapor", run: () => [V_START] },
    { id: "critico", label: "Ir ao volume crítico", run: () => [1] },
  ],

  narrowSplit: () => 0.282,
  viewport: () => ({ xMin: 0, xMax: 16, yMin: 0, yMax: 9 }),

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const q = stateOf(frame.state, frame.params);
    const vista = Math.round(num(frame.params, "vista"));
    if (vista === 1) return renderCorresponding(d, q.t);
    drawCylinder(d, q);
    if (vista === 2) renderZ(d, q);
    else renderPV(d, q);
  },
});

const inPanel = (pt: { x: number; y: number }) => pt.x > P.x0 && pt.x < P.x1 && pt.y > P.y0 && pt.y < P.y1;
const vFromX = (x: number, t: number) => Math.min(VMAX, Math.max(vStop(t), ((x - P.x0) / (P.x1 - P.x0)) * VMAX));

type Q = ReturnType<typeof stateOf>;

/** Curva paramétrica em v: x = X(v), y = f(v) (o d.plot usaria v diretamente como x). */
function curveV(d: Draw, X: (v: number) => number, f: (v: number) => number, v0: number, v1: number, s: Parameters<Draw["polyline"]>[1] & { n?: number } = {}) {
  const n = s.n ?? 200;
  const pts: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const v = v0 + ((v1 - v0) * i) / n;
    const y = f(v);
    if (Number.isFinite(y)) pts.push([X(v), y]);
  }
  d.polyline(pts, s);
}

function clipTo(d: Draw, x0: number, y0: number, x1: number, y1: number) {
  d.ctx.save();
  d.ctx.beginPath();
  d.ctx.rect(x0, y0, x1 - x0, y1 - y0);
  d.ctx.clip();
}

function drawCylinder(d: Draw, q: Q) {
  const { theme } = d;
  const x0 = 0.7, x1 = 3.3, y0 = 1.1, yTop = 7.9;
  const h = (Math.min(q.v, VMAX) / VMAX) * (yTop - y0 - 0.3);
  const hl = q.xl > 0 ? Math.min(h, (q.xl * (q.coex ? q.coex.vl : q.v) / q.v) * h) : 0;
  const liquid = theme.dark ? "rgba(91,147,240,0.55)" : "rgba(47,111,217,0.45)";
  const vapor = theme.dark ? "rgba(240,138,84,0.18)" : "rgba(232,116,59,0.14)";
  d.rect(x0, y0 + hl, x1 - x0, h - hl, { fill: q.t >= 1 && q.v < 1.6 ? liquid : vapor, alpha: q.t >= 1 && q.v < 1.6 ? 0.5 : 1 });
  if (hl > 0) d.rect(x0, y0, x1 - x0, hl, { fill: liquid });
  // Moléculas: densas no líquido, esparsas no vapor
  const nv = Math.round(40 * (1 - q.xl) * Math.min(1, 2 / q.v));
  DOTS.slice(0, nv).forEach(([a, b]) => d.dot(x0 + 0.1 + a * (x1 - x0 - 0.2), y0 + hl + 0.08 + b * Math.max(0.05, h - hl - 0.16), 2.2, theme.series[1]!, 0.8));
  if (hl > 0.05) {
    const nl = Math.round(70 * Math.min(1, hl / 1.2));
    DOTS.slice(0, nl).forEach(([a, b]) => d.dot(x0 + 0.08 + a * (x1 - x0 - 0.16), y0 + 0.06 + b * (hl - 0.12), 2.2, theme.series[0]!, 0.9));
  }
  d.line(x0, y0, x0, yTop, { width: 3 });
  d.line(x1, y0, x1, yTop, { width: 3 });
  d.line(x0, y0, x1, y0, { width: 3 });
  d.rect(x0 + 0.04, y0 + h, x1 - x0 - 0.08, 0.3, { fill: d.theme.muted });
  d.line((x0 + x1) / 2, y0 + h + 0.3, (x0 + x1) / 2, 8.6, { color: d.theme.muted, width: 6 });
  d.arrowPx((x0 + x1) / 2 + 0.5, y0 + h + 0.9, 0, -1, 14 + 30 * Math.min(1, q.pEq / pTop(q.t)), { color: theme.positive });
  // Banho térmico
  d.rect(x0 - 0.25, 0.35, x1 - x0 + 0.5, 0.55, { fill: theme.dark ? "rgba(91,156,240,0.35)" : "rgba(47,125,225,0.22)" });
  d.text(`banho a ${fmt(q.T, 4)} K`, (x0 + x1) / 2, 0.62, { size: 10, weight: "600" });
  const phase = q.coex && q.xl > 0 && q.xl < 1 ? `líquido + vapor (${fmt(100 * q.xl, 3)}% líquido)` : q.t >= 1 ? "fluido supercrítico" : q.xl >= 1 ? "líquido" : "vapor";
  d.text(phase, (x0 + x1) / 2, 8.75, { size: 11, weight: "600" });
}

function renderPV(d: Draw, q: Q) {
  const { theme } = d;
  const { t, c } = q;
  const top = pTop(t);
  const X = (v: number) => P.x0 + (v / VMAX) * (P.x1 - P.x0);
  const Y = (p: number) => P.y0 + (Math.max(-0.2, Math.min(1.3, p / top))) * (P.y1 - P.y0);
  const vmin = 1 / 3 + 0.004;

  // Eixos com unidades absolutas
  d.line(P.x0, P.y0, P.x1, P.y0, { color: theme.muted });
  d.line(P.x0, P.y0, P.x0, P.y1, { color: theme.muted });
  d.text("V_m (L/mol)", P.x1, P.y0 - 0.6, { size: 11, color: theme.muted, align: "right" });
  d.text(`P (bar) · ${GASES[q.g.value]!.name}`, P.x0, P.y1 + 0.35, { size: 11, color: theme.muted, align: "left" });
  for (let k = 1; k <= 4; k++) d.text(fmt(k * c.Vc * 1000, 2), X(k), P.y0 - 0.3, { size: 10, color: theme.muted });
  for (const f of [0.25, 0.5, 0.75, 1]) d.text(fmt((f * top * c.Pc) / 1e5, 3), P.x0 - 0.1, Y(f * top), { size: 10, color: theme.muted, align: "right" });

  clipTo(d, P.x0, P.y0, P.x1, P.y1);
  // Volume excluído (V < b)
  d.rect(P.x0, P.y0, X(1 / 3) - P.x0, P.y1 - P.y0, { fill: theme.muted, alpha: 0.15 });
  // Região de coexistência (binodal) sombreada
  const dome: [number, number][] = [
    ...BINODAL.map((b): [number, number] => [X(b.c.vl), Y(b.c.p)]),
    [X(1), Y(1)],
    ...BINODAL.slice().reverse().map((b): [number, number] => [X(b.c.vg), Y(b.c.p)]),
  ];
  d.polyline(dome, { color: theme.muted, width: 1.5, fill: theme.dark ? "rgba(91,156,240,0.10)" : "rgba(47,125,225,0.08)" });
  // Espinodal
  const spin: [number, number][] = [];
  for (let i = 0; i <= 40; i++) {
    const tt = 0.6 + 0.4 * (i / 40) ** 0.5 - 1e-6;
    const s = spinodal(tt);
    if (s) spin.push([X(s.va), Y(s.pa)]);
  }
  for (let i = 40; i >= 0; i--) {
    const tt = 0.6 + 0.4 * (i / 40) ** 0.5 - 1e-6;
    const s = spinodal(tt);
    if (s) spin.push([X(s.vb), Y(s.pb)]);
  }
  d.polyline(spin, { color: theme.muted, width: 1, dash: [2, 4] });
  // Isotermas de fundo (equilíbrio)
  for (const tt of [0.85, 0.95, 1, 1.1, 1.25, 1.45]) {
    if (Math.abs(tt - t) < 0.015) continue;
    curveV(d, X, (v) => Y(equilibrium(tt, v).p), vmin, VMAX, { color: tt === 1 ? theme.text : theme.muted, width: 1, alpha: 0.35, n: 160 });
  }
  // Gás ideal à mesma T: p_r = (8/3) t / v_r
  curveV(d, X, (v) => Y(((8 / 3) * t) / v), vmin, VMAX, { color: theme.muted, width: 1.5, dash: [6, 4] });
  // Construção de Maxwell: áreas iguais
  const co = maxwell(t);
  if (co) {
    const A = lobeAreas(t, co);
    const lobe = (va: number, vb: number): [number, number][] => {
      const pts: [number, number][] = [[X(va), Y(co.p)]];
      for (let i = 0; i <= 60; i++) {
        const v = va + ((vb - va) * i) / 60;
        pts.push([X(v), Y(pr(t, v))]);
      }
      pts.push([X(vb), Y(co.p)]);
      return pts;
    };
    d.polyline(lobe(co.vl, A.vm), { color: "none", fill: theme.series[0]!, alpha: 0.35, close: true });
    d.polyline(lobe(A.vm, co.vg), { color: "none", fill: theme.series[1]!, alpha: 0.35, close: true });
    // Laço de van der Waals (metaestável/instável) tracejado
    curveV(d, X, (v) => Y(pr(t, v)), co.vl, co.vg, { color: theme.accent, width: 1.5, dash: [5, 4] });
    d.line(X(co.vl), Y(co.p), X(co.vg), Y(co.p), { color: theme.accent, width: 3 });
    curveV(d, X, (v) => Y(pr(t, v)), vmin, co.vl, { color: theme.accent, width: 3 });
    curveV(d, X, (v) => Y(pr(t, v)), co.vg, VMAX, { color: theme.accent, width: 3 });
    d.dot(X(co.vl), Y(co.p), 4, theme.series[0]!);
    d.dot(X(co.vg), Y(co.p), 4, theme.series[1]!);
    d.text(`A₁ = ${fmt(A.below * c.Pc * c.Vc, 3)} J/mol`, X((co.vl + A.vm) / 2), Math.min(Y(co.p) - 0.45, Y(pr(t, (co.vl + A.vm) / 2)) - 0.3), { size: 10, color: theme.series[0]! });
    d.text(`A₂ = ${fmt(A.above * c.Pc * c.Vc, 3)} J/mol`, X((A.vm + co.vg) / 2), Math.max(Y(co.p) + 0.4, Y(pr(t, (A.vm + co.vg) / 2)) + 0.3), { size: 10, color: theme.series[1]! });
    d.text(`P_s = ${fmt((co.p * c.Pc) / 1e5, 4)} bar`, X(co.vg) + 0.15, Y(co.p), { size: 10, align: "left", color: theme.accent, weight: "600" });
  } else curveV(d, X, (v) => Y(pr(t, v)), vmin, VMAX, { color: theme.accent, width: 3 });
  // Ponto crítico
  d.dot(X(1), Y(1), 4.5, theme.positive);
  d.text("C", X(1), Y(1), { dx: 9, dy: -9, size: 11, weight: "700", color: theme.positive });
  // Estado atual
  d.line(X(q.v), P.y0, X(q.v), Y(q.pEq), { color: theme.series[1]!, width: 1, dash: [3, 3] });
  d.dot(X(q.v), Y(q.pEq), 6.5, theme.series[1]!);
  d.ctx.restore();

  // Legenda
  const lx = P.x1 - 4.4;
  const ly = P.y1 - 0.3;
  d.line(lx, ly, lx + 0.6, ly, { color: theme.accent, width: 3 });
  d.text(`isoterma T = ${fmt(q.T, 4)} K (Maxwell)`, lx + 0.75, ly, { size: 10, align: "left" });
  d.line(lx, ly - 0.4, lx + 0.6, ly - 0.4, { color: theme.accent, width: 1.5, dash: [5, 4] });
  d.text("laço de van der Waals", lx + 0.75, ly - 0.4, { size: 10, align: "left" });
  d.line(lx, ly - 0.8, lx + 0.6, ly - 0.8, { color: theme.muted, width: 1.5, dash: [6, 4] });
  d.text("gás ideal RT/V", lx + 0.75, ly - 0.8, { size: 10, align: "left" });
  d.rect(lx, ly - 1.32, 0.6, 0.25, { fill: theme.accent, alpha: 0.2, stroke: theme.muted, width: 1 });
  d.text("coexistência líquido–vapor", lx + 0.75, ly - 1.2, { size: 10, align: "left" });
  d.text(
    `T_c = ${fmt(q.c.Tc, 4)} K   P_c = ${fmt(q.c.Pc / 1e5, 4)} bar   V_c = 3b = ${fmt(q.c.Vc * 1000, 3)} L/mol   ·   Z = ${fmt(q.Z, 3)}   ·   arraste o ponto`,
    P.x0,
    0.3,
    { size: 10, color: theme.muted, align: "left" },
  );
}

const GAS_COLORS = (d: Draw, i: number) => d.theme.series[i % d.theme.series.length]!;

function renderCorresponding(d: Draw, t: number) {
  const { theme } = d;
  const L = { x0: 1.2, x1: 7.4, y0: 1.4, y1: 7.6 };
  const Rr = { x0: 9.0, x1: 15.4, y0: 1.4, y1: 7.6 };
  // Painel absoluto em escala log-log: V de 0,02 a 20 L/mol, P de 0,1 a 500 bar.
  const lv0 = Math.log10(0.02), lv1 = Math.log10(20), lp0 = Math.log10(0.1), lp1 = Math.log10(500);
  const XL = (V: number) => L.x0 + ((Math.log10(V) - lv0) / (lv1 - lv0)) * (L.x1 - L.x0);
  const YL = (Pb: number) => L.y0 + Math.min(1.3, (Math.log10(Pb) - lp0) / (lp1 - lp0)) * (L.y1 - L.y0);
  const XR = (v: number) => Rr.x0 + (v / VMAX) * (Rr.x1 - Rr.x0);
  const top = pTop(t);
  const YR = (p: number) => Rr.y0 + Math.max(-0.2, Math.min(1.3, p / top)) * (Rr.y1 - Rr.y0);
  for (const B of [L, Rr]) {
    d.line(B.x0, B.y0, B.x1, B.y0, { color: theme.muted });
    d.line(B.x0, B.y0, B.x0, B.y1, { color: theme.muted });
  }
  d.text("V_m (L/mol), escala log", L.x1, L.y0 - 0.6, { size: 10, color: theme.muted, align: "right" });
  d.text("P (bar), escala log", L.x0, L.y1 + 0.3, { size: 10, color: theme.muted, align: "left" });
  for (const V of [0.1, 1, 10]) d.text(fmt(V), XL(V), L.y0 - 0.25, { size: 9, color: theme.muted });
  for (const Pb of [1, 10, 100]) d.text(fmt(Pb), L.x0 - 0.1, YL(Pb), { size: 9, color: theme.muted, align: "right" });
  d.text("V/V_c", Rr.x1, Rr.y0 - 0.6, { size: 10, color: theme.muted, align: "right" });
  d.text("P/P_c", Rr.x0, Rr.y1 + 0.3, { size: 10, color: theme.muted, align: "left" });
  for (let k = 1; k <= 4; k++) d.text(String(k), XR(k), Rr.y0 - 0.25, { size: 9, color: theme.muted });
  for (const f of [0.5, 1, 1.5]) if (f <= top) d.text(fmt(f), Rr.x0 - 0.1, YR(f), { size: 9, color: theme.muted, align: "right" });

  clipTo(d, L.x0, L.y0, L.x1, L.y1);
  GASES.forEach((g, i) => {
    const c = critical(g);
    const pts: [number, number][] = [];
    for (let k = 0; k <= 120; k++) {
      const v = 0.36 * (60 / 0.36) ** (k / 120);
      const V = v * c.Vc * 1000;
      const Pb = (equilibrium(t, v).p * c.Pc) / 1e5;
      if (Pb > 0) pts.push([XL(V), YL(Pb)]);
    }
    d.polyline(pts, { color: GAS_COLORS(d, i), width: 1.8 });
  });
  d.ctx.restore();
  clipTo(d, Rr.x0, Rr.y0, Rr.x1, Rr.y1);
  GASES.forEach((g, i) => {
    curveV(d, XR, (v) => YR(equilibrium(t, v).p), 0.34, VMAX, { color: GAS_COLORS(d, i), width: 7 - 0.6 * i, alpha: 0.85, n: 160 });
  });
  d.dot(XR(1), YR(1), 4.5, theme.text);
  d.ctx.restore();
  // Legenda dos gases
  GASES.forEach((g, i) => {
    const x = 0.6 + (i % 5) * 3.1;
    const y = 0.75 - Math.floor(i / 5) * 0.45 + 8.0;
    d.line(x, y, x + 0.4, y, { color: GAS_COLORS(d, i), width: 3 });
    d.text(`${g.formula} (T_c = ${fmt(critical(g).Tc, 3)} K)`, x + 0.5, y, { size: 10, align: "left" });
  });
  d.text(`mesma T/T_c = ${fmt(t, 3)}: absolutas (esquerda) × reduzidas (direita)`, 8, 0.45, { size: 11, weight: "600" });
}

function renderZ(d: Draw, q: Q) {
  const { theme } = d;
  const B = { x0: 4.6, x1: 11.2, y0: 1.1, y1: 8.0 };
  const pMax = 6;
  const zMax = 1.3;
  const X = (p: number) => B.x0 + (p / pMax) * (B.x1 - B.x0);
  const Y = (z: number) => B.y0 + Math.max(-0.2, Math.min(1.3, z / zMax)) * (B.y1 - B.y0);
  d.line(B.x0, B.y0, B.x1, B.y0, { color: theme.muted });
  d.line(B.x0, B.y0, B.x0, B.y1, { color: theme.muted });
  d.text("P/P_c", B.x1, B.y0 - 0.6, { size: 11, color: theme.muted, align: "right" });
  d.text("Z = PV/RT", B.x0, B.y1 + 0.35, { size: 11, color: theme.muted, align: "left" });
  for (let k = 0; k <= pMax; k += 1) d.text(String(k), X(k), B.y0 - 0.3, { size: 10, color: theme.muted });
  for (const z of [0.25, 0.5, 0.75, 1, 1.25]) d.text(fmt(z), B.x0 - 0.1, Y(z), { size: 10, color: theme.muted, align: "right" });
  d.line(B.x0, Y(1), B.x1, Y(1), { color: theme.muted, dash: [6, 4] });
  d.text("gás ideal", B.x1, Y(1) + 0.25, { size: 10, color: theme.muted, align: "right" });
  d.line(B.x0, Y(0.375), X(1), Y(0.375), { color: theme.positive, dash: [2, 3], width: 1 });
  clipTo(d, B.x0, B.y0, B.x1, B.y1);
  const curve = (t: number): [number, number][] => {
    const pts: [number, number][] = [];
    for (let k = 0; k <= 300; k++) {
      const v = 60 * (0.345 / 60) ** (k / 300);
      const p = equilibrium(t, v).p;
      if (p > pMax * 1.05) break;
      pts.push([X(p), Y(Zr(t, v, p))]);
    }
    return pts;
  };
  const ts = [0.9, 1, 1.1, 1.3, 1.6, 2.2];
  ts.forEach((t, i) => {
    const pts = curve(t);
    d.polyline(pts, { color: theme.muted, width: 1.2, alpha: 0.6 });
    const last = pts[pts.length - 1];
    if (last && i > 0) d.text(fmt(t), last[0], last[1], { size: 9, color: theme.muted, dx: -8, dy: -7 });
  });
  d.polyline(curve(q.t), { color: theme.accent, width: 3 });
  d.dot(X(q.pEq), Y(q.Z), 6.5, theme.series[1]!);
  d.dot(X(1), Y(0.375), 4.5, theme.positive);
  d.ctx.restore();
  d.text("Z_c = 3/8", X(1), Y(0.375), { dx: 10, dy: 10, size: 10, color: theme.positive, align: "left" });
  d.text(`curva destacada: T/T_c = ${fmt(q.t, 3)}; cinzas: 0,9 a 2,2`, B.x0, 0.35, { size: 10, color: theme.muted, align: "left" });

  // Tabela: Z_c medido × 3/8
  const tx = 11.8;
  d.text("Z_c medido (modelo: 0,375)", tx, 8.1, { size: 11, weight: "600", align: "left" });
  GASES.forEach((g, i) => {
    const y = 7.5 - i * 0.6;
    const hl = g.value === q.g.value;
    d.text(g.formula, tx, y, { size: 10, align: "left", weight: hl ? "700" : "400" });
    d.rect(tx + 1.0, y - 0.15, (g.Zc / 0.4) * 2.4, 0.3, { fill: hl ? theme.accent : theme.muted, alpha: hl ? 0.9 : 0.5 });
    d.text(fmt(g.Zc, 3), tx + 1.1 + (g.Zc / 0.4) * 2.4, y, { size: 10, align: "left" });
  });
  d.line(tx + 1.0 + (0.375 / 0.4) * 2.4, 1.6, tx + 1.0 + (0.375 / 0.4) * 2.4, 7.8, { color: theme.positive, dash: [3, 3], width: 1 });
}

export default vanDerWaals;
