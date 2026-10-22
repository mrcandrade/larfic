import { clamp, defineSim, draw, formatBR, num, texNum, type Params } from "@fisilab/core";

/**
 * Contas deslizando em arames. Cada arame é uma poligonal densa com
 * comprimento de arco acumulado S, tangente unitária t e vetor curvatura
 * dt/ds nos nós. A conta obedece a
 *   s̈ = g·t − μ |N|/m · sinal(ṡ),   N/m = ṡ² (dt/ds) − g⊥,
 * integrada por RK4. A força normal inclui o termo centrípeto, então o atrito
 * depende da curvatura e da velocidade.
 */
export interface Curve {
  name: string;
  color: number;
  xs: number[];
  ys: number[];
  S: number[];
  tx: number[];
  ty: number[];
  kx: number[];
  ky: number[];
  total: number;
}

export interface Bead {
  c: number;
  s: number;
  v: number;
  /** Arco de chegada (fim do arame ou fundo da cicloide). */
  goal: number;
  /** Instante de chegada (−1 enquanto não chega). */
  arr: number;
  stuck: boolean;
}

export interface BQ {
  bx: number;
  by: number;
  /** Curva desenhada pelo aluno (já suavizada), ou vazia. */
  drawn: [number, number][];
  draft: [number, number][];
  drawing: boolean;
  dragB: boolean;
  /** Identificador da geometria, para o cache das curvas. */
  gid: number;
  beads: Bead[];
  tt: number;
}

export const modo = (p: Params) => Math.round(num(p, "modo"));
const G = (p: Params) => num(p, "g", 9.8);
const MU = (p: Params) => num(p, "mu", 0);
const N_PTS = 900;

// ------------------------------------------------------------------ geometria

export function buildCurve(name: string, color: number, pts: [number, number][]): Curve {
  const n = pts.length;
  const xs = pts.map((q) => q[0]);
  const ys = pts.map((q) => q[1]);
  const S = [0];
  for (let i = 1; i < n; i++) S.push(S[i - 1]! + Math.hypot(xs[i]! - xs[i - 1]!, ys[i]! - ys[i - 1]!));
  const tx: number[] = [];
  const ty: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - 1);
    const b = Math.min(n - 1, i + 1);
    const dx = xs[b]! - xs[a]!;
    const dy = ys[b]! - ys[a]!;
    const l = Math.hypot(dx, dy) || 1;
    tx.push(dx / l);
    ty.push(dy / l);
  }
  const kx: number[] = [];
  const ky: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - 1);
    const b = Math.min(n - 1, i + 1);
    const ds = S[b]! - S[a]! || 1;
    kx.push((tx[b]! - tx[a]!) / ds);
    ky.push((ty[b]! - ty[a]!) / ds);
  }
  return { name, color, xs, ys, S, tx, ty, kx, ky, total: S[n - 1]! };
}

/** Parâmetro θ_B da cicloide que passa por (X, −Y): (θ − sen θ)/(1 − cos θ) = X/Y. */
export function cycloidTheta(X: number, Y: number): number {
  const f = (t: number) => (t - Math.sin(t)) / (1 - Math.cos(t)) - X / Y;
  let lo = 1e-6;
  let hi = 2 * Math.PI - 1e-6;
  for (let i = 0; i < 100; i++) {
    const m = (lo + hi) / 2;
    if (f(m) < 0) lo = m;
    else hi = m;
  }
  return (lo + hi) / 2;
}
export const cycloidR = (X: number, Y: number) => Y / (1 - Math.cos(cycloidTheta(X, Y)));

/** Tempos exatos sem atrito. */
export const tLine = (X: number, Y: number, g = 9.8) => Math.sqrt((2 * (X * X + Y * Y)) / (g * Y));
export const tCycloid = (X: number, Y: number, g = 9.8) => cycloidTheta(X, Y) * Math.sqrt(cycloidR(X, Y) / g);

const sample = (n: number, f: (u: number) => [number, number]) => Array.from({ length: n + 1 }, (_, i) => f(i / n));

