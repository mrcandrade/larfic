import { clamp, defineSim, deg, draw, formatBR, num, texNum, type Params } from "@fisilab/core";

/**
 * 0. Balança de torção (geometria do aparelho didático tipo PASCO): duas
 *    esferas pequenas m num braço de meia-largura d, fio de constante κ, duas
 *    esferas grandes M num braço giratório. O torque gravitacional é somado
 *    exatamente sobre os quatro pares (inclusive a atração da esfera grande
 *    "do outro lado", que gera o erro sistemático clássico), e o laser
 *    refletido no espelho marca S = L tg 2θ numa escala.
 * 1. Lei da gravitação: duas esferas arrastáveis numa régua.
 * 2. Campo gravitacional de um planeta: vista central × vista local (campo
 *    praticamente homogêneo perto da superfície).
 */
export const G0 = 6.674e-11;
export const SMALL = { m: 0.015, d: 0.05, r: 0.0067 };
const RHO_PB = 11340;

export interface CV {
  th: number;
  om: number;
  /** Tempo físico (s) — o relógio da balança é acelerado. */
  tf: number;
  psi: number;
  psiT: number;
  /** Extremos recentes do laser: posição (m) e instante (s). */
  ext: [number, number][];
  /** Centros de oscilação medidos nas posições I e II (m); 0 = ainda não medido. */
  cI: number;
  cII: number;
  hasI: boolean;
  hasII: boolean;
  /** Lei da gravitação: posições das esferas na régua (m). */
  x1: number;
  x2: number;
  /** Campo: sonda na vista central (10³ km) e na vista local (km). */
  cx: number;
  cy: number;
  lx: number;
  lh: number;
  drag: "" | "m1" | "m2" | "probe";
}

export const modo = (p: Params) => Math.round(num(p, "modo"));
const M = (p: Params) => num(p, "M", 1.5);
const B = (p: Params) => num(p, "b", 46.5) / 1000;
const KAPPA = (p: Params) => num(p, "kappa", 8) * 1e-9;
const LL = (p: Params) => num(p, "L", 5);
export const inertia = () => 2 * SMALL.m * SMALL.d ** 2;
export const period0 = (p: Params) => 2 * Math.PI * Math.sqrt(inertia() / KAPPA(p));
export const psiI = (p: Params) => Math.atan2(B(p), SMALL.d);
export const bigRadius = (Mk: number) => Math.cbrt((3 * Mk) / (4 * Math.PI * RHO_PB));

/** Torque gravitacional exato das duas esferas grandes sobre as duas pequenas. */
export function gravTorque(th: number, psi: number, p: Params): number {
  const d = SMALL.d;
  const rho = Math.hypot(d, B(p));
  const k = G0 * M(p) * SMALL.m;
  let tau = 0;
  for (const si of [1, -1]) {
    const sx = si * d * Math.cos(th);
    const sy = si * d * Math.sin(th);
    for (const bj of [1, -1]) {
      const bx = bj * rho * Math.cos(psi);
      const by = bj * rho * Math.sin(psi);
      const dx = bx - sx;
      const dy = by - sy;
      const r3 = Math.hypot(dx, dy) ** 3;
      tau += (k * (sx * dy - sy * dx)) / r3;
    }
  }
  return tau;
}
/** Ângulo de equilíbrio: κ θ = τ(θ). */
export function thetaEq(psi: number, p: Params): number {
  let th = 0;
  for (let i = 0; i < 50; i++) th = gravTorque(th, psi, p) / KAPPA(p);
  return th;
}
/** Fração β do torque perdida pela atração da esfera grande distante. */
export const betaCorr = (p: Params) => B(p) ** 3 / (B(p) ** 2 + 4 * SMALL.d ** 2) ** 1.5;
export const laserS = (th: number, p: Params) => LL(p) * Math.tan(2 * th);
/** Fórmula didática: G = π² ΔS d b² / (T² M L). */
export const gFromData = (dS: number, T: number, p: Params) => (Math.PI ** 2 * Math.abs(dS) * SMALL.d * B(p) ** 2) / (T * T * M(p) * LL(p));

function oscCenter(s: CV): number | undefined {
  const e = s.ext;
  if (e.length < 3) return undefined;
  const [a, b, c] = e.slice(-3);
  return (a![0] + 2 * b![0] + c![0]) / 4;
}
export function measuredPeriod(s: CV): number {
  const e = s.ext;
  if (e.length < 3) return 0;
  return e[e.length - 1]![1] - e[e.length - 3]![1];
}
export function gMeasured(s: CV, p: Params): number {
  const T = measuredPeriod(s);
  if (!s.hasI || !s.hasII || T <= 0) return 0;
  return gFromData(s.cI - s.cII, T, p);
}

