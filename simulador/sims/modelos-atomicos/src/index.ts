import { defineSim, draw, num, rng, texNum, type Draw, type Params, type Theme } from "@fisilab/core";
import { wavelengthColor } from "./color.ts";
import { fmt, panel } from "./panel.ts";
import {
  BIN_DEG,
  NBINS,
  SERIES,
  bohrEnergy,
  bohrRadius,
  expectedCount,
  lineNm,
  rutherfordAngle,
  rutherfordDnDOmega,
  rutherfordTrajectory,
  solidAngle,
  thomsonTrajectory,
  type Trajectory,
} from "./physics.ts";

export * from "./physics.ts";

export interface Photon {
  lam: number;
  age: number;
  ang: number;
}

export interface Line {
  ni: number;
  nf: number;
  c: number;
}

export interface AtomState {
  /** Espalhamento: alfas lançadas, acumulador da taxa, histograma (bins de 5°), trajetórias recentes. */
  n: number;
  acc: number;
  hist: number[];
  recent: Trajectory[];
  back: number;
  lastTheta: number;
  /** Bohr: nível atual, fase orbital, relógio de transição, fótons em voo, linhas registradas. */
  level: number;
  phase: number;
  timer: number;
  jumps: number;
  photons: Photon[];
  lines: Line[];
  lastLam: number;
}

const modo = (p: Params) => Math.round(num(p, "modo"));
const Zb = (p: Params) => Math.round(num(p, "Z", 1));
const niP = (p: Params) => Math.round(num(p, "ni", 3));
const nfP = (p: Params) => Math.min(Math.round(num(p, "nf", 2)), niP(p) - 1);
/** Raio efetivo do feixe: b_max no modelo nuclear; o próprio átomo (R) no de Thomson. */
const beamRadius = (p: Params) => (modo(p) === 1 ? num(p, "R", 100) : num(p, "bmax", 5));
/** d em fm para alfas de energia K (MeV) no ouro: d = k·2·79e²/K. */
const dFm = (p: Params) => (2 * 79 * 1.439964) / num(p, "K", 5);

const MAX_RECENT = 20;
const TAU = 0.7;

function launch(s: AtomState, p: Params): AtomState {
  const rand = rng(77_001 + s.n * 7919);
  const B = beamRadius(p);
  const b = B * Math.sqrt(rand());
  const sign = rand() < 0.5 ? -1 : 1;
  const view = viewHalf(p);
  const tr = modo(p) === 1 ? thomsonTrajectory(b, B) : rutherfordTrajectory(b, 3, 2 * view);
  const hist = s.hist.slice();
  const bin = Math.min(NBINS - 1, Math.floor((tr.theta * 180) / Math.PI / BIN_DEG));
  hist[bin] = (hist[bin] ?? 0) + 1;
  const shown: Trajectory = { ...tr, pts: tr.pts.map(([x, y]) => [x, sign * y]) };
  return {
    ...s,
    n: s.n + 1,
    hist,
    back: s.back + (tr.theta > Math.PI / 2 ? 1 : 0),
    lastTheta: tr.theta,
    recent: [...s.recent.slice(-(MAX_RECENT - 1)), shown],
  };
}

function bohrStep(s: AtomState, p: Params, dt: number): AtomState {
  const Z = Zb(p);
  let { level, timer, jumps, lastLam } = s;
  const photons = s.photons.map((ph) => ({ ...ph, age: ph.age + dt })).filter((ph) => ph.age < 2);
  let lines = s.lines;
  const phase = s.phase + (8 / level ** 3) * dt;
  timer += dt;
  if (timer >= TAU) {
    timer = 0;
    const rand = rng(31_337 + jumps * 104729);
    jumps++;
    const lamp = Math.round(num(p, "bohrModo")) === 0;
    let to: number;
    if (lamp) to = level === 1 ? 2 + Math.floor(rand() * (niP(p) - 1)) : 1 + Math.floor(rand() * (level - 1));
    else to = level === niP(p) ? nfP(p) : niP(p);
    if (to < level) {
      const lam = lineNm(level, to, Z);
      lastLam = lam;
      photons.push({ lam, age: 0, ang: phase });
      const i = lines.findIndex((l) => l.ni === level && l.nf === to);
      lines = i >= 0 ? lines.map((l, j) => (j === i ? { ...l, c: l.c + 1 } : l)) : [...lines, { ni: level, nf: to, c: 1 }];
    }
    level = to;
  }
  return { ...s, level, phase, timer, jumps, photons, lines, lastLam };
}

