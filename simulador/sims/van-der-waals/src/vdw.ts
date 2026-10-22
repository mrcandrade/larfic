/**
 * Gás de van der Waals em variáveis reduzidas: p = P/Pc, v = V/Vc, t = T/Tc,
 *   p = 8t/(3v − 1) − 3/v²,
 * com Tc = 8a/(27Rb), Pc = a/(27b²), Vc = 3b (por mol).
 * A construção de Maxwell troca o laço abaixo de Tc pelo patamar de áreas iguais.
 */

export const R = 8.314462618; // J/(mol·K)

export interface Gas {
  value: number;
  name: string;
  formula: string;
  /** a em L²·bar/mol² e b em L/mol (tabela CRC). */
  a: number;
  b: number;
  /** Fator de compressibilidade crítico medido (para comparar com 3/8). */
  Zc: number;
}

export const GASES: Gas[] = [
  { value: 0, name: "Hélio", formula: "He", a: 0.0346, b: 0.0238, Zc: 0.302 },
  { value: 1, name: "Hidrogênio", formula: "H₂", a: 0.2476, b: 0.02661, Zc: 0.305 },
  { value: 2, name: "Nitrogênio", formula: "N₂", a: 1.37, b: 0.0387, Zc: 0.289 },
  { value: 3, name: "Oxigênio", formula: "O₂", a: 1.382, b: 0.03186, Zc: 0.288 },
  { value: 4, name: "Argônio", formula: "Ar", a: 1.355, b: 0.03201, Zc: 0.291 },
  { value: 5, name: "Metano", formula: "CH₄", a: 2.303, b: 0.0431, Zc: 0.286 },
  { value: 6, name: "Dióxido de carbono", formula: "CO₂", a: 3.64, b: 0.04267, Zc: 0.274 },
  { value: 7, name: "Xenônio", formula: "Xe", a: 4.192, b: 0.05156, Zc: 0.286 },
  { value: 8, name: "Amônia", formula: "NH₃", a: 4.225, b: 0.0371, Zc: 0.242 },
  { value: 9, name: "Água", formula: "H₂O", a: 5.536, b: 0.03049, Zc: 0.229 },
];

export const gasOf = (i: number): Gas => GASES[Math.max(0, Math.min(GASES.length - 1, Math.round(i)))]!;

/** a em Pa·m⁶/mol² e b em m³/mol. */
export const aSI = (g: Gas) => g.a * 0.1;
export const bSI = (g: Gas) => g.b * 1e-3;

export interface Critical {
  Tc: number; // K
  Pc: number; // Pa
  Vc: number; // m³/mol
}

export function critical(g: Gas): Critical {
  const a = aSI(g);
  const b = bSI(g);
  return { Tc: (8 * a) / (27 * R * b), Pc: a / (27 * b * b), Vc: 3 * b };
}

/** Pressão de van der Waals em SI: P = RT/(V − b) − a/V² (V molar). */
export const pressureSI = (g: Gas, T: number, V: number) => (R * T) / (V - bSI(g)) - aSI(g) / (V * V);

/** Isoterma reduzida. */
export const pr = (t: number, v: number) => (8 * t) / (3 * v - 1) - 3 / (v * v);
/** Primitiva de p(v) em v (para as áreas). */
const Fp = (t: number, v: number) => ((8 * t) / 3) * Math.log(3 * v - 1) + 3 / v;

function bisect(f: (x: number) => number, lo: number, hi: number, iters = 200): number {
  let flo = f(lo);
  for (let i = 0; i < iters; i++) {
    const mid = 0.5 * (lo + hi);
    const fm = f(mid);
    if (fm === 0) return mid;
    if (Math.sign(fm) === Math.sign(flo)) {
      lo = mid;
      flo = fm;
    } else hi = mid;
    if (hi - lo < 1e-15 * Math.max(1, Math.abs(mid))) break;
  }
  return 0.5 * (lo + hi);
}

export interface Spinodal {
  /** Mínimo local (lado do líquido) e máximo local (lado do vapor) do laço. */
  va: number;
  pa: number;
  vb: number;
  pb: number;
}

