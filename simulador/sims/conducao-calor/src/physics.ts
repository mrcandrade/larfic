// Física da condução em barra (diferenças finitas implícitas) e do resfriamento de um corpo.
import { num, type Params } from "@fisilab/core";

export const SIGMA = 5.670374e-8;
export const C_W = 4186;
export const RHO_W = 1000;
/** Número de intervalos da malha da barra (61 nós). */
export const NX = 60;
/** Termopares ao longo da barra, em frações do comprimento. */
export const TC_FRAC = [1 / 6, 2 / 6, 3 / 6, 4 / 6, 5 / 6];
/** Condutância do trocador de calor da extremidade fria (serpentina), W/K. */
export const UA_COLD = 20;

export const MATERIALS = [
  { value: 0, label: "Cobre", k: 385, rho: 8960, c: 385, color: "#c8733a" },
  { value: 1, label: "Alumínio", k: 205, rho: 2700, c: 900, color: "#aab3bd" },
  { value: 2, label: "Latão", k: 109, rho: 8530, c: 380, color: "#c9a54a" },
  { value: 3, label: "Aço carbono", k: 50, rho: 7850, c: 490, color: "#6f7782" },
];
export const materialOf = (p: Params) => MATERIALS[Math.round(num(p, "material", 0))] ?? MATERIALS[0]!;

export const modeOf = (p: Params) => Math.round(num(p, "modo", 0));
export const ritmo = (p: Params) => num(p, "ritmo", 50);
export const Ta = (p: Params) => num(p, "Ta", 22);

// ---------- Barra ----------
export const barL = (p: Params) => num(p, "Lb", 0.3);
export const barD = (p: Params) => num(p, "Db", 25) / 1000;
export const barA = (p: Params) => (Math.PI * barD(p) ** 2) / 4;
export const barPerim = (p: Params) => Math.PI * barD(p);
export const Thot = (p: Params) => num(p, "Tq", 100);
export const Tin = (p: Params) => num(p, "Te", 18);
/** Vazão mássica da água de resfriamento, kg/s (parâmetro em mL/min). */
export const mdot = (p: Params) => (num(p, "vazao", 40) * 1e-6 * RHO_W) / 60;
/** Condutância efetiva barra → água: ṁc (1 − e^{−UA/ṁc}) (efetividade do trocador). */
export function coldG(p: Params): number {
  const C = mdot(p) * C_W;
  return C <= 0 ? 0 : C * (1 - Math.exp(-UA_COLD / C));
}
export const hLat = (p: Params) => num(p, "hl", 0);

/** Resolve sistema tridiagonal (a: sub, b: diagonal, c: super, d: termo independente). */
function thomas(a: number[], b: number[], c: number[], d: number[]): number[] {
  const n = d.length;
  const cp = new Array<number>(n), dp = new Array<number>(n);
  cp[0] = c[0]! / b[0]!;
  dp[0] = d[0]! / b[0]!;
  for (let i = 1; i < n; i++) {
    const m = b[i]! - a[i]! * cp[i - 1]!;
    cp[i] = c[i]! / m;
    dp[i] = (d[i]! - a[i]! * dp[i - 1]!) / m;
  }
  const x = new Array<number>(n);
  x[n - 1] = dp[n - 1]!;
  for (let i = n - 2; i >= 0; i--) x[i] = dp[i]! - cp[i]! * x[i + 1]!;
  return x;
}

/**
 * Um passo de Euler implícito da equação do calor na barra, nós 0..NX.
 * Nó 0 preso à temperatura da fonte quente; nó NX troca calor com a água (condutância G);
 * perdas laterais h P (T − T_amb). Com h = ∞ (dt = Infinity) dá o regime estacionário.
 */
export function barStep(T: number[], p: Params, h: number): number[] {
  const m = materialOf(p);
  const L = barL(p), dx = L / NX, A = barA(p);
  const K = (m.k * A) / dx; // condutância entre nós
  const Hl = hLat(p) * barPerim(p) * dx; // perda lateral de um nó interno
  const C = m.rho * m.c * A * dx; // capacidade de um nó interno
  const inv = Number.isFinite(h) ? 1 / h : 0;
  const G = coldG(p), ta = Ta(p);
  const n = NX + 1;
  const a = new Array<number>(n).fill(0), b = new Array<number>(n).fill(0), c = new Array<number>(n).fill(0), d = new Array<number>(n).fill(0);
  b[0] = 1;
  d[0] = Thot(p);
  for (let i = 1; i < NX; i++) {
    a[i] = -K;
    c[i] = -K;
    b[i] = C * inv + 2 * K + Hl;
    d[i] = C * inv * T[i]! + Hl * ta;
  }
  a[NX] = -K;
  b[NX] = (C / 2) * inv + K + Hl / 2 + G;
  d[NX] = (C / 2) * inv * T[NX]! + (Hl / 2) * ta + G * Tin(p);
  return thomas(a, b, c, d);
}

