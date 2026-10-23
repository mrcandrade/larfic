import { clamp, defineSim, deg, draw, num, rad, texNum, type Params } from "@fisilab/core";

export const G = 9.81;
/** Meia largura da pista da estrada (m): saiu dela, derrapou. */
export const HALF_ROAD = 6;
/** Inclinação da rampa de largada do loop e trecho plano antes do loop (m). */
export const RAMP_DEG = 50;
export const FLAT = 2;

export interface Curva {
  // Estrada compensada (vista de cima): ângulo, raio horizontal e velocidade ao longo do talude.
  phi: number;
  r: number;
  w: number;
  // Loop: fase (0 rampa, 1 no loop, 2 voo livre, 3 saiu do loop), distância na rampa,
  // ângulo no loop (0 embaixo) e velocidade escalar.
  ph: number;
  s: number;
  a: number;
  v: number;
  /** Posição e velocidade cartesianas do carrinho (loop). */
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Ângulo em que o carrinho descolou (NaN se não descolou). */
  aDet: number;
  /** Tempo de voo (s), para o evento de reencontro com a pista. */
  tf: number;
}

export const modo = (p: Params) => Math.round(num(p, "modo"));

// ---------------- Estrada compensada ----------------

/** Velocidade de projeto (nenhum atrito necessário). */
export const vIdeal = (R: number, thDeg: number) => Math.sqrt(G * R * Math.tan(rad(thDeg)));

/** Faixa de velocidades seguras [vmin, vmax] (vmax = Infinity se nunca derrapa para fora). */
export function faixaSegura(R: number, thDeg: number, mu: number): [number, number] {
  const th = rad(thDeg);
  const c = Math.cos(th);
  const sn = Math.sin(th);
  const lo = (sn - mu * c) / (c + mu * sn);
  const den = c - mu * sn;
  const hi = den > 1e-12 ? (sn + mu * c) / den : Infinity;
  return [Math.sqrt(Math.max(0, G * R * lo)), hi === Infinity ? Infinity : Math.sqrt(G * R * hi)];
}

/** Forças por unidade de peso na estrada: normal e atrito necessário (positivo = talude abaixo, para o centro). */
export function forcasEstrada(v: number, r: number, thDeg: number): { N: number; f: number } {
  const th = rad(thDeg);
  const ac = (v * v) / r;
  return { N: Math.cos(th) + (ac / G) * Math.sin(th), f: (ac / G) * Math.cos(th) - Math.sin(th) };
}

// ---------------- Loop vertical ----------------

/** Perfil do loop em função do ângulo: velocidade², N/mg e atrito/mg; para quando N < 0 ou v² < 0. */
export interface LoopProfile {
  phi: number[];
  v2: number[];
  N: number[];
  f: number[];
  /** Completa a volta sem descolar. */
  ok: boolean;
  /** Onde terminou: "volta", "descola" ou "para". */
  end: "volta" | "descola" | "para";
}

export function loopProfile(h: number, R: number, mu: number, n = 720): LoopProfile {
  const out: LoopProfile = { phi: [], v2: [], N: [], f: [], ok: false, end: "volta" };
  // d(v²)/dφ = 2R(−g sinφ − μ (v²/R + g cosφ))   (s = Rφ; atrito contra o movimento)
  const F = (ph: number, v2: number) => 2 * R * (-G * Math.sin(ph) - mu * Math.max(0, v2 / R + G * Math.cos(ph)));
  let v2 = 2 * G * h;
  const dphi = (2 * Math.PI) / n;
  for (let i = 0; i <= n; i++) {
    const ph = i * dphi;
    const N = v2 / (R * G) + Math.cos(ph);
    out.phi.push(ph);
    out.v2.push(v2);
    out.N.push(N);
    out.f.push(mu * Math.max(0, N));
    if (N < 0) {
      out.end = "descola";
      return out;
    }
    if (v2 <= 0) {
      out.end = "para";
      return out;
    }
    if (i === n) break;
    const k1 = F(ph, v2);
    const k2 = F(ph + dphi / 2, v2 + (dphi / 2) * k1);
    const k3 = F(ph + dphi / 2, v2 + (dphi / 2) * k2);
    const k4 = F(ph + dphi, v2 + dphi * k3);
    v2 += (dphi / 6) * (k1 + 2 * k2 + 2 * k3 + k4);
  }
  out.ok = true;
  return out;
}

const hMinCache = new Map<string, number>();

/** Altura mínima de largada para completar o loop (bissecção; sem atrito vale 2,5 R). */
export function hMin(R: number, mu: number): number {
  const key = `${R}|${mu}`;
  const hit = hMinCache.get(key);
  if (hit !== undefined) return hit;
  let lo = 0;
  let hi = 2.5 * R;
  while (!loopProfile(hi, R, mu, 360).ok) hi *= 1.5;
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    if (loopProfile(mid, R, mu, 720).ok) hi = mid;
    else lo = mid;
  }
  if (hMinCache.size > 200) hMinCache.clear();
  hMinCache.set(key, hi);
  return hi;
}

