import {
  clamp,
  defineSim,
  draw,
  drawAxes3d,
  num,
  orbit,
  polyline3d,
  projector,
  renderFaces,
  sphere,
  texNum,
  type Draw,
  type Face,
  type Params,
  type Projector,
  type V3,
} from "@fisilab/core";

// ---------------------------------------------------------------------------
// Modos e constantes
// ---------------------------------------------------------------------------

export const MODOS = ["Berço de Newton", "Onda de pêndulos (dança)", "Pêndulo de torção", "Pêndulo esférico / cônico (3D)", "Pêndulo com prego"];
export const BERCO = 0, ONDA = 1, TORCAO = 2, ESFERICO = 3, PREGO = 4;

/** Raio das esferas do berço (m). */
export const R_BOLA = 0.02;
/** Haste de torção: massa e comprimento fixos (barra que segura as massas). */
export const BARRA_M = 0.1, BARRA_L = 0.4;
/** Materiais do fio de torção: módulo de cisalhamento G (Pa). */
export const MATERIAIS = [
  { label: "Aço (G = 79 GPa)", G: 79e9 },
  { label: "Latão (G = 37 GPa)", G: 37e9 },
  { label: "Cobre (G = 45 GPa)", G: 45e9 },
  { label: "Tungstênio (G = 161 GPa)", G: 161e9 },
  { label: "Náilon (G = 0,9 GPa)", G: 0.9e9 },
];

export const modeOf = (p: Params) => Math.round(num(p, "modo"));
const g = (p: Params) => num(p, "g", 9.81);
const nBalls = (p: Params) => clamp(Math.round(num(p, "N", 5)), 2, 7);
const nWave = (p: Params) => clamp(Math.round(num(p, "N", 15)), 2, 24);

interface Cam {
  yaw: number;
  pitch: number;
}
type Drag = { kind: "cam"; x0: number; y0: number; cam0: Cam } | { kind: "bola"; i: number } | { kind: "prego" };

/** Medidas de bancada acumuladas durante a simulação. */
export interface Meas {
  /** Sinal anterior da coordenada usada para cronometrar. */
  prev: number;
  /** Instante do último cruzamento ascendente por zero. */
  last: number;
  /** Último período medido (s); 0 enquanto não houver dois cruzamentos. */
  T: number;
  /** Número de cruzamentos registrados. */
  n: number;
  /** Esférico: produto escalar r·v anterior (detecta apsides). */
  rv: number;
  /** Esférico: azimute do último apside (rad) e instante. */
  apse: number;
  apseT: number;
  /** Esférico: precessão medida por meia oscilação (rad), média acumulada. */
  prec: number;
  nApse: number;
  /** Esférico: azimute desenrolado (rad). */
  phi: number;
}

export interface PState {
  /** Coordenadas do modo atual (veja init). */
  y: number[];
  cam: Cam;
  drag: Drag | null;
  meas: Meas;
}

const newMeas = (): Meas => ({ prev: 0, last: -1, T: 0, n: 0, rv: 0, apse: NaN, apseT: 0, prec: 0, nApse: 0, phi: 0 });
const defaultCam = (): Cam => ({ yaw: 0.6, pitch: 0.3 });

// ---------------------------------------------------------------------------
// Física: onda de pêndulos
// ---------------------------------------------------------------------------

/** ω do pêndulo n (n = 0 é o mais longo): faz K + n oscilações no ciclo Γ. */
export const waveOmega = (p: Params, n: number) => (2 * Math.PI * (num(p, "K", 51) + n)) / num(p, "Gamma", 60);
/** Comprimento que dá esse ω: L = g/ω². */
export const waveLength = (p: Params, n: number) => g(p) / waveOmega(p, n) ** 2;

// ---------------------------------------------------------------------------
// Física: torção
// ---------------------------------------------------------------------------

/** Constante de torção do fio: κ = π G r⁴ / (2ℓ). */
export function kappa(p: Params): number {
  const G = MATERIAIS[clamp(Math.round(num(p, "material")), 0, MATERIAIS.length - 1)]!.G;
  const r = num(p, "dfio", 1) * 1e-3 / 2;
  return (Math.PI * G * r ** 4) / (2 * num(p, "lfio", 0.6));
}
/** Momento de inércia do corpo pendurado: barra com duas massas (Steiner) ou disco. */
export function inertiaTorsion(p: Params): number {
  const m = num(p, "m", 0.2), d = num(p, "d", 0.1);
  if (Math.round(num(p, "corpo")) === 1) return 0.5 * m * d * d;
  return (BARRA_M * BARRA_L ** 2) / 12 + 2 * m * d * d;
}
export const periodTorsion = (p: Params) => 2 * Math.PI * Math.sqrt(inertiaTorsion(p) / kappa(p));

// ---------------------------------------------------------------------------
// Física: esférico
// ---------------------------------------------------------------------------

/** Velocidade do movimento cônico de semiabertura θ: v = √(g L sen θ tg θ). */
export const conicalSpeed = (p: Params, th: number) => Math.sqrt(g(p) * num(p, "L", 1) * Math.sin(th) * Math.tan(th));
/** Período do pêndulo cônico: T = 2π √(L cos θ / g). */
export const conicalPeriod = (p: Params, th: number) => 2 * Math.PI * Math.sqrt((num(p, "L", 1) * Math.cos(th)) / g(p));
/** Precessão da elipse para pequenas amplitudes: Ω = (3/8) ω₀ a b / L² (rad/s). */
export function precessionTheory(p: Params): number {
  const L = num(p, "L", 1), th = rad(num(p, "theta0", 20));
  const w0 = Math.sqrt(g(p) / L);
  const a = L * Math.sin(th);
  const b = (num(p, "vphi", 0.3) * conicalSpeed(p, th)) / w0;
  return (3 / 8) * w0 * a * b / (L * L);
}

function sphericalAcc(y: number[], p: Params): number[] {
  const L = num(p, "L", 1), G = g(p);
  const [x, yy, z, vx, vy, vz] = y as [number, number, number, number, number, number];
  const lam = (vx * vx + vy * vy + vz * vz - G * z) / (L * L);
  return [vx, vy, vz, -lam * x, -lam * yy, -G - lam * z];
}

// ---------------------------------------------------------------------------
// Física: prego. Estado [s, v], s = comprimento de arco a partir do ponto mais baixo.
// ---------------------------------------------------------------------------

/** Distância pivô–prego efetiva (limitada a 90% do fio). */
export const nailH = (p: Params) => clamp(num(p, "h", 0.5), 0, 0.9 * num(p, "L", 1));
export const nailLen = (p: Params) => num(p, "L", 1) - nailH(p);
/** Período para pequenas amplitudes: meio período com L e meio com L − h. */
export const periodNail = (p: Params) => Math.PI * (Math.sqrt(num(p, "L", 1) / g(p)) + Math.sqrt(nailLen(p) / g(p)));

