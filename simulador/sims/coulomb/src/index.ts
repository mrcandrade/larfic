import {
  EPS0,
  K_COULOMB,
  defineSim,
  draw,
  forceOn,
  num,
  texNum,
  type Draw,
  type Params,
  type PointCharge,
  type V2,
  type V3,
} from "@fisilab/core";

/** Carga pontual no palco; q em µC. */
export interface Charge {
  x: number;
  y: number;
  q: number;
}

export interface CoulombState {
  charges: Charge[];
  /** Ponto de campo P das distribuições contínuas (m). */
  P: { x: number; y: number };
  /** Quantos elementos já foram somados (animação da integração). */
  k: number;
  drag: number | "P" | null;
}

export const MODE = { pontuais: 0, anel: 1, disco: 2, fio: 3 } as const;
const mode = (p: Params) => Math.round(num(p, "modo"));
const uC = 1e-6;
const nC = 1e-9;
/** Fator de perspectiva oblíqua: o eixo z' (para fora do plano) aparece inclinado. */
const OBL = 0.3;
const HIT = 0.08;
/** Painel da soma (coordenadas do mundo). */
const PANEL = { x0: 1.06, x1: 1.88, y0: -0.72, y1: 0.72 };
const SUM_TIME = 3;

// ---------------------------------------------------------------------------
// Física: cargas pontuais
// ---------------------------------------------------------------------------

export const pointCharges = (s: CoulombState): PointCharge[] => s.charges.map((c) => ({ x: c.x, y: c.y, q: c.q * uC }));

/** Força resultante (N) sobre a carga i. */
export const netForce = (s: CoulombState, i: number): V2 => forceOn(pointCharges(s), i);

/** Força (N) que a carga j exerce sobre a carga i. */
export function pairForce(s: CoulombState, i: number, j: number): V2 {
  const a = s.charges[i];
  const b = s.charges[j];
  if (!a || !b) return [0, 0];
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const r = Math.hypot(dx, dy);
  if (r === 0) return [0, 0];
  const f = (K_COULOMB * a.q * uC * b.q * uC) / (r * r * r);
  return [f * dx, f * dy];
}

// ---------------------------------------------------------------------------
// Física: distribuições contínuas
// ---------------------------------------------------------------------------

/** Elemento de carga de uma distribuição: posição desenhada, carga e contribuição dE (3D). */
export interface Element {
  /** Posição projetada no palco. */
  sx: number;
  sy: number;
  /** Atrás do plano do papel (desenho mais apagado). */
  back: boolean;
  /** Raio do anel elementar (só no disco). */
  ring?: number;
  dq: number;
  dE: V3;
}

/** Projeção oblíqua de um vetor 3D (x, y, z') no plano do palco. */
export const project = (v: V3): V2 => [v[0] + OBL * v[2], v[1]];

/** Divide a distribuição em N elementos e calcula o dE de cada um no ponto P. */
export function elements(p: Params, P: { x: number; y: number }): Element[] {
  const N = Math.max(1, Math.round(num(p, "N", 12)));
  const Q = num(p, "Q") * nC;
  const R = num(p, "R", 0.3);
  const out: Element[] = [];
  const m = mode(p);
  if (m === MODE.anel) {
    // Anel de raio R no plano y–z', centrado na origem; P no eixo x.
    const dq = Q / N;
    for (let i = 0; i < N; i++) {
      const phi = (2 * Math.PI * (i + 0.5)) / N + Math.PI / 2;
      const e: V3 = [0, R * Math.cos(phi), R * Math.sin(phi)];
      const r: V3 = [P.x - e[0], -e[1], -e[2]];
      const d = Math.hypot(...r);
      const f = (K_COULOMB * dq) / d ** 3;
      const [sx, sy] = project(e);
      out.push({ sx, sy, back: e[2] > 1e-12, dq, dE: [f * r[0], f * r[1], f * r[2]] });
    }
  } else if (m === MODE.disco) {
    // Disco = N anéis concêntricos de largura R/N (regra do ponto médio em r).
    const sigma = Q / (Math.PI * R * R);
    const dr = R / N;
    for (let i = 0; i < N; i++) {
      const ri = (i + 0.5) * dr;
      const dq = sigma * 2 * Math.PI * ri * dr;
      const z = P.x;
      const Ez = (K_COULOMB * dq * z) / (z * z + ri * ri) ** 1.5;
      out.push({ sx: 0, sy: ri, back: false, ring: ri, dq, dE: [Ez, 0, 0] });
    }
  } else if (m === MODE.fio) {
    // Fio de comprimento L sobre o eixo y, centrado na origem.
    const L = num(p, "L", 1);
    const dq = Q / N;
    for (let i = 0; i < N; i++) {
      const y = -L / 2 + ((i + 0.5) * L) / N;
      const rx = P.x;
      const ry = P.y - y;
      const d = Math.hypot(rx, ry);
      const f = d > 0 ? (K_COULOMB * dq) / d ** 3 : 0;
      out.push({ sx: 0, sy: y, back: false, dq, dE: [f * rx, f * ry, 0] });
    }
  }
  return out;
}

