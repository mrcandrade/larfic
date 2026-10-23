import { defineSim, draw, num, texNum, type Params, type State } from "@fisilab/core";

// Estado: [t, x da sonda]. A onda é a soma analítica das componentes, avaliada em t.
const T = 0, XP = 1;
export const G = 9.81;
/** Domínio desenhado (m) e posição inicial do centro do pacote/envoltória. */
export const DOM = { x0: 0, x1: 20 };
export const X0 = 3;

const DISP = ["não dispersiva: ω = ck", "águas profundas: ω = √(gk)", "tipo Schrödinger: ω ∝ k²"];

export const k0Of = (p: Params) => (2 * Math.PI) / num(p, "lambda", 1);
/** Frequência central: ω₀ = √(g k₀), comum às três relações (mesma v_f em k₀). */
export const w0Of = (p: Params) => Math.sqrt(G * k0Of(p));

/** Relação de dispersão ω(k) escolhida. */
export function omegaOf(p: Params, k: number): number {
  const k0 = k0Of(p), w0 = w0Of(p);
  switch (Math.round(num(p, "disp"))) {
    case 1:
      return Math.sqrt(G * Math.max(k, 0));
    case 2:
      return w0 * (k / k0) ** 2;
    default:
      return (w0 / k0) * k;
  }
}
/** dω/dk analítica em k. */
export function groupVelocityAt(p: Params, k: number): number {
  const k0 = k0Of(p), w0 = w0Of(p);
  switch (Math.round(num(p, "disp"))) {
    case 1:
      return 0.5 * Math.sqrt(G / Math.max(k, 1e-12));
    case 2:
      return (2 * w0 * k) / (k0 * k0);
    default:
      return w0 / k0;
  }
}

export interface Component {
  a: number;
  k: number;
  w: number;
}

const isPacket = (p: Params) => Math.round(num(p, "modo")) === 1;
/** Modo 2: duas ondas progressivas de mesma frequência, defasadas de φ, somadas por fasores. */
export const isPhasor = (p: Params) => Math.round(num(p, "modo")) === 2;
/** Frequência angular usada no modo de fasores (0,5 Hz, para acompanhar a rotação). */
export const W_FASOR = Math.PI;

/** Resultante de y₁ = A₁ sen(kx − ωt) e y₂ = A₂ sen(kx − ωt + φ): y = A′ sen(kx − ωt + β). */
export function phasorSum(A1: number, A2: number, phiRad: number): { A: number; beta: number } {
  const X = A1 + A2 * Math.cos(phiRad), Y = A2 * Math.sin(phiRad);
  return { A: Math.hypot(X, Y), beta: Math.atan2(Y, X) };
}
const phasorOf = (p: Params) => phasorSum(num(p, "A1", 1), num(p, "A2", 0.7), (num(p, "phi", 60) * Math.PI) / 180);

/** Componentes da soma: duas ondas (batimento) ou N ondas com pesos gaussianos (pacote). */
export function components(p: Params): Component[] {
  const k0 = k0Of(p);
  if (!isPacket(p)) {
    const dk = num(p, "dk", 0.15) * k0;
    return [k0 - dk / 2, k0 + dk / 2].map((k) => ({ a: 0.5, k, w: omegaOf(p, k) }));
  }
  const N = Math.max(2, Math.round(num(p, "N", 61)));
  const s0 = num(p, "sigma", 0.6);
  const step = 6 / (s0 * (N - 1)); // cobre k₀ ± 3/σ₀
  const out: Component[] = [];
  for (let j = 0; j < N; j++) {
    const k = k0 + (j - (N - 1) / 2) * step;
    if (k <= 0) continue;
    out.push({ a: Math.exp(-((s0 * (k - k0)) ** 2)), k, w: omegaOf(p, k) });
  }
  const sum = out.reduce((acc, c) => acc + c.a, 0);
  for (const c of out) c.a /= sum;
  return out;
}

/** Espaçamento Δk entre componentes (o pacote se repete a cada 2π/Δk). */
export function spacing(p: Params): number {
  if (!isPacket(p)) return num(p, "dk", 0.15) * k0Of(p);
  return 6 / (num(p, "sigma", 0.6) * (Math.max(2, Math.round(num(p, "N", 61))) - 1));
}

export function field(cs: Component[], x: number, t: number): number {
  let y = 0;
  for (const c of cs) y += c.a * Math.cos(c.k * (x - X0) - c.w * t);
  return y;
}
export function envelope(cs: Component[], x: number, t: number): number {
  let re = 0, im = 0;
  for (const c of cs) {
    const ph = c.k * (x - X0) - c.w * t;
    re += c.a * Math.cos(ph);
    im += c.a * Math.sin(ph);
  }
  return Math.hypot(re, im);
}

