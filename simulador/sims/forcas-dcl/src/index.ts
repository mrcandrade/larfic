import { defineSim, draw, num, rad, texNum, type Draw, type Params, type Theme } from "@fisilab/core";
import {
  G,
  KIND_COLOR,
  KIND_NAME,
  checkDCL,
  expected,
  mag,
  situationOf,
  sum,
  type CheckResult,
  type Force,
  type Kind,
} from "./physics.ts";

export * from "./physics.ts";

export interface Body {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface DCLState {
  /** Forças desenhadas pelo aluno. */
  forces: Force[];
  /** Força sendo arrastada (−1: nenhuma). */
  sel: number;
  /** Última força tocada (para remover). */
  focus: number;
  /** Resultado da última verificação (null quando o DCL mudou desde então). */
  check: CheckResult | null;
  /** Mostra o DCL correto por cima. */
  answer: boolean;
  /** Deslocamento e velocidade do corpo real (forças corretas). */
  real: Body;
  /** Deslocamento e velocidade do corpo movido pelo DCL do aluno. */
  ghost: Body;
  realStopped: boolean;
  ghostOut: boolean;
}

// Layout do palco (unidades do palco, não metros)
export const C = { x: 16.3, y: 7.2 }; // centro do DCL
export const R = 4.3; // raio útil do painel do DCL
const SCENE = { x0: 0.3, x1: 10.8, y0: 2.9, y1: 11.8 };
const FEED = { x0: 0.3, x1: 21.7, y0: 0.1, y1: 2.6 };
const REAL_LIMIT = 4.2;
const GHOST_LIMIT = 4.5;

const SITUATIONS = ["Bloco na mesa puxado por corda", "Bloco pendurado por dois fios", "Caixa num elevador", "Bloco numa rampa"];

/** Escala do DCL: newtons por unidade do palco. Depende só dos parâmetros. */
export function forceScale(p: Params): number {
  const e = expected(p);
  const fmax = Math.max(num(p, "m", 2) * G, ...e.forces.map(mag), num(p, "F", 0));
  return (fmax * 1.15) / R;
}

const emptyBody = (): Body => ({ x: 0, y: 0, vx: 0, vy: 0 });

export function initState(): DCLState {
  return { forces: [], sel: -1, focus: -1, check: null, answer: false, real: emptyBody(), ghost: emptyBody(), realStopped: false, ghostOut: false };
}

/** Converte um ponto do palco na força correspondente (arredondada: 0,5 N e 1°). */
export function pointToForce(kind: Kind, p: Params, pt: { x: number; y: number }): Force {
  const s = forceScale(p);
  const dx = pt.x - C.x, dy = pt.y - C.y;
  let F = Math.min(Math.hypot(dx, dy), R * 1.05) * s;
  F = Math.round(F * 2) / 2;
  const ang = Math.round((Math.atan2(dy, dx) * 180) / Math.PI);
  const a = rad(ang);
  const clean = (v: number) => (Math.abs(v) < 1e-9 ? 0 : v);
  return { kind, fx: clean(F * Math.cos(a)), fy: clean(F * Math.sin(a)) };
}

function tipOf(f: Force, s: number): [number, number] {
  return [C.x + f.fx / s, C.y + f.fy / s];
}

function pickTip(st: DCLState, p: Params, pt: { x: number; y: number }): number {
  const s = forceScale(p);
  let best = -1, bd = 0.6;
  st.forces.forEach((f, i) => {
    const [x, y] = tipOf(f, s);
    const dd = Math.hypot(pt.x - x, pt.y - y);
    if (dd < bd) {
      bd = dd;
      best = i;
    }
  });
  return best;
}

function addForce(st: DCLState, p: Params, kind: Kind): DCLState {
  const s = forceScale(p);
  const n = st.forces.length;
  const ang = rad(25 + 50 * n);
  const L = 0.45 * R * s;
  const f = pointToForce(kind, p, { x: C.x + (L / s) * Math.cos(ang), y: C.y + (L / s) * Math.sin(ang) });
  return { ...st, forces: [...st.forces, f], focus: n, check: null };
}

/** Avança corpo com aceleração constante durante dt (exato). */
function advance(b: Body, ax: number, ay: number, dt: number): Body {
  return { x: b.x + b.vx * dt + 0.5 * ax * dt * dt, y: b.y + b.vy * dt + 0.5 * ay * dt * dt, vx: b.vx + ax * dt, vy: b.vy + ay * dt };
}

export const studentAccel = (st: DCLState, p: Params): [number, number] => {
  const [sx, sy] = sum(st.forces);
  const m = num(p, "m", 2);
  return [sx / m, sy / m];
};

const fmt = (v: number, d = 1) => (Math.abs(v) < 0.05 ? "0" : String(Number(v.toFixed(d))).replace(".", ","));

/** Quebra o texto em linhas de até `max` caracteres. */
function wrap(text: string, max: number): string[] {
  const words = text.split(" ");
  const out: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > max && cur) {
      out.push(cur);
      cur = w;
    } else cur = (cur + " " + w).trim();
  }
  if (cur) out.push(cur);
  return out;
}

