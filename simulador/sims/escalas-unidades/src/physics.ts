/**
 * Física e dados da sim de medição: escalas (potências de dez), conversão de
 * unidades em cadeia com cancelamento explícito e as definições do SI.
 */

// ------------------------------------------------------------------ constantes que definem o SI (valores exatos desde 2019)

/** Velocidade da luz no vácuo (m/s), exata. */
export const C = 299_792_458;
/** Frequência da transição hiperfina do césio-133 (Hz), exata. */
export const DNU_CS = 9_192_631_770;
/** Constante de Planck (J·s), exata. */
export const H = 6.626_070_15e-34;
/** Carga elementar (C), exata. */
export const E_CHARGE = 1.602_176_634e-19;
/** Constante de Josephson K_J = 2e/h (Hz/V). */
export const K_J = (2 * E_CHARGE) / H;
/** Constante de von Klitzing R_K = h/e² (Ω). */
export const R_K = H / (E_CHARGE * E_CHARGE);
/** Comprimento de onda no vácuo do laser de He-Ne estabilizado em iodo (m). */
export const LAMBDA_HENE = 632.991_21e-9;
/** Massa específica da água (kg/m³), usada na "massa de um cubo de água". */
export const RHO_AGUA = 1000;

/** Limites do zoom (expoente de 10 da largura do quadro, em metros). */
export const E_MIN = -15;
export const E_MAX = 26;

// ------------------------------------------------------------------ objetos e tempos de referência

export interface Ref {
  nome: string;
  /** Tamanho característico (m) ou tempo (s) ou massa (kg). */
  v: number;
  /** Massa (kg), só para objetos de comprimento. */
  m?: number;
}

/** Objetos de referência: tamanho característico e massa (ordens de grandeza; valores aproximados). */
export const OBJETOS: Required<Ref>[] = [
  { nome: "Próton", v: 1.7e-15, m: 1.67e-27 },
  { nome: "Núcleo de ouro", v: 1.4e-14, m: 3.27e-25 },
  { nome: "Átomo de hidrogênio", v: 1.06e-10, m: 1.67e-27 },
  { nome: "Molécula de hemoglobina", v: 5.5e-9, m: 1.07e-22 },
  { nome: "Vírus (SARS-CoV-2)", v: 1.0e-7, m: 1e-18 },
  { nome: "Bactéria E. coli", v: 2e-6, m: 1e-15 },
  { nome: "Glóbulo vermelho", v: 7.5e-6, m: 1e-13 },
  { nome: "Grão de areia", v: 5e-4, m: 1.7e-7 },
  { nome: "Formiga", v: 5e-3, m: 3e-6 },
  { nome: "Moeda de R$ 1", v: 2.7e-2, m: 7e-3 },
  { nome: "Pessoa", v: 1.7, m: 70 },
  { nome: "Cristo Redentor", v: 38, m: 6.35e5 },
  { nome: "Torre Eiffel", v: 330, m: 1.01e7 },
  { nome: "Lua (diâmetro)", v: 3.47e6, m: 7.35e22 },
  { nome: "Terra (diâmetro)", v: 1.274e7, m: 5.97e24 },
  { nome: "Júpiter (diâmetro)", v: 1.43e8, m: 1.9e27 },
  { nome: "Sol (diâmetro)", v: 1.39e9, m: 1.99e30 },
  { nome: "Órbita da Terra (diâmetro)", v: 2.99e11, m: 1.99e30 },
  { nome: "Órbita de Netuno (diâmetro)", v: 9.0e12, m: 1.99e30 },
  { nome: "Distância até Proxima Centauri", v: 4.0e16, m: 2.4e29 },
  { nome: "Via Láctea (disco)", v: 9.5e20, m: 2e42 },
  { nome: "Distância até Andrômeda", v: 2.4e22, m: 2.5e42 },
  { nome: "Aglomerado de Virgem", v: 6.8e22, m: 2.4e45 },
  { nome: "Superaglomerado Laniakea", v: 4.9e24, m: 2e47 },
  { nome: "Universo observável (diâmetro)", v: 8.8e26, m: 1.5e53 },
];

/** Tempos de referência (s). */
export const TEMPOS: Ref[] = [
  { nome: "luz atravessa um próton", v: 1.7e-15 / C },
  { nome: "período da luz visível", v: 1.7e-15 },
  { nome: "período do césio-133", v: 1 / DNU_CS },
  { nome: "batida do coração", v: 0.8 },
  { nome: "um dia", v: 86_400 },
  { nome: "um ano", v: 3.156e7 },
  { nome: "vida humana", v: 2.5e9 },
  { nome: "desde as pirâmides", v: 1.4e11 },
  { nome: "desde os dinossauros", v: 2.1e15 },
  { nome: "idade do Universo", v: 4.35e17 },
];

