import { clamp, defineSim, draw, formatBR, num, texNum, type Draw, type Params } from "@fisilab/core";
import {
  OPERACOES,
  REGUAS,
  cartao,
  casasLeitura,
  comAS,
  estatistica,
  funcao,
  lerRegua,
  operacoes,
  queda,
  sigmaPropagada,
  sorteador,
  tempoDeQueda,
} from "./physics.ts";

export * from "./physics.ts";

export interface ME {
  /** Relógio interno (s): os handlers do ponteiro não recebem t. */
  clock: number;
  seed: number;
  /** Régua: 0 segurada (aguardando), 1 caindo, 2 pega, 3 deixou cair, 4 queimou a largada. */
  fase: number;
  tArm: number;
  tRel: number;
  /** Instante planejado da pegada (aluno virtual). */
  tPega: number;
  /** Queda verdadeira no instante da pegada (m). */
  dPego: number;
  /** Tempos calculados e distâncias lidas de cada tentativa válida. */
  ts: number[];
  ds: number[];
  falhas: number;
  /** Tempo de queda (cronômetro/sensor da sim) e queda verdadeira da última pegada válida. */
  ultT: number;
  ultD: number;
  /** Marcadores de leitura (cm) e o que está sendo arrastado (0 nada, 1 L, 2 W, 3 mira). */
  xL: number;
  xW: number;
  arr: number;
  dardos: [number, number][];
  mira: [number, number];
  tProx: number;
  hA: number[];
  hB: number[];
  hF: number[];
  nMC: number;
  sF: number;
  sF2: number;
}

const BINS = 41;
const modo = (p: Params) => Math.round(num(p, "modo"));
const virtual = (p: Params) => Math.round(num(p, "quem")) === 1;
const Lregua = (p: Params) => num(p, "Lregua", 0.5);
const res = (p: Params) => num(p, "resolucao", 0.001);
const div = (p: Params) => REGUAS[Math.round(num(p, "regua", 2))]?.div ?? 0.1;
const fmt = (v: number, d = 3) => formatBR(v, d);

// ------------------------------------------------------------------ tempo de reação

function armar(s: ME, p: Params): ME {
  const r = sorteador(s.seed);
  const tRel = s.clock + 1 + 2 * r.u();
  const tr = Math.max(0.08, num(p, "tReacao", 0.2) + num(p, "sigReacao", 0.03) * r.g());
  return { ...s, seed: s.seed + 1, fase: 0, tArm: s.clock, tRel, tPega: tRel + tr, dPego: 0 };
}

function pegar(s: ME, p: Params, tc: number): ME {
  const d = queda(tc - s.tRel);
  if (d > Lregua(p)) return { ...s, fase: 3, tArm: s.clock, falhas: s.falhas + 1 };
  const lido = lerRegua(d, res(p));
  return { ...s, fase: 2, tArm: s.clock, dPego: d, ultT: tc - s.tRel, ultD: d, ts: [...s.ts, tempoDeQueda(lido)], ds: [...s.ds, lido] };
}

/** Queda atual da régua (m) para o desenho. */
export function quedaAtual(s: ME, p: Params): number {
  if (s.fase === 1) return Math.min(queda(s.clock - s.tRel), Lregua(p) * 1.08);
  if (s.fase === 2) return s.dPego;
  if (s.fase === 3) return Lregua(p) * 1.08;
  return 0;
}

// ------------------------------------------------------------------ propagação

function faixa(p: Params) {
  const op = Math.round(num(p, "op"));
  const A = num(p, "A", 10), sA = num(p, "sA", 0.2), B = num(p, "B", 5), sB = num(p, "sB", 0.1);
  const f0 = funcao(op, A, B);
  const sf = sigmaPropagada(op, A, sA, B, sB);
  return { op, A, sA, B, sB, f0, sf };
}

const idx = (x: number, c: number, s: number) => {
  const w = Math.max(s, 1e-12);
  return Math.floor(((x - (c - 4 * w)) / (8 * w)) * BINS);
};

function amostrar(s: ME, p: Params, k: number): ME {
  const { op, A, sA, B, sB, f0, sf } = faixa(p);
  const r = sorteador(s.seed);
  const hA = s.hA.slice(), hB = s.hB.slice(), hF = s.hF.slice();
  let { sF, sF2 } = s;
  for (let i = 0; i < k; i++) {
    const a = A + sA * r.g();
    const b = B + sB * r.g();
    const f = funcao(op, a, b);
    sF += f;
    sF2 += f * f;
    const ia = idx(a, A, sA), ib = idx(b, B, sB), jf = idx(f, f0, sf);
    if (ia >= 0 && ia < BINS) hA[ia]!++;
    if (ib >= 0 && ib < BINS) hB[ib]!++;
    if (jf >= 0 && jf < BINS) hF[jf]!++;
  }
  return { ...s, seed: s.seed + 1, hA, hB, hF, nMC: s.nMC + k, sF, sF2 };
}

export const mcStats = (s: ME) => {
  const n = s.nMC;
  if (n < 2) return { media: 0, desvio: 0 };
  const media = s.sF / n;
  return { media, desvio: Math.sqrt(Math.max(0, (s.sF2 - n * media * media) / (n - 1))) };
};

// ------------------------------------------------------------------ dardos

const ANG_SIST = (35 * Math.PI) / 180;

