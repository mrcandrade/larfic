import type { ChapterChecks } from "../testes.ts";

export const testes: ChapterChecks = {
  n: 26,
  sections: {
    "26-1": [
      {
        q: "Uma corrente de 2 A passa por um fio durante 1 minuto. Quanta carga atravessa uma seção do fio?",
        options: ["2 C", "120 C", "30 C", "0,033 C"],
        answer: 1,
        why: "$q = it = 2\\cdot60 = 120$ C, cerca de $7{,}5\\times10^{20}$ elétrons.",
      },
    ],
    "26-2": [
      {
        q: "Num fio de cobre com corrente típica, a velocidade de deriva dos elétrons é da ordem de:",
        options: ["A velocidade da luz", "Milhares de km/s", "Frações de milímetro por segundo", "Alguns m/s"],
        answer: 2,
        why: "$v_d = J/(ne)$ é minúscula porque $n$ é enorme. A lâmpada acende na hora porque o campo se estabelece quase à velocidade da luz em todo o fio.",
      },
    ],
    "26-3": [
      {
        q: "Um fio é esticado até ficar com o dobro do comprimento (mesmo volume). A resistência:",
        options: ["Dobra", "Quadruplica", "Fica igual", "Cai à metade"],
        answer: 1,
        why: "$R = \\rho L/A$: o comprimento dobra e, para manter o volume, a área cai à metade. Os dois efeitos multiplicam $R$ por 4.",
      },
    ],
    "26-4": [
      {
        q: "O que caracteriza um dispositivo que obedece à lei de Ohm?",
        options: ["Ter $V = Ri$ para algum valor", "Ter resistência que não depende da tensão aplicada", "Conduzir em um só sentido", "Ter resistência zero"],
        answer: 1,
        why: "$V = Ri$ define a resistência de qualquer dispositivo; obedecer à lei de Ohm é ter a curva $i$–$V$ reta, passando pela origem. Um diodo não obedece.",
      },
    ],
    "26-5": [
      {
        q: "Um chuveiro de 5500 W ligado em 220 V. Qual é a corrente?",
        options: ["12,5 A", "25 A", "50 A", "2,5 A"],
        answer: 1,
        why: "$P = Vi$ dá $i = 5500/220 = 25$ A, o que exige fiação e disjuntor adequados.",
      },
      {
        q: "O que acontece com a resistividade de um semicondutor como o silício quando ele esquenta?",
        options: ["Aumenta, como nos metais", "Diminui, porque mais elétrons ganham energia para chegar à banda de condução", "Não muda", "Vai a zero"],
        answer: 1,
        why: "Nos metais o número de portadores é fixo e as colisões aumentam com a temperatura; no semicondutor o número de portadores cresce muito e domina.",
      },
    ],
  },
};
