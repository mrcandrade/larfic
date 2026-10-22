import { defineSim, draw, num, texNum, type Params } from "@fisilab/core";

/** Número de modos usados na série de Fourier. */
export const NM = 80;
/** Número de pontos do perfil desenhado (M intervalos). */
export const M = 100;
/** Barras mostradas no espectro. */
const NS = 16;

/** Linha de repouso da corda e escala vertical no palco. */
const YS = 0.55;
const AMP = 0.28;
/** Base e altura do espectro. */
const SB = -0.5;
const SH = 0.38;

export const MODO = { dedilhada: 0, desenho: 1, modo: 2, dois: 3 } as const;

export interface Corda {
  /** Tempo físico (s) desde que a corda foi solta. */
  tau: number;
  /** Coeficientes bₙ (m) da série de senos, n = 1..NM (índice n−1). */
  b: number[];
  /** Perfil inicial y₀(xᵢ) (m) em M+1 pontos igualmente espaçados (modos dedilhada e desenho). */
  shape: number[];
  /** Ponto do dedilhado (fração de L) e altura (m). */
  xp: number;
  hp: number;
  /** Enquanto o aluno segura a corda, o tempo não corre. */
  held: boolean;
  /** Último índice pintado (para ligar pontos ao arrastar rápido). */
  last: number;
}

export const speed = (p: Params) => Math.sqrt(num(p, "T", 40) / (num(p, "mu", 4) * 1e-3));
export const freq = (p: Params, n: number) => (n * speed(p)) / (2 * num(p, "L", 1));
const gammaN = (p: Params, n: number) => num(p, "gamma") * n;

/**
 * bₙ = (2/L) ∫₀ᴸ y₀(x) sen(nπx/L) dx calculado exatamente para um perfil
 * linear por partes (pontos igualmente espaçados em [0, L]).
 */
export function sineCoefficients(shape: readonly number[], L: number, nModes = NM): number[] {
  const m = shape.length - 1;
  const dx = L / m;
  const out: number[] = [];
  for (let n = 1; n <= nModes; n++) {
    const k = (n * Math.PI) / L;
    let I = 0;
    for (let i = 0; i < m; i++) {
      const xa = i * dx;
      const xb = xa + dx;
      const ya = shape[i]!;
      const s = (shape[i + 1]! - ya) / dx;
      // ∫ (ya + s(x−xa)) sen(kx) dx = −(ya + s(x−xa)) cos(kx)/k + s sen(kx)/k²
      const F = (x: number) => (-(ya + s * (x - xa)) * Math.cos(k * x)) / k + (s * Math.sin(k * x)) / (k * k);
      I += F(xb) - F(xa);
    }
    out.push((2 / L) * I);
  }
  return out;
}

/** Coeficientes analíticos da corda dedilhada no ponto a com altura h. */
export function pluckCoefficient(n: number, a: number, h: number, L: number): number {
  return ((2 * h * L * L) / (n * n * Math.PI * Math.PI * a * (L - a))) * Math.sin((n * Math.PI * a) / L);
}

function triangle(xp: number, hp: number): number[] {
  return Array.from({ length: M + 1 }, (_, i) => {
    const u = i / M;
    return u <= xp ? (hp * u) / xp : (hp * (1 - u)) / (1 - xp);
  });
}

function coefsFor(p: Params, s: Pick<Corda, "shape" | "xp" | "hp">): number[] {
  const L = num(p, "L", 1);
  const h = num(p, "h", 5) * 1e-3;
  const modo = Math.round(num(p, "modo"));
  const n = Math.round(num(p, "n", 3));
  if (modo === MODO.modo || modo === MODO.dois) {
    const b = new Array<number>(NM).fill(0);
    if (modo === MODO.dois) {
      b[0] = 0.7 * h;
      b[n - 1] = (b[n - 1] ?? 0) + 0.35 * h;
    } else b[n - 1] = h;
    return b;
  }
  if (modo === MODO.dedilhada) return Array.from({ length: NM }, (_, i) => pluckCoefficient(i + 1, s.xp * L, s.hp, L));
  return sineCoefficients(s.shape, L);
}

