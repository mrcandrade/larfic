import { clamp, defineSim, draw, num, rng, texNum, type Draw, type Params } from "@fisilab/core";
import {
  MATERIAIS,
  driftVelocity,
  hallVoltage,
  motorAccel,
  motorTorque,
  terminalOmega,
  wireForce,
  wirePoints,
  type MotorParams,
  type V2,
} from "./physics.ts";

export * from "./physics.ts";

export interface MotorState {
  /** Ângulo entre a normal da espira e B (rad) e velocidade angular (rad/s). */
  th: number;
  w: number;
  /** Extremos do fio (modo força num fio), em metros. */
  a: V2;
  b: V2;
  /** Tensão Hall atual (V) e portadores desenhados (coordenadas normalizadas −1..1). */
  VH: number;
  carriers: V2[];
  drag: null | "a" | "b" | "coil";
}

const MODOS = ["Motor DC desmontável", "Força num fio (F = IL × B)", "Efeito Hall"];
/** Tempo de acúmulo das cargas no efeito Hall, em câmera lenta (s de animação). */
export const HALL_TAU = 0.4;
/** Geometria do motor no palco (m). */
const MOTOR = { pole: 0.085, coil: 0.055, gx0: 0.13, gx1: 0.3, gy: 0.065 };
/** Placa Hall no palco (unidades de desenho). */
const SLAB = { hx: 0.9, hy: 0.35 };

const modo = (p: Params) => Math.round(num(p, "modo"));
export const motorParams = (p: Params): MotorParams => ({
  V: num(p, "V", 3),
  R: num(p, "R", 2),
  B: num(p, "B", 0.5),
  N: num(p, "N", 100),
  L: num(p, "L", 0.05),
  comutador: Math.round(num(p, "comutador", 1)) === 1,
  carga: num(p, "carga"),
});
const material = (p: Params) => MATERIAIS[Math.round(num(p, "material"))] ?? MATERIAIS[0]!;
const tHall = (p: Params) => num(p, "esp", 1) * 1e-3;
const wHall = (p: Params) => num(p, "larg", 10) * 1e-3;
const IHall = (p: Params) => num(p, "Ihall", 0.01);
export const hallSteady = (p: Params) => hallVoltage(IHall(p), num(p, "B", 0.5), material(p).n, material(p).sinal, tHall(p));

export function wireF(s: MotorState, p: Params): [number, number, number] {
  return wireForce(wirePoints(s.a, s.b, Math.round(num(p, "forma"))), num(p, "Ifio", 5), num(p, "B", 0.5), Math.round(num(p, "Bdir")));
}

const deg = (r: number) => (r * 180) / Math.PI;
const wrap360 = (a: number) => ((deg(a) % 360) + 360) % 360;

/** Número com prefixo SI, para rótulos no palco. */
function si(v: number, unit: string): string {
  const a = Math.abs(v);
  const pre: [number, string][] = [
    [1, ""],
    [1e-3, "m"],
    [1e-6, "μ"],
    [1e-9, "n"],
  ];
  const [f, s] = pre.find(([f]) => a >= f) ?? [1e-9, "n"];
  return `${(v / f).toPrecision(3).replace(".", ",").replace("-", "−")} ${s}${unit}`;
}

