import { defineSim, draw, num, texNum, type Draw, type Params } from "@fisilab/core";
import { fresnel, mainPath, trace, vdir, type Boundary, type Pol, type RaySeg, type Scene, type V } from "./rays.ts";

export * from "./rays.ts";

/** Estado: laser (posição e direção) e o que está sendo arrastado. Na miragem a posição é física (m). */
export interface RefState {
  lx: number;
  ly: number;
  /** Direção do feixe (rad, a partir de +x). */
  ang: number;
  drag: null | "laser" | "rot";
}

const DEG = Math.PI / 180;
const mode = (p: Params) => Math.round(num(p, "modo"));

// ---------------------------------------------------------------- interface plana
const VP0 = { xMin: -2.2, xMax: 2.2, yMin: -1.6, yMax: 1.6 };

function sceneInterface(p: Params): Scene {
  const n1 = num(p, "n1", 1);
  const n2 = num(p, "n2", 1.5);
  return {
    boundaries: [{ kind: "seg", a: [-50, 0], b: [50, 0], tag: "interface" }],
    nAt: ([, y]) => (y > 0 ? n1 : n2),
  };
}

// ---------------------------------------------------------------- dioptro esférico
/** Janela do dioptro (cm); vértice da superfície em x = 0, eixo ótico em y = 0. */
const VP3 = { xMin: -40, xMax: 60, yMin: -22, yMax: 22 };

/** Raio de curvatura do dioptro (cm), com sinal: R > 0 com o centro do lado de n₂ (superfície convexa para o objeto). */
export const dioptR = (p: Params) => {
  const R = num(p, "Rd", 10);
  return (R >= 0 ? 1 : -1) * Math.max(2, Math.abs(R));
};
/** Meia-abertura da superfície (cm). */
export const dioptH = (p: Params) => Math.min(0.85 * Math.abs(dioptR(p)), 16);
/** Perfil da superfície: x do vértice em função de y. */
export const sagX = (R: number, y: number) => R - Math.sign(R) * Math.sqrt(Math.max(0, R * R - y * y));

/** Imagem paraxial de um objeto a uma distância p (cm, > 0 real) do vértice: n₁/p + n₂/i = (n₂ − n₁)/R. */
export function dioptImage(n1: number, n2: number, R: number, pObj: number): { i: number; m: number } {
  const den = (n2 - n1) / R - n1 / pObj;
  const i = Math.abs(den) < 1e-12 ? Infinity : n2 / den;
  return { i, m: Number.isFinite(i) ? -(n1 * i) / (n2 * pObj) : Infinity };
}

export function sceneDioptro(p: Params): Scene {
  const n1 = num(p, "n1", 1);
  const n2 = num(p, "n2", 1.5);
  const R = dioptR(p);
  const phi = Math.asin(Math.min(1, dioptH(p) / Math.abs(R)));
  const mid = R > 0 ? Math.PI : 0;
  return {
    boundaries: [{ kind: "arc", c: [R, 0], r: Math.abs(R), a0: mid - phi, a1: mid + phi, tag: "dioptro" }],
    nAt: ([x, y]) => (Math.abs(y) < Math.abs(R) ? (x > sagX(R, y) ? n2 : n1) : x > 0 ? n2 : n1),
  };
}

// ---------------------------------------------------------------- fibra ótica
/** Largura do núcleo e posição da face de entrada (unidades do palco, mm). */
export const FIBER_W = 1;
export const FIBER_X0 = -4;
const FIBER_LEN = 8;

export const fiberBend = (p: Params) => {
  const r = num(p, "Rb");
  return r < 0.75 ? 0 : r;
};

function fiberCore([x, y]: V, Rb: number): boolean {
  const w = FIBER_W / 2;
  if (Rb === 0) return x >= FIBER_X0 && x <= FIBER_X0 + FIBER_LEN && Math.abs(y) < w;
  if (x >= FIBER_X0 && x <= 0 && Math.abs(y) < w) return true;
  if (x >= 0 && y <= Rb) return Math.abs(Math.hypot(x, y - Rb) - Rb) < w;
  return false;
}

function fiberBeyond([x, y]: V, Rb: number): boolean {
  return Rb === 0 ? x > FIBER_X0 + FIBER_LEN : x > 0 && y > Rb;
}

export function sceneFiber(p: Params): Scene {
  const nCore = num(p, "n1", 1.5);
  const nClad = num(p, "n2", 1.45);
  const Rb = fiberBend(p);
  const w = FIBER_W / 2;
  const x0 = FIBER_X0;
  const B: Boundary[] = [
    { kind: "seg", a: [x0, -w], b: [x0, w], tag: "entrada" },
    { kind: "seg", a: [x0, w], b: [x0, 60] },
    { kind: "seg", a: [x0, -w], b: [x0, -60] },
  ];
  if (Rb === 0) {
    const x1 = x0 + FIBER_LEN;
    B.push(
      { kind: "seg", a: [x0, w], b: [x1, w], tag: "parede" },
      { kind: "seg", a: [x0, -w], b: [x1, -w], tag: "parede" },
      { kind: "seg", a: [x1, -w], b: [x1, w], tag: "saida" },
      { kind: "seg", a: [x1, w], b: [x1, 60] },
      { kind: "seg", a: [x1, -w], b: [x1, -60] },
    );
  } else {
    B.push(
      { kind: "seg", a: [x0, w], b: [0, w], tag: "parede" },
      { kind: "seg", a: [x0, -w], b: [0, -w], tag: "parede" },
      { kind: "arc", c: [0, Rb], r: Rb - w, a0: -Math.PI / 2, a1: 0, tag: "parede" },
      { kind: "arc", c: [0, Rb], r: Rb + w, a0: -Math.PI / 2, a1: 0, tag: "parede" },
      { kind: "seg", a: [Rb - w, Rb], b: [Rb + w, Rb], tag: "saida" },
      { kind: "seg", a: [0, Rb], b: [Rb - w, Rb] },
      { kind: "seg", a: [Rb + w, Rb], b: [60, Rb] },
      { kind: "seg", a: [0, Rb], b: [0, 60] },
    );
  }
  return {
    boundaries: B,
    nAt: (q) => (fiberCore(q, Rb) ? nCore : q[0] < x0 || fiberBeyond(q, Rb) ? 1 : nClad),
  };
}

const fiberVP = (p: Params) => {
  const Rb = fiberBend(p);
  return Rb === 0 ? { xMin: -6.5, xMax: 6.5, yMin: -3.2, yMax: 3.2 } : { xMin: -6.5, xMax: Math.max(6.5, Rb + 2), yMin: -2.8, yMax: Math.max(3.5, Rb + 2.2) };
};

// ---------------------------------------------------------------- miragem (meio de índice variável)
/** Exagero vertical do desenho da miragem. */
export const MIR_E = 40;
const MIR_XOBJ = 380;
const MIR_HOBJ = 4;
/** Passo do degradê de cor do poste (m). */
const MIR_STRIPE = 0.02;
const MIR_T0 = 300;
/** (n − 1) do ar ∝ 1/T: n − 1 = K/T, com K = 2,93×10⁻⁴ · 288 K. */
const MIR_K = 2.93e-4 * 288;

/** Índice do ar a uma altura y (m) com o solo ΔT mais quente e camada de espessura h. */
export function nAir(y: number, dT: number, h: number): number {
  return 1 + MIR_K / (MIR_T0 + dT * Math.exp(-Math.max(0, y) / h));
}

