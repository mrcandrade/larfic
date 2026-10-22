import { defineSim, deg, draw, num, rad, texNum, type Params } from "@fisilab/core";

export const G = 9.81;
type P2 = [number, number];

/** Grade da placa: GW × GH células quadradas de lado CELL (m), centrada na origem. */
export const GW = 24;
export const GH = 16;
export const CELL = 0.1;
/** Densidade superficial da placa (kg/m²). */
export const SIGMA = 10;
/** Amortecimento da placa pendurada (1/s). */
const GAMMA = 1.2;

export interface Part {
  x: number;
  y: number;
  m: number;
}
export interface Frag {
  x: number;
  y: number;
  vx: number;
  vy: number;
  m: number;
  landed: boolean;
}

export interface CMState {
  parts: Part[];
  cells: number[];
  tool: "mover" | "massa" | "recortar" | "colar" | "pendurar";
  /** Partícula arrastada (−1 nenhuma) ou −2 enquanto pinta a placa. */
  drag: number;
  /** Placa pendurada: ponto do corpo (coordenadas da placa) preso no ponto do mundo P, girada de ang. */
  hang: { b0: P2; P: P2 } | null;
  ang: number;
  om: number;
  /** Fios de prumo marcados, em coordenadas da placa: ponto e direção. */
  plumbs: { b: P2; d: P2 }[];
  // explosão
  t: number;
  frags: [Frag, Frag];
  exploded: boolean;
}

export const modo = (p: Params) => Math.round(num(p, "modo"));

// ---------------- Partículas ----------------
export function cmParts(parts: Part[]): { x: number; y: number; M: number } {
  let M = 0;
  let sx = 0;
  let sy = 0;
  for (const q of parts) {
    M += q.m;
    sx += q.m * q.x;
    sy += q.m * q.y;
  }
  return M > 0 ? { x: sx / M, y: sy / M, M } : { x: 0, y: 0, M: 0 };
}

// ---------------- Placa ----------------
export const cellCenter = (i: number): P2 => {
  const ix = i % GW;
  const iy = Math.floor(i / GW);
  return [(ix + 0.5 - GW / 2) * CELL, (iy + 0.5 - GH / 2) * CELL];
};

export function shapeCells(forma: number): number[] {
  const out = new Array<number>(GW * GH).fill(0);
  for (let i = 0; i < GW * GH; i++) {
    const [x, y] = cellCenter(i);
    let on = false;
    const inRect = Math.abs(x) < 1.0 && Math.abs(y) < 0.6;
    if (forma === 0) on = inRect;
    else if (forma === 1) on = inRect && (x < -0.4 || y < -0.2); // L: coluna esquerda + base
    else if (forma === 2) on = Math.hypot(x, y) < 0.75 && Math.hypot(x, y) > 0.45; // anel
    else if (forma === 3) on = y > -0.6 && y < 0.6 && Math.abs(x) < 1.0 * ((0.6 - y) / 1.2); // triângulo isósceles
    else on = inRect && Math.hypot(x - 0.45, y - 0.1) > 0.35; // placa com furo excêntrico
    out[i] = on ? 1 : 0;
  }
  return out;
}

/** CM numérico da placa (soma sobre as células) e massa total. */
export function cmPlate(cells: number[]): { x: number; y: number; M: number; n: number } {
  let n = 0;
  let sx = 0;
  let sy = 0;
  cells.forEach((c, i) => {
    if (!c) return;
    const [x, y] = cellCenter(i);
    n++;
    sx += x;
    sy += y;
  });
  const M = n * SIGMA * CELL * CELL;
  return n > 0 ? { x: sx / n, y: sy / n, M, n } : { x: 0, y: 0, M: 0, n: 0 };
}

/** Momento de inércia da placa em relação a um ponto b (eixo perpendicular). */
export function inertiaAbout(cells: number[], b: P2): number {
  const mc = SIGMA * CELL * CELL;
  let I = 0;
  cells.forEach((c, i) => {
    if (!c) return;
    const [x, y] = cellCenter(i);
    I += mc * ((x - b[0]) ** 2 + (y - b[1]) ** 2 + (CELL * CELL) / 6);
  });
  return I;
}

