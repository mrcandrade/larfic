import { clamp, defineSim, draw, num, texNum, type Draw, type Params } from "@fisilab/core";
import { fmt, panel } from "./panel.ts";
import {
  KB_EV,
  MATERIALS,
  carriers,
  colorName,
  fermiDirac,
  intrinsicLevel,
  junction,
  kpBandCurve,
  kpBands,
  kpEnergy,
  kpF,
  kpGaps,
  lambdaNm,
  ledMaterial,
  ni,
  shockley,
  wavelengthRGB,
  type Material,
} from "./physics.ts";

export * from "./physics.ts";

const VIEW = { xMin: -17, xMax: 17, yMin: -9.5, yMax: 9.5 };
const view = (p: Params) => Math.round(num(p, "vista"));
const temp = (p: Params) => clamp(num(p, "T", 300), 100, 800);
export const material = (p: Params): Material => MATERIALS[clamp(Math.round(num(p, "material", 2)), 0, MATERIALS.length - 1)]!;
/** Material para dopagem e junção: um metal não tem gap, então usa silício. */
const semi = (p: Params): Material => (material(p).kind === "metal" ? MATERIALS[2]! : material(p));
const doping = (p: Params) => {
  const kind = Math.round(num(p, "dopagem"));
  return { kind, Nd: kind === 1 ? num(p, "Nd", 1e16) : 0, Na: kind === 2 ? num(p, "Na", 1e16) : 0 };
};
export const carriersFor = (p: Params) => {
  const dp = doping(p);
  return carriers(semi(p), temp(p), dp.Nd, dp.Na);
};
export const junctionFor = (p: Params) => {
  const led = view(p) === 4;
  const m = led ? ledMaterial(num(p, "EgLED", 1.9)) : semi(p);
  return junction(m, temp(p), num(p, "Na", 1e16), num(p, "Nd", 1e16), num(p, "V", 0.6));
};
const kp = (p: Params) => ({ P: num(p, "P", 4.7), a: num(p, "a", 0.3) });

const sci = (v: number) => {
  if (!(v > 0)) return "0";
  const e = Math.floor(Math.log10(v));
  const m = v / 10 ** e;
  return `${fmt(m, 2)} × 10^${e}`;
};
const rgbStr = (c: [number, number, number] | null, fallback: string) => (c ? `rgb(${c[0]}, ${c[1]}, ${c[2]})` : fallback);
/** Número de pontos desenhados para uma concentração (escala logarítmica, ilustrativa). */
const dotsFor = (n: number) => clamp(Math.round(3 * Math.log10(Math.max(n, 1) / 1e4)), 0, 40);
/** Pseudoaleatório fixo para posicionar os pontos. */
const hash = (i: number) => {
  const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
};

// ------------------------------------------------------------- vista 0: Kronig–Penney
function drawKP(d: Draw, p: Params) {
  const th = d.theme;
  const { P, a } = kp(p);
  // pente de Dirac
  d.text("Potencial periódico: barreiras finas de período a", -16.5, 8.7, { size: 12, weight: "700", align: "left" });
  d.line(-16, 6.2, -2, 6.2, { color: th.muted, width: 1.5 });
  const hgt = 0.3 + Math.min(1.9, P * 0.18);
  for (let i = 0; i < 8; i++) {
    const x = -15.2 + i * 1.8;
    d.line(x, 6.2, x, 6.2 + hgt, { color: th.series[1]!, width: 3 });
    d.dot(x + 0.9, 6.45, 3, th.accent, 0.6 + 0.4 * Math.sin(i));
  }
  d.arrow(-15.2, 5.6, 1.8, 0, { color: th.text, width: 1 });
  d.arrow(-13.4, 5.6, -1.8, 0, { color: th.text, width: 1 });
  d.text(`a = ${fmt(a)} nm`, -14.3, 5.15, { size: 11 });
  d.text(`P = ${fmt(P)}`, -15.2, 6.4 + hgt, { size: 11, color: th.series[1]!, align: "left", dx: 6 });

  // f(αa)
  const bands = kpBands(P, 4);
  const box = { x0: -15.5, y0: -8.2, x1: -2, y1: 3.8 };
  const fy = { min: -2.5, max: Math.max(3, Math.min(1 + P, 8)) };
  const pl = panel(d, box, { min: 0, max: 4 * Math.PI }, fy);
  for (const b of bands) d.rect(pl.X(b.lo), box.y0, pl.X(b.hi) - pl.X(b.lo), box.y1 - box.y0, { fill: th.accent, alpha: 0.13 });
  pl.frame({ xlabel: "αa", xticks: [0, Math.PI, 2 * Math.PI, 3 * Math.PI, 4 * Math.PI], fx: (v) => (v === 0 ? "0" : `${Math.round(v / Math.PI)}π`) });
  for (const y of [1, -1]) d.line(box.x0, pl.Y(y), box.x1, pl.Y(y), { color: th.series[1]!, width: 1.3, dash: [5, 4] });
  pl.plot((x) => kpF(x, P), 0.001, 4 * Math.PI, { color: th.text, width: 2, n: 500 });
  d.text("cos αa + P sen(αa)/αa", box.x0 + 0.2, box.y1 - 0.4, { size: 11, align: "left", weight: "600" });
  d.text("faixas azuis: |·| ≤ 1 → energias permitidas", box.x0, box.y1 + 0.45, { size: 11, align: "left", color: th.accent });

  // E(k)
  const eb = { x0: 2.2, y0: -8.2, x1: 16.2, y1: 7.6 };
  const Emax = kpEnergy(3 * Math.PI, a) * 1.08;
  const pe = panel(d, eb, { min: -1, max: 1 }, { min: 0, max: Emax });
  const gaps = kpGaps(P, a, 3);
  bands.slice(0, 2).forEach((b, i) => {
    const e1 = kpEnergy(b.hi, a);
    const e2 = e1 + gaps[i]!;
    if (gaps[i]! > 1e-6) {
      d.rect(eb.x0, pe.Y(e1), eb.x1 - eb.x0, pe.Y(Math.min(e2, Emax)) - pe.Y(e1), { fill: th.series[1]!, alpha: 0.14 });
      d.text(`gap ${i + 1}: ${fmt(gaps[i]!)} eV`, eb.x1 - 0.2, pe.Y((e1 + Math.min(e2, Emax)) / 2), { size: 11, align: "right", color: th.series[1]!, weight: "600" });
    }
  });
  pe.frame({ xlabel: "k (π/a)", ylabel: "E (eV)" });
  // elétron livre (dobrado na zona reduzida)
  for (let j = -2; j <= 2; j++) pe.plot((k) => kpEnergy(Math.PI * (k + 2 * j), a), -1, 1, { color: th.muted, width: 1, dash: [4, 4] });
  bands.slice(0, 3).forEach((b, i) => {
    const pts = kpBandCurve(b, P, a);
    const col = th.series[[0, 2, 4][i]!]!;
    pe.line(pts.map(([ka, E]) => [ka / Math.PI, E] as [number, number]), { color: col, width: 2.5 });
    pe.line(pts.map(([ka, E]) => [-ka / Math.PI, E] as [number, number]), { color: col, width: 2.5 });
  });
  d.text("bandas (cores) × elétron livre (tracejado)", eb.x0, eb.y1 + 0.45, { size: 11, align: "left", color: th.text, weight: "600" });
}

