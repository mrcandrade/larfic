import { clamp, defineSim, draw, num, texNum, type Draw, type Params, type Theme } from "@fisilab/core";
import {
  AREA,
  CORES,
  DRAG,
  EMAX,
  EMIN,
  FLOOR,
  INT,
  LC,
  T,
  V,
  Z,
  ZT,
  coilR,
  core,
  coupling,
  emfMagnet,
  emfMutual,
  emfMutualPeak,
  freq,
  init,
  linkage,
  loadOpen,
  mode,
  mutual,
  N1,
  N2,
  primaryI,
  radius,
  RL,
  step,
  triangular,
  vFree,
  xfmr,
  I0,
} from "./model.ts";
import { acSourceSym, br, cable, clipped, currentArrow, knob, ledDisplay, palette, panel, resistorSym, scopeScreen, sevenSeg, si, type Pt } from "./bancada.ts";

export * from "./model.ts";

const MODES = ["Ímã atravessando uma bobina", "Bobina primária com corrente variável", "Transformador com núcleo"];

/** Tensão nos terminais da bobina do modo 0 (o osciloscópio mede sobre a carga). */
const vCoil = (s: number[], p: Params) => {
  const e = emfMagnet(p, s[Z]!, s[V]!);
  const R = loadOpen(p) ? 1e6 : RL(p);
  return (e * R) / (R + coilR(p));
};

const pick = (p: Params, m: number, f: () => number) => (mode(p) === m ? f() : 0);

