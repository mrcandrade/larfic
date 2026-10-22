/**
 * Física da sim de elasticidade: materiais isotrópicos (E, ν → G, K), curva
 * tensão × deformação de engenharia com escoamento, encruamento, estricção e
 * ruptura, e a mesa de quatro pernas (estrutura estaticamente indeterminada).
 */

export interface Material {
  nome: string;
  /** Módulo de Young (Pa). */
  E: number;
  /** Coeficiente de Poisson. */
  nu: number;
  /** Limite elástico (escoamento), Pa. Igual a su nos materiais frágeis. */
  sy: number;
  /** Limite de resistência (tensão máxima de engenharia), Pa. */
  su: number;
  /** Deformação no início da estricção (tensão máxima). */
  eu: number;
  /** Deformação na ruptura. */
  er: number;
  /** Limite de cisalhamento (Pa). */
  tauLim: number;
  tipo: "ductil" | "fragil" | "borracha";
}

const GPa = 1e9, MPa = 1e6;

function ductil(nome: string, E: number, nu: number, sy: number, su: number, eu: number, er: number): Material {
  return { nome, E: E * GPa, nu, sy: sy * MPa, su: su * MPa, eu, er, tauLim: (sy * MPa) / Math.sqrt(3), tipo: "ductil" };
}
function fragil(nome: string, E: number, nu: number, su: number): Material {
  const e = (su * MPa) / (E * GPa);
  return { nome, E: E * GPa, nu, sy: su * MPa, su: su * MPa, eu: e, er: e, tauLim: su * MPa, tipo: "fragil" };
}

/** Borracha natural, modelo neo-hookeano: G = 1 MPa, quase incompressível. */
const G_BORRACHA = 1.0 * MPa;
const NU_BORRACHA = 0.4998;
const ER_BORRACHA = 5;
const borracha: Material = {
  nome: "Borracha natural",
  E: 2 * G_BORRACHA * (1 + NU_BORRACHA),
  nu: NU_BORRACHA,
  sy: G_BORRACHA * (1 + ER_BORRACHA - 1 / (1 + ER_BORRACHA) ** 2),
  su: G_BORRACHA * (1 + ER_BORRACHA - 1 / (1 + ER_BORRACHA) ** 2),
  eu: ER_BORRACHA,
  er: ER_BORRACHA,
  tauLim: 2 * MPa,
  tipo: "borracha",
};

/** Valores típicos de catálogo (ordens de grandeza corretas; cada liga real varia). */
export const MATERIAIS: Material[] = [
  ductil("Aço estrutural (ASTM A36)", 200, 0.29, 250, 400, 0.15, 0.23),
  ductil("Alumínio 6061-T6", 69, 0.33, 276, 310, 0.08, 0.12),
  ductil("Cobre recozido", 117, 0.34, 70, 220, 0.3, 0.45),
  ductil("Titânio Ti-6Al-4V", 114, 0.34, 880, 950, 0.1, 0.14),
  ductil("Osso cortical", 17, 0.3, 115, 130, 0.022, 0.03),
  fragil("Concreto (tração)", 30, 0.2, 3),
  fragil("Vidro comum", 70, 0.22, 50),
  borracha,
];

export const material = (i: number) => MATERIAIS[Math.max(0, Math.min(MATERIAIS.length - 1, Math.round(i)))]!;

/** Módulo de cisalhamento de um sólido isotrópico: G = E / [2(1 + ν)]. */
export const moduloG = (m: Material) => m.E / (2 * (1 + m.nu));
/** Módulo volumétrico de um sólido isotrópico: K = E / [3(1 − 2ν)]. */
export const moduloK = (m: Material) => m.E / (3 * (1 - 2 * m.nu));
/** Deformação no limite elástico. */
export const epsY = (m: Material) => m.sy / m.E;

/**
 * Tensão de engenharia na curva de carregamento monotônico (Pa) para a deformação ε.
 * Dúctil: reta de Hooke até σ_y, encruamento exponencial até σ_u em ε_u,
 * queda parabólica (estricção) até 0,8 σ_u na ruptura. Frágil: reta até romper.
 * Borracha: neo-hookeana, σ = G (λ − 1/λ²), λ = 1 + ε.
 */
export function sigmaCurva(m: Material, e: number): number {
  if (e <= 0) return m.E * e;
  if (m.tipo === "borracha") {
    const l = 1 + e;
    return moduloG(m) * (l - 1 / (l * l));
  }
  const ey = epsY(m);
  if (m.tipo === "fragil" || e <= ey) return m.E * e;
  if (e <= m.eu) {
    const e0 = (m.eu - ey) / 3;
    return m.sy + ((m.su - m.sy) * (1 - Math.exp(-(e - ey) / e0))) / (1 - Math.exp(-3));
  }
  const f = Math.min(1, (e - m.eu) / (m.er - m.eu));
  return m.su - 0.2 * m.su * f * f;
}

/** Deformação permanente depois de chegar a ε_max e descarregar (descarga elástica com inclinação E). */
export function epsPermanente(m: Material, emax: number): number {
  if (m.tipo !== "ductil" || emax <= epsY(m)) return 0;
  return emax - sigmaCurva(m, emax) / m.E;
}

/** Tensão para deformação ε com histórico ε_max (descarga e recarga elásticas abaixo de ε_max). */
export function sigmaHist(m: Material, e: number, emax: number): number {
  if (m.tipo !== "ductil" || e >= emax) return sigmaCurva(m, e);
  return Math.max(0, m.E * (e - epsPermanente(m, emax)));
}

