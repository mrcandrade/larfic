import { defineSim, draw, formatBR, num, texNum, type Params } from "@fisilab/core";
import {
  E_,
  I_,
  R_,
  R0,
  S_,
  V_,
  beta,
  contactRadius,
  counts,
  dist,
  finalSusceptible,
  gamma,
  infectAt,
  initState,
  isSEIR,
  sirPeak,
  step,
  type EpiState,
} from "./engine.ts";

export * from "./engine.ts";

const fmt = (v: number, d = 3) => formatBR(v, d);
const pct = (v: number) => `${fmt(100 * v, 3)}%`;
const SQ = { x0: 0.4, y0: 0.9, L: 7.2 };
const CH = { x0: 9.1, x1: 15.6, y0: 3.7, y1: 8.4 };
const frac = (s: EpiState, k: number) => (s.st.length ? counts(s)[k]! / s.st.length : 0);
const Reff = (s: EpiState, p: Params) => R0(p) * (1 - dist(p)) * s.ode[0]!;
const herd = (p: Params) => Math.max(0, 1 - 1 / (R0(p) * (1 - dist(p))));
const finalSize = (s: EpiState, p: Params) => {
  const R = R0(p) * (1 - dist(p));
  const [S0 = 1, E0 = 0, I0 = 0] = s.hist.length ? [s.hist[0]![4]!, 0, s.hist[0]![5]!] : s.ode;
  return S0 - finalSusceptible(R, S0, E0 + I0);
};

