import type { ChapterChecks } from "../testes.ts";

export const testes: ChapterChecks = {
  n: 2,
  sections: {
    "2-2": [
      {
        q: "Quando dá para tratar um objeto como partícula no estudo do movimento?",
        options: ["Quando todas as suas partes se movem da mesma forma (ou o tamanho dele não importa para a pergunta)", "Só quando ele é menor que um átomo", "Só quando ele está em repouso", "Nunca: todo objeto real tem tamanho"],
        answer: 0,
        why: "Um carro numa estrada longa ou um planeta em órbita podem ser partículas: o que interessa é o movimento de conjunto, não a rotação ou a forma.",
      },
    ],
    "2-3": [
      {
        q: "Um corredor sai de $x = 5$ m, vai até $x = 30$ m e volta até $x = 10$ m. Qual é o deslocamento?",
        options: ["+45 m", "+5 m", "+25 m", "−20 m"],
        answer: 1,
        why: "O deslocamento só depende das posições inicial e final: $\\Delta x = 10 - 5 = +5$ m. A distância percorrida é que vale 45 m.",
      },
    ],
    "2-4": [
      {
        q: "Uma ciclista percorre uma pista circular de 400 m e volta ao ponto de partida em 80 s. O que vale para a volta completa?",
        options: ["Velocidade média 5 m/s e velocidade escalar média 5 m/s", "Velocidade média zero e velocidade escalar média 5 m/s", "Velocidade média zero e velocidade escalar média zero", "Velocidade média 5 m/s e velocidade escalar média zero"],
        answer: 1,
        why: "O deslocamento é nulo, então a velocidade média é zero; a velocidade escalar média usa a distância total: $400/80 = 5$ m/s.",
      },
    ],
    "2-5": [
      {
        q: "No gráfico $x(t)$ de um objeto, o que representa a velocidade instantânea num instante?",
        options: ["A altura da curva naquele instante", "A inclinação da reta tangente à curva naquele instante", "A área sob a curva até aquele instante", "A inclinação da reta que liga a origem ao ponto"],
        answer: 1,
        why: "$v = dx/dt$ é a inclinação da tangente. A reta que liga dois pontos da curva dá a velocidade média no intervalo.",
      },
    ],
    "2-6": [
      {
        q: "Um carro anda no sentido negativo do eixo $x$ e está freando. Qual é o sinal da aceleração?",
        options: ["Negativo, porque o carro vai no sentido negativo", "Positivo, porque a velocidade (negativa) está ficando menos negativa", "Zero, porque a velocidade diminui", "Depende do valor da velocidade"],
        answer: 1,
        why: "Frear significa aceleração oposta à velocidade. Com $v < 0$ e $|v|$ diminuindo, $v$ cresce em direção a zero: $a > 0$. Aceleração negativa não quer dizer \"freando\".",
      },
    ],
    "2-7": [
      {
        q: "Um carro parte do repouso com aceleração constante de 2 m/s². Que distância percorre nos primeiros 5 s?",
        options: ["10 m", "25 m", "50 m", "5 m"],
        answer: 1,
        why: "$x = \\tfrac12 a t^2 = \\tfrac12\\cdot 2\\cdot 25 = 25$ m. A resposta 50 m esquece o fator 1/2.",
      },
    ],
    "2-8": [
      {
        q: "Qual equação você usa para achar a distância de frenagem conhecendo $v_0$, $v = 0$ e $a$, sem saber o tempo?",
        options: ["$x - x_0 = v_0 t + \\tfrac12 a t^2$", "$v^2 = v_0^2 + 2a(x - x_0)$", "$v = v_0 + a t$", "$x - x_0 = v t - \\tfrac12 a t^2$"],
        answer: 1,
        why: "A equação de Torricelli não tem $t$: $\\Delta x = -v_0^2/2a$. Com ela, dobrar a velocidade quadruplica a distância de frenagem.",
      },
    ],
    "2-9": [
      {
        q: "Uma bola é lançada para cima. No ponto mais alto da trajetória, qual é a aceleração dela?",
        options: ["Zero, porque ela para", "$g$ para baixo", "$g$ para cima", "Muda de sentido nesse instante"],
        answer: 1,
        why: "A velocidade é zero por um instante, mas a gravidade continua agindo: a aceleração é $9{,}8$ m/s² para baixo durante todo o voo (sem resistência do ar).",
      },
    ],
    "2-10": [
      {
        q: "No gráfico $a(t)$, o que representa a área sob a curva entre $t_1$ e $t_2$?",
        options: ["O deslocamento no intervalo", "A variação de velocidade no intervalo", "A aceleração média", "A posição em $t_2$"],
        answer: 1,
        why: "$\\Delta v = \\int a\\,dt$. Da mesma forma, a área sob $v(t)$ dá o deslocamento.",
      },
    ],
  },
};