function lancar(s: ME, p: Params): ME {
  const r = sorteador(s.seed);
  const b = num(p, "sistematico", 3);
  const sg = num(p, "aleatorio", 1.5);
  const x = s.mira[0] + b * Math.cos(ANG_SIST) + sg * r.g();
  const y = s.mira[1] + b * Math.sin(ANG_SIST) + sg * r.g();
  return { ...s, seed: s.seed + 1, dardos: [...s.dardos, [x, y]] };
}

export function estatDardos(s: ME) {
  const n = s.dardos.length;
  if (n === 0) return { n, cx: 0, cy: 0, vies: 0, desvio: 0, erro: 0 };
  const cx = s.dardos.reduce((a, d) => a + d[0], 0) / n;
  const cy = s.dardos.reduce((a, d) => a + d[1], 0) / n;
  // desvio padrão de cada coordenada (média das duas variâncias)
  const v = n > 1 ? s.dardos.reduce((a, d) => a + (d[0] - cx) ** 2 + (d[1] - cy) ** 2, 0) / (2 * (n - 1)) : 0;
  const desvio = Math.sqrt(v);
  return { n, cx, cy, vies: Math.hypot(cx, cy), desvio, erro: desvio / Math.sqrt(n) };
}

// ------------------------------------------------------------------ init / step

function init(p: Params): ME {
  const s: ME = {
    clock: 0,
    seed: Math.round(num(p, "amostra", 1)) * 1000,
    fase: 0,
    tArm: 0,
    tRel: 0,
    tPega: 0,
    dPego: 0,
    ts: [],
    ds: [],
    falhas: 0,
    ultT: 0,
    ultD: 0,
    xL: 15,
    xW: 7.5,
    arr: 0,
    dardos: [],
    mira: [0, 0],
    tProx: 0.3,
    hA: new Array<number>(BINS).fill(0),
    hB: new Array<number>(BINS).fill(0),
    hF: new Array<number>(BINS).fill(0),
    nMC: 0,
    sF: 0,
    sF2: 0,
  };
  return armar(s, p);
}

function step(s0: ME, p: Params, _t: number, dt: number): ME {
  let s: ME = { ...s0, clock: s0.clock + dt };
  const m = modo(p);
  if (m === 0) {
    if (s.fase === 0 && s.clock >= s.tRel) s = { ...s, fase: 1 };
    if (s.fase === 1) {
      if (virtual(p) && s.clock >= s.tPega) s = pegar(s, p, s.tPega);
      else if (queda(s.clock - s.tRel) > Lregua(p) * 1.08) s = { ...s, fase: 3, tArm: s.clock, falhas: s.falhas + 1 };
    }
    if (virtual(p) && s.fase >= 2 && s.clock - s.tArm > 0.8 && s.ts.length < 500) s = armar(s, p);
  } else if (m === 2) {
    if (s.clock >= s.tProx && s.dardos.length < num(p, "nDardos", 30)) s = { ...lancar(s, p), tProx: s.tProx + 0.3 };
  } else if (m === 3) {
    if (s.nMC < num(p, "N", 5000)) s = amostrar(s, p, 20);
  }
  return s;
}

// ------------------------------------------------------------------ desenho

function histograma(
  d: Draw,
  h: number[],
  box: { x0: number; x1: number; y0: number; y1: number },
  lo: number,
  hi: number,
  cor: string,
  rotulo: string,
  gauss?: { mu: number; sigma: number; n: number },
) {
  const { theme } = d;
  const max = Math.max(1, ...h, gauss && gauss.sigma > 0 ? (gauss.n * ((hi - lo) / h.length)) / (gauss.sigma * Math.sqrt(2 * Math.PI)) : 0);
  const w = (box.x1 - box.x0) / h.length;
  const H = box.y1 - box.y0 - 0.5;
  d.line(box.x0, box.y0, box.x1, box.y0, { color: theme.muted });
  h.forEach((c, i) => {
    if (c > 0) d.rect(box.x0 + i * w + w * 0.06, box.y0, w * 0.88, (c / max) * H, { fill: cor, alpha: 0.7 });
  });
  if (gauss && gauss.sigma > 0 && gauss.n > 0) {
    const bw = (hi - lo) / h.length;
    d.plot(
      (x) => {
        const v = lo + ((x - box.x0) / (box.x1 - box.x0)) * (hi - lo);
        const pdf = Math.exp(-0.5 * ((v - gauss.mu) / gauss.sigma) ** 2) / (gauss.sigma * Math.sqrt(2 * Math.PI));
        return box.y0 + ((gauss.n * bw * pdf) / max) * H;
      },
      box.x0,
      box.x1,
      { color: theme.text, width: 2 },
    );
  }
  d.text(rotulo, box.x0, box.y1, { align: "left", size: 12, weight: "600" });
  d.text(fmt(lo, 4), box.x0, box.y0 - 0.3, { size: 10, color: theme.muted, align: "left" });
  d.text(fmt(hi, 4), box.x1, box.y0 - 0.3, { size: 10, color: theme.muted, align: "right" });
}

