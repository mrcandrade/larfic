import { defineSim, draw, gaussian, num, rng, texNum, type Draw, type Params, type Theme } from "@fisilab/core";
import { bandName, wavelengthColor } from "./color.ts";
import { fmt, panel } from "./panel.ts";
import {
  AMMETER_RES,
  HC_EV_NM,
  METALS,
  current,
  frequency,
  kMax,
  metalOf,
  millikanFits,
  photonEnergy,
  saturationCurrent,
  sweepStoppingVoltage,
  thresholdNm,
  type MillikanFit,
  type Point,
} from "./physics.ts";

export * from "./physics.ts";

export interface PhotoState {
  /** Medidas registradas (f em Hz, V₀ em V, índice do metal). */
  pts: Point[];
  /** Última mensagem de retorno ao aluno. */
  msg: string;
}

const lam = (p: Params) => num(p, "lambda", 400);
const pow = (p: Params) => num(p, "P", 1);
const volt = (p: Params) => num(p, "V", 0);
const metal = (p: Params) => metalOf(num(p, "metal", 2));
const metalIdx = (p: Params) => METALS.indexOf(metal(p));
const I = (p: Params) => current(volt(p), lam(p), pow(p), metal(p).phi);

/** Medidas de exemplo (com ruído de leitura de 0,02 V) para o metal escolhido. */
export function exampleData(p: Params): Point[] {
  const m = metalIdx(p);
  const rand = rng(20240 + m);
  const out: Point[] = [];
  for (const l of [180, 220, 260, 300, 340, 380, 420, 460, 500]) {
    const K = kMax(l, METALS[m]!.phi);
    if (K < 0.15) continue;
    out.push({ f: frequency(l), V0: Math.round((K + 0.02 * gaussian(rand)) * 100) / 100, m });
  }
  return out;
}

function record(s: PhotoState, p: Params, V0: number, note: string): PhotoState {
  return { pts: [...s.pts, { f: frequency(lam(p)), V0, m: metalIdx(p) }], msg: note };
}

