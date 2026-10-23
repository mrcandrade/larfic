/**
 * Apêndice F: propriedades dos 118 elementos.
 *
 * - `massa`: massa molar em g/mol (peso atômico padrão abreviado da IUPAC). Para os elementos sem
 *   isótopo estável nem composição isotópica característica (`isotopo: true`), é o número de massa
 *   do isótopo mais estável conhecido, mostrado entre colchetes.
 * - `densidade`: g/cm³ perto da temperatura ambiente; para os gases (`gas: true`), a 0 °C e 1 atm.
 * - `fusao` e `ebulicao`: em kelvins, a 1 atm.
 * - `null` quando o valor não foi medido (só há estimativas) ou não se aplica.
 */
export type Familia =
  | "alcalino"
  | "alcalino-terroso"
  | "transicao"
  | "metal-pos-transicao"
  | "semimetal"
  | "nao-metal"
  | "halogenio"
  | "gas-nobre"
  | "lantanideo"
  | "actinideo"
  | "desconhecida";

export const familias: { id: Familia; label: string }[] = [
  { id: "alcalino", label: "Metais alcalinos" },
  { id: "alcalino-terroso", label: "Metais alcalinoterrosos" },
  { id: "transicao", label: "Metais de transição" },
  { id: "metal-pos-transicao", label: "Outros metais" },
  { id: "semimetal", label: "Semimetais" },
  { id: "nao-metal", label: "Não metais" },
  { id: "halogenio", label: "Halogênios" },
  { id: "gas-nobre", label: "Gases nobres" },
  { id: "lantanideo", label: "Lantanídeos" },
  { id: "actinideo", label: "Actinídeos" },
  { id: "desconhecida", label: "Propriedades químicas desconhecidas" },
];

export interface Elemento {
  z: number;
  simbolo: string;
  nome: string;
  massa: number;
  /** A massa é o número de massa do isótopo mais estável. */
  isotopo?: boolean;
  densidade: number | null;
  gas?: boolean;
  fusao: number | null;
  ebulicao: number | null;
  /** Grupo de 1 a 18; null para lantanídeos e actinídeos (linhas f). */
  grupo: number | null;
  periodo: number;
  familia: Familia;
  nota?: string;
}

