import { clamp, defineSim, draw, num, texNum, type Draw, type Params, type Theme } from "@fisilab/core";
import {
  C1,
  C2,
  DRAG,
  NX,
  NY,
  TRG,
  TS0,
  TS1,
  TS2,
  amp,
  cursorDt,
  coupling,
  dmmAC,
  dmmError,
  extremes,
  fc,
  freq,
  genAt,
  init,
  offset,
  phaseDeg,
  sdiv,
  signals,
  step,
  tauRC,
  trigMode,
  vpp,
  vpp2,
  vrms,
  vrmsTotal,
  wave,
  windowS,
  at,
  type PWL,
} from "./model.ts";
import { br, cable, clipped, dmmText, jack, knob, led, ledDisplay, multimeter, palette, panel, protoboard, resistorBody, scopeScreen, si, type Pt } from "./bancada.ts";

export * from "./model.ts";

const VDIV = [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5];
const TDIV = [0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50];
const vdivLabel = (v: number) => (v < 1 ? `${br(v * 1000)} mV/div` : `${br(v)} V/div`);
const tdivLabel = (v: number) => (v < 1 ? `${br(v * 1000)} µs/div` : `${br(v)} ms/div`);
const WAVES = ["senoidal", "quadrada", "triangular"];
const COUPLE = ["DC", "AC", "GND"];

// Geometria da bancada (unidades arbitrárias do palco)
const SX = 11.5;
const SY = 6.2;
const DIV = 1.15;
const SW = NX * DIV;
const SH = NY * DIV;
const PROBE_A: Pt = [6.1, 3.55];
const PROBE_B: Pt = [8.75, 3.55];
const GND_RAIL: Pt = [5.3, 1.45];

