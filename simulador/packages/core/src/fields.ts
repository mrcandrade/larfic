/**
 * Utilidades de campos escalares e vetoriais em 2D, reaproveitáveis por
 * várias sims (eletrostática, gravitação, escoamento potencial, calor...):
 *
 * - campo e potencial de cargas pontuais (lei de Coulomb, superposição);
 * - traçado de linhas de campo com Runge–Kutta de passo adaptativo
 *   (Dormand–Prince 5(4)), com sementes em volta das cargas em número
 *   proporcional a |q|, parando em cargas, na borda ou em pontos de campo nulo;
 * - curvas de nível (equipotenciais) por marching squares sobre uma grade;
 * - solver de Laplace/Poisson por sobre-relaxação sucessiva (SOR) com pontos
 *   fixos (condutores) e borda aterrada ou isolada.
 *
 * Todas as funções são puras, exceto `solveLaplace`, que atualiza a grade dada
 * no lugar (documentado). Unidades: as que o chamador usar; com `k` padrão,
 * posições em m e cargas em C dão E em N/C e V em volts.
 */
import type { V2 } from "./vec.ts";

/** Constante de Coulomb k = 1/(4πε₀), em N·m²/C². */
export const K_COULOMB = 8.9875517923e9;
/** Permissividade do vácuo ε₀, em F/m. */
export const EPS0 = 8.8541878128e-12;

/** Carga pontual no plano. */
export interface PointCharge {
  x: number;
  y: number;
  q: number;
}