export function dnAir(y: number, dT: number, h: number): number {
  const e = Math.exp(-Math.max(0, y) / h);
  const T = MIR_T0 + dT * e;
  return (MIR_K * dT * e) / (h * T * T);
}

export interface GradRay {
  pts: V[];
  ymin: number;
  xAtMin: number;
  end: "solo" | "objeto" | "fora";
  /** Altura com que chega ao plano do objeto (m), se chegar. */
  yObj?: number;
}

/**
 * Integra a equação do raio d/ds(n dr/ds) = ∇n por RK4 no comprimento de arco,
 * com p = n·t̂ como variável: dr/ds = p/n, dp/ds = ∇n.
 */
export function traceGradient(x0: number, y0: number, alpha: number, dT: number, h: number, ds = 0.5, xEnd = MIR_XOBJ): GradRay {
  const n0 = nAir(y0, dT, h);
  let s = [x0, y0, n0 * Math.cos(alpha), n0 * Math.sin(alpha)] as [number, number, number, number];
  const f = (u: [number, number, number, number]): [number, number, number, number] => {
    const n = nAir(u[1], dT, h);
    return [u[2] / n, u[3] / n, 0, dnAir(u[1], dT, h)];
  };
  const pts: V[] = [[x0, y0]];
  let ymin = y0;
  let xAtMin = x0;
  for (let i = 0; i < 20000; i++) {
    const k1 = f(s);
    const a2 = s.map((v, j) => v + (ds / 2) * k1[j]!) as typeof s;
    const k2 = f(a2);
    const a3 = s.map((v, j) => v + (ds / 2) * k2[j]!) as typeof s;
    const k3 = f(a3);
    const a4 = s.map((v, j) => v + ds * k3[j]!) as typeof s;
    const k4 = f(a4);
    const nx = s.map((v, j) => v + (ds / 6) * (k1[j]! + 2 * k2[j]! + 2 * k3[j]! + k4[j]!)) as typeof s;
    if (nx[1] <= 0) {
      const fr = s[1] / (s[1] - nx[1]);
      pts.push([s[0] + fr * (nx[0] - s[0]), 0]);
      return { pts, ymin: 0, xAtMin: s[0] + fr * (nx[0] - s[0]), end: "solo" };
    }
    if ((nx[0] - xEnd) * (s[0] - xEnd) <= 0 && nx[0] !== s[0]) {
      const fr = (xEnd - s[0]) / (nx[0] - s[0]);
      const y = s[1] + fr * (nx[1] - s[1]);
      pts.push([xEnd, y]);
      return { pts, ymin, xAtMin, end: y <= MIR_HOBJ ? "objeto" : "fora", yObj: y };
    }
    s = nx;
    pts.push([s[0], s[1]]);
    if (s[1] < ymin) {
      ymin = s[1];
      xAtMin = s[0];
    }
    if (s[0] < -20 || s[1] > 12) break;
  }
  return { pts, ymin, xAtMin, end: "fora" };
}

// ---------------------------------------------------------------- análise com cache
export interface Analysis {
  segs: RaySeg[];
  th1: number;
  th2: number;
  R: number;
  T: number;
  tir: boolean;
  hit: V | null;
  /** Índices dos dois lados da primeira interface atingida. */
  nA: number;
  nB: number;
  /** Fibra: potência que chega à face de saída e reflexões na parede do raio principal. */
  pout: number;
  nrefl: number;
  /** Miragem: raio central integrado. */
  grad: GradRay | null;
}

let cacheKey = "";
let cacheVal: Analysis | null = null;

export function analyze(s: RefState, p: Params): Analysis {
  const key = `${s.lx},${s.ly},${s.ang},${["modo", "n1", "n2", "pol", "Rb", "dT", "hc"].map((k) => p[k]).join(",")}`;
  if (cacheVal && key === cacheKey) return cacheVal;
  const m = mode(p);
  const pol = Math.round(num(p, "pol")) as Pol;
  const out: Analysis = { segs: [], th1: 0, th2: 0, R: 0, T: 0, tir: false, hit: null, nA: 1, nB: 1, pout: 0, nrefl: 0, grad: null };
  if (m === 3) {
    // Dioptro: os raios são traçados no desenho; aqui só a imagem paraxial (observáveis próprios).
  } else if (m === 2) {
    out.grad = traceGradient(s.lx, s.ly, s.ang, num(p, "dT"), Math.max(0.01, num(p, "hc", 0.3)));
    out.th1 = s.ang / DEG;
  } else {
    const scene = m === 0 ? sceneInterface(p) : sceneFiber(p);
    out.segs = trace(scene, [s.lx, s.ly], vdir(s.ang), {
      branch: true,
      pol,
      minI: m === 0 ? 1e-4 : 4e-3,
      maxDepth: m === 0 ? 6 : 400,
      maxLen: 40,
      maxSegs: 2500,
    });
    const first = out.segs.find((g) => g.depth === 0);
    if (first && first.end === "interface" && first.theta !== undefined) {
      const n1 = first.n;
      const n2 = scene.nAt([first.b[0] + Math.cos(s.ang) * 1e-6, first.b[1] + Math.sin(s.ang) * 1e-6]);
      const fr = fresnel(n1, n2, Math.cos(first.theta), pol);
      out.hit = first.b;
      out.nA = n1;
      out.nB = n2;
      out.th1 = first.theta / DEG;
      out.tir = fr.tir;
      out.th2 = fr.tir ? 90 : Math.acos(fr.cost) / DEG;
      out.R = fr.R;
      out.T = fr.T;
    }
    if (m === 1) {
      const nCore = num(p, "n1", 1.5);
      out.pout = out.segs.filter((g) => g.tag === "saida" && Math.abs(g.n - nCore) < 1e-9).reduce((a, g) => a + g.I, 0);
      out.nrefl = mainPath(out.segs).filter((g) => g.tag === "parede").length;
    }
  }
  cacheKey = key;
  cacheVal = out;
  return out;
}

export const criticalDeg = (n1: number, n2: number) => (n1 > n2 ? Math.asin(n2 / n1) / DEG : 90);

/** Ângulo máximo de aceitação da fibra no ar (graus); 90 se tudo é aceito. */
export function acceptanceDeg(nCore: number, nClad: number): number {
  const na2 = nCore * nCore - nClad * nClad;
  if (na2 <= 0) return 0;
  return na2 >= 1 ? 90 : Math.asin(Math.sqrt(na2)) / DEG;
}

// ---------------------------------------------------------------- desenho
function drawLaser(d: Draw, x: number, y: number, ang: number, L: number, color: string, handle: string) {
  const u = vdir(ang);
  d.box(x - u[0] * L * 0.5, y - u[1] * L * 0.5, L, L * 0.32, ang, { fill: color, stroke: d.theme.text, width: 1 });
  d.box(x - u[0] * L * 0.02, y - u[1] * L * 0.02, L * 0.08, L * 0.2, ang, { fill: d.theme.positive });
  const hx = x - u[0] * L * 1.15;
  const hy = y - u[1] * L * 1.15;
  d.line(x - u[0] * L, y - u[1] * L, hx, hy, { color: d.theme.muted, width: 1, dash: [3, 3] });
  d.circle(hx, hy, 0, { minPx: 6, fill: handle, stroke: d.theme.text, width: 1 });
}

