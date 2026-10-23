// Desenho, parâmetros, cenários e exercícios dos temas 4 a 7 da sim nuclear
// (espectro beta, modelo de camadas, reator de Oklo e critério de Lawson).

import { clamp, num, texNum, type Draw, type ExerciseTemplate, type ParamSpec, type Params, type Scenario } from "@fisilab/core";
import { fmt, panel } from "./panel.ts";
import { nextRandom, semfB, stableZ } from "./physics.ts";
import {
  ALPHA_REF,
  BETA_EMITTERS,
  ENR_TODAY,
  FIRST_2PLUS,
  MAGIC,
  TOKAMAKS,
  alphaK,
  alphaQ,
  betaShape,
  betaStats,
  closedShells,
  criticalAgo,
  criticalEnrichment,
  enrichmentAgo,
  kInfAgo,
  levelName,
  ntBreakeven,
  ntIgnition,
  plasmaBalance,
  sampleBeta,
  shellLevels,
  uraniumAmounts,
  uraniumRatio,
  type ShellLevel,
} from "./topicos.ts";

export const TEMA_BETA = 4;
export const TEMA_CAMADAS = 5;
export const TEMA_OKLO = 6;
export const TEMA_LAWSON = 7;

/** Número de canais do histograma de energia dos elétrons beta. */
export const BETA_BINS = 40;
/** Decaimentos beta sorteados por passo de animação. */
export const BETA_PER_STEP = 40;

export interface BetaHist {
  bins: number[];
  count: number;
  sum: number;
  /** Último decaimento: energia do elétron (keV). */
  last: number;
  seed: number;
}

export const emitterOf = (p: Params) => BETA_EMITTERS[clamp(Math.round(num(p, "emissor")), 0, BETA_EMITTERS.length - 1)]!;
export const spinOrbit = (p: Params) => clamp(num(p, "so", 1), 0, 2);
export const shellA = (p: Params) => clamp(Math.round(num(p, "A", 56)), 16, 250);
export const agoGyr = (p: Params) => clamp(num(p, "tAtras", 2), 0, 4.5);
export const plasmaOf = (p: Params) => plasmaBalance(num(p, "n", 1e20), num(p, "kT", 10), num(p, "tau", 1));

export const emptyBeta = (seed = 4242): BetaHist => ({ bins: new Array<number>(BETA_BINS).fill(0), count: 0, sum: 0, last: 0, seed });

const statsCache = new Map<string, ReturnType<typeof betaStats>>();
export const statsOf = (p: Params) => {
  const b = emitterOf(p);
  let s = statsCache.get(b.name);
  if (!s) statsCache.set(b.name, (s = betaStats(b)));
  return s;
};

/** Sorteia `k` decaimentos beta e acumula no histograma. */
export function stepBeta(h: BetaHist, p: Params, k = BETA_PER_STEP): BetaHist {
  const b = emitterOf(p);
  const st = statsOf(p);
  const r = { seed: h.seed };
  const bins = h.bins.slice();
  let sum = h.sum;
  let last = h.last;
  for (let i = 0; i < k; i++) {
    const K = sampleBeta(b, () => nextRandom(r), st);
    bins[Math.min(BETA_BINS - 1, Math.floor((K / st.Q) * BETA_BINS))]!++;
    sum += K;
    last = K;
  }
  return { bins, count: h.count + k, sum, last, seed: r.seed };
}

const sci = (v: number, d = 2) => {
  if (!Number.isFinite(v)) return "∞";
  if (v === 0) return "0";
  const e = Math.floor(Math.log10(Math.abs(v)));
  if (e >= -2 && e < 4) return fmt(v, d + 1);
  return `${fmt(v / 10 ** e, d)} × 10^${e}`;
};

