/**
 * Desenho de instrumentos de bancada (multímetro, osciloscópio, gerador,
 * fonte, protoboard, cabos e símbolos de circuito) em coordenadas do mundo.
 * Arquivo compartilhado pelas sims de Física Experimental III: cada sim tem
 * uma cópia idêntica em src/bancada.ts (os pacotes de sims não dependem uns
 * dos outros).
 */
import type { Draw, Theme } from "@fisilab/core";

export type Pt = [number, number];

/** Formata com prefixo SI e vírgula decimal ("4,7 kΩ", "100 µF"). */
export function si(v: number, unit: string, digits = 3): string {
  if (!Number.isFinite(v)) return `— ${unit}`;
  if (v === 0) return `0 ${unit}`;
  const prefixes: [number, string][] = [
    [1e9, "G"],
    [1e6, "M"],
    [1e3, "k"],
    [1, ""],
    [1e-3, "m"],
    [1e-6, "µ"],
    [1e-9, "n"],
    [1e-12, "p"],
  ];
  const a = Math.abs(v);
  const [f, pre] = prefixes.find(([f]) => a >= f * 0.9995) ?? prefixes[prefixes.length - 1]!;
  return `${Number((v / f).toPrecision(digits)).toString().replace(".", ",")} ${pre}${unit}`;
}

/** Número com vírgula decimal e `digits` algarismos significativos. */
export function br(v: number, digits = 3): string {
  if (!Number.isFinite(v)) return "—";
  return Number(v.toPrecision(digits)).toString().replace(".", ",");
}

/** Cores fixas de bancada (cabos, mostradores), ajustadas ao tema. */
export function palette(theme: Theme) {
  const dark = theme.dark;
  return {
    red: dark ? "#ff5c50" : "#d42a1f",
    black: dark ? "#9aa1ab" : "#26292e",
    yellow: dark ? "#f2cf3d" : "#c99a00",
    blue: dark ? "#53b7ff" : "#1769c4",
    green: dark ? "#58d68d" : "#1e8a4c",
    panel: dark ? "#2a3038" : "#dde1e6",
    panel2: dark ? "#353c46" : "#c9ced6",
    dmmBody: dark ? "#a8861e" : "#e9b824",
    dmmFace: dark ? "#2b2f35" : "#3a3f46",
    lcdBg: dark ? "#3c4a33" : "#c3d1b1",
    lcdSeg: dark ? "#e8f8d6" : "#141a0e",
    ledBg: "#1b0b0b",
    ledSeg: "#ff4b3a",
    screen: "#0d1813",
    screenGrid: "rgba(190, 220, 200, 0.22)",
    screenAxis: "rgba(190, 220, 200, 0.5)",
    ch1: "#f5d742",
    ch2: "#3fd0f0",
    board: dark ? "#c7cbd0" : "#f3f2ec",
    boardHole: dark ? "#8b9097" : "#a9aaa4",
    copper: dark ? "#d9925a" : "#b8692f",
    resistorBody: "#d8b98a",
  };
}

// ---------------------------------------------------------------------------
// Mostradores de 7 segmentos

const SEGS: Record<string, string> = {
  "0": "abcdef",
  "1": "bc",
  "2": "abged",
  "3": "abgcd",
  "4": "fgbc",
  "5": "afgcd",
  "6": "afgedc",
  "7": "abc",
  "8": "abcdefg",
  "9": "abcdfg",
  "-": "g",
  O: "abcdef",
  L: "fed",
  E: "afged",
  r: "eg",
  n: "ceg",
  H: "bcefg",
  A: "abcefg",
  C: "afed",
  d: "bcdeg",
  u: "cde",
  P: "abefg",
  F: "aefg",
  o: "cdeg",
  h: "cefg",
  " ": "",
};

/**
 * Escreve `text` em 7 segmentos, alinhado à direita em (xRight, yBase).
 * `h` é a altura do dígito em unidades do mundo. Pontos e vírgulas acendem o
 * ponto decimal do dígito anterior. Segmentos apagados aparecem bem fracos,
 * como num LCD real.
 */
