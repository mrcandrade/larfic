import { particle, type Particle } from "./data.ts";

export * from "./data.ts";

/** Massa do elétron (MeV/c²) e unidade de massa atômica (MeV/c²). */
export const ME = 0.51099895;
export const U_MEV = 931.49410242;

// ------------------------------------------------------------------ conservação

export type QKey = "q" | "B" | "Le" | "Lm" | "Lt" | "S";
export const QKEYS: { key: QKey; label: string; tex: string }[] = [
  { key: "q", label: "carga Q", tex: "Q" },
  { key: "B", label: "número bariônico B", tex: "B" },
  { key: "Le", label: "número leptônico Lₑ", tex: "L_e" },
  { key: "Lm", label: "número leptônico L_μ", tex: "L_\\mu" },
  { key: "Lt", label: "número leptônico L_τ", tex: "L_\\tau" },
  { key: "S", label: "estranheza S", tex: "S" },
];

export const sumOf = (ps: Particle[], k: QKey) => ps.reduce((a, p) => a + p[k], 0);
const same = (a: number, b: number) => Math.abs(a - b) < 1e-9;

/** Energia disponível no referencial do centro de massa (MeV): decaimento ou projétil (1º) com energia cinética K contra alvo parado (2º). */
export function sqrtS(left: Particle[], K: number): number {
  if (left.length === 1) return left[0]!.m;
  if (left.length !== 2) return Number.NaN;
  const [a, b] = left as [Particle, Particle];
  const E1 = K + a.m;
  return Math.sqrt(a.m * a.m + b.m * b.m + 2 * b.m * E1);
}

/** Energia cinética mínima do projétil (alvo parado) para produzir massa total M (MeV). */
export function thresholdK(m1: number, m2: number, M: number): number {
  if (M <= m1 + m2) return 0;
  return (M * M - (m1 + m2) ** 2) / (2 * m2);
}

export type Interaction = "forte" | "eletromagnética" | "fraca";

export interface Check {
  /** Somas de cada número quântico nos dois lados. */
  sums: Record<QKey, [number, number]>;
  conserved: Record<QKey, boolean>;
  /** Paridade do número de férmions (spin semi-inteiro): exigida pela conservação do momento angular. */
  spinOk: boolean;
  /** √s disponível e soma das massas dos produtos (MeV). */
  available: number;
  massOut: number;
  /** Q da reação (MeV) = √s − Σ m (produtos), quando o CM está em repouso. */
  Q: number;
  energyOk: boolean;
  /** Energia cinética mínima do projétil (só colisões). */
  Kth: number;
  dS: number;
  allowed: boolean;
  interaction: Interaction | null;
  reasons: string[];
}

const isHadron = (p: Particle) => p.kind === "meson" || p.kind === "baryon";
const isNeutrino = (p: Particle) => p.kind === "lepton" && p.q === 0;
const isFermion = (p: Particle) => Math.round(p.spin * 2) % 2 === 1;

