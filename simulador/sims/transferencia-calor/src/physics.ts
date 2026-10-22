// Transferência de calor: parede composta (volumes finitos implícitos), corpo que troca
// calor por convecção e radiação, e balanço radiativo de um planeta com efeito estufa.
import { num, type Params } from "@fisilab/core";

export const SIGMA = 5.670374e-8;
export const K0 = 273.15;

export interface Material {
  value: number;
  label: string;
  /** Condutividade (W/m·K), densidade (kg/m³), calor específico (J/kg·K). */
  k: number;
  rho: number;
  c: number;
  color: string;
}

export const MATERIALS: Material[] = [
  { value: 0, label: "Tijolo maciço", k: 0.72, rho: 1920, c: 835, color: "#b5603c" },
  { value: 1, label: "Concreto", k: 1.4, rho: 2300, c: 880, color: "#9a9a92" },
  { value: 2, label: "Isopor (EPS)", k: 0.035, rho: 20, c: 1300, color: "#e9e4d4" },
  { value: 3, label: "Lã de rocha", k: 0.04, rho: 100, c: 840, color: "#d8c27a" },
  { value: 4, label: "Madeira (pinho)", k: 0.12, rho: 510, c: 1380, color: "#a7774a" },
  { value: 5, label: "Gesso", k: 0.25, rho: 900, c: 1090, color: "#d9d6cf" },
  { value: 6, label: "Vidro", k: 0.8, rho: 2500, c: 840, color: "#8fc3cf" },
  { value: 7, label: "Aço", k: 50, rho: 7850, c: 490, color: "#6f7782" },
];
export const MAT_OPTIONS = MATERIALS.map((m) => ({ value: m.value, label: m.label }));
const mat = (p: Params, key: string, def: number) => MATERIALS[Math.round(num(p, key, def))] ?? MATERIALS[0]!;

export interface Layer {
  m: Material;
  /** Espessura (m). */
  e: number;
}

/** Camadas da parede (de dentro para fora), ignorando as de espessura zero. */
export function layersOf(p: Params): Layer[] {
  const out: Layer[] = [];
  const defs: [string, string, number, number][] = [
    ["m1", "e1", 0, 10],
    ["m2", "e2", 2, 5],
    ["m3", "e3", 5, 1.5],
  ];
  for (const [mk, ek, md, ed] of defs) {
    const e = num(p, ek, ed) / 100;
    if (e > 1e-6) out.push({ m: mat(p, mk, md), e });
  }
  return out.length ? out : [{ m: MATERIALS[0]!, e: 0.1 }];
}

export const hiOf = (p: Params) => num(p, "hi", 8);
export const heOf = (p: Params) => num(p, "he", 25);
export const TinOf = (p: Params) => num(p, "Tq", 22);
export const ToutOf = (p: Params) => num(p, "Tf", 0);

/** Resistências térmicas por unidade de área (m²·K/W): película interna, camadas, película externa. */
export function resistances(p: Params): { Ri: number; layers: number[]; Re: number; total: number } {
  const Ri = 1 / hiOf(p);
  const Re = 1 / heOf(p);
  const layers = layersOf(p).map((l) => l.e / l.m.k);
  return { Ri, layers, Re, total: Ri + Re + layers.reduce((a, b) => a + b, 0) };
}

/** Fluxo em regime estacionário q = ΔT/R_total (W/m²), de dentro para fora. */
export const steadyFlux = (p: Params) => (TinOf(p) - ToutOf(p)) / resistances(p).total;

/** Temperaturas de regime nas faces: [superfície interna, interfaces…, superfície externa] (°C). */
export function steadyInterfaces(p: Params): number[] {
  const q = steadyFlux(p);
  const { Ri, layers } = resistances(p);
  const out = [TinOf(p) - q * Ri];
  for (const r of layers) out.push(out[out.length - 1]! - q * r);
  return out;
}

/** Malha de volumes finitos da parede: posição do centro, largura e material de cada célula. */
export interface Mesh {
  x: number[];
  dx: number[];
  k: number[];
  rc: number[];
  /** Posições das interfaces entre camadas (m), incluindo 0 e a espessura total. */
  faces: number[];
}

const meshCache = new Map<string, Mesh>();
export const NCELL = 60;

export function meshOf(p: Params): Mesh {
  const layers = layersOf(p);
  const key = layers.map((l) => `${l.m.value}:${l.e}`).join("|");
  const hit = meshCache.get(key);
  if (hit) return hit;
  const total = layers.reduce((a, l) => a + l.e, 0);
  const x: number[] = [], dx: number[] = [], k: number[] = [], rc: number[] = [];
  const faces = [0];
  let x0 = 0;
  for (const l of layers) {
    const n = Math.max(5, Math.round((NCELL * l.e) / total));
    const h = l.e / n;
    for (let i = 0; i < n; i++) {
      x.push(x0 + (i + 0.5) * h);
      dx.push(h);
      k.push(l.m.k);
      rc.push(l.m.rho * l.m.c);
    }
    x0 += l.e;
    faces.push(x0);
  }
  const mesh = { x, dx, k, rc, faces };
  if (meshCache.size > 32) meshCache.clear();
  meshCache.set(key, mesh);
  return mesh;
}

