import { num, type Params } from "@fisilab/core";

export const G = 9.81;

// ---------- Venturi ----------

/** Seções do tubo ao longo de x (m): entrada, cone convergente, garganta, difusor, saída. */
export const VX = { in0: 0, c0: 0.3, c1: 0.5, t1: 0.6, d1: 1.0, out1: 1.3 };

export interface Venturi {
  Q: number; // m³/s
  D1: number;
  D2: number;
  rho: number;
  rhoM: number;
  Cd: number;
  K: number;
}

export function venturiOf(p: Params): Venturi {
  const D1 = num(p, "D1", 10) / 100;
  return {
    Q: num(p, "Q", 5) / 1000,
    D1,
    D2: Math.min(num(p, "D2", 5) / 100, 0.9 * D1),
    rho: num(p, "rho", 1000),
    rhoM: num(p, "rhoM", 13600),
    Cd: num(p, "CdV", 0.98),
    K: num(p, "K", 0.15),
  };
}

const smooth = (u: number) => 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, u)));

/** Diâmetro do tubo em x (transições suaves). */
export function diameterAt(v: Venturi, x: number): number {
  if (x <= VX.c0) return v.D1;
  if (x <= VX.c1) return v.D1 + (v.D2 - v.D1) * smooth((x - VX.c0) / (VX.c1 - VX.c0));
  if (x <= VX.t1) return v.D2;
  if (x <= VX.d1) return v.D2 + (v.D1 - v.D2) * smooth((x - VX.t1) / (VX.d1 - VX.t1));
  return v.D1;
}

export const areaAt = (v: Venturi, x: number) => (Math.PI * diameterAt(v, x) ** 2) / 4;
export const speedAt = (v: Venturi, x: number) => v.Q / areaAt(v, x);

/** Δp entre a entrada e a garganta: ρ(v₂² − v₁²)/(2 C_d²). */
export function venturiDp(v: Venturi): number {
  const v1 = speedAt(v, 0), v2 = speedAt(v, VX.c1);
  return (v.rho * (v2 * v2 - v1 * v1)) / (2 * v.Cd * v.Cd);
}

/** Vazão que um medidor ideal (C_d = 1) deduziria do Δp lido. */
export function venturiIdealQ(v: Venturi): number {
  const A2 = (Math.PI * v.D2 * v.D2) / 4;
  const beta4 = (v.D2 / v.D1) ** 4;
  return A2 * Math.sqrt((2 * venturiDp(v)) / (v.rho * (1 - beta4)));
}

/** Perda permanente de pressão: K · ½ρv₂², limitada ao Δp da garganta. */
export function venturiLoss(v: Venturi): number {
  const v2 = speedAt(v, VX.c1);
  return Math.min(venturiDp(v), v.K * 0.5 * v.rho * v2 * v2);
}

/** Desnível do manômetro diferencial: h = Δp / ((ρ_m − ρ) g). */
export const manometerH = (v: Venturi) => venturiDp(v) / ((v.rhoM - v.rho) * G);

/**
 * Pressão manométrica relativa à entrada ao longo do tubo. Até a garganta,
 * Bernoulli corrigido por C_d; no difusor, recupera a pressão na proporção da
 * energia cinética perdida, terminando em −perda permanente.
 * `ideal = true` dá Bernoulli puro (C_d = 1, sem perda).
 */
export function pressureAt(v: Venturi, x: number, ideal = false): number {
  const v1 = speedAt(v, 0);
  const vx = speedAt(v, x);
  const v2 = speedAt(v, VX.c1);
  if (ideal) return -0.5 * v.rho * (vx * vx - v1 * v1);
  if (x <= VX.t1) return (-v.rho * (vx * vx - v1 * v1)) / (2 * v.Cd * v.Cd);
  const p2 = -venturiDp(v);
  const p3 = -venturiLoss(v);
  const f = (v2 * v2 - vx * vx) / Math.max(1e-12, v2 * v2 - v1 * v1);
  return p2 + (p3 - p2) * f;
}

// ---------- Torricelli ----------

export interface Tank {
  A: number; // área do tanque
  a: number; // área do orifício
  Cd: number;
  h0: number;
  zo: number; // altura do orifício acima do chão
  Dt: number;
}

export function tankOf(p: Params): Tank {
  const Dt = num(p, "Dt", 0.3);
  const d = num(p, "d", 3) / 100;
  return { A: (Math.PI * Dt * Dt) / 4, a: (Math.PI * Math.min(d, 0.5 * Dt) ** 2) / 4, Cd: num(p, "CdO", 0.62), h0: num(p, "h0", 1), zo: num(p, "zo", 0.5), Dt };
}

/** Velocidade do jato com a correção do tanque finito: v = √(2gh / (1 − (a/A)²)). */
export const jetSpeed = (k: Tank, h: number) => Math.sqrt((2 * G * Math.max(0, h)) / (1 - (k.a / k.A) ** 2));
export const flowRate = (k: Tank, h: number) => k.Cd * k.a * jetSpeed(k, h);
/** dh/dt = −Q/A. */
export const dhdt = (k: Tank, h: number) => -flowRate(k, h) / k.A;
/** Alcance horizontal do jato que sai na horizontal a uma altura z_o: R = v √(2 z_o/g). */
export const jetRange = (k: Tank, h: number) => jetSpeed(k, h) * Math.sqrt((2 * k.zo) / G);

/** Solução analítica: √h decresce linearmente. */
export function levelExact(k: Tank, t: number): number {
  const c = (k.Cd * k.a) / k.A * Math.sqrt(G / 2 / (1 - (k.a / k.A) ** 2));
  const s = Math.sqrt(k.h0) - c * t;
  return s > 0 ? s * s : 0;
}

export function drainTime(k: Tank): number {
  const c = (k.Cd * k.a) / k.A * Math.sqrt(G / 2 / (1 - (k.a / k.A) ** 2));
  return Math.sqrt(k.h0) / c;
}
