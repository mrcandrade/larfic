import { defineSim, draw, formatBR, num, texNum, type Draw, type Params } from "@fisilab/core";
import {
  BH,
  BW,
  KB,
  TAU_PS,
  einsteinS,
  entropyOf,
  initState,
  kTEinstein,
  kineticEnergy,
  leftCounts,
  lnChoose,
  lnOmegaEinstein,
  potentialEnergy,
  reverse,
  step,
  type EntState,
} from "./engine.ts";

export * from "./engine.ts";

const fmt = (v: number, d = 3) => formatBR(v, d);
const LN10 = Math.log(10);
const MEV = 1.602176634e-22; // J
const epsK = (p: Params) => (num(p, "eps", 10) * MEV) / KB; // ε/k em kelvin

const PERTS = [0, 1e-12, 1e-8, 1e-4];
const delta = (p: Params) => PERTS[Math.round(num(p, "pert"))] ?? 0;

/** Entropia máxima (k) do macroestado: metade em cada lado, ou partilha mais provável dos quanta. */
export function maxEntropy(s: EntState): number {
  if (s.mode === 2) {
    const e = einsteinS(s);
    const qT = e.qA + e.qB;
    let best = -Infinity;
    for (let a = 0; a <= qT; a++) best = Math.max(best, lnOmegaEinstein(e.NA, a) + lnOmegaEinstein(e.NB, qT - a));
    return best;
  }
  const c = leftCounts(s);
  if (s.mode === 1) return lnChoose(c.NA, Math.floor(c.NA / 2)) + lnChoose(c.NB, Math.floor(c.NB / 2));
  return lnChoose(s.x.length, Math.floor(s.x.length / 2));
}

const timeOf = (s: EntState) => (s.mode === 2 ? s.tr : s.tr * TAU_PS);