function renderReacao(d: Draw, s: ME, p: Params) {
  const { theme } = d;
  const L = Lregua(p);
  const k = 4 / L;
  const fy = 4.6;
  const cair = quedaAtual(s, p);
  const y0 = fy - cair * k;
  const rx0 = 2.3, rx1 = 3.3;
  d.rect(rx0, y0, rx1 - rx0, L * k, { fill: theme.dark ? "#d8c37a" : "#f3dc8a", stroke: theme.text, width: 1.5 });
  const passo = L <= 0.5 ? 0.01 : 0.02;
  for (let x = 0; x <= L + 1e-9; x += passo) {
    const cm = Math.round(x * 100);
    const major = cm % (L <= 0.5 ? 5 : 10) === 0;
    d.line(rx0, y0 + x * k, rx0 + (major ? 0.35 : 0.18), y0 + x * k, { color: "#222", width: 1 });
    if (major) d.text(`${cm}`, rx0 + 0.55, y0 + x * k, { size: 10, color: "#222", align: "left" });
  }
  // escala de tempo impressa na régua: d = g t²/2
  for (let ms = 50; ; ms += 50) {
    const x = queda(ms / 1000);
    if (x > L) break;
    d.line(rx1 - 0.25, y0 + x * k, rx1, y0 + x * k, { color: theme.accent, width: 1.5 });
    d.text(`${ms} ms`, rx1 + 0.1, y0 + x * k, { size: 10, color: theme.accent, align: "left" });
  }
  d.text("cm", rx0 + 0.5, y0 + L * k + 0.25, { size: 10, color: theme.muted });
  // dedos (polegar e indicador)
  const fechado = s.fase === 2;
  const gap = fechado ? 0 : 0.35;
  d.circle(rx0 - 0.3 - gap, fy, 0.3, { fill: theme.dark ? "#c99a7a" : "#e8b896", stroke: theme.text, width: 1 });
  d.circle(rx1 + 0.3 + gap, fy, 0.3, { fill: theme.dark ? "#c99a7a" : "#e8b896", stroke: theme.text, width: 1 });
  d.line(rx0 - 1.4, fy, rx1 + 1.4, fy, { color: theme.muted, dash: [3, 3] });
  d.text("0", rx1 + 1.6, fy, { size: 10, color: theme.muted, align: "left" });

  // mensagem
  let msg = "";
  if (s.fase === 0) msg = virtual(p) ? "Aluno virtual aguardando a régua…" : "Prepare-se: clique (ou toque) no palco assim que a régua cair";
  else if (s.fase === 1) msg = "CAINDO! Clique!";
  else if (s.fase === 2) {
    const dl = s.ds[s.ds.length - 1] ?? 0;
    const t = s.ts[s.ts.length - 1] ?? 0;
    msg = `Pegou em d = ${fmt(dl * 100, 4)} cm  →  t = √(2d/g) = ${fmt(t, 3)} s${virtual(p) ? "" : "   (clique para nova tentativa)"}`;
  } else if (s.fase === 3) msg = `A régua passou dos dedos (mais de ${fmt(L * 100)} cm): tentativa perdida`;
  else msg = "Queimou a largada: você fechou os dedos antes de a régua cair (clique para tentar de novo)";
  d.text(msg, 0.3, 9.2, { align: "left", size: 13, weight: "600", color: s.fase === 1 ? theme.positive : theme.text });

  // histograma
  const st = estatistica(s.ts);
  const box = { x0: 6, x1: 15.6, y0: 0.8, y1: 6.6 };
  const h = new Array<number>(30).fill(0);
  for (const t of s.ts) {
    const i = Math.floor((t - 0.05) / 0.01);
    if (i >= 0 && i < 30) h[i]!++;
  }
  histograma(d, h, box, 0.05, 0.35, theme.series[1] ?? theme.accent, "Histograma dos tempos (classes de 10 ms)", st.n > 2 ? { mu: st.media, sigma: st.desvio, n: st.n } : undefined);
  for (let t = 0.1; t <= 0.31; t += 0.05) d.text(`${fmt(t, 2)}`, box.x0 + ((t - 0.05) / 0.3) * (box.x1 - box.x0), box.y0 - 0.3, { size: 10, color: theme.muted });
  if (st.n > 0) {
    const xm = box.x0 + ((st.media - 0.05) / 0.3) * (box.x1 - box.x0);
    if (xm > box.x0 && xm < box.x1) d.line(xm, box.y0, xm, box.y1 - 0.4, { color: theme.positive, width: 2, dash: [5, 3] });
  }
  d.text("t (s)", box.x1, box.y0 - 0.65, { size: 10, color: theme.muted, align: "right" });
  const lin = [
    `Tentativas válidas: ${st.n}   (perdidas: ${s.falhas})`,
    `Média: t̄ = ${fmt(st.media, 3)} s     Desvio padrão: σ = ${fmt(st.desvio, 2)} s`,
    `Incerteza da média: σ/√n = ${fmt(st.erroMedia, 2)} s   →   t = (${fmt(st.media, 3)} ± ${fmt(st.erroMedia, 1)}) s`,
  ];
  lin.forEach((l, i) => d.text(l, 6, 8.4 - 0.5 * i, { align: "left", size: 12 }));
  d.text(`leitura da régua: menor divisão ${fmt(res(p) * 100)} cm`, 0.3, 0.2, { align: "left", size: 10, color: theme.muted });
}

