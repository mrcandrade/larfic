// Lattice Boltzmann D2Q9 (BGK) para o escoamento em torno de um cilindro num canal.
// Entrada com velocidade uniforme, saída com gradiente nulo, paredes com deslizamento livre
// e cilindro com bounce-back; a força no cilindro vem do método de troca de momento.

export const NX = 180;
export const NY = 60;
/** Raio do cilindro e posição do centro (em células). */
export const R_CYL = 6;
export const U0 = 0.1;

const EX = [0, 1, 0, -1, 0, 1, -1, -1, 1];
const EY = [0, 0, 1, 0, -1, 1, 1, -1, -1];
const W = [4 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 36, 1 / 36, 1 / 36, 1 / 36];
const OPP = [0, 3, 4, 1, 2, 7, 8, 5, 6];
/** Reflexão especular nas paredes de cima e de baixo (troca o sinal de e_y). */
const REFY = [0, 1, 4, 3, 2, 8, 7, 6, 5];

export interface Lbm {
  f: Float32Array;
  ux: Float32Array;
  uy: Float32Array;
  solid: Uint8Array;
  cx: number;
  cy: number;
  /** Passos de rede já dados. */
  steps: number;
  /** Força no cilindro no último passo (unidades de rede). */
  fx: number;
  fy: number;
  /** Histórico de C_L e C_D (últimos valores, um a cada `HIST_EVERY` passos). */
  cl: number[];
  cd: number[];
  /** Passos de rede dos últimos cruzamentos ascendentes de C_L por zero. */
  cross: number[];
  /** Último valor de u_y na sonda da esteira. */
  wake: number;
  /** Traçadores (corante) em coordenadas de célula. */
  dye: number[];
}

export const HIST_EVERY = 10;
const SPONGE = 30;
export const HIST_LEN = 240;

export const tauOf = (re: number) => 3 * ((U0 * 2 * R_CYL) / re) + 0.5;

function feq(i: number, rho: number, ux: number, uy: number): number {
  const eu = EX[i]! * ux + EY[i]! * uy;
  return W[i]! * rho * (1 + 3 * eu + 4.5 * eu * eu - 1.5 * (ux * ux + uy * uy));
}

export function makeSolid(cx: number, cy: number): Uint8Array {
  const s = new Uint8Array(NX * NY);
  for (let y = 0; y < NY; y++)
    for (let x = 0; x < NX; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= R_CYL * R_CYL) s[x + y * NX] = 1;
  return s;
}

export function makeLbm(cx = 40, cy = NY / 2 + 0.6): Lbm {
  const f = new Float32Array(NX * NY * 9);
  const ux = new Float32Array(NX * NY);
  const uy = new Float32Array(NX * NY);
  const solid = makeSolid(cx, cy);
  for (let k = 0; k < NX * NY; k++) {
    const u = solid[k] ? 0 : U0;
    ux[k] = u;
    for (let i = 0; i < 9; i++) f[k * 9 + i] = feq(i, 1, u, 0);
  }
  return { f, ux, uy, solid, cx, cy, steps: 0, fx: 0, fy: 0, cl: [], cd: [], cross: [], wake: 0, dye: [] };
}

let scratch: Float32Array | null = null;

interface Links {
  key: string;
  /** Destino de cada população após a propagação (−1: sai do domínio). */
  dest: Int32Array;
  /** Direção da população que bate no cilindro (−1 se não bate). */
  hit: Int8Array;
}
let links: Links | null = null;

/** Tabela de destinos da propagação (depende só da geometria). */
function linksOf(L: Lbm): Links {
  const key = `${L.cx}|${L.cy}`;
  if (links && links.key === key) return links;
  const dest = new Int32Array(NX * NY * 9).fill(-1);
  const hit = new Int8Array(NX * NY * 9).fill(-1);
  for (let y = 0; y < NY; y++)
    for (let x = 0; x < NX; x++) {
      const k = x + y * NX;
      if (L.solid[k]) continue;
      for (let i = 0; i < 9; i++) {
        const o = k * 9 + i;
        const xn = x + EX[i]!;
        let yn = y + EY[i]!;
        let ii = i;
        if (yn < 0 || yn >= NY) {
          yn = y;
          ii = REFY[i]!;
        }
        if (xn < 0 || xn >= NX) continue;
        const kn = xn + yn * NX;
        if (L.solid[kn]) {
          dest[o] = k * 9 + OPP[i]!;
          hit[o] = i;
        } else dest[o] = kn * 9 + ii;
      }
    }
  links = { key, dest, hit };
  return links;
}

