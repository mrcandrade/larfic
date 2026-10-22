import { clamp, defineSim, draw, num, texNum, type Draw, type Params, type Theme } from "@fisilab/core";
import { COMP, DIODES, LAMP, Ra, Rp, Rv, SWEEP_TIME, SWEEP_V, T0, comp, init, lampR, montante, reading, sourceV, step, type IVState } from "./model.ts";
import {
  batterySym,
  br,
  cable,
  currentArrow,
  diodeSym,
  dmmText,
  jack,
  knob,
  lampSym,
  led,
  ledDisplay,
  multimeter,
  node,
  palette,
  panel,
  protoboard,
  resistorBody,
  resistorSym,
  si,
  type Pt,
} from "./bancada.ts";

export * from "./model.ts";

const safeDiv = (a: number, b: number) => (Math.abs(b) > 1e-12 ? a / b : 0);

export const curvaIv = defineSim<IVState>({
  id: "curva-iv",
  title: "Curvas I–V: resistor, lâmpada e diodo",
  course: "Exp III",
  topic: "Circuitos",
  priority: "P1",
  summary:
    "Levante a curva corrente–tensão de um resistor, de uma lâmpada (que esquenta), de diodos, LED e Zener com fonte, amperímetro e voltímetro de verdade, e veja o erro sistemático das montagens a jusante e a montante.",
  equations: [
    String.raw`\text{ôhmico: } V = RI \qquad \text{lâmpada: } R(T) = R_0\left(\tfrac{T}{T_0}\right)^{1{,}2},\ \ C\frac{dT}{dt} = I^2R - \varepsilon\sigma A\,(T^4 - T_0^4) - G\,(T - T_0)`,
    String.raw`\text{diodo (Shockley): } I = I_s\left(e^{(V - R_s I)/nV_T} - 1\right),\quad V_T = kT/e \approx 25{,}9\ \text{mV}`,
    String.raw`\text{jusante: } R_{\text{med}} = \frac{V}{I_R + V/R_V} = R \parallel R_V \qquad \text{montante: } R_{\text{med}} = R + R_A`,
    String.raw`P = VI`,
  ],
  liveEquations(s, p) {
    const r = reading(s, p);
    const Rm = safeDiv(r.Vm, r.Im);
    const Rc = safeDiv(r.Vc, r.Ic);
    const out = [
      String.raw`V = ${texNum(r.Vm, 4)}\ \text{V}\qquad I = ${texNum(r.Im, 4)}\ \text{A}\qquad V/I = ${texNum(Rm, 4)}\ \Omega`,
      String.raw`\text{no componente: } V_c = ${texNum(r.Vc, 4)}\ \text{V},\ I_c = ${texNum(r.Ic, 4)}\ \text{A},\ R_c = ${texNum(Rc, 4)}\ \Omega`,
      String.raw`\text{erro sistemático: } ${texNum(Rc !== 0 ? (Rm / Rc - 1) * 100 : 0, 3)}\,\%\qquad P = ${texNum(r.Vc * r.Ic)}\ \text{W}`,
    ];
    if (comp(p) === 1) out.push(String.raw`T_{\text{filamento}} = ${texNum(s.Tf, 4)}\ \text{K}\qquad R(T) = ${texNum(lampR(s.Tf))}\ \Omega`);
    return out;
  },

  params: [
    { key: "comp", label: "Componente sob teste", unit: "", min: 0, max: 4, step: 1, default: 0, options: COMP.map((l, i) => ({ value: i, label: l })) },
    { key: "Vf", label: "Tensão da fonte", unit: "V", min: -15, max: 15, step: 0.01, default: 5, live: true },
    { key: "Rp", label: "Resistor de proteção Rp", unit: "Ω", min: 1, max: 1000, step: 1, default: 100, log: true, live: true },
    { key: "Rx", label: "Resistência do resistor ôhmico", unit: "Ω", min: 10, max: 100000, step: 1, default: 470, log: true, live: true },
    {
      key: "montagem",
      label: "Montagem",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 0,
      live: true,
      options: [
        { value: 0, label: "Jusante: voltímetro direto no componente" },
        { value: 1, label: "Montante: voltímetro antes do amperímetro" },
      ],
    },
    { key: "Ra", label: "Resistência interna do amperímetro", unit: "Ω", min: 0.1, max: 100, step: 0.1, default: 1, log: true, live: true },
    { key: "Rv", label: "Resistência interna do voltímetro", unit: "Ω", min: 10000, max: 10000000, step: 1000, default: 10000000, log: true, live: true },
  ],

  observables: [
    { key: "V", label: "Indicação do voltímetro V", unit: "V", value: (s, p) => reading(s, p).Vm },
    { key: "I", label: "Indicação do amperímetro I", unit: "A", value: (s, p) => reading(s, p).Im },
    { key: "R", label: "Resistência medida V/I", unit: "Ω", value: (s, p) => safeDiv(reading(s, p).Vm, reading(s, p).Im) },
    { key: "P", label: "Potência medida V·I", unit: "W", value: (s, p) => reading(s, p).Vm * reading(s, p).Im },
    { key: "Vc", label: "Tensão verdadeira no componente", unit: "V", value: (s, p) => reading(s, p).Vc },
    { key: "Ic", label: "Corrente verdadeira no componente", unit: "A", value: (s, p) => reading(s, p).Ic },
    { key: "Rc", label: "Resistência verdadeira V_c/I_c", unit: "Ω", value: (s, p) => safeDiv(reading(s, p).Vc, reading(s, p).Ic) },
    { key: "Pc", label: "Potência no componente", unit: "W", value: (s, p) => reading(s, p).Vc * reading(s, p).Ic },
    {
      key: "erro",
      label: "Erro sistemático de V/I",
      unit: "%",
      value: (s, p) => {
        const r = reading(s, p);
        const Rc = safeDiv(r.Vc, r.Ic);
        return Rc !== 0 ? (safeDiv(r.Vm, r.Im) / Rc - 1) * 100 : 0;
      },
    },
    { key: "Tf", label: "Temperatura do filamento", unit: "K", value: (s, p) => (comp(p) === 1 ? s.Tf : T0) },
    { key: "Vs", label: "Tensão da fonte", unit: "V", value: (s, p) => sourceV(s, p) },
  ],
  chart: { x: "V", y: "I" },

  scenarios: [
    {
      id: "ohmico",
      label: "Resistor: lei de Ohm",
      params: { comp: 0, Vf: 5, Rp: 100, Rx: 470, montagem: 0, Ra: 1, Rv: 1e7 },
      guide: `### Um resistor ôhmico
1. Varie a **tensão da fonte** de −12 V a +12 V (ou clique em **Varredura automática**) e observe o traçador: os pontos caem numa reta pela origem.
2. A inclinação de $V$ contra $I$ é a resistência. Calcule $V/I$ em alguns pontos: é sempre a mesma.
3. A potência $P = VI = RI^2$ cresce com o quadrado da corrente: veja a coluna **Potência**.
4. Troque para um resistor de **100 kΩ** e um voltímetro de **100 kΩ** de resistência interna (analógico barato). Na montagem a **jusante** o aluno mede $R \\parallel R_V = 50$ kΩ. Passe para **montante**: o erro some.`,
      predict: [
        {
          question: "Com a montagem a jusante, um voltímetro de 100 kΩ mede um resistor de 100 kΩ. Que valor de V/I você obtém?",
          options: ["100 kΩ", "200 kΩ", "50 kΩ", "≈ 0"],
          answer: 2,
          explanation: "O amperímetro mede a corrente do resistor mais a do voltímetro, que é igual: $V/I = R\\parallel R_V = 50$ kΩ.",
        },
      ],
    },
    {
      id: "lampada",
      label: "Lâmpada: resistência que esquenta",
      params: { comp: 1, Vf: 12, Rp: 1, montagem: 0, Ra: 0.1, Rv: 1e7 },
      guide: `### Lâmpada incandescente
1. Faça uma **varredura automática**: a curva I–V da lâmpada se curva para baixo. A resistência $V/I$ aumenta com a tensão porque o filamento esquenta.
2. Compare $V/I$ a 0,2 V (filamento frio, $\\approx 8{,}6\\ \\Omega$) com o valor a 12 V ($\\approx 120\\ \\Omega$): um fator 14, com $T$ de 300 K a cerca de 2 700 K.
3. Mude a tensão de repente: a corrente leva algumas dezenas de milissegundos para se acomodar (inércia térmica). Espere estabilizar antes de registrar.
4. **Desligue** e **ligue** a fonte com a lâmpada fria: o pico de corrente na partida é mais de dez vezes a corrente de regime. É por isso que lâmpadas queimam ao ligar.`,
      predict: [
        {
          question: "Ao ligar a lâmpada fria em 12 V, a corrente no primeiro instante é:",
          options: ["igual à de regime", "muito maior que a de regime", "menor que a de regime", "zero"],
          answer: 1,
          explanation: "Fria, a resistência do tungstênio é cerca de 14 vezes menor; a corrente começa enorme e cai à medida que o filamento esquenta.",
        },
      ],
    },
    {
      id: "diodo",
      label: "Diodo: limiar e erro de inserção",
      params: { comp: 2, Vf: 3, Rp: 100, montagem: 0, Ra: 1, Rv: 1e7 },
      guide: `### Diodo de silício
1. Faça a **varredura automática**: praticamente nada passa em polarização reversa; acima de cerca de 0,6 V a corrente cresce exponencialmente.
2. Registre pontos entre 0,1 mA e 10 mA. O gráfico de $\\ln I$ contra $V$ é uma reta com inclinação $1/(nV_T)$: daí sai o fator de idealidade $n$.
3. Em polarização reversa ($V_f = -10$ V), leia o amperímetro: a corrente de fuga verdadeira é de nanoampères, mas na montagem **jusante** o amperímetro lê $V/R_V \\approx 1\\ \\mu$A, a corrente do próprio voltímetro! Passe para **montante**.
4. Troque para o **LED vermelho**: o limiar sobe para cerca de 1,6 V, perto de $hc/(e\\lambda)$.`,
      predict: [
        {
          question: "Com o diodo reversamente polarizado em −10 V e o voltímetro de 10 MΩ a jusante, o amperímetro indica cerca de:",
          options: ["≈ 2,5 nA (fuga do diodo)", "≈ 1 µA", "≈ 100 mA", "zero exato"],
          answer: 1,
          explanation: "O amperímetro mede a soma das correntes do diodo e do voltímetro: $10\\ \\text{V}/10\\ \\text{M}\\Omega = 1\\ \\mu$A, muito mais que a fuga do diodo.",
        },
      ],
    },
    {
      id: "zener",
      label: "Zener em polarização reversa",
      params: { comp: 4, Vf: -10, Rp: 470, montagem: 0, Ra: 1, Rv: 1e7 },
      guide: `### Diodo Zener
1. Com a fonte negativa, o Zener conduz em polarização reversa quando $|V|$ chega a cerca de 5,1 V.
2. Varie a fonte de −6 V a −15 V: a tensão no Zener quase não muda, enquanto a corrente cresce. É um regulador de tensão.
3. Pela inclinação da curva na região de ruptura, estime a resistência dinâmica $r_z = \\Delta V/\\Delta I$ (alguns ohms).
4. Em polarização direta, o Zener se comporta como um diodo comum.`,
    },
  ],

  exercises: [
    {
      id: "jusante",
      prompt:
        "Um resistor de {Rx} Ω é medido com o voltímetro ligado diretamente nos seus terminais (montagem a jusante). A resistência interna do voltímetro é {Rv} Ω. Que valor de V/I o aluno obtém?",
      vary: { Rx: [1000, 100000, 0], Rv: [100000, 10000000, 0] },
      fixed: { comp: 0, montagem: 0 },
      answer: { label: "V/I", unit: "Ω", compute: (p) => (num(p, "Rx") * num(p, "Rv")) / (num(p, "Rx") + num(p, "Rv")) },
      hint: "O amperímetro mede também a corrente do voltímetro: resistor e voltímetro estão em paralelo.",
    },
    {
      id: "montante",
      prompt:
        "Um resistor de {Rx} Ω é medido na montagem a montante, com um amperímetro de resistência interna {Ra} Ω. Que valor de V/I o aluno obtém?",
      vary: { Rx: [10, 470, 0], Ra: [0.5, 20, 1] },
      fixed: { comp: 0, montagem: 1 },
      answer: { label: "V/I", unit: "Ω", compute: (p) => num(p, "Rx") + num(p, "Ra") },
      hint: "O voltímetro mede a queda no resistor mais a queda no amperímetro.",
    },
  ],

  init,
  step: (s, p, _t, dt) => step(s, p, dt),
  dt: 2e-3,
  sampleEvery: 10,
  maxSamples: 6000,

  viewport: () => ({ xMin: 0, xMax: 30, yMin: 0, yMax: 17.2, unit: "" }),

  actions: [
    {
      id: "chave",
      label: "Ligar / desligar a fonte",
      run: (s) => ({ ...s, on: s.on > 0.5 ? 0 : 1 }),
      active: (s) => s.on > 0.5,
    },
    {
      id: "varredura",
      label: `Varredura automática (−${SWEEP_V} V → +${SWEEP_V} V)`,
      run: (s) => ({ ...s, on: 1, sweep: 1, vsw: -SWEEP_V, pts: [] }),
      active: (s) => s.sweep > 0.5,
    },
    { id: "limpar", label: "Limpar curva", run: (s) => ({ ...s, pts: [] }) },
  ],

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const { state: s, params: p, theme } = frame;
    const r = reading(s, p);
    drawBench(d, theme, s, p, r);
    drawSchematic(d, theme, s, p, r);
    drawPlotter(d, theme, s, p, r);
  },
});

