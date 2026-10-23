/** Cores aproximadas dos comprimentos de onda visíveis e da luz branca. */

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

/** Cor de um espectro de pesos w(λ): cada canal normalizado pelo branco (w ≡ 1 dá branco). */
export function spectrumColor(w: (nm: number) => number): RGB {
  const acc: RGB = [0, 0, 0];
  for (const nm of WHITE_NM) {
    const c = wavelengthRGB(nm);
    const k = w(nm);
    acc[0] += c[0] * k;
    acc[1] += c[1] * k;
    acc[2] += c[2] * k;
  }
  return [acc[0] / WHITE_SUM[0], acc[1] / WHITE_SUM[1], acc[2] / WHITE_SUM[2]];
}

/** Cor de uma luz monocromática com intensidade relativa I (0–1), normalizada para o canal mais forte. */
export function monoColor(nm: number, I: number): RGB {
  const c = wavelengthRGB(nm);
  const k = I / Math.max(c[0], c[1], c[2], 1e-6);
  return [c[0] * k, c[1] * k, c[2] * k];
}