export function sevenSeg(d: Draw, text: string, xRight: number, yBase: number, h: number, color: string, slots?: number) {
  const chars: { c: string; dp: boolean }[] = [];
  for (const ch of text) {
    if ((ch === "." || ch === ",") && chars.length) chars[chars.length - 1]!.dp = true;
    else chars.push({ c: ch, dp: false });
  }
  const n = Math.max(slots ?? chars.length, chars.length);
  while (chars.length < n) chars.unshift({ c: " ", dp: false });
  const w = 0.52 * h;
  const pitch = w * 1.42;
  const th = Math.max(1.2, (0.12 * h) / d.px);
  const sl = 0.1 * h; // inclinação
  for (let i = 0; i < n; i++) {
    const { c, dp } = chars[i]!;
    const x0 = xRight - (n - i) * pitch + 0.18 * w;
    const on = SEGS[c] ?? "";
    const pts: Record<string, [Pt, Pt]> = {
      a: [[x0 + sl, yBase + h], [x0 + w + sl, yBase + h]],
      b: [[x0 + w + sl, yBase + h], [x0 + w + sl / 2, yBase + h / 2]],
      c: [[x0 + w + sl / 2, yBase + h / 2], [x0 + w, yBase]],
      d: [[x0, yBase], [x0 + w, yBase]],
      e: [[x0 + sl / 2, yBase + h / 2], [x0, yBase]],
      f: [[x0 + sl, yBase + h], [x0 + sl / 2, yBase + h / 2]],
      g: [[x0 + sl / 2, yBase + h / 2], [x0 + w + sl / 2, yBase + h / 2]],
    };
    const gap = 0.07 * h;
    for (const k of "abcdefg") {
      const [p, q] = pts[k]!;
      const L = Math.hypot(q[0] - p[0], q[1] - p[1]);
      const ux = (q[0] - p[0]) / L;
      const uy = (q[1] - p[1]) / L;
      d.line(p[0] + ux * gap, p[1] + uy * gap, q[0] - ux * gap, q[1] - uy * gap, { color, width: th, alpha: on.includes(k) ? 1 : 0.07 });
    }
    d.dot(x0 + w + 0.22 * w, yBase + 0.02 * h, (0.7 * th) / 1, color, dp ? 1 : 0.07);
  }
  return n * pitch;
}

/** Texto de multímetro com 4000 contagens (3¾ dígitos); "OL" fora da escala. */
export function dmmText(v: number, full = 4000): string {
  if (!Number.isFinite(v)) return " OL";
  const a = Math.abs(v);
  let dec = 3;
  while (dec > 0 && a * 10 ** dec >= full - 0.5) dec--;
  if (a * 10 ** dec >= full - 0.5) return " OL";
  return (v < 0 && a * 10 ** dec >= 0.5 ? "-" : "") + a.toFixed(dec);
}

// ---------------------------------------------------------------------------
// Instrumentos

/** Borne (jack) colorido. */
export function jack(d: Draw, x: number, y: number, color: string, label?: string, labelColor?: string) {
  d.circle(x, y, 7 * d.px, { fill: color, stroke: "#111", width: 1 });
  d.circle(x, y, 3 * d.px, { fill: "#111" });
  if (label) d.text(label, x, y - 13 * d.px, { size: 9, color: labelColor ?? color, weight: "600" });
}

/** Cabo flexível entre dois pontos, com uma barriga para baixo (curva de Bézier quadrática). */
export function cable(d: Draw, a: Pt, b: Pt, color: string, sag = 0.6, width = 3) {
  const mx = (a[0] + b[0]) / 2;
  const my = Math.min(a[1], b[1]) - sag;
  const pts: Pt[] = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    const u = 1 - t;
    pts.push([u * u * a[0] + 2 * u * t * mx + t * t * b[0], u * u * a[1] + 2 * u * t * my + t * t * b[1]]);
  }
  d.polyline(pts, { color, width });
  d.dot(a[0], a[1], width * 0.9, color);
  d.dot(b[0], b[1], width * 0.9, color);
}

/** Fio rígido em segmentos retos (protoboard e esquemas). */
export function wire(d: Draw, pts: Pt[], color: string, width = 2.5) {
  d.polyline(pts, { color, width });
}

export interface DmmOptions {
  /** Texto do mostrador (use `dmmText`). */
  text: string;
  /** Unidade à direita do mostrador ("V", "mA", "Hz"). */
  unit: string;
  /** Função selecionada, mostrada acima ("V~", "V⎓", "A⎓"). */
  mode: string;
  /** Rótulo pequeno no canto (ex.: "TRUE RMS"). */
  badge?: string;
  /** Segunda linha opcional (ex.: frequência). */
  sub?: string;
  /** Rótulo do instrumento abaixo do corpo. */
  title?: string;
  w?: number;
  h?: number;
}

