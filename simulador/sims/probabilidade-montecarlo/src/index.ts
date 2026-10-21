import { defineSim, draw, formatBR, num, texNum, type Draw, type Params } from "@fisilab/core";
import {
  RING,
  addSamples,
  binom,
  buffonP,
  ellD,
  estimate,
  galtonStats,
  initState,
  msdTheory,
  normalPdf,
  pRight,
  rnd,
  sigmaBuffon,
  sigmaPiMC,
  step,
  walkStats,
  walkStep,
  type PState,
} from "./engine.ts";

export * from "./engine.ts";

const fmt = (v: number, d = 3) => formatBR(v, d);
const PANEL = { x0: 10.0, x1: 15.6, y0: 4.6, y1: 8.4 };

export const probabilidadeMontecarlo = defineSim<PState>({
  id: "probabilidade-montecarlo",
  title: "Probabilidade: tábua de Galton, π por Monte Carlo e caminhada aleatória",
  course: "FG II",
  topic: "Física estatística",
  priority: "P2",
  summary:
    "Experimentos aleatórios com previsão exata: a tábua de Galton gera a binomial (e a normal), pontos e agulhas de Buffon estimam π com erro que cai como 1/√N, e caminhantes aleatórios mostram ⟨x²⟩ ∝ N — a assinatura da difusão.",
  equations: [
    String.raw`P(k) = \binom{n}{k} p^k (1-p)^{n-k} \;\xrightarrow{\,n \gg 1\,}\; \frac{1}{\sqrt{2\pi\sigma^2}}e^{-(k-np)^2/2\sigma^2},\quad \sigma^2 = np(1-p)`,
    String.raw`\hat\pi = 4\,\frac{N_{\text{dentro}}}{N} \qquad \sigma_{\hat\pi} = \sqrt{\frac{\pi(4-\pi)}{N}} \propto \frac{1}{\sqrt N}`,
    String.raw`\text{Buffon } (\ell \le d):\ P = \frac{2\ell}{\pi d} \;\Rightarrow\; \hat\pi = \frac{2\ell N}{d\,N_{\text{cruza}}}`,
    String.raw`\text{caminhada: } \langle x \rangle = N(2p-1),\ \ \langle x^2\rangle - \langle x\rangle^2 = 4Np(1-p) \qquad \text{2D: } \langle r^2 \rangle = N\ell^2`,
  ],
  liveEquations(s, p) {
    const e = estimate(s, p);
    const pr = pRight(p);
    switch (s.mode) {
      case 0: {
        const g = galtonStats(s);
        return [
          String.raw`\bar k = ${texNum(g.mean, 4)} \quad (np = ${texNum(s.rows * pr, 4)}) \qquad s^2 = ${texNum(g.v, 4)} \quad (np(1-p) = ${texNum(s.rows * pr * (1 - pr), 4)})`,
          String.raw`N = ${s.landed}\ \text{bolas} \qquad \sigma_{\bar k} = \sqrt{np(1-p)/N} = ${texNum(e.sig)}`,
        ];
      }
      case 1:
      case 2:
        return [
          s.mode === 1
            ? String.raw`\hat\pi = 4\cdot\frac{${s.nIn}}{${s.nTot}} = ${texNum(e.est, 6)}`
            : String.raw`\hat\pi = \frac{2\cdot${texNum(ellD(p))}\cdot${s.nTot}}{${s.nIn}} = ${texNum(e.est, 6)}`,
          String.raw`|\hat\pi - \pi| = ${texNum(Math.abs(e.est - Math.PI))} \qquad \sigma_{\hat\pi} = ${texNum(e.sig)}`,
        ];
      default: {
        const w = walkStats(s);
        return [
          String.raw`N = ${s.steps}\ \text{passos} \qquad \langle ${s.mode === 3 ? "x" : "r"}^2\rangle = ${texNum(w.msd, 4)} \quad (\text{teoria } ${texNum(e.teo, 4)})`,
          s.mode === 3
            ? String.raw`\langle x\rangle = ${texNum(w.mean, 3)}\ (${texNum(s.steps * (2 * pr - 1), 3)}) \qquad \sigma_x = ${texNum(Math.sqrt(w.v), 3)}\ (\sqrt{4Np(1-p)} = ${texNum(Math.sqrt(4 * s.steps * pr * (1 - pr)), 3)})`
            : String.raw`r_{\text{rms}} = ${texNum(Math.sqrt(w.msd), 3)} \qquad \sqrt N = ${texNum(Math.sqrt(s.steps), 3)}`,
        ];
      }
    }
  },

  params: [
    {
      key: "modo",
      label: "Experimento",
      unit: "",
      min: 0,
      max: 4,
      step: 1,
      default: 0,
      options: [
        { value: 0, label: "Tábua de Galton (binomial → normal)" },
        { value: 1, label: "π por Monte Carlo (pontos no quadrado)" },
        { value: 2, label: "π pela agulha de Buffon" },
        { value: 3, label: "Caminhada aleatória 1D" },
        { value: 4, label: "Caminhada aleatória 2D" },
      ],
    },
    { key: "linhas", label: "Galton: linhas de pinos n", unit: "", min: 2, max: 24, step: 1, default: 12 },
    { key: "p", label: "Probabilidade de ir para a direita p", unit: "", min: 0, max: 1, step: 0.01, default: 0.5, live: true },
    { key: "taxa", label: "Ritmo (bolas, pontos ou passos)", unit: "", min: 1, max: 100, step: 1, default: 5, live: true, log: true },
    { key: "ell", label: "Buffon: comprimento da agulha ℓ/d", unit: "", min: 0.1, max: 1, step: 0.05, default: 0.8 },
    { key: "M", label: "Caminhada: número de caminhantes", unit: "", min: 10, max: 1000, step: 10, default: 300 },
    { key: "seed", label: "Semente", unit: "", min: 1, max: 999, step: 1, default: 1 },
  ],

  observables: [
    { key: "n", label: "Amostras (bolas, pontos, agulhas ou passos)", unit: "", value: (s, p) => estimate(s, p).n },
    { key: "est", label: "Estimativa (k̄, π̂ ou ⟨x²⟩)", unit: "", value: (s, p) => estimate(s, p).est },
    { key: "teo", label: "Valor teórico", unit: "", value: (s, p) => estimate(s, p).teo },
    { key: "rel", label: "Razão estimativa/teoria", unit: "", value: (s, p) => ((e) => (e.teo ? e.est / e.teo : 0))(estimate(s, p)) },
    { key: "err", label: "Erro |estimativa − teoria|", unit: "", value: (s, p) => ((e) => Math.abs(e.est - e.teo))(estimate(s, p)) },
    { key: "sig", label: "Desvio padrão esperado da estimativa", unit: "", value: (s, p) => estimate(s, p).sig },
    { key: "var", label: "Variância medida (Galton e caminhada)", unit: "", value: (s) => (s.mode === 0 ? galtonStats(s).v : s.mode >= 3 ? walkStats(s).v : 0) },
    { key: "frac", label: "Fração de acertos (dentro / cruzando)", unit: "", value: (s) => (s.nTot ? s.nIn / s.nTot : 0) },
  ],
  chart: { x: "n", y: "rel" },

  scenarios: [
    {
      id: "galton",
      label: "Tábua de Galton",
      params: { modo: 0, linhas: 12, p: 0.5, taxa: 10 },
      guide: `### Do acaso nasce a curva normal
1. Cada bola encontra 12 pinos e, em cada um, vai para a direita com probabilidade $p = 1/2$. A caixa final é o número $k$ de desvios à direita.
2. Antes de rodar: qual caixa recebe mais bolas? Quantas maneiras há de chegar à caixa $k$? (Triângulo de Pascal: $\\binom{12}{k}$.)
3. Rode e use **Soltar 1000 bolas**. Compare as barras com a binomial (pontos) e com a normal de média $np = 6$ e variância $np(1-p) = 3$ (curva).
4. Mude $p$ para 0,7 (pinos inclinados): a distribuição se desloca para $np = 8{,}4$ e estreita ($\\sigma^2 = 2{,}52$).
5. O erro da média medida $\\bar k$ cai como $1/\\sqrt N$: com 4 vezes mais bolas, metade do erro.`,
      predict: [
        {
          question: "Numa tábua com 12 linhas e p = 1/2, a caixa central (k = 6) recebe aproximadamente que fração das bolas?",
          options: ["Metade", "Cerca de 23%", "1/13, como as demais"],
          answer: 1,
          explanation: "P(6) = C(12,6)/2¹² = 924/4096 ≈ 0,226. A caixa central é a mais provável, mas a maioria das bolas cai fora dela.",
        },
      ],
    },
    {
      id: "pi",
      label: "π por Monte Carlo e o erro 1/√N",
      params: { modo: 1, taxa: 20 },
      guide: `### Estimar π jogando pontos ao acaso
1. Pontos uniformes no quadrado de lado 2; a fração dentro do círculo de raio 1 tende a $\\pi/4$.
2. Acompanhe $\\hat\\pi$ e o gráfico log-log do erro: os pontos seguem a faixa $\\sigma = \\sqrt{\\pi(4-\\pi)/N}$, uma reta de inclinação $-1/2$.
3. Use **+10 000 amostras** algumas vezes. Para ganhar **uma casa decimal** é preciso 100 vezes mais pontos.
4. O método vale para qualquer área ou integral (em muitas dimensões, é o único viável): é assim que se simulam blindagens de radiação, detectores e gases.`,
      predict: [
        {
          question: "Com 1000 pontos o erro típico de π̂ é ≈ 0,05. Quantos pontos são necessários para um erro típico de ≈ 0,005?",
          options: ["10 000", "100 000", "1 000 000"],
          answer: 1,
          explanation: "σ ∝ 1/√N: dividir o erro por 10 exige 10² = 100 vezes mais pontos, isto é, 100 000.",
        },
      ],
    },
    {
      id: "buffon",
      label: "Agulha de Buffon",
      params: { modo: 2, ell: 0.8, taxa: 10 },
      guide: `### π caindo do céu
1. Agulhas de comprimento $\\ell = 0{,}8\\,d$ caem ao acaso sobre retas paralelas espaçadas de $d$. As vermelhas cruzam uma reta.
2. A probabilidade de cruzar é $P = 2\\ell/(\\pi d) \\approx 0{,}51$: o $\\pi$ aparece porque o ângulo é uniforme.
3. Compare o erro com o do método dos pontos (mude o experimento): para o mesmo $N$, qual converge mais rápido? Veja $\\sigma_{\\hat\\pi}$.
4. Diminua $\\ell$ para 0,2: menos agulhas cruzam e o erro estatístico aumenta.`,
    },
    {
      id: "caminhada",
      label: "Caminhada aleatória e difusão",
      params: { modo: 3, M: 400, p: 0.5, taxa: 10 },
      guide: `### O bêbado e a difusão
1. 400 caminhantes partem de $x = 0$ e dão passos $\\pm 1$ ao acaso. As linhas mostram 8 deles.
2. Em média ninguém sai do lugar: $\\langle x \\rangle \\approx 0$. Mas o espalhamento cresce: $\\langle x^2 \\rangle = N$, ou seja, $x_{\\text{rms}} = \\sqrt N$ (curvas tracejadas).
3. O gráfico de $\\langle x^2 \\rangle \\times N$ é uma **reta**: é a lei da difusão, $\\langle x^2\\rangle = 2Dt$ (Einstein, 1905, movimento browniano).
4. Ponha $p = 0{,}6$ (deriva): $\\langle x\\rangle = 0{,}2N$ e $\\langle x^2\\rangle$ passa a crescer como $N^2$.
5. Troque para **caminhada 2D**: a nuvem cresce como um círculo de raio $\\sqrt N$.`,
      predict: [
        {
          question: "Depois de 100 passos aleatórios de 1 m, a distância típica (rms) do ponto de partida é:",
          options: ["0 m", "10 m", "50 m", "100 m"],
          answer: 1,
          explanation: "⟨x²⟩ = N ℓ², então x_rms = √100 · 1 m = 10 m. Para ir 10 vezes mais longe são necessários 100 vezes mais passos.",
        },
      ],
    },
  ],

  exercises: [
    {
      id: "galton",
      prompt: "Numa tábua de Galton com {linhas} linhas, cada bola desvia para a direita com probabilidade {p}. Qual a probabilidade de uma bola cair na caixa k = {k} (k desvios à direita)?",
      vary: { linhas: [8, 16, 0], p: [0.3, 0.7, 2], k: [3, 7, 0] },
      fixed: { modo: 0 },
      answer: { label: "P(k)", unit: "", compute: (p) => binom(Math.round(num(p, "linhas")), Math.round(num(p, "k")), num(p, "p")) },
      hint: "P(k) = C(n, k) pᵏ (1 − p)ⁿ⁻ᵏ.",
    },
    {
      id: "pontos",
      prompt: "Quantos pontos aleatórios são necessários para que o desvio padrão da estimativa π̂ = 4N_dentro/N seja {e}?",
      vary: { e: [0.002, 0.03, 3] },
      fixed: { modo: 1 },
      answer: { label: "N", unit: "", compute: (p) => (Math.PI * (4 - Math.PI)) / num(p, "e") ** 2 },
      tolerance: 0.05,
      hint: "Cada ponto é um sorteio de Bernoulli com P = π/4: Var(π̂) = 16 P(1 − P)/N = π(4 − π)/N.",
    },
  ],

  init: initState,
  step: (s, p) => step(s, p),
  dt: 0.05,
  sampleEvery: 2,
  maxSamples: 600,

  actions: [
    {
      id: "lote",
      label: "Lote grande (1000 bolas, 10 000 amostras ou 100 passos)",
      run: (s0, p) => {
        const s: PState = structuredClone(s0);
        if (s.mode === 0) {
          const pr = pRight(p);
          for (let b = 0; b < 1000; b++) {
            let k = 0;
            for (let r = 0; r < s.rows; r++) if (rnd(s) < pr) k++;
            s.bins[k] = s.bins[k]! + 1;
            s.landed++;
          }
        } else if (s.mode <= 2) addSamples(s, p, 10000);
        else for (let i = 0; i < 100; i++) walkStep(s, pRight(p));
        return s;
      },
    },
  ],

  viewport: () => ({ xMin: 0, xMax: 16, yMin: 0, yMax: 9 }),

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const s = frame.state;
    if (s.mode === 0) renderGalton(d, s, frame.params);
    else if (s.mode <= 2) renderPi(d, s, frame.params);
    else renderWalk(d, s, frame.params);
  },
});

