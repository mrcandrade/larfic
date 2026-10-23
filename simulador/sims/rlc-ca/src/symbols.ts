import type { Draw } from "@fisilab/core";

/** Formata um valor com prefixo SI e vírgula decimal ("4,7 kΩ", "100 µF"). */
export function si(v: number, unit: string, digits = 3): string {
  if (!Number.isFinite(v)) return `— ${unit}`;
  if (v === 0) return `0 ${unit}`;
  const prefixes: [number, string][] = [
    [1e6, "M"],
    [1e3, "k"],
    [1, ""],
    [1e-3, "m"],
    [1e-6, "µ"],
    [1e-9, "n"],
  ];
  const a = Math.abs(v);
  const [f, pre] = prefixes.find(([f]) => a >= f * 0.9995) ?? prefixes[prefixes.length - 1]!;
  return `${Number((v / f).toPrecision(digits)).toString().replace(".", ",")} ${pre}${unit}`;
}

/** Vetor unitário e normal de um segmento. */
function frame(x1: number, y1: number, x2: number, y2: number) {
  const len = Math.hypot(x2 - x1, y2 - y1) || 1;
  const ux = (x2 - x1) / len;
  const uy = (y2 - y1) / len;
  return { len, ux, uy, nx: -uy, ny: ux, mx: (x1 + x2) / 2, my: (y1 + y2) / 2 };
}

export interface SymStyle {
  color: string;
  width?: number;
}

/** Resistor em zigue-zague ocupando o trecho central (meio-comprimento `half`). */
export function resistor(d: Draw, x1: number, y1: number, x2: number, y2: number, half: number, s: SymStyle) {
  const f = frame(x1, y1, x2, y2);
  const w = s.width ?? 2;
  const a: [number, number] = [f.mx - f.ux * half, f.my - f.uy * half];
  const b: [number, number] = [f.mx + f.ux * half, f.my + f.uy * half];
  d.line(x1, y1, a[0], a[1], { color: s.color, width: w });
  d.line(b[0], b[1], x2, y2, { color: s.color, width: w });
  const pts: [number, number][] = [a];
  const n = 6;
  const amp = 7 * d.px;
  for (let i = 0; i < n; i++) {
    const t = -half + (2 * half * (i + 0.5)) / n;
    const side = i % 2 === 0 ? 1 : -1;
    pts.push([f.mx + f.ux * t + f.nx * amp * side, f.my + f.uy * t + f.ny * amp * side]);
  }
  pts.push(b);
  d.polyline(pts, { color: s.color, width: w });
}

/** Capacitor: duas placas perpendiculares ao segmento, separadas por `gapPx`. Devolve os centros das placas. */
export function capacitor(d: Draw, x1: number, y1: number, x2: number, y2: number, s: SymStyle & { gapPx?: number; platePx?: number }) {
  const f = frame(x1, y1, x2, y2);
  const w = s.width ?? 2;
  const g = ((s.gapPx ?? 10) / 2) * d.px;
  const pl = ((s.platePx ?? 30) / 2) * d.px;
  const pa: [number, number] = [f.mx - f.ux * g, f.my - f.uy * g];
  const pb: [number, number] = [f.mx + f.ux * g, f.my + f.uy * g];
  d.line(x1, y1, pa[0], pa[1], { color: s.color, width: w });
  d.line(pb[0], pb[1], x2, y2, { color: s.color, width: w });
  for (const p of [pa, pb]) d.line(p[0] - f.nx * pl, p[1] - f.ny * pl, p[0] + f.nx * pl, p[1] + f.ny * pl, { color: s.color, width: w + 1.5 });
  return { pa, pb, nx: f.nx, ny: f.ny, ux: f.ux, uy: f.uy, pl, g };
}