/**
 * Multímetro digital de bancada/portátil: corpo amarelo, LCD de 7 segmentos,
 * seletor rotativo e bornes COM (preto) e V/A (vermelho). Devolve as posições
 * dos bornes para ligar cabos.
 */
export function multimeter(d: Draw, theme: Theme, x: number, y: number, o: DmmOptions): { com: Pt; hi: Pt } {
  const c = palette(theme);
  const w = o.w ?? 3.4;
  const h = o.h ?? 4.6;
  d.rect(x, y, w, h, { fill: c.dmmBody, stroke: theme.dark ? "#000" : "#6b5410", width: 1.2 });
  d.rect(x + 0.18, y + 0.18, w - 0.36, h - 0.36, { fill: c.dmmFace });
  // LCD
  const lw = w - 0.6;
  const lh = 1.35;
  const lx = x + 0.3;
  const ly = y + h - 0.35 - lh;
  d.rect(lx, ly, lw, lh, { fill: c.lcdBg, stroke: "#111", width: 1 });
  const dh = 0.62;
  sevenSeg(d, o.text, lx + lw - 0.62, ly + 0.36, dh, c.lcdSeg, 4);
  d.text(o.unit, lx + lw - 0.1, ly + 0.5, { align: "right", size: 11, weight: "700", color: c.lcdSeg });
  d.text(o.mode, lx + 0.1, ly + lh - 0.2, { align: "left", size: 9, weight: "700", color: c.lcdSeg });
  if (o.badge) d.text(o.badge, lx + lw - 0.1, ly + lh - 0.2, { align: "right", size: 8, weight: "700", color: c.lcdSeg });
  if (o.sub) d.text(o.sub, lx + 0.1, ly + 0.17, { align: "left", size: 8, color: c.lcdSeg });
  // Seletor rotativo
  const kx = x + w / 2;
  const ky = y + 1.75;
  d.circle(kx, ky, 0.62, { fill: "#20242a", stroke: "#000", width: 1 });
  d.line(kx, ky, kx + 0.5 * Math.cos(2.2), ky + 0.5 * Math.sin(2.2), { color: "#f2f2f2", width: 3 });
  for (let k = 0; k < 9; k++) {
    const a = Math.PI * (0.15 + (0.7 * k) / 8) + Math.PI * 0.0;
    d.line(kx + 0.72 * Math.cos(a), ky + 0.72 * Math.sin(a), kx + 0.82 * Math.cos(a), ky + 0.82 * Math.sin(a), { color: "#e9e9e9", width: 1 });
  }
  // Bornes
  const com: Pt = [x + w * 0.3, y + 0.55];
  const hi: Pt = [x + w * 0.7, y + 0.55];
  jack(d, com[0], com[1], "#1a1a1a", "COM", "#e8e8e8");
  jack(d, hi[0], hi[1], "#d42a1f", o.unit.includes("A") ? "A" : "VΩHz", "#ffb0a8");
  if (o.title) d.text(o.title, x + w / 2, y - 0.3, { size: 11, weight: "600", color: theme.text });
  return { com, hi };
}

/** Painel genérico de instrumento (fonte, gerador, osciloscópio). */
export function panel(d: Draw, theme: Theme, x: number, y: number, w: number, h: number, title?: string) {
  const c = palette(theme);
  d.rect(x, y, w, h, { fill: c.panel, stroke: theme.muted, width: 1.2 });
  if (title) d.text(title, x + 0.2, y + h - 0.28, { align: "left", size: 10, weight: "700", color: theme.muted });
}

/** Mostrador de LEDs vermelhos (gerador de funções, fonte DC). */
export function ledDisplay(d: Draw, theme: Theme, x: number, y: number, w: number, h: number, text: string, unit: string, slots = 5) {
  const c = palette(theme);
  d.rect(x, y, w, h, { fill: c.ledBg, stroke: "#000", width: 1 });
  const dh = h * 0.55;
  sevenSeg(d, text, x + w - 0.75, y + (h - dh) / 2, dh, c.ledSeg, slots);
  d.text(unit, x + w - 0.08, y + h / 2, { align: "right", size: 10, weight: "700", color: c.ledSeg });
}

