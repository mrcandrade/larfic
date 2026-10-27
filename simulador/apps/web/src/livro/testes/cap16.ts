import type { ChapterChecks } from "../testes.ts";

export const testes: ChapterChecks = {
  n: 16,
  sections: {
    "16-2": [
      {
        q: "Qual destas ondas pode se propagar no vácuo?",
        options: ["Som", "Onda numa corda", "Luz", "Onda na superfície da água"],
        answer: 2,
        why: "A luz é uma onda eletromagnética e não precisa de meio material. As mecânicas (som, corda, água) precisam.",
      },
    ],
    "16-3": [
      {
        q: "Numa onda transversal numa corda, como se movem os elementos da corda?",
        options: ["Na direção de propagação", "Perpendicularmente à direção de propagação", "Junto com a onda até o fim da corda", "Em círculos sempre"],
        answer: 1,
        why: "Na onda transversal os elementos oscilam perpendicularmente à propagação; na longitudinal (som), oscilam na mesma direção. A onda leva energia, não a matéria.",
      },
    ],
    "16-4": [
      {
        q: "Uma onda tem $y = 0{,}02\\,\\text{sen}(5x - 20t)$ (SI). Qual é o comprimento de onda?",
        options: ["5 m", "$2\\pi/5 \\approx 1{,}26$ m", "0,02 m", "$5/2\\pi$ m"],
        answer: 1,
        why: "O número de onda é $k = 5$ rad/m e $\\lambda = 2\\pi/k$. Do termo $20t$ sai $\\omega = 20$ rad/s.",
      },
    ],
    "16-5": [
      {
        q: "Para a onda $y = y_m\\,\\text{sen}(kx - \\omega t)$, qual é a velocidade de propagação?",
        options: ["$\\omega k$", "$\\omega/k$", "$k/\\omega$", "$y_m\\omega$"],
        answer: 1,
        why: "$v = \\omega/k = \\lambda f$. Já $y_m\\omega$ é a velocidade máxima de um elemento da corda, que é outra coisa.",
      },
    ],
    "16-6": [
      {
        q: "Para dobrar a velocidade de uma onda numa corda, a tensão precisa ser multiplicada por:",
        options: ["2", "4", "$\\sqrt2$", "8"],
        answer: 1,
        why: "$v = \\sqrt{\\tau/\\mu}$: a velocidade cresce com a raiz da tensão. Ela depende do meio, não da frequência ou da amplitude.",
      },
    ],
    "16-7": [
      {
        q: "Se a amplitude de uma onda numa corda dobra (mesma frequência), a potência transmitida:",
        options: ["Dobra", "Quadruplica", "Fica igual", "Cai à metade"],
        answer: 1,
        why: "$P = \\tfrac12\\mu v\\omega^2 y_m^2$: a potência cresce com o quadrado da amplitude e também com o quadrado da frequência.",
      },
    ],
    "16-8": [
      {
        q: "Qual é a equação de onda linear em uma dimensão?",
        options: ["$\\partial^2y/\\partial x^2 = (1/v^2)\\,\\partial^2y/\\partial t^2$", "$\\partial y/\\partial t = v\\,\\partial y/\\partial x$ apenas", "$y = vt$", "$\\partial^2y/\\partial t^2 = 0$"],
        answer: 0,
        why: "Ela vem da segunda lei de Newton aplicada a um pedaço de corda. Qualquer função de $x \\pm vt$ é solução.",
      },
    ],
    "16-9": [
      {
        q: "Dois pulsos que se propagam em sentidos opostos numa corda se cruzam. O que acontece depois?",
        options: ["Eles se anulam para sempre", "Cada um segue com a forma original, como se o outro não existisse", "Eles se refletem um no outro", "Viram um só pulso maior"],
        answer: 1,
        why: "Pelo princípio da superposição, no cruzamento os deslocamentos se somam, mas depois cada pulso continua inalterado.",
      },
    ],
    "16-10": [
      {
        q: "Duas ondas iguais se superpõem com diferença de fase de $\\pi$ rad. A amplitude resultante é:",
        options: ["O dobro", "Zero", "Igual à de uma onda", "$\\sqrt2$ vezes a de uma onda"],
        answer: 1,
        why: "$y_m' = 2y_m|\\cos(\\phi/2)| = 0$ para $\\phi = \\pi$: interferência totalmente destrutiva.",
      },
    ],
    "16-11": [
      {
        q: "Como se acha a amplitude da soma de duas ondas de mesma frequência com fasores?",
        options: ["Somando as amplitudes como números", "Somando os fasores como vetores girantes e medindo o comprimento do resultado", "Multiplicando as amplitudes", "Pela média das amplitudes"],
        answer: 1,
        why: "Cada onda vira um vetor de comprimento $y_m$ e ângulo igual à fase; a soma vetorial dá a amplitude e a fase da onda resultante.",
      },
    ],
    "16-12": [
      {
        q: "Numa onda estacionária, qual é a distância entre dois nós vizinhos?",
        options: ["$\\lambda$", "$\\lambda/2$", "$\\lambda/4$", "$2\\lambda$"],
        answer: 1,
        why: "Os nós ficam em $kx = n\\pi$, separados por meio comprimento de onda; os antinós ficam no meio deles.",
      },
    ],
    "16-13": [
      {
        q: "Uma corda de 1 m, presa nas duas pontas, tem ondas a 100 m/s. Qual é a frequência fundamental?",
        options: ["100 Hz", "50 Hz", "200 Hz", "25 Hz"],
        answer: 1,
        why: "No modo fundamental $\\lambda = 2L = 2$ m e $f = v/\\lambda = 50$ Hz. Os harmônicos são múltiplos inteiros: 100, 150, … Hz.",
      },
    ],
  },
};
