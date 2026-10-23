import type { ChapterChecks } from "../testes.ts";

export const testes: ChapterChecks = {
  n: 17,
  sections: {
    "17-2": [
      {
        q: "Que tipo de onda é o som no ar?",
        options: ["Transversal", "Longitudinal, com compressões e rarefações", "Eletromagnética", "Uma onda de superfície"],
        answer: 1,
        why: "As moléculas do ar oscilam na direção de propagação, criando regiões de pressão maior e menor. Gases não sustentam ondas transversais.",
      },
    ],
    "17-3": [
      {
        q: "Por que o som é mais rápido no aço do que no ar?",
        options: ["Porque o aço é mais denso", "Porque o aço é muito mais rígido (módulo de elasticidade enorme), o que supera a densidade maior", "Porque o aço conduz eletricidade", "Porque o ar absorve o som"],
        answer: 1,
        why: "$v = \\sqrt{B/\\rho}$: a densidade maior reduziria $v$, mas o módulo do aço é cerca de um milhão de vezes o do ar. O som corre a cerca de 5900 m/s no aço contra 343 m/s no ar.",
      },
    ],
    "17-4": [
      {
        q: "Numa onda sonora, onde a variação de pressão é máxima em relação ao deslocamento das moléculas?",
        options: ["Onde o deslocamento é máximo", "Onde o deslocamento é zero", "Em toda parte igualmente", "Só na fonte"],
        answer: 1,
        why: "As ondas de pressão e de deslocamento estão defasadas de 90°: o ar se comprime mais onde as moléculas estão no ponto de equilíbrio, com vizinhos se aproximando.",
      },
    ],
    "17-5": [
      {
        q: "Duas caixas de som em fase emitem a mesma nota. Num ponto em que a diferença de caminho é $\\lambda/2$, você ouve:",
        options: ["Som mais forte", "Som muito fraco (interferência destrutiva)", "O dobro da frequência", "O mesmo som de uma caixa só"],
        answer: 1,
        why: "Meio comprimento de onda de diferença põe as ondas em oposição de fase. Com diferença de um número inteiro de comprimentos de onda, a interferência é construtiva.",
      },
    ],
    "17-6": [
      {
        q: "Se a intensidade sonora fica 100 vezes maior, o nível sonoro aumenta:",
        options: ["100 dB", "20 dB", "10 dB", "2 dB"],
        answer: 1,
        why: "$\\beta = 10\\log(I/I_0)$: multiplicar $I$ por $10^2$ soma $10\\cdot2 = 20$ dB.",
      },
    ],
    "17-7": [
      {
        q: "Num tubo aberto numa ponta e fechado na outra, quais harmônicos existem?",
        options: ["Todos", "Só os ímpares ($f$, $3f$, $5f$…)", "Só os pares", "Só o fundamental"],
        answer: 1,
        why: "A ponta fechada é nó e a aberta é antinó, o que obriga $L = n\\lambda/4$ com $n$ ímpar.",
      },
    ],
    "17-8": [
      {
        q: "Dois diapasões de 440 Hz e 444 Hz soam juntos. Quantos batimentos por segundo você ouve?",
        options: ["2", "4", "442", "884"],
        answer: 1,
        why: "A frequência de batimento é a diferença: $|444 - 440| = 4$ Hz. Afinadores usam isso, apertando a corda até os batimentos sumirem.",
      },
    ],
    "17-9": [
      {
        q: "Uma ambulância se aproxima de você e depois se afasta. O que você percebe?",
        options: ["Frequência mais alta ao se aproximar e mais baixa ao se afastar", "Frequência mais baixa ao se aproximar", "A mesma frequência, só mais forte", "A frequência muda só se você estiver se movendo"],
        answer: 0,
        why: "No efeito Doppler, as frentes de onda chegam mais juntas quando a fonte se aproxima e mais espaçadas quando se afasta.",
      },
    ],
    "17-10": [
      {
        q: "Um avião voa a Mach 2. Qual é o semiângulo do cone de Mach?",
        options: ["60°", "30°", "45°", "90°"],
        answer: 1,
        why: "$\\text{sen}\\,\\theta = v_{som}/v_{fonte} = 1/2$, logo $\\theta = 30°$. Quanto mais rápido, mais fechado o cone.",
      },
    ],
  },
};
