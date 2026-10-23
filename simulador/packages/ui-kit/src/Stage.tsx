import { useCallback, useEffect, useImperativeHandle, useRef, type KeyboardEvent, type Ref } from "react";
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
  /** Altura máxima do palco em px (padrão 520; maior no modo apresentação). */
  maxHeight?: number;
  /** Resumo textual do estado, lido por leitores de tela junto com o título. */
  description?: string;
  /** Teclas pressionadas com o foco no palco (atalhos). */
  onKeyDown?(e: KeyboardEvent<HTMLDivElement>): void;
  /** Camada de anotação (caneta do professor) desenhada por cima do palco. */
  ink?: InkProps;
}

/** Traço da caneta, em coordenadas normalizadas (0–1) do palco, para sobreviver a redimensionamentos. */
export type InkStroke = [number, number][];

export interface InkProps {
  active: boolean;
  strokes: InkStroke[];
  onChange(strokes: InkStroke[]): void;
  color?: string;
}

/** Faixa da cena desenhada num retângulo do palco: [xMin, xMax] do mundo, canto superior esquerdo em (ox, oy) px. */
export interface StagePane {
  xMin: number;
  xMax: number;
  ox: number;
  oy: number;
}

export interface StageLayout {
  vp: Viewport;
  scale: number;
  cssH: number;
  /** Uma faixa (cena inteira) ou duas empilhadas (telas estreitas, `narrowSplit`). */
  panes: StagePane[];
}

const SHAPE_OPS = ["fill", "stroke", "fillRect", "strokeRect", "clearRect", "drawImage", "putImageData"] as const;
const TEXT_OPS = ["fillText", "strokeText"] as const;

/**
 * Chama `draw` deixando passar só as figuras, só os textos ou tudo. Nos textos, `accept` recebe o x do
 * centro do texto em pixels do canvas e decide se ele é desenhado. As trocas são feitas no próprio objeto
 * (sombreando os métodos do protótipo) e desfeitas no fim.
 */
export function renderOnly(ctx: CanvasRenderingContext2D, only: "shapes" | "text" | "all", accept: (deviceX: number) => boolean, draw: () => void) {
  const c = ctx as unknown as Record<string, unknown>;
  const touched: string[] = [];
  const noop = () => undefined;
  if (only === "shapes") for (const k of TEXT_OPS) (c[k] = noop), touched.push(k);
  else {
    if (only === "text") for (const k of SHAPE_OPS) (c[k] = noop), touched.push(k);
    for (const k of TEXT_OPS) {
      const orig = CanvasRenderingContext2D.prototype[k];
      c[k] = (text: string, x: number, y: number, maxWidth?: number) => {
        // Decide pelo centro do texto (não pela âncora), em pixels do canvas.
        const m = ctx.getTransform();
        const w = ctx.measureText(text).width * m.a;
        const a = ctx.textAlign;
        const shift = a === "center" ? 0 : a === "right" || a === "end" ? -w / 2 : w / 2;
        const cx = m.a * x + m.c * y + m.e + shift;
        if (!accept(cx)) return;
        // Num painel estreito, texto largo passaria da borda do canvas: empurra-o para dentro.
        // Mais largo que o canvas: comprime (maxWidth) e centraliza.
        const W = ctx.canvas.width;
        const wide = m.b === 0 && Math.abs(w) > W - 8;
        const half = wide ? (W - 8) / 2 : Math.abs(w) / 2;
        const anchor = m.a * x + m.c * y + m.e;
        const center = wide ? anchor + Math.sign(shift) * half : cx;
        const dx = m.b !== 0 ? 0 : wide ? W / 2 - center : center - half < 0 ? half - center : center + half > W ? W - half - center : 0;
        if (dx !== 0) ctx.setTransform(m.a, m.b, m.c, m.d, m.e + dx, m.f);
        const mw = wide ? (2 * half) / Math.abs(m.a) : undefined;
        const lim = mw === undefined ? maxWidth : maxWidth === undefined ? mw : Math.min(mw, maxWidth);
        if (lim === undefined) orig.call(ctx, text, x, y);
        else orig.call(ctx, text, x, y, lim);
        if (dx !== 0) ctx.setTransform(m);
      };
      touched.push(k);
    }
  }
  try {
    draw();
  } finally {
    for (const k of touched) delete c[k];
  }
}

/** Abaixo desta largura (px) o palco empilha os painéis das cenas que definem `narrowSplit`. */
export const NARROW_PX = 640;

