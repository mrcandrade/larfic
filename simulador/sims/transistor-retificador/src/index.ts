import { clamp, defineSim, draw, num, texNum, type Draw, type Params } from "@fisilab/core";
import { fmt, panel } from "./panel.ts";
import { schematic } from "./schematic.ts";
import {
  ceGainTheory,
  ceWaveform,
  defaultBJT,
  divider,
  icCurve,
  ldrR,
  ntcR,
  qPoint,
  rectStep,
  region,
  rippleApprox,
  switchCircuit,
  type CEParams,
  type RectParams,
} from "./physics.ts";

export * from "./physics.ts";

export interface TRState {
  /** Tensão na carga do retificador (V) e corrente nos diodos (A). */
  vo: number;
  i: number;
  /** Amostras recentes para o osciloscópio: [t, v_s, v_o, i]. */
  buf: [number, number, number, number][];
  /** Estatística do período em curso e do último período completo. */
  per: { k: number; max: number; min: number; sum: number; n: number; imax: number };
  last: { max: number; min: number; mean: number; imax: number; ok: boolean };
  /** Chave da base (modo chave). */
  sw: number;
  /** Cursor de medição de V_CE nas curvas (V). */
  probe: number;
  /** Distância da lâmpada ao LDR (m). */
  dist: number;
  drag: null | "probe" | "lamp";
}

export const MODOS = ["Curvas I_C × V_CE", "Transistor como chave", "Amplificador emissor-comum", "Retificador de meia onda", "Retificador em ponte (onda completa)", "Sensores: NTC e LDR"];
const VIEW = { xMin: -17, xMax: 17, yMin: -9.5, yMax: 9.5 };
export const modo = (p: Params) => clamp(Math.round(num(p, "modo")), 0, MODOS.length - 1);

// ------------------------------------------------------------ parâmetros derivados
export const bjt = (p: Params) => defaultBJT(num(p, "beta", 150));
export const ceParams = (p: Params): CEParams => ({
  vcc: num(p, "VCC", 12),
  r1: num(p, "R1", 47) * 1e3,
  r2: 10e3,
  rc: num(p, "RC", 2200),
  re: 1000,
  bypass: Math.round(num(p, "desvio", 1)) === 1,
});
export const rectParams = (p: Params, bridge = modo(p) === 4): RectParams => ({
  bridge,
  Vp: num(p, "Vrms", 12) * Math.SQRT2,
  f: num(p, "f", 60),
  R: num(p, "RL", 1000),
  C: Math.round(num(p, "filtro", 1)) === 1 ? num(p, "C", 470) * 1e-6 : 0,
  Rs: 1,
});
/** Iluminância no LDR: lâmpada de intensidade dada a 1 m, lei do inverso do quadrado. */
export const lux = (p: Params, s: TRState) => num(p, "E1", 100) / Math.max(s.dist, 0.05) ** 2;

/** Memoização de um único resultado por chave (cálculos caros que só dependem dos parâmetros). */
function memo<T>(fn: (p: Params) => T, keys: string[]): (p: Params) => T {
  let lastKey = "";
  let last: T | undefined;
  return (p) => {
    const k = keys.map((key) => p[key]).join("|");
    if (k !== lastKey || last === undefined) {
      last = fn(p);
      lastKey = k;
    }
    return last;
  };
}

export const qOf = memo((p) => {
  const q = bjt(p);
  const ib = num(p, "IB", 30) * 1e-6;
  const r = qPoint(q, ib, num(p, "VCC", 12), num(p, "RC", 2200));
  return { ...r, ib, reg: region(q, r.ic, ib, r.vce) };
}, ["beta", "IB", "VCC", "RC", "modo"]);

const switchOf = memo((p) => {
  const q = bjt(p);
  const out = (on: boolean) => {
    const r = switchCircuit(q, on ? num(p, "Vin", 5) : 0, num(p, "RB", 1000), num(p, "VCC", 12), num(p, "RL", 100));
    return { ...r, reg: region(q, r.ic, r.ib, r.vce), P: r.vce * r.ic + r.vbe * r.ib };
  };
  return { on: out(true), off: out(false) };
}, ["beta", "Vin", "RB", "VCC", "RL"]);
export const switchState = (p: Params, s: TRState) => (s.sw > 0.5 ? switchOf(p).on : switchOf(p).off);

export const ampOf = memo((p) => {
  const q = bjt(p);
  const c = ceParams(p);
  const amp = num(p, "vin", 10) * 1e-3;
  const w = ceWaveform(q, c, amp, 128);
  const gain = (Math.max(...w.vout) - Math.min(...w.vout)) / (2 * amp);
  return { ...w, gain, theory: ceGainTheory(q, c, w.bias.ic), amp };
}, ["beta", "VCC", "R1", "RC", "desvio", "vin"]);

const sensorOf = (p: Params, s: TRState) => {
  const vcc = num(p, "Vcc", 5);
  const rf = num(p, "Rfix", 10) * 1e3;
  const T = num(p, "T", 25);
  const E = lux(p, s);
  const Rn = ntcR(T);
  const Rl = ldrR(E);
  return { vcc, rf, T, E, Rn, Rl, Vn: divider(vcc, Rn, rf), Vl: divider(vcc, Rl, rf), vref: num(p, "Vref", 2.5) };
};

const isRect = (p: Params) => modo(p) === 3 || modo(p) === 4;

// ------------------------------------------------------------ física no tempo
function stepRect(s: TRState, p: Params, t: number, dt: number): TRState {
  const rp = rectParams(p);
  const h0 = Math.min(1e-4, 1 / (200 * rp.f));
  const n = Math.max(1, Math.ceil(dt / h0 - 1e-9));
  const h = dt / n;
  let { vo, i } = s;
  const buf = s.buf.slice();
  let per = { ...s.per };
  let last = s.last;
  for (let k = 1; k <= n; k++) {
    const tk = t + k * h;
    const vs = rp.Vp * Math.sin(2 * Math.PI * rp.f * tk);
    const r = rectStep(rp, vs, vo, h);
    vo = r.vo;
    i = r.i;
    buf.push([tk, vs, vo, i]);
    const kp = Math.floor(tk * rp.f + 1e-9);
    if (kp !== per.k) {
      if (per.n > 0) last = { max: per.max, min: per.min, mean: per.sum / per.n, imax: per.imax, ok: per.k >= 1 };
      per = { k: kp, max: -Infinity, min: Infinity, sum: 0, n: 0, imax: 0 };
    }
    per.max = Math.max(per.max, vo);
    per.min = Math.min(per.min, vo);
    per.sum += vo;
    per.n++;
    per.imax = Math.max(per.imax, i);
  }
  const tCut = t + dt - 3.2 / rp.f;
  let j = 0;
  while (j < buf.length && buf[j]![0] < tCut) j++;
  return { ...s, vo, i, buf: buf.slice(j), per, last };
}

// ------------------------------------------------------------ desenho: curvas
const CURVE_BOX = { x0: -1.5, y0: -6.8, x1: 16.2, y1: 7.6 };
const curveRange = (p: Params) => {
  const vcc = num(p, "VCC", 12);
  const q = bjt(p);
  const ibMax = Math.max(60e-6, num(p, "IB", 30) * 1e-6);
  const imax = Math.max(vcc / num(p, "RC", 2200), icCurve(q, ibMax, vcc)) * 1.15 * 1e3;
  return { vmax: vcc * 1.1, imax };
};

