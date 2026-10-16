import { num, type Params } from "@fisilab/core";

export type Pt = [number, number];

/** Área e centroide de um polígono simples (vértices em ordem). */
export function areaCentroid(poly: Pt[]): { A: number; cx: number; cy: number } {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x0, y0] = poly[i]!;
    const [x1, y1] = poly[(i + 1) % poly.length]!;
    const c = x0 * y1 - x1 * y0;
    a += c;
    cx += (x0 + x1) * c;
    cy += (y0 + y1) * c;
  }
  a /= 2;
  if (Math.abs(a) < 1e-14) return { A: 0, cx: 0, cy: 0 };
  return { A: Math.abs(a), cx: cx / (6 * a), cy: cy / (6 * a) };
}

/** Parte do polígono abaixo da reta y = w (Sutherland–Hodgman com um semiplano). */
export function clipBelow(poly: Pt[], w: number): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < poly.length; i++) {
    const P = poly[i]!;
    const Q = poly[(i + 1) % poly.length]!;
    const pin = P[1] <= w, qin = Q[1] <= w;
    if (pin) out.push(P);
    if (pin !== qin) {
      const t = (w - P[1]) / (Q[1] - P[1]);
      out.push([P[0] + t * (Q[0] - P[0]), w]);
    }
  }
  return out;
}

// ---------- Navio (seção retangular 2D, por metro de comprimento) ----------

export interface Hull {
  B: number; // boca (largura), m
  H: number; // pontal (altura do casco), m
  T: number; // calado com o navio aprumado, m
  KG: number; // altura de G acima da quilha, m
  xG: number; // deslocamento lateral de G (carga deslocada), m
  rho: number; // densidade da água
  g: number;
}

export function hullOf(p: Params): Hull {
  const H = num(p, "Hc", 3);
  return {
    B: num(p, "B", 6),
    H,
    T: Math.min(num(p, "T", 1.2), 0.9 * H),
    KG: num(p, "KG", 1.8),
    xG: num(p, "xG", 0),
    rho: num(p, "rhoF", 1025),
    g: 9.81,
  };
}

/** Área submersa (m² por metro de comprimento) = volume deslocado por metro. */
export const displaced = (h: Hull) => h.B * h.T;
/** Massa por metro de comprimento. */
export const massPerLength = (h: Hull) => h.rho * displaced(h);
/** Raio de giração ao quadrado (casco homogêneo): k² = (B² + H²)/12. */
export const gyration2 = (h: Hull) => (h.B * h.B + h.H * h.H) / 12;
export const inertia = (h: Hull) => massPerLength(h) * gyration2(h);

/** KB = T/2, BM = I_flutuação/V = B²/(12T), GM = KB + BM − KG. */
export function metacentric(h: Hull) {
  const KB = h.T / 2;
  const BM = (h.B * h.B) / (12 * h.T);
  return { KB, BM, KM: KB + BM, GM: KB + BM - h.KG };
}

/** Do referencial do casco (u, v; origem no meio da quilha) para o mundo, girando de θ (anti-horário +). */
const rot = (u: number, v: number, th: number): Pt => [u * Math.cos(th) - v * Math.sin(th), u * Math.sin(th) + v * Math.cos(th)];

export interface Heeled {
  corners: Pt[];
  /** Linha d'água (y no referencial girado). */
  w: number;
  submerged: Pt[];
  Bc: Pt;
  Gc: Pt;
  /** Braço de endireitamento GZ = x_G − x_B (positivo restaura quando θ > 0). */
  GZ: number;
  /** Torque do empuxo em torno de G (anti-horário +), N·m por metro. */
  tau: number;
}

export function heel(h: Hull, th: number): Heeled {
  const corners: Pt[] = [rot(-h.B / 2, 0, th), rot(h.B / 2, 0, th), rot(h.B / 2, h.H, th), rot(-h.B / 2, h.H, th)];
  const A0 = displaced(h);
  let lo = Math.min(...corners.map((c) => c[1]));
  let hi = Math.max(...corners.map((c) => c[1]));
  for (let i = 0; i < 64; i++) {
    const mid = (lo + hi) / 2;
    if (areaCentroid(clipBelow(corners, mid)).A < A0) lo = mid;
    else hi = mid;
  }
  const w = (lo + hi) / 2;
  const submerged = clipBelow(corners, w);
  const c = areaCentroid(submerged);
  const Gc = rot(h.xG, h.KG, th);
  const GZ = Gc[0] - c.cx;
  return { corners, w, submerged, Bc: [c.cx, c.cy], Gc, GZ, tau: -h.rho * h.g * A0 * GZ };
}

/** Energia potencial de inclinação (estabilidade dinâmica): ρ g ∇ ∫₀^θ GZ dθ. */
export function heelEnergy(h: Hull, th: number): number {
  const n = 40;
  const dh = th / n;
  let s = 0;
  for (let i = 0; i <= n; i++) {
    const wgt = i === 0 || i === n ? 1 : i % 2 ? 4 : 2;
    s += wgt * heel(h, i * dh).GZ;
  }
  return h.rho * h.g * displaced(h) * (s * dh) / 3;
}

// ---------- Bloco (cubo de aresta a) ----------

export interface Block {
  a: number;
  rhoB: number;
  rhoF: number;
  g: number;
}

export function blockOf(p: Params): Block {
  return { a: num(p, "a", 10) / 100, rhoB: num(p, "rhoB", 2700), rhoF: num(p, "rhoF", 1000), g: 9.81 };
}

export const blockMass = (b: Block) => b.rhoB * b.a ** 3;
/** Profundidade submersa de equilíbrio de quem flutua: a ρ_b/ρ_f. */
export const floatDepth = (b: Block) => (b.rhoB < b.rhoF ? (b.a * b.rhoB) / b.rhoF : Infinity);

/** Empuxo com a base do bloco a uma profundidade d abaixo da superfície. */
export const buoyancy = (b: Block, d: number) => b.rhoF * b.g * b.a * b.a * Math.max(0, Math.min(b.a, d));

/** Dinamômetro: o bloco desce com a mão até flutuar (fio frouxo). Devolve profundidade real e leitura. */
export function dynamometer(b: Block, hand: number) {
  const d = Math.min(hand, floatDepth(b));
  return { d, E: buoyancy(b, d), T: Math.max(0, blockMass(b) * b.g - buoyancy(b, d)) };
}

/** Força líquida no bloco que flutua livre (y = altura da base em relação à superfície). */
export function floatAccel(b: Block, y: number, v: number, zeta: number) {
  const m = blockMass(b);
  const s = Math.max(0, Math.min(b.a, -y));
  const w0 = Math.sqrt((b.rhoF * b.g) / (b.rhoB * b.a));
  const c = 2 * zeta * m * w0 * (s / b.a);
  return (buoyancy(b, -y) - m * b.g - c * v) / m;
}

/** Energia mecânica do bloco livre, com o piso do recipiente (profundidade hw) como referência. */
export function floatEnergy(b: Block, y: number, v: number, hw: number) {
  const m = blockMass(b);
  const k = b.rhoF * b.g * b.a * b.a;
  const s = -y;
  const Ub = s <= 0 ? 0 : s <= b.a ? (k * s * s) / 2 : k * (b.a * b.a / 2 + b.a * (s - b.a));
  return 0.5 * m * v * v + m * b.g * (y + hw + b.a / 2) + Ub;
}