/** Posição da massa do pêndulo com prego (pivô na origem, prego em (0, −h)). */
export function nailPos(s: number, p: Params): [number, number] {
  const L = num(p, "L", 1), h = nailH(p);
  if (s <= 0) return [L * Math.sin(s / L), -L * Math.cos(s / L)];
  const l = L - h;
  return [l * Math.sin(s / l), -h - l * Math.cos(s / l)];
}
const nailRhs = (y: number[], p: Params) => {
  const l = y[0]! > 0 ? nailLen(p) : num(p, "L", 1);
  return [y[1]!, -g(p) * Math.sin(y[0]! / l)];
};

// ---------------------------------------------------------------------------
// Utilitários
// ---------------------------------------------------------------------------

function rad(dg: number) {
  return (dg * Math.PI) / 180;
}
function rk4(f: (y: number[]) => number[], y: number[], h: number): number[] {
  const k1 = f(y);
  const k2 = f(y.map((v, i) => v + (h / 2) * k1[i]!));
  const k3 = f(y.map((v, i) => v + (h / 2) * k2[i]!));
  const k4 = f(y.map((v, i) => v + h * k3[i]!));
  return y.map((v, i) => v + (h / 6) * (k1[i]! + 2 * k2[i]! + 2 * k3[i]! + k4[i]!));
}

/** Pivô da bola i do berço. */
const pivotX = (i: number) => 2 * R_BOLA * i;

/**
 * Resolve as colisões do berço por impulsos binários sucessivos (modelo de
 * colisões sequenciais). Cada bola só se move tangencialmente ao fio, então o
 * impulso J ao longo da normal n muda ωᵢ em −J(n·tᵢ)/(mL).
 */
export function resolveCollisions(th: number[], w: number[], L: number, e: number): number {
  const N = th.length;
  let count = 0;
  for (let it = 0; it < 400; it++) {
    let any = false;
    for (let i = 0; i < N - 1; i++) {
      const xa = pivotX(i) + L * Math.sin(th[i]!), ya = -L * Math.cos(th[i]!);
      const xb = pivotX(i + 1) + L * Math.sin(th[i + 1]!), yb = -L * Math.cos(th[i + 1]!);
      const dist = Math.hypot(xb - xa, yb - ya);
      if (dist > 2 * R_BOLA * (1 + 1e-6)) continue;
      const nx = (xb - xa) / dist, ny = (yb - ya) / dist;
      const ca = nx * Math.cos(th[i]!) + ny * Math.sin(th[i]!);
      const cb = nx * Math.cos(th[i + 1]!) + ny * Math.sin(th[i + 1]!);
      const u = L * (w[i + 1]! * cb - w[i]! * ca);
      if (u >= -1e-9) continue;
      // u' = −e u  ⇒  J/m = −(1 + e) u / (ca² + cb²)
      const Jm = (-(1 + e) * u) / (ca * ca + cb * cb);
      w[i] = w[i]! - (Jm * ca) / L;
      w[i + 1] = w[i + 1]! + (Jm * cb) / L;
      any = true;
      count++;
    }
    if (!any) break;
  }
  return count;
}

/** Coordenada cronometrada (cruzamento ascendente por zero) de cada modo. */
function clockCoord(s: PState, p: Params): number {
  const m = modeOf(p);
  if (m === TORCAO || m === PREGO) return s.y[0] ?? 0;
  if (m === BERCO) return s.y[0] ?? 0;
  return 0;
}

// ---------------------------------------------------------------------------
// Observáveis auxiliares
// ---------------------------------------------------------------------------

export function energy(s: PState, p: Params, _t = 0): number {
  const m = num(p, "m", 0.2), G = g(p), L = num(p, "L", 1);
  switch (modeOf(p)) {
    case BERCO: {
      const N = s.y.length / 2;
      let E = 0;
      for (let i = 0; i < N; i++) E += m * G * L * (1 - Math.cos(s.y[i]!)) + 0.5 * m * L * L * s.y[N + i]! ** 2;
      return E;
    }
    case ONDA: {
      // Aproximação linear (solução exata da EDO linearizada): E = ½ m g L θ₀² por pêndulo.
      let E = 0;
      const th0 = rad(num(p, "theta0", 20));
      for (let n = 0; n < nWave(p); n++) E += 0.5 * m * G * waveLength(p, n) * th0 * th0;
      return E;
    }
    case TORCAO:
      return 0.5 * inertiaTorsion(p) * s.y[1]! ** 2 + 0.5 * kappa(p) * s.y[0]! ** 2;
    case ESFERICO: {
      const [, , z, vx, vy, vz] = s.y as [number, number, number, number, number, number];
      return 0.5 * m * (vx * vx + vy * vy + vz * vz) + m * G * (z + L);
    }
    default: {
      const [, y] = nailPos(s.y[0]!, p);
      return 0.5 * m * s.y[1]! ** 2 + m * G * (y + L);
    }
  }
}

function mainAngle(s: PState, p: Params, t: number): number {
  switch (modeOf(p)) {
    case BERCO:
      return (s.y[0]! * 180) / Math.PI;
    case ONDA:
      return num(p, "theta0", 20) * Math.cos(waveOmega(p, 0) * t);
    case TORCAO:
      return (s.y[0]! * 180) / Math.PI;
    case ESFERICO: {
      const L = num(p, "L", 1);
      return (Math.acos(clamp(-s.y[2]! / L, -1, 1)) * 180) / Math.PI;
    }
    default: {
      const l = s.y[0]! > 0 ? nailLen(p) : num(p, "L", 1);
      return ((s.y[0]! / l) * 180) / Math.PI;
    }
  }
}

export function theoryPeriod(p: Params): number {
  switch (modeOf(p)) {
    case BERCO:
      return 2 * Math.PI * Math.sqrt(num(p, "L", 1) / g(p));
    case ONDA:
      return num(p, "Gamma", 60);
    case TORCAO:
      return periodTorsion(p);
    case ESFERICO: {
      const th = rad(num(p, "theta0", 20));
      return Math.abs(num(p, "vphi", 0.3) - 1) < 1e-9 ? conicalPeriod(p, th) : 2 * Math.PI * Math.sqrt(num(p, "L", 1) / g(p));
    }
    default:
      return periodNail(p);
  }
}

// ---------------------------------------------------------------------------
// Desenho 3D auxiliar
// ---------------------------------------------------------------------------

