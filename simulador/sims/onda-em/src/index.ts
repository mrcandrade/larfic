import { defineSim, draw, num, texNum, type Draw, type Params, type Theme } from "@fisilab/core";
import {
  DT,
  DX1,
  DX2,
  EPS0,
  H2,
  L1,
  MU0,
  N1,
  NX,
  NY,
  W2,
  bGap,
  bWire,
  capC,
  capI,
  capQ,
  capTau,
  energy1D,
  energy2D,
  fluxE,
  idx,
  maskFor,
  sourceValue,
  step1D,
  step2D,
  type CapParams,
} from "./fdtd.ts";

export * from "./fdtd.ts";

export interface OndaState {
  t: number;
  /** 1D: Ey e Bz; 2D: Ez, Hx e Hy (c·B, unidades normalizadas). */
  e: Float32Array;
  b: Float32Array;
  h2: Float32Array;
  /** Fonte e sonda: 1D usa só x; 2D usa (x, y). No capacitor, probe[0] é o raio r (m). */
  src: [number, number];
  probe: [number, number];
  drag: "" | "src" | "probe";
  /** Capacitor: carga (C), fluxo elétrico (V·m), corrente de deslocamento e de condução no último passo (A). */
  q: number;
  phiE: number;
  id: number;
  ic: number;
}

const ONDA1D = 0, ONDA2D = 1, CAP = 2;
const mode = (p: Params) => Math.round(num(p, "modo"));
const fonte = (p: Params) => Math.round(num(p, "fonte"));

export function capParams(p: Params): CapParams {
  return { emf: num(p, "fem", 100), R: num(p, "Rc", 10) * 1e9, a: num(p, "Rp", 10) / 100, d: num(p, "gap", 1) / 1000 };
}

const i1 = (x: number) => Math.max(1, Math.min(N1 - 1, Math.round(x / DX1)));
const i2 = (x: number) => Math.max(1, Math.min(NX - 2, Math.round(x / DX2)));
const j2 = (y: number) => Math.max(1, Math.min(NY - 2, Math.round(y / DX2)));

/** E e c·B na sonda (unidades normalizadas). */
export function probeEB(s: OndaState, p: Params): [number, number] {
  if (mode(p) === ONDA1D) {
    const i = i1(s.probe[0]);
    return [s.e[i] ?? 0, 0.5 * ((s.b[i] ?? 0) + (s.b[i - 1] ?? 0))];
  }
  if (mode(p) === ONDA2D) {
    const k = idx(i2(s.probe[0]), j2(s.probe[1]));
    const hx = 0.5 * ((s.b[k] ?? 0) + (s.b[k - NX] ?? 0));
    const hy = 0.5 * ((s.h2[k] ?? 0) + (s.h2[k - 1] ?? 0));
    return [s.e[k] ?? 0, Math.hypot(hx, hy)];
  }
  return [0, 0];
}

function energy(s: OndaState, p: Params): number {
  if (mode(p) === ONDA1D) return energy1D(s.e, s.b);
  if (mode(p) === ONDA2D) return energy2D(s.e, s.b, s.h2);
  return 0;
}

const empty = () => new Float32Array(0);

