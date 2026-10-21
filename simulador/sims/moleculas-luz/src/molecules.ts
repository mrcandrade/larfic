/**
 * Dados das moléculas: geometria (Å), massas (u), cargas parciais esquemáticas (e),
 * modos normais (número de onda em cm⁻¹, atividade no IV) e bandas eletrônicas (nm).
 *
 * Números de onda: NIST (CCCBDB). Dipolos permanentes em debye. Limiares e bandas UV/visível
 * aproximados (O₂: Schumann–Runge e Herzberg; O₃: Hartley, Huggins, Chappuis; NO₂ → NO + O abaixo de 398 nm).
 * As cargas servem para desenhar o dipolo e para conferir a regra de seleção: um modo é ativo no IV
 * se o dipolo Σ qᵢ rᵢ oscila durante a vibração.
 */

export type V2 = [number, number];

export interface Atom {
  el: "C" | "O" | "N" | "H";
  x: number;
  y: number;
}
export interface Mode {
  name: string;
  /** Número de onda (cm⁻¹). */
  nu: number;
  ir: boolean;
  /** Deslocamentos por átomo (antes de remover o movimento do centro de massa). */
  d: V2[];
  deg?: number;
}
export interface EBand {
  lo: number;
  hi: number;
  /** Probabilidade de absorção por fóton que passa (0–1). */
  p: number;
  dis: boolean;
  label: string;
}
export interface Molecule {
  id: string;
  formula: string;
  name: string;
  atoms: Atom[];
  q: number[];
  bonds: [number, number, number][]; // i, j, ordem
  mu: number; // D
  /** Faixa de absorção rotacional pura (cm⁻¹) e intensidade (0 se apolar). */
  rot: { lo: number; hi: number; p: number; note?: string } | null;
  modes: Mode[];
  elec: EBand[];
  /** Átomo que se separa na dissociação. */
  leaves: number;
}

export const MASS: Record<Atom["el"], number> = { H: 1.008, C: 12.011, N: 14.007, O: 15.999 };
export const RADIUS: Record<Atom["el"], number> = { H: 0.32, C: 0.55, N: 0.52, O: 0.5 };

const unit = (v: V2): V2 => {
  const n = Math.hypot(v[0], v[1]) || 1;
  return [v[0] / n, v[1] / n];
};

/** Modos de uma molécula triangular A–B–A com B no índice 0. */
function bentModes(atoms: Atom[], nus: [number, number, number]): Mode[] {
  const c = atoms[0]!;
  const b1 = unit([atoms[1]!.x - c.x, atoms[1]!.y - c.y]);
  const b2 = unit([atoms[2]!.x - c.x, atoms[2]!.y - c.y]);
  const close = (bi: V2, other: Atom, me: Atom): V2 => {
    const r: V2 = [other.x - me.x, other.y - me.y];
    const k = r[0] * bi[0] + r[1] * bi[1];
    return unit([r[0] - k * bi[0], r[1] - k * bi[1]]);
  };
  return [
    { name: "estiramento simétrico", nu: nus[0], ir: true, d: [[0, 0], b1, b2] },
    { name: "flexão (tesoura)", nu: nus[1], ir: true, d: [[0, 0], close(b1, atoms[2]!, atoms[1]!), close(b2, atoms[1]!, atoms[2]!)] },
    { name: "estiramento assimétrico", nu: nus[2], ir: true, d: [[0, 0], b1, [-b2[0], -b2[1]]] },
  ];
}

const bent = (el0: Atom["el"], el1: Atom["el"], r: number, angDeg: number): Atom[] => {
  const h = ((angDeg / 2) * Math.PI) / 180;
  return [
    { el: el0, x: 0, y: 0 },
    { el: el1, x: -r * Math.sin(h), y: -r * Math.cos(h) },
    { el: el1, x: r * Math.sin(h), y: -r * Math.cos(h) },
  ];
};

const H2O_ATOMS = bent("O", "H", 0.958, 104.5);
const NO2_ATOMS = bent("N", "O", 1.197, 134.1);
const O3_ATOMS = bent("O", "O", 1.278, 116.8);
const A = 0.63; // meia-diagonal da projeção do CH₄ (quadrado)

