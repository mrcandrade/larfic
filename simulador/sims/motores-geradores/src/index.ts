import { clamp, defineSim, draw, num, texNum, type Draw, type Params } from "@fisilab/core";
import { fmt, panel } from "./panel.ts";
import {
  MATERIAIS,
  PEND,
  brakeC,
  coilEmf,
  diskK,
  dynamoMean,
  dynamoOut,
  inst,
  loadTorque,
  motorDeriv,
  motorState,
  noLoadOmega,
  pendDeriv,
  pendAmplitude,
  pendEnergy,
  rk4,
  stallTorque,
  starPhasors,
  steadyOmega,
  wireK,
  type DCMotor,
  type Pendulum,
  type ThreePhase,
} from "./physics.ts";

export * from "./physics.ts";

export interface MGState {
  /** Eixo da máquina: ângulo (rad) e velocidade angular (rad/s). */
  th: number;
  w: number;
  /** Ângulo desenhado (câmera lenta quando a rotação é rápida). */
  vis: number;
  /** Pêndulos de Waltenhofen: placa maciça (A) e com fendas (B): [θ, ω, calor dissipado, amplitude]. */
  A: [number, number, number, number];
  B: [number, number, number, number];
  /** Ângulo-alvo da manivela enquanto o aluno arrasta (rad), ou null. */
  crank: number | null;
  drag: null | "crank" | "A" | "B";
}

export const MODOS = ["Motor DC: fcem e carga", "Homopolar: disco e motor de Faraday", "Dínamo × alternador", "Gerador trifásico (estrela)", "Pêndulo de Waltenhofen"];
const VIEW = { xMin: -17, xMax: 17, yMin: -9.5, yMax: 9.5 };
export const modo = (p: Params) => clamp(Math.round(num(p, "modo")), 0, MODOS.length - 1);
const rpm = (w: number) => (w * 60) / (2 * Math.PI);
const TAU = 2 * Math.PI;

// ------------------------------------------------------------ parâmetros derivados
export const dcMotor = (p: Params): DCMotor => ({
  V: num(p, "V", 6),
  R: num(p, "R", 2),
  k: num(p, "k", 20) * 1e-3,
  m: clamp(Math.round(num(p, "bobinas", 3)), 1, 8),
  J: 2e-5,
  b: 2e-6,
  load: num(p, "carga", 0) * 1e-3,
});

/** Dispositivo homopolar: 0 disco gerador, 1 roda de Barlow (disco motor), 2 motor de Faraday (fio no mercúrio). */
export const device = (p: Params) => clamp(Math.round(num(p, "disp", 0)), 0, 2);
export function homo(p: Params) {
  const B = num(p, "B", 0.5);
  const a = num(p, "a", 10) / 100;
  const dev = device(p);
  if (dev === 2) return { dev, B, a, k: wireK(B, 0.05, 0.02), J: 4e-7, b: 1e-4, R: num(p, "R", 2) * 0.5 };
  const M = 8960 * Math.PI * a * a * 0.002;
  return { dev, B, a, k: diskK(B, a), J: 0.5 * M * a * a, b: 1e-4, R: num(p, "R", 2) * 0.01 };
}
const shaftW = (p: Params) => (num(p, "rpm", 120) * TAU) / 60;

export const coilParams = (p: Params) => ({ N: num(p, "N", 200), B: num(p, "B", 0.5), A: (num(p, "a", 10) / 100) ** 2, m: clamp(Math.round(num(p, "bobinas", 3)), 1, 8) });
export const E0 = (p: Params, w: number) => coilEmf(coilParams(p).N, coilParams(p).B, coilParams(p).A, w, Math.PI / 2);

export const threePhase = (p: Params): ThreePhase => ({
  Vf: num(p, "Vf", 127),
  seq: Math.round(num(p, "seq", 1)) === -1 ? -1 : 1,
  R: [num(p, "Ra", 50), num(p, "Rb", 50), num(p, "Rc", 50)],
  neutral: Math.round(num(p, "neutro", 1)) === 1,
});
/** Frequência mostrada na animação (câmera lenta acima de 1 Hz). */
const visF = (p: Params) => Math.min(num(p, "f", 60), 1);

export const pendulum = (p: Params, slotted: boolean): Pendulum => {
  const m = MATERIAIS[clamp(Math.round(num(p, "material", 0)), 0, MATERIAIS.length - 1)]!;
  return { sigma: m.sigma, rho: m.rho, delta: num(p, "esp", 2) / 1000, B: num(p, "Bw", 0.3), alpha: slotted ? PEND.alphaSlot : PEND.alphaSolid };
};

// ------------------------------------------------------------ passo de tempo
function stepPend(pp: Pendulum, s: [number, number, number, number], dt: number, n: number): [number, number, number, number] {
  let [th, w, Q] = s;
  let amp: number;
  const h = dt / n;
  for (let k = 0; k < n; k++) {
    const [t2, w2] = rk4((a, b) => pendDeriv(pp, a, b), th, w, h);
    // calor = trabalho do freio (média do integrando no passo)
    Q += 0.5 * h * (brakeC(pp, th) * w * w + brakeC(pp, t2) * w2 * w2);
    th = t2;
    w = w2;
  }
  amp = pendAmplitude(pp, th, w);
  return [th, w, Q, amp];
}

function step(s: MGState, p: Params, _t: number, dt: number): MGState {
  const m = modo(p);
  if (m === 0) {
    const mp = dcMotor(p);
    let th = s.th, w = s.w;
    const n = 4;
    for (let k = 0; k < n; k++) [th, w] = rk4((a, b) => motorDeriv(mp, a, b), th, w, dt / n);
    return { ...s, th, w, vis: s.vis + (w * dt) / 40 };
  }
  if (m === 1) {
    const h = homo(p);
    if (h.dev === 0) {
      const w = shaftW(p);
      return { ...s, th: s.th + w * dt, w, vis: s.vis + w * dt };
    }
    const V = num(p, "V", 6);
    let th = s.th, w = s.w;
    const f = (_a: number, b: number): [number, number] => {
      const i = (V - h.k * b) / h.R;
      return [b, (h.k * i - h.b * b - loadTorque(num(p, "carga", 0) * 1e-3, b)) / h.J];
    };
    for (let k = 0; k < 4; k++) [th, w] = rk4(f, th, w, dt / 4);
    return { ...s, th, w, vis: s.vis + (w * dt) / (h.dev === 2 ? 10 : 20) };
  }
  if (m === 2) {
    if (s.crank !== null) {
      let d = s.crank - s.th;
      d -= TAU * Math.round(d / TAU);
      const wNew = clamp(d / dt, -60, 60);
      const w = 0.8 * s.w + 0.2 * wNew;
      return { ...s, th: s.th + d, w, vis: s.vis + d };
    }
    const w = shaftW(p);
    return { ...s, th: s.th + w * dt, w, vis: s.vis + w * dt };
  }
  if (m === 3) {
    const w = TAU * num(p, "f", 60);
    return { ...s, th: s.th + w * dt, w, vis: s.vis + TAU * visF(p) * dt };
  }
  if (s.drag === "A" || s.drag === "B") {
    const other = s.drag === "A" ? "B" : "A";
    return { ...s, [other]: stepPend(pendulum(p, other === "B"), s[other], dt, 5) };
  }
  return { ...s, A: stepPend(pendulum(p, false), s.A, dt, 5), B: stepPend(pendulum(p, true), s.B, dt, 5) };
}

