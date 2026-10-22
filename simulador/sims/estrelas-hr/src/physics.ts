/** Estrelas: dados reais, corpo negro, evolução simplificada no diagrama HR e esfera celeste. */

export const T_SUN = 5772;
export const H = 6.62607015e-34;
export const C = 299792458;
export const KB = 1.380649e-23;
export const SIGMA = 5.670374419e-8;
export const WIEN_B = 2.897771955e-3;
export const L_SUN = 3.828e26;
export const R_SUN = 6.957e8;
export const R_EARTH_KM = 6371;

/** Raio (R☉) a partir de L (L☉) e T (K): L = R² (T/T☉)⁴. */
export const radiusOf = (L: number, T: number) => Math.sqrt(L) / (T / T_SUN) ** 2;
/** Luminosidade (L☉) com raio (R☉) e temperatura (K). */
export const lumOf = (R: number, T: number) => R * R * (T / T_SUN) ** 4;

export interface Star {
  name: string;
  T: number;
  L: number;
}

/** Estrelas reais (temperatura efetiva em K, luminosidade em L☉; valores arredondados da literatura). */
export const STARS: Star[] = [
  { name: "Sol", T: 5772, L: 1 },
  { name: "Sírius A", T: 9940, L: 25.4 },
  { name: "Sírius B", T: 25200, L: 0.056 },
  { name: "Canopus", T: 7350, L: 10700 },
  { name: "Arcturus", T: 4286, L: 170 },
  { name: "α Centauri A", T: 5790, L: 1.52 },
  { name: "α Centauri B", T: 5260, L: 0.5 },
  { name: "Próxima Centauri", T: 3042, L: 0.0017 },
  { name: "Vega", T: 9602, L: 40.1 },
  { name: "Capella", T: 4970, L: 79 },
  { name: "Rigel", T: 12100, L: 120000 },
  { name: "Prócion A", T: 6530, L: 6.93 },
  { name: "Prócion B", T: 7740, L: 0.00049 },
  { name: "Betelgeuse", T: 3600, L: 126000 },
  { name: "Achernar", T: 15000, L: 3150 },
  { name: "Altair", T: 7700, L: 10.6 },
  { name: "Aldebarã", T: 3910, L: 439 },
  { name: "Antares", T: 3660, L: 75900 },
  { name: "Spica", T: 22400, L: 20500 },
  { name: "Pollux", T: 4586, L: 32.7 },
  { name: "Deneb", T: 8525, L: 196000 },
  { name: "Polaris", T: 6015, L: 1260 },
  { name: "Régulo", T: 12460, L: 288 },
  { name: "Acrux", T: 24000, L: 25000 },
  { name: "Gacrux", T: 3626, L: 820 },
  { name: "Hadar (β Cen)", T: 25000, L: 41700 },
  { name: "Estrela de Barnard", T: 3134, L: 0.0035 },
  { name: "Wolf 359", T: 2800, L: 0.0011 },
  { name: "40 Eridani B", T: 16500, L: 0.013 },
  { name: "τ Ceti", T: 5344, L: 0.52 },
  { name: "ε Eridani", T: 5084, L: 0.34 },
  { name: "VY Canis Majoris", T: 3490, L: 270000 },
  { name: "Fomalhaut", T: 8590, L: 16.6 },
  { name: "Alnitak", T: 29500, L: 250000 },
];

/** Classe espectral (letra e subclasse aproximada) pela temperatura. */
export function spectralClass(T: number): string {
  const bands: [string, number, number][] = [
    ["O", 30000, 50000], ["B", 10000, 30000], ["A", 7500, 10000], ["F", 6000, 7500], ["G", 5200, 6000], ["K", 3700, 5200], ["M", 2400, 3700],
  ];
  for (const [l, lo, hi] of bands) {
    if (T >= lo || l === "M") {
      const f = Math.log(hi / Math.min(Math.max(T, lo), hi)) / Math.log(hi / lo);
      return `${l}${Math.min(9, Math.max(0, Math.floor(10 * f)))}`;
    }
  }
  return "M";
}

/** Região do diagrama HR para (T, L). */
export function hrRegion(T: number, L: number): string {
  const R = radiusOf(L, T);
  if (R < 0.05) return "anã branca";
  const Lms = mainSequenceL(T);
  if (L > 3000 && R > 30) return "supergiante";
  if (L > 8 * Lms && R > 4) return "gigante";
  if (L < Lms / 8) return "subanã";
  return "sequência principal";
}

