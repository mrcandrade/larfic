import { num, type Params } from "@fisilab/core";

/**
 * Dois modelos microscópicos de equilíbrio térmico.
 *
 * Modo 0 — distribuição de Boltzmann: N osciladores quânticos (níveis E = nε) trocam quanta
 * ao acaso (doador e receptor sorteados; a troca só ocorre se o doador tiver quantum). A cadeia
 * é simétrica, então todos os microestados com a mesma energia total são igualmente prováveis
 * e a fração de osciladores no nível n tende a P(n) = (1 − x) xⁿ, x = e^{−ε/kT}, com
 * kT/ε = 1/ln(1 + 1/q̄).
 *
 * Modo 1 — dois gases 2D de discos rígidos (massas m_A e m_B) separados por uma parede de massa M
 * que se move só em x e colide elasticamente com as moléculas. Parede livre: equilíbrio mecânico
 * (P_A = P_B) e, pelas colisões, térmico (T_A = T_B). Parede presa por mola rígida: fixa em média,
 * mas vibra e conduz energia (diatérmica). Parede adiabática: massa infinita. Sem parede: mistura.
 *
 * Unidades internas do modo 1: nm, ps, u. k_B = 0,0083145 u·nm²/(ps²·K).
 */

export const KB = 1.380649e-23;
export const KB_R = 0.00831446; // u·nm²/(ps²·K)
export const U_PS2 = 1.66053907e-3; // 1 u/ps² em N/m (pressão 2D)
export const ZJ_PER_UNIT = 1.66053907; // 1 u·nm²/ps² = 1,66 zJ
export const MEV = 1.602176634e-22; // J
export const W = 40; // largura da caixa (nm)
export const H = 16; // altura (nm)
export const RAD = 0.25; // raio dos discos (nm)
export const NSUB = 25; // subpassos por passo do runner
export const DT_MD = 0.04; // ps por subpasso → 1 ps por passo
export const KSPRING = 150; // u/ps² (parede diatérmica fixa)
export const NLEV = 30; // níveis mostrados no histograma
export const NVB = 24; // bins de rapidez
export const HIST_DECAY = 0.97;

export interface BzState {
  mode: number;
  rs: number;
  k: number;
  // ---- modo 0 ----
  q: Int32Array;
  Q: number;
  /** Histograma médio (média móvel) da fração em cada nível. */
  avg: Float64Array;
  // ---- modo 1 ----
  x: Float64Array;
  y: Float64Array;
  vx: Float64Array;
  vy: Float64Array;
  sp: Uint8Array;
  /** Parede: posição (nm), velocidade (nm/ps), posição de repouso da mola. */
  X: number;
  V: number;
  X0: number;
  grab: boolean;
  tp: number;
  /** Pressões medidas nas paredes externas (média móvel, u/ps²). */
  PA: number;
  PB: number;
  /** Histogramas de rapidez (média móvel) por espécie e rapidez máxima mostrada. */
  hA: Float64Array;
  hB: Float64Array;
  vmax: number;
}

/** Gerador mulberry32 com estado guardado no próprio estado da sim. */
export function rnd(s: { rs: number }): number {
  s.rs = (s.rs + 0x6d2b79f5) >>> 0;
  let t = s.rs;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function gauss(s: { rs: number }): number {
  let u = 0;
  while (u === 0) u = rnd(s);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd(s));
}

export const massA = (p: Params) => num(p, "mA", 4);
export const massB = (p: Params) => num(p, "mB", 40);
export const wallKind = (p: Params) => Math.round(num(p, "parede", 0));
export const pistonMass = (p: Params) => num(p, "M", 40);

// ---------- Modo 0: osciladores ----------
/** kT/ε de equilíbrio para q̄ quanta por oscilador. */
export const kTeps = (qbar: number) => (qbar <= 0 ? 0 : 1 / Math.log(1 + 1 / qbar));
/** Fração esperada no nível n (distribuição geométrica = Boltzmann para níveis igualmente espaçados). */
export function boltzP(n: number, qbar: number): number {
  const x = qbar / (1 + qbar);
  return (1 - x) * x ** n;
}
export function levelCounts(q: Int32Array): Float64Array {
  const c = new Float64Array(NLEV);
  for (let i = 0; i < q.length; i++) {
    const n = q[i]!;
    if (n < NLEV) c[n] = c[n]! + 1;
  }
  return c;
}
/** Ajuste ponderado de ln f(n) = a − n ε/kT; devolve kT/ε medido. */
export function fitKT(f: Float64Array, N: number): number {
  let sw = 0, sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (let n = 0; n < f.length; n++) {
    const cnt = f[n]! * N;
    if (cnt < 3) continue;
    const w = cnt;
    const yv = Math.log(f[n]!);
    sw += w; sx += w * n; sy += w * yv; sxx += w * n * n; sxy += w * n * yv;
  }
  const den = sw * sxx - sx * sx;
  if (sw === 0 || Math.abs(den) < 1e-12) return 0;
  const slope = (sw * sxy - sx * sy) / den;
  return slope < 0 ? -1 / slope : 0;
}

