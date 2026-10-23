import type { ChapterChecks } from "../testes.ts";

export const testes: ChapterChecks = {
  n: 42,
  sections: {
    "42-2": [
      {
        q: "No experimento de Rutherford, o que indicou que a carga positiva do átomo está concentrada num núcleo pequeno?",
        options: ["Todas as alfas passaram direto", "Algumas partículas alfa voltaram para trás", "As alfas foram absorvidas", "A folha de ouro brilhou"],
        answer: 1,
        why: "No modelo de Thomson, com a carga espalhada, nenhuma alfa seria desviada muito. Só uma carga concentrada produz forças capazes de rebater a alfa.",
      },
    ],
    "42-3": [
      {
        q: "O raio de um núcleo cresce com o número de massa como $R = R_0A^{1/3}$. O que isso diz sobre a densidade nuclear?",
        options: ["Cresce com $A$", "É aproximadamente a mesma em todos os núcleos", "Cai com $A$", "É zero"],
        answer: 1,
        why: "O volume é proporcional a $A$, então a densidade é constante, cerca de $2\\times10^{17}$ kg/m³: os núcleons se empacotam como gotas de líquido.",
      },
      {
        q: "Qual núcleo tem a maior energia de ligação por núcleon?",
        options: ["Hidrogênio", "Na região do ferro e do níquel", "Urânio", "Hélio"],
        answer: 1,
        why: "A curva de ligação tem máximo perto de $A \\approx 60$: fundir núcleos leves ou fissionar pesados libera energia.",
      },
    ],
    "42-4": [
      {
        q: "Uma amostra tem meia-vida de 8 dias. Que fração resta depois de 24 dias?",
        options: ["1/3", "1/8", "1/4", "1/24"],
        answer: 1,
        why: "24 dias são 3 meias-vidas: $(1/2)^3 = 1/8$.",
      },
    ],
    "42-5": [
      {
        q: "No decaimento alfa, o núcleo filho tem:",
        options: ["Z e A iguais ao pai", "Z menor de 2 e A menor de 4", "Z maior de 1 e o mesmo A", "Z menor de 4 e A menor de 2"],
        answer: 1,
        why: "A alfa é um núcleo de hélio-4 (2 prótons e 2 nêutrons). Ela escapa por tunelamento através da barreira coulombiana.",
      },
    ],
    "42-6": [
      {
        q: "Por que o espectro de energia dos elétrons do decaimento beta é contínuo?",
        options: ["Por erro de medida", "Porque a energia é repartida com um antineutrino, que também sai", "Porque o núcleo vibra", "Porque os elétrons colidem no caminho"],
        answer: 1,
        why: "Com três corpos no estado final, a energia $Q$ pode se dividir de muitas formas. Pauli propôs o neutrino em 1930 para salvar a conservação de energia.",
      },
    ],
    "42-7": [
      {
        q: "Uma amostra de madeira tem 1/4 do carbono-14 de uma árvore viva ($T_{1/2} = 5730$ anos). Qual a idade aproximada?",
        options: ["1430 anos", "11 460 anos", "22 920 anos", "5730 anos"],
        answer: 1,
        why: "1/4 corresponde a duas meias-vidas: $2\\cdot5730$ anos.",
      },
    ],
    "42-8": [
      {
        q: "Por que a dose equivalente (em sievert) é diferente da dose absorvida (em gray)?",
        options: ["São a mesma coisa", "A equivalente pondera o efeito biológico do tipo de radiação: alfas causam mais dano por joule que raios gama", "O sievert mede atividade", "O gray só vale para raios X"],
        answer: 1,
        why: "Dose absorvida é energia por massa; a equivalente multiplica por um fator de peso (cerca de 20 para alfa e 1 para gama).",
      },
    ],
    "42-9": [
      {
        q: "O que são os \"números mágicos\" (2, 8, 20, 28, 50, 82, 126) do modelo de camadas?",
        options: ["Números de núcleos estáveis conhecidos", "Números de prótons ou nêutrons que completam camadas e dão núcleos especialmente estáveis", "Massas atômicas", "Números de decaimentos"],
        answer: 1,
        why: "Como os gases nobres na química, núcleos com camadas completas têm energia de ligação extra e primeiros estados excitados altos.",
      },
    ],
  },
};
