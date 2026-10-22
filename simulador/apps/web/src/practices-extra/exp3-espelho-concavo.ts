// Espelho côncavo: conjugação objeto–imagem, 1/p' × 1/p → distância focal.
import type { Practice } from "@fisilab/analysis";

const banco = { id: "trena-banco", name: "Escala do banco ótico", unit: "cm", kind: "analogico" as const, resolution: 0.1, range: [0, 200] as [number, number] };

export const practice: Practice = {
  id: "exp3-espelho-concavo",
  course: "Exp III",
  title: "Espelho esférico côncavo",
  sim: "espelhos",
  scenario: "concavo",
  params: { modo: 1, R: 0.8, h0: 0.1, tracado: 0, p0: 0.6 },
  locked: ["modo", "R"],
  objective:
    "Determinar a distância focal e o raio de curvatura de um espelho esférico côncavo pela equação dos pontos conjugados, usando imagens reais projetadas num anteparo.",
  materials: ["banco ótico com escala", "espelho côncavo montado em suporte", "objeto luminoso (seta iluminada)", "anteparo pequeno, que não bloqueie o feixe"],
  procedure: `### Procedimento
1. Posicione o objeto a uma distância $p$ do vértice do espelho, além do centro de curvatura ou entre o centro e o foco.
2. Desloque o anteparo até a imagem ficar nítida e meça a distância $p'$ da imagem ao vértice. Clique em **Registrar medida**.
3. Repita para pelo menos 6 posições do objeto entre 55 cm e 140 cm.
4. Pela equação dos espelhos esféricos (aproximação paraxial),
$$\\frac1p + \\frac1{p'} = \\frac1f$$
o gráfico de $1/p'$ contra $1/p$ é uma reta de inclinação $-1$ e intercepto $1/f$. O raio de curvatura é $R = 2f$.
5. Confira o aumento: $m = -p'/p$. Onde a imagem tem o mesmo tamanho do objeto?
6. Por fim, aproxime o objeto para dentro da distância focal: a imagem ainda pode ser projetada?`,
  columns: [
    { key: "p", label: "p", unit: "cm", source: { observable: "p" }, instrument: banco, toUnit: 100 },
    { key: "q", label: "p′", unit: "cm", source: { observable: "pi" }, instrument: banco, toUnit: 100 },
    { key: "ip", label: "1/p", unit: "1/m", from: ["p"], compute: (p) => 100 / p },
    { key: "iq", label: "1/p′", unit: "1/m", from: ["q"], compute: (q) => 100 / q },
  ],
  minRows: 5,
  analysis: {
    x: "ip",
    y: "iq",
    fit: "linear",
    xLabel: "1/p (1/m)",
    yLabel: "1/p′ (1/m)",
    results: [
      { label: "f", unit: "cm", compute: (a) => 100 / a, reference: 40 },
      { label: "R = 2f", unit: "cm", compute: (a) => 200 / a, reference: 80 },
      { label: "inclinação", unit: "", compute: (_a, b) => b, reference: -1 },
    ],
  },
  demo: (i) => ({ params: { p0: 0.55 + 0.17 * i } }),
  questions: [
    "A inclinação é compatível com −1? Para que posição do objeto a imagem tem o mesmo tamanho dele?",
    "Por que não foi possível projetar a imagem com o objeto entre o foco e o espelho? Que tipo de imagem se forma?",
    "Com um espelho de grande abertura, os raios marginais não convergem no foco paraxial (aberração esférica). Como isso afetaria sua medida de $p'$?",
    "Cite dois usos de espelhos côncavos e diga em que região o objeto fica em cada um.",
  ],
};
