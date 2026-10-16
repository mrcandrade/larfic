import { defineSim, deg, draw, num, texNum, type Draw, type Params, type Theme } from "@fisilab/core";
import { fmt, panel } from "./panel.ts";
import {
  H_PLANCK,
  HBAR,
  HBAR_OVER_M,
  M_E,
  NGRID,
  X0,
  evolve,
  firstMin,
  kAt,
  omega,
  packetStats,
  planeSum,
  planeSumAt,
  planeSumUncertainty,
  sigmaT,
  slitIntensity,
  xAt,
} from "./physics.ts";

export * from "./physics.ts";

export interface UncState {
  t: number;
  /** Histograma de chegadas na tela (modo fenda) e as condições em que foi acumulado. */
  hist: number[];
  acc: string;
  seed: number;
}

export const NH = 121;
const mode = (p: Params) => Math.round(num(p, "modo", 0));
const ncomp = (p: Params) => Math.round(num(p, "N", 15));
const sigk = (p: Params) => num(p, "sigk", 1);
const k0 = (p: Params) => num(p, "k0", 10);
const sigx = (p: Params) => num(p, "sigx", 0.5);
const dispersive = (p: Params) => Math.round(num(p, "disp", 0)) === 0;
const slitA = (p: Params) => num(p, "a", 2) * 1000; // nm
const lamS = (p: Params) => num(p, "lam", 500); // nm
/** Faixa angular mostrada na tela: até o 3º mínimo. */
export const thetaRange = (p: Params) => Math.asin(Math.min(1, (3.2 * lamS(p)) / slitA(p)));

const T_END = 40;

let statCache: { key: string; v: ReturnType<typeof packetStats> } | null = null;
/** Estatísticas do pacote livre no tempo t (com cache). */
export function freeStats(p: Params, t: number) {
  const key = `${sigx(p)}|${k0(p)}|${dispersive(p)}|${t}`;
  if (statCache?.key === key) return statCache.v;
  const v = packetStats(evolve(sigx(p), k0(p), t, dispersive(p)));
  statCache = { key, v };
  return v;
}

const lcg = (seed: number): [number, number] => {
  const next = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return [next / 4294967296, next];
};

