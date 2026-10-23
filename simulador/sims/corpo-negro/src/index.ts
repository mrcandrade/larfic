import { defineSim, draw, formatBR, num, texNum, type Params } from "@fisilab/core";
import {
  SIGMA,
  VIS_MAX,
  VIS_MIN,
  WIEN_B,
  blackbodyRGB,
  peakNumeric,
  planck,
  rayleighJeans,
  spectrumXYZ,
  visibleFraction,
  wavelengthRGB,
  wienApprox,
} from "./physics.ts";

export * from "./physics.ts";

/** Corpos de comparação (opção 0 = nenhum). */
export const REFS = [
  { label: "Nenhum", T: 0 },
  { label: "Sol (5778 K)", T: 5778 },
  { label: "Lâmpada incandescente (2800 K)", T: 2800 },
  { label: "Corpo humano (310 K)", T: 310 },
  { label: "Brasa (1000 K)", T: 1000 },
  { label: "Estrela azul, Rigel (12 100 K)", T: 12100 },
] as const;

const PLOT = { x0: 6.4, x1: 19.6, y0: 1.1, y1: 9.2 };

interface View {
  log: boolean;
  lo: number;
  hi: number;
  ylo: number;
  yhi: number;
  /** Fator e nome da unidade de λ nos eixos. */
  uf: number;
  un: string;
  X(lam: number): number;
  Y(M: number): number;
  lamAt(x: number): number;
}

const peakM = (T: number) => planck(WIEN_B / T, T);
const cmpT = (p: Params) => REFS[Math.round(num(p, "cmp"))]?.T ?? 0;

export function view(p: Params): View {
  const T = num(p, "T", 5778);
  const log = Math.round(num(p, "escala")) === 1;
  const Tc = cmpT(p);
  const Ts = Tc > 0 ? [T, Tc] : [T];
  let lo: number, hi: number, ylo: number, yhi: number;
  if (log) {
    lo = Math.min(...Ts.map((t) => WIEN_B / t)) / 8;
    hi = Math.max(...Ts.map((t) => WIEN_B / t)) * 30;
    const peaks = Ts.map(peakM);
    yhi = Math.max(...peaks) * 8;
    ylo = Math.min(...peaks) * 1e-3;
  } else {
    lo = 0;
    hi = (5 * WIEN_B) / T;
    ylo = 0;
    yhi = peakM(T) * 1.18;
  }
  const [uf, un] = hi < 4e-6 ? [1e9, "nm"] : hi < 4e-3 ? [1e6, "μm"] : [1e3, "mm"];
  const W = PLOT.x1 - PLOT.x0;
  const Hh = PLOT.y1 - PLOT.y0;
  const X = log ? (l: number) => PLOT.x0 + (Math.log(l / lo) / Math.log(hi / lo)) * W : (l: number) => PLOT.x0 + (l / hi) * W;
  const lamAt = log ? (x: number) => lo * (hi / lo) ** ((x - PLOT.x0) / W) : (x: number) => ((x - PLOT.x0) / W) * hi;
  const Y = log
    ? (M: number) => PLOT.y0 + (Math.log(Math.max(M, 1e-300) / ylo) / Math.log(yhi / ylo)) * Hh
    : (M: number) => PLOT.y0 + (M / yhi) * Hh;
  return { log, lo, hi, ylo, yhi, uf, un, X, Y, lamAt };
}

function niceStep(range: number, n = 5): number {
  const raw = range / n;
  const e = 10 ** Math.floor(Math.log10(raw));
  const f = raw / e;
  return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * e;
}

const fmt = (v: number, d = 3) => formatBR(v, d);
const Mu = (M: number) => M * 1e-6; // W/(m²·m) → W/(m²·μm)

/** Potência irradiada e potência líquida (troca com o ambiente), em W. */
export function power(p: Params): { P: number; Pnet: number } {
  const T = num(p, "T", 5778);
  const k = num(p, "eps", 1) * num(p, "A", 1) * SIGMA;
  return { P: k * T ** 4, Pnet: k * (T ** 4 - num(p, "Tamb", 293) ** 4) };
}