// ------------------------------------------------------------ medidas
export function machine(s: MGState, p: Params) {
  const m = modo(p);
  if (m === 0) {
    const mp = dcMotor(p);
    const st = motorState(mp, s.th, s.w);
    const Pin = mp.V * st.i;
    const Pmec = loadTorque(mp.load, s.w) * s.w;
    return { i: st.i, fem: st.fem, tau: st.tau, Pin, Pmec, eta: Pin > 1e-9 ? (100 * Pmec) / Pin : 0 };
  }
  if (m === 1) {
    const h = homo(p);
    const fem = h.k * s.w;
    if (h.dev === 0) {
      const i = fem / (h.R + num(p, "RL", 1) * 1e-3);
      return { i, fem, tau: h.k * i, Pin: h.k * i * s.w, Pmec: fem * i, eta: 0 };
    }
    const V = num(p, "V", 6);
    const i = (V - fem) / h.R;
    const Pin = V * i;
    const Pmec = loadTorque(num(p, "carga", 0) * 1e-3, s.w) * s.w;
    return { i, fem, tau: h.k * i, Pin, Pmec, eta: Pin > 1e-9 ? (100 * Pmec) / Pin : 0 };
  }
  if (m === 2) {
    const e0 = E0(p, s.w);
    const RL = num(p, "RL", 100);
    const v = coilEmf(coilParams(p).N, coilParams(p).B, coilParams(p).A, s.w, s.th);
    const i = v / RL;
    return { i, fem: v, tau: Math.abs(s.w) > 1e-6 ? (v * i) / s.w : 0, Pin: (v * v) / RL, Pmec: (v * v) / RL, eta: 0, e0 };
  }
  return { i: 0, fem: 0, tau: 0, Pin: 0, Pmec: 0, eta: 0 };
}

export function three(s: MGState, p: Params) {
  const tp = threePhase(p);
  const ph = starPhasors(tp);
  const wt = s.vis;
  const v = ph.V.map((x) => inst(x, wt));
  const i = ph.I.map((x) => inst(x, wt));
  const vl = ph.Vload.map((x) => inst(x, wt));
  const p3 = vl.reduce((acc, vv, k) => acc + vv * i[k]!, 0);
  return { tp, ph, v, i, iN: inst(ph.IN, wt), p3 };
}

const totalE = (pp: Pendulum, x: [number, number, number, number]) => pendEnergy(pp, x[0], x[1]) + x[2];

// ------------------------------------------------------------ desenho: utilidades
function magnetPoles(d: Draw, cx: number, cy: number, gap: number, h: number, w = 1.6) {
  const th = d.theme;
  d.rect(cx - gap - w, cy - h / 2, w, h, { fill: th.positive, alpha: 0.85 });
  d.rect(cx + gap, cy - h / 2, w, h, { fill: th.negative, alpha: 0.85 });
  d.text("N", cx - gap - w / 2, cy, { size: 15, weight: "700", color: "#ffffff" });
  d.text("S", cx + gap + w / 2, cy, { size: 15, weight: "700", color: "#ffffff" });
  for (let k = -2; k <= 2; k++) d.arrow(cx - gap + 0.15, cy + k * (h / 6), 2 * gap - 0.3, 0, { color: th.muted, width: 1, alpha: 0.45, head: 6 });
}

function battery(d: Draw, x: number, y: number, label: string) {
  const th = d.theme;
  d.line(x - 0.7, y + 0.25, x + 0.7, y + 0.25, { color: th.text, width: 2.4 });
  d.line(x - 0.4, y - 0.15, x + 0.4, y - 0.15, { color: th.text, width: 4 });
  d.text(label, x, y - 0.8, { size: 11 });
}

/** Comutador de 2m segmentos (ou anéis) com escovas, centrado em (x, y). */
function commutator(d: Draw, x: number, y: number, r: number, ang: number, m: number) {
  const th = d.theme;
  const nSeg = 2 * m;
  for (let j = 0; j < nSeg; j++) {
    const a0 = ang + (j * TAU) / nSeg + 0.12;
    const a1 = ang + ((j + 1) * TAU) / nSeg - 0.12;
    const pts: [number, number][] = [[x, y]];
    for (let k = 0; k <= 8; k++) pts.push([x + r * Math.cos(a0 + ((a1 - a0) * k) / 8), y + r * Math.sin(a0 + ((a1 - a0) * k) / 8)]);
    d.polyline(pts, { color: th.text, width: 1, close: true, fill: j % 2 ? "#c98a3a" : "#e0a95a" });
  }
  d.rect(x - r - 0.55, y - 0.3, 0.5, 0.6, { fill: th.muted });
  d.rect(x + r + 0.05, y - 0.3, 0.5, 0.6, { fill: th.muted });
}

// ------------------------------------------------------------ desenho: motor DC
function drawMotor(d: Draw, p: Params, s: MGState) {
  const th = d.theme;
  const mp = dcMotor(p);
  const M = machine(s, p);
  const cx = -9, cy = 2.4, R = 2.6;
  magnetPoles(d, cx, cy, 3.2, 6.4);
  d.circle(cx, cy, R, { stroke: th.muted, width: 1, dash: [3, 3] });
  for (let j = 0; j < mp.m; j++) {
    const a = s.vis + (j * Math.PI) / mp.m;
    const act = j === activeCoil(mp.m, s.th);
    const c = act ? th.series[1]! : th.muted;
    const x1 = cx + R * Math.cos(a), y1 = cy + R * Math.sin(a);
    d.line(2 * cx - x1, 2 * cy - y1, x1, y1, { color: c, width: act ? 4 : 2 });
    d.dot(x1, y1, act ? 5 : 3.5, c);
    d.dot(2 * cx - x1, 2 * cy - y1, act ? 5 : 3.5, c);
    if (act && Math.abs(M.tau) > 1e-7) {
      // F = I L × B com B horizontal: forças verticais e opostas nos dois lados (binário)
      const L = clamp(Math.abs(M.tau) / Math.max(stallTorque(mp), 1e-9), 0.15, 1) * 2.2;
      const sg = Math.sign(M.tau) * (Math.sign(x1 - cx) || 1);
      d.arrow(x1, y1, 0, sg * L, { color: th.series[2]!, width: 2 });
      d.arrow(2 * cx - x1, 2 * cy - y1, 0, -sg * L, { color: th.series[2]!, width: 2 });
    }
  }
  d.dot(cx, cy, 4, th.text);
  commutator(d, cx, -3.6, 0.9, s.vis, mp.m);
  d.polyline([[cx - 1.5, -3.6], [-13.5, -3.6], [-13.5, -6.8], [cx - 0.8, -6.8]], { color: th.text, width: 1.8 });
  d.polyline([[cx + 1.5, -3.6], [-4.5, -3.6], [-4.5, -6.8], [cx + 0.8, -6.8]], { color: th.text, width: 1.8 });
  battery(d, cx, -6.8, `V = ${fmt(mp.V)} V`);
  d.text("comutador e escovas", cx, -2.2, { size: 10, color: th.muted });
  d.text("forças F = I L × B (verde) formam um binário", cx, cy + R + 1.4, { size: 10, color: th.series[2]! });
  d.text("Motor DC com comutador", -16.5, 8.7, { size: 14, weight: "700", align: "left" });
  d.text(`${mp.m} bobina${mp.m > 1 ? "s" : ""}, ${2 * mp.m} segmentos (animação 40× mais lenta)`, -16.5, 7.9, { size: 11, align: "left", color: th.muted });
  const x = -16.5;
  d.text(`${fmt(rpm(s.w))} rpm`, x, -8.2, { size: 15, weight: "700", align: "left", color: th.series[0]! });
  d.text(`i = ${fmt(M.i)} A   ε = ${fmt(M.fem)} V`, x + 6.2, -8.2, { size: 12, align: "left" });

  // característica torque × rotação
  const box = { x0: 1.2, y0: 0.6, x1: 16.2, y1: 7.6 };
  const tS = stallTorque(mp) * 1e3;
  const w0 = rpm(noLoadOmega(mp));
  const pl = panel(d, box, { min: 0, max: Math.max(tS, mp.load * 1e3) * 1.05 }, { min: 0, max: w0 * 1.1 });
  pl.frame({ xlabel: "torque de carga (mN·m)", ylabel: "rotação (rpm)" });
  pl.plot((tau) => rpm(steadyOmega({ ...mp, load: tau / 1e3 })), 0, tS, { color: th.series[0]!, width: 2.2 });
  pl.line([[0, 0], [tS, w0]], { color: th.series[3]!, width: 1.4, dash: [5, 4] });
  d.dot(pl.X(mp.load * 1e3), pl.Y(rpm(s.w)), 6, th.series[1]!);
  d.text("ω(τ) em regime", pl.X(tS * 0.08), pl.Y(w0 * 0.95), { size: 10, align: "left", color: th.series[0]! });
  d.text("corrente (escala: 0 → I_partida)", pl.X(tS * 0.62), pl.Y(w0 * 0.55), { size: 10, align: "left", color: th.series[3]! });
  d.text(`partida: I = V/R = ${fmt(mp.V / mp.R)} A, τ = ${fmt(tS)} mN·m`, box.x1, box.y1 + 0.5, { size: 11, align: "right" });

  // balanço de tensão e de potência
  const b2 = { x0: 1.2, y0: -7.6, x1: 16.2, y1: -1.6 };
  d.text("Balanço: V = R i + ε   e   P_elétrica = P_Joule + P_mecânica + P_atrito", b2.x0, b2.y1 + 0.5, { size: 11, align: "left", weight: "600" });
  const Vmax = Math.max(mp.V, 1e-6);
  const barW = (b2.x1 - b2.x0 - 3.5);
  const X0 = b2.x0 + 3.5;
  const vR = M.i * mp.R;
  d.text("tensão", b2.x0, -2.8, { size: 11, align: "left" });
  d.rect(X0, -3.3, (barW * clamp(vR, 0, Vmax)) / Vmax, 1, { fill: th.series[3]! });
  d.rect(X0 + (barW * clamp(vR, 0, Vmax)) / Vmax, -3.3, (barW * clamp(M.fem, 0, Vmax)) / Vmax, 1, { fill: th.series[2]! });
  d.text(`R i = ${fmt(vR)} V`, X0 + 0.2, -3.8, { size: 10, align: "left", color: th.series[3]!, dy: 4 });
  d.text(`ε = ${fmt(M.fem)} V`, b2.x1, -3.8, { size: 10, align: "right", color: th.series[2]!, dy: 4 });
  const Pin = Math.max(M.Pin, 1e-9);
  const PJ = M.i * M.i * mp.R;
  const Pf = mp.b * s.w * s.w;
  const parts: [number, string, string][] = [
    [PJ, th.series[3]!, "Joule"],
    [M.Pmec, th.series[0]!, "mecânica útil"],
    [Pf, th.muted, "atrito"],
  ];
  d.text("potência", b2.x0, -5.6, { size: 11, align: "left" });
  let acc = 0;
  for (const [P, c] of parts) {
    const w = (barW * clamp(P, 0, Pin)) / Pin;
    d.rect(X0 + acc, -6.1, w, 1, { fill: c });
    acc += w;
  }
  d.text(`P = V i = ${fmt(M.Pin)} W   (Joule ${fmt(PJ)} W, útil ${fmt(M.Pmec)} W, atrito ${fmt(Pf)} W)`, X0, -6.9, { size: 10, align: "left", dy: 4 });
  d.text(`rendimento η = ${fmt(M.eta)} %`, b2.x1, -8.4, { size: 12, align: "right", weight: "700" });
}