export function raceCurves(X: number, Y: number, drawn: [number, number][]): Curve[] {
  const th = cycloidTheta(X, Y);
  const R = Y / (1 - Math.cos(th));
  const c = (X * X + Y * Y) / (2 * X);
  let psiB = Math.atan2(-Y, X - c);
  if (psiB < 0) psiB += 2 * Math.PI;
  // amostragem mais densa perto de A, onde a tangente é vertical
  const out = [
    buildCurve("reta", 0, sample(N_PTS, (u) => [X * u, -Y * u])),
    buildCurve("cicloide", 1, sample(N_PTS, (u) => {
      const t = th * u * u;
      return [R * (t - Math.sin(t)), -R * (1 - Math.cos(t))];
    })),
    buildCurve("arco de círculo", 2, sample(N_PTS, (u) => {
      const q = Math.PI + (psiB - Math.PI) * u;
      return [c + c * Math.cos(q), c * Math.sin(q)];
    })),
    buildCurve("parábola", 3, sample(N_PTS, (u) => [X * u * u, -Y * u])),
  ];
  if (drawn.length > 2) out.push(buildCurve("sua curva", 4, drawn));
  return out;
}

export function tautoCurves(R: number): Curve[] {
  const cyc = buildCurve("cicloide", 1, sample(N_PTS, (u) => {
    const t = 2 * Math.PI * u;
    return [R * (t - Math.sin(t)), -R * (1 - Math.cos(t))];
  }));
  // círculo com o mesmo raio de curvatura no fundo (4R): mesmo período para pequenas amplitudes
  const Rc = 4 * R;
  const am = Math.acos(0.5); // sobe até a altura 2R
  const cx = Math.PI * R;
  const cy = -2.6 * R - 2 * R + Rc;
  const circ = buildCurve("círculo (raio 4R)", 2, sample(N_PTS, (u) => {
    const q = -Math.PI / 2 - am + 2 * am * u;
    return [cx + Rc * Math.cos(q), cy + Rc * Math.sin(q)];
  }));
  return [cyc, circ];
}

/** Ponto de partida de cada conta na tautocronia: frações da altura 2R. */
export const TAUTO_H = [1, 0.75, 0.45, 0.15];

const cache = new Map<string, Curve[]>();
export function curvesOf(s: BQ, p: Params): Curve[] {
  const key = modo(p) === 1 ? `t|${num(p, "Rc", 0.5)}` : `r|${s.bx}|${s.by}|${s.gid}`;
  let c = cache.get(key);
  if (!c) {
    if (cache.size > 30) cache.clear();
    c = modo(p) === 1 ? tautoCurves(num(p, "Rc", 0.5)) : raceCurves(s.bx, -s.by, s.drawn);
    cache.set(key, c);
  }
  return c;
}

function locate(c: Curve, s: number): [number, number] {
  let lo = 0;
  let hi = c.S.length - 1;
  if (s <= 0) return [0, 0];
  if (s >= c.total) return [hi - 1, 1];
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (c.S[m]! <= s) lo = m;
    else hi = m;
  }
  const seg = c.S[lo + 1]! - c.S[lo]!;
  return [lo, seg > 0 ? (s - c.S[lo]!) / seg : 0];
}
export function pointAt(c: Curve, s: number): [number, number] {
  const [i, f] = locate(c, s);
  return [c.xs[i]! + f * (c.xs[i + 1]! - c.xs[i]!), c.ys[i]! + f * (c.ys[i + 1]! - c.ys[i]!)];
}
/** Arco em que a curva atinge a altura y pela primeira vez (descendo). */
function arcAtHeight(c: Curve, y: number): number {
  for (let i = 1; i < c.ys.length; i++) if (c.ys[i]! <= y) return c.S[i - 1]! + ((c.ys[i - 1]! - y) / (c.ys[i - 1]! - c.ys[i]!)) * (c.S[i]! - c.S[i - 1]!);
  return 0;
}

/** Aceleração tangencial; NaN sinaliza "parada por atrito estático". */
function accel(c: Curve, s: number, v: number, g: number, mu: number): number {
  const [i, f] = locate(c, s);
  const lerp = (a: number[]) => a[i]! + f * (a[i + 1]! - a[i]!);
  let tx = lerp(c.tx);
  let ty = lerp(c.ty);
  const l = Math.hypot(tx, ty) || 1;
  tx /= l;
  ty /= l;
  const gt = -g * ty;
  if (mu === 0) return gt;
  const gpx = -gt * tx;
  const gpy = -g - gt * ty;
  const N = Math.hypot(v * v * lerp(c.kx) - gpx, v * v * lerp(c.ky) - gpy);
  if (Math.abs(v) < 1e-9) return Math.abs(gt) <= mu * N ? NaN : gt - mu * N * Math.sign(gt);
  return gt - mu * N * Math.sign(v);
}