/** Amplitude modal no tempo τ: (bₙ cos ωₙτ, derivada temporal), com amortecimento e^(−γₙτ). */
function modal(p: Params, s: Corda, n: number): [number, number] {
  const b = s.b[n - 1] ?? 0;
  if (b === 0) return [0, 0];
  const w = 2 * Math.PI * freq(p, n);
  const g = gammaN(p, n);
  const e = Math.exp(-g * s.tau);
  const c = Math.cos(w * s.tau);
  const sn = Math.sin(w * s.tau);
  return [b * c * e, b * e * (-w * sn - g * c)];
}

/** Deslocamento y(x, τ) pela série de Fourier. */
export function displacement(s: Corda, p: Params, x: number): number {
  const L = num(p, "L", 1);
  const th = (Math.PI * x) / L;
  const c2 = 2 * Math.cos(th);
  let s0 = 0;
  let s1 = Math.sin(th);
  let y = 0;
  for (let n = 1; n <= NM; n++) {
    y += modal(p, s, n)[0] * s1;
    const s2 = c2 * s1 - s0;
    s0 = s1;
    s1 = s2;
  }
  return y;
}

/** Energia de cada modo: (μL/4)(q̇ₙ² + ωₙ² qₙ²). */
export function modeEnergies(s: Corda, p: Params): number[] {
  const mu = num(p, "mu", 4) * 1e-3;
  const L = num(p, "L", 1);
  return Array.from({ length: NM }, (_, i) => {
    const [q, qd] = modal(p, s, i + 1);
    const w = 2 * Math.PI * freq(p, i + 1);
    return ((mu * L) / 4) * (qd * qd + w * w * q * q);
  });
}
export const energy = (s: Corda, p: Params) => modeEnergies(s, p).reduce((a, b) => a + b, 0);

function release(s: Corda, p: Params): Corda {
  return { ...s, b: coefsFor(p, s), tau: 0 };
}

const NOMES_MODO = ["dedilhada", "desenho livre", "modo normal", "dois modos"];