const hash = (k: number) => {
  const x = Math.sin(k * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
};

export const fotoeletrico = defineSim<PhotoState>({
  id: "fotoeletrico",
  title: "Efeito fotoelétrico e a medida de h",
  course: "FG IV",
  topic: "Quântica (origens)",
  priority: "P1",
  summary:
    "Ilumine um metal numa célula fotoelétrica, varie a tensão até a corrente zerar e registre o potencial de corte. O ajuste por mínimos quadrados de V₀ contra f dá a constante de Planck e a função trabalho.",
  equations: [
    String.raw`E_\gamma = hf = \frac{hc}{\lambda}`,
    String.raw`K_{\max} = hf - \phi = e V_0`,
    String.raw`V_0 = \frac{h}{e}\,f - \frac{\phi}{e} \qquad f_0 = \frac{\phi}{h}`,
    String.raw`I_{\text{sat}} = \eta\, e\, \frac{P\lambda}{hc}`,
  ],
  liveEquations(s, p) {
    const E = photonEnergy(lam(p));
    const out = [
      String.raw`E_\gamma = \frac{hc}{\lambda} = \frac{${texNum(HC_EV_NM, 5)}\ \text{eV·nm}}{${texNum(lam(p), 4)}\ \text{nm}} = ${texNum(E)}\ \text{eV} \qquad f = ${texNum(frequency(lam(p)))}\ \text{Hz}`,
      String.raw`I(${texNum(volt(p))}\ \text{V}) = ${texNum(I(p) * 1e6)}\ \mu\text{A}`,
    ];
    const fit = millikanFits(s.pts).find((f) => f.m === metalIdx(p));
    if (fit)
      out.push(
        String.raw`\text{ajuste: } V_0 = ${texNum(fit.slope)}\,f ${fit.intercept < 0 ? "-" : "+"} ${texNum(Math.abs(fit.intercept))}\ \text{V} \;\Rightarrow\; h = ${texNum(fit.h)}\ \text{J·s},\ \phi = ${texNum(fit.phi)}\ \text{eV}`,
      );
    return out;
  },

  params: [
    {
      key: "metal",
      label: "Metal do catodo",
      unit: "",
      min: 0,
      max: METALS.length - 1,
      step: 1,
      default: 2,
      live: true,
      options: METALS.map((m, i) => ({ value: i, label: m.name })),
    },
    { key: "lambda", label: "Comprimento de onda λ", unit: "nm", min: 100, max: 800, step: 1, default: 400, live: true },
    { key: "P", label: "Potência luminosa (intensidade)", unit: "mW", min: 0, max: 2, step: 0.01, default: 1, live: true },
    { key: "V", label: "Tensão ânodo − catodo", unit: "V", min: -12, max: 5, step: 0.01, default: 0, live: true },
    {
      key: "dados",
      label: "Tabela inicial",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 0,
      options: [
        { value: 0, label: "Vazia" },
        { value: 1, label: "Medidas de exemplo do metal escolhido" },
      ],
    },
  ],

  observables: [
    { key: "I", label: "Corrente I", unit: "µA", value: (_s, p) => I(p) * 1e6 },
    { key: "V", label: "Tensão V", unit: "V", value: (_s, p) => volt(p) },
    { key: "f", label: "Frequência f", unit: "10¹⁴ Hz", value: (_s, p) => frequency(lam(p)) / 1e14 },
    { key: "E", label: "Energia do fóton", unit: "eV", value: (_s, p) => photonEnergy(lam(p)) },
    { key: "n", label: "Medidas registradas", unit: "", value: (s) => s.pts.length },
    { key: "h", label: "h do ajuste", unit: "10⁻³⁴ J·s", value: (s, p) => (millikanFits(s.pts).find((f) => f.m === metalIdx(p))?.h ?? 0) / 1e-34 },
    { key: "phi", label: "φ do ajuste", unit: "eV", value: (s, p) => millikanFits(s.pts).find((f) => f.m === metalIdx(p))?.phi ?? 0 },
  ],
  chart: { x: "V", y: "I" },

  scenarios: [
    {
      id: "corte",
      label: "Medir o potencial de corte",
      params: { metal: 2, lambda: 400, P: 1, V: 0, dados: 0 },
      guide: `### Encontre $V_0$
1. Com $V = 0$ já há corrente: os elétrons saem do metal com energia cinética.
2. Torne $V$ negativo aos poucos (o ânodo passa a repelir os elétrons). Observe a curva $I(V)$ e o amperímetro.
3. O potencial de corte $V_0$ é o menor $|V|$ em que $I = 0$. Então $eV_0 = K_{\\max}$.
4. Clique **Registrar (f, V₀)** com a tensão nesse ponto. Repita para outros $\\lambda$.
5. Com o botão **Iniciar**, o gráfico $I \\times V$ é traçado enquanto você move a tensão.`,
      predict: [
        {
          question: "Se você dobrar a potência da luz (mesmo λ), o potencial de corte V₀:",
          options: ["dobra", "fica igual", "cai pela metade", "aumenta um pouco"],
          answer: 1,
          explanation:
            "Mais potência significa mais fótons por segundo, todos com a mesma energia $hf$. A corrente de saturação dobra, mas $K_{\\max} = hf - \\phi$ não muda, e portanto $V_0$ também não.",
        },
      ],
    },
    {
      id: "limiar",
      label: "Abaixo do limiar",
      params: { metal: 4, lambda: 450, P: 2, V: 2, dados: 0 },
      guide: `### Luz forte, nenhum elétron
1. O zinco tem $\\phi \\approx 4{,}3\\ \\text{eV}$. Com luz azul (450 nm, $hf \\approx 2{,}8\\ \\text{eV}$), aumente a potência ao máximo.
2. Diminua $\\lambda$ até a corrente aparecer. Anote o comprimento de onda de corte $\\lambda_0 = hc/\\phi$.
3. Explique por que a física clássica (energia proporcional à intensidade) não prevê esse limiar.`,
      predict: [
        {
          question: "Luz azul intensa ilumina zinco (φ ≈ 4,3 eV). O que acontece com a corrente?",
          options: ["aparece depois de algum tempo acumulando energia", "é zero, qualquer que seja a intensidade", "é pequena, proporcional à intensidade"],
          answer: 1,
          explanation:
            "Cada elétron absorve um fóton inteiro. Se $hf < \\phi$, nenhum fóton sozinho arranca um elétron, e não há acúmulo: a corrente é nula para qualquer intensidade.",
        },
      ],
    },
    {
      id: "millikan",
      label: "Ajuste de Millikan: medir h",
      params: { metal: 2, lambda: 300, P: 1, V: 0, dados: 1 },
      guide: `### Reta de Millikan
1. A tabela começa com medidas de exemplo do sódio. Acrescente as suas: escolha um $\\lambda$, ache $V_0$ e clique **Registrar**. **Medir V₀ (varredura)** faz a varredura automática com passos de 0,01 V.
2. O ajuste por mínimos quadrados de $V_0 = (h/e) f - \\phi/e$ aparece no gráfico de baixo.
3. Calcule $h = e \\times \\text{inclinação}$ e compare com $6{,}626 \\times 10^{-34}\\ \\text{J·s}$.
4. O intercepto com o eixo vertical dá $-\\phi/e$; o com o eixo horizontal dá a frequência de corte $f_0$.`,
    },
    {
      id: "metais",
      label: "Metais diferentes, mesma inclinação",
      params: { metal: 0, lambda: 350, P: 1, V: 0, dados: 1 },
      guide: `### Retas paralelas
1. Registre (ou use a varredura automática) cinco pontos para o césio.
2. Troque o metal para cálcio e depois para zinco e registre outros cinco pontos para cada um. Os pontos ficam guardados com o metal em que foram medidos.
3. Compare as retas: a inclinação $h/e$ é a mesma para todos; só muda o intercepto $-\\phi/e$.
4. Ordene os metais pela função trabalho medida.`,
    },
  ],

  exercises: [
    {
      id: "corte",
      prompt: "Luz de {lambda} nm ilumina um metal de função trabalho {phi} eV. Qual é o potencial de corte?",
      vary: { lambda: [150, 330, 0], phi: [1.8, 3.2, 2] },
      answer: { label: "V₀", unit: "V", compute: (p) => HC_EV_NM / num(p, "lambda") - num(p, "phi") },
      hint: "eV₀ = hc/λ − φ, com hc ≈ 1240 eV·nm.",
    },
    {
      id: "limiar",
      prompt: "Qual é o maior comprimento de onda capaz de arrancar elétrons de um metal com função trabalho {phi} eV?",
      vary: { phi: [1.9, 5.8, 2] },
      answer: { label: "λ₀", unit: "nm", compute: (p) => thresholdNm(num(p, "phi")) },
      hint: "No limiar, hc/λ₀ = φ.",
    },
  ],

  init: (p) => ({ pts: Math.round(num(p, "dados")) === 1 ? exampleData(p) : [], msg: "" }),
  step: (s) => s,
  dt: 0.02,
  sampleEvery: 3,
  maxSamples: 5000,

  actions: [
    {
      id: "registrar",
      label: "Registrar (f, V₀ = −V)",
      run(s, p) {
        const phi = metal(p).phi;
        if (kMax(lam(p), phi) <= 0) return { ...s, msg: "Sem fotoelétrons neste λ: não há potencial de corte a registrar." };
        const V = volt(p);
        const Is = saturationCurrent(lam(p), pow(p), phi);
        if (Is < AMMETER_RES) return { ...s, msg: "Potência nula: ligue a luz para medir." };
        if (I(p) >= AMMETER_RES) return record(s, p, -V, "Atenção: a corrente ainda não era nula; V₀ registrado ficou abaixo do verdadeiro.");
        if (current(V + 0.05, lam(p), pow(p), phi) < AMMETER_RES)
          return record(s, p, -V, "Atenção: a corrente já era nula bem antes desta tensão; V₀ registrado ficou acima do verdadeiro.");
        return record(s, p, -V, `Registrado: f = ${fmt(frequency(lam(p)) / 1e14)} × 10¹⁴ Hz, V₀ = ${fmt(-V)} V.`);
      },
    },
    {
      id: "varredura",
      label: "Medir V₀ (varredura)",
      run(s, p) {
        const phi = metal(p).phi;
        if (kMax(lam(p), phi) <= 0 || saturationCurrent(lam(p), pow(p), phi) < AMMETER_RES)
          return { ...s, msg: "A corrente é nula em qualquer tensão: nada a medir." };
        const V0 = sweepStoppingVoltage(lam(p), pow(p), phi);
        return record(s, p, V0, `Varredura: corrente zerou em V = −${fmt(V0)} V.`);
      },
    },
    { id: "desfazer", label: "Apagar última medida", run: (s) => ({ pts: s.pts.slice(0, -1), msg: s.pts.length ? "Última medida apagada." : "" }) },
    { id: "limpar", label: "Limpar tabela", run: () => ({ pts: [], msg: "Tabela limpa." }) },
  ],

  viewport: () => ({ xMin: 0, xMax: 20, yMin: 0, yMax: 12.4 }),

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const { state: s, params: p, theme, t } = frame;
    renderTube(d, theme, p, t);
    renderIV(d, theme, p);
    renderMillikan(d, theme, s, p);
  },
});