// --------------------------------------------------------------- tema 4: espectro beta
export function drawBeta(d: Draw, h: BetaHist, p: Params) {
  const th = d.theme;
  const b = emitterOf(p);
  const st = statsOf(p);
  const Q = st.Q;
  d.text("Decaimento β⁻: espectro contínuo do elétron", -16.5, 8.7, { size: 15, weight: "700", align: "left" });
  d.text(`${b.reaction}   (T½ = ${b.halfLife})   Q = (M_pai − M_filho)c² = ${fmt(Q, 4)} keV`, -16.5, 7.9, { size: 12, align: "left", color: th.series[1]! });

  const box = { x0: -15.2, y0: -7.4, x1: 4.6, y1: 5.4 };
  const pl = panel(d, box, { min: 0, max: Q * 1.08 }, { min: 0, max: 1.18 });
  pl.frame({ xlabel: "energia cinética do elétron K (keV)", ylabel: "elétrons por intervalo de energia (relativo)", yticks: [0, 0.5, 1] });
  // histograma normalizado à mesma escala da curva teórica (densidade / máximo)
  const w = Q / BETA_BINS;
  if (h.count > 0) {
    const scale = st.norm / (h.count * w * st.max);
    h.bins.forEach((c, i) => {
      const y = c * scale;
      d.rect(pl.X(i * w), pl.Y(0), pl.X((i + 1) * w) - pl.X(i * w), pl.Y(Math.min(y, 1.18)) - pl.Y(0), { fill: th.accent, alpha: 0.45, stroke: th.accent, width: 0.6 });
    });
  }
  pl.plot((K) => betaShape(K, Q, b.Zd) / st.max, 0, Q, { color: th.text, width: 2, n: 300 });
  d.line(pl.X(Q), pl.Y(0), pl.X(Q), pl.Y(1.1), { color: th.positive, width: 1.5, dash: [5, 4] });
  d.text(`ponto final K_máx = Q`, pl.X(Q), pl.Y(1.1), { size: 11, align: "right", dx: -4, color: th.positive, weight: "600" });
  d.line(pl.X(st.mean), pl.Y(0), pl.X(st.mean), pl.Y(1.0), { color: th.series[1]!, width: 1, dash: [2, 3] });
  d.text(`média teórica ≈ ${fmt(st.mean, 3)} keV`, pl.X(st.mean), pl.Y(1.04), { size: 10, align: "left", dx: 4, color: th.series[1]! });
  const meas = h.count > 0 ? h.sum / h.count : 0;
  d.text(`elétrons detectados: ${h.count}   média medida: ${h.count ? fmt(meas, 3) : "—"} keV`, box.x0, 7.1, { size: 11, align: "left", weight: "600" });
  d.text("barras: Monte Carlo   linha: N(K) ∝ F(Z,K)·p·E·(Q − K)²", box.x0, 6.45, { size: 10, align: "left", color: th.muted });

  // último decaimento: divisão de Q entre elétron e antineutrino
  const x0 = 6.6;
  const x1 = 16.4;
  d.text("Último decaimento", x0, 6.4, { size: 13, weight: "700", align: "left" });
  const Ke = h.count ? h.last : 0;
  const fe = Q > 0 ? Ke / Q : 0;
  d.rect(x0, 5.0, (x1 - x0) * fe, 0.8, { fill: th.accent, alpha: 0.85 });
  d.rect(x0 + (x1 - x0) * fe, 5.0, (x1 - x0) * (1 - fe), 0.8, { fill: th.muted, alpha: 0.45 });
  d.text(`elétron: ${fmt(Ke, 3)} keV`, x0, 4.45, { size: 11, align: "left", color: th.accent, weight: "600" });
  d.text(`antineutrino: ${fmt(Q - Ke, 3)} keV`, x1, 4.45, { size: 11, align: "right", color: th.muted, weight: "600" });
  d.text("Q se divide de um jeito diferente a cada decaimento", x0, 3.7, { size: 10, align: "left", color: th.muted });
  d.text("(três corpos; o recuo do núcleo filho é desprezível).", x0, 3.15, { size: 10, align: "left", color: th.muted });

  // comparação: linha única do alfa
  const aQ = alphaQ();
  const aK = alphaK();
  const ab = { x0: 7.4, y0: -7.4, x1: 16.4, y1: 0.6 };
  const pa = panel(d, ab, { min: 0, max: 6 }, { min: 0, max: 1.18 });
  pa.frame({ xlabel: "energia da alfa (MeV)", yticks: [] });
  d.rect(pa.X(aK) - 0.06, pa.Y(0), 0.12, pa.Y(1) - pa.Y(0), { fill: th.series[4]! });
  d.text(`K_α = ${fmt(aK, 4)} MeV`, pa.X(aK), pa.Y(1), { size: 11, align: "right", dx: -6, dy: -2, color: th.series[4]!, weight: "700" });
  d.text(`Comparação: ${ALPHA_REF.reaction}`, ab.x0, ab.y1 + 1.75, { size: 12, weight: "700", align: "left" });
  d.text(`dois corpos: sempre a mesma energia (Q = ${fmt(aQ, 4)} MeV)`, ab.x0, ab.y1 + 1.1, { size: 10, align: "left", color: th.muted });
  d.text("K_α = Q·M_Pb/(M_Pb + M_α)", ab.x0, ab.y1 + 0.5, { size: 10, align: "left", color: th.muted });
}

// --------------------------------------------------------------- tema 5: modelo de camadas
/** Afasta rótulos que ficariam sobrepostos (posições em ordem crescente). */
function spread(ys: number[], gap: number, top: number): number[] {
  const out = ys.slice();
  for (let i = 1; i < out.length; i++) if (out[i]! < out[i - 1]! + gap) out[i] = out[i - 1]! + gap;
  // sem passar do teto: empurra de cima para baixo
  for (let i = out.length - 1; i >= 0; i--) out[i] = Math.min(out[i]!, i === out.length - 1 ? top : out[i + 1]! - gap);
  return out;
}

