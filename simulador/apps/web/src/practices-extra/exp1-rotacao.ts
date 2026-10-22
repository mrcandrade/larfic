// Dinâmica de rotação: torque do fio × aceleração angular → momento de inércia e torque de atrito.
import type { Practice } from "@fisilab/analysis";

const G = 9.81;

export const practice: Practice = {
  id: "exp1-rotacao",
  course: "Exp I",
  title: "Dinâmica de rotação (torque e momento de inércia)",
  sim: "rotacao-torque",
  scenario: "massa",
  params: { corpo: 0, M: 2, R: 0.2, d: 0, modo: 1, r: 0.06, h: 1, tau_a: 0.01, m: 0.05 },
  locked: ["corpo", "M", "R", "L", "b", "d", "modo", "F", "r", "h", "tau_a"],
  objective:
    "Verificar a lei fundamental da rotação $\\tau = I\\alpha$ para um disco que gira em torno do seu eixo, determinando o momento de inércia do disco e o torque de atrito no mancal.",
  materials: [
    "disco de aço (2,00 kg, 20,0 cm de raio) num eixo com rolamento",
    "carretel de 6,00 cm de raio preso ao disco, com fio leve",
    "porta-massas e massas de 10 g a 500 g",
    "balança digital",
    "paquímetro e trena",
    "fotoporta no fim da queda",
  ],
  procedure: `### Procedimento
1. Meça o raio $r$ do carretel com o paquímetro e a altura de queda $h$ com a trena.
2. Pese a massa pendurada $m$, enrole o fio no carretel e solte do repouso. A fotoporta mede o tempo $t$ de queda da altura $h$. Clique em **Registrar medida** quando a massa chegar embaixo.
3. Repita para pelo menos 6 massas entre 50 g e 500 g.
4. Para cada medida, calcule
$$a = \\frac{2h}{t^2} \\qquad \\alpha = \\frac{a}{r} \\qquad \\tau = T r = m(g - a)\\,r$$
O torque $\\tau$ é o que o fio aplica ao disco; note que a tração **não** é o peso $mg$, porque a massa está acelerada.
5. No disco, $\\tau - \\tau_a = I\\alpha$, onde $\\tau_a$ é o torque de atrito no eixo. O gráfico de $\\tau$ contra $\\alpha$ é uma reta: a inclinação é o momento de inércia $I$ e o intercepto é $\\tau_a$.
6. Compare $I$ com $\\tfrac12 M R^2$ do disco.`,
  columns: [
    { key: "m", label: "m", unit: "g", source: { param: "m" }, instrument: { id: "balanca-2kg", name: "Balança digital (2 kg)", unit: "g", kind: "digital", resolution: 0.1, range: [0, 2000], accuracy: (x) => 0.2 + 1e-4 * x }, toUnit: 1000 },
    { key: "r", label: "r", unit: "mm", source: { param: "r" }, instrument: "paquimetro", toUnit: 1000 },
    { key: "h", label: "h", unit: "m", source: { param: "h" }, instrument: "trena" },
    { key: "t", label: "t", unit: "s", source: { time: true }, instrument: "fotoporta" },
    { key: "alpha", label: "α", unit: "rad/s²", from: ["h", "t", "r"], compute: (h, t, r) => (2 * h) / (t * t) / (r / 1000) },
    { key: "tau", label: "τ = m(g − a)r", unit: "N·m", from: ["m", "h", "t", "r"], compute: (m, h, t, r) => (m / 1000) * (G - (2 * h) / (t * t)) * (r / 1000) },
  ],
  minRows: 5,
  analysis: {
    x: "alpha",
    y: "tau",
    fit: "linear",
    xLabel: "α (rad/s²)",
    yLabel: "τ (N·m)",
    results: [
      { label: "I", unit: "kg·m²", compute: (_a, b) => b, reference: 0.5 * 2 * 0.2 ** 2 },
      { label: "τ de atrito", unit: "N·m", compute: (a) => a, reference: 0.01 },
    ],
  },
  demo: (i) => ({ params: { m: 0.05 + 0.09 * i }, t: 1e6 }),
  questions: [
    "O momento de inércia obtido é compatível com $\\tfrac12 MR^2 = 0{,}0400$ kg·m²? E o que significaria um intercepto negativo?",
    "Se você usasse o peso $mg$ no lugar da tração, que erro sistemático cometeria no torque? Para que massas ele é maior?",
    "Qual seria a menor massa pendurada capaz de colocar o disco em movimento?",
    "Como mudaria a reta se o disco fosse trocado por um anel de mesma massa e raio?",
  ],
};