function renderAS(d: Draw, s: ME, p: Params) {
  const { theme } = d;
  const { L, W } = cartao(p);
  const dv = div(p);
  d.rect(0, 0, L, W, { fill: theme.series[5] ?? theme.accent, alpha: 0.35, stroke: theme.text, width: 1.5 });
  d.text("cartão", L / 2, W / 2, { size: 12, color: theme.muted });
  const regua = (horizontal: boolean) => {
    const len = horizontal ? 15.4 : 8.4;
    if (horizontal) d.rect(0, -1.3, len, 1.2, { fill: theme.dark ? "#d8c37a" : "#f3dc8a", stroke: theme.text, width: 1 });
    else d.rect(-1.3, 0, 1.2, len, { fill: theme.dark ? "#d8c37a" : "#f3dc8a", stroke: theme.text, width: 1 });
    const n = Math.round(len / dv);
    for (let i = 0; i <= n; i++) {
      const x = i * dv;
      const cm = Math.abs(x - Math.round(x)) < 1e-6;
      const meio = !cm && Math.abs(x * 2 - Math.round(x * 2)) < 1e-6;
      const h = cm ? 0.55 : meio ? 0.38 : 0.22;
      if (horizontal) d.line(x, -0.1, x, -0.1 - h, { color: "#222", width: cm ? 1.2 : 0.8 });
      else d.line(-0.1, x, -0.1 - h, x, { color: "#222", width: cm ? 1.2 : 0.8 });
      if (cm && Math.round(x) % (horizontal ? 1 : 1) === 0) {
        if (horizontal) d.text(`${Math.round(x)}`, x, -1.0, { size: 10, color: "#222" });
        else d.text(`${Math.round(x)}`, -1.0, x, { size: 10, color: "#222" });
      }
    }
  };
  regua(true);
  regua(false);
  // marcadores
  d.line(s.xL, -1.4, s.xL, 8.2, { color: theme.positive, width: 1.5 });
  d.circle(s.xL, 8.4, 0.25, { fill: theme.positive });
  d.text("L", s.xL, 8.9, { size: 12, weight: "700", color: theme.positive });
  d.line(-1.4, s.xW, 15.6, s.xW, { color: theme.accent, width: 1.5 });
  d.circle(15.8, s.xW, 0.25, { fill: theme.accent });
  d.text("W", 16.3, s.xW, { size: 12, weight: "700", color: theme.accent });

  const o = operacoes(s.xL, s.xW, dv);
  const c = casasLeitura(dv);
  const inc = fmt(dv / 2, 2);
  const lin = [
    `L = ${o.L} cm  (${o.asL} AS, incerteza ± ${inc} cm)      W = ${o.W} cm  (${o.asW} AS)`,
    `Área: L·W = ${o.areaBruta.toFixed(2 * c).replace(".", ",")} cm² (calculadora)  →  ${o.area} cm² (produto: fica o menor nº de AS = ${Math.min(o.asL, o.asW)})`,
    `Perímetro: 2(L + W) = ${o.perimetro} cm (soma: fica o menor nº de casas decimais = ${c})`,
  ];
  if (Math.round(num(p, "mostrar")) === 1) lin.push(`Valores verdadeiros: L = ${fmt(L, 5)} cm, W = ${fmt(W, 5)} cm`);
  else lin.push("Arraste as linhas L e W até as bordas do cartão. Leia até a menor divisão e estime mais um algarismo.");
  lin.forEach((l, i) => d.text(l, -2.3, -2.1 - 0.75 * i, { align: "left", size: 12, color: i === 3 ? theme.muted : theme.text }));
}

function renderDardos(d: Draw, s: ME, p: Params) {
  const { theme } = d;
  for (let r = 10; r >= 2; r -= 2) d.circle(0, 0, r, { fill: (r / 2) % 2 === 0 ? (theme.dark ? "#3a4250" : "#e8ecf1") : theme.dark ? "#2a303a" : "#ffffff", stroke: theme.muted, width: 1 });
  d.circle(0, 0, 0.6, { fill: theme.positive });
  for (const [x, y] of s.dardos) d.dot(x, y, 4, theme.text, 0.85);
  // mira (arrastável)
  const [mx, my] = s.mira;
  d.circle(mx, my, 0.8, { stroke: theme.series[2] ?? theme.accent, width: 2 });
  d.line(mx - 1.3, my, mx + 1.3, my, { color: theme.series[2] ?? theme.accent, width: 2 });
  d.line(mx, my - 1.3, mx, my + 1.3, { color: theme.series[2] ?? theme.accent, width: 2 });
  d.text("mira", mx + 1.5, my + 1, { size: 11, color: theme.series[2] ?? theme.accent, align: "left" });
  const e = estatDardos(s);
  if (e.n > 0) {
    d.arrow(0, 0, e.cx, e.cy, { color: theme.positive, width: 2.5 });
    d.circle(e.cx, e.cy, e.desvio, { stroke: theme.accent, width: 2, dash: [6, 4] });
    d.line(e.cx - 0.8, e.cy, e.cx + 0.8, e.cy, { color: theme.accent, width: 3 });
    d.line(e.cx, e.cy - 0.8, e.cx, e.cy + 0.8, { color: theme.accent, width: 3 });
  }
  const exato = e.vies < Math.max(1, 2 * e.erro);
  const preciso = e.desvio < 1.5;
  const lin = [
    `Dardos: ${e.n}`,
    `Centroide: (${fmt(e.cx, 2)}; ${fmt(e.cy, 2)}) cm`,
    `Erro sistemático (viés): ${fmt(e.vies, 2)} cm`,
    `Dispersão (aleatório): σ = ${fmt(e.desvio, 2)} cm`,
    `Incerteza do centroide: σ/√n = ${fmt(e.erro, 2)} cm`,
    "",
    e.n < 3 ? "Aguarde mais dardos…" : `${exato ? "Exato" : "Inexato"} e ${preciso ? "preciso" : "impreciso"}`,
    "",
    "Seta vermelha: erro sistemático",
    "Círculo tracejado: raio σ",
    "Arraste a mira para compensar o viés.",
  ];
  lin.forEach((l, i) => d.text(l, 12.5, 10.5 - 1.1 * i, { align: "left", size: i === 6 ? 14 : 12, weight: i === 6 ? "700" : "400", color: i >= 8 ? theme.muted : theme.text }));
}