/** Velocidades de fase e de grupo usadas pelos marcadores. */
export function velocities(p: Params): { vf: number; vg: number } {
  if (!isPacket(p)) {
    const [c1, c2] = components(p);
    return { vf: (c1!.w + c2!.w) / (c1!.k + c2!.k), vg: (c2!.w - c1!.w) / (c2!.k - c1!.k) };
  }
  const k0 = k0Of(p);
  return { vf: omegaOf(p, k0) / k0, vg: groupVelocityAt(p, k0) };
}

/** Centroide e desvio-padrão de |envoltória|² num período espacial em torno do marcador de grupo. */
export function packetStats(p: Params, t: number): { xc: number; sigma: number } {
  const cs = components(p);
  const { vg } = velocities(p);
  const P = Math.min((2 * Math.PI) / spacing(p), 200);
  const xg = X0 + vg * t;
  const M = 800;
  let s0 = 0, s1 = 0, s2 = 0;
  for (let i = 0; i < M; i++) {
    const x = xg - P / 2 + (P * (i + 0.5)) / M;
    const e2 = envelope(cs, x, t) ** 2;
    s0 += e2;
    s1 += e2 * x;
    s2 += e2 * x * x;
  }
  const xc = s1 / s0;
  return { xc, sigma: Math.sqrt(Math.max(0, s2 / s0 - xc * xc)) };
}

// ---- Layout do palco (x em metros no painel da onda; demais painéis abstratos) ----
const WV = { yc: 2.7, amp: 1.55 };
const DP = { x0: 0.6, x1: 8.6, y0: -4.3, y1: -0.7 }; // ω(k)
const TP = { x0: 11.2, x1: 20, y0: -4.3, y1: -0.7 }; // y(x_s, t)

const fmt = (v: number, d = 3) => (Number.isFinite(v) ? Number(v.toPrecision(d)).toString().replace(".", ",") : "—");
const mod = (a: number, b: number) => ((a % b) + b) % b;

/** Modo de fasores: as duas ondas e a soma ao longo de x, e o diagrama de fasores girando. */
function renderPhasors(d: ReturnType<typeof draw>, p: Params, t: number, theme: ReturnType<typeof draw>["theme"]) {
  const A1 = num(p, "A1", 1), A2 = num(p, "A2", 0.7), ph = (num(p, "phi", 60) * Math.PI) / 180;
  const k = k0Of(p), w = W_FASOR;
  const r = phasorOf(p);
  const sc = 2.2 / Math.max(2, A1 + A2);
  const c1 = theme.series[0]!, c2 = theme.series[1]!, cr = theme.accent;
  // ondas ao longo de x (0 a 12 m), cada uma na sua faixa e a soma embaixo
  const X1 = 12;
  const rows: [number, (x: number) => number, string, string][] = [
    [3.6, (x) => A1 * Math.sin(k * x - w * t), c1, "y₁"],
    [1.0, (x) => A2 * Math.sin(k * x - w * t + ph), c2, "y₂"],
    [-2.6, (x) => r.A * Math.sin(k * x - w * t + r.beta), cr, "y′"],
  ];
  for (const [yc, f, col, nome] of rows) {
    d.line(0, yc, X1, yc, { color: theme.grid, width: 1 });
    const pts: [number, number][] = [];
    for (let i = 0; i <= 400; i++) {
      const x = (X1 * i) / 400;
      pts.push([x, yc + sc * f(x)]);
    }
    d.polyline(pts, { color: col, width: 2 });
    d.text(nome, -0.2, yc, { color: col, size: 12, weight: "600", align: "right" });
    d.dot(0, yc + sc * f(0), 5, col);
  }
  d.line(0, -5, 0, 5.2, { color: theme.muted, width: 1, dash: [3, 3] });
  d.text("x = 0", 0, -4.85, { color: theme.muted, size: 10, align: "left", dx: 4 });
  d.text("y′ = y₁ + y₂", X1, -4.85, { color: cr, size: 11, weight: "600", align: "right" });
  // diagrama de fasores (ângulo φᵢ − ωt; a projeção vertical é y em x = 0)
  const C = { x: 16.8, y: 0.6 };
  const R = 3.6 / Math.max(2, A1 + A2);
  d.circle(C.x, C.y, R * r.A, { stroke: theme.grid, width: 1 });
  d.line(C.x - R * 2.1, C.y, C.x + R * 2.1, C.y, { color: theme.grid, width: 1 });
  d.line(C.x, C.y - R * 2.1, C.x, C.y + R * 2.1, { color: theme.grid, width: 1 });
  const a1 = -w * t, a2 = ph - w * t, ar = r.beta - w * t;
  const P1: [number, number] = [C.x + R * A1 * Math.cos(a1), C.y + R * A1 * Math.sin(a1)];
  d.arrow(C.x, C.y, P1[0] - C.x, P1[1] - C.y, { color: c1, width: 3 });
  if (A2 > 1e-6) d.arrow(P1[0], P1[1], R * A2 * Math.cos(a2), R * A2 * Math.sin(a2), { color: c2, width: 3 });
  if (r.A > 1e-6) d.arrow(C.x, C.y, R * r.A * Math.cos(ar), R * r.A * Math.sin(ar), { color: cr, width: 2.5, dash: [6, 3] });
  // projeções verticais = deslocamentos em x = 0
  const yr = C.y + R * r.A * Math.sin(ar);
  d.line(C.x + R * r.A * Math.cos(ar), yr, C.x - R * 2.3, yr, { color: cr, width: 1, dash: [2, 3], alpha: 0.7 });
  d.text("fasores (giram com ω)", C.x, C.y + R * 2.1 + 0.5, { color: theme.text, size: 12, weight: "600" });
  d.text(`A₁ = ${fmt(A1)}   A₂ = ${fmt(A2)}   φ = ${fmt(num(p, "phi", 60))}°`, C.x, -3.6, { color: theme.text, size: 11 });
  d.text(`A′ = ${fmt(r.A)}   β = ${fmt((r.beta * 180) / Math.PI)}°`, C.x, -4.3, { color: cr, size: 12, weight: "600" });
}

