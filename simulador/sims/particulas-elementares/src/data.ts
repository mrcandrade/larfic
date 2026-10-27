/**
 * Dados das partículas (valores do PDG, Review of Particle Physics 2024).
 * Massas em MeV/c², carga em unidades de e, vida média em segundos.
 * Símbolos usam uma marcação curta, desenhada por `drawSym`:
 *   "~" no início = barra de antipartícula; "_x" = subscrito; "^x" = sobrescrito.
 */

export type Kind = "lepton" | "quark" | "meson" | "baryon" | "boson";
/** Interação responsável pelo decaimento (ou estado da partícula). */
export type Via = "forte" | "eletromagnética" | "fraca" | "Yukawa" | "estável" | "confinado";

export interface Particle {
  id: string;
  sym: string;
  name: string;
  kind: Kind;
  /** Massa (MeV/c²). Neutrinos: 0 (limite superior < 0,8 eV). */
  m: number;
  q: number;
  spin: number;
  /** Vida média (s); Infinity = estável ou confinado. */
  tau: number;
  via: Via;
  B: number;
  Le: number;
  Lm: number;
  Lt: number;
  S: number;
  /** Conteúdo de quarks (marcação de símbolos), vazio para elementares. */
  quarks: string;
  decay: string;
  /** Observação curta mostrada no cartão. */
  note?: string;
}

const P = (
  id: string,
  sym: string,
  name: string,
  kind: Kind,
  m: number,
  q: number,
  spin: number,
  tau: number,
  via: Via,
  nums: Partial<Pick<Particle, "B" | "Le" | "Lm" | "Lt" | "S">> = {},
  quarks = "",
  decay = "",
  note?: string,
): Particle => ({ id, sym, name, kind, m, q, spin, tau, via, B: 0, Le: 0, Lm: 0, Lt: 0, S: 0, ...nums, quarks, decay, note });

const INF = Number.POSITIVE_INFINITY;
/** ħ em MeV·s, para converter largura Γ em vida média τ = ħ/Γ. */
export const HBAR_MEV_S = 6.582119569e-22;
export const C_LIGHT = 2.99792458e8;
const fromWidth = (gammaMeV: number) => HBAR_MEV_S / gammaMeV;

