// Física da atividade ótica de açúcares em solução.
// Convenção: ângulos a partir da vertical, positivos no sentido horário para quem
// olha a fonte de frente (dextrógiro = +, levógiro = −).

/** λ₀² do termo de Drude de um único termo, em µm² (ajuste clássico da sacarose). */
export const LAMBDA0_SQ = 0.0213;
/** Comprimento de onda da linha D do sódio (µm). */
export const NA_D = 0.5893;

export interface Sugar {
  label: string;
  /** Rotação específica na linha D do sódio a 20 °C, em ° mL g⁻¹ dm⁻¹. */
  alphaD: number;
}

export const SUGARS: Sugar[] = [
  { label: "Água pura (branco)", alphaD: 0 },
  { label: "Sacarose", alphaD: 66.5 },
  { label: "Glicose (equilíbrio)", alphaD: 52.7 },
  { label: "Frutose", alphaD: -92.4 },
  { label: "Açúcar invertido (glicose + frutose 1:1)", alphaD: (52.7 - 92.4) / 2 },
];
export const SACAROSE = 1;
export const GLICOSE = 2;
export const FRUTOSE = 3;

/** Massas molares (g/mol). */
export const M_SAC = 342.3;
export const M_HEX = 180.16;

/**
 * Rotação específica em função de λ (nm), pela dispersão de Drude de um termo:
 * [α](λ) = A/(λ² − λ₀²), com A ajustado para reproduzir [α]_D.
 */
export function specificRotation(sugar: number, nm: number): number {
  const s = SUGARS[sugar] ?? SUGARS[0]!;
  const A = s.alphaD * (NA_D * NA_D - LAMBDA0_SQ);
  const l = nm / 1000;
  return A / (l * l - LAMBDA0_SQ);
}

/** Rotação produzida (graus): α = [α] · L(dm) · c(g/mL), com c dado em g/100 mL. */
export const rotation = (sugar: number, nm: number, Ldm: number, c100: number) => specificRotation(sugar, nm) * Ldm * (c100 / 100);

/** Concentração (g/100 mL) a partir de uma rotação medida. */
export const concentrationFrom = (alpha: number, sugar: number, nm: number, Ldm: number) => (100 * alpha) / (specificRotation(sugar, nm) * Ldm);

/** Reduz um ângulo a (−90°, 90°]: a rotação só é definida a menos de 180°. */
export function wrap180(a: number): number {
  let x = ((a % 180) + 180) % 180;
  if (x > 90) x -= 180;
  return x;
}

/** Fração transmitida pelo analisador em θ quando a luz chega polarizada em α (lei de Malus). */
export const malus = (theta: number, alpha: number) => Math.cos(((theta - alpha) * Math.PI) / 180) ** 2;

// ------------------------------------------------------------------ inversão da sacarose
export const EA = 108e3; // J/mol
export const R_GAS = 8.314;
/** Constante de velocidade a 25 °C para [H⁺] = 1 mol/L (s⁻¹), valor típico de aula prática. */
export const K_REF = 2.0e-4;

/** k(T, [H⁺]) = k_ref [H⁺] exp[−Ea/R (1/T − 1/298,15 K)] (s⁻¹). */
export const rateConstant = (TC: number, acid: number) => K_REF * acid * Math.exp((-EA / R_GAS) * (1 / (TC + 273.15) - 1 / 298.15));

/** Concentrações (g/100 mL) de sacarose, glicose e frutose após t segundos de reação. */
export function inversionConc(c0: number, k: number, t: number): { sac: number; gli: number; fru: number } {
  const sac = c0 * Math.exp(-k * t);
  const hex = (c0 - sac) * (M_HEX / M_SAC);
  return { sac, gli: hex, fru: hex };
}

/** Rotação da mistura reagente (graus). */
export function inversionRotation(c0: number, k: number, t: number, nm: number, Ldm: number): number {
  const c = inversionConc(c0, k, t);
  return rotation(SACAROSE, nm, Ldm, c.sac) + rotation(GLICOSE, nm, Ldm, c.gli) + rotation(FRUTOSE, nm, Ldm, c.fru);
}

/** Rotação final (reação completa). */
export const inversionFinal = (c0: number, nm: number, Ldm: number) =>
  ((M_HEX / M_SAC) * c0 * Ldm * (specificRotation(GLICOSE, nm) + specificRotation(FRUTOSE, nm))) / 100;
