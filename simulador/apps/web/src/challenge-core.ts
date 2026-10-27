// Modo desafio: metas com física de verdade, avaliadas rodando a própria simulação de forma
// determinística (Runner + withOverrides). O aluno só mexe nos parâmetros liberados (e, em alguns
// desafios, monta algo no palco); todo o resto é reaplicado na avaliação, então não há atalho.
//
// Este módulo é puro (sem DOM nem React) e só importa as simulações que os desafios usam: o app o
// importa e a Edge Function `desafio` usa o mesmo código (empacotado por scripts/bundle-desafio.mjs)
// para refazer a avaliação no servidor.
import { Runner, clamp, formatBR, withOverrides, type AnySimulation, type Params } from "@fisilab/core";
import { braquistocrona, curvesOf, cycloidR, cycloidTheta, type BQ } from "@fisilab/sim-braquistocrona";
import { calorimetria } from "@fisilab/sim-calorimetria";
import { circuitosDc, makeComp, solveStep, type CircuitState, type Kind } from "@fisilab/sim-circuitos-dc";
import { foguete, ignitionMasses, deltaVIdeal } from "@fisilab/sim-foguete";
import { jogosFisica, type Carga, type JF } from "@fisilab/sim-jogos-fisica";
import { lentes, type Bench, type El } from "@fisilab/sim-lentes";
import { millikan, balanceVoltage, drift, fallSpeed, E_CHARGE, GAP, RETICLE, type MKState } from "@fisilab/sim-millikan";
import { montanhaRussa, trackOf, type Coaster } from "@fisilab/sim-montanha-russa";
import { ponteWheatstone } from "@fisilab/sim-ponte-wheatstone";
import { projetilArrasto } from "@fisilab/sim-projetil-arrasto";
import { ressonancia } from "@fisilab/sim-ressonancia";
import { rlcCa } from "@fisilab/sim-rlc-ca";
import { sistemaSolar } from "@fisilab/sim-sistema-solar";

/** Simulações usadas pelos desafios (só estas entram no pacote do servidor). */
const SIMS: AnySimulation[] = [
  projetilArrasto, jogosFisica, sistemaSolar, ressonancia, calorimetria, ponteWheatstone, rlcCa, montanhaRussa, lentes, braquistocrona, foguete, circuitosDc, millikan,
] as AnySimulation[];

export const challengeSim = (id: string): AnySimulation | undefined => SIMS.find((s) => s.id === id);

export type Level = 1 | 2 | 3;
export const LEVELS: Record<Level, string> = { 1: "Fácil", 2: "Médio", 3: "Difícil" };

export interface Metric {
  label: string;
  value: number;
  unit?: string;
  digits?: number;
}

export interface Outcome {
  /** Cumpriu o objetivo mínimo. */
  ok: boolean;
  /** Precisão em relação à meta, de 0 a 1. */
  accuracy: number;
  /** Economia (combustível, massa, cargas, seletividade...), de 0 a 1; 1 quando não se aplica. */
  economy: number;
  metrics: Metric[];
  message: string;
}

/** O que o aluno entrega: valores dos parâmetros e, se for o caso, o que montou no palco. */
export interface Attempt {
  params: Record<string, number>;
  build?: unknown;
}

export interface Challenge<B = unknown> {
  id: string;
  title: string;
  level: Level;
  sim: string;
  scenario?: string;
  /** Meta em uma ou duas frases (markdown simples). */
  goal: string;
  hint: string;
  /** Parâmetros fixados pelo desafio (reaplicados na avaliação). */
  base: Params;
  /** Parâmetros que o aluno ajusta e que entram na avaliação. */
  knobs: string[];
  /** Parâmetros liberados só para explorar; a avaliação usa o valor de `base`. */
  explore?: string[];
  /** Nome do eixo "economia" na tela, quando o desafio tem um. */
  economyLabel?: string;
  /** Montagem no palco: o que capturar do estado da simulação (validado). */
  build?: { what: string; capture(state: unknown, params: Params): B | undefined };
  evaluate(params: Params, build: B | undefined): Outcome;
  /** Solução de referência (3 estrelas) e uma resposta ruim, usadas nos testes. */
  reference: Attempt;
  bad: Attempt;
}

// ------------------------------------------------------------------ utilidades

const fmt = (v: number, d = 3) => formatBR(v, d);

/** 1 sem erro, 0,9 no limite da tolerância, caindo suavemente depois. */
export function closeness(err: number, tol: number): number {
  const e = Math.abs(err);
  if (!Number.isFinite(e)) return 0;
  if (e <= tol) return 1 - (0.1 * e) / tol;
  return 0.9 * Math.exp(-(e - tol) / (4 * tol));
}

export function stars(o: Outcome): 0 | 1 | 2 | 3 {
  if (!o.ok) return 0;
  if (o.accuracy >= 0.9 && o.economy >= 0.9) return 3;
  if (o.accuracy >= 0.6 && o.economy >= 0.6) return 2;
  return 1;
}

/** Tempo de referência por nível (s): acima dele a pontuação cai até 70%. */
export const PAR_TIME: Record<Level, number> = { 1: 180, 2: 360, 3: 600 };

/**
 * Pontos de uma tentativa: precisão (70%) e economia (30%), multiplicados pelo nível;
 * cada tentativa extra tira 5% (até metade) e passar do tempo de referência tira até 30%.
 */
export function points(level: Level, o: Outcome, attempts: number, seconds: number): number {
  if (!o.ok) return 0;
  const base = 700 * clamp(o.accuracy, 0, 1) + 300 * clamp(o.economy, 0, 1);
  const mult = level === 1 ? 1 : level === 2 ? 1.5 : 2;
  const fa = Math.max(0.5, 1 - 0.05 * Math.max(0, attempts - 1));
  const par = PAR_TIME[level];
  const ft = seconds <= par ? 1 : Math.max(0.7, 1 - (0.3 * (seconds - par)) / (4 * par));
  return Math.round(base * mult * fa * ft);
}

function simOf(id: string): AnySimulation {
  const s = challengeSim(id);
  if (!s) throw new Error(`simulação ${id} não encontrada`);
  return s;
}

/** Parâmetros efetivos: padrão ← cenário ← base do desafio ← knobs do aluno (limitados à faixa do controle). */
export function paramsFor(ch: Challenge, values: Record<string, number> = {}): Params {
  const sim = simOf(ch.sim);
  const sc = sim.scenarios.find((s) => s.id === ch.scenario);
  const p = withOverrides(sim, { ...sc?.params, ...ch.base });
  for (const k of ch.knobs) {
    const v = values[k];
    const spec = sim.params.find((x) => x.key === k);
    if (spec && typeof v === "number" && Number.isFinite(v)) p[k] = clamp(v, spec.min, spec.max);
  }
  return p;
}

