/** Física e cores da fenda dupla (unidades: λ em nm, d e a em mm, L em m, y em mm). */

export type RGB = [number, number, number];

/** Cor aproximada (linear, 0–1) de um comprimento de onda visível (aproximação de Bruton). */
export function wavelengthRGB(nm: number): RGB {
  let r = 0;
  let g = 0;
  let b = 0;
  if (nm >= 380 && nm < 440) {
    r = -(nm - 440) / 60;
    b = 1;
  } else if (nm < 490 && nm >= 440) {
    g = (nm - 440) / 50;
    b = 1;
  } else if (nm < 510 && nm >= 490) {
    g = 1;
    b = -(nm - 510) / 20;
  } else if (nm < 580 && nm >= 510) {
    r = (nm - 510) / 70;
    g = 1;
  } else if (nm < 645 && nm >= 580) {
    r = 1;
    g = -(nm - 645) / 65;
  } else if (nm <= 780 && nm >= 645) {
    r = 1;
  }
  let f = 0;
  if (nm >= 380 && nm < 420) f = 0.3 + (0.7 * (nm - 380)) / 40;
  else if (nm >= 420 && nm <= 700) f = 1;
  else if (nm > 700 && nm <= 780) f = 0.3 + (0.7 * (780 - nm)) / 80;
  return [r * f, g * f, b * f];
}

/** Amostras do espectro de "luz branca" (espectro plano entre 400 e 700 nm). */
export const WHITE_NM: number[] = Array.from({ length: 61 }, (_, i) => 400 + 5 * i);
const WHITE_SUM: RGB = WHITE_NM.reduce<RGB>((acc, nm) => {
  const c = wavelengthRGB(nm);
  return [acc[0] + c[0], acc[1] + c[1], acc[2] + c[2]];
}, [0, 0, 0]);

/** Converte uma cor linear 0–1 em string CSS com correção gama simples. */
export function cssRGB(c: RGB, gamma = 0.6): string {
  const f = (v: number) => Math.round(255 * Math.min(1, Math.max(0, v)) ** gamma);
  return `rgb(${f(c[0])},${f(c[1])},${f(c[2])})`;
}

export const sinc = (x: number) => (Math.abs(x) < 1e-9 ? 1 : Math.sin(x) / x);

/** Modelos: 0 = fendas reais (interferência × difração), 1 = fendas estreitas (só interferência), 2 = uma fenda só. */
export interface Slits {
  lambda: number; // nm
  d: number; // mm
  a: number; // mm
  L: number; // m
  model: number;
}

export const sinTheta = (yMm: number, L: number) => {
  const y = yMm * 1e-3;
  return y / Math.hypot(y, L);
};

/** Intensidade relativa (I/I₀, máximo 1 no centro) para um comprimento de onda. */
export function intensityAt(yMm: number, s: Slits, lambda = s.lambda): number {
  const st = sinTheta(yMm, s.L);
  const lam = lambda * 1e-9;
  const beta = (Math.PI * s.a * 1e-3 * st) / lam;
  const alpha = (Math.PI * s.d * 1e-3 * st) / lam;
  const env = sinc(beta) ** 2;
  if (s.model === 2) return env;
  const inter = Math.cos(alpha) ** 2;
  return s.model === 1 ? inter : inter * env;
}

/** Envoltória de difração de uma fenda (sinc²). */
export function envelopeAt(yMm: number, s: Slits, lambda = s.lambda): number {
  const st = sinTheta(yMm, s.L);
  return sinc((Math.PI * s.a * 1e-3 * st) / (lambda * 1e-9)) ** 2;
}

/** Intensidade média sobre o espectro branco. */
export function whiteIntensity(yMm: number, s: Slits): number {
  let sum = 0;
  for (const nm of WHITE_NM) sum += intensityAt(yMm, s, nm);
  return sum / WHITE_NM.length;
}

/** Cor na tela: com luz branca, soma das cores de cada λ ponderadas pela intensidade (centro = branco). */
export function colorAt(yMm: number, s: Slits, white: boolean): RGB {
  if (!white) {
    const c = wavelengthRGB(s.lambda);
    const I = intensityAt(yMm, s);
    const k = 1 / Math.max(c[0], c[1], c[2], 1e-6);
    return [c[0] * k * I, c[1] * k * I, c[2] * k * I];
  }
  const acc: RGB = [0, 0, 0];
  for (const nm of WHITE_NM) {
    const c = wavelengthRGB(nm);
    const I = intensityAt(yMm, s, nm);
    acc[0] += c[0] * I;
    acc[1] += c[1] * I;
    acc[2] += c[2] * I;
  }
  return [acc[0] / WHITE_SUM[0], acc[1] / WHITE_SUM[1], acc[2] / WHITE_SUM[2]];
}

/** Espaçamento entre franjas claras na aproximação de ângulos pequenos (mm). */
export const fringeSpacing = (s: Slits) => (s.lambda * 1e-9 * s.L) / (s.d * 1e-3) * 1e3;

/** Número de franjas claras dentro do máximo central de difração (|sen θ| < λ/a). Ordens que caem num zero da envoltória não contam. */
export const fringesInCentral = (d: number, a: number) => 2 * Math.ceil(d / a - 1e-9) - 1;
