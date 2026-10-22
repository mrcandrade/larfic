/**
 * Equação de Laplace ∇·(κ∇V) = 0 em volta de um capacitor de placas finitas,
 * num corte 2D (placas muito profundas na direção z). Diferenças finitas
 * com volumes finitos (κ por célula) e sobre-relaxação sucessiva (SOR).
 *
 * Unidades: comprimentos em cm; potenciais normalizados (placa de cima em
 * +1/2, de baixo em −1/2, borda do domínio aterrada em 0). Como o problema é
 * linear, o potencial real é V_real = ΔV · V.
 */

export interface PlateGeom {
  /** Comprimento das placas (cm). */
  Lp: number;
  /** Separação entre as placas (cm). */
  d: number;
  /** Borda esquerda do bloco dielétrico (cm); o bloco tem comprimento Lp e espessura d. */
  slab: number;
  kappa: number;
}

export interface Box {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

export interface Grid {
  nx: number;
  ny: number;
  h: number;
  x0: number;
  y0: number;
  /** Potencial normalizado nos nós (i + j·nx). */
  V: Float64Array;
  /** 0 livre, 1 placa de cima, 2 placa de baixo, 3 borda aterrada. */
  kind: Uint8Array;
  /** κ por célula (i + j·(nx−1)), célula entre os nós (i, j) e (i+1, j+1). */
  kc: Float64Array;
  /** Coeficientes de acoplamento por nó: direita, esquerda, cima, baixo. */
  cR: Float64Array;
  cL: Float64Array;
  cU: Float64Array;
  cD: Float64Array;
  /** Índices i dos extremos das placas e j das placas. */
  i0: number;
  i1: number;
  jTop: number;
  jBot: number;
  iterations: number;
}

/** Domínio de cálculo para uma geometria: cobre o bloco fora das placas e deixa folga até a borda aterrada. */
export function domainFor(g: Pick<PlateGeom, "Lp" | "d">): Box {
  return { xMin: -g.Lp / 2 - 7, xMax: g.Lp / 2 + g.Lp + 4, yMin: -(g.d / 2 + 8), yMax: g.d / 2 + 8 };
}

/** Passo da grade: as placas caem exatamente sobre linhas de nós (y = ±d/2 = ±k·h). */
export function gridStep(d: number, target = 0.25): { h: number; k: number } {
  const k = Math.max(2, Math.round(d / 2 / target));
  return { h: d / 2 / k, k };
}

function build(g: PlateGeom, box: Box): Grid {
  const { h, k } = gridStep(g.d);
  const mL = Math.ceil((-g.Lp / 2 - box.xMin) / h);
  const x0 = -g.Lp / 2 - mL * h;
  const nx = mL + Math.ceil((box.xMax + g.Lp / 2) / h) + 1;
  const mB = Math.ceil((g.d / 2 - box.yMin) / h) - k;
  const y0 = -(k + mB) * h;
  const ny = Math.round((box.yMax - y0) / h) + 1;
  const jBot = mB;
  const jTop = mB + 2 * k;
  const i0 = mL;
  const i1 = mL + Math.max(1, Math.round(g.Lp / h));
  const N = nx * ny;
  const V = new Float64Array(N);
  const kind = new Uint8Array(N);
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const n = i + j * nx;
      if (i === 0 || j === 0 || i === nx - 1 || j === ny - 1) kind[n] = 3;
      else if (i >= i0 && i <= i1 && j === jTop) kind[n] = 1;
      else if (i >= i0 && i <= i1 && j === jBot) kind[n] = 2;
      V[n] = kind[n] === 1 ? 0.5 : kind[n] === 2 ? -0.5 : 0;
    }
  }
  // κ por célula: dielétrico entre as placas, no intervalo x ∈ [slab, slab + Lp].
  const kc = new Float64Array((nx - 1) * (ny - 1)).fill(1);
  for (let j = jBot; j < jTop; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const xc = x0 + (i + 0.5) * h;
      if (xc > g.slab && xc < g.slab + g.Lp) kc[i + j * (nx - 1)] = g.kappa;
    }
  }
  const cell = (i: number, j: number) => (i < 0 || j < 0 || i >= nx - 1 || j >= ny - 1 ? 1 : kc[i + j * (nx - 1)]!);
  const cR = new Float64Array(N);
  const cL = new Float64Array(N);
  const cU = new Float64Array(N);
  const cD = new Float64Array(N);
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const n = i + j * nx;
      // Ligação horizontal (i,j)–(i+1,j): média das células acima e abaixo dela.
      cR[n] = 0.5 * (cell(i, j) + cell(i, j - 1));
      cL[n] = 0.5 * (cell(i - 1, j) + cell(i - 1, j - 1));
      cU[n] = 0.5 * (cell(i, j) + cell(i - 1, j));
      cD[n] = 0.5 * (cell(i, j - 1) + cell(i - 1, j - 1));
    }
  }
  return { nx, ny, h, x0, y0, V, kind, kc, cR, cL, cU, cD, i0, i1, jTop, jBot, iterations: 0 };
}