function stepBalance(s: CV, p: Params, dt: number): CV {
  const H = num(p, "ritmo", 50) * dt;
  const n = Math.max(1, Math.ceil(H / 0.5));
  const h = H / n;
  const I = inertia();
  const c = (2 * I) / num(p, "tdec", 1500);
  let { th, om, psi, tf } = s;
  let ext = s.ext;
  let { cI, cII, hasI, hasII } = s;
  for (let k = 0; k < n; k++) {
    // braço das esferas grandes gira a 0,15 rad/s (tempo físico)
    if (psi !== s.psiT) {
      const dpsi = s.psiT - psi;
      psi = Math.abs(dpsi) < 0.15 * h ? s.psiT : psi + Math.sign(dpsi) * 0.15 * h;
      if (psi === s.psiT) ext = [];
    }
    const f = (a: number, w: number): [number, number] => [w, (gravTorque(a, psi, p) - KAPPA(p) * a - c * w) / I];
    const [a1, b1] = f(th, om);
    const [a2, b2] = f(th + (h / 2) * a1, om + (h / 2) * b1);
    const [a3, b3] = f(th + (h / 2) * a2, om + (h / 2) * b2);
    const [a4, b4] = f(th + h * a3, om + h * b3);
    const nth = th + (h / 6) * (a1 + 2 * a2 + 2 * a3 + a4);
    const nom = om + (h / 6) * (b1 + 2 * b2 + 2 * b3 + b4);
    if (om !== 0 && nom * om < 0 && psi === s.psiT) {
      // extremo: interpola o instante e registra a posição do laser
      const fr = om / (om - nom);
      ext = [...ext.slice(-5), [laserS(th + fr * (nth - th), p), tf + fr * h]];
      const ce = oscCenter({ ...s, ext });
      if (ce !== undefined) {
        if (s.psiT > 0.01 && s.psiT < Math.PI / 2 - 0.01) {
          cI = ce;
          hasI = true;
        } else if (s.psiT < -0.01) {
          cII = ce;
          hasII = true;
        }
      }
    }
    th = nth;
    om = nom;
    tf += h;
  }
  return { ...s, th, om, psi, tf, ext, cI, cII, hasI, hasII };
}

// ------------------------------------------------------------- campo (modo 2)
const PLANETS = [
  { label: "Terra", M: 5.972e24, R: 6.371e6 },
  { label: "Lua", M: 7.342e22, R: 1.737e6 },
  { label: "Marte", M: 6.417e23, R: 3.39e6 },
  { label: "Júpiter (fora de escala)", M: 1.898e27, R: 6.991e7 },
];
const planet = (p: Params) => PLANETS[clamp(Math.round(num(p, "planeta")), 0, 3)]!;
/** Campo de uma esfera homogênea a distância r do centro (m/s²). */
export function gField(r: number, Mp: number, Rp: number): number {
  return r >= Rp ? (G0 * Mp) / (r * r) : (G0 * Mp * r) / Rp ** 3;
}
const local = (p: Params) => Math.round(num(p, "vista")) === 1;
/** Distância da sonda ao centro (m). */
function probeR(s: CV, p: Params): number {
  const pl = planet(p);
  const k = pl.R / 6.371e6;
  if (local(p)) return Math.hypot(s.lx * 1e3, pl.R + s.lh * 1e3);
  return Math.hypot(s.cx, s.cy) * 1e6 * k;
}

// ----------------------------------------------------------- gravitação (1)
const RHO1 = 1500; // densidade das esferas da régua (kg/m³)
const rad1 = (m: number) => Math.cbrt((3 * m) / (4 * Math.PI * RHO1));
const m1 = (p: Params) => num(p, "m1", 500);
const m2 = (p: Params) => num(p, "m2", 300);
export const forceN = (s: CV, p: Params) => (G0 * m1(p) * m2(p)) / (s.x2 - s.x1) ** 2;

