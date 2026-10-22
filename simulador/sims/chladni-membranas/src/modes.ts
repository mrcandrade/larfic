// Modos normais de placas e membranas: funções de Bessel, zeros, tabelas de modos e
// resposta forçada por superposição modal. Coordenadas normalizadas: a placa/membrana
// ocupa [−1, 1] × [−1, 1] (quadrada), o disco unitário (circular) ou [−1, 1] × [−β, β] (retangular, β = b/a).

/** J_m(x) pela integral de Bessel (regra do trapézio, exata para integrando periódico). */
export function besselJ(m: number, x: number): number {
  const N = 96;
  let s = 0;
  for (let k = 0; k <= N; k++) {
    const tau = (Math.PI * k) / N;
    const w = k === 0 || k === N ? 0.5 : 1;
    s += w * Math.cos(m * tau - x * Math.sin(tau));
  }
  return s / N;
}
/** J'_m(x) = (J_{m−1} − J_{m+1}) / 2. */
export const besselJp = (m: number, x: number) => (m === 0 ? -besselJ(1, x) : 0.5 * (besselJ(m - 1, x) - besselJ(m + 1, x)));

function zeros(f: (x: number) => number, count: number, x0 = 0.05): number[] {
  const out: number[] = [];
  let a = x0, fa = f(a);
  for (let b = x0 + 0.05; out.length < count && b < 40; b += 0.05) {
    const fb = f(b);
    if (fa === 0 || fa * fb < 0) {
      let lo = a, hi = b, flo = fa;
      for (let i = 0; i < 60; i++) {
        const mid = (lo + hi) / 2, fm = f(mid);
        if (flo * fm <= 0) hi = mid;
        else [lo, flo] = [mid, fm];
      }
      out.push((lo + hi) / 2);
    }
    a = b;
    fa = fb;
  }
  return out;
}
const zeroCache = new Map<string, number[]>();
/** n-ésimo zero (1, 2, ...) de J_m: j_{mn}. */
export function besselZero(m: number, n: number): number {
  const k = `J${m}`;
  if (!zeroCache.has(k)) zeroCache.set(k, zeros((x) => besselJ(m, x), 6));
  return zeroCache.get(k)![n - 1]!;
}
/** n-ésimo zero não trivial de J'_m (borda livre aproximada). */
export function besselZeroP(m: number, n: number): number {
  const k = `Jp${m}`;
  if (!zeroCache.has(k)) zeroCache.set(k, zeros((x) => besselJp(m, x), 6, m === 0 ? 0.5 : 0.05));
  return zeroCache.get(k)![n - 1]!;
}

export const GEOMS = ["Placa quadrada (Chladni)", "Placa circular (Chladni)", "Membrana circular (tambor)", "Membrana retangular (cavidade 2D)"];
export const SQUARE = 0, PLATE_DISC = 1, DRUM = 2, RECT = 3;

export interface Mode {
  label: string;
  /** Fator adimensional da frequência: f = k · fator (veja freqScale na sim). */
  factor: number;
  /** Forma em coordenadas normalizadas; `th0` orienta os diâmetros nodais (modos circulares). */
  psi(x: number, y: number, th0: number): number;
}

const c = Math.cos, PI = Math.PI;

