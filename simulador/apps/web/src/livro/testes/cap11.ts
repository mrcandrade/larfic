import type { ChapterChecks } from "../testes.ts";

export const testes: ChapterChecks = {
  n: 11,
  sections: {
    "11-2": [
      {
        q: "Uma roda rola sem deslizar a 10 m/s. Qual é a velocidade do ponto mais alto em relação ao chão?",
        options: ["10 m/s", "20 m/s", "0", "5 m/s"],
        answer: 1,
        why: "O topo soma a translação do centro ($v$) com a velocidade de rotação ($\\omega R = v$): $2v$. O ponto de contato fica momentaneamente parado.",
      },
    ],
    "11-3": [
      {
        q: "Uma esfera maciça e um aro de mesma massa e raio descem a mesma rampa rolando sem deslizar. Quem chega primeiro?",
        options: ["O aro", "A esfera", "Chegam juntos", "Depende da massa"],
        answer: 1,
        why: "O aro põe mais energia em rotação ($I = MR^2$) e sobra menos para a translação. A esfera ($I = \\tfrac25 MR^2$) vence, qualquer que seja a massa ou o raio.",
      },
    ],
    "11-4": [
      {
        q: "Num rolamento sem deslizamento numa rampa, o atrito estático no ponto de contato:",
        options: ["Dissipa energia mecânica", "Não realiza trabalho, porque o ponto de contato não se move", "Acelera o centro de massa rampa abaixo", "É sempre igual a $\\mu_s N$"],
        answer: 1,
        why: "O atrito estático produz o torque que faz a roda girar, mas age num ponto parado no instante do contato e não dissipa energia.",
      },
    ],
    "11-5": [
      {
        q: "Um ioiô desce pelo fio. Comparada com a de uma pedra em queda livre, a aceleração dele é:",
        options: ["Maior", "Igual a $g$", "Menor", "Zero"],
        answer: 2,
        why: "A tração no fio age para cima e boa parte da energia vai para a rotação. Com eixo fino ($R_0 \\ll R$) a aceleração $g/(1 + I/MR_0^2)$ fica bem menor que $g$.",
      },
    ],
    "11-6": [
      {
        q: "O torque é um vetor. Qual a direção de $\\vec\\tau = \\vec r\\times\\vec F$ para $\\vec r$ em $+x$ e $\\vec F$ em $+y$?",
        options: ["$+x$", "$+y$", "$+z$", "$-z$"],
        answer: 2,
        why: "$\\hat i\\times\\hat j = \\hat k$: o torque é perpendicular ao plano de $\\vec r$ e $\\vec F$, pela regra da mão direita.",
      },
    ],
    "11-7": [
      {
        q: "Uma partícula se move em linha reta, sem passar pela origem. Ela tem momento angular em relação à origem?",
        options: ["Não, porque não está girando", "Sim: $\\ell = r_\\perp p$, constante se $p$ for constante", "Só quando cruza o eixo $x$", "Só se a trajetória for curva"],
        answer: 1,
        why: "$\\vec\\ell = \\vec r\\times\\vec p$ não exige trajetória curva: basta a reta não passar pela origem. O braço $r_\\perp$ é a distância da origem à reta.",
      },
    ],
    "11-8": [
      {
        q: "Qual é a forma rotacional da segunda lei de Newton para uma partícula?",
        options: ["$\\vec\\tau = d\\vec\\ell/dt$", "$\\vec\\tau = m\\vec a$", "$\\vec\\ell = I\\vec\\tau$", "$\\vec F = d\\vec\\ell/dt$"],
        answer: 0,
        why: "Assim como $\\vec F = d\\vec p/dt$, o torque resultante é a taxa de variação do momento angular, ambos em relação ao mesmo ponto.",
      },
    ],
    "11-9": [
      {
        q: "O que muda o momento angular total de um sistema de partículas?",
        options: ["Os torques internos entre as partículas", "Só o torque externo resultante", "Qualquer força, interna ou externa", "Nada: ele é sempre constante"],
        answer: 1,
        why: "Os torques internos se cancelam aos pares; só torques externos alteram $\\vec L$ do sistema.",
      },
    ],
    "11-10": [
      {
        q: "Um volante com $I = 3$ kg·m² gira a 4 rad/s. Qual é o momento angular?",
        options: ["0,75 kg·m²/s", "12 kg·m²/s", "24 kg·m²/s", "48 kg·m²/s"],
        answer: 1,
        why: "Para um corpo rígido girando em torno de um eixo fixo, $L = I\\omega = 3\\cdot4 = 12$ kg·m²/s.",
      },
    ],
    "11-11": [
      {
        q: "Uma patinadora girando fecha os braços e reduz o momento de inércia à metade. O que acontece com $\\omega$ e com a energia cinética?",
        options: ["$\\omega$ dobra e a energia fica igual", "$\\omega$ dobra e a energia dobra", "$\\omega$ fica igual e a energia dobra", "$\\omega$ cai à metade e a energia cai"],
        answer: 1,
        why: "$L = I\\omega$ se conserva, então $\\omega$ dobra; $K = L^2/2I$ dobra. A energia extra vem do trabalho dos músculos ao puxar os braços.",
      },
    ],
    "11-12": [
      {
        q: "Num giroscópio apoiado numa ponta, se o rotor girar mais depressa, a precessão fica:",
        options: ["Mais rápida", "Mais lenta", "Igual", "Para de acontecer"],
        answer: 1,
        why: "$\\Omega = Mgr/(I\\omega)$: com mais momento angular, o mesmo torque do peso muda a direção de $\\vec L$ mais devagar.",
      },
    ],
  },
};
