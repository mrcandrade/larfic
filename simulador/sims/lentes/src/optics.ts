/**
 * Ótica paraxial da bancada: matrizes ABCD com ângulos reduzidos (n·u), de
 * modo que det M = 1 em qualquer associação de elementos no ar.
 */
import { num, type Params } from "@fisilab/core";

/** Matriz [A, B, C, D]. */
export type M2 = [number, number, number, number];

export const I2: M2 = [1, 0, 0, 1];
export const mul = (m2: M2, m1: M2): M2 => [
  m2[0] * m1[0] + m2[1] * m1[2],
  m2[0] * m1[1] + m2[1] * m1[3],
  m2[2] * m1[0] + m2[3] * m1[2],
  m2[2] * m1[1] + m2[3] * m1[3],
];
export const transl = (L: number): M2 => [1, L, 0, 1];
export const thin = (P: number): M2 => [1, 0, -P, 1];

/** Olho reduzido: lente única a 17 mm da retina (no ar), pupila de 4 mm. */
export const EYE_DR = 0.017;
export const PUPIL = 0.004;
/** Distância do ponto próximo de referência para aumento angular. */
export const NEAR = 0.25;
/** Óculos ficam 12 mm à frente do olho. */
export const GLASSES_GAP = 0.012;

export type Kind = "fina" | "espessa" | "olho" | "oculos";

export interface El {
  id: number;
  kind: Kind;
  /** Posição (vértice de entrada, no caso da lente espessa). */
  x: number;
  /** Vergência da lente fina (dioptrias, 1/m). */
  P: number;
}

export interface Bench {
  els: El[];
  /** Objeto: posição e altura (m); no infinito, `inf` e o ângulo vem do parâmetro alfa. */
  ox: number;
  oh: number;
  inf: boolean;
  sel: number | null;
  drag: null | "obj" | number;
  nextId: number;
}

export const DEG = Math.PI / 180;

/** Parâmetros da lente espessa (raios iguais e opostos: biconvexa simétrica). */
export function thickGeom(p: Params) {
  const R = num(p, "Rl", 0.06);
  return { R1: R, R2: -R, d: num(p, "esp", 0.03), n: num(p, "nL", 1.5) };
}

export function thickMatrix(p: Params): M2 {
  const { R1, R2, d, n } = thickGeom(p);
  const P1 = (n - 1) / R1;
  const P2 = (1 - n) / R2;
  return mul(thin(P2), mul(transl(d / n), thin(P1)));
}

/** Fórmula do fabricante de lentes (lente espessa no ar). */
export function lensmakerPower(R1: number, R2: number, d: number, n: number): number {
  return (n - 1) * (1 / R1 - 1 / R2 + ((n - 1) * d) / (n * R1 * R2));
}

export const xIn = (e: El) => e.x;
export const xOut = (e: El, p: Params) => (e.kind === "espessa" ? e.x + thickGeom(p).d : e.x);

export const relaxedPower = (p: Params) => 1 / EYE_DR - num(p, "rx");

function elMatrix(e: El, p: Params, eyeP: number): M2 {
  if (e.kind === "fina") return thin(e.P);
  if (e.kind === "oculos") return thin(num(p, "oculos"));
  if (e.kind === "espessa") return thickMatrix(p);
  return thin(eyeP);
}

export const sorted = (els: El[]) => [...els].sort((a, b) => a.x - b.x);

/** Matriz do plano xa até a saída dos elementos dados (em ordem). */
export function systemMatrix(els: El[], p: Params, xa: number, eyeP = 0): M2 {
  let M = I2;
  let cur = xa;
  for (const e of els) {
    M = mul(elMatrix(e, p, eyeP), mul(transl(xIn(e) - cur), M));
    cur = xOut(e, p);
  }
  return M;
}

/** Caminho de um raio (y, u) que parte do plano xa: pontos em cada elemento e no plano final xb. */
export function rayPath(els: El[], p: Params, xa: number, y0: number, u0: number, xb: number, eyeP = 0): [number, number][] {
  const pts: [number, number][] = [[xa, y0]];
  let y = y0;
  let u = u0;
  let cur = xa;
  for (const e of els) {
    y += (xIn(e) - cur) * u;
    pts.push([xIn(e), y]);
    if (e.kind === "espessa") {
      const { R1, R2, d, n } = thickGeom(p);
      u -= ((n - 1) / R1) * y;
      y += (d / n) * u;
      pts.push([e.x + d, y]);
      u -= ((1 - n) / R2) * y;
    } else {
      const P = e.kind === "fina" ? e.P : e.kind === "oculos" ? num(p, "oculos") : eyeP;
      u -= P * y;
    }
    cur = xOut(e, p);
    if (e.kind === "olho") {
      y += EYE_DR * u;
      pts.push([cur + EYE_DR, y]);
      return pts;
    }
  }
  pts.push([xb, y + (xb - cur) * u]);
  return pts;
}

