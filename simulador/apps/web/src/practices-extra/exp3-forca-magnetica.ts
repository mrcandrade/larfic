// Balança de corrente: força magnética num fio × corrente → campo B.
import type { Practice } from "@fisilab/analysis";

const LF = Math.hypot(0.3, 0.12); // comprimento do fio dentro do campo (m)
const G = 9.81;

export const practice: Practice = {
  id: "exp3-forca-magnetica",
  course: "Exp III",
  title: "Força magnética sobre um condutor (balança de corrente)",
  sim: "motor-hall",
  scenario: "fio",
  params: { modo: 1, B: 0.05, Bdir: 0, forma: 0, Ifio: 1 },
  locked: ["modo", "B", "Bdir"],
  objective:
    "Verificar que a força magnética sobre um fio retilíneo é proporcional à corrente, $F = ILB$, e determinar a intensidade do campo magnético entre os polos de um ímã.",
  materials: [
    "ímã permanente com campo uniforme na região do fio",
    "fio rígido de 32,3 cm apoiado sobre a balança (o ímã fica no prato)",
    "fonte de corrente de 0 a 10 A com amperímetro",
    "balança digital (0,01 g)",
    "trena",
  ],
  procedure: `### Procedimento
1. Meça com a trena o comprimento $L$ do fio que fica dentro do campo ($L = 32{,}3$ cm).
2. Com a corrente desligada, zere (tare) a balança com o ímã no prato.
3. Ajuste a corrente $I$ no fio. Pela terceira lei de Newton, a força que o campo faz no fio aparece como uma variação $\\Delta m$ na leitura da balança: $F = \\Delta m\\, g$. Clique em **Registrar medida**.
4. Repita para pelo menos 6 correntes entre 1 A e 9 A.
5. Como $F = ILB$ para o fio perpendicular ao campo, o gráfico de $F$ contra $I$ é uma reta pela origem de inclinação $LB$.
6. Inverta o sentido da corrente: o que acontece com a leitura? Troque o fio reto pelo **semicírculo** com as mesmas pontas e compare a força.`,
  columns: [
    { key: "I", label: "I", unit: "A", source: { param: "Ifio" }, instrument: { id: "amperimetro-10a", name: "Amperímetro (10 A)", unit: "A", kind: "digital", resolution: 0.01, range: [-10, 10], accuracy: (x) => 0.01 * Math.abs(x) + 0.02 } },
    { key: "dm", label: "Δm", unit: "g", source: { observable: "F" }, instrument: "balanca", toUnit: 1000 / G },
    { key: "F", label: "F = Δm g", unit: "mN", from: ["dm"], compute: (dm) => dm * G },
  ],
  minRows: 5,
  analysis: {
    x: "I",
    y: "F",
    fit: "proporcional",
    xLabel: "I (A)",
    yLabel: "F (mN)",
    results: [{ label: "B", unit: "mT", compute: (b) => b / LF, reference: 50 }],
  },
  demo: (i) => ({ params: { Ifio: 1 + 1.6 * i } }),
  questions: [
    "O campo obtido é compatível com o valor nominal do ímã (50 mT)? Qual grandeza domina a incerteza de B?",
    "Por que o fio em semicírculo, com as mesmas pontas, sofre a mesma força que o fio reto?",
    "Se o campo fizesse um ângulo de 30° com o fio, que inclinação você esperaria no gráfico?",
    "Estime a força sobre um fio de 1 m com 10 A no campo magnético da Terra (cerca de 25 µT em Porto Alegre). Por que não a percebemos no dia a dia?",
  ],
};
