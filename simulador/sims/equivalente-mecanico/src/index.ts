import { defineSim, draw, num, texNum, type Params } from "@fisilab/core";

export const G = 9.81;
/** Equivalente mecânico de referência (caloria a 15 °C), J/cal. */
export const J_REF = 4.186;
export const C_AGUA = 4186;
export const C_COBRE = 385;
/** Coeficiente de arrasto das pás: força total nos cordões F = B v² (N·s²/m²). */
export const B_PAS = 400;
/** Tempo para rebobinar os pesos com a embreagem solta (s). */
export const T_SOBE = 0.4;
/** Raio do cilindro de Callendar (m). */
export const R_CIL = 0.0225;

export interface Aparelho {
  /** Quedas (Joule) ou voltas (Callendar) completas. */
  n: number;
  /** 0 = pesos caindo / manivela girando, 1 = rebobinando, 2 = terminou. */
  fase: number;
  /** Altura da base dos pesos acima do chão (m). */
  y: number;
  /** Velocidade de descida (m/s). */
  v: number;
  /** Tempo decorrido na fase de rebobinar (s). */
  ts: number;
  /** Ângulo das pás ou do cilindro (rad). */
  th: number;
  /** Temperatura da água (°C). */
  T: number;
  /** Trabalho dissipado no líquido (J). */
  W: number;
  /** Energia potencial liberada (J). */
  Ep: number;
  /** Calor perdido para o ambiente (J). */
  Qp: number;
  /** Velocidade de chegada da última queda (m/s). */
  vf: number;
}

const callendar = (p: Params) => Math.round(num(p, "modo")) === 1;

/** Velocidade terminal dos pesos: 2mg = B v². */
export const terminalSpeed = (p: Params) => Math.sqrt((2 * num(p, "m", 10) * G) / B_PAS);

/** Capacidade térmica total (J/K): água + calorímetro (Joule) ou água + cilindro de cobre (Callendar). */
export function heatCapacity(p: Params): number {
  const agua = num(p, "mw", 0.5) * C_AGUA;
  return callendar(p) ? agua + num(p, "mcu", 0.4) * C_COBRE : agua + (num(p, "E", 50) / 1000) * C_AGUA;
}
/** A mesma capacidade em cal/K (o aluno calcula com c = 1 cal/(g·°C)). */
export const heatCapacityCal = (p: Params) => heatCapacity(p) / J_REF;

/** Velocidade de chegada ao chão depois de cair h a partir do repouso: v = v_t √(1 − e^(−2gh/v_t²)). */
export function arrivalSpeed(p: Params): number {
  const vt = terminalSpeed(p);
  return vt * Math.sqrt(1 - Math.exp((-2 * G * num(p, "h", 1.5)) / (vt * vt)));
}
/** Trabalho entregue à água por queda: 2m(gh − v_f²/2). */
export const workPerDrop = (p: Params) => 2 * num(p, "m", 10) * (G * num(p, "h", 1.5) - arrivalSpeed(p) ** 2 / 2);
/** Trabalho por volta no Callendar: 2πR·Mg. */
export const workPerTurn = (p: Params) => 2 * Math.PI * R_CIL * num(p, "M", 5) * G;
export const totalCount = (p: Params) => (callendar(p) ? Math.round(num(p, "voltas", 100)) : Math.round(num(p, "N", 10)));

/** ln cosh x sem estouro. */
const lncosh = (x: number) => Math.abs(x) + Math.log1p(Math.exp(-2 * Math.abs(x))) - Math.LN2;
/** acosh(e^lnC) sem estouro. */
const acoshExp = (lnC: number) => (lnC > 20 ? lnC + Math.LN2 : Math.acosh(Math.exp(lnC)));

