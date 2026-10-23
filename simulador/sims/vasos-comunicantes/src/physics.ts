import { num, type Params } from "@fisilab/core";

export const G = 9.81;
export const RHO = 1000;
export const P0 = 101_325;
/** Pressão de vapor da água a 20 °C (Pa). */
export const P_VAPOR = 2_340;

// ------------------------------------------------------------------ vasos comunicantes

/** Profundidade (para dentro da tela) dos vasos 2D (m). */
export const PROF = 0.05;
export const H_VASO = 0.5;
/** Resistência hidráulica de cada ramal até o tubo de ligação (Pa·s/m³). */
export const R_RAMAL = 5e6;

/** Formatos dos vasos: largura horizontal (m) e deslocamento do centro (m) em função da altura y. */
export const VASOS = [
  { nome: "cilindro", w: (_y: number) => 0.08, dx: (_y: number) => 0 },
  { nome: "funil", w: (y: number) => 0.03 + 0.3 * y, dx: (_y: number) => 0 },
  { nome: "inclinado", w: (_y: number) => 0.03, dx: (y: number) => 0.4 * y },
  { nome: "bulbo", w: (y: number) => 0.04 + 0.1 * Math.sin((Math.PI * y) / H_VASO) ** 2, dx: (_y: number) => 0 },
];
export const X_VASOS = [0.1, 0.38, 0.62, 0.95];

const N_TAB = 1000;
/** Volume acumulado (m³) de cada vaso em N_TAB + 1 alturas igualmente espaçadas (regra do trapézio fina). */
const TABELAS = VASOS.map((v) => {
  const t = [0];
  const dy = H_VASO / N_TAB;
  for (let k = 1; k <= N_TAB; k++) t.push(t[k - 1]! + v.w((k - 0.5) * dy) * dy * PROF);
  return t;
});

/** Volume (m³) no vaso i com nível h. */
export function volumeVaso(i: number, h: number): number {
  const t = TABELAS[i]!;
  const u = (Math.max(0, Math.min(h, H_VASO)) / H_VASO) * N_TAB;
  const k = Math.min(N_TAB - 1, Math.floor(u));
  return t[k]! + (t[k + 1]! - t[k]!) * (u - k);
}

/** Nível (m) a partir do volume (inversa da tabela, linear por partes). */
export function nivelVaso(i: number, V: number): number {
  const t = TABELAS[i]!;
  if (V <= 0) return 0;
  if (V >= t[N_TAB]!) return H_VASO;
  let lo = 0, hi = N_TAB;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (t[mid]! < V) lo = mid;
    else hi = mid;
  }
  return ((lo + (V - t[lo]!) / (t[hi]! - t[lo]!)) * H_VASO) / N_TAB;
}