export const motorHall = defineSim<MotorState>({
  id: "motor-hall",
  title: "Fio com corrente, motor DC e efeito Hall",
  course: "FG III",
  topic: "Magnetismo",
  priority: "P1",
  summary:
    "Desmonte um motor DC: espira em campo uniforme, comutador ligado ou desligado e o gráfico τ(θ). Arraste um fio para ver F = IL × B e veja portadores positivos ou negativos se acumularem até V_H = IB/(nqt).",
  equations: [
    String.raw`\vec F = I\,\vec L\times\vec B \qquad |\vec F| = ILB\,\mathrm{sen}\,\theta`,
    String.raw`\vec\tau = \vec\mu\times\vec B,\ \ \mu = NIA \quad\Rightarrow\quad \tau = NIAB\,\mathrm{sen}\,\theta \qquad \varepsilon = NBA\,\omega\,\mathrm{sen}\,\theta \qquad i = \frac{V - \varepsilon}{R}`,
    String.raw`qE_H = q v_d B \quad\Rightarrow\quad V_H = E_H w = \frac{IB}{nqt},\ \ v_d = \frac{I}{nqwt}`,
  ],
  liveEquations(s, p) {
    const m = modo(p);
    if (m === 1) {
      const F = wireF(s, p);
      const L = Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]);
      return [
        String.raw`|\vec F| = ${texNum(Math.hypot(...F))}\ \text{N} \qquad I L B = ${texNum(Math.abs(num(p, "Ifio", 5)) * L * num(p, "B", 0.5))}\ \text{N}\ \ (L = ${texNum(L)}\ \text{m, corda } a\to b)`,
      ];
    }
    if (m === 2) {
      const mat = material(p);
      return [
        String.raw`V_H = \frac{IB}{nqt} = \frac{${texNum(IHall(p))}\ \text{A}\cdot ${texNum(num(p, "B", 0.5))}\ \text{T}}{${texNum(mat.n)}\ \text{m}^{-3}\cdot (${mat.sinal > 0 ? "+" : "-"}e)\cdot ${texNum(tHall(p))}\ \text{m}} = ${texNum(hallSteady(p))}\ \text{V}`,
        String.raw`v_d = ${texNum(driftVelocity(IHall(p), mat.n, wHall(p), tHall(p)))}\ \text{m/s} \qquad V_H(t) = ${texNum(s.VH)}\ \text{V}`,
      ];
    }
    const mp = motorParams(p);
    const { tau, i, fem } = motorTorque(s.th, s.w, mp);
    return [
      String.raw`\tau = NiAB\,\mathrm{sen}\,\theta = ${texNum(tau)}\ \text{N·m} \quad (\theta = ${texNum(wrap360(s.th))}^\circ,\ i = ${texNum(i)}\ \text{A})`,
      String.raw`\varepsilon = NBA\omega\,\mathrm{sen}\,\theta = ${texNum(fem)}\ \text{V} \qquad \omega = ${texNum(s.w)}\ \text{rad/s} \qquad \omega_{\text{regime}} \approx ${texNum(terminalOmega(mp))}\ \text{rad/s}`,
    ];
  },

  params: [
    { key: "modo", label: "Experimento", unit: "", min: 0, max: 2, step: 1, default: 0, options: MODOS.map((label, value) => ({ value, label })) },
    { key: "B", label: "Campo magnético B", unit: "T", min: 0, max: 2, step: 0.01, default: 0.5, live: true },
    // Motor
    {
      key: "comutador",
      label: "Comutador",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 1,
      live: true,
      options: [
        { value: 1, label: "Ligado (inverte a corrente a cada meia volta)" },
        { value: 0, label: "Desligado (corrente sempre no mesmo sentido)" },
      ],
    },
    { key: "V", label: "Tensão da fonte", unit: "V", min: 0, max: 12, step: 0.1, default: 3, live: true },
    { key: "R", label: "Resistência da espira", unit: "Ω", min: 0.5, max: 10, step: 0.1, default: 2 },
    { key: "N", label: "Número de espiras", unit: "", min: 1, max: 200, step: 1, default: 100 },
    { key: "L", label: "Lado da espira quadrada", unit: "m", min: 0.02, max: 0.1, step: 0.005, default: 0.05 },
    { key: "carga", label: "Torque de carga", unit: "N·m", min: 0, max: 0.2, step: 0.005, default: 0, live: true },
    { key: "theta0", label: "Ângulo inicial θ₀", unit: "°", min: 0, max: 360, step: 1, default: 90 },
    // Fio
    { key: "Ifio", label: "Corrente no fio", unit: "A", min: -10, max: 10, step: 0.1, default: 5, live: true },
    {
      key: "Bdir",
      label: "Direção de B (fio)",
      unit: "",
      min: 0,
      max: 2,
      step: 1,
      default: 0,
      live: true,
      options: [
        { value: 0, label: "Saindo da tela (⊙)" },
        { value: 1, label: "Entrando na tela (⊗)" },
        { value: 2, label: "No plano, para a direita (→)" },
      ],
    },
    {
      key: "forma",
      label: "Forma do fio",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 0,
      live: true,
      options: [
        { value: 0, label: "Reto" },
        { value: 1, label: "Semicírculo" },
      ],
    },
    // Hall
    { key: "material", label: "Material (Hall)", unit: "", min: 0, max: 3, step: 1, default: 0, live: true, options: MATERIAIS.map((m, value) => ({ value, label: m.nome })) },
    { key: "Ihall", label: "Corrente na placa", unit: "A", min: 0.001, max: 5, step: 0.001, default: 0.01, log: true, live: true },
    { key: "esp", label: "Espessura t da placa", unit: "mm", min: 0.05, max: 2, step: 0.01, default: 1, live: true },
    { key: "larg", label: "Largura w da placa", unit: "mm", min: 2, max: 20, step: 0.5, default: 10, live: true },
  ],

  observables: [
    { key: "theta", label: "Ângulo θ (normal, B)", unit: "°", value: (s) => wrap360(s.th) },
    { key: "omega", label: "Velocidade angular ω", unit: "rad/s", value: (s) => s.w },
    { key: "rpm", label: "Rotação", unit: "rpm", value: (s) => (s.w * 60) / (2 * Math.PI) },
    { key: "tau", label: "Torque magnético τ", unit: "N·m", value: (s, p) => motorTorque(s.th, s.w, motorParams(p)).tau },
    { key: "i", label: "Corrente na espira", unit: "A", value: (s, p) => motorTorque(s.th, s.w, motorParams(p)).i },
    { key: "fem", label: "Fem induzida ε", unit: "V", value: (s, p) => motorTorque(s.th, s.w, motorParams(p)).fem },
    { key: "F", label: "Força no fio |F|", unit: "N", value: (s, p) => Math.hypot(...wireF(s, p)) },
    { key: "VH", label: "Tensão Hall V_H", unit: "V", value: (s) => s.VH },
    { key: "vd", label: "Velocidade de deriva", unit: "m/s", value: (_s, p) => driftVelocity(IHall(p), material(p).n, wHall(p), tHall(p)) },
  ],
  chart: { x: "t", y: "omega" },

  scenarios: [
    {
      id: "motor",
      label: "Motor com comutador",
      params: { modo: 0, comutador: 1, V: 3, B: 0.5, N: 100, L: 0.05, carga: 0, theta0: 90 },
      guide: `### Como gira um motor DC
1. Os lados da espira perpendiculares ao papel sentem forças $F = iLB$ em sentidos opostos: um **binário**. O torque é $\\tau = NiAB\\,\\mathrm{sen}\\,\\theta$.
2. Acompanhe o ponto no gráfico $\\tau(\\theta)$: com o comutador, a corrente inverte em $\\theta = 0°$ e $180°$ e o torque nunca muda de sinal ($|\\mathrm{sen}\\,\\theta|$).
3. Ao acelerar, a **fem induzida** $\\varepsilon$ se opõe à fonte e a corrente cai: o motor atinge uma rotação de regime. Compare com $\\omega_{\\text{regime}}$ na equação viva.
4. Aplique um torque de carga e veja a rotação cair e a corrente subir.`,
      predict: [
        {
          question: "Para que serve o comutador num motor DC?",
          options: ["aumentar a corrente", "inverter a corrente a cada meia volta para o torque manter o sentido", "reduzir o atrito"],
          answer: 1,
          explanation:
            "Sem inverter a corrente, o torque $NiAB\\,\\mathrm{sen}\\,\\theta$ troca de sinal depois de $\\theta = 180°$ e a espira apenas oscila em torno do equilíbrio. O comutador troca o sentido de $i$ justamente ali.",
        },
      ],
    },
    {
      id: "sem-comutador",
      label: "Sem comutador",
      params: { modo: 0, comutador: 0, V: 3, B: 0.5, N: 100, L: 0.05, theta0: 30 },
      guide: `### Sem comutador a espira não gira
1. Rode: a espira oscila em torno de $\\theta = 180°$, onde $\\vec\\mu$ fica alinhado com $\\vec B$ (equilíbrio estável). Perto dali a fem induzida quase não freia ($\\varepsilon \\propto \\mathrm{sen}\\,\\theta$), e só o atrito amortece.
2. No gráfico $\\tau(\\theta)$ a curva é $\\mathrm{sen}\\,\\theta$ inteira: positiva de 0° a 180°, negativa depois.
3. Ligue o comutador **durante** a simulação e veja o motor partir.`,
    },
    {
      id: "fio",
      label: "Força num fio",
      params: { modo: 1, Ifio: 5, B: 0.5, Bdir: 0, forma: 0 },
      guide: `### Regra da mão direita
1. Arraste as pontas do fio (as bolinhas). A força $\\vec F = I\\vec L\\times\\vec B$ é sempre perpendicular ao fio e a $\\vec B$.
2. Inverta a corrente (valor negativo) e depois o sentido de $\\vec B$: cada inversão troca o sentido da força.
3. Ponha $\\vec B$ **no plano**: a força passa a sair ou entrar da tela e vale $ILB\\,\\mathrm{sen}\\,\\theta$. Deixe o fio paralelo a $\\vec B$: força nula.
4. Troque para **semicírculo**: a força total é a mesma do fio reto entre as mesmas pontas!`,
      predict: [
        {
          question: "Um fio em semicírculo e um fio reto ligam os mesmos dois pontos, com a mesma corrente, num B uniforme. A força total no semicírculo é:",
          options: ["maior (o fio é mais comprido)", "igual", "menor"],
          answer: 1,
          explanation: "Em B uniforme, $\\vec F = I\\left(\\int d\\vec L\\right)\\times\\vec B$ e $\\int d\\vec L$ só depende das pontas: é o vetor da corda $a\\to b$.",
        },
      ],
    },
    {
      id: "hall",
      label: "Efeito Hall",
      params: { modo: 2, material: 0, Ihall: 0.01, B: 0.5, esp: 1, larg: 10 },
      guide: `### Quem carrega a corrente?
1. A corrente vai para a direita e $\\vec B$ sai da tela. Os portadores são desviados para a borda de baixo, que fica carregada; a de cima fica com carga oposta.
2. O acúmulo cria um campo $E_H$ que cresce até equilibrar a força magnética: $qE_H = qv_dB$. Então $V_H = IB/(nqt)$ (o acúmulo real leva frações de nanossegundo; aqui está em câmera lenta).
3. Troque para semicondutor **tipo p**: o sinal de $V_H$ se inverte. É assim que se descobre o sinal dos portadores.
4. Mude a largura $w$: $V_H$ não muda. Mude a espessura $t$: $V_H$ cai. Compare o cobre: $n$ enorme, $V_H$ minúsculo.`,
      predict: [
        {
          question: "Num metal ($n \\approx 10^{29}\\ \\text{m}^{-3}$) e num semicondutor ($n \\approx 10^{21}\\ \\text{m}^{-3}$) de mesma geometria, com a mesma I e B, a tensão Hall é:",
          options: ["maior no metal", "maior no semicondutor", "igual"],
          answer: 1,
          explanation: "$V_H = IB/(nqt)$: com menos portadores, cada um anda mais rápido para levar a mesma corrente e sente força magnética maior. Por isso sensores Hall usam semicondutores.",
        },
      ],
    },
  ],

  exercises: [
    {
      id: "torque",
      prompt: "Uma bobina quadrada de {N} espiras e lado {Lcm} cm conduz {Iesp} A num campo uniforme de {B} T. Qual é o torque máximo sobre ela?",
      vary: { N: [10, 200, 0], Lcm: [2, 10, 1], Iesp: [0.5, 5, 1], B: [0.1, 1, 2] },
      fixed: { modo: 0 },
      answer: { label: "τ_máx", unit: "N·m", compute: (p) => num(p, "N") * num(p, "Iesp") * (num(p, "Lcm") / 100) ** 2 * num(p, "B") },
      hint: "τ = NIAB sen θ, máximo com sen θ = 1.",
    },
    {
      id: "hall",
      prompt:
        "Uma placa semicondutora de espessura {esp} mm, com {nE20} × 10²⁰ portadores (carga e) por m³, conduz {ImA} mA num campo de {B} T perpendicular a ela. Qual é o módulo da tensão Hall, em milivolts?",
      vary: { esp: [0.2, 2, 1], nE20: [1, 50, 0], ImA: [1, 50, 0], B: [0.1, 1.5, 2] },
      fixed: { modo: 2 },
      answer: {
        label: "|V_H|",
        unit: "mV",
        compute: (p) => (((num(p, "ImA") / 1000) * num(p, "B")) / (num(p, "nE20") * 1e20 * 1.602176634e-19 * (num(p, "esp") / 1000))) * 1000,
      },
      hint: "V_H = IB/(nqt), tudo em unidades SI.",
    },
  ],

  init(p) {
    const rand = rng(7);
    const carriers: V2[] = [];
    for (let i = 0; i < 48; i++) carriers.push([rand() * 2 - 1, (rand() * 2 - 1) * 0.9]);
    return {
      th: (num(p, "theta0", 90) * Math.PI) / 180,
      w: 0,
      a: [-0.15, -0.06],
      b: [0.15, 0.06],
      VH: 0,
      carriers,
      drag: null,
    };
  },

  step(s, p, _t, dt) {
    const m = modo(p);
    if (m === 0) {
      if (s.drag === "coil") return s;
      const mp = motorParams(p);
      // RK4 em (θ, ω)
      const f = (th: number, w: number): [number, number] => [w, motorAccel(th, w, mp)];
      const [a1, b1] = f(s.th, s.w);
      const [a2, b2] = f(s.th + (dt / 2) * a1, s.w + (dt / 2) * b1);
      const [a3, b3] = f(s.th + (dt / 2) * a2, s.w + (dt / 2) * b2);
      const [a4, b4] = f(s.th + dt * a3, s.w + dt * b3);
      return { ...s, th: s.th + (dt / 6) * (a1 + 2 * a2 + 2 * a3 + a4), w: s.w + (dt / 6) * (b1 + 2 * b2 + 2 * b3 + b4) };
    }
    if (m === 2) {
      const Vss = hallSteady(p);
      // Relaxação exata para o valor de regime (câmera lenta)
      const VH = Vss + (s.VH - Vss) * Math.exp(-dt / HALL_TAU);
      const mat = material(p);
      const V0 = Math.abs(hallVoltage(IHall(p), 1, mat.n, 1, tHall(p))) || 1;
      // Força transversal normalizada: elétrica (q E_H) menos magnética (|q| v_d B, para baixo)
      const fy = clamp((mat.sinal * VH) / V0 - num(p, "B", 0.5), -1.5, 1.5);
      const vx = 0.35 * mat.sinal * Math.sign(IHall(p));
      const carriers = s.carriers.map(([x, y]): V2 => {
        let nx = x + vx * dt;
        if (nx > 1) nx -= 2;
        if (nx < -1) nx += 2;
        return [nx, clamp(y + 3 * fy * dt, -0.95, 0.95)];
      });
      return { ...s, VH, carriers };
    }
    return s;
  },
  dt: 5e-4,
  sampleEvery: 20,
  tEnd: 120,

  pointer: {
    down(s, p, pt) {
      const m = modo(p);
      if (m === 1) {
        if (Math.hypot(pt.x - s.a[0], pt.y - s.a[1]) < 0.02) return { ...s, drag: "a" };
        if (Math.hypot(pt.x - s.b[0], pt.y - s.b[1]) < 0.02) return { ...s, drag: "b" };
        return undefined;
      }
      if (m === 0 && Math.hypot(pt.x, pt.y) < MOTOR.coil * 1.1) return { ...s, drag: "coil", th: Math.atan2(pt.y, pt.x) - Math.PI / 2, w: 0 };
      return undefined;
    },
    move(s, p, pt, dragging) {
      if (!dragging || !s.drag) return undefined;
      if (s.drag === "coil") return { ...s, th: Math.atan2(pt.y, pt.x) - Math.PI / 2, w: 0 };
      const q: V2 = [clamp(pt.x, -0.28, 0.28), clamp(pt.y, -0.18, 0.18)];
      return s.drag === "a" ? { ...s, a: q } : { ...s, b: q };
    },
    up: (s) => (s.drag ? { ...s, drag: null } : undefined),
    cursor(s, p, pt) {
      const m = modo(p);
      if (m === 1) return Math.hypot(pt.x - s.a[0], pt.y - s.a[1]) < 0.02 || Math.hypot(pt.x - s.b[0], pt.y - s.b[1]) < 0.02 ? "grab" : undefined;
      if (m === 0 && Math.hypot(pt.x, pt.y) < MOTOR.coil * 1.1) return "grab";
      return undefined;
    },
  },

  viewport(p) {
    const m = modo(p);
    if (m === 1) return { xMin: -0.3, xMax: 0.3, yMin: -0.2, yMax: 0.2, unit: "m" };
    if (m === 2) return { xMin: -1.25, xMax: 1.45, yMin: -0.8, yMax: 0.8, unit: "" };
    return { xMin: -0.12, xMax: 0.32, yMin: -0.1, yMax: 0.1, unit: "" };
  },

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const m = modo(frame.params);
    if (m === 1) renderWire(d, frame.state, frame.params);
    else if (m === 2) renderHall(d, frame.state, frame.params);
    else renderMotor(d, frame.state, frame.params);
  },
});