export const transformador = defineSim({
  id: "transformador",
  title: "Indução e transformador",
  course: "Exp III",
  topic: "Indução",
  priority: "P1",
  summary:
    "Lei de Faraday na bancada: um ímã atravessa uma bobina, uma bobina primária com corrente variável induz fem numa secundária e um transformador real (núcleo laminado, maciço ou de ar) mostra relação de tensões, corrente de magnetização, perdas e rendimento.",
  equations: [
    String.raw`\mathcal{E} = -\frac{d\Lambda}{dt},\qquad \Lambda = N\Phi_B = \frac{N\mu_0 m}{2\ell}\left[\frac{u}{\sqrt{a^2+u^2}}\right]_{z-\ell/2}^{z+\ell/2}\ \ (\text{ímã})`,
    String.raw`\mathcal{E}_2 = -M\,\frac{di_1}{dt},\qquad M = \frac{\mu_0 N_1 N_2 \pi a^2}{\ell_1}`,
    String.raw`\frac{V_2}{V_1} \approx \frac{N_2}{N_1},\qquad M = k\sqrt{L_1L_2},\qquad L_i = N_i^2\,\frac{\mu A}{\ell}`,
    String.raw`\eta = \frac{P_2}{P_1} = \frac{P_2}{P_2 + P_{\text{cobre}} + P_{\text{núcleo}}}`,
  ],
  liveEquations(s, p) {
    const m = mode(p);
    if (m === 0)
      return [
        String.raw`\mathcal{E} = ${texNum(emfMagnet(p, s[Z]!, s[V]!))}\ \text{V}\qquad z = ${texNum(s[Z]!)}\ \text{m},\ v = ${texNum(s[V]!)}\ \text{m/s}`,
        String.raw`\mathcal{E}_{\max} = ${texNum(s[EMAX]!)}\ \text{V}\qquad \mathcal{E}_{\min} = ${texNum(s[EMIN]!)}\ \text{V}`,
        String.raw`\tfrac12\textstyle\int|\mathcal{E}|\,dt = ${texNum(s[AREA]! / 2)}\ \text{Wb}\qquad \Lambda(0) = ${texNum(linkage(p, 0))}\ \text{Wb}`,
      ];
    if (m === 1)
      return [
        String.raw`M = \frac{\mu_0 \cdot ${texNum(N1(p))} \cdot ${texNum(N2(p))} \cdot \pi (${texNum(radius(p))})^2}{0{,}15} = ${texNum(mutual(p))}\ \text{H}`,
        String.raw`\mathcal{E}_{2,\text{pico}} = ${triangular(p) ? "4fMI_0" : String.raw`\omega M I_0`} = ${texNum(emfMutualPeak(p))}\ \text{V}`,
      ];
    const x = xfmr(p).load;
    return [
      String.raw`\frac{V_2}{V_1} = \frac{${texNum(x.V2)}}{${texNum(x.V1)}} = ${texNum(x.V2 / x.V1, 4)}\qquad \frac{N_2}{N_1} = ${texNum(N2(p) / N1(p), 4)}`,
      String.raw`I_1 = ${texNum(x.I1)}\ \text{A}\quad I_2 = ${texNum(x.I2)}\ \text{A}\quad I_{\text{vazio}} = ${texNum(xfmr(p).open.I1)}\ \text{A}`,
      String.raw`\eta = \frac{${texNum(x.P2)}}{${texNum(x.P1)}} = ${texNum(x.P1 > 0 ? (100 * x.P2) / x.P1 : 0)}\,\%\qquad B_{\text{pico}} = ${texNum(x.B)}\ \text{T}`,
    ];
  },

  params: [
    { key: "modo", label: "Montagem", unit: "", min: 0, max: 2, step: 1, default: 0, options: MODES.map((l, i) => ({ value: i, label: l })) },
    { key: "N1", label: "Espiras do primário N₁", unit: "", min: 50, max: 2000, step: 10, default: 500, live: true },
    { key: "N2", label: "Espiras da bobina de detecção / secundário N₂", unit: "", min: 10, max: 2000, step: 10, default: 200, live: true },
    { key: "a", label: "Raio das bobinas (modos 1 e 2)", unit: "cm", min: 0.8, max: 4, step: 0.1, default: 1.5, live: true },
    { key: "h", label: "Altura de soltura do ímã", unit: "m", min: 0.05, max: 1.5, step: 0.01, default: 0.5 },
    { key: "mom", label: "Momento magnético do ímã", unit: "A·m²", min: 0.1, max: 2, step: 0.05, default: 0.8 },
    { key: "RL", label: "Carga ligada à bobina / secundário (máx. = aberto)", unit: "Ω", min: 1, max: 1000000, step: 1, default: 1000000, log: true, live: true },
    {
      key: "forma",
      label: "Corrente no primário (modo bobinas)",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 0,
      live: true,
      options: [
        { value: 0, label: "Senoidal" },
        { value: 1, label: "Triangular" },
      ],
    },
    { key: "I0", label: "Amplitude da corrente no primário", unit: "A", min: 0.05, max: 2, step: 0.05, default: 0.5, live: true },
    { key: "f", label: "Frequência", unit: "Hz", min: 10, max: 2000, step: 1, default: 60, log: true, live: true },
    { key: "V1", label: "Tensão da fonte CA (eficaz)", unit: "V", min: 0, max: 24, step: 0.1, default: 12, live: true },
    { key: "nucleo", label: "Núcleo", unit: "", min: 0, max: 2, step: 1, default: 0, live: true, options: CORES.map((l, i) => ({ value: i, label: l })) },
  ],

  observables: [
    {
      key: "fem",
      label: "fem induzida instantânea",
      unit: "V",
      value: (s, p, t) => {
        const m = mode(p);
        if (m === 0) return emfMagnet(p, s[Z]!, s[V]!);
        if (m === 1) return emfMutual(p, t);
        const x = xfmr(p).load;
        return Math.SQRT2 * x.V2 * Math.sin(2 * Math.PI * freq(p) * t + x.phV2);
      },
    },
    {
      key: "femPico",
      label: "fem de pico",
      unit: "V",
      value: (s, p) => {
        const m = mode(p);
        if (m === 0) return Math.max(s[EMAX]!, -s[EMIN]!);
        if (m === 1) return emfMutualPeak(p);
        return Math.SQRT2 * xfmr(p).load.V2;
      },
    },
    { key: "emax", label: "Pico positivo da fem (ímã)", unit: "V", value: (s, p) => pick(p, 0, () => s[EMAX]!) },
    { key: "emin", label: "Pico negativo da fem (ímã)", unit: "V", value: (s, p) => pick(p, 0, () => s[EMIN]!) },
    { key: "Vbob", label: "Tensão nos terminais da bobina (ímã)", unit: "V", value: (s, p) => pick(p, 0, () => vCoil(s, p)) },
    { key: "area", label: "½ ∫|ε| dt (fluxo concatenado máximo)", unit: "Wb", value: (s, p) => pick(p, 0, () => s[AREA]! / 2) },
    { key: "intfem", label: "∫ε dt", unit: "Wb", value: (s, p) => pick(p, 0, () => s[INT]!) },
    { key: "fluxo", label: "Fluxo concatenado NΦ", unit: "Wb", value: (s, p, t) => (mode(p) === 0 ? linkage(p, s[Z]!) : mode(p) === 1 ? mutual(p) * primaryI(p, t).i : 0) },
    { key: "z", label: "Altura do ímã acima do centro da bobina", unit: "m", value: (s, p) => pick(p, 0, () => s[Z]!) },
    { key: "v", label: "Velocidade do ímã", unit: "m/s", value: (s, p) => pick(p, 0, () => s[V]!) },
    { key: "M", label: "Indutância mútua M", unit: "H", value: (_s, p) => pick(p, 1, () => mutual(p)) },
    { key: "i1", label: "Corrente instantânea no primário", unit: "A", value: (_s, p, t) => pick(p, 1, () => primaryI(p, t).i) },
    { key: "V1", label: "Tensão eficaz no primário V₁", unit: "V", value: (_s, p) => pick(p, 2, () => xfmr(p).load.V1) },
    { key: "V2", label: "Tensão eficaz no secundário V₂", unit: "V", value: (_s, p) => pick(p, 2, () => xfmr(p).load.V2) },
    { key: "I1", label: "Corrente eficaz no primário I₁", unit: "A", value: (_s, p) => pick(p, 2, () => xfmr(p).load.I1) },
    { key: "I2", label: "Corrente eficaz no secundário I₂", unit: "A", value: (_s, p) => pick(p, 2, () => xfmr(p).load.I2) },
    { key: "rel", label: "Relação V₂/V₁", unit: "", value: (_s, p) => pick(p, 2, () => xfmr(p).load.V2 / Math.max(1e-12, xfmr(p).load.V1)) },
    { key: "nrel", label: "Relação de espiras N₂/N₁", unit: "", value: (_s, p) => N2(p) / N1(p) },
    { key: "eta", label: "Rendimento η", unit: "%", value: (_s, p) => pick(p, 2, () => (xfmr(p).load.P1 > 0 ? (100 * xfmr(p).load.P2) / xfmr(p).load.P1 : 0)) },
    { key: "P1", label: "Potência de entrada P₁", unit: "W", value: (_s, p) => pick(p, 2, () => xfmr(p).load.P1) },
    { key: "P2", label: "Potência na carga P₂", unit: "W", value: (_s, p) => pick(p, 2, () => xfmr(p).load.P2) },
    { key: "Pcu", label: "Perdas no cobre", unit: "W", value: (_s, p) => pick(p, 2, () => xfmr(p).load.Pcu) },
    { key: "Pnuc", label: "Perdas no núcleo", unit: "W", value: (_s, p) => pick(p, 2, () => xfmr(p).load.Pcore) },
    { key: "I0vazio", label: "Corrente de magnetização (secundário aberto)", unit: "A", value: (_s, p) => pick(p, 2, () => xfmr(p).open.I1) },
    { key: "B", label: "Indução de pico no núcleo", unit: "T", value: (_s, p) => pick(p, 2, () => xfmr(p).load.B) },
  ],
  chart: { x: "t", y: "fem" },

  scenarios: [
    {
      id: "ima",
      label: "Ímã caindo pela bobina",
      params: { modo: 0, h: 0.5, mom: 0.8, N2: 200, a: 1.5, RL: 1e6 },
      guide: `### Lei de Faraday com um ímã
1. Rode: o ímã cai e atravessa a bobina. O osciloscópio (em modo de disparo único) registra dois pulsos de sinais opostos.
2. O primeiro pulso aparece quando o fluxo **aumenta** (ímã chegando); o segundo, quando **diminui** (ímã saindo). O segundo é mais alto e mais estreito: o ímã está mais rápido.
3. A área de cada pulso é a mesma: $\\int \\mathcal{E}\\,dt = -\\Delta\\Lambda$ não depende da velocidade. Compare $\\tfrac12\\int|\\mathcal{E}|dt$ com $\\Lambda(0)$.
4. Dobre a altura de soltura: o pico cresce como $\\sqrt{h}$, a área não muda. Dobre **N₂**: o pico e a área dobram.
5. Use $N_2 = 2000$ espiras e o ímã de 2 A·m², e feche a bobina numa carga de **1 Ω**: a corrente induzida freia o ímã (lei de Lenz) e ele sai da bobina bem mais devagar que $\\sqrt{2gh}$. Com a bobina aberta não há corrente nem freio.
6. **Arraste o ímã** com o mouse para dentro e para fora da bobina: quanto mais rápido, maior a fem.`,
      predict: [
        {
          question: "Comparando os dois pulsos de fem (entrada e saída do ímã), o segundo é:",
          options: ["igual e de mesmo sinal", "maior e de sinal oposto", "menor e de sinal oposto", "maior e de mesmo sinal"],
          answer: 1,
          explanation: "Na saída o fluxo diminui (sinal oposto) e o ímã está mais rápido, então $d\\Lambda/dt$ é maior. As áreas, porém, são iguais: ambas valem $\\Lambda_{\\max}$.",
        },
      ],
    },
    {
      id: "mutua",
      label: "Corrente variável no primário",
      params: { modo: 1, N1: 500, N2: 200, a: 1.5, I0: 0.5, f: 100, forma: 1 },
      guide: `### Indutância mútua
Uma bobina longa (primário) é alimentada pelo gerador; o canal 1 mostra $i_1$ (sobre um resistor de 1 Ω) e o canal 2 a fem na bobina secundária enrolada sobre ela.
1. Com corrente **triangular**, $di_1/dt$ é constante em cada rampa: a fem é uma onda **quadrada** de amplitude $4fMI_0$.
2. Troque para **senoidal**: a fem fica adiantada de 90° em relação à corrente ($-\\cos$ contra $\\sin$).
3. Varie a frequência e registre a fem de pico: ela é proporcional a $f$. A inclinação dá $M$.
4. Dobre $N_2$ ou o raio: $M \\propto N_1 N_2 a^2$.`,
      predict: [
        {
          question: "Com corrente triangular no primário, a fem na secundária tem forma:",
          options: ["triangular", "senoidal", "quadrada", "de pulsos estreitos"],
          answer: 2,
          explanation: "$\\mathcal{E} = -M\\,di_1/dt$ e a derivada de uma rampa é constante: cada rampa dá um patamar, e a fem vira uma onda quadrada.",
        },
      ],
    },
    {
      id: "transformador",
      label: "Transformador com núcleo de ferro",
      params: { modo: 2, N1: 500, N2: 250, V1: 12, f: 60, nucleo: 0, RL: 100 },
      guide: `### Relação de transformação e rendimento
1. Com núcleo de **ferro laminado**, meça $V_1$ e $V_2$: $V_2/V_1 \\approx N_2/N_1$.
2. Abra o secundário (carga no máximo): a corrente no primário cai à **corrente de magnetização**, pequena e quase 90° atrasada.
3. Diminua a carga até 10 Ω: $V_2$ cai um pouco (queda no cobre e dispersão) e a corrente no primário cresce como $I_1 \\approx (N_2/N_1) I_2$.
4. Acompanhe o rendimento $\\eta = P_2/P_1$ e as barras de perdas. Em que carga o rendimento é máximo?
5. Reduza $N_1$ para 100 espiras: o núcleo **satura** ($B$ passa de 1,5 T) e a corrente de magnetização dispara.`,
      predict: [
        {
          question: "Com N₁ = 500, N₂ = 250 e 12 V no primário, o voltímetro do secundário (com carga leve) indica cerca de:",
          options: ["24 V", "12 V", "6 V", "3 V"],
          answer: 2,
          explanation: "O fluxo comum induz a mesma tensão por espira nas duas bobinas: $V_2 \\approx V_1 N_2/N_1 = 6$ V.",
        },
      ],
    },
    {
      id: "nucleo",
      label: "Núcleo de ar e ferro maciço",
      params: { modo: 2, N1: 500, N2: 500, V1: 12, f: 60, nucleo: 2, RL: 100 },
      guide: `### Para que serve o núcleo?
1. Sem núcleo (**ar**), a indutância do primário é centenas de vezes menor: a corrente de magnetização é enorme e o acoplamento fraco ($k \\approx 0{,}6$). $V_2$ fica muito abaixo de $V_1 N_2/N_1$.
2. Passe para **ferro laminado**: a relação de tensões volta a ser a das espiras.
3. Troque para **ferro maciço**: correntes de Foucault circulam no bloco de ferro e as perdas no núcleo explodem. O rendimento cai e o núcleo esquenta. É por isso que os núcleos são feitos de chapas finas isoladas.
4. Aumente a frequência com núcleo de ar: a reatância cresce e o transformador melhora. Transformadores de alta frequência podem ter núcleos pequenos ou de ar.`,
    },
  ],

  exercises: [
    {
      id: "relacao",
      prompt: "Um transformador ideal tem {N1} espiras no primário e {N2} no secundário. Com {V1} V (eficaz) no primário, qual a tensão eficaz no secundário em vazio?",
      vary: { N1: [100, 1000, 0], N2: [50, 2000, 0], V1: [6, 24, 1] },
      fixed: { modo: 2, nucleo: 0 },
      answer: { label: "V₂", unit: "V", compute: (p) => (num(p, "V1") * num(p, "N2")) / num(p, "N1") },
    },
    {
      id: "mutua",
      prompt:
        "Uma bobina longa de {N1} espiras, 15 cm de comprimento e {a} cm de raio conduz corrente senoidal de amplitude {I0} A e frequência {f} Hz. Sobre ela estão enroladas {N2} espiras. Qual a amplitude da fem induzida nessas espiras?",
      vary: { N1: [200, 1000, 0], a: [1, 3, 1], I0: [0.1, 1, 2], f: [50, 1000, 0], N2: [50, 500, 0] },
      fixed: { modo: 1, forma: 0 },
      answer: {
        label: "ε₀",
        unit: "V",
        compute: (p) => ((4e-7 * Math.PI * num(p, "N1") * num(p, "N2") * Math.PI * (num(p, "a") / 100) ** 2) / 0.15) * num(p, "I0") * 2 * Math.PI * num(p, "f"),
      },
      hint: "M = μ₀N₁N₂πa²/ℓ e ε₀ = ωMI₀.",
    },
  ],

  init,
  step: (s, p, _t, dt) => step(s, p, dt),
  dt: 5e-5,
  sampleEvery: 4,
  stopWhen: (s, p) => (mode(p) === 0 && s[DRAG]! < 0.5 ? s[Z]! - FLOOR : 1),

  viewport: () => ({ xMin: 0, xMax: 30, yMin: 0, yMax: 17, unit: "" }),

  pointer: {
    down(s, p, pt) {
      if (mode(p) !== 0 || !onMagnet(s, pt.x, pt.y)) return undefined;
      const out = s.slice();
      out[DRAG] = 1;
      out[ZT] = s[Z]!;
      return out;
    },
    move(s, p, pt, dragging) {
      if (mode(p) !== 0 || !dragging || s[DRAG]! < 0.5) return undefined;
      const out = s.slice();
      out[ZT] = clamp((pt.y - YC) / KZ, FLOOR + 0.01, 1.55);
      return out;
    },
    up(s) {
      if (s[DRAG]! < 0.5) return undefined;
      const out = s.slice();
      out[DRAG] = 0;
      return out;
    },
    cursor: (s, p, pt) => (mode(p) === 0 && onMagnet(s, pt.x, pt.y) ? "grab" : undefined),
  },

  actions: [
    {
      id: "zerar",
      label: "Zerar picos e área",
      run: (s) => {
        const out = s.slice();
        out[EMAX] = 0;
        out[EMIN] = 0;
        out[AREA] = 0;
        out[INT] = 0;
        return out;
      },
    },
  ],

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const { state: s, params: p, theme } = frame;
    const m = mode(p);
    if (m === 0) drawMagnet(d, ctx, theme, s, p, frame.trail);
    else if (m === 1) drawMutual(d, ctx, theme, frame.t, p);
    else drawTransformer(d, ctx, theme, frame.t, p);
  },
});