/** Confere uma reação: leis de conservação, energia e qual interação a permite. */
export function checkReaction(left: Particle[], right: Particle[], K = 0): Check {
  const sums = {} as Record<QKey, [number, number]>;
  const conserved = {} as Record<QKey, boolean>;
  for (const { key } of QKEYS) {
    sums[key] = [sumOf(left, key), sumOf(right, key)];
    conserved[key] = same(sums[key][0], sums[key][1]);
  }
  const spinOk = left.filter(isFermion).length % 2 === right.filter(isFermion).length % 2;
  const available = sqrtS(left, K);
  const massOut = right.reduce((a, p) => a + p.m, 0);
  const energyOk = Number.isFinite(available) && available >= massOut - 1e-9 && right.length > 0;
  const Kth = left.length === 2 ? thresholdK(left[0]!.m, left[1]!.m, massOut) : 0;
  const dS = sums.S[1] - sums.S[0];
  const reasons: string[] = [];
  if (left.length === 0 || right.length === 0) reasons.push("monte os dois lados da reação");
  for (const { key, label } of QKEYS) if (key !== "S" && !conserved[key]) reasons.push(`${label} não se conserva`);
  if (!spinOk) reasons.push("momento angular: o número de férmions (spin ½, 3/2) muda de paridade");
  if (left.length && right.length && !energyOk) {
    if (left.length === 1) reasons.push(left[0]!.m === 0 ? "uma partícula sem massa não decai sozinha" : "energia: a soma das massas dos produtos excede a massa inicial");
    else reasons.push("energia: abaixo do limiar de produção");
  }
  if (Math.abs(dS) > 1 + 1e-9) reasons.push("estranheza varia de 2 ou mais: nenhuma interação faz isso num só passo");
  const allowed = reasons.length === 0;
  let interaction: Interaction | null = null;
  if (allowed) {
    const all = [...left, ...right];
    if (all.some(isNeutrino) || Math.abs(dS) > 1e-9) interaction = "fraca";
    else if (all.every(isHadron)) interaction = "forte";
    else interaction = "eletromagnética";
  }
  return { sums, conserved, spinOk, available, massOut, Q: available - massOut, energyOk, Kth, dS, allowed, interaction, reasons };
}

// ------------------------------------------------------------------ cinemática relativística

/** Fator de Lorentz e distância média de voo L = γβcτ (m) de uma partícula com energia cinética K (MeV). */
export function decayLength(m: number, tau: number, K: number): { gamma: number; beta: number; L: number } {
  const gamma = 1 + K / m;
  const beta = Math.sqrt(1 - 1 / (gamma * gamma));
  return { gamma, beta, L: gamma * beta * 2.99792458e8 * tau };
}

/** Largura de decaimento Γ = ħ/τ (MeV). */
export const width = (tau: number) => (Number.isFinite(tau) ? 6.582119569e-22 / tau : 0);

export interface Photon {
  E: number;
  /** Ângulo com o eixo do feixe (rad). */
  th: number;
}

/**
 * Aniquilação e⁺ + e⁻ → γ + γ com o elétron parado e o pósitron com energia cinética K (MeV).
 * No CM cada fóton tem E* = √s/2 e sai num ângulo θ* (o outro em θ* + π); a transformação de
 * Lorentz dá as energias e ângulos no laboratório.
 */
export function annihilation(K: number, thStar: number) {
  const Ep = K + ME;
  const p = Math.sqrt(Math.max(Ep * Ep - ME * ME, 0));
  const E = Ep + ME;
  const s = Math.sqrt(2 * ME * ME + 2 * ME * Ep);
  const beta = p / E;
  const gamma = E / s;
  const Es = s / 2;
  const lab = (th: number): Photon => {
    const c = Math.cos(th);
    const sn = Math.sin(th);
    const e = gamma * Es * (1 + beta * c);
    return { E: e, th: Math.atan2(sn, gamma * (c + beta)) };
  };
  return { s, beta, gamma, Estar: Es, pBeam: p, Etot: E, g1: lab(thStar), g2: lab(thStar + Math.PI) };
}

/** Energia mínima do fóton para criar um par e⁺e⁻ junto a um alvo de massa M (MeV): 2mc²(1 + m/M). */
export const pairThreshold = (M: number) => (M > 0 ? 2 * ME * (1 + ME / M) : Number.POSITIVE_INFINITY);

export interface PairProduction {
  ok: boolean;
  /** Energias totais do elétron e do pósitron (MeV). */
  Em: number;
  Ep: number;
  /** Momento de recuo do núcleo (MeV/c) e sua energia cinética (MeV). */
  q: [number, number];
  TN: number;
}

/**
 * Produção de par γ + N → e⁻ + e⁺ + N. O elétron e o pósitron saem a ±θ do feixe e dividem a
 * energia na fração f; o núcleo leva o momento que falta. A energia total do par é achada por
 * bissecção para que a energia se conserve exatamente.
 */
