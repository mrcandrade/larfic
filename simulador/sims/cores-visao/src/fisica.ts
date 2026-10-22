// Colorimetria: espectros, cones L/M/S, CIE 1931 e daltonismo.

export type V3 = [number, number, number];
export type Spectrum = (nm: number) => number;

/** Amostragem do visível usada em todas as integrais (nm). */
export const NM: number[] = Array.from({ length: 71 }, (_, i) => 380 + 5 * i);

// ------------------------------------------------------------------ CIE 1931 (ajuste multi-gaussiano de Wyman, Sloan e Shirley, 2013)
const g = (x: number, mu: number, s1: number, s2: number) => {
  const t = (x - mu) / (x < mu ? s1 : s2);
  return Math.exp(-0.5 * t * t);
};
export function cieXYZ(nm: number): V3 {
  const x = 1.056 * g(nm, 599.8, 37.9, 31.0) + 0.362 * g(nm, 442.0, 16.0, 26.7) - 0.065 * g(nm, 501.1, 20.4, 26.2);
  const y = 0.821 * g(nm, 568.8, 46.9, 40.5) + 0.286 * g(nm, 530.9, 16.3, 31.1);
  const z = 1.217 * g(nm, 437.0, 11.8, 36.0) + 0.681 * g(nm, 459.0, 26.0, 13.8);
  return [x, y, z];
}

// ------------------------------------------------------------------ cones (gabarito de Govardovskii et al., 2000, banda α)
export function coneTemplate(peak: number, nm: number): number {
  const x = peak / nm;
  const a = 0.8795 + 0.0459 * Math.exp(-((peak - 300) ** 2) / 11940);
  return 1 / (Math.exp(69.7 * (a - x)) + Math.exp(28 * (0.922 - x)) + Math.exp(-14.9 * (1.104 - x)) + 0.674);
}

/** Picos dos cones (nm) de cada observador. */
export const VIEWERS = [
  { label: "Visão normal (tricromata)", peaks: [559, 530, 420] as V3, missing: -1 },
  { label: "Protanopia (sem cones L)", peaks: [559, 530, 420] as V3, missing: 0 },
  { label: "Deuteranopia (sem cones M)", peaks: [559, 530, 420] as V3, missing: 1 },
  { label: "Tritanopia (sem cones S)", peaks: [559, 530, 420] as V3, missing: 2 },
  { label: "Protanomalia (L deslocado para 545 nm)", peaks: [545, 530, 420] as V3, missing: -1 },
  { label: "Deuteranomalia (M deslocado para 548 nm)", peaks: [559, 548, 420] as V3, missing: -1 },
];

const NORMAL = VIEWERS[0]!.peaks;
/** Integral de cada cone com espectro plano, para normalizar (branco de energia igual → 1, 1, 1). */
const coneNorm = (peaks: V3): V3 => peaks.map((pk) => NM.reduce((a, nm) => a + coneTemplate(pk, nm), 0)) as V3;
const NORM_CACHE = new Map<string, V3>();
function normOf(peaks: V3): V3 {
  const k = peaks.join(",");
  let v = NORM_CACHE.get(k);
  if (!v) NORM_CACHE.set(k, (v = coneNorm(peaks)));
  return v;
}

/** Excitações dos cones L, M, S para um espectro (branco de energia igual = 1, 1, 1). */
export function lms(spec: Spectrum, peaks: V3 = NORMAL): V3 {
  const n = normOf(peaks);
  const out: V3 = [0, 0, 0];
  for (const nm of NM) {
    const w = spec(nm);
    if (w === 0) continue;
    out[0] += w * coneTemplate(peaks[0], nm);
    out[1] += w * coneTemplate(peaks[1], nm);
    out[2] += w * coneTemplate(peaks[2], nm);
  }
  return [out[0] / n[0], out[1] / n[1], out[2] / n[2]];
}

export function xyz(spec: Spectrum): V3 {
  const out: V3 = [0, 0, 0];
  let yw = 0;
  for (const nm of NM) {
    const c = cieXYZ(nm);
    const w = spec(nm);
    out[0] += w * c[0];
    out[1] += w * c[1];
    out[2] += w * c[2];
    yw += c[1];
  }
  return [out[0] / yw, out[1] / yw, out[2] / yw];
}

