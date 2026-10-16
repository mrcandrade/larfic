/**
 * Contrato de uma simulação. Cada módulo em sims/* exporta um objeto que
 * implementa esta interface; o framework (runner, app, gráficos, exportação,
 * roteiros e exercícios) cuida do resto.
 *
 * O estado `S` é, na maioria das sims, um vetor de números em unidades SI
 * (`number[]`), integrado a partir de `derivatives`. Sims com estrutura
 * própria (um circuito editável, um gás de partículas) usam qualquer
 * objeto clonável e implementam `step`.
 */

/** Valores dos parâmetros controláveis, indexados pela chave de cada ParamSpec. */
export type Params = Record<string, number>;

/** Estado vetorial padrão. */
export type State = number[];

/** Descreve uma grandeza com rótulo e unidade SI. */
export interface VarSpec {
  key: string;
  label: string;
  /** Unidade SI, por exemplo "m", "m/s", "J". Vazio para adimensional. */
  unit: string;
}

/** Controle exposto ao aluno: slider numérico ou lista de opções. */
export interface ParamSpec extends VarSpec {
  min: number;
  max: number;
  step: number;
  default: number;
  /** Quando presente, o controle vira uma lista; `value` é gravado no parâmetro. */
  options?: { value: number; label: string }[];
  /** Escala logarítmica no slider (útil para resistências, frequências). */
  log?: boolean;
  /** Mudar este parâmetro não reinicia a simulação (ex.: força externa ao vivo). */
  live?: boolean;
}

/** Grandeza medível derivada do estado, que alimenta gráficos e instrumentos. */
export interface Observable<S = State> extends VarSpec {
  value(state: S, params: Params, t: number): number;
}

/** Pergunta de previsão do ciclo prever → observar → explicar. */
export interface Prediction {
  question: string;
  options: string[];
  answer: number;
  explanation: string;
}

/** Preset com roteiro didático em Markdown. */
export interface Scenario {
  id: string;
  label: string;
  params: Partial<Params>;
  /** Roteiro didático em Markdown (### títulos, listas, **negrito**, $tex$ inline). */
  guide: string;
  /** Perguntas de previsão feitas antes de rodar o cenário. */
  predict?: Prediction[];
}

/**
 * Modelo de exercício paramétrico: valores sorteados dentro de faixas, resposta
 * calculada pela própria física da simulação, correção com tolerância relativa.
 */
export interface ExerciseTemplate {
  id: string;
  /** Enunciado com marcadores {chave} substituídos pelos valores sorteados. */
  prompt: string;
  /** Faixas de sorteio por parâmetro: [min, max, casas decimais]. */
  vary: Record<string, [number, number, number]>;
  /** Parâmetros fixos aplicados à simulação junto com os sorteados. */
  fixed?: Partial<Params>;
  answer: { label: string; unit: string; compute(params: Params): number };
  /** Tolerância relativa aceita na resposta (padrão 2%). */
  tolerance?: number;
  hint?: string;
}

/** Retângulo do mundo físico a enquadrar, em unidades da sim (normalmente metros). */
export interface Viewport {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  /** Rótulo da unidade dos eixos desenhados no palco ("m", "cm", "nm"...). Vazio esconde os eixos. */
  unit?: string;
}

export interface RenderFrame<S = State> {
  state: S;
  params: Params;
  t: number;
  /** Estados amostrados até agora (rastro). */
  trail: S[];
  /** Pixels por unidade do mundo. */
  scale: number;
  /** Paleta resolvida do tema atual (claro/escuro). */
  theme: Theme;
}

export interface Theme {
  text: string;
  muted: string;
  grid: string;
  accent: string;
  /** Cores categóricas para séries, cargas, corpos. */
  series: string[];
  positive: string;
  negative: string;
  ground: string;
  dark: boolean;
}

/** Ponto do mundo para interação por ponteiro. */
export interface WorldPoint {
  x: number;
  y: number;
}

/** Interação por arrastar/clicar no palco. Cada handler devolve o novo estado (ou undefined para ignorar). */
export interface PointerHandlers<S> {
  down?(state: S, params: Params, p: WorldPoint): S | undefined;
  move?(state: S, params: Params, p: WorldPoint, dragging: boolean): S | undefined;
  up?(state: S, params: Params, p: WorldPoint): S | undefined;
  /** Cursor CSS quando o ponteiro está sobre algo arrastável. */
  cursor?(state: S, params: Params, p: WorldPoint): string | undefined;
}