export const elementos: Elemento[] = [
  { z: 1, simbolo: "H", nome: "Hidrogênio", massa: 1.008, densidade: 8.988e-05, gas: true, fusao: 13.99, ebulicao: 20.271, grupo: 1, periodo: 1, familia: "nao-metal" },
  { z: 2, simbolo: "He", nome: "Hélio", massa: 4.002602, densidade: 0.0001786, gas: true, fusao: null, ebulicao: 4.222, grupo: 18, periodo: 1, familia: "gas-nobre", nota: "Não solidifica à pressão de 1 atm (só acima de ≈ 25 atm)." },
  { z: 3, simbolo: "Li", nome: "Lítio", massa: 6.94, densidade: 0.534, fusao: 453.65, ebulicao: 1615.15, grupo: 1, periodo: 2, familia: "alcalino" },
  { z: 4, simbolo: "Be", nome: "Berílio", massa: 9.0121831, densidade: 1.85, fusao: 1560.15, ebulicao: 2741.15, grupo: 2, periodo: 2, familia: "alcalino-terroso" },
  { z: 5, simbolo: "B", nome: "Boro", massa: 10.81, densidade: 2.34, fusao: 2350.15, ebulicao: 4273.15, grupo: 13, periodo: 2, familia: "semimetal" },
  { z: 6, simbolo: "C", nome: "Carbono", massa: 12.011, densidade: 2.267, fusao: null, ebulicao: null, grupo: 14, periodo: 2, familia: "nao-metal", nota: "Grafite; sublima a ≈ 3900 K à pressão de 1 atm." },
  { z: 7, simbolo: "N", nome: "Nitrogênio", massa: 14.007, densidade: 0.001251, gas: true, fusao: 63.15, ebulicao: 77.355, grupo: 15, periodo: 2, familia: "nao-metal" },
  { z: 8, simbolo: "O", nome: "Oxigênio", massa: 15.999, densidade: 0.001429, gas: true, fusao: 54.36, ebulicao: 90.188, grupo: 16, periodo: 2, familia: "nao-metal" },
  { z: 9, simbolo: "F", nome: "Flúor", massa: 18.998403163, densidade: 0.001696, gas: true, fusao: 53.48, ebulicao: 85.04, grupo: 17, periodo: 2, familia: "halogenio" },
  { z: 10, simbolo: "Ne", nome: "Neônio", massa: 20.1797, densidade: 0.0009002, gas: true, fusao: 24.56, ebulicao: 27.104, grupo: 18, periodo: 2, familia: "gas-nobre" },
  { z: 11, simbolo: "Na", nome: "Sódio", massa: 22.98976928, densidade: 0.968, fusao: 370.944, ebulicao: 1156.09, grupo: 1, periodo: 3, familia: "alcalino" },
  { z: 12, simbolo: "Mg", nome: "Magnésio", massa: 24.305, densidade: 1.74, fusao: 923.15, ebulicao: 1363.15, grupo: 2, periodo: 3, familia: "alcalino-terroso" },
  { z: 13, simbolo: "Al", nome: "Alumínio", massa: 26.9815385, densidade: 2.7, fusao: 933.473, ebulicao: 2792.15, grupo: 13, periodo: 3, familia: "metal-pos-transicao" },
  { z: 14, simbolo: "Si", nome: "Silício", massa: 28.085, densidade: 2.3296, fusao: 1687.15, ebulicao: 3538.15, grupo: 14, periodo: 3, familia: "semimetal" },
  { z: 15, simbolo: "P", nome: "Fósforo", massa: 30.973761998, densidade: 1.823, fusao: 317.3, ebulicao: 553.7, grupo: 15, periodo: 3, familia: "nao-metal", nota: "Fósforo branco." },
  { z: 16, simbolo: "S", nome: "Enxofre", massa: 32.06, densidade: 2.07, fusao: 388.36, ebulicao: 717.8, grupo: 16, periodo: 3, familia: "nao-metal", nota: "Enxofre rômbico." },
  { z: 17, simbolo: "Cl", nome: "Cloro", massa: 35.45, densidade: 0.003214, gas: true, fusao: 171.65, ebulicao: 239.11, grupo: 17, periodo: 3, familia: "halogenio" },
  { z: 18, simbolo: "Ar", nome: "Argônio", massa: 39.948, densidade: 0.001784, gas: true, fusao: 83.81, ebulicao: 87.302, grupo: 18, periodo: 3, familia: "gas-nobre" },
  { z: 19, simbolo: "K", nome: "Potássio", massa: 39.0983, densidade: 0.862, fusao: 336.65, ebulicao: 1032.15, grupo: 1, periodo: 4, familia: "alcalino" },
  { z: 20, simbolo: "Ca", nome: "Cálcio", massa: 40.078, densidade: 1.55, fusao: 1115.15, ebulicao: 1757.15, grupo: 2, periodo: 4, familia: "alcalino-terroso" },
  { z: 21, simbolo: "Sc", nome: "Escândio", massa: 44.955908, densidade: 2.99, fusao: 1814.15, ebulicao: 3109.15, grupo: 3, periodo: 4, familia: "transicao" },
  { z: 22, simbolo: "Ti", nome: "Titânio", massa: 47.867, densidade: 4.506, fusao: 1943.15, ebulicao: 3560.15, grupo: 4, periodo: 4, familia: "transicao" },
  { z: 23, simbolo: "V", nome: "Vanádio", massa: 50.9415, densidade: 6.0, fusao: 2183.15, ebulicao: 3680.15, grupo: 5, periodo: 4, familia: "transicao" },
  { z: 24, simbolo: "Cr", nome: "Cromo", massa: 51.9961, densidade: 7.15, fusao: 2180.15, ebulicao: 2944.15, grupo: 6, periodo: 4, familia: "transicao" },
  { z: 25, simbolo: "Mn", nome: "Manganês", massa: 54.938044, densidade: 7.3, fusao: 1519.15, ebulicao: 2334.15, grupo: 7, periodo: 4, familia: "transicao" },
  { z: 26, simbolo: "Fe", nome: "Ferro", massa: 55.845, densidade: 7.87, fusao: 1811.15, ebulicao: 3134.15, grupo: 8, periodo: 4, familia: "transicao" },
  { z: 27, simbolo: "Co", nome: "Cobalto", massa: 58.933194, densidade: 8.86, fusao: 1768.15, ebulicao: 3200.15, grupo: 9, periodo: 4, familia: "transicao" },
  { z: 28, simbolo: "Ni", nome: "Níquel", massa: 58.6934, densidade: 8.9, fusao: 1728.15, ebulicao: 3186.15, grupo: 10, periodo: 4, familia: "transicao" },
  { z: 29, simbolo: "Cu", nome: "Cobre", massa: 63.546, densidade: 8.96, fusao: 1357.77, ebulicao: 2833.15, grupo: 11, periodo: 4, familia: "transicao" },
  { z: 30, simbolo: "Zn", nome: "Zinco", massa: 65.38, densidade: 7.134, fusao: 692.677, ebulicao: 1180.15, grupo: 12, periodo: 4, familia: "transicao" },
  { z: 31, simbolo: "Ga", nome: "Gálio", massa: 69.723, densidade: 5.91, fusao: 302.9146, ebulicao: 2502.15, grupo: 13, periodo: 4, familia: "metal-pos-transicao" },
  { z: 32, simbolo: "Ge", nome: "Germânio", massa: 72.63, densidade: 5.3234, fusao: 1211.4, ebulicao: 3106.15, grupo: 14, periodo: 4, familia: "semimetal" },
  { z: 33, simbolo: "As", nome: "Arsênio", massa: 74.921595, densidade: 5.75, fusao: null, ebulicao: null, grupo: 15, periodo: 4, familia: "semimetal", nota: "Arsênio cinza; sublima a 887 K à pressão de 1 atm." },
  { z: 34, simbolo: "Se", nome: "Selênio", massa: 78.971, densidade: 4.81, fusao: 494.0, ebulicao: 958.15, grupo: 16, periodo: 4, familia: "nao-metal", nota: "Selênio cinza." },
  { z: 35, simbolo: "Br", nome: "Bromo", massa: 79.904, densidade: 3.1028, fusao: 265.95, ebulicao: 331.95, grupo: 17, periodo: 4, familia: "halogenio" },
  { z: 36, simbolo: "Kr", nome: "Criptônio", massa: 83.798, densidade: 0.003749, gas: true, fusao: 115.78, ebulicao: 119.735, grupo: 18, periodo: 4, familia: "gas-nobre" },
  { z: 37, simbolo: "Rb", nome: "Rubídio", massa: 85.4678, densidade: 1.53, fusao: 312.45, ebulicao: 961.15, grupo: 1, periodo: 5, familia: "alcalino" },
  { z: 38, simbolo: "Sr", nome: "Estrôncio", massa: 87.62, densidade: 2.64, fusao: 1050.15, ebulicao: 1650.15, grupo: 2, periodo: 5, familia: "alcalino-terroso" },
  { z: 39, simbolo: "Y", nome: "Ítrio", massa: 88.90584, densidade: 4.47, fusao: 1795.15, ebulicao: 3618.15, grupo: 3, periodo: 5, familia: "transicao" },
  { z: 40, simbolo: "Zr", nome: "Zircônio", massa: 91.224, densidade: 6.52, fusao: 2127.15, ebulicao: 4679.15, grupo: 4, periodo: 5, familia: "transicao" },
  { z: 41, simbolo: "Nb", nome: "Nióbio", massa: 92.90637, densidade: 8.57, fusao: 2750.15, ebulicao: 5014.15, grupo: 5, periodo: 5, familia: "transicao" },
  { z: 42, simbolo: "Mo", nome: "Molibdênio", massa: 95.95, densidade: 10.2, fusao: 2895.15, ebulicao: 4912.15, grupo: 6, periodo: 5, familia: "transicao" },
  { z: 43, simbolo: "Tc", nome: "Tecnécio", massa: 98, isotopo: true, densidade: 11.0, fusao: 2430.15, ebulicao: 4535.15, grupo: 7, periodo: 5, familia: "transicao" },
  { z: 44, simbolo: "Ru", nome: "Rutênio", massa: 101.07, densidade: 12.1, fusao: 2606.15, ebulicao: 4420.15, grupo: 8, periodo: 5, familia: "transicao" },
  { z: 45, simbolo: "Rh", nome: "Ródio", massa: 102.9055, densidade: 12.4, fusao: 2236.15, ebulicao: 3968.15, grupo: 9, periodo: 5, familia: "transicao" },
  { z: 46, simbolo: "Pd", nome: "Paládio", massa: 106.42, densidade: 12.0, fusao: 1827.95, ebulicao: 3236.15, grupo: 10, periodo: 5, familia: "transicao" },
  { z: 47, simbolo: "Ag", nome: "Prata", massa: 107.8682, densidade: 10.5, fusao: 1234.93, ebulicao: 2435.15, grupo: 11, periodo: 5, familia: "transicao" },
  { z: 48, simbolo: "Cd", nome: "Cádmio", massa: 112.414, densidade: 8.69, fusao: 594.219, ebulicao: 1040.15, grupo: 12, periodo: 5, familia: "transicao" },
  { z: 49, simbolo: "In", nome: "Índio", massa: 114.818, densidade: 7.31, fusao: 429.7485, ebulicao: 2300.15, grupo: 13, periodo: 5, familia: "metal-pos-transicao" },
  { z: 50, simbolo: "Sn", nome: "Estanho", massa: 118.71, densidade: 7.287, fusao: 505.08, ebulicao: 2875.0, grupo: 14, periodo: 5, familia: "metal-pos-transicao", nota: "Estanho branco (β)." },
  { z: 51, simbolo: "Sb", nome: "Antimônio", massa: 121.76, densidade: 6.68, fusao: 903.778, ebulicao: 1860.15, grupo: 15, periodo: 5, familia: "semimetal" },
  { z: 52, simbolo: "Te", nome: "Telúrio", massa: 127.6, densidade: 6.232, fusao: 722.66, ebulicao: 1261.15, grupo: 16, periodo: 5, familia: "semimetal" },
  { z: 53, simbolo: "I", nome: "Iodo", massa: 126.90447, densidade: 4.933, fusao: 386.85, ebulicao: 457.55, grupo: 17, periodo: 5, familia: "halogenio" },
  { z: 54, simbolo: "Xe", nome: "Xenônio", massa: 131.293, densidade: 0.005894, gas: true, fusao: 161.4, ebulicao: 165.051, grupo: 18, periodo: 5, familia: "gas-nobre" },
  { z: 55, simbolo: "Cs", nome: "Césio", massa: 132.90545196, densidade: 1.93, fusao: 301.65, ebulicao: 944.15, grupo: 1, periodo: 6, familia: "alcalino" },
  { z: 56, simbolo: "Ba", nome: "Bário", massa: 137.327, densidade: 3.62, fusao: 1000.15, ebulicao: 2118.15, grupo: 2, periodo: 6, familia: "alcalino-terroso" },
  { z: 57, simbolo: "La", nome: "Lantânio", massa: 138.90547, densidade: 6.15, fusao: 1193.15, ebulicao: 3737.15, grupo: null, periodo: 6, familia: "lantanideo" },
  { z: 58, simbolo: "Ce", nome: "Cério", massa: 140.116, densidade: 6.77, fusao: 1072.15, ebulicao: 3716.15, grupo: null, periodo: 6, familia: "lantanideo" },
  { z: 59, simbolo: "Pr", nome: "Praseodímio", massa: 140.90766, densidade: 6.773, fusao: 1204.15, ebulicao: 3793.15, grupo: null, periodo: 6, familia: "lantanideo" },
  { z: 60, simbolo: "Nd", nome: "Neodímio", massa: 144.242, densidade: 7.01, fusao: 1289.15, ebulicao: 3347.15, grupo: null, periodo: 6, familia: "lantanideo" },
  { z: 61, simbolo: "Pm", nome: "Promécio", massa: 145, isotopo: true, densidade: 7.26, fusao: 1315.15, ebulicao: null, grupo: null, periodo: 6, familia: "lantanideo" },
  { z: 62, simbolo: "Sm", nome: "Samário", massa: 150.36, densidade: 7.52, fusao: 1345.15, ebulicao: 2067.15, grupo: null, periodo: 6, familia: "lantanideo" },
  { z: 63, simbolo: "Eu", nome: "Európio", massa: 151.964, densidade: 5.24, fusao: 1095.15, ebulicao: 1802.15, grupo: null, periodo: 6, familia: "lantanideo" },
  { z: 64, simbolo: "Gd", nome: "Gadolínio", massa: 157.25, densidade: 7.9, fusao: 1586.15, ebulicao: 3546.15, grupo: null, periodo: 6, familia: "lantanideo" },
  { z: 65, simbolo: "Tb", nome: "Térbio", massa: 158.92535, densidade: 8.23, fusao: 1632.15, ebulicao: 3503.15, grupo: null, periodo: 6, familia: "lantanideo" },
  { z: 66, simbolo: "Dy", nome: "Disprósio", massa: 162.5, densidade: 8.55, fusao: 1685.15, ebulicao: 2840.15, grupo: null, periodo: 6, familia: "lantanideo" },
  { z: 67, simbolo: "Ho", nome: "Hólmio", massa: 164.93033, densidade: 8.8, fusao: 1745.15, ebulicao: 2973.15, grupo: null, periodo: 6, familia: "lantanideo" },
  { z: 68, simbolo: "Er", nome: "Érbio", massa: 167.259, densidade: 9.07, fusao: 1802.15, ebulicao: 3141.15, grupo: null, periodo: 6, familia: "lantanideo" },
  { z: 69, simbolo: "Tm", nome: "Túlio", massa: 168.93422, densidade: 9.321, fusao: 1818.15, ebulicao: 2223.15, grupo: null, periodo: 6, familia: "lantanideo" },
  { z: 70, simbolo: "Yb", nome: "Itérbio", massa: 173.045, densidade: 6.9, fusao: 1097.15, ebulicao: 1469.15, grupo: null, periodo: 6, familia: "lantanideo" },
  { z: 71, simbolo: "Lu", nome: "Lutécio", massa: 174.9668, densidade: 9.84, fusao: 1936.15, ebulicao: 3675.15, grupo: null, periodo: 6, familia: "lantanideo" },
  { z: 72, simbolo: "Hf", nome: "Háfnio", massa: 178.49, densidade: 13.3, fusao: 2506.15, ebulicao: 4873.15, grupo: 4, periodo: 6, familia: "transicao" },
  { z: 73, simbolo: "Ta", nome: "Tântalo", massa: 180.94788, densidade: 16.4, fusao: 3290.15, ebulicao: 5728.15, grupo: 5, periodo: 6, familia: "transicao" },
  { z: 74, simbolo: "W", nome: "Tungstênio", massa: 183.84, densidade: 19.3, fusao: 3687.15, ebulicao: 5828.15, grupo: 6, periodo: 6, familia: "transicao" },
  { z: 75, simbolo: "Re", nome: "Rênio", massa: 186.207, densidade: 20.8, fusao: 3458.15, ebulicao: 5863.15, grupo: 7, periodo: 6, familia: "transicao" },
  { z: 76, simbolo: "Os", nome: "Ósmio", massa: 190.23, densidade: 22.5872, fusao: 3306.15, ebulicao: 5281.15, grupo: 8, periodo: 6, familia: "transicao" },
  { z: 77, simbolo: "Ir", nome: "Irídio", massa: 192.217, densidade: 22.5622, fusao: 2719.15, ebulicao: 4701.15, grupo: 9, periodo: 6, familia: "transicao" },
  { z: 78, simbolo: "Pt", nome: "Platina", massa: 195.084, densidade: 21.5, fusao: 2041.35, ebulicao: 4098.15, grupo: 10, periodo: 6, familia: "transicao" },
  { z: 79, simbolo: "Au", nome: "Ouro", massa: 196.966569, densidade: 19.3, fusao: 1337.33, ebulicao: 3109.15, grupo: 11, periodo: 6, familia: "transicao" },
  { z: 80, simbolo: "Hg", nome: "Mercúrio", massa: 200.592, densidade: 13.5336, fusao: 234.321, ebulicao: 629.769, grupo: 12, periodo: 6, familia: "transicao" },
  { z: 81, simbolo: "Tl", nome: "Tálio", massa: 204.38, densidade: 11.8, fusao: 577.15, ebulicao: 1746.15, grupo: 13, periodo: 6, familia: "metal-pos-transicao" },
  { z: 82, simbolo: "Pb", nome: "Chumbo", massa: 207.2, densidade: 11.3, fusao: 600.612, ebulicao: 2022.15, grupo: 14, periodo: 6, familia: "metal-pos-transicao" },
  { z: 83, simbolo: "Bi", nome: "Bismuto", massa: 208.9804, densidade: 9.79, fusao: 544.552, ebulicao: 1837.15, grupo: 15, periodo: 6, familia: "metal-pos-transicao" },
  { z: 84, simbolo: "Po", nome: "Polônio", massa: 209, isotopo: true, densidade: 9.2, fusao: 527.15, ebulicao: 1235.15, grupo: 16, periodo: 6, familia: "metal-pos-transicao" },
  { z: 85, simbolo: "At", nome: "Astato", massa: 210, isotopo: true, densidade: null, fusao: null, ebulicao: null, grupo: 17, periodo: 6, familia: "halogenio" },
  { z: 86, simbolo: "Rn", nome: "Radônio", massa: 222, isotopo: true, densidade: 0.00973, gas: true, fusao: 202.15, ebulicao: 211.45, grupo: 18, periodo: 6, familia: "gas-nobre" },
  { z: 87, simbolo: "Fr", nome: "Frâncio", massa: 223, isotopo: true, densidade: null, fusao: null, ebulicao: null, grupo: 1, periodo: 7, familia: "alcalino" },
  { z: 88, simbolo: "Ra", nome: "Rádio", massa: 226, isotopo: true, densidade: 5.5, fusao: 973.0, ebulicao: 2010.0, grupo: 2, periodo: 7, familia: "alcalino-terroso" },
  { z: 89, simbolo: "Ac", nome: "Actínio", massa: 227, isotopo: true, densidade: 10.0, fusao: 1323.15, ebulicao: 3473.15, grupo: null, periodo: 7, familia: "actinideo" },
  { z: 90, simbolo: "Th", nome: "Tório", massa: 232.0377, densidade: 11.7, fusao: 2023.15, ebulicao: 5058.15, grupo: null, periodo: 7, familia: "actinideo" },
  { z: 91, simbolo: "Pa", nome: "Protactínio", massa: 231.03588, densidade: 15.4, fusao: 1845.15, ebulicao: null, grupo: null, periodo: 7, familia: "actinideo" },
  { z: 92, simbolo: "U", nome: "Urânio", massa: 238.02891, densidade: 19.1, fusao: 1408.15, ebulicao: 4404.15, grupo: null, periodo: 7, familia: "actinideo" },
  { z: 93, simbolo: "Np", nome: "Netúnio", massa: 237, isotopo: true, densidade: 20.2, fusao: 917.15, ebulicao: null, grupo: null, periodo: 7, familia: "actinideo" },
  { z: 94, simbolo: "Pu", nome: "Plutônio", massa: 244, isotopo: true, densidade: 19.7, fusao: 913.15, ebulicao: 3501.15, grupo: null, periodo: 7, familia: "actinideo" },
  { z: 95, simbolo: "Am", nome: "Amerício", massa: 243, isotopo: true, densidade: 12.0, fusao: 1449.15, ebulicao: null, grupo: null, periodo: 7, familia: "actinideo" },
  { z: 96, simbolo: "Cm", nome: "Cúrio", massa: 247, isotopo: true, densidade: 13.51, fusao: 1618.15, ebulicao: null, grupo: null, periodo: 7, familia: "actinideo" },
  { z: 97, simbolo: "Bk", nome: "Berquélio", massa: 247, isotopo: true, densidade: 14.78, fusao: 1259.15, ebulicao: null, grupo: null, periodo: 7, familia: "actinideo" },
  { z: 98, simbolo: "Cf", nome: "Califórnio", massa: 251, isotopo: true, densidade: 15.1, fusao: 1173.15, ebulicao: null, grupo: null, periodo: 7, familia: "actinideo" },
  { z: 99, simbolo: "Es", nome: "Einstênio", massa: 252, isotopo: true, densidade: null, fusao: 1133.15, ebulicao: null, grupo: null, periodo: 7, familia: "actinideo" },
  { z: 100, simbolo: "Fm", nome: "Férmio", massa: 257, isotopo: true, densidade: null, fusao: null, ebulicao: null, grupo: null, periodo: 7, familia: "actinideo" },
  { z: 101, simbolo: "Md", nome: "Mendelévio", massa: 258, isotopo: true, densidade: null, fusao: null, ebulicao: null, grupo: null, periodo: 7, familia: "actinideo" },
  { z: 102, simbolo: "No", nome: "Nobélio", massa: 259, isotopo: true, densidade: null, fusao: null, ebulicao: null, grupo: null, periodo: 7, familia: "actinideo" },
  { z: 103, simbolo: "Lr", nome: "Laurêncio", massa: 266, isotopo: true, densidade: null, fusao: null, ebulicao: null, grupo: null, periodo: 7, familia: "actinideo" },
  { z: 104, simbolo: "Rf", nome: "Rutherfórdio", massa: 267, isotopo: true, densidade: null, fusao: null, ebulicao: null, grupo: 4, periodo: 7, familia: "transicao" },
  { z: 105, simbolo: "Db", nome: "Dúbnio", massa: 268, isotopo: true, densidade: null, fusao: null, ebulicao: null, grupo: 5, periodo: 7, familia: "transicao" },
  { z: 106, simbolo: "Sg", nome: "Seabórgio", massa: 269, isotopo: true, densidade: null, fusao: null, ebulicao: null, grupo: 6, periodo: 7, familia: "transicao" },
  { z: 107, simbolo: "Bh", nome: "Bóhrio", massa: 270, isotopo: true, densidade: null, fusao: null, ebulicao: null, grupo: 7, periodo: 7, familia: "transicao" },
  { z: 108, simbolo: "Hs", nome: "Hássio", massa: 269, isotopo: true, densidade: null, fusao: null, ebulicao: null, grupo: 8, periodo: 7, familia: "transicao" },
  { z: 109, simbolo: "Mt", nome: "Meitnério", massa: 278, isotopo: true, densidade: null, fusao: null, ebulicao: null, grupo: 9, periodo: 7, familia: "desconhecida" },
  { z: 110, simbolo: "Ds", nome: "Darmstádtio", massa: 281, isotopo: true, densidade: null, fusao: null, ebulicao: null, grupo: 10, periodo: 7, familia: "desconhecida" },
  { z: 111, simbolo: "Rg", nome: "Roentgênio", massa: 282, isotopo: true, densidade: null, fusao: null, ebulicao: null, grupo: 11, periodo: 7, familia: "desconhecida" },
  { z: 112, simbolo: "Cn", nome: "Copernício", massa: 285, isotopo: true, densidade: null, fusao: null, ebulicao: null, grupo: 12, periodo: 7, familia: "desconhecida" },
  { z: 113, simbolo: "Nh", nome: "Nihônio", massa: 286, isotopo: true, densidade: null, fusao: null, ebulicao: null, grupo: 13, periodo: 7, familia: "desconhecida" },
  { z: 114, simbolo: "Fl", nome: "Fleróvio", massa: 290, isotopo: true, densidade: null, fusao: null, ebulicao: null, grupo: 14, periodo: 7, familia: "desconhecida" },
  { z: 115, simbolo: "Mc", nome: "Moscóvio", massa: 290, isotopo: true, densidade: null, fusao: null, ebulicao: null, grupo: 15, periodo: 7, familia: "desconhecida" },
  { z: 116, simbolo: "Lv", nome: "Livermório", massa: 293, isotopo: true, densidade: null, fusao: null, ebulicao: null, grupo: 16, periodo: 7, familia: "desconhecida" },
  { z: 117, simbolo: "Ts", nome: "Tenessino", massa: 294, isotopo: true, densidade: null, fusao: null, ebulicao: null, grupo: 17, periodo: 7, familia: "desconhecida" },
  { z: 118, simbolo: "Og", nome: "Oganessônio", massa: 294, isotopo: true, densidade: null, fusao: null, ebulicao: null, grupo: 18, periodo: 7, familia: "desconhecida" },
];

export const findElemento = (z: number) => elementos[z - 1];

/**
 * Posição na tabela periódica (linha e coluna de 1 a 18). Os lantanídeos e actinídeos vão para
 * as linhas 9 e 10, abaixo do corpo principal, a partir da coluna 3.
 */
export function posicao(e: Elemento): { linha: number; coluna: number } {
  if (e.z >= 57 && e.z <= 71) return { linha: 9, coluna: 3 + (e.z - 57) };
  if (e.z >= 89 && e.z <= 103) return { linha: 10, coluna: 3 + (e.z - 89) };
  return { linha: e.periodo, coluna: e.grupo ?? 3 };
}