function stepBead(b: Bead, c: Curve, g: number, mu: number, t: number, dt: number): Bead {
  if (b.stuck || (b.arr >= 0 && b.goal >= c.total)) return b;
  const a0 = accel(c, b.s, b.v, g, mu);
  if (Number.isNaN(a0)) return { ...b, v: 0, stuck: true };
  const f = (s: number, v: number): [number, number] => {
    const a = accel(c, s, v, g, mu);
    return [v, Number.isNaN(a) ? 0 : a];
  };
  const [k1s, k1v] = [b.v, a0];
  const [k2s, k2v] = f(b.s + (dt / 2) * k1s, b.v + (dt / 2) * k1v);
  const [k3s, k3v] = f(b.s + (dt / 2) * k2s, b.v + (dt / 2) * k2v);
  const [k4s, k4v] = f(b.s + dt * k3s, b.v + dt * k3v);
  let s = b.s + (dt / 6) * (k1s + 2 * k2s + 2 * k3s + k4s);
  let v = b.v + (dt / 6) * (k1v + 2 * k2v + 2 * k3v + k4v);
  if (mu > 0 && v * b.v < 0) v = 0; // o atrito não inverte o movimento
  let arr = b.arr;
  if (arr < 0 && s >= b.goal) {
    arr = t + (dt * (b.goal - b.s)) / Math.max(1e-12, s - b.s);
    if (b.goal >= c.total) {
      s = c.total;
    }
  }
  if (s < 0) {
    s = 0;
    v = Math.max(0, v);
    if (v === 0 && accel(c, 0, 0, g, mu) <= 0) return { ...b, s, v, arr, stuck: true };
  }
  if (s > c.total) {
    s = c.total;
    v = 0;
  }
  return { ...b, s, v, arr };
}

function freshBeads(curves: Curve[], p: Params): Bead[] {
  if (modo(p) === 1) {
    const R = num(p, "Rc", 0.5);
    const out: Bead[] = [];
    for (const [ci, c] of curves.entries()) {
      const top = c.ys[0]!;
      const bottomS = c.total / 2;
      for (const h of TAUTO_H) {
        const s0 = h === 1 ? 0 : arcAtHeight(c, top - (1 - h) * 2 * R);
        out.push({ c: ci, s: s0, v: 0, goal: bottomS, arr: -1, stuck: false });
      }
    }
    return out;
  }
  return curves.map((c, i) => ({ c: i, s: 0, v: 0, goal: c.total, arr: -1, stuck: false }));
}

/** Tempo de percurso de uma curva, integrado à parte (previsão numérica). */
export function travelTime(c: Curve, g: number, mu: number, dt = 2e-4, tMax = 30): number {
  let b: Bead = { c: 0, s: 0, v: 0, goal: c.total, arr: -1, stuck: false };
  let t = 0;
  while (b.arr < 0 && !b.stuck && t < tMax) {
    b = stepBead(b, c, g, mu, t, dt);
    t += dt;
  }
  return b.arr >= 0 ? b.arr : Infinity;
}

const predCache = new Map<string, number[]>();
function predicted(s: BQ, p: Params): number[] {
  const key = `${s.bx}|${s.by}|${s.gid}|${G(p)}|${MU(p)}`;
  let r = predCache.get(key);
  if (!r) {
    if (predCache.size > 30) predCache.clear();
    r = curvesOf(s, p).map((c) => travelTime(c, G(p), MU(p), 1e-3));
    predCache.set(key, r);
  }
  return r;
}

