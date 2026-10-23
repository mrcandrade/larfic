import { num, type Params } from "@fisilab/core";

/**
 * Indução e transformador, em três montagens:
 *   0 — ímã caindo (ou empurrado) através de uma bobina: fem pela lei de
 *       Faraday com o fluxo exato de um dipolo numa bobina de comprimento finito,
 *       e frenagem magnética quando a bobina está fechada numa carga;
 *   1 — bobina primária longa com corrente variável e bobina secundária
 *       enrolada sobre ela (indutância mútua);
 *   2 — transformador com núcleo (ferro laminado, ferro maciço ou ar),
 *       resolvido em regime senoidal pelo circuito equivalente em T com
 *       dispersão (acoplamento k), resistência do cobre, perdas no núcleo
 *       e saturação.
 */

export const MU0 = 4e-7 * Math.PI;
export const G = 9.81;

export const mode = (p: Params) => Math.min(2, Math.max(0, Math.round(num(p, "modo"))));
export const N1 = (p: Params) => num(p, "N1", 500);
export const N2 = (p: Params) => num(p, "N2", 200);
/** Raio da bobina de detecção (m); o parâmetro está em cm. */
export const radius = (p: Params) => num(p, "a", 1.5) / 100;
export const RL = (p: Params) => num(p, "RL", 1e6);
/** Carga com o valor máximo do controle é tratada como circuito aberto (só o osciloscópio, 1 MΩ). */
export const loadOpen = (p: Params) => RL(p) >= 1e6 - 1;
export const freq = (p: Params) => num(p, "f", 60);

// ---------------------------------------------------------------------------
// Modo 0: ímã e bobina

/** Comprimento da bobina (m), massa do ímã (kg), resistência do fio por metro (Ω/m), piso (m). */
export const LC = 0.02;
export const MASS = 6e-3;
export const WIRE = 0.54;
export const FLOOR = -0.25;

export const coilR = (p: Params) => N2(p) * 2 * Math.PI * radius(p) * WIRE;

/**
 * Fluxo concatenado Λ(z) = N Φ de um dipolo m no eixo de uma bobina de
 * comprimento LC, raio a e N espiras uniformes, com o ímã a uma distância z
 * do centro: Λ = (N μ0 m / 2LC) [u/√(a² + u²)] entre u = z − LC/2 e z + LC/2.
 */
export function linkage(p: Params, z: number): number {
  const a = radius(p);
  const m = num(p, "mom", 0.8);
  const F = (u: number) => u / Math.sqrt(a * a + u * u);
  return ((N2(p) * MU0 * m) / (2 * LC)) * (F(LC / 2 - z) - F(-LC / 2 - z));
}

/** dΛ/dz (Wb/m). */
export function dLinkage(p: Params, z: number): number {
  const a = radius(p);
  const m = num(p, "mom", 0.8);
  const g = (u: number) => (a * a) / (a * a + u * u) ** 1.5;
  return ((N2(p) * MU0 * m) / (2 * LC)) * (-g(LC / 2 - z) + g(-LC / 2 - z));
}

/** fem induzida ε = −dΛ/dt = −(dΛ/dz)·v. */
export const emfMagnet = (p: Params, z: number, v: number) => -dLinkage(p, z) * v;
/** Resistência total do circuito da bobina (bobina + carga); com carga aberta, só a entrada do osciloscópio. */
export const loopR = (p: Params) => coilR(p) + (loadOpen(p) ? 1e6 : RL(p));

/** Estado do modo 0: [t, z, v, ε máx, ε mín, ∫|ε|dt, arrastando, z alvo, ∫ε dt]. */
export const T = 0,
  Z = 1,
  V = 2,
  EMAX = 3,
  EMIN = 4,
  AREA = 5,
  DRAG = 6,
  ZT = 7,
  INT = 8;

/** Aceleração do ímã: gravidade + frenagem magnética (−(dΛ/dz)² v / R) ou mola de arraste. */
function accel(p: Params, z: number, v: number, drag: boolean, zt: number): number {
  if (drag) {
    const w = 40;
    return w * w * (zt - z) - 2 * w * v;
  }
  const k = dLinkage(p, z);
  return -G - (k * k * v) / (loopR(p) * MASS);
}

