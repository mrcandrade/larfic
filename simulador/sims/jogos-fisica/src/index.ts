import { clamp, defineSim, draw, formatBR, num, texNum, type Draw, type Params } from "@fisilab/core";
import {
  CAMPO,
  DISCO,
  FASES_HOQUEI,
  LABIRINTOS,
  MODULO,
  MUNDO_L,
  PISTAS,
  PLANETAS,
  POUSO,
  RAIO_PART,
  achar,
  bateu,
  celula,
  dentro,
  derivModulo,
  distFrenagem,
  forcaEletrica,
  jogo,
  nivelDe,
  piloto,
  potencial,
  terreno,
  type Carga,
  type Modulo,
} from "./physics.ts";

export * from "./physics.ts";

export interface JF {
  /** 0 jogando, 1 venceu, 2 perdeu. */
  status: number;
  msg: string;
  pontos: number;
  /** Tempo de jogo (s) desde o lançamento/início. */
  tj: number;
  // hóquei
  cargas: Carga[];
  d: [number, number, number, number];
  lancado: boolean;
  arr: number;
  rastro: [number, number][];
  // módulo lunar
  L: Modulo;
  motor: boolean;
  mira: number;
  /** Empuxo aplicado no último passo (N). */
  T: number;
  // labirinto
  pos: [number, number];
  vel: [number, number];
  acel: [number, number];
  ctrl: [number, number];
  colisoes: number;
  hist: number[][];
}

const fmt = (v: number, d = 3) => formatBR(v, d);
const faseH = (p: Params) => FASES_HOQUEI[clamp(nivelDe(p), 0, FASES_HOQUEI.length - 1)]!;
const nivelL = (p: Params) => clamp(nivelDe(p), 0, PISTAS.length - 1);
const nivelM = (p: Params) => clamp(nivelDe(p), 0, LABIRINTOS.length - 1);
const Qdisco = (p: Params) => num(p, "Qdisco", 20);
const gPlaneta = (p: Params) => num(p, "g", 1.62);
const Tmax = (p: Params) => num(p, "Tmax", 5) * 1000;
const modoLab = (p: Params) => Math.round(num(p, "controle"));
const autopiloto = (p: Params) => Math.round(num(p, "piloto")) === 1;

const VMAX = 3;
const AMAX = 3;
const PAD = { cx: 13.4, cy: 7.5, r: 2.1 };

// ------------------------------------------------------------------ estado inicial

function moduloInicial(p: Params): Modulo {
  return { x: num(p, "x0", 60), y: 220, vx: num(p, "vx0", 6), vy: 0, ang: 0, comb: num(p, "comb", 400) };
}

function init(p: Params): JF {
  const [sx, sy] = achar(nivelM(p), "S");
  const preset: Carga[] =
    Math.round(num(p, "exemplo")) === 1 && nivelDe(p) === 0 ? [{ x: 0.05, y: 0.5, q: num(p, "qPeca", 50) }] : [];
  return {
    status: 0,
    msg: "",
    pontos: 0,
    tj: 0,
    cargas: preset,
    d: [DISCO.x0, DISCO.y0, 0, 0],
    lancado: Math.round(num(p, "exemplo")) === 1,
    arr: -1,
    rastro: [],
    L: moduloInicial(p),
    motor: false,
    mira: 0,
    T: 0,
    pos: [sx, sy],
    vel: [0, 0],
    acel: [0, 0],
    ctrl: modoLab(p) === 0 ? [(sx - 5) / 5, (sy - 5) / 5] : [0, 0],
    colisoes: 0,
    hist: [],
  };
}

// ------------------------------------------------------------------ passos

function passoHoquei(s: JF, p: Params, dt: number): JF {
  if (!s.lancado || s.status !== 0) return s;
  const Q = Qdisco(p);
  const f = (y: number[]) => {
    const [fx, fy] = forcaEletrica(s.cargas, Q, y[0]!, y[1]!);
    return [y[2]!, y[3]!, fx / DISCO.m, fy / DISCO.m];
  };
  const y0 = s.d as number[];
  const k1 = f(y0);
  const k2 = f(y0.map((v, i) => v + 0.5 * dt * k1[i]!));
  const k3 = f(y0.map((v, i) => v + 0.5 * dt * k2[i]!));
  const k4 = f(y0.map((v, i) => v + dt * k3[i]!));
  const d = y0.map((v, i) => v + (dt / 6) * (k1[i]! + 2 * k2[i]! + 2 * k3[i]! + k4[i]!)) as JF["d"];
  const tj = s.tj + dt;
  const ult = s.rastro[s.rastro.length - 1];
  const rastro = !ult || Math.hypot(d[0] - ult[0], d[1] - ult[1]) > 0.008 ? [...s.rastro, [d[0], d[1]] as [number, number]].slice(-600) : s.rastro;
  const fase = faseH(p);
  if (dentro(fase.gol, d[0], d[1])) {
    const pontos = Math.max(100, Math.round(1000 - 100 * s.cargas.length - 20 * tj));
    return { ...s, d, tj, rastro, status: 1, pontos, msg: `GOL! ${s.cargas.length} carga(s), ${fmt(tj, 3)} s` };
  }
  if (fase.obst.some((o) => dentro(o, d[0], d[1], DISCO.raio))) return { ...s, d, tj, rastro, status: 2, msg: "O disco bateu num obstáculo." };
  if (d[0] < 0 || d[0] > CAMPO.w || d[1] < 0 || d[1] > CAMPO.h) return { ...s, d, tj, rastro, status: 2, msg: "O disco saiu do campo." };
  if (tj > 30) return { ...s, d, tj, rastro, status: 2, msg: "Tempo esgotado (30 s)." };
  return { ...s, d, tj, rastro };
}