// ---------- Inicialização ----------
const E0 = new Float64Array(0);
function blank(mode: number, seed: number): BzState {
  return {
    mode, rs: (Math.imul(seed, 0x9e3779b1) ^ 0x5bd1e995) >>> 0, k: 0,
    q: new Int32Array(0), Q: 0, avg: new Float64Array(NLEV),
    x: E0, y: E0, vx: E0, vy: E0, sp: new Uint8Array(0),
    X: W / 2, V: 0, X0: W / 2, grab: false, tp: 0, PA: 0, PB: 0,
    hA: new Float64Array(NVB), hB: new Float64Array(NVB), vmax: 1,
  };
}

export function initState(p: Params): BzState {
  const mode = Math.round(num(p, "modo"));
  const s = blank(mode, Math.round(num(p, "seed", 1)));
  if (mode === 0) {
    const N = Math.round(num(p, "N", 400));
    const qbar = num(p, "qbar", 2);
    const Q = Math.round(qbar * N);
    const q = new Int32Array(N);
    const ini = Math.round(num(p, "ini", 0));
    if (ini === 0) {
      for (let i = 0; i < N; i++) q[i] = Math.floor(Q / N) + (i < Q % N ? 1 : 0);
    } else {
      const few = Math.max(1, Math.round(N / 20));
      for (let i = 0; i < few; i++) q[i] = Math.floor(Q / few) + (i < Q % few ? 1 : 0);
    }
    s.q = q;
    s.Q = Q;
    s.avg = levelCounts(q).map((c) => c / N);
    return s;
  }
  const NA = Math.round(num(p, "NA", 80));
  const NB = Math.round(num(p, "NB", 80));
  const n = NA + NB;
  s.x = new Float64Array(n);
  s.y = new Float64Array(n);
  s.vx = new Float64Array(n);
  s.vy = new Float64Array(n);
  s.sp = new Uint8Array(n);
  const kind = wallKind(p);
  const X0 = kind === 3 ? W / 2 : W * num(p, "x0", 0.5);
  s.X = X0;
  s.X0 = X0;
  const place = (i: number, xa: number, xb: number) => {
    for (let tries = 0; tries < 400; tries++) {
      const xi = xa + RAD + rnd(s) * (xb - xa - 2 * RAD);
      const yi = RAD + rnd(s) * (H - 2 * RAD);
      let ok = true;
      for (let j = 0; j < i && ok; j++) if ((xi - s.x[j]!) ** 2 + (yi - s.y[j]!) ** 2 < 4.4 * RAD * RAD) ok = false;
      if (ok || tries === 399) {
        s.x[i] = xi;
        s.y[i] = yi;
        return;
      }
    }
  };
  for (let i = 0; i < n; i++) {
    const b = i >= NA ? 1 : 0;
    s.sp[i] = b;
    place(i, b ? X0 + 0.05 : 0, b ? W : X0 - 0.05);
  }
  const TA = num(p, "TA", 600), TB = num(p, "TB", 200);
  const mA = massA(p), mB = massB(p);
  for (const b of [0, 1]) {
    const m = b ? mB : mA;
    const T = b ? TB : TA;
    const idx = [...Array(n).keys()].filter((i) => s.sp[i] === b);
    if (!idx.length) continue;
    let mx = 0, my = 0;
    for (const i of idx) {
      s.vx[i] = gauss(s);
      s.vy[i] = gauss(s);
      mx += s.vx[i]!;
      my += s.vy[i]!;
    }
    mx /= idx.length;
    my /= idx.length;
    let e = 0;
    for (const i of idx) {
      s.vx[i] = s.vx[i]! - mx;
      s.vy[i] = s.vy[i]! - my;
      e += s.vx[i]! ** 2 + s.vy[i]! ** 2;
    }
    // Energia exata: Σ ½ m v² = N k T (2 graus de liberdade)
    const f = Math.sqrt((2 * idx.length * KB_R * T) / (m * Math.max(e, 1e-12)));
    for (const i of idx) {
      s.vx[i] = s.vx[i]! * f;
      s.vy[i] = s.vy[i]! * f;
    }
  }
  const Tmax = Math.max(TA, TB);
  s.vmax = 3.6 * Math.sqrt((KB_R * Tmax) / Math.min(mA, mB));
  const T0 = gasT(s, 0, mA), T1 = gasT(s, 1, mB);
  s.PA = (NA * KB_R * T0) / (H * X0);
  s.PB = (NB * KB_R * T1) / (H * (W - X0));
  return s;
}

