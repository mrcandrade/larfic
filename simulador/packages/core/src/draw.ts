import type { RenderFrame, Theme } from "./simulation.ts";

export interface StrokeStyle {
  color?: string;
  /** Espessura em pixels de tela. */
  width?: number;
  /** Tracejado em pixels de tela. */
  dash?: number[];
  alpha?: number;
}

export interface FillStyle extends StrokeStyle {
  fill?: string;
  stroke?: string;
}

export interface TextStyle {
  color?: string;
  /** Tamanho da fonte em pixels de tela. */
  size?: number;
  align?: CanvasTextAlign;
  baseline?: CanvasTextBaseline;
  weight?: string;
  /** Deslocamento em pixels de tela. */
  dx?: number;
  dy?: number;
}

/**
 * Utilitários de desenho em coordenadas do mundo (y para cima). Espessuras,
 * tamanhos de fonte e pontas de seta são dados em pixels de tela, então o
 * desenho fica legível em qualquer escala.
 *
 *     render(ctx, frame) {
 *       const d = draw(ctx, frame);
 *       d.arrow(x, y, vx, vy, { color: d.theme.accent });
 *       d.text("v", x + vx, y + vy, { dy: -8 });
 *     }
 */
export function draw(ctx: CanvasRenderingContext2D, frame: Pick<RenderFrame<unknown>, "scale" | "theme">) {
  const px = 1 / frame.scale;
  const theme: Theme = frame.theme;

  function applyStroke(s: StrokeStyle = {}) {
    ctx.strokeStyle = s.color ?? theme.text;
    ctx.lineWidth = (s.width ?? 1.5) * px;
    ctx.setLineDash((s.dash ?? []).map((v) => v * px));
    ctx.globalAlpha = s.alpha ?? 1;
  }

  function reset() {
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }

  const api = {
    px,
    theme,
    ctx,

    line(x1: number, y1: number, x2: number, y2: number, s?: StrokeStyle) {
      applyStroke(s);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      reset();
    },

    polyline(points: [number, number][], s?: StrokeStyle & { close?: boolean; fill?: string }) {
      if (points.length < 2) return;
      applyStroke(s);
      ctx.beginPath();
      points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
      if (s?.close) ctx.closePath();
      if (s?.fill) {
        ctx.fillStyle = s.fill;
        ctx.fill();
      }
      if (s?.color !== "none") ctx.stroke();
      reset();
    },

    /** Curva y = f(x) amostrada em `n` pontos. */
    plot(f: (x: number) => number, x0: number, x1: number, s?: StrokeStyle & { n?: number }) {
      const n = s?.n ?? 200;
      const pts: [number, number][] = [];
      for (let i = 0; i <= n; i++) {
        const x = x0 + ((x1 - x0) * i) / n;
        const y = f(x);
        if (Number.isFinite(y)) pts.push([x, y]);
      }
      api.polyline(pts, s);
    },

    circle(x: number, y: number, r: number, s: FillStyle & { minPx?: number } = {}) {
      const rr = Math.max(r, (s.minPx ?? 0) * px);
      ctx.beginPath();
      ctx.arc(x, y, rr, 0, 2 * Math.PI);
      ctx.globalAlpha = s.alpha ?? 1;
      if (s.fill) {
        ctx.fillStyle = s.fill;
        ctx.fill();
      }
      if (s.stroke) {
        applyStroke({ ...s, color: s.stroke });
        ctx.stroke();
      }
      reset();
    },

    /** Disco com raio fixo em pixels (marcadores, partículas). */
    dot(x: number, y: number, rPx: number, fill: string, alpha = 1) {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.arc(x, y, rPx * px, 0, 2 * Math.PI);
      ctx.fill();
      ctx.globalAlpha = 1;
    },

    rect(x: number, y: number, w: number, h: number, s: FillStyle = {}) {
      ctx.globalAlpha = s.alpha ?? 1;
      if (s.fill) {
        ctx.fillStyle = s.fill;
        ctx.fillRect(x, y, w, h);
      }
      if (s.stroke) {
        applyStroke({ ...s, color: s.stroke });
        ctx.strokeRect(x, y, w, h);
      }
      reset();
    },

    /** Retângulo girado em torno do centro (blocos em planos inclinados). */
    box(cx: number, cy: number, w: number, h: number, angle: number, s: FillStyle = {}) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);
      api.rect(-w / 2, -h / 2, w, h, s);
      ctx.restore();
    },

    /**
     * Seta de (x, y) a (x + dx, y + dy), em unidades do mundo. Use
     * `arrowPx` quando o comprimento deve ser fixo em pixels.
     */
    arrow(x: number, y: number, dx: number, dy: number, s: StrokeStyle & { head?: number } = {}) {
      const len = Math.hypot(dx, dy);
      if (len < 1e-12) return;
      const ux = dx / len;
      const uy = dy / len;
      const head = Math.min((s.head ?? 9) * px, len * 0.6);
      const color = s.color ?? theme.text;
      applyStroke({ ...s, color, width: s.width ?? 2 });
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + dx - ux * head * 0.6, y + dy - uy * head * 0.6);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(x + dx, y + dy);
      ctx.lineTo(x + dx - head * (ux - 0.45 * uy), y + dy - head * (uy + 0.45 * ux));
      ctx.lineTo(x + dx - head * (ux + 0.45 * uy), y + dy - head * (uy - 0.45 * ux));
      ctx.closePath();
      ctx.fill();
      reset();
    },

    /** Seta com direção (dx, dy) e comprimento em pixels de tela. */
    arrowPx(x: number, y: number, dx: number, dy: number, lengthPx: number, s?: StrokeStyle & { head?: number }) {
      const len = Math.hypot(dx, dy);
      if (len < 1e-12 || lengthPx < 1) return;
      api.arrow(x, y, (dx / len) * lengthPx * px, (dy / len) * lengthPx * px, s);
    },

    /** Texto sempre de pé, ancorado num ponto do mundo. */
    text(str: string, x: number, y: number, s: TextStyle = {}) {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(px, -px);
      ctx.fillStyle = s.color ?? theme.text;
      ctx.font = `${s.weight ?? "400"} ${s.size ?? 12}px system-ui, -apple-system, "Segoe UI", sans-serif`;
      ctx.textAlign = s.align ?? "center";
      ctx.textBaseline = s.baseline ?? "middle";
      ctx.fillText(str, s.dx ?? 0, s.dy ?? 0);
      ctx.restore();
    },

    /** Mola em zigue-zague entre dois pontos. */
    spring(x1: number, y1: number, x2: number, y2: number, s: StrokeStyle & { coils?: number; amplitudePx?: number } = {}) {
      const dx = x2 - x1;
      const dy = y2 - y1;
      const len = Math.hypot(dx, dy);
      if (len < 1e-12) return;
      const ux = dx / len;
      const uy = dy / len;
      const coils = s.coils ?? 10;
      const amp = (s.amplitudePx ?? 7) * px;
      const lead = Math.min(len * 0.12, 12 * px);
      const pts: [number, number][] = [[x1, y1], [x1 + ux * lead, y1 + uy * lead]];
      const body = len - 2 * lead;
      for (let i = 1; i < coils * 2; i++) {
        const a = lead + (body * i) / (coils * 2);
        const side = i % 2 === 0 ? -1 : 1;
        pts.push([x1 + ux * a - uy * amp * side, y1 + uy * a + ux * amp * side]);
      }
      pts.push([x2 - ux * lead, y2 - uy * lead], [x2, y2]);
      api.polyline(pts, s);
    },

    /** Hachura de suporte fixo (teto, parede, chão). */
    support(x1: number, y1: number, x2: number, y2: number, s: StrokeStyle = {}) {
      api.line(x1, y1, x2, y2, { ...s, width: s.width ?? 2 });
      const dx = x2 - x1;
      const dy = y2 - y1;
      const len = Math.hypot(dx, dy);
      const n = Math.max(3, Math.floor((len / px) / 10));
      const nx = dy / len;
      const ny = -dx / len;
      for (let i = 0; i <= n; i++) {
        const x = x1 + (dx * i) / n;
        const y = y1 + (dy * i) / n;
        api.line(x, y, x + (nx - dx / len) * 7 * px, y + (ny - dy / len) * 7 * px, { ...s, width: 1, alpha: 0.6 });
      }
    },

    /** Grade de fundo com espaçamento em unidades do mundo. */
    grid(xMin: number, xMax: number, yMin: number, yMax: number, step: number, s: StrokeStyle = {}) {
      applyStroke({ color: theme.grid, width: 1, ...s });
      ctx.beginPath();
      for (let x = Math.ceil(xMin / step) * step; x <= xMax; x += step) {
        ctx.moveTo(x, yMin);
        ctx.lineTo(x, yMax);
      }
      for (let y = Math.ceil(yMin / step) * step; y <= yMax; y += step) {
        ctx.moveTo(xMin, y);
        ctx.lineTo(xMax, y);
      }
      ctx.stroke();
      reset();
    },
  };
  return api;
}

export type Draw = ReturnType<typeof draw>;

/** Tema neutro usado em testes e quando o app não fornece um. */
export const lightTheme: Theme = {
  text: "#1c2430",
  muted: "#5d6b7e",
  grid: "rgba(93, 107, 126, 0.18)",
  accent: "#2f7de1",
  series: ["#2f7de1", "#e8743b", "#19a979", "#d64f8a", "#8a63d2", "#c9a227"],
  positive: "#d9453b",
  negative: "#2f6fd9",
  ground: "rgba(120, 140, 110, 0.35)",
  dark: false,
};

export const darkTheme: Theme = {
  text: "#e6ebf2",
  muted: "#97a3b4",
  grid: "rgba(151, 163, 180, 0.15)",
  accent: "#5b9cf0",
  series: ["#5b9cf0", "#f08a54", "#3cc394", "#e8709f", "#a585e6", "#e0bd48"],
  positive: "#f0645a",
  negative: "#5b93f0",
  ground: "rgba(120, 140, 110, 0.3)",
  dark: true,
};