function passoLunar(s: JF, p: Params, dt: number): JF {
  if (s.status !== 0) return s;
  const g = gPlaneta(p);
  const nivel = nivelL(p);
  let T = 0;
  let angAlvo = s.L.ang;
  if (autopiloto(p)) {
    const c = piloto(s.L, nivel, g, Tmax(p));
    T = c.T;
    angAlvo = c.ang;
  } else if (s.motor) {
    T = (num(p, "acelerador", 100) / 100) * Tmax(p);
    angAlvo = clamp((s.mira - s.L.x) / 80, -0.6, 0.6);
  }
  const ang = s.L.ang + clamp(angAlvo - s.L.ang, -1.2 * dt, 1.2 * dt);
  const L0: Modulo = { ...s.L, ang };
  if (L0.comb <= 0) T = 0;
  const { ax, ay, dm } = derivModulo(L0, T, g);
  const L: Modulo = {
    x: L0.x + L0.vx * dt + 0.5 * ax * dt * dt,
    y: L0.y + L0.vy * dt + 0.5 * ay * dt * dt,
    vx: L0.vx + ax * dt,
    vy: L0.vy + ay * dt,
    ang,
    comb: Math.max(0, L0.comb + dm * dt),
  };
  const tj = s.tj + dt;
  if (L.x < 0 || L.x > MUNDO_L.w || L.y > MUNDO_L.h + 100) return { ...s, L, T, tj, status: 2, msg: "Você saiu da área de pouso." };
  const meia = MODULO.largura / 2;
  const solo = Math.max(terreno(L.x - meia, nivel), terreno(L.x, nivel), terreno(L.x + meia, nivel));
  if (L.y <= solo) {
    const pista = PISTAS[nivel]!;
    const naPista = L.x - meia >= pista.x0 && L.x + meia <= pista.x1;
    const suave = Math.abs(L.vy) <= POUSO.vy && Math.abs(L.vx) <= POUSO.vx && Math.abs(L.ang) <= POUSO.ang;
    const Lp = { ...L, y: solo };
    if (naPista && suave) {
      const pontos = Math.round(50 + (50 * L.comb) / Math.max(1, num(p, "comb", 400)) + 25 * (1 - Math.abs(L.vy) / POUSO.vy));
      return { ...s, L: Lp, T: 0, tj, status: 1, pontos, msg: `Pouso perfeito! v = ${fmt(Math.abs(L.vy), 2)} m/s` };
    }
    const motivo = !naPista ? "fora da pista" : Math.abs(L.vy) > POUSO.vy ? `rápido demais (${fmt(Math.abs(L.vy), 2)} m/s)` : Math.abs(L.vx) > POUSO.vx ? "deslizando de lado" : "inclinado demais";
    return { ...s, L: Lp, T: 0, tj, status: 2, msg: `Acidente: ${motivo}.` };
  }
  return { ...s, L, T, tj };
}

function passoLabirinto(s: JF, p: Params, dt: number): JF {
  if (s.status !== 0) return s;
  const nivel = nivelM(p);
  const m = modoLab(p);
  const [cx, cy] = s.ctrl;
  let pos: [number, number];
  let vel: [number, number];
  let acel: [number, number];
  if (m === 2) {
    acel = [AMAX * cx, AMAX * cy];
    vel = [s.vel[0] + acel[0] * dt, s.vel[1] + acel[1] * dt];
    pos = [s.pos[0] + s.vel[0] * dt + 0.5 * acel[0] * dt * dt, s.pos[1] + s.vel[1] * dt + 0.5 * acel[1] * dt * dt];
  } else {
    if (m === 1) vel = [VMAX * cx, VMAX * cy];
    else {
      // posição: a partícula persegue o ponto indicado no controle, com velocidade limitada
      const alvo: [number, number] = [5 + 5 * cx, 5 + 5 * cy];
      const dx = alvo[0] - s.pos[0], dy = alvo[1] - s.pos[1];
      const dist = Math.hypot(dx, dy);
      const v = Math.min(dist / dt, 8);
      vel = dist > 1e-9 ? [(dx / dist) * v, (dy / dist) * v] : [0, 0];
    }
    pos = [s.pos[0] + vel[0] * dt, s.pos[1] + vel[1] * dt];
    acel = [(vel[0] - s.vel[0]) / dt, (vel[1] - s.vel[1]) / dt];
  }
  const tj = s.tj + dt;
  let hist = s.hist;
  if (!hist.length || tj - hist[hist.length - 1]![0]! >= 0.05) hist = [...hist, [tj, pos[0], pos[1], vel[0], vel[1], acel[0], acel[1]]].slice(-200);
  if (bateu(nivel, pos[0], pos[1])) {
    const [sx, sy] = achar(nivel, "S");
    return { ...s, pos: [sx, sy], vel: [0, 0], acel: [0, 0], ctrl: m === 0 ? [(sx - 5) / 5, (sy - 5) / 5] : [0, 0], colisoes: s.colisoes + 1, tj, hist, msg: "Bateu na parede! De volta ao início." };
  }
  if (celula(nivel, pos[0], pos[1]) === "G") {
    const pontos = Math.max(50, Math.round(1000 - 25 * tj - 100 * s.colisoes));
    return { ...s, pos, vel, acel, tj, hist, status: 1, pontos, msg: `Chegou! ${fmt(tj, 3)} s, ${s.colisoes} batida(s)` };
  }
  return { ...s, pos, vel, acel, tj, hist };
}