/** Retângulo do plano. */
export interface Bounds {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

export interface CoulombOptions {
  /** Constante de acoplamento (padrão `K_COULOMB`). Use 1 para unidades reduzidas. */
  k?: number;
  /** Raio de amolecimento: r² → r² + soft² (evita infinitos no desenho). Padrão 0. */
  soft?: number;
}

/** Campo elétrico das cargas no ponto (x, y): E = Σ k qᵢ (r − rᵢ)/|r − rᵢ|³. */
export function fieldAt(charges: readonly PointCharge[], x: number, y: number, opts: CoulombOptions = {}): V2 {
  const k = opts.k ?? K_COULOMB;
  const s2 = (opts.soft ?? 0) ** 2;
  let ex = 0;
  let ey = 0;
  for (const c of charges) {
    const dx = x - c.x;
    const dy = y - c.y;
    const r2 = dx * dx + dy * dy + s2;
    if (r2 === 0) continue;
    const f = (k * c.q) / (r2 * Math.sqrt(r2));
    ex += f * dx;
    ey += f * dy;
  }
  return [ex, ey];
}

/** Potencial das cargas no ponto (x, y): V = Σ k qᵢ/|r − rᵢ| (referência no infinito). */
export function potentialAt(charges: readonly PointCharge[], x: number, y: number, opts: CoulombOptions = {}): number {
  const k = opts.k ?? K_COULOMB;
  const s2 = (opts.soft ?? 0) ** 2;
  let v = 0;
  for (const c of charges) {
    const r = Math.sqrt((x - c.x) ** 2 + (y - c.y) ** 2 + s2);
    if (r === 0) return c.q > 0 ? Infinity : c.q < 0 ? -Infinity : v;
    v += (k * c.q) / r;
  }
  return v;
}

/** Força de Coulomb sobre a carga `i` exercida por todas as outras (superposição). */
export function forceOn(charges: readonly PointCharge[], i: number, opts: CoulombOptions = {}): V2 {
  const c = charges[i];
  if (!c) return [0, 0];
  const others = charges.filter((_, j) => j !== i);
  const [ex, ey] = fieldAt(others, c.x, c.y, opts);
  return [c.q * ex, c.q * ey];
}

/** Energia potencial eletrostática do sistema: U = Σ_{i<j} k qᵢ qⱼ / rᵢⱼ. */
export function systemEnergy(charges: readonly PointCharge[], opts: CoulombOptions = {}): number {
  const k = opts.k ?? K_COULOMB;
  let u = 0;
  for (let i = 0; i < charges.length; i++)
    for (let j = i + 1; j < charges.length; j++) {
      const a = charges[i]!;
      const b = charges[j]!;
      const r = Math.hypot(a.x - b.x, a.y - b.y);
      if (r > 0) u += (k * a.q * b.q) / r;
    }
  return u;
}

// ---------------------------------------------------------------------------
// Linhas de campo
// ---------------------------------------------------------------------------

/** Campo vetorial qualquer do plano. */
export type VectorField = (x: number, y: number) => V2;

export type LineEnd = "charge" | "bounds" | "length" | "null" | "steps";

export interface FieldLine {
  /** Pontos da linha, no sentido do campo (de + para −). */
  points: V2[];
  /** Índice da carga onde a linha nasce (−1 se vem da borda/infinito). */
  from: number;
  /** Índice da carga onde a linha termina (−1 se sai pela borda). */
  to: number;
  /** Por que o traçado parou na ponta final. */
  end: LineEnd;
}

export interface TraceOptions {
  /** Região de traçado; a linha para ao sair dela. */
  bounds: Bounds;
  /** Sentido: +1 segue E, −1 segue −E. Padrão +1. */
  direction?: 1 | -1;
  /** Tolerância de erro local por passo, em unidades de comprimento. Padrão 1e-4 × diagonal. */
  tol?: number;
  /** Passo inicial (comprimento de arco). Padrão diagonal/400. */
  h0?: number;
  /** Passo máximo (controla a suavidade do desenho). Padrão diagonal/80. */
  hMax?: number;
  /** Passo mínimo. Padrão diagonal × 1e-6. */
  hMin?: number;
  /** Comprimento máximo da linha. Padrão 6 × diagonal. */
  maxLength?: number;
  /** Número máximo de passos aceitos. Padrão 4000. */
  maxSteps?: number;
  /** Sumidouros: para quando chega a menos de `stopRadius` de um deles. */
  sinks?: readonly { x: number; y: number }[];
  /** Raio de captura dos sumidouros. Padrão diagonal/150. */
  stopRadius?: number;
  /** |E| abaixo disto conta como ponto de campo nulo. Padrão 0 (só zero exato). */
  minField?: number;
}

export interface TraceResult {
  points: V2[];
  end: LineEnd;
  /** Índice do sumidouro atingido (−1 se nenhum). */
  sink: number;
}

// Tabela de Butcher de Dormand–Prince 5(4) (campo autônomo: os nós c não são usados).
const DP_A: number[][] = [
  [],
  [1 / 5],
  [3 / 40, 9 / 40],
  [44 / 45, -56 / 15, 32 / 9],
  [19372 / 6561, -25360 / 2187, 64448 / 6561, -212 / 729],
  [9017 / 3168, -355 / 33, 46732 / 5247, 49 / 176, -5103 / 18656],
  [35 / 384, 0, 500 / 1113, 125 / 192, -2187 / 6784, 11 / 84],
];
const DP_B5 = [35 / 384, 0, 500 / 1113, 125 / 192, -2187 / 6784, 11 / 84, 0];
const DP_B4 = [5179 / 57600, 0, 7571 / 16695, 393 / 640, -92097 / 339200, 187 / 2100, 1 / 40];

const inside = (b: Bounds, x: number, y: number) => x >= b.xMin && x <= b.xMax && y >= b.yMin && y <= b.yMax;

/**
 * Traça uma linha do campo `field` a partir de `start`, parametrizada pelo
 * comprimento de arco (dr/ds = ±E/|E|), com Dormand–Prince 5(4) e controle de
 * passo pelo erro local. Para em sumidouros, ao sair de `bounds`, em pontos de
 * campo nulo ou ao exceder o comprimento máximo.
 */
export function traceFieldLine(field: VectorField, start: V2, opts: TraceOptions): TraceResult {
  const b = opts.bounds;
  const diag = Math.hypot(b.xMax - b.xMin, b.yMax - b.yMin);
  const dir = opts.direction ?? 1;
  const tol = opts.tol ?? diag * 1e-4;
  const hMax = opts.hMax ?? diag / 80;
  const hMin = opts.hMin ?? diag * 1e-6;
  const maxLength = opts.maxLength ?? 6 * diag;
  const maxSteps = opts.maxSteps ?? 4000;
  const sinks = opts.sinks ?? [];
  const stopR = opts.stopRadius ?? diag / 150;
  const minField = opts.minField ?? 0;
  let h = Math.min(opts.h0 ?? diag / 400, hMax);

  let nullHit = false;
  const f = (x: number, y: number): V2 => {
    const [ex, ey] = field(x, y);
    const m = Math.hypot(ex, ey);
    if (!(m > minField) || !Number.isFinite(m)) {
      nullHit = true;
      return [0, 0];
    }
    return [(dir * ex) / m, (dir * ey) / m];
  };

  let [x, y] = start;
  const points: V2[] = [[x, y]];
  let length = 0;
  const hitSink = (px: number, py: number) => sinks.findIndex((s) => Math.hypot(px - s.x, py - s.y) < stopR);

  for (let steps = 0, tries = 0; steps < maxSteps && tries < maxSteps * 4; tries++) {
    nullHit = false;
    const kx: number[] = [];
    const ky: number[] = [];
    for (let s = 0; s < 7; s++) {
      let sx = x;
      let sy = y;
      const a = DP_A[s]!;
      for (let j = 0; j < a.length; j++) {
        sx += h * a[j]! * kx[j]!;
        sy += h * a[j]! * ky[j]!;
      }
      const [fx, fy] = f(sx, sy);
      kx.push(fx);
      ky.push(fy);
    }
    if (nullHit && h <= hMin * 1.0001) return { points, end: "null", sink: -1 };
    let x5 = x;
    let y5 = y;
    let ex = 0;
    let ey = 0;
    for (let s = 0; s < 7; s++) {
      x5 += h * DP_B5[s]! * kx[s]!;
      y5 += h * DP_B5[s]! * ky[s]!;
      ex += h * (DP_B5[s]! - DP_B4[s]!) * kx[s]!;
      ey += h * (DP_B5[s]! - DP_B4[s]!) * ky[s]!;
    }
    const err = Math.hypot(ex, ey);
    if ((err > tol || nullHit) && h > hMin) {
      // Rejeita e encolhe o passo.
      h = Math.max(hMin, h * (nullHit ? 0.25 : Math.max(0.2, 0.9 * (tol / err) ** 0.2)));
      continue;
    }
    // Aceita o passo. Mede o deslocamento real: perto de um ponto de sela a
    // direção inverte e o avanço líquido some.
    const moved = Math.hypot(x5 - x, y5 - y);
    if (moved < 0.05 * h) return { points, end: "null", sink: -1 };
    x = x5;
    y = y5;
    length += moved;
    steps++;
    const sink = hitSink(x, y);
    if (sink >= 0) {
      const s = sinks[sink]!;
      points.push([s.x, s.y]);
      return { points, end: "charge", sink };
    }
    if (!inside(b, x, y)) {
      points.push(clipToBounds(points[points.length - 1]!, [x, y], b));
      return { points, end: "bounds", sink: -1 };
    }
    points.push([x, y]);
    if (length >= maxLength) return { points, end: "length", sink: -1 };
    const grow = err > 0 ? 0.9 * (tol / err) ** 0.2 : 4;
    h = Math.min(hMax, Math.max(hMin, h * Math.min(4, Math.max(0.2, grow))));
  }
  return { points, end: "steps", sink: -1 };
}

/** Ponto onde o segmento a→b (a dentro, b fora) cruza a borda do retângulo. */
function clipToBounds(a: V2, b: V2, r: Bounds): V2 {
  let t = 1;
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  if (b[0] > r.xMax && dx !== 0) t = Math.min(t, (r.xMax - a[0]) / dx);
  if (b[0] < r.xMin && dx !== 0) t = Math.min(t, (r.xMin - a[0]) / dx);
  if (b[1] > r.yMax && dy !== 0) t = Math.min(t, (r.yMax - a[1]) / dy);
  if (b[1] < r.yMin && dy !== 0) t = Math.min(t, (r.yMin - a[1]) / dy);
  t = Math.max(0, t);
  return [a[0] + dx * t, a[1] + dy * t];
}

export interface FieldLinesOptions extends Omit<TraceOptions, "direction" | "sinks"> {
  /** Linhas por unidade de |q| (na unidade de carga usada). Padrão: 12 linhas para a maior carga. */
  linesPerUnitCharge?: number;
  /** Mínimo de linhas para uma carga não nula. Padrão 2. */
  minLines?: number;
  /** Máximo de linhas por carga. Padrão 48. */
  maxLines?: number;
  /** Raio do círculo de partida em volta da carga. Padrão diagonal/150. */
  startRadius?: number;
  /** Ângulo de referência das sementes (rad). Padrão 0. */
  phase?: number;
  /** Opções do campo de Coulomb (k, soft). */
  coulomb?: CoulombOptions;
  /** Campo externo somado ao das cargas (ex.: campo uniforme de placas). */
  external?: VectorField;
}

/** Número de linhas que saem de (ou chegam a) cada carga: proporcional a |q|. */
export function linesPerCharge(charges: readonly PointCharge[], opts: Pick<FieldLinesOptions, "linesPerUnitCharge" | "minLines" | "maxLines"> = {}): number[] {
  const qMax = Math.max(0, ...charges.map((c) => Math.abs(c.q)));
  if (qMax === 0) return charges.map(() => 0);
  const density = opts.linesPerUnitCharge ?? 12 / qMax;
  const lo = opts.minLines ?? 2;
  const hi = opts.maxLines ?? 48;
  return charges.map((c) => (c.q === 0 ? 0 : Math.min(hi, Math.max(lo, Math.round(Math.abs(c.q) * density)))));
}

/**
 * Linhas de campo de um conjunto de cargas pontuais. As linhas partem
 * igualmente espaçadas de um pequeno círculo em volta de cada carga positiva,
 * em número proporcional a |q|, e seguem E até uma carga negativa ou a borda.
 * Depois, cada carga negativa que recebeu menos linhas do que lhe cabe ganha
 * as que faltam, traçadas para trás (−E) a partir das maiores lacunas
 * angulares; essas vêm "do infinito" (ou da borda).
 */
export function fieldLines(charges: readonly PointCharge[], opts: FieldLinesOptions): FieldLine[] {
  const b = opts.bounds;
  const diag = Math.hypot(b.xMax - b.xMin, b.yMax - b.yMin);
  const r0 = opts.startRadius ?? diag / 150;
  const counts = linesPerCharge(charges, opts);
  const ext = opts.external;
  const field: VectorField = ext
    ? (x, y) => {
        const [ex, ey] = fieldAt(charges, x, y, opts.coulomb);
        const [ux, uy] = ext(x, y);
        return [ex + ux, ey + uy];
      }
    : (x, y) => fieldAt(charges, x, y, opts.coulomb);
  const phase = opts.phase ?? 0;
  const neg = charges.map((c, i) => (c.q < 0 ? i : -1)).filter((i) => i >= 0);
  const pos = charges.map((c, i) => (c.q > 0 ? i : -1)).filter((i) => i >= 0);
  const out: FieldLine[] = [];
  const arrivals = new Map<number, number[]>();

  const base: Omit<TraceOptions, "direction" | "sinks"> = { ...opts, stopRadius: opts.stopRadius ?? r0 * 1.01 };

  for (const i of pos) {
    const c = charges[i]!;
    const n = counts[i]!;
    const sinks = neg.map((j) => charges[j]!);
    for (let m = 0; m < n; m++) {
      const a = phase + (2 * Math.PI * (m + 0.5)) / n;
      const start: V2 = [c.x + r0 * Math.cos(a), c.y + r0 * Math.sin(a)];
      const tr = traceFieldLine(field, start, { ...base, direction: 1, sinks });
      const to = tr.sink >= 0 ? neg[tr.sink]! : -1;
      out.push({ points: [[c.x, c.y], ...tr.points], from: i, to, end: tr.end });
      if (to >= 0) {
        const pts = tr.points;
        const prev = pts[pts.length - 2] ?? pts[0]!;
        const t = charges[to]!;
        const list = arrivals.get(to) ?? [];
        list.push(Math.atan2(prev[1] - t.y, prev[0] - t.x));
        arrivals.set(to, list);
      }
    }
  }

  for (const j of neg) {
    const c = charges[j]!;
    const got = arrivals.get(j) ?? [];
    const missing = counts[j]! - got.length;
    if (missing <= 0) continue;
    const seeds = fillGaps(got, missing, phase);
    const sinks = pos.map((i) => charges[i]!);
    for (const a of seeds) {
      const start: V2 = [c.x + r0 * Math.cos(a), c.y + r0 * Math.sin(a)];
      const tr = traceFieldLine(field, start, { ...base, direction: -1, sinks });
      // Traçada de trás para a frente: inverte para ficar no sentido de E.
      const pts = [[c.x, c.y] as V2, ...tr.points].reverse();
      out.push({ points: pts, from: tr.sink >= 0 ? pos[tr.sink]! : -1, to: j, end: tr.end });
    }
  }
  return out;
}

/** Escolhe `n` ângulos novos que preenchem as maiores lacunas entre `taken`. */
export function fillGaps(taken: readonly number[], n: number, phase = 0): number[] {
  const TAU = 2 * Math.PI;
  const norm = (a: number) => ((a % TAU) + TAU) % TAU;
  if (taken.length === 0) return Array.from({ length: n }, (_, m) => norm(phase + (TAU * (m + 0.5)) / n));
  const angles = taken.map(norm).sort((p, q) => p - q);
  const out: number[] = [];
  for (let m = 0; m < n; m++) {
    let best = 0;
    let bestGap = -1;
    for (let i = 0; i < angles.length; i++) {
      const a = angles[i]!;
      const next = i + 1 < angles.length ? angles[i + 1]! : angles[0]! + TAU;
      if (next - a > bestGap) {
        bestGap = next - a;
        best = i;
      }
    }
    const a = angles[best]!;
    const mid = norm(a + bestGap / 2);
    out.push(mid);
    angles.push(mid);
    angles.sort((p, q) => p - q);
  }
  return out;
}

/** Ponto e direção unitária a uma fração `frac` (0–1) do comprimento de uma polilinha. */
export function pointAlong(points: readonly V2[], frac: number): { p: V2; dir: V2 } | null {
  if (points.length < 2) return null;
  let total = 0;
  for (let i = 1; i < points.length; i++) total += Math.hypot(points[i]![0] - points[i - 1]![0], points[i]![1] - points[i - 1]![1]);
  if (total === 0) return null;
  let target = Math.min(1, Math.max(0, frac)) * total;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const c = points[i]!;
    const seg = Math.hypot(c[0] - a[0], c[1] - a[1]);
    if (seg > 0 && (target <= seg || i === points.length - 1)) {
      const t = Math.min(1, target / seg);
      return { p: [a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t], dir: [(c[0] - a[0]) / seg, (c[1] - a[1]) / seg] };
    }
    target -= seg;
  }
  return null;
}