export const entropia = defineSim<EntState>({
  id: "entropia",
  title: "Entropia e irreversibilidade",
  course: "FG II",
  topic: "2ª Lei",
  priority: "P2",
  summary:
    "Entropia como contagem de microestados, S = k ln Ω: expansão livre e mistura num gás de partículas com dinâmica reversível, e dois sólidos de Einstein em contato térmico. Inverter as velocidades faz o gás voltar, mas só se a inversão for feita cedo: a seta do tempo é estatística.",
  equations: [
    String.raw`S = k \ln \Omega \qquad \Omega(n_E) = \binom{N}{n_E} = \frac{N!}{n_E!\,(N - n_E)!}`,
    String.raw`\text{expansão livre e mistura: } \Delta S = N k \ln\frac{V_f}{V_i} = N k \ln 2`,
    String.raw`\text{sólido de Einstein: } \Omega(N, q) = \binom{q + N - 1}{q} \qquad \frac{1}{T} = \frac{\partial S}{\partial U} = \frac{k}{\varepsilon}\ln\!\left(1 + \frac{N}{q}\right)`,
    String.raw`\Delta S_{\text{total}} = \Delta S_A + \Delta S_B \ge 0 \qquad P(\text{todas à esquerda}) = 2^{-N}`,
  ],
  liveEquations(s, p) {
    if (s.mode === 2) {
      const e = einsteinS(s);
      const eK = epsK(p);
      return [
        String.raw`S_A = \ln\binom{${e.qA} + ${e.NA} - 1}{${e.qA}} = ${texNum(e.SA, 4)}\,k \qquad S_B = ${texNum(e.SB, 4)}\,k`,
        String.raw`\Delta S_{\text{total}} = ${texNum(e.S - s.S0, 4)}\,k = ${texNum((e.S - s.S0) * KB)}\ \text{J/K}`,
        String.raw`T_A = ${texNum(kTEinstein(e.NA, e.qA) * eK)}\ \text{K} \qquad T_B = ${texNum(kTEinstein(e.NB, e.qB) * eK)}\ \text{K}`,
      ];
    }
    const c = leftCounts(s);
    const N = s.x.length;
    const S = entropyOf(s);
    const out = [
      s.mode === 1
        ? String.raw`\Omega = \binom{${c.NA}}{${c.aL}}\binom{${c.NB}}{${c.bL}} = 10^{${texNum(S / LN10)}} \qquad S = ${texNum(S, 4)}\,k`
        : String.raw`\Omega = \binom{${N}}{${c.nL}} = 10^{${texNum(S / LN10)}} \qquad S = k\ln\Omega = ${texNum(S, 4)}\,k = ${texNum(S * KB)}\ \text{J/K}`,
      String.raw`N k \ln 2 = ${texNum(N * Math.LN2, 4)}\,k \qquad S_{\max} = ${texNum(maxEntropy(s), 4)}\,k`,
      String.raw`P(\text{voltar ao estado inicial}) = 2^{-${N}} = ${texNum(2 ** -N)}`,
    ];
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
        { value: 0, label: "Expansão livre de um gás" },
        { value: 1, label: "Mistura de dois gases" },
        { value: 2, label: "Contato térmico (sólidos de Einstein)" },
      ],
    },
    { key: "N", label: "Número de partículas (gás)", unit: "", min: 10, max: 200, step: 2, default: 80 },
    {
      key: "pert",
      label: "Erro ao inverter as velocidades",
      unit: "",
      min: 0,
      max: 3,
      step: 1,
      default: 0,
      live: true,
      options: [
        { value: 0, label: "Nenhum (só arredondamento ~10⁻¹⁶)" },
        { value: 1, label: "10⁻¹² (relativo)" },
        { value: 2, label: "10⁻⁸ (relativo)" },
        { value: 3, label: "10⁻⁴ (relativo)" },
      ],
    },
    { key: "NA", label: "Osciladores do corpo A", unit: "", min: 50, max: 400, step: 10, default: 300 },
    { key: "NB", label: "Osciladores do corpo B", unit: "", min: 50, max: 400, step: 10, default: 100 },
    { key: "qA", label: "Quanta iniciais em A", unit: "", min: 0, max: 600, step: 10, default: 40 },
    { key: "qB", label: "Quanta iniciais em B", unit: "", min: 0, max: 600, step: 10, default: 360 },
    { key: "eps", label: "Quantum de energia ε = ħω", unit: "meV", min: 2, max: 50, step: 1, default: 10 },
    { key: "seed", label: "Semente", unit: "", min: 1, max: 999, step: 1, default: 1 },
  ],

  observables: [
    { key: "tf", label: "Tempo físico (gás: ps; sólidos: passos)", unit: "", value: (s) => timeOf(s) },
    { key: "S", label: "Entropia S/k = ln Ω", unit: "", value: (s) => entropyOf(s) },
    { key: "dS", label: "Variação de entropia ΔS/k", unit: "", value: (s) => entropyOf(s) - (s.mode === 2 ? s.S0 : 0) },
    { key: "SJ", label: "Entropia S", unit: "J/K", value: (s) => entropyOf(s) * KB },
    { key: "logO", label: "log₁₀ Ω", unit: "", value: (s) => entropyOf(s) / LN10 },
    { key: "nL", label: "Partículas na metade esquerda", unit: "", value: (s) => (s.mode === 2 ? 0 : leftCounts(s).nL) },
    { key: "aL", label: "Partículas A na metade esquerda", unit: "", value: (s) => (s.mode === 1 ? leftCounts(s).aL : 0) },
    { key: "E", label: "Energia do gás", unit: "kT₀", value: (s) => (s.mode === 2 ? 0 : kineticEnergy(s) + potentialEnergy(s)) },
    { key: "qAt", label: "Quanta no corpo A", unit: "", value: (s) => (s.mode === 2 ? s.qA : 0) },
    { key: "SA", label: "Entropia do corpo A", unit: "k", value: (s) => (s.mode === 2 ? einsteinS(s).SA : 0) },
    { key: "SB", label: "Entropia do corpo B", unit: "k", value: (s) => (s.mode === 2 ? einsteinS(s).SB : 0) },
    { key: "TA", label: "Temperatura de A", unit: "K", value: (s, p) => (s.mode === 2 ? kTEinstein(s.NA, s.qA) * epsK(p) : 0) },
    { key: "TB", label: "Temperatura de B", unit: "K", value: (s, p) => (s.mode === 2 ? kTEinstein(s.q.length - s.NA, einsteinS(s).qB) * epsK(p) : 0) },
  ],
  chart: { x: "tf", y: "S" },

  scenarios: [
    {
      id: "expansao",
      label: "Expansão livre",
      params: { modo: 0, N: 80 },
      guide: `### Por que o gás não volta sozinho
1. A divisória acabou de ser retirada: as $N$ partículas estão na metade esquerda. Só **um** microestado de "metades" é compatível com isso: $\\Omega = 1$, $S = 0$.
2. Rode. O número $n_E$ de partículas à esquerda cai até oscilar em torno de $N/2$, onde $\\Omega = \\binom{N}{N/2}$ é enorme.
3. O gráfico de baixo mostra quantos microestados há para cada $n_E$. O gás não "prefere" a metade: ele visita os microestados ao acaso, e quase todos têm $n_E \\approx N/2$.
4. Compare $S_{\\max}$ com $Nk\\ln 2$, a variação de entropia termodinâmica de uma expansão livre que dobra o volume.
5. Diminua $N$ para 10: as flutuações ficam visíveis e às vezes $S$ cai bastante. Com $N = 10^{23}$, a chance de voltar ($2^{-N}$) é nula na prática.`,
      predict: [
        {
          question: "Depois de espalhado pela caixa, quanto tempo seria preciso esperar para que as 80 partículas voltem, sozinhas, todas para a metade esquerda?",
          options: ["Alguns segundos", "Algumas horas", "Muito mais que uma vida humana"],
          answer: 2,
          explanation: "A fração de microestados com todas à esquerda é $2^{-80} \\approx 10^{-24}$. Mesmo visitando um microestado novo a cada picossegundo, a espera típica seria de $10^{12}$ s, cerca de 30 mil anos; com um mol de gás, $2^{-6 \\times 10^{23}}$ é inimaginavelmente menor.",
        },
      ],
    },
    {
      id: "seta",
      label: "Seta do tempo: inverter as velocidades",
      params: { modo: 0, N: 60, pert: 0 },
      guide: `### Leis reversíveis, comportamento irreversível
1. Rode por cerca de 4 s (≈ 20 ps de tempo físico) e clique em **Inverter velocidades**. As equações de Newton são reversíveis: o gás refaz o caminho e volta inteiro para a esquerda. $S$ desce de volta a zero!
2. Reinicie e espere uns 15 s antes de inverter. Agora o gás **não volta**: o pequeno erro de arredondamento do computador ($10^{-16}$) é amplificado exponencialmente a cada colisão (caos).
3. Escolha um erro de $10^{-4}$ ao inverter: mesmo invertendo cedo a volta falha.
4. A seta do tempo não está nas leis microscópicas, e sim na enorme sensibilidade às condições iniciais e no número astronômico de microestados de alta entropia.`,
      predict: [
        {
          question: "Depois de o gás se espalhar por bastante tempo, invertemos exatamente todas as velocidades. O que acontece?",
          options: [
            "O gás volta para a esquerda, sempre",
            "Em princípio voltaria, mas qualquer erro minúsculo cresce nas colisões e ele não volta",
            "As partículas param",
          ],
          answer: 1,
          explanation: "As leis de Newton são reversíveis, mas a dinâmica é caótica: erros crescem como $e^{\\lambda t}$. Quanto mais tempo se espera, maior a precisão necessária para refazer o caminho.",
        },
      ],
    },
    {
      id: "mistura",
      label: "Mistura de dois gases",
      params: { modo: 1, N: 80 },
      guide: `### Entropia de mistura
1. Gás A (azul) à esquerda e gás B (laranja) à direita, com a mesma densidade. Sem divisória, cada gás passa a ocupar o volume todo.
2. A contagem é $\\Omega = \\binom{N_A}{a_E}\\binom{N_B}{b_E}$. Acompanhe $S$ crescer até perto de $Nk\\ln 2$: cada espécie dobrou o seu volume.
3. **Paradoxo de Gibbs**: se os dois gases fossem idênticos, nada mudaria macroscopicamente e $\\Delta S = 0$. A entropia de mistura só existe porque conseguimos distinguir A de B.
4. Inverta as velocidades cedo e veja os gases se "desmisturarem".`,
    },
    {
      id: "contato",
      label: "Contato térmico entre dois corpos",
      params: { modo: 2, NA: 300, NB: 100, qA: 300, qB: 150 },
      guide: `### O calor flui para aumentar Ω
1. Dois sólidos de Einstein: A com 300 osciladores e 300 quanta, B com 100 osciladores e 150 quanta. B tem **menos** energia, mas mais energia por oscilador.
2. Rode. Os quanta passam ao acaso de um oscilador a outro. Acompanhe $q_A$, $S_A$, $S_B$ e $S_A + S_B$.
3. O gráfico de baixo mostra $\\Omega_A\\Omega_B$ para cada partilha $q_A$: o sistema vai para o pico, onde $\\partial S_A/\\partial q_A = \\partial S_B/\\partial q_B$, ou seja, $T_A = T_B$.
4. $S_A$ pode diminuir, mas $\\Delta S_{\\text{total}} > 0$. Com corpos macroscópicos o pico é tão estreito que nunca se observa o calor fluir ao contrário.`,
      predict: [
        {
          question: "O corpo A tem 300 quanta em 300 osciladores; o corpo B tem 150 quanta em 100 osciladores. Em contato, a energia flui:",
          options: ["de A para B, porque A tem mais energia", "de B para A, porque B está mais quente", "não flui, pois as energias se compensam"],
          answer: 1,
          explanation: "Quem decide é a temperatura, $1/T = \\partial S/\\partial U$. B tem mais quanta por oscilador e está mais quente ($kT_B \\approx 1{,}96\\,\\varepsilon$ contra $1{,}44\\,\\varepsilon$ em A); a partilha mais provável dá $q_A = 337{,}5$.",
        },
      ],
    },
  ],

  exercises: [
    {
      id: "expansao",
      prompt: "{n} mol de um gás ideal sofrem expansão livre de {Vi} L para {Vf} L. Qual é a variação de entropia do gás?",
      vary: { n: [0.2, 3, 1], Vi: [1, 5, 1], Vf: [6, 20, 1] },
      answer: { label: "ΔS", unit: "J/K", compute: (p) => num(p, "n") * 8.314462618 * Math.log(num(p, "Vf") / num(p, "Vi")) },
      hint: "S é função de estado: calcule por uma isotérmica reversível entre os mesmos estados, ΔS = nR ln(V_f/V_i).",
    },
    {
      id: "contato",
      prompt:
        "Um bloco de capacidade térmica {CA} J/K a {TA} K é posto em contato com outro de {CB} J/K a {TB} K, isolados do resto. Qual é a variação total de entropia até o equilíbrio?",
      vary: { CA: [100, 900, 0], TA: [350, 500, 0], CB: [100, 900, 0], TB: [250, 340, 0] },
      answer: {
        label: "ΔS_total",
        unit: "J/K",
        compute: (p) => {
          const CA = num(p, "CA"), CB = num(p, "CB"), TA = num(p, "TA"), TB = num(p, "TB");
          const Tf = (CA * TA + CB * TB) / (CA + CB);
          return CA * Math.log(Tf / TA) + CB * Math.log(Tf / TB);
        },
      },
      hint: "T_f = (C_A T_A + C_B T_B)/(C_A + C_B) e ΔS = C_A ln(T_f/T_A) + C_B ln(T_f/T_B).",
    },
  ],

  init: initState,
  step: (s, p) => step(s, p),
  dt: 0.01,
  sampleEvery: 5,
  maxSamples: 1500,

  actions: [{ id: "inverter", label: "Inverter velocidades", run: (s, p) => reverse(s, delta(p)) }],

  narrowSplit: () => 0.569,
  viewport: () => ({ xMin: 0, xMax: 16, yMin: 0, yMax: 9 }),

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const s = frame.state;
    if (s.mode === 2) renderEinstein(d, s, frame.params);
    else renderGas(d, s);
    drawHistory(d, s, frame.trail);
  },
});

