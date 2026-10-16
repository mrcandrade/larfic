import { defineSim, draw, formatBR, num, texNum, type Params } from "@fisilab/core";
import {
  C14_HALF_LIFE,
  DT,
  ESTAVEL,
  FILHO,
  MODO_CADEIA,
  MODO_DATACAO,
  YEARS_PER_SECOND,
  binWidth,
  cellCount,
  datingAge,
  daughterTheory,
  decayStep,
  expectedStart,
  fitOf,
  halfLife,
  initState,
  lambda1,
  modo,
  parentTheory,
  tStop,
  type DecayState,
} from "./model.ts";

export * from "./model.ts";

const fmt = (v: number, d = 3) => formatBR(v, d);
const GRID = { x0: 0.3, y0: 0.5, size: 9 };
const PN = { x0: 11.2, x1: 19.6, y0: 5.7, y1: 9.4 };
const PC = { x0: 11.2, x1: 19.6, y0: 0.9, y1: 4.3 };

/** Atividade medida no último intervalo concluído, em Bq (decaimentos por segundo de simulação). */
function activity(s: DecayState, p: Params): number {
  const c = s.counts[s.counts.length - 1];
  return c === undefined ? 0 : c / binWidth(p);
}

/** Idade estimada hoje (t = 0) da amostra fóssil, em anos, a partir do C-14 restante agora. */
function estimatedAge(s: DecayState, p: Params, t: number): number {
  return datingAge(s.NP, cellCount(p)) - t * YEARS_PER_SECOND;
}

