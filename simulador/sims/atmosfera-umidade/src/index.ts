import { defineSim, draw, formatBR, num, texNum, type Draw, type Params, type Theme } from "@fisilab/core";
import {
  C_AGUA,
  L_KG,
  LAYERS,
  P0,
  absHum,
  boilT,
  cookFactor,
  density,
  dewPoint,
  esat,
  isaP,
  isaT,
  isoP,
  psatAntoine,
  psatCC,
  scaleHeight,
  wetBulb,
} from "./atm.ts";

export * from "./atm.ts";

const fmt = (v: number, d = 3) => formatBR(v, d);

export interface Atm {
  /** Altitude do balão, m. */
  h: number;
  burst: boolean;
  /** Tempo físico, s. */
  tf: number;
  /** Temperatura da água da panela, °C, e massa evaporada, kg. */
  Tw: number;
  mev: number;
  /** Temperatura da superfície do copo, °C, e água condensada nele, g. */
  Tc: number;
  mc: number;
}

/** Aceleração do tempo em cada modo (s físicos por s de animação). */
export const SPEED = [60, 20, 20];
const D0 = 1.8; // diâmetro do balão no lançamento, m
const M_PANELA = 1.0; // kg de água
const TAU_COPO = 120; // s
const HM_A = 0.005 * 0.03; // coef. de transferência de massa × área do copo, m³/s

const modo = (p: Params) => Math.round(num(p, "modo"));
export const localP = (p: Params) => isaP(num(p, "local")) + num(p, "panela") * 1000;
export const tebC = (p: Params) => boilT(localP(p)) - 273.15;
const Tar = (p: Params) => num(p, "Tar", 25);
const UR = (p: Params) => num(p, "UR", 60) / 100;
export const vaporP = (p: Params) => UR(p) * esat(Tar(p));
/** Volume do balão (m³): gás à pressão e temperatura ambientes. */
export const balloonV = (h: number) => ((Math.PI / 6) * D0 ** 3 * (P0 / isaP(h)) * isaT(h)) / 288.15;
export const burstVolume = (p: Params) => (Math.PI / 6) * num(p, "Dburst", 8) ** 3;

const CITIES = [
  { h: 0, name: "Rio de Janeiro (nível do mar)" },
  { h: 760, name: "São Paulo (760 m)" },
  { h: 1172, name: "Brasília (1172 m)" },
  { h: 2240, name: "Cidade do México (2240 m)" },
  { h: 2850, name: "Quito (2850 m)" },
  { h: 3640, name: "La Paz (3640 m)" },
  { h: 5364, name: "Acampamento base do Everest (5364 m)" },
  { h: 8849, name: "Cume do Everest (8849 m)" },
];

function thermometer(d: Draw, x: number, y0: number, y1: number, t: number, t0: number, t1: number, theme: Theme, label: string) {
  const f = Math.max(0, Math.min(1, (t - t0) / (t1 - t0)));
  d.rect(x - 0.09, y0, 0.18, y1 - y0, { stroke: theme.muted, width: 1.2 });
  d.rect(x - 0.06, y0, 0.12, (y1 - y0) * f, { fill: theme.positive });
  d.circle(x, y0 - 0.12, 0.17, { fill: theme.positive });
  d.text(`${fmt(t, 3)} °C`, x, y1 + 0.25, { size: 10, weight: "600" });
  d.text(label, x, y0 - 0.5, { size: 9, color: theme.muted });
}

// ---------- Modo 0: altitude ----------

const COL = { x0: 0.9, x1: 5.4, y0: 0.7, y1: 8.5 };
const PP = { x0: 8.8, x1: 15.5 };
const hView = (p: Params) => num(p, "hView", 50) * 1000;
const hy = (h: number, p: Params) => COL.y0 + (h / hView(p)) * (COL.y1 - COL.y0);
const yh = (y: number, p: Params) => ((y - COL.y0) / (COL.y1 - COL.y0)) * hView(p);