// ---------------------------------------------------------------------------
// Bancada física

const N1: Pt = [1.6, 9.6]; // + da fonte
const N2: Pt = [4.4, 9.6]; // depois de Rp
const N3: Pt = [5.8, 9.6]; // entrada do componente
const N4: Pt = [8.9, 9.6]; // saída do componente (terra)
const RAIL: Pt[] = [
  [1.0, 7.25],
  [9.3, 7.25],
];

function drawBench(d: Draw, theme: Theme, s: IVState, p: Params, r: ReturnType<typeof reading>) {
  const c = palette(theme);
  // Fonte DC
  panel(d, theme, 0.3, 12.0, 5.7, 4.9, "FONTE DC 0–15 V");
  ledDisplay(d, theme, 0.6, 14.6, 5.1, 1.5, s.on > 0.5 ? r.Vs.toFixed(2) : " OFF", "V", 5);
  knob(d, theme, 1.6, 13.2, 0.5, (r.Vs + 15) / 30, "TENSÃO");
  led(d, 3.1, 13.5, s.on > 0.5);
  d.text(s.sweep > 0.5 ? "VARRENDO" : s.on > 0.5 ? "SAÍDA ON" : "SAÍDA OFF", 3.3, 13.5, { size: 9, align: "left", color: theme.text, weight: "600" });
  const sPlus: Pt = [4.2, 12.6];
  const sMinus: Pt = [5.3, 12.6];
  jack(d, sPlus[0], sPlus[1], "#d42a1f", "+", theme.text);
  jack(d, sMinus[0], sMinus[1], "#1a1a1a", "−", theme.text);

  // Multímetros
  const am = multimeter(d, theme, 6.5, 12.2, { text: dmmText(r.Im * 1000), unit: "mA", mode: "A⎓", title: `Amperímetro (R_A = ${si(Ra(p), "Ω")})` });
  const vm = multimeter(d, theme, 10.5, 12.2, { text: dmmText(r.Vm), unit: "V", mode: "V⎓", title: `Voltímetro (R_V = ${si(Rv(p), "Ω")})` });

  // Protoboard e componentes
  protoboard(d, theme, 0.6, 6.9, 9.0, 4.0);
  d.line(N4[0], N4[1], N4[0], RAIL[0]![1], { color: "#2a7a3a", width: 3 });
  resistorBody(d, [N1[0] + 0.1, N1[1]], [N2[0] - 0.1, N2[1]], Rp(p));
  d.text(`R_p = ${si(Rp(p), "Ω")}`, (N1[0] + N2[0]) / 2, N1[1] + 0.55, { size: 10, color: "#222" });
  drawDut(d, theme, s, p, [N3[0] + 0.1, N3[1]], [N4[0] - 0.1, N4[1]], r);
  for (const q of [N1, N2, N3, N4]) d.dot(q[0], q[1], 3, "#555");

  // Cabos
  cable(d, sPlus, N1, c.red, 0.8);
  cable(d, sMinus, [RAIL[0]![0] + 0.4, RAIL[0]![1]], c.black, 0.9);
  // Amperímetro em série entre N2 e N3
  cable(d, am.hi, N2, c.red, 1.0, 2.5);
  cable(d, am.com, N3, c.black, 1.2, 2.5);
  // Voltímetro: a jusante nos terminais do componente, a montante antes do amperímetro
  const vHi = montante(p) ? ([N2[0] - 0.3, N2[1]] as Pt) : ([N3[0] + 0.25, N3[1]] as Pt);
  cable(d, vm.hi, vHi, c.red, 1.6, 2.5);
  cable(d, vm.com, [N4[0] + 0.2, RAIL[0]![1]], c.black, 0.6, 2.5);
  d.text(montante(p) ? "voltímetro a MONTANTE" : "voltímetro a JUSANTE", 5.1, 6.45, { size: 11, weight: "700", color: theme.accent });
  return { am, vm };
}

