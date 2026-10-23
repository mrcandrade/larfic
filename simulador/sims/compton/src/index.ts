import { clamp, defineSim, deg, draw, num, rad, texNum, type Draw, type Params, type Theme } from "@fisilab/core";
import { fmt, panel } from "./panel.ts";
import {
  BIN,
  LAMBDA_C,
  ME_C2,
  NB,
  TARGETS,
  binLambda,
  comptonShift,
  findShiftedPeak,
  fitShift,
  kinematics,
  poisson,
  scatteredLambda,
  spectrumModel,
  type Point,
} from "./physics.ts";

export * from "./physics.ts";

export interface ComptonState {
  /** Ângulo atual do detector (graus); o arrasto no palco e o controle o alteram. */
  theta: number;
  /** Último valor do controle θ visto (para detectar mudança no controle). */
  thParam: number;
  /** Histograma acumulado e as condições em que foi acumulado. */
  counts: number[];
  acc: { theta: number; l0: number; tgt: number };
  /** Tempo de contagem (s). */
  elapsed: number;
  seed: number;
  /** Medidas registradas (com o ângulo em graus). */
  pts: (Point & { theta: number })[];
  drag: boolean;
  msg: string;
}

const l0 = (p: Params) => num(p, "lambda0", 71.1);
const tgt = (p: Params) => Math.round(num(p, "alvo", 0));
const thRad = (s: ComptonState) => rad(s.theta);

// geometria do aparelho
const TGT = { x: 5.2, y: 8.6 };
const ARM = 3.4;
const SRC = { x: 0.9, y: 8.6 };

const emptyCounts = () => new Array<number>(NB).fill(0);

/** Acumula `seconds` de contagem no histograma (Poisson por bin). */
export function accumulate(s: ComptonState, p: Params, seconds: number): ComptonState {
  const counts = s.counts.slice();
  let seed = s.seed;
  const th = thRad(s);
  for (let i = 0; i < NB; i++) {
    const mean = spectrumModel(binLambda(l0(p), i), l0(p), th, tgt(p)) * BIN * seconds;
    let k: number;
    [k, seed] = poisson(mean, seed);
    counts[i]! += k;
  }
  return { ...s, counts, seed, elapsed: s.elapsed + seconds };
}

function resetIfChanged(s: ComptonState, p: Params): ComptonState {
  const a = s.acc;
  if (a.theta === s.theta && a.l0 === l0(p) && a.tgt === tgt(p)) return s;
  return { ...s, counts: emptyCounts(), elapsed: 0, acc: { theta: s.theta, l0: l0(p), tgt: tgt(p) } };
}

function register(s: ComptonState, p: Params): ComptonState {
  if (s.elapsed < 1.5) return { ...s, msg: "Conte por mais tempo antes de registrar (pelo menos 1,5 s de contagem)." };
  if (s.theta < 5) return { ...s, msg: "Perto de θ = 0 os picos se sobrepõem: escolha um ângulo maior." };
  const peak = findShiftedPeak(s.counts, l0(p), thRad(s));
  if (!Number.isFinite(peak)) return { ...s, msg: "Não foi possível localizar o pico deslocado." };
  const dl = peak - l0(p);
  const pt = { u: 1 - Math.cos(thRad(s)), dl, theta: s.theta };
  return { ...s, pts: [...s.pts, pt], msg: `Registrado: θ = ${fmt(s.theta, 3)}°, λ' = ${fmt(peak, 5)} pm, Δλ = ${fmt(dl, 3)} pm.` };
}

const hitDetector = (s: ComptonState, x: number, y: number) =>
  Math.hypot(x - (TGT.x + ARM * Math.cos(thRad(s))), y - (TGT.y + ARM * Math.sin(thRad(s)))) < 0.6;

