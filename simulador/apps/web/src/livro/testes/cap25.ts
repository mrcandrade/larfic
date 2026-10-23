import type { ChapterChecks } from "../testes.ts";

export const testes: ChapterChecks = {
  n: 25,
  sections: {
    "25-1": [
      {
        q: "Um capacitor de 10 μF é ligado a 12 V. Qual a carga em cada placa?",
        options: ["120 μC", "1,2 μC", "0,83 μC", "12 μC"],
        answer: 0,
        why: "$q = CV = 10\\times10^{-6}\\cdot12 = 1{,}2\\times10^{-4}$ C: $+120$ μC numa placa e $-120$ μC na outra.",
      },
    ],
    "25-2": [
      {
        q: "Num capacitor de placas paralelas, se a distância entre as placas dobra, a capacitância:",
        options: ["Dobra", "Cai à metade", "Fica igual", "Quadruplica"],
        answer: 1,
        why: "$C = \\varepsilon_0A/d$ depende só da geometria: maior distância, menor capacitância.",
      },
    ],
    "25-3": [
      {
        q: "Dois capacitores de 6 μF ligados em série equivalem a:",
        options: ["12 μF", "3 μF", "6 μF", "36 μF"],
        answer: 1,
        why: "Em série, $1/C_{eq} = 1/C_1 + 1/C_2$: dá 3 μF. Em paralelo as capacitâncias somam (12 μF), ao contrário dos resistores.",
      },
    ],
    "25-4": [
      {
        q: "Se a tensão num capacitor dobra, a energia armazenada:",
        options: ["Dobra", "Quadruplica", "Fica igual", "Cai à metade"],
        answer: 1,
        why: "$U = \\tfrac12CV^2$. A energia fica no campo elétrico entre as placas, com densidade $\\tfrac12\\varepsilon_0E^2$.",
      },
    ],
    "25-5": [
      {
        q: "Um capacitor ligado a uma bateria recebe um dielétrico de $\\kappa = 3$ entre as placas. O que acontece com a carga?",
        options: ["Fica igual", "Triplica", "Cai a um terço", "Vai a zero"],
        answer: 1,
        why: "A capacitância triplica e, com a tensão fixada pela bateria, $q = CV$ triplica. Com o capacitor isolado, seria a tensão que cairia a um terço.",
      },
    ],
    "25-6": [
      {
        q: "Por que o campo dentro de um dielétrico num capacitor é menor que no vácuo, para a mesma carga livre?",
        options: ["Porque o dielétrico conduz", "Porque as moléculas polarizadas criam cargas induzidas nas superfícies que se opõem ao campo", "Porque o dielétrico absorve elétrons", "Não é menor"],
        answer: 1,
        why: "A carga induzida reduz a carga efetiva vista pela lei de Gauss: $\\varepsilon_0\\oint\\kappa\\vec E\\cdot d\\vec A = q_{livre}$.",
      },
    ],
  },
};