export const incerteza = defineSim<UncState>({
  id: "incerteza",
  title: "Pacotes de onda e princípio da incerteza",
  course: "FG IV",
  topic: "Quântica",
  priority: "P2",
  summary:
    "Monte um pacote somando ondas planas e veja Δx·Δk ≥ 1/2. O pacote livre de um elétron evolui pela FFT com o espaço x e o espaço k lado a lado e se alarga com o tempo; a difração por uma fenda mede a incerteza do momento.",
  equations: [
    String.raw`\psi(x) = \sum_j a_j\,e^{ik_jx} \;\longleftrightarrow\; \phi(k) = \frac{1}{\sqrt{2\pi}}\int \psi(x)\,e^{-ikx}\,dx`,
    String.raw`\Delta x\,\Delta k \ge \tfrac12 \quad\Longleftrightarrow\quad \Delta x\,\Delta p \ge \tfrac{\hbar}{2},\qquad p = \hbar k`,
    String.raw`\omega = \frac{\hbar k^2}{2m},\qquad v_f = \frac{\omega}{k} = \frac{\hbar k}{2m},\qquad v_g = \frac{d\omega}{dk} = \frac{\hbar k}{m}`,
    String.raw`\sigma(t) = \sigma_0\sqrt{1 + \left(\frac{\hbar t}{2m\sigma_0^2}\right)^2}`,
    String.raw`a\,\operatorname{sen}\theta_1 = \lambda \;\Rightarrow\; \Delta p_y \approx p\,\operatorname{sen}\theta_1 = \frac{h}{a},\quad \Delta y\,\Delta p_y \approx h`,
  ],
  liveEquations(s, p) {
    const m = mode(p);
    if (m === 0) {
      const u = planeSumUncertainty(planeSum(ncomp(p), k0(p), sigk(p)));
      return [String.raw`\Delta x = ${texNum(u.dx)}\ \text{nm},\ \Delta k = ${texNum(u.dk)}\ \text{nm}^{-1} \Rightarrow \Delta x\,\Delta k = ${texNum(u.product)}`];
    }
    if (m === 1) {
      const st = freeStats(p, s.t);
      return [
        String.raw`\Delta x = ${texNum(st.dx, 4)}\ \text{nm}\ (\text{analítico } ${texNum(dispersive(p) ? sigmaT(sigx(p), s.t) : sigx(p), 4)}),\quad \Delta k = ${texNum(st.dk, 4)}\ \text{nm}^{-1}`,
        String.raw`\Delta x\,\Delta k = ${texNum(st.dx * st.dk, 4)},\quad v_g = ${texNum(HBAR_OVER_M * k0(p), 3)}\ \text{nm/fs},\ v_f = ${texNum(dispersive(p) ? 0.5 * HBAR_OVER_M * k0(p) : HBAR_OVER_M * k0(p), 3)}\ \text{nm/fs}`,
      ];
    }
    const a = slitA(p);
    const lam = lamS(p);
    return [
      String.raw`\operatorname{sen}\theta_1 = \frac{${texNum(lam)}\ \text{nm}}{${texNum(a / 1000)}\ \mu\text{m}} = ${texNum(lam / a)} \Rightarrow \theta_1 = ${texNum(deg(firstMin(a, lam)))}^\circ`,
      String.raw`\Delta y\,\Delta p_y \approx a \cdot \frac{h}{\lambda}\operatorname{sen}\theta_1 = h = ${texNum(H_PLANCK, 4)}\ \text{J·s}`,
    ];
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
        { value: 0, label: "Soma de ondas planas" },
        { value: 1, label: "Pacote livre: x e k lado a lado (FFT)" },
        { value: 2, label: "Difração por uma fenda" },
      ],
    },
    { key: "N", label: "Número de ondas planas", unit: "", min: 1, max: 60, step: 1, default: 15, live: true },
    { key: "sigk", label: "Largura em k (σ_k)", unit: "nm⁻¹", min: 0.2, max: 4, step: 0.05, default: 1, live: true },
    { key: "k0", label: "Número de onda central k₀", unit: "nm⁻¹", min: 0, max: 20, step: 0.5, default: 10, live: true },
    { key: "sigx", label: "Largura inicial do pacote σ₀", unit: "nm", min: 0.2, max: 3, step: 0.05, default: 0.5, live: true },
    {
      key: "disp",
      label: "Relação de dispersão",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 0,
      live: true,
      options: [
        { value: 0, label: "Elétron livre: ω = ħk²/2m" },
        { value: 1, label: "Sem dispersão: ω = v k" },
      ],
    },
    { key: "a", label: "Largura da fenda a", unit: "µm", min: 0.5, max: 20, step: 0.1, default: 2, live: true },
    { key: "lam", label: "Comprimento de onda λ", unit: "nm", min: 400, max: 700, step: 1, default: 500, live: true },
  ],

  observables: [
    { key: "t", label: "Tempo", unit: "fs", value: (s) => s.t },
    {
      key: "dx",
      label: "Δx",
      unit: "nm",
      value: (s, p) => (mode(p) === 0 ? planeSumUncertainty(planeSum(ncomp(p), k0(p), sigk(p))).dx : mode(p) === 1 ? freeStats(p, s.t).dx : slitA(p)),
    },
    {
      key: "dk",
      label: "Δk",
      unit: "nm⁻¹",
      value: (s, p) =>
        mode(p) === 0
          ? planeSumUncertainty(planeSum(ncomp(p), k0(p), sigk(p))).dk
          : mode(p) === 1
            ? freeStats(p, s.t).dk
            : ((2 * Math.PI) / lamS(p)) * Math.sin(firstMin(slitA(p), lamS(p))),
    },
    {
      key: "prod",
      label: "Δx·Δk",
      unit: "",
      value: (s, p) => {
        if (mode(p) === 0) return planeSumUncertainty(planeSum(ncomp(p), k0(p), sigk(p))).product;
        if (mode(p) === 1) {
          const st = freeStats(p, s.t);
          return st.dx * st.dk;
        }
        return 2 * Math.PI; // Δy·Δk_y = a·(2π/a)
      },
    },
    { key: "xm", label: "Posição média ⟨x⟩", unit: "nm", value: (s, p) => (mode(p) === 1 ? freeStats(p, s.t).mean : 0) },
    { key: "sigA", label: "σ(t) analítico", unit: "nm", value: (s, p) => (mode(p) === 1 && dispersive(p) ? sigmaT(sigx(p), s.t) : sigx(p)) },
    { key: "norma", label: "Norma ∫|ψ|² dx", unit: "", value: (s, p) => (mode(p) === 1 ? freeStats(p, s.t).norm : 1) },
    { key: "nhits", label: "Partículas detectadas", unit: "", value: (s) => s.hist.reduce((a, b) => a + b, 0) },
  ],
  conserved: "norma",
  chart: { x: "t", y: "dx" },

  scenarios: [
    {
      id: "soma",
      label: "Construindo um pacote",
      params: { modo: 0, N: 3, sigk: 1, k0: 10 },
      guide: `### Muitas ondas fazem um pacote
1. Com 1 onda plana, $\\Delta k = 0$ e a onda ocupa todo o espaço: $\\Delta x \\to \\infty$.
2. Aumente o número de componentes. Com poucas, o padrão se **repete** a cada $2\\pi/\\delta k$; com muitas, a repetição se afasta e sobra um pacote só.
3. Diminua $\\sigma_k$: o pacote fica mais largo. O produto $\\Delta x\\,\\Delta k$ tende a $1/2$ (amplitudes gaussianas): o mínimo possível.
4. Repare no gráfico de barras: é a transformada de Fourier discreta do pacote.`,
      predict: [
        {
          question: "Se você reduzir σ_k à metade (com muitas componentes), a largura Δx do pacote:",
          options: ["cai à metade", "dobra", "não muda", "quadruplica"],
          answer: 1,
          explanation: "Para o pacote gaussiano $\\Delta x\\,\\Delta k = 1/2$: com $\\Delta k$ pela metade, $\\Delta x$ dobra.",
        },
      ],
    },
    {
      id: "livre",
      label: "Pacote livre se alarga",
      params: { modo: 1, sigx: 0.5, k0: 10, disp: 0 },
      guide: `### Evolução pela FFT
1. O pacote de um elétron começa com $\\sigma_0 = 0{,}5$ nm. À direita, $|\\phi(k)|^2$ obtido pela FFT: ele **não muda** no tempo, pois cada componente só ganha fase $e^{-i\\omega t}$.
2. Rode: o pacote anda com $v_g = \\hbar k_0/m$ e as cristas andam com $v_f = v_g/2$ (marcadores). Ele se alarga como $\\sigma(t)$; compare o $\\Delta x$ medido com a fórmula.
3. Comece com um pacote mais estreito ($\\sigma_0 = 0{,}2$ nm): ele se alarga muito **mais depressa**. Saber muito bem onde está implica um $\\Delta p$ grande.
4. Troque para a relação sem dispersão: o pacote anda sem se deformar.`,
      predict: [
        {
          question: "Qual pacote se alarga mais depressa?",
          options: ["o inicialmente mais largo", "o inicialmente mais estreito", "os dois igualmente", "nenhum, a norma se conserva"],
          answer: 1,
          explanation: "O tempo característico é $2m\\sigma_0^2/\\hbar$: o pacote estreito tem $\\Delta k$ grande, componentes com velocidades muito diferentes, e se espalha rápido.",
        },
      ],
    },
    {
      id: "fenda",
      label: "Fenda: medir a posição espalha o momento",
      params: { modo: 2, a: 2, lam: 500 },
      guide: `### Δy·Δp_y ≈ h
1. Partículas (fótons ou elétrons) passam por uma fenda de largura $a$: a fenda mede a posição transversal com $\\Delta y \\approx a$.
2. As chegadas na tela formam o padrão $\\operatorname{sinc}^2$. O primeiro mínimo, $\\operatorname{sen}\\theta_1 = \\lambda/a$, dá $\\Delta p_y \\approx p\\operatorname{sen}\\theta_1 = h/a$.
3. Estreite a fenda: o padrão **alarga**. Melhorar $\\Delta y$ piora $\\Delta p_y$; o produto fica em torno de $h$.
4. O padrão na tela é a distribuição de $p_y$: o módulo ao quadrado da transformada de Fourier da abertura.`,
      predict: [
        {
          question: "Se a fenda ficar 4 vezes mais estreita, a largura angular do máximo central:",
          options: ["fica 4 vezes menor", "fica igual", "fica cerca de 4 vezes maior", "some"],
          answer: 2,
          explanation: "$\\operatorname{sen}\\theta_1 = \\lambda/a$: para ângulos pequenos, $\\theta_1 \\propto 1/a$. Localizar mais a partícula aumenta a incerteza do momento transversal.",
        },
      ],
    },
  ],

  exercises: [
    {
      id: "minimo",
      prompt: "Um elétron está localizado com Δx = {dx} nm. Qual é a menor incerteza possível na sua velocidade (em km/s)?",
      vary: { dx: [0.05, 5, 2] },
      answer: { label: "Δv", unit: "km/s", compute: (p) => HBAR / (2 * M_E * num(p, "dx") * 1e-9) / 1e3 },
      hint: "Δp ≥ ħ/(2Δx) e Δv = Δp/m.",
    },
    {
      id: "alargamento",
      prompt: "Um pacote gaussiano de elétron tem largura inicial σ₀ = {s0} nm. Qual é a largura depois de {t} fs?",
      vary: { s0: [0.2, 2, 2], t: [1, 40, 0] },
      answer: { label: "σ", unit: "nm", compute: (p) => sigmaT(num(p, "s0"), num(p, "t")) },
      hint: "σ(t) = σ₀ √(1 + (ħt/2mσ₀²)²), com ħ/m = 0,1158 nm²/fs.",
    },
    {
      id: "fenda",
      prompt: "Luz de {lam} nm passa por uma fenda de {a} µm. Qual é o ângulo do primeiro mínimo de difração?",
      vary: { lam: [400, 700, 0], a: [1, 20, 1] },
      answer: { label: "θ₁", unit: "°", compute: (p) => deg(firstMin(num(p, "a") * 1000, num(p, "lam"))) },
      hint: "a sen θ₁ = λ.",
    },
  ],

  init: () => ({ t: 0, hist: new Array<number>(NH).fill(0), acc: "", seed: 2024 }),
  step(s, p, _t, dt) {
    if (mode(p) !== 2) return { ...s, t: s.t + dt };
    const key = `${slitA(p)}|${lamS(p)}`;
    let hist = s.acc === key ? s.hist.slice() : new Array<number>(NH).fill(0);
    let seed = s.seed;
    const th = thetaRange(p);
    let hits = 0;
    for (let tries = 0; tries < 200 && hits < 3; tries++) {
      let u: number;
      let v: number;
      [u, seed] = lcg(seed);
      [v, seed] = lcg(seed);
      const theta = (2 * u - 1) * th;
      if (v < slitIntensity(theta, slitA(p), lamS(p))) {
        const i = Math.min(NH - 1, Math.floor(u * NH));
        hist[i]!++;
        hits++;
      }
    }
    if (hist.length !== NH) hist = new Array<number>(NH).fill(0);
    return { t: s.t + dt, hist, acc: key, seed };
  },
  dt: 0.05,
  sampleEvery: 4,
  tEnd: T_END,

  actions: [{ id: "zerar", label: "Zerar tela", run: (s) => ({ ...s, hist: new Array<number>(NH).fill(0) }) }],

  viewport: () => ({ xMin: 0, xMax: 20, yMin: 0, yMax: 12 }),

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const { state: s, params: p, theme } = frame;
    const m = mode(p);
    if (m === 0) renderSum(d, theme, p);
    else if (m === 1) renderFree(d, theme, s, p);
    else renderSlit(d, theme, s, p);
  },
});