const rampGeom = (h: number) => {
  const al = rad(RAMP_DEG);
  const Li = h / Math.sin(al);
  const xTop = -FLAT - h / Math.tan(al);
  return { al, Li, xTop };
};

function rampPos(s: number, h: number): [number, number] {
  const { al, Li, xTop } = rampGeom(h);
  if (s <= Li) return [xTop + s * Math.cos(al), h - s * Math.sin(al)];
  return [-FLAT + (s - Li), 0];
}

function loopDeriv(a: number, v: number, R: number, mu: number): [number, number] {
  const N = (v * v) / R + G * Math.cos(a);
  return [v / R, -G * Math.sin(a) - mu * Math.max(0, N) * Math.sign(v)];
}

function loopStep(s: Curva, p: Params, dt: number): Curva {
  const R = num(p, "Rl", 5);
  const mu = num(p, "mul", 0);
  const h = num(p, "h", 14);
  const n = { ...s };
  if (s.ph === 0) {
    const { al, Li } = rampGeom(h);
    const acc = s.s < Li ? G * Math.sin(al) : 0;
    n.s = s.s + s.v * dt + 0.5 * acc * dt * dt;
    n.v = s.v + acc * dt;
    if (s.s < Li && n.s > Li) n.v = Math.sqrt(2 * G * h); // entra no plano com a energia exata
    if (n.s >= Li + FLAT) {
      n.ph = 1;
      n.a = (n.s - Li - FLAT) / R;
      n.v = Math.sqrt(2 * G * h);
    } else {
      [n.x, n.y] = rampPos(n.s, h);
      const dir = n.s < Li ? [Math.cos(al), -Math.sin(al)] : [1, 0];
      n.vx = n.v * dir[0]!;
      n.vy = n.v * dir[1]!;
      return n;
    }
  } else if (s.ph === 1) {
    const f = (a: number, v: number) => loopDeriv(a, v, R, mu);
    const [a1, b1] = f(s.a, s.v);
    const [a2, b2] = f(s.a + (dt / 2) * a1, s.v + (dt / 2) * b1);
    const [a3, b3] = f(s.a + (dt / 2) * a2, s.v + (dt / 2) * b2);
    const [a4, b4] = f(s.a + dt * a3, s.v + dt * b3);
    n.a = s.a + (dt / 6) * (a1 + 2 * a2 + 2 * a3 + a4);
    n.v = s.v + (dt / 6) * (b1 + 2 * b2 + 2 * b3 + b4);
    const N = (n.v * n.v) / R + G * Math.cos(n.a);
    if (N < 0 && n.v > 0) {
      n.ph = 2;
      n.aDet = n.a;
      n.tf = 0;
    } else if (n.a >= 2 * Math.PI) {
      n.ph = 3;
      n.x = R * (n.a - 2 * Math.PI);
      n.y = 0;
      n.vx = n.v;
      n.vy = 0;
      return n;
    }
  } else if (s.ph === 2) {
    n.x = s.x + s.vx * dt;
    n.y = s.y + s.vy * dt - 0.5 * G * dt * dt;
    n.vy = s.vy - G * dt;
    n.tf = s.tf + dt;
    n.v = Math.hypot(n.vx, n.vy);
    return n;
  } else {
    n.x = s.x + s.v * dt;
    return n;
  }
  // no loop: atualiza x, y a partir do ângulo
  n.x = R * Math.sin(n.a);
  n.y = R - R * Math.cos(n.a);
  n.vx = n.v * Math.cos(n.a);
  n.vy = n.v * Math.sin(n.a);
  return n;
}

function roadStep(s: Curva, p: Params, dt: number): Curva {
  const v = num(p, "v", 20);
  const th = rad(num(p, "theta", 15));
  const mu = num(p, "mu", 0.3);
  const n = { ...s };
  const ac = (v * v) / s.r;
  const drive = ac * Math.cos(th) - G * Math.sin(th); // tendência talude acima (para fora)
  const Nm = G * Math.cos(th) + ac * Math.sin(th);
  if (s.w === 0 && Math.abs(drive) <= mu * Nm) {
    n.w = 0;
  } else {
    const dirn = s.w !== 0 ? Math.sign(s.w) : Math.sign(drive);
    const w = s.w + (drive - mu * Nm * dirn) * dt;
    n.w = Math.sign(w) !== dirn && s.w !== 0 ? 0 : w;
  }
  n.r = s.r + n.w * Math.cos(th) * dt;
  n.phi = s.phi + (v / s.r) * dt;
  return n;
}

function initial(p: Params): Curva {
  const R = num(p, "R", 80);
  const h = num(p, "h", 14);
  const [x, y] = rampPos(0, h);
  return { phi: 0, r: R, w: 0, ph: 0, s: 0, a: 0, v: 0, x, y, vx: 0, vy: 0, aDet: NaN, tf: 0 };
}