export const cavendish = defineSim<CV>({
  id: "cavendish",
  title: "Balança de Cavendish, lei da gravitação e campo gravitacional",
  course: "FG I",
  topic: "Gravitação",
  priority: "P2",
  summary:
    "A balança de torção com laser e escala: troque as esferas grandes de lado, meça o deslocamento do equilíbrio e o período e calcule G. Também a lei da gravitação com duas massas arrastáveis e o campo de um planeta, central e homogêneo.",
  equations: [
    String.raw`F = \frac{G\,M\,m}{r^2} \qquad \vec g = -\frac{G M}{r^2}\,\hat r \;\;(r \ge R) \qquad g = \frac{G M r}{R^3}\;\;(r < R)`,
    String.raw`I\ddot\theta = -\kappa\theta - c\dot\theta + \tau_{grav} \qquad \kappa\,\theta_{eq} \approx 2d\,\frac{G M m}{b^2} \qquad T = 2\pi\sqrt{I/\kappa}`,
    String.raw`S = L\,\text{tg}\,2\theta \qquad G = \frac{\pi^2\,\Delta S\, d\, b^2}{T^2\,M\,L} \qquad G_{corr} = \frac{G}{1-\beta},\;\; \beta = \frac{b^3}{(b^2+4d^2)^{3/2}}`,
  ],
  liveEquations(s, p) {
    const md = modo(p);
    if (md === 0) {
      const T = measuredPeriod(s);
      const g = gMeasured(s, p);
      return [
        String.raw`\theta = ${texNum(s.th * 1000)}\ \text{mrad} \qquad S = ${texNum(laserS(s.th, p) * 100)}\ \text{cm} \qquad T_{med} = ${T > 0 ? texNum(T) : "?"}\ \text{s}\ (\text{teórico } ${texNum(period0(p))}\ \text{s})`,
        g > 0
          ? String.raw`\Delta S = ${texNum((s.cI - s.cII) * 100)}\ \text{cm} \Rightarrow G = ${texNum(g)} \;\to\; G_{corr} = ${texNum(g / (1 - betaCorr(p)))}\ \text{N·m}^2/\text{kg}^2`
          : String.raw`\text{meça os centros de oscilação nas posições I e II para obter } \Delta S`,
      ];
    }
    if (md === 1) {
      const r = s.x2 - s.x1;
      return [String.raw`F = \frac{${texNum(G0, 4)}\cdot ${texNum(m1(p))}\cdot ${texNum(m2(p))}}{${texNum(r)}^2} = ${texNum(forceN(s, p))}\ \text{N}`];
    }
    const pl = planet(p);
    const r = probeR(s, p);
    return [String.raw`g(${texNum(r / 1e3, 4)}\ \text{km}) = ${texNum(gField(r, pl.M, pl.R))}\ \text{m/s}^2 \qquad g_0 = ${texNum(gField(pl.R, pl.M, pl.R))}\ \text{m/s}^2`];
  },

  params: [
    {
      key: "modo",
      label: "Experimento",
      unit: "",
      min: 0,
      max: 2,
      step: 1,
      default: 0,
      options: [
        { value: 0, label: "Balança de torção de Cavendish" },
        { value: 1, label: "Lei da gravitação (duas massas)" },
        { value: 2, label: "Campo gravitacional de um planeta" },
      ],
    },
    { key: "M", label: "Balança: massa de cada esfera grande", unit: "kg", min: 0.5, max: 3, step: 0.1, default: 1.5 },
    { key: "b", label: "Balança: distância entre centros (b)", unit: "mm", min: 40, max: 80, step: 0.5, default: 46.5 },
    { key: "kappa", label: "Balança: constante de torção do fio (×10⁻⁹)", unit: "N·m/rad", min: 2, max: 40, step: 0.5, default: 8 },
    { key: "tdec", label: "Balança: tempo de amortecimento", unit: "s", min: 300, max: 6000, step: 50, default: 1500 },
    { key: "L", label: "Balança: distância do espelho à escala", unit: "m", min: 1, max: 10, step: 0.1, default: 5 },
    { key: "ritmo", label: "Balança: relógio acelerado (s físicos por s)", unit: "×", min: 1, max: 200, step: 1, default: 60, live: true },
    { key: "m1", label: "Gravitação: massa 1", unit: "kg", min: 1, max: 1000, step: 1, default: 500, live: true, log: true },
    { key: "m2", label: "Gravitação: massa 2", unit: "kg", min: 1, max: 1000, step: 1, default: 300, live: true, log: true },
    {
      key: "planeta",
      label: "Campo: astro",
      unit: "",
      min: 0,
      max: 3,
      step: 1,
      default: 0,
      options: PLANETS.map((q, i) => ({ value: i, label: q.label })),
      live: true,
    },
    {
      key: "vista",
      label: "Campo: vista",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 0,
      options: [
        { value: 0, label: "Campo central (astro inteiro)" },
        { value: 1, label: "Perto da superfície (campo homogêneo?)" },
      ],
      live: true,
    },
  ],

  observables: [
    { key: "S", label: "Posição do laser na escala", unit: "cm", value: (s, p) => (modo(p) === 0 ? laserS(s.th, p) * 100 : 0) },
    { key: "th", label: "Ângulo do braço", unit: "mrad", value: (s) => s.th * 1000 },
    { key: "tf", label: "Tempo do experimento", unit: "s", value: (s) => s.tf },
    { key: "T", label: "Período medido", unit: "s", value: (s) => measuredPeriod(s) },
    { key: "dS", label: "ΔS entre os centros (I − II)", unit: "cm", value: (s) => (s.hasI && s.hasII ? (s.cI - s.cII) * 100 : 0) },
    { key: "G", label: "G calculado", unit: "N·m²/kg²", value: (s, p) => gMeasured(s, p) },
    { key: "Gc", label: "G corrigido (esfera distante)", unit: "N·m²/kg²", value: (s, p) => gMeasured(s, p) / (1 - betaCorr(p)) },
    { key: "r", label: "Distância entre os centros", unit: "m", value: (s) => s.x2 - s.x1 },
    { key: "F", label: "Força gravitacional", unit: "N", value: (s, p) => (modo(p) === 1 ? forceN(s, p) : 0) },
    { key: "h", label: "Altitude da sonda", unit: "km", value: (s, p) => (probeR(s, p) - planet(p).R) / 1e3 },
    { key: "g", label: "Intensidade do campo", unit: "m/s²", value: (s, p) => gField(probeR(s, p), planet(p).M, planet(p).R) },
    {
      key: "erro",
      label: "Erro do campo homogêneo (g₀ no lugar de g)",
      unit: "%",
      value: (s, p) => {
        const pl = planet(p);
        const g = gField(probeR(s, p), pl.M, pl.R);
        return (100 * (gField(pl.R, pl.M, pl.R) - g)) / g;
      },
    },
  ],
  chart: { x: "tf", y: "S" },

  scenarios: [
    {
      id: "cavendish",
      label: "Medindo G",
      params: { modo: 0, M: 1.5, b: 46.5, kappa: 8, L: 5, ritmo: 60 },
      guide: `### A balança de Cavendish (1798)
1. As esferas grandes acabaram de ser postas na **posição I**: o braço oscila lentamente em torno de um novo equilíbrio. O laser amplifica o ângulo: $S = L\\,\\text{tg}\\,2\\theta$.
2. Espere três extremos: a simulação estima o centro da oscilação como $(S_1 + 2S_2 + S_3)/4$ e o período $T$.
3. Clique **Girar para a posição II**. O equilíbrio passa para o outro lado. Espere de novo três extremos.
4. Com $\\Delta S = S_I - S_{II}$, $T$, $M$, $L$, $d = 5$ cm e $b$: $G = \\pi^2 \\Delta S\\, d\\, b^2/(T^2 M L)$. Confira o observável "G calculado".
5. O valor sai uns 7% baixo: a esfera grande do outro lado puxa a esfera pequena no sentido contrário. O "G corrigido" divide por $1 - \\beta$.`,
      predict: [
        {
          question: "Se a massa das esferas grandes dobrar, o deslocamento ΔS do laser:",
          options: ["dobra", "quadruplica", "fica igual, só o período muda", "cai à metade"],
          answer: 0,
          explanation: "O torque gravitacional é proporcional a $M$, e o desvio de equilíbrio $\\theta_{eq} = \\tau/\\kappa$ também. O período depende só de $I$ e $\\kappa$.",
        },
      ],
    },
    {
      id: "fio",
      label: "Fio mais fino",
      params: { modo: 0, M: 1.5, kappa: 3, ritmo: 100, tdec: 3000 },
      guide: `### Sensibilidade × tempo
1. Um fio com $\\kappa$ menor torce mais: o desvio cresce como $1/\\kappa$.
2. Mas o período cresce como $1/\\sqrt\\kappa$: o experimento fica mais lento e mais sensível a perturbações.
3. Meça $G$ de novo e compare com o fio padrão.`,
    },
    {
      id: "lei",
      label: "Lei da gravitação",
      params: { modo: 1, m1: 500, m2: 300 },
      guide: `### Força entre duas massas
1. Arraste as esferas pela régua. As forças sobre elas têm sempre o **mesmo módulo** e sentidos opostos (3ª lei), mesmo com massas diferentes.
2. Dobre a distância: a força cai a 1/4. O gráfico log–log ao lado tem inclinação −2.
3. Mesmo com 1000 kg a 1 m, a força é de $10^{-5}$ N: por isso Cavendish precisou de uma balança tão delicada.`,
      predict: [
        {
          question: "A esfera de 1000 kg puxa a de 10 kg com força F. A de 10 kg puxa a de 1000 kg com:",
          options: ["F/100", "F", "100 F"],
          answer: 1,
          explanation: "Ação e reação: $F = G m_1 m_2/r^2$ é a mesma para as duas. O que difere é a aceleração, $F/m$.",
        },
      ],
    },
    {
      id: "campo",
      label: "Campo gravitacional",
      params: { modo: 2, planeta: 0, vista: 0 },
      guide: `### Central ou homogêneo?
1. Arraste a sonda: o campo aponta para o centro e cai com $1/r^2$ fora do astro e cresce linearmente dentro (densidade uniforme).
2. Mude para a vista **perto da superfície**: numa faixa de 100 km as setas parecem paralelas e iguais. Leia o erro de usar $g_0$: menos de 3% a 100 km.
3. Na órbita da Estação Espacial (≈ 400 km), $g$ ainda vale cerca de 89% de $g_0$: a imponderabilidade lá é queda livre, não ausência de gravidade.`,
    },
  ],

  exercises: [
    {
      id: "G",
      prompt:
        "Numa balança de Cavendish com d = 5 cm, b = {b} mm, M = {M} kg e escala a {L} m do espelho, o laser se desloca ΔS = {dS} cm entre as posições I e II, e o período é {T} s. Quanto vale G (fórmula simples, sem correção)?",
      vary: { b: [42, 60, 1], M: [0.8, 2.5, 1], L: [2, 8, 1], dS: [5, 25, 1], T: [400, 900, 0] },
      answer: {
        label: "G",
        unit: "N·m²/kg²",
        compute: (p) => (Math.PI ** 2 * (num(p, "dS") / 100) * 0.05 * (num(p, "b") / 1000) ** 2) / (num(p, "T") ** 2 * num(p, "M") * num(p, "L")),
      },
      hint: "G = π² ΔS d b² / (T² M L), tudo em SI.",
    },
    {
      id: "forca",
      prompt: "Duas esferas de {m1} kg e {m2} kg têm centros a {r} m. Qual a força gravitacional entre elas? (G = 6,674 × 10⁻¹¹ N·m²/kg²)",
      vary: { m1: [10, 1000, 0], m2: [10, 1000, 0], r: [0.5, 5, 2] },
      fixed: { modo: 1 },
      answer: { label: "F", unit: "N", compute: (p) => (G0 * num(p, "m1") * num(p, "m2")) / num(p, "r") ** 2 },
    },
    {
      id: "altitude",
      prompt: "Na superfície da Terra (raio 6371 km) g = 9,82 m/s². Quanto vale g a {h} km de altitude?",
      vary: { h: [100, 20000, 0] },
      fixed: { modo: 2 },
      answer: { label: "g", unit: "m/s²", compute: (p) => 9.82 * (6371 / (6371 + num(p, "h"))) ** 2 },
    },
  ],

  init(p) {
    const pi = psiI(p);
    return {
      th: 0,
      om: 0,
      tf: 0,
      psi: pi,
      psiT: pi,
      ext: [],
      cI: 0,
      cII: 0,
      hasI: false,
      hasII: false,
      x1: -2,
      x2: 2,
      cx: 0,
      cy: 12,
      lx: 0,
      lh: 30,
      drag: "",
    };
  },
  step(s, p, _t, dt) {
    return modo(p) === 0 ? stepBalance(s, p, dt) : s;
  },
  dt: 0.01,
  sampleEvery: 10,

  actions: [
    { id: "pI", label: "Girar para a posição I", run: (s, p) => ({ ...s, psiT: psiI(p) }), active: (s) => s.psiT > 0.01 && s.psiT < 1.5 },
    { id: "pII", label: "Girar para a posição II", run: (s, p) => ({ ...s, psiT: -psiI(p) }), active: (s) => s.psiT < -0.01 },
    { id: "neutra", label: "Posição neutra", run: (s) => ({ ...s, psiT: Math.PI / 2 }), active: (s) => s.psiT >= 1.5 },
  ],

  pointer: {
    down(s, p, pt) {
      const md = modo(p);
      if (md === 1) {
        if (Math.abs(pt.x - s.x1) < Math.max(0.3, rad1(m1(p)))) return { ...s, drag: "m1" };
        if (Math.abs(pt.x - s.x2) < Math.max(0.3, rad1(m2(p)))) return { ...s, drag: "m2" };
        return undefined;
      }
      if (md === 2) return moveProbe({ ...s, drag: "probe" }, p, pt);
      return undefined;
    },
    move(s, p, pt, dragging) {
      if (!dragging || !s.drag) return undefined;
      if (s.drag === "probe") return moveProbe(s, p, pt);
      const gap = rad1(m1(p)) + rad1(m2(p)) + 0.05;
      const x = Math.round(pt.x * 20) / 20;
      if (s.drag === "m1") return { ...s, x1: clamp(x, -5, s.x2 - gap) };
      return { ...s, x2: clamp(x, s.x1 + gap, 5) };
    },
    up: (s) => (s.drag ? { ...s, drag: "" } : undefined),
    cursor: (_s, p) => (modo(p) === 1 ? "ew-resize" : modo(p) === 2 ? "crosshair" : undefined),
  },

  viewport(p) {
    const md = modo(p);
    if (md === 0) return { xMin: -16, xMax: 26, yMin: -13, yMax: 13 };
    if (md === 1) return { xMin: -6, xMax: 6, yMin: -3.2, yMax: 4.2, unit: "m" };
    if (local(p)) return { xMin: -160, xMax: 160, yMin: -30, yMax: 140, unit: "km" };
    return { xMin: -22, xMax: 40, yMin: -22, yMax: 22 };
  },

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const md = modo(frame.params);
    if (md === 0) renderBalance(d, frame.state, frame.params);
    else if (md === 1) renderLaw(d, frame.state, frame.params);
    else renderField(d, frame.state, frame.params);
  },
});