function drawCurves(d: Draw, p: Params, s: TRState) {
  const th = d.theme;
  const sc = schematic(d);
  const q = bjt(p);
  const Q = qOf(p);
  const vcc = num(p, "VCC", 12);
  const rc = num(p, "RC", 2200);
  // circuito
  const T = sc.npn(-8.5, 0);
  sc.wire([T.B, [-12.5, 0], [-12.5, -1]]);
  sc.currentSource(-12.5, -2.2, "I_B");
  sc.wire([[-12.5, -3.2], [-12.5, -6], [-5, -6]]);
  sc.wire([T.E, [T.E[0], -6]]);
  sc.ground(-8.05, -6);
  sc.resistor(T.C, [T.C[0], 6], `R_C = ${fmt(rc / 1000)} kΩ`);
  sc.wire([[T.C[0], 6], [-5, 6]]);
  d.text(`+V_CC = ${fmt(vcc)} V`, -5, 6, { align: "left", dx: 4, size: 12, weight: "600" });
  d.line(-5, 6, -5, 5.6, { color: th.text, width: 1.8 });
  d.text(`I_B = ${fmt(Q.ib * 1e6)} µA`, -12.5, 0.6, { size: 11, color: th.series[1]!, weight: "600" });
  d.arrow(T.C[0] + 0.5, 3.4, 0, -1, { color: th.series[0]!, width: 1.5 });
  d.text(`I_C = ${fmt(Q.ic * 1e3)} mA`, T.C[0] + 0.8, 3.2, { size: 11, color: th.series[0]!, align: "left", weight: "600" });
  d.text(`V_CE = ${fmt(Q.vce)} V`, T.C[0] + 0.8, -2.8, { size: 11, align: "left" });
  d.text(`β = I_C/I_B = ${fmt(Q.ic / Math.max(Q.ib, 1e-12))}`, -16.5, -7.6, { size: 12, align: "left" });
  d.text(`Região: ${Q.reg}`, -16.5, -8.5, { size: 12, align: "left", weight: "700", color: Q.reg === "ativa" ? th.series[2]! : th.series[1]! });
  d.text("Curvas características do transistor NPN", -16.5, 8.7, { size: 14, weight: "700", align: "left" });

  // gráfico
  const { vmax, imax } = curveRange(p);
  const pl = panel(d, CURVE_BOX, { min: 0, max: vmax }, { min: 0, max: imax });
  d.rect(pl.X(0), CURVE_BOX.y0, pl.X(0.3) - pl.X(0), CURVE_BOX.y1 - CURVE_BOX.y0, { fill: th.series[1]!, alpha: 0.12 });
  pl.frame({ xlabel: "V_CE (V)", ylabel: "I_C (mA)" });
  d.text("saturação", pl.X(0.15), CURVE_BOX.y1 - 0.4, { size: 9, color: th.series[1]!, align: "left", dx: 2 });
  const family = [10, 20, 30, 40, 50, 60];
  for (const ibu of family) {
    pl.plot((v) => icCurve(q, ibu * 1e-6, v) * 1e3, 0, vmax, { color: th.muted, width: 1.2, n: 90 });
    d.text(`${ibu} µA`, CURVE_BOX.x1, pl.Y(icCurve(q, ibu * 1e-6, vmax) * 1e3), { size: 9, color: th.muted, align: "right", dx: -3, dy: -7 });
  }
  pl.plot((v) => icCurve(q, Q.ib, v) * 1e3, 0, vmax, { color: th.series[1]!, width: 2.4, n: 120 });
  // reta de carga
  pl.line([[0, (vcc / rc) * 1e3], [vcc, 0]], { color: th.series[0]!, width: 2, dash: [7, 4] });
  d.text("reta de carga", pl.X(vcc * 0.55), pl.Y((vcc * 0.45 * 1e3) / rc), { size: 10, color: th.series[0]!, align: "left", dx: 6, dy: -6 });
  d.dot(pl.X(Q.vce), pl.Y(Q.ic * 1e3), 6, th.series[1]!);
  d.text("Q", pl.X(Q.vce), pl.Y(Q.ic * 1e3), { size: 12, weight: "700", dx: 9, dy: -9, color: th.series[1]! });
  // cursor de medição
  const pv = clamp(s.probe, 0, vmax);
  d.line(pl.X(pv), CURVE_BOX.y0, pl.X(pv), CURVE_BOX.y1, { color: th.accent, width: 1.2, dash: [3, 3] });
  const icp = icCurve(q, Q.ib, pv) * 1e3;
  d.dot(pl.X(pv), pl.Y(icp), 4, th.accent);
  d.text(`cursor: V_CE = ${fmt(pv)} V → I_C = ${fmt(icp)} mA (arraste)`, CURVE_BOX.x1, CURVE_BOX.y1 + 0.5, { size: 11, align: "right", color: th.accent });
}

