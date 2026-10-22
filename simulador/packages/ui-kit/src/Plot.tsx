import { useCallback, useEffect, useRef, useState } from "react";
import type { Theme } from "@fisilab/core";

export interface PlotSeries {
  label: string;
  /** Pares (x, y). Para linhas, a ordem dos pontos é preservada (curvas paramétricas funcionam). */
  points: [number, number][];
  color?: string;
  kind?: "line" | "scatter";
  /** Barras de erro por ponto (mesmo tamanho de `points`). */
  yErr?: number[];
  xErr?: number[];
  dash?: number[];
  width?: number;
}

export interface PlotProps {
  series: PlotSeries[];
  xLabel: string;
  yLabel: string;
  theme: Theme;
  height?: number;
  logX?: boolean;
  logY?: boolean;
  /** Força o intervalo dos eixos; sem isso, ajusta aos dados. */
  xRange?: [number, number];
  yRange?: [number, number];
  /** Inclui o zero no eixo y (útil para energias). */
  includeZero?: boolean;
  ariaLabel?: string;
}

const M = { left: 58, right: 14, top: 12, bottom: 40 };

function niceTicks(lo: number, hi: number, n = 6): number[] {
  if (!(hi > lo)) return [lo];
  const raw = (hi - lo) / n;
  const p = 10 ** Math.floor(Math.log10(raw));
  const m = raw / p;
  const step = (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-9; v += step) out.push(Math.abs(v) < step * 1e-9 ? 0 : v);
  return out;
}

export function fmtAxis(v: number): string {
  const a = Math.abs(v);
  if (a !== 0 && (a >= 1e5 || a < 1e-3)) return v.toExponential(1).replace(".", ",").replace("e", "e");
  return String(+v.toPrecision(5)).replace(".", ",");
}

/**
 * Gráfico em canvas com linhas paramétricas, pontos com barras de erro e
 * escalas log. Mostra a leitura do ponto mais próximo ao passar o mouse.
 */
