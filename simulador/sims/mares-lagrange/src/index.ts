import { clamp, defineSim, draw, num, rk4, texNum, type Params } from "@fisilab/core";
import {
  GRAV,
  MU_ROUTH,
  M_MOON,
  M_SUN,
  D_SUN,
  R_EARTH,
  T_DAY,
  T_MOON,
  T_YEAR,
  cr3bp,
  jacobi,
  lagrangePoints,
  modeOf,
  moonDist,
  moonMass,
  muOf,
  phiEff,
  sunOn,
  tidalAccel,
  tideHeight,
  tideRange,
  tideScale,
} from "./physics.ts";

export * from "./physics.ts";

export interface Particle {
  y: number[];
  dead: boolean;
}

export interface MLState {
  phiL: number;
  phiS: number;
  psi: number;
  parts: Particle[];
  /** Ponto de Lagrange de onde a partícula 1 partiu (para medir o afastamento). */
  L0: [number, number] | null;
  drag: { kind: "moon" | "sun" } | null;
}

const DEG = Math.PI / 180;
const fmt = (v: number, n: number) => v.toFixed(n).replace(".", ",");
/** Até onde a Lua é desenhada em escala (raios terrestres). */
const MOON_VIEW = 3.6;
const SUN_VIEW = 4.25;
const MAX_PARTS = 8;

const POINTS = ["L1", "L2", "L3", "L4", "L5", "Nenhuma"];

function phaseText(s: MLState, p: Params): string {
  if (!sunOn(p)) return "Só a Lua: maré lunar";
  const c = Math.abs(Math.cos(s.phiL - s.phiS));
  if (c > 0.92) return "Sizígia (Lua nova ou cheia): marés de águas vivas";
  if (c < 0.38) return "Quadratura (quarto crescente ou minguante): águas mortas";
  return "Fase intermediária";
}

/** Aceleração de maré total (Lua + Sol) no ponto (x, y) dado em raios terrestres. */
export function tideField(s: MLState, p: Params, x: number, y: number): [number, number] {
  const r: [number, number] = [x * R_EARTH, y * R_EARTH];
  const dL = moonDist(p);
  const a = tidalAccel(r, [dL * Math.cos(s.phiL), dL * Math.sin(s.phiL)], moonMass(p));
  if (sunOn(p)) {
    const b = tidalAccel(r, [D_SUN * Math.cos(s.phiS), D_SUN * Math.sin(s.phiS)], M_SUN);
    a[0] += b[0];
    a[1] += b[1];
  }
  return a;
}

export function initParticles(p: Params): { parts: Particle[]; L0: [number, number] | null } {
  const k = Math.round(num(p, "ponto", 3));
  if (k < 0 || k > 4) return { parts: [], L0: null };
  const L = lagrangePoints(muOf(p))[k]!;
  const d = num(p, "pert", 0.01);
  // desloca radialmente (para fora do centro de massa), partindo do repouso no referencial girante
  const n = Math.hypot(L[0], L[1]) || 1;
  return { parts: [{ y: [L[0] + (d * L[0]) / n, L[1] + (d * L[1]) / n, 0, 0], dead: false }], L0: [L[0], L[1]] };
}

function viewport(p: Params) {
  return modeOf(p) === 1 ? { xMin: -1.75, xMax: 1.75, yMin: -1.3, yMax: 1.3 } : { xMin: -4.6, xMax: 4.6, yMin: -3.3, yMax: 3.3 };
}

