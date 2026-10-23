import type { ChapterChecks } from "../testes.ts";

export const testes: ChapterChecks = {
  n: 38,
  sections: {
    "38-2": [
      {
        q: "Qual fóton tem mais energia?",
        options: ["Um de luz vermelha", "Um de luz azul", "Um de micro-ondas", "Um de onda de rádio"],
        answer: 1,
        why: "$E = hf = hc/\\lambda$: menor comprimento de onda, maior energia. Um fóton azul (450 nm) tem cerca de 2,8 eV.",
      },
    ],
    "38-3": [
      {
        q: "No efeito fotoelétrico, aumentar a intensidade da luz (mesma frequência, acima do limiar) faz:",
        options: ["Aumentar a energia cinética máxima dos elétrons", "Aumentar o número de elétrons emitidos, sem mudar a energia máxima", "Diminuir a frequência de corte", "Nada"],
        answer: 1,
        why: "Mais intensidade é mais fótons, não fótons mais energéticos. $K_{máx} = hf - \\Phi$ só depende da frequência.",
      },
    ],
    "38-4": [
      {
        q: "No efeito Compton, o fóton espalhado tem comprimento de onda:",
        options: ["Menor que o incidente", "Maior que o incidente", "Igual", "Zero"],
        answer: 1,
        why: "O fóton cede energia e momento ao elétron: $\\Delta\\lambda = (h/mc)(1 - \\cos\\phi) \\ge 0$.",
      },
    ],
    "38-5": [
      {
        q: "No experimento de fenda dupla com um fóton de cada vez, o que se observa depois de muitos fótons?",
        options: ["Duas faixas, uma atrás de cada fenda", "O padrão de interferência, formado ponto a ponto", "Uma mancha uniforme", "Nada"],
        answer: 1,
        why: "Cada fóton chega num ponto, mas a probabilidade de chegada segue a intensidade da onda: a interferência emerge da estatística.",
      },
    ],
    "38-6": [
      {
        q: "Qual é o comprimento de onda de de Broglie de um elétron acelerado por 150 V (cerca de 0,1 nm)? O que isso permite?",
        options: ["Vê-lo a olho nu", "Difração em cristais, cujo espaçamento entre átomos é dessa ordem", "Nada observável", "Ondas de rádio"],
        answer: 1,
        why: "$\\lambda = h/p \\approx 0{,}1$ nm; Davisson e Germer observaram a difração de elétrons num cristal de níquel.",
      },
    ],
    "38-7": [
      {
        q: "O que representa $|\\psi(x)|^2$?",
        options: ["A energia da partícula", "A densidade de probabilidade de encontrar a partícula em $x$", "A trajetória da partícula", "A carga da partícula"],
        answer: 1,
        why: "A função de onda em si não é observável; o quadrado do módulo dá a probabilidade por unidade de comprimento.",
      },
    ],
    "38-8": [
      {
        q: "Se a posição de um elétron é determinada com mais precisão, o que acontece com a incerteza do momento?",
        options: ["Diminui também", "Aumenta, pois $\\Delta x\\,\\Delta p \\gtrsim \\hbar$", "Fica igual", "Vai a zero"],
        answer: 1,
        why: "É uma propriedade das ondas, não do aparelho: um pacote mais estreito precisa de mais comprimentos de onda.",
      },
    ],
    "38-9": [
      {
        q: "Se a barreira de potencial fica mais larga, a probabilidade de tunelamento:",
        options: ["Aumenta", "Cai exponencialmente", "Fica igual", "Vai a 1"],
        answer: 1,
        why: "$T \\approx e^{-2bL}$: cada nanômetro a mais divide a corrente de tunelamento por um fator grande. O microscópio de tunelamento usa essa sensibilidade.",
      },
    ],
  },
};