/** Bobina que está ligada às escovas (a de maior |sen|). */
function activeCoil(m: number, th: number) {
  let best = 0, jb = 0;
  for (let j = 0; j < m; j++) {
    const v = Math.abs(Math.sin(th + (j * Math.PI) / m));
    if (v > best) {
      best = v;
      jb = j;
    }
  }
  return jb;
}

// ------------------------------------------------------------ desenho: homopolar
function drawHomo(d: Draw, p: Params, s: MGState) {
  const th = d.theme;
  const h = homo(p);
  const M = machine(s, p);
  const cx = -8.5, cy = 0.5;
  const names = ["Disco de Faraday (gerador)", "Roda de Barlow (disco motor)", "Motor de Faraday (fio no mercúrio)"];
  d.text(names[h.dev]!, -16.5, 8.7, { size: 14, weight: "700", align: "left" });
  if (h.dev < 2) {
    const rx = 5, ry = 1.9;
    // ímã: polos acima e abaixo do disco (B vertical, para cima)
    d.rect(cx + 1.2, cy - 4.2, 3.4, 1.6, { fill: th.negative, alpha: 0.85 });
    d.rect(cx + 1.2, cy + 2.6, 3.4, 1.6, { fill: th.positive, alpha: 0.85 });
    d.text("N", cx + 2.9, cy - 3.4, { size: 13, weight: "700", color: "#ffffff" });
    d.text("S", cx + 2.9, cy + 3.4, { size: 13, weight: "700", color: "#ffffff" });
    d.ctx.beginPath();
    d.ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU);
    d.ctx.fillStyle = "#c98a3a";
    d.ctx.globalAlpha = 0.85;
    d.ctx.fill();
    d.ctx.globalAlpha = 1;
    d.ctx.strokeStyle = th.text;
    d.ctx.lineWidth = 1.5 * d.px;
    d.ctx.stroke();
    for (let k = 0; k < 3; k++) d.arrow(cx + 1.8 + k * 0.9, cy - 2.4, 0, 4.6, { color: th.muted, width: 1, alpha: 0.6, head: 6 });
    d.text("B", cx + 4.9, cy + 2.2, { size: 12, color: th.muted, weight: "700" });
    // raio marcado girando
    for (let k = 0; k < 6; k++) {
      const a = s.vis + (k * TAU) / 6;
      d.line(cx, cy, cx + rx * Math.cos(a), cy + ry * Math.sin(a), { color: "#8a5a20", width: 1, alpha: 0.6 });
    }
    d.line(cx, cy + 0.2, cx, 6.5, { color: th.text, width: 4 });
    d.line(cx, cy - 0.2, cx, -5, { color: th.text, width: 4 });
    // circuito: escova no eixo e na borda
    const rim: [number, number] = [cx + rx, cy];
    d.polyline([[cx + 0.2, 5.8], [cx + 7.2, 5.8], [cx + 7.2, cy], rim], { color: th.text, width: 1.8 });
    d.rect(rim[0] - 0.1, cy - 0.25, 0.5, 0.5, { fill: th.muted });
    if (h.dev === 0) {
      d.circle(cx + 7.2, 3.2, 0.8, { stroke: th.text, width: 1.6, fill: th.dark ? "#141a24" : "#fff" });
      d.text("mV", cx + 7.2, 3.2, { size: 10, weight: "700" });
    } else battery(d, cx + 7.2, 3.2, `${fmt(num(p, "V", 6))} V`);
    // corrente radial e força
    if (Math.abs(M.i) > 1e-6) {
      const sg = Math.sign(M.i);
      d.arrow(cx + 0.4 * sg + (sg < 0 ? rx - 0.8 : 0), cy, (rx - 1.2) * sg, 0, { color: th.series[1]!, width: 2.4 });
      d.text("I", cx + rx / 2, cy + 0.5, { size: 12, color: th.series[1]!, weight: "700" });
      const fy = h.dev === 0 ? -1 : 1;
      d.arrow(cx + rx * 0.6, cy, 0, fy * 1.6 * sg, { color: th.series[2]!, width: 2 });
      d.text(h.dev === 0 ? "F (freia)" : "F (gira)", cx + rx * 0.6 + 0.3, cy + fy * 1.7 * sg, { size: 10, color: th.series[2]!, align: "left" });
    }
    d.text(`a = ${fmt(h.a * 100)} cm`, cx - rx, cy - ry - 0.6, { size: 11, align: "left" });
  } else {
    // copo de mercúrio, ímã vertical no centro e fio pendurado no pivô
    const top = 6.6, surf = -3.2, Rr = 3.2;
    d.polyline([[cx - 4.5, surf + 0.6], [cx - 4, -6.5], [cx + 4, -6.5], [cx + 4.5, surf + 0.6]], { color: th.text, width: 1.8 });
    d.ctx.beginPath();
    d.ctx.ellipse(cx, surf, 4.3, 0.9, 0, 0, TAU);
    d.ctx.fillStyle = "#b8c0c8";
    d.ctx.fill();
    d.rect(cx - 0.5, -6.5, 1, 3.3, { fill: th.positive, alpha: 0.9 });
    d.rect(cx - 0.5, -3.2, 1, 1.2, { fill: th.negative, alpha: 0.9 });
    d.text("N", cx, -2.6, { size: 10, color: "#fff", weight: "700" });
    const ex = cx + Rr * Math.cos(s.vis), ey = surf + 0.7 * Math.sin(s.vis);
    d.line(cx, top, ex, ey, { color: th.series[1]!, width: 2.6 });
    d.dot(cx, top, 4, th.text);
    d.polyline([[cx, top], [cx + 6.5, top], [cx + 6.5, -7.5], [cx, -7.5], [cx, -6.5]], { color: th.text, width: 1.8 });
    battery(d, cx + 6.5, 0, `${fmt(num(p, "V", 6))} V`);
    // linhas de campo saindo do polo
    for (let k = 0; k < 6; k++) {
      const a = (k * TAU) / 6;
      d.line(cx, -2.1, cx + 3.6 * Math.cos(a), -2.1 + 0.8 * Math.sin(a) + 0.6, { color: th.muted, width: 1, alpha: 0.4 });
    }
    d.text("o fio gira em torno do polo enquanto passa corrente", cx, -8.6, { size: 10, color: th.muted });
  }
  // gráficos
  const box = { x0: 2.5, y0: 0.4, x1: 16.2, y1: 7.6 };
  if (h.dev === 0) {
    const wmax = 1000 * TAU / 60;
    const pl = panel(d, box, { min: 0, max: 1000 }, { min: 0, max: h.k * wmax * 1e3 * 1.05 });
    pl.frame({ xlabel: "rotação (rpm)", ylabel: "ε (mV)" });
    pl.plot((r) => h.k * ((r * TAU) / 60) * 1e3, 0, 1000, { color: th.series[0]!, width: 2.2 });
    d.dot(pl.X(rpm(s.w)), pl.Y(M.fem * 1e3), 6, th.series[1]!);
  } else {
    const mp: DCMotor = { V: num(p, "V", 6), R: h.R, k: h.k, m: 1, J: h.J, b: h.b, load: num(p, "carga", 0) * 1e-3 };
    const tS = stallTorque(mp) * 1e3;
    const w0 = rpm(steadyOmega({ ...mp, load: 0 }));
    const pl = panel(d, box, { min: 0, max: tS }, { min: 0, max: w0 * 1.1 });
    pl.frame({ xlabel: "torque de carga (mN·m)", ylabel: "rotação (rpm)" });
    pl.plot((tau) => rpm(steadyOmega({ ...mp, load: tau / 1e3 })), 0, tS, { color: th.series[0]!, width: 2.2 });
    d.dot(pl.X(clamp(mp.load * 1e3, 0, tS)), pl.Y(rpm(s.w)), 6, th.series[1]!);
  }
  const x = 2.5;
  const rows: [string, string][] = [
    ["constante k = ε/ω", `${fmt(h.k * 1e3)} mV·s/rad`],
    ["rotação", `${fmt(rpm(s.w))} rpm`],
    ["fem ε", `${fmt(M.fem * 1e3)} mV`],
    ["corrente I", `${fmt(M.i)} A`],
    ["torque k I", `${fmt(M.tau * 1e3)} mN·m`],
    ["resistência do circuito", `${fmt(h.R * 1e3)} mΩ`],
  ];
  rows.forEach(([k, v], i) => {
    d.text(k, x, -1.4 - i * 0.9, { size: 12, align: "left", color: th.muted });
    d.text(v, x + 7.6, -1.4 - i * 0.9, { size: 12, align: "left", weight: "600" });
  });
  d.text(h.dev === 2 ? "k = B L r̄: o fio corta as linhas radiais de B" : "ε = ½ B ω a²: cada raio corta as linhas de B; não precisa de comutador", x, -7.4, { size: 11, align: "left", color: th.muted });
  d.text("Homopolar: tensão contínua sem comutador, porém muito baixa.", x, -8.4, { size: 10, align: "left", color: th.muted });
}

