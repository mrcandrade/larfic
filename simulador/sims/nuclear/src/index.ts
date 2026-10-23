import { clamp, defineSim, draw, num, texNum, type Draw, type Params } from "@fisilab/core";
import { fmt, panel } from "./panel.ts";
import {
  CHANNELS,
  EXPERIMENTAL,
  KE2,
  MASS,
  core,
  coulombBarrier,
  fissionJPerKg,
  fissionQ,
  fragmentEnergies,
  fusionQ,
  gamowEnergyKeV,
  gamowPeakKeV,
  initChain,
  kEff,
  measuredK,
  nextRandom,
  population,
  semfB,
  semfTerms,
  stableZ,
  stepChain,
  tunnelP,
  turningPointFm,
  uraniumMassKg,
  type ChainState,
} from "./physics.ts";

import {
  TEMA_BETA,
  TEMA_CAMADAS,
  TEMA_OKLO,
  drawBeta,
  drawLawson,
  drawOklo,
  drawShell,
  emptyBeta,
  extraExercises,
  extraLiveEquations,
  extraParams,
  extraScenarios,
  stepBeta,
  type BetaHist,
} from "./topicos-draw.ts";

export * from "./physics.ts";
export * from "./topicos.ts";
export * from "./topicos-draw.ts";

export interface NucState {
  /** Relógio da animação (s). */
  clock: number;
  chain: ChainState;
  /** Fusão: colisões D–T simuladas e fusões ocorridas. */
  attempts: number;
  fusions: number;
  fusedCycle: number;
  seed: number;
  /** Tema 4: histograma das energias dos elétrons beta. */
  beta: BetaHist;
}

const VIEW = { xMin: -17, xMax: 17, yMin: -9.5, yMax: 9.5 };
const theme = (p: Params) => Math.round(num(p, "tema"));
const radius = (p: Params) => num(p, "R", 12);
export const coreFor = (p: Params) => core(num(p, "enr", 100) / 100, Math.round(num(p, "moderador")), clamp(num(p, "barras"), 0, 1));
const channel = (p: Params) => CHANNELS[clamp(Math.round(num(p, "canal")), 0, CHANNELS.length - 1)]!;
const massNum = (p: Params) => clamp(Math.round(num(p, "A", 56)), 2, 260);
/** Período das tentativas de colisão na animação da fusão (s) e colisões simuladas por segundo. */
const FUSION_CYCLE = 2.4;
const COLLISION_RATE = 2e5;

const hash = (i: number) => {
  const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
};
const sci = (v: number, d = 2) => {
  if (!Number.isFinite(v)) return "∞";
  if (v === 0) return "0";
  const e = Math.floor(Math.log10(Math.abs(v)));
  if (e >= -2 && e < 5) return fmt(v, d + 1);
  return `${fmt(v / 10 ** e, d)} × 10^${e}`;
};
const label = (nuc: string) => {
  const [el, a] = nuc.split("-");
  return `${el}-${a}`;
};

/** Núcleo desenhado como aglomerado de núcleons (prótons e nêutrons). */
function nucleus(d: Draw, x: number, y: number, A: number, Z: number, r: number, seed = 0, alpha = 1) {
  const th = d.theme;
  const nr = r / Math.max(2.2, Math.sqrt(A) * 0.95);
  for (let i = 0; i < A; i++) {
    const rr = r * Math.sqrt(hash(i + seed)) * 0.92;
    const a = 2 * Math.PI * hash(i * 3 + 1 + seed);
    d.circle(x + rr * Math.cos(a), y + rr * Math.sin(a), Math.max(nr, 0.05), {
      fill: i < Z ? th.positive : th.dark ? "#8b95a5" : "#9aa3af",
      stroke: th.dark ? "#10151c" : "#ffffff",
      width: 0.6,
      alpha,
    });
  }
}