/** Normal e atrito instantâneos (N), conforme o modo. */
function forcesNow(s: Curva, p: Params): { N: number; f: number } {
  const m = num(p, "m", 1000);
  if (modo(p) === 0) {
    const fe = forcasEstrada(num(p, "v", 20), s.r, num(p, "theta", 15));
    const mu = num(p, "mu", 0.3);
    // derrapando: atrito cinético μN contra o escorregamento (+ = talude abaixo)
    if (s.w !== 0) return { N: m * G * fe.N, f: Math.sign(s.w) * mu * m * G * fe.N };
    return { N: m * G * fe.N, f: m * G * fe.f };
  }
  const R = num(p, "Rl", 5);
  if (s.ph === 1) {
    const N = m * ((s.v * s.v) / R + G * Math.cos(s.a));
    return { N, f: num(p, "mul", 0) * Math.max(0, N) };
  }
  if (s.ph === 0) {
    const { al, Li } = rampGeom(num(p, "h", 14));
    return { N: m * G * (s.s < Li ? Math.cos(al) : 1), f: 0 };
  }
  if (s.ph === 3) return { N: m * G, f: 0 };
  return { N: 0, f: 0 };
}

// --------- Layout do palco (unidades abstratas 0..100 × 0..60) ---------
const TOP = { cx: 22, cy: 38, rad: 19 };
const SEC = { x0: 46, x1: 98, y0: 31, y1: 59 };
const MAP = { x0: 52, x1: 97, y0: 4, y1: 25 };
const SCENE = { x0: 1, x1: 60, y0: 1, y1: 59 };
const LMAP = { x0: 68, x1: 97, y0: 33, y1: 56 };

const fmt = (v: number, n = 3) => (Number.isFinite(v) ? Number(v.toPrecision(n)).toString().replace(".", ",") : "∞");