export const multimetroOsciloscopio = defineSim({
  id: "multimetro-osciloscopio",
  title: "Multímetro e osciloscópio",
  course: "Exp III",
  topic: "Instrumentação",
  priority: "P1",
  summary:
    "Bancada de instrumentação: gerador de funções, osciloscópio de 2 canais com disparo de verdade e um multímetro true RMS ou de média. Meça V_pp, período, valor eficaz e a defasagem num circuito RC.",
  equations: [
    String.raw`v(t) = V_{\text{off}} + A\,g(2\pi f t),\qquad V_{pp} = 2A,\qquad T = 1/f`,
    String.raw`V_{\text{rms}} = \sqrt{\tfrac1T\textstyle\int_0^T v_{\sim}^2\,dt}:\quad \tfrac{A}{\sqrt2}\ (\text{senoide}),\ \ A\ (\text{quadrada}),\ \ \tfrac{A}{\sqrt3}\ (\text{triangular})`,
    String.raw`V_{\text{média calibrado}} = \frac{\pi}{2\sqrt2}\,\langle|v_{\sim}|\rangle \approx 1{,}111\,\langle|v_{\sim}|\rangle`,
    String.raw`\text{RC: } \frac{V_C}{V_g} = \frac{1}{\sqrt{1+(\omega RC)^2}},\qquad \varphi = \arctan(\omega RC),\qquad \Delta t = \frac{\varphi}{360^\circ}\,T`,
  ],
  liveEquations(s, p) {
    const dt = cursorDt(s, p);
    return [
      String.raw`V_{pp} = ${texNum(vpp(p))}\ \text{V}\qquad T = ${texNum(1 / freq(p))}\ \text{s}\qquad V_{\text{rms}} = ${texNum(vrms(p), 4)}\ \text{V}`,
      String.raw`\text{multímetro: } ${texNum(dmmAC(p), 4)}\ \text{V}\quad (\text{erro } ${texNum(dmmError(p), 2)}\,\%)`,
      String.raw`\varphi = \arctan(2\pi \cdot ${texNum(freq(p))} \cdot ${texNum(tauRC(p))}) = ${texNum(phaseDeg(p))}^\circ\qquad f_c = ${texNum(fc(p))}\ \text{Hz}`,
      String.raw`\text{cursores: } \Delta t = ${texNum(dt)}\ \text{s}\qquad 1/\Delta t = ${dt !== 0 ? texNum(1 / Math.abs(dt)) : String.raw`\infty`}\ \text{Hz}`,
    ];
  },

  params: [
    { key: "onda", label: "Forma de onda", unit: "", min: 0, max: 2, step: 1, default: 0, live: true, options: WAVES.map((l, i) => ({ value: i, label: l[0]!.toUpperCase() + l.slice(1) })) },
    { key: "f", label: "Frequência do gerador", unit: "Hz", min: 10, max: 50000, step: 1, default: 1000, log: true, live: true },
    { key: "A", label: "Amplitude (pico)", unit: "V", min: 0.05, max: 10, step: 0.05, default: 2, live: true },
    { key: "off", label: "Offset (nível DC)", unit: "V", min: -5, max: 5, step: 0.1, default: 0, live: true },
    { key: "vdiv1", label: "CH1 V/div", unit: "V/div", min: 0.01, max: 5, step: 0.01, default: 1, live: true, options: VDIV.map((v) => ({ value: v, label: vdivLabel(v) })) },
    { key: "pos1", label: "CH1 posição", unit: "div", min: -4, max: 4, step: 0.2, default: 0, live: true },
    { key: "acop1", label: "CH1 acoplamento", unit: "", min: 0, max: 2, step: 1, default: 0, live: true, options: COUPLE.map((l, i) => ({ value: i, label: l })) },
    {
      key: "ch2",
      label: "Canal 2",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 0,
      live: true,
      options: [
        { value: 0, label: "Desligado" },
        { value: 1, label: "No capacitor do RC" },
      ],
    },
    { key: "vdiv2", label: "CH2 V/div", unit: "V/div", min: 0.01, max: 5, step: 0.01, default: 1, live: true, options: VDIV.map((v) => ({ value: v, label: vdivLabel(v) })) },
    { key: "pos2", label: "CH2 posição", unit: "div", min: -4, max: 4, step: 0.2, default: 0, live: true },
    { key: "acop2", label: "CH2 acoplamento", unit: "", min: 0, max: 2, step: 1, default: 0, live: true, options: COUPLE.map((l, i) => ({ value: i, label: l })) },
    { key: "tdiv", label: "Base de tempo", unit: "ms/div", min: 0.001, max: 50, step: 0.001, default: 0.2, live: true, options: TDIV.map((v) => ({ value: v, label: tdivLabel(v) })) },
    {
      key: "trig",
      label: "Disparo (trigger)",
      unit: "",
      min: 0,
      max: 2,
      step: 1,
      default: 0,
      live: true,
      options: [
        { value: 0, label: "Auto (sem disparo, varre livre)" },
        { value: 1, label: "Normal (só varre se disparar)" },
        { value: 2, label: "Desligado (varredura livre)" },
      ],
    },
    { key: "nivel", label: "Nível do disparo (CH1)", unit: "V", min: -10, max: 10, step: 0.05, default: 0, live: true },
    {
      key: "borda",
      label: "Borda do disparo",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 0,
      live: true,
      options: [
        { value: 0, label: "Subida" },
        { value: 1, label: "Descida" },
      ],
    },
    {
      key: "dmm",
      label: "Multímetro",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 0,
      live: true,
      options: [
        { value: 0, label: "True RMS" },
        { value: 1, label: "Média calibrado para senoide" },
      ],
    },
    {
      key: "dmmFunc",
      label: "Função do multímetro",
      unit: "",
      min: 0,
      max: 2,
      step: 1,
      default: 0,
      live: true,
      options: [
        { value: 0, label: "V~ (tensão alternada)" },
        { value: 1, label: "V⎓ (tensão contínua)" },
        { value: 2, label: "Hz (frequencímetro)" },
      ],
    },
    { key: "R", label: "R do circuito RC", unit: "Ω", min: 100, max: 10000, step: 10, default: 1000, log: true, live: true },
    { key: "C", label: "C do circuito RC", unit: "nF", min: 1, max: 1000, step: 1, default: 100, log: true, live: true },
  ],

  observables: [
    { key: "Vpp", label: "Tensão pico a pico do gerador V_pp", unit: "V", value: (_s, p) => vpp(p) },
    { key: "T", label: "Período T", unit: "s", value: (_s, p) => 1 / freq(p) },
    { key: "Vrms", label: "Valor eficaz verdadeiro (componente CA)", unit: "V", value: (_s, p) => vrms(p) },
    { key: "Vrmst", label: "Valor eficaz total (CA + CC)", unit: "V", value: (_s, p) => vrmsTotal(p) },
    { key: "Vdmm", label: "Leitura do multímetro em V~", unit: "V", value: (_s, p) => dmmAC(p) },
    { key: "Vdc", label: "Leitura do multímetro em V⎓", unit: "V", value: (_s, p) => offset(p) },
    { key: "erro", label: "Erro do multímetro em relação ao RMS verdadeiro", unit: "%", value: (_s, p) => dmmError(p) },
    { key: "fmed", label: "Frequência (frequencímetro)", unit: "Hz", value: (_s, p) => freq(p) },
    { key: "Vpp2", label: "V_pp no capacitor (CH2)", unit: "V", value: (_s, p) => vpp2(p) },
    { key: "ganho", label: "Razão V_pp2 / V_pp1", unit: "", value: (_s, p) => vpp2(p) / vpp(p) },
    { key: "fase", label: "Defasagem CH2 − CH1 (atraso da fundamental)", unit: "°", value: (_s, p) => phaseDeg(p) },
    { key: "dtfase", label: "Atraso Δt entre CH1 e CH2", unit: "s", value: (_s, p) => phaseDeg(p) / (360 * freq(p)) },
    { key: "dtc", label: "Δt entre cursores", unit: "s", value: (s, p) => cursorDt(s, p) },
    { key: "v1", label: "Tensão instantânea do gerador", unit: "V", value: (s, p) => genAt(p, s[TS0]!) },
  ],
  chart: { x: "fmed", y: "fase" },

  scenarios: [
    {
      id: "senoide",
      label: "Medir uma senoide",
      params: { onda: 0, f: 1000, A: 2, off: 0, vdiv1: 1, tdiv: 0.2, acop1: 0, ch2: 0, trig: 0, nivel: 0, dmm: 0, dmmFunc: 0 },
      guide: `### Medindo tensão e período no osciloscópio
1. Conte as divisões verticais entre o pico e o vale do traço amarelo e multiplique pela escala: $V_{pp} = n_{div} \\times (\\text{V/div})$.
2. Conte as divisões horizontais de um período: $T = n_{div} \\times (\\text{s/div})$, e $f = 1/T$. Use os **cursores** 1 e 2 (arraste-os) para marcar duas cristas: o $\\Delta t$ aparece na tela.
3. Calcule $V_{rms} = V_{pp}/(2\\sqrt2)$ e compare com o **multímetro** em V~.
4. Mude a escala para **0,5 V/div**: o traço sai da tela. Escolha sempre a menor escala em que o sinal inteiro cabe: a leitura fica mais precisa.
5. Passe o multímetro para **Hz** e compare com o seu $1/T$.`,
      predict: [
        {
          question: "Uma senoide ocupa 5,6 divisões de pico a pico com 1 V/div. O multímetro (V~) deve indicar cerca de:",
          options: ["5,6 V", "2,8 V", "1,98 V", "3,96 V"],
          answer: 2,
          explanation: "$V_{pp} = 5{,}6$ V, então $V_p = 2{,}8$ V e $V_{rms} = 2{,}8/\\sqrt2 \\approx 1{,}98$ V. O multímetro indica valor eficaz, não pico.",
        },
      ],
    },
    {
      id: "disparo",
      label: "Disparo (trigger) e imagem instável",
      params: { onda: 0, f: 1000, A: 2, off: 0, vdiv1: 1, tdiv: 0.2, acop1: 0, ch2: 0, trig: 2, nivel: 0 },
      guide: `### Por que a imagem corre?
O osciloscópio desenha uma varredura atrás da outra. Sem disparo, cada varredura começa numa fase diferente do sinal e as imagens não coincidem.
1. Rode com o disparo **Desligado**: o traço fica embaralhado (as varreduras anteriores ainda brilham na tela).
2. Passe para **Auto**: com nível 0 V e borda de **subida**, toda varredura começa num cruzamento ascendente de 0 V e a imagem para.
3. Mude o **nível** para 1 V e depois para −1 V: o ponto de início desliza sobre a onda. Troque a **borda** para descida.
4. Coloque o nível em 3 V (acima do pico): não há cruzamento. Em **Auto** a tela volta a correr; em **Normal** o osciloscópio espera um disparo que nunca vem.
5. Ligue um offset de 1,5 V e acoplamento **AC**: o nível de disparo passa a ser medido em relação à média do sinal.`,
      predict: [
        {
          question: "A amplitude é 2 V e você coloca o nível de disparo em 3 V, modo Auto. O que acontece?",
          options: ["A imagem fica parada", "A imagem corre (sem disparo)", "A tela apaga", "O sinal é cortado em 3 V"],
          answer: 1,
          explanation: "O sinal nunca cruza 3 V, então não há evento de disparo. Em Auto, o osciloscópio varre sozinho após um tempo de espera, em fases aleatórias: a imagem corre.",
        },
      ],
    },
    {
      id: "rms",
      label: "True RMS × multímetro de média",
      params: { onda: 1, f: 200, A: 3, off: 0, vdiv1: 1, tdiv: 1, ch2: 0, trig: 0, nivel: 0, dmm: 1, dmmFunc: 0 },
      guide: `### Valor eficaz de ondas não senoidais
Multímetros baratos medem o **valor médio retificado** e multiplicam por $\\pi/(2\\sqrt2) \\approx 1{,}111$, o fator que vale para senoides.
1. Com a onda **quadrada** de amplitude 3 V, o RMS verdadeiro é 3 V. Leia o multímetro de **média**: ele indica cerca de 3,33 V (+11 %).
2. Troque para **true RMS**: a leitura passa a 3,00 V.
3. Repita com a onda **triangular**: $V_{rms} = A/\\sqrt3$. O multímetro de média erra para baixo (−3,8 %).
4. Volte à senoide: os dois concordam.
5. Com a senoide, suba a frequência até 30 kHz: o multímetro de média começa a ler menos (banda passante limitada). O osciloscópio não sofre disso.`,
      predict: [
        {
          question: "Uma onda quadrada de 3 V de amplitude é lida por um multímetro de média calibrado para senoide. Ele indica:",
          options: ["3,00 V", "3,33 V", "2,12 V", "4,24 V"],
          answer: 1,
          explanation: "O valor médio do módulo da quadrada é 3 V; o multímetro multiplica por 1,111 e mostra 3,33 V, embora o RMS verdadeiro seja 3 V.",
        },
      ],
    },
    {
      id: "rc",
      label: "Defasagem num circuito RC",
      params: { onda: 0, f: 1592, A: 2, off: 0, vdiv1: 1, vdiv2: 1, pos1: 0, pos2: 0, tdiv: 0.1, ch2: 1, trig: 0, nivel: 0, R: 1000, C: 100 },
      guide: `### Ganho e defasagem de um RC
O canal 2 mede a tensão no capacitor de um RC alimentado pelo gerador.
1. Na frequência de corte $f_c = 1/(2\\pi RC) \\approx 1{,}59$ kHz, a amplitude no capacitor é $1/\\sqrt2$ da entrada e o atraso é de 45°.
2. Arraste o **cursor 1** para uma passagem por zero do CH1 e o **cursor 2** para a passagem correspondente do CH2: $\\varphi = 360°\\,\\Delta t / T$.
3. Varie a frequência de 100 Hz a 20 kHz e acompanhe o gráfico da defasagem: ela vai de 0° a quase 90°.
4. Use uma onda quadrada: no capacitor ela vira curvas exponenciais de carga e descarga (o mesmo RC, visto no tempo).`,
      predict: [
        {
          question: "Na frequência de corte do RC, quanto a tensão no capacitor está atrasada em relação à do gerador?",
          options: ["0°", "45°", "90°", "180°"],
          answer: 1,
          explanation: "Em $\\omega RC = 1$, $\\varphi = \\arctan 1 = 45°$, e a razão das amplitudes é $1/\\sqrt2$.",
        },
      ],
    },
  ],

  exercises: [
    {
      id: "quadrada-media",
      prompt:
        "Um multímetro de média calibrado para senoide (V~) é ligado a uma onda quadrada simétrica de amplitude {A} V, sem offset. Que valor ele indica?",
      vary: { A: [0.5, 9, 2] },
      fixed: { onda: 1, dmm: 1, f: 200, off: 0 },
      answer: { label: "leitura", unit: "V", compute: (p) => ((Math.PI / (2 * Math.SQRT2)) * num(p, "A")) / Math.sqrt(1 + (num(p, "f") / 10e3) ** 4) },
      hint: "O médio do módulo da quadrada é a própria amplitude; o aparelho multiplica por π/(2√2).",
    },
    {
      id: "defasagem-rc",
      prompt:
        "Um gerador senoidal de {f} Hz alimenta um resistor de {R} Ω em série com um capacitor de {C} nF. De quantos graus a tensão no capacitor está atrasada em relação à do gerador?",
      vary: { f: [100, 10000, 0], R: [220, 4700, 0], C: [10, 470, 0] },
      fixed: { onda: 0, ch2: 1 },
      answer: { label: "φ", unit: "°", compute: (p) => (Math.atan(2 * Math.PI * num(p, "f") * num(p, "R") * num(p, "C") * 1e-9) * 180) / Math.PI },
      hint: "φ = arctan(ωRC), com ω = 2πf e C em farads.",
    },
  ],

  init,
  step: (s, p, _t, dt) => step(s, p, dt),
  dt: 0.02,
  sampleEvery: 5,

  viewport: () => ({ xMin: 0, xMax: 30, yMin: 0, yMax: 17.4, unit: "" }),

  pointer: {
    down(s, _p, pt) {
      const which = hitCursor(s, pt.x, pt.y);
      if (!which) return undefined;
      const out = s.slice();
      out[DRAG] = which;
      return out;
    },
    move(s, _p, pt, dragging) {
      const which = Math.round(s[DRAG]!);
      if (!dragging || !which) return undefined;
      const out = s.slice();
      out[which === 1 ? C1 : C2] = clamp(Math.round(((pt.x - SX) / DIV) * 25) / 25, 0, NX);
      return out;
    },
    up(s) {
      if (!s[DRAG]) return undefined;
      const out = s.slice();
      out[DRAG] = 0;
      return out;
    },
    cursor: (s, _p, pt) => (hitCursor(s, pt.x, pt.y) ? "ew-resize" : undefined),
  },

  actions: [
    {
      id: "cursores-centro",
      label: "Cursores no centro",
      run: (s) => {
        const out = s.slice();
        out[C1] = 4;
        out[C2] = 6;
        return out;
      },
    },
  ],

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const { state: s, params: p, theme } = frame;
    drawGenerator(d, theme, p);
    drawDmm(d, theme, p);
    drawBoard(d, theme, p);
    drawScope(d, ctx, theme, s, p);
    drawCables(d, theme, p);
    d.text("Arraste os cursores 1 e 2 sobre a tela do osciloscópio para medir intervalos de tempo.", 15, 0.45, { size: 11, color: theme.muted });
  },
});

