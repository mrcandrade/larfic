// Física nuclear: fórmula semiempírica de massa, fissão do U-235, reação em
// cadeia (Monte Carlo de nêutrons e difusão de um grupo) e fusão D–T.

/** 1 u em MeV/c². */
export const U_MEV = 931.49410242;
/** e²/4πε₀ em MeV·fm. */
export const KE2 = 1.43996;
export const MEV_J = 1.602176634e-13;
export const U_KG = 1.66053906660e-27;

// ---------------------------------------------------------------- Weizsäcker

/** Coeficientes (MeV) da fórmula semiempírica. */
export const SEMF = { aV: 15.75, aS: 17.8, aC: 0.711, aA: 23.7, aP: 11.18 };

export interface SemfTerms {
  volume: number;
  surface: number;
  coulomb: number;
  asymmetry: number;
  pairing: number;
  B: number;
}

/** Energia de ligação (MeV) e seus termos, para A núcleons e Z prótons. */
export function semfTerms(A: number, Z: number): SemfTerms {
  const N = A - Z;
  const volume = SEMF.aV * A;
  const surface = -SEMF.aS * A ** (2 / 3);
  const coulomb = (-SEMF.aC * Z * (Z - 1)) / A ** (1 / 3);
  const asymmetry = (-SEMF.aA * (A - 2 * Z) ** 2) / A;
  const pairing = A % 2 === 1 ? 0 : (Z % 2 === 0 && N % 2 === 0 ? 1 : -1) * (SEMF.aP / Math.sqrt(A));
  return { volume, surface, coulomb, asymmetry, pairing, B: volume + surface + coulomb + asymmetry + pairing };
}

export const semfB = (A: number, Z: number) => semfTerms(A, Z).B;

/** Z mais estável para um dado A (máximo de B entre inteiros próximos da linha de estabilidade β). */
export function stableZ(A: number): number {
  const z0 = A / (2 + 0.0155 * A ** (2 / 3));
  let best = Math.max(1, Math.round(z0));
  let bv = -Infinity;
  for (let z = Math.max(1, Math.floor(z0) - 2); z <= Math.ceil(z0) + 2 && z < A; z++) {
    const b = semfB(A, z);
    if (b > bv) {
      bv = b;
      best = z;
    }
  }
  return best;
}

/** B/A experimental (MeV) de alguns núcleos. */
export const EXPERIMENTAL: { name: string; A: number; Z: number; BA: number }[] = [
  { name: "²H", A: 2, Z: 1, BA: 1.112 },
  { name: "³H", A: 3, Z: 1, BA: 2.827 },
  { name: "⁴He", A: 4, Z: 2, BA: 7.074 },
  { name: "⁶Li", A: 6, Z: 3, BA: 5.332 },
  { name: "⁹Be", A: 9, Z: 4, BA: 6.463 },
  { name: "¹²C", A: 12, Z: 6, BA: 7.68 },
  { name: "¹⁶O", A: 16, Z: 8, BA: 7.976 },
  { name: "²⁰Ne", A: 20, Z: 10, BA: 8.032 },
  { name: "²⁸Si", A: 28, Z: 14, BA: 8.448 },
  { name: "⁴⁰Ca", A: 40, Z: 20, BA: 8.551 },
  { name: "⁵⁶Fe", A: 56, Z: 26, BA: 8.79 },
  { name: "⁶²Ni", A: 62, Z: 28, BA: 8.795 },
  { name: "⁸⁴Kr", A: 84, Z: 36, BA: 8.717 },
  { name: "⁹⁰Zr", A: 90, Z: 40, BA: 8.71 },
  { name: "¹²⁰Sn", A: 120, Z: 50, BA: 8.505 },
  { name: "¹³⁸Ba", A: 138, Z: 56, BA: 8.393 },
  { name: "¹⁸⁴W", A: 184, Z: 74, BA: 8.005 },
  { name: "¹⁹⁷Au", A: 197, Z: 79, BA: 7.916 },
  { name: "²⁰⁸Pb", A: 208, Z: 82, BA: 7.868 },
  { name: "²³⁵U", A: 235, Z: 92, BA: 7.591 },
  { name: "²³⁸U", A: 238, Z: 92, BA: 7.57 },
];

