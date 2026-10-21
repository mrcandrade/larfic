// Lei de Charles (gás a pressão constante): V × θ → extrapolação ao zero absoluto.
import type { Practice } from "@fisilab/analysis";

const R = 8.314462618;
const P = 100; // kPa

export const practice: Practice = {
  id: "exp2-charles",
  course: "Exp II",
  title: "Lei de Charles e o zero absoluto",
  sim: "processos-pv",
  scenario: "isotermica",
  params: { processo: 2, n: 1, P0: P, V0: 25, Vf: 25, gamma: 5 / 3 },
  locked: ["processo", "n", "P0", "V0", "Pf", "gamma"],
  objective:
    "Verificar que, a pressão constante, o volume de um gás varia linearmente com a temperatura e estimar, por extrapolação, a temperatura em que o volume se anularia (zero absoluto).",
  materials: [
    "cilindro com êmbolo livre e escala graduada (0,1 L)",
    "1 mol de gás monoatômico",
    "banho térmico de −40 °C a 100 °C",
    "termômetro digital de imersão",
  ],
  procedure: `### Procedimento
1. O êmbolo é livre e a pressão externa é constante: $P = 100$ kPa. Leve o banho térmico a uma temperatura e espere o gás entrar em equilíbrio; o êmbolo sobe ou desce sozinho (no aparato, arraste o estado final ao longo da isóbara ou ajuste o volume final).
2. Clique em **Registrar medida** para ler o volume na escala do cilindro e a temperatura no termômetro.
3. Repita para pelo menos 6 temperaturas, espalhadas entre −40 °C e 100 °C.
4. O termômetro indica em graus Celsius: nenhuma hipótese sobre o zero absoluto entra nas medidas.
5. Pela lei de Charles, $V = V_0(1 + \\beta\\theta)$: o gráfico de $V$ contra $\\theta$ é uma reta. Extrapole até $V = 0$: o intercepto com o eixo das temperaturas, $\\theta_0 = -a/b$, é o **zero absoluto**.
6. Da inclinação, $b = nR/P$, obtenha a quantidade de gás.
7. Depois, troque para o processo **isocórico** e repita com $P$ contra $\\theta$ (termômetro de gás a volume constante). A extrapolação leva ao mesmo $\\theta_0$?`,
  columns: [
    { key: "V", label: "V", unit: "L", source: { observable: "V" }, instrument: { id: "cilindro-graduado", name: "Escala do cilindro (0,1 L)", unit: "L", kind: "analogico", resolution: 0.1, range: [0, 120] } },
    { key: "th", label: "θ", unit: "°C", source: { observable: "Tc" }, instrument: { id: "termometro-imersao", name: "Termômetro digital de imersão (°C)", unit: "°C", kind: "digital", resolution: 0.1, range: [-50, 150], accuracy: () => 0.3 } },
  ],
  minRows: 5,
  analysis: {
    x: "th",
    y: "V",
    fit: "linear",
    xLabel: "θ (°C)",
    yLabel: "V (L)",
    results: [
      { label: "zero absoluto θ₀", unit: "°C", compute: (a, b) => -a / b, reference: -273.15 },
      { label: "β = b/V(0 °C)", unit: "10⁻³/°C", compute: (a, b) => (1000 * b) / a, reference: 1000 / 273.15 },
      { label: "n", unit: "mol", compute: (_a, b) => (b * P) / R, reference: 1 },
    ],
  },
  demo: (i) => ({ params: { Vf: 20 + 2.2 * i } }),
  questions: [
    "O zero absoluto extrapolado é compatível com −273,15 °C? Por que a incerteza de $\\theta_0$ é tão maior que a de cada temperatura medida?",
    "O coeficiente de dilatação $\\beta$ é o mesmo para qualquer gás ideal, qualquer que seja a pressão? Justifique.",
    "Um gás real se liquefaz bem antes de 0 K. Por que mesmo assim a extrapolação faz sentido?",
    "Se a pressão fosse 200 kPa, o que mudaria no gráfico? E o ponto de interseção com o eixo θ?",
  ],
};
