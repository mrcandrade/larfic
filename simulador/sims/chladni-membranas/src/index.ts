import { clamp, defineSim, draw, num, orbit, projector, renderFaces, rng, surface, texNum, type Draw, type Params, type V3 } from "@fisilab/core";
import { DRUM, G, GEOMS, PLATE_DISC, RECT, SQUARE, halfY, inside, modalFactor, modeGrids, modeList, sample, type Mode } from "./modes.ts";

export * from "./modes.ts";

export const MATERIAIS = [
  { label: "Alumínio (E = 70 GPa, ρ = 2700 kg/m³)", E: 70e9, rho: 2700 },
  { label: "Latão (E = 100 GPa, ρ = 8500 kg/m³)", E: 100e9, rho: 8500 },
  { label: "Aço (E = 200 GPa, ρ = 7850 kg/m³)", E: 200e9, rho: 7850 },
  { label: "Vidro (E = 70 GPa, ρ = 2500 kg/m³)", E: 70e9, rho: 2500 },
];
const NU = 0.3;
/** Número de grãos de areia. */
export const NSAND = 1400;
/** Duração de uma varredura de frequência (s). */
export const SWEEP_T = 60;

export const geomOf = (p: Params) => clamp(Math.round(num(p, "geom")), 0, 3);
const betaOf = (p: Params) => (geomOf(p) === RECT ? num(p, "beta", 0.7) : 1);
const isCirc = (g: number) => g === PLATE_DISC || g === DRUM;
const isPlate = (g: number) => g === SQUARE || g === PLATE_DISC;

/** Rigidez de flexão D = E h³ / (12(1 − ν²)). */
export function flexural(p: Params): number {
  const m = MATERIAIS[clamp(Math.round(num(p, "material")), 0, MATERIAIS.length - 1)]!;
  const h = num(p, "h", 1) * 1e-3;
  return (m.E * h ** 3) / (12 * (1 - NU * NU));
}
/** Velocidade das ondas na membrana c = √(T/σ). */
export const waveSpeed = (p: Params) => Math.sqrt(num(p, "T", 2000) / num(p, "sigma", 0.25));

/** Converte o fator adimensional do modo em hertz. */
export function freqScale(p: Params): number {
  const g = geomOf(p), L = num(p, "L", 0.3);
  if (isPlate(g)) {
    const m = MATERIAIS[clamp(Math.round(num(p, "material")), 0, MATERIAIS.length - 1)]!;
    const k = Math.sqrt(flexural(p) / (m.rho * num(p, "h", 1) * 1e-3));
    // Quadrada: ω = (π/L)²(n² + m²)√(D/ρh); circular: ω = (β/R)²√(D/ρh), R = L/2.
    return g === SQUARE ? ((PI / L) ** 2 * k) / (2 * PI) : (k / (L / 2) ** 2) / (2 * PI);
  }
  // Tambor: f = j c/(2πR); retangular: f = (c/2a)√(n² + (m a/b)²).
  return g === DRUM ? waveSpeed(p) / (2 * PI * (L / 2)) : waveSpeed(p) / (2 * L);
}
const PI = Math.PI;

export const modesOf = (p: Params): Mode[] => modeList(geomOf(p), betaOf(p));
export const modeFreqs = (p: Params) => modesOf(p).map((m) => m.factor * freqScale(p));

/** Frequência de excitação atual (Hz). */
export function driveFreq(p: Params, t: number): number {
  const fs = modeFreqs(p);
  if (Math.round(num(p, "excit")) === 1) return fs[clamp(Math.round(num(p, "kmode", 1)) - 1, 0, fs.length - 1)]!;
  if (Math.round(num(p, "varredura")) === 1) {
    const f0 = 0.8 * fs[0]!, f1 = 1.05 * fs[Math.min(15, fs.length - 1)]!;
    const tau = (t % SWEEP_T) / SWEEP_T;
    return f0 * (f1 / f0) ** tau;
  }
  return num(p, "f", 300);
}

