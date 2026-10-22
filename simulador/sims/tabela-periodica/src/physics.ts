// Átomos com muitos elétrons: princípio de exclusão, regra de Hund, poços com N elétrons e lei de Moseley.
import { IONIZATION_EV, KALPHA_KEV, RADIUS_PM, SYMBOLS } from "./data.ts";

export const L_LETTERS = ["s", "p", "d", "f"];
export const ZMAX = 118;
export const NOBLE = [2, 10, 18, 36, 54, 86, 118];

export interface Subshell {
  n: number;
  l: number;
}

/** Subcamadas na ordem de Madelung (n + l crescente; empate: n crescente), até 7p. */
export const MADELUNG: Subshell[] = (() => {
  const out: Subshell[] = [];
  for (let s = 1; s <= 8; s++)
    for (let n = 1; n <= 7; n++) {
      const l = s - n;
      if (l >= 0 && l < n && l <= 3) out.push({ n, l });
    }
  return out.filter((q) => q.n + q.l <= 8 && !(q.n === 8));
})();

export const capacity = (l: number) => 2 * (2 * l + 1);
export const label = (q: Subshell) => `${q.n}${L_LETTERS[q.l]}`;

/** Diferenças das configurações reais (estado fundamental medido) em relação à regra de Madelung. */
export const EXCEPTIONS: Record<number, Record<string, number>> = {
  24: { "4s": -1, "3d": 1 },
  29: { "4s": -1, "3d": 1 },
  41: { "5s": -1, "4d": 1 },
  42: { "5s": -1, "4d": 1 },
  44: { "5s": -1, "4d": 1 },
  45: { "5s": -1, "4d": 1 },
  46: { "5s": -2, "4d": 2 },
  47: { "5s": -1, "4d": 1 },
  57: { "4f": -1, "5d": 1 },
  58: { "4f": -1, "5d": 1 },
  64: { "4f": -1, "5d": 1 },
  78: { "6s": -1, "5d": 1 },
  79: { "6s": -1, "5d": 1 },
  89: { "5f": -1, "6d": 1 },
  90: { "5f": -2, "6d": 2 },
  91: { "5f": -1, "6d": 1 },
  92: { "5f": -1, "6d": 1 },
  93: { "5f": -1, "6d": 1 },
  96: { "5f": -1, "6d": 1 },
  103: { "6d": -1, "7p": 1 },
};

/** Ocupação de cada subcamada (na ordem de Madelung) para Z elétrons. */
export function configuration(Z: number, real = true): number[] {
  let left = Math.max(0, Math.min(ZMAX, Math.round(Z)));
  const occ = MADELUNG.map((q) => {
    const k = Math.min(left, capacity(q.l));
    left -= k;
    return k;
  });
  const ex = real ? EXCEPTIONS[Math.round(Z)] : undefined;
  if (ex) MADELUNG.forEach((q, i) => (occ[i]! += ex[label(q)] ?? 0));
  return occ;
}

const SUP = "⁰¹²³⁴⁵⁶⁷⁸⁹";
export const sup = (k: number) => String(k).split("").map((c) => SUP[Number(c)]).join("");

/** Configuração escrita por extenso (ordem de preenchimento) ou abreviada com o gás nobre anterior. */
export function configString(Z: number, real = true, abbreviated = false): string {
  const occ = configuration(Z, real);
  let core: number[] | null = null;
  let prefix = "";
  if (abbreviated) {
    const ng = [...NOBLE].reverse().find((z) => z < Z);
    if (ng) {
      core = configuration(ng, false);
      prefix = `[${SYMBOLS[ng - 1]}] `;
    }
  }
  const parts = MADELUNG.map((q, i) => ({ q, k: occ[i]!, c: core?.[i] ?? 0 }))
    .filter(({ k, c }) => k > c)
    .map(({ q, k }) => `${label(q)}${sup(k)}`);
  return (prefix + parts.join(" ")).trim();
}

