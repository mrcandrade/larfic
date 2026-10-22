import {
  add3,
  clamp,
  cross3,
  defineSim,
  dot3,
  draw,
  norm3,
  num,
  orbit,
  polyline3d,
  projector,
  renderFaces,
  rk4,
  scale3,
  texNum,
  type Face,
  type Params,
  type State,
  type V3,
} from "@fisilab/core";

/**
 * Corpo rígido simétrico (disco de massa M e raio R num eixo leve) com um ponto
 * fixo a uma distância l do centro de massa. As equações de Euler do corpo
 * simétrico são escritas no referencial do laboratório, sem ângulos de Euler
 * (e portanto sem a singularidade em θ = 0):
 *
 *   ω = L/I₁ + (1/I₃ − 1/I₁)(L·ê)ê,   dê/dt = ω × ê,   dL/dt = τ = l ê × (−M g ẑ).
 *
 * O estado vetorial é [ê (3), b̂ (3), L (3)], em que b̂ é um vetor marcado no disco
 * (gira com ele e mostra a rotação própria).
 */

export interface Cam {
  yaw: number;
  pitch: number;
}

export interface GyroState {
  y: number[];
  /** Ângulo de precessão acumulado (rad), sem saltos de 2π. */
  phiU: number;
  cam: Cam;
  drag: { x0: number; y0: number; cam0: Cam } | null;
}

export interface Inertia {
  I1: number;
  I3: number;
  /** Torque gravitacional máximo M g l (N·m); zero no corpo livre. */
  Mgl: number;
}

export const modeOf = (p: Params) => Math.round(num(p, "modo"));

/** Momentos de inércia do disco: I₃ = MR²/2 e I₁ = MR²/4 + Ml² (em relação ao ponto fixo). */
export function inertia(p: Params): Inertia {
  const M = num(p, "M", 0.5);
  const R = num(p, "R", 0.05);
  const l = num(p, "l", 0.08);
  const g = num(p, "g", 9.81);
  const I3 = 0.5 * M * R * R;
  if (modeOf(p) === 1) return { I1: 0.25 * M * R * R, I3, Mgl: 0 };
  return { I1: 0.25 * M * R * R + M * l * l, I3, Mgl: M * g * l };
}

/** Precessão do giroscópio rápido: Ω = M g l / (I₃ ω₃). */
export function omegaFast(p: Params): number {
  const { I3, Mgl } = inertia(p);
  const w3 = num(p, "w3", 200);
  return w3 === 0 ? 0 : Mgl / (I3 * w3);
}

/**
 * Taxa de precessão estacionária lenta (sem nutação), raiz menor de
 * I₁ cosθ φ̇² − I₃ω₃ φ̇ + M g l = 0. NaN quando não existe (pião lento demais).
 */
export function omegaSteady(p: Params, theta = (num(p, "theta0", 60) * Math.PI) / 180): number {
  const { I1, I3, Mgl } = inertia(p);
  const a = I3 * num(p, "w3", 200);
  const disc = a * a - 4 * I1 * Mgl * Math.cos(theta);
  if (disc < 0) return NaN;
  const den = a + Math.sign(a || 1) * Math.sqrt(disc);
  return den === 0 ? NaN : (2 * Mgl) / den;
}

/** Velocidade de rotação mínima para existir precessão estacionária no ângulo θ. */
export function w3Min(p: Params, theta = (num(p, "theta0", 60) * Math.PI) / 180): number {
  const { I1, I3, Mgl } = inertia(p);
  const c = Math.cos(theta);
  return c <= 0 ? 0 : (2 * Math.sqrt(I1 * Mgl * c)) / I3;
}

const vec = (y: readonly number[], i: number): V3 => [y[i]!, y[i + 1]!, y[i + 2]!];

/** ω a partir de L e do eixo de simetria ê (corpo simétrico). */
export function omegaVec(y: readonly number[], k: Inertia): V3 {
  const e = vec(y, 0), L = vec(y, 6);
  const Lp = dot3(L, e);
  return add3(scale3(L, 1 / k.I1), scale3(e, Lp * (1 / k.I3 - 1 / k.I1)));
}