// ---------- Desenho ----------
const BOX = { x0: 0.5, y0: 4.3, sc: 0.2 }; // 40σ × 20σ → 8 × 4
const HIST = { x0: 0.9, x1: 8.6, y0: 0.7, y1: 3.2 };
const SP = { x0: 10.0, x1: 15.6, y0: 4.6, y1: 8.3 };

function renderGas(d: Draw, s: EntState) {
  const { theme } = d;
  const N = s.x.length;
  const c = leftCounts(s);
  const X = (x: number) => BOX.x0 + x * BOX.sc;
  const Y = (y: number) => BOX.y0 + y * BOX.sc;
  d.rect(X(0), Y(0), BW * BOX.sc, BH * BOX.sc, { fill: theme.accent, alpha: 0.04, stroke: theme.text, width: 2.5 });
  d.line(X(BW / 2), Y(0), X(BW / 2), Y(BH), { color: theme.muted, dash: [4, 5], width: 1 });
  d.text("divisória retirada", X(BW / 2), Y(BH) + 0.2, { size: 10, color: theme.muted });
  for (let i = 0; i < N; i++) {
    const col = s.mode === 1 ? (s.sp[i] === 0 ? theme.series[0]! : theme.series[1]!) : theme.accent;
    d.circle(X(s.x[i]!), Y(s.y[i]!), 0.5 * BOX.sc, { fill: col, minPx: 2.5 });
  }
  const labL = s.mode === 1 ? `esquerda: ${c.aL} A + ${c.bL} B` : `esquerda: n_E = ${c.nL}`;
  const labR = s.mode === 1 ? `direita: ${c.NA - c.aL} A + ${c.NB - c.bL} B` : `direita: ${N - c.nL}`;
  d.text(labL, X(BW / 4), Y(0) - 0.25, { size: 11, weight: "600" });
  d.text(labR, X((3 * BW) / 4), Y(0) - 0.25, { size: 11, weight: "600" });
  const rev = s.tRev >= 0 ? `   ·   velocidades invertidas em t = ${fmt(s.tRev * TAU_PS)} ps` : "";
  d.text(`t = ${fmt(s.tr * TAU_PS)} ps (argônio, σ = 0,34 nm)${rev}`, BOX.x0, 8.75, { size: 10, color: theme.muted, align: "left" });

  // Distribuição de microestados por macroestado
  const NA = s.mode === 1 ? c.NA : N;
  const cur = s.mode === 1 ? c.aL : c.nL;
  const lnMax = lnChoose(NA, Math.floor(NA / 2));
  const bw = (HIST.x1 - HIST.x0) / (NA + 1);
  axesH(d, s.mode === 1 ? "a_E (partículas A à esquerda)" : "n_E (partículas à esquerda)", "Ω/Ω_max");
  for (let n = 0; n <= NA; n++) {
    const h = Math.exp(lnChoose(NA, n) - lnMax);
    const x = HIST.x0 + n * bw;
    const hit = n === cur || (s.mode === 1 && n === c.bL);
    if (h * (HIST.y1 - HIST.y0) > 0.004 || hit) d.rect(x, HIST.y0, bw * 0.85, Math.max(h * (HIST.y1 - HIST.y0), 0.03), { fill: hit ? theme.positive : theme.accent, alpha: hit ? 1 : 0.45 });
  }
  d.text("0", HIST.x0, HIST.y0 - 0.25, { size: 9, color: theme.muted });
  d.text(String(NA), HIST.x0 + NA * bw, HIST.y0 - 0.25, { size: 9, color: theme.muted });
  d.text(String(Math.floor(NA / 2)), HIST.x0 + Math.floor(NA / 2) * bw, HIST.y0 - 0.25, { size: 9, color: theme.muted });
  d.arrowPx(HIST.x0 + (cur + 0.4) * bw, HIST.y1 + 0.45, 0, -1, 14, { color: theme.positive });
  d.text(s.mode === 1 ? "A agora (B: segunda barra vermelha)" : "agora", HIST.x0 + (cur + 0.4) * bw, HIST.y1 + 0.6, { size: 10, color: theme.positive, dy: -4 });
}