export const PARTICLES: Particle[] = [
  // léptons
  P("e-", "e^-", "elétron", "lepton", 0.51099895, -1, 0.5, INF, "estável", { Le: 1 }, "", "estável (> 6,6 × 10²⁸ anos)"),
  P("nue", "ν_e", "neutrino do elétron", "lepton", 0, 0, 0.5, INF, "estável", { Le: 1 }, "", "estável", "massa < 0,8 eV/c²; os sabores oscilam"),
  P("mu-", "μ^-", "múon", "lepton", 105.6583755, -1, 0.5, 2.1969811e-6, "fraca", { Lm: 1 }, "", "e⁻ + ν̄ₑ + ν_μ (≈ 100%)"),
  P("numu", "ν_μ", "neutrino do múon", "lepton", 0, 0, 0.5, INF, "estável", { Lm: 1 }, "", "estável", "massa < 0,19 MeV/c² (medida direta)"),
  P("tau-", "τ^-", "tau", "lepton", 1776.86, -1, 0.5, 2.903e-13, "fraca", { Lt: 1 }, "", "hádrons + ν_τ (65%), μ⁻ν̄ν (17%), e⁻ν̄ν (18%)"),
  P("nutau", "ν_τ", "neutrino do tau", "lepton", 0, 0, 0.5, INF, "estável", { Lt: 1 }, "", "estável", "massa < 18 MeV/c² (medida direta)"),
  // quarks (massas de corrente, esquema MS-barra)
  P("u", "u", "quark up", "quark", 2.16, 2 / 3, 0.5, INF, "confinado", { B: 1 / 3 }, "", "confinado em hádrons"),
  P("d", "d", "quark down", "quark", 4.7, -1 / 3, 0.5, INF, "confinado", { B: 1 / 3 }, "", "confinado em hádrons"),
  P("s", "s", "quark strange", "quark", 93.5, -1 / 3, 0.5, INF, "confinado", { B: 1 / 3, S: -1 }, "", "confinado; decai por interação fraca dentro do hádron"),
  P("c", "c", "quark charm", "quark", 1273, 2 / 3, 0.5, INF, "confinado", { B: 1 / 3 }, "", "confinado (charme C = +1)"),
  P("b", "b", "quark bottom", "quark", 4183, -1 / 3, 0.5, INF, "confinado", { B: 1 / 3 }, "", "confinado (beleza B̃ = −1)"),
  P("t", "t", "quark top", "quark", 172570, 2 / 3, 0.5, fromWidth(1420), "fraca", { B: 1 / 3 }, "", "W⁺ + b (≈ 100%)", "decai antes de formar hádrons"),
  // bósons mediadores e o Higgs
  P("gamma", "γ", "fóton", "boson", 0, 0, 1, INF, "estável", {}, "", "estável", "mediador eletromagnético; massa < 10⁻¹⁸ eV"),
  P("g", "g", "glúon", "boson", 0, 0, 1, INF, "confinado", {}, "", "confinado (tem carga de cor)", "mediador da interação forte; 8 tipos"),
  P("W+", "W^+", "bóson W", "boson", 80369.2, 1, 1, fromWidth(2085), "fraca", {}, "", "ℓ⁺ν (32%), quarks (68%)", "mediador da fraca (corrente carregada)"),
  P("Z0", "Z^0", "bóson Z", "boson", 91188, 0, 1, fromWidth(2495.5), "fraca", {}, "", "qq̄ (70%), νν̄ (20%), ℓ⁺ℓ⁻ (10%)", "mediador da fraca (corrente neutra)"),
  P("H0", "H^0", "bóson de Higgs", "boson", 125200, 0, 0, fromWidth(4.1), "Yukawa", {}, "", "bb̄ (58%), WW* (21%), γγ (0,2%)", "dá massa às partículas; descoberto em 2012"),
  // mésons
  P("pi+", "π^+", "píon positivo", "meson", 139.57039, 1, 0, 2.6033e-8, "fraca", {}, "u~d", "μ⁺ + ν_μ (99,99%)"),
  P("pi0", "π^0", "píon neutro", "meson", 134.9768, 0, 0, 8.43e-17, "eletromagnética", {}, "(u~u − d~d)/√2", "γ + γ (98,8%)"),
  P("K+", "K^+", "káon positivo", "meson", 493.677, 1, 0, 1.238e-8, "fraca", { S: 1 }, "u~s", "μ⁺ν_μ (63,6%), π⁺π⁰ (20,7%)"),
  P("K0", "K^0", "káon neutro", "meson", 497.611, 0, 0, 8.954e-11, "fraca", { S: 1 }, "d~s", "π⁺π⁻, 2π⁰ (K⁰_S)", "τ do K⁰_S; o K⁰_L vive 5,1 × 10⁻⁸ s"),
  P("eta", "η", "méson eta", "meson", 547.862, 0, 0, fromWidth(1.31e-3), "eletromagnética", {}, "mistura uū, dd̄, ss̄", "γγ (39%), 3π⁰ (33%)"),
  P("etap", "η′", "méson eta-linha", "meson", 957.78, 0, 0, fromWidth(0.188), "forte", {}, "mistura uū, dd̄, ss̄", "π⁺π⁻η (42%), ρ⁰γ (29%)"),
  P("D+", "D^+", "méson D", "meson", 1869.66, 1, 0, 1.033e-12, "fraca", {}, "c~d", "K + outros (fraca, c → s)"),
  P("Jpsi", "J/ψ", "méson J/psi", "meson", 3096.9, 0, 1, fromWidth(0.0926), "forte", {}, "c~c", "hádrons (88%), e⁺e⁻ (6%), μ⁺μ⁻ (6%)", "descoberta em 1974: prova do quark c"),
  P("B+", "B^+", "méson B", "meson", 5279.41, 1, 0, 1.638e-12, "fraca", {}, "u~b", "D̄ + outros (fraca, b → c)"),
  // bárions
  P("p", "p", "próton", "baryon", 938.27208816, 1, 0.5, INF, "estável", { B: 1 }, "uud", "estável (> 10³⁴ anos)"),
  P("n", "n", "nêutron", "baryon", 939.56542052, 0, 0.5, 878.4, "fraca", { B: 1 }, "udd", "p + e⁻ + ν̄ₑ (100%)", "livre; ligado em núcleos pode ser estável"),
  P("Lambda", "Λ^0", "lambda", "baryon", 1115.683, 0, 0.5, 2.632e-10, "fraca", { B: 1, S: -1 }, "uds", "p π⁻ (64%), n π⁰ (36%)"),
  P("Sigma+", "Σ^+", "sigma positivo", "baryon", 1189.37, 1, 0.5, 8.018e-11, "fraca", { B: 1, S: -1 }, "uus", "p π⁰ (52%), n π⁺ (48%)"),
  P("Sigma0", "Σ^0", "sigma neutro", "baryon", 1192.642, 0, 0.5, 7.4e-20, "eletromagnética", { B: 1, S: -1 }, "uds", "Λ γ (100%)"),
  P("Sigma-", "Σ^-", "sigma negativo", "baryon", 1197.449, -1, 0.5, 1.479e-10, "fraca", { B: 1, S: -1 }, "dds", "n π⁻ (99,8%)"),
  P("Xi0", "Ξ^0", "csi neutro", "baryon", 1314.86, 0, 0.5, 2.9e-10, "fraca", { B: 1, S: -2 }, "uss", "Λ π⁰ (99,5%)"),
  P("Xi-", "Ξ^-", "csi negativo", "baryon", 1321.71, -1, 0.5, 1.639e-10, "fraca", { B: 1, S: -2 }, "dss", "Λ π⁻ (99,9%)"),
  P("Omega-", "Ω^-", "ômega", "baryon", 1672.45, -1, 1.5, 8.21e-11, "fraca", { B: 1, S: -3 }, "sss", "Λ K⁻ (68%), Ξ⁰π⁻ (24%)", "previsto pelo caminho óctuplo (1962)"),
  P("Delta++", "Δ^{++}", "delta", "baryon", 1232, 2, 1.5, fromWidth(117), "forte", { B: 1 }, "uuu", "p π⁺ (99,4%)", "ressonância: largura Γ ≈ 117 MeV"),
  P("Lambdac", "Λ_c^+", "lambda c", "baryon", 2286.46, 1, 0.5, 2.026e-13, "fraca", { B: 1 }, "udc", "p K⁻ π⁺ (6%), muitos canais"),
];