/** Indutor: `loops` arcos ao longo do trecho central. */
export function inductor(d: Draw, x1: number, y1: number, x2: number, y2: number, half: number, s: SymStyle & { loops?: number }) {
  const f = frame(x1, y1, x2, y2);
  const w = s.width ?? 2;
  const n = s.loops ?? 4;
  const a: [number, number] = [f.mx - f.ux * half, f.my - f.uy * half];
  const b: [number, number] = [f.mx + f.ux * half, f.my + f.uy * half];
  d.line(x1, y1, a[0], a[1], { color: s.color, width: w });
  d.line(b[0], b[1], x2, y2, { color: s.color, width: w });
  const r = half / n;
  const pts: [number, number][] = [];
  for (let k = 0; k < n; k++) {
    const c = -half + r * (2 * k + 1);
    for (let j = 0; j <= 16; j++) {
      const th = Math.PI - (Math.PI * j) / 16;
      const t = c + r * Math.cos(th);
      const nn = r * 1.1 * Math.sin(th);
      pts.push([f.mx + f.ux * t + f.nx * nn, f.my + f.uy * t + f.ny * nn]);
    }
  }
  d.polyline(pts, { color: s.color, width: w });
}

/** Bateria (fonte DC): placa longa = terminal positivo, do lado de (x2, y2). */
export function battery(d: Draw, x1: number, y1: number, x2: number, y2: number, s: SymStyle) {
  const f = frame(x1, y1, x2, y2);
  const w = s.width ?? 2;
  const g = 5 * d.px;
  const pa: [number, number] = [f.mx - f.ux * g, f.my - f.uy * g];
  const pb: [number, number] = [f.mx + f.ux * g, f.my + f.uy * g];
  d.line(x1, y1, pa[0], pa[1], { color: s.color, width: w });
  d.line(pb[0], pb[1], x2, y2, { color: s.color, width: w });
  const short = 8 * d.px;
  const long = 17 * d.px;
  d.line(pa[0] - f.nx * short, pa[1] - f.ny * short, pa[0] + f.nx * short, pa[1] + f.ny * short, { color: s.color, width: w + 2 });
  d.line(pb[0] - f.nx * long, pb[1] - f.ny * long, pb[0] + f.nx * long, pb[1] + f.ny * long, { color: s.color, width: w });
  d.text("+", pb[0] + f.nx * long + f.ux * 9 * d.px, pb[1] + f.ny * long + f.uy * 9 * d.px, { color: s.color, size: 12, weight: "600" });
}

/** Fonte em círculo (gerador de funções) com um ícone de onda: "seno" ou "quadrada". */
export function generator(d: Draw, x1: number, y1: number, x2: number, y2: number, wave: "seno" | "quadrada", s: SymStyle) {
  const f = frame(x1, y1, x2, y2);
  const w = s.width ?? 2;
  const r = 16 * d.px;
  d.line(x1, y1, f.mx - f.ux * r, f.my - f.uy * r, { color: s.color, width: w });
  d.line(f.mx + f.ux * r, f.my + f.uy * r, x2, y2, { color: s.color, width: w });
  d.circle(f.mx, f.my, r, { stroke: s.color, width: w });
  const a = 9 * d.px;
  if (wave === "seno") d.plot((x) => f.my + 0.55 * a * Math.sin(((x - f.mx) / a) * Math.PI), f.mx - a, f.mx + a, { color: s.color, width: 1.6, n: 30 });
  else
    d.polyline(
      [
        [f.mx - a, f.my - 0.5 * a],
        [f.mx - a / 3, f.my - 0.5 * a],
        [f.mx - a / 3, f.my + 0.5 * a],
        [f.mx + a / 3, f.my + 0.5 * a],
        [f.mx + a / 3, f.my - 0.5 * a],
        [f.mx + a, f.my - 0.5 * a],
      ],
      { color: s.color, width: 1.6 },
    );
}

/** Seta de corrente no meio de um fio, com comprimento fixo em pixels; sinal de `i` define o sentido. */
export function currentArrow(d: Draw, x: number, y: number, ux: number, uy: number, i: number, color: string, label?: string) {
  if (Math.abs(i) < 1e-12) return;
  const sgn = Math.sign(i);
  const L = 26;
  d.arrowPx(x - sgn * ux * L * 0.5 * d.px, y - sgn * uy * L * 0.5 * d.px, sgn * ux, sgn * uy, L, { color, width: 2.5 });
  if (label) d.text(label, x - uy * 14 * d.px, y + ux * 14 * d.px, { color, size: 12, weight: "600" });
}