export interface Img {
  x: number;
  h: number;
  real: boolean;
  /** Índice (na lista de óticas) do elemento após o qual a imagem se forma. */
  k: number;
}

export interface LensAnalysis {
  els: El[];
  optics: El[];
  eye: El | undefined;
  /** Vergência escolhida pelo olho (acomodação) e quanto acima do relaxado. */
  eyeP: number;
  acc: number;
  /** Diâmetro do borrão na retina (m) e posição da imagem formada pelo olho (m após o cristalino). */
  blur: number;
  qEye: number;
  images: Img[];
  /** Imagem final: distância ao último elemento ótico, aumento lateral (objeto finito). */
  q: number;
  m: number;
  afocal: boolean;
  Mang: number;
  feq: number;
}

const BIG = 1e6;

export function analyzeBench(s: Bench, p: Params): LensAnalysis {
  const els = sorted(s.els);
  const eye = els.find((e) => e.kind === "olho");
  const optics = els.filter((e) => e.kind !== "olho" && (!eye || e.x < eye.x));
  const alpha = num(p, "alfa", 1) * DEG;
  const xRef = s.inf ? (optics[0] ? xIn(optics[0]) : eye ? eye.x : 0) : s.ox;
  const out: LensAnalysis = { els, optics, eye, eyeP: 0, acc: 0, blur: 0, qEye: 0, images: [], q: 0, m: 0, afocal: false, Mang: 0, feq: 0 };

  // imagens intermediárias e final
  for (let k = 0; k < optics.length; k++) {
    const M = systemMatrix(optics.slice(0, k + 1), p, xRef);
    const xo = xOut(optics[k]!, p);
    const [A, B, C, D] = M;
    let q: number;
    let h: number;
    let ok = true;
    if (s.inf) {
      if (Math.abs(C) < 1e-9) ok = false;
      q = -A / C;
      h = -alpha / C;
    } else {
      if (Math.abs(D) < 1e-9) ok = false;
      q = -B / D;
      h = s.oh / D;
    }
    const nextX = optics[k + 1] ? xIn(optics[k + 1]!) : eye ? eye.x : Infinity;
    if (ok) out.images.push({ x: xo + q, h, real: q > 0 && xo + q < nextX, k });
    if (k === optics.length - 1) {
      out.afocal = !ok;
      out.q = ok ? q : BIG;
      out.m = s.inf || !ok ? 0 : 1 / D;
    }
  }

  // aumento angular (olho junto à última lente ou no lugar do olho)
  const last = eye ? eye.x : optics.length ? xOut(optics[optics.length - 1]!, p) : xRef;
  const ML = systemMatrix(optics, p, xRef);
  const toLast = mul(transl(last - (optics.length ? xOut(optics[optics.length - 1]!, p) : xRef)), ML);
  out.Mang = s.inf ? toLast[3] : Math.abs(toLast[1]) < 1e-12 ? BIG : NEAR / toLast[1];

  if (optics.length) {
    const S = systemMatrix(optics, p, xIn(optics[0]!));
    out.feq = Math.abs(S[2]) < 1e-9 ? BIG : -1 / S[2];
  }

  if (eye) {
    const pre = mul(transl(eye.x - (optics.length ? xOut(optics[optics.length - 1]!, p) : xRef)), ML);
    const [A, B, C, D] = pre;
    const P0 = relaxedPower(p);
    const amp = Math.max(0, num(p, "acom", 4));
    const need = s.inf ? C / A + 1 / EYE_DR : D / B + 1 / EYE_DR;
    const P = Math.min(P0 + amp, Math.max(P0, need));
    out.eyeP = P;
    out.acc = P - P0;
    const tot = mul(thin(P), pre);
    if (s.inf) {
      const y0 = PUPIL / 2 / A;
      out.blur = 2 * Math.abs((tot[0] + EYE_DR * tot[2]) * y0);
      out.qEye = Math.abs(tot[2]) < 1e-12 ? BIG : -tot[0] / tot[2];
    } else {
      const u0 = PUPIL / 2 / B;
      out.blur = 2 * Math.abs((tot[1] + EYE_DR * tot[3]) * u0);
      out.qEye = Math.abs(tot[3]) < 1e-12 ? BIG : -tot[1] / tot[3];
    }
  }
  return out;
}
