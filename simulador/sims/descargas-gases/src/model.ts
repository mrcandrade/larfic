/** Condução elétrica em gases: Paschen, curva V–I, raios catódicos, lâmpadas, arco, bobina e ionização. */

export const E_CHARGE = 1.602176634e-19;
export const M_E = 9.1093837015e-31;
export const C_LIGHT = 299792458;
export const K_B = 1.380649e-23;
export const HC_EVNM = 1239.84198; // h c em eV·nm
export const TORR = 133.322;
export const K_C = 8.9875517923e9;

export interface Gas {
  name: string;
  /** Constantes de Paschen: A em 1/(cm·Torr), B em V/(cm·Torr), γ (emissão secundária). */
  A: number;
  B: number;
  gamma: number;
  /** p·d_c da região escura catódica (Torr·cm). */
  pdc: number;
  color: string;
}

export const GASES: Gas[] = [
  { name: "Ar", A: 15, B: 365, gamma: 0.01, pdc: 0.25, color: "#d77dff" },
  { name: "Neônio", A: 4, B: 100, gamma: 0.02, pdc: 0.64, color: "#ff5a1f" },
  { name: "Argônio", A: 12, B: 180, gamma: 0.02, pdc: 0.29, color: "#a98cff" },
  { name: "Hidrogênio", A: 5, B: 130, gamma: 0.01, pdc: 0.72, color: "#ff6fb0" },
  { name: "Vapor de mercúrio", A: 20, B: 370, gamma: 0.01, pdc: 0.33, color: "#8fb3ff" },
];

const lnln = (g: number) => Math.log(Math.log(1 + 1 / g));

/** Tensão de ruptura de Paschen; à esquerda do mínimo cresce muito (devolve Infinity se ln ≤ 0). */
export function paschenV(g: Gas, pTorr: number, dCm: number): number {
  const pd = pTorr * dCm;
  const den = Math.log(g.A * pd) - lnln(g.gamma);
  return den > 0 ? (g.B * pd) / den : Infinity;
}
/** Mínimo de Paschen: (pd)_mín = e·ln(1 + 1/γ)/A, V_mín = B (pd)_mín. */
export const paschenMinPd = (g: Gas) => (Math.E * Math.log(1 + 1 / g.gamma)) / g.A;
export const paschenMinV = (g: Gas) => g.B * paschenMinPd(g);

/** Livre caminho médio (m): λ = kT/(√2 π d² p). */
export const meanFreePath = (pTorr: number, T = 300, dMol = 3.7e-10) => (K_B * T) / (Math.SQRT2 * Math.PI * dMol * dMol * pTorr * TORR);

/** Pressão sob bombeamento exponencial. */
export const pumpPressure = (p0: number, pUlt: number, tau: number, t: number) => pUlt + (p0 - pUlt) * Math.exp(-t / tau);

// ---------------------------------------------------------------------------
// Curva característica V–I (lâmpada neon NE-2 típica)
// ---------------------------------------------------------------------------

export const NEON_VB = 90;
export const NEON_VN = 60;
/** Pontos (log10 I, V) da característica: escura, transição, normal, anormal, transição ao arco, arco. */
export const VI_POINTS: [number, number][] = [
  [-12, 0],
  [-10, 30],
  [-7, 85],
  [-6, NEON_VB],
  [-4.5, NEON_VN],
  [-2, NEON_VN],
  [-0.5, 140],
  [0.7, 40],
  [3, 25],
];

export function vOfI(I: number): number {
  const x = Math.log10(Math.max(I, 1e-12));
  const P = VI_POINTS;
  if (x >= P[P.length - 1]![0]) return P[P.length - 1]![1];
  for (let i = 1; i < P.length; i++) {
    const [x1, v1] = P[i]!;
    const [x0, v0] = P[i - 1]!;
    if (x <= x1) return v0 + ((v1 - v0) * (x - x0)) / (x1 - x0);
  }
  return P[0]![1];
}

