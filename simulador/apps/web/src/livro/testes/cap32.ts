import type { ChapterChecks } from "../testes.ts";

export const testes: ChapterChecks = {
  n: 32,
  sections: {
    "32-1": [
      {
        q: "Qual é o fluxo magnético total através de qualquer superfície fechada?",
        options: ["$\\mu_0 i$", "Zero", "Depende dos ímãs dentro", "$q/\\varepsilon_0$"],
        answer: 1,
        why: "Não há monopolos magnéticos: as linhas de $\\vec B$ se fecham, e tudo o que entra sai. Cortar um ímã ao meio dá dois ímãs, cada um com dois polos.",
      },
    ],
    "32-2": [
      {
        q: "Enquanto um capacitor de placas circulares está sendo carregado, entre as placas aparece:",
        options: ["Nada além do campo elétrico", "Um campo magnético circular, induzido pelo campo elétrico variável", "Uma corrente de elétrons", "Um campo magnético radial"],
        answer: 1,
        why: "Assim como $\\vec B$ variável induz $\\vec E$, um $\\vec E$ variável induz $\\vec B$: é o termo de Maxwell da lei de Ampère–Maxwell.",
      },
    ],
    "32-3": [
      {
        q: "A corrente de deslocamento entre as placas de um capacitor que se carrega com corrente $i$ vale:",
        options: ["Zero", "$i$", "$2i$", "$i/2$"],
        answer: 1,
        why: "$i_d = \\varepsilon_0\\,d\\Phi_E/dt$ é igual à corrente nos fios, o que mantém a \"corrente\" contínua através do capacitor.",
      },
    ],
    "32-4": [
      {
        q: "O que acontece se você quebrar um ímã em barra ao meio?",
        options: ["Fica um pedaço com o polo norte e outro com o sul", "Cada pedaço vira um ímã completo, com norte e sul", "Os pedaços perdem o magnetismo", "Só um pedaço continua ímã"],
        answer: 1,
        why: "O magnetismo vem dos dipolos atômicos alinhados em todo o material; não existe polo isolado.",
      },
    ],
    "32-5": [
      {
        q: "De onde vem o magnetismo dos materiais, em escala atômica?",
        options: ["Das cargas paradas no núcleo", "Do spin dos elétrons e do movimento orbital deles", "Do campo da Terra", "Da gravidade"],
        answer: 1,
        why: "Cada elétron tem momento magnético de spin (cerca de um magnéton de Bohr) e orbital; a soma deles determina o comportamento do material.",
      },
    ],
    "32-6": [
      {
        q: "Uma amostra diamagnética num campo não uniforme é:",
        options: ["Atraída para a região de campo forte", "Repelida da região de campo forte", "Indiferente", "Magnetizada permanentemente"],
        answer: 1,
        why: "O diamagnetismo cria um momento oposto ao campo aplicado. Com campo intenso dá para levitar até um sapo, que é quase todo água, um material diamagnético.",
      },
    ],
    "32-7": [
      {
        q: "Num material paramagnético, segundo a lei de Curie, se a temperatura dobrar (campo fixo e longe da saturação), a magnetização:",
        options: ["Dobra", "Cai à metade", "Fica igual", "Vai a zero"],
        answer: 1,
        why: "$M = C\\,B_{ext}/T$: a agitação térmica desalinha os dipolos.",
      },
    ],
    "32-8": [
      {
        q: "Acima da temperatura de Curie, um material ferromagnético:",
        options: ["Fica mais magnético", "Perde a magnetização espontânea e passa a ser paramagnético", "Vira supercondutor", "Derrete"],
        answer: 1,
        why: "A agitação térmica vence o acoplamento de troca que alinha os domínios. Para o ferro, isso acontece perto de 1043 K.",
      },
    ],
  },
};
