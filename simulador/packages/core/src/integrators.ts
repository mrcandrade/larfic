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

export const integrators: Record<IntegratorName, Integrator> = { euler, rk4, verlet };