function step(s: JF, p: Params, _t: number, dt: number): JF {
  const j = jogo(p);
  if (j === 0) return passoHoquei(s, p, dt);
  if (j === 1) return passoLunar(s, p, dt);
  return passoLabirinto(s, p, dt);
}

// ------------------------------------------------------------------ desenho

function placar(d: Draw, s: JF, x: number, y: number, size = 13) {
  const cor = s.status === 1 ? d.theme.series[2] ?? d.theme.accent : s.status === 2 ? d.theme.positive : d.theme.text;
  if (s.msg) d.text(s.msg, x, y, { size, weight: "700", color: cor });
  if (s.status === 1) d.text(`Pontos: ${s.pontos}`, x, y - (size * 1.5) * d.px, { size, weight: "700", color: cor });
}

function renderHoquei(d: Draw, s: JF, p: Params) {
  const { theme } = d;
  const fase = faseH(p);
  d.rect(0, 0, CAMPO.w, CAMPO.h, { fill: theme.dark ? "#1d2633" : "#f4f8fc", stroke: theme.text, width: 2 });
  if (Math.round(num(p, "campo")) === 1) {
    for (let x = 0.05; x < CAMPO.w; x += 0.1)
      for (let y = 0.05; y < CAMPO.h; y += 0.1) {
        const [fx, fy] = forcaEletrica(s.cargas, Math.sign(Qdisco(p)) || 1, x, y);
        const F = Math.hypot(fx, fy);
        if (F > 0) d.arrowPx(x, y, fx, fy, 14, { color: theme.muted, width: 1, head: 5, alpha: clamp(0.25 + 0.15 * Math.log10(F * 1e12 + 1), 0.25, 0.9) });
      }
  }
  d.rect(fase.gol.x0, fase.gol.y0, fase.gol.x1 - fase.gol.x0, fase.gol.y1 - fase.gol.y0, { fill: theme.series[2] ?? theme.accent, alpha: 0.45, stroke: theme.series[2] ?? theme.accent, width: 2 });
  d.text("GOL", (fase.gol.x0 + fase.gol.x1) / 2, (fase.gol.y0 + fase.gol.y1) / 2, { size: 11, weight: "700" });
  for (const o of fase.obst) d.rect(o.x0, o.y0, o.x1 - o.x0, o.y1 - o.y0, { fill: theme.muted, alpha: 0.8 });
  if (s.rastro.length > 1) d.polyline(s.rastro, { color: theme.accent, width: 1.5, alpha: 0.7 });
  for (const c of s.cargas) {
    d.circle(c.x, c.y, 0.025, { fill: c.q > 0 ? theme.positive : theme.negative, stroke: theme.text, width: 1 });
    d.text(c.q > 0 ? "+" : "−", c.x, c.y, { size: 14, weight: "700", color: "#fff" });
  }
  const [x, y] = s.d;
  const Q = Qdisco(p);
  d.circle(x, y, DISCO.raio, { fill: theme.dark ? "#e6ebf2" : "#1c2430" });
  d.text(Q > 0 ? "+" : "−", x, y, { size: 12, weight: "700", color: theme.dark ? "#1c2430" : "#fff" });
  const [fx, fy] = forcaEletrica(s.cargas, Q, x, y);
  d.arrowPx(x, y, fx, fy, clamp(Math.hypot(fx, fy) * 2e4, 0, 90), { color: theme.positive, width: 2.5 });
  // caixas de cargas
  d.text("Arraste cargas das caixas para o campo; devolva-as para remover.", 0.0, -0.06, { align: "left", size: 11, color: theme.muted });
  for (const [bx, sinal] of [[0.25, 1], [0.55, -1]] as const) {
    d.rect(bx - 0.09, -0.24, 0.18, 0.12, { stroke: theme.text, width: 1.5 });
    d.circle(bx, -0.18, 0.025, { fill: sinal > 0 ? theme.positive : theme.negative });
    d.text(sinal > 0 ? "+" : "−", bx, -0.18, { size: 14, weight: "700", color: "#fff" });
  }
  d.text(`Fase ${nivelDe(p) + 1} · cargas: ${s.cargas.length} · t = ${fmt(s.tj, 3)} s`, 1.6, -0.12, { align: "right", size: 12 });
  d.text(s.lancado ? "" : "Posicione as cargas e use o botão “Lançar disco”.", 1.6, -0.2, { align: "right", size: 11, color: theme.accent });
  placar(d, s, 0.8, 0.9);
}

