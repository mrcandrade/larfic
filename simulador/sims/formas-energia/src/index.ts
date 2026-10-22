import { clamp, defineSim, draw, formatBR, num, texNum, type Draw, type Params, type Theme } from "@fisilab/core";
import {
  BEQUER,
  BULBOS,
  CHALEIRA,
  C_AGUA,
  F,
  FONTES,
  FORMAS,
  G,
  L_V,
  MATERIAIS,
  PAINEL,
  QUEDA,
  RHO_AGUA,
  T_AMB,
  USUARIOS,
  capacidade,
  energiaBlocos,
  fluxos,
  fonte,
  modo,
  passoBlocos,
  potBico,
  potLampadas,
  taxasBlocos,
  usuario,
  type Bloco,
  type FE,
  type Pacote,
} from "./physics.ts";

export * from "./physics.ts";

// ------------------------------------------------------------------ geometria

const VP = { xMin: 0, xMax: 16, yMin: -3.6, yMax: 9 };
const SRC = { x: 2.2, y: 3 };
const CNV = { x: 7.6, y: 2.6 };
const USR = { x: 13, y: 3 };
const TOPO = 8.2;
/** Tempo que um pacote leva para percorrer a rota (s). */
const VIAGEM = 1.4;

const BICOS = [1.6, 4.0, 6.4, 8.8, 11.6, 14.2];
const BASE = 1.2;
const SOLIDO = 1.1;
const BEQ = { w: 1.8, h: 2.3 };

type Pt = [number, number];
interface Rota {
  pts: Pt[];
  /** Potência transportada (W); o sinal dá o sentido. */
  P: number;
  k: number;
}

/** Retângulo ocupado por um objeto do modo blocos (canto inferior esquerdo, largura, altura). */
export function caixa(bs: Bloco[], i: number): { x: number; y: number; w: number; h: number } {
  const b = bs[i]!;
  const liq = MATERIAIS[b.mat]!.liquido;
  const w = liq ? BEQ.w : SOLIDO;
  const h = liq ? BEQ.h : SOLIDO;
  if (Number.isFinite(b.dx)) return { x: b.dx - w / 2, y: b.dy - h / 2, w, h };
  if (b.host >= 0) {
    const hb = caixa(bs, b.host);
    const hostLiq = MATERIAIS[bs[b.host]!.mat]!.liquido;
    return hostLiq ? { x: hb.x + (hb.w - w) / 2, y: hb.y + 0.12, w, h } : { x: hb.x + (hb.w - w) / 2, y: hb.y + hb.h, w, h };
  }
  return { x: BICOS[b.slot]! - w / 2, y: BASE, w, h };
}

const centro = (c: { x: number; y: number; w: number; h: number }): Pt => [c.x + c.w / 2, c.y + c.h / 2];

function rotas(s: FE, p: Params): (Rota | null)[] {
  const m = modo(p);
  if (m === 0) {
    const fl = fluxos(s, p);
    const f = fonte(p);
    const u = USUARIOS[usuario(p)]!;
    const src: Pt[] =
      f === 0
        ? [[1.9, 7.2], [CNV.x - 0.3, CNV.y + 1.2]]
        : f === 1
          ? [[2.6, 6.2], [4.8, 6.2], [6.6, 4.6], [CNV.x - 0.6, CNV.y + 0.5]]
          : f === 2
            ? [[SRC.x + 0.8, SRC.y - 0.8], [CNV.x - 0.9, CNV.y]]
            : [[SRC.x + 1.2, SRC.y + 0.7], [CNV.x - 0.8, CNV.y + 0.5]];
    const util: Pt[] = u.forma === "luz" ? [[USR.x, USR.y + 1.3], [15.6, 6.4]] : u.forma === "mecanica" ? [[USR.x + 0.8, USR.y + 0.6], [15.8, USR.y + 0.6]] : [[USR.x, USR.y + 0.4], [USR.x, USR.y - 0.6]];
    const fu = u.forma === "luz" ? F.luz : u.forma === "mecanica" ? F.mecanica : F.termica;
    return [
      { pts: src, P: fl.Pconv + fl.Parm, k: fl.formaIn === F.quimica ? (f === 3 ? F.termica : F.mecanica) : fl.formaIn },
      { pts: [[SRC.x, SRC.y + 1.6], [SRC.x - 0.4, TOPO]], P: fl.PperdaFonte, k: F.termica },
      { pts: [[CNV.x + 0.8, CNV.y], [10.5, CNV.y], [11.2, USR.y - 0.6], [USR.x - 0.3, USR.y - 0.6]], P: fl.Pel, k: F.eletrica },
      { pts: [[CNV.x, CNV.y + 1.2], [CNV.x + 0.4, TOPO]], P: fl.PperdaConv, k: F.termica },
      { pts: util, P: fl.Put, k: fu },
      { pts: [[USR.x - 0.2, USR.y + 1.6], [USR.x - 0.8, TOPO]], P: fl.PperdaUs, k: F.termica },
      { pts: [[SRC.x - 1.6, SRC.y + 3.2], [SRC.x - 0.3, SRC.y + 2.2]], P: f === 2 ? fl.Pin : 0, k: F.quimica },
    ];
  }
  if (m === 1) {
    const [Pa, Pb] = potLampadas(p);
    const r: (Rota | null)[] = [];
    [[4.5, Pa, 0], [11.5, Pb, 1]].forEach(([x, P, i]) => {
      const u = USUARIOS[i!]!;
      r.push(
        { pts: [[x! - 2.6, 0.3], [x!, 0.3], [x!, 2.3]], P: P!, k: F.eletrica },
        { pts: [[x!, 4.3], [x! + (i ? 2.2 : -2.2), 7.6]], P: u.util * P!, k: F.luz },
        { pts: [[x! + 0.3, 4.6], [x! + (i ? -0.6 : 0.6), TOPO]], P: (1 - u.util) * P!, k: F.termica },
      );
    });
    return r;
  }
  const bs = s.blocos;
  const { cs, Pamb } = taxasBlocos(bs, p);
  const r: (Rota | null)[] = new Array(12).fill(null);
  bs.forEach((b, i) => {
    const c = caixa(bs, i);
    const [cx, cy] = centro(c);
    const Pb = potBico(b, p);
    if (b.host < 0 && b.slot <= 3 && Pb !== 0) r[i] = { pts: [[cx, 0.6], [cx, cy]], P: Pb, k: F.termica };
    if (Pamb[i] !== 0) r[8 + i] = { pts: [[cx + 0.2, c.y + c.h], [cx + 0.5, TOPO]], P: Pamb[i]!, k: F.termica };
  });
  for (const c of cs) {
    const [hx, hy] = centro(caixa(bs, c.j));
    const [gx, gy] = centro(caixa(bs, c.i));
    r[4 + c.i] = { pts: [[hx - 0.55, hy - 0.4], [gx - 0.2, gy]], P: c.q, k: F.termica };
  }
  return r;
}

