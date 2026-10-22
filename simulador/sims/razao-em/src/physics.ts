/** Física dos tubos de elétrons: feixe fino em bobinas de Helmholtz, tubo de Thomson e tubo de Teltron. */

export const E_CHARGE = 1.602176634e-19;
export const M_E = 9.1093837015e-31;
/** Razão carga/massa do elétron (C/kg). */
export const EM = E_CHARGE / M_E;
export const MU0 = 4e-7 * Math.PI;

export interface Coils {
  /** Espiras por bobina. */
  N: number;
  /** Raio (m), igual à separação entre as bobinas. */
  R: number;
}

/** Bobinas do tubo de feixe fino (tipo Leybold) e do tubo de deflexão (tipo Teltron). */
export const FINE_COILS: Coils = { N: 130, R: 0.15 };
export const TELTRON_COILS: Coils = { N: 320, R: 0.068 };

/** Campo no centro de um par de Helmholtz: B = (4/5)^{3/2} μ₀NI/R. */
export const helmholtzB = (c: Coils, I: number) => (4 / 5) ** 1.5 * MU0 * c.N * I / c.R;

/** Campo exato no eixo de duas espiras em z = ±R/2 (z medido a partir do centro). */
export function axialB(c: Coils, I: number, z: number): number {
  const R = c.R;
  const loop = (zz: number) => (MU0 * c.N * I * R * R) / (2 * (R * R + zz * zz) ** 1.5);
  return loop(z - R / 2) + loop(z + R / 2);
}

/** Velocidade (não relativística) após aceleração por V volts. */
export const speed = (V: number) => Math.sqrt(2 * EM * V);
/** Raio da órbita circular num campo B uniforme: r = √(2mV/e)/B. */
export const orbitRadius = (V: number, B: number) => (B > 0 ? speed(V) / (EM * B) : Infinity);
/** e/m a partir da tensão, do campo e do raio medido. */
export const emFromRadius = (V: number, B: number, r: number) => (B > 0 && r > 0 ? (2 * V) / (B * B * r * r) : 0);
/** e/m pelo seletor de velocidades (feixe sem deflexão): e/m = E²/(2VB²). */
export const emFromBalance = (V: number, E: number, B: number) => (B > 0 ? (E * E) / (2 * V * B * B) : 0);

export interface Tube {
  /** Comprimento das placas / região de campo (m). */
  l: number;
  /** Distância entre as placas (m). */
  d: number;
  /** Distância livre de campo das placas até a tela (m); 0 no Teltron. */
  drift: number;
  /** Meia altura da tela (m). */
  screen: number;
}

export const THOMSON: Tube = { l: 0.05, d: 0.02, drift: 0.3, screen: 0.06 };
export const TELTRON: Tube = { l: 0.1, d: 0.08, drift: 0, screen: 0.04 };

export interface Beam {
  pts: [number, number][];
  /** Chegou à tela (true) ou bateu numa placa. */
  reached: boolean;
  /** Ordenada final (m). */
  yEnd: number;
}

/**
 * Trajetória (RK4) do elétron que entra em (0, 0) com velocidade v x̂, na região
 * das placas (0 ≤ x ≤ l) com E = −(Vp/d) ŷ (placa de cima positiva) e B = −B ẑ,
 * de modo que a força elétrica aponta para cima e a magnética para baixo.
 */
export function trajectory(tube: Tube, V: number, Vp: number, B: number): Beam {
  const v = speed(V);
  const E = Vp / tube.d;
  const xEnd = tube.l + tube.drift;
  let field = true;
  const acc = (_x: number, vx: number, vy: number): [number, number] => {
    if (!field) return [0, 0];
    // a = −(e/m)(E + v × B), com E = (0, −E) e B = (0, 0, −B)
    return [-EM * (vy * -B), -EM * (-E - vx * -B)];
  };
  let s = [0, 0, v, 0];
  const pts: [number, number][] = [[0, 0]];
  const h0 = 4e-4 / v;
  const f = (y: number[]) => {
    const [ax, ay] = acc(y[0]!, y[2]!, y[3]!);
    return [y[2]!, y[3]!, ax, ay];
  };
  for (let i = 0; i < 20000; i++) {
    // passo encurtado para cair exatamente na borda das placas (o campo é descontínuo ali)
    field = s[0]! < tube.l - 1e-12;
    const h = field && s[2]! > 0 ? Math.min(h0, (tube.l - s[0]!) / s[2]!) : h0;
    const k1 = f(s);
    const k2 = f(s.map((y, j) => y + (h / 2) * k1[j]!));
    const k3 = f(s.map((y, j) => y + (h / 2) * k2[j]!));
    const k4 = f(s.map((y, j) => y + h * k3[j]!));
    const n = s.map((y, j) => y + (h / 6) * (k1[j]! + 2 * k2[j]! + 2 * k3[j]! + k4[j]!));
    const [x, y] = [n[0]!, n[1]!];
    const inPlates = x <= tube.l;
    if (inPlates && Math.abs(y) >= tube.d / 2) {
      pts.push([x, Math.sign(y) * tube.d / 2]);
      return { pts, reached: false, yEnd: Math.sign(y) * tube.d / 2 };
    }
    if (x >= xEnd) {
      // interpola até a tela
      const fr = (xEnd - s[0]!) / (x - s[0]!);
      const yE = s[1]! + fr * (y - s[1]!);
      pts.push([xEnd, yE]);
      return { pts, reached: Math.abs(yE) <= tube.screen, yEnd: yE };
    }
    if (n[2]! <= 0) return { pts, reached: false, yEnd: y };
    s = n;
    if (i % 5 === 0) pts.push([x, y]);
  }
  return { pts, reached: false, yEnd: s[1]! };
}

/** Deflexão na tela só com campo elétrico (pequenos ângulos): Y = (E/2V)·l·(l/2 + D). */
export const thomsonDeflectionE = (tube: Tube, V: number, Vp: number) => ((Vp / tube.d) / (2 * V)) * tube.l * (tube.l / 2 + tube.drift);

/** Ordenada do feixe em x num campo só magnético (círculo), negativa (para baixo). */
export const circleY = (r: number, x: number) => -(r - Math.sqrt(Math.max(0, r * r - x * x)));
/** Raio do círculo que passa pela origem (tangente a x̂) e por (x, y). */
export const radiusThrough = (x: number, y: number) => (Math.abs(y) > 1e-12 ? (x * x + y * y) / (2 * Math.abs(y)) : Infinity);
