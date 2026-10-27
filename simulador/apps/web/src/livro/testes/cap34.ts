import type { ChapterChecks } from "../testes.ts";

export const testes: ChapterChecks = {
  n: 34,
  sections: {
    "34-2": [
      {
        q: "Qual é a diferença entre uma imagem real e uma virtual?",
        options: ["A real é maior", "Na real os raios de luz passam de fato pelo ponto da imagem e ela aparece numa tela; na virtual não", "A virtual é sempre invertida", "Não há diferença física"],
        answer: 1,
        why: "A imagem virtual só existe para quem olha: os raios parecem vir dela, como no espelho do banheiro.",
      },
    ],
    "34-3": [
      {
        q: "Você está a 1,5 m de um espelho plano. A que distância de você está a sua imagem?",
        options: ["1,5 m", "3 m", "0,75 m", "6 m"],
        answer: 1,
        why: "A imagem fica 1,5 m atrás do espelho, simétrica ao objeto: 3 m de você.",
      },
    ],
    "34-4": [
      {
        q: "Um espelho esférico côncavo tem raio de curvatura 40 cm. Qual é a distância focal?",
        options: ["40 cm", "20 cm", "80 cm", "10 cm"],
        answer: 1,
        why: "Para espelhos esféricos (raios próximos do eixo), $f = r/2$.",
      },
    ],
    "34-5": [
      {
        q: "Um objeto fica a 30 cm de um espelho côncavo de $f = 10$ cm. Onde se forma a imagem?",
        options: ["A 15 cm, real e invertida", "A 30 cm, virtual", "A 7,5 cm, virtual", "No infinito"],
        answer: 0,
        why: "$1/p + 1/i = 1/f$: $1/i = 1/10 - 1/30$, logo $i = 15$ cm, positiva (real), com $m = -i/p = -0{,}5$.",
      },
    ],
    "34-6": [
      {
        q: "Por que um peixe numa bola de aquário parece maior do que é?",
        options: ["Porque a água amplia tudo", "Porque a superfície curva água–ar refrata a luz e forma uma imagem virtual ampliada", "Porque o vidro é uma lente convergente fina", "Ilusão de óptica sem explicação física"],
        answer: 1,
        why: "Uma interface esférica entre meios de índices diferentes forma imagens: $n_1/p + n_2/i = (n_2 - n_1)/r$.",
      },
    ],
    "34-7": [
      {
        q: "Uma lente convergente de $f = 10$ cm, objeto a 5 cm. A imagem é:",
        options: ["Real e invertida", "Virtual, direita e ampliada (lupa)", "Real e do mesmo tamanho", "Não se forma"],
        answer: 1,
        why: "Com o objeto dentro da distância focal, $1/i = 1/10 - 1/5$ dá $i = -10$ cm (virtual) e $m = +2$.",
      },
    ],
    "34-8": [
      {
        q: "Num microscópio composto, o aumento total é:",
        options: ["A soma dos aumentos da objetiva e da ocular", "O produto do aumento lateral da objetiva pelo aumento angular da ocular", "Só o da ocular", "Só o da objetiva"],
        answer: 1,
        why: "A objetiva forma uma imagem real ampliada, e a ocular funciona como lupa sobre essa imagem: $M = m\\,m_\\theta$.",
      },
    ],
    "34-9": [
      {
        q: "Num par de espelhos côncavos frente a frente (a \"miragem\" de brinquedo), por que o objeto parece flutuar acima da abertura?",
        options: ["Porque há um holograma", "Porque os dois espelhos formam uma imagem real do objeto no lugar da abertura", "Porque a luz é emitida pela abertura", "Por refração no ar quente"],
        answer: 1,
        why: "A imagem real é formada pela luz que de fato converge ali; dá para vê-la de vários ângulos, mas não para tocá-la.",
      },
    ],
  },
};