function renderProp(d: Draw, s: ME, p: Params) {
  const { theme } = d;
  const { op, A, sA, B, sB, f0, sf } = faixa(p);
  const n = s.nMC;
  const usaB = op !== 4;
  histograma(d, s.hA, { x0: 0.5, x1: 7.3, y0: 6, y1: 9.4 }, A - 4 * sA, A + 4 * sA, theme.series[0] ?? theme.accent, `A = ${fmt(A, 4)} ± ${fmt(sA, 2)}`, { mu: A, sigma: sA, n });
  if (usaB) histograma(d, s.hB, { x0: 0.5, x1: 7.3, y0: 1.2, y1: 4.6 }, B - 4 * sB, B + 4 * sB, theme.series[1] ?? theme.accent, `B = ${fmt(B, 4)} ± ${fmt(sB, 2)}`, { mu: B, sigma: sB, n });
  histograma(d, s.hF, { x0: 8.5, x1: 15.6, y0: 1.2, y1: 7.6 }, f0 - 4 * sf, f0 + 4 * sf, theme.series[2] ?? theme.accent, OPERACOES[op]!.label, { mu: f0, sigma: sf, n });
  const mc = mcStats(s);
  const lin = [
    `Monte Carlo (${n} sorteios): f̄ = ${fmt(mc.media, 5)}   σ_f = ${fmt(mc.desvio, 3)}`,
    `Propagação linear: f = ${fmt(f0, 5)}   σ_f = ${fmt(sf, 3)}`,
    `Resultado: f = ${comAS(f0, Math.max(1, Math.floor(Math.log10(Math.abs(f0) || 1)) - Math.floor(Math.log10(sf || 1)) + 2))} ± ${comAS(sf, 2)}`,
  ];
  lin.forEach((l, i) => d.text(l, 8.5, 9.4 - 0.5 * i, { align: "left", size: 12, weight: i === 2 ? "600" : "400" }));
  d.text("curva: gaussiana prevista pela propagação; barras: sorteios", 8.5, 0.5, { align: "left", size: 10, color: theme.muted });
}

// ------------------------------------------------------------------ ponteiro

function perto(a: number, b: number, tol: number) {
  return Math.abs(a - b) < tol;
}