/** Botão rotativo com marca; `frac` em [0, 1] gira de −135° a +135°. */
export function knob(d: Draw, theme: Theme, x: number, y: number, r: number, frac: number, label?: string) {
  d.circle(x, y, r, { fill: theme.dark ? "#15181c" : "#2c3036", stroke: "#000", width: 1 });
  const a = Math.PI / 2 + (0.75 * Math.PI) * (1 - 2 * Math.max(0, Math.min(1, frac)));
  d.line(x, y, x + 0.8 * r * Math.cos(a), y + 0.8 * r * Math.sin(a), { color: "#f0f0f0", width: 2.2 });
  if (label) d.text(label, x, y - r - 0.22, { size: 9, color: theme.text });
}

/** LED indicador pequeno. */
export function led(d: Draw, x: number, y: number, on: boolean, color = "#36d26b") {
  d.circle(x, y, 4 * d.px, { fill: on ? color : "#3a3f3a", stroke: "#000", width: 0.8 });
}

/**
 * Tela do osciloscópio: fundo escuro, retículo de nx × ny divisões com
 * subdivisões nos eixos centrais. Devolve o tamanho de uma divisão.
 */
export function scopeScreen(d: Draw, theme: Theme, x: number, y: number, w: number, h: number, nx = 10, ny = 8) {
  const c = palette(theme);
  d.rect(x, y, w, h, { fill: c.screen, stroke: "#000", width: 1.5 });
  const dx = w / nx;
  const dy = h / ny;
  for (let i = 1; i < nx; i++) d.line(x + i * dx, y, x + i * dx, y + h, { color: c.screenGrid, width: 1, dash: i === nx / 2 ? [] : [1, 3] });
  for (let j = 1; j < ny; j++) d.line(x, y + j * dy, x + w, y + j * dy, { color: c.screenGrid, width: 1, dash: j === ny / 2 ? [] : [1, 3] });
  const cx = x + w / 2;
  const cy = y + h / 2;
  for (let k = 1; k < nx * 5; k++) d.line(x + (k * dx) / 5, cy - 0.06 * dy, x + (k * dx) / 5, cy + 0.06 * dy, { color: c.screenAxis, width: 1 });
  for (let k = 1; k < ny * 5; k++) d.line(cx - 0.06 * dx, y + (k * dy) / 5, cx + 0.06 * dx, y + (k * dy) / 5, { color: c.screenAxis, width: 1 });
  return { dx, dy };
}

/** Executa `fn` com o desenho recortado ao retângulo dado. */
export function clipped(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fn: () => void) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  fn();
  ctx.restore();
}

/** Protoboard: placa clara com furos em grade e trilhas de alimentação. */
export function protoboard(d: Draw, theme: Theme, x: number, y: number, w: number, h: number) {
  const c = palette(theme);
  d.rect(x, y, w, h, { fill: c.board, stroke: theme.muted, width: 1 });
  const step = 0.3;
  for (let yy = y + 0.25; yy < y + h - 0.1; yy += step) {
    if (Math.abs(yy - (y + h / 2)) < 0.2) continue;
    for (let xx = x + 0.25; xx < x + w - 0.1; xx += step) d.dot(xx, yy, 1.3, c.boardHole);
  }
  d.line(x + 0.1, y + h / 2, x + w - 0.1, y + h / 2, { color: c.boardHole, width: 4, alpha: 0.6 });
  d.line(x + 0.1, y + 0.08, x + w - 0.1, y + 0.08, { color: "#2f6fd9", width: 1.2, alpha: 0.7 });
  d.line(x + 0.1, y + h - 0.08, x + w - 0.1, y + h - 0.08, { color: "#d9453b", width: 1.2, alpha: 0.7 });
}

// ---------------------------------------------------------------------------
// Componentes físicos e símbolos

const BAND = ["#000000", "#7b3f00", "#d40000", "#ff8c00", "#f2d000", "#119c2d", "#1f4fd8", "#7d2fb5", "#8a8a8a", "#ffffff"];

/** Faixas do código de cores para um valor nominal (2 algarismos + multiplicador + tolerância dourada). */
export function colorBands(R: number): string[] {
  if (!(R > 0)) return [BAND[0]!, BAND[0]!, BAND[0]!, "#c9a227"];
  let e = Math.floor(Math.log10(R)) - 1;
  let m = Math.round(R / 10 ** e);
  if (m >= 100) {
    m = Math.round(m / 10);
    e += 1;
  }
  const d1 = Math.floor(m / 10);
  const d2 = m % 10;
  const mult = e < 0 ? "#c9a227" : BAND[Math.min(9, e)]!;
  return [BAND[d1]!, BAND[d2]!, mult, "#c9a227"];
}