export interface CState {
  /** Grãos: [x₀, y₀, x₁, y₁, ...] em coordenadas normalizadas. */
  sand: number[];
  seed: number;
  /** Ponto de excitação (normalizado). */
  drive: [number, number];
  cam: { yaw: number; pitch: number };
  drag: { kind: "drive" } | { kind: "cam"; x0: number; y0: number; cam0: { yaw: number; pitch: number } } | null;
}

export interface Field {
  re: Float64Array;
  im: Float64Array;
  /** Máximo de |W| na grade. */
  max: number;
  f: number;
  /** Índice do modo com maior contribuição. */
  dom: number;
}

let fieldCache: { key: string; F: Field } | null = null;
/** Campo complexo de deslocamento W(x, y) = Σ ψⱼ(d) ψⱼ(x, y) / (fⱼ² − f² + i f fⱼ/Q). */
export function field(p: Params, s: CState, t: number): Field {
  const g = geomOf(p), beta = betaOf(p);
  const f = driveFreq(p, t);
  const th0 = Math.atan2(s.drive[1], s.drive[0]);
  const key = [g, beta, f, num(p, "Q", 60), num(p, "excit"), num(p, "kmode"), s.drive[0], s.drive[1], freqScale(p)].join("|");
  if (fieldCache && fieldCache.key === key) return fieldCache.F;
  const modes = modesOf(p), fs = modeFreqs(p), grids = modeGrids(g, beta, th0);
  const n = (G + 1) * (G + 1);
  const re = new Float64Array(n), im = new Float64Array(n);
  let dom = 0;
  if (Math.round(num(p, "excit")) === 1) {
    dom = clamp(Math.round(num(p, "kmode", 1)) - 1, 0, modes.length - 1);
    re.set(grids[dom]!);
  } else {
    let best = -1;
    const Q = num(p, "Q", 60);
    modes.forEach((md, j) => {
      const [a, b] = modalFactor(fs[j]!, f, Q, md.psi(s.drive[0], s.drive[1], th0));
      const w = Math.hypot(a, b);
      if (w > best) [best, dom] = [w, j];
      const gr = grids[j]!;
      for (let k = 0; k < n; k++) {
        re[k] = re[k]! + a * gr[k]!;
        im[k] = im[k]! + b * gr[k]!;
      }
    });
  }
  let max = 0;
  for (let k = 0; k < n; k++) max = Math.max(max, Math.hypot(re[k]!, im[k]!));
  const F = { re, im, max: max || 1, f, dom };
  fieldCache = { key, F };
  return F;
}

/** Amplitude relativa |W|/máx no ponto (0 nas linhas nodais, 1 no ventre mais forte). */
export function relAmp(F: Field, p: Params, x: number, y: number): number {
  const g = geomOf(p), beta = betaOf(p);
  return Math.hypot(sample(F.re, g, beta, x, y), sample(F.im, g, beta, x, y)) / F.max;
}

/** Fração de grãos sobre linhas nodais (|W|/máx < 0,12). */
export function nodalFraction(s: CState, p: Params, t: number): number {
  const F = field(p, s, t);
  let k = 0;
  for (let i = 0; i < s.sand.length; i += 2) if (relAmp(F, p, s.sand[i]!, s.sand[i + 1]!) < 0.12) k++;
  return (100 * k) / (s.sand.length / 2);
}

/** Receptância no ponto de excitação |Σ ψⱼ(d)² / (fⱼ² − f² + i f fⱼ/Q)| (unidade arbitrária). */
export function receptance(p: Params, s: CState, f: number): number {
  const modes = modesOf(p), fs = modeFreqs(p), Q = num(p, "Q", 60);
  const th0 = Math.atan2(s.drive[1], s.drive[0]);
  let a = 0, b = 0;
  modes.forEach((md, j) => {
    const psi = md.psi(s.drive[0], s.drive[1], th0);
    const [x, y] = modalFactor(fs[j]!, f, Q, psi * psi);
    a += x;
    b += y;
  });
  return Math.hypot(a, b);
}