export const corpoNegro = defineSim({
  id: "corpo-negro",
  title: "Radiação de corpo negro",
  course: "FG IV",
  topic: "Quântica (origens)",
  priority: "P1",
  summary:
    "Espectro de Planck ao vivo com a temperatura, comparado com a previsão clássica de Rayleigh–Jeans (catástrofe do ultravioleta). Veja a cor aparente do corpo, o deslocamento de Wien e a potência σT⁴, e compare com o Sol, uma lâmpada e o corpo humano.",
  equations: [
    String.raw`M_\lambda = \frac{2\pi h c^2}{\lambda^5}\,\frac{1}{e^{hc/\lambda k T} - 1} \qquad \text{(Planck)}`,
    String.raw`M_\lambda^{\text{RJ}} = \frac{2\pi c\,k T}{\lambda^4} \qquad \text{(Rayleigh–Jeans, clássica)}`,
    String.raw`\lambda_{\max} T = b = 2{,}898 \times 10^{-3}\ \text{m·K} \qquad \text{(Wien)}`,
    String.raw`M = \int_0^\infty M_\lambda\,d\lambda = \sigma T^4 \qquad P = \varepsilon \sigma A T^4 \qquad \text{(Stefan–Boltzmann)}`,
  ],
  liveEquations(s, p) {
    const T = num(p, "T", 5778);
    const lam = s[0] ?? WIEN_B / T;
    const { P, Pnet } = power(p);
    return [
      String.raw`\lambda_{\max} = \frac{2{,}898 \times 10^{-3}\ \text{m·K}}{${texNum(T)}\ \text{K}} = ${texNum((WIEN_B / T) * 1e6)}\ \mu\text{m}`,
      String.raw`M = \sigma T^4 = ${texNum(SIGMA * T ** 4)}\ \text{W/m}^2 \qquad P = \varepsilon\sigma A T^4 = ${texNum(P)}\ \text{W} \qquad P_{\text{líq}} = ${texNum(Pnet)}\ \text{W}`,
      String.raw`\text{em } \lambda = ${texNum(lam * 1e6)}\ \mu\text{m}: \ \frac{M_\lambda^{\text{RJ}}}{M_\lambda^{\text{Planck}}} = ${texNum(rayleighJeans(lam, T) / Math.max(planck(lam, T), 1e-300))}`,
    ];
  },

  params: [
    { key: "T", label: "Temperatura do corpo", unit: "K", min: 100, max: 15000, step: 1, default: 5778, log: true, live: true },
    {
      key: "cmp",
      label: "Comparar com",
      unit: "",
      min: 0,
      max: REFS.length - 1,
      step: 1,
      default: 0,
      live: true,
      options: REFS.map((r, i) => ({ value: i, label: r.label })),
    },
    {
      key: "modelo",
      label: "Curvas teóricas",
      unit: "",
      min: 0,
      max: 2,
      step: 1,
      default: 1,
      live: true,
      options: [
        { value: 0, label: "Só Planck" },
        { value: 1, label: "Planck e Rayleigh–Jeans" },
        { value: 2, label: "Planck, Rayleigh–Jeans e Wien" },
      ],
    },
    {
      key: "escala",
      label: "Escala dos eixos",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 0,
      live: true,
      options: [
        { value: 0, label: "Linear" },
        { value: 1, label: "Logarítmica (log–log)" },
      ],
    },
    { key: "eps", label: "Emissividade ε", unit: "", min: 0.05, max: 1, step: 0.01, default: 1, live: true },
    { key: "A", label: "Área da superfície", unit: "m²", min: 1e-4, max: 100, step: 1e-4, default: 1, log: true, live: true },
    { key: "Tamb", label: "Temperatura do ambiente", unit: "K", min: 0, max: 400, step: 1, default: 293, live: true },
  ],

  observables: [
    { key: "lam", label: "Comprimento de onda do cursor", unit: "μm", value: (s, p) => (s[0] ?? WIEN_B / num(p, "T", 5778)) * 1e6 },
    { key: "M", label: "Exitância espectral (Planck) no cursor", unit: "W/(m²·μm)", value: (s, p) => Mu(planck(s[0] ?? 1e-6, num(p, "T", 5778))) },
    { key: "Mrj", label: "Exitância espectral (Rayleigh–Jeans) no cursor", unit: "W/(m²·μm)", value: (s, p) => Mu(rayleighJeans(s[0] ?? 1e-6, num(p, "T", 5778))) },
    { key: "lmax", label: "Pico λ_max", unit: "μm", value: (_s, p) => (WIEN_B / num(p, "T", 5778)) * 1e6 },
    { key: "lmaxT", label: "λ_max · T (pico medido na curva)", unit: "μm·K", value: (_s, p) => peakNumeric(num(p, "T", 5778)) * num(p, "T", 5778) * 1e6 },
    { key: "Mtot", label: "Potência por área σT⁴", unit: "W/m²", value: (_s, p) => SIGMA * num(p, "T", 5778) ** 4 },
    { key: "P", label: "Potência irradiada εσAT⁴", unit: "W", value: (_s, p) => power(p).P },
    { key: "Pnet", label: "Potência líquida (descontando o ambiente)", unit: "W", value: (_s, p) => power(p).Pnet },
    { key: "fvis", label: "Fração no visível (380–750 nm)", unit: "%", value: (_s, p) => 100 * visibleFraction(num(p, "T", 5778)) },
  ],
  chart: { x: "lam", y: "M" },

  scenarios: [
    {
      id: "sol",
      label: "O Sol e a lâmpada",
      params: { T: 5778, cmp: 2, modelo: 0, escala: 0 },
      guide: `### Por que o Sol é "branco" e a lâmpada é amarelada
1. Com $T = 5778$ K o pico cai perto de 500 nm, no meio do visível (faixa colorida). Leia a **fração no visível**.
2. A curva tracejada é uma lâmpada incandescente a 2800 K. Onde fica o pico dela? Que fração sai como luz?
3. Diminua T devagar e observe a **cor aparente** do corpo passar de branco para amarelo, laranja e vermelho.
4. Confira $\\lambda_{\\max} T$: ele não muda com a temperatura (lei de Wien).`,
      predict: [
        {
          question: "Uma estrela azulada e uma avermelhada: qual tem a superfície mais quente?",
          options: ["A avermelhada", "A azulada", "Têm a mesma temperatura; a cor depende da composição"],
          answer: 1,
          explanation: "Pela lei de Wien, $\\lambda_{\\max} = b/T$: quanto mais quente, menor o comprimento de onda do pico, deslocando a cor para o azul.",
        },
      ],
    },
    {
      id: "catastrofe",
      label: "Catástrofe do ultravioleta",
      params: { T: 5000, modelo: 2, escala: 0, cmp: 0 },
      guide: `### Onde a física clássica falha
1. Compare Planck com **Rayleigh–Jeans**. Para λ grande elas coincidem; arraste o cursor para a direita e veja a razão RJ/Planck tender a 1.
2. Para λ pequeno, RJ cresce como $1/\\lambda^4$ sem limite: a potência total seria infinita.
3. Planck resolveu isso supondo energia em pacotes $E = hf$: modos de alta frequência ficam "congelados" porque $hf \\gg kT$.
4. A aproximação de **Wien** acerta o lado de λ curto e erra o de λ longo. Mude para escala log–log e veja as três retas e curvas.`,
      predict: [
        {
          question: "Segundo a teoria clássica (Rayleigh–Jeans), a potência total irradiada por um corpo negro é:",
          options: ["σT⁴", "proporcional a T", "infinita"],
          answer: 2,
          explanation: "$\\int_0^\\infty 2\\pi c k T/\\lambda^4\\,d\\lambda$ diverge em $\\lambda \\to 0$: é a catástrofe do ultravioleta.",
        },
      ],
    },
    {
      id: "humano",
      label: "O corpo humano no infravermelho",
      params: { T: 310, eps: 0.98, A: 1.8, Tamb: 293, cmp: 1, escala: 1, modelo: 0 },
      guide: `### Nós também brilhamos
1. A 310 K o pico fica perto de $9{,}3\\ \\mu$m, no infravermelho térmico (câmeras térmicas trabalham entre 8 e 14 μm).
2. Leia a potência irradiada por $1{,}8\\ \\text{m}^2$ de pele: perto de 900 W! O que salva é a **potência líquida**: o ambiente devolve quase tudo.
3. A escala log–log permite comparar com o Sol na mesma figura. Quantas ordens de grandeza separam os picos?`,
    },
    {
      id: "stefan",
      label: "Dobrando a temperatura",
      params: { T: 1500, cmp: 4, escala: 1, modelo: 0 },
      guide: `### Stefan–Boltzmann
1. Anote $\\sigma T^4$ a 1500 K e dobre para 3000 K. Por quanto a potência foi multiplicada?
2. A curva tracejada é uma brasa a 1000 K. Compare a área sob as curvas (que é $\\sigma T^4$).
3. A fração visível cresce muito mais rápido que a potência total. Por quê?`,
      predict: [
        {
          question: "Dobrando a temperatura absoluta de um corpo negro, a potência irradiada fica:",
          options: ["2 vezes maior", "4 vezes maior", "8 vezes maior", "16 vezes maior"],
          answer: 3,
          explanation: "$P \\propto T^4$, então $2^4 = 16$.",
        },
      ],
    },
  ],

  exercises: [
    {
      id: "wien",
      prompt: "O espectro de uma estrela tem pico em {lam} nm. Qual é a temperatura da superfície dela?",
      vary: { lam: [250, 950, 0] },
      answer: { label: "T", unit: "K", compute: (p) => WIEN_B / (num(p, "lam") * 1e-9) },
      hint: "Lei de Wien: λ_max T = 2,898 × 10⁻³ m·K.",
    },
    {
      id: "stefan",
      prompt: "Um corpo negro (ε = 1) de área {A} m² está a {T} K. Que potência ele irradia?",
      vary: { A: [0.01, 2, 2], T: [400, 3000, 0] },
      fixed: { eps: 1 },
      answer: { label: "P", unit: "W", compute: (p) => SIGMA * num(p, "A") * num(p, "T") ** 4 },
      hint: "P = σAT⁴, com σ = 5,67 × 10⁻⁸ W/(m²·K⁴).",
    },
  ],

  init: (p) => [WIEN_B / num(p, "T", 5778)],
  step: (s) => s,
  static: true,
  sampleEvery: 1000,
  maxSamples: 600,

  pointer: {
    down: (_s, p, pt) => cursorAt(p, pt),
    move: (_s, p, pt, dragging) => (dragging ? cursorAt(p, pt) : undefined),
    cursor: (_s, p, pt) => (cursorAt(p, pt) ? "ew-resize" : undefined),
  },

  narrowSplit: () => 0.25,
  viewport: () => ({ xMin: 0, xMax: 20, yMin: 0, yMax: 10 }),

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const { state: s, params: p, theme } = frame;
    const T = num(p, "T", 5778);
    const v = view(p);
    const modelo = Math.round(num(p, "modelo"));
    const top = PLOT.y1 + 0.3;

    // ---------- Eixos ----------
    d.line(PLOT.x0, PLOT.y0, PLOT.x1, PLOT.y0, { color: theme.muted });
    d.line(PLOT.x0, PLOT.y0, PLOT.x0, PLOT.y1 + 0.3, { color: theme.muted });
    d.text(`λ (${v.un})`, PLOT.x1, PLOT.y0 - 0.65, { color: theme.muted, size: 11, align: "right" });
    d.text(v.log ? "M_λ (W/m²·μm), log" : "M_λ (W/m²·μm)", PLOT.x0, PLOT.y1 + 0.6, { color: theme.muted, size: 11, align: "left" });
    if (v.log) {
      for (let e = Math.ceil(Math.log10(v.lo)); e <= Math.log10(v.hi); e++) {
        const x = v.X(10 ** e);
        d.line(x, PLOT.y0, x, PLOT.y1, { color: theme.grid, width: 1 });
        d.text(fmt(10 ** e * v.uf), x, PLOT.y0 - 0.3, { color: theme.muted, size: 10 });
      }
      const eStep = Math.max(1, Math.ceil(Math.log10(v.yhi / v.ylo) / 6));
      for (let e = Math.ceil(Math.log10(v.ylo)); e <= Math.log10(v.yhi); e += eStep) {
        d.line(PLOT.x0, v.Y(10 ** e), PLOT.x1, v.Y(10 ** e), { color: theme.grid, width: 1 });
        d.text(`10^${e - 6}`, PLOT.x0 - 0.1, v.Y(10 ** e), { color: theme.muted, size: 10, align: "right" });
      }
    } else {
      const xs = niceStep(v.hi * v.uf);
      for (let k = 1; k * xs <= v.hi * v.uf * 1.0001; k++) {
        const x = v.X((k * xs) / v.uf);
        d.line(x, PLOT.y0, x, PLOT.y1, { color: theme.grid, width: 1 });
        d.text(fmt(k * xs), x, PLOT.y0 - 0.3, { color: theme.muted, size: 10 });
      }
      const ys = niceStep(Mu(v.yhi), 4);
      for (let k = 1; k * ys <= Mu(v.yhi); k++) {
        d.line(PLOT.x0, v.Y((k * ys) / 1e-6), PLOT.x1, v.Y((k * ys) / 1e-6), { color: theme.grid, width: 1 });
        d.text(fmt(k * ys, 2), PLOT.x0 - 0.1, v.Y((k * ys) / 1e-6), { color: theme.muted, size: 10, align: "right" });
      }
    }

    // Faixa do visível sob o eixo
    const xa = Math.max(PLOT.x0, v.X(VIS_MIN));
    const xb = Math.min(PLOT.x1, v.X(VIS_MAX));
    if (xb > xa) {
      const nStrip = 40;
      for (let i = 0; i < nStrip; i++) {
        const x = xa + ((xb - xa) * i) / nStrip;
        const nm = v.lamAt(x + (xb - xa) / nStrip / 2) * 1e9;
        d.rect(x, PLOT.y0 - 0.18, (xb - xa) / nStrip + 0.005, 0.16, { fill: wavelengthRGB(nm) });
      }
      d.rect(xa, PLOT.y0, xb - xa, PLOT.y1 - PLOT.y0, { fill: theme.series[5]!, alpha: 0.07 });
    }

    // ---------- Curvas ----------
    const curve = (f: (l: number) => number, n = 400): [number, number][] => {
      const pts: [number, number][] = [];
      for (let i = 0; i <= n; i++) {
        const x = PLOT.x0 + ((PLOT.x1 - PLOT.x0) * i) / n;
        const l = v.lamAt(x);
        if (l <= 0) continue;
        const M = f(l);
        if (v.log && M < v.ylo) continue;
        const y = v.Y(M);
        if (y > top) continue;
        pts.push([x, y]);
      }
      return pts;
    };
    // Área sob Planck (= σT⁴)
    const pl = curve((l) => planck(l, T));
    if (!v.log && pl.length > 1) d.polyline([[PLOT.x0, PLOT.y0], ...pl, [PLOT.x1, PLOT.y0]], { color: "none", fill: theme.accent, alpha: 0.12, close: true });
    const Tc = cmpT(p);
    if (Tc > 0) {
      d.polyline(curve((l) => planck(l, Tc)), { color: theme.muted, width: 2, dash: [7, 5] });
      const lp = WIEN_B / Tc;
      if (lp > v.lo && lp < v.hi && v.Y(peakM(Tc)) < top) d.text(REFS[Math.round(num(p, "cmp"))]!.label, v.X(lp), v.Y(peakM(Tc)), { dy: -12, size: 11, color: theme.muted });
    }
    if (modelo >= 1) {
      const rj = curve((l) => rayleighJeans(l, T), 600);
      d.polyline(rj, { color: theme.positive, width: 2 });
      if (rj.length) d.text("Rayleigh–Jeans → ∞", rj[0]![0], top, { dx: 6, dy: 8, size: 11, color: theme.positive, align: "left", weight: "600" });
    }
    if (modelo >= 2) d.polyline(curve((l) => wienApprox(l, T)), { color: theme.series[2]!, width: 2, dash: [3, 3] });
    d.polyline(pl, { color: theme.accent, width: 3 });

    // Pico de Wien
    const lmax = WIEN_B / T;
    d.line(v.X(lmax), PLOT.y0, v.X(lmax), v.Y(peakM(T)), { color: theme.accent, dash: [4, 4], width: 1 });
    d.dot(v.X(lmax), v.Y(peakM(T)), 4, theme.accent);
    d.text(`λmax = ${fmt(lmax * v.uf)} ${v.un}`, v.X(lmax), v.Y(peakM(T)), { dy: -12, dx: 4, size: 11, weight: "600", color: theme.accent, align: "left" });

    // Cursor de leitura
    const lc = s[0] ?? lmax;
    if (lc > v.lo && lc < v.hi) {
      const xc = v.X(lc);
      d.line(xc, PLOT.y0, xc, PLOT.y1, { color: theme.text, width: 1, alpha: 0.6 });
      const Mp = planck(lc, T);
      if (v.Y(Mp) < top && (!v.log || Mp > v.ylo)) d.dot(xc, v.Y(Mp), 5, theme.text);
      const right = xc < (PLOT.x0 + PLOT.x1) / 2;
      d.text(`${fmt(lc * v.uf)} ${v.un}: Planck ${fmt(Mu(Mp))}`, xc, PLOT.y1 - 0.3, { dx: right ? 6 : -6, align: right ? "left" : "right", size: 11 });
      if (modelo >= 1) d.text(`RJ ${fmt(Mu(rayleighJeans(lc, T)))} W/(m²·μm)`, xc, PLOT.y1 - 0.75, { dx: right ? 6 : -6, align: right ? "left" : "right", size: 11, color: theme.positive });
    }

    // Legenda
    const leg: [string, string, number[] | undefined][] = [[`Planck, ${fmt(T, 4)} K`, theme.accent, undefined]];
    if (modelo >= 1) leg.push(["Rayleigh–Jeans (clássica)", theme.positive, undefined]);
    if (modelo >= 2) leg.push(["Aproximação de Wien", theme.series[2]!, [3, 3]]);
    leg.forEach(([lab, c, dash], i) => {
      const y = PLOT.y1 - 1.3 - i * 0.45;
      const x = PLOT.x1 - 4.2;
      d.line(x, y, x + 0.6, y, { color: c, width: 2.5, dash });
      d.text(lab, x + 0.75, y, { align: "left", size: 11 });
    });

    // ---------- Corpo e números ----------
    const [r, g, b] = blackbodyRGB(T);
    // Brilho visual: logaritmo da luminância, de ~700 K (apagado) a ~2000 K (pleno).
    const lum = Math.log10(Math.max(spectrumXYZ(T)[1], 1e-300));
    const l700 = Math.log10(spectrumXYZ(700)[1]);
    const l2000 = Math.log10(spectrumXYZ(2000)[1]);
    const bright = Math.max(0, Math.min(1, (lum - l700) / (l2000 - l700)));
    const col = (u: number) => Math.round(255 * u * bright + (theme.dark ? 30 : 40) * (1 - bright));
    const cx = 2.6, cy = 7.2;
    if (bright > 0.05) d.circle(cx, cy, 1.9, { fill: `rgb(${col(r)}, ${col(g)}, ${col(b)})`, alpha: 0.25 * bright });
    d.circle(cx, cy, 1.4, { fill: `rgb(${col(r)}, ${col(g)}, ${col(b)})`, stroke: theme.muted, width: 1 });
    d.text(bright < 0.05 ? "não brilha no visível" : "cor aparente", cx, cy - 1.75, { size: 11, color: theme.muted });
    const P = power(p);
    const lines = [
      `T = ${fmt(T, 4)} K`,
      `λmax·T = ${fmt(peakNumeric(T) * T * 1e3, 4)} mm·K`,
      `σT⁴ = ${fmt(SIGMA * T ** 4)} W/m²`,
      `P = εσAT⁴ = ${fmt(P.P)} W`,
      `P líquida = ${fmt(P.Pnet)} W`,
      `visível: ${fmt(100 * visibleFraction(T), 2)} %`,
    ];
    lines.forEach((t, i) => d.text(t, 0.3, 4.6 - i * 0.62, { align: "left", size: 12, weight: i === 0 ? "700" : "400" }));
  },
});

function cursorAt(p: Params, pt: { x: number; y: number }): number[] | undefined {
  if (pt.x < PLOT.x0 || pt.x > PLOT.x1 || pt.y < PLOT.y0 - 0.5 || pt.y > PLOT.y1 + 0.5) return undefined;
  const l = view(p).lamAt(pt.x);
  return l > 0 ? [l] : undefined;
}

export default corpoNegro;
