import { clamp, defineSim, draw, formatBR, num, texNum, type Draw, type Params } from "@fisilab/core";
import {
  ATMOSFERAS,
  BARRIL,
  BOMBA,
  G,
  HERON,
  H_VASO,
  LIQUIDOS_U,
  LUDIAO,
  P0,
  PARADOXO,
  P_VAPOR,
  RHO,
  U,
  VASOS,
  X_VASOS,
  bolha,
  equilibrioU,
  forcaFundo,
  forcaLudiao,
  forcaTampa,
  heron,
  hMaxSuccao,
  massaLudiao,
  massaTubo,
  modo,
  nivelComum,
  nivelVaso,
  pesoAgua,
  profEquilibrio,
  vazoesVasos,
  volumeAr,
  volumeVaso,
} from "./physics.ts";

export * from "./physics.ts";

export interface VC {
  /** Volumes nos vasos comunicantes (m³). */
  V: number[];
  /** Sonda de pressão (coordenadas do palco) e item arrastado (0 nada, 1 sonda, 2 ponta da tábua). */
  sonda: [number, number];
  arr: number;
  /** Tubo em U: coluna atual do líquido B e interface no braço esquerdo (m). */
  LB: number;
  zi: number;
  /** Paradoxo: altura atual da água (m). */
  hP: number;
  /** Ludião: profundidade (m), velocidade para baixo (m/s) e aperto. */
  d: number;
  v: number;
  apertando: boolean;
  /** Heron: níveis nas câmaras B e C (m) e volume que já jorrou (m³). */
  zB: number;
  zC: number;
  Vjato: number;
  /** Nível: inclinação da tábua (rad). */
  theta: number;
  /** Bombas: coluna de água (m), fase do pistão, volume bombeado (m³). */
  zc: number;
  ph: number;
  Vbomb: number;
  /** Barril: altura da água no tubo (m) e se já estourou. */
  hBar: number;
  estourou: boolean;
}

const fmt = (v: number, d = 3) => formatBR(v, d);
const liqU = (p: Params) => LIQUIDOS_U[Math.round(num(p, "liquidos"))] ?? LIQUIDOS_U[0]!;
const p0 = (p: Params) => num(p, "p0", 101.325) * 1000;
const apertoPa = (s: VC, p: Params) => (s.apertando || Math.round(num(p, "travar")) === 1 ? num(p, "aperto", 4) * 1000 : 0);

/** Mapeamento metros → palco de cada modo. */
const MAPA = [
  { X0: 0.4, Y0: 1.6, k: 11.5 },
  { X0: 3.2, Y0: 1.4, k: 11 },
  { X0: 1.2, Y0: 2.2, k: 11 },
  { X0: 3.4, Y0: 1.0, k: 26 },
  { X0: 4.5, Y0: 0.6, k: 5.4 },
  { X0: 2.5, Y0: 3.2, k: 5.5 },
  { X0: 5, Y0: 1.0, k: 0.48 },
  { X0: 0, Y0: 0, k: 1 },
];
const mapa = (p: Params) => MAPA[modo(p)] ?? MAPA[0]!;

// ------------------------------------------------------------------ medidas derivadas

export const niveis = (s: VC) => s.V.map((V, i) => nivelVaso(i, V));

const H_PIPE = 0.04;

/** Pressão absoluta (Pa) na posição da sonda; NaN fora do líquido. */
export function pressaoSonda(s: VC, p: Params): number {
  const m = modo(p);
  const { X0, Y0, k } = mapa(p);
  const x = (s.sonda[0] - X0) / k;
  const y = (s.sonda[1] - Y0) / k;
  if (m === 0) {
    const h = niveis(s);
    if (y <= 0 && y >= -H_PIPE && x >= X_VASOS[0]! - 0.02 && x <= X_VASOS[3]! + 0.02) return P0 + RHO * G * (h.reduce((a, b) => a + b, 0) / h.length - y);
    for (let i = 0; i < VASOS.length; i++) {
      const v = VASOS[i]!;
      if (y >= 0 && y <= h[i]! && Math.abs(x - X_VASOS[i]! - v.dx(y)) <= v.w(y) / 2) return P0 + RHO * G * (h[i]! - y);
    }
    return NaN;
  }
  if (m === 1) {
    const { rhoA, rhoB } = liqU(p);
    const zr = 2 * U.hA - s.zi;
    const meia = 0.025;
    if (Math.abs(x) <= meia && y >= -H_PIPE) {
      if (y <= s.zi) return P0 + rhoB * G * s.LB + rhoA * G * (s.zi - y);
      if (y <= s.zi + s.LB) return P0 + rhoB * G * (s.zi + s.LB - y);
      return NaN;
    }
    if (Math.abs(x - U.base) <= meia && y >= -H_PIPE && y <= zr) return P0 + rhoA * G * (zr - y);
    if (y <= 0 && y >= -H_PIPE && x >= 0 && x <= U.base) return P0 + rhoA * G * (zr - y);
    return NaN;
  }
  return NaN;
}

function passoLudiao(s: VC, p: Params, dt: number): VC {
  const dp = apertoPa(s, p);
  const m = massaLudiao();
  const n = 10;
  let { d, v } = s;
  const h = dt / n;
  for (let i = 0; i < n; i++) {
    const Fup = forcaLudiao(d, dp);
    const meff = m + 0.5 * RHO * (LUDIAO.Vg + volumeAr(d, dp));
    const arrasto = 0.5 * RHO * LUDIAO.Cd * LUDIAO.area * v * Math.abs(v) + 0.002 * v;
    const a = (-Fup - arrasto) / meff; // v e a positivos para baixo
    v += a * h;
    d += v * h;
    const dMin = 0.012;
    const dMax = LUDIAO.agua - 0.016;
    if (d < dMin) {
      d = dMin;
      v = Math.max(0, v);
    }
    if (d > dMax) {
      d = dMax;
      v = Math.min(0, v);
    }
  }
  return { ...s, d, v };
}

/** Posição do pistão (m, 0 embaixo) e sua velocidade. */
const pistao = (ph: number, f: number) => ({ y: (BOMBA.curso * (1 - Math.cos(ph))) / 2, v: (BOMBA.curso * Math.sin(ph) * 2 * Math.PI * f) / 2 });

function passoBomba(s: VC, p: Params, dt: number): VC {
  const f = num(p, "freq", 0.5);
  const H = num(p, "Hb", 8);
  const ph = s.ph + 2 * Math.PI * f * dt;
  const { v } = pistao(ph, f);
  const ganho = (BOMBA.Acil / BOMBA.Apipe) * 0.3;
  let { zc, Vbomb } = s;
  if (Math.round(num(p, "bomba")) === 0) {
    const hmax = hMaxSuccao(p0(p));
    if (v > 0) {
      if (zc < H) zc = Math.min(zc + ganho * v * dt, H, hmax);
      else Vbomb += BOMBA.Acil * v * dt;
    }
  } else if (v < 0) {
    if (zc < H) zc = Math.min(H, zc + ganho * -v * dt);
    else Vbomb += BOMBA.Acil * -v * dt;
  }
  return { ...s, ph, zc, Vbomb };
}

/** Vazão instantânea (L/s) e força no pistão (N). */
export function bombaAgora(s: VC, p: Params) {
  const f = num(p, "freq", 0.5);
  const H = num(p, "Hb", 8);
  const { v } = pistao(s.ph, f);
  const succao = Math.round(num(p, "bomba")) === 0;
  const cheia = s.zc >= H - 1e-9;
  const Q = cheia ? (succao ? Math.max(0, v) : Math.max(0, -v)) * BOMBA.Acil * 1000 : 0;
  const pTopo = succao ? Math.max(Math.min(P_VAPOR, p0(p)), p0(p) - RHO * G * s.zc) : p0(p) + RHO * G * s.zc;
  const F = succao ? (p0(p) - pTopo) * BOMBA.Acil : RHO * G * s.zc * BOMBA.Acil;
  return { Q, F, pTopo };
}