function renderAltitude(d: Draw, s: Atm, p: Params, theme: Theme) {
  const H = hView(p);
  const fills = ["rgba(90,160,230,0.22)", "rgba(110,120,220,0.16)", "rgba(150,110,210,0.14)", "rgba(210,110,120,0.12)"];
  LAYERS.forEach((L, i) => {
    const a = Math.min(L.h0, H), b = Math.min(L.h1, H);
    if (b <= a) return;
    d.rect(COL.x0, hy(a, p), COL.x1 - COL.x0, hy(b, p) - hy(a, p), { fill: fills[i]! });
    if (hy(b, p) - hy(a, p) > 0.45) d.text(L.name, COL.x1 - 0.1, (hy(a, p) + hy(b, p)) / 2, { size: 10, align: "right", color: theme.muted, weight: "600" });
  });
  // Camada de ozônio
  if (H > 25e3) {
    d.rect(COL.x0, hy(20e3, p), 0.25, hy(Math.min(30e3, H), p) - hy(20e3, p), { fill: "rgba(80,170,120,0.5)" });
    d.text("ozônio", COL.x0 + 0.3, hy(25e3, p), { size: 9, align: "left", color: theme.muted });
  }
  // Perfil de temperatura
  let tMin = 1e9, tMax = -1e9;
  for (let k = 0; k <= 200; k++) {
    const T = isaT((H * k) / 200);
    tMin = Math.min(tMin, T);
    tMax = Math.max(tMax, T);
  }
  tMin = Math.floor((tMin - 10) / 20) * 20;
  tMax = Math.ceil((tMax + 10) / 20) * 20;
  const tx = (T: number) => COL.x0 + ((T - tMin) / (tMax - tMin)) * (COL.x1 - COL.x0);
  const prof: [number, number][] = Array.from({ length: 301 }, (_, k) => [tx(isaT((H * k) / 300)), hy((H * k) / 300, p)]);
  d.polyline(prof, { color: theme.positive, width: 2.5 });
  for (let T = tMin; T <= tMax; T += 40) d.text(`${T}`, tx(T), COL.y0 - 0.25, { size: 9, color: theme.muted });
  d.text("T (K)", COL.x1, COL.y0 - 0.55, { size: 10, align: "right", color: theme.positive });
  // Eixo de altitude
  const step = H <= 20e3 ? 2e3 : H <= 60e3 ? 10e3 : 20e3;
  for (let h = 0; h <= H + 1; h += step) {
    d.line(COL.x0 - 0.1, hy(h, p), COL.x0, hy(h, p), { color: theme.muted });
    d.text(`${h / 1000}`, COL.x0 - 0.15, hy(h, p), { size: 9, align: "right", color: theme.muted });
  }
  d.text("h (km)", COL.x0, COL.y1 + 0.3, { size: 10, align: "left", color: theme.muted });
  // Referências
  const marks: [number, string][] = [[8849, "Everest"], [11e3, "aviões"], [39e3, "salto de Baumgartner"], [80e3, "meteoros"], [100e3, "linha de Kármán"]];
  for (const [h, lab] of marks) if (h < H) {
    d.line(COL.x0, hy(h, p), COL.x0 + 0.35, hy(h, p), { color: theme.text, width: 1 });
    d.text(lab, COL.x0 + 0.4, hy(h, p), { size: 9, align: "left", color: theme.text });
  }
  // Balão
  const bx = 6.7;
  const by = Math.min(COL.y1 - 0.3, hy(s.h, p));
  const V = balloonV(s.h);
  const rr = Math.min(0.75, 0.18 * Math.cbrt(V / balloonV(0)));
  d.line(bx, by - rr, bx, by - rr - 0.35, { color: theme.muted, width: 1 });
  d.rect(bx - 0.08, by - rr - 0.5, 0.16, 0.15, { fill: theme.muted });
  if (s.burst) d.text("estourou!", bx, by, { size: 11, weight: "700", color: theme.positive });
  else d.circle(bx, by, rr, { fill: "rgba(240,240,250,0.85)", stroke: theme.text, width: 1.5 });
  d.text("arraste", bx, COL.y0 - 0.25, { size: 9, color: theme.muted });
  // Gráfico P(h)
  const Pmax = P0 * 1.05;
  const px = (P: number) => PP.x0 + (P / Pmax) * (PP.x1 - PP.x0);
  d.line(PP.x0, COL.y0, PP.x1, COL.y0, { color: theme.muted });
  d.line(PP.x0, COL.y0, PP.x0, COL.y1, { color: theme.muted });
  for (let P = 0; P <= 100e3; P += 20e3) d.text(`${P / 1000}`, px(P), COL.y0 - 0.25, { size: 9, color: theme.muted });
  for (let h = 0; h <= H + 1; h += step) d.line(PP.x0, hy(h, p), PP.x1, hy(h, p), { color: theme.grid, width: 1 });
  d.text("P (kPa)", PP.x1, COL.y0 - 0.55, { size: 10, align: "right", color: theme.muted });
  const Tiso = num(p, "Tiso", 288);
  d.polyline(Array.from({ length: 301 }, (_, k): [number, number] => [px(isaP((H * k) / 300)), hy((H * k) / 300, p)]), { color: theme.accent, width: 2.5 });
  const isoPts: [number, number][] = Array.from({ length: 301 }, (_, k) => [px(isoP((H * k) / 300, Tiso)), hy((H * k) / 300, p)]);
  d.polyline(isoPts, { color: theme.series[1]!, dash: [6, 4], width: 2 });
  const hm = Math.min(s.h, H);
  d.dot(px(isaP(hm)), hy(hm, p), 6, theme.accent);
  d.line(bx + 0.8, by, px(isaP(hm)), hy(hm, p), { color: theme.grid, dash: [3, 3] });
  const lines = [
    [`h = ${fmt(s.h / 1000)} km`, theme.text],
    [`padrão: P = ${fmt(isaP(s.h) / 1000)} kPa, T = ${fmt(isaT(s.h) - 273.15)} °C`, theme.accent],
    [`isotérmico (${fmt(Tiso)} K, H = ${fmt(scaleHeight(Tiso) / 1000)} km): ${fmt(isoP(s.h, Tiso) / 1000)} kPa`, theme.series[1]],
    [`ρ do ar = ${fmt(density(isaP(s.h), isaT(s.h)))} kg/m³`, theme.text],
    [`balão: V = ${fmt(V)} m³ (estoura com ${fmt(burstVolume(p))} m³)`, theme.text],
  ] as const;
  lines.forEach(([t, c], k) => d.text(t, PP.x1, COL.y1 - k * 0.45, { size: 11, align: "right", color: c, weight: k === 0 ? "700" : "400" }));
}