export const curvaInclinada = defineSim<Curva>({
  id: "curva-inclinada",
  title: "Curvas inclinadas e loop",
  course: "FG I",
  topic: "Dinâmica",
  priority: "P2",
  summary:
    "Estrada compensada com atrito (faixa de velocidades seguras e diagrama de forças) e loop vertical (altura mínima, normal ao longo da pista, descolamento quando N = 0), com o mapa de forças ao longo da pista.",
  equations: [
    String.raw`\text{estrada: } N\cos\theta - f\sin\theta = mg \qquad N\sin\theta + f\cos\theta = \frac{mv^2}{R}`,
    String.raw`v_{\text{ideal}} = \sqrt{gR\tan\theta} \qquad v_{\max,\min}^2 = gR\,\frac{\sin\theta \pm \mu\cos\theta}{\cos\theta \mp \mu\sin\theta}`,
    String.raw`\text{loop: } N = m\left(\frac{v^2}{R} + g\cos\varphi\right) \qquad v^2 = 2gh - 2gR(1-\cos\varphi)\ \ (\mu = 0)`,
    String.raw`N_{\text{topo}} \ge 0 \iff h \ge \tfrac52 R \qquad \frac{N(\varphi)}{mg} = \frac{2h}{R} - 2 + 3\cos\varphi`,
  ],
  liveEquations(s, p) {
    if (modo(p) === 0) {
      const R = num(p, "R", 80);
      const th = num(p, "theta", 15);
      const [lo, hi] = faixaSegura(R, th, num(p, "mu", 0.3));
      const fe = forcasEstrada(num(p, "v", 20), s.r, th);
      return [
        String.raw`v_{\text{ideal}} = \sqrt{9{,}81 \cdot ${texNum(R)} \cdot \tan ${texNum(th)}^\circ} = ${texNum(vIdeal(R, th))}\ \text{m/s}`,
        String.raw`${texNum(lo)}\ \text{m/s} \le v \le ${Number.isFinite(hi) ? texNum(hi) : String.raw`\infty`}\ \text{m/s}`,
        String.raw`N = ${texNum(fe.N)}\,mg \qquad f_{\text{nec}} = ${texNum(fe.f)}\,mg \qquad \mu N = ${texNum(num(p, "mu", 0.3) * fe.N)}\,mg`,
      ];
    }
    const R = num(p, "Rl", 5);
    const mu = num(p, "mul", 0);
    const Nn = s.ph === 1 ? (s.v * s.v) / (R * G) + Math.cos(s.a) : forcesNow(s, p).N / (num(p, "m", 1000) * G);
    return [
      String.raw`h_{\min} = ${texNum(hMin(R, mu))}\ \text{m} \quad (\tfrac52 R = ${texNum(2.5 * R)}\ \text{m sem atrito})`,
      String.raw`\varphi = ${texNum(deg(s.a))}^\circ \qquad v = ${texNum(s.v)}\ \text{m/s} \qquad N = ${texNum(Nn)}\,mg`,
    ];
  },

  params: [
    {
      key: "modo",
      label: "Situação",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 0,
      options: [
        { value: 0, label: "Estrada compensada (curva inclinada)" },
        { value: 1, label: "Loop vertical (montanha-russa)" },
      ],
    },
    { key: "m", label: "Massa", unit: "kg", min: 100, max: 3000, step: 50, default: 1000 },
    { key: "R", label: "Raio da curva", unit: "m", min: 20, max: 300, step: 5, default: 80 },
    { key: "theta", label: "Inclinação da pista", unit: "°", min: 0, max: 45, step: 0.5, default: 15 },
    { key: "mu", label: "Atrito estático (estrada)", unit: "", min: 0, max: 1, step: 0.01, default: 0.3 },
    { key: "v", label: "Velocidade do carro", unit: "m/s", min: 0, max: 60, step: 0.5, default: 20, live: true },
    { key: "Rl", label: "Raio do loop", unit: "m", min: 2, max: 10, step: 0.1, default: 5 },
    { key: "h", label: "Altura de largada", unit: "m", min: 2, max: 40, step: 0.1, default: 14 },
    { key: "mul", label: "Atrito no loop (cinético)", unit: "", min: 0, max: 0.3, step: 0.01, default: 0 },
  ],

  observables: [
    { key: "v", label: "Velocidade", unit: "m/s", value: (s, p) => (modo(p) === 0 ? num(p, "v", 20) : s.v) },
    { key: "N", label: "Força normal", unit: "N", value: (s, p) => forcesNow(s, p).N },
    { key: "Nmg", label: "Normal em pesos (N/mg)", unit: "", value: (s, p) => forcesNow(s, p).N / (num(p, "m", 1000) * G) },
    { key: "f", label: "Atrito (estrada: + talude abaixo)", unit: "N", value: (s, p) => forcesNow(s, p).f },
    { key: "ang", label: "Ângulo no loop φ", unit: "°", value: (s, p) => (modo(p) === 1 && s.ph >= 1 ? deg(s.a) : deg(s.phi)) },
    { key: "y", label: "Altura do carrinho", unit: "m", value: (s, p) => (modo(p) === 1 ? s.y : 0) },
    { key: "dr", label: "Deslocamento lateral na estrada", unit: "m", value: (s, p) => (modo(p) === 0 ? s.r - num(p, "R", 80) : 0) },
    {
      key: "E",
      label: "Energia mecânica",
      unit: "J",
      value: (s, p) => num(p, "m", 1000) * (modo(p) === 1 ? 0.5 * s.v * s.v + G * s.y : 0.5 * num(p, "v", 20) ** 2),
    },
  ],
  conserved: "E",
  chart: { x: "t", y: "Nmg" },

  scenarios: [
    {
      id: "estrada",
      label: "Estrada compensada",
      params: { modo: 0, R: 80, theta: 15, mu: 0.3, v: 20 },
      guide: `### Faixa de velocidades seguras
1. Leia no mapa de forças a velocidade ideal $v_{\\text{ideal}} = \\sqrt{gR\\tan\\theta}$: nela o atrito necessário é zero.
2. Rode e aumente $v$ ao vivo. Acima de $v_{\\text{ideal}}$ o atrito aponta **talude abaixo** (para o centro); abaixo, aponta talude acima.
3. Passe de $v_{\\max}$: o atrito necessário excede $\\mu N$ e o carro derrapa para fora.
4. Zere o atrito: a faixa se reduz a um único valor. Ainda assim um carro a $v_{\\text{ideal}}$ faz a curva.`,
      predict: [
        {
          question: "Numa curva inclinada sem atrito, um carro mais pesado deve andar, para não derrapar:",
          options: ["mais rápido", "mais devagar", "na mesma velocidade"],
          answer: 2,
          explanation: "$v_{\\text{ideal}} = \\sqrt{gR\\tan\\theta}$ não depende da massa: peso e normal crescem na mesma proporção que a força centrípeta necessária.",
        },
      ],
    },
    {
      id: "gelo",
      label: "Pista com gelo (μ pequeno)",
      params: { modo: 0, R: 60, theta: 20, mu: 0.05, v: 8 },
      guide: `### Devagar demais também derrapa
1. Com pouco atrito e $v$ baixo, o carro escorrega **para dentro** (talude abaixo).
2. Encontre na faixa verde os limites $v_{\\min}$ e $v_{\\max}$ e confira com a fórmula.
3. Rode e suba $v$ aos poucos até o carro parar de escorregar.`,
    },
    {
      id: "loop",
      label: "Loop: altura mínima",
      params: { modo: 1, Rl: 5, h: 12.5, mul: 0 },
      guide: `### Por que 2,5 R?
1. No topo, o mínimo é $N = 0$: o peso sozinho faz a força centrípeta, $v_{\\text{topo}}^2 = gR$.
2. Pela energia, $mgh = mg\\,2R + \\tfrac12 m v_{\\text{topo}}^2 \\Rightarrow h = \\tfrac52 R$.
3. Rode com $h = 2{,}5R$ e veja no mapa a normal chegar a zero exatamente no topo. Baixe $h$ um pouco: o carrinho **descola** antes do topo.
4. No ponto mais baixo, confira $N = mg(1 + 2h/R)$: com $h = 2{,}5R$ dá 6 pesos!`,
      predict: [
        {
          question: "Largando de h = 2R (a altura do topo do loop), sem atrito, o carrinho:",
          options: ["chega ao topo com velocidade zero", "descola antes de chegar ao topo", "completa o loop"],
          answer: 1,
          explanation: "Para estar no topo precisaria de $v^2 \\ge gR$, mas chegaria lá com $v = 0$. A normal zera antes: $N/mg = 2h/R - 2 + 3\\cos\\varphi = 2 + 3\\cos\\varphi$ zera em $\\varphi \\approx 132^\\circ$, e o carrinho cai em voo livre.",
        },
      ],
    },
    {
      id: "loop-atrito",
      label: "Loop com atrito",
      params: { modo: 1, Rl: 5, h: 14, mul: 0.08 },
      guide: `### O atrito cobra pedágio
1. Com atrito, a altura mínima sobe acima de $2{,}5R$ (veja a equação ao vivo).
2. O atrito é $\\mu N$: maior onde a normal é maior. Compare as setas do mapa no fundo e no topo do loop.
3. Acompanhe a energia mecânica: ela só cai, e cai mais depressa na parte de baixo.`,
    },
  ],

  exercises: [
    {
      id: "vmax",
      prompt:
        "Uma curva de raio {R} m tem inclinação de {theta}° e coeficiente de atrito estático {mu}. Qual a maior velocidade com que um carro pode fazê-la sem derrapar?",
      vary: { R: [40, 200, 0], theta: [5, 25, 0], mu: [0.1, 0.6, 2] },
      fixed: { modo: 0 },
      answer: { label: "v_max", unit: "m/s", compute: (p) => faixaSegura(num(p, "R"), num(p, "theta"), num(p, "mu"))[1] },
      hint: "Na iminência de derrapar para fora, o atrito vale μN e aponta talude abaixo.",
    },
    {
      id: "topo",
      prompt:
        "Um carrinho de {m} kg larga do repouso a {h} m de altura numa pista sem atrito e entra num loop de raio {Rl} m. Qual a força normal no topo do loop?",
      vary: { m: [200, 800, 0], h: [14, 25, 1], Rl: [3, 5, 1] },
      fixed: { modo: 1, mul: 0 },
      answer: { label: "N", unit: "N", compute: (p) => num(p, "m") * G * ((2 * num(p, "h")) / num(p, "Rl") - 5) },
      hint: "No topo: N + mg = mv²/R, com v² = 2g(h − 2R).",
    },
  ],

  init: initial,
  step: (s, p, _t, dt) => (modo(p) === 0 ? roadStep(s, p, dt) : loopStep(s, p, dt)),
  dt: 2e-3,
  sampleEvery: 10,
  tEnd: 60,
  stopWhen(s, p) {
    if (modo(p) === 0) return HALF_ROAD - Math.abs(s.r - num(p, "R", 80));
    const R = num(p, "Rl", 5);
    if (s.ph === 1) return s.v;
    if (s.ph === 2) return s.tf < 0.02 ? 1 : Math.min(s.y, R - Math.hypot(s.x, s.y - R));
    if (s.ph === 3) return 3 * R - s.x;
    return 1;
  },

  narrowSplit: () => 0.432,
  viewport: () => ({ xMin: 0, xMax: 100, yMin: 0, yMax: 60, unit: "" }),

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const { state: s, params: p, theme } = frame;
    if (modo(p) === 0) renderRoad(d, s, p, theme);
    else renderLoop(d, s, p, theme, frame.trail);
  },
});

