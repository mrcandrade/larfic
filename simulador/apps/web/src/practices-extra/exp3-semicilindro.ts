// Semicilindro de acrílico com a luz saindo do acrílico: lei de Snell e ângulo crítico → n.
import type { Practice } from "@fisilab/analysis";

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;
const N = 1.49;

export const practice: Practice = {
  id: "exp3-semicilindro",
  course: "Exp III",
  title: "Semicilindro: refração e ângulo crítico",
  sim: "refracao",
  scenario: "rit",
  params: { modo: 0, n1: N, n2: 1, pol: 0, theta: 10 },
  locked: ["modo", "n1", "n2", "pol"],
  objective:
    "Determinar o índice de refração de um semicilindro de acrílico com a luz passando do acrílico para o ar, prever o ângulo crítico pela lei de Snell e confirmá-lo observando a reflexão interna total.",
  materials: ["laser de diodo", "semicilindro de acrílico sobre disco goniométrico", "anteparo"],
  procedure: `### Procedimento
1. Faça o feixe entrar pela face **curva**, sempre na direção do centro do semicilindro: assim ele não desvia ao entrar e chega à face plana com o ângulo de incidência $\\theta_1$ lido no disco.
2. Leia no disco o ângulo $\\theta_2$ do raio que sai para o ar e clique em **Registrar medida**.
3. Repita para pelo menos 6 ângulos de incidência entre 5° e 38°.
4. Pela lei de Snell, $n\\sin\\theta_1 = \\sin\\theta_2$: o gráfico de $\\sin\\theta_2$ contra $\\sin\\theta_1$ é uma reta pela origem de inclinação $n$.
5. Com o $n$ obtido, preveja o ângulo crítico $\\theta_c = \\arcsin(1/n)$.
6. Aumente $\\theta_1$ devagar e anote o ângulo em que o raio refratado rasante desaparece e toda a luz é refletida. Compare com a previsão.`,
  columns: [
    { key: "t1", label: "θ₁", unit: "°", source: { observable: "th1" }, instrument: { id: "disco-graduado", name: "Disco graduado (0,5°)", unit: "°", kind: "analogico", resolution: 0.5, range: [0, 360] } },
    { key: "t2", label: "θ₂", unit: "°", source: { observable: "th2" }, instrument: { id: "disco-graduado", name: "Disco graduado (0,5°)", unit: "°", kind: "analogico", resolution: 0.5, range: [0, 360] } },
    { key: "s1", label: "sen θ₁", unit: "", from: ["t1"], compute: (t) => Math.sin(rad(t)) },
    { key: "s2", label: "sen θ₂", unit: "", from: ["t2"], compute: (t) => Math.sin(rad(t)) },
  ],
  minRows: 5,
  analysis: {
    x: "s1",
    y: "s2",
    fit: "proporcional",
    xLabel: "sen θ₁ (no acrílico)",
    yLabel: "sen θ₂ (no ar)",
    results: [
      { label: "n do acrílico", unit: "", compute: (b) => b, reference: N },
      { label: "θc previsto", unit: "°", compute: (b) => deg(Math.asin(1 / b)), reference: deg(Math.asin(1 / N)) },
    ],
  },
  demo: (i) => ({ params: { theta: 5 + 6.5 * i } }),
  questions: [
    "O ângulo crítico observado coincide com o previsto pelo ajuste, dentro das incertezas?",
    "Por que o feixe deve entrar pela face curva apontando para o centro? O que aconteceria se não apontasse?",
    "Perto do ângulo crítico, o raio refratado fica fraco e o refletido forte. Use a refletância indicada no aparato para descrever essa transição.",
    "Como esse fenômeno é aproveitado nas fibras óticas? Qual seria o ângulo crítico numa interface acrílico–água (n = 1,33)?",
  ],
};
