import type { ChapterChecks } from "../testes.ts";

export const testes: ChapterChecks = {
  n: 15,
  sections: {
    "15-2": [
      {
        q: "Num MHS com $x(t) = 0{,}1\\cos(4t)$ (SI), qual é a amplitude e a frequência angular?",
        options: ["0,1 m e 4 rad/s", "4 m e 0,1 rad/s", "0,1 m e $4\\pi$ rad/s", "0,4 m e 4 rad/s"],
        answer: 0,
        why: "Na forma $x_m\\cos(\\omega t + \\phi)$, a amplitude é 0,1 m e $\\omega = 4$ rad/s (período $2\\pi/4 \\approx 1{,}57$ s).",
      },
      {
        q: "Num MHS, onde a aceleração tem módulo máximo?",
        options: ["Na posição de equilíbrio", "Nos extremos do movimento", "É constante", "Onde a velocidade é máxima"],
        answer: 1,
        why: "$a = -\\omega^2 x$: a aceleração é máxima onde o deslocamento é máximo, justamente onde a velocidade se anula.",
      },
    ],
    "15-3": [
      {
        q: "Um bloco preso a uma mola oscila com período $T$. Se a massa for quadruplicada, o novo período será:",
        options: ["$T/2$", "$2T$", "$4T$", "$T$"],
        answer: 1,
        why: "$T = 2\\pi\\sqrt{m/k}$: quadruplicar $m$ dobra o período. A amplitude não entra na conta.",
      },
    ],
    "15-4": [
      {
        q: "Num oscilador massa–mola sem atrito, quando a energia cinética é igual à potencial, o deslocamento vale:",
        options: ["$x_m/2$", "$x_m/\\sqrt2$", "$x_m$", "0"],
        answer: 1,
        why: "Se $U = K$, cada uma é metade da total: $\\tfrac12kx^2 = \\tfrac14kx_m^2$, logo $x = x_m/\\sqrt2 \\approx 0{,}71\\,x_m$.",
      },
    ],
    "15-5": [
      {
        q: "Num pêndulo de torção, o que faz o papel da constante de mola?",
        options: ["A massa do disco", "A constante de torção $\\kappa$ do fio, em $\\tau = -\\kappa\\theta$", "O comprimento do fio só", "A gravidade"],
        answer: 1,
        why: "O fio torcido produz um torque restaurador proporcional ao ângulo, e o período fica $T = 2\\pi\\sqrt{I/\\kappa}$.",
      },
    ],
    "15-6": [
      {
        q: "Um relógio de pêndulo calibrado em Porto Alegre é levado à Lua. Ele vai:",
        options: ["Adiantar", "Atrasar", "Continuar certo", "Parar de oscilar"],
        answer: 1,
        why: "$T = 2\\pi\\sqrt{L/g}$ cresce quando $g$ diminui: cada oscilação demora mais e o relógio atrasa.",
      },
    ],
    "15-7": [
      {
        q: "O MHS pode ser visto como a projeção de qual movimento?",
        options: ["Um movimento retilíneo uniforme", "Um movimento circular uniforme sobre um diâmetro", "Uma queda livre", "Um lançamento oblíquo"],
        answer: 1,
        why: "A sombra de um ponto em MCU num diâmetro segue $x = R\\cos(\\omega t + \\phi)$, com o mesmo $\\omega$ do círculo.",
      },
    ],
    "15-8": [
      {
        q: "Num oscilador fracamente amortecido, o que acontece com a amplitude?",
        options: ["Cai linearmente com o tempo", "Cai exponencialmente, com $e^{-bt/2m}$", "Fica constante", "Cresce"],
        answer: 1,
        why: "A força de arrasto $-bv$ tira energia a cada ciclo, e a envoltória da oscilação decai como $x_m e^{-bt/2m}$.",
      },
    ],
    "15-9": [
      {
        q: "Quando a amplitude de um oscilador forçado é máxima (pouco amortecimento)?",
        options: ["Quando a frequência da força é muito alta", "Quando a frequência da força está perto da frequência natural", "Quando a frequência da força é zero", "Sempre na mesma amplitude"],
        answer: 1,
        why: "É a ressonância: com $\\omega_d \\approx \\omega$, a força entra em fase com a velocidade e injeta energia a cada ciclo.",
      },
    ],
  },
};