// ------------------------------------------------------------- diagrama de bandas genérico
interface BandBox {
  x0: number;
  x1: number;
  Y: (E: number) => number;
}

function bandDiagram(d: Draw, bb: BandBox, m: Material, EF: number, T: number, t: number, nE: number, nH: number, extra?: (b: BandBox) => void) {
  const th = d.theme;
  const w = bb.x1 - bb.x0;
  if (m.kind === "metal") {
    d.rect(bb.x0, bb.Y(-3), w, bb.Y(2.5) - bb.Y(-3), { fill: th.grid, stroke: th.muted, width: 1 });
    d.rect(bb.x0, bb.Y(-3), w, bb.Y(0) - bb.Y(-3), { fill: th.accent, alpha: 0.45 });
    // borda térmica: ocupação pontilhada perto de E_F
    for (let i = 0; i < 40; i++) {
      const E = (hash(i) - 0.5) * 12 * KB_EV * T;
      if (hash(i + 99) > fermiDirac(E, 0, T)) continue;
      d.dot(bb.x0 + hash(i + 7) * w, bb.Y(E) + 0.08 * Math.sin(3 * t + i), 2.5, th.accent);
    }
    d.text("banda parcialmente cheia", bb.x0 + w / 2, bb.Y(1.6), { size: 11 });
    return;
  }
  const Ec = m.Eg;
  d.rect(bb.x0, bb.Y(Ec), w, bb.Y(Ec + 2.2) - bb.Y(Ec), { fill: th.grid, stroke: th.muted, width: 1 });
  d.rect(bb.x0, bb.Y(-2.2), w, bb.Y(0) - bb.Y(-2.2), { fill: th.accent, alpha: 0.4, stroke: th.muted, width: 1 });
  d.text("banda de condução", bb.x0 + w / 2, bb.Y(Ec + 1.7), { size: 11, color: th.muted });
  d.text("banda de valência (cheia)", bb.x0 + w / 2, bb.Y(-1.7), { size: 11, color: th.text });
  d.text(`E_g = ${fmt(m.Eg)} eV`, bb.x1, bb.Y(Ec / 2), { size: 11, align: "left", dx: 6, color: th.series[1]! });
  d.arrow(bb.x1 + 0.2, bb.Y(Ec / 2), 0, bb.Y(Ec) - bb.Y(Ec / 2), { color: th.series[1]!, width: 1, head: 6 });
  d.arrow(bb.x1 + 0.2, bb.Y(Ec / 2), 0, bb.Y(0) - bb.Y(Ec / 2), { color: th.series[1]!, width: 1, head: 6 });
  extra?.(bb);
  for (let i = 0; i < nE; i++) {
    const x = bb.x0 + 0.2 + hash(i) * (w - 0.4) + 0.12 * Math.sin(2.3 * t + 5 * i);
    d.dot(x, bb.Y(Ec + 0.08 + 0.35 * hash(i + 50) * Math.min(1, (KB_EV * T) / 0.026)), 3, th.negative);
  }
  for (let i = 0; i < nH; i++) {
    const x = bb.x0 + 0.2 + hash(i + 200) * (w - 0.4) + 0.12 * Math.sin(1.9 * t + 3 * i);
    d.circle(x, bb.Y(-0.08 - 0.35 * hash(i + 300) * Math.min(1, (KB_EV * T) / 0.026)), 0, { minPx: 3, stroke: th.positive, fill: th.dark ? "#10151c" : "#ffffff", width: 1.5 });
  }
  if (Number.isFinite(EF)) {
    d.line(bb.x0 - 0.3, bb.Y(EF), bb.x1 + 0.3, bb.Y(EF), { color: th.series[3]!, width: 2, dash: [7, 4] });
    d.text("E_F", bb.x0 - 0.4, bb.Y(EF), { size: 11, color: th.series[3]!, align: "right", weight: "700" });
  }
}