function init(p: Params): VC {
  const Vtot = num(p, "volume", 1.5) / 1000;
  // toda a água despejada no vaso escolhido; depois ela se distribui
  const alvo = Math.round(num(p, "vasoInicial"));
  const V = VASOS.map((_, i) => (alvo === 4 ? volumeVaso(i, nivelComum(Vtot)) : i === alvo ? Vtot : 0));
  const m = modo(p);
  return {
    V,
    sonda: m === 1 ? [3.2 + 11 * U.base, 1.4 + 11 * 0.05] : [0.4 + 11.5 * X_VASOS[0]!, 1.6 + 11.5 * 0.05],
    arr: 0,
    LB: 0,
    zi: U.hA,
    hP: 0,
    d: 0.012,
    v: 0,
    apertando: false,
    zB: HERON.B.y1 - 0.005,
    zC: HERON.C.y0 + 0.02,
    Vjato: 0,
    theta: (num(p, "inclinacao", 1) * Math.PI) / 180,
    zc: 0,
    ph: 0,
    Vbomb: 0,
    hBar: 0,
    estourou: false,
  };
}

function step(s: VC, p: Params, _t: number, dt: number): VC {
  switch (modo(p)) {
    case 0: {
      const n = 5;
      let V = s.V;
      for (let k = 0; k < n; k++) {
        const Q = vazoesVasos(V.map((x, i) => nivelVaso(i, x)));
        V = V.map((x, i) => Math.max(0, x + (Q[i]! * dt) / n));
      }
      return { ...s, V };
    }
    case 1: {
      const alvo = num(p, "LB", 0.1);
      const LB = s.LB < alvo ? Math.min(alvo, s.LB + 0.05 * dt) : Math.max(alvo, s.LB - 0.05 * dt);
      const { rhoA, rhoB } = liqU(p);
      const eq = equilibrioU(rhoA, rhoB, LB);
      return { ...s, LB, zi: eq.zi + (s.zi - eq.zi) * Math.exp(-dt / 0.4) };
    }
    case 2: {
      const alvo = num(p, "hP", 0.3);
      return { ...s, hP: s.hP < alvo ? Math.min(alvo, s.hP + 0.1 * dt) : Math.max(alvo, s.hP - 0.1 * dt) };
    }
    case 3:
      return passoLudiao(s, p, dt);
    case 4: {
      const { Q } = heron(s.zB, s.zC, num(p, "bico", 2));
      if (s.zC >= HERON.C.y1 - 1e-4) return s;
      const dz = (Q * dt) / HERON.area;
      return { ...s, zB: Math.max(HERON.B.y0, s.zB - dz), zC: Math.min(HERON.C.y1, s.zC + dz), Vjato: s.Vjato + Q * dt };
    }
    case 5:
      return s;
    case 6:
      return passoBomba(s, p, dt);
    default: {
      if (s.estourou) return s;
      const alvo = num(p, "hTubo", 6);
      const hBar = s.hBar < alvo ? Math.min(alvo, s.hBar + 0.8 * dt) : Math.max(alvo, s.hBar - 0.8 * dt);
      return { ...s, hBar, estourou: forcaTampa(hBar) > num(p, "Fmax", 20) * 1000 };
    }
  }
}

// ------------------------------------------------------------------ desenho

function agua(d: Draw) {
  return d.theme.dark ? "rgba(80, 150, 240, 0.55)" : "rgba(60, 130, 230, 0.4)";
}

/** Contorno e conteúdo de um vaso de largura w(y) e centro x0 + dx(y). */
function vaso(d: Draw, M: { X0: number; Y0: number; k: number }, x0: number, w: (y: number) => number, dx: (y: number) => number, H: number, h: number, cor: string) {
  const n = 40;
  const esq: [number, number][] = [];
  const dir: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const y = (i * H) / n;
    esq.push([M.X0 + M.k * (x0 + dx(y) - w(y) / 2), M.Y0 + M.k * y]);
    dir.push([M.X0 + M.k * (x0 + dx(y) + w(y) / 2), M.Y0 + M.k * y]);
  }
  if (h > 0) {
    const L: [number, number][] = [];
    const R: [number, number][] = [];
    for (let i = 0; i <= n; i++) {
      const y = (i * h) / n;
      L.push([M.X0 + M.k * (x0 + dx(y) - w(y) / 2), M.Y0 + M.k * y]);
      R.push([M.X0 + M.k * (x0 + dx(y) + w(y) / 2), M.Y0 + M.k * y]);
    }
    d.polyline([...L, ...R.reverse()], { close: true, fill: cor, color: "none" });
  }
  d.polyline(esq, { width: 2 });
  d.polyline(dir, { width: 2 });
}

function sondaDesenho(d: Draw, s: VC, p: Params) {
  const [x, y] = s.sonda;
  const pr = pressaoSonda(s, p);
  d.circle(x, y, 0.16, { fill: d.theme.series[1] ?? d.theme.accent, stroke: d.theme.text, width: 1 });
  d.line(x, y + 0.16, x, y + 0.9, { color: d.theme.text, width: 1.5 });
  d.rect(x - 1.25, y + 0.9, 2.5, 0.7, { fill: d.theme.dark ? "#222" : "#fff", stroke: d.theme.text, width: 1 });
  d.text(Number.isFinite(pr) ? `${fmt(pr / 1000, 5)} kPa` : "fora do líquido", x, y + 1.25, { size: 11, weight: "600" });
}

function renderVasos(d: Draw, s: VC, p: Params) {
  const M = MAPA[0]!;
  const h = niveis(s);
  const hm = h.reduce((a, b) => a + b, 0) / h.length;
  const x0 = M.X0 + M.k * (X_VASOS[0]! - 0.03);
  const x1 = M.X0 + M.k * (X_VASOS[3]! + 0.03);
  d.rect(x0, M.Y0 - M.k * H_PIPE, x1 - x0, M.k * H_PIPE, { fill: agua(d), stroke: d.theme.text, width: 2 });
  VASOS.forEach((v, i) => {
    vaso(d, M, X_VASOS[i]!, v.w, v.dx, H_VASO, h[i]!, agua(d));
    d.text(`${fmt(h[i]! * 100, 3)} cm`, M.X0 + M.k * (X_VASOS[i]! + v.dx(h[i]!)), M.Y0 + M.k * h[i]! + 0.35, { size: 11, weight: "600" });
    d.text(v.nome, M.X0 + M.k * X_VASOS[i]!, M.Y0 - 0.9, { size: 11, color: d.theme.muted });
  });
  d.line(0.2, M.Y0 + M.k * hm, 15.8, M.Y0 + M.k * hm, { color: d.theme.positive, dash: [6, 4], width: 1 });
  d.text("Clique dentro de um vaso para despejar 0,1 L nele. Arraste a sonda (bolinha) para medir a pressão.", 8, 9.6, { size: 11, color: d.theme.muted });
  d.text(`Volume total: ${fmt(s.V.reduce((a, b) => a + b, 0) * 1000, 4)} L`, 0.3, 0.3, { align: "left", size: 11 });
  sondaDesenho(d, s, p);
}