// --------------------------------------------------------------- tema 0: energia de ligação
function drawBinding(d: Draw, p: Params) {
  const th = d.theme;
  const A = massNum(p);
  const Z = stableZ(A);
  const box = { x0: -15.2, y0: -7.6, x1: 4.6, y1: 7 };
  const pl = panel(d, box, { min: 0, max: 250 }, { min: 0, max: 9.6 });
  pl.frame({ xlabel: "número de massa A", ylabel: "B/A (MeV)" });
  pl.plot((a) => semfB(Math.round(a), stableZ(Math.round(a))) / Math.round(a), 6, 250, { color: th.accent, width: 2.2, n: 244 });
  pl.plot((a) => Math.max(0, semfB(Math.round(a), stableZ(Math.round(a))) / Math.round(a)), 2, 6, { color: th.accent, width: 1.2, dash: [3, 3], n: 4 });
  for (const e of EXPERIMENTAL) {
    d.dot(pl.X(e.A), pl.Y(e.BA), 3.2, th.series[1]!);
    if (["⁴He", "¹²C", "⁵⁶Fe", "²³⁸U", "²H", "²⁰⁸Pb", "⁶Li"].includes(e.name)) d.text(e.name, pl.X(e.A), pl.Y(e.BA), { size: 10, dy: e.name === "⁵⁶Fe" ? -11 : 11, dx: e.A < 10 ? 10 : 0, color: th.text });
  }
  // máximo
  let aMax = 10;
  let best = 0;
  for (let a = 10; a <= 250; a++) {
    const v = semfB(a, stableZ(a)) / a;
    if (v > best) {
      best = v;
      aMax = a;
    }
  }
  d.line(pl.X(56), pl.Y(0), pl.X(56), pl.Y(8.79), { color: th.series[1]!, width: 1, dash: [3, 3] });
  d.text("ferro: núcleos mais ligados", pl.X(56) + 0.2, pl.Y(9.25), { size: 11, align: "left", color: th.series[1]!, weight: "600" });
  // setas de fusão e fissão
  d.arrow(pl.X(5), pl.Y(3.2), pl.X(30) - pl.X(5), pl.Y(6.6) - pl.Y(3.2), { color: th.series[2]!, width: 2 });
  d.text("fusão", pl.X(18), pl.Y(4.3), { size: 12, color: th.series[2]!, weight: "700", align: "left", dx: 6 });
  d.arrow(pl.X(232), pl.Y(6.6), pl.X(130) - pl.X(232), pl.Y(7.9) - pl.Y(6.6), { color: th.series[4]!, width: 2 });
  d.text("fissão", pl.X(185), pl.Y(6.6), { size: 12, color: th.series[4]!, weight: "700", dy: 12 });
  // A selecionado
  const BA = semfB(A, Z) / A;
  d.dot(pl.X(A), pl.Y(Math.max(0, BA)), 6, th.accent);
  d.text("pontos: experimental   linha: fórmula de Weizsäcker", box.x0, box.y1 + 0.45, { size: 11, align: "left", color: th.muted });
  d.text(`Máximo da fórmula em A ≈ ${aMax}`, box.x1 - 0.2, pl.Y(1.0), { size: 10, align: "right", color: th.muted });

  // termos por núcleon (cascata)
  const t = semfTerms(A, Z);
  const items: [string, number][] = [
    ["volume", t.volume / A],
    ["superfície", t.surface / A],
    ["Coulomb", t.coulomb / A],
    ["assimetria", t.asymmetry / A],
    ["emparelh.", t.pairing / A],
  ];
  const bb = { x0: 7.4, y0: -7.6, x1: 16.4, y1: 4.6 };
  const pb = panel(d, bb, { min: 0, max: 6 }, { min: 0, max: 17 });
  pb.frame({ xticks: [], ylabel: "MeV por núcleon" });
  let acc = 0;
  items.forEach(([name, v], i) => {
    const y0 = acc;
    acc += v;
    const lo = Math.min(y0, acc);
    const hi = Math.max(y0, acc);
    d.rect(pb.X(i + 0.15), pb.Y(lo), pb.X(i + 0.85) - pb.X(i + 0.15), Math.max(pb.Y(hi) - pb.Y(lo), d.px), { fill: v >= 0 ? th.series[2]! : th.positive, alpha: 0.85 });
    d.text(name, pb.X(i + 0.5), bb.y0, { size: 9, dy: 10 });
    d.text(`${v >= 0 ? "+" : ""}${fmt(v, 3)}`, pb.X(i + 0.5), pb.Y(hi), { size: 9, dy: -8 });
  });
  d.rect(pb.X(5.15), pb.Y(0), pb.X(5.85) - pb.X(5.15), pb.Y(Math.max(acc, 0)) - pb.Y(0), { fill: th.accent });
  d.text("B/A", pb.X(5.5), bb.y0, { size: 10, dy: 10, weight: "700" });
  d.text(fmt(acc, 3), pb.X(5.5), pb.Y(Math.max(acc, 0)), { size: 10, dy: -8, weight: "700", color: th.accent });
  const exp = EXPERIMENTAL.find((e) => e.A === A && e.Z === Z);
  d.text(`A = ${A}, Z = ${Z}, N = ${A - Z}`, 7.4, 8.6, { size: 14, weight: "700", align: "left" });
  d.text(`B = ${fmt(t.B, 4)} MeV   B/A = ${fmt(BA, 3)} MeV`, 7.4, 7.8, { size: 12, align: "left" });
  d.text(exp ? `experimental (${exp.name}): ${fmt(exp.BA, 3)} MeV` : "Z: o mais estável para este A (linha β)", 7.4, 7.1, { size: 11, align: "left", color: th.series[1]! });
  d.text("Energia de ligação por núcleon", -16.5, 8.7, { size: 15, weight: "700", align: "left" });
}

