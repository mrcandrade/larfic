import { defineSim, draw, num, rng, texNum, type Draw, type Params, type Theme } from "@fisilab/core";
import { fmt, panel } from "./panel.ts";
import { coherent, fringe, incoherent, momentum, sampleHit, visibility, wavelength, wavelengthClassic, type Slits } from "./physics.ts";

export * from "./physics.ts";

/** Meia largura da tela (µm). */
export const W_UM = 60;
export const NB = 240;
const MAX_HITS = 2500;
const FLIGHT = 0.35;

export interface Hit {
  y: number;
  z: number;
  slit: number;
}

export interface DBState {
  n: number;
  acc: number;
  /** Histograma de chegadas na tela (NB faixas em ±W). */
  hist: number[];
  hits: Hit[];
  /** Último elétron em voo (para a animação). */
  last: (Hit & { age: number }) | null;
}

export const slitsOf = (p: Params): Slits => ({
  lambda: wavelength(num(p, "V", 50) * 1e3),
  d: num(p, "d", 1.5) * 1e-6,
  a: num(p, "a", 0.3) * 1e-6,
  L: num(p, "L", 1),
  single: Math.round(num(p, "arranjo")) === 1,
});
const detecting = (p: Params) => Math.round(num(p, "detector")) === 1 && Math.round(num(p, "arranjo")) === 0;
const dyUm = (p: Params) => fringe(slitsOf(p)) * 1e6;

/** Densidade normalizada (por µm) na tela para os parâmetros atuais. */
export function density(p: Params): (yUm: number) => number {
  const s = slitsOf(p);
  const f = detecting(p) ? (y: number) => incoherent(y * 1e-6, s) : (y: number) => coherent(y * 1e-6, s);
  const n = 4000;
  const h = (2 * W_UM) / n;
  let tot = f(-W_UM) + f(W_UM);
  for (let i = 1; i < n; i++) tot += f(-W_UM + i * h) * (i % 2 ? 4 : 2);
  tot *= h / 3;
  return (y) => f(y) / tot;
}

/** Dispara um elétron: sorteia a fenda (se há detector) e a posição de chegada segundo |ψ|². */
export function fire(s: DBState, p: Params): DBState {
  const rand = rng(424_242 + s.n * 7919);
  const sl = slitsOf(p);
  const slit = detecting(p) ? (rand() < 0.5 ? 0 : 1) : -1;
  const y = sampleHit(rand, sl, W_UM * 1e-6, slit) * 1e6;
  const z = 2 * rand() - 1;
  const hist = s.hist.slice();
  const i = Math.max(0, Math.min(NB - 1, Math.floor(((y + W_UM) / (2 * W_UM)) * NB)));
  hist[i] = (hist[i] ?? 0) + 1;
  const hit = { y, z, slit };
  const hits = s.hits.length >= MAX_HITS ? [...s.hits.slice(1), hit] : [...s.hits, hit];
  return { ...s, n: s.n + 1, hist, hits, last: { ...hit, age: 0 } };
}