const LASER_L = (m: number) => (m === 0 ? 0.34 : 0.7);

function drawRays(d: Draw, segs: RaySeg[], color: string) {
  // Mais fracos primeiro, para o feixe principal ficar por cima.
  for (const g of [...segs].sort((a, b) => a.I - b.I)) {
    const I = Math.max(0, Math.min(1, g.I));
    d.line(g.a[0], g.a[1], g.b[0], g.b[1], { color, width: 0.8 + 3 * I, alpha: 0.18 + 0.82 * Math.sqrt(I) });
  }
}

function angleArc(d: Draw, c: V, a0: number, a1: number, r: number, color: string) {
  const pts: V[] = [];
  for (let i = 0; i <= 24; i++) {
    const a = a0 + ((a1 - a0) * i) / 24;
    pts.push([c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)]);
  }
  d.polyline(pts, { color, width: 1.2 });
}

const fmt = (v: number, k = 1) => v.toFixed(k).replace(".", ",");

// ---------------------------------------------------------------- simulação
export const refracao = defineSim<RefState>({
  id: "refracao",
  title: "Reflexão, refração e fibra ótica",
  course: "FG IV",
  topic: "Ótica geométrica",
  priority: "P1",
  summary:
    "Gire e arraste um laser sobre a interface entre dois meios: lei de Snell, ângulo crítico, reflexão interna total e intensidades de Fresnel. Guie a luz numa fibra ótica e veja a miragem surgir de um gradiente de índice integrado pela equação do raio.",
  static: true,
  equations: [
    String.raw`n_1 \sin\theta_1 = n_2 \sin\theta_2 \qquad \theta_r = \theta_1 \qquad \sin\theta_c = \frac{n_2}{n_1}\ (n_1 > n_2)`,
    String.raw`r_s = \frac{n_1\cos\theta_1 - n_2\cos\theta_2}{n_1\cos\theta_1 + n_2\cos\theta_2} \quad r_p = \frac{n_2\cos\theta_1 - n_1\cos\theta_2}{n_2\cos\theta_1 + n_1\cos\theta_2} \quad R = \tfrac12\left(r_s^2 + r_p^2\right),\ T = 1 - R`,
    String.raw`\tan\theta_B = \frac{n_2}{n_1} \qquad \text{AN} = \sin\theta_{\max} = \sqrt{n_{\text{núcleo}}^2 - n_{\text{casca}}^2}`,
    String.raw`\frac{d}{ds}\!\left(n\,\frac{d\vec r}{ds}\right) = \nabla n \qquad n(y)\cos\theta(y) = \text{const.} \qquad n - 1 \propto \frac{1}{T}`,
  ],
  liveEquations(s, p) {
    const m = mode(p);
    const a = analyze(s, p);
    const n1 = num(p, "n1", 1);
    const n2 = num(p, "n2", 1.5);
    if (m === 3) {
      const R = dioptR(p);
      const po = -s.lx;
      const { i, m: ml } = dioptImage(n1, n2, R, po);
      return [
        String.raw`\frac{n_1}{p} + \frac{n_2}{i} = \frac{n_2 - n_1}{R}:\quad \frac{${texNum(n1)}}{${texNum(po)}\ \text{cm}} + \frac{${texNum(n2)}}{i} = \frac{${texNum(n2 - n1)}}{${texNum(R)}\ \text{cm}}`,
        Number.isFinite(i)
          ? String.raw`i = ${texNum(i)}\ \text{cm}\ ${i > 0 ? String.raw`\text{(imagem real, no meio } n_2\text{)}` : String.raw`\text{(imagem virtual, do lado do objeto)}`} \qquad m = -\frac{n_1 i}{n_2 p} = ${texNum(ml)}`
          : String.raw`\text{o denominador zera: a imagem vai para o infinito (raios paralelos no meio } n_2)`,
      ];
    }
    if (m === 2) {
      const g = a.grad!;
      const dT = num(p, "dT");
      const h = num(p, "hc", 0.3);
      return [
        String.raw`n(0) - 1 = ${texNum((nAir(0, dT, h) - 1) * 1e4, 4)}\times 10^{-4} \qquad n(\infty) - 1 = ${texNum((nAir(100, dT, h) - 1) * 1e4, 4)}\times 10^{-4}`,
        String.raw`\text{raio central: } \alpha = ${texNum(s.ang / DEG, 3)}^\circ \qquad y_{\min} = ${texNum(g.ymin, 3)}\ \text{m}`,
      ];
    }
    const lhs = a.nA * Math.sin(a.th1 * DEG);
    const eqs = [
      a.tir
        ? String.raw`n\sin\theta_1 = ${texNum(a.nA)}\sin(${texNum(a.th1)}^\circ) = ${texNum(lhs)} > ${texNum(a.nB)} \Rightarrow \text{reflexão interna total } (R = 1)`
        : String.raw`${texNum(a.nA)}\sin(${texNum(a.th1)}^\circ) = ${texNum(lhs)} = ${texNum(a.nB)}\sin\theta_2 \Rightarrow \theta_2 = ${texNum(a.th2)}^\circ`,
      String.raw`R = ${texNum(a.R * 100)}\% \qquad T = ${texNum(a.T * 100)}\% \qquad \theta_B = \arctan\frac{${texNum(a.nB)}}{${texNum(a.nA)}} = ${texNum(Math.atan(a.nB / a.nA) / DEG)}^\circ`,
    ];
    if (m === 0) eqs.push(n1 > n2 ? String.raw`\theta_c = \arcsin\frac{${texNum(n2)}}{${texNum(n1)}} = ${texNum(criticalDeg(n1, n2))}^\circ` : String.raw`n_1 \le n_2:\ \text{não há ângulo crítico}`);
    if (m === 1)
      eqs.push(
        String.raw`\theta_c = ${texNum(criticalDeg(n1, n2))}^\circ \qquad \theta_{\max} = ${texNum(acceptanceDeg(n1, n2))}^\circ \qquad P_{\text{saída}} = ${texNum(a.pout * 100)}\%`,
      );
    return eqs;
  },

  params: [
    {
      key: "modo",
      label: "Montagem",
      unit: "",
      min: 0,
      max: 3,
      step: 1,
      default: 0,
      options: [
        { value: 0, label: "Interface entre dois meios" },
        { value: 1, label: "Fibra ótica" },
        { value: 2, label: "Miragem (índice variável)" },
        { value: 3, label: "Dioptro esférico (uma superfície curva)" },
      ],
    },
    { key: "n1", label: "n₁ (meio de cima / núcleo da fibra)", unit: "", min: 1, max: 2.5, step: 0.01, default: 1, live: true },
    { key: "n2", label: "n₂ (meio de baixo / casca da fibra)", unit: "", min: 1, max: 2.5, step: 0.01, default: 1.5, live: true },
    { key: "theta", label: "Ângulo inicial do laser", unit: "°", min: 0, max: 85, step: 1, default: 40 },
    {
      key: "pol",
      label: "Polarização da luz",
      unit: "",
      min: 0,
      max: 2,
      step: 1,
      default: 0,
      live: true,
      options: [
        { value: 0, label: "Natural (não polarizada)" },
        { value: 1, label: "s (perpendicular ao plano de incidência)" },
        { value: 2, label: "p (no plano de incidência)" },
      ],
    },
    { key: "Rb", label: "Raio da curva da fibra (0 = reta)", unit: "mm", min: 0, max: 6, step: 0.25, default: 0, live: true },
    { key: "dT", label: "Solo mais quente que o ar (ΔT)", unit: "K", min: -20, max: 40, step: 1, default: 30, live: true },
    { key: "hc", label: "Espessura da camada de ar aquecido", unit: "m", min: 0.05, max: 3, step: 0.05, default: 0.3, live: true },
    { key: "Rd", label: "Raio de curvatura do dioptro R (+ = convexo para o objeto)", unit: "cm", min: -40, max: 40, step: 1, default: 10, live: true },
    { key: "pd", label: "Distância inicial do objeto ao dioptro", unit: "cm", min: 2, max: 38, step: 1, default: 30 },
  ],

  observables: [
    { key: "th1", label: "Ângulo de incidência θ₁ (miragem: elevação do raio)", unit: "°", value: (s, p) => analyze(s, p).th1 },
    { key: "th2", label: "Ângulo de refração θ₂ (90° na RIT)", unit: "°", value: (s, p) => analyze(s, p).th2 },
    { key: "R", label: "Refletância R", unit: "%", value: (s, p) => analyze(s, p).R * 100 },
    { key: "T", label: "Transmitância T", unit: "%", value: (s, p) => analyze(s, p).T * 100 },
    { key: "thc", label: "Ângulo crítico (90° = não existe)", unit: "°", value: (_s, p) => criticalDeg(num(p, "n1", 1), num(p, "n2", 1.5)) },
    { key: "pout", label: "Potência na saída da fibra", unit: "%", value: (s, p) => (mode(p) === 1 ? analyze(s, p).pout * 100 : 0) },
    { key: "nrefl", label: "Reflexões na parede da fibra", unit: "", value: (s, p) => (mode(p) === 1 ? analyze(s, p).nrefl : 0) },
    { key: "ymin", label: "Altura mínima do raio central", unit: "m", value: (s, p) => (mode(p) === 2 ? analyze(s, p).grad!.ymin : 0) },
    { key: "idio", label: "Dioptro: posição da imagem i (+ = real)", unit: "cm", value: (s, p) => (mode(p) === 3 ? dioptImage(num(p, "n1", 1), num(p, "n2", 1.5), dioptR(p), -s.lx).i : 0) },
    { key: "mdio", label: "Dioptro: aumento lateral m", unit: "", value: (s, p) => (mode(p) === 3 ? dioptImage(num(p, "n1", 1), num(p, "n2", 1.5), dioptR(p), -s.lx).m : 0) },
  ],
  chart: { x: "th1", y: "th2" },

  scenarios: [
    {
      id: "snell",
      label: "Do ar para o vidro",
      params: { modo: 0, n1: 1, n2: 1.5, theta: 40, pol: 0 },
      guide: `### Lei de Snell e Fresnel
1. Arraste o círculo atrás do laser para girá-lo e o corpo do laser para movê-lo. Cada posição solta grava um ponto no gráfico $\\theta_2 \\times \\theta_1$.
2. Confira $n_1\\sin\\theta_1 = n_2\\sin\\theta_2$ nas equações ao vivo. O raio refratado se aproxima ou se afasta da normal?
3. Observe a espessura do raio refletido: perto da incidência normal só cerca de $4\\%$ volta; perto de $90^\\circ$ quase tudo é refletido.
4. Escolha a polarização **p** e procure o ângulo de Brewster $\\theta_B = \\arctan(n_2/n_1) \\approx 56{,}3^\\circ$, em que o refletido desaparece.`,
      predict: [
        {
          question: "Ao passar do ar (n = 1,0) para o vidro (n = 1,5), o raio refratado:",
          options: ["se afasta da normal", "se aproxima da normal", "não muda de direção"],
          answer: 1,
          explanation: "Com $n_2 > n_1$, $\\sin\\theta_2 = (n_1/n_2)\\sin\\theta_1 < \\sin\\theta_1$: o ângulo com a normal diminui. A luz fica mais lenta no vidro ($v = c/n$).",
        },
      ],
    },
    {
      id: "rit",
      label: "Reflexão interna total",
      params: { modo: 0, n1: 1.5, n2: 1, theta: 35, pol: 0 },
      guide: `### Do vidro para o ar
Agora o laser está no vidro ($n_1 = 1{,}5$) e a luz sai para o ar.
1. Gire o laser aumentando $\\theta_1$. Veja o refratado se aproximar da interface e o refletido ficar mais forte.
2. Em $\\theta_c = \\arcsin(1/1{,}5) \\approx 41{,}8^\\circ$ o refratado rasa a superfície; acima disso, $R = 100\\%$.
3. Troque o vidro por diamante ($n_1 = 2{,}42$): o ângulo crítico cai para cerca de $24^\\circ$, por isso o diamante brilha tanto.`,
      predict: [
        {
          question: "Com o laser no vidro a 50° da normal, o que sai para o ar?",
          options: ["Um raio refratado fraco", "Nada: toda a luz é refletida", "Um raio que segue rente à superfície"],
          answer: 1,
          explanation: "$50^\\circ > \\theta_c \\approx 41{,}8^\\circ$: não existe ângulo real com $\\sin\\theta_2 = 1{,}5\\sin 50^\\circ > 1$. É a reflexão interna total, sem perda de energia.",
        },
      ],
    },
    {
      id: "fibra",
      label: "Fibra ótica",
      params: { modo: 1, n1: 1.5, n2: 1.45, theta: 12, Rb: 0, pol: 0 },
      guide: `### Luz presa no núcleo
O núcleo ($n_1$) é envolvido por uma casca de índice menor ($n_2$). A luz fica presa por reflexão interna total.
1. Gire o laser na entrada. O cone tracejado mostra o ângulo máximo de aceitação $\\theta_{\\max}$, com $\\sin\\theta_{\\max} = \\sqrt{n_1^2 - n_2^2}$.
2. Passe de $\\theta_{\\max}$: a cada batida na parede parte da luz vaza e a potência na saída despenca.
3. Curve a fibra (raio da curva) e encontre o raio a partir do qual a luz começa a vazar na curva.
4. Faça $n_2 = 1$ (fibra sem casca, só vidro no ar): o ângulo de aceitação chega a $90^\\circ$.`,
    },
    {
      id: "miragem",
      label: "Miragem na estrada",
      params: { modo: 2, dT: 30, hc: 0.3 },
      guide: `### O ar quente curva a luz
Perto do asfalto quente o ar é menos denso e tem índice menor ($n - 1 \\propto 1/T$). A trajetória vem da equação do raio $\\frac{d}{ds}(n\\,\\frac{d\\vec r}{ds}) = \\nabla n$, integrada passo a passo.
1. Os raios que partem do olho quase rasantes (azuis) se curvam para cima antes de tocar o chão e chegam à base do poste colorido.
2. O olho interpreta cada raio como vindo em linha reta: ao lado do poste aparece a imagem vista, com as cores da base **invertidas abaixo do horizonte**, como refletidas numa poça.
3. Mova o olho para cima e gire o leque: em que ângulo os raios deixam de voltar? Compare com $n(y_0)\\cos\\alpha = n(0)$.
4. Faça $\\Delta T < 0$ (superfície fria, como o mar) e aumente a camada: os raios curvam para baixo e surge a miragem superior.

A escala vertical está exagerada 40 vezes: os ângulos reais são de décimos de grau.`,
      predict: [
        {
          question: "Num dia quente, a 'poça d'água' que se vê no asfalto ao longe é:",
          options: ["vapor d'água real sobre a pista", "imagem do céu formada por luz curvada pelo ar quente", "reflexão da luz no asfalto liso"],
          answer: 1,
          explanation: "A luz do céu desce, encontra ar cada vez mais quente (n menor) e se curva para cima, chegando ao olho por baixo. Vemos o céu abaixo do horizonte, parecendo água.",
        },
      ],
    },
    {
      id: "dioptro",
      label: "Dioptro esférico: imagem por uma superfície curva",
      params: { modo: 3, n1: 1, n2: 1.5, Rd: 6, pd: 30 },
      guide: `### Uma única superfície curva já forma imagem
1. À esquerda, ar ($n_1 = 1$); à direita, vidro ($n_2 = 1{,}5$), separados por uma superfície esférica de raio $R = 6\\ \\text{cm}$ com centro C dentro do vidro. Os raios são traçados com a lei de Snell exata em cada ponto.
2. Os raios que saem da ponta do objeto (azul) convergem **dentro do vidro**: a imagem é real e invertida. Para raios próximos do eixo:
$$\\frac{n_1}{p} + \\frac{n_2}{i} = \\frac{n_2 - n_1}{R}, \\qquad m = -\\frac{n_1\\,i}{n_2\\,p}$$
Confira: $1/30 + 1{,}5/i = 0{,}5/6$ dá $i = 30\\ \\text{cm}$ e $m = -2/3$.
3. Arraste o objeto para perto ($p = 8\\ \\text{cm}$): agora $i < 0$ e a imagem é **virtual**, do lado do objeto (prolongamentos tracejados).
4. Mude $R$ para $-6\\ \\text{cm}$ (superfície côncava vista do objeto): a imagem fica virtual para qualquer $p$.
5. Troque os índices ($n_1 = 1{,}5$, $n_2 = 1$) para ver um objeto dentro de um aquário ou de uma esfera de vidro. A convenção de sinais: $R > 0$ quando o centro está do lado de onde a luz sai; $i > 0$ quando a imagem está desse lado.`,
      predict: [
        {
          question: "Um objeto a 30 cm de uma superfície convexa de vidro (n = 1,5, R = 6 cm) forma imagem dentro do vidro. Aproximando o objeto para 8 cm, a imagem:",
          options: ["fica real, mais longe", "fica real, mais perto", "torna-se virtual, do lado do objeto", "desaparece"],
          answer: 2,
          explanation: "O foco do lado do objeto fica em $p = n_1R/(n_2 - n_1) = 12\\ \\text{cm}$. Com o objeto mais perto que isso, $n_1/p$ supera $(n_2 - n_1)/R$, $i$ fica negativo e a imagem é virtual.",
        },
      ],
    },
  ],

  exercises: [
    {
      id: "snell",
      prompt: "Um raio de luz passa de um meio com índice {n1} para outro com índice {n2}, incidindo a {theta}° da normal. Qual é o ângulo de refração?",
      vary: { n1: [1, 1.2, 2], n2: [1.3, 1.9, 2], theta: [10, 70, 0] },
      fixed: { modo: 0 },
      answer: {
        label: "θ₂",
        unit: "°",
        compute: (p) => Math.asin((num(p, "n1") * Math.sin(num(p, "theta") * DEG)) / num(p, "n2")) / DEG,
      },
      hint: "n₁ sen θ₁ = n₂ sen θ₂.",
    },
    {
      id: "aceitacao",
      prompt: "Uma fibra ótica tem núcleo de índice {n1} e casca de índice {n2}. Qual é o maior ângulo (com o eixo, no ar) com que a luz pode entrar e continuar guiada?",
      vary: { n1: [1.45, 1.6, 3], n2: [1.3, 1.44, 3] },
      fixed: { modo: 1, Rb: 0 },
      answer: { label: "θ_max", unit: "°", compute: (p) => acceptanceDeg(num(p, "n1"), num(p, "n2")) },
      hint: "Exija RIT na parede (θ ≥ θc) e use Snell na face de entrada: sen θmax = √(n₁² − n₂²).",
    },
    {
      id: "brewster",
      prompt: "Luz no ar (n = 1) incide sobre um material de índice {n2}. Em que ângulo de incidência a luz refletida sai totalmente polarizada?",
      vary: { n2: [1.3, 2.4, 2] },
      fixed: { modo: 0, n1: 1 },
      answer: { label: "θ_B", unit: "°", compute: (p) => Math.atan(num(p, "n2") / 1) / DEG },
      hint: "No ângulo de Brewster o refletido e o refratado são perpendiculares: tg θB = n₂/n₁.",
    },
  ],

  init(p) {
    const m = mode(p);
    const th = num(p, "theta", 40) * DEG;
    if (m === 1) {
      const a = Math.min(th, 70 * DEG);
      return { lx: FIBER_X0 - 1.3 * Math.cos(a), ly: -1.3 * Math.sin(a), ang: a, drag: null };
    }
    if (m === 2) return { lx: 20, ly: 1.7, ang: -0.15 * DEG, drag: null };
    if (m === 3) return { lx: -num(p, "pd", 30), ly: 3, ang: 0, drag: null };
    return { lx: -1.3 * Math.sin(th), ly: 1.3 * Math.cos(th), ang: Math.atan2(-Math.cos(th), Math.sin(th)), drag: null };
  },
  step: (s) => s,
  sampleEvery: 1000,
  maxSamples: 400,

  viewport(p) {
    const m = mode(p);
    if (m === 1) return { ...fiberVP(p), unit: "mm" };
    if (m === 2) return { xMin: -10, xMax: 410, yMin: -110, yMax: 300, unit: "" };
    if (m === 3) return { ...VP3, unit: "cm" };
    return { ...VP0, unit: "cm" };
  },

  pointer: {
    down(s, p, pt) {
      const m = mode(p);
      const u = vdir(s.ang);
      if (m === 3) {
        const onArrow = Math.abs(pt.x - s.lx) < 1.5 && pt.y >= Math.min(0, s.ly) - 1 && pt.y <= Math.max(0, s.ly) + 1;
        return onArrow ? { ...s, drag: "laser" } : undefined;
      }
      if (m === 2) {
        const sx = pt.x - s.lx;
        const sy = pt.y - s.ly * MIR_E;
        const hd = mirHandle(s);
        if (Math.hypot(pt.x - hd[0], pt.y - hd[1]) < 12) return { ...s, drag: "rot" };
        if (Math.hypot(sx, sy) < 14) return { ...s, drag: "laser" };
        return undefined;
      }
      const L = LASER_L(m);
      const hx = s.lx - u[0] * L * 1.15;
      const hy = s.ly - u[1] * L * 1.15;
      const r = m === 0 ? 0.12 : 0.3;
      if (Math.hypot(pt.x - hx, pt.y - hy) < r) return { ...s, drag: "rot" };
      // corpo do laser: segmento de (lx, ly) para trás
      const rel: V = [pt.x - s.lx, pt.y - s.ly];
      const along = -(rel[0] * u[0] + rel[1] * u[1]);
      const perp = Math.abs(rel[0] * u[1] - rel[1] * u[0]);
      if (along > -r && along < L + r * 0.5 && perp < r) return { ...s, drag: "laser" };
      return undefined;
    },
    move(s, p, pt, dragging) {
      if (!dragging || !s.drag) return undefined;
      const m = mode(p);
      if (m === 3) {
        const ly = Math.max(-8, Math.min(8, pt.y));
        return { ...s, lx: Math.max(-38, Math.min(-1, pt.x)), ly: Math.abs(ly) < 0.5 ? (ly < 0 ? -0.5 : 0.5) : ly };
      }
      if (m === 2) {
        if (s.drag === "laser") return { ...s, lx: Math.max(0, Math.min(200, pt.x)), ly: Math.max(0.1, Math.min(6, pt.y / MIR_E)) };
        const dx = pt.x - s.lx;
        if (dx < 5) return undefined;
        const a = Math.atan((pt.y / MIR_E - s.ly) / dx);
        return { ...s, ang: Math.max(-3 * DEG, Math.min(3 * DEG, a)) };
      }
      const vp = m === 0 ? VP0 : fiberVP(p);
      if (s.drag === "laser") {
        return { ...s, lx: Math.max(vp.xMin + 0.1, Math.min(vp.xMax - 0.1, pt.x)), ly: Math.max(vp.yMin + 0.1, Math.min(vp.yMax - 0.1, pt.y)) };
      }
      const dx = s.lx - pt.x;
      const dy = s.ly - pt.y;
      if (Math.hypot(dx, dy) < 1e-6) return undefined;
      return { ...s, ang: Math.atan2(dy, dx) };
    },
    up: (s) => (s.drag ? { ...s, drag: null } : undefined),
    cursor(s, p, pt) {
      const m = mode(p);
      if (s.drag) return "grabbing";
      if (m === 3) return Math.abs(pt.x - s.lx) < 1.5 && pt.y >= Math.min(0, s.ly) - 1 && pt.y <= Math.max(0, s.ly) + 1 ? "grab" : undefined;
      if (m === 2) {
        const hd = mirHandle(s);
        if (Math.hypot(pt.x - hd[0], pt.y - hd[1]) < 12) return "alias";
        return Math.hypot(pt.x - s.lx, pt.y - s.ly * MIR_E) < 14 ? "grab" : undefined;
      }
      const u = vdir(s.ang);
      const L = LASER_L(m);
      const r = m === 0 ? 0.12 : 0.3;
      if (Math.hypot(pt.x - (s.lx - u[0] * L * 1.15), pt.y - (s.ly - u[1] * L * 1.15)) < r) return "alias";
      return Math.hypot(pt.x - (s.lx - u[0] * L * 0.5), pt.y - (s.ly - u[1] * L * 0.5)) < L * 0.6 ? "grab" : undefined;
    },
  },

  actions: [
    {
      id: "normal",
      label: "Laser na incidência normal",
      run: (s, p) => (mode(p) === 0 ? { ...s, lx: 0, ly: s.ly >= 0 ? 1.3 : -1.3, ang: s.ly >= 0 ? -Math.PI / 2 : Math.PI / 2 } : mode(p) === 1 ? { ...s, lx: FIBER_X0 - 1.3, ly: 0, ang: 0 } : { ...s, ang: 0 }),
    },
    {
      id: "critico",
      label: "Mirar no ângulo crítico",
      run(s, p) {
        const n1 = num(p, "n1", 1);
        const n2 = num(p, "n2", 1.5);
        if (mode(p) !== 0 || n1 <= n2) return s;
        const th = criticalDeg(n1, n2) * DEG;
        return { ...s, lx: -1.3 * Math.sin(th), ly: 1.3 * Math.cos(th), ang: Math.atan2(-Math.cos(th), Math.sin(th)) };
      },
    },
  ],

  render(ctx, frame) {
    const { state: s, params: p, theme } = frame;
    const d = draw(ctx, frame);
    const m = mode(p);
    const vp = refracao.viewport(p, s);
    ctx.save();
    ctx.beginPath();
    ctx.rect(vp.xMin, vp.yMin, vp.xMax - vp.xMin, vp.yMax - vp.yMin);
    ctx.clip();
    if (m === 0) renderInterface(d, s, p);
    else if (m === 1) renderFiber(d, s, p);
    else if (m === 3) renderDioptro(d, s, p);
    else renderMirage(d, s, p);
    ctx.restore();
    void theme;
  },
});