function cam3(s: PState, span: number, target: V3 = [0, 0, 0]): Projector {
  return projector({ yaw: s.cam.yaw, pitch: s.cam.pitch, zoom: 1 / span, target });
}
function line3(d: Draw, pr: Projector, a: V3, b: V3, color: string, width = 1.5, dash?: number[], alpha = 1) {
  const qa = pr.project(a), qb = pr.project(b);
  d.line(qa[0], qa[1], qb[0], qb[1], { color, width, dash, alpha });
}
const fmt = (v: number, dgt = 3) => Number(v.toPrecision(dgt)).toString().replace(".", ",");

// ---------------------------------------------------------------------------
// Simulação
// ---------------------------------------------------------------------------

export const pendulosEspeciais = defineSim<PState>({
  id: "pendulos-especiais",
  title: "Pêndulos especiais: berço de Newton, dança dos pêndulos, torção, esférico e prego",
  course: "FG I",
  topic: "Oscilações",
  priority: "P2",
  summary:
    "Cinco pêndulos clássicos com física quantitativa: colisões sequenciais no berço de Newton, a onda de pêndulos que se realinha após um ciclo Γ, o pêndulo de torção para medir T × I, o pêndulo esférico em 3D com precessão da elipse e o pêndulo interrompido por um prego.",
  equations: [
    String.raw`\text{Berço: } u' = -e\,u,\quad \textstyle\sum m v \text{ conservado}`,
    String.raw`\text{Onda: } \omega_n = \frac{2\pi (K+n)}{\Gamma},\quad L_n = \frac{g}{\omega_n^2}`,
    String.raw`\text{Torção: } I\ddot\varphi = -\kappa\varphi,\quad \kappa = \frac{\pi G r^4}{2\ell},\quad T = 2\pi\sqrt{I/\kappa}`,
    String.raw`\text{Esférico: } \ddot{\vec r} = \vec g - \frac{v^2 + \vec r\cdot\vec g}{L^2}\,\vec r,\quad \Omega_{\text{prec}} \approx \tfrac{3}{8}\,\omega_0\,\frac{ab}{L^2}`,
    String.raw`\text{Prego: } T \approx \pi\sqrt{L/g} + \pi\sqrt{(L-h)/g}`,
  ],
  liveEquations(s, p, t) {
    const m = modeOf(p);
    if (m === BERCO) {
      const N = s.y.length / 2;
      let P = 0;
      for (let i = 0; i < N; i++) P += num(p, "m", 0.2) * num(p, "L", 1) * s.y[N + i]! * Math.cos(s.y[i]!);
      return [String.raw`p_x = ${texNum(P)}\ \text{kg·m/s} \qquad E = ${texNum(energy(s, p, t))}\ \text{J} \qquad e = ${texNum(num(p, "e", 1))}`];
    }
    if (m === ONDA) {
      const G = num(p, "Gamma", 60), K = num(p, "K", 51);
      return [
        String.raw`L_0 = ${texNum(waveLength(p, 0))}\ \text{m} \;(${texNum(K)}\ \text{osc.}) \quad L_{${nWave(p) - 1}} = ${texNum(waveLength(p, nWave(p) - 1))}\ \text{m} \;(${texNum(K + nWave(p) - 1)}\ \text{osc.})`,
        String.raw`\Delta\phi_{n,n+1} = 2\pi\,\frac{t}{\Gamma} = ${texNum((((t % G) / G) * 360))}^\circ`,
      ];
    }
    if (m === TORCAO)
      return [
        String.raw`\kappa = ${texNum(kappa(p))}\ \text{N·m/rad} \quad I = ${texNum(inertiaTorsion(p))}\ \text{kg·m}^2`,
        String.raw`T = 2\pi\sqrt{\frac{${texNum(inertiaTorsion(p))}}{${texNum(kappa(p))}}} = ${texNum(periodTorsion(p))}\ \text{s} \quad T_{\text{medido}} = ${texNum(s.meas.T)}\ \text{s}`,
      ];
    if (m === ESFERICO) {
      const th = rad(num(p, "theta0", 20));
      return [
        String.raw`v_{\text{cônico}} = ${texNum(conicalSpeed(p, th))}\ \text{m/s} \quad T_{\text{cônico}} = 2\pi\sqrt{\frac{L\cos\theta}{g}} = ${texNum(conicalPeriod(p, th))}\ \text{s}`,
        String.raw`\Omega_{\text{prec}}^{\text{teo}} = ${texNum((precessionTheory(p) * 180) / Math.PI)}^\circ/\text{s} \quad \Omega_{\text{medido}} = ${texNum(measuredPrecession(s, p))}^\circ/\text{s}`,
      ];
    }
    return [
      String.raw`T = \pi\sqrt{\frac{${texNum(num(p, "L", 1))}}{g}} + \pi\sqrt{\frac{${texNum(nailLen(p))}}{g}} = ${texNum(periodNail(p))}\ \text{s} \quad T_{\text{medido}} = ${texNum(s.meas.T)}\ \text{s}`,
    ];
  },

  params: [
    { key: "modo", label: "Experimento", unit: "", min: 0, max: 4, step: 1, default: 0, options: MODOS.map((label, value) => ({ value, label })) },
    { key: "L", label: "Comprimento do fio L", unit: "m", min: 0.1, max: 2, step: 0.01, default: 0.3 },
    { key: "theta0", label: "Amplitude inicial θ₀", unit: "°", min: 1, max: 80, step: 1, default: 30 },
    { key: "m", label: "Massa m (bolas, massas da barra ou disco)", unit: "kg", min: 0.02, max: 2, step: 0.01, default: 0.1 },
    { key: "g", label: "Gravidade", unit: "m/s²", min: 1, max: 25, step: 0.01, default: 9.81 },
    { key: "N", label: "Número de esferas / pêndulos", unit: "", min: 2, max: 24, step: 1, default: 5 },
    { key: "k", label: "Berço: esferas soltas", unit: "", min: 1, max: 6, step: 1, default: 1 },
    { key: "e", label: "Berço: coeficiente de restituição", unit: "", min: 0.5, max: 1, step: 0.01, default: 1 },
    { key: "Gamma", label: "Onda: ciclo de realinhamento Γ", unit: "s", min: 10, max: 120, step: 1, default: 60 },
    { key: "K", label: "Onda: oscilações do mais longo em Γ", unit: "", min: 5, max: 80, step: 1, default: 51 },
    { key: "material", label: "Torção: material do fio", unit: "", min: 0, max: MATERIAIS.length - 1, step: 1, default: 0, options: MATERIAIS.map((m, value) => ({ value, label: m.label })) },
    { key: "dfio", label: "Torção: diâmetro do fio", unit: "mm", min: 0.2, max: 2, step: 0.05, default: 1 },
    { key: "lfio", label: "Torção: comprimento do fio ℓ", unit: "m", min: 0.2, max: 1.2, step: 0.01, default: 0.6 },
    {
      key: "corpo",
      label: "Torção: corpo",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 0,
      options: [
        { value: 0, label: "Barra com duas massas a ±d" },
        { value: 1, label: "Disco de raio d" },
      ],
    },
    { key: "d", label: "Torção: distância d das massas (ou raio)", unit: "m", min: 0.02, max: 0.2, step: 0.005, default: 0.1 },
    { key: "vphi", label: "Esférico: v lateral / v cônica", unit: "", min: 0, max: 1.5, step: 0.01, default: 0.3 },
    { key: "h", label: "Prego: distância do pivô ao prego h", unit: "m", min: 0, max: 1.8, step: 0.01, default: 0.5 },
  ],

  observables: [
    { key: "theta", label: "Ângulo principal", unit: "°", value: (s, p, t) => mainAngle(s, p, t) },
    { key: "E", label: "Energia mecânica", unit: "J", value: (s, p, t) => energy(s, p, t) },
    {
      key: "px",
      label: "Berço: momento horizontal total",
      unit: "kg·m/s",
      value: (s, p) => {
        if (modeOf(p) !== BERCO) return 0;
        const N = s.y.length / 2;
        let P = 0;
        for (let i = 0; i < N; i++) P += num(p, "m", 0.2) * num(p, "L", 1) * s.y[N + i]! * Math.cos(s.y[i]!);
        return P;
      },
    },
    {
      key: "thetaUlt",
      label: "Berço: ângulo da última esfera",
      unit: "°",
      value: (s, p) => (modeOf(p) === BERCO ? (s.y[s.y.length / 2 - 1]! * 180) / Math.PI : 0),
    },
    {
      key: "nmov",
      label: "Berço: esferas em movimento",
      unit: "",
      value: (s, p) => {
        if (modeOf(p) !== BERCO) return 0;
        const N = s.y.length / 2;
        let c = 0;
        for (let i = 0; i < N; i++) if (Math.abs(s.y[i]!) > rad(2)) c++;
        return c;
      },
    },
    { key: "Tmed", label: "Período medido (cronômetro)", unit: "s", value: (s) => s.meas.T },
    { key: "Tteo", label: "Período teórico", unit: "s", value: (_s, p) => theoryPeriod(p) },
    { key: "fase", label: "Onda: fração do ciclo t/Γ", unit: "", value: (_s, p, t) => (modeOf(p) === ONDA ? (t % num(p, "Gamma", 60)) / num(p, "Gamma", 60) : 0) },
    { key: "kappa", label: "Torção: constante κ", unit: "N·m/rad", value: (_s, p) => kappa(p) },
    { key: "I", label: "Torção: momento de inércia", unit: "kg·m²", value: (_s, p) => inertiaTorsion(p) },
    { key: "prec", label: "Esférico: precessão medida", unit: "°/s", value: (s, p) => measuredPrecession(s, p) },
    { key: "precTeo", label: "Esférico: precessão teórica", unit: "°/s", value: (_s, p) => (modeOf(p) === ESFERICO ? (precessionTheory(p) * 180) / Math.PI : 0) },
    {
      key: "Taz",
      label: "Esférico: período azimutal",
      unit: "s",
      value: (s, p, t) => (modeOf(p) === ESFERICO && Math.abs(s.meas.phi) > 1e-6 ? (2 * Math.PI * t) / Math.abs(s.meas.phi) : 0),
    },
    {
      key: "altura",
      label: "Altura da massa (acima do ponto mais baixo)",
      unit: "m",
      value: (s, p) => {
        if (modeOf(p) === PREGO) return nailPos(s.y[0]!, p)[1] + num(p, "L", 1);
        if (modeOf(p) === ESFERICO) return s.y[2]! + num(p, "L", 1);
        return 0;
      },
    },
  ],
  conserved: "E",
  chart: { x: "t", y: "theta" },

  scenarios: [
    {
      id: "berco",
      label: "Berço de Newton",
      params: { modo: BERCO, L: 0.3, N: 5, k: 1, e: 1, theta0: 30 },
      guide: `### Berço de Newton
1. Solte uma esfera: só a última sai, com a mesma velocidade. Veja $p_x$ e $E$ antes e depois.
2. Mude **esferas soltas** para 2 e 3. Quantas saem do outro lado?
3. Arraste qualquer esfera com o mouse para levantá-la (as que estão do mesmo lado sobem junto).
4. Baixe $e$ para 0,9: o momento continua se conservando nas colisões, mas a energia cai e, depois de alguns choques, o conjunto passa a balançar junto.
5. Por que "duas entram, duas saem"? Com $m$ iguais, só essa saída conserva **ao mesmo tempo** $\\sum mv$ e $\\sum \\tfrac12 mv^2$.`,
      predict: [
        {
          question: "Soltando duas esferas juntas no berço de 5 esferas (choques elásticos), o que acontece do outro lado?",
          options: ["Uma esfera sai com o dobro da velocidade", "Duas esferas saem com a mesma velocidade de chegada", "Todas as esferas se movem devagar"],
          answer: 1,
          explanation: "Uma esfera com $2v$ conservaria o momento ($2mv$), mas teria energia $\\tfrac12 m(2v)^2 = 2mv^2$, o dobro da inicial ($mv^2$). Só duas esferas com $v$ conservam as duas grandezas.",
        },
      ],
    },
    {
      id: "onda",
      label: "Dança dos pêndulos",
      params: { modo: ONDA, N: 15, Gamma: 60, K: 51, theta0: 15 },
      guide: `### Onda de pêndulos
1. O pêndulo $n$ faz exatamente $K+n$ oscilações em $\\Gamma$ segundos, então $L_n = g\\,[\\Gamma/(2\\pi(K+n))]^2$.
2. A defasagem entre vizinhos cresce como $2\\pi t/\\Gamma$: surgem ondas viajantes, depois duas fileiras, três fileiras...
3. Pare em $t = \\Gamma/2$ e em $t = \\Gamma/3$ e conte as fileiras na **vista de cima** (à direita).
4. Em $t = \\Gamma$ todos voltam alinhados. Arraste o fundo para girar a câmera.`,
      predict: [
        {
          question: "Em t = Γ/2, como ficam os pêndulos vistos de cima?",
          options: ["Todos alinhados", "Duas fileiras: pares de um lado, ímpares do outro", "Distribuídos ao acaso"],
          answer: 1,
          explanation: "Em $t = \\Gamma/2$ a fase do pêndulo $n$ é $\\pi(K+n)$: vizinhos ficam em oposição de fase ($\\cos$ alterna entre $+1$ e $-1$).",
        },
      ],
    },
    {
      id: "torcao",
      label: "Pêndulo de torção (bancada)",
      params: { modo: TORCAO, corpo: 0, m: 0.2, d: 0.1, dfio: 1, lfio: 0.6, material: 0, theta0: 30 },
      guide: `### Medir T em função do momento de inércia
1. Deixe oscilar e leia o **período medido** (cronômetro em cada cruzamento por zero).
2. Varie $d$ de 0,04 m a 0,20 m e anote $T$. Faça o gráfico de $T^2$ contra $d^2$: é uma reta, pois $T^2 = \\tfrac{4\\pi^2}{\\kappa}\\,(I_0 + 2md^2)$.
3. Da inclinação, obtenha $\\kappa$; com $\\kappa = \\pi G r^4/(2\\ell)$, calcule o módulo de cisalhamento $G$ do fio.
4. Dobre o diâmetro do fio: $T$ cai a 1/4 ($\\kappa \\propto r^4$).
5. O período não depende da amplitude: a lei $\\tau = -\\kappa\\varphi$ é linear mesmo para ângulos grandes.`,
      predict: [
        {
          question: "Se o diâmetro do fio dobrar, o período de torção:",
          options: ["cai pela metade", "cai para 1/4", "dobra"],
          answer: 1,
          explanation: "$\\kappa \\propto r^4$ cresce 16 vezes e $T \\propto 1/\\sqrt{\\kappa}$ cai 4 vezes.",
        },
      ],
    },
    {
      id: "esferico",
      label: "Pêndulo esférico e cônico (3D)",
      params: { modo: ESFERICO, L: 1, theta0: 20, vphi: 0.3 },
      guide: `### Precessão da elipse
1. Com velocidade lateral pequena, a massa descreve uma elipse que **gira** devagar (a sombra no chão mostra bem).
2. Compare a precessão medida com a fórmula $\\Omega \\approx \\tfrac38\\,\\omega_0\\,ab/L^2$: ela cresce com a área da elipse.
3. Coloque $v/v_{\\text{cônica}} = 1$: o pêndulo vira **cônico**, a órbita é um círculo e $T = 2\\pi\\sqrt{L\\cos\\theta/g}$.
4. Com $v = 0$ o movimento é plano: sem precessão.
5. Arraste o fundo para girar a câmera.`,
      predict: [
        {
          question: "A elipse do pêndulo esférico precessa em que sentido?",
          options: ["No mesmo sentido em que a massa gira", "No sentido contrário", "Não precessa"],
          answer: 0,
          explanation: "A força restauradora real ($\\propto \\sin\\theta$) é mais fraca que a linear nas grandes elongações; a massa demora mais para voltar e o apside avança no sentido do giro.",
        },
      ],
    },
    {
      id: "prego",
      label: "Pêndulo com prego",
      params: { modo: PREGO, L: 1, h: 0.5, theta0: 25 },
      guide: `### O prego de Galileu
1. Ao passar pela vertical, o fio enrosca no prego e o raio cai de $L$ para $L-h$.
2. A massa sobe do outro lado até a **mesma altura** (linha tracejada): energia conservada.
3. Leia o período medido e compare com $T = \\pi\\sqrt{L/g} + \\pi\\sqrt{(L-h)/g}$.
4. Arraste a massa para escolher outra posição inicial.`,
      predict: [
        {
          question: "Do lado do prego, a massa sobe até:",
          options: ["uma altura menor", "a mesma altura de onde partiu", "uma altura maior"],
          answer: 1,
          explanation: "A tração não realiza trabalho (é perpendicular à velocidade) e o prego não remove energia: $mgh$ volta a ser o mesmo.",
        },
      ],
    },
  ],

  exercises: [
    {
      id: "onda-comprimento",
      prompt:
        "Num painel de onda de pêndulos com ciclo Γ = {Gamma} s, o pêndulo mais longo faz {K} oscilações completas em cada ciclo (g = 9,81 m/s²). Qual deve ser o seu comprimento?",
      vary: { Gamma: [30, 90, 0], K: [20, 60, 0] },
      fixed: { modo: ONDA, g: 9.81 },
      answer: { label: "L", unit: "m", compute: (p) => waveLength(p, 0) },
      hint: "T = Γ/K e L = g T²/(4π²).",
    },
    {
      id: "torcao-periodo",
      prompt:
        "Uma barra leve (desconsidere sua inércia) segura duas massas de {m} kg a {d} m do eixo, pendurada por um fio de constante de torção κ = 0,02 N·m/rad. Qual é o período de oscilação?",
      vary: { m: [0.05, 0.5, 2], d: [0.04, 0.2, 3] },
      fixed: { modo: TORCAO },
      answer: { label: "T", unit: "s", compute: (p) => 2 * Math.PI * Math.sqrt((2 * num(p, "m") * num(p, "d") ** 2) / 0.02) },
      hint: "I = 2 m d² e T = 2π√(I/κ).",
    },
    {
      id: "prego-periodo",
      prompt: "Um pêndulo de {L} m tem um prego {h} m abaixo do pivô (g = 9,81 m/s²). Qual é o período para pequenas oscilações?",
      vary: { L: [0.5, 2, 2], h: [0.1, 0.4, 2] },
      fixed: { modo: PREGO, g: 9.81 },
      answer: { label: "T", unit: "s", compute: (p) => periodNail(p) },
    },
  ],

  init(p): PState {
    const m = modeOf(p);
    const th0 = rad(num(p, "theta0", 20));
    const L = num(p, "L", 1);
    let y: number[];
    switch (m) {
      case BERCO: {
        const N = nBalls(p);
        const k = clamp(Math.round(num(p, "k", 1)), 1, N - 1);
        y = new Array(2 * N).fill(0);
        for (let i = 0; i < k; i++) y[i] = -th0;
        break;
      }
      case ONDA:
        y = Array.from({ length: nWave(p) }, () => th0);
        break;
      case TORCAO:
        y = [th0, 0];
        break;
      case ESFERICO: {
        const v = num(p, "vphi", 0.3) * conicalSpeed(p, th0);
        y = [L * Math.sin(th0), 0, -L * Math.cos(th0), 0, v, 0];
        break;
      }
      default:
        y = [-L * th0, 0];
    }
    const s: PState = { y, cam: defaultCam(), drag: null, meas: newMeas() };
    s.meas.prev = clockCoord(s, p);
    return s;
  },

  step(s, p, t, dt): PState {
    const m = modeOf(p);
    const L = num(p, "L", 1);
    let y = s.y.slice();
    const meas = { ...s.meas };
    const holding = s.drag && s.drag.kind !== "cam";
    if (m === BERCO) {
      const N = y.length / 2;
      if (!holding) {
        const G = g(p);
        const sub = 5, h = dt / sub;
        const th = y.slice(0, N), w = y.slice(N);
        for (let k = 0; k < sub; k++) {
          for (let i = 0; i < N; i++) {
            const r = rk4((q) => [q[1]!, -(G / L) * Math.sin(q[0]!)], [th[i]!, w[i]!], h);
            th[i] = r[0]!;
            w[i] = r[1]!;
          }
          resolveCollisions(th, w, L, num(p, "e", 1));
        }
        y = [...th, ...w];
      }
    } else if (m === ONDA) {
      const t1 = t + dt;
      y = y.map((_, n) => rad(num(p, "theta0", 20)) * Math.cos(waveOmega(p, n) * t1));
    } else if (m === TORCAO) {
      const k2 = kappa(p) / inertiaTorsion(p);
      y = rk4((q) => [q[1]!, -k2 * q[0]!], y, dt);
    } else if (m === ESFERICO) {
      y = rk4((q) => sphericalAcc(q, p), y, dt);
      // Projeta de volta no vínculo |r| = L, v ⟂ r.
      const r = Math.hypot(y[0]!, y[1]!, y[2]!);
      for (let i = 0; i < 3; i++) y[i] = (y[i]! * L) / r;
      const rv = (y[0]! * y[3]! + y[1]! * y[4]! + y[2]! * y[5]!) / (L * L);
      for (let i = 0; i < 3; i++) y[3 + i] = y[3 + i]! - rv * y[i]!;
      // Azimute desenrolado e apsides (máximos do raio horizontal).
      const a0 = Math.atan2(s.y[1]!, s.y[0]!), a1 = Math.atan2(y[1]!, y[0]!);
      let da = a1 - a0;
      if (da > Math.PI) da -= 2 * Math.PI;
      if (da < -Math.PI) da += 2 * Math.PI;
      meas.phi += da;
      const rvh = y[0]! * y[3]! + y[1]! * y[4]!;
      if (meas.rv > 0 && rvh <= 0 && t > dt) {
        const ang = meas.phi;
        if (Number.isFinite(meas.apse)) {
          // Entre apsides consecutivos a elipse percorre meia volta (π) mais a precessão.
          const sgn = Math.sign(meas.phi) || 1;
          const pr = (ang - meas.apse) - sgn * Math.PI;
          const dtA = t + dt - meas.apseT;
          meas.prec = (meas.prec * meas.nApse + pr / dtA) / (meas.nApse + 1);
          meas.nApse++;
        }
        meas.apse = ang;
        meas.apseT = t + dt;
      }
      meas.rv = rvh;
    } else if (!holding) {
      y = rk4((q) => nailRhs(q, p), y, dt);
    }
    const next: PState = { ...s, y, meas };
    // Cronômetro: cruzamento ascendente por zero (interpolado).
    if (m !== ONDA && m !== ESFERICO && !holding) {
      const c = clockCoord(next, p);
      if (meas.prev < 0 && c >= 0) {
        const tc = t + dt * (-meas.prev / (c - meas.prev));
        if (meas.last >= 0) meas.T = tc - meas.last;
        meas.last = tc;
        meas.n++;
      }
      meas.prev = c;
    } else if (m === ONDA) meas.T = num(p, "Gamma", 60);
    return next;
  },
  dt: 5e-4,
  sampleEvery: 20,
  tEnd: 600,

  narrowSplit: () => 0.592,
  viewport(p) {
    const m = modeOf(p);
    const L = num(p, "L", 1);
    if (m === BERCO) {
      const w = pivotX(nBalls(p) - 1);
      return { xMin: -0.85 * L, xMax: w + 0.85 * L, yMin: -1.25 * L, yMax: 0.18 * L, unit: "m" };
    }
    if (m === PREGO) return { xMin: -1.1 * L, xMax: 1.1 * L, yMin: -1.15 * L, yMax: 0.15 * L, unit: "m" };
    if (m === ONDA) return { xMin: -1.35, xMax: 2.75, yMin: -1.3, yMax: 1.15 };
    return { xMin: -1.6, xMax: 1.6, yMin: -1.3, yMax: 1.2 };
  },

  pointer: {
    down(s, p, pt) {
      const m = modeOf(p);
      const L = num(p, "L", 1);
      if (m === BERCO) {
        const N = s.y.length / 2;
        for (let i = 0; i < N; i++) {
          const x = pivotX(i) + L * Math.sin(s.y[i]!), y = -L * Math.cos(s.y[i]!);
          if (Math.hypot(pt.x - x, pt.y - y) < 1.6 * R_BOLA) return { ...s, drag: { kind: "bola", i } };
        }
        return undefined;
      }
      if (m === PREGO) {
        const [x, y] = nailPos(s.y[0]!, p);
        if (Math.hypot(pt.x - x, pt.y - y) < 0.12 * L) return { ...s, drag: { kind: "prego" } };
        return undefined;
      }
      return { ...s, drag: { kind: "cam", x0: pt.x, y0: pt.y, cam0: s.cam } };
    },
    move(s, p, pt, dragging) {
      if (!dragging || !s.drag) return undefined;
      const L = num(p, "L", 1);
      if (s.drag.kind === "cam") {
        const c = orbit(s.drag.cam0, (pt.x - s.drag.x0) * 220, -(pt.y - s.drag.y0) * 220);
        return { ...s, cam: { yaw: c.yaw, pitch: c.pitch } };
      }
      if (s.drag.kind === "bola") {
        const N = s.y.length / 2, i = s.drag.i;
        const th = clamp(Math.atan2(pt.x - pivotX(i), -pt.y), -rad(75), rad(75));
        const y = s.y.slice();
        for (let j = 0; j < N; j++) {
          y[N + j] = 0;
          if ((th < 0 && j <= i) || (th >= 0 && j >= i)) y[j] = th;
          else y[j] = 0;
        }
        return { ...s, y, meas: { ...newMeas(), prev: y[0]! } };
      }
      // Prego: lado esquerdo gira em torno do pivô; lado direito, em torno do prego.
      const h = nailH(p);
      let sArc: number;
      if (pt.x <= 0) sArc = L * clamp(Math.atan2(pt.x, -pt.y), -rad(80), 0);
      else sArc = nailLen(p) * clamp(Math.atan2(pt.x, -(pt.y + h)), 0, rad(80));
      return { ...s, y: [sArc, 0], meas: { ...newMeas(), prev: sArc } };
    },
    up: (s) => (s.drag ? { ...s, drag: null } : undefined),
    cursor: (s, p) => (modeOf(p) === BERCO || modeOf(p) === PREGO ? "grab" : s.drag ? "grabbing" : "grab"),
  },
  actions: [
    { id: "vista-padrao", label: "Câmera padrão (3D)", run: (s) => ({ ...s, cam: defaultCam() }) },
    { id: "vista-cima", label: "Vista de cima (3D)", run: (s) => ({ ...s, cam: { yaw: s.cam.yaw, pitch: 1.5 } }) },
  ],

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const { state: s, params: p } = frame;
    switch (modeOf(p)) {
      case BERCO:
        return renderBerco(d, s, p);
      case ONDA:
        return renderOnda(d, s, p, frame.t);
      case TORCAO:
        return renderTorcao(d, s, p, frame.t);
      case ESFERICO:
        return renderEsferico(d, s, p, frame.trail);
      default:
        return renderPrego(d, s, p);
    }
  },
});