const rot = (v: P2, a: number): P2 => [v[0] * Math.cos(a) - v[1] * Math.sin(a), v[0] * Math.sin(a) + v[1] * Math.cos(a)];
/** Ponto do corpo → mundo. */
export function toWorld(s: CMState, b: P2): P2 {
  if (!s.hang) return b;
  const r = rot([b[0] - s.hang.b0[0], b[1] - s.hang.b0[1]], s.ang);
  return [s.hang.P[0] + r[0], s.hang.P[1] + r[1]];
}
export function toBody(s: CMState, w: P2): P2 {
  if (!s.hang) return w;
  const r = rot([w[0] - s.hang.P[0], w[1] - s.hang.P[1]], -s.ang);
  return [s.hang.b0[0] + r[0], s.hang.b0[1] + r[1]];
}
const cellAt = (b: P2): number => {
  const ix = Math.floor(b[0] / CELL + GW / 2);
  const iy = Math.floor(b[1] / CELL + GH / 2);
  return ix >= 0 && ix < GW && iy >= 0 && iy < GH ? iy * GW + ix : -1;
};

/** Aceleração angular da placa pendurada: torque do peso no CM menos amortecimento. */
function angAcc(s: CMState, ang: number, om: number, cm: { x: number; y: number; M: number }, I: number): number {
  if (!s.hang || I <= 0) return 0;
  const r = rot([cm.x - s.hang.b0[0], cm.y - s.hang.b0[1]], ang);
  return (-cm.M * G * r[0]) / I - GAMMA * om;
}

// ---------------- Explosão ----------------
export function launch(p: Params): [Frag, Frag] {
  const v0 = num(p, "v0", 30);
  const th = rad(num(p, "ang0", 60));
  const M = num(p, "Mtot", 10);
  const f = num(p, "frac", 0.5);
  const base = { x: 0, y: 0, vx: v0 * Math.cos(th), vy: v0 * Math.sin(th), landed: false };
  return [
    { ...base, m: f * M },
    { ...base, m: (1 - f) * M },
  ];
}

/** Velocidades após a explosão: impulso interno ±J ao longo de β, com velocidade relativa vrel. */
export function explode(fr: [Frag, Frag], p: Params): [Frag, Frag] {
  const [a, b] = fr;
  const M = a.m + b.m;
  const vrel = num(p, "vrel", 15);
  const be = rad(num(p, "beta", 0));
  const ex = Math.cos(be);
  const ey = Math.sin(be);
  return [
    { ...a, vx: a.vx + (b.m / M) * vrel * ex, vy: a.vy + (b.m / M) * vrel * ey },
    { ...b, vx: b.vx - (a.m / M) * vrel * ex, vy: b.vy - (a.m / M) * vrel * ey },
  ];
}

/** Avança um fragmento em queda livre por h, parando exatamente no chão. */
function fly(f: Frag, h: number): Frag {
  if (f.landed) return f;
  const y = f.y + f.vy * h - 0.5 * G * h * h;
  if (y > 0) return { ...f, x: f.x + f.vx * h, y, vy: f.vy - G * h };
  // instante exato do toque: y + vy τ − g τ²/2 = 0
  const tau = (f.vy + Math.sqrt(f.vy * f.vy + 2 * G * Math.max(0, f.y))) / G;
  if (tau <= 1e-12 && f.vy > 0) return { ...f, x: f.x + f.vx * h, y: f.y + f.vy * h - 0.5 * G * h * h, vy: f.vy - G * h };
  return { ...f, x: f.x + f.vx * tau, y: 0, vx: 0, vy: 0, landed: true };
}

function stepExplosion(s: CMState, p: Params, dt: number): CMState {
  const te = num(p, "texp", 2);
  let fr = s.frags;
  let t = s.t;
  let exploded = s.exploded;
  let left = dt;
  if (!exploded && t + left >= te) {
    const h = te - t;
    // decolagem: no instante 0 está no chão subindo — usa fly com proteção
    fr = [flyUp(fr[0], h), flyUp(fr[1], h)];
    if (!fr[0].landed) fr = explode(fr, p);
    exploded = true;
    t = te;
    left -= h;
  }
  fr = [flyUp(fr[0], left), flyUp(fr[1], left)];
  return { ...s, frags: fr, t: t + left, exploded };
}
/** Como fly, mas não pousa no instante do lançamento (y = 0 subindo). */
function flyUp(f: Frag, h: number): Frag {
  if (f.landed || h <= 0) return f;
  if (f.y === 0 && f.vy > 0) {
    const y = f.vy * h - 0.5 * G * h * h;
    if (y > 0) return { ...f, x: f.x + f.vx * h, y, vy: f.vy - G * h };
  }
  return fly(f, h);
}