/** Segmentos de uma curva de nível de f pelo método dos quadrados marchantes. */
function contour(f: (x: number, y: number) => number, level: number, x0: number, x1: number, y0: number, y1: number, nx: number, ny: number): [number, number, number, number][] {
  const hx = (x1 - x0) / nx, hy = (y1 - y0) / ny;
  const v: number[][] = [];
  for (let i = 0; i <= nx; i++) {
    v.push([]);
    for (let j = 0; j <= ny; j++) v[i]!.push(f(x0 + i * hx, y0 + j * hy) - level);
  }
  const segs: [number, number, number, number][] = [];
  const lerp = (a: number, b: number) => (Math.abs(a - b) < 1e-15 ? 0.5 : a / (a - b));
  for (let i = 0; i < nx; i++)
    for (let j = 0; j < ny; j++) {
      const a = v[i]![j]!, b = v[i + 1]![j]!, c = v[i + 1]![j + 1]!, d = v[i]![j + 1]!;
      if (![a, b, c, d].every(Number.isFinite)) continue;
      const pts: [number, number][] = [];
      const X = x0 + i * hx, Y = y0 + j * hy;
      if (a * b < 0) pts.push([X + lerp(a, b) * hx, Y]);
      if (b * c < 0) pts.push([X + hx, Y + lerp(b, c) * hy]);
      if (c * d < 0) pts.push([X + (1 - lerp(c, d)) * hx, Y + hy]);
      if (d * a < 0) pts.push([X, Y + (1 - lerp(d, a)) * hy]);
      if (pts.length >= 2) segs.push([pts[0]![0], pts[0]![1], pts[1]![0], pts[1]![1]]);
      if (pts.length === 4) segs.push([pts[2]![0], pts[2]![1], pts[3]![0], pts[3]![1]]);
    }
  return segs;
}


let offscreen: HTMLCanvasElement | null = null;
let offKey = "";
/** Mapa de Φ_ef: canvas fora da tela no navegador; blocos grossos sem DOM (testes). */
function potentialMap(
  ctx: CanvasRenderingContext2D,
  mu: number,
  vp: { xMin: number; xMax: number; yMin: number; yMax: number },
  accent: string,
  dark: boolean,
  fallback: (x0: number, y0: number, w: number, h: number, alpha: number) => void,
) {
  const nx = 175, ny = 130;
  const LP4 = lagrangePoints(mu)[3]!;
  const top = phiEff(LP4[0], LP4[1], mu);
  const lo = phiEff(vp.xMax, vp.yMax, mu);
  const level = (i: number, j: number, n: number, m: number) => {
    const x = vp.xMin + ((i + 0.5) * (vp.xMax - vp.xMin)) / n, y = vp.yMin + ((j + 0.5) * (vp.yMax - vp.yMin)) / m;
    return 0.04 + 0.45 * clamp((phiEff(x, y, mu) - lo) / (top - lo), 0, 1) ** 1.5;
  };
  if (typeof document !== "undefined") {
    const key = `${mu}|${accent}|${dark}`;
    if (!offscreen || key !== offKey) {
      offscreen ??= document.createElement("canvas");
      offscreen.width = nx;
      offscreen.height = ny;
      const octx = offscreen.getContext("2d");
      const m = /^#?([0-9a-f]{6})$/i.exec(accent);
      const c = m ? parseInt(m[1]!, 16) : 0x2f7de1;
      if (octx) {
        const img = octx.createImageData(nx, ny);
        for (let j = 0; j < ny; j++)
          for (let i = 0; i < nx; i++) {
            const o = 4 * (i + nx * j);
            img.data[o] = (c >> 16) & 255;
            img.data[o + 1] = (c >> 8) & 255;
            img.data[o + 2] = c & 255;
            img.data[o + 3] = Math.round(255 * level(i, j, nx, ny));
          }
        octx.putImageData(img, 0, 0);
        offKey = key;
      }
    }
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(offscreen, vp.xMin, vp.yMin, vp.xMax - vp.xMin, vp.yMax - vp.yMin);
    return;
  }
  const n = 40, m = 30;
  const hx = (vp.xMax - vp.xMin) / n, hy = (vp.yMax - vp.yMin) / m;
  for (let j = 0; j < m; j++) for (let i = 0; i < n; i++) fallback(vp.xMin + i * hx, vp.yMin + j * hy, hx, hy, level(i, j, n, m));
}

const part1 = (s: MLState) => s.parts[0];

