import { clamp, num, type Params } from "@fisilab/core";

export const K_E = 8.9875e9;
export const NANO = 1e-9;

// ------------------------------------------------------------------ hóquei elétrico

/** Campo de jogo (m) e disco. */
export const CAMPO = { w: 1.6, h: 1.0 };
export const DISCO = { x0: 0.15, y0: 0.5, m: 1e-3, raio: 0.02 };
/** Raio de amolecimento das cargas (m): evita a singularidade 1/r². */
export const R_SUAVE = 0.03;

export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface Fase {
  gol: Rect;
  obst: Rect[];
}

export const FASES_HOQUEI: Fase[] = [
  { gol: { x0: 1.45, y0: 0.42, x1: 1.56, y1: 0.58 }, obst: [] },
  { gol: { x0: 1.45, y0: 0.42, x1: 1.56, y1: 0.58 }, obst: [{ x0: 0.75, y0: 0.3, x1: 0.8, y1: 1.0 }] },
  {
    gol: { x0: 1.45, y0: 0.42, x1: 1.56, y1: 0.58 },
    obst: [
      { x0: 0.6, y0: 0, x1: 0.65, y1: 0.68 },
      { x0: 1.05, y0: 0.32, x1: 1.1, y1: 1.0 },
    ],
  },
  {
    gol: { x0: 0.86, y0: 0.41, x1: 0.94, y1: 0.5 },
    obst: [
      { x0: 0.8, y0: 0.35, x1: 0.83, y1: 0.62 },
      { x0: 0.97, y0: 0.35, x1: 1.0, y1: 0.62 },
      { x0: 0.8, y0: 0.35, x1: 1.0, y1: 0.38 },
    ],
  },
];

export interface Carga {
  x: number;
  y: number;
  /** Carga em nC. */
  q: number;
}

/** Força elétrica (N) sobre o disco de carga Q (nC) em (x, y). */
export function forcaEletrica(cargas: Carga[], Q: number, x: number, y: number): [number, number] {
  let fx = 0, fy = 0;
  for (const c of cargas) {
    const dx = x - c.x, dy = y - c.y;
    const r2 = dx * dx + dy * dy + R_SUAVE * R_SUAVE;
    const f = (K_E * c.q * Q * NANO * NANO) / (r2 * Math.sqrt(r2));
    fx += f * dx;
    fy += f * dy;
  }
  return [fx, fy];
}

/** Energia potencial elétrica do disco (J), com o mesmo amolecimento. */
export const potencial = (cargas: Carga[], Q: number, x: number, y: number) =>
  cargas.reduce((a, c) => a + (K_E * c.q * Q * NANO * NANO) / Math.hypot(x - c.x, y - c.y, R_SUAVE), 0);

export const dentro = (r: Rect, x: number, y: number, m = 0) => x >= r.x0 - m && x <= r.x1 + m && y >= r.y0 - m && y <= r.y1 + m;

// ------------------------------------------------------------------ módulo lunar

export const PLANETAS = [
  { value: 1.62, label: "Lua (1,62 m/s²)" },
  { value: 3.71, label: "Marte (3,71 m/s²)" },
  { value: 9.81, label: "Terra (9,81 m/s²)" },
];
export const MODULO = { mSeca: 1000, vEx: 3000, altura: 8, largura: 8 };
export const MUNDO_L = { w: 400, h: 260 };
export const PISTAS = [
  { x0: 160, x1: 240 },
  { x0: 300, x1: 340 },
  { x0: 88, x1: 113 },
];
/** Limites para um pouso seguro. */
export const POUSO = { vy: 2, vx: 1, ang: (10 * Math.PI) / 180 };

const relevo = (x: number) => 40 + 22 * Math.sin(x / 37) + 12 * Math.sin(x / 13 + 1) + 6 * Math.sin(x / 5.3);

/** Altura do solo (m) em x; a pista é plana e lisa. */
export function terreno(x: number, nivel: number): number {
  const pista = PISTAS[nivel] ?? PISTAS[0]!;
  const yp = relevo((pista.x0 + pista.x1) / 2);
  if (x >= pista.x0 && x <= pista.x1) return yp;
  const dist = x < pista.x0 ? pista.x0 - x : x - pista.x1;
  const u = clamp(dist / 12, 0, 1);
  const montanha = nivel === 2 ? 70 * Math.exp(-(((dist - 25) / 12) ** 2)) : 0;
  return yp + (relevo(x) - yp) * u + montanha;
}