function renderEinstein(d: Draw, s: EntState, p: Params) {
  const { theme } = d;
  const e = einsteinS(s);
  const eK = epsK(p);
  const cols = 20;
  const cell = 0.19;
  const block = (start: number, n: number, x0: number, label: string, T: number, q: number) => {
    const rows = Math.ceil(n / cols);
    const yTop = 8.3;
    for (let i = 0; i < n; i++) {
      const qi = s.q[start + i]!;
      const x = x0 + (i % cols) * cell;
      const y = yTop - (Math.floor(i / cols) + 1) * cell;
      const a = Math.min(1, qi / 4);
      d.rect(x, y, cell * 0.92, cell * 0.92, { fill: qi === 0 ? theme.grid : theme.positive, alpha: qi === 0 ? 1 : 0.25 + 0.75 * a });
    }
    d.rect(x0 - 0.05, yTop - rows * cell - 0.05, cols * cell + 0.1, rows * cell + 0.1, { stroke: theme.text, width: 1.5 });
    d.text(label, x0, yTop + 0.25, { size: 11, weight: "600", align: "left" });
    d.text(`q = ${q}   T = ${fmt(T)} K`, x0, yTop - rows * cell - 0.3, { size: 10, align: "left" });
  };
  block(0, e.NA, 0.5, `A: ${e.NA} osciladores`, kTEinstein(e.NA, e.qA) * eK, e.qA);
  block(e.NA, e.NB, 4.6, `B: ${e.NB} osciladores`, kTEinstein(e.NB, e.qB) * eK, e.qB);
  d.text("cor: quanta por oscilador (0 = cinza)", 0.5, 4.0, { size: 10, color: theme.muted, align: "left" });

  // Ω_A Ω_B em função da partilha
  const qT = e.qA + e.qB;
  axesH(d, "q_A (quanta no corpo A)", "Ω_AΩ_B / máx");
  let lnMax = -Infinity, aBest = 0;
  for (let a = 0; a <= qT; a++) {
    const v = lnOmegaEinstein(e.NA, a) + lnOmegaEinstein(e.NB, qT - a);
    if (v > lnMax) {
      lnMax = v;
      aBest = a;
    }
  }
  const X = (a: number) => HIST.x0 + (a / Math.max(1, qT)) * (HIST.x1 - HIST.x0);
  const pts: [number, number][] = [];
  for (let a = 0; a <= qT; a++) pts.push([X(a), HIST.y0 + Math.exp(lnOmegaEinstein(e.NA, a) + lnOmegaEinstein(e.NB, qT - a) - lnMax) * (HIST.y1 - HIST.y0)]);
  d.polyline([[X(0), HIST.y0], ...pts, [X(qT), HIST.y0]], { color: theme.accent, width: 2, fill: theme.accent, alpha: 0.35, close: true });
  d.polyline(pts, { color: theme.accent, width: 2 });
  d.line(X(aBest), HIST.y0, X(aBest), HIST.y1, { color: theme.muted, dash: [3, 3], width: 1 });
  d.text(`mais provável: q_A = ${aBest}`, X(aBest), HIST.y1 + 0.2, { size: 10, color: theme.muted, align: "left", dx: 4 });
  d.arrowPx(X(e.qA), HIST.y0 + 0.9, 0, -1, 26, { color: theme.positive });
  d.text("agora", X(e.qA), HIST.y0 + 1.05, { size: 10, color: theme.positive, dy: -4 });
  d.text("0", X(0), HIST.y0 - 0.25, { size: 9, color: theme.muted });
  d.text(String(qT), X(qT), HIST.y0 - 0.25, { size: 9, color: theme.muted });
}