function smooth(pts: [number, number][], bx: number, by: number): [number, number][] {
  const raw: [number, number][] = [[0, 0], ...pts.filter((q) => Math.hypot(q[0], q[1]) > 0.05 && Math.hypot(q[0] - bx, q[1] - by) > 0.05), [bx, by]];
  const sm: [number, number][] = raw.map((q, i) => {
    if (i === 0 || i === raw.length - 1) return q;
    let sx = 0;
    let sy = 0;
    let n = 0;
    for (let j = Math.max(0, i - 3); j <= Math.min(raw.length - 1, i + 3); j++) {
      sx += raw[j]![0];
      sy += raw[j]![1];
      n++;
    }
    return [sx / n, sy / n];
  });
  const c = buildCurve("", 0, sm);
  return sample(400, (u) => pointAt(c, u * c.total));
}

function reset(s: BQ, p: Params, extra: Partial<BQ> = {}): BQ {
  const n = { ...s, ...extra, tt: 0 };
  n.beads = freshBeads(curvesOf(n, p), p);
  return n;
}

// ------------------------------------------------------------------ simulação

const finishedRace = (s: BQ) => s.beads.every((b) => b.arr >= 0 || b.stuck) || s.tt > 30;
const beadTime = (s: BQ, i: number) => {
  const b = s.beads[i];
  if (!b) return 0;
  return b.arr >= 0 ? b.arr : s.tt;
};
const spread = (s: BQ, c: number) => {
  const ts = s.beads.filter((b) => b.c === c && b.arr >= 0).map((b) => b.arr);
  return ts.length > 1 ? Math.max(...ts) - Math.min(...ts) : 0;
};

