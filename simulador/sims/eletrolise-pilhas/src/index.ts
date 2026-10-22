import { clamp, defineSim, draw, num, texNum, type Draw, type Params } from "@fisilab/core";
import {
  CHARGE_EFF,
  CUTOFF,
  ELECTROLYSES,
  E_CHARGE,
  F,
  LAMP_R,
  LAMP_V,
  METALS,
  PEUKERT,
  SOLUTES,
  acidDensity,
  alpha,
  association,
  batteryOcv,
  batteryR,
  cellEmf,
  cellResistance,
  chargeBackEmf,
  conductivity,
  dischargeCurrent,
  electrodePotential,
  electrolysisCurrent,
  faradayMass,
  gasVolume,
  molarConductivity,
  peukertCapacity,
} from "./model.ts";

export * from "./model.ts";

export interface EState {
  /** Relógio do modelo (s). */
  clock: number;
  /** Carga que passou (C). */
  Q: number;
  /** Concentrações do íon do ânodo e do cátodo (mol/L). */
  ca: number;
  cc: number;
  bridge: boolean;
  soc: number;
  Wh: number;
  Ah: number;
  cut: boolean;
  /** Pilhas invertidas na associação (por ramo). */
  inverted: number;
}

export const mode = (p: Params) => Math.round(num(p, "modo"));
const SCALE = [1, 60, 3600, 600, 1];
const HALF_V = 0.1; // volume de cada meia-célula (L)
export const R_BRIDGE = 5;

const solute = (p: Params) => SOLUTES[Math.round(num(p, "soluto", 2))] ?? SOLUTES[2]!;
const conc = (p: Params) => num(p, "c", 0.1);
const elec = (p: Params) => ELECTROLYSES[Math.round(num(p, "eletrolise", 2))] ?? ELECTROLYSES[2]!;
const anode = (p: Params) => METALS[Math.round(num(p, "anodo", 2))] ?? METALS[2]!;
const cathode = (p: Params) => METALS[Math.round(num(p, "catodo", 6))] ?? METALS[6]!;
const charging = (p: Params) => Math.round(num(p, "operacao")) === 1;
const capAh = (p: Params) => num(p, "Cah", 60);

// Condutividade
export function lampCurrent(p: Params): number {
  const R = cellResistance(conductivity(solute(p), conc(p)));
  return Number.isFinite(R) ? LAMP_V / (LAMP_R + R) : 0;
}
export const lampPower = (p: Params) => lampCurrent(p) ** 2 * LAMP_R;

// Eletrólise
export const eCurrent = (p: Params) => electrolysisCurrent(num(p, "Vf", 6), elec(p).Edec, num(p, "Rcuba", 2));

// Daniell
export const emf = (s: EState, p: Params) => cellEmf(anode(p), s.ca, cathode(p), s.cc);
export const daniellCurrent = (s: EState, p: Params) => (s.bridge ? emf(s, p) / (num(p, "Rext", 10) + R_BRIDGE) : 0);

// Chumbo-ácido
export function leadCurrent(s: EState, p: Params): number {
  if (charging(p)) return clamp((num(p, "Vc", 14.4) - chargeBackEmf(s.soc)) / (batteryR(s.soc) + 0.08), 0, 0.3 * capAh(p));
  return s.cut ? 0 : dischargeCurrent(s.soc, num(p, "Rl", 1.2));
}
export function leadTerminal(s: EState, p: Params): number {
  const I = leadCurrent(s, p);
  return charging(p) ? (I > 0 ? num(p, "Vc", 14.4) : batteryOcv(s.soc)) : batteryOcv(s.soc) - I * batteryR(s.soc);
}

// Associação
export function assoc(s: EState, p: Params) {
  const a = association(Math.round(num(p, "Ns", 2)), Math.round(num(p, "Np", 1)), 1.5, num(p, "r", 0.5), s.inverted);
  const R = num(p, "Ra", 5);
  const I = a.E / (a.r + R);
  return { ...a, I, V: I * R, P: I * I * R, R };
}

/** Corrente do modo atual (A). */
export function current(s: EState, p: Params): number {
  switch (mode(p)) {
    case 0:
      return lampCurrent(p);
    case 1:
      return eCurrent(p);
    case 2:
      return daniellCurrent(s, p);
    case 3:
      return leadCurrent(s, p);
    default:
      return assoc(s, p).I;
  }
}

// ---------------------------------------------------------------------------
// Desenho
// ---------------------------------------------------------------------------