function tint(d: Draw, n: number) {
  return { fill: d.theme.accent, alpha: Math.min(0.32, 0.04 + 0.16 * (n - 1)) };
}

function renderInterface(d: Draw, s: RefState, p: Params) {
  const { theme } = d;
  const n1 = num(p, "n1", 1);
  const n2 = num(p, "n2", 1.5);
  const vp = VP0;
  d.rect(vp.xMin, 0, vp.xMax - vp.xMin, vp.yMax, tint(d, n1));
  d.rect(vp.xMin, vp.yMin, vp.xMax - vp.xMin, -vp.yMin, tint(d, n2));
  d.line(vp.xMin, 0, vp.xMax, 0, { color: theme.text, width: 1.5 });
  d.text(`n₁ = ${fmt(n1, 2)}`, vp.xMax - 0.1, 0.15, { align: "right", color: theme.muted, size: 12 });
  d.text(`n₂ = ${fmt(n2, 2)}`, vp.xMax - 0.1, -0.15, { align: "right", color: theme.muted, size: 12 });

  const a = analyze(s, p);
  const laserColor = theme.series[1] ?? theme.accent;
  drawRays(d, a.segs, laserColor);

  if (a.hit) {
    const h = a.hit;
    d.line(h[0], h[1] - 1.2, h[0], h[1] + 1.2, { color: theme.muted, dash: [5, 4], width: 1 });
    d.text("normal", h[0] + 0.05, h[1] + 1.15, { align: "left", color: theme.muted, size: 10 });
    const up = s.ly > 0;
    const dirIn = vdir(s.ang);
    const side = dirIn[0] >= 0 ? 1 : -1;
    // θ1 entre a normal (do lado do laser) e o raio incidente
    const nAng = up ? Math.PI / 2 : -Math.PI / 2;
    const inAng = Math.atan2(-dirIn[1], -dirIn[0]);
    angleArc(d, h, nAng, inAng, 0.32, theme.text);
    d.text(`θ₁ = ${fmt(a.th1)}°`, h[0] - side * 0.42, h[1] + (up ? 0.45 : -0.45), { color: theme.text, size: 12, weight: "600" });
    if (!a.tir) {
      const tAng = up ? -Math.PI / 2 + side * a.th2 * DEG : Math.PI / 2 - side * a.th2 * DEG;
      angleArc(d, h, up ? -Math.PI / 2 : Math.PI / 2, tAng, 0.4, theme.text);
      d.text(`θ₂ = ${fmt(a.th2)}°`, h[0] + side * 0.5, h[1] + (up ? -0.55 : 0.55), { color: theme.text, size: 12, weight: "600" });
      d.text(`T = ${fmt(a.T * 100)}%`, h[0] + side * 0.95, h[1] + (up ? -1.1 : 1.1), { color: laserColor, size: 11 });
    } else {
      d.text("reflexão interna total", h[0] + side * 0.6, h[1] + (up ? -0.35 : 0.35), { color: theme.positive, size: 12, weight: "600" });
    }
    d.text(`R = ${fmt(a.R * 100)}%`, h[0] + side * 0.95, h[1] + (up ? 1.0 : -1.0), { color: laserColor, size: 11 });
    // ângulo crítico, se existir no meio do laser
    const nl = up ? n1 : n2;
    const no = up ? n2 : n1;
    if (nl > no) {
      const c = Math.asin(no / nl);
      const sgn = up ? 1 : -1;
      for (const k of [-1, 1]) d.line(h[0], h[1], h[0] + k * Math.sin(c) * 1.1, h[1] + sgn * Math.cos(c) * 1.1, { color: theme.positive, dash: [2, 4], width: 1, alpha: 0.7 });
      d.text(`θc = ${fmt(c / DEG)}°`, h[0] + side * Math.sin(c) * 1.15, h[1] + sgn * Math.cos(c) * 1.2, { color: theme.positive, size: 10 });
    }
  }
  drawLaser(d, s.lx, s.ly, s.ang, LASER_L(0), theme.muted, theme.accent);
  d.text("arraste o laser para mover · o círculo para girar", vp.xMin + 0.08, vp.yMin + 0.1, { align: "left", baseline: "bottom", color: theme.muted, size: 11 });
}

