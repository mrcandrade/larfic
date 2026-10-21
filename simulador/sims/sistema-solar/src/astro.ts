// Dados e física do sistema solar: elementos orbitais reais (J2000), equação de Kepler,
// n corpos com integrador simplético (velocity Verlet), Lua e satélites.

/** G em UA³/(M☉·ano²). */
export const GU = 4 * Math.PI * Math.PI;
export const G_SI = 6.674e-11;
export const M_EARTH = 5.972e24;
export const R_EARTH = 6.371e6;
export const GM_EARTH = 3.986004418e14;
/** Dia sideral (s). */
export const SIDEREAL_DAY = 86164.1;
export const YEAR_DAYS = 365.256;
export const KMS_PER_AUYR = 4.74047;

export interface Planet {
  name: string;
  /** Semieixo maior (UA), excentricidade, longitude do periélio e longitude média em J2000 (°). */
  a: number;
  e: number;
  varpi: number;
  L0: number;
  /** Período orbital tabelado (anos). */
  T: number;
  /** Massa (kg), raio equatorial (km), período de rotação sideral (dias; negativo = retrógrado). */
  m: number;
  R: number;
  rot: number;
  color: string;
}

export const PLANETS: Planet[] = [
  { name: "Mercúrio", a: 0.38710, e: 0.20563, varpi: 77.456, L0: 252.251, T: 0.24085, m: 3.301e23, R: 2439.7, rot: 58.646, color: "#9a8f86" },
  { name: "Vênus", a: 0.72333, e: 0.00677, varpi: 131.53, L0: 181.98, T: 0.61520, m: 4.867e24, R: 6051.8, rot: -243.02, color: "#d9b26a" },
  { name: "Terra", a: 1.00000, e: 0.01671, varpi: 102.94, L0: 100.46, T: 1.00002, m: 5.972e24, R: 6371.0, rot: 0.99727, color: "#3b7dd8" },
  { name: "Marte", a: 1.52368, e: 0.09340, varpi: 336.04, L0: 355.45, T: 1.88085, m: 6.417e23, R: 3389.5, rot: 1.02596, color: "#c8553d" },
  { name: "Júpiter", a: 5.20260, e: 0.04849, varpi: 14.75, L0: 34.40, T: 11.862, m: 1.898e27, R: 69911, rot: 0.41354, color: "#c99a6b" },
  { name: "Saturno", a: 9.55490, e: 0.05551, varpi: 92.43, L0: 49.94, T: 29.457, m: 5.683e26, R: 58232, rot: 0.44401, color: "#d8c38a" },
  { name: "Urano", a: 19.2180, e: 0.04630, varpi: 170.96, L0: 313.23, T: 84.011, m: 8.681e25, R: 25362, rot: -0.71833, color: "#7fc4cf" },
  { name: "Netuno", a: 30.1100, e: 0.00899, varpi: 44.97, L0: 304.88, T: 164.79, m: 1.024e26, R: 24622, rot: 0.67125, color: "#4b6fd1" },
];
export const R_SUN_KM = 695700;
export const AU_KM = 1.495978707e8;

const rad = (d: number) => (d * Math.PI) / 180;

/** Resolve E − e sen E = M (Newton). */
export function keplerE(M: number, e: number): number {
  let E = e < 0.8 ? M : Math.PI;
  for (let i = 0; i < 30; i++) {
    const dE = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E -= dE;
    if (Math.abs(dE) < 1e-14) break;
  }
  return E;
}