/** Energia de cada pacote (J) no modo atual. */
export function ePacote(p: Params): number {
  const m = modo(p);
  if (m === 1) return 5;
  if (m === 2) return 50;
  return [200, 100, 200, 200][fonte(p)] ?? 100;
}

function moverPacotes(s: FE, p: Params, dt: number): Pick<FE, "acc" | "pk"> {
  const rs = rotas(s, p);
  const E = ePacote(p);
  const acc = rs.map((_, i) => s.acc[i] ?? 0);
  const pk: Pacote[] = [];
  for (const q of s.pk) {
    const u = q.u + (q.dir * dt) / VIAGEM;
    if (u >= 0 && u <= 1 && rs[q.r]) pk.push({ ...q, u });
  }
  rs.forEach((r, i) => {
    if (!r || r.P === 0) {
      acc[i] = 0;
      return;
    }
    acc[i]! += Math.abs(r.P) * dt;
    while (acc[i]! >= E && pk.length < 400) {
      acc[i]! -= E;
      const lag = acc[i]! / Math.abs(r.P) / VIAGEM;
      pk.push({ r: i, k: r.k, dir: Math.sign(r.P), u: r.P > 0 ? lag : 1 - lag });
    }
  });
  return { acc, pk };
}

// ------------------------------------------------------------------ cores

function corForma(theme: Theme, k: number): string {
  const dark = theme.dark;
  return [dark ? "#f2d14b" : "#d9a400", dark ? "#5cd18b" : "#1f9d55", dark ? "#b493f0" : "#7b4fd0", theme.accent, theme.positive, dark ? "#3cc7d6" : "#1494a3"][k] ?? theme.text;
}

function corT(T: number) {
  const u = clamp((T + 20) / 220, 0, 1);
  return `rgb(${Math.round(70 + 180 * u)}, ${Math.round(130 - 60 * u)}, ${Math.round(220 - 170 * u)})`;
}

const fmt = (v: number, d = 3) => formatBR(v, d);
const fmtW = (P: number) => `${fmt(P, Math.abs(P) >= 100 ? 4 : 3)} W`;

// ------------------------------------------------------------------ estado inicial

function blocosIniciais(p: Params): Bloco[] {
  const m = num(p, "massa", 0.2);
  const T0 = num(p, "T0", 20);
  const bs: Bloco[] = MATERIAIS.map((_, i) => ({ mat: i, m, T: i === 0 ? num(p, "Tferro", T0) : T0, slot: i, host: -1, dx: NaN, dy: NaN }));
  if (Math.round(num(p, "arranjo")) === 1) {
    // ferro dentro da água, tijolo e óleo na bancada
    bs[0]!.host = 2;
    bs[0]!.slot = -1;
    bs[1]!.slot = 4;
    bs[3]!.slot = 5;
  }
  return bs;
}

function init(p: Params): FE {
  return {
    Tk: CHALEIRA.T0,
    mk: CHALEIRA.m,
    Tb: BEQUER.T0,
    Tl: [T_AMB, T_AMB],
    Ein: 0,
    Eel: 0,
    Eut: 0,
    Eth: 0,
    Est: 0,
    phi: [0, 0],
    acc: [],
    pk: [],
    blocos: blocosIniciais(p),
    Q: 0,
    Qamb: 0,
    Evap: 0,
    arr: -1,
  };
}

function step(s: FE, p: Params, _t: number, dt: number): FE {
  const m = modo(p);
  let n: FE = s;
  if (m === 0) {
    const fl = fluxos(s, p);
    const f = fonte(p);
    let { Tk, mk, Tb } = s;
    if (f === 3) {
      if (mk > 0 && Tk < 100) Tk = Math.min(100, Tk + (fl.Parm * dt) / (mk * C_AGUA));
      else if (mk > 0) mk = Math.max(0, mk - (fl.Pconv * dt) / L_V);
    }
    if (usuario(p) === 3) Tb = Math.min(100, Tb + (fl.Put * dt) / (BEQUER.m * C_AGUA));
    const w0 = f === 0 ? 0 : 1.2 * Math.sqrt(Math.max(0, fl.Pconv));
    const w1 = usuario(p) === 2 ? 1.5 * Math.sqrt(Math.max(0, fl.Put)) : 0;
    n = {
      ...s,
      Tk,
      mk,
      Tb,
      Ein: s.Ein + fl.Pin * dt,
      Eel: s.Eel + fl.Pel * dt,
      Eut: s.Eut + fl.Put * dt,
      Eth: s.Eth + (fl.PperdaFonte + fl.PperdaConv + fl.PperdaUs) * dt,
      Est: s.Est + fl.Parm * dt,
      phi: [(s.phi[0] + w0 * dt) % (2 * Math.PI), (s.phi[1] + w1 * dt) % (2 * Math.PI)],
    };
  } else if (m === 1) {
    const P = potLampadas(p);
    const Tl = s.Tl.map((T, i) => {
      const b = BULBOS[i]!;
      const Treg = T_AMB + ((1 - USUARIOS[i]!.util) * P[i]!) / b.hA;
      return Treg + (T - Treg) * Math.exp((-b.hA * dt) / b.C); // solução exata do resfriamento de Newton
    }) as [number, number];
    const luz = USUARIOS[0]!.util * P[0] + USUARIOS[1]!.util * P[1];
    n = { ...s, Tl, Ein: s.Ein + (P[0] + P[1]) * dt, Eel: s.Eel + (P[0] + P[1]) * dt, Eut: s.Eut + luz * dt, Eth: s.Eth + (P[0] + P[1] - luz) * dt };
  } else if (s.arr < 0) {
    n = passoBlocos(s, p, dt);
  }
  return { ...n, ...moverPacotes(n, p, dt) };
}

// ------------------------------------------------------------------ ponteiro (modo blocos)

function acertar(bs: Bloco[], pt: { x: number; y: number }): number {
  // objetos de cima primeiro (hóspedes antes dos hospedeiros)
  const ordem = bs.map((_, i) => i).sort((a, b) => profundidade(bs, b) - profundidade(bs, a));
  for (const i of ordem) {
    const c = caixa(bs, i);
    if (pt.x >= c.x && pt.x <= c.x + c.w && pt.y >= c.y && pt.y <= c.y + c.h) return i;
  }
  return -1;
}

function profundidade(bs: Bloco[], i: number): number {
  let d = 0;
  for (let j = i; bs[j]!.host >= 0 && d < 6; j = bs[j]!.host) d++;
  return d;
}

const hospede = (bs: Bloco[], j: number) => bs.findIndex((b) => b.host === j);