// ------------------------------------------------------------- vista 1: materiais e Fermi–Dirac
function drawMaterials(d: Draw, p: Params, t: number) {
  const th = d.theme;
  const m = material(p);
  const T = temp(p);
  const top = m.kind === "metal" ? 2.5 : m.Eg + 2.2;
  const bot = m.kind === "metal" ? -3 : -2.2;
  const Y = (E: number) => -8 + ((E - bot) / (top - bot)) * 14.5;
  const EF = m.kind === "metal" ? 0 : intrinsicLevel(m, T);
  const nI = ni(m, T);
  bandDiagram(d, { x0: -14, x1: -5, Y }, m, EF, T, t, m.kind === "metal" ? 0 : dotsFor(nI), m.kind === "metal" ? 0 : dotsFor(nI));
  d.text(m.name, -16.5, 8.7, { size: 15, weight: "700", align: "left" });
  d.text(m.kind === "metal" ? "metal" : m.kind === "isolante" ? "isolante" : "semicondutor", -16.5, 7.9, { size: 12, align: "left", color: th.series[1]! });
  // f(E) de lado, na mesma escala de energia
  const box = { x0: -1, y0: Y(bot), x1: 5, y1: Y(top) };
  const pf = panel(d, box, { min: 0, max: 1 }, { min: bot, max: top });
  pf.frame({ xlabel: "f(E)", ylabel: "E (eV)", xticks: [0, 0.5, 1], yticks: [] });
  const pts: [number, number][] = [];
  for (let i = 0; i <= 300; i++) {
    const E = bot + ((top - bot) * i) / 300;
    pts.push([fermiDirac(E, EF, T), E]);
  }
  pf.line(pts, { color: th.series[3]!, width: 2.2 });
  d.line(box.x0, Y(EF), box.x1, Y(EF), { color: th.series[3]!, width: 1, dash: [4, 4] });
  if (m.kind !== "metal") {
    d.line(box.x0, Y(m.Eg), box.x1, Y(m.Eg), { color: th.muted, width: 1 });
    d.line(box.x0, Y(0), box.x1, Y(0), { color: th.muted, width: 1 });
  }
  // informações
  const x = 7.2;
  const kT = KB_EV * T;
  d.text(`T = ${fmt(T)} K    kT = ${fmt(kT * 1000)} meV`, x, 6.6, { size: 12, align: "left" });
  if (m.kind === "metal") {
    d.text("E_F cai dentro de uma banda: há estados vazios", x, 5.6, { size: 12, align: "left" });
    d.text("logo acima dos ocupados, e um campo elétrico", x, 4.9, { size: 12, align: "left" });
    d.text("acelera os elétrons. n ≈ 8,5 × 10^22 cm⁻³", x, 4.2, { size: 12, align: "left" });
    d.text("A temperatura só borra f(E) numa faixa ~kT.", x, 3.2, { size: 12, align: "left", color: th.muted });
  } else {
    const fc = fermiDirac(m.Eg, EF, T);
    d.text(`f(E_c) = ${sci(fc)}`, x, 5.6, { size: 12, align: "left" });
    d.text(`nᵢ = ${sci(nI)} cm⁻³`, x, 4.9, { size: 13, align: "left", weight: "700", color: th.negative });
    d.text(`elétrons na BC = lacunas na BV = nᵢ`, x, 4.2, { size: 12, align: "left" });
    d.text(m.kind === "isolante" ? "Gap enorme: nᵢ desprezível, não conduz." : "Aqueça: nᵢ cresce como e^(−E_g/2kT).", x, 3.2, { size: 12, align: "left", color: th.muted });
    d.text("Pontos ∝ log n (ilustrativo).", x, 2.5, { size: 11, align: "left", color: th.muted });
  }
  // barras de nᵢ dos materiais
  const bx = { x0: 7.6, y0: -8, x1: 16.3, y1: 0.4 };
  const pn = panel(d, bx, { min: 0, max: 4 }, { min: 1, max: 1e20, log: true });
  pn.frame({ xticks: [], ylabel: "nᵢ (cm⁻³) a esta T", fy: (v) => `10^${Math.round(Math.log10(v))}`, yticks: [1, 1e5, 1e10, 1e15, 1e20] });
  MATERIALS.slice(1).forEach((mm, i) => {
    const v = ni(mm, T);
    const xc = i + 0.5;
    if (v > 1) d.rect(pn.X(xc - 0.3), pn.Y(1), pn.X(xc + 0.3) - pn.X(xc - 0.3), pn.Y(Math.min(v, 1e20)) - pn.Y(1), { fill: mm === m ? th.accent : th.muted, alpha: 0.8 });
    d.text(mm.name.split(" ")[0]!, pn.X(xc), bx.y0, { size: 10, dy: 10 });
  });
}