/** Nível comum de equilíbrio para um volume total. */
export function nivelComum(Vtot: number): number {
  let lo = 0, hi = H_VASO;
  for (let k = 0; k < 60; k++) {
    const mid = (lo + hi) / 2;
    const V = VASOS.reduce((a, _, i) => a + volumeVaso(i, mid), 0);
    if (V < Vtot) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Vazões (m³/s) para dentro de cada vaso: a pressão no tubo de ligação faz Σ Q = 0. */
export function vazoesVasos(h: number[]): number[] {
  const P = h.reduce((a, x) => a + RHO * G * x, 0) / h.length; // ramais iguais
  return h.map((x) => (P - RHO * G * x) / R_RAMAL);
}

// ------------------------------------------------------------------ tubo em U

export const LIQUIDOS_U = [
  { value: 0, label: "Água + óleo (900 kg/m³)", rhoA: 1000, rhoB: 900 },
  { value: 1, label: "Água + querosene (800 kg/m³)", rhoA: 1000, rhoB: 800 },
  { value: 2, label: "Água + álcool (790 kg/m³)", rhoA: 1000, rhoB: 790 },
  { value: 3, label: "Mercúrio + água", rhoA: 13_600, rhoB: 1000 },
];
/** Distância entre os braços e altura inicial do líquido A em cada braço (m). */
export const U = { base: 0.3, hA: 0.2, alto: 0.6 };

/**
 * Equilíbrio do tubo em U (seção constante): coluna LB do líquido B no braço esquerdo.
 * Igualdade de pressões no nível da interface: ρB g LB = ρA g (zr − zi).
 */
export function equilibrioU(rhoA: number, rhoB: number, LB: number) {
  const soma = 2 * U.hA; // zi + zr (volume de A conservado)
  const dz = (rhoB * LB) / rhoA;
  const zi = (soma - dz) / 2;
  const zr = zi + dz;
  return { zi, zr, topoB: zi + LB, dh: zi + LB - zr };
}

// ------------------------------------------------------------------ paradoxo hidrostático

export const BASE_PARADOXO = 0.1;
export const PARADOXO = [
  { nome: "cilindro", w: (_y: number) => 0.1, dx: (_y: number) => 0 },
  { nome: "alargado", w: (y: number) => 0.1 + 0.8 * y, dx: (_y: number) => 0 },
  { nome: "gargalo", w: (y: number) => (y < 0.06 ? 0.1 : 0.025), dx: (_y: number) => 0 },
  { nome: "inclinado", w: (_y: number) => 0.1, dx: (y: number) => 0.5 * y },
];
/** Profundidade dos vasos do paradoxo (m): área do fundo = 0,1 × 0,1 m². */
export const PROF_PARADOXO = 0.1;

export function pesoAgua(i: number, h: number, rho = RHO): number {
  const v = PARADOXO[i]!;
  const n = 400;
  let s = 0;
  for (let k = 0; k < n; k++) s += v.w(((k + 0.5) * h) / n);
  return (rho * G * PROF_PARADOXO * s * h) / n;
}

export const forcaFundo = (h: number, rho = RHO) => rho * G * h * BASE_PARADOXO * PROF_PARADOXO;

// ------------------------------------------------------------------ ludião

export const LUDIAO = {
  /** Volume do vidro (m³) e do ar dentro dele na superfície, à pressão atmosférica (m³). */
  Vg: 1.0e-6,
  Va0: 3.0e-6,
  /** Fração de Va0 que equilibra o peso: massa = ρ (Vg + f Va0). */
  f: 0.97,
  /** Altura da água na garrafa (m) e comprimento do ludião (m). */
  agua: 0.28,
  comp: 0.03,
  /** Área frontal (m²) e coeficiente de arrasto. */
  area: 1.5e-4,
  Cd: 1.0,
};
export const massaLudiao = () => RHO * (LUDIAO.Vg + LUDIAO.f * LUDIAO.Va0);

/** Volume de ar (m³) no ludião com a interface ar–água na profundidade d e aperto Δp (Boyle, isotérmico). */
export const volumeAr = (d: number, dp: number) => (P0 * LUDIAO.Va0) / (P0 + dp + RHO * G * Math.max(0, d));

/** Força resultante para cima (N): empuxo − peso. */
export const forcaLudiao = (d: number, dp: number) => RHO * G * (LUDIAO.Vg + volumeAr(d, dp)) - massaLudiao() * G;

/** Profundidade de equilíbrio (instável): empuxo = peso. Negativa: afunda já na superfície. */
export const profEquilibrio = (dp: number) => (P0 / LUDIAO.f - P0 - dp) / (RHO * G);

// ------------------------------------------------------------------ fonte de Heron

export const HERON = {
  /** Nível da água na bacia superior A (constante: o jato devolve a água), bico do jato. */
  zA: 0.78,
  zBico: 0.82,
  /** Câmaras B (meio) e C (baixo): fundo, topo e área da seção (m²). */
  B: { y0: 0.42, y1: 0.68 },
  C: { y0: 0, y1: 0.3 },
  area: 0.004,
  /** Resistência do tubo A → C (Pa·s/m³). */
  R1: 2e7,
};

/** Pressão manométrica do ar (Pa), vazão (m³/s) e altura do jato (m) para os níveis zB e zC. */
export function heron(zB: number, zC: number, dBico_mm: number) {
  const a = (Math.PI * (dBico_mm / 1000) ** 2) / 4;
  const pMax = RHO * G * (HERON.zA - zC);
  const jato = (pg: number) => Math.max(0, pg - RHO * G * (HERON.zBico - zB));
  const Qjato = (pg: number) => (zB > HERON.B.y0 + 1e-4 ? a * Math.sqrt((2 * jato(pg)) / RHO) : 0);
  // Q1(pg) decresce e Qjato(pg) cresce: bissecção em pg
  let lo = 0, hi = Math.max(0, pMax);
  for (let k = 0; k < 60; k++) {
    const pg = (lo + hi) / 2;
    if ((pMax - pg) / HERON.R1 > Qjato(pg)) lo = pg;
    else hi = pg;
  }
  const pg = (lo + hi) / 2;
  const Q = Qjato(pg);
  return { pg, Q, hJato: Q > 0 ? jato(pg) / (RHO * G) : 0 };
}

// ------------------------------------------------------------------ nível

/** Deslocamento da bolha (m) num tubo curvo de raio R inclinado de θ: s = R θ. */
export const bolha = (R: number, theta: number) => R * theta;

// ------------------------------------------------------------------ bombas

export const ATMOSFERAS = [
  { value: 101.325, label: "Nível do mar (101,3 kPa)" },
  { value: 70.1, label: "3000 m de altitude (70,1 kPa)" },
  { value: 0.61, label: "Marte (0,61 kPa)" },
];
/** Altura máxima de sucção: (p0 − p_vapor)/(ρ g). */
export const hMaxSuccao = (p0: number) => Math.max(0, (p0 - Math.min(P_VAPOR, p0)) / (RHO * G));

export const BOMBA = { curso: 0.2, Acil: 0.005, Apipe: 0.0005 };

// ------------------------------------------------------------------ barril de Pascal

export const BARRIL = { altura: 1, area: 0.25 };
export const forcaTampa = (h: number) => RHO * G * h * BARRIL.area;
export const massaTubo = (h: number, d_mm: number) => (RHO * Math.PI * (d_mm / 1000) ** 2 * h) / 4;

export const modo = (p: Params) => Math.round(num(p, "modo"));