function relax(G: Grid, tol: number, maxIter: number): void {
  const { nx, ny, V, kind, cR, cL, cU, cD } = G;
  const omega = 2 / (1 + Math.PI / Math.max(nx, ny));
  let it = 0;
  for (; it < maxIter; it++) {
    let maxD = 0;
    for (let j = 1; j < ny - 1; j++) {
      for (let i = 1; i < nx - 1; i++) {
        const n = i + j * nx;
        if (kind[n] !== 0) continue;
        const r = cR[n]!;
        const l = cL[n]!;
        const u = cU[n]!;
        const dd = cD[n]!;
        const target = (r * V[n + 1]! + l * V[n - 1]! + u * V[n + nx]! + dd * V[n - nx]!) / (r + l + u + dd);
        const dv = omega * (target - V[n]!);
        V[n] = V[n]! + dv;
        const a = Math.abs(dv);
        if (a > maxD) maxD = a;
      }
    }
    if (maxD < tol) break;
  }
  G.iterations = it;
}

let cacheKey = "";
let cacheGrid: Grid | null = null;

/** Resolve (ou devolve do cache) o potencial normalizado. Reaproveita a última solução como chute inicial. */
export function solve(g: PlateGeom, box: Box = domainFor(g), tol = 1e-7, maxIter = 6000): Grid {
  const key = [g.Lp, g.d, g.slab.toFixed(3), g.kappa, box.xMin, box.xMax, box.yMin, box.yMax, tol].join("|");
  if (key === cacheKey && cacheGrid) return cacheGrid;
  const G = build(g, box);
  if (cacheGrid && cacheGrid.nx === G.nx && cacheGrid.ny === G.ny && cacheGrid.h === G.h) {
    for (let n = 0; n < G.V.length; n++) if (G.kind[n] === 0) G.V[n] = cacheGrid.V[n]!;
  }
  relax(G, tol, maxIter);
  cacheKey = key;
  cacheGrid = G;
  return G;
}

/**
 * Carga normalizada da placa de cima: Q/(ε₀ w ΔV), pela forma discreta da Lei de
 * Gauss (soma de κ·ΔV nas ligações que saem da placa). Igual a C/(ε₀ w).
 */
export function plateCharge(G: Grid): number {
  const { nx, V, kind, cR, cL, cU, cD, jTop, i0, i1 } = G;
  let q = 0;
  for (let i = i0; i <= i1; i++) {
    const n = i + jTop * nx;
    const v = V[n]!;
    if (kind[n + 1] !== 1) q += cR[n]! * (v - V[n + 1]!);
    if (kind[n - 1] !== 1) q += cL[n]! * (v - V[n - 1]!);
    q += cU[n]! * (v - V[n + nx]!);
    q += cD[n]! * (v - V[n - nx]!);
  }
  return q;
}

/** Campo normalizado (−∇V, em 1/cm) por interpolação bilinear dos valores nos centros das células. */
export function fieldAt(G: Grid, x: number, y: number): [number, number] {
  const { nx, ny, h, x0, y0, V } = G;
  const fx = (x - x0) / h - 0.5;
  const fy = (y - y0) / h - 0.5;
  const ci = Math.max(0, Math.min(nx - 3, Math.floor(fx)));
  const cj = Math.max(0, Math.min(ny - 3, Math.floor(fy)));
  const tx = Math.max(0, Math.min(1, fx - ci));
  const ty = Math.max(0, Math.min(1, fy - cj));
  const cellE = (i: number, j: number): [number, number] => {
    const n = i + j * nx;
    const v00 = V[n]!;
    const v10 = V[n + 1]!;
    const v01 = V[n + nx]!;
    const v11 = V[n + nx + 1]!;
    return [-((v10 + v11) - (v00 + v01)) / (2 * h), -((v01 + v11) - (v00 + v10)) / (2 * h)];
  };
  const a = cellE(ci, cj);
  const b = cellE(ci + 1, cj);
  const c = cellE(ci, cj + 1);
  const e = cellE(ci + 1, cj + 1);
  const lerp = (p: number, q: number, r: number, s: number) => (1 - ty) * ((1 - tx) * p + tx * q) + ty * ((1 - tx) * r + tx * s);
  return [lerp(a[0], b[0], c[0], e[0]), lerp(a[1], b[1], c[1], e[1])];
}

/** Potencial normalizado por interpolação bilinear. */
export function potentialAt(G: Grid, x: number, y: number): number {
  const { nx, ny, h, x0, y0, V } = G;
  const fx = (x - x0) / h;
  const fy = (y - y0) / h;
  const i = Math.max(0, Math.min(nx - 2, Math.floor(fx)));
  const j = Math.max(0, Math.min(ny - 2, Math.floor(fy)));
  const tx = fx - i;
  const ty = fy - j;
  const n = i + j * nx;
  return (1 - ty) * ((1 - tx) * V[n]! + tx * V[n + 1]!) + ty * ((1 - tx) * V[n + nx]! + tx * V[n + nx + 1]!);
}

