/** Física de ímãs, bússolas e campo da Terra (unidades SI). */

/** μ₀/4π em T·m/A. */
export const K_M = 1e-7;
/** Comprimento e largura do ímã em barra (m). */
export const MAG_L = 0.1;
export const MAG_W = 0.024;
/** Separação efetiva dos polos: num ímã real os polos ficam um pouco para dentro das pontas. */
export const POLE_D = 0.85 * MAG_L;
/** Amortecimento numérico do campo perto dos polos (m), evita a singularidade 1/r². */
const SOFT = 0.004;
/** Agulha: momento magnético (A·m²) e momento de inércia (kg·m²). */
export const NEEDLE_MU = 0.05;
export const NEEDLE_I = 5e-8;
/** Campo da Terra no equador magnético, na superfície (T), para o dipolo geocêntrico. */
export const B0_EARTH = 30e-6;

export interface Magnet {
  x: number;
  y: number;
  /** Ângulo do eixo S→N (rad, a partir de +x). */
  ang: number;
}

export type V2 = [number, number];

/**
 * Campo de um ímã no plano.
 * modelo 0: dois polos (cargas magnéticas ±q_m = ±m/d nas pontas);
 * modelo 1: dipolo pontual B = (μ₀/4π)[3(m·r̂)r̂ − m]/r³.
 */
export function magnetField(mag: Magnet, m: number, modelo: number, x: number, y: number): V2 {
  const ux = Math.cos(mag.ang);
  const uy = Math.sin(mag.ang);
  if (modelo === 1) {
    const rx = x - mag.x;
    const ry = y - mag.y;
    const r2 = rx * rx + ry * ry + SOFT * SOFT;
    const r = Math.sqrt(r2);
    const mr = (m * (ux * rx + uy * ry)) / r;
    const k = K_M / (r2 * r);
    return [k * ((3 * mr * rx) / r - m * ux), k * ((3 * mr * ry) / r - m * uy)];
  }
  const q = m / POLE_D;
  const nx = mag.x + (ux * POLE_D) / 2;
  const ny = mag.y + (uy * POLE_D) / 2;
  const sx = mag.x - (ux * POLE_D) / 2;
  const sy = mag.y - (uy * POLE_D) / 2;
  const dnx = x - nx;
  const dny = y - ny;
  const dsx = x - sx;
  const dsy = y - sy;
  const rn = Math.pow(dnx * dnx + dny * dny + SOFT * SOFT, 1.5);
  const rs = Math.pow(dsx * dsx + dsy * dsy + SOFT * SOFT, 1.5);
  return [K_M * q * (dnx / rn - dsx / rs), K_M * q * (dny / rn - dsy / rs)];
}

/** Campo total na bancada: ímãs + componente horizontal da Terra (apontando para o norte, +y). */
export function benchField(mags: Magnet[], m: number, modelo: number, bTerra: number, x: number, y: number): V2 {
  let bx = 0;
  let by = bTerra;
  for (const g of mags) {
    const b = magnetField(g, m, modelo, x, y);
    bx += b[0];
    by += b[1];
  }
  return [bx, by];
}

/** Campo no eixo de um dipolo pontual (posição de Gauss A): B = (μ₀/4π)·2m/r³. */
export const axialDipole = (m: number, r: number) => (2 * K_M * m) / r ** 3;

/** Inclinação do dipolo geocêntrico: tan I = 2 tan λ (graus; positivo = campo apontando para baixo). */
export function dipInclination(latDeg: number): number {
  return (Math.atan(2 * Math.tan((latDeg * Math.PI) / 180)) * 180) / Math.PI;
}

/** Componentes do campo do dipolo terrestre na superfície: horizontal (para o norte) e vertical (para baixo). */
export function earthComponents(latDeg: number): { H: number; Z: number; F: number } {
  const l = (latDeg * Math.PI) / 180;
  const H = B0_EARTH * Math.cos(l);
  const Z = 2 * B0_EARTH * Math.sin(l);
  return { H, Z, F: Math.hypot(H, Z) };
}

