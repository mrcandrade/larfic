// Condutores em equilíbrio numa grade 2D (corte de condutores longos em z):
// ∇²V = 0 fora dos condutores, resolvido por SOR (solveLaplace do core). Eletrodos
// têm potencial fixo; condutores isolados têm potencial desconhecido, ajustado
// pela lei de Gauss discreta para que a carga total seja a prescrita.
import { EPS0, makeGrid, solveLaplace, type Grid2D, type V2 } from "@fisilab/core";

export const BOUNDS = { xMin: -4, xMax: 4, yMin: -3, yMax: 3 };
export const H = 0.1;
export const NX = Math.round((BOUNDS.xMax - BOUNDS.xMin) / H) + 1;
export const NY = Math.round((BOUNDS.yMax - BOUNDS.yMin) / H) + 1;

/** Tipos de nó. */
export const VACUO = 0;
export const ISOLADO = 1;
export const ELETRODO_P = 2;
export const ELETRODO_N = 3;

export const idx = (i: number, j: number) => i + j * NX;
export const nodeX = (i: number) => BOUNDS.xMin + i * H;
export const nodeY = (j: number) => BOUNDS.yMin + j * H;
export const isBorder = (i: number, j: number) => i === 0 || j === 0 || i === NX - 1 || j === NY - 1;

export interface Component {
  /** Nós do condutor. */
  nodes: number[];
  /** Eletrodo (potencial fixo) ou isolado (carga fixa). */
  kind: "isolado" | "eletrodo";
  V: number;
  /** Carga por unidade de comprimento (C/m), calculada pelo fluxo do campo. */
  Q: number;
  /** Nós da superfície, com a carga de cada um (C/m) e a normal externa. */
  surface: { k: number; lambda: number; sigma: number; n: V2 }[];
}

export interface Solution {
  grid: Grid2D;
  comps: Component[];
  /** Nó → índice do componente (−1 fora de condutor). */
  owner: Int32Array;
  iterations: number;
  converged: boolean;
}

export interface SolveInput {
  mask: Uint8Array;
  /** Campo externo uniforme (V/m), na direção +x, imposto pela borda. */
  E0: number;
  /** Diferença de potencial entre eletrodos (V): + fica em V/2, − em −V/2. */
  V: number;
  /** Carga de cada condutor isolado (C/m). */
  Q: number;
}

const NB: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/** Rotula os condutores conexos (vizinhança de 4). */
export function components(mask: Uint8Array): { owner: Int32Array; list: { nodes: number[]; types: Set<number> }[] } {
  const owner = new Int32Array(NX * NY).fill(-1);
  const list: { nodes: number[]; types: Set<number> }[] = [];
  for (let k0 = 0; k0 < mask.length; k0++) {
    if (!mask[k0] || owner[k0]! >= 0) continue;
    const id = list.length;
    const nodes: number[] = [];
    const types = new Set<number>();
    const stack = [k0];
    owner[k0] = id;
    while (stack.length) {
      const k = stack.pop()!;
      nodes.push(k);
      types.add(mask[k]!);
      const i = k % NX, j = (k - i) / NX;
      for (const [di, dj] of NB) {
        const a = i + di, b = j + dj;
        if (a < 0 || b < 0 || a >= NX || b >= NY) continue;
        const n = idx(a, b);
        if (mask[n] && owner[n]! < 0) {
          owner[n] = id;
          stack.push(n);
        }
      }
    }
    list.push({ nodes, types });
  }
  return { owner, list };
}

let warm: Float64Array | null = null;