function renderSum(d: Draw, theme: Theme, p: Params) {
  const ps = planeSum(ncomp(p), k0(p), sigk(p));
  const asum = ps.a.reduce((a, b) => a + b, 0);
  const P = panel(d, { x0: 1.3, y0: 6.2, x1: 19.6, y1: 11.4 }, { min: -10, max: 10 }, { min: -1.15, max: 1.15 });
  P.frame({ xlabel: "x (nm)", ylabel: "ψ(x) normalizado" });
  // algumas componentes, deslocadas e apagadas
  const show = Math.min(ps.k.length, 5);
  for (let j = 0; j < show; j++) {
    const idx = Math.round((j * (ps.k.length - 1)) / Math.max(1, show - 1));
    const kj = ps.k[idx]!;
    const aj = ps.a[idx]! / Math.max(...ps.a);
    P.plot((x) => 0.25 * aj * Math.cos(kj * x), -10, 10, { color: theme.series[(j + 1) % 6]!, width: 1, alpha: 0.35, n: 800 });
  }
  P.plot((x) => planeSumAt(ps, x)[0] / asum, -10, 10, { color: theme.accent, width: 1.6, n: 1600 });
  P.plot((x) => Math.hypot(...planeSumAt(ps, x)) / asum, -10, 10, { color: theme.positive, width: 2, n: 800 });
  P.plot((x) => -Math.hypot(...planeSumAt(ps, x)) / asum, -10, 10, { color: theme.positive, width: 1, alpha: 0.5, n: 800 });
  d.text("Re ψ (soma)", P.box.x0 + 0.15, P.box.y1 - 0.3, { color: theme.accent, size: 10, align: "left" });
  d.text("|ψ| (envoltória)", P.box.x0 + 2.2, P.box.y1 - 0.3, { color: theme.positive, size: 10, align: "left" });
  d.text("algumas componentes (×0,25)", P.box.x0 + 4.9, P.box.y1 - 0.3, { color: theme.muted, size: 10, align: "left" });
  if (Number.isFinite(ps.period) && ps.period < 20)
    for (let n = -3; n <= 3; n++) {
      const x = n * ps.period;
      if (n !== 0 && Math.abs(x) < 10) d.text("repetição", P.X(x), P.Y(1.08), { color: theme.muted, size: 9 });
    }

  // espectro: barras a_j
  const kr = { min: k0(p) - 5.5 * sigk(p), max: k0(p) + 5.5 * sigk(p) };
  const K = panel(d, { x0: 1.3, y0: 0.9, x1: 9.6, y1: 4.8 }, kr, { min: 0, max: 1.15 });
  K.frame({ xlabel: "k (nm⁻¹)", ylabel: "amplitude a(k)" });
  K.plot((k) => Math.exp(-((k - k0(p)) ** 2) / (4 * sigk(p) ** 2)), kr.min, kr.max, { color: theme.muted, width: 1, dash: [4, 3] });
  for (let j = 0; j < ps.k.length; j++) d.line(K.X(ps.k[j]!), K.Y(0), K.X(ps.k[j]!), K.Y(ps.a[j]!), { color: theme.accent, width: 3 });

  const u = planeSumUncertainty(ps);
  let y = 4.5;
  const x0 = 11.2;
  const t = (str: string, col = theme.text, size = 11, weight = "400") => {
    d.text(str, x0, y, { color: col, size, weight, align: "left" });
    y -= 0.5;
  };
  t("Incerteza do pacote", theme.text, 12, "600");
  t(`${ps.k.length} ondas planas, δk = ${ps.k.length > 1 ? fmt(ps.dk, 3) : "—"} nm⁻¹`);
  t(`Δk = ${fmt(u.dk, 3)} nm⁻¹`);
  t(ps.k.length > 1 ? `Δx = ${fmt(u.dx, 3)} nm (num período de ${fmt(ps.period, 3)} nm)` : "Δx → ∞: uma onda plana ocupa todo o espaço");
  t(`Δx·Δk = ${ps.k.length > 1 ? fmt(u.product, 3) : "indefinido"}  (mínimo: 0,5)`, u.product >= 0.499 ? theme.accent : theme.positive, 12, "600");
  t("Mais componentes → repetições mais distantes.", theme.muted, 10);
}

