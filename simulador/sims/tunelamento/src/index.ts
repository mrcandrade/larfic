import { defineSim, draw, num, texNum, type Draw, type Params, type Theme } from "@fisilab/core";
import { fmt, panel } from "./panel.ts";
import { NX, XL, barrierT, cnStep, gaussianPacket, packetT, potentialGrid, probability, transmission, xAt, type Region, type Wave } from "./physics.ts";

export * from "./physics.ts";

/** Unidades de tempo físico (ħ/E) por segundo do relógio da simulação. */
export const TIME_SCALE = 10;

const tipo = (p: Params) => Math.round(num(p, "tipo"));
const E0 = (p: Params) => num(p, "E0", 1);
const k0 = (p: Params) => Math.sqrt(2 * E0(p));
const sig = (p: Params) => num(p, "sigma", 6);

/** Trechos do potencial a partir dos parâmetros (centrados em x = 0). */
export function regionsOf(p: Params): Region[] {
  const V0 = num(p, "V0", 1.2);
  const a = num(p, "a", 1.5);
  switch (tipo(p)) {
    case 1:
      return [{ x0: -a / 2, x1: a / 2, V: -V0 }];
    case 2: {
      const g = num(p, "sep", 3);
      return [
        { x0: -g / 2 - a, x1: -g / 2, V: V0 },
        { x0: g / 2, x1: g / 2 + a, V: V0 },
      ];
    }
    default:
      return [{ x0: -a / 2, x1: a / 2, V: V0 }];
  }
}

const extent = (p: Params) => {
  const rs = regionsOf(p);
  return { left: Math.min(...rs.map((r) => r.x0)), right: Math.max(...rs.map((r) => r.x1)) };
};
/** Centro inicial do pacote: 4σ + 8 à esquerda da borda do potencial. */
export const startX = (p: Params) => extent(p).left - 4 * sig(p) - 8;
/** Instante (relógio da sim) em que a medida termina: o pacote livre teria andado 2|x₀|. */
export const tStop = (p: Params) => (2 * Math.abs(startX(p))) / k0(p) / TIME_SCALE;

const vCache = new Map<string, Float64Array>();
function Vgrid(p: Params): Float64Array {
  const key = JSON.stringify(regionsOf(p));
  let V = vCache.get(key);
  if (!V) {
    V = potentialGrid(regionsOf(p));
    if (vCache.size > 8) vCache.delete(vCache.keys().next().value!);
    vCache.set(key, V);
  }
  return V;
}

const PL = (s: Wave, p: Params) => probability(s, -Infinity, extent(p).left);
const PR = (s: Wave, p: Params) => probability(s, extent(p).right, Infinity);

