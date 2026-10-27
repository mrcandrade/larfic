import { clamp, defineSim, draw, num, texNum, type Params } from "@fisilab/core";

const G = 9.81;
/** Distância máxima do eixo à origem do palco (mantém o corpo dentro da tela). */
const PIVOT_MAX = 0.6;
/** Polia de desvio do fio (modo massa pendurada), fixa no palco. */
const PULLEY = { x: 1.95, y: -0.3, r: 0.07 };
const FLOOR = -1.55;
const BOX_H = 0.12;

/**
 * Estado: ângulo e velocidade angular do corpo, posição do eixo no referencial
 * do corpo (relativa ao CM, eixos do próprio corpo) e posição do eixo no palco.
 */
export interface RotState {
  th: number;
  w: number;
  ax: number;
  ay: number;
  px: number;
  py: number;
}

export const BODY_NAMES = ["Disco", "Anel", "Barra", "Placa retangular"];

const body = (p: Params) => Math.round(num(p, "corpo"));

/** Momento de inércia em relação a um eixo perpendicular pelo centro de massa. */
export function inertiaCm(p: Params): number {
  const M = num(p, "M", 2), R = num(p, "R", 0.4), L = num(p, "L", 0.8), b = num(p, "b", 0.5);
  switch (body(p)) {
    case 1:
      return M * R * R;
    case 2:
      return (M * L * L) / 12;
    case 3:
      return (M * (L * L + b * b)) / 12;
    default:
      return (M * R * R) / 2;
  }
}

/** Teorema dos eixos paralelos: I = I_cm + M d². */
export function inertia(p: Params, s: Pick<RotState, "ax" | "ay">): number {
  return inertiaCm(p) + num(p, "M", 2) * (s.ax * s.ax + s.ay * s.ay);
}

/** Restringe um ponto (no referencial do corpo) à região ocupada pelo corpo. */
export function clampToBody(p: Params, x: number, y: number): [number, number] {
  const R = num(p, "R", 0.4), L = num(p, "L", 0.8), b = num(p, "b", 0.5);
  const k = body(p);
  if (k === 2) return [clamp(x, -L / 2, L / 2), 0];
  if (k === 3) return [clamp(x, -L / 2, L / 2), clamp(y, -b / 2, b / 2)];
  const r = Math.hypot(x, y);
  return r > R ? [(x * R) / r, (y * R) / r] : [x, y];
}

function insideBody(p: Params, x: number, y: number, tol: number): boolean {
  const R = num(p, "R", 0.4), L = num(p, "L", 0.8), b = num(p, "b", 0.5);
  const k = body(p);
  if (k === 2) return Math.abs(x) <= L / 2 + tol && Math.abs(y) <= 0.03 + tol;
  if (k === 3) return Math.abs(x) <= L / 2 + tol && Math.abs(y) <= b / 2 + tol;
  return Math.hypot(x, y) <= R + tol;
}

export interface Dyn {
  I: number;
  /** Inércia efetiva (inclui m r² da massa pendurada). */
  Ieff: number;
  /** Torque motor (F r ou T r para α = 0); o torque real do fio é T r. */
  tauDrive: number;
  alpha: number;
  /** Tração no fio (modo massa) ou força F. */
  T: number;
}

/** Aceleração angular com atrito seco no eixo (torque constante oposto a ω). */
export function dynamics(s: RotState, p: Params): Dyn {
  const I = inertia(p, s);
  const hang = Math.round(num(p, "modo")) === 1;
  const r = num(p, "r", 0.06), m = num(p, "m", 0.2), ta = num(p, "tau_a");
  const Ieff = hang ? I + m * r * r : I;
  const tauDrive = hang ? m * G * r : num(p, "F", 2) * r;
  let alpha: number;
  if (Math.abs(s.w) > 1e-9) alpha = (tauDrive - ta * Math.sign(s.w)) / Ieff;
  else if (Math.abs(tauDrive) > ta) alpha = (tauDrive - ta * Math.sign(tauDrive)) / Ieff;
  else alpha = 0;
  const T = hang ? m * (G - alpha * r) : num(p, "F", 2);
  return { I, Ieff, tauDrive, alpha, T };
}

/** Posição do CM no palco. */
function cmWorld(s: RotState): [number, number] {
  const c = Math.cos(s.th), sn = Math.sin(s.th);
  return [s.px - (c * s.ax - sn * s.ay), s.py - (sn * s.ax + c * s.ay)];
}

