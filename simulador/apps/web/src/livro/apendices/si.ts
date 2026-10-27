/**
 * Apêndice A: o Sistema Internacional de Unidades (SI), na forma revista em 2019 (unidades de base
 * definidas por constantes exatas) e com os prefixos aprovados em 2022.
 */
export interface UnidadeBase {
  grandeza: string;
  nome: string;
  simbolo: string;
  /** Como a unidade é definida hoje (resumo em linguagem simples). */
  definicao: string;
}

export const unidadesBase: UnidadeBase[] = [
  {
    grandeza: "Tempo",
    nome: "segundo",
    simbolo: "s",
    definicao: "Fixa em exatamente 9 192 631 770 Hz a frequência da transição hiperfina do estado fundamental do átomo de césio 133.",
  },
  {
    grandeza: "Comprimento",
    nome: "metro",
    simbolo: "m",
    definicao: "Fixa a velocidade da luz no vácuo em exatamente 299 792 458 m/s; um metro é a distância que a luz percorre em 1/299 792 458 de segundo.",
  },
  {
    grandeza: "Massa",
    nome: "quilograma",
    simbolo: "kg",
    definicao: "Fixa a constante de Planck em exatamente 6,626 070 15 × 10⁻³⁴ J·s; com o metro e o segundo, isso determina o quilograma (medido, por exemplo, com uma balança de Kibble).",
  },
  {
    grandeza: "Corrente elétrica",
    nome: "ampère",
    simbolo: "A",
    definicao: "Fixa a carga elementar em exatamente 1,602 176 634 × 10⁻¹⁹ C; um ampère é a passagem de 1/(1,602 176 634 × 10⁻¹⁹) cargas elementares por segundo.",
  },
  {
    grandeza: "Temperatura termodinâmica",
    nome: "kelvin",
    simbolo: "K",
    definicao: "Fixa a constante de Boltzmann em exatamente 1,380 649 × 10⁻²³ J/K, ligando a temperatura à energia térmica.",
  },
  {
    grandeza: "Quantidade de substância",
    nome: "mol",
    simbolo: "mol",
    definicao: "Um mol contém exatamente 6,022 140 76 × 10²³ entidades elementares (o número de Avogadro).",
  },
  {
    grandeza: "Intensidade luminosa",
    nome: "candela",
    simbolo: "cd",
    definicao: "Fixa em exatamente 683 lm/W a eficácia luminosa da radiação monocromática de 540 × 10¹² Hz (luz verde, onde o olho é mais sensível).",
  },
];

export interface UnidadeDerivada {
  grandeza: string;
  nome: string;
  simbolo: string;
  /** Em termos de outras unidades do SI (LaTeX). */
  equivalente: string;
}

/** As 22 unidades derivadas com nome especial. */
export const unidadesDerivadas: UnidadeDerivada[] = [
  { grandeza: "Ângulo plano", nome: "radiano", simbolo: "rad", equivalente: "\\text{m/m} = 1" },
  { grandeza: "Ângulo sólido", nome: "esferorradiano", simbolo: "sr", equivalente: "\\text{m}^2/\\text{m}^2 = 1" },
  { grandeza: "Frequência", nome: "hertz", simbolo: "Hz", equivalente: "\\text{s}^{-1}" },
  { grandeza: "Força", nome: "newton", simbolo: "N", equivalente: "\\text{kg}\\cdot\\text{m/s}^2" },
  { grandeza: "Pressão, tensão mecânica", nome: "pascal", simbolo: "Pa", equivalente: "\\text{N/m}^2" },
  { grandeza: "Energia, trabalho, calor", nome: "joule", simbolo: "J", equivalente: "\\text{N}\\cdot\\text{m}" },
  { grandeza: "Potência", nome: "watt", simbolo: "W", equivalente: "\\text{J/s}" },
  { grandeza: "Carga elétrica", nome: "coulomb", simbolo: "C", equivalente: "\\text{A}\\cdot\\text{s}" },
  { grandeza: "Diferença de potencial, força eletromotriz", nome: "volt", simbolo: "V", equivalente: "\\text{W/A} = \\text{J/C}" },
  { grandeza: "Capacitância", nome: "farad", simbolo: "F", equivalente: "\\text{C/V}" },
  { grandeza: "Resistência elétrica", nome: "ohm", simbolo: "Ω", equivalente: "\\text{V/A}" },
  { grandeza: "Condutância elétrica", nome: "siemens", simbolo: "S", equivalente: "\\text{A/V} = \\Omega^{-1}" },
  { grandeza: "Fluxo magnético", nome: "weber", simbolo: "Wb", equivalente: "\\text{V}\\cdot\\text{s}" },
  { grandeza: "Campo magnético", nome: "tesla", simbolo: "T", equivalente: "\\text{Wb/m}^2 = \\text{N/(A}\\cdot\\text{m)}" },
  { grandeza: "Indutância", nome: "henry", simbolo: "H", equivalente: "\\text{Wb/A} = \\text{V}\\cdot\\text{s/A}" },
  { grandeza: "Temperatura Celsius", nome: "grau Celsius", simbolo: "°C", equivalente: "T_C = T - 273{,}15\\ \\text{K}" },
  { grandeza: "Fluxo luminoso", nome: "lúmen", simbolo: "lm", equivalente: "\\text{cd}\\cdot\\text{sr}" },
  { grandeza: "Iluminamento", nome: "lux", simbolo: "lx", equivalente: "\\text{lm/m}^2" },
  { grandeza: "Atividade de uma fonte radioativa", nome: "becquerel", simbolo: "Bq", equivalente: "\\text{s}^{-1}" },
  { grandeza: "Dose absorvida", nome: "gray", simbolo: "Gy", equivalente: "\\text{J/kg}" },
  { grandeza: "Dose equivalente", nome: "sievert", simbolo: "Sv", equivalente: "\\text{J/kg}" },
  { grandeza: "Atividade catalítica", nome: "katal", simbolo: "kat", equivalente: "\\text{mol/s}" },
];