export function pairProduction(Eg: number, M: number, th: number, f: number): PairProduction {
  const fail: PairProduction = { ok: false, Em: 0, Ep: 0, q: [0, 0], TN: 0 };
  if (!(M > 0) || Eg < pairThreshold(M)) return fail;
  const pe = (E: number) => Math.sqrt(Math.max(E * E - ME * ME, 0));
  const split = (Epair: number) => {
    const T = Epair - 2 * ME;
    return [ME + f * T, ME + (1 - f) * T] as const;
  };
  const recoil = (Epair: number): [number, number] => {
    const [a, b] = split(Epair);
    const pa = pe(a);
    const pb = pe(b);
    return [Eg - (pa + pb) * Math.cos(th), -(pa - pb) * Math.sin(th)];
  };
  const g = (Epair: number) => {
    const [qx, qy] = recoil(Epair);
    return Epair + Math.sqrt(M * M + qx * qx + qy * qy) - Eg - M;
  };
  let lo = 2 * ME;
  let hi = Eg;
  if (g(lo) > 0 || g(hi) < 0) return fail;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (g(mid) > 0) hi = mid;
    else lo = mid;
  }
  const Epair = (lo + hi) / 2;
  const [Em, Ep] = split(Epair);
  const q = recoil(Epair);
  return { ok: true, Em, Ep, q, TN: Math.sqrt(M * M + q[0] ** 2 + q[1] ** 2) - M };
}

// ------------------------------------------------------------------ quarks e hádrons

export type Flavor = "u" | "d" | "s" | "c";
export interface QuarkTok {
  f: Flavor;
  bar: boolean;
}
export const FLAVORS: Flavor[] = ["u", "d", "s", "c"];
export const QUARK_Q: Record<Flavor, number> = { u: 2 / 3, d: -1 / 3, s: -1 / 3, c: 2 / 3 };
export const QUARK_M: Record<Flavor, number> = { u: 2.16, d: 4.7, s: 93.5, c: 1273 };

export interface Hadron {
  sym: string;
  name: string;
  m: number;
  spin: number;
  note?: string;
}

