/**
 * Apêndice C: dados astronômicos. Valores médios, arredondados para uso em problemas
 * (fontes: fichas de dados planetários da NASA e constantes nominais da IAU 2015).
 */
export interface DadoSimples {
  grandeza: string;
  valor: string;
}

export const sol: DadoSimples[] = [
  { grandeza: "Massa", valor: "1,989 × 10³⁰ kg" },
  { grandeza: "Raio médio", valor: "6,957 × 10⁸ m" },
  { grandeza: "Massa específica média", valor: "1408 kg/m³" },
  { grandeza: "Aceleração de queda livre na superfície", valor: "274 m/s²" },
  { grandeza: "Velocidade de escape", valor: "618 km/s" },
  { grandeza: "Potência irradiada (luminosidade)", valor: "3,828 × 10²⁶ W" },
  { grandeza: "Temperatura da superfície (fotosfera)", valor: "5772 K" },
  { grandeza: "Temperatura no centro", valor: "≈ 1,57 × 10⁷ K" },
  { grandeza: "Período de rotação (no equador)", valor: "≈ 25 dias" },
  { grandeza: "Distância ao centro da Via Láctea", valor: "≈ 2,6 × 10²⁰ m (≈ 27 000 anos-luz)" },
  { grandeza: "Velocidade em torno do centro da Via Láctea", valor: "≈ 230 km/s" },
];

export const terra: DadoSimples[] = [
  { grandeza: "Massa", valor: "5,972 × 10²⁴ kg" },
  { grandeza: "Raio médio", valor: "6,371 × 10⁶ m" },
  { grandeza: "Raio equatorial", valor: "6,378 × 10⁶ m" },
  { grandeza: "Raio polar", valor: "6,357 × 10⁶ m" },
  { grandeza: "Massa específica média", valor: "5514 kg/m³" },
  { grandeza: "Aceleração de queda livre padrão", valor: "9,80665 m/s²" },
  { grandeza: "Velocidade de escape", valor: "11,2 km/s" },
  { grandeza: "Distância média ao Sol (1 ua)", valor: "1,496 × 10¹¹ m" },
  { grandeza: "Período orbital (ano sideral)", valor: "365,26 d = 3,156 × 10⁷ s" },
  { grandeza: "Período de rotação (dia sideral)", valor: "23 h 56 min 4 s" },
  { grandeza: "Velocidade orbital média", valor: "29,8 km/s" },
  { grandeza: "Inclinação do eixo de rotação", valor: "23,44°" },
  { grandeza: "Intensidade da luz solar no topo da atmosfera", valor: "≈ 1361 W/m²" },
  { grandeza: "Pressão atmosférica média ao nível do mar", valor: "1,013 × 10⁵ Pa" },
];

export const lua: DadoSimples[] = [
  { grandeza: "Massa", valor: "7,35 × 10²² kg" },
  { grandeza: "Raio médio", valor: "1,737 × 10⁶ m" },
  { grandeza: "Massa específica média", valor: "3344 kg/m³" },
  { grandeza: "Aceleração de queda livre na superfície", valor: "1,62 m/s²" },
  { grandeza: "Velocidade de escape", valor: "2,38 km/s" },
  { grandeza: "Distância média à Terra (centro a centro)", valor: "3,844 × 10⁸ m" },
  { grandeza: "Período orbital (sideral)", valor: "27,32 d" },
  { grandeza: "Período das fases (mês sinódico)", valor: "29,53 d" },
  { grandeza: "Velocidade orbital média", valor: "1,02 km/s" },
];

export interface Planeta {
  nome: string;
  /** Distância média ao Sol, 10⁶ km. */
  distancia: number;
  /** Período orbital em anos terrestres. */
  periodoAnos: number;
  /** Período de rotação sideral em dias; negativo = rotação retrógrada. */
  rotacaoDias: number;
  /** Velocidade orbital média, km/s. */
  velocidadeOrbital: number;
  /** Inclinação da órbita em relação à da Terra, graus. */
  inclinacaoOrbita: number;
  excentricidade: number;
  /** Diâmetro equatorial, km. */
  diametro: number;
  /** Massa, kg. */
  massa: number;
  /** Massa específica média, kg/m³. */
  densidade: number;
  /** Aceleração de queda livre no equador (no topo das nuvens para os gigantes), m/s². */
  gravidade: number;
  /** Velocidade de escape, km/s. */
  escape: number;
  /** Inclinação do eixo de rotação, graus. */
  inclinacaoEixo: number;
}

export const planetas: Planeta[] = [
  { nome: "Mercúrio", distancia: 57.9, periodoAnos: 0.241, rotacaoDias: 58.6, velocidadeOrbital: 47.4, inclinacaoOrbita: 7.0, excentricidade: 0.206, diametro: 4879, massa: 3.30e23, densidade: 5429, gravidade: 3.7, escape: 4.3, inclinacaoEixo: 0.03 },
  { nome: "Vênus", distancia: 108.2, periodoAnos: 0.615, rotacaoDias: -243.0, velocidadeOrbital: 35.0, inclinacaoOrbita: 3.4, excentricidade: 0.007, diametro: 12104, massa: 4.87e24, densidade: 5243, gravidade: 8.9, escape: 10.4, inclinacaoEixo: 177.4 },
  { nome: "Terra", distancia: 149.6, periodoAnos: 1.0, rotacaoDias: 0.997, velocidadeOrbital: 29.8, inclinacaoOrbita: 0.0, excentricidade: 0.017, diametro: 12756, massa: 5.97e24, densidade: 5514, gravidade: 9.8, escape: 11.2, inclinacaoEixo: 23.4 },
  { nome: "Marte", distancia: 227.9, periodoAnos: 1.88, rotacaoDias: 1.026, velocidadeOrbital: 24.1, inclinacaoOrbita: 1.8, excentricidade: 0.094, diametro: 6792, massa: 6.42e23, densidade: 3934, gravidade: 3.7, escape: 5.0, inclinacaoEixo: 25.2 },
  { nome: "Júpiter", distancia: 778.5, periodoAnos: 11.86, rotacaoDias: 0.414, velocidadeOrbital: 13.1, inclinacaoOrbita: 1.3, excentricidade: 0.049, diametro: 142984, massa: 1.898e27, densidade: 1326, gravidade: 23.1, escape: 59.5, inclinacaoEixo: 3.1 },
  { nome: "Saturno", distancia: 1432.0, periodoAnos: 29.4, rotacaoDias: 0.444, velocidadeOrbital: 9.7, inclinacaoOrbita: 2.5, excentricidade: 0.052, diametro: 120536, massa: 5.68e26, densidade: 687, gravidade: 9.0, escape: 35.5, inclinacaoEixo: 26.7 },
  { nome: "Urano", distancia: 2867.0, periodoAnos: 83.7, rotacaoDias: -0.718, velocidadeOrbital: 6.8, inclinacaoOrbita: 0.8, excentricidade: 0.047, diametro: 51118, massa: 8.68e25, densidade: 1270, gravidade: 8.7, escape: 21.3, inclinacaoEixo: 97.8 },
  { nome: "Netuno", distancia: 4498.0, periodoAnos: 163.7, rotacaoDias: 0.671, velocidadeOrbital: 5.4, inclinacaoOrbita: 1.8, excentricidade: 0.010, diametro: 49528, massa: 1.02e26, densidade: 1638, gravidade: 11.0, escape: 23.5, inclinacaoEixo: 28.3 },
];