/** Comprimento de uma polilinha. */
export function polylineLength(points: readonly V2[]): number {
  let s = 0;
  for (let i = 1; i < points.length; i++) s += Math.hypot(points[i]![0] - points[i - 1]![0], points[i]![1] - points[i - 1]![1]);
  return s;
}

// ---------------------------------------------------------------------------
// Grades escalares
// ---------------------------------------------------------------------------

/**
 * Grade regular de valores escalares. O nó (i, j) fica em
 * (xMin + i·dx, yMin + j·dy) e seu valor em `v[i + j·nx]`.
 */
export interface Grid2D {
  nx: number;
  ny: number;
  xMin: number;
  yMin: number;
  dx: number;
  dy: number;
  v: Float64Array;
}

/** Grade de nx × ny nós cobrindo `bounds` (inclui as bordas). */
export function makeGrid(bounds: Bounds, nx: number, ny: number, fill = 0): Grid2D {
  if (nx < 2 || ny < 2) throw new Error("makeGrid: a grade precisa de pelo menos 2 × 2 nós");
  return {
    nx,
    ny,
    xMin: bounds.xMin,
    yMin: bounds.yMin,
    dx: (bounds.xMax - bounds.xMin) / (nx - 1),
    dy: (bounds.yMax - bounds.yMin) / (ny - 1),
    v: new Float64Array(nx * ny).fill(fill),
  };
}