// ---------------------------------------------------------------- fissão

/** Massas atômicas (u). */
export const MASS: Record<string, number> = {
  n: 1.00866491595,
  "U-235": 235.0439299,
  "Ba-141": 140.914411,
  "Kr-92": 91.9261565,
  "Xe-140": 139.9216458,
  "Sr-94": 93.9153556,
  "Ba-144": 143.922955,
  "Kr-89": 88.917835,
  "H-2": 2.01410177812,
  "H-3": 3.01604928,
  "He-4": 4.00260325413,
};

export interface Channel {
  heavy: string;
  light: string;
  Zh: number;
  Zl: number;
  nn: number;
}

export const CHANNELS: Channel[] = [
  { heavy: "Ba-141", light: "Kr-92", Zh: 56, Zl: 36, nn: 3 },
  { heavy: "Xe-140", light: "Sr-94", Zh: 54, Zl: 38, nn: 2 },
  { heavy: "Ba-144", light: "Kr-89", Zh: 56, Zl: 36, nn: 3 },
];

/** Energia liberada (MeV) em n + U-235 → pesado + leve + ν n, pelo defeito de massa. */
export function fissionQ(c: Channel): number {
  const before = MASS["U-235"]! + MASS.n!;
  const after = MASS[c.heavy]! + MASS[c.light]! + c.nn * MASS.n!;
  return (before - after) * U_MEV;
}

/** Repartição da energia cinética dos fragmentos pela conservação do momento (núcleo em repouso). */
export function fragmentEnergies(c: Channel, Qfrag: number): { heavy: number; light: number } {
  const mh = MASS[c.heavy]!;
  const ml = MASS[c.light]!;
  return { heavy: (Qfrag * ml) / (mh + ml), light: (Qfrag * mh) / (mh + ml) };
}

/** Energia por quilograma de U-235 fissionado (J/kg). */
export const fissionJPerKg = (Q: number) => (Q * MEV_J) / (MASS["U-235"]! * U_KG);

/** Barreira coulombiana (MeV) entre dois núcleos que se tocam: k Z₁Z₂e²/(R₁ + R₂), R = 1,2 A^{1/3} fm. */
export const coulombBarrier = (Z1: number, A1: number, Z2: number, A2: number) => (KE2 * Z1 * Z2) / (1.2 * (A1 ** (1 / 3) + A2 ** (1 / 3)));

// ---------------------------------------------------------------- fusão D–T

export const fusionQ = () => (MASS["H-2"]! + MASS["H-3"]! - MASS["He-4"]! - MASS.n!) * U_MEV;
/** Massa reduzida D–T (MeV/c²). */
export const MU_DT = ((MASS["H-2"]! * MASS["H-3"]!) / (MASS["H-2"]! + MASS["H-3"]!)) * U_MEV;
/** Energia de Gamow E_G = 2μc²(παZ₁Z₂)² (keV). */
export const gamowEnergyKeV = (Z1 = 1, Z2 = 1, muMeV = MU_DT) => 2 * muMeV * ((Math.PI * Z1 * Z2) / 137.035999) ** 2 * 1000;
/** Probabilidade de tunelamento (fator de Gamow) na energia E (keV, centro de massa). */
export const tunnelP = (EkeV: number) => Math.exp(-Math.sqrt(gamowEnergyKeV() / EkeV));
/** Ponto de retorno clássico (fm) para a energia E (keV). */
export const turningPointFm = (EkeV: number) => KE2 / (EkeV / 1000);
/** Pico de Gamow E₀ = (E_G (kT)²/4)^{1/3} (keV). */
export const gamowPeakKeV = (kTkeV: number) => ((gamowEnergyKeV() * kTkeV * kTkeV) / 4) ** (1 / 3);

// ---------------------------------------------------------------- reação em cadeia

/** Nêutrons por fissão (média, U-235). */
export const NU = 2.43;