// ---------- Observáveis do gás ----------
export function countOf(s: BzState, b: number): number {
  let c = 0;
  for (let i = 0; i < s.sp.length; i++) if (s.sp[i] === b) c++;
  return c;
}
/** Temperatura 2D de uma espécie: Σ ½ m v² = N k T. */
export function gasT(s: BzState, b: number, m: number): number {
  let e = 0, c = 0;
  for (let i = 0; i < s.sp.length; i++)
    if (s.sp[i] === b) {
      e += s.vx[i]! ** 2 + s.vy[i]! ** 2;
      c++;
    }
  return c ? (0.5 * m * e) / (c * KB_R) : 0;
}
export function totalEnergy(s: BzState, p: Params): number {
  if (s.mode === 0) return (s.Q * num(p, "eps", 10) * MEV) / 1e-21;
  const mA = massA(p), mB = massB(p);
  let e = 0;
  for (let i = 0; i < s.sp.length; i++) e += 0.5 * (s.sp[i] ? mB : mA) * (s.vx[i]! ** 2 + s.vy[i]! ** 2);
  const kind = wallKind(p);
  if (kind === 0 || kind === 1) e += 0.5 * pistonMass(p) * s.V ** 2;
  if (kind === 1) e += 0.5 * KSPRING * (s.X - s.X0) ** 2;
  return e * ZJ_PER_UNIT;
}
/** Áreas ocupadas por cada gás (nm²); sem parede, os dois ocupam a caixa toda. */
export function areas(s: BzState, p: Params): [number, number] {
  if (wallKind(p) === 3) return [W * H, W * H];
  return [s.X * H, (W - s.X) * H];
}

// ---------- Passo ----------
export function step(s0: BzState, p: Params): BzState {
  const s: BzState = { ...s0 };
  s.k = s0.k + 1;
  if (s.mode === 0) {
    const q = s0.q.slice();
    const N = q.length;
    for (let m = 0; m < N; m++) {
      const i = Math.floor(rnd(s) * N);
      const j = Math.floor(rnd(s) * N);
      if (i !== j && q[i]! > 0) {
        q[i] = q[i]! - 1;
        q[j] = q[j]! + 1;
      }
    }
    s.q = q;
    const c = levelCounts(q);
    const avg = new Float64Array(NLEV);
    for (let n = 0; n < NLEV; n++) avg[n] = HIST_DECAY * s0.avg[n]! + (1 - HIST_DECAY) * (c[n]! / N);
    s.avg = avg;
    return s;
  }
  s.x = s0.x.slice();
  s.y = s0.y.slice();
  s.vx = s0.vx.slice();
  s.vy = s0.vy.slice();
  mdStep(s, p);
  s.tp = s0.tp + NSUB * DT_MD;
  // histogramas de rapidez
  const hA = s0.hA.map((v) => v * HIST_DECAY);
  const hB = s0.hB.map((v) => v * HIST_DECAY);
  for (let i = 0; i < s.sp.length; i++) {
    const v = Math.hypot(s.vx[i]!, s.vy[i]!);
    const b = Math.floor((v / s.vmax) * NVB);
    if (b < NVB) {
      const h = s.sp[i] ? hB : hA;
      h[b] = h[b]! + 1;
    }
  }
  s.hA = hA;
  s.hB = hB;
  return s;
}