export const compton = defineSim<ComptonState>({
  id: "compton",
  title: "Efeito Compton",
  course: "FG IV",
  topic: "Quântica (origens)",
  priority: "P2",
  summary:
    "Raios X espalhados por elétrons saem com comprimento de onda maior: Δλ = (h/mc)(1 − cos θ). Gire o detector, conte o espectro com os picos deslocado e não deslocado, veja a colisão fóton–elétron com o triângulo de momentos e ajuste a reta para medir h/mc.",
  equations: [
    String.raw`\lambda' - \lambda = \frac{h}{m_e c}\,(1 - \cos\theta),\qquad \frac{h}{m_e c} = 2{,}426\ \text{pm}`,
    String.raw`\frac{hc}{\lambda} + m_ec^2 = \frac{hc}{\lambda'} + E_e \qquad\text{(energia)}`,
    String.raw`\vec p_\gamma = \vec p_\gamma\,' + \vec p_e,\qquad p_\gamma = \frac{h}{\lambda}\qquad\text{(momento)}`,
    String.raw`K_e = \frac{hc}{\lambda} - \frac{hc}{\lambda'},\qquad \tan\varphi = \frac{\sin\theta}{\lambda'/\lambda - \cos\theta}`,
    String.raw`\frac{d\sigma}{d\Omega} = \frac{r_e^2}{2}\left(\frac{\lambda}{\lambda'}\right)^2\left[\frac{\lambda}{\lambda'} + \frac{\lambda'}{\lambda} - \sin^2\theta\right]\quad\text{(Klein–Nishina)}`,
  ],
  liveEquations(s, p) {
    const th = thRad(s);
    const k = kinematics(l0(p), th);
    const out = [
      String.raw`\Delta\lambda = ${texNum(LAMBDA_C, 4)}\,(1 - \cos ${texNum(s.theta, 3)}^\circ) = ${texNum(comptonShift(th), 4)}\ \text{pm} \Rightarrow \lambda' = ${texNum(scatteredLambda(l0(p), th), 5)}\ \text{pm}`,
      String.raw`E_\gamma = ${texNum(k.E0, 4)}\ \text{keV} = E_\gamma' + K_e = ${texNum(k.E1, 4)} + ${texNum(k.K, 4)}\ \text{keV}`,
      String.raw`p_e = ${texNum(k.pe, 4)}\ \text{keV}/c,\quad \varphi = ${texNum(-deg(k.phi), 3)}^\circ`,
    ];
    const f = fitShift(s.pts);
    if (f) out.push(String.raw`\text{ajuste: } h/mc = ${texNum(f.slope, 4)}\ \text{pm} \Rightarrow h = ${texNum(f.h, 4)}\ \text{J·s}`);
    return out;
  },

  params: [
    { key: "theta", label: "Ângulo do detector θ", unit: "°", min: 0, max: 180, step: 1, default: 90, live: true },
    { key: "lambda0", label: "λ dos raios X incidentes", unit: "pm", min: 10, max: 150, step: 0.1, default: 71.1 },
    {
      key: "alvo",
      label: "Alvo",
      unit: "",
      min: 0,
      max: TARGETS.length - 1,
      step: 1,
      default: 0,
      options: TARGETS.map((t, i) => ({ value: i, label: t.name })),
    },
  ],

  observables: [
    { key: "theta", label: "Ângulo θ", unit: "°", value: (s) => s.theta },
    { key: "u", label: "1 − cos θ", unit: "", value: (s) => 1 - Math.cos(thRad(s)) },
    { key: "dl", label: "Δλ previsto", unit: "pm", value: (s) => comptonShift(thRad(s)) },
    { key: "lam1", label: "λ' espalhado", unit: "pm", value: (s, p) => scatteredLambda(l0(p), thRad(s)) },
    { key: "E1", label: "Energia do fóton espalhado", unit: "keV", value: (s, p) => kinematics(l0(p), thRad(s)).E1 },
    { key: "K", label: "Energia cinética do elétron", unit: "keV", value: (s, p) => kinematics(l0(p), thRad(s)).K },
    { key: "phi", label: "Ângulo de recuo do elétron φ", unit: "°", value: (s, p) => -deg(kinematics(l0(p), thRad(s)).phi) },
    { key: "pe", label: "Momento do elétron", unit: "keV/c", value: (s, p) => kinematics(l0(p), thRad(s)).pe },
    { key: "N", label: "Contagens acumuladas", unit: "", value: (s) => s.counts.reduce((a, b) => a + b, 0) },
    { key: "fit", label: "h/mc do ajuste", unit: "pm", value: (s) => fitShift(s.pts)?.slope ?? 0 },
  ],
  chart: { x: "u", y: "dl" },

  scenarios: [
    {
      id: "espectro",
      label: "Dois picos no detector",
      params: { theta: 90, lambda0: 71.1, alvo: 0 },
      guide: `### O que o detector mede
1. Raios X de molibdênio ($K_\\alpha$, 71,1 pm) atingem um bloco de grafite. O detector, a 90°, mede o espectro por um cristal analisador.
2. Rode e deixe as contagens acumularem. Aparecem **dois** picos: um em $\\lambda_0$ e outro deslocado em $\\Delta\\lambda \\approx 2{,}43$ pm.
3. O pico deslocado vem de elétrons quase livres. O não deslocado vem de fótons espalhados pelo átomo inteiro: a "massa" na fórmula é milhares de vezes maior e o desvio some.
4. Troque o alvo para cobre: o pico não deslocado cresce (mais elétrons fortemente ligados).`,
      predict: [
        {
          question: "Se você girar o detector de 90° para 180°, o pico deslocado:",
          options: ["volta para λ₀", "se afasta para Δλ ≈ 4,85 pm", "fica no mesmo lugar", "depende do alvo"],
          answer: 1,
          explanation: "$\\Delta\\lambda = (h/mc)(1-\\cos\\theta)$: em 180°, $1 - \\cos\\theta = 2$ e $\\Delta\\lambda = 2 \\times 2{,}426 = 4{,}85$ pm, para qualquer alvo e qualquer $\\lambda_0$.",
        },
      ],
    },
    {
      id: "colisao",
      label: "Colisão fóton–elétron",
      params: { theta: 60, lambda0: 20, alvo: 0 },
      guide: `### Conservação de energia e de momento
1. Com $\\lambda_0 = 20$ pm (62 keV) o efeito é grande. Arraste o detector pelo palco e observe o elétron de recuo.
2. O triângulo à direita fecha: $\\vec p_0 = \\vec p\\,' + \\vec p_e$. O elétron sai sempre para a frente ($\\varphi < 90°$).
3. A barra de energias mostra $E_0 = E' + K_e$. Em que ângulo o elétron leva mais energia?
4. Note que $\\Delta\\lambda$ não depende de $\\lambda_0$, mas a fração de energia perdida, $\\Delta\\lambda/\\lambda'$, sim: por isso o efeito é invisível com luz visível.`,
      predict: [
        {
          question: "Em que ângulo de espalhamento o elétron recebe a maior energia cinética?",
          options: ["θ = 0°", "θ = 90°", "θ = 180° (retroespalhamento)", "é sempre a mesma"],
          answer: 2,
          explanation: "$K_e = hc/\\lambda - hc/\\lambda'$ cresce com $\\Delta\\lambda$, que é máximo em 180°. Nesse caso o elétron sai exatamente para a frente ($\\varphi = 0$).",
        },
      ],
    },
    {
      id: "ajuste",
      label: "Medir h/mc",
      params: { theta: 30, lambda0: 71.1, alvo: 1 },
      guide: `### Reta de Compton
1. Para cada ângulo, espere o espectro acumular e clique **Registrar pico**. O programa acha o centróide do pico deslocado.
2. Repita em uns cinco ângulos entre 30° e 180° (arraste o detector ou use o controle). **Varredura automática** faz isso por você.
3. O gráfico de $\\Delta\\lambda$ contra $1 - \\cos\\theta$ é uma reta pela origem com inclinação $h/m_ec$.
4. Com $m_e$ e $c$ conhecidos, calcule $h$ e compare com $6{,}626 \\times 10^{-34}$ J·s.`,
    },
  ],

  exercises: [
    {
      id: "desvio",
      prompt: "Raios X são espalhados por elétrons livres a {theta}°. Qual é o aumento do comprimento de onda?",
      vary: { theta: [20, 180, 0] },
      answer: { label: "Δλ", unit: "pm", compute: (p) => comptonShift(rad(num(p, "theta"))) },
      hint: "h/mc = 2,426 pm.",
    },
    {
      id: "recuo",
      prompt: "Um fóton de {lambda0} pm é espalhado a {theta}° por um elétron em repouso. Qual é a energia cinética do elétron de recuo?",
      vary: { lambda0: [5, 100, 1], theta: [30, 180, 0] },
      answer: { label: "K", unit: "keV", compute: (p) => kinematics(num(p, "lambda0"), rad(num(p, "theta"))).K },
      hint: "K = hc/λ − hc/λ', com hc = 1239,8 keV·pm.",
    },
  ],

  init(p) {
    const th = num(p, "theta", 90);
    return {
      theta: th,
      thParam: th,
      counts: emptyCounts(),
      acc: { theta: th, l0: l0(p), tgt: tgt(p) },
      elapsed: 0,
      seed: 12345,
      pts: [],
      drag: false,
      msg: "",
    };
  },
  step(s, p, _t, dt) {
    let st = s;
    const th = num(p, "theta", 90);
    if (th !== s.thParam) st = { ...st, theta: th, thParam: th };
    st = resetIfChanged(st, p);
    return accumulate(st, p, dt);
  },
  dt: 0.05,
  sampleEvery: 2,
  maxSamples: 4000,

  pointer: {
    down: (s, _p, pt) => (hitDetector(s, pt.x, pt.y) ? { ...s, drag: true } : undefined),
    move(s, _p, pt, dragging) {
      if (!dragging || !s.drag) return undefined;
      const a = Math.round(clamp(Math.abs(deg(Math.atan2(pt.y - TGT.y, pt.x - TGT.x))), 0, 180));
      return a === s.theta ? undefined : { ...s, theta: a };
    },
    up: (s) => (s.drag ? { ...s, drag: false } : undefined),
    cursor: (s, _p, pt) => (hitDetector(s, pt.x, pt.y) ? "grab" : undefined),
  },
  actions: [
    { id: "registrar", label: "Registrar pico (θ, Δλ)", run: register },
    {
      id: "varredura",
      label: "Varredura automática (30° a 180°)",
      run(s, p) {
        let st = s;
        for (const a of [30, 60, 90, 120, 150, 180]) {
          st = resetIfChanged({ ...st, theta: a }, p);
          st = accumulate(st, p, 8);
          st = register(st, p);
        }
        return { ...st, msg: `Varredura: ${6} ângulos registrados.` };
      },
    },
    { id: "zerar", label: "Zerar contagem", run: (s) => ({ ...s, counts: emptyCounts(), elapsed: 0, msg: "" }) },
    { id: "limpar", label: "Limpar medidas", run: (s) => ({ ...s, pts: [], msg: "Medidas apagadas." }) },
  ],

  narrowSplit: () => 0.504,
  viewport: () => ({ xMin: 0, xMax: 20, yMin: 0, yMax: 12 }),

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const { state: s, params: p, theme, t } = frame;
    renderApparatus(d, theme, s, p, t);
    renderTriangle(d, theme, s, p);
    renderSpectrum(d, theme, s, p);
    renderFit(d, theme, s);
  },
});