export function stepMagnet(s: number[], p: Params, dt: number): number[] {
  const out = s.slice();
  const drag = s[DRAG]! > 0.5;
  const zt = s[ZT]!;
  let z = s[Z]!;
  let v = s[V]!;
  // RK4 em [z, v]
  const f = (zz: number, vv: number): [number, number] => [vv, accel(p, zz, vv, drag, zt)];
  const [k1z, k1v] = f(z, v);
  const [k2z, k2v] = f(z + 0.5 * dt * k1z, v + 0.5 * dt * k1v);
  const [k3z, k3v] = f(z + 0.5 * dt * k2z, v + 0.5 * dt * k2v);
  const [k4z, k4v] = f(z + dt * k3z, v + dt * k3v);
  const e0 = emfMagnet(p, z, v);
  z += (dt / 6) * (k1z + 2 * k2z + 2 * k3z + k4z);
  v += (dt / 6) * (k1v + 2 * k2v + 2 * k3v + k4v);
  if (z < FLOOR) {
    z = FLOOR;
    v = 0;
  }
  const e1 = emfMagnet(p, z, v);
  out[T] = s[T]! + dt;
  out[Z] = z;
  out[V] = v;
  out[EMAX] = Math.max(s[EMAX]!, e1);
  out[EMIN] = Math.min(s[EMIN]!, e1);
  out[AREA] = s[AREA]! + 0.5 * dt * (Math.abs(e0) + Math.abs(e1));
  out[INT] = s[INT]! + 0.5 * dt * (e0 + e1);
  return out;
}

/** Velocidade de queda livre ao passar pelo centro da bobina (sem frenagem). */
export const vFree = (p: Params) => Math.sqrt(2 * G * num(p, "h", 0.5));

// ---------------------------------------------------------------------------
// Modo 1: indutância mútua

/** Comprimento da bobina primária (solenoide longo), em m. */
export const L_PRIM = 0.15;
/** M = μ0 N1 N2 π a² / ℓ1 (secundária enrolada sobre a primária). */
export const mutual = (p: Params) => (MU0 * N1(p) * N2(p) * Math.PI * radius(p) ** 2) / L_PRIM;
export const triangular = (p: Params) => Math.round(num(p, "forma")) === 1;
export const I0 = (p: Params) => num(p, "I0", 0.5);

/** Corrente no primário e sua derivada no instante t. */
export function primaryI(p: Params, t: number): { i: number; di: number } {
  const f = freq(p);
  if (!triangular(p)) {
    const w = 2 * Math.PI * f;
    return { i: I0(p) * Math.sin(w * t), di: I0(p) * w * Math.cos(w * t) };
  }
  const u = t * f - Math.floor(t * f);
  const i = u < 0.25 ? 4 * u : u < 0.75 ? 2 - 4 * u : 4 * u - 4;
  const di = u < 0.25 || u >= 0.75 ? 4 * f : -4 * f;
  return { i: I0(p) * i, di: I0(p) * di };
}

/** fem na secundária: ε = −M di₁/dt. */
export const emfMutual = (p: Params, t: number) => -mutual(p) * primaryI(p, t).di;
/** Amplitude da fem: ωMI₀ (senoide) ou 4fMI₀ (triangular → quadrada). */
export const emfMutualPeak = (p: Params) => mutual(p) * I0(p) * (triangular(p) ? 4 * freq(p) : 2 * Math.PI * freq(p));

// ---------------------------------------------------------------------------
// Modo 2: transformador

type Cx = [number, number];
const add = (a: Cx, b: Cx): Cx => [a[0] + b[0], a[1] + b[1]];
const sub = (a: Cx, b: Cx): Cx => [a[0] - b[0], a[1] - b[1]];
const mul = (a: Cx, b: Cx): Cx => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
const div = (a: Cx, b: Cx): Cx => {
  const d = b[0] * b[0] + b[1] * b[1];
  return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d];
};
const abs = (a: Cx) => Math.hypot(a[0], a[1]);
const par = (a: Cx, b: Cx): Cx => div(mul(a, b), add(a, b));

export const CORES = ["Ferro laminado", "Ferro maciço", "Ar (sem núcleo)"] as const;
export const core = (p: Params) => Math.min(2, Math.max(0, Math.round(num(p, "nucleo"))));

/** Seção do núcleo (m²), caminho magnético (m), permeabilidade relativa e saturação (T). */
export const AC = 4e-4;
export const PATH = 0.2;
export const MUR = 4000;
export const BSAT = 1.6;
/** Resistência do cobre por espira (Ω) e resistência interna da fonte (Ω). */
export const R_TURN = 0.003;
export const R_SRC = 0.5;

/** Permeância Λ (H por espira²) com permeabilidade relativa efetiva μ. */
const permeance = (p: Params, mu: number) => (core(p) === 2 ? (MU0 * Math.PI * 0.02 ** 2) / 0.04 : (MU0 * mu * AC) / PATH);
/** Acoplamento: quase total com núcleo de ferro, fraco no ar. */
export const coupling = (p: Params) => (core(p) === 2 ? 0.6 : 0.995);

