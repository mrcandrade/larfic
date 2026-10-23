// Interferômetro de Fabry–Perot para micro-ondas: separação das placas nos máximos × ordem → λ.
import type { Practice } from "@fisilab/analysis";

const LAM = 2.85;

export const practice: Practice = {
  id: "exp3-fabry-perot-microondas",
  course: "Exp III",
  title: "Interferômetro de Fabry–Perot para micro-ondas",
  extra: true,
  sim: "interferometros",
  scenario: "fp-mo",
  params: { modo: 2, lamMW: LAM, rMW: 0.6, x0: 20 },
  locked: ["modo", "lamMW"],
  objective:
    "Medir a transmissão de micro-ondas por duas placas semirrefletoras paralelas em função da separação entre elas, localizar os máximos de transmissão (d = mλ/2) e determinar o comprimento de onda.",
  materials: [
    "transmissor e receptor de micro-ondas",
    "duas placas semirrefletoras (tela metálica ou vidro) em suportes",
    "banco com escala em centímetros",
  ],
  procedure: `### Procedimento
1. Alinhe transmissor, placas e receptor. Afaste a placa móvel até a leitura passar por um máximo.
2. Ajuste a separação $d$ exatamente sobre o máximo, anote $d$ e a ordem $m = 2d/\\lambda$ (conte os máximos desde as placas encostadas, ou a partir de um máximo de referência) e clique em **Registrar medida**.
3. Registre pelo menos 6 máximos.
4. A transmissão é máxima quando a onda que vai e volta entre as placas chega em fase: $2d = m\\lambda$. O gráfico de $d$ contra $m$ é uma reta de inclinação $\\lambda/2$.
5. Compare a largura dos máximos com a dos do Michelson e explique o papel da refletância das placas.`,
  columns: [
    { key: "m", label: "m (ordem)", unit: "", source: { observable: "ordem" }, instrument: { id: "contagem", name: "Contagem de máximos", unit: "", kind: "digital", resolution: 1, range: [0, 100] } },
    { key: "d", label: "d", unit: "cm", source: { observable: "x" }, instrument: { id: "regua-banco", name: "Escala do banco (mm)", unit: "cm", kind: "analogico", resolution: 0.1, range: [0, 100] } },
  ],
  minRows: 5,
  analysis: {
    x: "m",
    y: "d",
    fit: "linear",
    xLabel: "ordem m",
    yLabel: "separação das placas d (cm)",
    results: [{ label: "λ", unit: "cm", compute: (_a, b) => 2 * b, reference: LAM }],
  },
  demo: (i) => ({ params: { x0: ((6 + 4 * i) * LAM) / 2 } }),
  questions: [
    "Por que os máximos do Fabry–Perot ficam mais estreitos quando a refletância das placas aumenta?",
    "O intercepto do ajuste deveria ser zero? O que um intercepto diferente de zero indicaria sobre a escala ou sobre a fase na reflexão?",
    "Qual seria a finesse dessas placas com R = 0,6? Compare com a de um etalon ótico com R = 0,95.",
    "Que vantagem tem medir λ pelo Fabry–Perot em vez do Michelson? E que desvantagem?",
  ],
};