/** Meia largura (em d) da região de trajetórias mostrada. */
function viewHalf(p: Params): number {
  return modo(p) === 1 ? 1.6 * num(p, "R", 100) : Math.max(4, 2.2 * num(p, "bmax", 5));
}

export const modelosAtomicos = defineSim<AtomState>({
  id: "modelos-atomicos",
  title: "Modelos atômicos: Thomson, Rutherford e Bohr",
  course: "FG IV",
  topic: "Átomo",
  priority: "P1",
  summary:
    "Dispare partículas alfa contra um núcleo pontual ou um átomo de Thomson e compare o histograma de ângulos com a lei 1/sin⁴(θ/2). Depois, veja as transições do átomo de Bohr formarem o espectro do hidrogênio.",
  equations: [
    String.raw`\tan\frac{\theta}{2} = \frac{d}{2b} \qquad d = \frac{1}{4\pi\varepsilon_0}\frac{2Ze^2}{K}`,
    String.raw`\frac{dN}{d\Omega} = \frac{N}{\pi b_{\max}^2}\left(\frac{d}{4}\right)^2 \frac{1}{\sin^4(\theta/2)}`,
    String.raw`E_n = -\frac{13{,}6\ \text{eV}\, Z^2}{n^2} \qquad r_n = \frac{n^2 a_0}{Z}`,
    String.raw`\frac{1}{\lambda} = R_H Z^2\left(\frac{1}{n_f^2} - \frac{1}{n_i^2}\right)`,
  ],
  liveEquations(s, p) {
    if (modo(p) === 2) {
      const Z = Zb(p);
      const ni = niP(p);
      const nf = nfP(p);
      return [
        String.raw`E_{${s.level}} = ${texNum(bohrEnergy(s.level, Z), 4)}\ \text{eV} \qquad r_{${s.level}} = ${texNum(bohrRadius(s.level, Z))}\, a_0`,
        String.raw`${ni} \to ${nf}:\ \lambda = \frac{hc}{E_{${ni}} - E_{${nf}}} = ${texNum(lineNm(ni, nf, Z), 4)}\ \text{nm}`,
      ];
    }
    const B = beamRadius(p);
    return [
      String.raw`d = ${texNum(dFm(p))}\ \text{fm} \ (\text{ouro}, K = ${texNum(num(p, "K", 5))}\ \text{MeV}) \qquad b_{\max} = ${texNum(B)}\, d`,
      String.raw`N = ${s.n} \qquad N(\theta > 90^\circ) = ${s.back} \qquad \text{previsto (Rutherford): } ${texNum(s.n * expectedCount(Math.PI / 2, Math.PI, 1, B))}`,
    ];
  },

  params: [
    {
      key: "modo",
      label: "Modelo",
      unit: "",
      min: 0,
      max: 2,
      step: 1,
      default: 0,
      options: [
        { value: 0, label: "Rutherford: núcleo pontual" },
        { value: 1, label: "Thomson: carga positiva espalhada" },
        { value: 2, label: "Bohr: níveis e espectro" },
      ],
    },
    { key: "taxa", label: "Alfas por segundo", unit: "1/s", min: 10, max: 2000, step: 10, default: 400, log: true, live: true },
    { key: "bmax", label: "Raio do feixe b_max (em d)", unit: "", min: 1, max: 20, step: 0.5, default: 5 },
    { key: "R", label: "Raio da carga positiva (Thomson, em d)", unit: "", min: 0.5, max: 3000, step: 0.5, default: 100, log: true },
    { key: "K", label: "Energia das alfas (para d em fm)", unit: "MeV", min: 1, max: 10, step: 0.1, default: 5, live: true },
    {
      key: "Z",
      label: "Átomo (Bohr)",
      unit: "",
      min: 1,
      max: 3,
      step: 1,
      default: 1,
      options: [
        { value: 1, label: "H (Z = 1)" },
        { value: 2, label: "He⁺ (Z = 2)" },
        { value: 3, label: "Li²⁺ (Z = 3)" },
      ],
    },
    {
      key: "bohrModo",
      label: "Transições (Bohr)",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 1,
      live: true,
      options: [
        { value: 0, label: "Lâmpada: excitações e decaimentos aleatórios até n_i" },
        { value: 1, label: "Só a transição n_i → n_f" },
      ],
    },
    { key: "ni", label: "Nível superior n_i", unit: "", min: 2, max: 7, step: 1, default: 3, live: true },
    { key: "nf", label: "Nível inferior n_f", unit: "", min: 1, max: 6, step: 1, default: 2, live: true },
  ],

  observables: [
    { key: "N", label: "Alfas detectadas", unit: "", value: (s) => s.n },
    { key: "frac90", label: "Fração com θ > 90°", unit: "%", value: (s) => (s.n ? (100 * s.back) / s.n : 0) },
    { key: "theta", label: "Último ângulo θ", unit: "°", value: (s) => (s.lastTheta * 180) / Math.PI },
    { key: "nivel", label: "Nível n (Bohr)", unit: "", value: (s) => s.level },
    { key: "En", label: "Energia E_n (Bohr)", unit: "eV", value: (s, p) => bohrEnergy(s.level, Zb(p)) },
    { key: "lam", label: "Último fóton λ", unit: "nm", value: (s) => s.lastLam },
  ],
  chart: { x: "t", y: "frac90" },

  scenarios: [
    {
      id: "rutherford",
      label: "Espalhamento de Rutherford",
      params: { modo: 0, bmax: 5, taxa: 400 },
      guide: `### Contando alfas
1. Cada alfa chega com parâmetro de impacto $b$ sorteado uniformemente num disco de raio $b_{\\max}$; a trajetória é integrada numericamente (RK4) sob a força de Coulomb.
2. O histograma (escala log) mostra $dN/d\\Omega$ por faixa de 5°. A curva é $1/\\sin^4(\\theta/2)$ de Rutherford, sem nenhum ajuste.
3. Abaixo de $\\theta_{\\min} = 2\\arctan(d/2b_{\\max})$ o feixe acaba e o histograma cai: é um efeito do feixe finito.
4. Compare a fração com $\\theta > 90°$ com a previsão $(d/2b_{\\max})^2$.`,
      predict: [
        {
          question: "Uma alfa com parâmetro de impacto b = d/2 é desviada de quanto?",
          options: ["cerca de 30°", "90°", "180°", "quase nada"],
          answer: 1,
          explanation: "$\\tan(\\theta/2) = d/(2b) = 1$, logo $\\theta/2 = 45°$ e $\\theta = 90°$. Todas as alfas com $b < d/2$ voltam para trás.",
        },
      ],
    },
    {
      id: "thomson",
      label: "Pudim de passas (Thomson)",
      params: { modo: 1, R: 100, taxa: 400 },
      guide: `### O que Thomson previa
1. Agora a carga positiva está espalhada numa esfera de raio $R$ e o átomo é neutro por fora.
2. Com $R = 100\\,d$ os desvios são de décimos de grau: nenhuma alfa volta. Num átomo de ouro real, $R/d \\approx 3000$.
3. Diminua $R$. Só quando $R \\lesssim d$ aparecem grandes desvios: a carga positiva tem de estar concentrada numa região menor que $d \\approx 45\\ \\text{fm}$.
4. Foi essa a conclusão de Rutherford em 1911 a partir das contagens de Geiger e Marsden.`,
      predict: [
        {
          question: "No modelo de Thomson (R = 100 d), que fração das alfas é desviada mais de 90°?",
          options: ["cerca de 1%", "cerca de 1 em 10 000", "nenhuma", "metade"],
          answer: 2,
          explanation:
            "A força máxima dentro de uma esfera difusa é pequena: o desvio máximo é da ordem de $d/R$ radianos, menos de 1°. Rutherford viu cerca de 1 alfa em 8000 voltar, o que exige um núcleo pequeno.",
        },
      ],
    },
    {
      id: "balmer",
      label: "Bohr: linhas de Balmer",
      params: { modo: 2, Z: 1, bohrModo: 1, ni: 3, nf: 2 },
      guide: `### A série de Balmer
1. O elétron salta de $n_i = 3$ para $n_f = 2$ e emite um fóton vermelho (H$\\alpha$, 656 nm).
2. Mude $n_i$ para 4, 5, 6: as linhas azul e violeta aparecem e se acumulam perto do limite da série (365 nm).
3. Com $n_f = 1$ (Lyman) os fótons são ultravioleta; com $n_f = 3$ (Paschen), infravermelho.
4. Confira $1/\\lambda = R_H(1/n_f^2 - 1/n_i^2)$ com $R_H = 1{,}0968 \\times 10^{7}\\ \\text{m}^{-1}$.`,
      predict: [
        {
          question: "Qual transição emite o fóton de MAIOR comprimento de onda?",
          options: ["3 → 2", "4 → 2", "2 → 1", "6 → 2"],
          answer: 0,
          explanation: "$\\lambda$ é inversamente proporcional a $\\Delta E$. Entre as opções, $3 \\to 2$ tem a menor diferença de energia (1,89 eV), dando 656 nm.",
        },
      ],
    },
    {
      id: "lampada",
      label: "Bohr: lâmpada de hidrogênio",
      params: { modo: 2, Z: 1, bohrModo: 0, ni: 6, nf: 1 },
      guide: `### Espectro de emissão
1. Choques excitam o átomo até no máximo $n_i$; ele decai em cascata, escolhendo ao acaso um nível mais baixo a cada salto.
2. O espectro embaixo acumula as linhas; a altura é proporcional ao número de fótons.
3. Só as linhas de Balmer caem no visível. Quantas linhas diferentes existem com $n \\le 6$?
4. Troque para He⁺: as energias escalam com $Z^2$.`,
    },
  ],

  exercises: [
    {
      id: "angulo",
      prompt:
        "Uma partícula alfa de {K} MeV aproxima-se de um núcleo de ouro (Z = 79) com parâmetro de impacto de {b} fm. Qual é o ângulo de espalhamento? Use ke² = 1,44 MeV·fm.",
      vary: { K: [3, 8, 1], b: [10, 120, 0] },
      fixed: { modo: 0 },
      answer: { label: "θ", unit: "°", compute: (p) => (rutherfordAngle(num(p, "b") / ((2 * 79 * 1.44) / num(p, "K"))) * 180) / Math.PI },
      hint: "d = 2·79·ke²/K e tan(θ/2) = d/(2b).",
    },
    {
      id: "linha",
      prompt: "Qual é o comprimento de onda do fóton emitido pelo hidrogênio na transição de n = {ni} para n = 2?",
      vary: { ni: [3, 7, 0] },
      fixed: { modo: 2, Z: 1, nf: 2, bohrModo: 1 },
      answer: { label: "λ", unit: "nm", compute: (p) => lineNm(num(p, "ni"), 2, 1) },
      tolerance: 0.01,
      hint: "1/λ = R_H (1/4 − 1/n²), com R_H ≈ 1,097 × 10⁷ m⁻¹.",
    },
  ],

  init: (p) => ({
    n: 0,
    acc: 0,
    hist: new Array<number>(NBINS).fill(0),
    recent: [],
    back: 0,
    lastTheta: 0,
    level: modo(p) === 2 ? niP(p) : 1,
    phase: 0,
    timer: 0,
    jumps: 0,
    photons: [],
    lines: [],
    lastLam: modo(p) === 2 ? lineNm(niP(p), nfP(p), Zb(p)) : 0,
  }),
  step(s, p, _t, dt) {
    if (modo(p) === 2) return bohrStep(s, p, dt);
    let acc = s.acc + num(p, "taxa", 400) * dt;
    let out = s;
    while (acc >= 1) {
      out = launch(out, p);
      acc -= 1;
    }
    return { ...out, acc };
  },
  dt: 0.02,
  sampleEvery: 10,
  maxSamples: 200,

  actions: [
    {
      id: "rajada",
      label: "Disparar 2000 alfas de uma vez",
      run(s, p) {
        if (modo(p) === 2) return s;
        let out = s;
        for (let i = 0; i < 2000; i++) out = launch(out, p);
        return out;
      },
    },
    { id: "zerar", label: "Zerar contagens", run: (s) => ({ ...s, n: 0, hist: new Array<number>(NBINS).fill(0), recent: [], back: 0, lines: [] }) },
  ],

  viewport: () => ({ xMin: 0, xMax: 20, yMin: 0, yMax: 12.2 }),

  render(ctx, frame) {
    const d = draw(ctx, frame);
    if (modo(frame.params) === 2) renderBohr(d, frame.theme, frame.state, frame.params);
    else {
      renderTrajectories(d, frame.theme, frame.state, frame.params);
      renderHistogram(d, frame.theme, frame.state, frame.params);
    }
  },
});

