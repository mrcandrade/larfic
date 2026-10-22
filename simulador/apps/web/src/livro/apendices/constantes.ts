/**
 * Apêndice B: constantes fundamentais da física.
 *
 * Desde a revisão do SI de 2019, sete constantes têm valor exato por definição (h, e, k, N_A, c,
 * Δν_Cs e K_cd); outras, como R, F e σ, são exatas por serem combinações delas. As demais são
 * medidas: valores recomendados do CODATA 2018, com a incerteza padrão nos últimos algarismos
 * entre parênteses.
 */
export interface Constante {
  id: string;
  nome: string;
  /** Símbolo em LaTeX. */
  simbolo: string;
  valor: number;
  /** Unidade em LaTeX (vazio para adimensional). */
  unidade: string;
  /** "definida": fixa o SI; "exata": derivada só das definidas; "medida": CODATA 2018. */
  tipo: "definida" | "exata" | "medida";
  /** Incerteza padrão nos últimos algarismos, como no CODATA: "(15)". */
  incerteza?: string;
  /** Mantissa como escrita na tabela (com todos os algarismos significativos), quando difere de `valor`. */
  texto?: string;
}

export const constantes: Constante[] = [
  // Definidoras do SI (exatas)
  { id: "c", nome: "Velocidade da luz no vácuo", simbolo: "c", valor: 299792458, unidade: "m/s", tipo: "definida" },
  { id: "h", nome: "Constante de Planck", simbolo: "h", valor: 6.62607015e-34, unidade: "J\\cdot s", tipo: "definida" },
  { id: "e", nome: "Carga elementar", simbolo: "e", valor: 1.602176634e-19, unidade: "C", tipo: "definida" },
  { id: "k", nome: "Constante de Boltzmann", simbolo: "k", valor: 1.380649e-23, unidade: "J/K", tipo: "definida" },
  { id: "NA", nome: "Constante de Avogadro", simbolo: "N_A", valor: 6.02214076e23, unidade: "mol^{-1}", tipo: "definida" },
  { id: "dnuCs", nome: "Frequência da transição hiperfina do césio 133", simbolo: "\\Delta\\nu_{\\text{Cs}}", valor: 9192631770, unidade: "Hz", tipo: "definida" },
  { id: "Kcd", nome: "Eficácia luminosa da radiação de 540 THz", simbolo: "K_{\\text{cd}}", valor: 683, unidade: "lm/W", tipo: "definida" },
  // Exatas por combinação
  { id: "hbar", nome: "Constante de Planck reduzida", simbolo: "\\hbar = h/2\\pi", valor: 6.62607015e-34 / (2 * Math.PI), unidade: "J\\cdot s", tipo: "exata", texto: "1,054571817…" },
  { id: "R", nome: "Constante dos gases", simbolo: "R = N_A k", valor: 6.02214076e23 * 1.380649e-23, unidade: "J/(mol\\cdot K)", tipo: "exata", texto: "8,314462618…" },
  { id: "F", nome: "Constante de Faraday", simbolo: "F = N_A e", valor: 6.02214076e23 * 1.602176634e-19, unidade: "C/mol", tipo: "exata", texto: "9,648533212…" },
  { id: "sigma", nome: "Constante de Stefan-Boltzmann", simbolo: "\\sigma", valor: 5.670374419e-8, unidade: "W/(m^2\\cdot K^4)", tipo: "exata", texto: "5,670374419…" },
  { id: "b", nome: "Constante de Wien", simbolo: "b", valor: 2.897771955e-3, unidade: "m\\cdot K", tipo: "exata", texto: "2,897771955…" },
  { id: "eV", nome: "Elétron-volt", simbolo: "\\text{eV}", valor: 1.602176634e-19, unidade: "J", tipo: "exata" },
  { id: "Vm", nome: "Volume molar de um gás ideal (0 °C, 1 atm)", simbolo: "V_m", valor: (6.02214076e23 * 1.380649e-23 * 273.15) / 101325, unidade: "m^3/mol", tipo: "exata", texto: "2,241396954…" },
  // Medidas (CODATA 2018)
  { id: "G", nome: "Constante gravitacional", simbolo: "G", valor: 6.6743e-11, unidade: "N\\cdot m^2/kg^2", tipo: "medida", incerteza: "(15)", texto: "6,67430" },
  { id: "mu0", nome: "Permeabilidade magnética do vácuo", simbolo: "\\mu_0", valor: 1.25663706212e-6, unidade: "H/m", tipo: "medida", incerteza: "(19)" },
  { id: "eps0", nome: "Permissividade elétrica do vácuo", simbolo: "\\varepsilon_0", valor: 8.8541878128e-12, unidade: "F/m", tipo: "medida", incerteza: "(13)" },
  { id: "ke", nome: "Constante de Coulomb", simbolo: "1/4\\pi\\varepsilon_0", valor: 8.9875517923e9, unidade: "N\\cdot m^2/C^2", tipo: "medida", incerteza: "(14)" },
  { id: "me", nome: "Massa do elétron", simbolo: "m_e", valor: 9.1093837015e-31, unidade: "kg", tipo: "medida", incerteza: "(28)" },
  { id: "mp", nome: "Massa do próton", simbolo: "m_p", valor: 1.67262192369e-27, unidade: "kg", tipo: "medida", incerteza: "(51)" },
  { id: "mn", nome: "Massa do nêutron", simbolo: "m_n", valor: 1.67492749804e-27, unidade: "kg", tipo: "medida", incerteza: "(95)" },
  { id: "md", nome: "Massa do dêuteron", simbolo: "m_d", valor: 3.3435837724e-27, unidade: "kg", tipo: "medida", incerteza: "(10)" },
  { id: "u", nome: "Unidade de massa atômica", simbolo: "u", valor: 1.6605390666e-27, unidade: "kg", tipo: "medida", incerteza: "(50)", texto: "1,66053906660" },
  { id: "mec2", nome: "Energia de repouso do elétron", simbolo: "m_e c^2", valor: 0.51099895, unidade: "MeV", tipo: "medida", incerteza: "(15)", texto: "0,51099895000" },
  { id: "mpc2", nome: "Energia de repouso do próton", simbolo: "m_p c^2", valor: 938.27208816, unidade: "MeV", tipo: "medida", incerteza: "(29)" },
  { id: "mnc2", nome: "Energia de repouso do nêutron", simbolo: "m_n c^2", valor: 939.56542052, unidade: "MeV", tipo: "medida", incerteza: "(54)" },
  { id: "uc2", nome: "Energia de repouso da unidade de massa atômica", simbolo: "u c^2", valor: 931.49410242, unidade: "MeV", tipo: "medida", incerteza: "(28)" },
  { id: "em", nome: "Razão carga-massa do elétron", simbolo: "e/m_e", valor: 1.75882001076e11, unidade: "C/kg", tipo: "medida", incerteza: "(53)" },
  { id: "mpme", nome: "Razão entre as massas do próton e do elétron", simbolo: "m_p/m_e", valor: 1836.15267343, unidade: "", tipo: "medida", incerteza: "(11)" },
  { id: "alpha", nome: "Constante de estrutura fina", simbolo: "\\alpha", valor: 7.2973525693e-3, unidade: "", tipo: "medida", incerteza: "(11)" },
  { id: "Rinf", nome: "Constante de Rydberg", simbolo: "R_\\infty", valor: 10973731.56816, unidade: "m^{-1}", tipo: "medida", incerteza: "(21)", texto: "1,0973731568160" },
  { id: "a0", nome: "Raio de Bohr", simbolo: "a_0", valor: 5.29177210903e-11, unidade: "m", tipo: "medida", incerteza: "(80)" },
  { id: "lambdaC", nome: "Comprimento de onda Compton do elétron", simbolo: "\\lambda_C", valor: 2.42631023867e-12, unidade: "m", tipo: "medida", incerteza: "(73)" },
  { id: "muB", nome: "Magnéton de Bohr", simbolo: "\\mu_B", valor: 9.2740100783e-24, unidade: "J/T", tipo: "medida", incerteza: "(28)" },
  { id: "muN", nome: "Magnéton nuclear", simbolo: "\\mu_N", valor: 5.0507837461e-27, unidade: "J/T", tipo: "medida", incerteza: "(15)" },
];

