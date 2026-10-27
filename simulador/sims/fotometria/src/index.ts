import { clamp, defineSim, deg, draw, num, rad, texNum, type Params } from "@fisilab/core";
import {
  I0, KM, KM_ESC, SOURCES, SPECTRA, SUN_E, UNKNOWN, Vphot, Vscot, bunsen, bunsenBalance, coneFlux, efficacy, illuminance, intensity, solidAngle, spectrum, spectrumColor,
  type Source,
} from "./physics.ts";

export * from "./physics.ts";

type Drag = "lamp" | "meter" | "normal" | "cap" | "screen" | null;
export interface FState {
  t: number;
  /** Fonte e luxímetro (m), normal do sensor (rad a partir da vertical). */
  lamp: [number, number];
  meter: [number, number];
  tilt: number;
  /** Raio da segunda calota no modo de ângulo sólido (m). */
  r2: number;
  /** Posição do anteparo do fotômetro, a partir da fonte padrão (m). */
  xs: number;
  drag: Drag;
  /** Leituras registradas: [r (m), E (lx)]. */
  readings: [number, number][];
}

const mode = (p: Params) => Math.round(num(p, "modo"));
export const sourceOf = (p: Params): Source => SOURCES[clamp(Math.round(num(p, "fonte")), 0, SOURCES.length - 1)]!;
const W = 16, HH = 10;
// Modo 0: cena em metros → tela
const K0 = 2.5, X0 = 0.3, Y0 = 0.8, XMAX = 4, YMAX = 3.3;
const sx = (x: number) => X0 + K0 * x, sy = (y: number) => Y0 + K0 * y;
// Modo 1: ângulo sólido
const K1 = 2.6, CX1 = 1.3, CY1 = 5;
// Modo 3: banco do fotômetro
const BX0 = 1.2, BX1 = 14.8, BY = 6.2;
/** Maior raio de calota que cabe no palco (m). */
const capMax = (p: Params) => Math.min(3.6, 4.4 / (K1 * Math.sin(rad(num(p, "beta", 30)))));
const benchK = (p: Params) => (BX1 - BX0) / num(p, "D", 2);

/** Leitura do luxímetro no modo 0. */
export function meterReading(s: FState, p: Params) {
  return illuminance(sourceOf(p), s.lamp[0], s.lamp[1], s.meter[0], s.meter[1], s.tilt, rad(num(p, "elev", 60)));
}
export const unknownI = (p: Params) => UNKNOWN[clamp(Math.round(num(p, "desc")), 0, UNKNOWN.length - 1)]!;
export function bunsenOf(s: FState, p: Params) {
  return bunsen(num(p, "I1", 20), unknownI(p), num(p, "D", 2), s.xs);
}
export function radiantResult(p: Params) {
  const sc = num(p, "visao") > 0.5;
  const K = efficacy(Math.round(num(p, "espectro")), num(p, "lam", 555), num(p, "T", 2800), sc);
  return { K, Phi: K * num(p, "P", 1) };
}
const sunL = 1.6e9;
export function luminance(p: Params): number {
  const src = sourceOf(p);
  return src.phi === 0 ? sunL : I0(src) / ((Math.PI * src.d * src.d) / 4);
}

const fmt = (v: number, n = 3) => {
  if (!Number.isFinite(v)) return "—";
  const a = Math.abs(v);
  if (a !== 0 && (a >= 1e5 || a < 1e-2)) return v.toExponential(2).replace(".", ",").replace("e+", "×10^").replace("e-", "×10^-");
  return Number(v.toPrecision(n)).toLocaleString("pt-BR");
};

function wlColor(nm: number): string {
  let r = 0, g = 0, b = 0;
  if (nm < 440) { r = (440 - nm) / 60; b = 1; }
  else if (nm < 490) { g = (nm - 440) / 50; b = 1; }
  else if (nm < 510) { g = 1; b = (510 - nm) / 20; }
  else if (nm < 580) { r = (nm - 510) / 70; g = 1; }
  else if (nm < 645) { r = 1; g = (645 - nm) / 65; }
  else r = 1;
  const f = nm < 420 ? 0.3 + (0.7 * (nm - 380)) / 40 : nm > 700 ? 0.3 + (0.7 * (780 - nm)) / 80 : 1;
  const c = (v: number) => Math.round(255 * Math.max(0, Math.min(1, v * f)) ** 0.8);
  return `rgb(${c(r)}, ${c(g)}, ${c(b)})`;
}

const SUP: Record<string, string> = { "-": "⁻", 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };
/** 1,6·10⁹ */
const sci = (v: number) => {
  const e = Math.floor(Math.log10(v));
  const m = v / 10 ** e;
  return `${Math.abs(m - 1) < 0.05 ? "" : `${m.toFixed(1).replace(".", ",")}·`}10${String(e).split("").map((c) => SUP[c] ?? c).join("")}`;
};

const LUM_REFS: [string, number][] = [
  ["Sol", 1.6e9],
  ["filamento", 1e7],
  ["LED (chip)", 1e7],
  ["céu azul", 8e3],
  ["tela de celular", 500],
  ["papel sob 500 lx", 130],
  ["Lua cheia", 2.5e3],
];