export interface Core {
  /** Livre caminho médio (cm). */
  lambda: number;
  /** Probabilidades por colisão: fissão, captura (combustível + moderador + barras). */
  pf: number;
  pc: number;
  /** Probabilidade de escapar da captura ressonante durante a moderação. */
  pRes: number;
  /** Colisões por passo de animação (os moderados colidem muito mais). */
  perStep: number;
  kInf: number;
  /** Área de migração M² (cm²) e raio crítico (cm) da difusão de um grupo. */
  M2: number;
  Rc: number;
  extrap: number;
}

/**
 * Núcleo homogêneo: enriquecimento e (fração de U-235), moderador (0 nenhum, 1 grafite,
 * 2 água leve) e inserção das barras de controle h (0 a 1), em seções de choque por átomo
 * de combustível (barns). Modelo didático de um grupo de energia.
 */
export function core(e: number, moderator: number, rods: number): Core {
  let sf: number;
  let sc: number;
  let ss: number;
  let lambda: number;
  let pRes = 1;
  let perStep = 1;
  if (moderator === 0) {
    sf = e * 1.235 + (1 - e) * 0.06;
    sc = e * 0.09 + (1 - e) * 0.25;
    ss = 4.4;
    lambda = 3.6;
  } else {
    sf = e * 585;
    sc = e * 99 + (1 - e) * 2.68;
    const graphite = moderator === 1;
    // captura no moderador e espalhamentos por átomo de combustível
    const sm = graphite ? 0.6 : 3.0;
    sc += sm;
    // espalhamentos que dão a área de migração típica: ~3000 cm² (grafite), ~60 cm² (água)
    lambda = graphite ? 2.6 : 1.0;
    const M2target = graphite ? 3000 : 60;
    const sa = sf + sc;
    ss = Math.max(0, (3 * M2target * sa) / (lambda * lambda) - sa);
    pRes = Math.exp(-(1 - e) * (graphite ? 0.128 : 0.29));
    perStep = graphite ? 60 : 8;
  }
  // barras: absorvedor adicional proporcional à inserção
  const sRod = rods * 1.2 * (sf + sc);
  sc += sRod;
  const st = sf + sc + ss;
  const pf = sf / st;
  const pc = sc / st;
  const kInf = (NU * pf * pRes) / (pf + pc);
  const N = 1 / (pf + pc);
  const M2 = (N * lambda * lambda) / 3;
  const extrap = 0.71 * lambda;
  const Rc = kInf > 1 ? (Math.PI * Math.sqrt(M2)) / Math.sqrt(kInf - 1) - extrap : Infinity;
  return { lambda, pf, pc, pRes, perStep, kInf, M2, Rc, extrap };
}

/** k efetivo da esfera nua de raio R (difusão de um grupo): k = k∞ / (1 + M²B²), B = π/(R + d). */
export function kEff(c: Core, R: number): number {
  const B = Math.PI / (R + c.extrap);
  return c.kInf / (1 + c.M2 * B * B);
}

/** Massa (kg) de urânio metálico (18,7 g/cm³) numa esfera de raio R (cm). */
export const uraniumMassKg = (R: number) => (18.7 * (4 / 3) * Math.PI * R ** 3) / 1000;

export interface ChainState {
  seed: number;
  /** Posições (cm): [x, y, z, ...]. */
  pos: number[];
  /** Quantos nêutrons reais cada nêutron simulado representa. */
  weight: number;
  /** Médias móveis de produção e remoção (por passo, com peso). */
  prod: number;
  loss: number;
  leak: number;
  /** Fissões recentes [x, z, idade]. */
  flashes: number[];
  /** Histórico de log₁₀ da população. */
  hist: number[];
  generations: number;
}

