import { clamp, defineSim, draw, num, texNum, type Draw, type Params } from "@fisilab/core";

export const MODOS = ["Lissajous (MHS perpendiculares)", "MHS na mesma direção (fase e batimento)", "Pêndulo de Blackburn (areia)", "Síntese de Fourier"];
export const LISSAJOUS = 0, MESMA = 1, BLACKBURN = 2, FOURIER = 3;
export const FORMAS = ["Onda quadrada", "Onda triangular", "Dente de serra", "Desenho livre (arraste no gráfico)"];
/** Amostras do desenho livre (potência de 2 para a FFT). */
export const NS = 128;

export const modeOf = (p: Params) => Math.round(num(p, "modo"));
const formaOf = (p: Params) => Math.round(num(p, "forma"));
const rad = (d: number) => (d * Math.PI) / 180;

export interface LState {
  /** [x, y, vx, vy] (Lissajous, Blackburn) ou [x₁, x₂, 0, 0] (mesma direção); em cm. */
  y: number[];
  /** Desenho livre: um período da função, NS amostras em [−1, 1]. */
  drawn: number[];
  /** Índice da última amostra desenhada durante o arrasto (−1 fora do arrasto). */
  last: number;
}

// ---------------------------------------------------------------------------
// MHS
// ---------------------------------------------------------------------------

/** Lissajous: x = A sen(2π fₓ t + φ), y = B sen(2π f_y t). */
export function lissajous(p: Params, t: number): [number, number] {
  return [num(p, "A", 8) * Math.sin(2 * Math.PI * num(p, "fx", 1) * t + rad(num(p, "fase"))), num(p, "B", 8) * Math.sin(2 * Math.PI * num(p, "fy", 2) * t)];
}

/** Mesma direção: x₁ = A cos(2π f₁ t), x₂ = B cos(2π f₂ t + φ). */
export function sameLine(p: Params, t: number): [number, number] {
  return [num(p, "A", 8) * Math.cos(2 * Math.PI * num(p, "fx", 1) * t), num(p, "B", 8) * Math.cos(2 * Math.PI * num(p, "fy", 1) * t + rad(num(p, "fase")))];
}
/** Amplitude resultante para frequências iguais: A_R² = A² + B² + 2AB cos φ. */
export const resultantAmp = (p: Params) => {
  const A = num(p, "A", 8), B = num(p, "B", 8);
  return Math.sqrt(Math.max(A * A + B * B + 2 * A * B * Math.cos(rad(num(p, "fase"))), 0));
};

/** Razão p:q aproximada de f_y/fₓ (q ≤ 12) ou null se não for "simples". */
export function ratio(fx: number, fy: number): [number, number] | null {
  for (let q = 1; q <= 12; q++) {
    const pp = Math.round((fy / fx) * q);
    if (pp > 0 && Math.abs(pp / q - fy / fx) < 1e-6) return [pp, q];
  }
  return null;
}

/** Período da figura de Lissajous (s): q/fₓ quando f_y/fₓ = p/q. */
export function lissajousPeriod(p: Params): number {
  const r = ratio(num(p, "fx", 1), num(p, "fy", 2));
  return r ? r[1] / num(p, "fx", 1) : Infinity;
}

// ---------------------------------------------------------------------------
// Blackburn
// ---------------------------------------------------------------------------

/** ωₓ = √(g/L) (o Y inteiro balança) e ω_y = √(g/ℓ) (só o trecho abaixo do nó). */
export const blackburnOmegas = (p: Params): [number, number] => {
  const g = 9.81;
  const L = num(p, "Lb", 1.6), l = Math.min(num(p, "lb", 0.4), L);
  return [Math.sqrt(g / L), Math.sqrt(g / l)];
};

// ---------------------------------------------------------------------------
// Fourier
// ---------------------------------------------------------------------------

export interface Series {
  a0: number;
  a: number[];
  b: number[];
}

/** FFT radix-2 complexa in-place. */
export function fft(re: number[], im: number[]): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j]!, re[i]!];
      [im[i], im[j]] = [im[j]!, im[i]!];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    for (let i = 0; i < n; i += len)
      for (let k = 0; k < len / 2; k++) {
        const wr = Math.cos(ang * k), wi = Math.sin(ang * k);
        const ur = re[i + k]!, ui = im[i + k]!;
        const vr = re[i + k + len / 2]! * wr - im[i + k + len / 2]! * wi;
        const vi = re[i + k + len / 2]! * wi + im[i + k + len / 2]! * wr;
        re[i + k] = ur + vr;
        im[i + k] = ui + vi;
        re[i + k + len / 2] = ur - vr;
        im[i + k + len / 2] = ui - vi;
      }
  }
}

/** Coeficientes de f(u) = a₀ + Σ aₙ cos(2πnu) + bₙ sen(2πnu) das amostras (u = j/NS). */
export function seriesFromSamples(s: number[], nMax: number): Series {
  const n = s.length;
  const re = s.slice(), im = new Array(n).fill(0);
  fft(re, im);
  const a: number[] = [], b: number[] = [];
  for (let k = 1; k <= Math.min(nMax, n / 2 - 1); k++) {
    a.push((2 * re[k]!) / n);
    b.push((-2 * im[k]!) / n);
  }
  return { a0: re[0]! / n, a, b };
}