const fmt = (v: number, n = 2) => (Number.isFinite(v) ? v.toFixed(n).replace(".", ",") : "∞");
const sci = (v: number) => (v === 0 ? "0" : v.toExponential(2).replace(".", ",").replace("e", " × 10^"));
const hash = (i: number, k: number) => {
  const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

function beaker(d: Draw, x0: number, y0: number, w: number, h: number, fill: string, level = 0.8) {
  d.rect(x0, y0, w, h * level, { fill, alpha: 0.35 });
  d.polyline([[x0, y0 + h], [x0, y0], [x0 + w, y0], [x0 + w, y0 + h]], { color: d.theme.muted, width: 2 });
}

function ion(d: Draw, x: number, y: number, label: string, pos: boolean, size = 10) {
  d.dot(x, y, 7, pos ? d.theme.positive : d.theme.negative, 0.25);
  d.text(label, x, y, { size, color: pos ? d.theme.positive : d.theme.negative, weight: "600" });
}

function lamp(d: Draw, x: number, y: number, P: number, Pn: number) {
  const f = clamp(P / Pn, 0, 1);
  if (f > 0.01) d.circle(x, y, 0.4 + 0.8 * f, { fill: "#ffd84a", alpha: 0.2 + 0.5 * f });
  d.circle(x, y, 0.35, { stroke: d.theme.muted, fill: f > 0.01 ? "#ffe680" : undefined, alpha: 1 });
  d.line(x - 0.15, y - 0.1, x + 0.15, y + 0.1, { color: d.theme.muted, width: 1 });
}

function panel(d: Draw, x: number, y: number, lines: string[], bold: number[] = []) {
  lines.forEach((l, i) => d.text(l, x, y - i * 0.5, { size: 12, align: "left", weight: bold.includes(i) ? "700" : "400" }));
}

function renderConductivity(d: Draw, s: EState, p: Params, t: number) {
  const th = d.theme;
  const so = solute(p);
  const c = conc(p);
  const a = alpha(so, c);
  beaker(d, 0.6, 0.6, 8.4, 6.6, th.dark ? "#3a6ea5" : "#9cc3ea");
  d.rect(1.0, 1.0, 0.3, 5.8, { fill: th.muted });
  d.rect(8.3, 1.0, 0.3, 5.8, { fill: th.muted });
  d.text("−", 1.15, 7.2, { size: 14, color: th.negative, weight: "700" });
  d.text("+", 8.45, 7.2, { size: 14, color: th.positive, weight: "700" });
  d.polyline([[1.15, 6.8], [1.15, 9.2], [3.6, 9.2]], { color: th.muted, width: 2 });
  d.polyline([[8.45, 6.8], [8.45, 9.2], [6.4, 9.2]], { color: th.muted, width: 2 });
  lamp(d, 4.2, 9.2, lampPower(p), (LAMP_V * LAMP_V) / LAMP_R);
  d.rect(5.3, 8.9, 0.25, 0.6, { fill: th.text });
  d.rect(5.65, 9.0, 0.12, 0.4, { fill: th.text });
  d.text("12 V", 5.55, 9.75, { size: 10, color: th.muted });
  // Partículas: unidades de fórmula
  const N = so.Ka === 0 ? 30 : Math.round(clamp(10 + 12 * Math.log10(c / 1e-4), 6, 48));
  const nIon = Math.round(N * a);
  const W = 6.6;
  const vp = 0.02 * so.lp;
  const vm = 0.02 * so.lm;
  for (let i = 0; i < N; i++) {
    const x0 = 1.6 + hash(i, 1) * W;
    const y0 = 1.3 + hash(i, 2) * 4.9;
    const jx = 0.15 * Math.sin(t * 2 + i);
    const jy = 0.15 * Math.cos(t * 1.7 + i * 1.3);
    if (i < nIon) {
      const wrap = (x: number) => 1.6 + ((((x - 1.6) % W) + W) % W);
      ion(d, wrap(x0 - vp * t) + jx, y0 + jy, so.cation, true, 9);
      ion(d, wrap(x0 + 0.4 + vm * t) - jx, y0 - 0.3 - jy, so.anion, false, 9);
    } else {
      d.dot(x0 + jx, y0 + jy, 5, th.muted, 0.7);
      d.dot(x0 + jx + 0.22, y0 + jy, 5, th.muted, 0.5);
    }
  }
  const kappa = conductivity(so, c);
  const R = cellResistance(kappa);
  panel(d, 9.5, 9.3, [
    so.name,
    `c = ${fmt(c, 4)} mol/L`,
    `α = ${fmt(100 * a, 2)} % dissociado`,
    `Λ = ${fmt(molarConductivity(so, c), 1)} S·cm²/mol`,
    `κ = ${fmt(kappa, 4)} S/m`,
    `R da solução = ${Number.isFinite(R) ? fmt(R, 1) : "∞"} Ω`,
    `I = ${fmt(lampCurrent(p) * 1000, 1)} mA`,
    `Lâmpada: ${fmt((100 * lampPower(p)) / 6, 0)} % do brilho`,
  ], [2, 7]);
  d.text("cátions vão para o eletrodo −, ânions para o +; H⁺ é o mais rápido", 0.6, 0.2, { size: 11, align: "left", color: th.muted });
}

function renderElectrolysis(d: Draw, s: EState, p: Params, t: number) {
  const th = d.theme;
  const e = elec(p);
  const I = eCurrent(p);
  beaker(d, 0.8, 0.6, 7.6, 5.4, e.name.startsWith("CuSO") ? (th.dark ? "#2f6db0" : "#7fb3e8") : th.dark ? "#3a5f80" : "#bcd6ee");
  const xc = 2.6;
  const xa = 6.6;
  const mC = faradayMass(e.cathode.M, e.cathode.n, s.Q);
  const dep = clamp(mC / 2, 0, 0.35);
  d.rect(xc - 0.15 - (e.cathode.gas ? 0 : dep), 0.9, 0.3 + (e.cathode.gas ? 0 : 2 * dep), 4.3, { fill: e.cathode.product === "Cu" ? "#c2703d" : e.cathode.product === "Ag" ? "#d8dde3" : th.muted });
  const anodeThin = e.anode.dissolves ? clamp(mC / 2, 0, 0.12) : 0;
  d.rect(xa - 0.15 + anodeThin, 0.9, 0.3 - 2 * anodeThin, 4.3, { fill: e.anode.product.startsWith("Cu") ? "#c2703d" : e.anode.product.startsWith("Ag") ? "#d8dde3" : th.muted });
  d.text("cátodo (−)", xc, 0.3, { size: 11, color: th.negative });
  d.text("ânodo (+)", xa, 0.3, { size: 11, color: th.positive });
  // Fonte
  d.polyline([[xc, 5.2], [xc, 9], [4.2, 9]], { color: th.muted, width: 2 });
  d.polyline([[xa, 5.2], [xa, 9], [5.0, 9]], { color: th.muted, width: 2 });
  d.rect(4.2, 8.7, 0.2, 0.6, { fill: th.text });
  d.rect(4.6, 8.8, 0.1, 0.4, { fill: th.text });
  d.text(`${fmt(num(p, "Vf", 6), 1)} V`, 4.6, 9.6, { size: 11 });
  if (I > 0) for (let i = 0; i < 6; i++) {
    const f = ((t * 0.4 * Math.min(I, 3) + i / 6) % 1);
    const x = f < 0.4 ? xa : f < 0.6 ? xa + ((xc - xa) * (f - 0.4)) / 0.2 : xc;
    const y = f < 0.4 ? 5.2 + (3.8 * f) / 0.4 : f < 0.6 ? 9 : 9 - (3.8 * (f - 0.6)) / 0.4;
    d.dot(x, y, 3, th.negative);
  }
  // Tubos coletores para gases
  const tube = (x: number, vol: number, label: string) => {
    const Vmax = 50e-6;
    d.rect(x - 0.45, 2.0, 0.9, 6.0, { stroke: th.muted, width: 1.5 });
    const h = clamp(vol / Vmax, 0, 1) * 6.0;
    d.rect(x - 0.43, 8.0 - h, 0.86, h, { fill: th.dark ? "#ddd" : "#fff", alpha: 0.85 });
    d.rect(x - 0.43, 2.0, 0.86, 6.0 - h, { fill: th.accent, alpha: 0.2 });
    d.text(`${label}: ${fmt(vol * 1e6, 1)} mL`, x, 8.3, { size: 11, weight: "600" });
    for (let k = 0; k < 5 && I > 0; k++) d.dot(x + 0.2 * Math.sin(k * 2.1), 1.2 + (((t * 1.5 + k * 0.37) % 1) * (6.8 - h)), 2.5, th.text, 0.5);
  };
  if (e.cathode.gas) tube(xc, gasVolume(e.cathode.n, s.Q), e.cathode.product);
  if (e.anode.gas) tube(xa, gasVolume(e.anode.n, s.Q), e.anode.product);
  const lines = [
    e.name,
    `E_decomposição ≈ ${fmt(e.Edec, 2)} V   I = (V − E_dec)/R = ${fmt(I, 3)} A`,
    `t = ${fmt(s.clock / 60, 1)} min   Q = It = ${fmt(s.Q, 1)} C`,
    `elétrons: Q/e = ${sci(s.Q / E_CHARGE)}`,
    `mols de e⁻ = Q/F = ${fmt((s.Q / F) * 1000, 3)} mmol`,
    `cátodo: ${e.cathode.product} ${e.cathode.gas ? `${fmt(gasVolume(e.cathode.n, s.Q) * 1e6, 2)} mL` : `${fmt(mC * 1000, 1)} mg depositados`}`,
    `ânodo: ${e.anode.product} ${e.anode.gas ? `${fmt(gasVolume(e.anode.n, s.Q) * 1e6, 2)} mL` : `${fmt(faradayMass(e.anode.M, e.anode.n, s.Q) * 1000, 1)} mg`}`,
  ];
  panel(d, 9.0, 9.4, lines, [5]);
  d.text("m = MQ/(nF);  gases a 25 °C e 1 atm", 9, 5.6, { size: 11, align: "left", color: th.muted });
}

function renderDaniell(d: Draw, s: EState, p: Params, t: number) {
  const th = d.theme;
  const a = anode(p);
  const c = cathode(p);
  const I = daniellCurrent(s, p);
  const blue = (k: number) => `rgba(40, 110, 220, ${clamp(0.1 + 0.35 * Math.log10(1 + 10 * k), 0.05, 0.6)})`;
  beaker(d, 0.5, 0.5, 4.5, 4.5, c.name === "Cu" ? blue(s.ca) : th.grid);
  beaker(d, 7.0, 0.5, 4.5, 4.5, c.name === "Cu" ? blue(s.cc) : th.grid);
  d.rect(2.5, 1.0, 0.5, 4.2, { fill: th.dark ? "#9aa3ad" : "#a5adb6" });
  d.rect(9.0, 1.0, 0.5, 4.2, { fill: c.name === "Cu" ? "#c2703d" : th.dark ? "#cfd5db" : "#8a939d" });
  d.text(`${a.name} (ânodo, −)`, 2.75, 0.1, { size: 11 });
  d.text(`${c.name} (cátodo, +)`, 9.25, 0.1, { size: 11 });
  d.text(`[${a.ion}] = ${fmt(s.ca, 3)} M`, 2.75, 4.4, { size: 11 });
  d.text(`[${c.ion}] = ${fmt(s.cc, 3)} M`, 9.25, 4.4, { size: 11 });
  // Ponte salina
  if (s.bridge) {
    d.polyline([[4.0, 2.2], [4.0, 5.8], [8.0, 5.8], [8.0, 2.2]], { color: th.series[4] ?? th.accent, width: 14, alpha: 0.35 });
    d.text("ponte salina (KNO₃)", 6, 6.3, { size: 11, color: th.muted });
    if (Math.abs(I) > 1e-6)
      for (let i = 0; i < 4; i++) {
        const f = (t * 0.3 + i / 4) % 1;
        const sg = Math.sign(I);
        ion(d, sg > 0 ? 4.5 + 3 * f : 7.5 - 3 * f, 5.95, "K⁺", true, 9);
        ion(d, sg > 0 ? 7.5 - 3 * f : 4.5 + 3 * f, 5.6, "NO₃⁻", false, 9);
      }
  } else d.text("sem ponte salina: circuito aberto", 6, 5.8, { size: 12, color: th.positive, weight: "700" });
  // Circuito externo com resistor e voltímetro
  d.polyline([[2.75, 5.2], [2.75, 8.6], [5.0, 8.6]], { color: th.muted, width: 2 });
  d.polyline([[9.25, 5.2], [9.25, 8.6], [7.0, 8.6]], { color: th.muted, width: 2 });
  d.spring(5.0, 8.6, 7.0, 8.6, { coils: 6, amplitudePx: 6, color: th.text });
  d.text(`R = ${fmt(num(p, "Rext", 10), 1)} Ω`, 6, 9.2, { size: 11 });
  d.rect(5.0, 6.8, 2.0, 1.0, { fill: th.dark ? "#111" : "#fff", stroke: th.muted });
  const Vt = I * num(p, "Rext", 10);
  d.text(`${fmt(s.bridge ? Vt : 0, 3)} V`, 6, 7.3, { size: 14, weight: "700" });
  if (Math.abs(I) > 1e-6)
    for (let i = 0; i < 5; i++) {
      const f = (t * 0.25 + i / 5) % 1;
      const x = I > 0 ? 2.75 + (9.25 - 2.75) * f : 9.25 - (9.25 - 2.75) * f;
      d.text("e⁻", x, 8.95, { size: 10, color: th.negative });
    }
  const E = emf(s, p);
  panel(d, 12.0, 9.4, [
    `E°(${c.name}) − E°(${a.name}) = ${fmt(c.E0 - a.E0, 2)} V`,
    `FEM (Nernst) = ${fmt(E, 4)} V`,
    `I = E/(R + r_ponte) = ${fmt(I * 1000, 2)} mA`,
    `t = ${fmt(s.clock / 3600, 1)} h   Q = ${fmt(s.Q, 0)} C`,
    `${a.name} perdido: ${fmt(faradayMass(a.M, a.n, s.Q), 3)} g`,
    `${c.name} depositado: ${fmt(faradayMass(c.M, c.n, s.Q), 3)} g`,
  ], [1]);
  d.text(`ânodo: ${a.name} → ${a.ion} + ${a.n}e⁻`, 12, 5.8, { size: 11, align: "left", color: th.muted });
  d.text(`cátodo: ${c.ion} + ${c.n}e⁻ → ${c.name}`, 12, 5.35, { size: 11, align: "left", color: th.muted });
}

function renderLead(d: Draw, s: EState, p: Params) {
  const th = d.theme;
  const I = leadCurrent(s, p);
  d.rect(0.5, 0.8, 9, 5.5, { fill: th.dark ? "#22262d" : "#2f343b", stroke: th.muted });
  for (let k = 0; k < 6; k++) {
    const x = 0.8 + k * 1.45;
    d.rect(x, 1.0, 1.25, 4.6, { fill: th.dark ? "#3c5e7a" : "#b9d3ea", alpha: 0.3 + 0.4 * (acidDensity(s.soc) - 1.1) / 0.18 });
    for (let j = 0; j < 3; j++) {
      const xp = x + 0.1 + j * 0.4;
      const pos = j % 2 === 1;
      d.rect(xp, 1.2, 0.18, 4.2, { fill: pos ? "#6b3b1f" : "#7d838a" });
      d.rect(xp, 1.2, 0.18, 4.2 * (1 - s.soc), { fill: "#eceae4", alpha: 0.85 });
    }
  }
  d.text("placas: Pb (cinza) | PbO₂ (marrom) | PbSO₄ (branco)", 5, 0.4, { size: 11, color: th.muted });
  d.rect(1.5, 6.3, 0.8, 0.4, { fill: th.positive });
  d.rect(7.7, 6.3, 0.8, 0.4, { fill: th.negative });
  // Circuito
  d.polyline([[1.9, 6.7], [1.9, 8.8], [4, 8.8]], { color: th.muted, width: 2 });
  d.polyline([[8.1, 6.7], [8.1, 8.8], [6, 8.8]], { color: th.muted, width: 2 });
  if (charging(p)) {
    d.rect(4, 8.3, 2, 1, { fill: th.dark ? "#2d3d2d" : "#e2f0e2", stroke: th.muted });
    d.text(`carregador ${fmt(num(p, "Vc", 14.4), 1)} V`, 5, 8.8, { size: 11 });
  } else lamp(d, 5, 8.8, I * I * num(p, "Rl", 1.2), 130);
  // Densímetro
  d.rect(10.2, 1, 0.6, 5, { stroke: th.muted });
  d.rect(10.2, 1, 0.6, (5 * (acidDensity(s.soc) - 1.05)) / 0.25, { fill: th.accent, alpha: 0.6 });
  d.text(`ρ = ${fmt(acidDensity(s.soc), 3)} g/cm³`, 10.5, 6.4, { size: 11 });
  const Vt = leadTerminal(s, p);
  panel(d, 11.5, 9.4, [
    charging(p) ? "Carga: 2PbSO₄ + 2H₂O → Pb + PbO₂ + 2H₂SO₄" : "Descarga: Pb + PbO₂ + 2H₂SO₄ → 2PbSO₄ + 2H₂O",
    `estado de carga: ${fmt(100 * s.soc, 1)} %`,
    `FEM = 6 × (ρ + 0,84) = ${fmt(batteryOcv(s.soc), 2)} V`,
    `r interna = ${fmt(batteryR(s.soc) * 1000, 0)} mΩ`,
    `I = ${fmt(I, 2)} A   V_terminal = ${fmt(Vt, 2)} V`,
    `t = ${fmt(s.clock / 3600, 2)} h   ${fmt(s.Ah, 1)} Ah   ${fmt(s.Wh, 0)} Wh`,
    charging(p) ? `rendimento de carga ${fmt(CHARGE_EFF * 100, 0)} %` : `Peukert: C_ef = ${fmt(I > 0 ? peukertCapacity(capAh(p), I) : capAh(p), 1)} Ah`,
    s.cut ? `corte em ${CUTOFF} V: bateria descarregada` : "",
  ], [1, 4]);
}

function renderAssoc(d: Draw, s: EState, p: Params, t: number) {
  const th = d.theme;
  const Ns = Math.round(num(p, "Ns", 2));
  const Np = Math.round(num(p, "Np", 1));
  const A = assoc(s, p);
  const x0 = 1;
  const w = 1.3;
  for (let j = 0; j < Np; j++) {
    const y = 7.5 - j * 1.4;
    d.line(0.6, y, x0, y, { color: th.muted });
    for (let i = 0; i < Ns; i++) {
      const x = x0 + i * w;
      const inv = i < s.inverted;
      d.rect(x, y - 0.3, w - 0.15, 0.6, { fill: inv ? th.positive : th.series[5], alpha: 0.75, stroke: th.muted });
      d.text(inv ? "− 1,5 V +" : "+ 1,5 V −", x + (w - 0.15) / 2, y, { size: 10 });
      d.line(x + w - 0.15, y, x + w, y, { color: th.muted });
    }
    d.line(x0 + Ns * w, y, x0 + Ns * w + 0.4, y, { color: th.muted });
  }
  const xr = x0 + Ns * w + 0.4;
  const yTop = 7.5;
  const yBot = 7.5 - (Np - 1) * 1.4;
  d.line(0.6, yTop, 0.6, 2, { color: th.muted, width: 2 });
  d.line(xr, yTop, xr, yBot, { color: th.muted, width: 2 });
  d.line(xr, yBot, xr, 2, { color: th.muted, width: 2 });
  d.spring(0.6, 2, xr, 2, { coils: 8, color: th.text });
  d.text(`R = ${fmt(A.R, 1)} Ω`, (0.6 + xr) / 2, 1.4, { size: 11 });
  for (let i = 0; i < 8 && A.I > 0; i++) {
    const f = (t * 0.2 * Math.min(A.I, 3) + i / 8) % 1;
    d.dot(0.6 + (xr - 0.6) * f, 2.4, 3, th.negative, 0.8);
  }
  panel(d, 10.2, 9.4, [
    `${Ns} em série × ${Np} em paralelo${s.inverted ? ` (${s.inverted} invertida por ramo)` : ""}`,
    `E_eq = ${fmt(A.E, 2)} V   r_eq = N_s r/N_p = ${fmt(A.r, 3)} Ω`,
    `I = E_eq/(r_eq + R) = ${fmt(A.I, 3)} A`,
    `cada pilha fornece ${fmt(A.I / Np, 3)} A`,
    `V na carga = ${fmt(A.V, 3)} V`,
    `P na carga = ${fmt(A.P, 3)} W   rendimento ${fmt((100 * A.R) / (A.R + A.r), 1)} %`,
    `potência máxima quando R = r_eq = ${fmt(A.r, 3)} Ω`,
  ], [2]);
}

// ---------------------------------------------------------------------------
// Simulação
// ---------------------------------------------------------------------------

const MODES = ["Dissociação e condutividade", "Eletrólise e leis de Faraday", "Pilha de Daniell (Nernst)", "Bateria de chumbo-ácido", "Associação de pilhas"];

export const eletrolisePilhas = defineSim<EState>({
  id: "eletrolise-pilhas",
  title: "Eletrólise, pilhas e baterias",
  course: "FG III",
  topic: "Corrente elétrica",
  priority: "P2",
  summary:
    "Da condução iônica nas soluções às leis de Faraday, à pilha de Daniell com a equação de Nernst e à bateria de chumbo-ácido carregando e descarregando — com massas, volumes de gás, concentrações e tensões calculados ao vivo.",
  equations: [
    String.raw`K_a = \frac{\alpha^2 c}{1 - \alpha},\qquad \kappa = \Lambda c,\qquad R = \frac{L}{\kappa A}`,
    String.raw`m = \frac{M}{nF}\,Q = \frac{M I t}{nF}`,
    String.raw`E = E^\circ_{\text{cát}} - E^\circ_{\text{ân}} - \frac{RT}{nF}\ln\frac{[\text{Zn}^{2+}]}{[\text{Cu}^{2+}]}`,
    String.raw`\text{Pb} + \text{PbO}_2 + 2\,\text{H}_2\text{SO}_4 \rightleftharpoons 2\,\text{PbSO}_4 + 2\,\text{H}_2\text{O}`,
    String.raw`E_{\text{eq}} = N_s E,\qquad r_{\text{eq}} = \frac{N_s r}{N_p},\qquad I = \frac{E_{\text{eq}}}{r_{\text{eq}} + R}`,
  ],
  liveEquations(s, p) {
    switch (mode(p)) {
      case 0: {
        const so = solute(p);
        return [String.raw`\alpha = ${texNum(alpha(so, conc(p)))},\quad \kappa = ${texNum(conductivity(so, conc(p)))}\ \text{S/m},\quad I = ${texNum(lampCurrent(p) * 1000)}\ \text{mA}`];
      }
      case 1: {
        const e = elec(p);
        return [String.raw`m = \frac{${texNum(e.cathode.M, 4)} \cdot ${texNum(s.Q)}}{${e.cathode.n} \cdot 96485} = ${texNum(faradayMass(e.cathode.M, e.cathode.n, s.Q) * 1000)}\ \text{mg}`];
      }
      case 2: {
        const a = anode(p);
        const c = cathode(p);
        return [
          String.raw`E = ${texNum(electrodePotential(c.E0, c.n, s.cc), 4)} - (${texNum(electrodePotential(a.E0, a.n, s.ca), 4)}) = ${texNum(emf(s, p), 4)}\ \text{V}`,
        ];
      }
      case 3:
        return [String.raw`\rho = ${texNum(acidDensity(s.soc), 4)}\ \text{g/cm}^3,\quad E = 6(\rho + 0{,}84) = ${texNum(batteryOcv(s.soc), 4)}\ \text{V},\quad I = ${texNum(leadCurrent(s, p))}\ \text{A}`];
      default: {
        const A = assoc(s, p);
        return [String.raw`I = \frac{${texNum(A.E)}}{${texNum(A.r)} + ${texNum(A.R)}} = ${texNum(A.I)}\ \text{A}`];
      }
    }
  },

  params: [
    { key: "modo", label: "Experimento", unit: "", min: 0, max: 4, step: 1, default: 0, options: MODES.map((label, value) => ({ value, label })) },
    { key: "soluto", label: "Soluto", unit: "", min: 0, max: 4, step: 1, default: 2, live: true, options: SOLUTES.map((s, value) => ({ value, label: s.name })) },
    { key: "c", label: "Concentração", unit: "mol/L", min: 1e-4, max: 2, step: 1e-4, default: 0.1, log: true, live: true },
    { key: "eletrolise", label: "Cuba eletrolítica", unit: "", min: 0, max: 4, step: 1, default: 2, options: ELECTROLYSES.map((e, value) => ({ value, label: e.name })) },
    { key: "Vf", label: "Tensão da fonte", unit: "V", min: 0, max: 12, step: 0.1, default: 6, live: true },
    { key: "Rcuba", label: "Resistência da cuba", unit: "Ω", min: 0.5, max: 20, step: 0.1, default: 2, live: true },
    { key: "anodo", label: "Metal do ânodo", unit: "", min: 0, max: 7, step: 1, default: 2, options: METALS.map((m, value) => ({ value, label: `${m.name} (E° = ${m.E0.toFixed(2).replace(".", ",")} V)` })) },
    { key: "catodo", label: "Metal do cátodo", unit: "", min: 0, max: 7, step: 1, default: 6, options: METALS.map((m, value) => ({ value, label: `${m.name} (E° = ${m.E0.toFixed(2).replace(".", ",")} V)` })) },
    { key: "ca", label: "Concentração inicial no ânodo", unit: "mol/L", min: 0.001, max: 2, step: 0.001, default: 1, log: true },
    { key: "cc", label: "Concentração inicial no cátodo", unit: "mol/L", min: 0.001, max: 2, step: 0.001, default: 1, log: true },
    { key: "Rext", label: "Resistor externo", unit: "Ω", min: 1, max: 1000, step: 1, default: 10, log: true, live: true },
    { key: "operacao", label: "Bateria", unit: "", min: 0, max: 1, step: 1, default: 0, live: true, options: [{ value: 0, label: "Descarga (faróis)" }, { value: 1, label: "Carga (carregador)" }] },
    { key: "Cah", label: "Capacidade nominal (20 h)", unit: "Ah", min: 20, max: 100, step: 5, default: 60 },
    { key: "soc0", label: "Carga inicial", unit: "%", min: 0, max: 100, step: 1, default: 100 },
    { key: "Rl", label: "Resistência da carga (faróis)", unit: "Ω", min: 0.3, max: 10, step: 0.1, default: 1.2, live: true },
    { key: "Vc", label: "Tensão do carregador", unit: "V", min: 13, max: 15.5, step: 0.1, default: 14.4, live: true },
    { key: "Ns", label: "Pilhas em série", unit: "", min: 1, max: 6, step: 1, default: 2, live: true },
    { key: "Np", label: "Ramos em paralelo", unit: "", min: 1, max: 4, step: 1, default: 1, live: true },
    { key: "r", label: "Resistência interna de cada pilha", unit: "Ω", min: 0.05, max: 2, step: 0.05, default: 0.5, live: true },
    { key: "Ra", label: "Resistência da carga", unit: "Ω", min: 0.2, max: 50, step: 0.1, default: 5, live: true },
  ],

  observables: [
    { key: "I", label: "Corrente", unit: "A", value: (s, p) => current(s, p) },
    { key: "E", label: "FEM / tensão", unit: "V", value: (s, p) => [lampCurrent(p) * LAMP_R, num(p, "Vf", 6), emf(s, p), batteryOcv(s.soc), assoc(s, p).E][mode(p)] ?? 0 },
    { key: "Vt", label: "Tensão nos terminais / na carga", unit: "V", value: (s, p) => (mode(p) === 2 ? daniellCurrent(s, p) * num(p, "Rext", 10) : mode(p) === 3 ? leadTerminal(s, p) : mode(p) === 4 ? assoc(s, p).V : 0) },
    { key: "Q", label: "Carga que passou", unit: "C", value: (s) => s.Q },
    { key: "kappa", label: "Condutividade da solução", unit: "S/m", value: (_s, p) => conductivity(solute(p), conc(p)) },
    { key: "alpha", label: "Grau de dissociação", unit: "%", value: (_s, p) => 100 * alpha(solute(p), conc(p)) },
    { key: "m", label: "Massa depositada no cátodo", unit: "mg", value: (s, p) => (mode(p) === 1 ? faradayMass(elec(p).cathode.M, elec(p).cathode.n, s.Q) : mode(p) === 2 ? faradayMass(cathode(p).M, cathode(p).n, s.Q) : 0) * 1000 },
    { key: "Vgc", label: "Gás no cátodo", unit: "mL", value: (s, p) => (mode(p) === 1 && elec(p).cathode.gas ? gasVolume(elec(p).cathode.n, s.Q) * 1e6 : 0) },
    { key: "Vga", label: "Gás no ânodo", unit: "mL", value: (s, p) => (mode(p) === 1 && elec(p).anode.gas ? gasVolume(elec(p).anode.n, s.Q) * 1e6 : 0) },
    { key: "ca", label: "Concentração no ânodo", unit: "mol/L", value: (s) => s.ca },
    { key: "cc", label: "Concentração no cátodo", unit: "mol/L", value: (s) => s.cc },
    { key: "soc", label: "Estado de carga", unit: "%", value: (s) => 100 * s.soc },
    { key: "rho", label: "Densidade do ácido", unit: "g/cm³", value: (s) => acidDensity(s.soc) },
    { key: "Wh", label: "Energia fornecida", unit: "Wh", value: (s) => s.Wh },
    { key: "tm", label: "Tempo do processo", unit: "h", value: (s) => s.clock / 3600 },
  ],
  chart: { x: "tm", y: "I" },

  scenarios: [
    {
      id: "dissociacao",
      label: "Quem conduz corrente?",
      params: { modo: 0, soluto: 1, c: 0.1 },
      guide: `### Dissociação iônica e condutividade
1. Com **sacarose** não há íons: a lâmpada não acende.
2. **Ácido acético** 0,1 mol/L: só ~1,3 % das moléculas se ionizam ($K_a = \\alpha^2 c/(1-\\alpha)$). A lâmpada mal acende.
3. Troque para **HCl** na mesma concentração: ionização completa e H⁺ muito móvel.
4. Dilua o ácido acético: $\\alpha$ **aumenta** (lei de Ostwald), mas $\\kappa = \\Lambda c$ diminui.
5. Observe que H⁺ anda bem mais rápido que os outros íons ($\\lambda_{H^+} = 350$ S·cm²/mol).`,
      predict: [
        {
          question: "Soluções 0,1 mol/L de ácido acético e de HCl: qual acende mais a lâmpada?",
          options: ["HCl", "Ácido acético", "Iguais"],
          answer: 0,
          explanation: "O HCl é ácido forte (α = 1); o acético é fraco (α ≈ 1,3 %). Há ~75 vezes mais íons na solução de HCl.",
        },
      ],
    },
    {
      id: "agua",
      label: "Eletrólise da água",
      params: { modo: 1, eletrolise: 2, Vf: 6, Rcuba: 2 },
      guide: `### Eletrólise da água acidulada
1. Abaixo de ~1,7 V (tensão de decomposição) não há corrente: teste com a fonte.
2. Com 6 V, a corrente é $(V - E_{\\text{dec}})/R$. Cada segundo do simulador é 1 minuto.
3. Compare os volumes: H₂ precisa de 2 e⁻ por molécula, O₂ de 4. Logo $V_{H_2} = 2V_{O_2}$.
4. Confira $V = \\frac{Q}{nF}\\frac{RT}{p}$ com os valores do painel.`,
      predict: [
        {
          question: "Na eletrólise da água, o volume de H₂ coletado em relação ao de O₂ é…",
          options: ["O dobro", "Igual", "A metade", "O quádruplo"],
          answer: 0,
          explanation: "2H₂O → 2H₂ + O₂: cada O₂ exige 4 elétrons e cada H₂ só 2. Para a mesma carga, sai o dobro de mols (e de volume) de H₂.",
        },
      ],
    },
    {
      id: "galvanoplastia",
      label: "Cobreação: lei de Faraday",
      params: { modo: 1, eletrolise: 0, Vf: 1.05, Rcuba: 1 },
      guide: `### Massa depositada
1. Com 1 A durante 10 min passam $Q = 600$ C.
2. Massa de cobre: $m = MQ/(nF) = 63{,}5 \\cdot 600/(2 \\cdot 96485) \\approx 0{,}198$ g.
3. Veja que o ânodo perde exatamente a massa que o cátodo ganha.
4. Troque para prata ($n = 1$): para a mesma carga deposita $107{,}9/63{,}5 \\times 2 \\approx 3{,}4$ vezes mais massa.`,
    },
    {
      id: "daniell",
      label: "Pilha de Daniell",
      params: { modo: 2, anodo: 2, catodo: 6, ca: 1, cc: 1, Rext: 10 },
      guide: `### Pilha de Daniell
1. Com 1 mol/L nos dois lados a FEM é $E^\\circ = 0{,}34 - (-0{,}76) = 1{,}10$ V.
2. Use *Ponte salina*: sem ela não há corrente — os íons não podem fechar o circuito.
3. Rode (1 s = 1 h): Zn²⁺ aumenta, Cu²⁺ diminui e a FEM cai pela equação de Nernst. No fim, a pilha "morre" quando o Cu²⁺ acaba.
4. Troque os metais (Mg, Ag…) e monte pilhas de concentração com o mesmo metal nos dois lados.`,
      predict: [
        {
          question: "Uma pilha Zn|Zn²⁺ (1 M) || Cu²⁺ (1 M)|Cu fornece 1,10 V. Se [Cu²⁺] cair para 0,01 M, a FEM…",
          options: ["Cai cerca de 0,06 V", "Cai pela metade", "Não muda", "Sobe"],
          answer: 0,
          explanation: "E = 1,10 − (0,0257/2) ln(1/0,01) = 1,10 − 0,059 = 1,04 V. A dependência é logarítmica.",
        },
      ],
    },
    {
      id: "chumbo",
      label: "Bateria de carro",
      params: { modo: 3, operacao: 0, Cah: 60, soc0: 100, Rl: 1.2 },
      guide: `### Chumbo-ácido
1. Na descarga as placas viram PbSO₄ (branco) e o ácido fica mais diluído: a **densidade** cai de 1,28 para 1,10 g/cm³.
2. A FEM segue a regra prática $E \\approx \\rho + 0{,}84$ por célula.
3. Diminua $R$ (mais faróis): pela lei de **Peukert** a capacidade efetiva cai.
4. Mude para **carga** com 14,4 V: a corrente diminui no fim (a contra-FEM cresce) e só uma parte da carga é aproveitada.`,
      predict: [
        {
          question: "Durante a recarga de uma bateria de chumbo-ácido, a densidade do eletrólito…",
          options: ["Aumenta", "Diminui", "Não muda"],
          answer: 0,
          explanation: "Na carga o PbSO₄ das placas devolve sulfato ao eletrólito, formando H₂SO₄: a solução fica mais concentrada e mais densa.",
        },
      ],
    },
    {
      id: "associacao",
      label: "Associação de pilhas",
      params: { modo: 4, Ns: 2, Np: 1, r: 0.5, Ra: 5 },
      guide: `### Série e paralelo
1. Em série as FEMs somam e as resistências internas também.
2. Em paralelo a FEM é a mesma, mas $r_{\\text{eq}}$ cai e cada pilha fornece menos corrente (dura mais).
3. Use *Inverter uma pilha*: num ramo de 3, a FEM cai de 4,5 V para 1,5 V.
4. Encontre o $R$ que dá **potência máxima** na carga.`,
    },
  ],

  exercises: [
    {
      id: "faraday",
      prompt: "Uma corrente de {I} A atravessa uma solução de CuSO₄ durante {t} minutos. Que massa de cobre (M = 63,55 g/mol) se deposita no cátodo? Use F = 96 485 C/mol.",
      vary: { I: [0.5, 5, 1], t: [5, 60, 0] },
      answer: { label: "Massa", unit: "g", compute: (p) => faradayMass(63.546, 2, num(p, "I") * num(p, "t") * 60) },
      hint: "Q = It; Cu²⁺ + 2e⁻ → Cu.",
    },
    {
      id: "nernst",
      prompt: "Calcule a FEM, a 25 °C, da pilha Zn | Zn²⁺ ({ca} mol/L) || Cu²⁺ ({cc} mol/L) | Cu. E°(Cu) = 0,34 V, E°(Zn) = −0,76 V.",
      vary: { ca: [0.01, 2, 2], cc: [0.01, 2, 2] },
      answer: { label: "FEM", unit: "V", compute: (p) => cellEmf(METALS[2]!, num(p, "ca"), METALS[6]!, num(p, "cc")) },
      tolerance: 0.005,
      hint: "E = 1,10 − (RT/2F) ln([Zn²⁺]/[Cu²⁺]), com RT/F = 0,02569 V.",
    },
    {
      id: "associacao",
      prompt: "{Ns} pilhas de 1,5 V e resistência interna {r} Ω em série alimentam um resistor de {R} Ω. Qual a corrente?",
      vary: { Ns: [2, 6, 0], r: [0.1, 1, 1], R: [1, 20, 0] },
      answer: { label: "Corrente", unit: "A", compute: (p) => (num(p, "Ns") * 1.5) / (num(p, "Ns") * num(p, "r") + num(p, "R")) },
    },
  ],

  init(p) {
    return { clock: 0, Q: 0, ca: num(p, "ca", 1), cc: num(p, "cc", 1), bridge: true, soc: num(p, "soc0", 100) / 100, Wh: 0, Ah: 0, cut: false, inverted: 0 };
  },

  step(s0, p, _t, dt) {
    const m = mode(p);
    const h = dt * (SCALE[m] ?? 1);
    const s: EState = { ...s0, clock: s0.clock + h };
    if (m === 1) s.Q = s0.Q + eCurrent(p) * h;
    else if (m === 2) {
      const a = anode(p);
      const c = cathode(p);
      const n = 20;
      for (let i = 0; i < n; i++) {
        const I = daniellCurrent(s, p);
        const dQ = (I * h) / n;
        s.Q += dQ;
        s.ca = Math.max(1e-12, s.ca + dQ / (a.n * F * HALF_V));
        s.cc = Math.max(1e-12, s.cc - dQ / (c.n * F * HALF_V));
      }
    } else if (m === 3) {
      const C = capAh(p);
      const n = 10;
      for (let i = 0; i < n; i++) {
        const hh = h / n;
        const I = leadCurrent(s, p);
        if (charging(p)) {
          s.soc = Math.min(1, s.soc + (CHARGE_EFF * I * hh) / (C * 3600));
          s.cut = false;
        } else if (!s.cut) {
          const V = batteryOcv(s.soc) - I * batteryR(s.soc);
          if (V < CUTOFF || s.soc <= 0) {
            s.cut = true;
            break;
          }
          s.soc = Math.max(0, s.soc - (I * (I / (C / 20)) ** (PEUKERT - 1) * hh) / (C * 3600));
          s.Wh += (V * I * hh) / 3600;
        }
        s.Ah += (I * hh) / 3600;
        s.Q += I * hh;
      }
    } else if (m === 4) s.Q = s0.Q + assoc(s0, p).I * h;
    return s;
  },
  dt: 0.02,
  sampleEvery: 2,
  maxSamples: 8000,

  actions: [
    { id: "ponte", label: "Ponte salina (colocar/retirar)", run: (s) => ({ ...s, bridge: !s.bridge }), active: (s) => s.bridge },
    { id: "inverter", label: "Inverter uma pilha", run: (s, p) => ({ ...s, inverted: (s.inverted + 1) % (Math.round(num(p, "Ns", 2)) + 1) }), active: (s) => s.inverted > 0 },
    { id: "zerar", label: "Zerar carga e tempo", run: (s) => ({ ...s, Q: 0, clock: 0, Wh: 0, Ah: 0 }) },
  ],

  viewport: () => ({ xMin: 0, xMax: 16, yMin: 0, yMax: 10, unit: "" }),

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const { state: s, params: p, t } = frame;
    [renderConductivity, renderElectrolysis, renderDaniell, renderLead, renderAssoc][mode(p)]?.(d, s, p, t);
  },
});

export default eletrolisePilhas;