function soltar(s: FE, pt: { x: number; y: number }): FE {
  const i = s.arr;
  const bs = s.blocos.map((b) => ({ ...b }));
  const b = bs[i]!;
  b.dx = NaN;
  b.dy = NaN;
  const liq = MATERIAIS[b.mat]!.liquido;
  const temHospede = hospede(bs, i) >= 0;
  // 1) dentro de um béquer ou em cima de um sólido
  for (let j = 0; j < bs.length; j++) {
    if (j === i || hospede(bs, j) >= 0 || liq) continue;
    let anc = j;
    let ciclo = false;
    for (let n = 0; n < 6 && anc >= 0; n++, anc = bs[anc]!.host) if (anc === i) ciclo = true;
    if (ciclo) continue;
    const c = caixa(bs, j);
    const hLiq = MATERIAIS[bs[j]!.mat]!.liquido;
    if (hLiq && temHospede) continue;
    if (pt.x >= c.x - 0.2 && pt.x <= c.x + c.w + 0.2 && pt.y >= c.y && pt.y <= c.y + c.h + SOLIDO + 0.3) {
      b.host = j;
      b.slot = -1;
      return { ...s, blocos: bs, arr: -1, pk: [], acc: [] };
    }
  }
  // 2) bico ou lugar livre na bancada mais próximo
  let best = -1;
  let dmin = 1.6;
  BICOS.forEach((x, k) => {
    const ocupado = bs.some((o, j) => j !== i && o.host < 0 && o.slot === k);
    if (!ocupado && Math.abs(pt.x - x) < dmin) {
      dmin = Math.abs(pt.x - x);
      best = k;
    }
  });
  if (best >= 0) {
    b.slot = best;
    b.host = -1;
  }
  return { ...s, blocos: bs, arr: -1, pk: [], acc: [] };
}

// ------------------------------------------------------------------ desenho

function pacotes(d: Draw, s: FE, p: Params) {
  const rs = rotas(s, p);
  for (const q of s.pk) {
    const r = rs[q.r];
    if (!r) continue;
    const pts = r.pts;
    const segs = pts.slice(1).map((b, i) => Math.hypot(b[0] - pts[i]![0], b[1] - pts[i]![1]));
    let L = segs.reduce((a, b) => a + b, 0) * q.u;
    let k = 0;
    while (k < segs.length - 1 && L > segs[k]!) L -= segs[k++]!;
    const a = pts[k]!;
    const b = pts[k + 1]!;
    const f = segs[k]! > 0 ? L / segs[k]! : 0;
    d.dot(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, 4.5, corForma(d.theme, q.k), 0.9);
  }
}

function legenda(d: Draw, p: Params) {
  const usadas = modo(p) === 2 ? [F.termica] : modo(p) === 1 ? [F.eletrica, F.luz, F.termica] : [0, 1, 2, 3, 4, 5];
  let x = 0.3;
  d.text(`1 pacote = ${ePacote(p)} J`, x, 8.75, { align: "left", size: 11, weight: "600" });
  x += 2.6;
  for (const k of usadas) {
    d.dot(x, 8.75, 4.5, corForma(d.theme, k));
    d.text(FORMAS[k]!, x + 0.2, 8.75, { align: "left", size: 11, color: d.theme.muted });
    x += 1.75;
  }
}

function termometro(d: Draw, x: number, y: number, T: number, Tmax = 120) {
  const { theme } = d;
  d.rect(x - 0.08, y, 0.16, 1.4, { stroke: theme.text, width: 1 });
  d.rect(x - 0.05, y, 0.1, 1.4 * clamp((T + 20) / (Tmax + 20), 0, 1), { fill: theme.positive });
  d.circle(x, y - 0.1, 0.14, { fill: theme.positive });
  d.text(`${fmt(T, 3)} °C`, x, y + 1.65, { size: 11, weight: "600" });
}

function roda(d: Draw, x: number, y: number, r: number, phi: number, cor: string) {
  d.circle(x, y, r, { stroke: cor, width: 2 });
  for (let i = 0; i < 6; i++) {
    const a = phi + (i * Math.PI) / 3;
    d.line(x, y, x + r * Math.cos(a), y + r * Math.sin(a), { color: cor, width: 2 });
    d.rect(x + r * Math.cos(a) - 0.08, y + r * Math.sin(a) - 0.08, 0.16, 0.16, { fill: cor });
  }
}