/** Parâmetros que o aluno não pode mexer na tela. */
export function lockedKeys(ch: Challenge): string[] {
  const free = new Set([...ch.knobs, ...(ch.explore ?? [])]);
  return simOf(ch.sim).params.map((p) => p.key).filter((k) => !free.has(k));
}

export function evaluateChallenge(ch: Challenge, attempt: Attempt): Outcome {
  const p = paramsFor(ch, attempt.params);
  if (ch.build && attempt.build === undefined)
    return { ok: false, accuracy: 0, economy: 0, metrics: [], message: `Monte no palco antes de avaliar: ${ch.build.what}` };
  try {
    return ch.evaluate(p, attempt.build);
  } catch {
    return { ok: false, accuracy: 0, economy: 0, metrics: [], message: "Não foi possível avaliar esta montagem." };
  }
}

/** Roda a simulação a partir de `params` (e de um estado montado) até `stop` ou `tMax`. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function run<S = any>(simId: string, params: Params, opts: { tMax: number; state?: (s: S, p: Params) => S; stop?: (r: Runner<S>) => boolean; each?: (r: Runner<S>) => void }): Runner<S> {
  const r = new Runner<S>(simOf(simId) as never, params);
  if (opts.state) r.state = opts.state(r.state, r.params);
  for (let n = 0; n < 5_000_000 && !r.finished && r.t < opts.tMax - 1e-12; n++) {
    r.stepOnce();
    opts.each?.(r);
    if (opts.stop?.(r)) break;
  }
  return r;
}

const fail = (message: string, metrics: Metric[] = []): Outcome => ({ ok: false, accuracy: 0, economy: 0, metrics, message });
const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

// ------------------------------------------------------------------ projétil

/** Alcance e altura ao cruzar x = xw (NaN se não chegar lá). */
function shot(p: Params, xw = NaN): { x: number; yAt: number } {
  let yAt = NaN;
  let px = 0;
  let py = p.h0 ?? 0;
  const r = run("projetil-arrasto", p, {
    tMax: 60,
    each: (r) => {
      const x = r.value("x");
      const y = r.value("y");
      if (Number.isNaN(yAt) && px < xw && x >= xw) yAt = py + ((y - py) * (xw - px)) / (x - px || 1);
      px = x;
      py = y;
    },
  });
  return { x: r.value("x"), yAt };
}

const WALL = { x: 18, h: 7, r: 0.11 };
const WALL_TARGET = 40;

function clearsWall(p: Params) {
  const s = shot(p, WALL.x);
  return { ...s, clears: s.yAt >= WALL.h + WALL.r };
}

/**
 * Resultado de `wallMinSpeed` para a base do desafio (conferido nos testes). Fica fixo porque a varredura
 * leva alguns segundos, acima do tempo de CPU de uma Edge Function.
 */
export const WALL_VMIN = 25;

let wallVmin: number | undefined;
/** Menor v0 (na grade de 0,5 m/s do controle) que passa a barreira e alcança o alvo, varrendo o ângulo. */
export function wallMinSpeed(base: Params): number {
  if (wallVmin !== undefined) return wallVmin;
  let best = Infinity;
  for (let ang = 20; ang <= 80; ang += 1) {
    let lo = 1;
    let hi = 200; // índices da grade de 0,5 m/s
    const ok = (k: number) => {
      const s = clearsWall({ ...base, v0: k / 2, angulo: ang });
      return s.clears && s.x >= WALL_TARGET - 0.5;
    };
    if (!ok(hi)) continue;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (ok(m)) hi = m;
      else lo = m;
    }
    best = Math.min(best, hi / 2);
  }
  wallVmin = best;
  return best;
}

// ------------------------------------------------------------------ hóquei elétrico

type Cargas = Carga[];

function captureCargas(state: unknown): Cargas | undefined {
  const s = state as Partial<JF> | undefined;
  if (!Array.isArray(s?.cargas)) return undefined;
  const cs = s.cargas.filter((c) => finite(c?.x) && finite(c?.y) && finite(c?.q) && c.y >= 0).map((c) => ({ x: c.x, y: c.y, q: c.q }));
  return cs.length ? cs : undefined;
}

function hockey(p: Params, cargas: Cargas | undefined, ideal: number): Outcome {
  if (!cargas?.length) return fail("Ponha pelo menos uma carga no campo (arraste da caixa abaixo do campo).");
  if (cargas.length > 8) return fail("Use no máximo 8 cargas.");
  const qmax = 100;
  const cs = cargas.map((c) => ({ x: clamp(c.x, 0, 1.6), y: clamp(c.y, 0, 1), q: clamp(c.q, -qmax, qmax) }));
  const r = run<JF>("jogos-fisica", p, {
    tMax: 40,
    state: (s) => ({ ...s, cargas: cs, lancado: true, status: 0, tj: 0, rastro: [] }),
    stop: (r) => r.state.status !== 0,
  });
  const n = cs.length;
  const metrics: Metric[] = [
    { label: "Cargas usadas", value: n, digits: 1 },
    { label: "Tempo até o gol", value: r.state.tj, unit: "s" },
  ];
  if (r.state.status !== 1) return fail(r.state.msg || "O disco não chegou ao gol.", metrics);
  return { ok: true, accuracy: 1, economy: Math.min(1, (ideal / n) ** 0.7), metrics, message: `Gol com ${n} carga(s) em ${fmt(r.state.tj, 3)} s.` };
}

// ------------------------------------------------------------------ montanha-russa

/** Arco do trecho do loop (nós 5 a 11 da pista com loop). */
function loopArc(pts: Coaster["pts"]): [number, number] {
  const tr = trackOf(pts);
  const node = (i: number) => tr.s[Math.round((i * (tr.s.length - 1)) / (pts.length - 1))]!;
  return [node(5), node(11)];
}

function rideLoop(p: Params): { passed: boolean; minN: number } {
  let minN = Infinity;
  let passed = false;
  let arc: [number, number] | null = null;
  run<Coaster>("montanha-russa", p, {
    tMax: 10,
    each: (r) => {
      arc ??= loopArc(r.state.pts);
      const s = r.state.s;
      if (s >= arc[0] && s <= arc[1]) minN = Math.min(minN, r.value("N"));
      if (s > arc[1]) passed = true;
    },
    stop: (r) => passed || r.state.v < 0,
  });
  return { passed, minN };
}

const loopOk = (p: Params) => {
  const r = rideLoop(p);
  return r.passed && r.minN >= 0;
};

let loopHmin: number | undefined;
export function loopMinHeight(p: Params): number {
  if (loopHmin !== undefined) return loopHmin;
  let lo = 5; // índices da grade de 0,1 m
  let hi = 80;
  if (!loopOk({ ...p, h0: hi / 10 })) return (loopHmin = Infinity);
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (loopOk({ ...p, h0: m / 10 })) hi = m;
    else lo = m;
  }
  return (loopHmin = hi / 10);
}

// ------------------------------------------------------------------ lentes

