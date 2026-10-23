import { clamp, defineSim, draw, num, texNum, type Draw, type Params, type Theme } from "@fisilab/core";
import { C, FLOW, I, L, LC, Q, R, RL, RLC, SW, UB, UE, V0, WR, WS, alpha, didt, init, mode, omega0, setSwitch, sourceV, step, tauRL } from "./model.ts";
import { battery, capacitor, currentArrow, inductor, resistor, si } from "./symbols.ts";

export * from "./model.ts";

const XS = 1.6; // fonte (RL) ou capacitor (LC)
const XL = 6.6; // indutor
const YT = 6.5;
const YB = 1.5;
const SWITCH = { a: [3.0, 6.5] as const, b: [3.0, 5.4] as const, c: [4.1, 6.5] as const };
const onSwitch = (x: number, y: number) => Math.hypot(x - 3.55, y - 6.05) < 0.9;

const vl = (s: number[], p: Params) => L(p) * didt(s, p);
const vc = (s: number[], p: Params) => (mode(p) === RL ? 0 : s[Q]! / C(p));
/** Corrente de referência para escalas: I∞ = V0/R no RL, I_max = V0√(C/L) no LC. */
const iRef = (p: Params) => (mode(p) === RL ? V0(p) / R(p) : V0(p) * Math.sqrt(C(p) / L(p)));
const eRef = (p: Params) => (mode(p) === RL ? 0.5 * L(p) * iRef(p) ** 2 : 0.5 * C(p) * V0(p) ** 2);