function renderTrajectories(d: Draw, theme: Theme, s: AtomState, p: Params) {
  const L = viewHalf(p);
  const box = { x0: 0.3, y0: 0.6, x1: 11.3, y1: 11.6 };
  const P = panel(d, box, { min: -L, max: L }, { min: -L, max: L });
  d.rect(box.x0, box.y0, 11, 11, { stroke: theme.muted, width: 1 });
  const B = beamRadius(p);
  const thomson = modo(p) === 1;
  // Feixe
  for (const sgn of [-1, 1]) d.line(P.X(-L), P.Y(sgn * B), P.X(-L * 0.55), P.Y(sgn * B), { color: theme.muted, dash: [4, 3], width: 1 });
  d.arrowPx(P.X(-L) + 0.2, P.Y(0), 1, 0, 40, { color: theme.series[1]! });
  d.text("feixe de alfas", P.X(-L) + 0.2, P.Y(0), { align: "left", dy: -12, size: 10, color: theme.series[1]! });
  // Alvo
  if (thomson) {
    const R = num(p, "R", 100);
    d.circle(P.X(0), P.Y(0), (R / (2 * L)) * 11, { fill: theme.positive, alpha: 0.15, stroke: theme.positive, width: 1 });
    for (let i = 0; i < 14; i++) {
      const a = i * 2.39996;
      const r = R * Math.sqrt((i + 0.5) / 14) * 0.85;
      d.dot(P.X(r * Math.cos(a)), P.Y(r * Math.sin(a)), 2.5, theme.negative);
    }
    d.text(`esfera positiva, R = ${fmt(R)} d`, P.X(0), box.y0 + 0.4, { size: 10, color: theme.muted });
  } else {
    d.dot(P.X(0), P.Y(0), 4, theme.positive);
    d.text("núcleo", P.X(0), P.Y(0), { dy: 12, size: 10, color: theme.positive });
    // Barra de escala de d
    const x0 = box.x1 - 0.4 - 11 / (2 * L);
    d.line(x0, box.y0 + 0.35, box.x1 - 0.4, box.y0 + 0.35, { color: theme.text, width: 2 });
    d.text(`d = ${fmt(dFm(p))} fm`, box.x1 - 0.4, box.y0 + 0.35, { align: "right", dy: -9, size: 10 });
  }
  // Trajetórias recentes
  P.clip(() => {
    s.recent.forEach((tr, i) => {
      const alpha = 0.25 + (0.75 * (i + 1)) / s.recent.length;
      const color = tr.theta > Math.PI / 2 ? theme.positive : tr.theta > Math.PI / 18 ? theme.series[1]! : theme.accent;
      d.polyline(
        tr.pts.map(([x, y]) => [P.X(x), P.Y(y)]),
        { color, width: 1.3, alpha },
      );
    });
  });
  d.text(`N = ${s.n}   θ > 90°: ${s.back}`, box.x0 + 0.15, box.y1 - 0.35, { align: "left", size: 11, weight: "600" });
}