export function cmFrags(fr: [Frag, Frag]): P2 {
  const M = fr[0].m + fr[1].m;
  return [(fr[0].m * fr[0].x + fr[1].m * fr[1].x) / M, (fr[0].m * fr[0].y + fr[1].m * fr[1].y) / M];
}
/** Parábola do projétil sem explosão. */
export function parabola(p: Params, t: number): P2 {
  const v0 = num(p, "v0", 30);
  const th = rad(num(p, "ang0", 60));
  return [v0 * Math.cos(th) * t, v0 * Math.sin(th) * t - 0.5 * G * t * t];
}

function initState(p: Params): CMState {
  return {
    parts: [
      { x: -2.5, y: -1, m: 1 },
      { x: 2, y: -1.5, m: 3 },
      { x: 0.5, y: 2, m: 2 },
    ],
    cells: shapeCells(Math.round(num(p, "forma", 1))),
    tool: modo(p) === 1 ? "recortar" : "mover",
    drag: -1,
    hang: null,
    ang: 0,
    om: 0,
    plumbs: [],
    t: 0,
    frags: launch(p),
    exploded: false,
  };
}

/** Centro de massa atual (mundo) e massa total, conforme o modo. */
export function currentCM(s: CMState, p: Params): { x: number; y: number; M: number } {
  const md = modo(p);
  if (md === 0) return cmParts(s.parts);
  if (md === 1) {
    const c = cmPlate(s.cells);
    const w = toWorld(s, [c.x, c.y]);
    return { x: w[0], y: w[1], M: c.M };
  }
  const [x, y] = cmFrags(s.frags);
  return { x, y, M: s.frags[0].m + s.frags[1].m };
}

const PV = { x0: -5, x1: 5, y0: -4, y1: 4 };
const fmt = (v: number, n = 3) => (Number.isFinite(v) ? Number((Math.abs(v) < 5e-4 ? 0 : v).toPrecision(n)).toString().replace(".", ",") : "—");

function paint(s: CMState, pt: { x: number; y: number }): CMState | undefined {
  if (s.hang) return undefined;
  const i = cellAt([pt.x, pt.y]);
  if (i < 0) return undefined;
  const val = s.tool === "colar" ? 1 : 0;
  if (s.cells[i] === val) return { ...s, drag: -2 };
  const cells = s.cells.slice();
  cells[i] = val;
  return { ...s, cells, drag: -2, plumbs: [] };
}

function explosionView(p: Params) {
  const v0 = num(p, "v0", 30);
  const th = rad(num(p, "ang0", 60));
  const R = Math.max(5, (v0 * v0 * Math.sin(2 * th)) / G);
  const H = Math.max(3, (v0 * Math.sin(th)) ** 2 / (2 * G));
  const w = Math.max(1.9 * R, 2.4 * H);
  return { xMin: -0.35 * R, xMax: -0.35 * R + w * 1.25, yMin: -0.12 * H, yMax: 1.9 * H };
}