// ---------- Desenho da cena ----------

interface SceneBody {
  cx: number;
  cy: number;
  w: number;
  h: number;
  ang: number;
}

function drawScene(d: Draw, theme: Theme, p: Params, st: DCLState): SceneBody {
  const sit = situationOf(p);
  const th = rad(num(p, "ang", 30));
  const muted = theme.muted;
  if (sit === 1) {
    const th2 = rad(num(p, "ang2", 50));
    const top = 11.4;
    d.support(SCENE.x0 + 0.2, top, SCENE.x1 - 0.2, top, { color: muted });
    const bx = 5.5, by = 6.6;
    const ax = bx, ay = by + 0.6;
    const reach = (dirx: number, diry: number, wallX: number) => {
      const tTop = (top - ay) / diry;
      const tWall = (wallX - ax) / dirx;
      const t = Math.min(tTop, tWall > 0 ? tWall : Infinity);
      return [ax + dirx * t, ay + diry * t] as const;
    };
    const L = reach(-Math.cos(th), Math.sin(th), SCENE.x0 + 0.3);
    const Rr = reach(Math.cos(th2), Math.sin(th2), SCENE.x1 - 0.3);
    d.line(ax, ay, L[0], L[1], { color: theme.text, width: 1.6 });
    d.line(ax, ay, Rr[0], Rr[1], { color: theme.text, width: 1.6 });
    if (L[1] < top - 0.05) d.support(SCENE.x0 + 0.3, L[1] - 0.6, SCENE.x0 + 0.3, L[1] + 0.6, { color: muted });
    if (Rr[1] < top - 0.05) d.support(SCENE.x1 - 0.3, Rr[1] + 0.6, SCENE.x1 - 0.3, Rr[1] - 0.6, { color: muted });
    d.line(ax - 1.6, ay, ax + 1.6, ay, { color: muted, width: 1, dash: [3, 3] });
    d.text(`θ₁ = ${fmt(num(p, "ang", 30), 0)}°`, ax - 1.5, ay + 0.35, { color: muted, size: 11, align: "right" });
    d.text(`θ₂ = ${fmt(num(p, "ang2", 50), 0)}°`, ax + 1.5, ay + 0.35, { color: muted, size: 11, align: "left" });
    d.text("fio 1", (ax + L[0]) / 2, (ay + L[1]) / 2, { color: muted, size: 11, dx: -14, dy: -6 });
    d.text("fio 2", (ax + Rr[0]) / 2, (ay + Rr[1]) / 2, { color: muted, size: 11, dx: 14, dy: -6 });
    return { cx: bx + st.real.x, cy: by + st.real.y, w: 1.6, h: 1.2, ang: 0 };
  }
  if (sit === 2) {
    const ae = num(p, "ae", 2);
    d.line(2.6, SCENE.y0 + 0.3, 2.6, SCENE.y1, { color: muted, width: 1 });
    d.line(8.4, SCENE.y0 + 0.3, 8.4, SCENE.y1, { color: muted, width: 1 });
    d.rect(3.0, 4.6, 5.0, 5.2, { stroke: theme.text, width: 2 });
    d.line(5.5, 9.8, 5.5, SCENE.y1, { color: theme.text, width: 1.5 });
    d.rect(3.0, 4.4, 5.0, 0.2, { fill: theme.ground });
    if (Math.abs(ae) > 1e-6) {
      d.arrowPx(9.4, 7.2, 0, Math.sign(ae), Math.min(90, 18 * Math.abs(ae)), { color: theme.accent, width: 2.5 });
      d.text("a", 9.4, 7.2, { color: theme.accent, size: 13, weight: "700", dx: 12 });
    }
    d.text(`a = ${fmt(ae)} m/s² ${ae > 0 ? "(sobe)" : ae < 0 ? "(desce)" : ""}`, 5.5, 10.6, { color: theme.accent, size: 12, align: "left", dx: 8 });
    d.text("referencial da cabine", 5.5, 4.0, { color: muted, size: 10 });
    return { cx: 5.5, cy: 5.2, w: 1.6, h: 1.2, ang: 0 };
  }
  if (sit === 3) {
    const b0x = 1.0, b0y = 3.6, Lr = 7.2;
    const tx = b0x + Lr * Math.cos(th), ty = b0y + Lr * Math.sin(th);
    d.polyline(
      [
        [b0x, b0y],
        [tx, ty],
        [tx, b0y],
      ],
      { color: theme.text, width: 1.5, close: true, fill: theme.ground },
    );
    const arc: [number, number][] = [];
    for (let i = 0; i <= 20; i++) arc.push([b0x + 1.1 * Math.cos((th * i) / 20), b0y + 1.1 * Math.sin((th * i) / 20)]);
    d.polyline(arc, { color: muted, width: 1 });
    d.text(`θ = ${fmt(num(p, "ang", 30), 0)}°`, b0x + 1.4, b0y + 0.25, { color: muted, size: 11, align: "left" });
    const s0 = 5.0, off = 0.62;
    const cx = b0x + s0 * Math.cos(th) - off * Math.sin(th);
    const cy = b0y + s0 * Math.sin(th) + off * Math.cos(th);
    return { cx: cx + st.real.x, cy: cy + st.real.y, w: 1.6, h: 1.2, ang: th };
  }
  // Mesa
  const F = num(p, "F", 12);
  d.rect(SCENE.x0 + 0.2, 4.6, SCENE.x1 - SCENE.x0 - 0.4, 0.3, { fill: theme.ground, stroke: muted, width: 1 });
  d.line(1.0, 4.6, 1.0, SCENE.y0 + 0.4, { color: muted, width: 3 });
  d.line(SCENE.x1 - 0.7, 4.6, SCENE.x1 - 0.7, SCENE.y0 + 0.4, { color: muted, width: 3 });
  d.text(`μ = ${fmt(num(p, "mu", 0.3), 2)}`, 1.4, 4.3, { color: muted, size: 11, align: "left" });
  const body = { cx: 2.6 + st.real.x, cy: 5.5 + st.real.y, w: 1.8, h: 1.2, ang: 0 };
  if (F > 0.05) {
    const rx = body.cx + 0.9, ry = body.cy;
    const ex = rx + 2.6 * Math.cos(th), ey = ry + 2.6 * Math.sin(th);
    d.line(rx, ry, ex, ey, { color: theme.text, width: 1.6 });
    d.circle(ex, ey, 0.18, { fill: theme.series[1]!, minPx: 5 });
    d.text(`F = ${fmt(F)} N, θ = ${fmt(num(p, "ang", 30), 0)}°`, ex, ey, { color: muted, size: 11, dy: -14 });
  }
  return body;
}

