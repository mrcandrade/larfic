// Difração por fenda simples: posição do 1º mínimo × comprimento de onda → largura da fenda.
import type { Practice } from "@fisilab/analysis";

const D = 1; // distância fenda–anteparo (m)

export const practice: Practice = {
  id: "exp3-fenda-simples",
  course: "Exp III",
  title: "Difração por fenda simples",
  sim: "difracao",
  scenario: "fenda",
  params: { modo: 0, fonte: 0, a: 40, lambda: 633 },
  locked: ["modo", "fonte", "a"],
  objective:
    "Medir a posição dos primeiros mínimos de difração de uma fenda simples iluminada por luz de vários comprimentos de onda e determinar a largura da fenda.",
  materials: [
    "fenda simples ajustável (fixada durante a prática)",
    "lasers e fonte com filtros de interferência de 420 nm a 670 nm",
    "anteparo a 1,000 m da fenda",
    "paquímetro",
  ],
  procedure: `### Procedimento
1. Ilumine a fenda e observe no anteparo a franja central larga, ladeada por franjas mais fracas.
2. Meça com o paquímetro a distância $2y_1$ entre os dois **primeiros mínimos** (um de cada lado da franja central): medir a distância entre os dois reduz o erro de achar o centro. Clique em **Registrar medida**.
3. Troque o comprimento de onda e repita para pelo menos 6 valores entre 420 nm e 670 nm.
4. Os mínimos de uma fenda de largura $a$ ficam em $a\\sin\\theta_m = m\\lambda$. Para ângulos pequenos, $\\theta_1 \\approx y_1/D = \\lambda/a$.
5. O gráfico de $\\theta_1$ contra $\\lambda$ é uma reta pela origem de inclinação $1/a$.
6. Use o detector do aparato para localizar também o 2º e o 3º mínimos e confira que estão em $2\\lambda/a$ e $3\\lambda/a$.`,
  columns: [
    { key: "lam", label: "λ", unit: "nm", source: { param: "lambda" }, instrument: { id: "filtro-interferencia", name: "Filtro de interferência (±1 nm)", unit: "nm", kind: "digital", resolution: 1, range: [300, 800], accuracy: () => 1 } },
    { key: "y2", label: "2y₁", unit: "mm", source: { observable: "th1" }, instrument: "paquimetro", toUnit: D, times: 2 },
    { key: "th", label: "θ₁ = y₁/D", unit: "mrad", from: ["y2"], compute: (y2) => y2 / 2 / D },
  ],
  minRows: 5,
  analysis: {
    x: "lam",
    y: "th",
    fit: "proporcional",
    xLabel: "λ (nm)",
    yLabel: "θ₁ (mrad)",
    results: [{ label: "a", unit: "µm", compute: (b) => 1 / b, reference: 40 }],
  },
  demo: (i) => ({ params: { lambda: 420 + 50 * i } }),
  questions: [
    "A largura obtida é compatível com 40 µm? Qual seria uma forma independente de medir $a$?",
    "Por que a franja central tem o dobro da largura das laterais?",
    "O que acontece com a figura quando a fenda é estreitada? E no limite em que $a$ é menor que $\\lambda$?",
    "Por que se pode usar $\\sin\\theta \\approx \\theta \\approx y/D$ aqui? Estime o erro dessa aproximação para o maior ângulo medido.",
  ],
};