export const decaimento = defineSim<DecayState>({
  id: "decaimento",
  title: "Decaimento radioativo e datação",
  course: "FG IV",
  topic: "Nuclear",
  priority: "P1",
  summary:
    "Uma grade de núcleos decai por Monte Carlo, cada um com probabilidade λΔt por passo. Meça N(t) e as contagens com flutuação de Poisson, ajuste ln N × t para obter a meia-vida com incerteza, veja a cadeia pai → filho e date uma amostra por carbono-14.",
  equations: [
    String.raw`P(\text{decair em } \Delta t) = 1 - e^{-\lambda \Delta t} \approx \lambda\,\Delta t`,
    String.raw`N(t) = N_0\,e^{-\lambda t} \qquad T_{1/2} = \frac{\ln 2}{\lambda} \qquad A = \lambda N`,
    String.raw`\ln N = \ln N_0 - \lambda t \qquad \sigma_{C} = \sqrt{C}\ \text{(Poisson)}`,
    String.raw`N_F(t) = N_0 \frac{\lambda_1}{\lambda_2 - \lambda_1}\left(e^{-\lambda_1 t} - e^{-\lambda_2 t}\right) \qquad t_{\text{idade}} = \frac{T_{1/2}}{\ln 2}\ln\frac{N_{\text{vivo}}}{N}`,
  ],
  liveEquations(s, p, t) {
    const f = fitOf(s, p);
    const T1 = halfLife(p);
    const out = [
      String.raw`N = ${s.NP} \qquad N_{\text{teórico}} = ${texNum(parentTheory(p, t), 4)} \qquad t = ${texNum(t)}\ \text{s}`,
    ];
    if (f && f.lambda > 0) {
      const Tf = Math.LN2 / f.lambda;
      out.push(String.raw`\text{ajuste: } \lambda = (${texNum(f.lambda)} \pm ${texNum(f.sigma, 2)})\ \text{s}^{-1} \Rightarrow T_{1/2} = (${texNum(Tf)} \pm ${texNum((Tf * f.sigma) / f.lambda, 2)})\ \text{s} \quad (\text{real: } ${texNum(T1)}\ \text{s})`);
    }
    if (modo(p) === MODO_DATACAO && s.NP > 0)
      out.push(String.raw`t_{\text{idade}} = \frac{5730}{\ln 2}\ln\frac{${cellCount(p)}}{${s.NP}} - ${texNum(t * YEARS_PER_SECOND)} = ${texNum(estimatedAge(s, p, t), 4)}\ \text{anos}`);
    return out;
  },

  params: [
    {
      key: "modo",
      label: "Experimento",
      unit: "",
      min: 0,
      max: 2,
      step: 1,
      default: 0,
      options: [
        { value: 0, label: "Decaimento simples (pai → estável)" },
        { value: 1, label: "Cadeia pai → filho → estável" },
        { value: 2, label: "Datação por carbono-14" },
      ],
    },
    { key: "N0", label: "Número de núcleos", unit: "", min: 100, max: 10000, step: 100, default: 2500 },
    { key: "meiaVida", label: "Meia-vida do pai T½", unit: "s", min: 0.5, max: 30, step: 0.1, default: 5 },
    { key: "meiaVida2", label: "Meia-vida do filho (cadeia)", unit: "s", min: 0.2, max: 30, step: 0.1, default: 2 },
    { key: "amostra", label: "Amostra fóssil nº (datação)", unit: "", min: 1, max: 20, step: 1, default: 1 },
    { key: "seed", label: "Semente do sorteio", unit: "", min: 1, max: 999, step: 1, default: 1 },
    {
      key: "escala",
      label: "Gráfico de N(t)",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 1,
      live: true,
      options: [
        { value: 0, label: "Linear" },
        { value: 1, label: "Logarítmico (ln N, reta)" },
      ],
    },
  ],

  observables: [
    { key: "N", label: "Núcleos-pai N", unit: "", value: (s) => s.NP },
    { key: "Nteo", label: "N teórico N₀e^(−λt)", unit: "", value: (_s, p, t) => parentTheory(p, t) },
    { key: "ND", label: "Núcleos-filho", unit: "", value: (s) => s.ND },
    { key: "NDteo", label: "Filhos teóricos (cadeia)", unit: "", value: (_s, p, t) => (modo(p) === MODO_CADEIA ? daughterTheory(p, t) : expectedStart(p) - parentTheory(p, t)) },
    { key: "NS", label: "Estáveis (cadeia)", unit: "", value: (s) => s.NS },
    { key: "lnN", label: "ln N", unit: "", value: (s) => Math.log(Math.max(s.NP, 1)) },
    { key: "A", label: "Atividade medida (último intervalo)", unit: "Bq", value: activity },
    { key: "frac", label: "Fração restante N/N₀", unit: "%", value: (s, p) => (100 * s.NP) / cellCount(p) },
    { key: "Tfit", label: "Meia-vida ajustada", unit: "s", value: (s, p) => { const f = fitOf(s, p); return f && f.lambda > 0 ? Math.LN2 / f.lambda : 0; } },
    { key: "dTfit", label: "Incerteza da meia-vida ajustada", unit: "s", value: (s, p) => { const f = fitOf(s, p); return f && f.lambda > 0 ? (Math.LN2 * f.sigma) / f.lambda ** 2 : 0; } },
    { key: "idade", label: "Idade estimada (datação)", unit: "anos", value: (s, p, t) => (modo(p) === MODO_DATACAO && s.NP > 0 ? estimatedAge(s, p, t) : 0) },
  ],
  chart: { x: "t", y: "N" },

  scenarios: [
    {
      id: "simples",
      label: "Meia-vida de 5 s",
      params: { modo: 0, N0: 2500, meiaVida: 5, escala: 1 },
      guide: `### Decaimento como sorteio
1. Cada núcleo "joga um dado" a cada passo: decai com probabilidade $\\lambda\\,\\Delta t$. Nenhum núcleo sabe sua idade.
2. Pare em $t = 5$ s e em $t = 10$ s e leia a fração restante. Compare com $1/2$ e $1/4$.
3. No gráfico de $\\ln N$, os pontos caem numa reta de inclinação $-\\lambda$. Leia a meia-vida ajustada e sua incerteza.
4. Mude a **semente** e repita: o resultado muda dentro da incerteza?`,
      predict: [
        {
          question: "Depois de duas meias-vidas, que fração dos núcleos ainda não decaiu?",
          options: ["0 (todos decaíram)", "1/2", "1/4", "1/3"],
          answer: 2,
          explanation: "A cada meia-vida sobra metade do que havia: $\\tfrac12 \\cdot \\tfrac12 = \\tfrac14$.",
        },
      ],
    },
    {
      id: "poucos",
      label: "Poucos núcleos: flutuações",
      params: { modo: 0, N0: 100, meiaVida: 5, escala: 0 },
      guide: `### Estatística de Poisson
1. Com 100 núcleos, conte quantos restam em $t = 5$ s. Deu exatamente 50?
2. As barras de contagem têm erro $\\pm\\sqrt{C}$. Compare o tamanho relativo do erro com o do cenário de 2500 núcleos.
3. A incerteza da meia-vida ajustada cai como $1/\\sqrt{N_0}$. Confira trocando $N_0$ para 400 e 1600.`,
      predict: [
        {
          question: "Com 100 núcleos de meia-vida 5 s, depois de 5 s restam:",
          options: ["exatamente 50", "cerca de 50, com flutuação típica de ±5", "cerca de 50, com flutuação típica de ±25"],
          answer: 1,
          explanation: "O número de decaimentos é binomial: desvio padrão $\\sqrt{Np(1-p)} = \\sqrt{100 \\cdot 0{,}5 \\cdot 0{,}5} = 5$.",
        },
      ],
    },
    {
      id: "cadeia",
      label: "Cadeia pai → filho",
      params: { modo: 1, N0: 4900, meiaVida: 6, meiaVida2: 1.5, escala: 0 },
      guide: `### Equilíbrio transitório
1. Os filhos (laranja) se acumulam, passam por um máximo e depois decaem acompanhando o pai.
2. O máximo ocorre em $t_m = \\dfrac{\\ln(\\lambda_2/\\lambda_1)}{\\lambda_2 - \\lambda_1}$. Calcule e confira no gráfico.
3. Depois do máximo, a razão filho/pai fica constante: $N_F/N_P \\to \\lambda_1/(\\lambda_2 - \\lambda_1)$.
4. O que acontece se o filho viver mais que o pai (troque as meias-vidas)?`,
    },
    {
      id: "datacao",
      label: "Datação por carbono-14",
      params: { modo: 2, N0: 10000, amostra: 3, escala: 1 },
      guide: `### Quantos anos tem o fóssil?
1. A grade é uma amostra fóssil com o mesmo número de átomos de carbono-14 que um organismo vivo teria ($N_{\\text{vivo}} = N_0$). Os cinzas já viraram nitrogênio-14.
2. **Antes de rodar**, leia a fração restante e calcule a idade: $t = \\dfrac{5730\\ \\text{anos}}{\\ln 2}\\ln\\dfrac{N_{\\text{vivo}}}{N}$.
3. Rode (1 s de simulação = 1000 anos) e confira que o ajuste dá $T_{1/2} \\approx 5{,}73$ s, isto é, 5730 anos.
4. Compare com a **idade estimada** da simulação. A incerteza vem da contagem: $\\sigma_t \\approx \\dfrac{T_{1/2}}{\\ln 2}\\dfrac{1}{\\sqrt N}$.`,
    },
  ],

  exercises: [
    {
      id: "restantes",
      prompt: "Uma amostra tem {N0} núcleos de meia-vida {meiaVida} s. Quantos núcleos, em média, ainda não decaíram após {t} s?",
      vary: { N0: [1000, 10000, -2], meiaVida: [2, 15, 1], t: [1, 30, 0] },
      fixed: { modo: 0 },
      answer: { label: "N", unit: "", compute: (p) => num(p, "N0") * 0.5 ** (num(p, "t") / num(p, "meiaVida")) },
      hint: "N = N₀ (1/2)^(t/T½).",
    },
    {
      id: "carbono14",
      prompt: "Um pedaço de carvão de uma fogueira antiga tem {frac}% do carbono-14 encontrado em madeira viva. Qual é a idade da fogueira? (T½ = 5730 anos)",
      vary: { frac: [5, 90, 1] },
      fixed: { modo: MODO_DATACAO },
      answer: { label: "t", unit: "anos", compute: (p) => (C14_HALF_LIFE / Math.LN2) * Math.log(100 / num(p, "frac")) },
      hint: "t = (T½/ln 2) · ln(N_vivo/N).",
    },
    {
      id: "atividade",
      prompt: "Uma amostra tem {N0} núcleos de meia-vida {meiaVida} s. Qual é a atividade inicial?",
      vary: { N0: [1000, 10000, -2], meiaVida: [1, 30, 1] },
      fixed: { modo: 0 },
      answer: { label: "A", unit: "Bq", compute: (p) => (Math.LN2 / num(p, "meiaVida")) * num(p, "N0") },
      hint: "A = λN, com λ = ln 2 / T½.",
    },
  ],

  init: initState,
  step: (s, p, _t, dt) => decayStep(s, p, dt),
  dt: DT,
  sampleEvery: 20,
  maxSamples: 1000,
  stopWhen: (s, p) => tStop(p) - s.k * DT + 1e-9,

  viewport: () => ({ xMin: 0, xMax: 20, yMin: 0, yMax: 10 }),

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const { state: s, params: p, theme, t } = frame;
    const m = modo(p);
    const n = s.cells.length;
    const side = Math.ceil(Math.sqrt(n));
    const cs = GRID.size / side;
    const colPai = theme.accent;
    const colFilho = theme.series[1]!;

    // ---------- Grade de núcleos ----------
    d.rect(GRID.x0, GRID.y0, GRID.size, GRID.size, { stroke: theme.grid, width: 1 });
    const gap = cs > 0.12 ? cs * 0.12 : 0;
    for (let i = 0; i < n; i++) {
      const c = s.cells[i]!;
      const x = GRID.x0 + (i % side) * cs;
      const y = GRID.y0 + GRID.size - (Math.floor(i / side) + 1) * cs;
      if (c === ESTAVEL || (c === FILHO && m !== MODO_CADEIA)) d.rect(x + gap / 2, y + gap / 2, cs - gap, cs - gap, { fill: theme.muted, alpha: 0.35 });
      else d.rect(x + gap / 2, y + gap / 2, cs - gap, cs - gap, { fill: c === FILHO ? colFilho : colPai });
    }
    const names = m === MODO_DATACAO ? ["C-14", "N-14"] : m === MODO_CADEIA ? ["pai", "filho", "estável"] : ["pai", "decaído (estável)"];
    const cols = [colPai, m === MODO_CADEIA ? colFilho : theme.muted, theme.muted];
    names.forEach((nm, i) => {
      d.rect(GRID.x0 + i * 3, GRID.y0 + GRID.size + 0.15, 0.3, 0.3, { fill: cols[i]!, alpha: i === names.length - 1 && m !== MODO_CADEIA ? 0.5 : i === 2 ? 0.5 : 1 });
      d.text(nm, GRID.x0 + i * 3 + 0.45, GRID.y0 + GRID.size + 0.3, { align: "left", size: 11 });
    });
    d.text(m === MODO_DATACAO ? `t = ${fmt(t * YEARS_PER_SECOND, 4)} anos desde hoje` : `t = ${fmt(t, 3)} s`, GRID.x0 + GRID.size / 2, 0.15, { size: 12, weight: "600" });

    // ---------- N(t) ----------
    const tMax = tStop(p);
    const N0 = Math.max(1, cellCount(p));
    const logY = Math.round(num(p, "escala")) === 1;
    const lnTop = Math.log(N0) + 0.3;
    const lnBot = Math.max(0, Math.log(Math.max(1, parentTheory(p, tMax))) - 1);
    const X = (tt: number) => PN.x0 + (tt / tMax) * (PN.x1 - PN.x0);
    const Y = (N: number) =>
      logY ? PN.y0 + ((Math.log(Math.max(N, 1e-3)) - lnBot) / (lnTop - lnBot)) * (PN.y1 - PN.y0) : PN.y0 + (N / (N0 * 1.05)) * (PN.y1 - PN.y0);
    const inside = (y: number) => y >= PN.y0 - 1e-9 && y <= PN.y1 + 1e-9;
    d.line(PN.x0, PN.y0, PN.x1, PN.y0, { color: theme.muted });
    d.line(PN.x0, PN.y0, PN.x0, PN.y1, { color: theme.muted });
    d.text(logY ? "N (escala log)" : "N", PN.x0, PN.y1 + 0.3, { align: "left", size: 11, color: theme.muted });
    d.text(m === MODO_DATACAO ? "t (s; 1 s = 1000 anos)" : "t (s)", PN.x1, PN.y0 - 0.55, { align: "right", size: 11, color: theme.muted });
    for (let k = 0; k <= 5; k++) d.text(fmt((tMax * k) / 5, 2), X((tMax * k) / 5), PN.y0 - 0.22, { size: 9, color: theme.muted });
    if (logY) {
      for (const v of [1, 10, 100, 1000, 10000]) if (Math.log(v) >= lnBot && Math.log(v) <= lnTop) d.text(String(v), PN.x0 - 0.1, Y(v), { size: 9, color: theme.muted, align: "right" });
    } else for (const f of [0.5, 1]) d.text(fmt(N0 * f), PN.x0 - 0.1, Y(N0 * f), { size: 9, color: theme.muted, align: "right" });

    const curve = (f: (tt: number) => number): [number, number][] =>
      Array.from({ length: 121 }, (_, i) => (tMax * i) / 120)
        .map((tt): [number, number] => [X(tt), Y(f(tt))])
        .filter(([, y]) => inside(y));
    d.polyline(curve((tt) => parentTheory(p, tt)), { color: colPai, width: 1.5, alpha: 0.6 });
    if (m === MODO_CADEIA) d.polyline(curve((tt) => daughterTheory(p, tt)), { color: colFilho, width: 1.5, alpha: 0.6 });
    const fit = fitOf(s, p);
    if (fit && fit.lambda > 0) d.polyline(curve((tt) => Math.exp(fit.lnN0 - fit.lambda * tt)), { color: theme.text, width: 1.5, dash: [5, 4] });
    const w = binWidth(p);
    s.Nhist.forEach((N, i) => {
      const y = Y(N);
      if (inside(y)) d.dot(X(i * w), y, 2.6, colPai);
    });
    if (m === MODO_CADEIA)
      s.NDhist.forEach((N, i) => {
        const y = Y(N);
        if (inside(y)) d.dot(X(i * w), y, 2.6, colFilho);
      });
    d.line(X(Math.min(t, tMax)), PN.y0, X(Math.min(t, tMax)), PN.y1, { color: theme.muted, width: 1, alpha: 0.6 });
    // Legenda do gráfico
    d.line(PN.x1 - 3.6, PN.y1 - 0.15, PN.x1 - 3.1, PN.y1 - 0.15, { color: colPai, alpha: 0.6 });
    d.text("teoria", PN.x1 - 3.0, PN.y1 - 0.15, { align: "left", size: 10 });
    d.line(PN.x1 - 1.8, PN.y1 - 0.15, PN.x1 - 1.3, PN.y1 - 0.15, { color: theme.text, dash: [5, 4] });
    d.text("ajuste", PN.x1 - 1.2, PN.y1 - 0.15, { align: "left", size: 10 });

    // ---------- Contagens por intervalo ----------
    const nb = Math.max(1, Math.round(tMax / w));
    const expected = (i: number) => parentTheory(p, i * w) - parentTheory(p, (i + 1) * w);
    const cMax = Math.max(4, expected(0) * 1.6, ...s.counts.map((c) => c + Math.sqrt(c)));
    const bw = (PC.x1 - PC.x0) / nb;
    const CY = (c: number) => PC.y0 + (c / cMax) * (PC.y1 - PC.y0);
    d.line(PC.x0, PC.y0, PC.x1, PC.y0, { color: theme.muted });
    d.line(PC.x0, PC.y0, PC.x0, PC.y1, { color: theme.muted });
    d.text(`contagens por intervalo de ${fmt(m === MODO_DATACAO ? w * YEARS_PER_SECOND : w, 3)} ${m === MODO_DATACAO ? "anos" : "s"} (±√C)`, PC.x0, PC.y1 + 0.3, { align: "left", size: 11, color: theme.muted });
    d.text(fmt(Math.round(cMax * 0.8)), PC.x0 - 0.1, CY(Math.round(cMax * 0.8)), { size: 9, color: theme.muted, align: "right" });
    s.counts.forEach((c, i) => {
      if (i >= nb) return;
      const x = PC.x0 + i * bw;
      d.rect(x + bw * 0.1, PC.y0, bw * 0.8, CY(c) - PC.y0, { fill: colPai, alpha: 0.55 });
      const e = Math.sqrt(c);
      d.line(x + bw / 2, CY(Math.max(0, c - e)), x + bw / 2, CY(c + e), { color: theme.text, width: 1 });
    });
    d.polyline(
      Array.from({ length: nb }, (_, i): [number, number] => [PC.x0 + (i + 0.5) * bw, CY(expected(i))]),
      { color: theme.positive, width: 1.5, dash: [4, 3] },
    );
    d.text("esperado", PC.x1, CY(expected(0)) + 0.1, { align: "right", size: 10, color: theme.positive });

    // Resultado do ajuste
    const T1 = halfLife(p);
    let txt = "ajuste de ln N × t: aguardando 3 pontos";
    if (fit && fit.lambda > 0) {
      const Tf = Math.LN2 / fit.lambda;
      const dT = (Tf * fit.sigma) / fit.lambda;
      txt = m === MODO_DATACAO
        ? `T½ ajustada = ${fmt(Tf * YEARS_PER_SECOND, 4)} ± ${fmt(dT * YEARS_PER_SECOND, 2)} anos (real: ${C14_HALF_LIFE})`
        : `T½ ajustada = ${fmt(Tf, 3)} ± ${fmt(dT, 2)} s (real: ${fmt(T1, 3)} s)`;
    }
    d.text(txt, (PN.x0 + PN.x1) / 2, 4.95, { size: 12, weight: "600" });
    if (m === MODO_DATACAO && s.NP > 0) {
      const age = estimatedAge(s, p, t);
      const sig = C14_HALF_LIFE / Math.LN2 / Math.sqrt(s.NP);
      d.text(`C-14 restante: ${fmt((100 * s.NP) / n, 3)} %  →  idade ≈ ${fmt(age, 3)} ± ${fmt(sig, 2)} anos`, (PN.x0 + PN.x1) / 2, 0.3, { size: 11 });
    }
  },
});

export default decaimento;
