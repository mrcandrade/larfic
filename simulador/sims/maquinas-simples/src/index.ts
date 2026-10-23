import { clamp, defineSim, deg, draw, num, rad, texNum, type Params } from "@fisilab/core";

/**
 * Máquinas simples. Todos os modos (exceto a alavanca e o governador) usam a
 * mesma coordenada generalizada: a altura y da carga. A mão (ou a manivela)
 * se desloca k vezes mais que a carga, com k = vantagem mecânica ideal, e as
 * peças móveis (roldanas) andam com velocidades r_i·ẏ. Daí
 *   M_ef ÿ = k F − g Σ m_i r_i,   M_ef = Σ m_i r_i²,
 * e o trabalho da mão é W = F·s = F·k·Δy.
 */
export interface MS {
  /** Alavanca: ângulo da barra (rad), velocidade angular, posições ao longo da barra (m). */
  th: number;
  om: number;
  xp: number;
  xc: number;
  xe: number;
  locked: boolean;
  /** Máquinas: altura da carga, velocidade, trabalho da mão, energia dissipada em batidas. */
  y: number;
  v: number;
  W: number;
  Q: number;
  /** A mão segura a carga parada (depois de arrastar). */
  hold: boolean;
  /** Governador: ângulo dos braços, velocidade angular dos braços, rotação do eixo, fase do eixo. */
  gth: number;
  gom: number;
  w: number;
  phi: number;
  drag: "" | "xp" | "xc" | "xe" | "mao";
  /** Última posição do ponteiro (arrasto incremental). */
  px: number;
  py: number;
}

export const MODES = [
  "Alavanca (arraste apoio, carga e força)",
  "Roldana fixa",
  "Roldana móvel",
  "Talha (moitão com n segmentos)",
  "Talha exponencial (n roldanas móveis)",
  "Sarilho (manivela e tambor)",
  "Macaco de parafuso",
  "Governador centrífugo de Watt",
] as const;

export const modo = (p: Params) => Math.round(num(p, "modo"));
const G = (p: Params) => num(p, "g", 9.8);
const BEAM = 3; // meia-largura da barra (m)
const HP = 1; // altura do apoio (m)
const TH_MAX = Math.asin((HP - 0.05) / (2 * BEAM));

// ------------------------------------------------------------------ alavanca

/** Força vertical (com sinal, + para cima) que zera o torque resultante. */
export function leverFreq(s: Pick<MS, "xp" | "xc" | "xe">, p: Params): number {
  const de = s.xe - s.xp;
  if (Math.abs(de) < 1e-6) return NaN;
  return (num(p, "m", 30) * G(p) * (s.xc - s.xp) - num(p, "Mb", 0) * G(p) * s.xp) / de;
}
export function leverFy(s: MS, p: Params): number {
  const req = leverFreq(s, p);
  const dir = Number.isFinite(req) && req < 0 ? -1 : 1;
  return dir * num(p, "F", 147);
}
/** Torque resultante (anti-horário positivo) em torno do apoio. */
export function leverTorque(s: MS, p: Params, th = s.th): number {
  const g = G(p);
  return Math.cos(th) * (-num(p, "m", 30) * g * (s.xc - s.xp) + num(p, "Mb", 0) * g * s.xp + leverFy(s, p) * (s.xe - s.xp));
}
function leverInertia(s: MS, p: Params): number {
  const Mb = num(p, "Mb", 0);
  return Mb * ((2 * BEAM) ** 2 / 12 + s.xp ** 2) + num(p, "m", 30) * (s.xc - s.xp) ** 2 + 0.5;
}
export function leverClass(s: MS): 1 | 2 | 3 {
  const between = (a: number, b: number, c: number) => (a - b) * (a - c) <= 0;
  if (between(s.xp, s.xc, s.xe)) return 1;
  if (between(s.xc, s.xp, s.xe)) return 2;
  return 3;
}
const CLASS_LABEL = { 1: "1ª classe — interfixa (apoio no meio)", 2: "2ª classe — inter-resistente (carga no meio)", 3: "3ª classe — interpotente (força no meio)" };

// ------------------------------------------------------------- roldanas etc.

export interface Config {
  /** Vantagem mecânica ideal: deslocamento da mão / deslocamento da carga. */
  k: number;
  /** Peças que sobem: [massa, razão de velocidade em relação à carga]. */
  movers: [number, number][];
  yMax: number;
}
export function nPulleys(p: Params): number {
  return modo(p) === 4 ? clamp(Math.round(num(p, "n", 2)), 1, 4) : clamp(Math.round(num(p, "n", 4)), 2, 6);
}
const EXP_H0 = (j: number) => 0.9 + 0.65 * (j - 1);
export function config(p: Params): Config {
  const m = num(p, "m", 30);
  const mp = num(p, "mp", 0);
  switch (modo(p)) {
    case 1:
      return { k: 1, movers: [[m, 1]], yMax: 2.6 };
    case 2:
      return { k: 2, movers: [[m + mp, 1]], yMax: 2.2 };
    case 3: {
      const n = nPulleys(p);
      return { k: n, movers: [[m + mp * Math.max(1, Math.floor(n / 2)), 1]], yMax: 2.0 };
    }
    case 4: {
      const n = nPulleys(p);
      const movers: [number, number][] = [[m, 1]];
      let yMax = 2.2;
      for (let j = 1; j <= n; j++) {
        movers.push([mp, 2 ** (j - 1)]);
        yMax = Math.min(yMax, (3.55 - EXP_H0(j)) / 2 ** (j - 1));
      }
      return { k: 2 ** n, movers, yMax };
    }
    case 5:
      return { k: num(p, "R", 0.4) / num(p, "r", 0.08), movers: [[m, 1]], yMax: 1.6 };
    case 6:
      return { k: (2 * Math.PI * num(p, "R", 0.4)) / (num(p, "passo", 5) / 1000), movers: [[m, 1]], yMax: 0.25 };
    default:
      return { k: 1, movers: [[m, 1]], yMax: 1 };
  }
}
export function machineFeq(p: Params): number {
  const c = config(p);
  return (G(p) * c.movers.reduce((a, [mi, ri]) => a + mi * ri, 0)) / c.k;
}
const machineMeff = (c: Config) => c.movers.reduce((a, [mi, ri]) => a + mi * ri * ri, 0) + 1e-3;
export const appliedF = (s: MS, p: Params) => (modo(p) === 0 ? num(p, "F", 147) : modo(p) === 7 ? 0 : s.hold ? machineFeq(p) : num(p, "F", 147));
const machineK = (s: MS, p: Params) => 0.5 * machineMeff(config(p)) * s.v * s.v;
const machineU = (s: MS, p: Params) => G(p) * config(p).movers.reduce((a, [mi, ri]) => a + mi * ri, 0) * s.y;

