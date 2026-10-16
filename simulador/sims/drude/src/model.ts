// Modelo de Drude: elétrons livres com colisões aleatórias (processo de Poisson de
// taxa 1/τ) que apagam a memória da velocidade. Unidades internas da animação:
// posição em nm, tempo em fs, velocidade em nm/fs (= 10⁶ m/s).
import { gaussian } from "@fisilab/core";

export const E_CHARGE = 1.602176634e-19;
export const M_E = 9.1093837015e-31;
export const K_B = 1.380649e-23;
export const EV = 1.602176634e-19;

export interface Material {
  name: string;
  kind: "metal" | "semicondutor";
  /** Densidade de portadores a 300 K (m⁻³). */
  n300: number;
  /** Tempo de relaxação a 300 K (s). */
  tau300: number;
  /** Massa efetiva (em m_e). */
  mEff: number;
  /** Fração da resistividade residual (impurezas) a 300 K, para metais. */
  residual?: number;
  /** Gap (eV), para semicondutores. */
  gap?: number;
}

export const MATERIALS: Material[] = [
  // τ escolhido para reproduzir ρ(300 K): Cu 1,68e-8 Ω·m, Al 2,65e-8 Ω·m.
  { name: "Cobre", kind: "metal", n300: 8.47e28, tau300: 2.5e-14, mEff: 1, residual: 0.01 },
  { name: "Alumínio", kind: "metal", n300: 18.1e28, tau300: 7.4e-15, mEff: 1, residual: 0.01 },
  // Si intrínseco: n_i ≈ 1e16 m⁻³, μ_n ≈ 0,14 m²/(V·s) ⇒ τ = μ m*/e.
  { name: "Silício intrínseco", kind: "semicondutor", n300: 1.0e16, tau300: (0.14 * 0.26 * M_E) / E_CHARGE, mEff: 0.26, gap: 1.12 },
];

export const material = (i: number) => MATERIALS[Math.max(0, Math.min(MATERIALS.length - 1, Math.round(i)))]!;

/** Densidade de portadores n(T): constante em metais; ativada termicamente no semicondutor. */
export function carrierDensity(m: Material, T: number): number {
  if (m.kind === "metal") return m.n300;
  const Eg = (m.gap ?? 1.1) * EV;
  return m.n300 * (T / 300) ** 1.5 * Math.exp((-Eg / (2 * K_B)) * (1 / T - 1 / 300));
}

/**
 * Tempo de relaxação τ(T). Metal (regra de Matthiessen): 1/τ = 1/τ_imp + 1/τ_fônons,
 * com 1/τ_fônons ∝ T. Semicondutor: espalhamento por fônons μ ∝ T^(−3/2).
 */
export function relaxationTime(m: Material, T: number): number {
  if (m.kind === "metal") {
    const r = m.residual ?? 0;
    const rate300 = 1 / m.tau300;
    return 1 / (r * rate300 + (1 - r) * rate300 * (T / 300));
  }
  return m.tau300 * (T / 300) ** -1.5;
}

export const massOf = (m: Material) => m.mEff * M_E;
export const mobility = (m: Material, T: number) => (E_CHARGE * relaxationTime(m, T)) / massOf(m);
export const conductivity = (m: Material, T: number) => (carrierDensity(m, T) * E_CHARGE ** 2 * relaxationTime(m, T)) / massOf(m);
export const resistivity = (m: Material, T: number) => 1 / conductivity(m, T);
/** Velocidade de deriva (m/s), em módulo: v_d = eEτ/m. */
export const driftSpeed = (m: Material, T: number, E: number) => (E_CHARGE * E * relaxationTime(m, T)) / massOf(m);
/** Velocidade térmica quadrática média em 2D (m/s): √(2kT/m) (a animação é plana). */
export const thermalSpeed = (m: Material, T: number) => Math.sqrt((2 * K_B * T) / massOf(m));
/** Densidade de corrente (A/m²): J = σE. */
export const currentDensity = (m: Material, T: number, E: number) => conductivity(m, T) * E;

// ---------------------------------------------------------------------------
// Gás de elétrons
// ---------------------------------------------------------------------------

export const BOX_W = 40;
export const BOX_H = 22;

export interface Gas {
  x: number[];
  y: number[];
  vx: number[];
  vy: number[];
  /** Colisões e tempo-elétron acumulados (fs), para medir τ. */
  coll: number;
  tAcc: number;
  /** Média de vx sobre todos os elétrons e todo o tempo desde o último reinício da medida (nm/fs × fs). */
  vxInt: number;
  /** Semente do gerador (o estado precisa ser clonável). */
  seed: number;
}

/** Gerador mulberry32 com estado explícito. */
export function next(seed: number): [number, number] {
  const a = (seed + 0x6d2b79f5) >>> 0;
  let t = a;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, a];
}

export function makeGas(N: number, sigmaV: number, seed: number): Gas {
  let s = seed >>> 0;
  const rand = () => {
    const [u, ns] = next(s);
    s = ns;
    return u;
  };
  const g: Gas = { x: [], y: [], vx: [], vy: [], coll: 0, tAcc: 0, vxInt: 0, seed: 0 };
  for (let i = 0; i < N; i++) {
    g.x.push(rand() * BOX_W);
    g.y.push(rand() * BOX_H);
    g.vx.push(sigmaV * gaussian(rand));
    g.vy.push(sigmaV * gaussian(rand));
  }
  g.seed = s;
  return g;
}

/**
 * Avança o gás dt (fs) sob aceleração ax (nm/fs², ao longo de x). Voo livre exato
 * (aceleração constante); em cada passo um elétron colide com probabilidade
 * 1 − e^(−dt/τ) e sai com velocidade térmica aleatória (sem memória).
 */
export function stepGas(g0: Gas, dt: number, tau: number, ax: number, sigmaV: number): Gas {
  let s = g0.seed;
  const rand = () => {
    const [u, ns] = next(s);
    s = ns;
    return u;
  };
  const N = g0.x.length;
  const x = g0.x.slice(), y = g0.y.slice(), vx = g0.vx.slice(), vy = g0.vy.slice();
  let coll = g0.coll;
  let vxInt = g0.vxInt;
  for (let i = 0; i < N; i++) {
    let px = x[i]!, py = y[i]!, ux = vx[i]!, uy = vy[i]!;
    // Processo de Poisson exato: sorteia o instante da próxima colisão no tempo que
    // resta do passo (exponencial truncada); pode haver mais de uma colisão por passo.
    let rem = dt;
    for (let guard = 0; guard < 50 && rem > 0; guard++) {
      const pc = 1 - Math.exp(-rem / tau);
      const hit = rand() < pc;
      const tc = hit ? -tau * Math.log(1 - rand() * pc) : rem;
      px += ux * tc + 0.5 * ax * tc * tc;
      vxInt += (ux + 0.5 * ax * tc) * tc;
      ux += ax * tc;
      py += uy * tc;
      rem -= tc;
      if (!hit) break;
      coll++;
      ux = sigmaV * gaussian(rand);
      uy = sigmaV * gaussian(rand);
    }
    x[i] = ((px % BOX_W) + BOX_W) % BOX_W;
    y[i] = ((py % BOX_H) + BOX_H) % BOX_H;
    vx[i] = ux;
    vy[i] = uy;
  }
  return { x, y, vx, vy, coll, tAcc: g0.tAcc + N * dt, vxInt, seed: s };
}
