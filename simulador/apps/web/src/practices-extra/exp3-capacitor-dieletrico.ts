// Capacitor de placas paralelas com dielétrico parcialmente inserido: C × inserção → κ.
import { dmmAccuracy, type Practice } from "@fisilab/analysis";

const LP = 10; // lado das placas (cm)
const D = 1; // separação entre as placas (cm)
const EPS0 = 8.8541878128e-12;
/** Inclinação ideal ε₀L/d em pF por cm de inserção, por unidade de (κ − 1). */
const S1 = (EPS0 * (LP / 100)) / (D / 100) * 1e12 / 100;

export const practice: Practice = {
  id: "exp3-capacitor-dieletrico",
  course: "Exp III",
  title: "Capacitor de placas paralelas e dielétrico",
  sim: "capacitores",
  scenario: "v-constante",
  params: { modo: 0, bateria: 0, Lp: LP, d: D, kappa: 3, V: 200, ins: 0.1 },
  locked: ["modo", "bateria", "Lp", "d", "kappa"],
  objective:
    "Medir a capacitância de um capacitor de placas paralelas com uma placa de acrílico inserida parcialmente, verificar que ela cresce linearmente com a inserção e determinar a constante dielétrica do acrílico. Como etapa complementar, estimar $\\varepsilon_0$ pela dependência com a separação.",
  materials: [
    "capacitor de placas quadradas de 10,0 cm de lado, separadas por 1,00 cm",
    "placa de acrílico de 10,0 cm × 10,0 cm × 1,00 cm",
    "régua milimetrada",
    "paquímetro",
    "capacímetro digital (200 pF)",
  ],
  procedure: `### Parte A: capacitância × inserção do dielétrico
1. Com a separação $d = 1{,}00$ cm, empurre a placa de acrílico para dentro do capacitor (arraste-a no palco ou ajuste a inserção inicial) e meça com a régua o comprimento inserido $x$.
2. Leia a capacitância no capacímetro e clique em **Registrar medida**.
3. Repita para pelo menos 6 inserções entre 1 cm e 9 cm. Evite as pontas: com a placa quase fora ou quase toda dentro, o campo de borda distorce a relação linear.
4. A parte com dielétrico e a parte com ar são dois capacitores em paralelo:
$$C(x) = \\frac{\\varepsilon_0 L}{d}\\left[L + (\\kappa - 1)\\,x\\right] + C_b$$
onde $C_b$ é a contribuição do campo de borda, que quase não depende de $x$ no meio do curso.
5. O gráfico de $C$ contra $x$ é uma reta de inclinação $b = \\varepsilon_0 L(\\kappa - 1)/d$. Com $\\varepsilon_0 = 8{,}854\\times10^{-12}$ F/m, obtenha $\\kappa = 1 + bd/(\\varepsilon_0 L)$. A inclinação não é afetada por $C_b$, por isso o método é melhor que a simples razão $C_\\kappa/C_0$.

### Parte B: capacitância × separação (complementar)
1. Retire o dielétrico, varie $d$ entre 1,0 cm e 3,0 cm (paquímetro) e registre $C$ numa tabela à parte.
2. O gráfico de $C$ contra $1/d$ é uma reta de inclinação $\\varepsilon_0 L^2$ e intercepto $C_b$. Compare o $\\varepsilon_0$ obtido com o valor tabelado.`,
  columns: [
    { key: "x", label: "x", unit: "mm", source: { observable: "x" }, instrument: "regua", toUnit: 10 },
    { key: "C", label: "C", unit: "pF", source: { observable: "Cb" }, instrument: { id: "capacimetro", name: "Capacímetro digital (200 pF)", unit: "pF", kind: "digital", resolution: 0.01, range: [0, 200], accuracy: dmmAccuracy(0.5, 3, 0.01) } },
    { key: "xcm", label: "x", unit: "cm", from: ["x"], compute: (x) => x / 10 },
  ],
  minRows: 5,
  analysis: {
    x: "xcm",
    y: "C",
    fit: "linear",
    xLabel: "x (cm)",
    yLabel: "C (pF)",
    results: [
      { label: "κ do acrílico", unit: "", compute: (_a, b) => 1 + b / S1, reference: 3 },
      { label: "C extrapolada a x = 0", unit: "pF", compute: (a) => a },
    ],
  },
  demo: (i) => ({ params: { ins: 0.1 + 0.16 * i } }),
  questions: [
    "O valor de $\\kappa$ é compatível com o do acrílico usado (3,0)? Qual grandeza domina a incerteza: $x$, $C$ ou $d$?",
    "Compare o intercepto $C(x = 0)$ do ajuste com $\\varepsilon_0 L^2/d$. A diferença é o efeito de borda: por que ele não altera a inclinação?",
    "Por que os pontos com a placa quase toda dentro ou quase toda fora se afastam da reta?",
    "Com a bateria ligada, o dielétrico é puxado para dentro do capacitor. De onde vem a energia para esse trabalho? E com a bateria desligada?",
  ],
};
