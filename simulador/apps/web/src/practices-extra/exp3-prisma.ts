// Prisma: desvio mínimo para várias linhas espectrais → n(λ), fórmula de Cauchy e número de Abbe.
import type { Practice } from "@fisilab/analysis";

const rad = (d: number) => (d * Math.PI) / 180;
const A = 60;
const LINHAS = [404.7, 435.8, 486.1, 546.1, 587.6, 656.3];
// Linhas de Fraunhofer F (486,1 nm), d (587,6 nm) e C (656,3 nm), em µm⁻².
const xF = 1 / 0.4861 ** 2, xd = 1 / 0.5876 ** 2, xC = 1 / 0.6563 ** 2;

export const practice: Practice = {
  id: "exp3-prisma",
  course: "Exp III",
  title: "Prisma: desvio mínimo e dispersão",
  sim: "prisma",
  scenario: "desvio-minimo",
  params: { modo: 0, material: 1, luz: 1, A, lambda: 589 },
  locked: ["modo", "material", "luz", "A"],
  objective:
    "Medir o ângulo de desvio mínimo de um prisma de vidro flint para várias linhas espectrais, obter o índice de refração em função do comprimento de onda e caracterizar a dispersão pela fórmula de Cauchy e pelo número de Abbe.",
  materials: [
    "espectrômetro (goniômetro com nônio de 1′, colimador e luneta)",
    "prisma equilátero de vidro flint (A = 60°)",
    "lâmpadas espectrais de mercúrio, hidrogênio e hélio",
  ],
  procedure: `### Procedimento
1. Ilumine a fenda do colimador com uma lâmpada espectral e escolha uma linha de comprimento de onda tabelado $\\lambda$ (no aparato, ajuste o comprimento de onda da luz monocromática).
2. Gire a mesa do prisma acompanhando a linha com a luneta: ela anda num sentido, para e volta. O ponto de retorno é o **desvio mínimo** $\\delta_m$. Leia-o no nônio e clique em **Registrar medida**.
3. Repita para as linhas 404,7 nm, 435,8 nm, 486,1 nm, 546,1 nm, 587,6 nm e 656,3 nm.
4. No desvio mínimo o raio atravessa o prisma paralelo à base e
$$n = \\frac{\\sin\\left(\\frac{A + \\delta_m}{2}\\right)}{\\sin\\left(\\frac{A}{2}\\right)}$$
5. Pela fórmula de Cauchy, $n(\\lambda) \\approx A_C + B_C/\\lambda^2$: o gráfico de $n$ contra $1/\\lambda^2$ é aproximadamente uma reta.
6. Com os coeficientes, calcule o **número de Abbe** $\\nu_d = (n_d - 1)/(n_F - n_C)$, que classifica o vidro (crown: $\\nu_d > 50$; flint: $\\nu_d < 50$).`,
  columns: [
    { key: "lam", label: "λ", unit: "nm", source: { param: "lambda" }, instrument: { id: "linha-espectral", name: "Linha espectral tabelada", unit: "nm", kind: "digital", resolution: 0.1, range: [300, 800] } },
    { key: "dm", label: "δm", unit: "°", source: { observable: "dmin" }, instrument: { id: "goniometro-nonio", name: "Goniômetro com nônio (1′)", unit: "°", kind: "nonio", resolution: 1 / 60, range: [0, 360] } },
    { key: "n", label: "n", unit: "", from: ["dm"], compute: (d) => Math.sin(rad((A + d) / 2)) / Math.sin(rad(A / 2)) },
    { key: "il2", label: "1/λ²", unit: "µm⁻²", from: ["lam"], compute: (l) => 1e6 / (l * l) },
  ],
  minRows: 5,
  analysis: {
    x: "il2",
    y: "n",
    fit: "linear",
    xLabel: "1/λ² (µm⁻²)",
    yLabel: "n",
    results: [
      { label: "A_C", unit: "", compute: (a) => a, reference: 1.5928 },
      { label: "B_C", unit: "µm²", compute: (_a, b) => b, reference: 0.00939 },
      { label: "número de Abbe ν_d", unit: "", compute: (a, b) => (a + b * xd - 1) / (b * (xF - xC)), reference: 36.37 },
    ],
  },
  demo: (i) => ({ params: { lambda: LINHAS[i] ?? 589 } }),
  questions: [
    "Qual cor sofre o maior desvio? Relacione com o sinal de $B_C$.",
    "O número de Abbe obtido pelo ajuste de Cauchy fica um pouco abaixo do valor de catálogo do vidro F2 (36,4). Por que a fórmula de dois termos não descreve perfeitamente a dispersão no violeta?",
    "Que incerteza em $n$ resulta de um erro de 1′ na leitura de $\\delta_m$? E de um erro de 1′ no ângulo $A$ do prisma?",
    "Por que se mede o desvio **mínimo** e não o desvio para um ângulo de incidência qualquer?",
  ],
};