/** Partículas que aparecem só nos multipletos e nas reações (não no catálogo). */
const EXTRA: Particle[] = [
  P("Delta+", "Δ^+", "delta", "baryon", 1232, 1, 1.5, fromWidth(117), "forte", { B: 1 }, "uud", "p π⁰, n π⁺"),
  P("Delta0", "Δ^0", "delta", "baryon", 1232, 0, 1.5, fromWidth(117), "forte", { B: 1 }, "udd", "n π⁰, p π⁻"),
  P("Delta-", "Δ^-", "delta", "baryon", 1232, -1, 1.5, fromWidth(117), "forte", { B: 1 }, "ddd", "n π⁻"),
  P("Sigmas+", "Σ^{*+}", "sigma estrela", "baryon", 1382.8, 1, 1.5, fromWidth(36), "forte", { B: 1, S: -1 }, "uus", "Λ π⁺ (87%)"),
  P("Sigmas0", "Σ^{*0}", "sigma estrela", "baryon", 1383.7, 0, 1.5, fromWidth(36), "forte", { B: 1, S: -1 }, "uds", "Λ π⁰ (87%)"),
  P("Sigmas-", "Σ^{*-}", "sigma estrela", "baryon", 1387.2, -1, 1.5, fromWidth(39), "forte", { B: 1, S: -1 }, "dds", "Λ π⁻ (87%)"),
  P("Xis0", "Ξ^{*0}", "csi estrela", "baryon", 1531.8, 0, 1.5, fromWidth(9.1), "forte", { B: 1, S: -2 }, "uss", "Ξ π"),
  P("Xis-", "Ξ^{*-}", "csi estrela", "baryon", 1535, -1, 1.5, fromWidth(9.9), "forte", { B: 1, S: -2 }, "dss", "Ξ π"),
  P("Kbar0", "~K^0", "antikáon neutro", "meson", 497.611, 0, 0, 8.954e-11, "fraca", { S: -1 }, "s~d", "π⁺π⁻, 2π⁰"),
];

const BY_ID = new Map<string, Particle>([...PARTICLES, ...EXTRA].map((p) => [p.id, p]));

/** Antipartícula: números quânticos com sinal trocado e barra (ou sinal de carga) no símbolo. */
export function anti(p: Particle): Particle {
  const self = p.id === "gamma" || p.id === "Z0" || p.id === "pi0" || p.id === "H0" || p.id === "g" || p.id === "eta" || p.id === "etap" || p.id === "Jpsi";
  if (self) return p;
  const flip = (x: string) => x.replace(/\^(\{[^}]*\}|[+-])/, (m) => m.replace(/[+-]/g, (c) => (c === "+" ? "-" : "+")));
  const bar = (x: string) => (x.startsWith("~") ? x.slice(1) : `~${x}`);
  const charged = /\^(\{[^}]*[+-]\}|[+-])/.test(p.sym);
  const sym = p.kind === "baryon" ? (charged ? bar(flip(p.sym)) : bar(p.sym)) : charged ? flip(p.sym) : bar(p.sym);
  const names: Record<string, string> = {
    "e-": "pósitron", "mu-": "antimúon", "tau-": "antitau", "pi+": "píon negativo", "K+": "káon negativo", "W+": "bóson W", "Kbar0": "káon neutro", "K0": "antikáon neutro",
    p: "antipróton", n: "antinêutron", Lambda: "antilambda", nue: "antineutrino do elétron", numu: "antineutrino do múon", nutau: "antineutrino do tau",
  };
  return {
    ...p,
    id: `anti-${p.id}`,
    sym,
    name: names[p.id] ?? `antipartícula do ${p.name}`,
    q: -p.q,
    B: -p.B,
    Le: -p.Le,
    Lm: -p.Lm,
    Lt: -p.Lt,
    S: -p.S,
    quarks: p.quarks ? conjQuarks(p.quarks) : "",
  };
}