/** Pacote de onda desenhado ao longo de um segmento (comprimento de onda visual). */
function wave(d: Draw, x0: number, y0: number, ux: number, uy: number, len: number, lamVis: number, col: string) {
  const pts: [number, number][] = [];
  const n = 60;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * len;
    const env = Math.sin((Math.PI * i) / n);
    const w = 0.16 * env * Math.sin((2 * Math.PI * a) / lamVis);
    pts.push([x0 + ux * a - uy * w, y0 + uy * a + ux * w]);
  }
  d.polyline(pts, { color: col, width: 2 });
}

function renderApparatus(d: Draw, theme: Theme, s: ComptonState, p: Params, t: number) {
  const th = thRad(s);
  const k = kinematics(l0(p), th);
  const inc = theme.series[4]!;
  const sca = theme.series[1]!;
  const ele = theme.negative;
  // fonte, colimador, alvo
  d.rect(SRC.x - 0.6, SRC.y - 0.45, 0.9, 0.9, { fill: theme.grid, stroke: theme.text, width: 1.2 });
  d.text("tubo de", SRC.x - 0.15, SRC.y + 0.75, { size: 9, color: theme.muted });
  d.text("raios X", SRC.x - 0.15, SRC.y - 0.75, { size: 9, color: theme.muted });
  d.rect(2.3, SRC.y + 0.12, 0.25, 0.5, { fill: theme.muted });
  d.rect(2.3, SRC.y - 0.62, 0.25, 0.5, { fill: theme.muted });
  d.rect(TGT.x - 0.3, TGT.y - 0.6, 0.6, 1.2, { fill: theme.ground, stroke: theme.text, width: 1 });
  d.text(TARGETS[tgt(p)]!.name, TGT.x, TGT.y - 0.95, { size: 10, color: theme.muted });
  // trilho do detector
  d.ctx.beginPath();
  d.ctx.arc(TGT.x, TGT.y, ARM, 0, Math.PI);
  d.ctx.strokeStyle = theme.grid;
  d.ctx.lineWidth = 6 * d.px;
  d.ctx.stroke();
  for (let a = 0; a <= 180; a += 30) {
    const c = Math.cos(rad(a));
    const sn = Math.sin(rad(a));
    d.text(`${a}°`, TGT.x + (ARM + 0.55) * c, TGT.y + (ARM + 0.55) * sn, { size: 9, color: theme.muted });
  }
  // detector
  const dx = TGT.x + ARM * Math.cos(th);
  const dy = TGT.y + ARM * Math.sin(th);
  d.line(TGT.x, TGT.y, dx, dy, { color: theme.muted, width: 1, dash: [4, 4] });
  d.box(dx, dy, 0.9, 0.55, th, { fill: sca, stroke: theme.text, width: 1.2, alpha: 0.85 });
  d.text("detector (arraste)", dx, dy + 0.65, { size: 10, weight: "600" });

  // animação da colisão: 0–1,2 s fóton chega; 1,2–3 s saem fóton e elétron
  const T = 3;
  const ph = t % T;
  const exag = 1 + (8 * (scatteredLambda(l0(p), th) - l0(p))) / l0(p);
  const lamVis = 0.3;
  if (ph < 1.2) {
    const f = ph / 1.2;
    const L = 1.4;
    const x = SRC.x + 0.3 + f * (TGT.x - SRC.x - 0.3 - L);
    wave(d, x, TGT.y, 1, 0, L, lamVis, inc);
    d.dot(TGT.x, TGT.y, 5, ele);
  } else {
    const f = (ph - 1.2) / 1.8;
    const L = 1.4 * exag;
    const r = f * (ARM - 0.5 - Math.min(L, 2));
    wave(d, TGT.x + r * Math.cos(th), TGT.y + r * Math.sin(th), Math.cos(th), Math.sin(th), Math.min(L, 2), lamVis * exag, sca);
    const re = f * 2.6 * Math.min(1, k.pe / k.E0 + 0.3);
    const ex = TGT.x + re * Math.cos(k.phi);
    const ey = TGT.y + re * Math.sin(k.phi);
    d.dot(ex, ey, 6, ele);
    d.arrowPx(ex, ey, Math.cos(k.phi), Math.sin(k.phi), 30, { color: ele });
  }
  // direções e ângulos
  d.line(TGT.x, TGT.y, TGT.x + 2.2 * Math.cos(k.phi), TGT.y + 2.2 * Math.sin(k.phi), { color: ele, width: 1, dash: [3, 3] });
  d.text(`φ = ${fmt(-deg(k.phi), 3)}°`, TGT.x + 2.4 * Math.cos(k.phi), TGT.y + 2.4 * Math.sin(k.phi) - 0.25, { color: ele, size: 10, align: "left" });
  d.text("elétron de recuo", TGT.x + 1.2, 5.9, { color: ele, size: 10, align: "left" });
  d.text(`θ = ${fmt(s.theta, 3)}°`, TGT.x + 0.9, TGT.y + 0.35, { color: sca, size: 11, weight: "600", align: "left" });
  d.text("comprimentos de onda exagerados no desenho", 0.4, 11.75, { color: theme.muted, size: 9, align: "left" });
}

