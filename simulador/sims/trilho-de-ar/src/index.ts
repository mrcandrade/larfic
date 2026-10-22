import { defineSim, draw, num, rad, texNum, type Params } from "@fisilab/core";

/** Comprimento útil do trilho (m), posição máxima do centro do carrinho e mínima. */
export const TRACK = 1.6;
export const X_END = 1.48;
export const X_MIN = 0.1;
/** Comprimento de cada carrinho, incluindo o para-choque (m). */
export const LC = 0.16;
/** Rigidez do para-choque de molas (N/m). */
export const K_MOLA = 600;
const G = 9.79;

export interface Pass {
  gate: 1 | 2;
  cart: 0 | 1;
  /** Instantes em que a bandeira começa e termina de bloquear o feixe. */
  t0: number;
  t1: number;
  /** Velocidade do carrinho quando o centro da bandeira cruza o feixe (valor verdadeiro). */
  v: number;
  /** Instante em que o centro da bandeira cruza o feixe. */
  tc: number;
}

export interface Collision {
  pre: [number, number];
  post: [number, number];
  t: number;
}

/** Resultados pré-calculados do lançamento: o que as fotoportas vão registrar. */
export interface Registro {
  passes: Pass[];
  collision: Collision | null;
  tEnd: number;
}

export interface Trilho {
  x: [number, number];
  v: [number, number];
  stuck: boolean;
  contact: boolean;
  pre: [number, number] | null;
  post: [number, number] | null;
  tc: number;
  rec: Registro | null;
}

export const modo = (p: Params) => Math.round(num(p, "modo"));
const masses = (p: Params): [number, number] => [num(p, "M1", 0.2), num(p, "M2", 0.2)];
export const flag = (p: Params) => num(p, "Lb", 0.05);

/** Posições efetivas das fotoportas (no modo colisão, a 2ª fica pelo menos 0,3 m depois da 1ª). */
export function gates(p: Params): [number, number] {
  const g1 = num(p, "xg1", 0.5);
  let g2 = Math.max(num(p, "xg2", 1.0), g1 + 0.05);
  if (modo(p) > 0) g2 = Math.max(g2, g1 + 0.3);
  return [g1, Math.min(g2, X_END - 0.05)];
}

/** Aceleração teórica do carrinho no modo 2ª lei, sem atrito viscoso. */
export function aIdeal(p: Params): number {
  const M = num(p, "M1", 0.2), mp = modo(p) === 0 ? num(p, "mp", 0.01) : 0;
  return (mp * G + M * G * Math.sin(rad(num(p, "theta")))) / (M + mp);
}

function accelerations(x: [number, number], v: [number, number], p: Params, stuck: boolean): [number, number] {
  const [M1, M2] = masses(p);
  const b = num(p, "b"), s = G * Math.sin(rad(num(p, "theta")));
  if (modo(p) === 0) {
    const mp = num(p, "mp", 0.01);
    return [(mp * G + M1 * s - b * v[0]) / (M1 + mp), 0];
  }
  if (stuck) {
    const a = ((M1 + M2) * s - b * (v[0] + v[1])) / (M1 + M2);
    return [a, a];
  }
  let F = 0;
  const gap = x[1] - x[0] - LC;
  if (modo(p) === 1 && gap < 0) F = -K_MOLA * gap;
  return [s - (b * v[0] + F) / M1, s - (b * v[1] - F) / M2];
}

function rk4Sub(x: [number, number], v: [number, number], p: Params, stuck: boolean, h: number) {
  const f = (xx: [number, number], vv: [number, number]) => accelerations(xx, vv, p, stuck);
  const add = (a: [number, number], b: [number, number], k: number): [number, number] => [a[0] + b[0] * k, a[1] + b[1] * k];
  const a1 = f(x, v);
  const x2 = add(x, v, h / 2), v2 = add(v, a1, h / 2);
  const a2 = f(x2, v2);
  const x3 = add(x, v2, h / 2), v3 = add(v, a2, h / 2);
  const a3 = f(x3, v3);
  const x4 = add(x, v3, h), v4 = add(v, a3, h);
  const a4 = f(x4, v4);
  return {
    x: [x[0] + (h / 6) * (v[0] + 2 * v2[0] + 2 * v3[0] + v4[0]), x[1] + (h / 6) * (v[1] + 2 * v2[1] + 2 * v3[1] + v4[1])] as [number, number],
    v: [v[0] + (h / 6) * (a1[0] + 2 * a2[0] + 2 * a3[0] + a4[0]), v[1] + (h / 6) * (a1[1] + 2 * a2[1] + 2 * a3[1] + a4[1])] as [number, number],
  };
}

