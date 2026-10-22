import { defineSim, draw, num, texNum, type Params } from "@fisilab/core";
import { derivation } from "./derivation.ts";

/** Integral elíptica completa de 1ª espécie K(k) pela média aritmético-geométrica. */
export function ellipticK(k: number): number {
  let a = 1;
  let b = Math.sqrt(1 - k * k);
  for (let i = 0; i < 30 && Math.abs(a - b) > 1e-15; i++) [a, b] = [(a + b) / 2, Math.sqrt(a * b)];
  return Math.PI / (2 * a);
}

const TIPOS = ["Simples (massa pontual)", "Físico (barra uniforme)", "Físico (disco na ponta da haste)"];

/** Distância pivô–centro de massa e momento de inércia em relação ao pivô. */
export function geometry(p: Params): { d: number; I: number } {
  const L = num(p, "L", 1);
  const m = num(p, "m", 1);
  switch (Math.round(num(p, "tipo"))) {
    case 1:
      return { d: L / 2, I: (m * L * L) / 3 };
    case 2: {
      // Disco de raio L/5 preso na ponta de uma haste sem massa de comprimento L.
      const r = L / 5;
      return { d: L, I: m * L * L + 0.5 * m * r * r };
    }
    default:
      return { d: L, I: m * L * L };
  }
}

/** ω₀ = √(m g d / I) */
export function omega0(p: Params): number {
  const { d, I } = geometry(p);
  return Math.sqrt((num(p, "m", 1) * num(p, "g", 9.81) * d) / I);
}

/** Período exato (sem amortecimento) para amplitude θ₀. */
export function periodExact(p: Params): number {
  const th0 = (num(p, "theta0") * Math.PI) / 180;
  return (4 / omega0(p)) * ellipticK(Math.sin(Math.abs(th0) / 2));
}

const TH = 0, W = 1, THL = 2, WL = 3;