/** Outros valores úteis (convencionais, não fundamentais). */
export const valoresUteis: Constante[] = [
  { id: "gn", nome: "Aceleração da gravidade padrão", simbolo: "g_n", valor: 9.80665, unidade: "m/s^2", tipo: "exata" },
  { id: "atm", nome: "Atmosfera padrão", simbolo: "\\text{atm}", valor: 101325, unidade: "Pa", tipo: "exata" },
  { id: "T0", nome: "Zero da escala Celsius", simbolo: "0\\,^\\circ\\text{C}", valor: 273.15, unidade: "K", tipo: "exata" },
  { id: "ua", nome: "Unidade astronômica", simbolo: "\\text{ua}", valor: 1.495978707e11, unidade: "m", tipo: "exata" },
];

export const findConstante = (id: string) => [...constantes, ...valoresUteis].find((c) => c.id === id);

/**
 * Mantissa e expoente em notação científica, com vírgula decimal: 6,62607015 e -34.
 * Usa `texto` quando dado (para manter zeros finais e o "…" das exatas com dízima).
 */
export function notacao(c: Pick<Constante, "valor" | "texto">): { mantissa: string; expoente: number } {
  if (c.valor === 0) return { mantissa: "0", expoente: 0 };
  const exp = Math.floor(Math.log10(Math.abs(c.valor)) + 1e-12);
  // Entre 0,1 e 9999 o número vai sem potência de dez.
  const plain = exp >= -1 && exp <= 3;
  if (c.texto) return { mantissa: c.texto, expoente: plain ? 0 : exp };
  const mant = plain ? c.valor : c.valor / 10 ** exp;
  // 12 algarismos significativos bastam para todas as constantes da tabela; tira zeros espúrios.
  const s = mant.toPrecision(12).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
  if (plain) return { mantissa: s.replace(".", ","), expoente: 0 };
  return { mantissa: s.replace(".", ","), expoente: exp };
}