// ---------- Modo 1: ebulição ----------

const BP = { x0: 8.8, x1: 15.5, y0: 0.9, y1: 8.3, t0: 60, t1: 140, p1: 400e3 };
const bx = (t: number) => BP.x0 + ((t - BP.t0) / (BP.t1 - BP.t0)) * (BP.x1 - BP.x0);
const by = (P: number) => BP.y0 + (P / BP.p1) * (BP.y1 - BP.y0);

function renderBoil(d: Draw, s: Atm, p: Params, theme: Theme) {
  const Teb = tebC(p);
  const Pl = localP(p);
  const cooker = num(p, "panela") > 0;
  const boiling = s.Tw >= Teb - 1e-6;
  // Fogão e panela
  d.rect(0.6, 0.5, 5.6, 0.5, { fill: theme.muted });
  for (let k = 0; k < 7; k++) d.circle(1.4 + k * 0.65, 1.15, 0.12 + 0.05 * Math.sin(s.tf * 3 + k), { fill: "rgba(80,140,255,0.8)" });
  const px0 = 1.2, px1 = 5.6, py0 = 1.4, py1 = 4.6;
  const level = py0 + (py1 - py0 - 0.4) * Math.max(0, 1 - s.mev / M_PANELA);
  const f = Math.max(0, Math.min(1, (s.Tw - 20) / 100));
  d.rect(px0, py0, px1 - px0, level - py0, { fill: `rgba(${Math.round(70 + 60 * f)},${Math.round(140 - 20 * f)},${Math.round(230 - 30 * f)},0.55)` });
  d.polyline([[px0, py1], [px0, py0], [px1, py0], [px1, py1]], { color: theme.text, width: 3 });
  if (boiling && s.mev < M_PANELA) {
    for (let k = 0; k < 14; k++) {
      const ph = (s.tf * 0.8 + k * 0.37) % 1;
      d.circle(px0 + 0.3 + ((k * 0.61) % 1) * (px1 - px0 - 0.6), py0 + ph * (level - py0), 0.06 + 0.06 * ph, { stroke: "#ffffff", width: 1.2 });
    }
  }
  if (cooker) {
    d.rect(px0 - 0.15, py1, px1 - px0 + 0.3, 0.25, { fill: theme.text });
    d.rect((px0 + px1) / 2 - 0.12, py1 + 0.25, 0.24, 0.35, { fill: theme.positive });
    d.text(`panela de pressão: +${fmt(num(p, "panela"))} kPa`, (px0 + px1) / 2, py1 + 0.9, { size: 10, weight: "600" });
    if (boiling) d.circle((px0 + px1) / 2, py1 + 0.85 + 0.2 * ((s.tf * 2) % 1), 0.15, { fill: theme.muted, alpha: 0.4 });
  } else if (boiling) {
    for (let k = 0; k < 3; k++) d.circle(2 + k * 1.3, py1 + 0.3 + 0.5 * ((s.tf * 0.7 + k * 0.3) % 1), 0.2, { fill: theme.muted, alpha: 0.25 });
  }
  thermometer(d, 6.6, 1.4, 4.6, s.Tw, 0, 140, theme, "água");
  const city = CITIES.find((c) => Math.abs(c.h - num(p, "local")) < 1)?.name ?? `${fmt(num(p, "local"))} m`;
  const info = [
    city,
    `P = ${fmt(Pl / 1000)} kPa  →  ebulição a ${fmt(Teb)} °C`,
    `cozimento: ${fmt(cookFactor(Teb), 2)}× o tempo a 100 °C`,
    `evaporado: ${fmt(s.mev * 1000)} g de ${fmt(M_PANELA * 1000)} g · t = ${fmt(s.tf, 3)} s`,
  ];
  info.forEach((t, k) => d.text(t, 0.6, 8.4 - k * 0.5, { size: k === 0 ? 13 : 11, weight: k === 0 ? "700" : "400", align: "left" }));
  // Curva de pressão de vapor
  d.line(BP.x0, BP.y0, BP.x1, BP.y0, { color: theme.muted });
  d.line(BP.x0, BP.y0, BP.x0, BP.y1, { color: theme.muted });
  for (let t = BP.t0; t <= BP.t1; t += 20) d.text(`${t}`, bx(t), BP.y0 - 0.25, { size: 9, color: theme.muted });
  for (let P = 0; P <= BP.p1; P += 100e3) {
    d.text(`${P / 1000}`, BP.x0 - 0.1, by(P), { size: 9, align: "right", color: theme.muted });
    d.line(BP.x0, by(P), BP.x1, by(P), { color: theme.grid, width: 1 });
  }
  d.text("T (°C)", BP.x1, BP.y0 - 0.55, { size: 10, align: "right", color: theme.muted });
  d.text("pressão de vapor (kPa)", BP.x0, BP.y1 + 0.3, { size: 10, align: "left", color: theme.muted });
  d.plot((x) => by(psatCC(BP.t0 + ((x - BP.x0) / (BP.x1 - BP.x0)) * (BP.t1 - BP.t0) + 273.15)), BP.x0, BP.x1, { color: theme.accent, width: 2.5 });
  d.plot((x) => by(psatAntoine(BP.t0 + ((x - BP.x0) / (BP.x1 - BP.x0)) * (BP.t1 - BP.t0) + 273.15)), BP.x0, BP.x1, { color: theme.muted, width: 1.5, dash: [4, 4] });
  d.text("Clausius–Clapeyron", bx(128), by(psatCC(401)) + 0.1, { size: 9, align: "right", color: theme.accent });
  d.text("dados (Antoine)", bx(139), by(psatAntoine(412)) - 0.3, { size: 9, align: "right", color: theme.muted });
  for (const c of CITIES) {
    const P = isaP(c.h);
    const t = boilT(P) - 273.15;
    d.dot(bx(t), by(P), 3, theme.muted);
  }
  d.line(BP.x0, by(Pl), bx(Teb), by(Pl), { color: theme.series[1], dash: [5, 4] });
  d.line(bx(Teb), BP.y0, bx(Teb), by(Pl), { color: theme.series[1], dash: [5, 4] });
  d.dot(bx(Teb), by(Pl), 6, theme.series[1]!);
  d.text(`${fmt(Teb)} °C`, bx(Teb), by(Pl), { size: 10, dx: 8, dy: 12, align: "left", color: theme.series[1], weight: "600" });
  if (s.Tw >= BP.t0) d.line(bx(Math.min(BP.t1, s.Tw)), BP.y0, bx(Math.min(BP.t1, s.Tw)), BP.y0 + 0.4, { color: theme.positive, width: 3 });
}