/** Resolve o problema eletrostático. */
export function solveConductors(inp: SolveInput, opts: { tol?: number; warmStart?: boolean } = {}): Solution {
  const { mask, E0, V, Q } = inp;
  const grid = makeGrid(BOUNDS, NX, NY);
  const v = grid.v;
  const { owner, list } = components(mask);
  const fixed = new Uint8Array(NX * NY);
  for (let j = 0; j < NY; j++)
    for (let i = 0; i < NX; i++) {
      const k = idx(i, j);
      v[k] = opts.warmStart !== false && warm && warm.length === v.length ? warm[k]! : -E0 * nodeX(i);
      if (isBorder(i, j)) {
        fixed[k] = 1;
        v[k] = -E0 * nodeX(i);
      }
      if (mask[k]) fixed[k] = 1;
    }
  const comps = list.map((c) => {
    const kind: Component["kind"] = c.types.has(ELETRODO_P) || c.types.has(ELETRODO_N) ? "eletrodo" : "isolado";
    const Vc = kind === "eletrodo" ? (c.types.has(ELETRODO_P) ? V / 2 : -V / 2) : c.nodes.reduce((s, k) => s + v[k]!, 0) / c.nodes.length;
    for (const k of c.nodes) v[k] = Vc;
    // Ligações da superfície: (nó do condutor, vizinho fora dele).
    const links: [number, number][] = [];
    for (const k of c.nodes) {
      const i = k % NX, j = (k - i) / NX;
      for (const [di, dj] of NB) {
        const a = i + di, b = j + dj;
        if (a < 0 || b < 0 || a >= NX || b >= NY) continue;
        const n = idx(a, b);
        if (owner[n] !== owner[k]) links.push([k, n]);
      }
    }
    return { nodes: c.nodes, kind, V: Vc, links };
  });

  const amp = Math.max(Math.abs(E0) * (BOUNDS.xMax - BOUNDS.xMin), Math.abs(V), Math.abs(Q) / EPS0, 1e-9);
  const tol = (opts.tol ?? 1e-6) * amp;
  let iterations = 0;
  let converged = false;
  const floats = comps.filter((c) => c.kind === "isolado" && c.links.length > 0);
  for (let outer = 0; outer < 400; outer++) {
    const r = solveLaplace(grid, fixed, { maxIter: floats.length ? 25 : 20_000, tol });
    iterations += r.iterations;
    let dV = 0;
    for (const c of floats) {
      // Lei de Gauss discreta: Q/ε₀ = Σ (V_c − V_vizinho) ⇒ V_c = média + Q/(ε₀ N).
      let sum = 0;
      for (const [, n] of c.links) sum += v[n]!;
      const Vc = sum / c.links.length + Q / (EPS0 * c.links.length);
      dV = Math.max(dV, Math.abs(Vc - c.V));
      c.V = Vc;
      for (const k of c.nodes) v[k] = Vc;
    }
    if (r.converged && dV < tol) {
      converged = true;
      break;
    }
  }
  warm = v.slice();

  const out: Component[] = comps.map((c) => {
    const per = new Map<number, { lambda: number; sig: number; links: number; n: V2 }>();
    let Qc = 0;
    for (const [k, n] of c.links) {
      const lam = EPS0 * (v[k]! - v[n]!);
      Qc += lam;
      const e = per.get(k) ?? { lambda: 0, sig: 0, links: 0, n: [0, 0] as V2 };
      const ki = k % NX, ni = n % NX;
      // σ = ε₀ E_n na superfície, com diferença unilateral de 2ª ordem quando há dois nós livres.
      const n2 = 2 * n - k;
      const ok2 = ni + (ni - ki) >= 0 && ni + (ni - ki) < NX && n2 >= 0 && n2 < v.length && owner[n2]! < 0 && owner[n]! < 0;
      e.sig += ok2 ? (EPS0 * (3 * v[k]! - 4 * v[n]! + v[n2]!)) / (2 * H) : lam / H;
      e.lambda += lam;
      e.links++;
      e.n = [e.n[0] + (ni - ki), e.n[1] + (Math.floor(n / NX) - Math.floor(k / NX))];
      per.set(k, e);
    }
    const surface = [...per.entries()].map(([k, e]) => {
      const L = Math.hypot(e.n[0], e.n[1]) || 1;
      return { k, lambda: e.lambda, sigma: e.sig / e.links, n: [e.n[0] / L, e.n[1] / L] as V2 };
    });
    return { nodes: c.nodes, kind: c.kind, V: c.V, Q: Qc, surface };
  });
  return { grid, comps: out, owner, iterations, converged };
}

// ---------------------------------------------------------------------------
// Máscaras
// ---------------------------------------------------------------------------

export function emptyMask(): Uint8Array {
  return new Uint8Array(NX * NY);
}

/** Pinta um disco de raio r (m) em (x, y) com o tipo dado (bordas da grade ficam livres). */
export function paintDisc(mask: Uint8Array, x: number, y: number, r: number, type: number): Uint8Array {
  const out = mask.slice();
  const i0 = Math.max(1, Math.floor((x - r - BOUNDS.xMin) / H));
  const i1 = Math.min(NX - 2, Math.ceil((x + r - BOUNDS.xMin) / H));
  const j0 = Math.max(1, Math.floor((y - r - BOUNDS.yMin) / H));
  const j1 = Math.min(NY - 2, Math.ceil((y + r - BOUNDS.yMin) / H));
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (Math.hypot(nodeX(i) - x, nodeY(j) - y) <= r + 1e-9) out[idx(i, j)] = type;
  return out;
}

/** Preenche os nós em que f(x, y) é verdadeiro. */
export function fillWhere(mask: Uint8Array, type: number, f: (x: number, y: number) => boolean): Uint8Array {
  for (let j = 1; j < NY - 1; j++) for (let i = 1; i < NX - 1; i++) if (f(nodeX(i), nodeY(j))) mask[idx(i, j)] = type;
  return mask;
}

/** Gota com ponta: círculo de raio 1 m em (−1, 0) unido a uma cunha até (1,8; 0). */
export function teardrop(x: number, y: number): boolean {
  if (Math.hypot(x + 1, y) <= 1) return true;
  if (x < -1 || x > 1.8) return false;
  // Cunha tangente ao círculo: meia largura decresce linearmente até a ponta.
  const half = 0.92 * (1.8 - x) / 2.8;
  return Math.abs(y) <= half;
}

export function sceneMask(cena: number): Uint8Array {
  const m = emptyMask();
  if (cena === 0) return fillWhere(m, ISOLADO, (x, y) => Math.abs(Math.hypot(x, y) - 1.3) <= 0.11);
  if (cena === 1) return fillWhere(m, ISOLADO, teardrop);
  if (cena === 2) {
    fillWhere(m, ELETRODO_P, (x, y) => Math.abs(x + 3) < 0.11 && Math.abs(y) <= 2.2);
    fillWhere(m, ELETRODO_N, (x, y) => Math.abs(x - 3) < 0.11 && Math.abs(y) <= 2.2);
    return fillWhere(m, ISOLADO, (x, y) => Math.abs(x) <= 0.6 && Math.abs(y) <= 1);
  }
  return m;
}

/** Hash rápido (FNV-1a) da máscara, para a memória de soluções. */
export function maskHash(mask: Uint8Array): number {
  let h = 2166136261;
  for (let k = 0; k < mask.length; k++) {
    h ^= mask[k]!;
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