/** Massas de referência (kg). */
export const MASSAS: Ref[] = [
  { nome: "elétron", v: 9.11e-31 },
  { nome: "próton", v: 1.67e-27 },
  { nome: "vírus", v: 1e-18 },
  { nome: "grão de areia", v: 1.7e-7 },
  { nome: "pessoa", v: 70 },
  { nome: "Terra", v: 5.97e24 },
  { nome: "Sol", v: 1.99e30 },
  { nome: "Via Láctea", v: 2e42 },
  { nome: "Universo observável", v: 1.5e53 },
];

/** Índice do objeto cujo tamanho está mais perto (em escala logarítmica) da largura 10^e. */
export function objetoMaisProximo(e: number): number {
  let best = 0;
  for (let i = 1; i < OBJETOS.length; i++) {
    if (Math.abs(Math.log10(OBJETOS[i]!.v) - e) < Math.abs(Math.log10(OBJETOS[best]!.v) - e)) best = i;
  }
  return best;
}

/** Ordem de grandeza: a potência de dez mais próxima (critério do expoente de √10 ≈ 3,16). */
export function ordemDeGrandeza(x: number): number {
  return Math.floor(Math.log10(Math.abs(x)) + 0.5);
}

/** Tempo para a luz cruzar a largura L (s). */
export const tempoLuz = (L: number) => L / C;
/** Massa de água num cubo de aresta L (kg). */
export const massaCubo = (L: number) => RHO_AGUA * L * L * L;

// ------------------------------------------------------------------ conversão em cadeia

/** Unidade elevada a uma potência (km³ é { u: "km", p: 3 }). */
export interface Atom {
  u: string;
  p: number;
}

/** Fator de conversão: (valor_num unidades_num) / (valor_den unidades_den), elevado a `pow`. Vale 1 por construção. */
export interface Fator {
  nv: number;
  nu: Atom[];
  dv: number;
  du: Atom[];
  pow?: number;
}

export interface Cadeia {
  nome: string;
  /** Unidades de partida (numerador e denominador). */
  nu: Atom[];
  du: Atom[];
  fatores: Fator[];
  /** Unidade de chegada esperada, como mapa unidade → expoente. */
  alvo: Record<string, number>;
  /** Fator de referência (unidade final por unidade inicial), valor exato tabelado. */
  ref: number;
}

const a = (u: string, p = 1): Atom => ({ u, p });

export const CADEIAS: Cadeia[] = [
  {
    nome: "Velocidade: km/h → m/s",
    nu: [a("km")],
    du: [a("h")],
    fatores: [
      { nv: 1000, nu: [a("m")], dv: 1, du: [a("km")] },
      { nv: 1, nu: [a("h")], dv: 60, du: [a("min")] },
      { nv: 1, nu: [a("min")], dv: 60, du: [a("s")] },
    ],
    alvo: { m: 1, s: -1 },
    ref: 1 / 3.6,
  },
  {
    nome: "Massa específica: g/cm³ → kg/m³",
    nu: [a("g")],
    du: [a("cm", 3)],
    fatores: [
      { nv: 1, nu: [a("kg")], dv: 1000, du: [a("g")] },
      { nv: 100, nu: [a("cm")], dv: 1, du: [a("m")], pow: 3 },
    ],
    alvo: { kg: 1, m: -3 },
    ref: 1000,
  },
  {
    nome: "Pressão: psi → Pa",
    nu: [a("psi")],
    du: [],
    fatores: [
      { nv: 1, nu: [a("lbf")], dv: 1, du: [a("psi"), a("in", 2)] },
      { nv: 4.448_221_615_260_5, nu: [a("N")], dv: 1, du: [a("lbf")] },
      { nv: 1, nu: [a("in")], dv: 0.0254, du: [a("m")], pow: 2 },
      { nv: 1, nu: [a("Pa"), a("m", 2)], dv: 1, du: [a("N")] },
    ],
    alvo: { Pa: 1 },
    ref: 4.448_221_615_260_5 / 0.0254 ** 2,
  },
  {
    nome: "Energia: kWh → J",
    nu: [a("kW"), a("h")],
    du: [],
    fatores: [
      { nv: 1000, nu: [a("W")], dv: 1, du: [a("kW")] },
      { nv: 3600, nu: [a("s")], dv: 1, du: [a("h")] },
      { nv: 1, nu: [a("J")], dv: 1, du: [a("W"), a("s")] },
    ],
    alvo: { J: 1 },
    ref: 3.6e6,
  },
  {
    nome: "Distância: ano-luz → m",
    nu: [a("al")],
    du: [],
    fatores: [
      { nv: 1, nu: [a("c"), a("ano")], dv: 1, du: [a("al")] },
      { nv: 365.25, nu: [a("d")], dv: 1, du: [a("ano")] },
      { nv: 86_400, nu: [a("s")], dv: 1, du: [a("d")] },
      { nv: C, nu: [a("m")], dv: 1, du: [a("c"), a("s")] },
    ],
    alvo: { m: 1 },
    ref: 365.25 * 86_400 * C,
  },
  {
    nome: "Volume: L → m³",
    nu: [a("L")],
    du: [],
    fatores: [
      { nv: 1, nu: [a("dm", 3)], dv: 1, du: [a("L")] },
      { nv: 1, nu: [a("m")], dv: 10, du: [a("dm")], pow: 3 },
    ],
    alvo: { m: 3 },
    ref: 1e-3,
  },
  {
    nome: "Rotação: rpm → rad/s",
    nu: [a("rev")],
    du: [a("min")],
    fatores: [
      { nv: 2 * Math.PI, nu: [a("rad")], dv: 1, du: [a("rev")] },
      { nv: 1, nu: [a("min")], dv: 60, du: [a("s")] },
    ],
    alvo: { rad: 1, s: -1 },
    ref: (2 * Math.PI) / 60,
  },
];