// ------------------------------------------------------------ desenho: chave
const SWITCH = { x: -13.2, y: 2.6 };
function drawSwitch(d: Draw, p: Params, s: TRState) {
  const th = d.theme;
  const sc = schematic(d);
  const r = switchState(p, s);
  const vcc = num(p, "VCC", 12);
  const rl = num(p, "RL", 100);
  const T = sc.npn(-7.5, -1);
  // base
  sc.resistor([-11.8, -1], T.B, `R_B = ${fmt(num(p, "RB", 1000) / 1000)} kΩ`, -1);
  sc.wire([[-11.8, -1], [-12.2, -1], [-12.2, SWITCH.y - 0.6]]);
  const on = s.sw > 0.5;
  d.dot(-12.2, SWITCH.y - 0.6, 3, th.text);
  d.dot(-14.2, SWITCH.y - 0.6, 3, th.text);
  d.line(-14.2, SWITCH.y - 0.6, on ? -12.3 : -12.6, on ? SWITCH.y - 0.6 : SWITCH.y + 0.6, { color: on ? th.series[2]! : th.text, width: 2.4 });
  d.text(on ? "chave fechada (clique)" : "chave aberta (clique)", -13.2, SWITCH.y + 1.3, { size: 10, color: th.accent });
  sc.wire([[-14.2, SWITCH.y - 0.6], [-15.5, SWITCH.y - 0.6], [-15.5, 0.2]]);
  d.line(-16.1, 0.2, -14.9, 0.2, { color: th.text, width: 2.4 });
  d.line(-15.8, -0.15, -15.2, -0.15, { color: th.text, width: 3.5 });
  d.text(`V_in = ${fmt(num(p, "Vin", 5))} V`, -15.3, -0.9, { size: 10, align: "left", dx: 4 });
  sc.wire([[-15.5, -0.15], [-15.5, -6], [-4, -6]]);
  sc.wire([T.E, [T.E[0], -6]]);
  sc.ground(-9, -6);
  // carga
  sc.wire([T.C, [T.C[0], 2.2]]);
  const P = r.ic * r.ic * rl;
  const Pn = (vcc * vcc) / rl;
  sc.lamp(T.C[0], 3.2, clamp(P / Pn, 0, 1));
  sc.wire([[T.C[0], 4.0], [T.C[0], 6], [-4, 6]]);
  d.text(`+V_CC = ${fmt(vcc)} V`, -4, 6, { size: 12, align: "left", dx: 4, weight: "600" });
  d.text(`lâmpada ${fmt(rl)} Ω`, T.C[0] + 1.2, 3.2, { size: 10, align: "left" });
  d.text("Transistor como chave", -16.5, 8.7, { size: 14, weight: "700", align: "left" });
  // leituras
  const x = -1;
  const rows: [string, string][] = [
    ["I_B", `${fmt(r.ib * 1e3)} mA`],
    ["I_C", `${fmt(r.ic * 1e3)} mA`],
    ["V_CE", `${fmt(r.vce)} V`],
    ["I_C/I_B", r.ib > 1e-9 ? fmt(r.ic / r.ib) : "—"],
    ["P no transistor", `${fmt(r.P)} W`],
    ["P na lâmpada", `${fmt(P)} W`],
  ];
  rows.forEach(([k, v], i) => {
    d.text(k, x, 7.4 - i * 0.85, { size: 12, align: "left", color: th.muted });
    d.text(v, x + 5.2, 7.4 - i * 0.85, { size: 12, align: "left", weight: "600" });
  });
  d.text(`Região: ${r.reg}`, x, 2.0, { size: 13, align: "left", weight: "700", color: r.reg === "saturação" ? th.series[2]! : r.reg === "ativa" ? th.series[1]! : th.muted });
  const ibSat = vcc / rl / bjt(p).betaF;
  d.text(`Para saturar: I_B > I_C,máx/β = ${fmt(ibSat * 1e3)} mA`, x, 1.1, { size: 11, align: "left", color: th.muted });
  // P no transistor × V_in
  const box = { x0: x + 0.6, y0: -7.6, x1: 16.2, y1: -0.6 };
  const vinMax = 10;
  const q = bjt(p);
  const sw = (v: number) => switchCircuit(q, v, num(p, "RB", 1000), vcc, rl);
  const pts: [number, number, number][] = [];
  for (let i = 0; i <= 50; i++) {
    const v = (vinMax * i) / 50;
    const o = sw(v);
    pts.push([v, o.ic * 1e3, o.vce * o.ic]);
  }
  const icMax = (vcc / rl) * 1e3 * 1.1;
  const pmax = Math.max(...pts.map((z) => z[2]), 1e-3) * 1.15;
  const pl = panel(d, box, { min: 0, max: vinMax }, { min: 0, max: icMax });
  pl.frame({ xlabel: "V_in (V)", ylabel: "I_C (mA) e P_transistor (escala relativa)" });
  pl.line(pts.map((z) => [z[0], z[1]]), { color: th.series[0]!, width: 2.2 });
  pl.line(pts.map((z) => [z[0], (z[2] / pmax) * icMax]), { color: th.series[3]!, width: 2, dash: [6, 3] });
  const vin = on ? num(p, "Vin", 5) : 0;
  d.dot(pl.X(Math.min(vin, vinMax)), pl.Y(r.ic * 1e3), 5, th.series[1]!);
  d.text("I_C", box.x1, pl.Y(pts[50]![1]), { size: 11, align: "right", dy: -8, color: th.series[0]! });
  d.text("potência dissipada", box.x1 - 0.2, box.y1 - 1.4, { size: 10, align: "right", color: th.series[3]! });
}

// ------------------------------------------------------------ desenho: amplificador
function drawAmp(d: Draw, p: Params, t: number) {
  const th = d.theme;
  const sc = schematic(d);
  const c = ceParams(p);
  const A = ampOf(p);
  const T = sc.npn(-8.2, 0);
  sc.wire([[-12, 6.5], [-3.2, 6.5]]);
  d.text(`+V_CC = ${fmt(c.vcc)} V`, -7.6, 6.5, { size: 11, dy: -10 });
  sc.wire([[-12, -6.5], [-3.2, -6.5]]);
  sc.ground(-9, -6.5);
  sc.resistor([-12, 6.5], [-12, 0], `R₁ = ${fmt(c.r1 / 1000)} k`);
  sc.resistor([-12, 0], [-12, -6.5], "R₂ = 10 k");
  sc.wire([[-12, 0], T.B]);
  sc.node(-12, 0);
  sc.resistor([T.C[0], 6.5], T.C, `R_C = ${fmt(c.rc / 1000)} k`, -1);
  sc.resistor(T.E, [T.E[0], -6.5], "R_E = 1 k", -1);
  if (c.bypass) {
    sc.wire([[T.E[0], -2.2], [-5.2, -2.2]]);
    sc.capacitor([-5.2, -2.2], [-5.2, -6.5], "", true);
    sc.node(T.E[0], -2.2);
    d.text("C_E", -4.6, -4.3, { size: 10, align: "left" });
  }
  // entrada e saída
  sc.capacitor([-14.6, 0], [-12, 0]);
  sc.wire([[-14.6, 0], [-15.6, 0], [-15.6, -1.2]]);
  sc.acSource(-15.6, -2.2);
  sc.wire([[-15.6, -3.2], [-15.6, -6.5], [-12, -6.5]]);
  d.text("v_in", -15.6, 0.5, { size: 11, color: th.series[0]! });
  sc.wire([[T.C[0], 3.2], [-5.4, 3.2]]);
  sc.capacitor([-5.4, 3.2], [-3.6, 3.2]);
  sc.node(T.C[0], 3.2);
  d.dot(-3.4, 3.2, 3.5, th.series[1]!);
  d.text("v_out", -3.4, 3.8, { size: 11, color: th.series[1]!, weight: "600" });
  d.text("Amplificador emissor-comum", -16.5, 8.7, { size: 14, weight: "700", align: "left" });
  const b = A.bias;
  d.text(`Q: V_B = ${fmt(b.vb)} V, V_E = ${fmt(b.ve)} V, V_C = ${fmt(b.vc)} V, I_C = ${fmt(b.ic * 1e3)} mA`, -16.5, -8.5, { size: 11, align: "left", color: th.muted });

  // osciloscópio
  const box = { x0: -1.2, y0: -2.4, x1: 16.2, y1: 7.6 };
  d.rect(box.x0, box.y0, box.x1 - box.x0, box.y1 - box.y0, { fill: th.dark ? "#0d1a12" : "#f3f8f2" });
  const vmaxIn = A.amp * 1.25;
  const vmaxOut = Math.max(Math.max(...A.vout.map(Math.abs)), 1e-3) * 1.25;
  const pl = panel(d, box, { min: 0, max: 2 }, { min: -1, max: 1 });
  pl.frame({ xticks: [0, 0.5, 1, 1.5, 2], yticks: [-1, -0.5, 0, 0.5, 1], fx: (v) => `${fmt(v)} T`, fy: () => "" });
  const n = A.vin.length;
  const trace = (arr: number[], vmax: number, color: string) => {
    const pts: [number, number][] = [];
    for (let k = 0; k <= 2 * n; k++) pts.push([k / n, arr[k % n]! / vmax]);
    pl.line(pts, { color, width: 2.2 });
  };
  trace(A.vin, vmaxIn, th.series[0]!);
  trace(A.vout, vmaxOut, th.series[1]!);
  const ph = (t * 0.5) % 2;
  d.line(pl.X(ph), box.y0, pl.X(ph), box.y1, { color: th.muted, width: 1, alpha: 0.5 });
  d.text(`CH1 v_in: ${fmt((vmaxIn * 1e3) / 2)} mV/div`, box.x0 + 0.2, box.y1 + 0.5, { size: 11, align: "left", color: th.series[0]! });
  d.text(`CH2 v_out: ${fmt(vmaxOut / 2)} V/div`, box.x1, box.y1 + 0.5, { size: 11, align: "right", color: th.series[1]! });
  // espectro e leituras
  const sb = { x0: 9.6, y0: -8.3, x1: 16.2, y1: -4.1 };
  const ps = panel(d, sb, { min: 0.5, max: 6.5 }, { min: 0, max: 1 });
  ps.frame({ xticks: [1, 2, 3, 4, 5, 6], yticks: [0, 1], xlabel: "harmônico", fy: (v) => (v === 1 ? "A₁" : "0") });
  A.A.slice(0, 6).forEach((a, k) => {
    const h = a / Math.max(A.A[0]!, 1e-12);
    d.rect(ps.X(k + 1 - 0.25), ps.Y(0), ps.X(k + 1.25) - ps.X(k + 1 - 0.25), ps.Y(Math.min(h, 1)) - ps.Y(0), { fill: k === 0 ? th.series[1]! : th.series[3]! });
  });
  const x = -1.2;
  d.text(`Ganho medido |A_v| = ${fmt(A.gain)}`, x, -4.4, { size: 13, align: "left", weight: "700" });
  d.text(`Pequenos sinais: A_v = ${c.bypass ? "−g_m (R_C ∥ r_o)" : "−R_C/(R_E + r_e)"} = ${fmt(A.theory)}`, x, -5.3, { size: 11, align: "left" });
  d.text(`Distorção harmônica total: ${fmt(A.thd * 100)} %`, x, -6.2, { size: 11, align: "left", color: A.thd > 0.05 ? th.series[3]! : th.text, weight: "600" });
  d.text("Saída invertida (fase 180°) em relação à entrada.", x, -7.1, { size: 11, align: "left", color: th.muted });
  d.text(c.bypass ? "Com C_E: ganho alto, mas depende de I_C e distorce." : "Sem C_E: realimentação em R_E, ganho menor e estável.", x, -8.0, { size: 11, align: "left", color: th.muted });
}