export const ondaEm = defineSim<OndaState>({
  id: "onda-em",
  title: "Corrente de deslocamento e onda eletromagnética",
  course: "FG III",
  topic: "Maxwell",
  priority: "P1",
  summary:
    "As equações de Maxwell resolvidas na grade de Yee (FDTD): uma onda 1D com E e B em fase refletindo num condutor, uma antena irradiando em 2D e um capacitor carregando, onde a corrente de deslocamento ε₀ dΦ_E/dt iguala a corrente de condução.",
  equations: [
    String.raw`\nabla\times\vec E = -\frac{\partial \vec B}{\partial t} \qquad \nabla\times\vec B = \mu_0 \vec J + \mu_0\varepsilon_0 \frac{\partial \vec E}{\partial t}`,
    String.raw`\text{1D: } \frac{\partial E_y}{\partial t} = -c^2\frac{\partial B_z}{\partial x} \quad \frac{\partial B_z}{\partial t} = -\frac{\partial E_y}{\partial x} \qquad c = \frac{1}{\sqrt{\mu_0\varepsilon_0}}`,
    String.raw`I_d = \varepsilon_0 \frac{d\Phi_E}{dt} \qquad \oint \vec B\cdot d\vec\ell = \mu_0 (I_c + I_d)`,
    String.raw`\text{Yee: } S = \frac{c\,\Delta t}{\Delta x} \le 1 \;(\text{1D}),\ \le \tfrac{1}{\sqrt 2}\;(\text{2D})`,
  ],
  liveEquations(s, p) {
    if (mode(p) === CAP) {
      const c = capParams(p);
      const r = s.probe[0];
      return [
        String.raw`I_c = ${texNum(s.ic)}\ \text{A} \qquad I_d = \varepsilon_0 \frac{\Delta\Phi_E}{\Delta t} = ${texNum(s.id)}\ \text{A} \qquad \tau = RC = ${texNum(capTau(c))}\ \text{s}`,
        String.raw`B(r = ${texNum(r * 100)}\ \text{cm}) = \frac{\mu_0 I_d(r)}{2\pi r} = ${texNum(bGap(c, s.id, r))}\ \text{T}`,
      ];
    }
    const [E, B] = probeEB(s, p);
    const S = mode(p) === ONDA1D ? DT / DX1 : DT / DX2;
    const f = num(p, "f", 1);
    return [
      String.raw`E = ${texNum(E)} \qquad cB = ${texNum(B)} \qquad S = c\Delta t/\Delta x = ${texNum(S)}`,
      ...(fonte(p) === 1 ? [String.raw`\lambda = c/f = ${texNum(1 / f)} \quad (\text{em unidades da grade: } ${texNum(1 / f / (mode(p) === ONDA1D ? DX1 : DX2))}\ \Delta x)`] : []),
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
        { value: 0, label: "Onda 1D (FDTD)" },
        { value: 1, label: "Antena em 2D (FDTD, TMz)" },
        { value: 2, label: "Capacitor carregando" },
      ],
    },
    {
      key: "fonte",
      label: "Fonte",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 0,
      options: [
        { value: 0, label: "Pulso gaussiano" },
        { value: 1, label: "Senoidal contínua" },
      ],
    },
    { key: "f", label: "Frequência da fonte (c = 1)", unit: "", min: 0.3, max: 2, step: 0.05, default: 1, live: true },
    {
      key: "borda",
      label: "Extremo direito (1D)",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 0,
      options: [
        { value: 0, label: "Condutor perfeito (reflete)" },
        { value: 1, label: "Absorvente" },
      ],
    },
    {
      key: "obst",
      label: "Obstáculo (2D)",
      unit: "",
      min: 0,
      max: 2,
      step: 1,
      default: 0,
      options: [
        { value: 0, label: "Espaço livre" },
        { value: 1, label: "Placa condutora" },
        { value: 2, label: "Parede com fenda dupla" },
      ],
    },
    { key: "fem", label: "Fem da bateria (capacitor)", unit: "V", min: 10, max: 500, step: 10, default: 100 },
    { key: "Rc", label: "Resistência (capacitor)", unit: "GΩ", min: 0.5, max: 50, step: 0.5, default: 10, log: true },
    { key: "Rp", label: "Raio das placas", unit: "cm", min: 2, max: 15, step: 0.5, default: 10 },
    { key: "gap", label: "Separação das placas", unit: "mm", min: 0.5, max: 5, step: 0.1, default: 1 },
  ],

  observables: [
    { key: "E", label: "E na sonda (normalizado)", unit: "", value: (s, p) => probeEB(s, p)[0] },
    { key: "cB", label: "c·B na sonda (normalizado)", unit: "", value: (s, p) => probeEB(s, p)[1] },
    { key: "U", label: "Energia na grade (normalizada)", unit: "", value: (s, p) => energy(s, p) },
    { key: "q", label: "Carga no capacitor", unit: "C", value: (s) => s.q },
    { key: "Ic", label: "Corrente de condução", unit: "A", value: (s) => s.ic },
    { key: "Id", label: "Corrente de deslocamento ε₀ dΦ_E/dt", unit: "A", value: (s) => s.id },
    { key: "Bgap", label: "B entre as placas na sonda", unit: "T", value: (s, p) => (mode(p) === CAP ? bGap(capParams(p), s.id, s.probe[0]) : 0) },
  ],
  chart: { x: "t", y: "E" },

  scenarios: [
    {
      id: "pulso",
      label: "Pulso 1D e reflexão",
      params: { modo: ONDA1D, fonte: 0, borda: 0 },
      guide: `### Uma onda nasce das equações de Maxwell
1. A fonte (em $x = 2$) injeta um pulso de corrente. Dois pulsos saem, um para cada lado: o da esquerda some na borda absorvente.
2. Veja $E_y$ (vertical) e $cB_z$ (em perspectiva): no pulso que vai para a direita eles têm **o mesmo sinal**, em fase.
3. Meça a velocidade: arraste a sonda, rode e anote em que instante o pico passa por dois pontos. Em unidades normalizadas, $c = 1$.
4. No condutor, $E$ precisa ser zero. Observe o sinal de $E$ e de $B$ no pulso refletido.`,
      predict: [
        {
          question: "Quando o pulso reflete no condutor perfeito, o campo elétrico refletido:",
          options: ["volta com o mesmo sinal", "volta invertido", "não volta: é absorvido", "volta com o dobro da amplitude"],
          answer: 1,
          explanation: "Na superfície do condutor $E_{\\text{tangencial}} = 0$: a onda refletida precisa ter $E$ oposto ao da incidente. Como ela anda no sentido contrário, $B$ mantém o sinal (e dobra junto à parede).",
        },
      ],
    },
    {
      id: "senoidal",
      label: "Onda senoidal",
      params: { modo: ONDA1D, fonte: 1, borda: 1, f: 0.5 },
      guide: `### Comprimento de onda e fase
1. Com a fonte senoidal, meça a distância entre duas cristas de $E$ e compare com $\\lambda = c/f$.
2. No gráfico, plote **E** e compare com **c·B**: na onda que segue para a direita os dois sobem e descem juntos.
3. Troque o extremo para **condutor**: a soma da onda incidente com a refletida forma uma **onda estacionária**, com nós de $E$ a cada $\\lambda/2$ a partir da parede.`,
      predict: [
        {
          question: "Numa onda eletromagnética plana no vácuo, E e B estão:",
          options: ["em fase, perpendiculares entre si e à propagação", "defasados de 90°", "paralelos entre si", "em fase, mas B ao longo da propagação"],
          answer: 0,
          explanation: "Das equações de Maxwell, $E_y = cB_z$ para a onda que segue em $+x$: mesma fase, $\\vec E \\perp \\vec B$ e $\\vec E\\times\\vec B$ aponta na direção de propagação.",
        },
      ],
    },
    {
      id: "antena",
      label: "Antena irradiando (2D)",
      params: { modo: ONDA2D, fonte: 1, f: 1, obst: 0 },
      guide: `### Uma antena vista de cima
1. A antena é um fio perpendicular à tela com corrente oscilante (modo TMz). Ela irradia frentes circulares com $E_z$ (vermelho: saindo, azul: entrando).
2. Arraste a antena e a sonda. As bordas absorvem a onda (aproximadamente: veja o pequeno reflexo nos cantos).
3. Escolha **Placa condutora** e observe a sombra e a interferência entre onda direta e refletida.
4. Escolha **Parede com fenda dupla** e procure as franjas de interferência atrás da parede.`,
    },
    {
      id: "capacitor",
      label: "Capacitor e corrente de deslocamento",
      params: { modo: CAP },
      guide: `### A corrente que atravessa o vácuo
1. Rode: o capacitor carrega por $R$ com $\\tau = RC$. No gráfico, compare **Corrente de condução** com **Corrente de deslocamento**.
2. $I_d = \\varepsilon_0\\, d\\Phi_E/dt$ é calculada pela variação do fluxo elétrico entre as placas a cada passo. Ela é igual a $I_c$ em todo instante.
3. No gráfico de baixo, arraste a sonda em $r$: entre as placas, $B$ cresce linearmente até a borda e depois cai como $1/r$, exatamente como em volta do fio.`,
      predict: [
        {
          question: "Entre as placas de um capacitor que está carregando não há corrente de condução. Ali, a uma distância maior que o raio das placas, o campo magnético é:",
          options: ["zero", "igual ao campo ao redor do fio, à mesma distância", "o dobro do campo ao redor do fio", "infinito"],
          answer: 1,
          explanation: "Pela lei de Ampère-Maxwell, um círculo ali envolve toda a corrente de deslocamento $I_d = I_c$: $B = \\mu_0 I_c/(2\\pi r)$, igual ao do fio.",
        },
      ],
    },
  ],

  exercises: [
    {
      id: "lambda",
      prompt: "Uma antena emite ondas de {fMHz} MHz no vácuo. Qual é o comprimento de onda?",
      vary: { fMHz: [50, 900, 0] },
      fixed: { modo: ONDA2D, fonte: 1 },
      answer: { label: "λ", unit: "m", compute: (p) => 299.792458 / num(p, "fMHz", 100) },
      hint: "λ = c/f, com c = 3,00 × 10⁸ m/s.",
    },
    {
      id: "deslocamento",
      prompt: "Um capacitor tem placas circulares de raio {Rp} cm. O campo elétrico entre elas cresce à taxa de {k} × 10¹² V/(m·s). Qual é a corrente de deslocamento?",
      vary: { Rp: [2, 15, 1], k: [0.5, 5, 1] },
      fixed: { modo: CAP },
      answer: { label: "I_d", unit: "A", compute: (p) => EPS0 * Math.PI * (num(p, "Rp", 10) / 100) ** 2 * num(p, "k", 1) * 1e12 },
      hint: "I_d = ε₀ dΦ_E/dt = ε₀ A dE/dt.",
    },
    {
      id: "b-placas",
      prompt: "Um capacitor de placas circulares de raio {Rp} cm é carregado por uma corrente de {I} A. Qual é o campo magnético entre as placas a {r} cm do eixo?",
      vary: { Rp: [5, 15, 1], I: [0.5, 5, 1], r: [1, 4, 1] },
      fixed: { modo: CAP },
      answer: { label: "B", unit: "μT", compute: (p) => ((MU0 * num(p, "I") * (num(p, "r") / 100)) / (2 * Math.PI * (num(p, "Rp", 10) / 100) ** 2)) * 1e6 },
      hint: "A corrente de deslocamento envolvida por um círculo de raio r < R é I r²/R².",
    },
  ],

  init(p) {
    const m = mode(p);
    const base = { t: 0, drag: "" as const, q: 0, phiE: 0, id: 0, ic: 0, h2: empty() };
    if (m === ONDA1D) return { ...base, e: new Float32Array(N1 + 1), b: new Float32Array(N1), src: [2, 0], probe: [6, 0] };
    if (m === ONDA2D) return { ...base, e: new Float32Array(NX * NY), b: new Float32Array(NX * NY), h2: new Float32Array(NX * NY), src: [1.5, H2 / 2], probe: [3.8, H2 / 2 + 0.6] };
    const c = capParams(p);
    return { ...base, e: empty(), b: empty(), src: [0, 0], probe: [c.a * 0.5, 0], ic: c.emf / c.R, id: c.emf / c.R };
  },

  step(s, p, t, dt) {
    const m = mode(p);
    const tn = t + dt;
    if (m === ONDA1D) {
      const [e, b] = step1D(s.e, s.b, i1(s.src[0]), sourceValue(fonte(p), num(p, "f", 1), tn), Math.round(num(p, "borda")) === 0);
      return { ...s, t: tn, e, b };
    }
    if (m === ONDA2D) {
      const [e, b, h2] = step2D(s.e, s.b, s.h2, i2(s.src[0]), j2(s.src[1]), 0.5 * sourceValue(fonte(p), num(p, "f", 1), tn), maskFor(Math.round(num(p, "obst"))));
      return { ...s, t: tn, e, b, h2 };
    }
    // Capacitor: carga exata do RC; I_d pela variação do fluxo elétrico no passo.
    const c = capParams(p);
    const q = capQ(c, tn);
    const phiE = fluxE(c, q, c.a);
    return { ...s, t: tn, q, phiE, id: (EPS0 * (phiE - s.phiE)) / dt, ic: capI(c, t + dt / 2) };
  },
  dt: DT,
  sampleEvery: 10,
  maxSamples: 300,

  pointer: {
    down(s, p, pt) {
      const m = mode(p);
      if (m === CAP) {
        if (pt.y > PLOT.y1 + 1 || pt.y < PLOT.y0 - 1) return undefined;
        return { ...s, drag: "probe", probe: [rFromX(p, pt.x), 0] };
      }
      const near = (q: [number, number]) => (m === ONDA1D ? Math.abs(q[0] - pt.x) < 0.25 : Math.hypot(q[0] - pt.x, q[1] - pt.y) < 0.2);
      if (near(s.src)) return { ...s, drag: "src" };
      return { ...s, drag: "probe", probe: clampPt(m, pt.x, pt.y) };
    },
    move(s, p, pt, dragging) {
      if (!dragging || !s.drag) return undefined;
      const m = mode(p);
      if (m === CAP) return { ...s, probe: [rFromX(p, pt.x), 0] };
      return s.drag === "src" ? { ...s, src: clampPt(m, pt.x, pt.y) } : { ...s, probe: clampPt(m, pt.x, pt.y) };
    },
    up: (s) => (s.drag ? { ...s, drag: "" } : undefined),
    cursor(s, p, pt) {
      const m = mode(p);
      if (m === CAP) return pt.y < PLOT.y1 + 1 && pt.y > PLOT.y0 - 1 ? "ew-resize" : undefined;
      const d = m === ONDA1D ? Math.abs(s.src[0] - pt.x) : Math.hypot(s.src[0] - pt.x, s.src[1] - pt.y);
      return d < 0.25 ? "grab" : "crosshair";
    },
  },

  viewport(p) {
    const m = mode(p);
    if (m === ONDA1D) return { xMin: -0.3, xMax: L1 + 0.5, yMin: -2.3, yMax: 2.2, unit: "" };
    if (m === ONDA2D) return { xMin: -0.05, xMax: W2 + 0.05, yMin: -0.35, yMax: H2 + 0.3, unit: "" };
    return { xMin: -20, xMax: 20, yMin: -16, yMax: 12, unit: "" };
  },

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const { state: s, params: p, theme } = frame;
    const m = mode(p);
    if (m === ONDA1D) render1D(d, theme, s, p);
    else if (m === ONDA2D) render2D(d, theme, s, p);
    else renderCap(d, theme, s, p);
  },
});