const B12: Record<string, Hadron> = {
  uud: { sym: "p", name: "próton", m: 938.272, spin: 0.5 },
  udd: { sym: "n", name: "nêutron", m: 939.565, spin: 0.5 },
  uds: { sym: "Λ^0", name: "lambda", m: 1115.683, spin: 0.5, note: "o Σ⁰ (1192,6 MeV) tem o mesmo conteúdo, com os spins de u e d alinhados" },
  suu: { sym: "Σ^+", name: "sigma", m: 1189.37, spin: 0.5 },
  dds: { sym: "Σ^-", name: "sigma", m: 1197.449, spin: 0.5 },
  ssu: { sym: "Ξ^0", name: "csi", m: 1314.86, spin: 0.5 },
  dss: { sym: "Ξ^-", name: "csi", m: 1321.71, spin: 0.5 },
  cud: { sym: "Λ_c^+", name: "lambda c", m: 2286.46, spin: 0.5 },
  cuu: { sym: "Σ_c^{++}", name: "sigma c", m: 2453.97, spin: 0.5 },
  cdd: { sym: "Σ_c^0", name: "sigma c", m: 2453.75, spin: 0.5 },
  csu: { sym: "Ξ_c^+", name: "csi c", m: 2467.71, spin: 0.5 },
  cds: { sym: "Ξ_c^0", name: "csi c", m: 2470.44, spin: 0.5 },
  css: { sym: "Ω_c^0", name: "ômega c", m: 2695.2, spin: 0.5 },
};
const B32: Record<string, Hadron> = {
  uuu: { sym: "Δ^{++}", name: "delta", m: 1232, spin: 1.5 },
  uud: { sym: "Δ^+", name: "delta", m: 1232, spin: 1.5 },
  udd: { sym: "Δ^0", name: "delta", m: 1232, spin: 1.5 },
  ddd: { sym: "Δ^-", name: "delta", m: 1232, spin: 1.5 },
  suu: { sym: "Σ^{*+}", name: "sigma estrela", m: 1382.8, spin: 1.5 },
  uds: { sym: "Σ^{*0}", name: "sigma estrela", m: 1383.7, spin: 1.5 },
  dds: { sym: "Σ^{*-}", name: "sigma estrela", m: 1387.2, spin: 1.5 },
  ssu: { sym: "Ξ^{*0}", name: "csi estrela", m: 1531.8, spin: 1.5 },
  dss: { sym: "Ξ^{*-}", name: "csi estrela", m: 1535, spin: 1.5 },
  sss: { sym: "Ω^-", name: "ômega", m: 1672.45, spin: 1.5 },
  cuu: { sym: "Σ_c^{*++}", name: "sigma c estrela", m: 2518.41, spin: 1.5 },
  cud: { sym: "Σ_c^{*+}", name: "sigma c estrela", m: 2517.5, spin: 1.5 },
  cdd: { sym: "Σ_c^{*0}", name: "sigma c estrela", m: 2518.48, spin: 1.5 },
};
/** Mésons por "quark + antiquark". */
const M0: Record<string, Hadron> = {
  "u~d": { sym: "π^+", name: "píon", m: 139.57, spin: 0 },
  "d~u": { sym: "π^-", name: "píon", m: 139.57, spin: 0 },
  "u~u": { sym: "π^0", name: "píon", m: 134.977, spin: 0, note: "o π⁰ é a mistura (uū − dd̄)/√2" },
  "d~d": { sym: "π^0", name: "píon", m: 134.977, spin: 0, note: "o π⁰ é a mistura (uū − dd̄)/√2" },
  "s~s": { sym: "η", name: "eta", m: 547.862, spin: 0, note: "ss̄ com spin 0 não aparece puro: está misturado no η e no η′" },
  "u~s": { sym: "K^+", name: "káon", m: 493.677, spin: 0 },
  "d~s": { sym: "K^0", name: "káon", m: 497.611, spin: 0 },
  "s~u": { sym: "K^-", name: "káon", m: 493.677, spin: 0 },
  "s~d": { sym: "~K^0", name: "antikáon", m: 497.611, spin: 0 },
  "c~d": { sym: "D^+", name: "méson D", m: 1869.66, spin: 0 },
  "c~u": { sym: "D^0", name: "méson D", m: 1864.84, spin: 0 },
  "c~s": { sym: "D_s^+", name: "méson D_s", m: 1968.35, spin: 0 },
  "d~c": { sym: "D^-", name: "méson D", m: 1869.66, spin: 0 },
  "u~c": { sym: "~D^0", name: "méson D", m: 1864.84, spin: 0 },
  "s~c": { sym: "D_s^-", name: "méson D_s", m: 1968.35, spin: 0 },
  "c~c": { sym: "η_c", name: "eta c", m: 2983.9, spin: 0 },
};
const M1: Record<string, Hadron> = {
  "u~d": { sym: "ρ^+", name: "rô", m: 775.11, spin: 1 },
  "d~u": { sym: "ρ^-", name: "rô", m: 775.11, spin: 1 },
  "u~u": { sym: "ρ^0", name: "rô", m: 775.26, spin: 1, note: "ρ⁰ e ω são misturas de uū e dd̄" },
  "d~d": { sym: "ω", name: "ômega (méson)", m: 782.66, spin: 1, note: "ρ⁰ e ω são misturas de uū e dd̄" },
  "s~s": { sym: "φ", name: "fi", m: 1019.461, spin: 1 },
  "u~s": { sym: "K^{*+}", name: "káon estrela", m: 891.67, spin: 1 },
  "d~s": { sym: "K^{*0}", name: "káon estrela", m: 895.55, spin: 1 },
  "s~u": { sym: "K^{*-}", name: "káon estrela", m: 891.67, spin: 1 },
  "s~d": { sym: "~K^{*0}", name: "antikáon estrela", m: 895.55, spin: 1 },
  "c~d": { sym: "D^{*+}", name: "D estrela", m: 2010.26, spin: 1 },
  "c~u": { sym: "D^{*0}", name: "D estrela", m: 2006.85, spin: 1 },
  "c~s": { sym: "D_s^{*+}", name: "D_s estrela", m: 2112.2, spin: 1 },
  "d~c": { sym: "D^{*-}", name: "D estrela", m: 2010.26, spin: 1 },
  "u~c": { sym: "~D^{*0}", name: "D estrela", m: 2006.85, spin: 1 },
  "s~c": { sym: "D_s^{*-}", name: "D_s estrela", m: 2112.2, spin: 1 },
  "c~c": { sym: "J/ψ", name: "J/psi", m: 3096.9, spin: 1 },
};