/** Troca quark ↔ antiquark numa marcação de conteúdo simples ("u~d" → "d~u"). */
function conjQuarks(qs: string): string {
  if (!/^[~udscbt]+$/.test(qs)) return qs;
  const toks = qs.match(/~?[udscbt]/g) ?? [];
  return toks.map((t) => (t.startsWith("~") ? t.slice(1) : `~${t}`)).join("");
}

/** Busca por id; "anti-<id>" devolve a antipartícula. */
export function particle(id: string): Particle {
  if (id.startsWith("anti-")) return anti(particle(id.slice(5)));
  const p = BY_ID.get(id);
  if (!p) throw new Error(`partícula desconhecida: ${id}`);
  return p;
}

/** Peças disponíveis para montar reações (ordem da paleta). */
export const PALETTE_IDS = [
  "e-", "anti-e-", "mu-", "anti-mu-", "nue", "anti-nue", "numu", "anti-numu", "gamma",
  "pi+", "anti-pi+", "pi0", "K+", "anti-K+", "K0", "eta",
  "p", "anti-p", "n", "anti-n", "Lambda", "anti-Lambda", "Sigma+", "Sigma0", "Sigma-", "Xi0", "Xi-", "Omega-", "Delta++",
];

export interface Reaction {
  label: string;
  left: string[];
  right: string[];
  /** Energia cinética sugerida do projétil (MeV), para colisões. */
  K?: number;
}

/** Reações prontas (algumas permitidas, outras proibidas). O parâmetro `reacao` e o livro usam o índice: acrescente só no fim. */
export const REACTIONS: Reaction[] = [
  { label: "n → p + e⁻ + ν̄ₑ (decaimento β)", left: ["n"], right: ["p", "e-", "anti-nue"] },
  { label: "π⁺ → μ⁺ + ν_μ", left: ["pi+"], right: ["anti-mu-", "numu"] },
  { label: "μ⁻ → e⁻ + ν̄ₑ + ν_μ", left: ["mu-"], right: ["e-", "anti-nue", "numu"] },
  { label: "π⁰ → γ + γ", left: ["pi0"], right: ["gamma", "gamma"] },
  { label: "Λ⁰ → p + π⁻", left: ["Lambda"], right: ["p", "anti-pi+"] },
  { label: "Δ⁺⁺ → p + π⁺", left: ["Delta++"], right: ["p", "pi+"] },
  { label: "Σ⁰ → Λ⁰ + γ", left: ["Sigma0"], right: ["Lambda", "gamma"] },
  { label: "Ω⁻ → Λ⁰ + K⁻", left: ["Omega-"], right: ["Lambda", "anti-K+"] },
  { label: "K⁺ → π⁺ + π⁰", left: ["K+"], right: ["pi+", "pi0"] },
  { label: "p → e⁺ + π⁰ ?", left: ["p"], right: ["anti-e-", "pi0"] },
  { label: "μ⁻ → e⁻ + γ ?", left: ["mu-"], right: ["e-", "gamma"] },
  { label: "n → p + e⁻ ?", left: ["n"], right: ["p", "e-"] },
  { label: "p → n + e⁺ + νₑ ?", left: ["p"], right: ["n", "anti-e-", "nue"] },
  { label: "p + p → p + p + π⁰", left: ["p", "p"], right: ["p", "p", "pi0"], K: 400 },
  { label: "π⁻ + p → K⁰ + Λ⁰ (produção associada)", left: ["anti-pi+", "p"], right: ["K0", "Lambda"], K: 1000 },
  { label: "π⁻ + p → K⁻ + Σ⁺ ?", left: ["anti-pi+", "p"], right: ["anti-K+", "Sigma+"], K: 1500 },
  { label: "p + p̄ → π⁺ + π⁻ + π⁰", left: ["anti-p", "p"], right: ["pi+", "anti-pi+", "pi0"], K: 0 },
  { label: "ν̄ₑ + p → n + e⁺ (Cowan–Reines)", left: ["anti-nue", "p"], right: ["n", "anti-e-"], K: 5 },
  { label: "e⁺ + e⁻ → μ⁺ + μ⁻", left: ["anti-e-", "e-"], right: ["anti-mu-", "mu-"], K: 50000 },
];
