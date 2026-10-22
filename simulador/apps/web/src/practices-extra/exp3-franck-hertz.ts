// Franck–Hertz com mercúrio: posições dos picos × ordem → energia de excitação.
import type { Practice } from "@fisilab/analysis";

export const practice: Practice = {
  id: "exp3-franck-hertz",
  course: "Exp III",
  title: "Experimento de Franck–Hertz (mercúrio)",
  extra: true,
  sim: "franck-hertz",
  scenario: "mercurio",
  params: { gas: 0, modo: 1, taxa: 4, T: 180, Ur: 1.5, Uc: 2, ordem: 1 },
  locked: ["gas", "Uc"],
  objective:
    "Verificar a quantização da energia dos átomos de mercúrio medindo a tensão dos máximos sucessivos da corrente no ânodo de um tubo de Franck–Hertz e determinar a energia do primeiro nível excitado.",
  materials: [
    "tubo de Franck–Hertz com mercúrio",
    "forno com termômetro (180 °C)",
    "fonte de tensão de aceleração (0–30 V) e fonte de contrapotencial",
    "amplificador de corrente (nA)",
    "voltímetro digital",
  ],
  procedure: `### Procedimento
1. Aqueça o forno a 180 °C e ajuste o contrapotencial em $U_r = 1{,}5$ V.
2. Faça a varredura de $U$ de 0 a 30 V e observe a curva $I \\times U$.
3. Para cada máximo de ordem $k = 1, 2, 3, \\dots$, posicione o cursor sobre o pico e leia a tensão $U_k$ no voltímetro.
4. Os máximos obedecem a $U_k = U_0 + k\\,\\Delta U$, em que $U_0$ inclui o potencial de contato. O gráfico de $U_k$ contra $k$ é uma reta de inclinação $\\Delta U = \\Delta E/e$.
5. Calcule também o comprimento de onda $\\lambda = hc/\\Delta E$ da luz emitida.`,
  columns: [
    { key: "k", label: "k", unit: "", source: { param: "ordem" }, instrument: { id: "contagem", name: "Contagem de picos", unit: "", kind: "digital", resolution: 1, range: [0, 10] } },
    { key: "U", label: "U_k", unit: "V", source: { observable: "Upico" }, instrument: { id: "volt-40", name: "Voltímetro (40 V)", unit: "V", kind: "digital", resolution: 0.1, range: [0, 40], accuracy: (r) => 0.1 + 0.005 * r } },
  ],
  minRows: 4,
  analysis: {
    x: "k",
    y: "U",
    fit: "linear",
    xLabel: "ordem do máximo k",
    yLabel: "U_k (V)",
    results: [
      { label: "ΔE", unit: "eV", compute: (_a, b) => b, reference: 4.89 },
      { label: "λ", unit: "nm", compute: (_a, b) => 1239.84 / b, reference: 253.7 },
    ],
  },
  demo: (i) => ({ params: { ordem: 1 + (i % 5) }, t: 0.1 }),
  questions: [
    "O valor de ΔE é compatível com 4,89 eV? A que transição do mercúrio corresponde?",
    "Por que o primeiro máximo não aparece em 4,9 V? O que representa o intercepto da reta?",
    "Como a temperatura do forno altera a nitidez dos mínimos e a corrente total? Explique pelo livre caminho médio.",
    "A luz emitida tem λ ≈ 254 nm. Por que não se vê nada a olho nu no tubo de mercúrio, ao contrário do tubo de neônio?",
  ],
};