// ------------------------------------------------------------------ governador

const ARM = (p: Params) => num(p, "L", 0.3);
const OFF = 0.04; // afastamento da articulação em relação ao eixo (m)
const TH1 = rad(25);
const TH2 = rad(55);
export const valve = (th: number) => clamp((TH2 - th) / (TH2 - TH1), 0, 1);
/** Ângulo de equilíbrio dos braços: ω²(a + L sen θ) cos θ = g sen θ. */
export function thetaEq(w: number, L: number, g = 9.8, a = OFF): number {
  const f = (t: number) => w * w * (a + L * Math.sin(t)) * Math.cos(t) - g * Math.sin(t);
  let lo = 1e-9;
  let hi = Math.PI / 2;
  if (f(lo) <= 0) return 0;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (f(mid) > 0) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}
const GOV_I = 2; // momento de inércia do volante (kg·m²)
const GOV_TMAX = 30; // torque máximo do motor com a válvula toda aberta (N·m)
const GOV_C = 2; // atrito viscoso (N·m·s)
const rpm2w = (r: number) => (r * 2 * Math.PI) / 60;

// ------------------------------------------------------------------ simulação

function initial(p: Params): MS {
  const md = modo(p);
  const w0 = md === 7 ? (Math.round(num(p, "reg")) === 1 ? rpm2w(30) : rpm2w(num(p, "rpm", 60))) : 0;
  return {
    th: 0,
    om: 0,
    xp: num(p, "xp0", 0),
    xc: -1,
    xe: 2,
    locked: false,
    y: 0,
    v: 0,
    W: 0,
    Q: 0,
    hold: false,
    gth: md === 7 ? thetaEq(w0, ARM(p), G(p)) : 0,
    gom: 0,
    w: w0,
    phi: 0,
    drag: "",
    px: 0,
    py: 0,
  };
}

function stepLever(s: MS, p: Params, dt: number): MS {
  if (s.locked || s.drag) return { ...s, th: 0, om: 0 };
  const I = leverInertia(s, p);
  const c = 0.6 * Math.sqrt(I); // amortecimento leve
  const f = (th: number, om: number): [number, number] => [om, leverTorque(s, p, th) / I - (c / I) * om];
  const [a1, b1] = f(s.th, s.om);
  const [a2, b2] = f(s.th + (dt / 2) * a1, s.om + (dt / 2) * b1);
  const [a3, b3] = f(s.th + (dt / 2) * a2, s.om + (dt / 2) * b2);
  const [a4, b4] = f(s.th + dt * a3, s.om + dt * b3);
  let th = s.th + (dt / 6) * (a1 + 2 * a2 + 2 * a3 + a4);
  let om = s.om + (dt / 6) * (b1 + 2 * b2 + 2 * b3 + b4);
  if (Math.abs(th) >= TH_MAX) {
    th = Math.sign(th) * TH_MAX;
    om = 0; // a ponta da barra bate no chão
  }
  return { ...s, th, om };
}

function stepMachine(s: MS, p: Params, dt: number): MS {
  if (s.hold || s.drag) return { ...s, v: 0 };
  const c = config(p);
  const F = appliedF(s, p);
  const a = (c.k * F - G(p) * c.movers.reduce((acc, [mi, ri]) => acc + mi * ri, 0)) / machineMeff(c);
  if (s.y <= 0 && s.v <= 0 && a <= 0) return { ...s, y: 0, v: 0 };
  if (s.y >= c.yMax && s.v >= 0 && a >= 0) return { ...s, y: c.yMax, v: 0 };
  // força constante no passo: cinemática exata
  let y = s.y + s.v * dt + 0.5 * a * dt * dt;
  let v = s.v + a * dt;
  let Q = s.Q;
  const yC = clamp(y, 0, c.yMax);
  if (yC !== y) {
    // chegou ao chão ou ao topo dentro do passo: a energia cinética vira calor na batida
    const vHit = Math.sqrt(Math.max(0, s.v * s.v + 2 * a * (yC - s.y)));
    Q += 0.5 * machineMeff(c) * vHit * vHit;
    y = yC;
    v = 0;
  }
  return { ...s, y, v, Q, W: s.W + F * c.k * (y - s.y) };
}

function stepGovernor(s: MS, p: Params, dt: number): MS {
  const g = G(p);
  const L = ARM(p);
  const auto = Math.round(num(p, "reg")) === 1;
  let w = s.w;
  if (auto) {
    const dw = (GOV_TMAX * valve(s.gth) - num(p, "carga", 6) - GOV_C * w) / GOV_I;
    w = Math.max(0, w + dw * dt);
  } else {
    w += ((rpm2w(num(p, "rpm", 60)) - w) / 0.8) * dt;
  }
  const gam = num(p, "gam", 8);
  const acc = (th: number, om: number) => (w * w * (OFF + L * Math.sin(th)) * Math.cos(th) - g * Math.sin(th)) / L - gam * om;
  // Verlet de velocidade com amortecimento
  const a0 = acc(s.gth, s.gom);
  let th = s.gth + s.gom * dt + 0.5 * a0 * dt * dt;
  let om = s.gom + 0.5 * (a0 + acc(th, s.gom + a0 * dt)) * dt;
  if (th < 0) {
    th = 0;
    om = Math.max(0, om);
  }
  if (th > rad(80)) {
    th = rad(80);
    om = Math.min(0, om);
  }
  return { ...s, w, gth: th, gom: om, phi: (s.phi + w * dt) % (2 * Math.PI) };
}

// ------------------------------------------------------------------ ponteiro

const beamPoint = (s: MS, u: number): [number, number] => [s.xp + (u - s.xp) * Math.cos(s.th), HP + (u - s.xp) * Math.sin(s.th)];
const snap = (u: number) => clamp(Math.round(u * 10) / 10, -BEAM, BEAM);