function moveProbe(s: CV, p: Params, pt: { x: number; y: number }): CV {
  if (local(p)) return { ...s, lx: clamp(pt.x, -150, 150), lh: clamp(pt.y, 0, 130) };
  return { ...s, cx: clamp(pt.x, -20, 20), cy: clamp(pt.y, -20, 20) };
}

type D = ReturnType<typeof draw>;

function renderBalance(d: D, s: CV, p: Params) {
  const t = d.theme;
  const K = 100; // desenho em cm
  const cx = -4;
  const dd = SMALL.d * K;
  const rho = Math.hypot(SMALL.d, B(p)) * K;
  const RB = bigRadius(M(p)) * K;
  d.text("vista de cima (em escala, cm)", cx, 12, { size: 12, weight: "600" });
  // braço giratório das esferas grandes
  const bxs = rho * Math.cos(s.psi);
  const bys = rho * Math.sin(s.psi);
  d.line(cx - bxs, -bys, cx + bxs, bys, { color: t.muted, width: 5, alpha: 0.5 });
  for (const sg of [1, -1]) d.circle(cx + sg * bxs, sg * bys, RB, { fill: t.series[1], stroke: t.text, width: 1, alpha: 0.85 });
  d.text(`M = ${formatBR(M(p), 3)} kg`, cx + bxs, bys + RB + 0.8, { size: 10 });
  // braço das esferas pequenas (ângulo real; o laser amplia)
  const ux = Math.cos(s.th);
  const uy = Math.sin(s.th);
  d.line(cx - dd * ux, -dd * uy, cx + dd * ux, dd * uy, { color: t.text, width: 2.5 });
  for (const sg of [1, -1]) d.circle(cx + sg * dd * ux, sg * dd * uy, SMALL.r * K, { fill: t.series[0], stroke: t.text, width: 1 });
  d.rect(cx - 0.4, -0.25, 0.8, 0.5, { fill: t.accent, alpha: 0.6 });
  d.text("espelho", cx, -1.3, { size: 9, color: t.muted });
  // força de atração sobre a esfera pequena (escala ilustrativa)
  const tau = gravTorque(s.th, s.psi, p);
  if (Math.abs(tau) > 1e-14) d.arrowPx(cx + dd * ux, dd * uy, -uy * Math.sign(tau), ux * Math.sign(tau), clamp(Math.abs(tau) * 2e12, 6, 60), { color: t.positive });
  d.text(`τ_grav = ${formatBR(tau, 3)} N·m`, cx - 11, -10, { size: 10, align: "left", color: t.positive });
  const pos = s.psiT >= 1.5 ? "neutra" : s.psiT > 0 ? "I" : "II";
  d.text(`posição das esferas: ${pos}${s.psi !== s.psiT ? " (girando…)" : ""}`, cx - 11, -11.4, { size: 11, align: "left", weight: "600" });
  // laser e escala (fora de escala: L metros)
  const scaleX = 20;
  const S = laserS(s.th, p) * 100; // cm
  const k = 0.4; // 1 cm da escala = 0,4 unidades de desenho
  const yS = clamp(S * k, -11.5, 11.5);
  d.line(cx, 0, scaleX, yS, { color: t.positive, width: 1.5, alpha: 0.8 });
  d.text(`L = ${formatBR(LL(p), 3)} m (fora de escala)`, (cx + scaleX) / 2 + 3, -1.2, { size: 9, color: t.muted });
  d.line(scaleX, -12, scaleX, 12, { color: t.text, width: 3 });
  for (let c = -28; c <= 28; c += 2) {
    const big = c % 10 === 0;
    d.line(scaleX, c * k, scaleX + (big ? 1.2 : 0.6), c * k, { color: t.text, width: 1 });
    if (big) d.text(`${c}`, scaleX + 1.6, c * k, { size: 9, align: "left" });
  }
  d.text("escala (cm)", scaleX, 12.6, { size: 10 });
  d.dot(scaleX, yS, 5, t.positive);
  d.text(`S = ${S.toFixed(2)} cm`, scaleX - 0.8, yS + 0.9, { size: 11, align: "right", color: t.positive, weight: "600" });
  // centros medidos
  if (s.hasI) {
    d.line(scaleX - 1.5, s.cI * 100 * k, scaleX, s.cI * 100 * k, { color: t.series[2], width: 2 });
    d.text("I", scaleX - 2, s.cI * 100 * k, { size: 10, color: t.series[2], align: "right" });
  }
  if (s.hasII) {
    d.line(scaleX - 1.5, s.cII * 100 * k, scaleX, s.cII * 100 * k, { color: t.series[4], width: 2 });
    d.text("II", scaleX - 2, s.cII * 100 * k, { size: 10, color: t.series[4], align: "right" });
  }
  const T = measuredPeriod(s);
  const g = gMeasured(s, p);
  const lines = [
    `tempo: ${formatBR(s.tf / 60, 3)} min   (relógio ${num(p, "ritmo", 60)}×)`,
    `período medido: ${T > 0 ? `${formatBR(T, 4)} s` : "aguardando 3 extremos"}`,
    `ΔS = S_I − S_II: ${s.hasI && s.hasII ? `${formatBR((s.cI - s.cII) * 100, 4)} cm` : "meça I e II"}`,
    `G = ${g > 0 ? formatBR(g, 4) : "—"}   corrigido: ${g > 0 ? formatBR(g / (1 - betaCorr(p)), 4) : "—"}`,
    `(valor aceito 6,674 × 10^-11)`,
  ];
  lines.forEach((l, i) => d.text(l, 3, 11.5 - i * 1.1, { size: 11, align: "left", color: i === 3 ? t.accent : t.text }));
}