export const medidasErros = defineSim<ME>({
  id: "medidas-erros",
  title: "Tempo de reação, algarismos significativos e erros",
  course: "FG I",
  topic: "Medidas",
  priority: "P2",
  summary:
    "Pegue a régua em queda e meça seu tempo de reação (t = √(2d/g)) com histograma e estatística; meça um cartão com réguas de resoluções diferentes aplicando as regras dos algarismos significativos; compare erros sistemáticos e aleatórios num alvo; propague incertezas e confira com Monte Carlo.",
  equations: [
    String.raw`d = \tfrac12 g t^2 \;\Rightarrow\; t = \sqrt{\frac{2d}{g}}`,
    String.raw`\bar x = \frac1n\sum x_i \qquad \sigma = \sqrt{\frac{\sum (x_i-\bar x)^2}{n-1}} \qquad \sigma_{\bar x} = \frac{\sigma}{\sqrt n}`,
    String.raw`\sigma_f^2 = \left(\frac{\partial f}{\partial A}\right)^2\sigma_A^2 + \left(\frac{\partial f}{\partial B}\right)^2\sigma_B^2 \qquad \frac{\sigma_{AB}}{AB} = \sqrt{\left(\frac{\sigma_A}{A}\right)^2 + \left(\frac{\sigma_B}{B}\right)^2}`,
  ],
  liveEquations(s, p) {
    const m = modo(p);
    if (m === 0) {
      const d = s.ds[s.ds.length - 1] ?? 0;
      const st = estatistica(s.ts);
      return [
        String.raw`t = \sqrt{\frac{2 \times ${texNum(d)}\ \text{m}}{9{,}81\ \text{m/s}^2}} = ${texNum(tempoDeQueda(d))}\ \text{s}`,
        String.raw`\bar t = ${texNum(st.media)}\ \text{s} \qquad \sigma = ${texNum(st.desvio, 2)}\ \text{s} \qquad \sigma_{\bar t} = ${texNum(st.erroMedia, 2)}\ \text{s}\ (n = ${st.n})`,
      ];
    }
    if (m === 1) {
      const o = operacoes(s.xL, s.xW, div(p));
      return [String.raw`A = ${o.L.replace(",", "{,}")} \times ${o.W.replace(",", "{,}")} = ${texNum(o.areaBruta, 6)} \approx ${o.area.replace(",", "{,}").replace(" × 10^", "\\times 10^")}\ \text{cm}^2`];
    }
    if (m === 2) {
      const e = estatDardos(s);
      return [String.raw`\text{viés} = ${texNum(e.vies)}\ \text{cm} \qquad \sigma = ${texNum(e.desvio)}\ \text{cm} \qquad \sigma/\sqrt{n} = ${texNum(e.erro)}\ \text{cm}`];
    }
    const { f0, sf } = faixa(p);
    const mc = mcStats(s);
    return [String.raw`f = ${texNum(f0, 5)} \pm ${texNum(sf, 2)}\ \text{(propagação)} \qquad \sigma_{MC} = ${texNum(mc.desvio, 3)}\ (n = ${s.nMC})`];
  },

  params: [
    {
      key: "modo",
      label: "Modo",
      unit: "",
      min: 0,
      max: 3,
      step: 1,
      default: 0,
      options: [
        { value: 0, label: "Tempo de reação (régua em queda)" },
        { value: 1, label: "Algarismos significativos (medir o cartão)" },
        { value: 2, label: "Erros sistemático × aleatório (alvo)" },
        { value: 3, label: "Propagação de incertezas (Monte Carlo)" },
      ],
    },
    {
      key: "quem",
      label: "Quem pega a régua",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 0,
      options: [
        { value: 0, label: "Você (clique quando cair)" },
        { value: 1, label: "Aluno virtual (repetições automáticas)" },
      ],
    },
    { key: "tReacao", label: "Tempo de reação médio do aluno virtual", unit: "s", min: 0.1, max: 0.3, step: 0.005, default: 0.2, live: true },
    { key: "sigReacao", label: "Variação do aluno virtual (σ)", unit: "s", min: 0, max: 0.06, step: 0.005, default: 0.025, live: true },
    {
      key: "Lregua",
      label: "Comprimento da régua",
      unit: "m",
      min: 0.3,
      max: 1,
      step: 0.1,
      default: 0.5,
      options: [
        { value: 0.3, label: "30 cm" },
        { value: 0.5, label: "50 cm" },
        { value: 1, label: "1 m" },
      ],
    },
    {
      key: "resolucao",
      label: "Leitura da régua em queda",
      unit: "m",
      min: 0.001,
      max: 0.01,
      step: 0.001,
      default: 0.001,
      options: [
        { value: 0.01, label: "até o centímetro" },
        { value: 0.005, label: "até 5 mm" },
        { value: 0.001, label: "até o milímetro" },
      ],
    },
    { key: "regua", label: "Régua para medir o cartão", unit: "", min: 0, max: 2, step: 1, default: 2, live: true, options: REGUAS },
    { key: "amostra", label: "Amostra (cartão e sorteios)", unit: "", min: 1, max: 30, step: 1, default: 1 },
    {
      key: "mostrar",
      label: "Valores verdadeiros do cartão",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 0,
      live: true,
      options: [
        { value: 0, label: "Ocultos" },
        { value: 1, label: "Mostrar" },
      ],
    },
    { key: "sistematico", label: "Erro sistemático do lançador", unit: "cm", min: 0, max: 6, step: 0.1, default: 3, live: true },
    { key: "aleatorio", label: "Erro aleatório do lançador (σ)", unit: "cm", min: 0.2, max: 5, step: 0.1, default: 1.5, live: true },
    { key: "nDardos", label: "Número de dardos", unit: "", min: 5, max: 200, step: 5, default: 30, live: true },
    { key: "op", label: "Operação", unit: "", min: 0, max: 5, step: 1, default: 2, options: OPERACOES },
    { key: "A", label: "A (valor medido)", unit: "", min: 0.1, max: 100, step: 0.1, default: 10 },
    { key: "sA", label: "Incerteza σ_A", unit: "", min: 0.001, max: 5, step: 0.001, default: 0.2 },
    { key: "B", label: "B (valor medido)", unit: "", min: 0.1, max: 100, step: 0.1, default: 5 },
    { key: "sB", label: "Incerteza σ_B", unit: "", min: 0.001, max: 5, step: 0.001, default: 0.1 },
    { key: "N", label: "Sorteios de Monte Carlo", unit: "", min: 100, max: 50000, step: 100, default: 10000, log: true },
  ],

  observables: [
    { key: "queda", label: "Queda da régua", unit: "cm", value: (s, p) => (modo(p) === 0 ? quedaAtual(s, p) * 100 : 0) },
    { key: "n", label: "Número de tentativas / dardos / sorteios", unit: "", value: (s, p) => [s.ts.length, 0, s.dardos.length, s.nMC][modo(p)] ?? 0 },
    { key: "tr", label: "Último tempo de reação", unit: "s", value: (s) => s.ts[s.ts.length - 1] ?? 0 },
    { key: "dr", label: "Última distância lida na régua", unit: "cm", value: (s) => (s.ds[s.ds.length - 1] ?? 0) * 100 },
    { key: "tq", label: "Tempo de queda (cronômetro da sim)", unit: "s", value: (s) => s.ultT },
    { key: "dq", label: "Queda até a pegada", unit: "m", value: (s) => s.ultD },
    { key: "trMed", label: "Tempo de reação médio", unit: "s", value: (s) => estatistica(s.ts).media },
    { key: "trDesv", label: "Desvio padrão do tempo de reação", unit: "s", value: (s) => estatistica(s.ts).desvio },
    { key: "trErr", label: "Incerteza da média (σ/√n)", unit: "s", value: (s) => estatistica(s.ts).erroMedia },
    { key: "L", label: "Leitura do comprimento L", unit: "cm", value: (s, p) => Number(operacoes(s.xL, s.xW, div(p)).L.replace(",", ".")) },
    { key: "W", label: "Leitura da largura W", unit: "cm", value: (s, p) => Number(operacoes(s.xL, s.xW, div(p)).W.replace(",", ".")) },
    { key: "erroL", label: "Leitura − valor verdadeiro de L", unit: "cm", value: (s, p) => Number(operacoes(s.xL, s.xW, div(p)).L.replace(",", ".")) - cartao(p).L },
    { key: "vies", label: "Erro sistemático (viés do centroide)", unit: "cm", value: (s) => estatDardos(s).vies },
    { key: "disp", label: "Dispersão dos dardos (σ)", unit: "cm", value: (s) => estatDardos(s).desvio },
    { key: "fMed", label: "Média de f (Monte Carlo)", unit: "", value: (s) => mcStats(s).media },
    { key: "sMC", label: "σ_f (Monte Carlo)", unit: "", value: (s) => mcStats(s).desvio },
    { key: "sProp", label: "σ_f (propagação linear)", unit: "", value: (_s, p) => faixa(p).sf },
  ],
  chart: { x: "t", y: "queda" },

  scenarios: [
    {
      id: "reacao",
      label: "Seu tempo de reação",
      params: { modo: 0, quem: 0, Lregua: 0.5, resolucao: 0.001 },
      guide: `### Régua em queda
1. Rode a simulação. A régua é solta num instante sorteado entre 1 e 3 s: clique no palco assim que ela começar a cair.
2. A distância percorrida até você fechar os dedos dá o tempo: $t = \\sqrt{2d/g}$. Repare na escala em **ms** impressa na própria régua.
3. Faça pelo menos 20 tentativas. Leia a média, o desvio padrão $\\sigma$ e a incerteza da média $\\sigma/\\sqrt n$.
4. Por que o histograma não é uma barra só? Que fatores tornam o resultado de cada tentativa diferente?`,
      predict: [
        {
          question: "Se a régua caiu 20 cm antes de ser pega, o tempo de reação foi de aproximadamente:",
          options: ["0,04 s", "0,20 s", "0,45 s", "2 s"],
          answer: 1,
          explanation: "$t = \\sqrt{2 \\times 0{,}20 / 9{,}81} \\approx 0{,}20$ s. A distância cresce com o quadrado do tempo, por isso a escala de ms na régua não é uniforme.",
        },
      ],
    },
    {
      id: "virtual",
      label: "Muitas repetições (aluno virtual)",
      params: { modo: 0, quem: 1, tReacao: 0.2, sigReacao: 0.025, resolucao: 0.01 },
      guide: `### Estatística das medidas
1. O aluno virtual repete a experiência sozinho. Acompanhe o histograma tomando a forma de uma gaussiana.
2. Note que o desvio padrão $\\sigma$ se estabiliza, mas a incerteza da média $\\sigma/\\sqrt n$ continua caindo.
3. Troque a leitura para **até o milímetro**: com leitura grosseira (cm), os tempos ficam "presos" em poucos valores.`,
      predict: [
        {
          question: "Ao passar de 25 para 100 tentativas, a incerteza da média:",
          options: ["não muda", "cai pela metade", "cai para um quarto"],
          answer: 1,
          explanation: "$\\sigma_{\\bar t} = \\sigma/\\sqrt n$: quadruplicar $n$ divide a incerteza por $\\sqrt 4 = 2$. O desvio $\\sigma$ de cada medida não diminui.",
        },
      ],
    },
    {
      id: "algarismos",
      label: "Algarismos significativos",
      params: { modo: 1, regua: 0, amostra: 3 },
      guide: `### Quantos algarismos escrever?
1. Arraste as linhas **L** e **W** até as bordas do cartão. Com a régua de 1 cm, a leitura tem um algarismo duvidoso (décimos de cm).
2. Veja a área calculada: a calculadora dá muitos dígitos, mas o resultado só pode ter o número de AS do fator **menos** preciso.
3. No perímetro (uma soma) a regra é outra: vale o menor número de casas decimais.
4. Troque para a régua milimetrada (sem reiniciar) e compare o número de AS de cada leitura.`,
    },
    {
      id: "dardos",
      label: "Exatidão × precisão",
      params: { modo: 2, sistematico: 4, aleatorio: 1, nDardos: 40 },
      guide: `### Alvo e dardos
1. O lançador tem um erro sistemático (desvio fixo, numa direção) e um aleatório (espalhamento). Rode e observe.
2. O centroide fica longe do centro: **preciso, mas inexato**. Repetir mais vezes não corrige o viés!
3. Arraste a mira para o lado oposto ao viés (calibração) e lance de novo.
4. Agora zere o erro sistemático e aumente o aleatório: **exato, mas impreciso**. Com $n$ grande, o centroide se aproxima do centro como $\\sigma/\\sqrt n$.`,
      predict: [
        {
          question: "Com um erro sistemático de 4 cm, lançar muito mais dardos faz o centroide:",
          options: ["chegar ao centro do alvo", "continuar a cerca de 4 cm do centro", "se afastar ainda mais"],
          answer: 1,
          explanation: "A média elimina erros aleatórios, não os sistemáticos: o centroide converge para mira + viés.",
        },
      ],
    },
    {
      id: "pendulo",
      label: "Propagação: g do pêndulo",
      params: { modo: 3, op: 5, A: 1, sA: 0.005, B: 2.006, sB: 0.01, N: 20000 },
      guide: `### Propagação de incertezas
1. Medimos $L = (1{,}000 \\pm 0{,}005)$ m e $T = (2{,}006 \\pm 0{,}010)$ s e calculamos $g = 4\\pi^2 L/T^2$.
2. Pela propagação: $\\sigma_g/g = \\sqrt{(\\sigma_L/L)^2 + (2\\sigma_T/T)^2}$. Qual termo domina?
3. Rode: o Monte Carlo sorteia $L$ e $T$ e calcula $g$ milhares de vezes. Compare o $\\sigma$ dos sorteios com a fórmula.
4. Aumente $\\sigma_B$ até 20 % de $B$ no quociente: a distribuição de $f$ fica assimétrica e a propagação linear deixa de valer.`,
    },
  ],

  exercises: [
    {
      id: "reacao",
      prompt: "Uma régua solta do repouso é pega depois de cair {d} cm. Qual o tempo de reação de quem a pegou? (g = 9,81 m/s²)",
      vary: { d: [5, 30, 1] },
      fixed: { modo: 0 },
      answer: { label: "t", unit: "s", compute: (p) => tempoDeQueda(num(p, "d") / 100) },
    },
    {
      id: "produto",
      prompt: "Mediu-se A = {A} ± {sA} cm e B = {B} ± {sB} cm. Qual a incerteza da área A·B (em cm²), por propagação?",
      vary: { A: [5, 30, 1], sA: [0.05, 0.5, 2], B: [2, 10, 1], sB: [0.05, 0.3, 2] },
      fixed: { modo: 3, op: 2 },
      answer: { label: "σ", unit: "cm²", compute: (p) => sigmaPropagada(2, num(p, "A"), num(p, "sA"), num(p, "B"), num(p, "sB")) },
      tolerance: 0.03,
    },
  ],

  init,
  step,
  dt: 0.002,
  sampleEvery: 10,
  maxSamples: 3000,

  pointer: {
    down(s, p, pt) {
      const m = modo(p);
      if (m === 0) {
        if (virtual(p)) return undefined;
        if (s.fase === 0) return { ...s, fase: 4, tArm: s.clock, falhas: s.falhas + 1 };
        if (s.fase === 1) return pegar(s, p, s.clock);
        return armar(s, p);
      }
      if (m === 1) {
        if (perto(pt.x, s.xL, 0.5) && pt.y > -1.5) return { ...s, arr: 1 };
        if (perto(pt.y, s.xW, 0.5) && pt.x > -1.5) return { ...s, arr: 2 };
        return undefined;
      }
      if (m === 2 && Math.hypot(pt.x - s.mira[0], pt.y - s.mira[1]) < 2) return { ...s, arr: 3 };
      return undefined;
    },
    move(s, _p, pt, dragging) {
      if (!dragging || s.arr === 0) return undefined;
      if (s.arr === 1) return { ...s, xL: clamp(pt.x, 0, 15.4) };
      if (s.arr === 2) return { ...s, xW: clamp(pt.y, 0, 8.4) };
      return { ...s, mira: [clamp(pt.x, -10, 10), clamp(pt.y, -10, 10)] };
    },
    up: (s) => (s.arr ? { ...s, arr: 0 } : undefined),
    cursor(s, p, pt) {
      const m = modo(p);
      if (m === 0) return virtual(p) ? undefined : "pointer";
      if (m === 1) return perto(pt.x, s.xL, 0.5) ? "ew-resize" : perto(pt.y, s.xW, 0.5) ? "ns-resize" : undefined;
      if (m === 2) return Math.hypot(pt.x - s.mira[0], pt.y - s.mira[1]) < 2 ? "grab" : undefined;
      return undefined;
    },
  },
  actions: [
    { id: "limpar", label: "Limpar dados", run: (s, p) => ({ ...init(p), seed: s.seed + 7, xL: s.xL, xW: s.xW, mira: s.mira, clock: s.clock, tProx: s.clock + 0.3 }) },
    {
      id: "rajada",
      label: "Aluno virtual: +20 tentativas",
      run: (s, p) => {
        let x = s;
        const r = sorteador(s.seed + 99991);
        const ts = s.ts.slice(), ds = s.ds.slice();
        for (let i = 0; i < 20; i++) {
          const tr = Math.max(0.08, num(p, "tReacao", 0.2) + num(p, "sigReacao", 0.025) * r.g());
          const dd = queda(tr);
          if (dd > Lregua(p)) continue;
          const lido = lerRegua(dd, res(p));
          ts.push(tempoDeQueda(lido));
          ds.push(lido);
        }
        x = { ...x, ts, ds, seed: s.seed + 1 };
        return x;
      },
    },
    { id: "centro", label: "Mira no centro", run: (s) => ({ ...s, mira: [0, 0] }) },
  ],

  narrowSplit: () => 0.342,
  viewport(p) {
    const m = modo(p);
    if (m === 1) return { xMin: -2.5, xMax: 16.8, yMin: -5.4, yMax: 9.3 };
    if (m === 2) return { xMin: -12, xMax: 27, yMin: -11, yMax: 11.5 };
    return { xMin: 0, xMax: 16, yMin: -0.2, yMax: 9.6 };
  },

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const { state: s, params: p } = frame;
    const m = modo(p);
    if (m === 0) renderReacao(d, s, p);
    else if (m === 1) renderAS(d, s, p);
    else if (m === 2) renderDardos(d, s, p);
    else renderProp(d, s, p);
  },
});

export default medidasErros;