/** Grade com os valores de f(x, y) nos nós. */
export function sampleGrid(bounds: Bounds, nx: number, ny: number, f: (x: number, y: number) => number): Grid2D {
  const g = makeGrid(bounds, nx, ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) g.v[i + j * nx] = f(g.xMin + i * g.dx, g.yMin + j * g.dy);
  return g;
}

/** Posição do nó (i, j). */
export const gridX = (g: Grid2D, i: number) => g.xMin + i * g.dx;
export const gridY = (g: Grid2D, j: number) => g.yMin + j * g.dy;

/** Valor interpolado bilinearmente em (x, y); fora da grade usa a borda mais próxima. */
export function gridValueAt(g: Grid2D, x: number, y: number): number {
  const fx = Math.min(g.nx - 1, Math.max(0, (x - g.xMin) / g.dx));
  const fy = Math.min(g.ny - 1, Math.max(0, (y - g.yMin) / g.dy));
  const i = Math.min(g.nx - 2, Math.floor(fx));
  const j = Math.min(g.ny - 2, Math.floor(fy));
  const tx = fx - i;
  const ty = fy - j;
  const v = g.v;
  const n = g.nx;
  return (
    (1 - tx) * (1 - ty) * v[i + j * n]! +
    tx * (1 - ty) * v[i + 1 + j * n]! +
    (1 - tx) * ty * v[i + (j + 1) * n]! +
    tx * ty * v[i + 1 + (j + 1) * n]!
  );
}