export const deBroglie = defineSim<DBState>({
  id: "de-broglie",
  title: "Elétrons um a um na fenda dupla",
  course: "FG IV",
  topic: "Ondas de matéria",
  priority: "P1",
  summary:
    "Elétrons acelerados por uma tensão V têm comprimento de onda λ = h/p. Disparados um a um contra uma fenda dupla, cada um chega num ponto, mas o acúmulo desenha franjas, que somem quando se detecta por qual fenda cada elétron passou.",
  equations: [
    String.raw`\lambda = \frac{h}{p} \qquad p = \sqrt{2m_e eV\left(1 + \frac{eV}{2m_ec^2}\right)}`,
    String.raw`|\psi(y)|^2 \propto \operatorname{sinc}^2\!\left(\frac{\pi a y}{\lambda L}\right)\cos^2\!\left(\frac{\pi d y}{\lambda L}\right) \qquad \Delta y = \frac{\lambda L}{d}`,
    String.raw`\text{com detector: } P(y) = \tfrac12\left(|\psi_1|^2 + |\psi_2|^2\right)`,
  ],
  liveEquations(s, p) {
    const V = num(p, "V", 50) * 1e3;
    return [
      String.raw`\lambda = \frac{h}{p} = \frac{6{,}626\times10^{-34}}{${texNum(momentum(V))}} = ${texNum(wavelength(V) * 1e12)}\ \text{pm} \quad (\text{não relativístico: } ${texNum(wavelengthClassic(V) * 1e12)}\ \text{pm})`,
      String.raw`\Delta y = \frac{\lambda L}{d} = ${texNum(dyUm(p))}\ \mu\text{m} \qquad N = ${s.n}`,
    ];
  },

  params: [
    {
      key: "arranjo",
      label: "Anteparo",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 0,
      options: [
        { value: 0, label: "Fenda dupla" },
        { value: 1, label: "Fenda única" },
      ],
    },
    {
      key: "detector",
      label: "Detector de caminho nas fendas",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 0,
      options: [
        { value: 0, label: "Desligado" },
        { value: 1, label: "Ligado (registra a fenda)" },
      ],
    },
    { key: "V", label: "Tensão de aceleração", unit: "kV", min: 2, max: 100, step: 0.5, default: 50 },
    { key: "d", label: "Separação entre fendas d", unit: "µm", min: 0.5, max: 4, step: 0.05, default: 1.5 },
    { key: "a", label: "Largura de cada fenda a", unit: "µm", min: 0.1, max: 1, step: 0.01, default: 0.3 },
    { key: "L", label: "Distância até a tela L", unit: "m", min: 0.2, max: 2, step: 0.05, default: 1 },
    { key: "taxa", label: "Elétrons por segundo", unit: "1/s", min: 1, max: 2000, step: 1, default: 40, log: true, live: true },
  ],

  observables: [
    { key: "N", label: "Elétrons detectados", unit: "", value: (s) => s.n },
    { key: "lambda", label: "Comprimento de onda λ", unit: "pm", value: (_s, p) => wavelength(num(p, "V", 50) * 1e3) * 1e12 },
    { key: "dy", label: "Espaçamento Δy previsto", unit: "µm", value: (_s, p) => dyUm(p) },
    { key: "vis", label: "Visibilidade das franjas (medida)", unit: "", value: (s, p) => visibility(s.hist, W_UM, dyUm(p)) },
  ],
  chart: { x: "N", y: "vis" },

  scenarios: [
    {
      id: "um-a-um",
      label: "Um elétron de cada vez",
      params: { arranjo: 0, detector: 0, V: 50, d: 1.5, a: 0.3, L: 1, taxa: 5 },
      guide: `### Partícula ou onda?
1. Com 5 elétrons por segundo, cada elétron aparece como um ponto em algum lugar da tela. Não há como prever onde.
2. Aumente a taxa (ou use **Disparar 1000**). O acúmulo desenha franjas: o histograma converge para $|\\psi|^2$ (curva).
3. Os elétrons passam um de cada vez: cada um "interfere consigo mesmo".`,
      predict: [
        {
          question: "Os elétrons atravessam um de cada vez. Depois de muitos, o que se vê na tela?",
          options: ["duas faixas, uma atrás de cada fenda", "franjas de interferência", "uma mancha uniforme"],
          answer: 1,
          explanation:
            "Cada elétron é descrito por uma onda que passa pelas duas fendas. A probabilidade de chegada é $|\\psi_1 + \\psi_2|^2$, com franjas, mesmo que os elétrons cheguem um a um.",
        },
      ],
    },
    {
      id: "lambda",
      label: "λ depende da tensão",
      params: { arranjo: 0, detector: 0, V: 10, d: 1.5, a: 0.3, L: 1, taxa: 500 },
      guide: `### Medindo λ pelas franjas
1. Meça o espaçamento das franjas no histograma e calcule $\\lambda = \\Delta y\\, d / L$.
2. Compare com $\\lambda = h/p$ para $V = 10\\ \\text{kV}$ (12,2 pm).
3. Aumente $V$ para 40 kV: as franjas ficam mais próximas, pois $\\lambda \\propto 1/\\sqrt{V}$ (quase).
4. A 100 kV a correção relativística passa de 2%; compare os dois valores nas equações vivas.`,
      predict: [
        {
          question: "Se a tensão de aceleração quadruplicar, o espaçamento das franjas:",
          options: ["quadruplica", "cai pela metade", "cai a um quarto", "não muda"],
          answer: 1,
          explanation: "$p \\propto \\sqrt{V}$ (sem relatividade), então $\\lambda = h/p$ cai pela metade, e $\\Delta y = \\lambda L/d$ também.",
        },
      ],
    },
    {
      id: "detector",
      label: "Saber por qual fenda",
      params: { arranjo: 0, detector: 1, V: 50, d: 1.5, a: 0.3, L: 1, taxa: 500 },
      guide: `### Medir destrói a interferência
1. O detector registra a fenda de cada elétron (cores diferentes). Agora $P(y) = \\tfrac12(|\\psi_1|^2 + |\\psi_2|^2)$.
2. Acumule alguns milhares de elétrons e compare a visibilidade medida com a do cenário sem detector.
3. Repare que a curva só tem o envelope de difração de uma fenda.`,
    },
  ],

  exercises: [
    {
      id: "lambda",
      prompt: "Qual é o comprimento de onda de de Broglie de um elétron acelerado por {V} kV? Inclua a correção relativística.",
      vary: { V: [2, 100, 0] },
      answer: { label: "λ", unit: "pm", compute: (p) => wavelength(num(p, "V") * 1e3) * 1e12 },
      hint: "p = √(2mₑeV(1 + eV/2mₑc²)) e λ = h/p.",
    },
    {
      id: "franjas",
      prompt: "Elétrons de {V} kV passam por duas fendas separadas de {d} µm. Qual é o espaçamento das franjas numa tela a {L} m?",
      vary: { V: [5, 80, 0], d: [0.5, 4, 1], L: [0.3, 2, 1] },
      answer: { label: "Δy", unit: "µm", compute: (p) => dyUm(p) },
      hint: "Δy = λL/d, com λ = h/p.",
    },
  ],

  init: () => ({ n: 0, acc: 0, hist: new Array<number>(NB).fill(0), hits: [], last: null }),
  step(s, p, _t, dt) {
    let acc = s.acc + num(p, "taxa", 40) * dt;
    let out: DBState = s.last ? { ...s, last: { ...s.last, age: s.last.age + dt } } : s;
    let k = 0;
    while (acc >= 1 && k < 200) {
      out = fire(out, p);
      acc -= 1;
      k++;
    }
    return { ...out, acc };
  },
  dt: 0.02,
  sampleEvery: 10,
  maxSamples: 300,

  actions: [
    {
      id: "mil",
      label: "Disparar 1000 elétrons",
      run(s, p) {
        let out = s;
        for (let i = 0; i < 1000; i++) out = fire(out, p);
        return out;
      },
    },
    { id: "limpar", label: "Limpar tela", run: () => ({ n: 0, acc: 0, hist: new Array<number>(NB).fill(0), hits: [], last: null }) },
  ],

  viewport: () => ({ xMin: 0, xMax: 20, yMin: 0, yMax: 12 }),

  render(ctx, frame) {
    const d = draw(ctx, frame);
    renderApparatus(d, frame.theme, frame.state, frame.params);
    renderScreen(d, frame.theme, frame.state, frame.params);
  },
});