// ------------------------------------------------------------ desenho: dínamo × alternador
const CRANK = { x: -14.8, y: 2.0, r: 1.1 };
function drawDynamo(d: Draw, p: Params, s: MGState) {
  const th = d.theme;
  const cp = coilParams(p);
  const e0 = Math.abs(E0(p, s.w));
  const machineAt = (cy: number, title: string, rings: boolean) => {
    const cx = -8.5;
    magnetPoles(d, cx, cy, 2.6, 4, 1.2);
    // bobina vista de frente: largura projetada ∝ cos θ
    const n = rings ? 1 : cp.m;
    for (let j = 0; j < n; j++) {
      const a = s.vis + (j * Math.PI) / n;
      const wpx = 1.9 * Math.cos(a);
      const act = rings || j === activeCoil(cp.m, s.th);
      d.rect(cx - Math.abs(wpx), cy - 1.4, 2 * Math.abs(wpx), 2.8, { stroke: act ? th.series[1]! : th.muted, width: act ? 2.5 : 1.2, fill: Math.cos(a) > 0 ? th.series[1]! : "transparent", alpha: Math.cos(a) > 0 ? 0.15 : 1 });
    }
    d.line(cx, cy - 1.6, cx, cy - 2.6, { color: th.text, width: 3 });
    if (rings) {
      d.rect(cx - 0.6, cy - 3.1, 1.2, 0.35, { fill: "#d9a441" });
      d.rect(cx - 0.6, cy - 3.6, 1.2, 0.35, { fill: "#d9a441" });
      d.text("anéis coletores", cx + 1, cy - 3.3, { size: 10, align: "left", color: th.muted });
    } else {
      commutator(d, cx, cy - 3.2, 0.55, s.vis, cp.m);
      d.text("comutador", cx + 1.4, cy - 3.2, { size: 10, align: "left", color: th.muted });
    }
    d.text(title, -12.5, cy + 2.7, { size: 13, weight: "700", align: "left" });
  };
  machineAt(5, "Alternador (anéis)", true);
  machineAt(-3.8, `Dínamo (comutador, ${cp.m} bobina${cp.m > 1 ? "s" : ""})`, false);
  // manivela comum (correia)
  const ca = s.vis;
  d.circle(CRANK.x, CRANK.y, CRANK.r, { stroke: th.text, width: 1.6 });
  d.line(CRANK.x, CRANK.y, CRANK.x + CRANK.r * Math.cos(ca), CRANK.y + CRANK.r * Math.sin(ca), { color: th.text, width: 3 });
  d.dot(CRANK.x + CRANK.r * Math.cos(ca), CRANK.y + CRANK.r * Math.sin(ca), 6, th.accent);
  d.text("manivela (arraste)", CRANK.x, CRANK.y - 1.9, { size: 10, color: th.accent });
  d.line(CRANK.x + 0.4, CRANK.y + 1.2, -8.5, 3.6, { color: th.muted, width: 1, dash: [3, 3] });
  d.line(CRANK.x + 0.4, CRANK.y - 1.2, -8.5, -5.4, { color: th.muted, width: 1, dash: [3, 3] });

  // osciloscópios: últimas 2 voltas (traçado analítico na rotação atual)
  const w = Math.abs(s.w) > 1e-6 ? s.w : shaftW(p);
  const Tr = TAU / Math.abs(w);
  const yMax = Math.max(e0, 1e-6) * 1.2;
  const scope = (box: { x0: number; y0: number; x1: number; y1: number }, f: (thAng: number) => number, color: string, lines: [number, string, string][]) => {
    d.rect(box.x0, box.y0, box.x1 - box.x0, box.y1 - box.y0, { fill: th.dark ? "#0d1a12" : "#f3f8f2" });
    const pl = panel(d, box, { min: -2 * Tr, max: 0 }, { min: -yMax, max: yMax });
    pl.frame({ xlabel: "t (s)", ylabel: "tensão de saída (V)" });
    pl.plot((t) => f(s.th + w * t), -2 * Tr, 0, { color, width: 2.2, n: 300 });
    for (const [v, c, lab] of lines) {
      pl.line([[-2 * Tr, v], [0, v]], { color: c, width: 1.2, dash: [5, 4] });
      d.text(lab, box.x1, pl.Y(v), { size: 10, align: "right", color: c, dy: -7, dx: -3 });
    }
    d.dot(pl.X(0), pl.Y(f(s.th)), 5, color);
  };
  const sgn = Math.sign(w) || 1;
  scope({ x0: 1.2, y0: 1.6, x1: 16.2, y1: 7.6 }, (a) => sgn * e0 * Math.sin(a), th.series[0]!, [
    [e0 / Math.SQRT2, th.series[2]!, `V_ef = ${fmt(e0 / Math.SQRT2)} V`],
  ]);
  scope({ x0: 1.2, y0: -7.4, x1: 16.2, y1: -1.4 }, (a) => dynamoOut(e0, a, cp.m), th.series[1]!, [[dynamoMean(e0, cp.m), th.series[2]!, `V_média = ${fmt(dynamoMean(e0, cp.m))} V`]]);
  d.text(`f = ${fmt(Math.abs(w) / TAU)} Hz (${fmt(Math.abs(rpm(w)))} rpm)   ε_máx = N B A ω = ${fmt(e0)} V`, 1.2, 8.7, { size: 12, align: "left", weight: "600" });
  d.text("alternador: tensão alternada", 1.2, 1.0, { size: 11, align: "left", color: th.series[0]! });
  d.text("dínamo: o comutador inverte a ligação a cada meia volta → tensão pulsante de um só sinal", 1.2, -8.3, { size: 11, align: "left", color: th.series[1]! });
}