/** Resistência equivalente de perdas no núcleo, vista do primário (Ω): Foucault ∥ histerese. */
export function coreLossR(p: Params): number {
  const c = core(p);
  if (c === 2) return Infinity;
  const n = (N1(p) / 500) ** 2;
  const eddy = (c === 0 ? 6000 : 60) * n;
  const hyst = 3000 * n * (freq(p) / 60) ** 0.6;
  return (eddy * hyst) / (eddy + hyst);
}

export interface Xfmr {
  V1: number;
  V2: number;
  I1: number;
  I2: number;
  /** Fases (rad) de V1, V2 e I1 em relação à fonte. */
  phV1: number;
  phV2: number;
  phI1: number;
  P1: number;
  P2: number;
  Pcu: number;
  Pcore: number;
  /** Corrente no ramo de magnetização (Lm ∥ Rc) e indução de pico no núcleo. */
  Im: number;
  B: number;
  mu: number;
}

/** Resolve o transformador em regime senoidal (valores eficazes). `open` força o secundário aberto. */
export function solveXfmr(p: Params, open = loadOpen(p)): Xfmr {
  const w = 2 * Math.PI * freq(p);
  const n1 = N1(p);
  const n2 = N2(p);
  const a = n1 / n2;
  const k = coupling(p);
  const Vs: Cx = [num(p, "V1", 12), 0];
  const R1: Cx = [R_TURN * n1, 0];
  const R2r: Cx = [a * a * R_TURN * n2, 0];
  const Rc = coreLossR(p);
  let mu = MUR;
  let sol: Xfmr | undefined;
  for (let it = 0; it < 60; it++) {
    const Lam = permeance(p, mu);
    const Ll: Cx = [0, w * n1 * n1 * Lam * (1 - k)];
    const Lm: Cx = [0, w * k * n1 * n1 * Lam];
    const Zm: Cx = Number.isFinite(Rc) ? par(Lm, [Rc, 0]) : Lm;
    const Z2: Cx | undefined = open ? undefined : add(add(R2r, Ll), [a * a * RL(p), 0]);
    const Zpar = Z2 ? par(Zm, Z2) : Zm;
    const Zin = add(add(R1, Ll), Zpar);
    const I1 = div(Vs, add([R_SRC, 0], Zin));
    const V1 = sub(Vs, mul([R_SRC, 0], I1));
    const Em = mul(I1, Zpar);
    const I2r: Cx = Z2 ? div(Em, Z2) : [0, 0];
    const I2: Cx = [a * I2r[0], a * I2r[1]];
    const V2: Cx = Z2 ? [I2[0] * RL(p), I2[1] * RL(p)] : [Em[0] / a, Em[1] / a];
    const Im = div(Em, Zm);
    const B = (Math.SQRT2 * abs(Em)) / (w * n1 * (core(p) === 2 ? Math.PI * 0.02 ** 2 : AC));
    const P1 = V1[0] * I1[0] + V1[1] * I1[1];
    const i1 = abs(I1);
    const i2 = abs(I2);
    sol = {
      V1: abs(V1),
      V2: abs(V2),
      I1: i1,
      I2: i2,
      phV1: Math.atan2(V1[1], V1[0]),
      phV2: Math.atan2(V2[1], V2[0]),
      phI1: Math.atan2(I1[1], I1[0]),
      P1,
      P2: Z2 ? i2 * i2 * RL(p) : 0,
      Pcu: i1 * i1 * R1[0] + i2 * i2 * R_TURN * n2,
      Pcore: Number.isFinite(Rc) ? (abs(Em) ** 2) / Rc : 0,
      Im: abs(Im),
      B,
      mu,
    };
    if (core(p) === 2) break;
    // Saturação: μ efetivo cai quando B se aproxima de B_sat (iteração amortecida)
    const target = MUR / (1 + (B / BSAT) ** 6);
    if (Math.abs(target - mu) < 1e-6 * MUR) break;
    mu = 0.5 * mu + 0.5 * target;
  }
  return sol!;
}

const memo = new Map<string, { load: Xfmr; open: Xfmr }>();
/** Solução com memória (depende só dos parâmetros). */
export function xfmr(p: Params): { load: Xfmr; open: Xfmr } {
  const key = ["N1", "N2", "V1", "f", "RL", "nucleo"].map((k) => num(p, k, NaN)).join("|");
  const m = memo.get(key);
  if (m) return m;
  const r = { load: solveXfmr(p), open: solveXfmr(p, true) };
  if (memo.size > 64) memo.clear();
  memo.set(key, r);
  return r;
}

// ---------------------------------------------------------------------------

export function init(p: Params): number[] {
  const h = num(p, "h", 0.5);
  return [0, mode(p) === 0 ? h : 0, 0, 0, 0, 0, 0, h, 0];
}

export function step(s: number[], p: Params, dt: number): number[] {
  if (mode(p) === 0) return stepMagnet(s, p, dt);
  const out = s.slice();
  out[T] = s[T]! + dt;
  return out;
}
