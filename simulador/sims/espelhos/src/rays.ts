/**
 * Traçador de raios 2D para ótica geométrica.
 *
 * A cena é um conjunto de fronteiras (segmentos, círculos, arcos e polilinhas
 * com normal analítica) mais uma função `nAt(p)` que devolve o índice de
 * refração em cada ponto. Em cada interseção o índice dos dois lados é lido
 * de `nAt`, então qualquer arranjo de meios funciona sem rotular as faces.
 *
 * Em cada interface o raio se divide em refletido e transmitido com as
 * intensidades de Fresnel; espelhos refletem tudo e absorvedores param o raio.
 *
 * Este arquivo é copiado igual entre as sims de ótica (refracao, espelhos,
 * lentes, prisma) para que cada uma seja independente do núcleo.
 */

export type V = [number, number];

export const vadd = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1]];
export const vsub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1]];
export const vmul = (a: V, k: number): V => [a[0] * k, a[1] * k];
export const vdot = (a: V, b: V): number => a[0] * b[0] + a[1] * b[1];
export const vcross = (a: V, b: V): number => a[0] * b[1] - a[1] * b[0];
export const vlen = (a: V): number => Math.hypot(a[0], a[1]);
export const vnorm = (a: V): V => {
  const l = Math.hypot(a[0], a[1]);
  return l > 0 ? [a[0] / l, a[1] / l] : [1, 0];
};
export const vdir = (ang: number): V => [Math.cos(ang), Math.sin(ang)];

/** Propriedades comuns de uma fronteira. */
interface BoundaryBase {
  /** Espelho perfeito (reflete 100%). */
  mirror?: boolean;
  /** Absorve o raio (anteparo, retina, parede). */
  absorb?: boolean;
  /** Rótulo devolvido nos segmentos que terminam nesta fronteira. */
  tag?: string;
}

export type Boundary =
  | (BoundaryBase & { kind: "seg"; a: V; b: V })
  | (BoundaryBase & { kind: "circle"; c: V; r: number })
  /** Arco do ângulo a0 ao a1 (radianos, sentido anti-horário). */
  | (BoundaryBase & { kind: "arc"; c: V; r: number; a0: number; a1: number })
  /** Curva amostrada; `normalAt` dá a normal exata (por exemplo, de uma parábola). */
  | (BoundaryBase & { kind: "poly"; pts: V[]; normalAt?: (p: V) => V });

export interface Scene {
  boundaries: Boundary[];
  /** Índice de refração no ponto (1 no ar). */
  nAt(p: V): number;
}

/** 0 = luz natural (média), 1 = polarização s (TE), 2 = polarização p (TM). */
export type Pol = 0 | 1 | 2;

export interface Fresnel {
  R: number;
  T: number;
  /** Reflexão interna total. */
  tir: boolean;
  /** Cosseno do ângulo de transmissão (0 se RIT). */
  cost: number;
}

/** Coeficientes de Fresnel em intensidade para incidência com cosseno `cosi`. */
export function fresnel(n1: number, n2: number, cosi: number, pol: Pol = 0): Fresnel {
  const ci = Math.min(1, Math.abs(cosi));
  const sinT2 = (n1 / n2) ** 2 * (1 - ci * ci);
  if (sinT2 >= 1) return { R: 1, T: 0, tir: true, cost: 0 };
  const ct = Math.sqrt(1 - sinT2);
  const rs = (n1 * ci - n2 * ct) / (n1 * ci + n2 * ct);
  const rp = (n2 * ci - n1 * ct) / (n2 * ci + n1 * ct);
  const R = pol === 1 ? rs * rs : pol === 2 ? rp * rp : (rs * rs + rp * rp) / 2;
  return { R, T: 1 - R, tir: false, cost: ct };
}

/** Direção refletida de `d` numa superfície de normal unitária `n`. */
export function reflectDir(d: V, n: V): V {
  const k = 2 * vdot(d, n);
  return [d[0] - k * n[0], d[1] - k * n[1]];
}

/** Direção refratada (lei de Snell vetorial) ou null na reflexão interna total. */
export function refractDir(d: V, n: V, n1: number, n2: number): V | null {
  let nn = n;
  let cosi = -vdot(d, nn);
  if (cosi < 0) {
    nn = vmul(n, -1);
    cosi = -cosi;
  }
  const eta = n1 / n2;
  const k = 1 - eta * eta * (1 - cosi * cosi);
  if (k < 0) return null;
  const c = eta * cosi - Math.sqrt(k);
  return vnorm([eta * d[0] + c * nn[0], eta * d[1] + c * nn[1]]);
}

export interface Hit {
  t: number;
  p: V;
  /** Normal unitária (orientação qualquer). */
  n: V;
  b: Boundary;
}