/** Resistor de verdade (corpo bege com faixas), entre dois pontos, com terminais. */
export function resistorBody(d: Draw, a: Pt, b: Pt, R: number, lenPx = 46) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  const ux = (b[0] - a[0]) / L;
  const uy = (b[1] - a[1]) / L;
  const mx = (a[0] + b[0]) / 2;
  const my = (a[1] + b[1]) / 2;
  const half = Math.min((lenPx / 2) * d.px, L * 0.4);
  d.line(a[0], a[1], mx - ux * half, my - uy * half, { color: "#9b9b9b", width: 1.8 });
  d.line(mx + ux * half, my + uy * half, b[0], b[1], { color: "#9b9b9b", width: 1.8 });
  d.box(mx, my, 2 * half, 13 * d.px, Math.atan2(uy, ux), { fill: "#d8b98a", stroke: "#8a6c40", width: 1 });
  const bands = colorBands(R);
  bands.forEach((col, i) => {
    const t = -half * 0.62 + i * half * 0.36 + (i === 3 ? half * 0.18 : 0);
    d.box(mx + ux * t, my + uy * t, 3.5 * d.px, 13 * d.px, Math.atan2(uy, ux), { fill: col });
  });
}

/** Resistor em zigue-zague (símbolo) ocupando o trecho central de meio-comprimento `half`. */
export function resistorSym(d: Draw, a: Pt, b: Pt, half: number, color: string, width = 2) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  const ux = (b[0] - a[0]) / L;
  const uy = (b[1] - a[1]) / L;
  const nx = -uy;
  const ny = ux;
  const mx = (a[0] + b[0]) / 2;
  const my = (a[1] + b[1]) / 2;
  const p: Pt = [mx - ux * half, my - uy * half];
  const q: Pt = [mx + ux * half, my + uy * half];
  d.line(a[0], a[1], p[0], p[1], { color, width });
  d.line(q[0], q[1], b[0], b[1], { color, width });
  const pts: Pt[] = [p];
  const amp = 6 * d.px;
  for (let i = 0; i < 6; i++) {
    const t = -half + (2 * half * (i + 0.5)) / 6;
    const s = i % 2 === 0 ? 1 : -1;
    pts.push([mx + ux * t + nx * amp * s, my + uy * t + ny * amp * s]);
  }
  pts.push(q);
  d.polyline(pts, { color, width });
}

/** Diodo (triângulo + barra) de a (anodo) para b (catodo). `zener` dobra as pontas da barra. */
export function diodeSym(d: Draw, a: Pt, b: Pt, color: string, opts: { zener?: boolean; led?: string; width?: number } = {}) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  const ux = (b[0] - a[0]) / L;
  const uy = (b[1] - a[1]) / L;
  const nx = -uy;
  const ny = ux;
  const mx = (a[0] + b[0]) / 2;
  const my = (a[1] + b[1]) / 2;
  const s = 9 * d.px;
  const w = opts.width ?? 2;
  d.line(a[0], a[1], mx - ux * s, my - uy * s, { color, width: w });
  d.line(mx + ux * s, my + uy * s, b[0], b[1], { color, width: w });
  d.polyline(
    [
      [mx - ux * s + nx * s, my - uy * s + ny * s],
      [mx + ux * s, my + uy * s],
      [mx - ux * s - nx * s, my - uy * s - ny * s],
    ],
    { color, width: w, close: true, fill: opts.led ?? "none" },
  );
  const bx = mx + ux * s;
  const by = my + uy * s;
  d.line(bx + nx * s, by + ny * s, bx - nx * s, by - ny * s, { color, width: w + 0.5 });
  if (opts.zener) {
    d.line(bx + nx * s, by + ny * s, bx + nx * s + ux * 4 * d.px, by + ny * s + uy * 4 * d.px, { color, width: w });
    d.line(bx - nx * s, by - ny * s, bx - nx * s - ux * 4 * d.px, by - ny * s - uy * 4 * d.px, { color, width: w });
  }
  if (opts.led) {
    for (const o of [0, 7]) {
      const ox = mx + nx * (s + 4 * d.px) + ux * (o - 4) * d.px;
      const oy = my + ny * (s + 4 * d.px) + uy * (o - 4) * d.px;
      d.arrowPx(ox, oy, nx + ux * 0.6, ny + uy * 0.6, 12, { color: opts.led, width: 1.4, head: 5 });
    }
  }
}