export const maresLagrange = defineSim<MLState>({
  id: "mares-lagrange",
  title: "Marés e pontos de Lagrange",
  course: "FG I",
  topic: "Gravitação",
  priority: "P3",
  summary:
    "O campo de maré é a diferença entre a gravidade local e a do centro da Terra: veja as duas protuberâncias, as marés de sizígia e de quadratura e, no referencial girante, o potencial efetivo com os cinco pontos de Lagrange.",
  equations: [
    String.raw`\vec a_{\text{maré}}(\vec r) = GM\left[\frac{\vec D - \vec r}{|\vec D - \vec r|^3} - \frac{\vec D}{D^3}\right] \approx \frac{2GMR}{D^3}\ (\text{no ponto sub-lunar})`,
    String.raw`h(\gamma) = \frac{M}{M_T}\Big(\frac{R}{D}\Big)^3 R\;\frac{3\cos^2\gamma - 1}{2}`,
    String.raw`\Phi_{\text{ef}} = -\frac{1-\mu}{r_1} - \frac{\mu}{r_2} - \tfrac12(x^2+y^2) \qquad \ddot{\vec r} = -\nabla\Phi_{\text{ef}} - 2\,\hat z\times\dot{\vec r}`,
    String.raw`C_J = -2\Phi_{\text{ef}} - v^2 \qquad L_4, L_5 \text{ estáveis se } \mu < \mu_c = \tfrac12\big(1 - \sqrt{23/27}\big) \approx 0{,}0385`,
  ],
  liveEquations(s, p) {
    if (modeOf(p) === 1) {
      const mu = muOf(p);
      const P = part1(s);
      return [
        String.raw`\mu = ${texNum(mu)} \qquad \mu_c = ${texNum(MU_ROUTH)} \quad \Rightarrow\quad L_4, L_5\ \text{${mu < MU_ROUTH ? "estáveis" : "instáveis"}}`,
        P ? String.raw`C_J = ${texNum(jacobi(P.y, mu), 6)} \qquad x = ${texNum(P.y[0]!)},\ y = ${texNum(P.y[1]!)}` : String.raw`\text{clique no palco para soltar partículas}`,
      ];
    }
    const hL = tideScale(moonMass(p), moonDist(p));
    const hS = tideScale(M_SUN, D_SUN);
    const dL = moonDist(p);
    return [
      String.raw`a_{\text{Lua}} \approx \frac{2GM_LR}{D_L^3} = ${texNum((2 * GRAV * moonMass(p) * R_EARTH) / dL ** 3)}\ \text{m/s}^2 \qquad a_{\text{Sol}} \approx ${texNum((2 * GRAV * M_SUN * R_EARTH) / D_SUN ** 3)}\ \text{m/s}^2`,
      String.raw`h_{0,\text{Lua}} = ${texNum(hL)}\ \text{m} \qquad h_{0,\text{Sol}} = ${texNum(hS)}\ \text{m} \qquad \frac{h_{\text{Sol}}}{h_{\text{Lua}}} = ${texNum(hS / hL)}`,
      String.raw`h_{\text{observador}} = ${texNum(tideHeight(s, p, s.psi))}\ \text{m} \qquad \text{amplitude total} = ${texNum(tideRange(s, p))}\ \text{m}`,
    ];
  },

  params: [
    {
      key: "modo",
      label: "Parte",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 0,
      options: [
        { value: 0, label: "Marés na Terra (Lua e Sol)" },
        { value: 1, label: "Referencial girante e pontos de Lagrange" },
      ],
    },
    { key: "angL", label: "Posição inicial da Lua", unit: "°", min: 0, max: 360, step: 1, default: 0 },
    { key: "angS", label: "Direção inicial do Sol", unit: "°", min: 0, max: 360, step: 1, default: 0 },
    { key: "dL", label: "Distância da Lua", unit: "R_T", min: 3, max: 120, step: 0.1, default: 60.3, live: true },
    { key: "mL", label: "Massa da Lua (× a real)", unit: "", min: 0, max: 5, step: 0.1, default: 1, live: true },
    {
      key: "sol",
      label: "Maré solar",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 1,
      live: true,
      options: [
        { value: 1, label: "Incluir o Sol" },
        { value: 0, label: "Só a Lua" },
      ],
    },
    {
      key: "sistema",
      label: "Sistema (referencial girante)",
      unit: "",
      min: 0,
      max: 2,
      step: 1,
      default: 0,
      options: [
        { value: 0, label: "Terra–Lua (μ = 0,01215)" },
        { value: 1, label: "Sol–Júpiter (μ = 0,000954)" },
        { value: 2, label: "μ personalizado" },
      ],
    },
    { key: "mu", label: "μ = M₂/(M₁ + M₂) personalizado", unit: "", min: 0.001, max: 0.5, step: 0.001, default: 0.05, log: true },
    { key: "ponto", label: "Partícula de teste parte de", unit: "", min: 0, max: 5, step: 1, default: 3, options: POINTS.map((label, value) => ({ value, label })) },
    { key: "pert", label: "Deslocamento inicial (em unidades da separação)", unit: "", min: 0, max: 0.1, step: 0.001, default: 0.008 },
  ],

  observables: [
    { key: "h", label: "Altura da maré no observador", unit: "m", value: (s, p) => (modeOf(p) === 0 ? tideHeight(s, p, s.psi) : 0) },
    { key: "amp", label: "Amplitude preamar − baixa-mar", unit: "m", value: (s, p) => (modeOf(p) === 0 ? tideRange(s, p) : 0) },
    {
      key: "aT",
      label: "Aceleração de maré no ponto sub-lunar",
      unit: "m/s²",
      value: (s, p) => {
        const a = tideField(s, p, Math.cos(s.phiL), Math.sin(s.phiL));
        return Math.hypot(a[0], a[1]);
      },
    },
    { key: "x", label: "x da partícula 1", unit: "", value: (s) => part1(s)?.y[0] ?? 0 },
    { key: "y", label: "y da partícula 1", unit: "", value: (s) => part1(s)?.y[1] ?? 0 },
    { key: "CJ", label: "Constante de Jacobi (partícula 1)", unit: "", value: (s, p) => (part1(s) ? jacobi(part1(s)!.y, muOf(p)) : 0) },
    {
      key: "dist",
      label: "Afastamento do ponto de Lagrange",
      unit: "",
      value: (s) => {
        const P = part1(s);
        return P && s.L0 ? Math.hypot(P.y[0]! - s.L0[0], P.y[1]! - s.L0[1]) : 0;
      },
    },
  ],
  conserved: "CJ",
  chart: { x: "t", y: "h" },

  scenarios: [
    {
      id: "sizigia",
      label: "Duas protuberâncias e águas vivas",
      params: { modo: 0, angL: 0, angS: 0, sol: 1, dL: 60.3, mL: 1 },
      guide: `### Por que duas marés altas por dia?
1. As setas mostram $\\vec a_{\\text{maré}}$: a gravidade da Lua em cada ponto **menos** a do centro da Terra. No lado da Lua sobra uma atração para fora; no lado oposto a Terra é "puxada para longe" da água.
2. Rode: o observador gira com a Terra e passa pelas duas protuberâncias em cerca de um dia. Plote **h** contra o tempo (o tempo está em **dias**).
3. Com Sol e Lua alinhados (sizígia) as marés somam: águas vivas. Cerca de 7 dias depois chega a quadratura.
4. Arraste a Lua para mais perto (ou aumente $D_L$) e confira que a maré cai com $1/D^3$, não com $1/D^2$.`,
      predict: [
        {
          question: "O Sol puxa a Terra cerca de 180 vezes mais forte que a Lua. A maré solar, comparada com a lunar, é:",
          options: ["180 vezes maior", "praticamente igual", "cerca de metade", "nula"],
          answer: 2,
          explanation:
            "A maré depende da **diferença** de atração entre os lados da Terra, $\\approx 2GMR/D^3$. O fator $1/D^3$ derruba a vantagem do Sol: $h_{\\text{Sol}}/h_{\\text{Lua}} \\approx 0{,}46$.",
        },
      ],
    },
    {
      id: "quadratura",
      label: "Quadratura: águas mortas",
      params: { modo: 0, angL: 90, angS: 0, sol: 1 },
      guide: `### Lua e Sol em ângulo reto
1. A preamar lunar coincide com a baixa-mar solar: as marés se subtraem.
2. Compare a amplitude com a do cenário de sizígia: a razão é cerca de $(1 - 0{,}46)/(1 + 0{,}46) \\approx 0{,}37$.
3. Desligue o Sol e veja só a maré lunar.`,
    },
    {
      id: "l4",
      label: "L4 estável (Terra–Lua)",
      params: { modo: 1, sistema: 0, ponto: 3, pert: 0.008 },
      guide: `### Um ponto de equilíbrio no alto de um morro
1. No referencial que gira com os dois corpos, $\\Phi_{\\text{ef}}$ tem cinco pontos de equilíbrio. L4 e L5 são **máximos** do potencial efetivo.
2. Mesmo assim a partícula solta perto de L4 fica por perto, em órbitas em forma de girino: a força de Coriolis a mantém lá.
3. A constante de Jacobi $C_J$ se conserva (veja o desvio relativo).
4. Escolha **μ personalizado** acima de $\\mu_c \\approx 0{,}0385$: L4 fica instável. Os asteroides troianos de Júpiter (μ ≈ 0,001) moram em L4 e L5.`,
      predict: [
        {
          question: "Uma partícula solta em repouso um pouco ao lado de L4 (sistema Terra–Lua) vai:",
          options: ["cair na Terra", "se afastar para sempre", "oscilar em torno de L4", "ficar parada"],
          answer: 2,
          explanation:
            "L4 é um máximo de $\\Phi_{\\text{ef}}$, mas para $\\mu < 0{,}0385$ a força de Coriolis transforma o escorregamento em uma libração em torno do ponto.",
        },
      ],
    },
    {
      id: "l1",
      label: "L1 instável",
      params: { modo: 1, sistema: 0, ponto: 0, pert: 0.001 },
      guide: `### Ponto de sela
1. L1, L2 e L3 são pontos de sela de $\\Phi_{\\text{ef}}$: um deslocamento de 0,001 cresce exponencialmente.
2. Plote **Afastamento do ponto de Lagrange** contra o tempo.
3. Mesmo instáveis, L1 e L2 do sistema Sol–Terra são muito usados por telescópios (JWST em L2), com pequenas correções de rota.
4. Clique no palco para soltar outras partículas em repouso e veja as curvas de velocidade zero (níveis de $\\Phi$ em L1, L2 e L3) separarem as regiões acessíveis.`,
    },
  ],

  exercises: [
    {
      id: "aceleracao",
      prompt:
        "Use a aproximação a ≈ 2GMR/D³ para estimar a aceleração de maré causada pela Lua (M = 7,342 × 10²² kg) num ponto da superfície da Terra (R = 6,371 × 10⁶ m) voltado para ela, com a Lua a {dL} raios terrestres.",
      vary: { dL: [30, 90, 1] },
      fixed: { modo: 0, mL: 1 },
      answer: { label: "a", unit: "m/s²", compute: (p) => (2 * GRAV * M_MOON * R_EARTH) / moonDist(p) ** 3 },
      tolerance: 0.02,
    },
    {
      id: "l1",
      prompt:
        "No problema restrito de três corpos com μ = {mu}, a que distância do corpo menor fica o ponto L1, em unidades da separação entre os dois corpos?",
      vary: { mu: [0.001, 0.01, 4] },
      fixed: { modo: 1, sistema: 2 },
      answer: { label: "r", unit: "", compute: (p) => 1 - muOf(p) - lagrangePoints(muOf(p))[0]![0] },
      tolerance: 0.08,
      hint: "Para μ pequeno, r ≈ (μ/3)^(1/3) (raio de Hill).",
    },
  ],

  init(p) {
    const { parts, L0 } = initParticles(p);
    return { phiL: num(p, "angL") * DEG, phiS: num(p, "angS") * DEG, psi: 0, parts, L0, drag: null };
  },
  step(s, p, t, dt) {
    if (modeOf(p) === 0) {
      return {
        ...s,
        phiL: s.drag?.kind === "moon" ? s.phiL : s.phiL + (2 * Math.PI * dt) / T_MOON,
        phiS: s.drag?.kind === "sun" ? s.phiS : s.phiS + (2 * Math.PI * dt) / T_YEAR,
        psi: s.psi + (2 * Math.PI * dt) / T_DAY,
      };
    }
    const mu = muOf(p);
    const parts = s.parts.map((q) => {
      if (q.dead) return q;
      // subpassos perto dos corpos (onde as forças são grandes)
      const r = Math.min(Math.hypot(q.y[0]! + mu, q.y[1]!), Math.hypot(q.y[0]! - 1 + mu, q.y[1]!));
      const n = r < 0.1 ? 8 : 1;
      let y = q.y;
      for (let i = 0; i < n; i++) y = rk4((yy) => cr3bp(yy, mu), y, p, t, dt / n);
      const r1 = Math.hypot(y[0]! + mu, y[1]!), r2 = Math.hypot(y[0]! - 1 + mu, y[1]!);
      const dead = r1 < 0.02 || r2 < 0.006 || Math.hypot(y[0]!, y[1]!) > 5 || !y.every(Number.isFinite);
      return { y, dead };
    });
    return { ...s, parts };
  },
  dt: 0.002,
  sampleEvery: 10,
  maxSamples: 6000,
  tEnd: 400,

  viewport: (p) => viewport(p),

  pointer: {
    down(s, p, pt) {
      if (modeOf(p) === 0) {
        const dm = Math.min(num(p, "dL", 60.3), MOON_VIEW);
        if (Math.hypot(pt.x - dm * Math.cos(s.phiL), pt.y - dm * Math.sin(s.phiL)) < 0.5) return { ...s, drag: { kind: "moon" } };
        if (sunOn(p) && Math.hypot(pt.x - SUN_VIEW * Math.cos(s.phiS), pt.y - SUN_VIEW * Math.sin(s.phiS)) < 0.6) return { ...s, drag: { kind: "sun" } };
        return undefined;
      }
      const mu = muOf(p);
      if (Math.hypot(pt.x + mu, pt.y) < 0.05 || Math.hypot(pt.x - 1 + mu, pt.y) < 0.03) return undefined;
      const parts = [...s.parts, { y: [pt.x, pt.y, 0, 0], dead: false }].slice(-MAX_PARTS);
      return { ...s, parts, L0: s.parts.length === 0 ? null : s.L0 };
    },
    move(s, p, pt, dragging) {
      if (!dragging || !s.drag || modeOf(p) !== 0) return undefined;
      const a = Math.atan2(pt.y, pt.x);
      return s.drag.kind === "moon" ? { ...s, phiL: a } : { ...s, phiS: a };
    },
    up: (s) => (s.drag ? { ...s, drag: null } : undefined),
    cursor(s, p, pt) {
      if (modeOf(p) === 1) return "crosshair";
      const dm = Math.min(num(p, "dL", 60.3), MOON_VIEW);
      if (Math.hypot(pt.x - dm * Math.cos(s.phiL), pt.y - dm * Math.sin(s.phiL)) < 0.5) return "grab";
      if (Math.hypot(pt.x - SUN_VIEW * Math.cos(s.phiS), pt.y - SUN_VIEW * Math.sin(s.phiS)) < 0.6) return "grab";
      return undefined;
    },
  },
  actions: [
    { id: "sizigia", label: "Alinhar Lua e Sol (sizígia)", run: (s) => ({ ...s, phiS: s.phiL }) },
    { id: "quadratura", label: "Lua a 90° do Sol (quadratura)", run: (s) => ({ ...s, phiS: s.phiL - Math.PI / 2 }) },
    { id: "limpar", label: "Limpar partículas", run: (s) => ({ ...s, parts: [], L0: null }) },
  ],

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const { state: s, params: p, theme } = frame;
    const vp = viewport(p);
    const say = (str: string, i: number, color = theme.text, weight = "400") =>
      d.text(str, vp.xMin + 0.08, vp.yMax - 0.2 - i * 0.24 * ((vp.yMax - vp.yMin) / 6.6), { color, size: 12, align: "left", weight });

    if (modeOf(p) === 0) {
      // Campo de maré
      const aRef = (2 * GRAV * M_MOON * R_EARTH) / (60.3 * R_EARTH) ** 3;
      for (const [R, n] of [[1.45, 16], [2.4, 24]] as const) {
        for (let i = 0; i < n; i++) {
          const th = (2 * Math.PI * i) / n;
          const x = R * Math.cos(th), y = R * Math.sin(th);
          const a = tideField(s, p, x, y);
          const m = Math.hypot(a[0], a[1]);
          if (m < 1e-30) continue;
          const len = Math.min((0.32 * m) / aRef, 0.7);
          d.arrow(x, y, (a[0] / m) * len, (a[1] / m) * len, { color: theme.series[3]!, width: 1.4, head: 6, alpha: 0.85 });
        }
      }
      // Oceano deformado (exagerado) e continente
      const hRef = tideScale(M_MOON, 60.3 * R_EARTH);
      const B = 0.16;
      const ocean: [number, number][] = [];
      for (let i = 0; i <= 180; i++) {
        const th = (2 * Math.PI * i) / 180;
        const r = clamp(1.04 + (B * tideHeight(s, p, th)) / hRef, 0.9, 2.0);
        ocean.push([r * Math.cos(th), r * Math.sin(th)]);
      }
      d.polyline(ocean, { close: true, fill: theme.accent, color: theme.accent, alpha: 0.45 });
      d.circle(0, 0, 0.95, { fill: theme.dark ? "#3c5a3a" : "#8fb784", stroke: theme.muted, width: 1 });
      d.text("Terra", 0, -0.35, { color: theme.dark ? "#e6ebf2" : "#1c2430", size: 12, weight: "600" });
      // Observador
      const rObs = clamp(1.04 + (B * tideHeight(s, p, s.psi)) / hRef, 0.9, 2.0);
      d.line(0.95 * Math.cos(s.psi), 0.95 * Math.sin(s.psi), (rObs + 0.12) * Math.cos(s.psi), (rObs + 0.12) * Math.sin(s.psi), { color: theme.text, width: 2 });
      d.dot(rObs * Math.cos(s.psi), rObs * Math.sin(s.psi), 5, theme.positive);
      d.text("observador", (rObs + 0.35) * Math.cos(s.psi), (rObs + 0.35) * Math.sin(s.psi), { color: theme.positive, size: 11 });
      // Lua
      const dLv = num(p, "dL", 60.3);
      const dm = Math.min(dLv, MOON_VIEW);
      const mx = dm * Math.cos(s.phiL), my = dm * Math.sin(s.phiL);
      d.line(0, 0, mx, my, { color: theme.muted, width: 1, dash: [3, 5] });
      d.circle(mx, my, 0.27, { fill: theme.dark ? "#c9ced6" : "#9aa3ad", stroke: theme.text, width: 1 });
      d.text(dLv > MOON_VIEW ? `Lua (${fmt(dLv, 1)} R_T, fora de escala)` : "Lua", mx, my - 0.45, { color: theme.text, size: 11 });
      // Sol (só a direção)
      if (sunOn(p)) {
        const sx = SUN_VIEW * Math.cos(s.phiS), sy = SUN_VIEW * Math.sin(s.phiS);
        const cx = clamp(sx, vp.xMin + 0.35, vp.xMax - 0.35), cy = clamp(sy, vp.yMin + 0.35, vp.yMax - 0.35);
        for (let k = 0; k < 8; k++) {
          const a = (k * Math.PI) / 4;
          d.line(cx + 0.27 * Math.cos(a), cy + 0.27 * Math.sin(a), cx + 0.4 * Math.cos(a), cy + 0.4 * Math.sin(a), { color: "#e0a400", width: 2 });
        }
        d.circle(cx, cy, 0.22, { fill: "#f2c230", stroke: "#c98f00", width: 1 });
        d.text("Sol (direção)", cx, cy - 0.55, { color: theme.text, size: 11 });
      }
      const h = tideHeight(s, p, s.psi);
      say(phaseText(s, p), 0, theme.text, "600");
      say(`t = ${fmt(frame.t, 2)} dias   maré no observador: ${h >= 0 ? "+" : ""}${fmt(h, 2)} m`, 1);
      say(`preamar − baixa-mar = ${fmt(tideRange(s, p), 2)} m (maré de equilíbrio)`, 2, theme.muted);
      d.text("setas: aceleração de maré = g da Lua/Sol no ponto − g no centro da Terra", vp.xMax - 0.08, vp.yMin + 0.4, { color: theme.series[3]!, size: 11, align: "right" });
      d.text(`oceano exagerado cerca de ${fmt((B * R_EARTH) / hRef / 1e6, 1)} milhões de vezes · arraste a Lua e o Sol`, vp.xMax - 0.08, vp.yMin + 0.15, { color: theme.muted, size: 11, align: "right" });
      return;
    }

    // ---------------- Referencial girante
    const mu = muOf(p);
    const LP = lagrangePoints(mu);
    potentialMap(d.ctx, mu, vp, theme.accent, theme.dark, (x0, y0, w, h, alpha) => d.rect(x0, y0, w, h, { fill: theme.accent, alpha }));
    const f = (x: number, y: number) => phiEff(x, y, mu);
    const levels: [number, string][] = [
      [phiEff(LP[0]![0], 0, mu), theme.series[1]!],
      [phiEff(LP[1]![0], 0, mu), theme.series[3]!],
      [phiEff(LP[2]![0], 0, mu), theme.series[4]!],
    ];
    for (const [lev, color] of levels) for (const g of contour(f, lev, vp.xMin, vp.xMax, vp.yMin, vp.yMax, 140, 104)) d.line(g[0], g[1], g[2], g[3], { color, width: 1.3 });
    const names = ["Terra", "Lua"];
    const sys = Math.round(num(p, "sistema"));
    if (sys === 1) names.splice(0, 2, "Sol", "Júpiter");
    if (sys === 2) names.splice(0, 2, "M₁", "M₂");
    d.circle(-mu, 0, 0.07, { fill: theme.series[0]!, stroke: theme.text, width: 1 });
    d.circle(1 - mu, 0, 0.035, { fill: theme.series[2]!, stroke: theme.text, width: 1, minPx: 4 });
    d.text(names[0]!, -mu, -0.15, { color: theme.text, size: 11 });
    d.text(names[1]!, 1 - mu, -0.12, { color: theme.text, size: 11 });
    LP.forEach((q, i) => {
      d.circle(q[0], q[1], 0.02, { stroke: theme.text, width: 1.5, minPx: 4 });
      d.text(`L${i + 1}`, q[0], q[1], { color: theme.text, size: 12, weight: "600", dy: -12 });
    });
    // Trajetórias das partículas
    const tr = frame.trail;
    const n0 = Math.max(0, tr.length - 4000);
    s.parts.forEach((P, k) => {
      const pts: [number, number][] = [];
      for (let i = n0; i < tr.length; i++) {
        const q = tr[i]!.parts[k];
        if (q) pts.push([q.y[0]!, q.y[1]!]);
      }
      pts.push([P.y[0]!, P.y[1]!]);
      const color = theme.series[(k + 5) % theme.series.length]!;
      d.polyline(pts.filter(([x, y]) => x > vp.xMin && x < vp.xMax && y > vp.yMin && y < vp.yMax), { color, width: 1.4 });
      if (P.y[0]! > vp.xMin && P.y[0]! < vp.xMax && P.y[1]! > vp.yMin && P.y[1]! < vp.yMax) d.dot(P.y[0]!, P.y[1]!, 4, P.dead ? theme.muted : color);
    });
    say(`μ = ${fmt(mu, 5)}   L4/L5 ${mu < MU_ROUTH ? "estáveis" : "instáveis"} (μc = 0,0385)`, 0, mu < MU_ROUTH ? theme.series[2]! : theme.positive, "600");
    const P = part1(s);
    if (P) say(`partícula 1: C_J = ${fmt(jacobi(P.y, mu), 5)}${P.dead ? " (colidiu ou escapou)" : ""}`, 1);
    say("curvas: Φ_ef nos níveis de L1, L2 e L3 · clique para soltar partículas", 2, theme.muted);
    d.text("cor mais forte = Φ_ef mais alto (L4 e L5 são máximos)", vp.xMax - 0.05, vp.yMin + 0.08, { color: theme.muted, size: 11, align: "right" });
  },
});

export default maresLagrange;
