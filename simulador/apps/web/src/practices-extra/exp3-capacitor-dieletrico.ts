// Capacitor de placas paralelas: C × 1/d → ε₀ (com o efeito de borda) e κ do dielétrico.
import { dmmAccuracy, type Practice } from "@fisilab/analysis";

const LP = 0.1; // lado das placas (m)

export const practice: Practice = {
  id: "exp3-capacitor-dieletrico",
  course: "Exp III",
  title: "Capacitor de placas paralelas e dielétrico",
  sim: "capacitores",
  scenario: "v-constante",
  params: { modo: 0, bateria: 0, Lp: 10, d: 1, kappa: 3, V: 200 },
  locked: ["modo", "bateria", "Lp", "kappa"],
  objective:
    "Medir a capacitância de um capacitor de placas paralelas em função da separação entre as placas, determinar a permissividade do vácuo $\\varepsilon_0$ e a constante dielétrica de uma placa de acrílico.",
  materials: [
    "capacitor de placas quadradas de 10,0 cm de lado com separação ajustável",
    "paquímetro",
    "capacímetro digital (200 pF)",
    "placa de acrílico do tamanho das placas",
  ],
  procedure: `### Parte A: capacitância × separação
1. Sem o dielétrico, ajuste a separação $d$ entre as placas e meça-a com o paquímetro.
2. Leia a capacitância no capacímetro e clique em **Registrar medida**.
3. Repita para pelo menos 6 separações entre 1,0 cm e 3,0 cm.
4. Para placas ideais de área $A = L^2$, $C = \\varepsilon_0 A/d$. Placas reais têm **campo de borda**, que acrescenta uma capacitância quase independente de $d$ quando $d \\ll L$:
$$C \\approx C_b + \\varepsilon_0\\frac{A}{d}$$
O gráfico de $C$ contra $1/d$ é uma reta: a inclinação dá $\\varepsilon_0 = b/A$ e o intercepto estima a contribuição da borda.

### Parte B: dielétrico
1. Volte para $d = 1{,}0$ cm e anote $C_0$.
2. Arraste a placa de acrílico para dentro do capacitor, até preencher todo o espaço entre as placas, e anote $C_\\kappa$. Registre também alguns pontos com a placa parcialmente inserida.
3. A constante dielétrica é $\\kappa \\approx C_\\kappa/C_0$. Com inserção parcial $x$, $C$ cresce linearmente com $x$, pois são dois capacitores em paralelo.`,
  columns: [
    { key: "d", label: "d", unit: "mm", source: { param: "d" }, instrument: "paquimetro", toUnit: 10 },
    { key: "C", label: "C", unit: "pF", source: { observable: "Cb" }, instrument: { id: "capacimetro", name: "Capacímetro digital (200 pF)", unit: "pF", kind: "digital", resolution: 0.01, range: [0, 200], accuracy: dmmAccuracy(1, 3, 0.01) } },
    { key: "x", label: "x (inserção)", unit: "mm", source: { observable: "x" }, instrument: "regua", toUnit: 10 },
    { key: "invd", label: "1/d", unit: "1/m", from: ["d"], compute: (d) => 1000 / d },
  ],
  minRows: 5,
  analysis: {
    x: "invd",
    y: "C",
    fit: "linear",
    xLabel: "1/d (1/m)",
    yLabel: "C (pF)",
    results: [
      { label: "ε₀", unit: "10⁻¹² F/m", compute: (_a, b) => b / (LP * LP), reference: 8.854 },
      { label: "C de borda", unit: "pF", compute: (a) => a },
    ],
  },
  demo: (i) => ({ params: { d: 1 + 0.4 * i } }),
  questions: [
    "O valor de $\\varepsilon_0$ é compatível com $8{,}854\\times10^{-12}$ F/m? Em que sentido o campo de borda afeta a inclinação e o intercepto?",
    "Qual valor de $\\kappa$ você obteve na parte B? Por que a razão $C_\\kappa/C_0$ fica um pouco abaixo de $\\kappa$ quando há campo de borda?",
    "Com a bateria ligada, o que acontece com a carga e com a energia armazenada quando o dielétrico entra? E com a bateria desligada?",
    "Por que não é possível reduzir $d$ indefinidamente para aumentar $C$?",
  ],
};