/** Chave das tabelas de bárions com o mesmo multiconjunto de sabores. */
function baryonKey(fs: Flavor[]): string {
  const target = [...fs].sort().join("");
  for (const k of [...Object.keys(B12), ...Object.keys(B32)]) if ([...k].sort().join("") === target) return k;
  return target;
}

/** Prefixo "anti" com a grafia do português (antissigma, antipróton). */
export const antiName = (name: string) => `anti${/^[sr]/.test(name) ? name[0] : ""}${name}`;

const barSym = (sym: string) => {
  const flip = (x: string) => x.replace(/\^(\{[^}]*\}|[+-])/, (m) => m.replace(/[+-]/g, (c) => (c === "+" ? "-" : "+")));
  return `~${flip(sym)}`;
};

export interface BuildResult {
  q: number;
  B: number;
  S: number;
  C: number;
  /** Combinação sem cor (singleto)? */
  colorless: boolean;
  kind: "barion" | "antibarion" | "meson" | "nenhum";
  hadron: Hadron | null;
  quarkMass: number;
  message: string;
}

/** Monta um hádron a partir de quarks e antiquarks e identifica o estado fundamental com o spin pedido. */
export function build(toks: QuarkTok[], aligned: boolean): BuildResult {
  const q = toks.reduce((a, t) => a + (t.bar ? -1 : 1) * QUARK_Q[t.f], 0);
  const B = toks.reduce((a, t) => a + (t.bar ? -1 : 1) / 3, 0);
  const S = toks.reduce((a, t) => a + (t.f === "s" ? (t.bar ? 1 : -1) : 0), 0);
  const C = toks.reduce((a, t) => a + (t.f === "c" ? (t.bar ? -1 : 1) : 0), 0);
  const quarkMass = toks.reduce((a, t) => a + QUARK_M[t.f], 0);
  const nq = toks.filter((t) => !t.bar).length;
  const na = toks.length - nq;
  const base = { q, B, S, C, quarkMass };
  if (toks.length === 0) return { ...base, colorless: true, kind: "nenhum", hadron: null, message: "Clique nos quarks para colocá-los na sacola." };
  if (nq === 3 && na === 0) {
    const k = baryonKey(toks.map((t) => t.f));
    const h = (aligned ? B32 : B12)[k] ?? null;
    const msg = h
      ? `bárion: três quarks, um de cada cor (vermelho + verde + azul = branco)`
      : aligned
        ? "combinação sem estado tabelado aqui (bárions com dois ou três quarks c)"
        : ["uuu", "ddd", "sss"].includes(k)
          ? "três quarks iguais com spin ½ não existem: o princípio de Pauli exige spins alinhados (3/2)"
          : "combinação sem estado tabelado aqui (bárions com dois ou três quarks c)";
    return { ...base, colorless: true, kind: "barion", hadron: h, message: msg };
  }
  if (na === 3 && nq === 0) {
    const k = baryonKey(toks.map((t) => t.f));
    const h0 = (aligned ? B32 : B12)[k];
    const h = h0 ? { ...h0, sym: barSym(h0.sym), name: antiName(h0.name) } : null;
    return { ...base, colorless: true, kind: "antibarion", hadron: h, message: h ? "antibárion: três antiquarks (antivermelho + antiverde + antiazul)" : "antibárion sem estado tabelado aqui" };
  }
  if (nq === 1 && na === 1) {
    const qk = toks.find((t) => !t.bar)!.f;
    const ak = toks.find((t) => t.bar)!.f;
    const h = (aligned ? M1 : M0)[`${qk}~${ak}`] ?? null;
    return { ...base, colorless: true, kind: "meson", hadron: h, message: "méson: quark e antiquark com cor e anticor (vermelho + antivermelho = branco)" };
  }
  const reason =
    toks.length === 1
      ? "um quark sozinho tem cor: o confinamento impede que exista isolado"
      : nq === 2 && na === 0
        ? "dois quarks têm cor líquida: não formam um hádron"
        : na === 2 && nq === 0
          ? "dois antiquarks têm cor líquida: não formam um hádron"
          : "esta combinação não é branca (não forma singleto de cor) com até três peças";
  return { ...base, colorless: false, kind: "nenhum", hadron: null, message: reason };
}

