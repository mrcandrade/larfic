import { defineSim, draw, formatBR, num, texNum, type Draw, type Params } from "@fisilab/core";
import {
  FH,
  FW,
  GH,
  GW,
  KB,
  NBINS,
  RGAS,
  XBINS,
  crossSection,
  dElementary,
  dStokes,
  dTheory,
  diam,
  enskog,
  fRightTheory,
  fitBrownD,
  fitGasD,
  fractionRight,
  initState,
  lambda0,
  lambdaMeasured,
  massA,
  massB,
  nGas,
  packing,
  profileTheory,
  radius,
  step,
  temperatureOf,
  vMean2D,
  viscosity,
  type DBState,
} from "./engine.ts";

export * from "./engine.ts";

const fmt = (v: number, d = 3) => formatBR(v, d);
const Tof = (p: Params) => num(p, "T", 300);

/** Grandezas do gás que dependem do estado e dos parâmetros. */
export function gasInfo(s: DBState, p: Params) {
  const n = nGas(s);
  const d = diam(p);
  const eta = packing(n, d);
  const l0 = lambda0(n, d);
  return { n, d, eta, l0, lE: l0 / enskog(eta), lm: lambdaMeasured(s), z: s.tp > 0 ? (2 * s.nColl) / (s.x.length * s.tp) : 0 };
}

/** Constante de Boltzmann e número de Avogadro "medidos" pelo D ajustado (como Perrin). */
export function perrin(s: DBState, p: Params) {
  const D = fitBrownD(s) * 1e-12; // m²/s
  const k = D > 0 ? (6 * Math.PI * viscosity(p) * radius(p) * D) / Tof(p) : 0;
  return { k, NA: k > 0 ? RGAS / k : 0 };
}

const GASES = [
  { value: 4, label: "Hélio (4 u)" },
  { value: 20, label: "Neônio (20 u)" },
  { value: 40, label: "Argônio (40 u)" },
  { value: 131, label: "Xenônio (131 u)" },
];