export const superposicao = defineSim({
  id: "superposicao",
  title: "Superposição, batimentos e velocidade de grupo",
  course: "FG II",
  topic: "Ondas",
  priority: "P1",
  summary:
    "Some duas ondas e veja batimentos, ou some muitas e forme um pacote. Escolha a relação de dispersão e acompanhe uma crista (velocidade de fase) e o pacote (velocidade de grupo) andando em ritmos diferentes.",
  equations: [
    String.raw`y(x,t) = \sum_j A_j \cos\!\big(k_j x - \omega(k_j)\,t\big)`,
    String.raw`y_1 + y_2 = 2A\cos\!\left(\frac{\Delta k\,x - \Delta\omega\,t}{2}\right)\cos(\bar k x - \bar\omega t) \qquad f_{\text{bat}} = |f_1 - f_2|`,
    String.raw`v_f = \frac{\omega}{k} \qquad v_g = \frac{d\omega}{dk}`,
    String.raw`\omega = ck:\ v_g = v_f \qquad \omega = \sqrt{gk}:\ v_g = \tfrac12 v_f \qquad \omega \propto k^2:\ v_g = 2v_f`,
  ],
  liveEquations(s, p) {
    if (isPhasor(p)) {
      const A1 = num(p, "A1", 1), A2 = num(p, "A2", 0.7), ph = num(p, "phi", 60);
      const r = phasorOf(p);
      return [
        String.raw`A' = \sqrt{A_1^2 + A_2^2 + 2A_1A_2\cos\phi} = \sqrt{${texNum(A1)}^2 + ${texNum(A2)}^2 + 2\cdot${texNum(A1)}\cdot${texNum(A2)}\cos ${texNum(ph)}^\circ} = ${texNum(r.A)}`,
        String.raw`\tan\beta = \frac{A_2\,\mathrm{sen}\,\phi}{A_1 + A_2\cos\phi} \Rightarrow \beta = ${texNum((r.beta * 180) / Math.PI)}^\circ \qquad y' = ${texNum(r.A)}\,\mathrm{sen}(kx - \omega t + ${texNum((r.beta * 180) / Math.PI)}^\circ)`,
      ];
    }
    const { vf, vg } = velocities(p);
    const out = [String.raw`v_f = ${texNum(vf)}\ \text{m/s} \qquad v_g = ${texNum(vg)}\ \text{m/s} \qquad v_g/v_f = ${texNum(vg / vf)}`];
    if (!isPacket(p)) {
      const [c1, c2] = components(p);
      out.push(
        String.raw`f_1 = ${texNum(c1!.w / (2 * Math.PI))}\ \text{Hz} \quad f_2 = ${texNum(c2!.w / (2 * Math.PI))}\ \text{Hz} \quad f_{\text{bat}} = ${texNum(Math.abs(c2!.w - c1!.w) / (2 * Math.PI))}\ \text{Hz}`,
      );
    } else {
      const st = packetStats(p, s[T]!);
      out.push(String.raw`\sigma(t) = ${texNum(st.sigma)}\ \text{m} \qquad \text{repetição a cada } 2\pi/\Delta k = ${texNum((2 * Math.PI) / spacing(p))}\ \text{m}`);
    }
    return out;
  },

  params: [
    {
      key: "modo",
      label: "Superposição",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 0,
      options: [
        { value: 0, label: "Duas ondas (batimentos)" },
        { value: 1, label: "Pacote de N ondas" },
        { value: 2, label: "Duas ondas de mesma frequência (fasores)" },
      ],
    },
    {
      key: "disp",
      label: "Relação de dispersão",
      unit: "",
      min: 0,
      max: 2,
      step: 1,
      default: 0,
      options: DISP.map((label, value) => ({ value, label })),
    },
    { key: "lambda", label: "Comprimento de onda central λ₀", unit: "m", min: 0.5, max: 2, step: 0.05, default: 1 },
    { key: "A1", label: "Fasores: amplitude A₁", unit: "", min: 0.1, max: 2, step: 0.05, default: 1, live: true },
    { key: "A2", label: "Fasores: amplitude A₂", unit: "", min: 0, max: 2, step: 0.05, default: 0.7, live: true },
    { key: "phi", label: "Fasores: diferença de fase φ", unit: "°", min: 0, max: 360, step: 1, default: 60, live: true },
    { key: "dk", label: "Separação Δk/k₀ (duas ondas)", unit: "", min: 0.02, max: 0.4, step: 0.01, default: 0.15 },
    { key: "N", label: "Número de componentes (pacote)", unit: "", min: 3, max: 101, step: 2, default: 61 },
    { key: "sigma", label: "Largura inicial σ₀ (pacote)", unit: "m", min: 0.4, max: 2, step: 0.05, default: 0.6 },
    {
      key: "marcadores",
      label: "Marcadores de v_f e v_g",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 1,
      live: true,
      options: [
        { value: 1, label: "Mostrar" },
        { value: 0, label: "Esconder" },
      ],
    },
  ],

  observables: [
    { key: "Ares", label: "Fasores: amplitude resultante A′", unit: "", value: (_s, p) => phasorOf(p).A },
    { key: "beta", label: "Fasores: fase da resultante β", unit: "°", value: (_s, p) => (phasorOf(p).beta * 180) / Math.PI },
    { key: "xg", label: "Marcador de grupo x₀ + v_g t", unit: "m", value: (s, p) => X0 + velocities(p).vg * s[T]! },
    { key: "xf", label: "Marcador de fase x₀ + v_f t", unit: "m", value: (s, p) => X0 + velocities(p).vf * s[T]! },
    { key: "xc", label: "Centro medido do pacote", unit: "m", value: (s, p) => (isPacket(p) ? packetStats(p, s[T]!).xc : X0 + velocities(p).vg * s[T]!) },
    { key: "sigma", label: "Largura medida do pacote σ", unit: "m", value: (s, p) => (isPacket(p) ? packetStats(p, s[T]!).sigma : 0) },
    { key: "vf", label: "Velocidade de fase v_f", unit: "m/s", value: (_s, p) => velocities(p).vf },
    { key: "vg", label: "Velocidade de grupo v_g", unit: "m/s", value: (_s, p) => velocities(p).vg },
    {
      key: "fb",
      label: "Frequência de batimento",
      unit: "Hz",
      value: (_s, p) => {
        if (isPacket(p)) return 0;
        const [c1, c2] = components(p);
        return Math.abs(c2!.w - c1!.w) / (2 * Math.PI);
      },
    },
    { key: "yP", label: "y na sonda", unit: "", value: (s, p) => field(components(p), s[XP]!, s[T]!) },
    { key: "xs", label: "Posição da sonda", unit: "m", value: (s) => s[XP]! },
  ],
  chart: { x: "t", y: "yP" },

  scenarios: [
    {
      id: "fasores",
      label: "Fasores: somando duas ondas defasadas",
      params: { modo: 2, lambda: 2, A1: 1, A2: 0.7, phi: 60 },
      guide: `### A soma como uma soma de vetores girando
Duas ondas de mesmo $k$ e mesmo $\\omega$, $y_1 = A_1\\,\\mathrm{sen}(kx - \\omega t)$ e $y_2 = A_2\\,\\mathrm{sen}(kx - \\omega t + \\phi)$, somam-se numa onda do mesmo tipo, $y' = A'\\,\\mathrm{sen}(kx - \\omega t + \\beta)$.
1. À direita, cada onda é um **fasor**: uma seta de comprimento igual à amplitude, girando com $\\omega$. A projeção vertical da seta é o deslocamento da corda no ponto marcado ($x = 0$).
2. O fasor 2 está sempre $\\phi$ à frente do fasor 1. Coloque-o com a cauda na cabeça do 1: a seta da origem até a ponta é a **resultante**, de comprimento $A'$ e fase $\\beta$.
3. Rode: os três fasores giram juntos, sem mudar de forma. Por isso a soma também é senoidal, com amplitude constante.
4. Faça $\\phi = 0$ ($A' = A_1 + A_2$) e $\\phi = 180°$ ($A' = |A_1 - A_2|$). Com $A_1 = A_2$ e $\\phi = 180°$, as ondas se anulam.
5. Confira $A'$ e $\\beta$ pela lei dos cossenos nas equações ao vivo.`,
      predict: [
        {
          question: "Duas ondas com amplitudes 1,0 e 0,7, defasadas de 90°, somam-se. A amplitude resultante é:",
          options: ["1,7", "0,3", "cerca de 1,22", "0,85"],
          answer: 2,
          explanation: "Com $\\phi = 90°$ os fasores são perpendiculares: $A' = \\sqrt{1{,}0^2 + 0{,}7^2} \\approx 1{,}22$. Só com $\\phi = 0$ as amplitudes se somam diretamente.",
        },
      ],
    },
    {
      id: "batimentos",
      label: "Batimentos de duas ondas",
      params: { modo: 0, disp: 0, lambda: 1, dk: 0.15 },
      guide: `### Duas ondas quase iguais
1. A soma é uma onda rápida (média de $k$ e $\\omega$) modulada por uma envoltória lenta.
2. O gráfico mostra $y$ na **sonda** (linha tracejada). Arraste a sonda: em qualquer ponto a amplitude pulsa.
3. Meça o intervalo entre dois silêncios e compare com $1/f_{\\text{bat}} = 1/|f_1 - f_2|$.
4. Diminua $\\Delta k/k_0$: os batimentos ficam mais lentos.`,
      predict: [
        {
          question: "Com duas frequências próximas f₁ e f₂, a intensidade num ponto fixo pulsa com frequência:",
          options: ["f₁ + f₂", "(f₁ + f₂)/2", "|f₁ − f₂|"],
          answer: 2,
          explanation: "A envoltória é $\\cos(\\Delta\\omega\\,t/2)$, mas a intensidade depende do seu quadrado, que repete duas vezes por período: $f_{\\text{bat}} = |f_1 - f_2|$.",
        },
      ],
    },
    {
      id: "aguas",
      label: "Pacote em águas profundas",
      params: { modo: 1, disp: 1, lambda: 1, N: 61, sigma: 0.6 },
      guide: `### Cristas mais rápidas que o pacote
1. Em águas profundas $\\omega = \\sqrt{gk}$, então $v_g = \\tfrac12 v_f$.
2. Siga o ponto vermelho (uma crista, velocidade $v_f$): ele nasce na traseira do pacote, atravessa e some na frente.
3. O triângulo verde anda com $v_g$ e acompanha o centro do pacote.
4. No gráfico $\\omega(k)$, $v_f$ é a inclinação da reta até a origem e $v_g$ é a inclinação da tangente.`,
      predict: [
        {
          question: "Num pacote de ondas em águas profundas, as cristas individuais:",
          options: ["andam junto com o pacote", "andam mais rápido que o pacote, nascendo atrás e sumindo na frente", "andam mais devagar que o pacote"],
          answer: 1,
          explanation: "Com $\\omega = \\sqrt{gk}$, $v_f = \\sqrt{g/k}$ e $v_g = \\tfrac12\\sqrt{g/k}$: as cristas são duas vezes mais rápidas que o grupo.",
        },
      ],
    },
    {
      id: "schrodinger",
      label: "Pacote tipo Schrödinger",
      params: { modo: 1, disp: 2, lambda: 1, N: 81, sigma: 0.6 },
      guide: `### Partícula livre: o pacote se espalha
1. Com $\\omega \\propto k^2$ (partícula livre em mecânica quântica), $v_g = 2v_f$: o pacote anda mais rápido que as cristas.
2. É $v_g$, e não $v_f$, que corresponde à velocidade clássica da partícula, $p/m$.
3. Plote **Largura medida do pacote**: ela cresce como $\\sigma_0\\sqrt{1 + (\\alpha t/\\sigma_0^2)^2}$, com $\\alpha = \\omega_0/k_0^2$.
4. Diminua $\\sigma_0$: o pacote começa mais estreito e se espalha **mais depressa** (incerteza em $k$ maior).`,
      predict: [
        {
          question: "Um pacote inicialmente mais estreito, com ω ∝ k², se espalha:",
          options: ["mais devagar", "mais depressa", "no mesmo ritmo"],
          answer: 1,
          explanation: "Um pacote estreito precisa de uma faixa larga de $k$. Como cada $k$ tem velocidade de grupo diferente ($2\\alpha k$), as componentes se separam mais depressa.",
        },
      ],
    },
    {
      id: "nao-dispersivo",
      label: "Sem dispersão e poucas componentes",
      params: { modo: 1, disp: 0, lambda: 1, N: 9, sigma: 0.6 },
      guide: `### Forma preservada e réplicas
1. Com $\\omega = ck$ todas as componentes têm a mesma velocidade: o pacote anda sem mudar de forma e $v_f = v_g$.
2. Com só 9 componentes igualmente espaçadas, a soma é periódica: o pacote se repete a cada $2\\pi/\\Delta k$.
3. Aumente $N$ e veja as réplicas se afastarem até sair da tela.`,
    },
  ],

  exercises: [
    {
      id: "aguas-vg",
      prompt: "Ondas em águas profundas têm comprimento de onda de {lambda} m. Qual é a velocidade de grupo (g = 9,81 m/s²)?",
      vary: { lambda: [0.5, 50, 1] },
      fixed: { modo: 1, disp: 1 },
      answer: { label: "v_g", unit: "m/s", compute: (p) => 0.5 * Math.sqrt((G * num(p, "lambda", 1)) / (2 * Math.PI)) },
      hint: "ω = √(gk) ⇒ v_g = dω/dk = ½√(g/k), com k = 2π/λ.",
    },
    {
      id: "batimento",
      prompt: "Dois diapasões vibram com {f1} Hz e {f2} Hz. Qual é o intervalo de tempo entre dois máximos sucessivos de intensidade?",
      vary: { f1: [436, 439.5, 1], f2: [440.5, 446, 1] },
      fixed: { modo: 0 },
      answer: { label: "T_bat", unit: "s", compute: (p) => 1 / Math.abs(num(p, "f2") - num(p, "f1")) },
      hint: "f_bat = |f₁ − f₂|.",
    },
  ],

  init: () => [0, 12],
  derivatives: () => [1, 0],
  dt: 0.005,
  sampleEvery: 4,
  maxSamples: 20000,
  tEnd: 60,
  stopWhen(s, p) {
    // O pacote para quando o grupo chega ao fim da tela.
    return isPacket(p) ? DOM.x1 - 1 - (X0 + velocities(p).vg * s[T]!) : 1;
  },

  pointer: {
    down(s, _p, pt) {
      if (pt.y < WV.yc - WV.amp - 0.4 || pt.y > WV.yc + WV.amp + 0.6) return undefined;
      return [s[T]!, Math.max(DOM.x0, Math.min(DOM.x1, pt.x))];
    },
    move(s, _p, pt, dragging) {
      if (!dragging || pt.y < WV.yc - WV.amp - 1 || pt.y > WV.yc + WV.amp + 1) return undefined;
      return [s[T]!, Math.max(DOM.x0, Math.min(DOM.x1, pt.x))];
    },
    cursor(s, _p, pt) {
      if (pt.y < WV.yc - WV.amp - 0.4 || pt.y > WV.yc + WV.amp + 0.6) return undefined;
      return Math.abs(pt.x - s[XP]!) < 0.4 ? "ew-resize" : "pointer";
    },
  },

  viewport: () => ({ xMin: -0.9, xMax: 21.6, yMin: -5.1, yMax: 5.5, unit: "" }),

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const { state: s, params: p, theme } = frame;
    const t = s[T]!;
    if (isPhasor(p)) {
      renderPhasors(d, p, t, theme);
      return;
    }
    const cs = components(p);
    const packet = isPacket(p);
    const { vf, vg } = velocities(p);
    const k0 = k0Of(p);
    const phaseC = theme.positive, groupC = theme.series[2]!;

    // ---- Painel da onda ----
    const Y = (y: number) => WV.yc + WV.amp * y;
    d.line(DOM.x0, WV.yc, DOM.x1, WV.yc, { color: theme.grid });
    for (let x = DOM.x0; x <= DOM.x1 + 1e-9; x += 2) {
      d.line(x, WV.yc - WV.amp - 0.25, x, WV.yc - WV.amp - 0.1, { color: theme.muted, width: 1 });
      d.text(`${x}`, x, WV.yc - WV.amp - 0.45, { color: theme.muted, size: 10 });
    }
    d.text("x (m)", DOM.x1 + 0.4, WV.yc - WV.amp - 0.45, { color: theme.muted, size: 10, align: "left" });
    const n = 900;
    const wave: [number, number][] = [];
    const envU: [number, number][] = [];
    const envL: [number, number][] = [];
    for (let i = 0; i <= n; i++) {
      const x = DOM.x0 + ((DOM.x1 - DOM.x0) * i) / n;
      wave.push([x, Y(field(cs, x, t))]);
      const e = envelope(cs, x, t);
      envU.push([x, Y(e)]);
      envL.push([x, Y(-e)]);
    }
    d.polyline(envU, { color: theme.muted, dash: [5, 4], width: 1.2 });
    d.polyline(envL, { color: theme.muted, dash: [5, 4], width: 1.2 });
    d.polyline(wave, { color: theme.accent, width: 2 });

    // Sonda arrastável
    const xs = s[XP]!;
    d.line(xs, Y(-1.05), xs, Y(1.12), { color: theme.series[4]!, dash: [3, 3], width: 1.5 });
    d.dot(xs, Y(field(cs, xs, t)), 5, theme.series[4]!);
    d.text("sonda", xs, Y(1.12) + 0.25, { color: theme.series[4]!, size: 10 });

    if (num(p, "marcadores", 1) > 0.5) {
      // Grupo: máximos da envoltória que caem na tela
      const Lg = (2 * Math.PI) / spacing(p);
      const xg = X0 + vg * t;
      const firstN = Math.ceil((DOM.x0 - xg) / Lg);
      for (let m = firstN; xg + m * Lg <= DOM.x1 && m < firstN + 40; m++) {
        const x = xg + m * Lg;
        const e = envelope(cs, x, t);
        d.polyline([[x, Y(e) + 0.12], [x - 0.18, Y(e) + 0.45], [x + 0.18, Y(e) + 0.45]], { close: true, fill: groupC, color: groupC, width: 1 });
      }
      // Fase: uma crista da onda central, seguida e trazida de volta por múltiplos de λ para ficar no grupo
      const lam = packet ? (2 * Math.PI) / k0 : (2 * Math.PI) / ((cs[0]!.k + cs[1]!.k) / 2);
      const width = packet ? Math.max(packetStats(p, t).sigma * 2.5, 2 * lam) : Math.min(Lg, DOM.x1 - DOM.x0);
      const Lw = lam * Math.max(1, Math.floor(width / lam));
      const raw = X0 + vf * t;
      const base = packet ? xg - Lw / 2 : DOM.x0;
      const xf = base + mod(raw - base, Lw);
      if (xf >= DOM.x0 && xf <= DOM.x1) d.dot(xf, Y(field(cs, xf, t)), 6, phaseC);
    }

    // Legenda
    const ly = WV.yc + WV.amp + 0.95;
    d.text(packet ? `pacote de ${cs.length} ondas · ${DISP[Math.round(num(p, "disp"))]}` : `duas ondas · ${DISP[Math.round(num(p, "disp"))]}`, DOM.x0, ly, {
      color: theme.text,
      size: 12,
      weight: "600",
      align: "left",
    });
    if (num(p, "marcadores", 1) > 0.5) {
      d.dot(DOM.x1 - 7.4, ly, 5, phaseC);
      d.text(`crista: v_f = ${fmt(vf)} m/s`, DOM.x1 - 7.1, ly, { color: phaseC, size: 11, align: "left" });
      d.polyline([[DOM.x1 - 3.5, ly - 0.14], [DOM.x1 - 3.68, ly + 0.18], [DOM.x1 - 3.32, ly + 0.18]], { close: true, fill: groupC, color: groupC, width: 1 });
      d.text(`grupo: v_g = ${fmt(vg)} m/s`, DOM.x1 - 3.1, ly, { color: groupC, size: 11, align: "left" });
    }

    // ---- Relação de dispersão ω(k) ----
    const kMax = 2 * k0;
    let wMax = 0;
    for (let i = 0; i <= 50; i++) wMax = Math.max(wMax, omegaOf(p, (kMax * i) / 50));
    const kx = (k: number) => DP.x0 + (k / kMax) * (DP.x1 - DP.x0);
    const wy = (w: number) => DP.y0 + (w / (1.6 * wMax)) * (DP.y1 - DP.y0);
    d.arrow(DP.x0, DP.y0, DP.x1 - DP.x0 + 0.3, 0, { color: theme.muted, width: 1.2, head: 7 });
    d.arrow(DP.x0, DP.y0, 0, DP.y1 - DP.y0 + 0.3, { color: theme.muted, width: 1.2, head: 7 });
    d.text("ω(k)", DP.x0 + 0.2, DP.y1 + 0.25, { color: theme.text, size: 11, align: "left", weight: "600" });
    d.text("k", DP.x1 + 0.45, DP.y0, { color: theme.muted, size: 11 });
    d.line(kx(k0), DP.y0 - 0.1, kx(k0), DP.y0 + 0.1, { color: theme.muted });
    d.text("k₀", kx(k0), DP.y0 - 0.35, { color: theme.muted, size: 10 });
    // Espectro: barras com o peso de cada componente
    const aMax = Math.max(...cs.map((c) => c.a));
    for (const c of cs) {
      if (c.k > kMax) continue;
      d.line(kx(c.k), DP.y0, kx(c.k), DP.y0 + 0.6 * (c.a / aMax), { color: theme.accent, width: packet ? 1.5 : 3, alpha: 0.55 });
    }
    d.plot((xx) => wy(omegaOf(p, ((xx - DP.x0) / (DP.x1 - DP.x0)) * kMax)), DP.x0, DP.x1, { color: theme.text, width: 2 });
    // v_f: reta da origem ao ponto (k₀, ω₀); v_g: tangente no ponto
    const kc = packet ? k0 : (cs[0]!.k + cs[1]!.k) / 2;
    const wc = packet ? omegaOf(p, k0) : (cs[0]!.w + cs[1]!.w) / 2;
    const fr = Math.min(1.6, kMax / kc, (1.55 * wMax) / wc);
    d.line(kx(0), wy(0), kx(fr * kc), wy(fr * wc), { color: phaseC, width: 1.5 });
    const dk = 0.45 * k0;
    d.line(kx(kc - dk), wy(wc - vg * dk), kx(kc + dk), wy(wc + vg * dk), { color: groupC, width: 1.8 });
    d.dot(kx(kc), wy(wc), 5, theme.text);
    d.text("reta até a origem: inclinação v_f", DP.x0 + 0.3, DP.y1 - 0.2, { color: phaseC, size: 10, align: "left" });
    d.text("tangente: inclinação v_g", DP.x0 + 0.3, DP.y1 - 0.55, { color: groupC, size: 10, align: "left" });
    d.text("barras: espectro (peso de cada k)", DP.x0 + 0.3, DP.y1 - 0.9, { color: theme.accent, size: 10, align: "left" });

    // ---- y na sonda ao longo do tempo ----
    const Tw = packet ? 12 : Math.min(30, Math.max(8, 2.2 / Math.max(1e-6, Math.abs(cs[1]!.w - cs[0]!.w) / (2 * Math.PI))));
    const t0 = Math.max(0, t - Tw);
    const tx = (tt: number) => TP.x0 + ((tt - t0) / Tw) * (TP.x1 - TP.x0);
    const yc = (TP.y0 + TP.y1) / 2, yh = (TP.y1 - TP.y0) / 2 / 1.1;
    d.rect(TP.x0, TP.y0, TP.x1 - TP.x0, TP.y1 - TP.y0, { stroke: theme.grid, width: 1 });
    d.line(TP.x0, yc, TP.x1, yc, { color: theme.grid });
    d.text("y na sonda × t", TP.x0 + 0.15, TP.y1 - 0.15, { color: theme.series[4]!, size: 11, align: "left", baseline: "top", weight: "600" });
    d.text(`janela: ${fmt(Tw, 2)} s`, TP.x1 - 0.15, TP.y0 + 0.15, { color: theme.muted, size: 10, align: "right", baseline: "bottom" });
    const nT = 600;
    const tr: [number, number][] = [];
    for (let i = 0; i <= nT; i++) {
      const tt = t0 + ((t - t0) * i) / nT;
      tr.push([tx(tt), yc + yh * field(cs, xs, tt)]);
    }
    d.polyline(tr, { color: theme.series[4]!, width: 1.5 });
    if (!packet) {
      const fb = Math.abs(cs[1]!.w - cs[0]!.w) / (2 * Math.PI);
      d.text(`f_bat = ${fmt(fb)} Hz  (T_bat = ${fmt(1 / fb)} s)`, TP.x1 - 0.15, TP.y1 - 0.15, { color: theme.text, size: 10, align: "right", baseline: "top" });
    }
  },
});

export default superposicao;
