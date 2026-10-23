import type { ChapterChecks } from "../testes.ts";

export const testes: ChapterChecks = {
  n: 27,
  sections: {
    "27-1": [
      {
        q: "Uma bateria de 12 V com resistência interna de 1 Ω alimenta um resistor de 5 Ω. Qual é a tensão nos terminais da bateria?",
        options: ["12 V", "10 V", "2 V", "6 V"],
        answer: 1,
        why: "$i = 12/(5 + 1) = 2$ A e $V = \\mathscr{E} - ir = 12 - 2 = 10$ V.",
      },
    ],
    "27-2": [
      {
        q: "Num nó de um circuito chegam 3 A e 2 A, e sai uma corrente por um terceiro fio. Quanto vale ela?",
        options: ["1 A", "5 A", "6 A", "Não dá para saber"],
        answer: 1,
        why: "Regra dos nós (conservação da carga): o que entra sai. $3 + 2 = 5$ A.",
      },
      {
        q: "Três resistores de 6 Ω em paralelo equivalem a:",
        options: ["18 Ω", "2 Ω", "6 Ω", "3 Ω"],
        answer: 1,
        why: "$1/R_{eq} = 3/6$, logo $R_{eq} = 2$ Ω. Em paralelo, a resistência equivalente é menor que a menor delas.",
      },
    ],
    "27-3": [
      {
        q: "Como deve ser a resistência de um voltímetro ideal, e como ele é ligado?",
        options: ["Muito pequena, em série", "Muito grande, em paralelo", "Muito grande, em série", "Muito pequena, em paralelo"],
        answer: 1,
        why: "O voltímetro em paralelo não deve desviar corrente, por isso a resistência enorme. O amperímetro vai em série e precisa de resistência quase nula.",
      },
    ],
    "27-4": [
      {
        q: "Num circuito RC com $R = 10$ kΩ e $C = 100$ μF, qual é a constante de tempo?",
        options: ["1 ms", "1 s", "10 s", "0,1 s"],
        answer: 1,
        why: "$\\tau = RC = 10^4\\cdot10^{-4} = 1$ s. Depois de $\\tau$ o capacitor tem cerca de 63% da carga final.",
      },
    ],
  },
};