function scatter(p: Params, seed: number): number[] {
  const g = geomOf(p), beta = betaOf(p), r = rng(seed);
  const out: number[] = [];
  while (out.length < 2 * NSAND) {
    const x = 2 * r() - 1, y = (2 * r() - 1) * halfY(g, beta);
    if (inside(g, beta, x * 1.02, y * 1.02)) out.push(x, y);
  }
  return out;
}

const fmt = (v: number, d = 3) => Number(v.toPrecision(d)).toString().replace(".", ",");
function hexMix(a: string, b: string, t: number): string {
  if (!/^#[0-9a-f]{6}$/i.test(a) || !/^#[0-9a-f]{6}$/i.test(b)) return t < 0.5 ? a : b;
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = (s: number) => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t);
  return `#${((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1)}`;
}

/** Painel da resposta (x ∈ [1,25; 3,3]). */
const PX0 = 1.35, PX1 = 3.25, PY0 = -0.55, PY1 = 0.95;

export const chladniMembranas = defineSim<CState>({
  id: "chladni-membranas",
  title: "Figuras de Chladni e modos de membranas",
  course: "FG II",
  topic: "Ondas",
  priority: "P2",
  summary:
    "Excite uma placa quadrada ou circular, um tambor ou uma membrana retangular numa frequência (ou numa varredura) e veja a areia correr para as linhas nodais. Os modos vêm de soluções analíticas (Bessel para os discos), com resposta em frequência, ponto de excitação arrastável e vista 3D da superfície vibrando.",
  equations: [
    String.raw`\text{Placa: } D\nabla^4 w + \rho h\,\ddot w = F,\quad D = \frac{E h^3}{12(1-\nu^2)},\quad \omega_{nm} \approx \left(\frac{\pi}{L}\right)^2 (n^2+m^2)\sqrt{\frac{D}{\rho h}}`,
    String.raw`\text{Tambor: } \nabla^2 w = \frac{1}{c^2}\ddot w,\quad w_{mn} = J_m\!\left(j_{mn}\frac{r}{R}\right)\cos m\theta,\quad f_{mn} = \frac{j_{mn}\,c}{2\pi R}`,
    String.raw`\text{Retangular: } f_{nm} = \frac{c}{2}\sqrt{\left(\frac{n}{a}\right)^2 + \left(\frac{m}{b}\right)^2},\quad c = \sqrt{T/\sigma}`,
    String.raw`W(\vec r) = \sum_j \frac{\psi_j(\vec r_d)\,\psi_j(\vec r)}{f_j^2 - f^2 + i f f_j/Q}`,
  ],
  liveEquations(s, p, t) {
    const F = field(p, s, t);
    const md = modesOf(p)[F.dom]!, fj = modeFreqs(p)[F.dom]!;
    const g = geomOf(p);
    const out = [String.raw`f = ${texNum(F.f)}\ \text{Hz} \quad \text{modo dominante } ${md.label.replace(/[−+]/g, (c) => (c === "+" ? "^{+}" : "^{-}")).replace(/: .*/, "")}:\ f_j = ${texNum(fj)}\ \text{Hz}`];
    if (isPlate(g)) out.push(String.raw`D = ${texNum(flexural(p))}\ \text{N·m} \quad f_j \propto ${g === SQUARE ? "n^2+m^2" : "\\beta^2"} = ${texNum(md.factor)}`);
    else out.push(String.raw`c = \sqrt{${texNum(num(p, "T", 2000))}/${texNum(num(p, "sigma", 0.25))}} = ${texNum(waveSpeed(p))}\ \text{m/s}${g === DRUM ? String.raw` \quad j = ${texNum(md.factor, 4)}` : ""}`);
    return out;
  },

  params: [
    { key: "geom", label: "Sistema", unit: "", min: 0, max: 3, step: 1, default: 0, options: GEOMS.map((label, value) => ({ value, label })) },
    {
      key: "vista",
      label: "Vista",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 0,
      live: true,
      options: [
        { value: 0, label: "De cima, com areia" },
        { value: 1, label: "Superfície 3D (câmera lenta)" },
      ],
    },
    {
      key: "excit",
      label: "Excitação",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 0,
      live: true,
      options: [
        { value: 0, label: "Alto-falante na frequência f" },
        { value: 1, label: "Modo normal puro (escolha o nº)" },
      ],
    },
    { key: "f", label: "Frequência f", unit: "Hz", min: 20, max: 8000, step: 1, default: 390, log: true, live: true },
    {
      key: "varredura",
      label: "Varredura automática de f",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 0,
      live: true,
      options: [
        { value: 0, label: "Desligada" },
        { value: 1, label: "Ligada (60 s, do 1º ao 16º modo)" },
      ],
    },
    { key: "kmode", label: "Modo nº (ordem crescente de f)", unit: "", min: 1, max: 28, step: 1, default: 4, live: true },
    { key: "Q", label: "Fator de qualidade Q", unit: "", min: 5, max: 300, step: 1, default: 60, log: true, live: true },
    { key: "L", label: "Lado (ou diâmetro, ou lado a)", unit: "m", min: 0.1, max: 0.6, step: 0.01, default: 0.3 },
    { key: "h", label: "Placa: espessura", unit: "mm", min: 0.3, max: 4, step: 0.05, default: 1 },
    { key: "material", label: "Placa: material", unit: "", min: 0, max: MATERIAIS.length - 1, step: 1, default: 0, options: MATERIAIS.map((m, value) => ({ value, label: m.label })) },
    { key: "T", label: "Membrana: tensão T", unit: "N/m", min: 100, max: 8000, step: 10, default: 2000, log: true },
    { key: "sigma", label: "Membrana: densidade superficial σ", unit: "kg/m²", min: 0.02, max: 2, step: 0.01, default: 0.25, log: true },
    { key: "beta", label: "Retangular: razão b/a", unit: "", min: 0.4, max: 1, step: 0.01, default: 0.7 },
  ],

  observables: [
    { key: "f", label: "Frequência de excitação", unit: "Hz", value: (s, p, t) => driveFreq(p, t) },
    { key: "fj", label: "Frequência do modo dominante", unit: "Hz", value: (s, p, t) => modeFreqs(p)[field(p, s, t).dom]! },
    { key: "jdom", label: "Nº do modo dominante", unit: "", value: (s, p, t) => field(p, s, t).dom + 1 },
    { key: "nodal", label: "Areia sobre linhas nodais", unit: "%", value: (s, p, t) => nodalFraction(s, p, t) },
    {
      key: "resp",
      label: "Receptância no ponto de excitação",
      unit: "dB",
      value: (s, p, t) => 20 * Math.log10(receptance(p, s, driveFreq(p, t)) * modeFreqs(p)[0]! ** 2 + 1e-12),
    },
    { key: "f1", label: "Frequência do 1º modo", unit: "Hz", value: (_s, p) => modeFreqs(p)[0]! },
    { key: "c", label: "Velocidade da onda na membrana", unit: "m/s", value: (_s, p) => (isPlate(geomOf(p)) ? 0 : waveSpeed(p)) },
  ],
  chart: { x: "t", y: "nodal" },

  scenarios: [
    {
      id: "chladni",
      label: "Placa quadrada de Chladni",
      params: { geom: SQUARE, vista: 0, excit: 0, varredura: 0, f: 390, L: 0.3, h: 1, material: 0, Q: 60 },
      guide: `### Areia nas linhas nodais
1. A placa vibra presa pelo alto-falante no ponto marcado. Nas regiões que vibram muito a areia pula; nas **linhas nodais** ela fica parada e se acumula.
2. Ajuste $f$ até a figura ficar nítida: você está numa ressonância (o pico no gráfico à direita).
3. Ligue a **varredura**: as figuras mudam ao passar por cada modo; entre modos a areia quase não se organiza.
4. Arraste o ponto de excitação para cima de uma linha nodal: aquele modo some — ele não pode ser excitado num nó.
5. Dobre a espessura: todas as frequências dobram ($f \\propto h$ para placas).`,
      predict: [
        {
          question: "Se a espessura da placa dobrar, as frequências das figuras de Chladni:",
          options: ["não mudam", "dobram", "quadruplicam"],
          answer: 1,
          explanation: "$\\sqrt{D/\\rho h} \\propto \\sqrt{h^3/h} = h$: a frequência de cada modo é proporcional à espessura.",
        },
      ],
    },
    {
      id: "tambor",
      label: "Tambor: modos de Bessel",
      params: { geom: DRUM, vista: 1, excit: 1, kmode: 2, L: 0.3, T: 2000, sigma: 0.25 },
      guide: `### Membrana circular
1. Cada modo $(m, n)$ tem $m$ diâmetros nodais e $n-1$ círculos nodais (além da borda presa).
2. Percorra os modos pelo **nº do modo** e anote $f_j/f_1$: 1; 1,59; 2,14; 2,30; 2,65... Não são múltiplos inteiros — por isso o tambor não tem altura definida como uma corda.
3. Gire a câmera arrastando. Volte à vista de cima para ver a areia.`,
      predict: [
        {
          question: "As frequências dos modos de um tambor circular são:",
          options: ["múltiplos inteiros da fundamental, como numa corda", "proporcionais aos zeros das funções de Bessel (não harmônicas)", "todas iguais"],
          answer: 1,
          explanation: "$f_{mn} = j_{mn} c / (2\\pi R)$ e os zeros $j_{mn}$ (2,405; 3,832; 5,136; 5,520...) não são múltiplos uns dos outros.",
        },
      ],
    },
    {
      id: "placa-circular",
      label: "Placa circular",
      params: { geom: PLATE_DISC, vista: 0, excit: 0, varredura: 1, L: 0.3, h: 1, material: 1, Q: 80 },
      guide: `### Diâmetros e círculos
1. A varredura passa pelos modos da placa circular: surgem diâmetros nodais e círculos nodais.
2. A orientação dos diâmetros segue o ponto de excitação (ele fica sempre num ventre). Arraste-o e veja a figura girar.
3. Compare: na placa $f \\propto \\beta^2$, no tambor $f \\propto j$. Qual espectro é mais "espalhado"?`,
    },
    {
      id: "cavidade",
      label: "Membrana retangular (cavidade 2D)",
      params: { geom: RECT, vista: 1, excit: 1, kmode: 3, beta: 0.7, L: 0.4, T: 2000, sigma: 0.25 },
      guide: `### Modos de uma cavidade retangular
1. O modo $(n, m)$ tem $n-1$ linhas nodais verticais e $m-1$ horizontais: $f_{nm} = \\tfrac{c}{2}\\sqrt{(n/a)^2 + (m/b)^2}$.
2. Mude $b/a$ para 1: os modos $(1,2)$ e $(2,1)$ ficam com a mesma frequência (**degenerescência**).
3. Volte à excitação por frequência e coloque $f$ entre dois modos: a figura é uma mistura dos dois.`,
    },
  ],

  exercises: [
    {
      id: "tambor-f01",
      prompt: "Uma membrana circular de diâmetro {L} m tem tensão {T} N/m e densidade superficial {sigma} kg/m². Qual é a frequência do modo fundamental (j₀₁ = 2,405)?",
      vary: { L: [0.15, 0.6, 2], T: [500, 5000, 0], sigma: [0.1, 0.8, 2] },
      fixed: { geom: DRUM },
      answer: { label: "f₀₁", unit: "Hz", compute: (p) => (2.4048 * waveSpeed(p)) / (2 * PI * (num(p, "L") / 2)) },
      hint: "c = √(T/σ) e f = j c/(2πR).",
    },
    {
      id: "retangular",
      prompt: "Uma membrana retangular de lados a = {L} m e b = 0,5a tem ondas com velocidade c = √(T/σ), T = {T} N/m e σ = 0,25 kg/m². Qual é a frequência do modo (1,1)?",
      vary: { L: [0.2, 0.6, 2], T: [500, 5000, 0] },
      fixed: { geom: RECT, beta: 0.5, sigma: 0.25 },
      answer: { label: "f₁₁", unit: "Hz", compute: (p) => (waveSpeed(p) / 2) * Math.sqrt(1 / num(p, "L") ** 2 + 1 / (0.5 * num(p, "L")) ** 2) },
    },
  ],

  init(p): CState {
    const g = geomOf(p);
    const drive: [number, number] = isCirc(g) ? [0.42, 0.12] : g === RECT ? [-0.37, 0.21 * betaOf(p)] : [0.31, 0.17];
    return { sand: scatter(p, 7), seed: 11, drive, cam: { yaw: 0.7, pitch: 0.55 }, drag: null };
  },

  step(s, p, t, dt): CState {
    const F = field(p, s, t);
    const g = geomOf(p), beta = betaOf(p), hy = halfY(g, beta);
    const r = rng(s.seed);
    const k = 0.1 * Math.sqrt(dt / 0.02);
    const sand = s.sand.slice();
    for (let i = 0; i < sand.length; i += 2) {
      const a = relAmp(F, p, sand[i]!, sand[i + 1]!);
      // Grão sacudido com passo proporcional à amplitude local: difunde para fora dos ventres.
      const step = k * a;
      let x = sand[i]! + step * (2 * r() - 1), y = sand[i + 1]! + step * (2 * r() - 1);
      if (isCirc(g)) {
        const rr = Math.hypot(x, y);
        if (rr > 1) [x, y] = [(x / rr) * (2 - rr) * 0.999, (y / rr) * (2 - rr) * 0.999];
      } else {
        if (Math.abs(x) > 1) x = Math.sign(x) * (2 - Math.abs(x)) * 0.999;
        if (Math.abs(y) > hy) y = Math.sign(y) * (2 * hy - Math.abs(y)) * 0.999;
      }
      sand[i] = x;
      sand[i + 1] = y;
    }
    return { ...s, sand, seed: (s.seed * 1103515245 + 12345) >>> 0 };
  },
  dt: 0.02,
  sampleEvery: 5,
  maxSamples: 400,
  tEnd: 600,

  viewport() {
    return { xMin: -1.15, xMax: 3.35, yMin: -1.15, yMax: 1.18 };
  },

  pointer: {
    down(s, p, pt) {
      if (Math.round(num(p, "vista")) === 1) {
        if (pt.x > 1.15) return undefined;
        return { ...s, drag: { kind: "cam", x0: pt.x, y0: pt.y, cam0: s.cam } };
      }
      if (Math.hypot(pt.x - s.drive[0], pt.y - s.drive[1]) < 0.12) return { ...s, drag: { kind: "drive" } };
      return undefined;
    },
    move(s, p, pt, dragging) {
      if (!dragging || !s.drag) return undefined;
      if (s.drag.kind === "cam") {
        const c = orbit(s.drag.cam0, (pt.x - s.drag.x0) * 160, -(pt.y - s.drag.y0) * 160);
        return { ...s, cam: { yaw: c.yaw, pitch: clamp(c.pitch, 0.05, 1.5) } };
      }
      const g = geomOf(p), beta = betaOf(p);
      let x = clamp(pt.x, -0.98, 0.98), y = clamp(pt.y, -0.98 * halfY(g, beta), 0.98 * halfY(g, beta));
      const rr = Math.hypot(x, y);
      if (isCirc(g) && rr > 0.95) [x, y] = [(x / rr) * 0.95, (y / rr) * 0.95];
      if (!inside(g, beta, x, y)) return undefined;
      return { ...s, drive: [x, y] };
    },
    up: (s) => (s.drag ? { ...s, drag: null } : undefined),
    cursor: (s, p, pt) => (Math.round(num(p, "vista")) === 1 ? "grab" : Math.hypot(pt.x - s.drive[0], pt.y - s.drive[1]) < 0.12 ? "grab" : undefined),
  },
  actions: [
    { id: "espalhar", label: "Espalhar areia de novo", run: (s, p) => ({ ...s, sand: scatter(p, s.seed) }) },
    { id: "centro", label: "Excitar no centro", run: (s) => ({ ...s, drive: [0.001, 0.0005] }) },
  ],

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const { state: s, params: p, t } = frame;
    const F = field(p, s, t);
    if (Math.round(num(p, "vista")) === 1) render3d(d, s, p, F, t);
    else renderTop(d, s, p, F);
    renderResponse(d, s, p, F);
  },
});