export default motorHall;

// ---------------------------------------------------------------- desenho

/** Corrente saindo (⊙) ou entrando (⊗) da tela, raio em pixels. */
function currentSymbol(d: Draw, x: number, y: number, out: boolean, rPx: number, color: string) {
  const r = rPx * d.px;
  d.circle(x, y, r, { fill: d.theme.dark ? "#141a22" : "#ffffff", stroke: color, width: 1.5 });
  if (out) d.dot(x, y, rPx * 0.3, color);
  else {
    d.line(x - r * 0.65, y - r * 0.65, x + r * 0.65, y + r * 0.65, { color, width: 1.5 });
    d.line(x - r * 0.65, y + r * 0.65, x + r * 0.65, y - r * 0.65, { color, width: 1.5 });
  }
}

function renderMotor(d: Draw, s: MotorState, p: Params) {
  const { theme } = d;
  const mp = motorParams(p);
  const { tau, i } = motorTorque(s.th, s.w, mp);
  const { pole, coil } = MOTOR;
  // Polos do ímã e campo
  d.rect(-pole - 0.025, -0.075, 0.025, 0.15, { fill: theme.positive });
  d.rect(pole, -0.075, 0.025, 0.15, { fill: theme.negative });
  d.text("N", -pole - 0.0125, 0, { color: "#ffffff", size: 14, weight: "700" });
  d.text("S", pole + 0.0125, 0, { color: "#ffffff", size: 14, weight: "700" });
  for (const y of [-0.06, -0.03, 0.03, 0.06]) d.arrow(-pole + 0.004, y, 2 * pole - 0.008, 0, { color: theme.accent, width: 1, alpha: 0.45, head: 7 });
  d.text("B", pole - 0.01, 0.07, { color: theme.accent, size: 12, weight: "600" });

  // Espira vista de topo (eixo de rotação saindo da tela)
  const n: V2 = [Math.cos(s.th), Math.sin(s.th)];
  const u: V2 = [-n[1], n[0]];
  const r = coil * (mp.L / 0.1) * 0.6 + coil * 0.4;
  const p1: V2 = [u[0] * r, u[1] * r];
  const p2: V2 = [-u[0] * r, -u[1] * r];
  d.circle(0, 0, r, { stroke: theme.grid, width: 1, dash: [3, 3] });
  d.line(p1[0], p1[1], p2[0], p2[1], { color: theme.text, width: 4 });
  // i > 0: corrente sai da tela no lado p1 (convenção: μ = N i A n̂)
  const out1 = i >= 0;
  const cColor = theme.series[1] ?? theme.accent;
  if (Math.abs(i) > 1e-6) {
    currentSymbol(d, p1[0], p1[1], out1, 7, cColor);
    currentSymbol(d, p2[0], p2[1], !out1, 7, cColor);
    // Força F = i ℓ × B em cada lado (B em +x): lado com corrente saindo (+z) → F em +y
    const Fs = (out: boolean) => (out ? 1 : -1);
    const len = clamp(Math.abs(i) * 25, 14, 50);
    d.arrowPx(p1[0], p1[1] + 0.01 * Fs(out1), 0, Fs(out1), len, { color: theme.positive, width: 2.5 });
    d.arrowPx(p2[0], p2[1] - 0.01 * Fs(out1), 0, -Fs(out1), len, { color: theme.positive, width: 2.5 });
    d.text("F", p1[0] + 0.012, p1[1] + Fs(out1) * (0.012 + len * d.px * 0.6), { color: theme.positive, size: 12, weight: "600" });
  }
  // Normal / momento magnético
  d.arrowPx(0, 0, n[0] * Math.sign(i || 1), n[1] * Math.sign(i || 1), 36, { color: theme.series[2] ?? theme.accent, width: 2 });
  d.text("μ", n[0] * Math.sign(i || 1) * 44 * d.px, n[1] * Math.sign(i || 1) * 44 * d.px, { color: theme.series[2] ?? theme.accent, size: 12, weight: "700" });
  d.dot(0, 0, 3, theme.text);
  d.text(mp.comutador ? "comutador ligado" : "sem comutador", 0, -0.09, { color: mp.comutador ? theme.text : theme.positive, size: 11 });
  d.text("arraste a espira para girá-la", 0, 0.09, { color: theme.muted, size: 10 });

  // Gráfico τ(θ) com ω = 0 (torque de partida) e o ponto atual
  const { gx0, gx1, gy } = MOTOR;
  const NABV = (mp.N * mp.L * mp.L * mp.B * mp.V) / mp.R;
  const tmax = Math.max(NABV, Math.abs(tau), 1e-9) * 1.1;
  const X = (deg: number) => gx0 + ((gx1 - gx0) * deg) / 360;
  const Y = (t: number) => (t / tmax) * gy;
  d.line(gx0, -gy, gx0, gy, { color: theme.muted, width: 1 });
  d.line(gx0, 0, gx1, 0, { color: theme.muted, width: 1 });
  for (const a of [0, 90, 180, 270, 360]) d.text(`${a}°`, X(a), 0, { color: theme.muted, size: 9, baseline: "top", dy: 3 });
  d.text("θ", gx1, 0, { color: theme.muted, size: 11, align: "left", dx: 4 });
  d.text("τ(θ) na partida (ω = 0)", gx0, gy, { color: theme.text, size: 11, align: "left", baseline: "bottom", dy: -4 });
  const curve: V2[] = [];
  for (let a = 0; a <= 360; a += 2) {
    const sn = Math.sin((a * Math.PI) / 180);
    curve.push([X(a), Y(mp.comutador ? NABV * Math.abs(sn) : NABV * sn)]);
  }
  d.polyline(curve, { color: theme.accent, width: 2 });
  d.dot(X(wrap360(s.th)), Y(tau), 5, theme.positive);
  d.text(`● τ atual = ${si(tau, "N·m")} (inclui a fem)`, gx1, -gy, { color: theme.positive, size: 11, align: "right", baseline: "top" });
}

