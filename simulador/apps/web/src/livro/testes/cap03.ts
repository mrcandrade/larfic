import type { ChapterChecks } from "../testes.ts";

export const testes: ChapterChecks = {
  n: 3,
  sections: {
    "3-2": [
      {
        q: "Qual destas grandezas é vetorial?",
        options: ["Temperatura", "Massa", "Deslocamento", "Energia"],
        answer: 2,
        why: "O deslocamento tem módulo, direção e sentido e se soma pela regra dos vetores. Temperatura, massa e energia ficam totalmente descritas por um número com unidade.",
      },
    ],
    "3-3": [
      {
        q: "Dois vetores têm módulos 3 e 4. Qual destes valores NÃO pode ser o módulo da soma?",
        options: ["1", "5", "7", "8"],
        answer: 3,
        why: "O módulo da soma fica entre $|4-3| = 1$ (sentidos opostos) e $4+3 = 7$ (mesmo sentido). O valor 5 aparece quando eles são perpendiculares.",
      },
    ],
    "3-4": [
      {
        q: "Um vetor de módulo 10 faz 30° com o eixo $x$ positivo. Quanto vale a componente $y$?",
        options: ["8,66", "5,0", "10", "−5,0"],
        answer: 1,
        why: "$a_y = a\\,\\text{sen}\\,\\theta = 10\\cdot 0{,}5 = 5$. O cosseno vai na componente do eixo a partir do qual o ângulo é medido.",
      },
    ],
    "3-5": [
      {
        q: "Qual é o módulo do vetor $2\\hat{i} - 2\\hat{j} + \\hat{k}$?",
        options: ["1", "3", "5", "9"],
        answer: 1,
        why: "$\\sqrt{2^2 + (-2)^2 + 1^2} = \\sqrt9 = 3$. Somar as componentes (dá 1) não é o módulo.",
      },
    ],
    "3-6": [
      {
        q: "Quanto vale $(3\\hat{i} + \\hat{j}) + (-1\\hat{i} + 4\\hat{j})$?",
        options: ["$2\\hat{i} + 5\\hat{j}$", "$4\\hat{i} + 5\\hat{j}$", "$2\\hat{i} + 3\\hat{j}$", "$-3\\hat{i} + 4\\hat{j}$"],
        answer: 0,
        why: "Some componente a componente: $3 + (-1) = 2$ em $x$ e $1 + 4 = 5$ em $y$.",
      },
    ],
    "3-7": [
      {
        q: "Se você gira os eixos coordenados, o que acontece com um vetor deslocamento?",
        options: ["Muda o módulo", "As componentes mudam, mas o vetor (módulo, direção e sentido no espaço) é o mesmo", "Nada muda, nem as componentes", "O vetor gira junto com os eixos"],
        answer: 1,
        why: "As leis da física não dependem da escolha dos eixos: só a descrição em componentes muda. O módulo, por exemplo, é o mesmo em qualquer sistema.",
      },
    ],
    "3-8": [
      {
        q: "Se $\\vec a\\cdot\\vec b = 0$ e nenhum dos vetores é nulo, o que se conclui?",
        options: ["Eles são paralelos", "Eles são perpendiculares", "Eles têm o mesmo módulo", "$\\vec a\\times\\vec b$ também é nulo"],
        answer: 1,
        why: "$\\vec a\\cdot\\vec b = ab\\cos\\phi$ só é zero se $\\cos\\phi = 0$, isto é, $\\phi = 90°$. Nesse caso o produto vetorial tem módulo máximo, $ab$.",
      },
      {
        q: "Quanto vale $\\hat{j}\\times\\hat{i}$?",
        options: ["$\\hat{k}$", "$-\\hat{k}$", "0", "1"],
        answer: 1,
        why: "Pela regra da mão direita $\\hat i\\times\\hat j = \\hat k$, e o produto vetorial troca de sinal ao inverter a ordem: $\\hat j\\times\\hat i = -\\hat k$.",
      },
    ],
  },
};
