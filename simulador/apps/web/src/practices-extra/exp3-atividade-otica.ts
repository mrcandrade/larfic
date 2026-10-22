// Sacarímetro: rotação do plano de polarização × concentração → rotação específica da sacarose.
import type { Practice } from "@fisilab/analysis";
import { rotation, specificRotation } from "@fisilab/sim-atividade-otica";

const L = 2; // tubo de 2 dm
const NM = 589;

export const practice: Practice = {
  id: "exp3-atividade-otica",
  course: "Exp III",
  title: "Sacarímetro: rotação específica da sacarose",
  extra: true,
  sim: "atividade-otica",
  scenario: "sacarimetro",
  params: { modo: 0, sol: 1, L, lambda: NM, campo: 0, c: 10, amb: 5 },
  locked: ["modo", "sol", "L", "lambda"],
  objective:
    "Medir com um polarímetro de bancada a rotação do plano de polarização produzida por soluções de sacarose de várias concentrações, verificar que ela é proporcional à concentração e determinar a rotação específica [α] da sacarose na linha D do sódio.",
  materials: [
    "polarímetro com lâmpada de sódio (589 nm), polarizador fixo e analisador com disco graduado (nônio de 0,1°)",
    "tubo de polarímetro de 2,00 dm",
    "soluções de sacarose preparadas em balão volumétrico (2 a 30 g/100 mL)",
    "água destilada (branco)",
    "fotodiodo com multímetro (ou observação direta pela ocular)",
  ],
  procedure: `### Procedimento
1. Encha o tubo com **água destilada** e gire o analisador até a leitura mínima: deve estar em $\\theta_0 = 90{,}0^\\circ$. Esse é o zero do aparelho.
2. Encha o tubo com a primeira solução de sacarose (concentração $c$ anotada no balão). Gire o analisador até a extinção e anote $\\theta_{\\min}$. Para achar o mínimo com precisão, leia ângulos simétricos dos dois lados do vale e tire a média, ou use o **campo de penumbra**.
3. A rotação é $\\alpha = \\theta_{\\min} - \\theta_0$. Clique em **Registrar medida**.
4. Repita para pelo menos 6 concentrações, enxaguando o tubo entre as soluções.
5. Como $\\alpha = [\\alpha]\\,L\\,c$ (com $c$ em g/mL), o gráfico de $\\alpha$ contra $c$ é uma reta pela origem de inclinação $[\\alpha]L/100$ (c em g/100 mL).`,
  columns: [
    { key: "c", label: "c", unit: "g/100 mL", source: { param: "c" }, instrument: { id: "balao", name: "Solução preparada (balão volumétrico)", unit: "g/100 mL", kind: "digital", resolution: 0.1, range: [0, 50], accuracy: (r) => 0.002 * r } },
    { key: "th", label: "θ_min", unit: "°", source: { observable: "theta" }, instrument: { id: "polarimetro", name: "Disco do analisador (nônio 0,1°)", unit: "°", kind: "nonio", resolution: 0.1, range: [0, 360] } },
    { key: "a", label: "α = θ_min − 90°", unit: "°", from: ["th"], compute: (th) => th - 90 },
  ],
  minRows: 5,
  analysis: {
    x: "c",
    y: "a",
    fit: "proporcional",
    xLabel: "c (g/100 mL)",
    yLabel: "α (°)",
    results: [{ label: "[α] da sacarose (589 nm)", unit: "° mL g⁻¹ dm⁻¹", compute: (b) => (100 * b) / L, reference: specificRotation(1, NM) }],
  },
  demo: (i) => {
    const c = 4 + 5 * i;
    return { params: { c, theta: Math.round((90 + rotation(1, NM, L, c)) * 10) / 10 } };
  },
  questions: [
    "A reta passa pela origem dentro das incertezas? O que indicaria um intercepto diferente de zero?",
    "Uma única medida não distingue α de α ± 180°. Como o uso de tubos de comprimentos diferentes resolve essa ambiguidade?",
    "Com o [α] obtido, determine a concentração de uma solução desconhecida que dá α = +12,4° no mesmo tubo.",
    "Por que o mínimo é mais fácil de localizar com o campo de penumbra do que procurando o escuro total?",
  ],
};