function renderU(d: Draw, s: VC, p: Params) {
  const M = MAPA[1]!;
  const { rhoA, rhoB, label } = liqU(p);
  const zr = 2 * U.hA - s.zi;
  const w = 0.05;
  const X = (x: number) => M.X0 + M.k * x;
  const Y = (y: number) => M.Y0 + M.k * y;
  const corA = rhoA > 5000 ? (d.theme.dark ? "#b8bec7" : "#9aa1aa") : agua(d);
  const corB = rhoA > 5000 ? agua(d) : "rgba(225, 180, 40, 0.65)";
  // líquido A: fundo e os dois braços
  d.rect(X(-w / 2), Y(-H_PIPE), X(U.base + w / 2) - X(-w / 2), M.k * H_PIPE, { fill: corA });
  d.rect(X(-w / 2), Y(0), M.k * w, M.k * s.zi, { fill: corA });
  d.rect(X(U.base - w / 2), Y(0), M.k * w, M.k * zr, { fill: corA });
  d.rect(X(-w / 2), Y(s.zi), M.k * w, M.k * s.LB, { fill: corB });
  // tubo
  d.polyline([[X(-w / 2), Y(U.alto)], [X(-w / 2), Y(-H_PIPE)], [X(U.base + w / 2), Y(-H_PIPE)], [X(U.base + w / 2), Y(U.alto)]], { width: 2 });
  d.polyline([[X(w / 2), Y(U.alto)], [X(w / 2), Y(0)], [X(U.base - w / 2), Y(0)], [X(U.base - w / 2), Y(U.alto)]], { width: 2 });
  // cotas
  const cota = (x: number, ya: number, yb: number, t: string, cor: string, lado = 1) => {
    d.line(X(x), Y(ya), X(x), Y(yb), { color: cor, width: 1.5 });
    d.line(X(x) - 0.15, Y(ya), X(x) + 0.15, Y(ya), { color: cor });
    d.line(X(x) - 0.15, Y(yb), X(x) + 0.15, Y(yb), { color: cor });
    d.text(t, X(x) + 0.2 * lado, (Y(ya) + Y(yb)) / 2, { size: 11, color: cor, align: lado > 0 ? "left" : "right", weight: "600" });
  };
  d.line(X(-0.12), Y(s.zi), X(U.base + 0.12), Y(s.zi), { color: d.theme.muted, dash: [5, 4] });
  if (s.LB > 1e-4) cota(-0.07, s.zi, s.zi + s.LB, `h_B = ${fmt(s.LB * 100, 3)} cm`, d.theme.series[1] ?? d.theme.text, -1);
  if (zr - s.zi > 1e-4) cota(U.base + 0.07, s.zi, zr, `h_A = ${fmt((zr - s.zi) * 100, 3)} cm`, d.theme.accent);
  const lin = [
    label,
    `ρ_A = ${fmt(rhoA, 5)} kg/m³    ρ_B = ${fmt(rhoB, 4)} kg/m³`,
    `ρ_B h_B = ${fmt(rhoB * s.LB, 4)} kg/m²`,
    `ρ_A h_A = ${fmt(rhoA * (zr - s.zi), 4)} kg/m²`,
    `Desnível das superfícies: ${fmt((s.zi + s.LB - zr) * 100, 3)} cm`,
    s.LB > 0.005 ? `ρ_B medido = ρ_A h_A / h_B = ${fmt((rhoA * (zr - s.zi)) / s.LB, 4)} kg/m³` : "",
  ];
  lin.forEach((l, i) => d.text(l, 9.6, 8.6 - 0.6 * i, { align: "left", size: 12, weight: i === 0 ? "600" : "400" }));
  d.text("Na linha tracejada (mesmo líquido A, mesmo nível) as pressões são iguais.", 9.6, 4.6, { align: "left", size: 10, color: d.theme.muted });
  sondaDesenho(d, s, p);
}

function renderParadoxo(d: Draw, s: VC, p: Params) {
  const M = MAPA[2]!;
  const xs = [0.05, 0.38, 0.78, 1.0];
  const F = forcaFundo(s.hP);
  PARADOXO.forEach((v, i) => {
    const H = 0.42;
    vaso(d, M, xs[i]!, v.w, v.dx, H, s.hP, agua(d));
    d.line(M.X0 + M.k * (xs[i]! - 0.05), M.Y0, M.X0 + M.k * (xs[i]! + 0.05), M.Y0, { width: 3 });
    // setas de pressão nas paredes (normais, comprimento ∝ ρ g (h − y))
    for (let k = 1; k <= 4; k++) {
      const y = (s.hP * (k - 0.5)) / 4;
      const pr = (s.hP - y) * 6;
      const xl = M.X0 + M.k * (xs[i]! + v.dx(y) - v.w(y) / 2);
      const xr = M.X0 + M.k * (xs[i]! + v.dx(y) + v.w(y) / 2);
      const dy = 0.002;
      const sl = (v.w(y + dy) - v.w(y - dy)) / (4 * dy) * -1 + (v.dx(y + dy) - v.dx(y - dy)) / (2 * dy);
      const sr = (v.w(y + dy) - v.w(y - dy)) / (4 * dy) + (v.dx(y + dy) - v.dx(y - dy)) / (2 * dy);
      d.arrow(xl, M.Y0 + M.k * y, -pr, pr * sl, { color: d.theme.positive, width: 1.5, head: 6 });
      d.arrow(xr, M.Y0 + M.k * y, pr, -pr * sr, { color: d.theme.positive, width: 1.5, head: 6 });
    }
    d.arrow(M.X0 + M.k * xs[i]!, M.Y0 + 0.05, 0, -Math.min(1.4, F / 30), { color: d.theme.accent, width: 3 });
    // balança
    const W = pesoAgua(i, s.hP);
    d.rect(M.X0 + M.k * xs[i]! - 0.9, M.Y0 - 1.9, 1.8, 0.35, { fill: d.theme.muted });
    d.text(`F_fundo = ${fmt(F, 3)} N`, M.X0 + M.k * xs[i]!, M.Y0 - 1.1, { size: 11, color: d.theme.accent, weight: "600" });
    d.text(`balança: ${fmt(W, 3)} N`, M.X0 + M.k * xs[i]!, M.Y0 - 2.25, { size: 11, weight: "600" });
    d.text(v.nome, M.X0 + M.k * xs[i]!, M.Y0 - 2.75, { size: 10, color: d.theme.muted });
  });
  d.text(`h = ${fmt(s.hP * 100, 3)} cm em todos   ·   área do fundo = 100 cm²   ·   F = ρ g h A`, 8, 9.5, { size: 12 });
  d.text("setas vermelhas: força da pressão na parede (perpendicular a ela); azul: força no fundo", 8, 9.0, { size: 10, color: d.theme.muted });
}

function renderLudiao(d: Draw, s: VC, p: Params) {
  const M = MAPA[3]!;
  const dp = apertoPa(s, p);
  const X = (x: number) => M.X0 + M.k * x;
  const Y = (y: number) => M.Y0 + M.k * y;
  const larg = 0.05 * (dp > 0 ? 0.94 : 1);
  const topoAgua = LUDIAO.agua;
  d.rect(X(-larg), Y(0), M.k * 2 * larg, M.k * topoAgua, { fill: agua(d) });
  d.polyline([[X(-0.025), Y(0.33)], [X(-0.025), Y(0.31)], [X(-larg), Y(0.29)], [X(-larg), Y(0)], [X(larg), Y(0)], [X(larg), Y(0.29)], [X(0.025), Y(0.31)], [X(0.025), Y(0.33)]], { width: 2.5 });
  d.rect(X(-0.028), Y(0.33), M.k * 0.056, 0.35, { fill: d.theme.series[1] ?? d.theme.accent });
  if (dp > 0) {
    d.arrow(X(-larg) - 1.4, Y(0.15), 1.1, 0, { color: d.theme.positive, width: 3 });
    d.arrow(X(larg) + 1.4, Y(0.15), -1.1, 0, { color: d.theme.positive, width: 3 });
    d.text(`apertando: +${fmt(dp / 1000)} kPa`, X(0), Y(0.36) + 0.6, { size: 12, color: d.theme.positive, weight: "600" });
  } else d.text("pressione (segure) a garrafa", X(0), Y(0.36) + 0.6, { size: 12, color: d.theme.muted });
  // ludião: tubo de vidro com bolha de ar em cima, aberto embaixo
  const yc = topoAgua - s.d;
  const Va = volumeAr(s.d, dp);
  const fr = Va / (LUDIAO.Va0 + LUDIAO.Vg * 0.5);
  const L = LUDIAO.comp;
  d.rect(X(-0.008), Y(yc - L / 2), M.k * 0.016, M.k * L, { stroke: d.theme.text, width: 1.5 });
  d.rect(X(-0.008), Y(yc + L / 2 - L * fr), M.k * 0.016, M.k * L * fr, { fill: d.theme.dark ? "#e6ebf2" : "#ffffff", alpha: 0.9 });
  d.text(`ar: ${fmt(Va * 1e6, 3)} mL`, X(0.012) + 0.3, Y(yc), { size: 11, align: "left" });
  // gráfico: força resultante × profundidade
  const gx0 = 9.2, gx1 = 15.6, gy0 = 1.2, gy1 = 8.6;
  const Fmax = 0.004;
  const gy = (dd: number) => gy1 - (dd / LUDIAO.agua) * (gy1 - gy0);
  const gxF = (F: number) => (gx0 + gx1) / 2 + (F / Fmax) * ((gx1 - gx0) / 2);
  d.line((gx0 + gx1) / 2, gy0, (gx0 + gx1) / 2, gy1, { color: d.theme.muted });
  d.line(gx0, gy1, gx1, gy1, { color: d.theme.muted });
  const pts: [number, number][] = [];
  for (let i = 0; i <= 60; i++) {
    const dd = (i / 60) * LUDIAO.agua;
    pts.push([gxF(clamp(forcaLudiao(dd, dp), -Fmax, Fmax)), gy(dd)]);
  }
  d.polyline(pts, { color: d.theme.accent, width: 2 });
  d.dot(gxF(clamp(forcaLudiao(s.d, dp), -Fmax, Fmax)), gy(s.d), 5, d.theme.positive);
  const de = profEquilibrio(dp);
  if (de > 0 && de < LUDIAO.agua) {
    d.line(gx0, gy(de), gx1, gy(de), { color: d.theme.positive, dash: [5, 4] });
    d.text(`equilíbrio instável: ${fmt(de * 100, 3)} cm`, gx0, gy(de) - 0.3, { size: 10, align: "left", color: d.theme.positive });
  }
  d.text("empuxo − peso (mN) × profundidade", (gx0 + gx1) / 2, gy1 + 0.6, { size: 11, weight: "600" });
  d.text("afunda ←", gx0, gy0 - 0.35, { size: 10, align: "left", color: d.theme.muted });
  d.text("→ sobe", gx1, gy0 - 0.35, { size: 10, align: "right", color: d.theme.muted });
  d.text(`profundidade: ${fmt(s.d * 100, 3)} cm`, 0.3, 0.3, { align: "left", size: 11 });
}