// ------------------------------------------------------------- vista 2: dopagem
function drawDoping(d: Draw, p: Params, t: number) {
  const th = d.theme;
  const m = semi(p);
  const T = temp(p);
  const dp = doping(p);
  const c = carriersFor(p);
  const top = m.Eg + 1.6;
  const bot = -1.6;
  const Y = (E: number) => -8 + ((E - bot) / (top - bot)) * 14.5;
  const Ed = m.Eg - 0.045;
  const Ea = 0.045;
  bandDiagram(d, { x0: -14, x1: -5, Y }, m, c.EF, T, t, dotsFor(c.n), dotsFor(c.p), (bb) => {
    d.line(bb.x0, bb.Y(intrinsicLevel(m, T)), bb.x1, bb.Y(intrinsicLevel(m, T)), { color: th.muted, width: 1, dash: [2, 4] });
    d.text("Eᵢ", bb.x1 + 0.3, bb.Y(intrinsicLevel(m, T)), { size: 10, align: "left", color: th.muted, dy: 10 });
    if (dp.kind === 1)
      for (let i = 0; i < 8; i++) {
        const x = bb.x0 + 0.5 + i * 1.1;
        d.line(x - 0.3, bb.Y(Ed), x + 0.3, bb.Y(Ed), { color: th.positive, width: 2 });
        d.text("+", x, bb.Y(Ed), { size: 10, color: th.positive, dy: 9 });
      }
    if (dp.kind === 2)
      for (let i = 0; i < 8; i++) {
        const x = bb.x0 + 0.5 + i * 1.1;
        d.line(x - 0.3, bb.Y(Ea), x + 0.3, bb.Y(Ea), { color: th.negative, width: 2 });
        d.text("−", x, bb.Y(Ea), { size: 11, color: th.negative, dy: -9 });
      }
  });
  const title = dp.kind === 1 ? "Tipo n (doadores, ex.: fósforo)" : dp.kind === 2 ? "Tipo p (aceitadores, ex.: boro)" : "Intrínseco";
  d.text(`${m.name}: ${title}`, -16.5, 8.7, { size: 14, weight: "700", align: "left" });
  d.text(`n = ${sci(c.n)} cm⁻³   p = ${sci(c.p)} cm⁻³   nᵢ = ${sci(c.ni)} cm⁻³`, -16.5, 7.9, { size: 11, align: "left" });
  d.text(`n·p = nᵢ²   E_F − Eᵢ = kT ln(n/nᵢ) = ${fmt(c.EF - intrinsicLevel(m, T))} eV`, -16.5, 7.25, { size: 11, align: "left", color: th.muted });
  // n(T), p(T)
  const box = { x0: 1.5, y0: -7.8, x1: 16.3, y1: 6.4 };
  const pl = panel(d, box, { min: 100, max: 800 }, { min: 1e4, max: 1e20, log: true });
  pl.frame({ xlabel: "T (K)", ylabel: "concentração (cm⁻³)", fy: (v) => `10^${Math.round(Math.log10(v))}`, yticks: [1e4, 1e8, 1e12, 1e16, 1e20] });
  const curve = (f: (T: number) => number, color: string, dash?: number[]) => pl.plot((TT) => Math.max(f(TT), 1e-10), 100, 800, { color, width: 2, dash, n: 160 });
  curve((TT) => carriers(m, TT, dp.Nd, dp.Na).n, th.negative);
  curve((TT) => carriers(m, TT, dp.Nd, dp.Na).p, th.positive);
  curve((TT) => ni(m, TT), th.muted, [5, 4]);
  d.line(pl.X(T), box.y0, pl.X(T), box.y1, { color: th.text, width: 1, dash: [3, 3] });
  d.text("n (elétrons)", box.x1 - 0.2, box.y1 - 0.5, { size: 11, align: "right", color: th.negative, weight: "600" });
  d.text("p (lacunas)", box.x1 - 0.2, box.y1 - 1.1, { size: 11, align: "right", color: th.positive, weight: "600" });
  d.text("nᵢ", box.x1 - 0.2, box.y1 - 1.7, { size: 11, align: "right", color: th.muted });
}

// ------------------------------------------------------------- vista 3: junção pn
function drawJunction(d: Draw, p: Params, t: number) {
  const th = d.theme;
  const m = semi(p);
  const T = temp(p);
  const V = num(p, "V", 0.6);
  const Na = num(p, "Na", 1e16);
  const Nd = num(p, "Nd", 1e16);
  const J = junctionFor(p);
  const Vd = Math.max(J.Vbi - V, 0.02 * J.Vbi);
  const L = 1.6 * Math.max(J.xn, J.xp) + 0.6 * J.W;
  const box = { x0: -16, y0: 0.6, x1: 1.5, y1: 7.6 };
  const XX = (x: number) => box.x0 + ((x + L) / (2 * L)) * (box.x1 - box.x0);
  // potencial eletrostático (normalizado): 0 no lado p, Vd no lado n
  const phi = (x: number) => {
    if (x <= -J.xp) return 0;
    if (x >= J.xn) return Vd;
    const fp = (J.xp / J.W) * Vd;
    return x < 0 ? (fp * (x + J.xp) ** 2) / (J.xp * J.xp) : Vd - ((Vd - fp) * (J.xn - x) ** 2) / (J.xn * J.xn);
  };
  const cn = carriers(m, T, Nd, 0);
  const EcN = m.Eg;
  const EFn = cn.EF;
  // E_c(x) = E_c,n + (V_d − φ(x))
  const Emin = -0.5;
  const Emax = m.Eg + Vd + 0.5;
  const Y = (E: number) => box.y0 + ((E - Emin) / (Emax - Emin)) * (box.y1 - box.y0);
  d.rect(XX(-J.xp), box.y0, XX(J.xn) - XX(-J.xp), box.y1 - box.y0, { fill: th.series[5]!, alpha: 0.13 });
  d.text("camada de depleção", (XX(-J.xp) + XX(J.xn)) / 2, box.y1 + 0.35, { size: 11, color: th.series[5]!, weight: "600" });
  const ec: [number, number][] = [];
  const ev: [number, number][] = [];
  for (let i = 0; i <= 200; i++) {
    const x = -L + (2 * L * i) / 200;
    const Ec = EcN + Vd - phi(x);
    ec.push([XX(x), Y(Ec)]);
    ev.push([XX(x), Y(Ec - m.Eg)]);
  }
  d.polyline(ec, { color: th.text, width: 2.2 });
  d.polyline(ev, { color: th.text, width: 2.2 });
  d.text("E_c", box.x0, ec[0]![1], { size: 11, align: "left", dy: -9 });
  d.text("E_v", box.x0, ev[0]![1], { size: 11, align: "left", dy: 9 });
  d.line(XX(0), Y(EFn), box.x1, Y(EFn), { color: th.series[3]!, width: 1.8, dash: [6, 4] });
  d.line(box.x0, Y(EFn + V), XX(0), Y(EFn + V), { color: th.series[3]!, width: 1.8, dash: [6, 4] });
  d.text("E_F (p)", box.x0 + 2.2, Y(EFn + V), { size: 10, color: th.series[3]!, dy: -8 });
  d.text("E_F (n)", box.x1 - 2.2, Y(EFn), { size: 10, color: th.series[3]!, dy: -8 });
  if (Math.abs(V) > 0.02) d.text(`qV = ${fmt(V)} eV`, XX(0), Y(EFn + V / 2), { size: 10, color: th.series[3]!, dx: 4, align: "left" });
  d.text("p", box.x0 + 1, box.y1 - 0.4, { size: 16, weight: "700", color: th.positive });
  d.text("n", box.x1 - 1, box.y1 - 0.4, { size: 16, weight: "700", color: th.negative });
  // portadores majoritários animados
  for (let i = 0; i < 10; i++) {
    const xe = J.xn + (L - J.xn) * hash(i);
    const xh = -J.xp - (L - J.xp) * hash(i + 40);
    d.dot(XX(xe) + 0.1 * Math.sin(2 * t + i), Y(EcN + 0.15), 3, th.negative);
    d.circle(XX(xh) + 0.1 * Math.sin(2.3 * t + i), Y(Vd - 0.15), 0, { minPx: 3, stroke: th.positive, width: 1.5 });
  }
  // densidade de carga e campo
  const b2 = { x0: -16, y0: -8.4, x1: 1.5, y1: -1.4 };
  const rhoMax = Math.max(Na, Nd);
  const RY = (r: number) => (b2.y0 + b2.y1) / 2 + (r / rhoMax) * 1.6;
  d.line(b2.x0, RY(0), b2.x1, RY(0), { color: th.muted, width: 1 });
  d.rect(XX(-J.xp), RY(-Na), XX(0) - XX(-J.xp), RY(0) - RY(-Na), { fill: th.negative, alpha: 0.6 });
  d.rect(XX(0), RY(0), XX(J.xn) - XX(0), RY(Nd) - RY(0), { fill: th.positive, alpha: 0.6 });
  d.text("ρ: íons aceitadores (−) e doadores (+)", b2.x0, b2.y1, { size: 11, align: "left", weight: "600" });
  const EY = (frac: number) => b2.y0 + 0.2 + frac * 1.5;
  d.polyline(
    [
      [XX(-L), EY(0)],
      [XX(-J.xp), EY(0)],
      [XX(0), EY(1)],
      [XX(J.xn), EY(0)],
      [XX(L), EY(0)],
    ],
    { color: th.series[2]!, width: 2 },
  );
  d.text(`|E| máx = ${sci(J.Emax)} V/m`, XX(0), EY(1), { size: 10, color: th.series[2]!, align: "left", dx: 10 });
  d.arrow(XX(J.xn * 0.6), EY(0.3), XX(-J.xp * 0.6) - XX(J.xn * 0.6), 0, { color: th.series[2]!, width: 1.2, head: 7 });
  d.text(`W = ${fmt(J.W * 1e6)} µm`, XX(0), RY(Nd) + 0.35, { size: 10, color: th.text });

  drawIV(d, p, { x0: 5, y0: -7.6, x1: 16.3, y1: 6.6 }, J.Is, V, T, th.accent);
  d.text(`V_bi = (kT/q) ln(N_A N_D / nᵢ²) = ${fmt(J.Vbi)} V`, 3.2, 8.7, { size: 12, align: "left", weight: "600" });
  d.text(`${m.name}, N_A = ${sci(Na)}, N_D = ${sci(Nd)} cm⁻³, T = ${fmt(T)} K`, -16.5, 8.7, { size: 12, align: "left" });
  d.text(V >= 0 ? "Polarização direta: a barreira baixa e a corrente cresce exponencialmente." : "Polarização reversa: a depleção alarga e só passa I_s.", -16.5, -9.1, { size: 11, align: "left", color: th.muted });
}

