/** Gotas de óleo de Millikan: lei de Stokes com correção de Cunningham e movimento browniano. */

export const E_CHARGE = 1.602176634e-19;
export const KB = 1.380649e-23;
export const G = 9.81;
/** Densidade do óleo e do ar (kg/m³). */
export const RHO_OIL = 886;
export const RHO_AIR = 1.2;
/** Constante de Cunningham b (Pa·m) e pressão atmosférica (Pa). */
export const B_CUNN = 8.2e-3;
export const P_ATM = 101325;
/** Distância entre as placas (m). */
export const GAP = 6e-3;
/** Distância entre as linhas do retículo usadas na cronometragem (m). */
export const RETICLE = 1e-3;

/** Viscosidade do ar (Pa·s) pela fórmula de Sutherland, T em °C. */
export const viscosity = (Tc: number) => {
  const T = Tc + 273.15;
  return 1.8325e-5 * (416.16 / (T + 120)) * (T / 296.16) ** 1.5;
};

/** Fator de Cunningham C = 1 + b/(p r). */
export const cunningham = (r: number) => 1 + B_CUNN / (P_ATM * r);
/** Massa aparente (descontado o empuxo do ar). */
export const apparentMass = (r: number) => (4 / 3) * Math.PI * r ** 3 * (RHO_OIL - RHO_AIR);

/** Velocidade vertical terminal (m/s, positiva para cima) da gota de carga q no campo E. */
export function drift(r: number, q: number, E: number, Tc: number): number {
  return ((q * E - apparentMass(r) * G) * cunningham(r)) / (6 * Math.PI * viscosity(Tc) * r);
}

/** Velocidade de queda livre (m/s, positiva). */
export const fallSpeed = (r: number, Tc: number) => -drift(r, 0, 0, Tc);

/** Coeficiente de difusão D = k_B T C/(6πηr). */
export const diffusion = (r: number, Tc: number) => (KB * (Tc + 273.15) * cunningham(r)) / (6 * Math.PI * viscosity(Tc) * r);

/** Tensão que equilibra a gota (V). */
export const balanceVoltage = (r: number, q: number) => (apparentMass(r) * G * GAP) / q;

/**
 * Raio a partir da velocidade de queda. Sem correção: r = √(9ηv/(2ρ'g)).
 * Com correção de Cunningham, resolve r² + (b/p) r − 9ηv/(2ρ'g) = 0.
 */
export function radiusFromFall(v: number, Tc: number, corr: boolean): number {
  const a2 = (9 * viscosity(Tc) * v) / (2 * (RHO_OIL - RHO_AIR) * G);
  if (!corr) return Math.sqrt(a2);
  const h = B_CUNN / (2 * P_ATM);
  return Math.sqrt(h * h + a2) - h;
}

/** Carga pelo método de queda e subida: q = 6πη_ef r (v_q + v_s)/E. */
export function chargeFromVelocities(vFall: number, vRise: number, V: number, Tc: number, corr: boolean): number {
  const r = radiusFromFall(vFall, Tc, corr);
  const eta = viscosity(Tc) / (corr ? cunningham(r) : 1);
  return (6 * Math.PI * eta * r * (vFall + vRise)) / (V / GAP);
}

/** Carga pelo método da tensão de equilíbrio: q = m'g d/V. */
export function chargeFromBalance(vFall: number, V: number, Tc: number, corr: boolean): number {
  const r = radiusFromFall(vFall, Tc, corr);
  return (apparentMass(r) * G * GAP) / V;
}

/** Melhor carga elementar que explica as cargas medidas como múltiplos inteiros. */
export function estimateE(qs: number[]): number {
  if (!qs.length) return 0;
  let best = 0;
  let bestS = Infinity;
  for (let e = 1.3e-19; e <= 2.0e-19; e += 2e-23) {
    let S = 0;
    for (const q of qs) {
      const x = q / e;
      S += (x - Math.round(x)) ** 2;
    }
    if (S < bestS) {
      bestS = S;
      best = e;
    }
  }
  let num = 0;
  let den = 0;
  for (const q of qs) {
    const n = Math.max(1, Math.round(q / best));
    num += q * n;
    den += n * n;
  }
  return num / den;
}
