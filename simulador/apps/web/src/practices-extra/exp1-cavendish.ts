// Balança de Cavendish: deslocamento de equilíbrio do laser × massa grande → G.
import type { Practice } from "@fisilab/analysis";

const D = 0.05; // meia-largura do braço das esferas pequenas (m)
const B = 0.0465; // distância entre centros esfera grande–pequena (m)
const L = 5; // distância do espelho à escala (m)
/** Fração do torque perdida pela atração da esfera grande do outro lado. */
const BETA = B ** 3 / (B * B + 4 * D * D) ** 1.5;

export const practice: Practice = {
  id: "exp1-cavendish",
  course: "Exp I",
  title: "Balança de torção de Cavendish: medida de G",
  extra: true,
  sim: "cavendish",
  scenario: "cavendish",
  params: { modo: 0, b: 46.5, kappa: 8, L, tdec: 900, ritmo: 200 },
  locked: ["modo", "b", "kappa", "L", "tdec"],
  objective:
    "Determinar a constante da gravitação universal G com uma balança de torção, a partir do deslocamento do ponto de equilíbrio do laser para várias massas das esferas grandes e do período de oscilação do braço.",
  materials: [
    "balança de torção (esferas pequenas de 15 g, braço de 2d = 100 mm, fio de tungstênio)",
    "jogo de esferas grandes de chumbo de massas diferentes",
    "balança digital (5 kg, resolução 0,1 g)",
    "laser e espelho preso ao fio; escala milimetrada a L = 5,00 m do espelho",
    "cronômetro",
  ],
  procedure: `### Procedimento
1. Com as esferas grandes em posição neutra, o laser marca o zero da escala ($S = 0$). Pese um par de esferas grandes de massa $M$ e coloque-as na **posição I** (a $b = 46{,}5$ mm das esferas pequenas).
2. O braço passa a oscilar lentamente em torno de um novo equilíbrio (o relógio da simulação está acelerado). Espere a oscilação morrer e leia a posição de equilíbrio $S$ do laser na escala.
3. Cronometre o período $T$ da oscilação (meça entre extremos sucessivos do laser enquanto ela ainda é visível).
4. Repita para pelo menos 6 massas $M$ entre 0,7 kg e 2,8 kg.
5. Para ângulos pequenos, $S \\approx 2L\\theta$ e $\\kappa\\theta = 2d\\,GMm/b^2$; com $\\kappa = 4\\pi^2 I/T^2$ e $I = 2md^2$:
$$\\frac{2\\pi^2 d\\, b^2\\, S}{L\\,T^2} = G\\,M$$
O gráfico dessa grandeza contra $M$ é uma reta pela origem de inclinação $G$.
6. A esfera grande do outro lado do braço puxa cada esfera pequena no sentido contrário e reduz o torque pelo fator $1 - \\beta$, com $\\beta = b^3/(b^2 + 4d^2)^{3/2} \\approx ${BETA.toFixed(3).replace(".", "{,}")}$. Corrija o resultado dividindo por $1 - \\beta$.`,
  columns: [
    {
      key: "M",
      label: "M",
      unit: "g",
      source: { param: "M" },
      instrument: { id: "balanca-5kg", name: "Balança digital (5 kg)", unit: "g", kind: "digital", resolution: 0.1, range: [0, 5000], accuracy: (r) => 0.2 + 1e-4 * r },
      toUnit: 1000,
    },
    {
      key: "S",
      label: "S (equilíbrio)",
      unit: "mm",
      source: { observable: "S" },
      instrument: { id: "escala-60cm", name: "Escala milimetrada (60 cm)", unit: "mm", kind: "analogico", resolution: 1, range: [0, 600] },
      toUnit: 10,
    },
    { key: "T", label: "T", unit: "s", source: { observable: "T" }, instrument: "cronometroManual" },
    { key: "Mkg", label: "M", unit: "kg", from: ["M"], compute: (m) => m / 1000 },
    {
      key: "GM",
      label: "2π²d b² S/(L T²)",
      unit: "N·m²/kg",
      from: ["S", "T"],
      compute: (S, T) => (2 * Math.PI ** 2 * D * B * B * (S / 1000)) / (L * T * T),
    },
  ],
  minRows: 5,
  analysis: {
    x: "Mkg",
    y: "GM",
    fit: "proporcional",
    xLabel: "M (kg)",
    yLabel: "2π²d b² S/(L T²) (N·m²/kg)",
    results: [
      { label: "G (sem correção)", unit: "N·m²/kg²", compute: (k) => k },
      { label: "G corrigido = G/(1 − β)", unit: "N·m²/kg²", compute: (k) => k / (1 - BETA), reference: 6.674e-11 },
    ],
  },
  demo: (i) => ({ params: { M: 0.75 + 0.4 * i }, t: 60 }),
  questions: [
    "O valor corrigido de G é compatível com 6,674 × 10⁻¹¹ N·m²/kg²? Qual medida domina a incerteza: S, T, b ou L?",
    "Por que o valor sem correção sai sistematicamente baixo? Calcule β para a geometria usada e diga se a correção é maior ou menor que a sua incerteza.",
    "No procedimento clássico se troca as esferas da posição I para a II e se mede ΔS = S_I − S_II. Que vantagem isso tem sobre medir a partir do zero da posição neutra?",
    "Estime a força entre uma esfera grande de 1,5 kg e uma pequena de 15 g a 46,5 mm. Compare com o peso de um grão de areia (≈ 1 mg) e comente por que o experimento é tão sensível a correntes de ar e vibrações.",
  ],
};