function drawDut(d: Draw, theme: Theme, s: IVState, p: Params, a: Pt, b: Pt, r: ReturnType<typeof reading>) {
  const c = comp(p);
  const mx = (a[0] + b[0]) / 2;
  const my = a[1];
  if (c === 0) {
    resistorBody(d, a, b, num(p, "Rx", 470));
    d.text(`R = ${si(num(p, "Rx", 470), "Ω")}`, mx, my + 0.55, { size: 10, color: "#222" });
    return;
  }
  d.line(a[0], a[1], mx - 0.6, my, { color: "#9b9b9b", width: 1.8 });
  d.line(mx + 0.6, my, b[0], b[1], { color: "#9b9b9b", width: 1.8 });
  if (c === 1) {
    // Lâmpada: bulbo com filamento que brilha conforme a temperatura (Wien: cor de laranja a amarelo)
    const glow = clamp((s.Tf - 900) / 1800, 0, 1);
    if (glow > 0) d.circle(mx, my + 0.55, 0.65 + 0.6 * glow, { fill: "#ffcf4a", alpha: 0.15 + 0.45 * glow });
    d.circle(mx, my + 0.55, 0.55, { fill: theme.dark ? "rgba(230,240,255,0.25)" : "rgba(220,235,255,0.6)", stroke: "#777", width: 1 });
    d.rect(mx - 0.25, my - 0.15, 0.5, 0.3, { fill: "#b8b8b0", stroke: "#666", width: 1 });
    const fil = s.Tf < 800 ? "#555" : s.Tf < 1800 ? "#ff6a1a" : "#ffe27a";
    d.polyline(
      [
        [mx - 0.2, my + 0.2],
        [mx - 0.2, my + 0.55],
        [mx - 0.1, my + 0.7],
        [mx, my + 0.55],
        [mx + 0.1, my + 0.7],
        [mx + 0.2, my + 0.55],
        [mx + 0.2, my + 0.2],
      ],
      { color: fil, width: 2 },
    );
    d.text(`${Math.round(s.Tf)} K`, mx, my - 0.5, { size: 10, color: "#222" });
    return;
  }
  const body = c === 2 ? "#222" : c === 4 ? "#e07a2a" : "#e33";
  if (c === 3) {
    const on = r.Ic > 1e-4;
    if (on) d.circle(mx, my, 0.5 + 0.4 * clamp(r.Ic / 0.02, 0, 1), { fill: "#ff3030", alpha: 0.25 + 0.5 * clamp(r.Ic / 0.02, 0, 1) });
    d.circle(mx, my, 0.32, { fill: on ? "#ff4a3a" : "#a33", stroke: "#611", width: 1 });
  } else {
    d.rect(mx - 0.6, my - 0.17, 1.2, 0.34, { fill: body, stroke: "#111", width: 1 });
    d.rect(mx + 0.32, my - 0.17, 0.14, 0.34, { fill: c === 2 ? "#ddd" : "#111" });
  }
  d.text(["", "", "1N4148", "LED", "Zener 5V1"][c]!, mx, my + 0.55, { size: 10, color: "#222" });
}

