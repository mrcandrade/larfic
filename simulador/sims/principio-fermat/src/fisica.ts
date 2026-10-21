// Princípio de Fermat: tempo de percurso em função do ponto de incidência.
export type P2 = [number, number];

export const C_LIGHT = 299_792_458;
const D = Math.PI / 180;

/** Formas do espelho: plano (y = 0), elipse com focos em A e B, círculo mais curvo que a elipse. */
export const PLANO = 0;
export const ELIPSE = 1;
export const CIRCULO = 2;
/** Focos fixos dos espelhos curvos e semieixos da elipse (a = 5, b = 4, c = 3). */
export const FOCO_A: P2 = [-3, 4];
export const FOCO_B: P2 = [3, 4];
export const ELL_A = 5;
export const ELL_B = 4;

/** Altura do espelho na abscissa x. */
export function mirrorY(shape: number, x: number): number {
  if (shape === ELIPSE) return FOCO_A[1] - ELL_B * Math.sqrt(Math.max(0, 1 - (x * x) / (ELL_A * ELL_A)));
  if (shape === CIRCULO) return FOCO_A[1] - Math.sqrt(Math.max(0, ELL_B * ELL_B - x * x));
  return 0;
}

/** Normal unitária (apontando para cima, para o lado de A e B) no ponto x do espelho. */
export function mirrorNormal(shape: number, x: number): P2 {
  const h = 1e-5;
  const s = (mirrorY(shape, x + h) - mirrorY(shape, x - h)) / (2 * h);
  const n = Math.hypot(1, s);
  return [-s / n, 1 / n];
}

/** Faixa de x em que o espelho existe. */
export const mirrorRange = (shape: number): [number, number] => (shape === ELIPSE ? [-4.6, 4.6] : shape === CIRCULO ? [-3.6, 3.6] : [-5, 5]);

const dist = (a: P2, b: P2) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** Comprimento ótico generalizado A → P → B com "custos" w1 e w2 por unidade de comprimento. */
export function cost(A: P2, P: P2, B: P2, w1: number, w2: number): number {
  return w1 * dist(A, P) + w2 * dist(P, B);
}

/** Mínimo de uma função unimodal em [a, b] por seção áurea. */
export function goldenMin(f: (x: number) => number, a: number, b: number, tol = 1e-10): number {
  const g = (Math.sqrt(5) - 1) / 2;
  let x1 = b - g * (b - a);
  let x2 = a + g * (b - a);
  let f1 = f(x1);
  let f2 = f(x2);
  for (let i = 0; i < 200 && b - a > tol; i++) {
    if (f1 < f2) {
      b = x2;
      x2 = x1;
      f2 = f1;
      x1 = b - g * (b - a);
      f1 = f(x1);
    } else {
      a = x1;
      x1 = x2;
      f1 = f2;
      x2 = a + g * (b - a);
      f2 = f(x2);
    }
  }
  return (a + b) / 2;
}

/**
 * Ângulos (graus, em relação à normal) de um caminho A → P → B que atravessa
 * ou reflete numa superfície com normal n em P.
 */
export function anglesAt(A: P2, P: P2, B: P2, n: P2): { th1: number; th2: number } {
  const u: P2 = [P[0] - A[0], P[1] - A[1]];
  const v: P2 = [B[0] - P[0], B[1] - P[1]];
  const lu = Math.hypot(u[0], u[1]) || 1;
  const lv = Math.hypot(v[0], v[1]) || 1;
  // componente tangencial com sinal: sen θ = (u × n)
  const s1 = (u[0] * n[1] - u[1] * n[0]) / lu;
  const s2 = (v[0] * n[1] - v[1] * n[0]) / lv;
  return { th1: Math.asin(Math.max(-1, Math.min(1, s1))) / D, th2: Math.asin(Math.max(-1, Math.min(1, s2))) / D };
}

/** Lei de Snell: ângulo de refração (graus), NaN em reflexão total. */
export function snell(th1Deg: number, n1: number, n2: number): number {
  const s = (n1 / n2) * Math.sin(th1Deg * D);
  return Math.abs(s) > 1 ? NaN : Math.asin(s) / D;
}

/** Deslocamento lateral de uma lâmina de faces paralelas: d = e sen(θ₁ − θ₂)/cos θ₂. */
export function slabShift(e: number, n: number, th1Deg: number): number {
  const t2 = snell(th1Deg, 1, n) * D;
  return (e * Math.sin(th1Deg * D - t2)) / Math.cos(t2);
}

/** Refletância média (luz natural) de Fresnel na interface ar → n. */
export function fresnelR(th1Deg: number, n: number): number {
  const i = th1Deg * D;
  const ci = Math.cos(i);
  const st = Math.sin(i) / n;
  const ct = Math.sqrt(Math.max(0, 1 - st * st));
  const rs = (ci - n * ct) / (ci + n * ct);
  const rp = (n * ci - ct) / (n * ci + ct);
  return (rs * rs + rp * rp) / 2;
}