export interface Modulo {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ang: number;
  comb: number;
}

/** Derivadas do módulo: empuxo T (N) na direção do ângulo (0 = para cima, positivo inclina para +x). */
export function derivModulo(s: Modulo, T: number, g: number) {
  const empuxo = s.comb > 0 ? T : 0;
  const m = MODULO.mSeca + s.comb;
  return { ax: (empuxo * Math.sin(s.ang)) / m, ay: (empuxo * Math.cos(s.ang)) / m - g, dm: -empuxo / MODULO.vEx };
}

/** Distância de frenagem com empuxo máximo constante: v²/(2(T/m − g)). */
export const distFrenagem = (v: number, aT: number, g: number) => (aT > g ? (v * v) / (2 * (aT - g)) : Infinity);

/** Piloto automático: empuxo e ângulo para levar o módulo à pista com descida controlada. */
export function piloto(s: Modulo, nivel: number, g: number, Tmax: number) {
  const pista = PISTAS[nivel] ?? PISTAS[0]!;
  const alvo = (pista.x0 + pista.x1) / 2;
  const solo = terreno(alvo, nivel);
  const h = s.y - solo;
  const m = MODULO.mSeca + s.comb;
  const longe = Math.abs(alvo - s.x) > (pista.x1 - pista.x0) / 4;
  // mantém altura enquanto está longe da pista (e acima das montanhas)
  const vyDes = longe ? clamp(0.5 * (solo + 90 - s.y), -3, 3) : -(0.8 + 0.25 * Math.sqrt(Math.max(0, h)));
  const vxDes = clamp(0.08 * (alvo - s.x), -12, 12);
  const ax = 0.6 * (vxDes - s.vx);
  const ay = g + 1.2 * (vyDes - s.vy);
  let ang = Math.atan2(ax, Math.max(0.1, ay));
  ang = clamp(ang, -0.5, 0.5);
  if (h < 6) ang = clamp(ang, -0.08, 0.08);
  const T = clamp((m * Math.max(0, ay)) / Math.cos(ang), 0, Tmax);
  return { T, ang };
}

// ------------------------------------------------------------------ labirinto

export const LABIRINTOS = [
  ["##########", "#S.......#", "#........#", "#..####..#", "#..#..#..#", "#..#G.#..#", "#..#..#..#", "#..##.#..#", "#........#", "##########"],
  ["##########", "#S#......#", "#.#.####.#", "#.#.#..#.#", "#...#.##.#", "#####.#..#", "#.....#.##", "#.#####..#", "#......#G#", "##########"],
];
export const RAIO_PART = 0.22;

/** Célula (coluna, linha) → caractere; y do mundo cresce para cima (linha 0 em cima). */
export function celula(nivel: number, x: number, y: number): string {
  const lab = LABIRINTOS[nivel] ?? LABIRINTOS[0]!;
  const col = Math.floor(x);
  const lin = 9 - Math.floor(y);
  return lab[lin]?.[col] ?? "#";
}

export function achar(nivel: number, ch: string): [number, number] {
  const lab = LABIRINTOS[nivel] ?? LABIRINTOS[0]!;
  for (let l = 0; l < lab.length; l++) {
    const c = lab[l]!.indexOf(ch);
    if (c >= 0) return [c + 0.5, 9 - l + 0.5];
  }
  return [1.5, 8.5];
}

/** O disco de raio r em (x, y) toca alguma parede? */
export function bateu(nivel: number, x: number, y: number, r = RAIO_PART): boolean {
  for (let cx = Math.floor(x - r); cx <= Math.floor(x + r); cx++)
    for (let cy = Math.floor(y - r); cy <= Math.floor(y + r); cy++) {
      if (celula(nivel, cx + 0.5, cy + 0.5) !== "#") continue;
      const px = clamp(x, cx, cx + 1);
      const py = clamp(y, cy, cy + 1);
      if ((x - px) ** 2 + (y - py) ** 2 < r * r) return true;
    }
  return false;
}

export const jogo = (p: Params) => Math.round(num(p, "jogo"));
export const nivelDe = (p: Params) => Math.round(num(p, "nivel"));