export function torque(y: readonly number[], k: Inertia): V3 {
  // τ = l ê × (−M g ẑ) = M g l (−e_y, e_x, 0)
  return [-k.Mgl * y[1]!, k.Mgl * y[0]!, 0];
}

export function deriv(y: State, k: Inertia): State {
  const w = omegaVec(y, k);
  const de = cross3(w, vec(y, 0));
  const db = cross3(w, vec(y, 3));
  const tau = torque(y, k);
  return [...de, ...db, ...tau];
}

export function energy(y: readonly number[], k: Inertia): number {
  return 0.5 * dot3(omegaVec(y, k), vec(y, 6)) + k.Mgl * y[2]!;
}

/** Taxa instantânea de precessão (azimute de ê em torno de z). */
export function phiDot(y: readonly number[], k: Inertia): number {
  const de = deriv(y as State, k);
  const r2 = y[0]! ** 2 + y[1]! ** 2;
  return r2 < 1e-14 ? 0 : (y[0]! * de[1]! - y[1]! * de[0]!) / r2;
}

const LANC = [
  "Solto do repouso (φ̇₀ = 0)",
  "Precessão estacionária (sem nutação)",
  "Empurrado a favor (φ̇₀ = 2Ω)",
  "Empurrado contra (φ̇₀ = −Ω)",
];

export function initialY(p: Params): number[] {
  const k = inertia(p);
  const w3 = num(p, "w3", 200);
  const free = modeOf(p) === 1;
  const th = (clamp(num(p, "theta0", 60), 0, free ? 80 : 150) * Math.PI) / 180;
  const e: V3 = [Math.sin(th), 0, Math.cos(th)];
  const b: V3 = [Math.cos(th), 0, -Math.sin(th)];
  if (free) {
    // L vertical e ê inclinado θ₀: o eixo descreve um cone em torno de L.
    return [...e, ...b, 0, 0, (k.I3 * w3) / Math.cos(th)];
  }
  const W = omegaFast(p);
  const l = Math.round(num(p, "lanc"));
  let pd = 0;
  if (l === 1) {
    const s = omegaSteady(p, th);
    pd = Number.isFinite(s) ? s : 0;
  } else if (l === 2) pd = 2 * W;
  else if (l === 3) pd = -W;
  // ω = φ̇ ẑ + ψ̇ ê, com ω·ê = ω₃: L = I₁ φ̇ (ẑ − cosθ ê) + I₃ ω₃ ê
  const zPerp = add3([0, 0, 1], scale3(e, -Math.cos(th)));
  const L = add3(scale3(zPerp, k.I1 * pd), scale3(e, k.I3 * w3));
  return [...e, ...b, ...L];
}

const fmt = (v: number, n: number) => v.toFixed(n).replace(".", ",");
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const defaultCam = (): Cam => ({ yaw: 0.6, pitch: 0.32 });

export const thetaOf = (y: readonly number[]) => (Math.acos(clamp(y[2]!, -1, 1)) * 180) / Math.PI;