function levelColumn(d: Draw, lv: ShellLevel[], Y: (E: number) => number, x0: number, x1: number, labelLeft: boolean, closed: number[], color: string) {
  const th = d.theme;
  const ys = spread(lv.map((v) => Y(v.E)), 0.38, Y(0) + 0.3);
  let cum = 0;
  lv.forEach((v, i) => {
    cum += v.deg;
    d.line(x0, Y(v.E), x1, Y(v.E), { color, width: 2 });
    const lx = labelLeft ? x0 - 0.15 : x1 + 0.15;
    d.line(lx, Y(v.E), labelLeft ? lx - 0.25 : lx + 0.25, ys[i]!, { color: th.grid, width: 1 });
    d.text(`${levelName(v)} (${v.deg})`, labelLeft ? lx - 0.3 : lx + 0.3, ys[i]!, { size: 9, align: labelLeft ? "right" : "left", color: th.text });
    const nx = lv[i + 1];
    if (nx && closed.includes(cum)) {
      const ym = (Y(v.E) + Y(nx.E)) / 2;
      const magic = MAGIC.includes(cum);
      d.text(String(cum), (x0 + x1) / 2, ym, { size: 12, weight: "700", color: magic ? th.positive : th.series[4]! });
    }
  });
}

export function drawShell(d: Draw, p: Params) {
  const th = d.theme;
  const A = shellA(p);
  const so = spinOrbit(p);
  const lv0 = shellLevels(A, 0);
  const lv = shellLevels(A, so);
  const c0 = closedShells(lv0);
  const c1 = closedShells(lv);
  d.text("Modelo de camadas: nêutrons num poço com spin–órbita", -16.5, 8.7, { size: 15, weight: "700", align: "left" });
  d.text(`Woods–Saxon, A = ${A} (R = ${fmt(1.27 * A ** (1 / 3), 3)} fm, V₀ = 51 MeV)   spin–órbita: ${fmt(so, 3)} × referência`, -16.5, 7.9, { size: 12, align: "left", color: th.series[1]! });
  const Emin = -50;
  const Y = (E: number) => -8.2 + ((E - Emin) / (0 - Emin)) * 14.6;
  d.line(-16.4, Y(0), -1.2, Y(0), { color: th.muted, width: 1, dash: [3, 3] });
  d.text("E = 0 (núcleon livre)", -16.4, Y(0), { size: 9, align: "left", dy: -8, color: th.muted });
  for (const E of [-40, -30, -20, -10]) d.text(`${E}`, -16.6, Y(E), { size: 9, align: "right", color: th.muted });
  d.text("MeV", -16.6, Y(-45), { size: 9, align: "right", color: th.muted });
  levelColumn(d, lv0, Y, -12.6, -10.6, true, c0, th.muted);
  levelColumn(d, lv, Y, -6.2, -4.2, false, c1, th.accent);
  // ligações: cada nível nl se divide em j = l ± 1/2
  for (const v of lv) {
    const par = lv0.find((u) => u.n === v.n && u.l === v.l);
    if (par) d.line(-10.6, Y(par.E), -6.2, Y(v.E), { color: th.grid, width: 1, dash: [2, 3] });
  }
  d.text("sem spin–órbita", -11.6, -8.9, { size: 11, weight: "600", color: th.muted });
  d.text("com spin–órbita", -5.2, -8.9, { size: 11, weight: "600", color: th.accent });

  // assinatura experimental: 1º estado 2⁺ de núcleos par–par
  const gb = { x0: 2.6, y0: -0.4, x1: 16.3, y1: 5.6 };
  const pg = panel(d, gb, { min: 0, max: 150 }, { min: 0.03, max: 10, log: true });
  pg.frame({ xlabel: "número de nêutrons N", ylabel: "E(2⁺₁) (MeV), escala log", fx: (v) => String(Math.round(v)), fy: (v) => fmt(v, 2) });
  for (const m of MAGIC.slice(1)) {
    d.line(pg.X(m), gb.y0, pg.X(m), gb.y1, { color: th.positive, width: 1, dash: [3, 3] });
    d.text(String(m), pg.X(m), gb.y1, { size: 9, dy: 8, dx: 9, color: th.positive });
  }
  for (const e of FIRST_2PLUS) {
    const magic = MAGIC.includes(e.N) || MAGIC.includes(e.Z);
    d.dot(pg.X(e.N), pg.Y(e.E), magic ? 4 : 3, magic ? th.positive : th.series[1]!);
    if (e.E > 3) d.text(e.name, pg.X(e.N), pg.Y(e.E), { size: 9, align: "left", dx: 5 });
  }
  d.text("1º estado excitado de núcleos par–par: alto nas camadas fechadas", gb.x0, 7.0, { size: 11, align: "left", weight: "600" });

  // ao lado: a gota líquida
  const Z = stableZ(A);
  const x = 2.6;
  d.text("Gota líquida (mesmo A)", x, -2.2, { size: 13, weight: "700", align: "left" });
  d.text(`B/A(${A}, Z = ${Z}) = ${fmt(semfB(A, Z) / A, 4)} MeV: curva suave em A,`, x, -3.0, { size: 11, align: "left" });
  d.text("sem saltos nos números mágicos (não tem níveis individuais).", x, -3.6, { size: 11, align: "left" });
  d.text(`maiores lacunas sem spin–órbita: ${c0.join(", ")}`, x, -4.6, { size: 11, align: "left", color: th.muted });
  d.text(`maiores lacunas com spin–órbita: ${c1.join(", ")}`, x, -5.3, { size: 11, align: "left", color: th.accent, weight: "600" });
  d.text(`números mágicos: ${MAGIC.join(", ")}`, x, -6.0, { size: 11, align: "left", color: th.positive, weight: "600" });
  d.text("Números entre os níveis: núcleons acumulados nas 7 maiores lacunas.", x, -7.0, { size: 10, align: "left", color: th.muted });
  d.text("Na cor dos números mágicos: a lacuna coincide com um deles.", x, -7.6, { size: 10, align: "left", color: th.muted });
}