function renderHeron(d: Draw, s: VC, p: Params) {
  const M = MAPA[4]!;
  const X = (x: number) => M.X0 + M.k * x;
  const Y = (y: number) => M.Y0 + M.k * y;
  const W = 0.5;
  const { pg, Q, hJato } = heron(s.zB, s.zC, num(p, "bico", 2));
  // bacia A
  d.rect(X(-W / 2), Y(HERON.zA - 0.08), M.k * W, M.k * 0.08, { fill: agua(d) });
  d.polyline([[X(-W / 2), Y(HERON.zA + 0.03)], [X(-W / 2), Y(HERON.zA - 0.08)], [X(W / 2), Y(HERON.zA - 0.08)], [X(W / 2), Y(HERON.zA + 0.03)]], { width: 2 });
  d.text("A", X(-W / 2) - 0.3, Y(HERON.zA), { size: 13, weight: "700" });
  // câmaras B e C
  for (const [c, z, nome] of [[HERON.B, s.zB, "B"], [HERON.C, s.zC, "C"]] as const) {
    d.rect(X(-0.2), Y(c.y0), M.k * 0.4, M.k * (z - c.y0), { fill: agua(d) });
    d.rect(X(-0.2), Y(z), M.k * 0.4, M.k * (c.y1 - z), { fill: d.theme.series[4] ?? d.theme.accent, alpha: 0.12 + Math.min(0.4, pg / 20000) });
    d.rect(X(-0.2), Y(c.y0), M.k * 0.4, M.k * (c.y1 - c.y0), { stroke: d.theme.text, width: 2 });
    d.text(nome, X(-0.2) - 0.3, Y((c.y0 + c.y1) / 2), { size: 13, weight: "700" });
  }
  // tubos: A → C (água), C → B (ar), B → bico (água)
  d.polyline([[X(-0.12), Y(HERON.zA - 0.08)], [X(-0.12), Y(HERON.B.y1 + 0.03)], [X(-0.32), Y(HERON.B.y1 + 0.03)], [X(-0.32), Y(HERON.C.y0 + 0.03)], [X(-0.2), Y(HERON.C.y0 + 0.03)]], { color: d.theme.series[0] ?? d.theme.accent, width: 4 });
  d.polyline([[X(0.12), Y(HERON.C.y1 - 0.01)], [X(0.32), Y(HERON.C.y1 + 0.02)], [X(0.32), Y(HERON.B.y1 - 0.01)], [X(0.2), Y(HERON.B.y1 - 0.01)]], { color: d.theme.series[4] ?? d.theme.muted, width: 4, alpha: 0.7 });
  d.polyline([[X(0.02), Y(HERON.B.y0 + 0.01)], [X(0.02), Y(HERON.zBico)]], { color: d.theme.series[0] ?? d.theme.accent, width: 3 });
  // jato
  if (hJato > 0) {
    d.line(X(0.02), Y(HERON.zBico), X(0.02), Y(HERON.zBico + hJato), { color: d.theme.series[0] ?? d.theme.accent, width: 3, alpha: 0.8 });
    d.plot((x) => Y(HERON.zBico + hJato) - ((x - X(0.02)) ** 2) * 0.8, X(0.02), X(0.2), { color: d.theme.series[0] ?? d.theme.accent, width: 2, alpha: 0.6 });
    d.plot((x) => Y(HERON.zBico + hJato) - ((x - X(0.02)) ** 2) * 0.8, X(-0.16), X(0.02), { color: d.theme.series[0] ?? d.theme.accent, width: 2, alpha: 0.6 });
  }
  d.line(X(0.42), Y(HERON.zBico), X(0.42), Y(HERON.zBico + hJato), { color: d.theme.positive, width: 1.5 });
  d.text(`jato: ${fmt(hJato * 100, 3)} cm`, X(0.45), Y(HERON.zBico + hJato / 2), { align: "left", size: 11, color: d.theme.positive, weight: "600" });
  const lin = [
    `p_ar (manométrica) = ${fmt(pg / 1000, 3)} kPa`,
    `= ρ g (z_A − z_C) − perda no tubo`,
    `Vazão: ${fmt(Q * 1e6, 3)} mL/s`,
    `Água que já jorrou: ${fmt(s.Vjato * 1000, 3)} L`,
    s.zB <= HERON.B.y0 + 1e-4 || s.zC >= HERON.C.y1 - 1e-4 ? "A fonte parou: vire o aparelho (botão)." : "",
  ];
  lin.forEach((l, i) => d.text(l, 0.2, 9.4 - 0.55 * i, { align: "left", size: 12 }));
}