interface Optics {
  els: El[];
  ox: number;
  oh: number;
}

function captureOptics(state: unknown): Optics | undefined {
  const s = state as Partial<Bench> | undefined;
  if (!Array.isArray(s?.els) || !finite(s.ox) || !finite(s.oh)) return undefined;
  const els = s.els.filter((e) => e?.kind === "fina" && finite(e.x) && finite(e.P)).map((e) => ({ id: e.id, kind: e.kind, x: e.x, P: e.P }));
  return els.length ? { els, ox: s.ox, oh: s.oh } : undefined;
}

function instrument(p: Params, o: Optics | undefined, inf: boolean, target: number, tol: number, name: string): Outcome {
  if (!o) return fail("Monte as lentes no palco.");
  if (o.els.length > 4) return fail("Use no máximo 4 lentes.");
  if (o.els.some((e) => Math.abs(e.P) > 400)) return fail("Há uma lente com distância focal curta demais (abaixo de 2,5 mm).");
  if (!inf && o.els.some((e) => e.x <= o.ox)) return fail("O objeto precisa ficar antes de todas as lentes.");
  const r = run<Bench>("lentes", p, { tMax: 0, state: (s) => ({ ...s, els: o.els.map((e) => ({ ...e })), ox: o.ox, oh: o.oh, inf, sel: null, drag: null }) });
  const M = r.value("Mang");
  const q = r.value("q");
  const relaxed = q <= -0.25 || Math.abs(q) >= 5;
  const err = Math.abs(Math.abs(M) / target - 1);
  const metrics: Metric[] = [
    { label: "Aumento angular", value: M, unit: "×" },
    { label: "Imagem final (distância à última lente)", value: Math.abs(q) >= 1e5 ? Infinity : q, unit: "m" },
  ];
  if (!relaxed) return fail(`A imagem final fica a ${fmt(q, 3)} m: o olho não a focaliza. Ajuste para que a imagem vá ao infinito (ou fique além de 25 cm, virtual).`, metrics);
  if (err > 0.15) return fail(`O ${name} dá ${fmt(Math.abs(M), 3)}×; a meta é ${target}×.`, metrics);
  return { ok: true, accuracy: closeness(err, tol), economy: 1, metrics, message: `${name[0]!.toUpperCase()}${name.slice(1)} de ${fmt(Math.abs(M), 3)}× com imagem final que o olho focaliza.` };
}

// ------------------------------------------------------------------ foguete

const ROCKET_V = 7800;
let rocketMmin: number | undefined;
/** Menor massa de lançamento (grade dos controles) cujo Δv ideal alcança a meta. */
export function rocketMinMass(p: Params): number {
  if (rocketMmin !== undefined) return rocketMmin;
  let best = Infinity;
  for (const n of [1, 2, 3])
    for (let r = 0.1; r <= 1.0001; r += 0.05) {
      let lo = 2; // M1 = 500·k
      let hi = 200;
      const q = { ...p, n, r: Math.round(r * 100) / 100 };
      const ok = (k: number) => deltaVIdeal({ ...q, M1: 500 * k }) >= ROCKET_V;
      if (!ok(hi)) continue;
      while (hi - lo > 1) {
        const m = (lo + hi) >> 1;
        if (ok(m)) hi = m;
        else lo = m;
      }
      best = Math.min(best, ignitionMasses({ ...q, M1: 500 * hi })[0]!);
    }
  return (rocketMmin = best);
}

// ------------------------------------------------------------------ outros auxiliares

function steadyAmplitude(p: Params): number {
  let A = 0;
  run("ressonancia", p, { tMax: 25, each: (r) => r.t >= 20 && (A = Math.max(A, Math.abs(r.value("x")))) });
  return A;
}

let resonanceRef: number | undefined;
/** Maior amplitude de regime medida na simulação, varrendo ω na grade do controle perto do pico. */
function resonancePeak(p: Params): number {
  if (resonanceRef !== undefined) return resonanceRef;
  const m = p.m ?? 1;
  const k = p.k ?? 25;
  const b = p.b ?? 2;
  const wr = Math.sqrt(Math.max(0.01, k / m - (b * b) / (2 * m * m)));
  let best = 0;
  for (let i = -2; i <= 2; i++) best = Math.max(best, steadyAmplitude({ ...p, w: Math.round(wr / 0.05 + i) * 0.05 }));
  return (resonanceRef = best);
}

function settle(simId: string, p: Params, key: string, other: string, tMax: number): number {
  const r = run(simId, p, { tMax, stop: (r) => Math.abs(r.value(key) - r.value(other)) < 0.002 });
  return r.value(key);
}

/** Cicloide de A = (0, 0) até B = (X, −Y), na forma que o palco guarda uma curva desenhada. */
export function cycloidPoints(X: number, Y: number, n = 400): [number, number][] {
  const th = cycloidTheta(X, Y);
  const R = cycloidR(X, Y);
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = th * (i / n);
    return [R * (t - Math.sin(t)), -R * (1 - Math.cos(t))] as [number, number];
  });
}

// ------------------------------------------------------------------ circuito econômico

/** Peça montada na bancada, como o servidor a recebe (só o que define o circuito). */
interface Part {
  kind: Kind;
  a: [number, number];
  b: [number, number];
  value: number;
  closed?: boolean;
}

const LAMPS = { n: 4, R: 12, Pmin: 1.5 };
/** Valores que os botões da bateria alcançam (série do construtor de circuitos). */
const BATTERY_VALUES = [1.5, 3, 4.5, 6, 9, 12, 24];
const PART_KINDS: Kind[] = ["fio", "resistor", "bateria", "lampada", "chave", "amperimetro", "voltimetro"];
const GRID = { w: 12, h: 8 };

const isPt = (q: unknown): q is [number, number] => Array.isArray(q) && q.length === 2 && Number.isInteger(q[0]) && Number.isInteger(q[1]);

function captureCircuit(state: unknown): Part[] | undefined {
  const s = state as Partial<CircuitState> | undefined;
  if (!Array.isArray(s?.comps) || !s.comps.length || s.comps.length > 80) return undefined;
  const parts = s.comps.filter((c) => typeof c?.kind === "string" && isPt(c.a) && isPt(c.b) && finite(c.value));
  return parts.length ? parts.map((c) => ({ kind: c.kind, a: [c.a[0], c.a[1]], b: [c.b[0], c.b[1]], value: c.value, ...(c.kind === "chave" ? { closed: !!c.closed } : {}) })) : undefined;
}

/** Monta o circuito como a bancada faria e resolve um passo (correntes e tensões em regime). */
function solveParts(p: Params, parts: Part[]): CircuitState {
  return run<CircuitState>("circuitos-dc", p, {
    tMax: 0,
    state: (s, q) => {
      const comps = parts.map((c, i) => makeComp(i + 1, c.kind, [c.a[0], c.a[1]], [c.b[0], c.b[1]], c.value, c.closed ?? true));
      return solveStep({ ...s, comps, selected: null, drag: null, nextId: comps.length + 1, warning: "" }, q, 1e-3, false);
    },
  }).state;
}