/**
 * Enquadra o viewport no palco. Em telas estreitas, com o corte (fração da largura) dentro da cena, corta-a em duas
 * faixas e empilha a direita embaixo da esquerda (só em cenas largas, e se a escala crescer ao menos 25%).
 */
export function stageLayout(vp: Viewport, cssW: number, maxHeight: number, splitFraction?: number): StageLayout {
  const w = vp.xMax - vp.xMin;
  const split = splitFraction === undefined ? undefined : vp.xMin + splitFraction * w;
  const h = vp.yMax - vp.yMin;
  const maxH = Math.max(200, maxHeight);
  const scale = Math.min((cssW - 2 * PAD) / w, (maxH - 2 * PAD) / h);
  if (split !== undefined && cssW < NARROW_PX && !vp.unit && w >= 1.5 * h && split > vp.xMin && split < vp.xMax) {
    const wL = split - vp.xMin;
    const wR = vp.xMax - split;
    const gap = 0.04 * h;
    const s2 = Math.min((cssW - 2 * PAD) / Math.max(wL, wR), (2 * maxH - 2 * PAD) / (2 * h + gap));
    if (s2 >= 1.25 * scale) {
      return {
        vp,
        scale: s2,
        cssH: (2 * h + gap) * s2 + 2 * PAD,
        panes: [
          { xMin: vp.xMin, xMax: split, ox: (cssW - wL * s2) / 2, oy: PAD },
          { xMin: split, xMax: vp.xMax, ox: (cssW - wR * s2) / 2, oy: PAD + (h + gap) * s2 },
        ],
      };
    }
  }
  const cssH = Math.max(160, h * scale + 2 * PAD);
  // Centraliza horizontalmente quando a altura limita a escala.
  return { vp, scale, cssH, panes: [{ xMin: vp.xMin, xMax: vp.xMax, ox: (cssW - w * scale) / 2, oy: cssH - PAD - h * scale }] };
}

/** Ponto do palco (px, relativo ao canto do canvas) em coordenadas do mundo, pela faixa que o contém. */
export function stageToWorld(L: StageLayout, px: number, py: number): WorldPoint {
  const { vp, scale } = L;
  const h = vp.yMax - vp.yMin;
  // A faixa cujo intervalo vertical contém o ponto; entre faixas, a mais próxima.
  let pane = L.panes[0]!;
  let best = Infinity;
  for (const p of L.panes) {
    const d = py < p.oy ? p.oy - py : py > p.oy + h * scale ? py - p.oy - h * scale : 0;
    if (d < best) {
      best = d;
      pane = p;
    }
  }
  return { x: pane.xMin + (px - pane.ox) / scale, y: vp.yMax - (py - pane.oy) / scale };
}

/** Canvas que enquadra o `viewport` da simulação e chama `sim.render` em coordenadas do mundo. */
export function Stage({ sim, runner, theme, onInteract, ref, maxHeight = MAX_H, description, onKeyDown, ink }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const layoutRef = useRef<StageLayout | null>(null);
  const dragging = useRef(false);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const dpr = window.devicePixelRatio || 1;
    const cssW = wrap.clientWidth;
    const vp = sim.viewport(runner.params, runner.state);
    const L = stageLayout(vp, cssW, maxHeight, sim.narrowSplit?.(runner.params, runner.state));
    const { scale, cssH } = L;
    if (canvas.width !== Math.round(cssW * dpr) || canvas.height !== Math.round(cssH * dpr)) {
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      canvas.style.height = `${cssH}px`;
    }
    layoutRef.current = L;

    const ctx = canvas.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    const stacked = L.panes.length > 1;
    if (vp.unit) drawAxes(ctx, vp, scale, L.panes[0]!.ox, cssH, theme);

    const frame = {
      state: runner.state,
      params: runner.params,
      t: runner.t,
      trail: runner.samples.map((s) => s.state),
      scale,
      theme,
    };
    for (const pane of L.panes) {
      const toPane = () =>
        ctx.setTransform(dpr * scale, 0, 0, -dpr * scale, dpr * (pane.ox - pane.xMin * scale), dpr * (pane.oy + vp.yMax * scale));
      if (!stacked) {
        toPane();
        ctx.save();
        try {
          // Em tela estreita, textos que passariam da borda são trazidos para dentro.
          if (cssW < NARROW_PX) renderOnly(ctx, "all", () => true, () => sim.render(ctx, frame));
          else sim.render(ctx, frame);
        } finally {
          ctx.restore();
        }
        continue;
      }
      // Empilhado: figuras recortadas na faixa; textos inteiros, cada um na faixa em que fica a sua âncora.
      const x0 = dpr * pane.ox;
      const x1 = dpr * (pane.ox + (pane.xMax - pane.xMin) * scale);
      toPane();
      ctx.save();
      ctx.beginPath();
      ctx.rect(pane.xMin, vp.yMin, pane.xMax - pane.xMin, vp.yMax - vp.yMin);
      ctx.clip();
      try {
        renderOnly(ctx, "shapes", () => true, () => sim.render(ctx, frame));
      } finally {
        ctx.restore();
      }
      toPane();
      ctx.save();
      try {
        renderOnly(ctx, "text", (x) => x >= x0 - 1 && x <= x1 + 1, () => sim.render(ctx, frame));
      } finally {
        ctx.restore();
      }
    }
  }, [sim, runner, theme, maxHeight]);

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
    return stageToWorld(L, e.clientX - r.left, e.clientY - r.top);
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
    <div
      ref={wrapRef}
      className="fl-stage"
      tabIndex={onKeyDown ? 0 : undefined}
      role={onKeyDown ? "group" : undefined}
      onKeyDown={onKeyDown}
      aria-label={onKeyDown ? `Palco de ${sim.title}. Atalhos: Espaço roda ou pausa, setas avançam ou voltam, R reinicia, ? mostra a ajuda.` : undefined}
    >
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={description ? `Animação: ${sim.title}. ${description}` : `Animação: ${sim.title}`}
        style={{ touchAction: sim.pointer ? "none" : "auto" }}
        onPointerDown={(e) => handle("down", e)}
        onPointerMove={(e) => handle("move", e)}
        onPointerUp={(e) => handle("up", e)}
        onPointerCancel={(e) => handle("up", e)}
      />
      {ink && (ink.active || ink.strokes.length > 0) && <InkLayer {...ink} />}
    </div>
  );
}