/** Polo norte geomagnético (modelo de dipolo inclinado, época ~2020). */
export const GEOMAG_POLE = { lat: 80.7, lon: -72.7 };
/** Porto Alegre (RS). */
export const POA = { lat: -30.03, lon: -51.23 };
/** Valores medidos aproximados em Porto Alegre (modelos IGRF/WMM, década de 2020). */
export const POA_MEDIDO = { declinacao: -15, inclinacao: -36, F: 23e-6 };

const R = Math.PI / 180;

/** Latitude geomagnética (graus) de um ponto, para o dipolo inclinado. */
export function geomagneticLatitude(lat: number, lon: number, pole = GEOMAG_POLE): number {
  const s = Math.sin(lat * R) * Math.sin(pole.lat * R) + Math.cos(lat * R) * Math.cos(pole.lat * R) * Math.cos((lon - pole.lon) * R);
  return Math.asin(s) / R;
}

/** Declinação prevista pelo dipolo inclinado: azimute do polo geomagnético visto do ponto (graus, + para leste). */
export function dipoleDeclination(lat: number, lon: number, pole = GEOMAG_POLE): number {
  const dl = (pole.lon - lon) * R;
  const y = Math.sin(dl) * Math.cos(pole.lat * R);
  const x = Math.cos(lat * R) * Math.sin(pole.lat * R) - Math.sin(lat * R) * Math.cos(pole.lat * R) * Math.cos(dl);
  return Math.atan2(y, x) / R;
}

/** Ângulo em (−π, π]. */
export function wrapPi(a: number): number {
  let x = (a + Math.PI) % (2 * Math.PI);
  if (x < 0) x += 2 * Math.PI;
  return x - Math.PI;
}

/**
 * Agulha magnética amortecida: I θ̈ = μ B sen(φ − θ) − I γ θ̇.
 * Avança (θ, ω) por dt com RK4, subdividindo o passo quando o campo é forte.
 */
export function needleStep(th: number, w: number, B: number, phi: number, gamma: number, dt: number): [number, number] {
  const w0sq = (NEEDLE_MU * B) / NEEDLE_I;
  const n = Math.max(1, Math.ceil((Math.sqrt(w0sq) * dt) / 0.3));
  const h = dt / n;
  const acc = (a: number, ww: number) => w0sq * Math.sin(phi - a) - gamma * ww;
  for (let i = 0; i < n; i++) {
    const k1t = w;
    const k1w = acc(th, w);
    const k2t = w + (h / 2) * k1w;
    const k2w = acc(th + (h / 2) * k1t, k2t);
    const k3t = w + (h / 2) * k2w;
    const k3w = acc(th + (h / 2) * k2t, k3t);
    const k4t = w + h * k3w;
    const k4w = acc(th + h * k3t, k4t);
    th += (h / 6) * (k1t + 2 * k2t + 2 * k3t + k4t);
    w += (h / 6) * (k1w + 2 * k2w + 2 * k3w + k4w);
  }
  return [wrapPi(th), w];
}

/**
 * Traça uma linha de campo a partir de (x0, y0) seguindo a direção de B (sentido +1)
 * ou contrária (−1). Para quando `stop` devolve verdadeiro ou após `maxSteps` passos.
 */
export function traceLine(
  field: (x: number, y: number) => V2,
  x0: number,
  y0: number,
  ds: number,
  maxSteps: number,
  stop: (x: number, y: number) => boolean,
  dir = 1,
): V2[] {
  const pts: V2[] = [[x0, y0]];
  let x = x0;
  let y = y0;
  const unit = (px: number, py: number): V2 | null => {
    const b = field(px, py);
    const n = Math.hypot(b[0], b[1]);
    return n < 1e-15 ? null : [(dir * b[0]) / n, (dir * b[1]) / n];
  };
  for (let i = 0; i < maxSteps; i++) {
    // Ponto médio (RK2) com passo de comprimento fixo
    const a = unit(x, y);
    if (!a) break;
    const b = unit(x + (a[0] * ds) / 2, y + (a[1] * ds) / 2);
    if (!b) break;
    x += b[0] * ds;
    y += b[1] * ds;
    pts.push([x, y]);
    if (stop(x, y)) break;
  }
  return pts;
}