function renderFree(d: Draw, theme: Theme, s: UncState, p: Params) {
  const pk = evolve(sigx(p), k0(p), s.t, dispersive(p));
  const st = packetStats(pk);
  const half = Math.max(10, 3.5 * st.dx);
  const c = Math.round(st.mean / 2) * 2;
  const xr = { min: c - half, max: c + half };
  const A = (2 * Math.PI * sigx(p) ** 2) ** -0.25;
  const P = panel(d, { x0: 1.3, y0: 6.2, x1: 19.6, y1: 11.4 }, xr, { min: -A * 1.1, max: A * 1.1 });
  P.frame({ xlabel: "x (nm)", ylabel: "ψ(x, t)" });
  const re: [number, number][] = [];
  const mod: [number, number][] = [];
  for (let i = 0; i < NGRID; i++) {
    const x = xAt(i);
    if (x < xr.min || x > xr.max) continue;
    re.push([x, pk.re[i]!]);
    mod.push([x, Math.hypot(pk.re[i]!, pk.im[i]!)]);
  }
  P.line(re, { color: theme.accent, width: 1.2 });
  P.line(mod, { color: theme.positive, width: 2 });
  P.line(
    mod.map(([x, v]) => [x, -v]),
    { color: theme.positive, width: 1, alpha: 0.5 },
  );
  // marcadores: envoltória (v_g) e uma crista (v_f)
  const vg = HBAR_OVER_M * k0(p);
  const vf = dispersive(p) ? vg / 2 : vg;
  const xg = X0 + vg * s.t;
  if (xg > xr.min && xg < xr.max) d.arrowPx(P.X(xg), P.box.y1 + 0.05, 0, -1, 14, { color: theme.positive });
  if (k0(p) > 0) {
    const lam = (2 * Math.PI) / k0(p);
    let xf = X0 + vf * s.t;
    // a crista mais próxima do centro do pacote
    xf += Math.round((xg - xf) / lam) * lam;
    if (xf > xr.min && xf < xr.max) d.arrowPx(P.X(xf), P.box.y0 - 0.05, 0, 1, 14, { color: theme.accent });
  }
  d.text(`t = ${fmt(s.t, 3)} fs · ▼ envoltória (v_g = ${fmt(vg, 3)} nm/fs) · ▲ crista (v_f = ${fmt(vf, 3)} nm/fs)`, P.box.x0 + 0.15, P.box.y1 - 0.3, {
    size: 10,
    align: "left",
  });

  // |φ(k)|² via FFT
  const sk = 1 / (2 * sigx(p));
  const kr = { min: k0(p) - 4.5 * sk, max: k0(p) + 4.5 * sk };
  const pts: [number, number][] = [];
  let pmax = 0;
  for (let i = 0; i < NGRID; i++) pmax = Math.max(pmax, pk.phiRe[i]! ** 2 + pk.phiIm[i]! ** 2);
  for (let i = 0; i < NGRID; i++) {
    const k = kAt(i);
    if (k >= kr.min && k <= kr.max) pts.push([k, (pk.phiRe[i]! ** 2 + pk.phiIm[i]! ** 2) / pmax]);
  }
  pts.sort((a, b) => a[0] - b[0]);
  const K = panel(d, { x0: 1.3, y0: 0.9, x1: 9.4, y1: 4.8 }, kr, { min: 0, max: 1.15 });
  K.frame({ xlabel: "k (nm⁻¹)", ylabel: "|φ(k)|² (FFT, fixo no tempo)" });
  K.line(pts, { color: theme.series[2]!, width: 2 });
  for (const sg of [-1, 1]) d.line(K.X(st.kMean + sg * st.dk), K.Y(0), K.X(st.kMean + sg * st.dk), K.Y(0.6), { color: theme.muted, width: 1, dash: [3, 3] });
  d.text(`Δk = ${fmt(st.dk, 3)} nm⁻¹`, K.X(st.kMean), K.Y(0.65), { size: 10, color: theme.muted });

  // ω(k) com velocidades de fase e de grupo
  const W = panel(d, { x0: 11.4, y0: 0.9, x1: 19.6, y1: 4.8 }, { min: 0, max: 20 }, { min: 0, max: omega(20, k0(p), dispersive(p)) * 1.05 + 1 });
  W.frame({ xlabel: "k (nm⁻¹)", ylabel: "ω (rad/fs)" });
  W.plot((k) => omega(k, k0(p), dispersive(p)), 0, 20, { color: theme.text, width: 2 });
  const w0 = omega(k0(p), k0(p), dispersive(p));
  W.plot((k) => w0 + vg * (k - k0(p)), 0, 20, { color: theme.positive, width: 1.5, dash: [6, 4], n: 2 });
  W.plot((k) => (k0(p) > 0 ? (w0 / k0(p)) * k : 0), 0, 20, { color: theme.accent, width: 1.5, dash: [2, 3], n: 2 });
  d.dot(W.X(k0(p)), W.Y(w0), 5, theme.text);
  d.text("tangente: v_g = dω/dk", W.box.x0 + 0.15, W.box.y1 - 0.3, { color: theme.positive, size: 10, align: "left" });
  d.text("secante: v_f = ω/k", W.box.x0 + 0.15, W.box.y1 - 0.7, { color: theme.accent, size: 10, align: "left" });
  const sa = dispersive(p) ? sigmaT(sigx(p), s.t) : sigx(p);
  d.text(`Δx = ${fmt(st.dx, 4)} nm (fórmula ${fmt(sa, 4)}) · Δx·Δk = ${fmt(st.dx * st.dk, 4)} · norma ${fmt(st.norm, 6)}`, 1.3, 5.5, {
    size: 11,
    align: "left",
    weight: "600",
  });
}