function drawBody(d: Draw, b: SceneBody, theme: Theme, ghost: boolean) {
  if (ghost) d.box(b.cx, b.cy, b.w, b.h, b.ang, { stroke: theme.negative, width: 1.5, dash: [5, 4] });
  else d.box(b.cx, b.cy, b.w, b.h, b.ang, { fill: theme.series[5]!, stroke: theme.text, width: 1.2, alpha: 0.9 });
}

const niceStep = (x: number) => {
  const p = 10 ** Math.floor(Math.log10(x));
  const m = x / p;
  return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p;
};

export const forcasDcl = defineSim<DCLState>({
  id: "forcas-dcl",
  title: "Forças e diagrama de corpo livre",
  course: "FG I",
  topic: "Leis de Newton",
  priority: "P1",
  summary:
    "Monte o diagrama de corpo livre de quatro situações clássicas arrastando as setas das forças, peça a verificação e depois veja o corpo se mover sob o seu DCL ao lado do movimento real, pela segunda lei de Newton.",
  equations: [
    String.raw`\sum \vec F = m\,\vec a`,
    String.raw`P = mg \qquad f_c = \mu N \qquad f_e \le \mu N`,
    String.raw`\text{mesa: } N = mg - F\sin\theta \qquad \text{rampa: } N = mg\cos\theta`,
    String.raw`\text{dois fios: } T_1\cos\theta_1 = T_2\cos\theta_2 \qquad T_1\sin\theta_1 + T_2\sin\theta_2 = mg`,
    String.raw`\text{elevador: } N - mg = m a`,
  ],
  liveEquations(st, p) {
    const m = num(p, "m", 2);
    const [sx, sy] = sum(st.forces);
    const e = expected(p);
    return [
      String.raw`\sum\vec F_{\text{seu DCL}} = (${texNum(sx)};\ ${texNum(sy)})\ \text{N} \qquad m\vec a = (${texNum(m * e.a[0])};\ ${texNum(m * e.a[1])})\ \text{N}`,
    ];
  },

  params: [
    {
      key: "situacao",
      label: "Situação",
      unit: "",
      min: 0,
      max: 3,
      step: 1,
      default: 0,
      options: SITUATIONS.map((label, value) => ({ value, label })),
    },
    { key: "m", label: "Massa", unit: "kg", min: 0.5, max: 10, step: 0.1, default: 2, live: true },
    { key: "ang", label: "Ângulo θ (corda, fio 1 ou rampa)", unit: "°", min: 10, max: 60, step: 1, default: 30, live: true },
    { key: "ang2", label: "Ângulo θ₂ do fio 2 (dois fios)", unit: "°", min: 10, max: 80, step: 1, default: 50, live: true },
    { key: "F", label: "Força na corda (mesa)", unit: "N", min: 0, max: 40, step: 0.5, default: 12, live: true },
    { key: "mu", label: "Coeficiente de atrito μ (mesa e rampa)", unit: "", min: 0, max: 0.9, step: 0.01, default: 0.3, live: true },
    { key: "ae", label: "Aceleração do elevador (para cima +)", unit: "m/s²", min: -5, max: 5, step: 0.1, default: 2, live: true },
  ],

  observables: [
    { key: "Sx", label: "ΣFx do seu DCL", unit: "N", value: (st) => sum(st.forces)[0] },
    { key: "Sy", label: "ΣFy do seu DCL", unit: "N", value: (st) => sum(st.forces)[1] },
    { key: "max", label: "m·aₓ real", unit: "N", value: (_st, p) => num(p, "m", 2) * expected(p).a[0] },
    { key: "may", label: "m·a_y real", unit: "N", value: (_st, p) => num(p, "m", 2) * expected(p).a[1] },
    { key: "nforcas", label: "Forças no seu DCL", unit: "", value: (st) => st.forces.length },
    { key: "acertos", label: "Acertos na última verificação", unit: "", value: (st) => st.check?.matched ?? 0 },
    { key: "areal", label: "Aceleração real |a|", unit: "m/s²", value: (_st, p) => Math.hypot(...expected(p).a) },
    { key: "aaluno", label: "Aceleração pelo seu DCL |a|", unit: "m/s²", value: (st, p) => Math.hypot(...studentAccel(st, p)) },
    { key: "desvio", label: "Distância entre seu corpo e o real", unit: "m", value: (st) => Math.hypot(st.ghost.x - st.real.x, st.ghost.y - st.real.y) },
  ],
  chart: { x: "t", y: "desvio" },

  scenarios: [
    {
      id: "mesa",
      label: "Mesa e corda inclinada",
      params: { situacao: 0, m: 2, F: 12, ang: 30, mu: 0.3 },
      guide: `### Bloco puxado por corda inclinada
1. Use os botões **+ Peso**, **+ Normal** etc. para pôr forças no diagrama e arraste a **ponta** de cada seta até a direção e o módulo certos (os círculos marcam os newtons).
2. Clique em **Verificar DCL** e leia o retorno embaixo do palco.
3. Com o DCL certo, rode a simulação: o bloco tracejado anda com o seu DCL e o cheio com as forças reais.
4. Aumente $F$ até a normal se anular: $F\\sin\\theta = mg$.`,
      predict: [
        {
          question: "Com a corda puxando inclinada para cima, a normal da mesa sobre o bloco é:",
          options: ["igual a mg", "menor que mg", "maior que mg"],
          answer: 1,
          explanation:
            "Na vertical não há aceleração: $N + F\\sin\\theta - mg = 0$, logo $N = mg - F\\sin\\theta < mg$. A corda sustenta parte do peso.",
        },
      ],
    },
    {
      id: "fios",
      label: "Pendurado por dois fios",
      params: { situacao: 1, m: 3, ang: 30, ang2: 60 },
      guide: `### Equilíbrio com dois fios
1. Ponha o peso e uma tração para cada fio, ao longo dos fios.
2. As componentes horizontais das trações se cancelam e as verticais somam $mg$.
3. Verifique e depois mude os ângulos. O que acontece com as trações quando os dois fios ficam quase horizontais?`,
      predict: [
        {
          question: "Fio 1 a 30° e fio 2 a 60° da horizontal. Qual fio está mais tracionado?",
          options: ["O fio 1 (30°)", "O fio 2 (60°)", "Os dois igualmente"],
          answer: 1,
          explanation:
            "$T_1 = mg\\cos\\theta_2/\\sin(\\theta_1+\\theta_2) = 0{,}5\\,mg$ e $T_2 = mg\\cos\\theta_1/\\sin(\\theta_1+\\theta_2) \\approx 0{,}87\\,mg$. O fio mais próximo da vertical sustenta mais.",
        },
      ],
    },
    {
      id: "elevador",
      label: "Caixa no elevador",
      params: { situacao: 2, m: 5, ae: 2 },
      guide: `### Peso aparente
1. Só duas forças atuam na caixa: peso e normal do piso.
2. Com o elevador acelerando para cima, $N - mg = ma$. Monte o DCL e verifique.
3. Rode: o desenho está no referencial da cabine. Se o seu DCL estiver errado, a caixa "flutua" ou "afunda" no piso.
4. Ponha $a < 0$ (descendo cada vez mais rápido ou subindo e freando): a normal fica menor que o peso. Quanto valeria $N$ em queda livre, com $a = -g$?`,
      predict: [
        {
          question: "O elevador sobe acelerando. A normal sobre a caixa é:",
          options: ["menor que o peso", "igual ao peso", "maior que o peso"],
          answer: 2,
          explanation: "A resultante tem de apontar para cima: $N = m(g + a) > mg$. Uma balança no piso marcaria mais.",
        },
      ],
    },
    {
      id: "rampa",
      label: "Bloco na rampa",
      params: { situacao: 3, m: 2, ang: 35, mu: 0.3 },
      guide: `### Rampa com atrito
1. A normal é perpendicular à rampa e o atrito é paralelo a ela, para cima (o bloco tende a descer).
2. Calcule $N = mg\\cos\\theta$ e $f = \\mu N$ e ajuste as setas.
3. Verifique, rode e compare o bloco tracejado (seu DCL) com o real.
4. Diminua $\\theta$ até $\\tan\\theta < \\mu$: o bloco fica parado e o atrito passa a valer $mg\\sin\\theta$.`,
    },
  ],

  exercises: [
    {
      id: "normal-mesa",
      prompt:
        "Um bloco de {m} kg está sobre uma mesa e é puxado por uma corda com força de {F} N, inclinada {ang}° acima da horizontal. Qual é a força normal da mesa sobre o bloco (g = 9,81 m/s²)?",
      vary: { m: [2, 8, 1], F: [5, 15, 1], ang: [15, 60, 0] },
      fixed: { situacao: 0 },
      answer: { label: "N", unit: "N", compute: (p) => num(p, "m") * G - num(p, "F") * Math.sin(rad(num(p, "ang"))) },
      hint: "Na vertical a aceleração é nula: N + F sen θ = mg.",
    },
    {
      id: "tracao-fios",
      prompt:
        "Um corpo de {m} kg está pendurado por dois fios que fazem {ang}° e {ang2}° com a horizontal. Qual é a tração no fio de {ang}° (g = 9,81 m/s²)?",
      vary: { m: [1, 10, 1], ang: [20, 60, 0], ang2: [20, 70, 0] },
      fixed: { situacao: 1 },
      answer: {
        label: "T₁",
        unit: "N",
        compute: (p) => (num(p, "m") * G * Math.cos(rad(num(p, "ang2")))) / Math.sin(rad(num(p, "ang") + num(p, "ang2"))),
      },
      hint: "Escreva ΣFx = 0 e ΣFy = 0 com as duas trações e resolva o sistema.",
    },
  ],

  init: () => initState(),
  step(st, p, _t, dt) {
    const e = expected(p);
    let real = st.real, realStopped = st.realStopped;
    if (!realStopped) {
      real = advance(real, e.a[0], e.a[1], dt);
      if (!e.cabinFrame && Math.hypot(real.x, real.y) > REAL_LIMIT) {
        realStopped = true;
        real = { ...real, vx: 0, vy: 0 };
      }
    }
    let ghost: Body, ghostOut = st.ghostOut;
    if (ghostOut) {
      // fora da cena: acompanha o corpo real para manter a separação fixa
      ghost = { x: real.x + (st.ghost.x - st.real.x), y: real.y + (st.ghost.y - st.real.y), vx: real.vx, vy: real.vy };
    } else {
      const [ax, ay] = studentAccel(st, p);
      ghost = advance(st.ghost, ax, ay, dt);
      if (Math.hypot(ghost.x - real.x, ghost.y - real.y) > GHOST_LIMIT) ghostOut = true;
    }
    return { ...st, real, ghost, realStopped, ghostOut };
  },
  dt: 0.01,
  sampleEvery: 5,

  pointer: {
    down(st, p, pt) {
      const i = pickTip(st, p, pt);
      if (i < 0) return undefined;
      return { ...st, sel: i, focus: i };
    },
    move(st, p, pt, dragging) {
      if (!dragging || st.sel < 0) return undefined;
      const forces = st.forces.slice();
      forces[st.sel] = pointToForce(forces[st.sel]!.kind, p, pt);
      return { ...st, forces, check: null };
    },
    up: (st) => (st.sel >= 0 ? { ...st, sel: -1 } : undefined),
    cursor: (st, p, pt) => (pickTip(st, p, pt) >= 0 ? "grab" : undefined),
  },

  actions: [
    ...(["P", "N", "T", "f", "F"] as Kind[]).map((k) => ({
      id: `add-${k}`,
      label: `+ ${KIND_NAME[k]}`,
      run: (st: DCLState, p: Params) => addForce(st, p, k),
    })),
    {
      id: "remover",
      label: "Remover força selecionada",
      run: (st) => {
        if (!st.forces.length) return st;
        const i = st.focus >= 0 && st.focus < st.forces.length ? st.focus : st.forces.length - 1;
        return { ...st, forces: st.forces.filter((_, j) => j !== i), focus: -1, sel: -1, check: null };
      },
    },
    { id: "limpar", label: "Limpar DCL", run: (st) => ({ ...st, forces: [], focus: -1, sel: -1, check: null }) },
    { id: "verificar", label: "Verificar DCL", run: (st, p) => ({ ...st, check: checkDCL(st.forces, expected(p).forces) }) },
    { id: "resposta", label: "Mostrar DCL correto", run: (st) => ({ ...st, answer: !st.answer }), active: (st) => st.answer },
    {
      id: "reposicionar",
      label: "Reposicionar corpos",
      run: (st) => ({ ...st, real: emptyBody(), ghost: emptyBody(), realStopped: false, ghostOut: false }),
    },
  ],

  viewport: () => ({ xMin: 0, xMax: 22, yMin: 0, yMax: 12 }),

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const { state: st, params: p, theme } = frame;
    const sit = situationOf(p);
    const e = expected(p);
    const s = forceScale(p);

    // ----- Cena -----
    d.rect(SCENE.x0, SCENE.y0, SCENE.x1 - SCENE.x0, SCENE.y1 - SCENE.y0, { stroke: theme.grid, width: 1 });
    d.text(SITUATIONS[sit] ?? "", SCENE.x0 + 0.2, SCENE.y1 - 0.3, { align: "left", size: 13, weight: "700" });
    d.text(`m = ${fmt(num(p, "m", 2))} kg  ·  ${e.note}`, SCENE.x0 + 0.2, SCENE.y1 - 0.85, { align: "left", size: 11, color: theme.muted });
    const body = drawScene(d, theme, p, st);
    drawBody(d, body, theme, false);
    if (st.forces.length) {
      const rel = { x: st.ghost.x - st.real.x, y: st.ghost.y - st.real.y };
      const g = { ...body, cx: body.cx + rel.x, cy: body.cy + rel.y };
      const inside = g.cx > SCENE.x0 + 0.8 && g.cx < SCENE.x1 - 0.8 && g.cy > SCENE.y0 + 0.7 && g.cy < SCENE.y1 - 0.7;
      if (inside) drawBody(d, g, theme, true);
      else {
        const cx = Math.min(SCENE.x1 - 0.9, Math.max(SCENE.x0 + 0.9, g.cx));
        const cy = Math.min(SCENE.y1 - 1.4, Math.max(SCENE.y0 + 0.5, g.cy));
        d.text("seu DCL tirou o corpo da cena", cx, cy, { color: theme.negative, size: 11, weight: "600", align: cx > 5 ? "right" : "left" });
      }
      d.text("cheio: forças reais   tracejado: seu DCL", SCENE.x1 - 0.2, SCENE.y0 + 0.3, { align: "right", size: 10, color: theme.muted });
    }

    // ----- Painel do DCL -----
    d.text("Diagrama de corpo livre", C.x, 11.75, { size: 13, weight: "700" });
    const stepN = niceStep((R * s) / 4);
    for (let k = 1; k * stepN <= R * s * 1.001; k++) {
      const rr = (k * stepN) / s;
      d.circle(C.x, C.y, rr, { stroke: theme.grid, width: 1 });
      d.text(`${fmt(k * stepN)} N`, C.x + rr * Math.cos(rad(-60)), C.y + rr * Math.sin(rad(-60)), { size: 9, color: theme.muted });
    }
    d.line(C.x - R, C.y, C.x + R, C.y, { color: theme.grid, width: 1 });
    d.line(C.x, C.y - R, C.x, C.y + R, { color: theme.grid, width: 1 });
    if (sit === 3) {
      const th = rad(num(p, "ang", 30));
      d.line(C.x - R * Math.cos(th), C.y - R * Math.sin(th), C.x + R * Math.cos(th), C.y + R * Math.sin(th), { color: theme.muted, width: 1, dash: [4, 4], alpha: 0.6 });
      d.text("rampa", C.x + R * Math.cos(th), C.y + R * Math.sin(th), { size: 10, color: theme.muted, dx: 4, dy: -8 });
    }
    d.box(C.x, C.y, 0.7, 0.5, sit === 3 ? rad(num(p, "ang", 30)) : 0, { fill: theme.series[5]!, stroke: theme.text, width: 1 });

    if (st.answer) {
      for (const f of e.forces) {
        d.arrow(C.x, C.y, f.fx / s, f.fy / s, { color: theme.series[KIND_COLOR[f.kind]]!, width: 8, alpha: 0.25, head: 16 });
        const [tx, ty] = tipOf(f, s);
        d.text(`${KIND_NAME[f.kind]} ${fmt(mag(f))} N`, tx, ty, { size: 10, color: theme.muted, dy: 14 });
      }
    }

    st.forces.forEach((f, i) => {
      const color = theme.series[KIND_COLOR[f.kind]]!;
      d.arrow(C.x, C.y, f.fx / s, f.fy / s, { color, width: i === st.focus ? 3.5 : 2.5, head: 12 });
      const [tx, ty] = tipOf(f, s);
      d.circle(tx, ty, 0, { minPx: 7, stroke: color, width: 1.5 });
      const st8 = st.check?.status[i];
      if (st8) d.dot(tx, ty, 4, st8 === "ok" ? theme.series[2]! : theme.negative);
      const ang = (Math.atan2(f.fy, f.fx) * 180) / Math.PI;
      const ux = mag(f) > 0 ? f.fx / mag(f) : 1, uy = mag(f) > 0 ? f.fy / mag(f) : 0;
      d.text(`${KIND_NAME[f.kind]} ${fmt(mag(f))} N, ${fmt(ang, 0)}°`, tx, ty, {
        size: 11,
        weight: "600",
        color,
        align: ux >= 0 ? "left" : "right",
        dx: ux >= 0 ? 10 : -10,
        dy: uy > 0.3 ? -8 : uy < -0.3 ? 10 : 0,
      });
    });
    if (!st.forces.length) d.text("Use os botões + Peso, + Normal... e arraste as pontas das setas.", C.x, C.y - R - 0.15, { size: 11, color: theme.muted });
    const [sx, sy] = sum(st.forces);
    if (st.forces.length && Math.hypot(sx, sy) > 0.05) {
      d.arrow(C.x, C.y, sx / s, sy / s, { color: theme.text, width: 1.5, dash: [5, 4], head: 9 });
      const [rx, ry] = [C.x + sx / s, C.y + sy / s];
      d.text("ΣF", rx, ry, { size: 11, color: theme.text, weight: "700", dx: 10, dy: -8 });
    }

    // ----- Retorno da verificação -----
    d.rect(FEED.x0, FEED.y0, FEED.x1 - FEED.x0, FEED.y1 - FEED.y0, { stroke: theme.grid, width: 1 });
    const size = 11;
    const maxChars = Math.max(40, Math.floor(((FEED.x1 - FEED.x0 - 0.4) * frame.scale) / (size * 0.55)));
    const lineH = 15 * d.px;
    const maxLines = Math.max(1, Math.floor((FEED.y1 - FEED.y0 - 0.25) / lineH));
    let rows: { text: string; color: string; weight: string }[] = [];
    if (st.check) {
      st.check.lines.forEach((l, i) => {
        const color = l.good ? theme.series[2]! : i === 0 ? theme.text : theme.negative;
        const mark = i === 0 ? (st.check!.ok ? "✓ " : "") : "✗ ";
        for (const w of wrap(mark + l.text, maxChars)) rows.push({ text: w, color, weight: i === 0 ? "700" : "400" });
      });
    } else {
      rows.push({ text: "Monte o DCL e clique em Verificar DCL.", color: theme.muted, weight: "600" });
      rows.push({
        text: `Seta de cada força: arraste a ponta. Os círculos marcam ${fmt(stepN)} N. Tolerância: 10° na direção e 15% no módulo.`,
        color: theme.muted,
        weight: "400",
      });
    }
    if (rows.length > maxLines) rows = [...rows.slice(0, maxLines - 1), { text: "…", color: theme.muted, weight: "400" }];
    rows.forEach((r, i) => d.text(r.text, FEED.x0 + 0.2, FEED.y1 - 0.25 - i * lineH, { align: "left", size, color: r.color, weight: r.weight }));
  },
});

export default forcasDcl;