export const MOLECULES: Molecule[] = [
  {
    id: "CO",
    formula: "CO",
    name: "Monóxido de carbono",
    atoms: [{ el: "C", x: -0.564, y: 0 }, { el: "O", x: 0.564, y: 0 }],
    q: [0.05, -0.05],
    bonds: [[0, 1, 3]],
    mu: 0.11,
    rot: { lo: 3.8, hi: 120, p: 0.25 },
    modes: [{ name: "estiramento", nu: 2143, ir: true, d: [[-1, 0], [1, 0]] }],
    elec: [
      { lo: 100, hi: 112, p: 0.5, dis: true, label: "C + O" },
      { lo: 112, hi: 155, p: 0.5, dis: false, label: "excitação eletrônica" },
    ],
    leaves: 1,
  },
  {
    id: "N2",
    formula: "N₂",
    name: "Nitrogênio",
    atoms: [{ el: "N", x: -0.549, y: 0 }, { el: "N", x: 0.549, y: 0 }],
    q: [0, 0],
    bonds: [[0, 1, 3]],
    mu: 0,
    rot: null,
    modes: [{ name: "estiramento", nu: 2331, ir: false, d: [[-1, 0], [1, 0]] }],
    elec: [],
    leaves: 1,
  },
  {
    id: "O2",
    formula: "O₂",
    name: "Oxigênio",
    atoms: [{ el: "O", x: -0.604, y: 0 }, { el: "O", x: 0.604, y: 0 }],
    q: [0, 0],
    bonds: [[0, 1, 2]],
    mu: 0,
    rot: { lo: 1.8, hi: 4.2, p: 0.05, note: "fraca, por dipolo magnético (60 e 118 GHz)" },
    modes: [{ name: "estiramento", nu: 1556, ir: false, d: [[-1, 0], [1, 0]] }],
    elec: [
      { lo: 100, hi: 175, p: 0.8, dis: true, label: "O + O" },
      { lo: 175, hi: 242, p: 0.08, dis: true, label: "O + O" },
    ],
    leaves: 1,
  },
  {
    id: "H2O",
    formula: "H₂O",
    name: "Água",
    atoms: H2O_ATOMS,
    q: [-0.66, 0.33, 0.33],
    bonds: [[0, 1, 1], [0, 2, 1]],
    mu: 1.85,
    rot: { lo: 0.3, hi: 650, p: 0.85 },
    modes: bentModes(H2O_ATOMS, [3657, 1595, 3756]),
    elec: [{ lo: 100, hi: 190, p: 0.8, dis: true, label: "H + OH" }],
    leaves: 2,
  },
  {
    id: "CO2",
    formula: "CO₂",
    name: "Dióxido de carbono",
    atoms: [{ el: "C", x: 0, y: 0 }, { el: "O", x: -1.16, y: 0 }, { el: "O", x: 1.16, y: 0 }],
    q: [0.6, -0.3, -0.3],
    bonds: [[0, 1, 2], [0, 2, 2]],
    mu: 0,
    rot: null,
    modes: [
      { name: "estiramento simétrico", nu: 1333, ir: false, d: [[0, 0], [-1, 0], [1, 0]] },
      { name: "flexão", nu: 667, ir: true, d: [[0, 0], [0, -1], [0, -1]], deg: 2 },
      { name: "estiramento assimétrico", nu: 2349, ir: true, d: [[0, 0], [1, 0], [1, 0]] },
    ],
    elec: [{ lo: 100, hi: 200, p: 0.6, dis: true, label: "CO + O" }],
    leaves: 2,
  },
  {
    id: "CH4",
    formula: "CH₄",
    name: "Metano",
    atoms: [{ el: "C", x: 0, y: 0 }, { el: "H", x: A, y: A }, { el: "H", x: -A, y: A }, { el: "H", x: A, y: -A }, { el: "H", x: -A, y: -A }],
    q: [-0.4, 0.1, 0.1, 0.1, 0.1],
    bonds: [[0, 1, 1], [0, 2, 1], [0, 3, 1], [0, 4, 1]],
    mu: 0,
    rot: null,
    modes: [
      { name: "estiramento simétrico", nu: 2917, ir: false, d: [[0, 0], [1, 1], [-1, 1], [1, -1], [-1, -1]] },
      { name: "flexão simétrica", nu: 1534, ir: false, d: [[0, 0], [-1, 0], [1, 0], [1, 0], [-1, 0]], deg: 2 },
      { name: "estiramento assimétrico", nu: 3019, ir: true, d: [[0, 0], [1, 1], [-1, 1], [-1, 1], [1, 1]], deg: 3 },
      { name: "flexão assimétrica (guarda-chuva)", nu: 1306, ir: true, d: [[0, 0], [0, -1], [0, -1], [0, -1], [0, -1]], deg: 3 },
    ],
    elec: [{ lo: 100, hi: 145, p: 0.8, dis: true, label: "CH₃ + H" }],
    leaves: 4,
  },
  {
    id: "NO2",
    formula: "NO₂",
    name: "Dióxido de nitrogênio",
    atoms: NO2_ATOMS,
    q: [0.4, -0.2, -0.2],
    bonds: [[0, 1, 2], [0, 2, 1]],
    mu: 0.316,
    rot: { lo: 0.5, hi: 80, p: 0.5 },
    modes: bentModes(NO2_ATOMS, [1318, 750, 1618]),
    elec: [
      { lo: 100, hi: 398, p: 0.7, dis: true, label: "NO + O" },
      { lo: 398, hi: 650, p: 0.5, dis: false, label: "excitação eletrônica (gás castanho)" },
    ],
    leaves: 2,
  },
  {
    id: "O3",
    formula: "O₃",
    name: "Ozônio",
    atoms: O3_ATOMS,
    q: [0.2, -0.1, -0.1],
    bonds: [[0, 1, 2], [0, 2, 1]],
    mu: 0.53,
    rot: { lo: 0.5, hi: 100, p: 0.7 },
    modes: bentModes(O3_ATOMS, [1103, 701, 1042]),
    elec: [
      { lo: 100, hi: 200, p: 0.5, dis: true, label: "O₂ + O" },
      { lo: 200, hi: 310, p: 0.9, dis: true, label: "O₂ + O (banda de Hartley)" },
      { lo: 310, hi: 360, p: 0.2, dis: true, label: "O₂ + O (banda de Huggins)" },
      { lo: 450, hi: 750, p: 0.08, dis: true, label: "O₂ + O (banda de Chappuis)" },
    ],
    leaves: 2,
  },
];