// --------------------------------------------------------------- tema 6: Oklo
export function drawOklo(d: Draw, p: Params) {
  const th = d.theme;
  const t = agoGyr(p);
  const e = enrichmentAgo(t);
  const eC = criticalEnrichment(2);
  const tC = criticalAgo(2);
  d.text("Reator natural de Oklo (Gabão)", -16.5, 8.7, { size: 15, weight: "700", align: "left" });
  d.text(`T½(²³⁵U) = 0,704 bilhão de anos   T½(²³⁸U) = 4,47 bilhões de anos   hoje: ²³⁵U = 0,72 %`, -16.5, 7.9, { size: 12, align: "left", color: th.series[1]! });

  const eb = { x0: -15.2, y0: -7.4, x1: -1.2, y1: 6.0 };
  const pe = panel(d, eb, { min: 0, max: 4.5 }, { min: 0, max: 25 });
  pe.frame({ xlabel: "tempo atrás (bilhões de anos)", ylabel: "fração de ²³⁵U no urânio natural (%)" });
  d.rect(eb.x0, pe.Y(eC * 100), eb.x1 - eb.x0, eb.y1 - pe.Y(eC * 100), { fill: th.positive, alpha: 0.04 });
  d.line(eb.x0, pe.Y(eC * 100), eb.x1, pe.Y(eC * 100), { color: th.positive, width: 1.2, dash: [5, 4] });
  d.text(`mínimo para k∞ = 1 com água (modelo): ${fmt(eC * 100, 3)} %`, eb.x1 - 0.2, pe.Y(eC * 100), { size: 10, align: "right", dy: -9, color: th.positive });
  d.rect(eb.x0, pe.Y(3), eb.x1 - eb.x0, pe.Y(5) - pe.Y(3), { fill: th.series[1]!, alpha: 0.12 });
  d.text("combustível de reatores de água leve: 3–5 %", eb.x0 + 0.2, pe.Y(5), { size: 9, align: "left", dy: -7, color: th.series[1]! });
  pe.plot((x) => 100 * enrichmentAgo(x), 0, 4.5, { color: th.accent, width: 2.4 });
  d.line(pe.X(t), eb.y0, pe.X(t), pe.Y(100 * e), { color: th.accent, width: 1, dash: [3, 3] });
  d.dot(pe.X(t), pe.Y(100 * e), 6, th.accent);
  d.text(`${fmt(100 * e, 3)} %`, pe.X(t), pe.Y(100 * e), { size: 12, weight: "700", align: "left", dx: 8, dy: 8, color: th.accent });
  d.line(pe.X(tC), eb.y0, pe.X(tC), pe.Y(eC * 100), { color: th.positive, width: 1, dash: [2, 3] });

  // k∞ em função do tempo
  const kb = { x0: 2.6, y0: -7.4, x1: 16.3, y1: -0.6 };
  const pk = panel(d, kb, { min: 0, max: 4.5 }, { min: 0, max: 2.2 });
  pk.frame({ xlabel: "tempo atrás (bilhões de anos)", ylabel: "k∞ do minério" });
  d.line(kb.x0, pk.Y(1), kb.x1, pk.Y(1), { color: th.positive, width: 1.2, dash: [5, 4] });
  pk.plot((x) => kInfAgo(x, 2), 0, 4.5, { color: th.accent, width: 2.2 });
  pk.plot((x) => kInfAgo(x, 0), 0, 4.5, { color: th.muted, width: 1.5, dash: [4, 3] });
  const k = kInfAgo(t, 2);
  d.dot(pk.X(t), pk.Y(Math.min(k, 2.2)), 5, th.accent);
  d.text("com água", kb.x1 - 0.2, pk.Y(Math.min(kInfAgo(4.2, 2), 2.1)), { size: 10, align: "right", dy: -9, color: th.accent });
  d.text("sem moderador", kb.x1 - 0.2, pk.Y(kInfAgo(4.5, 0)), { size: 10, align: "right", dy: 9, color: th.muted });

  // números do instante escolhido
  const am = uraniumAmounts(t);
  const x = 2.6;
  d.text(`Há ${fmt(t, 3)} bilhões de anos`, x, 6.4, { size: 13, weight: "700", align: "left" });
  d.text(`N₂₃₅/N₂₃₈ = 0,00725 · e^((λ₂₃₅ − λ₂₃₈)t) = ${fmt(uraniumRatio(t), 3)}`, x, 5.6, { size: 11, align: "left" });
  d.text(`²³⁵U: ${fmt(am.u235 / (ENR_TODAY / (1 - ENR_TODAY)), 3)} × o de hoje   ²³⁸U: ${fmt(am.u238, 3)} × o de hoje`, x, 4.9, { size: 11, align: "left", color: th.muted });
  d.text(`enriquecimento natural: ${fmt(100 * e, 3)} %`, x, 4.1, { size: 12, align: "left", weight: "600", color: th.accent });
  const crit = k > 1;
  d.text(`k∞ com água ≈ ${fmt(k, 3)} → ${crit ? "crítico (depósito grande)" : "subcrítico"}`, x, 3.3, { size: 12, align: "left", weight: "700", color: crit ? th.positive : th.series[4]! });
  d.text(`Com água, o urânio natural deixou de poder ficar crítico`, x, 2.5, { size: 10, align: "left", color: th.muted });
  d.text(`há ≈ ${fmt(tC, 2)} bilhão de anos (neste modelo). Hoje (0,72 %), só grafite`, x, 1.95, { size: 10, align: "left", color: th.muted });
  d.text("ou água pesada permitem um reator de urânio natural.", x, 1.4, { size: 10, align: "left", color: th.muted });
}