export const ondasEstacionarias = defineSim<Corda>({
  id: "ondas-estacionarias",
  title: "Ondas estacionárias e harmônicos",
  course: "FG II",
  topic: "Ondas",
  priority: "P1",
  summary:
    "Dedilhe a corda em qualquer ponto ou desenhe sua forma inicial com o mouse e veja a série de Fourier: o espectro de harmônicos fₙ = n·v/2L, os nós, os ventres e o timbre que muda com o ponto do dedilhado.",
  equations: [
    String.raw`y(x,t) = \sum_{n=1}^{\infty} b_n \,\operatorname{sen}\!\left(\frac{n\pi x}{L}\right) \cos(\omega_n t) \qquad \omega_n = 2\pi f_n`,
    String.raw`f_n = \frac{n\,v}{2L} \qquad v = \sqrt{\frac{T}{\mu}} \qquad \lambda_n = \frac{2L}{n}`,
    String.raw`b_n = \frac{2}{L}\int_0^L y_0(x)\,\operatorname{sen}\!\left(\frac{n\pi x}{L}\right)dx \qquad \text{dedilhada em } a:\; b_n = \frac{2hL^2}{n^2\pi^2 a(L-a)}\operatorname{sen}\frac{n\pi a}{L}`,
  ],
  liveEquations(s, p) {
    const v = speed(p);
    const E = modeEnergies(s, p);
    const Et = E.reduce((a, b) => a + b, 0) || 1;
    return [
      String.raw`v = ${texNum(v)}\ \text{m/s} \qquad f_1 = ${texNum(freq(p, 1))}\ \text{Hz} \qquad f_2 = ${texNum(freq(p, 2))}\ \text{Hz} \qquad f_3 = ${texNum(freq(p, 3))}\ \text{Hz}`,
      String.raw`b_1 = ${texNum((s.b[0] ?? 0) * 1e3)}\ \text{mm} \quad b_2 = ${texNum((s.b[1] ?? 0) * 1e3)}\ \text{mm} \quad b_3 = ${texNum((s.b[2] ?? 0) * 1e3)}\ \text{mm} \qquad E_1/E = ${texNum(((E[0] ?? 0) / Et) * 100)}\%`,
    ];
  },

  params: [
    {
      key: "modo", label: "Condição inicial", unit: "", min: 0, max: 3, step: 1, default: 0,
      options: [
        { value: MODO.dedilhada, label: "Dedilhada (arraste o ponto)" },
        { value: MODO.desenho, label: "Desenho livre com o mouse" },
        { value: MODO.modo, label: "Um modo normal" },
        { value: MODO.dois, label: "Fundamental + modo n" },
      ],
    },
    { key: "xp", label: "Ponto do dedilhado (fração de L)", unit: "", min: 0.05, max: 0.95, step: 0.01, default: 0.2 },
    { key: "n", label: "Modo n (modos normais)", unit: "", min: 1, max: 10, step: 1, default: 3 },
    { key: "h", label: "Amplitude inicial", unit: "mm", min: 1, max: 20, step: 0.5, default: 5 },
    { key: "L", label: "Comprimento da corda", unit: "m", min: 0.3, max: 2, step: 0.01, default: 1 },
    { key: "T", label: "Tensão", unit: "N", min: 5, max: 200, step: 1, default: 40 },
    { key: "mu", label: "Densidade linear", unit: "g/m", min: 0.5, max: 20, step: 0.1, default: 4 },
    { key: "gamma", label: "Amortecimento (γₙ = γ·n)", unit: "1/s", min: 0, max: 20, step: 0.5, default: 0 },
    {
      key: "lento", label: "Câmera lenta", unit: "", min: 0.0001, max: 1, step: 0.0001, default: 0.01, live: true,
      options: [
        { value: 1, label: "Tempo real" },
        { value: 0.1, label: "10× mais lento" },
        { value: 0.01, label: "100× mais lento" },
        { value: 0.001, label: "1000× mais lento" },
      ],
    },
    {
      key: "comp", label: "Mostrar componentes", unit: "", min: 0, max: 1, step: 1, default: 0, live: true,
      options: [
        { value: 0, label: "Não" },
        { value: 1, label: "Sim (4 primeiros harmônicos)" },
      ],
    },
  ],

  observables: [
    { key: "tf", label: "Tempo físico", unit: "s", value: (s) => s.tau },
    { key: "ymeio", label: "Deslocamento no meio da corda", unit: "m", value: (s, p) => displacement(s, p, num(p, "L", 1) / 2) },
    { key: "yq", label: "Deslocamento a L/4", unit: "m", value: (s, p) => displacement(s, p, num(p, "L", 1) / 4) },
    { key: "f1", label: "Frequência fundamental", unit: "Hz", value: (_s, p) => freq(p, 1) },
    { key: "E", label: "Energia de vibração", unit: "J", value: (s, p) => energy(s, p) },
    {
      key: "E1",
      label: "Fração da energia no fundamental",
      unit: "",
      value: (s, p) => {
        const E = modeEnergies(s, p);
        const t = E.reduce((a, b) => a + b, 0);
        return t > 0 ? (E[0] ?? 0) / t : 0;
      },
    },
  ],
  conserved: "E",
  chart: { x: "tf", y: "ymeio" },

  scenarios: [
    {
      id: "meio",
      label: "Dedilhada no meio",
      params: { modo: MODO.dedilhada, xp: 0.5 },
      guide: `### Dedilhando no meio da corda
1. A corda começa como um triângulo com o vértice em $x = L/2$. Veja o espectro: quais barras são **zero**?
2. Os harmônicos pares têm um **nó** em $L/2$; quem puxa a corda justamente ali não consegue excitá-los ($\\operatorname{sen}(n\\pi/2) = 0$ para $n$ par).
3. Ligue "Mostrar componentes" e veja a soma dos senos reconstruindo o triângulo.
4. Confira no gráfico que o movimento do meio da corda se repete com período $T_1 = 1/f_1 = 2L/v$.`,
      predict: [
        {
          question: "Ao dedilhar exatamente no meio da corda, quais harmônicos ficam ausentes?",
          options: ["Os ímpares (1, 3, 5...)", "Os pares (2, 4, 6...)", "Nenhum: todos aparecem"],
          answer: 1,
          explanation: "Os modos pares têm nó no meio da corda. Como $b_n \\propto \\operatorname{sen}(n\\pi a/L)$ com $a = L/2$, eles valem zero.",
        },
      ],
    },
    {
      id: "ponte",
      label: "Perto da ponte: timbre brilhante",
      params: { modo: MODO.dedilhada, xp: 0.08, gamma: 2 },
      guide: `### Timbre e ponto do dedilhado
1. Dedilhando perto da ponta ($a = 0{,}08L$), o espectro tem muitos harmônicos altos com amplitude apreciável: o som fica **metálico**.
2. Arraste o ponto do dedilhado no palco até o meio e compare: o fundamental domina e o som fica **macio**.
3. Com amortecimento, os harmônicos altos ($\\gamma_n = \\gamma n$) morrem antes. Observe a forma da corda ficar cada vez mais parecida com uma senoide.
4. Qual ponto zera o 3º harmônico? Teste $a = L/3$.`,
    },
    {
      id: "modo",
      label: "Modo normal: nós e ventres",
      params: { modo: MODO.modo, n: 3 },
      guide: `### Um único modo normal
1. A corda começa no formato do 3º harmônico. Todos os pontos oscilam **em fase** (ou em oposição) com a mesma frequência $f_3 = 3v/2L$.
2. Conte os **nós** (N, pontos sempre parados) e os **ventres** (V, amplitude máxima). Quantos de cada para o modo $n$?
3. A distância entre nós vizinhos é $\\lambda/2 = L/n$.
4. Mude a tensão: $f_n$ cresce com $\\sqrt{T}$, mas a forma do modo não muda.`,
      predict: [
        {
          question: "Quantos nós (contando as pontas) tem o 3º harmônico de uma corda presa nas duas pontas?",
          options: ["3", "4", "6"],
          answer: 1,
          explanation: "O modo $n$ tem $n$ ventres e $n + 1$ nós, incluindo as duas pontas presas. Para $n = 3$: 4 nós.",
        },
      ],
    },
    {
      id: "desenho",
      label: "Desenhe a corda",
      params: { modo: MODO.desenho },
      guide: `### Qualquer forma é uma soma de senos
1. Clique e arraste sobre a corda para desenhar a forma inicial. Enquanto você segura, a corda fica parada.
2. Solte e rode: cada harmônico oscila com sua própria frequência $f_n$, e a forma muda, mas volta a ser a mesma depois de $T_1 = 2L/v$.
3. Desenhe um degrau abrupto: veja quantos harmônicos o espectro precisa (e as "orelhas" do fenômeno de Gibbs).
4. Desenhe algo parecido com $\\operatorname{sen}(2\\pi x/L)$ e confira que quase toda a energia vai para $n = 2$.`,
    },
  ],

  exercises: [
    {
      id: "harmonico",
      prompt: "Uma corda de {L} m, presa nas duas pontas, tem densidade linear de {mu} g/m e está sob tensão de {T} N. Qual a frequência do {n}º harmônico?",
      vary: { L: [0.4, 1.5, 2], mu: [1, 10, 1], T: [20, 150, 0], n: [1, 6, 0] },
      answer: { label: "fₙ", unit: "Hz", compute: (p) => freq(p, Math.round(num(p, "n", 1))) },
      hint: "v = √(T/μ) com μ em kg/m; fₙ = n·v/(2L).",
    },
    {
      id: "afinar",
      prompt: "Uma corda de violão tem {L} m entre os apoios e densidade de {mu} g/m. Que tensão a deixa afinada com fundamental de {f1} Hz?",
      vary: { L: [0.55, 0.7, 3], mu: [0.4, 6, 1], f1: [80, 400, 0] },
      answer: {
        label: "T",
        unit: "N",
        compute: (p) => num(p, "mu") * 1e-3 * (2 * num(p, "L") * num(p, "f1")) ** 2,
      },
      hint: "Isole T em f₁ = (1/2L)·√(T/μ).",
    },
  ],

  init(p) {
    const modo = Math.round(num(p, "modo"));
    const h = num(p, "h", 5) * 1e-3;
    const xp = num(p, "xp", 0.2);
    const shape = modo === MODO.desenho
      ? Array.from({ length: M + 1 }, (_, i) => h * Math.sin((Math.PI * i) / M))
      : triangle(xp, h);
    const s: Corda = { tau: 0, b: [], shape, xp, hp: h, held: false, last: -1 };
    return { ...s, b: coefsFor(p, s) };
  },
  step(s, p, _t, dt) {
    if (s.held) return s;
    return { ...s, tau: s.tau + dt * num(p, "lento", 0.01) };
  },
  dt: 1e-3,
  sampleEvery: 10,
  maxSamples: 5000,

  pointer: {
    down(s, p, pt) {
      const modo = Math.round(num(p, "modo"));
      const u = pt.x;
      if (u < 0 || u > 1 || pt.y < YS - 0.32 || pt.y > YS + 0.32) return undefined;
      return grab({ ...s, last: -1 }, p, pt.x, pt.y, modo);
    },
    move(s, p, pt, dragging) {
      if (!dragging || !s.held) return undefined;
      return grab(s, p, pt.x, pt.y, Math.round(num(p, "modo")));
    },
    up: (s, p) => (s.held ? { ...release(s, p), held: false, last: -1 } : undefined),
    cursor(_s, p, pt) {
      const modo = Math.round(num(p, "modo"));
      if (modo > MODO.desenho) return undefined;
      return pt.x >= 0 && pt.x <= 1 && Math.abs(pt.y - YS) < 0.32 ? (modo === MODO.desenho ? "crosshair" : "grab") : undefined;
    },
  },
  actions: [
    {
      id: "soltar",
      label: "Recomeçar da forma inicial",
      run: (s, p) => release(s, p),
    },
  ],

  viewport: () => ({ xMin: -0.08, xMax: 1.08, yMin: -0.62, yMax: 1.0 }),

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const { state: s, params: p, theme } = frame;
    const L = num(p, "L", 1);
    const h = num(p, "h", 5) * 1e-3;
    const modo = Math.round(num(p, "modo"));
    const ref = h;
    const Y = (y: number) => YS + (y / ref) * AMP;

    // Apoios e eixo de repouso
    d.line(0, YS, 1, YS, { color: theme.grid, width: 1 });
    d.support(0, YS - 0.2, 0, YS + 0.2, { color: theme.text });
    d.support(1, YS + 0.2, 1, YS - 0.2, { color: theme.text });
    for (let k = 0; k <= 4; k++) d.text(`${((k * L) / 4).toFixed(2).replace(".", ",")} m`, k / 4, YS - AMP - 0.08, { color: theme.muted, size: 10 });

    // Envoltória do modo normal: nós e ventres
    if (modo === MODO.modo) {
      const n = Math.round(num(p, "n", 3));
      const A = s.b[n - 1] ?? 0;
      const env = (sg: number) => (u: number) => Y(sg * A * Math.exp(-gammaN(p, n) * s.tau) * Math.sin(n * Math.PI * u));
      d.plot(env(1), 0, 1, { color: theme.muted, dash: [4, 4], width: 1 });
      d.plot(env(-1), 0, 1, { color: theme.muted, dash: [4, 4], width: 1 });
      for (let k = 0; k <= n; k++) {
        d.dot(k / n, YS, 4, theme.negative);
        d.text("N", k / n, YS, { color: theme.negative, size: 10, dy: 12, weight: "600" });
      }
      for (let k = 0; k < n; k++) d.text("V", (k + 0.5) / n, Y(Math.abs(A)), { color: theme.positive, size: 10, dy: -10, weight: "600" });
    }

    // Componentes (4 primeiros harmônicos)
    if (Math.round(num(p, "comp")) === 1) {
      for (let n = 1; n <= 4; n++) {
        const q = modal(p, s, n)[0];
        if (Math.abs(q) < 1e-9) continue;
        d.plot((u) => Y(q * Math.sin(n * Math.PI * u)), 0, 1, { color: theme.series[(n + 1) % theme.series.length], width: 1.2, alpha: 0.8 });
      }
    }

    // Forma desenhada (referência) e corda
    if (modo <= MODO.desenho && (s.held || s.tau === 0)) {
      d.polyline(s.shape.map((y, i) => [i / M, Y(y)] as [number, number]), { color: theme.muted, width: 1, dash: [3, 3] });
    }
    const pts: [number, number][] = [];
    for (let i = 0; i <= 240; i++) {
      const u = i / 240;
      pts.push([u, Y(displacement(s, p, u * L))]);
    }
    d.polyline(pts, { color: theme.accent, width: 2.5 });
    if (modo === MODO.dedilhada) {
      d.dot(s.xp, Y(displacement(s, p, s.xp * L)), 5, theme.series[1] ?? theme.accent);
      if (s.tau === 0) d.text("arraste para dedilhar", s.xp, Y(s.hp), { color: theme.muted, size: 10, dy: -14 });
    }
    if (modo === MODO.desenho && s.tau === 0 && !s.held) d.text("clique e arraste para desenhar a corda", 0.5, YS + AMP + 0.12, { color: theme.muted, size: 11 });
    d.text(
      `f₁ = ${freq(p, 1).toFixed(1).replace(".", ",")} Hz   ·   t físico = ${(s.tau * 1e3).toFixed(1).replace(".", ",")} ms   ·   ${NOMES_MODO[modo] ?? ""}`,
      0.5,
      0.95,
      { color: theme.text, size: 11 },
    );

    // Espectro de harmônicos
    const x0 = 0.02;
    const w = 0.96 / NS;
    const maxB = Math.max(...s.b.slice(0, NS).map(Math.abs), 1e-12);
    d.line(0, SB, 1, SB, { color: theme.muted, width: 1 });
    d.text("espectro: amplitude |bₙ| de cada harmônico (com o amortecimento)", 0, SB + SH + 0.06, { color: theme.muted, size: 10, align: "left" });
    for (let n = 1; n <= NS; n++) {
      const amp = Math.abs(s.b[n - 1] ?? 0) * Math.exp(-gammaN(p, n) * s.tau);
      const x = x0 + (n - 1) * w;
      const hh = (amp / maxB) * SH;
      if (hh > 0) d.rect(x + w * 0.15, SB, w * 0.7, hh, { fill: n === 1 ? theme.series[1] : theme.accent, alpha: 0.85 });
      d.text(`${n}`, x + w / 2, SB, { color: theme.text, size: 10, dy: 9 });
      if (n <= 8 || n % 2 === 0) d.text(fmtHz(freq(p, n)), x + w / 2, SB, { color: theme.muted, size: 9, dy: 22 });
    }
    d.text("n", -0.04, SB, { color: theme.text, size: 10, dy: 9 });
    d.text("Hz", -0.04, SB, { color: theme.muted, size: 9, dy: 22 });
  },
});