/** Botão de ação no painel (trocar ferramenta, limpar, adicionar carga...). */
export interface SimAction<S> {
  id: string;
  label: string;
  run(state: S, params: Params): S;
  /** Destaca o botão (ex.: ferramenta ativa). */
  active?(state: S): boolean;
}

export type Priority = "P1" | "P2" | "P3";
export type Course = "FG I" | "FG II" | "FG III" | "FG IV" | "Exp I" | "Exp II" | "Exp III";

export interface Simulation<S = State> {
  id: string;
  title: string;
  course: Course;
  /** Tópico do catálogo, por exemplo "Cinemática 2D". */
  topic: string;
  priority: Priority;
  summary: string;
  /** Equações do modelo em LaTeX. */
  equations: string[];
  /** Equações vivas: LaTeX com os valores atuais substituídos. */
  liveEquations?(state: S, params: Params, t: number): string[];

  params: ParamSpec[];
  observables: Observable<S>[];
  scenarios: Scenario[];
  exercises?: ExerciseTemplate[];
  /** Chave do observável que deve se conservar; o app mostra o desvio relativo. */
  conserved?: string;
  /** Eixos padrão do gráfico: chave do eixo x ("t" para tempo) e do eixo y. */
  chart?: { x: string; y: string };

  /** Estado inicial a partir dos parâmetros. */
  init(params: Params): S;

  /** A física na forma dy/dt = f(y, t), para estados vetoriais. O runner escolhe o integrador. */
  derivatives?(state: State, params: Params, t: number): State;
  /** Passo explícito, para modelos que não são uma EDO ou têm estado estruturado. */
  step?(state: S, params: Params, t: number, dt: number): S;
  integrator?: IntegratorName;
  /** Passo físico preferido, em segundos (padrão 1 ms). */
  dt?: number;
  /** Estática: não há evolução temporal; o app esconde os controles de tempo. */
  static?: boolean;
  /** Grava uma amostra a cada N passos (padrão 10). */
  sampleEvery?: number;
  /** Máximo de amostras guardadas (padrão 20 000). Reduza para estados grandes. */
  maxSamples?: number;

  /**
   * Função de evento que encerra a simulação ao cruzar de positivo para zero
   * (por exemplo, a altura do projétil). O runner localiza o instante exato
   * do cruzamento por bissecção.
   */
  stopWhen?(state: S, params: Params, t: number): number;
  /** Tempo máximo de simulação, em segundos. */
  tEnd?: number;

  /** Região do mundo que o palco deve enquadrar. */
  viewport(params: Params, state: S): Viewport;
  /** Desenho 2D a partir do estado, em coordenadas do mundo (y para cima). */
  render(ctx: CanvasRenderingContext2D, frame: RenderFrame<S>): void;

  pointer?: PointerHandlers<S>;
  actions?: SimAction<S>[];
  /** Som contínuo enquanto a simulação roda (o app toca com Web Audio; ganho 0 silencia). */
  tone?(params: Params, state: S): { freq: number; gain: number; harmonics?: number[] };
}

export type IntegratorName = "euler" | "rk4" | "verlet" | "rk45";

/** Qualquer simulação, independentemente do tipo de estado (para catálogos). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnySimulation = Simulation<any>;

/** Ajuda a tipar a declaração de uma sim mantendo a inferência do estado. */
export function defineSim<S = State>(sim: Simulation<S>): Simulation<S> {
  return sim;
}

export function defaultParams(sim: { params: ParamSpec[] }): Params {
  return Object.fromEntries(sim.params.map((p) => [p.key, p.default]));
}

/** Parâmetros padrão sobrescritos por um preset (por exemplo, `scenario.params`). */
export function withOverrides(sim: { params: ParamSpec[] }, overrides: Partial<Params> = {}): Params {
  const p = defaultParams(sim);
  for (const [k, v] of Object.entries(overrides)) if (v !== undefined) p[k] = v;
  return p;
}

/** Lê um parâmetro numérico com valor padrão (evita `?? 0` espalhado pelas sims). */
export function num(p: Params, key: string, fallback = 0): number {
  const v = p[key];
  return v === undefined || Number.isNaN(v) ? fallback : v;
}
