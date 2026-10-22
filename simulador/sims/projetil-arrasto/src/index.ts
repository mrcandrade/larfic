import type { Params, Simulation, State } from "@fisilab/core";

/**
 * Lançamento oblíquo com arrasto quadrático.
 *
 * Estado: [x, y, vx, vy, Wd], onde Wd é a energia dissipada pelo arrasto
 * (dWd/dt = |F_d|·|v|). Guardar Wd no estado permite verificar que
 * E_mec + Wd se conserva, o teste de sanidade numérica da simulação.
 */

const X = 0, Y = 1, VX = 2, VY = 3, WD = 4;

/** Coeficiente k em F_d = k·|v|·v, ou seja, k = ½·ρ·Cd·A. */
function dragK(p: Params): number {
  const r = (p.diametro ?? 0) / 2;
  return 0.5 * (p.rho ?? 0) * (p.cd ?? 0) * Math.PI * r * r;
}

function speed(s: State): number {
  return Math.hypot(s[VX] ?? 0, s[VY] ?? 0);
}

/** Alcance e altura máxima no vácuo, usados para enquadrar a cena. */
export function vacuumTrajectory(p: Params): { range: number; hmax: number } {
  const v0 = p.v0 ?? 0, g = p.g ?? 9.81, h0 = p.h0 ?? 0;
  const th = ((p.angulo ?? 0) * Math.PI) / 180;
  const vx = v0 * Math.cos(th), vy = v0 * Math.sin(th);
  const tFlight = (vy + Math.sqrt(vy * vy + 2 * g * h0)) / g;
  return { range: vx * tFlight, hmax: h0 + Math.max(0, (vy * vy) / (2 * g)) };
}

