import { defineSim, draw, num, texNum, type Draw, type Params } from "@fisilab/core";
import {
  DEG,
  EYE_DR,
  GLASSES_GAP,
  PUPIL,
  analyzeBench,
  mul,
  rayPath,
  relaxedPower,
  systemMatrix,
  thickGeom,
  thickMatrix,
  transl,
  xIn,
  xOut,
  type Bench,
  type El,
  type Kind,
  type LensAnalysis,
} from "./optics.ts";

export * from "./optics.ts";

interface Box {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

interface Preset {
  label: string;
  els: { kind: Kind; x: number; P: number }[];
  ox: number;
  oh: number;
  inf: boolean;
  vp: Box;
  /** Meia-altura desenhada das lentes. */
  H: number;
}

const EYE_VP: Box = { xMin: -5.3, xMax: 0.5, yMin: -1.0, yMax: 2.0 };

export const PRESETS: Preset[] = [
  { label: "Lente convergente", els: [{ kind: "fina", x: 0, P: 10 }], ox: -0.25, oh: 0.03, inf: false, vp: { xMin: -0.42, xMax: 0.5, yMin: -0.16, yMax: 0.16 }, H: 0.07 },
  { label: "Lente divergente", els: [{ kind: "fina", x: 0, P: -10 }], ox: -0.2, oh: 0.04, inf: false, vp: { xMin: -0.42, xMax: 0.5, yMin: -0.16, yMax: 0.16 }, H: 0.07 },
  {
    label: "Associação de duas lentes",
    els: [
      { kind: "fina", x: 0, P: 10 },
      { kind: "fina", x: 0.3, P: 8 },
    ],
    ox: -0.18,
    oh: 0.02,
    inf: false,
    vp: { xMin: -0.3, xMax: 0.72, yMin: -0.18, yMax: 0.18 },
    H: 0.07,
  },
  {
    label: "Microscópio composto",
    els: [
      { kind: "fina", x: 0, P: 100 },
      { kind: "fina", x: 0.195, P: 40 },
    ],
    ox: -1 / (100 - 1 / 0.17),
    oh: 0.0015,
    inf: false,
    vp: { xMin: -0.03, xMax: 0.27, yMin: -0.055, yMax: 0.055 },
    H: 0.02,
  },
  {
    label: "Telescópio kepleriano",
    els: [
      { kind: "fina", x: 0, P: 2 },
      { kind: "fina", x: 0.55, P: 20 },
    ],
    ox: -0.1,
    oh: 0.01,
    inf: true,
    vp: { xMin: -0.15, xMax: 0.8, yMin: -0.1, yMax: 0.1 },
    H: 0.05,
  },
  { label: "Olho", els: [{ kind: "olho", x: 0, P: 0 }], ox: -1.5, oh: 0.3, inf: false, vp: EYE_VP, H: 0.012 },
  {
    label: "Olho com lente corretiva",
    els: [
      { kind: "oculos", x: -GLASSES_GAP, P: 0 },
      { kind: "olho", x: 0, P: 0 },
    ],
    ox: -4,
    oh: 0.4,
    inf: false,
    vp: EYE_VP,
    H: 0.012,
  },
  { label: "Lente espessa", els: [{ kind: "espessa", x: 0, P: 0 }], ox: -0.3, oh: 0.03, inf: false, vp: { xMin: -0.42, xMax: 0.5, yMin: -0.16, yMax: 0.16 }, H: 0.05 },
];

const preset = (p: Params) => PRESETS[Math.max(0, Math.min(PRESETS.length - 1, Math.round(num(p, "montagem"))))]!;
const isEye = (p: Params) => preset(p).vp === EYE_VP;

/** Janela onde o olho aparece ampliado (coordenadas do palco). */
const INSET: Box = { xMin: -2.95, xMax: 0.4, yMin: 0.2, yMax: 1.9 };
const EYE_LOCAL = { xMin: -0.021, xMax: 0.021, yMin: -0.013, yMax: 0.013 };

let cacheKey = "";
let cacheVal: LensAnalysis | null = null;
function analyze(s: Bench, p: Params): LensAnalysis {
  const key = JSON.stringify([s.els, s.ox, s.oh, s.inf, p]);
  if (cacheVal && key === cacheKey) return cacheVal;
  cacheKey = key;
  cacheVal = analyzeBench(s, p);
  return cacheVal;
}

const fin = (v: number) => (Number.isFinite(v) ? v : 1e6);
const fmt = (v: number, k = 2) => (Number.isFinite(v) && Math.abs(v) < 1e5 ? v.toFixed(k).replace(".", ",") : "∞");
const cm = (v: number) => fmt(v * 100, 1);

function elLabel(e: El, p: Params): string {
  if (e.kind === "olho") return "olho";
  if (e.kind === "oculos") return `corretiva ${fmt(num(p, "oculos"), 2)} D`;
  if (e.kind === "espessa") {
    const S = thickMatrix(p);
    return `espessa, f = ${cm(-1 / S[2])} cm`;
  }
  return e.P === 0 ? "P = 0" : `f = ${cm(1 / e.P)} cm`;
}

/** Raios a desenhar: lista de (y0, u0) no plano inicial xa. */
function rayStarts(s: Bench, p: Params, a: LensAnalysis, vp: Box): { xa: number; rays: { y: number; u: number; main: boolean }[] } {
  const H = preset(p).H;
  const first = a.els[0];
  const alpha = num(p, "alfa", 1) * DEG;
  if (!first) return { xa: s.inf ? vp.xMin : s.ox, rays: [] };
  const x1 = xIn(first);
  if (a.eye && !s.inf) {
    // cones que entram na pupila, a partir da base e da ponta do objeto
    const pre = mul(transl(a.eye.x - (a.optics.length ? xOut(a.optics[a.optics.length - 1]!, p) : s.ox)), systemMatrix(a.optics, p, s.ox));
    const [A, B] = pre;
    const rays: { y: number; u: number; main: boolean }[] = [];
    for (const yt of [-PUPIL / 2, 0, PUPIL / 2]) {
      rays.push({ y: 0, u: yt / B, main: false });
      rays.push({ y: s.oh, u: (yt - A * s.oh) / B, main: yt === 0 });
    }
    return { xa: s.ox, rays };
  }
  if (s.inf) {
    const xa = vp.xMin;
    const ys = a.eye && !a.optics.length ? [-PUPIL / 2, 0, PUPIL / 2] : [-0.6 * H, 0, 0.6 * H];
    return { xa, rays: ys.map((y) => ({ y: y - alpha * (x1 - xa), u: alpha, main: y === 0 })) };
  }
  const rays: { y: number; u: number; main: boolean }[] = [{ y: s.oh, u: 0, main: true }];
  rays.push({ y: s.oh, u: -s.oh / (x1 - s.ox), main: true });
  if (first.kind === "fina" && first.P !== 0) {
    const F = x1 - 1 / first.P;
    if (Math.abs(F - s.ox) > 1e-6 && F > s.ox - 10) rays.push({ y: s.oh, u: -s.oh / (F - s.ox), main: true });
  }
  for (const k of [-0.6, 0.6]) rays.push({ y: 0, u: (k * H) / (x1 - s.ox), main: false });
  return { xa: s.ox, rays };
}

export const lentes = defineSim<Bench>({
  id: "lentes",
  title: "Lentes e bancada ótica",
  course: "FG IV",
  topic: "Ótica geométrica",
  priority: "P1",
  summary:
    "Monte uma bancada ótica: arraste lentes pelo eixo, acrescente ou remova lentes e veja os raios atravessarem a associação, calculada com matrizes ABCD. Inclui microscópio, telescópio, lente espessa e um olho com miopia e lente corretiva.",
  static: true,
  equations: [
    String.raw`\frac{1}{f} = \frac{1}{p} + \frac{1}{p'} \qquad m = -\frac{p'}{p} \qquad P = \frac{1}{f}\ (\text{dioptrias, } \text{m}^{-1})`,
    String.raw`\begin{pmatrix} y' \\ u' \end{pmatrix} = \begin{pmatrix} A & B \\ C & D \end{pmatrix}\begin{pmatrix} y \\ u \end{pmatrix} \qquad T(L) = \begin{pmatrix} 1 & L \\ 0 & 1 \end{pmatrix} \quad L(f) = \begin{pmatrix} 1 & 0 \\ -1/f & 1 \end{pmatrix}`,
    String.raw`\text{imagem: } p' = -\frac{B}{D},\ m = \frac{1}{D} \qquad f_{\text{eq}} = -\frac{1}{C} \qquad M_{\text{ang}} = \frac{25\ \text{cm}}{B}`,
    String.raw`\text{microscópio: } M \approx -\frac{L}{f_{\text{ob}}}\cdot\frac{25\ \text{cm}}{f_{\text{oc}}} \qquad \text{telescópio: } M = -\frac{f_{\text{ob}}}{f_{\text{oc}}}`,
    String.raw`\text{lente espessa: } \frac{1}{f} = (n-1)\left[\frac{1}{R_1} - \frac{1}{R_2} + \frac{(n-1)\,d}{n R_1 R_2}\right] \qquad \text{miopia: } P_{\text{corr}} = -\frac{1}{PR - d_{\text{óculos}}}`,
  ],
  liveEquations(s, p) {
    const a = analyze(s, p);
    const out: string[] = [];
    if (a.eye) {
      const P0 = relaxedPower(p);
      const rx = num(p, "rx");
      out.push(
        String.raw`P_{\text{olho}} = ${texNum(a.eyeP, 4)}\ \text{D}\ \ (\text{relaxado } ${texNum(P0, 4)}\ \text{D},\ \text{acomodação } ${texNum(a.acc)}\ \text{D}) \qquad \text{borrão} = ${texNum(a.blur * 1000)}\ \text{mm}`,
      );
      if (rx < 0)
        out.push(
          String.raw`PR = \frac{1}{|${texNum(rx)}|} = ${texNum(-1 / rx)}\ \text{m} \qquad P_{\text{óculos}} = -\frac{1}{PR - 0{,}012} = ${texNum(-1 / (-1 / rx - GLASSES_GAP))}\ \text{D} \qquad P_{\text{contato}} = ${texNum(rx)}\ \text{D}`,
        );
      return out;
    }
    if (a.afocal) out.push(String.raw`C = 0:\ \text{sistema afocal, imagem final no infinito}`);
    else if (s.inf) out.push(String.raw`\text{objeto no infinito: imagem a } p' = -A/C = ${texNum(a.q)}\ \text{m do último elemento}`);
    else out.push(String.raw`p' = -\frac{B}{D} = ${texNum(a.q)}\ \text{m} \qquad m = \frac{1}{D} = ${texNum(a.m)}`);
    out.push(String.raw`M_{\text{ang}} = ${texNum(a.Mang)} \qquad f_{\text{eq}} = ${Math.abs(a.feq) >= 1e5 ? "\\infty" : `${texNum(a.feq)}\\ \\text{m}`}`);
    if (a.els.some((e) => e.kind === "espessa")) {
      const S = thickMatrix(p);
      const { d } = thickGeom(p);
      out.push(String.raw`f = ${texNum(-1 / S[2])}\ \text{m} \qquad \overline{V_1H} = ${texNum(((S[3] - 1) / S[2]) * -1 * 100)}\ \text{cm} \qquad \overline{V_2H'} = ${texNum(((1 - S[0]) / S[2]) * 100)}\ \text{cm} \qquad d = ${texNum(d * 100)}\ \text{cm}`);
    }
    return out;
  },

  params: [
    {
      key: "montagem",
      label: "Montagem",
      unit: "",
      min: 0,
      max: PRESETS.length - 1,
      step: 1,
      default: 0,
      options: PRESETS.map((pr, i) => ({ value: i, label: pr.label })),
    },
    { key: "alfa", label: "Ângulo do objeto no infinito", unit: "°", min: 0.1, max: 5, step: 0.1, default: 1, live: true },
    { key: "rx", label: "Erro refrativo do olho (negativo = miopia)", unit: "D", min: -6, max: 4, step: 0.25, default: 0, live: true },
    { key: "oculos", label: "Vergência da lente corretiva", unit: "D", min: -8, max: 6, step: 0.25, default: -2, live: true },
    { key: "acom", label: "Amplitude de acomodação", unit: "D", min: 0, max: 10, step: 0.5, default: 4, live: true },
    { key: "nL", label: "Índice da lente espessa", unit: "", min: 1.3, max: 1.9, step: 0.01, default: 1.5, live: true },
    { key: "esp", label: "Espessura da lente espessa", unit: "m", min: 0.005, max: 0.08, step: 0.005, default: 0.03, live: true },
    { key: "Rl", label: "Raio das faces da lente espessa", unit: "m", min: 0.04, max: 0.2, step: 0.005, default: 0.06, live: true },
  ],

  observables: [
    { key: "ox", label: "Posição do objeto no banco", unit: "m", value: (s) => s.ox },
    { key: "oy", label: "Meia altura do objeto", unit: "m", value: (s) => s.oh / 2 },
    { key: "p", label: "Distância objeto–primeiro elemento", unit: "m", value: (s) => (s.els.length ? Math.min(...s.els.map((e) => e.x)) - s.ox : 0) },
    { key: "q", label: "Imagem final (a partir do último elemento)", unit: "m", value: (s, p) => fin(analyze(s, p).q) },
    { key: "m", label: "Aumento lateral", unit: "", value: (s, p) => fin(analyze(s, p).m) },
    { key: "Mang", label: "Aumento angular (ref. 25 cm)", unit: "", value: (s, p) => fin(analyze(s, p).Mang) },
    { key: "feq", label: "Distância focal equivalente", unit: "m", value: (s, p) => fin(analyze(s, p).feq) },
    { key: "blur", label: "Borrão na retina", unit: "mm", value: (s, p) => analyze(s, p).blur * 1000 },
    { key: "acc", label: "Acomodação usada", unit: "D", value: (s, p) => analyze(s, p).acc },
  ],
  chart: { x: "p", y: "q" },

  scenarios: [
    {
      id: "lente",
      label: "Uma lente convergente",
      params: { montagem: 0 },
      guide: `### Lente convergente
1. Arraste o objeto: além de $2f$ a imagem é real, invertida e menor; entre $f$ e $2f$, maior; dentro de $f$, virtual e direita (lupa).
2. Os três raios principais: paralelo (sai pelo foco), pelo centro (não desvia) e pelo foco (sai paralelo).
3. Clique na lente e use os botões para mudar $f$, inverter para divergente ou acrescentar outra lente.
4. Troque a montagem para **Lente espessa**: os planos principais $H$ e $H'$ substituem o plano único da lente fina.`,
      predict: [
        {
          question: "Se você cobrir a metade de cima de uma lente que projeta uma imagem real, a imagem:",
          options: ["perde a metade de cima", "perde a metade de baixo", "fica inteira, porém mais fraca"],
          answer: 2,
          explanation: "Cada ponto do objeto envia raios para toda a lente; qualquer parte dela forma a imagem inteira. Cobrir metade só reduz a luz que chega.",
        },
      ],
    },
    {
      id: "microscopio",
      label: "Microscópio composto",
      params: { montagem: 3 },
      guide: `### Objetiva + ocular
1. A objetiva ($f = 1$ cm) forma uma imagem real, invertida e muito ampliada (I₁) no foco da ocular.
2. A ocular ($f = 2{,}5$ cm) funciona como lupa: a imagem final vai ao infinito e o olho vê relaxado.
3. Compare o aumento angular com $M \\approx -\\frac{L}{f_{ob}}\\cdot\\frac{25\\ \\text{cm}}{f_{oc}} = -16 \\times 10 = -160$.
4. Arraste a ocular para perto da objetiva: a imagem final vira virtual e próxima, e o aumento muda.`,
    },
    {
      id: "telescopio",
      label: "Telescópio",
      params: { montagem: 4, alfa: 1 },
      guide: `### Telescópio kepleriano
O objeto está no infinito (uma estrela): os raios chegam paralelos com ângulo $\\alpha$.
1. A objetiva forma a imagem no seu plano focal; a ocular, com o mesmo foco, devolve raios paralelos.
2. O sistema é **afocal** ($C = 0$) e o aumento angular é $D = -f_{ob}/f_{oc} = -10$.
3. Arraste a ocular e veja o feixe de saída deixar de ser paralelo (foco para míopes ou para projetar o Sol num anteparo).`,
    },
    {
      id: "miopia",
      label: "Miopia e lente corretiva",
      params: { montagem: 6, rx: -2, oculos: 0, acom: 4 },
      guide: `### Olho míope
O olho é modelado por uma lente a 17 mm da retina, que acomoda (fica mais convergente) até a amplitude dada. O míope de $-2$ D tem o olho convergente demais: o ponto remoto fica a $PR = 0{,}5$ m.
1. Com a lente corretiva em 0 D, a imagem do objeto distante se forma **antes** da retina: veja o borrão no detalhe ampliado.
2. Aproxime o objeto até 0,5 m: fica nítido sem acomodar.
3. Ponha a lente corretiva em cerca de $-2$ D: ela forma uma imagem virtual do objeto no ponto remoto e o olho volta a focar ao longe.`,
      predict: [
        {
          question: "Que tipo de lente corrige a miopia?",
          options: ["convergente", "divergente", "cilíndrica, sempre"],
          answer: 1,
          explanation: "O olho míope converge demais (ou é longo demais). Uma lente divergente abre o feixe e leva a imagem de objetos distantes para o ponto remoto, de onde o olho consegue focar na retina.",
        },
      ],
    },
  ],

  exercises: [
    {
      id: "duas",
      prompt:
        "Duas lentes delgadas convergentes, de distâncias focais {f1} m e {f2} m, estão separadas por {dd} m. Um objeto está a {p0} m da primeira. A que distância da segunda lente se forma a imagem final? (positivo se for real, do outro lado)",
      vary: { f1: [0.05, 0.15, 2], f2: [0.05, 0.2, 2], dd: [0.7, 1, 2], p0: [0.2, 0.5, 2] },
      fixed: { montagem: 2 },
      answer: {
        label: "p'₂",
        unit: "m",
        compute: (p) => {
          const q1 = 1 / (1 / num(p, "f1") - 1 / num(p, "p0"));
          const p2 = num(p, "dd") - q1;
          return 1 / (1 / num(p, "f2") - 1 / p2);
        },
      },
      hint: "A imagem da primeira lente é o objeto da segunda: p₂ = d − p'₁.",
    },
    {
      id: "miopia",
      prompt: "O ponto remoto de uma pessoa míope está a {pr} m dos olhos. Qual é a vergência da lente de contato que corrige a visão de longe?",
      vary: { pr: [0.2, 2, 2] },
      fixed: { montagem: 6 },
      answer: { label: "P", unit: "D", compute: (p) => -1 / num(p, "pr") },
      hint: "A lente deve formar, de um objeto no infinito, uma imagem virtual no ponto remoto: f = −PR.",
    },
    {
      id: "telescopio",
      prompt: "Um telescópio kepleriano tem objetiva de {fob} m e ocular de {foc} m de distância focal. Qual é o módulo do aumento angular?",
      vary: { fob: [0.4, 1.5, 2], foc: [0.01, 0.05, 3] },
      fixed: { montagem: 4 },
      answer: { label: "|M|", unit: "", compute: (p) => num(p, "fob") / num(p, "foc") },
    },
  ],

  init(p) {
    const pr = preset(p);
    return {
      els: pr.els.map((e, i) => ({ ...e, id: i + 1 })),
      ox: pr.ox,
      oh: pr.oh,
      inf: pr.inf,
      sel: null,
      drag: null,
      nextId: pr.els.length + 1,
    };
  },
  step: (s) => s,
  sampleEvery: 1000,
  maxSamples: 400,

  viewport: (p) => ({ ...preset(p).vp, unit: "m" }),

  pointer: {
    down(s, p, pt) {
      const vp = preset(p).vp;
      const tol = 0.015 * (vp.xMax - vp.xMin);
      const H = preset(p).H;
      if (!s.inf && Math.abs(pt.x - s.ox) < tol && pt.y > Math.min(0, s.oh) - tol && pt.y < Math.max(0, s.oh) + tol) return { ...s, drag: "obj" };
      const hitH = isEye(p) ? 0.15 : H * 1.1;
      let best: El | null = null;
      for (const e of s.els) {
        const xc = e.kind === "espessa" ? e.x + thickGeom(p).d / 2 : e.x;
        if (Math.abs(pt.x - xc) < tol && Math.abs(pt.y) < hitH && (!best || Math.abs(pt.x - xc) < Math.abs(pt.x - best.x))) best = e;
      }
      if (best) return { ...s, sel: best.id, drag: best.kind === "olho" ? null : best.id };
      return s.sel === null ? undefined : { ...s, sel: null };
    },
    move(s, p, pt, dragging) {
      if (!dragging || s.drag === null) return undefined;
      const vp = preset(p).vp;
      const w = vp.xMax - vp.xMin;
      const firstX = s.els.length ? Math.min(...s.els.map((e) => e.x)) : vp.xMax;
      if (s.drag === "obj") {
        let h = Math.max(vp.yMin * 0.9, Math.min(vp.yMax * 0.9, pt.y));
        if (Math.abs(h) < 0.002 * w) h = h < 0 ? -0.002 * w : 0.002 * w;
        return { ...s, ox: Math.max(vp.xMin + 0.01 * w, Math.min(firstX - 0.005 * w, pt.x)), oh: h };
      }
      const id = s.drag;
      const eye = s.els.find((e) => e.kind === "olho");
      const xmax = eye && id !== eye.id ? eye.x - 0.004 : vp.xMax - 0.02 * w;
      const x = Math.max(s.inf ? vp.xMin + 0.02 * w : s.ox + 0.005 * w, Math.min(xmax, pt.x));
      return { ...s, els: s.els.map((e) => (e.id === id ? { ...e, x } : e)) };
    },
    up: (s) => (s.drag !== null ? { ...s, drag: null } : undefined),
    cursor(s, p, pt) {
      const vp = preset(p).vp;
      const tol = 0.015 * (vp.xMax - vp.xMin);
      if (!s.inf && Math.abs(pt.x - s.ox) < tol && pt.y > Math.min(0, s.oh) - tol && pt.y < Math.max(0, s.oh) + tol) return "grab";
      const hitH = isEye(p) ? 0.15 : preset(p).H * 1.1;
      return s.els.some((e) => e.kind !== "olho" && Math.abs(pt.x - e.x) < tol && Math.abs(pt.y) < hitH) ? "ew-resize" : undefined;
    },
  },

  actions: [
    { id: "convergente", label: "Adicionar lente convergente", run: (s, p) => addLens(s, p, 1) },
    { id: "divergente", label: "Adicionar lente divergente", run: (s, p) => addLens(s, p, -1) },
    {
      id: "remover",
      label: "Remover lente selecionada",
      run: (s) => ({ ...s, els: s.els.filter((e) => e.id !== s.sel || e.kind === "olho"), sel: null }),
    },
    { id: "fmenor", label: "f mais curta (×0,8)", run: (s) => scaleSel(s, 1.25) },
    { id: "fmaior", label: "f mais longa (×1,25)", run: (s) => scaleSel(s, 0.8) },
    { id: "inverter", label: "Inverter convergente/divergente", run: (s) => scaleSel(s, -1) },
    { id: "infinito", label: "Objeto no infinito / próximo", run: (s) => ({ ...s, inf: !s.inf }), active: (s) => s.inf },
  ],

  render(ctx, frame) {
    const { state: s, params: p } = frame;
    const d = draw(ctx, frame);
    const pr = preset(p);
    const vp = pr.vp;
    ctx.save();
    ctx.beginPath();
    ctx.rect(vp.xMin, vp.yMin, vp.xMax - vp.xMin, vp.yMax - vp.yMin);
    ctx.clip();
    renderBench(d, s, p, vp);
    ctx.restore();
  },
});

function addLens(s: Bench, p: Params, sign: number): Bench {
  const vp = preset(p).vp;
  const eye = s.els.find((e) => e.kind === "olho");
  const w = vp.xMax - vp.xMin;
  const scale = isEye(p) ? 0.5 : w / 4;
  let x = eye ? eye.x - 0.03 : Math.max(...s.els.map((e) => xOut(e, p)), s.inf ? vp.xMin + 0.2 * w : s.ox + 0.2 * w) + 0.25 * w;
  if (!eye && x > vp.xMax - 0.05 * w) x = (s.inf ? vp.xMin : s.ox) + 0.5 * (vp.xMax - (s.inf ? vp.xMin : s.ox));
  const P = (sign * 1) / scale;
  const e: El = { id: s.nextId, kind: "fina", x, P: Math.round(P * 4) / 4 || sign * 0.25 };
  return { ...s, els: [...s.els, e], sel: e.id, nextId: s.nextId + 1 };
}

function scaleSel(s: Bench, k: number): Bench {
  return { ...s, els: s.els.map((e) => (e.id === s.sel && e.kind === "fina" ? { ...e, P: e.P * k } : e)) };
}

function drawThinLens(d: Draw, x: number, H: number, P: number, color: string, width = 2, yc = 0) {
  d.line(x, yc - H, x, yc + H, { color, width });
  const k = H * 0.14;
  const sgn = P >= 0 ? 1 : -1;
  for (const e of [-1, 1]) {
    const yt = yc + e * H;
    d.line(x, yt, x - k * 0.7, yt - e * sgn * k, { color, width });
    d.line(x, yt, x + k * 0.7, yt - e * sgn * k, { color, width });
  }
}

function renderBench(d: Draw, s: Bench, p: Params, vp: Box) {
  const { theme } = d;
  const pr = preset(p);
  const H = pr.H;
  const a = analyze(s, p);
  const eyeMode = isEye(p);
  const w = vp.xMax - vp.xMin;
  d.line(vp.xMin, 0, vp.xMax, 0, { color: theme.muted, width: 1, dash: [6, 4] });

  // elementos
  for (const e of a.els) {
    const selected = e.id === s.sel;
    const col = selected ? theme.accent : theme.text;
    if (e.kind === "fina" || e.kind === "oculos") {
      const P = e.kind === "fina" ? e.P : num(p, "oculos");
      const h = eyeMode ? 0.18 : H;
      drawThinLens(d, e.x, h, P, col, selected ? 3 : 2);
      if (!eyeMode && P !== 0) {
        for (const sg of [-1, 1]) {
          const xf = e.x + sg / P;
          d.dot(xf, 0, 3, col, selected ? 1 : 0.6);
          if (selected) d.text(sg * P > 0 ? "F'" : "F", xf, 0, { dy: 11, color: col, size: 10 });
        }
      }
      d.text(elLabel(e, p), e.x, h, { dy: -10, color: col, size: 10 });
    } else if (e.kind === "espessa") {
      const { R1, R2, d: th } = thickGeom(p);
      // meia-altura limitada para a borda da lente manter espessura positiva
      const Rm = Math.min(Math.abs(R1), Math.abs(R2));
      const sagMax = Math.min(0.45 * th, Rm);
      const hh = Math.min(H, 0.92 * Rm, Math.sqrt(Rm * Rm - (Rm - sagMax) ** 2));
      const pts: [number, number][] = [];
      for (let i = 0; i <= 30; i++) {
        const y = -hh + (2 * hh * i) / 30;
        pts.push([e.x + (R1 - Math.sign(R1) * Math.sqrt(R1 * R1 - y * y)), y]);
      }
      for (let i = 30; i >= 0; i--) {
        const y = -hh + (2 * hh * i) / 30;
        pts.push([e.x + th + (R2 - Math.sign(R2) * Math.sqrt(R2 * R2 - y * y)), y]);
      }
      d.polyline(pts, { color: col, width: selected ? 2.5 : 1.5, close: true, fill: theme.dark ? "rgba(91,156,240,0.18)" : "rgba(47,125,225,0.12)" });
      const S = thickMatrix(p);
      const f = -1 / S[2];
      const xH = e.x + (S[3] - 1) / S[2];
      const xH2 = e.x + th + (1 - S[0]) / S[2];
      for (const [xx, lab, al] of [
        [xH, "H", "right"],
        [xH2, "H'", "left"],
      ] as const) {
        d.line(xx, -H * 1.1, xx, H * 1.1, { color: theme.positive, dash: [4, 3], width: 1 });
        d.text(lab, xx, H * 1.1, { dy: -8, dx: al === "right" ? -3 : 3, align: al, color: theme.positive, size: 11, weight: "600" });
      }
      d.dot(xH - f, 0, 3, theme.positive);
      d.text("F", xH - f, 0, { dy: 11, color: theme.positive, size: 10 });
      d.dot(xH2 + f, 0, 3, theme.positive);
      d.text("F'", xH2 + f, 0, { dy: 11, color: theme.positive, size: 10 });
      d.text(elLabel(e, p), e.x + th / 2, -H * 1.1, { dy: 12, color: col, size: 10 });
    } else {
      d.circle(e.x + EYE_DR / 2, 0, 0, { minPx: 9, fill: theme.dark ? "#2a3140" : "#ffffff", stroke: col, width: 1.5 });
      d.dot(e.x + EYE_DR / 2, 0, 3, theme.text);
      d.text("olho", e.x, -0.12, { dy: 6, color: col, size: 11 });
    }
  }

  // raios
  const { xa, rays } = rayStarts(s, p, a, vp);
  const colors = [theme.series[1], theme.series[2], theme.series[4], theme.series[5]].map((c) => c ?? theme.accent);
  const paths: [number, number][][] = [];
  rays.forEach((r, i) => {
    const pts = rayPath(a.els, p, xa, r.y, r.u, vp.xMax + w, a.eyeP);
    paths.push(pts);
    const col = r.main ? colors[i % colors.length]! : theme.series[3] ?? theme.muted;
    d.polyline(pts, { color: col, width: r.main ? 1.6 : 1, alpha: r.main ? 0.95 : 0.55 });
    // prolongamento até a imagem final virtual
    if (!a.eye && !a.afocal && a.q < 0 && a.optics.length) {
      const n = pts.length;
      const [x2, y2] = pts[n - 1]!;
      const [x1, y1] = pts[n - 2]!;
      const slope = (y2 - y1) / (x2 - x1);
      const xi = xOut(a.optics[a.optics.length - 1]!, p) + a.q;
      d.line(x1, y1, xi, y1 + (xi - x1) * slope, { color: col, width: 1, dash: [4, 4], alpha: 0.6 });
    }
  });

  // objeto
  const objCol = theme.series[0] ?? theme.accent;
  if (!s.inf) {
    d.arrow(s.ox, 0, 0, s.oh, { color: objCol, width: 3 });
    d.dot(s.ox, s.oh, 4.5, objCol);
    d.text("objeto", s.ox, 0, { dy: s.oh > 0 ? 13 : -13, color: objCol, size: 11 });
  } else {
    d.text(`objeto no infinito (α = ${fmt(num(p, "alfa", 1), 1)}°)`, vp.xMin + 0.01 * w, vp.yMin, { dy: -12, align: "left", color: objCol, size: 11 });
  }

  // imagens
  const imgCol = theme.series[3] ?? theme.accent;
  a.images.forEach((im) => {
    const final = im.k === a.optics.length - 1 && !a.eye;
    const el = a.optics[im.k]!;
    if ((el.kind === "oculos" && num(p, "oculos") === 0) || (el.kind === "fina" && el.P === 0)) return;
    if (im.x < vp.xMin || im.x > vp.xMax || Math.abs(im.h) > 3 * (vp.yMax - vp.yMin)) return;
    const alpha = final ? 1 : 0.55;
    d.arrow(im.x, 0, 0, im.h, { color: imgCol, width: final ? 3 : 2, dash: im.real ? [] : [5, 4], alpha });
    const lab = final ? (im.real ? "imagem final (real)" : "imagem final (virtual)") : a.eye ? (im.real ? "imagem da lente" : "imagem virtual da lente") : `I${im.k + 1}`;
    d.text(lab, im.x, 0, { dy: im.h > 0 ? 13 : -13, color: imgCol, size: 10 });
  });

  // textos
  const lines: string[] = [];
  if (a.eye) {
    const nitido = a.blur < 0.02e-3;
    lines.push(`borrão na retina: ${fmt(a.blur * 1000, 3)} mm ${nitido ? "(nítido)" : "(desfocado)"}`);
    lines.push(`acomodação usada: ${fmt(a.acc, 2)} D de ${fmt(num(p, "acom"), 1)} D · erro refrativo ${fmt(num(p, "rx"), 2)} D`);
  } else if (a.optics.length) {
    if (a.afocal) lines.push("imagem final no infinito (sistema afocal)");
    else if (!s.inf) lines.push(`imagem final: p' = ${cm(a.q)} cm do último elemento, m = ${fmt(a.m)}`);
    else lines.push(`imagem no plano a ${cm(a.q)} cm do último elemento`);
    const ang = a.afocal || s.inf || a.q < 0 ? `aumento angular: ${fmt(a.Mang, 1)}× · ` : "";
    lines.push(`${ang}f equivalente: ${Math.abs(a.feq) >= 1e5 ? "∞" : `${cm(a.feq)} cm`}`);
  }
  lines.push("arraste objeto e lentes · clique numa lente para selecioná-la");
  lines.forEach((t, i) =>
    d.text(t, vp.xMin + 0.01 * w, vp.yMax, { dy: 8 + i * 15, align: "left", baseline: "top", color: i === lines.length - 1 ? theme.muted : theme.text, size: 11, weight: i === 0 ? "600" : "400" }),
  );

  if (a.eye) renderInset(d, s, p, a, paths);
}

function renderInset(d: Draw, _s: Bench, p: Params, a: LensAnalysis, paths: [number, number][][]) {
  const { theme } = d;
  const eye = a.eye!;
  const B = INSET;
  const L = EYE_LOCAL;
  const k = Math.min((B.xMax - B.xMin) / (L.xMax - L.xMin), (B.yMax - B.yMin) / (L.yMax - L.yMin));
  const cx = (B.xMin + B.xMax) / 2;
  const cy = (B.yMin + B.yMax) / 2;
  const lx0 = (L.xMin + L.xMax) / 2;
  const T = (x: number, y: number): [number, number] => [cx + (x - eye.x - lx0) * k, cy + y * k];
  d.rect(B.xMin, B.yMin, B.xMax - B.xMin, B.yMax - B.yMin, { fill: theme.dark ? "#161b24" : "#fbfcfe", stroke: theme.grid, width: 1 });
  d.text("detalhe do olho (ampliado)", B.xMin + 0.05, B.yMax - 0.05, { align: "left", baseline: "top", color: theme.muted, size: 10 });
  d.line(eye.x, 0.05, B.xMax - 0.1, B.yMin, { color: theme.grid, width: 1 });
  // globo ocular, cristalino e retina
  const [ecx, ecy] = T(eye.x + EYE_DR / 2 + 0.0005, 0);
  d.circle(ecx, ecy, 0.0115 * k, { stroke: theme.muted, width: 1.5 });
  const ret: [number, number][] = [];
  for (let i = -10; i <= 10; i++) {
    const y = (i / 10) * 0.009;
    ret.push(T(eye.x + EYE_DR - (y * y) / (2 * 0.0115), y));
  }
  d.polyline(ret, { color: theme.positive, width: 3 });
  const [tx, ty] = T(eye.x + EYE_DR, -0.0095);
  d.text("retina", tx, ty, { dy: 8, color: theme.positive, size: 10 });
  const [l0x, l0y] = T(eye.x, -0.0045);
  const [, l1y] = T(eye.x, 0.0045);
  drawThinLens(d, l0x, (l1y - l0y) / 2, 1, theme.text, 2, (l0y + l1y) / 2);
  const oc = a.els.find((e) => e.kind === "oculos");
  if (oc) {
    const [gx, gy0] = T(oc.x, -0.009);
    const [, gy1] = T(oc.x, 0.009);
    if (gx > B.xMin) drawThinLens(d, gx, (gy1 - gy0) / 2, num(p, "oculos") || 1, theme.accent, 2, (gy0 + gy1) / 2);
  }
  // raios dentro da janela
  const xStart = eye.x + L.xMin;
  const colors = [theme.series[3] ?? theme.muted, theme.series[1] ?? theme.accent];
  paths.forEach((pts, i) => {
    const seg: [number, number][] = [];
    for (let j = 0; j + 1 < pts.length; j++) {
      const [x1, y1] = pts[j]!;
      const [x2, y2] = pts[j + 1]!;
      if (x2 < xStart) continue;
      if (x1 < xStart) seg.push(T(xStart, y1 + ((xStart - x1) * (y2 - y1)) / (x2 - x1)));
      else if (!seg.length) seg.push(T(x1, y1));
      seg.push(T(x2, y2));
    }
    d.polyline(seg, { color: colors[i % 2]!, width: 1.3, alpha: 0.9 });
  });
  // onde a imagem se formaria
  if (Math.abs(a.qEye) < 0.03 && a.qEye > 0) {
    const [fx, fy] = T(eye.x + a.qEye, 0);
    d.dot(fx, fy, 3.5, theme.text);
  }
}

export default lentes;