type D = ReturnType<typeof draw>;
type Th = D["theme"];

function renderRoad(d: D, s: Curva, p: Params, theme: Th) {
  const R = num(p, "R", 80);
  const th = num(p, "theta", 15);
  const mu = num(p, "mu", 0.3);
  const v = num(p, "v", 20);
  const m = num(p, "m", 1000);
  const [lo, hi] = faixaSegura(R, th, mu);
  const vi = vIdeal(R, th);
  const fe = forcasEstrada(v, s.r, th);
  const sliding = s.w !== 0;

  // ---- vista de cima ----
  const k = TOP.rad / (R + HALF_ROAD + 2);
  d.circle(TOP.cx, TOP.cy, R * k, { stroke: theme.ground, width: (2 * HALF_ROAD * k) / d.px });
  d.circle(TOP.cx, TOP.cy, R * k, { stroke: theme.muted, dash: [6, 5], width: 1 });
  d.dot(TOP.cx, TOP.cy, 3, theme.muted);
  d.text("centro", TOP.cx, TOP.cy - 1.5, { color: theme.muted, size: 10 });
  const cx = TOP.cx + s.r * k * Math.cos(s.phi);
  const cy = TOP.cy + s.r * k * Math.sin(s.phi);
  d.box(cx, cy, 2.4, 1.3, s.phi + Math.PI / 2, { fill: sliding ? theme.negative : theme.series[1]!, stroke: theme.text, width: 1 });
  // resultante horizontal (centrípeta) e velocidade
  d.arrowPx(cx, cy, -Math.cos(s.phi), -Math.sin(s.phi), 40, { color: theme.positive });
  d.arrowPx(cx, cy, -Math.sin(s.phi), Math.cos(s.phi), 30 + v, { color: theme.accent });
  d.text("Vista de cima", TOP.cx - TOP.rad, 58.5, { align: "left", size: 12, weight: "600" });
  if (sliding)
    d.text(s.w > 0 ? "Derrapando para fora!" : "Escorregando para dentro!", TOP.cx, TOP.cy - TOP.rad - 1.2, { color: theme.negative, size: 12, weight: "700" });

  // ---- corte transversal com diagrama de forças ----
  const thr = rad(th);
  const mx = (SEC.x0 + SEC.x1) / 2;
  const my = SEC.y0 + 9;
  const half = 20;
  const ux = Math.cos(thr);
  const uy = Math.sin(thr);
  d.polyline(
    [
      [mx - half * ux, my - half * uy],
      [mx + half * ux, my + half * uy],
      [mx + half * ux, SEC.y0 - 1],
      [mx - half * ux, SEC.y0 - 1],
    ],
    { close: true, fill: theme.ground, color: theme.muted, width: 1 },
  );
  d.text("← centro da curva", SEC.x0, SEC.y0 + 1, { align: "left", color: theme.muted, size: 10 });
  const bx = mx - uy * 1.2;
  const by = my + ux * 1.2;
  d.box(bx, by, 5, 2.2, thr, { fill: sliding ? theme.negative : theme.series[1]!, stroke: theme.text, width: 1, alpha: 0.85 });
  const sc = 6; // unidades por peso
  const P0: [number, number] = [bx, by];
  d.arrow(P0[0], P0[1], 0, -sc, { color: theme.text });
  d.text("mg", P0[0] + 1.2, P0[1] - sc, { size: 11, weight: "600", align: "left" });
  const Nn = fe.N;
  d.arrow(P0[0], P0[1], -uy * Nn * sc, ux * Nn * sc, { color: theme.series[0]! });
  d.text("N", P0[0] - uy * Nn * sc - 1, P0[1] + ux * Nn * sc + 0.8, { color: theme.series[0]!, size: 11, weight: "600" });
  // atrito (+ = talude abaixo): estático igual ao necessário, ou cinético μN se derrapa
  const fShow = sliding ? Math.sign(s.w) * mu * Nn : fe.f;
  if (Math.abs(fShow) > 1e-3) {
    d.arrow(P0[0], P0[1], -ux * fShow * sc, -uy * fShow * sc, { color: theme.series[2]! });
    d.text("f", P0[0] - ux * fShow * sc - 0.8, P0[1] - uy * fShow * sc - 0.8, { color: theme.series[2]!, size: 11, weight: "600" });
  }
  const netx = -uy * Nn - ux * fShow;
  const nety = ux * Nn - uy * fShow - 1;
  d.arrow(P0[0], P0[1] + 3.2, netx * sc, nety * sc, { color: theme.positive, dash: [4, 3] });
  d.text("resultante", P0[0] + netx * sc - 1, P0[1] + 3.2 + nety * sc + 1, { color: theme.positive, size: 10, align: "right" });
  d.text(`Corte da pista (θ = ${fmt(th)}°)`, SEC.x0, SEC.y1, { align: "left", size: 12, weight: "600" });

  // ---- mapa de forças em função da velocidade ----
  const vTop = Math.max(1.4 * Math.max(v, vi, Number.isFinite(hi) ? hi : 0), 10);
  const yLo = -1.5;
  const yHi = 2.5;
  const X = (vv: number) => MAP.x0 + (vv / vTop) * (MAP.x1 - MAP.x0);
  const Y = (yy: number) => MAP.y0 + ((clamp(yy, yLo, yHi) - yLo) / (yHi - yLo)) * (MAP.y1 - MAP.y0);
  d.rect(X(lo), MAP.y0, X(Math.min(hi, vTop)) - X(lo), MAP.y1 - MAP.y0, { fill: theme.series[2]!, alpha: 0.12 });
  d.rect(MAP.x0, MAP.y0, MAP.x1 - MAP.x0, MAP.y1 - MAP.y0, { stroke: theme.grid, width: 1 });
  d.line(MAP.x0, Y(0), MAP.x1, Y(0), { color: theme.muted, width: 1 });
  const fN = (vv: number) => forcasEstrada(vv, R, th).N;
  const fF = (vv: number) => forcasEstrada(vv, R, th).f;
  const curve = (fn: (vv: number) => number): [number, number][] =>
    Array.from({ length: 121 }, (_, i) => {
      const vv = (i / 120) * vTop;
      return [X(vv), Y(fn(vv))];
    });
  d.polyline(curve(fN), { color: theme.series[0]!, width: 2 });
  d.polyline(curve(fF), { color: theme.series[2]!, width: 2 });
  d.polyline(curve((vv) => mu * fN(vv)), { color: theme.series[2]!, width: 1, dash: [4, 3] });
  d.polyline(curve((vv) => -mu * fN(vv)), { color: theme.series[2]!, width: 1, dash: [4, 3] });
  d.line(X(v), MAP.y0, X(v), MAP.y1, { color: theme.accent, width: 2 });
  for (const yy of [-1, 0, 1, 2]) d.text(`${yy}`, MAP.x0 - 0.6, Y(yy), { align: "right", size: 9, color: theme.muted });
  for (let vv = 0; vv <= vTop; vv += vTop > 60 ? 20 : 10) d.text(`${vv}`, X(vv), MAP.y0 - 1.2, { size: 9, color: theme.muted });
  d.text("v (m/s)", MAP.x1, MAP.y0 - 2.6, { align: "right", size: 10, color: theme.muted });
  d.text("Forças / mg:  N (azul)   f necessário (verde)   ±μN (tracejado)", MAP.x0, MAP.y1 + 1.4, { align: "left", size: 10 });
  d.text(`seguro: ${fmt(lo)} a ${fmt(hi)} m/s   ideal: ${fmt(vi)} m/s`, MAP.x0, MAP.y1 + 3.6, { align: "left", size: 11, weight: "600", color: theme.series[2]! });

  // ---- textos ----
  const lines = [
    `v = ${fmt(v)} m/s   v_ideal = ${fmt(vi)} m/s`,
    `N = ${fmt(m * G * fe.N)} N  (${fmt(fe.N)} mg)`,
    `f necessário = ${fmt(m * G * fe.f)} N, μN = ${fmt(mu * m * G * fe.N)} N`,
    v < lo ? "Abaixo de v_min: escorrega para dentro" : v > hi ? "Acima de v_max: derrapa para fora" : "Dentro da faixa segura",
  ];
  lines.forEach((ln, i) => d.text(ln, 2, 14 - i * 3, { align: "left", size: 11, weight: i === 3 ? "700" : "400", color: i === 3 ? (v < lo || v > hi ? theme.negative : theme.series[2]!) : theme.text }));
}

