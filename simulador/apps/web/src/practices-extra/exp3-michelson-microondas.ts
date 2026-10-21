// Interferômetro de Michelson para micro-ondas: posição dos máximos × ordem → λ.
import type { Practice } from "@fisilab/analysis";

const LAM = 2.85;

export const practice: Practice = {
  id: "exp3-michelson-microondas",
  course: "Exp III",
  title: "Interferômetro de Michelson para micro-ondas",
  extra: true,
  sim: "interferometros",
  scenario: "michelson-mo",
  params: { modo: 1, lamMW: LAM, tp: 0, x0: 25 },
  locked: ["modo", "lamMW", "tp", "np"],
  objective:
    "Montar um interferômetro de Michelson para micro-ondas, localizar os máximos de intensidade deslocando um dos refletores e determinar o comprimento de onda da radiação emitida pelo transmissor.",
  materials: [
    "transmissor de micro-ondas (≈ 10,5 GHz) e receptor com medidor",
    "divisor de feixe (placa de vidro ou acrílico)",
    "dois refletores metálicos, um fixo e um móvel sobre régua graduada",
    "goniômetro/banco com escala em centímetros",
  ],
  procedure: `### Procedimento
1. Com os dois braços iguais (refletor móvel a 25,0 cm do divisor), a leitura é máxima: esse é o máximo de ordem $N = 0$.
2. Afaste o refletor móvel devagar, contando os máximos que passam pelo medidor. Pare exatamente sobre um máximo, anote a posição $x$ e a ordem $N$ e clique em **Registrar medida**.
3. Registre pelo menos 6 máximos, de preferência distantes entre si (por exemplo, a cada 3 máximos).
4. Cada máximo novo exige que o caminho de ida e volta aumente de $\\lambda$: $2(x - L_A) = N\\lambda$. O gráfico de $x$ contra $N$ é uma reta de inclinação $\\lambda/2$.`,
  columns: [
    { key: "N", label: "N (ordem contada)", unit: "", source: { observable: "ordem" }, instrument: { id: "contagem", name: "Contagem de máximos", unit: "", kind: "digital", resolution: 1, range: [-100, 100] } },
    { key: "x", label: "x", unit: "cm", source: { observable: "x" }, instrument: { id: "regua-banco", name: "Escala do banco (mm)", unit: "cm", kind: "analogico", resolution: 0.1, range: [0, 100] } },
  ],
  minRows: 5,
  analysis: {
    x: "N",
    y: "x",
    fit: "linear",
    xLabel: "ordem N",
    yLabel: "posição do refletor móvel x (cm)",
    results: [
      { label: "λ", unit: "cm", compute: (_a, b) => 2 * b, reference: LAM },
      { label: "frequência", unit: "GHz", compute: (_a, b) => 29.9792458 / (2 * b), reference: 29.9792458 / LAM },
    ],
  },
  demo: (i) => ({ params: { x0: 25 + ((2 + 3 * i) * LAM) / 2 } }),
  questions: [
    "Por que a distância entre máximos consecutivos é λ/2 e não λ?",
    "As alturas dos máximos diminuem à medida que o refletor se afasta. Por quê? Isso afeta a posição dos máximos?",
    "Com uma placa dielétrica de espessura t no braço móvel, o máximo de ordem N se desloca de (n − 1)t. Proponha como medir o índice da placa.",
    "Compare a precisão obtida contando muitos máximos com a de medir só a distância entre dois máximos vizinhos.",
  ],
};