/** Série exata das formas clássicas (amplitude 1) ou FFT do desenho. */
export function series(p: Params, drawn: number[], nMax: number): Series {
  const f = formaOf(p);
  if (f === 3) return seriesFromSamples(drawn, nMax);
  const a = new Array(nMax).fill(0), b = new Array(nMax).fill(0);
  for (let n = 1; n <= nMax; n++) {
    if (f === 0 && n % 2 === 1) b[n - 1] = 4 / (n * Math.PI);
    if (f === 1 && n % 2 === 1) b[n - 1] = ((8 / (Math.PI * Math.PI * n * n)) * (((n - 1) / 2) % 2 === 0 ? 1 : -1));
    if (f === 2) b[n - 1] = (2 * (n % 2 === 1 ? 1 : -1)) / (n * Math.PI);
  }
  return { a0: 0, a, b };
}

/** Função-alvo em u (um período = 1). */
export function target(p: Params, drawn: number[], u: number): number {
  const v = ((u % 1) + 1) % 1;
  switch (formaOf(p)) {
    case 0:
      return v < 0.5 ? 1 : -1;
    case 1:
      return v < 0.25 ? 4 * v : v < 0.75 ? 2 - 4 * v : 4 * v - 4;
    case 2:
      return v < 0.5 ? 2 * v : 2 * v - 2;
    default: {
      const x = v * NS, i = Math.floor(x) % NS, fr = x - Math.floor(x);
      return drawn[i]! * (1 - fr) + drawn[(i + 1) % NS]! * fr;
    }
  }
}

export function partialSum(sr: Series, N: number, u: number): number {
  let s = sr.a0;
  for (let n = 1; n <= Math.min(N, sr.b.length); n++) s += sr.a[n - 1]! * Math.cos(2 * Math.PI * n * u) + sr.b[n - 1]! * Math.sin(2 * Math.PI * n * u);
  return s;
}

/** Sobressinal de Gibbs: quanto a soma parcial passa do máximo do alvo, em % da excursão total do alvo. */
const memo = new Map<string, number>();
function memoKey(tag: string, p: Params, drawn: number[]): string {
  let h = 0;
  if (formaOf(p) === 3) for (let i = 0; i < drawn.length; i++) h = (h * 31 + Math.round(drawn[i]! * 1e6)) % 1e12;
  return `${tag}|${formaOf(p)}|${Math.round(num(p, "N", 9))}|${h}`;
}
function memoized(tag: string, p: Params, drawn: number[], f: () => number): number {
  const k = memoKey(tag, p, drawn);
  const hit = memo.get(k);
  if (hit !== undefined) return hit;
  if (memo.size > 500) memo.clear();
  const v = f();
  memo.set(k, v);
  return v;
}

export function gibbs(p: Params, drawn: number[]): number {
  return memoized("g", p, drawn, () => gibbsRaw(p, drawn));
}
function gibbsRaw(p: Params, drawn: number[]): number {
  const N = Math.round(num(p, "N", 9));
  const sr = series(p, drawn, N);
  let smax = -Infinity, fmax = -Infinity, fmin = Infinity;
  for (let i = 0; i < 4000; i++) {
    const u = i / 4000;
    smax = Math.max(smax, partialSum(sr, N, u));
    const f = target(p, drawn, u);
    fmax = Math.max(fmax, f);
    fmin = Math.min(fmin, f);
  }
  return fmax > fmin ? ((smax - fmax) / (fmax - fmin)) * 100 : 0;
}

/** Erro quadrático médio relativo entre a soma parcial e o alvo (%). */
export function rmsError(p: Params, drawn: number[]): number {
  return memoized("e", p, drawn, () => rmsRaw(p, drawn));
}
function rmsRaw(p: Params, drawn: number[]): number {
  const N = Math.round(num(p, "N", 9));
  const sr = series(p, drawn, N);
  let e = 0, f2 = 0;
  for (let i = 0; i < 1000; i++) {
    const u = (i + 0.5) / 1000;
    const f = target(p, drawn, u);
    e += (partialSum(sr, N, u) - f) ** 2;
    f2 += f * f;
  }
  return f2 > 0 ? Math.sqrt(e / f2) * 100 : 0;
}