export const rlLc = defineSim({
  id: "rl-lc",
  title: "Circuitos RL e LC",
  course: "FG III",
  topic: "Indutância",
  priority: "P1",
  summary:
    "No RL a corrente sobe e cai com constante de tempo τ = L/R; no LC a energia passa do campo elétrico do capacitor para o campo magnético do indutor e volta, com ω = 1/√(LC). Com um resistor pequeno, o RLC oscila amortecido.",
  equations: [
    String.raw`\text{RL: } L\frac{di}{dt} + R\,i = V_{\text{fonte}} \;\Rightarrow\; i = \frac{V_0}{R}\left(1 - e^{-t/\tau}\right),\quad \tau = \frac{L}{R}`,
    String.raw`\text{LC: } \frac{d^2q}{dt^2} + \frac{q}{LC} = 0 \;\Rightarrow\; q = Q_0\cos\omega_0 t,\quad \omega_0 = \frac{1}{\sqrt{LC}}`,
    String.raw`\text{RLC: } \ddot q + \frac{R}{L}\dot q + \frac{q}{LC} = 0,\quad q = Q_0 e^{-\alpha t}\cos(\omega_d t + \phi),\ \alpha = \frac{R}{2L},\ \omega_d = \sqrt{\omega_0^2 - \alpha^2}`,
    String.raw`U_E = \frac{q^2}{2C} \qquad U_B = \tfrac12 L i^2 \qquad U_E + U_B + W_R = U_0`,
  ],
  liveEquations(s, p) {
    const m = mode(p);
    if (m === RL)
      return [
        String.raw`\tau = \frac{L}{R} = \frac{${texNum(L(p))}\ \text{H}}{${texNum(R(p))}\ \Omega} = ${texNum(tauRL(p))}\ \text{s} \qquad I_\infty = \frac{V_0}{R} = ${texNum(V0(p) / R(p))}\ \text{A}`,
        String.raw`i = ${texNum(s[I]!)}\ \text{A} \qquad V_L = L\frac{di}{dt} = ${texNum(vl(s, p))}\ \text{V} \qquad U_B = ${texNum(UB(s, p))}\ \text{J}`,
      ];
    const w0 = omega0(p);
    const a = alpha(p);
    const eqs = [
      String.raw`\omega_0 = \frac{1}{\sqrt{LC}} = ${texNum(w0)}\ \text{rad/s} \qquad T_0 = ${texNum((2 * Math.PI) / w0)}\ \text{s}`,
      String.raw`U_E = ${texNum(UE(s, p))}\ \text{J} \qquad U_B = ${texNum(UB(s, p))}\ \text{J} \qquad U_E + U_B = ${texNum(UE(s, p) + UB(s, p))}\ \text{J}`,
    ];
    if (m === RLC) {
      const wd2 = w0 * w0 - a * a;
      eqs.push(
        wd2 > 0
          ? String.raw`\alpha = ${texNum(a)}\ \text{s}^{-1} \qquad \omega_d = ${texNum(Math.sqrt(wd2))}\ \text{rad/s} \qquad Q = \frac{\omega_0 L}{R} = ${texNum((w0 * L(p)) / R(p))}`
          : String.raw`\alpha = ${texNum(a)}\ \text{s}^{-1} \ge \omega_0:\ \text{sem oscilação (amortecimento ${wd2 === 0 ? "crítico" : "supercrítico"})}`,
      );
    }
    return eqs;
  },

  params: [
    {
      key: "circuito",
      label: "Circuito",
      unit: "",
      min: 0,
      max: 2,
      step: 1,
      default: 0,
      options: [
        { value: RL, label: "RL com fonte e chave" },
        { value: LC, label: "LC ideal (capacitor carregado)" },
        { value: RLC, label: "RLC amortecido" },
      ],
    },
    { key: "V0", label: "Tensão V₀ (fonte no RL, capacitor no LC)", unit: "V", min: 1, max: 12, step: 0.5, default: 6 },
    { key: "R", label: "Resistência R", unit: "Ω", min: 0.1, max: 1000, step: 0.1, default: 10, log: true, live: true },
    { key: "L", label: "Indutância L", unit: "H", min: 0.01, max: 10, step: 0.01, default: 1, log: true },
    { key: "C", label: "Capacitância C", unit: "µF", min: 10, max: 10000, step: 10, default: 1000, log: true },
  ],

  observables: [
    { key: "i", label: "Corrente i", unit: "A", value: (s) => s[I]! },
    { key: "q", label: "Carga no capacitor q", unit: "C", value: (s, p) => (mode(p) === RL ? 0 : s[Q]!) },
    { key: "Vc", label: "Tensão no capacitor", unit: "V", value: (s, p) => vc(s, p) },
    { key: "Vl", label: "Tensão no indutor L di/dt", unit: "V", value: (s, p) => vl(s, p) },
    { key: "Vr", label: "Tensão no resistor R i", unit: "V", value: (s, p) => R(p) * s[I]! },
    { key: "UE", label: "Energia elétrica U_E (capacitor)", unit: "J", value: (s, p) => UE(s, p) },
    { key: "UB", label: "Energia magnética U_B (indutor)", unit: "J", value: (s, p) => UB(s, p) },
    { key: "U", label: "Energia armazenada U_E + U_B", unit: "J", value: (s, p) => UE(s, p) + UB(s, p) },
    { key: "WR", label: "Energia dissipada no resistor", unit: "J", value: (s) => s[WR]! },
    { key: "WS", label: "Trabalho da fonte", unit: "J", value: (s) => s[WS]! },
    { key: "Ps", label: "Potência da fonte", unit: "W", value: (s, p) => sourceV(p, s) * s[I]! },
    { key: "Pr", label: "Potência dissipada R i²", unit: "W", value: (s, p) => R(p) * s[I]! ** 2 },
    { key: "bal", label: "U_E + U_B + W_R − W_fonte", unit: "J", value: (s, p) => UE(s, p) + UB(s, p) + s[WR]! - s[WS]! },
  ],
  conserved: "bal",
  chart: { x: "t", y: "i" },

  scenarios: [
    {
      id: "rl",
      label: "RL: corrente subindo e caindo",
      params: { circuito: RL, V0: 6, R: 10, L: 1 },
      guide: `### A inércia do indutor
1. Clique em **Iniciar**. A corrente não salta para $V_0/R$: o indutor gera $V_L = L\\,di/dt$ contra a variação.
2. No gráfico de **i × t**, confira que em $t = \\tau = L/R$ a corrente vale $63\\%$ de $I_\\infty = V_0/R$.
3. Quando a corrente estabilizar, clique em **Chave em B**: a corrente cai com o mesmo $\\tau$, mantida pela energia magnética $\\tfrac12 L i^2$.
4. Observe as barras de potência: $P_{\\text{fonte}} = R i^2 + \\frac{d}{dt}\\left(\\tfrac12 L i^2\\right)$.`,
      predict: [
        {
          question: "Se você dobrar a indutância L (mantendo R), o tempo para a corrente chegar a 63 % do valor final:",
          options: ["cai pela metade", "dobra", "não muda", "quadruplica"],
          answer: 1,
          explanation: "$\\tau = L/R$: com o dobro de $L$, o indutor resiste o dobro à variação e a subida demora o dobro. O valor final $V_0/R$ não muda.",
        },
      ],
    },
    {
      id: "lc",
      label: "LC: energia indo e voltando",
      params: { circuito: LC, V0: 6, L: 1, C: 1000 },
      guide: `### Oscilador elétrico
O capacitor começa carregado com $V_0$ e é ligado ao indutor em $t = 0$.
1. Acompanhe as barras: a energia elétrica $U_E$ vira energia magnética $U_B$ e volta. A soma não muda.
2. Plote **U_E** e **U_B** contra **t**: elas oscilam com período $T_0/2$, metade do período da corrente.
3. Confira $T_0 = 2\\pi\\sqrt{LC}$ medindo o tempo entre dois máximos de **q**.
4. A corrente máxima vale $V_0\\sqrt{C/L}$: é quando toda a energia está no indutor.`,
      predict: [
        {
          question: "Comparado ao período T₀ da corrente, a energia do capacitor U_E oscila com período:",
          options: ["T₀", "T₀/2", "2T₀"],
          answer: 1,
          explanation: "$U_E \\propto q^2 \\propto \\cos^2\\omega_0 t = \\tfrac12(1 + \\cos 2\\omega_0 t)$: a energia oscila com o dobro da frequência.",
        },
      ],
    },
    {
      id: "rlc",
      label: "RLC: oscilação amortecida",
      params: { circuito: RLC, V0: 6, R: 5, L: 1, C: 1000 },
      guide: `### Amortecimento
1. Com $R$ pequeno a oscilação continua, mas a amplitude decai como $e^{-\\alpha t}$, com $\\alpha = R/2L$.
2. A energia armazenada decai como $e^{-2\\alpha t}$; a barra de energia dissipada cresce até $U_0$.
3. O fator de qualidade $Q = \\omega_0 L/R$ conta, grosso modo, quantas oscilações cabem antes de a energia cair bastante (perda de $2\\pi/Q$ por ciclo).
4. Mude **R** ao vivo e veja o decaimento acelerar.`,
      predict: [
        {
          question: "Com R pequeno, a frequência de oscilação do RLC comparada à do LC ideal é:",
          options: ["um pouco menor", "um pouco maior", "exatamente igual"],
          answer: 0,
          explanation: "$\\omega_d = \\sqrt{\\omega_0^2 - \\alpha^2}$ é ligeiramente menor que $\\omega_0$; com $R$ pequeno a diferença quase não se nota.",
        },
      ],
    },
    {
      id: "critico",
      label: "Amortecimento crítico",
      params: { circuito: RLC, V0: 6, R: 63.2, L: 1, C: 1000 },
      guide: `### Sem oscilação
Para $R = 2\\sqrt{L/C}$ ($\\alpha = \\omega_0$) o capacitor descarrega o mais depressa possível **sem** oscilar.
1. Plote **q** contra **t**: não há troca de sinal.
2. Aumente **R** (superamortecido): a descarga fica mais lenta.
3. Diminua **R** abaixo do crítico: aparece uma pequena ultrapassagem.`,
    },
  ],

  exercises: [
    {
      id: "rl-corrente",
      prompt:
        "Um indutor de {L} H em série com um resistor de {R} Ω é ligado em t = 0 a uma bateria ideal de {V0} V. Qual é a corrente depois de {tms} ms?",
      vary: { L: [0.1, 10, 2], R: [1, 100, 0], V0: [1, 12, 1], tms: [5, 500, 0] },
      fixed: { circuito: RL },
      answer: {
        label: "i",
        unit: "A",
        compute: (p) => (num(p, "V0") / num(p, "R")) * (1 - Math.exp((-num(p, "R") * num(p, "tms") * 1e-3) / num(p, "L"))),
      },
      hint: "i(t) = (V₀/R)(1 − e^{−Rt/L}).",
    },
    {
      id: "lc-imax",
      prompt:
        "Um capacitor de {C} µF carregado com {V0} V é ligado a um indutor ideal de {L} H. Qual é a corrente máxima no circuito?",
      vary: { C: [10, 5000, 0], V0: [1, 12, 1], L: [0.01, 10, 2] },
      fixed: { circuito: LC },
      answer: { label: "I_max", unit: "A", compute: (p) => num(p, "V0") * Math.sqrt((num(p, "C") * 1e-6) / num(p, "L")) },
      hint: "Toda a energia ½CV₀² vira ½L I²_max.",
    },
  ],

  init,
  step: (s, p, _t, dt) => step(s, p, dt),
  dt: 1e-4,
  sampleEvery: 10,

  narrowSplit: () => 0.588,
  viewport: () => ({ xMin: -0.2, xMax: 14.2, yMin: -0.4, yMax: 8.2 }),

  pointer: {
    down: (s, p, pt) => (mode(p) === RL && onSwitch(pt.x, pt.y) ? setSwitch(s, p, Math.round(s[SW]!) === 1 ? 0 : 1) : undefined),
    cursor: (_s, p, pt) => (mode(p) === RL && onSwitch(pt.x, pt.y) ? "pointer" : undefined),
  },

  actions: [
    { id: "chave-a", label: "Chave em A (ligar fonte)", run: (s, p) => setSwitch(s, p, 1), active: (s) => Math.round(s[SW]!) === 1 },
    { id: "chave-b", label: "Chave em B (curto, sem fonte)", run: (s, p) => setSwitch(s, p, 0), active: (s) => Math.round(s[SW]!) === 0 },
  ],

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const { state: s, params: p, theme } = frame;
    drawCircuit(d, theme, s, p);
    if (mode(p) === RL) drawPowerPanel(d, theme, s, p);
    else drawEnergyPanel(d, theme, s, p);
  },
});