function clampPt(m: number, x: number, y: number): [number, number] {
  if (m === ONDA1D) return [Math.max(DX1, Math.min(L1 - DX1, x)), 0];
  return [Math.max(DX2, Math.min(W2 - DX2, x)), Math.max(DX2, Math.min(H2 - DX2, y))];
}

// ---------- 1D ----------
function render1D(d: Draw, theme: Theme, s: OndaState, p: Params) {
  const K = 1.4; // altura visual por unidade de campo
  const ob: [number, number] = [0.32, -0.42]; // direção z em perspectiva
  d.line(0, 0, L1, 0, { color: theme.muted, width: 1 });
  for (let x = 0; x <= L1; x += 1) {
    d.line(x, -0.06, x, 0.06, { color: theme.muted, width: 1 });
    d.text(String(x), x, -2.05, { color: theme.muted, size: 10 });
  }
  d.text("x (c = 1)", L1 + 0.25, -2.05, { color: theme.muted, size: 10, align: "right" });
  // c·B em perspectiva (eixo z oblíquo)
  const bpts: [number, number][] = [];
  for (let i = 0; i < N1; i += 2) bpts.push([(i + 0.5) * DX1 + ob[0] * K * s.b[i]!, ob[1] * K * s.b[i]! * 2]);
  d.polyline(bpts, { color: theme.series[1]!, width: 2 });
  const epts: [number, number][] = [];
  for (let i = 0; i <= N1; i += 2) epts.push([i * DX1, K * s.e[i]!]);
  d.polyline(epts, { color: theme.accent, width: 2.5 });
  for (let i = 10; i < N1; i += 20) {
    const ev = s.e[i]!, bv = s.b[i]!;
    if (Math.abs(ev) > 0.03) d.arrow(i * DX1, 0, 0, K * ev, { color: theme.accent, width: 1.2, head: 6, alpha: 0.6 });
    if (Math.abs(bv) > 0.03) d.arrow(i * DX1, 0, ob[0] * K * bv, ob[1] * K * bv * 2, { color: theme.series[1]!, width: 1.2, head: 6, alpha: 0.6 });
  }
  if (Math.round(num(p, "borda")) === 0) {
    d.support(L1, -1.8, L1, 1.8, { color: theme.text });
    d.text("condutor", L1 + 0.05, 1.95, { color: theme.text, size: 11, align: "right" });
  } else d.text("absorvente", L1, 1.95, { color: theme.muted, size: 11, align: "right" });
  d.text("absorvente", 0, 1.95, { color: theme.muted, size: 11, align: "left" });
  // Fonte e sonda
  d.rect(s.src[0] - 0.06, -0.25, 0.12, 0.5, { fill: theme.series[2]! });
  d.text("fonte", s.src[0], -0.45, { color: theme.series[2]!, size: 11 });
  d.line(s.probe[0], -1.8, s.probe[0], 1.8, { color: theme.text, dash: [4, 4], width: 1 });
  const [E, B] = probeEB(s, p);
  d.text(`sonda: E = ${f3(E)}  cB = ${f3(B)}`, s.probe[0] + 0.1, 1.65, { color: theme.text, size: 11, align: s.probe[0] > 7 ? "right" : "left", dx: s.probe[0] > 7 ? -12 : 0 });
  d.text("E_y (vertical)", 0.2, -1.5, { color: theme.accent, size: 11, align: "left", weight: "600" });
  d.text("c·B_z (eixo z em perspectiva)", 0.2, -1.78, { color: theme.series[1]!, size: 11, align: "left", weight: "600" });
  d.text(`t = ${f3(s.t)}`, L1 - 0.1, -1.6, { color: theme.muted, size: 11, align: "right" });
}