// ---------- Galton ----------
function renderGalton(d: Draw, s: PState, p: Params) {
  const { theme } = d;
  const n = s.rows;
  const pr = pRight(p);
  const cx = 4.6, top = 8.5, bot = 3.4;
  const dy = (top - bot) / (n + 1);
  const dx = Math.min(0.62, 8.4 / (n + 1));
  const X = (r: number, k: number) => cx + (k - r / 2) * dx;
  const Y = (r: number) => top - (r + 0.5) * dy;
  for (let r = 0; r < n; r++) for (let k = 0; k <= r; k++) d.dot(X(r, k), Y(r), 2.5, theme.muted);
  for (const b of s.fly) {
    if (b.ph < 0) continue;
    const r = b.r;
    const xPrev = r > 0 ? X(r - 1, b.k - b.last) : cx;
    const xNow = r > 0 ? X(r, b.k) : cx;
    const f = Math.min(1, b.ph * 2);
    const yy = top - (r + b.ph) * dy + (r > 0 ? 0.25 * dy * Math.sin(Math.PI * f) : 0);
    d.dot(xPrev + (xNow - xPrev) * f, Math.min(top, yy), 3.5, theme.series[1]!);
  }
  // histograma das caixas
  const y0 = 0.6, y1 = 3.2;
  const N = s.landed;
  let peak = 1e-9;
  for (let k = 0; k <= n; k++) peak = Math.max(peak, binom(n, k, pr), N ? s.bins[k]! / N : 0);
  const H = (f: number) => (f / (peak * 1.08)) * (y1 - y0);
  const xb = (k: number) => cx + (k - n / 2) * dx;
  d.line(xb(0) - dx / 2, y0, xb(n) + dx / 2, y0, { color: theme.muted });
  for (let k = 0; k <= n; k++) {
    d.line(xb(k) - dx / 2, y0, xb(k) - dx / 2, y1, { color: theme.grid, width: 1 });
    if (N) d.rect(xb(k) - dx * 0.42, y0, dx * 0.84, H(s.bins[k]! / N), { fill: theme.accent, alpha: 0.7 });
    d.dot(xb(k), y0 + H(binom(n, k, pr)), 3, theme.positive);
    if (n <= 16 || k % 2 === 0) d.text(String(k), xb(k), y0 - 0.22, { size: 9, color: theme.muted });
  }
  const mu = n * pr, s2 = n * pr * (1 - pr);
  if (s2 > 0) {
    const pts: [number, number][] = [];
    for (let i = 0; i <= 160; i++) {
      const k = -0.5 + ((n + 1) * i) / 160;
      pts.push([xb(k), y0 + H(normalPdf(k, mu, s2))]);
    }
    d.polyline(pts, { color: theme.series[2]!, width: 2 });
  }
  const g = galtonStats(s);
  const e = estimate(s, p);
  const lines: [string, string][] = [
    [`bolas na base: ${N}   (no ar: ${s.fly.length})`, theme.text],
    [`média k̄ = ${fmt(g.mean, 4)}   (np = ${fmt(mu, 4)})`, theme.text],
    [`variância s² = ${fmt(g.v, 4)}   (np(1−p) = ${fmt(s2, 4)})`, theme.text],
    [`erro esperado de k̄: ${fmt(e.sig)}`, theme.muted],
    [`• binomial  C(n,k)pᵏ(1−p)ⁿ⁻ᵏ`, theme.positive],
    [`— normal N(np, np(1−p))`, theme.series[2]!],
    [`barras: frequência medida`, theme.accent],
  ];
  lines.forEach(([l, c], i) => d.text(l, 9.8, 8.3 - i * 0.6, { size: 11, align: "left", color: c, weight: i === 1 ? "600" : "400" }));
}

