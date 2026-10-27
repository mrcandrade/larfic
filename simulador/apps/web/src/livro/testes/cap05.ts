import type { ChapterChecks } from "../testes.ts";

export const testes: ChapterChecks = {
  n: 5,
  sections: {
    "5-2": [
      {
        q: "Em qual situação a mecânica newtoniana deixa de dar boas previsões?",
        options: ["Um carro a 120 km/h numa curva", "Um elétron dentro de um átomo", "Um satélite em órbita baixa", "Uma bola de futebol chutada com efeito"],
        answer: 1,
        why: "Em escala atômica é preciso a mecânica quântica (e, perto da velocidade da luz, a relatividade). Nos outros casos a mecânica de Newton é excelente.",
      },
    ],
    "5-3": [
      {
        q: "Um disco de hóquei desliza sobre gelo sem atrito a velocidade constante. O que se pode afirmar?",
        options: ["Há uma força constante empurrando o disco para a frente", "A força resultante sobre ele é nula", "A força resultante aponta para a frente, mas é pequena", "O disco vai parar sozinho porque a força se esgota"],
        answer: 1,
        why: "Pela primeira lei, velocidade constante significa resultante nula. Não é preciso força para manter o movimento, só para mudá-lo.",
      },
    ],
    "5-4": [
      {
        q: "Duas forças de 3 N e 4 N, perpendiculares, agem num corpo. Qual é o módulo da força resultante?",
        options: ["7 N", "1 N", "5 N", "12 N"],
        answer: 2,
        why: "Forças são vetores e se somam como vetores: $\\sqrt{3^2 + 4^2} = 5$ N.",
      },
    ],
    "5-5": [
      {
        q: "Um astronauta leva uma caixa de 20 kg da Terra para a Lua. O que muda?",
        options: ["A massa e o peso", "Só a massa", "Só o peso", "Nada"],
        answer: 2,
        why: "A massa (inércia) é a mesma em qualquer lugar; o peso $mg$ cai para cerca de 1/6 na Lua. Empurrar a caixa horizontalmente exige a mesma força lá e aqui.",
      },
    ],
    "5-6": [
      {
        q: "Uma força resultante de 12 N age num bloco de 4 kg. Qual é a aceleração?",
        options: ["48 m/s²", "3 m/s²", "0,33 m/s²", "16 m/s²"],
        answer: 1,
        why: "$a = F_{res}/m = 12/4 = 3$ m/s², na direção e sentido da força resultante.",
      },
    ],
    "5-7": [
      {
        q: "Você está num elevador que acelera para cima. Comparada ao seu peso, a força normal do piso é:",
        options: ["Maior", "Igual", "Menor", "Zero"],
        answer: 0,
        why: "$N - mg = ma$ com $a$ para cima dá $N = m(g + a) > mg$: a balança marca mais. A normal não é sempre igual ao peso.",
      },
    ],
    "5-8": [
      {
        q: "Um caminhão bate de frente num carro pequeno. Qual força é maior durante a batida?",
        options: ["A do caminhão sobre o carro", "A do carro sobre o caminhão", "São iguais em módulo", "Depende das velocidades"],
        answer: 2,
        why: "É um par ação–reação: forças iguais e opostas, em corpos diferentes. O carro sofre aceleração maior porque tem massa menor, não porque leva uma força maior.",
      },
      {
        q: "Um livro repousa sobre a mesa. Qual é o par de reação do peso do livro?",
        options: ["A força normal da mesa sobre o livro", "A força gravitacional do livro sobre a Terra", "A força do livro sobre a mesa", "Não há par de reação"],
        answer: 1,
        why: "O peso é a Terra puxando o livro; a reação é o livro puxando a Terra. A normal também equilibra o peso, mas as duas agem no mesmo corpo e não formam um par de terceira lei.",
      },
    ],
    "5-9": [
      {
        q: "Dois blocos de 2 kg e 3 kg estão encostados numa mesa sem atrito. Você empurra o de 2 kg com 10 N. Qual força o bloco de 2 kg faz no de 3 kg?",
        options: ["10 N", "6 N", "4 N", "2 N"],
        answer: 1,
        why: "O conjunto acelera $a = 10/5 = 2$ m/s²; o bloco de 3 kg só recebe a força de contato: $3\\cdot 2 = 6$ N.",
      },
    ],
  },
};