/** Lâmpada: círculo com X; `glow` em [0, 1] desenha o brilho do filamento. */
export function lampSym(d: Draw, a: Pt, b: Pt, color: string, glow = 0) {
  const mx = (a[0] + b[0]) / 2;
  const my = (a[1] + b[1]) / 2;
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  const ux = (b[0] - a[0]) / L;
  const uy = (b[1] - a[1]) / L;
  const r = 13 * d.px;
  if (glow > 0.02) {
    d.circle(mx, my, r * (1.4 + 1.2 * glow), { fill: "#ffd54a", alpha: 0.18 + 0.4 * glow });
    d.circle(mx, my, r * 1.2, { fill: "#ffe680", alpha: 0.5 * glow });
  }
  d.line(a[0], a[1], mx - ux * r, my - uy * r, { color, width: 2 });
  d.line(mx + ux * r, my + uy * r, b[0], b[1], { color, width: 2 });
  d.circle(mx, my, r, { stroke: color, width: 2 });
  const k = r * 0.7;
  d.line(mx - k, my - k, mx + k, my + k, { color, width: 1.6 });
  d.line(mx - k, my + k, mx + k, my - k, { color, width: 1.6 });
}

/** Bateria/fonte DC: placa longa (+) do lado de b. */
export function batterySym(d: Draw, a: Pt, b: Pt, color: string, label?: string) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  const ux = (b[0] - a[0]) / L;
  const uy = (b[1] - a[1]) / L;
  const nx = -uy;
  const ny = ux;
  const mx = (a[0] + b[0]) / 2;
  const my = (a[1] + b[1]) / 2;
  const g = 4 * d.px;
  d.line(a[0], a[1], mx - ux * g, my - uy * g, { color, width: 2 });
  d.line(mx + ux * g, my + uy * g, b[0], b[1], { color, width: 2 });
  const s = 7 * d.px;
  const l = 15 * d.px;
  d.line(mx - ux * g - nx * s, my - uy * g - ny * s, mx - ux * g + nx * s, my - uy * g + ny * s, { color, width: 4 });
  d.line(mx + ux * g - nx * l, my + uy * g - ny * l, mx + ux * g + nx * l, my + uy * g + ny * l, { color, width: 2 });
  d.text("+", mx + ux * (g + 9 * d.px) + nx * l, my + uy * (g + 9 * d.px) + ny * l, { color, size: 12, weight: "700" });
  if (label) d.text(label, mx - nx * (l + 8 * d.px), my - ny * (l + 8 * d.px), { color, size: 12, align: nx > 0 ? "right" : "left" });
}

/** Fonte CA (círculo com senoide). */
export function acSourceSym(d: Draw, a: Pt, b: Pt, color: string) {
  const mx = (a[0] + b[0]) / 2;
  const my = (a[1] + b[1]) / 2;
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  const ux = (b[0] - a[0]) / L;
  const uy = (b[1] - a[1]) / L;
  const r = 14 * d.px;
  d.line(a[0], a[1], mx - ux * r, my - uy * r, { color, width: 2 });
  d.line(mx + ux * r, my + uy * r, b[0], b[1], { color, width: 2 });
  d.circle(mx, my, r, { stroke: color, width: 2 });
  const s = 8 * d.px;
  d.plot((x) => my + 0.5 * s * Math.sin(((x - mx) / s) * Math.PI), mx - s, mx + s, { color, width: 1.5, n: 24 });
}

/** Seta de corrente de comprimento fixo; o sinal de `i` dá o sentido ao longo de (ux, uy). */
export function currentArrow(d: Draw, x: number, y: number, ux: number, uy: number, i: number, color: string, label?: string, labelSide = 1) {
  if (!Number.isFinite(i) || Math.abs(i) < 1e-15) return;
  const s = Math.sign(i);
  const L = 24;
  d.arrowPx(x - s * ux * L * 0.5 * d.px, y - s * uy * L * 0.5 * d.px, s * ux, s * uy, L, { color, width: 2.4 });
  if (label) d.text(label, x - uy * 15 * d.px * labelSide, y + ux * 15 * d.px * labelSide, { color, size: 11, weight: "600" });
}

/** Ponto de nó (solda). */
export function node(d: Draw, x: number, y: number, color: string) {
  d.dot(x, y, 3.5, color);
}