export const tunelamento = defineSim<Wave>({
  id: "tunelamento",
  title: "Tunelamento quântico",
  course: "FG IV",
  topic: "Quântica",
  priority: "P1",
  summary:
    "Um pacote de onda gaussiano colide com uma barreira, um poço ou uma barreira dupla. A equação de Schrödinger é resolvida por Crank–Nicolson e a probabilidade transmitida é comparada com T(E) calculado analiticamente.",
  equations: [
    String.raw`i\frac{\partial\psi}{\partial t} = -\frac12\frac{\partial^2\psi}{\partial x^2} + V(x)\psi \qquad (\hbar = m = 1)`,
    String.raw`\left(1 + \tfrac{i\Delta t}{2}H\right)\psi^{n+1} = \left(1 - \tfrac{i\Delta t}{2}H\right)\psi^{n}`,
    String.raw`T = \left[1 + \frac{V_0^2\sinh^2(\kappa a)}{4E(V_0 - E)}\right]^{-1} \qquad \kappa = \sqrt{2(V_0 - E)}`,
    String.raw`\langle T\rangle = \int |\phi(k)|^2\, T\!\left(\tfrac{k^2}{2}\right) dk \qquad \sigma_k = \frac{1}{2\sigma}`,
  ],
  liveEquations(s, p) {
    const rs = regionsOf(p);
    return [
      String.raw`E_0 = ${texNum(E0(p))},\ k_0 = ${texNum(k0(p))} \qquad T(E_0) = ${texNum(transmission(E0(p), rs))} \qquad \langle T\rangle_{\text{pacote}} = ${texNum(packetT(k0(p), sig(p), rs))}`,
      String.raw`P_{\text{esq}} = ${texNum(PL(s, p))} \qquad P_{\text{dir}} = ${texNum(PR(s, p))} \qquad \int|\psi|^2dx = ${texNum(probability(s), 8)}`,
    ];
  },

  params: [
    {
      key: "tipo",
      label: "Potencial",
      unit: "",
      min: 0,
      max: 2,
      step: 1,
      default: 0,
      options: [
        { value: 0, label: "Barreira retangular" },
        { value: 1, label: "Poço retangular" },
        { value: 2, label: "Barreira dupla (ressonância)" },
      ],
    },
    { key: "E0", label: "Energia média do pacote E₀", unit: "", min: 0.3, max: 3, step: 0.01, default: 1 },
    { key: "V0", label: "Altura da barreira (ou profundidade do poço) V₀", unit: "", min: 0, max: 3, step: 0.01, default: 1.2 },
    { key: "a", label: "Largura a", unit: "", min: 0.2, max: 4, step: 0.05, default: 1.5 },
    { key: "sep", label: "Distância entre barreiras (dupla)", unit: "", min: 1, max: 8, step: 0.1, default: 3 },
    { key: "sigma", label: "Largura do pacote σ", unit: "", min: 4, max: 10, step: 0.5, default: 6 },
  ],

  observables: [
    { key: "tau", label: "Tempo (ħ = m = 1)", unit: "", value: (_s, _p, t) => t * TIME_SCALE },
    { key: "PL", label: "Probabilidade à esquerda", unit: "", value: (s, p) => PL(s, p) },
    { key: "PR", label: "Probabilidade à direita (transmitida)", unit: "", value: (s, p) => PR(s, p) },
    { key: "norma", label: "Norma ∫|ψ|²dx", unit: "", value: (s) => probability(s) },
    { key: "Tana", label: "T(E₀) analítico", unit: "", value: (_s, p) => transmission(E0(p), regionsOf(p)) },
    { key: "Tpac", label: "⟨T⟩ do pacote", unit: "", value: (_s, p) => packetT(k0(p), sig(p), regionsOf(p)) },
  ],
  conserved: "norma",
  chart: { x: "tau", y: "PR" },

  scenarios: [
    {
      id: "tunel",
      label: "Tunelamento (E < V₀)",
      params: { tipo: 0, E0: 1, V0: 1.2, a: 1.5, sigma: 6 },
      guide: `### Atravessar sem energia suficiente
1. A energia média do pacote ($E_0 = 1$) é menor que a barreira ($V_0 = 1{,}2$). Classicamente, nada passaria.
2. Rode até o fim: a probabilidade à direita é a transmissão medida. Compare com $T(E_0)$ e com $\\langle T\\rangle$ (média sobre as energias do pacote), no gráfico de baixo.
3. Observe as franjas à esquerda durante a colisão: são a interferência entre a onda incidente e a refletida.
4. A norma $\\int|\\psi|^2dx$ fica igual a 1: Crank–Nicolson é unitário.`,
      predict: [
        {
          question: "Se a largura da barreira dobrar (E < V₀), a transmissão:",
          options: ["cai pela metade", "cai muito mais que pela metade (quase exponencialmente)", "não muda", "dobra"],
          answer: 1,
          explanation: "Para $\\kappa a \\gg 1$, $T \\approx 16\\frac{E}{V_0}(1 - \\frac{E}{V_0}) e^{-2\\kappa a}$: dobrar $a$ eleva o fator exponencial ao quadrado.",
        },
      ],
    },
    {
      id: "acima",
      label: "Acima da barreira (E > V₀)",
      params: { tipo: 0, E0: 1.6, V0: 1, a: 2, sigma: 8 },
      guide: `### Reflexão acima da barreira
1. Agora $E_0 > V_0$: uma partícula clássica sempre passaria.
2. Meça a transmissão: parte do pacote é refletida.
3. No gráfico $T(E)$, veja as oscilações para $E > V_0$: $T = 1$ quando $ka = n\\pi$ (ressonância de transmissão, $k = \\sqrt{2(E - V_0)}$).`,
      predict: [
        {
          question: "Com E maior que a altura da barreira, a probabilidade de reflexão é:",
          options: ["zero, como na física clássica", "em geral maior que zero", "sempre 50%"],
          answer: 1,
          explanation: "A onda se reflete em qualquer variação brusca do potencial. Só em energias especiais ($ka = n\\pi$) a reflexão se anula.",
        },
      ],
    },
    {
      id: "ressonancia",
      label: "Barreira dupla: tunelamento ressonante",
      params: { tipo: 2, E0: 0.5, V0: 2, a: 0.6, sep: 3, sigma: 10 },
      guide: `### Diodo de tunelamento ressonante
1. Duas barreiras formam um poço entre elas, com estados quase ligados.
2. O gráfico $T(E)$ tem picos estreitos onde $T \\approx 1$, mesmo com cada barreira refletindo bastante.
3. Ajuste $E_0$ sobre um pico e rode com $\\sigma$ grande (pacote com energia bem definida). Parte da onda fica presa entre as barreiras por um tempo e vaza aos poucos.
4. Fora do pico, quase tudo é refletido.`,
    },
  ],

  exercises: [
    {
      id: "adimensional",
      prompt: "Em unidades com ħ = m = 1, uma partícula de energia {E0} incide numa barreira de altura {V0} e largura {a}. Qual é o coeficiente de transmissão?",
      vary: { E0: [0.3, 0.9, 2], V0: [1, 2, 1], a: [0.5, 2, 1] },
      fixed: { tipo: 0 },
      answer: { label: "T", unit: "", compute: (p) => barrierT(num(p, "E0"), num(p, "V0"), num(p, "a")) },
      hint: "κ = √(2(V₀ − E)) e T = [1 + V₀² sinh²(κa) / (4E(V₀ − E))]⁻¹.",
    },
    {
      id: "eletron",
      prompt: "Um elétron de {Eev} eV encontra uma barreira de {Uev} eV com largura de {Lnm} nm. Qual é a probabilidade de transmissão (exata, barreira retangular)?",
      vary: { Eev: [1, 4, 1], Uev: [5, 10, 1], Lnm: [0.1, 0.5, 2] },
      answer: {
        label: "T",
        unit: "",
        compute: (p) => {
          const e = 1.602176634e-19;
          const E = num(p, "Eev") * e;
          const U = num(p, "Uev") * e;
          const kap = Math.sqrt(2 * 9.1093837015e-31 * (U - E)) / 1.054571817e-34;
          return 1 / (1 + (U * U * Math.sinh(kap * num(p, "Lnm") * 1e-9) ** 2) / (4 * E * (U - E)));
        },
      },
      tolerance: 0.03,
      hint: "κ = √(2m(U − E))/ħ; para κL grande, T ≈ 16(E/U)(1 − E/U)e^{−2κL}.",
    },
  ],

  init: (p) => gaussianPacket(startX(p), sig(p), k0(p)),
  step: (s, p, _t, dt) => cnStep(s, Vgrid(p), dt * TIME_SCALE),
  dt: 0.02,
  sampleEvery: 10,
  maxSamples: 150,
  stopWhen: (_s, p, t) => tStop(p) - t,

  viewport: () => ({ xMin: 0, xMax: 20, yMin: 0, yMax: 12 }),

  render(ctx, frame) {
    const d = draw(ctx, frame);
    renderWave(d, frame.theme, frame.state, frame.params);
    renderT(d, frame.theme, frame.state, frame.params, frame.t);
  },
});