function drawCircuit(d: Draw, theme: Theme, s: number[], p: Params) {
  const col = theme.text;
  const m = mode(p);
  const i = s[I]!;
  const ir = iRef(p);
  const sw = Math.round(s[SW]!);

  // Campo magnético no indutor: laços em torno da bobina, opacidade ∝ U_B / U_ref
  const fb = clamp(UB(s, p) / Math.max(eRef(p), 1e-30), 0, 1);
  if (fb > 0.01) {
    for (const k of [1, 2]) {
      const rx = 0.35 + 0.35 * k;
      const ry = 1.5 + 0.3 * k;
      const pts: [number, number][] = [];
      for (let j = 0; j <= 60; j++) pts.push([XL + 0.2 + rx * Math.cos((j / 60) * 2 * Math.PI), 4 + ry * Math.sin((j / 60) * 2 * Math.PI)]);
      d.polyline(pts, { color: theme.series[1]!, width: 1.5, alpha: 0.85 * fb });
    }
    // Sentido do campo dentro da bobina (para baixo quando a corrente horária desce pelo indutor)
    d.arrow(XL + 0.2, 4 + Math.sign(i) * 0.9, 0, -Math.sign(i) * 1.8, { color: theme.series[1]!, width: 2, alpha: Math.max(0.25, fb) });
    d.text("campo B", XL + 1.35, 6.0, { color: theme.series[1]!, size: 13, weight: "700" });
  }

  // Fios e componentes
  d.line(XS, YB, XL, YB, { color: col, width: 2 });
  inductor(d, XL, YT, XL, YB, 1.3, { color: col, loops: 5 });
  d.text(`L = ${si(L(p), "H")}`, XL - 0.35, 4, { color: theme.muted, size: 12, align: "right" });

  if (m === RL) {
    battery(d, XS, YB, XS, YT, { color: col });
    d.text(`V₀ = ${si(V0(p), "V")}`, XS - 0.45, 4, { color: theme.muted, size: 12, align: "right" });
    d.line(XS, YT, SWITCH.a[0], YT, { color: col, width: 2 });
    d.line(SWITCH.b[0], SWITCH.b[1], SWITCH.b[0], YB, { color: col, width: 2 });
    for (const q of [SWITCH.a, SWITCH.b, SWITCH.c]) d.circle(q[0], q[1], 4 * d.px, { fill: theme.dark ? "#111" : "#fff", stroke: col, width: 1.5 });
    const to = sw === 1 ? SWITCH.a : SWITCH.b;
    d.line(SWITCH.c[0], SWITCH.c[1], to[0] + 0.08, to[1] + (sw === 1 ? 0 : 0.06), { color: theme.accent, width: 3 });
    d.text("A", SWITCH.a[0], SWITCH.a[1] + 0.35, { color: sw === 1 ? theme.accent : theme.muted, size: 12, weight: "600" });
    d.text("B", SWITCH.b[0] - 0.3, SWITCH.b[1], { color: sw === 0 ? theme.accent : theme.muted, size: 12, weight: "600" });
    d.text("clique na chave", 3.55, 7.35, { color: theme.muted, size: 10 });
    resistor(d, SWITCH.c[0], YT, XL, YT, 0.9, { color: col });
    d.text(`R = ${si(R(p), "Ω")}`, (SWITCH.c[0] + XL) / 2, YT - 0.5, { color: theme.muted, size: 12 });
  } else {
    const cap = capacitor(d, XS, YT, XS, YB, { color: col, gapPx: 30, platePx: 50 });
    d.text(`C = ${si(C(p), "F")}`, XS - 0.75, 4, { color: theme.muted, size: 12, align: "right" });
    // Campo elétrico entre as placas e sinais de carga
    const q = s[Q]!;
    const q0 = C(p) * V0(p);
    const fe = clamp(Math.abs(q) / q0, 0, 1);
    if (fe > 0.02) {
      const len = cap.pb[1] - cap.pa[1]; // negativo: da placa superior para a inferior
      for (const dx of [-0.32, 0, 0.32]) {
        const from = q > 0 ? cap.pa[1] : cap.pb[1];
        d.arrow(XS + dx, from + (q > 0 ? -3 : 3) * d.px, 0, (q > 0 ? len : -len) + (q > 0 ? 6 : -6) * d.px, {
          color: theme.series[0]!,
          width: 1.5,
          head: 6,
          alpha: Math.max(0.2, fe),
        });
      }
      d.text("campo E", XS + 0.62, 4, { align: "left", color: theme.series[0]!, size: 12, weight: "700" });
    }
    const nq = Math.round(fe * 5);
    for (let k = 0; k < nq; k++) {
      const x = XS - cap.pl + ((k + 0.5) * 2 * cap.pl) / 5;
      d.text(q > 0 ? "+" : "−", x, cap.pa[1] + 9 * d.px, { color: q > 0 ? theme.positive : theme.negative, size: 11, weight: "700" });
      d.text(q > 0 ? "−" : "+", x, cap.pb[1] - 9 * d.px, { color: q > 0 ? theme.negative : theme.positive, size: 11, weight: "700" });
    }
    if (m === RLC) {
      resistor(d, XS, YT, XL, YT, 0.9, { color: col });
      d.text(`R = ${si(R(p), "Ω")}`, (XS + XL) / 2, YT - 0.5, { color: theme.muted, size: 12 });
    } else d.line(XS, YT, XL, YT, { color: col, width: 2 });
  }

  // Portadores de carga (sentido convencional) percorrendo o laço
  const x0 = m === RL && sw === 0 ? SWITCH.b[0] : XS;
  const w = XL - x0;
  const h = YT - YB;
  const per = 2 * (w + h);
  const spacing = 0.7;
  const shift = (((s[FLOW]! / Math.max(ir, 1e-12)) * 1.2) % spacing + spacing) % spacing;
  const alphaDots = clamp(Math.abs(i) / Math.max(ir, 1e-12), 0.15, 1);
  for (let u = shift; u < per; u += spacing) {
    // sentido horário: topo (esq → dir), direita (desce), base (dir → esq), esquerda (sobe)
    let x: number, y: number;
    if (u < w) [x, y] = [x0 + u, YT];
    else if (u < w + h) [x, y] = [XL, YT - (u - w)];
    else if (u < 2 * w + h) [x, y] = [XL - (u - w - h), YB];
    else [x, y] = [x0, YB + (u - 2 * w - h)];
    if (m === RL && sw === 1 && Math.abs(x - SWITCH.a[0]) < 0.6 && y === YT) continue;
    d.dot(x, y, 2.6, theme.series[2]!, alphaDots * 0.8);
  }
  if (Math.abs(i) > 1e-3 * ir) currentArrow(d, (XS + XL) / 2 + (m === RL ? 0.75 : 0), YB - 0.35, 1, 0, -i, theme.series[2]!);
  d.text(`i = ${si(i, "A")}`, (XS + XL) / 2 + (m === RL ? 0.75 : 0), YB - 0.75, { color: theme.series[2]!, size: 12, weight: "600" });

  const info =
    m === RL
      ? `τ = L/R = ${si(tauRL(p), "s")}   I∞ = ${si(V0(p) / R(p), "A")}`
      : `ω₀ = 1/√(LC) = ${si(omega0(p), "rad/s")}   T₀ = ${si((2 * Math.PI) / omega0(p), "s")}`;
  d.text(info, (XS + XL) / 2, 7.75, { color: theme.text, size: 13, weight: "600" });
}

