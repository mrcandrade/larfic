import type { ChapterChecks } from "../testes.ts";

export const testes: ChapterChecks = {
  n: 10,
  sections: {
    "10-2": [
      {
        q: "Um disco gira a 120 rpm. Qual é a velocidade angular em rad/s?",
        options: ["2 rad/s", "$4\\pi$ rad/s", "120 rad/s", "$2\\pi$ rad/s"],
        answer: 1,
        why: "120 rotações por minuto são 2 por segundo, e cada rotação vale $2\\pi$ rad: $\\omega = 4\\pi \\approx 12{,}6$ rad/s.",
      },
    ],
    "10-3": [
      {
        q: "Por que rotações finitas não podem ser tratadas como vetores?",
        options: ["Porque não têm módulo", "Porque a ordem importa: girar 90° em x e depois em y dá um resultado diferente da ordem inversa", "Porque são sempre no plano", "Porque são grandezas escalares"],
        answer: 1,
        why: "Vetores somam de forma comutativa, e rotações finitas não comutam. Já a velocidade angular (rotações infinitesimais) se comporta como vetor.",
      },
    ],
    "10-4": [
      {
        q: "Uma roda parte do repouso com $\\alpha = 2$ rad/s². Quantos radianos ela gira em 3 s?",
        options: ["6 rad", "9 rad", "18 rad", "3 rad"],
        answer: 1,
        why: "É a mesma forma do movimento retilíneo: $\\theta = \\tfrac12\\alpha t^2 = \\tfrac12\\cdot2\\cdot9 = 9$ rad.",
      },
    ],
    "10-5": [
      {
        q: "Num carrossel que gira com $\\omega$ constante, uma criança sentada na borda e outra perto do centro têm:",
        options: ["A mesma velocidade linear", "A mesma velocidade angular, mas a da borda tem velocidade linear maior", "A da borda tem velocidade angular maior", "As duas têm aceleração nula"],
        answer: 1,
        why: "Todos os pontos de um corpo rígido têm o mesmo $\\omega$, e $v = \\omega r$ cresce com a distância ao eixo. A aceleração centrípeta $\\omega^2 r$ também.",
      },
    ],
    "10-6": [
      {
        q: "Um cilindro maciço e um anel com mesma massa e raio giram com o mesmo $\\omega$. Qual tem mais energia cinética?",
        options: ["O cilindro", "O anel", "Os dois têm a mesma", "Depende do material"],
        answer: 1,
        why: "$K = \\tfrac12 I\\omega^2$ e o anel tem toda a massa longe do eixo: $I = MR^2$ contra $\\tfrac12 MR^2$ do cilindro.",
      },
    ],
    "10-7": [
      {
        q: "Uma barra de massa $M$ e comprimento $L$ tem $I = ML^2/12$ em torno do centro. Qual é o momento de inércia em torno de uma ponta?",
        options: ["$ML^2/12$", "$ML^2/3$", "$ML^2/4$", "$ML^2$"],
        answer: 1,
        why: "Pelo teorema dos eixos paralelos, $I = I_{CM} + Md^2 = ML^2/12 + M(L/2)^2 = ML^2/3$.",
      },
    ],
    "10-8": [
      {
        q: "Para afrouxar um parafuso, onde e como você aplica a força na chave para ter o maior torque?",
        options: ["Perto do parafuso, ao longo da chave", "Na ponta da chave, perpendicular a ela", "Na ponta da chave, ao longo dela", "Em qualquer lugar: o torque só depende da força"],
        answer: 1,
        why: "$\\tau = rF\\,\\text{sen}\\,\\phi$: o maior braço $r$ e a força perpendicular ($\\phi = 90°$) maximizam o torque. Força ao longo da chave não gira nada.",
      },
    ],
    "10-9": [
      {
        q: "Um torque de 6 N·m age numa roda com $I = 2$ kg·m². Qual é a aceleração angular?",
        options: ["12 rad/s²", "3 rad/s²", "0,33 rad/s²", "8 rad/s²"],
        answer: 1,
        why: "$\\tau = I\\alpha$, então $\\alpha = 6/2 = 3$ rad/s². É a versão rotacional de $F = ma$.",
      },
    ],
    "10-10": [
      {
        q: "Um torque constante de 4 N·m gira uma roda de 5 rad. Quanto trabalho ele realiza?",
        options: ["0,8 J", "20 J", "9 J", "1,25 J"],
        answer: 1,
        why: "$W = \\tau\\,\\Delta\\theta = 4\\cdot5 = 20$ J, que vai para a energia cinética de rotação.",
      },
    ],
  },
};
