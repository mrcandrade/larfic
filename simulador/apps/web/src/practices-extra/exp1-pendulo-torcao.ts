// Pêndulo de torção: T² × d² (massas a ±d, teorema de Steiner) → constante de torção κ e módulo de cisalhamento G do fio.
import type { Practice } from "@fisilab/analysis";

const M = 0.2; // massa de cada corpo preso na barra (kg)
const R = 0.5e-3; // raio do fio (m): diâmetro 1,00 mm
const ELL = 0.6; // comprimento do fio (m)
const G_ACO = 79e9; // módulo de cisalhamento de referência do aço (Pa)
const KAPPA = (Math.PI * G_ACO * R ** 4) / (2 * ELL);
const I0 = (0.1 * 0.4 ** 2) / 12; // barra de 0,1 kg e 0,40 m

export const practice: Practice = {
  id: "exp1-pendulo-torcao",
  course: "Exp I",
  title: "Pêndulo de torção",
  extra: true,
  sim: "pendulos-especiais",
  scenario: "torcao",
  params: { modo: 2, corpo: 0, m: M, dfio: 1, lfio: ELL, material: 0, theta0: 30 },
  locked: ["modo", "corpo", "m", "dfio", "lfio", "material"],
  objective:
    "Medir o período de um pêndulo de torção em função da posição de duas massas iguais presas na barra, verificar o teorema dos eixos paralelos ($I = I_0 + 2md^2$) e determinar a constante de torção $\\kappa$ e o módulo de cisalhamento $G$ do fio de aço.",
  materials: [
    "fio de aço de 1,00 mm de diâmetro e 0,600 m de comprimento, preso a um suporte rígido",
    "barra leve (0,1 kg, 0,40 m) presa ao fio pelo centro, com duas massas de 200 g deslizantes",
    "régua milimetrada",
    "micrômetro (para conferir o diâmetro do fio)",
    "cronômetro manual",
    "escala angular sob a barra",
  ],
  procedure: `### Procedimento
1. Prenda as duas massas de 200 g simetricamente, a uma distância $d$ do fio, e meça $d$ com a régua (do eixo ao centro de cada massa).
2. Gire a barra uns 30° na horizontal e solte. Com a barra oscilando, clique em **Registrar medida**: a bancada cronometra 10 oscilações três vezes.
3. Repita para pelo menos 6 posições, com $d$ entre 0,05 m e 0,18 m.
4. O fio exerce um torque restaurador $\\tau = -\\kappa\\varphi$, então $T = 2\\pi\\sqrt{I/\\kappa}$. Pelo teorema de Steiner, $I = I_0 + 2md^2$ ($I_0$ = barra + massas em torno dos próprios centros), logo
$$T^2 = \\frac{4\\pi^2 I_0}{\\kappa} + \\frac{8\\pi^2 m}{\\kappa}\\,d^2$$
5. Faça o gráfico de $T^2$ contra $d^2$: é uma reta. Da inclinação $b$ obtenha $\\kappa = 8\\pi^2 m/b$; do coeficiente linear $a$, $I_0 = a\\kappa/(4\\pi^2)$.
6. Para um fio de raio $r$ e comprimento $\\ell$, $\\kappa = \\pi G r^4/(2\\ell)$. Calcule $G$ e compare com o valor tabelado do aço (79 GPa).
7. Confira que o período **não** depende da amplitude: repita uma medida com 10° e com 60°.`,
  columns: [
    { key: "d", label: "d", unit: "mm", source: { param: "d" }, instrument: "regua", toUnit: 1000 },
    { key: "t10", label: "10 T", unit: "s", source: { observable: "Tteo" }, instrument: "cronometroManual", times: 10, repeat: 3 },
    { key: "d2", label: "d²", unit: "m²", from: ["d"], compute: (d) => (d / 1000) ** 2 },
    { key: "T2", label: "T²", unit: "s²", from: ["t10"], compute: (t) => (t / 10) ** 2 },
  ],
  minRows: 5,
  analysis: {
    x: "d2",
    y: "T2",
    fit: "linear",
    xLabel: "d² (m²)",
    yLabel: "T² (s²)",
    results: [
      { label: "κ", unit: "N·m/rad", compute: (_a, b) => (8 * Math.PI ** 2 * M) / b, reference: KAPPA },
      { label: "G do fio", unit: "GPa", compute: (_a, b) => ((2 * ELL * (8 * Math.PI ** 2 * M)) / b / (Math.PI * R ** 4)) / 1e9, reference: G_ACO / 1e9 },
      { label: "I₀", unit: "kg·m²", compute: (a, b) => (a * ((8 * Math.PI ** 2 * M) / b)) / (4 * Math.PI ** 2), reference: I0 },
    ],
  },
  demo: (i) => ({ params: { d: 0.05 + 0.025 * i } }),
  questions: [
    "O valor de G é compatível com 79 GPa? Sabendo que $G \\propto 1/r^4$, qual incerteza relativa no diâmetro do fio produziria sozinha toda a diferença encontrada?",
    "Por que o gráfico de $T^2$ contra $d^2$ não passa pela origem? O que representa fisicamente o coeficiente linear?",
    "Se o fio de aço fosse trocado por um de latão ($G = 37$ GPa) com as mesmas dimensões, por qual fator o período mudaria?",
    "Por que o período do pêndulo de torção não depende da amplitude, ao contrário do pêndulo simples em grandes ângulos?",
    "O pêndulo de torção é a base da balança de Cavendish. Por que se usa ali um fio muito fino e longo?",
  ],
};