// ---------------------------------------------------------------------------
// Osciloscópio genérico

const VD = [0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50];
const TD = [1e-4, 2e-4, 5e-4, 1e-3, 2e-3, 5e-3, 1e-2, 2e-2, 5e-2, 0.1];
const niceVdiv = (amp: number) => VD.find((v) => amp / v <= 3.6) ?? 50;
const niceTdiv = (win: number) => TD.find((v) => 10 * v >= win) ?? 0.1;

interface Trace {
  pts: Pt[]; // (tempo desde o início da tela, volts)
  color: string;
  vdiv: number;
  name: string;
}

function scope(d: Draw, ctx: CanvasRenderingContext2D, theme: Theme, x: number, y: number, w: number, tdiv: number, traces: Trace[], title: string) {
  const c = palette(theme);
  const h = w * 0.8;
  panel(d, theme, x - 0.3, y - 1.0, w + 0.6, h + 1.9, title);
  scopeScreen(d, theme, x, y, w, h, 10, 8);
  const DIV = w / 10;
  clipped(ctx, x, y, w, h, () => {
    for (const tr of traces) {
      d.polyline(
        tr.pts.map(([t, v]) => [x + (t / tdiv) * DIV, y + h / 2 + (v / tr.vdiv) * DIV] as Pt),
        { color: tr.color, width: 2 },
      );
    }
  });
  const lab = (col: string) => (theme.dark ? col : col === c.ch1 ? "#8a7000" : "#0b7590");
  traces.forEach((tr, i) => d.text(`CH${i + 1} ${tr.name}  ${si(tr.vdiv, "V")}/div`, x + i * (w / 2), y - 0.45, { size: 10, align: "left", weight: "700", color: lab(tr.color) }));
  d.text(`${si(tdiv, "s")}/div`, x + w, y - 0.45, { size: 10, align: "right", weight: "700", color: theme.text });
}

