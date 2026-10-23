import type { ChapterChecks } from "../testes.ts";

export const testes: ChapterChecks = {
  n: 21,
  sections: {
    "21-1": [
      {
        q: "Se as duas cargas e a distância entre elas dobram, a força elétrica:",
        options: ["Dobra", "Fica igual", "Quadruplica", "Cai à metade"],
        answer: 1,
        why: "$F = k|q_1q_2|/r^2$: o numerador fica 4 vezes maior e o denominador também. A força não muda.",
      },
      {
        q: "Um bastão carregado atrai pedacinhos de papel neutros. Por quê?",
        options: ["O papel tem carga oposta", "O bastão polariza o papel: as cargas opostas ficam mais perto e a atração vence a repulsão", "A gravidade do bastão", "O papel é magnético"],
        answer: 1,
        why: "No objeto neutro, a carga induzida de sinal oposto fica mais próxima, e como a força cai com $1/r^2$, a atração predomina.",
      },
    ],
    "21-2": [
      {
        q: "Qual destas cargas NÃO pode existir num objeto isolado?",
        options: ["$3{,}2\\times10^{-19}$ C", "$-4{,}8\\times10^{-19}$ C", "$2{,}4\\times10^{-19}$ C", "$1{,}6\\times10^{-18}$ C"],
        answer: 2,
        why: "A carga é quantizada: $q = ne$ com $e = 1{,}602\\times10^{-19}$ C. O valor $2{,}4\\times10^{-19}$ C seria 1,5 $e$.",
      },
    ],
    "21-3": [
      {
        q: "Você esfrega um balão no cabelo e o balão fica com $-5\\ \\mu$C. Com que carga fica o cabelo?",
        options: ["$-5\\ \\mu$C", "$+5\\ \\mu$C", "Zero", "$+10\\ \\mu$C"],
        answer: 1,
        why: "A carga se conserva: os elétrons só passam do cabelo para o balão. O total continua zero.",
      },
    ],
  },
};