function measuredPrecession(s: PState, p: Params): number {
  if (modeOf(p) !== ESFERICO || s.meas.nApse === 0) return 0;
  return (Math.abs(s.meas.prec) * 180) / Math.PI;
}

// ---------------------------------------------------------------------------
// Desenhos por modo
// ---------------------------------------------------------------------------

function renderBerco(d: Draw, s: PState, p: Params) {
  const { theme } = d;
  const L = num(p, "L", 1);
  const N = s.y.length / 2;
  const w = pivotX(N - 1);
  d.rect(-0.1 * L, 0, w + 0.2 * L, 0.04 * L, { fill: theme.muted, alpha: 0.5 });
  d.support(-0.1 * L, 0, w + 0.1 * L, 0, { color: theme.muted });
  for (let i = 0; i < N; i++) {
    const th = s.y[i]!, om = s.y[N + i]!;
    const x = pivotX(i) + L * Math.sin(th), y = -L * Math.cos(th);
    d.line(pivotX(i), 0, x, y, { color: theme.muted, width: 1.2 });
    const moving = Math.abs(om) > 0.05;
    d.circle(x, y, R_BOLA, { fill: moving ? theme.series[1]! : theme.series[0]!, stroke: theme.text, width: 1 });
    const v = L * om;
    if (Math.abs(v) > 0.02) d.arrowPx(x, y, Math.cos(th) * v, Math.sin(th) * v, clamp(Math.abs(v) * 60, 10, 60), { color: theme.accent });
  }
  const E = energy(s, p, 0);
  let P = 0;
  for (let i = 0; i < N; i++) P += num(p, "m", 0.2) * L * s.y[N + i]! * Math.cos(s.y[i]!);
  d.text(`p = ${fmt(P)} kg·m/s    E = ${fmt(E)} J    e = ${fmt(num(p, "e", 1))}`, w / 2, -1.17 * L, { color: theme.text, size: 13 });
  d.text("Arraste uma esfera para levantá-la", w / 2, 0.11 * L, { color: theme.muted, size: 11 });
}