/** Soma dos k primeiros dE (k fracionário arredonda para baixo). */
export function partialSum(els: readonly Element[], k = els.length): V3 {
  const n = Math.min(els.length, Math.floor(k + 1e-9));
  const s: V3 = [0, 0, 0];
  for (let i = 0; i < n; i++) {
    const e = els[i]!.dE;
    s[0] += e[0];
    s[1] += e[1];
    s[2] += e[2];
  }
  return s;
}

/** Campo exato (fórmula fechada) no ponto P, em N/C. */
export function exactField(p: Params, P: { x: number; y: number }): V3 {
  const Q = num(p, "Q") * nC;
  const R = num(p, "R", 0.3);
  const z = P.x;
  switch (mode(p)) {
    case MODE.anel:
      return [(K_COULOMB * Q * z) / (z * z + R * R) ** 1.5, 0, 0];
    case MODE.disco: {
      const sigma = Q / (Math.PI * R * R);
      return [(sigma / (2 * EPS0)) * Math.sign(z) * (1 - Math.abs(z) / Math.hypot(z, R)), 0, 0];
    }
    case MODE.fio: {
      const L = num(p, "L", 1);
      const lam = Q / L;
      const x0 = P.x;
      const u1 = -L / 2 - P.y;
      const u2 = L / 2 - P.y;
      const r1 = Math.hypot(x0, u1);
      const r2 = Math.hypot(x0, u2);
      const ex = x0 === 0 ? 0 : ((K_COULOMB * lam) / x0) * (u2 / r2 - u1 / r1);
      const ey = K_COULOMB * lam * (1 / r2 - 1 / r1);
      return [ex, ey, 0];
    }
    default:
      return [0, 0, 0];
  }
}

const mag = (v: V3) => Math.hypot(v[0], v[1], v[2]);

export function relError(p: Params, P: { x: number; y: number }): number {
  const ex = exactField(p, P);
  const nu = partialSum(elements(p, P));
  const m = mag(ex);
  return m > 0 ? (100 * Math.hypot(nu[0] - ex[0], nu[1] - ex[1], nu[2] - ex[2])) / m : 0;
}

// ---------------------------------------------------------------------------
// Interação
// ---------------------------------------------------------------------------

function clampP(p: Params, x: number, y: number): { x: number; y: number } {
  if (mode(p) === MODE.fio) {
    const L = num(p, "L", 1);
    let cx = Math.max(-0.75, Math.min(0.98, x));
    const cy = Math.max(-0.7, Math.min(0.7, y));
    // Não deixa P cair em cima do fio.
    if (Math.abs(cy) <= L / 2 + 0.03 && Math.abs(cx) < 0.03) cx = cx < 0 ? -0.03 : 0.03;
    return { x: cx, y: cy };
  }
  return { x: Math.max(-0.75, Math.min(0.98, x)), y: 0 };
}

const VIEW_PT = { xMin: -1.25, xMax: 1.25, yMin: -0.75, yMax: 0.75 };
const VIEW_CONT = { xMin: -0.82, xMax: 1.9, yMin: -0.75, yMax: 0.75 };

function initCharges(p: Params): Charge[] {
  const cs: Charge[] = [
    { x: -0.5, y: -0.15, q: num(p, "q1") },
    { x: 0.5, y: -0.15, q: num(p, "q2") },
  ];
  if (Math.round(num(p, "n", 2)) >= 3) cs.push({ x: 0, y: 0.45, q: num(p, "q3") });
  return cs;
}

/** As cargas usam os valores atuais dos parâmetros (q1, q2, q3 são "ao vivo"). */
function liveCharges(s: CoulombState, p: Params): CoulombState {
  const qs = [num(p, "q1"), num(p, "q2"), num(p, "q3")];
  const n = Math.round(num(p, "n", 2));
  let charges = s.charges.slice(0, n).map((c, i) => ({ ...c, q: qs[i]! }));
  if (charges.length < n) charges = [...charges, ...initCharges(p).slice(charges.length)];
  return { ...s, charges };
}

// ---------------------------------------------------------------------------
// Desenho
// ---------------------------------------------------------------------------

const fmt = (v: number, digits = 3) => {
  if (!Number.isFinite(v)) return "—";
  const a = Math.abs(v);
  if (a !== 0 && (a >= 1e5 || a < 1e-2)) {
    const [m, e] = v.toExponential(digits - 1).split("e");
    return `${m!.replace(".", ",").replace("-", "−")}×10^${Number(e)}`;
  }
  return Number(v.toPrecision(digits)).toString().replace(".", ",").replace("-", "−");
};