/** Ponto de tangência do fio no carretel, puxando no sentido anti-horário, para um fio que vai até Q. */
function tangentPoint(px: number, py: number, r: number, qx: number, qy: number): [number, number] {
  const D = Math.hypot(qx - px, qy - py);
  const beta = Math.atan2(qy - py, qx - px);
  const gam = Math.acos(Math.min(1, r / Math.max(D, r)));
  for (const a of [beta - gam, beta + gam]) {
    const tx = px + r * Math.cos(a), ty = py + r * Math.sin(a);
    if ((tx - px) * (qy - ty) - (ty - py) * (qx - tx) > 0) return [tx, ty];
  }
  return [px, py - r];
}

/** Ponto do palco → referencial do corpo (relativo ao CM). */
function toBody(s: RotState, x: number, y: number): [number, number] {
  const [cx, cy] = cmWorld(s);
  const c = Math.cos(s.th), sn = Math.sin(s.th);
  const dx = x - cx, dy = y - cy;
  return [c * dx + sn * dy, -sn * dx + c * dy];
}

function moveAxis(s: RotState, p: Params, x: number, y: number, strict: boolean): RotState | undefined {
  let [bx, by] = toBody(s, x, y);
  if (strict && !insideBody(p, bx, by, 0.06)) return undefined;
  [bx, by] = clampToBody(p, bx, by);
  const [cx, cy] = cmWorld(s);
  const c = Math.cos(s.th), sn = Math.sin(s.th);
  let px = cx + c * bx - sn * by;
  let py = cy + sn * bx + c * by;
  const dist = Math.hypot(px, py);
  if (dist > PIVOT_MAX) {
    // Fora da área permitida: mantém o eixo onde está.
    if (strict) return undefined;
    px = s.px;
    py = s.py;
    [bx, by] = [s.ax, s.ay];
  }
  // Para o corpo ao trocar de eixo; o ângulo acumulado (e o fio enrolado) se mantém.
  return { ...s, ax: bx, ay: by, px, py, w: 0 };
}

const fallen = (s: RotState, p: Params) => s.th * num(p, "r", 0.06);

