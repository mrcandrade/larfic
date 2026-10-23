import type { IntegratorName, Params, State } from "./simulation.ts";

export type Derivatives = (state: State, params: Params, t: number) => State;
export type Integrator = (f: Derivatives, y: State, params: Params, t: number, dt: number) => State;

function axpy(y: State, k: State, h: number): State {
  return y.map((yi, i) => yi + h * (k[i] ?? 0));
}

/** Euler explícito: 1ª ordem, didático; perde energia ou ganha conforme o sistema. */
export const euler: Integrator = (f, y, p, t, dt) => axpy(y, f(y, p, t), dt);

/** Runge-Kutta clássico de 4ª ordem. */
export const rk4: Integrator = (f, y, p, t, dt) => {
  const k1 = f(y, p, t);
  const k2 = f(axpy(y, k1, dt / 2), p, t + dt / 2);
  const k3 = f(axpy(y, k2, dt / 2), p, t + dt / 2);
  const k4 = f(axpy(y, k3, dt), p, t + dt);
  return y.map((yi, i) => yi + (dt / 6) * ((k1[i] ?? 0) + 2 * (k2[i] ?? 0) + 2 * (k3[i] ?? 0) + (k4[i] ?? 0)));
};

/**
 * Velocity Verlet (simplético). Supõe o estado como [q₁..qₙ, v₁..vₙ] e que
 * `f` devolve [v₁..vₙ, a₁..aₙ] com a aceleração dependendo só da posição.
 * Conserva energia a longo prazo em sistemas conservativos.
 */
export const verlet: Integrator = (f, y, p, t, dt) => {
  const n = y.length / 2;
  if (!Number.isInteger(n)) throw new Error("verlet: o estado precisa ter a forma [q..., v...]");
  const a0 = f(y, p, t).slice(n);
  const q = y.slice(0, n).map((qi, i) => qi + dt * (y[n + i] ?? 0) + 0.5 * dt * dt * (a0[i] ?? 0));
  const vHalf = y.slice(n).map((vi, i) => vi + 0.5 * dt * (a0[i] ?? 0));
  const a1 = f([...q, ...vHalf], p, t + dt).slice(n);
  const v = vHalf.map((vi, i) => vi + 0.5 * dt * (a1[i] ?? 0));
  return [...q, ...v];
};

// Coeficientes de Dormand–Prince 5(4).
const DP_C = [0, 1 / 5, 3 / 10, 4 / 5, 8 / 9, 1, 1];
const DP_A = [
  [],
  [1 / 5],
  [3 / 40, 9 / 40],
  [44 / 45, -56 / 15, 32 / 9],
  [19372 / 6561, -25360 / 2187, 64448 / 6561, -212 / 729],
  [9017 / 3168, -355 / 33, 46732 / 5247, 49 / 176, -5103 / 18656],
  [35 / 384, 0, 500 / 1113, 125 / 192, -2187 / 6784, 11 / 84],
];
const DP_B5 = [35 / 384, 0, 500 / 1113, 125 / 192, -2187 / 6784, 11 / 84, 0];
const DP_B4 = [5179 / 57600, 0, 7571 / 16695, 393 / 640, -92097 / 339200, 187 / 2100, 1 / 40];

export interface AdaptiveOptions {
  rtol?: number;
  atol?: number;
  /** Menor subpasso permitido, em s. */
  hMin?: number;
}

/**
 * Dormand–Prince 5(4) com passo adaptativo: integra de t até t + dt com quantos
 * subpassos o controle de erro exigir. Bom para sistemas rígidos ou com
 * escalas de tempo muito diferentes (órbitas excêntricas, circuitos RLC).
 */
export function makeRk45(opts: AdaptiveOptions = {}): Integrator {
  const rtol = opts.rtol ?? 1e-9;
  const atol = opts.atol ?? 1e-12;
  const hMin = opts.hMin ?? 1e-12;
  return (f, y0, p, t0, dt) => {
    let y = y0.slice();
    let t = t0;
    const tEnd = t0 + dt;
    let h = dt;
    let guard = 0;
    while (t < tEnd - 1e-15 * Math.max(1, Math.abs(tEnd)) && guard++ < 100_000) {
      h = Math.min(h, tEnd - t);
      const k: State[] = [];
      for (let s = 0; s < 7; s++) {
        const a = DP_A[s]!;
        const ys = y.map((yi, i) => {
          let acc = yi;
          for (let j = 0; j < a.length; j++) acc += h * a[j]! * (k[j]![i] ?? 0);
          return acc;
        });
        k.push(f(ys, p, t + DP_C[s]! * h));
      }
      const y5 = y.map((yi, i) => yi + h * DP_B5.reduce((acc, b, s) => acc + b * (k[s]![i] ?? 0), 0));
      const y4 = y.map((yi, i) => yi + h * DP_B4.reduce((acc, b, s) => acc + b * (k[s]![i] ?? 0), 0));
      let err = 0;
      for (let i = 0; i < y.length; i++) {
        const sc = atol + rtol * Math.max(Math.abs(y[i]!), Math.abs(y5[i]!));
        err = Math.max(err, Math.abs(y5[i]! - y4[i]!) / sc);
      }
      if (err <= 1 || h <= hMin) {
        t += h;
        y = y5;
      }
      const factor = err === 0 ? 5 : Math.min(5, Math.max(0.2, 0.9 * err ** -0.2));
      h = Math.max(hMin, h * factor);
    }
    return y;
  };
}

export const rk45: Integrator = makeRk45();

export const integrators: Record<IntegratorName, Integrator> = { euler, rk4, verlet, rk45 };
