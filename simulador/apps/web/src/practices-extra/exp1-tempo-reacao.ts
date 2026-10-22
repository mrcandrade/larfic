// Tempo de reação com a régua em queda: d × t² dá g; t = √(2d/g) dá o tempo de reação.
import type { Instrument, Practice } from "@fisilab/analysis";

const reguaMetro: Instrument = { id: "regua-1m", name: "Régua de 1 m (milimetrada)", unit: "mm", kind: "analogico", resolution: 1, range: [0, 1000] };
const cronometro: Instrument = { id: "cronometro-sensor", name: "Cronômetro com sensor (soltura → pegada)", unit: "s", kind: "digital", resolution: 0.001, range: [0, 10], accuracy: () => 0.001 };

export const practice: Practice = {
  id: "exp1-tempo-reacao",
  course: "Exp I",
  title: "Tempo de reação com régua em queda",
  extra: true,
  sim: "medidas-erros",
  scenario: "virtual",
  params: { modo: 0, quem: 0, Lregua: 1, resolucao: 0.001 },
  locked: ["modo", "Lregua", "resolucao"],
  objective:
    "Medir o tempo de reação pela distância de queda livre de uma régua, t = √(2d/g), tratar estatisticamente as repetições (média, desvio padrão e incerteza da média) e verificar o modelo de queda livre determinando g a partir de pares (d, t) medidos com um cronômetro de sensor.",
  materials: [
    "régua de 1 m milimetrada, solta do repouso entre os dedos do aluno",
    "cronômetro digital com sensor (dispara na soltura e para quando os dedos fecham), resolução 1 ms",
    "calculadora ou planilha",
  ],
  procedure: `### Procedimento
1. Posicione os dedos abertos na marca zero da régua. O colega (ou a simulação) solta a régua num instante imprevisível; feche os dedos assim que perceber a queda (clique no palco).
2. Leia na régua a distância $d$ percorrida até a pegada, com resolução de 1 mm, e anote o tempo $t$ marcado pelo cronômetro de sensor. Clique em **Registrar medida** depois de cada pegada.
3. Repita pelo menos 6 vezes. Para ter tempos bem diferentes entre si, alterne tentativas atentas e distraídas ou use o **aluno virtual**, mudando o tempo de reação médio entre 0,12 s e 0,30 s.
4. Para cada linha calcule $t_\\text{régua} = \\sqrt{2d/g}$ e compare com o tempo do cronômetro.
5. Na queda livre a partir do repouso, $d = \\tfrac12 g t^2$: o gráfico de $d$ contra $t^2$ é uma reta pela origem de inclinação $g/2$. Determine $g$.
6. Com o seu próprio tempo de reação (mesmo aluno, tentativas iguais), calcule a média, o desvio padrão $\\sigma$ e $\\sigma/\\sqrt n$.`,
  columns: [
    { key: "d", label: "d", unit: "mm", source: { observable: "dq" }, instrument: reguaMetro, toUnit: 1000 },
    { key: "t", label: "t (cronômetro)", unit: "s", source: { observable: "tq" }, instrument: cronometro },
    { key: "tr", label: "t = √(2d/g)", unit: "s", from: ["d"], compute: (d) => Math.sqrt((2 * d) / 1000 / 9.81) },
    { key: "t2", label: "t²", unit: "s²", from: ["t"], compute: (t) => t * t },
    { key: "dm", label: "d", unit: "m", from: ["d"], compute: (d) => d / 1000 },
  ],
  minRows: 5,
  analysis: {
    x: "t2",
    y: "dm",
    fit: "proporcional",
    xLabel: "t² (s²)",
    yLabel: "d (m)",
    results: [{ label: "g", unit: "m/s²", compute: (b) => 2 * b, reference: 9.81 }],
  },
  demo: (i) => ({ params: { quem: 1, tReacao: 0.12 + 0.03 * i, sigReacao: 0 }, t: 3.5 }),
  questions: [
    "Qual o seu tempo de reação médio, com incerteza? Compare σ (espalhamento de cada tentativa) com σ/√n (incerteza da média). Qual diminui com mais tentativas?",
    "O valor de g obtido pelo ajuste de d × t² é compatível com 9,81 m/s²? Qual instrumento domina a incerteza de g para tempos curtos?",
    "Por que a escala de tempo impressa na régua (em ms) não é uniforme? Quanto vale a distância entre as marcas de 100 ms e 200 ms?",
    "Se a régua fosse lida apenas até o centímetro, qual seria a incerteza de t para d ≈ 20 cm? Use $u_t = u_d / \\sqrt{2gd}$.",
    "Que erros sistemáticos podem afetar a medida (dedos fora do zero, régua com velocidade inicial, antecipar a soltura)? Como cada um altera t?",
  ],
};