function renderWire(d: Draw, s: MotorState, p: Params) {
  const { theme } = d;
  const bdir = Math.round(num(p, "Bdir"));
  const B = num(p, "B", 0.5);
  const I = num(p, "Ifio", 5);
  // Campo
  for (let x = -0.27; x <= 0.27; x += 0.06)
    for (let y = -0.16; y <= 0.17; y += 0.06) {
      if (B <= 0) continue;
      if (bdir === 2) d.arrowPx(x - 0.012, y, 1, 0, 22, { color: theme.accent, width: 1, alpha: 0.4, head: 6 });
      else currentSymbol(d, x, y, bdir === 0, 4, theme.muted);
    }
  const pts = wirePoints(s.a, s.b, Math.round(num(p, "forma")));
  const color = theme.series[1] ?? theme.accent;
  d.polyline(pts, { color, width: 4 });
  // Sentido da corrente
  const k = Math.floor((pts.length - 1) / 2);
  const q0 = pts[k]!;
  const q1 = pts[k + 1]!;
  const sg = Math.sign(I) || 1;
  d.arrowPx((q0[0] + q1[0]) / 2, (q0[1] + q1[1]) / 2, sg * (q1[0] - q0[0]), sg * (q1[1] - q0[1]), 18, { color, width: 2 });
  d.text(`I = ${String(Math.abs(I)).replace(".", ",")} A`, (q0[0] + q1[0]) / 2, (q0[1] + q1[1]) / 2, { color, size: 12, weight: "600", dy: -16 });
  // dF em cada trecho (semicírculo)
  const F = wireF(s, p);
  if (pts.length > 2 && bdir !== 2) {
    for (let j = 1; j < pts.length; j += 3) {
      const df = wireForce([pts[j - 1]!, pts[j]!], I, B, bdir);
      d.arrowPx((pts[j - 1]![0] + pts[j]![0]) / 2, (pts[j - 1]![1] + pts[j]![1]) / 2, df[0], df[1], 14, { color: theme.positive, width: 1.2, alpha: 0.6, head: 5 });
    }
  }
  for (const e of [s.a, s.b]) d.circle(e[0], e[1], 0.011, { fill: theme.text, stroke: theme.text });
  d.text("a", s.a[0], s.a[1], { color: theme.dark ? "#141a22" : "#ffffff", size: 10, weight: "700" });
  d.text("b", s.b[0], s.b[1], { color: theme.dark ? "#141a22" : "#ffffff", size: 10, weight: "700" });
  // Força total no ponto médio da corda
  const mx = (s.a[0] + s.b[0]) / 2;
  const my = (s.a[1] + s.b[1]) / 2;
  const Fmag = Math.hypot(...F);
  if (Fmag > 1e-9) {
    if (bdir === 2) {
      currentSymbol(d, mx, my - 0.04, F[2] > 0, 9, theme.positive);
      d.text(`F ${F[2] > 0 ? "saindo" : "entrando"}: ${si(Fmag, "N")}`, mx, my - 0.04, { color: theme.positive, size: 12, weight: "600", dy: 20 });
    } else {
      d.arrowPx(mx, my, F[0], F[1], clamp(Fmag * 60, 24, 90), { color: theme.positive, width: 3 });
      const ux = F[0] / Fmag;
      const uy = F[1] / Fmag;
      d.text(`F = ${si(Fmag, "N")}`, mx + ux * clamp(Fmag * 60, 24, 90) * d.px, my + uy * clamp(Fmag * 60, 24, 90) * d.px, { color: theme.positive, size: 12, weight: "600", dy: uy > 0 ? -10 : 12 });
    }
  } else d.text("F = 0", mx, my - 0.03, { color: theme.positive, size: 12, weight: "600" });
  d.text("Arraste as pontas a e b do fio", -0.295, -0.195, { color: theme.muted, size: 10, align: "left", baseline: "bottom" });
}