// --------------------------------------------------------------- tema 1: fissão
const FISSION_T = 7;
function drawFission(d: Draw, p: Params, clock: number) {
  const th = d.theme;
  const ch = channel(p);
  const Q = fissionQ(ch);
  const Ah = Number(ch.heavy.split("-")[1]);
  const Al = Number(ch.light.split("-")[1]);
  const tt = clock % FISSION_T;
  const k = 0.42;
  const rU = k * 1.2 * 236 ** (1 / 3);
  const rH = k * 1.2 * Ah ** (1 / 3);
  const rL = k * 1.2 * Al ** (1 / 3);
  const cx = -7;
  const cy = 0.5;
  d.text("n + ²³⁵U → ²³⁶U* → fragmentos + nêutrons", -16.5, 8.7, { size: 15, weight: "700", align: "left" });
  d.text(`${label(ch.heavy)} + ${label(ch.light)} + ${ch.nn} n`, -16.5, 7.9, { size: 12, align: "left", color: th.series[1]! });
  if (tt < 1.5) {
    nucleus(d, cx, cy, 235, 92, rU, 0);
    const xn = -16 + ((cx - rU - -16) * tt) / 1.5;
    d.dot(xn, cy, 5, th.dark ? "#c5ccd6" : "#6b7380");
    d.arrowPx(xn + 0.3, cy, 1, 0, 26, { color: th.text, width: 1.5 });
    d.text("nêutron lento", xn, cy + 0.7, { size: 10 });
  } else if (tt < 3.6) {
    // gota líquida excitada: oscila e estica até formar um pescoço
    const s = (tt - 1.5) / 2.1;
    const sep = s * s * (rH + rL) * 0.75;
    const wob = 0.12 * Math.sin(14 * tt) * (1 - s);
    const ctx = d.ctx;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1 + wob + 0.25 * s, 1 - wob - 0.2 * s);
    nucleus(d, -sep * (Al / 236), 0, Ah, ch.Zh, rH + (rU - rH) * (1 - s), 0);
    nucleus(d, sep * (Ah / 236), 0, Al, ch.Zl, rL + (rU - rL) * (1 - s), 400);
    ctx.restore();
    d.text("²³⁶U* oscila e se alonga (gota líquida)", cx, cy - rU - 0.9, { size: 11, color: th.muted });
  } else {
    const s = tt - 3.6;
    // fragmentos repelidos: velocidades inversamente proporcionais às massas
    const vH = 2.2 * (Al / 236);
    const vL = 2.2 * (Ah / 236);
    const dist = (v: number) => v * (s + 0.3 * (1 - Math.exp(-3 * s)));
    const xH = cx - rH * 0.9 - dist(vH) * 2.2;
    const xL = cx + rL * 0.9 + dist(vL) * 2.2;
    nucleus(d, xH, cy, Ah, ch.Zh, rH, 0);
    nucleus(d, xL, cy, Al, ch.Zl, rL, 400);
    const E = fragmentEnergies(ch, Q - ch.nn * 2);
    d.text(`${label(ch.heavy)}  ≈ ${fmt(E.heavy, 3)} MeV`, xH, cy - rH - 0.6, { size: 11, weight: "600" });
    d.text(`${label(ch.light)}  ≈ ${fmt(E.light, 3)} MeV`, xL, cy + rL + 0.6, { size: 11, weight: "600" });
    for (let i = 0; i < ch.nn; i++) {
      const a = 0.9 + (i * 2 * Math.PI) / ch.nn;
      const r = 1 + 3.2 * s;
      if (r < 10) d.dot(cx + r * Math.cos(a), cy + r * Math.sin(a), 4.5, th.dark ? "#c5ccd6" : "#6b7380");
    }
    if (s < 1.2) d.circle(cx, cy, 0.5 + 4 * s, { stroke: th.series[5]!, width: 2, alpha: 1 - s / 1.2 });
  }
  d.ctx.globalAlpha = 1;
  d.text("prótons", -15.6, -7.6, { size: 10, align: "left", color: th.positive });
  d.text("nêutrons", -13.4, -7.6, { size: 10, align: "left", color: th.muted });

  // balanço de energia
  const x = 5.2;
  const mb = MASS["U-235"]! + MASS.n!;
  const ma = MASS[ch.heavy]! + MASS[ch.light]! + ch.nn * MASS.n!;
  d.text("Balanço de massa (u)", x, 6.6, { size: 13, weight: "700", align: "left" });
  d.text(`antes: ²³⁵U + n = ${mb.toFixed(5).replace(".", ",")}`, x, 5.8, { size: 11, align: "left" });
  d.text(`depois: ${label(ch.heavy)} + ${label(ch.light)} + ${ch.nn}n = ${ma.toFixed(5).replace(".", ",")}`, x, 5.15, { size: 11, align: "left" });
  d.text(`Δm = ${(mb - ma).toFixed(5).replace(".", ",")} u   →   Q = Δm c² = ${fmt(Q, 4)} MeV`, x, 4.4, { size: 12, align: "left", weight: "700", color: th.accent });
  const Eb = semfB(Ah, ch.Zh) + semfB(Al, ch.Zl) - semfB(235, 92);
  d.text(`fórmula de Weizsäcker: B(fragmentos) − B(²³⁵U) ≈ ${fmt(Eb, 3)} MeV`, x, 3.6, { size: 11, align: "left", color: th.muted });
  d.text(`(≈ 0,8 MeV a mais por núcleon × 236 núcleons)`, x, 3.0, { size: 11, align: "left", color: th.muted });
  const VC = coulombBarrier(ch.Zh, Ah, ch.Zl, Al);
  d.text(`repulsão coulombiana dos fragmentos em contato ≈ ${fmt(VC, 3)} MeV`, x, 2.2, { size: 11, align: "left" });
  const J = fissionJPerKg(Q);
  d.text("Energia por quilograma de ²³⁵U fissionado", x, 0.8, { size: 13, weight: "700", align: "left" });
  d.text(`${sci(J)} J/kg`, x, 0, { size: 12, align: "left", color: th.accent, weight: "700" });
  const bars: [string, number][] = [
    ["²³⁵U (fissão)", J],
    ["TNT", 4.184e6],
    ["carvão", 2.9e7],
    ["gasolina", 4.6e7],
  ];
  const bx = { x0: x + 3.4, x1: 16.3 };
  bars.forEach(([name, v], i) => {
    const y = -1.4 - i * 1.1;
    const w = ((Math.log10(v) - 5) / (Math.log10(J) - 5)) * (bx.x1 - bx.x0);
    d.text(name, x, y, { size: 11, align: "left" });
    d.rect(bx.x0, y - 0.35, Math.max(w, 0.05), 0.7, { fill: i === 0 ? th.accent : th.muted, alpha: 0.85 });
    d.text(sci(v, 2), bx.x0 + w, y, { size: 9, align: "right", dx: -4, color: th.dark ? "#10151c" : "#ffffff" });
  });
  d.text("(escala logarítmica)", bx.x1, -5.6, { size: 9, align: "right", color: th.muted });
  d.text(`1 kg de ²³⁵U ≈ ${sci(J / 2.9e7, 2)} kg de carvão`, x, -6.6, { size: 12, align: "left", weight: "600" });
  d.text("Contando os decaimentos dos fragmentos, o total chega a ~200 MeV.", x, -7.4, { size: 10, align: "left", color: th.muted });
}