/** Desenho livre inicial: um pulso com uma rampa (forma assimétrica interessante). */
export function defaultDrawing(): number[] {
  return Array.from({ length: NS }, (_, j) => {
    const u = j / NS;
    if (u < 0.15) return -0.6;
    if (u < 0.35) return 0.9;
    if (u < 0.7) return 0.9 - (1.5 * (u - 0.35)) / 0.35;
    return -0.6;
  });
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

/** Painel superior da síntese: u ∈ [0, 2] → x ∈ [−1,5; 1,5]; f ∈ [−1,4; 1,4] → y ∈ [0,15; 1,15]. */
const FX = (u: number) => -1.5 + 1.5 * u;
const FY = (v: number) => 0.65 + 0.36 * v;
const fmt = (v: number, d = 3) => Number(v.toPrecision(d)).toString().replace(".", ",");

// ---------------------------------------------------------------------------
// Simulação
// ---------------------------------------------------------------------------

export const lissajousFourier = defineSim<LState>({
  id: "lissajous-fourier",
  title: "Lissajous, pêndulo de Blackburn e síntese de Fourier",
  course: "FG II",
  topic: "Oscilações",
  priority: "P2",
  summary:
    "Componha MHS perpendiculares (figuras de Lissajous) e na mesma direção (fasores, fase e batimento), deixe um pêndulo de Blackburn desenhar com areia e reconstrua ondas — inclusive uma desenhada por você — somando harmônicos, com o espectro, o fenômeno de Gibbs e o som.",
  equations: [
    String.raw`x = A\sin(2\pi f_x t + \varphi),\quad y = B\sin(2\pi f_y t)`,
    String.raw`x_1 + x_2:\ A_R^2 = A^2 + B^2 + 2AB\cos\varphi,\quad f_{\text{bat}} = |f_1 - f_2|`,
    String.raw`\text{Blackburn: } \omega_x = \sqrt{g/L},\ \omega_y = \sqrt{g/\ell}`,
    String.raw`f(u) = a_0 + \sum_{n=1}^{N} \left[a_n\cos(2\pi n u) + b_n\sin(2\pi n u)\right]`,
  ],
  liveEquations(s, p, t) {
    const m = modeOf(p);
    if (m === LISSAJOUS) {
      const fx = num(p, "fx", 1), fy = num(p, "fy", 2), r = ratio(fx, fy);
      const [x, y] = lissajous(p, t);
      return [
        String.raw`\frac{f_y}{f_x} = ${r ? `\\frac{${r[0]}}{${r[1]}}` : texNum(fy / fx, 4)} \quad T_{\text{figura}} = ${r ? texNum(lissajousPeriod(p)) + String.raw`\ \text{s}` : String.raw`\infty\ \text{(figura gira)}`}`,
        String.raw`x = ${texNum(x)}\ \text{cm},\ y = ${texNum(y)}\ \text{cm} \qquad \sin\varphi = \frac{x(y=0)}{A} = ${texNum(Math.sin(rad(num(p, "fase"))))}`,
      ];
    }
    if (m === MESMA) {
      const f1 = num(p, "fx", 1), f2 = num(p, "fy", 1);
      return [
        Math.abs(f1 - f2) < 1e-9
          ? String.raw`A_R = \sqrt{${texNum(num(p, "A", 8))}^2 + ${texNum(num(p, "B", 8))}^2 + 2\cdot${texNum(num(p, "A", 8))}\cdot${texNum(num(p, "B", 8))}\cos ${texNum(num(p, "fase"))}^\circ} = ${texNum(resultantAmp(p))}\ \text{cm}`
          : String.raw`f_{\text{bat}} = |${texNum(f1)} - ${texNum(f2)}| = ${texNum(Math.abs(f1 - f2))}\ \text{Hz} \quad T_{\text{bat}} = ${texNum(1 / Math.abs(f1 - f2))}\ \text{s}`,
        String.raw`x = x_1 + x_2 = ${texNum(s.y[0]!)} + ${texNum(s.y[1]!)} = ${texNum(s.y[0]! + s.y[1]!)}\ \text{cm}`,
      ];
    }
    if (m === BLACKBURN) {
      const [wx, wy] = blackburnOmegas(p);
      return [String.raw`f_x = ${texNum(wx / (2 * Math.PI))}\ \text{Hz},\ f_y = ${texNum(wy / (2 * Math.PI))}\ \text{Hz},\ \frac{f_y}{f_x} = \sqrt{\frac{L}{\ell}} = ${texNum(wy / wx)}`];
    }
    const N = Math.round(num(p, "N", 9));
    const sr = series(p, s.drawn, Math.min(N, 3));
    const terms = sr.b
      .map((b, i) => [sr.a[i]!, b, i + 1] as const)
      .filter(([a, b]) => Math.hypot(a, b) > 1e-6)
      .map(([a, b, n]) => (Math.abs(a) > 1e-4 ? `${texNum(a)}\\cos ${n}\\omega t ${b >= 0 ? "+" : ""} ${texNum(b)}\\sin ${n}\\omega t` : `${texNum(b)}\\sin ${n}\\omega t`));
    return [String.raw`f \approx ${Math.abs(sr.a0) > 1e-4 ? texNum(sr.a0) + " + " : ""}${terms.join(" + ").replace(/\+ -/g, "- ")} + \cdots \quad (N = ${N})`, String.raw`\text{Gibbs: } ${texNum(gibbs(p, s.drawn))}\%\ \text{do salto} \quad \text{erro RMS} = ${texNum(rmsError(p, s.drawn))}\%`];
  },

  params: [
    { key: "modo", label: "Experimento", unit: "", min: 0, max: 3, step: 1, default: 0, options: MODOS.map((label, value) => ({ value, label })) },
    { key: "fx", label: "Frequência fₓ (ou f₁)", unit: "Hz", min: 0.1, max: 5, step: 0.01, default: 1, live: true },
    { key: "fy", label: "Frequência f_y (ou f₂)", unit: "Hz", min: 0.1, max: 5, step: 0.01, default: 2, live: true },
    { key: "fase", label: "Fase φ", unit: "°", min: -180, max: 180, step: 1, default: 90, live: true },
    { key: "A", label: "Amplitude A", unit: "cm", min: 1, max: 10, step: 0.1, default: 8, live: true },
    { key: "B", label: "Amplitude B", unit: "cm", min: 1, max: 10, step: 0.1, default: 8, live: true },
    { key: "Lb", label: "Blackburn: comprimento total L", unit: "m", min: 0.5, max: 3, step: 0.01, default: 1.6 },
    { key: "lb", label: "Blackburn: trecho abaixo do nó ℓ", unit: "m", min: 0.1, max: 3, step: 0.01, default: 0.4 },
    { key: "gamma", label: "Blackburn: amortecimento γ", unit: "1/s", min: 0, max: 0.2, step: 0.005, default: 0.02 },
    { key: "forma", label: "Fourier: onda-alvo", unit: "", min: 0, max: 3, step: 1, default: 0, live: true, options: FORMAS.map((label, value) => ({ value, label })) },
    { key: "N", label: "Fourier: número de harmônicos N", unit: "", min: 1, max: 60, step: 1, default: 9, live: true },
    {
      key: "comp",
      label: "Fourier: mostrar componentes",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 1,
      live: true,
      options: [
        { value: 1, label: "Sim (3 primeiras)" },
        { value: 0, label: "Não" },
      ],
    },
  ],

  observables: [
    { key: "x", label: "x (ou x₁)", unit: "cm", value: (s) => s.y[0]! },
    { key: "y", label: "y (ou x₂)", unit: "cm", value: (s) => s.y[1]! },
    { key: "soma", label: "Mesma direção: x₁ + x₂", unit: "cm", value: (s) => s.y[0]! + s.y[1]! },
    { key: "razao", label: "Razão f_y / fₓ", unit: "", value: (_s, p) => (modeOf(p) === BLACKBURN ? blackburnOmegas(p)[1] / blackburnOmegas(p)[0] : num(p, "fy", 2) / num(p, "fx", 1)) },
    { key: "AR", label: "Amplitude resultante (f₁ = f₂)", unit: "cm", value: (_s, p) => resultantAmp(p) },
    { key: "fbat", label: "Frequência de batimento", unit: "Hz", value: (_s, p) => Math.abs(num(p, "fx", 1) - num(p, "fy", 2)) },
    { key: "gibbs", label: "Fourier: sobressinal de Gibbs", unit: "%", value: (s, p) => (modeOf(p) === FOURIER ? gibbs(p, s.drawn) : 0) },
    { key: "erro", label: "Fourier: erro RMS da soma parcial", unit: "%", value: (s, p) => (modeOf(p) === FOURIER ? rmsError(p, s.drawn) : 0) },
    {
      key: "fsom",
      label: "Fourier: valor da soma no cursor",
      unit: "",
      value: (s, p, t) => (modeOf(p) === FOURIER ? partialSum(series(p, s.drawn, Math.round(num(p, "N", 9))), Math.round(num(p, "N", 9)), (t / 4) % 1) : 0),
    },
  ],
  chart: { x: "t", y: "x" },

  scenarios: [
    {
      id: "lissajous",
      label: "Figuras de Lissajous",
      params: { modo: LISSAJOUS, fx: 1, fy: 2, fase: 90, A: 8, B: 8 },
      guide: `### Razão de frequências e fase
1. Com $f_y/f_x = 2$ a figura tem 2 laços na vertical... conte as tangências: a figura toca as bordas horizontais $f_y$ vezes e as verticais $f_x$ vezes.
2. Experimente 3:2, 5:4 e 1:1 com fases 0°, 45° e 90°: reta, elipse inclinada, círculo.
3. Coloque $f_y = 2{,}02$ Hz: a figura gira lentamente — é assim que se afinam osciladores no osciloscópio.
4. **Medida de fase** (1:1): o corte da elipse no eixo $x$ dá $\\sin\\varphi = x_0/A$.`,
      predict: [
        {
          question: "Com fₓ = f_y e fase de 90° (A = B), a figura é:",
          options: ["uma reta inclinada", "um círculo", "um oito"],
          answer: 1,
          explanation: "$x = A\\cos(\\omega t)$ e $y = A\\sin(\\omega t)$: o ponto descreve um movimento circular uniforme.",
        },
      ],
    },
    {
      id: "fasores",
      label: "Fase e batimento (mesma direção)",
      params: { modo: MESMA, fx: 1, fy: 1, fase: 60, A: 6, B: 4 },
      guide: `### Soma de fasores
1. Cada MHS é a projeção de um vetor girante (fasor). A soma é a projeção da soma vetorial.
2. Varie a fase: em 0° a amplitude é $A + B$ (construtiva), em 180° é $|A - B|$ (destrutiva).
3. Coloque $f_2 = 1{,}1$ Hz: o ângulo entre os fasores gira devagar e a amplitude pulsa — **batimento** com $f_{bat} = |f_1 - f_2|$.`,
      predict: [
        {
          question: "Somando MHS de 6 cm e 4 cm, de mesma frequência, defasados de 180°, a amplitude resultante é:",
          options: ["10 cm", "2 cm", "zero"],
          answer: 1,
          explanation: "Em oposição de fase as elongações se subtraem a cada instante: $A_R = |6 - 4| = 2$ cm.",
        },
      ],
    },
    {
      id: "blackburn",
      label: "Pêndulo de Blackburn",
      params: { modo: BLACKBURN, Lb: 1.6, lb: 0.4, A: 8, B: 6, fase: 0, gamma: 0.02 },
      guide: `### Areia desenhando Lissajous
1. O Y balança inteiro numa direção ($L$) e só a parte de baixo na outra ($\\ell$): $f_y/f_x = \\sqrt{L/\\ell}$.
2. Com $L = 1{,}6$ m e $\\ell = 0{,}4$ m a razão é 2: a areia desenha uma figura 2:1 que encolhe pelo amortecimento.
3. Note onde a areia se acumula: nas pontas da trajetória, onde a velocidade é menor.
4. Escolha $\\ell$ para obter a razão 3:2.`,
    },
    {
      id: "fourier",
      label: "Síntese de Fourier e Gibbs",
      params: { modo: FOURIER, forma: 0, N: 9, comp: 1 },
      guide: `### Construindo ondas com senos
1. A onda quadrada só tem harmônicos ímpares, com $b_n = 4/(n\\pi)$.
2. Aumente $N$: a soma se aproxima da onda, mas perto do salto sempre sobra um pico de ~9% (**fenômeno de Gibbs**).
3. Compare com a triangular: coeficientes caem com $1/n^2$ e a convergência é muito mais rápida.
4. Escolha **desenho livre** e desenhe um período arrastando no gráfico de cima. O espectro é calculado por FFT. Ligue o som para ouvir o timbre.`,
      predict: [
        {
          question: "Aumentando N de 9 para 60 na onda quadrada, o pico de sobressinal junto ao salto:",
          options: ["desaparece", "fica mais estreito, mas com a mesma altura", "fica mais alto"],
          answer: 1,
          explanation: "O sobressinal de Gibbs tende a cerca de 9% do salto para qualquer N; só a largura da região afetada diminui.",
        },
      ],
    },
  ],

  exercises: [
    {
      id: "blackburn-razao",
      prompt: "Num pêndulo de Blackburn, o comprimento total é L = {Lb} m. Qual deve ser o comprimento ℓ abaixo do nó para que f_y/fₓ = 2?",
      vary: { Lb: [0.8, 2.8, 2] },
      fixed: { modo: BLACKBURN },
      answer: { label: "ℓ", unit: "m", compute: (p) => num(p, "Lb") / 4 },
      hint: "f_y/fₓ = √(L/ℓ).",
    },
    {
      id: "soma-fase",
      prompt: "Dois MHS de mesma frequência e mesma direção têm amplitudes {A} cm e {B} cm e diferença de fase de {fase}°. Qual é a amplitude resultante?",
      vary: { A: [1, 10, 1], B: [1, 10, 1], fase: [0, 180, 0] },
      fixed: { modo: MESMA, fx: 1, fy: 1 },
      answer: { label: "A_R", unit: "cm", compute: (p) => resultantAmp(p) },
      tolerance: 0.02,
    },
  ],

  init(p): LState {
    const m = modeOf(p);
    let y: number[];
    if (m === LISSAJOUS) y = [...lissajous(p, 0), 0, 0];
    else if (m === MESMA) y = [...sameLine(p, 0), 0, 0];
    else if (m === BLACKBURN) {
      // Solta de (A, B cos φ) com velocidade y que dá a fase φ entre os movimentos.
      const [, wy] = blackburnOmegas(p);
      const ph = rad(num(p, "fase"));
      y = [num(p, "A", 8), num(p, "B", 6) * Math.cos(ph), 0, -num(p, "B", 6) * wy * Math.sin(ph)];
    } else y = [0, 0, 0, 0];
    return { y, drawn: defaultDrawing(), last: -1 };
  },

  step(s, p, t, dt): LState {
    const m = modeOf(p);
    const t1 = t + dt;
    if (m === LISSAJOUS) return { ...s, y: [...lissajous(p, t1), 0, 0] };
    if (m === MESMA) return { ...s, y: [...sameLine(p, t1), 0, 0] };
    if (m === BLACKBURN) {
      const [wx, wy] = blackburnOmegas(p);
      const gm = num(p, "gamma", 0.02);
      const f = (q: number[]) => [q[2]!, q[3]!, -wx * wx * q[0]! - 2 * gm * q[2]!, -wy * wy * q[1]! - 2 * gm * q[3]!];
      const y = s.y;
      const k1 = f(y);
      const k2 = f(y.map((v, i) => v + (dt / 2) * k1[i]!));
      const k3 = f(y.map((v, i) => v + (dt / 2) * k2[i]!));
      const k4 = f(y.map((v, i) => v + dt * k3[i]!));
      return { ...s, y: y.map((v, i) => v + (dt / 6) * (k1[i]! + 2 * k2[i]! + 2 * k3[i]! + k4[i]!)) };
    }
    return s;
  },
  dt: 2e-3,
  sampleEvery: 5,
  maxSamples: 15000,
  tEnd: 600,

  viewport() {
    return { xMin: -1.6, xMax: 1.6, yMin: -1.25, yMax: 1.25 };
  },

  pointer: {
    down(s, p, pt) {
      if (modeOf(p) !== FOURIER || formaOf(p) !== 3) return undefined;
      if (pt.y < 0.1 || pt.y > 1.2 || pt.x < -1.5 || pt.x > 1.5) return undefined;
      return paint({ ...s, last: -1 }, pt);
    },
    move(s, p, pt, dragging) {
      if (!dragging || s.last < 0 || modeOf(p) !== FOURIER || formaOf(p) !== 3) return undefined;
      return paint(s, pt);
    },
    up: (s) => (s.last >= 0 ? { ...s, last: -1 } : undefined),
    cursor: (_s, p, pt) => (modeOf(p) === FOURIER && formaOf(p) === 3 && pt.y > 0.1 ? "crosshair" : undefined),
  },
  actions: [
    { id: "limpar", label: "Fourier: zerar desenho", run: (s) => ({ ...s, drawn: new Array(NS).fill(0) }) },
    { id: "exemplo", label: "Fourier: desenho de exemplo", run: (s) => ({ ...s, drawn: defaultDrawing() }) },
  ],

  tone(p, s) {
    if (modeOf(p) !== FOURIER) return { freq: 220, gain: 0 };
    const N = Math.round(num(p, "N", 9));
    const sr = series(p, s.drawn, N);
    return { freq: 220, gain: 0.15, harmonics: sr.b.map((b, i) => Math.hypot(b, sr.a[i]!)) };
  },

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const { state: s, params: p, t } = frame;
    switch (modeOf(p)) {
      case LISSAJOUS:
        return renderLissajous(d, s, p, t, frame.trail);
      case MESMA:
        return renderMesma(d, s, p, t);
      case BLACKBURN:
        return renderBlackburn(d, s, p, frame.trail);
      default:
        return renderFourier(d, s, p, t);
    }
  },
});