function renderOnda(d: Draw, s: PState, p: Params, t: number) {
  const { theme } = d;
  const N = s.y.length;
  const Lmax = waveLength(p, 0);
  const span = Lmax * 1.05;
  const pr = cam3(s, span);
  const sp = (1.6 * Lmax) / Math.max(N - 1, 1);
  const y0 = -((N - 1) * sp) / 2;
  line3(d, pr, [0, y0 - sp, 0], [0, -y0 + sp, 0], theme.muted, 4);
  const faces: Face[] = [];
  for (let n = 0; n < N; n++) {
    const Ln = waveLength(p, n), th = s.y[n]!;
    const pos: V3 = [Ln * Math.sin(th), y0 + n * sp, -Ln * Math.cos(th)];
    line3(d, pr, [0, pos[1], 0], pos, theme.muted, 1);
    faces.push(...sphere(pos, 0.035 * Lmax, theme.series[n % 2 === 0 ? 0 : 1]!, 6));
  }
  renderFaces(d, pr, faces);
  d.text(`t = ${fmt(t % num(p, "Gamma", 60), 3)} s de Γ = ${fmt(num(p, "Gamma", 60))} s`, 0, 1.05, { color: theme.text, size: 13 });
  // Vista de cima: deslocamento de cada pêndulo
  const cx = 2.05, half = 0.55;
  d.rect(cx - half - 0.05, -1.05, 2 * half + 0.1, 2.1, { stroke: theme.grid, width: 1 });
  d.line(cx, -1.0, cx, 1.0, { color: theme.grid, dash: [4, 4] });
  d.text("vista de cima", cx, 1.1, { color: theme.muted, size: 12 });
  const th0 = rad(num(p, "theta0", 20));
  const pts: [number, number][] = [];
  for (let n = 0; n < N; n++) {
    const yy = -0.95 + (1.9 * n) / Math.max(N - 1, 1);
    const xx = cx + half * (s.y[n]! / th0);
    pts.push([xx, yy]);
  }
  d.polyline(pts, { color: theme.accent, width: 1, alpha: 0.5 });
  pts.forEach(([x, y], n) => d.dot(x, y, 5, theme.series[n % 2 === 0 ? 0 : 1]!));
}