function tag(d: Draw, str: string, x: number, y: number, o: { color?: string; size?: number; align?: "left" | "right" | "center"; weight?: string } = {}) {
  const size = o.size ?? 11;
  d.ctx.save();
  d.ctx.font = `${o.weight ?? "400"} ${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  const w = (d.ctx.measureText(str).width + 8) * d.px;
  d.ctx.restore();
  const h = (size + 6) * d.px;
  const align = o.align ?? "center";
  const x0 = align === "left" ? x - 4 * d.px : align === "right" ? x - w + 4 * d.px : x - w / 2;
  d.rect(x0, y - h / 2, w, h, { fill: d.theme.dark ? "#11161d" : "#ffffff", alpha: 0.82 });
  d.text(str, x, y, { color: o.color ?? d.theme.text, size, align, weight: o.weight });
}

function ellipse(d: Draw, cx: number, cy: number, rx: number, ry: number, s: Parameters<Draw["polyline"]>[1]) {
  const pts: V2[] = [];
  for (let i = 0; i <= 64; i++) {
    const a = (2 * Math.PI * i) / 64;
    pts.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]);
  }
  d.polyline(pts, s);
}

function chargeColor(d: Draw, q: number) {
  return q > 0 ? d.theme.positive : q < 0 ? d.theme.negative : d.theme.muted;
}

function renderPoints(d: Draw, s: CoulombState) {
  const { theme } = d;
  const n = s.charges.length;
  // Escala linear comum a todas as setas (preserva a regra do paralelogramo).
  let fMax = 0;
  for (let i = 0; i < n; i++) {
    fMax = Math.max(fMax, Math.hypot(...netForce(s, i)));
    for (let j = 0; j < n; j++) if (j !== i) fMax = Math.max(fMax, Math.hypot(...pairForce(s, i, j)));
  }
  const sc = fMax > 0 ? (0.42 / fMax) : 0; // m por N

  // Linha entre pares com a distância
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) {
      const a = s.charges[i]!;
      const b = s.charges[j]!;
      d.line(a.x, a.y, b.x, b.y, { color: theme.muted, width: 1, dash: [3, 4], alpha: 0.6 });
      tag(d, `r${i + 1}${j + 1} = ${fmt(Math.hypot(a.x - b.x, a.y - b.y))} m`, (a.x + b.x) / 2, (a.y + b.y) / 2, { color: theme.muted, size: 10 });
    }

  s.charges.forEach((c, i) => {
    const F = netForce(s, i);
    // Componentes (forças de cada outra carga) tracejadas, com o paralelogramo.
    const parts: V2[] = [];
    for (let j = 0; j < n; j++) {
      if (j === i) continue;
      const f = pairForce(s, i, j);
      parts.push(f);
      d.arrow(c.x, c.y, f[0] * sc, f[1] * sc, { color: chargeColor(d, s.charges[j]!.q), width: 1.6, dash: [5, 3], head: 7, alpha: 0.85 });
      d.text(`F${i + 1}${j + 1}`, c.x + f[0] * sc, c.y + f[1] * sc, { color: theme.muted, size: 10, dx: 10, dy: -8 });
    }
    if (parts.length === 2) {
      const [a, b] = parts as [V2, V2];
      d.line(c.x + a[0] * sc, c.y + a[1] * sc, c.x + F[0] * sc, c.y + F[1] * sc, { color: theme.muted, width: 1, dash: [2, 3] });
      d.line(c.x + b[0] * sc, c.y + b[1] * sc, c.x + F[0] * sc, c.y + F[1] * sc, { color: theme.muted, width: 1, dash: [2, 3] });
    }
    d.arrow(c.x, c.y, F[0] * sc, F[1] * sc, { color: theme.series[2], width: 3, head: 11 });
  });

  s.charges.forEach((c, i) => {
    const r = 10 + Math.min(6, Math.abs(c.q) * 0.6);
    d.dot(c.x, c.y, r + 2, theme.dark ? "#0b0f14" : "#ffffff");
    d.dot(c.x, c.y, r, chargeColor(d, c.q));
    d.text(c.q > 0 ? "+" : c.q < 0 ? "−" : "0", c.x, c.y, { color: "#ffffff", size: 14, weight: "700", dy: 1 });
    const F = netForce(s, i);
    tag(d, `q${i + 1} = ${fmt(c.q, 2)} µC`, c.x, c.y - (r + 11) * d.px, { size: 10, weight: "600" });
    tag(d, `|F${i + 1}| = ${fmt(Math.hypot(...F))} N`, c.x, c.y - (r + 26) * d.px, { color: theme.series[2], size: 10 });
  });

  tag(d, "Arraste as cargas. Tracejadas: força de cada carga; verde: força resultante (mesma escala).", VIEW_PT.xMin + 0.04, VIEW_PT.yMin + 0.06, {
    color: theme.muted,
    size: 10,
    align: "left",
  });
}

function renderContinuous(d: Draw, s: CoulombState, p: Params) {
  const { theme } = d;
  const m = mode(p);
  const els = elements(p, s.P);
  const N = els.length;
  const k = Math.min(N, Math.floor(s.k + 1e-9));
  const R = num(p, "R", 0.3);
  const L = num(p, "L", 1);
  const Q = num(p, "Q");
  const qColor = Q >= 0 ? theme.positive : theme.negative;
  const sum = partialSum(els, k);
  const total = partialSum(els);
  const exact = exactField(p, s.P);
  const P = s.P;

  // Eixo
  if (m !== MODE.fio) {
    d.line(VIEW_CONT.xMin + 0.02, 0, 1.0, 0, { color: theme.muted, width: 1, dash: [6, 4] });
    d.text("eixo x", 0.98, 0, { color: theme.muted, size: 10, dy: 12, align: "right" });
  } else {
    d.line(VIEW_CONT.xMin + 0.02, 0, 1.0, 0, { color: theme.muted, width: 1, dash: [2, 5], alpha: 0.6 });
  }

  // Objeto
  if (m === MODE.anel) {
    ellipse(d, 0, 0, OBL * R, R, { color: qColor, width: 2.5, alpha: 0.5 });
  } else if (m === MODE.disco) {
    ellipse(d, 0, 0, OBL * R, R, { color: qColor, width: 1, fill: qColor, alpha: 0.12 });
    els.forEach((e, i) => {
      const r = e.ring!;
      const dr = R / N;
      const on = i < k;
      ellipse(d, 0, 0, OBL * (r + dr / 2), r + dr / 2, { color: on ? qColor : theme.muted, width: on ? 1.3 : 0.8, alpha: on ? 0.75 : 0.35 });
    });
  } else {
    d.line(0, -L / 2, 0, L / 2, { color: qColor, width: 5, alpha: 0.35 });
    for (let i = 0; i <= N; i++) {
      const y = -L / 2 + (i * L) / N;
      d.line(-0.02, y, 0.02, y, { color: theme.muted, width: 1 });
    }
  }

  // Elementos
  if (m !== MODE.disco)
    els.forEach((e, i) => {
      const on = i < k;
      d.dot(e.sx, e.sy, on ? 4.5 : 3.5, on ? qColor : theme.muted, (e.back ? 0.45 : 1) * (on ? 1 : 0.45));
    });

  // Elemento atual: ligação até P e sua contribuição
  const cur = Math.min(N - 1, Math.max(0, k - 1));
  const ce = els[cur];
  const dEmax = Math.max(...els.map((e) => mag(e.dE)), 1e-30);
  const fan = 0.28 / dEmax;
  if (ce && k > 0) {
    if (m === MODE.disco) {
      const r = ce.ring!;
      ellipse(d, 0, 0, OBL * r, r, { color: theme.series[1], width: 2.5 });
      d.line(0, r, P.x, P.y, { color: theme.series[1], width: 1, dash: [4, 3] });
    } else {
      d.line(ce.sx, ce.sy, P.x, P.y, { color: theme.series[1], width: 1, dash: [4, 3] });
      d.dot(ce.sx, ce.sy, 6, theme.series[1] ?? theme.accent);
    }
  }
  // Leque de dE em P (setas finas, fora de escala em relação à soma)
  if (m !== MODE.disco)
    for (let i = 0; i < k; i++) {
      const [vx, vy] = project(els[i]!.dE);
      d.arrow(P.x, P.y, vx * fan, vy * fan, { color: i === cur ? theme.series[1] : theme.series[4], width: i === cur ? 2 : 1, head: 6, alpha: i === cur ? 1 : 0.5 });
    }
  else if (ce && k > 0) {
    const [vx, vy] = project(ce.dE);
    d.arrow(P.x, P.y, vx * fan, vy * fan, { color: theme.series[1], width: 2, head: 7 });
  }

  // Soma parcial em P
  const ref = Math.max(mag(total), mag(exact), 1e-30);
  const [sx, sy] = project(sum);
  d.arrow(P.x, P.y, (sx / ref) * 0.4, (sy / ref) * 0.4, { color: theme.series[2], width: 3.2, head: 11 });
  d.dot(P.x, P.y, 5, theme.text);
  d.text("P", P.x, P.y, { color: theme.text, size: 13, weight: "700", dx: 4, dy: 16 });
  if (k > 0) d.text("ΣdE", P.x + (sx / ref) * 0.4, P.y + (sy / ref) * 0.4, { color: theme.series[2], size: 12, weight: "700", dy: -12 });

  // Painel da soma
  const X0 = PANEL.x0;
  const X1 = PANEL.x1;
  d.rect(X0, PANEL.y0, X1 - X0, PANEL.y1 - PANEL.y0, { fill: theme.dark ? "#161c24" : "#f6f8fb", stroke: theme.grid, width: 1 });
  d.text(`Soma de ${k} de ${N} elementos`, X0 + 0.04, PANEL.y1 - 0.07, { color: theme.text, size: 12, weight: "600", align: "left" });
  const Ek = mag(sum);
  d.text(`|ΣdE| = ${fmt(Ek)} N/C`, X0 + 0.04, PANEL.y1 - 0.16, { color: theme.series[2], size: 11, align: "left" });
  d.text(`Fórmula: ${fmt(mag(exact))} N/C`, X0 + 0.04, PANEL.y1 - 0.24, { color: theme.text, size: 11, align: "left" });
  const err0 = mag(exact) > 0 ? (100 * Math.hypot(total[0] - exact[0], total[1] - exact[1], total[2] - exact[2])) / mag(exact) : 0;
  const err = err0 < 1e-9 ? 0 : err0;
  d.text(`Erro com N = ${N}: ${fmt(err, 2)} %`, X0 + 0.04, PANEL.y1 - 0.32, { color: theme.muted, size: 11, align: "left" });

  const cx = (X0 + X1) / 2;
  if (m === MODE.disco) {
    // Barras: dE de cada anel
    const top = 0.25;
    const base = -0.3;
    const w = (X1 - X0 - 0.1) / N;
    d.text("dE de cada anel (de dentro para fora)", cx, top + 0.03, { color: theme.muted, size: 10 });
    els.forEach((e, i) => {
      const h = (Math.abs(e.dE[0]) / dEmax) * (top - base - 0.05);
      d.rect(X0 + 0.05 + i * w + w * 0.1, base, w * 0.8, h, { fill: i === cur && k > 0 ? theme.series[1] : theme.series[4], alpha: i < k ? 0.9 : 0.25 });
    });
    d.line(X0 + 0.05, base, X1 - 0.05, base, { color: theme.muted, width: 1 });
  } else {
    // Cadeia de vetores ponta a cauda: as componentes transversais se cancelam.
    // A escala encaixa a cadeia completa (caixa envolvente) na área do painel.
    const chain: V2[] = [[0, 0]];
    for (const e of els) {
      const [vx, vy] = project(e.dE);
      const last = chain[chain.length - 1]!;
      chain.push([last[0] + vx, last[1] + vy]);
    }
    const xs = chain.map((c) => c[0]);
    const ys = chain.map((c) => c[1]);
    const bx0 = Math.min(...xs);
    const by0 = Math.min(...ys);
    const bwid = Math.max(...xs) - bx0;
    const bhei = Math.max(...ys) - by0;
    const ch = Math.min(0.66 / Math.max(bwid, 1e-30), 0.5 / Math.max(bhei, 1e-30));
    const ox = cx - ((bx0 + bwid / 2) * ch);
    const oy = -0.08 - ((by0 + bhei / 2) * ch);
    d.text("dE ponta a cauda", cx, 0.27, { color: theme.muted, size: 10 });
    for (let i = 0; i < k; i++) {
      const [ax, ay] = chain[i]!;
      const [bx, by] = chain[i + 1]!;
      d.arrow(ox + ax * ch, oy + ay * ch, (bx - ax) * ch, (by - ay) * ch, { color: i === cur ? theme.series[1] : theme.series[4], width: 1.2, head: N > 30 ? 4 : 6, alpha: 0.85 });
    }
    if (k > 0) {
      const [ex, ey] = chain[k]!;
      d.arrow(ox, oy, ex * ch, ey * ch, { color: theme.series[2], width: 2.6, head: 9 });
    }
  }
  // Barras de comparação: soma × fórmula
  const bw = X1 - X0 - 0.1;
  const bmax = Math.max(mag(total), mag(exact), 1e-30);
  d.text("soma", X0 + 0.05, -0.47, { color: theme.muted, size: 10, align: "left" });
  d.rect(X0 + 0.05, -0.53, (Ek / bmax) * bw * 0.98, 0.04, { fill: theme.series[2] });
  d.text("fórmula", X0 + 0.05, -0.6, { color: theme.muted, size: 10, align: "left" });
  d.rect(X0 + 0.05, -0.66, (mag(exact) / bmax) * bw * 0.98, 0.04, { fill: theme.text, alpha: 0.6 });

  const hint =
    m === MODE.fio ? "Arraste P para qualquer ponto. Inicie para somar elemento a elemento." : "Arraste P ao longo do eixo. Inicie para somar elemento a elemento.";
  tag(d, hint, VIEW_CONT.xMin + 0.03, VIEW_CONT.yMin + 0.05, { color: theme.muted, size: 10, align: "left" });
}

// ---------------------------------------------------------------------------
// Simulação
// ---------------------------------------------------------------------------

export const coulomb = defineSim<CoulombState>({
  id: "coulomb",
  title: "Lei de Coulomb e superposição",
  course: "FG III",
  topic: "Coulomb",
  priority: "P1",
  summary:
    "Arraste cargas pontuais e veja as forças se somarem como vetores. Divida um anel, um disco ou um fio em N pedaços e acompanhe a soma dos dE convergir para a fórmula fechada.",
  equations: [
    String.raw`\vec F_{12} = \frac{k\,q_1 q_2}{r_{12}^2}\,\hat r_{12} \qquad k = \frac{1}{4\pi\varepsilon_0} \approx 8{,}99\times 10^{9}\ \text{N·m}^2/\text{C}^2`,
    String.raw`\vec F_1 = \sum_{j\neq 1} \vec F_{1j} \qquad \vec E(P) = \int \frac{k\,dq}{r^2}\,\hat r \approx \sum_{i=1}^{N} \frac{k\,\Delta q_i}{r_i^2}\,\hat r_i`,
    String.raw`\text{Anel: } E_x = \frac{kQz}{(z^2+R^2)^{3/2}} \qquad \text{Disco: } E_x = \frac{\sigma}{2\varepsilon_0}\left(1-\frac{z}{\sqrt{z^2+R^2}}\right)`,
    String.raw`\text{Fio (mediatriz): } E = \frac{2k\lambda}{d}\,\frac{L/2}{\sqrt{d^2+(L/2)^2}} \xrightarrow{L\to\infty} \frac{2k\lambda}{d}`,
  ],
  liveEquations(s0, p) {
    const s = mode(p) === MODE.pontuais ? liveCharges(s0, p) : s0;
    if (mode(p) === MODE.pontuais) {
      const out: string[] = [];
      if (s.charges.length >= 2) {
        const [a, b] = s.charges as [Charge, Charge];
        const r = Math.hypot(a.x - b.x, a.y - b.y);
        out.push(
          String.raw`|F_{12}| = \frac{k\,|q_1 q_2|}{r^2} = \frac{(8{,}99\times10^9)(${texNum(Math.abs(a.q * b.q))}\times10^{-12})}{(${texNum(r)})^2} = ${texNum(Math.hypot(...pairForce(s, 0, 1)))}\ \text{N}`,
        );
      }
      const F = netForce(s, 0);
      out.push(String.raw`\vec F_1 = (${texNum(F[0])},\ ${texNum(F[1])})\ \text{N} \qquad |\vec F_1| = ${texNum(Math.hypot(...F))}\ \text{N}`);
      return out;
    }
    const els = elements(p, s.P);
    const sum = partialSum(els, s.k);
    const ex = exactField(p, s.P);
    return [
      String.raw`\sum_{i=1}^{${Math.floor(s.k + 1e-9)}} d\vec E_i = (${texNum(sum[0])},\ ${texNum(sum[1])},\ ${texNum(sum[2])})\ \text{N/C}`,
      String.raw`\text{Fórmula fechada: } |\vec E| = ${texNum(mag(ex))}\ \text{N/C} \qquad \text{erro com } N = ${els.length}: ${texNum(relError(p, s.P))}\,\%`,
    ];
  },

  params: [
    {
      key: "modo",
      label: "Distribuição",
      unit: "",
      min: 0,
      max: 3,
      step: 1,
      default: 0,
      options: [
        { value: 0, label: "Cargas pontuais" },
        { value: 1, label: "Anel (campo no eixo)" },
        { value: 2, label: "Disco (campo no eixo)" },
        { value: 3, label: "Fio finito" },
      ],
    },
    {
      key: "n",
      label: "Número de cargas pontuais",
      unit: "",
      min: 2,
      max: 3,
      step: 1,
      default: 3,
      live: true,
      options: [
        { value: 2, label: "Duas" },
        { value: 3, label: "Três" },
      ],
    },
    { key: "q1", label: "Carga q₁", unit: "µC", min: -10, max: 10, step: 0.5, default: 3, live: true },
    { key: "q2", label: "Carga q₂", unit: "µC", min: -10, max: 10, step: 0.5, default: -2, live: true },
    { key: "q3", label: "Carga q₃", unit: "µC", min: -10, max: 10, step: 0.5, default: 2, live: true },
    { key: "Q", label: "Carga total da distribuição Q", unit: "nC", min: -50, max: 50, step: 1, default: 10, live: true },
    { key: "R", label: "Raio do anel/disco R", unit: "m", min: 0.1, max: 0.6, step: 0.01, default: 0.4, live: true },
    { key: "L", label: "Comprimento do fio L", unit: "m", min: 0.2, max: 1.4, step: 0.05, default: 1, live: true },
    { key: "N", label: "Número de elementos N", unit: "", min: 1, max: 60, step: 1, default: 12, live: true },
    { key: "z", label: "Posição inicial de P (x)", unit: "m", min: -0.7, max: 0.95, step: 0.01, default: 0.45 },
  ],

  observables: [
    { key: "F1", label: "|F₁| (resultante na carga 1)", unit: "N", value: (s, p) => Math.hypot(...netForce(liveCharges(s, p), 0)) },
    { key: "F12", label: "|F₁₂|", unit: "N", value: (s, p) => Math.hypot(...pairForce(liveCharges(s, p), 0, 1)) },
    { key: "r12", label: "Distância r₁₂", unit: "m", value: (s) => (s.charges.length >= 2 ? Math.hypot(s.charges[0]!.x - s.charges[1]!.x, s.charges[0]!.y - s.charges[1]!.y) : 0) },
    { key: "Esoma", label: "|ΣdE| (soma parcial)", unit: "N/C", value: (s, p) => mag(partialSum(elements(p, s.P), s.k)) },
    { key: "Enum", label: "|E| numérico (N elementos)", unit: "N/C", value: (s, p) => mag(partialSum(elements(p, s.P))) },
    { key: "Eexato", label: "|E| pela fórmula", unit: "N/C", value: (s, p) => mag(exactField(p, s.P)) },
    { key: "erro", label: "Erro relativo da soma", unit: "%", value: (s, p) => relError(p, s.P) },
    { key: "xP", label: "Posição de P (x)", unit: "m", value: (s) => s.P.x },
    { key: "k", label: "Elementos somados", unit: "", value: (s) => Math.floor(s.k + 1e-9) },
  ],
  chart: { x: "t", y: "Esoma" },

  scenarios: [
    {
      id: "superposicao",
      label: "Três cargas: superposição",
      params: { modo: 0, n: 3, q1: 3, q2: -2, q3: 2 },
      guide: `### Forças se somam como vetores
1. Cada carga sente a força de cada uma das outras (setas tracejadas, na cor da carga que a exerce). A seta verde é a soma.
2. Arraste $q_3$ e veja o paralelogramo das forças sobre ela mudar.
3. Leve $q_1$ e $q_2$ para 0,5 m de distância e confira $|F_{12}| = k|q_1q_2|/r^2$ nas equações vivas.
4. Compare $\\vec F_{12}$ (sobre $q_1$) com $\\vec F_{21}$ (sobre $q_2$): mesmo módulo, sentidos opostos.
5. Mude $q_3$ para zero: o que acontece com as forças sobre as outras?`,
      predict: [
        {
          question: "Se $q_2$ passa a valer o dobro, a força que $q_2$ exerce sobre $q_1$ e a que $q_1$ exerce sobre $q_2$:",
          options: ["só a força sobre q₂ dobra", "só a força sobre q₁ dobra", "as duas dobram", "nenhuma muda"],
          answer: 2,
          explanation: "$F = k|q_1q_2|/r^2$ é a mesma expressão para as duas forças (terceira lei de Newton): as duas dobram, mantendo módulos iguais e sentidos opostos.",
        },
      ],
    },
    {
      id: "anel",
      label: "Anel: componentes que se cancelam",
      params: { modo: 1, Q: 10, R: 0.4, N: 12, z: 0.45 },
      guide: `### Integrando o anel peça por peça
1. O anel foi dividido em $N$ elementos de carga $\\Delta q = Q/N$. Inicie: cada elemento contribui com um $d\\vec E$ (leque em P).
2. No painel, os $d\\vec E$ ficam ponta a cauda: as componentes perpendiculares ao eixo **giram e se cancelam**; só a componente ao longo do eixo se acumula.
3. Compare a soma com $E = kQz/(z^2+R^2)^{3/2}$. Com $N = 1$ a soma está errada; com $N \\ge 2$ já é exata no eixo. Por quê?
4. Arraste P: onde o campo é máximo? (Resposta: $z = R/\\sqrt2$.) E no centro do anel?`,
      predict: [
        {
          question: "No centro do anel carregado (z = 0), o campo elétrico é:",
          options: ["máximo", "nulo", "igual a kQ/R²", "infinito"],
          answer: 1,
          explanation: "Cada elemento tem um oposto diametral que produz um $d\\vec E$ de mesmo módulo e sentido contrário no centro: a soma é zero, ainda que cada contribuição valha $k\\,\\Delta q/R^2$.",
        },
      ],
    },
    {
      id: "disco",
      label: "Disco: convergência da soma",
      params: { modo: 2, Q: 10, R: 0.4, N: 4, z: 0.1 },
      guide: `### Disco = anéis concêntricos
1. O disco foi fatiado em $N$ anéis de largura $R/N$; cada anel contribui com o campo de um anel no eixo.
2. As barras mostram o $dE$ de cada anel. Os anéis do meio contribuem mais: perto do centro há pouca carga, e longe dele a distância pesa.
3. Com $N = 4$ e P perto do disco, anote o **erro**. Aumente $N$ para 8, 16, 32: o erro cai mais ou menos como $1/N^2$ (regra do ponto médio).
4. Leve P para longe ($z \\gg R$): o disco parece uma carga pontual, $E \\approx kQ/z^2$. Perto ($z \\ll R$) o campo tende a $\\sigma/2\\varepsilon_0$, quase constante.`,
    },
    {
      id: "fio",
      label: "Fio finito",
      params: { modo: 3, Q: 10, L: 1.2, N: 10, z: 0.3 },
      guide: `### Um fio em N pedaços
1. Com P sobre a mediatriz, as componentes ao longo do fio se cancelam aos pares.
2. Arraste P para fora da mediatriz: agora sobra uma componente paralela ao fio, e a fórmula fechada geral continua batendo com a soma quando $N$ é grande.
3. Com P bem perto do fio ($d \\ll L$), compare com o fio infinito $E = 2k\\lambda/d$, com $\\lambda = Q/L$.
4. Com P muito perto, poucos elementos dão um erro grande: o elemento mais próximo domina. Aumente $N$.`,
    },
  ],

  exercises: [
    {
      id: "par",
      prompt: "Duas cargas de {q1} µC e {q2} µC estão a {r} m uma da outra. Qual é o módulo da força elétrica entre elas?",
      vary: { q1: [1, 10, 1], q2: [1, 10, 1], r: [0.1, 1.5, 2] },
      answer: { label: "F", unit: "N", compute: (p) => (K_COULOMB * num(p, "q1") * uC * num(p, "q2") * uC) / num(p, "r", 1) ** 2 },
      hint: "F = k|q₁q₂|/r², com as cargas em coulombs.",
    },
    {
      id: "anel",
      prompt: "Um anel de raio {R} m tem carga {Q} nC uniformemente distribuída. Qual é o módulo do campo elétrico num ponto do eixo a {z} m do centro?",
      vary: { R: [0.1, 0.6, 2], Q: [1, 50, 0], z: [0.05, 0.95, 2] },
      fixed: { modo: 1 },
      answer: { label: "E", unit: "N/C", compute: (p) => mag(exactField(p, { x: num(p, "z"), y: 0 })) },
      hint: "Só a componente ao longo do eixo sobrevive: E = kQz/(z² + R²)^{3/2}.",
    },
  ],

  init(p) {
    const P = clampP(p, num(p, "z", 0.45), 0);
    return { charges: initCharges(p), P, k: Math.max(1, Math.round(num(p, "N", 12))), drag: null };
  },
  step(s, p, t, dt) {
    const st = mode(p) === MODE.pontuais ? liveCharges(s, p) : s;
    const N = Math.max(1, Math.round(num(p, "N", 12)));
    // Ao iniciar, a soma recomeça do zero e cresce até N em SUM_TIME segundos.
    const k0 = t < dt / 2 ? 0 : st.k;
    return { ...st, k: Math.min(N, k0 + (N * dt) / SUM_TIME) };
  },
  dt: 0.01,
  sampleEvery: 2,
  tEnd: SUM_TIME + 0.5,

  viewport: (p) => ({ ...(mode(p) === MODE.pontuais ? VIEW_PT : VIEW_CONT), unit: "m" }),

  pointer: {
    down(s, p, pt) {
      if (mode(p) !== MODE.pontuais) {
        if (Math.hypot(pt.x - s.P.x, pt.y - s.P.y) < HIT * 1.5) return { ...s, drag: "P" };
        return undefined;
      }
      const st = liveCharges(s, p);
      for (let i = st.charges.length - 1; i >= 0; i--) {
        const c = st.charges[i]!;
        if (Math.hypot(c.x - pt.x, c.y - pt.y) < HIT) return { ...st, drag: i };
      }
      return undefined;
    },
    move(s, p, pt, dragging) {
      if (!dragging || s.drag === null) return undefined;
      if (s.drag === "P") {
        const P = clampP(p, pt.x, pt.y);
        return { ...s, P, k: Math.max(1, Math.round(num(p, "N", 12))) };
      }
      const i = s.drag;
      const x = Math.max(VIEW_PT.xMin + 0.06, Math.min(VIEW_PT.xMax - 0.06, pt.x));
      const y = Math.max(VIEW_PT.yMin + 0.12, Math.min(VIEW_PT.yMax - 0.06, pt.y));
      // Evita sobrepor duas cargas (força infinita).
      if (s.charges.some((c, j) => j !== i && Math.hypot(c.x - x, c.y - y) < 0.06)) return undefined;
      return { ...s, charges: s.charges.map((c, j) => (j === i ? { ...c, x, y } : c)) };
    },
    up(s) {
      return s.drag !== null ? { ...s, drag: null } : undefined;
    },
    cursor(s, p, pt) {
      if (mode(p) !== MODE.pontuais) return Math.hypot(pt.x - s.P.x, pt.y - s.P.y) < HIT * 1.5 ? "grab" : undefined;
      return s.charges.some((c) => Math.hypot(c.x - pt.x, c.y - pt.y) < HIT) ? "grab" : undefined;
    },
  },

  actions: [
    {
      id: "somar",
      label: "Somar mais um elemento",
      run: (s, p) => {
        const N = Math.max(1, Math.round(num(p, "N", 12)));
        const k = Math.floor(s.k + 1e-9);
        return { ...s, k: k >= N ? 1 : k + 1 };
      },
    },
    { id: "tudo", label: "Somar todos", run: (s, p) => ({ ...s, k: Math.max(1, Math.round(num(p, "N", 12))) }) },
  ],

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const p = frame.params;
    if (mode(p) === MODE.pontuais) {
      d.grid(VIEW_PT.xMin, VIEW_PT.xMax, VIEW_PT.yMin, VIEW_PT.yMax, 0.25);
      renderPoints(d, liveCharges(frame.state, p));
    } else {
      d.grid(VIEW_CONT.xMin, 1.0, VIEW_CONT.yMin, VIEW_CONT.yMax, 0.25);
      renderContinuous(d, frame.state, p);
    }
  },
});

export default coulomb;