/** Desenho livre: grava as amostras entre o último ponto e o atual (sem buracos). */
function paint(s: LState, pt: { x: number; y: number }): LState {
  const u = clamp((pt.x + 1.5) / 1.5, 0, 1.999) % 1;
  const j = Math.floor(u * NS);
  const v = clamp((pt.y - 0.65) / 0.36, -1.3, 1.3);
  const drawn = s.drawn.slice();
  if (s.last >= 0 && s.last !== j) {
    const a = s.last, va = drawn[a]!;
    const steps = Math.abs(j - a);
    for (let k = 1; k <= steps; k++) {
      const idx = a + Math.sign(j - a) * k;
      drawn[idx] = va + ((v - va) * k) / steps;
    }
  }
  drawn[j] = v;
  return { ...s, drawn, last: j };
}

// ---------------------------------------------------------------------------
// Desenhos
// ---------------------------------------------------------------------------

function renderLissajous(d: Draw, s: LState, p: Params, t: number, trail: LState[]) {
  const { theme } = d;
  const k = 0.085; // mundo por cm
  const cx = 0.3, cy = -0.22, R = 10 * k;
  d.rect(cx - R, cy - R, 2 * R, 2 * R, { stroke: theme.grid, width: 1 });
  d.line(cx - R, cy, cx + R, cy, { color: theme.grid });
  d.line(cx, cy - R, cx, cy + R, { color: theme.grid });
  const pts = trail.filter((q) => q.y.length === 4).slice(-2500).map((q) => [cx + k * q.y[0]!, cy + k * q.y[1]!] as [number, number]);
  d.polyline(pts, { color: theme.accent, width: 2 });
  const [x, y] = [s.y[0]!, s.y[1]!];
  // Osciladores de x (em cima) e de y (à esquerda), com o tempo escorrendo para longe da figura.
  const fx = num(p, "fx", 1), fy = num(p, "fy", 2), span = 2 / Math.min(fx, fy);
  const top: [number, number][] = [], left: [number, number][] = [];
  for (let i = 0; i <= 200; i++) {
    const tt = t - (span * i) / 200;
    const [xx, yy] = lissajous(p, tt);
    top.push([cx + k * xx, cy + R + 0.05 + (0.33 * i) / 200]);
    left.push([cx - R - 0.05 - (0.4 * i) / 200, cy + k * yy]);
  }
  d.polyline(top, { color: theme.series[1]!, width: 1.5 });
  d.polyline(left, { color: theme.series[2]!, width: 1.5 });
  d.line(cx + k * x, cy + R + 0.05, cx + k * x, cy + k * y, { color: theme.series[1]!, dash: [3, 3], alpha: 0.7 });
  d.line(cx - R - 0.05, cy + k * y, cx + k * x, cy + k * y, { color: theme.series[2]!, dash: [3, 3], alpha: 0.7 });
  d.dot(cx + k * x, cy + k * y, 6, theme.negative);
  d.text(`x: ${fmt(fx)} Hz`, cx + R + 0.05, cy + R + 0.2, { color: theme.series[1]!, size: 12, align: "left" });
  d.text(`y: ${fmt(fy)} Hz`, cx - R - 0.25, cy - R - 0.07, { color: theme.series[2]!, size: 12 });
  const r = ratio(fx, fy);
  d.text(r ? `f_y : f_x = ${r[0]} : ${r[1]}   φ = ${fmt(num(p, "fase"))}°` : `f_y / f_x = ${fmt(fy / fx, 4)} (figura não fecha)`, -1.55, 1.15, { color: theme.text, size: 13, align: "left" });
}

