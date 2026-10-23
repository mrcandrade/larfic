import type { ChapterChecks } from "../testes.ts";

export const testes: ChapterChecks = {
  n: 35,
  sections: {
    "35-2": [
      {
        q: "Quando a luz passa do ar para a água, o que muda?",
        options: ["A frequência", "A velocidade e o comprimento de onda; a frequência fica igual", "Só a cor", "Nada"],
        answer: 1,
        why: "A frequência é fixada pela fonte. Na água $v = c/n$ e $\\lambda_n = \\lambda/n$.",
      },
    ],
    "35-3": [
      {
        q: "Quando a difração por uma abertura fica mais evidente?",
        options: ["Quando a abertura é muito maior que $\\lambda$", "Quando a abertura é comparável a $\\lambda$", "Só com luz branca", "Nunca com luz"],
        answer: 1,
        why: "Aberturas da ordem do comprimento de onda espalham bastante a luz; aberturas grandes deixam passar um feixe quase retilíneo.",
      },
    ],
    "35-4": [
      {
        q: "No experimento de Young, se a distância entre as fendas diminui, as franjas na tela ficam:",
        options: ["Mais juntas", "Mais afastadas", "Iguais", "Somem"],
        answer: 1,
        why: "O espaçamento $\\Delta y = \\lambda D/d$ cresce quando $d$ diminui.",
      },
    ],
    "35-5": [
      {
        q: "Por que duas lâmpadas comuns não produzem franjas de interferência visíveis?",
        options: ["Porque emitem luz branca", "Porque não são coerentes: a diferença de fase entre elas muda ao acaso muito depressa", "Porque são grandes demais", "Porque a luz delas não é onda"],
        answer: 1,
        why: "As franjas se deslocam tão rápido que o olho só vê a média uniforme. Num laser, a fase se mantém por muito mais tempo.",
      },
    ],
    "35-6": [
      {
        q: "Na interferência de duas fendas, a intensidade no máximo central em relação à de uma fenda sozinha é:",
        options: ["O dobro", "Quatro vezes", "Igual", "Metade"],
        answer: 1,
        why: "As amplitudes se somam ($2E_0$) e a intensidade vai com o quadrado: $4I_0$. A energia não é criada: nos mínimos a intensidade é zero.",
      },
    ],
    "35-7": [
      {
        q: "Por que uma bolha de sabão fica escura no topo pouco antes de estourar?",
        options: ["Porque a água evapora", "Porque o filme fica muito fino e a inversão de fase numa das reflexões causa interferência destrutiva", "Porque a luz é absorvida", "Porque o sabão escurece"],
        answer: 1,
        why: "Com espessura muito menor que $\\lambda$, só sobra a diferença de meio comprimento de onda da reflexão no ar→filme, e as duas reflexões se cancelam.",
      },
    ],
    "35-8": [
      {
        q: "No interferômetro de Michelson, mover um espelho de $\\lambda/2$ desloca o padrão de:",
        options: ["Meia franja", "Uma franja", "Duas franjas", "Nenhuma"],
        answer: 1,
        why: "A luz faz ida e volta: o caminho muda $2\\cdot\\lambda/2 = \\lambda$, o que corresponde a uma franja inteira.",
      },
    ],
  },
};