function renderLunar(d: Draw, s: JF, p: Params) {
  const { theme } = d;
  const nivel = nivelL(p);
  const pts: [number, number][] = [[0, -30]];
  for (let x = 0; x <= MUNDO_L.w; x += 2) pts.push([x, terreno(x, nivel)]);
  pts.push([MUNDO_L.w, -30]);
  d.polyline(pts, { close: true, fill: theme.dark ? "#3b3f47" : "#c9c4ba", color: theme.text, width: 1 });
  const pista = PISTAS[nivel]!;
  const yp = terreno((pista.x0 + pista.x1) / 2, nivel);
  d.line(pista.x0, yp, pista.x1, yp, { color: theme.series[2] ?? theme.accent, width: 5 });
  for (const xf of [pista.x0, pista.x1]) {
    d.line(xf, yp, xf, yp + 12, { color: theme.text });
    d.polyline([[xf, yp + 12], [xf + 6, yp + 10], [xf, yp + 8]], { close: true, fill: theme.positive, color: "none" });
  }
  // módulo
  const L = s.L;
  const h = MODULO.altura, w = MODULO.largura;
  const c = Math.cos(L.ang), sn = Math.sin(L.ang);
  const P = (u: number, v: number): [number, number] => [L.x + u * c + v * sn, L.y - u * sn + v * c];
  d.polyline([P(-w / 2, 0), P(-w / 3, 3), P(w / 3, 3), P(w / 2, 0)], { width: 2 });
  d.polyline([P(-w / 3, 3), P(-w / 3, h * 0.75), P(0, h), P(w / 3, h * 0.75), P(w / 3, 3)], { close: true, fill: theme.dark ? "#b9c2cc" : "#8a95a3", color: theme.text, width: 1.5 });
  if (s.T > 0 && s.status === 0) {
    const fl = 4 + 14 * (s.T / Tmax(p));
    d.polyline([P(-1.6, 3), P(0, 3 - fl), P(1.6, 3)], { close: true, fill: "#ff9a2e", color: "#ff5a1a", width: 1, alpha: 0.9 });
  }
  d.arrowPx(L.x, L.y + h / 2, L.vx, L.vy, clamp(Math.hypot(L.vx, L.vy) * 5, 0, 100), { color: theme.accent, width: 2 });
  // painel
  const g = gPlaneta(p);
  const m = MODULO.mSeca + L.comb;
  const solo = terreno(L.x, nivel);
  const aT = Tmax(p) / m;
  const lin = [
    `Altitude: ${fmt(L.y - solo, 4)} m`,
    `v vertical: ${fmt(L.vy, 3)} m/s   v horizontal: ${fmt(L.vx, 3)} m/s`,
    `Combustível: ${fmt(L.comb, 3)} kg   massa: ${fmt(m, 4)} kg`,
    `Empuxo: ${fmt(s.T / 1000, 3)} kN   T_máx/(m g) = ${fmt(aT / g, 3)}`,
    `Frenagem a empuxo máximo: ${Number.isFinite(distFrenagem(L.vy, aT, g)) ? fmt(distFrenagem(L.vy, aT, g), 3) + " m" : "impossível (T < mg)"}`,
  ];
  lin.forEach((l, i) => d.text(l, 5, 250 - 11 * i, { align: "left", size: 12, color: i === 3 && aT < g ? theme.positive : theme.text }));
  d.rect(MUNDO_L.w - 60, 205, 50, 8, { stroke: theme.text, width: 1 });
  d.rect(MUNDO_L.w - 60, 205, (50 * L.comb) / Math.max(1, num(p, "comb", 400)), 8, { fill: theme.series[1] ?? theme.accent });
  d.text("combustível", MUNDO_L.w - 35, 218, { size: 10, color: theme.muted });
  d.text(autopiloto(p) ? "Piloto automático ligado" : "Segure o botão do mouse para ligar o motor; o módulo inclina para o lado do ponteiro.", 200, -18, { size: 11, color: theme.muted });
  placar(d, s, 260, 160, 15);
}

function grafico(d: Draw, s: JF, i: number, y0: number, nome: string, unidade: string) {
  const { theme } = d;
  const x0 = 10.9, x1 = 15.9, H = 1.2;
  d.rect(x0, y0, x1 - x0, H, { stroke: theme.grid, width: 1 });
  d.line(x0, y0 + H / 2, x1, y0 + H / 2, { color: theme.grid });
  d.text(`${nome} (${unidade})`, x0 + 0.05, y0 + H + 0.18, { align: "left", size: 10, weight: "600" });
  if (s.hist.length < 2) return;
  const t1 = s.hist[s.hist.length - 1]![0]!;
  const vals = s.hist.flatMap((h) => [h[i]!, h[i + 1]!]);
  const esc = Math.max(1e-6, ...vals.map(Math.abs));
  for (const [k, cor] of [[0, theme.series[0] ?? theme.accent], [1, theme.series[1] ?? theme.accent]] as const) {
    const pts = s.hist.map((h) => [x0 + ((h[0]! - (t1 - 10)) / 10) * (x1 - x0), y0 + H / 2 + ((h[i + k]! / esc) * H) / 2] as [number, number]).filter((q) => q[0] >= x0);
    d.polyline(pts, { color: cor, width: 1.5 });
  }
  d.text(`±${fmt(esc, 2)}`, x1, y0 + H + 0.18, { align: "right", size: 9, color: theme.muted });
}