function renderMesma(d: Draw, s: LState, p: Params, t: number) {
  const { theme } = d;
  const A = num(p, "A", 8), B = num(p, "B", 8);
  const k = Math.min(0.07, 0.72 / (A + B));
  const cx = -0.85, cy = 0;
  const a1 = 2 * Math.PI * num(p, "fx", 1) * t, a2 = 2 * Math.PI * num(p, "fy", 1) * t + rad(num(p, "fase"));
  // Fasores girando; a projeção no eixo horizontal é a elongação.
  const v1: [number, number] = [A * Math.cos(a1) * k, A * Math.sin(a1) * k];
  const v2: [number, number] = [B * Math.cos(a2) * k, B * Math.sin(a2) * k];
  d.circle(cx, cy, (A + B) * k, { stroke: theme.grid, width: 1 });
  d.line(cx - 0.7, cy, cx + 0.7, cy, { color: theme.grid });
  d.arrow(cx, cy, v1[0], v1[1], { color: theme.series[0]! });
  d.arrow(cx + v1[0], cy + v1[1], v2[0], v2[1], { color: theme.series[1]! });
  d.arrow(cx, cy, v1[0] + v2[0], v1[1] + v2[1], { color: theme.negative, width: 2.5 });
  d.line(cx + v1[0] + v2[0], cy + v1[1] + v2[1], cx + v1[0] + v2[0], cy, { color: theme.negative, dash: [3, 3] });
  d.dot(cx + v1[0] + v2[0], cy, 5, theme.negative);
  d.text("fasores", cx, 1.1, { color: theme.muted, size: 12 });
  // Gráficos x(t): tempo escorrendo para a direita
  const x0 = -0.05, x1 = 1.55, win = 4;
  const T = (tt: number) => x0 + ((t - tt) / win) * (x1 - x0);
  const rows: [number, string, (q: [number, number]) => number][] = [
    [0.75, theme.series[0]!, (q) => q[0]],
    [0.25, theme.series[1]!, (q) => q[1]],
    [-0.55, theme.negative, (q) => q[0] + q[1]],
  ];
  for (const [yc, color, f] of rows) {
    d.line(x0, yc, x1, yc, { color: theme.grid });
    const pts: [number, number][] = [];
    for (let i = 0; i <= 300; i++) {
      const tt = t - (win * i) / 300;
      pts.push([T(tt), yc + (yc < 0 ? 0.5 : 0.25) * (f(sameLine(p, tt)) / 10) * (yc < 0 ? 0.5 : 1)]);
    }
    d.polyline(pts, { color, width: 1.8 });
  }
  d.text("x₁", x1, 0.75, { color: theme.series[0]!, size: 12, dx: -6, dy: -14 });
  d.text("x₂", x1, 0.25, { color: theme.series[1]!, size: 12, dx: -6, dy: -14 });
  d.text("x₁ + x₂", x1, -0.55, { color: theme.negative, size: 12, dx: -16, dy: -50 });
  const f1 = num(p, "fx", 1), f2 = num(p, "fy", 1);
  d.text(
    Math.abs(f1 - f2) < 1e-9 ? `A_R = ${fmt(resultantAmp(p))} cm  (φ = ${fmt(num(p, "fase"))}°)` : `batimento: ${fmt(Math.abs(f1 - f2))} Hz`,
    -0.95,
    -1.15,
    { color: theme.text, size: 13 },
  );
  void s;
}

