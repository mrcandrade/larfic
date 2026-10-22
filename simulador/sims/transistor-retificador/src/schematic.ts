import type { Draw } from "@fisilab/core";

type P = [number, number];

/** Símbolos de esquema elétrico em coordenadas do mundo. */
export function schematic(d: Draw) {
  const th = d.theme;
  const W = { color: th.text, width: 1.8 };
  const api = {
    wire(pts: P[], color = th.text) {
      d.polyline(pts, { ...W, color });
    },
    node(x: number, y: number) {
      d.dot(x, y, 3.2, th.text);
    },
    /** Fio horizontal com um "salto" em x (cruzamento sem conexão). */
    hopH(x1: number, x2: number, y: number, xh: number, r = 0.3) {
      d.line(x1, y, xh - r, y, W);
      d.ctx.beginPath();
      d.ctx.arc(xh, y, r, Math.PI, 0, true);
      d.ctx.strokeStyle = th.text;
      d.ctx.lineWidth = 1.8 * d.px;
      d.ctx.stroke();
      d.line(xh + r, y, x2, y, W);
    },
    resistor(a: P, b: P, label?: string, side: 1 | -1 = 1, color = th.text) {
      const dx = b[0] - a[0], dy = b[1] - a[1];
      const L = Math.hypot(dx, dy);
      const ux = dx / L, uy = dy / L;
      const m = Math.max(0, (L - 1.6) / 2);
      const p1: P = [a[0] + ux * m, a[1] + uy * m];
      const p2: P = [b[0] - ux * m, b[1] - uy * m];
      d.line(a[0], a[1], p1[0], p1[1], W);
      d.line(p2[0], p2[1], b[0], b[1], W);
      d.spring(p1[0], p1[1], p2[0], p2[1], { color, width: 1.8, coils: 4, amplitudePx: 6 });
      if (label) {
        const nx = -uy * side, ny = ux * side;
        d.text(label, (a[0] + b[0]) / 2 + nx * 0.6, (a[1] + b[1]) / 2 + ny * 0.8, { size: 11, align: nx > 0.1 ? "left" : nx < -0.1 ? "right" : "center", color: th.text });
      }
    },
    capacitor(a: P, b: P, label?: string, polar = false) {
      const dx = b[0] - a[0], dy = b[1] - a[1];
      const L = Math.hypot(dx, dy);
      const ux = dx / L, uy = dy / L;
      const g = 0.18;
      const c: P = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      d.line(a[0], a[1], c[0] - ux * g, c[1] - uy * g, W);
      d.line(c[0] + ux * g, c[1] + uy * g, b[0], b[1], W);
      const w = 0.6;
      d.line(c[0] - ux * g - uy * w, c[1] - uy * g + ux * w, c[0] - ux * g + uy * w, c[1] - uy * g - ux * w, { ...W, width: 2.6 });
      d.line(c[0] + ux * g - uy * w, c[1] + uy * g + ux * w, c[0] + ux * g + uy * w, c[1] + uy * g - ux * w, { ...W, width: 2.6 });
      if (polar) d.text("+", c[0] - ux * 0.55 + uy * 0.45, c[1] - uy * 0.55 - ux * 0.45, { size: 11 });
      if (label) d.text(label, c[0] - uy * 0.9 + ux * 0, c[1] + ux * 0.9, { size: 11, align: uy !== 0 ? "right" : "center", dx: uy !== 0 ? -4 : 0 });
    },
    /** Diodo de a (anodo) para b (catodo). */
    diode(a: P, b: P, on = false) {
      const dx = b[0] - a[0], dy = b[1] - a[1];
      const L = Math.hypot(dx, dy);
      const ux = dx / L, uy = dy / L;
      const s = 0.5;
      const c: P = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const tip: P = [c[0] + ux * s, c[1] + uy * s];
      const base: P = [c[0] - ux * s, c[1] - uy * s];
      d.line(a[0], a[1], base[0], base[1], W);
      d.line(tip[0], tip[1], b[0], b[1], W);
      d.polyline(
        [
          [base[0] - uy * s, base[1] + ux * s],
          [base[0] + uy * s, base[1] - ux * s],
          tip,
        ],
        { color: th.text, width: 1.5, close: true, fill: on ? th.series[2]! : th.dark ? "#1b2230" : "#ffffff" },
      );
      d.line(tip[0] - uy * s, tip[1] + ux * s, tip[0] + uy * s, tip[1] - ux * s, { ...W, width: 2.4 });
    },
    ground(x: number, y: number) {
      for (let k = 0; k < 3; k++) d.line(x - 0.5 + k * 0.15, y - k * 0.22, x + 0.5 - k * 0.15, y - k * 0.22, { color: th.text, width: 1.6 });
    },
    /** Fonte senoidal vertical centrada em (x, y). */
    acSource(x: number, y: number, label?: string) {
      d.circle(x, y, 0.95, { stroke: th.text, width: 1.8, fill: th.dark ? "#141a24" : "#ffffff" });
      const pts: P[] = [];
      for (let i = 0; i <= 30; i++) pts.push([x - 0.55 + (1.1 * i) / 30, y + 0.35 * Math.sin((2 * Math.PI * i) / 30)]);
      d.polyline(pts, { color: th.text, width: 1.5 });
      if (label) d.text(label, x - 1.2, y, { size: 11, align: "right" });
    },
    /** Fonte de corrente vertical (seta para cima). */
    currentSource(x: number, y: number, label?: string) {
      d.circle(x, y, 0.95, { stroke: th.text, width: 1.8, fill: th.dark ? "#141a24" : "#ffffff" });
      d.arrow(x, y - 0.55, 0, 1.1, { color: th.text, width: 1.6, head: 7 });
      if (label) d.text(label, x - 1.2, y, { size: 11, align: "right" });
    },
    /** Transistor NPN; devolve os terminais base, coletor e emissor. */
    npn(cx: number, cy: number, color = th.text) {
      d.circle(cx, cy, 1.15, { stroke: th.muted, width: 1.4 });
      const bx = cx - 0.45;
      d.line(bx, cy - 0.65, bx, cy + 0.65, { color, width: 3 });
      const B: P = [cx - 1.6, cy];
      const C: P = [cx + 0.45, cy + 1.7];
      const E: P = [cx + 0.45, cy - 1.7];
      d.line(B[0], cy, bx, cy, { color, width: 1.8 });
      d.polyline([[bx, cy + 0.3], [cx + 0.45, cy + 0.85], C], { color, width: 1.8 });
      d.line(bx, cy - 0.3, cx + 0.45, cy - 0.85, { color, width: 1.8 });
      d.arrow(bx + 0.35, cy - 0.47, cx + 0.45 - bx - 0.35, -0.38, { color, width: 1.8, head: 8 });
      d.line(cx + 0.45, cy - 0.85, E[0], E[1], { color, width: 1.8 });
      return { B, C, E };
    },
    /** Lâmpada (círculo com X) entre a e b, vertical; brilho de 0 a 1. */
    lamp(x: number, y: number, glow: number) {
      if (glow > 0.02) d.circle(x, y, 1.0 + 1.4 * glow, { fill: "#f5c542", alpha: 0.18 + 0.35 * glow });
      d.circle(x, y, 0.75, { stroke: th.text, width: 1.8, fill: glow > 0.05 ? "#f5c542" : th.dark ? "#141a24" : "#ffffff", alpha: 1 });
      const r = 0.53;
      d.line(x - r, y - r, x + r, y + r, { color: th.text, width: 1.4 });
      d.line(x - r, y + r, x + r, y - r, { color: th.text, width: 1.4 });
    },
  };
  return api;
}
