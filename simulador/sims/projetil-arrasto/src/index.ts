import { defineSim, draw, texNum, type Params, type State } from "@fisilab/core";

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

export const projetilArrasto = defineSim({
  id: "projetil-arrasto",
  title: "Projétil com arrasto",
  course: "FG I",
  topic: "Cinemática 2D",
  priority: "P1",
  summary:
    "Lançamento oblíquo com resistência do ar proporcional a v². Compare com o vácuo, veja a velocidade terminal e acompanhe a energia dissipada.",
  equations: [
    String.raw`m\,\ddot{\vec r} = m\vec g - \tfrac12 \rho\, C_d A\, |\vec v|\,\vec v`,
    String.raw`v_t = \sqrt{\dfrac{2mg}{\rho C_d A}}`,
    String.raw`E_{mec}(t) + W_{arrasto}(t) = E_{mec}(0)`,
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
  chart: { x: "x", y: "y" },

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
    return { xMin: 0, xMax: w, yMin: 0, yMax: Math.max(hmax * 1.15, w * 0.4), unit: "m" };
  },

  liveEquations(s, p) {
    const v = speed(s);
    const k = dragK(p);
    return [
      String.raw`|\vec F_d| = \tfrac12 \rho C_d A v^2 = ${texNum(k * v * v)}\ \text{N}`,
      String.raw`v_t = ${texNum(Math.sqrt((2 * (p.massa ?? 1) * (p.g ?? 9.81)) / Math.max(1e-12, 2 * k)))}\ \text{m/s}`,
    ];
  },

  exercises: [
    {
      id: "alcance-vacuo",
      prompt:
        "Um projétil é lançado do chão com velocidade {v0} m/s a {angulo}° da horizontal, sem resistência do ar (g = 9,81 m/s²). Qual é o alcance horizontal?",
      vary: { v0: [10, 40, 1], angulo: [15, 75, 0] },
      fixed: { cd: 0, h0: 0, g: 9.81 },
      answer: {
        label: "Alcance",
        unit: "m",
        compute: (p) => vacuumTrajectory(p).range,
      },
      hint: "Sem arrasto, R = v₀² sen(2θ)/g.",
    },
    {
      id: "velocidade-terminal",
      prompt:
        "Uma esfera de {massa} kg e diâmetro {diametro} m (Cd = {cd}) cai no ar (ρ = 1,225 kg/m³, g = 9,81 m/s²). Qual é a velocidade terminal?",
      vary: { massa: [0.01, 0.5, 3], diametro: [0.03, 0.25, 3], cd: [0.3, 0.6, 2] },
      fixed: { rho: 1.225, g: 9.81 },
      answer: {
        label: "v_t",
        unit: "m/s",
        compute: (p) => Math.sqrt((2 * (p.massa ?? 0) * (p.g ?? 0)) / (2 * dragK(p))),
      },
      hint: "No equilíbrio, mg = ½ρC_dAv².",
    },
  ],

  render(ctx, frame) {
    const { state, params, trail, theme } = frame;
    const d = draw(ctx, frame);
    const x = state[X] ?? 0, y = state[Y] ?? 0, vx = state[VX] ?? 0, vy = state[VY] ?? 0;

    d.rect(-1e4, -1e4, 2e4, 1e4, { fill: theme.ground });

    // Trajetória no vácuo, tracejada, como referência
    const th = ((params.angulo ?? 0) * Math.PI) / 180;
    const v0 = params.v0 ?? 0, g = params.g ?? 9.81, h0 = params.h0 ?? 0;
    const { range } = vacuumTrajectory(params);
    const v0x = v0 * Math.cos(th);
    if (range > 0 && v0x > 1e-9) {
      d.plot((xi) => h0 + v0 * Math.sin(th) * (xi / v0x) - 0.5 * g * (xi / v0x) ** 2, 0, range, {
        color: theme.muted,
        dash: [6, 6],
        alpha: 0.8,
      });
    }

    d.polyline([...trail.map((s): [number, number] => [s[X] ?? 0, s[Y] ?? 0]), [x, y]], { color: theme.accent, width: 2.5 });

    // Vetores: velocidade e força de arrasto (comprimento proporcional a F_d/peso)
    const v = Math.hypot(vx, vy);
    if (v > 1e-9) {
      d.arrowPx(x, y, vx, vy, 40, { color: theme.accent });
      const ratio = (dragK(params) * v * v) / ((params.massa ?? 1) * g);
      d.arrowPx(x, y, -vx, -vy, Math.min(60, ratio * 40), { color: theme.positive });
    }
    d.circle(x, y, (params.diametro ?? 0) / 2, { fill: theme.series[1], minPx: 6 });
  },
});

export default projetilArrasto;
