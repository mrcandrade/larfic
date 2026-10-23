import type { ChapterChecks } from "../testes.ts";

export const testes: ChapterChecks = {
  n: 8,
  sections: {
    "8-2": [
      {
        q: "Qual destas forças NÃO tem energia potencial associada?",
        options: ["Gravidade", "Força elástica de uma mola ideal", "Atrito cinético", "Força elétrica entre cargas paradas"],
        answer: 2,
        why: "O atrito cinético é dissipativo: transforma energia mecânica em térmica e o trabalho dele depende do caminho, então não define uma energia potencial.",
      },
    ],
    "8-3": [
      {
        q: "Uma pedra vai do ponto A ao ponto B por dois caminhos diferentes. O que se pode dizer do trabalho da gravidade?",
        options: ["É maior no caminho mais longo", "É o mesmo nos dois caminhos", "É zero nos dois", "Depende da velocidade"],
        answer: 1,
        why: "A gravidade é conservativa: o trabalho só depende das alturas inicial e final, $W = -mg\\,\\Delta y$. Num caminho fechado ele é zero.",
      },
    ],
    "8-4": [
      {
        q: "Uma mola de $k = 400$ N/m está comprimida 5 cm. Quanto energia potencial ela guarda?",
        options: ["10 J", "0,5 J", "1 J", "20 J"],
        answer: 1,
        why: "$U = \\tfrac12 kx^2 = \\tfrac12\\cdot 400\\cdot 0{,}05^2 = 0{,}5$ J. Lembre de converter cm em m.",
      },
    ],
    "8-5": [
      {
        q: "Sem atrito, uma bola é solta do repouso de 5 m de altura. Com que velocidade chega ao chão? ($g = 10$ m/s²)",
        options: ["5 m/s", "10 m/s", "50 m/s", "100 m/s"],
        answer: 1,
        why: "$mgh = \\tfrac12 mv^2$ dá $v = \\sqrt{2gh} = 10$ m/s, qualquer que seja a massa.",
      },
    ],
    "8-6": [
      {
        q: "Numa curva $U(x)$, onde fica uma posição de equilíbrio estável?",
        options: ["Num máximo de $U$", "Num mínimo de $U$", "Onde $U = 0$", "Onde $U$ é mais íngreme"],
        answer: 1,
        why: "$F = -dU/dx$ é zero nos extremos. No mínimo, um pequeno desvio cria uma força que traz de volta; no máximo, empurra para longe (equilíbrio instável).",
      },
    ],
    "8-7": [
      {
        q: "Você empurra um caixote com 300 J de trabalho; ele ganha 120 J de energia cinética e não muda de altura. Quanto virou energia térmica?",
        options: ["120 J", "180 J", "300 J", "420 J"],
        answer: 1,
        why: "$W = \\Delta K + \\Delta E_{térm}$: $300 = 120 + \\Delta E_{térm}$, então 180 J foram para o atrito (aquecimento do piso e do caixote).",
      },
    ],
    "8-8": [
      {
        q: "Um carro freia até parar numa estrada plana. Para onde foi a energia cinética?",
        options: ["Desapareceu", "Virou energia potencial gravitacional", "Virou principalmente energia térmica nos freios e pneus", "Voltou para o tanque de combustível"],
        answer: 2,
        why: "A energia total se conserva: a cinética vira térmica por atrito. Carros híbridos recuperam parte dela com freios regenerativos.",
      },
    ],
  },
};