function renderTube(d: Draw, theme: Theme, p: Params, t: number) {
  const l = lam(p);
  const phi = metal(p).phi;
  const K = kMax(l, phi);
  const V = volt(p);
  const col = wavelengthColor(l, theme.series[4]!);
  const xc = 2.75;
  const xa = 7.0;

  // Tubo de vidro, catodo e ânodo
  d.rect(1.6, 7.3, 6.4, 4.4, { stroke: theme.muted, width: 1.2, fill: theme.grid });
  d.rect(2.4, 7.7, xc - 2.4, 3.6, { fill: theme.series[5]!, stroke: theme.text, width: 1 });
  d.rect(xa, 8.2, 0.25, 2.6, { fill: theme.muted, stroke: theme.text, width: 1 });
  d.text(`catodo (${metal(p).name})`, 2.55, 7.0, { color: theme.text, size: 10 });
  d.text("ânodo", 7.12, 7.0, { color: theme.text, size: 10 });

  // Lâmpada e fótons
  d.rect(5.4, 11.85, 1.6, 0.45, { fill: col, stroke: theme.text, width: 1 });
  d.text(`λ = ${fmt(l)} nm (${bandName(l)})`, 6.2, 12.08, { color: theme.text, size: 10, align: "left", dx: 52 });
  if (pow(p) > 0) {
    for (let k = 0; k < 3; k++) {
      const x0 = 5.6 + k * 0.45;
      const y0 = 11.8;
      const x1 = xc + 0.15;
      const y1 = 9.1 + k * 0.6;
      const pts: [number, number][] = [];
      const L = Math.hypot(x1 - x0, y1 - y0);
      const ux = (x1 - x0) / L;
      const uy = (y1 - y0) / L;
      const waves = 4 + 600 / l;
      for (let i = 0; i <= 60; i++) {
        const a = (i / 60) * L;
        const w = 0.09 * Math.sin((i / 60) * waves * 2 * Math.PI - 6 * t);
        pts.push([x0 + ux * a - uy * w, y0 + uy * a + ux * w]);
      }
      d.polyline(pts, { color: col, width: 1.6, alpha: Math.min(1, 0.35 + pow(p) / 2) });
    }
  }

  // Elétrons: K uniforme em [0, K_max], acelerados por E = V/d (m = 1/2 em unidades de desenho)
  const Is = saturationCurrent(l, pow(p), phi);
  const rate = Is > 0 ? 6 * pow(p) * (l / 400) : 0;
  const gap = xa - xc;
  const a = (2 * V) / gap;
  if (rate > 0) {
    const tMax = 4;
    for (let k = Math.max(0, Math.floor((t - tMax) * rate)); k <= Math.floor(t * rate); k++) {
      const tau = (t - k / rate) * 0.8;
      if (tau < 0) continue;
      const v0 = 2 * Math.sqrt(K * hash(k));
      const x = v0 * tau + 0.5 * a * tau * tau;
      if (x < 0 || x > gap) continue;
      const y = 8.4 + 2 * hash(k + 0.5);
      d.dot(xc + x, y, 3, theme.negative);
    }
  }
  if (K === 0) d.text("hf < φ: nenhum elétron é emitido", 4.8, 9.5, { color: theme.negative, size: 11, weight: "600" });

  // Campo entre as placas
  if (Math.abs(V) > 0.05) {
    const dir = V > 0 ? -1 : 1; // E aponta do ânodo para o catodo quando V > 0
    d.arrowPx(4.9 - dir * 0.5, 7.55, dir, 0, 40, { color: theme.muted, width: 1.5 });
    d.text("E", 4.9, 7.95, { color: theme.muted, size: 10 });
  }

  // Circuito: fonte e amperímetro
  d.polyline(
    [
      [2.55, 7.7],
      [2.55, 6.7],
      [7.12, 6.7],
      [7.12, 8.2],
    ],
    { color: theme.text, width: 1.2 },
  );
  d.circle(4.0, 6.7, 0.32, { fill: theme.grid, stroke: theme.text, width: 1.2 });
  d.text("A", 4.0, 6.7, { size: 11, weight: "600" });
  d.rect(5.5, 6.45, 0.5, 0.5, { fill: theme.grid, stroke: theme.text, width: 1.2 });
  d.text("V", 5.75, 6.7, { size: 11, weight: "600" });
  const Iua = I(p) * 1e6;
  d.text(`I = ${Iua < 1e-5 ? "0,000" : Iua.toFixed(3).replace(".", ",")} µA`, 0.1, 6.2, { align: "left", size: 12, weight: "600" });
  d.text(`V = ${V.toFixed(2).replace(".", ",")} V`, 7.95, 6.2, { align: "right", size: 12, weight: "600" });
}

