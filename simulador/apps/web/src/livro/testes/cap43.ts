import type { ChapterChecks } from "../testes.ts";

export const testes: ChapterChecks = {
  n: 43,
  sections: {
    "43-2": [
      {
        q: "Quanta energia libera, aproximadamente, a fissão de um núcleo de urânio-235?",
        options: ["2 eV", "200 MeV", "2 GeV", "13,6 eV"],
        answer: 1,
        why: "Cerca de 200 MeV, a maior parte como energia cinética dos fragmentos, milhões de vezes mais que uma reação química.",
      },
    ],
    "43-3": [
      {
        q: "No modelo da gota líquida, por que o U-235 fissiona com nêutrons lentos e o U-238 não?",
        options: ["O U-238 é mais leve", "A captura de um nêutron pelo U-235 forma um núcleo par–par e libera energia suficiente para vencer a barreira de fissão", "O U-238 não absorve nêutrons", "O U-235 é instável sozinho"],
        answer: 1,
        why: "A energia de excitação depositada pela captura supera a barreira no U-236, mas não no U-239, que precisa de nêutrons rápidos.",
      },
    ],
    "43-4": [
      {
        q: "Para que serve o moderador num reator de urânio pouco enriquecido?",
        options: ["Absorver os nêutrons e desligar o reator", "Frear os nêutrons rápidos até energias térmicas, em que a fissão do U-235 é muito mais provável", "Resfriar o combustível só", "Aumentar a energia dos nêutrons"],
        answer: 1,
        why: "Colisões com núcleos leves (água, grafite) tiram energia dos nêutrons. As barras de controle é que absorvem nêutrons para regular o fator de multiplicação.",
      },
    ],
    "43-5": [
      {
        q: "Por que o reator natural de Oklo funcionou há 2 bilhões de anos e não poderia funcionar hoje?",
        options: ["Porque havia mais água", "Porque o U-235 decai mais rápido que o U-238, e naquela época o urânio natural era mais enriquecido (cerca de 3%)", "Porque a Terra era mais quente", "Porque havia menos oxigênio"],
        answer: 1,
        why: "Com meias-vidas de 0,70 e 4,47 bilhões de anos, a fração de U-235 cai com o tempo; hoje é 0,72%, pouco demais para um reator moderado a água.",
      },
    ],
    "43-6": [
      {
        q: "Por que a fusão exige temperaturas de dezenas de milhões de kelvin?",
        options: ["Para derreter os núcleos", "Para que os núcleos se aproximem apesar da repulsão coulombiana (com ajuda do tunelamento)", "Para ionizar os elétrons só", "Para produzir nêutrons"],
        answer: 1,
        why: "A barreira coulombiana é de centenas de keV; mesmo com $kT$ de alguns keV, as partículas da cauda da distribuição tunelam e fundem.",
      },
    ],
    "43-7": [
      {
        q: "Qual é o resultado líquido do ciclo próton–próton no Sol?",
        options: ["Hidrogênio vira ferro", "Quatro prótons viram um núcleo de hélio-4, com liberação de cerca de 26,7 MeV", "Hélio vira hidrogênio", "Carbono vira oxigênio"],
        answer: 1,
        why: "A diferença de massa entre quatro prótons e um hélio-4 sai como energia (parte levada pelos neutrinos).",
      },
    ],
    "43-8": [
      {
        q: "O critério de Lawson para a fusão controlada pede um valor mínimo de:",
        options: ["Temperatura apenas", "Produto da densidade pelo tempo de confinamento ($n\\tau$), a uma temperatura adequada", "Volume do reator", "Campo magnético apenas"],
        answer: 1,
        why: "O plasma precisa produzir mais energia de fusão do que perde; para D–T, $n\\tau \\gtrsim 10^{20}$ s/m³ perto de 10–20 keV.",
      },
    ],
  },
};