function renderLoop(d: D, s: Curva, p: Params, theme: Th, trail: Curva[]) {
  const R = num(p, "Rl", 5);
  const h = num(p, "h", 14);
  const mu = num(p, "mul", 0);
  const m = num(p, "m", 1000);
  const { xTop } = rampGeom(h);
  // janela do mundo
  const wx0 = Math.min(xTop, -R) - 1.5;
  const wx1 = 3 * R + 1;
  const wy0 = -1.5;
  const wy1 = Math.max(h, 2 * R) + 1.5;
  const k = Math.min((SCENE.x1 - SCENE.x0) / (wx1 - wx0), (SCENE.y1 - SCENE.y0 - 4) / (wy1 - wy0));
  const X = (x: number) => SCENE.x0 + (x - wx0) * k;
  const Y = (y: number) => SCENE.y0 + (y - wy0) * k;

  d.rect(X(wx0), Y(wy0), (wx1 - wx0) * k, -wy0 * k, { fill: theme.ground });
  // rampa e plano
  d.polyline(
    [
      [X(xTop), Y(h)],
      [X(-FLAT), Y(0)],
      [X(3 * R), Y(0)],
    ],
    { color: theme.text, width: 3 },
  );
  d.line(X(xTop), Y(h), X(xTop), Y(0), { color: theme.muted, dash: [3, 3], width: 1 });
  d.text(`h = ${fmt(h)} m`, X(xTop) - 0.5, Y(h / 2), { align: "right", size: 10, color: theme.muted });
  // pista do loop
  d.circle(X(0), Y(R), R * k, { stroke: theme.text, width: 3 });
  d.line(X(0) + R * k + 1, Y(2.5 * R), X(0) - R * k - 1, Y(2.5 * R), { color: theme.series[2]!, dash: [5, 4], width: 1 });
  d.text("2,5 R", X(0) + R * k + 1.2, Y(2.5 * R), { align: "left", size: 10, color: theme.series[2]! });

  // mapa de forças ao longo do loop (perfil completo para este h)
  const prof = loopProfile(h, R, mu, 360);
  const sc = 1.6; // unidades por peso
  for (let i = 0; i < prof.phi.length; i += 12) {
    const ph = prof.phi[i]!;
    const px = X(R * Math.sin(ph));
    const py = Y(R - R * Math.cos(ph));
    const Nn = prof.N[i]!;
    if (Nn > 0.02) d.arrow(px, py, -Math.sin(ph) * Nn * sc, Math.cos(ph) * Nn * sc, { color: theme.series[0]!, width: 1.5, head: 6, alpha: 0.75 });
    const fn = prof.f[i]!;
    if (fn > 0.02) d.arrow(px, py, -Math.cos(ph) * fn * sc * 2, -Math.sin(ph) * fn * sc * 2, { color: theme.series[2]!, width: 1.5, head: 6, alpha: 0.75 });
  }
  if (prof.end === "descola") {
    const ph = prof.phi[prof.phi.length - 1]!;
    d.dot(X(R * Math.sin(ph)), Y(R - R * Math.cos(ph)), 5, theme.negative);
    d.text("N = 0: descola", X(R * Math.sin(ph)) + 1, Y(R - R * Math.cos(ph)) + 1.5, { color: theme.negative, size: 11, weight: "700", align: "left" });
  }

  // trajetória e carrinho
  d.polyline(trail.map((st) => [X(st.x), Y(st.y)] as [number, number]).concat([[X(s.x), Y(s.y)]]), { color: theme.series[3]!, width: 1.5, alpha: 0.7 });
  const ang = s.ph === 1 ? s.a : Math.atan2(s.vy, s.vx);
  const nx = -Math.sin(ang);
  const ny = Math.cos(ang);
  d.box(X(s.x) + nx * 0.6, Y(s.y) + ny * 0.6, 2.2, 1.1, ang, { fill: s.ph === 2 ? theme.negative : theme.series[1]!, stroke: theme.text, width: 1 });
  const cxp = X(s.x) + nx * 0.6;
  const cyp = Y(s.y) + ny * 0.6;
  d.arrow(cxp, cyp, 0, -3, { color: theme.text, width: 1.5 });
  const Nnow = forcesNow(s, p).N / (m * G);
  if (s.ph === 1 && Nnow > 0.01) d.arrow(cxp, cyp, nx * Nnow * sc * 1.5, ny * Nnow * sc * 1.5, { color: theme.series[0]!, width: 2.5 });
  if (s.ph === 2) d.text("voo livre", cxp, cyp + 2, { color: theme.negative, size: 11, weight: "700" });

  // gráfico N/mg e f/mg ao longo do loop
  const Xg = (ph: number) => LMAP.x0 + (ph / (2 * Math.PI)) * (LMAP.x1 - LMAP.x0);
  const nMax = Math.max(6, ...prof.N);
  const Yg = (v: number) => LMAP.y0 + ((v + 1) / (nMax + 1)) * (LMAP.y1 - LMAP.y0);
  d.rect(LMAP.x0, LMAP.y0, LMAP.x1 - LMAP.x0, LMAP.y1 - LMAP.y0, { stroke: theme.grid, width: 1 });
  d.line(LMAP.x0, Yg(0), LMAP.x1, Yg(0), { color: theme.muted, width: 1 });
  d.polyline(prof.phi.map((ph, i) => [Xg(ph), Yg(prof.N[i]!)] as [number, number]), { color: theme.series[0]!, width: 2 });
  if (mu > 0) d.polyline(prof.phi.map((ph, i) => [Xg(ph), Yg(prof.f[i]!)] as [number, number]), { color: theme.series[2]!, width: 2 });
  if (s.ph === 1) d.line(Xg(s.a), LMAP.y0, Xg(s.a), LMAP.y1, { color: theme.accent, width: 1.5 });
  for (const [lab, ph] of [["0", 0], ["90°", Math.PI / 2], ["180°", Math.PI], ["270°", 1.5 * Math.PI], ["360°", 2 * Math.PI]] as const)
    d.text(lab, Xg(ph), LMAP.y0 - 1.2, { size: 9, color: theme.muted });
  d.text("0", LMAP.x0 - 0.6, Yg(0), { align: "right", size: 9, color: theme.muted });
  d.text(fmt(nMax, 2), LMAP.x0 - 0.6, LMAP.y1, { align: "right", size: 9, color: theme.muted });
  d.text("N/mg (azul) e f/mg (verde) ao longo do loop", LMAP.x0, LMAP.y1 + 1.6, { align: "left", size: 10 });

  const hm = hMin(R, mu);
  const lines = [
    `h mínima = ${fmt(hm)} m${mu === 0 ? " (2,5 R)" : ""}`,
    `N no ponto mais baixo = ${fmt(prof.N[0]!)} mg`,
    prof.end === "descola"
      ? `Descola em φ = ${fmt(deg(prof.phi[prof.phi.length - 1]!))}°`
      : prof.end === "para"
        ? "Para antes de subir: volta"
        : `Completa o loop; N no topo = ${fmt(prof.N[Math.floor(prof.N.length / 2)]!)} mg`,
    `v = ${fmt(s.v)} m/s`,
  ];
  lines.forEach((ln, i) => d.text(ln, 68, 26 - i * 3, { align: "left", size: 11, weight: i === 2 ? "700" : "400", color: i === 2 && prof.end !== "volta" ? theme.negative : theme.text }));
}

export default curvaInclinada;
