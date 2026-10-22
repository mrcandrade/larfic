import { clamp, deg, defineSim, draw, num, rad, texNum, type Draw, type Params, type WorldPoint } from "@fisilab/core";
import { derivation } from "./derivation.ts";
import { fmt, panel } from "./panel.ts";
import {
  DECUPLET,
  FLAVORS,
  ME,
  NONET,
  OCTET,
  PALETTE_IDS,
  PARTICLES,
  QKEYS,
  QUARK_Q,
  REACTIONS,
  U_MEV,
  annihilation,
  build,
  checkReaction,
  decayLength,
  decupletRows,
  gmoOctet,
  pairProduction,
  pairThreshold,
  particle,
  predictOmega,
  thresholdK,
  width,
  type Flavor,
  type MultipletMember,
  type Particle,
  type QuarkTok,
  type Via,
} from "./physics.ts";
import { plainSym, texSym, ui } from "./ui.ts";

export * from "./physics.ts";
export { parseSym, plainSym, texSym } from "./ui.ts";

export interface PState {
  /** Relógio das animações (s). */
  clock: number;
  /** Partícula selecionada (catálogo e multipletos). */
  sel: string;
  /** Reação montada: reagentes, produtos e o lado que recebe a próxima partícula. */
  left: string[];
  right: string[];
  side: 0 | 1;
  /** Sacola de quarks. */
  bag: QuarkTok[];
}

const VIEW = { xMin: -17, xMax: 17, yMin: -9.5, yMax: 9.5 };
const theme = (p: Params) => Math.round(num(p, "tema"));
const MAX_LEFT = 2;
const MAX_RIGHT = 4;

// ------------------------------------------------------------------ formatação
const sci = (v: number, d = 3) => {
  if (!Number.isFinite(v)) return "∞";
  if (v === 0) return "0";
  const e = Math.floor(Math.log10(Math.abs(v)));
  if (e >= -2 && e < 5) return fmt(v, d);
  const m = v / 10 ** e;
  const sup = String(e).replace(/-/g, "⁻").replace(/\d/g, (c) => "⁰¹²³⁴⁵⁶⁷⁸⁹"[Number(c)]!);
  return `${fmt(m, d)} × 10${sup}`;
};
const frac = (v: number) => {
  if (Math.abs(v) < 1e-9) return "0";
  const s = v > 0 ? "+" : "−";
  const a = Math.abs(v);
  const n3 = Math.round(a * 3);
  if (Math.abs(a * 3 - n3) < 1e-6 && n3 % 3 !== 0) return `${s}${n3}/3`;
  const n2 = Math.round(a * 2);
  if (Math.abs(a * 2 - n2) < 1e-6 && n2 % 2 !== 0) return `${s}${n2}/2`;
  return `${s}${Math.round(a)}`;
};
const spinTxt = (s: number) => (s === 0.5 ? "½" : s === 1.5 ? "3/2" : String(s));
const massTxt = (m: number) => (m === 0 ? "0 (sem massa)" : m >= 1e4 ? `${fmt(m / 1000, 4)} GeV/c²` : `${fmt(m, m < 1 ? 4 : 5)} MeV/c²`);
const tauTxt = (p: Particle) => (p.via === "confinado" ? "— (confinado)" : Number.isFinite(p.tau) ? `${sci(p.tau)} s` : "estável");
/** Conteúdo de quarks em texto simples ("u~d" → "ud̄"). */
const quarkTxt = (q: string) => q.replace(/~([udscbt])/g, "$1\u0304");

const VIA_LABEL: Record<Via, string> = {
  forte: "forte",
  eletromagnética: "eletromagnética",
  fraca: "fraca",
  Yukawa: "acoplamento de Higgs",
  estável: "estável",
  confinado: "confinado",
};
const viaColor = (d: Draw, v: Via | "fraca" | "forte" | "eletromagnética") => {
  const s = d.theme.series;
  return v === "forte" ? s[1]! : v === "eletromagnética" ? s[4]! : v === "fraca" ? s[2]! : v === "Yukawa" ? s[5]! : v === "estável" ? d.theme.text : d.theme.muted;
};
const kindColor = (d: Draw, k: Particle["kind"]) => {
  const s = d.theme.series;
  return k === "lepton" ? s[0]! : k === "quark" ? s[3]! : k === "boson" ? s[5]! : k === "meson" ? s[2]! : s[1]!;
};

// ------------------------------------------------------------------ tema 0: catálogo
const ZOO_ROWS: { label: string; ids: string[] }[] = [
  { label: "Léptons (sem estrutura interna)", ids: ["e-", "nue", "mu-", "numu", "tau-", "nutau"] },
  { label: "Quarks (confinados)", ids: ["u", "d", "s", "c", "b", "t"] },
  { label: "Bósons mediadores e Higgs", ids: ["gamma", "g", "W+", "Z0", "H0"] },
  { label: "Mésons (quark + antiquark)", ids: ["pi+", "pi0", "K+", "K0", "eta", "etap", "D+", "Jpsi", "B+"] },
  { label: "Bárions (três quarks)", ids: ["p", "n", "Lambda", "Sigma+", "Sigma0", "Sigma-", "Xi0", "Xi-", "Omega-", "Delta++", "Lambdac"] },
];
const CARD = { x0: -16.6, top: 8.45, w: 1.72, h: 1.08, gap: 0.07, row: 1.62 };
const cardBox = (r: number, i: number) => ({ x: CARD.x0 + i * (CARD.w + CARD.gap), y: CARD.top - r * CARD.row - CARD.h, w: CARD.w, h: CARD.h });
const LT = { x0: -14.6, x1: 3, y0: -8.1, y1: -1.1, mMin: 0.1, mMax: 4e5, tMin: 1e-25, tMax: 1e4 };
const ltPanel = (d: Draw) => panel(d, { x0: LT.x0, y0: LT.y0, x1: LT.x1, y1: LT.y1 }, { min: LT.mMin, max: LT.mMax, log: true }, { min: LT.tMin, max: LT.tMax, log: true });
const onChart = (p: Particle) => p.m > 0 && Number.isFinite(p.tau);

function drawZoo(d: Draw, s: PState, p: Params) {
  const th = d.theme;
  const u = ui(d);
  ZOO_ROWS.forEach((row, r) => {
    u.text(row.label, CARD.x0, CARD.top - r * CARD.row + 0.25, { size: 11, align: "left", color: th.muted, weight: "600" });
    row.ids.forEach((id, i) => {
      const pt = particle(id);
      const b = cardBox(r, i);
      const col = kindColor(d, pt.kind);
      const sel = s.sel === id;
      d.rect(b.x, b.y, b.w, b.h, { fill: col, alpha: sel ? 0.32 : 0.13 });
      d.rect(b.x, b.y, b.w, b.h, { stroke: sel ? th.accent : col, width: sel ? 2.5 : 1 });
      u.sym(pt.sym, b.x + b.w / 2, b.y + b.h * 0.62, { size: 15 });
      u.text(pt.m === 0 ? "0" : pt.m >= 1e4 ? `${fmt(pt.m / 1000, 3)} GeV` : `${fmt(pt.m, 3)} MeV`, b.x + b.w / 2, b.y + b.h * 0.2, { size: 8.5, color: th.muted });
    });
  });

  // massa × vida média
  const pl = ltPanel(d);
  u.text("Vida média × massa: a interação do decaimento fixa a escala de tempo", LT.x0 - 1.9, LT.y1 + 0.55, { size: 11, align: "left", weight: "700" });
  const band = (t0: number, t1: number, v: Via, label: string) => {
    d.rect(LT.x0, pl.Y(t0), LT.x1 - LT.x0, pl.Y(t1) - pl.Y(t0), { fill: viaColor(d, v), alpha: 0.08 });
    u.text(label, LT.x1 - 0.15, pl.Y(Math.sqrt(t0 * t1)), { size: 9.5, align: "right", color: viaColor(d, v), weight: "600" });
  };
  band(1e-25, 1e-21, "forte", "forte ~10⁻²³ s");
  band(1e-21, 1e-15, "eletromagnética", "eletromagnética ~10⁻¹⁶–10⁻²⁰ s");
  band(1e-14, 1e4, "fraca", "fraca > 10⁻¹³ s");
  pl.frame({
    xlabel: "massa (MeV/c²)",
    ylabel: "τ (s)",
    xticks: [0.1, 10, 1e3, 1e5],
    yticks: [1e-24, 1e-18, 1e-12, 1e-6, 1, 1e3],
    fx: (v) => sci(v, 1),
    fy: (v) => sci(v, 1),
  });
  for (const pt of [...PARTICLES]) {
    if (!onChart(pt)) continue;
    const big = pt.id === s.sel;
    d.dot(pl.X(pt.m), pl.Y(pt.tau), big ? 6 : 3.6, viaColor(d, pt.via));
    if (big) d.circle(pl.X(pt.m), pl.Y(pt.tau), 0, { minPx: 9, stroke: th.accent, width: 2 });
  }
  if (!onChart(particle(s.sel))) u.text("(a partícula escolhida é estável, confinada ou sem massa: fora do gráfico)", (LT.x0 + LT.x1) / 2, LT.y1 - 0.4, { size: 9.5, color: th.muted });

  // ficha da partícula
  const pt = particle(s.sel);
  const x = 4.4;
  const col = kindColor(d, pt.kind);
  d.rect(x - 0.3, -9.2, 16.8 - x + 0.2, 18.4, { fill: col, alpha: 0.06 });
  u.sym(pt.sym, x + 0.3, 7.9, { size: 34, align: "left" });
  u.text(pt.name, x + 3.2, 8.25, { size: 16, weight: "700", align: "left" });
  const kinds: Record<Particle["kind"], string> = { lepton: "lépton (férmion elementar)", quark: "quark (férmion elementar)", boson: "bóson elementar", meson: "méson (hádron, bóson)", baryon: "bárion (hádron, férmion)" };
  u.text(kinds[pt.kind], x + 3.2, 7.5, { size: 11, align: "left", color: col, weight: "600" });
  const rows: [string, string][] = [
    ["massa", massTxt(pt.m) + (pt.m > 1 && pt.m < 1e4 ? `  (${fmt(pt.m / U_MEV, 4)} u)` : "")],
    ["carga", `${frac(pt.q)} e`],
    ["spin", spinTxt(pt.spin)],
    ["vida média τ", tauTxt(pt)],
    ["cτ", Number.isFinite(pt.tau) ? `${sci(2.99792458e8 * pt.tau)} m` : "—"],
    ["largura Γ = ħ/τ", Number.isFinite(pt.tau) ? `${sci(width(pt.tau))} MeV` : "0"],
    ["B   Lₑ   L_μ   L_τ   S", [pt.B, pt.Le, pt.Lm, pt.Lt, pt.S].map(frac).join("    ")],
    ["quarks", pt.quarks ? quarkTxt(pt.quarks) : "— (elementar)"],
    ["decai em", pt.decay],
    ["decaimento por", VIA_LABEL[pt.via]],
  ];
  rows.forEach(([k, v], i) => {
    const y = 6.5 - i * 0.66;
    u.text(k, x, y, { size: 11, align: "left", color: th.muted });
    u.text(v, x + 4.1, y, { size: 11.5, align: "left", weight: k === "decaimento por" ? "700" : "500", color: k === "decaimento por" ? viaColor(d, pt.via) : th.text });
  });
  if (pt.note) u.text(pt.note, x, 6.5 - rows.length * 0.66, { size: 10, align: "left", color: th.muted });

  // voo no laboratório
  const K = num(p, "Kz", 1000);
  const yv = -1.6;
  u.text("Quanto ela voa antes de decair?", x, yv, { size: 13, weight: "700", align: "left" });
  if (pt.m > 0 && Number.isFinite(pt.tau)) {
    const f = decayLength(pt.m, pt.tau, K);
    u.text(`com energia cinética K = ${sci(K)} MeV:  γ = ${sci(f.gamma)},  β = ${fmt(f.beta, 6)}`, x, yv - 0.75, { size: 11, align: "left" });
    u.text(`L = γβcτ = ${sci(f.L)} m`, x, yv - 1.5, { size: 14, align: "left", weight: "700", color: th.accent });
    // régua logarítmica de distâncias
    const r0 = -15;
    const r1 = 7;
    const X = (L: number) => x + 0.2 + ((Math.log10(L) - r0) / (r1 - r0)) * (16.4 - x - 0.4);
    const yr = -5.3;
    d.line(X(1e-15), yr, X(1e7), yr, { color: th.muted, width: 1.5 });
    const marks: [number, string][] = [[1e-15, "núcleo"], [1e-10, "átomo"], [1e-4, "fio de cabelo"], [10, "detector"], [1e4, "cidade"]];
    for (const [L, lab] of marks) {
      d.line(X(L), yr - 0.15, X(L), yr + 0.15, { color: th.muted, width: 1 });
      u.text(lab, X(L), yr - 0.5, { size: 9, color: th.muted });
      u.text(sci(L, 1) + " m", X(L), yr - 0.95, { size: 8, color: th.muted });
    }
    const Lc = clamp(f.L, 1e-15, 1e7);
    d.dot(X(Lc), yr, 7, th.accent);
    d.arrow(X(1e-15), yr + 0.55, X(Lc) - X(1e-15), 0, { color: th.accent, width: 2.5 });
    u.text("escala logarítmica", 16.4, yr + 0.9, { size: 9, align: "right", color: th.muted });
    u.text(f.L > 1e-3 ? "deixa um traço visível no detector" : f.L > 1e-9 ? "voa alguns µm a mm: medido por vértices deslocados" : "decai praticamente onde nasceu: vista só pela largura Γ", x, -7, { size: 10.5, align: "left", color: th.muted });
  } else u.text(pt.via === "confinado" ? "Não existe livre: sempre preso dentro de hádrons." : "Estável (ou sem massa): não decai.", x, yv - 0.8, { size: 11, align: "left", color: th.muted });
  u.text("Clique num cartão ou num ponto do gráfico.", x, -8.6, { size: 10, align: "left", color: th.muted });
}

