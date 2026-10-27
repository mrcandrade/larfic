// Razão carga/massa do elétron: tubo de feixe fino em bobinas de Helmholtz.
import type { Practice } from "@fisilab/analysis";

/** Constante das bobinas: B = (4/5)^{3/2} μ₀N/R por ampère (N = 130, R = 0,150 m). */
const KB = (4 / 5) ** 1.5 * 4e-7 * Math.PI * 130 / 0.15;

export const practice: Practice = {
  id: "exp3-razao-em",
  course: "Exp III",
  title: "Razão carga/massa do elétron (tubo de feixe fino)",
  extra: true,
  sim: "razao-em",
  scenario: "feixe-fino",
  params: { modo: 0, V: 250, I: 1.5, Vp: 0 },
  locked: ["modo", "Vp"],
  objective:
    "Determinar a razão e/m do elétron medindo o diâmetro da órbita circular de um feixe de elétrons, acelerado por uma tensão V, no campo magnético uniforme de um par de bobinas de Helmholtz.",
  materials: [
    "tubo de feixe fino (gás rarefeito) com canhão de elétrons",
    "par de bobinas de Helmholtz (N = 130 espiras cada, R = 15,0 cm)",
    "fonte de alta tensão com voltímetro (0–500 V)",
    "fonte de corrente com amperímetro (0–3 A)",
    "régua milimetrada com espelho (para evitar paralaxe)",
  ],
  procedure: `### Procedimento
1. Ajuste a tensão de aceleração em $V \\approx 250$ V e mantenha-a fixa.
2. Escolha a corrente $I$ nas bobinas e meça com a régua o **diâmetro** $D$ do círculo luminoso (do canhão até o ponto oposto), olhando pelo espelho para eliminar a paralaxe.
3. Registre pelo menos 6 correntes entre 1,0 A e 2,5 A.
4. O campo no centro é $B = (4/5)^{3/2}\\mu_0 N I/R$. De $eV = \\tfrac12mv^2$ e $evB = mv^2/r$:
$$\\frac{1}{r^2} = \\frac{e}{m}\\,\\frac{B^2}{2V}$$
O gráfico de $1/r^2$ contra $B^2/(2V)$ é uma reta pela origem cuja inclinação é $e/m$.`,
  columns: [
    { key: "V", label: "V", unit: "V", source: { param: "V" }, instrument: { id: "kv-500", name: "Voltímetro da fonte (500 V)", unit: "V", kind: "digital", resolution: 1, range: [0, 500], accuracy: (r) => 1 + 0.005 * r } },
    { key: "I", label: "I", unit: "A", source: { param: "I" }, instrument: { id: "amp-3a", name: "Amperímetro (3 A)", unit: "A", kind: "digital", resolution: 0.01, range: [0, 3], accuracy: (r) => 0.01 + 0.01 * r } },
    { key: "D", label: "D", unit: "mm", source: { observable: "D" }, instrument: "regua", toUnit: 10 },
    { key: "x", label: "B²/(2V)", unit: "T²/V", from: ["I", "V"], compute: (I, V) => (KB * I) ** 2 / (2 * V) },
    { key: "y", label: "1/r²", unit: "m⁻²", from: ["D"], compute: (D) => 1 / (D / 2000) ** 2 },
  ],
  minRows: 5,
  analysis: {
    x: "x",
    y: "y",
    fit: "proporcional",
    xLabel: "B²/(2V) (T²/V)",
    yLabel: "1/r² (m⁻²)",
    results: [{ label: "e/m", unit: "C/kg", compute: (b) => b, reference: 1.7588e11 }],
  },
  demo: (i) => ({ params: { V: 250, I: 1.0 + 0.3 * i }, t: 0.1 }),
  questions: [
    "O valor de e/m obtido é compatível com 1,7588 × 10¹¹ C/kg? Qual medida domina a incerteza: D, I ou V?",
    "Por que a incerteza relativa em e/m é o dobro da incerteza relativa em D? Isso favorece círculos grandes ou pequenos?",
    "O campo magnético da Terra (≈ 20 µT na horizontal) soma-se ao das bobinas. Como você eliminaria esse efeito invertendo a corrente?",
    "Para V = 250 V, os elétrons são relativísticos? Estime o erro de usar $\\tfrac12mv^2$.",
  ],
};