export const difusaoBrowniano = defineSim<DBState>({
  id: "difusao-browniano",
  title: "Difusão, livre caminho médio e movimento browniano",
  course: "FG II",
  topic: "Teoria cinética",
  priority: "P2",
  summary:
    "Gás de discos duros em que o livre caminho médio é medido e comparado com λ = 1/(√2 nσ), interdifusão de duas espécies a partir de uma partição com ajuste do coeficiente D, e partículas brownianas cujo ⟨x²⟩ = 2Dt leva à relação de Einstein–Stokes e ao número de Avogadro.",
  equations: [
    String.raw`\lambda = \frac{1}{\sqrt2\, n\, \sigma} \qquad \sigma_{2D} = 2d,\ \ \sigma_{3D} = \pi d^2 \qquad z = \frac{\bar v}{\lambda}`,
    String.raw`\frac{\partial c}{\partial t} = D\,\frac{\partial^2 c}{\partial x^2} \qquad D \approx \tfrac12 \lambda \bar v \ \ (2D)`,
    String.raw`\langle x^2 \rangle = 2 D t \qquad \langle r^2 \rangle = 4 D t \ \ (\text{no plano})`,
    String.raw`\text{Einstein–Stokes: } D = \frac{k T}{6 \pi \eta a} \qquad N_A = \frac{R}{k}`,
  ],
  liveEquations(s, p) {
    if (s.mode === 2) {
      const Df = fitBrownD(s);
      const pe = perrin(s, p);
      return [
        String.raw`D_{\text{ES}} = \frac{kT}{6\pi\eta a} = \frac{${texNum(KB)} \cdot ${texNum(Tof(p))}}{6\pi \cdot ${texNum(viscosity(p))} \cdot ${texNum(radius(p))}} = ${texNum(dStokes(p))}\ \mu\text{m}^2/\text{s}`,
        String.raw`\text{ajuste de } \langle r^2\rangle = 4Dt:\ D = ${texNum(Df)}\ \mu\text{m}^2/\text{s}`,
        String.raw`k = \frac{6\pi\eta a D}{T} = ${texNum(pe.k)}\ \text{J/K} \qquad N_A = \frac{R}{k} = ${texNum(pe.NA)}\ \text{mol}^{-1}`,
      ];
    }
    const g = gasInfo(s, p);
    const out = [
      String.raw`n = ${texNum(g.n)}\ \text{nm}^{-2} \qquad \lambda = \frac{1}{\sqrt2\, n \cdot 2d} = ${texNum(g.l0)}\ \text{nm} \qquad \lambda_{\text{Enskog}} = \frac{\lambda}{g(\eta)} = ${texNum(g.lE)}\ \text{nm}`,
      String.raw`\lambda_{\text{medido}} = ${texNum(g.lm)}\ \text{nm} \qquad z = ${texNum(g.z)}\ \text{ps}^{-1} \qquad \eta = ${texNum(g.eta)}`,
    ];
    if (s.mode === 1) {
      const T = Tof(p);
      out.push(
        String.raw`D_{\text{ajuste}} = ${texNum(fitGasD(s))}\ \text{nm}^2/\text{ps} \qquad D_{\text{Chapman–Enskog}} = ${texNum(dTheory(g.n, g.d, T, massA(p), massB(p)))}\ \text{nm}^2/\text{ps} = ${texNum(dTheory(g.n, g.d, T, massA(p), massB(p)) * 1e-6)}\ \text{m}^2/\text{s}`,
      );
    }
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
        { value: 0, label: "Livre caminho médio" },
        { value: 1, label: "Difusão a partir de uma partição" },
        { value: 2, label: "Movimento browniano" },
      ],
    },
    { key: "N", label: "Número de moléculas", unit: "", min: 50, max: 500, step: 10, default: 200 },
    { key: "d", label: "Diâmetro molecular d", unit: "nm", min: 0.2, max: 1.2, step: 0.05, default: 0.6 },
    { key: "massa", label: "Gás (espécie A)", unit: "u", min: 4, max: 131, step: 1, default: 40, options: GASES },
    { key: "massaB", label: "Gás da espécie B", unit: "u", min: 4, max: 131, step: 1, default: 40, options: GASES },
    { key: "T", label: "Temperatura", unit: "K", min: 100, max: 1000, step: 10, default: 300 },
    { key: "a", label: "Raio da partícula browniana", unit: "µm", min: 0.1, max: 2, step: 0.05, default: 0.5 },
    {
      key: "eta",
      label: "Líquido",
      unit: "mPa·s",
      min: 0.5,
      max: 10,
      step: 0.01,
      default: 1.0,
      options: [
        { value: 1.0, label: "Água a 20 °C (1,0 mPa·s)" },
        { value: 0.69, label: "Água a 37 °C (0,69 mPa·s)" },
        { value: 1.2, label: "Etanol (1,2 mPa·s)" },
        { value: 6.0, label: "Água com 50% de glicerina (6,0 mPa·s)" },
      ],
    },
    { key: "seed", label: "Semente", unit: "", min: 1, max: 999, step: 1, default: 1 },
  ],

  observables: [
    { key: "tf", label: "Tempo físico do gás", unit: "ps", value: (s) => s.tp },
    { key: "lam", label: "Livre caminho médio medido", unit: "nm", value: (s) => lambdaMeasured(s) },
    { key: "lam0", label: "λ = 1/(√2 n σ), gás rarefeito", unit: "nm", value: (s, p) => (s.mode === 2 ? 0 : gasInfo(s, p).l0) },
    { key: "lamE", label: "λ com correção de Enskog", unit: "nm", value: (s, p) => (s.mode === 2 ? 0 : gasInfo(s, p).lE) },
    { key: "z", label: "Frequência de colisões por molécula", unit: "1/ps", value: (s, p) => (s.mode === 2 ? 0 : gasInfo(s, p).z) },
    { key: "ncol", label: "Colisões contadas", unit: "", value: (s) => s.nColl },
    { key: "Tg", label: "Temperatura do gás", unit: "K", value: (s, p) => temperatureOf(s, p) },
    { key: "fR", label: "Fração de A na metade direita", unit: "", value: (s) => (s.mode === 1 ? fractionRight(s) : 0) },
    { key: "Dfit", label: "D ajustado (gás)", unit: "nm²/ps", value: (s) => (s.mode === 1 ? fitGasD(s) : 0) },
    { key: "Dce", label: "D de Chapman–Enskog (gás)", unit: "nm²/ps", value: (s, p) => (s.mode === 1 ? dTheory(nGas(s), diam(p), Tof(p), massA(p), massB(p)) : 0) },
    { key: "tb", label: "Tempo (browniano)", unit: "s", value: (s) => s.tb },
    { key: "msd", label: "Deslocamento quadrático médio ⟨r²⟩", unit: "µm²", value: (s) => (s.mode === 2 ? (s.hist[s.hist.length - 1]![1]! + s.hist[s.hist.length - 1]![2]!) : 0) },
    { key: "Db", label: "D ajustado (browniano)", unit: "µm²/s", value: (s) => (s.mode === 2 ? fitBrownD(s) : 0) },
    { key: "Des", label: "D de Einstein–Stokes", unit: "µm²/s", value: (_s, p) => dStokes(p) },
    { key: "NA", label: "Número de Avogadro estimado", unit: "10²³/mol", value: (s, p) => (s.mode === 2 ? perrin(s, p).NA / 1e23 : 0) },
  ],
  chart: { x: "tf", y: "lam" },

  scenarios: [
    {
      id: "caminho",
      label: "Livre caminho médio",
      params: { modo: 0, N: 200, d: 0.6 },
      guide: `### Quanto uma molécula anda entre colisões
1. A molécula preta é rastreada: os pontos marcam as suas colisões, e os segmentos entre eles são os **livres caminhos**.
2. O histograma reúne os livres caminhos de todas as moléculas. Ele é exponencial, $P(\\ell) = e^{-\\ell/\\lambda}/\\lambda$: colisões são aleatórias e sem memória.
3. Compare $\\lambda$ medido com $\\lambda = 1/(\\sqrt2\\, n\\sigma)$. Em 2D a "seção de choque" é a largura da faixa varrida, $\\sigma = 2d$. O $\\sqrt2$ vem da velocidade **relativa** média, $\\bar v_{\\text{rel}} = \\sqrt2\\,\\bar v$.
4. Dobre $d$ ou $N$ e veja $\\lambda$ cair à metade.`,
      predict: [
        {
          question: "Dobrando o número de moléculas na mesma caixa, o livre caminho médio:",
          options: ["dobra", "não muda", "cai à metade", "cai a um quarto"],
          answer: 2,
          explanation: "$\\lambda = 1/(\\sqrt2\\,n\\sigma)$: com o dobro da densidade há o dobro de alvos na faixa varrida, e a molécula colide duas vezes mais cedo.",
        },
      ],
    },
    {
      id: "denso",
      label: "Gás denso: correção de Enskog",
      params: { modo: 0, N: 450, d: 1.1 },
      guide: `### Quando o gás deixa de ser rarefeito
1. Agora os discos ocupam cerca de 20% da área ($\\eta$ nas equações). O $\\lambda$ medido fica **menor** que $1/(\\sqrt2\\,n\\sigma)$.
2. Com moléculas grandes, os centros não podem se aproximar menos que $d$, e a chance de encontrar um vizinho em contato aumenta pelo fator de Enskog $g(\\eta) = (1 - 7\\eta/16)/(1-\\eta)^2$.
3. Confira que $\\lambda_{\\text{Enskog}} = \\lambda/g(\\eta)$ concorda com a medida.`,
    },
    {
      id: "difusao",
      label: "Difusão de duas espécies",
      params: { modo: 1, N: 300, d: 0.6, massa: 40, massaB: 40 },
      guide: `### Da partição ao equilíbrio
1. A partição foi retirada em $t = 0$: A (azul) à esquerda, B (laranja) à direita. As moléculas não "sabem" para onde ir: cada uma faz um passeio aleatório entre colisões.
2. O perfil de concentração (barras) segue a solução da equação de difusão, $c(x,t)$, que se alarga como $\\sqrt{Dt}$.
3. O gráfico à direita mostra a fração de A na metade direita. O programa **ajusta** $D$ a esses pontos e compara com a teoria cinética (Chapman–Enskog) e com a estimativa $\\tfrac12\\lambda\\bar v$.
4. Troque B por hélio (4 u): moléculas leves são rápidas e a interdifusão acelera. $D$ depende da massa reduzida $\\mu$.`,
      predict: [
        {
          question: "Com o dobro da densidade de moléculas (mesmo T), a mistura completa demora:",
          options: ["metade do tempo", "o mesmo tempo", "o dobro do tempo"],
          answer: 2,
          explanation: "$D \\propto \\lambda\\bar v \\propto 1/n$: com o dobro da densidade, cada molécula avança metade entre colisões e o tempo de mistura $\\sim L^2/D$ dobra.",
        },
      ],
    },
    {
      id: "browniano",
      label: "Movimento browniano e Einstein–Stokes",
      params: { modo: 2, a: 0.5, eta: 1.0, T: 300 },
      guide: `### O que Perrin via no microscópio
1. Esferas de 0,5 µm em água, em **tempo real**. Elas tremem porque recebem choques desequilibrados das moléculas de água, que não vemos.
2. O deslocamento de cada esfera é um passeio aleatório. O desvio quadrático médio cresce **linearmente**: $\\langle r^2\\rangle = 4Dt$, não como $t^2$.
3. O programa ajusta a reta a $\\langle r^2\\rangle(t)$. Compare o $D$ ajustado com Einstein–Stokes, $D = kT/6\\pi\\eta a$.
4. Com o $D$ medido, $k = 6\\pi\\eta a D/T$ e $N_A = R/k$: foi assim que Perrin mediu o número de Avogadro (Nobel de 1926).
5. O histograma de $x$ é gaussiano, com variância $2Dt$.`,
      predict: [
        {
          question: "Dobrando o raio das esferas brownianas (mesmo líquido e temperatura), o coeficiente de difusão:",
          options: ["dobra", "cai à metade", "cai a um quarto", "não muda"],
          answer: 1,
          explanation: "Pela lei de Stokes o atrito é $6\\pi\\eta a$, proporcional ao raio. Com $D = kT/6\\pi\\eta a$, o dobro do raio dá metade de $D$.",
        },
      ],
    },
  ],

  exercises: [
    {
      id: "lambda3d",
      prompt:
        "Um gás com moléculas de diâmetro {dm} nm está a {Tx} K e {Pk} kPa. Usando λ = kT/(√2 π d² P), qual é o livre caminho médio?",
      vary: { dm: [0.25, 0.4, 2], Tx: [250, 400, 0], Pk: [10, 200, 0] },
      answer: { label: "λ", unit: "nm", compute: (p) => ((KB * num(p, "Tx")) / (Math.SQRT2 * Math.PI * (num(p, "dm") * 1e-9) ** 2 * num(p, "Pk") * 1e3)) * 1e9 },
      hint: "n = P/kT e σ = πd² em 3D.",
    },
    {
      id: "browniano",
      prompt:
        "Uma esfera de raio {ax} µm está em água (η = 1,0 mPa·s) a {Tx} K. Qual é o deslocamento quadrático médio numa direção, √⟨x²⟩, depois de {tx} s?",
      vary: { ax: [0.2, 2, 1], Tx: [280, 320, 0], tx: [1, 60, 0] },
      answer: {
        label: "√⟨x²⟩",
        unit: "µm",
        compute: (p) => Math.sqrt((2 * KB * num(p, "Tx") * num(p, "tx")) / (6 * Math.PI * 1e-3 * num(p, "ax") * 1e-6)) * 1e6,
      },
      hint: "D = kT/(6πηa) e ⟨x²⟩ = 2Dt.",
    },
  ],

  init: initState,
  step: (s, p) => step(s, p),
  dt: 0.02,
  sampleEvery: 2,
  maxSamples: 600,

  narrowSplit: () => 0.555,
  viewport: () => ({ xMin: 0, xMax: 16, yMin: 0, yMax: 9 }),

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const { state: s, params: p } = frame;
    if (s.mode === 2) renderBrown(d, s, p, frame.trail);
    else renderGas(d, s, p, frame.trail);
  },
});