function zooHit(pt: WorldPoint): string | null {
  for (let r = 0; r < ZOO_ROWS.length; r++)
    for (let i = 0; i < ZOO_ROWS[r]!.ids.length; i++) {
      const b = cardBox(r, i);
      if (pt.x >= b.x && pt.x <= b.x + b.w && pt.y >= b.y && pt.y <= b.y + b.h) return ZOO_ROWS[r]!.ids[i]!;
    }
  if (pt.x >= LT.x0 && pt.x <= LT.x1 && pt.y >= LT.y0 && pt.y <= LT.y1) {
    const tf = (v: number, a: number, b: number) => (Math.log10(v) - Math.log10(a)) / (Math.log10(b) - Math.log10(a));
    let best: string | null = null;
    let bd = 0.6;
    for (const p of PARTICLES) {
      if (!onChart(p)) continue;
      const X = LT.x0 + tf(p.m, LT.mMin, LT.mMax) * (LT.x1 - LT.x0);
      const Y = LT.y0 + tf(p.tau, LT.tMin, LT.tMax) * (LT.y1 - LT.y0);
      const dd = Math.hypot(pt.x - X, pt.y - Y);
      if (dd < bd) [bd, best] = [dd, p.id];
    }
    return best;
  }
  return null;
}

// ------------------------------------------------------------------ tema 1: conservação
const CHIP = { w: 2.05, h: 1.55, plus: 0.62, arrow: 2.1, y: 6.9 };
interface Slot {
  side: 0 | 1;
  i: number;
  x: number;
}
function reactionSlots(s: PState): { slots: Slot[]; arrowX: number; x0: number; x1: number } {
  const nl = Math.max(s.left.length, 1);
  const nr = Math.max(s.right.length, 1);
  const W = (nl + nr) * CHIP.w + (nl - 1 + nr - 1) * CHIP.plus + CHIP.arrow;
  let x = -W / 2;
  const x0 = x;
  const slots: Slot[] = [];
  for (let i = 0; i < nl; i++) {
    slots.push({ side: 0, i, x: x + CHIP.w / 2 });
    x += CHIP.w + (i < nl - 1 ? CHIP.plus : 0);
  }
  const arrowX = x + CHIP.arrow / 2;
  x += CHIP.arrow;
  for (let i = 0; i < nr; i++) {
    slots.push({ side: 1, i, x: x + CHIP.w / 2 });
    x += CHIP.w + (i < nr - 1 ? CHIP.plus : 0);
  }
  return { slots, arrowX, x0, x1: x };
}
const PAL = { x0: -16.3, top: -3.5, w: 3.12, h: 1.5, gap: 0.13, perRow: 10 };
const palBox = (i: number) => {
  const r = Math.floor(i / PAL.perRow);
  const c = i % PAL.perRow;
  return { x: PAL.x0 + c * (PAL.w + PAL.gap), y: PAL.top - (r + 1) * PAL.h - r * PAL.gap, w: PAL.w, h: PAL.h };
};
const parts = (ids: string[]) => ids.map(particle);

function drawConservation(d: Draw, s: PState, p: Params) {
  const th = d.theme;
  const u = ui(d);
  const K = num(p, "Kr", 1000);
  const L = parts(s.left);
  const R = parts(s.right);
  const c = checkReaction(L, R, K);
  u.text("Monte uma reação e confira as leis de conservação", -16.6, 8.9, { size: 15, weight: "700", align: "left" });
  // reação
  const lay = reactionSlots(s);
  const sideBox = (side: 0 | 1) => {
    const ss = lay.slots.filter((t) => t.side === side);
    return { x0: ss[0]!.x - CHIP.w / 2 - 0.15, x1: ss[ss.length - 1]!.x + CHIP.w / 2 + 0.15 };
  };
  for (const side of [0, 1] as const) {
    const b = sideBox(side);
    const act = s.side === side;
    d.rect(b.x0, CHIP.y - CHIP.h / 2 - 0.2, b.x1 - b.x0, CHIP.h + 0.4, { stroke: act ? th.accent : th.grid, width: act ? 2 : 1, dash: act ? [6, 4] : [] });
    u.text(side === 0 ? (act ? "reagentes ◂ adicionando aqui" : "reagentes") : act ? "produtos ◂ adicionando aqui" : "produtos", (b.x0 + b.x1) / 2, CHIP.y + CHIP.h / 2 + 0.5, { size: 10, color: act ? th.accent : th.muted, weight: act ? "700" : "400" });
  }
  for (const sl of lay.slots) {
    const list = sl.side === 0 ? L : R;
    const pt = list[sl.i];
    if (!pt) {
      u.text("?", sl.x, CHIP.y, { size: 20, color: th.muted });
      continue;
    }
    d.rect(sl.x - CHIP.w / 2, CHIP.y - CHIP.h / 2, CHIP.w, CHIP.h, { fill: kindColor(d, pt.kind), alpha: 0.14 });
    u.sym(pt.sym, sl.x, CHIP.y + 0.15, { size: 22 });
    u.text(`${fmt(pt.m, 4)}`, sl.x, CHIP.y - 0.52, { size: 8.5, color: th.muted });
    const last = sl.i === list.length - 1;
    if (!last) u.text("+", sl.x + CHIP.w / 2 + CHIP.plus / 2, CHIP.y, { size: 18 });
  }
  d.arrow(lay.arrowX - 0.75, CHIP.y, 1.5, 0, { color: th.text, width: 2.2 });

  // tabela
  const tx = [-16.4, -9.6, -6.6, -3.6];
  const ty0 = 4.45;
  const dy = 0.72;
  u.text("grandeza", tx[0]!, ty0 + 0.7, { size: 11, align: "left", color: th.muted, weight: "700" });
  u.text("antes", tx[1]!, ty0 + 0.7, { size: 11, color: th.muted, weight: "700" });
  u.text("depois", tx[2]!, ty0 + 0.7, { size: 11, color: th.muted, weight: "700" });
  const mark = (ok: boolean, y: number, warn = false) =>
    u.text(ok ? "✓" : warn ? "!" : "✗", tx[3]!, y, { size: 15, weight: "700", color: ok ? th.series[2]! : warn ? th.series[5]! : th.positive });
  QKEYS.forEach(({ key, label }, i) => {
    const y = ty0 - i * dy;
    const [a, b] = c.sums[key];
    u.text(label, tx[0]!, y, { size: 11.5, align: "left" });
    u.text(frac(a), tx[1]!, y, { size: 12 });
    u.text(frac(b), tx[2]!, y, { size: 12 });
    if (key === "S") {
      const dS = Math.abs(c.dS);
      mark(dS < 1e-9, y, dS > 0.5 && dS < 1.5);
      u.text(dS < 1e-9 ? "" : dS < 1.5 ? "só a fraca muda S (ΔS = ±1)" : "ΔS = ±2: proibido", tx[3]! + 0.5, y, { size: 9.5, align: "left", color: th.muted });
    } else mark(c.conserved[key], y);
  });
  const fermions = (ps: Particle[]) => ps.filter((x) => Math.round(2 * x.spin) % 2 === 1).length;
  const yF = ty0 - QKEYS.length * dy;
  u.text("nº de férmions (spin)", tx[0]!, yF, { size: 11.5, align: "left" });
  u.text(String(fermions(L)), tx[1]!, yF, { size: 12 });
  u.text(String(fermions(R)), tx[2]!, yF, { size: 12 });
  mark(c.spinOk, yF);
  const yE = yF - dy;
  u.text("energia (MeV)", tx[0]!, yE, { size: 11.5, align: "left" });
  u.text(Number.isFinite(c.available) ? fmt(c.available, 5) : "—", tx[1]!, yE, { size: 12 });
  u.text(fmt(c.massOut, 5), tx[2]!, yE, { size: 12 });
  mark(c.energyOk, yE);
  const yN = yE - 0.62;
  const note =
    L.length === 1
      ? `antes: massa de repouso; depois: Σ massas.  Q = ${fmt(c.Q, 4)} MeV vira energia cinética`
      : L.length === 2
        ? `antes: √s com K = ${sci(K)} MeV no projétil (1º) e alvo parado.  K mínimo = ${sci(c.Kth)} MeV`
        : "";
  u.text(note, tx[0]!, yN, { size: 9.5, align: "left", color: th.muted });

  // veredito
  const vx = 3.1;
  const allowed = c.allowed;
  const col = allowed ? th.series[2]! : th.positive;
  d.rect(vx, -0.1, 16.6 - vx, 4.9, { fill: col, alpha: 0.1 });
  d.rect(vx, -0.1, 16.6 - vx, 4.9, { stroke: col, width: 1.5 });
  u.text(allowed ? "PERMITIDA" : "PROIBIDA", vx + 0.4, 4.1, { size: 19, weight: "800", align: "left", color: col });
  if (allowed && c.interaction) {
    const tscale = c.interaction === "forte" ? "~10⁻²³ s" : c.interaction === "eletromagnética" ? "~10⁻¹⁶–10⁻²⁰ s" : "≳ 10⁻¹³ s (lenta)";
    u.text(`pela interação ${c.interaction}`, vx + 0.4, 3.1, { size: 14, weight: "700", align: "left", color: viaColor(d, c.interaction) });
    u.text(`escala de tempo típica: ${tscale}`, vx + 0.4, 2.35, { size: 11, align: "left" });
    const why =
      c.interaction === "fraca"
        ? Math.abs(c.dS) > 0 ? "a estranheza muda: só a fraca troca o sabor dos quarks" : "há neutrinos: só a fraca age sobre eles"
        : c.interaction === "eletromagnética"
          ? "há fótons ou léptons carregados, sem neutrinos e sem mudar S"
          : "só hádrons, estranheza conservada";
    u.text(why, vx + 0.4, 1.6, { size: 10.5, align: "left", color: th.muted });
    u.text(L.length === 1 ? `Q = ${fmt(c.Q, 4)} MeV liberados` : `√s − Σm = ${fmt(c.Q, 4)} MeV sobram como energia cinética no CM`, vx + 0.4, 0.75, { size: 11, align: "left", weight: "600" });
  } else
    c.reasons.slice(0, 4).forEach((r, i) => u.text(`• ${r}`, vx + 0.4, 3.1 - i * 0.72, { size: 11, align: "left" }));

  // vértice animado
  const vxC = 10;
  const vyC = -1.85;
  const ph = (s.clock % 3) / 3;
  const inT = clamp(ph / 0.4, 0, 1);
  const outT = clamp((ph - 0.4) / 0.5, 0, 1);
  L.forEach((pt, i) => {
    const a = L.length === 1 ? 0 : (i === 0 ? 1 : -1) * 0.35;
    const x0 = vxC - 5.5 * Math.cos(a);
    const y0 = vyC + 1.1 * Math.sin(a) * 1.5;
    const xe = x0 + (vxC - x0) * inT;
    const ye = y0 + (vyC - y0) * inT;
    d.line(x0, y0, xe, ye, { color: kindColor(d, pt.kind), width: 2.2, dash: pt.id === "gamma" ? [3, 3] : [] });
    if (inT < 1) u.sym(pt.sym, xe, ye + 0.45, { size: 11 });
  });
  if (inT >= 1 && L.length && R.length) {
    if (allowed)
      R.forEach((pt, i) => {
        const a = R.length === 1 ? 0 : -0.6 + (1.2 * i) / (R.length - 1);
        const len = 5 * outT;
        const xe = vxC + len * Math.cos(a);
        const ye = vyC + len * Math.sin(a) * 0.55;
        d.line(vxC, vyC, xe, ye, { color: kindColor(d, pt.kind), width: 2.2, dash: pt.id === "gamma" ? [3, 3] : [] });
        if (outT > 0.3) u.sym(pt.sym, xe + 0.45, ye, { size: 11, align: "left" });
      });
    else {
      d.line(vxC - 0.5, vyC - 0.5, vxC + 0.5, vyC + 0.5, { color: th.positive, width: 3 });
      d.line(vxC - 0.5, vyC + 0.5, vxC + 0.5, vyC - 0.5, { color: th.positive, width: 3 });
    }
  }
  d.dot(vxC, vyC, 4, th.text);

  // paleta
  u.text("Paleta: clique para adicionar ao lado marcado; clique numa partícula da reação para retirá-la.", -16.3, PAL.top + 0.4, { size: 10.5, align: "left", color: th.muted });
  PALETTE_IDS.forEach((id, i) => {
    const b = palBox(i);
    const pt = particle(id);
    d.rect(b.x, b.y, b.w, b.h, { fill: kindColor(d, pt.kind), alpha: 0.12 });
    d.rect(b.x, b.y, b.w, b.h, { stroke: kindColor(d, pt.kind), width: 1 });
    u.sym(pt.sym, b.x + 0.75, b.y + b.h / 2, { size: 16 });
    u.text(pt.m === 0 ? "0" : fmt(pt.m, 4), b.x + b.w - 0.15, b.y + b.h / 2 + 0.25, { size: 8.5, align: "right", color: th.muted });
    u.text(`Q ${frac(pt.q)}`, b.x + b.w - 0.15, b.y + b.h / 2 - 0.3, { size: 8.5, align: "right", color: th.muted });
  });
}