function hitCursor(s: number[], x: number, y: number): 0 | 1 | 2 {
  if (y < SY - 0.2 || y > SY + SH + 0.6) return 0;
  const d1 = Math.abs(x - (SX + s[C1]! * DIV));
  const d2 = Math.abs(x - (SX + s[C2]! * DIV));
  if (Math.min(d1, d2) > 0.3) return 0;
  return d2 <= d1 ? 2 : 1;
}

function freqText(f: number): { text: string; unit: string } {
  if (f >= 1000) return { text: (f / 1000).toFixed(f >= 10000 ? 2 : 3), unit: "kHz" };
  return { text: f.toFixed(f >= 100 ? 1 : 2), unit: "Hz" };
}

function waveIcon(d: Draw, w: number, x: number, y: number, s: number, color: string) {
  if (w === 0) d.plot((u) => y + 0.5 * s * Math.sin(((u - x) / s) * Math.PI), x - s, x + s, { color, width: 1.6, n: 24 });
  else if (w === 1)
    d.polyline(
      [
        [x - s, y - 0.45 * s],
        [x - s, y + 0.45 * s],
        [x, y + 0.45 * s],
        [x, y - 0.45 * s],
        [x + s, y - 0.45 * s],
        [x + s, y + 0.45 * s],
      ],
      { color, width: 1.6 },
    );
  else
    d.polyline(
      [
        [x - s, y - 0.45 * s],
        [x - s / 2, y + 0.45 * s],
        [x + s / 2, y - 0.45 * s],
        [x + s, y + 0.2 * s],
      ],
      { color, width: 1.6 },
    );
}

