import type { ChapterChecks } from "../testes.ts";

export const testes: ChapterChecks = {
  n: 4,
  sections: {
    "4-2": [
      {
        q: "Uma partícula vai de $\\vec r_1 = (2\\hat i + 3\\hat j)$ m para $\\vec r_2 = (5\\hat i - \\hat j)$ m. Qual é o deslocamento?",
        options: ["$(3\\hat i - 4\\hat j)$ m", "$(7\\hat i + 2\\hat j)$ m", "$(-3\\hat i + 4\\hat j)$ m", "5 m"],
        answer: 0,
        why: "$\\Delta\\vec r = \\vec r_2 - \\vec r_1 = (5-2)\\hat i + (-1-3)\\hat j$. O módulo é 5 m, mas o deslocamento é um vetor.",
      },
    ],
    "4-3": [
      {
        q: "Como é a velocidade instantânea em relação à trajetória da partícula?",
        options: ["Sempre tangente à trajetória, no sentido do movimento", "Sempre perpendicular à trajetória", "Sempre apontando para a origem", "Paralela à aceleração"],
        answer: 0,
        why: "No limite de intervalos curtos, o deslocamento fica ao longo da trajetória, e $\\vec v = d\\vec r/dt$ herda essa direção.",
      },
    ],
    "4-4": [
      {
        q: "Um carro faz uma curva com velocidade escalar constante. Ele está acelerado?",
        options: ["Não, porque a velocidade escalar não muda", "Sim, porque a direção da velocidade muda", "Só se a curva for fechada", "Só se houver atrito"],
        answer: 1,
        why: "Aceleração é a taxa de variação do vetor velocidade, e mudar a direção já é mudar o vetor.",
      },
    ],
    "4-5": [
      {
        q: "Num lançamento oblíquo sem resistência do ar, o que se mantém constante durante o voo?",
        options: ["A componente vertical da velocidade", "A componente horizontal da velocidade", "A velocidade escalar", "A direção da velocidade"],
        answer: 1,
        why: "A única aceleração é $g$, vertical. A componente horizontal não sofre aceleração e fica igual a $v_0\\cos\\theta_0$.",
      },
    ],
    "4-6": [
      {
        q: "Desprezando o ar, dois projéteis são lançados com a mesma velocidade, a 30° e a 60°. O que se pode dizer dos alcances?",
        options: ["O de 60° vai mais longe", "O de 30° vai mais longe", "São iguais", "Depende da massa"],
        answer: 2,
        why: "$R = v_0^2\\,\\text{sen}\\,2\\theta_0/g$ e $\\text{sen}\\,60° = \\text{sen}\\,120°$. Ângulos complementares dão o mesmo alcance; o de 60° sobe mais e demora mais.",
      },
    ],
    "4-7": [
      {
        q: "Uma pedra gira num círculo de 0,5 m de raio a 2 m/s. Qual é a aceleração centrípeta?",
        options: ["1 m/s²", "4 m/s²", "8 m/s²", "2 m/s²"],
        answer: 2,
        why: "$a = v^2/r = 4/0{,}5 = 8$ m/s², apontando para o centro.",
      },
    ],
    "4-8": [
      {
        q: "Num trem a 20 m/s, um passageiro anda para a frente a 1,5 m/s em relação ao vagão. Qual a velocidade dele em relação aos trilhos?",
        options: ["18,5 m/s", "21,5 m/s", "20 m/s", "1,5 m/s"],
        answer: 1,
        why: "Em uma dimensão, as velocidades relativas se somam com sinal: $v_{PT} = v_{PV} + v_{VT} = 1{,}5 + 20$.",
      },
    ],
    "4-9": [
      {
        q: "Um barco aponta perpendicularmente à margem com 3 m/s em relação à água, e o rio corre a 4 m/s. Qual a velocidade do barco em relação à margem?",
        options: ["7 m/s", "1 m/s", "5 m/s", "3 m/s"],
        answer: 2,
        why: "As velocidades são perpendiculares: $\\sqrt{3^2 + 4^2} = 5$ m/s, inclinada rio abaixo. O tempo de travessia continua dado só pelos 3 m/s.",
      },
    ],
  },
};