function bar(d: Draw, theme: Theme, x: number, base: number, w: number, h: number, color: string, label: string, value: string) {
  d.rect(x, base, w, h, { fill: color, alpha: 0.85 });
  d.text(label, x + w / 2, Math.min(base, base + h) - 0.3, { color: theme.text, size: 11, weight: "600" });
  d.text(value, x + w / 2, Math.max(base, base + h) + 0.25, { color: theme.muted, size: 10 });
}

function fmtJ(v: number) {
  return si(Math.abs(v) < 1e-15 ? 0 : v, "J");
}

function drawEnergyPanel(d: Draw, theme: Theme, s: number[], p: Params) {
  const E0 = eRef(p);
  const ue = UE(s, p);
  const ub = UB(s, p);
  const wr = s[WR]!;
  const base = 1.3;
  const H = 4.8;
  const w = 0.95;
  const x0 = 8.6;
  d.text("Energia", 11.2, 7.75, { color: theme.text, size: 13, weight: "700" });
  d.line(x0 - 0.2, base, x0 + 5.3, base, { color: theme.muted, width: 1 });
  d.line(x0 - 0.2, base + H, x0 + 5.3, base + H, { color: theme.muted, width: 1, dash: [4, 4] });
  d.text("U₀", x0 - 0.35, base + H, { color: theme.muted, size: 11, align: "right" });
  bar(d, theme, x0, base, w, (ue / E0) * H, theme.series[0]!, "U_E (C)", fmtJ(ue));
  bar(d, theme, x0 + 1.4, base, w, (ub / E0) * H, theme.series[1]!, "U_B (L)", fmtJ(ub));
  bar(d, theme, x0 + 2.8, base, w, (wr / E0) * H, theme.muted, "W_R", fmtJ(wr));
  // Total empilhado: mostra que a soma é constante
  d.rect(x0 + 4.2, base, w, (ue / E0) * H, { fill: theme.series[0]!, alpha: 0.85 });
  d.rect(x0 + 4.2, base + (ue / E0) * H, w, (ub / E0) * H, { fill: theme.series[1]!, alpha: 0.85 });
  d.rect(x0 + 4.2, base + ((ue + ub) / E0) * H, w, (wr / E0) * H, { fill: theme.muted, alpha: 0.6 });
  d.text("soma", x0 + 4.2 + w / 2, base + ((ue + ub + wr) / E0) * H + 0.3, { color: theme.text, size: 11, weight: "600" });
  d.text(`U₀ = ½CV₀² = ${fmtJ(E0)}`, x0 + 2.55, 0.25, { color: theme.muted, size: 11 });
  const frac = ue + ub > 0 ? ub / (ue + ub) : 0;
  d.text(`fração magnética: ${Math.round(frac * 100)}%`, x0 + 2.55, 6.9, { color: theme.series[1]!, size: 12 });
}