/** Avança `n` passos de rede (modifica `L` no lugar e o devolve). */
export function lbmSteps(L: Lbm, re: number, n: number): Lbm {
  const om0 = 1 / tauOf(re);
  const { ux, uy, solid } = L;
  const { dest, hit } = linksOf(L);
  const N = NX * NY;
  for (let it = 0; it < n; it++) {
    const f = L.f;
    if (!scratch || scratch.length !== f.length) scratch = new Float32Array(f.length);
    const f2 = scratch;
    // Colisão BGK (D2Q9 desenrolado)
    for (let k = 0; k < N; k++) {
      if (solid[k]) continue;
      const o = k * 9;
      const xcol = k % NX;
      // Zona de esponja junto à saída: viscosidade maior absorve vórtices e ondas de pressão
      const om = xcol < NX - SPONGE ? om0 : 1 / (1 / om0 + (1.2 * (xcol - NX + SPONGE)) / SPONGE);
      const f0 = f[o]!, f1 = f[o + 1]!, f2_ = f[o + 2]!, f3 = f[o + 3]!, f4 = f[o + 4]!, f5 = f[o + 5]!, f6 = f[o + 6]!, f7 = f[o + 7]!, f8 = f[o + 8]!;
      const rho = f0 + f1 + f2_ + f3 + f4 + f5 + f6 + f7 + f8;
      const vx = (f1 - f3 + f5 - f6 - f7 + f8) / rho;
      const vy = (f2_ - f4 + f5 + f6 - f7 - f8) / rho;
      ux[k] = vx;
      uy[k] = vy;
      const usq = 1 - 1.5 * (vx * vx + vy * vy);
      const r9 = (rho * 1) / 9, r36 = rho / 36;
      const a = vx + vy, b = -vx + vy;
      f[o] = f0 + om * ((4 / 9) * rho * usq - f0);
      f[o + 1] = f1 + om * (r9 * (usq + 3 * vx + 4.5 * vx * vx) - f1);
      f[o + 2] = f2_ + om * (r9 * (usq + 3 * vy + 4.5 * vy * vy) - f2_);
      f[o + 3] = f3 + om * (r9 * (usq - 3 * vx + 4.5 * vx * vx) - f3);
      f[o + 4] = f4 + om * (r9 * (usq - 3 * vy + 4.5 * vy * vy) - f4);
      f[o + 5] = f5 + om * (r36 * (usq + 3 * a + 4.5 * a * a) - f5);
      f[o + 6] = f6 + om * (r36 * (usq + 3 * b + 4.5 * b * b) - f6);
      f[o + 7] = f7 + om * (r36 * (usq - 3 * a + 4.5 * a * a) - f7);
      f[o + 8] = f8 + om * (r36 * (usq - 3 * b + 4.5 * b * b) - f8);
    }
    // Propagação pela tabela de destinos; troca de momento no cilindro
    let fx = 0, fy = 0;
    for (let o = 0; o < N * 9; o++) {
      const t = dest[o]!;
      if (t < 0) continue;
      const v = f[o]!;
      f2[t] = v;
      const i = hit[o]!;
      if (i >= 0) {
        fx += 2 * v * EX[i]!;
        fy += 2 * v * EY[i]!;
      }
    }
    // Entrada (equilíbrio com U0) e saída (gradiente nulo)
    for (let y = 0; y < NY; y++) {
      const k0 = y * NX;
      for (let i = 0; i < 9; i++) f2[k0 * 9 + i] = feq(i, 1, U0, 0);
      const kl = NX - 1 + y * NX, kp = NX - 2 + y * NX;
      for (let i = 0; i < 9; i++) f2[kl * 9 + i] = f2[kp * 9 + i]!;
    }
    // Troca os vetores (o antigo vira rascunho)
    scratch = f;
    L.f = f2;
    L.steps++;
    L.fx = fx;
    L.fy = fy;
    if (L.steps % HIST_EVERY === 0) {
      const q = 0.5 * U0 * U0 * 2 * R_CYL;
      const clNow = fy / q;
      L.cl.push(clNow);
      L.cd.push(fx / q);
      if (L.cl.length > HIST_LEN) {
        L.cl.shift();
        L.cd.shift();
      }
      // Sonda de esteira: u_y três diâmetros atrás do cilindro (insensível às ondas de pressão)
      const kw = Math.round(L.cx + 6 * R_CYL) + Math.round(L.cy) * NX;
      const w = uy[kw]!;
      if (L.wake < 0 && w >= 0 && L.steps > 1500) {
        L.cross.push(L.steps);
        if (L.cross.length > 6) L.cross.shift();
      }
      L.wake = w;
    }
  }
  return L;
}