const GEN_OUT: Pt = [8.4, 11.35];
const GEN_GND: Pt = [9.6, 11.35];

function drawGenerator(d: Draw, theme: Theme, p: Params) {
  panel(d, theme, 0.3, 10.6, 10.2, 6.3, "GERADOR DE FUNÇÕES");
  const ft = freqText(freq(p));
  ledDisplay(d, theme, 0.7, 14.2, 6.0, 1.75, ft.text, ft.unit, 6);
  d.text(`${br(vpp(p), 3)} Vpp   offset ${br(offset(p), 2)} V`, 3.7, 13.75, { size: 10, color: theme.text });
  const w = wave(p);
  for (let k = 0; k < 3; k++) {
    const x = 7.6 + k * 0.95;
    d.rect(x - 0.4, 14.6, 0.8, 0.8, { fill: palette(theme).panel2, stroke: theme.muted, width: 1 });
    waveIcon(d, k, x, 15.0, 0.28, theme.text);
    led(d, x, 14.3, k === w);
  }
  knob(d, theme, 1.6, 12.4, 0.55, Math.log(freq(p) / 10) / Math.log(5000), "FREQ");
  knob(d, theme, 3.5, 12.4, 0.55, amp(p) / 10, "AMPL");
  knob(d, theme, 5.4, 12.4, 0.55, (offset(p) + 5) / 10, "OFFSET");
  jack(d, GEN_OUT[0], GEN_OUT[1], "#d42a1f", "SAÍDA", theme.text);
  jack(d, GEN_GND[0], GEN_GND[1], "#1a1a1a", "⏚", theme.text);
}