const f3 = (v: number) => (Math.abs(v) < 5e-4 ? "0" : Number(v.toPrecision(3)).toString().replace(".", ","));

// ---------- 2D ----------
let offscreen: HTMLCanvasElement | null = null;

function hexRgb(c: string): [number, number, number] {
  const m = /^#([0-9a-f]{6})$/i.exec(c.trim());
  if (!m) return [128, 128, 128];
  const n = parseInt(m[1]!, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function render2D(d: Draw, theme: Theme, s: OndaState, p: Params) {
  const ez = s.e;
  const si = i2(s.src[0]), sj = j2(s.src[1]);
  let max = 0;
  for (let j = 0; j < NY; j++)
    for (let i = 0; i < NX; i++) if (Math.abs(i - si) > 3 || Math.abs(j - sj) > 3) max = Math.max(max, Math.abs(ez[idx(i, j)]!));
  const scale = Math.max(max * 0.8, 1e-4);
  const pos = hexRgb(theme.positive), neg = hexRgb(theme.negative);
  d.rect(-DX2 / 2, -DX2 / 2, NX * DX2, NY * DX2, { stroke: theme.grid, width: 1 });
  if (typeof document !== "undefined") {
    offscreen ??= document.createElement("canvas");
    offscreen.width = NX;
    offscreen.height = NY;
    const octx = offscreen.getContext("2d");
    if (octx) {
      const img = octx.createImageData(NX, NY);
      for (let j = 0; j < NY; j++)
        for (let i = 0; i < NX; i++) {
          const v = Math.max(-1, Math.min(1, ez[idx(i, j)]! / scale));
          const c = v > 0 ? pos : neg;
          const o = 4 * (i + NX * j); // linha j da imagem = y crescente (o palco tem y para cima)
          img.data[o] = c[0];
          img.data[o + 1] = c[1];
          img.data[o + 2] = c[2];
          img.data[o + 3] = Math.round(255 * Math.abs(v) ** 0.7);
        }
      octx.putImageData(img, 0, 0);
      d.ctx.imageSmoothingEnabled = true;
      d.ctx.drawImage(offscreen, -DX2 / 2, -DX2 / 2, NX * DX2, NY * DX2);
    }
  } else {
    for (let j = 0; j < NY; j += 3)
      for (let i = 0; i < NX; i += 3) {
        const v = Math.max(-1, Math.min(1, ez[idx(i, j)]! / scale));
        if (Math.abs(v) > 0.05) d.rect(i * DX2, j * DX2, 3 * DX2, 3 * DX2, { fill: v > 0 ? theme.positive : theme.negative, alpha: Math.abs(v) });
      }
  }
  // Condutores
  const mask = maskFor(Math.round(num(p, "obst")));
  for (let j = 0; j < NY; j++)
    for (let i = 0; i < NX; i++) if (mask[idx(i, j)]) d.rect(i * DX2 - DX2 / 2, j * DX2 - DX2 / 2, DX2, DX2, { fill: theme.text, alpha: 0.85 });
  // Antena e sonda
  d.circle(s.src[0], s.src[1], 0.07, { fill: theme.series[2]!, stroke: theme.text, width: 1.5 });
  d.text("antena (fio ⊥ tela)", s.src[0], s.src[1] - 0.17, { color: theme.text, size: 11 });
  d.circle(s.probe[0], s.probe[1], 0.06, { stroke: theme.text, width: 2 });
  const [E, B] = probeEB(s, p);
  d.text(`E_z = ${f3(E)}  c|B| = ${f3(B)}`, s.probe[0], s.probe[1] + 0.15, { color: theme.text, size: 11 });
  d.text("E_z: vermelho saindo da tela, azul entrando. Bordas absorventes (Mur).", 0, -0.2, { color: theme.muted, size: 11, align: "left" });
  d.text(`t = ${f3(s.t)}`, W2, -0.2, { color: theme.muted, size: 11, align: "right" });
}

// ---------- Capacitor ----------
const PLOT = { x0: -17, x1: 17, y0: -14.5, y1: -4 };
const rMax = (p: Params) => 2 * capParams(p).a;
const rFromX = (p: Params, x: number) => Math.max(rMax(p) * 0.005, Math.min(rMax(p), ((x - PLOT.x0) / (PLOT.x1 - PLOT.x0)) * rMax(p)));

function renderCap(d: Draw, theme: Theme, s: OndaState, p: Params) {
  const c = capParams(p);
  const Imax = c.emf / c.R;
  const lvl = Math.max(0, Math.min(1, s.ic / Imax));
  const qn = s.q / (capC(c) * c.emf);
  const cy = 4.5, H = 5, gx = 1.4;
  const wire = theme.text;
  // Circuito: bateria e resistor embaixo, fios até as placas
  d.line(-gx, cy, -14, cy, { color: wire, width: 2 });
  d.line(gx, cy, 14, cy, { color: wire, width: 2 });
  d.line(-14, cy, -14, cy - 3.5, { color: wire, width: 2 });
  d.line(14, cy, 14, cy - 3.5, { color: wire, width: 2 });
  d.line(-14, cy - 3.5, -3, cy - 3.5, { color: wire, width: 2 });
  d.line(3, cy - 3.5, 14, cy - 3.5, { color: wire, width: 2 });
  d.line(-3, cy - 3.5 - 0.7, -3, cy - 3.5 + 0.7, { color: wire, width: 3 });
  d.line(-2.4, cy - 3.5 - 0.4, -2.4, cy - 3.5 + 0.4, { color: wire, width: 5 });
  d.text("ε", -2.7, cy - 2.2, { color: wire, size: 12 });
  d.line(-2.4, cy - 3.5, 1, cy - 3.5, { color: wire, width: 2 });
  d.spring(1, cy - 3.5, 3, cy - 3.5, { color: wire, coils: 5, amplitudePx: 5 });
  d.text("R", 2, cy - 2.6, { color: wire, size: 12 });
  // Placas
  d.line(-gx, cy - H, -gx, cy + H, { color: theme.positive, width: 5 });
  d.line(gx, cy - H, gx, cy + H, { color: theme.negative, width: 5 });
  d.text("+q", -gx - 0.8, cy + H + 0.6, { color: theme.positive, size: 12, weight: "600" });
  d.text("−q", gx + 0.8, cy + H + 0.6, { color: theme.negative, size: 12, weight: "600" });
  // Linhas de E: densidade ∝ q
  const nLines = Math.round(1 + 10 * qn);
  for (let k = 0; k < nLines; k++) {
    const y = cy - H + ((k + 0.5) * 2 * H) / nLines;
    d.arrow(-gx + 0.15, y, 2 * gx - 0.3, 0, { color: theme.accent, width: 1.2, head: 6, alpha: 0.75 });
  }
  // Correntes de condução (nos fios) e de deslocamento (entre as placas), mesmo tamanho
  const L = 14 + 50 * lvl;
  d.arrowPx(-9, cy + 0.6, 1, 0, L, { color: theme.series[1]!, width: 3 });
  d.text("I_c", -9, cy + 1.4, { color: theme.series[1]!, weight: "700" });
  d.arrowPx(9, cy + 0.6, 1, 0, L, { color: theme.series[1]!, width: 3 });
  d.arrowPx(-L * d.px / 2, cy + H + 1.6, 1, 0, L, { color: theme.series[4] ?? theme.accent, width: 3, dash: [5, 3] });
  d.text("I_d = ε₀ dΦ_E/dt", 0, cy + H + 2.5, { color: theme.series[4] ?? theme.accent, weight: "700", size: 12 });
  d.text(`I_c = ${fmtSI(s.ic, "A")}    I_d = ${fmtSI(s.id, "A")}    q = ${fmtSI(s.q, "C")}`, -19.5, 11.3, { color: theme.text, size: 12, weight: "600", align: "left" });
  d.text("separação fora de escala", 0, cy - H - 0.7, { color: theme.muted, size: 10 });

  // Gráfico B(r)
  const rm = rMax(p);
  const Bm = bWire(Math.max(s.ic, 1e-30), c.a) * 1.15;
  const X = (r: number) => PLOT.x0 + (r / rm) * (PLOT.x1 - PLOT.x0);
  const Y = (B: number) => PLOT.y0 + Math.min(1.2, B / Bm) * (PLOT.y1 - PLOT.y0) / 1.2;
  d.line(PLOT.x0, PLOT.y0, PLOT.x1, PLOT.y0, { color: theme.muted, width: 1 });
  d.line(PLOT.x0, PLOT.y0, PLOT.x0, PLOT.y1, { color: theme.muted, width: 1 });
  d.line(X(c.a), PLOT.y0, X(c.a), PLOT.y1, { color: theme.grid, width: 1, dash: [4, 4] });
  d.text("borda da placa", X(c.a), PLOT.y1 + 0.4, { color: theme.muted, size: 10 });
  d.text("r", PLOT.x1 + 0.6, PLOT.y0, { color: theme.muted, size: 11 });
  d.text(`${fmtNum(rm * 100)} cm`, PLOT.x1, PLOT.y0 - 0.6, { color: theme.muted, size: 10 });
  d.text("B(r)", PLOT.x0, PLOT.y1 + 0.5, { color: theme.muted, size: 11 });
  d.plot((x) => Y(bWire(s.ic, ((x - PLOT.x0) / (PLOT.x1 - PLOT.x0)) * rm)), X(rm * 0.08), PLOT.x1, { color: theme.series[1]!, width: 2, dash: [6, 4] });
  d.plot((x) => Y(bGap(c, s.id, ((x - PLOT.x0) / (PLOT.x1 - PLOT.x0)) * rm)), PLOT.x0, PLOT.x1, { color: theme.series[4] ?? theme.accent, width: 2.5 });
  const r = s.probe[0];
  const Bp = bGap(c, s.id, r);
  d.line(X(r), PLOT.y0, X(r), PLOT.y1, { color: theme.text, width: 1, dash: [2, 3] });
  d.dot(X(r), Y(Bp), 5, theme.text);
  d.text(`r = ${fmtNum(r * 100)} cm   B = ${fmtSI(Bp, "T")}  (arraste)`, X(r), Y(Bp) + 0.9, { color: theme.text, size: 11, align: X(r) > 5 ? "right" : "left" });
  d.text("— entre as placas (Ampère-Maxwell com I_d)", PLOT.x1, PLOT.y1 - 0.2, { color: theme.series[4] ?? theme.accent, size: 11, align: "right" });
  d.text("- - ao redor do fio (Ampère com I_c)", PLOT.x1, PLOT.y1 - 1.1, { color: theme.series[1]!, size: 11, align: "right" });
}

const fmtNum = (v: number) => Number(v.toPrecision(3)).toString().replace(".", ",");
function fmtSI(v: number, u: string): string {
  if (v === 0) return `0 ${u}`;
  const e = Math.max(-15, Math.min(0, Math.floor(Math.log10(Math.abs(v)) / 3) * 3));
  const pre: Record<number, string> = { [-15]: "f", [-12]: "p", [-9]: "n", [-6]: "μ", [-3]: "m", 0: "" };
  return `${fmtNum(v / 10 ** e)} ${pre[e]}${u}`;
}


export default ondaEm;
