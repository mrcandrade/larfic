import { integrators } from "./integrators.ts";
import type { IntegratorName, Params, Simulation, State } from "./simulation.ts";

export interface Sample<S = State> {
  t: number;
  state: S;
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

function clone<S>(s: S): S {
  return Array.isArray(s) ? (s.slice() as S) : structuredClone(s);
}

/**
 * Executa uma simulação com passo de tempo fixo, desacoplado da taxa de
 * quadros: a UI chama `advance(segundosReais)` e o runner dá quantos passos
 * forem necessários. Guarda um histórico de amostras que serve para os
 * gráficos, a exportação CSV e para voltar no tempo.
 */
export class Runner<S = State> {
  readonly sim: Simulation<S>;
  params: Params;
  dt: number;
  integrator: IntegratorName;
  speed = 1;
  t = 0;
  state: S;
  finished = false;
  samples: Sample<S>[] = [];

  private readonly sampleEvery: number;
  private readonly maxSamples: number;
  private stepCount = 0;
  private accumulator = 0;

  constructor(sim: Simulation<S>, params: Params, opts: RunnerOptions = {}) {
    this.sim = sim;
    this.params = { ...params };
    this.dt = opts.dt ?? sim.dt ?? 1e-3;
    this.integrator = opts.integrator ?? sim.integrator ?? "rk4";
    this.sampleEvery = opts.sampleEvery ?? sim.sampleEvery ?? 10;
    this.maxSamples = opts.maxSamples ?? sim.maxSamples ?? 20_000;
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

  /** Troca parâmetros sem reiniciar (para parâmetros marcados como `live`). */
  setLiveParams(params: Params): void {
    this.params = { ...params };
  }

  /** Substitui o estado (interação do aluno no palco) e grava uma amostra. */
  setState(state: S): void {
    this.state = state;
    this.finished = false;
    this.record();
  }

  /** Avança `realSeconds` de tempo de parede multiplicado por `speed`. */
  advance(realSeconds: number): void {
    if (this.finished) return;
    this.accumulator += realSeconds * this.speed;
    // Limita o trabalho por quadro para não travar a aba (ex.: voltou do segundo plano).
    const maxSteps = 5_000;
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
    if (this.sim.tEnd !== undefined && this.t >= this.sim.tEnd - 1e-12) {
      this.finished = true;
      this.record();
      return;
    }
    if (this.stepCount % this.sampleEvery === 0) this.record();
  }

  /** Avança até o fim (ou `tMax`) sem animação: usado em testes e exercícios. */
  runToEnd(tMax = this.sim.tEnd ?? 60): this {
    while (!this.finished && this.t < tMax - 1e-12) this.stepOnce();
    return this;
  }

  /** Volta o estado para a amostra gravada mais próxima de `t` (descarta o futuro). */
  rewindTo(t: number): void {
    let i = this.samples.length - 1;
    while (i > 0 && (this.samples[i]?.t ?? 0) > t) i--;
    const s = this.samples[i];
    if (!s) return;
    this.samples.length = i + 1;
    this.state = clone(s.state);
    this.t = s.t;
    this.finished = false;
    this.accumulator = 0;
    this.stepCount = Math.round(s.t / this.dt);
  }

  observe(state: S = this.state, t: number = this.t): number[] {
    return this.sim.observables.map((o) => o.value(state, this.params, t));
  }

  /** Valor atual de um observável pela chave ("t" devolve o tempo). */
  value(key: string): number {
    if (key === "t") return this.t;
    const o = this.sim.observables.find((x) => x.key === key);
    if (!o) throw new Error(`${this.sim.id}: observável desconhecido "${key}"`);
    return o.value(this.state, this.params, this.t);
  }

  private integrate(y: S, t: number, h: number): S {
    if (this.sim.step) return this.sim.step(y, this.params, t, h);
    const f = this.sim.derivatives;
    if (!f) throw new Error(`${this.sim.id}: implemente derivatives ou step`);
    return integrators[this.integrator](f, y as State, this.params, t, h) as S;
  }

  /** Bissecção no tamanho do passo até o evento cruzar zero. */
  private locateEvent(y: S, t: number, dt: number): number {
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
    this.samples.push({ t: this.t, state: clone(this.state), values: this.observe() });
    if (this.samples.length > this.maxSamples) this.samples.splice(0, this.samples.length - this.maxSamples);
  }
}