function renderDioptro(d: Draw, s: RefState, p: Params) {
  const { theme } = d;
  const n1 = num(p, "n1", 1);
  const n2 = num(p, "n2", 1.5);
  const R = dioptR(p);
  const H = dioptH(p);
  const vp = VP3;
  // Meio n₂ à direita da superfície
  const prof: [number, number][] = [];
  for (let k = 0; k <= 60; k++) {
    const y = -H + (2 * H * k) / 60;
    prof.push([sagX(R, y), y]);
  }
  const xEdge = sagX(R, H);
  d.rect(vp.xMin, vp.yMin, vp.xMax - vp.xMin, vp.yMax - vp.yMin, tint(d, n1));
  d.polyline([[vp.xMax, vp.yMin], [xEdge, vp.yMin], [xEdge, -H], ...prof, [xEdge, H], [xEdge, vp.yMax], [vp.xMax, vp.yMax]], { close: true, fill: theme.accent, color: "none", alpha: Math.min(0.32, 0.04 + 0.16 * (n2 - 1)) });
  d.polyline(prof, { color: theme.text, width: 2 });
  d.line(vp.xMin, 0, vp.xMax, 0, { color: theme.muted, width: 1, dash: [8, 5] });
  d.dot(R, 0, 4, theme.text);
  d.text("C", R, 0, { color: theme.text, size: 11, dy: 12 });
  d.text("V", 0, 0, { color: theme.text, size: 11, dx: -8, dy: 12 });
  d.text(`n₁ = ${fmt(n1, 2)}`, vp.xMin + 1, vp.yMax - 1.5, { align: "left", color: theme.muted, size: 12 });
  d.text(`n₂ = ${fmt(n2, 2)}`, vp.xMax - 1, vp.yMax - 1.5, { align: "right", color: theme.muted, size: 12 });

  const scene = sceneDioptro(p);
  const po = -s.lx;
  const img = dioptImage(n1, n2, R, po);
  const colors = [theme.series[1] ?? theme.accent, theme.series[0] ?? theme.accent];
  const sources: [number, number][] = [
    [s.lx, 0],
    [s.lx, s.ly],
  ];
  sources.forEach((o, k) => {
    const n = 7;
    for (let j = 0; j < n; j++) {
      const y = -0.9 * H + (1.8 * H * j) / (n - 1);
      const target: V = [sagX(R, y), y];
      const dir: V = [target[0] - o[0], target[1] - o[1]];
      const segs = trace(scene, o, dir, { maxDepth: 2, maxLen: 140 });
      for (const g of segs) d.line(g.a[0], g.a[1], g.b[0], g.b[1], { color: colors[k]!, width: 1.4, alpha: k === 0 ? 0.85 : 0.55 });
      // Prolongamentos para trás dos raios refratados (imagem virtual)
      if (Number.isFinite(img.i) && img.i < 0) {
        const out = segs.find((g) => g.depth === 1);
        if (out) {
          const u = vdir(Math.atan2(out.b[1] - out.a[1], out.b[0] - out.a[0]));
          d.line(out.a[0], out.a[1], out.a[0] - u[0] * 120, out.a[1] - u[1] * 120, { color: colors[k]!, width: 1, dash: [3, 4], alpha: 0.5 });
        }
      }
    }
  });
  // Objeto
  d.arrow(s.lx, 0, 0, s.ly, { color: theme.text, width: 3, head: 9 });
  d.text("objeto (arraste)", s.lx, s.ly, { color: theme.text, size: 11, dy: s.ly > 0 ? -12 : 14 });
  // Imagem paraxial
  if (Number.isFinite(img.i) && Math.abs(img.i) < 400) {
    const hi = img.m * s.ly;
    const real = img.i > 0;
    if (img.i > vp.xMin && img.i < vp.xMax) {
      d.arrow(img.i, 0, 0, hi, { color: theme.positive, width: 3, head: 9, dash: real ? undefined : [5, 4] });
      d.text(real ? "imagem real" : "imagem virtual", img.i, hi, { color: theme.positive, size: 11, weight: "600", dy: hi > 0 ? -12 : 14 });
    }
  }
  const iTxt = Number.isFinite(img.i) && Math.abs(img.i) < 1e4 ? `${fmt(img.i, 1)} cm` : "∞";
  d.text(`p = ${fmt(po, 1)} cm   R = ${fmt(R, 1)} cm   i = ${iTxt}   m = ${Number.isFinite(img.m) ? fmt(img.m, 2) : "∞"}`, vp.xMin + 1, vp.yMin + 1.5, {
    align: "left",
    baseline: "bottom",
    color: theme.text,
    size: 12,
    weight: "600",
  });
}