function axesH(d: Draw, xl: string, yl: string) {
  const { theme } = d;
  d.line(HIST.x0, HIST.y0, HIST.x1, HIST.y0, { color: theme.muted });
  d.line(HIST.x0, HIST.y0, HIST.x0, HIST.y1, { color: theme.muted });
  d.text(xl, HIST.x1, HIST.y0 - 0.55, { size: 10, color: theme.muted, align: "right" });
  d.text(yl, HIST.x0 - 0.1, HIST.y1 + 0.2, { size: 10, color: theme.muted, align: "left" });
}

/** S(t) a partir das amostras gravadas, com o máximo e N k ln 2. */
function drawHistory(d: Draw, s: EntState, trail: EntState[]) {
  const { theme } = d;
  const pts = trail.filter((q) => q.mode === s.mode).concat([s]);
  const tMax = Math.max(1e-9, ...pts.map(timeOf));
  const Smax = maxEntropy(s);
  const top = s.mode === 2 ? Smax : Math.max(Smax, s.x.length * Math.LN2);
  const bottom = s.mode === 2 ? Math.min(s.S0, ...pts.map(entropyOf)) : 0;
  const X = (t: number) => SP.x0 + (t / tMax) * (SP.x1 - SP.x0);
  const Y = (v: number) => SP.y0 + ((v - bottom) / Math.max(1e-9, (top - bottom) * 1.1)) * (SP.y1 - SP.y0);
  d.line(SP.x0, SP.y0, SP.x1, SP.y0, { color: theme.muted });
  d.line(SP.x0, SP.y0, SP.x0, SP.y1, { color: theme.muted });
  d.text(s.mode === 2 ? "passos de Monte Carlo" : "t (ps)", SP.x1, SP.y0 - 0.5, { size: 10, color: theme.muted, align: "right" });
  d.text("S/k", SP.x0, SP.y1 + 0.25, { size: 10, color: theme.muted, align: "left" });
  d.text(fmt(tMax), SP.x1, SP.y0 - 0.22, { size: 9, color: theme.muted });
  d.text(fmt(bottom), SP.x0 - 0.1, SP.y0, { size: 9, color: theme.muted, align: "right" });
  d.text(fmt(top), SP.x0 - 0.1, Y(top), { size: 9, color: theme.muted, align: "right" });
  d.line(SP.x0, Y(Smax), SP.x1, Y(Smax), { color: theme.positive, dash: [5, 4], width: 1 });
  d.text("S_max", SP.x1, Y(Smax), { size: 9, color: theme.positive, align: "right", dy: 8 });
  if (s.mode !== 2) {
    const nl2 = s.x.length * Math.LN2;
    d.line(SP.x0, Y(nl2), SP.x1, Y(nl2), { color: theme.muted, dash: [2, 3], width: 1 });
    d.text("N k ln 2", SP.x1, Y(nl2), { size: 9, color: theme.muted, align: "right", dy: -7 });
  }
  if (s.mode === 2) {
    const sA = pts.map((q): [number, number] => [X(timeOf(q)), Y(einsteinS(q).SA + einsteinS(q).SB)]);
    d.polyline(sA, { color: theme.accent, width: 2 });
  } else d.polyline(pts.map((q): [number, number] => [X(timeOf(q)), Y(entropyOf(q))]), { color: theme.accent, width: 2 });
  if (s.tRev >= 0) {
    const xr = X(s.tRev * TAU_PS);
    d.line(xr, SP.y0, xr, SP.y1, { color: theme.series[3]!, width: 1.5 });
    d.text("inversão", xr, SP.y1 + 0.2, { size: 9, color: theme.series[3]! });
  }

  // Quadro numérico
  const S = entropyOf(s);
  const lines: string[] =
    s.mode === 2
      ? (() => {
          const e = einsteinS(s);
          return [
            `S_A = ${fmt(e.SA, 4)} k     S_B = ${fmt(e.SB, 4)} k`,
            `S_total = ${fmt(e.S, 4)} k     ΔS_total = ${fmt(e.S - s.S0, 3)} k`,
            `ΔS_total = ${fmt((e.S - s.S0) * KB)} J/K ≥ 0`,
            `Ω_AΩ_B = 10^${fmt(e.S / LN10, 4)} microestados`,
          ];
        })()
      : [
          `Ω = 10^${fmt(S / LN10, 3)} microestados do macroestado atual`,
          `S = k ln Ω = ${fmt(S, 3)} k = ${fmt(S * KB)} J/K`,
          `ΔS termodinâmico: N k ln 2 = ${fmt(s.x.length * Math.LN2, 3)} k`,
          `P(todas de volta à esquerda) = 2^−${s.x.length} = ${fmt(2 ** -s.x.length)}`,
        ];
  lines.forEach((l, i) => d.text(l, SP.x0 - 0.4, 3.5 - i * 0.6, { size: 11, align: "left", weight: i === 1 ? "600" : "400" }));
  if (s.mode !== 2) d.text("botão: Inverter velocidades", SP.x0 - 0.4, 3.5 - 4 * 0.6, { size: 10, color: theme.muted, align: "left" });
}

export default entropia;