/** Perfil estacionário da barra (mesma discretização). */
export const barSteady = (p: Params) => barStep(new Array<number>(NX + 1).fill(0), p, Infinity);

/** Temperatura na posição x (interpolação linear entre nós). */
export function tempAt(T: number[], p: Params, x: number): number {
  const u = Math.min(Math.max(x / barL(p), 0), 1) * NX;
  const i = Math.min(NX - 1, Math.floor(u));
  const f = u - i;
  return (1 - f) * (T[i] ?? 0) + f * (T[i + 1] ?? 0);
}

/** Fluxos de calor (W): entrando pela fonte quente, saindo para a água e perdido lateralmente. */
export function barFluxes(T: number[], p: Params) {
  const m = materialOf(p);
  const dx = barL(p) / NX, A = barA(p);
  const K = (m.k * A) / dx;
  const Hl = hLat(p) * barPerim(p) * dx;
  const ta = Ta(p);
  const T0 = T[0] ?? 0, T1 = T[1] ?? 0, TN = T[NX] ?? 0;
  const qin = K * (T0 - T1) + (Hl / 2) * (T0 - ta);
  const qw = coldG(p) * (TN - Tin(p));
  let qlat = (Hl / 2) * (T0 - ta + TN - ta);
  for (let i = 1; i < NX; i++) qlat += Hl * ((T[i] ?? 0) - ta);
  return { qin, qw, qlat };
}

/** Temperatura de saída da água, °C. */
export const waterOut = (T: number[], p: Params) => Tin(p) + barFluxes(T, p).qw / Math.max(1e-12, mdot(p) * C_W);

// ---------- Resfriamento ----------
export const BODIES = [
  { value: 0, label: "Béquer com água" },
  { value: 1, label: "Esfera de cobre" },
  { value: 2, label: "Esfera de alumínio" },
];
export const BEAKER_D = 0.07;
export const BEAKER_GLASS = { m: 0.1, c: 840 };

/** Capacidade térmica (J/K), área exposta (m²) e altura característica (m) do corpo. */
export function body(p: Params): { C: number; A: number; Lc: number; label: string } {
  const k = Math.round(num(p, "corpo", 1));
  if (k === 0) {
    const V = num(p, "Va", 250) * 1e-6;
    const r = BEAKER_D / 2;
    const H = V / (Math.PI * r * r);
    return { C: RHO_W * V * C_W + BEAKER_GLASS.m * BEAKER_GLASS.c, A: Math.PI * BEAKER_D * H + Math.PI * r * r, Lc: H, label: "Béquer com água" };
  }
  const D = num(p, "Dc", 50) / 1000;
  const mat = k === 1 ? MATERIALS[0]! : MATERIALS[1]!;
  return { C: (mat.rho * Math.PI * D ** 3 * mat.c) / 6, A: Math.PI * D * D, Lc: D, label: `Esfera de ${mat.label.toLowerCase()}` };
}

export const newtonH = (p: Params) => num(p, "h", 10);
/** Constante de tempo de Newton τ = C/(hA), s. */
export const newtonTau = (p: Params) => {
  const b = body(p);
  return b.C / (newtonH(p) * b.A);
};
/** Coeficiente de convecção natural laminar, h = 1,32 (ΔT/L)^{1/4} W/(m²·K). */
export const hNatural = (dT: number, Lc: number) => 1.32 * (Math.abs(dT) / Lc) ** 0.25;

/** Potência perdida pelo corpo, W, e suas parcelas. */
export function coolingPower(T: number, p: Params): { total: number; conv: number; rad: number } {
  const b = body(p), ta = Ta(p);
  if (Math.round(num(p, "modelo", 0)) === 0) {
    const q = newtonH(p) * b.A * (T - ta);
    return { total: q, conv: q, rad: 0 };
  }
  const conv = hNatural(T - ta, b.Lc) * b.A * (T - ta);
  const rad = num(p, "eps", 0.9) * SIGMA * b.A * ((T + 273.15) ** 4 - (ta + 273.15) ** 4);
  return { total: conv + rad, conv, rad };
}