function renderHall(d: Draw, s: MotorState, p: Params) {
  const { theme } = d;
  const mat = material(p);
  const { hx, hy } = SLAB;
  const B = num(p, "B", 0.5);
  d.rect(-hx, -hy, 2 * hx, 2 * hy, { fill: theme.dark ? "rgba(120,140,170,0.15)" : "rgba(120,140,170,0.12)", stroke: theme.muted, width: 1.5 });
  // B saindo da tela
  if (B > 0) for (let x = -0.8; x <= 0.81; x += 0.2) for (const y of [-0.55, 0.55]) currentSymbol(d, x, y, true, 4, theme.muted);
  d.text(`B = ${String(B).replace(".", ",")} T (saindo da tela)`, -hx, 0.7, { color: theme.muted, size: 11, align: "left" });
  // Corrente convencional
  d.arrowPx(-hx - 0.3, 0, 1, 0, 30, { color: theme.series[1] ?? theme.accent, width: 3 });
  d.arrowPx(hx + 0.02, 0, 1, 0, 20, { color: theme.series[1] ?? theme.accent, width: 3 });
  d.text("I", -hx - 0.2, 0.08, { color: theme.series[1] ?? theme.accent, size: 13, weight: "700" });
  // Cargas acumuladas nas bordas
  const Vss = hallSteady(p);
  const ref = Math.max(Math.abs(hallVoltage(IHall(p), 1, mat.n, 1, tHall(p))), 1e-30);
  const scale = Math.max(Math.abs(Vss), ref * 0.05);
  const nEdge = Math.round(clamp(Math.abs(s.VH) / scale, 0, 1) * 12);
  const bottomPos = s.VH > 0;
  for (let k = 0; k < nEdge; k++) {
    const x = -hx + ((k + 0.5) * 2 * hx) / nEdge;
    d.text(bottomPos ? "+" : "−", x, -hy - 0.07, { color: bottomPos ? theme.positive : theme.negative, size: 14, weight: "700" });
    d.text(bottomPos ? "−" : "+", x, hy + 0.07, { color: bottomPos ? theme.negative : theme.positive, size: 14, weight: "700" });
  }
  // Portadores
  const cc = mat.sinal > 0 ? theme.positive : theme.negative;
  for (const [x, y] of s.carriers) {
    d.dot(x * hx * 0.97, y * hy, 5, cc);
    d.text(mat.sinal > 0 ? "+" : "−", x * hx * 0.97, y * hy, { color: "#ffffff", size: 9, weight: "700" });
  }
  // Voltímetro
  const vx = 1.2;
  d.polyline([[0.6, -hy], [0.6, -0.62], [vx, -0.62], [vx, -0.18]], { color: theme.muted, width: 1.2 });
  d.polyline([[0.6, hy], [0.6, 0.62], [vx, 0.62], [vx, 0.18]], { color: theme.muted, width: 1.2 });
  d.circle(vx, 0, 0.18, { fill: theme.dark ? "#1c2430" : "#ffffff", stroke: theme.text, width: 1.5 });
  d.text("V", vx, 0.05, { color: theme.text, size: 13, weight: "700" });
  d.text(si(s.VH, "V"), vx, -0.06, { color: theme.text, size: 10 });
  d.text("+", vx + 0.06, -0.26, { color: theme.muted, size: 10 });
  d.text(`regime: V_H = IB/(nqt) = ${si(Vss, "V")}`, -hx, -0.72, { color: theme.text, size: 11, align: "left" });
  d.text(`${mat.nome}; v_d = ${si(driftVelocity(IHall(p), mat.n, wHall(p), tHall(p)), "m/s")}`, 1.4, 0.7, { color: theme.muted, size: 10, align: "right" });
  d.text("V_H = V(inferior) − V(superior)   (acúmulo em câmera lenta)", hx + 0.5, -0.72, { color: theme.muted, size: 9, align: "right", dy: 14 });
}