// ---------- desenho ----------
const BOX = { x0: 0.4, y0: 3.6, sc: 8 / GW }; // 60 × 36 nm → 8 × 4,8
const LOW = { x0: 0.9, x1: 8.4, y0: 0.6, y1: 2.6 };
const RP = { x0: 10.0, x1: 15.6, y0: 4.6, y1: 8.2 };

function panelAxes(d: Draw, B: { x0: number; x1: number; y0: number; y1: number }, xl: string, yl: string) {
  const { theme } = d;
  d.line(B.x0, B.y0, B.x1, B.y0, { color: theme.muted });
  d.line(B.x0, B.y0, B.x0, B.y1, { color: theme.muted });
  d.text(xl, B.x1, B.y0 - 0.5, { size: 10, color: theme.muted, align: "right" });
  d.text(yl, B.x0, B.y1 + 0.25, { size: 10, color: theme.muted, align: "left" });
}

function renderGas(d: Draw, s: DBState, p: Params, trail: DBState[]) {
  const { theme } = d;
  const g = gasInfo(s, p);
  const X = (x: number) => BOX.x0 + x * BOX.sc;
  const Y = (y: number) => BOX.y0 + y * BOX.sc;
  d.rect(X(0), Y(0), GW * BOX.sc, GH * BOX.sc, { fill: theme.accent, alpha: 0.04, stroke: theme.text, width: 2.5 });
  if (s.mode === 1) d.line(X(GW / 2), Y(0), X(GW / 2), Y(GH), { color: theme.muted, dash: [4, 5], width: 1 });
  const r = (g.d / 2) * BOX.sc;
  for (let i = 1; i < s.x.length; i++) {
    const col = s.mode === 1 ? (s.sp[i] ? theme.series[1]! : theme.series[0]!) : theme.accent;
    d.circle(X(s.x[i]!), Y(s.y[i]!), r, { fill: col, minPx: 2.2, alpha: 0.85 });
  }
  // Molécula rastreada: livres caminhos entre colisões
  if (s.mode === 0) {
    const pts = trail
      .slice(-250)
      .filter((q) => q.mode === 0 && q.x.length)
      .map((q): [number, number] => [X(q.x[0]!), Y(q.y[0]!)])
      .concat([[X(s.x[0]!), Y(s.y[0]!)]]);
    d.polyline(pts, { color: theme.text, width: 1.2, alpha: 0.6 });
    s.tag.forEach(([a, b]) => d.dot(X(a), Y(b), 2.5, theme.positive));
  }
  d.circle(X(s.x[0]!), Y(s.y[0]!), r, { fill: theme.text, minPx: 4 });
  d.arrowPx(X(s.x[0]!), Y(s.y[0]!), s.vx[0]!, s.vy[0]!, 18, { color: theme.positive });
  d.text(`t = ${fmt(s.tp)} ps   ·   N = ${s.x.length}   ·   caixa ${GW} nm × ${GH} nm   ·   T = ${fmt(temperatureOf(s, p))} K`, BOX.x0, 8.75, { size: 10, color: theme.muted, align: "left" });

  if (s.mode === 0) {
    // Histograma dos livres caminhos (fração por nm) e P(ℓ) = e^(−ℓ/λ)/λ
    const bw = (4 * g.l0) / NBINS;
    const total = s.fhist.reduce((a, b) => a + b, 0);
    const lm = g.lm > 0 ? g.lm : g.lE;
    const top = 1.25 / Math.min(lm, g.lE);
    const XL = (l: number) => RP.x0 + (l / (4 * g.l0)) * (RP.x1 - RP.x0);
    const YL = (f: number) => RP.y0 + Math.min(1.1, f / top) * (RP.y1 - RP.y0);
    panelAxes(d, RP, "livre caminho ℓ (nm)", "fração por nm");
    if (total > 0) s.fhist.forEach((h, b) => d.rect(XL(b * bw) + 0.02, RP.y0, XL(bw) - RP.x0 - 0.04, YL(h / (total * bw)) - RP.y0, { fill: theme.accent, alpha: 0.5 }));
    d.plot((x) => YL(Math.exp(-((x - RP.x0) / (RP.x1 - RP.x0)) * 4 * g.l0 / g.lE) / g.lE), RP.x0, RP.x1, { color: theme.positive, width: 2.5 });
    for (const f of [0, 1, 2, 3, 4]) d.text(fmt(f * g.l0, 2), XL(f * g.l0), RP.y0 - 0.22, { size: 9, color: theme.muted });
    d.line(XL(g.lm), RP.y0, XL(g.lm), RP.y1, { color: theme.text, dash: [4, 3], width: 1.2 });
    d.text("λ medido", XL(g.lm), RP.y1 + 0.05, { size: 9, align: "left", dx: 3 });
    d.text("e^(−ℓ/λ)/λ", RP.x1, RP.y1 - 0.3, { size: 10, color: theme.positive, align: "right" });

    const rows = [
      `λ medido = ${fmt(g.lm)} nm   (${s.nPaths} livres caminhos)`,
      `λ = 1/(√2 n σ), σ = 2d: ${fmt(g.l0)} nm`,
      `λ com Enskog (η = ${fmt(g.eta, 2)}): ${fmt(g.lE)} nm`,
      `v̄ = ${fmt(vMean2D(Tof(p), massA(p)) * 1000)} m/s   z = ${fmt(g.z)} colisões/ps`,
      `σ = ${fmt(crossSection(g.d))} nm (faixa varrida de largura 2d)`,
    ];
    rows.forEach((t, i) => d.text(t, RP.x0 - 0.6, 3.6 - i * 0.55, { size: 11, align: "left", weight: i === 0 ? "700" : "400" }));
    // Legenda
    d.dot(LOW.x0, 2.8, 2.5, theme.positive);
    d.text("colisões da molécula rastreada (preta); entre elas, livres caminhos", LOW.x0 + 0.2, 2.8, { size: 10, align: "left", color: theme.muted });
    // Faixa de colisão: desenho esquemático do cilindro (faixa) varrido
    const cx = 1.2, cy = 1.5;
    d.rect(cx, cy - 0.5, 5.6, 1.0, { fill: theme.positive, alpha: 0.1 });
    d.line(cx, cy - 0.5, cx + 5.6, cy - 0.5, { color: theme.positive, dash: [4, 3], width: 1 });
    d.line(cx, cy + 0.5, cx + 5.6, cy + 0.5, { color: theme.positive, dash: [4, 3], width: 1 });
    d.circle(cx + 0.25, cy, 0.25, { fill: theme.text });
    d.arrow(cx + 0.55, cy, 4.8, 0, { color: theme.text, width: 1.5 });
    d.circle(cx + 3.3, cy + 0.42, 0.25, { fill: theme.accent });
    d.circle(cx + 4.4, cy - 0.85, 0.25, { fill: theme.accent, alpha: 0.5 });
    d.text("σ = 2d", cx + 5.9, cy, { size: 10, align: "left", color: theme.positive });
    d.text("acerta quem tem o centro na faixa de largura 2d; a outra passa", cx, cy - 0.85, { size: 9, align: "left", color: theme.muted });
    return;
  }

  // ---------- difusão ----------
  const t = s.tp;
  const T = Tof(p);
  const Dce = dTheory(g.n, g.d, T, massA(p), massB(p));
  const Dfit = fitGasD(s);
  // Perfil de A medido em faixas e teoria
  const nb = 12;
  const counts = new Array<number>(nb).fill(0), tot = new Array<number>(nb).fill(0);
  for (let i = 0; i < s.x.length; i++) {
    const b = Math.min(nb - 1, Math.floor((s.x[i]! / GW) * nb));
    tot[b] = tot[b]! + 1;
    if (!s.sp[i]) counts[b] = counts[b]! + 1;
  }
  panelAxes(d, LOW, "x (nm)", "fração de A");
  const XP = (x: number) => LOW.x0 + (x / GW) * (LOW.x1 - LOW.x0);
  const YP = (c: number) => LOW.y0 + c * (LOW.y1 - LOW.y0);
  for (let b = 0; b < nb; b++) {
    const c = tot[b]! ? counts[b]! / tot[b]! : 0;
    d.rect(XP((b * GW) / nb) + 0.03, LOW.y0, XP(GW / nb) - LOW.x0 - 0.06, YP(c) - LOW.y0, { fill: theme.series[0]!, alpha: 0.45 });
  }
  if (Dfit > 0) d.plot((xx) => YP(profileTheory(Dfit, t, ((xx - LOW.x0) / (LOW.x1 - LOW.x0)) * GW)), LOW.x0, LOW.x1, { color: theme.positive, width: 2.5 });
  d.plot((xx) => YP(profileTheory(Dce, t, ((xx - LOW.x0) / (LOW.x1 - LOW.x0)) * GW)), LOW.x0, LOW.x1, { color: theme.muted, width: 1.5, dash: [5, 4] });
  for (const x of [0, 30, 60]) d.text(String(x), XP(x), LOW.y0 - 0.22, { size: 9, color: theme.muted });
  d.text("1", LOW.x0 - 0.1, YP(1), { size: 9, color: theme.muted, align: "right" });

  // Fração de A à direita × t
  const tMax = Math.max(50, t * 1.05, 2.5 * (GW * GW) / (Math.PI * Math.PI * Dce));
  const XT = (tt: number) => RP.x0 + (tt / tMax) * (RP.x1 - RP.x0);
  const YT = (f: number) => RP.y0 + (f / 0.6) * (RP.y1 - RP.y0);
  panelAxes(d, RP, "t (ps)", "fração de A na direita");
  d.line(RP.x0, YT(0.5), RP.x1, YT(0.5), { color: theme.grid, width: 1 });
  d.text("0,5", RP.x0 - 0.1, YT(0.5), { size: 9, color: theme.muted, align: "right" });
  d.text(fmt(tMax, 2), RP.x1, RP.y0 - 0.22, { size: 9, color: theme.muted });
  s.hist.forEach(([tt, f]) => d.dot(XT(tt!), YT(f!), 2, theme.series[0]!));
  if (Dfit > 0) d.plot((xx) => YT(fRightTheory(Dfit, ((xx - RP.x0) / (RP.x1 - RP.x0)) * tMax)), RP.x0, RP.x1, { color: theme.positive, width: 2.5 });
  d.plot((xx) => YT(fRightTheory(Dce, ((xx - RP.x0) / (RP.x1 - RP.x0)) * tMax)), RP.x0, RP.x1, { color: theme.muted, width: 1.5, dash: [5, 4] });
  const rows = [
    `D ajustado = ${fmt(Dfit)} nm²/ps = ${fmt(Dfit * 1e-6)} m²/s`,
    `Chapman–Enskog: ${fmt(Dce)} nm²/ps (tracejado)`,
    `estimativa ½ λ v̄ = ${fmt(dElementary(g.n, g.d, T, massA(p)))} nm²/ps`,
    `largura da frente √(2Dt) = ${fmt(Math.sqrt(2 * Math.max(Dfit, 0) * t))} nm`,
  ];
  rows.forEach((tx, i) => d.text(tx, RP.x0 - 0.6, 3.6 - i * 0.55, { size: 11, align: "left", weight: i === 0 ? "700" : "400" }));
  d.text("linha cheia: ajuste; tracejada: teoria", RP.x0 - 0.6, 3.6 - 4 * 0.55, { size: 10, align: "left", color: theme.muted });
}