export const pendulos = defineSim({
  id: "pendulos",
  title: "Pêndulos simples, físico e de grandes amplitudes",
  course: "FG I",
  topic: "Oscilações",
  priority: "P1",
  summary:
    "Compare o pêndulo real (equação não linear) com a aproximação de pequenos ângulos, troque massa pontual por corpo extenso e veja o período crescer com a amplitude.",
  derivation,
  equations: [
    String.raw`I\,\ddot\theta = -m g d \sin\theta - b\,\dot\theta`,
    String.raw`T_0 = 2\pi\sqrt{\frac{I}{m g d}} \qquad T = \frac{4}{\omega_0} K\!\left(\sin\frac{\theta_0}{2}\right)`,
  ],
  liveEquations(_s, p) {
    const T0 = (2 * Math.PI) / omega0(p);
    return [String.raw`T_0 = ${texNum(T0)}\ \text{s} \qquad T_{\text{exato}} = ${texNum(periodExact(p))}\ \text{s} \quad (${texNum((periodExact(p) / T0 - 1) * 100)}\%\ \text{maior})`];
  },

  params: [
    { key: "tipo", label: "Tipo de pêndulo", unit: "", min: 0, max: 2, step: 1, default: 0, options: TIPOS.map((label, value) => ({ value, label })) },
    { key: "L", label: "Comprimento", unit: "m", min: 0.1, max: 3, step: 0.05, default: 1 },
    { key: "theta0", label: "Amplitude inicial θ₀", unit: "°", min: 1, max: 179, step: 1, default: 30 },
    { key: "m", label: "Massa", unit: "kg", min: 0.1, max: 10, step: 0.1, default: 1 },
    { key: "g", label: "Gravidade", unit: "m/s²", min: 1, max: 25, step: 0.01, default: 9.81 },
    { key: "b", label: "Amortecimento b", unit: "N·m·s", min: 0, max: 2, step: 0.01, default: 0 },
    {
      key: "fantasma",
      label: "Mostrar aproximação linear",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 1,
      live: true,
      options: [
        { value: 1, label: "Sim" },
        { value: 0, label: "Não" },
      ],
    },
  ],

  observables: [
    { key: "theta", label: "θ", unit: "°", value: (s) => ((s[TH] ?? 0) * 180) / Math.PI },
    { key: "omega", label: "ω", unit: "rad/s", value: (s) => s[W] ?? 0 },
    { key: "thetaLin", label: "θ (aprox. linear)", unit: "°", value: (s) => ((s[THL] ?? 0) * 180) / Math.PI },
    {
      key: "E",
      label: "Energia mecânica",
      unit: "J",
      value: (s, p) => {
        const { d, I } = geometry(p);
        return 0.5 * I * (s[W] ?? 0) ** 2 + num(p, "m", 1) * num(p, "g", 9.81) * d * (1 - Math.cos(s[TH] ?? 0));
      },
    },
    { key: "T0", label: "Período (pequenos ângulos)", unit: "s", value: (_s, p) => (2 * Math.PI) / omega0(p) },
    { key: "T", label: "Período exato", unit: "s", value: (_s, p) => periodExact(p) },
  ],
  conserved: "E",
  chart: { x: "t", y: "theta" },

  scenarios: [
    {
      id: "pequeno",
      label: "Pequenas oscilações",
      params: { tipo: 0, theta0: 10, b: 0 },
      guide: `### Isocronismo
1. Com 10°, o pêndulo real e a aproximação linear quase coincidem.
2. Dobre a massa. O período muda?
3. Quadruplique o comprimento e confirme que o período dobra: $T \\propto \\sqrt{L}$.`,
      predict: [
        {
          question: "Dobrando a massa do pêndulo simples, o período:",
          options: ["dobra", "cai pela metade", "não muda"],
          answer: 2,
          explanation: "A massa aparece na força ($mg\\sin\\theta$) e na inércia ($mL^2$) e se cancela: $T_0 = 2\\pi\\sqrt{L/g}$.",
        },
      ],
    },
    {
      id: "grande",
      label: "Grande amplitude (120°)",
      params: { tipo: 0, theta0: 120, b: 0 },
      guide: `### Quando a aproximação falha
1. Compare a curva real com a linear no gráfico: o real atrasa a cada ciclo.
2. Leia o **período exato** e compare com $T_0$. Quanto maior?
3. Tente 179°: o pêndulo quase para no topo.`,
      predict: [
        {
          question: "Com amplitude de 120°, o período real comparado com $2\\pi\\sqrt{L/g}$ é:",
          options: ["menor", "igual", "maior"],
          answer: 2,
          explanation: "Para ângulos grandes $\\sin\\theta < \\theta$: a força restauradora é menor que a da aproximação linear e o pêndulo demora mais. Em 120° o período é cerca de 37% maior.",
        },
      ],
    },
    {
      id: "fisico",
      label: "Pêndulo físico (barra)",
      params: { tipo: 1, theta0: 15, b: 0 },
      guide: `### Corpo extenso
Uma barra uniforme de comprimento $L$ presa na ponta tem $I = mL^2/3$ e $d = L/2$, então $T_0 = 2\\pi\\sqrt{2L/(3g)}$.
Compare com o pêndulo simples de mesmo $L$: qual oscila mais rápido? Qual seria o comprimento equivalente?`,
    },
    {
      id: "amortecido",
      label: "Com atrito no pivô",
      params: { tipo: 0, theta0: 45, b: 0.3 },
      guide: `### Amortecimento
Observe a amplitude decair e a energia mecânica cair. Plote **Energia mecânica** contra o tempo.`,
    },
  ],

  exercises: [
    {
      id: "simples",
      prompt: "Um pêndulo simples tem {L} m de comprimento num local com g = {g} m/s². Qual é o período para pequenas oscilações?",
      vary: { L: [0.2, 3, 2], g: [9.6, 9.9, 2] },
      fixed: { tipo: 0 },
      answer: { label: "T", unit: "s", compute: (p) => (2 * Math.PI) / omega0(p) },
      tolerance: 0.01,
    },
    {
      id: "barra",
      prompt: "Uma barra uniforme de {L} m oscila presa por uma das pontas (g = 9,81 m/s²). Qual é o período para pequenas oscilações?",
      vary: { L: [0.3, 2.5, 2] },
      fixed: { tipo: 1, g: 9.81 },
      answer: { label: "T", unit: "s", compute: (p) => (2 * Math.PI) / omega0(p) },
      hint: "I = mL²/3 em relação à ponta e d = L/2.",
      tolerance: 0.01,
    },
  ],

  init(p) {
    const th = (num(p, "theta0") * Math.PI) / 180;
    return [th, 0, th, 0];
  },
  derivatives(s, p) {
    const { d, I } = geometry(p);
    const m = num(p, "m", 1);
    const g = num(p, "g", 9.81);
    const b = num(p, "b");
    const k = (m * g * d) / I;
    return [s[W]!, -k * Math.sin(s[TH]!) - (b / I) * s[W]!, s[WL]!, -k * s[THL]! - (b / I) * s[WL]!];
  },
  dt: 1e-3,
  tEnd: 60,

  viewport(p) {
    const L = num(p, "L", 1);
    return { xMin: -1.25 * L, xMax: 1.25 * L, yMin: -1.3 * L, yMax: 0.35 * L, unit: "m" };
  },

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const { state: s, params: p, theme } = frame;
    const L = num(p, "L", 1);
    const tipo = Math.round(num(p, "tipo"));
    d.support(-0.3 * L, 0, 0.3 * L, 0, { color: theme.muted });
    // Arco da amplitude
    const th0 = (num(p, "theta0") * Math.PI) / 180;
    const arc: [number, number][] = [];
    for (let k = 0; k <= 60; k++) {
      const a = -th0 + (2 * th0 * k) / 60;
      arc.push([L * 1.05 * Math.sin(a), -L * 1.05 * Math.cos(a)]);
    }
    d.polyline(arc, { color: theme.grid, width: 1.5, dash: [4, 4] });
    d.line(0, 0, 0, -L * 1.1, { color: theme.grid, dash: [3, 5] });

    const bob = (th: number, ghost: boolean) => {
      const x = L * Math.sin(th);
      const y = -L * Math.cos(th);
      const color = ghost ? theme.muted : theme.text;
      const alpha = ghost ? 0.45 : 1;
      if (tipo === 1) {
        d.line(0, 0, x, y, { color: ghost ? theme.muted : theme.series[1], width: 10, alpha });
      } else {
        d.line(0, 0, x, y, { color, width: 1.5, alpha });
        d.circle(x, y, tipo === 2 ? L / 5 : 0.06 * L, { fill: ghost ? theme.muted : theme.series[1], alpha, minPx: 7 });
      }
      return { x, y };
    };
    if (num(p, "fantasma", 1) > 0.5) bob(s[THL] ?? 0, true);
    const { x, y } = bob(s[TH] ?? 0, false);
    // Vetor velocidade tangencial
    const w = s[W] ?? 0;
    d.arrowPx(x, y, Math.cos(s[TH] ?? 0) * w, Math.sin(s[TH] ?? 0) * w, Math.min(70, Math.abs(w) * 20), { color: theme.accent });
    d.dot(0, 0, 4, theme.text);
  },
});

export default pendulos;