export function nextRandom(st: { seed: number }): number {
  st.seed = (st.seed + 0x6d2b79f5) >>> 0;
  let t = st.seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function isotropic(st: { seed: number }): [number, number, number] {
  const cz = 2 * nextRandom(st) - 1;
  const ph = 2 * Math.PI * nextRandom(st);
  const s = Math.sqrt(1 - cz * cz);
  return [s * Math.cos(ph), s * Math.sin(ph), cz];
}

export const MAX_N = 400;

export function initChain(R: number, seed = 2024, count = 120): ChainState {
  const st: ChainState = { seed, pos: [], weight: 1, prod: 0, loss: 0, leak: 0, flashes: [], hist: [Math.log10(count)], generations: 0 };
  for (let i = 0; i < count; i++) {
    const d = isotropic(st);
    const r = 0.5 * R * Math.cbrt(nextRandom(st));
    st.pos.push(d[0] * r, d[1] * r, d[2] * r);
  }
  return st;
}

/**
 * Um passo do Monte Carlo: cada nêutron voa uma distância exponencial (livre caminho
 * médio λ) em direção isotrópica e colide (fissão, captura ou espalhamento), ou
 * escapa se sair da esfera. Controla a população por roleta/divisão (peso).
 */
export function stepChain(s0: ChainState, c: Core, R: number, collisions = c.perStep): ChainState {
  const s: ChainState = { ...s0, pos: [], flashes: [] };
  let produced = 0;
  let removed = 0;
  let leaked = 0;
  let cur = s0.pos;
  for (let k = 0; k < collisions && cur.length; k++) {
    const next: number[] = [];
    for (let i = 0; i < cur.length; i += 3) {
      const d = isotropic(s);
      const l = -c.lambda * Math.log(1 - nextRandom(s));
      const x = cur[i]! + d[0] * l;
      const y = cur[i + 1]! + d[1] * l;
      const z = cur[i + 2]! + d[2] * l;
      if (x * x + y * y + z * z > R * R) {
        removed++;
        leaked++;
        continue;
      }
      const u = nextRandom(s);
      if (u < c.pf) {
        removed++;
        const nn = nextRandom(s) < NU - 2 ? 3 : 2;
        // nêutrons capturados nas ressonâncias durante a moderação não contam como produzidos
        for (let j = 0; j < nn; j++)
          if (nextRandom(s) < c.pRes) {
            next.push(x, y, z);
            produced++;
          }
        if (s.flashes.length < 120) s.flashes.push(x, z, 0);
      } else if (u < c.pf + c.pc) removed++;
      else next.push(x, y, z);
    }
    cur = next;
  }
  // controle de população
  let w = s0.weight;
  let n = cur.length / 3;
  if (n > MAX_N) {
    const keep: number[] = [];
    const f = MAX_N / n;
    for (let i = 0; i < cur.length; i += 3) if (nextRandom(s) < f) keep.push(cur[i]!, cur[i + 1]!, cur[i + 2]!);
    w *= n / Math.max(1, keep.length / 3);
    cur = keep;
    n = cur.length / 3;
  }
  while (n > 0 && n < MAX_N / 4 && w >= 2) {
    cur = cur.concat(cur);
    w /= 2;
    n *= 2;
  }
  s.pos = cur;
  s.weight = w;
  const a = 0.9;
  s.prod = a * s0.prod + (1 - a) * produced * s0.weight;
  s.loss = a * s0.loss + (1 - a) * removed * s0.weight;
  s.leak = a * s0.leak + (1 - a) * leaked * s0.weight;
  const pop = n * w;
  s.hist = s0.hist.concat([pop > 0 ? Math.log10(pop) : -1]);
  if (s.hist.length > 400) s.hist.splice(0, s.hist.length - 400);
  // fissões anteriores envelhecem
  for (let i = 0; i < s0.flashes.length; i += 3) if (s0.flashes[i + 2]! < 6 && s.flashes.length < 240) s.flashes.push(s0.flashes[i]!, s0.flashes[i + 1]!, s0.flashes[i + 2]! + 1);
  s.generations = s0.generations + 1;
  return s;
}

/** k medido = nêutrons produzidos / nêutrons removidos (absorvidos + escapados). */
export const measuredK = (s: ChainState) => (s.loss > 0 ? s.prod / s.loss : 0);
export const population = (s: ChainState) => (s.pos.length / 3) * s.weight;
