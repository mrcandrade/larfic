/** Motor DC de uma espira, força num fio e efeito Hall (unidades SI). */

export const QE = 1.602176634e-19;
/** Momento de inércia do rotor com volante (kg·m²) e atrito viscoso (N·m·s). */
export const J_ROTOR = 2e-3;
export const B_FRIC = 1e-4;

export interface MotorParams {
  V: number;
  R: number;
  B: number;
  N: number;
  /** Lado da espira quadrada (m). */
  L: number;
  comutador: boolean;
  carga: number;
}

/**
 * Corrente na espira e torque magnético. Com comutador, a polaridade aplicada
 * à espira é s = −sinal(sen θ), de modo que o torque da fonte é sempre positivo.
 * i = (sV + ε)/R, ε = NBAω sen θ (fem induzida), τ = −NAB sen θ · i.
 */
export function motorTorque(th: number, w: number, m: MotorParams): { tau: number; i: number; fem: number } {
  const NAB = m.N * m.L * m.L * m.B;
  const sn = Math.sin(th);
  const s = m.comutador ? (sn >= 0 ? -1 : 1) : -1;
  const fem = NAB * w * sn;
  const i = (s * m.V + fem) / m.R;
  return { tau: -NAB * sn * i, i, fem };
}

/** Aceleração angular do rotor (atrito viscoso + carga que só se opõe ao movimento). */
export function motorAccel(th: number, w: number, m: MotorParams): number {
  const { tau } = motorTorque(th, w, m);
  return (tau - B_FRIC * w - m.carga * Math.tanh(w / 0.5)) / J_ROTOR;
}

/** Velocidade de regime com comutador, sem carga: média de τ = 0. */
export function terminalOmega(m: MotorParams): number {
  const NAB = m.N * m.L * m.L * m.B;
  return ((2 * NAB * m.V) / (Math.PI * m.R)) / ((NAB * NAB) / (2 * m.R) + B_FRIC);
}

export type V2 = [number, number];

/** Pontos do fio: reto de a até b, ou semicírculo sobre o segmento ab. */
export function wirePoints(a: V2, b: V2, forma: number, n = 24): V2[] {
  if (forma !== 1) return [a, b];
  const cx = (a[0] + b[0]) / 2;
  const cy = (a[1] + b[1]) / 2;
  const r = Math.hypot(b[0] - a[0], b[1] - a[1]) / 2;
  const a0 = Math.atan2(a[1] - cy, a[0] - cx);
  const pts: V2[] = [];
  for (let k = 0; k <= n; k++) {
    const t = a0 - (Math.PI * k) / n; // sentido horário: o arco fica à esquerda de a→b
    pts.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]);
  }
  return pts;
}

/**
 * Força num fio F = I Σ dL × B, com B saindo da tela (+z), entrando (−z) ou
 * no plano (+x). Devolve (Fx, Fy, Fz) somando segmento por segmento.
 */
export function wireForce(pts: V2[], I: number, B: number, bdir: number): [number, number, number] {
  const Bv: [number, number, number] = bdir === 0 ? [0, 0, B] : bdir === 1 ? [0, 0, -B] : [B, 0, 0];
  let Fx = 0;
  let Fy = 0;
  let Fz = 0;
  for (let k = 1; k < pts.length; k++) {
    const dx = pts[k]![0] - pts[k - 1]![0];
    const dy = pts[k]![1] - pts[k - 1]![1];
    Fx += I * (dy * Bv[2]);
    Fy += I * (-dx * Bv[2]);
    Fz += I * (dx * Bv[1] - dy * Bv[0]);
  }
  return [Fx, Fy, Fz];
}

export interface Material {
  nome: string;
  /** Densidade de portadores (m⁻³). */
  n: number;
  /** Sinal da carga dos portadores. */
  sinal: 1 | -1;
}

export const MATERIAIS: Material[] = [
  { nome: "Semicondutor tipo n (elétrons)", n: 1e21, sinal: -1 },
  { nome: "Semicondutor tipo p (lacunas, +)", n: 1e21, sinal: 1 },
  { nome: "Cobre (elétrons)", n: 8.5e28, sinal: -1 },
  { nome: "Germânio tipo p (lacunas, +)", n: 5e22, sinal: 1 },
];

/**
 * Tensão Hall de regime, V_H = V_inferior − V_superior = IB/(nqt), com q com sinal.
 * Corrente em +x, B em +z: as duas espécies de portador são empurradas para baixo.
 */
export const hallVoltage = (I: number, B: number, n: number, sinal: number, t: number) => (I * B) / (n * sinal * QE * t);

/** Velocidade de deriva v_d = I/(n|q|wt). */
export const driftVelocity = (I: number, n: number, w: number, t: number) => I / (n * QE * w * t);
