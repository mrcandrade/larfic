// Lente divergente: imagem virtual localizada por paralaxe, 1/p' × 1/p → f negativa.
import type { Practice } from "@fisilab/analysis";

const banco = { id: "trena-banco", name: "Escala do banco ótico", unit: "cm", kind: "analogico" as const, resolution: 0.1, range: [0, 200] as [number, number] };

export const practice: Practice = {
  id: "exp3-lente-divergente",
  course: "Exp III",
  title: "Lente divergente (método da paralaxe)",
  sim: "lentes",
  scenario: "lente",
  params: { montagem: 1 },
  locked: ["montagem"],
  objective:
    "Determinar a distância focal de uma lente divergente localizando a imagem virtual pelo método da paralaxe e aplicando a equação de Gauss com a convenção de sinais.",
  materials: ["banco ótico com escala", "lente divergente", "objeto (alfinete iluminado)", "alfinete de referência móvel, visto por cima da lente"],
  procedure: `### Procedimento
1. Uma lente divergente sozinha não forma imagem real de um objeto real, então não há o que projetar no anteparo. A imagem é **virtual**: fica do mesmo lado do objeto, entre ele e a lente.
2. Arraste o objeto para uma posição no banco e meça a distância $p$ até a lente.
3. Olhando através da lente, veja a imagem do objeto. Por cima da lente, sem passar por ela, observe um alfinete de referência e mova-o até que ele e a imagem **não se desloquem um em relação ao outro** quando você move a cabeça para os lados (ausência de paralaxe). Nesse ponto o alfinete está na posição da imagem: meça a distância $|p'|$ até a lente. Clique em **Registrar medida**.
4. Repita para pelo menos 6 posições do objeto entre 8 cm e 40 cm.
5. Na convenção de Gauss, a imagem virtual tem $p' = -|p'|$ e
$$\\frac1{p'} = \\frac1f - \\frac1p$$
O gráfico de $1/p'$ contra $1/p$ é uma reta de inclinação $-1$ cujo intercepto é $1/f$, negativo para a lente divergente.
6. Alternativa: associe a lente divergente a uma convergente mais forte, meça a distância focal da associação ($1/f_{eq} = 1/f_1 + 1/f_2$) e obtenha $f_2$.`,
  columns: [
    { key: "p", label: "p", unit: "cm", source: { observable: "p" }, instrument: banco, toUnit: 100 },
    { key: "q", label: "|p′|", unit: "cm", source: { observable: "q" }, instrument: banco, toUnit: -100 },
    { key: "ip", label: "1/p", unit: "1/m", from: ["p"], compute: (p) => 100 / p },
    { key: "iq", label: "1/p′", unit: "1/m", from: ["q"], compute: (q) => -100 / q },
  ],
  minRows: 5,
  analysis: {
    x: "ip",
    y: "iq",
    fit: "linear",
    xLabel: "1/p (1/m)",
    yLabel: "1/p′ (1/m)",
    results: [
      { label: "f", unit: "cm", compute: (a) => 100 / a, reference: -10 },
      { label: "vergência", unit: "D", compute: (a) => a, reference: -10 },
      { label: "inclinação", unit: "", compute: (_a, b) => b, reference: -1 },
    ],
  },
  demo: (i) => ({ drag: { from: ["ox", "oy"], to: [-(0.08 + 0.06 * i), 0.02] } }),
  questions: [
    "Por que a imagem de uma lente divergente é sempre virtual, direita e menor, qualquer que seja a posição do objeto real?",
    "Qual medida domina a incerteza de $f$: $p$ ou $|p'|$? Por quê?",
    "Que cuidado é preciso com a convenção de sinais ao escrever a equação de Gauss para uma imagem virtual?",
    "Uma pessoa míope usa óculos de −2,5 D. Qual é a distância focal da lente? Ela é convergente ou divergente?",
  ],
};