function handPos(s: MS, p: Params): [number, number] {
  const md = modo(p);
  const c = config(p);
  if (md === 5) {
    const ang = (s.y * c.k) / num(p, "R", 0.4);
    return [num(p, "R", 0.4) * Math.cos(ang), 2.4 + num(p, "R", 0.4) * Math.sin(ang)];
  }
  if (md === 6) return [0, 0];
  const top = 3.0;
  const travel = c.k * s.y;
  return [handX(p), top - (travel % 2.6)];
}
function handX(p: Params): number {
  const md = modo(p);
  if (md === 1) return 0.22;
  if (md === 2) return 0.62;
  if (md === 3) return 0.62;
  return 0.18 * (nPulleys(p) + 2);
}

export const maquinasSimples = defineSim<MS>({
  id: "maquinas-simples",
  title: "Máquinas simples: alavancas, roldanas, talhas e governador de Watt",
  course: "FG I",
  topic: "Estática",
  priority: "P2",
  summary:
    "Alavancas das três classes com apoio, carga e força arrastáveis; roldanas, talhas, sarilho e parafuso com a mão que puxa a corda e o balanço trabalho = energia; e o governador centrífugo de Watt regulando um motor.",
  equations: [
    String.raw`\text{alavanca: } \sum \tau = 0 \;\Rightarrow\; F\,d_F = P\,d_P \qquad VM = \frac{d_F}{d_P}`,
    String.raw`\text{talha: } F = \frac{P}{n} \qquad s = n\,h \qquad W_F = F\,s = P\,h`,
    String.raw`\text{sarilho: } F R = P r \qquad \text{parafuso: } F \cdot 2\pi R = P\,p`,
    String.raw`\text{Watt: } \omega^2 (a + L\,\sin\theta)\cos\theta = g\,\sin\theta \;\;(a=0:\ \cos\theta = g/\omega^2 L)`,
  ],
  liveEquations(s, p) {
    const md = modo(p);
    const g = G(p);
    if (md === 0) {
      const dP = s.xc - s.xp;
      const dF = s.xe - s.xp;
      const Fy = leverFy(s, p);
      return [
        String.raw`\tau_P = -${texNum(num(p, "m", 30) * g)}\cdot(${texNum(dP)}) = ${texNum(-num(p, "m", 30) * g * dP)}\ \text{N·m} \qquad \tau_F = ${texNum(Fy)}\cdot(${texNum(dF)}) = ${texNum(Fy * dF)}\ \text{N·m}`,
        String.raw`\sum\tau = ${texNum(leverTorque(s, p))}\ \text{N·m} \qquad F_{eq} = ${texNum(Math.abs(leverFreq(s, p)))}\ \text{N} \qquad VM = ${texNum(Math.abs(dF / (dP || 1e-9)))}`,
      ];
    }
    if (md === 7) {
      const L = ARM(p);
      return [
        String.raw`\omega = ${texNum(s.w)}\ \text{rad/s} \;(${texNum((s.w * 60) / (2 * Math.PI))}\ \text{rpm}) \qquad \theta = ${texNum(deg(s.gth))}^\circ \qquad \theta_{eq} = ${texNum(deg(thetaEq(s.w, L, g)))}^\circ`,
        String.raw`\text{válvula} = ${texNum(100 * valve(s.gth))}\,\% \qquad \text{altura do anel: } ${texNum(2 * L * (1 - Math.cos(s.gth)) * 100)}\ \text{cm}`,
      ];
    }
    const c = config(p);
    const F = appliedF(s, p);
    return [
      String.raw`VM = ${texNum(c.k)} \qquad F = ${texNum(F)}\ \text{N} \qquad F_{eq} = ${texNum(machineFeq(p))}\ \text{N}`,
      String.raw`s = ${texNum(c.k)}\cdot ${texNum(s.y)} = ${texNum(c.k * s.y)}\ \text{m} \qquad W_F = ${texNum(s.W)}\ \text{J} \qquad \Delta U + K + Q = ${texNum(machineU(s, p) + machineK(s, p) + s.Q)}\ \text{J}`,
    ];
  },

  params: [
    { key: "modo", label: "Máquina", unit: "", min: 0, max: 7, step: 1, default: 0, options: MODES.map((label, value) => ({ value, label })) },
    { key: "m", label: "Massa da carga", unit: "kg", min: 1, max: 200, step: 1, default: 30, live: true },
    { key: "F", label: "Força aplicada pela mão", unit: "N", min: 0, max: 800, step: 1, default: 147, live: true },
    { key: "Mb", label: "Alavanca: massa da barra", unit: "kg", min: 0, max: 30, step: 0.5, default: 0, live: true },
    { key: "xp0", label: "Alavanca: posição inicial do apoio", unit: "m", min: -2, max: 2, step: 0.1, default: 0 },
    { key: "n", label: "Talha: segmentos (moitão) ou roldanas móveis (exponencial)", unit: "", min: 1, max: 6, step: 1, default: 4 },
    { key: "mp", label: "Massa de cada roldana móvel", unit: "kg", min: 0, max: 10, step: 0.1, default: 0 },
    { key: "R", label: "Sarilho/parafuso: raio da manivela", unit: "m", min: 0.1, max: 0.6, step: 0.01, default: 0.4 },
    { key: "r", label: "Sarilho: raio do tambor", unit: "m", min: 0.03, max: 0.3, step: 0.01, default: 0.08 },
    { key: "passo", label: "Parafuso: passo da rosca", unit: "mm", min: 1, max: 20, step: 0.5, default: 5 },
    {
      key: "reg",
      label: "Governador: rotação",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 0,
      options: [
        { value: 0, label: "Imposta pelo controle (manual)" },
        { value: 1, label: "Motor regulado pelo governador" },
      ],
    },
    { key: "rpm", label: "Governador: rotação imposta", unit: "rpm", min: 0, max: 150, step: 1, default: 60, live: true },
    { key: "carga", label: "Governador: carga no motor", unit: "N·m", min: 0, max: 20, step: 0.5, default: 6, live: true },
    { key: "gam", label: "Governador: amortecimento dos braços", unit: "1/s", min: 0.5, max: 30, step: 0.5, default: 8, live: true },
    { key: "L", label: "Governador: comprimento dos braços", unit: "m", min: 0.15, max: 0.5, step: 0.01, default: 0.3 },
    { key: "g", label: "Gravidade", unit: "m/s²", min: 1, max: 25, step: 0.1, default: 9.8 },
  ],

  observables: [
    { key: "Fa", label: "Força aplicada", unit: "N", value: (s, p) => appliedF(s, p) },
    { key: "Feq", label: "Força de equilíbrio", unit: "N", value: (s, p) => (modo(p) === 0 ? Math.abs(leverFreq(s, p)) || 0 : modo(p) === 7 ? 0 : machineFeq(p)) },
    {
      key: "VM",
      label: "Vantagem mecânica ideal",
      unit: "",
      value: (s, p) => (modo(p) === 0 ? Math.abs((s.xe - s.xp) / (Math.abs(s.xc - s.xp) > 1e-6 ? s.xc - s.xp : 1e-6)) : modo(p) === 7 ? 0 : config(p).k),
    },
    { key: "tau", label: "Torque resultante (alavanca)", unit: "N·m", value: (s, p) => (modo(p) === 0 ? leverTorque(s, p) : 0) },
    { key: "th", label: "Ângulo (barra ou braços)", unit: "°", value: (s, p) => deg(modo(p) === 7 ? s.gth : s.th) },
    { key: "y", label: "Altura da carga", unit: "m", value: (s) => s.y },
    { key: "s", label: "Deslocamento da mão", unit: "m", value: (s, p) => (modo(p) >= 1 && modo(p) <= 6 ? config(p).k * s.y : 0) },
    { key: "W", label: "Trabalho da mão", unit: "J", value: (s) => s.W },
    { key: "U", label: "Energia potencial ganha", unit: "J", value: (s, p) => (modo(p) >= 1 && modo(p) <= 6 ? machineU(s, p) : 0) },
    { key: "bal", label: "K + U + Q − W (balanço)", unit: "J", value: (s, p) => (modo(p) >= 1 && modo(p) <= 6 ? machineK(s, p) + machineU(s, p) + s.Q - s.W : 0) },
    { key: "rpm", label: "Rotação do eixo", unit: "rpm", value: (s) => (s.w * 60) / (2 * Math.PI) },
    { key: "theq", label: "Ângulo de equilíbrio teórico", unit: "°", value: (s, p) => (modo(p) === 7 ? deg(thetaEq(s.w, ARM(p), G(p))) : 0) },
    { key: "valv", label: "Abertura da válvula", unit: "%", value: (s, p) => (modo(p) === 7 ? 100 * valve(s.gth) : 0) },
  ],
  conserved: "bal",
  chart: { x: "t", y: "th" },

  scenarios: [
    {
      id: "alavanca",
      label: "Alavancas: as três classes",
      params: { modo: 0, m: 30, F: 147, Mb: 0, xp0: 0 },
      guide: `### Equilíbrio de torques
1. A carga de 30 kg está a 1 m do apoio e a força de 147 N a 2 m, do outro lado. Rode: a barra fica em equilíbrio, pois $P\\,d_P = F\\,d_F$.
2. Arraste a **carga** para mais longe do apoio. Para que lado a barra gira? Leia $F_{eq}$ e ajuste a força.
3. Arraste o **apoio** para a ponta e a força para o outro lado: a classe muda (o rótulo no alto diz qual). Monte um carrinho de mão (2ª classe) e uma pinça (3ª classe).
4. Na 3ª classe a vantagem mecânica é menor que 1: o que se ganha em troca? (Pense no deslocamento da ponta.)
5. Dê massa à barra: o peso dela age no centro e também produz torque.`,
      predict: [
        {
          question: "Numa alavanca de 3ª classe (força entre o apoio e a carga), a força necessária para equilibrar é:",
          options: ["menor que o peso da carga", "igual ao peso da carga", "maior que o peso da carga"],
          answer: 2,
          explanation: "A força fica mais perto do apoio que a carga, então $d_F < d_P$ e $F = P\\,d_P/d_F > P$. Ganha-se em deslocamento e rapidez da ponta, como no antebraço e na pinça.",
        },
      ],
    },
    {
      id: "talha",
      label: "Talha: menos força, mais corda",
      params: { modo: 3, n: 4, m: 60, F: 160, mp: 0 },
      guide: `### Vantagem mecânica e trabalho
1. Quatro segmentos de corda sustentam o moitão: $F_{eq} = P/4 = ${(60 * 9.8) / 4}$ N. Com $F = 160$ N a carga sobe acelerando.
2. Pause e compare o **deslocamento da mão** $s$ com a altura $h$ da carga: $s = 4h$.
3. Compare o **trabalho da mão** $W = F\\,s$ com a energia ganha $\\Delta U + K$. O balanço (gráfico "K + U + Q − W") fica em zero: a talha não economiza energia.
4. Arraste a mão no palco: a carga sobe devagar, em equilíbrio (a força passa a ser $F_{eq}$).
5. Troque para a **talha exponencial**: com $n$ roldanas móveis em cascata, $VM = 2^n$. Dê massa às roldanas e veja o $F_{eq}$ crescer.`,
      predict: [
        {
          question: "Para erguer a carga 1 m com uma talha de 4 segmentos, quanto de corda a mão puxa?",
          options: ["0,25 m", "1 m", "4 m", "16 m"],
          answer: 2,
          explanation: "Cada um dos 4 segmentos encurta 1 m, então sai 4 m de corda pela mão. A força cai a 1/4, mas $F\\,s$ continua igual a $P\\,h$.",
        },
      ],
    },
    {
      id: "sarilho",
      label: "Sarilho e macaco de parafuso",
      params: { modo: 5, m: 50, F: 110, R: 0.4, r: 0.08 },
      guide: `### Roda e eixo
1. No sarilho, $F R = P r$: com $R = 40$ cm e $r = 8$ cm, $VM = 5$ e $F_{eq} = 98$ N. Com 110 N a carga sobe.
2. Arraste a manivela em círculos: cada volta sobe a carga $2\\pi r$.
3. Mude para o **macaco de parafuso**: cada volta da manivela sobe a carga só um passo $p$. Com $R = 40$ cm e $p = 5$ mm, $VM = 2\\pi R/p \\approx 500$. Um carro de 1 tonelada é erguido com cerca de 20 N (sem atrito; o parafuso real tem muito atrito, e é isso que o faz não descer sozinho).`,
    },
    {
      id: "watt",
      label: "Governador centrífugo de Watt",
      params: { modo: 7, reg: 0, rpm: 60, L: 0.3 },
      guide: `### Ângulo de equilíbrio × rotação
1. Com rotação imposta, os braços abrem até que $\\omega^2 (a + L\\,\\text{sen}\\,\\theta)\\cos\\theta = g\\,\\text{sen}\\,\\theta$. O gráfico ao lado marca o ponto atual sobre a curva $\\theta_{eq}(\\omega)$.
2. Varie a rotação. Abaixo de $\\omega \\approx \\sqrt{g/L}$ os braços quase não abrem; acima, sobem rápido e tendem a 90°.
3. Passe para **motor regulado**: os braços fecham a válvula de vapor quando sobem. Aumente a carga do motor: a rotação cai um pouco, os braços descem, a válvula abre e o motor se recupera. É um controle por realimentação (com um pequeno erro permanente: 4 N·m → 56 rpm, 12 N·m → 53 rpm).
4. Reduza o **amortecimento dos braços** para 3 s⁻¹: a rotação passa a oscilar sem parar (a "caça" dos governadores, analisada por Maxwell em 1868). Aumente de novo e a oscilação some.`,
      predict: [
        {
          question: "Se a rotação do eixo dobra, o ângulo dos braços (sem afastamento da articulação):",
          options: ["dobra", "aumenta, mas não dobra", "fica igual"],
          answer: 1,
          explanation: "$\\cos\\theta = g/(\\omega^2 L)$: o cosseno cai a 1/4, mas o ângulo cresce bem menos que o dobro e nunca passa de 90°.",
        },
      ],
    },
  ],

  exercises: [
    {
      id: "alavanca",
      prompt: "Uma alavanca interfixa de massa desprezível tem uma carga de {m} kg a {dP} m do apoio. Que força, aplicada a {dF} m do apoio do outro lado, a equilibra? (g = 9,8 m/s²)",
      vary: { m: [5, 120, 0], dP: [0.2, 1.5, 1], dF: [1, 3, 1] },
      answer: { label: "F", unit: "N", compute: (p) => (num(p, "m") * 9.8 * num(p, "dP")) / num(p, "dF") },
    },
    {
      id: "talha",
      prompt: "Uma talha com {n} segmentos de corda sustentando o moitão ergue {m} kg com velocidade constante (roldanas leves, g = 9,8 m/s²). Que trabalho a mão realiza para subir a carga {h} m?",
      vary: { n: [2, 6, 0], m: [20, 200, 0], h: [0.5, 3, 1] },
      fixed: { modo: 3 },
      answer: { label: "W", unit: "J", compute: (p) => num(p, "m") * 9.8 * num(p, "h") },
      hint: "A força cai a P/n, mas a corda puxada é n vezes maior.",
    },
    {
      id: "watt",
      prompt: "Num governador de Watt com braços de {L} m articulados no eixo, que gira a {rpm} rpm, qual o ângulo dos braços com a vertical? (g = 9,8 m/s²)",
      vary: { L: [0.2, 0.5, 2], rpm: [70, 150, 0] },
      answer: { label: "θ", unit: "°", compute: (p) => deg(Math.acos(Math.min(1, 9.8 / (rpm2w(num(p, "rpm")) ** 2 * num(p, "L"))))) },
      hint: "Com a articulação no eixo, cos θ = g/(ω²L).",
    },
  ],

  init: initial,
  step(s, p, _t, dt) {
    const md = modo(p);
    if (md === 0) return stepLever(s, p, dt);
    if (md === 7) return stepGovernor(s, p, dt);
    return stepMachine(s, p, dt);
  },
  dt: 1e-3,
  sampleEvery: 20,

  actions: [
    { id: "travar", label: "Travar/soltar a barra (alavanca)", run: (s) => ({ ...s, locked: !s.locked, th: 0, om: 0 }), active: (s) => s.locked },
    { id: "soltar", label: "Mão: aplicar a força do controle", run: (s) => ({ ...s, hold: false }) },
    { id: "chao", label: "Baixar a carga ao chão", run: (s) => ({ ...s, y: 0, v: 0, W: 0, Q: 0, hold: false }) },
  ],

  pointer: {
    down(s, p, pt) {
      const md = modo(p);
      if (md === 0) {
        const cands: ["xp" | "xc" | "xe", number, number][] = [
          ["xc", ...beamPoint(s, s.xc)],
          ["xe", ...beamPoint(s, s.xe)],
          ["xp", s.xp, HP - 0.4],
        ];
        let best: "" | "xp" | "xc" | "xe" = "";
        let bd = 0.45;
        for (const [k, x, y] of cands) {
          const d = Math.hypot(pt.x - x, (pt.y - y) * 0.6);
          if (d < bd) {
            bd = d;
            best = k;
          }
        }
        return best ? { ...s, drag: best, th: 0, om: 0 } : undefined;
      }
      if (md >= 1 && md <= 6) return { ...s, drag: "mao", hold: true, v: 0, px: pt.x, py: pt.y };
      return undefined;
    },
    move(s, p, pt, dragging) {
      if (!dragging || !s.drag) return undefined;
      const md = modo(p);
      if (md === 0) {
        const u = snap(pt.x);
        if (s.drag === "xp") return { ...s, xp: clamp(u, -BEAM + 0.2, BEAM - 0.2) };
        return { ...s, [s.drag]: u };
      }
      const c = config(p);
      let ds: number;
      if (md === 5 || md === 6) {
        const cy = md === 5 ? 2.4 : 0.55;
        const a0 = Math.atan2(s.py - cy, s.px);
        const a1 = Math.atan2(pt.y - cy, pt.x);
        let da = a1 - a0;
        if (da > Math.PI) da -= 2 * Math.PI;
        if (da < -Math.PI) da += 2 * Math.PI;
        ds = da * num(p, "R", 0.4);
      } else ds = s.py - pt.y;
      const y = clamp(s.y + ds / c.k, 0, c.yMax);
      const Feq = machineFeq(p);
      return { ...s, y, v: 0, W: s.W + Feq * c.k * (y - s.y), px: pt.x, py: pt.y };
    },
    up: (s) => (s.drag ? { ...s, drag: "" } : undefined),
    cursor(s, p, pt) {
      const md = modo(p);
      if (md === 0) {
        for (const u of [s.xc, s.xe]) {
          const [x, y] = beamPoint(s, u);
          if (Math.hypot(pt.x - x, pt.y - y) < 0.45) return "grab";
        }
        if (Math.abs(pt.x - s.xp) < 0.3 && pt.y < HP) return "ew-resize";
        return undefined;
      }
      if (md >= 1 && md <= 4) {
        const [hx, hy] = handPos(s, p);
        return Math.hypot(pt.x - hx, pt.y - hy) < 0.5 ? "ns-resize" : undefined;
      }
      return md === 5 || md === 6 ? "grab" : undefined;
    },
  },

  viewport(p) {
    const md = modo(p);
    if (md === 0) return { xMin: -3.6, xMax: 3.6, yMin: -0.6, yMax: 3.6, unit: "m" };
    if (md === 6) return { xMin: -0.9, xMax: 0.9, yMin: -0.15, yMax: 1.2, unit: "m" };
    if (md === 7) return { xMin: -0.65, xMax: 1.5, yMin: -0.05, yMax: 1.15, unit: "m" };
    return { xMin: -2.2, xMax: 2.8, yMin: -0.3, yMax: 4.2, unit: "m" };
  },

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const { state: s, params: p, theme } = frame;
    const md = modo(p);
    if (md === 0) renderLever(d, s, p);
    else if (md === 7) renderGovernor(d, s, p);
    else renderMachine(d, s, p);
    void theme;
  },
});