function conservationDown(s: PState, pt: WorldPoint): PState | undefined {
  for (let i = 0; i < PALETTE_IDS.length; i++) {
    const b = palBox(i);
    if (pt.x >= b.x && pt.x <= b.x + b.w && pt.y >= b.y && pt.y <= b.y + b.h) {
      const id = PALETTE_IDS[i]!;
      if (s.side === 0) return s.left.length < MAX_LEFT ? { ...s, left: [...s.left, id], clock: 0 } : { ...s, left: [s.left[0]!, id], clock: 0 };
      return s.right.length < MAX_RIGHT ? { ...s, right: [...s.right, id], clock: 0 } : s;
    }
  }
  if (Math.abs(pt.y - CHIP.y) < CHIP.h / 2 + 0.3) {
    const lay = reactionSlots(s);
    for (const sl of lay.slots) {
      if (Math.abs(pt.x - sl.x) > CHIP.w / 2) continue;
      const list = sl.side === 0 ? s.left : s.right;
      if (sl.i < list.length) {
        const next = list.filter((_, j) => j !== sl.i);
        return sl.side === 0 ? { ...s, left: next, side: 0, clock: 0 } : { ...s, right: next, side: 1, clock: 0 };
      }
      return { ...s, side: sl.side };
    }
    if (pt.x < lay.arrowX) return { ...s, side: 0 };
    return { ...s, side: 1 };
  }
  return undefined;
}

// ------------------------------------------------------------------ tema 2: caminho óctuplo
const multiplet = (p: Params) => clamp(Math.round(num(p, "multipleto")), 0, 2);
const MULT = [OCTET, DECUPLET, NONET];
const EW = { cx: -8.2, top: 5.6, ux: 4.3, row: 3.75 };
function memberPos(m: MultipletMember, kindIdx: number): [number, number] {
  const Smax = kindIdx === 2 ? 1 : 0;
  let x = EW.cx + m.I3 * EW.ux;
  const y = EW.top - (Smax - m.S) * EW.row;
  // membros no centro do diagrama (mesmo I₃ e S)
  const centre: Record<string, number> = { Sigma0: -0.62, Lambda: 0.62, pi0: -0.85, eta: 0.85, etap: 0 };
  if (m.id in centre && Math.abs(m.I3) < 1e-9) {
    x += centre[m.id]!;
    return [x, y + (m.id === "etap" ? -1.05 : 0.15)];
  }
  return [x, y];
}

function drawEightfold(d: Draw, s: PState, p: Params) {
  const th = d.theme;
  const u = ui(d);
  const k = multiplet(p);
  const members = MULT[k]!;
  const reveal = num(p, "revelar") >= 0.5;
  const titles = ["Octeto dos bárions de spin ½", "Decupleto dos bárions de spin 3/2", "Noneto dos mésons de spin 0"];
  u.text(titles[k]!, -16.6, 8.9, { size: 15, weight: "700", align: "left" });
  u.text("horizontal: isospin I₃ = Q − (B + S)/2   vertical: estranheza S   diagonais: carga Q constante", -16.6, 8.2, { size: 10, align: "left", color: th.muted });
  const Smax = k === 2 ? 1 : 0;
  const Smin = k === 1 ? -3 : k === 0 ? -2 : -1;
  const B = k === 2 ? 0 : 1;
  // linhas de estranheza
  for (let S = Smax; S >= Smin; S--) {
    const y = EW.top - (Smax - S) * EW.row;
    d.line(-15, y, -1.6, y, { color: th.grid, width: 1 });
    u.text(`S = ${frac(S).replace("+", "")}`, -15.3, y, { size: 11, align: "right", color: th.muted });
  }
  // diagonais de carga: I₃ = Q − B/2 − S/2
  for (let Q = -1; Q <= (k === 1 ? 2 : 1); Q++) {
    const xA = EW.cx + (Q - B / 2 - Smax / 2) * EW.ux;
    const xB = EW.cx + (Q - B / 2 - Smin / 2) * EW.ux;
    const yA = EW.top + 0.9;
    const yB = EW.top - (Smax - Smin) * EW.row - 0.9;
    const slope = (xB - xA) / (EW.top - (Smax - Smin) * EW.row - EW.top);
    d.line(xA - slope * 0.9, yA, xB + slope * 0.9, yB, { color: th.series[0]!, width: 1, dash: [5, 4], alpha: 0.55 });
    u.text(`Q = ${frac(Q).replace("+", "")}`, xA - slope * 0.9, yA + 0.35, { size: 10, color: th.series[0]! });
  }
  // membros
  for (const m of members) {
    const pt = particle(m.id);
    const [x, y] = memberPos(m, k);
    const hidden = k === 1 && m.id === "Omega-" && !reveal;
    const sel = s.sel === m.id;
    d.circle(x, y, 0.82, { fill: hidden ? "transparent" : kindColor(d, pt.kind), alpha: hidden ? 1 : sel ? 0.45 : 0.2, stroke: sel ? th.accent : hidden ? th.text : kindColor(d, pt.kind), width: sel ? 2.5 : 1.2, dash: hidden ? [4, 3] : [] });
    if (hidden) {
      u.text("?", x, y + 0.05, { size: 22, weight: "700" });
      u.text(`palpite: ${fmt(num(p, "palpite", 1600), 4)} MeV`, x, y - 1.2, { size: 10, color: th.accent, weight: "600" });
    } else {
      u.sym(pt.sym, x, y + 0.15, { size: 15 });
      u.text(fmt(pt.m, 5), x, y - 0.4, { size: 8.5, color: th.muted });
    }
  }
  // ficha do selecionado
  const sp = particle(s.sel);
  const inMult = members.some((m) => m.id === s.sel) && !(k === 1 && s.sel === "Omega-" && !reveal);
  u.text(
    inMult
      ? `${plainSym(sp.sym)}: ${sp.name}, quarks ${quarkTxt(sp.quarks)}, Q = ${frac(sp.q)}, S = ${frac(sp.S)}, spin ${spinTxt(sp.spin)}, m = ${fmt(sp.m, 6)} MeV/c²`
      : "Clique numa partícula do diagrama para ver o conteúdo de quarks.",
    -16.6,
    -8.9,
    { size: 11, align: "left", color: inMult ? th.text : th.muted, weight: inMult ? "600" : "400" },
  );

  // massas por estranheza
  const box = { x0: 3.4, y0: -6.6, x1: 16.4, y1: 6.2 };
  const ranges = [
    [900, 1400],
    [1150, 1800],
    [0, 1050],
  ][k]!;
  const cols = Smax - Smin + 1;
  const pl = panel(d, box, { min: 0, max: cols }, { min: ranges[0]!, max: ranges[1]! });
  pl.frame({ xticks: [], ylabel: "massa (MeV/c²)", fy: (v) => String(Math.round(v)) });
  u.text("Massas por linha de estranheza", box.x0, box.y1 + 1.4, { size: 13, weight: "700", align: "left" });
  for (let S = Smax; S >= Smin; S--) {
    const c = Smax - S;
    u.text(`S = ${frac(S).replace("+", "")}`, pl.X(c + 0.5), box.y0, { size: 10, dy: 10, color: th.muted });
  }
  const colOf = (S: number) => Smax - S;
  for (const m of members) {
    const pt = particle(m.id);
    const hidden = k === 1 && m.id === "Omega-" && !reveal;
    if (hidden) continue;
    const c = colOf(m.S);
    const jitter = (m.I3 / 1.5) * 0.25;
    d.line(pl.X(c + 0.22 + jitter), pl.Y(pt.m), pl.X(c + 0.78 + jitter), pl.Y(pt.m), { color: kindColor(d, pt.kind), width: 3 });
  }
  if (k === 1) {
    const rows = decupletRows();
    const known = reveal ? rows : rows.slice(0, 3);
    known.forEach((r, i) => {
      const c = colOf(r.S);
      u.text(`${fmt(r.m, 4)}`, pl.X(c + 0.5), pl.Y(r.m), { size: 10, dy: -11, weight: "600" });
      const nx = known[i + 1];
      if (nx) {
        const cx = pl.X(c + 1);
        d.arrow(cx, pl.Y(r.m), 0, pl.Y(nx.m) - pl.Y(r.m), { color: th.series[1]!, width: 1.5, head: 6 });
        u.text(`+${fmt(nx.m - r.m, 3)}`, cx, (pl.Y(r.m) + pl.Y(nx.m)) / 2, { size: 10, align: "left", dx: 4, color: th.series[1]! });
      }
    });
    const guess = num(p, "palpite", 1600);
    const pred = predictOmega();
    d.line(pl.X(3.1), pl.Y(guess), pl.X(3.9), pl.Y(guess), { color: th.accent, width: 2, dash: [5, 3] });
    u.text(`palpite ${fmt(guess, 4)}`, pl.X(3.5), pl.Y(guess), { size: 10, dy: 12, color: th.accent });
    if (reveal) {
      d.line(pl.X(3.1), pl.Y(pred), pl.X(3.9), pl.Y(pred), { color: th.series[4]!, width: 1.5, dash: [2, 2] });
      u.text(`Gell-Mann (espaçamento igual): ${fmt(pred, 4)}  ·  medido: 1672,45`, box.x1, box.y0 + 0.5, { size: 10, align: "right", color: th.series[4]! });
      u.text(`erro do palpite: ${fmt(guess - particle("Omega-").m, 3)} MeV`, box.x1, box.y0 + 1.1, { size: 10.5, align: "right", weight: "700", color: th.accent });
    } else u.text("Os espaçamentos são quase iguais: preveja a massa da linha S = −3.", box.x0 + 0.2, box.y1 - 0.45, { size: 10.5, align: "left", color: th.muted });
  } else if (k === 0) {
    const g = gmoOctet();
    u.text("Gell-Mann–Okubo:  (m_N + m_Ξ)/2 ≈ (3m_Λ + m_Σ)/4", box.x0 + 0.2, box.y1 - 0.45, { size: 10.5, align: "left" });
    u.text(`${fmt(g.lhs, 5)} MeV  ≈  ${fmt(g.rhs, 5)} MeV  (diferença ${fmt((100 * (g.lhs - g.rhs)) / g.rhs, 2)}%)`, box.x0 + 0.2, box.y1 - 1.1, { size: 10.5, align: "left", color: th.accent, weight: "600" });
    u.text("cada quark s acrescenta ~130–190 MeV", box.x0 + 0.2, box.y1 - 1.75, { size: 10, align: "left", color: th.muted });
  } else {
    u.text("π ≈ 137 MeV é leve demais (quase bóson de Goldstone);", box.x0 + 0.2, box.y1 - 0.45, { size: 10, align: "left", color: th.muted });
    u.text("η e η′ misturam uū, dd̄ e ss̄.", box.x0 + 0.2, box.y1 - 1.05, { size: 10, align: "left", color: th.muted });
  }
}