function renderHistogram(d: Draw, theme: Theme, s: AtomState, p: Params) {
  const B = beamRadius(p);
  const N = Math.max(s.n, 200);
  const thMin = rutherfordAngle(B);
  const densities = s.hist.map((c, i) => c / solidAngle((i * BIN_DEG * Math.PI) / 180, ((i + 1) * BIN_DEG * Math.PI) / 180));
  let yMax = rutherfordDnDOmega(Math.max(thMin, (BIN_DEG * Math.PI) / 180), N, B) * 4;
  for (const v of densities) yMax = Math.max(yMax, v * 2);
  const yMin = Math.min(rutherfordDnDOmega(Math.PI, N, B) / 10, 0.5 / solidAngle(Math.PI - 0.0873, Math.PI));
  const P = panel(d, { x0: 13.0, y0: 1.2, x1: 19.6, y1: 11.2 }, { min: 0, max: 180 }, { min: yMin, max: yMax, log: true });
  P.frame({ xlabel: "θ (graus)", ylabel: "dN/dΩ (por sr)", xticks: [0, 30, 60, 90, 120, 150, 180], fy: (v) => `10^${Math.round(Math.log10(v))}` });
  // Região abaixo de θ_min (limite do feixe)
  if (thMin > 0) d.rect(P.X(0), P.box.y0, P.X((thMin * 180) / Math.PI) - P.X(0), P.box.y1 - P.box.y0, { fill: theme.grid });
  // Histograma
  densities.forEach((v, i) => {
    if (v <= 0) return;
    const x0 = P.X(i * BIN_DEG);
    const x1 = P.X((i + 1) * BIN_DEG);
    const y = Math.min(P.Y(v), P.box.y1);
    d.rect(x0, P.box.y0, x1 - x0, y - P.box.y0, { fill: theme.accent, alpha: 0.45, stroke: theme.accent, width: 1 });
  });
  // Previsão de Rutherford com o N atual
  if (s.n > 0) P.plot((th) => rutherfordDnDOmega((th * Math.PI) / 180, s.n, B), (thMin * 180) / Math.PI, 180, { color: theme.positive, width: 2, n: 200 });
  d.text("histograma (simulação)", 19.6, 11.75, { align: "right", size: 10, color: theme.accent });
  d.text("Rutherford: 1/sin⁴(θ/2)", 19.6, 11.35 + 0.8, { align: "right", size: 10, color: theme.positive });
}

