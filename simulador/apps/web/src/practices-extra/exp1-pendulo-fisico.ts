// Pêndulo físico (barra pendurada pela ponta): T² × L → g e o fator de forma I/(mL²).
import type { Practice } from "@fisilab/analysis";

const G = 9.79;

export const practice: Practice = {
  id: "exp1-pendulo-fisico",
  course: "Exp I",
  title: "Pêndulo físico (barra)",
  sim: "pendulos",
  scenario: "fisico",
  params: { tipo: 1, b: 0, g: G, theta0: 8, m: 1, fantasma: 0 },
  locked: ["tipo", "g", "b", "m", "fantasma"],
  objective:
    "Medir o período de barras uniformes de vários comprimentos oscilando presas por uma das pontas, determinar a aceleração da gravidade e verificar o momento de inércia $I = mL^2/3$ da barra em relação à ponta.",
  materials: ["barras uniformes de comprimentos diferentes, com furo na ponta", "suporte com eixo horizontal (cutelo)", "trena", "cronômetro manual", "transferidor"],
  procedure: `### Procedimento
1. Pendure a barra pelo furo da ponta e meça o comprimento $L$ com a trena.
2. Afaste a barra até no máximo 10° e solte. Com a barra oscilando, clique em **Registrar medida**: a bancada cronometra 10 oscilações três vezes.
3. Repita para pelo menos 6 comprimentos entre 0,3 m e 2,0 m.
4. Para um pêndulo físico de massa $m$, momento de inércia $I$ em relação ao eixo e centro de massa a uma distância $d$ do eixo,
$$T = 2\\pi\\sqrt{\\frac{I}{m g d}}$$
Para a barra presa na ponta, $d = L/2$ e $I = mL^2/3$, logo $T^2 = \\dfrac{8\\pi^2}{3g}\\,L$.
5. O gráfico de $T^2$ contra $L$ é uma reta pela origem. A inclinação $b$ dá $g = 8\\pi^2/(3b)$.
6. Supondo agora $g = 9{,}79$ m/s² conhecido, a mesma inclinação dá o fator de forma $k = I/(mL^2) = bg/(8\\pi^2)$, que deve valer $1/3$.
7. Compare com um pêndulo simples do mesmo comprimento (cenário pequeno ângulo): qual oscila mais rápido? O comprimento equivalente da barra é $2L/3$.`,
  columns: [
    { key: "L", label: "L", unit: "m", source: { param: "L" }, instrument: "trena" },
    { key: "t10", label: "10 T", unit: "s", source: { observable: "T" }, instrument: "cronometroManual", times: 10, repeat: 3 },
    { key: "T2", label: "T²", unit: "s²", from: ["t10"], compute: (t) => (t / 10) ** 2 },
  ],
  minRows: 5,
  analysis: {
    x: "L",
    y: "T2",
    fit: "proporcional",
    xLabel: "L (m)",
    yLabel: "T² (s²)",
    results: [
      { label: "g", unit: "m/s²", compute: (b) => (8 * Math.PI ** 2) / (3 * b), reference: G },
      { label: "k = I/(mL²)", unit: "", compute: (b) => (b * G) / (8 * Math.PI ** 2), reference: 1 / 3 },
    ],
  },
  demo: (i) => ({ params: { L: 0.4 + 0.3 * i } }),
  questions: [
    "O fator de forma $k$ é compatível com 1/3? O que ele diria se a massa estivesse concentrada na ponta da barra?",
    "Qual é o comprimento do pêndulo simples que tem o mesmo período da barra de 1,00 m? Confira no aparato.",
    "Se a barra fosse pendurada a uma distância $d$ do centro, $T = 2\\pi\\sqrt{(L^2/12 + d^2)/(g d)}$. Para que $d$ o período é mínimo?",
    "Quanto muda o período se a amplitude for 30° em vez de 8°? Isso afeta o valor de g obtido?",
  ],
};