// ------------------------------------------------------------------ álgebra 3×3
export type M3 = [V3, V3, V3];
export const mul = (m: M3, v: V3): V3 => [m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2], m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2], m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2]];
export function inv3(m: M3): M3 {
  const [[a, b, c], [d, e, f], [g2, h, i]] = m;
  const A = e * i - f * h;
  const B = -(d * i - f * g2);
  const C = d * h - e * g2;
  const det = a * A + b * B + c * C;
  return [
    [A / det, -(b * i - c * h) / det, (b * f - c * e) / det],
    [B / det, (a * i - c * g2) / det, -(a * f - c * d) / det],
    [C / det, -(a * h - b * g2) / det, (a * e - b * d) / det],
  ];
}

/** LMS (normal) → XYZ por mínimos quadrados sobre o espectro (XYZ(λ) ≈ M · LMS(λ)). */
export const LMS_TO_XYZ: M3 = (() => {
  const ATA: M3 = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  const ATB: M3 = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  const n = normOf(NORMAL);
  let yw = 0;
  for (const nm of NM) yw += cieXYZ(nm)[1];
  for (const nm of NM) {
    const l = NORMAL.map((pk, k) => coneTemplate(pk, nm) / n[k]!) as V3;
    const x = cieXYZ(nm).map((v) => v / yw) as V3;
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
      ATA[i]![j] = ATA[i]![j]! + l[i]! * l[j]!;
      ATB[i]![j] = ATB[i]![j]! + l[i]! * x[j]!;
    }
  }
  const S = inv3(ATA);
  // coeficientes: C = (AᵀA)⁻¹ AᵀB, e XYZ = Cᵀ · LMS
  const Cm: M3 = [0, 1, 2].map((i) => [0, 1, 2].map((j) => S[i]![0] * ATB[0]![j]! + S[i]![1] * ATB[1]![j]! + S[i]![2] * ATB[2]![j]!)) as M3;
  return [0, 1, 2].map((r) => [Cm[0]![r]!, Cm[1]![r]!, Cm[2]![r]!]) as M3;
})();

const XYZ_TO_RGB: M3 = [
  [3.2406, -1.5372, -0.4986],
  [-0.9689, 1.8758, 0.0415],
  [0.0557, -0.204, 1.057],
];

/** RGB linear (sRGB) a partir de XYZ. */
export const xyzToRgb = (v: V3): V3 => mul(XYZ_TO_RGB, v);

/** Cor CSS (sRGB com gama) de um RGB linear; `k` é a exposição. Saturação por excesso preserva o matiz. */
export function css(rgb: V3, k = 1): string {
  let c = rgb.map((v) => Math.max(0, v * k)) as V3;
  const mx = Math.max(...c);
  if (mx > 1) c = c.map((v) => v / mx) as V3;
  const enc = (v: number) => Math.round(255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055));
  return `rgb(${enc(c[0])},${enc(c[1])},${enc(c[2])})`;
}

// ------------------------------------------------------------------ daltonismo (projeção de Viénot/Brettel num plano)
/**
 * Para um dicromata, o sinal do cone ausente é substituído por uma combinação
 * dos outros dois que preserva o branco de energia igual e uma cor-âncora
 * (575 nm para protan/deutan, 660 nm para tritan).
 */
export function dichromatLMS(v: V3, missing: number): V3 {
  if (missing < 0) return v;
  const anchor: number[] = lms((nm) => (Math.abs(nm - (missing === 2 ? 660 : 575)) < 2.5 ? 1 : 0));
  const others = [0, 1, 2].filter((i) => i !== missing) as [number, number];
  // resolve a·w[o0] + b·w[o1] = w[m] para branco (1,1,1) e para a âncora
  const [o0, o1] = others;
  const vv: number[] = v;
  const det = anchor[o1]! - anchor[o0]!;
  const a = (anchor[o1]! - anchor[missing]!) / det;
  const b = (anchor[missing]! - anchor[o0]!) / det;
  const out: V3 = [...v];
  out[missing] = a * vv[o0]! + b * vv[o1]!;
  return out;
}

/** Cor percebida (RGB linear) de um espectro por um observador. */
export function perceived(spec: Spectrum, viewer: number): V3 {
  const V = VIEWERS[viewer] ?? VIEWERS[0]!;
  const c = dichromatLMS(lms(spec, V.peaks), V.missing);
  const rgb = xyzToRgb(mul(LMS_TO_XYZ, c));
  return [rgb[0] / WHITE_RGB[0], rgb[1] / WHITE_RGB[1], rgb[2] / WHITE_RGB[2]];
}
/** Adaptação cromática (von Kries no RGB): o branco de energia igual aparece neutro. */
const WHITE_RGB: V3 = xyzToRgb(mul(LMS_TO_XYZ, [1, 1, 1]));