type D = ReturnType<typeof draw>;

function massBox(d: D, cx: number, by: number, m: number, label: string, angle = 0) {
  const side = 0.14 * Math.cbrt(m);
  const ox = -Math.sin(angle) * (side / 2);
  const oy = Math.cos(angle) * (side / 2);
  d.box(cx + ox, by + oy, side, side, angle, { fill: d.theme.series[1], stroke: d.theme.text, width: 1 });
  d.text(label, cx + 2 * ox, by + 2 * oy, { size: 11, weight: "600", dy: -10 });
}

function renderLever(d: D, s: MS, p: Params) {
  const t = d.theme;
  const g = G(p);
  d.rect(-3.6, -0.6, 7.2, 0.6, { fill: t.ground });
  d.line(-3.6, 0, 3.6, 0, { color: t.muted });
  // apoio
  d.polyline(
    [
      [s.xp, HP],
      [s.xp - 0.3, 0],
      [s.xp + 0.3, 0],
    ],
    { close: true, fill: t.muted, color: t.text, width: 1 },
  );
  d.text("apoio", s.xp, 0.25, { size: 10, color: t.dark ? "#111" : "#fff" });
  if (s.locked) {
    for (const u of [-BEAM + 0.3, BEAM - 0.3]) d.rect(u - 0.06, 0, 0.12, HP - 0.05, { fill: t.muted, alpha: 0.6 });
  }
  // barra
  const [x0, y0] = beamPoint(s, -BEAM);
  const [x1, y1] = beamPoint(s, BEAM);
  d.line(x0, y0, x1, y1, { color: t.text, width: 7 });
  for (let u = -BEAM; u <= BEAM + 1e-9; u += 0.5) {
    const [x, y] = beamPoint(s, u);
    d.line(x, y - 0.05, x, y + 0.05, { color: t.dark ? "#222" : "#fff", width: 1 });
  }
  // carga
  const [cx, cy] = beamPoint(s, s.xc);
  massBox(d, cx, cy + 0.03, num(p, "m", 30), `${num(p, "m", 30)} kg`, s.th);
  const P = num(p, "m", 30) * g;
  d.arrowPx(cx, cy, 0, -1, clamp(P / 6, 18, 110), { color: t.series[1] });
  d.text(`P = ${P.toFixed(0)} N`, cx, cy, { color: t.series[1], size: 11, dy: Math.min(130, P / 6 + 14) });
  // força
  const [ex, ey] = beamPoint(s, s.xe);
  const Fy = leverFy(s, p);
  const len = clamp(Math.abs(Fy) / 6, 0, 110);
  if (Fy < 0) d.arrow(ex, ey + len * d.px + 0.02, 0, -len * d.px, { color: t.accent, width: 3 });
  else d.arrowPx(ex, ey, 0, 1, len, { color: t.accent, width: 3 });
  d.text(`F = ${Math.abs(Fy).toFixed(0)} N`, ex, ey + (Fy < 0 ? len * d.px + 0.18 : -0.2), { color: t.accent, size: 11, weight: "600" });
  d.dot(ex, ey, 6, t.accent);
  if (num(p, "Mb", 0) > 0) {
    const [bx, by] = beamPoint(s, 0);
    d.arrowPx(bx, by, 0, -1, clamp((num(p, "Mb", 0) * g) / 6, 12, 80), { color: t.muted });
    d.text("peso da barra", bx, by - 0.15, { size: 9, color: t.muted, dy: 30 });
  }
  // braços de alavanca
  const yb = -0.35;
  d.line(s.xp, yb, s.xc, yb, { color: t.series[1], width: 2 });
  d.text(`d_P = ${Math.abs(s.xc - s.xp).toFixed(1)} m`, (s.xp + s.xc) / 2, yb, { color: t.series[1], size: 10, dy: 10 });
  d.line(s.xp, yb - 0.12, s.xe, yb - 0.12, { color: t.accent, width: 2 });
  d.text(`d_F = ${Math.abs(s.xe - s.xp).toFixed(1)} m`, (s.xp + s.xe) / 2, yb - 0.12, { color: t.accent, size: 10, dy: 10 });
  // painel
  const tau = leverTorque(s, p);
  d.text(CLASS_LABEL[leverClass(s)], -3.5, 3.4, { align: "left", size: 13, weight: "600" });
  d.text(`Στ = ${tau.toFixed(1)} N·m   ${Math.abs(tau) < 0.5 ? "(equilíbrio)" : tau > 0 ? "(gira no sentido anti-horário)" : "(gira no sentido horário)"}`, -3.5, 3.1, {
    align: "left",
    size: 11,
    color: Math.abs(tau) < 0.5 ? t.positive : t.muted,
  });
  d.text(`F para equilibrar: ${Math.abs(leverFreq(s, p) || 0).toFixed(1)} N   ·   arraste apoio, carga e ponto da força`, -3.5, 2.85, { align: "left", size: 10, color: t.muted });
}

