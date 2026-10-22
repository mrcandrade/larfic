/**
 * Solver de circuitos por Análise Nodal Modificada (MNA).
 *
 * Nós são inteiros a partir de 0 (terra). Elementos lineares entram direto na
 * matriz; capacitores e indutores usam o modelo companheiro da regra do
 * trapézio (conserva energia em circuitos LC ideais); diodos são resolvidos por
 * Newton–Raphson com limitação de passo.
 *
 * Convenção: a corrente de cada elemento é medida de `a` para `b` através do
 * elemento, e a tensão é v(a) − v(b).
 */

export type Element =
  | { kind: "R"; a: number; b: number; R: number }
  /** Fonte de tensão ideal com resistência interna opcional; `a` é o terminal positivo. */
  | { kind: "V"; a: number; b: number; V: number; R?: number }
  /** Fonte de corrente: empurra I de `a` para `b` por dentro da fonte (entra no circuito por `b`). */
  | { kind: "I"; a: number; b: number; I: number }
  /**
   * Capacitor: v0 e i0 são tensão e corrente do passo anterior. Sem i0 (recém
   * inserido ou após mudança de topologia), o primeiro passo usa Euler
   * implícito, que não depende da corrente anterior.
   */
  | { kind: "C"; a: number; b: number; C: number; v0: number; i0?: number }
  /** Indutor: i0 e v0 são corrente e tensão do passo anterior (v0 opcional, como acima). */
  | { kind: "L"; a: number; b: number; L: number; i0: number; v0?: number }
  /** Diodo de Shockley, anodo em `a` (padrão: 1N4148, Is = 2,52 nA, n = 1,75). */
  | { kind: "D"; a: number; b: number; Is?: number; n?: number };

export interface Solution {
  /** Potencial de cada nó (v[0] = 0). */
  v: number[];
  /** Corrente de a → b em cada elemento, na ordem de entrada. */
  i: number[];
  /** Tensão v(a) − v(b) em cada elemento. */
  dv: number[];
  converged: boolean;
  /** Verdadeiro quando a matriz é singular (ex.: laço só de fontes de tensão ideais). */
  singular: boolean;
}

const GMIN = 1e-12;
const VT = 0.025852; // tensão térmica a 300 K

/** Resolve A x = b por eliminação gaussiana com pivotamento parcial. Retorna null se singular. */
export function solveLinear(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]!]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r]![c]!) > Math.abs(M[p]![c]!)) p = r;
    if (Math.abs(M[p]![c]!) < 1e-18) return null;
    [M[c], M[p]] = [M[p]!, M[c]!];
    const piv = M[c]![c]!;
    for (let r = c + 1; r < n; r++) {
      const f = M[r]![c]! / piv;
      if (f === 0) continue;
      for (let k = c; k <= n; k++) M[r]![k]! -= f * M[c]![k]!;
    }
  }
  const x = new Array<number>(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = M[r]![n]!;
    for (let k = r + 1; k < n; k++) s -= M[r]![k]! * x[k]!;
    x[r] = s / M[r]![r]!;
  }
  return x;
}

/**
 * Resolve o circuito. Sem `dt`, calcula o regime DC (capacitor aberto,
 * indutor em curto). Com `dt`, dá um passo transitório pela regra do trapézio.
 */
