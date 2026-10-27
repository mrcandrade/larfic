import type { ChapterChecks } from "../testes.ts";

export const testes: ChapterChecks = {
  n: 7,
  sections: {
    "7-2": [
      {
        q: "O que significa dizer que a energia se conserva?",
        options: ["Que ela nunca muda de forma", "Que a quantidade total num sistema isolado é constante, embora mude de forma", "Que cada objeto guarda sempre a mesma energia", "Que ela só existe em movimento"],
        answer: 1,
        why: "A energia passa de uma forma para outra (cinética, potencial, térmica…) e de um corpo para outro, mas o total de um sistema isolado não varia.",
      },
    ],
    "7-3": [
      {
        q: "Se a velocidade de um carro dobra, a energia cinética:",
        options: ["Dobra", "Quadruplica", "Fica igual", "Cai pela metade"],
        answer: 1,
        why: "$K = \\tfrac12 mv^2$: dobrar $v$ multiplica $K$ por 4. Por isso a distância de frenagem cresce tanto com a velocidade.",
      },
    ],
    "7-4": [
      {
        q: "Uma pessoa segura uma mala parada a 1 m do chão por 1 minuto. Quanto trabalho ela realiza sobre a mala?",
        options: ["Muito, porque cansa", "Zero, porque a mala não se desloca", "$mgh$", "Negativo"],
        answer: 1,
        why: "Trabalho de uma força exige deslocamento do ponto de aplicação: $W = \\vec F\\cdot\\vec d = 0$. O cansaço vem do trabalho interno dos músculos, não de trabalho sobre a mala.",
      },
    ],
    "7-5": [
      {
        q: "O trabalho total sobre um corpo é de −50 J. O que acontece com a energia cinética dele?",
        options: ["Aumenta 50 J", "Diminui 50 J", "Fica igual", "Depende da massa"],
        answer: 1,
        why: "Teorema trabalho–energia: $\\Delta K = W_{total}$. Trabalho total negativo significa que o corpo perdeu energia cinética.",
      },
    ],
    "7-6": [
      {
        q: "Você ergue uma caixa de 5 kg a 2 m de altura com velocidade constante. Quanto vale o trabalho da gravidade? ($g = 10$ m/s²)",
        options: ["+100 J", "−100 J", "0", "−10 J"],
        answer: 1,
        why: "A gravidade aponta para baixo e o deslocamento para cima: $W_g = -mgh = -100$ J. Sua força faz +100 J e o trabalho total é zero, como manda a velocidade constante.",
      },
    ],
    "7-7": [
      {
        q: "Uma mola de $k = 200$ N/m é esticada de 0 a 0,1 m. Quanto trabalho a força da mola realiza?",
        options: ["+1 J", "−1 J", "−2 J", "−20 J"],
        answer: 1,
        why: "$W_s = -\\tfrac12 k x^2 = -\\tfrac12\\cdot 200\\cdot 0{,}01 = -1$ J. A força da mola é oposta ao alongamento.",
      },
    ],
    "7-8": [
      {
        q: "Como se calcula o trabalho de uma força $F(x)$ que varia com a posição?",
        options: ["$F$ no ponto final vezes o deslocamento", "A área sob a curva $F(x)$ entre as posições inicial e final", "A inclinação da curva $F(x)$", "A média das forças vezes o tempo"],
        answer: 1,
        why: "$W = \\int F(x)\\,dx$, que é a área (com sinal) sob o gráfico. Só para força constante isso se reduz a $F\\,\\Delta x$.",
      },
    ],
    "7-9": [
      {
        q: "Um motor ergue 100 kg a 6 m em 12 s com velocidade constante. Qual a potência média fornecida? ($g = 10$ m/s²)",
        options: ["50 W", "500 W", "6000 W", "7200 W"],
        answer: 1,
        why: "$P = W/\\Delta t = mgh/\\Delta t = 6000/12 = 500$ W.",
      },
    ],
  },
};