function renderIV(d: Draw, theme: Theme, p: Params) {
  const l = lam(p);
  const phi = metal(p).phi;
  const K = kMax(l, phi);
  const V = volt(p);
  const Is = saturationCurrent(l, pow(p), phi) * 1e6;
  const vLo = Math.min(-Math.max(2, Math.ceil(K + 1)), Math.floor(V - 0.5));
  const P = panel(d, { x0: 9.8, y0: 7.2, x1: 19.6, y1: 11.5 }, { min: vLo, max: 5 }, { min: 0, max: Is > 0 ? Is * 1.15 : 1 });
  P.frame({ xlabel: "V (V)", ylabel: "I (µA)" });
  P.plot((v) => current(v, l, pow(p), phi) * 1e6, vLo, 5, { color: theme.accent, width: 2, n: 300 });
  const Iv = I(p) * 1e6;
  d.dot(P.X(V), P.Y(Iv), 5, theme.positive);
  if (K > 0 && -K >= vLo) {
    d.line(P.X(-K), P.box.y0, P.X(-K), P.Y(Is * 0.4), { color: theme.muted, dash: [4, 3], width: 1 });
  }
}

function fitLabel(f: MillikanFit): string {
  const h = f.h / 1e-34;
  const sh = (f.sSlope * 1.602176634e-19) / 1e-34;
  const hs = f.n > 2 ? `(${fmt(h, 4)} ± ${fmt(sh, 2)})` : fmt(h, 4);
  return `${METALS[f.m]!.name}: h = ${hs} × 10⁻³⁴ J·s; φ = ${fmt(f.phi, 3)} eV`;
}