function drawDmm(d: Draw, theme: Theme, p: Params) {
  const fn = Math.round(num(p, "dmmFunc"));
  const trueRms = Math.round(num(p, "dmm")) === 0;
  let text: string;
  let unit = "V";
  let mode = "V~";
  if (fn === 1) {
    text = dmmText(offset(p));
    mode = "V⎓";
  } else if (fn === 2) {
    const f = freq(p);
    text = f >= 4000 ? dmmText(f / 1000) : dmmText(f);
    unit = f >= 4000 ? "kHz" : "Hz";
    mode = "FREQ";
  } else text = dmmText(dmmAC(p));
  const j = multimeter(d, theme, 0.7, 3.4, { text, unit, mode, badge: trueRms ? "TRUE RMS" : "MÉDIA", title: "Multímetro" });
  DMM_COM = j.com;
  DMM_HI = j.hi;
}
let DMM_COM: Pt = [1.7, 3.95];
let DMM_HI: Pt = [3.1, 3.95];

function drawBoard(d: Draw, theme: Theme, p: Params) {
  const c = palette(theme);
  protoboard(d, theme, 4.8, 1.2, 5.7, 3.2);
  const R = num(p, "R", 1000);
  resistorBody(d, [PROBE_A[0] + 0.15, PROBE_A[1] - 0.25], [PROBE_B[0] - 0.15, PROBE_B[1] - 0.25], R);
  // Capacitor cerâmico (disco azul) do nó B ao trilho de terra
  const cx = PROBE_B[0] + 0.55;
  d.polyline([[PROBE_B[0] - 0.15, PROBE_B[1] - 0.25], [cx - 0.12, PROBE_B[1] - 0.25], [cx - 0.12, 1.45]], { color: "#9b9b9b", width: 1.8 });
  d.line(cx + 0.12, 2.85, cx + 0.12, 1.45, { color: "#9b9b9b", width: 1.8 });
  d.circle(cx, 2.85, 0.3, { fill: "#2c7fd0", stroke: "#123", width: 1 });
  // Jumper do gerador ao nó A
  d.line(PROBE_A[0], PROBE_A[1], PROBE_A[0] + 0.15, PROBE_A[1] - 0.25, { color: "#9b9b9b", width: 1.8 });
  d.text(`R = ${si(R, "Ω")}`, (PROBE_A[0] + PROBE_B[0]) / 2, PROBE_A[1] + 0.4, { size: 10, color: "#222" });
  d.text(`C = ${si(num(p, "C", 100) * 1e-9, "F")}`, cx + 0.3, 3.45, { size: 10, color: "#222", align: "left" });
  d.text(`f_c = ${si(fc(p), "Hz")}`, 7.6, 1.85, { size: 10, color: "#222" });
  d.text("A", PROBE_A[0] - 0.25, PROBE_A[1] + 0.2, { size: 10, weight: "700", color: c.ch1 === "#f5d742" ? "#7a6400" : c.ch1 });
  d.text("B", PROBE_B[0] + 0.05, PROBE_B[1] + 0.35, { size: 10, weight: "700", color: "#0b6d86" });
  d.text("Protoboard: circuito RC", 7.65, 4.65, { size: 10, color: theme.muted });
}