/** Número de Strouhal medido St = f D/U a partir dos cruzamentos de u_y na esteira (0 se ainda não há). */
export function strouhal(L: Lbm): number {
  const c = L.cross;
  if (c.length < 3) return 0;
  const period = (c[c.length - 1]! - c[0]!) / (c.length - 1);
  return (2 * R_CYL) / (period * U0);
}

export function meanCd(L: Lbm): number {
  const n = Math.min(L.cd.length, 120);
  if (!n) return 0;
  return L.cd.slice(-n).reduce((a, b) => a + b, 0) / n;
}

/** Velocidade interpolada bilinearmente (unidades de rede) no ponto (x, y) em células. */
export function velAt(L: Lbm, x: number, y: number): [number, number] {
  const xi = Math.max(0, Math.min(NX - 1.001, x)), yi = Math.max(0, Math.min(NY - 1.001, y));
  const i = Math.floor(xi), j = Math.floor(yi);
  const a = xi - i, b = yi - j;
  const k = i + j * NX;
  const ux = (1 - a) * (1 - b) * L.ux[k]! + a * (1 - b) * L.ux[k + 1]! + (1 - a) * b * L.ux[k + NX]! + a * b * L.ux[k + NX + 1]!;
  const uy = (1 - a) * (1 - b) * L.uy[k]! + a * (1 - b) * L.uy[k + 1]! + (1 - a) * b * L.uy[k + NX]! + a * b * L.uy[k + NX + 1]!;
  return [ux, uy];
}

/** Vorticidade ω = ∂u_y/∂x − ∂u_x/∂y na célula (x, y) (unidades de rede). */
export function vorticity(L: Lbm, x: number, y: number): number {
  if (x <= 0 || x >= NX - 1 || y <= 0 || y >= NY - 1) return 0;
  const k = x + y * NX;
  return (L.uy[k + 1]! - L.uy[k - 1]!) / 2 - (L.ux[k + NX]! - L.ux[k - NX]!) / 2;
}

/** Move o cilindro (células recém-liberadas recebem o equilíbrio local). */
export function moveCylinder(L: Lbm, cx: number, cy: number): Lbm {
  const solid = makeSolid(cx, cy);
  for (let k = 0; k < NX * NY; k++) {
    if (L.solid[k] && !solid[k]) for (let i = 0; i < 9; i++) L.f[k * 9 + i] = feq(i, 1, 0, 0);
    if (solid[k]) {
      L.ux[k] = 0;
      L.uy[k] = 0;
    }
  }
  L.solid = solid;
  L.cx = cx;
  L.cy = cy;
  return L;
}

/** Avança os traçadores de corante, soltando novos na entrada em fileiras. */
export function advectDye(L: Lbm, nSteps: number): void {
  const d = L.dye;
  const out: number[] = [];
  for (let i = 0; i < d.length; i += 2) {
    let x = d[i]!, y = d[i + 1]!;
    const [u, v] = velAt(L, x, y);
    x += u * nSteps;
    y += v * nSteps;
    if (x >= NX - 1 || y < 0 || y > NY - 1) continue;
    const k = Math.round(x) + Math.round(y) * NX;
    if (L.solid[k]) continue;
    out.push(x, y);
  }
  // Fontes de corante: cinco bicos à esquerda do cilindro
  if (L.steps % 4 < nSteps || nSteps >= 4) for (const yy of [L.cy - 9, L.cy - 3.5, L.cy, L.cy + 3.5, L.cy + 9]) out.push(2, yy);
  L.dye = out.length > 5000 ? out.slice(out.length - 5000) : out;
}