function renderMillikan(d: Draw, theme: Theme, s: PhotoState, p: Params) {
  const P = panel(d, { x0: 1.2, y0: 0.8, x1: 11.6, y1: 5.2 }, { min: 0, max: 30 }, { min: -6, max: 10 });
  P.frame({ xlabel: "f (10¹⁴ Hz)", ylabel: "V₀ (V)", xticks: [0, 5, 10, 15, 20, 25, 30], yticks: [-6, -4, -2, 0, 2, 4, 6, 8, 10] });
  const fits = millikanFits(s.pts);
  const colorOf = (m: number) => theme.series[m % theme.series.length]!;
  for (const f of fits) P.plot((x) => f.slope * x * 1e14 + f.intercept, 0, 30, { color: colorOf(f.m), width: 1.5, dash: [6, 4], n: 2 });
  for (const pt of s.pts) {
    const x = pt.f / 1e14;
    if (P.inside(x, pt.V0)) d.dot(P.X(x), P.Y(pt.V0), 4, colorOf(pt.m));
  }
  // Frequência atual
  const fx = frequency(lam(p)) / 1e14;
  if (fx <= 30) d.line(P.X(fx), P.box.y0, P.X(fx), P.box.y1, { color: theme.accent, width: 1, alpha: 0.6 });

  // Resultados
  let y = 5.0;
  d.text("Ajuste V₀ = (h/e) f − φ/e", 12.0, y, { align: "left", size: 12, weight: "600" });
  y -= 0.55;
  if (!fits.length) {
    d.text("Registre ao menos 2 frequências", 12.0, y, { align: "left", size: 11, color: theme.muted });
    y -= 0.45;
    d.text("diferentes para um mesmo metal.", 12.0, y, { align: "left", size: 11, color: theme.muted });
    y -= 0.55;
  }
  for (const f of fits.slice(0, 4)) {
    d.text(fitLabel(f), 12.0, y, { align: "left", size: 10, color: colorOf(f.m) });
    y -= 0.45;
    d.text(`   n = ${f.n}, f₀ = ${fmt(f.f0 / 1e14, 3)} × 10¹⁴ Hz, R² = ${fmt(f.r2, 4)}`, 12.0, y, { align: "left", size: 10, color: theme.muted });
    y -= 0.55;
  }
  d.text("valor aceito: h = 6,626 × 10⁻³⁴ J·s", 12.0, Math.max(y, 1.2), { align: "left", size: 10, color: theme.muted });
  if (s.msg) d.text(s.msg, 0.1, 0.15, { align: "left", size: 11, color: s.msg.startsWith("Atenção") ? theme.positive : theme.accent });
}

export default fotoeletrico;