function eightfoldHit(pt: WorldPoint, p: Params): string | null {
  const k = multiplet(p);
  for (const m of MULT[k]!) {
    const [x, y] = memberPos(m, k);
    if (Math.hypot(pt.x - x, pt.y - y) < 0.85) return m.id;
  }
  return null;
}

// ------------------------------------------------------------------ tema 3: quarks
const QBTN = { x0: -15.6, dx: 2.3, y0: 6.6, y1: 4.4, r: 0.85 };
const qbtn = (i: number): [number, number] => [QBTN.x0 + (i % 4) * QBTN.dx, i < 4 ? QBTN.y0 : QBTN.y1];
const BAG = { cx: -10.6, cy: -3.4, r: 4.2 };
const COLORS = ["#e0483e", "#2fa84f", "#2f6fd9"];
const ANTICOLORS = ["#21c4cf", "#d23fc4", "#e7c02a"];
const COLOR_NAMES = ["vermelho", "verde", "azul"];
function bagPos(n: number, i: number): [number, number] {
  if (n === 1) return [BAG.cx, BAG.cy];
  if (n === 2) return [BAG.cx + (i === 0 ? -1.7 : 1.7), BAG.cy];
  const a = Math.PI / 2 + (2 * Math.PI * i) / 3;
  return [BAG.cx + 2 * Math.cos(a), BAG.cy + 2 * Math.sin(a)];
}
const aligned = (p: Params) => num(p, "spinAlinhado") >= 0.5;
const COMBOS: { label: string; toks: QuarkTok[] }[] = [
  { label: "próton (uud)", toks: [{ f: "u", bar: false }, { f: "u", bar: false }, { f: "d", bar: false }] },
  { label: "nêutron (udd)", toks: [{ f: "u", bar: false }, { f: "d", bar: false }, { f: "d", bar: false }] },
  { label: "píon π⁺ (ud̄)", toks: [{ f: "u", bar: false }, { f: "d", bar: true }] },
  { label: "Ω⁻ (sss)", toks: [{ f: "s", bar: false }, { f: "s", bar: false }, { f: "s", bar: false }] },
  { label: "sacola vazia", toks: [] },
];

function drawQuarks(d: Draw, s: PState, p: Params) {
  const th = d.theme;
  const u = ui(d);
  u.text("Monte hádrons com quarks e antiquarks", -16.6, 8.9, { size: 15, weight: "700", align: "left" });
  u.text("quarks", QBTN.x0 - 0.9, QBTN.y0 + 1.25, { size: 10, align: "left", color: th.muted });
  u.text("antiquarks", QBTN.x0 - 0.9, QBTN.y1 + 1.25, { size: 10, align: "left", color: th.muted });
  for (let i = 0; i < 8; i++) {
    const f = FLAVORS[i % 4]!;
    const bar = i >= 4;
    const [x, y] = qbtn(i);
    d.circle(x, y, QBTN.r, { fill: th.series[3]!, alpha: bar ? 0.1 : 0.22, stroke: th.series[3]!, width: 1.2, dash: bar ? [4, 3] : [] });
    u.sym(bar ? `~${f}` : f, x - 0.05, y + 0.12, { size: 18 });
    u.text(`${frac((bar ? -1 : 1) * QUARK_Q[f])}`, x, y - 0.5, { size: 8.5, color: th.muted });
  }
  u.text("massas de corrente: u 2,2  d 4,7  s 94  c 1273 MeV/c²", QBTN.x0 - 0.9, QBTN.y1 - 1.45, { size: 9.5, align: "left", color: th.muted });

  // sacola
  const r = build(s.bag, aligned(p));
  d.circle(BAG.cx, BAG.cy, BAG.r, { fill: th.muted, alpha: 0.06, stroke: r.colorless ? th.series[2]! : th.positive, width: 2, dash: [8, 5] });
  u.text("sacola (clique num quark para retirá-lo)", BAG.cx, BAG.cy - BAG.r - 0.45, { size: 10, color: th.muted });
  const n = s.bag.length;
  const rot = Math.floor(s.clock / 0.9);
  const ph = (s.clock % 0.9) / 0.9;
  // glúons entre os quarks
  if (n >= 2)
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++) {
        if (n === 2 && j > 1) continue;
        const [x1, y1] = bagPos(n, i);
        const [x2, y2] = bagPos(n, j);
        d.spring(x1, y1, x2, y2, { color: th.series[5]!, width: 1.5, coils: 7, amplitudePx: 5, alpha: 0.7 });
      }
  s.bag.forEach((t, i) => {
    const [x, y] = bagPos(n, i);
    const ci = n === 3 ? (i + rot) % 3 : rot % 3;
    const col = t.bar ? ANTICOLORS[ci]! : COLORS[ci]!;
    d.circle(x, y, 0.95, { fill: col, alpha: 0.9, stroke: th.text, width: 1, dash: t.bar ? [3, 2] : [] });
    u.sym(t.bar ? `~${t.f}` : t.f, x - 0.05, y + 0.1, { size: 18, color: "#ffffff" });
  });
  if (n >= 2 && ph < 0.3) u.text("troca de glúon: as cores mudam, o total segue branco", BAG.cx, BAG.cy + BAG.r + 0.4, { size: 10, color: th.series[5]! });
  else if (n === 3 && !s.bag.some((t) => t.bar)) u.text(`cores: ${[0, 1, 2].map((i) => COLOR_NAMES[(i + rot) % 3]).join(" + ")} = branco`, BAG.cx, BAG.cy + BAG.r + 0.4, { size: 10, color: th.muted });

  // resultado
  const x = 1.4;
  const h = r.hadron;
  const kindTxt = { barion: "bárion", antibarion: "antibárion", meson: "méson", nenhum: n ? "não é hádron" : "—" }[r.kind];
  d.rect(x - 0.3, -9.2, 16.8 - x + 0.2, 18.4, { fill: r.colorless && h ? th.series[2]! : r.colorless ? th.muted : th.positive, alpha: 0.06 });
  if (h) {
    u.sym(h.sym, x + 0.2, 7.6, { size: 34, align: "left" });
    u.text(h.name, x + 3.6, 8.0, { size: 16, weight: "700", align: "left" });
    u.text(`${kindTxt}, spin ${spinTxt(h.spin)}`, x + 3.6, 7.25, { size: 11.5, align: "left", color: th.series[2]!, weight: "600" });
  } else u.text(kindTxt, x + 0.2, 7.6, { size: 20, weight: "700", align: "left", color: n ? th.positive : th.muted });
  const lines = r.message.length > 64 ? splitLine(r.message, 64) : [r.message];
  lines.forEach((l, i) => u.text(l, x + 0.2, 6.2 - i * 0.6, { size: 10.5, align: "left", color: th.muted }));
  if (h?.note) u.text(h.note, x + 0.2, 6.2 - lines.length * 0.6, { size: 10, align: "left", color: th.muted });
  const rows: [string, string][] = [
    ["carga Q (soma das cargas)", `${frac(r.q)} e`],
    ["número bariônico B", frac(r.B)],
    ["estranheza S", frac(r.S)],
    ["charme C", frac(r.C)],
    ["cor total", r.colorless ? "branca (singleto de cor)" : "colorida: não pode existir livre"],
  ];
  rows.forEach(([kk, v], i) => {
    const y = 3.9 - i * 0.68;
    u.text(kk, x + 0.2, y, { size: 11.5, align: "left", color: th.muted });
    u.text(v, x + 7.6, y, { size: 12, align: "left", weight: "600", color: kk === "cor total" ? (r.colorless ? th.series[2]! : th.positive) : th.text });
  });
  // de onde vem a massa
  const yb = -1.5;
  u.text("De onde vem a massa?", x + 0.2, yb, { size: 13, weight: "700", align: "left" });
  if (h) {
    const W = 16.4 - x - 0.4;
    const frq = r.quarkMass / h.m;
    d.rect(x + 0.2, yb - 1.6, W, 0.8, { fill: th.series[5]!, alpha: 0.35 });
    d.rect(x + 0.2, yb - 1.6, Math.max(W * Math.min(frq, 1), d.px * 2), 0.8, { fill: th.series[3]! });
    u.text(`massa do hádron: ${fmt(h.m, 5)} MeV/c²`, x + 0.2, yb - 0.55, { size: 11, align: "left" });
    u.text(`soma das massas dos quarks: ${fmt(r.quarkMass, 4)} MeV/c²  →  ${fmt(100 * frq, 3)}%`, x + 0.2, yb - 2.3, { size: 11, align: "left", color: th.series[3]!, weight: "600" });
    u.text(`o resto (${fmt(100 * (1 - Math.min(frq, 1)), 3)}%) é energia dos glúons e do movimento dos quarks: E = mc²`, x + 0.2, yb - 2.95, { size: 10.5, align: "left", color: th.muted });
  } else u.text("Monte um hádron para comparar a massa dele com a dos quarks.", x + 0.2, yb - 0.8, { size: 10.5, align: "left", color: th.muted });
  u.text(aligned(p) ? "spins alinhados: bárions de spin 3/2 e mésons de spin 1" : "spins opostos: bárions de spin ½ e mésons de spin 0", x + 0.2, -6.1, { size: 10.5, align: "left" });
  u.text("cores: quark vermelho, verde ou azul; antiquark com a anticor (ciano, magenta, amarelo)", x + 0.2, -6.8, { size: 9.5, align: "left", color: th.muted });
}