// ------------------------------------------------------------------ espectros
export const gauss = (mu: number, s: number): Spectrum => (nm) => Math.exp(-0.5 * ((nm - mu) / s) ** 2);
export const sum = (...fs: { f: Spectrum; w: number }[]): Spectrum => (nm) => fs.reduce((a, t) => a + t.w * t.f(nm), 0);
export const prod = (...fs: Spectrum[]): Spectrum => (nm) => fs.reduce((a, f) => a * f(nm), 1);
export const flat: Spectrum = () => 1;
const sig = (x: number) => 1 / (1 + Math.exp(-x));

/** Espectro de Planck relativo (normalizado em 560 nm). */
export function planck(T: number): Spectrum {
  const h = 6.626e-34;
  const c = 2.998e8;
  const k = 1.381e-23;
  const B = (nm: number) => {
    const l = nm * 1e-9;
    return 1 / (l ** 5 * (Math.exp((h * c) / (l * k * T)) - 1));
  };
  const b0 = B(560);
  return (nm) => B(nm) / b0;
}

/** LED branco (azul + fósforo amarelo). */
export const ledWhite: Spectrum = sum({ f: gauss(452, 10), w: 1.0 }, { f: gauss(565, 55), w: 0.75 });

/** Primárias de projetores/LEDs RGB. */
export const PRIMARIES: Spectrum[] = [gauss(612, 12), gauss(545, 15), gauss(455, 10)];

/** Filtros subtrativos (transmitância 0–1). */
export const FILTERS: Record<"C" | "M" | "Y" | "R" | "G" | "B", Spectrum> = {
  C: (nm) => 0.03 + 0.95 * sig((585 - nm) / 12),
  M: (nm) => 0.03 + 0.95 * (1 - sig((nm - 495) / 10) * sig((595 - nm) / 10)),
  Y: (nm) => 0.03 + 0.95 * sig((nm - 500) / 10),
  R: (nm) => 0.02 + 0.93 * sig((nm - 595) / 9),
  G: (nm) => 0.02 + 0.85 * sig((nm - 495) / 9) * sig((575 - nm) / 9),
  B: (nm) => 0.02 + 0.85 * sig((500 - nm) / 9),
};

/** Filtro com "densidade" k (lei de Beer–Lambert: T^k). */
export const dense = (f: Spectrum, k: number): Spectrum => (nm) => f(nm) ** k;

/**
 * Pesos (r, g, b) das primárias que reproduzem as excitações LMS de um alvo
 * para um observador: metâmero do alvo. Pesos negativos = fora do gamut.
 */
export function matchPrimaries(target: V3, peaks: V3 = NORMAL, prim: Spectrum[] = PRIMARIES): V3 {
  const cols = prim.map((p) => lms(p, peaks));
  const A: M3 = [0, 1, 2].map((i) => [cols[0]![i]!, cols[1]![i]!, cols[2]![i]!]) as M3;
  return mul(inv3(A), target);
}

/**
 * Igualação de Rayleigh (anomaloscópio): fração de vermelho 670 nm na mistura
 * vermelho + verde 545 nm que iguala o amarelo 589 nm para cones L e M.
 */
export function rayleighRatio(peaks: V3): number {
  const [red, grn] = rayleighPrimaries();
  const R = lms(red, peaks);
  const G = lms(grn, peaks);
  const Y = lms(mono590, peaks);
  // a R + b G = Y nos cones L e M
  const det = R[0] * G[1] - R[1] * G[0];
  const a = (Y[0] * G[1] - Y[1] * G[0]) / det;
  const b = (R[0] * Y[1] - R[1] * Y[0]) / det;
  return a / (a + b);
}

const line = (l: number): Spectrum => (nm) => Math.max(0, 1 - Math.abs(nm - l) / 5);
const mono590 = line(590);
/** Primárias do anomaloscópio (670 e 545 nm) escaladas para o mesmo L + M da visão normal, como na escala do instrumento. */
export function rayleighPrimaries(): [Spectrum, Spectrum] {
  const k = (l: number) => {
    const v = lms(line(l));
    return 1 / (v[0] + v[1]);
  };
  const kr = k(670);
  const kg = k(545);
  return [(nm) => kr * line(670)(nm), (nm) => kg * line(545)(nm)];
}
