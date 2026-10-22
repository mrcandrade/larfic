import { defineSim, draw, num, texNum, type Params } from "@fisilab/core";

/** Ponto de partida da fonte e limite do palco (m). */
export const X0 = -350;
const XMAX = 420;
const R_MAX = 1300;

export interface Front {
  /** Ponto e instante de emissão. */
  x: number;
  y: number;
  t: number;
  /** Velocidade da fonte e frequência emitida no instante da emissão. */
  vs: number;
  f0: number;
  heard: boolean;
}

export interface Dop {
  tau: number;
  xs: number;
  ys: number;
  xo: number;
  yo: number;
  /** Fase de emissão (número de frentes emitidas, fracionário). */
  phase: number;
  fronts: Front[];
  /** Instantes de chegada das últimas frentes ao ouvinte. */
  arrivals: number[];
  /** Frequência prevista pela fórmula para a última frente recebida. */
  fTeo: number;
  inCone: boolean;
  boomT: number;
  /** 0: nada; 1: arrastando a fonte; 2: arrastando o ouvinte. */
  drag: number;
}

export const vsOf = (p: Params) => num(p, "M", 0.6) * num(p, "c", 343);

/** Frequência percebida: f' = f (c − v_o·n̂)/(c − v_s·n̂), n̂ da fonte (na emissão) para o ouvinte. */
export function dopplerFreq(f0: number, c: number, vs: number, vo: number, nx: number): number {
  return (f0 * (c - vo * nx)) / (c - vs * nx);
}

/** Semiângulo do cone de Mach (rad), sen θ = 1/M. */
export const machAngle = (M: number) => (M > 1 ? Math.asin(1 / M) : NaN);

function coneContains(s: Pick<Dop, "xs" | "ys" | "xo" | "yo">, M: number): boolean {
  if (M <= 1) return false;
  const back = s.xs - s.xo;
  if (back <= 0) return false;
  return Math.abs(s.yo - s.ys) <= back * Math.tan(machAngle(M));
}

export function measuredFreq(s: Dop): number {
  const a = s.arrivals;
  if (a.length < 2) return 0;
  const k = Math.min(3, a.length - 1);
  const dt = (a[a.length - 1]! - a[a.length - 1 - k]!) / k;
  return dt > 0 ? 1 / dt : 0;
}

function stepDop(s: Dop, p: Params, dt: number): Dop {
  const c = num(p, "c", 343);
  const f0 = num(p, "f0", 4);
  const vs = vsOf(p);
  const vo = num(p, "vo");
  const M = num(p, "M", 0.6);
  const t0 = s.tau;
  const t1 = t0 + dt;
  const fronts = s.fronts.filter((f) => c * (t0 - f.t) < R_MAX).map((f) => ({ ...f }));

  // Emissões dentro do passo, na posição exata da fonte no instante de emissão.
  const ph1 = s.phase + f0 * dt;
  for (let m = Math.floor(s.phase) + 1; m <= ph1; m++) {
    const frac = (m - s.phase) / (f0 * dt);
    fronts.push({ x: s.xs + vs * frac * dt, y: s.ys, t: t0 + frac * dt, vs, f0, heard: false });
  }
  const xs = s.xs + vs * dt;
  const xo = s.xo + vo * dt;

  // Chegada das frentes ao ouvinte: g(t) = c(t − tₑ) − |P_o(t) − P_e| cruza zero.
  const arrivals = s.arrivals.slice();
  let fTeo = s.fTeo;
  const hits: { t: number; f: number }[] = [];
  for (const f of fronts) {
    if (f.heard) continue;
    const g1 = c * (t1 - f.t) - Math.hypot(xo - f.x, s.yo - f.y);
    if (g1 < 0) continue;
    const ta = Math.max(t0, f.t);
    const xoa = s.xo + vo * (ta - t0);
    const g0 = c * (ta - f.t) - Math.hypot(xoa - f.x, s.yo - f.y);
    const tHit = g0 >= 0 ? ta : ta + ((t1 - ta) * -g0) / (g1 - g0);
    f.heard = true;
    const xh = s.xo + vo * (tHit - t0);
    const r = Math.hypot(xh - f.x, s.yo - f.y);
    const nx = r > 1e-9 ? (xh - f.x) / r : 0;
    hits.push({ t: tHit, f: dopplerFreq(f.f0, c, f.vs, vo, nx) });
  }
  hits.sort((a, b) => a.t - b.t);
  for (const h of hits) {
    arrivals.push(h.t);
    fTeo = h.f;
  }
  if (arrivals.length > 8) arrivals.splice(0, arrivals.length - 8);

  const next = { ...s, tau: t1, xs, xo, phase: ph1, fronts, arrivals, fTeo };
  const inCone = coneContains(next, M);
  let boomT = s.boomT;
  if (inCone && !s.inCone) {
    // Instante exato em que a borda do cone passa pelo ouvinte (interpolação linear).
    const edge = (q: Pick<Dop, "xs" | "xo" | "yo" | "ys">) => q.xs - q.xo - Math.abs(q.yo - q.ys) / Math.tan(machAngle(M));
    const e0 = edge(s);
    const e1 = edge(next);
    boomT = e1 !== e0 ? t0 + (dt * -e0) / (e1 - e0) : t1;
  }
  return { ...next, inCone, boomT };
}