function drawPowerPanel(d: Draw, theme: Theme, s: number[], p: Params) {
  const r = R(p);
  const i = s[I]!;
  const vs = sourceV(p, s);
  const Pref = V0(p) ** 2 / r;
  const ps = vs * i;
  const pr = r * i * i;
  const pl = i * vl(s, p);
  const mid = 3.0;
  const H = 2.6;
  const w = 0.95;
  const x0 = 8.6;
  const fmtW = (v: number) => si(Math.abs(v) < 1e-15 ? 0 : v, "W");
  d.text("Potências", 11.2, 7.75, { color: theme.text, size: 13, weight: "700" });
  d.line(x0 - 0.2, mid, x0 + 5.3, mid, { color: theme.muted, width: 1 });
  bar(d, theme, x0, mid, w, (ps / Pref) * H, theme.accent, "fonte", fmtW(ps));
  d.text("=", x0 + 1.2, mid + 0.7, { color: theme.text, size: 16, weight: "700" });
  bar(d, theme, x0 + 1.45, mid, w, (pr / Pref) * H, theme.muted, "R i²", fmtW(pr));
  d.text("+", x0 + 2.65, mid + 0.7, { color: theme.text, size: 16, weight: "700" });
  bar(d, theme, x0 + 2.9, mid, w, (pl / Pref) * H, theme.series[1]!, "dU_B/dt", fmtW(pl));
  // Energia magnética acumulada
  const ub = UB(s, p);
  const E = eRef(p);
  d.rect(x0 + 4.35, mid, w, (ub / E) * H, { fill: theme.series[1]!, alpha: 0.5, stroke: theme.series[1]!, width: 1 });
  d.text("U_B", x0 + 4.35 + w / 2, mid - 0.3, { color: theme.text, size: 11, weight: "600" });
  d.text(fmtJ(ub), x0 + 4.35 + w / 2, mid + (ub / E) * H + 0.25, { color: theme.muted, size: 10 });
  d.text(`i/I∞ = ${Math.round((100 * i) / (V0(p) / r))}%`, x0 + 2.55, 0.25, { color: theme.series[2]!, size: 12, weight: "600" });
  d.text(`V_L = ${si(vl(s, p), "V")}`, x0 + 2.55, 6.9, { color: theme.series[1]!, size: 12 });
}

export default rlLc;