function renderTriangle(d: Draw, theme: Theme, s: ComptonState, p: Params) {
  const th = thRad(s);
  const k = kinematics(l0(p), th);
  const inc = theme.series[4]!;
  const sca = theme.series[1]!;
  const ele = theme.negative;
  const O = { x: 15.2, y: 7.0 };
  const sc = 4.2 / k.E0;
  const p0 = { x: O.x + k.E0 * sc, y: O.y };
  const p1 = { x: O.x + k.E1 * sc * Math.cos(th), y: O.y + k.E1 * sc * Math.sin(th) };
  d.text("Conservação do momento: p₀ = p' + pₑ", 10.6, 11.75, { size: 12, weight: "600", align: "left" });
  d.arrow(O.x, O.y, p0.x - O.x, 0, { color: inc, width: 3 });
  d.arrow(O.x, O.y, p1.x - O.x, p1.y - O.y, { color: sca, width: 3 });
  d.arrow(p1.x, p1.y, p0.x - p1.x, p0.y - p1.y, { color: ele, width: 3 });
  d.text(`p₀ = ${fmt(k.E0, 4)} keV/c`, (O.x + p0.x) / 2, O.y, { color: inc, size: 10, dy: 12 });
  d.text(`p' = ${fmt(k.E1, 4)}`, (O.x + p1.x) / 2, (O.y + p1.y) / 2, { color: sca, size: 10, align: "right", dx: -6, dy: -6 });
  d.text(`pₑ = ${fmt(k.pe, 4)}`, (p1.x + p0.x) / 2, (p1.y + p0.y) / 2, { color: ele, size: 10, align: "left", dx: 8 });
  // energia
  const y = 5.95;
  const W = 8.6;
  const x0 = 10.8;
  d.text("Energia: E₀ = E' + Kₑ", x0, y + 0.4, { size: 11, weight: "600", align: "left" });
  d.rect(x0, y - 0.35, W * (k.E1 / k.E0), 0.3, { fill: sca, alpha: 0.75 });
  d.rect(x0 + W * (k.E1 / k.E0), y - 0.35, Math.max(W * (k.K / k.E0), 0.02), 0.3, { fill: ele, alpha: 0.85 });
  d.text(`E' = ${fmt(k.E1, 4)} keV`, x0, y - 0.6, { size: 10, align: "left", color: sca });
  d.text(`Kₑ = ${fmt(k.K, 3)} keV (${fmt((100 * k.K) / k.E0, 3)} %)`, x0 + W, y - 0.6, { size: 10, align: "right", color: ele });
  d.text(`E₀ = ${fmt(k.E0, 4)} keV · mₑc² = ${fmt(ME_C2, 4)} keV`, x0 + W, y + 0.4, { size: 10, align: "right", color: theme.muted });
}