/** Pontos onde ∂p/∂v = 0 (só existem para t < 1): 4t v³ = (3v − 1)². */
export function spinodal(t: number): Spinodal | undefined {
  if (t >= 1) return undefined;
  const g = (v: number) => 4 * t * v ** 3 - (3 * v - 1) ** 2;
  const va = bisect(g, 1 / 3 + 1e-12, 1);
  const vb = bisect(g, 1, 100);
  return { va, pa: pr(t, va), vb, pb: pr(t, vb) };
}

/** As três raízes de p(v) = P para P entre o mínimo e o máximo do laço. */
function roots(t: number, P: number, sp: Spinodal): [number, number] {
  const f = (v: number) => pr(t, v) - P;
  const v1 = bisect(f, 1 / 3 + 1e-12, sp.va);
  let hi = sp.vb * 2;
  while (f(hi) > 0) hi *= 2;
  const v3 = bisect(f, sp.vb, hi);
  return [v1, v3];
}

export interface Coexistence {
  /** Pressão de saturação reduzida e volumes reduzidos do líquido e do vapor. */
  p: number;
  vl: number;
  vg: number;
}

/**
 * Construção de Maxwell: a pressão de coexistência é a que deixa áreas iguais
 * acima e abaixo do patamar, ∫(p − p_s) dv = 0 entre v_l e v_g.
 */
const MEMO = new Map<number, Coexistence | undefined>();

export function maxwell(t: number): Coexistence | undefined {
  if (MEMO.has(t)) return MEMO.get(t);
  if (MEMO.size > 500) MEMO.clear();
  const c = maxwellUncached(t);
  MEMO.set(t, c);
  return c;
}

function maxwellUncached(t: number): Coexistence | undefined {
  const sp = spinodal(t);
  if (!sp) return undefined;
  const area = (P: number) => {
    const [v1, v3] = roots(t, P, sp);
    return Fp(t, v3) - Fp(t, v1) - P * (v3 - v1);
  };
  const lo = Math.max(sp.pa, 1e-12);
  const hi = sp.pb;
  const p = bisect(area, lo, hi);
  const [vl, vg] = roots(t, p, sp);
  return { p, vl, vg };
}

/** As duas áreas (acima e abaixo do patamar), em unidades reduzidas p·v. */
export function lobeAreas(t: number, c: Coexistence): { below: number; above: number; vm: number } {
  const sp = spinodal(t)!;
  const vm = bisect((v) => pr(t, v) - c.p, sp.va, sp.vb);
  // Entre vl e vm a isoterma fica abaixo do patamar; entre vm e vg, acima.
  const below = c.p * (vm - c.vl) - (Fp(t, vm) - Fp(t, c.vl));
  const above = Fp(t, c.vg) - Fp(t, vm) - c.p * (c.vg - vm);
  return { below, above, vm };
}

/** Pressão de equilíbrio (com o patamar de Maxwell) e fração de líquido (regra da alavanca). */
export function equilibrium(t: number, v: number): { p: number; xl: number; coex?: Coexistence } {
  const c = maxwell(t);
  if (c && v > c.vl && v < c.vg) return { p: c.p, xl: (c.vg - v) / (c.vg - c.vl), coex: c };
  return { p: pr(t, v), xl: c && v <= c.vl ? 1 : 0, coex: c };
}

/** Fator de compressibilidade Z = PV/RT em variáveis reduzidas (Zc = 3/8 no modelo). */
export const Zr = (t: number, v: number, p: number) => (3 / 8) * (p * v) / t;

/** Curva de coexistência (binodal) em variáveis reduzidas, do lado do líquido ao do vapor. */
export const BINODAL: { t: number; c: Coexistence }[] = (() => {
  const out: { t: number; c: Coexistence }[] = [];
  for (let i = 0; i <= 60; i++) {
    const t = 1 - 0.6 * (1 - i / 60) ** 2.2 - 1e-5;
    const c = maxwell(t);
    if (c) out.push({ t, c });
  }
  return out;
})();