/** Condutâncias (W/m²K) entre células vizinhas e com os fluidos dos dois lados. */
function conductances(p: Params, mesh: Mesh): { gIn: number; g: number[]; gOut: number } {
  const n = mesh.x.length;
  const g: number[] = [];
  for (let i = 0; i < n - 1; i++) g.push(1 / (mesh.dx[i]! / (2 * mesh.k[i]!) + mesh.dx[i + 1]! / (2 * mesh.k[i + 1]!)));
  const gIn = 1 / (1 / hiOf(p) + mesh.dx[0]! / (2 * mesh.k[0]!));
  const gOut = 1 / (1 / heOf(p) + mesh.dx[n - 1]! / (2 * mesh.k[n - 1]!));
  return { gIn, g, gOut };
}

/** Passo de Euler implícito (incondicionalmente estável) da equação do calor na parede. */
export function wallStep(T: number[], p: Params, H: number): number[] {
  const mesh = meshOf(p);
  const n = T.length;
  const { gIn, g, gOut } = conductances(p, mesh);
  const a = new Array<number>(n).fill(0), b = new Array<number>(n).fill(0), c = new Array<number>(n).fill(0), d = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i++) {
    const C = (mesh.rc[i]! * mesh.dx[i]!) / H;
    const gl = i === 0 ? gIn : g[i - 1]!;
    const gr = i === n - 1 ? gOut : g[i]!;
    b[i] = C + gl + gr;
    d[i] = C * T[i]!;
    if (i === 0) d[i]! += gIn * TinOf(p);
    else a[i] = -gl;
    if (i === n - 1) d[i]! += gOut * ToutOf(p);
    else c[i] = -gr;
  }
  // Algoritmo de Thomas
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

/** Fluxos instantâneos (W/m²) entrando pela face interna e saindo pela externa. */
export function wallFluxes(T: number[], p: Params): { qIn: number; qOut: number } {
  const mesh = meshOf(p);
  const { gIn, gOut } = conductances(p, mesh);
  return { qIn: gIn * (TinOf(p) - T[0]!), qOut: gOut * (T[T.length - 1]! - ToutOf(p)) };
}

/** Temperatura de uma superfície da parede extrapolada da célula vizinha (°C). */
export function surfaceTemps(T: number[], p: Params): { si: number; se: number } {
  const { qIn, qOut } = wallFluxes(T, p);
  return { si: TinOf(p) - qIn / hiOf(p), se: ToutOf(p) + qOut / heOf(p) };
}

// ---------- Corpo que troca calor com o ambiente ----------
/** Corpo: recipiente com 0,5 kg de água, área externa 0,06 m². */
export const BODY_C = 0.5 * 4186 + 200;
export const BODY_A = 0.06;
export const TambOf = (p: Params) => num(p, "Ta", 20);

export function bodyPowers(Tc: number, p: Params): { conv: number; rad: number; heater: number } {
  const T = Tc + K0, Ta = TambOf(p) + K0;
  return {
    conv: num(p, "h", 10) * BODY_A * (Tc - TambOf(p)),
    rad: num(p, "eps", 0.9) * SIGMA * BODY_A * (T ** 4 - Ta ** 4),
    heater: num(p, "P", 0),
  };
}

export function bodyRate(Tc: number, p: Params): number {
  const w = bodyPowers(Tc, p);
  return (w.heater - w.conv - w.rad) / BODY_C;
}

/** Temperatura de equilíbrio do corpo: P = hA(T − Ta) + εσA(T⁴ − Ta⁴) (bissecção). */
export function bodyEquilibrium(p: Params): number {
  let lo = TambOf(p) - 1e-9, hi = TambOf(p) + 2000;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (bodyRate(mid, p) > 0) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Coeficiente de radiação linearizado h_r = 4εσT̄³ (W/m²K). */
export function hRad(Tc: number, p: Params): number {
  const Tm = (Tc + TambOf(p)) / 2 + K0;
  return 4 * num(p, "eps", 0.9) * SIGMA * Tm ** 3;
}

// ---------- Corpo negro e efeito estufa ----------
/** Radiância espectral de Planck por comprimento de onda (W·m⁻²·sr⁻¹·m⁻¹). */
export function planck(lambda: number, T: number): number {
  const h = 6.62607015e-34, c = 2.99792458e8, kB = 1.380649e-23;
  const x = (h * c) / (lambda * kB * T);
  if (x > 700) return 0;
  return (2 * h * c * c) / lambda ** 5 / Math.expm1(x);
}
export const WIEN = 2.897771955e-3;

/** Modelo de uma camada: temperaturas de emissão, superfície e atmosfera (K). */
export function greenhouse(p: Params): { Te: number; Ts: number; Tatm: number; absorbed: number } {
  const S = num(p, "S", 1361);
  const a = num(p, "alb", 0.3);
  const e = num(p, "epsA", 0.78);
  const absorbed = (S * (1 - a)) / 4;
  const Te = (absorbed / SIGMA) ** 0.25;
  const Ts = Te * (2 / (2 - e)) ** 0.25;
  return { Te, Ts, Tatm: Ts / 2 ** 0.25, absorbed };
}