const CH1_IN: Pt = [24.6, 5.55];
const CH2_IN: Pt = [26.4, 5.55];

function drawCables(d: Draw, theme: Theme, p: Params) {
  const c = palette(theme);
  // Gerador → protoboard
  cable(d, GEN_OUT, PROBE_A, c.red, 1.0);
  cable(d, GEN_GND, GND_RAIL, c.black, 1.3);
  // Multímetro em paralelo com a saída do gerador
  cable(d, DMM_HI, [PROBE_A[0] - 0.4, PROBE_A[1] - 0.1], c.red, 0.5, 2.5);
  cable(d, DMM_COM, [GND_RAIL[0] - 0.2, GND_RAIL[1]], c.black, 0.5, 2.5);
  // Pontas de prova
  cable(d, CH1_IN, [PROBE_A[0] + 0.1, PROBE_A[1] + 0.05], c.ch1, 1.2, 2.5);
  if (Math.round(num(p, "ch2")) === 1) cable(d, CH2_IN, [PROBE_B[0], PROBE_B[1] + 0.05], c.ch2, 1.4, 2.5);
}

function drawTrace(d: Draw, x: PWL, ts: number, p: Params, vdiv: number, pos: number, color: string, alpha: number) {
  const win = windowS(p);
  const periods = win / x.P;
  const Y = (v: number) => SY + SH / 2 + (pos + v / vdiv) * DIV;
  if (periods > 300) {
    // Muitos períodos na tela: o traço vira uma faixa, como num osciloscópio real
    const e = extremes(x);
    d.rect(SX, Y(e.min), SW, Y(e.max) - Y(e.min), { fill: color, alpha: 0.55 * alpha });
    return;
  }
  const n = Math.round(clamp(periods * 64, 400, 12000));
  const pts: Pt[] = [];
  for (let k = 0; k <= n; k++) {
    const tt = (win * k) / n;
    pts.push([SX + (tt / win) * SW, clamp(Y(at(x, ts + tt)), SY - 1, SY + SH + 1)]);
  }
  d.polyline(pts, { color, width: 2, alpha });
}

