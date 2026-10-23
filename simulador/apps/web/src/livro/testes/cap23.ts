import type { ChapterChecks } from "../testes.ts";

export const testes: ChapterChecks = {
  n: 23,
  sections: {
    "23-1": [
      {
        q: "Qual é o fluxo de um campo uniforme através de uma superfície fechada (um cubo, por exemplo) sem cargas dentro?",
        options: ["$EA$", "Zero", "$6EA$", "Depende da orientação do cubo"],
        answer: 1,
        why: "Todas as linhas que entram por uma face saem por outra: o fluxo líquido é zero.",
      },
    ],
    "23-2": [
      {
        q: "Uma superfície gaussiana envolve uma carga $q$. Se a superfície for trocada por outra maior, o fluxo:",
        options: ["Diminui", "Aumenta", "Fica igual", "Vai a zero"],
        answer: 2,
        why: "Pela lei de Gauss, $\\Phi = q_{env}/\\varepsilon_0$: só a carga envolvida importa, não o tamanho ou a forma da superfície.",
      },
    ],
    "23-3": [
      {
        q: "Onde fica o excesso de carga de um condutor isolado em equilíbrio?",
        options: ["Distribuído pelo volume", "Na superfície externa", "Só no centro", "Metade dentro, metade fora"],
        answer: 1,
        why: "O campo dentro do condutor em equilíbrio é zero; uma superfície gaussiana logo abaixo da superfície não envolve carga, então tudo fica na superfície.",
      },
    ],
    "23-4": [
      {
        q: "Como varia o campo de um fio longo e uniformemente carregado com a distância $r$?",
        options: ["$1/r^2$", "$1/r$", "Constante", "$r$"],
        answer: 1,
        why: "Com um cilindro gaussiano coaxial: $E\\cdot2\\pi rL = \\lambda L/\\varepsilon_0$, logo $E = \\lambda/(2\\pi\\varepsilon_0 r)$.",
      },
    ],
    "23-5": [
      {
        q: "Entre duas placas grandes e paralelas, com cargas $+\\sigma$ e $-\\sigma$, o campo vale:",
        options: ["$\\sigma/2\\varepsilon_0$", "$\\sigma/\\varepsilon_0$", "Zero", "$2\\sigma/\\varepsilon_0$"],
        answer: 1,
        why: "Cada placa contribui com $\\sigma/2\\varepsilon_0$; entre elas os campos se somam e, do lado de fora, se cancelam.",
      },
    ],
    "23-6": [
      {
        q: "Dentro de uma casca esférica uniformemente carregada, o campo elétrico é:",
        options: ["Igual ao de uma carga pontual no centro", "Zero", "Máximo no centro", "Uniforme e diferente de zero"],
        answer: 1,
        why: "Uma superfície gaussiana interna não envolve carga, e a simetria esférica impõe $E = 0$ em todo o interior.",
      },
    ],
  },
};