/** Luminosidade aproximada da sequência principal (idade zero) na temperatura T. */
export function mainSequenceL(T: number): number {
  // percorre as massas e interpola em log T
  let best = 1, bd = Infinity;
  for (let lm = -1; lm <= 1.9; lm += 0.005) {
    const M = 10 ** lm;
    const d = Math.abs(Math.log10(zamsT(M) / T));
    if (d < bd) { bd = d; best = M; }
  }
  return zamsL(best);
}

// ---------- Corpo negro e cor ----------
export function planck(lam: number, T: number): number {
  if (lam <= 0 || T <= 0) return 0;
  const x = (H * C) / (lam * KB * T);
  if (x > 700) return 0;
  return (2 * Math.PI * H * C * C) / (lam ** 5 * Math.expm1(x));
}
const lobe = (x: number, mu: number, s1: number, s2: number) => {
  const t = (x - mu) / (x < mu ? s1 : s2);
  return Math.exp(-0.5 * t * t);
};
function cieXYZ(nm: number): [number, number, number] {
  return [
    1.056 * lobe(nm, 599.8, 37.9, 31.0) + 0.362 * lobe(nm, 442.0, 16.0, 26.7) - 0.065 * lobe(nm, 501.1, 20.4, 26.2),
    0.821 * lobe(nm, 568.8, 46.9, 40.5) + 0.286 * lobe(nm, 530.9, 16.3, 31.1),
    1.217 * lobe(nm, 437.0, 11.8, 36.0) + 0.681 * lobe(nm, 459.0, 26.0, 13.8),
  ];
}
const gam = (u: number) => (u <= 0.0031308 ? 12.92 * u : 1.055 * u ** (1 / 2.4) - 0.055);
const colorCache = new Map<number, string>();
/** Cor aparente de um corpo negro (sRGB normalizado). */
export function starColor(T: number): string {
  const key = Math.round(T / 50) * 50;
  const hit = colorCache.get(key);
  if (hit) return hit;
  let X = 0, Y = 0, Z = 0;
  for (let nm = 380; nm <= 780; nm += 5) {
    const m = planck(nm * 1e-9, key);
    const [x, y, z] = cieXYZ(nm);
    X += m * x; Y += m * y; Z += m * z;
  }
  let r = 3.2406 * X - 1.5372 * Y - 0.4986 * Z;
  let g = -0.9689 * X + 1.8758 * Y + 0.0415 * Z;
  let b = 0.0557 * X - 0.204 * Y + 1.057 * Z;
  const lo = Math.min(r, g, b, 0);
  r -= lo; g -= lo; b -= lo;
  const hi = Math.max(r, g, b, 1e-300);
  const c = (v: number) => Math.round(255 * gam(v / hi));
  const out = `rgb(${c(r)}, ${c(g)}, ${c(b)})`;
  colorCache.set(key, out);
  return out;
}

/** Índice de cor B−V pela fórmula de Ballesteros (2012), invertida por bisseção. */
export function bvFromT(T: number): number {
  const Tof = (x: number) => 4600 * (1 / (0.92 * x + 1.7) + 1 / (0.92 * x + 0.62));
  let a = -0.4, b = 2.0;
  for (let i = 0; i < 60; i++) {
    const m = (a + b) / 2;
    if (Tof(m) > T) a = m;
    else b = m;
  }
  return (a + b) / 2;
}

// ---------- Evolução estelar simplificada ----------
export function zamsL(M: number): number {
  if (M < 0.43) return 0.23 * M ** 2.3;
  if (M < 2) return M ** 4;
  if (M < 55) return 1.4 * M ** 3.5;
  return 32000 * M;
}
export const zamsR = (M: number) => (M < 1 ? M ** 0.8 : M ** 0.57);
export const zamsT = (M: number) => T_SUN * (zamsL(M) / zamsR(M) ** 2) ** 0.25;
/** Tempo na sequência principal (anos): t ≈ 10¹⁰ (M/M☉)^−2,5. */
export const msLifetime = (M: number) => 1e10 * M ** -2.5;
/** Massa da anã branca final (relação inicial–final de Kalirai et al. 2008). */
export const wdMass = (M: number) => 0.109 * M + 0.394;
/** Raio de uma anã branca (R☉), aproximação R ≈ 0,0126 (M/M☉)^(−1/3). */
export const wdRadius = (Mwd: number) => 0.0126 * Mwd ** (-1 / 3);