function renderFiber(d: Draw, s: RefState, p: Params) {
  const { theme } = d;
  const n1 = num(p, "n1", 1.5);
  const n2 = num(p, "n2", 1.45);
  const Rb = fiberBend(p);
  const vp = fiberVP(p);
  const w = FIBER_W / 2;
  const x0 = FIBER_X0;
  // casca (todo o lado direito da face de entrada) e núcleo
  const clad = { fill: theme.accent, alpha: Math.min(0.25, 0.03 + 0.12 * (n2 - 1)) };
  const core = { fill: theme.series[2] ?? theme.accent, alpha: Math.min(0.4, 0.08 + 0.2 * (n1 - 1)) };
  if (Rb === 0) {
    d.rect(x0, -w - 0.6, FIBER_LEN, 2 * w + 1.2, clad);
    d.rect(x0, -w, FIBER_LEN, 2 * w, core);
  } else {
    const band = (r0: number, r1: number): V[] => {
      const pts: V[] = [];
      for (let i = 0; i <= 40; i++) {
        const a = -Math.PI / 2 + (i / 40) * (Math.PI / 2);
        pts.push([r1 * Math.cos(a), Rb + r1 * Math.sin(a)]);
      }
      for (let i = 40; i >= 0; i--) {
        const a = -Math.PI / 2 + (i / 40) * (Math.PI / 2);
        pts.push([r0 * Math.cos(a), Rb + r0 * Math.sin(a)]);
      }
      return pts;
    };
    d.rect(x0, -w - 0.6, -x0, 2 * w + 1.2, clad);
    d.polyline(band(Math.max(0.01, Rb - w - 0.6), Rb + w + 0.6), { ...clad, color: "none", close: true });
    d.rect(x0, -w, -x0, 2 * w, core);
    d.polyline(band(Rb - w, Rb + w), { ...core, color: "none", close: true });
  }
  d.text(`núcleo n₁ = ${fmt(n1, 2)}`, x0 + 0.2, w + 0.3, { align: "left", color: theme.text, size: 11 });
  d.text(`casca n₂ = ${fmt(n2, 2)}`, x0 + 0.2, -w - 0.3, { align: "left", color: theme.muted, size: 11 });
  d.text("ar", x0 - 0.3, vp.yMax - 0.3, { color: theme.muted, size: 11 });

  // cone de aceitação
  const acc = acceptanceDeg(n1, n2) * DEG;
  for (const k of [-1, 1]) d.line(x0, 0, x0 - 1.8 * Math.cos(acc), -k * 1.8 * Math.sin(acc), { color: theme.positive, dash: [4, 4], width: 1 });
  d.text(`θmax = ${fmt(acc / DEG)}°`, x0 - 1.0, -Math.min(2.4, 1.8 * Math.sin(acc) + 0.3) + (acc < 0.2 ? -0.2 : 0), { color: theme.positive, size: 10 });

  const a = analyze(s, p);
  const laserColor = theme.series[1] ?? theme.accent;
  drawRays(d, a.segs, laserColor);
  drawLaser(d, s.lx, s.ly, s.ang, LASER_L(1), theme.muted, theme.accent);
  d.text(
    `reflexões na parede: ${a.nrefl} · potência na saída: ${fmt(a.pout * 100)}%`,
    vp.xMin + 0.15,
    vp.yMin + 0.2,
    { align: "left", baseline: "bottom", color: theme.text, size: 12, weight: "600" },
  );
}