const EPS = 1e-9;

function hitSeg(o: V, d: V, a: V, b: V): number {
  const e = vsub(b, a);
  const den = vcross(d, e);
  if (Math.abs(den) < 1e-14) return Infinity;
  const ao = vsub(a, o);
  const t = vcross(ao, e) / den;
  const u = vcross(ao, d) / den;
  return t > EPS && u >= -1e-12 && u <= 1 + 1e-12 ? t : Infinity;
}

function hitCircle(o: V, d: V, c: V, r: number): [number, number] {
  const oc = vsub(o, c);
  const b = vdot(oc, d);
  const cc = vdot(oc, oc) - r * r;
  const disc = b * b - cc;
  if (disc < 0) return [Infinity, Infinity];
  const s = Math.sqrt(disc);
  return [-b - s, -b + s];
}

function angleIn(ang: number, a0: number, a1: number): boolean {
  const TAU = 2 * Math.PI;
  const span = (((a1 - a0) % TAU) + TAU) % TAU;
  const x = (((ang - a0) % TAU) + TAU) % TAU;
  return x <= span + 1e-12;
}

/** Interseção mais próxima do raio o + t·d (t > 0) com uma fronteira. */
export function intersect(o: V, d: V, bd: Boundary): Hit | null {
  if (bd.kind === "seg") {
    const t = hitSeg(o, d, bd.a, bd.b);
    if (!Number.isFinite(t)) return null;
    const e = vnorm(vsub(bd.b, bd.a));
    return { t, p: vadd(o, vmul(d, t)), n: [-e[1], e[0]], b: bd };
  }
  if (bd.kind === "circle" || bd.kind === "arc") {
    const [t1, t2] = hitCircle(o, d, bd.c, bd.r);
    for (const t of [t1, t2]) {
      if (!(t > EPS) || !Number.isFinite(t)) continue;
      const p = vadd(o, vmul(d, t));
      if (bd.kind === "arc" && !angleIn(Math.atan2(p[1] - bd.c[1], p[0] - bd.c[0]), bd.a0, bd.a1)) continue;
      return { t, p, n: vnorm(vsub(p, bd.c)), b: bd };
    }
    return null;
  }
  let best: Hit | null = null;
  for (let i = 0; i + 1 < bd.pts.length; i++) {
    const a = bd.pts[i]!;
    const b = bd.pts[i + 1]!;
    const t = hitSeg(o, d, a, b);
    if (t < (best?.t ?? Infinity)) {
      const e = vnorm(vsub(b, a));
      const p = vadd(o, vmul(d, t));
      best = { t, p, n: bd.normalAt ? vnorm(bd.normalAt(p)) : [-e[1], e[0]], b: bd };
    }
  }
  return best;
}

export function firstHit(scene: Scene, o: V, d: V): Hit | null {
  let best: Hit | null = null;
  for (const bd of scene.boundaries) {
    const h = intersect(o, d, bd);
    if (h && h.t < (best?.t ?? Infinity)) best = h;
  }
  return best;
}

export interface RaySeg {
  a: V;
  b: V;
  /** Intensidade relativa (1 = feixe inicial). */
  I: number;
  /** Índice do meio em que o segmento corre. */
  n: number;
  /** Reflexões e refrações sofridas antes deste segmento. */
  refl: number;
  refr: number;
  /** Como o segmento termina. */
  end: "interface" | "mirror" | "absorb" | "escape" | "limit";
  /** Rótulo da fronteira atingida no fim do segmento. */
  tag?: string;
  /** Ângulo de incidência no fim (rad) e se houve reflexão interna total. */
  theta?: number;
  tir?: boolean;
  /** Fração refletida no fim (Fresnel). */
  R?: number;
  /** Profundidade na árvore de raios (0 = raio inicial). */
  depth: number;
}

export interface TraceOpts {
  /** Gera também o raio refletido parcial em cada interface. */
  branch?: boolean;
  /** Sem `branch`, segue o refletido em vez do transmitido quando R > T. */
  followStrongest?: boolean;
  pol?: Pol;
  maxDepth?: number;
  /** Raios mais fracos que isso são abandonados. */
  minI?: number;
  /** Comprimento do segmento final quando o raio não bate em nada. */
  maxLen?: number;
  /** Teto de segmentos (proteção). */
  maxSegs?: number;
}

/**
 * Traça um raio a partir de `o` na direção `d` e devolve todos os segmentos
 * (incluindo as ramificações refletidas, se `branch`).
 */