/** Ruído determinístico em [−1, 1] para espalhar os grãos de areia. */
const jitter = (i: number, k: number) => {
  const v = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return 2 * (v - Math.floor(v)) - 1;
};

function renderBlackburn(d: Draw, s: LState, p: Params, trail: LState[]) {
  const { theme } = d;
  const k = 0.1;
  const cx = 0.25, cy = -0.1;
  d.rect(cx - 1.1, cy - 1.1, 2.2, 2.2, { fill: theme.dark ? "#2a2620" : "#efe6d2", stroke: theme.grid });
  const sand = theme.dark ? "#d8b56a" : "#8a6a2a";
  const tr = trail.filter((q) => q.y.length === 4);
  const ctx = d.ctx;
  ctx.fillStyle = sand;
  const r = 1.4 * d.px;
  for (let i = 0; i < tr.length; i++) {
    const q = tr[i]!;
    const x = cx + k * q.y[0]! + 0.012 * jitter(i, 1), y = cy + k * q.y[1]! + 0.012 * jitter(i, 2);
    ctx.globalAlpha = 0.5;
    ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  ctx.globalAlpha = 1;
  const x = cx + k * s.y[0]!, y = cy + k * s.y[1]!;
  d.circle(x, y, 0.07, { fill: theme.series[1]!, stroke: theme.text, width: 1 });
  d.dot(x, y, 2, theme.text);
  // Esquema do Y (lateral) à esquerda
  const L = num(p, "Lb", 1.6), l = Math.min(num(p, "lb", 0.4), L);
  const sx = -1.35, top = 1.0, sc = 1.6 / Math.max(L, 0.5);
  const node = top - (L - l) * sc;
  d.line(sx - 0.18, top, sx + 0.18, top, { color: theme.text, width: 2 });
  d.line(sx - 0.15, top, sx, node, { color: theme.muted });
  d.line(sx + 0.15, top, sx, node, { color: theme.muted });
  d.line(sx, node, sx, top - L * sc, { color: theme.muted });
  d.dot(sx, top - L * sc, 4, theme.series[1]!);
  d.text("L", sx + 0.2, top - (L * sc) / 2, { color: theme.text, size: 11 });
  d.text("ℓ", sx - 0.08, node - (l * sc) / 2, { color: theme.text, size: 11 });
  const [wx, wy] = blackburnOmegas(p);
  d.text(`f_y / f_x = √(L/ℓ) = ${fmt(wy / wx)}`, cx, 1.15, { color: theme.text, size: 13 });
}

function renderFourier(d: Draw, s: LState, p: Params, t: number) {
  const { theme } = d;
  const N = Math.round(num(p, "N", 9));
  const sr = series(p, s.drawn, Math.max(N, 1));
  // Painel superior: alvo, soma parcial e componentes
  d.rect(-1.5, 0.12, 3, 1.06, { stroke: theme.grid, width: 1 });
  d.line(-1.5, FY(0), 1.5, FY(0), { color: theme.grid });
  d.line(0, 0.12, 0, 1.18, { color: theme.grid, dash: [3, 3] });
  d.plot((x) => FY(target(p, s.drawn, (x + 1.5) / 1.5)), -1.5, 1.5, { color: theme.muted, width: 1.5, n: 600 });
  if (num(p, "comp", 1) > 0.5) {
    let shown = 0;
    for (let n = 1; n <= N && shown < 3; n++) {
      const a = sr.a[n - 1]!, b = sr.b[n - 1]!;
      if (Math.hypot(a, b) < 1e-6) continue;
      d.plot((x) => FY(a * Math.cos(2 * Math.PI * n * ((x + 1.5) / 1.5)) + b * Math.sin(2 * Math.PI * n * ((x + 1.5) / 1.5))), -1.5, 1.5, {
        color: theme.series[(shown + 2) % 6]!,
        width: 1,
        alpha: 0.7,
        n: 400,
      });
      shown++;
    }
  }
  d.plot((x) => FY(partialSum(sr, N, (x + 1.5) / 1.5)), -1.5, 1.5, { color: theme.accent, width: 2.2, n: 900 });
  const u = (t / 4) % 1;
  d.line(FX(u), 0.12, FX(u), 1.18, { color: theme.negative, width: 1 });
  d.dot(FX(u), FY(partialSum(sr, N, u)), 4, theme.negative);
  d.text(`soma de ${N} harmônico${N > 1 ? "s" : ""} · Gibbs ${fmt(gibbs(p, s.drawn), 2)}% · erro RMS ${fmt(rmsError(p, s.drawn), 2)}%`, 0, 1.22, { color: theme.text, size: 12 });
  if (formaOf(p) === 3) d.text("arraste aqui para desenhar um período", -1.45, 0.17, { color: theme.muted, size: 11, align: "left" });
  // Espectro de amplitudes
  const y0 = -1.12, y1 = -0.12;
  const nShow = Math.max(15, Math.min(60, N));
  const bw = 2.9 / nShow;
  const amps = Array.from({ length: nShow }, (_, i) => (i < sr.b.length ? Math.hypot(sr.a[i]!, sr.b[i]!) : 0));
  const full = series(p, s.drawn, nShow);
  const fullAmps = Array.from({ length: nShow }, (_, i) => Math.hypot(full.a[i] ?? 0, full.b[i] ?? 0));
  const mx = Math.max(...fullAmps, 1e-9);
  d.line(-1.45, y0, 1.45, y0, { color: theme.muted });
  for (let i = 0; i < nShow; i++) {
    const x = -1.45 + bw * i + bw * 0.15;
    const h = ((i < N ? amps[i]! : fullAmps[i]!) / mx) * (y1 - y0 - 0.1);
    d.rect(x, y0, bw * 0.7, h, { fill: i < N ? theme.accent : theme.grid });
    if (nShow <= 20 || (i + 1) % 5 === 0) d.text(String(i + 1), x + bw * 0.35, y0, { color: theme.muted, size: 9, dy: 9 });
  }
  d.text("espectro |cₙ| (barras cinzas: harmônicos ainda não somados)", 0, y1 + 0.02, { color: theme.muted, size: 11 });
}

export default lissajousFourier;