function renderSlit(d: Draw, theme: Theme, s: UncState, p: Params) {
  const a = slitA(p);
  const lam = lamS(p);
  const th1 = firstMin(a, lam);
  const thR = thetaRange(p);
  const col = theme.accent;
  // esquema
  const sx0 = 3.2;
  const yc = 8.8;
  const ap = 0.25 + Math.min(1.2, a / 10000); // abertura desenhada (fora de escala)
  for (let x = 0.6; x < sx0; x += 0.3) d.line(x, yc - 1.4, x, yc + 1.4, { color: col, width: 1, alpha: 0.5 });
  d.rect(sx0 - 0.1, yc + ap / 2, 0.2, 2.5 - ap / 2, { fill: theme.muted });
  d.rect(sx0 - 0.1, yc - 2.5, 0.2, 2.5 - ap / 2, { fill: theme.muted });
  d.text(`a = ${fmt(a / 1000, 3)} µm`, sx0, yc + 2.75, { size: 10 });
  const Ls = 6.5;
  const scr = sx0 + Ls;
  d.line(scr, yc - 2.8, scr, yc + 2.8, { color: theme.text, width: 2 });
  const vis = (th: number) => yc + (Math.tan(th) / Math.tan(thR)) * 2.6;
  for (const sg of [-1, 1]) d.line(sx0, yc, scr, vis(sg * th1), { color: col, width: 1, dash: [5, 4] });
  d.text("θ₁", sx0 + 1.4, yc + 0.35, { size: 10, color: col });
  // intensidade ao lado da tela
  const prof: [number, number][] = [];
  for (let i = 0; i <= 300; i++) {
    const th = -thR + (2 * thR * i) / 300;
    prof.push([scr + 0.1 + 1.4 * slitIntensity(th, a, lam), vis(th)]);
  }
  d.polyline(prof, { color: theme.positive, width: 1.5 });
  d.text("tela (escala angular)", scr, yc - 3.1, { size: 9, color: theme.muted });

  // momento
  const ox = 13.2;
  const oy = 8.8;
  const L = 4.5;
  d.text("Momento na saída da fenda", 11.2, 11.7, { size: 12, weight: "600", align: "left" });
  d.arrow(ox, oy, L, 0, { color: theme.text, width: 2.5 });
  d.text("p = h/λ", ox + L / 2, oy, { size: 10, dy: 12 });
  const py = L * Math.tan(th1);
  const pyd = Math.min(2.6, py);
  d.arrow(ox, oy, L, pyd, { color: col, width: 1.5 });
  d.arrow(ox, oy, L, -pyd, { color: col, width: 1.5 });
  d.line(ox + L, oy - pyd, ox + L, oy + pyd, { color: theme.positive, width: 3 });
  d.text("±Δp_y", ox + L + 0.15, oy + pyd * 0.5, { color: theme.positive, size: 10, align: "left" });
  const p0 = H_PLANCK / (lam * 1e-9);
  const dpy = p0 * Math.sin(th1);
  let y = 5.9;
  const x0 = 11.2;
  const line = (str: string, c = theme.text, w = "400") => {
    d.text(str, x0, y, { size: 10, align: "left", color: c, weight: w });
    y -= 0.42;
  };
  line(`p = h/λ = ${fmt(p0, 4)} kg·m/s`);
  line(`Δp_y ≈ p sen θ₁ = h/a = ${fmt(dpy, 4)} kg·m/s (θ₁ = ${fmt(deg(th1), 3)}°)`);
  line(`Δy·Δp_y ≈ ${fmt(a * 1e-9 * dpy, 4)} J·s = h  (≥ ħ/2 = ${fmt(HBAR / 2, 3)})`, theme.positive, "600");

  // histograma das chegadas
  const n = s.hist.reduce((x, z) => x + z, 0);
  const hmax = Math.max(1, ...s.hist);
  const Hp = panel(d, { x0: 1.3, y0: 0.9, x1: 19.6, y1: 4.4 }, { min: -deg(thR), max: deg(thR) }, { min: 0, max: hmax * 1.15 });
  Hp.frame({ xlabel: "θ (graus)", ylabel: `chegadas na tela (${n})` });
  const bw = (2 * deg(thR)) / NH;
  for (let i = 0; i < NH; i++) {
    const th = -deg(thR) + (i + 0.5) * bw;
    const x0b = Hp.X(th - bw / 2);
    d.rect(x0b, Hp.Y(0), Hp.X(th + bw / 2) - x0b, Hp.Y(s.hist[i]!) - Hp.Y(0), { fill: col, alpha: 0.55 });
  }
  if (n > 0) {
    let norm = 0;
    for (let i = 0; i < NH; i++) norm += slitIntensity((((i + 0.5) / NH) * 2 - 1) * thR, a, lam);
    Hp.plot((th) => (slitIntensity((th * Math.PI) / 180, a, lam) * n) / norm, -deg(thR), deg(thR), { color: theme.positive, width: 1.5, n: 400 });
  }
  for (const sg of [-1, 1]) d.line(Hp.X(sg * deg(th1)), Hp.box.y0, Hp.X(sg * deg(th1)), Hp.box.y1, { color: theme.muted, width: 1, dash: [3, 3] });
}

export default incerteza;