/** Interseções da reta de carga V = E − IR com a característica (I crescente), com estabilidade. */
export function operatingPoints(E: number, R: number): { I: number; V: number; stable: boolean }[] {
  const out: { I: number; V: number; stable: boolean }[] = [];
  const g = (I: number) => E - I * R - vOfI(I);
  const n = 3000;
  let xPrev = -12;
  let gPrev = g(1e-12);
  for (let k = 1; k <= n; k++) {
    const x = -12 + (15 * k) / n;
    const gx = g(10 ** x);
    if (gPrev === 0 || gPrev * gx < 0) {
      let lo = xPrev;
      let hi = x;
      for (let i = 0; i < 60; i++) {
        const mid = (lo + hi) / 2;
        if (g(10 ** lo) * g(10 ** mid) <= 0) hi = mid;
        else lo = mid;
      }
      const I = 10 ** ((lo + hi) / 2);
      // Estável se g decresce com I (R + dV/dI > 0).
      out.push({ I, V: vOfI(I), stable: gx < gPrev });
    }
    xPrev = x;
    gPrev = gx;
  }
  return out;
}

/** Período do oscilador de relaxação: T = RC ln((E − Ve)/(E − Vb)). */
export const relaxationPeriod = (E: number, R: number, C: number, Vb = NEON_VB, Ve = NEON_VN) => (E > Vb ? R * C * Math.log((E - Ve) / (E - Vb)) : Infinity);

// ---------------------------------------------------------------------------
// Raios catódicos
// ---------------------------------------------------------------------------

/** Momento relativístico do elétron acelerado por V volts. */
export function electronMomentum(V: number): number {
  const K = E_CHARGE * V;
  const mc2 = M_E * C_LIGHT * C_LIGHT;
  return Math.sqrt(K * K + 2 * K * mc2) / C_LIGHT;
}
export function electronSpeed(V: number): number {
  const gamma = 1 + (E_CHARGE * V) / (M_E * C_LIGHT * C_LIGHT);
  return C_LIGHT * Math.sqrt(1 - 1 / (gamma * gamma));
}
/** Raio de curvatura num campo B (m). */
export const larmorRadius = (V: number, B: number) => electronMomentum(V) / (E_CHARGE * Math.abs(B));

/**
 * Traça um elétron no plano (x, y) em metros, campo B_z(x, y) (T), partindo de
 * (x0, y0) com ângulo th0, até x = xEnd. Passo em comprimento de arco: dθ/ds = +eB/p (carga negativa).
 */
export function traceElectron(V: number, Bz: (x: number, y: number) => number, x0: number, y0: number, th0: number, xEnd: number, ds = 1e-3): [number, number][] {
  const p = electronMomentum(V);
  let x = x0;
  let y = y0;
  let th = th0;
  const pts: [number, number][] = [[x, y]];
  for (let i = 0; i < 5000 && x < xEnd; i++) {
    // Ponto médio para a curvatura (2ª ordem).
    const k1 = (E_CHARGE * Bz(x, y)) / p;
    const xm = x + 0.5 * ds * Math.cos(th);
    const ym = y + 0.5 * ds * Math.sin(th);
    const thm = th + 0.5 * ds * k1;
    const k2 = (E_CHARGE * Bz(xm, ym)) / p;
    x += ds * Math.cos(thm);
    y += ds * Math.sin(thm);
    th += ds * k2;
    if (Math.cos(th) <= 0.05) break;
    pts.push([x, y]);
  }
  return pts;
}

// ---------------------------------------------------------------------------
// Lâmpadas: níveis e linhas
// ---------------------------------------------------------------------------

export interface Line {
  nm: number;
  w: number;
}
export interface LampGas {
  name: string;
  /** Limiares de excitação (eV) e as linhas emitidas por cada nível. */
  levels: { E: number; lines: Line[] }[];
  sigma: number;
}

export const LAMP_GASES: LampGas[] = [
  {
    name: "Neônio",
    sigma: 2e-20,
    levels: [
      {
        E: 18.7,
        lines: [
          { nm: 540.1, w: 1 },
          { nm: 585.2, w: 3 },
          { nm: 614.3, w: 2 },
          { nm: 640.2, w: 4 },
          { nm: 703.2, w: 2 },
        ],
      },
    ],
  },
  {
    name: "Mercúrio",
    sigma: 5e-20,
    levels: [
      { E: 4.89, lines: [{ nm: 253.7, w: 1 }] },
      {
        E: 7.73,
        lines: [
          { nm: 404.7, w: 1 },
          { nm: 435.8, w: 2 },
          { nm: 546.1, w: 2 },
          { nm: 577.0, w: 1 },
        ],
      },
    ],
  },
];
/** Fósforo tricromático da lâmpada fluorescente. */
export const PHOSPHOR: Line[] = [
  { nm: 450, w: 3 },
  { nm: 545, w: 4 },
  { nm: 611, w: 3 },
];
export const PHOSPHOR_QE = 0.9;
export const photonEV = (nm: number) => HC_EVNM / nm;