function mirHandle(s: RefState): V {
  // alça a 40 unidades do olho, na direção desenhada (exagerada)
  const dx = Math.cos(s.ang);
  const dy = Math.sin(s.ang) * MIR_E;
  const l = Math.hypot(dx, dy);
  return [s.lx + (40 * dx) / l, s.ly * MIR_E + (40 * dy) / l];
}

function renderMirage(d: Draw, s: RefState, p: Params) {
  const { theme } = d;
  const E = MIR_E;
  const dT = num(p, "dT");
  const h = Math.max(0.01, num(p, "hc", 0.3));
  // camada de ar com índice alterado
  for (let i = 0; i < 12; i++) {
    const y0 = (i * 3 * h) / 12;
    const f = Math.exp(-(y0 + (1.5 * h) / 12) / h);
    d.rect(-10, y0 * E, 420, ((3 * h) / 12) * E, { fill: dT >= 0 ? theme.positive : theme.negative, alpha: 0.28 * f * Math.min(1, Math.abs(dT) / 30) });
  }
  d.rect(-10, -110, 420, 110, { fill: theme.ground });
  d.line(-10, 0, 410, 0, { color: theme.text, width: 1.5 });
  d.text("solo", 400, -8, { align: "right", color: theme.muted, size: 11 });
  // escalas
  for (let y = 0; y <= 7; y++) {
    d.line(-10, y * E, -4, y * E, { color: theme.muted, width: 1 });
    d.text(`${y} m`, -2, y * E, { align: "left", color: theme.muted, size: 9 });
  }
  for (let x = 100; x <= 400; x += 100) d.text(`${x} m`, x, -10, { color: theme.muted, size: 9 });
  d.text("escala vertical exagerada 40×", 405, 290, { align: "right", baseline: "top", color: theme.muted, size: 11 });

  // poste colorido no plano do objeto: as cores mostram a ordem de cima para baixo na imagem
  const X = MIR_XOBJ;
  // degradê de cor com a altura (mais rápido perto do chão, onde a miragem acontece)
  const stripeColor = (y: number) => `hsl(${Math.round(270 * Math.sqrt(Math.max(0, Math.min(1, y / MIR_HOBJ))))}, 75%, 50%)`;
  for (let y = 0; y < MIR_HOBJ - 1e-9; y += MIR_STRIPE) d.rect(X - 3, y * E, 6, MIR_STRIPE * E + 0.5, { fill: stripeColor(y + MIR_STRIPE / 2) });
  d.text("poste", X, MIR_HOBJ * E + 10, { color: theme.text, size: 11 });
  d.text("imagem vista", X + 12, MIR_HOBJ * E + 10, { align: "left", color: theme.muted, size: 10 });

  // leque de raios a partir do olho (reversibilidade: o caminho é o mesmo do poste ao olho)
  const N = 31;
  const spread = 0.4 * DEG;
  const apparent: { y: number; turned: boolean; col: string }[] = [];
  for (let i = 0; i < N; i++) {
    const a = s.ang - spread + (2 * spread * i) / (N - 1);
    const g = traceGradient(s.lx, s.ly, a, dT, h, 1);
    const hitTree = g.end === "objeto";
    const turned = g.end !== "solo" && g.ymin < s.ly - 1e-3 && (g.pts[g.pts.length - 1]?.[1] ?? 0) > g.ymin + 1e-3;
    const col = g.end === "solo" ? theme.muted : turned ? (theme.series[0] ?? theme.accent) : (theme.series[1] ?? theme.accent);
    d.polyline(g.pts.map(([x, y]) => [x, y * E] as [number, number]), { color: col, width: hitTree ? 1.6 : 1, alpha: hitTree ? 0.95 : 0.5 });
    if (hitTree && g.yObj !== undefined) {
      apparent.push({ y: s.ly + Math.tan(a) * (X - s.lx), turned, col: stripeColor(g.yObj) });
      // prolongamento retilíneo (o que o olho "acha")
      if (turned) d.line(s.lx, s.ly * E, X, (s.ly + Math.tan(a) * (X - s.lx)) * E, { color: theme.series[0] ?? theme.accent, dash: [3, 5], width: 1, alpha: 0.45 });
    }
  }
  for (const ap of apparent) d.rect(X + 10, ap.y * E - 2.5, 6, 5, { fill: ap.col });
  if (apparent.some((ap) => ap.y < 0)) d.text("miragem invertida", X + 18, -40, { align: "left", color: theme.series[0] ?? theme.accent, size: 11, weight: "600" });

  // central em destaque e olho
  const a = analyze(s, p);
  d.polyline(a.grad!.pts.map(([x, y]) => [x, y * E] as [number, number]), { color: theme.text, width: 2 });
  const hd = mirHandle(s);
  d.line(s.lx, s.ly * E, hd[0], hd[1], { color: theme.muted, dash: [3, 3], width: 1 });
  d.circle(hd[0], hd[1], 0, { minPx: 6, fill: theme.accent, stroke: theme.text, width: 1 });
  d.circle(s.lx, s.ly * E, 0, { minPx: 9, fill: theme.dark ? "#2a3140" : "#ffffff", stroke: theme.text, width: 1.5 });
  d.dot(s.lx + 2, s.ly * E, 4, theme.text);
  d.text("olho", s.lx, s.ly * E + 18, { color: theme.text, size: 11 });
  d.text("arraste o olho · o círculo gira o leque", -5, -100, { align: "left", baseline: "bottom", color: theme.muted, size: 11 });
}

export default refracao;
