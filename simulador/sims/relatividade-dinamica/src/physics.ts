/**
 * Física da sim: paradoxo dos gêmeos (unidades com c = 1: x em anos-luz, ct em
 * anos), Doppler relativístico e dinâmica relativística (energias em MeV).
 */

export interface Evento {
  x: number;
  ct: number;
}

export const gammaOf = (beta: number) => 1 / Math.sqrt(1 - beta * beta);

/** Velocidade máxima permitida ao arrastar a linha de mundo (fração de c). */
export const BETA_MAX = 0.995;

/** Viagem de ida e volta: origem → P (virada) → reencontro em (0, T). */
export interface Trip {
  P: Evento;
  T: number;
}

/** Trecho de ida: velocidade com sinal (dx/dt). */
export const vOut = (tr: Trip) => tr.P.x / tr.P.ct;
/** Trecho de volta: velocidade com sinal. */
export const vIn = (tr: Trip) => -tr.P.x / (tr.T - tr.P.ct);

/** Posição do viajante no tempo t da Terra. */
export function travelerX(tr: Trip, t: number): number {
  if (t <= 0) return 0;
  if (t <= tr.P.ct) return vOut(tr) * t;
  if (t >= tr.T) return 0;
  return tr.P.x + vIn(tr) * (t - tr.P.ct);
}

/** Velocidade do viajante no tempo t da Terra. */
export const travelerV = (tr: Trip, t: number) => (t < tr.P.ct ? vOut(tr) : t < tr.T ? vIn(tr) : 0);

/** Tempo próprio do viajante quando a Terra marca t. */
export function properTime(tr: Trip, t: number): number {
  const tc = Math.max(0, Math.min(t, tr.T));
  const g1 = gammaOf(vOut(tr));
  if (tc <= tr.P.ct) return tc / g1;
  return tr.P.ct / g1 + (tc - tr.P.ct) / gammaOf(vIn(tr));
}

/** Tempo da Terra em que o viajante marca o tempo próprio τ. */
export function earthTimeAt(tr: Trip, tau: number): number {
  const g1 = gammaOf(vOut(tr));
  const tauP = tr.P.ct / g1;
  if (tau <= tauP) return tau * g1;
  return tr.P.ct + (tau - tauP) * gammaOf(vIn(tr));
}

/** Tempo próprio total do viajante na viagem. */
export const totalProperTime = (tr: Trip) => properTime(tr, tr.T);

/** Lado em que o viajante está (+1 ou −1). */
const side = (tr: Trip) => (tr.P.x < 0 ? -1 : 1);

/**
 * Sinal de luz emitido pela Terra em t = k: tempo da Terra (coordenada) em
 * que alcança o viajante. Resolve t − k = |x(t)| por bissecção (a função é
 * estritamente crescente porque |v| < c).
 */
export function earthSignalArrival(tr: Trip, k: number): number {
  const g = (t: number) => t - k - side(tr) * travelerX(tr, t);
  if (g(tr.T) < 0) return NaN;
  let a = k;
  let b = tr.T;
  for (let i = 0; i < 60; i++) {
    const m = (a + b) / 2;
    if (g(m) < 0) a = m;
    else b = m;
  }
  return (a + b) / 2;
}

/** Sinal emitido pelo viajante no tempo próprio τ = j: tempo da Terra em que chega. */
export function travelerSignalArrival(tr: Trip, j: number): number {
  const te = earthTimeAt(tr, j);
  return te + Math.abs(travelerX(tr, te));
}

/** Contagens de sinais (um por ano de cada relógio) até o tempo t da Terra. */
export function signalCounts(tr: Trip, t: number) {
  const tc = Math.min(t, tr.T);
  const tau = properTime(tr, tc);
  let travelerReceived = 0;
  for (let k = 1; k <= Math.floor(tr.T + 1e-9); k++) {
    const a = earthSignalArrival(tr, k);
    if (Number.isFinite(a) && a <= tc + 1e-9) travelerReceived++;
  }
  let earthReceived = 0;
  for (let j = 1; j <= Math.floor(totalProperTime(tr) + 1e-9); j++) if (travelerSignalArrival(tr, j) <= tc + 1e-9) earthReceived++;
  return { earthSent: Math.floor(tc + 1e-9), travelerSent: Math.floor(tau + 1e-9), travelerReceived, earthReceived };
}

/**
 * Linha de simultaneidade do viajante no tempo t da Terra: o instante da Terra
 * que ele considera "agora" (ct − t_e = v (x − x_e) cortando x = 0).
 */
export function earthNowForTraveler(tr: Trip, t: number): number {
  const x = travelerX(tr, t);
  return t - travelerV(tr, t) * x;
}

/** Salto do "agora na Terra" na virada: de t_P − v₁x_P para t_P − v₂x_P. */
export function simultaneityJump(tr: Trip) {
  return { before: tr.P.ct - vOut(tr) * tr.P.x, after: tr.P.ct - vIn(tr) * tr.P.x };
}

/** Fator Doppler longitudinal f_obs/f_fonte para velocidade de afastamento β. */
export const dopplerFactor = (betaRecession: number) => Math.sqrt((1 - betaRecession) / (1 + betaRecession));
/** λ observado para fonte que se afasta com β (negativo: aproxima). */
export const dopplerLambda = (lambda0: number, betaRecession: number) => lambda0 * Math.sqrt((1 + betaRecession) / (1 - betaRecession));
/** Doppler "clássico" com fonte em movimento: λ = λ₀ (1 + β). */
export const classicalLambda = (lambda0: number, betaRecession: number) => lambda0 * (1 + betaRecession);
/** λ medido no referencial do laboratório numa direção a ângulo θ da velocidade da fonte. */
export const lambdaAtAngle = (lambda0: number, beta: number, theta: number) => lambda0 * gammaOf(beta) * (1 - beta * Math.cos(theta));

// ---------- dinâmica relativística (MeV, ns) ----------

/** Distância percorrida pela luz em 1 ns (m). */
export const C_M_PER_NS = 0.299792458;

export const PARTICLES = [
  { name: "elétron", mc2: 0.51099895 },
  { name: "múon", mc2: 105.6583755 },
  { name: "próton", mc2: 938.27208816 },
];

/** Energia total E = √((pc)² + (mc²)²). */
export const energy = (pc: number, mc2: number) => Math.hypot(pc, mc2);
/** v/c = pc/E. */
export const betaFromP = (pc: number, mc2: number) => pc / energy(pc, mc2);
/** Energia cinética relativística K = E − mc². */
export const kinetic = (pc: number, mc2: number) => energy(pc, mc2) - mc2;
/** Energia cinética clássica p²/2m. */
export const kineticClassical = (pc: number, mc2: number) => (pc * pc) / (2 * mc2);
/** pc a partir da energia cinética: pc = √(K² + 2K mc²). */
export const pcFromK = (K: number, mc2: number) => Math.sqrt(K * K + 2 * K * mc2);