/** Algumas unidades derivadas sem nome especial, frequentes no curso. */
export const outrasDerivadas: UnidadeDerivada[] = [
  { grandeza: "Área", nome: "metro quadrado", simbolo: "m²", equivalente: "\\text{m}^2" },
  { grandeza: "Volume", nome: "metro cúbico", simbolo: "m³", equivalente: "\\text{m}^3" },
  { grandeza: "Velocidade", nome: "metro por segundo", simbolo: "m/s", equivalente: "\\text{m/s}" },
  { grandeza: "Aceleração", nome: "metro por segundo ao quadrado", simbolo: "m/s²", equivalente: "\\text{m/s}^2" },
  { grandeza: "Velocidade angular", nome: "radiano por segundo", simbolo: "rad/s", equivalente: "\\text{rad/s}" },
  { grandeza: "Aceleração angular", nome: "radiano por segundo ao quadrado", simbolo: "rad/s²", equivalente: "\\text{rad/s}^2" },
  { grandeza: "Massa específica", nome: "quilograma por metro cúbico", simbolo: "kg/m³", equivalente: "\\text{kg/m}^3" },
  { grandeza: "Momento de uma força (torque)", nome: "newton-metro", simbolo: "N·m", equivalente: "\\text{kg}\\cdot\\text{m}^2/\\text{s}^2" },
  { grandeza: "Capacidade térmica, entropia", nome: "joule por kelvin", simbolo: "J/K", equivalente: "\\text{J/K}" },
  { grandeza: "Calor específico", nome: "joule por quilograma-kelvin", simbolo: "J/(kg·K)", equivalente: "\\text{J/(kg}\\cdot\\text{K)}" },
  { grandeza: "Condutividade térmica", nome: "watt por metro-kelvin", simbolo: "W/(m·K)", equivalente: "\\text{W/(m}\\cdot\\text{K)}" },
  { grandeza: "Intensidade de onda", nome: "watt por metro quadrado", simbolo: "W/m²", equivalente: "\\text{W/m}^2" },
  { grandeza: "Campo elétrico", nome: "volt por metro", simbolo: "V/m", equivalente: "\\text{V/m} = \\text{N/C}" },
  { grandeza: "Permissividade", nome: "farad por metro", simbolo: "F/m", equivalente: "\\text{F/m}" },
  { grandeza: "Permeabilidade", nome: "henry por metro", simbolo: "H/m", equivalente: "\\text{H/m}" },
];

export interface Prefixo {
  nome: string;
  simbolo: string;
  expoente: number;
}

/** Os 24 prefixos do SI, do maior para o menor (ronna, quetta, ronto e quecto desde 2022). */
export const prefixos: Prefixo[] = [
  { nome: "quetta", simbolo: "Q", expoente: 30 },
  { nome: "ronna", simbolo: "R", expoente: 27 },
  { nome: "iota", simbolo: "Y", expoente: 24 },
  { nome: "zeta", simbolo: "Z", expoente: 21 },
  { nome: "exa", simbolo: "E", expoente: 18 },
  { nome: "peta", simbolo: "P", expoente: 15 },
  { nome: "tera", simbolo: "T", expoente: 12 },
  { nome: "giga", simbolo: "G", expoente: 9 },
  { nome: "mega", simbolo: "M", expoente: 6 },
  { nome: "quilo", simbolo: "k", expoente: 3 },
  { nome: "hecto", simbolo: "h", expoente: 2 },
  { nome: "deca", simbolo: "da", expoente: 1 },
  { nome: "deci", simbolo: "d", expoente: -1 },
  { nome: "centi", simbolo: "c", expoente: -2 },
  { nome: "mili", simbolo: "m", expoente: -3 },
  { nome: "micro", simbolo: "µ", expoente: -6 },
  { nome: "nano", simbolo: "n", expoente: -9 },
  { nome: "pico", simbolo: "p", expoente: -12 },
  { nome: "femto", simbolo: "f", expoente: -15 },
  { nome: "ato", simbolo: "a", expoente: -18 },
  { nome: "zepto", simbolo: "z", expoente: -21 },
  { nome: "iocto", simbolo: "y", expoente: -24 },
  { nome: "ronto", simbolo: "r", expoente: -27 },
  { nome: "quecto", simbolo: "q", expoente: -30 },
];