function drawScope(d: Draw, ctx: CanvasRenderingContext2D, theme: Theme, s: number[], p: Params) {
  const c = palette(theme);
  panel(d, theme, 10.9, 4.65, 19.0, 12.25, "OSCILOSCÓPIO DE 2 CANAIS");
  scopeScreen(d, theme, SX, SY, SW, SH, NX, NY);
  const sig = signals(p);
  const vd1 = num(p, "vdiv1", 1);
  const vd2 = num(p, "vdiv2", 1);
  const pos1 = num(p, "pos1");
  const pos2 = num(p, "pos2");
  const on2 = Math.round(num(p, "ch2")) === 1;
  const trg = Math.round(s[TRG]!);
  const waiting = trg === -1;
  const starts = [s[TS0]!, s[TS1]!, s[TS2]!];
  const alphas = trg === 1 ? [1, 0, 0] : [1, 0.45, 0.22];
  clipped(ctx, SX, SY, SW, SH, () => {
    if (!waiting) {
      for (let k = 2; k >= 0; k--) {
        if (alphas[k]! <= 0) continue;
        if (on2) drawTrace(d, sig.ch2, starts[k]!, p, vd2, pos2, c.ch2, alphas[k]!);
        drawTrace(d, sig.ch1, starts[k]!, p, vd1, pos1, c.ch1, alphas[k]!);
      }
    }
    // Cursores
    for (const [n, key] of [
      [1, C1],
      [2, C2],
    ] as const) {
      const x = SX + s[key]! * DIV;
      d.line(x, SY, x, SY + SH, { color: "#ff7ad9", width: Math.round(s[DRAG]!) === n ? 2 : 1.2, dash: [5, 4] });
    }
    const dt = cursorDt(s, p);
    d.text(`Δt = ${si(dt, "s", 3)}   1/Δt = ${dt !== 0 ? si(1 / Math.abs(dt), "Hz", 3) : "—"}`, SX + 0.15, SY + SH - 0.3, { size: 11, color: "#ff9be4", align: "left", weight: "600" });
    if (waiting) d.text("AGUARDANDO DISPARO", SX + SW / 2, SY + SH / 2 + 0.6, { size: 14, color: c.ch1, weight: "700" });
  });
  // Abas dos cursores, acima da tela
  for (const [n, key] of [
    [1, C1],
    [2, C2],
  ] as const) {
    const x = SX + s[key]! * DIV;
    d.rect(x - 0.2, SY + SH + 0.05, 0.4, 0.4, { fill: "#ff7ad9" });
    d.text(String(n), x, SY + SH + 0.25, { size: 10, weight: "700", color: "#222" });
  }
  // Marcadores de zero de cada canal e do nível de disparo
  const zero = (pos: number) => SY + SH / 2 + pos * DIV;
  const tri = (y: number, color: string, label: string, right = false) => {
    if (y < SY || y > SY + SH) return;
    const x0 = right ? SX + SW : SX;
    const sgn = right ? 1 : -1;
    d.polyline(
      [
        [x0 + sgn * 0.3, y + 0.15],
        [x0 + sgn * 0.02, y],
        [x0 + sgn * 0.3, y - 0.15],
      ],
      { color, fill: color, close: true, width: 1 },
    );
    d.text(label, x0 + sgn * 0.45, y, { size: 9, color, weight: "700" });
  };
  tri(zero(pos1), c.ch1 === "#f5d742" && !theme.dark ? "#a08400" : c.ch1, "1");
  if (on2) tri(zero(pos2), theme.dark ? c.ch2 : "#0b87a6", "2");
  const mode = trigMode(p);
  if (mode !== 2 && coupling(p, 1) !== 2) tri(zero(pos1) + (num(p, "nivel") / vd1) * DIV, theme.text, "T", true);

  // Leituras abaixo da tela
  const k1 = ["DC", "AC", "GND"][coupling(p, 1)]!;
  const k2 = ["DC", "AC", "GND"][coupling(p, 2)]!;
  const yR = SY - 0.42;
  d.text(`CH1 ${vdivLabel(vd1)} ${k1}`, SX, yR, { size: 11, align: "left", weight: "700", color: theme.dark ? c.ch1 : "#8a7000" });
  if (on2) d.text(`CH2 ${vdivLabel(vd2)} ${k2}`, SX + 3.6, yR, { size: 11, align: "left", weight: "700", color: theme.dark ? c.ch2 : "#0b7590" });
  d.text(`M ${tdivLabel(num(p, "tdiv", 0.2))}`, SX + SW, yR, { size: 11, align: "right", weight: "700", color: theme.text });

  // Painel de controles
  const px = 24.2;
  d.text("VERTICAL", px + 1.9, 15.95, { size: 10, weight: "700", color: theme.muted });
  knob(d, theme, px + 0.9, 14.5, 0.55, VDIV.indexOf(vd1) / (VDIV.length - 1), "CH1 V/div");
  knob(d, theme, px + 2.9, 14.5, 0.55, VDIV.indexOf(vd2) / (VDIV.length - 1), "CH2 V/div");
  d.text("HORIZONTAL", px + 4.6, 15.95, { size: 10, weight: "700", color: theme.muted, align: "center" });
  knob(d, theme, px + 4.6, 14.5, 0.55, TDIV.indexOf(num(p, "tdiv", 0.2)) / (TDIV.length - 1), "s/div");
  d.text("DISPARO", px + 2.7, 12.6, { size: 10, weight: "700", color: theme.muted });
  knob(d, theme, px + 1.2, 11.2, 0.5, (num(p, "nivel") + 10) / 20, "NÍVEL");
  const status = waiting ? "AGUARDANDO" : trg === 1 ? "DISPARADO" : mode === 2 ? "LIVRE" : "AUTO";
  led(d, px + 2.6, 11.55, trg === 1, "#36d26b");
  d.text(status, px + 2.85, 11.55, { size: 10, align: "left", weight: "700", color: theme.text });
  d.text(`${Math.round(num(p, "borda")) === 0 ? "↗ subida" : "↘ descida"}  ${br(num(p, "nivel"), 3)} V`, px + 2.6, 10.9, { size: 10, align: "left", color: theme.text });
  d.text(["Auto", "Normal", "Desligado"][mode] ?? "", px + 2.6, 10.35, { size: 10, align: "left", color: theme.muted });
  // Medidas de referência do aluno
  d.text("ENTRADAS", px + 2.7, 7.2, { size: 10, weight: "700", color: theme.muted });
  jack(d, CH1_IN[0], CH1_IN[1], "#c9a400", "CH1", theme.text);
  jack(d, CH2_IN[0], CH2_IN[1], "#1aa6c8", "CH2", theme.text);
  d.text("1 MΩ", px + 4.6, CH1_IN[1], { size: 9, color: theme.muted });
}

export default multimetroOsciloscopio;