function miniMeter(d: Draw, theme: Theme, x: number, y: number, text: string, unit: string, label: string) {
  const c = palette(theme);
  d.rect(x - 1.35, y - 0.6, 2.7, 1.2, { fill: c.dmmBody, stroke: "#6b5410", width: 1 });
  d.rect(x - 1.2, y - 0.45, 2.4, 0.9, { fill: c.lcdBg, stroke: "#111", width: 0.8 });
  sevenSeg(d, text, x + 0.55, y - 0.25, 0.48, c.lcdSeg, 5);
  d.text(unit, x + 1.15, y - 0.05, { size: 8, weight: "700", color: c.lcdSeg, align: "right" });
  d.text(label, x, y + 0.85, { size: 10, weight: "700", color: theme.text });
}

const lcdNum = (v: number) => (Math.abs(v) >= 100 ? v.toFixed(1) : Math.abs(v) >= 10 ? v.toFixed(2) : v.toFixed(3));

/** Bobina vista de frente: espiras como elipses. `n` espiras desenhadas. */
function coil(d: Draw, cx: number, cy: number, halfLen: number, r: number, n: number, color: string, vertical: boolean) {
  for (let k = 0; k < n; k++) {
    const u = -halfLen + ((k + 0.5) * 2 * halfLen) / n;
    const pts: Pt[] = [];
    for (let j = 0; j <= 24; j++) {
      const a = (j / 24) * 2 * Math.PI;
      const ex = r * Math.cos(a);
      const ey = 0.22 * r * Math.sin(a);
      pts.push(vertical ? [cx + ex, cy + u + ey] : [cx + u + ey, cy + ex]);
    }
    d.polyline(pts, { color, width: 2 });
  }
}

