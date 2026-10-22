import { defineSim, draw, formatBR, num, texNum, type Params } from "@fisilab/core";
import { panel } from "./panel.ts";
import {
  INSTRUMENTS,
  centroid,
  f1Of,
  freq,
  harmonicOf,
  instrumentOf,
  leffOf,
  lenOf,
  modeOf,
  profile,
  profileMax,
  synthAmps,
  tipoOf,
  vOf,
  waveform,
} from "./physics.ts";

/** Frequência da animação em câmera lenta (Hz). */
const F_VIS = 0.7;
const TX0 = 1.3;
const TX1 = 10.7;
const TY = 7.75;
const TR = 0.55;
const NSL = 44;

const phase = (t: number) => 2 * Math.PI * F_VIS * t;
const xw = (p: Params, x: number) => TX0 + (x / lenOf(p)) * (TX1 - TX0);
/** Meia altura do tubo desenhado na posição x (cone abre linearmente). */
const halfH = (p: Params, x: number) => (tipoOf(p) === 2 ? 0.08 + (TR + 0.2 - 0.08) * (x / lenOf(p)) : TR);
const NOMES = ["aberto–aberto", "fechado–aberto", "cônico"];

function micVal(s: number[], p: Params, t: number, which: "p" | "s"): number {
  const x = (s[0] ?? 0.5) * lenOf(p);
  const mx = profileMax(p);
  const v = profile(p, x);
  return (which === "p" ? v.p / mx.p : v.s / mx.s) * Math.cos(phase(t));
}