function pulley(d: D, x: number, y: number, r: number, fixed: boolean) {
  d.circle(x, y, r, { fill: fixed ? d.theme.muted : d.theme.series[2], stroke: d.theme.text, width: 1.2, alpha: 0.9 });
  d.dot(x, y, 2.5, d.theme.text);
}

function renderMachine(d: D, s: MS, p: Params) {
  const t = d.theme;
  const md = modo(p);
  const c = config(p);
  const m = num(p, "m", 30);
  const F = appliedF(s, p);
  if (md !== 6) {
    d.rect(-2.2, -0.3, 5, 0.3, { fill: t.ground });
    if (md <= 4) d.support(-1.2, 3.85, 2.4, 3.85);
  }
  const rope = { color: t.text, width: 1.6 };
  const handDraw = (hx: number, hy: number) => {
    d.circle(hx, hy, 0.09, { fill: t.accent });
    d.arrowPx(hx, hy - 0.1, 0, -1, clamp(F / 5, 14, 90), { color: t.accent, width: 3 });
    d.text(`F = ${F.toFixed(0)} N${s.hold ? " (mão segurando)" : ""}`, hx + 0.15, hy - 0.25, { align: "left", size: 11, color: t.accent, weight: "600" });
    d.text(`corda puxada s = ${(c.k * s.y).toFixed(2)} m`, hx + 0.15, hy + 0.05, { align: "left", size: 10, color: t.muted });
  };
  const loadAt = (cx: number) => {
    d.rect(cx - 0.25, s.y, 0.5, 0.4, { fill: t.series[1], stroke: t.text, width: 1 });
    d.text(`${m} kg`, cx, s.y + 0.2, { size: 11, weight: "600", color: t.dark ? "#111" : "#fff" });
  };
  const rp = 0.18;
  if (md === 1) {
    pulley(d, 0, 3.55, 0.22, true);
    d.line(0, 3.85, 0, 3.55, rope);
    loadAt(-0.22);
    d.line(-0.22, s.y + 0.4, -0.22, 3.55, rope);
    const [hx, hy] = handPos(s, p);
    d.line(0.22, 3.55, hx, hy, rope);
    handDraw(hx, hy);
  } else if (md === 2) {
    const py = s.y + 0.4 + 0.3;
    pulley(d, 0.42, 3.55, rp, true);
    d.line(0.42, 3.85, 0.42, 3.55, rope);
    loadAt(0);
    d.line(0, s.y + 0.4, 0, py, rope);
    pulley(d, 0, py, rp, false);
    d.line(-rp, py, -rp, 3.85, rope);
    d.line(rp, py, rp, 3.55, rope);
    const [hx, hy] = handPos(s, p);
    d.line(0.6, 3.55, hx, hy, rope);
    handDraw(hx, hy);
  } else if (md === 3) {
    const n = nPulleys(p);
    const yl = s.y + 0.4 + 0.35;
    const yu = 3.45;
    d.rect(-0.35, yu - 0.15, 0.7, 0.3, { fill: t.muted, stroke: t.text, width: 1 });
    d.line(0, 3.85, 0, yu + 0.15, rope);
    loadAt(0);
    d.line(0, s.y + 0.4, 0, yl - 0.15, rope);
    d.rect(-0.35, yl - 0.15, 0.7, 0.3, { fill: t.series[2], stroke: t.text, width: 1 });
    for (let i = 0; i < n; i++) {
      const x = -0.3 + (0.6 * i) / (n - 1);
      d.line(x, yl + 0.15, x, yu - 0.15, rope);
    }
    d.text(`${n} segmentos`, -0.45, (yl + yu) / 2, { align: "right", size: 11, color: t.muted });
    const [hx, hy] = handPos(s, p);
    d.line(0.3, yu, 0.62, yu, rope);
    d.line(hx, yu, hx, hy, rope);
    handDraw(hx, hy);
  } else if (md === 4) {
    const n = nPulleys(p);
    loadAt(0);
    const hj = (j: number) => EXP_H0(j) + 2 ** (j - 1) * s.y;
    d.line(0, s.y + 0.4, 0, hj(1) - rp, rope);
    for (let j = 1; j <= n; j++) {
      const xj = (j - 1) * rp;
      pulley(d, xj, hj(j), rp, false);
      d.line(xj - rp, hj(j), xj - rp, 3.85, rope);
      d.text(`${2 ** (j - 1)}×`, xj - rp - 0.04, hj(j) - 0.12, { align: "right", size: 9, color: t.muted });
      // lado direito: sobe até o gancho da roldana seguinte (ou até a roldana fixa)
      d.line(xj + rp, hj(j), xj + rp, j < n ? hj(j + 1) - rp : 3.6, rope);
    }
    const x = (n - 1) * rp;
    const fx = x + 2 * rp;
    pulley(d, fx, 3.6, rp, true);
    d.line(fx, 3.85, fx, 3.6, rope);
    const [hx, hy] = handPos(s, p);
    d.line(fx + rp, 3.6, hx, hy, rope);
    handDraw(hx, hy);
  } else if (md === 5) {
    const R = num(p, "R", 0.4);
    const r = num(p, "r", 0.08);
    const ang = (s.y * c.k) / R;
    d.rect(-0.9, 0, 0.12, 2.4, { fill: t.muted });
    d.line(-0.84, 2.4, 0, 2.4, { color: t.muted, width: 4 });
    d.circle(0, 2.4, R, { stroke: t.muted, dash: [5, 4], width: 1 });
    d.circle(0, 2.4, r, { fill: t.series[2], stroke: t.text, width: 1 });
    const [hx, hy] = handPos(s, p);
    d.line(0, 2.4, hx, hy, { color: t.text, width: 4 });
    d.circle(hx, hy, 0.06, { fill: t.accent });
    d.arrowPx(hx, hy, -Math.sin(ang), Math.cos(ang), clamp(F / 3, 14, 90), { color: t.accent, width: 3 });
    d.text(`F = ${F.toFixed(0)} N`, hx + 0.1, hy + 0.15, { align: "left", size: 11, color: t.accent, weight: "600" });
    d.line(r, 2.4, r, s.y + 0.4, rope);
    loadAt(r);
    d.text(`R = ${(R * 100).toFixed(0)} cm, r = ${(r * 100).toFixed(0)} cm → VM = R/r = ${c.k.toFixed(2)}`, -2.1, 4.0, { align: "left", size: 11 });
    d.text(`voltas da manivela: ${(ang / (2 * Math.PI)).toFixed(2)}   ·   arraste em círculos para girar`, -2.1, 3.75, { align: "left", size: 10, color: t.muted });
  } else {
    // macaco de parafuso, vista lateral; a rosca é desenhada com o passo exagerado
    const R = num(p, "R", 0.4);
    const pitch = num(p, "passo", 5) / 1000;
    const ang = (2 * Math.PI * s.y) / pitch;
    d.rect(-0.9, -0.15, 1.8, 0.15, { fill: t.ground });
    d.rect(-0.2, 0, 0.4, 0.3, { fill: t.muted });
    const top = 0.45 + s.y;
    const pts: [number, number][] = [];
    const visP = 0.04;
    for (let yy = 0.3, i = 0; yy < top; yy += visP / 2, i++) pts.push([i % 2 ? 0.05 : -0.05, yy]);
    d.polyline(pts, { color: t.text, width: 1.2 });
    d.rect(-0.07, top, 0.14, 0.08, { fill: t.muted });
    const hx = R * Math.cos(ang);
    d.line(0, top + 0.04, hx, top + 0.04, { color: t.text, width: 4 });
    d.circle(hx, top + 0.04, 0.03, { fill: t.accent });
    d.rect(-0.35, top + 0.08, 0.7, 0.12, { fill: t.series[1], stroke: t.text, width: 1 });
    d.text(`${m} kg`, 0, top + 0.14, { size: 11, weight: "600", color: t.dark ? "#111" : "#fff" });
    d.text(`passo p = ${(pitch * 1000).toFixed(1)} mm, R = ${(R * 100).toFixed(0)} cm → VM = 2πR/p = ${c.k.toFixed(0)}`, -0.85, 1.12, { align: "left", size: 11 });
    d.text(`F = ${F.toFixed(1)} N (F_eq = ${machineFeq(p).toFixed(2)} N)   subida = ${(s.y * 1000).toFixed(1)} mm   voltas = ${(ang / (2 * Math.PI)).toFixed(1)}`, -0.85, 1.04, {
      align: "left",
      size: 10,
      color: t.accent,
    });
    d.text("arraste em círculos para girar a manivela", -0.85, 0.97, { align: "left", size: 10, color: t.muted });
  }
  if (md <= 4) {
    d.text(`VM ideal = ${c.k}   ·   F_eq = ${machineFeq(p).toFixed(1)} N   ·   peso = ${(m * G(p)).toFixed(0)} N`, -2.1, 4.08, { align: "left", size: 11, weight: "600" });
    d.text(`W da mão = ${s.W.toFixed(1)} J   ·   ΔU + K + Q = ${(machineU(s, p) + machineK(s, p) + s.Q).toFixed(1)} J   ·   arraste a mão para puxar`, -2.1, -0.18, {
      align: "left",
      size: 10,
      color: t.muted,
    });
  }
}