// --------------------------------------------------------------- tema 7: Lawson
export function drawLawson(d: Draw, p: Params) {
  const th = d.theme;
  const n = num(p, "n", 1e20);
  const kT = num(p, "kT", 10);
  const tau = num(p, "tau", 1);
  const b = plasmaOf(p);
  d.text("Fusão controlada: critério de Lawson (D–T)", -16.5, 8.7, { size: 15, weight: "700", align: "left" });
  d.text("ganho exige temperatura, densidade e confinamento ao mesmo tempo: nτ acima da curva", -16.5, 7.9, { size: 12, align: "left", color: th.series[1]! });

  const box = { x0: -15.0, y0: -7.4, x1: 2.4, y1: 5.6 };
  const pl = panel(d, box, { min: 1, max: 100, log: true }, { min: 1e17, max: 1e23, log: true });
  pl.frame({ xlabel: "temperatura kT (keV)", ylabel: "nτ (s/m³)", fx: (v) => fmt(v, 2), fy: (v) => `10^${Math.round(Math.log10(v))}` });
  pl.plot((x) => ntIgnition(x), 1, 100, { color: th.positive, width: 2.4 });
  pl.plot((x) => ntBreakeven(x), 1, 100, { color: th.series[1]!, width: 1.8, dash: [6, 4] });
  d.text("ignição", pl.X(40), pl.Y(ntIgnition(40)), { size: 11, weight: "700", dy: -10, color: th.positive });
  d.text("Q = 1", pl.X(80), pl.Y(ntBreakeven(80)), { size: 11, weight: "700", dy: 11, color: th.series[1]! });
  for (const r of TOKAMAKS) {
    d.dot(pl.X(r.kT), pl.Y(r.nTau), 5, th.series[4]!);
    d.text(r.name, pl.X(r.kT), pl.Y(r.nTau), { size: 10, align: r.kT < 15 ? "left" : "right", dx: r.kT < 15 ? 7 : -7, dy: -9, color: th.series[4]! });
  }
  const yy = clamp(b.nTau, 1e17, 1e23);
  d.dot(pl.X(clamp(kT, 1, 100)), pl.Y(yy), 7, th.accent);
  d.text("seu plasma", pl.X(clamp(kT, 1, 100)), pl.Y(yy), { size: 11, weight: "700", align: "right", dx: -9, color: th.accent });
  d.text("pontos com nome: referências aproximadas (médias do plasma)", box.x0, 7.0, { size: 10, align: "left", color: th.muted });

  const x = 4.4;
  d.text("Balanço de energia por m³", x, 6.4, { size: 13, weight: "700", align: "left" });
  d.text(`n = ${sci(n)} m⁻³   kT = ${fmt(kT, 3)} keV   τ = ${sci(tau)} s`, x, 5.6, { size: 11, align: "left" });
  d.text(`nτ = ${sci(b.nTau)} s/m³   nTτ = ${sci(b.triple)} keV·s/m³`, x, 4.9, { size: 11, align: "left", weight: "600" });
  d.text(`para ignição nesta kT: nτ ≥ ${sci(ntIgnition(kT))} s/m³`, x, 4.2, { size: 11, align: "left", color: th.positive });
  const rows: [string, number, string][] = [
    ["fusão (17,6 MeV)", b.Pfus, th.accent],
    ["alfas (3,5 MeV, ficam)", b.Palpha, th.series[2]!],
    ["perdas 3nkT/τ", b.Ploss, th.series[4]!],
    ["aquecimento externo", b.Pheat, th.muted],
  ];
  const vmax = Math.max(...rows.map((r) => r[1]), 1e-30);
  const lo = vmax / 1e4;
  const bx0 = x + 5.6;
  const bx1 = 16.3;
  rows.forEach(([name, v], i) => {
    const y = 3.0 - i * 1.05;
    const w = v > lo ? ((Math.log10(v) - Math.log10(lo)) / 4) * (bx1 - bx0) : 0;
    d.text(name, x, y, { size: 11, align: "left" });
    d.rect(bx0, y - 0.32, Math.max(w, 0.04), 0.64, { fill: rows[i]![2], alpha: 0.85 });
    d.text(`${sci(v / 1e6)} MW/m³`, bx0 + 0.1, y, { size: 9, align: "left", dy: -12, color: th.muted });
  });
  d.text("(barras em escala logarítmica)", bx1, -1.3, { size: 9, align: "right", color: th.muted });
  const ign = !Number.isFinite(b.Q);
  d.text(ign ? "Ignição: as alfas repõem todas as perdas" : `Ganho Q = P_fusão/P_aquecimento = ${sci(b.Q)}`, x, -2.4, { size: 13, weight: "700", align: "left", color: ign ? th.positive : b.Q >= 1 ? th.accent : th.series[4]! });
  d.text(`tempo de confinamento: τ = W/P_perdas, W = 3nkT = ${sci((3 * n * kT * 1.602176634e-16) / 1e6)} MJ/m³`, x, -3.3, { size: 10, align: "left", color: th.muted });
  d.text("Tokamak: n ~ 10²⁰ m⁻³ e τ ~ 1 s (campo magnético).", x, -4.3, { size: 10, align: "left", color: th.muted });
  d.text("Inercial: n ~ 10³¹ m⁻³ e τ ~ 10⁻¹⁰ s (a pastilha se segura pela inércia).", x, -4.9, { size: 10, align: "left", color: th.muted });
  d.text("Mesma exigência: o produto nτ, não cada um separadamente.", x, -5.5, { size: 10, align: "left", color: th.muted });
}