function stepJoule(s: Aparelho, p: Params, dt: number): Aparelho {
  const m = num(p, "m", 10);
  const h = num(p, "h", 1.5);
  const vt = terminalSpeed(p);
  const C = heatCapacity(p);
  const N = totalCount(p);
  let { n, fase, y, v, ts, th, T, W, Ep, vf } = s;
  let rem = dt;
  let guard = 0;
  while (rem > 1e-15 && fase !== 2 && guard++ < 10) {
    if (fase === 0) {
      // dv/dt = g(1 − v²/v_t²): solução exata v = v_t tanh(a), queda Δy = (v_t²/g) Δ ln cosh(a).
      const a = Math.atanh(Math.min(v / vt, 1 - 1e-12));
      const tHit = (vt / G) * (acoshExp(lncosh(a) + (G * y) / (vt * vt)) - a);
      const tau = Math.min(rem, tHit);
      const a2 = a + (G * tau) / vt;
      const v2 = vt * Math.tanh(a2);
      const dy = tau === tHit ? y : Math.min(y, ((vt * vt) / G) * (lncosh(a2) - lncosh(a)));
      const dW = 2 * m * (G * dy - (v2 * v2 - v * v) / 2);
      W += dW;
      Ep += 2 * m * G * dy;
      T += dW / C;
      th += (dy / 0.03) * 1; // tambor de 3 cm de raio
      y -= dy;
      v = v2;
      rem -= tau;
      if (tau === tHit) {
        // Os pesos chegam ao chão: a energia cinética vai para o amortecedor, não para a água.
        n += 1;
        vf = v;
        v = 0;
        y = 0;
        ts = 0;
        fase = n >= N ? 2 : 1;
      }
    } else {
      const tau = Math.min(rem, T_SOBE - ts);
      ts += tau;
      y = (h * ts) / T_SOBE;
      rem -= tau;
      if (ts >= T_SOBE - 1e-12) {
        fase = 0;
        y = h;
        v = 0;
      }
    }
  }
  return { ...s, n, fase, y, v, ts, th, T, W, Ep, vf };
}

function stepCallendar(s: Aparelho, p: Params, dt: number): Aparelho {
  if (s.fase === 2) return s;
  const omega = 2 * Math.PI * num(p, "rot", 3);
  const thEnd = 2 * Math.PI * totalCount(p);
  const th = Math.min(thEnd, s.th + omega * dt);
  const dW = num(p, "M", 5) * G * R_CIL * (th - s.th);
  const n = Math.floor(th / (2 * Math.PI) + 1e-9);
  return { ...s, th, n, W: s.W + dW, Ep: s.Ep + dW, T: s.T + dW / heatCapacity(p), v: omega * R_CIL, fase: th >= thEnd - 1e-12 ? 2 : 0 };
}

const fmt = (v: number, d = 1) => v.toFixed(d).replace(".", ",");

// Geometria do palco (Joule)
const YP = 2.3; // altura das polias e do tambor
const XP = 0.95; // posição das polias
const CAL = { x0: -0.28, x1: 0.28, y0: 0, y1: 0.55 };
// Termômetro ampliado e gráfico T(t)
const TH = { x: -0.55, y0: 0.75, y1: 2.0 };
const GR = { x0: 0.18, x1: 0.74, y0: 0.85, y1: 1.65 };

