import type { ChapterChecks } from "../testes.ts";

export const testes: ChapterChecks = {
  n: 22,
  sections: {
    "22-1": [
      {
        q: "Uma carga de prova negativa num campo elétrico que aponta para a direita sofre força:",
        options: ["Para a direita", "Para a esquerda", "Para cima", "Nenhuma"],
        answer: 1,
        why: "$\\vec F = q\\vec E$: com $q < 0$, a força tem sentido oposto ao do campo.",
      },
    ],
    "22-2": [
      {
        q: "A 2 cm de uma carga pontual o campo vale $E$. Quanto vale a 6 cm?",
        options: ["$E/3$", "$E/9$", "$3E$", "$E/6$"],
        answer: 1,
        why: "$E = kq/r^2$: triplicar a distância divide o campo por 9.",
      },
    ],
    "22-3": [
      {
        q: "Longe de um dipolo elétrico, ao longo do eixo dele, o campo cai com:",
        options: ["$1/r$", "$1/r^2$", "$1/r^3$", "Não cai"],
        answer: 2,
        why: "Os campos das duas cargas quase se cancelam, e o que sobra é $E = p/(2\\pi\\varepsilon_0 r^3)$, mais rápido que o de uma carga só.",
      },
    ],
    "22-4": [
      {
        q: "No centro de um anel uniformemente carregado, o campo elétrico é:",
        options: ["Máximo", "Zero", "Infinito", "Igual ao de uma carga pontual"],
        answer: 1,
        why: "Por simetria, cada pedaço do anel tem um pedaço oposto cujo campo cancela o dele no centro. No eixo, longe dali, o campo deixa de ser zero.",
      },
    ],
    "22-5": [
      {
        q: "Bem perto de um disco grande e uniformemente carregado, o campo é aproximadamente:",
        options: ["$\\sigma/2\\varepsilon_0$, uniforme", "Proporcional a $1/r^2$", "Zero", "Proporcional à distância"],
        answer: 0,
        why: "Quando a distância é pequena comparada ao raio, o disco parece um plano infinito e o campo fica $\\sigma/2\\varepsilon_0$, sem depender da distância.",
      },
    ],
    "22-6": [
      {
        q: "Um elétron entra horizontalmente entre placas com campo uniforme vertical. Que trajetória ele descreve entre as placas?",
        options: ["Reta", "Parábola", "Círculo", "Espiral"],
        answer: 1,
        why: "A força $q\\vec E$ é constante e perpendicular à velocidade inicial, como a gravidade num lançamento horizontal: a trajetória é uma parábola.",
      },
    ],
    "22-7": [
      {
        q: "Um dipolo num campo uniforme, com o momento dipolar perpendicular ao campo, sofre:",
        options: ["Força resultante e nenhum torque", "Torque máximo e força resultante nula", "Nem força nem torque", "Força e torque máximos"],
        answer: 1,
        why: "As forças nas duas cargas se anulam num campo uniforme, mas formam um binário: $\\tau = pE\\,\\text{sen}\\,\\theta$, máximo a 90°.",
      },
    ],
  },
};