function mdStep(s: BzState, p: Params) {
  const n = s.sp.length;
  const mA = massA(p), mB = massB(p);
  const kind = wallKind(p); // 0 livre, 1 diatérmica fixa (mola), 2 adiabática fixa, 3 sem parede
  const M = pistonMass(p);
  const mOf = (i: number) => (s.sp[i] ? mB : mA);
  let impA = 0, impB = 0;
  const cell = 2 * RAD;
  const nx = Math.ceil(W / cell), ny = Math.ceil(H / cell);
  const head = new Int32Array(nx * ny);
  const next = new Int32Array(n);
  for (let sub = 0; sub < NSUB; sub++) {
    // parede
    if (kind === 0 || kind === 1) {
      if (kind === 1) s.V -= ((KSPRING * (s.X - s.X0)) / M) * DT_MD;
      if (!s.grab) s.X += s.V * DT_MD;
      if (s.X < 2) { s.X = 2; s.V = Math.abs(s.V); }
      if (s.X > W - 2) { s.X = W - 2; s.V = -Math.abs(s.V); }
    }
    for (let i = 0; i < n; i++) {
      s.x[i] = s.x[i]! + s.vx[i]! * DT_MD;
      s.y[i] = s.y[i]! + s.vy[i]! * DT_MD;
    }
    // paredes externas
    for (let i = 0; i < n; i++) {
      const m = mOf(i);
      if (s.x[i]! < RAD && s.vx[i]! < 0) {
        s.vx[i] = -s.vx[i]!;
        s.x[i] = 2 * RAD - s.x[i]!;
        impA += 2 * m * s.vx[i]!;
      } else if (s.x[i]! > W - RAD && s.vx[i]! > 0) {
        impB += 2 * m * s.vx[i]!;
        s.vx[i] = -s.vx[i]!;
        s.x[i] = 2 * (W - RAD) - s.x[i]!;
      }
      if (s.y[i]! < RAD && s.vy[i]! < 0) {
        s.vy[i] = -s.vy[i]!;
        s.y[i] = 2 * RAD - s.y[i]!;
      } else if (s.y[i]! > H - RAD && s.vy[i]! > 0) {
        s.vy[i] = -s.vy[i]!;
        s.y[i] = 2 * (H - RAD) - s.y[i]!;
      }
      // parede interna
      if (kind !== 3) {
        const left = s.sp[i] === 0;
        const hit = left ? s.x[i]! > s.X - RAD && s.vx[i]! > s.V : s.x[i]! < s.X + RAD && s.vx[i]! < s.V;
        if (hit) {
          if (kind === 2 || s.grab) {
            s.vx[i] = 2 * s.V - s.vx[i]!;
          } else {
            const u = s.vx[i]!;
            const U = s.V;
            s.vx[i] = ((m - M) * u + 2 * M * U) / (m + M);
            s.V = ((M - m) * U + 2 * m * u) / (m + M);
          }
          s.x[i] = left ? Math.min(s.x[i]!, s.X - RAD) : Math.max(s.x[i]!, s.X + RAD);
        }
      }
    }
    // colisões entre discos (lista de células)
    head.fill(-1);
    for (let i = 0; i < n; i++) {
      const cx = Math.min(nx - 1, Math.max(0, Math.floor(s.x[i]! / cell)));
      const cy = Math.min(ny - 1, Math.max(0, Math.floor(s.y[i]! / cell)));
      const c = cy * nx + cx;
      next[i] = head[c]!;
      head[c] = i;
    }
    const d2 = 4 * RAD * RAD;
    for (let i = 0; i < n; i++) {
      const cx = Math.min(nx - 1, Math.max(0, Math.floor(s.x[i]! / cell)));
      const cy = Math.min(ny - 1, Math.max(0, Math.floor(s.y[i]! / cell)));
      for (let oy = -1; oy <= 1; oy++)
        for (let ox = -1; ox <= 1; ox++) {
          const X = cx + ox, Y = cy + oy;
          if (X < 0 || Y < 0 || X >= nx || Y >= ny) continue;
          for (let j = head[Y * nx + X]!; j >= 0; j = next[j]!) {
            if (j <= i) continue;
            if (kind !== 3 && s.sp[i] !== s.sp[j]) continue;
            const dx = s.x[j]! - s.x[i]!, dy = s.y[j]! - s.y[i]!;
            const r2 = dx * dx + dy * dy;
            if (r2 >= d2 || r2 < 1e-12) continue;
            const dvx = s.vx[j]! - s.vx[i]!, dvy = s.vy[j]! - s.vy[i]!;
            const vn = (dvx * dx + dvy * dy) / r2;
            if (vn >= 0) continue; // já se afastando
            const mi = mOf(i), mj = mOf(j);
            const fi = (2 * mj) / (mi + mj), fj = (2 * mi) / (mi + mj);
            s.vx[i] = s.vx[i]! + fi * vn * dx;
            s.vy[i] = s.vy[i]! + fi * vn * dy;
            s.vx[j] = s.vx[j]! - fj * vn * dx;
            s.vy[j] = s.vy[j]! - fj * vn * dy;
          }
        }
    }
  }
  const tau = NSUB * DT_MD;
  const a = 0.04; // média móvel ~ 25 ps
  s.PA = (1 - a) * s.PA + (a * impA) / (tau * H);
  s.PB = (1 - a) * s.PB + (a * impB) / (tau * H);
}

/** Distribuição de Maxwell 2D normalizada: f(v) = (m v / kT) e^{−m v²/2kT}. */
export function maxwell2d(v: number, T: number, m: number): number {
  if (T <= 0) return 0;
  const a = m / (KB_R * T);
  return a * v * Math.exp(-0.5 * a * v * v);
}

/** Pressão 2D do gás ideal N k T / A (u/ps²). */
export const idealP = (N: number, T: number, A: number) => (A > 0 ? (N * KB_R * T) / A : 0);