// ------------------------------------------------------------ desenho: retificadores
function drawRect(d: Draw, p: Params, s: TRState, t: number) {
  const th = d.theme;
  const sc = schematic(d);
  const rp = rectParams(p);
  const bridge = rp.bridge;
  const vs = rp.Vp * Math.sin(2 * Math.PI * rp.f * t);
  const conduct = s.i > 1e-3;
  if (!bridge) {
    sc.acSource(-15, 0, "v_s");
    sc.wire([[-15, 0.95], [-15, 3], [-13.2, 3]]);
    sc.diode([-13.2, 3], [-9.8, 3], conduct);
    sc.wire([[-9.8, 3], [-3.6, 3]]);
    sc.wire([[-15, -0.95], [-15, -6], [-3.6, -6]]);
  } else {
    const L: [number, number] = [-12, 0], R: [number, number] = [-7, 0], Tp: [number, number] = [-9.5, 2.5], B: [number, number] = [-9.5, -2.5];
    sc.acSource(-15, 0, "v_s");
    sc.wire([[-15, 0.95], [-15, 4.5], [-9.5, 4.5], Tp]);
    sc.wire([[-15, -0.95], [-15, -4.5], [-12.3, -4.5]]);
    sc.hopH(-12.3, -9.5, -4.5, -12);
    sc.wire([[-9.5, -4.5], B]);
    const pos = vs > 0;
    sc.diode(Tp, R, conduct && pos);
    sc.diode(L, B, conduct && pos);
    sc.diode(B, R, conduct && !pos);
    sc.diode(L, Tp, conduct && !pos);
    sc.wire([R, [-6, 0], [-6, 3], [-3.6, 3]]);
    sc.wire([L, [-12, -6], [-3.6, -6]]);
    for (const n of [L, R, Tp, B]) sc.node(n[0], n[1]);
  }
  if (rp.C > 0) {
    sc.capacitor([-5.2, 3], [-5.2, -6], "", true);
    d.text(`C = ${fmt(rp.C * 1e6)} µF`, -5.2, -3.4, { size: 10, align: "right", dx: -8 });
    sc.node(-5.2, 3);
    sc.node(-5.2, -6);
  }
  sc.resistor([-3.6, 3], [-3.6, -6], "", 1);
  d.text(`R_L = ${fmt(rp.R)} Ω`, -3.6, -6.8, { size: 10 });
  sc.ground(-8, -6);
  d.text(bridge ? "Retificador em ponte (onda completa)" : "Retificador de meia onda", -16.5, 8.7, { size: 14, weight: "700", align: "left" });
  d.text(`v_s = ${fmt(num(p, "Vrms", 12))} V ef. (pico ${fmt(rp.Vp)} V), ${fmt(rp.f)} Hz`, -16.5, 7.8, { size: 11, align: "left", color: th.muted });
  if (bridge) d.text("Os diodos verdes conduzem; a corrente na carga tem sempre o mesmo sentido.", -16.5, 6.9, { size: 10, align: "left", color: th.muted });

  // osciloscópio (disparado no início de cada período da fonte)
  const box = { x0: -1.2, y0: -0.6, x1: 16.2, y1: 7.6 };
  d.rect(box.x0, box.y0, box.x1 - box.x0, box.y1 - box.y0, { fill: th.dark ? "#0d1a12" : "#f3f8f2" });
  const per = 1 / rp.f;
  const t0 = (Math.floor(t * rp.f) - 2) * per;
  const vm = rp.Vp * 1.15;
  const pl = panel(d, box, { min: 0, max: 2 * per * 1e3 }, { min: -vm, max: vm });
  pl.frame({ xlabel: "t (ms)", ylabel: "tensão (V)" });
  const sel = s.buf.filter((z) => z[0] >= t0 && z[0] <= t0 + 2 * per);
  pl.plot((x) => rp.Vp * Math.sin(2 * Math.PI * rp.f * (t0 + x / 1e3)), 0, 2 * per * 1e3, { color: th.muted, width: 1.3, dash: [5, 4] });
  pl.line(sel.map((z) => [(z[0] - t0) * 1e3, z[2]]), { color: th.series[1]!, width: 2.4 });
  d.text("v_s (tracejada)", box.x1 - 3.2, box.y1 + 0.5, { size: 11, align: "right", color: th.muted });
  d.text("v_carga", box.x1, box.y1 + 0.5, { size: 11, align: "right", color: th.series[1]!, weight: "600" });
  // corrente nos diodos
  const ib = { x0: -1.2, y0: -8.2, x1: 7.2, y1: -3.2 };
  const imax = Math.max(s.last.imax, rp.Vp / rp.R, 1e-3) * 1.15;
  const pi = panel(d, ib, { min: 0, max: 2 * per * 1e3 }, { min: 0, max: imax * 1e3 });
  pi.frame({ xlabel: "t (ms)", ylabel: "i nos diodos (mA)", xticks: [] });
  pi.line(sel.map((z) => [(z[0] - t0) * 1e3, z[3] * 1e3]), { color: th.series[3]!, width: 2 });
  // leituras
  const L = s.last;
  const x = 8.2;
  const rows: [string, string][] = [
    ["V_máx", L.ok ? `${fmt(L.max)} V` : "…"],
    ["V_DC (média)", L.ok ? `${fmt(L.mean)} V` : "…"],
    ["ondulação ΔV", L.ok ? `${fmt(L.max - L.min)} V` : "…"],
    ["ΔV ≈ V/(f_r R C)", rp.C > 0 && L.ok ? `${fmt(rippleApprox(rp, L.mean))} V` : "—"],
    ["pico de i_D", L.ok ? `${fmt(L.imax * 1e3)} mA` : "…"],
    ["freq. da ondulação", `${fmt(rp.f * (bridge ? 2 : 1))} Hz`],
  ];
  rows.forEach(([k, v], i) => {
    d.text(k, x, -3.4 - i * 0.85, { size: 11, align: "left", color: th.muted });
    d.text(v, x + 4.6, -3.4 - i * 0.85, { size: 12, align: "left", weight: "600" });
  });
}