function renderLabirinto(d: Draw, s: JF, p: Params) {
  const { theme } = d;
  const nivel = nivelM(p);
  const lab = LABIRINTOS[nivel]!;
  lab.forEach((row, l) =>
    [...row].forEach((ch, c) => {
      const y = 9 - l;
      if (ch === "#") d.rect(c, y, 1, 1, { fill: theme.muted, alpha: 0.85 });
      if (ch === "G") d.rect(c, y, 1, 1, { fill: theme.series[2] ?? theme.accent, alpha: 0.5 });
      if (ch === "S") d.rect(c, y, 1, 1, { fill: theme.accent, alpha: 0.15 });
    }),
  );
  const [x, y] = s.pos;
  d.circle(x, y, RAIO_PART, { fill: theme.series[1] ?? theme.accent, stroke: theme.text, width: 1 });
  d.arrowPx(x, y, s.vel[0], s.vel[1], clamp(Math.hypot(...s.vel) * 18, 0, 70), { color: theme.series[0] ?? theme.accent, width: 2.5 });
  d.arrowPx(x, y, s.acel[0], s.acel[1], clamp(Math.hypot(...s.acel) * 12, 0, 70), { color: theme.positive, width: 2 });
  // controle
  const m = modoLab(p);
  const nome = ["POSIÇÃO", "VELOCIDADE", "ACELERAÇÃO"][m]!;
  d.rect(PAD.cx - PAD.r, PAD.cy - PAD.r, 2 * PAD.r, 2 * PAD.r, { stroke: theme.text, width: 1.5, fill: theme.dark ? "#1d2633" : "#f4f8fc" });
  d.line(PAD.cx - PAD.r, PAD.cy, PAD.cx + PAD.r, PAD.cy, { color: theme.grid });
  d.line(PAD.cx, PAD.cy - PAD.r, PAD.cx, PAD.cy + PAD.r, { color: theme.grid });
  const cor = m === 0 ? theme.series[1] ?? theme.accent : m === 1 ? theme.series[0] ?? theme.accent : theme.positive;
  if (m === 0) d.dot(PAD.cx + s.ctrl[0] * PAD.r, PAD.cy + s.ctrl[1] * PAD.r, 6, cor);
  else d.arrow(PAD.cx, PAD.cy, s.ctrl[0] * PAD.r, s.ctrl[1] * PAD.r, { color: cor, width: 3 });
  d.text(`Você controla a ${nome}`, PAD.cx, PAD.cy + PAD.r + 0.3, { size: 12, weight: "700", color: cor });
  grafico(d, s, 1, 3.6, "posição x, y", "m");
  grafico(d, s, 3, 1.9, "velocidade vx, vy", "m/s");
  grafico(d, s, 5, 0.2, "aceleração ax, ay", "m/s²");
  d.text(`t = ${fmt(s.tj, 3)} s   batidas: ${s.colisoes}`, 5, -0.1 + 0.02, { size: 11, color: theme.muted });
  placar(d, s, 5, 5.0, 14);
}

// ------------------------------------------------------------------ ponteiro

function cargaEm(s: JF, pt: { x: number; y: number }) {
  return s.cargas.findIndex((c) => Math.hypot(c.x - pt.x, c.y - pt.y) < 0.04);
}

function controlePad(s: JF, pt: { x: number; y: number }): JF | undefined {
  if (Math.abs(pt.x - PAD.cx) > PAD.r * 1.15 || Math.abs(pt.y - PAD.cy) > PAD.r * 1.15) return undefined;
  return { ...s, ctrl: [clamp((pt.x - PAD.cx) / PAD.r, -1, 1), clamp((pt.y - PAD.cy) / PAD.r, -1, 1)] };
}

const reiniciarDisco = (s: JF): JF => ({ ...s, d: [DISCO.x0, DISCO.y0, 0, 0], status: 0, msg: "", tj: 0, rastro: [], lancado: false });