/** Ocupação das caixas (orbitais mₗ = +l … −l) de uma subcamada com k elétrons pela regra de Hund: [spin ↑, spin ↓]. */
export function hundBoxes(l: number, k: number): [boolean, boolean][] {
  const m = 2 * l + 1;
  return Array.from({ length: m }, (_, i) => [i < k, i < k - m] as [boolean, boolean]);
}

export const unpairedIn = (l: number, k: number) => (k <= 2 * l + 1 ? k : capacity(l) - k);

/** Número de elétrons desemparelhados no estado fundamental (regra de Hund). */
export function unpaired(Z: number, real = true): number {
  const occ = configuration(Z, real);
  return MADELUNG.reduce((a, q, i) => a + unpairedIn(q.l, occ[i]!), 0);
}

/** Números quânticos do j-ésimo elétron (0-based) colocado numa subcamada, seguindo Hund. */
export function electronQN(q: Subshell, j: number) {
  const m = 2 * q.l + 1;
  return j < m ? { n: q.n, l: q.l, ml: q.l - j, ms: 0.5 } : { n: q.n, l: q.l, ml: q.l - (j - m), ms: -0.5 };
}

/** Termo espectroscópico ²ˢ⁺¹L_J do estado fundamental pelas três regras de Hund. */
export function hundTerm(Z: number, real = true): { S: number; L: number; J: number; text: string } {
  const occ = configuration(Z, real);
  let S = 0, L = 0, dominant = -1, domK = 0;
  MADELUNG.forEach((q, i) => {
    const k = occ[i]!;
    if (k === 0 || k === capacity(q.l)) return;
    const boxes = hundBoxes(q.l, k);
    boxes.forEach(([u, d], b) => {
      const ml = q.l - b;
      if (u) L += ml;
      if (d) L += ml;
    });
    S += unpairedIn(q.l, k) / 2;
    if (q.l >= dominant) {
      dominant = q.l;
      domK = k;
    }
  });
  const half = dominant >= 0 ? 2 * dominant + 1 : 0;
  const J = dominant < 0 ? 0 : domK < half ? Math.abs(L - S) : L + S;
  const letters = "SPDFGHIKLMNOQ";
  const jTxt = Number.isInteger(J) ? String(J) : `${Math.round(2 * J)}/2`;
  return { S, L, J, text: `${2 * S + 1}${letters[L] ?? "?"}${jTxt}` };
}

/** Bloco (s, p, d, f) do elemento: o da última subcamada pela regra de Madelung (He é do bloco s). */
export function block(Z: number): number {
  const occ = configuration(Z, false);
  let last = 0;
  occ.forEach((k, i) => k > 0 && (last = i));
  return MADELUNG[last]!.l;
}

/** Período e grupo (1–18) na tabela; lantanídeos e actinídeos ficam com grupo 3 e `f = true`. */
export function position(Z: number): { period: number; group: number; f: boolean; fIndex: number } {
  const starts = [1, 3, 11, 19, 37, 55, 87, 119];
  let period = 1;
  while (Z >= starts[period]!) period++;
  const i = Z - starts[period - 1]!;
  if (period === 1) return { period, group: Z === 1 ? 1 : 18, f: false, fIndex: -1 };
  if (period <= 3) return { period, group: i < 2 ? i + 1 : i + 10, f: false, fIndex: -1 };
  if (period <= 5) return { period, group: i + 1, f: false, fIndex: -1 };
  if (i < 2) return { period, group: i + 1, f: false, fIndex: -1 };
  if (i <= 16) return { period, group: 3, f: true, fIndex: i - 2 };
  return { period, group: i - 13, f: false, fIndex: -1 };
}

// ---------- Carga efetiva (regras de Slater) ----------

/** Índice do grupo de Slater: [1s] [2s,2p] [3s,3p] [3d] [4s,4p] [4d] [4f] [5s,5p] [5d] [5f] [6s,6p] [6d] [7s,7p]. */
function slaterGroup(q: Subshell): number {
  const order = ["1s", "2sp", "3sp", "3d", "4sp", "4d", "4f", "5sp", "5d", "5f", "6sp", "6d", "7sp"];
  const key = q.l <= 1 ? `${q.n}sp` : `${q.n}${L_LETTERS[q.l]}`;
  return order.indexOf(key === "1sp" ? "1s" : key);
}