// ---------------------------------------------------------------------------
// Modo 0

const KZ = 14 / (1.6 + 0.25); // unidades de palco por metro
const YC = 1.0 + 0.25 * KZ; // altura do centro da bobina no palco
const XM = 5.5;
const onMagnet = (s: number[], x: number, y: number) => Math.abs(x - XM) < 0.8 && Math.abs(y - (YC + s[Z]! * KZ)) < 0.8;

function drawMagnet(d: Draw, ctx: CanvasRenderingContext2D, theme: Theme, s: number[], p: Params, trail: number[][]) {
  const c = palette(theme);
  // Régua de altura
  for (let z = -0.2; z <= 1.6 + 1e-9; z += 0.1) {
    const y = YC + z * KZ;
    d.line(1.6, y, Math.abs(z * 10 - Math.round(z * 10)) < 1e-6 && Math.round(z * 10) % 5 === 0 ? 2.2 : 1.9, y, { color: theme.muted, width: 1 });
    if (Math.round(z * 10) % 5 === 0) d.text(`${br(z, 2)} m`, 1.45, y, { size: 9, color: theme.muted, align: "right" });
  }
  d.line(1.6, YC + FLOOR * KZ, 1.6, YC + 1.6 * KZ, { color: theme.muted, width: 1 });
  // Tubo-guia transparente
  d.rect(XM - 0.55, YC + FLOOR * KZ, 1.1, (1.6 - FLOOR) * KZ, { fill: theme.dark ? "rgba(160,200,255,0.06)" : "rgba(80,120,200,0.06)", stroke: theme.grid, width: 1 });
  d.support(XM - 2, YC + FLOOR * KZ, XM + 2, YC + FLOOR * KZ, { color: theme.muted });
  // Bobina (fora de escala) e corrente induzida
  const e = emfMagnet(p, s[Z]!, s[V]!);
  const Rtot = (loadOpen(p) ? 1e6 : RL(p)) + coilR(p);
  const I = e / Rtot;
  coil(d, XM, YC, 0.55, 1.15, 9, c.copper, true);
  d.text(`N₂ = ${N2(p)} espiras · a = ${br(radius(p) * 100, 2)} cm`, XM + 1.4, YC - 0.95, { size: 10, align: "left", color: theme.muted });
  if (Math.abs(I) > 1e-7) currentArrow(d, XM, YC - 0.75, 1, 0, I, theme.series[2]!, `I = ${si(I, "A")}`, -1);
  // Ímã: N em cima (momento para cima)
  const y = YC + s[Z]! * KZ;
  d.rect(XM - 0.32, y, 0.64, 0.38, { fill: "#d33a2c", stroke: "#511", width: 1 });
  d.rect(XM - 0.32, y - 0.38, 0.64, 0.38, { fill: "#2f62c9", stroke: "#123", width: 1 });
  d.text("N", XM, y + 0.19, { size: 10, weight: "700", color: "#fff" });
  d.text("S", XM, y - 0.19, { size: 10, weight: "700", color: "#fff" });
  if (Math.abs(s[V]!) > 0.05) d.arrowPx(XM + 0.6, y, 0, Math.sign(s[V]!), clamp(Math.abs(s[V]!) * 12, 10, 60), { color: theme.series[0]! });
  d.text(`v = ${br(s[V]!, 3)} m/s`, XM + 0.75, y + 0.45, { size: 10, align: "left", color: theme.series[0]! });
  d.text(s[DRAG]! > 0.5 ? "arrastando…" : "arraste o ímã", XM - 0.7, y + 0.45, { size: 9, align: "right", color: theme.muted });
  d.text("bobina e ímã fora de escala", XM, 0.45, { size: 9, color: theme.muted });
  // Carga e cabos até o osciloscópio
  const x0 = 13.2;
  const y0 = 5.2;
  const ch1: Pt = [x0 + 0.3, y0 - 1.6];
  cable(d, [XM + 1.15, YC + 0.3], ch1, c.ch1, 0.5, 2.5);
  cable(d, [XM + 1.15, YC - 0.3], [ch1[0] + 1.2, ch1[1]], c.black, 0.9, 2.5);
  if (!loadOpen(p)) {
    resistorSym(d, [9.2, YC + 0.3], [9.2, YC - 1.7], 0.6, theme.text);
    d.text(`R = ${si(RL(p), "Ω")}`, 9.5, YC - 0.7, { size: 10, align: "left", color: theme.text });
  }
  // Osciloscópio em disparo único: janela em torno da passagem do ímã
  const vf = Math.max(0.3, vFree(p));
  const tdiv = niceTdiv((8 * (radius(p) + LC)) / vf);
  const win = 10 * tdiv;
  let tc = NaN;
  for (let i = 1; i < trail.length; i++) if (trail[i - 1]![Z]! > 0 && trail[i]![Z]! <= 0) tc = trail[i]![T]!;
  const tEnd = trail.length ? trail[trail.length - 1]![T]! : 0;
  const t0 = Number.isFinite(tc) ? tc - win / 2 : Math.max(0, tEnd - win);
  const pts: Pt[] = [];
  let amp = 1e-3;
  for (const q of trail) {
    if (q[T]! < t0 || q[T]! > t0 + win) continue;
    const v = vCoil(q, p);
    amp = Math.max(amp, Math.abs(v));
    pts.push([q[T]! - t0, v]);
  }
  amp = Math.max(amp, Math.abs(s[EMAX]!), Math.abs(s[EMIN]!));
  scope(d, ctx, theme, x0, y0, 13, tdiv, [{ pts, color: c.ch1, vdiv: niceVdiv(amp), name: "bobina" }], "OSCILOSCÓPIO · DISPARO ÚNICO");
  d.text(`pico + ${si(s[EMAX]!, "V")}   pico − ${si(s[EMIN]!, "V")}   ½∫|ε|dt = ${si(s[AREA]! / 2, "Wb")}   Λ(0) = ${si(linkage(p, 0), "Wb")}`, x0, y0 - 1.6, { size: 10, align: "left", color: theme.text });
}