/** Fator aplicado de fato (com a opção de erro: o primeiro fator invertido). */
export function fatorEfetivo(f: Fator, invertido: boolean): Fator {
  return invertido ? { nv: f.dv, nu: f.du, dv: f.nv, du: f.nu, pow: f.pow } : f;
}

/** Valor numérico de um fator (1 quando montado corretamente). */
export const valorFator = (f: Fator) => (f.nv / f.dv) ** (f.pow ?? 1);

export function fatoresDa(c: Cadeia, erro: boolean): Fator[] {
  return c.fatores.map((f, i) => fatorEfetivo(f, erro && i === 0));
}

/** Mapa de unidades (unidade → expoente) depois de aplicar os `n` primeiros fatores. */
export function unidadesApos(c: Cadeia, n: number, erro = false): Record<string, number> {
  const m: Record<string, number> = {};
  const add = (at: Atom[], s: number) => {
    for (const x of at) m[x.u] = (m[x.u] ?? 0) + s * x.p;
  };
  add(c.nu, 1);
  add(c.du, -1);
  fatoresDa(c, erro)
    .slice(0, n)
    .forEach((f) => {
      const pw = f.pow ?? 1;
      add(f.nu.map((x) => ({ u: x.u, p: x.p * pw })), 1);
      add(f.du.map((x) => ({ u: x.u, p: x.p * pw })), -1);
    });
  for (const k of Object.keys(m)) if (Math.abs(m[k]!) < 1e-12) delete m[k];
  return m;
}

/** Valor numérico depois de aplicar os `n` primeiros fatores. */
export function valorApos(c: Cadeia, valor: number, n: number, erro = false): number {
  return fatoresDa(c, erro)
    .slice(0, n)
    .reduce((v, f) => v * valorFator(f), valor);
}

/** As unidades finais conferem com a unidade pedida? */
export function unidadesConferem(c: Cadeia, erro = false): boolean {
  const u = unidadesApos(c, c.fatores.length, erro);
  const keys = new Set([...Object.keys(u), ...Object.keys(c.alvo)]);
  for (const k of keys) if ((u[k] ?? 0) !== (c.alvo[k] ?? 0)) return false;
  return true;
}

/** Texto de um mapa de unidades: "kg·m⁻³" vira "kg/m³". */
export function textoUnidades(m: Record<string, number>): string {
  const sup = (n: number) => (n === 1 ? "" : String(n).replace(/-/g, "⁻").replace(/\d/g, (d) => "⁰¹²³⁴⁵⁶⁷⁸⁹"[Number(d)]!));
  const num = Object.entries(m).filter(([, p]) => p > 0).map(([u, p]) => u + sup(p));
  const den = Object.entries(m).filter(([, p]) => p < 0).map(([u, p]) => u + sup(-p));
  const n = num.length ? num.join("·") : "1";
  if (!den.length) return n;
  return `${n}/${den.length > 1 ? `(${den.join("·")})` : den[0]}`;
}

/** Texto de uma lista de átomos ("W·s", "in²"). */
export function textoAtomos(at: Atom[]): string {
  return at.length ? textoUnidades(Object.fromEntries(at.map((x) => [x.u, x.p]))) : "";
}

// ------------------------------------------------------------------ padrões do SI

/** Tempo para a luz percorrer L metros (s): a definição do metro lida ao contrário. */
export const tempoMetro = (L: number) => L / C;
/** Número de comprimentos de onda do laser de He-Ne em L metros. */
export const ondasHeNe = (L: number) => L / LAMBDA_HENE;
/** Ciclos do césio em τ segundos. */
export const ciclosCesio = (tau: number) => DNU_CS * tau;
/** Atraso acumulado (s) de um relógio com erro relativo `ppm` (partes por milhão) depois de `dias`. */
export const atrasoQuartzo = (ppm: number, dias: number) => ppm * 1e-6 * dias * 86_400;

/**
 * Balança de Kibble. Modo pesagem: B L I = m g. Modo velocidade: U = B L v.
 * Eliminando B L: m = U I / (g v). Devolve U (V), I (A) e a massa reconstruída.
 */
export function kibble(m: number, g: number, BL: number, v: number) {
  const U = BL * v;
  const I = (m * g) / BL;
  return { U, I, P: U * I, m: (U * I) / (g * v) };
}

/** Frequência de Compton equivalente a uma massa: f = m c²/h (Hz). */
export const freqMassa = (m: number) => (m * C * C) / H;
