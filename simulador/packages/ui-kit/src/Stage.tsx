import { useCallback, useEffect, useImperativeHandle, useRef, type Ref } from "react";
import type { AnySimulation, Runner, Theme, Viewport, WorldPoint } from "@fisilab/core";

const PAD = 28;
const MAX_H = 520;

export interface StageHandle {
  /** Redesenha o quadro atual (chamado a cada frame pela animação). */
  redraw(): void;
}

interface Props {
  sim: AnySimulation;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  runner: Runner<any>;
  theme: Theme;
  /** Chamado quando a interação por ponteiro altera o estado. */
  onInteract?(): void;
  ref?: Ref<StageHandle>;
}

interface Layout {
  vp: Viewport;
  scale: number;
  cssW: number;
  cssH: number;
}

/** Canvas que enquadra o `viewport` da simulação e chama `sim.render` em coordenadas do mundo. */
export function Stage({ sim, runner, theme, onInteract, ref }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const layoutRef = useRef<Layout | null>(null);
  const dragging = useRef(false);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const dpr = window.devicePixelRatio || 1;
    const cssW = wrap.clientWidth;
    const vp = sim.viewport(runner.params, runner.state);
    const w = vp.xMax - vp.xMin;
    const h = vp.yMax - vp.yMin;
    const scale = Math.min((cssW - 2 * PAD) / w, (MAX_H - 2 * PAD) / h);
    const cssH = Math.max(160, h * scale + 2 * PAD);
    if (canvas.width !== Math.round(cssW * dpr) || canvas.height !== Math.round(cssH * dpr)) {
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      canvas.style.height = `${cssH}px`;
    }
    layoutRef.current = { vp, scale, cssW, cssH };

    const ctx = canvas.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    // Centraliza horizontalmente quando a altura limita a escala.
    const ox = (cssW - w * scale) / 2;
    if (vp.unit) drawAxes(ctx, vp, scale, ox, cssH, theme);

    ctx.setTransform(dpr * scale, 0, 0, -dpr * scale, dpr * (ox - vp.xMin * scale), dpr * (cssH - PAD + vp.yMin * scale));
    ctx.save();
    try {
      sim.render(ctx, {
        state: runner.state,
        params: runner.params,
        t: runner.t,
        trail: runner.samples.map((s) => s.state),
        scale,
        theme,
      });
    } finally {
      ctx.restore();
    }
  }, [sim, runner, theme]);

  useImperativeHandle(ref, () => ({ redraw }), [redraw]);

  // Redesenha a cada render do React (parâmetros, tema) e quando o contêiner muda de tamanho.
  useEffect(() => redraw());
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(() => redraw());
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [redraw]);

  const toWorld = (e: React.PointerEvent): WorldPoint | null => {
    const L = layoutRef.current;
    const canvas = canvasRef.current;
    if (!L || !canvas) return null;
    const r = canvas.getBoundingClientRect();
    const ox = (L.cssW - (L.vp.xMax - L.vp.xMin) * L.scale) / 2;
    return {
      x: L.vp.xMin + (e.clientX - r.left - ox) / L.scale,
      y: L.vp.yMin + (L.cssH - PAD - (e.clientY - r.top)) / L.scale,
    };
  };

  const handle = (kind: "down" | "move" | "up", e: React.PointerEvent<HTMLCanvasElement>) => {
    const ptr = sim.pointer;
    if (!ptr) return;
    const p = toWorld(e);
    if (!p) return;
    if (kind === "down") {
      dragging.current = true;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    let next;
    if (kind === "down") next = ptr.down?.(runner.state, runner.params, p);
    else if (kind === "move") {
      next = ptr.move?.(runner.state, runner.params, p, dragging.current);
      const c = ptr.cursor?.(runner.state, runner.params, p);
      e.currentTarget.style.cursor = c ?? (dragging.current ? "grabbing" : "default");
    } else next = ptr.up?.(runner.state, runner.params, p);
    if (kind === "up") dragging.current = false;
    if (next !== undefined) {
      runner.setState(next);
      redraw();
      onInteract?.();
    }
  };

  return (
    <div ref={wrapRef} className="fl-stage">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={`Animação: ${sim.title}`}
        style={{ touchAction: sim.pointer ? "none" : "auto" }}
        onPointerDown={(e) => handle("down", e)}
        onPointerMove={(e) => handle("move", e)}
        onPointerUp={(e) => handle("up", e)}
        onPointerCancel={(e) => handle("up", e)}
      />
    </div>
  );
}

function niceStep(range: number): number {
  const raw = range / 6;
  const p = 10 ** Math.floor(Math.log10(raw));
  const m = raw / p;
  return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p;
}

function fmtTick(v: number): string {
  return String(+v.toPrecision(6)).replace(".", ",");
}

function drawAxes(ctx: CanvasRenderingContext2D, vp: Viewport, scale: number, ox: number, h: number, theme: Theme) {
  const X = (x: number) => ox + (x - vp.xMin) * scale;
  const Y = (y: number) => h - PAD - (y - vp.yMin) * scale;
  ctx.strokeStyle = theme.grid;
  ctx.fillStyle = theme.muted;
  ctx.font = "11px system-ui, sans-serif";
  ctx.lineWidth = 1;
  const step = niceStep(Math.max(vp.xMax - vp.xMin, vp.yMax - vp.yMin));
  ctx.beginPath();
  for (let x = Math.ceil(vp.xMin / step) * step; x <= vp.xMax + 1e-9; x += step) {
    ctx.moveTo(X(x), Y(vp.yMin));
    ctx.lineTo(X(x), Y(vp.yMax));
  }
  for (let y = Math.ceil(vp.yMin / step) * step; y <= vp.yMax + 1e-9; y += step) {
    ctx.moveTo(X(vp.xMin), Y(y));
    ctx.lineTo(X(vp.xMax), Y(y));
  }
  ctx.stroke();
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  for (let x = Math.ceil(vp.xMin / step) * step; x <= vp.xMax + 1e-9; x += step) ctx.fillText(fmtTick(x), X(x), Y(vp.yMin) + 4);
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  for (let y = Math.ceil(vp.yMin / step) * step; y <= vp.yMax + 1e-9; y += step) ctx.fillText(fmtTick(y), X(vp.xMin) - 4, Y(y));
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(vp.unit ?? "", X(vp.xMax) + 4, Y(vp.yMin) + 4);
}