// ---------- π ----------
function renderPi(d: Draw, s: PState, p: Params) {
  const { theme } = d;
  const n = Math.min(s.head, RING);
  if (s.mode === 1) {
    const c = 4.5, R = 4;
    d.rect(c - R, 4.5 - R, 2 * R, 2 * R, { stroke: theme.text, width: 2 });
    d.circle(c, 4.5, R, { stroke: theme.text, width: 2 });
    for (let i = 0; i < n; i++) {
      const hit = s.ring[4 * i + 3] === 1;
      d.dot(c + R * s.ring[4 * i]!, 4.5 + R * s.ring[4 * i + 1]!, 1.6, hit ? theme.accent : theme.series[1]!, 0.8);
    }
  } else {
    const l = ellD(p);
    const S = 8 / 8; // 1 unidade = d
    for (let y = 0; y <= 8; y++) d.line(0.5, 0.5 + y * S, 8.5, 0.5 + y * S, { color: theme.muted, width: 1.5 });
    const m = Math.min(n, 400);
    for (let j = 0; j < m; j++) {
      const i = (s.head - 1 - j + RING * 10) % RING;
      const x = 0.5 + s.ring[4 * i]!, y = 0.5 + s.ring[4 * i + 1]!, th = s.ring[4 * i + 2]!;
      const hx = (l / 2) * Math.cos(th), hy = (l / 2) * Math.sin(th);
      d.line(x - hx, y - hy, x + hx, y + hy, { color: s.ring[4 * i + 3] === 1 ? theme.positive : theme.accent, width: 1.5, alpha: 0.8 });
    }
    d.text(`ℓ = ${fmt(l)} d   ·   P(cruzar) = 2ℓ/(πd) = ${fmt(buffonP(l))}`, 4.5, 8.75, { size: 10, color: theme.muted });
  }
  // gráfico log-log do erro
  const e = estimate(s, p);
  const P = PANEL;
  const lx0 = 1, lx1 = 7, ly0 = -5, ly1 = 0;
  const X = (N: number) => P.x0 + ((Math.log10(N) - lx0) / (lx1 - lx0)) * (P.x1 - P.x0);
  const Y = (er: number) => P.y0 + ((Math.max(ly0, Math.log10(Math.max(er, 1e-9))) - ly0) / (ly1 - ly0)) * (P.y1 - P.y0);
  d.rect(P.x0, P.y0, P.x1 - P.x0, P.y1 - P.y0, { stroke: theme.muted, width: 1 });
  for (let k = lx0; k <= lx1; k++) d.text(`10^${k}`, X(10 ** k), P.y0 - 0.22, { size: 8, color: theme.muted });
  for (let k = ly0; k <= ly1; k++) d.text(`10^${k}`, P.x0 - 0.1, Y(10 ** k), { size: 8, color: theme.muted, align: "right" });
  d.text("N", P.x1, P.y0 - 0.5, { size: 10, color: theme.muted, align: "right" });
  d.text("|π̂ − π|", P.x0, P.y1 + 0.25, { size: 10, color: theme.muted, align: "left" });
  const sigF = (N: number) => (s.mode === 1 ? sigmaPiMC(N) : sigmaBuffon(N, ellD(p)));
  const band: [number, number][] = [];
  for (let k = lx0; k <= lx1; k += 0.1) band.push([X(10 ** k), Y(sigF(10 ** k))]);
  d.polyline(band, { color: theme.positive, width: 2, dash: [5, 4] });
  for (const [N, er] of s.hist) if (N >= 10) d.dot(X(N), Y(er), 2.5, theme.accent);
  d.text("— σ ∝ 1/√N", P.x1, P.y1 + 0.25, { size: 10, color: theme.positive, align: "right" });
  const lines = [
    `N = ${s.nTot}   ${s.mode === 1 ? "dentro" : "cruzam"}: ${s.nIn}`,
    `π̂ = ${fmt(e.est, 7)}`,
    `π = 3,141593`,
    `erro = ${fmt(Math.abs(e.est - Math.PI))}   σ esperado = ${fmt(e.sig)}`,
  ];
  lines.forEach((l, i) => d.text(l, 9.4, 3.3 - i * 0.6, { size: 11, align: "left", weight: i === 1 ? "600" : "400" }));
}