function renderWave(d: Draw, theme: Theme, s: Wave, p: Params) {
  const rs = regionsOf(p);
  const V0 = num(p, "V0", 1.2);
  const Emax = Math.max(E0(p), V0, 0.5) * 1.35;
  const Emin = tipo(p) === 1 ? -V0 * 1.15 : -0.1 * Emax;
  const half = Math.min(XL, Math.abs(startX(p)) + 12);
  const P = panel(d, { x0: 1.2, y0: 5.6, x1: 19.6, y1: 11.6 }, { min: -half, max: half }, { min: Emin, max: Emax });
  P.frame({ xlabel: "x", ylabel: "E, V(x) e |ψ|²" });
  // Potencial preenchido
  for (const r of rs) {
    const y0 = P.Y(Math.min(0, r.V));
    const y1 = P.Y(Math.max(0, r.V));
    d.rect(P.X(r.x0), y0, P.X(r.x1) - P.X(r.x0), y1 - y0, { fill: theme.ground, stroke: theme.text, width: 1.2 });
  }
  P.line(
    [
      [-half, 0],
      [half, 0],
    ],
    { color: theme.muted, width: 1 },
  );
  // Energia média
  P.line(
    [
      [-half, E0(p)],
      [half, E0(p)],
    ],
    { color: theme.positive, dash: [6, 4], width: 1.2 },
  );
  d.text(`E₀ = ${fmt(E0(p))}`, P.X(-half), P.Y(E0(p)), { align: "left", dx: 4, dy: -8, size: 10, color: theme.positive });
  // |ψ|² sobre a linha de energia, e Re ψ fino
  const peak = 1 / (Math.sqrt(2 * Math.PI) * sig(p));
  const sc = (0.55 * (Emax - E0(p) + 0.6 * Emax)) / peak / 1.6;
  const dens: [number, number][] = [];
  const reP: [number, number][] = [];
  for (let i = 0; i < NX; i += 3) {
    const x = xAt(i);
    if (x < -half || x > half) continue;
    dens.push([x, E0(p) + (s.re[i]! ** 2 + s.im[i]! ** 2) * sc]);
    reP.push([x, E0(p) + s.re[i]! * Math.sqrt(peak) * sc * 0.5]);
  }
  P.line(reP, { color: theme.accent, width: 1, alpha: 0.45 });
  P.line(dens, { color: theme.accent, width: 2 });
  d.text(`P esquerda = ${fmt(PL(s, p), 3)}   P direita = ${fmt(PR(s, p), 3)}   norma = ${probability(s).toFixed(6).replace(".", ",")}`, 1.3, 11.6, {
    align: "left",
    size: 11,
    dy: -9,
    weight: "600",
  });
}