export function Plot({ series, xLabel, yLabel, theme, height = 260, logX, logY, xRange, yRange, includeZero, ariaLabel }: PlotProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hover, setHover] = useState<{ x: number; y: number; px: number; py: number; label: string } | null>(null);
  const mapRef = useRef<{ X: (v: number) => number; Y: (v: number) => number; invX: (p: number) => number } | null>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const dpr = window.devicePixelRatio || 1;
    const W = wrap.clientWidth;
    const H = height;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.height = `${H}px`;
    const ctx = canvas.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    const tx = (v: number) => (logX ? Math.log10(v) : v);
    const ty = (v: number) => (logY ? Math.log10(v) : v);
    const ok = (x: number, y: number) => Number.isFinite(tx(x)) && Number.isFinite(ty(y));

    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const s of series)
      s.points.forEach(([x, y], i) => {
        if (!ok(x, y)) return;
        const ey = s.yErr?.[i] ?? 0;
        const ex = s.xErr?.[i] ?? 0;
        const fin = (a: number, b: number) => (Number.isFinite(a) ? a : b);
        x0 = Math.min(x0, fin(tx(x - ex), tx(x)));
        x1 = Math.max(x1, fin(tx(x + ex), tx(x)));
        y0 = Math.min(y0, fin(ty(y - ey), ty(y)));
        y1 = Math.max(y1, fin(ty(y + ey), ty(y)));
      });
    if (xRange) [x0, x1] = [tx(xRange[0]), tx(xRange[1])];
    if (yRange) [y0, y1] = [ty(yRange[0]), ty(yRange[1])];
    if (!Number.isFinite(x0)) [x0, x1] = [0, 1];
    if (!Number.isFinite(y0)) [y0, y1] = [0, 1];
    if (includeZero && !logY) [y0, y1] = [Math.min(0, y0), Math.max(0, y1)];
    // Intervalo degenerado (série constante): abre ±10% do valor, ou ±1 em torno de zero.
    const widen = (a: number, b: number): [number, number] => {
      if (b - a > 1e-12 * Math.max(Math.abs(a), Math.abs(b))) return [a, b];
      const h = Math.abs(a) > 1e-300 ? Math.abs(a) * 0.1 : 1;
      return [a - h, b + h];
    };
    [x0, x1] = widen(x0, x1);
    [y0, y1] = widen(y0, y1);
    if (!yRange) {
      const pad = (y1 - y0) * 0.06;
      y0 -= pad;
      y1 += pad;
    }

    const pw = W - M.left - M.right;
    const ph = H - M.top - M.bottom;
    const X = (v: number) => M.left + ((tx(v) - x0) / (x1 - x0)) * pw;
    const Y = (v: number) => M.top + ph - ((ty(v) - y0) / (y1 - y0)) * ph;
    mapRef.current = { X, Y, invX: (p) => x0 + ((p - M.left) / pw) * (x1 - x0) };

    // Grade e rótulos
    ctx.font = "11px system-ui, sans-serif";
    ctx.strokeStyle = theme.grid;
    ctx.fillStyle = theme.muted;
    ctx.lineWidth = 1;
    const xt = logX ? decades(x0, x1) : niceTicks(x0, x1);
    const yt = logY ? decades(y0, y1) : niceTicks(y0, y1, 5);
    ctx.beginPath();
    for (const v of xt) {
      const p = M.left + ((v - x0) / (x1 - x0)) * pw;
      ctx.moveTo(p, M.top);
      ctx.lineTo(p, M.top + ph);
    }
    for (const v of yt) {
      const p = M.top + ph - ((v - y0) / (y1 - y0)) * ph;
      ctx.moveTo(M.left, p);
      ctx.lineTo(M.left + pw, p);
    }
    ctx.stroke();
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    for (const v of xt) ctx.fillText(logX ? `10^${v}` : fmtAxis(v), M.left + ((v - x0) / (x1 - x0)) * pw, M.top + ph + 4);
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (const v of yt) ctx.fillText(logY ? `10^${v}` : fmtAxis(v), M.left - 5, M.top + ph - ((v - y0) / (y1 - y0)) * ph);
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillStyle = theme.text;
    ctx.fillText(xLabel, M.left + pw / 2, H - 2);
    ctx.save();
    ctx.translate(12, M.top + ph / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textBaseline = "middle";
    ctx.fillText(yLabel, 0, 0);
    ctx.restore();

    // Zero
    if (!logY && y0 < 0 && y1 > 0) {
      ctx.strokeStyle = theme.muted;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.moveTo(M.left, Y(0));
      ctx.lineTo(M.left + pw, Y(0));
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    ctx.save();
    ctx.beginPath();
    ctx.rect(M.left, M.top, pw, ph);
    ctx.clip();
    series.forEach((s, si) => {
      const color = s.color ?? theme.series[si % theme.series.length]!;
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = s.width ?? 2;
      ctx.setLineDash(s.dash ?? []);
      if ((s.kind ?? "line") === "line") {
        ctx.beginPath();
        let pen = false;
        for (const [x, y] of s.points) {
          if (!ok(x, y)) {
            pen = false;
            continue;
          }
          if (pen) ctx.lineTo(X(x), Y(y));
          else ctx.moveTo(X(x), Y(y));
          pen = true;
        }
        ctx.stroke();
      } else {
        s.points.forEach(([x, y], i) => {
          if (!ok(x, y)) return;
          const ey = s.yErr?.[i];
          const ex = s.xErr?.[i];
          ctx.lineWidth = 1.2;
          if (ey) {
            ctx.beginPath();
            ctx.moveTo(X(x), Y(y - ey));
            ctx.lineTo(X(x), Y(y + ey));
            ctx.moveTo(X(x) - 3, Y(y - ey));
            ctx.lineTo(X(x) + 3, Y(y - ey));
            ctx.moveTo(X(x) - 3, Y(y + ey));
            ctx.lineTo(X(x) + 3, Y(y + ey));
            ctx.stroke();
          }
          if (ex) {
            ctx.beginPath();
            ctx.moveTo(X(x - ex), Y(y));
            ctx.lineTo(X(x + ex), Y(y));
            ctx.stroke();
          }
          ctx.beginPath();
          ctx.arc(X(x), Y(y), 3.5, 0, 2 * Math.PI);
          ctx.fill();
        });
      }
      ctx.setLineDash([]);
    });
    ctx.restore();

    // Legenda quando há mais de uma série
    if (series.length > 1) {
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      let lx = M.left + 8;
      series.forEach((s, si) => {
        const color = s.color ?? theme.series[si % theme.series.length]!;
        ctx.fillStyle = color;
        ctx.fillRect(lx, M.top + 6, 12, 3);
        ctx.fillStyle = theme.text;
        ctx.fillText(s.label, lx + 16, M.top + 8);
        lx += 24 + ctx.measureText(s.label).width;
      });
    }
  }, [series, xLabel, yLabel, theme, height, logX, logY, xRange, yRange, includeZero]);

  useEffect(() => {
    draw();
    const wrap = wrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(() => draw());
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [draw]);

  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const map = mapRef.current;
    if (!map) return;
    const r = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - r.left;
    const my = e.clientY - r.top;
    let best: typeof hover = null;
    let bd = 400;
    for (const s of series)
      for (const [x, y] of s.points) {
        const d = (map.X(x) - mx) ** 2 + (map.Y(y) - my) ** 2;
        if (Number.isFinite(d) && d < bd) {
          bd = d;
          best = { x, y, px: map.X(x), py: map.Y(y), label: s.label };
        }
      }
    setHover(best);
  };

  return (
    <div ref={wrapRef} className="fl-plot">
      <canvas ref={canvasRef} role="img" aria-label={ariaLabel ?? `Gráfico de ${yLabel} por ${xLabel}`} onPointerMove={onMove} onPointerLeave={() => setHover(null)} />
      {hover && (
        <div className="fl-plot-tip" style={{ left: hover.px, top: hover.py }}>
          {series.length > 1 && <strong>{hover.label}: </strong>}({fmtAxis(hover.x)}; {fmtAxis(hover.y)})
        </div>
      )}
    </div>
  );
}

function decades(lo: number, hi: number): number[] {
  const out: number[] = [];
  for (let d = Math.ceil(lo); d <= Math.floor(hi); d++) out.push(d);
  return out.length ? out : [lo];
}