function renderCadeia(d: Draw, s: FE, p: Params) {
  const { theme } = d;
  const f = fonte(p);
  const u = usuario(p);
  const fl = fluxos(s, p);
  d.rect(0, 0, 16, 0.4, { fill: theme.ground });

  // ---- fonte
  if (f === 0) {
    const G0 = num(p, "irradiancia", 800);
    d.circle(1.6, 7.3, 0.75, { fill: "#f5c542", alpha: 0.3 + 0.7 * (G0 / 1000) });
    for (let i = 0; i < 10; i++) {
      const a = (i * Math.PI) / 5;
      d.line(1.6 + 0.95 * Math.cos(a), 7.3 + 0.95 * Math.sin(a), 1.6 + 1.25 * Math.cos(a), 7.3 + 1.25 * Math.sin(a), { color: "#e0a800", width: 2, alpha: G0 / 1000 });
    }
    d.text(`${fmt(G0)} W/m²`, 1.6, 5.9, { size: 11 });
  } else if (f === 1) {
    d.rect(0.4, 5.2, 2.4, 1.6, { fill: theme.series[0], alpha: 0.35, stroke: theme.text, width: 1.5 });
    d.polyline([[2.8, 6.0], [4.8, 6.0], [6.6, 4.4], [CNV.x - 0.6, CNV.y + 0.5]], { color: theme.series[0], width: 3 + num(p, "vazao", 10) * 0.4, alpha: 0.6 });
    d.line(0.4, 1.0, 0.4, 5.2, { color: theme.muted, dash: [4, 3] });
    d.text(`h = ${fmt(QUEDA.h)} m`, 1.4, 3.4, { size: 11, color: theme.muted });
    d.text(`Q = ${fmt(num(p, "vazao", 10))} L/s`, 1.6, 7.1, { size: 11 });
  } else if (f === 2) {
    // ciclista
    const ph = s.phi[0];
    roda(d, SRC.x - 1.1, 1.4, 0.9, -ph, theme.text);
    roda(d, SRC.x + 1.1, 1.4, 0.9, -ph, theme.text);
    const pd: Pt = [SRC.x + 0.25 * Math.cos(ph), 1.5 + 0.25 * Math.sin(ph)];
    d.polyline([[SRC.x - 1.1, 1.4], [SRC.x, 1.5], [SRC.x + 1.1, 1.4], [SRC.x + 0.6, 2.6], [SRC.x - 0.4, 2.6], [SRC.x, 1.5]], { color: theme.series[1], width: 2.5 });
    d.polyline([[SRC.x - 0.4, 2.7], [pd[0], pd[1]]], { color: theme.text, width: 3 });
    d.line(SRC.x - 0.4, 2.7, SRC.x - 0.1, 4.0, { color: theme.text, width: 3 });
    d.circle(SRC.x + 0.05, 4.45, 0.32, { stroke: theme.text, width: 2 });
    d.line(SRC.x - 0.1, 3.9, SRC.x + 0.6, 2.75, { color: theme.text, width: 2.5 });
    d.text("alimento", SRC.x - 1.7, SRC.y + 3.5, { size: 11, color: corForma(theme, F.quimica) });
  } else {
    d.rect(SRC.x - 0.9, 0.4, 1.8, 0.35, { fill: theme.muted });
    const chama = num(p, "chama", 2000) / 3000;
    d.polyline([[SRC.x - 0.6, 0.75], [SRC.x - 0.3, 0.75 + 0.6 * chama], [SRC.x, 0.75], [SRC.x + 0.3, 0.75 + 0.7 * chama], [SRC.x + 0.6, 0.75]], { color: "#ff7a1a", width: 2, fill: "#ffb347", alpha: 0.85 });
    d.rect(SRC.x - 1, 1.25, 2, 1.6, { fill: theme.dark ? "#4a5361" : "#c8ced6", stroke: theme.text, width: 1.5 });
    d.rect(SRC.x - 0.9, 1.3, 1.8, 1.3 * (s.mk / CHALEIRA.m), { fill: corT(s.Tk), alpha: 0.7 });
    d.line(SRC.x + 1, 2.6, SRC.x + 1.4, 3.3, { color: theme.text, width: 4 });
    termometro(d, SRC.x - 1.5, 1.4, s.Tk);
    d.text(s.mk <= 0 ? "chaleira seca" : s.Tk < 100 ? "esquentando a água" : "fervendo: vapor", SRC.x, 4.0, { size: 11, color: theme.muted });
  }

  // ---- conversor
  if (f === 0) {
    d.box(CNV.x, CNV.y + 0.8, 2.4, 0.25, -0.5, { fill: theme.dark ? "#2b4d8a" : "#244a8f", stroke: theme.text, width: 1.5 });
    d.line(CNV.x, CNV.y + 0.6, CNV.x, 0.4, { color: theme.text, width: 2 });
    d.text(`painel: η = ${fmt(PAINEL.eta * 100)} %`, CNV.x, 0.9, { size: 11 });
  } else {
    roda(d, CNV.x - 0.5, CNV.y, 0.7, s.phi[0], f === 2 ? theme.text : theme.accent);
    d.rect(CNV.x + 0.2, CNV.y - 0.5, 0.8, 1, { fill: theme.muted, stroke: theme.text, width: 1.5 });
    d.text("G", CNV.x + 0.6, CNV.y, { size: 12, weight: "700", color: theme.dark ? "#111" : "#fff" });
    const eta = f === 1 ? QUEDA.eta : f === 2 ? 0.75 : CHALEIRA.etaTurbina;
    d.text(`${f === 2 ? "dínamo" : "turbina + gerador"}: η = ${fmt(eta * 100)} %`, CNV.x, 1.2, { size: 11 });
  }
  // fios
  d.polyline([[CNV.x + 0.8, CNV.y], [10.5, CNV.y], [11.2, USR.y - 0.6], [USR.x - 0.3, USR.y - 0.6]], { color: theme.muted, width: 2 });

  // ---- usuário
  const U = USUARIOS[u]!;
  if (U.forma === "luz") {
    const brilho = clamp(fl.Put / 40, 0, 1);
    d.circle(USR.x, USR.y + 1, 0.75, { fill: "#ffe680", alpha: 0.15 + 0.85 * brilho, stroke: theme.text, width: 1.5 });
    d.rect(USR.x - 0.35, USR.y - 0.6, 0.7, 0.9, { fill: theme.muted });
    if (u === 1) for (let i = -1; i <= 1; i++) d.rect(USR.x + i * 0.25 - 0.08, USR.y + 0.7, 0.16, 0.16, { fill: theme.text });
    else d.polyline([[USR.x - 0.2, USR.y + 0.4], [USR.x - 0.1, USR.y + 1.2], [USR.x + 0.1, USR.y + 1], [USR.x + 0.2, USR.y + 0.4]], { color: theme.text, width: 1.5 });
    d.text(`${fmt(fl.lm)} lm`, USR.x + 1.5, USR.y - 0.2, { size: 11 });
  } else if (U.forma === "mecanica") {
    d.line(USR.x, USR.y - 0.6, USR.x, USR.y + 0.6, { color: theme.text, width: 3 });
    for (let i = 0; i < 3; i++) {
      const a = s.phi[1] + (i * 2 * Math.PI) / 3;
      d.box(USR.x + 0.6 * Math.cos(a), USR.y + 0.6 + 0.6 * Math.sin(a), 1.1, 0.24, a, { fill: theme.series[4], alpha: 0.8 });
    }
    d.circle(USR.x, USR.y + 0.6, 0.18, { fill: theme.text });
  } else {
    d.rect(USR.x - 0.9, USR.y - 1.1, 1.8, 2.2, { stroke: theme.text, width: 1.5 });
    d.rect(USR.x - 0.85, USR.y - 1.05, 1.7, 1.6, { fill: corT(s.Tb), alpha: 0.6 });
    d.plot((x) => USR.y - 0.6 + 0.15 * Math.sin(12 * x), USR.x - 0.6, USR.x + 0.6, { color: theme.positive, width: 2 });
    termometro(d, USR.x + 1.3, USR.y - 1, s.Tb);
  }
  d.text(U.label, USR.x, 0.7, { size: 11 });

  // ---- potências medidas
  const ytxt = 7.6;
  d.text(`P_fonte = ${fmtW(fl.Pin)}`, SRC.x + 1.3, ytxt, { size: 12, weight: "600", color: corForma(theme, fl.formaIn) });
  d.text(`P_elétrica = ${fmtW(fl.Pel)}`, 10.0, ytxt, { size: 12, weight: "600", color: theme.accent });
  d.text(`P_útil = ${fmtW(fl.Put)}`, 14.4, ytxt - 0.55, { size: 12, weight: "600" });
  d.text(`η total = ${fl.Pin > 0 ? fmt((100 * fl.Put) / fl.Pin) : "—"} %`, 14.4, ytxt - 1.1, { size: 12 });

  // ---- Sankey ao vivo
  sankey(d, [
    { x: 0.4, P: fl.Pin, k: fl.formaIn, label: "fonte" },
    { x: 4.6, P: fl.Pin - fl.PperdaFonte - fl.Parm, k: f === 0 ? F.luz : f === 1 ? F.potencial : f === 2 ? F.mecanica : F.termica, perda: fl.PperdaFonte, arm: fl.Parm },
    { x: 9.4, P: fl.Pel, k: F.eletrica, perda: fl.PperdaConv },
    { x: 13.6, P: fl.Put, k: U.forma === "luz" ? F.luz : U.forma === "mecanica" ? F.mecanica : F.termica, perda: fl.PperdaUs, label: "útil" },
  ], Math.max(fl.Pin, 1));
}