/**
 * Gradiente ∇V em (x, y): diferenças centradas nos nós, interpoladas
 * bilinearmente. Para o campo elétrico, use E = −∇V.
 */
export function gridGradientAt(g: Grid2D, x: number, y: number): V2 {
  const fx = Math.min(g.nx - 1, Math.max(0, (x - g.xMin) / g.dx));
  const fy = Math.min(g.ny - 1, Math.max(0, (y - g.yMin) / g.dy));
  const i = Math.min(g.nx - 2, Math.floor(fx));
  const j = Math.min(g.ny - 2, Math.floor(fy));
  const tx = fx - i;
  const ty = fy - j;
  const node = (a: number, c: number): V2 => nodeGradient(g, a, c);
  const g00 = node(i, j);
  const g10 = node(i + 1, j);
  const g01 = node(i, j + 1);
  const g11 = node(i + 1, j + 1);
  const mix = (k: 0 | 1) => (1 - tx) * (1 - ty) * g00[k] + tx * (1 - ty) * g10[k] + (1 - tx) * ty * g01[k] + tx * ty * g11[k];
  return [mix(0), mix(1)];
}

/** Gradiente no nó (i, j) por diferenças centradas (unilaterais na borda). */
export function nodeGradient(g: Grid2D, i: number, j: number): V2 {
  const n = g.nx;
  const v = g.v;
  const il = Math.max(0, i - 1);
  const ir = Math.min(g.nx - 1, i + 1);
  const jd = Math.max(0, j - 1);
  const ju = Math.min(g.ny - 1, j + 1);
  return [(v[ir + j * n]! - v[il + j * n]!) / ((ir - il) * g.dx), (v[i + ju * n]! - v[i + jd * n]!) / ((ju - jd) * g.dy)];
}