function renderT(d: Draw, theme: Theme, s: Wave, p: Params, t: number) {
  const rs = regionsOf(p);
  const V0 = num(p, "V0", 1.2);
  const Emax = Math.max(2 * V0, 1.5 * E0(p), 1);
  const P = panel(d, { x0: 1.2, y0: 0.8, x1: 13.2, y1: 4.4 }, { min: 0, max: Emax }, { min: 0, max: 1.05 });
  P.frame({ xlabel: "E", ylabel: "T(E)", yticks: [0, 0.25, 0.5, 0.75, 1] });
  // Distribuição de energias do pacote (sombreada)
  const sk = 1 / (2 * sig(p));
  const pts: [number, number][] = [];
  for (let i = 0; i <= 120; i++) {
    const k = k0(p) + sk * (-4 + (8 * i) / 120);
    if (k <= 0) continue;
    pts.push([(k * k) / 2, 0.9 * Math.exp(-((k - k0(p)) ** 2) / (2 * sk * sk))]);
  }
  P.line([[pts[0]?.[0] ?? 0, 0], ...pts, [pts[pts.length - 1]?.[0] ?? 0, 0]], { color: theme.series[2]!, fill: theme.series[2]!, alpha: 0.18, width: 1 });
  P.plot((E) => transmission(E, rs), Math.max(1e-4, Emax / 2000), Emax, { color: theme.text, width: 2, n: 600 });
  if (tipo(p) !== 1 && V0 > 0) P.line([[V0, 0], [V0, 1.05]], { color: theme.muted, dash: [4, 3], width: 1 });
  const Ta = transmission(E0(p), rs);
  d.dot(P.X(E0(p)), P.Y(Ta), 4, theme.text);
  const done = t >= tStop(p) * 0.999;
  const pr = PR(s, p);
  if (done) d.dot(P.X(E0(p)), P.Y(pr), 6, theme.positive);
  else d.circle(P.X(E0(p)), P.Y(pr), 0, { stroke: theme.positive, minPx: 5, width: 1.5 });
  // Legenda e números
  const Tp = packetT(k0(p), sig(p), rs);
  const rows: [string, string][] = [
    [`T(E₀) analítico = ${fmt(Ta, 4)}`, theme.text],
    [`⟨T⟩ do pacote = ${fmt(Tp, 4)}`, theme.series[2]!],
    [done ? `T medido = ${fmt(pr, 4)}` : `P direita (medindo…) = ${fmt(pr, 3)}`, theme.positive],
    [done ? `diferença: ${fmt((100 * (pr - Tp)) / Math.max(Tp, 1e-9), 2)}% de ⟨T⟩` : "rode até o fim para medir T", theme.muted],
  ];
  rows.forEach(([txt, col], i) => d.text(txt, 13.8, 4.2 - i * 0.7, { align: "left", size: 11, color: col, weight: i === 2 ? "600" : "400" }));
  d.text("verde: energias presentes no pacote", 13.8, 4.2 - 4 * 0.7, { align: "left", size: 10, color: theme.muted });
}

export default tunelamento;