function renderBrown(d: Draw, s: DBState, p: Params, trail: DBState[]) {
  const { theme } = d;
  const sc = 8 / FW;
  const X = (x: number) => BOX.x0 + x * sc;
  const Y = (y: number) => BOX.y0 + y * sc;
  const wrap = (v: number, L: number) => ((v % L) + L) % L;
  d.rect(X(0), Y(0), FW * sc, FH * sc, { fill: theme.dark ? "rgba(91,156,240,0.07)" : "rgba(47,125,225,0.05)", stroke: theme.text, width: 2 });
  const a = num(p, "a", 0.5);
  for (let i = 1; i < s.bx.length; i++) d.circle(X(wrap(s.px[i]! + s.bx[i]!, FW)), Y(wrap(s.py[i]! + s.by[i]!, FH)), a * sc, { fill: theme.series[1]!, minPx: 2, alpha: 0.75 });
  // Trajetória da partícula 0 (desenhada a partir do ponto de partida, sem dobrar nas bordas)
  const tr = trail.filter((q) => q.mode === 2 && q.bx.length).map((q): [number, number] => [q.bx[0]!, q.by[0]!]).concat([[s.bx[0]!, s.by[0]!]]);
  const ox = Math.min(FW - 4, Math.max(4, s.px[0]!)), oy = Math.min(FH - 4, Math.max(4, s.py[0]!));
  d.polyline(tr.map(([u, v]): [number, number] => [X(wrap(ox + u, FW)), Y(wrap(oy + v, FH))]), { color: theme.text, width: 1.2, alpha: 0.7 });
  d.circle(X(wrap(ox + s.bx[0]!, FW)), Y(wrap(oy + s.by[0]!, FH)), a * sc, { fill: theme.text, minPx: 3.5 });
  // Escala
  d.line(X(1), Y(-1.2), X(6), Y(-1.2), { width: 2 });
  d.text("5 µm", X(3.5), Y(-1.2), { size: 10, dy: 9 });
  d.text(`t = ${fmt(s.tb)} s (tempo real)   ·   ${s.bx.length} esferas de raio ${fmt(a)} µm`, BOX.x0, 8.75, { size: 10, color: theme.muted, align: "left" });

  // ⟨r²⟩ × t com ajuste e Einstein–Stokes
  const Des = dStokes(p);
  const Df = fitBrownD(s);
  const tMax = Math.max(5, s.tb * 1.05);
  const rMax = 4 * Math.max(Des, Df) * tMax * 1.2;
  const XT = (t: number) => RP.x0 + (t / tMax) * (RP.x1 - RP.x0);
  const YT = (v: number) => RP.y0 + Math.min(1.1, v / rMax) * (RP.y1 - RP.y0);
  panelAxes(d, RP, "t (s)", "⟨r²⟩ (µm²)");
  d.text(fmt(tMax, 2), RP.x1, RP.y0 - 0.22, { size: 9, color: theme.muted });
  d.text(fmt(rMax, 2), RP.x0 - 0.1, YT(rMax), { size: 9, color: theme.muted, align: "right" });
  s.hist.forEach(([t, mx, my]) => d.dot(XT(t!), YT(mx! + my!), 2.2, theme.series[1]!));
  d.line(XT(0), YT(0), XT(tMax), YT(4 * Des * tMax), { color: theme.muted, width: 1.5, dash: [5, 4] });
  if (Df > 0) d.line(XT(0), YT(0), XT(tMax), YT(4 * Df * tMax), { color: theme.positive, width: 2.5 });
  d.text("ajuste 4Dt", RP.x1, YT(4 * Df * tMax), { size: 10, color: theme.positive, align: "right", dy: -9 });
  d.text("Einstein–Stokes", RP.x1, YT(4 * Des * tMax), { size: 10, color: theme.muted, align: "right", dy: 10 });

  // Histograma dos deslocamentos em x com a gaussiana de variância 2Dt
  const sd = Math.sqrt(2 * Des * Math.max(s.tb, 1e-6));
  const xr = 4 * sd;
  const bins = new Array<number>(XBINS).fill(0);
  for (let i = 0; i < s.bx.length; i++) {
    const b = Math.floor(((s.bx[i]! + xr) / (2 * xr)) * XBINS);
    if (b >= 0 && b < XBINS) bins[b] = bins[b]! + 1;
  }
  const bw = (2 * xr) / XBINS;
  const peak = 1 / (Math.sqrt(2 * Math.PI) * sd);
  const XH = (x: number) => LOW.x0 + ((x + xr) / (2 * xr)) * (LOW.x1 - LOW.x0);
  const YH = (f: number) => LOW.y0 + Math.min(1.15, f / (1.3 * peak)) * (LOW.y1 - LOW.y0);
  panelAxes(d, LOW, "deslocamento x (µm)", "fração por µm");
  if (s.tb > 0) {
    bins.forEach((c, b) => d.rect(XH(-xr + b * bw) + 0.02, LOW.y0, XH(-xr + bw) - LOW.x0 - 0.04, YH(c / (s.bx.length * bw)) - LOW.y0, { fill: theme.series[1]!, alpha: 0.5 }));
    d.plot((xx) => YH(peak * Math.exp(-(((((xx - LOW.x0) / (LOW.x1 - LOW.x0)) * 2 - 1) * xr) ** 2) / (2 * sd * sd))), LOW.x0, LOW.x1, { color: theme.positive, width: 2.5 });
    for (const f of [-4, -2, 0, 2, 4]) d.text(fmt((f * sd) / 1, 2), XH(f * sd), LOW.y0 - 0.22, { size: 9, color: theme.muted });
  }
  const pe = perrin(s, p);
  const rows = [
    `D ajustado = ${fmt(Df)} µm²/s`,
    `Einstein–Stokes: kT/(6πηa) = ${fmt(Des)} µm²/s`,
    `k estimado = ${fmt(pe.k)} J/K`,
    `N_A estimado = ${fmt(pe.NA)} /mol (real: 6,022 × 10^23)`,
  ];
  rows.forEach((tx, i) => d.text(tx, RP.x0 - 0.6, 3.6 - i * 0.55, { size: 11, align: "left", weight: i === 0 ? "700" : "400" }));
  d.text("gaussiana: variância 2Dt (Einstein–Stokes)", RP.x0 - 0.6, 3.6 - 4 * 0.55, { size: 10, align: "left", color: theme.muted });
}

export default difusaoBrowniano;