export const projetilArrasto: Simulation = {
  id: "projetil-arrasto",
  title: "Projétil com arrasto",
  course: "FG I",
  summary:
    "Lançamento oblíquo com resistência do ar proporcional a v². Compare com o vácuo, veja a velocidade terminal e acompanhe a energia dissipada.",
  equations: [
    String.raw`m\,\ddot{\vec r} = m\vec g - \tfrac12 \rho\, C_d A\, |\vec v|\,\vec v`,
    String.raw`v_t = \sqrt{\dfrac{2mg}{\rho C_d A}}`,
    String.raw`E_{mec}(t) + W_{arrasto}(t) = E_{mec}(0)`,
  ],

  stateVars: [
    { key: "x", label: "x", unit: "m" },
    { key: "y", label: "y", unit: "m" },
    { key: "vx", label: "vₓ", unit: "m/s" },
    { key: "vy", label: "v_y", unit: "m/s" },
    { key: "wd", label: "Energia dissipada", unit: "J" },
  ],

  params: [
    { key: "v0", label: "Velocidade inicial", unit: "m/s", min: 1, max: 100, step: 0.5, default: 30 },
    { key: "angulo", label: "Ângulo de lançamento", unit: "°", min: 0, max: 90, step: 0.5, default: 45 },
    { key: "h0", label: "Altura inicial", unit: "m", min: 0, max: 50, step: 0.5, default: 0 },
    { key: "massa", label: "Massa", unit: "kg", min: 0.005, max: 10, step: 0.005, default: 0.43 },
    { key: "diametro", label: "Diâmetro", unit: "m", min: 0.01, max: 1, step: 0.005, default: 0.22 },
    { key: "cd", label: "Coeficiente de arrasto Cd", unit: "", min: 0, max: 2, step: 0.01, default: 0.25 },
    { key: "rho", label: "Densidade do ar ρ", unit: "kg/m³", min: 0, max: 2, step: 0.005, default: 1.225 },
    { key: "g", label: "Gravidade g", unit: "m/s²", min: 0.5, max: 25, step: 0.01, default: 9.81 },
  ],

  observables: [
    { key: "x", label: "x", unit: "m", value: (s) => s[X] ?? 0 },
    { key: "y", label: "y", unit: "m", value: (s) => s[Y] ?? 0 },
    { key: "vx", label: "vₓ", unit: "m/s", value: (s) => s[VX] ?? 0 },
    { key: "vy", label: "v_y", unit: "m/s", value: (s) => s[VY] ?? 0 },
    { key: "v", label: "|v|", unit: "m/s", value: speed },
    { key: "K", label: "Energia cinética", unit: "J", value: (s, p) => 0.5 * (p.massa ?? 0) * speed(s) ** 2 },
    { key: "U", label: "Energia potencial", unit: "J", value: (s, p) => (p.massa ?? 0) * (p.g ?? 0) * (s[Y] ?? 0) },
    {
      key: "E",
      label: "Energia mecânica",
      unit: "J",
      value: (s, p) => 0.5 * (p.massa ?? 0) * speed(s) ** 2 + (p.massa ?? 0) * (p.g ?? 0) * (s[Y] ?? 0),
    },
    { key: "wd", label: "Energia dissipada", unit: "J", value: (s) => s[WD] ?? 0 },
    {
      key: "Etot",
      label: "E mecânica + dissipada",
      unit: "J",
      value: (s, p) =>
        0.5 * (p.massa ?? 0) * speed(s) ** 2 + (p.massa ?? 0) * (p.g ?? 0) * (s[Y] ?? 0) + (s[WD] ?? 0),
    },
  ],

  conserved: "Etot",

  scenarios: [
    {
      id: "futebol",
      label: "Bola de futebol (chute longo)",
      params: { v0: 30, angulo: 45, h0: 0, massa: 0.43, diametro: 0.22, cd: 0.25, rho: 1.225, g: 9.81 },
      guide: `### Chute longo
1. Rode a simulação e anote o alcance.
2. Zere **Cd** (vácuo) e rode de novo. Quanto o ar encurtou o chute, em %?
3. Com arrasto, procure o ângulo de alcance máximo. Ele ainda é 45°? Por quê?`,
    },
    {
      id: "vacuo",
      label: "Vácuo (sem arrasto)",
      params: { v0: 30, angulo: 45, h0: 0, cd: 0 },
      guide: `### Referência analítica
Sem arrasto, o alcance é R = v₀² sen(2θ)/g. Compare o valor medido com a fórmula e
confira no gráfico que a **energia mecânica** fica constante.`,
    },
    {
      id: "terminal",
      label: "Queda livre até a velocidade terminal",
      params: { v0: 0.001, angulo: 90, h0: 50, massa: 0.005, diametro: 0.065, cd: 0.6, rho: 1.225, g: 9.81 },
      guide: `### Velocidade terminal (peteca)
1. Plote **v_y** e veja o patamar.
2. Calcule v_t = √(2mg/(ρ Cd A)) e compare com o patamar do gráfico.
3. Para onde vai a energia potencial perdida? Olhe a curva de **energia dissipada**.`,
    },
    {
      id: "beisebol",
      label: "Bola de beisebol (home run)",
      params: { v0: 45, angulo: 35, h0: 1, massa: 0.145, diametro: 0.074, cd: 0.3, rho: 1.225, g: 9.81 },
      guide: `### Home run
Um rebatedor tira a bola a 45 m/s. Ela passa do muro a 120 m?
Repita com ρ = 1,0 kg/m³ (estádio em altitude, como em Denver) e compare.`,
    },
  ],

  init(p) {
    const th = ((p.angulo ?? 0) * Math.PI) / 180;
    const v0 = p.v0 ?? 0;
    return [0, p.h0 ?? 0, v0 * Math.cos(th), v0 * Math.sin(th), 0];
  },

  derivatives(s, p) {
    const m = p.massa ?? 1;
    const k = dragK(p);
    const v = speed(s);
    const vx = s[VX] ?? 0, vy = s[VY] ?? 0;
    return [vx, vy, (-k * v * vx) / m, -(p.g ?? 0) - (k * v * vy) / m, k * v * v * v];
  },
  integrator: "rk4",

  // Termina quando o projétil toca o chão (y = 0) descendo.
  stopWhen: (s) => ((s[VY] ?? 0) > 0 ? 1 : (s[Y] ?? 0)),

  viewport(p) {
    const { range, hmax } = vacuumTrajectory(p);
    const w = Math.max(range, hmax, 5) * 1.1;
    return { width: w, height: Math.max(hmax * 1.15, w * 0.4) };
  },

  render(ctx, { state, params, trail, scale }) {
    const px = 1 / scale;
    const x = state[X] ?? 0, y = state[Y] ?? 0, vx = state[VX] ?? 0, vy = state[VY] ?? 0;

    // Chão
    ctx.fillStyle = "rgba(120, 140, 110, 0.35)";
    ctx.fillRect(-1e4, -1e4, 2e4, 1e4);

    // Trajetória no vácuo, tracejada, como referência
    const th = ((params.angulo ?? 0) * Math.PI) / 180;
    const v0 = params.v0 ?? 0, g = params.g ?? 9.81, h0 = params.h0 ?? 0;
    const { range } = vacuumTrajectory(params);
    if (range > 0 && v0 * Math.cos(th) > 1e-9) {
      ctx.setLineDash([6 * px, 6 * px]);
      ctx.strokeStyle = "rgba(128, 128, 128, 0.7)";
      ctx.lineWidth = 1.5 * px;
      ctx.beginPath();
      for (let i = 0; i <= 100; i++) {
        const xi = (range * i) / 100;
        const ti = xi / (v0 * Math.cos(th));
        const yi = h0 + v0 * Math.sin(th) * ti - 0.5 * g * ti * ti;
        if (i === 0) ctx.moveTo(xi, yi);
        else ctx.lineTo(xi, yi);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Rastro com arrasto
    ctx.strokeStyle = "#2f7de1";
    ctx.lineWidth = 2.5 * px;
    ctx.beginPath();
    trail.forEach((s, i) => (i === 0 ? ctx.moveTo(s[X] ?? 0, s[Y] ?? 0) : ctx.lineTo(s[X] ?? 0, s[Y] ?? 0)));
    ctx.lineTo(x, y);
    ctx.stroke();

    // Vetores: velocidade (azul) e força de arrasto (vermelho), em pixels fixos por unidade
    const v = Math.hypot(vx, vy);
    if (v > 1e-9) {
      arrow(ctx, x, y, (vx / v) * 40 * px, (vy / v) * 40 * px, "#2f7de1", px);
      const fd = dragK(params) * v * v;
      const fg = (params.massa ?? 1) * g;
      const len = Math.min(60, (fd / fg) * 40) * px;
      if (len > 2 * px) arrow(ctx, x, y, (-vx / v) * len, (-vy / v) * len, "#d9534f", px);
    }

    // Projétil, desenhado com raio mínimo visível
    ctx.fillStyle = "#f0a020";
    ctx.beginPath();
    ctx.arc(x, y, Math.max((params.diametro ?? 0) / 2, 6 * px), 0, 2 * Math.PI);
    ctx.fill();
  },
};

function arrow(ctx: CanvasRenderingContext2D, x: number, y: number, dx: number, dy: number, color: string, px: number) {
  const len = Math.hypot(dx, dy);
  const ux = dx / len, uy = dy / len;
  const head = 8 * px;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2 * px;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + dx, y + dy);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + dx, y + dy);
  ctx.lineTo(x + dx - head * (ux - 0.5 * uy), y + dy - head * (uy + 0.5 * ux));
  ctx.lineTo(x + dx - head * (ux + 0.5 * uy), y + dy - head * (uy - 0.5 * ux));
  ctx.closePath();
  ctx.fill();
}

export default projetilArrasto;