/** Avança a física um passo dt (sem o registro pré-calculado). */
export function physStep(s: Trilho, p: Params, t: number, dt: number): Trilho {
  const n = 4, h = dt / n;
  let { x, v, stuck, contact, pre, post, tc } = s;
  const [M1, M2] = masses(p);
  const m = modo(p);
  for (let i = 0; i < n; i++) {
    const before = { x, v };
    ({ x, v } = rk4Sub(x, v, p, stuck, h));
    if (m > 0) {
      const gap = x[1] - x[0] - LC;
      if (m === 2 && !stuck && gap <= 0) {
        // Velcro: gruda e conserva o momento.
        pre = [before.v[0], before.v[1]];
        const vc = (M1 * v[0] + M2 * v[1]) / (M1 + M2);
        x = [x[0] + gap / 2, x[1] - gap / 2];
        v = [vc, vc];
        stuck = true;
        post = [vc, vc];
        tc = t + (i + 1) * h;
      } else if (m === 1) {
        if (!contact && gap < 0 && !pre) {
          contact = true;
          pre = [before.v[0], before.v[1]];
          tc = t + (i + 1) * h;
        } else if (contact && gap >= 0) {
          contact = false;
          post = [v[0], v[1]];
        }
      }
    }
    // Para-choques das extremidades do trilho
    for (const k of [0, 1] as const) {
      if (x[k] > X_END && v[k] > 0) {
        x = k === 0 ? [X_END, x[1]] : [x[0], X_END];
        v = k === 0 ? [0, v[1]] : [v[0], 0];
        if (stuck) v = [0, 0];
      }
      if (x[k] < X_MIN && v[k] < 0) {
        x = k === 0 ? [X_MIN, x[1]] : [x[0], X_MIN];
        v = k === 0 ? [0, v[1]] : [v[0], 0];
        if (stuck) v = [0, 0];
      }
    }
  }
  return { ...s, x, v, stuck, contact, pre, post, tc };
}

function initial(p: Params): Trilho {
  const [g1, g2] = gates(p);
  const v0 = num(p, "v0");
  const x2 = modo(p) === 0 ? 10 : (g1 + g2) / 2;
  return { x: [X_MIN + 0.02, x2], v: [v0, 0], stuck: false, contact: false, pre: null, post: null, tc: 0, rec: null };
}

/** Simula o lançamento inteiro e registra o que as fotoportas e o choque produzem. */
export function precompute(p: Params, dt = 2e-4): Registro {
  let s = initial(p);
  const [g1, g2] = gates(p);
  const gp = [g1, g2];
  const L = flag(p);
  const passes: Pass[] = [];
  const open: (Partial<Pass> | null)[][] = [[null, null], [null, null]];
  const cartsN = modo(p) === 0 ? 1 : 2;
  let t = 0;
  let still = 0;
  while (t < 30) {
    const n = physStep(s, p, t, dt);
    const tn = t + dt;
    for (let c = 0; c < cartsN; c++) {
      for (let gi = 0; gi < 2; gi++) {
        const xg = gp[gi]!;
        const d0 = s.x[c]! - xg, d1 = n.x[c]! - xg;
        const in0 = Math.abs(d0) < L / 2, in1 = Math.abs(d1) < L / 2;
        const edge = (target: number) => {
          // instante (interpolado) em que d cruza target
          const f = (target - d0) / (d1 - d0);
          return t + dt * Math.min(1, Math.max(0, f));
        };
        if (!in0 && in1) {
          open[c]![gi] = { gate: (gi + 1) as 1 | 2, cart: c as 0 | 1, t0: edge(d1 > 0 ? L / 2 : -L / 2) };
        }
        const o = open[c]![gi];
        if (o && Math.sign(d0) !== Math.sign(d1) && d0 !== d1) {
          o.tc = edge(0);
          const f = (0 - d0) / (d1 - d0);
          o.v = s.v[c]! + (n.v[c]! - s.v[c]!) * f;
        }
        if (in0 && !in1 && o) {
          o.t1 = edge(d0 > 0 ? L / 2 : -L / 2);
          if (o.tc !== undefined) passes.push(o as Pass);
          open[c]![gi] = null;
        }
      }
    }
    s = n;
    t = tn;
    const moving = Math.abs(s.v[0]) > 1e-4 || (cartsN === 2 && Math.abs(s.v[1]) > 1e-4);
    still = moving ? 0 : still + dt;
    if (still > 0.2) break;
  }
  passes.sort((a, b) => a.t0 - b.t0);
  const collision = s.pre ? { pre: s.pre, post: s.post ?? s.v, t: s.tc } : null;
  return { passes, collision, tEnd: Math.max(0.5, t) };
}

