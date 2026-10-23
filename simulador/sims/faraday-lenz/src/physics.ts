/** Fluxo de um dipolo magnético através de uma espira circular coaxial (SI). */
export const MU0 = 4 * Math.PI * 1e-7;

// Gauss-Legendre de 8 pontos em [−1, 1]
const GX = [-0.960289856497536, -0.7966664774136267, -0.525532409916329, -0.1834346424956498, 0.1834346424956498, 0.525532409916329, 0.7966664774136267, 0.960289856497536];
const GW = [0.1012285362903763, 0.2223810344533745, 0.3137066458778873, 0.362683783378362, 0.362683783378362, 0.3137066458778873, 0.2223810344533745, 0.1012285362903763];

/** Integral de f em [lo, hi] por Gauss-Legendre composta (8 pontos × `panels`). */
export function gauss(f: (x: number) => number, lo: number, hi: number, panels = 6): number {
  const h = (hi - lo) / panels;
  let s = 0;
  for (let k = 0; k < panels; k++) {
    const c = lo + (k + 0.5) * h;
    for (let i = 0; i < 8; i++) s += GW[i]! * f(c + (GX[i]! * h) / 2);
  }
  return (s * h) / 2;
}

/**
 * Componente axial do campo de um dipolo m (ao longo de +x) num ponto a uma
 * distância axial d e radial ρ:  Bx = μ₀m/(4π) (3d² − r²)/r⁵.
 */
export function dipoleBx(m: number, d: number, rho: number): number {
  const r2 = d * d + rho * rho;
  return ((MU0 * m) / (4 * Math.PI)) * (3 * d * d - r2) / (r2 * r2 * Math.sqrt(r2));
}

/** Campo do dipolo (ao longo de +x) no plano xy, ponto (x, y) relativo ao dipolo. */
export function dipoleB2(m: number, x: number, y: number): [number, number] {
  const r2 = x * x + y * y;
  const r = Math.sqrt(r2);
  if (r < 1e-9) return [0, 0];
  const k = (MU0 * m) / (4 * Math.PI * r2 * r);
  const c = x / r;
  return [k * (3 * c * (x / r) - 1), k * 3 * c * (y / r)];
}

/**
 * Fluxo (Wb) do dipolo através de uma espira de raio a cujo plano está a uma
 * distância d do dipolo, integrando Bx numericamente na área. Quando o dipolo
 * está perto do plano, o integrando é singular no centro; usa-se então que o
 * fluxo pelo plano inteiro é nulo e integra-se o complemento (ρ > a), com
 * ρ = a/u para tornar o intervalo finito.
 */
export function fluxNumeric(m: number, a: number, d: number): number {
  if (Math.abs(d) > a) return gauss((rho) => dipoleBx(m, d, rho) * 2 * Math.PI * rho, 0, a);
  return -gauss((u) => {
    if (u <= 0) return 0;
    const rho = a / u;
    return dipoleBx(m, d, rho) * 2 * Math.PI * rho * (a / (u * u));
  }, 0, 1);
}

/** Fórmula fechada: Φ = μ₀ m a² / [2 (a² + d²)^{3/2}]. */
export const fluxExact = (m: number, a: number, d: number) => (MU0 * m * a * a) / (2 * (a * a + d * d) ** 1.5);

/** dΦ/dd pela fórmula fechada (para os testes). */
export const dFluxExact = (m: number, a: number, d: number) => (-3 * MU0 * m * a * a * d) / (2 * (a * a + d * d) ** 2.5);