// ------------------------------------------------------------ desenho: trifásico
function drawThree(d: Draw, p: Params, s: MGState) {
  const th = d.theme;
  const T = three(s, p);
  const cols = [th.series[0]!, th.series[1]!, th.series[2]!];
  const names = ["A", "B", "C"];
  const cx = -11.5, cy = 2.6, R = 3.0;
  d.circle(cx, cy, R + 0.6, { stroke: th.muted, width: 6, alpha: 0.4 });
  // bobina de cada fase no estator: a fase k atinge o pico quando o polo N passa por ela
  for (let k = 0; k < 3; k++) {
    const a = Math.PI / 2 - (T.tp.seq * k * TAU) / 3;
    const x = cx + R * Math.cos(a), y = cy + R * Math.sin(a);
    d.box(x, y, 1.6, 0.9, a + Math.PI / 2, { fill: cols[k]!, alpha: 0.85 });
    d.text(names[k]!, cx + (R + 1.5) * Math.cos(a), cy + (R + 1.5) * Math.sin(a), { size: 13, weight: "700", color: cols[k]! });
  }
  // rotor (ímã) girando
  const ra = Math.PI / 2 - s.vis;
  const ux = Math.cos(ra), uy = Math.sin(ra);
  d.line(cx - 2.2 * ux, cy - 2.2 * uy, cx, cy, { color: th.negative, width: 12 });
  d.line(cx, cy, cx + 2.2 * ux, cy + 2.2 * uy, { color: th.positive, width: 12 });
  d.text("N", cx + 1.6 * ux, cy + 1.6 * uy, { size: 11, color: "#fff", weight: "700" });
  d.text(`Sequência ${T.tp.seq === 1 ? "A-B-C" : "A-C-B"}`, -16.5, 8.7, { size: 14, weight: "700", align: "left" });
  d.text(num(p, "f", 60) > 1 ? `f = ${fmt(num(p, "f", 60))} Hz (animação desacelerada)` : `f = ${fmt(num(p, "f", 60))} Hz`, -16.5, 7.9, { size: 11, align: "left", color: th.muted });
  // ligação em estrela até a carga
  const Ny = -5.2, Nx = -11.5;
  for (let k = 0; k < 3; k++) {
    const a = Math.PI / 2 + (k * TAU) / 3;
    const ex = Nx + 2.6 * Math.cos(a), ey = Ny + 2.6 * Math.sin(a);
    d.spring(Nx + 0.5 * Math.cos(a), Ny + 0.5 * Math.sin(a), ex, ey, { color: cols[k]!, width: 1.8, coils: 4, amplitudePx: 5 });
    d.line(Nx, Ny, Nx + 0.5 * Math.cos(a), Ny + 0.5 * Math.sin(a), { color: th.text, width: 1.5 });
    d.text(`${fmt(T.tp.R[k]!)} Ω`, ex + 0.3 * Math.cos(a), ey + 0.5 * Math.sin(a) - 0.2, { size: 10, color: cols[k]!, align: Math.cos(a) > 0.1 ? "left" : Math.cos(a) < -0.1 ? "right" : "center" });
  }
  d.dot(Nx, Ny, 4, th.text);
  d.text("N'", Nx + 0.4, Ny - 0.5, { size: 10, align: "left" });
  if (T.tp.neutral) d.line(Nx, Ny, cx, cy - R - 0.8, { color: th.muted, width: 1.5, dash: [5, 3] });
  d.text(T.tp.neutral ? "neutro ligado" : "sem neutro", Nx - 0.3, (Ny + cy - R) / 2, { size: 10, align: "right", color: th.muted });
  d.text("carga em estrela", Nx, -8.7, { size: 11, color: th.muted });

  // formas de onda (2 períodos, em fase com a animação)
  const box = { x0: -4.6, y0: 1.2, x1: 16.2, y1: 7.6 };
  const Vp = T.tp.Vf * Math.SQRT2;
  const pl = panel(d, box, { min: -720, max: 0 }, { min: -Vp * 1.15, max: Vp * 1.15 });
  pl.frame({ xlabel: "ωt (graus, relativo a agora)", ylabel: "tensão de fase (V)" });
  T.ph.V.forEach((X, k) => {
    pl.plot((deg) => inst(X, s.vis + (deg * Math.PI) / 180), -720, 0, { color: cols[k]!, width: 2, n: 240 });
    d.dot(pl.X(0), pl.Y(T.v[k]!), 4.5, cols[k]!);
  });
  d.text("v_A + v_B + v_C = 0 a cada instante", box.x0 + 0.2, box.y1 - 0.45, { size: 10, align: "left", color: th.muted });
  // fasores
  const fc = { x: -1.2, y: -4.3 }, fr = 3.6;
  d.circle(fc.x, fc.y, fr, { stroke: th.grid, width: 1 });
  const scaleV = fr / (T.tp.Vf * Math.SQRT2);
  const rotC = (X: { re: number; im: number }) => {
    const c = Math.cos(s.vis), sn = Math.sin(s.vis);
    return { re: (X.re * c - X.im * sn) * Math.SQRT2, im: (X.re * sn + X.im * c) * Math.SQRT2 };
  };
  T.ph.V.forEach((X, k) => {
    const r = rotC(X);
    d.arrow(fc.x, fc.y, r.im * scaleV, r.re * scaleV, { color: cols[k]!, width: 2.2 });
  });
  const Imax = Math.max(...T.ph.I.map((I) => Math.hypot(I.re, I.im)), 1e-9) * Math.SQRT2;
  const rN = rotC(T.ph.IN);
  if (Math.hypot(rN.re, rN.im) > 1e-6 * Imax) d.arrow(fc.x, fc.y, (rN.im / Imax) * fr * 0.8, (rN.re / Imax) * fr * 0.8, { color: th.text, width: 2, dash: [4, 3] });
  d.text("fasores girando (projeção vertical = valor instantâneo)", fc.x, fc.y - fr - 0.6, { size: 10, color: th.muted });
  // leituras
  const x = 4.2;
  const IN = Math.hypot(T.ph.IN.re, T.ph.IN.im);
  const VL = Math.hypot(T.ph.Vline[0]!.re, T.ph.Vline[0]!.im);
  const rows: [string, string][] = [
    ["V_fase (eficaz)", `${fmt(T.tp.Vf)} V`],
    ["V_linha = √3 V_fase", `${fmt(VL)} V`],
    ["I_A, I_B, I_C", T.ph.I.map((I) => fmt(Math.hypot(I.re, I.im))).join(" / ") + " A"],
    ["corrente no neutro", `${fmt(IN < 1e-9 ? 0 : IN)} A`],
    ["deslocamento do neutro", `${fmt(Math.hypot(T.ph.shift.re, T.ph.shift.im) < 1e-9 ? 0 : Math.hypot(T.ph.shift.re, T.ph.shift.im))} V`],
    ["potência total P", `${fmt(T.ph.P)} W`],
    ["potência instantânea", `${fmt(T.p3)} W`],
  ];
  rows.forEach(([k, v], i) => {
    d.text(k, x, -0.4 - i * 0.95, { size: 11, align: "left", color: th.muted });
    d.text(v, x + 6.4, -0.4 - i * 0.95, { size: 12, align: "left", weight: "600" });
  });
}