const rec = (s: Trilho, p: Params) => s.rec ?? precompute(p);
const nthPass = (r: Registro, gate: 1 | 2, k: number) => r.passes.filter((x) => x.gate === gate)[k];
const dur = (q: Pass | undefined) => (q ? q.t1 - q.t0 : 0);

function momentum(v: [number, number], p: Params) {
  const [M1, M2] = masses(p);
  return modo(p) === 0 ? M1 * v[0] : M1 * v[0] + M2 * v[1];
}
function kinetic(v: [number, number], p: Params) {
  const [M1, M2] = masses(p);
  return 0.5 * M1 * v[0] ** 2 + (modo(p) === 0 ? 0 : 0.5 * M2 * v[1] ** 2);
}

const fmt = (v: number, dec: number) => v.toFixed(dec).replace(".", ",");

export const trilhoDeAr = defineSim<Trilho>({
  id: "trilho-de-ar",
  title: "Trilho de ar: 2ª lei e colisões",
  course: "Exp I",
  topic: "Dinâmica",
  priority: "P1",
  summary:
    "Carrinhos flutuam num trilho de ar quase sem atrito. Puxe um carrinho com uma massa pendurada e meça velocidades e aceleração com duas fotoportas, ou provoque colisões elásticas (molas) e inelásticas (velcro) e compare o momento antes e depois.",
  equations: [
    String.raw`v \approx \frac{L}{\Delta t_{\text{bloq}}} \qquad a = \frac{v_2^2 - v_1^2}{2\,\Delta x} = \frac{v_2 - v_1}{t_{12}}`,
    String.raw`(M + m_p)\,a = m_p g + M g\sin\theta - b\,v`,
    String.raw`M_1 v_1 + M_2 v_2 = M_1 v_1' + M_2 v_2' \qquad \text{elástica: } K' = K`,
  ],
  liveEquations(s, p) {
    const r = rec(s, p);
    if (modo(p) === 0) {
      const q1 = nthPass(r, 1, 0), q2 = nthPass(r, 2, 0);
      const L = flag(p);
      const v1 = q1 ? L / dur(q1) : 0, v2 = q2 ? L / dur(q2) : 0;
      const t12 = q1 && q2 ? q2.t0 - q1.t0 : 0;
      return [
        String.raw`v_1 = ${texNum(v1, 4)}\ \text{m/s} \quad v_2 = ${texNum(v2, 4)}\ \text{m/s} \quad t_{12} = ${texNum(t12, 4)}\ \text{s}`,
        String.raw`a_{\text{teórica}} = \frac{m_p g + M g\sin\theta}{M + m_p} = ${texNum(aIdeal(p), 4)}\ \text{m/s}^2`,
      ];
    }
    const c = r.collision;
    if (!c) return [String.raw`\text{sem colisão}`];
    return [
      String.raw`p = ${texNum(momentum(c.pre, p), 4)}\ \text{kg·m/s} \;\to\; p' = ${texNum(momentum(c.post, p), 4)}\ \text{kg·m/s}`,
      String.raw`K = ${texNum(kinetic(c.pre, p), 4)}\ \text{J} \;\to\; K' = ${texNum(kinetic(c.post, p), 4)}\ \text{J}`,
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
        { value: 0, label: "2ª lei: carrinho puxado por massa" },
        { value: 1, label: "Colisão elástica (molas)" },
        { value: 2, label: "Colisão inelástica (velcro)" },
      ],
    },
    { key: "M1", label: "Massa do carrinho 1", unit: "kg", min: 0.1, max: 0.6, step: 0.005, default: 0.2 },
    { key: "mp", label: "Massa pendurada", unit: "kg", min: 0, max: 0.05, step: 0.001, default: 0.01 },
    { key: "theta", label: "Inclinação do trilho", unit: "°", min: 0, max: 10, step: 0.1, default: 0 },
    { key: "v0", label: "Velocidade inicial do carrinho 1", unit: "m/s", min: 0, max: 1, step: 0.01, default: 0 },
    { key: "M2", label: "Massa do carrinho 2", unit: "kg", min: 0.1, max: 0.6, step: 0.005, default: 0.2 },
    { key: "b", label: "Atrito viscoso residual b", unit: "kg/s", min: 0, max: 0.05, step: 0.001, default: 0 },
    { key: "xg1", label: "Posição da fotoporta 1", unit: "m", min: 0.25, max: 1.2, step: 0.01, default: 0.5 },
    { key: "xg2", label: "Posição da fotoporta 2", unit: "m", min: 0.35, max: 1.4, step: 0.01, default: 1.0 },
    { key: "Lb", label: "Largura da bandeira", unit: "m", min: 0.01, max: 0.1, step: 0.001, default: 0.05 },
  ],

  observables: [
    { key: "x1", label: "Posição do carrinho 1", unit: "m", value: (s) => s.x[0] },
    { key: "v1", label: "Velocidade do carrinho 1", unit: "m/s", value: (s) => s.v[0] },
    { key: "x2", label: "Posição do carrinho 2", unit: "m", value: (s, p) => (modo(p) === 0 ? 0 : s.x[1]) },
    { key: "v2", label: "Velocidade do carrinho 2", unit: "m/s", value: (s, p) => (modo(p) === 0 ? 0 : s.v[1]) },
    { key: "p", label: "Momento total", unit: "kg·m/s", value: (s, p) => momentum(s.v, p) },
    { key: "K", label: "Energia cinética dos carrinhos", unit: "J", value: (s, p) => kinetic(s.v, p) },
    { key: "tb1", label: "Bloqueio na fotoporta 1 (1ª passagem)", unit: "s", value: (s, p) => dur(nthPass(rec(s, p), 1, 0)) },
    { key: "tb2", label: "Bloqueio na fotoporta 2 (1ª passagem)", unit: "s", value: (s, p) => dur(nthPass(rec(s, p), 2, 0)) },
    { key: "tb1b", label: "Bloqueio na fotoporta 1 (2ª passagem)", unit: "s", value: (s, p) => dur(nthPass(rec(s, p), 1, 1)) },
    { key: "tb2b", label: "Bloqueio na fotoporta 2 (2ª passagem)", unit: "s", value: (s, p) => dur(nthPass(rec(s, p), 2, 1)) },
    {
      key: "t12",
      label: "Intervalo entre as fotoportas",
      unit: "s",
      value: (s, p) => {
        const r = rec(s, p), a = nthPass(r, 1, 0), b = nthPass(r, 2, 0);
        return a && b ? b.t0 - a.t0 : 0;
      },
    },
    { key: "vg1", label: "Velocidade verdadeira na fotoporta 1", unit: "m/s", value: (s, p) => nthPass(rec(s, p), 1, 0)?.v ?? 0 },
    { key: "vg2", label: "Velocidade verdadeira na fotoporta 2", unit: "m/s", value: (s, p) => nthPass(rec(s, p), 2, 0)?.v ?? 0 },
    { key: "dx", label: "Distância entre as fotoportas", unit: "m", value: (_s, p) => gates(p)[1] - gates(p)[0] },
    { key: "a", label: "Aceleração teórica (sem atrito viscoso)", unit: "m/s²", value: (_s, p) => aIdeal(p) },
    { key: "F", label: "Peso da massa pendurada", unit: "N", value: (_s, p) => (modo(p) === 0 ? num(p, "mp", 0.01) * G : 0) },
    { key: "Mtot", label: "Massa acelerada (carrinho + pendurada)", unit: "kg", value: (_s, p) => num(p, "M1", 0.2) + (modo(p) === 0 ? num(p, "mp", 0.01) : 0) },
    { key: "v1i", label: "v₁ antes do choque", unit: "m/s", value: (s, p) => rec(s, p).collision?.pre[0] ?? 0 },
    { key: "v1f", label: "v₁ depois do choque", unit: "m/s", value: (s, p) => rec(s, p).collision?.post[0] ?? 0 },
    { key: "v2f", label: "v₂ depois do choque", unit: "m/s", value: (s, p) => rec(s, p).collision?.post[1] ?? 0 },
    { key: "pi", label: "Momento antes do choque", unit: "kg·m/s", value: (s, p) => { const c = rec(s, p).collision; return c ? momentum(c.pre, p) : 0; } },
    { key: "pf", label: "Momento depois do choque", unit: "kg·m/s", value: (s, p) => { const c = rec(s, p).collision; return c ? momentum(c.post, p) : 0; } },
    { key: "Ki", label: "Energia cinética antes do choque", unit: "J", value: (s, p) => { const c = rec(s, p).collision; return c ? kinetic(c.pre, p) : 0; } },
    { key: "Kf", label: "Energia cinética depois do choque", unit: "J", value: (s, p) => { const c = rec(s, p).collision; return c ? kinetic(c.post, p) : 0; } },
  ],
  chart: { x: "t", y: "v1" },

  scenarios: [
    {
      id: "segunda-lei",
      label: "2ª lei de Newton",
      params: { modo: 0, M1: 0.2, mp: 0.01, theta: 0, v0: 0, b: 0, xg1: 0.5, xg2: 1.0, Lb: 0.05 },
      guide: `### Aceleração e força resultante
A bandeira de largura $L$ bloqueia o feixe de cada fotoporta por um tempo $\\Delta t$; a velocidade média nesse trecho é $L/\\Delta t$.
1. Rode e anote $\\Delta t_1$, $\\Delta t_2$ e o intervalo $t_{12}$ entre as fotoportas.
2. Calcule $a = (v_2 - v_1)/t_{12}$ e também $a = (v_2^2 - v_1^2)/(2\\Delta x)$.
3. Varie a massa pendurada (5 a 30 g) mantendo **a massa total constante** (passe massa do carrinho para o gancho) e faça o gráfico de $a$ contra $m_p g$: a inclinação é $1/(M + m_p)$.
4. Cuidado: $L/\\Delta t$ é a velocidade no **instante médio** do bloqueio, e $t_{12}$ é medido entre os inícios dos bloqueios. Corrija o intervalo para $t_{12} + (\\Delta t_2 - \\Delta t_1)/2$ e compare.
5. Uma bandeira mais larga dá $\\Delta t$ com menor incerteza relativa, mas mede a velocidade média num trecho maior. Qual o compromisso?`,
      predict: [
        {
          question: "Dobrando a massa pendurada (de 10 g para 20 g) com o carrinho de 200 g, a aceleração:",
          options: ["dobra exatamente", "quase dobra (um pouco menos)", "fica igual", "quadruplica"],
          answer: 1,
          explanation: "$a = m_p g/(M + m_p)$: o numerador dobra, mas a massa acelerada também cresce um pouco (de 210 g para 220 g).",
        },
      ],
    },
    {
      id: "inclinado",
      label: "Trilho inclinado com atrito residual",
      params: { modo: 0, M1: 0.2, mp: 0, theta: 2, v0: 0, b: 0.02, xg1: 0.4, xg2: 1.2, Lb: 0.05 },
      guide: `### Medindo g com o trilho inclinado
Sem massa pendurada, $a = g\\sin\\theta$.
1. Meça $a$ com as duas fotoportas e calcule $g = a/\\sin\\theta$.
2. Há um atrito viscoso residual $b$: compare o resultado com $b = 0$. O erro é sistemático ou aleatório?
3. Como você detectaria o atrito residual com o trilho horizontal e um empurrão inicial?`,
    },
    {
      id: "elastica",
      label: "Colisão elástica",
      params: { modo: 1, M1: 0.2, M2: 0.2, v0: 0.5, theta: 0, b: 0, xg1: 0.45, xg2: 1.1, Lb: 0.05 },
      guide: `### Choque com molas
O carrinho 1 passa pela fotoporta 1, bate no carrinho 2 em repouso e o carrinho 2 passa pela fotoporta 2.
1. Com massas iguais, o que acontece com o carrinho 1 depois do choque?
2. Meça $v_1 = L/\\Delta t_1$ e $v_2' = L/\\Delta t_2$ e verifique $M_1 v_1 = M_1 v_1' + M_2 v_2'$ dentro da incerteza.
3. Faça $M_2 = 2M_1$: o carrinho 1 volta e passa de novo pela fotoporta 1 (2ª passagem). Compare $K$ antes e depois.`,
      predict: [
        {
          question: "Num choque elástico frontal de dois carrinhos iguais, com o segundo em repouso, depois do choque:",
          options: ["os dois seguem juntos com v/2", "o primeiro para e o segundo sai com v", "o primeiro volta com v", "os dois param"],
          answer: 1,
          explanation: "Conservando momento e energia com massas iguais, as velocidades são trocadas.",
        },
      ],
    },
    {
      id: "inelastica",
      label: "Colisão inelástica",
      params: { modo: 2, M1: 0.2, M2: 0.3, v0: 0.5, theta: 0, b: 0, xg1: 0.45, xg2: 1.1, Lb: 0.05 },
      guide: `### Choque com velcro
1. Meça a velocidade antes (fotoporta 1) e a do conjunto depois (fotoporta 2).
2. Verifique a conservação do momento e calcule a fração de energia perdida, $1 - K'/K = M_2/(M_1 + M_2)$.
3. A fração perdida depende da velocidade inicial?`,
    },
  ],

  exercises: [
    {
      id: "aceleracao",
      prompt:
        "Um carrinho de {M1} kg num trilho de ar horizontal é puxado por uma massa pendurada de {mp} kg por um fio e uma polia leve (g = 9,79 m/s²). Qual é a aceleração?",
      vary: { M1: [0.15, 0.5, 3], mp: [0.005, 0.05, 3] },
      fixed: { modo: 0, theta: 0, b: 0 },
      answer: { label: "a", unit: "m/s²", compute: (p) => (num(p, "mp") * G) / (num(p, "M1") + num(p, "mp")) },
    },
    {
      id: "fotoporta",
      prompt:
        "Um carrinho a {v0} m/s, com uma bandeira de {Lb} m de largura, passa por uma fotoporta. Por quanto tempo o feixe fica bloqueado?",
      vary: { Lb: [0.01, 0.1, 3], v0: [0.1, 1, 2] },
      fixed: { modo: 1 },
      answer: { label: "Δt", unit: "s", compute: (p) => num(p, "Lb") / num(p, "v0") },
      hint: "Δt = L/v.",
    },
    {
      id: "inelastica",
      prompt:
        "Um carrinho de {M1} kg a {v0} m/s gruda num carrinho de {M2} kg em repouso. Que fração da energia cinética é perdida (em %)?",
      vary: { M1: [0.1, 0.6, 2], M2: [0.1, 0.6, 2], v0: [0.2, 1, 2] },
      fixed: { modo: 2, b: 0, theta: 0 },
      answer: { label: "perda", unit: "%", compute: (p) => (100 * num(p, "M2")) / (num(p, "M1") + num(p, "M2")) },
    },
  ],

  init: (p) => ({ ...initial(p), rec: precompute(p) }),
  step: (s, p, t, dt) => physStep(s, p, t, dt),
  dt: 1e-3,
  sampleEvery: 10,
  maxSamples: 6000,
  tEnd: 30,
  stopWhen: (s, _p, t) => (s.rec ? s.rec.tEnd - t : 1),

  viewport: () => ({ xMin: -0.12, xMax: 1.9, yMin: -1.02, yMax: 0.92 }),

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const { state: s, params: p, theme, t } = frame;
    const th = rad(num(p, "theta"));
    const base = 0.0;
    const P = (u: number, h = 0): [number, number] => [u * Math.cos(th) - h * Math.sin(th), base + (TRACK - u) * Math.sin(th) + h * Math.cos(th)];
    const m = modo(p);
    const [g1, g2] = gates(p);
    const r = rec(s, p);
    const L = flag(p);

    // Mesa
    d.rect(-0.1, -0.06, 1.85, 0.03, { fill: theme.ground, stroke: theme.muted, width: 1 });
    // Trilho (perfil)
    const rail: [number, number][] = [P(0, -0.035), P(TRACK, -0.035), P(TRACK, 0), P(0, 0)];
    d.polyline(rail, { close: true, fill: theme.dark ? "#3b4553" : "#c9d2dd", color: theme.text, width: 1 });
    for (let u = 0.05; u < TRACK; u += 0.05) d.dot(...P(u, -0.017), 1.3, theme.muted);
    // Pés e calço
    d.line(...P(0.05, -0.035), P(0.05, -0.035)[0], -0.03, { color: theme.text, width: 2 });
    d.line(...P(TRACK - 0.05, -0.035), P(TRACK - 0.05, -0.035)[0], -0.03, { color: theme.text, width: 2 });

    // Régua ao longo do trilho
    for (let cm = 0; cm <= TRACK * 100; cm += 1) {
      const big = cm % 10 === 0, mid = cm % 5 === 0;
      const [ax, ay] = P(cm / 100, -0.035);
      const [bx, by] = P(cm / 100, -0.035 - (big ? 0.03 : mid ? 0.02 : 0.01));
      d.line(ax, ay, bx, by, { color: theme.text, width: big ? 1 : 0.5, alpha: 0.8 });
      if (big) d.text(`${cm}`, ...P(cm / 100, -0.085), { size: 9, color: theme.muted });
    }
    d.text("cm", ...P(TRACK + 0.04, -0.085), { size: 9, color: theme.muted });

    // Fotoportas
    [g1, g2].forEach((xg, i) => {
      const [x0, y0] = P(xg, 0.0);
      const [x1, y1] = P(xg, 0.22);
      const blocked = [0, 1].some((c) => (m > 0 || c === 0) && Math.abs(s.x[c as 0 | 1] - xg) < L / 2);
      d.line(...P(xg - 0.012, 0), ...P(xg - 0.012, 0.22), { color: theme.text, width: 3 });
      d.line(...P(xg + 0.012, 0), ...P(xg + 0.012, 0.22), { color: theme.text, width: 3, alpha: 0.4 });
      d.line(x0, y0, x1, y1, { color: blocked ? theme.muted : theme.positive, width: 1, dash: blocked ? [3, 3] : [] });
      d.text(`F${i + 1}`, ...P(xg, 0.26), { size: 11, weight: "600" });
    });

    // Carrinhos
    const cart = (u: number, color: string, label: string, side: 1 | -1 | 0) => {
      const w = LC - 0.02;
      const pts: [number, number][] = [P(u - w / 2, 0.003), P(u + w / 2, 0.003), P(u + w / 2 - 0.02, 0.05), P(u - w / 2 + 0.02, 0.05)];
      d.polyline(pts, { close: true, fill: color, color: theme.text, width: 1 });
      // bandeira
      d.polyline([P(u - L / 2, 0.05), P(u + L / 2, 0.05), P(u + L / 2, 0.12), P(u - L / 2, 0.12)], { close: true, fill: theme.text, color: theme.text, width: 1, alpha: 0.85 });
      d.text(label, ...P(u, 0.027), { size: 10, color: "#ffffff", weight: "700" });
      if (side !== 0) {
        const bump = P(u + side * (LC / 2 - 0.005), 0.025);
        if (m === 1) d.spring(...P(u + side * (w / 2), 0.025), ...bump, { color: theme.text, width: 1, coils: 3, amplitudePx: 3 });
        if (m === 2) d.dot(bump[0], bump[1], 3.5, theme.series[5]!);
      }
    };
    cart(s.x[0], theme.series[0]!, "1", m > 0 ? 1 : 0);
    if (m > 0) cart(s.x[1], theme.series[1]!, "2", -1);
    for (const c of m > 0 ? [0, 1] : [0]) {
      const v = s.v[c as 0 | 1];
      if (Math.abs(v) > 0.01) d.arrowPx(...P(s.x[c as 0 | 1], 0.17), Math.sign(v) * Math.cos(th), -Math.sign(v) * Math.sin(th), 10 + 60 * Math.abs(v), { color: theme.accent });
    }

    // Polia e massa pendurada
    if (m === 0) {
      const [px, py] = P(TRACK + 0.04, 0.03);
      d.circle(px, py, 0.03, { fill: theme.dark ? "#2b3441" : "#e3e8ef", stroke: theme.text, width: 1.5 });
      const [cx, cy] = P(s.x[0] + LC / 2 - 0.01, 0.03);
      d.line(cx, cy, px, py + 0.03, { color: theme.text, width: 1 });
      const drop = Math.min(0.85, 0.15 + (s.x[0] - X_MIN - 0.02));
      const mx = px + 0.03, my = py - drop;
      d.line(mx, py, mx, my, { color: theme.text, width: 1 });
      const mp = num(p, "mp", 0.01);
      if (mp > 0) {
        d.rect(mx - 0.025, my - 0.06, 0.05, 0.06, { fill: theme.series[2]!, stroke: theme.text, width: 1 });
        d.text(`${fmt(mp * 1000, 0)} g`, mx + 0.035, my - 0.03, { size: 10, align: "left" });
      }
    }

    // Painel dos cronômetros
    const lcd = "#7cf29a";
    const bx = 0.0, by = 0.9, bw = 1.1, lh = 0.085;
    const lines: string[] = [];
    const shown = (q: Pass | undefined) => (q && t >= q.t1 ? fmt(q.t1 - q.t0, 4) : "0,0000");
    lines.push(`F1  Δt = ${shown(nthPass(r, 1, 0))} s` + (m > 0 ? `   2ª: ${shown(nthPass(r, 1, 1))} s` : ""));
    lines.push(`F2  Δt = ${shown(nthPass(r, 2, 0))} s` + (m > 0 ? `   2ª: ${shown(nthPass(r, 2, 1))} s` : ""));
    const q1 = nthPass(r, 1, 0), q2 = nthPass(r, 2, 0);
    if (m === 0) lines.push(`F1→F2  t₁₂ = ${q1 && q2 && t >= q2.t0 ? fmt(q2.t0 - q1.t0, 4) : "0,0000"} s`);
    d.rect(bx, by - lh * (lines.length + 0.3), bw, lh * (lines.length + 0.3), { fill: theme.dark ? "#0f1a12" : "#1d2a20", stroke: theme.text, width: 1 });
    lines.forEach((ln, i) => d.text(ln, bx + 0.03, by - lh * (i + 0.65), { color: lcd, size: 12, align: "left", weight: "600" }));
    d.text(`bandeira L = ${fmt(L * 1000, 0)} mm`, 1.15, by - 0.05, { size: 11, align: "left", color: theme.muted });
    if (m === 0) d.text(`a teórica = ${fmt(aIdeal(p), 3)} m/s²`, 1.15, by - 0.14, { size: 11, align: "left", color: theme.muted });
    else if (r.collision) {
      const c = r.collision;
      d.text(`p = ${fmt(momentum(c.pre, p), 4)} → ${t >= c.t ? fmt(momentum(c.post, p), 4) : "?"} kg·m/s`, 1.15, by - 0.14, { size: 11, align: "left", color: theme.muted });
    }
  },
});

export default trilhoDeAr;
