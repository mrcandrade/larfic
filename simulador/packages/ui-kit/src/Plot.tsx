import { useCallback, useEffect, useRef, useState } from "react";
import { lightTheme, type Theme } from "@fisilab/core";

export interface PlotSeries {
  label: string;
  /** Pares (x, y). Para linhas, a ordem dos pontos é preservada (curvas paramétricas funcionam). */
  points: [number, number][];
  color?: string;
  /** "band": faixa preenchida entre y (em `points`) e `hi` (ex.: faixa de confiança do ajuste). */
  kind?: "line" | "scatter" | "band";
  /** Barras de erro por ponto (mesmo tamanho de `points`). */
  yErr?: number[];
  xErr?: number[];
  /** Limite superior da faixa (kind "band"). */
  hi?: number[];
  dash?: number[];
  width?: number;
  /** Esconde da legenda. */
  legend?: boolean;
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

const SUPS = "⁰¹²³⁴⁵⁶⁷⁸⁹";
/** 10 elevado a um inteiro com sobrescrito Unicode: 10⁻³. */
export function powerOfTen(e: number): string {
  return `10${e < 0 ? "⁻" : ""}${String(Math.abs(Math.round(e)))
    .split("")
    .map((d) => SUPS[Number(d)])
    .join("")}`;
}

export interface RenderOptions {
  /** Tamanho base da fonte em px (padrão 11). Margens acompanham. */
  font?: number;
  /** Título desenhado no topo (exportação). */
  title?: string;
  /** Pinta o fundo (exportação); sem isso, o canvas fica transparente. */
  background?: string;
}

export interface PlotMap {
  X: (v: number) => number;
  Y: (v: number) => number;
}

/** Desenha o gráfico num contexto 2D de W × H (em px CSS). Usado na tela e na exportação PNG. */
export function renderPlot(ctx: CanvasRenderingContext2D, W: number, H: number, props: PlotProps, opts: RenderOptions = {}): PlotMap {
  const { series, xLabel, yLabel, theme, logX, logY, xRange, yRange, includeZero } = props;
  const fs = opts.font ?? 11;
  const k = fs / 11;
  const M = { left: 58 * k, right: 14 * k, top: (opts.title ? 30 : 12) * k, bottom: 40 * k };
  if (opts.background) {
    ctx.fillStyle = opts.background;
    ctx.fillRect(0, 0, W, H);
  } else ctx.clearRect(0, 0, W, H);

  const tx = (v: number) => (logX ? Math.log10(v) : v);
  const ty = (v: number) => (logY ? Math.log10(v) : v);
  const ok = (x: number, y: number) => Number.isFinite(tx(x)) && Number.isFinite(ty(y));

  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  const fin = (a: number, b: number) => (Number.isFinite(a) ? a : b);
  for (const s of series)
    s.points.forEach(([x, y], i) => {
      if (!ok(x, y)) return;
      const ey = s.yErr?.[i] ?? 0;
      const ex = s.xErr?.[i] ?? 0;
      x0 = Math.min(x0, fin(tx(x - ex), tx(x)));
      x1 = Math.max(x1, fin(tx(x + ex), tx(x)));
      y0 = Math.min(y0, fin(ty(y - ey), ty(y)));
      y1 = Math.max(y1, fin(ty(y + ey), ty(y)));
      const h = s.hi?.[i];
      if (h !== undefined && Number.isFinite(ty(h))) y1 = Math.max(y1, ty(h));
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
  const PX = (t: number) => M.left + ((t - x0) / (x1 - x0)) * pw;
  const PY = (t: number) => M.top + ph - ((t - y0) / (y1 - y0)) * ph;

  // Grade e rótulos
  ctx.font = `${fs}px system-ui, sans-serif`;
  ctx.lineWidth = Math.max(1, k);
  const xt = logX ? logTicks(x0, x1) : niceTicks(x0, x1);
  const yt = logY ? logTicks(y0, y1) : niceTicks(y0, y1, 5);
  const lab = (v: number, log?: boolean) => (log ? logLabel(v) : fmtAxis(v));
  // Subdivisões das décadas (2…9) em escala log, mais claras.
  ctx.strokeStyle = theme.grid;
  ctx.globalAlpha = 0.45;
  ctx.beginPath();
  if (logX) for (const t of minorLog(x0, x1)) (ctx.moveTo(PX(t), M.top), ctx.lineTo(PX(t), M.top + ph));
  if (logY) for (const t of minorLog(y0, y1)) (ctx.moveTo(M.left, PY(t)), ctx.lineTo(M.left + pw, PY(t)));
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.beginPath();
  for (const v of xt) (ctx.moveTo(PX(v), M.top), ctx.lineTo(PX(v), M.top + ph));
  for (const v of yt) (ctx.moveTo(M.left, PY(v)), ctx.lineTo(M.left + pw, PY(v)));
  ctx.stroke();
  // Moldura
  ctx.strokeStyle = theme.muted;
  ctx.globalAlpha = 0.6;
  ctx.strokeRect(M.left, M.top, pw, ph);
  ctx.globalAlpha = 1;
  ctx.fillStyle = theme.muted;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  for (const v of xt) ctx.fillText(lab(v, logX), PX(v), M.top + ph + 4 * k);
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  for (const v of yt) ctx.fillText(lab(v, logY), M.left - 5 * k, PY(v));
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.fillStyle = theme.text;
  ctx.fillText(xLabel, M.left + pw / 2, H - 2 * k);
  ctx.save();
  ctx.translate(12 * k, M.top + ph / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textBaseline = "middle";
  ctx.fillText(yLabel, 0, 0);
  ctx.restore();
  if (opts.title) {
    ctx.font = `600 ${fs * 1.2}px system-ui, sans-serif`;
    ctx.textBaseline = "top";
    ctx.fillText(opts.title, W / 2, 6 * k, W - 20 * k);
    ctx.font = `${fs}px system-ui, sans-serif`;
  }

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
  const colorOf = (s: PlotSeries, si: number) => s.color ?? theme.series[si % theme.series.length]!;
  series.forEach((s, si) => {
    const color = colorOf(s, si);
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = (s.width ?? 2) * k;
    ctx.setLineDash((s.dash ?? []).map((d) => d * k));
    const kind = s.kind ?? "line";
    if (kind === "band" && s.hi) {
      const idx = s.points.map((_, i) => i).filter((i) => ok(s.points[i]![0], s.points[i]![1]) && ok(s.points[i]![0], s.hi![i]!));
      if (idx.length > 1) {
        ctx.globalAlpha = 0.18;
        ctx.beginPath();
        idx.forEach((i, j) => (j ? ctx.lineTo : ctx.moveTo).call(ctx, X(s.points[i]![0]), Y(s.hi![i]!)));
        for (const i of [...idx].reverse()) ctx.lineTo(X(s.points[i]![0]), Y(s.points[i]![1]));
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    } else if (kind === "line") {
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
      const cap = 3 * k;
      s.points.forEach(([x, y], i) => {
        if (!ok(x, y)) return;
        const ey = s.yErr?.[i];
        const ex = s.xErr?.[i];
        ctx.lineWidth = 1.2 * k;
        if (ey) {
          // Em escala log, a barra inferior pode cair abaixo de zero: corta na borda.
          const yl = logY && y - ey <= 0 ? M.top + ph + 10 : Y(y - ey);
          ctx.beginPath();
          ctx.moveTo(X(x), yl);
          ctx.lineTo(X(x), Y(y + ey));
          ctx.moveTo(X(x) - cap, yl);
          ctx.lineTo(X(x) + cap, yl);
          ctx.moveTo(X(x) - cap, Y(y + ey));
          ctx.lineTo(X(x) + cap, Y(y + ey));
          ctx.stroke();
        }
        if (ex) {
          const xl = logX && x - ex <= 0 ? M.left - 10 : X(x - ex);
          ctx.beginPath();
          ctx.moveTo(xl, Y(y));
          ctx.lineTo(X(x + ex), Y(y));
          ctx.moveTo(xl, Y(y) - cap);
          ctx.lineTo(xl, Y(y) + cap);
          ctx.moveTo(X(x + ex), Y(y) - cap);
          ctx.lineTo(X(x + ex), Y(y) + cap);
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.arc(X(x), Y(y), 3.5 * k, 0, 2 * Math.PI);
        ctx.fill();
      });
    }
    ctx.setLineDash([]);
  });
  ctx.restore();

  // Legenda quando há mais de uma série
  const shown = series.map((s, si) => ({ s, si })).filter(({ s }) => s.legend !== false);
  if (shown.length > 1) {
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    let lx = M.left + 8 * k;
    let ly = M.top + 8 * k;
    for (const { s, si } of shown) {
      const wText = ctx.measureText(s.label).width;
      if (lx + 24 * k + wText > M.left + pw && lx > M.left + 8 * k) {
        lx = M.left + 8 * k;
        ly += fs * 1.5;
      }
      ctx.fillStyle = colorOf(s, si);
      if (s.kind === "scatter") {
        ctx.beginPath();
        ctx.arc(lx + 6 * k, ly, 3.5 * k, 0, 2 * Math.PI);
        ctx.fill();
      } else {
        if (s.kind === "band") ctx.globalAlpha = 0.3;
        ctx.fillRect(lx, ly - (s.kind === "band" ? 5 : 1.5) * k, 12 * k, (s.kind === "band" ? 10 : 3) * k);
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = theme.text;
      ctx.fillText(s.label, lx + 16 * k, ly);
      lx += 24 * k + wText;
    }
  }
  return { X, Y };
}

/** Tema claro para exportação (fundo branco, texto preto, grade visível). */
export const printTheme: Theme = { ...lightTheme, text: "#111111", muted: "#333333", grid: "rgba(0, 0, 0, 0.14)" };

/** Troca as cores do tema da tela pelas equivalentes do tema de impressão. */
function toPrint(props: PlotProps): PlotProps {
  const t = props.theme;
  const map = (c?: string) => {
    if (!c) return c;
    const i = t.series.indexOf(c);
    if (i >= 0) return printTheme.series[i % printTheme.series.length];
    if (c === t.accent) return printTheme.accent;
    if (c === t.text) return printTheme.text;
    if (c === t.muted) return printTheme.muted;
    return c;
  };
  return { ...props, theme: printTheme, series: props.series.map((s) => ({ ...s, color: map(s.color) })) };
}

export interface PngOptions {
  title?: string;
  /** Largura e altura em px CSS (padrão 900 × 560) e fator de resolução (padrão 2,5 → 2250 × 1400 px). */
  width?: number;
  height?: number;
  scale?: number;
}

/** Renderiza o gráfico em PNG com fundo branco, título e fonte legível (para relatório). */
export function plotToPng(props: PlotProps, opts: PngOptions = {}): Promise<Blob | null> {
  const W = opts.width ?? 900, H = opts.height ?? 560, s = opts.scale ?? 2.5;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(W * s);
  canvas.height = Math.round(H * s);
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.resolve(null);
  ctx.setTransform(s, 0, 0, s, 0, 0);
  renderPlot(ctx, W, H, toPrint(props), { font: 15, title: opts.title, background: "#ffffff" });
  return new Promise((res) => canvas.toBlob((b) => res(b), "image/png"));
}

/** PNG como data URL (para embutir no relatório HTML). */
export async function plotToDataUrl(props: PlotProps, opts: PngOptions = {}): Promise<string> {
  const b = await plotToPng(props, opts);
  if (!b) return "";
  return new Promise((res) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => res("");
    r.readAsDataURL(b);
  });
}

/** Baixa um arquivo gerado no navegador. */
export function downloadBlob(name: string, data: Blob | string, type = "text/plain;charset=utf-8") {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(typeof data === "string" ? new Blob([data], { type }) : data);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export async function downloadPlotPng(name: string, props: PlotProps, opts: PngOptions = {}) {
  const b = await plotToPng(props, opts);
  if (b) downloadBlob(name, b);
}

/**
 * Gráfico em canvas com linhas paramétricas, pontos com barras de erro, faixas e
 * escalas log. Mostra a leitura do ponto mais próximo ao passar o mouse.
 */
export function Plot(props: PlotProps) {
  const { series, xLabel, yLabel, height = 260, ariaLabel } = props;
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hover, setHover] = useState<{ x: number; y: number; px: number; py: number; label: string } | null>(null);
  const mapRef = useRef<PlotMap | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;

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
    mapRef.current = renderPlot(ctx, W, H, propsRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.series, props.xLabel, props.yLabel, props.theme, height, props.logX, props.logY, props.xRange, props.yRange, props.includeZero]);

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
    for (const s of series) {
      if (s.kind === "band") continue;
      for (const [x, y] of s.points) {
        const d = (map.X(x) - mx) ** 2 + (map.Y(y) - my) ** 2;
        if (Number.isFinite(d) && d < bd) {
          bd = d;
          best = { x, y, px: map.X(x), py: map.Y(y), label: s.label };
        }
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

/** Marcas de um eixo log (posições em log10): décadas, ou 1–2–5 quando o intervalo é curto. */
function logTicks(lo: number, hi: number): number[] {
  const dec: number[] = [];
  for (let d = Math.ceil(lo - 1e-9); d <= Math.floor(hi + 1e-9); d++) dec.push(d);
  if (dec.length >= 2) return dec.length > 10 ? dec.filter((d) => d % Math.ceil(dec.length / 8) === 0) : dec;
  for (const mults of [[1, 2, 5], [1, 2, 3, 4, 5, 6, 7, 8, 9]]) {
    const out: number[] = [];
    for (let d = Math.floor(lo); d <= Math.ceil(hi); d++) for (const m of mults) {
      const t = d + Math.log10(m);
      if (t >= lo - 1e-9 && t <= hi + 1e-9) out.push(t);
    }
    if (out.length >= 3 || mults.length > 3) return out.length ? out : [lo];
  }
  return [lo];
}

/** Rótulo de uma marca log: número comum perto de 1, potência de 10 nas décadas distantes. */
function logLabel(t: number): string {
  const r = Math.round(t);
  if (Math.abs(t - r) < 1e-9 && (r < -2 || r > 3)) return powerOfTen(r);
  return fmtAxis(Number((10 ** t).toPrecision(3)));
}

/** Posições (em log10) dos traços 2…9 de cada década dentro do intervalo. */
function minorLog(lo: number, hi: number): number[] {
  const out: number[] = [];
  if (hi - lo > 8) return out;
  for (let d = Math.floor(lo); d <= Math.ceil(hi); d++)
    for (let m = 2; m <= 9; m++) {
      const t = d + Math.log10(m);
      if (t > lo && t < hi) out.push(t);
    }
  return out;
}