/** Potência que as baterias entregam ao circuito (W). */
const deliveredPower = (s: CircuitState) => s.comps.filter((c) => c.kind === "bateria").reduce((a, c) => a - c.v * c.i, 0);

let circuitBest: number | undefined;

function circuit(p: Params, parts: Part[] | undefined, ref: Part[]): Outcome {
  if (!parts?.length) return fail("Monte o circuito na bancada.");
  if (parts.length > 80) return fail("Use no máximo 80 peças.");
  if (parts.some((c) => !PART_KINDS.includes(c.kind))) return fail("Use só baterias, fios, lâmpadas, resistores, chaves e medidores.");
  if (parts.some((c) => c.a.concat(c.b).some((v) => !Number.isInteger(v)) || c.a[0] < 0 || c.b[0] < 0 || c.a[1] < 0 || c.b[1] < 0 || c.a[0] > GRID.w || c.b[0] > GRID.w || c.a[1] > GRID.h || c.b[1] > GRID.h))
    return fail("Há uma peça fora da bancada.");
  if (parts.some((c) => (c.a[0] === c.b[0]) === (c.a[1] === c.b[1]))) return fail("Cada peça liga dois pontos diferentes da grade, na horizontal ou na vertical.");
  const lamps = parts.filter((c) => c.kind === "lampada");
  if (lamps.length !== LAMPS.n) return fail(`Use exatamente ${LAMPS.n} lâmpadas (há ${lamps.length}).`);
  if (lamps.some((c) => c.value !== LAMPS.R)) return fail(`As lâmpadas são de ${LAMPS.R} Ω: não troque o valor delas.`);
  const bats = parts.filter((c) => c.kind === "bateria");
  if (!bats.length) return fail("Falta a bateria.");
  if (bats.some((c) => !BATTERY_VALUES.includes(c.value))) return fail("Use baterias dos valores da bancada (1,5 V a 24 V).");
  if (parts.some((c) => c.kind === "resistor" && !(c.value >= 0.1 && c.value <= 1e7))) return fail("Há um resistor com valor fora da faixa da bancada.");

  const s = solveParts(p, parts);
  const P = deliveredPower(s);
  const lit = s.comps.filter((c) => c.kind === "lampada").map((c) => Math.abs(c.v * c.i));
  const dim = Math.min(...lit);
  circuitBest ??= deliveredPower(solveParts(p, ref));
  const metrics: Metric[] = [
    { label: "Potência fornecida pelas baterias", value: P, unit: "W" },
    { label: "Lâmpada mais fraca", value: dim, unit: "W" },
  ];
  if (s.warning) return fail(s.warning, metrics);
  if (dim < LAMPS.Pmin) return fail(`A lâmpada mais fraca recebe ${fmt(dim, 3)} W; cada uma precisa de pelo menos ${fmt(LAMPS.Pmin, 2)} W.`, metrics);
  return {
    ok: true,
    accuracy: 1,
    economy: closeness(Math.max(0, P - circuitBest) / circuitBest, 0.03),
    metrics,
    message: `As ${LAMPS.n} lâmpadas acendem com ${fmt(P, 3)} W fornecidos pelas baterias.`,
  };
}

/** Quatro lâmpadas em paralelo numa bateria de 4,5 V (a solução de referência). */
const circuitRef = (V: number): Part[] => {
  const w = (a: [number, number], b: [number, number]): Part => ({ kind: "fio", a, b, value: 0 });
  const parts: Part[] = [{ kind: "bateria", a: [2, 5], b: [2, 3], value: V }, w([2, 5], [2, 6])];
  for (let x = 2; x < 10; x += 2) parts.push(w([x, 6], [x + 2, 6]), w([x, 3], [x + 2, 3]));
  for (let x = 4; x <= 10; x += 2) parts.push({ kind: "lampada", a: [x, 6], b: [x, 3], value: LAMPS.R });
  return parts;
};

// ------------------------------------------------------------------ gota de Millikan

const DROP_HOLD = 20;

function captureDrop(state: unknown): { gota: number } | undefined {
  const s = state as Partial<MKState> | undefined;
  return Number.isInteger(s?.sel) && s!.sel! > 0 ? { gota: s!.sel! } : undefined;
}

function holdDrop(p: Params, b: { gota: number } | undefined): Outcome {
  if (!b || !Number.isInteger(b.gota)) return fail("Clique numa gota na luneta para selecioná-la.");
  const id = b.gota;
  const s0 = run<MKState>("millikan", p, { tMax: 0 }).state;
  const d0 = s0.drops.find((d) => d.id === id);
  if (!d0) return fail("Escolha uma das gotas da borrifada inicial (a avaliação recomeça dela; não borrife de novo).");
  const Tc = p.T ?? 23;
  const vq = fallSpeed(d0.r, Tc);
  const vres = drift(d0.r, d0.n * E_CHARGE, (p.V ?? 0) / GAP, Tc);
  const yc = GAP / 2;
  let out = Math.abs(d0.y - yc) > RETICLE / 2;
  let gone = false;
  if (!out)
    run<MKState>("millikan", p, {
      tMax: DROP_HOLD,
      state: (s) => ({ ...s, sel: id, timer: null }),
      each: (r) => {
        const d = r.state.drops.find((x) => x.id === id);
        if (!d) gone = true;
        else if (Math.abs(d.y - yc) > RETICLE / 2) out = true;
      },
      stop: () => out || gone,
    });
  const metrics: Metric[] = [
    { label: "Tensão nas placas", value: p.V ?? 0, unit: "V", digits: 4 },
    { label: "Velocidade que sobrou", value: vres * 1e6, unit: "µm/s" },
    { label: "Fração da queda livre", value: (100 * Math.abs(vres)) / vq, unit: "%" },
  ];
  if (Math.abs(d0.y - yc) > RETICLE / 2) return fail("Esta gota começa fora das linhas do retículo: escolha uma que comece entre elas.", metrics);
  if (d0.n !== 1) return fail(`Esta gota tem ${d0.n} cargas elementares; procure uma com uma só.`, metrics);
  if (out || gone) return fail(`A gota saiu do retículo antes de ${DROP_HOLD} s: ela ainda ${vres > 0 ? "sobe" : "desce"} a ${fmt(Math.abs(vres) * 1e6, 3)} µm/s.`, metrics);
  return {
    ok: true,
    accuracy: closeness(Math.abs(vres) / vq, 0.01),
    economy: 1,
    metrics,
    message: `A gota de carga e ficou ${DROP_HOLD} s no retículo; equilíbrio em ${fmt(balanceVoltage(d0.r, E_CHARGE), 4)} V.`,
  };
}

// ------------------------------------------------------------------ desafios