function drawIV(d: Draw, p: Params, box: { x0: number; y0: number; x1: number; y1: number }, Is: number, V: number, T: number, color: string) {
  const th = d.theme;
  const Imax = 20;
  const V1 = clamp(Math.log1p((Imax * 1e-3) / Math.max(Is, 1e-300)) * KB_EV * T + 0.15, 0.4, 5);
  const V0 = -Math.min(1.5, V1 * 0.5);
  const pl = panel(d, box, { min: V0, max: V1 }, { min: -2, max: Imax });
  pl.frame({ xlabel: "V (V)", ylabel: "I (mA)" });
  pl.plot((v) => shockley(Is, v, T) * 1e3, V0, V1, { color, width: 2.4, n: 400 });
  const I = shockley(Is, V, T) * 1e3;
  if (V >= V0 && V <= V1) {
    const yy = clamp(I, -2, Imax);
    d.dot(pl.X(V), pl.Y(yy), 5.5, th.series[1]!);
    d.text(`I = ${I > 1e-3 ? fmt(I) + " mA" : sci(Math.abs(I) * 1e-3) + " A"}`, pl.X(V), pl.Y(yy), { size: 11, color: th.series[1]!, weight: "700", align: "right", dx: -8, dy: -6 });
  }
  d.text(`I_s = ${sci(Is)} A`, box.x0 + 0.3, box.y1 - 0.5, { size: 11, align: "left", color: th.muted });
  void p;
}