function pick(s: FState, p: Params, pt: { x: number; y: number }): FState | undefined {
  const m = mode(p);
      if (m === 0) {
        const nx = -Math.sin(s.tilt), ny = Math.cos(s.tilt);
        const hx = sx(s.meter[0]) + nx * 1.1, hy = sy(s.meter[1]) + ny * 1.1;
        if (Math.hypot(pt.x - hx, pt.y - hy) < 0.35) return { ...s, drag: "normal" };
        if (Math.hypot(pt.x - sx(s.meter[0]), pt.y - sy(s.meter[1])) < 0.45) return { ...s, drag: "meter" };
        if (sourceOf(p).phi > 0 && Math.hypot(pt.x - sx(s.lamp[0]), pt.y - sy(s.lamp[1])) < 0.5) return { ...s, drag: "lamp" };
      } else if (m === 1) {
        const r = Math.hypot(pt.x - CX1, pt.y - CY1) / K1;
        if (Math.abs(r - s.r2) < 0.25 && pt.x > CX1) return { ...s, drag: "cap" };
      } else if (m === 3) {
        if (Math.abs(pt.x - (BX0 + s.xs * benchK(p))) < 0.5 && pt.y > BY - 1.5 && pt.y < BY + 2) return { ...s, drag: "screen" };
      }
      return undefined;
    }