const slitColor = (theme: Theme, slit: number) => (slit === 0 ? theme.series[1]! : slit === 1 ? theme.series[2]! : theme.accent);

function renderApparatus(d: Draw, theme: Theme, s: DBState, p: Params) {
  const yc = 9.75;
  const xs = 6;
  const xt = 12;
  const single = Math.round(num(p, "arranjo")) === 1;
  // Canhão
  d.rect(0.3, yc - 0.45, 1.5, 0.9, { fill: theme.grid, stroke: theme.text, width: 1.2 });
  d.text("canhão", 1.05, yc - 0.75, { size: 10, color: theme.muted });
  d.text(`${fmt(num(p, "V", 50))} kV`, 1.05, yc, { size: 10, weight: "600" });
  // Anteparo com fendas (fora de escala)
  const gaps = single ? [yc] : [yc + 0.55, yc - 0.55];
  const segs: [number, number][] = [[7.7, 11.8]];
  const cut = (y0: number, y1: number) => {
    const out: [number, number][] = [];
    for (const [a, b] of segs.splice(0)) {
      if (y1 <= a || y0 >= b) out.push([a, b]);
      else {
        if (y0 > a) out.push([a, y0]);
        if (y1 < b) out.push([y1, b]);
      }
    }
    segs.push(...out);
  };
  for (const g of gaps) cut(g - 0.12, g + 0.12);
  for (const [a, b] of segs) d.line(xs, a, xs, b, { color: theme.text, width: 4 });
  d.text(single ? "fenda única" : "fenda dupla", xs, 7.4, { size: 10, color: theme.muted });
  // Tela
  d.line(xt, 7.7, xt, 11.8, { color: theme.text, width: 3 });
  d.text("tela", xt, 7.4, { size: 10, color: theme.muted });
  // Detector
  if (detecting(p)) {
    d.circle(xs + 0.9, 11.4, 0.25, { fill: theme.positive, alpha: 0.8 });
    d.text("detector ligado", xs + 1.3, 11.4, { align: "left", size: 10, color: theme.positive });
  }
  // Pontos recentes na tela (vista lateral)
  const toScreen = (yUm: number) => yc + (yUm / W_UM) * 2;
  for (const h of s.hits.slice(-60)) d.dot(xt + 0.12, toScreen(h.y), 1.6, slitColor(theme, h.slit), 0.6);
  // Elétron em voo
  const L = s.last;
  if (L && L.age < FLIGHT) {
    const f = L.age / FLIGHT;
    const g = L.slit >= 0 ? gaps[L.slit] ?? yc : yc;
    const x = 1.8 + f * (xt - 1.8);
    const y = x < xs ? yc + ((g - yc) * (x - 1.8)) / (xs - 1.8) : g + ((toScreen(L.y) - g) * (x - xs)) / (xt - xs);
    d.dot(x, y, 4, slitColor(theme, L.slit));
    if (L.slit < 0) {
      // A onda passa pelas duas fendas: frentes de onda depois do anteparo
      for (const gy of gaps)
        for (let r = 0.4; r < 1.6; r += 0.4) d.circle(xs, gy, r, { stroke: theme.accent, width: 1, alpha: 0.25 });
    }
  }
  // Painel de leitura
  const sl = slitsOf(p);
  const V = num(p, "V", 50) * 1e3;
  const rows = [
    `λ = h/p = ${fmt(sl.lambda * 1e12)} pm`,
    `p = ${fmt(momentum(V))} kg·m/s`,
    `Δy = λL/d = ${fmt(dyUm(p))} µm`,
    `N = ${s.n} elétrons`,
    `visibilidade medida: ${fmt(visibility(s.hist, W_UM, dyUm(p)), 2)}`,
  ];
  rows.forEach((r, i) => d.text(r, 13.0, 11.5 - i * 0.6, { align: "left", size: 12, weight: i === 0 ? "600" : "400" }));
  d.text("(anteparo fora de escala)", 13.0, 11.5 - rows.length * 0.6, { align: "left", size: 10, color: theme.muted });
}