export function pickLine(lines: Line[], u: number): Line {
  const tot = lines.reduce((a, l) => a + l.w, 0);
  let acc = 0;
  for (const l of lines) {
    acc += l.w / tot;
    if (u <= acc) return l;
  }
  return lines[lines.length - 1]!;
}

/** Cor aproximada (r, g, b ∈ [0, 1]) de um comprimento de onda visível. */
export function wavelengthRGB(nm: number): [number, number, number] {
  let r = 0;
  let g = 0;
  let b = 0;
  if (nm >= 380 && nm < 440) [r, g, b] = [(440 - nm) / 60, 0, 1];
  else if (nm < 490) [r, g, b] = [0, (nm - 440) / 50, 1];
  else if (nm < 510) [r, g, b] = [0, 1, (510 - nm) / 20];
  else if (nm < 580) [r, g, b] = [(nm - 510) / 70, 1, 0];
  else if (nm < 645) [r, g, b] = [1, (645 - nm) / 65, 0];
  else if (nm <= 780) [r, g, b] = [1, 0, 0];
  return [r, g, b];
}
export const rgbCss = ([r, g, b]: [number, number, number], a = 1) => `rgba(${Math.round(255 * r)}, ${Math.round(255 * g)}, ${Math.round(255 * b)}, ${a})`;

// ---------------------------------------------------------------------------
// Arco elétrico (equação de Ayrton, eletrodos de carvão)
// ---------------------------------------------------------------------------

export const AYRTON = { A: 38.9, B: 2.07, C: 11.7, D: 10.5 };
export const arcV = (I: number, dmm: number) => AYRTON.A + AYRTON.B * dmm + (AYRTON.C + AYRTON.D * dmm) / I;

/** Corrente estável do arco com fonte E e reator R (raiz maior); NaN se o arco não se sustenta. */
export function arcCurrent(E: number, R: number, dmm: number): number {
  const b = E - AYRTON.A - AYRTON.B * dmm;
  const c = AYRTON.C + AYRTON.D * dmm;
  const disc = b * b - 4 * R * c;
  if (b <= 0 || disc < 0) return NaN;
  return (b + Math.sqrt(disc)) / (2 * R);
}

/** Maior comprimento do arco: (E − A − Bd)² = 4R(C + Dd). */
export function arcMaxGap(E: number, R: number): number {
  const { A, B, C, D } = AYRTON;
  // B²d² − (2B(E−A) + 4RD) d + (E−A)² − 4RC = 0, raiz menor.
  const a2 = B * B;
  const b2 = -(2 * B * (E - A) + 4 * R * D);
  const c2 = (E - A) ** 2 - 4 * R * C;
  if (c2 < 0) return 0;
  return (-b2 - Math.sqrt(b2 * b2 - 4 * a2 * c2)) / (2 * a2);
}

// ---------------------------------------------------------------------------
// Bobina de indução e ionização
// ---------------------------------------------------------------------------

export const COIL = { R1: 1, L1: 5e-3, k: 0.8, tOff: 4e-3, breakFrac: 0.8 };
/** Pico no secundário ao abrir o primário: V₂ = k (N₂/N₁) I √(L₁/C₁). */
export const coilPeak = (I: number, ratio: number, C1: number) => COIL.k * ratio * I * Math.sqrt(COIL.L1 / C1);

/** Paschen do ar a 1 atm, d em mm. */
export const airBreakdown = (dmm: number) => paschenV(GASES[0]!, 760, Math.max(dmm, 0.05) / 10);

/** Corrente de ionização de saturação: I = e q V. q em pares/(cm³·s), V em cm³. */
export const ionCurrent = (q: number, volCm3: number) => E_CHARGE * q * volCm3;

/** Ângulo das folhas do eletroscópio (rad) para carga q (nC), L (cm), m (mg). */
export function leafAngle(qnC: number, L = 5, m = 30): number {
  const q = Math.abs(qnC) * 1e-9;
  if (q === 0) return 0;
  const f = (th: number) => (K_C * (q / 2) ** 2) / (2 * L * 1e-2 * Math.sin(th)) ** 2 - m * 1e-6 * 9.81 * Math.tan(th);
  let lo = 1e-6;
  let hi = Math.PI / 2 - 1e-6;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (f(mid) > 0) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}