// ------------------------------------------------------------- vista 4: LED
function drawLED(d: Draw, p: Params, t: number) {
  const th = d.theme;
  const Eg = num(p, "EgLED", 1.9);
  const T = temp(p);
  const lam = lambdaNm(Eg);
  const rgb = wavelengthRGB(lam);
  const col = rgbStr(rgb, lam < 380 ? "#8a63d2" : "#8b2f2f");
  const J = junctionFor(p);
  const V = num(p, "V", 0.6);
  const I = Math.max(0, shockley(J.Is, V, T) * 1e3);
  const glow = clamp(I / 15, 0, 1);
  // LED
  const cx = -11.5;
  const cy = 1.5;
  if (glow > 0.01) d.circle(cx, cy + 1, 3.6, { fill: col, alpha: 0.18 * glow });
  d.ctx.beginPath();
  d.ctx.moveTo(cx - 1.4, cy - 1);
  d.ctx.lineTo(cx - 1.4, cy + 1.2);
  d.ctx.arc(cx, cy + 1.2, 1.4, Math.PI, 0, true);
  d.ctx.lineTo(cx + 1.4, cy - 1);
  d.ctx.closePath();
  d.ctx.fillStyle = col;
  d.ctx.globalAlpha = 0.25 + 0.7 * glow;
  d.ctx.fill();
  d.ctx.globalAlpha = 1;
  d.ctx.strokeStyle = th.text;
  d.ctx.lineWidth = 1.5 * d.px;
  d.ctx.stroke();
  d.rect(cx - 1.7, cy - 1.4, 3.4, 0.4, { fill: th.muted });
  d.line(cx - 0.7, cy - 1.4, cx - 0.7, cy - 4, { color: th.muted, width: 3 });
  d.line(cx + 0.7, cy - 1.4, cx + 0.7, cy - 3.4, { color: th.muted, width: 3 });
  d.text("ânodo (p)", cx - 0.9, cy - 4.4, { size: 10, align: "right", color: th.muted });
  d.text("cátodo (n)", cx + 0.9, cy - 3.8, { size: 10, align: "left", color: th.muted });
  // fótons
  const rate = Math.round(clamp(I * 2, 0, 40));
  for (let i = 0; i < rate; i++) {
    const ang = 2 * Math.PI * hash(i);
    const r = 1.6 + ((t * 2.5 + hash(i + 9) * 5) % 5);
    d.dot(cx + r * Math.cos(ang), cy + 1 + r * Math.sin(ang), 3, col, 1 - (r - 1.6) / 5);
  }
  d.text(`λ = hc/E_g = ${fmt(lam)} nm (${colorName(lam)})`, -16.5, 8.7, { size: 14, weight: "700", align: "left", color: rgb ? col : th.text });
  d.text(rgb ? "Cada recombinação elétron–lacuna emite um fóton com energia ≈ E_g." : "Fora do visível: o olho não vê esta luz.", -16.5, 7.9, { size: 11, align: "left" });
  // transição na banda
  const bx = -5.5;
  d.rect(bx - 1.8, 3.2, 3.6, 1.2, { fill: th.grid, stroke: th.muted, width: 1 });
  d.rect(bx - 1.8, -2.4, 3.6, 1.2, { fill: th.accent, alpha: 0.4, stroke: th.muted, width: 1 });
  d.dot(bx, 3.45, 4, th.negative);
  d.circle(bx, -1.45, 0, { minPx: 4, stroke: th.positive, width: 1.5 });
  d.arrow(bx, 3.2, 0, -4.4, { color: th.text, width: 1.5 });
  d.text(`E_g = ${fmt(Eg)} eV`, bx - 0.3, 0.9, { size: 11, align: "right" });
  const wave: [number, number][] = [];
  for (let i = 0; i <= 60; i++) wave.push([bx + 0.4 + (3 * i) / 60, 0.9 + 0.3 * Math.sin((i / 60) * 6 * Math.PI * (Eg / 2) - 6 * t)]);
  d.polyline(wave, { color: col, width: 2 });
  d.text("hν", bx + 2, 1.7, { size: 12, color: col, weight: "700" });
  // espectro visível
  const sb = { x0: 3.4, x1: 16.3, y0: 6.6, y1: 7.6 };
  const LX = (nm: number) => sb.x0 + ((nm - 350) / (850 - 350)) * (sb.x1 - sb.x0);
  for (let nm = 350; nm < 850; nm += 5) {
    const c = wavelengthRGB(nm + 2.5);
    d.rect(LX(nm), sb.y0, LX(nm + 5) - LX(nm), sb.y1 - sb.y0, { fill: rgbStr(c, th.grid) });
  }
  d.rect(sb.x0, sb.y0, sb.x1 - sb.x0, sb.y1 - sb.y0, { stroke: th.muted, width: 1 });
  for (const nm of [400, 500, 600, 700, 800]) d.text(String(nm), LX(nm), sb.y0, { size: 9, dy: 9, color: th.muted });
  const lx = LX(clamp(lam, 350, 850));
  d.arrow(lx, sb.y1 + 1, 0, -1, { color: th.text, width: 2 });
  d.text("nm", sb.x1, sb.y0, { size: 9, dy: 9, dx: 12, color: th.muted });
  drawIV(d, p, { x0: 5, y0: -7.6, x1: 16.3, y1: 4.2 }, J.Is, V, T, col);
  d.text(`Liga em V ≈ ${fmt(KB_EV * T * Math.log1p(1e-3 / J.Is))} V (1 mA): cerca de E_g/q`, 5, 5.0, { size: 11, align: "left", color: th.muted });
}

