// Difração de elétrons em grafite: raio do anel × 1/√V → distância interplanar.
import type { Practice } from "@fisilab/analysis";

const L_MM = 135; // distância grafite–tela (mm)
const K_LAMBDA = 1.2264; // λ√V em nm·V^½ (não relativístico)

export const practice: Practice = {
  id: "exp3-difracao-eletrons",
  course: "Exp III",
  title: "Difração de elétrons em grafite",
  extra: true,
  sim: "difracao-eletrons",
  scenario: "aneis",
  params: { modo: 0, amostra: 0, V: 4, taxa: 1500 },
  locked: ["modo", "amostra"],
  objective:
    "Verificar a natureza ondulatória do elétron pela difração num policristal de grafite e determinar a distância interplanar d₁₀ a partir da relação entre o raio do anel e a tensão de aceleração.",
  materials: [
    "tubo de difração de elétrons com folha de grafite (L = 13,5 cm até a tela)",
    "fonte de alta tensão (2–10 kV) com voltímetro",
    "paquímetro para medir o diâmetro dos anéis sobre o bulbo",
  ],
  procedure: `### Procedimento
1. Ajuste a tensão de aceleração $V$ entre 3 kV e 9 kV.
2. Meça com o paquímetro o diâmetro $D$ do **anel interno** (reflexão 10) e calcule $r = D/2$.
3. Repita para pelo menos 6 tensões.
4. Com $\\lambda = h/\\sqrt{2meV} = 1{,}226\\ \\text{nm}/\\sqrt{V}$ e, para ângulos pequenos, $r \\approx L\\lambda/d$ (pois $2\\theta \\approx \\lambda/d$):
$$r = \\frac{L \\cdot 1{,}226\\ \\text{nm·V}^{1/2}}{d}\\,\\frac{1}{\\sqrt V}$$
O gráfico de $r$ contra $1/\\sqrt V$ é uma reta pela origem; da inclinação $b$ sai $d = L \\cdot 1{,}226/b$.`,
  columns: [
    { key: "V", label: "V", unit: "kV", source: { param: "V" }, instrument: { id: "kv-10", name: "Voltímetro de alta tensão (10 kV)", unit: "kV", kind: "digital", resolution: 0.01, range: [0, 10], accuracy: (r) => 0.02 + 0.005 * r } },
    { key: "D", label: "D (anel interno)", unit: "mm", source: { observable: "D10" }, instrument: "paquimetro", repeat: 2 },
    { key: "x", label: "1/√V", unit: "V^-½", from: ["V"], compute: (V) => 1 / Math.sqrt(V * 1e3) },
    { key: "r", label: "r", unit: "mm", from: ["D"], compute: (D) => D / 2 },
  ],
  minRows: 5,
  analysis: {
    x: "x",
    y: "r",
    fit: "proporcional",
    xLabel: "1/√V (V^-½)",
    yLabel: "r (mm)",
    results: [{ label: "d₁₀", unit: "nm", compute: (b) => (L_MM * K_LAMBDA) / b, reference: 0.213 }],
  },
  demo: (i) => ({ params: { V: 3 + 1.2 * i }, t: 0.1 }),
  questions: [
    "O valor de d₁₀ é compatível com 0,213 nm? E o anel externo: qual d você obteria? Verifique que d₁₀/d₁₁ ≈ √3.",
    "Até que tensão a aproximação não relativística e a de ângulos pequenos (tan 2θ ≈ 2θ) introduzem erros menores que 1 %?",
    "Por que uma amostra policristalina dá anéis e um monocristal dá manchas?",
    "Se os elétrons fossem partículas clássicas, o que se veria na tela?",
  ],
};
