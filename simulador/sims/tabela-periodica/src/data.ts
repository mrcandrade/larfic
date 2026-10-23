// Dados atômicos reais usados na sim (fontes indicadas em cada tabela).

/** Símbolos, Z = 1 a 118. */
export const SYMBOLS = (
  "H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr " +
  "Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu " +
  "Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu Am Cm Bk Cf Es Fm Md No Lr " +
  "Rf Db Sg Bh Hs Mt Ds Rg Cn Nh Fl Mc Lv Ts Og"
).split(" ");

/** Nomes em português (IUPAC/SBQ). */
export const NAMES = (
  "Hidrogênio Hélio Lítio Berílio Boro Carbono Nitrogênio Oxigênio Flúor Neônio Sódio Magnésio Alumínio Silício " +
  "Fósforo Enxofre Cloro Argônio Potássio Cálcio Escândio Titânio Vanádio Cromo Manganês Ferro Cobalto Níquel Cobre " +
  "Zinco Gálio Germânio Arsênio Selênio Bromo Criptônio Rubídio Estrôncio Ítrio Zircônio Nióbio Molibdênio Tecnécio " +
  "Rutênio Ródio Paládio Prata Cádmio Índio Estanho Antimônio Telúrio Iodo Xenônio Césio Bário Lantânio Cério " +
  "Praseodímio Neodímio Promécio Samário Európio Gadolínio Térbio Disprósio Hólmio Érbio Túlio Itérbio Lutécio " +
  "Háfnio Tântalo Tungstênio Rênio Ósmio Irídio Platina Ouro Mercúrio Tálio Chumbo Bismuto Polônio Astato Radônio " +
  "Frâncio Rádio Actínio Tório Protactínio Urânio Netúnio Plutônio Amerício Cúrio Berquélio Califórnio Einstênio " +
  "Férmio Mendelévio Nobélio Laurêncio Rutherfórdio Dúbnio Seabórgio Bóhrio Hássio Meitnério Darmstádtio " +
  "Roentgênio Copernício Nihônio Fleróvio Moscóvio Livermório Tenesso Oganessônio"
).split(" ");

/**
 * Primeira energia de ionização (eV), Z = 1 a 86.
 * Fonte: NIST Atomic Spectra Database, "Ground Levels and Ionization Energies".
 */
export const IONIZATION_EV = [
  13.598, 24.587, 5.392, 9.323, 8.298, 11.26, 14.534, 13.618, 17.423, 21.565, // 1–10
  5.139, 7.646, 5.986, 8.152, 10.487, 10.36, 12.968, 15.76, 4.341, 6.113, // 11–20
  6.561, 6.828, 6.746, 6.767, 7.434, 7.902, 7.881, 7.64, 7.726, 9.394, // 21–30
  5.999, 7.9, 9.789, 9.752, 11.814, 14.0, 4.177, 5.695, 6.217, 6.634, // 31–40
  6.759, 7.092, 7.119, 7.361, 7.459, 8.337, 7.576, 8.994, 5.786, 7.344, // 41–50
  8.608, 9.01, 10.451, 12.13, 3.894, 5.212, 5.577, 5.539, 5.473, 5.525, // 51–60
  5.582, 5.644, 5.67, 6.15, 5.864, 5.939, 6.022, 6.108, 6.184, 6.254, // 61–70
  5.426, 6.825, 7.55, 7.864, 7.834, 8.438, 8.967, 8.959, 9.226, 10.438, // 71–80
  6.108, 7.417, 7.286, 8.414, 9.318, 10.749, // 81–86
];

/**
 * Raio covalente (pm), Z = 1 a 86. Fonte: B. Cordero et al., Dalton Trans. (2008) 2832
 * (Mn, Fe e Co em spin baixo; para He, Ne, Ar, os valores são estimativas dos autores).
 */
export const RADIUS_PM = [
  31, 28, 128, 96, 84, 76, 71, 66, 57, 58, // 1–10
  166, 141, 121, 111, 107, 105, 102, 106, 203, 176, // 11–20
  170, 160, 153, 139, 139, 132, 126, 124, 132, 122, // 21–30
  122, 120, 119, 120, 120, 116, 220, 195, 190, 175, // 31–40
  164, 154, 147, 146, 142, 139, 145, 144, 142, 139, // 41–50
  139, 138, 139, 140, 244, 215, 207, 204, 203, 201, // 51–60
  199, 198, 198, 196, 194, 192, 192, 189, 190, 187, // 61–70
  187, 175, 170, 162, 151, 144, 141, 136, 136, 132, // 71–80
  145, 146, 148, 140, 150, 150, // 81–86
];

/**
 * Energia da linha Kα₁ (keV). Fonte: R. D. Deslattes et al., Rev. Mod. Phys. 75, 35 (2003)
 * e X-ray Data Booklet (LBNL).
 */
export const KALPHA_KEV: Record<number, number> = {
  11: 1.041, 12: 1.2536, 13: 1.4867, 14: 1.74, 15: 2.0137, 16: 2.3078, 17: 2.6224, 18: 2.9577, 19: 3.3138, 20: 3.6917,
  21: 4.0906, 22: 4.5108, 23: 4.9522, 24: 5.4147, 25: 5.8988, 26: 6.4038, 27: 6.9303, 28: 7.4782, 29: 8.0478, 30: 8.6389,
  31: 9.2517, 32: 9.8864, 33: 10.5437, 34: 11.2224, 35: 11.9242, 36: 12.649, 37: 13.3953, 38: 14.165, 39: 14.9584, 40: 15.7751,
  41: 16.6151, 42: 17.4793, 43: 18.367, 44: 19.2792, 45: 20.2161, 46: 21.1771, 47: 22.1629, 48: 23.1736, 49: 24.2097, 50: 25.2713,
  51: 26.3591, 52: 27.4723, 53: 28.612, 54: 29.779, 55: 30.9728, 56: 32.1936, 57: 33.4418, 58: 34.72, 59: 36.026, 60: 37.361,
  61: 38.725, 62: 40.118, 64: 42.996, 66: 45.998, 68: 49.128, 70: 52.389, 72: 55.79, 73: 57.532, 74: 59.3182, 75: 61.14,
  76: 62.999, 77: 64.896, 78: 66.832, 79: 68.8037, 82: 74.9694,
};

/** Elementos que faltavam na tabela quando Moseley publicou (1913–1914): as lacunas que a lei apontou. */
export const GAPS_1914 = [43, 61, 72, 75];

/** Massas atômicas (u) dos pares em que a ordem por massa contradiz a ordem por Z. */
export const MASS_INVERSIONS: [number, number, number, number][] = [
  [18, 39.948, 19, 39.098],
  [27, 58.933, 28, 58.693],
  [52, 127.6, 53, 126.904],
];
