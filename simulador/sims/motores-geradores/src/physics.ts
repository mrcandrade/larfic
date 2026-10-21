/**
 * Física de motores e geradores: motor DC com comutador (fcem e característica
 * torque × rotação), máquinas homopolares (disco de Faraday, roda de Barlow,
 * motor de Faraday), dínamo × alternador, gerador trifásico em estrela e
 * pêndulo de Waltenhofen (freio por correntes de Foucault).
 */

export const G = 9.81;

// ------------------------------------------------------------ motor DC
/** Fator que faz a média de k(θ) valer k₀ para m bobinas com comutador de 2m segmentos. */
export const commutatorNorm = (m: number) => Math.PI / (2 * m * Math.sin(Math.PI / (2 * m)));

/** Constante de torque instantânea k(θ) = k₀ c_m max_j |sen(θ + jπ/m)|. */
export function kTheta(k0: number, m: number, th: number): number {
  let best = 0;
  for (let j = 0; j < m; j++) best = Math.max(best, Math.abs(Math.sin(th + (j * Math.PI) / m)));
  return k0 * commutatorNorm(m) * best;
}

export interface DCMotor {
  V: number;
  R: number;
  /** Constante média de torque / fcem (N·m/A = V·s/rad). */
  k: number;
  /** Bobinas do rotor (1 = espira única com comutador de 2 segmentos). */
  m: number;
  J: number;
  /** Atrito viscoso (N·m·s). */
  b: number;
  /** Torque de carga (N·m), sempre contra a rotação. */
  load: number;
}

/** Corrente, fcem e torque instantâneos. */
export function motorState(mp: DCMotor, th: number, w: number) {
  const k = kTheta(mp.k, mp.m, th);
  const fem = k * w;
  const i = (mp.V - fem) / mp.R;
  return { k, fem, i, tau: k * i };
}

/** Torque de carga suave (anula-se em ω = 0 para não inverter o sentido). */
export const loadTorque = (load: number, w: number) => load * Math.tanh(w / 0.5);

export function motorDeriv(mp: DCMotor, th: number, w: number): [number, number] {
  const { tau } = motorState(mp, th, w);
  return [w, (tau - loadTorque(mp.load, w) - mp.b * w) / mp.J];
}

/** Rotação de regime (k médio, atrito incluído): ω = (kV − Rτ_L)/(k² + R b). */
export const steadyOmega = (mp: DCMotor) => Math.max(0, (mp.k * mp.V - mp.R * mp.load) / (mp.k * mp.k + mp.R * mp.b));
/** Torque de partida (rotor travado) e rotação em vazio ideal. */
export const stallTorque = (mp: DCMotor) => (mp.k * mp.V) / mp.R;
export const noLoadOmega = (mp: DCMotor) => mp.V / mp.k;

/** Passo RK4 genérico para estado [θ, ω]. */
export function rk4(f: (th: number, w: number) => [number, number], th: number, w: number, h: number): [number, number] {
  const [a1, b1] = f(th, w);
  const [a2, b2] = f(th + (h / 2) * a1, w + (h / 2) * b1);
  const [a3, b3] = f(th + (h / 2) * a2, w + (h / 2) * b2);
  const [a4, b4] = f(th + h * a3, w + h * b3);
  return [th + (h / 6) * (a1 + 2 * a2 + 2 * a3 + a4), w + (h / 6) * (b1 + 2 * b2 + 2 * b3 + b4)];
}

// ------------------------------------------------------------ máquinas homopolares
/** Fem do disco de Faraday: ε = ½ B ω a² (entre eixo e borda). */
export const diskEmf = (B: number, w: number, a: number) => 0.5 * B * w * a * a;
/** Constante da máquina homopolar k = ε/ω. Disco: ½Ba²; fio de comprimento L a raio médio r̄: B L r̄. */
export const diskK = (B: number, a: number) => 0.5 * B * a * a;
export const wireK = (B: number, L: number, r: number) => B * L * r;

// ------------------------------------------------------------ dínamo × alternador
/** Fem de uma bobina girando: ε = N B A ω sen θ. */
export const coilEmf = (N: number, B: number, A: number, w: number, th: number) => N * B * A * w * Math.sin(th);
/** Saída do alternador (anéis coletores) e do dínamo (comutador com m bobinas defasadas). */
export const alternatorOut = (E0: number, th: number) => E0 * Math.sin(th);
export function dynamoOut(E0: number, th: number, m: number): number {
  let best = 0;
  for (let j = 0; j < m; j++) best = Math.max(best, Math.abs(Math.sin(th + (j * Math.PI) / m)));
  return E0 * best;
}
/** Média da saída do dínamo: E₀ (2m/π) sen(π/2m) (= 2E₀/π para uma bobina). */
export const dynamoMean = (E0: number, m: number) => (E0 * 2 * m * Math.sin(Math.PI / (2 * m))) / Math.PI;

