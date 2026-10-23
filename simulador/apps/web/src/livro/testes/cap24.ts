import type { ChapterChecks } from "../testes.ts";

export const testes: ChapterChecks = {
  n: 24,
  sections: {
    "24-1": [
      {
        q: "Um próton é acelerado do repouso por uma diferença de potencial de 1000 V. Qual a energia cinética final?",
        options: ["1 eV", "1000 eV", "$1{,}6\\times10^{-16}$ eV", "500 eV"],
        answer: 1,
        why: "$K = |q|\\Delta V = e\\cdot1000$ V $= 1000$ eV $\\approx 1{,}6\\times10^{-16}$ J.",
      },
    ],
    "24-2": [
      {
        q: "Qual é o trabalho do campo elétrico para levar uma carga ao longo de uma superfície equipotencial?",
        options: ["Máximo", "Zero", "Negativo", "Depende do caminho"],
        answer: 1,
        why: "$W = -q\\Delta V$ e $\\Delta V = 0$. Por isso o campo é sempre perpendicular às equipotenciais.",
      },
    ],
    "24-3": [
      {
        q: "O potencial de uma carga pontual positiva, a uma distância $r$, varia como:",
        options: ["$1/r^2$", "$1/r$", "$r$", "Constante"],
        answer: 1,
        why: "$V = kq/r$, com $V = 0$ no infinito. O potencial cai mais devagar que o campo ($1/r^2$).",
      },
    ],
    "24-4": [
      {
        q: "No plano mediador de um dipolo elétrico (equidistante das duas cargas), o potencial vale:",
        options: ["O máximo", "Zero", "Igual ao de uma carga só", "Infinito"],
        answer: 1,
        why: "As contribuições $kq/r$ e $-kq/r$ se cancelam. O campo ali, porém, não é zero: aponta paralelo ao eixo.",
      },
    ],
    "24-5": [
      {
        q: "Como se calcula o potencial de uma distribuição contínua de carga?",
        options: ["Somando vetorialmente os campos", "Integrando $k\\,dq/r$, uma soma de escalares", "Multiplicando o campo pela área", "Pela lei de Gauss sempre"],
        answer: 1,
        why: "O potencial é escalar, e por isso a integral costuma ser mais simples que a do campo: não há componentes a decompor.",
      },
    ],
    "24-6": [
      {
        q: "Se $V(x) = 5x^2$ (SI), qual é o campo em $x = 2$ m?",
        options: ["$+20$ V/m", "$-20$ V/m", "$+10$ V/m", "$-10$ V/m"],
        answer: 1,
        why: "$E_x = -dV/dx = -10x = -20$ V/m: o campo aponta no sentido em que o potencial diminui.",
      },
    ],
    "24-7": [
      {
        q: "Três cargas iguais nos vértices de um triângulo equilátero de lado $d$. Qual é a energia potencial do sistema?",
        options: ["$kq^2/d$", "$3kq^2/d$", "$9kq^2/d$", "Zero"],
        answer: 1,
        why: "Soma-se $kq_iq_j/r_{ij}$ sobre cada par, uma vez: três pares iguais. É o trabalho necessário para montar o sistema trazendo as cargas do infinito.",
      },
    ],
    "24-8": [
      {
        q: "Dentro de um condutor carregado em equilíbrio, o potencial é:",
        options: ["Zero", "Constante, igual ao da superfície", "Maior no centro", "Menor no centro"],
        answer: 1,
        why: "Com $E = 0$ no interior, o potencial não varia: o condutor inteiro é uma equipotencial.",
      },
    ],
  },
};