// --------------------------------------------------------------- parâmetros, cenários e exercícios

export const extraParams: ParamSpec[] = [
  {
    key: "emissor",
    label: "Emissor beta",
    unit: "",
    min: 0,
    max: BETA_EMITTERS.length - 1,
    step: 1,
    default: 0,
    options: BETA_EMITTERS.map((b, i) => ({ value: i, label: `${b.name} (${b.reaction})` })),
  },
  { key: "so", label: "Intensidade do spin–órbita (1 = referência)", unit: "", min: 0, max: 2, step: 0.05, default: 1, live: true },
  { key: "tAtras", label: "Tempo atrás (Oklo)", unit: "bilhões de anos", min: 0, max: 4.5, step: 0.05, default: 2, live: true },
  { key: "n", label: "Densidade do plasma n", unit: "m⁻³", min: 1e17, max: 1e32, step: 1e17, default: 1e20, log: true, live: true },
  { key: "tau", label: "Tempo de confinamento τ", unit: "s", min: 1e-12, max: 100, step: 1e-12, default: 1, log: true, live: true },
];

export function extraLiveEquations(tm: number, h: BetaHist, p: Params): string[] {
  if (tm === TEMA_BETA) {
    const st = statsOf(p);
    return [String.raw`Q = ${texNum(st.Q, 4)}\ \text{keV} = K_e + E_{\bar\nu} \qquad \langle K_e\rangle_\text{medido} = ${texNum(h.count ? h.sum / h.count : 0, 3)}\ \text{keV}`];
  }
  if (tm === TEMA_CAMADAS) return [String.raw`\text{camadas fechadas (7 maiores lacunas): } ${closedShells(shellLevels(shellA(p), spinOrbit(p))).join(",\\ ")}`];
  if (tm === TEMA_OKLO) {
    const t = agoGyr(p);
    return [String.raw`\frac{N_{235}}{N_{238}} = 0{,}00725\, e^{(\lambda_{235}-\lambda_{238})\,${texNum(t, 3)}} = ${texNum(uraniumRatio(t), 3)} \qquad k_\infty = ${texNum(kInfAgo(t, 2), 3)}`];
  }
  const b = plasmaOf(p);
  return [String.raw`n\tau = ${texNum(b.nTau, 3)}\ \text{s/m}^3 \qquad n\tau_\text{ign} = \frac{12\,kT}{\langle\sigma v\rangle E_\alpha} = ${texNum(ntIgnition(num(p, "kT", 10)), 3)}\ \text{s/m}^3`];
}