/** Centro de massa. */
export function com(m: Molecule): V2 {
  let M = 0, x = 0, y = 0;
  for (const a of m.atoms) {
    const w = MASS[a.el];
    M += w; x += w * a.x; y += w * a.y;
  }
  return [x / M, y / M];
}

/** Deslocamentos do modo com o centro de massa parado (normalizados ao maior deslocamento = 1). */
export function modeDisp(m: Molecule, k: number): V2[] {
  const mode = m.modes[k]!;
  let M = 0, cx = 0, cy = 0;
  m.atoms.forEach((a, i) => {
    const w = MASS[a.el];
    M += w; cx += w * mode.d[i]![0]; cy += w * mode.d[i]![1];
  });
  const d = mode.d.map(([x, y]): V2 => [x - cx / M, y - cy / M]);
  const mx = Math.max(...d.map(([x, y]) => Math.hypot(x, y)), 1e-12);
  return d.map(([x, y]) => [x / mx, y / mx]);
}

/** Variação do dipolo (e·Å por unidade de deslocamento) no modo k: dμ = Σ qᵢ dᵢ. */
export function dipoleChange(m: Molecule, k: number): V2 {
  const d = modeDisp(m, k);
  let x = 0, y = 0;
  m.q.forEach((q, i) => {
    x += q * d[i]![0];
    y += q * d[i]![1];
  });
  return [x, y];
}

/** Dipolo permanente pelas cargas (e·Å), em relação ao centro de massa. */
export function staticDipole(m: Molecule): V2 {
  const [cx, cy] = com(m);
  let x = 0, y = 0;
  m.atoms.forEach((a, i) => {
    x += m.q[i]! * (a.x - cx);
    y += m.q[i]! * (a.y - cy);
  });
  return [x, y];
}