export interface TrackNode {
  T: number;
  L: number;
  /** Idade (anos). */
  age: number;
  phase: string;
}

export function remnant(M: number): string {
  if (M < 8) return `anã branca de ${wdMass(M).toFixed(2).replace(".", ",")} M☉`;
  if (M < 25) return "estrela de nêutrons";
  return "buraco negro";
}

/** Trajetória simplificada no diagrama HR para uma estrela de massa M (M☉). */
export function track(M: number): TrackNode[] {
  const L0 = zamsL(M), T0 = zamsT(M), tms = msLifetime(M);
  if (M >= 8) {
    const L1 = 1.5 * L0;
    return [
      { T: T0, L: L0, age: 0, phase: "sequência principal (idade zero)" },
      { T: 0.85 * T0, L: L1, age: tms, phase: "fim da queima de hidrogênio no núcleo" },
      { T: 12000, L: 1.1 * L1, age: 1.05 * tms, phase: "supergiante azul" },
      { T: 3600, L: 1.3 * L1, age: 1.1 * tms, phase: "supergiante vermelha" },
      { T: 3600, L: 1.3 * L1, age: 1.11 * tms, phase: `supernova → ${remnant(M)}` },
    ];
  }
  const low = M < 2.2;
  const L1 = 1.8 * L0;
  const L3 = low ? 2500 : 200 * M * M;
  const L4 = low ? 50 : 0.4 * L3;
  const L6 = 5000 * Math.max(1, M / 1.5);
  const Mwd = wdMass(M), Rwd = wdRadius(Mwd);
  const tPost = tms * 1.33;
  return [
    { T: T0, L: L0, age: 0, phase: "sequência principal (idade zero)" },
    { T: T0 * (M < 1.2 ? 0.97 : 0.9), L: L1, age: tms, phase: "fim da queima de hidrogênio no núcleo" },
    { T: 4900, L: Math.max(1.3 * L1, 2.5), age: 1.1 * tms, phase: "subgigante" },
    { T: 3300, L: L3, age: 1.2 * tms, phase: "gigante vermelha" },
    { T: low ? 5100 : 4600, L: L4, age: 1.21 * tms, phase: "queima de hélio no núcleo" },
    { T: 4300, L: 1.5 * L4, age: 1.3 * tms, phase: "ramo assintótico (AGB)" },
    { T: 3000, L: L6, age: 1.32 * tms, phase: "pulsos térmicos e perda de massa" },
    { T: 100000, L: 0.8 * L6, age: tPost + 3e4, phase: "nebulosa planetária" },
    { T: 30000, L: lumOf(Rwd, 30000), age: tPost + 1e7, phase: `anã branca (${remnant(M)})` },
    { T: 5000, L: lumOf(Rwd, 5000), age: tPost + 1e10, phase: "anã branca esfriando" },
  ];
}

/** Ponto da trajetória para o progresso u ∈ [0, n−1] (interpolação em log T, log L e idade). */
export function trackAt(M: number, u: number) {
  const tr = track(M);
  const k = Math.max(0, Math.min(tr.length - 1, u));
  const i = Math.min(tr.length - 2, Math.floor(k));
  const f = k - i;
  const a = tr[i]!, b = tr[i + 1]!;
  const lt = Math.log10(a.T) + f * (Math.log10(b.T) - Math.log10(a.T));
  const ll = Math.log10(a.L) + f * (Math.log10(b.L) - Math.log10(a.L));
  const T = 10 ** lt, L = 10 ** ll;
  return { T, L, R: radiusOf(L, T), age: a.age + f * (b.age - a.age), phase: f < 0.999 ? a.phase : b.phase, node: i, last: tr.length - 1 };
}

// ---------- Esfera celeste ----------
export interface SkyStar {
  name: string;
  ra: number; // horas
  dec: number; // graus
  mag: number;
  T: number;
}