function outline(d: Draw, p: Params, fill: string, stroke: string) {
  const g = geomOf(p), hy = halfY(g, betaOf(p));
  if (isCirc(g)) d.circle(0, 0, 1, { fill, stroke, width: 1.5 });
  else d.rect(-1, -hy, 2, 2 * hy, { fill, stroke, width: 1.5 });
}

function renderTop(d: Draw, s: CState, p: Params, F: Field) {
  const { theme, ctx } = d;
  const g = geomOf(p), beta = betaOf(p), hy = halfY(g, beta);
  outline(d, p, isPlate(g) ? (theme.dark ? "#3a4048" : "#c9cfd6") : theme.dark ? "#4a3d30" : "#eadbc4", theme.muted);
  // Mapa de amplitude |W| (tênue)
  const W = G + 1, cw = 2 / G, ch = (2 * hy) / G;
  ctx.save();
  if (isCirc(g)) {
    ctx.beginPath();
    ctx.arc(0, 0, 1, 0, 2 * PI);
    ctx.clip();
  }
  ctx.fillStyle = theme.accent;
  for (let j = 0; j < G; j++)
    for (let i = 0; i < G; i++) {
      const x = -1 + (i + 0.5) * cw, y = -hy + (j + 0.5) * ch;
      if (!inside(g, beta, x, y)) continue;
      const k = j * W + i;
      const a = Math.hypot(F.re[k]!, F.im[k]!) / F.max;
      ctx.globalAlpha = 0.35 * a;
      ctx.fillRect(x - cw / 2, y - ch / 2, cw * 1.02, ch * 1.02);
    }
  ctx.globalAlpha = 1;
  ctx.restore();
  // Areia
  ctx.fillStyle = theme.dark ? "#f2e3b5" : "#4a3a1c";
  const r = 1.3 * d.px;
  for (let i = 0; i < s.sand.length; i += 2) ctx.fillRect(s.sand[i]! - r, s.sand[i + 1]! - r, 2 * r, 2 * r);
  // Ponto de excitação
  d.circle(s.drive[0], s.drive[1], 0.045, { fill: theme.negative, stroke: theme.text, width: 1, alpha: 0.9 });
  d.text("excitação (arraste)", s.drive[0], s.drive[1], { color: theme.text, size: 11, dy: -16 });
  const md = modesOf(p)[F.dom]!;
  d.text(`modo dominante ${md.label}`, 0, 1.1, { color: theme.text, size: 12 });
}