/** Subcamada do elétron mais externo (maior n; empate: maior l). */
export function outermost(Z: number, real = true): Subshell {
  const occ = configuration(Z, real);
  let best: Subshell = { n: 1, l: 0 };
  MADELUNG.forEach((q, i) => {
    if (occ[i]! > 0 && (q.n > best.n || (q.n === best.n && q.l > best.l))) best = q;
  });
  return best;
}

/** Carga nuclear efetiva sobre o elétron mais externo pelas regras de Slater (1930). */
export function slaterZeff(Z: number, real = true): { zeff: number; sigma: number; q: Subshell } {
  const occ = configuration(Z, real);
  const q = outermost(Z, real);
  const gq = slaterGroup(q);
  let sigma = 0;
  MADELUNG.forEach((r, i) => {
    let k = occ[i]!;
    if (k === 0) return;
    const gr = slaterGroup(r);
    if (gr === gq) k -= r.n === q.n && r.l === q.l ? 1 : 0;
    if (k <= 0) return;
    if (gr === gq) sigma += k * (q.n === 1 ? 0.3 : 0.35);
    else if (gr > gq) return;
    else if (q.l >= 2) sigma += k;
    else if (r.n === q.n - 1) sigma += k * 0.85;
    else if (r.n < q.n - 1) sigma += k;
    else sigma += k; // d/f de mesmo n com grupo anterior (não ocorre para s/p externos)
  });
  return { zeff: Z - sigma, sigma, q };
}

/** Carga efetiva "medida": a que reproduz a energia de ionização num modelo hidrogenoide, n √(I/13,6 eV). */
export const zeffFromIE = (I: number, n: number) => n * Math.sqrt(I / RYDBERG_EV);

export const RYDBERG_EV = 13.6057;
export const ionization = (Z: number) => IONIZATION_EV[Z - 1] ?? NaN;
export const radius = (Z: number) => RADIUS_PM[Z - 1] ?? NaN;
export const ZDATA = IONIZATION_EV.length;

// ---------- N elétrons num poço infinito ----------

/** E₁ = h²/(8 m L²) em eV, com L em nm. */
export const H = 6.62607015e-34;
export const ME = 9.1093837015e-31;
export const QE = 1.602176634e-19;
export const e1eV = (Lnm: number) => (H * H) / (8 * ME * (Lnm * 1e-9) ** 2) / QE;

export interface Orbital {
  /** Números quânticos (1D: só nx). */
  nx: number;
  ny: number;
  /** Energia em unidades de E₁. */
  e: number;
  /** Elétrons ocupando o orbital (0, 1 ou 2). */
  occ: number;
}

/** Orbitais do poço 1D ou 2D (quadrado) em ordem de energia. */
export function wellOrbitals(dim: number, count: number): Orbital[] {
  const out: Orbital[] = [];
  if (dim === 1) {
    for (let n = 1; n <= count; n++) out.push({ nx: n, ny: 0, e: n * n, occ: 0 });
    return out;
  }
  const nMax = Math.ceil(Math.sqrt(count * 2)) + 3;
  for (let a = 1; a <= nMax; a++) for (let b = 1; b <= nMax; b++) out.push({ nx: a, ny: b, e: a * a + b * b, occ: 0 });
  out.sort((p, q) => p.e - q.e || p.nx - q.nx);
  return out.slice(0, count);
}

/**
 * Estado fundamental de N elétrons sem interação: com Pauli, cada orbital
 * recebe no máximo 2 (spins opostos); sem Pauli, todos vão para o mais baixo.
 * Dentro de um nível degenerado incompleto, distribui como Hund (um em cada).
 */