function renderLaw(d: D, s: CV, p: Params) {
  const t = d.theme;
  // régua
  d.line(-5, -1.6, 5, -1.6, { color: t.muted, width: 2 });
  for (let x = -5; x <= 5; x += 0.5) {
    d.line(x, -1.6, x, x % 1 === 0 ? -1.85 : -1.75, { color: t.muted, width: 1 });
    if (x % 1 === 0) d.text(`${x}`, x, -2.1, { size: 10, color: t.muted });
  }
  d.text("m", 5.4, -2.1, { size: 10, color: t.muted });
  const F = forceN(s, p);
  const len = clamp(20 + 18 * Math.log10(F / 1e-12), 10, 160);
  for (const [x, m, c, dir, lbl] of [
    [s.x1, m1(p), t.series[0]!, 1, "m₁"],
    [s.x2, m2(p), t.series[1]!, -1, "m₂"],
  ] as const) {
    const r = rad1(m);
    d.line(x, -1.6, x, 0, { color: t.muted, width: 1, dash: [3, 3] });
    d.circle(x, 0, r, { fill: c, stroke: t.text, width: 1 });
    d.text(`${lbl} = ${formatBR(m, 4)} kg`, x, -r - 0.35, { size: 11, weight: "600" });
    d.arrowPx(x, 1.4, dir, 0, len, { color: t.positive, width: 2.5 });
    d.text(`${formatBR(F, 4)} N`, x + dir * (len * d.px) * 0.5, 1.75, { size: 11, color: t.positive });
  }
  d.text(`r = ${formatBR(s.x2 - s.x1, 3)} m   ·   F = G m₁m₂/r² = ${formatBR(F, 4)} N   ·   arraste as esferas`, -5.8, 3.9, { size: 12, align: "left", weight: "600" });
  // gráfico log-log F × r
  const gx0 = 1.6;
  const gx1 = 5.6;
  const gy0 = 2.2;
  const gy1 = 3.5;
  const lr = (r: number) => gx0 + ((Math.log10(r) + 0.5) / 1.5) * (gx1 - gx0); // r de 10^-0,5 a 10^1
  const Ff = (r: number) => (G0 * m1(p) * m2(p)) / (r * r);
  const fMin = Ff(10);
  const fMax = Ff(10 ** -0.5);
  const lf = (f: number) => gy0 + ((Math.log10(f) - Math.log10(fMin)) / (Math.log10(fMax) - Math.log10(fMin))) * (gy1 - gy0);
  d.rect(gx0, gy0, gx1 - gx0, gy1 - gy0, { stroke: t.grid, width: 1 });
  d.plot((x) => lf(Ff(10 ** (((x - gx0) / (gx1 - gx0)) * 1.5 - 0.5))), gx0, gx1, { color: t.accent, n: 60 });
  const rr = s.x2 - s.x1;
  d.dot(lr(rr), lf(F), 5, t.positive);
  d.text("log F × log r (inclinação −2)", (gx0 + gx1) / 2, gy0 - 0.2, { size: 10, color: t.muted });
  d.text(`F·r² = ${formatBR(F * rr * rr, 4)} N·m² (constante)`, -5.8, 3.4, { size: 11, align: "left", color: t.muted });
}

