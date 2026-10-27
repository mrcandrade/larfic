/** MOSFET de canal n (enriquecimento), modelo quadrático com modulação do comprimento do canal. */
import { bisect } from "./physics.ts";

export interface NMOS {
  /** Tensão de limiar V_t (V). */
  Vt: number;
  /** Fator de transcondutância k = µₙC_ox W/L (A/V²). */
  k: number;
  /** Modulação do comprimento do canal λ (1/V). */
  lambda: number;
}

export const defaultNMOS = (): NMOS => ({ Vt: 1.5, k: 2e-3, lambda: 0.01 });

export type MosRegion = "corte" | "triodo" | "saturação";

export function mosRegion(m: NMOS, vgs: number, vds: number): MosRegion {
  const vov = vgs - m.Vt;
  if (vov <= 0) return "corte";
  return vds < vov ? "triodo" : "saturação";
}

/** Corrente de dreno I_D (A) para V_GS e V_DS ≥ 0. */
export function drainCurrent(m: NMOS, vgs: number, vds: number): number {
  const vov = vgs - m.Vt;
  if (vov <= 0 || vds <= 0) return 0;
  const clm = 1 + m.lambda * vds;
  return vds < vov ? m.k * (vov * vds - (vds * vds) / 2) * clm : (m.k / 2) * vov * vov * clm;
}

/** Ponto de operação com resistor de dreno: V_DS = V_DD − R_D I_D. */
export function mosQPoint(m: NMOS, vgs: number, vdd: number, rd: number) {
  const vds = bisect((v) => v - (vdd - rd * drainCurrent(m, vgs, v)), 0, vdd);
  const id = drainCurrent(m, vgs, vds);
  return { vds, id, reg: mosRegion(m, vgs, vds) };
}