/** Segmentos das curvas de nível V = level (marching squares). */
export function contour(G: Grid, level: number): [number, number, number, number][] {
  const { nx, ny, h, x0, y0, V } = G;
  const segs: [number, number, number, number][] = [];
  for (let j = 0; j < ny - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const n = i + j * nx;
      const v = [V[n]! - level, V[n + 1]! - level, V[n + nx + 1]! - level, V[n + nx]! - level];
      const px = [x0 + i * h, x0 + (i + 1) * h, x0 + (i + 1) * h, x0 + i * h];
      const py = [y0 + j * h, y0 + j * h, y0 + (j + 1) * h, y0 + (j + 1) * h];
      const pts: [number, number][] = [];
      for (let e = 0; e < 4; e++) {
        const a = v[e]!;
        const b = v[(e + 1) % 4]!;
        if ((a < 0) !== (b < 0)) {
          const t = a / (a - b);
          const f = (e + 1) % 4;
          pts.push([px[e]! + t * (px[f]! - px[e]!), py[e]! + t * (py[f]! - py[e]!)]);
        }
      }
      if (pts.length === 2) segs.push([pts[0]![0], pts[0]![1], pts[1]![0], pts[1]![1]]);
      else if (pts.length === 4) {
        segs.push([pts[0]![0], pts[0]![1], pts[1]![0], pts[1]![1]]);
        segs.push([pts[2]![0], pts[2]![1], pts[3]![0], pts[3]![1]]);
      }
    }
  }
  return segs;
}

/**
 * Pontos de partida das linhas de E na placa positiva, espaçados de modo que
 * cada linha carregue o mesmo fluxo de E (densidade de linhas ∝ |E|).
 */
export function seeds(G: Grid, count: number): [number, number][] {
  const { nx, h, x0, y0, V, kind, jTop, i0, i1 } = G;
  const cand: { x: number; y: number; w: number }[] = [];
  const yT = y0 + jTop * h;
  // Face de baixo (esq. → dir.), lado direito, face de cima (dir. → esq.), lado esquerdo.
  for (let i = i0; i <= i1; i++) {
    const n = i + jTop * nx;
    cand.push({ x: x0 + i * h, y: yT - h / 2, w: Math.max(0, V[n]! - V[n - nx]!) });
  }
  {
    const n = i1 + jTop * nx;
    if (kind[n + 1] === 0) cand.push({ x: x0 + i1 * h + h / 2, y: yT, w: Math.max(0, V[n]! - V[n + 1]!) });
  }
  for (let i = i1; i >= i0; i--) {
    const n = i + jTop * nx;
    cand.push({ x: x0 + i * h, y: yT + h / 2, w: Math.max(0, V[n]! - V[n + nx]!) });
  }
  {
    const n = i0 + jTop * nx;
    if (kind[n - 1] === 0) cand.push({ x: x0 + i0 * h - h / 2, y: yT, w: Math.max(0, V[n]! - V[n - 1]!) });
  }
  const total = cand.reduce((s, c) => s + c.w, 0);
  const out: [number, number][] = [];
  if (total <= 0) return out;
  let acc = 0;
  let k = 0;
  for (const c of cand) {
    const next = acc + c.w;
    while (k < count && ((k + 0.5) / count) * total <= next) {
      out.push([c.x, c.y]);
      k++;
    }
    acc = next;
  }
  return out;
}

/** Traça uma linha de E a partir de um ponto, até chegar à placa negativa ou sair do domínio. */
export function trace(G: Grid, x: number, y: number, maxSteps = 4000): [number, number][] {
  const { h, x0, y0, nx, ny, jBot, jTop, i0, i1 } = G;
  const pts: [number, number][] = [[x, y]];
  const ds = 0.3 * h;
  const xa = x0 + i0 * h;
  const xb = x0 + i1 * h;
  const yB = y0 + jBot * h;
  const yT = y0 + jTop * h;
  for (let s = 0; s < maxSteps; s++) {
    const e1 = fieldAt(G, x, y);
    const m1 = Math.hypot(e1[0], e1[1]);
    if (m1 < 1e-12) break;
    const xm = x + (0.5 * ds * e1[0]) / m1;
    const ym = y + (0.5 * ds * e1[1]) / m1;
    const e2 = fieldAt(G, xm, ym);
    const m2 = Math.hypot(e2[0], e2[1]);
    if (m2 < 1e-12) break;
    x += (ds * e2[0]) / m2;
    y += (ds * e2[1]) / m2;
    pts.push([x, y]);
    if (x < x0 + h || x > x0 + (nx - 2) * h || y < y0 + h || y > y0 + (ny - 2) * h) break;
    if (x >= xa - h / 2 && x <= xb + h / 2 && Math.abs(y - yB) < h / 2) break;
    if (s > 5 && x >= xa - h / 2 && x <= xb + h / 2 && Math.abs(y - yT) < h / 3) break;
  }
  return pts;
}