const fmt = (v: number, d = 1) => v.toFixed(d).replace(".", ",");

export const doppler = defineSim<Dop>({
  id: "doppler",
  title: "Efeito Doppler e cone de Mach",
  course: "FG II",
  topic: "Som",
  priority: "P1",
  summary:
    "Uma fonte sonora e um ouvinte em movimento. Veja as frentes de onda se acumularem à frente da fonte, compare a frequência percebida medida com a fórmula do efeito Doppler e passe da velocidade do som para ver o cone de Mach e o estrondo sônico.",
  equations: [
    String.raw`f' = f\,\frac{c - \vec v_o\cdot\hat n}{c - \vec v_s\cdot\hat n} \qquad \hat n:\ \text{da fonte (na emissão) para o ouvinte}`,
    String.raw`\text{colinear: } f' = f\,\frac{c \pm v_o}{c \mp v_s} \;\text{(sinal de cima: aproximação)}`,
    String.raw`M = \frac{v_s}{c} \qquad M > 1:\ \operatorname{sen}\theta = \frac{1}{M}`,
  ],
  liveEquations(s, p) {
    const M = num(p, "M", 0.6);
    const fm = measuredFreq(s);
    const eqs = [
      String.raw`v_s = ${texNum(vsOf(p))}\ \text{m/s} \quad (M = ${texNum(M)}) \qquad v_o = ${texNum(num(p, "vo"))}\ \text{m/s}`,
      String.raw`f'_{\text{fórmula}} = ${s.arrivals.length ? texNum(s.fTeo) : String.raw`\text{—}`}\ \text{Hz} \qquad f'_{\text{medida}} = ${fm ? texNum(fm) : String.raw`\text{—}`}\ \text{Hz} \qquad f = ${texNum(num(p, "f0", 4))}\ \text{Hz}`,
    ];
    if (M > 1) {
      eqs.push(
        String.raw`\theta = \operatorname{arcsen}\frac{1}{${texNum(M)}} = ${texNum((machAngle(M) * 180) / Math.PI)}^\circ \qquad ${s.boomT >= 0 ? String.raw`\text{estrondo em } t = ${texNum(s.boomT)}\ \text{s}` : String.raw`\text{o cone ainda não alcançou o ouvinte}`}`,
      );
    }
    return eqs;
  },

  params: [
    { key: "M", label: "Velocidade da fonte (número de Mach v_s/c)", unit: "", min: 0, max: 2.5, step: 0.01, default: 0.6, live: true },
    { key: "f0", label: "Frequência da fonte (reduzida para ver as frentes)", unit: "Hz", min: 1, max: 12, step: 0.5, default: 4, live: true },
    { key: "c", label: "Velocidade do som", unit: "m/s", min: 100, max: 400, step: 1, default: 343 },
    { key: "vo", label: "Velocidade do ouvinte (+ para a direita)", unit: "m/s", min: -200, max: 200, step: 1, default: 0, live: true },
    { key: "xo", label: "Posição inicial do ouvinte (x)", unit: "m", min: -380, max: 380, step: 5, default: 200 },
    { key: "yo", label: "Distância do ouvinte à trajetória (y)", unit: "m", min: 0, max: 220, step: 5, default: 30 },
  ],

  observables: [
    { key: "fTeo", label: "Frequência percebida (fórmula)", unit: "Hz", value: (s) => (s.arrivals.length ? s.fTeo : 0) },
    { key: "fMed", label: "Frequência percebida (medida)", unit: "Hz", value: (s) => measuredFreq(s) },
    { key: "razao", label: "Razão f'/f (medida)", unit: "", value: (s, p) => measuredFreq(s) / num(p, "f0", 4) },
    { key: "dist", label: "Distância fonte–ouvinte", unit: "m", value: (s) => Math.hypot(s.xs - s.xo, s.ys - s.yo) },
    { key: "xs", label: "Posição da fonte", unit: "m", value: (s) => s.xs },
  ],
  chart: { x: "t", y: "fMed" },

  scenarios: [
    {
      id: "ambulancia",
      label: "Fonte passando pelo ouvinte",
      params: { M: 0.5, f0: 4, vo: 0, xo: 150, yo: 20 },
      guide: `### A sirene que passa
1. A fonte se move para a direita com metade da velocidade do som. Repare como as frentes ficam **juntas à frente** e **afastadas atrás**.
2. Acompanhe o gráfico de $f'$ medida. Antes da passagem, compare com $f/(1 - M)$; depois, com $f/(1 + M)$.
3. A queda de frequência não é instantânea: com o ouvinte fora da trajetória ($y \\ne 0$), $\\hat n$ gira e $f'$ cai de forma suave.
4. Arraste o ouvinte para cima (longe da trajetória) e veja a transição ficar mais lenta.`,
      predict: [
        {
          question: "Uma fonte de 4 Hz se aproxima do ouvinte com metade da velocidade do som (M = 0,5). Qual frequência ele percebe?",
          options: ["2 Hz", "6 Hz", "8 Hz"],
          answer: 2,
          explanation: "$f' = f/(1 - M) = 4/(1 - 0{,}5) = 8$ Hz. Ao se afastar, $f' = 4/1{,}5 \\approx 2{,}7$ Hz.",
        },
      ],
    },
    {
      id: "ouvinte",
      label: "Ouvinte em movimento",
      params: { M: 0, f0: 4, vo: -150, xo: 350, yo: 0 },
      guide: `### Agora quem se move é o ouvinte
1. A fonte está parada e as frentes são círculos concêntricos.
2. O ouvinte corre em direção à fonte a 150 m/s: encontra as frentes com mais frequência, $f' = f(c + v_o)/c$.
3. Compare com o caso da fonte se movendo à mesma velocidade: os resultados **não são iguais**. Por quê?`,
    },
    {
      id: "mach1",
      label: "Barreira do som (M = 1)",
      params: { M: 1, f0: 6, vo: 0, xo: 250, yo: 60 },
      guide: `### Na velocidade do som
1. Com $M = 1$ a fonte acompanha as próprias frentes: todas se acumulam numa parede de pressão na frente dela.
2. A fórmula $f/(1 - M)$ diverge: as frentes chegam todas juntas.
3. Essa parede é a "barreira do som" que os aviões precisavam atravessar.`,
    },
    {
      id: "supersonico",
      label: "Supersônico: cone de Mach",
      params: { M: 2, f0: 6, vo: 0, xo: 150, yo: 120 },
      guide: `### Cone de Mach e estrondo sônico
1. Com $M = 2$, a fonte deixa as frentes para trás. As frentes formam um **cone** de semiângulo $\\theta$ com $\\operatorname{sen}\\theta = 1/M$.
2. O ouvinte não escuta nada até a borda do cone passar por ele: aí chegam muitas frentes ao mesmo tempo, o **estrondo sônico**.
3. Calcule quando isso acontece: o cone passa quando a fonte está a $h\\sqrt{M^2 - 1}$ à frente do ouvinte ($h$ é a distância à trajetória). Confira com o tempo mostrado.
4. Depois do estrondo, o ouvinte recebe frentes de dois "ramos" ao mesmo tempo, em ordem invertida.`,
      predict: [
        {
          question: "Quando um avião supersônico passa sobre você, o estrondo é ouvido:",
          options: ["quando o avião está exatamente acima de você", "depois que o avião já passou", "antes de o avião chegar"],
          answer: 1,
          explanation: "O cone fica atrás da fonte. Ele só alcança você quando o avião já está a $h\\sqrt{M^2-1}$ à sua frente.",
        },
      ],
    },
  ],

  exercises: [
    {
      id: "sirene",
      prompt:
        "Uma ambulância com sirene de {fs} Hz se aproxima de um pedestre parado a {vs} m/s. Com o som a {c} m/s, que frequência o pedestre ouve?",
      vary: { fs: [500, 1200, 0], vs: [10, 40, 0], c: [330, 345, 0] },
      answer: { label: "f'", unit: "Hz", compute: (p) => dopplerFreq(num(p, "fs"), num(p, "c"), num(p, "vs"), 0, 1) },
      hint: "Fonte se aproximando: o denominador diminui, f' = f·c/(c − v_s).",
      tolerance: 0.005,
    },
    {
      id: "mach",
      prompt: "Um avião voa a Mach {M}. Qual o semiângulo do cone de Mach, em graus?",
      vary: { M: [1.2, 3, 2] },
      answer: { label: "θ", unit: "°", compute: (p) => (machAngle(num(p, "M")) * 180) / Math.PI },
      hint: "sen θ = 1/M.",
    },
  ],

  init: (p) => ({
    tau: 0,
    xs: X0,
    ys: 0,
    xo: num(p, "xo", 200),
    yo: num(p, "yo", 30),
    phase: 0,
    fronts: [{ x: X0, y: 0, t: 0, vs: vsOf(p), f0: num(p, "f0", 4), heard: false }],
    arrivals: [],
    fTeo: 0,
    inCone: false,
    boomT: -1,
    drag: 0,
  }),
  step: (s, p, _t, dt) => stepDop(s, p, dt),
  dt: 1e-3,
  sampleEvery: 20,
  maxSamples: 3000,
  tEnd: 30,
  stopWhen: (s) => XMAX - s.xs,

  pointer: {
    down(s, _p, pt) {
      const ds = Math.hypot(pt.x - s.xs, pt.y - s.ys);
      const dob = Math.hypot(pt.x - s.xo, pt.y - s.yo);
      if (Math.min(ds, dob) > 30) return undefined;
      return { ...s, drag: dob <= ds ? 2 : 1 };
    },
    move(s, _p, pt, dragging) {
      if (!dragging || !s.drag) return undefined;
      const x = Math.max(-390, Math.min(390, pt.x));
      const y = Math.max(-240, Math.min(240, pt.y));
      return s.drag === 2 ? { ...s, xo: x, yo: y, arrivals: [] } : { ...s, xs: x, ys: y, arrivals: [] };
    },
    up: (s) => (s.drag ? { ...s, drag: 0 } : undefined),
    cursor: (s, _p, pt) => (Math.min(Math.hypot(pt.x - s.xs, pt.y - s.ys), Math.hypot(pt.x - s.xo, pt.y - s.yo)) < 30 ? "grab" : undefined),
  },

  viewport: () => ({ xMin: -400, xMax: 400, yMin: -250, yMax: 250, unit: "m" }),

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const { state: s, params: p, theme } = frame;
    const c = num(p, "c", 343);
    const M = num(p, "M", 0.6);
    const vs = vsOf(p);
    const vo = num(p, "vo");

    ctx.save();
    ctx.beginPath();
    ctx.rect(-400, -250, 800, 500);
    ctx.clip();

    d.line(-400, s.ys, 400, s.ys, { color: theme.grid, width: 1, dash: [6, 6] });

    // Frentes de onda
    for (const f of s.fronts) {
      const r = c * (s.tau - f.t);
      if (r <= 0) continue;
      const alpha = Math.max(0.15, 1 - r / R_MAX);
      d.circle(f.x, f.y, r, { stroke: theme.accent, width: 1.3, alpha });
    }

    // Cone de Mach
    if (M > 1) {
      const th = machAngle(M);
      const Lc = 1200;
      const pts: [number, number][] = [
        [s.xs - Lc * Math.cos(th), s.ys + Lc * Math.sin(th)],
        [s.xs, s.ys],
        [s.xs - Lc * Math.cos(th), s.ys - Lc * Math.sin(th)],
      ];
      d.polyline(pts, { color: "none", fill: theme.positive, alpha: 0.1, close: true });
      d.polyline(pts, { color: theme.positive, width: 2.5 });
      d.text(`θ = ${fmt((th * 180) / Math.PI)}°`, s.xs - 60, s.ys + 60 * Math.tan(th) + 14, { color: theme.positive, size: 12, weight: "600", align: "right" });
    }
    ctx.restore();

    // Fonte
    d.circle(s.xs, s.ys, 8, { fill: theme.series[1], stroke: theme.text, width: 1.5, minPx: 7 });
    d.text("fonte", s.xs, s.ys, { color: theme.text, size: 11, dy: 18 });
    if (vs > 0) {
      d.arrowPx(s.xs, s.ys, 1, 0, Math.min(90, 20 + vs / 8), { color: theme.series[1] });
      d.text("v_s", s.xs, s.ys, { color: theme.series[1], size: 11, dx: Math.min(90, 20 + vs / 8) + 12, weight: "600" });
    }

    // Ouvinte
    const boom = s.boomT >= 0 && s.tau - s.boomT < 0.8;
    if (boom) d.circle(s.xo, s.yo, 25, { stroke: theme.positive, width: 3, minPx: 18 });
    d.circle(s.xo, s.yo, 7, { fill: theme.series[2], stroke: theme.text, width: 1.5, minPx: 7 });
    d.text("ouvinte", s.xo, s.yo, { color: theme.text, size: 11, dy: 18 });
    if (Math.abs(vo) > 0.5) d.arrowPx(s.xo, s.yo, Math.sign(vo), 0, Math.min(90, 20 + Math.abs(vo) / 4), { color: theme.series[2] });
    if (boom) d.text("BUM! estrondo sônico", s.xo, s.yo, { color: theme.positive, size: 15, weight: "700", dy: -26 });

    const fm = measuredFreq(s);
    const linhas = [
      `M = ${fmt(M, 2)}   ·   f = ${fmt(num(p, "f0", 4))} Hz`,
      `f' medida = ${fm ? fmt(fm, 2) + " Hz" : "—"}   ·   f' fórmula = ${s.arrivals.length ? fmt(s.fTeo, 2) + " Hz" : "—"}`,
    ];
    if (M > 1) linhas.push(s.boomT >= 0 ? `estrondo sônico em t = ${fmt(s.boomT, 2)} s` : "ouvinte ainda fora do cone: silêncio");
    else if (Math.abs(M - 1) < 1e-9) linhas.push("M = 1: frentes acumuladas na frente da fonte");
    linhas.forEach((l, i) => d.text(l, -390, 235 - i * 20, { color: theme.text, size: 12, align: "left" }));
    d.text("arraste a fonte ou o ouvinte", 390, -238, { color: theme.muted, size: 10, align: "right" });
  },
});

export default doppler;