function renderTorcao(d: Draw, s: PState, p: Params, t: number) {
  const { theme } = d;
  const lf = num(p, "lfio", 0.6), dd = num(p, "d", 0.1);
  const disco = Math.round(num(p, "corpo")) === 1;
  const reach = Math.max(BARRA_L / 2, dd) * 1.25;
  const wireDraw = Math.min(lf, 2.2 * reach);
  const span = Math.max(reach * 1.1, wireDraw * 0.75);
  const pr = cam3(s, span, [0, 0, wireDraw * 0.4]);
  const phi = s.y[0]!;
  // Escala graduada no plano da barra
  const scaleR = reach;
  for (let a = -90; a <= 90; a += 10) {
    const ar = rad(a), r1 = a % 30 === 0 ? 0.88 * scaleR : 0.94 * scaleR;
    line3(d, pr, [r1 * Math.cos(ar), r1 * Math.sin(ar), -0.02 * span], [scaleR * Math.cos(ar), scaleR * Math.sin(ar), -0.02 * span], theme.muted, 1);
    if (a % 30 === 0) {
      const q = pr.project([1.08 * scaleR * Math.cos(ar), 1.08 * scaleR * Math.sin(ar), -0.02 * span]);
      d.text(`${a}°`, q[0], q[1], { color: theme.muted, size: 10 });
    }
  }
  // Suporte e fio
  line3(d, pr, [-0.3 * span, 0, wireDraw], [0.3 * span, 0, wireDraw], theme.text, 5);
  line3(d, pr, [0, 0, wireDraw], [0, 0, 0], theme.text, 1.2);
  const u: V3 = [Math.cos(phi), Math.sin(phi), 0];
  const faces: Face[] = [];
  if (disco) {
    const n = 24;
    for (let k = 0; k < n; k++) {
      const a = phi + (2 * Math.PI * k) / n, b = phi + (2 * Math.PI * (k + 1)) / n;
      faces.push({ pts: [[0, 0, 0], [dd * Math.cos(a), dd * Math.sin(a), 0], [dd * Math.cos(b), dd * Math.sin(b), 0]], color: k % 6 === 0 ? theme.series[1]! : theme.series[0]!, alpha: 0.9 });
    }
  } else {
    line3(d, pr, [(-u[0] * BARRA_L) / 2, (-u[1] * BARRA_L) / 2, 0], [(u[0] * BARRA_L) / 2, (u[1] * BARRA_L) / 2, 0], theme.muted, 5);
    const rr = 0.02 + 0.03 * Math.cbrt(num(p, "m", 0.2));
    faces.push(...sphere([u[0] * dd, u[1] * dd, 0], rr, theme.series[1]!, 8), ...sphere([-u[0] * dd, -u[1] * dd, 0], rr, theme.series[1]!, 8));
  }
  renderFaces(d, pr, faces);
  // Ponteiro
  line3(d, pr, [0, 0, 0], [scaleR * u[0], scaleR * u[1], 0], theme.accent, 2);
  d.text(`φ = ${fmt((phi * 180) / Math.PI, 3)}°   t = ${fmt(t, 4)} s`, -1.55, 1.08, { color: theme.text, size: 13, align: "left" });
  d.text(`T medido = ${s.meas.T > 0 ? fmt(s.meas.T, 4) + " s" : "—"}   T teórico = ${fmt(periodTorsion(p), 4)} s`, -1.55, 0.94, { color: theme.text, size: 13, align: "left" });
  d.text(`κ = ${fmt(kappa(p))} N·m/rad   I = ${fmt(inertiaTorsion(p))} kg·m²`, -1.55, 0.8, { color: theme.muted, size: 12, align: "left" });
}