export const equivalenteMecanico = defineSim<Aparelho>({
  id: "equivalente-mecanico",
  title: "Equivalente mecânico do calor (Joule e Callendar)",
  course: "Exp II",
  topic: "Calor",
  priority: "P1",
  summary:
    "Aparelho de Joule: dois pesos caem e giram pás dentro de um calorímetro com água, e o termômetro sobe a cada queda. Na alternativa de Callendar, uma manivela gira um cilindro de cobre contra uma fita de atrito. Compare o trabalho mecânico com o calor e obtenha J ≈ 4,19 J/cal, com ou sem perdas para o ambiente.",
  equations: [
    String.raw`W_{\text{queda}} = 2m\left(gh - \tfrac12 v_f^2\right), \qquad v_f = v_t\sqrt{1 - e^{-2gh/v_t^2}}, \quad v_t = \sqrt{2mg/B}`,
    String.raw`\text{Callendar: } W = 2\pi R\, M g\, N`,
    String.raw`Q = (m_a c_a + C_{\text{cal}})\,\Delta T \qquad J = \frac{W}{Q} \approx 4{,}186\ \text{J/cal}`,
    String.raw`C\,\frac{dT}{dt} = P_{\text{mec}} - G\,(T - T_{\text{amb}})`,
  ],
  liveEquations(s, p) {
    const Ccal = heatCapacityCal(p);
    const dT = s.T - num(p, "T0", 20);
    const Q = Ccal * dT;
    return [
      callendar(p)
        ? String.raw`W = 2\pi\cdot ${texNum(R_CIL)}\ \text{m}\cdot ${texNum(num(p, "M", 5))}\ \text{kg}\cdot ${texNum(G)}\ \text{m/s}^2\cdot ${texNum(s.th / (2 * Math.PI), 4)} = ${texNum(s.W, 4)}\ \text{J}`
        : String.raw`W = ${s.n}\cdot ${texNum(workPerDrop(p), 4)}\ \text{J} ${s.fase === 0 ? "+ \\ldots" : ""} = ${texNum(s.W, 4)}\ \text{J} \qquad v_f = ${texNum(s.vf, 3)}\ \text{m/s}`,
      String.raw`Q = ${texNum(Ccal, 4)}\ \text{cal/K}\cdot ${texNum(dT, 3)}\ \text{K} = ${texNum(Q, 4)}\ \text{cal}`,
      String.raw`\frac{W}{Q} = ${Math.abs(Q) > 1e-6 ? texNum(s.W / Q, 4) : String.raw`\text{—}`}\ \text{J/cal} \qquad Q_{\text{perdido}} = ${texNum(s.Qp / J_REF, 3)}\ \text{cal}`,
    ];
  },

  params: [
    {
      key: "modo", label: "Aparelho", unit: "", min: 0, max: 1, step: 1, default: 0,
      options: [
        { value: 0, label: "Joule: pesos que caem e giram pás" },
        { value: 1, label: "Callendar: cilindro de cobre e manivela" },
      ],
    },
    { key: "m", label: "Massa de cada peso (Joule)", unit: "kg", min: 1, max: 20, step: 0.1, default: 10 },
    { key: "h", label: "Altura de queda (Joule)", unit: "m", min: 0.5, max: 2, step: 0.01, default: 1.5 },
    { key: "N", label: "Número de quedas (Joule)", unit: "", min: 1, max: 40, step: 1, default: 10 },
    { key: "E", label: "Equivalente em água do calorímetro e pás", unit: "g", min: 0, max: 200, step: 1, default: 50 },
    { key: "M", label: "Massa suspensa na fita (Callendar)", unit: "kg", min: 1, max: 10, step: 0.1, default: 5 },
    { key: "voltas", label: "Número de voltas (Callendar)", unit: "", min: 10, max: 400, step: 1, default: 100 },
    { key: "rot", label: "Rotação da manivela (Callendar)", unit: "rev/s", min: 0.5, max: 5, step: 0.1, default: 3, live: true },
    { key: "mcu", label: "Massa do cilindro de cobre (Callendar)", unit: "kg", min: 0.1, max: 1, step: 0.01, default: 0.4 },
    { key: "mw", label: "Massa de água", unit: "kg", min: 0.02, max: 2, step: 0.01, default: 0.5 },
    { key: "T0", label: "Temperatura inicial da água", unit: "°C", min: 10, max: 30, step: 0.1, default: 20 },
    { key: "Ta", label: "Temperatura ambiente", unit: "°C", min: 10, max: 30, step: 0.1, default: 20 },
    { key: "Gp", label: "Perdas térmicas (condutância para o ambiente)", unit: "W/K", min: 0, max: 3, step: 0.05, default: 0 },
  ],

  observables: [
    { key: "W", label: "Trabalho mecânico dissipado na água", unit: "J", value: (s) => s.W },
    { key: "Ep", label: "Energia potencial liberada", unit: "J", value: (s) => s.Ep },
    { key: "T", label: "Temperatura da água", unit: "°C", value: (s) => s.T },
    { key: "dT", label: "Elevação de temperatura ΔT", unit: "K", value: (s, p) => s.T - num(p, "T0", 20) },
    { key: "Q", label: "Calor absorvido (água + calorímetro)", unit: "cal", value: (s, p) => heatCapacityCal(p) * (s.T - num(p, "T0", 20)) },
    {
      key: "razao", label: "Razão W/Q", unit: "J/cal",
      value: (s, p) => {
        const Q = heatCapacityCal(p) * (s.T - num(p, "T0", 20));
        return Math.abs(Q) > 1e-6 ? s.W / Q : 0;
      },
    },
    { key: "n", label: "Quedas/voltas completas", unit: "", value: (s) => s.n },
    { key: "y", label: "Altura dos pesos", unit: "m", value: (s) => s.y },
    { key: "vf", label: "Velocidade de chegada dos pesos", unit: "m/s", value: (s) => s.vf },
    { key: "Qp", label: "Calor perdido para o ambiente", unit: "cal", value: (s) => s.Qp / J_REF },
  ],
  chart: { x: "t", y: "T" },

  scenarios: [
    {
      id: "joule",
      label: "Aparelho de Joule",
      params: { modo: 0, m: 10, h: 1.5, N: 10, mw: 0.5, E: 50, T0: 20, Ta: 20, Gp: 0 },
      guide: `### Trabalho vira calor
1. Os dois pesos de 10 kg caem 1,5 m girando as pás. Ao chegar ao chão, são rebobinados com a embreagem solta e caem de novo.
2. Observe o termômetro ampliado: ele sobe **durante** cada queda e fica parado enquanto os pesos sobem.
3. Ao fim das 10 quedas calcule $W = N\\cdot 2m(gh - v_f^2/2)$ e $Q = (m_a\\cdot 1\\ \\text{cal/(g·°C)} + E)\\,\\Delta T$.
4. A razão $W/Q$ é o equivalente mecânico do calor, cerca de 4,19 J/cal.`,
      predict: [
        {
          question: "Se o número de quedas dobrar (mesmos pesos, mesma altura), a elevação de temperatura da água:",
          options: ["fica igual", "dobra", "quadruplica"],
          answer: 1,
          explanation: "Cada queda entrega a mesma energia $2m(gh - v_f^2/2)$ à água. Sem perdas, $\\Delta T = W/C$ é proporcional ao número de quedas.",
        },
      ],
    },
    {
      id: "perdas",
      label: "Perdas para o ambiente",
      params: { modo: 0, m: 10, h: 1.5, N: 20, mw: 0.5, E: 50, T0: 20, Ta: 20, Gp: 1.5 },
      guide: `### Por que o J medido sai maior
1. Agora o calorímetro troca calor com o ar ($G = 1{,}5$ W/K). A água começa na temperatura ambiente.
2. Ao esquentar, ela perde calor: o $\\Delta T$ final é menor do que $W/C$, e a razão $W/Q$ sai **acima** de 4,19 J/cal.
3. Compare a curva $T(t)$ com o cenário sem perdas: os degraus ficam inclinados para baixo nos intervalos.
4. No próximo cenário, a correção de Rumford reduz esse erro.`,
    },
    {
      id: "rumford",
      label: "Correção de Rumford",
      params: { modo: 0, m: 10, h: 1.5, N: 20, mw: 0.5, E: 50, T0: 18.8, Ta: 20, Gp: 1.5 },
      guide: `### Começar abaixo do ambiente
1. A água começa cerca de $\\Delta T/2$ abaixo do ambiente e termina cerca de $\\Delta T/2$ acima.
2. Na primeira metade ela **ganha** calor do ar; na segunda, perde: os dois efeitos quase se cancelam.
3. Compare $W/Q$ com o cenário anterior. Por que não fica exatamente 4,19 J/cal?`,
      predict: [
        {
          question: "Começando 1,2 °C abaixo do ambiente (e terminando ~1,2 °C acima), a razão W/Q medida fica:",
          options: ["mais longe de 4,19 J/cal", "bem mais perto de 4,19 J/cal", "igual à do cenário com perdas"],
          answer: 1,
          explanation: "A troca de calor é proporcional a $T - T_{amb}$. Com a temperatura oscilando em torno do ambiente, o calor recebido no início compensa quase todo o perdido no fim.",
        },
      ],
    },
    {
      id: "callendar",
      label: "Aparelho de Callendar",
      params: { modo: 1, M: 5, voltas: 100, rot: 3, mcu: 0.4, mw: 0.05, T0: 20, Ta: 20, Gp: 0 },
      guide: `### Atrito numa fita
1. Gire a manivela: a fita de náilon escorrega sobre o cilindro de cobre e segura a massa suspensa $M$ parada.
2. O atrito vale $Mg$, então cada volta realiza $W = 2\\pi R\\,Mg$ (com $R = 2{,}25$ cm).
3. O calor aquece o cobre e a pouca água dentro dele: $Q = (m_{Cu} c_{Cu} + m_a c_a)\\Delta T$, com $c_{Cu} = 0{,}092$ cal/(g·°C).
4. Calcule $J = W/Q$ após 100 voltas. A rotação da manivela muda o resultado?`,
    },
  ],

  exercises: [
    {
      id: "joule",
      prompt:
        "No aparelho de Joule, dois pesos de {m} kg caem {h} m, {N} vezes, girando as pás num calorímetro com {mw} kg de água (equivalente em água do recipiente e pás: {E} g). Desprezando perdas e a energia cinética de chegada, qual a elevação de temperatura?",
      vary: { m: [5, 15, 1], h: [1, 2, 2], N: [5, 30, 0], mw: [0.3, 1, 2], E: [20, 80, 0] },
      fixed: { modo: 0 },
      answer: { label: "ΔT", unit: "K", compute: (p) => (num(p, "N") * 2 * num(p, "m") * G * num(p, "h")) / heatCapacity(p) },
      hint: "W = N·2mgh e Q = (mₐ + E)·1 cal/(g·°C)·ΔT com 1 cal = 4,186 J.",
    },
    {
      id: "callendar",
      prompt:
        "No aparelho de Callendar (cilindro de raio 2,25 cm), uma massa de {M} kg fica suspensa na fita enquanto se dão {voltas} voltas. O cilindro de cobre tem {mcu} kg e contém {mw} kg de água. Sem perdas, quanto sobe a temperatura? (c do cobre = 385 J/(kg·K))",
      vary: { M: [2, 8, 1], voltas: [50, 300, 0], mcu: [0.2, 0.6, 2], mw: [0.03, 0.1, 2] },
      fixed: { modo: 1 },
      answer: { label: "ΔT", unit: "K", compute: (p) => (workPerTurn(p) * num(p, "voltas")) / heatCapacity(p) },
      hint: "Cada volta: W = 2πR·Mg.",
    },
  ],

  init: (p) => ({
    n: 0, fase: 0, y: callendar(p) ? 0 : num(p, "h", 1.5), v: 0, ts: 0, th: 0,
    T: num(p, "T0", 20), W: 0, Ep: 0, Qp: 0, vf: 0,
  }),
  step(s, p, _t, dt) {
    const next = callendar(p) ? stepCallendar(s, p, dt) : stepJoule(s, p, dt);
    const Gp = num(p, "Gp");
    if (Gp <= 0) return next;
    // Perda newtoniana com solução exata no passo.
    const C = heatCapacity(p);
    const Ta = num(p, "Ta", 20);
    const T = Ta + (next.T - Ta) * Math.exp((-Gp * dt) / C);
    return { ...next, T, Qp: next.Qp + C * (next.T - T) };
  },
  stopWhen: (s) => (s.fase === 2 ? -1 : 1),
  dt: 0.005,
  sampleEvery: 10,
  maxSamples: 6000,
  tEnd: 1500,

  viewport: () => ({ xMin: -1.25, xMax: 1.25, yMin: -0.15, yMax: 2.6, unit: "" }),

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const { state: s, params: p, theme, trail } = frame;
    const water = theme.series[0] ?? theme.accent;
    const T0 = num(p, "T0", 20);
    const total = totalCount(p);
    const expected = (callendar(p) ? workPerTurn(p) : workPerDrop(p)) * total / heatCapacity(p);
    const span = Math.max(1, Math.ceil(expected + 0.5));
    const Tlo = Math.min(T0, num(p, "Ta", 20)) - 0.5;
    const Thi = Math.max(T0 + span, num(p, "Ta", 20) + 0.5);

    d.support(-1.2, 0, 1.2, 0, { color: theme.muted });

    if (!callendar(p)) {
      const h = num(p, "h", 1.5);
      // Calorímetro com água e pás
      d.rect(CAL.x0, CAL.y0, CAL.x1 - CAL.x0, CAL.y1 - CAL.y0, { fill: theme.muted, alpha: 0.25, stroke: theme.text, width: 2 });
      d.rect(CAL.x0 + 0.03, CAL.y0 + 0.03, CAL.x1 - CAL.x0 - 0.06, 0.4, { fill: water, alpha: 0.35 });
      d.rect(CAL.x0 - 0.02, CAL.y1, CAL.x1 - CAL.x0 + 0.04, 0.04, { fill: theme.muted });
      d.line(0, 0.05, 0, YP, { color: theme.text, width: 3 });
      for (let i = 0; i < 4; i++) {
        const yb = 0.1 + i * 0.085;
        for (let j = 0; j < 4; j++) {
          const ang = s.th + (j * Math.PI) / 2 + i * 0.4;
          const xv = 0.2 * Math.cos(ang);
          const front = Math.sin(ang) > 0;
          d.line(0, yb, xv, yb, { color: theme.text, width: front ? 4 : 2, alpha: front ? 1 : 0.45 });
        }
        // Defletores fixos
        d.line(CAL.x0 + 0.03, yb + 0.04, CAL.x0 + 0.06, yb + 0.04, { color: theme.muted, width: 3 });
        d.line(CAL.x1 - 0.03, yb + 0.04, CAL.x1 - 0.06, yb + 0.04, { color: theme.muted, width: 3 });
      }
      d.text("calorímetro com pás", 0, -0.08, { color: theme.text, size: 10 });
      // Tambor, cordões e polias
      d.rect(-0.05, YP - 0.04, 0.1, 0.08, { fill: theme.muted, stroke: theme.text, width: 1 });
      d.line(-0.05, YP + 0.04, -0.12, YP + 0.04, { color: theme.text, width: 1 });
      const rp = 0.06;
      for (const sx of [-1, 1]) {
        const px = sx * XP;
        d.line(sx * 0.05, YP + 0.04, px, YP + rp, { color: theme.text, width: 1.2 });
        d.circle(px, YP, rp, { fill: theme.muted, stroke: theme.text, width: 1.5 });
        d.line(px, YP, px + Math.cos(s.th * 0.5 * sx) * rp, YP + Math.sin(s.th * 0.5 * sx) * rp, { color: theme.text, width: 1 });
        d.line(px + sx * 0.12, 0, px + sx * 0.12, YP, { color: theme.muted, width: 4 });
        d.line(px, YP, px + sx * 0.12, YP, { color: theme.muted, width: 3 });
        const xm = px + sx * rp;
        const wm = 0.08 + 0.025 * Math.sqrt(num(p, "m", 10));
        const hm = 0.12 + 0.03 * Math.sqrt(num(p, "m", 10));
        d.line(xm, YP, xm, s.y + hm, { color: theme.text, width: 1.2 });
        d.rect(xm - wm / 2, s.y, wm, hm, { fill: theme.text });
        d.text(`${fmt(num(p, "m", 10), 1)} kg`, xm, s.y + hm / 2, { color: theme.dark ? "#1c2430" : "#ffffff", size: 9 });
        if (s.fase === 0 && s.v > 0.01) d.arrowPx(xm - sx * (wm / 2 + 0.04), s.y + hm / 2, 0, -1, 26, { color: theme.accent });
      }
      // Escala da altura junto ao peso da direita
      const xs = XP + 0.12 + 0.07;
      d.line(xs, 0, xs, h, { color: theme.muted, width: 1 });
      for (let c = 0; c <= Math.round(h * 10); c++) d.line(xs, c / 10, xs + (c % 5 === 0 ? 0.04 : 0.02), c / 10, { color: theme.muted, width: 1 });
      d.line(xs - 0.03, h, xs + 0.05, h, { color: theme.positive, width: 2 });
      d.text(`h = ${fmt(h, 2)} m`, xs + 0.01, h + 0.06, { color: theme.text, size: 10 });
      d.text(s.fase === 1 ? "rebobinando (pás soltas)" : s.fase === 2 ? "fim" : "caindo", XP, YP + 0.17, { color: theme.muted, size: 10 });
      d.text(`queda ${Math.min(total, s.n + (s.fase === 2 ? 0 : 1))} de ${total}`, -XP, YP + 0.17, { color: theme.text, size: 11, weight: "600" });
      // Termômetro mergulhado
      d.line(0.15, 0.2, 0.15, 0.75, { color: theme.positive, width: 2 });
      d.line(0.15, 0.75, TH.x + 0.04, (TH.y0 + TH.y1) / 2, { color: theme.muted, dash: [3, 3], width: 1 });
    } else {
      // ---------- Callendar
      const cx = 0;
      const cy = 1.1;
      const R = 0.32;
      d.rect(-0.08, 0, 0.16, cy - R, { fill: theme.muted, alpha: 0.5 });
      d.circle(cx, cy, R, { fill: "#c26a3d", stroke: theme.text, width: 2 });
      d.circle(cx, cy, R * 0.75, { fill: water, alpha: 0.3 });
      for (let i = 0; i < 6; i++) {
        const a = s.th + (i * Math.PI) / 3;
        d.line(cx + Math.cos(a) * R * 0.78, cy + Math.sin(a) * R * 0.78, cx + Math.cos(a) * R * 0.95, cy + Math.sin(a) * R * 0.95, { color: theme.text, width: 1 });
      }
      // Fita sobre a metade de cima
      const band: [number, number][] = [];
      for (let i = 0; i <= 40; i++) {
        const a = Math.PI - (Math.PI * i) / 40;
        band.push([cx + Math.cos(a) * (R + 0.015), cy + Math.sin(a) * (R + 0.015)]);
      }
      d.polyline(band, { color: theme.series[2], width: 4 });
      // Massa suspensa à esquerda, dinamômetro (quase sem tensão) à direita
      const M = num(p, "M", 5);
      const wm = 0.12 + 0.03 * Math.sqrt(M);
      d.line(cx - R - 0.015, cy, cx - R - 0.015, 0.45, { color: theme.series[2], width: 3 });
      d.rect(cx - R - 0.015 - wm / 2, 0.45 - wm * 1.2, wm, wm * 1.2, { fill: theme.text });
      d.text(`M = ${fmt(M, 1)} kg`, cx - R - 0.015, 0.45 - wm * 1.2 - 0.06, { color: theme.text, size: 10 });
      d.line(cx + R + 0.015, cy, cx + R + 0.015, 0.55, { color: theme.series[2], width: 3 });
      d.spring(cx + R + 0.015, 0.55, cx + R + 0.015, 0.25, { color: theme.text, coils: 6, amplitudePx: 5 });
      d.line(cx + R + 0.015, 0.25, cx + R + 0.015, 0, { color: theme.text, width: 2 });
      d.text("dinamômetro ≈ 0", cx + R + 0.06, 0.4, { color: theme.muted, size: 9, align: "left" });
      // Manivela
      const ca = s.th;
      d.line(cx, cy, cx + Math.cos(ca) * 0.55, cy + Math.sin(ca) * 0.55, { color: theme.text, width: 5 });
      d.dot(cx + Math.cos(ca) * 0.55, cy + Math.sin(ca) * 0.55, 7, theme.accent);
      d.dot(cx, cy, 5, theme.text);
      d.text(`volta ${Math.min(total, s.n)} de ${total} · ${fmt(num(p, "rot", 3), 1)} rev/s`, -XP, YP + 0.17, { color: theme.text, size: 11, weight: "600", align: "left" });
      d.text("cilindro de cobre com água", cx, cy + R + 0.12, { color: theme.text, size: 10 });
      d.line(cx + 0.1, cy, TH.x + 0.04, (TH.y0 + TH.y1) / 2, { color: theme.muted, dash: [3, 3], width: 1 });
    }

    // Termômetro de precisão ampliado
    const ty = (T: number) => TH.y0 + 0.06 + ((Math.min(Thi, Math.max(Tlo, T)) - Tlo) / (Thi - Tlo)) * (TH.y1 - TH.y0 - 0.08);
    d.rect(TH.x - 0.03, TH.y0, 0.06, TH.y1 - TH.y0, { fill: theme.dark ? "#1d232c" : "#ffffff", stroke: theme.muted, width: 1 });
    d.circle(TH.x, TH.y0, 0.045, { fill: theme.positive });
    d.rect(TH.x - 0.012, TH.y0, 0.024, ty(s.T) - TH.y0, { fill: theme.positive });
    const stepT = Thi - Tlo > 6 ? 1 : 0.5;
    for (let T = Math.ceil(Tlo / 0.1) * 0.1; T <= Thi + 1e-9; T += 0.1) {
      const major = Math.abs(T / stepT - Math.round(T / stepT)) < 1e-6;
      d.line(TH.x + 0.03, ty(T), TH.x + (major ? 0.06 : 0.045), ty(T), { color: theme.text, width: major ? 1 : 0.5 });
      if (major) d.text(fmt(T, 1), TH.x + 0.07, ty(T), { color: theme.muted, size: 9, align: "left" });
    }
    d.text(`${fmt(s.T, 2)} °C`, TH.x, TH.y1 + 0.07, { color: theme.text, size: 13, weight: "600" });
    d.text("termômetro (0,1 °C)", TH.x, TH.y1 + 0.16, { color: theme.muted, size: 9 });

    // Gráfico T(t)
    d.rect(GR.x0, GR.y0, GR.x1 - GR.x0, GR.y1 - GR.y0, { stroke: theme.grid, width: 1 });
    const tMax = Math.max(5, frame.t, total * (callendar(p) ? 1 / num(p, "rot", 3) : num(p, "h", 1.5) / terminalSpeed(p) + T_SOBE));
    const gx = (t: number) => GR.x0 + (t / tMax) * (GR.x1 - GR.x0);
    const gy = (T: number) => GR.y0 + ((Math.min(Thi, Math.max(Tlo, T)) - Tlo) / (Thi - Tlo)) * (GR.y1 - GR.y0);
    const dtS = frame.t / Math.max(1, trail.length - 1);
    const pts: [number, number][] = trail.map((st, i) => [gx(Math.min(tMax, i * dtS)), gy(st.T)]);
    pts.push([gx(Math.min(tMax, frame.t)), gy(s.T)]);
    d.polyline(pts, { color: theme.positive, width: 1.5 });
    d.line(GR.x0, gy(num(p, "Ta", 20)), GR.x1, gy(num(p, "Ta", 20)), { color: theme.muted, dash: [4, 3], width: 1 });
    d.text("T(t)", GR.x0 + 0.02, GR.y1 - 0.05, { color: theme.text, size: 10, align: "left" });
    d.text("ambiente", GR.x1 - 0.02, gy(num(p, "Ta", 20)) + 0.05, { color: theme.muted, size: 9, align: "right" });

    // Leituras
    const Q = heatCapacityCal(p) * (s.T - T0);
    d.text(
      `W = ${fmt(s.W, 1)} J   ·   ΔT = ${fmt(s.T - T0, 2)} K   ·   Q = ${fmt(Q, 1)} cal   ·   W/Q = ${Math.abs(Q) > 1e-3 ? fmt(s.W / Q, 3) : "—"} J/cal`,
      0,
      2.5,
      { color: theme.text, size: 12, weight: "600" },
    );
  },
});

export default equivalenteMecanico;