export function solveCircuit(nodeCount: number, elements: Element[], dt?: number): Solution {
  const N = nodeCount - 1; // incógnitas de tensão (sem o terra)
  // Elementos que ganham uma incógnita de corrente: fontes de tensão e, em DC, indutores (curto).
  const branch = new Map<number, number>();
  elements.forEach((e, k) => {
    if (e.kind === "V" || (e.kind === "L" && dt === undefined)) branch.set(k, N + branch.size);
  });
  const size = N + branch.size;
  const vGuess = new Array<number>(nodeCount).fill(0);
  const diodes = elements.some((e) => e.kind === "D");
  let converged = !diodes;
  let x: number[] | null = null;

  for (let iter = 0; iter < (diodes ? 200 : 1); iter++) {
    const A = Array.from({ length: size }, () => new Array<number>(size).fill(0));
    const z = new Array<number>(size).fill(0);
    const stampG = (a: number, b: number, g: number) => {
      if (a > 0) A[a - 1]![a - 1]! += g;
      if (b > 0) A[b - 1]![b - 1]! += g;
      if (a > 0 && b > 0) {
        A[a - 1]![b - 1]! -= g;
        A[b - 1]![a - 1]! -= g;
      }
    };
    // Corrente I entrando no nó b e saindo do nó a.
    const stampI = (a: number, b: number, I: number) => {
      if (a > 0) z[a - 1]! -= I;
      if (b > 0) z[b - 1]! += I;
    };
    for (let n = 1; n < nodeCount; n++) A[n - 1]![n - 1]! += GMIN;

    elements.forEach((e, k) => {
      switch (e.kind) {
        case "R":
          stampG(e.a, e.b, 1 / Math.max(e.R, 1e-9));
          break;
        case "I":
          stampI(e.a, e.b, e.I);
          break;
        case "V": {
          const m = branch.get(k)!;
          // v(a) − v(b) − R·i = V, com i medida de a para b por dentro da fonte (negativa quando a fonte fornece energia).
          if (e.a > 0) {
            A[e.a - 1]![m]! += 1;
            A[m]![e.a - 1]! += 1;
          }
          if (e.b > 0) {
            A[e.b - 1]![m]! -= 1;
            A[m]![e.b - 1]! -= 1;
          }
          A[m]![m]! -= e.R ?? 0;
          z[m] = e.V;
          break;
        }
        case "C":
          if (dt === undefined) stampG(e.a, e.b, GMIN);
          else if (e.i0 === undefined) {
            // Euler implícito: i_n = (C/dt)(v_n − v0)
            const G = e.C / dt;
            stampG(e.a, e.b, G);
            stampI(e.b, e.a, G * e.v0);
          } else {
            const G = (2 * e.C) / dt;
            stampG(e.a, e.b, G);
            // i_n = G v_n − (G v0 + i0): fonte equivalente injetando (G v0 + i0) de b para a.
            stampI(e.b, e.a, G * e.v0 + e.i0);
          }
          break;
        case "L":
          if (dt === undefined) {
            const m = branch.get(k)!;
            if (e.a > 0) {
              A[e.a - 1]![m]! += 1;
              A[m]![e.a - 1]! += 1;
            }
            if (e.b > 0) {
              A[e.b - 1]![m]! -= 1;
              A[m]![e.b - 1]! -= 1;
            }
          } else if (e.v0 === undefined) {
            // Euler implícito: i_n = i0 + (dt/L) v_n
            stampG(e.a, e.b, dt / e.L);
            stampI(e.a, e.b, e.i0);
          } else {
            const G = dt / (2 * e.L);
            stampG(e.a, e.b, G);
            // i_n = G v_n + (i0 + G v0)
            stampI(e.a, e.b, e.i0 + G * e.v0);
          }
          break;
        case "D": {
          const Is = e.Is ?? 2.52e-9;
          const nVt = (e.n ?? 1.752) * VT;
          const vd = Math.min((vGuess[e.a] ?? 0) - (vGuess[e.b] ?? 0), 1.2);
          const ex = Math.exp(vd / nVt);
          const id = Is * (ex - 1);
          const gd = (Is / nVt) * ex + GMIN;
          stampG(e.a, e.b, gd);
          // Linearização: i ≈ id + gd (v − vd) → fonte equivalente id − gd·vd de a para b.
          stampI(e.a, e.b, id - gd * vd);
          break;
        }
      }
    });

    x = solveLinear(A, z);
    if (!x) break;
    if (!diodes) break;
    let maxDelta = 0;
    for (let n = 1; n < nodeCount; n++) {
      const target = x[n - 1]!;
      const delta = target - vGuess[n]!;
      maxDelta = Math.max(maxDelta, Math.abs(delta));
      // Limita o passo de Newton para não estourar a exponencial do diodo.
      vGuess[n] = vGuess[n]! + Math.max(-0.5, Math.min(0.5, delta));
    }
    if (maxDelta < 1e-9) {
      converged = true;
      break;
    }
  }

  if (!x) {
    const zeros = elements.map(() => 0);
    return { v: new Array<number>(nodeCount).fill(0), i: zeros, dv: zeros.slice(), converged: false, singular: true };
  }

  const v = [0, ...x.slice(0, N)];
  const dv = elements.map((e) => v[e.a]! - v[e.b]!);
  const i = elements.map((e, k) => {
    switch (e.kind) {
      case "R":
        return dv[k]! / Math.max(e.R, 1e-9);
      case "I":
        // Corrente a → b por dentro da fonte (sentido da seta).
        return e.I;
      case "V":
      case "L":
        if (e.kind === "L" && dt !== undefined) {
          if (e.v0 === undefined) return e.i0 + (dt / e.L) * dv[k]!;
          const G = dt / (2 * e.L);
          return G * dv[k]! + e.i0 + G * e.v0;
        }
        // Incógnita de ramo: corrente que sai do nó a entrando no elemento.
        return x![branch.get(k)!]!;
      case "C":
        if (dt === undefined) return 0;
        if (e.i0 === undefined) return (e.C / dt) * (dv[k]! - e.v0);
        return ((2 * e.C) / dt) * (dv[k]! - e.v0) - e.i0;
      case "D": {
        const Is = e.Is ?? 2.52e-9;
        const nVt = (e.n ?? 1.752) * VT;
        return Is * (Math.exp(Math.min(dv[k]!, 1.2) / nVt) - 1);
      }
    }
  });
  return { v, i, dv, converged, singular: false };
}

/** Atualiza o histórico de capacitores e indutores após um passo transitório. */
export function commitHistory(elements: Element[], sol: Solution): void {
  elements.forEach((e, k) => {
    if (e.kind === "C" || e.kind === "L") {
      e.v0 = sol.dv[k]!;
      e.i0 = sol.i[k]!;
    }
  });
}

/** Une nós ligados por fios ideais (union-find) e renumera a partir do terra. */
export class NodeMap {
  private parent = new Map<string, string>();

  private find(k: string): string {
    let r = k;
    while (this.parent.get(r) !== undefined && this.parent.get(r) !== r) r = this.parent.get(r)!;
    this.parent.set(k, r);
    return r;
  }

  add(k: string): void {
    if (!this.parent.has(k)) this.parent.set(k, k);
  }

  union(a: string, b: string): void {
    this.add(a);
    this.add(b);
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent.set(ra, rb);
  }

  /** Numeração final: `ground` vira 0, os demais grupos 1..n-1. */
  number(ground?: string): { index: (k: string) => number; count: number } {
    const ids = new Map<string, number>();
    if (ground !== undefined) {
      this.add(ground);
      ids.set(this.find(ground), 0);
    }
    let next = ids.size ? 1 : 0;
    for (const k of this.parent.keys()) {
      const r = this.find(k);
      if (!ids.has(r)) ids.set(r, next++);
    }
    return { index: (k) => ids.get(this.find(k)) ?? 0, count: Math.max(next, 1) };
  }
}