// ------------------------------------------------------------ desenho: Waltenhofen
const PSCALE = 36; // unidades de desenho por metro
const PIV = { A: [-8.5, 8.2] as [number, number], B: [6.5, 8.2] as [number, number] };
const plateCenter = (k: "A" | "B", th: number): [number, number] => [PIV[k][0] + PEND.ell * PSCALE * Math.sin(th), PIV[k][1] - PEND.ell * PSCALE * Math.cos(th)];

function drawWalt(d: Draw, p: Params, s: MGState, trail: MGState[]) {
  const th = d.theme;
  const B = num(p, "Bw", 0.3);
  for (const k of ["A", "B"] as const) {
    const st = s[k];
    const [px, py] = PIV[k];
    const [cx, cy] = plateCenter(k, st[0]);
    const half = PEND.wp * PSCALE;
    const hp = PEND.wm * PSCALE;
    const yb = py - PEND.ell * PSCALE;
    // polo do ímã atrás da placa
    if (B > 0) {
      d.rect(px - hp - 0.3, yb - hp - 0.3, 2 * hp + 0.6, 2 * hp + 0.6, { fill: th.positive, alpha: 0.35 + 0.5 * clamp(B, 0, 1) });
      d.text("N", px + hp + 0.6, yb - hp, { size: 11, weight: "700", color: th.positive });
    }
    d.line(px, py, cx, cy, { color: th.muted, width: 2 });
    d.dot(px, py, 4, th.text);
    const slotted = k === "B";
    d.box(cx, cy, 2 * half, 2 * half, st[0], { fill: "#b9c2cc", stroke: th.text, width: 1.2, alpha: 0.95 });
    if (slotted) {
      d.ctx.save();
      d.ctx.translate(cx, cy);
      d.ctx.rotate(st[0]);
      for (let j = -2; j <= 2; j++) d.line(j * half * 0.38, -half, j * half * 0.38, half * 0.55, { color: th.dark ? "#12161c" : "#ffffff", width: 3 });
      d.ctx.restore();
    }
    if (B > 0) d.rect(px - hp - 0.3, yb - hp - 0.3, 2 * hp + 0.6, 2 * hp + 0.6, { stroke: th.positive, width: 1.5, dash: [4, 3] });
    // correntes de Foucault: anéis na placa maciça enquanto está no campo
    const ov = overlapFrac(st[0]);
    if (!slotted && ov > 0.05 && Math.abs(st[1]) > 0.05 && B > 0) {
      for (const r of [0.35, 0.7]) d.circle(px + 0.4 * Math.sign(st[1]), yb, r * hp * 1.6, { stroke: th.series[3]!, width: 1.6, alpha: clamp(Math.abs(st[1]) / 3, 0.2, 1) });
    }
    d.text(slotted ? "B: placa com fendas" : "A: placa maciça", px, py + 0.7, { size: 12, weight: "700" });
    d.text(`θ = ${fmt((st[0] * 180) / Math.PI)}°   amplitude ${fmt((st[3] * 180) / Math.PI)}°`, px, yb - hp - 1.2, { size: 11 });
    d.text(`calor dissipado ${fmt(st[2] * 1e3)} mJ`, px, yb - hp - 2, { size: 10, color: th.muted });
  }
  // θ(t) dos dois pêndulos
  const box = { x0: -16, y0: -9, x1: 16.2, y1: -6.4 };
  const pts = trail.slice(-600);
  const t0 = pts.length;
  const pl = panel(d, box, { min: -t0, max: 0 }, { min: -Math.PI / 2, max: Math.PI / 2 });
  pl.frame({ xticks: [], yticks: [-Math.PI / 2, 0, Math.PI / 2], fy: (v) => `${Math.round((v * 180) / Math.PI)}°` });
  pl.line(pts.map((q, i) => [i - t0, q.A[0]]), { color: th.series[0]!, width: 1.8 });
  pl.line(pts.map((q, i) => [i - t0, q.B[0]]), { color: th.series[1]!, width: 1.8 });
  d.text("θ(t): maciça (azul) × com fendas (laranja)", box.x0 + 0.2, box.y1 + 0.4, { size: 10, align: "left", color: th.muted });
  d.text("arraste uma placa para soltá-la de outro ângulo", 16.2, box.y1 + 0.4, { size: 10, align: "right", color: th.accent });
}
const overlapFrac = (th: number) => {
  const sx = PEND.ell * th;
  return Math.max(0, Math.min(sx + PEND.wp, PEND.wm) - Math.max(sx - PEND.wp, -PEND.wm)) / (2 * PEND.wm);
};