interface Est {
  x: number;
  P: number;
  k: number;
  perda?: number;
  arm?: number;
  label?: string;
}

/** Diagrama de Sankey: a espessura de cada faixa é proporcional à potência. */
function sankey(d: Draw, est: Est[], Pmax: number) {
  const { theme } = d;
  const y0 = -3.3;
  const k = 2.2 / Pmax;
  d.text("Fluxo de potência (Sankey)", 0.4, -0.35, { align: "left", size: 11, color: theme.muted });
  est.forEach((e, i) => {
    const x1 = i + 1 < est.length ? est[i + 1]!.x : 15.8;
    d.rect(e.x, y0, x1 - e.x - (i + 1 < est.length ? 0.4 : 0), Math.max(e.P * k, 0.015), { fill: corForma(theme, e.k), alpha: 0.75 });
    d.text(fmtW(e.P), e.x + 0.1, y0 + Math.max(e.P * k, 0) + 0.25, { align: "left", size: 10 });
    const prev = est[i - 1];
    if (prev) {
      const xb = e.x - 0.4;
      let top = y0 + prev.P * k;
      if (e.perda && e.perda > 0) {
        const h = e.perda * k;
        d.rect(xb, top - h, 0.35, h, { fill: theme.positive, alpha: 0.8 });
        d.text(`−${fmtW(e.perda)} calor`, xb + 0.2, Math.min(top + 0.25, -0.75), { size: 10, color: theme.positive });
        top -= h;
      }
      if (e.arm && e.arm > 0) {
        const h = e.arm * k;
        d.rect(xb, top - h, 0.35, h, { fill: corForma(theme, F.potencial), alpha: 0.8 });
        d.text(`armazenada ${fmtW(e.arm)}`, xb + 0.2, Math.min(top - h - 0.25, -0.75), { size: 10, color: corForma(theme, F.potencial) });
      }
    }
  });
}

function renderLampadas(d: Draw, s: FE, p: Params) {
  const { theme } = d;
  const P = potLampadas(p);
  d.rect(0.2, 0, 1.2, 0.8, { fill: theme.muted });
  d.text("rede", 0.8, 1.1, { size: 11, color: theme.muted });
  [4.5, 11.5].forEach((x, i) => {
    const U = USUARIOS[i]!;
    const luz = U.util * P[i]!;
    d.circle(x, 3.3, 1, { fill: "#ffe680", alpha: 0.12 + 0.88 * clamp(luz / 30, 0, 1), stroke: corT(s.Tl[i]!), width: 3 });
    d.rect(x - 0.4, 1.8, 0.8, 0.7, { fill: theme.muted });
    d.text(U.label, x, 1.25, { size: 12, weight: "600" });
    const lin = [
      `P_elétrica = ${fmtW(P[i]!)}`,
      `luz visível = ${fmtW(luz)}  (η = ${fmt(U.util * 100)} %)`,
      `fluxo luminoso = ${fmt(U.lmW * P[i]!)} lm`,
      `calor = ${fmtW(P[i]! - luz)}`,
      `bulbo: ${fmt(s.Tl[i]!)} °C`,
    ];
    lin.forEach((t, j) => d.text(t, x, -0.6 - 0.5 * j, { size: 11, color: j === 4 ? corT(s.Tl[i]!) : theme.text }));
  });
  d.polyline([[1.4, 0.3], [11.5, 0.3]], { color: theme.muted, width: 2 });
  d.line(4.5, 0.3, 4.5, 1.8, { color: theme.muted, width: 2 });
  d.line(11.5, 0.3, 11.5, 1.8, { color: theme.muted, width: 2 });
  d.text(Math.round(num(p, "comparar")) === 1 ? "mesmo brilho (mesmos lúmens)" : "mesma potência elétrica", 8, 6.2, { size: 12, color: theme.muted });
}

function renderBlocos(d: Draw, s: FE, p: Params) {
  const { theme } = d;
  const P = num(p, "calor", 0);
  d.rect(0, 0, 16, 0.6, { fill: theme.ground });
  BICOS.forEach((x, k) => {
    if (k <= 3) {
      d.rect(x - 1, 0.6, 2, 0.6, { fill: theme.dark ? "#39414d" : "#9aa3ad", stroke: theme.text, width: 1 });
      if (P > 0) d.rect(x - 0.8, 1.05, 1.6, 0.12, { fill: "#ff7a1a", alpha: clamp(P / 500, 0.15, 1) });
      if (P < 0) d.rect(x - 0.8, 1.05, 1.6, 0.12, { fill: "#5bc0eb", alpha: clamp(-P / 200, 0.15, 1) });
    } else {
      d.rect(x - 1.15, 0.6, 2.3, 0.6, { stroke: theme.muted, width: 1, dash: [4, 3] });
    }
  });
  d.text("bicos (aquecem ou resfriam)", 5.2, 0.3, { size: 10, color: theme.muted });
  d.text("bancada isolada", 12.9, 0.3, { size: 10, color: theme.muted });
  const ordem = s.blocos.map((_, i) => i).sort((a, b) => profundidade(s.blocos, a) - profundidade(s.blocos, b));
  // béqueres primeiro (atrás), sólidos depois
  const liqs = ordem.filter((i) => MATERIAIS[s.blocos[i]!.mat]!.liquido);
  const sols = ordem.filter((i) => !MATERIAIS[s.blocos[i]!.mat]!.liquido);
  for (const i of [...liqs, ...sols]) {
    const b = s.blocos[i]!;
    const c = caixa(s.blocos, i);
    const mat = MATERIAIS[b.mat]!;
    if (mat.liquido) {
      const nivel = 0.72 * c.h * (b.mat === 2 ? b.m / Math.max(num(p, "massa", 0.2), 1e-6) : 1);
      d.rect(c.x + 0.05, c.y + 0.05, c.w - 0.1, nivel, { fill: b.mat === 2 ? corT(b.T) : "#d9b23a", alpha: b.mat === 2 ? 0.55 : 0.6 });
      d.polyline([[c.x, c.y + c.h], [c.x, c.y], [c.x + c.w, c.y], [c.x + c.w, c.y + c.h]], { color: theme.text, width: 2 });
      if (b.mat === 2 && b.T >= 99.99) for (let k = 0; k < 4; k++) d.circle(c.x + 0.3 + 0.4 * k, c.y + nivel * (0.3 + 0.15 * k), 0.07, { stroke: theme.text, width: 1 });
    } else {
      d.rect(c.x, c.y, c.w, c.h, { fill: corT(b.T), stroke: theme.text, width: 1.5 });
      if (b.mat === 1) for (let k = 1; k < 3; k++) d.line(c.x, c.y + (k * c.h) / 3, c.x + c.w, c.y + (k * c.h) / 3, { color: theme.text, width: 0.8, alpha: 0.6 });
    }
    d.text(`${mat.nome}: ${fmt(b.T, 3)} °C`, c.x + c.w / 2, mat.liquido ? c.y + c.h + 0.3 : c.y + c.h / 2, {
      size: 11,
      weight: "600",
      color: mat.liquido ? theme.text : "#fff",
    });
  }
  const U = energiaBlocos(s);
  d.text(`Calor dos bicos: ${fmt(s.Q / 1000)} kJ    Perdido p/ o ar: ${fmt(s.Qamb / 1000)} kJ    Energia interna (ref. 0 °C) + vapor: ${fmt(U / 1000)} kJ`, 8, -0.6, { size: 11 });
  d.text("Arraste os blocos: para dentro da água ou do óleo, um sobre o outro, ou para a bancada.", 8, -1.2, { size: 11, color: theme.muted });
  // pequeno gráfico de barras das capacidades térmicas
  s.blocos.forEach((b, i) => {
    const x = 1 + i * 3.8;
    const C = capacidade(b);
    d.rect(x, -3.3, (C / 1000) * 1.6, 0.35, { fill: theme.series[i]!, alpha: 0.8 });
    d.text(`${MATERIAIS[b.mat]!.nome}: mc = ${fmt(C)} J/K`, x, -2.6, { align: "left", size: 10 });
  });
}