// --------------------------------------------------------------- tema 2: reação em cadeia
function drawChain(d: Draw, s: NucState, p: Params) {
  const th = d.theme;
  const R = radius(p);
  const c = coreFor(p);
  const cx = -9.2;
  const cy = -0.6;
  const S = 7.4 / R;
  const mod = Math.round(num(p, "moderador"));
  d.circle(cx, cy, 7.4, { fill: mod === 0 ? th.series[5]! + "22" : th.accent + "18", stroke: th.text, width: 2 });
  // barras de controle (o efeito é distribuído no núcleo: modelo homogêneo)
  const h = clamp(num(p, "barras"), 0, 1);
  for (const bx of [-3.7, 0, 3.7]) {
    const top = cy + Math.sqrt(Math.max(0, 7.4 ** 2 - bx * bx));
    d.rect(cx + bx - 0.22, top - h * 2 * 7.4 * 0.9, 0.44, h * 2 * 7.4 * 0.9 + 1.2, { fill: th.text, alpha: 0.75 });
  }
  const ctx = d.ctx;
  for (let i = 0; i < s.chain.flashes.length; i += 3) {
    const age = s.chain.flashes[i + 2]!;
    d.circle(cx + s.chain.flashes[i]! * S, cy + s.chain.flashes[i + 1]! * S, 0, { minPx: 3 + 2.5 * age, stroke: th.series[1]!, width: 1.5, alpha: Math.max(0, 1 - age / 6) });
  }
  ctx.fillStyle = th.accent;
  const sz = 3 * d.px;
  for (let i = 0; i < s.chain.pos.length; i += 3) {
    const x = cx + s.chain.pos[i]! * S;
    const y = cy + s.chain.pos[i + 2]! * S;
    ctx.fillRect(x - sz / 2, y - sz / 2, sz, sz);
  }
  d.text(`R = ${sci(R)} cm`, cx, cy - 7.4, { size: 11, dy: 12 });
  const kM = measuredK(s.chain);
  const kT = kEff(c, R);
  const state = kT > 1.005 ? "supercrítico" : kT < 0.995 ? "subcrítico" : "crítico";
  d.text("Reação em cadeia", -16.5, 8.7, { size: 15, weight: "700", align: "left" });
  d.text(`k medido = ${kM > 0 ? fmt(kM, 3) : "—"}    k (difusão) = ${fmt(kT, 3)}  → ${state}`, -16.5, 7.9, { size: 12, align: "left", color: kT > 1 ? th.positive : th.accent, weight: "600" });
  d.text("pontos: nêutrons (projeção)   círculos: fissões   barras: absorvedores", -16.5, -9.1, { size: 10, align: "left", color: th.muted });

  // população
  const hist = s.chain.hist;
  const pb = { x0: 3.4, y0: 1.6, x1: 16.3, y1: 7.2 };
  const lo = Math.min(...hist, 0);
  const hi = Math.max(...hist, 3);
  const pp = panel(d, pb, { min: 0, max: 400 }, { min: Math.floor(lo), max: Math.ceil(hi) + 0.5 });
  pp.frame({ xlabel: "passos (gerações parciais)", ylabel: "log₁₀ N (nêutrons)", fx: (v) => String(Math.round(v)) });
  pp.line(hist.map((v, i) => [i, v] as [number, number]), { color: th.series[1]!, width: 2 });
  d.text(`N = ${sci(population(s.chain))}`, pb.x1 - 0.2, pb.y1 - 0.4, { size: 11, align: "right", weight: "600" });

  // k(R)
  const kb = { x0: 3.4, y0: -7.6, x1: 16.3, y1: -1.2 };
  const kmax = Math.max(1.5, Math.min(c.kInf * 1.1, 2.6));
  const pk = panel(d, kb, { min: 1, max: 600, log: true }, { min: 0, max: kmax });
  pk.frame({ xlabel: "raio R (cm)", ylabel: "k efetivo", fx: (v) => String(Math.round(v)) });
  d.line(kb.x0, pk.Y(1), kb.x1, pk.Y(1), { color: th.positive, width: 1.2, dash: [5, 4] });
  pk.plot((r) => kEff(c, r), 1, 600, { color: th.accent, width: 2 });
  d.line(kb.x0, pk.Y(c.kInf), kb.x1, pk.Y(c.kInf), { color: th.muted, width: 1, dash: [2, 4] });
  d.text(`k∞ = ${fmt(c.kInf, 3)}`, kb.x0 + 0.2, pk.Y(c.kInf), { size: 10, align: "left", color: th.muted, dy: -8 });
  d.dot(pk.X(R), pk.Y(clamp(kT, 0, kmax)), 5, th.accent);
  if (kM > 0) d.dot(pk.X(R), pk.Y(clamp(kM, 0, kmax)), 4, th.series[1]!);
  if (Number.isFinite(c.Rc) && c.Rc > 1 && c.Rc < 600) {
    d.line(pk.X(c.Rc), kb.y0, pk.X(c.Rc), pk.Y(1), { color: th.positive, width: 1, dash: [3, 3] });
    const massTxt = Math.round(num(p, "moderador")) === 0 ? `, massa crítica ≈ ${sci(uraniumMassKg(c.Rc))} kg` : "";
    d.text(`R crítico ≈ ${sci(c.Rc)} cm${massTxt}`, kb.x0 + 0.2, kb.y1 + 0.45, { size: 11, align: "left", color: th.positive, weight: "600" });
  } else d.text("k∞ < 1: nenhum tamanho fica crítico", kb.x0 + 0.2, kb.y1 + 0.45, { size: 11, align: "left", color: th.positive, weight: "600" });
  d.text("● teoria   ● Monte Carlo", kb.x1, kb.y1 + 0.45, { size: 10, align: "right", color: th.muted });
}