const S = (name: string, ra: number, dec: number, mag: number, T = 11000): SkyStar => ({ name, ra, dec, mag, T });
export const SKY: SkyStar[] = [
  // Cruzeiro do Sul
  S("Acrux", 12.443, -63.1, 0.77, 25000), S("Mimosa", 12.795, -59.69, 1.25, 27000), S("Gacrux", 12.519, -57.11, 1.64, 3600), S("δ Cru", 12.252, -58.75, 2.79), S("Intrometida", 12.356, -60.4, 3.59, 4500),
  // Centauro (guardas)
  S("Rigil Kentaurus", 14.66, -60.84, -0.27, 5800), S("Hadar", 14.064, -60.37, 0.61, 25000),
  // Triângulo Austral
  S("Atria", 16.811, -69.03, 1.91, 4200), S("β TrA", 15.919, -63.43, 2.85, 7000), S("γ TrA", 15.315, -68.68, 2.89, 9500),
  // Escorpião
  S("Acrab", 16.091, -19.81, 2.62), S("Dschubba", 16.006, -22.62, 2.29), S("π Sco", 15.981, -26.11, 2.89), S("σ Sco", 16.353, -25.59, 2.89), S("Antares", 16.49, -26.43, 1.06, 3600),
  S("τ Sco", 16.598, -28.22, 2.82), S("ε Sco", 16.836, -34.29, 2.29, 4500), S("μ Sco", 16.865, -38.05, 3.0), S("ζ Sco", 16.91, -42.36, 3.6, 4300), S("η Sco", 17.203, -43.24, 3.3, 7000),
  S("Sargas", 17.622, -43.0, 1.86, 7300), S("ι Sco", 17.793, -40.13, 3.0, 7000), S("κ Sco", 17.708, -39.03, 2.4), S("Shaula", 17.56, -37.1, 1.62),
  // Sagitário (bule)
  S("Kaus Australis", 18.403, -34.38, 1.85), S("Kaus Media", 18.35, -29.83, 2.7, 4500), S("Kaus Borealis", 18.466, -25.42, 2.81, 4800), S("Alnasl", 18.097, -30.42, 2.99, 4800),
  S("Nunki", 18.921, -26.3, 2.05), S("φ Sgr", 18.761, -26.99, 3.17), S("Ascella", 19.043, -29.88, 2.6, 9000), S("τ Sgr", 19.116, -27.67, 3.3, 4600),
  // Órion (Três Marias)
  S("Betelgeuse", 5.919, 7.41, 0.5, 3600), S("Rigel", 5.242, -8.2, 0.13, 12000), S("Bellatrix", 5.419, 6.35, 1.64, 22000), S("Saiph", 5.796, -9.67, 2.06, 26000),
  S("Alnitak", 5.679, -1.94, 1.77, 29000), S("Alnilam", 5.604, -1.2, 1.69, 27000), S("Mintaka", 5.533, -0.3, 2.23, 29000), S("Meissa", 5.585, 9.93, 3.39, 35000),
  // Cão Maior
  S("Sírius", 6.752, -16.72, -1.46, 9900), S("Mirzam", 6.378, -17.96, 1.98, 23000), S("Adhara", 6.977, -28.97, 1.5, 22000), S("Wezen", 7.14, -26.39, 1.83, 6000), S("Aludra", 7.402, -29.3, 2.45, 15000),
  // Carina e outras brilhantes
  S("Canopus", 6.399, -52.7, -0.74, 7300), S("Miaplacidus", 9.22, -69.72, 1.68, 9000), S("Avior", 8.375, -59.51, 1.86, 4500),
  S("Achernar", 1.629, -57.24, 0.46, 15000), S("Fomalhaut", 22.961, -29.62, 1.16, 8600), S("Aldebarã", 4.599, 16.51, 0.86, 3900),
  S("Régulo", 10.139, 11.97, 1.35, 12500), S("Arcturus", 14.261, 19.18, -0.05, 4300), S("Spica", 13.42, -11.16, 0.97, 22000), S("Vega", 18.616, 38.78, 0.03, 9600),
  S("Altair", 19.846, 8.87, 0.77, 7700), S("Castor", 7.577, 31.89, 1.58, 10000), S("Pollux", 7.755, 28.03, 1.14, 4600), S("Prócion", 7.655, 5.22, 0.34, 6500),
  S("Capella", 5.278, 46.0, 0.08, 5000), S("Polaris", 2.53, 89.26, 1.98, 6000), S("Antares", 16.49, -26.43, 1.06, 3600),
].filter((s, i, a) => a.findIndex((x) => x.name === s.name) === i);