function renderField(d: D, s: CV, p: Params) {
  const t = d.theme;
  const pl = planet(p);
  const g0 = gField(pl.R, pl.M, pl.R);
  if (local(p)) {
    // faixa de 300 km × 130 km acima da superfície
    d.rect(-160, -30, 320, 30, { fill: t.ground });
    d.text("superfície", -150, -15, { size: 11, align: "left" });
    for (let x = -140; x <= 140; x += 35) {
      for (let h = 10; h <= 130; h += 30) {
        const X = x * 1e3;
        const Y = pl.R + h * 1e3;
        const r = Math.hypot(X, Y);
        const g = gField(r, pl.M, pl.R);
        d.arrowPx(x, h, -X / r, -Y / r, 28 * (g / g0), { color: t.accent, width: 1.5 });
      }
    }
    const r = probeR(s, p);
    const g = gField(r, pl.M, pl.R);
    const X = s.lx * 1e3;
    const Y = pl.R + s.lh * 1e3;
    d.dot(s.lx, s.lh, 6, t.positive);
    d.arrowPx(s.lx, s.lh, -X / r, -Y / r, 50 * (g / g0), { color: t.positive, width: 2.5 });
    d.text(
      `h = ${formatBR(s.lh, 3)} km   g = ${formatBR(g, 4)} m/s²   (g₀ = ${formatBR(g0, 4)})   erro de usar g₀: ${formatBR((100 * (g0 - g)) / g, 3)} %   inclinação: ${formatBR(deg(Math.atan2(Math.abs(X), Y)), 2)}°`,
      -155,
      133,
      { size: 11, align: "left" },
    );
    return;
  }
  const k = pl.R / 6.371e6; // unidades de desenho: 10³ km na Terra; os outros astros são reescalados
  const Rd = 6.371;
  d.circle(0, 0, Rd, { fill: t.ground, stroke: t.text, width: 1.5 });
  d.text(pl.label, 0, 0, { size: 12, weight: "600" });
  // grade de setas
  for (let x = -20; x <= 20; x += 4) {
    for (let y = -20; y <= 20; y += 4) {
      const r = Math.hypot(x, y);
      if (r < 1) continue;
      const g = gField(r * 1e6 * k, pl.M, pl.R);
      d.arrowPx(x, y, -x / r, -y / r, clamp(30 * (g / g0), 3, 30), { color: t.accent, width: 1.2, alpha: 0.75 });
    }
  }
  const r = probeR(s, p);
  const g = gField(r, pl.M, pl.R);
  const rr = Math.hypot(s.cx, s.cy) || 1;
  d.dot(s.cx, s.cy, 6, t.positive);
  d.arrowPx(s.cx, s.cy, -s.cx / rr, -s.cy / rr, clamp(60 * (g / g0), 4, 80), { color: t.positive, width: 2.5 });
  d.text(`g = ${formatBR(g, 4)} m/s²`, s.cx + 0.8, s.cy + 1.2, { size: 11, align: "left", color: t.positive, weight: "600" });
  // gráfico g(r)
  const gx0 = 23;
  const gx1 = 39;
  const gy0 = -8;
  const gy1 = 8;
  const rmax = 4; // em raios do astro
  const X = (q: number) => gx0 + (q / rmax) * (gx1 - gx0);
  const Y = (gv: number) => gy0 + (gv / g0) * (gy1 - gy0);
  d.rect(gx0, gy0, gx1 - gx0, gy1 - gy0, { stroke: t.grid, width: 1 });
  d.plot((x) => Y(gField((((x - gx0) / (gx1 - gx0)) * rmax) * pl.R, pl.M, pl.R)), gx0, gx1, { color: t.accent, n: 160 });
  d.line(X(1), gy0, X(1), gy1, { color: t.muted, dash: [3, 3], width: 1 });
  d.dot(X(Math.min(rmax, r / pl.R)), Y(g), 5, t.positive);
  d.text("g / g₀ × r / R", (gx0 + gx1) / 2, gy1 + 1, { size: 11 });
  d.text("superfície", X(1), gy0 - 1, { size: 9, color: t.muted });
  d.text(`${rmax} R`, gx1, gy0 - 1, { size: 9, color: t.muted });
  d.text("dentro: g ∝ r   fora: g ∝ 1/r²   ·   arraste a sonda", -21, -20.5, { size: 11, align: "left", color: t.muted });
}

export default cavendish;