function renderEsferico(d: Draw, s: PState, p: Params, trail: PState[]) {
  const { theme } = d;
  const L = num(p, "L", 1);
  const pr = cam3(s, L * 0.8, [0, 0, -0.5 * L]);
  // Piso e eixos
  const floor = -L;
  const R0 = Math.min(0.95, 1.4 * Math.sin(rad(num(p, "theta0", 20))) + 0.1) * L;
  const circ: V3[] = [];
  for (let k = 0; k <= 64; k++) circ.push([R0 * Math.cos((2 * Math.PI * k) / 64), R0 * Math.sin((2 * Math.PI * k) / 64), floor]);
  polyline3d(d, pr, circ, { color: theme.grid, width: 1 });
  drawAxes3d(d, { ...pr, project: (q: V3) => pr.project([q[0], q[1], q[2] + floor]) }, 0.45 * L, theme.muted);
  // Rastro e sombra (projeção no chão)
  const recent = trail.slice(-1500).filter((q) => q.y.length === 6);
  if (recent.length > 1) {
    polyline3d(d, pr, recent.map((q) => [q.y[0]!, q.y[1]!, floor] as V3), { color: theme.series[2]!, width: 1.5 });
    polyline3d(d, pr, recent.slice(-300).map((q) => [q.y[0]!, q.y[1]!, q.y[2]!] as V3), { color: theme.accent, width: 1 });
  }
  const pos: V3 = [s.y[0]!, s.y[1]!, s.y[2]!];
  line3(d, pr, [0, 0, 0], pos, theme.text, 1.2);
  line3(d, pr, pos, [pos[0], pos[1], floor], theme.grid, 1, [3, 4]);
  line3(d, pr, [-0.2 * L, 0, 0], [0.2 * L, 0, 0], theme.text, 4);
  renderFaces(d, pr, sphere(pos, 0.05 * L, theme.series[1]!, 10));
  const v: V3 = [s.y[3]!, s.y[4]!, s.y[5]!];
  const q0 = pr.project(pos), q1 = pr.project([pos[0] + v[0] * 0.15, pos[1] + v[1] * 0.15, pos[2] + v[2] * 0.15]);
  d.arrow(q0[0], q0[1], q1[0] - q0[0], q1[1] - q0[1], { color: theme.accent });
  d.text(`precessão medida ${fmt(measuredPrecession(s, p))}°/s · teoria ${fmt((precessionTheory(p) * 180) / Math.PI)}°/s`, 0, 1.1, { color: theme.text, size: 12 });
  d.text("sombra no chão (verde) · arraste para girar", 0, -1.22, { color: theme.muted, size: 11 });
}