export const tubosSonoros = defineSim({
  id: "tubos-sonoros",
  title: "Tubos sonoros e instrumentos musicais",
  course: "FG II",
  topic: "Som",
  priority: "P2",
  summary:
    "Ondas estacionárias em tubos aberto–aberto, fechado–aberto e cônico: perfis de pressão e de deslocamento, série harmônica de cada tubo e o espectro de flauta, clarinete, oboé e saxofone, com a forma de onda sintetizada e o tom de cada modo no alto-falante.",
  equations: [
    String.raw`v = 331{,}3\sqrt{1 + T/273{,}15}\ \text{m/s} \qquad \lambda f = v`,
    String.raw`\text{aberto–aberto e cone: } f_n = \frac{n\,v}{2L'} \qquad \text{fechado–aberto: } f_n = \frac{(2n-1)\,v}{4L'} \qquad L' = L + 0{,}61\,r\ \text{por boca aberta}`,
    String.raw`\text{aberto: } s \propto \cos kx,\ \Delta p \propto \text{sen}\,kx \qquad \text{fechado: } s \propto \text{sen}\,kx,\ \Delta p \propto \cos kx \qquad \text{cone: } \Delta p \propto \frac{\text{sen}\,kx}{kx}`,
    String.raw`\Delta p = -B\,\nabla\!\cdot s \qquad y(t) = \sum_h A_h\,\text{sen}(2\pi h f_1 t + \varphi_h)`,
  ],
  liveEquations(_s, p) {
    const n = modeOf(p);
    const tipo = tipoOf(p);
    const fn = freq(p);
    const h = harmonicOf(tipo, n);
    return [
      String.raw`v = ${texNum(vOf(p), 4)}\ \text{m/s} \qquad L' = ${texNum(leffOf(p), 3)}\ \text{m}`,
      tipo === 1
        ? String.raw`f_{${n}} = \frac{${2 * n - 1}\cdot ${texNum(vOf(p), 4)}}{4\cdot ${texNum(leffOf(p), 3)}} = ${texNum(fn, 4)}\ \text{Hz} = ${h}\,f_1`
        : String.raw`f_{${n}} = \frac{${n}\cdot ${texNum(vOf(p), 4)}}{2\cdot ${texNum(leffOf(p), 3)}} = ${texNum(fn, 4)}\ \text{Hz} = ${h}\,f_1`,
      String.raw`\lambda_{${n}} = v/f_{${n}} = ${texNum(vOf(p) / fn, 3)}\ \text{m} \qquad \text{centroide espectral} = ${texNum(centroid(p), 4)}\ \text{Hz}`,
    ];
  },

  params: [
    {
      key: "tipo",
      label: "Tubo",
      unit: "",
      min: 0,
      max: 2,
      step: 1,
      default: 0,
      options: [
        { value: 0, label: "Aberto nas duas pontas" },
        { value: 1, label: "Fechado numa ponta (aberto na outra)" },
        { value: 2, label: "Cônico (ápice fechado, boca aberta)" },
      ],
    },
    { key: "L", label: "Comprimento L", unit: "m", min: 0.1, max: 2, step: 0.01, default: 0.6, live: true },
    { key: "T", label: "Temperatura do ar", unit: "°C", min: -20, max: 45, step: 1, default: 20, live: true },
    { key: "r", label: "Raio da boca (correção de extremidade)", unit: "cm", min: 0, max: 4, step: 0.1, default: 0, live: true },
    { key: "n", label: "Ressonância mostrada n", unit: "", min: 1, max: 8, step: 1, default: 1, live: true },
    {
      key: "instr",
      label: "Espectro de instrumento",
      unit: "",
      min: 0,
      max: INSTRUMENTS.length - 1,
      step: 1,
      default: 0,
      live: true,
      options: INSTRUMENTS.map((i) => ({ value: i.value, label: i.label })),
    },
    {
      key: "som",
      label: "Som",
      unit: "",
      min: 0,
      max: 2,
      step: 1,
      default: 0,
      live: true,
      options: [
        { value: 0, label: "Desligado" },
        { value: 1, label: "Tocar a ressonância n (volume do espectro)" },
        { value: 2, label: "Tocar a nota com o timbre (soma dos harmônicos)" },
      ],
    },
  ],

  observables: [
    { key: "f1", label: "Frequência fundamental f₁", unit: "Hz", value: (_s, p) => f1Of(p) },
    { key: "fn", label: "Frequência da ressonância n", unit: "Hz", value: (_s, p) => freq(p) },
    { key: "h", label: "Número do harmônico f_n/f₁", unit: "", value: (_s, p) => freq(p) / f1Of(p) },
    { key: "lambda", label: "Comprimento de onda λ_n", unit: "m", value: (_s, p) => vOf(p) / freq(p) },
    { key: "v", label: "Velocidade do som", unit: "m/s", value: (_s, p) => vOf(p) },
    { key: "Leff", label: "Comprimento efetivo L'", unit: "m", value: (_s, p) => leffOf(p) },
    { key: "pmic", label: "Pressão no microfone (relativa, câmera lenta)", unit: "", value: (s, p, t) => micVal(s, p, t, "p") },
    { key: "smic", label: "Deslocamento no microfone (relativo, câmera lenta)", unit: "", value: (s, p, t) => micVal(s, p, t, "s") },
    { key: "xmic", label: "Posição do microfone", unit: "m", value: (s, p) => (s[0] ?? 0.5) * lenOf(p) },
    { key: "brilho", label: "Centroide espectral", unit: "Hz", value: (_s, p) => centroid(p) },
  ],
  chart: { x: "t", y: "pmic" },

  scenarios: [
    {
      id: "flauta",
      label: "Flauta: tubo aberto",
      params: { tipo: 0, L: 0.6, T: 20, n: 1, instr: 1, r: 0 },
      guide: `### Tubo aberto nas duas pontas
1. Nas bocas a pressão é a atmosférica: **nó de pressão** e **ventre de deslocamento**.
2. O fundamental tem $\\lambda = 2L$, então $f_1 = v/2L$. Suba **n**: as ressonâncias são $f_1, 2f_1, 3f_1, \\dots$ (série harmônica completa).
3. Arraste o **microfone** pelo tubo e veja no gráfico que pressão e deslocamento têm nós em lugares diferentes.
4. O espectro da flauta tem todos os harmônicos, com o fundamental dominante: timbre "suave".`,
    },
    {
      id: "clarinete",
      label: "Clarinete: tubo fechado numa ponta",
      params: { tipo: 1, L: 0.6, T: 20, n: 1, instr: 2, r: 0 },
      guide: `### Tubo fechado–aberto
1. A palheta fecha o tubo: ali há **ventre de pressão**. O fundamental tem $\\lambda = 4L$, logo $f_1 = v/4L$.
2. Suba **n**: as ressonâncias são $f_1, 3f_1, 5f_1, \\dots$, só os **ímpares**.
3. Compare o espectro do clarinete com as linhas tracejadas das ressonâncias: os harmônicos pares são fracos no registro grave.
4. É por isso que o clarinete "sobe uma 12ª" (×3) ao usar a chave de registro, e não uma oitava.`,
      predict: [
        {
          question: "Um tubo fechado numa ponta tem o mesmo comprimento de um tubo aberto. A nota fundamental do tubo fechado é:",
          options: ["uma oitava acima", "a mesma", "uma oitava abaixo"],
          answer: 2,
          explanation: "Fechado: $\\lambda_1 = 4L$; aberto: $\\lambda_1 = 2L$. O dobro do comprimento de onda dá metade da frequência: uma oitava abaixo.",
        },
      ],
    },
    {
      id: "cone",
      label: "Oboé e saxofone: tubo cônico",
      params: { tipo: 2, L: 0.6, T: 20, n: 2, instr: 3, r: 0 },
      guide: `### O cone se comporta como tubo aberto
1. Mesmo com o ápice fechado, um cone completo ressoa em $f_n = n v/2L$: **todos** os harmônicos.
2. As ondas são esféricas: $\\Delta p \\propto \\text{sen}(kx)/kx$, mais intensa perto do ápice.
3. Compare o oboé (fundamental fraco, harmônicos 2–4 fortes: som "anasalado") com o saxofone.
4. Ligue o **Som** e percorra **n** para ouvir cada componente com o volume que ele tem no espectro.`,
    },
    {
      id: "temperatura",
      label: "Temperatura e afinação",
      params: { tipo: 0, L: 0.6, T: 0, n: 1, instr: 1, som: 0 },
      guide: `### Instrumento de sopro no frio e no calor
1. Anote $f_1$ a $0\\,°\\text{C}$ e depois a $35\\,°\\text{C}$.
2. Como $f \\propto v \\propto \\sqrt{T}$ (kelvin), o aumento é de $\\sqrt{308/273} \\approx 6\\%$, quase um semitom.
3. Ligue **r** (raio da boca) e veja a correção de extremidade baixar um pouco a nota.`,
      predict: [
        {
          question: "Uma flauta afinada num palco frio é tocada depois que o palco esquenta. A nota:",
          options: ["fica mais aguda", "fica mais grave", "não muda (o comprimento é o mesmo)"],
          answer: 0,
          explanation: "O comprimento de onda é fixado pelo tubo, mas $v$ cresce com a temperatura; como $f = v/\\lambda$, a nota sobe.",
        },
      ],
    },
  ],

  exercises: [
    {
      id: "fechado-segunda",
      prompt: "Um tubo de {L} m é fechado numa ponta e aberto na outra; o ar está a {T} °C. Qual é a frequência da segunda ressonância (despreze a correção de extremidade)?",
      vary: { L: [0.2, 1.5, 2], T: [0, 35, 0] },
      fixed: { tipo: 1, r: 0 },
      answer: { label: "f₂", unit: "Hz", compute: (p) => (3 * 331.3 * Math.sqrt(1 + num(p, "T") / 273.15)) / (4 * num(p, "L")) },
      hint: "Só harmônicos ímpares: a 2ª ressonância é 3v/4L, com v = 331,3√(1 + T/273,15).",
    },
    {
      id: "flauta-comprimento",
      prompt: "Que comprimento deve ter um tubo aberto nas duas pontas para que seu fundamental seja {f} Hz com o ar a {T} °C?",
      vary: { f: [262, 1047, 0], T: [10, 35, 0] },
      fixed: { tipo: 0, r: 0 },
      answer: { label: "L", unit: "m", compute: (p) => (331.3 * Math.sqrt(1 + num(p, "T") / 273.15)) / (2 * num(p, "f")) },
      hint: "Tubo aberto: λ₁ = 2L.",
    },
  ],

  init: () => [0.5],
  derivatives: () => [0],
  dt: 1 / 120,
  sampleEvery: 2,
  maxSamples: 6000,

  tone(p) {
    const fn = freq(p);
    const som = Math.round(num(p, "som"));
    if (som === 2) return { freq: freq(p, 1), gain: 0.15, harmonics: synthAmps(p) };
    if (som !== 1) return { freq: fn, gain: 0 };
    const amps = synthAmps(p);
    const h = harmonicOf(tipoOf(p), modeOf(p));
    const max = Math.max(...amps, 1e-9);
    const a = instrumentOf(p).amps.length ? (amps[h - 1] ?? 0) / max : 1;
    return { freq: fn, gain: 0.15 * Math.max(0, Math.min(1, a)) };
  },

  pointer: {
    down(s, p, pt) {
      if (pt.x < TX0 - 0.2 || pt.x > TX1 + 0.2 || Math.abs(pt.y - TY) > 1.1) return undefined;
      return [Math.max(0, Math.min(1, (pt.x - TX0) / (TX1 - TX0)))];
    },
    move(s, p, pt, dragging) {
      if (!dragging || Math.abs(pt.y - TY) > 1.6) return undefined;
      return [Math.max(0, Math.min(1, (pt.x - TX0) / (TX1 - TX0)))];
    },
    cursor: (_s, _p, pt) => (pt.x > TX0 - 0.2 && pt.x < TX1 + 0.2 && Math.abs(pt.y - TY) < 1.1 ? "ew-resize" : undefined),
  },

  viewport: () => ({ xMin: 0, xMax: 12, yMin: -0.15, yMax: 9.6, unit: "" }),

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const { state: s, params: p, theme, t } = frame;
    const L = lenOf(p);
    const tipo = tipoOf(p);
    const n = modeOf(p);
    const c = Math.cos(phase(t));
    const mx = profileMax(p);

    // ---- Tubo com faixas de pressão e fatias de ar ----
    const NS = 60;
    for (let j = 0; j < NS; j++) {
      const xa = (L * j) / NS, xb = (L * (j + 1)) / NS;
      const pv = (profile(p, (xa + xb) / 2).p / mx.p) * c;
      const hh = halfH(p, (xa + xb) / 2);
      d.rect(xw(p, xa), TY - hh, xw(p, xb) - xw(p, xa) + 0.005, 2 * hh, { fill: pv >= 0 ? theme.positive : theme.negative, alpha: 0.6 * Math.abs(pv) });
    }
    for (let j = 0; j <= NSL; j++) {
      const x0 = (L * (j + 0.5)) / (NSL + 1);
      const ds = (profile(p, x0).s / mx.s) * c * 0.16;
      const X = xw(p, x0) + ds;
      const hh = halfH(p, Math.max(0, Math.min(L, x0))) * 0.9;
      d.line(X, TY - hh, X, TY + hh, { color: theme.text, width: 1, alpha: 0.55 });
    }
    // Paredes
    const top: [number, number][] = [], bot: [number, number][] = [];
    for (let i = 0; i <= 40; i++) {
      const x = (L * i) / 40;
      top.push([xw(p, x), TY + halfH(p, x)]);
      bot.push([xw(p, x), TY - halfH(p, x)]);
    }
    d.polyline(top, { color: theme.text, width: 2.5 });
    d.polyline(bot, { color: theme.text, width: 2.5 });
    if (tipo !== 0) d.line(TX0, TY - halfH(p, 0) - 0.05, TX0, TY + halfH(p, 0) + 0.05, { color: theme.text, width: 6 });
    d.text(tipo === 0 ? "aberto" : tipo === 1 ? "fechado (palheta)" : "ápice", TX0, TY + TR + 0.45, { color: theme.muted, size: 10 });
    d.text("aberto", TX1, TY + TR + 0.45, { color: theme.muted, size: 10 });
    d.text(`L = ${formatBR(L, 3)} m · tubo ${NOMES[tipo]}`, (TX0 + TX1) / 2, TY + TR + 0.75, { color: theme.text, size: 12, weight: "600" });
    // Microfone
    const xm = xw(p, (s[0] ?? 0.5) * L);
    d.polyline([[xm, TY - TR - 0.12], [xm - 0.13, TY - TR - 0.38], [xm + 0.13, TY - TR - 0.38]], { color: theme.accent, width: 1.5, close: true, fill: theme.accent });
    d.text("microfone (arraste)", xm + 0.2, TY - TR - 0.28, { color: theme.accent, size: 10, align: "left" });
    d.text("vermelho: compressão · azul: rarefação · linhas verticais: camadas de ar (câmera lenta)", 6, TY - TR - 0.72, { color: theme.muted, size: 10 });

    // ---- Perfis de pressão e deslocamento ----
    const pp = panel(d, { x0: TX0, y0: 4.05, x1: TX1, y1: 5.9 }, { min: 0, max: L }, { min: -1.15, max: 1.15 });
    pp.frame({ xlabel: "x (m)", ylabel: "perfis normalizados", yticks: [-1, 0, 1], fx: (v) => formatBR(v, 2) });
    pp.plot((x) => profile(p, x).p / mx.p, 0, L, { color: theme.positive, width: 1, dash: [4, 4], alpha: 0.6 });
    pp.plot((x) => -profile(p, x).p / mx.p, 0, L, { color: theme.positive, width: 1, dash: [4, 4], alpha: 0.6 });
    pp.plot((x) => (profile(p, x).p / mx.p) * c, 0, L, { color: theme.positive, width: 2 });
    pp.plot((x) => (profile(p, x).s / mx.s) * c, 0, L, { color: theme.accent, width: 2 });
    d.text("Δp (pressão)", TX1 - 1.9, 6.12, { color: theme.positive, size: 11, weight: "600" });
    d.text("s (deslocamento)", TX1 - 0.4, 6.12, { color: theme.accent, size: 11, weight: "600" });
    // Nós de pressão
    for (let i = 1; i < 400; i++) {
      const xa = (L * (i - 1)) / 400, xb = (L * i) / 400;
      const a = profile(p, xa).p, b = profile(p, xb).p;
      if (a === 0 || a * b < 0) d.text("N", pp.X((xa + xb) / 2), pp.Y(0), { color: theme.positive, size: 10, weight: "700", dy: -9 });
    }

    // ---- Espectro ----
    const f1 = f1Of(p);
    const amps = synthAmps(p);
    const amax = Math.max(...amps, 1e-9);
    const fmax = 10.5 * f1;
    const ps = panel(d, { x0: 0.9, y0: 0.55, x1: 5.8, y1: 3.0 }, { min: 0, max: fmax }, { min: 0, max: 1.1 });
    ps.frame({ xlabel: "f (Hz)", ylabel: "amplitude relativa", yticks: [0, 0.5, 1], fx: (v) => formatBR(v, 3) });
    for (let k = 1; ; k++) {
      const fk = freq(p, k);
      if (fk > fmax) break;
      d.line(ps.X(fk), ps.Y(0), ps.X(fk), ps.Y(1.1), { color: theme.muted, width: 1, dash: [3, 4] });
    }
    const bw = 0.35 * (ps.X(f1) - ps.X(0));
    amps.forEach((a, i) => {
      const fh = (i + 1) * f1;
      const sel = Math.abs(fh - freq(p)) < 1e-6 * f1;
      d.rect(ps.X(fh) - bw / 2, ps.Y(0), bw, ps.Y(a / amax) - ps.Y(0), { fill: sel ? theme.series[1] : theme.accent, alpha: 0.85 });
    });
    d.text(`espectro: ${instrumentOf(p).amps.length ? instrumentOf(p).label : "série do tubo (1/h)"} · tracejado: ressonâncias do tubo`, 3.35, 3.3, { color: theme.text, size: 10, weight: "600" });

    // ---- Forma de onda sintetizada ----
    const T1 = 1 / f1;
    let wmax = 1e-9;
    for (let i = 0; i <= 200; i++) wmax = Math.max(wmax, Math.abs(waveform(p, (2 * T1 * i) / 200)));
    const pwv = panel(d, { x0: 6.8, y0: 0.55, x1: 11.4, y1: 3.0 }, { min: 0, max: 2 * T1 * 1000 }, { min: -1.1, max: 1.1 });
    pwv.frame({ xlabel: "t (ms)", ylabel: "pressão (soma dos harmônicos)", yticks: [-1, 0, 1], fx: (v) => formatBR(v, 2) });
    pwv.plot((tm) => waveform(p, tm / 1000) / wmax, 0, 2 * T1 * 1000, { color: theme.series[2], width: 1.8, n: 400 });
    const h = harmonicOf(tipo, n);
    pwv.plot((tm) => ((amps[h - 1] ?? 0) / amax) * Math.sin(2 * Math.PI * h * f1 * (tm / 1000) + 0.4 * (h - 1) ** 2), 0, 2 * T1 * 1000, { color: theme.series[1], width: 1, alpha: 0.8, n: 400 });
    d.text(`timbre (verde) e componente n = ${n} (laranja) · f₁ = ${formatBR(f1, 4)} Hz`, 9.1, 3.3, { color: theme.text, size: 10, weight: "600" });
  },
});

export default tubosSonoros;
