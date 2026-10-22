/**
 * Contrato de uma simulação. Cada módulo em sims/* exporta um objeto que
 * implementa esta interface; o framework (runner, app, gráficos, exportação)
 * cuida do resto.
 */

/** Estado dinâmico: vetor de números em unidades SI, descrito por `stateVars`. */
export type State = number[];

/** Valores dos parâmetros controláveis, indexados pela chave de cada ParamSpec. */
export type Params = Record<string, number>;

/** Descreve uma variável de estado (posição no vetor = índice no array). */
export interface VarSpec {
  key: string;
  label: string;
  /** Unidade SI, por exemplo "m", "m/s", "J". */
  unit: string;
}

/** Controle exposto ao aluno (slider ou campo numérico). */
export interface ParamSpec extends VarSpec {
  min: number;
  max: number;
  step: number;
  default: number;
}

/** Grandeza medível derivada do estado, que alimenta gráficos e instrumentos. */
export interface Observable extends VarSpec {
  value(state: State, params: Params, t: number): number;
}

/** Preset com roteiro didático em Markdown. */
export interface Scenario {
  id: string;
  label: string;
  params: Partial<Params>;
  /** Roteiro didático em Markdown. */
  guide: string;
}

/** Janela do mundo físico a desenhar, em metros. */
export interface Viewport {
  width: number;
  height: number;
}

export interface Simulation {
  id: string;
  title: string;
  /** Disciplina do catálogo, por exemplo "FG I". */
  course: string;
  summary: string;
  /** Equações do modelo em LaTeX, exibidas ao lado da simulação. */
  equations: string[];

  stateVars: VarSpec[];
  params: ParamSpec[];
  observables: Observable[];
  scenarios: Scenario[];
  /** Chave do observável que deve se conservar; o app mostra o desvio relativo. */
  conserved?: string;

  /** Estado inicial a partir dos parâmetros. */
  init(params: Params): State;

  /**
   * A física, na forma dy/dt = f(y, t). O framework escolhe o integrador.
   * Use `step` no lugar quando o modelo não for uma EDO.
   */
  derivatives?(state: State, params: Params, t: number): State;
  step?(state: State, params: Params, t: number, dt: number): State;

  /** Integrador preferido quando `derivatives` é usado. */
  integrator?: IntegratorName;

  /**
   * Função de evento que encerra a simulação ao cruzar de positivo para
   * zero (por exemplo, a altura do projétil). O runner localiza o instante
   * exato do cruzamento por bissecção.
   */
  stopWhen?(state: State, params: Params, t: number): number;

  /** Região do mundo que o renderizador deve enquadrar. */
  viewport(params: Params): Viewport;

  /** Desenho 2D a partir do estado, em coordenadas do mundo (metros, y para cima). */
  render(ctx: CanvasRenderingContext2D, frame: RenderFrame): void;
}

export interface RenderFrame {
  state: State;
  params: Params;
  t: number;
  /** Trajetória já percorrida, em estados amostrados. */
  trail: State[];
  /** Converte metros para pixels. */
  scale: number;
}

export type IntegratorName = "euler" | "rk4" | "verlet";

export function defaultParams(sim: Simulation): Params {
  return Object.fromEntries(sim.params.map((p) => [p.key, p.default]));
}

/** Parâmetros padrão sobrescritos por um preset (por exemplo, `scenario.params`). */
export function withOverrides(sim: Simulation, overrides: Partial<Params> = {}): Params {
  const p = defaultParams(sim);
  for (const [k, v] of Object.entries(overrides)) if (v !== undefined) p[k] = v;
  return p;
}
