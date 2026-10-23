import type { ChapterChecks } from "../testes.ts";

export const testes: ChapterChecks = {
  n: 37,
  sections: {
    "37-2": [
      {
        q: "Uma nave a $0{,}5c$ acende um farol para a frente. Com que velocidade a luz do farol se move em relação a um observador na Terra?",
        options: ["$1{,}5c$", "$c$", "$0{,}5c$", "$0{,}75c$"],
        answer: 1,
        why: "É o segundo postulado: a velocidade da luz no vácuo é $c$ para qualquer referencial inercial, qualquer que seja o movimento da fonte.",
      },
    ],
    "37-3": [
      {
        q: "Para registrar o instante de um evento distante num referencial, o que se usa na relatividade?",
        options: ["O relógio do observador, somando o atraso que ele acha que a luz teve", "Um relógio sincronizado no próprio local do evento", "Um relógio qualquer", "O relógio mais rápido disponível"],
        answer: 1,
        why: "Imagina-se uma grade de réguas e relógios sincronizados em todo o referencial; cada evento é registrado pelo relógio que está ali.",
      },
    ],
    "37-4": [
      {
        q: "Dois eventos são simultâneos para um observador e acontecem em lugares diferentes. Para outro observador em movimento relativo ao longo da linha dos eventos, eles são:",
        options: ["Também simultâneos", "Em geral não simultâneos", "Sempre o mesmo evento", "Impossíveis"],
        answer: 1,
        why: "A simultaneidade de eventos separados no espaço depende do referencial. Só eventos no mesmo lugar e instante são simultâneos para todos.",
      },
    ],
    "37-5": [
      {
        q: "Múons com vida própria de 2,2 μs movem-se a $0{,}99c$ ($\\gamma \\approx 7$). Que vida média se mede no laboratório?",
        options: ["2,2 μs", "15,6 μs", "0,31 μs", "2,18 μs"],
        answer: 1,
        why: "$\\Delta t = \\gamma\\,\\Delta t_0 \\approx 7{,}09\\cdot2{,}2$ μs. É por isso que tantos múons criados no alto da atmosfera chegam ao solo.",
      },
    ],
    "37-6": [
      {
        q: "Uma régua de 1 m passa por você a $0{,}6c$, alinhada com o movimento ($\\gamma = 1{,}25$). Que comprimento você mede?",
        options: ["1,25 m", "0,8 m", "0,6 m", "1 m"],
        answer: 1,
        why: "$L = L_0/\\gamma = 0{,}8$ m. A contração só ocorre na direção do movimento.",
      },
    ],
    "37-7": [
      {
        q: "Para velocidades muito menores que $c$, a transformação de Lorentz se reduz a:",
        options: ["Nada útil", "A transformação de Galileu, $x' = x - vt$ e $t' = t$", "$x' = \\gamma x$", "$t' = 0$"],
        answer: 1,
        why: "Com $v/c \\to 0$, $\\gamma \\to 1$ e o termo $vx/c^2$ some: a física de Newton é o limite de baixas velocidades.",
      },
    ],
    "37-8": [
      {
        q: "Dois eventos têm intervalo do tipo tempo (podem ser ligados por um sinal mais lento que a luz). Pode a ordem deles se inverter em outro referencial?",
        options: ["Sim, sempre", "Não: a ordem de eventos causalmente ligáveis é a mesma para todos", "Só se forem simultâneos", "Só a altas temperaturas"],
        answer: 1,
        why: "Só eventos separados por intervalo do tipo espaço podem ter a ordem invertida, e nenhum deles pode causar o outro.",
      },
    ],
    "37-9": [
      {
        q: "Uma nave a $0{,}8c$ dispara para a frente uma sonda a $0{,}8c$ em relação à nave. Qual a velocidade da sonda na Terra?",
        options: ["$1{,}6c$", "$\\approx 0{,}98c$", "$c$", "$0{,}8c$"],
        answer: 1,
        why: "$u = (u' + v)/(1 + u'v/c^2) = 1{,}6c/1{,}64 \\approx 0{,}976c$: a soma nunca passa de $c$.",
      },
    ],
    "37-10": [
      {
        q: "Uma galáxia se afasta de nós. As linhas espectrais dela aparecem:",
        options: ["Deslocadas para o azul", "Deslocadas para o vermelho (comprimentos de onda maiores)", "Sem deslocamento", "Mais intensas"],
        answer: 1,
        why: "No efeito Doppler da luz, o afastamento reduz a frequência observada: $f = f_0\\sqrt{(1 - \\beta)/(1 + \\beta)}$.",
      },
    ],
    "37-11": [
      {
        q: "Por que o momento relativístico é $p = \\gamma mv$ e não $mv$?",
        options: ["Por convenção", "Para que o momento total se conserve nas colisões em todos os referenciais inerciais", "Porque a massa aumenta de verdade", "Para simplificar as contas"],
        answer: 1,
        why: "Com $mv$, a conservação do momento falharia em referenciais diferentes quando aplicamos a transformação de Lorentz.",
      },
    ],
    "37-12": [
      {
        q: "Qual é a energia de repouso de 1 g de matéria?",
        options: ["$9\\times10^{13}$ J", "$3\\times10^{5}$ J", "$9\\times10^{16}$ J", "1 J"],
        answer: 0,
        why: "$E_0 = mc^2 = 10^{-3}\\cdot(3\\times10^8)^2 = 9\\times10^{13}$ J, a energia de uma bomba de cerca de 20 quilotons.",
      },
    ],
  },
};
