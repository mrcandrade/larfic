import { integrators } from "./integrators.ts";
import type { IntegratorName, Params, Simulation, State } from "./simulation.ts";

export interface Sample {
  t: number;
  state: State;
  /** Valores dos observáveis, na ordem de `sim.observables`. */
  values: number[];
}

export interface RunnerOptions {
  /** Passo de tempo físico fixo, em segundos. */
  dt?: number;
  integrator?: IntegratorName;
  /** Grava uma amostra a cada N passos. */
  sampleEvery?: number;
  /** Máximo de amostras guardadas (para gráficos, exportação e voltar no tempo). */
  maxSamples?: number;
}

/**
 * Executa uma simulação com passo de tempo fixo, desacoplado da taxa de
 * quadros: a UI chama `advance(segundosReais)` e o runner dá quantos passos
 * forem necessários. Guarda um histórico de amostras que serve para os
 * gráficos, a exportação CSV e para voltar no tempo.
 */
export class Runner {
  readonly sim: Simulation;
  params: Params;
  dt: number;
  integrator: IntegratorName;
  speed = 1;
  t = 0;
  state: State;
  finished = false;
  samples: Sample[] = [];

  private readonly sampleEvery: number;
  private readonly maxSamples: number;
  private stepCount = 0;
  private accumulator = 0;

  constructor(sim: Simulation, params: Params, opts: RunnerOptions = {}) {
    this.sim = sim;
    this.params = { ...params };
    this.dt = opts.dt ?? 1e-3;
    this.integrator = opts.integrator ?? sim.integrator ?? "rk4";
    this.sampleEvery = opts.sampleEvery ?? 10;
    this.maxSamples = opts.maxSamples ?? 20_000;
    this.state = sim.init(this.params);
    this.record();
  }

  reset(params: Params = this.params): void {
    this.params = { ...params };
    this.t = 0;
    this.state = this.sim.init(this.params);
    this.finished = false;
    this.samples = [];
    this.stepCount = 0;
    this.accumulator = 0;
    this.record();
  }

  /** Avança `realSeconds` de tempo de parede multiplicado por `speed`. */
  advance(realSeconds: number): void {
    if (this.finished) return;
    this.accumulator += realSeconds * this.speed;
    // Evita a "espiral da morte" quando a aba fica em segundo plano.
    const maxSteps = 20_000;
    let n = 0;
    while (this.accumulator >= this.dt && !this.finished && n < maxSteps) {
      this.stepOnce();
      this.accumulator -= this.dt;
      n++;
    }
    if (n === maxSteps) this.accumulator = 0;
  }

  /** Dá exatamente um passo de integração. */
  stepOnce(): void {
    if (this.finished) return;
    const next = this.integrate(this.state, this.t, this.dt);
    const tNext = this.t + this.dt;
    const stop = this.sim.stopWhen;
    if (stop && stop(this.state, this.params, this.t) > 0 && stop(next, this.params, tNext) <= 0) {
      const h = this.locateEvent(this.state, this.t, this.dt);
      this.state = this.integrate(this.state, this.t, h);
      this.t += h;
      this.finished = true;
      this.record();
      return;
    }
    this.state = next;
    this.t = tNext;
    this.stepCount++;
    if (this.stepCount % this.sampleEvery === 0) this.record();
  }

  /** Volta o estado para a amostra gravada mais próxima de `t` (descarta o futuro). */
  rewindTo(t: number): void {
    let i = this.samples.length - 1;
    while (i > 0 && (this.samples[i]?.t ?? 0) > t) i--;
    const s = this.samples[i];
    if (!s) return;
    this.samples.length = i + 1;
    this.state = [...s.state];
    this.t = s.t;
    this.finished = false;
    this.accumulator = 0;
    this.stepCount = Math.round(s.t / this.dt);
  }

  observe(state: State = this.state, t: number = this.t): number[] {
    return this.sim.observables.map((o) => o.value(state, this.params, t));
  }

  private integrate(y: State, t: number, h: number): State {
    if (this.sim.step) return this.sim.step(y, this.params, t, h);
    const f = this.sim.derivatives;
    if (!f) throw new Error(`${this.sim.id}: implemente derivatives ou step`);
    return integrators[this.integrator](f, y, this.params, t, h);
  }

  /** Bissecção no tamanho do passo até o evento cruzar zero. */
  private locateEvent(y: State, t: number, dt: number): number {
    const stop = this.sim.stopWhen!;
    let lo = 0;
    let hi = dt;
    for (let i = 0; i < 60; i++) {
      const mid = (lo + hi) / 2;
      if (stop(this.integrate(y, t, mid), this.params, t + mid) > 0) lo = mid;
      else hi = mid;
    }
    return hi;
  }

  private record(): void {
    this.samples.push({ t: this.t, state: [...this.state], values: this.observe() });
    if (this.samples.length > this.maxSamples) this.samples.splice(0, this.samples.length - this.maxSamples);
  }
}
