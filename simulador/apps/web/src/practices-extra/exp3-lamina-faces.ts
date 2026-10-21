// Lâmina de faces paralelas: deslocamento lateral do feixe × ângulo de incidência → índice de refração.
import type { Practice } from "@fisilab/analysis";

const rad = (d: number) => (d * Math.PI) / 180;
const N = 1.52;
const E = 30;

/** sen θ₂ a partir do deslocamento lateral: tan θ₂ = (sen θ₁ − d/e)/cos θ₁. */
const sinTheta2 = (t1: number, d: number, e: number) => Math.sin(Math.atan((Math.sin(rad(t1)) - d / e) / Math.cos(rad(t1))));

export const practice: Practice = {
  id: "exp3-lamina-faces",
  course: "Exp III",
  title: "Lâmina de faces paralelas: deslocamento lateral e índice de refração",
  extra: true,
  sim: "principio-fermat",
  scenario: "lamina",
  params: { modo: 3, e: E, nl: N, theta1: 0 },
  locked: ["modo", "e", "nl"],
  objective:
    "Medir o deslocamento lateral de um feixe de laser que atravessa uma lâmina de vidro de faces paralelas em função do ângulo de incidência e, pela lei de Snell, determinar o índice de refração do vidro.",
  materials: [
    "laser de diodo",
    "lâmina de vidro de faces paralelas sobre mesa giratória graduada",
    "paquímetro (espessura da lâmina)",
    "anteparo com escala milimetrada",
  ],
  procedure: `### Procedimento
1. Meça a espessura $e$ da lâmina com o paquímetro.
2. Com a lâmina perpendicular ao feixe ($\\theta_1 = 0$), marque no anteparo a posição do ponto: é o zero.
3. Gire a lâmina até $\\theta_1$ (leia na mesa graduada) e leia no anteparo a posição do ponto: é o deslocamento $d$. Clique em **Registrar medida**.
4. Repita para pelo menos 6 ângulos entre 10° e 70°.
5. Da geometria, $d = e\\,\\text{sen}(\\theta_1-\\theta_2)/\\cos\\theta_2$, o que dá $\\tan\\theta_2 = (\\text{sen}\\,\\theta_1 - d/e)/\\cos\\theta_1$.
6. Pela lei de Snell, $\\text{sen}\\,\\theta_1 = n\\,\\text{sen}\\,\\theta_2$: o gráfico de $\\text{sen}\\,\\theta_1$ contra $\\text{sen}\\,\\theta_2$ é uma reta pela origem de inclinação $n$.`,
  columns: [
    { key: "e", label: "e", unit: "mm", source: { param: "e" }, instrument: "paquimetro" },
    { key: "t1", label: "θ₁", unit: "°", source: { observable: "th1" }, instrument: { id: "mesa-graduada", name: "Mesa giratória graduada (0,5°)", unit: "°", kind: "analogico", resolution: 0.5, range: [-90, 90] } },
    { key: "d", label: "d", unit: "mm", source: { observable: "yTela" }, instrument: { id: "anteparo-mm", name: "Anteparo com escala milimetrada", unit: "mm", kind: "analogico", resolution: 0.5, range: [-60, 60] } },
    { key: "s1", label: "sen θ₁", unit: "", from: ["t1"], compute: (t1) => Math.sin(rad(t1)) },
    { key: "s2", label: "sen θ₂", unit: "", from: ["t1", "d", "e"], compute: sinTheta2 },
  ],
  minRows: 5,
  analysis: {
    x: "s2",
    y: "s1",
    fit: "proporcional",
    xLabel: "sen θ₂ (calculado de d)",
    yLabel: "sen θ₁",
    results: [{ label: "n do vidro", unit: "", compute: (b) => b, reference: N }],
  },
  demo: (i) => ({ params: { theta1: 15 + 10 * i } }),
  questions: [
    "Por que o feixe que sai da lâmina é paralelo ao que entra? Isso depende do índice?",
    "Em que faixa de ângulos a medida de d tem menor incerteza relativa? E a de n?",
    "Para ângulos pequenos, mostre que d ≈ e θ₁ (1 − 1/n). Que n você obteria usando só essa aproximação nas suas medidas?",
    "Como o princípio de Fermat explica que o raio dentro da lâmina se inclina na direção da normal?",
  ],
};
