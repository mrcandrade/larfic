import { useEffect, useRef, useState } from "react";
import type { Runner, Simulation } from "@fisilab/core";

const PAD = 32;

/** Canvas que enquadra o `viewport` da simulação e chama `sim.render` em coordenadas do mundo. */
/** `tick` muda a cada atualização do runner e dispara o redesenho. */
export function Stage({ sim, runner }: { sim: Simulation; runner: Runner; tick: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const dpr = window.devicePixelRatio || 1;
    const cssW = wrap.clientWidth;
    const vp = sim.viewport(runner.params);
    const scale = Math.min((cssW - 2 * PAD) / vp.width, 520 / vp.height);
    const cssH = Math.max(160, vp.height * scale + 2 * PAD);
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    canvas.style.height = `${cssH}px`;

    const ctx = canvas.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    drawAxes(ctx, cssW, cssH, scale, vp.width, vp.height);

    // Mundo: origem no canto inferior esquerdo, y para cima, unidades em metros.
    ctx.setTransform(dpr * scale, 0, 0, -dpr * scale, dpr * PAD, dpr * (cssH - PAD));
    sim.render(ctx, {
      state: runner.state,
      params: runner.params,
      t: runner.t,
      trail: runner.samples.map((s) => s.state),
      scale,
    });
  });

  // Redesenha ao redimensionar a janela.
  const [, setWidth] = useState(0);
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <div ref={wrapRef} className="stage">
      <canvas ref={canvasRef} role="img" aria-label={`Animação: ${sim.title}`} />
    </div>
  );
}

function niceStep(range: number): number {
  const raw = range / 6;
  const p = 10 ** Math.floor(Math.log10(raw));
  const m = raw / p;
  return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p;
}

function drawAxes(ctx: CanvasRenderingContext2D, w: number, h: number, scale: number, vw: number, vh: number) {
  const color = getComputedStyle(document.documentElement).getPropertyValue("--muted").trim() || "#888";
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.font = "11px system-ui, sans-serif";
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.35;
  const step = niceStep(Math.max(vw, vh));
  ctx.beginPath();
  for (let x = 0; x <= (w - PAD) / scale; x += step) {
    const px = PAD + x * scale;
    ctx.moveTo(px, h - PAD);
    ctx.lineTo(px, h - PAD + 4);
  }
  for (let y = 0; y <= (h - PAD) / scale; y += step) {
    const py = h - PAD - y * scale;
    ctx.moveTo(PAD - 4, py);
    ctx.lineTo(PAD, py);
  }
  ctx.stroke();
  ctx.globalAlpha = 0.9;
  for (let x = 0; x <= (w - 2 * PAD) / scale; x += step) ctx.fillText(`${+x.toPrecision(6)}`, PAD + x * scale - 6, h - PAD + 16);
  for (let y = step; y <= (h - 2 * PAD) / scale; y += step) ctx.fillText(`${+y.toPrecision(6)}`, 2, h - PAD - y * scale + 4);
  ctx.fillText("m", w - PAD + 6, h - PAD + 16);
  ctx.globalAlpha = 1;
}