// ---------------------------------------------------------------------------
// Esquema elétrico da montagem

function meterSym(d: Draw, x: number, y: number, label: string, color: string) {
  d.circle(x, y, 13 * d.px, { fill: d.theme.dark ? "#1b1f24" : "#fff", stroke: color, width: 2 });
  d.text(label, x, y, { size: 12, weight: "700", color });
}

function drawSchematic(d: Draw, theme: Theme, s: IVState, p: Params, r: ReturnType<typeof reading>) {
  const col = theme.text;
  d.rect(0.5, 0.4, 15.0, 5.6, { stroke: theme.grid, width: 1 });
  d.text("Esquema da montagem", 0.7, 5.7, { size: 10, align: "left", color: theme.muted, weight: "600" });
  const yb = 1.0;
  const yt = 4.7;
  const xs = 1.6;
  const xr2 = 5.6;
  const xa = 7.6;
  const xd = 11.4;
  batterySym(d, [xs, yb], [xs, yt], col, `${br(r.Vs, 3)} V`);
  resistorSym(d, [xs, yt], [xr2, yt], 0.9, col);
  d.text("R_p", (xs + xr2) / 2, yt + 0.45, { size: 11, color: theme.muted });
  d.line(xr2, yt, xa - 0.4, yt, { color: col, width: 2 });
  meterSym(d, xa, yt, "A", theme.series[0]!);
  d.line(xa + 0.4, yt, xd, yt, { color: col, width: 2 });
  // Componente
  const c = comp(p);
  const top: Pt = [xd, yt];
  const bot: Pt = [xd, yb];
  if (c === 0) resistorSym(d, top, bot, 0.8, col);
  else if (c === 1) lampSym(d, top, bot, col, clamp((s.Tf - 900) / 1800, 0, 1));
  else diodeSym(d, top, bot, col, { zener: c === 4, led: c === 3 ? "#e33" : undefined });
  d.line(xs, yb, xd, yb, { color: col, width: 2 });
  // Voltímetro
  const xv = montante(p) ? 6.6 : 13.6;
  const xtap = montante(p) ? xr2 + 0.4 : xd;
  d.polyline(
    [
      [xtap, yt],
      [xtap, yt + 0.6],
      [xv, yt + 0.6],
      [xv, (yt + yb) / 2 + 0.4],
    ],
    { color: theme.series[1]!, width: 1.8 },
  );
  meterSym(d, xv, (yt + yb) / 2, "V", theme.series[1]!);
  d.polyline(
    [
      [xv, (yt + yb) / 2 - 0.4],
      [xv, yb],
    ],
    { color: theme.series[1]!, width: 1.8 },
  );
  node(d, xtap, yt, col);
  node(d, xv, yb, col);
  // Correntes: componente e voltímetro
  currentArrow(d, (xa + xd) / 2, yt, 1, 0, r.Im, theme.series[0]!, `I = ${si(r.Im, "A")}`, -1);
  currentArrow(d, xd - 0.45, (yt + yb) / 2 - 0.7, 0, -1, r.Ic, theme.series[2]!, `I_c = ${si(r.Ic, "A")}`, 1);
  const note = montante(p)
    ? "Montante: o voltímetro mede V_c + R_A·I. Bom para R ≫ R_A."
    : "Jusante: o amperímetro mede I_c + V/R_V. Bom para R ≪ R_V.";
  d.text(note, 8, 0.65, { size: 10, color: theme.muted });
}