export function fillWell(N: number, dim: number, pauli = true): Orbital[] {
  const orbs = wellOrbitals(dim, Math.max(4, N + 6));
  if (!pauli) {
    orbs[0]!.occ = N;
    return orbs;
  }
  let left = N;
  let i = 0;
  while (left > 0 && i < orbs.length) {
    // nível degenerado [i, j)
    let j = i;
    while (j < orbs.length && orbs[j]!.e === orbs[i]!.e) j++;
    const g = j - i;
    const here = Math.min(left, 2 * g);
    for (let k = 0; k < here; k++) orbs[i + (k % g)]!.occ++;
    left -= here;
    i = j;
  }
  return orbs;
}

export function wellSummary(N: number, dim: number, pauli = true) {
  const orbs = fillWell(N, dim, pauli);
  const Etot = orbs.reduce((a, o) => a + o.occ * o.e, 0);
  const occd = orbs.filter((o) => o.occ > 0);
  const EF = occd.length ? Math.max(...occd.map((o) => o.e)) : 0;
  // Menor excitação: um elétron de um orbital ocupado para um orbital com vaga e energia maior.
  let dE = Infinity;
  const cap = pauli ? 2 : Infinity;
  for (const a of occd) for (const b of orbs) if (b.occ < cap && b.e > a.e) dE = Math.min(dE, b.e - a.e);
  return { orbs, Etot, EF, dE: Number.isFinite(dE) ? dE : 0 };
}

/** Densidade eletrônica total ∑ ocupação · |ψ|² num ponto (x, y em unidades de L, 0–1). */
export function wellDensity(orbs: Orbital[], dim: number, x: number, y = 0.5): number {
  let rho = 0;
  for (const o of orbs) {
    if (!o.occ) continue;
    const px = 2 * Math.sin(o.nx * Math.PI * x) ** 2;
    rho += o.occ * (dim === 1 ? px : px * 2 * Math.sin(o.ny * Math.PI * y) ** 2);
  }
  return rho;
}

// ---------- Lei de Moseley ----------

/** Frequência (Hz) de um fóton de energia E (keV). */
export const freqOf = (EkeV: number) => (EkeV * 1000 * QE) / H;
/** √f em 10⁸ Hz^½. */
export const sqrtF = (EkeV: number) => Math.sqrt(freqOf(EkeV)) / 1e8;
/** Previsão de Bohr–Moseley para Kα: E = (3/4) R∞hc (Z − 1)² (keV). */
export const moseleyE = (Z: number) => 0.75 * RYDBERG_EV * 1e-3 * (Z - 1) ** 2;
/** Coeficiente teórico de √f = k (Z − 1): k = √(3 c R∞ / 4), em 10⁸ Hz^½. */
export const kTheory = Math.sqrt((0.75 * RYDBERG_EV * QE) / H) / 1e8;
export const C = 299_792_458;

/** Ajuste linear por mínimos quadrados y = a + b x. */
export function linfit(xs: number[], ys: number[]): { a: number; b: number } {
  const n = xs.length;
  const mx = xs.reduce((s, v) => s + v, 0) / n;
  const my = ys.reduce((s, v) => s + v, 0) / n;
  let sxy = 0, sxx = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i]! - mx) * (ys[i]! - my);
    sxx += (xs[i]! - mx) ** 2;
  }
  const b = sxy / sxx;
  return { a: my - b * mx, b };
}

/** Ajuste √f = k (Z − σ) aos dados até zMax. */
export function moseleyFit(zMax = 50): { k: number; sigma: number } {
  const Zs = Object.keys(KALPHA_KEV).map(Number).filter((z) => z <= zMax);
  const { a, b } = linfit(Zs, Zs.map((z) => sqrtF(KALPHA_KEV[z]!)));
  return { k: b, sigma: -a / b };
}

/** Número atômico inferido de uma energia Kα medida (keV), pela lei de Bohr–Moseley. */
export const zFromKalpha = (EkeV: number) => 1 + Math.sqrt(EkeV / (0.75 * RYDBERG_EV * 1e-3));
