/** Radiação de corpo negro em unidades SI (λ em metros, T em kelvin). */

export const H = 6.62607015e-34;
export const C = 299792458;
export const KB = 1.380649e-23;
export const SIGMA = 5.670374419e-8;
/** Constante de Wien b = λ_max·T. */
export const WIEN_B = 2.897771955e-3;

/** Exitância espectral de Planck M_λ = π B_λ, em W/(m²·m). Integrada em λ dá σT⁴. */
export function planck(lam: number, T: number): number {
  if (lam <= 0 || T <= 0) return 0;
  const x = (H * C) / (lam * KB * T);
  if (x > 700) return 0;
  return (2 * Math.PI * H * C * C) / (lam ** 5 * Math.expm1(x));
}

/** Rayleigh–Jeans (clássica): 2πckT/λ⁴. Diverge para λ → 0. */
export function rayleighJeans(lam: number, T: number): number {
  return (2 * Math.PI * C * KB * T) / lam ** 4;
}

/** Aproximação de Wien (λ curto): 2πhc²/λ⁵ · e^(−hc/λkT). */
export function wienApprox(lam: number, T: number): number {
  const x = (H * C) / (lam * KB * T);
  return x > 700 ? 0 : ((2 * Math.PI * H * C * C) / lam ** 5) * Math.exp(-x);
}

/** ∫ M_λ dλ entre a e b (Simpson em ln λ). */
export function integrate(T: number, a: number, b: number, n = 2000): number {
  const la = Math.log(a);
  const lb = Math.log(b);
  const h = (lb - la) / n;
  let s = 0;
  for (let i = 0; i <= n; i++) {
    const lam = Math.exp(la + i * h);
    const f = planck(lam, T) * lam;
    s += f * (i === 0 || i === n ? 1 : i % 2 ? 4 : 2);
  }
  return (s * h) / 3;
}

/** Potência total por área pela integração numérica do espectro (confere com σT⁴). */
export function totalNumeric(T: number): number {
  const lp = WIEN_B / T;
  return integrate(T, lp * 0.03, lp * 400, 4000);
}

/** Pico do espectro por busca numérica (seção áurea em ln λ). */
export function peakNumeric(T: number): number {
  let a = Math.log(WIEN_B / T / 3);
  let b = Math.log((WIEN_B / T) * 3);
  const g = (Math.sqrt(5) - 1) / 2;
  for (let i = 0; i < 200; i++) {
    const c = b - g * (b - a);
    const d = a + g * (b - a);
    if (planck(Math.exp(c), T) > planck(Math.exp(d), T)) b = d;
    else a = c;
  }
  return Math.exp((a + b) / 2);
}

export const VIS_MIN = 380e-9;
export const VIS_MAX = 750e-9;

/** Fração da potência emitida no visível (380–750 nm). */
export function visibleFraction(T: number): number {
  return integrate(T, VIS_MIN, VIS_MAX, 400) / (SIGMA * T ** 4);
}

// Funções de cor CIE 1931 (ajuste analítico de Wyman, Sloan e Shirley, 2013), λ em nm.
const lobe = (x: number, mu: number, s1: number, s2: number) => {
  const t = (x - mu) / (x < mu ? s1 : s2);
  return Math.exp(-0.5 * t * t);
};
export function cieXYZ(nm: number): [number, number, number] {
  return [
    1.056 * lobe(nm, 599.8, 37.9, 31.0) + 0.362 * lobe(nm, 442.0, 16.0, 26.7) - 0.065 * lobe(nm, 501.1, 20.4, 26.2),
    0.821 * lobe(nm, 568.8, 46.9, 40.5) + 0.286 * lobe(nm, 530.9, 16.3, 31.1),
    1.217 * lobe(nm, 437.0, 11.8, 36.0) + 0.681 * lobe(nm, 459.0, 26.0, 13.8),
  ];
}

/** XYZ do espectro de Planck (soma de 380 a 780 nm, passo 5 nm). */
export function spectrumXYZ(T: number): [number, number, number] {
  let X = 0, Y = 0, Z = 0;
  for (let nm = 380; nm <= 780; nm += 5) {
    const m = planck(nm * 1e-9, T);
    const [x, y, z] = cieXYZ(nm);
    X += m * x;
    Y += m * y;
    Z += m * z;
  }
  return [X, Y, Z];
}

const gammaEncode = (u: number) => (u <= 0.0031308 ? 12.92 * u : 1.055 * u ** (1 / 2.4) - 0.055);

/** Cor aparente (sRGB 0–1) com brilho normalizado: a componente mais forte vale 1. */
export function blackbodyRGB(T: number): [number, number, number] {
  const [X, Y, Z] = spectrumXYZ(T);
  let r = 3.2406 * X - 1.5372 * Y - 0.4986 * Z;
  let g = -0.9689 * X + 1.8758 * Y + 0.0415 * Z;
  let b = 0.0557 * X - 0.204 * Y + 1.057 * Z;
  const lo = Math.min(r, g, b, 0);
  r -= lo; g -= lo; b -= lo; // fora da gama: dessatura adicionando branco
  const hi = Math.max(r, g, b, 1e-300);
  return [gammaEncode(r / hi), gammaEncode(g / hi), gammaEncode(b / hi)];
}

/** Cor aproximada de um comprimento de onda visível (faixa colorida do eixo). */
export function wavelengthRGB(nm: number): string {
  let r = 0, g = 0, b = 0;
  if (nm < 440) { r = (440 - nm) / 60; b = 1; }
  else if (nm < 490) { g = (nm - 440) / 50; b = 1; }
  else if (nm < 510) { g = 1; b = (510 - nm) / 20; }
  else if (nm < 580) { r = (nm - 510) / 70; g = 1; }
  else if (nm < 645) { r = 1; g = (645 - nm) / 65; }
  else r = 1;
  const f = nm < 420 ? 0.3 + (0.7 * (nm - 380)) / 40 : nm > 700 ? 0.3 + (0.7 * (750 - nm)) / 50 : 1;
  const c = (v: number) => Math.round(255 * Math.max(0, Math.min(1, v * f)) ** 0.8);
  return `rgb(${c(r)}, ${c(g)}, ${c(b)})`;
}