function render3d(d: Draw, s: CState, p: Params, F: Field, t: number) {
  const { theme } = d;
  const g = geomOf(p), beta = betaOf(p), hy = halfY(g, beta);
  const pr = projector({ yaw: s.cam.yaw, pitch: s.cam.pitch, zoom: 0.78 });
  const ph = 2 * PI * 0.6 * t; // câmera lenta: 0,6 ciclo por segundo de simulação
  const cph = Math.cos(ph), sph = Math.sin(ph);
  const z = (x: number, y: number) => (0.32 * (sample(F.re, g, beta, x, y) * cph - sample(F.im, g, beta, x, y) * sph)) / F.max;
  const neg = theme.negative, pos = theme.positive, mid = theme.dark ? "#8a929c" : "#d4d8de";
  const col = (v: number) => (v >= 0 ? hexMix(mid, pos, clamp(v / 0.32, 0, 1)) : hexMix(mid, neg, clamp(-v / 0.32, 0, 1)));
  const faces = isCirc(g)
    ? surface(
        (r, th) => {
          const x = r * Math.cos(th), y = r * Math.sin(th);
          return [x, y, z(x, y)] as V3;
        },
        [0, 1],
        [0, 2 * PI],
        14,
        40,
        (r, th) => col(z(r * Math.cos(th), r * Math.sin(th))),
      )
    : surface((u, v) => [u, v, z(u, v)] as V3, [-1, 1], [-hy, hy], 26, Math.max(8, Math.round(26 * hy)), (u, v) => col(z(u, v)));
  renderFaces(d, pr, faces, { ambient: 0.55 });
  const q = pr.project([s.drive[0], s.drive[1], z(s.drive[0], s.drive[1])]);
  d.dot(q[0], q[1], 5, theme.text);
  d.text("arraste para girar · câmera lenta", 0, -1.08, { color: theme.muted, size: 11 });
  d.text(`modo dominante ${modesOf(p)[F.dom]!.label}`, 0, 1.1, { color: theme.text, size: 12 });
}