// ---------------------------------------------------------------------------
// Modo 1

function drawMutual(d: Draw, ctx: CanvasRenderingContext2D, theme: Theme, t: number, p: Params) {
  const c = palette(theme);
  const cy = 9.0;
  // Gerador
  panel(d, theme, 0.3, 12.6, 6.6, 4.2, "GERADOR + AMPLIFICADOR");
  ledDisplay(d, theme, 0.6, 14.6, 4.6, 1.5, freq(p) >= 1000 ? (freq(p) / 1000).toFixed(3) : freq(p).toFixed(1), freq(p) >= 1000 ? "kHz" : "Hz", 5);
  knob(d, theme, 6.0, 15.3, 0.45, I0(p) / 2, "I₀");
  d.text(`${triangular(p) ? "triangular" : "senoidal"} · I₀ = ${si(I0(p), "A")}`, 3.5, 13.2, { size: 10, color: theme.text });
  // Primário (longo) e secundário (curto, por fora)
  const x0 = 2.0;
  const x1 = 12.0;
  const ri = 1.0 + radius(p) * 25;
  d.rect(x0, cy - ri * 0.9, x1 - x0, ri * 1.8, { fill: theme.dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)", stroke: theme.grid, width: 1 });
  coil(d, (x0 + x1) / 2, cy, (x1 - x0) / 2, ri, 26, c.copper, false);
  coil(d, (x0 + x1) / 2, cy, 0.9, ri + 0.45, 7, theme.series[4]!, false);
  d.text(`primário: N₁ = ${N1(p)}, ℓ₁ = 15 cm`, x0, cy - ri - 0.6, { size: 10, align: "left", color: theme.text });
  d.text(`secundário: N₂ = ${N2(p)}`, (x0 + x1) / 2, cy + ri + 0.8, { size: 10, color: theme.series[4]! });
  const { i } = primaryI(p, t);
  // Campo no interior do primário (proporcional a i)
  const B = (4e-7 * Math.PI * N1(p) * i) / 0.15;
  d.arrowPx((x0 + x1) / 2 - 2.5, cy, Math.sign(i) || 1, 0, clamp(Math.abs(i / I0(p)) * 70, 0, 70), { color: theme.accent, width: 2.5 });
  d.text(`B = ${si(B, "T")}`, (x0 + x1) / 2 - 2.5, cy + 0.45, { size: 10, color: theme.accent });
  // Cabos
  cable(d, [6.0, 12.7], [x0, cy + 0.3], c.red, 0.5);
  cable(d, [6.5, 12.7], [x1, cy + 0.3], c.black, -0.2);
  const ch1: Pt = [17.6, 2.4];
  const ch2: Pt = [19.4, 2.4];
  cable(d, [x1, cy - 0.3], ch1, c.ch1, 1.0, 2.5);
  cable(d, [(x0 + x1) / 2 + 0.5, cy - ri - 0.45], ch2, c.ch2, 1.5, 2.5);
  d.text("CH1: i₁ × 1 Ω (resistor sensor)", 13.0, 1.4, { size: 10, align: "left", color: theme.muted });
  // Osciloscópio: duas períodos, disparado no início do ciclo
  const per = 1 / freq(p);
  const tdiv = niceTdiv(2 * per);
  const win = 10 * tdiv;
  const n = 600;
  const p1: Pt[] = [];
  const p2: Pt[] = [];
  for (let k = 0; k <= n; k++) {
    const tt = (win * k) / n;
    p1.push([tt, primaryI(p, tt).i]);
    p2.push([tt, emfMutual(p, tt)]);
  }
  scope(d, ctx, theme, 14.6, 5.0, 13, tdiv, [
    { pts: p1, color: c.ch1, vdiv: niceVdiv(I0(p)), name: "i₁" },
    { pts: p2, color: c.ch2, vdiv: niceVdiv(emfMutualPeak(p)), name: "ε₂" },
  ], "OSCILOSCÓPIO");
  d.text(`M = ${si(mutual(p), "H")}   ε₂ pico = ${si(emfMutualPeak(p), "V")}`, 14.6, 3.4, { size: 11, align: "left", color: theme.text, weight: "600" });
}

// ---------------------------------------------------------------------------
// Modo 2

function drawTransformer(d: Draw, ctx: CanvasRenderingContext2D, theme: Theme, t: number, p: Params) {
  const c = palette(theme);
  const X = xfmr(p);
  const x = X.load;
  const w = 2 * Math.PI * freq(p);
  // Fonte CA (variac)
  panel(d, theme, 0.3, 12.0, 5.6, 4.8, "FONTE CA (VARIAC)");
  ledDisplay(d, theme, 0.6, 14.4, 5.0, 1.6, num(p, "V1", 12).toFixed(1), "V~", 4);
  knob(d, theme, 1.5, 13.0, 0.5, num(p, "V1", 12) / 24, "");
  d.text(`${br(freq(p), 4)} Hz`, 3.8, 13.0, { size: 11, color: theme.text });
  // Núcleo
  const cx0 = 8.0;
  const cx1 = 16.4;
  const cy0 = 5.6;
  const cy1 = 13.6;
  const t2 = 1.3;
  const kind = core(p);
  if (kind === 2) {
    d.rect(cx0, cy0, cx1 - cx0, cy1 - cy0, { stroke: theme.muted, width: 1, dash: [5, 5] });
    d.text("sem núcleo", (cx0 + cx1) / 2, cy1 + 0.35, { size: 10, color: theme.muted });
  } else {
    const fill = theme.dark ? "#6e7682" : "#9aa3ad";
    d.rect(cx0, cy0, cx1 - cx0, cy1 - cy0, { fill, stroke: "#333", width: 1.2 });
    d.rect(cx0 + t2, cy0 + t2, cx1 - cx0 - 2 * t2, cy1 - cy0 - 2 * t2, { fill: theme.dark ? "#14181d" : "#ffffff", stroke: "#333", width: 1.2 });
    if (kind === 0) for (let yy = cy0 + 0.2; yy < cy1; yy += 0.25) d.line(cx0, yy, cx1, yy, { color: "#555", width: 0.6, alpha: 0.5 });
    d.text(CORES[kind]!, (cx0 + cx1) / 2, cy1 + 0.35, { size: 10, color: theme.muted });
    if (kind === 1 && x.Pcore > 1) d.rect(cx0, cy0, cx1 - cx0, cy1 - cy0, { fill: "#ff5a1f", alpha: clamp(x.Pcore / 40, 0.05, 0.35) });
    // Fluxo circulando no núcleo (setas proporcionais a B·sen ωt)
    const ph = Math.sin(w * t + x.phV1 - Math.PI / 2);
    const L = clamp((x.B / 1.6) * 60, 0, 60) * ph;
    const mx = (cx0 + cx1) / 2;
    d.arrowPx(mx, cy1 - t2 / 2, 1, 0, Math.abs(L), { color: theme.accent, width: 2.5 });
    if (L < 0) d.arrowPx(mx, cy1 - t2 / 2, -1, 0, Math.abs(L), { color: theme.accent, width: 2.5 });
    d.text(`B = ${si(x.B, "T")} (pico)${x.B > 1.5 ? " · SATURADO" : ""}`, mx, cy0 + t2 / 2, { size: 10, weight: "600", color: x.B > 1.5 ? theme.negative : "#111" });
  }
  // Enrolamentos nas pernas
  const n1 = clamp(Math.round(N1(p) / 50), 3, 16);
  const n2 = clamp(Math.round(N2(p) / 50), 3, 16);
  const legY = (cy0 + cy1) / 2;
  coil(d, cx0 + t2 / 2, legY, 2.6, 1.0, n1, c.copper, true);
  coil(d, cx1 - t2 / 2, legY, 2.6, 1.0, n2, c.copper, true);
  d.text(`N₁ = ${N1(p)}`, cx0 + t2 / 2, legY + 3.1, { size: 11, weight: "700", color: theme.text });
  d.text(`N₂ = ${N2(p)}`, cx1 - t2 / 2, legY + 3.1, { size: 11, weight: "700", color: theme.text });
  // Instrumentos
  miniMeter(d, theme, 4.2, 9.6, lcdNum(x.V1), "V~", "V₁");
  miniMeter(d, theme, 4.2, 6.6, lcdNum(x.I1 * 1000), "mA", "I₁");
  miniMeter(d, theme, 20.4, 9.6, lcdNum(x.V2), "V~", "V₂");
  miniMeter(d, theme, 20.4, 6.6, lcdNum(x.I2 * 1000), "mA", "I₂");
  // Ligações
  cable(d, [3.0, 12.1], [cx0 - 0.95, legY + 2.4], c.red, 0.2);
  cable(d, [4.6, 12.1], [cx0 - 0.95, legY - 2.4], c.black, 1.0);
  const xr = 18.6;
  d.polyline([[cx1 + 0.3, legY + 2.4], [xr, legY + 2.4]], { color: theme.text, width: 2 });
  d.polyline([[cx1 + 0.3, legY - 2.4], [xr, legY - 2.4]], { color: theme.text, width: 2 });
  if (loadOpen(p)) d.text("aberto", xr + 0.1, legY, { size: 10, color: theme.muted, align: "left" });
  else {
    resistorSym(d, [xr, legY + 2.4], [xr, legY - 2.4], 1.0, theme.text);
    d.text(`R = ${si(RL(p), "Ω")}`, xr - 0.4, legY, { size: 10, color: theme.text, align: "right" });
  }
  acSourceSym(d, [1.3, 6.0], [1.3, 7.6], theme.muted);
  // Balanço de potência
  const bx = 0.6;
  const by = 1.2;
  const bw = 18.6;
  d.text(`Potência: P₁ = ${si(x.P1, "W")}   η = ${br(x.P1 > 0 ? (100 * x.P2) / x.P1 : 0, 3)} %   corrente em vazio ${si(X.open.I1, "A")}`, bx, by + 1.75, { size: 11, align: "left", weight: "600", color: theme.text });
  const parts: [number, string, string][] = [
    [x.P2, theme.series[2]!, "carga"],
    [x.Pcu, theme.series[1]!, "cobre"],
    [x.Pcore, theme.negative, "núcleo"],
  ];
  let acc = 0;
  const tot = Math.max(1e-12, x.P1);
  for (const [v, col, name] of parts) {
    const ww = (v / tot) * bw;
    if (ww > 1e-3) d.rect(bx + acc, by, ww, 0.8, { fill: col });
    if (ww > 1.6) d.text(`${name} ${si(v, "W", 2)}`, bx + acc + ww / 2, by + 0.4, { size: 10, color: "#fff", weight: "700" });
    acc += ww;
  }
  d.rect(bx, by, bw, 0.8, { stroke: theme.muted, width: 1 });
  d.text("verde: carga · laranja: cobre · vermelho: núcleo", bx, by - 0.45, { size: 9, align: "left", color: theme.muted });
  // Osciloscópio: v1 e v2
  const per = 1 / freq(p);
  const tdiv = niceTdiv(2 * per);
  const win = 10 * tdiv;
  const pts1: Pt[] = [];
  const pts2: Pt[] = [];
  for (let k = 0; k <= 400; k++) {
    const tt = (win * k) / 400;
    pts1.push([tt, Math.SQRT2 * x.V1 * Math.sin(w * tt)]);
    pts2.push([tt, Math.SQRT2 * x.V2 * Math.sin(w * tt + x.phV2 - x.phV1)]);
  }
  const vd = niceVdiv(Math.SQRT2 * Math.max(x.V1, x.V2, 1e-3));
  scope(d, ctx, theme, 23.0, 9.4, 6.6, tdiv, [
    { pts: pts1, color: c.ch1, vdiv: vd, name: "v₁" },
    { pts: pts2, color: c.ch2, vdiv: vd, name: "v₂" },
  ], "OSCILOSCÓPIO");
  d.text(`k = ${br(coupling(p), 3)}`, 26.3, 7.3, { size: 10, color: theme.muted });
}

export default transformador;