function renderPrego(d: Draw, s: PState, p: Params) {
  const { theme } = d;
  const L = num(p, "L", 1), h = nailH(p);
  d.support(-0.25 * L, 0, 0.25 * L, 0, { color: theme.muted });
  const [x, y] = nailPos(s.y[0]!, p);
  // Trajetória: arco de raio L à esquerda, raio L − h à direita
  const arcL: [number, number][] = [], arcR: [number, number][] = [];
  for (let k = 0; k <= 50; k++) {
    const a = (-Math.PI / 2) * (k / 50);
    arcL.push([L * Math.sin(a), -L * Math.cos(a)]);
    const b = (Math.PI / 2) * (k / 50);
    arcR.push([(L - h) * Math.sin(b), -h - (L - h) * Math.cos(b)]);
  }
  d.polyline(arcL, { color: theme.grid, dash: [4, 4] });
  d.polyline(arcR, { color: theme.grid, dash: [4, 4] });
  // Altura inicial (energia)
  const E = energy(s, p, 0), m = num(p, "m", 0.2);
  const hMax = E / (m * g(p)) - L;
  d.line(-1.05 * L, hMax, 1.05 * L, hMax, { color: theme.series[2]!, dash: [6, 4], width: 1.2 });
  d.text("altura máxima (energia)", 1.05 * L, hMax, { color: theme.series[2]!, size: 11, align: "right", dy: -8 });
  if (s.y[0]! > 0) d.polyline([[0, 0], [0, -h], [x, y]], { color: theme.text, width: 1.4 });
  else d.line(0, 0, x, y, { color: theme.text, width: 1.4 });
  d.circle(0, -h, 0.012 * L, { fill: theme.negative, minPx: 4 });
  d.text("prego", 0, -h, { color: theme.muted, size: 11, dx: -24 });
  d.circle(x, y, 0.045 * L, { fill: theme.series[1]!, stroke: theme.text, width: 1, minPx: 7 });
  const v = s.y[1]!;
  const l = s.y[0]! > 0 ? L - h : L, a = s.y[0]! / l;
  if (Math.abs(v) > 0.02) d.arrowPx(x, y, Math.cos(a) * v, Math.sin(a) * v, clamp(Math.abs(v) * 25, 10, 70), { color: theme.accent });
  d.dot(0, 0, 4, theme.text);
  d.text(`T medido = ${s.meas.T > 0 ? fmt(s.meas.T, 4) + " s" : "—"}   T teórico = ${fmt(periodNail(p), 4)} s`, 0, 0.09 * L, { color: theme.text, size: 12 });
}

export default pendulosEspeciais;
