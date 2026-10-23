import { clamp, defineSim, draw, num, texNum, type Params } from "@fisilab/core";
import {
  CHI_DIA,
  curieChi,
  energyPerSpin,
  L,
  makeLattice,
  magnetization,
  onsagerM,
  paraM,
  sweep,
  TC,
  type Lattice,
} from "./model.ts";

export * from "./model.ts";

export interface MState {
  lat: Lattice;
  /** Campo aplicado atual h = μB/J. */
  h: number;
  /** Temperatura atual em unidades de T_c. */
  Tr: number;
  /** Magnetização por spin (M/M_s). */
  m: number;
}

export const DIA = 0;
export const PARA = 1;
export const FERRO = 2;

export const kind = (p: Params) => Math.round(num(p, "tipo", FERRO));
const sweepMode = (p: Params) => Math.round(num(p, "varredura", 1));
/** Desordem (campos aleatórios) por material: o macio tem muitos sítios de nucleação. */
export const disorderOf = (p: Params) => (kind(p) === FERRO && Math.round(num(p, "material")) === 0 ? 1.5 : 0);
const J = (p: Params) => (kind(p) === FERRO ? 1 : 0);

/** Período do ciclo de histerese (s) e duração da rampa de T (s). */
export const RAMP_T = 40;

/** Campo h(t): manual, onda triangular de amplitude H0 começando em 0, ou nulo na rampa de T. */
export function fieldAt(p: Params, t: number): number {
  const m = sweepMode(p);
  if (m === 0) return num(p, "h", 0);
  if (m === 2) return 0;
  const P = num(p, "periodo", 20);
  const ph = (((t / P) % 1) + 1) % 1;
  const tri = ph < 0.25 ? 4 * ph : ph < 0.75 ? 2 - 4 * ph : 4 * ph - 4;
  return num(p, "H0", 3) * tri;
}

export function tempAt(p: Params, t: number): number {
  if (sweepMode(p) === 2) return 0.5 + Math.min(t / RAMP_T, 1);
  return num(p, "Tr", 0.6);
}

/** Valor de equilíbrio de M previsto pela teoria para o material e as condições atuais. */
export function theoryM(p: Params, h: number, Tr: number): number {
  const k = kind(p);
  if (k === DIA) return CHI_DIA * h;
  if (k === PARA) return paraM(h, Tr * TC);
  return onsagerM(Tr * TC);
}

const fmt = (v: number, d = 2) => v.toFixed(d).replace(".", ",").replace(/^-(0,0+)$/, "$1");

// Layout
const LAT = { x0: 0, y0: 0, size: 40 };
const PLOT = { x0: 50, x1: 74, y0: 8, y1: 32 };