function renderGovernor(d: D, s: MS, p: Params) {
  const t = d.theme;
  const L = ARM(p);
  const H = 0.95;
  const r = OFF + L * Math.sin(s.gth);
  const yb = H - L * Math.cos(s.gth);
  const ys = H - 2 * L * Math.cos(s.gth);
  d.line(0, 0, 0, 1.08, { color: t.muted, width: 4 });
  d.rect(-0.25, 0, 0.5, 0.05, { fill: t.muted });
  // as duas bolas giram: projeção x = r cos φ, profundidade indicada pelo tamanho
  for (const sg of [1, -1]) {
    const c = Math.cos(s.phi) * sg;
    const depth = Math.sin(s.phi) * sg;
    const bx = r * c;
    const hx = OFF * c;
    d.line(hx, H, bx, yb, { color: t.text, width: 2.5 });
    d.line(hx, ys, bx, yb, { color: t.text, width: 1.5 });
    d.circle(bx, yb, 0.05 * (1 + 0.15 * depth), { fill: t.series[1], stroke: t.text, width: 1, alpha: 0.75 + 0.25 * depth });
  }
  d.rect(-0.04, ys - 0.025, 0.08, 0.05, { fill: t.series[2] });
  // alavanca da válvula
  const vy = 0.25;
  d.line(0.04, ys, 0.45, ys, { color: t.muted, width: 2 });
  d.line(0.45, ys, 0.45, vy + 0.06, { color: t.muted, width: 2 });
  d.rect(0.4, vy - 0.05, 0.1, 0.1, { stroke: t.text, width: 1 });
  d.rect(0.4, vy - 0.05, 0.1 * valve(s.gth), 0.1, { fill: t.accent, alpha: 0.7 });
  d.text(`válvula ${(100 * valve(s.gth)).toFixed(0)}%`, 0.45, vy - 0.1, { size: 10 });
  const rpm = (s.w * 60) / (2 * Math.PI);
  d.text(`${rpm.toFixed(1)} rpm   θ = ${deg(s.gth).toFixed(1)}°`, -0.6, 1.1, { align: "left", size: 12, weight: "600" });
  d.arrowPx(r * Math.cos(s.phi), yb, Math.sign(Math.cos(s.phi)) || 1, 0, clamp(s.w * s.w * r * 4, 0, 50), { color: t.positive });
  d.text("ω²r (no referencial do eixo)", -0.6, 1.03, { align: "left", size: 10, color: t.positive });
  // gráfico θ_eq(rpm)
  const gx0 = 0.65;
  const gx1 = 1.45;
  const gy0 = 0.35;
  const gy1 = 0.95;
  const X = (rr: number) => gx0 + (rr / 150) * (gx1 - gx0);
  const Y = (th: number) => gy0 + (th / 90) * (gy1 - gy0);
  d.rect(gx0, gy0, gx1 - gx0, gy1 - gy0, { stroke: t.grid, width: 1 });
  d.plot((x) => Y(deg(thetaEq(rpm2w(((x - gx0) / (gx1 - gx0)) * 150), L, G(p)))), gx0, gx1, { color: t.accent, n: 120 });
  d.plot((x) => {
    const w = rpm2w(((x - gx0) / (gx1 - gx0)) * 150);
    const c = G(p) / (w * w * L);
    return c < 1 ? Y(deg(Math.acos(c))) : Y(0);
  }, gx0, gx1, { color: t.muted, dash: [4, 3], n: 120 });
  d.dot(X(clamp(rpm, 0, 150)), Y(deg(s.gth)), 5, t.positive);
  if (Math.round(num(p, "reg")) === 1) {
    for (let th = 25; th <= 55; th += 30) d.line(gx0, Y(th), gx1, Y(th), { color: t.series[2], dash: [2, 3], width: 1 });
    d.text("faixa da válvula", gx1, Y(40), { size: 9, color: t.series[2], align: "right" });
  }
  d.text("θ_eq (°) × rotação (rpm)", (gx0 + gx1) / 2, gy1 + 0.04, { size: 10 });
  d.text("0", gx0, gy0 - 0.03, { size: 9, color: t.muted });
  d.text("150", gx1, gy0 - 0.03, { size: 9, color: t.muted });
  d.text("90°", gx0 - 0.02, gy1, { size: 9, color: t.muted, align: "right" });
  d.text("tracejado: articulação no eixo (a = 0)", gx0, gy0 - 0.08, { size: 9, color: t.muted, align: "left" });
}

export default maquinasSimples;