// ------------------------------------------------------------ simulação
export const motoresGeradores = defineSim<MGState>({
  id: "motores-geradores",
  title: "Motores e geradores: DC, Faraday, dínamo e trifásico",
  course: "FG III",
  topic: "Indução",
  priority: "P2",
  summary:
    "Motor DC com força contraeletromotriz e característica torque × rotação, disco e motor de Faraday (homopolares), dínamo × alternador lado a lado, gerador trifásico em estrela com fasores e corrente de neutro, e o pêndulo de Waltenhofen freado por correntes de Foucault.",
  equations: [
    String.raw`V = R i + k\omega \qquad \tau = k i \qquad \omega_{reg} = \frac{V}{k} - \frac{R}{k^2}\tau_L`,
    String.raw`\varepsilon_{disco} = \tfrac12 B\omega a^2 \qquad \varepsilon = NBA\omega\sin\omega t \qquad \bar V_{dínamo} = \tfrac{2}{\pi}\varepsilon_{máx}`,
    String.raw`v_k = \sqrt2 V_f \cos(\omega t \mp k\cdot 120^\circ) \qquad V_L = \sqrt3\,V_f \qquad i_N = i_A + i_B + i_C`,
    String.raw`I\ddot\theta = -mg\ell\sin\theta - c(\theta)\dot\theta \qquad c \approx \alpha\,\sigma\delta B^2 A_{polo}\,\ell^2`,
  ],
  liveEquations(s, p) {
    const m = modo(p);
    if (m === 0) {
      const mp = dcMotor(p);
      const M = machine(s, p);
      return [
        String.raw`${texNum(mp.V)}\ \text{V} = ${texNum(mp.R)}\cdot ${texNum(M.i)}\ \text{A} + ${texNum(M.fem)}\ \text{V}`,
        String.raw`\omega_{reg} = ${texNum(steadyOmega(mp))}\ \text{rad/s} = ${texNum(rpm(steadyOmega(mp)))}\ \text{rpm}`,
      ];
    }
    if (m === 1) {
      const h = homo(p);
      return [String.raw`\varepsilon = k\omega = ${texNum(h.k * 1e3)}\ \text{mV·s} \times ${texNum(s.w)}\ \text{rad/s} = ${texNum(h.k * s.w * 1e3)}\ \text{mV}`];
    }
    if (m === 2) {
      const e0 = Math.abs(E0(p, s.w));
      return [String.raw`\varepsilon_{máx} = NBA\omega = ${texNum(e0)}\ \text{V} \quad V_{ef} = ${texNum(e0 / Math.SQRT2)}\ \text{V} \quad \bar V_{dínamo} = ${texNum(dynamoMean(e0, coilParams(p).m))}\ \text{V}`];
    }
    if (m === 3) {
      const T = three(s, p);
      return [
        String.raw`V_L = \sqrt3\cdot ${texNum(T.tp.Vf)} = ${texNum(Math.hypot(T.ph.Vline[0]!.re, T.ph.Vline[0]!.im))}\ \text{V} \quad I_N = ${texNum(Math.hypot(T.ph.IN.re, T.ph.IN.im))}\ \text{A} \quad P = ${texNum(T.ph.P)}\ \text{W}`,
      ];
    }
    const a = pendulum(p, false);
    return [String.raw`c_{máx} = ${texNum(brakeC(a, 0) * 1e3)}\ \text{mN·m·s} \quad \text{(fendas: } ${texNum(brakeC(pendulum(p, true), 0) * 1e3)}\ \text{mN·m·s)}`];
  },
  params: [
    { key: "modo", label: "Experimento", unit: "", min: 0, max: MODOS.length - 1, step: 1, default: 0, options: MODOS.map((label, value) => ({ value, label })) },
    { key: "V", label: "Tensão da fonte (motores)", unit: "V", min: 0, max: 12, step: 0.1, default: 6, live: true },
    { key: "R", label: "Resistência do enrolamento", unit: "Ω", min: 0.2, max: 10, step: 0.1, default: 2, live: true },
    { key: "k", label: "Constante do motor k", unit: "mV·s/rad", min: 5, max: 60, step: 1, default: 20, live: true },
    { key: "carga", label: "Torque de carga", unit: "mN·m", min: 0, max: 50, step: 0.5, default: 0, live: true },
    { key: "bobinas", label: "Bobinas no rotor", unit: "", min: 1, max: 6, step: 1, default: 3, live: true },
    {
      key: "disp",
      label: "Dispositivo homopolar",
      unit: "",
      min: 0,
      max: 2,
      step: 1,
      default: 0,
      options: [
        { value: 0, label: "Disco de Faraday (gerador)" },
        { value: 1, label: "Roda de Barlow (disco motor)" },
        { value: 2, label: "Motor de Faraday (fio no mercúrio)" },
      ],
    },
    { key: "B", label: "Campo magnético B", unit: "T", min: 0.05, max: 1.5, step: 0.01, default: 0.5, live: true },
    { key: "a", label: "Raio do disco / lado da bobina", unit: "cm", min: 2, max: 20, step: 0.5, default: 10, live: true },
    { key: "rpm", label: "Rotação imposta (geradores)", unit: "rpm", min: 10, max: 600, step: 1, default: 120, live: true },
    { key: "RL", label: "Carga do gerador", unit: "Ω", min: 1, max: 10000, step: 1, default: 100, log: true, live: true },
    { key: "N", label: "Espiras da bobina", unit: "", min: 10, max: 1000, step: 10, default: 200, live: true },
    { key: "Vf", label: "Tensão de fase (eficaz)", unit: "V", min: 10, max: 240, step: 1, default: 127, live: true },
    { key: "f", label: "Frequência do gerador", unit: "Hz", min: 0.2, max: 60, step: 0.1, default: 60, live: true },
    { key: "seq", label: "Sentido de rotação", unit: "", min: -1, max: 1, step: 2, default: 1, live: true, options: [{ value: 1, label: "Sequência A-B-C" }, { value: -1, label: "Sequência A-C-B (invertido)" }] },
    { key: "Ra", label: "Carga da fase A", unit: "Ω", min: 5, max: 500, step: 1, default: 50, log: true, live: true },
    { key: "Rb", label: "Carga da fase B", unit: "Ω", min: 5, max: 500, step: 1, default: 50, log: true, live: true },
    { key: "Rc", label: "Carga da fase C", unit: "Ω", min: 5, max: 500, step: 1, default: 50, log: true, live: true },
    { key: "neutro", label: "Fio neutro", unit: "", min: 0, max: 1, step: 1, default: 1, live: true, options: [{ value: 1, label: "Ligado" }, { value: 0, label: "Desligado" }] },
    { key: "Bw", label: "Campo no entreferro (pêndulo)", unit: "T", min: 0, max: 1, step: 0.01, default: 0.3, live: true },
    { key: "material", label: "Material da placa", unit: "", min: 0, max: 2, step: 1, default: 0, live: true, options: MATERIAIS.map((m, value) => ({ value, label: m.nome })) },
    { key: "esp", label: "Espessura da placa", unit: "mm", min: 0.5, max: 5, step: 0.1, default: 2, live: true },
    { key: "theta0", label: "Ângulo de soltura", unit: "°", min: 5, max: 80, step: 1, default: 45 },
  ],
  observables: [
    { key: "rpm", label: "Rotação do eixo", unit: "rpm", value: (s) => rpm(s.w) },
    { key: "omega", label: "Velocidade angular ω", unit: "rad/s", value: (s) => s.w },
    { key: "i", label: "Corrente na armadura / circuito", unit: "A", value: (s, p) => machine(s, p).i },
    { key: "fem", label: "Fem (fcem no motor)", unit: "V", value: (s, p) => machine(s, p).fem },
    { key: "tau", label: "Torque eletromagnético", unit: "N·m", value: (s, p) => machine(s, p).tau },
    { key: "eta", label: "Rendimento", unit: "%", value: (s, p) => machine(s, p).eta },
    { key: "vAlt", label: "Saída do alternador", unit: "V", value: (s, p) => (modo(p) === 2 ? Math.abs(E0(p, s.w)) * Math.sin(s.th) * Math.sign(s.w || 1) : 0) },
    { key: "vDin", label: "Saída do dínamo", unit: "V", value: (s, p) => (modo(p) === 2 ? dynamoOut(Math.abs(E0(p, s.w)), s.th, coilParams(p).m) : 0) },
    { key: "va", label: "Tensão da fase A", unit: "V", value: (s, p) => (modo(p) === 3 ? three(s, p).v[0]! : 0) },
    { key: "vb", label: "Tensão da fase B", unit: "V", value: (s, p) => (modo(p) === 3 ? three(s, p).v[1]! : 0) },
    { key: "vc", label: "Tensão da fase C", unit: "V", value: (s, p) => (modo(p) === 3 ? three(s, p).v[2]! : 0) },
    { key: "iN", label: "Corrente no neutro (instantânea)", unit: "A", value: (s, p) => (modo(p) === 3 ? three(s, p).iN : 0) },
    { key: "VL", label: "Tensão de linha eficaz", unit: "V", value: (_s, p) => Math.hypot(starPhasors(threePhase(p)).Vline[0]!.re, starPhasors(threePhase(p)).Vline[0]!.im) },
    { key: "P3", label: "Potência trifásica instantânea", unit: "W", value: (s, p) => (modo(p) === 3 ? three(s, p).p3 : 0) },
    { key: "thA", label: "Ângulo da placa maciça", unit: "°", value: (s) => (s.A[0] * 180) / Math.PI },
    { key: "thB", label: "Ângulo da placa com fendas", unit: "°", value: (s) => (s.B[0] * 180) / Math.PI },
    { key: "ampA", label: "Amplitude equivalente (maciça)", unit: "°", value: (s) => (s.A[3] * 180) / Math.PI },
    { key: "ampB", label: "Amplitude equivalente (com fendas)", unit: "°", value: (s) => (s.B[3] * 180) / Math.PI },
    { key: "EtotA", label: "Energia mecânica + calor (maciça)", unit: "J", value: (s, p) => (modo(p) === 4 ? totalE(pendulum(p, false), s.A) : 0) },
  ],
  conserved: "EtotA",
  chart: { x: "t", y: "rpm" },
  scenarios: [
    {
      id: "motor-carga",
      label: "Motor DC: fcem, partida e carga",
      params: { modo: 0, V: 6, R: 2, k: 20, carga: 0, bobinas: 3 },
      guide: `### Por que o motor não dispara
1. Na partida $\\omega = 0$: não há fcem e a corrente é enorme, $i = V/R$ (veja o pico no gráfico de corrente).
2. Conforme acelera, a bobina corta as linhas de B e gera a **força contraeletromotriz** $\\varepsilon = k\\omega$, que se opõe à fonte: $i = (V - k\\omega)/R$ cai.
3. Em vazio o motor gira quase em $\\omega_0 = V/k$, onde $\\varepsilon \\approx V$.
4. Aumente o **torque de carga**: a rotação cai sobre a reta $\\omega = V/k - R\\tau/k^2$, a corrente sobe e o rendimento passa por um máximo.
5. Troque para 1 bobina: o torque pulsa como $|\\sin\\theta|$; com mais bobinas e segmentos ele fica quase constante.
6. Compare com o **disco de Faraday** (Experimento homopolar): um motor sem comutador.`,
      predict: [
        {
          question: "Você segura o eixo de um motor ligado e ele quase para. A corrente na bobina...",
          options: ["cai, porque o motor não está trabalhando", "sobe muito, porque a fcem some", "fica igual", "inverte de sentido"],
          answer: 1,
          explanation: "Sem rotação não há fcem: toda a tensão da fonte cai na resistência, $i \\to V/R$. É por isso que motores travados esquentam e queimam.",
        },
      ],
    },
    {
      id: "dinamo-alternador",
      label: "Dínamo × alternador",
      params: { modo: 2, rpm: 120, B: 0.5, N: 200, a: 10, bobinas: 1 },
      guide: `### Mesma bobina, duas saídas
1. As duas máquinas giram juntas (arraste a manivela ou use a rotação imposta). A fem em cada bobina é $\\varepsilon = NBA\\omega\\sin\\omega t$.
2. No **alternador**, anéis coletores levam essa fem à saída: tensão alternada, com $V_{ef} = \\varepsilon_{máx}/\\sqrt2$.
3. No **dínamo**, o comutador inverte a ligação a cada meia volta: a saída é $|\\varepsilon|$, de média $2\\varepsilon_{máx}/\\pi$.
4. Aumente o número de bobinas do dínamo: a ondulação diminui e a média se aproxima de $\\varepsilon_{máx}$.
5. Gire a manivela mais depressa: amplitude **e** frequência crescem juntas (ambas ∝ ω).`,
      predict: [
        {
          question: "Dobrando a rotação do gerador, a tensão de pico da saída...",
          options: ["dobra", "fica igual (só a frequência muda)", "quadruplica", "cai à metade"],
          answer: 0,
          explanation: "$\\varepsilon_{máx} = NBA\\omega$: o fluxo varia duas vezes mais depressa, então a fem dobra, assim como a frequência.",
        },
      ],
    },
    {
      id: "trifasico",
      label: "Gerador trifásico e neutro",
      params: { modo: 3, Vf: 127, f: 60, seq: 1, Ra: 50, Rb: 50, Rc: 50, neutro: 1 },
      guide: `### Três fases a 120°
1. Três bobinas a 120° no estator geram $v_A, v_B, v_C$ defasadas de 120°. A ordem em que atingem o pico é a **sequência de fases**; inverter a rotação troca A-B-C por A-C-B.
2. Na ligação em estrela, a tensão entre duas fases é $V_L = \\sqrt3 V_f$: 127 V de fase dão 220 V de linha.
3. Com cargas iguais, $i_A + i_B + i_C = 0$: a corrente no neutro é **zero** e a potência instantânea total é **constante**.
4. Desequilibre a carga (mude $R_a$): aparece corrente no neutro. Agora desligue o neutro: o centro da estrela se desloca e as fases ficam com tensões diferentes — perigoso para os aparelhos.`,
      predict: [
        {
          question: "Com as três cargas iguais, qual é a corrente no fio neutro?",
          options: ["Zero", "A soma das três correntes eficazes", "√3 vezes a corrente de fase", "Igual à corrente de uma fase"],
          answer: 0,
          explanation: "As três correntes têm a mesma amplitude e estão defasadas de 120°: os fasores somam zero a cada instante. Por isso redes equilibradas podem usar neutro fino.",
        },
      ],
    },
    {
      id: "waltenhofen",
      label: "Pêndulo de Waltenhofen",
      params: { modo: 4, Bw: 0.3, material: 0, esp: 2, theta0: 45 },
      guide: `### Freio por correntes de Foucault
1. Duas placas de alumínio oscilam entre os polos de um ímã. Ao entrar no campo, o fluxo na placa varia e surgem **correntes parasitas** (de Foucault) que, pela lei de Lenz, freiam o movimento.
2. A placa **maciça** para em poucas oscilações; a placa **com fendas** quase não é freada, porque as fendas interrompem os grandes laços de corrente.
3. A energia mecânica perdida vira calor: confira que energia + calor dissipado se mantém constante.
4. Zere o campo: as duas oscilam igualmente. Troque para cobre (σ maior): a frenagem aumenta.
5. Mude a espessura: o torque de frenagem cresce com δ, mas a massa também, e o decaimento quase não muda.`,
      predict: [
        {
          question: "Qual pêndulo para primeiro?",
          options: ["A placa maciça", "A placa com fendas", "Os dois juntos", "Nenhum, o ímã não atua sobre alumínio"],
          answer: 0,
          explanation: "O alumínio não é atraído pelo ímã, mas é condutor: a variação de fluxo induz correntes que dissipam energia. As fendas cortam os caminhos dessas correntes e reduzem muito a frenagem.",
        },
      ],
    },
  ],
  exercises: [
    {
      id: "disco-faraday",
      prompt: "Um disco de cobre de raio {a} cm gira a {rpm} rpm num campo axial de {B} T. Qual é a fem entre o eixo e a borda, em mV?",
      vary: { a: [5, 20, 0], rpm: [100, 600, 0], B: [0.1, 1.2, 2] },
      fixed: { modo: 1, disp: 0 },
      answer: { label: "ε", unit: "mV", compute: (p) => 0.5 * num(p, "B") * ((num(p, "rpm") * TAU) / 60) * (num(p, "a") / 100) ** 2 * 1e3 },
      hint: "ε = ½ B ω a², com ω em rad/s e a em metros.",
    },
    {
      id: "motor-regime",
      prompt: "Um motor DC tem k = {k} mV·s/rad e resistência R = {R} Ω e é ligado a {V} V. Desprezando o atrito, qual é sua rotação com torque de carga {carga} mN·m, em rad/s?",
      vary: { k: [10, 40, 0], R: [0.5, 4, 1], V: [3, 12, 0], carga: [0, 10, 1] },
      fixed: { modo: 0 },
      answer: { label: "ω", unit: "rad/s", compute: (p) => Math.max(0, (num(p, "V") - (num(p, "R") * num(p, "carga") * 1e-3) / (num(p, "k") * 1e-3)) / (num(p, "k") * 1e-3)) },
      hint: "Em regime τ = k i = τ_L, então i = τ_L/k e ω = (V − R i)/k.",
    },
    {
      id: "linha",
      prompt: "Um gerador trifásico em estrela tem tensão de fase de {Vf} V (eficaz). Qual é a tensão de linha, em volts?",
      vary: { Vf: [100, 240, 0] },
      fixed: { modo: 3 },
      answer: { label: "V_L", unit: "V", compute: (p) => Math.sqrt(3) * num(p, "Vf") },
    },
  ],

  init: (p) => {
    const th0 = (num(p, "theta0", 45) * Math.PI) / 180;
    return { th: 0.3, w: 0, vis: 0.3, A: [th0, 0, 0, th0], B: [th0, 0, 0, th0], crank: null, drag: null };
  },
  step,
  dt: 1e-3,
  sampleEvery: 10,

  viewport: () => ({ ...VIEW, unit: "" }),
  render(ctx, frame) {
    const d = draw(ctx, frame);
    const { state: s, params: p } = frame;
    switch (modo(p)) {
      case 0:
        return drawMotor(d, p, s);
      case 1:
        return drawHomo(d, p, s);
      case 2:
        return drawDynamo(d, p, s);
      case 3:
        return drawThree(d, p, s);
      default:
        return drawWalt(d, p, s, frame.trail);
    }
  },

  pointer: {
    down(s, p, pt) {
      const m = modo(p);
      if (m === 2 && Math.hypot(pt.x - CRANK.x, pt.y - CRANK.y) < CRANK.r + 0.8) return { ...s, drag: "crank", crank: Math.atan2(pt.y - CRANK.y, pt.x - CRANK.x) };
      if (m === 4)
        for (const k of ["A", "B"] as const) {
          const [cx, cy] = plateCenter(k, s[k][0]);
          if (Math.hypot(pt.x - cx, pt.y - cy) < 2) return { ...s, drag: k };
        }
      return undefined;
    },
    move(s, p, pt, dragging) {
      if (!dragging || !s.drag) return undefined;
      if (s.drag === "crank") return { ...s, crank: Math.atan2(pt.y - CRANK.y, pt.x - CRANK.x) };
      const k = s.drag;
      const th = clamp(Math.atan2(pt.x - PIV[k][0], PIV[k][1] - pt.y), -1.4, 1.4);
      return { ...s, [k]: [th, 0, s[k][2], Math.abs(th)] };
    },
    up: (s) => (s.drag ? { ...s, drag: null, crank: null } : undefined),
    cursor(s, p, pt) {
      const m = modo(p);
      if (m === 2 && Math.hypot(pt.x - CRANK.x, pt.y - CRANK.y) < CRANK.r + 0.8) return "grab";
      if (m === 4)
        for (const k of ["A", "B"] as const) {
          const [cx, cy] = plateCenter(k, s[k][0]);
          if (Math.hypot(pt.x - cx, pt.y - cy) < 2) return "grab";
        }
      return undefined;
    },
  },
});

export default motoresGeradores;