function splitLine(t: string, n: number): string[] {
  const out: string[] = [];
  let cur = "";
  for (const w of t.split(" ")) {
    if ((cur + " " + w).trim().length > n) {
      out.push(cur.trim());
      cur = w;
    } else cur += " " + w;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

function quarksDown(s: PState, pt: WorldPoint): PState | undefined {
  for (let i = 0; i < 8; i++) {
    const [x, y] = qbtn(i);
    if (Math.hypot(pt.x - x, pt.y - y) < QBTN.r) {
      if (s.bag.length >= 3) return { ...s, bag: [...s.bag.slice(1), { f: FLAVORS[i % 4] as Flavor, bar: i >= 4 }] };
      return { ...s, bag: [...s.bag, { f: FLAVORS[i % 4] as Flavor, bar: i >= 4 }] };
    }
  }
  for (let i = 0; i < s.bag.length; i++) {
    const [x, y] = bagPos(s.bag.length, i);
    if (Math.hypot(pt.x - x, pt.y - y) < 1) return { ...s, bag: s.bag.filter((_, j) => j !== i) };
  }
  return undefined;
}

// ------------------------------------------------------------------ tema 4: aniquilação e produção de pares
const proc = (p: Params) => Math.round(num(p, "processo"));
const TARGETS = [
  { label: "núcleo de chumbo (²⁰⁸Pb)", M: 207.976652 * U_MEV - 82 * ME },
  { label: "núcleo de carbono (¹²C)", M: 12 * U_MEV - 6 * ME },
  { label: "nenhum (fóton no vácuo)", M: 0 },
];
const target = (p: Params) => TARGETS[clamp(Math.round(num(p, "alvo")), 0, 2)]!;
export const annFor = (p: Params) => annihilation(num(p, "Ke", 0), rad(num(p, "thetaCM", 60)));
export const pairFor = (p: Params) => pairProduction(num(p, "Eg", 5), target(p).M, rad(num(p, "abertura", 15)), num(p, "fracao", 0.5));

/** Linha ondulada (fóton) de (x0,y0) até (x1,y1), com comprimento de onda em unidades do mundo. */
function photon(d: Draw, x0: number, y0: number, x1: number, y1: number, lambda: number, color: string) {
  const L = Math.hypot(x1 - x0, y1 - y0);
  if (L < 1e-6) return;
  const ux = (x1 - x0) / L;
  const uy = (y1 - y0) / L;
  const n = Math.max(20, Math.ceil((L / lambda) * 14));
  const pts: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const sx = (L * i) / n;
    const a = 0.22 * Math.sin((2 * Math.PI * sx) / lambda);
    pts.push([x0 + ux * sx - uy * a, y0 + uy * sx + ux * a]);
  }
  d.polyline(pts, { color, width: 2 });
}

function drawAnnihilation(d: Draw, s: PState, p: Params) {
  const th = d.theme;
  const u = ui(d);
  const pairMode = proc(p) === 1;
  const box = { x0: -16.6, x1: 1.6, y0: -8.6, y1: 7.6 };
  d.rect(box.x0, box.y0, box.x1 - box.x0, box.y1 - box.y0, { stroke: th.grid, width: 1 });
  const vx = -6.6;
  const vy = 0;
  d.line(box.x0, vy, box.x1, vy, { color: th.grid, width: 1, dash: [6, 5] });
  u.text("eixo do feixe (laboratório)", box.x1 - 0.2, vy + 0.35, { size: 9, align: "right", color: th.muted });
  const T = 4;
  const ph = (s.clock % T) / T;
  const tin = clamp(ph / 0.35, 0, 1);
  const tout = clamp((ph - 0.35) / 0.6, 0, 1);
  const xr = box.x1 - vx - 0.4;
  if (!pairMode) {
    const K = num(p, "Ke", 0);
    const a = annFor(p);
    u.text("Aniquilação  e⁺ + e⁻ → γ + γ", -16.6, 8.9, { size: 15, weight: "700", align: "left" });
    if (tin < 1) {
      const xp = box.x0 + 0.6 + (vx - box.x0 - 0.6) * tin;
      d.dot(vx, vy, 7, th.negative);
      u.text("e⁻ (parado)", vx, vy - 0.75, { size: 10, color: th.negative });
      d.dot(xp, vy, 7, th.positive);
      u.text(K > 0 ? `e⁺  K = ${fmt(K, 3)} MeV` : "e⁺ (quase parado)", xp, vy + 0.75, { size: 10, color: th.positive });
      if (K > 0) d.arrowPx(xp + 0.3, vy, 1, 0, 30, { color: th.positive });
    } else {
      if (tout < 0.25) d.circle(vx, vy, 0.3 + 3 * tout, { stroke: th.series[5]!, width: 2.5, alpha: 1 - tout / 0.25 });
      for (const [g, lab] of [[a.g1, "γ₁"], [a.g2, "γ₂"]] as const) {
        const len = xr * tout;
        const ex = vx + len * Math.cos(g.th);
        const ey = vy + len * Math.sin(g.th);
        const lam = clamp(0.9 / g.E, 0.18, 3);
        photon(d, vx, vy, ex, ey, lam, th.series[5]!);
        if (tout > 0.35) u.text(`${lab}: ${fmt(g.E, 4)} MeV, ${fmt(deg(g.th), 3)}°`, ex, ey + (Math.sin(g.th) >= 0 ? 0.5 : -0.5), { size: 10.5, weight: "600" });
      }
    }
    u.text(`ângulo dos fótons no referencial do CM: θ* = ${fmt(num(p, "thetaCM", 60), 3)}° (γ₂ sai a θ* + 180°)`, box.x0 + 0.3, box.y0 + 0.5, { size: 9.5, align: "left", color: th.muted });
    // diagrama de momentos
    drawMomentum(d, [{ v: [a.pBeam, 0], label: "p(e⁺)", color: th.positive }], [
      { v: [a.g1.E * Math.cos(a.g1.th), a.g1.E * Math.sin(a.g1.th)], label: "p(γ₁)", color: th.series[5]! },
      { v: [a.g2.E * Math.cos(a.g2.th), a.g2.E * Math.sin(a.g2.th)], label: "p(γ₂)", color: th.series[1]! },
    ]);
    const Ein = K + 2 * ME;
    const Eout = a.g1.E + a.g2.E;
    drawEnergyBars(d, [["mc² (e⁻)", ME, th.negative], ["mc² (e⁺)", ME, th.positive], ["K (e⁺)", K, th.series[0]!]], [["E(γ₁)", a.g1.E, th.series[5]!], ["E(γ₂)", a.g2.E, th.series[1]!]]);
    const x = 2.8;
    u.text(`√s = ${fmt(a.s, 5)} MeV   v(CM) = ${fmt(a.beta, 4)} c   abertura entre os fótons = ${fmt(deg(Math.abs(a.g1.th - a.g2.th)) % 360, 4)}°`, x, -7.6, { size: 10.5, align: "left" });
    u.text(`energia: ${fmt(Ein, 6)} MeV antes  =  ${fmt(Eout, 6)} MeV depois`, x, -8.3, { size: 10.5, align: "left", color: th.series[2]!, weight: "600" });
    u.text(K === 0 ? "parado: dois fótons de 511 keV em sentidos opostos (é o sinal da PET)" : "um único fóton não basta: E = pc dele não fecha energia e momento", x, -9.0, { size: 9.5, align: "left", color: th.muted });
  } else {
    const Eg = num(p, "Eg", 5);
    const tg = target(p);
    u.text("Produção de pares  γ + núcleo → e⁻ + e⁺ + núcleo", -16.6, 8.9, { size: 15, weight: "700", align: "left" });
    const pr = pairFor(p);
    const thr = pairThreshold(tg.M);
    if (tin < 1 || !pr.ok) {
      const xe = box.x0 + 0.6 + (vx - box.x0 - 0.6) * (pr.ok ? tin : Math.min(1, ph * 1.6));
      photon(d, box.x0 + 0.6, vy, tg.M > 0 ? xe : box.x0 + 0.6 + (box.x1 - box.x0 - 1.2) * ph, vy, clamp(0.9 / Eg, 0.18, 3), th.series[5]!);
    }
    if (tg.M > 0) {
      d.circle(vx, vy, 0.55, { fill: th.muted, alpha: 0.85 });
      u.text(tg.M > 1e5 ? "Pb" : "C", vx, vy, { size: 10, color: "#ffffff", weight: "700" });
    }
    if (!pr.ok) {
      const msg =
        tg.M === 0
          ? ["Sem núcleo, γ → e⁺e⁻ é impossível:", "o fóton tem E = pc, mas o par sempre tem E > pc", "(massa invariante 0 antes, ≥ 2mc² depois)."]
          : [`Abaixo do limiar: E_γ precisa ser ≥ ${fmt(thr, 5)} MeV`, "= 2mc²(1 + m/M)."];
      msg.forEach((m, i) => u.text(m, (box.x0 + box.x1) / 2, -3 - i * 0.65, { size: 11, color: th.positive, weight: i === 0 ? "700" : "400" }));
    } else {
      const pe = (E: number) => Math.sqrt(E * E - ME * ME);
      const ab = rad(num(p, "abertura", 15));
      const len = xr * tout;
      const pm = pe(pr.Em);
      const pp = pe(pr.Ep);
      const pmax = Math.max(pm, pp, 1e-9);
      if (tout < 0.25) d.circle(vx, vy, 0.3 + 3 * tout, { stroke: th.series[5]!, width: 2.5, alpha: 1 - tout / 0.25 });
      const tr = (pmom: number, ang: number, col: string, lab: string, E: number) => {
        const l = len * (0.35 + 0.65 * (pmom / pmax));
        const ex = vx + l * Math.cos(ang);
        const ey = vy + l * Math.sin(ang);
        d.line(vx, vy, ex, ey, { color: col, width: 2.5 });
        d.dot(ex, ey, 5, col);
        if (tout > 0.35) u.text(`${lab}: K = ${fmt(E - ME, 4)} MeV`, ex, ey + (ang > 0 ? 0.55 : -0.55), { size: 10.5, weight: "600", color: col });
      };
      tr(pm, ab, th.negative, "e⁻", pr.Em);
      tr(pp, -ab, th.positive, "e⁺", pr.Ep);
      const q = Math.hypot(pr.q[0], pr.q[1]);
      if (tout > 0.2) d.arrowPx(vx, vy, pr.q[0], pr.q[1], 40, { color: th.text, width: 2 });
      if (tout > 0.35) u.text(`núcleo: p = ${fmt(q, 3)} MeV/c, K = ${sci(pr.TN, 2)} MeV`, vx, vy - 1.3, { size: 10, color: th.muted });
    }
    if (pr.ok) {
      drawMomentum(d, [{ v: [Eg, 0], label: "p(γ)", color: th.series[5]! }], [
        { v: [Math.sqrt(pr.Em ** 2 - ME * ME) * Math.cos(rad(num(p, "abertura", 15))), Math.sqrt(pr.Em ** 2 - ME * ME) * Math.sin(rad(num(p, "abertura", 15)))], label: "p(e⁻)", color: th.negative },
        { v: [Math.sqrt(pr.Ep ** 2 - ME * ME) * Math.cos(rad(num(p, "abertura", 15))), -Math.sqrt(pr.Ep ** 2 - ME * ME) * Math.sin(rad(num(p, "abertura", 15)))], label: "p(e⁺)", color: th.positive },
        { v: pr.q, label: "p(núcleo)", color: th.text },
      ]);
      drawEnergyBars(d, [["E(γ)", Eg, th.series[5]!]], [
        ["2mc²", 2 * ME, th.series[4]!],
        ["K(e⁻)", pr.Em - ME, th.negative],
        ["K(e⁺)", pr.Ep - ME, th.positive],
        ["K(núcleo)", pr.TN, th.text],
      ]);
    }
    const x = 2.8;
    u.text(`limiar: E_γ ≥ 2mc²(1 + m/M) = ${tg.M > 0 ? fmt(thr, 6) + " MeV" : "∞ (sem alvo)"}`, x, -7.6, { size: 10.5, align: "left" });
    u.text(pr.ok ? `energia: ${fmt(Eg, 6)} MeV = 2mc² + K(e⁻) + K(e⁺) + K(núcleo)` : `E_γ = ${fmt(Eg, 4)} MeV`, x, -8.3, { size: 10.5, align: "left", color: th.series[2]!, weight: "600" });
    u.text("o núcleo leva momento, mas quase nenhuma energia: K = q²/2M", x, -9.0, { size: 9.5, align: "left", color: th.muted });
  }
}

interface Vec {
  v: [number, number];
  label: string;
  color: string;
}
/** Diagrama de momentos: os vetores de antes e de depois, encadeados ponta a cauda. */
function drawMomentum(d: Draw, before: Vec[], after: Vec[]) {
  const th = d.theme;
  const u = ui(d);
  const box = { x0: 2.8, x1: 16.6, y0: 1.2, y1: 7.6 };
  u.text("Momento: soma antes = soma depois", box.x0, 8.25, { size: 12, weight: "700", align: "left" });
  const sum = (vs: Vec[]) => vs.reduce<[number, number]>((a, b) => [a[0] + b.v[0], a[1] + b.v[1]], [0, 0]);
  const pts: [number, number][] = [[0, 0]];
  let acc: [number, number] = [0, 0];
  for (const v of after) {
    acc = [acc[0] + v.v[0], acc[1] + v.v[1]];
    pts.push(acc);
  }
  const P = sum(before);
  pts.push(P);
  const xs = pts.map((q) => q[0]);
  const ys = pts.map((q) => q[1]);
  const xmin = Math.min(...xs, 0);
  const xmax = Math.max(...xs, 1e-9);
  const ymin = Math.min(...ys, 0);
  const ymax = Math.max(...ys, 0);
  const sc = Math.min((box.x1 - box.x0 - 1) / Math.max(xmax - xmin, 1e-9), (box.y1 - box.y0 - 1.2) / Math.max(ymax - ymin, 1e-9));
  const ox = box.x0 + 0.5 - xmin * sc;
  const oy = (box.y0 + box.y1) / 2 - ((ymin + ymax) / 2) * sc;
  // antes
  let a: [number, number] = [0, 0];
  for (const v of before) {
    d.arrow(ox + a[0] * sc, oy + a[1] * sc, v.v[0] * sc, v.v[1] * sc, { color: v.color, width: 3.5, alpha: 0.45 });
    u.text(v.label + " (antes)", ox + (a[0] + v.v[0] / 2) * sc, oy + a[1] * sc, { size: 10, dy: 11, color: v.color });
    a = [a[0] + v.v[0], a[1] + v.v[1]];
  }
  a = [0, 0];
  for (const v of after) {
    const len = Math.hypot(v.v[0], v.v[1]) * sc;
    if (len > 2 * d.px) d.arrow(ox + a[0] * sc, oy + a[1] * sc, v.v[0] * sc, v.v[1] * sc, { color: v.color, width: 2 });
    u.text(v.label, ox + (a[0] + v.v[0] / 2) * sc, oy + (a[1] + v.v[1] / 2) * sc, { size: 10, dx: 0, dy: -11, color: v.color, weight: "600" });
    a = [a[0] + v.v[0], a[1] + v.v[1]];
  }
  const err = Math.hypot(a[0] - P[0], a[1] - P[1]);
  u.text(`|Σp depois − Σp antes| = ${sci(err, 2)} MeV/c`, box.x1, box.y0 - 0.35, { size: 9.5, align: "right", color: th.muted });
}

function drawEnergyBars(d: Draw, before: [string, number, string][], after: [string, number, string][]) {
  const th = d.theme;
  const u = ui(d);
  const box = { x0: 6.2, x1: 16.4, y: [-1.6, -4.4] };
  u.text("Energia (MeV)", 2.8, -0.2, { size: 12, weight: "700", align: "left" });
  const tot = Math.max(before.reduce((a, b) => a + b[1], 0), after.reduce((a, b) => a + b[1], 0), 1e-9);
  const W = box.x1 - box.x0;
  [before, after].forEach((list, r) => {
    const y = box.y[r]!;
    u.text(r === 0 ? "antes" : "depois", box.x0 - 0.3, y, { size: 11, align: "right", color: th.muted });
    let x = box.x0;
    list.forEach(([lab, v, col], i) => {
      const w = (v / tot) * W;
      d.rect(x, y - 0.5, Math.max(w, 0), 1, { fill: col, alpha: 0.75 });
      if (w > 1.3) u.text(lab, x + w / 2, y + 0.05, { size: 9, color: th.dark ? "#10151c" : "#ffffff", weight: "700" });
      else if (v > 0) u.text(lab, x + w / 2, y - 0.85 - (i % 2) * 0.45, { size: 8.5, color: col });
      x += w;
    });
    u.text(fmt(list.reduce((a, b) => a + b[1], 0), 5), box.x1, y + 0.8, { size: 10, align: "right", weight: "600" });
  });
}

// ------------------------------------------------------------------ simulação

const COMBO_OPTIONS = COMBOS.map((c, i) => ({ value: i, label: c.label }));

export const particulasElementares = defineSim<PState>({
  id: "particulas-elementares",
  title: "Partículas elementares: léptons, hádrons e quarks",
  course: "FG IV",
  topic: "Partículas",
  priority: "P1",
  summary:
    "Catálogo interativo de léptons, quarks, hádrons e bósons com dados do PDG; bancada de reações que confere carga, número bariônico, números leptônicos, estranheza, spin e energia e diz qual interação as permite; caminho óctuplo com a previsão do Ω⁻; montagem de hádrons com quarks e cor; e aniquilação e⁺e⁻ e produção de pares com energia e momento conservados.",
  derivation,
  equations: [
    String.raw`\sum Q,\ \sum B,\ \sum L_e,\ \sum L_\mu,\ \sum L_\tau \ \text{conservados sempre;}\quad \Delta S = 0 \text{ (forte, EM)},\ |\Delta S| \le 1 \text{ (fraca)}`,
    String.raw`Q = \left(m_{\text{pai}} - \textstyle\sum m_{\text{produtos}}\right)c^2 \qquad \sqrt{s} = \sqrt{m_1^2c^4 + m_2^2c^4 + 2m_2c^2E_1}`,
    String.raw`K_{\text{lim}} = \frac{\left(\sum m_f\right)^2 - (m_1 + m_2)^2}{2m_2}\,c^2 \qquad L = \gamma\beta c\tau,\ \ \Gamma = \hbar/\tau`,
    String.raw`S = -(n_s - n_{\bar s}) \qquad Q = I_3 + \tfrac{B + S}{2} \qquad m_\Omega \approx m_{\Xi^*} + \tfrac{m_{\Xi^*} - m_\Delta}{2}`,
    String.raw`e^+e^- \to \gamma\gamma:\ E^* = \tfrac{\sqrt s}{2},\ E_{1,2} = \gamma E^*(1 \pm \beta\cos\theta^*) \qquad \gamma \to e^+e^-:\ E_\gamma \ge 2m_ec^2\left(1 + \tfrac{m_e}{M}\right)`,
  ],
  liveEquations(s, p) {
    const tm = theme(p);
    if (tm === 0) {
      const pt = particle(s.sel);
      if (!(pt.m > 0) || !Number.isFinite(pt.tau)) return [String.raw`${texSym(pt.sym)}:\ m = ${texNum(pt.m, 5)}\ \text{MeV}/c^2,\ \text{não decai livre}`];
      const f = decayLength(pt.m, pt.tau, num(p, "Kz", 1000));
      return [
        String.raw`${texSym(pt.sym)}:\ \Gamma = \frac{\hbar}{\tau} = \frac{6{,}582\times10^{-22}\ \text{MeV·s}}{${texNum(pt.tau)}\ \text{s}} = ${texNum(width(pt.tau))}\ \text{MeV}`,
        String.raw`\gamma = 1 + \frac{K}{mc^2} = ${texNum(f.gamma, 4)} \qquad L = \gamma\beta c\tau = ${texNum(f.L)}\ \text{m}`,
      ];
    }
    if (tm === 1) {
      const L = parts(s.left);
      const R = parts(s.right);
      const c = checkReaction(L, R, num(p, "Kr", 1000));
      const side = (ps: Particle[]) => (ps.length ? ps.map((x) => texSym(x.sym)).join(" + ") : "?");
      const out = [String.raw`${side(L)} \to ${side(R)}`];
      out.push(QKEYS.map(({ key, tex }) => String.raw`\Delta ${tex} = ${texNum(c.sums[key][1] - c.sums[key][0], 3)}`).join(",\\ "));
      if (L.length === 1) out.push(String.raw`Q = ${texNum(c.available, 6)} - ${texNum(c.massOut, 6)} = ${texNum(c.Q, 4)}\ \text{MeV}`);
      else if (L.length === 2) out.push(String.raw`\sqrt{s} = ${texNum(c.available, 5)}\ \text{MeV} \qquad K_\text{lim} = ${texNum(c.Kth, 4)}\ \text{MeV}`);
      return out;
    }
    if (tm === 2) {
      if (multiplet(p) === 1) {
        const r = decupletRows();
        return [String.raw`m_\Omega \approx ${texNum(r[2]!.m, 5)} + \frac{${texNum(r[2]!.m, 5)} - ${texNum(r[0]!.m, 5)}}{2} = ${texNum(predictOmega(), 5)}\ \text{MeV} \quad (\text{medido: } 1672{,}45)`];
      }
      const g = gmoOctet();
      return [String.raw`\frac{m_N + m_\Xi}{2} = ${texNum(g.lhs, 5)}\ \text{MeV} \qquad \frac{3m_\Lambda + m_\Sigma}{4} = ${texNum(g.rhs, 5)}\ \text{MeV}`];
    }
    if (tm === 3) {
      const r = build(s.bag, aligned(p));
      const qs = s.bag.map((t) => (t.bar ? String.raw`\bar{${t.f}}` : t.f)).join("");
      return [
        String.raw`${qs || "\\varnothing"}:\ Q = ${texNum(r.q, 3)}\,e,\ B = ${texNum(r.B, 3)},\ S = ${texNum(r.S, 3)}` + (r.hadron ? String.raw` \ \Rightarrow\ ${texSym(r.hadron.sym)}\ (${texNum(r.hadron.m, 5)}\ \text{MeV}/c^2)` : ""),
      ];
    }
    if (proc(p) === 0) {
      const a = annFor(p);
      return [
        String.raw`\sqrt{s} = \sqrt{2m_e^2c^4 + 2m_ec^2E_+} = ${texNum(a.s, 5)}\ \text{MeV} \qquad \beta_\text{CM} = ${texNum(a.beta, 4)}`,
        String.raw`E_1 = ${texNum(a.g1.E, 5)},\ E_2 = ${texNum(a.g2.E, 5)}\ \text{MeV} \qquad E_1 + E_2 = ${texNum(a.g1.E + a.g2.E, 6)}\ \text{MeV}`,
      ];
    }
    const tg = target(p);
    return [String.raw`E_{\gamma,\text{lim}} = 2m_ec^2\left(1 + \frac{m_e}{M}\right) = ${tg.M > 0 ? texNum(pairThreshold(tg.M), 6) + String.raw`\ \text{MeV}` : String.raw`\infty`} \qquad E_\gamma = ${texNum(num(p, "Eg", 5), 4)}\ \text{MeV}`];
  },
  params: [
    {
      key: "tema",
      label: "Tema",
      unit: "",
      min: 0,
      max: 4,
      step: 1,
      default: 0,
      options: [
        { value: 0, label: "Catálogo de partículas" },
        { value: 1, label: "Leis de conservação" },
        { value: 2, label: "Caminho óctuplo" },
        { value: 3, label: "Quarks e cor" },
        { value: 4, label: "Aniquilação e produção de pares" },
      ],
    },
    { key: "Kz", label: "Energia cinética da partícula (catálogo)", unit: "MeV", min: 0.01, max: 1e6, step: 0.01, default: 1000, log: true, live: true },
    { key: "reacao", label: "Reação de partida", unit: "", min: 0, max: REACTIONS.length - 1, step: 1, default: 0, options: REACTIONS.map((r, i) => ({ value: i, label: r.label })) },
    { key: "Kr", label: "Energia cinética do projétil (colisões)", unit: "MeV", min: 0, max: 1e5, step: 1, default: 1000, live: true },
    {
      key: "multipleto",
      label: "Multipleto",
      unit: "",
      min: 0,
      max: 2,
      step: 1,
      default: 0,
      live: true,
      options: [
        { value: 0, label: "Octeto bariônico (spin ½)" },
        { value: 1, label: "Decupleto bariônico (spin 3/2)" },
        { value: 2, label: "Noneto de mésons (spin 0)" },
      ],
    },
    { key: "palpite", label: "Seu palpite para a massa do Ω⁻", unit: "MeV", min: 1500, max: 1850, step: 1, default: 1600, live: true },
    { key: "revelar", label: "Revelar o Ω⁻", unit: "", min: 0, max: 1, step: 1, default: 0, live: true, options: [{ value: 0, label: "Não" }, { value: 1, label: "Sim" }] },
    { key: "combo", label: "Sacola inicial", unit: "", min: 0, max: COMBOS.length - 1, step: 1, default: 0, options: COMBO_OPTIONS },
    { key: "spinAlinhado", label: "Spins dos quarks", unit: "", min: 0, max: 1, step: 1, default: 0, live: true, options: [{ value: 0, label: "Opostos (spin ½ ou 0)" }, { value: 1, label: "Alinhados (spin 3/2 ou 1)" }] },
    { key: "processo", label: "Processo", unit: "", min: 0, max: 1, step: 1, default: 0, live: true, options: [{ value: 0, label: "Aniquilação e⁺e⁻ → γγ" }, { value: 1, label: "Produção de pares γ → e⁺e⁻" }] },
    { key: "Ke", label: "Energia cinética do pósitron", unit: "MeV", min: 0, max: 20, step: 0.01, default: 0, live: true },
    { key: "thetaCM", label: "Ângulo dos fótons no CM θ*", unit: "°", min: 0, max: 180, step: 1, default: 60, live: true },
    { key: "Eg", label: "Energia do fóton", unit: "MeV", min: 0.5, max: 30, step: 0.01, default: 5, live: true },
    { key: "alvo", label: "Alvo", unit: "", min: 0, max: 2, step: 1, default: 0, live: true, options: TARGETS.map((t, i) => ({ value: i, label: t.label })) },
    { key: "abertura", label: "Ângulo de cada lépton com o feixe", unit: "°", min: 1, max: 60, step: 0.5, default: 12, live: true },
    { key: "fracao", label: "Fração da energia cinética com o e⁻", unit: "", min: 0.05, max: 0.95, step: 0.01, default: 0.5, live: true },
  ],
  observables: [
    { key: "m", label: "massa (selecionada)", unit: "MeV/c²", value: (s) => particle(s.sel).m },
    { key: "tau", label: "vida média (selecionada)", unit: "s", value: (s) => (Number.isFinite(particle(s.sel).tau) ? particle(s.sel).tau : 0) },
    { key: "L", label: "distância média de voo L = γβcτ", unit: "m", value: (s, p) => { const pt = particle(s.sel); return pt.m > 0 && Number.isFinite(pt.tau) ? decayLength(pt.m, pt.tau, num(p, "Kz", 1000)).L : 0; } },
    { key: "Q", label: "Q da reação (√s − Σm)", unit: "MeV", value: (s, p) => { const c = checkReaction(parts(s.left), parts(s.right), num(p, "Kr", 1000)); return Number.isFinite(c.Q) ? c.Q : 0; } },
    { key: "Kth", label: "energia cinética de limiar", unit: "MeV", value: (s) => (s.left.length === 2 ? thresholdK(particle(s.left[0]!).m, particle(s.left[1]!).m, parts(s.right).reduce((a, x) => a + x.m, 0)) : 0) },
    { key: "permitida", label: "reação permitida (1 = sim)", unit: "", value: (s, p) => (checkReaction(parts(s.left), parts(s.right), num(p, "Kr", 1000)).allowed ? 1 : 0) },
    { key: "mOmega", label: "massa prevista do Ω⁻", unit: "MeV/c²", value: () => predictOmega() },
    { key: "erroPalpite", label: "palpite − massa do Ω⁻", unit: "MeV/c²", value: (_s, p) => num(p, "palpite", 1600) - particle("Omega-").m },
    { key: "qHadron", label: "carga do conteúdo da sacola", unit: "e", value: (s, p) => build(s.bag, aligned(p)).q },
    { key: "fracQuarks", label: "fração da massa vinda dos quarks", unit: "%", value: (s, p) => { const r = build(s.bag, aligned(p)); return r.hadron ? (100 * r.quarkMass) / r.hadron.m : 0; } },
    { key: "E1", label: "energia do fóton 1 (ou do e⁻)", unit: "MeV", value: (_s, p) => (proc(p) === 0 ? annFor(p).g1.E : pairFor(p).Em) },
    { key: "E2", label: "energia do fóton 2 (ou do e⁺)", unit: "MeV", value: (_s, p) => (proc(p) === 0 ? annFor(p).g2.E : pairFor(p).Ep) },
    { key: "th1", label: "ângulo do fóton 1 no laboratório", unit: "°", value: (_s, p) => deg(annFor(p).g1.th) },
    { key: "sqrts", label: "energia no CM √s", unit: "MeV", value: (_s, p) => annFor(p).s },
  ],
  chart: { x: "t", y: "E1" },
  scenarios: [
    {
      id: "zoologico",
      label: "Zoológico de partículas",
      params: { tema: 0, Kz: 1000 },
      guide: String.raw`### Quem é quem no Modelo Padrão
1. Os cartões estão agrupados: **léptons** (elétron, múon, tau e três neutrinos), **quarks** (seis sabores, sempre confinados), **bósons** mediadores (fóton, glúon, W, Z) e o Higgs; depois os **hádrons**: mésons (quark + antiquark) e bárions (três quarks).
2. Clique num cartão e leia a ficha: massa, carga, spin, vida média $\tau$, largura $\Gamma = \hbar/\tau$, os números quânticos e o modo de decaimento (dados do PDG).
3. Veja o gráfico de vida média × massa: as partículas se separam em faixas. Decaimentos pela interação **forte** levam $\sim 10^{-23}$ s, pela **eletromagnética** $10^{-16}$ a $10^{-20}$ s e pela **fraca** $10^{-13}$ s ou mais.
4. Compare o $\pi^+$ ($2{,}6\times10^{-8}$ s, fraca) com o $\pi^0$ ($8{,}4\times10^{-17}$ s, eletromagnética): massas quase iguais, vidas 300 milhões de vezes diferentes.
5. Mude a energia cinética e veja quanto a partícula voa no laboratório, $L = \gamma\beta c\tau$: a dilatação do tempo deixa um múon de 1 GeV percorrer quilômetros.`,
      predict: [
        {
          question: "O Σ⁰ e o Σ⁺ têm quase a mesma massa (1192 e 1189 MeV/c²). O Σ⁰ decai em Λ + γ. Como deve ser a vida média dele comparada à do Σ⁺ (8 × 10⁻¹¹ s)?",
          options: ["Praticamente igual", "Cerca de 10 vezes menor", "Mais de um bilhão de vezes menor", "Maior: ele é neutro"],
          answer: 2,
          explanation: "Σ⁰ → Λγ conserva a estranheza e emite um fóton: é eletromagnético, $\\tau = 7{,}4\\times10^{-20}$ s. O Σ⁺ precisa mudar a estranheza (Σ⁺ → pπ⁰), o que só a fraca faz, e vive $10^{9}$ vezes mais.",
        },
      ],
    },
    {
      id: "conservacao",
      label: "Leis de conservação",
      params: { tema: 1, reacao: 0, Kr: 1000 },
      guide: String.raw`### Permitida ou proibida?
1. Escolha uma **reação de partida** ou monte a sua: clique em "reagentes" ou "produtos" (ou use os botões) e depois nas partículas da paleta. Clique numa partícula da reação para retirá-la.
2. A tabela soma cada número quântico antes e depois: **carga**, **número bariônico** $B$, **números leptônicos** $L_e$, $L_\mu$, $L_\tau$ (um por família) e **estranheza** $S$. As quatro primeiras se conservam sempre.
3. A estranheza se conserva nas interações forte e eletromagnética; a fraca pode mudá-la de $\pm 1$. É assim que a sim diz **qual interação** permite o processo: neutrinos ou $\Delta S \neq 0$ exigem a fraca; fótons ou léptons carregados, a eletromagnética; só hádrons com $\Delta S = 0$, a forte.
4. Energia: num decaimento a massa do pai precisa superar a soma das massas dos produtos ($Q > 0$). Numa colisão com alvo parado, o que conta é $\sqrt{s}$; ajuste a energia do projétil e encontre o **limiar**.
5. Teste: $n \to p + e^-$ (sem o antineutrino), $p \to e^+ + \pi^0$ e $\pi^- + p \to K^- + \Sigma^+$. Qual lei cada uma viola?`,
      predict: [
        {
          question: "O decaimento μ⁻ → e⁻ + γ conserva a carga e a energia. Ele é observado?",
          options: ["Sim, pela interação eletromagnética", "Sim, pela fraca", "Não: viola os números leptônicos de família (L_μ e Lₑ)", "Não: viola o número bariônico"],
          answer: 2,
          explanation: "Antes $L_\\mu = 1$, $L_e = 0$; depois $L_\\mu = 0$, $L_e = 1$. Nunca foi visto (limite experimental: fração $< 4\\times10^{-13}$). O múon decai em $e^-\\bar\\nu_e\\nu_\\mu$, que conserva os dois números.",
        },
      ],
    },
    {
      id: "caminho-octuplo",
      label: "Caminho óctuplo e a previsão do Ω⁻",
      params: { tema: 2, multipleto: 1, revelar: 0, palpite: 1600 },
      guide: String.raw`### Ordem no zoológico
1. Cada hádron vira um ponto no plano **estranheza** $S$ × **isospin** $I_3$; as diagonais tracejadas ligam partículas de mesma **carga**, pois $Q = I_3 + (B + S)/2$.
2. Comece pelo **decupleto** (spin 3/2). Em 1962 eram conhecidos os nove de cima: os quatro Δ, três Σ* e dois Ξ*. O vértice de baixo, com $S = -3$ e carga $-1$, estava vazio.
3. Leia as massas por linha: cada passo de estranheza acrescenta quase a mesma massa (~150 MeV, o custo de trocar um quark $u$ ou $d$ por um $s$).
4. Ajuste o seu **palpite** para a massa do bárion que falta e depois **revele**. Gell-Mann previu o $\Omega^-$ (sss) com massa perto de 1680 MeV; ele foi encontrado em 1964 com 1672 MeV.
5. Troque para o **octeto** (confira a relação de Gell-Mann–Okubo) e o **noneto de mésons**.`,
      predict: [
        {
          question: "No decupleto, Δ ≈ 1232, Σ* ≈ 1385 e Ξ* ≈ 1533 MeV/c². Qual a massa prevista para o membro com S = −3?",
          options: ["≈ 1533 MeV/c² (igual ao Ξ*)", "≈ 1680 MeV/c²", "≈ 1900 MeV/c²", "Não dá para prever"],
          answer: 1,
          explanation: "Os espaçamentos são ~153 e ~148 MeV; somando ~150 MeV ao Ξ* chega-se a ~1680 MeV. O Ω⁻ medido tem 1672,45 MeV/c², e foi a confirmação do modelo de quarks.",
        },
      ],
    },
    {
      id: "quarks",
      label: "Montar hádrons com quarks",
      params: { tema: 3, combo: 0, spinAlinhado: 0 },
      guide: String.raw`### Quarks, cor e confinamento
1. Clique nos quarks ($u$, $d$, $s$, $c$) e antiquarks para colocá-los na sacola. A sim soma carga, $B$, $S$ e charme e diz que hádron se formou.
2. **Cor:** cada quark tem uma de três cores e cada antiquark uma anticor. Só combinações **brancas** existem livres: três quarks (bárion), três antiquarks (antibárion) ou quark + antiquark (méson). Tente $ud$ ou um quark sozinho.
3. Monte $uud$ (próton) e $udd$ (nêutron); depois $u\bar d$ ($\pi^+$) e $s\bar u$ ($K^-$). As cargas fracionárias ($+\tfrac23$, $-\tfrac13$) sempre somam um inteiro.
4. Alinhe os spins: $uud$ vira o $\Delta^+$, e $sss$ só existe assim (o $\Omega^-$). Com spins opostos, $uuu$ não existe: o princípio de Pauli, com a cor, proíbe.
5. Compare a massa do hádron com a soma das massas dos quarks: no próton os quarks dão ~1%. O resto é energia de ligação dos glúons ($E = mc^2$).`,
      predict: [
        {
          question: "Que fração da massa do próton (938 MeV/c²) vem das massas dos seus três quarks (u ≈ 2,2 e d ≈ 4,7 MeV/c²)?",
          options: ["Cerca de 100%", "Cerca de 33%", "Cerca de 1%", "Zero"],
          answer: 2,
          explanation: "$2\\times2{,}2 + 4{,}7 \\approx 9$ MeV, ou ~1% de 938 MeV. Quase toda a massa do próton (e, portanto, da matéria comum) é energia dos campos de glúons e do movimento dos quarks.",
        },
      ],
    },
    {
      id: "aniquilacao",
      label: "Aniquilação e produção de pares",
      params: { tema: 4, processo: 0, Ke: 0, thetaCM: 60 },
      guide: String.raw`### Matéria ↔ radiação
1. Com o pósitron quase parado, o par $e^+e^-$ se aniquila em **dois fótons de 511 keV** em sentidos opostos: o momento total era zero e precisa continuar zero. É o sinal detectado na tomografia por emissão de pósitrons (PET).
2. Aumente a energia do pósitron: no laboratório os fótons saem para a frente, com energias diferentes. O diagrama de momentos mostra que $\vec p_1 + \vec p_2$ fecha exatamente em $\vec p_{e^+}$, e as barras mostram que a energia também se conserva.
3. Mude $\theta^*$ (o ângulo no referencial do centro de massa): as energias no laboratório seguem $E_{1,2} = \gamma E^*(1 \pm \beta\cos\theta^*)$.
4. Troque o processo para **produção de pares**: um fóton junto a um núcleo vira $e^-e^+$. Baixe $E_\gamma$ até o **limiar** $2m_ec^2(1 + m_e/M) \approx 1{,}022$ MeV.
5. Tire o núcleo (alvo "nenhum"): no vácuo o processo é impossível, porque o fóton tem $E = pc$ e o par tem sempre $E > pc$. O núcleo recebe o momento que sobra, quase sem levar energia.`,
      predict: [
        {
          question: "Um elétron e um pósitron, ambos parados, se aniquilam. Por que não sai um único fóton de 1,022 MeV?",
          options: ["Porque a carga não se conservaria", "Porque o momento não se conservaria: o fóton sempre tem p = E/c ≠ 0", "Porque a energia não se conservaria", "Sai, às vezes"],
          answer: 1,
          explanation: "Antes o momento total é zero. Um só fóton teria $p = E/c = 1{,}022$ MeV/$c$. São necessários dois fótons opostos, com 0,511 MeV cada.",
        },
      ],
    },
  ],
  exercises: [
    {
      id: "voo-pion",
      prompt: "Um píon π⁺ (m = 139,57 MeV/c², τ = 2,603 × 10⁻⁸ s) sai de um alvo com energia cinética {Kx} MeV. Qual a distância média, em metros, que ele percorre no laboratório antes de decair?",
      vary: { Kx: [50, 3000, 0] },
      fixed: { tema: 0 },
      answer: { label: "L", unit: "m", compute: (p) => decayLength(139.57039, 2.6033e-8, num(p, "Kx", 100)).L },
      hint: "γ = 1 + K/mc², β = √(1 − 1/γ²) e L = γβcτ.",
    },
    {
      id: "largura",
      prompt: "Uma ressonância bariônica tem largura Γ = {G} MeV. Qual a sua vida média, em unidades de 10⁻²⁴ s?",
      vary: { G: [5, 300, 0] },
      fixed: { tema: 0 },
      answer: { label: "τ", unit: "10⁻²⁴ s", compute: (p) => 6.582119569e-22 / num(p, "G", 100) / 1e-24 },
      hint: "τ = ħ/Γ, com ħ = 6,582 × 10⁻²² MeV·s.",
    },
    {
      id: "limiar",
      prompt: "Um próton com energia cinética K atinge um próton parado (m_p = 938,27 MeV/c²) e produz p + p → p + p + X, onde X é neutro com massa {mX} MeV/c². Qual a energia cinética mínima K do projétil, em MeV?",
      vary: { mX: [135, 1000, 0] },
      fixed: { tema: 1 },
      answer: { label: "K_lim", unit: "MeV", compute: (p) => thresholdK(938.27208816, 938.27208816, 2 * 938.27208816 + num(p, "mX", 135)) },
      hint: "No limiar, os produtos saem juntos: √s = Σm. Use s = 2m_p² + 2m_p(K + m_p) (em unidades com c = 1).",
    },
    {
      id: "dois-corpos",
      prompt: "Uma partícula de massa {mA} MeV/c² em repouso decai em duas, de massas {mB} e {mC} MeV/c². Qual o módulo do momento de cada produto, em MeV/c?",
      vary: { mA: [1000, 2000, 0], mB: [100, 500, 0], mC: [100, 400, 0] },
      fixed: { tema: 1 },
      answer: {
        label: "p",
        unit: "MeV/c",
        compute: (p) => {
          const M = num(p, "mA", 1000);
          const a = num(p, "mB", 100);
          const b = num(p, "mC", 100);
          return Math.sqrt((M * M - (a + b) ** 2) * (M * M - (a - b) ** 2)) / (2 * M);
        },
      },
      hint: "Momentos opostos e de mesmo módulo; resolva √(p² + m_B²) + √(p² + m_C²) = M.",
    },
    {
      id: "espacamento",
      prompt: "Num multipleto hipotético de spin 3/2, as linhas com S = 0, −1 e −2 têm massas médias {m1}, {m2} e {m3} MeV/c². Supondo espaçamento igual (a média dos dois intervalos), qual a massa prevista para a linha com S = −3, em MeV/c²?",
      vary: { m1: [1220, 1245, 0], m2: [1370, 1400, 0], m3: [1520, 1545, 0] },
      fixed: { tema: 2, multipleto: 1 },
      answer: { label: "m(S = −3)", unit: "MeV/c²", compute: (p) => num(p, "m3", 1530) + (num(p, "m3", 1530) - num(p, "m1", 1232)) / 2 },
      tolerance: 0.005,
      hint: "Espaçamento médio = (m₃ − m₁)/2; some-o a m₃.",
    },
    {
      id: "estados-sabor",
      prompt: "Quantas combinações diferentes de três quarks (sem contar a ordem, com repetição permitida) existem com {nf} sabores de quark?",
      vary: { nf: [2, 6, 0] },
      fixed: { tema: 3 },
      answer: { label: "número de combinações", unit: "", compute: (p) => (num(p, "nf", 3) * (num(p, "nf", 3) + 1) * (num(p, "nf", 3) + 2)) / 6 },
      tolerance: 0.001,
      hint: "Combinações com repetição: C(n + 2, 3) = n(n + 1)(n + 2)/6. Com u, d, s são 10 (o decupleto).",
    },
    {
      id: "massa-quarks",
      prompt: "Um bárion de massa {M} MeV/c² contém {nu} quark(s) u (2,16 MeV/c² cada) e os demais quarks s (93,5 MeV/c² cada). Que porcentagem da massa do bárion vem das massas dos quarks?",
      vary: { M: [1100, 1700, 0], nu: [0, 2, 0] },
      fixed: { tema: 3 },
      answer: { label: "fração", unit: "%", compute: (p) => (100 * (Math.round(num(p, "nu", 1)) * 2.16 + (3 - Math.round(num(p, "nu", 1))) * 93.5)) / num(p, "M", 1300) },
      hint: "Some as três massas de quark e divida pela massa do bárion.",
    },
    {
      id: "foton-frente",
      prompt: "Um pósitron com energia cinética {Kx} MeV se aniquila com um elétron parado, e um dos fótons sai exatamente para a frente, na direção do feixe. Qual a energia desse fóton, em MeV? (m_e c² = 0,511 MeV)",
      vary: { Kx: [0.2, 10, 2] },
      fixed: { tema: 4, processo: 0 },
      answer: { label: "E_γ", unit: "MeV", compute: (p) => annihilation(num(p, "Kx", 1), 0).g1.E },
      hint: "Energia e momento: E₁ + E₂ = K + 2mc² e E₁ − E₂ = pc (o outro fóton sai para trás).",
    },
    {
      id: "par-pesado",
      prompt: "Um fóton de {Egx} MeV cria um par elétron-pósitron junto a um núcleo pesado (despreze a energia de recuo). Qual a energia cinética total do par, em MeV?",
      vary: { Egx: [1.5, 20, 2] },
      fixed: { tema: 4, processo: 1 },
      answer: { label: "K(e⁻) + K(e⁺)", unit: "MeV", compute: (p) => num(p, "Egx", 5) - 2 * ME },
      hint: "E_γ = 2m_ec² + K₋ + K₊.",
    },
  ],
  init: (p) => {
    const r = REACTIONS[clamp(Math.round(num(p, "reacao")), 0, REACTIONS.length - 1)]!;
    const combo = COMBOS[clamp(Math.round(num(p, "combo")), 0, COMBOS.length - 1)]!;
    return { clock: 0, sel: theme(p) === 2 ? "Xi-" : "mu-", left: [...r.left], right: [...r.right], side: 1, bag: combo.toks.map((t) => ({ ...t })) };
  },
  step: (s, _p, _t, dt) => ({ ...s, clock: s.clock + dt }),
  dt: 1 / 30,
  sampleEvery: 6,
  maxSamples: 2000,
  actions: [
    { id: "reagentes", label: "Adicionar aos reagentes", run: (s) => ({ ...s, side: 0 }), active: (s) => s.side === 0 },
    { id: "produtos", label: "Adicionar aos produtos", run: (s) => ({ ...s, side: 1 }), active: (s) => s.side === 1 },
    { id: "limpar", label: "Limpar a reação", run: (s) => ({ ...s, left: [], right: [], side: 0, clock: 0 }) },
    { id: "esvaziar", label: "Esvaziar a sacola de quarks", run: (s) => ({ ...s, bag: [] }) },
  ],
  pointer: {
    down(s, p, pt) {
      switch (theme(p)) {
        case 0: {
          const id = zooHit(pt);
          return id ? { ...s, sel: id } : undefined;
        }
        case 1:
          return conservationDown(s, pt);
        case 2: {
          const id = eightfoldHit(pt, p);
          return id ? { ...s, sel: id } : undefined;
        }
        case 3:
          return quarksDown(s, pt);
        default:
          return { ...s, clock: 0 };
      }
    },
    cursor(s, p, pt) {
      const tm = theme(p);
      if (tm === 0) return zooHit(pt) ? "pointer" : undefined;
      if (tm === 2) return eightfoldHit(pt, p) ? "pointer" : undefined;
      if (tm === 1) {
        for (let i = 0; i < PALETTE_IDS.length; i++) {
          const b = palBox(i);
          if (pt.x >= b.x && pt.x <= b.x + b.w && pt.y >= b.y && pt.y <= b.y + b.h) return "pointer";
        }
        return Math.abs(pt.y - CHIP.y) < CHIP.h / 2 + 0.3 ? "pointer" : undefined;
      }
      if (tm === 3) {
        for (let i = 0; i < 8; i++) {
          const [x, y] = qbtn(i);
          if (Math.hypot(pt.x - x, pt.y - y) < QBTN.r) return "pointer";
        }
        return s.bag.some((_, i) => { const [x, y] = bagPos(s.bag.length, i); return Math.hypot(pt.x - x, pt.y - y) < 1; }) ? "pointer" : undefined;
      }
      return undefined;
    },
  },
  viewport: () => ({ ...VIEW, unit: "" }),
  render(ctx, frame) {
    const d = draw(ctx, frame);
    const { state: s, params: p } = frame;
    switch (theme(p)) {
      case 0:
        drawZoo(d, s, p);
        break;
      case 1:
        drawConservation(d, s, p);
        break;
      case 2:
        drawEightfold(d, s, p);
        break;
      case 3:
        drawQuarks(d, s, p);
        break;
      default:
        drawAnnihilation(d, s, p);
    }
  },
});

export default particulasElementares;