export function trace(scene: Scene, o: V, d0: V, opts: TraceOpts = {}, I0 = 1): RaySeg[] {
  const out: RaySeg[] = [];
  const maxDepth = opts.maxDepth ?? 60;
  const minI = opts.minI ?? 1e-3;
  const maxLen = opts.maxLen ?? 100;
  const maxSegs = opts.maxSegs ?? 3000;
  const pol = opts.pol ?? 0;
  const stack: { o: V; d: V; I: number; refl: number; refr: number; depth: number }[] = [
    { o, d: vnorm(d0), I: I0, refl: 0, refr: 0, depth: 0 },
  ];
  while (stack.length && out.length < maxSegs) {
    const r = stack.pop()!;
    const nHere = scene.nAt(vadd(r.o, vmul(r.d, 1e-7)));
    const h = firstHit(scene, r.o, r.d);
    const base = { I: r.I, n: nHere, refl: r.refl, refr: r.refr, depth: r.depth };
    if (!h) {
      out.push({ ...base, a: r.o, b: vadd(r.o, vmul(r.d, maxLen)), end: "escape" });
      continue;
    }
    let nrm = h.n;
    if (vdot(nrm, r.d) > 0) nrm = vmul(nrm, -1);
    const cosi = -vdot(r.d, nrm);
    const theta = Math.acos(Math.min(1, cosi));
    const tag = h.b.tag;
    if (h.b.absorb) {
      out.push({ ...base, a: r.o, b: h.p, end: "absorb", tag, theta });
      continue;
    }
    if (r.depth >= maxDepth) {
      out.push({ ...base, a: r.o, b: h.p, end: "limit", tag, theta });
      continue;
    }
    const next = r.depth + 1;
    if (h.b.mirror) {
      out.push({ ...base, a: r.o, b: h.p, end: "mirror", tag, theta, R: 1 });
      stack.push({ o: h.p, d: vnorm(reflectDir(r.d, nrm)), I: r.I, refl: r.refl + 1, refr: r.refr, depth: next });
      continue;
    }
    const n1 = nHere;
    const n2 = scene.nAt(vadd(h.p, vmul(r.d, 1e-7)));
    const fr = Math.abs(n1 - n2) < 1e-12 ? { R: 0, T: 1, tir: false, cost: cosi } : fresnel(n1, n2, cosi, pol);
    out.push({ ...base, a: r.o, b: h.p, end: "interface", tag, theta, tir: fr.tir, R: fr.R });
    const refl = { o: h.p, d: vnorm(reflectDir(r.d, nrm)), I: r.I * fr.R, refl: r.refl + 1, refr: r.refr, depth: next };
    const tdir = fr.tir ? null : refractDir(r.d, nrm, n1, n2);
    const trans = tdir ? { o: h.p, d: tdir, I: r.I * fr.T, refl: r.refl, refr: r.refr + 1, depth: next } : null;
    if (opts.branch) {
      if (refl.I >= minI) stack.push(refl);
      if (trans && trans.I >= minI) stack.push(trans);
    } else if (!trans || (opts.followStrongest && fr.R > fr.T)) {
      stack.push(refl);
    } else {
      stack.push(trans);
    }
  }
  return out;
}

/** Segmentos do raio "principal": a cadeia de profundidade crescente que começa no raio inicial e segue o mais intenso. */
export function mainPath(segs: RaySeg[]): RaySeg[] {
  const path: RaySeg[] = [];
  let depth = 0;
  let from: V | null = null;
  for (;;) {
    let best: RaySeg | null = null;
    for (const s of segs) {
      if (s.depth !== depth) continue;
      if (from && Math.hypot(s.a[0] - from[0], s.a[1] - from[1]) > 1e-9) continue;
      if (!best || s.I > best.I) best = s;
    }
    if (!best) return path;
    path.push(best);
    from = best.b;
    depth++;
  }
}

/** Cor aproximada de um comprimento de onda visível (nm), algoritmo de Bruton. */
export function wavelengthRGB(nm: number): string {
  let r = 0;
  let g = 0;
  let b = 0;
  if (nm >= 380 && nm < 440) {
    r = -(nm - 440) / 60;
    b = 1;
  } else if (nm < 490) {
    g = (nm - 440) / 50;
    b = 1;
  } else if (nm < 510) {
    g = 1;
    b = -(nm - 510) / 20;
  } else if (nm < 580) {
    r = (nm - 510) / 70;
    g = 1;
  } else if (nm < 645) {
    r = 1;
    g = -(nm - 645) / 65;
  } else if (nm <= 780) {
    r = 1;
  }
  let f = 1;
  if (nm < 420) f = 0.3 + (0.7 * (nm - 380)) / 40;
  else if (nm > 700) f = 0.3 + (0.7 * (780 - nm)) / 80;
  const c = (v: number) => Math.round(255 * Math.pow(Math.max(0, Math.min(1, v * f)), 0.8));
  return `rgb(${c(r)}, ${c(g)}, ${c(b)})`;
}