export const jogosFisica = defineSim<JF>({
  id: "jogos-fisica",
  title: "Jogos de física: hóquei elétrico, módulo lunar e labirinto",
  course: "FG I",
  topic: "Jogos",
  priority: "P2",
  summary:
    "Três jogos com física de verdade e pontuação: posicione cargas para levar o disco ao gol (lei de Coulomb), pouse o módulo na Lua, em Marte ou na Terra controlando empuxo e combustível, e atravesse o labirinto controlando a posição, a velocidade ou a aceleração, com os três gráficos ao vivo.",
  equations: [
    String.raw`\vec F = \sum_i \frac{k\,q_i Q}{r_i^2}\,\hat r_i \qquad \vec a = \vec F/m`,
    String.raw`m\vec a = \vec T + m\vec g \qquad \dot m = -\frac{T}{v_e} \qquad d_\text{frenagem} = \frac{v^2}{2(T/m - g)}`,
    String.raw`\vec v = \frac{d\vec r}{dt} \qquad \vec a = \frac{d\vec v}{dt}`,
  ],
  liveEquations(s, p) {
    const j = jogo(p);
    if (j === 0) {
      const [fx, fy] = forcaEletrica(s.cargas, Qdisco(p), s.d[0], s.d[1]);
      return [String.raw`|\vec F| = ${texNum(Math.hypot(fx, fy) * 1000)}\ \text{mN} \qquad |\vec a| = ${texNum(Math.hypot(fx, fy) / DISCO.m)}\ \text{m/s}^2 \qquad |\vec v| = ${texNum(Math.hypot(s.d[2], s.d[3]))}\ \text{m/s}`];
    }
    if (j === 1) {
      const m = MODULO.mSeca + s.L.comb;
      return [String.raw`a_y = \frac{T\cos\theta}{m} - g = \frac{${texNum(s.T)}\cos\theta}{${texNum(m, 4)}} - ${texNum(gPlaneta(p))} = ${texNum(derivModulo(s.L, s.T, gPlaneta(p)).ay)}\ \text{m/s}^2`];
    }
    return [String.raw`\vec r = (${texNum(s.pos[0])}; ${texNum(s.pos[1])})\ \text{m} \quad \vec v = (${texNum(s.vel[0])}; ${texNum(s.vel[1])})\ \text{m/s} \quad \vec a = (${texNum(s.acel[0])}; ${texNum(s.acel[1])})\ \text{m/s}^2`];
  },

  params: [
    {
      key: "jogo",
      label: "Jogo",
      unit: "",
      min: 0,
      max: 2,
      step: 1,
      default: 0,
      options: [
        { value: 0, label: "Hóquei elétrico" },
        { value: 1, label: "Módulo lunar" },
        { value: 2, label: "Labirinto (r, v ou a)" },
      ],
    },
    { key: "nivel", label: "Fase", unit: "", min: 0, max: 3, step: 1, default: 0, options: [0, 1, 2, 3].map((i) => ({ value: i, label: `Fase ${i + 1}` })) },
    { key: "qPeca", label: "Hóquei: carga de cada peça", unit: "nC", min: 10, max: 100, step: 5, default: 50, live: true },
    {
      key: "Qdisco",
      label: "Hóquei: carga do disco",
      unit: "nC",
      min: -20,
      max: 20,
      step: 40,
      default: 20,
      options: [
        { value: 20, label: "+20 nC" },
        { value: -20, label: "−20 nC" },
      ],
    },
    {
      key: "campo",
      label: "Hóquei: mostrar o campo",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 0,
      live: true,
      options: [
        { value: 0, label: "Não" },
        { value: 1, label: "Sim" },
      ],
    },
    {
      key: "exemplo",
      label: "Hóquei: começar com",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 0,
      options: [
        { value: 0, label: "Campo vazio" },
        { value: 1, label: "Uma carga empurrando (fase 1)" },
      ],
    },
    { key: "g", label: "Módulo: gravidade", unit: "m/s²", min: 1.62, max: 9.81, step: 0.01, default: 1.62, options: PLANETAS },
    { key: "Tmax", label: "Módulo: empuxo máximo", unit: "kN", min: 2, max: 30, step: 0.5, default: 5 },
    { key: "acelerador", label: "Módulo: acelerador", unit: "%", min: 0, max: 100, step: 5, default: 100, live: true },
    { key: "comb", label: "Módulo: combustível inicial", unit: "kg", min: 50, max: 800, step: 10, default: 400 },
    { key: "x0", label: "Módulo: posição inicial", unit: "m", min: 20, max: 380, step: 5, default: 60 },
    { key: "vx0", label: "Módulo: velocidade horizontal inicial", unit: "m/s", min: -10, max: 10, step: 0.5, default: 6 },
    {
      key: "piloto",
      label: "Módulo: pilotagem",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 0,
      live: true,
      options: [
        { value: 0, label: "Você" },
        { value: 1, label: "Piloto automático" },
      ],
    },
    {
      key: "controle",
      label: "Labirinto: você controla",
      unit: "",
      min: 0,
      max: 2,
      step: 1,
      default: 1,
      options: [
        { value: 0, label: "Posição" },
        { value: 1, label: "Velocidade" },
        { value: 2, label: "Aceleração" },
      ],
    },
  ],

  observables: [
    { key: "x", label: "Posição x", unit: "m", value: (s, p) => [s.d[0], s.L.x, s.pos[0]][jogo(p)] ?? 0 },
    { key: "y", label: "Posição y (altura do módulo)", unit: "m", value: (s, p) => [s.d[1], s.L.y, s.pos[1]][jogo(p)] ?? 0 },
    { key: "vx", label: "Velocidade vx", unit: "m/s", value: (s, p) => [s.d[2], s.L.vx, s.vel[0]][jogo(p)] ?? 0 },
    { key: "vy", label: "Velocidade vy", unit: "m/s", value: (s, p) => [s.d[3], s.L.vy, s.vel[1]][jogo(p)] ?? 0 },
    {
      key: "a",
      label: "Módulo da aceleração",
      unit: "m/s²",
      value: (s, p) => {
        const j = jogo(p);
        if (j === 0) return Math.hypot(...forcaEletrica(s.cargas, Qdisco(p), s.d[0], s.d[1])) / DISCO.m;
        if (j === 1) {
          const a = derivModulo(s.L, s.T, gPlaneta(p));
          return Math.hypot(a.ax, a.ay);
        }
        return Math.hypot(...s.acel);
      },
    },
    { key: "ax", label: "Aceleração ax (labirinto)", unit: "m/s²", value: (s) => s.acel[0] },
    { key: "ay", label: "Aceleração ay (labirinto)", unit: "m/s²", value: (s) => s.acel[1] },
    { key: "alt", label: "Altitude do módulo", unit: "m", value: (s, p) => s.L.y - terreno(s.L.x, nivelL(p)) },
    { key: "comb", label: "Combustível", unit: "kg", value: (s) => s.L.comb },
    { key: "T", label: "Empuxo", unit: "N", value: (s) => s.T },
    {
      key: "E",
      label: "Energia do disco (cinética + potencial elétrica)",
      unit: "J",
      value: (s, p) => 0.5 * DISCO.m * (s.d[2] ** 2 + s.d[3] ** 2) + potencial(s.cargas, Qdisco(p), s.d[0], s.d[1]),
    },
    { key: "pontos", label: "Pontos", unit: "", value: (s) => s.pontos },
  ],
  conserved: "E",
  chart: { x: "t", y: "vy" },

  scenarios: [
    {
      id: "hoquei",
      label: "Hóquei elétrico: fase 1",
      params: { jogo: 0, nivel: 0, Qdisco: 20, campo: 1 },
      guide: `### Leve o disco ao gol
1. O disco tem carga **positiva**. Arraste uma carga das caixas para o campo e clique em **Lançar disco**.
2. A força em cada instante é a soma vetorial das forças de Coulomb $kq_iQ/r_i^2$; a seta vermelha no disco mostra essa força.
3. Menos cargas e menos tempo dão mais pontos. Desafio: faça o gol com uma só carga.
4. Ligue "mostrar o campo" e repare que o disco **não** segue as linhas de campo: a força muda a velocidade, não a direção do movimento diretamente.`,
      predict: [
        {
          question: "O disco (+) está parado à esquerda e o gol à direita. Uma única carga funciona se for:",
          options: ["positiva, à esquerda do disco", "positiva, à direita do disco", "negativa, à esquerda do disco"],
          answer: 0,
          explanation: "Cargas de mesmo sinal se repelem: uma carga + atrás do disco o empurra para a direita. Uma carga − à direita também o atrairia, mas o disco passaria por ela.",
        },
      ],
    },
    {
      id: "hoquei-4",
      label: "Hóquei elétrico: gol cercado",
      params: { jogo: 0, nivel: 3, Qdisco: 20, campo: 1 },
      guide: `### Entrando pela abertura
O gol está cercado por paredes, com abertura só por cima. Combine cargas para fazer o disco subir, contornar e descer. Use o rastro para ajustar: a trajetória depende das posições e da **velocidade** acumulada.`,
    },
    {
      id: "lua",
      label: "Pouso na Lua",
      params: { jogo: 1, nivel: 0, g: 1.62, Tmax: 5, comb: 400, piloto: 0 },
      guide: `### Pouso suave
1. Segure o botão do mouse sobre o palco para ligar o motor; mova o ponteiro para o lado para inclinar o módulo.
2. Pouse na pista com $|v_y| < 2$ m/s, $|v_x| < 1$ m/s e o módulo quase em pé.
3. Use o painel: a **distância de frenagem** $v^2/2(T/m - g)$ diz a partir de que altitude você precisa ligar o motor.
4. Repare que o módulo fica mais leve à medida que queima combustível: o mesmo empuxo dá mais aceleração.`,
      predict: [
        {
          question: "Com empuxo máximo de 5 kN e massa de 1400 kg, o módulo consegue pairar (ficar parado no ar) na Terra?",
          options: ["sim, sobra empuxo", "não: T < mg na Terra", "só com metade do combustível"],
          answer: 1,
          explanation: "Na Terra $mg = 1400 \\times 9{,}81 \\approx 13{,}7$ kN > 5 kN: o módulo cai mesmo com o motor no máximo. Na Lua $mg \\approx 2{,}3$ kN e sobra empuxo.",
        },
      ],
    },
    {
      id: "terra-auto",
      label: "Piloto automático na Terra",
      params: { jogo: 1, nivel: 0, g: 9.81, Tmax: 25, comb: 800, piloto: 1, x0: 120, vx0: 0 },
      guide: `### Controle por realimentação
O piloto automático mede altitude e velocidade e ajusta o empuxo para seguir uma velocidade de descida que diminui perto do chão. Plote $v_y(t)$ e o empuxo $T(t)$ e compare com o consumo de combustível na Lua.`,
    },
    {
      id: "labirinto-v",
      label: "Labirinto controlando a velocidade",
      params: { jogo: 2, nivel: 0, controle: 1 },
      guide: `### r, v e a
1. Arraste no quadrado de controle: a seta é a **velocidade** da partícula. Leve-a até o quadrado verde sem bater.
2. Observe os três gráficos: quando a velocidade é constante, a posição é uma reta e a aceleração é zero; mudar a seta de repente gera picos de aceleração.
3. Troque para **aceleração**: agora o controle muda a velocidade aos poucos e é preciso frear antes das curvas!`,
      predict: [
        {
          question: "Controlando a aceleração, para parar a partícula numa curva você deve:",
          options: ["soltar o controle (a = 0)", "apontar a aceleração contra a velocidade antes da curva", "apontar a aceleração para a curva"],
          answer: 1,
          explanation: "Com $a = 0$ a velocidade se mantém (1ª lei de Newton). Para reduzir $v$ é preciso $\\vec a$ oposta a $\\vec v$ durante um tempo $\\Delta t = v/a$.",
        },
      ],
    },
    {
      id: "labirinto-a",
      label: "Labirinto controlando a aceleração",
      params: { jogo: 2, nivel: 1, controle: 2 },
      guide: `### Desafio: só aceleração
Atravesse o labirinto de corredores controlando apenas $\\vec a$. Use os gráficos: a área sob $a(t)$ é a variação de velocidade; a área sob $v(t)$ é o deslocamento.`,
    },
  ],

  exercises: [
    {
      id: "coulomb",
      prompt: "No hóquei elétrico, o disco tem carga de 20 nC e uma peça de {q} nC está a {r} cm dele. Qual a intensidade da força elétrica no disco? (k = 8,99 × 10^9 N·m²/C²)",
      vary: { q: [10, 100, 0], r: [5, 30, 0] },
      fixed: { jogo: 0 },
      answer: { label: "F", unit: "mN", compute: (p) => (8.9875e9 * num(p, "q") * 20e-18) / (num(p, "r") / 100) ** 2 * 1000 },
    },
    {
      id: "pairar",
      prompt: "Que empuxo é preciso para um módulo de {m} kg pairar parado em Marte (g = 3,71 m/s²)?",
      vary: { m: [800, 2000, 0] },
      fixed: { jogo: 1, g: 3.71 },
      answer: { label: "T", unit: "N", compute: (p) => num(p, "m") * 3.71 },
    },
    {
      id: "frenagem",
      prompt: "Um módulo desce na Lua (g = 1,62 m/s²) a {v} m/s e seu empuxo máximo dá T/m = {aT} m/s². A que altura mínima ele deve ligar o motor no máximo para chegar ao solo com velocidade zero?",
      vary: { v: [5, 30, 0], aT: [3, 6, 1] },
      fixed: { jogo: 1, g: 1.62 },
      answer: { label: "h", unit: "m", compute: (p) => distFrenagem(num(p, "v"), num(p, "aT"), 1.62) },
    },
  ],

  init,
  step,
  dt: 0.004,
  sampleEvery: 10,
  maxSamples: 5000,

  pointer: {
    down(s, p, pt) {
      const j = jogo(p);
      if (j === 0) {
        const i = cargaEm(s, pt);
        if (i >= 0) return { ...s, arr: i };
        for (const [bx, sinal] of [[0.25, 1], [0.55, -1]] as const)
          if (Math.abs(pt.x - bx) < 0.09 && pt.y < -0.1 && pt.y > -0.26)
            return { ...s, cargas: [...s.cargas, { x: pt.x, y: pt.y, q: sinal * num(p, "qPeca", 50) }], arr: s.cargas.length };
        return undefined;
      }
      if (j === 1) return autopiloto(p) ? undefined : { ...s, motor: true, mira: pt.x };
      return controlePad(s, pt);
    },
    move(s, p, pt, dragging) {
      if (!dragging) return undefined;
      const j = jogo(p);
      if (j === 0 && s.arr >= 0) return { ...s, cargas: s.cargas.map((c, i) => (i === s.arr ? { ...c, x: clamp(pt.x, 0, CAMPO.w), y: clamp(pt.y, -0.25, CAMPO.h) } : c)) };
      if (j === 1 && s.motor) return { ...s, mira: pt.x };
      if (j === 2) return controlePad(s, pt);
      return undefined;
    },
    up(s, p) {
      const j = jogo(p);
      if (j === 0 && s.arr >= 0) return { ...s, cargas: s.cargas.filter((c, i) => i !== s.arr || c.y >= 0), arr: -1 };
      if (j === 1 && s.motor) return { ...s, motor: false };
      return undefined;
    },
    cursor(s, p, pt) {
      const j = jogo(p);
      if (j === 0) return cargaEm(s, pt) >= 0 || pt.y < -0.1 ? "grab" : undefined;
      if (j === 1) return "crosshair";
      return Math.abs(pt.x - PAD.cx) <= PAD.r && Math.abs(pt.y - PAD.cy) <= PAD.r ? "crosshair" : undefined;
    },
  },
  actions: [
    { id: "lancar", label: "Hóquei: lançar disco", run: (s) => ({ ...reiniciarDisco(s), lancado: true }) },
    { id: "recolocar", label: "Hóquei: recolocar disco", run: reiniciarDisco },
    { id: "limpar", label: "Hóquei: remover cargas", run: (s) => ({ ...reiniciarDisco(s), cargas: [] }) },
    { id: "pouso", label: "Módulo: nova tentativa", run: (s, p) => ({ ...s, L: moduloInicial(p), status: 0, msg: "", tj: 0, T: 0, motor: false }) },
    {
      id: "zerar",
      label: "Labirinto: recomeçar",
      run: (s, p) => {
        const [sx, sy] = achar(nivelM(p), "S");
        return { ...s, pos: [sx, sy], vel: [0, 0], acel: [0, 0], ctrl: modoLab(p) === 0 ? [(sx - 5) / 5, (sy - 5) / 5] : [0, 0], status: 0, msg: "", tj: 0, colisoes: 0, hist: [] };
      },
    },
  ],

  viewport(p) {
    const j = jogo(p);
    if (j === 0) return { xMin: -0.04, xMax: 1.64, yMin: -0.28, yMax: 1.04 };
    if (j === 1) return { xMin: 0, xMax: MUNDO_L.w, yMin: -30, yMax: MUNDO_L.h };
    return { xMin: 0, xMax: 16, yMin: -0.3, yMax: 10 };
  },

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const j = jogo(frame.params);
    if (j === 0) renderHoquei(d, frame.state, frame.params);
    else if (j === 1) renderLunar(d, frame.state, frame.params);
    else renderLabirinto(d, frame.state, frame.params);
  },
});

export default jogosFisica;