/** Número de bárions distintos (combinações de 3 quarks com repetição) com n sabores: n(n+1)(n+2)/6. */
export const baryonFlavorStates = (n: number) => (n * (n + 1) * (n + 2)) / 6;

// ------------------------------------------------------------------ caminho óctuplo

export interface MultipletMember {
  id: string;
  /** Terceira componente do isospin e estranheza: coordenadas no diagrama. */
  I3: number;
  S: number;
}

const memb = (id: string): MultipletMember => {
  const p = particle(id);
  return { id, I3: p.q - (p.B + p.S) / 2, S: p.S };
};

export const OCTET = ["n", "p", "Sigma-", "Sigma0", "Lambda", "Sigma+", "Xi-", "Xi0"].map(memb);
export const DECUPLET = ["Delta-", "Delta0", "Delta+", "Delta++", "Sigmas-", "Sigmas0", "Sigmas+", "Xis-", "Xis0", "Omega-"].map(memb);
export const NONET = ["K0", "K+", "anti-pi+", "pi0", "eta", "pi+", "anti-K+", "Kbar0", "etap"].map(memb);

/** Massa média de cada linha de estranheza no decupleto (MeV). */
export function decupletRows(): { S: number; m: number }[] {
  const rows = new Map<number, number[]>();
  for (const d of DECUPLET) rows.set(d.S, [...(rows.get(d.S) ?? []), particle(d.id).m]);
  return [...rows.entries()].map(([S, ms]) => ({ S, m: ms.reduce((a, b) => a + b, 0) / ms.length })).sort((a, b) => b.S - a.S);
}

/** Previsão de Gell-Mann (espaçamento igual): m(Ω) = m(Ξ*) + [m(Ξ*) − m(Δ)]/2, com as médias das três primeiras linhas. */
export function predictOmega(): number {
  const rows = decupletRows();
  const d = rows[0]!.m;
  const x = rows[2]!.m;
  return x + (x - d) / 2;
}

/** Relação de Gell-Mann–Okubo do octeto: (m_N + m_Ξ)/2 vs (3m_Λ + m_Σ)/4. */
export function gmoOctet(): { lhs: number; rhs: number } {
  const mN = (particle("p").m + particle("n").m) / 2;
  const mXi = (particle("Xi0").m + particle("Xi-").m) / 2;
  const mSig = (particle("Sigma+").m + particle("Sigma0").m + particle("Sigma-").m) / 3;
  return { lhs: (mN + mXi) / 2, rhs: (3 * particle("Lambda").m + mSig) / 4 };
}
