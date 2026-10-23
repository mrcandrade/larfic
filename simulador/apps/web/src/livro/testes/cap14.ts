import type { ChapterChecks } from "../testes.ts";

export const testes: ChapterChecks = {
  n: 14,
  sections: {
    "14-2": [
      {
        q: "O que distingue um fluido de um sólido?",
        options: ["O fluido não tem massa", "O fluido escoa: não resiste a tensões de cisalhamento em repouso", "O fluido é sempre um gás", "O fluido não exerce pressão"],
        answer: 1,
        why: "Um fluido se deforma continuamente sob cisalhamento e toma a forma do recipiente; líquidos e gases são fluidos.",
      },
    ],
    "14-3": [
      {
        q: "A mesma força é aplicada por um salto fino e por um sapato de sola larga. Qual causa mais pressão no piso?",
        options: ["O sapato de sola larga", "O salto fino", "Os dois iguais", "Depende do peso da pessoa só"],
        answer: 1,
        why: "$p = F/A$: a mesma força numa área menor dá pressão maior. Por isso saltos finos marcam pisos de madeira.",
      },
    ],
    "14-4": [
      {
        q: "A que profundidade na água a pressão manométrica é de cerca de 1 atm? ($\\rho = 1000$ kg/m³, $g = 10$ m/s²)",
        options: ["1 m", "10 m", "100 m", "0,1 m"],
        answer: 1,
        why: "$\\rho g h = 1000\\cdot10\\cdot h = 10^5$ Pa dá $h \\approx 10$ m. A pressão absoluta ali é cerca de 2 atm.",
      },
      {
        q: "Três recipientes de formatos diferentes estão cheios de água até a mesma altura. Em qual a pressão no fundo é maior?",
        options: ["No que tem mais água", "No mais largo", "É a mesma nos três", "No mais estreito"],
        answer: 2,
        why: "A pressão hidrostática só depende da profundidade: $p = p_0 + \\rho gh$. É o chamado paradoxo hidrostático.",
      },
    ],
    "14-5": [
      {
        q: "Num barômetro de mercúrio, a altura da coluna ao nível do mar é cerca de 760 mm. Se fosse feito com água, a coluna teria cerca de:",
        options: ["760 mm", "10 m", "76 m", "1 m"],
        answer: 1,
        why: "A água é 13,6 vezes menos densa: $0{,}76\\cdot13{,}6 \\approx 10{,}3$ m. Por isso se usa mercúrio.",
      },
    ],
    "14-6": [
      {
        q: "Numa prensa hidráulica, o pistão grande tem área 50 vezes maior. Para erguer 5000 N, que força basta no pistão pequeno?",
        options: ["250 000 N", "100 N", "5000 N", "50 N"],
        answer: 1,
        why: "A pressão se transmite igual: $F_1/A_1 = F_2/A_2$, logo $F_1 = 5000/50 = 100$ N. Em troca, o pistão pequeno percorre uma distância 50 vezes maior.",
      },
    ],
    "14-7": [
      {
        q: "Um bloco flutua com 30% do volume fora da água. Qual a massa específica dele?",
        options: ["300 kg/m³", "700 kg/m³", "1300 kg/m³", "1000 kg/m³"],
        answer: 1,
        why: "Flutuando, empuxo = peso: $\\rho_{água}V_{sub} = \\rho V$, então $\\rho = 0{,}7\\cdot1000$ kg/m³.",
      },
    ],
    "14-8": [
      {
        q: "Qual destas é uma hipótese do fluido ideal?",
        options: ["Escoamento turbulento", "Viscosidade nula e escoamento estacionário, incompressível e irrotacional", "Densidade variável", "Atrito com as paredes"],
        answer: 1,
        why: "O modelo ideal simplifica o escoamento para que valham a equação da continuidade e a de Bernoulli.",
      },
    ],
    "14-9": [
      {
        q: "Água corre num cano que se estreita de 4 cm² para 1 cm² de seção. Se a velocidade era 2 m/s, no trecho estreito ela é:",
        options: ["0,5 m/s", "8 m/s", "2 m/s", "4 m/s"],
        answer: 1,
        why: "$A_1v_1 = A_2v_2$: $4\\cdot2 = 1\\cdot v_2$, logo 8 m/s. A vazão é a mesma em todo o cano.",
      },
    ],
    "14-10": [
      {
        q: "No trecho estreito de um tubo horizontal (tubo de Venturi), a pressão do fluido é:",
        options: ["Maior que no trecho largo", "Menor que no trecho largo", "Igual", "Zero"],
        answer: 1,
        why: "Pela equação de Bernoulli, onde a velocidade é maior a pressão é menor: $p + \\tfrac12\\rho v^2$ é constante num tubo horizontal.",
      },
    ],
  },
};