// ---------- caminhada ----------
function renderWalk(d: Draw, s: PState, p: Params) {
  const { theme } = d;
  const pr = s.mode === 4 ? 0.5 : pRight(p);
  const N = s.steps;
  const e = estimate(s, p);
  if (s.mode === 3) {
    // trajetórias x(n)
    const x0 = 0.6, x1 = 9.0, y0 = 3.6, y1 = 8.6, yc = (y0 + y1) / 2;
    const nMax = Math.max(50, Math.min(1500, N));
    const xr = Math.max(8, 3 * Math.sqrt(nMax), Math.abs(nMax * (2 * pr - 1)) * 1.1);
    const X = (n: number) => x0 + (n / nMax) * (x1 - x0);
    const Y = (x: number) => yc + (x / xr) * ((y1 - y0) / 2);
    d.line(x0, yc, x1, yc, { color: theme.muted, width: 1 });
    d.line(x0, y0, x0, y1, { color: theme.muted, width: 1 });
    d.text("passo N", x1, y0 - 0.25, { size: 10, color: theme.muted, align: "right" });
    d.text("x", x0 + 0.1, y1, { size: 10, color: theme.muted, align: "left" });
    s.traj.forEach((t, i) => d.polyline(t.map((x, n): [number, number] => [X(n), Y(x)]), { color: theme.series[i % theme.series.length]!, width: 1.2, alpha: 0.8 }));
    for (const sg of [1, -1]) {
      const pts: [number, number][] = [];
      for (let i = 0; i <= 100; i++) {
        const n = (nMax * i) / 100;
        pts.push([X(n), Y(n * (2 * pr - 1) + sg * Math.sqrt(4 * n * pr * (1 - pr)))]);
      }
      d.polyline(pts, { color: theme.text, dash: [5, 4], width: 1.5 });
    }
    d.text("⟨x⟩ ± σ", x1, Y(nMax * (2 * pr - 1) + Math.sqrt(4 * nMax * pr * (1 - pr))), { size: 9, align: "right", dy: -8 });
    // histograma das posições
    const hy0 = 0.6, hy1 = 2.8;
    const M = s.wx.length;
    const bw = Math.max(2, Math.ceil((2 * xr) / 40 / 2) * 2);
    const counts = new Map<number, number>();
    for (let i = 0; i < M; i++) {
      const b = Math.floor(s.wx[i]! / bw);
      counts.set(b, (counts.get(b) ?? 0) + 1);
    }
    const XH = (x: number) => 0.6 + ((x + xr) / (2 * xr)) * 8.4;
    const mu = N * (2 * pr - 1), s2 = 4 * N * pr * (1 - pr);
    const peak = Math.max(1e-9, s2 > 0 ? normalPdf(mu, mu, s2) : 1 / bw, ...[...counts.values()].map((c) => c / (M * bw)));
    const HH = (f: number) => hy0 + (f / (peak * 1.1)) * (hy1 - hy0);
    d.line(0.6, hy0, 9.0, hy0, { color: theme.muted });
    for (const [b, c] of counts) {
      const xa = XH(b * bw), xb = XH((b + 1) * bw);
      if (xa >= 0.6 && xb <= 9.0) d.rect(xa, hy0, (xb - xa) * 0.9, HH(c / (M * bw)) - hy0, { fill: theme.accent, alpha: 0.6 });
    }
    if (s2 > 0) d.plot((x) => HH(normalPdf(((x - 0.6) / 8.4) * 2 * xr - xr, mu, s2)), 0.6, 9.0, { color: theme.positive, width: 2 });
    d.text(`posições dos ${M} caminhantes`, 0.6, hy1 + 0.3, { size: 10, color: theme.muted, align: "left" });
  } else {
    const c = 4.6, cy = 4.6, half = 4.0;
    const R = Math.max(10, 2.6 * Math.sqrt(Math.max(N, 1)));
    const k = half / R;
    d.rect(c - half, cy - half, 2 * half, 2 * half, { stroke: theme.grid, width: 1 });
    const t = s.traj[0]!;
    const pts: [number, number][] = [];
    for (let i = 0; i + 1 < t.length; i += 2) pts.push([c + t[i]! * k, cy + t[i + 1]! * k]);
    d.ctx.save();
    d.ctx.beginPath();
    d.ctx.rect(c - half, cy - half, 2 * half, 2 * half);
    d.ctx.clip();
    d.polyline(pts, { color: theme.series[1]!, width: 1.2 });
    for (let i = 0; i < s.wx.length; i++) d.dot(c + s.wx[i]! * k, cy + s.wy[i]! * k, 1.8, theme.accent, 0.7);
    d.circle(c, cy, Math.sqrt(N) * k, { stroke: theme.positive, width: 2, dash: [5, 4] });
    d.ctx.restore();
    d.dot(c, cy, 3, theme.text);
    d.text("círculo: r = √N", c, cy - half - 0.3, { size: 10, color: theme.positive });
  }
  // ⟨x²⟩ × N
  const P = PANEL;
  const nMax = Math.max(20, N);
  const yMax = Math.max(msdTheory(s.mode, nMax, pr), ...s.r2h.map((q) => q[1])) * 1.1 || 1;
  const X = (n: number) => P.x0 + (n / nMax) * (P.x1 - P.x0);
  const Y = (v: number) => P.y0 + (v / yMax) * (P.y1 - P.y0);
  d.rect(P.x0, P.y0, P.x1 - P.x0, P.y1 - P.y0, { stroke: theme.muted, width: 1 });
  d.plot((x) => Y(msdTheory(s.mode, ((x - P.x0) / (P.x1 - P.x0)) * nMax, pr)), P.x0, P.x1, { color: theme.positive, width: 2, dash: [5, 4] });
  d.polyline(s.r2h.map(([n, v]): [number, number] => [X(n), Y(v)]), { color: theme.accent, width: 2 });
  d.text(s.mode === 3 ? "⟨x²⟩" : "⟨r²⟩", P.x0, P.y1 + 0.25, { size: 10, color: theme.muted, align: "left" });
  d.text(`N (até ${nMax})`, P.x1, P.y0 - 0.25, { size: 10, color: theme.muted, align: "right" });
  d.text("— teoria", P.x1, P.y1 + 0.25, { size: 10, color: theme.positive, align: "right" });
  const w = walkStats(s);
  const lines = [
    `N = ${N} passos, ${s.wx.length} caminhantes`,
    `${s.mode === 3 ? "⟨x²⟩" : "⟨r²⟩"} = ${fmt(w.msd, 4)}   (teoria ${fmt(e.teo, 4)})`,
    s.mode === 3 ? `⟨x⟩ = ${fmt(w.mean)}   (N(2p−1) = ${fmt(N * (2 * pr - 1))})` : `r_rms = ${fmt(Math.sqrt(w.msd))}   (√N = ${fmt(Math.sqrt(N))})`,
    `incerteza estatística: ± ${fmt(e.sig)}`,
  ];
  lines.forEach((l, i) => d.text(l, 9.6, 3.4 - i * 0.6, { size: 11, align: "left", weight: i === 1 ? "600" : "400" }));
}

export default probabilidadeMontecarlo;