export const extraScenarios: Scenario[] = [
  {
    id: "espectro-beta",
    label: "Espectro beta e o neutrino",
    params: { tema: TEMA_BETA, emissor: 0 },
    guide: `### Por que o elétron beta não tem energia fixa
1. Rode: cada decaimento do trítio sorteia a energia do elétron. O histograma se aproxima da curva teórica, um **espectro contínuo** de zero até $Q \\approx 18{,}6$ keV.
2. Leia o **ponto final**: nenhum elétron passa de $K_\\text{máx} = Q = (M_\\text{pai} - M_\\text{filho})c^2$, calculado com as massas atômicas.
3. Olhe o último decaimento: o que falta para $Q$ foi levado pelo **antineutrino**, $E_{\\bar\\nu} = Q - K_e$. Sem ele, a energia não se conservaria.
4. Compare com o alfa do polônio-210 (embaixo, à direita): com dois corpos, a conservação do momento fixa uma **linha única**, $K_\\alpha = Q\\,M_\\text{Pb}/(M_\\text{Pb} + M_\\alpha)$.
5. Troque o emissor (carbono-14, fósforo-32) e confira que a média fica perto de um terço de $Q$.`,
    predict: [
      {
        question: "Se o decaimento beta tivesse só dois produtos (núcleo filho e elétron), como seria o espectro de energia dos elétrons?",
        options: ["Contínuo, de 0 a Q", "Uma linha única, com K ≈ Q", "Duas linhas", "Contínuo, mas acima de Q"],
        answer: 1,
        explanation: "Com dois corpos, energia e momento fixam a divisão de $Q$: o elétron sairia sempre com $K \\approx Q$ (o núcleo, pesado, quase não recua). O espectro contínuo medido mostra que há um terceiro corpo: o neutrino.",
      },
    ],
  },
  {
    id: "camadas",
    label: "Modelo de camadas e números mágicos",
    params: { tema: TEMA_CAMADAS, A: 208, so: 1 },
    guide: `### Camadas no núcleo
1. À esquerda, os níveis de um nêutron num poço de Woods–Saxon **sem** spin–órbita: cada nível $nl$ comporta $2(2l+1)$ núcleons. As maiores lacunas caem em 2, 8, 20, 40, 58, 92…: só os três primeiros são mágicos.
2. À direita, **com** spin–órbita: cada $nl$ se divide em $j = l \\pm \\tfrac12$, com $2j + 1$ lugares, e $j = l + \\tfrac12$ desce. O efeito cresce com $l$: o $1f_{7/2}$ se isola (28), o $1g_{9/2}$ desce para a camada de baixo (50), o $1h_{11/2}$ (82) e o $1i_{13/2}$ (126) também.
3. Leve o spin–órbita de 0 a 1 devagar e acompanhe as lacunas se abrindo em **2, 8, 20, 28, 50, 82, 126**.
4. Compare com os dados: a energia do primeiro estado excitado de núcleos par–par dispara nos números mágicos (¹⁶O, ⁴⁰Ca, ⁴⁸Ca, ²⁰⁸Pb).
5. A gota líquida (texto embaixo) dá a tendência suave de $B/A$, mas não tem níveis individuais e não prevê esses saltos: os dois modelos se completam.`,
    predict: [
      {
        question: "Sem a interação spin–órbita, um poço nuclear realista daria camadas fechadas em:",
        options: ["2, 8, 20, 28, 50, 82, 126", "2, 8, 20, 40, 58, 92…", "2, 10, 18, 36, 54, 86", "Nenhum número especial"],
        answer: 1,
        explanation: "Sem spin–órbita, as lacunas de um poço como o de Woods–Saxon caem em 2, 8, 20, 40, 58, 92…. Só o desdobramento $j = l \\pm \\tfrac12$, forte para $l$ grande, reorganiza os níveis nos números mágicos observados. (2, 10, 18, 36… são os gases nobres, camadas eletrônicas.)",
      },
    ],
  },
  {
    id: "oklo",
    label: "Reator natural de Oklo",
    params: { tema: TEMA_OKLO, tAtras: 2 },
    guide: `### Urânio enriquecido pela própria natureza
1. Hoje o urânio natural tem 0,72% de U-235. Como o U-235 ($T_{1/2} = 0{,}704$ bilhão de anos) decai mais depressa que o U-238 (4,47 bilhões), voltando no tempo a razão cresce como $e^{(\\lambda_{235} - \\lambda_{238})t}$.
2. Em $t = 2$ bilhões de anos, leia o enriquecimento: cerca de 3,7%, o do combustível dos reatores de água leve atuais.
3. Leia $k_\\infty$ com **água** como moderador: acima de 1. A água subterrânea que encharcava o minério bastava para uma reação em cadeia.
4. Arraste o tempo até hoje: o enriquecimento cai abaixo do mínimo e $k_\\infty < 1$. Um Oklo moderno é impossível.
5. Compare com a curva sem moderador (urânio metálico puro, nêutrons rápidos): em 2 bilhões de anos ela fica bem abaixo de 1 e só passaria de 1 há mais de 3 bilhões de anos, com cerca de 9% de U-235. Um minério nunca é metal puro: foi a água que tornou Oklo possível.`,
    predict: [
      {
        question: "Há 2 bilhões de anos, a fração de U-235 no urânio natural era cerca de:",
        options: ["0,72%, a mesma de hoje", "0,4%", "3–4%", "90%"],
        answer: 2,
        explanation: "$e^{(0{,}985 - 0{,}155)\\cdot 2} \\approx 5{,}3$: a razão $0{,}0073$ vira $0{,}038$, ou seja, $\\approx 3{,}7\\%$ de U-235.",
      },
    ],
  },
  {
    id: "lawson",
    label: "Critério de Lawson e tokamaks",
    params: { tema: TEMA_LAWSON, kT: 10, n: 1e20, tau: 1 },
    guide: `### Quando a fusão dá lucro
1. O plasma D–T guarda $W = 3nkT$ por m³ e perde essa energia num tempo $\\tau$. As alfas (3,5 MeV de cada 17,6 MeV) ficam no plasma e o aquecem; os nêutrons escapam.
2. **Ignição**: as alfas sozinhas repõem as perdas quando $\\tfrac14 n^2\\langle\\sigma v\\rangle E_\\alpha \\ge 3nkT/\\tau$, isto é, $n\\tau \\ge 12kT/(\\langle\\sigma v\\rangle E_\\alpha)$. A curva verde tem um mínimo perto de 15–30 keV, onde $n\\tau \\approx 1{,}5\\times10^{20}$ s/m³.
3. Com $n = 10^{20}$ m⁻³, $\\tau = 1$ s e $kT = 10$ keV, leia o ganho $Q$. Aumente $\\tau$ até cruzar a curva de ignição.
4. Compare com JET (recorde de 1997) e com a meta de projeto do ITER ($Q = 10$, perto da ignição).
5. Mude para o caso inercial: $n = 10^{31}$ m⁻³ e $\\tau = 10^{-10}$ s. O produto $n\\tau$ é o mesmo tipo de exigência.`,
    predict: [
      {
        question: "Um plasma D–T a 10 keV tem n = 10²⁰ m⁻³. Para chegar à ignição, o tempo de confinamento da energia precisa ser da ordem de:",
        options: ["1 microssegundo", "1 milissegundo", "alguns segundos", "uma hora"],
        answer: 2,
        explanation: "Em 10 keV, $n\\tau_\\text{ign} \\approx 3\\times10^{20}$ s/m³: com $n = 10^{20}$ m⁻³ são cerca de 3 s, a escala que o ITER foi projetado para alcançar.",
      },
    ],
  },
];