export const semicondutores = defineSim({
  id: "semicondutores",
  title: "Bandas de energia, semicondutores, diodo e LED",
  course: "FG IV",
  topic: "Sólidos",
  priority: "P3",
  summary:
    "Bandas e gaps pelo modelo de Kronig–Penney; metal, semicondutor e isolante com a ocupação de Fermi–Dirac; dopagem n e p; junção pn com camada de depleção e curva I–V; LED com a cor dada pelo gap.",
  equations: [
    String.raw`\cos ka = \cos\alpha a + P\,\frac{\sin\alpha a}{\alpha a} \qquad E = \frac{\hbar^2\alpha^2}{2m}`,
    String.raw`f(E) = \frac{1}{e^{(E - E_F)/kT} + 1} \qquad n_i = \sqrt{N_c N_v}\,e^{-E_g/2kT}`,
    String.raw`n\,p = n_i^2 \qquad E_F - E_i = kT\ln\frac{n}{n_i}`,
    String.raw`V_{bi} = \frac{kT}{q}\ln\frac{N_A N_D}{n_i^2} \qquad W = \sqrt{\frac{2\varepsilon (V_{bi} - V)}{q}\left(\frac{1}{N_A} + \frac{1}{N_D}\right)}`,
    String.raw`I = I_s\left(e^{qV/kT} - 1\right) \qquad \lambda = \frac{hc}{E_g}`,
  ],
  liveEquations(_s, p) {
    const v = view(p);
    if (v === 0) {
      const { P, a } = kp(p);
      const g = kpGaps(P, a, 3);
      return [String.raw`P = ${texNum(P)},\ a = ${texNum(a)}\ \text{nm} \Rightarrow E_{g,1} = ${texNum(g[0]!)}\ \text{eV},\ E_{g,2} = ${texNum(g[1]!)}\ \text{eV}`];
    }
    if (v === 1 || v === 2) {
      const c = carriersFor(p);
      return [
        String.raw`n_i = ${texNum(c.ni)}\ \text{cm}^{-3} \quad n = ${texNum(c.n)}\ \text{cm}^{-3} \quad p = ${texNum(c.p)}\ \text{cm}^{-3}`,
        String.raw`kT = ${texNum(KB_EV * temp(p) * 1000)}\ \text{meV}`,
      ];
    }
    const J = junctionFor(p);
    const out = [
      String.raw`V_{bi} = ${texNum(J.Vbi)}\ \text{V} \quad W = ${texNum(J.W * 1e6)}\ \mu\text{m} \quad I = ${texNum(J.I * 1e3)}\ \text{mA}`,
    ];
    if (v === 4) out.push(String.raw`\lambda = \frac{1240\ \text{eV·nm}}{${texNum(num(p, "EgLED", 1.9))}\ \text{eV}} = ${texNum(lambdaNm(num(p, "EgLED", 1.9)))}\ \text{nm}`);
    return out;
  },
  params: [
    {
      key: "vista",
      label: "Tema",
      unit: "",
      min: 0,
      max: 4,
      step: 1,
      default: 0,
      live: true,
      options: [
        { value: 0, label: "Bandas (Kronig–Penney)" },
        { value: 1, label: "Metal × semicondutor × isolante" },
        { value: 2, label: "Dopagem n e p" },
        { value: 3, label: "Junção pn e diodo" },
        { value: 4, label: "LED" },
      ],
    },
    { key: "P", label: "Força da barreira P", unit: "", min: 0, max: 12, step: 0.1, default: 4.7, live: true },
    { key: "a", label: "Período da rede a", unit: "nm", min: 0.2, max: 0.6, step: 0.01, default: 0.3, live: true },
    {
      key: "material",
      label: "Material",
      unit: "",
      min: 0,
      max: 4,
      step: 1,
      default: 2,
      live: true,
      options: MATERIALS.map((m, i) => ({ value: i, label: m.name })),
    },
    { key: "T", label: "Temperatura", unit: "K", min: 100, max: 800, step: 10, default: 300, live: true },
    {
      key: "dopagem",
      label: "Dopagem",
      unit: "",
      min: 0,
      max: 2,
      step: 1,
      default: 1,
      live: true,
      options: [
        { value: 0, label: "Intrínseco" },
        { value: 1, label: "Tipo n (doadores N_D)" },
        { value: 2, label: "Tipo p (aceitadores N_A)" },
      ],
    },
    { key: "Nd", label: "Doadores N_D", unit: "cm⁻³", min: 1e13, max: 1e19, step: 1e13, default: 1e16, log: true, live: true },
    { key: "Na", label: "Aceitadores N_A", unit: "cm⁻³", min: 1e13, max: 1e19, step: 1e13, default: 1e16, log: true, live: true },
    { key: "V", label: "Tensão aplicada V", unit: "V", min: -2, max: 4, step: 0.01, default: 0.6, live: true },
    { key: "EgLED", label: "Gap do LED E_g", unit: "eV", min: 1.2, max: 3.5, step: 0.01, default: 1.9, live: true },
  ],
  observables: [
    { key: "V", label: "Tensão aplicada", unit: "V", value: (_s, p) => num(p, "V", 0.6) },
    { key: "I", label: "Corrente no diodo", unit: "mA", value: (_s, p) => junctionFor(p).I * 1e3 },
    { key: "gap1", label: "Gap 1 (Kronig–Penney)", unit: "eV", value: (_s, p) => kpGaps(kp(p).P, kp(p).a, 2)[0]! },
    { key: "ni", label: "nᵢ", unit: "cm⁻³", value: (_s, p) => ni(semi(p), temp(p)) },
    { key: "n", label: "Elétrons n", unit: "cm⁻³", value: (_s, p) => carriersFor(p).n },
    { key: "p", label: "Lacunas p", unit: "cm⁻³", value: (_s, p) => carriersFor(p).p },
    { key: "EF", label: "E_F − E_v", unit: "eV", value: (_s, p) => carriersFor(p).EF },
    { key: "Vbi", label: "Potencial de contato V_bi", unit: "V", value: (_s, p) => junctionFor(p).Vbi },
    { key: "W", label: "Largura da depleção", unit: "µm", value: (_s, p) => junctionFor(p).W * 1e6 },
    { key: "lambda", label: "λ do LED", unit: "nm", value: (_s, p) => lambdaNm(num(p, "EgLED", 1.9)) },
  ],
  chart: { x: "V", y: "I" },
  scenarios: [
    {
      id: "kronig-penney",
      label: "Bandas e gaps (Kronig–Penney)",
      params: { vista: 0, P: 4.7, a: 0.3 },
      guide: `### De onde vêm as bandas
1. O elétron se move num potencial periódico (barreiras finas de período $a$). Pelo teorema de Bloch, só existe solução quando $|\\cos\\alpha a + P\\sin(\\alpha a)/\\alpha a| \\le 1$.
2. No gráfico da esquerda, as faixas azuis são as energias permitidas; entre elas ficam os **gaps**.
3. À direita, $E(k)$: perto de $k = \\pm\\pi/a$ as bandas se achatam e se afastam da parábola do elétron livre (tracejada).
4. Leve $P$ a zero: os gaps somem. Aumente $P$: as bandas estreitam e tendem aos níveis de um poço isolado.`,
      predict: [
        {
          question: "O que acontece com as bandas quando a barreira P entre os átomos aumenta?",
          options: ["Ficam mais largas e os gaps diminuem", "Ficam mais estreitas e os gaps aumentam", "Nada muda", "Os gaps desaparecem"],
          answer: 1,
          explanation:
            "Barreiras mais fortes isolam os átomos: o tunelamento entre vizinhos diminui, cada banda se estreita em torno de um nível atômico e os gaps crescem. Com $P = 0$ volta o elétron livre, sem gaps.",
        },
      ],
    },
    {
      id: "materiais",
      label: "Metal, semicondutor e isolante",
      params: { vista: 1, material: 2, T: 300 },
      guide: `### Gap e temperatura
1. No **metal**, o nível de Fermi cai dentro de uma banda: sempre há estados vazios logo acima dos ocupados.
2. No **silício**, a banda de valência está cheia e a de condução vazia a $T = 0$; com $kT \\approx 26$ meV, uma fração $\\sim e^{-E_g/2kT}$ dos elétrons atravessa o gap.
3. Varie $T$ e veja $n_i$ mudar por ordens de grandeza (eixo logarítmico).
4. Compare Ge, Si, GaAs e diamante: o gap decide quem é semicondutor e quem é isolante.
5. Passe para **Dopagem n e p**: poucos átomos de fósforo por milhão mudam $n$ em muitas ordens de grandeza.`,
      predict: [
        {
          question: "Aquecendo o silício de 300 K para 400 K, a concentração intrínseca nᵢ...",
          options: ["dobra", "aumenta cerca de 300 vezes", "diminui", "não muda, pois o gap é o mesmo"],
          answer: 1,
          explanation:
            "$n_i \\propto T^{3/2}e^{-E_g/2kT}$. A exponencial domina: $e^{(1{,}12/2k)(1/300 - 1/400)} \\approx 220$, vezes $(4/3)^{3/2} \\approx 1{,}5$, dá cerca de 300.",
        },
      ],
    },
    {
      id: "diodo",
      label: "Junção pn e diodo",
      params: { vista: 3, material: 2, Na: 1e16, Nd: 1e16, V: 0.6, T: 300 },
      guide: `### A junção pn
1. Na junção, elétrons do lado n e lacunas do lado p se recombinam e deixam íons fixos: a **camada de depleção**, com campo elétrico interno.
2. As bandas se curvam de $qV_{bi}$; com $V = 0$ o nível de Fermi é o mesmo dos dois lados.
3. Arraste $V$ para valores negativos (reversa): a depleção alarga, $W \\propto \\sqrt{V_{bi} - V}$, e só passa a minúscula $I_s$.
4. Em polarização direta a barreira baixa e $I$ cresce como $e^{qV/kT}$: o gráfico desenha a curva I–V enquanto você move $V$.
5. Aumente $N_A$ e $N_D$: $V_{bi}$ sobe e $W$ diminui.`,
      predict: [
        {
          question: "Em polarização reversa (V < 0), a camada de depleção...",
          options: ["fica mais larga", "fica mais estreita", "desaparece", "não muda"],
          answer: 0,
          explanation: "A tensão reversa soma-se à barreira: $W = \\sqrt{2\\varepsilon(V_{bi} - V)(1/N_A + 1/N_D)/q}$ cresce, e mais íons ficam descobertos para sustentar a diferença de potencial maior.",
        },
      ],
    },
    {
      id: "led",
      label: "LED: a cor vem do gap",
      params: { vista: 4, EgLED: 1.9, V: 1.6, Na: 1e17, Nd: 1e17, T: 300 },
      guide: `### Cor de um LED
1. Em polarização direta, elétrons e lacunas se encontram na junção e se recombinam emitindo fótons com $h\\nu \\approx E_g$.
2. Varie $E_g$: 1,4 eV (GaAs) é infravermelho, 1,9 eV é vermelho, 2,3 eV verde, 2,7 eV azul (InGaN).
3. Repare que o LED só acende quando $V$ se aproxima de $E_g/q$: LEDs azuis precisam de mais tensão que os vermelhos.
4. Aumente $V$ e veja a corrente (e o número de fótons) crescer exponencialmente.`,
      predict: [
        {
          question: "Qual LED exige maior tensão para acender?",
          options: ["Vermelho", "Verde", "Azul", "Todos a mesma tensão"],
          answer: 2,
          explanation: "A tensão de condução acompanha o gap ($qV \\approx E_g$) e o azul tem o maior gap ($\\lambda$ menor, $E = hc/\\lambda$ maior).",
        },
      ],
    },
  ],
  exercises: [
    {
      id: "led-cor",
      prompt: "Um LED é feito de um semicondutor com gap E_g = {EgLED} eV. Qual o comprimento de onda da luz emitida, em nm? (hc = 1240 eV·nm)",
      vary: { EgLED: [1.5, 3.2, 2] },
      fixed: { vista: 4 },
      answer: { label: "λ", unit: "nm", compute: (p) => lambdaNm(num(p, "EgLED", 1.9)) },
    },
    {
      id: "vbi",
      prompt: "Uma junção pn de silício a 300 K tem N_A = {ma} × 10¹⁶ cm⁻³ e N_D = {md} × 10¹⁵ cm⁻³. Com nᵢ = 1,0 × 10¹⁰ cm⁻³ e kT/q = 25,85 mV, calcule o potencial de contato V_bi, em volts.",
      vary: { ma: [1, 9, 0], md: [1, 9, 0] },
      fixed: { vista: 3 },
      answer: { label: "V_bi", unit: "V", compute: (p) => 0.025852 * Math.log((num(p, "ma", 1) * 1e16 * num(p, "md", 1) * 1e15) / 1e20) },
      hint: "V_bi = (kT/q) ln(N_A N_D / nᵢ²).",
    },
  ],
  init: () => [0],
  derivatives: () => [1],
  integrator: "euler",
  dt: 1 / 60,
  sampleEvery: 6,
  narrowSplit: () => 0.498,
  viewport: () => ({ ...VIEW, unit: "" }),
  render(ctx, frame) {
    const d = draw(ctx, frame);
    const { params: p, t } = frame;
    switch (view(p)) {
      case 0:
        drawKP(d, p);
        break;
      case 1:
        drawMaterials(d, p, t);
        break;
      case 2:
        drawDoping(d, p, t);
        break;
      case 3:
        drawJunction(d, p, t);
        break;
      default:
        drawLED(d, p, t);
    }
  },
});

export default semicondutores;