const RADIO = { f: 2000, neighbor: 2400 };
const CAL_TARGET = 30;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const challenges: Challenge<any>[] = [
  {
    id: "alvo-com-arrasto",
    title: "Chute no alvo com resistência do ar",
    level: 1,
    sim: "projetil-arrasto",
    scenario: "futebol",
    goal: "Faça a bola de futebol cair exatamente a **42,0 m** do ponto de chute, com a resistência do ar ligada.",
    hint: "Com arrasto, o alcance é menor que $v_0^2 \\sin 2\\theta / g$ e o ângulo de maior alcance fica abaixo de 45°.",
    base: { h0: 0, massa: 0.43, diametro: 0.22, cd: 0.25, rho: 1.225, g: 9.81 },
    knobs: ["v0", "angulo"],
    evaluate(p) {
      const { x } = shot(p);
      const err = x - 42;
      const metrics = [{ label: "Alcance", value: x, unit: "m" }, { label: "Erro", value: err, unit: "m" }];
      if (Math.abs(err) > 3) return fail(`A bola caiu a ${fmt(x, 3)} m: ${err > 0 ? "passou" : "faltou"} ${fmt(Math.abs(err), 2)} m.`, metrics);
      return { ok: true, accuracy: closeness(err, 0.3), economy: 1, metrics, message: `A bola caiu a ${fmt(x, 3)} m do chute.` };
    },
    reference: { params: { v0: 26, angulo: 41 } },
    bad: { params: { v0: 20.5, angulo: 45 } },
  },
  {
    id: "hoquei-uma-carga",
    title: "Hóquei elétrico: gol com uma carga",
    level: 1,
    sim: "jogos-fisica",
    scenario: "hoquei",
    goal: "Leve o disco (+20 nC) ao gol usando **uma única carga** fixa. Arraste a carga da caixa para o campo e avalie (não precisa lançar antes).",
    hint: "Cargas de mesmo sinal se repelem: uma carga positiva atrás do disco o empurra em linha reta para a direita.",
    base: { jogo: 0, nivel: 0, Qdisco: 20, campo: 1, exemplo: 0 },
    knobs: ["qPeca"],
    economyLabel: "Economia de cargas",
    build: { what: "posicione as cargas no campo", capture: captureCargas },
    evaluate: (p, b: Cargas | undefined) => hockey(p, b, 1),
    reference: { params: { qPeca: 50 }, build: [{ x: 0.05, y: 0.5, q: 50 }] },
    bad: { params: { qPeca: 50 }, build: [{ x: 0.25, y: 0.5, q: -50 }] },
  },
  {
    id: "orbita-geoestacionaria",
    title: "Órbita geoestacionária",
    level: 1,
    sim: "sistema-solar",
    scenario: "geo",
    goal: "Escolha o raio da órbita para o satélite ficar **parado sobre a antena**: período igual a um dia sideral (23 h 56 min 4 s), com erro abaixo de 0,04%.",
    hint: "A Terra gira uma vez em relação às estrelas em 86 164 s, não em 86 400 s. Use $T = 2\\pi\\sqrt{r^3/GM}$.",
    base: { modo: 5, rapidez: 1 },
    knobs: ["rsat"],
    evaluate(p) {
      const r = run("sistema-solar", p, { tMax: 0 });
      const T = r.value("Tsat");
      const Tsid = 86164.1 / 3600;
      const err = (T - Tsid) / Tsid;
      const drift = 360 * 24 * (1 / Tsid - 1 / T);
      const metrics = [{ label: "Período", value: T, unit: "h", digits: 6 }, { label: "Deriva sobre a antena", value: drift, unit: "°/dia" }];
      if (Math.abs(err) > 0.01) return fail(`Período de ${fmt(T, 5)} h: o satélite deriva ${fmt(Math.abs(drift), 3)}° por dia.`, metrics);
      return { ok: true, accuracy: closeness(err, 0.0004), economy: 1, metrics, message: `Período de ${fmt(T, 6)} h.` };
    },
    reference: { params: { rsat: 42160 } },
    bad: { params: { rsat: 42240 } },
  },
  {
    id: "sintonia-ressonancia",
    title: "Sintonize a ressonância",
    level: 1,
    sim: "ressonancia",
    scenario: "varredura",
    goal: "Ajuste a frequência da força externa para obter a **maior amplitude de regime** possível neste oscilador bem amortecido ($b = 2$ kg/s).",
    hint: "Com amortecimento, o pico de amplitude fica abaixo de $\\omega_0 = \\sqrt{k/m}$: $\\omega_r = \\sqrt{\\omega_0^2 - b^2/2m^2}$.",
    base: { modo: 0, m: 1, k: 25, b: 2, F0: 1 },
    knobs: ["w"],
    evaluate(p) {
      const A = steadyAmplitude(p);
      const Amax = resonancePeak(p);
      const short = 1 - A / Amax;
      const metrics = [{ label: "Amplitude de regime", value: A, unit: "m" }, { label: "Fração do máximo", value: (100 * A) / Amax, unit: "%" }];
      if (A / Amax < 0.8) return fail(`Amplitude de ${fmt(A, 3)} m: ainda longe do pico.`, metrics);
      return { ok: true, accuracy: closeness(Math.max(0, short), 0.002), economy: 1, metrics, message: `Amplitude de ${fmt(A, 4)} m (${fmt((100 * A) / Amax, 4)}% do máximo).` };
    },
    reference: { params: { w: 4.8 } },
    bad: { params: { w: 5 } },
  },
  {
    id: "calorimetria-30",
    title: "Equilíbrio em 30 °C",
    level: 1,
    sim: "calorimetria",
    scenario: "metal",
    goal: "Um bloco de cobre de 300 g a 100 °C cai no calorímetro (C = 80 J/K). Escolha a massa e a temperatura inicial da água para o equilíbrio ficar em **30,0 °C** (±0,1 °C).",
    hint: "Calor cedido = calor recebido: $m_b c_{Cu}(100 - T) = (m_a c_a + C)(T - T_a)$.",
    base: { modo: 1, Ccal: 80, corpo: 1, mb: 0.3, Tb: 100, k: 10, kamb: 0, ritmo: 200 },
    knobs: ["ma", "Ta"],
    evaluate(p) {
      const T = settle("calorimetria", p, "T", "Tb", 4000);
      const err = T - CAL_TARGET;
      const metrics = [{ label: "Temperatura de equilíbrio", value: T, unit: "°C", digits: 4 }];
      if (Math.abs(err) > 1) return fail(`O equilíbrio ficou em ${fmt(T, 4)} °C.`, metrics);
      return { ok: true, accuracy: closeness(err, 0.1), economy: 1, metrics, message: `Equilíbrio em ${fmt(T, 4)} °C.` };
    },
    reference: { params: { ma: 0.3, Ta: 24 } },
    bad: { params: { ma: 0.2, Ta: 20 } },
  },
  {
    id: "pouso-economico",
    title: "Pouso na Terra com pouco combustível",
    level: 2,
    sim: "jogos-fisica",
    scenario: "terra-auto",
    goal: "O piloto automático pousa o módulo na Terra. Escolha o empuxo máximo do motor e o **combustível embarcado** para pousar com segurança sobrando o mínimo (menos de 5% do que embarcou).",
    hint: "Para frear é preciso $T > mg$: combustível demais deixa o módulo pesado; de menos, ele acaba no meio da descida.",
    base: { jogo: 1, nivel: 0, g: 9.81, piloto: 1, x0: 120, vx0: 0 },
    knobs: ["comb", "Tmax"],
    economyLabel: "Economia de combustível",
    evaluate(p) {
      const r = run<JF>("jogos-fisica", p, { tMax: 400, stop: (r) => r.state.status !== 0 });
      const loaded = p.comb!;
      const left = r.state.L.comb;
      const metrics = [
        { label: "Combustível embarcado", value: loaded, unit: "kg" },
        { label: "Combustível que sobrou", value: left, unit: "kg" },
        { label: "Velocidade no toque", value: Math.abs(r.state.L.vy), unit: "m/s" },
      ];
      if (r.state.status !== 1) return fail(r.state.msg || "O módulo não pousou.", metrics);
      return { ok: true, accuracy: 1 - 0.05 * Math.abs(r.state.L.vy), economy: closeness(left / loaded, 0.05), metrics, message: `Pouso seguro; sobraram ${fmt(left, 3)} kg de ${fmt(loaded, 3)} kg.` };
    },
    reference: { params: { comb: 280, Tmax: 25 } },
    bad: { params: { comb: 800, Tmax: 30 } },
  },
  {
    id: "ponte-quatro-algarismos",
    title: "Ponte de Wheatstone: quatro algarismos",
    level: 2,
    sim: "ponte-wheatstone",
    scenario: "equilibrar",
    goal: "Meça a amostra D (cerca de 47 Ω) com erro abaixo de 0,05%: equilibre a ponte com o galvanômetro no modo fino (corrente abaixo de 1 µA).",
    hint: "Com $R_1 = R_2$, a década só dá dois algarismos. Mude a razão: $R_x = R_3\\,R_2/R_1$.",
    base: { modo: 0, rx: 3, E: 6 },
    knobs: ["R1", "R2", "R3", "sens"],
    evaluate(p) {
      const r = run("ponte-wheatstone", p, { tMax: 0, state: (s: number[]) => s.map((v, i) => (i === 3 ? 1 : v)) });
      const Ig = r.value("Ig");
      const Rx = (p.R3! * p.R2!) / p.R1!;
      const real = 47.83;
      const err = Rx / real - 1;
      const metrics = [
        { label: "Corrente no galvanômetro", value: Ig * 1e6, unit: "µA" },
        { label: "Rx = R₃R₂/R₁", value: Rx, unit: "Ω", digits: 5 },
      ];
      if (Math.abs(Ig) > 1e-6) return fail(`A ponte não está equilibrada: passam ${fmt(Math.abs(Ig) * 1e6, 3)} µA pelo galvanômetro.`, metrics);
      return { ok: true, accuracy: closeness(err, 0.0005), economy: 1, metrics, message: `Ponte equilibrada: Rx = ${fmt(Rx, 5)} Ω.` };
    },
    reference: { params: { R1: 1000, R2: 10, R3: 4783, sens: 1 } },
    bad: { params: { R1: 1000, R2: 1000, R3: 48, sens: 1 } },
  },
  {
    id: "radio-rlc",
    title: "Sintonize a rádio",
    level: 2,
    sim: "rlc-ca",
    scenario: "ressonancia",
    goal: `Com L = 10 mH, escolha C e R para sintonizar a estação de **${RADIO.f} Hz** (erro abaixo de 0,5%) e deixar a vizinha de ${RADIO.neighbor} Hz com no máximo 10% da corrente.`,
    hint: "$f_0 = 1/(2\\pi\\sqrt{LC})$ escolhe a estação; a resistência define a largura do pico: $Q = \\frac{1}{R}\\sqrt{L/C}$.",
    base: { topologia: 0, saida: 0, inicio: 1, Vp: 10, L: 10, Rg: 0, f: RADIO.f },
    knobs: ["C", "R"],
    explore: ["f", "grafico"],
    economyLabel: "Seletividade",
    evaluate(p) {
      const at = (f: number) => run("rlc-ca", { ...p, f }, { tMax: 0 });
      const r = at(RADIO.f);
      const f0 = r.value("f0");
      const I1 = r.value("Ip");
      const I2 = at(RADIO.neighbor).value("Ip");
      const ratio = I2 / I1;
      const err = f0 / RADIO.f - 1;
      const metrics = [
        { label: "Frequência de ressonância", value: f0, unit: "Hz", digits: 5 },
        { label: "Corrente na vizinha / na estação", value: 100 * ratio, unit: "%" },
      ];
      if (Math.abs(err) > 0.05) return fail(`O circuito ressoa em ${fmt(f0, 4)} Hz, longe da estação.`, metrics);
      if (ratio > 0.5) return fail(`Sintonizado, mas a vizinha passa com ${fmt(100 * ratio, 3)}% da corrente: o pico está largo demais.`, metrics);
      return { ok: true, accuracy: closeness(err, 0.005), economy: closeness(ratio, 0.1), metrics, message: `Ressonância em ${fmt(f0, 5)} Hz; vizinha com ${fmt(100 * ratio, 3)}%.` };
    },
    reference: { params: { C: 0.633, R: 3 } },
    bad: { params: { C: 1, R: 20 } },
  },
  {
    id: "loop-sem-cair",
    title: "Loop sem cair",
    level: 2,
    sim: "montanha-russa",
    scenario: "loop",
    goal: "Solte o carrinho da **menor altura** que ainda o faça completar o loop com a pista sempre empurrando ($N \\ge 0$), com um pouco de atrito ($\\mu = 0{,}02$).",
    hint: "Sem atrito, no alto do loop $v^2 \\ge gR$ exige $h_0 \\ge h_{fundo} + 2{,}5R$. O atrito pede um pouco mais.",
    base: { pista: 1, v0: 0, mu: 0.02, m: 60, g: 9.81 },
    knobs: ["h0"],
    economyLabel: "Altura mínima",
    evaluate(p) {
      const r = rideLoop(p);
      const hmin = loopMinHeight(p);
      const metrics = [
        { label: "Altura de partida", value: p.h0!, unit: "m" },
        { label: "Menor normal no loop", value: Number.isFinite(r.minN) ? r.minN : 0, unit: "N" },
      ];
      if (!r.passed) return fail("O carrinho não completou o loop.", metrics);
      if (r.minN < 0) return fail(`No alto do loop a normal ficou negativa (${fmt(r.minN, 3)} N): o carrinho cairia.`, metrics);
      return { ok: true, accuracy: 1, economy: closeness((p.h0! - hmin) / hmin, 0.03), metrics, message: `Completou o loop saindo de ${fmt(p.h0!, 3)} m.` };
    },
    reference: { params: { h0: 5.1 } },
    bad: { params: { h0: 7.5 } },
  },
  {
    id: "circuito-economico",
    title: "Quatro lâmpadas, pouca potência",
    level: 2,
    sim: "circuitos-dc",
    scenario: "livre",
    goal: `Monte um circuito que acenda as **${LAMPS.n} lâmpadas** de ${LAMPS.R} Ω com pelo menos **${fmt(LAMPS.Pmin, 2)} W cada** gastando a **menor potência** possível das baterias.`,
    hint: "A lâmpada precisa de $V \\ge \\sqrt{P R}$. Em paralelo todas recebem a tensão da bateria; em série dividem. Escolha a ligação e a menor bateria que dê conta (selecione a bateria e use Valor −).",
    base: { montagem: 0, rInterna: 0.1 },
    knobs: [],
    economyLabel: "Economia de energia",
    build: { what: "monte o circuito na bancada", capture: captureCircuit },
    evaluate: (p, b: Part[] | undefined) => circuit(p, b, circuitRef(4.5)),
    reference: { params: {}, build: circuitRef(4.5) },
    bad: {
      params: {},
      build: [
        { kind: "bateria", a: [2, 5], b: [2, 3], value: 24 },
        { kind: "fio", a: [2, 5], b: [2, 6], value: 0 },
        ...[2, 4, 6, 8].map((x) => ({ kind: "lampada" as Kind, a: [x, 6] as [number, number], b: [x + 2, 6] as [number, number], value: LAMPS.R })),
        { kind: "fio", a: [10, 6], b: [10, 3], value: 0 },
        { kind: "fio", a: [10, 3], b: [2, 3], value: 0 },
      ],
    },
  },
  {
    id: "millikan-gota-parada",
    title: "Segure uma gota de carga e",
    level: 2,
    sim: "millikan",
    scenario: "equilibrio",
    goal: `Clique na luneta numa gota que tenha **uma única carga elementar** e que esteja entre as linhas do retículo, e ajuste a tensão para ela ficar **${DROP_HOLD} s parada** ali (velocidade abaixo de 1% da queda livre).`,
    hint: "No equilíbrio $qV/d = m'g$. Para a mesma gota, a tensão de equilíbrio cai pela metade se a carga dobra: compare $V_{eq}$ com o raio (a velocidade de queda) de cada gota.",
    base: { metodo: 1, campo: 1, semente: 7, T: 23, cunningham: 1, luneta: 1 },
    knobs: ["V"],
    explore: ["luneta"],
    build: { what: "selecione a gota", capture: captureDrop },
    evaluate: holdDrop,
    reference: { params: { V: 315 }, build: { gota: 6 } },
    bad: { params: { V: 330 }, build: { gota: 6 } },
  },
  {
    id: "telescopio-20x",
    title: "Monte um telescópio de 20×",
    level: 2,
    sim: "lentes",
    scenario: "telescopio",
    goal: "Monte um telescópio kepleriano com **aumento angular de 20×** (±3%) e imagem final que o olho veja relaxado. Selecione uma lente e use os botões de f mais curta/longa; arraste as lentes pelo eixo.",
    hint: "$M = -f_{ob}/f_{oc}$ e, para a imagem ir ao infinito, a distância entre as lentes é $f_{ob} + f_{oc}$.",
    base: { montagem: 4, alfa: 1 },
    knobs: [],
    explore: ["alfa"],
    build: { what: "arranje as lentes", capture: captureOptics },
    evaluate: (p, b: Optics | undefined) => instrument(p, b, true, 20, 0.03, "telescópio"),
    reference: {
      params: {},
      build: { els: [{ id: 1, kind: "fina", x: 0, P: 2 }, { id: 2, kind: "fina", x: 0.5 + 1 / 39.0625, P: 39.0625 }], ox: -0.1, oh: 0.01 },
    },
    bad: { params: {}, build: { els: [{ id: 1, kind: "fina", x: 0, P: 2 }, { id: 2, kind: "fina", x: 0.55, P: 20 }], ox: -0.1, oh: 0.01 } },
  },
  {
    id: "barreira-com-arrasto",
    title: "Por cima da barreira",
    level: 3,
    sim: "projetil-arrasto",
    scenario: "futebol",
    goal: `Há uma barreira de ${WALL.h} m de altura a ${WALL.x} m. Faça a bola passar por cima e cair a **${WALL_TARGET} m** (±0,5 m) com a **menor velocidade** de chute possível.`,
    hint: "Varra o ângulo: para cada um existe uma velocidade mínima. Ângulos altos passam a barreira, mas o arrasto cobra caro no tempo de voo.",
    base: { h0: 0, massa: 0.43, diametro: 0.22, cd: 0.25, rho: 1.225, g: 9.81 },
    knobs: ["v0", "angulo"],
    economyLabel: "Economia de velocidade",
    evaluate(p) {
      const s = clearsWall(p);
      const vmin = WALL_VMIN;
      const err = s.x - WALL_TARGET;
      const metrics = [
        { label: `Altura em x = ${WALL.x} m`, value: s.yAt, unit: "m" },
        { label: "Alcance", value: s.x, unit: "m" },
        { label: "Velocidade de chute", value: p.v0!, unit: "m/s" },
      ];
      if (!s.clears) return fail(Number.isNaN(s.yAt) ? "A bola nem chegou à barreira." : `A bola bateu na barreira (passou a ${fmt(s.yAt, 3)} m de altura).`, metrics);
      if (Math.abs(err) > 3) return fail(`Passou a barreira, mas caiu a ${fmt(s.x, 3)} m.`, metrics);
      return { ok: true, accuracy: closeness(err, 0.5), economy: closeness((p.v0! - vmin) / vmin, 0.02), metrics, message: `Passou a barreira e caiu a ${fmt(s.x, 3)} m com v₀ = ${fmt(p.v0!, 3)} m/s.` };
    },
    reference: { params: { v0: 25, angulo: 41.5 } },
    bad: { params: { v0: 40, angulo: 60 } },
  },
  {
    id: "hoquei-parede",
    title: "Hóquei elétrico: contorne a parede",
    level: 3,
    sim: "jogos-fisica",
    scenario: "hoquei",
    goal: "Na fase 2 há uma parede entre o disco e o gol, aberta só embaixo. Faça o gol usando **no máximo duas cargas**.",
    hint: "Cargas negativas atraem o disco positivo: uma perto da abertura da parede puxa o disco para baixo dela.",
    base: { jogo: 0, nivel: 1, Qdisco: 20, campo: 1, exemplo: 0 },
    knobs: ["qPeca"],
    economyLabel: "Economia de cargas",
    build: { what: "posicione as cargas no campo", capture: captureCargas },
    evaluate: (p, b: Cargas | undefined) => hockey(p, b, 2),
    reference: { params: { qPeca: 50 }, build: [{ x: 0.917, y: 0.047, q: -50 }, { x: 0.881, y: 0.253, q: -50 }] },
    bad: { params: { qPeca: 50 }, build: [{ x: 0.05, y: 0.5, q: 50 }] },
  },
  {
    id: "braquistocrona",
    title: "Desenhe a curva mais rápida",
    level: 3,
    sim: "braquistocrona",
    scenario: "corrida",
    goal: "Desenhe com o mouse (ou o dedo) um arame de A até B em que a conta chegue **no máximo 1% mais devagar que a cicloide**, a curva mais rápida.",
    hint: "A curva ideal desce íngreme no começo para ganhar velocidade cedo, e pode até passar abaixo de B antes de subir até ele.",
    base: { modo: 0, X: 3, Y: 1.5, mu: 0, g: 9.8 },
    knobs: [],
    build: {
      what: "desenhe sua curva de A até B",
      capture(state: unknown) {
        const s = state as Partial<BQ> | undefined;
        const d = s?.drawn;
        if (!Array.isArray(d) || d.length < 3 || d.length > 5000) return undefined;
        return d.every((q) => Array.isArray(q) && finite(q[0]) && finite(q[1])) ? d.map((q) => [q[0], q[1]] as [number, number]) : undefined;
      },
    },
    evaluate(p, drawn: [number, number][] | undefined) {
      if (!drawn || drawn.length < 3) return fail("Desenhe sua curva de A até B.");
      const B: [number, number] = [p.X!, -p.Y!];
      const a = drawn[0]!;
      const z = drawn[drawn.length - 1]!;
      if (Math.hypot(a[0], a[1]) > 0.06 || Math.hypot(z[0] - B[0], z[1] - B[1]) > 0.06) return fail("A curva precisa ligar A ao ponto B original (não mova B).");
      const gid = 1e6 + drawn.length + Math.round(Math.abs(drawn.reduce((acc, q, i) => acc + (i + 1) * (q[0] * 7.1 + q[1] * 3.3), 0)) * 1000) % 1e6;
      const r = run<BQ>("braquistocrona", p, {
        tMax: 30,
        state: (s, q) => {
          const st: BQ = { ...s, drawn, gid, tt: 0 };
          return { ...st, beads: curvesOf(st, q).map((c, i) => ({ c: i, s: 0, v: 0, goal: c.total, arr: -1, stuck: false })) };
        },
      });
      const bead = r.state.beads[4];
      const tc = r.value("t1");
      const tl = r.value("t0");
      const t = bead && bead.arr >= 0 ? bead.arr : Infinity;
      const metrics = [
        { label: "Tempo na sua curva", value: t, unit: "s", digits: 4 },
        { label: "Tempo na cicloide", value: tc, unit: "s", digits: 4 },
        { label: "Tempo na reta", value: tl, unit: "s", digits: 4 },
      ];
      if (!Number.isFinite(t)) return fail("A conta não chegou a B pela sua curva (ela sobe acima de A ou para no caminho).", metrics);
      if (t >= tl * 0.999) return fail("Sua curva não é mais rápida que a reta.", metrics);
      return { ok: true, accuracy: closeness(t / tc - 1, 0.01), economy: 1, metrics, message: `Sua curva: ${fmt(t, 4)} s; cicloide: ${fmt(tc, 4)} s.` };
    },
    reference: { params: {}, build: cycloidPoints(3, 1.5) },
    bad: { params: {}, build: Array.from({ length: 401 }, (_, i) => [(3 * i) / 400, (-1.5 * i) / 400]) },
  },
  {
    id: "microscopio-250x",
    title: "Monte um microscópio de 250×",
    level: 3,
    sim: "lentes",
    scenario: "microscopio",
    goal: "Ajuste o microscópio composto para **250×** (±2%) com imagem final no infinito ou além de 25 cm. Você pode trocar as focais, mover as lentes e o objeto.",
    hint: "$M \\approx -\\frac{L}{f_{ob}}\\cdot\\frac{25\\,\\text{cm}}{f_{oc}}$: aumente o tubo ou encurte a ocular, e reposicione o objeto para focalizar.",
    base: { montagem: 3 },
    knobs: [],
    build: { what: "arranje as lentes e o objeto", capture: captureOptics },
    evaluate: (p, b: Optics | undefined) => instrument(p, b, false, 250, 0.02, "microscópio"),
    reference: {
      params: {},
      build: { els: [{ id: 1, kind: "fina", x: 0, P: 100 }, { id: 2, kind: "fina", x: 0.23, P: 50 }], ox: -1 / (100 - 1 / 0.21), oh: 0.0015 },
    },
    bad: {
      params: {},
      build: { els: [{ id: 1, kind: "fina", x: 0, P: 100 }, { id: 2, kind: "fina", x: 0.195, P: 40 }], ox: -1 / (100 - 1 / 0.17), oh: 0.0015 },
    },
  },
  {
    id: "foguete-orbital",
    title: "Foguete orbital mais leve",
    level: 3,
    sim: "foguete",
    scenario: "espaco",
    goal: `Leve 500 kg de carga útil a **${fmt(ROCKET_V, 4)} m/s** (no espaço, sem gravidade nem ar) com a **menor massa de lançamento** possível. Escolha o número de estágios, a massa do 1º e a razão entre estágios.`,
    hint: "Com 10% de estrutura e $v_e = 3000$ m/s, um estágio só nunca passa de $v_e \\ln 10 \\approx 6{,}9$ km/s. Estágios descartam peso morto.",
    base: { grav: 0, arrasto: 0, eps: 0.1, ve: 3000, tb: 60, mpl: 500 },
    knobs: ["n", "M1", "r"],
    economyLabel: "Economia de massa",
    evaluate(p) {
      const r = run("foguete", p, { tMax: 400 });
      const v = r.value("v");
      const M0 = ignitionMasses(p)[0]!;
      const Mmin = rocketMinMass(p);
      const metrics = [
        { label: "Velocidade final", value: v, unit: "m/s" },
        { label: "Massa de lançamento", value: M0, unit: "kg" },
      ];
      if (v < ROCKET_V) return fail(`O foguete chegou a ${fmt(v, 4)} m/s; faltaram ${fmt(ROCKET_V - v, 3)} m/s.`, metrics);
      return { ok: true, accuracy: 1, economy: closeness((M0 - Mmin) / Mmin, 0.05), metrics, message: `Chegou a ${fmt(v, 4)} m/s com ${fmt(M0 / 1000, 3)} t na plataforma.` };
    },
    reference: { params: { n: 3, M1: 6500, r: 0.45 } },
    bad: { params: { n: 3, M1: 100000, r: 0.5 } },
  },
];

export const findChallenge = (id: string) => challenges.find((c) => c.id === id);