// ------------------------------------------------------------ desenho: sensores
const LDR_POS = { x: -4.2, y: -5 };
export const lampX = (dist: number) => LDR_POS.x - 1.2 - dist * 8;
function drawSensors(d: Draw, p: Params, s: TRState) {
  const th = d.theme;
  const sc = schematic(d);
  const S = sensorOf(p, s);
  d.text("Sensores em divisor de tensão", -16.5, 8.7, { size: 14, weight: "700", align: "left" });
  // NTC
  const dividerAt = (x: number, yTop: number, label: string, Rs: number, V: number, warmth: string) => {
    sc.wire([[x, yTop], [x, yTop - 0.6]]);
    d.text(`+${fmt(S.vcc)} V`, x, yTop, { size: 10, dy: -8 });
    sc.resistor([x, yTop - 0.6], [x, yTop - 3.4], "", 1, warmth);
    d.text(`${label} ${fmt(Rs / 1000)} kΩ`, x - 0.9, yTop - 2, { size: 11, align: "right", color: warmth, weight: "600" });
    sc.resistor([x, yTop - 3.4], [x, yTop - 6.2], `${fmt(S.rf / 1000)} kΩ`, -1);
    sc.ground(x, yTop - 6.2);
    sc.node(x, yTop - 3.4);
    sc.wire([[x, yTop - 3.4], [x + 1.4, yTop - 3.4]]);
    d.dot(x + 1.5, yTop - 3.4, 3.5, th.series[1]!);
    d.text(`${fmt(V)} V`, x + 1.8, yTop - 3.4, { size: 12, align: "left", weight: "700", color: th.series[1]! });
  };
  // termistor no banho
  const hot = clamp((S.T + 10) / 110, 0, 1);
  const bath = `rgb(${Math.round(80 + 170 * hot)}, ${Math.round(140 - 60 * hot)}, ${Math.round(220 - 170 * hot)})`;
  d.rect(-15.6, 0.6, 3.2, 3.6, { fill: bath, alpha: 0.3, stroke: th.muted, width: 1 });
  d.text(`${fmt(S.T)} °C`, -14, 0.1, { size: 12, weight: "700" });
  dividerAt(-11, 7, "NTC", S.Rn, S.Vn, th.series[1]!);
  sc.wire([[-11, 5.4], [-12.4, 5.4], [-12.4, 4.6], [-13.4, 3.6]]);
  d.dot(-13.6, 3.3, 5, th.series[1]!);
  const fan = S.Vn > S.vref;
  d.text(fan ? "ventilador LIGADO (V > V_ref)" : "ventilador desligado", -16.5, -0.9, { size: 11, align: "left", color: fan ? th.series[2]! : th.muted, weight: "600" });
  // LDR e lâmpada arrastável
  dividerAt(LDR_POS.x, -0.5, "LDR", S.Rl, S.Vl, th.series[4]!);
  const lx = lampX(s.dist);
  const ly = -2.2;
  const glow = clamp(Math.log10(S.E + 1) / 4, 0, 1);
  d.circle(lx, ly, 0.6, { fill: "#f5c542", stroke: th.text, width: 1.2 });
  for (let k = 0; k < 4; k++) d.arrowPx(lx + 0.8, ly - 0.3 + 0.2 * k, 1, -0.05 + 0.03 * k, 18 + 20 * glow, { color: "#e0a400", width: 1.2, head: 5 });
  d.text("lâmpada (arraste)", lx, ly - 1.1, { size: 10, color: th.accent });
  d.text(`d = ${fmt(s.dist)} m  →  E = ${fmt(S.E)} lux`, -16.5, -4.4, { size: 11, align: "left" });
  const lamp = S.Vl < S.vref;
  d.text(lamp ? "luz noturna ACESA (V < V_ref)" : "luz noturna apagada", -16.5, -8.6, { size: 11, align: "left", color: lamp ? th.series[2]! : th.muted, weight: "600" });

  // V(T)
  const b1 = { x0: 1.6, y0: 1.4, x1: 16.2, y1: 7.6 };
  const p1 = panel(d, b1, { min: -10, max: 100 }, { min: 0, max: S.vcc });
  p1.frame({ xlabel: "T (°C)", ylabel: "V_saída (V)" });
  p1.plot((T) => divider(S.vcc, ntcR(T), S.rf), -10, 100, { color: th.series[1]!, width: 2.2 });
  const ropt = ntcR(S.T);
  p1.plot((T) => divider(S.vcc, ntcR(T), ropt), -10, 100, { color: th.muted, width: 1.2, dash: [5, 4] });
  p1.line([[-10, S.vref], [100, S.vref]], { color: th.series[2]!, width: 1, dash: [2, 3] });
  d.dot(p1.X(S.T), p1.Y(S.Vn), 5, th.series[1]!);
  // V(E)
  const b2 = { x0: 1.6, y0: -7.6, x1: 16.2, y1: -1.4 };
  const p2 = panel(d, b2, { min: 0.1, max: 10000, log: true }, { min: 0, max: S.vcc });
  p2.frame({ xlabel: "E (lux)", ylabel: "V_saída (V)", fx: (v) => fmt(v) });
  p2.plot((E) => divider(S.vcc, ldrR(E), S.rf), 0.1, 10000, { color: th.series[4]!, width: 2.2 });
  p2.plot((E) => divider(S.vcc, ldrR(E), ldrR(S.E)), 0.1, 10000, { color: th.muted, width: 1.2, dash: [5, 4] });
  p2.line([[0.1, S.vref], [10000, S.vref]], { color: th.series[2]!, width: 1, dash: [2, 3] });
  d.dot(p2.X(clamp(S.E, 0.1, 1e4)), p2.Y(S.Vl), 5, th.series[4]!);
  d.text("tracejado: R_fixo = R_sensor no ponto atual (máxima sensibilidade)", 16.2, -8.9, { size: 10, align: "right", color: th.muted });
}