// --------------------------------------------------------------- tema 3: fusão D–T
function drawFusion(d: Draw, s: NucState, p: Params) {
  const th = d.theme;
  const E = num(p, "E", 15);
  const kT = num(p, "kT", 10);
  const P = tunnelP(E);
  const rt = turningPointFm(E);
  const Rn = 1.2 * (2 ** (1 / 3) + 3 ** (1 / 3));
  const VB = coulombBarrier(1, 2, 1, 3);
  d.text("Fusão D + T → ⁴He (3,5 MeV) + n (14,1 MeV)", -16.5, 8.7, { size: 15, weight: "700", align: "left" });
  d.text(`Q = ${fmt(fusionQ(), 4)} MeV por reação   barreira coulombiana ≈ ${fmt(VB * 1000, 3)} keV`, -16.5, 7.9, { size: 12, align: "left" });
  // animação da colisão
  const cyc = Math.floor(s.clock / FUSION_CYCLE);
  const ph = (s.clock % FUSION_CYCLE) / FUSION_CYCLE;
  const fused = s.fusedCycle === cyc;
  const y0 = 4.6;
  const cx = -8;
  const scale = 0.18;
  const dmin = Math.min(rt, 40) * scale + 0.5;
  const far = 7;
  const sep = ph < 0.5 ? far - (far - dmin) * (ph / 0.5) ** 0.6 : fused ? 0 : dmin + (far - dmin) * ((ph - 0.5) / 0.5) ** 1.6;
  if (fused && ph >= 0.5) {
    const q = (ph - 0.5) / 0.5;
    nucleus(d, cx - 1.6 * q * 4, y0, 4, 2, 0.6, 7);
    d.dot(cx + 4 * 4 * q, y0, 5, th.dark ? "#c5ccd6" : "#6b7380");
    d.circle(cx, y0, 0.4 + 3 * q, { stroke: th.series[5]!, width: 2, alpha: 1 - q });
    d.text("fusão!", cx, y0 + 1.6, { size: 13, weight: "700", color: th.series[5]! });
  } else {
    nucleus(d, cx - sep / 2, y0, 2, 1, 0.42, 3);
    nucleus(d, cx + sep / 2, y0, 3, 1, 0.5, 11);
    d.text("D", cx - sep / 2, y0 + 0.9, { size: 11 });
    d.text("T", cx + sep / 2, y0 + 0.9, { size: 11 });
  }
  d.text(`colisões simuladas: ${sci(s.attempts)}   fusões: ${s.fusions}`, cx, y0 - 1.5, { size: 11, weight: "600" });
  d.text(`esperado: 1 fusão a cada ${sci(1 / P)} colisões nesta energia`, cx, y0 - 2.15, { size: 10, color: th.muted });

  // potencial V(r)
  const vb = { x0: -15.2, y0: -8, x1: -1, y1: 0.8 };
  const rmax = 40;
  const vmax = 0.6;
  const pv = panel(d, vb, { min: 0, max: rmax }, { min: -0.15, max: vmax });
  pv.frame({ xlabel: "distância r (fm)", ylabel: "V (MeV)" });
  pv.plot((r) => (r < Rn ? -0.12 : KE2 / r), 0.01, rmax, { color: th.text, width: 2, n: 400 });
  d.text("poço nuclear", pv.X(Rn / 2), pv.Y(-0.12), { size: 9, dy: 9 });
  d.text(`V = ke²/r`, pv.X(Rn + 1), pv.Y(0.48), { size: 11, align: "left", color: th.text });
  const Em = E / 1000;
  const yE = pv.Y(Math.min(Em, vmax));
  d.line(pv.X(Math.min(rt, rmax)), yE, vb.x1, yE, { color: th.accent, width: 2 });
  if (rt < rmax) {
    d.line(pv.X(Rn), yE, pv.X(rt), yE, { color: th.accent, width: 2, dash: [4, 4] });
    d.dot(pv.X(rt), yE, 4, th.accent);
    d.text(`retorno clássico r = ${fmt(rt, 3)} fm`, pv.X(rt), yE, { size: 10, align: "left", dx: 6, dy: -9, color: th.accent });
  }
  d.text(`E = ${fmt(E, 3)} keV   tunelamento P ≈ e^(−√(E_G/E)) = ${sci(P)}`, vb.x0, vb.y1 + 0.45, { size: 11, align: "left", color: th.accent, weight: "600" });

  // pico de Gamow
  const gb = { x0: 1.6, y0: -8, x1: 16.3, y1: 6.2 };
  const E0 = gamowPeakKeV(kT);
  const Emax = Math.max(6 * E0, 10 * kT);
  const pg = panel(d, gb, { min: 0, max: Emax }, { min: 0, max: 1.15 });
  pg.frame({ xlabel: "energia E (keV)", ylabel: "relativo (escala própria)", yticks: [0, 0.5, 1] });
  const EG = gamowEnergyKeV();
  const mb = (x: number) => Math.sqrt(x) * Math.exp(-x / kT);
  const tun = (x: number) => Math.exp(-Math.sqrt(EG / x));
  const prod = (x: number) => Math.exp(-x / kT - Math.sqrt(EG / x));
  let mbMax = 0;
  let tMax = 0;
  let pMax = 0;
  for (let i = 1; i <= 400; i++) {
    const x = (Emax * i) / 400;
    mbMax = Math.max(mbMax, mb(x));
    tMax = Math.max(tMax, tun(x));
    pMax = Math.max(pMax, prod(x));
  }
  pg.plot((x) => mb(x) / mbMax, 0.01, Emax, { color: th.series[1]!, width: 1.8 });
  pg.plot((x) => tun(x) / tMax, 0.01, Emax, { color: th.series[4]!, width: 1.8, dash: [5, 4] });
  pg.plot((x) => prod(x) / pMax, 0.01, Emax, { color: th.accent, width: 2.6 });
  d.line(pg.X(E0), gb.y0, pg.X(E0), pg.Y(1), { color: th.accent, width: 1, dash: [3, 3] });
  d.text(`pico de Gamow E₀ ≈ ${fmt(E0, 3)} keV`, pg.X(E0), pg.Y(1.07), { size: 11, color: th.accent, weight: "700", align: "left", dx: 4 });
  d.text("distribuição de Maxwell (kT)", gb.x1 - 0.2, gb.y1 + 1.15, { size: 10, align: "right", color: th.series[1]! });
  d.text("probabilidade de tunelamento", gb.x1 - 0.2, gb.y1 + 0.55, { size: 10, align: "right", color: th.series[4]! });
  d.text(`kT = ${fmt(kT, 3)} keV (T ≈ ${sci(kT * 1.1605e7)} K)`, gb.x0, gb.y1 + 0.55, { size: 11, align: "left", weight: "600" });
}