export const centroMassa = defineSim<CMState>({
  id: "centro-massa",
  title: "Centro de massa",
  course: "FG I",
  topic: "Sistemas de partículas",
  priority: "P2",
  summary:
    "Arraste partículas, recorte placas célula a célula e veja o centro de massa calculado numericamente; pendure a placa por um ponto (o CM fica abaixo) e exploda um projétil com o CM seguindo a parábola.",
  equations: [
    String.raw`\vec r_{\text{CM}} = \frac{1}{M}\sum_i m_i \vec r_i \qquad M = \sum_i m_i`,
    String.raw`\text{placa: } \vec r_{\text{CM}} = \frac{1}{A}\int \vec r\,dA \approx \frac{1}{N}\sum_{\text{células}} \vec r_k`,
    String.raw`\text{pendurada: } \tau = -Mg\,d\sin\phi \Rightarrow \text{equilíbrio com o CM na vertical abaixo do pino}`,
    String.raw`\text{explosão: } \vec F_{\text{ext}} = M\vec g \Rightarrow \vec r_{\text{CM}}(t) = \vec v_0 t + \tfrac12 \vec g t^2`,
  ],
  liveEquations(s, p) {
    const md = modo(p);
    const cm = currentCM(s, p);
    if (md === 0) {
      const terms = s.parts.map((q) => `${texNum(q.m)}\\cdot${texNum(q.x)}`).join(" + ");
      return [String.raw`x_{\text{CM}} = \frac{${terms}}{${texNum(cm.M)}} = ${texNum(cm.x)}\ \text{m} \qquad y_{\text{CM}} = ${texNum(cm.y)}\ \text{m}`];
    }
    if (md === 1) {
      const c = cmPlate(s.cells);
      return [
        String.raw`N = ${c.n}\ \text{células} \quad M = ${texNum(c.M)}\ \text{kg} \quad \vec r_{\text{CM}} = (${texNum(c.x)},\ ${texNum(c.y)})\ \text{m (na placa)}`,
        s.hang ? String.raw`\phi = ${texNum(deg(s.ang))}^\circ \qquad \omega = ${texNum(s.om)}\ \text{rad/s}` : String.raw`\text{solta}`,
      ];
    }
    const pb = parabola(p, s.t);
    return [
      String.raw`\vec r_{\text{CM}} = (${texNum(cm.x)},\ ${texNum(cm.y)})\ \text{m} \qquad \text{parábola: } (${texNum(pb[0])},\ ${texNum(pb[1])})\ \text{m}`,
    ];
  },

  params: [
    {
      key: "modo",
      label: "Situação",
      unit: "",
      min: 0,
      max: 2,
      step: 1,
      default: 0,
      options: [
        { value: 0, label: "Sistema de partículas" },
        { value: 1, label: "Placa recortável (corpo extenso)" },
        { value: 2, label: "Explosão de um projétil" },
      ],
    },
    {
      key: "forma",
      label: "Placa inicial",
      unit: "",
      min: 0,
      max: 4,
      step: 1,
      default: 1,
      options: [
        { value: 0, label: "Retângulo" },
        { value: 1, label: "Em L" },
        { value: 2, label: "Anel" },
        { value: 3, label: "Triângulo" },
        { value: 4, label: "Retângulo com furo" },
      ],
    },
    { key: "v0", label: "Velocidade de lançamento", unit: "m/s", min: 5, max: 60, step: 1, default: 30 },
    { key: "ang0", label: "Ângulo de lançamento", unit: "°", min: 10, max: 85, step: 1, default: 60 },
    { key: "Mtot", label: "Massa do projétil", unit: "kg", min: 1, max: 50, step: 1, default: 10 },
    { key: "texp", label: "Instante da explosão", unit: "s", min: 0.2, max: 6, step: 0.1, default: 2 },
    { key: "frac", label: "Fração de massa do fragmento 1", unit: "", min: 0.1, max: 0.9, step: 0.05, default: 0.3 },
    { key: "vrel", label: "Velocidade relativa dos fragmentos", unit: "m/s", min: 0, max: 40, step: 1, default: 20 },
    { key: "beta", label: "Direção da explosão", unit: "°", min: -180, max: 180, step: 5, default: 30 },
  ],

  observables: [
    { key: "xcm", label: "x do CM", unit: "m", value: (s, p) => currentCM(s, p).x },
    { key: "ycm", label: "y do CM", unit: "m", value: (s, p) => currentCM(s, p).y },
    { key: "M", label: "Massa total", unit: "kg", value: (s, p) => currentCM(s, p).M },
    { key: "ang", label: "Ângulo da placa pendurada", unit: "°", value: (s) => deg(s.ang) },
    {
      key: "desvio",
      label: "Distância do CM à parábola",
      unit: "m",
      value: (s, p) => {
        if (modo(p) !== 2) return 0;
        const c = cmFrags(s.frags);
        const pb = parabola(p, s.t);
        return Math.hypot(c[0] - pb[0], c[1] - pb[1]);
      },
    },
  ],
  chart: { x: "xcm", y: "ycm" },

  scenarios: [
    {
      id: "particulas",
      label: "Partículas arrastáveis",
      params: { modo: 0 },
      guide: `### Média ponderada pelas massas
1. Arraste as partículas e acompanhe o **×** do CM. Ele fica sempre dentro do menor polígono que contém todas.
2. Escolha a ferramenta **Massa** e clique numa partícula para aumentar sua massa: o CM se aproxima dela.
3. Com só duas partículas, confira $x_{\\text{CM}} = \\dfrac{m_1x_1 + m_2x_2}{m_1+m_2}$: o CM divide o segmento na razão inversa das massas.`,
      predict: [
        {
          question: "Duas partículas, de 1 kg e 3 kg, estão a 4 m uma da outra. O CM fica a que distância da de 3 kg?",
          options: ["1 m", "2 m", "3 m"],
          answer: 0,
          explanation: "$d_{3} = \\dfrac{m_1}{m_1+m_2}\\,d = \\dfrac14 \\cdot 4 = 1$ m: o CM fica mais perto da massa maior.",
        },
      ],
    },
    {
      id: "recortar",
      label: "Recorte a placa",
      params: { modo: 1, forma: 2 },
      guide: `### O CM pode ficar fora do corpo
1. No anel, o CM fica no centro do furo, onde não há material.
2. Use **Recortar** para apagar células e **Colar** para acrescentar: o CM é recalculado somando as $N$ células (integral numérica).
3. Troque para a placa em L: decomponha em dois retângulos e confira $\\vec r_{\\text{CM}} = (A_1\\vec r_1 + A_2\\vec r_2)/(A_1 + A_2)$.`,
      predict: [
        {
          question: "Onde fica o centro de massa de um anel homogêneo?",
          options: ["sobre o anel, no ponto mais pesado", "no centro, onde não há material", "não existe"],
          answer: 1,
          explanation: "Por simetria, cada pedaço tem um oposto que o equilibra: o CM é o centro geométrico, mesmo sem massa ali.",
        },
      ],
    },
    {
      id: "pendurar",
      label: "Pendure e ache o CM",
      params: { modo: 1, forma: 4 },
      guide: `### Método do fio de prumo
1. Escolha **Pendurar** e clique perto de uma borda da placa. Rode: ela oscila e para com o CM **na vertical abaixo do pino** (energia potencial mínima).
2. Clique em **Marcar fio de prumo**. Pendure por outro ponto, rode e marque de novo.
3. As retas se cruzam no CM, que confere com o calculado. Pendurando pelo próprio CM, a placa fica parada em qualquer ângulo.`,
    },
    {
      id: "explosao",
      label: "Explosão em voo",
      params: { modo: 2, v0: 30, ang0: 60, texp: 2, frac: 0.3, vrel: 20, beta: 30 },
      guide: `### O CM não sabe que houve explosão
1. As forças da explosão são internas: o momento total e o movimento do CM não mudam.
2. Rode: os fragmentos seguem parábolas diferentes, mas o **×** do CM continua na parábola tracejada original.
3. Quando o primeiro fragmento toca o chão, a normal (força externa) passa a agir e o CM sai da parábola: veja o observável *distância do CM à parábola*.`,
      predict: [
        {
          question: "Depois da explosão e antes de qualquer fragmento tocar o solo, o CM:",
          options: ["continua na parábola original", "sobe, por causa da energia da explosão", "para de se mover na horizontal"],
          answer: 0,
          explanation: "$M\\vec a_{\\text{CM}} = \\vec F_{\\text{ext}} = M\\vec g$: as forças da explosão se cancelam aos pares (3ª lei).",
        },
      ],
    },
  ],

  exercises: [
    {
      id: "duas",
      prompt:
        "Uma partícula de {m1} kg está em x = {x1} m e outra de {m2} kg em x = {x2} m. Qual a coordenada x do centro de massa?",
      vary: { m1: [0.5, 5, 1], x1: [-4, 0, 1], m2: [0.5, 5, 1], x2: [0.5, 4, 1] },
      fixed: { modo: 0 },
      answer: {
        label: "x_CM",
        unit: "m",
        compute: (p) => (num(p, "m1") * num(p, "x1") + num(p, "m2") * num(p, "x2")) / (num(p, "m1") + num(p, "m2")),
      },
      tolerance: 0.02,
    },
    {
      id: "apice",
      prompt:
        "Um projétil é lançado a {v0} m/s com {ang0}° acima da horizontal. No ponto mais alto, explode em duas metades iguais; uma delas fica parada logo após a explosão e cai na vertical. A que distância do ponto de lançamento cai a outra?",
      vary: { v0: [10, 40, 0], ang0: [30, 70, 0] },
      fixed: { modo: 2, frac: 0.5 },
      answer: {
        label: "x₂",
        unit: "m",
        compute: (p) => (1.5 * num(p, "v0") ** 2 * Math.sin(2 * rad(num(p, "ang0")))) / G,
      },
      hint: "Os dois pedaços caem no mesmo tempo, e o CM cairia no alcance R; o pedaço parado cai em R/2.",
    },
  ],

  init: initState,
  step(s, p, _t, dt) {
    const md = modo(p);
    if (md === 2) return stepExplosion(s, p, dt);
    if (md === 1 && s.hang) {
      const c = cmPlate(s.cells);
      const I = inertiaAbout(s.cells, s.hang.b0);
      const f = (a: number, w: number): [number, number] => [w, angAcc(s, a, w, c, I)];
      const [a1, b1] = f(s.ang, s.om);
      const [a2, b2] = f(s.ang + (dt / 2) * a1, s.om + (dt / 2) * b1);
      const [a3, b3] = f(s.ang + (dt / 2) * a2, s.om + (dt / 2) * b2);
      const [a4, b4] = f(s.ang + dt * a3, s.om + dt * b3);
      return { ...s, ang: s.ang + (dt / 6) * (a1 + 2 * a2 + 2 * a3 + a4), om: s.om + (dt / 6) * (b1 + 2 * b2 + 2 * b3 + b4), t: s.t + dt };
    }
    return { ...s, t: s.t + dt };
  },
  dt: 2e-3,
  sampleEvery: 10,
  tEnd: 60,
  stopWhen: (s, p) => (modo(p) === 2 && s.frags[0].landed && s.frags[1].landed ? -1 : 1),

  pointer: {
    down(s, p, pt) {
      const md = modo(p);
      if (md === 0) {
        let best = -1;
        let bd = 0.5;
        s.parts.forEach((q, i) => {
          const dd = Math.hypot(q.x - pt.x, q.y - pt.y);
          if (dd < bd) {
            bd = dd;
            best = i;
          }
        });
        if (best < 0) return undefined;
        if (s.tool === "massa") {
          const parts = s.parts.map((q, i) => (i === best ? { ...q, m: q.m >= 5 ? 0.5 : q.m < 1 ? 1 : q.m + 1 } : q));
          return { ...s, parts };
        }
        return { ...s, drag: best };
      }
      if (md === 1) {
        if (s.tool === "pendurar") {
          const b = toBody(s, [pt.x, pt.y]);
          const i = cellAt(b);
          if (i < 0 || !s.cells[i]) return undefined;
          return { ...s, hang: { b0: b, P: [pt.x, pt.y] }, om: 0 };
        }
        return paint(s, pt);
      }
      return undefined;
    },
    move(s, p, pt, dragging) {
      if (!dragging) return undefined;
      if (modo(p) === 0 && s.drag >= 0) {
        const x = Math.round(Math.min(PV.x1 - 0.2, Math.max(PV.x0 + 0.2, pt.x)) * 10) / 10;
        const y = Math.round(Math.min(PV.y1 - 0.2, Math.max(PV.y0 + 0.2, pt.y)) * 10) / 10;
        return { ...s, parts: s.parts.map((q, i) => (i === s.drag ? { ...q, x, y } : q)) };
      }
      if (modo(p) === 1 && s.drag === -2) return paint(s, pt);
      return undefined;
    },
    up: (s) => (s.drag !== -1 ? { ...s, drag: -1 } : undefined),
    cursor(s, p, pt) {
      if (modo(p) === 0) return s.parts.some((q) => Math.hypot(q.x - pt.x, q.y - pt.y) < 0.5) ? (s.tool === "massa" ? "pointer" : "grab") : undefined;
      if (modo(p) === 1) return cellAt(toBody(s, [pt.x, pt.y])) >= 0 ? "crosshair" : undefined;
      return undefined;
    },
  },
  actions: [
    { id: "mover", label: "Mover partículas", run: (s) => ({ ...s, tool: "mover" }), active: (s) => s.tool === "mover" },
    { id: "massa", label: "Massa (clique: +1 kg)", run: (s) => ({ ...s, tool: "massa" }), active: (s) => s.tool === "massa" },
    {
      id: "add",
      label: "Adicionar partícula",
      run: (s) => (s.parts.length >= 8 ? s : { ...s, parts: [...s.parts, { x: -4 + s.parts.length, y: 3 - 0.4 * s.parts.length, m: 1 }] }),
    },
    { id: "remover", label: "Remover última partícula", run: (s) => (s.parts.length <= 1 ? s : { ...s, parts: s.parts.slice(0, -1) }) },
    { id: "recortar", label: "Recortar placa", run: (s) => ({ ...s, tool: "recortar" }), active: (s) => s.tool === "recortar" },
    { id: "colar", label: "Colar na placa", run: (s) => ({ ...s, tool: "colar" }), active: (s) => s.tool === "colar" },
    { id: "pendurar", label: "Pendurar por um ponto", run: (s) => ({ ...s, tool: "pendurar" }), active: (s) => s.tool === "pendurar" },
    {
      id: "prumo",
      label: "Marcar fio de prumo",
      run: (s) => (s.hang ? { ...s, plumbs: [...s.plumbs.slice(-3), { b: s.hang.b0, d: rot([0, -1], -s.ang) }] } : s),
    },
    { id: "soltar", label: "Soltar a placa", run: (s) => ({ ...s, hang: null, ang: 0, om: 0, plumbs: [] }) },
  ],

  viewport(p) {
    const md = modo(p);
    if (md === 0) return { xMin: PV.x0, xMax: 10, yMin: PV.y0, yMax: PV.y1, unit: "" };
    if (md === 1) return { xMin: -3, xMax: 5.6, yMin: -2.7, yMax: 1.7, unit: "" };
    return { ...explosionView(p), unit: "m" };
  },

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const { state: s, params: p, theme, trail } = frame;
    const md = modo(p);
    const cross = (x: number, y: number, r: number, label = "CM") => {
      d.line(x - r, y - r, x + r, y + r, { color: theme.positive, width: 3 });
      d.line(x - r, y + r, x + r, y - r, { color: theme.positive, width: 3 });
      d.text(label, x + r * 1.4, y + r * 1.4, { color: theme.positive, size: 12, weight: "700", align: "left" });
    };

    if (md === 0) {
      d.grid(PV.x0, PV.x1, PV.y0, PV.y1, 1);
      d.rect(PV.x0, PV.y0, PV.x1 - PV.x0, PV.y1 - PV.y0, { stroke: theme.grid, width: 1 });
      const cm = cmParts(s.parts);
      for (const q of s.parts) d.line(q.x, q.y, cm.x, cm.y, { color: theme.muted, dash: [3, 4], width: 1 });
      s.parts.forEach((q, i) => {
        const r = 0.15 + 0.1 * Math.sqrt(q.m);
        d.circle(q.x, q.y, r, { fill: theme.series[i % theme.series.length]!, stroke: theme.text, width: 1 });
        d.text(`${fmt(q.m)} kg`, q.x, q.y - r - 0.3, { size: 11 });
      });
      cross(cm.x, cm.y, 0.18);
      const lines = [
        `M = ${fmt(cm.M)} kg`,
        `x_CM = ${fmt(cm.x)} m`,
        `y_CM = ${fmt(cm.y)} m`,
        "",
        "Arraste as partículas.",
        `Ferramenta: ${s.tool === "massa" ? "massa (clique soma 1 kg)" : "mover"}`,
      ];
      lines.forEach((ln, i) => d.text(ln, 5.5, 3.3 - i * 0.6, { align: "left", size: 12, weight: i < 3 ? "600" : "400" }));
      return;
    }

    if (md === 1) {
      const c = cmPlate(s.cells);
      // grade da placa (contorno do recorte possível)
      if (!s.hang) {
        d.rect(-GW * CELL * 0.5, -GH * CELL * 0.5, GW * CELL, GH * CELL, { stroke: theme.grid, width: 1, dash: [3, 3] });
      }
      const ctx2 = d.ctx;
      ctx2.save();
      if (s.hang) {
        ctx2.translate(s.hang.P[0], s.hang.P[1]);
        ctx2.rotate(s.ang);
        ctx2.translate(-s.hang.b0[0], -s.hang.b0[1]);
      }
      s.cells.forEach((on, i) => {
        if (!on) return;
        const [x, y] = cellCenter(i);
        d.rect(x - CELL / 2, y - CELL / 2, CELL, CELL, { fill: theme.series[0]!, alpha: 0.55 });
      });
      // fios de prumo marcados (no corpo)
      for (const pl of s.plumbs) d.line(pl.b[0] - pl.d[0] * 3, pl.b[1] - pl.d[1] * 3, pl.b[0] + pl.d[0] * 3, pl.b[1] + pl.d[1] * 3, { color: theme.series[1]!, width: 1.5, dash: [6, 4] });
      if (c.n > 0) cross(c.x, c.y, 0.06);
      ctx2.restore();
      if (s.hang) {
        const P = s.hang.P;
        d.support(P[0] - 0.3, P[1] + 0.25, P[0] + 0.3, P[1] + 0.25, { color: theme.muted });
        d.line(P[0], P[1] + 0.25, P[0], P[1], { color: theme.text, width: 2 });
        d.dot(P[0], P[1], 5, theme.text);
        d.line(P[0], P[1], P[0], P[1] - 3, { color: theme.series[1]!, width: 1, alpha: 0.7 });
        d.text("fio de prumo", P[0] + 0.08, P[1] - 1.9, { align: "left", size: 10, color: theme.series[1]! });
        const w = toWorld(s, [c.x, c.y]);
        d.arrow(w[0], w[1], 0, -0.5, { color: theme.text });
        d.text("Mg", w[0] + 0.1, w[1] - 0.45, { align: "left", size: 11, weight: "600" });
      }
      const lines = [
        `Células: ${c.n}   M = ${fmt(c.M)} kg`,
        `CM na placa: (${fmt(c.x)}; ${fmt(c.y)}) m`,
        s.hang ? `Ângulo: ${fmt(deg(s.ang))}°` : "Placa solta",
        s.hang ? `Pino em (${fmt(s.hang.b0[0])}; ${fmt(s.hang.b0[1])}) m da placa` : "",
        `Ferramenta: ${{ mover: "—", massa: "—", recortar: "recortar (arraste)", colar: "colar (arraste)", pendurar: "pendurar (clique)" }[s.tool]}`,
        `Fios marcados: ${s.plumbs.length}`,
      ];
      lines.forEach((ln, i) => d.text(ln, 2.9, 1.4 - i * 0.3, { align: "left", size: 11, weight: i < 2 ? "600" : "400" }));
      return;
    }

    // explosão
    const vp = explosionView(p);
    d.rect(vp.xMin, vp.yMin, vp.xMax - vp.xMin, -vp.yMin, { fill: theme.ground });
    // parábola original
    const v0 = num(p, "v0", 30);
    const T = (2 * v0 * Math.sin(rad(num(p, "ang0", 60)))) / G;
    const pts: [number, number][] = [];
    for (let i = 0; i <= 100; i++) pts.push(parabola(p, (T * i) / 100));
    d.polyline(pts, { color: theme.muted, dash: [6, 5], width: 1.5 });
    // rastros dos fragmentos e do CM
    for (const k of [0, 1] as const)
      d.polyline(trail.map((st) => [st.frags[k].x, st.frags[k].y] as [number, number]), { color: theme.series[k === 0 ? 1 : 2]!, width: 1.5 });
    d.polyline(trail.map((st) => cmFrags(st.frags)), { color: theme.positive, width: 1, alpha: 0.6 });
    const scl = (vp.yMax - vp.yMin) / 60;
    s.frags.forEach((f, k) => {
      const r = scl * (0.8 + Math.sqrt(f.m / (s.frags[0].m + s.frags[1].m)) * 1.4);
      d.circle(f.x, f.y, r, { fill: theme.series[k === 0 ? 1 : 2]!, stroke: theme.text, width: 1, minPx: 4 });
      if (s.exploded) d.text(`${fmt(f.m)} kg`, f.x, f.y + r + scl * 1.5, { size: 10 });
    });
    const c = cmFrags(s.frags);
    cross(c[0], c[1], scl * 0.9);
    if (s.exploded && s.t - num(p, "texp", 2) < 0.4) {
      const pe = parabola(p, num(p, "texp", 2));
      d.circle(pe[0], pe[1], scl * 4, { stroke: theme.series[5]!, width: 2 });
    }
    const dev = Math.hypot(c[0] - parabola(p, s.t)[0], c[1] - parabola(p, s.t)[1]);
    const lines = [
      `t = ${fmt(s.t)} s   ${s.exploded ? "após a explosão" : "antes da explosão"}`,
      `CM: (${fmt(c[0])}; ${fmt(c[1])}) m`,
      `Distância do CM à parábola: ${fmt(dev)} m`,
      s.frags[0].landed || s.frags[1].landed ? "Um fragmento tocou o solo: força externa extra" : "Só o peso age de fora: CM na parábola",
    ];
    lines.forEach((ln, i) => d.text(ln, vp.xMax - (vp.xMax - vp.xMin) * 0.02, vp.yMax - (vp.yMax - vp.yMin) * (0.05 + i * 0.05), { align: "right", size: 11, weight: i === 3 ? "700" : "400" }));
  },
});

export default centroMassa;
