/**
 * Cor aproximada de uma luz monocromática (aproximação clássica de Dan Bruton),
 * com atenuação nas bordas do visível. Fora de 380–750 nm devolve `fallback`.
 */
export function wavelengthColor(nm: number, fallback = "#8a63d2"): string {
  if (nm < 380 || nm > 750) return fallback;
  let r = 0;
  let g = 0;
  let b = 0;
  if (nm < 440) {
    r = -(nm - 440) / 60;
    b = 1;
  } else if (nm < 490) {
    g = (nm - 440) / 50;
    b = 1;
  } else if (nm < 510) {
    g = 1;
    b = -(nm - 510) / 20;
  } else if (nm < 580) {
    r = (nm - 510) / 70;
    g = 1;
  } else if (nm < 645) {
    r = 1;
    g = -(nm - 645) / 65;
  } else r = 1;
  const edge = nm < 420 ? 0.35 + (0.65 * (nm - 380)) / 40 : nm > 700 ? 0.35 + (0.65 * (750 - nm)) / 50 : 1;
  const c = (v: number) => Math.round(255 * (v * edge) ** 0.8);
  return `rgb(${c(r)}, ${c(g)}, ${c(b)})`;
}

/** Faixa espectral em palavras. */
export function bandName(nm: number): string {
  if (nm < 380) return "ultravioleta";
  if (nm > 750) return "infravermelho";
  if (nm < 450) return "violeta";
  if (nm < 495) return "azul";
  if (nm < 570) return "verde";
  if (nm < 590) return "amarelo";
  if (nm < 620) return "laranja";
  return "vermelho";
}
