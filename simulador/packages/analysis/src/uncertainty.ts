// Incertezas de medição (GUM simplificado, como nas disciplinas experimentais).

/** Grandeza com incerteza padrão. */
export interface Measured {
  value: number;
  u: number;
}

export const m = (value: number, u: number): Measured => ({ value, u });

/** Incerteza do tipo B de um instrumento analógico: metade da menor divisão (distribuição retangular opcional). */
export function typeB(resolution: number, kind: "meia-divisao" | "retangular" = "meia-divisao"): number {
  return kind === "retangular" ? resolution / (2 * Math.sqrt(3)) : resolution / 2;
}

/** Combina incertezas independentes em quadratura. */
export const combine = (...u: number[]) => Math.sqrt(u.reduce((a, b) => a + b * b, 0));

/**
 * Propaga incertezas por derivadas parciais numéricas:
 * u_f² = Σ (∂f/∂xᵢ)² uᵢ² (+ correlações, se a matriz for dada).
 */
export function propagate(f: (...x: number[]) => number, inputs: readonly Measured[], corr?: number[][]): Measured & { partials: number[]; contributions: number[] } {
  const x = inputs.map((i) => i.value);
  const value = f(...x);
  const partials = inputs.map((inp, k) => {
    const h = inp.u > 0 ? inp.u * 1e-3 : 1e-8 * Math.max(1, Math.abs(inp.value));
    const xp = [...x], xm = [...x];
    xp[k] = x[k]! + h;
    xm[k] = x[k]! - h;
    return (f(...xp) - f(...xm)) / (2 * h);
  });
  const g = partials.map((d, k) => d * inputs[k]!.u);
  let u2 = g.reduce((a, b) => a + b * b, 0);
  if (corr) for (let i = 0; i < g.length; i++) for (let j = 0; j < g.length; j++) if (i !== j) u2 += g[i]! * g[j]! * (corr[i]?.[j] ?? 0);
  return { value, u: Math.sqrt(Math.max(0, u2)), partials, contributions: g.map((v) => v * v) };
}

/**
 * Arredonda resultado e incerteza segundo a convenção usual:
 * incerteza com 1 algarismo significativo (2 se o primeiro for 1) e o valor na mesma casa decimal.
 */
export function roundResult(value: number, u: number): { value: string; u: string; decimals: number; exp: number } {
  if (!(u > 0) || !Number.isFinite(u)) return { value: String(value), u: "0", decimals: 0, exp: 0 };
  let e = Math.floor(Math.log10(u));
  const lead = Math.floor(u / 10 ** e);
  const sig = lead === 1 ? 2 : 1;
  let decimalsPow = e - sig + 1;
  let ur = Math.round(u / 10 ** decimalsPow) * 10 ** decimalsPow;
  // Arredondamento pode subir uma ordem (ex.: 0,096 → 0,10).
  if (Math.floor(Math.log10(ur)) > e) {
    e += 1;
    decimalsPow = e - (Math.floor(ur / 10 ** e) === 1 ? 2 : 1) + 1;
    ur = Math.round(u / 10 ** decimalsPow) * 10 ** decimalsPow;
  }
  // Notação científica para números muito grandes ou pequenos.
  const vexp = value !== 0 ? Math.floor(Math.log10(Math.abs(value))) : e;
  const sci = vexp >= 5 || vexp <= -4;
  const exp = sci ? vexp : 0;
  const d = Math.max(0, exp - decimalsPow);
  const fmt = (v: number) => (v / 10 ** exp).toFixed(d).replace(".", ",");
  return { value: fmt(Math.round(value / 10 ** decimalsPow) * 10 ** decimalsPow), u: fmt(ur), decimals: d, exp };
}

/** "(9,79 ± 0,04) m/s²" ou "(6,63 ± 0,05) × 10^-34 J·s". */
export function formatMeasured(value: number, u: number, unit = ""): string {
  const r = roundResult(value, u);
  const pow = r.exp !== 0 ? ` × 10^${r.exp}` : "";
  return `(${r.value} ± ${r.u})${pow}${unit ? ` ${unit}` : ""}`;
}

/** Discrepância relativa ao valor de referência, em número de incertezas combinadas (teste de compatibilidade). */
export function compatibility(a: Measured, b: Measured): { z: number; compatible: boolean } {
  const z = Math.abs(a.value - b.value) / combine(a.u, b.u);
  return { z, compatible: z <= 2 };
}