/** Menor e maior valor finito da grade. */
export function gridRange(g: Grid2D): [number, number] {
  let lo = Infinity;
  let hi = -Infinity;
  for (const x of g.v)
    if (Number.isFinite(x)) {
      if (x < lo) lo = x;
      if (x > hi) hi = x;
    }
  return lo <= hi ? [lo, hi] : [0, 0];
}

// ---------------------------------------------------------------------------
// Marching squares
// ---------------------------------------------------------------------------

/**
 * Curvas de nível V = `level` sobre a grade, por marching squares com
 * interpolação linear nas arestas. Devolve polilinhas já encadeadas (abertas
 * nas bordas, fechadas quando o primeiro ponto repete o último). Células com
 * algum valor não finito são ignoradas. Selas são desambiguadas pela média
 * dos quatro cantos.
 */
export function contourLines(g: Grid2D, level: number): V2[][] {
  const { nx, ny, v } = g;
  // Cada ponto de um segmento está numa aresta da grade; o id da aresta serve
  // de chave exata para encadear os segmentos.
  //   aresta horizontal (i,j)–(i+1,j): 2·(i + j·nx);  vertical (i,j)–(i,j+1): 2·(i + j·nx) + 1
  const pts = new Map<number, V2>();
  const adj = new Map<number, number[]>();
  const edgePoint = (id: number): V2 => {
    let p = pts.get(id);
    if (p) return p;
    const base = id >> 1;
    const i = base % nx;
    const j = (base - i) / nx;
    const a = v[base]!;
    if (id & 1) {
      const b = v[base + nx]!;
      const t = (level - a) / (b - a);
      p = [gridX(g, i), gridY(g, j) + t * g.dy];
    } else {
      const b = v[base + 1]!;
      const t = (level - a) / (b - a);
      p = [gridX(g, i) + t * g.dx, gridY(g, j)];
    }
    pts.set(id, p);
    return p;
  };
  const link = (e1: number, e2: number) => {
    edgePoint(e1);
    edgePoint(e2);
    (adj.get(e1) ?? adj.set(e1, []).get(e1)!).push(e2);
    (adj.get(e2) ?? adj.set(e2, []).get(e2)!).push(e1);
  };

  for (let j = 0; j < ny - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const k = i + j * nx;
      const a = v[k]!; // (i, j)
      const b = v[k + 1]!; // (i+1, j)
      const c = v[k + 1 + nx]!; // (i+1, j+1)
      const d = v[k + nx]!; // (i, j+1)
      if (!Number.isFinite(a) || !Number.isFinite(b) || !Number.isFinite(c) || !Number.isFinite(d)) continue;
      const idx = (a >= level ? 1 : 0) | (b >= level ? 2 : 0) | (c >= level ? 4 : 0) | (d >= level ? 8 : 0);
      if (idx === 0 || idx === 15) continue;
      const bottom = 2 * k;
      const top = 2 * (k + nx);
      const left = 2 * k + 1;
      const right = 2 * (k + 1) + 1;
      switch (idx) {
        case 1:
        case 14:
          link(left, bottom);
          break;
        case 2:
        case 13:
          link(bottom, right);
          break;
        case 3:
        case 12:
          link(left, right);
          break;
        case 4:
        case 11:
          link(right, top);
          break;
        case 6:
        case 9:
          link(bottom, top);
          break;
        case 7:
        case 8:
          link(left, top);
          break;
        case 5:
        case 10: {
          // Sela: a e c de um lado, b e d do outro.
          const center = (a + b + c + d) / 4;
          const acHigh = idx === 5;
          if ((center >= level) === acHigh) {
            // a e c conectados pelo centro: separa b e d
            link(bottom, right);
            link(left, top);
          } else {
            link(left, bottom);
            link(right, top);
          }
          break;
        }
      }
    }
  }

  // Encadeia: começa pelas pontas (grau 1) e depois pelos laços fechados.
  const used = new Set<string>();
  const key = (p: number, q: number) => (p < q ? `${p}:${q}` : `${q}:${p}`);
  const lines: V2[][] = [];
  const walk = (startId: number) => {
    const chain: V2[] = [pts.get(startId)!];
    let cur = startId;
    for (;;) {
      const next = (adj.get(cur) ?? []).find((n) => !used.has(key(cur, n)));
      if (next === undefined) break;
      used.add(key(cur, next));
      chain.push(pts.get(next)!);
      cur = next;
    }
    if (chain.length >= 2) lines.push(chain);
  };
  for (const [id, ns] of adj) if (ns.length === 1 && !used.has(key(id, ns[0]!))) walk(id);
  for (const [id, ns] of adj) if (ns.some((n) => !used.has(key(id, n)))) walk(id);
  return lines;
}