/** Curva de receptância no ponto de excitação com as frequências dos modos. */
function renderResponse(d: Draw, s: CState, p: Params, F: Field) {
  const { theme } = d;
  const fs = modeFreqs(p);
  const fa = 0.75 * fs[0]!, fb = 1.08 * fs[Math.min(15, fs.length - 1)]!;
  const X = (f: number) => PX0 + ((Math.log(f) - Math.log(fa)) / (Math.log(fb) - Math.log(fa))) * (PX1 - PX0);
  const vals: number[] = [];
  const freqs: number[] = [];
  for (let i = 0; i <= 260; i++) {
    const f = fa * (fb / fa) ** (i / 260);
    freqs.push(f);
    vals.push(20 * Math.log10(receptance(p, s, f) * fs[0]! ** 2 + 1e-12));
  }
  const vmax = Math.max(...vals), vmin = vmax - 70;
  const Y = (v: number) => PY0 + ((clamp(v, vmin, vmax) - vmin) / (vmax - vmin)) * (PY1 - PY0);
  d.rect(PX0, PY0, PX1 - PX0, PY1 - PY0, { stroke: theme.grid, width: 1 });
  fs.forEach((f, j) => {
    if (f < fa || f > fb) return;
    d.line(X(f), PY0, X(f), PY0 + 0.06, { color: j === F.dom ? theme.negative : theme.muted, width: j === F.dom ? 2 : 1 });
  });
  d.polyline(freqs.map((f, i) => [X(f), Y(vals[i]!)] as [number, number]), { color: theme.accent, width: 1.8 });
  if (F.f >= fa && F.f <= fb) d.line(X(F.f), PY0, X(F.f), PY1, { color: theme.negative, dash: [4, 3], width: 1.3 });
  d.text("resposta no ponto de excitação (dB)", (PX0 + PX1) / 2, PY1 + 0.07, { color: theme.text, size: 12 });
  d.text(`${fmt(fa)} Hz`, PX0, PY0 - 0.07, { color: theme.muted, size: 10, align: "left" });
  d.text(`${fmt(fb)} Hz`, PX1, PY0 - 0.07, { color: theme.muted, size: 10, align: "right" });
  d.text(`f = ${fmt(F.f, 4)} Hz`, (PX0 + PX1) / 2, PY0 - 0.2, { color: theme.negative, size: 13, weight: "600" });
  d.text(`modo ${F.dom + 1}: ${fmt(fs[F.dom]!, 4)} Hz`, (PX0 + PX1) / 2, PY0 - 0.36, { color: theme.text, size: 12 });
  // Tabela curta das razões f_j/f_1
  const ratios = fs.slice(0, 6).map((f) => fmt(f / fs[0]!, 3)).join(" · ");
  d.text(`f_j / f_1: ${ratios}`, (PX0 + PX1) / 2, PY0 - 0.52, { color: theme.muted, size: 11 });
}

export default chladniMembranas;
