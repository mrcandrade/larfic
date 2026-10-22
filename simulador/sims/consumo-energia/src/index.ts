import { clamp, defineSim, draw, num, texNum, type Draw, type Params } from "@fisilab/core";
import {
  AMPACITY,
  APPLIANCES,
  BIMETAL_TAU,
  BREAKERS,
  C_WATER,
  FLAGS,
  GAUGES,
  LAMPS,
  MAGNETIC,
  THETA_TRIP,
  T_AMB,
  T_MAX,
  bill,
  dailyWh,
  isOn,
  lampCost,
  loopR,
  meterPower,
  powerAt,
  resistance,
  showerOut,
  tripTime,
  wireRise,
  wireTau,
} from "./model.ts";

export * from "./model.ts";

export interface CState {
  /** Relógio do modelo (s). */
  clock: number;
  /** Energia medida (Wh). */
  E: number;
  hours: number[];
  enabled: boolean[];
  /** Aparelhos tirados da tomada (sem standby). */
  unplug: boolean;
  plugged: boolean[];
  Tw: number;
  theta: number;
  tripped: boolean;
  short: boolean;
  /** Pico de temperatura do fio (°C). */
  Tpeak: number;
  revs: number;
  t0: number;
  tLastRev: number;
  drag: number | null;
}

export const KITCHEN = [
  { name: "Geladeira", P: 150 },
  { name: "Micro-ondas", P: 1200 },
  { name: "Air fryer", P: 1500 },
  { name: "Chaleira", P: 2000 },
  { name: "Cafeteira", P: 800 },
  { name: "Liquidificador", P: 600 },
];

export const METER_TEST = [
  { name: "Lâmpada incandescente", P: 60 },
  { name: "TV", P: 100 },
  { name: "Geladeira (compressor ligado)", P: 150 },
  { name: "Ferro de passar", P: 1000 },
  { name: "Secador de cabelo", P: 1800 },
  { name: "Chaleira elétrica", P: 2200 },
  { name: "Aparelho misterioso", P: 1350 },
];

export const mode = (p: Params) => Math.round(num(p, "modo"));
/** Segundos do modelo por segundo de simulação em cada modo. */
const SCALE = [3600, 60, 30 * 86400, 1, 1];
const timeScale = (p: Params) => SCALE[mode(p)] ?? 1;

const tariff = (p: Params) => num(p, "tarifa", 0.8);
const flagAdd = (p: Params) => FLAGS[Math.round(num(p, "bandeira"))]?.add ?? 0;
const tax = (p: Params) => num(p, "tributos", 25);
const voltage = (p: Params) => num(p, "V", 220);

/** Lista de aparelhos da casa com a potência das lâmpadas escolhidas. */
export function houseAppliances(p: Params) {
  const lamp = LAMPS[Math.round(num(p, "lampada", 2))] ?? LAMPS[2]!;
  return APPLIANCES.map((a, i) => (i === 2 ? { ...a, P: 8 * lamp.P } : i === 1 ? { ...a, P: num(p, "Pinv", 5500) } : a));
}

export const hourOfDay = (s: CState) => ((s.clock / 3600) % 24 + 24) % 24;

export function housePower(s: CState, p: Params, h = hourOfDay(s)): number {
  return houseAppliances(p).reduce((acc, a, i) => acc + (s.enabled[i] ? powerAt(a, s.hours[i] ?? 0, h, !s.unplug) : 0), 0);
}

/** Energia diária da casa (Wh), separando o standby. */
export function houseDaily(s: CState, p: Params) {
  let total = 0;
  let standby = 0;
  houseAppliances(p).forEach((a, i) => {
    if (!s.enabled[i]) return;
    const h = s.hours[i] ?? 0;
    total += dailyWh(a, h, !s.unplug);
    if (!s.unplug) standby += a.standby * (24 - h);
  });
  return { total, standby };
}

export const monthlyKWh = (s: CState, p: Params) => (30 * houseDaily(s, p).total) / 1000;

// Chuveiro
const showerP = (p: Params) => [0, num(p, "Pver", 3000), num(p, "Pinv", 5500)][Math.round(num(p, "chave", 2))] ?? 0;
export const showerMonthKWh = (p: Params) => (showerP(p) * (num(p, "banho", 10) / 60) * num(p, "pessoas", 3) * 30) / 1000;

// Disjuntor
const gauge = (p: Params) => Math.round(num(p, "bitola", 1));
export const Amm2 = (p: Params) => GAUGES[gauge(p)] ?? 2.5;
export const Iz = (p: Params) => AMPACITY[gauge(p)] ?? 24;
export const In = (p: Params) => BREAKERS[Math.round(num(p, "disjuntor", 2))] ?? 20;
const magnetic = (p: Params) => MAGNETIC[Math.round(num(p, "curva", 1))] ?? 10;
export function circuitCurrent(s: CState, p: Params): number {
  if (s.tripped) return 0;
  const V = voltage(p);
  if (s.short) return V / (loopR(num(p, "Lfio", 15), Amm2(p)) + 0.05);
  return KITCHEN.reduce((a, k, i) => a + (s.plugged[i] ? k.P : 0), 0) / V;
}

// Medidor
const testP = (p: Params) => METER_TEST[Math.round(num(p, "teste", 3))]?.P ?? 1000;
const Kd = (p: Params) => num(p, "Kd", 3.6);
export function measuredP(s: CState, p: Params): number {
  const n = Math.floor(s.revs + 1e-9);
  return n >= 1 && s.tLastRev > s.t0 ? meterPower(Kd(p), n, s.tLastRev - s.t0) : 0;
}

/** Potência instantânea do modo atual (W). */
export function powerNow(s: CState, p: Params): number {
  switch (mode(p)) {
    case 0:
      return housePower(s, p);
    case 1:
      return s.clock < num(p, "banho", 10) * 60 ? showerP(p) : 0;
    case 2:
      return 0;
    case 3:
      return s.short ? 0 : circuitCurrent(s, p) * voltage(p);
    default:
      return testP(p);
  }
}

// ---------------------------------------------------------------------------
// Desenho
// ---------------------------------------------------------------------------

const brl = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;
const fmt = (v: number, n = 1) => v.toFixed(n).replace(".", ",");
const ROW0 = 9.0;
const ROWH = 0.68;
const BAR0 = 11.0;
const BAR1 = 13.3;