/** Níveis "redondos" igualmente espaçados entre lo e hi (exclusive), no máximo ~n. */
export function niceLevels(lo: number, hi: number, n = 10): number[] {
  if (!(hi > lo)) return [];
  const raw = (hi - lo) / n;
  const p = 10 ** Math.floor(Math.log10(raw));
  const m = raw / p;
  const step = (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p;
  const out: number[] = [];
  for (let x = Math.ceil(lo / step) * step; x < hi; x += step) if (x > lo) out.push(Math.abs(x) < step * 1e-9 ? 0 : x);
  return out;
}

// ---------------------------------------------------------------------------
// Laplace / Poisson por SOR
// ---------------------------------------------------------------------------

export interface LaplaceOptions {
  /** Fator de sobre-relaxação 0 < ω < 2. Padrão: ótimo teórico 2/(1 + sin(π/N)), N = max(nx, ny). */
  omega?: number;
  /** Para quando a maior correção de um nó numa varredura fica abaixo disto. Padrão 1e-6 × amplitude. */
  tol?: number;
  /** Máximo de varreduras. Padrão 10 000. */
  maxIter?: number;
  /**
   * Borda: "dirichlet" mantém os valores atuais da borda (ex.: aterrada em 0);
   * "neumann" impõe ∂V/∂n = 0 (borda isolada). Padrão "dirichlet".
   */
  boundary?: "dirichlet" | "neumann";
  /** Termo de fonte f em ∇²V = f (Poisson; para cargas, f = −ρ/ε₀). Mesmo índice da grade. */
  source?: ArrayLike<number>;
}

export interface LaplaceResult {
  iterations: number;
  /** Maior correção na última varredura. */
  change: number;
  converged: boolean;
}

/**
 * Resolve ∇²V = f na grade por sobre-relaxação sucessiva (Gauss–Seidel com
 * ordenação vermelho-preto). Nós com `fixed[k]` verdadeiro (condutores,
 * eletrodos) mantêm o valor; os demais relaxam. **Atualiza `g.v` no lugar**
 * (passe uma cópia para preservar a original) e devolve o diagnóstico.
 */
export function solveLaplace(g: Grid2D, fixed: ArrayLike<boolean | number>, opts: LaplaceOptions = {}): LaplaceResult {
  const { nx, ny, v } = g;
  const omega = opts.omega ?? 2 / (1 + Math.sin(Math.PI / Math.max(nx, ny)));
  const [lo, hi] = gridRange(g);
  const tol = opts.tol ?? 1e-6 * Math.max(hi - lo, 1e-12);
  const maxIter = opts.maxIter ?? 10_000;
  const neumann = opts.boundary === "neumann";
  const src = opts.source;
  const ax = 1 / (g.dx * g.dx);
  const ay = 1 / (g.dy * g.dy);
  const isFixed = (k: number) => Boolean(fixed[k]);

  let change = Infinity;
  let it = 0;
  for (; it < maxIter && change > tol; ) {
    change = 0;
    for (let color = 0; color < 2; color++) {
      for (let j = 0; j < ny; j++) {
        const border = j === 0 || j === ny - 1;
        for (let i = (j + color) % 2; i < nx; i += 2) {
          const k = i + j * nx;
          if (isFixed(k)) continue;
          const edge = border || i === 0 || i === nx - 1;
          if (edge && !neumann) continue;
          // Neumann: espelha o vizinho interno (nó fantasma com o mesmo valor).
          const l = i > 0 ? v[k - 1]! : v[k + 1]!;
          const r = i < nx - 1 ? v[k + 1]! : v[k - 1]!;
          const d = j > 0 ? v[k - nx]! : v[k + nx]!;
          const u = j < ny - 1 ? v[k + nx]! : v[k - nx]!;
          const gs = (ax * (l + r) + ay * (d + u) - (src ? src[k]! : 0)) / (2 * ax + 2 * ay);
          const delta = omega * (gs - v[k]!);
          v[k] = v[k]! + delta;
          const a = Math.abs(delta);
          if (a > change) change = a;
        }
      }
    }
    it++;
  }
  return { iterations: it, change, converged: change <= tol };
}