// ---------------------------------------------------------------------------
// Traçador I–V

function niceStep(span: number): number {
  const raw = span / 6;
  const e = 10 ** Math.floor(Math.log10(raw));
  const m = raw / e;
  return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * e;
}

function drawPlotter(d: Draw, theme: Theme, s: IVState, p: Params, r: ReturnType<typeof reading>) {
  const X0 = 17.4;
  const X1 = 29.5;
  const Y0 = 1.6;
  const Y1 = 16.2;
  d.rect(16.1, 0.4, 13.7, 16.6, { stroke: theme.grid, width: 1 });
  d.text("Traçador I–V (leituras dos instrumentos)", 16.3, 16.65, { size: 11, align: "left", weight: "600", color: theme.text });
  const pts = s.pts.length ? s.pts : [[r.Vm, r.Im] as [number, number]];
  let vmin = 0;
  let vmax = 0;
  let imin = 0;
  let imax = 0;
  for (const [v, i] of [...pts, [r.Vm, r.Im] as [number, number]]) {
    vmin = Math.min(vmin, v);
    vmax = Math.max(vmax, v);
    imin = Math.min(imin, i * 1000);
    imax = Math.max(imax, i * 1000);
  }
  if (vmax - vmin < 1e-3) vmax = vmin + 1;
  if (imax - imin < 1e-3) imax = imin + 1;
  const sv = niceStep(vmax - vmin);
  const sI = niceStep(imax - imin);
  vmin = Math.floor(vmin / sv) * sv;
  vmax = Math.ceil(vmax / sv) * sv;
  imin = Math.floor(imin / sI) * sI;
  imax = Math.ceil(imax / sI) * sI;
  const X = (v: number) => X0 + ((v - vmin) / (vmax - vmin)) * (X1 - X0);
  const Y = (i: number) => Y0 + ((i * 1000 - imin) / (imax - imin)) * (Y1 - Y0);
  for (let v = vmin; v <= vmax + 1e-9; v += sv) {
    d.line(X(v), Y0, X(v), Y1, { color: theme.grid, width: 1 });
    d.text(br(v, 3), X(v), Y0 - 0.35, { size: 9, color: theme.muted });
  }
  for (let i = imin; i <= imax + 1e-9; i += sI) {
    d.line(X0, Y(i / 1000), X1, Y(i / 1000), { color: theme.grid, width: 1 });
    d.text(br(i, 3), X0 - 0.15, Y(i / 1000), { size: 9, color: theme.muted, align: "right" });
  }
  if (vmin <= 0 && vmax >= 0) d.line(X(0), Y0, X(0), Y1, { color: theme.muted, width: 1.4 });
  if (imin <= 0 && imax >= 0) d.line(X0, Y(0), X1, Y(0), { color: theme.muted, width: 1.4 });
  d.text("V (V)", (X0 + X1) / 2, 0.75, { size: 11, weight: "600", color: theme.text });
  d.text("I (mA)", X0 - 0.2, Y1 + 0.35, { size: 11, weight: "600", color: theme.text, align: "right" });
  for (const [v, i] of pts) d.dot(X(v), Y(i), 2.4, theme.series[0]!);
  d.dot(X(r.Vm), Y(r.Im), 5, theme.series[1]!);
  const c = comp(p);
  const info =
    c === 0
      ? `R nominal ${si(num(p, "Rx", 470), "Ω")}`
      : c === 1
        ? `R frio ${si(LAMP.R0, "Ω")} · R agora ${si(lampR(s.Tf), "Ω")}`
        : `I_s = ${si(DIODES[c]!.Is, "A")}, n = ${br(DIODES[c]!.n, 3)}`;
  d.text(info, X0 + 0.1, Y1 - 0.3, { size: 10, align: "left", color: theme.muted });
  if (s.sweep > 0.5) d.text(`varrendo… ${br(s.vsw, 3)} V (${SWEEP_TIME} s)`, X1, Y1 - 0.3, { size: 10, align: "right", color: theme.accent, weight: "600" });
}

export default curvaIv;
