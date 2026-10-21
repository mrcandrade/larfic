// Olho míope com lentes de prova: borrão na retina × vergência da lente → correção e erro refrativo.
import type { Practice } from "@fisilab/analysis";

const PO = 3.988; // distância do optotipo à lente de prova (m)
const DV = 0.012; // distância lente–olho (m)

export const practice: Practice = {
  id: "exp3-olho",
  course: "Exp III",
  title: "Olho míope e lente corretiva",
  sim: "lentes",
  scenario: "miopia",
  params: { montagem: 6, rx: -2, acom: 4, oculos: 0 },
  locked: ["montagem", "rx", "acom", "alfa", "nL", "esp", "Rl"],
  objective:
    "Determinar, num olho artificial míope, a vergência da lente corretiva e o erro refrativo do olho, a partir do tamanho do borrão na retina obtido com várias lentes de prova.",
  materials: [
    "olho artificial (lente + anteparo como retina), míope e com acomodação de até 4 D",
    "caixa de lentes de prova (passos de 0,25 D) a 12 mm do olho",
    "optotipo iluminado a 4,00 m",
    "lupa com retículo micrométrico para ler o borrão na retina",
  ],
  procedure: `### Procedimento
1. Sem lente de prova, observe a retina do olho artificial: o optotipo fica borrado, porque o olho míope focaliza a imagem antes da retina e **não consegue** corrigir isso acomodando.
2. Coloque uma lente de prova divergente de vergência $P$, meça o raio do borrão na retina com o retículo e clique em **Registrar medida**.
3. Repita com lentes de 0 D a −1,25 D, em passos de −0,25 D, todas mais fracas que a correção (o borrão deve diminuir mas não sumir).
4. Enquanto a lente for mais fraca que a necessária, o borrão é proporcional ao erro de foco: $r_b = k\\,(P - P_0)$. O gráfico de $r_b$ contra $P$ é uma reta que corta o eixo em $P_0 = -a/b$, a **vergência corretiva**.
5. A lente deve formar, do optotipo a $p = 3{,}988$ m, uma imagem no ponto remoto do olho. A vergência que chega ao olho, a $d = 12$ mm da lente, é
$$V = P_0 - \\frac1p \\qquad R_x = \\frac{V}{1 - dV}$$
onde $R_x$ é o **erro refrativo** do olho (negativo na miopia).
6. Coloque uma lente mais forte que $P_0$: o borrão continua nulo? Por quê? Use a acomodação indicada no aparato para explicar.`,
  columns: [
    { key: "P", label: "P", unit: "D", source: { param: "oculos" }, instrument: { id: "lente-prova", name: "Lente de prova (rótulo, ±0,06 D)", unit: "D", kind: "digital", resolution: 0.25, range: [-20, 20], accuracy: () => 0.06 } },
    { key: "rb", label: "r_b", unit: "mm", source: { observable: "blur" }, instrument: { id: "reticulo", name: "Retículo micrométrico (0,001 mm)", unit: "mm", kind: "analogico", resolution: 0.001, range: [0, 5] } },
  ],
  minRows: 5,
  analysis: {
    x: "P",
    y: "rb",
    fit: "linear",
    xLabel: "P (D)",
    yLabel: "raio do borrão (mm)",
    results: [
      { label: "vergência corretiva P₀", unit: "D", compute: (a, b) => -a / b, reference: -1 / PO + -2 / (1 - DV * 2) },
      {
        label: "erro refrativo Rx",
        unit: "D",
        compute: (a, b) => {
          const V = -a / b - 1 / PO;
          return V / (1 - DV * V);
        },
        reference: -2,
      },
    ],
  },
  demo: (i) => ({ params: { oculos: -0.25 * i } }),
  questions: [
    "A vergência corretiva difere do erro refrativo do olho. Explique as duas razões (distância do optotipo e distância lente–olho).",
    "Por que um míope não consegue compensar a falta de lente acomodando, mas um hipermétrope jovem consegue?",
    "Para um erro refrativo de −8 D, quanto a distância de 12 mm entre a lente e o olho altera a vergência dos óculos? E para uma lente de contato?",
    "Por que o borrão diminui quando a pupila fica menor (por exemplo, sob luz forte)?",
  ],
};