function renderSpectrum(d: Draw, theme: Theme, s: ComptonState, p: Params) {
  const L0 = l0(p);
  const th = thRad(s);
  const xr = { min: L0 - 2, max: L0 - 2 + NB * BIN };
  const cmax = Math.max(10, ...s.counts) * 1.15;
  const P = panel(d, { x0: 1.4, y0: 0.9, x1: 9.6, y1: 4.5 }, xr, { min: 0, max: cmax });
  P.frame({ xlabel: "λ (pm)", ylabel: `contagens (${fmt(s.elapsed, 3)} s)` });
  const col = theme.accent;
  P.clip(() => {
    for (let i = 0; i < NB; i++) {
      const lam = binLambda(L0, i);
      const x0 = P.X(lam - BIN / 2);
      const x1 = P.X(lam + BIN / 2);
      d.rect(x0, P.Y(0), x1 - x0, P.Y(s.counts[i]!) - P.Y(0), { fill: col, alpha: 0.55 });
    }
  });
  if (s.elapsed > 0) P.plot((x) => spectrumModel(x, L0, th, tgt(p)) * BIN * s.elapsed, xr.min, xr.max, { color: theme.text, width: 1.2, n: 300 });
  const mark = (x: number, lab: string, c: string) => {
    if (x < xr.min || x > xr.max) return;
    d.line(P.X(x), P.box.y0, P.X(x), P.box.y1, { color: c, width: 1, dash: [4, 3] });
    d.text(lab, P.X(x), P.box.y1, { color: c, size: 10, dy: -8 });
  };
  mark(L0, "λ₀", theme.series[4]!);
  mark(scatteredLambda(L0, th), "λ'", theme.series[1]!);
}