export const extraExercises: ExerciseTemplate[] = [
  {
    id: "neutrino",
    prompt: "O trítio (massa atômica 3,01604928 u) decai em hélio-3 (3,01602932 u). Um elétron é detectado com {Ke} keV. Desprezando o recuo do núcleo, qual é a energia do antineutrino, em keV? (1 u = 931 494 keV/c²)",
    vary: { Ke: [0.5, 17, 1] },
    fixed: { tema: TEMA_BETA, emissor: 0 },
    answer: { label: "E_ν", unit: "keV", compute: (p) => (3.01604928 - 3.01602932) * 931494.1 - num(p, "Ke", 5) },
    hint: "Q = (M_pai − M_filho)c² com massas atômicas; Q = K_e + E_ν.",
  },
  {
    id: "camada-j",
    prompt: "No modelo de camadas, o nível com l = {l} se desdobra pelo spin–órbita em j = l ± 1/2. Quantos núcleons de um mesmo tipo cabem no subnível de j = l + 1/2?",
    vary: { l: [1, 7, 0] },
    fixed: { tema: TEMA_CAMADAS },
    answer: { label: "2j + 1", unit: "", compute: (p) => 2 * Math.round(num(p, "l", 1)) + 2 },
    tolerance: 0.001,
    hint: "Cada valor de j comporta 2j + 1 orientações (m_j).",
  },
  {
    id: "oklo",
    prompt: "Hoje o urânio natural tem 0,72% de U-235 (em número de átomos). Qual era essa porcentagem há {tx} bilhões de anos? Use T½ = 0,704 bilhão de anos (U-235) e 4,47 bilhões de anos (U-238).",
    vary: { tx: [0.5, 3, 1] },
    fixed: { tema: TEMA_OKLO },
    answer: {
      label: "U-235",
      unit: "%",
      compute: (p) => {
        const r = (0.0072 / 0.9928) * Math.exp((Math.LN2 / 0.704 - Math.LN2 / 4.47) * num(p, "tx", 2));
        return (100 * r) / (1 + r);
      },
    },
    hint: "Calcule a razão N₂₃₅/N₂₃₈ de hoje, multiplique por e^((λ₂₃₅ − λ₂₃₈)t) e converta para fração do total.",
  },
  {
    id: "lawson",
    prompt: "Um plasma D–T a kT = 15 keV, onde ⟨σv⟩ = 2,74 × 10⁻²² m³/s, tem densidade n = {nx} × 10²⁰ m⁻³. Qual é o tempo de confinamento mínimo, em segundos, para a ignição (as alfas de 3,52 MeV repõem as perdas 3nkT/τ)?",
    vary: { nx: [0.5, 5, 1] },
    fixed: { tema: TEMA_LAWSON, kT: 15 },
    answer: { label: "τ", unit: "s", compute: (p) => (12 * 15) / (num(p, "nx", 1) * 1e20 * 2.74e-22 * 3518) },
    hint: "¼n²⟨σv⟩E_α = 3nkT/τ ⇒ τ = 12kT/(n⟨σv⟩E_α), com kT e E_α na mesma unidade.",
  },
];