/** Linhas das constelações (pares de nomes) e rótulo de cada uma (estrela de referência). */
export const LINES: [string, string][] = [
  ["Acrux", "Gacrux"], ["Mimosa", "δ Cru"],
  ["Rigil Kentaurus", "Hadar"],
  ["Atria", "β TrA"], ["β TrA", "γ TrA"], ["γ TrA", "Atria"],
  ["Acrab", "Dschubba"], ["Dschubba", "π Sco"], ["Dschubba", "σ Sco"], ["σ Sco", "Antares"], ["Antares", "τ Sco"], ["τ Sco", "ε Sco"], ["ε Sco", "μ Sco"],
  ["μ Sco", "ζ Sco"], ["ζ Sco", "η Sco"], ["η Sco", "Sargas"], ["Sargas", "ι Sco"], ["ι Sco", "κ Sco"], ["κ Sco", "Shaula"],
  ["Alnasl", "Kaus Media"], ["Kaus Media", "Kaus Australis"], ["Kaus Australis", "Alnasl"], ["Kaus Media", "Kaus Borealis"], ["Kaus Borealis", "φ Sgr"],
  ["φ Sgr", "Nunki"], ["Nunki", "τ Sgr"], ["τ Sgr", "Ascella"], ["Ascella", "φ Sgr"], ["Ascella", "Kaus Australis"],
  ["Betelgeuse", "Alnitak"], ["Bellatrix", "Mintaka"], ["Alnitak", "Alnilam"], ["Alnilam", "Mintaka"], ["Alnitak", "Saiph"], ["Mintaka", "Rigel"], ["Meissa", "Betelgeuse"], ["Meissa", "Bellatrix"],
  ["Sírius", "Mirzam"], ["Sírius", "Wezen"], ["Wezen", "Adhara"], ["Wezen", "Aludra"],
  ["Castor", "Pollux"],
];
export const CONSTELLATIONS: [string, string][] = [
  ["Cruzeiro do Sul", "Acrux"], ["Centauro", "Hadar"], ["Triângulo Austral", "Atria"], ["Escorpião", "Antares"], ["Sagitário", "Kaus Media"],
  ["Órion", "Alnilam"], ["Cão Maior", "Sírius"], ["Carina", "Canopus"], ["Gêmeos", "Castor"],
];

export const OBLIQ = (23.44 * Math.PI) / 180;

/** Ascensão reta do Sol (graus) no dia do ano d (aproximação de órbita circular, equinócio em 20/3). */
export function sunRA(day: number): number {
  const lam = (2 * Math.PI * (day - 80)) / 365.2422;
  const ra = Math.atan2(Math.cos(OBLIQ) * Math.sin(lam), Math.cos(lam));
  return ((ra * 180) / Math.PI + 360) % 360;
}
export function sunDec(day: number): number {
  const lam = (2 * Math.PI * (day - 80)) / 365.2422;
  return (Math.asin(Math.sin(OBLIQ) * Math.sin(lam)) * 180) / Math.PI;
}
/** Tempo sideral local (graus) para hora solar local h no dia d: TSL = α☉ + 15°(h − 12). */
export function lst(day: number, hour: number): number {
  return (((sunRA(day + hour / 24) + 15 * (hour - 12)) % 360) + 360) % 360;
}

/** Altura e azimute (graus; azimute a partir do norte, para leste) de (α em horas, δ em graus). */
export function altAz(raH: number, dec: number, latDeg: number, lstDeg: number) {
  const r = Math.PI / 180;
  const H = (lstDeg - raH * 15) * r, d = dec * r, phi = latDeg * r;
  const east = -Math.cos(d) * Math.sin(H);
  const north = Math.sin(d) * Math.cos(phi) - Math.cos(d) * Math.cos(H) * Math.sin(phi);
  const up = Math.sin(d) * Math.sin(phi) + Math.cos(d) * Math.cos(H) * Math.cos(phi);
  return { alt: Math.asin(Math.max(-1, Math.min(1, up))) / r, az: ((Math.atan2(east, north) / r) + 360) % 360 };
}

/** Distância de grande círculo (km) entre dois pontos (graus). */
export function greatCircle(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const r = Math.PI / 180;
  const c = Math.sin(lat1 * r) * Math.sin(lat2 * r) + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.cos((lon2 - lon1) * r);
  return R_EARTH_KM * Math.acos(Math.max(-1, Math.min(1, c)));
}