function renderHouse(d: Draw, s: CState, p: Params) {
  const th = d.theme;
  const h = hourOfDay(s);
  const night = h < 6 || h >= 18;
  // Casa
  d.rect(0.3, 0.6, 6.4, 6.4, { fill: th.dark ? "#2b2f38" : "#f4efe6", stroke: th.muted });
  d.polyline([[0.1, 7], [3.5, 9.2], [6.9, 7]], { color: th.muted, width: 2, close: true, fill: th.dark ? "#4a3a35" : "#d9b8a0" });
  d.text(`${String(Math.floor(h)).padStart(2, "0")}:${String(Math.floor((h % 1) * 60)).padStart(2, "0")} ${night ? "☾" : "☀"}`, 3.5, 7.9, { size: 14, weight: "700" });
  const apps = houseAppliances(p);
  apps.forEach((a, i) => {
    const x = 0.6 + (i % 2) * 3.1;
    const y = 6.1 - Math.floor(i / 2) * 1.15;
    const on = s.enabled[i] && (a.spread ? (s.hours[i] ?? 0) > 0 : isOn(a, s.hours[i] ?? 0, h));
    const sb = s.enabled[i] && !on && !s.unplug && a.standby > 0;
    d.rect(x, y - 0.4, 2.9, 0.8, { fill: on ? th.series[5] : th.dark ? "#3a3f48" : "#e3e6ea", alpha: on ? 0.6 : 1, stroke: s.enabled[i] ? th.muted : th.grid });
    d.text(a.name, x + 0.12, y + 0.1, { size: 11, align: "left", color: s.enabled[i] ? th.text : th.muted });
    d.text(on ? `${a.P} W` : sb ? `standby ${fmt(a.standby, 1)} W` : "desligado", x + 0.12, y - 0.2, { size: 10, align: "left", color: sb ? th.positive : th.muted });
    if (sb) d.dot(x + 2.7, y + 0.2, 3, th.positive);
  });
  // Tabela
  d.text("aparelho (clique p/ incluir)", 7.2, ROW0 + 0.6, { size: 11, align: "left", color: th.muted });
  d.text("P", 10.4, ROW0 + 0.6, { size: 11, color: th.muted });
  d.text("horas por dia (arraste)", (BAR0 + BAR1) / 2, ROW0 + 0.6, { size: 11, color: th.muted });
  d.text("kWh/mês", 14.3, ROW0 + 0.6, { size: 11, color: th.muted });
  d.text("R$/mês", 15.4, ROW0 + 0.6, { size: 11, color: th.muted });
  const k = (tariff(p) + flagAdd(p)) / (1 - tax(p) / 100);
  apps.forEach((a, i) => {
    const y = ROW0 - i * ROWH;
    const hrs = s.hours[i] ?? 0;
    const en = s.enabled[i];
    d.rect(7.2, y - 0.14, 0.28, 0.28, { stroke: th.muted, fill: en ? th.accent : undefined, width: 1 });
    d.text(a.name, 7.6, y, { size: 11, align: "left", color: en ? th.text : th.muted });
    d.text(`${a.P}`, 10.4, y, { size: 11 });
    d.rect(BAR0, y - 0.12, BAR1 - BAR0, 0.24, { stroke: th.grid, width: 1 });
    d.rect(BAR0, y - 0.12, ((BAR1 - BAR0) * hrs) / 24, 0.24, { fill: th.accent, alpha: en ? 0.75 : 0.25 });
    d.text(`${fmt(hrs, 2)} h`, BAR1 + 0.05, y, { size: 10, align: "left", color: th.muted });
    const kwh = en ? (30 * dailyWh(a, hrs, !s.unplug)) / 1000 : 0;
    d.text(fmt(kwh, 1), 14.3, y, { size: 11 });
    d.text(fmt(kwh * k, 2), 15.4, y, { size: 11 });
  });
  // Conta
  const { total, standby } = houseDaily(s, p);
  const kwh = (30 * total) / 1000;
  const flag = FLAGS[Math.round(num(p, "bandeira"))]!;
  const y0 = 1.9;
  d.rect(7.1, 0.2, 8.8, 2.1, { stroke: th.muted, fill: th.dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)" });
  d.text(`Consumo: ${fmt(kwh, 0)} kWh/mês (standby: ${fmt((30 * standby) / 1000, 1)} kWh)`, 7.3, y0, { size: 12, align: "left" });
  d.text(`Energia: ${fmt(kwh, 0)} × ${brl(tariff(p))} = ${brl(kwh * tariff(p))}   Bandeira ${flag.name}: + ${brl(kwh * flag.add)}`, 7.3, y0 - 0.45, { size: 11, align: "left" });
  d.text(`Tributos (${fmt(tax(p), 0)} % por dentro): + ${brl(bill(kwh, tariff(p), flag.add, tax(p)) - kwh * (tariff(p) + flag.add))}`, 7.3, y0 - 0.9, { size: 11, align: "left" });
  d.text(`Total da conta: ${brl(bill(kwh, tariff(p), flag.add, tax(p)))}`, 7.3, y0 - 1.4, { size: 14, weight: "700", align: "left" });
  d.text(`Medidor hoje: ${fmt(s.E / 1000, 2)} kWh   P agora: ${fmt(housePower(s, p), 0)} W`, 0.3, 0.25, { size: 11, align: "left", color: th.muted });
}

function tempColor(T: number): string {
  const f = clamp((T - 15) / 30, 0, 1);
  return `rgb(${Math.round(60 + 195 * f)}, ${Math.round(120 + 40 * (1 - Math.abs(f - 0.5) * 2))}, ${Math.round(230 - 200 * f)})`;
}

function renderShower(d: Draw, s: CState, p: Params) {
  const th = d.theme;
  const P = showerP(p);
  const V = voltage(p);
  const Q = num(p, "vazao", 4);
  const Tin = num(p, "Tin", 18);
  const Tout = showerOut(P, Q, Tin);
  const bath = num(p, "banho", 10) * 60;
  const flowing = s.clock < bath;
  // Cano e chuveiro
  d.line(0.5, 9.3, 4, 9.3, { color: th.muted, width: 6 });
  d.line(4, 9.3, 4, 8.3, { color: th.muted, width: 6 });
  d.polyline([[3, 8.3], [5, 8.3], [4.6, 7.6], [3.4, 7.6]], { close: true, fill: th.dark ? "#8d99a8" : "#c3ccd6", color: th.muted });
  // Resistência em espiral com a parte ativa
  const key = Math.round(num(p, "chave", 2));
  for (let i = 0; i < 12; i++) {
    const active = key === 1 || (key === 2 && i < 12 * (num(p, "Pver", 3000) / num(p, "Pinv", 5500)));
    d.circle(3.3 + i * 0.12, 7.95, 0.06, { stroke: key === 0 || !active ? th.muted : th.positive, width: 2 });
  }
  d.text(["desligado", "verão (resistência inteira: R maior)", "inverno (trecho menor: R menor)"][key] ?? "", 4, 8.75, { size: 11, color: th.muted });
  if (flowing) {
    for (let i = 0; i < 26; i++) {
      const x = 3.45 + (i % 9) * 0.14;
      const y = 7.4 - (((s.clock * 0.9 + i * 0.37) % 1) * 6.5);
      d.dot(x + (y - 7.4) * (x - 4) * -0.05, y, 3, tempColor(Tout), 0.9);
    }
  }
  d.support(1, 0.5, 7, 0.5, { color: th.muted });
  // Painel
  const x = 8.2;
  const lines = [
    `P = ${fmt(P, 0)} W  em  ${V} V`,
    `R = V²/P = ${P > 0 ? fmt(resistance(V, P), 2) : "—"} Ω     I = P/V = ${fmt(P / V, 1)} A`,
    `Vazão ${fmt(Q, 1)} L/min:  ΔT = P/(ṁc) = ${fmt(Tout - Tin, 1)} °C`,
    `Água sai a ${fmt(Tout, 1)} °C  ${Tout < 35 ? "(fria demais)" : Tout > 42 ? "(quente demais)" : "(confortável)"}`,
    `Banho de ${fmt(bath / 60, 0)} min: ${fmt((P * bath) / 3.6e6, 2)} kWh`,
    `${fmt(num(p, "pessoas", 3), 0)} pessoas × 30 dias: ${fmt(showerMonthKWh(p), 0)} kWh/mês`,
    `Custo: ${brl(bill(showerMonthKWh(p), tariff(p), flagAdd(p), tax(p)))} por mês`,
  ];
  lines.forEach((l, i) => d.text(l, x, 8.8 - i * 0.75, { size: 13, align: "left", weight: i === 3 || i === 6 ? "700" : "400" }));
  const tt = Math.min(s.clock, bath);
  d.text(`tempo de banho: ${fmt(tt / 60, 1)} min   energia: ${fmt(s.E / 1000, 3)} kWh`, x, 2.8, { size: 12, align: "left", color: th.muted });
  // Termômetro
  d.rect(14.8, 3.5, 0.4, 5, { stroke: th.muted });
  d.rect(14.8, 3.5, 0.4, 5 * clamp((Tout - 10) / 50, 0, 1), { fill: tempColor(Tout) });
  d.text(`${fmt(Tout, 0)} °C`, 15, 3.1, { size: 12 });
}

function renderLamps(d: Draw, s: CState, p: Params) {
  const th = d.theme;
  const days = s.clock / 86400;
  const hpd = num(p, "horasLamp", 6);
  const n = num(p, "nLamp", 10);
  const T = tariff(p) + flagAdd(p);
  const maxDays = 5 * 365;
  const maxCost = lampCost(LAMPS[0]!, hpd, maxDays, T, n);
  const X0 = 1.2;
  const X1 = 10.5;
  const Y0 = 1;
  const Y1 = 9;
  const X = (dd: number) => X0 + ((X1 - X0) * dd) / maxDays;
  const Y = (c: number) => Y0 + ((Y1 - Y0) * c) / maxCost;
  d.line(X0, Y0, X1, Y0, { color: th.muted });
  d.line(X0, Y0, X0, Y1, { color: th.muted });
  for (let yr = 1; yr <= 5; yr++) d.text(`${yr} ano${yr > 1 ? "s" : ""}`, X(yr * 365), Y0 - 0.35, { size: 10, color: th.muted });
  d.text(brl(maxCost), X0, Y1 + 0.3, { size: 10, color: th.muted, align: "left" });
  d.text("custo acumulado (lâmpadas + energia)", X0 + 0.2, Y1 + 0.75, { size: 11, align: "left" });
  LAMPS.forEach((l, i) => {
    const col = th.series[[1, 2, 0][i]!]!;
    d.plot((dd) => Y(lampCost(l, hpd, dd, T, n)), 0, Math.min(days, maxDays), { color: col, width: 2, n: 400 });
    const yy = 8.4 - i * 0.6;
    d.line(11, yy, 11.5, yy, { color: col, width: 3 });
    d.text(`${l.name}: ${l.P} W, ${l.life} h, ${brl(l.price)}`, 11.6, yy, { size: 11, align: "left" });
    d.text(`custo até agora: ${brl(lampCost(l, hpd, Math.min(days, maxDays), T, n))}`, 11.6, yy - 0.27, { size: 10, align: "left", color: th.muted });
  });
  d.line(X(Math.min(days, maxDays)), Y0, X(Math.min(days, maxDays)), Y1, { color: th.grid, dash: [4, 4] });
  const pb = paybackDays(p);
  d.text(`${fmt(n, 0)} lâmpadas, ${fmt(hpd, 0)} h/dia, ${brl(T)}/kWh`, 11, 6.2, { size: 12, align: "left" });
  d.text(`Economia mensal LED × incandescente: ${brl(monthlySaving(p))}`, 11, 5.6, { size: 12, align: "left", weight: "700" });
  d.text(`O LED se paga em ${fmt(pb, 0)} dias`, 11, 5.0, { size: 12, align: "left" });
  d.text(`Tempo decorrido: ${fmt(days / 30, 1)} meses`, 11, 4.4, { size: 11, align: "left", color: th.muted });
  d.text("As incandescentes queimam a cada", 11, 3.6, { size: 10, align: "left", color: th.muted });
  d.text(`${fmt(1000 / hpd, 0)} dias: cada degrau é uma troca.`, 11, 3.25, { size: 10, align: "left", color: th.muted });
}

/** Economia mensal (30 dias) trocando incandescentes por LED. */
export function monthlySaving(p: Params): number {
  const T = tariff(p) + flagAdd(p);
  return (num(p, "nLamp", 10) * (LAMPS[0]!.P - LAMPS[2]!.P) * num(p, "horasLamp", 6) * 30 * T) / 1000;
}
/** Dias para a economia de energia pagar o preço das LEDs (sem contar trocas das incandescentes). */
export function paybackDays(p: Params): number {
  const T = tariff(p) + flagAdd(p);
  const perDay = ((LAMPS[0]!.P - LAMPS[2]!.P) * num(p, "horasLamp", 6) * T) / 1000;
  return LAMPS[2]!.price / perDay;
}

function renderBreaker(d: Draw, s: CState, p: Params) {
  const th = d.theme;
  const I = circuitCurrent(s, p);
  const iz = Iz(p);
  const inn = In(p);
  // Quadro
  d.rect(0.4, 3, 2.6, 5, { fill: th.dark ? "#2b2f38" : "#eef0f3", stroke: th.muted });
  d.text("quadro", 1.7, 8.3, { size: 11, color: th.muted });
  d.rect(1.1, 4.5, 1.2, 2, { fill: s.tripped ? th.positive : th.series[2], alpha: 0.8, stroke: th.muted });
  d.text(`${inn} A`, 1.7, 6.0, { size: 13, weight: "700" });
  d.text(["B", "C"][Math.round(num(p, "curva", 1))] ?? "C", 1.7, 5.4, { size: 11 });
  d.text(s.tripped ? "DESARMADO" : "ligado", 1.7, 4.9, { size: 10, weight: "700" });
  // Bimetal
  const thPct = s.theta / THETA_TRIP;
  d.rect(0.6, 3.3, 2.2, 0.3, { stroke: th.muted });
  d.rect(0.6, 3.3, 2.2 * clamp(thPct, 0, 1), 0.3, { fill: thPct > 0.8 ? th.positive : th.accent });
  d.text("aquecimento do bimetal", 1.7, 3.85, { size: 9, color: th.muted });
  // Fio
  const wireCol = s.Tw > 160 ? "#7a1f1f" : s.Tw > T_MAX ? th.positive : th.series[1];
  d.line(3, 6.2, 15.5, 6.2, { color: wireCol, width: 2 + Amm2(p) });
  d.line(3, 5.8, 15.5, 5.8, { color: th.muted, width: 2 + Amm2(p) });
  d.text(`fio de ${fmt(Amm2(p), 1)} mm²: suporta ${fmt(iz, 1)} A (NBR 5410, PVC 70 °C)`, 9, 6.7, { size: 11 });
  // Elétrons (velocidade de deriva exagerada ∝ I)
  if (I > 0) for (let i = 0; i < 20; i++) d.dot(3 + ((i * 0.63 + s.clock * 0.08 * Math.min(I, 60)) % 12.5), 6.2, 2, th.negative, 0.7);
  // Aparelhos
  KITCHEN.forEach((k, i) => {
    const x = 3.6 + i * 2;
    d.line(x + 0.7, 5.8, x + 0.7, 5.1, { color: th.muted });
    d.rect(x, 3.6, 1.6, 1.5, { fill: s.plugged[i] && !s.tripped ? th.series[5] : th.dark ? "#3a3f48" : "#e3e6ea", alpha: s.plugged[i] && !s.tripped ? 0.6 : 1, stroke: th.muted });
    d.text(k.name, x + 0.8, 4.65, { size: 10 });
    d.text(`${k.P} W`, x + 0.8, 4.2, { size: 10, color: th.muted });
    d.text(s.plugged[i] ? "ligado" : "clique", x + 0.8, 3.85, { size: 9, color: th.muted });
  });
  // Painel
  const ttrip = tripTime(I, inn);
  const L = num(p, "Lfio", 15);
  const dV = I * loopR(L, Amm2(p));
  const lines = [
    `I = ${s.short ? "curto-circuito: " : "ΣP/V = "}${fmt(I, 1)} A   (disjuntor ${inn} A, fio ${fmt(iz, 1)} A)`,
    `Temperatura do fio: ${fmt(s.Tw, 1)} °C   (limite ${T_MAX} °C; máx. atingida ${fmt(s.Tpeak, 0)} °C)`,
    `Queda de tensão no fio (${fmt(L, 0)} m): ${fmt(dV, 2)} V = ${fmt((100 * dV) / voltage(p), 1)} %`,
    s.tripped ? "Disjuntor desarmou." : Number.isFinite(ttrip) ? `Disparo térmico previsto em ${fmt(ttrip, 0)} s (a frio)` : "Corrente abaixo de 1,3 In: não desarma",
    inn > iz ? "⚠ Disjuntor maior que a capacidade do fio: o fio esquenta antes de o disjuntor agir!" : "Coordenação correta: I ≤ In ≤ Iz",
  ];
  lines.forEach((l, i) => d.text(l, 0.4, 9.6 - i * 0.45, { size: 12, align: "left", color: i === 4 && inn > iz ? th.positive : th.text, weight: i === 4 ? "700" : "400" }));
  if (s.Tpeak > 160) d.text("isolamento do fio derreteu (risco de incêndio)", 9, 7.2, { size: 12, color: th.positive, weight: "700" });
  d.text("curva tempo × corrente (escala log):", 0.4, 2.4, { size: 10, align: "left", color: th.muted });
  // Mini curva t(I/In)
  const gx = (x: number) => 0.6 + (Math.log10(x) / Math.log10(20)) * 14.5;
  const gy = (t: number) => 0.3 + (clamp(Math.log10(t), -2, 4) + 2) * 0.3;
  d.plot((x) => gy(tripTime(x * inn, inn)), 1.31, magnetic(p), { color: th.accent, n: 120 });
  d.line(gx(magnetic(p)), gy(1e-2), gx(magnetic(p)), gy(tripTime(magnetic(p) * inn, inn)), { color: th.accent });
  d.line(gx(1), gy(1e-2), gx(20), gy(1e-2), { color: th.muted, width: 1 });
  for (const m of [1, 2, 5, 10, 20]) d.text(`${m}In`, gx(m), 0.1, { size: 9, color: th.muted });
  if (I > 0) d.dot(gx(clamp(I / inn, 1, 20)), gy(Number.isFinite(ttrip) ? ttrip : 1e4), 5, th.positive);
}

function renderMeter(d: Draw, s: CState, p: Params) {
  const th = d.theme;
  const tp = METER_TEST[Math.round(num(p, "teste", 3))]!;
  d.rect(1, 1, 6, 8, { fill: th.dark ? "#2b2f38" : "#eef0f3", stroke: th.muted });
  d.text("medidor de energia", 4, 8.5, { size: 12, color: th.muted });
  d.text(`Kd = ${fmt(Kd(p), 1)} Wh/volta`, 4, 8.0, { size: 11, color: th.muted });
  // Mostrador
  const reading = (s.E / 1000).toFixed(3).padStart(8, "0");
  d.rect(2, 6.4, 4, 1, { fill: th.dark ? "#111" : "#fff", stroke: th.muted });
  d.text(`${reading.replace(".", ",")} kWh`, 4, 6.9, { size: 15, weight: "700" });
  // Disco visto de frente (elipse) com a marca
  const ang = 2 * Math.PI * (s.revs % 1);
  d.ctx.save();
  d.ctx.translate(4, 4.2);
  d.ctx.scale(1, 0.25);
  d.circle(0, 0, 2, { fill: th.dark ? "#8d99a8" : "#c3ccd6", stroke: th.muted });
  d.ctx.restore();
  const mx = 4 + 2 * Math.sin(ang);
  const my = 4.2 - 0.5 * Math.cos(ang);
  if (Math.cos(ang) > -0.2) d.rect(mx - 0.08, my - 0.12, 0.16, 0.24, { fill: th.positive });
  d.text("disco (marca vermelha)", 4, 3.3, { size: 10, color: th.muted });
  // Aparelho
  d.rect(9, 5.5, 3, 2.2, { fill: th.series[5], alpha: 0.5, stroke: th.muted });
  d.text(tp.name, 10.5, 6.9, { size: 11 });
  d.text(num(p, "nominal", 1) >= 1 && Math.round(num(p, "teste", 3)) !== 6 ? `${tp.P} W` : "P = ?", 10.5, 6.3, { size: 13, weight: "700" });
  d.line(7, 6.5, 9, 6.5, { color: th.muted, width: 2 });
  const n = Math.floor(s.revs + 1e-9);
  const lines = [
    `cronômetro: ${fmt(s.clock - s.t0, 1)} s`,
    `voltas completas: ${n}`,
    n >= 1 ? `tempo das ${n} voltas: ${fmt(s.tLastRev - s.t0, 2)} s` : "espere a primeira volta…",
    n >= 1 ? `P = 3600·Kd·n/Δt = ${fmt(measuredP(s, p), 0)} W` : "",
  ];
  lines.forEach((l, i) => d.text(l, 8.5, 4.4 - i * 0.6, { size: 13, align: "left", weight: i === 3 ? "700" : "400" }));
}

// ---------------------------------------------------------------------------
// Simulação
// ---------------------------------------------------------------------------

const MODES = ["Casa: conta mensal, bandeiras e standby", "Chuveiro: verão e inverno", "Troca de lâmpadas", "Disjuntores e fios", "Medidor: potência pelo disco"];

export const consumoEnergia = defineSim<CState>({
  id: "consumo-energia",
  title: "Consumo de energia elétrica em casa",
  course: "FG III",
  topic: "Corrente elétrica",
  priority: "P2",
  summary:
    "Monte o uso diário dos aparelhos de uma casa e veja a curva de carga, o medidor girando e a conta com tarifa, bandeira e tributos; compare chuveiro no verão e no inverno, lâmpadas, e dimensione fio e disjuntor vendo o fio esquentar.",
  equations: [
    String.raw`E = P\,\Delta t \quad (1\ \text{kWh} = 3{,}6\ \text{MJ})`,
    String.raw`\text{conta} = \frac{E\,(T + b)}{1 - t_{\text{trib}}}`,
    String.raw`P = \frac{V^2}{R} = \dot m\,c\,\Delta T`,
    String.raw`I_B \le I_n \le I_z,\qquad t_{\text{disparo}} = \tau \ln\frac{(I/I_n)^2}{(I/I_n)^2 - 1{,}3^2}`,
    String.raw`P = \frac{3600\,K_d\,n}{\Delta t}`,
  ],
  liveEquations(s, p) {
    const m = mode(p);
    if (m === 0) {
      const kwh = monthlyKWh(s, p);
      return [
        String.raw`E_{\text{mês}} = 30\sum P_i h_i = ${texNum(kwh)}\ \text{kWh}`,
        String.raw`\text{conta} = \frac{${texNum(kwh)}\,(${texNum(tariff(p))} + ${texNum(flagAdd(p), 4)})}{1 - ${texNum(tax(p) / 100)}} = \text{R\$}\ ${texNum(bill(kwh, tariff(p), flagAdd(p), tax(p)), 4)}`,
      ];
    }
    if (m === 1) {
      const P = showerP(p);
      return [String.raw`\Delta T = \frac{P}{\dot m c} = \frac{${texNum(P)}}{${texNum(num(p, "vazao", 4) / 60, 3)} \cdot ${C_WATER}} = ${texNum(P / ((num(p, "vazao", 4) / 60) * C_WATER))}\ ^\circ\text{C}`];
    }
    if (m === 2) return [String.raw`\text{economia} = n\,\Delta P\,h\,30\,T = \text{R\$}\ ${texNum(monthlySaving(p))}\ \text{/mês}`];
    if (m === 3) {
      const I = circuitCurrent(s, p);
      return [String.raw`I = ${texNum(I)}\ \text{A},\ I_n = ${In(p)}\ \text{A},\ I_z = ${texNum(Iz(p))}\ \text{A},\quad T_{\text{fio}} = ${texNum(s.Tw)}\ ^\circ\text{C}`];
    }
    const n = Math.floor(s.revs + 1e-9);
    return [String.raw`P = \frac{3600 \cdot ${texNum(Kd(p))} \cdot ${n}}{${texNum(Math.max(s.tLastRev - s.t0, 0))}} = ${texNum(measuredP(s, p))}\ \text{W}`];
  },

  params: [
    { key: "modo", label: "Situação", unit: "", min: 0, max: 4, step: 1, default: 0, options: MODES.map((label, value) => ({ value, label })) },
    { key: "tarifa", label: "Tarifa (TE + TUSD)", unit: "R$/kWh", min: 0.3, max: 1.5, step: 0.01, default: 0.8, live: true },
    { key: "bandeira", label: "Bandeira tarifária", unit: "", min: 0, max: 3, step: 1, default: 0, live: true, options: FLAGS.map((f, value) => ({ value, label: `${f.name} (+R$ ${f.add.toFixed(5).replace(".", ",")}/kWh)` })) },
    { key: "tributos", label: "ICMS + PIS/COFINS", unit: "%", min: 0, max: 40, step: 1, default: 25, live: true },
    { key: "lampada", label: "Lâmpadas da casa", unit: "", min: 0, max: 2, step: 1, default: 2, live: true, options: LAMPS.map((l, value) => ({ value, label: `${l.name} (${l.P} W)` })) },
    { key: "Pinv", label: "Chuveiro: potência no inverno", unit: "W", min: 3000, max: 7800, step: 100, default: 5500, live: true },
    { key: "Pver", label: "Chuveiro: potência no verão", unit: "W", min: 1500, max: 4500, step: 100, default: 3000, live: true },
    { key: "chave", label: "Chave do chuveiro", unit: "", min: 0, max: 2, step: 1, default: 2, live: true, options: [{ value: 0, label: "Desligado" }, { value: 1, label: "Verão" }, { value: 2, label: "Inverno" }] },
    { key: "vazao", label: "Vazão de água", unit: "L/min", min: 2, max: 10, step: 0.5, default: 4, live: true },
    { key: "Tin", label: "Temperatura da água fria", unit: "°C", min: 10, max: 30, step: 1, default: 18, live: true },
    { key: "banho", label: "Duração do banho", unit: "min", min: 3, max: 30, step: 1, default: 10, live: true },
    { key: "pessoas", label: "Pessoas na casa", unit: "", min: 1, max: 6, step: 1, default: 3, live: true },
    { key: "V", label: "Tensão da rede", unit: "V", min: 127, max: 220, step: 93, default: 220, live: true, options: [{ value: 127, label: "127 V" }, { value: 220, label: "220 V" }] },
    { key: "horasLamp", label: "Lâmpadas: horas por dia", unit: "h", min: 1, max: 24, step: 1, default: 6, live: true },
    { key: "nLamp", label: "Número de lâmpadas", unit: "", min: 1, max: 20, step: 1, default: 10, live: true },
    { key: "bitola", label: "Seção do fio", unit: "", min: 0, max: 4, step: 1, default: 1, live: true, options: GAUGES.map((g, value) => ({ value, label: `${String(g).replace(".", ",")} mm²` })) },
    { key: "disjuntor", label: "Disjuntor", unit: "", min: 0, max: 6, step: 1, default: 2, live: true, options: BREAKERS.map((b, value) => ({ value, label: `${b} A` })) },
    { key: "curva", label: "Curva do disjuntor", unit: "", min: 0, max: 1, step: 1, default: 1, live: true, options: [{ value: 0, label: "B (magnético 3–5 In)" }, { value: 1, label: "C (magnético 5–10 In)" }] },
    { key: "Lfio", label: "Comprimento do circuito", unit: "m", min: 5, max: 50, step: 1, default: 15, live: true },
    { key: "teste", label: "Aparelho no medidor", unit: "", min: 0, max: 6, step: 1, default: 3, options: METER_TEST.map((m, value) => ({ value, label: m.name })) },
    { key: "Kd", label: "Constante do medidor Kd", unit: "Wh/volta", min: 0.6, max: 7.2, step: 0.6, default: 3.6 },
    { key: "nominal", label: "Mostrar potência nominal", unit: "", min: 0, max: 1, step: 1, default: 1, live: true, options: [{ value: 1, label: "Sim" }, { value: 0, label: "Não" }] },
  ],

  observables: [
    { key: "hora", label: "Hora do dia", unit: "h", value: (s) => hourOfDay(s) },
    { key: "P", label: "Potência instantânea", unit: "W", value: (s, p) => powerNow(s, p) },
    { key: "E", label: "Energia medida", unit: "kWh", value: (s) => s.E / 1000 },
    {
      key: "Emes",
      label: "Consumo mensal",
      unit: "kWh",
      value: (s, p) => (mode(p) === 0 ? monthlyKWh(s, p) : mode(p) === 1 ? showerMonthKWh(p) : 0),
    },
    {
      key: "conta",
      label: "Valor mensal",
      unit: "R$",
      value: (s, p) => (mode(p) <= 1 ? bill(mode(p) === 0 ? monthlyKWh(s, p) : showerMonthKWh(p), tariff(p), flagAdd(p), tax(p)) : mode(p) === 2 ? monthlySaving(p) : 0),
    },
    { key: "standby", label: "Standby por mês", unit: "kWh", value: (s, p) => (30 * houseDaily(s, p).standby) / 1000 },
    { key: "Tout", label: "Temperatura da água do chuveiro", unit: "°C", value: (_s, p) => showerOut(showerP(p), num(p, "vazao", 4), num(p, "Tin", 18)) },
    { key: "I", label: "Corrente", unit: "A", value: (s, p) => (mode(p) === 1 ? showerP(p) / voltage(p) : mode(p) === 3 ? circuitCurrent(s, p) : 0) },
    { key: "Tfio", label: "Temperatura do fio", unit: "°C", value: (s) => s.Tw },
    { key: "bimetal", label: "Aquecimento do bimetal", unit: "%", value: (s) => (100 * s.theta) / THETA_TRIP },
    { key: "voltas", label: "Voltas do disco", unit: "", value: (s) => Math.floor(s.revs + 1e-9) },
    { key: "Pmed", label: "Potência medida pelo disco", unit: "W", value: (s, p) => measuredP(s, p) },
    { key: "custoInc", label: "Custo acumulado: incandescentes", unit: "R$", value: (s, p) => lampCost(LAMPS[0]!, num(p, "horasLamp", 6), s.clock / 86400, tariff(p) + flagAdd(p), num(p, "nLamp", 10)) },
    { key: "custoLED", label: "Custo acumulado: LED", unit: "R$", value: (s, p) => lampCost(LAMPS[2]!, num(p, "horasLamp", 6), s.clock / 86400, tariff(p) + flagAdd(p), num(p, "nLamp", 10)) },
  ],
  chart: { x: "hora", y: "P" },

  scenarios: [
    {
      id: "casa",
      label: "A conta do mês",
      params: { modo: 0, bandeira: 0, tributos: 25 },
      guide: `### Quanto custa cada aparelho?
1. Rode a simulação: o relógio avança 1 hora por segundo e o gráfico mostra a **curva de carga** $P \\times$ hora. Note o pico às 19 h.
2. Arraste as barras de **horas por dia** e veja $E = P\\,\\Delta t$ e o valor de cada linha.
3. Compare: 45 min de chuveiro (5,5 kW) × 24 h de roteador (12 W). Qual pesa mais na conta?
4. Troque a **bandeira** para vermelha 2 e os **tributos** (calculados "por dentro": $\\text{conta} = E(T+b)/(1-t)$).
5. Use *Tirar da tomada* e veja quanto o **standby** representa por mês.`,
      predict: [
        {
          question: "Qual destes gasta mais energia num mês: chuveiro de 5500 W por 45 min/dia ou geladeira de 150 W funcionando 8 h/dia?",
          options: ["Chuveiro", "Geladeira", "Iguais"],
          answer: 0,
          explanation: "Chuveiro: 5,5 kW × 0,75 h = 4,1 kWh/dia. Geladeira: 0,15 kW × 8 h = 1,2 kWh/dia. O chuveiro gasta mais que o triplo.",
        },
      ],
    },
    {
      id: "chuveiro",
      label: "Chuveiro: verão × inverno",
      params: { modo: 1, chave: 2, Pinv: 5500, Pver: 3000, vazao: 4, Tin: 18 },
      guide: `### Inverno e verão
1. A água esquenta $\\Delta T = P/(\\dot m c)$: com 5500 W e 4 L/min, quase 20 °C.
2. Mude a chave para **verão**: a potência cai. A resistência é **maior** ou **menor**? Confira $R = V^2/P$.
3. Feche um pouco o registro (menos vazão): a água fica mais quente sem gastar mais energia por minuto.
4. Veja o custo mensal para a família e compare com a conta total no modo Casa.`,
      predict: [
        {
          question: "Na posição inverno (mais quente), a resistência do chuveiro é…",
          options: ["Menor que no verão", "Maior que no verão", "A mesma"],
          answer: 0,
          explanation: "Com a mesma tensão, P = V²/R: mais potência exige resistência menor. A chave inverno usa um trecho mais curto do resistor.",
        },
      ],
    },
    {
      id: "lampadas",
      label: "Troca de lâmpadas",
      params: { modo: 2, horasLamp: 6, nLamp: 10 },
      guide: `### Vale a pena trocar?
1. Rode: cada segundo são 30 dias. As curvas somam o preço das lâmpadas (degraus = trocas) e a energia (rampa).
2. Quando a curva do LED cruza a da incandescente, a troca **se pagou**.
3. Mude as horas por dia e a tarifa: o tempo de retorno muda como $1/(h\\,T)$.`,
      predict: [
        {
          question: "Dez lâmpadas usadas 6 h/dia a R$ 0,80/kWh: trocar incandescentes de 60 W por LEDs de 9 W (R$ 10 cada) se paga em…",
          options: ["Cerca de 1 mês", "Cerca de 1 ano", "Cerca de 5 anos"],
          answer: 0,
          explanation: "Cada lâmpada economiza 51 W × 6 h = 0,306 kWh/dia ≈ R$ 0,24/dia. R$ 10 se pagam em ~41 dias.",
        },
      ],
    },
    {
      id: "disjuntor",
      label: "Fio e disjuntor",
      params: { modo: 3, V: 127, bitola: 1, disjuntor: 2, curva: 1 },
      guide: `### Por que o disjuntor desarma?
1. Clique nos aparelhos da cozinha para ligá-los: $I = \\sum P/V$. Ligue chaleira + air fryer em 127 V.
2. Observe o **bimetal** aquecendo e o tempo de disparo previsto pela curva térmica.
3. Troque o disjuntor por 32 A mantendo o fio de 2,5 mm² (que suporta 24 A): o fio passa de 70 °C antes de o disjuntor agir. **Nunca** se troca disjuntor por um maior sem trocar o fio.
4. Use *Curto-circuito*: a corrente é centenas de ampères e o disparo **magnético** é instantâneo.
5. Repita em 220 V: a mesma potência pede metade da corrente.`,
      predict: [
        {
          question: "Chaleira (2000 W) + air fryer (1500 W) num circuito de 127 V com disjuntor de 20 A:",
          options: ["Desarma depois de algum tempo", "Desarma na hora", "Nunca desarma"],
          answer: 0,
          explanation: "I = 3500/127 = 27,6 A = 1,38 In: acima de 1,3 In o disparo térmico ocorre, mas leva dezenas de segundos (curva de tempo inverso).",
        },
      ],
    },
    {
      id: "medidor",
      label: "Medir potência pelo disco",
      params: { modo: 4, teste: 6, Kd: 3.6, nominal: 0 },
      guide: `### Prática: o aparelho misterioso
1. Cada volta do disco corresponde a $K_d$ Wh.
2. Zere o cronômetro e conte $n$ voltas completas (pelo menos 5) e o tempo $\\Delta t$.
3. Calcule $P = 3600 K_d n/\\Delta t$ e compare com o valor do painel.
4. Repita com aparelhos conhecidos para verificar o método.`,
    },
  ],

  exercises: [
    {
      id: "chuveiro-conta",
      prompt:
        "Um chuveiro de {P} W é usado {min} minutos por dia por cada uma de {n} pessoas, durante 30 dias. A tarifa é R$ {T}/kWh e a bandeira vermelha patamar 1 acrescenta R$ 0,04463/kWh. Quanto o chuveiro custa no mês (sem tributos)?",
      vary: { P: [3000, 7500, 0], min: [5, 20, 0], n: [1, 5, 0], T: [0.5, 1.1, 2] },
      answer: { label: "Custo", unit: "R$", compute: (p) => ((num(p, "P") * (num(p, "min") / 60) * num(p, "n") * 30) / 1000) * (num(p, "T") + 0.04463) },
      hint: "E (kWh) = P(kW) × horas por dia × pessoas × 30.",
    },
    {
      id: "chuveiro-temperatura",
      prompt: "Um chuveiro de {P} W aquece água que entra a {Tin} °C com vazão de {Q} L/min. A que temperatura a água sai? (c = 4186 J/(kg·°C), 1 L = 1 kg)",
      vary: { P: [3000, 7500, 0], Tin: [12, 26, 0], Q: [3, 8, 1] },
      answer: { label: "Temperatura", unit: "°C", compute: (p) => showerOut(num(p, "P"), num(p, "Q"), num(p, "Tin")) },
      hint: "P = ṁ c ΔT, com ṁ em kg/s.",
    },
    {
      id: "disjuntor-tempo",
      prompt:
        "Neste modelo, o disjuntor térmico desarma em t = 60 s · ln(x²/(x² − 1,69)), com x = I/In. Aparelhos somando {P} W são ligados em 127 V num disjuntor de 20 A. Em quanto tempo ele desarma?",
      vary: { P: [3400, 5000, 0] },
      answer: { label: "Tempo", unit: "s", compute: (p) => tripTime(num(p, "P") / 127, 20) },
    },
  ],

  init(p) {
    return {
      clock: 0,
      E: 0,
      hours: APPLIANCES.map((a) => a.hours),
      enabled: APPLIANCES.map((a) => a.name !== "Ar-condicionado"),
      unplug: false,
      plugged: KITCHEN.map((_, i) => i <= 1),
      Tw: T_AMB,
      theta: 0,
      tripped: false,
      short: false,
      Tpeak: T_AMB,
      revs: 0,
      t0: 0,
      tLastRev: 0,
      drag: null,
    };
  },

  step(s0, p, _t, dt) {
    const m = mode(p);
    const h = dt * timeScale(p);
    const s: CState = { ...s0, clock: s0.clock + h };
    if (m === 0) {
      // Integra a potência em sub-passos de 3,6 s (0,001 h).
      const n = Math.max(1, Math.round(h / 3.6));
      let E = 0;
      for (let i = 0; i < n; i++) E += housePower(s0, p, (((s0.clock + ((i + 0.5) * h) / n) / 3600) % 24)) * (h / n / 3600);
      s.E = s0.E + E;
    } else if (m === 1) {
      const bath = num(p, "banho", 10) * 60;
      const on = Math.max(0, Math.min(s.clock, bath) - Math.min(s0.clock, bath));
      s.E = s0.E + (showerP(p) * on) / 3600;
    } else if (m === 3) {
      const I = circuitCurrent(s0, p);
      const iz = Iz(p);
      const target = T_AMB + wireRise(I, iz);
      s.Tw = target + (s0.Tw - target) * Math.exp(-h / wireTau(Amm2(p)));
      s.Tpeak = Math.max(s0.Tpeak, s.Tw);
      const x2 = (I / In(p)) ** 2;
      s.theta = x2 + (s0.theta - x2) * Math.exp(-h / BIMETAL_TAU);
      if (!s0.tripped && (s.theta >= THETA_TRIP || I / In(p) >= magnetic(p))) s.tripped = true;
    } else if (m === 4) {
      const P = testP(p);
      const r = s0.revs + (P * h) / (3600 * Kd(p));
      if (Math.floor(r + 1e-9) > Math.floor(s0.revs + 1e-9)) {
        // Instante exato em que a volta se completou.
        const need = Math.floor(r + 1e-9) - s0.revs;
        s.tLastRev = s0.clock + (need * 3600 * Kd(p)) / P;
      }
      s.revs = r;
      s.E = s0.E + (P * h) / 3600;
    }
    return s;
  },
  dt: 0.02,
  sampleEvery: 1,
  maxSamples: 6000,

  pointer: {
    down(s, p, pt) {
      const m = mode(p);
      if (m === 0) {
        const i = Math.round((ROW0 - pt.y) / ROWH);
        if (i < 0 || i >= APPLIANCES.length || Math.abs(ROW0 - i * ROWH - pt.y) > 0.3) return undefined;
        if (pt.x >= 7.1 && pt.x < 10) return { ...s, enabled: s.enabled.map((e, j) => (j === i ? !e : e)) };
        if (pt.x >= BAR0 - 0.2 && pt.x <= BAR1 + 0.2) {
          const hrs = Math.round(clamp(((pt.x - BAR0) / (BAR1 - BAR0)) * 24, 0, 24) * 4) / 4;
          return { ...s, drag: i, hours: s.hours.map((v, j) => (j === i ? hrs : v)) };
        }
      }
      if (m === 3) {
        const i = Math.floor((pt.x - 3.6) / 2);
        if (i >= 0 && i < KITCHEN.length && pt.y > 3.5 && pt.y < 5.2 && pt.x - 3.6 - 2 * i <= 1.6) return { ...s, plugged: s.plugged.map((v, j) => (j === i ? !v : v)) };
      }
      return undefined;
    },
    move(s, _p, pt, dragging) {
      if (!dragging || s.drag === null) return undefined;
      const i = s.drag;
      const hrs = Math.round(clamp(((pt.x - BAR0) / (BAR1 - BAR0)) * 24, 0, 24) * 4) / 4;
      return { ...s, hours: s.hours.map((v, j) => (j === i ? hrs : v)) };
    },
    up: (s) => (s.drag !== null ? { ...s, drag: null } : undefined),
    cursor(_s, p, pt) {
      if (mode(p) === 0 && pt.x >= BAR0 - 0.2 && pt.x <= BAR1 + 0.2 && pt.y < ROW0 + 0.3 && pt.y > ROW0 - 9.5 * ROWH) return "ew-resize";
      if (mode(p) === 0 && pt.x >= 7.1 && pt.x < 10 && pt.y < ROW0 + 0.3 && pt.y > ROW0 - 9.5 * ROWH) return "pointer";
      if (mode(p) === 3 && pt.y > 3.5 && pt.y < 5.2 && pt.x > 3.6) return "pointer";
      return undefined;
    },
  },

  actions: [
    { id: "tomada", label: "Tirar da tomada os aparelhos em standby", run: (s) => ({ ...s, unplug: !s.unplug }), active: (s) => s.unplug },
    { id: "rearmar", label: "Rearmar o disjuntor", run: (s) => ({ ...s, tripped: false, short: false }) },
    { id: "curto", label: "Provocar curto-circuito", run: (s, p) => (mode(p) === 3 ? { ...s, short: true } : s) },
    { id: "zerar", label: "Zerar cronômetro e voltas", run: (s) => ({ ...s, revs: 0, t0: s.clock, tLastRev: s.clock }) },
  ],

  viewport: () => ({ xMin: 0, xMax: 16, yMin: 0, yMax: 10, unit: "" }),

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const { state: s, params: p } = frame;
    [renderHouse, renderShower, renderLamps, renderBreaker, renderMeter][mode(p)]?.(d, s, p);
  },
});

export default consumoEnergia;