export const braquistocrona = defineSim<BQ>({
  id: "braquistocrona",
  title: "Braquistócrona: a curva mais rápida",
  course: "FG I",
  topic: "Energia",
  priority: "P2",
  summary:
    "Corrida de contas entre A e B em uma reta, uma cicloide, um arco de círculo, uma parábola e uma curva desenhada por você, com tempos calculados numericamente, com e sem atrito; e a tautocronia da cicloide.",
  equations: [
    String.raw`\ddot s = -g\,\frac{dy}{ds} - \mu\,\frac{|N|}{m}\,\text{sinal}(\dot s) \qquad \frac{\vec N}{m} = \dot s^2\,\frac{d\hat t}{ds} - \vec g_\perp`,
    String.raw`\text{sem atrito: } v = \sqrt{2 g\,(y_A - y)} \qquad T = \int_A^B \frac{ds}{\sqrt{2g\,(y_A - y)}}`,
    String.raw`\text{cicloide: } x = R(\theta - \text{sen}\,\theta),\; y = -R(1 - \cos\theta) \qquad T_{AB} = \theta_B\sqrt{R/g}`,
    String.raw`\text{reta: } T = \sqrt{\frac{2(X^2+Y^2)}{gY}} \qquad \text{tautocronia: } T_{fundo} = \pi\sqrt{R/g}\ \text{(de qualquer altura)}`,
  ],
  liveEquations(s, p) {
    const g = G(p);
    if (modo(p) === 1) {
      const R = num(p, "Rc", 0.5);
      return [String.raw`\pi\sqrt{R/g} = \pi\sqrt{${texNum(R)}/${texNum(g)}} = ${texNum(Math.PI * Math.sqrt(R / g))}\ \text{s} \qquad t = ${texNum(s.tt)}\ \text{s}`];
    }
    const X = s.bx;
    const Y = -s.by;
    return [
      String.raw`\theta_B = ${texNum(cycloidTheta(X, Y))}\ \text{rad},\; R = ${texNum(cycloidR(X, Y))}\ \text{m} \;\Rightarrow\; T_{cic} = ${texNum(tCycloid(X, Y, g))}\ \text{s} \qquad T_{reta} = ${texNum(tLine(X, Y, g))}\ \text{s}\ (\mu = 0)`,
    ];
  },

  params: [
    {
      key: "modo",
      label: "Experimento",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 0,
      options: [
        { value: 0, label: "Corrida entre A e B (braquistócrona)" },
        { value: 1, label: "Tautocronia: cicloide × círculo" },
      ],
    },
    { key: "X", label: "Distância horizontal de A a B", unit: "m", min: 0.5, max: 5, step: 0.05, default: 3 },
    { key: "Y", label: "Desnível de A a B", unit: "m", min: 0.2, max: 3, step: 0.05, default: 1.5 },
    { key: "mu", label: "Coeficiente de atrito", unit: "", min: 0, max: 0.5, step: 0.01, default: 0 },
    { key: "Rc", label: "Tautocronia: raio do círculo gerador R", unit: "m", min: 0.2, max: 1.5, step: 0.05, default: 0.5 },
    { key: "g", label: "Gravidade", unit: "m/s²", min: 1, max: 25, step: 0.1, default: 9.8 },
  ],

  observables: [
    { key: "t0", label: "Tempo na reta", unit: "s", value: (s) => beadTime(s, 0) },
    { key: "t1", label: "Tempo na cicloide", unit: "s", value: (s) => beadTime(s, 1) },
    { key: "t2", label: "Tempo no arco de círculo", unit: "s", value: (s) => beadTime(s, 2) },
    { key: "t3", label: "Tempo na parábola", unit: "s", value: (s) => beadTime(s, 3) },
    { key: "t4", label: "Tempo na sua curva", unit: "s", value: (s, p) => (modo(p) === 0 && s.beads.length === 5 ? beadTime(s, 4) : 0) },
    {
      key: "v1",
      label: "Velocidade na cicloide",
      unit: "m/s",
      value: (s, p) => Math.abs(s.beads[modo(p) === 0 ? 1 : 0]?.v ?? 0),
    },
    { key: "dc", label: "Tautocronia: dispersão dos tempos na cicloide", unit: "s", value: (s) => spread(s, 0) },
    { key: "dk", label: "Tautocronia: dispersão dos tempos no círculo", unit: "s", value: (s) => spread(s, 1) },
  ],
  chart: { x: "t", y: "v1" },

  scenarios: [
    {
      id: "corrida",
      label: "A corrida das curvas",
      params: { modo: 0, X: 3, Y: 1.5, mu: 0 },
      guide: `### Qual chega primeiro?
1. Quatro contas partem juntas de A, do repouso. A reta é o caminho **mais curto**; será o mais rápido?
2. Rode. A cicloide vence, mesmo descendo abaixo de B e subindo de novo: a queda inicial íngreme dá velocidade cedo.
3. Sem atrito, a velocidade em cada altura é a mesma em todas as curvas: $v = \\sqrt{2g\\,\\Delta h}$. O que muda é **quanto tempo** se leva com velocidade baixa.
4. Arraste o ponto **B** e repita. Desenhe a sua própria curva (arraste a partir de A) e tente vencer a cicloide. Ninguém consegue: Johann Bernoulli provou em 1696 que ela é a braquistócrona.`,
      predict: [
        {
          question: "Entre A e B, sem atrito, qual conta chega primeiro?",
          options: ["a da reta (caminho mais curto)", "a da cicloide", "a do arco de círculo", "chegam juntas (mesma energia)"],
          answer: 1,
          explanation: "A energia é a mesma, mas a cicloide converte altura em velocidade logo no começo. O tempo é $\\int ds/v$, e a cicloide minimiza essa integral.",
        },
      ],
    },
    {
      id: "atrito",
      label: "Com atrito",
      params: { modo: 0, X: 3, Y: 1.5, mu: 0.15 },
      guide: `### O atrito muda o vencedor?
1. Com $\\mu = 0{,}15$ a força normal depende da curvatura: $N = m(g\\cos\\alpha + v^2/\\rho)$. Nas curvas fechadas, rápidas, o atrito pesa mais.
2. Compare os tempos com os do cenário sem atrito (tabela no palco, que traz também a previsão numérica).
3. Aumente $\\mu$ até alguma conta parar no caminho. Com atrito, a curva mais rápida já não é exatamente a cicloide.`,
    },
    {
      id: "tautocronia",
      label: "Tautocronia",
      params: { modo: 1, Rc: 0.5, mu: 0 },
      guide: `### Sempre o mesmo tempo
1. Quatro contas partem de alturas diferentes numa cicloide (em cima) e num círculo de raio $4R$ (embaixo), que tem a mesma curvatura no fundo.
2. Na cicloide, todas chegam ao fundo **juntas**, em $\\pi\\sqrt{R/g}$: é a **tautócrona** (Huygens, 1673), usada em relógios de pêndulo.
3. No círculo, a que parte mais alto chega por último: o período do pêndulo comum depende da amplitude.
4. Compare as dispersões dos tempos nos dois arames (observáveis).`,
      predict: [
        {
          question: "Na cicloide, uma conta solta da borda e outra solta perto do fundo chegam ao ponto mais baixo:",
          options: ["a de perto do fundo antes", "juntas", "a da borda antes"],
          answer: 1,
          explanation: "Na cicloide a força tangencial é proporcional ao arco até o fundo ($\\ddot s = -\\frac{g}{4R}s$): é um oscilador harmônico perfeito, com período independente da amplitude.",
        },
      ],
    },
  ],

  exercises: [
    {
      id: "reta",
      prompt: "Uma conta desliza sem atrito numa reta de A até B, com B {X} m à frente e {Y} m abaixo de A, partindo do repouso. Quanto tempo leva? (g = 9,8 m/s²)",
      vary: { X: [0.5, 4, 2], Y: [0.3, 2.5, 2] },
      answer: { label: "T", unit: "s", compute: (p) => tLine(num(p, "X"), num(p, "Y"), 9.8) },
      hint: "Na reta a aceleração é g·Y/L constante.",
    },
    {
      id: "tauto",
      prompt: "Uma cicloide é gerada por um círculo de raio {Rc} m. Quanto tempo uma conta leva, sem atrito, de qualquer ponto até o fundo? (g = 9,8 m/s²)",
      vary: { Rc: [0.2, 1.5, 2] },
      fixed: { modo: 1 },
      answer: { label: "T", unit: "s", compute: (p) => Math.PI * Math.sqrt(num(p, "Rc") / 9.8) },
    },
  ],

  init(p) {
    const s: BQ = { bx: num(p, "X", 3), by: -num(p, "Y", 1.5), drawn: [], draft: [], drawing: false, dragB: false, gid: 0, beads: [], tt: 0 };
    return reset(s, p);
  },
  step(s, p, _t, dt) {
    if (s.drawing || s.dragB) return s;
    const curves = curvesOf(s, p);
    const g = G(p);
    const mu = MU(p);
    return { ...s, tt: s.tt + dt, beads: s.beads.map((b) => stepBead(b, curves[b.c]!, g, mu, s.tt, dt)) };
  },
  dt: 1e-3,
  sampleEvery: 20,
  maxSamples: 3000,
  stopWhen: (s, p) => (modo(p) === 0 && !s.drawing && !s.dragB && finishedRace(s) ? 0 : 1),
  tEnd: 60,

  pointer: {
    down(s, p, pt) {
      if (modo(p) !== 0) return undefined;
      if (Math.hypot(pt.x - s.bx, pt.y - s.by) < 0.25) return { ...s, dragB: true };
      return { ...s, drawing: true, draft: [[pt.x, pt.y]] };
    },
    move(s, p, pt, dragging) {
      if (!dragging || modo(p) !== 0) return undefined;
      if (s.dragB) {
        const bx = clamp(Math.round(pt.x * 20) / 20, 0.3, 5);
        const by = clamp(Math.round(pt.y * 20) / 20, -3, -0.1);
        return bx === s.bx && by === s.by ? undefined : reset(s, p, { bx, by, drawn: [], gid: s.gid + 1 });
      }
      if (!s.drawing) return undefined;
      const last = s.draft[s.draft.length - 1]!;
      if (Math.hypot(pt.x - last[0], pt.y - last[1]) < 0.04) return undefined;
      return { ...s, draft: [...s.draft, [pt.x, pt.y]] };
    },
    up(s, p) {
      if (modo(p) !== 0) return undefined;
      if (s.dragB) return reset(s, p, { dragB: false });
      if (!s.drawing) return undefined;
      if (s.draft.length < 4) return { ...s, drawing: false, draft: [] };
      return reset(s, p, { drawing: false, drawn: smooth(s.draft, s.bx, s.by), draft: [], gid: s.gid + 1 });
    },
    cursor: (s, p, pt) => (modo(p) !== 0 ? undefined : Math.hypot(pt.x - s.bx, pt.y - s.by) < 0.25 ? "move" : "crosshair"),
  },
  actions: [
    { id: "apagar", label: "Apagar sua curva", run: (s) => ({ ...s, drawn: [], gid: s.gid + 1, beads: s.beads.slice(0, 4), tt: 0 }) },
  ],

  viewport(p) {
    if (modo(p) === 1) {
      const R = num(p, "Rc", 0.5);
      return { xMin: -0.6 * R, xMax: 2 * Math.PI * R + 0.6 * R, yMin: -4.9 * R, yMax: 0.9 * R, unit: "m" };
    }
    return { xMin: -0.5, xMax: 5.6, yMin: -3.7, yMax: 1.1, unit: "m" };
  },

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const { state: s, params: p, theme: th } = frame;
    const curves = curvesOf(s, p);
    const col = (i: number) => th.series[i % th.series.length]!;
    const tau = modo(p) === 1;
    for (const c of curves) {
      const pts: [number, number][] = c.xs.map((x, i) => [x, c.ys[i]!]);
      d.polyline(pts, { color: col(c.color), width: 2.5, alpha: 0.85 });
    }
    for (const b of s.beads) {
      const c = curves[b.c]!;
      const [x, y] = pointAt(c, b.s);
      d.circle(x, y, 0, { fill: col(c.color), stroke: th.text, width: 1, minPx: 7 });
    }
    if (s.draft.length > 1) d.polyline(s.draft, { color: col(4), width: 2, dash: [5, 4] });
    if (tau) {
      const R = num(p, "Rc", 0.5);
      const T = Math.PI * Math.sqrt(R / G(p));
      d.line(Math.PI * R, 0.2 * R, Math.PI * R, -4.8 * R, { color: th.muted, dash: [4, 4], width: 1 });
      d.text(`fundo: π√(R/g) = ${formatBR(T, 4)} s`, Math.PI * R + 0.1 * R, -2.25 * R, { align: "left", size: 11, color: th.muted });
      curves.forEach((c, ci) => {
        const ts = s.beads.filter((b) => b.c === ci).map((b) => (b.arr >= 0 ? formatBR(b.arr, 4) : "…"));
        d.text(`${c.name}: chegadas ${ts.join(" · ")} s`, -0.5 * R, (ci === 0 ? 0.6 : -2.35) * R, { align: "left", size: 11, color: col(c.color), weight: "600" });
      });
      d.text(`t = ${formatBR(s.tt, 3)} s`, 2 * Math.PI * R + 0.5 * R, 0.6 * R, { align: "right", size: 12, weight: "600" });
      return;
    }
    d.dot(0, 0, 6, th.text);
    d.text("A", -0.15, 0.12, { size: 13, weight: "700" });
    d.circle(s.bx, s.by, 0.09, { stroke: th.accent, width: 2, fill: th.accent, alpha: 0.4 });
    d.text("B (arraste)", s.bx + 0.14, s.by, { size: 12, weight: "700", align: "left", color: th.accent });
    // tabela de tempos
    const pred = predicted(s, p);
    const order = s.beads
      .map((b, i) => ({ i, t: b.arr }))
      .filter((q) => q.t >= 0)
      .sort((a, b) => a.t - b.t)
      .map((q) => q.i);
    d.text("curva          chegada     previsto", 1.6, 0.95, { size: 11, align: "left", color: th.muted });
    s.beads.forEach((b, i) => {
      const c = curves[b.c]!;
      const place = order.indexOf(i);
      const tArr = b.arr >= 0 ? `${formatBR(b.arr, 4)} s` : b.stuck ? "parou" : `${formatBR(s.tt, 3)} s…`;
      const pr = Number.isFinite(pred[i]!) ? `${formatBR(pred[i]!, 4)} s` : "não chega";
      d.text(`${place >= 0 ? `${place + 1}º ` : "    "}${c.name}`, 1.6, 0.78 - i * 0.16, { size: 11, align: "left", color: col(c.color), weight: "600" });
      d.text(tArr, 3.5, 0.78 - i * 0.16, { size: 11, align: "left" });
      d.text(pr, 4.6, 0.78 - i * 0.16, { size: 11, align: "left", color: th.muted });
    });
    if (!s.drawn.length && !s.drawing) d.text("arraste a partir de A para desenhar sua curva", 0.1, -3.55, { size: 11, align: "left", color: th.muted });
  },
});

export default braquistocrona;