/** Lista de modos da geometria, ordenada por frequência. `beta` = b/a para a retangular. */
export function modeList(geom: number, beta = 1): Mode[] {
  const out: Mode[] = [];
  if (geom === SQUARE) {
    // Aproximação clássica para placa livre: combinações simétrica/antissimétrica de produtos de cossenos.
    // f ∝ n² + m², com separação de ±4% imposta entre as duas combinações (a degenerescência real é quebrada).
    for (let n = 0; n <= 7; n++)
      for (let m = n; m <= 7; m++) {
        if (n + m < 2) continue;
        const base = n * n + m * m;
        const cc = (k: number, u: number) => c(k * PI * (u + 1) * 0.5);
        if (n === m) {
          out.push({ label: `(${n},${m})`, factor: base, psi: (x, y) => cc(n, x) * cc(m, y) });
          continue;
        }
        out.push({ label: `(${n},${m})+`, factor: base * 1.04, psi: (x, y) => 0.5 * (cc(n, x) * cc(m, y) + cc(m, x) * cc(n, y)) });
        out.push({ label: `(${n},${m})−`, factor: base * 0.96, psi: (x, y) => 0.5 * (cc(n, x) * cc(m, y) - cc(m, x) * cc(n, y)) });
      }
  } else if (geom === PLATE_DISC || geom === DRUM) {
    for (let m = 0; m <= 6; m++)
      for (let n = 1; n <= 4; n++) {
        const z = geom === DRUM ? besselZero(m, n) : besselZeroP(m, n);
        // Placa: ω ∝ (β/R)²; membrana: ω ∝ j/R.
        const factor = geom === DRUM ? z : z * z;
        // Círculos nodais internos = zeros de J_m abaixo do argumento máximo z.
        const circles = geom === DRUM || m > 0 ? n - 1 : n;
        const label = `(${m},${n}): ${m} diâm., ${circles} círc.`;
        out.push({
          label,
          factor,
          psi: (x, y, th0) => {
            const r = Math.hypot(x, y);
            if (r > 1) return 0;
            return besselJ(m, z * r) * c(m * (Math.atan2(y, x) - th0));
          },
        });
      }
  } else {
    for (let n = 1; n <= 8; n++)
      for (let m = 1; m <= 8; m++)
        out.push({
          label: `(${n},${m})`,
          factor: Math.sqrt(n * n + (m / beta) ** 2),
          psi: (x, y) => Math.sin((n * PI * (x + 1)) / 2) * Math.sin((m * PI * (y + beta)) / (2 * beta)),
        });
  }
  return out.sort((a, b) => a.factor - b.factor).slice(0, 28);
}

/** Domínio normalizado: dentro da placa/membrana? */
export function inside(geom: number, beta: number, x: number, y: number): boolean {
  if (geom === PLATE_DISC || geom === DRUM) return x * x + y * y <= 1;
  if (geom === RECT) return Math.abs(x) <= 1 && Math.abs(y) <= beta;
  return Math.abs(x) <= 1 && Math.abs(y) <= 1;
}
export const halfY = (geom: number, beta: number) => (geom === RECT ? beta : 1);

/** Grade (G+1)×(G+1) de cada modo para a orientação th0 (memorizada). */
export const G = 48;
const gridCache = new Map<string, Float64Array[]>();
export function modeGrids(geom: number, beta: number, th0: number): Float64Array[] {
  const key = `${geom}|${beta.toFixed(4)}|${geom === PLATE_DISC || geom === DRUM ? th0.toFixed(3) : 0}`;
  const hit = gridCache.get(key);
  if (hit) return hit;
  const modes = modeList(geom, beta);
  const hy = halfY(geom, beta);
  const grids = modes.map((md) => {
    const g = new Float64Array((G + 1) * (G + 1));
    for (let j = 0; j <= G; j++)
      for (let i = 0; i <= G; i++) {
        const x = -1 + (2 * i) / G, y = -hy + (2 * hy * j) / G;
        g[j * (G + 1) + i] = inside(geom, beta, x, y) ? md.psi(x, y, th0) : 0;
      }
    return g;
  });
  if (gridCache.size > 40) gridCache.clear();
  gridCache.set(key, grids);
  return grids;
}

/** Fator complexo de resposta modal: ψ_j(d) / (f_j² − f² + i f f_j / Q). */
export function modalFactor(fj: number, f: number, Q: number, psiD: number): [number, number] {
  const re = fj * fj - f * f, im = (f * fj) / Q;
  const den = re * re + im * im;
  return [(psiD * re) / den, (-psiD * im) / den];
}

/** Interpolação bilinear numa grade (G+1)². */
export function sample(grid: ArrayLike<number>, geom: number, beta: number, x: number, y: number): number {
  const hy = halfY(geom, beta);
  const fx = ((x + 1) / 2) * G, fy = ((y + hy) / (2 * hy)) * G;
  const i = Math.max(0, Math.min(G - 1, Math.floor(fx))), j = Math.max(0, Math.min(G - 1, Math.floor(fy)));
  const u = Math.max(0, Math.min(1, fx - i)), v = Math.max(0, Math.min(1, fy - j));
  const W = G + 1;
  return (
    grid[j * W + i]! * (1 - u) * (1 - v) + grid[j * W + i + 1]! * u * (1 - v) + grid[(j + 1) * W + i]! * (1 - u) * v + grid[(j + 1) * W + i + 1]! * u * v
  );
}
