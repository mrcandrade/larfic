/** Interferência em filmes finos, anéis de Newton e interferômetro de Michelson (incidência normal). */

export const P_ATM = 101.325; // kPa
export const N_GLASS = 1.52;

/** (n − 1) a 101,325 kPa e 20 °C, para λ ≈ 600 nm. */
export const GASES = [
  { label: "Ar", nm1: 2.72e-4 },
  { label: "CO₂", nm1: 4.2e-4 },
  { label: "Hélio", nm1: 3.3e-5 },
];

export const gasNm1 = (gas: number, pKpa: number) => (GASES[Math.max(0, Math.min(GASES.length - 1, gas))]!.nm1 * pKpa) / P_ATM;

/** Coeficiente de reflexão de Fresnel em incidência normal (meio a → meio b). Negativo indica inversão de fase (π). */
export const fresnelR = (na: number, nb: number) => (na - nb) / (na + nb);

/**
 * Refletância de uma camada de índice n2 e espessura e (nm) entre os meios n1 (de onde vem a luz) e n3,
 * somando todas as reflexões múltiplas (fórmula de Airy).
 */
export function filmReflectance(n1: number, n2: number, n3: number, eNm: number, lambdaNm: number): number {
  const r12 = fresnelR(n1, n2);
  const r23 = fresnelR(n2, n3);
  const c = Math.cos((4 * Math.PI * n2 * eNm) / lambdaNm);
  return (r12 * r12 + r23 * r23 + 2 * r12 * r23 * c) / (1 + r12 * r12 * r23 * r23 + 2 * r12 * r23 * c);
}

/** Refletância máxima possível da camada (interferência totalmente construtiva), usada para normalizar o brilho. */
export function filmRmax(n1: number, n2: number, n3: number): number {
  const a = Math.abs(fresnelR(n1, n2));
  const b = Math.abs(fresnelR(n2, n3));
  return Math.max(1e-6, ((a + b) / (1 + a * b)) ** 2);
}

/** Espessura mínima (nm) para reflexão construtiva de λ. Com uma só inversão de fase: 2ne = λ/2. */
export function minBrightThickness(n1: number, n2: number, n3: number, lambdaNm: number): number {
  const oneFlip = fresnelR(n1, n2) * fresnelR(n2, n3) < 0;
  return oneFlip ? lambdaNm / (4 * n2) : lambdaNm / (2 * n2);
}

// ---------- Michelson ----------

/** Diferença de caminho óptico no centro (m): 2(d₀ + x) + 2(n − 1)L_c. */
export function michelsonOPD(d0mm: number, xUm: number, nm1: number, LcCm: number): number {
  return 2 * (d0mm * 1e-3 + xUm * 1e-6) + 2 * nm1 * LcCm * 1e-2;
}

/** Intensidade relativa (0–1) dos anéis de Michelson num ângulo θ. */
export function michelsonI(opdCenter: number, d: number, theta: number, lambdaNm: number): number {
  // Só o trecho em ar (2d) depende do ângulo; a célula de gás é atravessada quase normalmente.
  const opd = opdCenter - 2 * d * (1 - Math.cos(theta));
  return Math.cos((Math.PI * opd) / (lambdaNm * 1e-9)) ** 2;
}

/** Comprimento de coerência (m) de uma fonte de largura espectral Δλ: ℓ_c = λ²/Δλ (infinito para Δλ = 0). */
export const coherenceLength = (lambdaNm: number, dlamNm: number) => (dlamNm > 0 ? ((lambdaNm * 1e-9) ** 2) / (dlamNm * 1e-9) : Infinity);

/**
 * Visibilidade das franjas (grau de coerência) para uma diferença de caminho Δ (m), espectro gaussiano
 * de largura a meia altura Δλ: γ = exp[−(πΔ/ℓ_c)²/(4 ln 2)], com ℓ_c = λ²/Δλ.
 */
export function visibility(opd: number, lambdaNm: number, dlamNm: number): number {
  const lc = coherenceLength(lambdaNm, dlamNm);
  if (!Number.isFinite(lc)) return 1;
  return Math.exp(-(((Math.PI * opd) / lc) ** 2) / (4 * Math.LN2));
}

/** Intensidade (0–1) com coerência parcial: ½[1 + γ cos(2πΔ/λ)]; γ = 1 recupera michelsonI. */
export function michelsonIc(opdCenter: number, d: number, theta: number, lambdaNm: number, dlamNm: number): number {
  const g = visibility(opdCenter, lambdaNm, dlamNm);
  return 0.5 * (1 - g) + g * michelsonI(opdCenter, d, theta, lambdaNm);
}

/** Franjas que passaram pelo centro entre duas diferenças de caminho (cruzamentos de máximos). */
export const fringesBetween = (opd0: number, opd1: number, lambdaNm: number) =>
  Math.abs(Math.floor(opd1 / (lambdaNm * 1e-9)) - Math.floor(opd0 / (lambdaNm * 1e-9)));

// ---------- Anéis de Newton ----------

/** Espessura da camada de ar (nm) a uma distância r (mm) do centro: e = e₀ + r²/2R. */
export const newtonGap = (rMm: number, Rm: number, liftNm: number) => liftNm + ((rMm * 1e-3) ** 2 / (2 * Rm)) * 1e9;

/** Raio (mm) do m-ésimo anel escuro: 2e = mλ, com a lente erguida de e₀ (nm). NaN se o anel já sumiu no centro. */
export function darkRingRadius(m: number, lambdaNm: number, Rm: number, liftNm = 0): number {
  const e = (m * lambdaNm) / 2 - liftNm; // nm de "curvatura" necessários
  return e < 0 ? NaN : Math.sqrt(2 * Rm * e * 1e-9) * 1e3;
}