export const epidemiaSir = defineSim<EpiState>({
  id: "epidemia-sir",
  title: "Propagação de epidemias (modelos SIR e SEIR)",
  course: "FG II",
  topic: "Física estatística",
  priority: "P2",
  summary:
    "O modelo SIR/SEIR de equações diferenciais roda lado a lado com uma população de agentes que se movem e se contagiam por proximidade, com os mesmos R₀, período infeccioso, vacinação e distanciamento. Mostra o pico, a imunidade de rebanho e o achatamento da curva.",
  equations: [
    String.raw`\frac{dS}{dt} = -\beta(1-d)\,S I \qquad \frac{dE}{dt} = \beta(1-d)\,S I - \sigma E \qquad \frac{dI}{dt} = \sigma E - \gamma I \qquad \frac{dR}{dt} = \gamma I`,
    String.raw`R_0 = \frac{\beta}{\gamma} \qquad R_{\text{ef}} = R_0 (1-d)\,S \qquad \text{a epidemia cresce enquanto } R_{\text{ef}} > 1`,
    String.raw`\text{imunidade de rebanho: } 1 - \frac{1}{R_0} \qquad \text{pico (SIR): } I_{\max} = 1 - \frac{1 + \ln R_0}{R_0}`,
    String.raw`\text{tamanho final: } S_\infty = S_0\, e^{-R_0 (1 - S_\infty)} \qquad \text{agentes: } p_c = \frac{\beta}{K},\ K = (N-1)\pi r_c^2`,
  ],
  liveEquations(s, p) {
    const R = R0(p) * (1 - dist(p));
    return [
      String.raw`\beta = R_0\gamma = ${texNum(R0(p))}\cdot ${texNum(gamma(p))} = ${texNum(beta(p))}\ \text{dia}^{-1} \qquad R_0(1-d) = ${texNum(R)}`,
      String.raw`R_{\text{ef}} = ${texNum(R)} \cdot ${texNum(s.ode[0]!)} = ${texNum(Reff(s, p))} \qquad \text{rebanho: } ${texNum(100 * herd(p))}\%`,
      String.raw`I_{\max}:\ \text{EDO } ${texNum(100 * s.peakO)}\% \ (t = ${texNum(s.tPeakO)}\ \text{d}) \qquad \text{agentes } ${texNum(100 * s.peakA)}\% \ (t = ${texNum(s.tPeakA)}\ \text{d})`,
    ];
  },

  params: [
    {
      key: "modelo",
      label: "Modelo",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 0,
      options: [
        { value: 0, label: "SIR (suscetível → infectado → recuperado)" },
        { value: 1, label: "SEIR (com período de latência E)" },
      ],
    },
    { key: "N", label: "Número de agentes", unit: "", min: 100, max: 800, step: 50, default: 500 },
    { key: "R0", label: "Número básico de reprodução R₀", unit: "", min: 0.5, max: 8, step: 0.1, default: 3 },
    { key: "Tinf", label: "Período infeccioso 1/γ", unit: "dia", min: 2, max: 14, step: 0.5, default: 7 },
    { key: "Tlat", label: "Período de latência 1/σ (SEIR)", unit: "dia", min: 1, max: 10, step: 0.5, default: 3 },
    { key: "I0", label: "Infectados iniciais", unit: "", min: 1, max: 30, step: 1, default: 3 },
    { key: "vac", label: "Fração vacinada no início", unit: "", min: 0, max: 0.95, step: 0.05, default: 0 },
    { key: "dist", label: "Distanciamento d (redução dos contatos)", unit: "", min: 0, max: 0.9, step: 0.05, default: 0, live: true },
    { key: "vel", label: "Mobilidade dos agentes", unit: "L/dia", min: 0, max: 0.6, step: 0.01, default: 0.25, live: true },
    { key: "seed", label: "Semente", unit: "", min: 1, max: 999, step: 1, default: 1 },
  ],

  observables: [
    { key: "tdias", label: "Tempo", unit: "dia", value: (s) => s.t },
    { key: "S", label: "Suscetíveis (agentes)", unit: "", value: (s) => frac(s, S_) },
    { key: "E", label: "Expostos (agentes)", unit: "", value: (s) => frac(s, E_) },
    { key: "I", label: "Infectados (agentes)", unit: "", value: (s) => frac(s, I_) },
    { key: "R", label: "Recuperados (agentes)", unit: "", value: (s) => frac(s, R_) },
    { key: "Sode", label: "Suscetíveis (EDO)", unit: "", value: (s) => s.ode[0]! },
    { key: "Eode", label: "Expostos (EDO)", unit: "", value: (s) => s.ode[1]! },
    { key: "Iode", label: "Infectados (EDO)", unit: "", value: (s) => s.ode[2]! },
    { key: "Rode", label: "Recuperados (EDO)", unit: "", value: (s) => s.ode[3]! },
    { key: "Reff", label: "Número de reprodução efetivo", unit: "", value: (s, p) => Reff(s, p) },
    { key: "pico", label: "Pico de infectados (EDO)", unit: "", value: (s) => s.peakO },
    { key: "picoA", label: "Pico de infectados (agentes)", unit: "", value: (s) => s.peakA },
    { key: "total", label: "Soma das frações (EDO)", unit: "", value: (s) => s.ode.reduce((a, b) => a + b, 0) },
  ],
  conserved: "total",
  chart: { x: "tdias", y: "Iode" },

  scenarios: [
    {
      id: "basico",
      label: "Uma epidemia com R₀ = 3",
      params: { modelo: 0, R0: 3, Tinf: 7, N: 500, I0: 3 },
      guide: `### Crescimento, pico e fim
1. Três agentes infectados (vermelho) entre 500 suscetíveis (azul). Cada infectado contagia, em média, $R_0 = 3$ pessoas enquanto todos são suscetíveis.
2. Rode. No começo o crescimento é exponencial: $I \\propto e^{(R_0-1)\\gamma t}$.
3. O pico ocorre quando $R_{\\text{ef}} = R_0 S = 1$, isto é, com $S = 1/R_0 \\approx 33\\%$ — não quando "acabam" os suscetíveis.
4. Compare o pico dos agentes com o da EDO e com $1 - (1 + \\ln 3)/3 \\approx 30\\%$.
5. No fim, cerca de 6% **nunca** se infectam: $S_\\infty = e^{-R_0(1-S_\\infty)}$. Clique num agente azul para infectá-lo.`,
      predict: [
        {
          question: "Com R₀ = 3, o número de infectados ativos para de crescer quando:",
          options: ["Todos já se infectaram", "Cerca de 2/3 da população já não é suscetível", "Passa um período infeccioso"],
          answer: 1,
          explanation: "I cresce enquanto R₀S > 1. O pico é em S = 1/R₀ = 1/3, quando 2/3 já foram infectados ou estão imunes.",
        },
      ],
    },
    {
      id: "achatar",
      label: "Achatar a curva com distanciamento",
      params: { modelo: 0, R0: 3, Tinf: 7, dist: 0.4 },
      guide: `### Achatamento da curva
1. Com distanciamento $d = 0{,}4$ os contatos caem 40%: $R_0(1-d) = 1{,}8$.
2. Rode e compare o pico (cerca de 12%) e o instante do pico com o cenário sem distanciamento (30%).
3. O número total de infectados também cai (de 94% para cerca de 73%), mas o maior ganho é o **pico menor e mais tardio** — o que o sistema de saúde precisa.
4. $d$ é ao vivo: comece com $d = 0$, ponha $d = 0{,}6$ por volta do dia 15 e depois volte a $d = 0$. Veja a "segunda onda".`,
      predict: [
        {
          question: "Reduzir os contatos em 40% (R₀ = 3 → 1,8) faz o pico de infectados simultâneos:",
          options: ["Cair 40%, de 30% para 18%", "Cair mais do que isso, para cerca de 12%", "Não mudar, só atrasar"],
          answer: 1,
          explanation: "I_max = 1 − (1 + ln R)/R é não linear em R: para R = 1,8, I_max ≈ 12%, menos da metade do pico com R = 3.",
        },
      ],
    },
    {
      id: "rebanho",
      label: "Vacinação e imunidade de rebanho",
      params: { modelo: 0, R0: 3, vac: 0.7, I0: 5 },
      guide: `### Imunidade de rebanho
1. 70% da população foi vacinada (roxo). Limiar: $1 - 1/R_0 = 67\\%$.
2. Rode: os infectados iniciais contagiam pouca gente e a epidemia **não decola**: $R_{\\text{ef}} = 3 \\times 0{,}3 = 0{,}9 < 1$.
3. Reinicie com 50% vacinados: há surto, mas menor. Com 0%, compare.
4. A proteção vale também para os não vacinados: eles quase não encontram infectados. Quanto vale o limiar para o sarampo ($R_0 \\approx 15$)?`,
      predict: [
        {
          question: "Com R₀ = 3 e 70% da população vacinada, o que acontece ao introduzir alguns infectados?",
          options: ["Um surto que atinge todos os não vacinados", "Poucos casos e a transmissão se extingue", "O surto é igual, só começa mais tarde"],
          answer: 1,
          explanation: "R_ef = R₀(1 − 0,7) = 0,9 < 1: cada caso gera menos de um novo caso, em média, e a cadeia de transmissão morre.",
        },
      ],
    },
    {
      id: "seir",
      label: "SEIR: latência e agentes × EDO",
      params: { modelo: 1, R0: 4, Tinf: 5, Tlat: 4, vel: 0.25 },
      guide: `### Latência e o limite da mistura homogênea
1. No SEIR, o contágio cria **expostos** (amarelo), que ainda não transmitem. A curva fica mais lenta, mas o tamanho final depende só de $R_0$.
2. Compare as linhas (EDO) com os pontos (agentes): com mobilidade alta os dois concordam.
3. Reduza a **mobilidade** para 0,02 L/dia (ao vivo): o contágio passa a ser local, em "frentes" que se espalham pelo quadrado, e a epidemia fica mais lenta e menor que a EDO prevê. A EDO supõe mistura perfeita.`,
    },
  ],

  exercises: [
    {
      id: "rebanho",
      prompt: "Uma doença tem R₀ = {R0}. Que fração mínima da população precisa estar imune para haver imunidade de rebanho? (responda como fração, de 0 a 1)",
      vary: { R0: [1.5, 15, 1] },
      answer: { label: "fração imune", unit: "", compute: (p) => 1 - 1 / num(p, "R0") },
      hint: "A transmissão cai quando R₀·S < 1.",
    },
    {
      id: "pico",
      prompt: "No modelo SIR, com R₀ = {R0} e quase toda a população suscetível no início, que fração da população estará infectada no pico?",
      vary: { R0: [1.5, 6, 1] },
      answer: { label: "I_max", unit: "", compute: (p) => sirPeak(num(p, "R0")) },
      hint: "Divida dI/dS = −1 + 1/(R₀S) e integre: I + S − ln(S)/R₀ é constante. O pico é em S = 1/R₀.",
    },
  ],

  init: initState,
  step: (s, p) => step(s, p),
  dt: 0.1,
  tEnd: 300,
  sampleEvery: 5,
  maxSamples: 700,

  pointer: {
    down: (s, _p, pt) => infectAt(s, (pt.x - SQ.x0) / SQ.L, (pt.y - SQ.y0) / SQ.L),
    cursor: (_s, _p, pt) => (pt.x > SQ.x0 && pt.x < SQ.x0 + SQ.L && pt.y > SQ.y0 && pt.y < SQ.y0 + SQ.L ? "crosshair" : undefined),
  },

  viewport: () => ({ xMin: 0, xMax: 16, yMin: 0, yMax: 9 }),

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const { state: s, params: p, theme } = frame;
    const N = s.st.length;
    const col = [theme.series[0]!, theme.series[5]!, theme.positive, theme.series[2]!, theme.series[4]!];
    d.rect(SQ.x0, SQ.y0, SQ.L, SQ.L, { stroke: theme.text, width: 2 });
    const rc = contactRadius(N) * SQ.L;
    for (let i = 0; i < N; i++) {
      const st = s.st[i]!;
      const x = SQ.x0 + s.x[i]! * SQ.L, y = SQ.y0 + s.y[i]! * SQ.L;
      if (st === I_) d.circle(x, y, rc, { fill: theme.positive, alpha: 0.1 });
      d.dot(x, y, st === I_ ? 3.5 : 2.8, col[st] ?? theme.muted);
    }
    d.text(`${N} agentes · raio de contágio r_c = ${fmt(contactRadius(N))} L (halo)`, SQ.x0, SQ.y0 + SQ.L + 0.3, { size: 10, color: theme.muted, align: "left" });
    d.text(`dia ${fmt(s.t, 3)} · clique num agente para infectá-lo`, SQ.x0, SQ.y0 - 0.35, { size: 10, color: theme.muted, align: "left" });

    // curvas
    const tMax = Math.max(60, Math.ceil(s.t / 30) * 30);
    const X = (t: number) => CH.x0 + (t / tMax) * (CH.x1 - CH.x0);
    const Y = (f: number) => CH.y0 + f * (CH.y1 - CH.y0);
    d.line(CH.x0, CH.y0, CH.x1, CH.y0, { color: theme.muted });
    d.line(CH.x0, CH.y0, CH.x0, CH.y1, { color: theme.muted });
    for (const f of [0.25, 0.5, 0.75, 1]) {
      d.line(CH.x0, Y(f), CH.x1, Y(f), { color: theme.grid, width: 1 });
      d.text(`${f * 100}%`, CH.x0 - 0.08, Y(f), { size: 8, color: theme.muted, align: "right" });
    }
    d.text(`t (dias, até ${tMax})`, CH.x1, CH.y0 - 0.25, { size: 9, color: theme.muted, align: "right" });
    const hp = herd(p);
    if (hp > 0) {
      d.line(CH.x0, Y(1 / (R0(p) * (1 - dist(p)))), CH.x1, Y(1 / (R0(p) * (1 - dist(p)))), { color: theme.series[0]!, dash: [3, 4], width: 1 });
      d.text("S = 1/R₀: pico", CH.x1, Y(1 / (R0(p) * (1 - dist(p)))), { size: 8, color: theme.series[0]!, align: "right", dy: -6 });
    }
    const series: [number, number, string][] = [[1, 4, col[0]!], [2, 5, col[2]!], [3, 6, col[3]!]];
    for (const [ia, io, c] of series) {
      d.polyline(s.hist.map((h): [number, number] => [X(h[0]!), Y(h[io]!)]), { color: c, width: 2.2 });
      for (let j = 0; j < s.hist.length; j += 3) d.dot(X(s.hist[j]![0]!), Y(s.hist[j]![ia]!), 1.6, c, 0.7);
    }
    d.text("linhas: EDO · pontos: agentes", CH.x0, CH.y1 + 0.3, { size: 10, color: theme.muted, align: "left" });

    // legenda e números
    const c = counts(s);
    const labels: [string, number, number][] = [
      ["S suscetíveis", S_, s.ode[0]!],
      ["E expostos", E_, s.ode[1]!],
      ["I infectados", I_, s.ode[2]!],
      ["R recuperados", R_, s.ode[3]!],
      ["V vacinados", V_, s.ode[4]!],
    ];
    labels
      .filter(([, k]) => k !== E_ || isSEIR(p))
      .forEach(([l, k, o], i) => {
        d.dot(9.2, 3.0 - i * 0.45, 4, col[k]!);
        d.text(`${l}: ${pct(N ? c[k]! / N : 0)} (EDO ${pct(o)})`, 9.45, 3.0 - i * 0.45, { size: 10.5, align: "left" });
      });
    d.text(`R_ef = ${fmt(Reff(s, p))}   ·   rebanho: ${pct(hp)}   ·   final previsto: ${pct(finalSize(s, p))}`, 9.1, 0.55, { size: 10.5, weight: "600", align: "left" });
  },
});

export default epidemiaSir;
