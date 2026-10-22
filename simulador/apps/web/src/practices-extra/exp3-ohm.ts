// Lei de Ohm: resistor ôhmico (V × I → R) e lâmpada incandescente (R e potência variam).
import { dmmAccuracy, type Practice } from "@fisilab/analysis";

export const practice: Practice = {
  id: "exp3-ohm",
  course: "Exp III",
  title: "Lei de Ohm: resistor e lâmpada",
  sim: "curva-iv",
  scenario: "ohmico",
  params: { comp: 0, Rp: 100, Rx: 470, montagem: 0, Ra: 1, Rv: 1e7 },
  locked: ["Ra", "Rv"],
  objective:
    "Verificar a lei de Ohm para um resistor de carbono, determinar sua resistência por ajuste linear e comparar com o comportamento não ôhmico de uma lâmpada incandescente, cuja resistência e potência crescem com a corrente.",
  materials: [
    "fonte DC ajustável de 0 a 15 V",
    "resistor de proteção de 100 Ω",
    "resistor de 470 Ω (5 %) e lâmpada de 12 V / 0,1 A",
    "dois multímetros (voltímetro 20 V e amperímetro 200 mA)",
    "protoboard e cabos",
  ],
  procedure: `### Parte A: resistor
1. Monte o resistor em série com o resistor de proteção, o amperímetro e a fonte; ligue o voltímetro diretamente sobre o resistor (montagem **a jusante**).
2. Ajuste a fonte, leia $V$ e $I$ e clique em **Registrar medida**.
3. Repita para pelo menos 6 tensões da fonte entre 1 V e 12 V.
4. Pela lei de Ohm, $V = RI$: o gráfico de $V$ contra $I$ é uma reta pela origem de inclinação $R$. Use o intercepto do ajuste linear para verificar se há tensão de desvio (zero mal ajustado).
5. Observe as colunas $R = V/I$ e $P = VI$: a resistência fica constante e a potência cresce com $I^2$.

### Parte B: lâmpada
1. Troque o componente para a **lâmpada**, limpe a tabela e repita as medidas entre 1 V e 14 V.
2. Agora $R = V/I$ cresce bastante: o filamento de tungstênio esquenta e sua resistividade aumenta. Faça o gráfico de $R$ contra $P$ e discuta.`,
  columns: [
    { key: "V", label: "V", unit: "V", source: { observable: "V" }, instrument: "voltimetro" },
    { key: "I", label: "I", unit: "mA", source: { observable: "I" }, instrument: { id: "amperimetro-20ma", name: "Multímetro (mA DC, 20 mA / 200 mA)", unit: "mA", kind: "digital", resolution: 0.01, range: [-200, 200], accuracy: dmmAccuracy(1, 3, 0.01) }, toUnit: 1000 },
    { key: "R", label: "R = V/I", unit: "Ω", from: ["V", "I"], compute: (V, I) => (1000 * V) / I },
    { key: "P", label: "P = VI", unit: "mW", from: ["V", "I"], compute: (V, I) => V * I },
  ],
  minRows: 5,
  analysis: {
    x: "I",
    y: "V",
    fit: "linear",
    xLabel: "I (mA)",
    yLabel: "V (V)",
    results: [
      { label: "R", unit: "Ω", compute: (_a, b) => 1000 * b, reference: 470 },
      { label: "V₀ (intercepto)", unit: "V", compute: (a) => a },
    ],
  },
  demo: (i) => ({ params: { comp: 0, Vf: 1 + 2.2 * i } }),
  questions: [
    "O valor de R está dentro da tolerância de 5 % do código de cores? O intercepto é compatível com zero?",
    "Na lâmpada, quanto vale $R$ com a menor e com a maior corrente? Estime a temperatura do filamento sabendo que $R \\propto T^{1,2}$ e que a 300 K ela vale cerca de 8,6 Ω.",
    "Por que uma lâmpada incandescente costuma queimar no instante em que é ligada?",
    "Para um resistor de 1 MΩ, qual montagem (a jusante ou a montante) você escolheria? Justifique com as resistências internas dos medidores.",
  ],
};