function renderScreen(d: Draw, theme: Theme, s: DBState, p: Params) {
  // Face da tela: cada elétron é um ponto
  const face = panel(d, { x0: 0.8, y0: 4.4, x1: 19.4, y1: 6.7 }, { min: -W_UM, max: W_UM }, { min: -1, max: 1 });
  d.rect(0.8, 4.4, 18.6, 2.3, { fill: theme.dark ? "rgba(0,0,0,0.35)" : "rgba(20,30,50,0.06)", stroke: theme.muted, width: 1 });
  for (const h of s.hits) d.dot(face.X(h.y), face.Y(h.z * 0.95), 1.3, slitColor(theme, h.slit), 0.8);
  d.text("tela vista de frente", 0.8, 6.7, { align: "left", size: 10, color: theme.muted, dy: -8 });
  if (detecting(p)) {
    d.text("■ fenda de cima", 12.6, 6.7, { align: "left", size: 10, color: slitColor(theme, 0), dy: -8 });
    d.text("■ fenda de baixo", 16.0, 6.7, { align: "left", size: 10, color: slitColor(theme, 1), dy: -8 });
  }
  // Histograma e previsão |ψ|²
  const binW = (2 * W_UM) / NB;
  const f = density(p);
  const expectedMax = Math.max(1, s.n) * binW * f(0) * 1.02;
  const peak = Math.max(...s.hist, 1);
  const P = panel(d, { x0: 0.8, y0: 0.8, x1: 19.4, y1: 3.6 }, { min: -W_UM, max: W_UM }, { min: 0, max: Math.max(peak, s.n > 0 ? expectedMax : 1) * 1.1 });
  P.frame({ xlabel: "y (µm)", ylabel: "contagens por faixa" });
  s.hist.forEach((c, i) => {
    if (c <= 0) return;
    const x0 = P.X(-W_UM + i * binW);
    d.rect(x0, P.box.y0, P.X(-W_UM + (i + 1) * binW) - x0, P.Y(c) - P.box.y0, { fill: theme.accent, alpha: 0.55 });
  });
  if (s.n > 0) P.plot((y) => s.n * binW * f(y), -W_UM, W_UM, { color: theme.positive, width: 1.8, n: 600 });
  d.text("curva: N·|ψ|²·Δ (previsão)", 19.4, 3.6, { align: "right", size: 10, color: theme.positive, dy: -8 });
}

export default deBroglie;