// ------------------------------------------------------------------ simulação

const obsCadeia = (s: FE, p: Params) => (modo(p) === 0 ? fluxos(s, p) : null);
const bloco = (s: FE, mat: number) => s.blocos.find((b) => b.mat === mat)?.T ?? 0;

export const formasEnergia = defineSim<FE>({
  id: "formas-energia",
  title: "Formas e conversões de energia",
  course: "FG I",
  topic: "Energia",
  priority: "P2",
  summary:
    "Cadeias fonte → conversor → usuário (Sol, queda d'água, ciclista, chaleira) com pacotes de energia, potências e rendimentos medidos e diagrama de Sankey ao vivo; lâmpada incandescente × LED; aquecimento de blocos e equilíbrio térmico.",
  equations: [
    String.raw`\eta = \frac{P_\text{útil}}{P_\text{entrada}} \qquad \eta_\text{total} = \eta_1\,\eta_2\,\eta_3 \qquad P_\text{entrada} = P_\text{útil} + P_\text{térmica}`,
    String.raw`P_\text{sol} = I A \qquad P_\text{hidr} = \rho g Q h \qquad Q = mc\,\Delta T \qquad Q_\text{vap} = m L_V`,
    String.raw`\frac{dT}{dt} = \frac{P}{mc} \qquad T_\text{eq} = \frac{\sum m_i c_i T_i}{\sum m_i c_i}`,
  ],
  liveEquations(s, p) {
    const m = modo(p);
    if (m === 0) {
      const fl = fluxos(s, p);
      return [
        String.raw`P_\text{fonte} = ${texNum(fl.Pin)}\ \text{W} \to P_\text{el} = ${texNum(fl.Pel)}\ \text{W} \to P_\text{útil} = ${texNum(fl.Put)}\ \text{W}`,
        String.raw`\eta_\text{total} = ${fl.Pin > 0 ? texNum(fl.Put / fl.Pin) : "0"} \qquad E_\text{fonte} = ${texNum(s.Ein / 1000)}\ \text{kJ} = E_\text{útil} + E_\text{térm} + E_\text{arm} = ${texNum((s.Eut + s.Eth + s.Est) / 1000)}\ \text{kJ}`,
      ];
    }
    if (m === 1) {
      const P = potLampadas(p);
      return [
        String.raw`\text{incandescente: } ${texNum(P[0])}\ \text{W} \to ${texNum(USUARIOS[0]!.lmW * P[0])}\ \text{lm} \qquad \text{LED: } ${texNum(P[1])}\ \text{W} \to ${texNum(USUARIOS[1]!.lmW * P[1])}\ \text{lm}`,
        String.raw`T_\text{bulbo} = T_\text{amb} + \frac{(1-\eta)P}{hA}: \quad ${texNum(s.Tl[0])}\ ^\circ\text{C} \ \text{e}\ ${texNum(s.Tl[1])}\ ^\circ\text{C}`,
      ];
    }
    const U = energiaBlocos(s);
    return [String.raw`\sum m c T + E_\text{vap} = ${texNum(U / 1000)}\ \text{kJ} \qquad Q_\text{bicos} - Q_\text{ar} = ${texNum((s.Q - s.Qamb) / 1000)}\ \text{kJ}`];
  },

  params: [
    {
      key: "modo",
      label: "Modo",
      unit: "",
      min: 0,
      max: 2,
      step: 1,
      default: 0,
      options: [
        { value: 0, label: "Cadeia fonte → conversor → usuário" },
        { value: 1, label: "Lâmpada incandescente × LED" },
        { value: 2, label: "Aquecimento de blocos e equilíbrio" },
      ],
    },
    { key: "fonte", label: "Fonte e conversor", unit: "", min: 0, max: 3, step: 1, default: 0, options: FONTES },
    { key: "usuario", label: "Usuário", unit: "", min: 0, max: 3, step: 1, default: 1, options: USUARIOS.map((u) => ({ value: u.value, label: u.label })) },
    { key: "irradiancia", label: "Irradiância solar (nuvens)", unit: "W/m²", min: 0, max: 1000, step: 10, default: 800, live: true },
    { key: "vazao", label: "Vazão da queda d'água", unit: "L/s", min: 0, max: 20, step: 0.5, default: 10, live: true },
    { key: "pedal", label: "Potência nos pedais", unit: "W", min: 0, max: 400, step: 5, default: 150, live: true },
    { key: "chama", label: "Potência da chama", unit: "W", min: 0, max: 3000, step: 50, default: 2000, live: true },
    { key: "Pel", label: "Potência da lâmpada incandescente", unit: "W", min: 5, max: 150, step: 1, default: 60, live: true },
    {
      key: "comparar",
      label: "Comparação das lâmpadas",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 1,
      live: true,
      options: [
        { value: 0, label: "Mesma potência elétrica" },
        { value: 1, label: "Mesmo brilho (lúmens)" },
      ],
    },
    { key: "calor", label: "Bicos: aquecer (+) ou resfriar (−)", unit: "W", min: -200, max: 500, step: 10, default: 200, live: true },
    { key: "massa", label: "Massa de cada bloco", unit: "kg", min: 0.05, max: 1, step: 0.05, default: 0.2 },
    { key: "T0", label: "Temperatura inicial", unit: "°C", min: -10, max: 40, step: 1, default: 20 },
    { key: "Tferro", label: "Temperatura inicial do ferro", unit: "°C", min: -10, max: 400, step: 5, default: 20 },
    {
      key: "arranjo",
      label: "Arranjo inicial",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 0,
      options: [
        { value: 0, label: "Cada objeto num bico" },
        { value: 1, label: "Ferro dentro da água (bancada)" },
      ],
    },
    {
      key: "perdas",
      label: "Perdas para o ar",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 0,
      live: true,
      options: [
        { value: 0, label: "Desligadas (sistema isolado)" },
        { value: 1, label: "Ligadas (0,4 W/K por objeto)" },
      ],
    },
  ],

  observables: [
    { key: "Pin", label: "Potência da fonte", unit: "W", value: (s, p) => (modo(p) === 1 ? potLampadas(p)[0] + potLampadas(p)[1] : obsCadeia(s, p)?.Pin ?? num(p, "calor", 0)) },
    { key: "Pel", label: "Potência elétrica", unit: "W", value: (s, p) => (modo(p) === 1 ? potLampadas(p)[0] + potLampadas(p)[1] : obsCadeia(s, p)?.Pel ?? 0) },
    { key: "Put", label: "Potência útil", unit: "W", value: (s, p) => (modo(p) === 1 ? USUARIOS[0]!.util * potLampadas(p)[0] + USUARIOS[1]!.util * potLampadas(p)[1] : obsCadeia(s, p)?.Put ?? 0) },
    {
      key: "Pth",
      label: "Potência térmica dissipada",
      unit: "W",
      value: (s, p) => {
        const fl = obsCadeia(s, p);
        if (fl) return fl.PperdaFonte + fl.PperdaConv + fl.PperdaUs;
        if (modo(p) === 1) return potLampadas(p).reduce((a, P, i) => a + (1 - USUARIOS[i]!.util) * P, 0);
        return taxasBlocos(s.blocos, p).Pamb.reduce((a, b) => a + b, 0);
      },
    },
    {
      key: "eta",
      label: "Rendimento total (cadeia) / incandescente",
      unit: "%",
      value: (s, p) => {
        const fl = obsCadeia(s, p);
        if (fl) return fl.Pin > 0 ? (100 * fl.Put) / fl.Pin : 0;
        return modo(p) === 1 ? 100 * USUARIOS[0]!.util : 0;
      },
    },
    { key: "etaLED", label: "Rendimento da LED", unit: "%", value: (_s, p) => (modo(p) === 1 ? 100 * USUARIOS[1]!.util : 0) },
    { key: "lmInc", label: "Fluxo luminoso (incandescente)", unit: "lm", value: (s, p) => (modo(p) === 1 ? USUARIOS[0]!.lmW * potLampadas(p)[0] : obsCadeia(s, p)?.lm ?? 0) },
    { key: "lmLED", label: "Fluxo luminoso (LED)", unit: "lm", value: (_s, p) => (modo(p) === 1 ? USUARIOS[1]!.lmW * potLampadas(p)[1] : 0) },
    { key: "Tinc", label: "Temperatura do bulbo incandescente", unit: "°C", value: (s) => s.Tl[0] },
    { key: "Tled", label: "Temperatura da LED", unit: "°C", value: (s) => s.Tl[1] },
    { key: "Ein", label: "Energia fornecida pela fonte", unit: "kJ", value: (s, p) => (modo(p) === 2 ? s.Q : s.Ein) / 1000 },
    { key: "Eut", label: "Energia útil", unit: "kJ", value: (s) => s.Eut / 1000 },
    { key: "Eth", label: "Energia térmica dissipada", unit: "kJ", value: (s, p) => (modo(p) === 2 ? s.Qamb : s.Eth) / 1000 },
    {
      key: "Tagua",
      label: "Temperatura da água",
      unit: "°C",
      value: (s, p) => (modo(p) === 2 ? bloco(s, 2) : fonte(p) === 3 ? s.Tk : usuario(p) === 3 ? s.Tb : T_AMB),
    },
    { key: "Tferro", label: "Temperatura do ferro", unit: "°C", value: (s) => bloco(s, 0) },
    { key: "Ttijolo", label: "Temperatura do tijolo", unit: "°C", value: (s) => bloco(s, 1) },
    { key: "Toleo", label: "Temperatura do óleo", unit: "°C", value: (s) => bloco(s, 3) },
    {
      key: "bal",
      label: "Balanço de energia (deve ficar constante)",
      unit: "kJ",
      value: (s, p) => (modo(p) === 2 ? (energiaBlocos(s) - s.Q + s.Qamb) / 1000 : (s.Ein - s.Eut - s.Eth - s.Est) / 1000),
    },
  ],
  conserved: "bal",
  chart: { x: "t", y: "Tagua" },

  scenarios: [
    {
      id: "sol-led",
      label: "Sol → painel → LED",
      params: { modo: 0, fonte: 0, usuario: 1, irradiancia: 800 },
      guide: `### Uma cadeia de conversões
1. Acompanhe os **pacotes**: luz do Sol chega ao painel; só 1 em cada 5 sai como energia **elétrica**, os outros viram **calor**.
2. Leia as potências medidas e confira $\\eta_\\text{total} = \\eta_\\text{painel}\\,\\eta_\\text{LED} = 0{,}20 \\times 0{,}40$.
3. Passe nuvens (diminua a irradiância): todas as potências caem na mesma proporção, os rendimentos não mudam.
4. Troque a LED pela incandescente e veja a faixa útil do diagrama de Sankey quase sumir.`,
      predict: [
        {
          question: "Com 1280 W de luz solar chegando ao painel (η = 20 %) e uma LED (η = 40 %), quanto sai como luz?",
          options: ["cerca de 512 W", "cerca de 256 W", "cerca de 102 W", "cerca de 26 W"],
          answer: 2,
          explanation: "Os rendimentos se multiplicam: $1280 \\times 0{,}20 \\times 0{,}40 \\approx 102$ W. Cada etapa só repassa uma fração; o resto vira energia térmica, que não some: o balanço fecha.",
        },
      ],
    },
    {
      id: "chaleira",
      label: "Chaleira e turbina a vapor",
      params: { modo: 0, fonte: 3, usuario: 3, chama: 2000 },
      guide: `### Energia armazenada antes de virar trabalho
1. No início não há vapor: a energia da chama fica **armazenada** na água (faixa azul-esverdeada do Sankey). Meça o tempo até ferver e confira $t = mc\\Delta T / (\\eta_\\text{chama} P)$.
2. Depois de ferver, a turbina gira e o aquecedor elétrico esquenta o béquer. Note como sobra pouca potência: a turbina a vapor tem $\\eta = 12\\%$.
3. Compare com uma usina termelétrica real (~35 %) e explique por que a maior parte da energia térmica não vira trabalho (2ª lei).`,
    },
    {
      id: "lampadas",
      label: "Incandescente × LED",
      params: { modo: 1, Pel: 60, comparar: 1 },
      guide: `### Mesmo brilho, consumos diferentes
1. As duas lâmpadas emitem o mesmo fluxo luminoso (lúmens). Leia a potência elétrica de cada uma.
2. Observe os pacotes térmicos e a temperatura de cada bulbo subindo até o regime $T = T_\\text{amb} + (1-\\eta)P/hA$.
3. Troque para **mesma potência elétrica**: qual ilumina mais? Quanto a LED economiza por mês, acesa 5 h por dia?`,
      predict: [
        {
          question: "Uma incandescente de 60 W e uma LED com o mesmo brilho. Qual esquenta mais o ambiente?",
          options: ["a incandescente", "a LED", "as duas igualmente, porque iluminam igual"],
          answer: 0,
          explanation: "Para os mesmos lúmens a LED usa só 9 W; a incandescente dissipa 57 W como calor contra 5,4 W da LED.",
        },
      ],
    },
    {
      id: "blocos",
      label: "Aquecendo ferro, tijolo, água e óleo",
      params: { modo: 2, calor: 200, massa: 0.2, T0: 20, Tferro: 20, arranjo: 0, perdas: 0 },
      guide: `### Mesma potência, aquecimentos diferentes
1. Os quatro objetos têm a mesma massa e recebem a mesma potência. Plote as temperaturas (troque a grandeza do gráfico).
2. Meça as inclinações $dT/dt$ e calcule $c = P/(m\\,dT/dt)$ para cada material.
3. Leve a água até 100 °C: a temperatura para e o nível baixa (calor latente).
4. Depois arraste o ferro quente para dentro da água fria e desligue os bicos (0 W): veja o equilíbrio térmico.`,
      predict: [
        {
          question: "Com a mesma massa e a mesma potência, qual esquenta mais depressa?",
          options: ["ferro", "tijolo", "água", "óleo"],
          answer: 0,
          explanation: "$dT/dt = P/(mc)$: o ferro tem o menor calor específico (450 J/kg·K), quase 10 vezes menor que o da água.",
        },
      ],
    },
    {
      id: "equilibrio",
      label: "Ferro quente na água",
      params: { modo: 2, calor: 0, massa: 0.2, T0: 20, Tferro: 300, arranjo: 1, perdas: 0 },
      guide: `### Equilíbrio térmico
1. O ferro (300 °C) está dentro da água (20 °C), longe dos bicos. Antes de rodar, calcule $T_\\text{eq} = \\dfrac{m c_\\text{Fe} T_\\text{Fe} + m c_\\text{a} T_\\text{a}}{m c_\\text{Fe} + m c_\\text{a}}$.
2. Rode e confira. O balanço de energia fica constante: o calor que o ferro perde é o que a água ganha.
3. Ligue as perdas para o ar e veja o sistema esfriar até a temperatura ambiente.`,
    },
  ],

  exercises: [
    {
      id: "cadeia",
      prompt:
        "Um painel solar de 1,6 m² e rendimento 20 % recebe {irradiancia} W/m² e alimenta uma lâmpada LED de rendimento 40 %. Qual a potência luminosa emitida?",
      vary: { irradiancia: [300, 1000, 0] },
      fixed: { modo: 0, fonte: 0, usuario: 1 },
      answer: { label: "P_luz", unit: "W", compute: (p) => num(p, "irradiancia") * PAINEL.A * PAINEL.eta * USUARIOS[1]!.util },
    },
    {
      id: "hidro",
      prompt: "Uma queda d'água de 5 m com vazão de {vazao} L/s move uma turbina com gerador de rendimento 80 %. Qual a potência elétrica? (g = 9,81 m/s²)",
      vary: { vazao: [2, 20, 1] },
      fixed: { modo: 0, fonte: 1 },
      answer: { label: "P_el", unit: "W", compute: (p) => RHO_AGUA * (num(p, "vazao") / 1000) * G * QUEDA.h * QUEDA.eta },
    },
    {
      id: "equilibrio",
      prompt: "Um bloco de ferro de {massa} kg a {Tferro} °C é posto em {massa} kg de água a {T0} °C, sem perdas. Qual a temperatura de equilíbrio? (c_Fe = 450 J/kg·K, c_água = 4186 J/kg·K)",
      vary: { massa: [0.1, 1, 2], Tferro: [80, 400, 0], T0: [5, 30, 0] },
      fixed: { modo: 2, arranjo: 1, calor: 0 },
      answer: { label: "T_eq", unit: "°C", compute: (p) => (450 * num(p, "Tferro") + C_AGUA * num(p, "T0")) / (450 + C_AGUA) },
      hint: "As massas são iguais e se cancelam.",
    },
  ],

  init,
  step,
  dt: 0.02,
  sampleEvery: 10,
  maxSamples: 4000,

  pointer: {
    down(s, p, pt) {
      if (modo(p) !== 2) return undefined;
      const i = acertar(s.blocos, pt);
      if (i < 0) return undefined;
      const blocos = s.blocos.map((b, j) => (j === i ? { ...b, host: -1, dx: pt.x, dy: pt.y } : b));
      return { ...s, blocos, arr: i, pk: [], acc: [] };
    },
    move(s, p, pt, dragging) {
      if (modo(p) !== 2 || !dragging || s.arr < 0) return undefined;
      const x = clamp(pt.x, 0.8, 15.2);
      const y = clamp(pt.y, 1.5, 7.5);
      return { ...s, blocos: s.blocos.map((b, j) => (j === s.arr ? { ...b, dx: x, dy: y } : b)) };
    },
    up(s, p, pt) {
      if (modo(p) !== 2 || s.arr < 0) return undefined;
      return soltar(s, pt);
    },
    cursor: (s, p, pt) => (modo(p) === 2 && acertar(s.blocos, pt) >= 0 ? "grab" : undefined),
  },
  actions: [
    {
      id: "reabastecer",
      label: "Reabastecer a chaleira",
      run: (s) => ({ ...s, mk: CHALEIRA.m, Tk: CHALEIRA.T0 }),
    },
    {
      id: "arrumar",
      label: "Devolver blocos aos bicos",
      run: (s) => ({ ...s, blocos: s.blocos.map((b, i) => ({ ...b, slot: i, host: -1, dx: NaN, dy: NaN })), pk: [], acc: [] }),
    },
  ],

  viewport: () => VP,

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const { state: s, params: p } = frame;
    const m = modo(p);
    if (m === 0) renderCadeia(d, s, p);
    else if (m === 1) renderLampadas(d, s, p);
    else renderBlocos(d, s, p);
    pacotes(d, s, p);
    legenda(d, p);
  },
});

export default formasEnergia;