function fmtHz(f: number): string {
  return f >= 1000 ? `${(f / 1000).toFixed(1).replace(".", ",")}k` : f >= 100 ? f.toFixed(0) : f.toFixed(1).replace(".", ",");
}

function grab(s: Corda, p: Params, u: number, yw: number, modo: number): Corda | undefined {
  const h = num(p, "h", 5) * 1e-3;
  const ref = h;
  const y = Math.max(-1.1, Math.min(1.1, (yw - YS) / AMP)) * ref;
  if (modo === MODO.dedilhada) {
    const xp = Math.max(0.03, Math.min(0.97, u));
    const hp = Math.abs(y) < 0.05 * ref ? 0.05 * ref * (y < 0 ? -1 : 1) : y;
    const shape = triangle(xp, hp);
    return { ...s, xp, hp, shape, held: true, tau: 0, b: coefsFor(p, { shape, xp, hp }) };
  }
  if (modo === MODO.desenho) {
    const i = Math.max(1, Math.min(M - 1, Math.round(u * M)));
    const shape = s.shape.slice();
    const from = s.last >= 1 ? s.last : i;
    const y0 = s.last >= 1 ? shape[from]! : y;
    const lo = Math.min(from, i);
    const hi = Math.max(from, i);
    for (let j = lo; j <= hi; j++) shape[j] = hi === lo ? y : y0 + ((y - y0) * (j - from)) / (i - from);
    shape[0] = 0;
    shape[M] = 0;
    return { ...s, shape, last: i, held: true, tau: 0, b: coefsFor(p, { shape, xp: s.xp, hp: s.hp }) };
  }
  return undefined;
}

export default ondasEstacionarias;