// ---------- Modo 2: umidade ----------

const HP = { x0: 8.8, x1: 15.5, y0: 0.9, y1: 8.3, t0: -10, t1: 40, a1: 52 };
const hx = (t: number) => HP.x0 + ((t - HP.t0) / (HP.t1 - HP.t0)) * (HP.x1 - HP.x0);
const hyA = (a: number) => HP.y0 + (a / HP.a1) * (HP.y1 - HP.y0);
const GLASS = { x0: 1.0, x1: 3.6, y0: 1.0, y1: 5.2 };

function renderHumidity(d: Draw, s: Atm, p: Params, theme: Theme) {
  const t = Tar(p), ur = UR(p);
  const e = vaporP(p);
  const td = dewPoint(t, ur);
  const tu = wetBulb(t, ur);
  // Copo
  const g = GLASS;
  d.polyline([[g.x0, g.y1], [g.x0 + 0.2, g.y0], [g.x1 - 0.2, g.y0], [g.x1, g.y1]], { color: theme.text, width: 2.5 });
  d.polyline([[g.x0 + 0.06, g.y1 - 0.6], [g.x0 + 0.24, g.y0 + 0.05], [g.x1 - 0.24, g.y0 + 0.05], [g.x1 - 0.06, g.y1 - 0.6]], { color: "none", fill: "rgba(90,160,230,0.35)", close: true });
  for (const [ix, iy] of [[1.6, 3.6], [2.5, 3.9], [2.0, 2.8]] as const) d.rect(ix, iy, 0.55, 0.5, { fill: "rgba(230,245,255,0.8)", stroke: theme.muted, width: 1 });
  // Gotas: quantidade proporcional à água condensada
  const nd = Math.min(60, Math.round(s.mc * 40));
  for (let k = 0; k < nd; k++) {
    const fy = ((k * 0.618) % 1) * 0.9 + 0.05;
    const side = k % 2 ? 1 : -1;
    const y = g.y0 + fy * (g.y1 - g.y0);
    const xEdge = side < 0 ? g.x0 + 0.2 * (1 - fy) : g.x1 - 0.2 * (1 - fy);
    d.circle(xEdge + side * 0.04, y, 0.05 + 0.03 * ((k * 0.41) % 1), { fill: theme.accent, alpha: 0.8 });
    if (k > 1) d.circle((g.x0 + g.x1) / 2 + (((k * 0.29) % 1) - 0.5) * 2.0, y, 0.04, { fill: theme.accent, alpha: 0.55 });
  }
  thermometer(d, 0.5, 1.4, 5.0, s.Tc, -10, 40, theme, "copo");
  d.text(s.Tc < td ? "abaixo do orvalho: condensa" : "acima do orvalho: seco", (g.x0 + g.x1) / 2, g.y1 + 0.35, { size: 11, weight: "600", color: s.Tc < td ? theme.accent : theme.muted });
  d.text("arraste o termômetro do copo", (g.x0 + g.x1) / 2, g.y0 - 0.45, { size: 9, color: theme.muted });
  // Psicrômetro
  thermometer(d, 4.6, 1.4, 5.0, t, -10, 40, theme, "seco");
  thermometer(d, 5.6, 1.4, 5.0, tu, -10, 40, theme, "úmido");
  d.rect(5.45, 1.05, 0.3, 0.6, { fill: "rgba(240,240,240,0.7)", stroke: theme.muted, width: 1 });
  d.text("psicrômetro", 5.1, 5.85, { size: 10, color: theme.muted });
  const info = [
    `ar a ${fmt(t)} °C, umidade relativa ${fmt(100 * ur)} %`,
    `umidade absoluta ${fmt(absHum(e, t))} g/m³ (máx. ${fmt(absHum(esat(t), t))} g/m³)`,
    `ponto de orvalho ${fmt(td)} °C · bulbo úmido ${fmt(tu)} °C`,
    `água condensada no copo: ${fmt(s.mc)} g`,
  ];
  info.forEach((tt, k) => d.text(tt, 0.4, 8.4 - k * 0.5, { size: k === 0 ? 12 : 11, weight: k === 0 ? "700" : "400", align: "left" }));
  // Diagrama de umidade
  d.line(HP.x0, HP.y0, HP.x1, HP.y0, { color: theme.muted });
  d.line(HP.x0, HP.y0, HP.x0, HP.y1, { color: theme.muted });
  for (let tt = HP.t0; tt <= HP.t1; tt += 10) d.text(`${tt}`, hx(tt), HP.y0 - 0.25, { size: 9, color: theme.muted });
  for (let a = 0; a <= 50; a += 10) {
    d.text(`${a}`, HP.x0 - 0.1, hyA(a), { size: 9, align: "right", color: theme.muted });
    d.line(HP.x0, hyA(a), HP.x1, hyA(a), { color: theme.grid, width: 1 });
  }
  d.text("T (°C)", HP.x1, HP.y0 - 0.55, { size: 10, align: "right", color: theme.muted });
  d.text("umidade absoluta (g/m³)", HP.x0, HP.y1 + 0.3, { size: 10, align: "left", color: theme.muted });
  const curve = (f: number) => (x: number) => {
    const tt = HP.t0 + ((x - HP.x0) / (HP.x1 - HP.x0)) * (HP.t1 - HP.t0);
    return hyA(absHum(f * esat(tt), tt));
  };
  for (const f of [0.25, 0.5, 0.75]) {
    d.plot(curve(f), HP.x0, HP.x1, { color: theme.muted, width: 1, dash: [3, 4] });
    d.text(`${f * 100}%`, HP.x1, hyA(absHum(f * esat(HP.t1), HP.t1)), { size: 9, dx: 2, align: "left", color: theme.muted });
  }
  d.plot(curve(1), HP.x0, HP.x1, { color: theme.accent, width: 2.5 });
  d.text("saturação (100%)", hx(31), hyA(absHum(esat(31), 31)), { size: 9, align: "right", dx: -6, color: theme.accent });
  const a = absHum(e, t);
  d.arrow(hx(t), hyA(a), hx(td) - hx(t), 0, { color: theme.series[1], width: 1.5 });
  d.dot(hx(t), hyA(a), 6, theme.series[1]!);
  d.dot(hx(td), hyA(absHum(esat(td), td)), 4, theme.accent);
  d.text(`orvalho ${fmt(td)} °C`, hx(td), hyA(a), { size: 10, dy: -12, color: theme.accent });
  d.line(hx(s.Tc), HP.y0, hx(s.Tc), hyA(absHum(esat(s.Tc), s.Tc)), { color: s.Tc < td ? theme.accent : theme.muted, width: 2 });
  d.text("copo", hx(s.Tc), HP.y0 + 0.2, { size: 9, dx: 14, color: theme.muted });
}