// ------------------------------------------------------------ trifásico
export interface C {
  re: number;
  im: number;
}
export const cx = (re: number, im = 0): C => ({ re, im });
export const cadd = (a: C, b: C): C => ({ re: a.re + b.re, im: a.im + b.im });
export const csub = (a: C, b: C): C => ({ re: a.re - b.re, im: a.im - b.im });
export const cmul = (a: C, b: C): C => ({ re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re });
export const cscale = (a: C, k: number): C => ({ re: a.re * k, im: a.im * k });
export const cabs = (a: C) => Math.hypot(a.re, a.im);
export const polar = (r: number, ang: number): C => ({ re: r * Math.cos(ang), im: r * Math.sin(ang) });

export interface ThreePhase {
  /** Tensão de fase eficaz (V). */
  Vf: number;
  /** +1 para sequência ABC, −1 para ACB. */
  seq: 1 | -1;
  /** Resistências de carga por fase (Ω). */
  R: [number, number, number];
  /** Neutro ligado entre gerador e carga. */
  neutral: boolean;
}

/**
 * Fasores (amplitudes eficazes) de uma ligação estrela–estrela com carga resistiva.
 * Sem neutro, o centro da carga desloca-se de V_N'N = Σ(V_k/R_k)/Σ(1/R_k).
 */
export function starPhasors(tp: ThreePhase) {
  const V = [0, 1, 2].map((k) => polar(tp.Vf, (-tp.seq * k * 2 * Math.PI) / 3));
  const Y = tp.R.map((r) => 1 / r);
  let shift = cx(0);
  if (!tp.neutral) {
    const num = V.reduce((s, v, k) => cadd(s, cscale(v, Y[k]!)), cx(0));
    shift = cscale(num, 1 / (Y[0]! + Y[1]! + Y[2]!));
  }
  const Vload = V.map((v) => csub(v, shift));
  const I = Vload.map((v, k) => cscale(v, Y[k]!));
  const IN = I.reduce((s, i) => cadd(s, i), cx(0));
  const Vline = [csub(V[0]!, V[1]!), csub(V[1]!, V[2]!), csub(V[2]!, V[0]!)];
  const P = Vload.reduce((s, v, k) => s + cabs(v) ** 2 * Y[k]!, 0);
  return { V, Vload, I, IN, Vline, shift, P };
}

/** Valor instantâneo de um fasor eficaz: √2 Re{X e^{iωt}}. */
export const inst = (X: C, wt: number) => Math.SQRT2 * (X.re * Math.cos(wt) - X.im * Math.sin(wt));

// ------------------------------------------------------------ pêndulo de Waltenhofen
export const MATERIAIS = [
  { nome: "Alumínio", sigma: 3.5e7, rho: 2700 },
  { nome: "Cobre", sigma: 5.96e7, rho: 8960 },
  { nome: "Latão", sigma: 1.6e7, rho: 8500 },
];

export const PEND = {
  /** Distância do eixo ao centro da placa (m). */
  ell: 0.3,
  /** Meia largura da placa e área da placa (6 cm × 6 cm). */
  wp: 0.03,
  Aplate: 0.06 * 0.06,
  /** Meia largura dos polos do ímã (3 cm × 3 cm). */
  wm: 0.015,
  Apole: 0.03 * 0.03,
  /** Fator geométrico do freio: placa maciça e placa com fendas. */
  alphaSolid: 0.25,
  alphaSlot: 0.025,
};

/** Fração da face do polo coberta pela placa quando o pêndulo está em θ. */
export function overlap(th: number): number {
  const s = PEND.ell * th;
  const o = Math.min(s + PEND.wp, PEND.wm) - Math.max(s - PEND.wp, -PEND.wm);
  return Math.max(0, o) / (2 * PEND.wm);
}

export interface Pendulum {
  sigma: number;
  rho: number;
  /** Espessura da placa (m). */
  delta: number;
  B: number;
  alpha: number;
}

export const pendMass = (pp: Pendulum) => pp.rho * pp.delta * PEND.Aplate;
export const pendInertia = (pp: Pendulum) => pendMass(pp) * (PEND.ell ** 2 + (2 * PEND.wp) ** 2 / 6);
/** Coeficiente de amortecimento angular c(θ) (N·m·s): torque = −c ω. */
export const brakeC = (pp: Pendulum, th: number) => pp.alpha * pp.sigma * pp.delta * pp.B ** 2 * PEND.Apole * PEND.ell ** 2 * overlap(th);

export function pendDeriv(pp: Pendulum, th: number, w: number): [number, number] {
  const I = pendInertia(pp);
  return [w, (-pendMass(pp) * G * PEND.ell * Math.sin(th) - brakeC(pp, th) * w) / I];
}

export const pendEnergy = (pp: Pendulum, th: number, w: number) => 0.5 * pendInertia(pp) * w * w + pendMass(pp) * G * PEND.ell * (1 - Math.cos(th));