/** Posição heliocêntrica (UA) no plano da eclíptica, t em anos desde J2000. Período pela 3ª lei (T = a^1,5). */
export function planetPos(pl: Planet, t: number): [number, number] {
  const n = (2 * Math.PI) / pl.a ** 1.5;
  const M = rad(pl.L0 - pl.varpi) + n * t;
  const E = keplerE(((M % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI), pl.e);
  const xp = pl.a * (Math.cos(E) - pl.e), yp = pl.a * Math.sqrt(1 - pl.e * pl.e) * Math.sin(E);
  const w = rad(pl.varpi);
  return [xp * Math.cos(w) - yp * Math.sin(w), xp * Math.sin(w) + yp * Math.cos(w)];
}

/** Longitude eclíptica geocêntrica do planeta (rad, em [0, 2π)). */
export function geoLongitude(pl: Planet, t: number): number {
  const [xp, yp] = planetPos(pl, t), [xe, ye] = planetPos(PLANETS[2]!, t);
  const l = Math.atan2(yp - ye, xp - xe);
  return (l + 2 * Math.PI) % (2 * Math.PI);
}

/** Período sinódico em relação à Terra (anos). */
export const synodic = (T: number) => 1 / Math.abs(1 - 1 / T);

// ---------------------------------------------------------------------------
// n corpos
// ---------------------------------------------------------------------------

export interface Body {
  id: number;
  m: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

/** Raio de desenho/colisão (UA) a partir da massa (M☉). */
export const bodyRadius = (m: number) => 0.02 + 0.06 * Math.cbrt(Math.max(m, 0));

function accel(bs: Body[]): [number, number][] {
  const out = bs.map(() => [0, 0] as [number, number]);
  const eps2 = 1e-6;
  for (let i = 0; i < bs.length; i++)
    for (let j = i + 1; j < bs.length; j++) {
      const a = bs[i]!, b = bs[j]!;
      const dx = b.x - a.x, dy = b.y - a.y;
      const r2 = dx * dx + dy * dy + eps2, inv = GU / (r2 * Math.sqrt(r2));
      out[i]![0] += b.m * dx * inv;
      out[i]![1] += b.m * dy * inv;
      out[j]![0] -= a.m * dx * inv;
      out[j]![1] -= a.m * dy * inv;
    }
  return out;
}

/** Tempo dinâmico mínimo entre pares (anos): limita o passo. */
function dynTime(bs: Body[]): number {
  let t = Infinity;
  for (let i = 0; i < bs.length; i++)
    for (let j = i + 1; j < bs.length; j++) {
      const a = bs[i]!, b = bs[j]!;
      const r = Math.hypot(b.x - a.x, b.y - a.y);
      t = Math.min(t, Math.sqrt(r ** 3 / (GU * (a.m + b.m + 1e-12))));
    }
  return t;
}

/** Funde corpos que se tocam (colisão perfeitamente inelástica: conserva massa e momento). */
export function merge(bs: Body[]): Body[] {
  const out = bs.map((b) => ({ ...b }));
  for (let i = 0; i < out.length; i++)
    for (let j = i + 1; j < out.length; j++) {
      const a = out[i]!, b = out[j]!;
      if (Math.hypot(b.x - a.x, b.y - a.y) < 0.5 * (bodyRadius(a.m) + bodyRadius(b.m))) {
        const m = a.m + b.m;
        out[i] = { id: a.m >= b.m ? a.id : b.id, m, x: (a.m * a.x + b.m * b.x) / m, y: (a.m * a.y + b.m * b.y) / m, vx: (a.m * a.vx + b.m * b.vx) / m, vy: (a.m * a.vy + b.m * b.vy) / m };
        out.splice(j, 1);
        j = i;
      }
    }
  return out;
}

/** Avança h anos com velocity Verlet (simplético), subdividindo pelo tempo dinâmico. */
export function nbodyStep(bs0: Body[], h: number, merging = true): Body[] {
  let bs = bs0.map((b) => ({ ...b }));
  if (bs.length < 2) return bs.map((b) => ({ ...b, x: b.x + b.vx * h, y: b.y + b.vy * h }));
  let left = h;
  for (let guard = 0; left > 1e-15 && guard < 400; guard++) {
    const hs = Math.min(left, 0.01 * dynTime(bs));
    let a = accel(bs);
    bs.forEach((b, i) => {
      b.vx += 0.5 * hs * a[i]![0];
      b.vy += 0.5 * hs * a[i]![1];
      b.x += hs * b.vx;
      b.y += hs * b.vy;
    });
    a = accel(bs);
    bs.forEach((b, i) => {
      b.vx += 0.5 * hs * a[i]![0];
      b.vy += 0.5 * hs * a[i]![1];
    });
    left -= hs;
    if (merging) bs = merge(bs);
  }
  return bs;
}

export function nbodyEnergy(bs: Body[]): number {
  let E = 0;
  for (let i = 0; i < bs.length; i++) {
    const a = bs[i]!;
    E += 0.5 * a.m * (a.vx * a.vx + a.vy * a.vy);
    for (let j = i + 1; j < bs.length; j++) {
      const b = bs[j]!;
      E -= (GU * a.m * b.m) / Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2 + 1e-6);
    }
  }
  return E;
}
export const momentum = (bs: Body[]): [number, number] => bs.reduce((s, b) => [s[0] + b.m * b.vx, s[1] + b.m * b.vy], [0, 0] as [number, number]);
export const angularMomentum = (bs: Body[]) => bs.reduce((s, b) => s + b.m * (b.x * b.vy - b.y * b.vx), 0);
export function centerOfMass(bs: Body[]): [number, number] {
  const M = bs.reduce((s, b) => s + b.m, 0) || 1;
  return [bs.reduce((s, b) => s + b.m * b.x, 0) / M, bs.reduce((s, b) => s + b.m * b.y, 0) / M];
}
/** Passa para o referencial do centro de massa (momento total nulo). */
export function toCM(bs: Body[]): Body[] {
  const M = bs.reduce((s, b) => s + b.m, 0) || 1;
  const [px, py] = momentum(bs), [cx, cy] = centerOfMass(bs);
  return bs.map((b) => ({ ...b, x: b.x - cx, y: b.y - cy, vx: b.vx - px / M, vy: b.vy - py / M }));
}

export const PRESETS = ["Sol e Terra", "Sol, Terra e Júpiter (×10 massa)", "Estrela binária com planeta", "Sol, planeta e lua", "Quatro corpos (caótico)"];

/** Corpos iniciais (UA, M☉, UA/ano). */
export function presetBodies(k: number): Body[] {
  const circ = (M: number, r: number) => Math.sqrt((GU * M) / r);
  let bs: Body[];
  switch (k) {
    case 1:
      bs = [
        { id: 1, m: 1, x: 0, y: 0, vx: 0, vy: 0 },
        { id: 2, m: 3e-6, x: 1, y: 0, vx: 0, vy: circ(1, 1) },
        { id: 3, m: 9.5e-3, x: -2.5, y: 0, vx: 0, vy: -circ(1, 2.5) },
      ];
      break;
    case 2:
      bs = [
        { id: 1, m: 0.6, x: -0.25, y: 0, vx: 0, vy: -circ(0.4, 0.5) * 0.6 },
        { id: 2, m: 0.4, x: 0.375, y: 0, vx: 0, vy: circ(0.6, 0.5) * 0.6 },
        { id: 3, m: 1e-5, x: 0, y: 2.2, vx: -circ(1, 2.2), vy: 0 },
      ];
      // velocidades da binária: órbita circular relativa de raio 0,625 UA
      {
        const vrel = circ(1, 0.625);
        bs[0]!.vy = -0.4 * vrel;
        bs[1]!.vy = 0.6 * vrel;
      }
      break;
    case 3:
      bs = [
        { id: 1, m: 1, x: 0, y: 0, vx: 0, vy: 0 },
        { id: 2, m: 1e-3, x: 1.5, y: 0, vx: 0, vy: circ(1, 1.5) },
        { id: 3, m: 1e-6, x: 1.5 + 0.09, y: 0, vx: 0, vy: circ(1, 1.5) + circ(1e-3, 0.09) },
      ];
      break;
    case 4:
      bs = [
        { id: 1, m: 0.5, x: -1, y: 0, vx: 0, vy: -2.5 },
        { id: 2, m: 0.5, x: 1, y: 0, vx: 0, vy: 2.5 },
        { id: 3, m: 0.05, x: 0, y: 1.6, vx: -3, vy: 0 },
        { id: 4, m: 0.02, x: 0, y: -2.2, vx: 3.5, vy: 0.4 },
      ];
      break;
    default:
      bs = [
        { id: 1, m: 1, x: 0, y: 0, vx: 0, vy: 0 },
        { id: 2, m: 3e-6, x: 1, y: 0, vx: 0, vy: circ(1, 1) },
      ];
  }
  return toCM(bs);
}

// ---------------------------------------------------------------------------
// Lua
// ---------------------------------------------------------------------------

export const MOON_SIDEREAL = 27.32166;
export const MOON_SYNODIC = 1 / (1 / MOON_SIDEREAL - 1 / YEAR_DAYS);
export const MOON_INCL = 5.145;
export const NODE_PERIOD = 6798.38; // dias (regressão da linha dos nodos, 18,6 anos)

export interface MoonGeo {
  /** Elongação Lua–Sol medida na eclíptica (rad, 0 = lua nova). */
  elong: number;
  /** Latitude eclíptica da Lua (rad). */
  beta: number;
  /** Ângulo 3D entre Lua e Sol vistos da Terra (rad). */
  sep: number;
  /** Fração iluminada do disco. */
  k: number;
}

/** Geometria Sol–Terra–Lua no dia t (t = 0: lua nova; nodo a `node0` graus do Sol). */
export function moonGeo(t: number, node0Deg: number): MoonGeo {
  const lamS = (2 * Math.PI * t) / YEAR_DAYS;
  const lamM = (2 * Math.PI * t) / MOON_SIDEREAL;
  const node = rad(node0Deg) - (2 * Math.PI * t) / NODE_PERIOD;
  const beta = Math.asin(Math.sin(rad(MOON_INCL)) * Math.sin(lamM - node));
  const elong = (((lamM - lamS) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  const sep = Math.acos(Math.cos(beta) * Math.cos(elong));
  return { elong, beta, sep, k: (1 - Math.cos(sep)) / 2 };
}

export function phaseName(elong: number): string {
  const d = (elong * 180) / Math.PI;
  if (d < 10 || d > 350) return "Lua nova";
  if (d < 80) return "Crescente";
  if (d < 100) return "Quarto crescente";
  if (d < 170) return "Crescente gibosa";
  if (d < 190) return "Lua cheia";
  if (d < 260) return "Minguante gibosa";
  if (d < 280) return "Quarto minguante";
  return "Minguante";
}

/** Eclipse: solar se a separação Lua–Sol < 1,5°; lunar se a Lua está a < 1,0° do ponto antissolar. */
export function eclipse(g: MoonGeo): "" | "solar" | "lunar" {
  const deg = (r: number) => (r * 180) / Math.PI;
  if (deg(g.sep) < 1.5) return "solar";
  if (deg(Math.PI - g.sep) < 1.0) return "lunar";
  return "";
}

// ---------------------------------------------------------------------------
// Terra: canhão de Newton e satélites
// ---------------------------------------------------------------------------

export const v1 = (h: number) => Math.sqrt(GM_EARTH / (R_EARTH + h));
export const v2 = (h: number) => Math.sqrt((2 * GM_EARTH) / (R_EARTH + h));
/** Raio da órbita geoestacionária (m): período = dia sideral. */
export const rGeo = () => Math.cbrt((GM_EARTH * SIDEREAL_DAY ** 2) / (4 * Math.PI * Math.PI));
export const orbitPeriod = (r: number) => 2 * Math.PI * Math.sqrt(r ** 3 / GM_EARTH);