export const atmosferaUmidade = defineSim<Atm>({
  id: "atmosfera-umidade",
  title: "Atmosfera, ebulição e umidade do ar",
  course: "FG II",
  topic: "Termodinâmica",
  priority: "P2",
  summary:
    "Pressão e temperatura com a altitude (modelo isotérmico × atmosfera padrão) com um balão-sonda que sobe e se expande, ponto de ebulição pela equação de Clausius–Clapeyron em cidades e na panela de pressão, e umidade, ponto de orvalho e psicrômetro.",
  equations: [
    String.raw`\frac{dP}{dh} = -\rho g = -\frac{PMg}{RT} \Rightarrow P = P_0\,e^{-h/H},\ H = \frac{RT}{Mg} \ \text{(isotérmico)}`,
    String.raw`\text{troposfera: } T = T_0 - \Gamma h,\quad P = P_0\left(1-\frac{\Gamma h}{T_0}\right)^{Mg/R\Gamma}`,
    String.raw`\ln\frac{P}{P_0} = -\frac{L}{R}\left(\frac{1}{T_{eb}} - \frac{1}{T_0}\right) \ \text{(Clausius–Clapeyron)}`,
    String.raw`e_s(T) = 611{,}2\,e^{17{,}62\,T/(243{,}12+T)}\ \text{Pa} \qquad UR = \frac{e}{e_s(T)} \qquad e_s(T_{orv}) = e`,
    String.raw`e = e_s(T_u) - A P (T - T_u) \ \text{(psicrômetro)}`,
  ],
  liveEquations(s, p) {
    const m = modo(p);
    if (m === 0) {
      const T = num(p, "Tiso", 288);
      return [
        String.raw`H = \frac{R\,(${texNum(T)}\ \text{K})}{Mg} = ${texNum(scaleHeight(T) / 1000)}\ \text{km} \qquad P_{iso}(${texNum(s.h / 1000)}\ \text{km}) = ${texNum(isoP(s.h, T) / 1000)}\ \text{kPa}`,
        String.raw`P_{padrão} = ${texNum(isaP(s.h) / 1000)}\ \text{kPa} \qquad T = ${texNum(isaT(s.h))}\ \text{K}`,
      ];
    }
    if (m === 1) {
      return [
        String.raw`T_{eb} = \left[\frac{1}{373{,}15} - \frac{R}{L}\ln\frac{${texNum(localP(p) / 1000)}}{101{,}3}\right]^{-1} = ${texNum(tebC(p) + 273.15)}\ \text{K} = ${texNum(tebC(p))}\ ^\circ\text{C}`,
      ];
    }
    const t = Tar(p), ur = UR(p);
    return [
      String.raw`e = UR \cdot e_s(${texNum(t)}) = ${texNum(ur)} \times ${texNum(esat(t))}\ \text{Pa} = ${texNum(vaporP(p))}\ \text{Pa}`,
      String.raw`\rho_v = \frac{eM}{RT} = ${texNum(absHum(vaporP(p), t))}\ \text{g/m}^3 \qquad T_{orv} = ${texNum(dewPoint(t, ur))}\ ^\circ\text{C}`,
    ];
  },

  params: [
    {
      key: "modo",
      label: "Experimento",
      unit: "",
      min: 0,
      max: 2,
      step: 1,
      default: 0,
      options: [
        { value: 0, label: "Pressão e temperatura × altitude" },
        { value: 1, label: "Ponto de ebulição × pressão" },
        { value: 2, label: "Umidade e ponto de orvalho" },
      ],
    },
    {
      key: "hView",
      label: "Faixa de altitude",
      unit: "km",
      min: 15,
      max: 120,
      step: 1,
      default: 50,
      live: true,
      options: [
        { value: 15, label: "0 a 15 km" },
        { value: 50, label: "0 a 50 km" },
        { value: 120, label: "0 a 120 km" },
      ],
    },
    { key: "Tiso", label: "Temperatura do modelo isotérmico", unit: "K", min: 200, max: 320, step: 1, default: 288, live: true },
    { key: "vsub", label: "Velocidade de subida do balão", unit: "m/s", min: 1, max: 10, step: 0.5, default: 5, live: true },
    { key: "Dburst", label: "Diâmetro de estouro do balão", unit: "m", min: 3, max: 12, step: 0.5, default: 8 },
    { key: "local", label: "Local", unit: "m", min: 0, max: 8849, step: 1, default: 0, live: true, options: CITIES.map((c) => ({ value: c.h, label: c.name })) },
    { key: "panela", label: "Sobrepressão da panela de pressão", unit: "kPa", min: 0, max: 120, step: 5, default: 0, live: true },
    { key: "pot", label: "Potência do fogão", unit: "W", min: 300, max: 3000, step: 50, default: 1500, live: true },
    { key: "Tar", label: "Temperatura do ar", unit: "°C", min: -5, max: 40, step: 0.5, default: 25, live: true },
    { key: "UR", label: "Umidade relativa", unit: "%", min: 5, max: 100, step: 1, default: 60, live: true },
    { key: "Tgelo", label: "Temperatura da água com gelo", unit: "°C", min: 0, max: 25, step: 0.5, default: 2, live: true },
  ],

  observables: [
    { key: "h", label: "Altitude do balão", unit: "km", value: (s) => s.h / 1000 },
    { key: "Pisa", label: "Pressão (atmosfera padrão)", unit: "kPa", value: (s) => isaP(s.h) / 1000 },
    { key: "Piso", label: "Pressão (modelo isotérmico)", unit: "kPa", value: (s, p) => isoP(s.h, num(p, "Tiso", 288)) / 1000 },
    { key: "Tatm", label: "Temperatura do ar na altitude", unit: "°C", value: (s) => isaT(s.h) - 273.15 },
    { key: "rho", label: "Densidade do ar", unit: "kg/m³", value: (s) => density(isaP(s.h), isaT(s.h)) },
    { key: "Vbal", label: "Volume do balão", unit: "m³", value: (s) => balloonV(s.h) },
    { key: "Tw", label: "Temperatura da água", unit: "°C", value: (s) => s.Tw },
    { key: "Teb", label: "Ponto de ebulição", unit: "°C", value: (_s, p) => tebC(p) },
    { key: "Ploc", label: "Pressão sobre a água", unit: "kPa", value: (_s, p) => localP(p) / 1000 },
    { key: "mev", label: "Água evaporada", unit: "g", value: (s) => s.mev * 1000 },
    { key: "UA", label: "Umidade absoluta", unit: "g/m³", value: (_s, p) => absHum(vaporP(p), Tar(p)) },
    { key: "Td", label: "Ponto de orvalho", unit: "°C", value: (_s, p) => dewPoint(Tar(p), UR(p)) },
    { key: "Tu", label: "Temperatura de bulbo úmido", unit: "°C", value: (_s, p) => wetBulb(Tar(p), UR(p)) },
    { key: "Tc", label: "Temperatura do copo", unit: "°C", value: (s) => s.Tc },
    { key: "mc", label: "Água condensada no copo", unit: "g", value: (s) => s.mc },
    { key: "tf", label: "Tempo físico", unit: "s", value: (s) => s.tf },
  ],
  chart: { x: "h", y: "Pisa" },

  scenarios: [
    {
      id: "balao",
      label: "Balão-sonda e camadas da atmosfera",
      params: { modo: 0, hView: 50, Tiso: 288, vsub: 5, Dburst: 8 },
      guide: `### Subindo com um balão-sonda
1. Rode: o balão sobe a 5 m/s (tempo acelerado 60×). Repare no gráfico: a pressão cai **à metade a cada ~5,5 km**.
2. Compare a curva da atmosfera padrão com a do modelo isotérmico. Onde elas se separam? Ajuste $T$ do modelo isotérmico para 250 K e veja qual faixa ele descreve melhor.
3. O perfil de temperatura define as **camadas**: na troposfera a temperatura cai 6,5 °C/km; na estratosfera ela sobe (ozônio absorvendo UV).
4. Arraste o balão para escolher uma altitude e leia $P$, $T$ e $\\rho$.`,
      predict: [
        {
          question: "O balão sai do chão com 1,8 m de diâmetro. Até estourar com 8 m, o volume do gás aumenta cerca de:",
          options: ["4 vezes", "18 vezes", "90 vezes"],
          answer: 2,
          explanation: "O volume vai com $D^3$: $(8/1{,}8)^3 \\approx 88$. Como $V \\propto T/P$, ele estoura quando $P$ cai a ~1/90 de $P_0$ (corrigido pela temperatura), por volta de 30 km.",
        },
      ],
    },
    {
      id: "ebulicao",
      label: "Ebulição em La Paz e na panela de pressão",
      params: { modo: 1, local: 3640, panela: 0, pot: 1500 },
      guide: `### Por que o feijão não cozinha em La Paz
1. Rode até a água ferver: ela para de esquentar em ~88 °C. A energia passa a ir para a vaporização ($L = 2{,}26$ MJ/kg).
2. Troque o local durante a fervura e veja o ponto de ebulição seguir a curva de pressão de vapor.
3. Ponha a **panela de pressão** (+100 kPa): a água passa de 110 °C, e o cozimento fica várias vezes mais rápido.
4. Compare a curva de Clausius–Clapeyron (L constante) com os dados experimentais (tracejado).`,
      predict: [
        {
          question: "Com a água já fervendo, aumentar a potência do fogão:",
          options: ["Aumenta a temperatura da água", "Aumenta a taxa de evaporação, a temperatura fica a mesma", "Não muda nada"],
          answer: 1,
          explanation: "Na ebulição a temperatura é fixada pela pressão: $T_{eb}(P)$. Mais potência só evapora mais rápido ($\\dot m = \\mathcal{P}/L$).",
        },
      ],
    },
    {
      id: "orvalho",
      label: "Copo gelado e ponto de orvalho",
      params: { modo: 2, Tar: 30, UR: 70, Tgelo: 2 },
      guide: `### O copo que "sua"
1. O copo com gelo esfria. Quando sua temperatura passa abaixo do **ponto de orvalho** (linha horizontal no diagrama), o vapor do ar condensa nele.
2. Diminua a umidade relativa para 30%: o ponto de orvalho cai abaixo de 10 °C e o copo fica seco.
3. No psicrômetro, o termômetro úmido marca menos que o seco: a evaporação rouba calor. Com UR = 100% eles marcam o mesmo.`,
    },
  ],

  exercises: [
    {
      id: "ebulicao",
      prompt: "Usando Clausius–Clapeyron com L = 40,66 kJ/mol e ebulição a 100 °C sob 101,325 kPa, a que temperatura (°C) a água ferve sob {Pk} kPa?",
      vary: { Pk: [55, 220, 0] },
      answer: { label: "T_eb", unit: "°C", compute: (p) => boilT(num(p, "Pk") * 1000) - 273.15 },
      tolerance: 0.01,
      hint: "1/T = 1/373,15 − (R/L) ln(P/P₀).",
    },
    {
      id: "orvalho",
      prompt: "O ar está a {Tar} °C com umidade relativa de {UR} %. Qual é o ponto de orvalho (°C)? Use e_s(T) = 611,2·exp(17,62T/(243,12 + T)) Pa.",
      vary: { Tar: [15, 35, 0], UR: [30, 90, 0] },
      fixed: { modo: 2 },
      answer: { label: "T_orv", unit: "°C", compute: (p) => dewPoint(num(p, "Tar"), num(p, "UR") / 100) },
      tolerance: 0.02,
      hint: "Resolva e_s(T_orv) = UR·e_s(T).",
    },
    {
      id: "isotermico",
      prompt: "No modelo de atmosfera isotérmica a {Tiso} K (M = 28,96 g/mol, g = 9,81 m/s²), qual é a pressão a {hk} km de altitude, em kPa?",
      vary: { Tiso: [230, 300, 0], hk: [2, 20, 1] },
      answer: { label: "P", unit: "kPa", compute: (p) => isoP(num(p, "hk") * 1000, num(p, "Tiso")) / 1000 },
      hint: "P = P₀ e^(−Mgh/RT).",
    },
  ],

  init: (p) => ({ h: 0, burst: false, tf: 0, Tw: 20, mev: 0, Tc: Tar(p), mc: 0 }),
  step(s, p, _t, dt) {
    const m = modo(p);
    const dtf = dt * SPEED[m]!;
    const n: Atm = { ...s, tf: s.tf + dtf };
    if (m === 0) {
      if (!s.burst) {
        n.h = s.h + num(p, "vsub", 5) * dtf;
        if (balloonV(n.h) >= burstVolume(p)) n.burst = true;
      }
    } else if (m === 1) {
      const Teb = tebC(p);
      const P = num(p, "pot", 1500);
      const mw = Math.max(0.01, M_PANELA - s.mev);
      if (s.mev >= M_PANELA) return n;
      if (s.Tw > Teb) {
        // Ebulição súbita: o excesso de calor sensível vaporiza água.
        n.mev = s.mev + (mw * C_AGUA * (s.Tw - Teb)) / L_KG;
        n.Tw = Teb;
      } else if (s.Tw < Teb) {
        n.Tw = Math.min(Teb, s.Tw + (P * dtf) / (mw * C_AGUA));
      } else {
        n.mev = Math.min(M_PANELA, s.mev + (P * dtf) / L_KG);
      }
    } else {
      const tg = num(p, "Tgelo", 2);
      n.Tc = tg + (s.Tc - tg) * Math.exp(-dtf / TAU_COPO);
      const d = absHum(vaporP(p), Tar(p)) - absHum(esat(n.Tc), n.Tc);
      n.mc = Math.max(0, s.mc + HM_A * d * dtf);
    }
    return n;
  },
  dt: 0.02,
  sampleEvery: 5,

  pointer: {
    down: (s, p, pt) => pick(s, p, pt),
    move: (s, p, pt, dragging) => (dragging ? pick(s, p, pt) : undefined),
    cursor: (_s, p, pt) => (pick({ h: 0, burst: false, tf: 0, Tw: 0, mev: 0, Tc: 0, mc: 0 }, p, pt) ? "ns-resize" : undefined),
  },
  actions: [
    { id: "solta", label: "Novo balão / reiniciar copo", run: (s, p) => ({ ...s, h: 0, burst: false, Tc: Tar(p), mc: 0 }) },
  ],

  narrowSplit: () => 0.499,
  viewport: () => ({ xMin: 0, xMax: 16, yMin: -0.2, yMax: 9 }),

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const { state: s, params: p, theme } = frame;
    const m = modo(p);
    if (m === 0) renderAltitude(d, s, p, theme);
    else if (m === 1) renderBoil(d, s, p, theme);
    else renderHumidity(d, s, p, theme);
  },
});

function pick(s: Atm, p: Params, pt: { x: number; y: number }): Atm | undefined {
  const m = modo(p);
  if (m === 0 && Math.abs(pt.x - 6.7) < 0.8 && pt.y > COL.y0 - 0.3 && pt.y < COL.y1 + 0.3) {
    const h = Math.max(0, Math.min(hView(p), yh(pt.y, p)));
    return { ...s, h, burst: balloonV(h) >= burstVolume(p) };
  }
  if (m === 2 && Math.abs(pt.x - 0.5) < 0.45 && pt.y > 1.2 && pt.y < 5.2) {
    return { ...s, Tc: -10 + ((Math.max(1.4, Math.min(5.0, pt.y)) - 1.4) / 3.6) * 50 };
  }
  return undefined;
}

export default atmosferaUmidade;