export const fotometria = defineSim<FState>({
  id: "fotometria",
  title: "Fotometria: fluxo, intensidade, iluminância e luminância",
  course: "FG IV",
  topic: "Ótica",
  priority: "P2",
  summary:
    "Luxímetro arrastável para verificar as leis do inverso do quadrado e do cosseno com lâmpadas, LEDs, vela e Sol; ângulo sólido, fluxo e luminância; curva de sensibilidade do olho V(λ) e eficácia luminosa; fotômetro de Bunsen para medir uma fonte desconhecida.",
  static: true,
  equations: [
    String.raw`I = \frac{d\Phi}{d\Omega}\ (\text{cd} = \text{lm/sr}) \qquad E = \frac{d\Phi}{dA}\ (\text{lx} = \text{lm/m}^2) \qquad L = \frac{dI}{dA\cos\varepsilon}\ (\text{cd/m}^2)`,
    String.raw`E = \frac{I(\alpha)\cos\theta}{r^2} \qquad \Omega = 2\pi(1-\cos\beta) \qquad \Phi_{\text{isotrópica}} = 4\pi I`,
    String.raw`\Phi_v = 683\,\tfrac{\text{lm}}{\text{W}} \int V(\lambda)\,\Phi_{e,\lambda}\,d\lambda \qquad K = \frac{\Phi_v}{\Phi_e}`,
    String.raw`\text{Bunsen: } \frac{I_1}{x^2} = \frac{I_2}{(D-x)^2} \;\Rightarrow\; I_2 = I_1\,\frac{(D-x)^2}{x^2}`,
  ],
  liveEquations(s, p) {
    switch (mode(p)) {
      case 1: {
        const src = sourceOf(p), b = rad(num(p, "beta", 30));
        const Om = solidAngle(b), Ph = coneFlux(src, b);
        return [
          String.raw`\Omega = 2\pi(1-\cos ${texNum(num(p, "beta", 30))}^\circ) = ${texNum(Om)}\ \text{sr} \qquad \Phi_{\text{cone}} = ${texNum(Ph)}\ \text{lm}`,
          String.raw`\bar E(r_2) = \frac{\Phi_{\text{cone}}}{\Omega r_2^2} = \frac{${texNum(Ph)}}{${texNum(Om)}\cdot ${texNum(s.r2)}^2} = ${texNum(Ph / (Om * s.r2 * s.r2))}\ \text{lx}`,
          String.raw`L = \frac{I_0}{\pi d^2/4} = ${texNum(luminance(p))}\ \text{cd/m}^2`,
        ];
      }
      case 2: {
        const { K, Phi } = radiantResult(p);
        const sc = num(p, "visao") > 0.5;
        return [String.raw`K = ${texNum(K)}\ \text{lm/W} \ (\text{máx. } ${sc ? KM_ESC : KM}) \qquad \Phi_v = K\,\Phi_e = ${texNum(K)}\cdot ${texNum(num(p, "P", 1))} = ${texNum(Phi)}\ \text{lm}`];
      }
      case 3: {
        const b = bunsenOf(s, p), D = num(p, "D", 2);
        return [
          String.raw`E_1 = \frac{${texNum(num(p, "I1", 20))}}{${texNum(s.xs)}^2} = ${texNum(b.EL)}\ \text{lx} \qquad E_2 = \frac{I_2}{${texNum(D - s.xs)}^2} = ${texNum(b.ER)}\ \text{lx}`,
          String.raw`\text{se a mancha some: } I_2 = ${texNum(num(p, "I1", 20))}\cdot\frac{${texNum(D - s.xs)}^2}{${texNum(s.xs)}^2} = ${texNum((num(p, "I1", 20) * (D - s.xs) ** 2) / s.xs ** 2)}\ \text{cd}`,
        ];
      }
      default: {
        const m = meterReading(s, p);
        if (!Number.isFinite(m.r))
          return [String.raw`E = E_\perp \cos\theta = ${texNum(SUN_E)} \cos ${texNum(deg(m.theta))}^\circ = ${texNum(m.E)}\ \text{lx}`];
        return [String.raw`E = \frac{I\cos\theta}{r^2} = \frac{${texNum(m.I)}\ \text{cd}\cdot\cos ${texNum(deg(m.theta))}^\circ}{(${texNum(m.r)}\ \text{m})^2} = ${texNum(m.E)}\ \text{lx}`];
      }
    }
  },

  params: [
    {
      key: "modo", label: "Experimento", unit: "", min: 0, max: 3, step: 1, default: 0,
      options: [
        { value: 0, label: "Luxímetro: inverso do quadrado e cosseno" },
        { value: 1, label: "Ângulo sólido, fluxo e luminância" },
        { value: 2, label: "Sensibilidade do olho V(λ)" },
        { value: 3, label: "Fotômetro de Bunsen" },
      ],
    },
    { key: "fonte", label: "Fonte", unit: "", min: 0, max: 4, step: 1, default: 0, live: true, options: SOURCES.map((s, i) => ({ value: i, label: s.name })) },
    { key: "elev", label: "Altura do Sol acima do horizonte", unit: "°", min: 5, max: 90, step: 1, default: 60, live: true },
    { key: "beta", label: "Semiabertura do cone β", unit: "°", min: 2, max: 89, step: 1, default: 30, live: true },
    { key: "espectro", label: "Espectro da fonte (V(λ))", unit: "", min: 0, max: 3, step: 1, default: 0, live: true, options: SPECTRA.map((l, i) => ({ value: i, label: l })) },
    { key: "lam", label: "Comprimento de onda (monocromática)", unit: "nm", min: 380, max: 780, step: 1, default: 555, live: true },
    { key: "T", label: "Temperatura do corpo negro", unit: "K", min: 1500, max: 10000, step: 50, default: 2800, live: true },
    { key: "P", label: "Potência radiante Φₑ", unit: "W", min: 0.01, max: 100, step: 0.01, default: 1, live: true, log: true },
    { key: "visao", label: "Visão", unit: "", min: 0, max: 1, step: 1, default: 0, live: true, options: [{ value: 0, label: "Fotópica (cones, dia)" }, { value: 1, label: "Escotópica (bastonetes, noite)" }] },
    { key: "I1", label: "Fonte padrão I₁ (fotômetro)", unit: "cd", min: 1, max: 100, step: 0.5, default: 20, live: true },
    { key: "desc", label: "Fonte desconhecida", unit: "", min: 0, max: 3, step: 1, default: 1, live: true, options: ["A", "B", "C", "D"].map((l, i) => ({ value: i, label: `Fonte ${l}` })) },
    { key: "D", label: "Comprimento do banco D", unit: "m", min: 1, max: 3, step: 0.1, default: 2 },
  ],

  observables: [
    {
      key: "E", label: "Iluminância medida", unit: "lx",
      value: (s, p) => (mode(p) === 3 ? bunsenOf(s, p).EL : mode(p) === 1 ? coneFlux(sourceOf(p), rad(num(p, "beta", 30))) / (solidAngle(rad(num(p, "beta", 30))) * s.r2 ** 2) : meterReading(s, p).E),
    },
    {
      key: "r", label: "Distância à fonte", unit: "m",
      value: (s, p) => { const m = mode(p); if (m === 3) return s.xs; if (m === 1) return s.r2; const r = meterReading(s, p).r; return Number.isFinite(r) ? r : 0; },
    },
    { key: "theta", label: "Ângulo de incidência θ", unit: "°", value: (s, p) => (mode(p) === 0 ? deg(meterReading(s, p).theta) : 0) },
    { key: "I", label: "Intensidade na direção do sensor", unit: "cd", value: (s, p) => { const I = meterReading(s, p).I; return Number.isFinite(I) ? I : 0; } },
    { key: "Phi", label: "Fluxo luminoso", unit: "lm", value: (_s, p) => (mode(p) === 2 ? radiantResult(p).Phi : mode(p) === 1 ? coneFlux(sourceOf(p), rad(num(p, "beta", 30))) : sourceOf(p).phi) },
    { key: "K", label: "Eficácia luminosa da radiação", unit: "lm/W", value: (_s, p) => radiantResult(p).K },
    { key: "L", label: "Luminância da fonte", unit: "cd/m²", value: (_s, p) => luminance(p) },
    { key: "ER", label: "Iluminância do lado da fonte desconhecida", unit: "lx", value: (s, p) => bunsenOf(s, p).ER },
    { key: "contraste", label: "Contraste da mancha (lado 1)", unit: "%", value: (s, p) => 100 * bunsenOf(s, p).contrast },
  ],
  chart: { x: "r", y: "E" },

  scenarios: [
    {
      id: "inverso-quadrado",
      label: "Inverso do quadrado",
      params: { modo: 0, fonte: 0 },
      guide: `### Iluminância e distância
1. Arraste o **luxímetro** (retângulo) pelo chão e pelo ar, sempre com a face voltada para a lâmpada (puxe a bolinha da normal).
2. Clique em **Registrar leitura** em várias distâncias: os pontos caem sobre a curva $E = I/r^2$.
3. Dobre a distância e confira: a leitura cai a $1/4$.
4. Troque para o **refletor LED**: a intensidade depende do ângulo $\\alpha$ com o eixo; fora do facho quase não há luz.`,
      predict: [
        {
          question: "A 1 m de uma lâmpada o luxímetro marca 60 lx. A 2 m, de frente para ela, marcará:",
          options: ["30 lx", "15 lx", "60 lx", "120 lx"],
          answer: 1,
          explanation: "A mesma luz se espalha por uma área $4\\times$ maior ($A \\propto r^2$): $E = I/r^2$ cai a um quarto.",
        },
      ],
    },
    {
      id: "cosseno",
      label: "Lei do cosseno (Sol)",
      params: { modo: 0, fonte: 4, elev: 30 },
      guide: `### Por que o inverno é frio
1. Com o Sol, a distância não importa (os raios são paralelos e $E_\\perp \\approx 100\\,000$ lx).
2. Gire a normal do sensor: $E = E_\\perp\\cos\\theta$. Com $\\theta = 60^\\circ$ a leitura cai à metade.
3. Mude a altura do Sol com o sensor deitado no chão: $E_{\\text{chão}} = E_\\perp \\operatorname{sen}h$.`,
      predict: [
        {
          question: "Com o Sol a 30° do horizonte, a iluminância no chão horizontal, comparada à de um painel voltado para o Sol, é:",
          options: ["igual", "a metade", "um terço", "o dobro"],
          answer: 1,
          explanation: "O ângulo entre a normal do chão e os raios é $60^\\circ$ e $\\cos 60^\\circ = 0{,}5$.",
        },
      ],
    },
    {
      id: "fluxo",
      label: "Ângulo sólido e luminância",
      params: { modo: 1, fonte: 2, beta: 20 },
      guide: `### O fluxo se conserva dentro do cone
1. O cone de semiabertura $\\beta$ abrange $\\Omega = 2\\pi(1-\\cos\\beta)$ esferorradianos.
2. Arraste a segunda calota: a área cresce com $r^2$ e a iluminância média cai com $1/r^2$, mas o fluxo dentro do cone é o mesmo.
3. Compare as fontes no quadro de **luminância**: uma vela e uma lâmpada leitosa têm brilho superficial parecido, embora a lâmpada produza 50 vezes mais lúmens.`,
    },
    {
      id: "olho",
      label: "Curva V(λ) do olho",
      params: { modo: 2, espectro: 0, lam: 555, P: 1 },
      guide: `### Um watt não é sempre igual
1. Com luz monocromática de 1 W em 555 nm, $\\Phi_v = 683$ lm, o máximo possível.
2. Mude para 450 nm ou 650 nm: a mesma potência parece muito mais fraca.
3. Escolha **corpo negro** a 2800 K: quase toda a radiação é infravermelha e $K \\approx 15$ lm/W. Compare com o LED branco.
4. Passe para a **visão escotópica**: o pico se desloca para 507 nm (efeito Purkinje: à noite o vermelho some primeiro).`,
      predict: [
        {
          question: "Um laser verde (532 nm) e um vermelho (650 nm), ambos de 5 mW. Qual parece mais brilhante?",
          options: ["o verde, várias vezes mais", "o vermelho", "são iguais, pois têm a mesma potência"],
          answer: 0,
          explanation: "$V(532) \\approx 0{,}88$ e $V(650) \\approx 0{,}10$: o verde produz cerca de 9 vezes mais lúmens.",
        },
      ],
    },
    {
      id: "bunsen",
      label: "Fotômetro de Bunsen",
      params: { modo: 3, I1: 20, desc: 1, D: 2 },
      guide: `### Medindo uma fonte desconhecida
1. Arraste o anteparo com a mancha de óleo ao longo do banco.
2. A mancha transmite mais e reflete menos que o papel: do lado mais iluminado ela parece **escura**, do outro, **clara**.
3. Quando a mancha some dos dois lados, $E_1 = E_2$. Leia $x$ e calcule $I_2 = I_1 (D-x)^2/x^2$.
4. Repita com as fontes A, B, C e D.`,
      predict: [
        {
          question: "Se a fonte desconhecida for 4 vezes mais intensa que a padrão, a mancha some a que distância da padrão?",
          options: ["D/2", "D/3", "D/4", "D/5"],
          answer: 1,
          explanation: "$I_2/I_1 = (D-x)^2/x^2 = 4 \\Rightarrow D - x = 2x \\Rightarrow x = D/3$.",
        },
      ],
    },
  ],

  exercises: [
    {
      id: "chao",
      prompt: "Uma lâmpada isotrópica de {I} cd está a {h} m de altura. Qual é a iluminância no chão num ponto a {x} m da vertical da lâmpada?",
      vary: { I: [20, 200, 0], h: [1, 3, 1], x: [0.5, 3, 1] },
      answer: { label: "E", unit: "lx", compute: (p) => (num(p, "I") * num(p, "h")) / (num(p, "h") ** 2 + num(p, "x") ** 2) ** 1.5 },
      hint: "E = I cos θ / r², com r² = h² + x² e cos θ = h/r.",
    },
    {
      id: "bunsen",
      prompt: "Num fotômetro de Bunsen com banco de {D} m, a fonte padrão tem {I1} cd. A mancha desaparece com o anteparo a {x} m da fonte padrão. Qual é a intensidade da outra fonte?",
      vary: { D: [1.5, 3, 1], I1: [10, 50, 0], x: [0.4, 1.0, 2] },
      answer: { label: "I₂", unit: "cd", compute: (p) => (num(p, "I1") * (num(p, "D") - num(p, "x")) ** 2) / num(p, "x") ** 2 },
    },
    {
      id: "lumens",
      prompt: "Uma fonte monocromática de {lam} nm emite {P} W de radiação. Usando V(λ) ≈ 1,019·exp[−285,4(λ/µm − 0,559)²], quantos lúmens ela produz?",
      vary: { lam: [450, 650, 0], P: [0.1, 5, 2] },
      answer: { label: "Φ", unit: "lm", compute: (p) => KM * Vphot(num(p, "lam")) * num(p, "P") },
      hint: "Φ = 683 lm/W · V(λ) · P.",
    },
  ],

  init: (p) => {
    const D = num(p, "D", 2);
    return { t: 0, lamp: [1.2, 2.6], meter: [2.2, 0.05], tilt: 0, r2: Math.min(2, capMax(p)), xs: D / 2, drag: null, readings: [] };
  },
  step: (s, _p, t, dt) => ({ ...s, t: t + dt }),

  viewport: (p) => ({ xMin: 0, xMax: W, yMin: mode(p) === 3 ? 0.2 : 0, yMax: mode(p) === 3 ? 8.4 : HH, unit: "" }),

  pointer: {
    down: (s, p, pt) => pick(s, p, pt),
    move(s, p, pt, dragging) {
      if (!dragging || !s.drag) return undefined;
      const X = clamp((pt.x - X0) / K0, 0, XMAX), Y = clamp((pt.y - Y0) / K0, 0, YMAX);
      switch (s.drag) {
        case "lamp": return { ...s, lamp: [X, Math.max(Y, 0.15)] };
        case "meter": return { ...s, meter: [X, Y] };
        case "normal": {
          const a = Math.atan2(pt.y - sy(s.meter[1]), pt.x - sx(s.meter[0]));
          return { ...s, tilt: a - Math.PI / 2 };
        }
        case "cap": return { ...s, r2: clamp(Math.hypot(pt.x - CX1, pt.y - CY1) / K1, 0.5, capMax(p)) };
        case "screen": {
          const D = num(p, "D", 2);
          return { ...s, xs: clamp((pt.x - BX0) / benchK(p), 0.05 * D, 0.95 * D) };
        }
      }
      return undefined;
    },
    up: (s) => (s.drag ? { ...s, drag: null } : undefined),
    cursor: (s, p, pt) => (pick(s, p, pt) ? "grab" : undefined),
  },

  actions: [
    {
      id: "registrar",
      label: "Registrar leitura (r, E)",
      run(s, p) {
        if (mode(p) !== 0) return s;
        const m = meterReading(s, p);
        if (!Number.isFinite(m.r)) return s;
        return { ...s, readings: [...s.readings, [m.r, m.E] as [number, number]].slice(-30) };
      },
    },
    { id: "limpar", label: "Limpar leituras", run: (s) => ({ ...s, readings: [] }) },
    {
      id: "apontar",
      label: "Apontar o sensor para a fonte",
      run(s, p) {
        if (mode(p) !== 0) return s;
        const src = sourceOf(p);
        if (src.phi === 0) {
          const e = rad(num(p, "elev", 60));
          return { ...s, tilt: Math.atan2(Math.sin(e), -Math.cos(e)) - Math.PI / 2 };
        }
        return { ...s, tilt: Math.atan2(s.lamp[1] - s.meter[1], s.lamp[0] - s.meter[0]) - Math.PI / 2 };
      },
    },
  ],

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const { state: s, params: p, theme } = frame;
    const m = mode(p);
    const T = (str: string, x: number, y: number, o: Parameters<typeof d.text>[3] = {}) => d.text(str, x, y, { size: 12, ...o });
    const glow = theme.dark ? "#ffd866" : "#e0a800";

    if (m === 0) {
      const src = sourceOf(p);
      const sun = src.phi === 0;
      // chão com mapa de iluminância
      const vals: number[] = [];
      for (let i = 0; i < 80; i++) vals.push(illuminance(src, s.lamp[0], s.lamp[1], ((i + 0.5) * XMAX) / 80, 0, 0, rad(num(p, "elev", 60))).E);
      const vmax = Math.max(...vals, 1e-9);
      vals.forEach((v, i) => d.rect(sx((i * XMAX) / 80), Y0 - 0.32, (K0 * XMAX) / 80 + 0.01, 0.32, { fill: glow, alpha: 0.08 + 0.85 * (v / vmax) }));
      d.support(X0, Y0, sx(XMAX), Y0, { color: theme.muted });
      T("iluminância no chão (mais claro = mais lux)", sx(XMAX / 2), Y0 - 0.55, { size: 10, color: theme.muted });
      // escala de metros
      for (let x = 0; x <= XMAX; x += 1) T(`${x} m`, sx(x), Y0 + 0.18, { size: 9, color: theme.muted });
      if (sun) {
        const e = rad(num(p, "elev", 60));
        const ux = Math.cos(e), uy = -Math.sin(e);
        for (let k = -3; k <= 9; k++) {
          const x0 = sx(k * 0.6), y0 = sy(YMAX);
          const L = 10;
          const pts: [number, number] = [x0 + ux * L, y0 + uy * L];
          d.line(x0, y0, pts[0], pts[1], { color: glow, alpha: 0.4, width: 1.2, dash: [6, 5] });
        }
        T(`Sol a ${fmt(num(p, "elev", 60))}° do horizonte · E⊥ = 100 000 lx`, sx(XMAX / 2), sy(YMAX) + 0.15, { color: glow, size: 11 });
      } else {
        const lx = sx(s.lamp[0]), ly = sy(s.lamp[1]);
        if (src.n > 1) {
          const half = Math.acos(0.5 ** (1 / src.n));
          const L = ly - Y0;
          d.polyline([[lx - Math.tan(half) * L, Y0], [lx, ly], [lx + Math.tan(half) * L, Y0]], { color: glow, alpha: 0.5, dash: [4, 4] });
          T(`facho: ${fmt(deg(2 * half), 2)}° (I ≥ I₀/2)`, lx + 0.35, ly - 0.45, { size: 10, color: glow, align: "left" });
        }
        d.circle(lx, ly, 0.5, { fill: glow, alpha: 0.18 });
        d.circle(lx, ly, 0.2, { fill: glow, stroke: theme.text, width: 1 });
        d.line(lx, ly + 0.2, lx, sy(YMAX) + 0.2, { color: theme.muted, width: 1 });
        T(src.name, lx, ly + 0.45, { size: 10, color: theme.muted });
        d.line(lx, ly, sx(s.meter[0]), sy(s.meter[1]), { color: glow, dash: [5, 4], width: 1.4 });
      }
      // luxímetro
      const mx = sx(s.meter[0]), my = sy(s.meter[1]);
      const nx = -Math.sin(s.tilt), ny = Math.cos(s.tilt);
      d.box(mx, my, 0.7, 0.16, s.tilt, { fill: theme.series[0], stroke: theme.text, width: 1 });
      d.arrow(mx, my, nx * 1.1, ny * 1.1, { color: theme.series[2], width: 1.6 });
      d.dot(mx + nx * 1.1, my + ny * 1.1, 6, theme.series[2]!);
      T("n̂", mx + nx * 1.1, my + ny * 1.1, { dx: 12, dy: -6, size: 11, color: theme.series[2] });
      const rd = meterReading(s, p);
      T(`θ = ${fmt(deg(rd.theta), 3)}°`, mx, my, { dy: 18, size: 11 });

      // painel do instrumento
      const px0 = 10.8;
      d.rect(px0, 7.3, 4.9, 2.4, { fill: theme.dark ? "#1b222c" : "#f3f5f8", stroke: theme.grid, width: 1 });
      T("LUXÍMETRO", px0 + 2.45, 9.4, { size: 10, color: theme.muted, weight: "600" });
      T(`${fmt(rd.E, 4)} lx`, px0 + 2.45, 8.75, { size: 22, weight: "700", color: theme.series[0] });
      T(Number.isFinite(rd.r) ? `r = ${fmt(rd.r)} m   I = ${fmt(rd.I)} cd` : "fonte no infinito", px0 + 2.45, 8.05, { size: 11 });
      T(sun ? "E = E⊥ cos θ" : `α (eixo da fonte) = ${fmt(deg(rd.alpha), 3)}°`, px0 + 2.45, 7.6, { size: 11, color: theme.muted });

      // gráfico log E × log r (reta de inclinação −2)
      const gx = 11.3, gy = 1.0, gw = 4.3, gh = 5.3;
      const Iref = Number.isFinite(rd.I) && rd.I > 0 ? rd.I : I0(src) || 1;
      const lr0 = Math.log10(0.2), lr1 = Math.log10(5);
      const le1 = Math.log10(Iref / 0.04), le0 = le1 - 3.5;
      const GX = (r: number) => gx + (gw * (Math.log10(r) - lr0)) / (lr1 - lr0);
      const GY = (E: number) => gy + (gh * clamp((Math.log10(Math.max(E, 1e-30)) - le0) / (le1 - le0), 0, 1));
      d.line(gx, gy, gx + gw, gy, { color: theme.muted, width: 1 });
      d.line(gx, gy, gx, gy + gh, { color: theme.muted, width: 1 });
      T("r (m), escala log", gx + gw, gy - 0.55, { size: 10, color: theme.muted, align: "right" });
      T("E (lx), escala log", gx, gy + gh + 0.25, { size: 10, color: theme.muted, align: "left" });
      for (const r of [0.2, 0.5, 1, 2, 5]) T(fmt(r), GX(r), gy - 0.22, { size: 9, color: theme.muted });
      for (let k = Math.ceil(le0); k <= Math.floor(le1); k++) {
        d.line(gx, GY(10 ** k), gx + gw, GY(10 ** k), { color: theme.grid, width: 1 });
        T(fmt(10 ** k), gx - 0.08, GY(10 ** k), { size: 9, color: theme.muted, align: "right" });
      }
      if (!sun) {
        d.line(GX(0.2), GY(Iref / 0.04), GX(5), GY(Iref / 25), { color: theme.series[1], dash: [5, 3], width: 1.3 });
        T(`E = I/r² (inclinação −2)`, gx + gw, gy + gh - 0.2, { size: 10, color: theme.series[1], align: "right" });
      }
      for (const [r, E] of s.readings) if (r >= 0.2 && r <= 5 && E > 0) d.dot(GX(r), GY(E), 4, theme.series[0]!);
      if (Number.isFinite(rd.r) && rd.r >= 0.2 && rd.E > 0) d.dot(GX(rd.r), GY(rd.E), 5, theme.series[2]!, 0.8);
      T("arraste o luxímetro, a lâmpada e a ponta da normal", 5.3, 9.65, { size: 10, color: theme.muted });
      return;
    }

    if (m === 1) {
      const src = sourceOf(p);
      const b = rad(num(p, "beta", 30));
      const Om = solidAngle(b), Ph = coneFlux(src, b);
      const R = capMax(p);
      const sector: [number, number][] = [[CX1, CY1]];
      for (let i = 0; i <= 40; i++) {
        const a = -b + (2 * b * i) / 40;
        sector.push([CX1 + R * K1 * Math.cos(a), CY1 + R * K1 * Math.sin(a)]);
      }
      d.polyline(sector, { color: glow, fill: glow, alpha: 0.18, close: true });
      const cap = (r: number, c: string, lbl: string, up: boolean) => {
        const pts: [number, number][] = [];
        for (let i = 0; i <= 40; i++) {
          const a = -b + (2 * b * i) / 40;
          pts.push([CX1 + r * K1 * Math.cos(a), CY1 + r * K1 * Math.sin(a)]);
        }
        d.polyline(pts, { color: c, width: 4 });
        const A = Om * r * r;
        const x = CX1 + r * K1 + 0.15, y0 = up ? CY1 + 1.2 : CY1 - 0.4;
        T(`${lbl}: r = ${fmt(r)} m`, x, y0, { size: 11, color: c, align: "left" });
        T(`A = Ωr² = ${fmt(A)} m²`, x, y0 - 0.38, { size: 10, color: c, align: "left" });
        T(`Ē = Φ/A = ${fmt(Ph / A)} lx`, x, y0 - 0.76, { size: 10, color: c, align: "left" });
      };
      cap(1, theme.series[0]!, "calota 1", true);
      cap(s.r2, theme.series[2]!, "calota 2 (arraste)", false);
      d.circle(CX1, CY1, 0.18, { fill: glow, stroke: theme.text, width: 1 });
      T(`β = ${fmt(num(p, "beta", 30))}°`, CX1 + 0.9, CY1 + 0.25, { size: 11, align: "left" });
      T(src.phi === 0 ? "Sol: escolha uma fonte pontual para o cone" : `${src.name}`, CX1 - 0.2, CY1 - 0.5, { size: 10, color: theme.muted, align: "left" });
      // painel de valores
      const x0 = 11.6;
      let y = 9.4;
      const line = (str: string, c = theme.text, w = "400") => { T(str, x0, y, { align: "left", size: 11, color: c, weight: w }); y -= 0.42; };
      line("Dentro do cone", theme.text, "600");
      line(`Ω = ${fmt(Om)} sr  (esfera: 4π = 12,57 sr)`);
      line(`Φ no cone = ${fmt(Ph)} lm de ${fmt(src.phi)} lm`);
      line(`I₀ = ${fmt(I0(src))} cd`);
      line("o fluxo é o mesmo nas duas calotas", theme.muted);
      // luminâncias
      y -= 0.2;
      line("Luminância (log, cd/m²)", theme.text, "600");
      const Ls = [...LUM_REFS, ["esta fonte", luminance(p)] as [string, number]].sort((a, c) => c[1] - a[1]);
      const bx = x0 + 1.9, bw = 1.5;
      for (const [nm, L] of Ls) {
        const f = clamp(Math.log10(L) / 10, 0, 1);
        const mine = nm === "esta fonte";
        d.rect(bx, y - 0.13, bw * f, 0.26, { fill: mine ? theme.series[2] : theme.muted, alpha: mine ? 0.9 : 0.45 });
        T(nm, bx - 0.1, y, { size: 9, align: "right", color: mine ? theme.series[2] : theme.text });
        T(sci(L), bx + bw * f + 0.08, y, { size: 9, align: "left", color: theme.muted });
        y -= 0.36;
      }
      return;
    }

    if (m === 2) {
      const kind = Math.round(num(p, "espectro"));
      const lam = num(p, "lam", 555), Tk = num(p, "T", 2800);
      const sc = num(p, "visao") > 0.5;
      const { S } = spectrum(kind, lam, Tk);
      const gx = 0.9, gy = 1.3, gw = 10, gh = 7.2;
      const X = (nm: number) => gx + (gw * (nm - 380)) / 400;
      // faixa do espectro visível
      for (let nm = 380; nm < 780; nm += 4) d.rect(X(nm), gy - 0.45, (gw * 4) / 400 + 0.01, 0.3, { fill: wlColor(nm + 2) });
      d.line(gx, gy, gx + gw, gy, { color: theme.muted, width: 1 });
      d.line(gx, gy, gx, gy + gh, { color: theme.muted, width: 1 });
      for (let nm = 400; nm <= 750; nm += 50) T(String(nm), X(nm), gy - 0.75, { size: 9, color: theme.muted });
      T("λ (nm)", gx + gw, gy - 1.05, { size: 10, color: theme.muted, align: "right" });
      // espectro da fonte (normalizado ao máximo no visível)
      let smax = 0;
      for (let nm = 380; nm <= 780; nm += 0.5) smax = Math.max(smax, S(nm));
      if (kind === 0 || kind === 3) {
        const l0 = kind === 0 ? lam : 589.3;
        d.line(X(l0), gy, X(l0), gy + gh * 0.95, { color: wlColor(l0), width: 4 });
        const V = sc ? Vscot(l0) : Vphot(l0);
        d.line(X(l0), gy, X(l0), gy + gh * V, { color: theme.text, width: 1.5 });
        d.dot(X(l0), gy + gh * V, 5, theme.text);
        T(`V = ${fmt(V)}`, X(l0), gy + gh * V, { dx: 8, align: "left", size: 11 });
      } else {
        const pts: [number, number][] = [[X(380), gy]];
        const prod: [number, number][] = [[X(380), gy]];
        const V = sc ? Vscot : Vphot;
        for (let nm = 380; nm <= 780; nm += 2) {
          pts.push([X(nm), gy + (0.95 * gh * S(nm)) / smax]);
          prod.push([X(nm), gy + (0.95 * gh * S(nm) * V(nm)) / smax]);
        }
        pts.push([X(780), gy]);
        prod.push([X(780), gy]);
        d.polyline(pts, { color: theme.series[1], fill: theme.series[1], alpha: 0.18, width: 1.5 });
        d.polyline(prod, { color: "none", fill: theme.series[2], alpha: 0.45 });
        T("espectro da fonte (relativo)", X(700), gy + 0.95 * gh * Math.min(1, S(700) / smax) + 0.3, { size: 10, color: theme.series[1] });
        T("área verde ∝ lúmens", X(610), gy + 0.6, { size: 10, color: theme.series[2] });
      }
      d.plot((x) => gy + gh * Vphot(380 + ((x - gx) * 400) / gw), gx, gx + gw, { color: theme.text, width: sc ? 1 : 2.2, alpha: sc ? 0.5 : 1 });
      d.plot((x) => gy + gh * Vscot(380 + ((x - gx) * 400) / gw), gx, gx + gw, { color: theme.series[4], width: sc ? 2.2 : 1, dash: [6, 3] });
      T("V(λ) fotópica", X(600), gy + gh * Vphot(600) + 0.3, { size: 11, align: "left" });
      T("V'(λ) escotópica", X(455), gy + gh * Vscot(455) + 0.3, { size: 11, align: "right", color: theme.series[4] });
      T("1", gx - 0.15, gy + gh, { size: 9, color: theme.muted, align: "right" });
      // painel
      const { K, Phi } = radiantResult(p);
      const x0 = 11.6;
      let y = 9.3;
      const line = (str: string, c = theme.text, w = "400") => { T(str, x0, y, { align: "left", size: 11, color: c, weight: w }); y -= 0.45; };
      line(SPECTRA[kind]!, theme.text, "600");
      if (kind === 1) line(`T = ${fmt(Tk, 4)} K`);
      if (kind === 0) line(`λ = ${fmt(lam)} nm`);
      line(`Φₑ = ${fmt(num(p, "P", 1))} W (radiante)`);
      line(`K = ${fmt(K)} lm/W`, theme.series[2], "600");
      line(`Φv = ${fmt(Phi)} lm`, theme.series[2], "600");
      line(sc ? "visão escotópica (máx. 1700 lm/W)" : "visão fotópica (máx. 683 lm/W)", theme.muted);
      y -= 0.2;
      T("cor percebida", x0, y, { align: "left", size: 10, color: theme.muted });
      d.rect(x0 + 1.4, y - 0.35, 1.2, 0.7, { fill: spectrumColor(S), stroke: theme.text, width: 1 });
      y -= 1.0;
      line("Referência (lm por W elétrico):", theme.muted);
      line("incandescente ≈ 12 · halógena ≈ 18", theme.muted);
      line("fluorescente ≈ 60 · LED ≈ 100–150", theme.muted);
      line("sódio baixa pressão ≈ 180", theme.muted);
      return;
    }

    // Fotômetro de Bunsen
    const D = num(p, "D", 2), k = benchK(p);
    const b = bunsenOf(s, p);
    const xs = BX0 + s.xs * k;
    d.rect(BX0 - 0.3, BY - 1.1, BX1 - BX0 + 0.6, 0.18, { fill: theme.muted, alpha: 0.6 });
    for (let x = 0; x <= D + 1e-9; x += 0.1) {
      const big = Math.abs(x * 10 - Math.round(x * 10)) < 1e-6 && Math.round(x * 10) % 5 === 0;
      d.line(BX0 + x * k, BY - 0.92, BX0 + x * k, BY - 0.92 + (big ? 0.25 : 0.12), { color: theme.text, width: 1 });
      if (big) T(fmt(x, 2), BX0 + x * k, BY - 1.35, { size: 9, color: theme.muted });
    }
    const lamp = (x: number, lbl: string, c: string) => {
      d.circle(x, BY, 0.5, { fill: glow, alpha: 0.2 });
      d.circle(x, BY, 0.22, { fill: glow, stroke: theme.text, width: 1 });
      d.line(x, BY - 0.22, x, BY - 0.92, { color: theme.text, width: 2 });
      T(lbl, x, BY + 0.75, { size: 11, color: c });
    };
    lamp(BX0, `padrão I₁ = ${fmt(num(p, "I1", 20))} cd`, theme.text);
    lamp(BX1, `fonte ${"ABCD"[clamp(Math.round(num(p, "desc")), 0, 3)]} (I₂ = ?)`, theme.text);
    // anteparo
    d.rect(xs - 0.06, BY - 0.9, 0.12, 1.8, { fill: theme.dark ? "#d9d9d9" : "#f4f4f4", stroke: theme.text, width: 1 });
    d.circle(xs, BY, 0.18, { fill: "#c9b37a", alpha: 0.8 });
    T("arraste o anteparo", xs, BY + 1.15, { size: 10, color: theme.muted });
    T(`x = ${fmt(s.xs, 3)} m`, xs, BY - 1.75, { size: 11, weight: "600" });
    // aparência dos dois lados
    const view = (cx: number, paper: number, spot: number, lbl: string) => {
      const ref = Math.max(b.paperL, b.paperR, b.spotL, b.spotR);
      const g = (v: number) => Math.round(255 * Math.pow(clamp(v / ref, 0, 1), 1 / 2.2));
      d.rect(cx - 1, 0.6, 2, 2, { fill: `rgb(${g(paper)}, ${g(paper)}, ${g(paper * 0.95)})`, stroke: theme.text, width: 1 });
      d.circle(cx, 1.6, 0.45, { fill: `rgb(${g(spot)}, ${g(spot)}, ${g(spot * 0.95)})` });
      T(lbl, cx, 2.9, { size: 11 });
    };
    view(4.5, b.paperL, b.spotL, "visto do lado da padrão");
    view(8.5, b.paperR, b.spotR, "visto do lado da desconhecida");
    const x0 = 11.0;
    let y = 3.6;
    const line = (str: string, c = theme.text, w = "400") => { T(str, x0, y, { align: "left", size: 11, color: c, weight: w }); y -= 0.42; };
    line(`E₁ = ${fmt(b.EL)} lx`, theme.series[0], "600");
    line(`E₂ = ${fmt(b.ER)} lx`, theme.series[1], "600");
    line(`contraste = ${fmt(100 * b.contrast, 2)} %`);
    line(Math.abs(b.contrast) < 0.02 ? "a mancha sumiu: E₁ = E₂" : b.EL > b.ER ? "mancha escura do lado 1: E₁ > E₂" : "mancha clara do lado 1: E₁ < E₂", theme.muted);
    // marca o equilíbrio só depois de achado (para não entregar a resposta)
    if (Math.abs(b.contrast) < 0.02) d.line(BX0 + bunsenBalance(num(p, "I1", 20), unknownI(p), D) * k, BY - 0.9, BX0 + bunsenBalance(num(p, "I1", 20), unknownI(p), D) * k, BY + 0.9, { color: theme.series[2], dash: [3, 3] });
  },
});

export default fotometria;
