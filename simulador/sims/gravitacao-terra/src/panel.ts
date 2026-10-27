import { formatBR, type Draw } from "@fisilab/core";

/** Retângulo do palco (coordenadas do mundo) onde um gráfico é desenhado. */
export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface Range {
  min: number;
  max: number;
  log?: boolean;
}

/** Marcas "redondas" (1, 2, 5 × 10^k) entre min e max. */
export function niceTicks(min: number, max: number, n = 5): number[] {
  const span = max - min;
  if (!(span > 0)) return [min];
  const raw = span / n;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  const out: number[] = [];
  for (let v = Math.ceil(min / step - 1e-9) * step; v <= max + step * 1e-9; v += step) out.push(Math.abs(v) < step * 1e-9 ? 0 : v);
  return out;
}

export const fmt = (v: number, digits = 3) => formatBR(v, digits);

/**
 * Gráfico embutido no palco: converte dados em coordenadas do mundo, desenha
 * moldura, grade e rótulos, e recorta as curvas à moldura.
 */
/** `font` escala os textos (telas estreitas); `ticks` é o número aproximado de marcas no eixo x. */
export function panel(d: Draw, box: Box, xr: Range, yr: Range, opt: { font?: number; ticks?: number } = {}) {
  const fz = opt.font ?? 1;
  const tf = (r: Range, v: number) => (r.log ? Math.log10(Math.max(v, 1e-300)) : v);
  const X = (v: number) => box.x0 + ((tf(xr, v) - tf(xr, xr.min)) / (tf(xr, xr.max) - tf(xr, xr.min))) * (box.x1 - box.x0);
  const Y = (v: number) => box.y0 + ((tf(yr, v) - tf(yr, yr.min)) / (tf(yr, yr.max) - tf(yr, yr.min))) * (box.y1 - box.y0);
  const { ctx, theme } = d;

  const logTicks = (r: Range) => {
    const out: number[] = [];
    for (let k = Math.ceil(Math.log10(r.min) - 1e-9); k <= Math.log10(r.max) + 1e-9; k++) out.push(10 ** k);
    return out;
  };

  const api = {
    X,
    Y,
    box,
    inside: (x: number, y: number) => x >= xr.min && x <= xr.max && y >= yr.min && y <= yr.max,
    /** Moldura, grade, marcas e rótulos dos eixos. */
    frame(opts: { xlabel?: string; ylabel?: string; xticks?: number[]; yticks?: number[]; fx?: (v: number) => string; fy?: (v: number) => string; zero?: boolean } = {}) {
      const xt = opts.xticks ?? (xr.log ? logTicks(xr) : niceTicks(xr.min, xr.max, opt.ticks ?? 5));
      const yt = opts.yticks ?? (yr.log ? logTicks(yr) : niceTicks(yr.min, yr.max, fz < 0.85 ? 3 : 4));
      const fx = opts.fx ?? ((v: number) => fmt(v));
      const fy = opts.fy ?? ((v: number) => fmt(v));
      for (const v of xt) {
        if (v < xr.min || v > xr.max) continue;
        d.line(X(v), box.y0, X(v), box.y1, { color: theme.grid, width: 1 });
        d.text(fx(v), X(v), box.y0, { color: theme.muted, size: 10 * fz, dy: 9 * fz });
      }
      for (const v of yt) {
        if (v < yr.min || v > yr.max) continue;
        d.line(box.x0, Y(v), box.x1, Y(v), { color: theme.grid, width: 1 });
        d.text(fy(v), box.x0, Y(v), { color: theme.muted, size: 10 * fz, align: "right", dx: -4 });
      }
      if (opts.zero !== false && !yr.log && yr.min < 0 && yr.max > 0) d.line(box.x0, Y(0), box.x1, Y(0), { color: theme.muted, width: 1 });
      if (opts.zero !== false && !xr.log && xr.min < 0 && xr.max > 0) d.line(X(0), box.y0, X(0), box.y1, { color: theme.muted, width: 1 });
      d.rect(box.x0, box.y0, box.x1 - box.x0, box.y1 - box.y0, { stroke: theme.muted, width: 1 });
      if (opts.xlabel) d.text(opts.xlabel, box.x1, box.y0, { color: theme.muted, size: 11 * fz, align: "right", dy: 22 * fz });
      if (opts.ylabel) d.text(opts.ylabel, box.x0, box.y1, { color: theme.muted, size: 11 * fz, align: "left", dy: -9 * fz });
    },
    /** Executa desenhos recortados à moldura. */
    clip(fn: () => void) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(box.x0, box.y0, box.x1 - box.x0, box.y1 - box.y0);
      ctx.clip();
      fn();
      ctx.restore();
    },
    /** Polilinha em coordenadas de dados (recortada). */
    line(pts: [number, number][], s: Parameters<Draw["polyline"]>[1] = {}) {
      api.clip(() => d.polyline(pts.filter(([, y]) => Number.isFinite(y)).map(([x, y]) => [X(x), Y(y)]), s));
    },
    /** Curva y = f(x) em coordenadas de dados (recortada). */
    plot(f: (x: number) => number, a: number, b: number, s: Parameters<Draw["polyline"]>[1] & { n?: number } = {}) {
      const n = s.n ?? 200;
      const pts: [number, number][] = [];
      for (let i = 0; i <= n; i++) {
        const x = xr.log ? 10 ** (Math.log10(a) + ((Math.log10(b) - Math.log10(a)) * i) / n) : a + ((b - a) * i) / n;
        pts.push([x, f(x)]);
      }
      api.line(pts, s);
    },
  };
  return api;
}

export type Panel = ReturnType<typeof panel>;