function renderNivel(d: Draw, s: VC, p: Params) {
  const M = MAPA[5]!;
  const L = 2;
  const th = s.theta;
  const X = (x: number) => M.X0 + M.k * x;
  const Y = (y: number) => M.Y0 + M.k * y;
  const xe = L * Math.cos(th);
  const ye = L * Math.sin(th);
  d.polyline([[X(0), Y(0)], [X(xe), Y(ye)], [X(xe) + 0.25 * Math.sin(th), Y(ye) - 0.25 * Math.cos(th)], [X(0) + 0.25 * Math.sin(th), Y(0) - 0.25 * Math.cos(th)]], { close: true, fill: d.theme.dark ? "#8a6a45" : "#c99d63", color: d.theme.text, width: 1 });
  d.circle(X(xe), Y(ye), 0.18, { fill: d.theme.accent });
  d.text("arraste", X(xe) + 0.3, Y(ye) + 0.3, { size: 10, color: d.theme.accent, align: "left" });
  // mangueira de nível: tubos verticais nas duas pontas; a água fica no mesmo nível
  const nivelAgua = Math.max(0, ye) + 0.35;
  for (const [x, y] of [[0, 0], [xe, ye]] as const) {
    d.rect(X(x) - 0.12, Y(y), 0.24, M.k * 0.6, { stroke: d.theme.text, width: 1 });
    d.rect(X(x) - 0.1, Y(y), 0.2, Y(nivelAgua) - Y(y), { fill: agua(d) });
    d.text(`${fmt((nivelAgua - y) * 1000, 4)} mm`, X(x), Y(y) + M.k * 0.6 + 0.3, { size: 10 });
  }
  d.polyline([[X(0), Y(0)], [X(0), Y(-0.35)], [X(xe), Y(-0.35)], [X(xe), Y(ye)]], { color: d.theme.series[0] ?? d.theme.accent, width: 2, alpha: 0.6 });
  d.line(X(-0.2), Y(nivelAgua), X(xe + 0.2), Y(nivelAgua), { color: d.theme.positive, dash: [5, 4] });
  d.text("mangueira de nível: vasos comunicantes", X(L / 2), Y(-0.55), { size: 11, color: d.theme.muted });
  // nível de bolha ampliado
  const R = num(p, "Rbolha", 5);
  const sB = bolha(R, th);
  const cx = 8, cy = 8.3, meio = 4;
  d.rect(cx - meio - 0.2, cy - 0.45, 2 * meio + 0.4, 0.9, { fill: d.theme.dark ? "#4b5d2e" : "#e2f0a8", stroke: d.theme.text, width: 1.5 });
  for (const m of [-0.6, 0.6]) d.line(cx + m, cy - 0.45, cx + m, cy + 0.45, { color: d.theme.text, width: 1 });
  const escala = 40; // 1 mm do tubo = 0,04 unidades do palco
  const bx = clamp(cx + sB * 1000 * (escala / 1000), cx - meio + 0.5, cx + meio - 0.5);
  d.box(bx, cy, 1.0, 0.5, 0, { fill: d.theme.dark ? "#f0f4d0" : "#ffffff", stroke: d.theme.muted, width: 1 });
  d.text(`bolha deslocada ${fmt(sB * 1000, 3)} mm (s = Rθ, R = ${fmt(R)} m)  ·  ampliado`, cx, cy + 0.85, { size: 11 });
  const lin = [
    `Inclinação: θ = ${fmt((th * 180) / Math.PI, 3)}° = ${fmt(th * 1000, 3)} mm/m`,
    `Desnível entre as pontas: L sen θ = ${fmt(L * Math.sin(th) * 1000, 4)} mm`,
  ];
  lin.forEach((l, i) => d.text(l, 0.3, 1.2 - 0.55 * i, { align: "left", size: 12 }));
}

function renderBomba(d: Draw, s: VC, p: Params) {
  const M = MAPA[6]!;
  const X = (x: number) => M.X0 + M.k * x;
  const Y = (y: number) => M.Y0 + M.k * y;
  const H = num(p, "Hb", 8);
  const succao = Math.round(num(p, "bomba")) === 0;
  const hmax = hMaxSuccao(p0(p));
  const { Q, F, pTopo } = bombaAgora(s, p);
  // poço
  d.rect(X(-3), Y(-1.6), M.k * 6, M.k * 1.6, { fill: agua(d) });
  d.line(X(-3), Y(0), X(3), Y(0), { color: d.theme.text });
  const pip = 0.35;
  // tubo
  d.rect(X(-pip / 2), Y(-1), M.k * pip, Y(H) - Y(-1), { stroke: d.theme.text, width: 2 });
  d.rect(X(-pip / 2) + 0.03, Y(-1), M.k * pip - 0.06, Math.max(0, Y(s.zc) - Y(-1)), { fill: agua(d) });
  if (succao && s.zc >= hmax - 1e-6 && H > hmax) {
    d.rect(X(-pip / 2) + 0.03, Y(hmax), M.k * pip - 0.06, Y(H) - Y(hmax), { fill: d.theme.muted, alpha: 0.15 });
    d.text("vácuo (vapor d'água)", X(pip) + 0.2, (Y(hmax) + Y(H)) / 2, { align: "left", size: 11, color: d.theme.positive });
  }
  // cilindro e pistão
  const { y: yp } = pistao(s.ph, num(p, "freq", 0.5));
  const cy0 = Y(H), cw = 1.4, ch = 1.6;
  d.rect(X(0) - cw / 2, cy0, cw, ch, { stroke: d.theme.text, width: 2 });
  const ypw = cy0 + 0.1 + (yp / BOMBA.curso) * (ch - 0.5);
  if (s.zc >= H - 1e-9) d.rect(X(0) - cw / 2 + 0.05, cy0, cw - 0.1, ypw - cy0, { fill: agua(d) });
  d.rect(X(0) - cw / 2 + 0.05, ypw, cw - 0.1, 0.25, { fill: d.theme.muted });
  d.line(X(0), ypw + 0.25, X(0), cy0 + ch + 0.8, { width: 3 });
  // bica
  d.line(X(0) + cw / 2, cy0 + 0.4, X(0) + cw / 2 + 0.9, cy0 + 0.4, { width: 3 });
  if (Q > 0) d.line(X(0) + cw / 2 + 0.9, cy0 + 0.4, X(0) + cw / 2 + 1.1, cy0 - 0.6, { color: d.theme.series[0] ?? d.theme.accent, width: 3 });
  // cotas
  d.line(X(-4.5), Y(0), X(-4.5), Y(H), { color: d.theme.muted });
  d.text(`H = ${fmt(H)} m`, X(-4.5) - 0.2, Y(H / 2), { align: "right", size: 11 });
  if (succao) {
    d.line(X(-3.2), Y(hmax), X(4), Y(hmax), { color: d.theme.positive, dash: [6, 4] });
    d.text(`altura máxima de sucção: ${fmt(hmax, 3)} m`, X(4), Y(hmax) + 0.25, { size: 11, color: d.theme.positive, align: "right" });
  }
  const lin = [
    succao ? "Bomba de sucção (aspirante)" : "Bomba de compressão (premente, Ctesíbio)",
    `Coluna de água: ${fmt(s.zc, 3)} m`,
    succao ? `Pressão no topo da coluna: ${fmt(pTopo / 1000, 3)} kPa` : `Pressão sob o pistão: ${fmt(pTopo / 1000, 3)} kPa`,
    `Força no pistão (A = 50 cm²): ${fmt(F, 3)} N`,
    `Vazão: ${fmt(Q, 2)} L/s   ·   bombeado: ${fmt(s.Vbomb * 1000, 3)} L`,
  ];
  lin.forEach((l, i) => d.text(l, 9.2, 9.4 - 0.55 * i, { align: "left", size: 12, weight: i === 0 ? "600" : "400" }));
}

function renderBarril(d: Draw, s: VC, p: Params) {
  const k = 0.75;
  const bx = 5, by = 0.6, bw = 3.2, bh = 2.6;
  const F = forcaTampa(s.hBar);
  const d_mm = num(p, "dTubo", 10);
  d.rect(bx - bw / 2, by, bw, bh, { fill: agua(d) });
  d.rect(bx - bw / 2, by, bw, bh, { stroke: d.theme.dark ? "#c9a46a" : "#7a5230", width: 4 });
  for (const f of [0.25, 0.75]) d.line(bx - bw / 2, by + bh * f, bx + bw / 2, by + bh * f, { color: d.theme.muted, width: 3 });
  const ty = by + bh;
  d.rect(bx - 0.07, ty, 0.14, k * 11, { stroke: d.theme.text, width: 1 });
  d.rect(bx - 0.05, ty, 0.1, k * s.hBar, { fill: d.theme.series[0] ?? d.theme.accent });
  d.text("(barril fora de escala)", bx, by - 0.3, { size: 10, color: d.theme.muted });
  for (let h = 0; h <= 10; h += 2) {
    d.line(bx + 0.1, ty + k * h, bx + 0.3, ty + k * h, { color: d.theme.muted });
    d.text(`${h} m`, bx + 0.35, ty + k * h, { size: 10, align: "left", color: d.theme.muted });
  }
  // setas de força na tampa
  const n = 5;
  for (let i = 0; i < n; i++) d.arrow(bx - bw / 2 + ((i + 0.5) * bw) / n, ty - 0.1, 0, Math.min(1.2, F / 20000), { color: d.theme.positive, width: 2 });
  if (s.estourou) {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * 2 * Math.PI;
      d.arrow(bx + Math.cos(a) * 1.8, by + bh / 2 + Math.sin(a) * 1.4, Math.cos(a) * 0.9, Math.sin(a) * 0.9, { color: d.theme.series[0] ?? d.theme.accent, width: 3 });
    }
    d.text("ESTOUROU!", bx, by + bh / 2, { size: 18, weight: "800", color: d.theme.positive });
  }
  const lin = [
    `Altura da água no tubo: h = ${fmt(s.hBar, 3)} m`,
    `Pressão na tampa: ρ g h = ${fmt((RHO * G * s.hBar) / 1000, 3)} kPa`,
    `Força na tampa (A = ${fmt(BARRIL.area)} m²): ${fmt(F / 1000, 3)} kN`,
    `Massa de água no tubo (d = ${fmt(d_mm)} mm): ${fmt(massaTubo(s.hBar, d_mm) * 1000, 3)} g`,
    `A tampa resiste até ${fmt(num(p, "Fmax", 20))} kN`,
  ];
  lin.forEach((l, i) => d.text(l, 8.6, 8.6 - 0.6 * i, { align: "left", size: 12 }));
  d.text("Poucos gramas de água num tubo fino e alto bastam: a força depende de h, não da quantidade.", 8, 9.6, { size: 11, color: d.theme.muted });
}

