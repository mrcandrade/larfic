// Gota de óleo de Millikan: carga de várias gotas → carga elementar.
import type { Practice } from "@fisilab/analysis";

const ETA = 1.833e-5; // viscosidade do ar a 23 °C (Pa·s)
const RHO = 886 - 1.2; // densidade do óleo menos a do ar (kg/m³)
const G = 9.81;
const D_PLACAS = 6e-3; // distância entre as placas (m)
const S = 1e-3; // distância entre as linhas do retículo (m)
const B_P = 8.2e-3 / 101325; // b/p da correção de Cunningham (m)
const E0 = 1.602e-19;

/** Raio da gota a partir do tempo de queda, com correção de Cunningham. */
const radius = (t: number) => {
  const a2 = (9 * ETA * (S / t)) / (2 * RHO * G);
  return Math.sqrt((B_P / 2) ** 2 + a2) - B_P / 2;
};
const charge = (t: number, V: number) => ((4 / 3) * Math.PI * radius(t) ** 3 * RHO * G * D_PLACAS) / V;

export const practice: Practice = {
  id: "exp3-millikan",
  course: "Exp III",
  title: "Experimento de Millikan (carga elementar)",
  extra: true,
  sim: "millikan",
  scenario: "equilibrio",
  params: { metodo: 1, campo: 1, T: 23, cunningham: 1, luneta: 1, semente: 0 },
  locked: ["metodo", "T", "cunningham"],
  objective:
    "Medir a carga de várias gotas de óleo pelo método da tensão de equilíbrio e mostrar que todas são múltiplos inteiros de uma carga elementar e.",
  materials: [
    "câmara de Millikan com placas paralelas separadas de 6,00 mm",
    "atomizador com óleo (ρ = 886 kg/m³)",
    "luneta com retículo (linhas a 1,00 mm)",
    "fonte de tensão ajustável com voltímetro (0–2000 V)",
    "cronômetro manual",
    "termômetro (ar a 23 °C, η = 1,833 × 10⁻⁵ Pa·s)",
  ],
  procedure: `### Procedimento
1. Borrife óleo e escolha uma gota na luneta. Cada linha da tabela é **uma gota diferente** (use uma nova borrifada).
2. Ajuste a tensão até a gota ficar parada: essa é a tensão de equilíbrio $V_{eq}$.
3. Desligue o campo e cronometre três vezes a queda livre entre as linhas do retículo (1,00 mm): $t_q$.
4. Da lei de Stokes com correção de Cunningham, $v_q = 1\\ \\text{mm}/t_q$ dá o raio $r$, e
$$q = \\frac{\\tfrac43\\pi r^3(\\rho_o - \\rho_{ar})\\,g\\,d}{V_{eq}}$$
5. Atribua a cada gota o inteiro $n$ mais próximo de $q/(1{,}6\\times10^{-19}\\ \\text{C})$. O gráfico de $q$ contra $n$ é uma reta pela origem de inclinação $e$.
6. Meça pelo menos 6 gotas, de preferência com cargas diferentes.`,
  columns: [
    { key: "tq", label: "t_q (1 mm)", unit: "s", source: { observable: "tq" }, instrument: "cronometroManual", repeat: 3 },
    { key: "V", label: "V_eq", unit: "V", source: { observable: "Veq" }, instrument: { id: "fonte-2kv", name: "Voltímetro da fonte (2000 V)", unit: "V", kind: "digital", resolution: 1, range: [0, 2000], accuracy: (r) => 1 + 0.002 * r } },
    { key: "r", label: "r", unit: "µm", from: ["tq"], compute: (t) => radius(t) * 1e6 },
    { key: "q", label: "q", unit: "10⁻¹⁹ C", from: ["tq", "V"], compute: (t, V) => charge(t, V) * 1e19 },
    { key: "n", label: "n", unit: "", from: ["tq", "V"], compute: (t, V) => Math.max(1, Math.round(charge(t, V) / E0)) },
  ],
  minRows: 5,
  analysis: {
    x: "n",
    y: "q",
    fit: "proporcional",
    xLabel: "n",
    yLabel: "q (10⁻¹⁹ C)",
    results: [{ label: "e", unit: "C", compute: (b) => b * 1e-19, reference: 1.602e-19 }],
  },
  demo: (i) => ({ params: { semente: 3 + 7 * i }, t: 0.05 }),
  questions: [
    "O valor de e é compatível com 1,602 × 10⁻¹⁹ C? Atribuir n por arredondamento pressupõe que você já conhece e: como Millikan fez sem saber o valor?",
    "Refaça o cálculo de uma gota sem a correção de Cunningham. Quanto muda a carga? Por que a correção importa mais para gotas pequenas?",
    "O movimento browniano espalha os tempos de queda. Estime $\\sqrt{2Dt}$ para uma das gotas e compare com 1 mm.",
    "Por que gotas com muitas cargas (n grande) são ruins para descobrir a quantização?",
  ],
};
