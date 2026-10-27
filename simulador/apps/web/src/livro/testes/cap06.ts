import type { ChapterChecks } from "../testes.ts";

export const testes: ChapterChecks = {
  n: 6,
  sections: {
    "6-2": [
      {
        q: "Uma caixa está parada no chão e você a empurra com uma força horizontal pequena, sem que ela se mova. Quanto vale o atrito?",
        options: ["Zero, porque a caixa está parada", "$\\mu_s N$", "Igual à força que você aplica", "Maior que a força que você aplica"],
        answer: 2,
        why: "O atrito estático se ajusta para manter a caixa parada, até o máximo $\\mu_s N$. Enquanto ela não se move, ele é igual e oposto ao seu empurrão.",
      },
    ],
    "6-3": [
      {
        q: "Normalmente, como se comparam os coeficientes de atrito estático e cinético entre as mesmas superfícies?",
        options: ["$\\mu_s > \\mu_k$", "$\\mu_s < \\mu_k$", "São sempre iguais", "Não há relação"],
        answer: 0,
        why: "É mais difícil tirar do repouso do que manter deslizando: o atrito cai quando o objeto começa a escorregar. Por isso o freio ABS evita que a roda trave.",
      },
    ],
    "6-4": [
      {
        q: "Uma gota cai a velocidade terminal. O que acontece com a força resultante sobre ela?",
        options: ["É igual ao peso", "É nula", "Aponta para cima", "Cresce com o tempo"],
        answer: 1,
        why: "Na velocidade terminal o arrasto equilibra o peso: resultante nula e velocidade constante.",
      },
    ],
    "6-5": [
      {
        q: "Num loop vertical, no ponto mais alto, que força faz o papel de força centrípeta sobre o carrinho?",
        options: ["Uma força especial chamada centrípeta, além das outras", "A soma do peso com a normal, ambos apontando para baixo", "Só a normal, para cima", "Nenhuma, porque o carrinho está no alto"],
        answer: 1,
        why: "Força centrípeta não é um novo tipo de força: é a resultante na direção do centro. No alto, $mg + N = mv^2/r$.",
      },
    ],
  },
};