/** Camada transparente onde o professor desenha por cima do palco. */
function InkLayer({ active, strokes, onChange, color = "#ff2d95" }: InkProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const current = useRef<InkStroke | null>(null);

  const paint = useCallback(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    const w = c.clientWidth;
    const h = c.clientHeight;
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
    }
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(3, Math.min(w, h) / 160);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const all = current.current ? [...strokes, current.current] : strokes;
    for (const s of all) {
      if (!s.length) continue;
      ctx.beginPath();
      ctx.moveTo(s[0]![0] * w, s[0]![1] * h);
      if (s.length === 1) ctx.lineTo(s[0]![0] * w + 0.1, s[0]![1] * h);
      for (const [x, y] of s.slice(1)) ctx.lineTo(x * w, y * h);
      ctx.stroke();
    }
  }, [strokes, color]);

  useEffect(() => paint());
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ro = new ResizeObserver(() => paint());
    ro.observe(c);
    return () => ro.disconnect();
  }, [paint]);

  const at = (e: React.PointerEvent<HTMLCanvasElement>): [number, number] => {
    const r = e.currentTarget.getBoundingClientRect();
    return [(e.clientX - r.left) / Math.max(1, r.width), (e.clientY - r.top) / Math.max(1, r.height)];
  };

  return (
    <canvas
      ref={ref}
      className={`fl-ink ${active ? "fl-ink-active" : ""}`}
      aria-hidden="true"
      onPointerDown={(e) => {
        if (!active) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        current.current = [at(e)];
        paint();
      }}
      onPointerMove={(e) => {
        if (!active || !current.current) return;
        current.current.push(at(e));
        paint();
      }}
      onPointerUp={() => {
        if (!current.current) return;
        const s = current.current;
        current.current = null;
        onChange([...strokes, s]);
      }}
      onPointerCancel={() => {
        current.current = null;
        paint();
      }}
    />
  );
}

function niceStep(range: number): number {
  const raw = range / 6;
  const p = 10 ** Math.floor(Math.log10(raw));
  const m = raw / p;
  return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p;
}

function fmtTick(v: number, step: number): string {
  // Somas sucessivas de `step` acumulam erro de arredondamento: 0 vira −5,55e−17.
  if (Math.abs(v) < step * 1e-6) v = 0;
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
  for (let x = Math.ceil(vp.xMin / step) * step; x <= vp.xMax + 1e-9; x += step) ctx.fillText(fmtTick(x, step), X(x), Y(vp.yMin) + 4);
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  for (let y = Math.ceil(vp.yMin / step) * step; y <= vp.yMax + 1e-9; y += step) ctx.fillText(fmtTick(y, step), X(vp.xMin) - 4, Y(y));
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(vp.unit ?? "", X(vp.xMax) + 4, Y(vp.yMin) + 4);
}