export const magnetismoMateria = defineSim<MState>({
  id: "magnetismo-materia",
  title: "Magnetismo na matéria e histerese",
  course: "FG III",
  topic: "Magnetismo",
  priority: "P2",
  summary:
    "Momentos magnéticos numa rede respondem a um campo aplicado: indução oposta no diamagneto, alinhamento parcial (lei de Curie) no paramagneto e domínios com histerese no ferromagneto, simulado pelo modelo de Ising 2D com Metropolis.",
  equations: [
    String.raw`E = -J\sum_{\langle ij\rangle} s_i s_j - \sum_i (h + h_i)\,s_i,\qquad s_i = \pm1,\quad h = \mu B`,
    String.raw`\text{Metropolis: } P(\text{virar}) = \min\!\left(1,\ e^{-\Delta E/k_BT}\right),\quad \Delta E = 2s_i\Big(J\sum_{\text{viz}} s_j + h + h_i\Big)`,
    String.raw`\text{dia: } M = \chi H,\ \chi < 0 \qquad \text{para: } \frac{M}{M_s} = \tanh\frac{\mu B}{k_BT} \approx \frac{\mu B}{k_BT}\ \Rightarrow\ \chi = \frac{C}{T}\ \text{(Curie)}`,
    String.raw`\text{ferro (Onsager): } k_BT_c = \frac{2J}{\ln(1+\sqrt2)} \approx 2{,}27J,\qquad M_0(T) = \left[1 - \operatorname{senh}^{-4}\!\frac{2J}{k_BT}\right]^{1/8}`,
  ],
  liveEquations(s, p) {
    const k = kind(p);
    const T = s.Tr * TC;
    if (k === DIA) return [String.raw`M = \chi h = (${texNum(CHI_DIA)})(${texNum(s.h)}) = ${texNum(s.m)}\ M_s`];
    if (k === PARA)
      return [
        String.raw`\frac{M}{M_s} = ${texNum(s.m)} \qquad \tanh\frac{h}{k_BT} = \tanh\frac{${texNum(s.h)}}{${texNum(T)}} = ${texNum(paraM(s.h, T))}`,
        String.raw`\chi_{\text{Curie}} = \frac{1}{k_BT} = ${texNum(curieChi(T))}`,
      ];
    return [
      String.raw`T/T_c = ${texNum(s.Tr)} \qquad h = ${texNum(s.h)} \qquad M/M_s = ${texNum(s.m)}`,
      String.raw`M_0^{\text{Onsager}}(T) = ${texNum(onsagerM(T))} \qquad E/N = ${texNum(energyPerSpin(s.lat.s, 1, s.h))}\,J`,
    ];
  },

  params: [
    {
      key: "tipo",
      label: "Material",
      unit: "",
      min: 0,
      max: 2,
      step: 1,
      default: FERRO,
      options: [
        { value: DIA, label: "Diamagnético (ex.: bismuto, água)" },
        { value: PARA, label: "Paramagnético (ex.: alumínio, O₂)" },
        { value: FERRO, label: "Ferromagnético (ex.: ferro)" },
      ],
    },
    {
      key: "material",
      label: "Ferromagneto",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 1,
      options: [
        { value: 0, label: "Macio (muitos defeitos, inverte fácil)" },
        { value: 1, label: "Duro (inversão difícil, ímã permanente)" },
      ],
    },
    {
      key: "varredura",
      label: "Campo aplicado",
      unit: "",
      min: 0,
      max: 2,
      step: 1,
      default: 1,
      options: [
        { value: 0, label: "Manual (slider h)" },
        { value: 1, label: "Ciclo automático (histerese)" },
        { value: 2, label: "Rampa de temperatura (h = 0)" },
      ],
    },
    { key: "Tr", label: "Temperatura T/T_c", unit: "", min: 0.1, max: 2.5, step: 0.05, default: 0.6, live: true },
    { key: "h", label: "Campo manual h = μB/J", unit: "", min: -4, max: 4, step: 0.05, default: 0, live: true },
    { key: "H0", label: "Amplitude do ciclo", unit: "", min: 0.5, max: 4, step: 0.1, default: 3, live: true },
    { key: "periodo", label: "Período do ciclo", unit: "s", min: 5, max: 60, step: 1, default: 20 },
    {
      key: "inicio",
      label: "Estado inicial",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 0,
      options: [
        { value: 0, label: "Desmagnetizado (aleatório)" },
        { value: 1, label: "Magnetizado (todos para cima)" },
      ],
    },
  ],

  observables: [
    { key: "h", label: "Campo aplicado h", unit: "", value: (s) => s.h },
    { key: "M", label: "Magnetização M/M_s", unit: "", value: (s) => s.m },
    { key: "absM", label: "|M|/M_s", unit: "", value: (s) => Math.abs(s.m) },
    { key: "Tr", label: "Temperatura T/T_c", unit: "", value: (s) => s.Tr },
    { key: "Mteo", label: "M de equilíbrio (teoria)", unit: "", value: (s, p) => theoryM(p, s.h, s.Tr) },
    { key: "chi", label: "Susceptibilidade M/h", unit: "", value: (s) => (Math.abs(s.h) > 1e-6 ? s.m / s.h : 0) },
    { key: "E", label: "Energia por spin", unit: "J", value: (s, p) => (kind(p) === DIA ? 0 : energyPerSpin(s.lat.s, J(p), s.h)) },
  ],
  chart: { x: "h", y: "M" },

  scenarios: [
    {
      id: "histerese",
      label: "Laço de histerese",
      params: { tipo: FERRO, material: 1, varredura: 1, Tr: 0.6, H0: 3, inicio: 0 },
      guide: `### Domínios e histerese
1. A rede começa desmagnetizada. Rode e veja a **curva de primeira magnetização**: os domínios alinhados com $h$ crescem.
2. Quando $h$ volta a zero, $M$ **não** volta: essa é a remanência $M_r$.
3. Leia no gráfico $M \\times h$ o campo coercivo $h_c$ (onde $M = 0$).
4. Troque para o ferromagneto **macio** e compare $h_c$ e a área do laço (energia dissipada por ciclo).
5. Aumente $T/T_c$ para 0,9: o laço encolhe.`,
      predict: [
        {
          question: "Depois de saturar o ferromagneto e desligar o campo (h = 0), a magnetização…",
          options: ["Volta a zero", "Fica num valor alto (remanência)", "Inverte de sinal"],
          answer: 1,
          explanation:
            "Abaixo de T_c o estado alinhado é estável: virar a magnetização exige nuclear um domínio oposto, o que custa energia de parede. Por isso o ímã \"lembra\" o campo.",
        },
      ],
    },
    {
      id: "curie",
      label: "Temperatura de Curie",
      params: { tipo: FERRO, material: 1, varredura: 2, inicio: 1 },
      guide: `### Aquecendo um ímã
1. A rede começa toda magnetizada e $T$ sobe de $0{,}5\\,T_c$ a $1{,}5\\,T_c$ em 40 s, com $h = 0$.
2. Ponha o gráfico com $T/T_c$ no eixo x e $|M|$ no eixo y; compare com a curva de Onsager (observável "M de equilíbrio").
3. Perto de $T_c$ os domínios ficam enormes e flutuantes; acima, a ordem some.
4. Por que um ímã aquecido além da temperatura de Curie deixa de ser ímã?`,
      predict: [
        {
          question: "O que acontece com a magnetização espontânea (h = 0) quando T passa de T_c?",
          options: ["Dobra", "Cai a praticamente zero", "Não muda", "Inverte de sinal"],
          answer: 1,
          explanation: "Acima de T_c a agitação térmica vence o acoplamento de troca e os spins ficam desordenados: M espontânea é nula (a menos de flutuações de uma rede finita).",
        },
      ],
    },
    {
      id: "para",
      label: "Paramagneto e lei de Curie",
      params: { tipo: PARA, varredura: 0, h: 1, Tr: 1 },
      guide: `### Alinhamento parcial
1. Sem acoplamento ($J = 0$), cada momento só sente $h$ e a agitação térmica.
2. Compare $M/M_s$ com $\\tanh(h/k_BT)$ nas equações.
3. Mantenha $h$ pequeno e dobre $T$: $\\chi = M/h$ cai à metade (lei de Curie, $\\chi \\propto 1/T$).
4. Ponha $h = 0$: a magnetização some na hora; não há remanência.`,
    },
    {
      id: "dia",
      label: "Diamagnetismo",
      params: { tipo: DIA, varredura: 1, H0: 3 },
      guide: `### Resposta oposta ao campo
1. Os átomos não têm momento próprio; o campo induz correntes atômicas (lei de Lenz) que criam momentos **contrários** a $h$.
2. Veja no gráfico: $M \\times h$ é uma reta de inclinação negativa, sem histerese e sem dependência de $T$.
3. O efeito real é minúsculo ($\\chi \\sim -10^{-5}$); aqui ele está exagerado para ser visível.`,
    },
  ],

  exercises: [
    {
      id: "curie",
      prompt:
        "Um sal paramagnético tem susceptibilidade χ = {chi1} × 10⁻⁴ a {T1} K. Pela lei de Curie, qual a susceptibilidade a {T2} K (em unidades de 10⁻⁴)?",
      vary: { chi1: [1, 9, 1], T1: [200, 350, 0], T2: [4, 80, 0] },
      answer: { label: "χ", unit: "× 10⁻⁴", compute: (p) => (num(p, "chi1") * num(p, "T1")) / num(p, "T2") },
      hint: "χ = C/T: o produto χT é constante.",
    },
    {
      id: "spin-meio",
      prompt:
        "Momentos de spin ½ (μ = 9,27 × 10⁻²⁴ J/T) estão num campo de {B} T a {T} K. Qual a fração M/M_s = tanh(μB/k_BT)?",
      vary: { B: [1, 10, 1], T: [1, 20, 0] },
      answer: { label: "M/M_s", unit: "", compute: (p) => Math.tanh((9.274e-24 * num(p, "B")) / (1.380649e-23 * num(p, "T"))) },
      hint: "Calcule x = μB/(k_BT) e depois tanh x.",
    },
  ],

  init(p) {
    const start = Math.round(num(p, "inicio")) === 1 ? "up" : "random";
    const lat = makeLattice(start, disorderOf(p), 2024);
    const h = fieldAt(p, 0);
    const Tr = tempAt(p, 0);
    return { lat, h, Tr, m: kind(p) === DIA ? CHI_DIA * h : magnetization(lat.s) };
  },

  step(s, p, t, dt) {
    const h = fieldAt(p, t + dt);
    const Tr = tempAt(p, t + dt);
    if (kind(p) === DIA) return { ...s, h, Tr, m: CHI_DIA * h };
    const lat = sweep(s.lat, J(p), h, Tr * TC);
    return { lat, h, Tr, m: magnetization(lat.s) };
  },
  dt: 0.05,
  sampleEvery: 2,
  maxSamples: 3000,

  narrowSplit: () => 0.535,
  viewport: () => ({ xMin: -2, xMax: 78, yMin: -7, yMax: 42 }),

  render(ctx, frame) {
    const { state: s, params: p, theme } = frame;
    const d = draw(ctx, frame);
    const k = kind(p);
    const up = theme.series[1] ?? theme.positive;
    const down = theme.series[0] ?? theme.negative;

    if (k === DIA) {
      // Átomos com correntes induzidas e momentos opostos ao campo.
      const n = 8;
      const step = LAT.size / n;
      for (let i = 0; i < n; i++)
        for (let j = 0; j < n; j++) {
          const cx = LAT.x0 + (i + 0.5) * step, cy = LAT.y0 + (j + 0.5) * step;
          d.circle(cx, cy, 0.6, { fill: theme.muted });
          d.circle(cx, cy, 1.6, { stroke: theme.muted, width: 1, alpha: 0.6 });
          if (Math.abs(s.h) > 0.02) {
            // Sentido da corrente induzida (horário se h > 0, vista de cima: momento para baixo).
            const sg = s.h > 0 ? -1 : 1;
            d.arrowPx(cx + 1.6, cy, 0, sg, 7, { color: theme.accent, width: 1.2, head: 6 });
            d.arrowPx(cx - 1.6, cy, 0, -sg, 7, { color: theme.accent, width: 1.2, head: 6 });
            d.arrow(cx, cy, 0, clamp(-s.h * 0.5, -2, 2), { color: down, width: 2 });
          }
        }
    } else {
      for (let j = 0; j < L; j++)
        for (let i = 0; i < L; i++) {
          const v = s.lat.s[i + j * L]!;
          d.rect(LAT.x0 + i, LAT.y0 + j, 1, 1, { fill: v > 0 ? up : down, alpha: 0.85 });
        }
      // Setas de momento médio em blocos 5 × 5 (mostram os domínios).
      for (let bj = 0; bj < L / 5; bj++)
        for (let bi = 0; bi < L / 5; bi++) {
          let m = 0;
          for (let j = 0; j < 5; j++) for (let i = 0; i < 5; i++) m += s.lat.s[bi * 5 + i + (bj * 5 + j) * L]!;
          m /= 25;
          const cx = LAT.x0 + bi * 5 + 2.5, cy = LAT.y0 + bj * 5 + 2.5;
          if (Math.abs(m) > 0.1) d.arrow(cx, cy - m * 1.8, 0, m * 3.6, { color: theme.dark ? "#ffffff" : "#1c2430", width: 1.6, head: 7, alpha: 0.75 });
        }
    }
    d.rect(LAT.x0, LAT.y0, LAT.size, LAT.size, { stroke: theme.muted, width: 1 });

    // Indicador do campo aplicado
    const hx = 44;
    d.line(hx, 2, hx, 38, { color: theme.grid, width: 1 });
    if (Math.abs(s.h) > 1e-3) d.arrow(hx, 20, 0, clamp(s.h * 4, -17, 17), { color: theme.accent, width: 3 });
    d.text(`h = ${fmt(s.h)}`, hx, 40, { color: theme.accent, size: 12, weight: "600" });

    // Curva M × h com o rastro
    const H0 = Math.max(num(p, "H0", 3), Math.abs(num(p, "h")), 1);
    const sx = (h: number) => (PLOT.x0 + PLOT.x1) / 2 + (h / (H0 * 1.1)) * ((PLOT.x1 - PLOT.x0) / 2);
    const mScale = k === DIA ? Math.abs(CHI_DIA) * H0 * 1.2 : 1.1;
    const sy = (m: number) => (PLOT.y0 + PLOT.y1) / 2 + (m / mScale) * ((PLOT.y1 - PLOT.y0) / 2);
    const xm = sweepMode(p) === 2;
    const xOf = (st: MState) => (xm ? PLOT.x0 + ((st.Tr - 0.5) / 1.0) * (PLOT.x1 - PLOT.x0) : sx(st.h));
    d.line(PLOT.x0, sy(0), PLOT.x1, sy(0), { color: theme.muted, width: 1 });
    if (!xm) d.line(sx(0), PLOT.y0, sx(0), PLOT.y1, { color: theme.muted, width: 1 });
    else d.line(PLOT.x0, PLOT.y0, PLOT.x0, PLOT.y1, { color: theme.muted, width: 1 });
    // Teoria de equilíbrio
    if (xm) d.plot((x) => sy(onsagerM((0.5 + (x - PLOT.x0) / (PLOT.x1 - PLOT.x0)) * TC)), PLOT.x0, PLOT.x1, { color: theme.muted, width: 1.2, dash: [4, 3] });
    else if (k !== FERRO) d.plot((x) => sy(theoryM(p, ((x - (PLOT.x0 + PLOT.x1) / 2) / ((PLOT.x1 - PLOT.x0) / 2)) * H0 * 1.1, s.Tr)), PLOT.x0, PLOT.x1, { color: theme.muted, width: 1.2, dash: [4, 3] });
    const pts = frame.trail.slice(-1500).map((st) => [xOf(st), sy(xm ? Math.abs(st.m) : st.m)] as [number, number]);
    d.polyline(pts, { color: theme.series[2], width: 1.8 });
    d.dot(xOf(s), sy(xm ? Math.abs(s.m) : s.m), 4.5, theme.series[1]!);
    d.text(xm ? "|M| × T/T_c" : "M × h", PLOT.x0, PLOT.y1 + 2, { color: theme.text, size: 13, weight: "600", align: "left" });
    d.text(xm ? "T/T_c: 0,5 → 1,5" : "h", PLOT.x1, sy(0) - 1.4, { color: theme.muted, size: 11, align: "right" });
    d.text("tracejado: equilíbrio (teoria)", PLOT.x0, PLOT.y0 - 2, { color: theme.muted, size: 11, align: "left" });

    // Legenda
    const name = ["Diamagneto", "Paramagneto (J = 0)", "Ferromagneto (Ising, J = 1)"][k]!;
    d.text(`${name}   T/T_c = ${fmt(s.Tr)}   M/M_s = ${fmt(s.m, k === DIA ? 3 : 2)}`, 0, -2.5, { color: theme.text, size: 13, align: "left", weight: "600" });
    if (k !== DIA) {
      d.rect(0, -6, 1.4, 1.4, { fill: up });
      d.text("spin ↑", 2, -5.3, { color: theme.muted, size: 11, align: "left" });
      d.rect(8, -6, 1.4, 1.4, { fill: down });
      d.text("spin ↓", 10, -5.3, { color: theme.muted, size: 11, align: "left" });
      d.text("setas: momento médio de cada bloco 5×5", 17, -5.3, { color: theme.muted, size: 11, align: "left" });
    } else d.text("círculos: correntes atômicas induzidas (Lenz); setas: momento induzido, oposto a h", 0, -5.3, { color: theme.muted, size: 11, align: "left" });
  },
});

export default magnetismoMateria;