function renderFit(d: Draw, theme: Theme, s: ComptonState) {
  const P = panel(d, { x0: 11.6, y0: 0.9, x1: 19.6, y1: 4.5 }, { min: 0, max: 2 }, { min: 0, max: 6 });
  P.frame({ xlabel: "1 − cos θ", ylabel: "Δλ (pm)" });
  P.plot((u) => LAMBDA_C * u, 0, 2, { color: theme.muted, width: 1, dash: [3, 3], n: 2 });
  const f = fitShift(s.pts);
  if (f) P.plot((u) => f.slope * u + f.intercept, 0, 2, { color: theme.accent, width: 2, n: 2 });
  for (const q of s.pts) if (P.inside(q.u, q.dl)) d.dot(P.X(q.u), P.Y(q.dl), 4, theme.series[1]!);
  d.dot(P.X(1 - Math.cos(thRad(s))), P.Y(comptonShift(thRad(s))), 3, theme.muted);
  const tx = P.box.x0 + 0.15;
  if (f) {
    d.text(`h/mc = (${fmt(f.slope, 4)} ± ${fmt(f.sSlope, 2)}) pm, n = ${f.n}`, tx, P.box.y1 - 0.3, { color: theme.accent, size: 10, align: "left" });
    d.text(`h = ${fmt(f.h / 1e-34, 4)} × 10⁻³⁴ J·s (aceito 6,626)`, tx, P.box.y1 - 0.7, { color: theme.accent, size: 10, align: "left" });
  } else d.text("Registre picos em 2 ou mais ângulos.", tx, P.box.y1 - 0.3, { color: theme.muted, size: 10, align: "left" });
  d.text("teoria: 2,426 pm", P.box.x1 - 0.1, P.Y(LAMBDA_C * 1.85) + 0.3, { color: theme.muted, size: 9, align: "right" });
  if (s.msg) d.text(s.msg, 0.3, 5.15, { size: 10, align: "left", color: s.msg.startsWith("Registrado") || s.msg.startsWith("Varredura") ? theme.accent : theme.positive });
}

export default compton;