// ------------------------------------------------------------------ ponteiro

function dentroVaso(p: Params, pt: { x: number; y: number }): number {
  const M = MAPA[0]!;
  const x = (pt.x - M.X0) / M.k;
  const y = (pt.y - M.Y0) / M.k;
  if (y < 0 || y > H_VASO) return -1;
  return VASOS.findIndex((v, i) => Math.abs(x - X_VASOS[i]! - v.dx(y)) <= v.w(y) / 2 + 0.01);
}

const pertoSonda = (s: VC, pt: { x: number; y: number }) => Math.hypot(pt.x - s.sonda[0], pt.y - s.sonda[1]) < 0.45 || (Math.abs(pt.x - s.sonda[0]) < 1.3 && pt.y > s.sonda[1] + 0.8 && pt.y < s.sonda[1] + 1.7);

function pontaTabua(s: VC) {
  const M = MAPA[5]!;
  return [M.X0 + M.k * 2 * Math.cos(s.theta), M.Y0 + M.k * 2 * Math.sin(s.theta)] as const;
}

export const vasosComunicantes = defineSim<VC>({
  id: "vasos-comunicantes",
  title: "Vasos comunicantes, paradoxo hidrostático, ludião e bombas",
  course: "FG II",
  topic: "Hidrostática",
  priority: "P2",
  summary:
    "Oito aparatos da hidrostática com medidas: vasos comunicantes de formas diferentes e tubo em U com líquidos imiscíveis (sonda de pressão arrastável), paradoxo hidrostático com balanças, ludião (Boyle), fonte de Heron, nível de bolha e de mangueira, bombas de sucção e de compressão e o barril de Pascal.",
  equations: [
    String.raw`p = p_0 + \rho g h \qquad \rho_A h_A = \rho_B h_B \qquad F_\text{fundo} = \rho g h A`,
    String.raw`p V = \text{const (Boyle)} \qquad E = \rho g V_\text{deslocado} \qquad h_\text{máx} = \frac{p_0 - p_v}{\rho g}`,
    String.raw`h_\text{jato} \approx (z_A - z_C) - (z_\text{bico} - z_B) \qquad s = R\theta`,
  ],
  liveEquations(s, p) {
    switch (modo(p)) {
      case 0: {
        const h = niveis(s);
        return [String.raw`h_1 = ${texNum(h[0]! * 100)}\ \text{cm},\ h_2 = ${texNum(h[1]! * 100)}\ \text{cm},\ h_3 = ${texNum(h[2]! * 100)}\ \text{cm},\ h_4 = ${texNum(h[3]! * 100)}\ \text{cm}`];
      }
      case 1: {
        const { rhoA, rhoB } = liqU(p);
        const hA = 2 * U.hA - 2 * s.zi;
        return [String.raw`\rho_B h_B = ${texNum(rhoB)} \times ${texNum(s.LB)} = ${texNum(rhoB * s.LB)} \quad \rho_A h_A = ${texNum(rhoA)} \times ${texNum(hA)} = ${texNum(rhoA * hA)}\ \text{kg/m}^2`];
      }
      case 2:
        return [String.raw`F_\text{fundo} = \rho g h A = 1000 \times 9{,}81 \times ${texNum(s.hP)} \times 0{,}01 = ${texNum(forcaFundo(s.hP))}\ \text{N}`];
      case 3: {
        const dp = apertoPa(s, p);
        return [String.raw`V_\text{ar} = \frac{p_0 V_0}{p_0 + \Delta p + \rho g d} = ${texNum(volumeAr(s.d, dp) * 1e6)}\ \text{mL} \qquad E - P = ${texNum(forcaLudiao(s.d, dp) * 1000)}\ \text{mN}`];
      }
      case 4: {
        const r = heron(s.zB, s.zC, num(p, "bico", 2));
        return [String.raw`p_\text{ar} = ${texNum(r.pg / 1000)}\ \text{kPa} \qquad h_\text{jato} = \frac{p_\text{ar}}{\rho g} - (z_\text{bico} - z_B) = ${texNum(r.hJato * 100)}\ \text{cm}`];
      }
      case 5:
        return [String.raw`s = R\theta = ${texNum(num(p, "Rbolha", 5))}\ \text{m} \times ${texNum(s.theta)} = ${texNum(bolha(num(p, "Rbolha", 5), s.theta) * 1000)}\ \text{mm}`];
      case 6:
        return [String.raw`h_\text{máx} = \frac{${texNum(p0(p) / 1000)}\ \text{kPa} - p_v}{\rho g} = ${texNum(hMaxSuccao(p0(p)))}\ \text{m}`];
      default:
        return [String.raw`F = \rho g h A = 1000 \times 9{,}81 \times ${texNum(s.hBar)} \times ${texNum(BARRIL.area)} = ${texNum(forcaTampa(s.hBar) / 1000)}\ \text{kN}`];
    }
  },

  params: [
    {
      key: "modo",
      label: "Aparato",
      unit: "",
      min: 0,
      max: 7,
      step: 1,
      default: 0,
      options: [
        { value: 0, label: "Vasos comunicantes" },
        { value: 1, label: "Tubo em U com dois líquidos" },
        { value: 2, label: "Paradoxo hidrostático" },
        { value: 3, label: "Ludião (mergulhador de Descartes)" },
        { value: 4, label: "Fonte de Heron" },
        { value: 5, label: "Nível de bolha e de mangueira" },
        { value: 6, label: "Bombas de sucção e de compressão" },
        { value: 7, label: "Barril de Pascal" },
      ],
    },
    { key: "volume", label: "Volume de água", unit: "L", min: 0.2, max: 3, step: 0.1, default: 1.5 },
    {
      key: "vasoInicial",
      label: "Água despejada em",
      unit: "",
      min: 0,
      max: 4,
      step: 1,
      default: 0,
      options: [...VASOS.map((v, i) => ({ value: i, label: `vaso ${i + 1} (${v.nome})` })), { value: 4, label: "já em equilíbrio" }],
    },
    { key: "liquidos", label: "Líquidos do tubo em U", unit: "", min: 0, max: 3, step: 1, default: 0, options: LIQUIDOS_U.map((l) => ({ value: l.value, label: l.label })) },
    { key: "LB", label: "Coluna do líquido B (despejar)", unit: "m", min: 0, max: 0.3, step: 0.005, default: 0.15, live: true },
    { key: "hP", label: "Altura da água (paradoxo)", unit: "m", min: 0, max: 0.4, step: 0.01, default: 0.3, live: true },
    { key: "aperto", label: "Pressão extra ao apertar a garrafa", unit: "kPa", min: 0, max: 10, step: 0.1, default: 4, live: true },
    {
      key: "travar",
      label: "Aperto",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 0,
      live: true,
      options: [
        { value: 0, label: "Só enquanto segura a garrafa" },
        { value: 1, label: "Mantido" },
      ],
    },
    { key: "bico", label: "Diâmetro do bico (Heron)", unit: "mm", min: 1, max: 4, step: 0.1, default: 2 },
    { key: "inclinacao", label: "Inclinação inicial da tábua", unit: "°", min: -5, max: 5, step: 0.05, default: 1 },
    { key: "Rbolha", label: "Raio de curvatura do tubo da bolha", unit: "m", min: 0.5, max: 20, step: 0.5, default: 5, live: true },
    {
      key: "bomba",
      label: "Bomba",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 0,
      options: [
        { value: 0, label: "Sucção (aspirante)" },
        { value: 1, label: "Compressão (premente)" },
      ],
    },
    { key: "Hb", label: "Altura até a saída da bomba", unit: "m", min: 1, max: 15, step: 0.5, default: 8 },
    { key: "p0", label: "Pressão atmosférica", unit: "kPa", min: 0.6, max: 101.325, step: 0.1, default: 101.325, options: ATMOSFERAS },
    { key: "freq", label: "Frequência do pistão", unit: "Hz", min: 0.2, max: 2, step: 0.1, default: 1, live: true },
    { key: "hTubo", label: "Água no tubo do barril", unit: "m", min: 0, max: 10, step: 0.1, default: 6, live: true },
    { key: "dTubo", label: "Diâmetro do tubo do barril", unit: "mm", min: 5, max: 30, step: 1, default: 10, live: true },
    { key: "Fmax", label: "Resistência da tampa", unit: "kN", min: 5, max: 30, step: 1, default: 20 },
  ],

  observables: [
    {
      key: "nivel",
      label: "Nível (vaso 1 / braço direito / água / profundidade / jato / coluna / tubo)",
      unit: "cm",
      value: (s, p) => {
        switch (modo(p)) {
          case 0:
            return nivelVaso(0, s.V[0]!) * 100;
          case 1:
            return (2 * U.hA - s.zi) * 100;
          case 2:
            return s.hP * 100;
          case 3:
            return s.d * 100;
          case 4:
            return heron(s.zB, s.zC, num(p, "bico", 2)).hJato * 100;
          case 6:
            return s.zc * 100;
          case 7:
            return s.hBar * 100;
          default:
            return bolha(num(p, "Rbolha", 5), s.theta) * 100;
        }
      },
    },
    {
      key: "dh",
      label: "Diferença de níveis",
      unit: "cm",
      value: (s, p) => {
        if (modo(p) === 0) {
          const h = niveis(s);
          return (Math.max(...h) - Math.min(...h)) * 100;
        }
        if (modo(p) === 1) return (2 * s.zi + s.LB - 2 * U.hA) * 100;
        return 0;
      },
    },
    { key: "pSonda", label: "Pressão na sonda", unit: "kPa", value: (s, p) => (Number.isFinite(pressaoSonda(s, p)) ? pressaoSonda(s, p) / 1000 : 0) },
    { key: "rhoB", label: "Densidade medida do líquido B", unit: "kg/m³", value: (s, p) => (modo(p) === 1 && s.LB > 1e-3 ? (liqU(p).rhoA * (2 * U.hA - 2 * s.zi)) / s.LB : 0) },
    { key: "Ffundo", label: "Força no fundo / na tampa", unit: "N", value: (s, p) => (modo(p) === 7 ? forcaTampa(s.hBar) : forcaFundo(s.hP)) },
    { key: "P1", label: "Peso da água: cilindro", unit: "N", value: (s) => pesoAgua(0, s.hP) },
    { key: "P2", label: "Peso da água: alargado", unit: "N", value: (s) => pesoAgua(1, s.hP) },
    { key: "P3", label: "Peso da água: gargalo", unit: "N", value: (s) => pesoAgua(2, s.hP) },
    { key: "P4", label: "Peso da água: inclinado", unit: "N", value: (s) => pesoAgua(3, s.hP) },
    { key: "Var", label: "Volume de ar no ludião", unit: "mL", value: (s, p) => volumeAr(s.d, apertoPa(s, p)) * 1e6 },
    { key: "Fres", label: "Empuxo − peso do ludião", unit: "mN", value: (s, p) => forcaLudiao(s.d, apertoPa(s, p)) * 1000 },
    { key: "pAr", label: "Pressão manométrica do ar (Heron)", unit: "kPa", value: (s, p) => heron(s.zB, s.zC, num(p, "bico", 2)).pg / 1000 },
    { key: "theta", label: "Inclinação da tábua", unit: "°", value: (s) => (s.theta * 180) / Math.PI },
    { key: "desnivel", label: "Desnível medido com a mangueira", unit: "mm", value: (s) => 2 * Math.sin(s.theta) * 1000 },
    { key: "hmax", label: "Altura máxima de sucção", unit: "m", value: (_s, p) => hMaxSuccao(p0(p)) },
    { key: "Vbomb", label: "Volume bombeado", unit: "L", value: (s) => s.Vbomb * 1000 },
    { key: "Fpistao", label: "Força no pistão", unit: "N", value: (s, p) => bombaAgora(s, p).F },
  ],
  chart: { x: "t", y: "nivel" },

  scenarios: [
    {
      id: "vasos",
      label: "Vasos comunicantes",
      params: { modo: 0, volume: 1.5, vasoInicial: 1 },
      guide: `### Formas diferentes, mesmo nível
1. Toda a água foi despejada no funil. Antes de rodar, preveja onde cada nível vai parar.
2. Rode: a água passa pelo tubo de baixo até os quatro níveis ficarem iguais. Clique dentro de um vaso para despejar mais água nele.
3. Arraste a sonda para pontos à mesma altura em vasos diferentes: a pressão é a mesma, $p = p_0 + \\rho g h$, não importa a forma nem a largura.`,
      predict: [
        {
          question: "No equilíbrio, comparado com o vaso cilíndrico, o nível no tubo inclinado fica:",
          options: ["mais alto, porque o tubo é estreito", "mais baixo, porque o tubo é inclinado", "na mesma altura"],
          answer: 2,
          explanation: "A pressão no fundo depende só da altura da coluna: se os níveis fossem diferentes haveria diferença de pressão no tubo de ligação e a água continuaria a escoar.",
        },
      ],
    },
    {
      id: "tubo-u",
      label: "Tubo em U: medir a densidade",
      params: { modo: 1, liquidos: 0, LB: 0.15 },
      guide: `### Líquidos imiscíveis
1. Rode: o óleo é despejado no braço esquerdo e empurra a água para o direito.
2. Meça $h_B$ (óleo acima da interface) e $h_A$ (água acima do nível da interface, no outro braço). Calcule $\\rho_B = \\rho_A h_A / h_B$.
3. Use a sonda: na linha tracejada as pressões dos dois braços são iguais; acima dela, no mesmo nível, não (líquidos diferentes).
4. Troque para mercúrio + água: o desnível fica enorme.`,
      predict: [
        {
          question: "Despejando óleo num braço de um tubo em U com água, a superfície livre mais alta fica:",
          options: ["no braço com óleo", "no braço só com água", "as duas na mesma altura"],
          answer: 0,
          explanation: "O óleo é menos denso: precisa de uma coluna mais alta ($h_B > h_A$) para fazer a mesma pressão no nível da interface.",
        },
      ],
    },
    {
      id: "paradoxo",
      label: "Paradoxo hidrostático",
      params: { modo: 2, hP: 0.3 },
      guide: `### Mesma força no fundo, pesos diferentes
1. Os quatro vasos têm a mesma área de fundo (100 cm²) e a mesma altura de água. Compare a força no fundo e a leitura da balança.
2. No vaso alargado, as paredes inclinadas recebem forças com componente **para baixo**; no gargalo, o "ombro" empurra a água para baixo (e a água empurra o vaso para cima).
3. A balança mede o peso total; o fundo sente apenas $\\rho g h A$.`,
      predict: [
        {
          question: "Com a mesma altura de água e mesma área de fundo, a força da água no fundo é maior em qual vaso?",
          options: ["no alargado (mais água)", "no gargalo", "igual em todos"],
          answer: 2,
          explanation: "$F = pA = \\rho g h A$ só depende de $h$ e $A$. É o paradoxo hidrostático: o peso da água é diferente, mas a força no fundo não.",
        },
      ],
    },
    {
      id: "ludiao",
      label: "Ludião",
      params: { modo: 3, aperto: 4, travar: 0 },
      guide: `### Mergulhador de Descartes
1. Rode e segure o botão do mouse sobre a garrafa: o ar dentro do ludião é comprimido ($pV$ = const), o empuxo diminui e ele afunda.
2. Solte: o ar se expande e ele volta a subir.
3. No gráfico à direita, o ponto mostra empuxo − peso. Há uma profundidade de **equilíbrio instável**: abaixo dela o ludião afunda sozinho, mesmo sem apertar.
4. Diminua o aperto até ~1 kPa e mantenha (opção "Mantido"): veja o ludião parado na superfície ou no fundo, dependendo de onde estava.`,
    },
    {
      id: "heron",
      label: "Fonte de Heron",
      params: { modo: 4, bico: 2 },
      guide: `### A fonte "perpétua"
1. A água cai de A para C e comprime o ar, que empurra a água de B para cima pelo bico.
2. A pressão do ar vale cerca de $\\rho g (z_A - z_C)$; o jato sobe até onde essa pressão consegue: $h \\approx (z_A - z_C) - (z_\\text{bico} - z_B)$.
3. Acompanhe a altura do jato diminuindo à medida que B esvazia e C enche. De onde vem a energia? Por que a fonte não é um moto-perpétuo?`,
    },
    {
      id: "nivel",
      label: "Nível de bolha e de mangueira",
      params: { modo: 5, inclinacao: 0.5, Rbolha: 5 },
      guide: `### Nivelando uma tábua
1. Arraste a ponta direita da tábua. Na mangueira (vasos comunicantes), a água fica no mesmo nível nas duas pontas: a diferença das marcas é o desnível $L \\sin\\theta$.
2. No nível de bolha, a bolha sobe para o ponto mais alto do tubo curvo: desloca $s = R\\theta$.
3. Aumente $R$: o nível fica mais sensível. Qual a menor inclinação que você consegue perceber com $R = 20$ m?`,
    },
    {
      id: "succao",
      label: "Bomba de sucção: o limite de 10 m",
      params: { modo: 6, bomba: 0, Hb: 12, p0: 101.325, freq: 1 },
      guide: `### Por que não dá para puxar água de um poço de 12 m?
1. Rode. O pistão sobe e a pressão atmosférica empurra a água para dentro do tubo.
2. A coluna para em $h_\\text{máx} = (p_0 - p_v)/\\rho g \\approx 10$ m: acima dela só há vapor d'água. A bomba não "puxa": quem empurra é o ar.
3. Diminua $H$ para 8 m e veja a água sair. Troque a atmosfera para 3000 m de altitude e para Marte.
4. Troque para a bomba de **compressão**: ela leva água a qualquer altura, desde que se faça a força $\\rho g H A$ no pistão.`,
      predict: [
        {
          question: "Uma bomba de sucção no topo de um poço de 12 m, ao nível do mar:",
          options: ["tira água, mas devagar", "não tira água: a coluna para em ~10 m", "tira água só se o pistão for rápido"],
          answer: 1,
          explanation: "A pressão atmosférica sustenta no máximo $p_0/(\\rho g) \\approx 10{,}3$ m de água (um pouco menos por causa da pressão de vapor). Por isso bombas de poço profundo ficam lá embaixo e empurram.",
        },
      ],
    },
    {
      id: "barril",
      label: "Barril de Pascal",
      params: { modo: 7, hTubo: 9, dTubo: 10, Fmax: 20 },
      guide: `### Alguns copos d'água estouram um barril
1. Rode: a água sobe no tubo fino. Acompanhe a força na tampa e a massa de água no tubo.
2. Quando $\\rho g h A$ passa da resistência da tampa, o barril estoura, com menos de 1 kg de água no tubo.
3. Mude o diâmetro do tubo: a massa muda, a força não.`,
    },
  ],

  exercises: [
    {
      id: "tubo-u",
      prompt: "Num tubo em U com água (1000 kg/m³), despejam-se {LBcm} cm de um óleo de densidade {rhoB} kg/m³ num dos braços. Qual o desnível entre as duas superfícies livres?",
      vary: { LBcm: [5, 30, 1], rhoB: [700, 950, 0] },
      fixed: { modo: 1 },
      answer: { label: "Δh", unit: "cm", compute: (p) => num(p, "LBcm") * (1 - num(p, "rhoB") / 1000) },
    },
    {
      id: "barril",
      prompt: "Um tubo fino sobre um barril cheio tem {hTubo} m de água. Qual a força da água sobre a tampa do barril, de área 0,25 m²? (g = 9,81 m/s²)",
      vary: { hTubo: [2, 10, 1] },
      fixed: { modo: 7 },
      answer: { label: "F", unit: "kN", compute: (p) => forcaTampa(num(p, "hTubo")) / 1000 },
    },
    {
      id: "succao",
      prompt: "Qual a altura máxima a que uma bomba de sucção eleva água onde a pressão atmosférica é {pa} kPa? Despreze a pressão de vapor. (ρ = 1000 kg/m³, g = 9,81 m/s²)",
      vary: { pa: [60, 101, 0] },
      fixed: { modo: 6 },
      answer: { label: "h_máx", unit: "m", compute: (p) => (num(p, "pa") * 1000) / (RHO * G) },
    },
  ],

  init,
  step,
  dt: 0.01,
  sampleEvery: 10,

  pointer: {
    down(s, p, pt) {
      const m = modo(p);
      if ((m === 0 || m === 1) && pertoSonda(s, pt)) return { ...s, arr: 1 };
      if (m === 0) {
        const i = dentroVaso(p, pt);
        if (i >= 0) return { ...s, V: s.V.map((v, j) => (j === i ? v + 1e-4 : v)) };
      }
      if (m === 3) {
        const M = MAPA[3]!;
        if (Math.abs(pt.x - M.X0) < M.k * 0.08 && pt.y > M.Y0 - 0.5 && pt.y < M.Y0 + M.k * 0.36) return { ...s, apertando: true };
      }
      if (m === 5) {
        const [x, y] = pontaTabua(s);
        if (Math.hypot(pt.x - x, pt.y - y) < 0.8) return { ...s, arr: 2 };
      }
      return undefined;
    },
    move(s, _p, pt, dragging) {
      if (!dragging) return undefined;
      if (s.arr === 1) return { ...s, sonda: [clamp(pt.x, 0.5, 15.5), clamp(pt.y, 0.2, 8)] };
      if (s.arr === 2) {
        const M = MAPA[5]!;
        const th = Math.atan2(pt.y - M.Y0, pt.x - M.X0);
        return { ...s, theta: clamp(th, (-5 * Math.PI) / 180, (5 * Math.PI) / 180) };
      }
      return undefined;
    },
    up: (s) => (s.arr || s.apertando ? { ...s, arr: 0, apertando: false } : undefined),
    cursor(s, p, pt) {
      const m = modo(p);
      if ((m === 0 || m === 1) && pertoSonda(s, pt)) return "grab";
      if (m === 0 && dentroVaso(p, pt) >= 0) return "copy";
      if (m === 3) return "pointer";
      if (m === 5) {
        const [x, y] = pontaTabua(s);
        if (Math.hypot(pt.x - x, pt.y - y) < 0.8) return "ns-resize";
      }
      return undefined;
    },
  },
  actions: [
    { id: "virar", label: "Heron: virar o aparelho (recomeçar)", run: (s) => ({ ...s, zB: HERON.B.y1 - 0.005, zC: HERON.C.y0 + 0.02 }) },
    { id: "nivelar", label: "Nível: zerar a inclinação", run: (s) => ({ ...s, theta: 0 }) },
    { id: "despejar", label: "Vasos: despejar 0,1 L no vaso 1", run: (s) => ({ ...s, V: s.V.map((v, i) => (i === 0 ? v + 1e-4 : v)) }) },
    { id: "consertar", label: "Barril: trocar a tampa", run: (s) => ({ ...s, estourou: false, hBar: 0 }) },
  ],

  viewport: () => ({ xMin: 0, xMax: 16, yMin: -0.3, yMax: 10 }),

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const { state: s, params: p } = frame;
    [renderVasos, renderU, renderParadoxo, renderLudiao, renderHeron, renderNivel, renderBomba, renderBarril][modo(p)]?.(d, s, p);
  },
});


export default vasosComunicantes;