export const giroscopio = defineSim<GyroState>({
  id: "giroscopio",
  title: "Giroscópio, pião e precessão",
  course: "FG I",
  topic: "Rotação",
  priority: "P3",
  summary:
    "Pião simétrico em 3D resolvido pelas equações de Euler: precessão, nutação e laços do eixo, comparados com a aproximação do giroscópio rápido Ω = Mgl/(I₃ω₃).",
  equations: [
    String.raw`\frac{d\vec L}{dt} = \vec\tau = \vec r_{cm}\times M\vec g \qquad \vec L = I_1\vec\omega_\perp + I_3\,\omega_3\,\hat e`,
    String.raw`\frac{d\hat e}{dt} = \vec\omega\times\hat e \qquad \vec\omega = \frac{\vec L}{I_1} + \Big(\frac{1}{I_3}-\frac{1}{I_1}\Big)(\vec L\cdot\hat e)\,\hat e`,
    String.raw`\Omega \approx \frac{M g l}{I_3\,\omega_3}\quad(\text{giroscópio rápido}) \qquad I_1\cos\theta\,\dot\phi^2 - I_3\omega_3\,\dot\phi + Mgl = 0`,
  ],
  liveEquations(s, p, t) {
    const k = inertia(p);
    if (modeOf(p) === 1) {
      const L = norm3(vec(s.y, 6));
      return [
        String.raw`|\vec L| = ${texNum(L)}\ \text{kg·m²/s} \qquad \Omega_{\text{cone}} = \frac{|\vec L|}{I_1} = ${texNum(L / k.I1)}\ \text{rad/s}`,
        String.raw`\frac{I_3}{I_1} = ${texNum(k.I3 / k.I1)} \qquad \omega_3 = ${texNum(dot3(vec(s.y, 6), vec(s.y, 0)) / k.I3)}\ \text{rad/s}`,
      ];
    }
    const W = omegaFast(p);
    const avg = t > 0 ? s.phiU / t : phiDot(s.y, k);
    const st = omegaSteady(p);
    return [
      String.raw`\Omega = \frac{M g l}{I_3\omega_3} = \frac{${texNum(k.Mgl)}}{${texNum(k.I3)}\cdot ${texNum(num(p, "w3", 200))}} = ${texNum(W)}\ \text{rad/s}`,
      String.raw`\dot\phi_{\text{estac.}} = ${Number.isFinite(st) ? texNum(st) : String.raw`\text{não existe}`}\ \text{rad/s} \qquad \langle\dot\phi\rangle_{\text{medido}} = ${texNum(avg)}\ \text{rad/s}`,
      String.raw`\theta = ${texNum(thetaOf(s.y))}^\circ \qquad E = ${texNum(energy(s.y, k))}\ \text{J}`,
    ];
  },

  params: [
    {
      key: "modo",
      label: "Situação",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 0,
      options: [
        { value: 0, label: "Pião/giroscópio com ponto fixo (gravidade)" },
        { value: 1, label: "Corpo livre, sem torque (bamboleio)" },
      ],
    },
    { key: "w3", label: "Rotação própria ω₃", unit: "rad/s", min: 10, max: 800, step: 5, default: 250 },
    { key: "theta0", label: "Inclinação inicial θ₀", unit: "°", min: 5, max: 120, step: 1, default: 60 },
    { key: "lanc", label: "Lançamento", unit: "", min: 0, max: 3, step: 1, default: 0, options: LANC.map((label, value) => ({ value, label })) },
    { key: "M", label: "Massa do disco M", unit: "kg", min: 0.1, max: 2, step: 0.05, default: 0.5 },
    { key: "R", label: "Raio do disco R", unit: "m", min: 0.02, max: 0.1, step: 0.005, default: 0.05 },
    { key: "l", label: "Distância ponto fixo–centro l", unit: "m", min: 0.02, max: 0.15, step: 0.005, default: 0.08 },
    { key: "g", label: "Gravidade", unit: "m/s²", min: 0, max: 25, step: 0.01, default: 9.81 },
    {
      key: "vetores",
      label: "Vetores",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 1,
      live: true,
      options: [
        { value: 1, label: "Mostrar L, ω e τ" },
        { value: 0, label: "Esconder" },
      ],
    },
    {
      key: "aprox",
      label: "Eixo da aproximação Ω = Mgl/(I₃ω₃)",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 1,
      live: true,
      options: [
        { value: 1, label: "Mostrar" },
        { value: 0, label: "Esconder" },
      ],
    },
  ],

  observables: [
    { key: "theta", label: "Inclinação θ (nutação)", unit: "°", value: (s) => thetaOf(s.y) },
    { key: "phi", label: "Ângulo de precessão φ", unit: "°", value: (s) => (s.phiU * 180) / Math.PI },
    { key: "phidot", label: "Taxa de precessão φ̇", unit: "rad/s", value: (s, p) => phiDot(s.y, inertia(p)) },
    { key: "phiMed", label: "φ̇ médio desde t = 0", unit: "rad/s", value: (s, p, t) => (t > 0 ? s.phiU / t : phiDot(s.y, inertia(p))) },
    { key: "Omega", label: "Ω = Mgl/(I₃ω₃)", unit: "rad/s", value: (_s, p) => omegaFast(p) },
    { key: "w3", label: "Rotação própria ω₃", unit: "rad/s", value: (s, p) => dot3(vec(s.y, 6), vec(s.y, 0)) / inertia(p).I3 },
    { key: "Lz", label: "L_z", unit: "kg·m²/s", value: (s) => s.y[8]! },
    { key: "E", label: "Energia", unit: "J", value: (s, p) => energy(s.y, inertia(p)) },
  ],
  conserved: "E",
  chart: { x: "t", y: "theta" },

  scenarios: [
    {
      id: "rapido",
      label: "Giroscópio rápido",
      params: { modo: 0, w3: 400, theta0: 70, lanc: 1 },
      guide: `### Precessão estacionária
1. O torque do peso, $\\vec\\tau = \\vec r_{cm}\\times M\\vec g$, é **horizontal** e perpendicular a $\\vec L$: ele não derruba o disco, gira $\\vec L$.
2. Arraste o fundo para girar a câmera. Veja $\\vec L$ (quase sobre o eixo), $\\vec\\omega$ e $\\vec\\tau$.
3. Compare $\\langle\\dot\\phi\\rangle$ medido com $\\Omega = Mgl/(I_3\\omega_3)$ nas equações vivas.
4. Dobre $\\omega_3$ e confira que $\\Omega$ cai pela metade. Mude $\\theta_0$: a taxa de precessão quase não depende da inclinação.`,
      predict: [
        {
          question: "Se a rotação própria ω₃ dobrar, a velocidade de precessão Ω:",
          options: ["dobra", "cai pela metade", "não muda", "cai para um quarto"],
          answer: 1,
          explanation:
            "Em $dt$ o torque muda $\\vec L$ de $\\tau\\,dt$ na horizontal, então $\\Omega = \\tau/(L\\sin\\theta) = Mgl/(I_3\\omega_3)$. Com $L$ duas vezes maior, o mesmo torque gira o vetor duas vezes mais devagar.",
        },
      ],
    },
    {
      id: "nutacao",
      label: "Solto do repouso: nutação",
      params: { modo: 0, w3: 150, theta0: 60, lanc: 0 },
      guide: `### Nutação
1. O eixo é solto sem velocidade de precessão. A ponta do eixo desenha **cúspides**: ela cai um pouco, ganha velocidade de precessão e volta a parar.
2. Plote **θ** contra o tempo: a oscilação rápida é a nutação, com frequência perto de $I_3\\omega_3/I_1$.
3. O **φ̇ médio** é próximo de $\\Omega = Mgl/(I_3\\omega_3)$, mas não igual: a aproximação vale quando $I_3\\omega_3 \\gg \\sqrt{I_1 Mgl}$.
4. Troque **Lançamento** para "Empurrado contra": a ponta passa a desenhar **laços**. Com "a favor", ondas.`,
      predict: [
        {
          question: "O eixo do giroscópio é solto inclinado, sem empurrão lateral. O que acontece?",
          options: [
            "Cai até o chão como um corpo sem rotação",
            "Começa a precessar na mesma altura, sem descer nada",
            "Desce um pouco, oscila para cima e para baixo (nutação) enquanto precessa",
            "Sobe até ficar na vertical",
          ],
          answer: 2,
          explanation:
            "Para precessar, $\\vec L$ precisa de uma componente vertical extra $I_1\\dot\\phi$, que só aparece se o eixo descer um pouco (conservação de $L_z$ e da energia). O eixo cai, passa do ponto de equilíbrio e volta: é a nutação, que aqui não é amortecida.",
        },
      ],
    },
    {
      id: "lento",
      label: "Pião lento",
      params: { modo: 0, w3: 45, theta0: 35, lanc: 0 },
      guide: `### Quando a aproximação falha
1. Com $\\omega_3$ pequeno a nutação é enorme e a precessão média se afasta de $Mgl/(I_3\\omega_3)$.
2. A velocidade mínima para existir precessão estacionária é $\\omega_3 \\ge 2\\sqrt{I_1 Mgl\\cos\\theta}/I_3$ (veja a equação de segundo grau em $\\dot\\phi$).
3. A energia e $L_z$ continuam conservados: as equações de Euler são exatas, só a aproximação é que deixou de valer.`,
    },
    {
      id: "livre",
      label: "Corpo livre: bamboleio",
      params: { modo: 1, w3: 60, theta0: 15 },
      guide: `### Sem torque, $\\vec L$ é constante
1. Sem gravidade nem ponto fixo, $\\vec L$ fica parado (vertical). O eixo de simetria e $\\vec\\omega$ giram em cones em torno de $\\vec L$.
2. As equações de Euler dão a frequência do cone no laboratório: $\\Omega = |\\vec L|/I_1$.
3. Para um disco fino, $I_3 = 2I_1$: o bamboleio é cerca de **duas vezes mais rápido** que a rotação própria, como no prato de Feynman.`,
    },
  ],

  exercises: [
    {
      id: "precessao",
      prompt:
        "Um giroscópio é um disco uniforme de raio {R} m girando a {w3} rad/s, com o centro a {l} m do ponto de apoio (g = 9,81 m/s²). Qual é a velocidade angular de precessão (aproximação do giroscópio rápido)?",
      vary: { R: [0.03, 0.08, 3], w3: [150, 600, 0], l: [0.04, 0.12, 2] },
      fixed: { modo: 0, M: 0.5, g: 9.81 },
      answer: { label: "Ω", unit: "rad/s", compute: (p) => omegaFast(p) },
      hint: "Ω = Mgl/(I₃ω₃) com I₃ = MR²/2: a massa se cancela.",
    },
    {
      id: "periodo",
      prompt:
        "Um disco de {M} kg e raio {R} m gira a {w3} rad/s num eixo apoiado a {l} m do centro (g = 9,81 m/s²). Quanto tempo leva uma volta completa de precessão?",
      vary: { M: [0.2, 1.5, 2], R: [0.03, 0.08, 3], w3: [200, 800, 0], l: [0.04, 0.12, 2] },
      fixed: { modo: 0, g: 9.81 },
      answer: { label: "T", unit: "s", compute: (p) => (2 * Math.PI) / omegaFast(p) },
      hint: "T = 2π/Ω.",
    },
  ],

  init(p) {
    return { y: initialY(p), phiU: 0, cam: defaultCam(), drag: null };
  },
  step(s, p, t, dt) {
    const k = inertia(p);
    const y = rk4((yy) => deriv(yy, k), s.y, p, t, dt);
    // Corrige a deriva de normalização de ê e b̂ (b̂ ⟂ ê).
    const e = vec(y, 0);
    const ne = norm3(e);
    const eu = scale3(e, 1 / ne);
    let b = vec(y, 3);
    b = add3(b, scale3(eu, -dot3(b, eu)));
    const bu = scale3(b, 1 / (norm3(b) || 1));
    const out = [...eu, ...bu, y[6]!, y[7]!, y[8]!];
    const dphi = wrap(Math.atan2(out[1]!, out[0]!) - Math.atan2(s.y[1]!, s.y[0]!));
    return { ...s, y: out, phiU: s.phiU + dphi };
  },
  dt: 2e-4,
  sampleEvery: 5,
  tEnd: 120,

  viewport: () => ({ xMin: -1.9, xMax: 1.9, yMin: -1.35, yMax: 1.65 }),

  pointer: {
    down: (s, _p, pt) => ({ ...s, drag: { x0: pt.x, y0: pt.y, cam0: s.cam } }),
    move(s, _p, pt, dragging) {
      if (!dragging || !s.drag) return undefined;
      const c = orbit(s.drag.cam0, (pt.x - s.drag.x0) * 150, -(pt.y - s.drag.y0) * 150);
      return { ...s, cam: { yaw: c.yaw, pitch: c.pitch } };
    },
    up: (s) => (s.drag ? { ...s, drag: null } : undefined),
    cursor: () => "grab",
  },
  actions: [
    { id: "cima", label: "Vista de cima", run: (s) => ({ ...s, cam: { yaw: s.cam.yaw, pitch: 1.5 } }) },
    { id: "lado", label: "Vista lateral", run: (s) => ({ ...s, cam: { yaw: s.cam.yaw, pitch: 0.05 } }) },
    { id: "padrao", label: "Vista padrão", run: (s) => ({ ...s, cam: defaultCam() }) },
  ],

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const { state: s, params: p, theme, t } = frame;
    const free = modeOf(p) === 1;
    const k = inertia(p);
    const R = num(p, "R", 0.05);
    const l = free ? 0 : num(p, "l", 0.08);
    const span = free ? 1.7 * R : l + R;
    const pr = projector({ yaw: s.cam.yaw, pitch: s.cam.pitch, zoom: 1 / span });
    const P = (v: V3) => pr.project(v);
    const line3 = (a: V3, b: V3, color: string, width = 1.5, dash?: number[], alpha = 1) => {
      const qa = P(a), qb = P(b);
      d.line(qa[0], qa[1], qb[0], qb[1], { color, width, dash, alpha });
    };
    const arrow3 = (a: V3, b: V3, color: string, label: string) => {
      const qa = P(a), qb = P(b);
      d.arrow(qa[0], qa[1], qb[0] - qa[0], qb[1] - qa[1], { color, width: 2.5 });
      d.text(label, qb[0], qb[1], { color, size: 13, weight: "600", dx: 10, dy: -8 });
    };

    const e = vec(s.y, 0), b = vec(s.y, 3), L = vec(s.y, 6);
    const C = scale3(e, l);

    // Piso de referência (círculo horizontal) e suporte
    const floorZ = free ? -1.1 * span : -0.95 * span;
    const ring = (rad: number, z: number, cx = 0, cy = 0): V3[] =>
      Array.from({ length: 49 }, (_, i) => [cx + rad * Math.cos((i * Math.PI) / 24), cy + rad * Math.sin((i * Math.PI) / 24), z] as V3);
    polyline3d(d, pr, ring(1.1 * span, floorZ), { color: theme.grid, width: 1 });
    for (const a of [0, Math.PI / 2]) line3([-1.1 * span * Math.cos(a), -1.1 * span * Math.sin(a), floorZ], [1.1 * span * Math.cos(a), 1.1 * span * Math.sin(a), floorZ], theme.grid, 1);
    const xq = P([1.25 * span, 0, floorZ]);
    d.text("x", xq[0], xq[1], { color: theme.muted, size: 11 });
    if (!free) {
      line3([0, 0, floorZ], [0, 0, 0], theme.muted, 5);
      polyline3d(d, pr, ring(0.25 * span, floorZ), { color: theme.muted, width: 2 });
      // cone de precessão (inclinação inicial) e eixo da aproximação do giroscópio rápido
      const th0 = (num(p, "theta0", 60) * Math.PI) / 180;
      if (num(p, "aprox", 1) > 0.5) {
        polyline3d(d, pr, ring(span * Math.sin(th0), span * Math.cos(th0)), { color: theme.muted, width: 1, dash: [3, 4] });
        const ph = omegaFast(p) * t;
        const ea: V3 = [Math.sin(th0) * Math.cos(ph), Math.sin(th0) * Math.sin(ph), Math.cos(th0)];
        line3([0, 0, 0], scale3(ea, span), theme.series[5]!, 2, [6, 4], 0.9);
        const qa = P(scale3(ea, span));
        d.dot(qa[0], qa[1], 4, theme.series[5]!, 0.9);
      }
    } else {
      polyline3d(d, pr, ring(0.25 * span, floorZ), { color: theme.grid, width: 1 });
    }

    // Rastro da ponta do eixo
    const tr = frame.trail;
    const n0 = Math.max(0, tr.length - 1500);
    const tip: V3[] = [];
    for (let i = n0; i < tr.length; i++) tip.push(scale3(vec(tr[i]!.y, 0), span));
    tip.push(scale3(e, span));
    polyline3d(d, pr, tip, { color: theme.accent, width: 1.5 });

    // Eixo (parte de trás do disco)
    line3(scale3(e, -0.2 * span), C, theme.text, 3);

    // Disco: duas metades coloridas para ver a rotação própria
    const v = cross3(e, b);
    const h = 0.08 * R;
    const N = 24;
    const rim = (i: number, side: number): V3 => {
      const a = (2 * Math.PI * i) / N;
      return add3(add3(C, scale3(e, side * h)), add3(scale3(b, R * Math.cos(a)), scale3(v, R * Math.sin(a))));
    };
    const c1 = theme.series[1]!, c2 = theme.series[0]!;
    const faces: Face[] = [];
    for (let i = 0; i < N; i++) {
      const col = i < N / 2 ? c1 : c2;
      faces.push({ pts: [add3(C, scale3(e, h)), rim(i, 1), rim(i + 1, 1)], color: col });
      faces.push({ pts: [add3(C, scale3(e, -h)), rim(i + 1, -1), rim(i, -1)], color: col });
      faces.push({ pts: [rim(i, 1), rim(i, -1), rim(i + 1, -1), rim(i + 1, 1)], color: "#8a93a3" });
    }
    renderFaces(d, pr, faces, { ambient: 0.5 });
    // Ponta do eixo na frente do disco
    line3(C, add3(C, scale3(e, 0.35 * R + 0.1 * span)), theme.text, 3);
    const q0 = P([0, 0, 0]);
    d.dot(q0[0], q0[1], 4, theme.text);

    // Vetores L, ω e τ, desenhados a partir do ponto fixo (comprimentos de exibição)
    if (num(p, "vetores", 1) > 0.5) {
      const w = omegaVec(s.y, k);
      const nL = norm3(L), nw = norm3(w);
      if (nL > 0) arrow3([0, 0, 0], scale3(L, (1.45 * span) / nL), theme.series[2]!, "L");
      if (nw > 0) arrow3([0, 0, 0], scale3(w, (1.15 * span) / nw), theme.series[4]!, "ω");
      const tau = torque(s.y, k);
      const nt = norm3(tau);
      if (nt > 1e-12 && k.Mgl > 0) arrow3([0, 0, 0], scale3(tau, (0.8 * span) / k.Mgl), theme.series[3]!, "τ");
      if (!free && nL > 0) {
        // componente horizontal de L (muda na direção de τ)
        const Lh: V3 = [L[0], L[1], 0];
        const Lt = scale3(L, (1.45 * span) / nL);
        line3(Lt, [Lt[0], Lt[1], 0], theme.series[2]!, 1, [2, 4], 0.6);
        line3([0, 0, 0], scale3(Lh, (1.45 * span) / nL), theme.series[2]!, 1, [2, 4], 0.6);
      }
    }

    // Legenda e leituras
    const x0 = -1.85, y0 = 1.55;
    const line = (str: string, i: number, color = theme.text) => d.text(str, x0, y0 - i * 0.12, { color, size: 12, align: "left" });
    const avg = t > 0 ? s.phiU / t : phiDot(s.y, k);
    line(`θ = ${fmt(thetaOf(s.y), 1)}°   ω₃ = ${fmt((dot3(L, e) / k.I3), 0)} rad/s`, 0);
    if (!free) {
      line(`φ̇ médio = ${fmt(avg, 3)} rad/s`, 1, theme.accent);
      line(`Ω = Mgl/(I₃ω₃) = ${fmt(omegaFast(p), 3)} rad/s`, 2, theme.series[5]);
      const wm = w3Min(p);
      if (num(p, "w3", 200) < wm) line(`ω₃ abaixo de ${fmt(wm, 0)} rad/s: não há precessão estacionária`, 3, theme.positive);
    } else {
      line(`|L|/I₁ = ${fmt((norm3(L) / k.I1), 2)} rad/s (cone em torno de L)`, 1, theme.accent);
    }
    const lg = (str: string, color: string, i: number) => {
      const y = -1.25 + i * 0.12;
      d.line(x0, y, x0 + 0.12, y, { color, width: 3 });
      d.text(str, x0 + 0.17, y, { color: theme.muted, size: 11, align: "left" });
    };
    lg("L (momento angular)", theme.series[2]!, free ? 2 : 3);
    lg("ω (velocidade angular)", theme.series[4]!, free ? 1 : 2);
    if (!free) lg("τ (torque do peso)", theme.series[3]!, 1);
    lg("rastro da ponta do eixo", theme.accent, 0);
    d.text("arraste para girar a câmera", 1.85, -1.27, { color: theme.muted, size: 11, align: "right" });
  },
});

export default giroscopio;