export const rotacaoTorque = defineSim<RotState>({
  id: "rotacao-torque",
  title: "Torque e momento de inércia",
  course: "FG I",
  topic: "Rotação",
  priority: "P1",
  summary:
    "Disco, anel, barra ou placa girando em torno de um eixo que você arrasta pelo corpo: veja I = I_cm + Md² mudar e como o mesmo torque produz acelerações angulares diferentes.",
  equations: [
    String.raw`\tau = I\alpha \qquad \tau = rF\sin\varphi`,
    String.raw`I = I_{cm} + M d^2`,
    String.raw`I_{cm}:\ \text{disco } \tfrac12 MR^2,\ \text{anel } MR^2,\ \text{barra } \tfrac1{12}ML^2,\ \text{placa } \tfrac1{12}M(L^2+b^2)`,
    String.raw`\text{massa pendurada: } \alpha = \frac{mgr}{I + mr^2} \qquad T = m(g - \alpha r)`,
    String.raw`\omega = \omega_0 + \alpha t \qquad \theta = \omega_0 t + \tfrac12 \alpha t^2`,
  ],
  liveEquations(s, p) {
    const d = dynamics(s, p);
    const M = num(p, "M", 2), dd = Math.hypot(s.ax, s.ay);
    return [
      String.raw`I = ${texNum(inertiaCm(p))} + ${texNum(M)}\cdot(${texNum(dd)})^2 = ${texNum(d.I)}\ \text{kg·m}^2`,
      String.raw`\alpha = \frac{\tau}{I_{ef}} = ${texNum(d.alpha)}\ \text{rad/s}^2 \qquad \omega = ${texNum(s.w)}\ \text{rad/s} \qquad \theta = ${texNum(s.th)}\ \text{rad}`,
    ];
  },

  params: [
    {
      key: "corpo",
      label: "Corpo",
      unit: "",
      min: 0,
      max: 3,
      step: 1,
      default: 0,
      options: BODY_NAMES.map((label, value) => ({ value, label })),
    },
    { key: "M", label: "Massa do corpo M", unit: "kg", min: 0.5, max: 10, step: 0.1, default: 2 },
    { key: "R", label: "Raio R (disco, anel)", unit: "m", min: 0.1, max: 0.5, step: 0.01, default: 0.4 },
    { key: "L", label: "Comprimento L (barra, placa)", unit: "m", min: 0.2, max: 1, step: 0.01, default: 0.8 },
    { key: "b", label: "Largura b (placa)", unit: "m", min: 0.1, max: 0.6, step: 0.01, default: 0.5 },
    { key: "d", label: "Distância inicial eixo–CM d", unit: "m", min: 0, max: 0.5, step: 0.01, default: 0 },
    {
      key: "modo",
      label: "Torque aplicado",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 0,
      options: [
        { value: 0, label: "Força tangencial F no carretel" },
        { value: 1, label: "Massa pendurada num fio enrolado" },
      ],
    },
    { key: "F", label: "Força tangencial F", unit: "N", min: -20, max: 20, step: 0.1, default: 2, live: true },
    { key: "m", label: "Massa pendurada m", unit: "kg", min: 0.02, max: 2, step: 0.01, default: 0.2 },
    { key: "r", label: "Raio do carretel r", unit: "m", min: 0.02, max: 0.15, step: 0.005, default: 0.06 },
    { key: "h", label: "Altura de queda h", unit: "m", min: 0.2, max: 1, step: 0.05, default: 1 },
    { key: "tau_a", label: "Torque de atrito no eixo", unit: "N·m", min: 0, max: 0.5, step: 0.005, default: 0, live: true },
  ],

  observables: [
    { key: "theta", label: "Ângulo θ", unit: "rad", value: (s) => s.th },
    { key: "omega", label: "Velocidade angular ω", unit: "rad/s", value: (s) => s.w },
    { key: "alpha", label: "Aceleração angular α", unit: "rad/s²", value: (s, p) => dynamics(s, p).alpha },
    { key: "I", label: "Momento de inércia I", unit: "kg·m²", value: (s, p) => inertia(p, s) },
    { key: "dist", label: "Distância eixo–CM d", unit: "m", value: (s) => Math.hypot(s.ax, s.ay) },
    { key: "tau", label: "Torque do fio/força rF", unit: "N·m", value: (s, p) => dynamics(s, p).T * num(p, "r", 0.06) },
    { key: "T", label: "Tração no fio", unit: "N", value: (s, p) => dynamics(s, p).T },
    { key: "Lang", label: "Momento angular Iω", unit: "kg·m²/s", value: (s, p) => inertia(p, s) * s.w },
    { key: "K", label: "Energia cinética de rotação", unit: "J", value: (s, p) => 0.5 * inertia(p, s) * s.w * s.w },
    { key: "y", label: "Descida da massa", unit: "m", value: (s, p) => (Math.round(num(p, "modo")) === 1 ? fallen(s, p) : 0) },
  ],
  chart: { x: "t", y: "omega" },

  scenarios: [
    {
      id: "eixos",
      label: "Eixos paralelos",
      params: { corpo: 0, M: 2, R: 0.4, d: 0, modo: 0, F: 2, r: 0.06, tau_a: 0 },
      guide: `### Mesmo torque, eixos diferentes
1. Rode com o eixo no centro do disco e anote $\\alpha$.
2. Pause, **arraste o eixo** (o ponto marcado) para perto da borda e rode de novo. O que aconteceu com $I$ e com $\\alpha$?
3. Confira a barra de inércia: a parte $Md^2$ cresce com o quadrado da distância.
4. Mostre que, para o eixo na borda ($d = R$), $I = \\tfrac32 MR^2$.`,
      predict: [
        {
          question: "Levando o eixo do centro para a borda do disco (d = R), com o mesmo torque, a aceleração angular:",
          options: ["fica igual", "cai para 1/3 do valor", "cai para 2/3 do valor", "dobra"],
          answer: 1,
          explanation: "$I$ passa de $\\tfrac12 MR^2$ para $\\tfrac12 MR^2 + MR^2 = \\tfrac32 MR^2$, três vezes maior. Com $\\tau$ fixo, $\\alpha = \\tau/I$ cai para um terço.",
        },
      ],
    },
    {
      id: "massa",
      label: "Massa pendurada",
      params: { corpo: 0, M: 2, R: 0.4, d: 0, modo: 1, m: 0.2, r: 0.06, h: 1, tau_a: 0 },
      guide: `### Medindo I com uma massa que cai
1. Rode e meça o tempo de queda $t$ da altura $h$.
2. Da cinemática, $a = 2h/t^2$ e $\\alpha = a/r$.
3. A tração vale $T = m(g - a)$; então $I = Tr/\\alpha$. Compare com $\\tfrac12 MR^2$.
4. Repare que $T < mg$: se fosse igual, a massa não aceleraria.`,
      predict: [
        {
          question: "Durante a queda, a tração no fio é:",
          options: ["igual ao peso mg", "menor que mg", "maior que mg"],
          answer: 1,
          explanation: "A massa acelera para baixo, então $mg - T = ma > 0$ e $T < mg$.",
        },
      ],
    },
    {
      id: "formas",
      label: "Anel × disco × barra",
      params: { corpo: 1, M: 2, R: 0.4, d: 0, modo: 0, F: 2, r: 0.06, tau_a: 0 },
      guide: `### A distribuição de massa importa
1. Com a mesma massa e o mesmo raio, compare anel e disco: qual acelera mais? Por quê?
2. Troque para a barra e mova o eixo para a ponta: $I = \\tfrac13 ML^2$.
3. Na placa, compare o eixo no centro com o eixo num canto.`,
    },
    {
      id: "atrito",
      label: "Atrito no eixo",
      params: { corpo: 0, M: 2, R: 0.4, d: 0, modo: 0, F: 2, r: 0.06, tau_a: 0.05 },
      guide: `### Torque resultante
1. Com atrito no eixo, $I\\alpha = rF - \\tau_a$.
2. Durante a simulação, diminua $F$ até $rF < \\tau_a$: o disco desacelera e para.
3. Qual é a menor força que põe o disco em movimento a partir do repouso?`,
    },
  ],

  exercises: [
    {
      id: "paralelos",
      prompt: "Um disco uniforme de massa {M} kg e raio {R} m gira em torno de um eixo perpendicular ao disco, a {d} m do centro. Qual é o momento de inércia?",
      vary: { M: [0.5, 8, 1], R: [0.1, 0.5, 2], d: [0.05, 0.1, 2] },
      fixed: { corpo: 0 },
      answer: { label: "I", unit: "kg·m²", compute: (p) => 0.5 * num(p, "M") * num(p, "R") ** 2 + num(p, "M") * num(p, "d") ** 2 },
      hint: "I = I_cm + M d², com I_cm = MR²/2.",
    },
    {
      id: "queda",
      prompt:
        "Um fio enrolado num carretel de raio {r} m, preso no centro de um disco de massa {M} kg e raio {R} m, sustenta uma massa de {m} kg. Partindo do repouso, quanto tempo a massa leva para descer {h} m? (g = 9,81 m/s²; despreze a massa do carretel)",
      vary: { M: [1, 6, 1], R: [0.2, 0.5, 2], r: [0.03, 0.12, 2], m: [0.1, 1, 2], h: [0.3, 1, 1] },
      fixed: { corpo: 0, modo: 1, d: 0 },
      answer: {
        label: "t",
        unit: "s",
        compute: (p) => {
          const I = 0.5 * num(p, "M") * num(p, "R") ** 2, r = num(p, "r"), m = num(p, "m");
          const a = (m * G * r * r) / (I + m * r * r);
          return Math.sqrt((2 * num(p, "h")) / a);
        },
      },
      hint: "a = mgr²/(I + mr²) e h = at²/2.",
    },
  ],

  init(p) {
    const [ax, ay] = clampToBody(p, num(p, "d"), 0);
    return { th: 0, w: 0, ax, ay, px: 0, py: 0 };
  },
  step(s0, p, _t, dt) {
    const s = Math.abs(s0.w) <= 1e-9 ? { ...s0, w: 0 } : s0;
    const { alpha, Ieff, tauDrive } = dynamics(s, p);
    const w1 = s.w + alpha * dt;
    const ta = num(p, "tau_a");
    // O atrito para o corpo se ω trocaria de sinal e o torque motor não vence o atrito.
    if (s.w !== 0 && Math.sign(w1) !== Math.sign(s.w) && Math.abs(tauDrive) <= ta && Ieff > 0) {
      const ts = -s.w / alpha;
      return { ...s, th: s.th + s.w * ts + 0.5 * alpha * ts * ts, w: 0 };
    }
    return { ...s, th: s.th + s.w * dt + 0.5 * alpha * dt * dt, w: w1 };
  },
  dt: 1e-3,
  sampleEvery: 10,
  tEnd: 30,
  stopWhen: (s, p) => (Math.round(num(p, "modo")) === 1 ? num(p, "h", 1) - fallen(s, p) : 1),

  pointer: {
    down: (s, p, pt) => moveAxis(s, p, pt.x, pt.y, true),
    move: (s, p, pt, dragging) => (dragging ? moveAxis(s, p, pt.x, pt.y, false) : undefined),
    // Ao soltar, o eixo volta ao centro do palco (o corpo se desloca junto): o eixo é fixo na mesa.
    up: (s) => (s.px !== 0 || s.py !== 0 ? { ...s, px: 0, py: 0 } : undefined),
    cursor: (s, p, pt) => {
      const [bx, by] = toBody(s, pt.x, pt.y);
      return insideBody(p, bx, by, 0.06) ? "grab" : undefined;
    },
  },
  actions: [
    { id: "centro", label: "Eixo no CM", run: (s) => ({ ...s, ...centerAxis(), w: 0 }) },
  ],

  viewport: () => ({ xMin: -1.15, xMax: 2.3, yMin: -1.65, yMax: 1.55, unit: "m" }),

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const { state: s, params: p, theme } = frame;
    const k = body(p);
    const R = num(p, "R", 0.4), L = num(p, "L", 0.8), b = num(p, "b", 0.5);
    const r = num(p, "r", 0.06);
    const [cx, cy] = cmWorld(s);
    const col = theme.series[0]!;
    const dyn = dynamics(s, p);

    d.text("vista de cima: o corpo gira num plano horizontal", -1.1, 1.45, { color: theme.muted, size: 11, align: "left" });
    d.text("arraste sobre o corpo para mover o eixo", -1.1, 1.29, { color: theme.accent, size: 11, align: "left" });
    d.text("(ao soltar, o eixo volta ao centro do palco)", -1.1, 1.14, { color: theme.muted, size: 10, align: "left" });

    // Corpo
    const ux = Math.cos(s.th), uy = Math.sin(s.th);
    if (k === 0) {
      d.circle(cx, cy, R, { fill: col, alpha: 0.3 });
      d.circle(cx, cy, R, { stroke: col, width: 2 });
      d.line(cx, cy, cx + R * ux, cy + R * uy, { color: col, width: 2 });
    } else if (k === 1) {
      d.circle(cx, cy, R, { stroke: col, width: 7 });
      d.line(cx - R * ux, cy - R * uy, cx + R * ux, cy + R * uy, { color: theme.muted, width: 1, dash: [3, 3] });
      d.line(cx + uy * R, cy - ux * R, cx - uy * R, cy + ux * R, { color: theme.muted, width: 1, dash: [3, 3] });
      d.dot(cx + R * ux, cy + R * uy, 5, theme.text);
    } else if (k === 2) {
      d.box(cx, cy, L, 0.06, s.th, { fill: col, stroke: theme.text, width: 1, alpha: 0.85 });
    } else {
      d.box(cx, cy, L, b, s.th, { fill: col, alpha: 0.3 });
      d.box(cx, cy, L, b, s.th, { stroke: col, width: 2 });
      d.line(cx, cy, cx + (L / 2) * ux, cy + (L / 2) * uy, { color: col, width: 2 });
    }

    // CM e distância d
    const dist = Math.hypot(s.ax, s.ay);
    d.dot(cx, cy, 4, theme.text);
    d.text("CM", cx, cy, { dy: 12, size: 11, color: theme.text });
    if (dist > 0.01) {
      d.line(cx, cy, s.px, s.py, { color: theme.positive, dash: [5, 3], width: 1.5 });
      d.text(`d = ${dist.toFixed(2).replace(".", ",")} m`, cx, cy, { dy: 26, size: 12, color: theme.positive, weight: "600" });
    }

    // Carretel e eixo
    d.circle(s.px, s.py, r, { fill: theme.muted, alpha: 0.5 });
    d.circle(s.px, s.py, r, { stroke: theme.text, width: 1.5 });
    d.circle(s.px, s.py, 0.035, { stroke: theme.positive, width: 2.5, minPx: 7 });
    d.dot(s.px, s.py, 3, theme.positive);
    d.text("eixo", s.px, s.py, { dx: -12, dy: -12, size: 11, color: theme.positive, align: "right" });

    // Força / fio
    const hang = Math.round(num(p, "modo")) === 1;
    if (hang) {
      const qx = PULLEY.x - 0.005, qy = PULLEY.y + PULLEY.r;
      const [tx, ty] = tangentPoint(s.px, s.py, r, qx, qy);
      d.line(tx, ty, qx, qy, { color: theme.text, width: 1.2 });
      d.circle(PULLEY.x, PULLEY.y, PULLEY.r, { stroke: theme.muted, width: 2 });
      d.dot(PULLEY.x, PULLEY.y, 2.5, theme.muted);
      const top0 = FLOOR + num(p, "h", 1) + BOX_H;
      const top = top0 - fallen(s, p);
      const sx = PULLEY.x + PULLEY.r;
      d.line(sx, PULLEY.y, sx, top, { color: theme.text, width: 1.2 });
      d.rect(sx - 0.09, top - BOX_H, 0.18, BOX_H, { fill: theme.series[1], stroke: theme.text, width: 1 });
      d.text("m", sx, top - BOX_H / 2, { size: 11, color: theme.dark ? "#111" : "#fff", weight: "600" });
      d.support(1.6, FLOOR, 2.3, FLOOR, { color: theme.muted });
      d.arrowPx(sx + 0.16, top - BOX_H / 2, 0, -1, 30, { color: theme.text });
      d.text("mg", sx + 0.2, top - BOX_H / 2 - 0.12, { size: 11, align: "left" });
      d.text(`T = ${dyn.T.toFixed(2).replace(".", ",")} N`, sx - 0.12, top + 0.15, { size: 11, align: "right", color: theme.muted });
    } else {
      const F = num(p, "F", 2);
      const tx = s.px, ty = s.py - r;
      if (Math.abs(F) > 1e-6) {
        d.arrowPx(tx, ty, Math.sign(F), 0, 18 + Math.abs(F) * 5, { color: theme.series[2] });
        d.text("F", tx + Math.sign(F) * (26 + Math.abs(F) * 5) * d.px, ty, { color: theme.series[2], size: 12, weight: "600", dy: 10 });
      }
    }

    // Sentido de ω (arco) junto ao eixo
    if (Math.abs(s.w) > 1e-3) {
      const rr = Math.max(r + 0.08, 0.15);
      const sg = Math.sign(s.w);
      const pts: [number, number][] = [];
      for (let i = 0; i <= 16; i++) {
        const a = Math.PI / 2 + sg * (i / 16) * 1.4;
        pts.push([s.px + rr * Math.cos(a), s.py + rr * Math.sin(a)]);
      }
      d.polyline(pts, { color: theme.accent, width: 2 });
      const [ex, ey] = pts[pts.length - 1]!;
      const a = Math.PI / 2 + sg * 1.4;
      d.arrowPx(ex, ey, -sg * Math.sin(a), sg * Math.cos(a), 8, { color: theme.accent });
      d.text("ω", s.px, s.py + rr, { dy: -9, color: theme.accent, size: 12, weight: "600" });
    }

    // Barra de inércia: I = I_cm + M d²
    const Icm = inertiaCm(p), Md2 = num(p, "M", 2) * dist * dist;
    const Imax = Math.max(0.05, inertiaCm(p) + num(p, "M", 2) * maxReach(p) ** 2);
    const bx0 = 0.75, bw = 1.45, by0 = 1.12, bh = 0.16;
    d.rect(bx0, by0, bw, bh, { stroke: theme.grid, width: 1 });
    d.rect(bx0, by0, (bw * Icm) / Imax, bh, { fill: theme.series[0], alpha: 0.75 });
    d.rect(bx0 + (bw * Icm) / Imax, by0, (bw * Md2) / Imax, bh, { fill: theme.positive, alpha: 0.75 });
    d.text("I = I_cm + M d²", bx0, by0 + bh + 0.12, { align: "left", size: 12, weight: "600" });
    d.text(`I_cm = ${Icm.toFixed(3).replace(".", ",")}`, bx0, by0 - 0.11, { align: "left", size: 11, color: theme.series[0] });
    d.text(`Md² = ${Md2.toFixed(3).replace(".", ",")} kg·m²`, bx0 + bw, by0 - 0.11, { align: "right", size: 11, color: theme.positive });

    d.text(`α = ${dyn.alpha.toFixed(3).replace(".", ",")} rad/s²   ω = ${s.w.toFixed(2).replace(".", ",")} rad/s`, -1.1, -1.55, {
      align: "left",
      size: 12,
      color: theme.text,
    });
  },
});

function centerAxis(): Pick<RotState, "ax" | "ay" | "px" | "py"> {
  // Eixo no CM e corpo recentralizado no palco.
  return { ax: 0, ay: 0, px: 0, py: 0 };
}

/** Maior distância possível eixo–CM para o corpo atual (escala da barra de inércia). */
function maxReach(p: Params): number {
  const R = num(p, "R", 0.4), L = num(p, "L", 0.8), b = num(p, "b", 0.5);
  const k = body(p);
  return k === 2 ? L / 2 : k === 3 ? Math.hypot(L, b) / 2 : R;
}

export default rotacaoTorque;