// ------------------------------------------------------------ simulação
export const transistorRetificador = defineSim<TRState>({
  id: "transistor-retificador",
  title: "Transistor, retificador, termistor e LDR",
  course: "FG III",
  topic: "Circuitos",
  priority: "P2",
  summary:
    "Curvas I_C × V_CE com reta de carga, transistor como chave e amplificador emissor-comum no osciloscópio (ganho e distorção), retificadores de meia onda e em ponte com filtro capacitivo, e sensores NTC e LDR em divisor de tensão.",
  equations: [
    String.raw`I_C = \beta I_B \left(1 + \frac{V_{CE}}{V_A}\right) \ \text{(ativa)} \qquad I_C = I_s\left(e^{V_{BE}/V_T} - e^{V_{BC}/V_T}\right) - \tfrac{I_s}{\beta_R}\left(e^{V_{BC}/V_T}-1\right)`,
    String.raw`V_{CE} = V_{CC} - R_C I_C \qquad A_v \approx -g_m R_C = -\frac{I_C}{V_T}R_C`,
    String.raw`i_D = I_s\left(e^{v_D/nV_T} - 1\right) \qquad \Delta V \approx \frac{V_{DC}}{f_r R_L C}`,
    String.raw`R_{NTC} = R_{25}\,e^{B(1/T - 1/T_{25})} \qquad R_{LDR} = R_{10}\left(\frac{E}{10\ \text{lx}}\right)^{-\gamma} \qquad V = V_{cc}\frac{R_f}{R_s + R_f}`,
  ],
  liveEquations(s, p) {
    const m = modo(p);
    if (m === 0) {
      const Q = qOf(p);
      return [String.raw`I_B = ${texNum(Q.ib * 1e6)}\ \mu\text{A} \Rightarrow I_C = ${texNum(Q.ic * 1e3)}\ \text{mA},\ V_{CE} = ${num(p, "VCC", 12)} - ${texNum(num(p, "RC", 2200))}\cdot I_C = ${texNum(Q.vce)}\ \text{V}`];
    }
    if (m === 1) {
      const r = switchState(p, s);
      return [String.raw`I_B = \frac{V_{in} - V_{BE}}{R_B} = ${texNum(r.ib * 1e3)}\ \text{mA} \quad I_C = ${texNum(r.ic * 1e3)}\ \text{mA} \quad V_{CE} = ${texNum(r.vce)}\ \text{V}`];
    }
    if (m === 2) {
      const A = ampOf(p);
      return [
        String.raw`g_m = \frac{I_C}{V_T} = \frac{${texNum(A.bias.ic * 1e3)}\ \text{mA}}{25{,}9\ \text{mV}} = ${texNum(A.bias.ic / 0.025852)}\ \text{S}`,
        String.raw`|A_v|_{\text{medido}} = ${texNum(A.gain)} \quad A_v^{\text{teo}} = ${texNum(A.theory)} \quad \text{THD} = ${texNum(A.thd * 100)}\ \%`,
      ];
    }
    if (m === 3 || m === 4) {
      const rp = rectParams(p);
      const L = s.last;
      return [
        String.raw`V_p = \sqrt2\,V_{ef} = ${texNum(rp.Vp)}\ \text{V} \quad V_{DC} = ${texNum(L.mean)}\ \text{V} \quad \Delta V = ${texNum(L.max - L.min)}\ \text{V}`,
        String.raw`f_r = ${texNum(rp.f * (rp.bridge ? 2 : 1))}\ \text{Hz}`,
      ];
    }
    const S = sensorOf(p, s);
    return [
      String.raw`R_{NTC}(${texNum(S.T)}\,^\circ\text{C}) = ${texNum(S.Rn / 1000)}\ \text{k}\Omega \Rightarrow V = ${texNum(S.Vn)}\ \text{V}`,
      String.raw`R_{LDR}(${texNum(S.E)}\ \text{lx}) = ${texNum(S.Rl / 1000)}\ \text{k}\Omega \Rightarrow V = ${texNum(S.Vl)}\ \text{V}`,
    ];
  },
  params: [
    { key: "modo", label: "Experimento", unit: "", min: 0, max: MODOS.length - 1, step: 1, default: 0, options: MODOS.map((label, value) => ({ value, label })) },
    { key: "beta", label: "Ganho de corrente β", unit: "", min: 50, max: 300, step: 1, default: 150, live: true },
    { key: "VCC", label: "Alimentação V_CC", unit: "V", min: 3, max: 20, step: 0.5, default: 12, live: true },
    { key: "IB", label: "Corrente de base I_B (curvas)", unit: "µA", min: 0, max: 80, step: 1, default: 30, live: true },
    { key: "RC", label: "Resistor de coletor R_C", unit: "Ω", min: 470, max: 10000, step: 10, default: 2200, log: true, live: true },
    { key: "Vin", label: "Tensão de comando V_in (chave)", unit: "V", min: 0.5, max: 10, step: 0.1, default: 5, live: true },
    { key: "RB", label: "Resistor de base R_B (chave)", unit: "Ω", min: 100, max: 1000000, step: 10, default: 1000, log: true, live: true },
    { key: "RL", label: "Carga R_L (lâmpada ou retificador)", unit: "Ω", min: 10, max: 10000, step: 1, default: 100, log: true, live: true },
    { key: "vin", label: "Amplitude do sinal de entrada", unit: "mV", min: 1, max: 1000, step: 1, default: 5, log: true, live: true },
    { key: "R1", label: "Resistor de polarização R₁", unit: "kΩ", min: 20, max: 120, step: 1, default: 47, live: true },
    { key: "desvio", label: "Capacitor de desvio C_E", unit: "", min: 0, max: 1, step: 1, default: 1, live: true, options: [{ value: 1, label: "Com C_E (emissor aterrado no sinal)" }, { value: 0, label: "Sem C_E (realimentação por R_E)" }] },
    { key: "Vrms", label: "Tensão eficaz do secundário", unit: "V", min: 3, max: 24, step: 0.5, default: 12, live: true },
    { key: "f", label: "Frequência da rede", unit: "Hz", min: 20, max: 200, step: 1, default: 60, live: true },
    { key: "filtro", label: "Filtro capacitivo", unit: "", min: 0, max: 1, step: 1, default: 1, live: true, options: [{ value: 1, label: "Com capacitor" }, { value: 0, label: "Sem capacitor" }] },
    { key: "C", label: "Capacitor de filtro C", unit: "µF", min: 10, max: 10000, step: 1, default: 470, log: true, live: true },
    { key: "T", label: "Temperatura do NTC", unit: "°C", min: -10, max: 100, step: 0.5, default: 25, live: true },
    { key: "E1", label: "Lâmpada: iluminância a 1 m", unit: "lux", min: 1, max: 1000, step: 1, default: 100, log: true, live: true },
    { key: "Rfix", label: "Resistor fixo dos divisores", unit: "kΩ", min: 1, max: 100, step: 0.1, default: 10, log: true, live: true },
    { key: "Vcc", label: "Alimentação dos divisores", unit: "V", min: 1, max: 12, step: 0.1, default: 5, live: true },
    { key: "Vref", label: "Limiar do comparador V_ref", unit: "V", min: 0.1, max: 12, step: 0.05, default: 2.5, live: true },
  ],
  observables: [
    { key: "IC", label: "Corrente de coletor I_C", unit: "mA", value: (s, p) => (modo(p) === 1 ? switchState(p, s).ic : modo(p) === 2 ? ampOf(p).bias.ic : qOf(p).ic) * 1e3 },
    { key: "VCE", label: "Tensão coletor–emissor V_CE", unit: "V", value: (s, p) => (modo(p) === 1 ? switchState(p, s).vce : modo(p) === 2 ? ampOf(p).bias.vce : qOf(p).vce) },
    { key: "IBm", label: "Corrente de base I_B", unit: "µA", value: (s, p) => (modo(p) === 1 ? switchState(p, s).ib : modo(p) === 2 ? ampOf(p).bias.ib : qOf(p).ib) * 1e6 },
    { key: "Iprobe", label: "I_C no cursor de V_CE", unit: "mA", value: (s, p) => icCurve(bjt(p), num(p, "IB", 30) * 1e-6, s.probe) * 1e3 },
    { key: "Av", label: "Ganho de tensão medido |A_v|", unit: "", value: (_s, p) => (modo(p) === 2 ? ampOf(p).gain : 0) },
    { key: "thd", label: "Distorção harmônica total", unit: "%", value: (_s, p) => (modo(p) === 2 ? ampOf(p).thd * 100 : 0) },
    { key: "vo", label: "Tensão na carga do retificador", unit: "V", value: (s) => s.vo },
    { key: "Vdc", label: "Tensão média na carga V_DC", unit: "V", value: (s) => (s.last.ok ? s.last.mean : 0) },
    { key: "ripple", label: "Ondulação pico a pico ΔV", unit: "V", value: (s) => (s.last.ok ? s.last.max - s.last.min : 0) },
    { key: "iD", label: "Corrente nos diodos", unit: "A", value: (s) => s.i },
    { key: "Rntc", label: "Resistência do NTC", unit: "kΩ", value: (s, p) => sensorOf(p, s).Rn / 1000 },
    { key: "Vntc", label: "Saída do divisor do NTC", unit: "V", value: (s, p) => sensorOf(p, s).Vn },
    { key: "E", label: "Iluminância no LDR", unit: "lux", value: (s, p) => lux(p, s) },
    { key: "Rldr", label: "Resistência do LDR", unit: "kΩ", value: (s, p) => sensorOf(p, s).Rl / 1000 },
    { key: "Vldr", label: "Saída do divisor do LDR", unit: "V", value: (s, p) => sensorOf(p, s).Vl },
  ],
  chart: { x: "t", y: "vo" },
  scenarios: [
    {
      id: "curvas",
      label: "Curvas características e reta de carga",
      params: { modo: 0, IB: 30, VCC: 12, RC: 2200, beta: 150 },
      guide: `### O transistor como fonte de corrente controlada
1. Cada curva cinza é $I_C(V_{CE})$ para um $I_B$ fixo. Acima de $V_{CE} \\approx 0{,}3$ V (região **ativa**) a curva é quase horizontal: $I_C \\approx \\beta I_B$, levemente inclinada pelo efeito Early.
2. Arraste o cursor azul no gráfico e leia $I_C$ em vários $V_{CE}$.
3. A reta tracejada é a **reta de carga**: $V_{CE} = V_{CC} - R_C I_C$. O ponto Q é onde ela cruza a curva do $I_B$ escolhido.
4. Aumente $I_B$ até Q chegar à região sombreada: o transistor **satura** e $I_C$ deixa de crescer.
5. Diminua $R_C$: a reta fica mais inclinada e é preciso mais $I_B$ para saturar.`,
      predict: [
        {
          question: "Na região ativa, se você dobrar I_B, o que acontece com I_C?",
          options: ["Dobra também", "Fica igual", "Cai à metade", "Quadruplica"],
          answer: 0,
          explanation: "Na região ativa $I_C \\approx \\beta I_B$: a corrente de coletor é proporcional à de base. Isso só vale enquanto o ponto Q não chega à saturação.",
        },
      ],
    },
    {
      id: "amplificador",
      label: "Amplificador emissor-comum no osciloscópio",
      params: { modo: 2, vin: 5, desvio: 1, R1: 47, RC: 2200, VCC: 12, beta: 150 },
      guide: `### Ganho, inversão e distorção
1. O sinal $v_{in}$ (CH1) entra na base; a saída (CH2) é tomada no coletor. Compare as escalas: o ganho é a razão das amplitudes.
2. Com o capacitor $C_E$, o ganho é $|A_v| \\approx g_m R_C = I_C R_C / V_T$: confira o valor medido com o previsto.
3. Repare na **inversão de fase**: quando $v_{in}$ sobe, $I_C$ cresce e $V_C$ cai.
4. Aumente a amplitude para 50 mV e depois 200 mV: a saída deforma (exponencial do diodo base–emissor, depois corte e saturação). O espectro mostra os harmônicos e a THD.
5. Retire $C_E$: o ganho cai para $\\approx R_C/R_E$, mas a forma de onda fica limpa — é a realimentação negativa.
6. Mude $R_1$: o ponto Q se desloca e o ceifamento fica assimétrico.`,
      predict: [
        {
          question: "Ao retirar o capacitor de desvio do emissor, o ganho do amplificador...",
          options: ["aumenta muito", "diminui bastante (fica perto de R_C/R_E)", "não muda", "inverte de sinal"],
          answer: 1,
          explanation: "Sem $C_E$, o sinal também aparece sobre $R_E$ e reduz o $v_{BE}$ efetivo: $A_v \\approx -R_C/(R_E + r_e) \\approx -2{,}2$, contra mais de 100 com o emissor aterrado no sinal.",
        },
      ],
    },
    {
      id: "ponte",
      label: "Retificador em ponte com filtro",
      params: { modo: 4, Vrms: 12, f: 60, RL: 1000, filtro: 1, C: 470 },
      guide: `### Da rede alternada para tensão contínua
1. Na ponte, dois diodos conduzem em cada semiciclo (verdes no esquema): a carga recebe os dois semiciclos com o mesmo sentido.
2. O pico na carga é $V_p - 2V_D$: cerca de 1,5 V abaixo do pico do secundário.
3. Com o capacitor, a tensão só cai um pouco entre os picos. Compare a ondulação medida com $\\Delta V \\approx V_{DC}/(2fR_LC)$.
4. Veja a corrente nos diodos: pulsos estreitos e altos, só perto dos picos, quando o capacitor é recarregado.
5. Troque para **meia onda** (Experimento): a ondulação dobra, pois o capacitor espera um período inteiro.
6. Desligue o filtro: a média cai para $\\approx 2V_p/\\pi$.`,
      predict: [
        {
          question: "Na rede de 60 Hz, qual é a frequência da ondulação na saída da ponte?",
          options: ["30 Hz", "60 Hz", "120 Hz", "Não há ondulação"],
          answer: 2,
          explanation: "A ponte entrega um pulso a cada semiciclo: são dois por período, então a ondulação tem $2f = 120$ Hz. Na meia onda seria 60 Hz.",
        },
      ],
    },
    {
      id: "sensores",
      label: "Sensores: termistor NTC e LDR",
      params: { modo: 5, T: 25, E1: 100, Rfix: 10, Vcc: 5, Vref: 2.5 },
      guide: `### Resistores que medem o ambiente
1. O **NTC** tem coeficiente de temperatura negativo: aqueça e sua resistência cai exponencialmente ($B = 3950$ K).
2. No divisor, a tensão no resistor fixo $V = V_{cc}R_f/(R_s + R_f)$ sobe quando o NTC esquenta: o comparador liga o ventilador acima de $V_{ref}$.
3. **Arraste a lâmpada**: a iluminância segue o inverso do quadrado da distância e a resistência do LDR cai como $E^{-0{,}7}$.
4. A curva tracejada mostra o divisor com $R_f = R_{sensor}$ no ponto atual: é a escolha de **máxima sensibilidade** $dV/dT$ ali.
5. Ajuste $V_{ref}$ para a luz noturna acender quando escurece.`,
      predict: [
        {
          question: "Aquecendo o NTC (sensor em cima, resistor fixo embaixo), a tensão no resistor fixo...",
          options: ["aumenta", "diminui", "não muda", "inverte de sinal"],
          answer: 0,
          explanation: "A resistência do NTC cai com a temperatura; o resistor fixo passa a ficar com uma fração maior de $V_{cc}$.",
        },
      ],
    },
  ],
  exercises: [
    {
      id: "ondulacao",
      prompt:
        "Um retificador em ponte alimentado pela rede de {f} Hz entrega V_DC = {Vdc} V a uma carga de {RL} Ω, com capacitor de filtro de {C} µF. Estime a ondulação pico a pico ΔV ≈ V_DC/(2 f R C), em volts.",
      vary: { f: [50, 60, 0], Vdc: [10, 30, 1], RL: [200, 2000, 0], C: [220, 2200, 0] },
      fixed: { modo: 4 },
      answer: { label: "ΔV", unit: "V", compute: (p) => num(p, "Vdc") / (2 * num(p, "f") * num(p, "RL") * num(p, "C") * 1e-6) },
      hint: "Entre dois picos (1/2f) o capacitor fornece a corrente V_DC/R: ΔV = I Δt / C.",
    },
    {
      id: "ponto-q",
      prompt:
        "Um transistor com β = {beta} recebe I_B = {IB} µA. O coletor está ligado a V_CC = {VCC} V por R_C = {RC} Ω. Supondo região ativa (I_C = βI_B), qual é V_CE, em volts?",
      vary: { beta: [80, 200, 0], IB: [5, 20, 0], VCC: [10, 15, 0], RC: [1000, 2200, 0] },
      fixed: { modo: 0 },
      answer: { label: "V_CE", unit: "V", compute: (p) => num(p, "VCC") - num(p, "beta") * num(p, "IB") * 1e-6 * num(p, "RC") },
      tolerance: 0.03,
      hint: "V_CE = V_CC − R_C β I_B.",
    },
    {
      id: "ntc",
      prompt: "Um termistor NTC tem R = 10 kΩ a 25 °C e B = 3950 K. Qual é sua resistência a {T} °C, em kΩ?",
      vary: { T: [0, 90, 0] },
      fixed: { modo: 5 },
      answer: { label: "R", unit: "kΩ", compute: (p) => ntcR(num(p, "T")) / 1000 },
      hint: "R = R₂₅ e^{B(1/T − 1/298,15 K)}, com T em kelvin.",
    },
  ],

  init: (p) => ({
    vo: 0,
    i: 0,
    buf: [],
    per: { k: 0, max: -Infinity, min: Infinity, sum: 0, n: 0, imax: 0 },
    last: { max: 0, min: 0, mean: 0, imax: 0, ok: false },
    sw: 1,
    probe: num(p, "VCC", 12) * 0.5,
    dist: 0.5,
    drag: null,
  }),
  step(s, p, t, dt) {
    return isRect(p) ? stepRect(s, p, t, dt) : s;
  },
  dt: 1e-3,
  sampleEvery: 10,
  maxSamples: 3000,

  viewport: () => ({ ...VIEW, unit: "" }),
  render(ctx, frame) {
    const d = draw(ctx, frame);
    const { state: s, params: p, t } = frame;
    switch (modo(p)) {
      case 0:
        return drawCurves(d, p, s);
      case 1:
        return drawSwitch(d, p, s);
      case 2:
        return drawAmp(d, p, t);
      case 3:
      case 4:
        return drawRect(d, p, s, t);
      default:
        return drawSensors(d, p, s);
    }
  },

  pointer: {
    down(s, p, pt) {
      const m = modo(p);
      if (m === 0 && pt.x >= CURVE_BOX.x0 && pt.x <= CURVE_BOX.x1 && pt.y >= CURVE_BOX.y0 && pt.y <= CURVE_BOX.y1) {
        const { vmax } = curveRange(p);
        return { ...s, drag: "probe", probe: ((pt.x - CURVE_BOX.x0) / (CURVE_BOX.x1 - CURVE_BOX.x0)) * vmax };
      }
      if (m === 1 && Math.abs(pt.x - SWITCH.x) < 1.8 && Math.abs(pt.y - SWITCH.y) < 1.6) return { ...s, sw: s.sw > 0.5 ? 0 : 1 };
      if (m === 5 && Math.hypot(pt.x - lampX(s.dist), pt.y + 2.2) < 1.3) return { ...s, drag: "lamp" };
      return undefined;
    },
    move(s, p, pt, dragging) {
      if (!dragging || !s.drag) return undefined;
      if (s.drag === "probe") {
        const { vmax } = curveRange(p);
        return { ...s, probe: clamp(((pt.x - CURVE_BOX.x0) / (CURVE_BOX.x1 - CURVE_BOX.x0)) * vmax, 0, vmax) };
      }
      return { ...s, dist: clamp((LDR_POS.x - 1.2 - pt.x) / 8, 0.05, 1.3) };
    },
    up: (s) => (s.drag ? { ...s, drag: null } : undefined),
    cursor(s, p, pt) {
      const m = modo(p);
      if (m === 0 && pt.x >= CURVE_BOX.x0 && pt.x <= CURVE_BOX.x1 && pt.y >= CURVE_BOX.y0 && pt.y <= CURVE_BOX.y1) return "ew-resize";
      if (m === 1 && Math.abs(pt.x - SWITCH.x) < 1.8 && Math.abs(pt.y - SWITCH.y) < 1.6) return "pointer";
      if (m === 5 && Math.hypot(pt.x - lampX(s.dist), pt.y + 2.2) < 1.3) return "grab";
      return undefined;
    },
  },
  actions: [
    { id: "chave", label: "Abrir/fechar a chave da base", run: (s) => ({ ...s, sw: s.sw > 0.5 ? 0 : 1 }), active: (s) => s.sw > 0.5 },
  ],
});

export default transistorRetificador;