function renderBohr(d: Draw, theme: Theme, s: AtomState, p: Params) {
  const Z = Zb(p);
  const nTop = Math.max(niP(p), s.level);
  const cx = 5.2;
  const cy = 7.6;
  const scale = 4.2 / bohrRadius(nTop, Z);
  for (let n = 1; n <= nTop; n++) {
    const r = bohrRadius(n, Z) * scale;
    d.circle(cx, cy, r, { stroke: n === s.level ? theme.accent : theme.muted, width: n === s.level ? 1.6 : 1, dash: n === s.level ? [] : [3, 3] });
    if (r > 0.35) d.text(`n=${n}`, cx + r * 0.71, cy + r * 0.71, { size: 9, color: theme.muted, dx: 8 });
  }
  d.dot(cx, cy, 5, theme.positive);
  const re = bohrRadius(s.level, Z) * scale;
  d.dot(cx + re * Math.cos(s.phase), cy + re * Math.sin(s.phase), 4, theme.negative);
  // Fótons em voo
  for (const ph of s.photons) {
    const col = wavelengthColor(ph.lam, ph.lam < 380 ? theme.series[4]! : theme.series[5]!);
    const r0 = 0.6 + ph.age * 2.2;
    const pts: [number, number][] = [];
    const ux = Math.cos(ph.ang);
    const uy = Math.sin(ph.ang);
    for (let i = 0; i <= 30; i++) {
      const a = r0 + (i / 30) * 1.4;
      const w = 0.13 * Math.sin(i * (0.2 + 120 / ph.lam));
      const x = cx + ux * a - uy * w;
      const y = cy + uy * a + ux * w;
      if (x < 0.2 || x > 10.4 || y < 4.2 || y > 12.1) continue;
      pts.push([x, y]);
    }
    d.polyline(pts, { color: col, width: 2, alpha: Math.max(0, 1 - ph.age / 2) });
  }
  d.text(`${["H", "He⁺", "Li²⁺"][Z - 1]}: órbitas em escala (r ∝ n²)`, 0.3, 11.9, { align: "left", size: 10, color: theme.muted });

  // Diagrama de níveis
  const E1 = bohrEnergy(1, Z);
  const P = panel(d, { x0: 12.2, y0: 4.6, x1: 19.6, y1: 11.6 }, { min: 0, max: 1 }, { min: E1 * 1.04, max: 0 });
  d.text("E (eV)", 12.2, 11.95, { align: "left", size: 10, color: theme.muted });
  for (let n = 1; n <= 7; n++) {
    const y = P.Y(bohrEnergy(n, Z));
    d.line(P.X(0.05), y, P.X(0.7), y, { color: n === s.level ? theme.accent : theme.text, width: n === s.level ? 2.5 : 1 });
    if (n <= 4) d.text(`n=${n}  ${fmt(bohrEnergy(n, Z), 3)}`, P.X(0.72), y, { align: "left", size: 9, color: theme.muted });
  }
  d.line(P.X(0.05), P.Y(0), P.X(0.7), P.Y(0), { color: theme.muted, dash: [4, 3], width: 1 });
  d.text("0 (ionização)", P.X(0.72), P.Y(0), { align: "left", size: 9, color: theme.muted });
  const ni = niP(p);
  const nf = nfP(p);
  if (nf >= 1) {
    const lam = lineNm(ni, nf, Z);
    d.arrow(P.X(0.4), P.Y(bohrEnergy(ni, Z)), 0, P.Y(bohrEnergy(nf, Z)) - P.Y(bohrEnergy(ni, Z)), { color: wavelengthColor(lam, theme.series[4]!) });
    d.text(`${ni}→${nf}: ${fmt(lam, 4)} nm (${SERIES[nf - 1]})`, 12.2, 4.15, { align: "left", size: 10 });
  }

  // Espectros: completo (log λ) e visível
  const maxC = Math.max(1, ...s.lines.map((l) => l.c));
  const full = panel(d, { x0: 0.6, y0: 2.4, x1: 19.4, y1: 3.4 }, { min: 80, max: 2200, log: true }, { min: 0, max: 1 });
  d.rect(full.X(380), 2.4, full.X(750) - full.X(380), 1, { fill: theme.grid });
  full.frame({ xticks: [100, 200, 380, 750, 1000, 2000], yticks: [], fx: (v) => `${v}` });
  d.text("λ (nm), escala log: UV | visível | IV", 0.6, 3.4, { align: "left", size: 10, color: theme.muted, dy: -8 });
  const vis = panel(d, { x0: 0.6, y0: 0.5, x1: 19.4, y1: 1.6 }, { min: 380, max: 750 }, { min: 0, max: 1 });
  for (let i = 0; i < 74; i++) {
    const l = 380 + i * 5;
    d.rect(vis.X(l), 0.5, vis.X(l + 5) - vis.X(l), 1.1, { fill: wavelengthColor(l + 2.5), alpha: 0.18 });
  }
  vis.frame({ xticks: [400, 450, 500, 550, 600, 650, 700, 750], yticks: [], fx: (v) => `${v}` });
  for (const l of s.lines) {
    const lam = lineNm(l.ni, l.nf, Z);
    const h = 0.25 + (0.75 * l.c) / maxC;
    const col = wavelengthColor(lam, lam < 380 ? theme.series[4]! : theme.series[5]!);
    if (lam >= 80 && lam <= 2200) d.line(full.X(lam), 2.4, full.X(lam), 2.4 + h, { color: col, width: 2.5 });
    if (lam >= 380 && lam <= 750) d.line(vis.X(lam), 0.5, vis.X(lam), 0.5 + 1.1 * h, { color: col, width: 3 });
  }
}

export default modelosAtomicos;