function poisson(st: { seed: number }, lambda: number): number {
  if (lambda > 30) return Math.max(0, Math.round(lambda + Math.sqrt(lambda) * Math.sqrt(-2 * Math.log(nextRandom(st) || 1e-12)) * Math.cos(2 * Math.PI * nextRandom(st))));
  const L = Math.exp(-lambda);
  let k = 0;
  let prod = nextRandom(st);
  while (prod > L) {
    k++;
    prod *= nextRandom(st);
  }
  return k;
}

export const nuclear = defineSim<NucState>({
  id: "nuclear",
  title: "Fissão, fusão e reação em cadeia",
  course: "FG IV",
  topic: "Nuclear",
  priority: "P2",
  summary:
    "Energia de ligação por núcleon pela fórmula de Weizsäcker, fissão do U-235 com a energia do defeito de massa, reação em cadeia com nêutrons em Monte Carlo (fator k, raio e massa críticos, moderador e barras de controle) e fusão D–T com a barreira coulombiana e o tunelamento.",
  equations: [
    String.raw`B = a_V A - a_S A^{2/3} - a_C\frac{Z(Z-1)}{A^{1/3}} - a_A\frac{(A-2Z)^2}{A} \pm \delta`,
    String.raw`Q = \left(m_{\text{antes}} - m_{\text{depois}}\right)c^2 \qquad 1\ \text{u} = 931{,}5\ \text{MeV}/c^2`,
    String.raw`k = \frac{\text{nêutrons da geração } i+1}{\text{nêutrons da geração } i} \qquad k_\text{ef} = \frac{k_\infty}{1 + M^2B^2},\ B = \frac{\pi}{R + d}`,
    String.raw`V_C = \frac{k e^2 Z_1 Z_2}{R_1 + R_2} \qquad P \approx e^{-\sqrt{E_G/E}},\ E_G = 2\mu c^2(\pi\alpha Z_1Z_2)^2`,
  ],
  liveEquations(s, p) {
    const tm = theme(p);
    if (tm === 0) {
      const A = massNum(p);
      const Z = stableZ(A);
      return [String.raw`B(${A}, ${Z}) = ${texNum(semfB(A, Z), 4)}\ \text{MeV} \qquad B/A = ${texNum(semfB(A, Z) / A, 4)}\ \text{MeV}`];
    }
    if (tm === 1) {
      const Q = fissionQ(channel(p));
      return [String.raw`Q = ${texNum(Q, 4)}\ \text{MeV} \qquad E/m = ${texNum(fissionJPerKg(Q))}\ \text{J/kg}`];
    }
    if (tm === 2) {
      const c = coreFor(p);
      return [
        String.raw`k_\infty = ${texNum(c.kInf)} \qquad k_\text{ef}(R = ${texNum(radius(p))}\ \text{cm}) = ${texNum(kEff(c, radius(p)))} \qquad k_\text{medido} = ${texNum(measuredK(s.chain))}`,
      ];
    }
    if (tm >= TEMA_BETA) return extraLiveEquations(tm, s.beta, p);
    const E = num(p, "E", 15);
    return [String.raw`P(E = ${texNum(E)}\ \text{keV}) = e^{-\sqrt{${texNum(gamowEnergyKeV(), 4)}/${texNum(E)}}} = ${texNum(tunnelP(E))}`];
  },
  params: [
    {
      key: "tema",
      label: "Tema",
      unit: "",
      min: 0,
      max: 7,
      step: 1,
      default: 0,
      live: true,
      options: [
        { value: 0, label: "Energia de ligação (Weizsäcker)" },
        { value: 1, label: "Fissão do U-235" },
        { value: 2, label: "Reação em cadeia" },
        { value: 3, label: "Fusão D–T e barreira coulombiana" },
        { value: 4, label: "Espectro beta e o neutrino" },
        { value: 5, label: "Modelo de camadas" },
        { value: 6, label: "Reator natural de Oklo" },
        { value: 7, label: "Fusão controlada: critério de Lawson" },
      ],
    },
    { key: "A", label: "Número de massa A", unit: "", min: 2, max: 250, step: 1, default: 56, live: true },
    {
      key: "canal",
      label: "Fragmentos da fissão",
      unit: "",
      min: 0,
      max: 2,
      step: 1,
      default: 0,
      live: true,
      options: CHANNELS.map((c, i) => ({ value: i, label: `${label(c.heavy)} + ${label(c.light)} + ${c.nn} n` })),
    },
    { key: "R", label: "Raio do núcleo do reator R", unit: "cm", min: 1, max: 600, step: 0.5, default: 12, log: true, live: true },
    { key: "enr", label: "Enriquecimento em U-235", unit: "%", min: 0.7, max: 100, step: 0.1, default: 100, log: true, live: true },
    {
      key: "moderador",
      label: "Moderador",
      unit: "",
      min: 0,
      max: 2,
      step: 1,
      default: 0,
      live: true,
      options: [
        { value: 0, label: "Nenhum (nêutrons rápidos, metal)" },
        { value: 1, label: "Grafite" },
        { value: 2, label: "Água leve" },
      ],
    },
    { key: "barras", label: "Inserção das barras de controle", unit: "", min: 0, max: 1, step: 0.01, default: 0, live: true },
    { key: "E", label: "Energia da colisão D–T", unit: "keV", min: 1, max: 1000, step: 1, default: 15, log: true, live: true },
    { key: "kT", label: "Temperatura do plasma kT", unit: "keV", min: 1, max: 100, step: 0.5, default: 10, log: true, live: true },
    ...extraParams,
  ],
  observables: [
    { key: "BA", label: "B/A (fórmula)", unit: "MeV", value: (_s, p) => semfB(massNum(p), stableZ(massNum(p))) / massNum(p) },
    { key: "Q", label: "Q da fissão", unit: "MeV", value: (_s, p) => fissionQ(channel(p)) },
    { key: "kmed", label: "k medido (Monte Carlo)", unit: "", value: (s) => measuredK(s.chain) },
    { key: "kef", label: "k efetivo (difusão)", unit: "", value: (_s, p) => kEff(coreFor(p), radius(p)) },
    { key: "kinf", label: "k∞", unit: "", value: (_s, p) => coreFor(p).kInf },
    { key: "logN", label: "log₁₀ N (nêutrons)", unit: "", value: (s) => s.chain.hist[s.chain.hist.length - 1] ?? 0 },
    { key: "Rc", label: "Raio crítico", unit: "cm", value: (_s, p) => (Number.isFinite(coreFor(p).Rc) ? coreFor(p).Rc : 0) },
    { key: "P", label: "Probabilidade de tunelamento", unit: "", value: (_s, p) => tunnelP(num(p, "E", 15)) },
    { key: "fusoes", label: "Fusões D–T", unit: "", value: (s) => s.fusions },
    { key: "Kmed", label: "Energia média do elétron beta", unit: "keV", value: (s) => (s.beta.count ? s.beta.sum / s.beta.count : 0) },
  ],
  chart: { x: "t", y: "logN" },
  scenarios: [
    {
      id: "ligacao",
      label: "Curva de energia de ligação",
      params: { tema: 0, A: 56 },
      guide: `### Por que fissão e fusão liberam energia
1. A curva $B/A$ sobe rápido nos leves, tem máximo perto do ferro ($A \\approx 56$–$62$) e desce devagar até o urânio.
2. Mova $A$ e veja os termos: o de **volume** é constante por núcleon; **superfície** pesa nos leves; **Coulomb** cresce com $Z^2/A^{4/3}$ e domina nos pesados.
3. Juntar dois leves (fusão) ou partir um pesado (fissão) leva os núcleons para mais perto do pico: a diferença de ligação vira energia liberada.
4. Compare a fórmula com os pontos experimentais: ela falha nos muito leves (⁴He é excepcionalmente ligado).`,
      predict: [
        {
          question: "Partindo um núcleo de urânio (B/A ≈ 7,6 MeV) em dois de A ≈ 118 (B/A ≈ 8,5 MeV), a energia liberada é da ordem de:",
          options: ["1 MeV", "20 MeV", "200 MeV", "2000 MeV"],
          answer: 2,
          explanation: "Cada um dos ~236 núcleons fica cerca de 0,9 MeV mais ligado: $236 \\times 0{,}9 \\approx 200$ MeV, cerca de 100 milhões de vezes a energia de uma reação química.",
        },
      ],
    },
    {
      id: "fissao",
      label: "Fissão do U-235",
      params: { tema: 1, canal: 0 },
      guide: `### Uma fissão
1. Um nêutron lento é absorvido: o ²³⁶U* excitado oscila como uma gota líquida e se parte.
2. Compare as massas antes e depois: o defeito de massa de ~0,19 u vira ~173 MeV de energia cinética.
3. O fragmento leve sai mais rápido: com momento total nulo, $E_\\text{leve}/E_\\text{pesado} = m_\\text{pesado}/m_\\text{leve}$.
4. Troque os fragmentos: o número de nêutrons emitidos (2 ou 3) é o que torna possível a reação em cadeia.`,
    },
    {
      id: "cadeia",
      label: "Reação em cadeia e massa crítica",
      params: { tema: 2, R: 6, enr: 100, moderador: 0, barras: 0 },
      guide: `### Criticalidade
1. Esfera de U-235 metálico com $R = 6$ cm: muitos nêutrons escapam pela superfície e a população cai ($k < 1$).
2. Aumente $R$ até passar de ~9,6 cm: a fuga relativa diminui (superfície/volume $\\propto 1/R$) e a população cresce exponencialmente.
3. Compare o $k$ medido no Monte Carlo com a curva da teoria de difusão.
4. Use urânio natural (0,7%) sem moderador: $k_\\infty < 1$, nunca fica crítico. Com **grafite** fica (é a pilha de Fermi, de metros de raio); com **água leve** precisa de enriquecimento (~3%).
5. Insira as **barras de controle** para trazer um núcleo supercrítico de volta a $k = 1$.`,
      predict: [
        {
          question: "Dobrando o raio de uma esfera subcrítica de U-235, o que acontece com a fração de nêutrons que escapa?",
          options: ["Dobra", "Fica igual", "Cai, porque a superfície cresce menos que o volume", "Cai a zero"],
          answer: 2,
          explanation: "A produção cresce com o volume ($R^3$) e a fuga com a superfície ($R^2$). Por isso existe um tamanho (massa) crítico a partir do qual $k \\ge 1$.",
        },
      ],
    },
    {
      id: "fusao",
      label: "Fusão D–T e tunelamento",
      params: { tema: 3, E: 15, kT: 10 },
      guide: `### A barreira coulombiana
1. Para se tocarem, D e T precisam vencer ~0,44 MeV de repulsão; num plasma a 10 keV quase nenhum par tem essa energia.
2. Classicamente eles voltam no ponto de retorno $r = ke^2/E$. A fusão só ocorre por **tunelamento**, com probabilidade $\\sim e^{-\\sqrt{E_G/E}}$.
3. No gráfico, o produto da distribuição de Maxwell (cai com $E$) pelo tunelamento (cresce com $E$) forma o **pico de Gamow**: é ali que as fusões acontecem.
4. Varie $kT$: o pico se desloca como $(kT)^{2/3}$.`,
      predict: [
        {
          question: "Num plasma D–T com kT = 10 keV, em que energia ocorre a maior parte das fusões?",
          options: ["Em torno de 10 keV (a energia típica)", "Em torno de 30 keV", "Acima de 440 keV (topo da barreira)", "Perto de zero"],
          answer: 1,
          explanation: "O pico de Gamow fica em $E_0 = (E_G(kT)^2/4)^{1/3} \\approx 31$ keV: acima da energia típica, mas muito abaixo do topo da barreira, graças ao tunelamento.",
        },
      ],
    },
    ...extraScenarios,
  ],
  exercises: [
    {
      id: "ligacao",
      prompt: "Use a fórmula semiempírica (a_V = 15,75; a_S = 17,8; a_C = 0,711 com Z(Z − 1); a_A = 23,7; a_P = 11,18 MeV, com δ = ±a_P/√A) para estimar a energia de ligação, em MeV, de um núcleo com A = {A} e Z = {Zx}.",
      vary: { A: [54, 64, 0], Zx: [25, 29, 0] },
      fixed: { tema: 0 },
      answer: { label: "B", unit: "MeV", compute: (p) => semfB(massNum(p), Math.round(num(p, "Zx", 26))) },
      tolerance: 0.01,
      hint: "Some os cinco termos; δ = +a_P/√A para Z e N pares, −a_P/√A para ímpar–ímpar e 0 para A ímpar.",
    },
    {
      id: "critico",
      prompt: "Um núcleo tem k∞ = {kinfx} e área de migração M² = {M2x} cm². Pela teoria de difusão (esfera nua, despreze a distância de extrapolação), qual é o raio crítico, em cm?",
      vary: { kinfx: [1.1, 2.3, 2], M2x: [15, 80, 0] },
      fixed: { tema: 2 },
      answer: { label: "R_c", unit: "cm", compute: (p) => (Math.PI * Math.sqrt(num(p, "M2x", 20))) / Math.sqrt(num(p, "kinfx", 2) - 1) },
      hint: "k = k∞/(1 + M²B²) = 1 com B = π/R.",
    },
    ...extraExercises,
  ],
  init: (p) => ({ clock: 0, chain: initChain(radius(p)), attempts: 0, fusions: 0, fusedCycle: -1, seed: 777, beta: emptyBeta() }),
  step(s, p, _t, dt) {
    const tm = theme(p);
    const ns: NucState = { ...s, clock: s.clock + dt };
    if (tm === 2) ns.chain = stepChain(s.chain, coreFor(p), radius(p));
    if (tm === TEMA_BETA) ns.beta = stepBeta(s.beta, p);
    if (tm === 3) {
      const st = { seed: s.seed };
      const n = COLLISION_RATE * dt;
      const k = poisson(st, n * tunnelP(num(p, "E", 15)));
      ns.seed = st.seed;
      ns.attempts = s.attempts + n;
      ns.fusions = s.fusions + k;
      if (k > 0) ns.fusedCycle = Math.floor(ns.clock / FUSION_CYCLE);
    }
    return ns;
  },
  dt: 1 / 30,
  sampleEvery: 10,
  maxSamples: 1500,
  actions: [
    { id: "injetar", label: "Injetar 100 nêutrons", run: (s, p) => ({ ...s, chain: { ...initChain(radius(p), s.chain.seed + 1, 100), hist: s.chain.hist } }) },
    { id: "fissao-um", label: "Repetir a fissão", run: (s) => ({ ...s, clock: 0 }) },
    { id: "zerar-fusao", label: "Zerar contador de fusões", run: (s) => ({ ...s, attempts: 0, fusions: 0 }) },
  ],
  narrowSplit: () => 0.672,
  viewport: () => ({ ...VIEW, unit: "" }),
  render(ctx, frame) {
    const d = draw(ctx, frame);
    const { state: s, params: p } = frame;
    switch (theme(p)) {
      case 0:
        drawBinding(d, p);
        break;
      case 1:
        drawFission(d, p, s.clock);
        break;
      case 2:
        drawChain(d, s, p);
        break;
      case TEMA_BETA:
        drawBeta(d, s.beta, p);
        break;
      case TEMA_CAMADAS:
        drawShell(d, p);
        break;
      case TEMA_OKLO:
        drawOklo(d, p);
        break;
      case 3:
        drawFusion(d, s, p);
        break;
      default:
        drawLawson(d, p);
    }
  },
});

export default nuclear;