/**
 * Deformação lateral (Poisson). Na parte elástica ε_lat = −ν σ/E; a parte
 * plástica conserva volume (ν efetivo 0,5). Na borracha, incompressível:
 * d' = d/√λ.
 */
export function epsLateral(m: Material, e: number, emax: number): number {
  if (m.tipo === "borracha") return 1 / Math.sqrt(1 + e) - 1;
  const s = sigmaHist(m, e, emax);
  const ee = s / m.E;
  return -m.nu * ee - 0.5 * Math.max(0, e - ee);
}

/** Taxas de deformação (1/s) para um ensaio de duração T: trecho elástico em 30% e plástico em 70% do tempo. */
export function taxas(m: Material, T: number): { elastica: number; plastica: number } {
  if (m.tipo !== "ductil") return { elastica: m.er / T, plastica: m.er / T };
  const ey = epsY(m);
  return { elastica: ey / (0.3 * T), plastica: (m.er - ey) / (0.7 * T) };
}

// ------------------------------------------------------------------ mesa de quatro pernas

export interface Mesa {
  /** Posições (x, y) das pernas (m), em torno do centro do tampo. */
  pernas: [number, number][];
  /** Folga de cada perna (m): quanto ela é mais curta que a nominal. */
  folga: number[];
  /** Rigidez axial de cada perna k = EA/L (N/m). */
  k: number[];
}

export interface Solucao {
  /** Força de compressão em cada perna (N). */
  F: number[];
  /** Encurtamento elástico de cada perna (m). */
  u: number[];
  /** Plano do tampo: altura (deslocamento para baixo) h(x, y) = h0 + ax·x + ay·y (m). */
  h0: number;
  ax: number;
  ay: number;
  contato: boolean[];
}

function resolve3(M: number[][], r: number[]): number[] | null {
  const [a, b, c] = M as [number[], number[], number[]];
  const det = (m: number[][]) =>
    m[0]![0]! * (m[1]![1]! * m[2]![2]! - m[1]![2]! * m[2]![1]!) -
    m[0]![1]! * (m[1]![0]! * m[2]![2]! - m[1]![2]! * m[2]![0]!) +
    m[0]![2]! * (m[1]![0]! * m[2]![1]! - m[1]![1]! * m[2]![0]!);
  const D = det([a, b, c]);
  if (Math.abs(D) < 1e-300) return null;
  const col = (j: number) => [a, b, c].map((row, i) => row.map((v, k) => (k === j ? r[i]! : v)));
  return [det(col(0)) / D, det(col(1)) / D, det(col(2)) / D];
}

/**
 * Tampo rígido apoiado em pernas elásticas que só empurram (contato unilateral).
 * O tampo desce w(x, y) = h0 + ax·x + ay·y; a perna i encurta u_i = w_i − folga_i
 * se isso for positivo. Equilíbrio: Σ F = W, Σ F x = W xw, Σ F y = W yw.
 * Testa os conjuntos de pernas em contato (as quatro, depois cada trinca) e
 * escolhe o que respeita u ≥ 0 nas pernas ativas e u ≤ 0 nas outras.
 */
export function resolveMesa(mesa: Mesa, W: number, xw: number, yw: number): Solucao {
  const n = mesa.pernas.length;
  const conjuntos: number[][] = [[0, 1, 2, 3]];
  for (let i = n - 1; i >= 0; i--) conjuntos.push([0, 1, 2, 3].filter((j) => j !== i));
  let melhor: Solucao | null = null, violMelhor = Infinity;
  for (const S of conjuntos) {
    // incógnitas c = (h0, ax, ay); F_i = k_i (c·φ_i − folga_i), φ_i = (1, x_i, y_i)
    const M = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    const r = [W, W * xw, W * yw];
    for (const i of S) {
      const [x, y] = mesa.pernas[i]!;
      const phi = [1, x, y];
      const k = mesa.k[i]!;
      for (let a = 0; a < 3; a++) {
        for (let b = 0; b < 3; b++) M[a]![b]! += k * phi[a]! * phi[b]!;
        r[a]! += k * mesa.folga[i]! * phi[a]!;
      }
    }
    const c = resolve3(M, r);
    if (!c) continue;
    const u = mesa.pernas.map(([x, y], i) => c[0]! + c[1]! * x + c[2]! * y - mesa.folga[i]!);
    const escala = Math.max(1e-12, ...u.map(Math.abs));
    let viol = 0;
    for (let i = 0; i < n; i++) {
      if (S.includes(i)) viol += Math.max(0, -u[i]!);
      else viol += Math.max(0, u[i]!);
    }
    const sol: Solucao = {
      u: u.map((v, i) => (S.includes(i) ? Math.max(0, v) : 0)),
      F: u.map((v, i) => (S.includes(i) && v > 1e-12 * escala ? mesa.k[i]! * v : 0)),
      h0: c[0]!,
      ax: c[1]!,
      ay: c[2]!,
      contato: mesa.pernas.map((_, i) => S.includes(i) && u[i]! > -1e-12 * escala),
    };
    if (viol <= 1e-9 * escala) return sol;
    if (viol < violMelhor) {
      violMelhor = viol;
      melhor = sol;
    }
  }
  return melhor ?? { F: [0, 0, 0, 0], u: [0, 0, 0, 0], h0: 0, ax: 0, ay: 0, contato: [false, false, false, false] };
}

/** Peso a partir do qual a perna mais curta (folga δ, na diagonal oposta à carga central) toca o chão: W* = k δ. */
export const pesoContato = (k: number, delta: number) => k * delta;
